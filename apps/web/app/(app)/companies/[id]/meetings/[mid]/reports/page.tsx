'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Download,
  CheckCircle2,
  Sparkles,
  Lock,
  Globe,
  RotateCcw,
} from 'lucide-react';
import {
  REPORT_KINDS,
  REPORT_LABELS,
  REPORT_DESCRIPTIONS,
  type ReportKind,
  type MeetingMinutesDto,
} from '@irm/shared';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Panel,
  Skeleton,
} from '@irm/ui';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useCompany } from '../../../company-context';

export default function ReportsAndMinutesPage() {
  const c = useCompany();
  const { mid } = useParams<{ mid: string }>();
  const { can } = useSession();
  const qc = useQueryClient();

  const [editorContent, setEditorContent] = useState<string | null>(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [signedByInput, setSignedByInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const minutesKey = ['companies', c.id, 'meetings', mid, 'minutes'];
  const minutesQuery = useQuery({
    queryKey: minutesKey,
    queryFn: () =>
      api.get<{ minutes: MeetingMinutesDto | null; suggestedDraft: string }>(
        `/companies/${c.id}/meetings/${mid}/minutes`,
      ),
  });

  const saveMutation = useMutation({
    mutationFn: (content: string) =>
      api.put<MeetingMinutesDto>(`/companies/${c.id}/meetings/${mid}/minutes`, { content }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: minutesKey });
      setActionSuccess('Minutes draft saved successfully.');
      setActionError(null);
      setEditorContent(data.content);
    },
    onError: (err) => setActionError(err.message),
  });

  const finalizeMutation = useMutation({
    mutationFn: (signedBy: string) =>
      api.post<MeetingMinutesDto>(`/companies/${c.id}/meetings/${mid}/minutes/finalize`, {
        signedBy,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: minutesKey });
      qc.invalidateQueries({ queryKey: ['companies', c.id, 'meetings', mid] });
      setFinalizeOpen(false);
      setActionSuccess('Minutes have been finalized. The meeting may now be archived.');
      setActionError(null);
    },
    onError: (err) => setActionError(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      api.post<MeetingMinutesDto>(`/companies/${c.id}/meetings/${mid}/minutes/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: minutesKey });
      qc.invalidateQueries({ queryKey: ['companies', c.id, 'meetings', mid] });
      setActionSuccess('Minutes have been published to the Shareholder Portal.');
      setActionError(null);
    },
    onError: (err) => setActionError(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () =>
      api.post<MeetingMinutesDto>(`/companies/${c.id}/meetings/${mid}/minutes/reopen`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: minutesKey });
      setActionSuccess('Minutes reopened for editing.');
      setActionError(null);
      setEditorContent(data.content);
    },
    onError: (err) => setActionError(err.message),
  });

  if (minutesQuery.isPending) {
    return <Skeleton className="h-64" />;
  }

  const minutes = minutesQuery.data?.minutes ?? null;
  const suggestedDraft = minutesQuery.data?.suggestedDraft ?? '';
  const currentContent = editorContent ?? minutes?.content ?? suggestedDraft;
  const status = minutes?.status ?? 'DRAFT';

  const downloadReport = (kind: ReportKind, format: 'pdf' | 'xlsx' | 'csv') => {
    const url = `/api/v1/companies/${c.id}/meetings/${mid}/reports/${kind}?format=${format}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h3 className="text-base font-semibold text-ink">Official Reports & Meeting Minutes</h3>
        <p className="mt-1 text-sm text-ink-3">
          Download certified audit reports and author the official minutes of the meeting.
        </p>
      </div>

      {actionError && <Alert tone="danger">{actionError}</Alert>}
      {actionSuccess && <Alert tone="success">{actionSuccess}</Alert>}

      {/* Official Reports Section */}
      <Panel className="p-6">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h4 className="font-medium text-ink">Official Governance Reports</h4>
            <p className="text-xs text-ink-3">
              Export comprehensive compliance documents in PDF, Excel, or CSV format.
            </p>
          </div>
          <Badge tone="neutral">5 reports available</Badge>
        </div>

        <div className="mt-4 divide-y divide-line/60">
          {REPORT_KINDS.map((kind) => (
            <div key={kind} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-primary" aria-hidden />
                  <span className="text-sm font-medium text-ink">{REPORT_LABELS[kind]}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-3">{REPORT_DESCRIPTIONS[kind]}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadReport(kind, 'pdf')}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" aria-hidden /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => downloadReport(kind, 'xlsx')}
                  className="gap-1.5"
                >
                  <Download className="size-3.5" aria-hidden /> Excel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadReport(kind, 'csv')}
                  className="gap-1.5"
                >
                  CSV
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Meeting Minutes Section */}
      <Panel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-ink">Official Meeting Minutes</h4>
              {status === 'DRAFT' && <Badge tone="neutral">Draft</Badge>}
              {status === 'FINAL' && (
                <Badge tone="success" className="gap-1">
                  <CheckCircle2 className="size-3" aria-hidden /> Finalized
                </Badge>
              )}
              {status === 'PUBLISHED' && (
                <Badge tone="success" className="gap-1">
                  <Globe className="size-3" aria-hidden /> Published to Shareholders
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              Minutes must be finalized before the meeting can be archived under statutory governance rules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!minutes && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditorContent(suggestedDraft)}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5 text-primary" aria-hidden /> Pre-fill from meeting data
              </Button>
            )}

            {status === 'DRAFT' && can('meeting.update', c.scope) && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveMutation.mutate(currentContent)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save draft'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setFinalizeOpen(true)}
                  className="gap-1.5"
                >
                  <Lock className="size-3.5" aria-hidden /> Finalize minutes
                </Button>
              </>
            )}

            {status === 'FINAL' && can('meeting.update', c.scope) && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => reopenMutation.mutate()}
                  disabled={reopenMutation.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" aria-hidden /> Reopen for editing
                </Button>
                <Button
                  size="sm"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="gap-1.5"
                >
                  <Globe className="size-3.5" aria-hidden /> Publish to shareholders
                </Button>
              </>
            )}

            {status === 'PUBLISHED' && can('meeting.update', c.scope) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" aria-hidden /> Reopen for amendments
              </Button>
            )}
          </div>
        </div>

        {/* Minutes Meta Information if finalized */}
        {minutes && minutes.status !== 'DRAFT' && (
          <div className="my-4 rounded-md border border-line bg-canvas p-3.5 text-xs text-ink-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-ink">Signee:</span> {minutes.signedBy || 'Board Chairman'}
              </div>
              <div className="flex items-center gap-4 text-ink-3">
                {minutes.finalizedAt && (
                  <span>Finalized: {formatDateTime(minutes.finalizedAt)}</span>
                )}
                {minutes.publishedAt && (
                  <span>Published: {formatDateTime(minutes.publishedAt)}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Minutes Text Editor or Preview */}
        <div className="mt-4">
          <Field
            label={status === 'DRAFT' ? 'Minutes Document Content (Markdown)' : 'Official Minutes Record'}
            htmlFor="minutesContent"
          >
            <textarea
              id="minutesContent"
              value={currentContent}
              onChange={(e) => setEditorContent(e.target.value)}
              readOnly={status !== 'DRAFT'}
              rows={18}
              className={`w-full rounded-md border border-line p-4 font-mono text-xs leading-relaxed text-ink shadow-xs focus:border-primary focus:outline-hidden ${
                status !== 'DRAFT' ? 'bg-canvas text-ink-2' : 'bg-surface'
              }`}
              placeholder="Enter official minutes..."
            />
          </Field>
        </div>
      </Panel>

      {/* Finalize Dialog */}
      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent
          title="Finalize Meeting Minutes"
          description="Finalizing locks the minutes against routine changes and confirms that proceedings have been verified by the Chairman or Company Secretary."
        >
          <div className="space-y-4">
            <Field label="Signee Name & Designation" htmlFor="signedBy">
              <Input
                id="signedBy"
                value={signedByInput}
                onChange={(e) => setSignedByInput(e.target.value)}
                placeholder="e.g. Mahmudul Hasan, Chairman of the Meeting"
                autoFocus
              />
            </Field>

            <DialogFooter className="pt-2">
              <Button variant="secondary" onClick={() => setFinalizeOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => finalizeMutation.mutate(signedByInput)}
                disabled={signedByInput.trim().length < 3 || finalizeMutation.isPending}
              >
                {finalizeMutation.isPending ? 'Finalizing...' : 'Confirm and finalize'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
