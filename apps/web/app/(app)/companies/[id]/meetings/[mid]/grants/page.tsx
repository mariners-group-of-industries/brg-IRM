'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ShieldCheck } from 'lucide-react';
import {
  BALLOT_CHOICE_LABELS,
  type IndividualBallotInspectionDto,
  type ParticipantKind,
  type PrivilegedGrantDecision,
  type PrivilegedGrantDto,
  type PrivilegedGrantListDto,
  type StaffVotingSessionDto,
} from '@irm/shared';
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
  Input,
  Panel,
  PanelHeader,
  Select,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from '@irm/ui';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatShares } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useCompany } from '../../../company-context';
import { meetingKey, useMeeting } from '../meeting-context';

const CAPACITY_LABELS: Record<ParticipantKind, string> = {
  SHAREHOLDER: 'Shareholder',
  CORPORATE_REPRESENTATIVE: 'Corporate rep',
  PROXY_REPRESENTATIVE: 'Proxy',
};

function GrantStatusBadge({ grant }: { grant: PrivilegedGrantDto }) {
  if (grant.status === 'PENDING') {
    return (
      <Badge tone="warning" dot>
        Pending approval
      </Badge>
    );
  }
  if (grant.status === 'APPROVED') {
    return grant.effectiveNow ? (
      <Badge tone="success" dot>
        Active
      </Badge>
    ) : (
      <Badge tone="neutral">Expired</Badge>
    );
  }
  if (grant.status === 'REJECTED') {
    return <Badge tone="danger">Rejected</Badge>;
  }
  return <Badge tone="neutral">Revoked</Badge>;
}

export default function ScrutineerGrantsPage() {
  const c = useCompany();
  const m = useMeeting();
  const { user, can } = useSession();
  const qc = useQueryClient();

  const canManage = can('authorization.manage', c.scope);
  const grantsKey = [...meetingKey(c.id, m.id), 'privileged-grants'] as const;
  const sessionsKey = [...meetingKey(c.id, m.id), 'voting-sessions'] as const;

  const grantsQ = useQuery({
    queryKey: grantsKey,
    queryFn: () => api.get<PrivilegedGrantListDto>(`/companies/${c.id}/privileged-grants?meetingId=${m.id}`),
  });

  const sessionsQ = useQuery({
    queryKey: sessionsKey,
    queryFn: () => api.get<StaffVotingSessionDto[]>(`/companies/${c.id}/meetings/${m.id}/voting/sessions`),
  });

  const [requestOpen, setRequestOpen] = React.useState(false);
  const [decisionTarget, setDecisionTarget] = React.useState<{
    grant: PrivilegedGrantDto;
    decision: 'REJECT' | 'REVOKE';
  } | null>(null);
  const [selectedSessionId, setSelectedSessionId] = React.useState<string>('');

  const approveGrant = useMutation({
    mutationFn: (grantId: string) =>
      api.post<PrivilegedGrantDto>(`/companies/${c.id}/privileged-grants/${grantId}/decision`, {
        decision: 'APPROVE' satisfies PrivilegedGrantDecision,
      }),
    onSuccess: () => {
      toast.success('Scrutineer access approved');
      void qc.invalidateQueries({ queryKey: grantsKey });
    },
    onError: (e) => toast.error(e.message),
  });

  const activeMyGrant =
    grantsQ.data?.grants.find((g) => g.effectiveNow && g.grantee.userId === user.id) ?? null;

  const sessions = sessionsQ.data ?? [];
  const effectiveSessionId =
    sessions.find((s) => s.id === selectedSessionId)?.id ?? sessions[0]?.id ?? '';

  const ballotsQ = useQuery({
    queryKey: [...meetingKey(c.id, m.id), 'ballot-inspection', effectiveSessionId],
    queryFn: () =>
      api.get<IndividualBallotInspectionDto[]>(
        `/companies/${c.id}/meetings/${m.id}/voting/sessions/${effectiveSessionId}/ballots`,
      ),
    enabled: Boolean(activeMyGrant && effectiveSessionId),
    retry: false,
  });

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info">
        Individual ballot inspection is disabled for all standing roles. A scrutineer must hold an approved, time-boxed grant approved by a second administrator under four-eyes control, and every inspection is logged.
      </Alert>

      <Panel>
        <PanelHeader
          title="Scrutineer access grants"
          description="Time-boxed individual ballot inspection grants for this meeting"
          actions={
            canManage && (
              <Button size="sm" onClick={() => setRequestOpen(true)}>
                <Plus aria-hidden /> Request access
              </Button>
            )
          }
        />
        {grantsQ.isPending ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : grantsQ.isError ? (
          <div className="p-5">
            <Alert tone="danger">{grantsQ.error.message}</Alert>
          </div>
        ) : grantsQ.data.grants.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck aria-hidden />}
            title="No scrutineer grants requested"
            description="Ballot secrecy holds throughout the meeting unless a time-boxed scrutineer grant is requested and approved."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Grantee</TH>
                <TH className="hidden md:table-cell">Justification</TH>
                <TH className="hidden lg:table-cell">Window & approval</TH>
                <TH>Status</TH>
                {canManage && (
                  <TH className="text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                )}
              </tr>
            </THead>
            <TBody>
              {grantsQ.data.grants.map((g) => {
                const cannotSelfDecide =
                  g.requestedBy.userId === user.id || g.grantee.userId === user.id;
                return (
                  <TR key={g.id}>
                    <TD>
                      <p className="font-medium text-ink">{g.grantee.fullName}</p>
                      {g.grantee.email && <p className="text-xs text-ink-3">{g.grantee.email}</p>}
                    </TD>
                    <TD className="hidden max-w-xs md:table-cell">
                      <p className="text-ink-2">{g.reason}</p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        Requested by {g.requestedBy.fullName} · <span className="tabular">{formatDateTime(g.requestedAt)}</span>
                      </p>
                    </TD>
                    <TD className="hidden lg:table-cell">
                      <p className="text-ink-2 tabular">{g.durationMinutes} min</p>
                      <p className="text-xs text-ink-3 tabular">
                        {g.expiresAt
                          ? `Expires ${formatDateTime(g.expiresAt)}`
                          : 'Starts upon approval'}
                        {g.decidedBy ? ` · Decided by ${g.decidedBy.fullName}` : ''}
                      </p>
                    </TD>
                    <TD>
                      <GrantStatusBadge grant={g} />
                    </TD>
                    {canManage && (
                      <TD className="text-right">
                        {g.status === 'PENDING' ? (
                          cannotSelfDecide ? (
                            <span className="text-xs text-ink-3">Awaiting another admin</span>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                loading={approveGrant.isPending}
                                onClick={() => approveGrant.mutate(g.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setDecisionTarget({ grant: g, decision: 'REJECT' })}
                              >
                                Reject
                              </Button>
                            </div>
                          )
                        ) : g.status === 'APPROVED' ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setDecisionTarget({ grant: g, decision: 'REVOKE' })}
                          >
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-xs text-ink-3">—</span>
                        )}
                      </TD>
                    )}
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Individual ballot inspection"
          description={
            activeMyGrant
              ? `Your scrutineer grant is active until ${formatDateTime(activeMyGrant.expiresAt)}.`
              : 'Available only to a scrutineer holding an active approved grant.'
          }
          actions={
            activeMyGrant && sessions.length > 0 ? (
              <div className="w-64">
                <Select
                  aria-label="Voting session to inspect"
                  value={effectiveSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      Item {s.agendaNumber} (Session {s.sessionNumber})
                    </option>
                  ))}
                </Select>
              </div>
            ) : undefined
          }
        />

        {!activeMyGrant ? (
          <EmptyState
            icon={<ShieldCheck aria-hidden />}
            title="Inspection locked"
            description="No active scrutineer access grant is currently held by your account for this meeting."
          />
        ) : sessions.length === 0 ? (
          <EmptyState title="No voting sessions yet" description="Ballots appear once a voting session is opened." />
        ) : ballotsQ.isPending ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : ballotsQ.isError ? (
          <div className="p-5">
            <Alert tone="danger">{ballotsQ.error.message}</Alert>
          </div>
        ) : ballotsQ.data.length === 0 ? (
          <EmptyState title="No ballots cast in this session" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Shareholder</TH>
                <TH>Account</TH>
                <TH className="hidden md:table-cell">Capacity</TH>
                <TH>Choice</TH>
                <TH className="text-right">Weight</TH>
                <TH className="hidden lg:table-cell">Cast at</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {ballotsQ.data.map((b) => (
                <TR key={b.id}>
                  <TD className="font-medium text-ink">{b.shareholderName}</TD>
                  <TD className="font-mono text-xs text-ink-2">
                    {b.accountLabel} · {b.shareClass}
                  </TD>
                  <TD className="hidden md:table-cell text-ink-2">{CAPACITY_LABELS[b.actingAs]}</TD>
                  <TD>
                    <Badge
                      tone={
                        b.choice === 'FOR' ? 'success' : b.choice === 'AGAINST' ? 'danger' : 'neutral'
                      }
                    >
                      {BALLOT_CHOICE_LABELS[b.choice]}
                    </Badge>
                  </TD>
                  <TD className="text-right font-medium text-ink tabular">{formatShares(b.weight)}</TD>
                  <TD className="hidden lg:table-cell text-xs text-ink-3 tabular">
                    {formatDateTime(b.castAt)}
                  </TD>
                  <TD>
                    {b.supersededAt ? (
                      <Badge tone="warning">Superseded</Badge>
                    ) : (
                      <Badge tone="success">Effective</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent
          title="Request scrutineer access"
          description="Request temporary access to inspect individual ballots. Another administrator must approve it."
        >
          <RequestGrantForm
            candidates={grantsQ.data?.candidates ?? []}
            onDone={() => {
              setRequestOpen(false);
              void qc.invalidateQueries({ queryKey: grantsKey });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(decisionTarget)} onOpenChange={(o) => !o && setDecisionTarget(null)}>
        {decisionTarget && (
          <DialogContent
            title={
              decisionTarget.decision === 'REJECT'
                ? 'Reject scrutineer request?'
                : 'Revoke scrutineer access?'
            }
            description={
              decisionTarget.decision === 'REJECT'
                ? 'The request will be closed cleanly.'
                : `${decisionTarget.grant.grantee.fullName} will lose ballot inspection access immediately.`
            }
          >
            <DecisionReasonForm
              grant={decisionTarget.grant}
              decision={decisionTarget.decision}
              onDone={() => {
                setDecisionTarget(null);
                void qc.invalidateQueries({ queryKey: grantsKey });
              }}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function RequestGrantForm({
  candidates,
  onDone,
}: {
  candidates: PrivilegedGrantListDto['candidates'];
  onDone: () => void;
}) {
  const c = useCompany();
  const m = useMeeting();
  const [granteeUserId, setGranteeUserId] = React.useState(candidates[0]?.userId ?? '');
  const [durationMinutes, setDurationMinutes] = React.useState('30');
  const [reason, setReason] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const effectiveGranteeUserId = granteeUserId || candidates[0]?.userId || '';

  const submit = useMutation({
    mutationFn: () =>
      api.post<PrivilegedGrantDto>(`/companies/${c.id}/privileged-grants`, {
        meetingId: m.id,
        granteeUserId: effectiveGranteeUserId,
        durationMinutes: Number(durationMinutes) || 30,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      toast.success('Scrutineer request submitted for approval');
      onDone();
    },
    onError: (e) => {
      setErrors(e instanceof ApiError ? e.fieldErrors : {});
      setFormError(e.message);
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setErrors({});
        setFormError(null);
        submit.mutate();
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Staff member" htmlFor="granteeUserId" error={errors.granteeUserId?.[0]}>
          <Select
            id="granteeUserId"
            value={effectiveGranteeUserId}
            onChange={(e) => setGranteeUserId(e.target.value)}
          >
            {candidates.length === 0 ? (
              <option value="">No eligible staff found</option>
            ) : (
              candidates.map((cand) => (
                <option key={cand.userId} value={cand.userId}>
                  {cand.fullName} ({cand.roles.join(', ')})
                </option>
              ))
            )}
          </Select>
        </Field>
        <Field
          label="Duration (minutes)"
          htmlFor="durationMinutes"
          hint="Between 5 and 480 minutes from approval."
          error={errors.durationMinutes?.[0]}
        >
          <Input
            id="durationMinutes"
            type="number"
            min={5}
            max={480}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </Field>
        <Field
          label="Justification"
          htmlFor="grant-reason"
          hint="At least 10 characters. Recorded in the audit log."
          error={errors.reason?.[0]}
        >
          <Textarea
            id="grant-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Scrutineer verification of poll ballots for resolution 1..."
          />
        </Field>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" loading={submit.isPending} disabled={!granteeUserId}>
          Submit request
        </Button>
      </DialogFooter>
    </form>
  );
}

function DecisionReasonForm({
  grant,
  decision,
  onDone,
}: {
  grant: PrivilegedGrantDto;
  decision: 'REJECT' | 'REVOKE';
  onDone: () => void;
}) {
  const c = useCompany();
  const [note, setNote] = React.useState('');
  const [err, setErr] = React.useState<string | null>(null);

  const decide = useMutation({
    mutationFn: () =>
      api.post<PrivilegedGrantDto>(`/companies/${c.id}/privileged-grants/${grant.id}/decision`, {
        decision,
        note: note.trim(),
      }),
    onSuccess: () => {
      toast.success(decision === 'REJECT' ? 'Request rejected' : 'Access revoked immediately');
      onDone();
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        decide.mutate();
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field
          label="Reason"
          htmlFor="decision-note"
          hint="At least 3 characters. Recorded permanently in the audit log."
        >
          <Textarea
            id="decision-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          variant={decision === 'REVOKE' ? 'danger' : 'primary'}
          loading={decide.isPending}
          disabled={note.trim().length < 3}
        >
          {decision === 'REJECT' ? 'Reject request' : 'Revoke access'}
        </Button>
      </DialogFooter>
    </form>
  );
}

