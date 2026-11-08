'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, MessageSquare, Send, XCircle } from 'lucide-react';
import { QUESTION_STATUSES, type ModerationActionKind, type QuestionDto, type QuestionStatus } from '@irm/shared';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  EmptyState,
  Field,
  Panel,
  PanelHeader,
  Skeleton,
  Textarea,
} from '@irm/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useMeetingEvents } from '@/lib/use-meeting-events';
import { useCompany } from '../../../company-context';
import { meetingKey, useMeeting } from '../meeting-context';

type FilterTab = 'ALL' | QuestionStatus;

const STATUS_LABELS: Record<QuestionStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  FORWARDED: 'Forwarded',
  REJECTED: 'Rejected',
};

const STATUS_TONES: Record<QuestionStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'info',
  FORWARDED: 'success',
  REJECTED: 'danger',
};

export default function MeetingModerationPage() {
  const c = useCompany();
  const m = useMeeting();
  const { can } = useSession();
  const qc = useQueryClient();

  const canModerate = can('question.moderate', c.scope);
  const liveBase = `/companies/${c.id}/meetings/${m.id}/live`;
  const questionsKey = [...meetingKey(c.id, m.id), 'moderation-questions'] as const;

  const q = useQuery({
    queryKey: questionsKey,
    queryFn: () => api.get<QuestionDto[]>(`${liveBase}/moderation/questions`),
  });

  useMeetingEvents({
    eventsPath: `${liveBase}/events`,
    queryKeys: [questionsKey, meetingKey(c.id, m.id)],
  });

  const [filter, setFilter] = React.useState<FilterTab>('ALL');
  const [banglaOnly, setBanglaOnly] = React.useState(false);
  const [rejecting, setRejecting] = React.useState<QuestionDto | null>(null);

  const moderate = useMutation({
    mutationFn: (vars: { id: string; action: ModerationActionKind; note?: string }) =>
      api.post<QuestionDto>(`${liveBase}/moderation/questions/${vars.id}/action`, {
        action: vars.action,
        note: vars.note,
      }),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: questionsKey });
      toast.success(
        vars.action === 'FORWARD'
          ? 'Forwarded to board'
          : vars.action === 'APPROVE'
            ? 'Question approved'
            : 'Question rejected',
      );
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isError) return <Alert tone="danger">{q.error.message}</Alert>;
  if (q.isPending) return <Skeleton className="h-64" />;

  const all = q.data;
  const counts: Record<FilterTab, number> = {
    ALL: all.length,
    PENDING: 0,
    APPROVED: 0,
    FORWARDED: 0,
    REJECTED: 0,
  };
  for (const item of all) counts[item.status]++;

  const visible = all.filter((item) => {
    if (filter !== 'ALL' && item.status !== filter) return false;
    if (banglaOnly && !item.bangla) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter questions by status">
          {(['ALL', ...QUESTION_STATUSES] as const).map((tab) => {
            const active = filter === tab;
            const label = tab === 'ALL' ? 'All' : STATUS_LABELS[tab];
            return (
              <Button
                key={tab}
                type="button"
                size="sm"
                variant={active ? 'primary' : 'secondary'}
                aria-pressed={active}
                onClick={() => setFilter(tab)}
              >
                {label} ({formatNumber(counts[tab])})
              </Button>
            );
          })}
        </div>

        <Button
          type="button"
          size="sm"
          variant={banglaOnly ? 'primary' : 'secondary'}
          aria-pressed={banglaOnly}
          onClick={() => setBanglaOnly((v) => !v)}
        >
          Bangla only
        </Button>
      </div>

      <Panel>
        <PanelHeader
          title="Question moderation queue"
          description="Approve questions, forward selected items to the board, or reject with an audited reason."
        />
        {visible.length === 0 ? (
          <EmptyState
            icon={<MessageSquare aria-hidden />}
            title="No matching questions"
            description="Questions submitted by shareholders and proxies appear here in real time."
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((item) => {
              const who = item.submitter
                ? item.submitter.actingAs === 'SHAREHOLDER'
                  ? item.submitter.shareholderName
                  : `${item.submitter.name} (for ${item.submitter.shareholderName})`
                : 'Participant';
              const lastAction = item.history[item.history.length - 1];

              return (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                        {item.kind === 'AUDIO' && (
                          <Badge tone="accent">Audio · {item.durationSeconds ?? 0}s</Badge>
                        )}
                        {item.bangla && <Badge tone="info">Bangla</Badge>}
                        {item.agendaItem && (
                          <Badge tone="neutral">
                            Item {item.agendaItem.number}: {item.agendaItem.title}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1.5 text-xs text-ink-3 tabular">
                        {who} · {formatDateTime(item.createdAt)}
                      </p>

                      {item.kind === 'TEXT' ? (
                        <p
                          lang={item.bangla ? 'bn' : undefined}
                          className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink"
                        >
                          {item.text}
                        </p>
                      ) : (
                        <div className="mt-2">
                          <audio
                            controls
                            preload="metadata"
                            src={`/api/v1${liveBase}/questions/${item.id}/audio`}
                            aria-label={`Audio question from ${who}`}
                            className="h-10 w-full max-w-md"
                          />
                        </div>
                      )}

                      {lastAction && (
                        <p className="mt-2 text-xs text-ink-3">
                          Last action: {lastAction.action.toLowerCase()}
                          {lastAction.actor ? ` by ${lastAction.actor}` : ''}
                          {lastAction.note ? ` — “${lastAction.note}”` : ''}
                        </p>
                      )}
                    </div>

                    {canModerate && m.state !== 'COMPLETED' && m.state !== 'ARCHIVED' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={
                            item.status === 'APPROVED' ||
                            item.status === 'FORWARDED' ||
                            moderate.isPending
                          }
                          aria-label={`Approve question from ${who}`}
                          onClick={() => moderate.mutate({ id: item.id, action: 'APPROVE' })}
                        >
                          <Check aria-hidden /> Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          disabled={item.status === 'FORWARDED' || moderate.isPending}
                          aria-label={`Forward to board: question from ${who}`}
                          onClick={() => moderate.mutate({ id: item.id, action: 'FORWARD' })}
                        >
                          <Send aria-hidden /> Forward to board
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={item.status === 'REJECTED' || moderate.isPending}
                          aria-label={`Reject question from ${who}`}
                          onClick={() => setRejecting(item)}
                        >
                          <XCircle aria-hidden /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        {rejecting && (
          <DialogContent
            title="Reject question"
            description="Give a concise reason. Every moderation action is recorded in the audit log."
          >
            <RejectQuestionForm
              question={rejecting}
              loading={moderate.isPending}
              onSubmit={(note) => {
                moderate.mutate(
                  { id: rejecting.id, action: 'REJECT', note },
                  { onSuccess: () => setRejecting(null) },
                );
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function RejectQuestionForm({
  question,
  loading,
  onSubmit,
}: {
  question: QuestionDto;
  loading: boolean;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = React.useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (note.trim().length >= 3) onSubmit(note.trim());
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {question.text && (
          <p
            lang={question.bangla ? 'bn' : undefined}
            className="rounded-md bg-subtle px-3.5 py-2.5 text-sm text-ink-2"
          >
            {question.text}
          </p>
        )}
        <Field label="Rejection reason" htmlFor="reject-note" hint="Minimum 3 characters">
          <Textarea
            id="reject-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Duplicate of an earlier question or outside the agenda..."
          />
        </Field>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" variant="danger" loading={loading} disabled={note.trim().length < 3}>
          Reject question
        </Button>
      </DialogFooter>
    </form>
  );
}

