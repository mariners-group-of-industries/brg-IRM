'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Lock, Megaphone, Radio, ShieldCheck, Trash2 } from 'lucide-react';
import {
  AGENDA_STAGES,
  STAGE_LABELS,
  VOTING_METHODS,
  VOTING_METHOD_LABELS,
  type AgendaStage,
  type LiveConsole,
  type MotionDto,
  type SessionIntegrityVerificationDto,
  type StaffVotingSessionDto,
  type VideoJoinInfo,
  type VoteAuditEventDto,
  type VotingMethod,
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
  Textarea,
} from '@irm/ui';
import { VideoStage } from '@/components/video-stage';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatNumber, formatShares, formatVotePct } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useMeetingEvents } from '@/lib/use-meeting-events';
import { useCompany } from '../../../company-context';
import { meetingKey, useMeeting } from '../meeting-context';

export default function MeetingLiveConsolePage() {
  const c = useCompany();
  const m = useMeeting();
  const { can } = useSession();
  const qc = useQueryClient();

  const canControl = can('meeting.control', c.scope);
  const canEditRoom = canControl || can('meeting.update', c.scope);
  const canAnnounce = can('announcement.manage', c.scope);
  const canVoteControl = can('voting.control', c.scope);
  const canReleaseResults = can('voting.results.release', c.scope);
  const canReadResults = can('voting.results.read', c.scope);

  const liveBase = `/companies/${c.id}/meetings/${m.id}/live`;
  const votingBase = `/companies/${c.id}/meetings/${m.id}/voting`;
  const consoleKey = [...meetingKey(c.id, m.id), 'live-console'] as const;
  const videoKey = [...meetingKey(c.id, m.id), 'live-video'] as const;

  const consoleQ = useQuery({
    queryKey: consoleKey,
    queryFn: () => api.get<LiveConsole>(`${liveBase}/console`),
  });

  const videoQ = useQuery({
    queryKey: videoKey,
    queryFn: () => api.get<VideoJoinInfo>(`${liveBase}/video`),
  });

  const { connected } = useMeetingEvents({
    eventsPath: `${liveBase}/events`,
    queryKeys: [consoleKey, videoKey, meetingKey(c.id, m.id)],
  });

  const [roomDialogOpen, setRoomDialogOpen] = React.useState(false);
  const [announcementText, setAnnouncementText] = React.useState('');
  const [openVoteTarget, setOpenVoteTarget] = React.useState<{
    agendaItemId: string;
    agendaNumber: string;
    agendaTitle: string;
    priorCount: number;
  } | null>(null);
  const [auditSessionId, setAuditSessionId] = React.useState<string | null>(null);
  const [verifiedBySession, setVerifiedBySession] = React.useState<
    Record<string, SessionIntegrityVerificationDto>
  >({});

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: consoleKey });
    void qc.invalidateQueries({ queryKey: videoKey });
  };

  const closeVoting = useMutation({
    mutationFn: (sessionId: string) =>
      api.post<StaffVotingSessionDto>(`${votingBase}/sessions/${sessionId}/close`),
    onSuccess: () => {
      refresh();
      toast.success('Voting closed and tally sealed');
    },
    onError: (e) => toast.error(e.message),
  });

  const releaseResults = useMutation({
    mutationFn: (sessionId: string) =>
      api.post<StaffVotingSessionDto>(`${votingBase}/sessions/${sessionId}/release`),
    onSuccess: () => {
      refresh();
      toast.success('Voting results released');
    },
    onError: (e) => toast.error(e.message),
  });

  const verifyIntegrity = useMutation({
    mutationFn: (sessionId: string) =>
      api.get<SessionIntegrityVerificationDto>(`${votingBase}/sessions/${sessionId}/verify`),
    onSuccess: (res) => {
      setVerifiedBySession((cur) => ({ ...cur, [res.votingSessionId]: res }));
      if (res.auditChainValid && res.tallyValid && res.inputHashValid) {
        toast.success(`Integrity verified (${res.auditEventCount} audit events)`);
      } else {
        toast.error(res.error ?? 'Integrity check failed');
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: (agendaItemId: string | null) => api.post(`${liveBase}/active-item`, { agendaItemId }),
    onSuccess: () => {
      refresh();
      toast.success('Active agenda item updated');
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleStage = useMutation({
    mutationFn: (vars: { agendaItemId: string; stage: AgendaStage; open: boolean }) =>
      api.post(`${liveBase}/stage`, vars),
    onSuccess: () => refresh(),
    onError: (e) => toast.error(e.message),
  });

  const acceptMotion = useMutation({
    mutationFn: (motionId: string) => api.post<MotionDto>(`${liveBase}/motions/${motionId}/accept`),
    onSuccess: () => {
      refresh();
      toast.success('Motion accepted');
    },
    onError: (e) => toast.error(e.message),
  });

  const publishAnnouncement = useMutation({
    mutationFn: (body: string) => api.post(`${liveBase}/announcements`, { body }),
    onSuccess: () => {
      setAnnouncementText('');
      refresh();
      toast.success('Announcement published');
    },
    onError: (e) => toast.error(e.message),
  });

  const retractAnnouncement = useMutation({
    mutationFn: (announcementId: string) => api.delete(`${liveBase}/announcements/${announcementId}`),
    onSuccess: () => {
      refresh();
      toast.success('Announcement withdrawn');
    },
    onError: (e) => toast.error(e.message),
  });

  if (consoleQ.isError) return <Alert tone="danger">{consoleQ.error.message}</Alert>;
  if (consoleQ.isPending) return <Skeleton className="h-72" />;

  const d = consoleQ.data;
  const isLive = d.state === 'LIVE';
  const isLiveOrPaused = d.state === 'LIVE' || d.state === 'PAUSED';
  const activeItem = d.agenda.find((a) => a.id === d.activeAgendaItemId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <dl className="grid grid-cols-2 divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="px-5 py-4">
            <dt className="text-xs text-ink-3">Shareholders online</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
              {formatNumber(d.attendance.participantsPresent)}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3 tabular">
              of {formatNumber(d.attendance.registered)} registered
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-xs text-ink-3">Votes represented</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
              {formatShares(d.attendance.votesPresent)}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3 tabular">
              of {formatShares(d.attendance.totalVotes)} total
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-xs text-ink-3">Staff & board online</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
              {formatNumber(d.attendance.staffPresent)}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3">Connected consoles</dd>
          </div>
          <div className="px-5 py-4">
            <dt className="text-xs text-ink-3">Questions</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
              {formatNumber(d.questions.PENDING)}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3 tabular">
              pending · {formatNumber(d.questions.FORWARDED)} with board
            </dd>
          </div>
        </dl>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <VideoStage
            video={videoQ.data}
            loading={videoQ.isPending}
            meetingTitle={m.title}
            meetingState={d.state}
            activeItem={activeItem ? { number: activeItem.number, title: activeItem.title } : null}
            connected={connected}
            actions={
              canEditRoom && d.state !== 'COMPLETED' && d.state !== 'ARCHIVED' ? (
                <Button variant="secondary" size="sm" onClick={() => setRoomDialogOpen(true)}>
                  {d.videoRoomId ? `Zoom ID: ${d.videoRoomId}` : 'Set Zoom ID'}
                </Button>
              ) : undefined
            }
          />

          <Panel>
            <PanelHeader
              title="Agenda & stage controls"
              description={
                isLive
                  ? 'Select the active item and open proposal, seconding or poll demand windows.'
                  : 'Start the meeting from the Control tab to open live stages.'
              }
            />
            {d.agenda.length === 0 ? (
              <EmptyState title="No agenda items" description="Add agenda items before running the meeting." />
            ) : (
              <ol className="divide-y divide-line">
                {d.agenda.map((a) => {
                  const isActive = d.activeAgendaItemId === a.id;
                  const pendingMotions = a.motions.filter((mt) => mt.status === 'SUBMITTED');
                  return (
                    <li key={a.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">
                              {a.number}
                            </span>
                            <p className="font-medium text-ink">{a.title}</p>
                            {isActive && (
                              <Badge tone="accent" dot>
                                <Radio className="size-3" aria-hidden /> Active item
                              </Badge>
                            )}
                            {a.resolution && (
                              <Badge tone={a.resolution.kind === 'SPECIAL' ? 'warning' : 'neutral'}>
                                {a.resolution.kind === 'SPECIAL' ? 'Special resolution' : 'Ordinary resolution'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {canControl && (
                          <Button
                            variant={isActive ? 'secondary' : 'primary'}
                            size="sm"
                            disabled={!isLive || setActive.isPending}
                            aria-label={isActive ? `Clear active item ${a.number}` : `Set active item ${a.number}`}
                            onClick={() => setActive.mutate(isActive ? null : a.id)}
                          >
                            {isActive ? 'Clear active' : 'Set active'}
                          </Button>
                        )}
                      </div>

                      {!a.resolution ? (
                        <p className="mt-2 text-xs text-ink-3">Procedural item — no motion or poll demand stages.</p>
                      ) : (
                        <>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {AGENDA_STAGES.map((stage) => {
                              const open = a.stages[stage];
                              const stageSupported =
                                stage === 'PROPOSAL'
                                  ? a.resolution!.requiresProposal
                                  : stage === 'SECONDING'
                                    ? a.resolution!.requiresSeconding
                                    : d.rules.pollDemand.enabled;
                              const label = `${STAGE_LABELS[stage]}: ${open ? 'open' : 'closed'}`;
                              return (
                                <Button
                                  key={stage}
                                  type="button"
                                  size="sm"
                                  variant={open ? 'primary' : 'secondary'}
                                  aria-pressed={open}
                                  aria-label={`${label} (item ${a.number})`}
                                  disabled={!canControl || !isLive || (!open && !stageSupported) || toggleStage.isPending}
                                  onClick={() =>
                                    toggleStage.mutate({ agendaItemId: a.id, stage, open: !open })
                                  }
                                >
                                  {label}
                                </Button>
                              );
                            })}
                          </div>

                          <dl className="mt-3 grid gap-2 text-xs text-ink-2 sm:grid-cols-3">
                            <div>
                              <dt className="text-ink-3">Proposer</dt>
                              <dd className="mt-0.5 font-medium text-ink">
                                {a.accepted.PROPOSAL ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                                    {a.accepted.PROPOSAL.shareholderName}
                                  </span>
                                ) : a.resolution.requiresProposal ? (
                                  <span className="text-ink-3">Awaiting proposal</span>
                                ) : (
                                  <span className="text-ink-3">Not required</span>
                                )}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-ink-3">Seconder</dt>
                              <dd className="mt-0.5 font-medium text-ink">
                                {a.accepted.SECONDING ? (
                                  <span className="inline-flex items-center gap-1">
                                    <CheckCircle2 className="size-3.5 text-success" aria-hidden />
                                    {a.accepted.SECONDING.shareholderName}
                                  </span>
                                ) : a.resolution.requiresSeconding ? (
                                  <span className="text-ink-3">Awaiting seconder</span>
                                ) : (
                                  <span className="text-ink-3">Not required</span>
                                )}
                              </dd>
                            </div>

                            <div>
                              <dt className="text-ink-3">Poll demands</dt>
                              <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-medium text-ink tabular">
                                  {formatNumber(a.pollDemands.count)} ({formatShares(a.pollDemands.votes)} votes)
                                </span>
                                {d.rules.pollDemand.enabled && (
                                  <Badge tone={a.pollDemands.thresholdMet ? 'warning' : 'neutral'}>
                                    {a.pollDemands.thresholdMet ? 'Threshold met' : 'Below threshold'}
                                  </Badge>
                                )}
                              </dd>
                            </div>
                          </dl>

                          {pendingMotions.length > 0 && (
                            <div className="mt-3 border-t border-line pt-3">
                              <p className="text-xs font-medium text-ink-3">Submitted motions awaiting chair selection</p>
                              <ul className="mt-1.5 flex flex-col gap-1.5">
                                {pendingMotions.map((mt) => (
                                  <li key={mt.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="text-ink">
                                      <Badge tone="neutral" className="mr-1.5">
                                        {mt.kind === 'PROPOSAL' ? 'Proposal' : 'Seconding'}
                                      </Badge>
                                      {mt.shareholderName}
                                    </span>
                                    {canControl && !a.accepted[mt.kind] && (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        disabled={acceptMotion.isPending}
                                        aria-label={`Accept ${mt.kind.toLowerCase()} from ${mt.shareholderName}`}
                                        onClick={() => acceptMotion.mutate(mt.id)}
                                      >
                                        Accept
                                      </Button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {(() => {
                            const itemSessions = d.votingSessions.filter((s) => s.agendaItemId === a.id);
                            const latest = itemSessions[itemSessions.length - 1] ?? null;
                            const openSession = itemSessions.find((s) => !s.closedAt) ?? null;
                            const verification = latest ? verifiedBySession[latest.id] : undefined;
                            return (
                              <div className="mt-3 border-t border-line pt-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-medium text-ink">Voting</span>
                                    {!latest ? (
                                      <Badge tone="neutral">Not opened</Badge>
                                    ) : !latest.closedAt ? (
                                      <Badge tone="accent" dot>
                                        Open · Session {latest.sessionNumber}
                                      </Badge>
                                    ) : latest.releasedAt ? (
                                      <Badge tone="success" dot>
                                        Released · Session {latest.sessionNumber}
                                      </Badge>
                                    ) : (
                                      <Badge tone="neutral" dot>
                                        Closed · sealed · Session {latest.sessionNumber}
                                      </Badge>
                                    )}
                                    {latest && (
                                      <span className="text-ink-3">
                                        {VOTING_METHOD_LABELS[latest.method]} ·{' '}
                                        <span className="tabular">
                                          {formatNumber(latest.ballotsCast)} ballots · {formatShares(latest.votesCast)} votes
                                        </span>
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {canVoteControl && !openSession && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant={isLive ? 'primary' : 'secondary'}
                                        disabled={!isLive}
                                        aria-label={
                                          itemSessions.length > 0
                                            ? `Reopen voting for item ${a.number}`
                                            : `Open voting for item ${a.number}`
                                        }
                                        onClick={() =>
                                          setOpenVoteTarget({
                                            agendaItemId: a.id,
                                            agendaNumber: a.number,
                                            agendaTitle: a.title,
                                            priorCount: itemSessions.length,
                                          })
                                        }
                                      >
                                        {itemSessions.length > 0 ? 'Reopen voting' : 'Open voting'}
                                      </Button>
                                    )}
                                    {canVoteControl && openSession && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        loading={
                                          closeVoting.isPending && closeVoting.variables === openSession.id
                                        }
                                        disabled={!isLiveOrPaused || closeVoting.isPending}
                                        aria-label={`Close voting for item ${a.number}`}
                                        onClick={() => closeVoting.mutate(openSession.id)}
                                      >
                                        Close &amp; seal tally
                                      </Button>
                                    )}
                                    {canReleaseResults && latest?.closedAt && !latest.releasedAt && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        loading={
                                          releaseResults.isPending && releaseResults.variables === latest.id
                                        }
                                        disabled={releaseResults.isPending}
                                        aria-label={`Release results for item ${a.number}`}
                                        onClick={() => releaseResults.mutate(latest.id)}
                                      >
                                        Release results
                                      </Button>
                                    )}
                                    {canReadResults && latest && (
                                      <>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          loading={
                                            verifyIntegrity.isPending && verifyIntegrity.variables === latest.id
                                          }
                                          aria-label={`Verify integrity for item ${a.number}`}
                                          onClick={() => verifyIntegrity.mutate(latest.id)}
                                        >
                                          <ShieldCheck aria-hidden /> Verify integrity
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          aria-label={`View vote audit for item ${a.number}`}
                                          onClick={() => setAuditSessionId(latest.id)}
                                        >
                                          Vote audit
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {latest && latest.closedAt && !latest.result && (
                                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-3">
                                    <Lock className="size-3.5 shrink-0" aria-hidden />
                                    {canReadResults
                                      ? 'Tally sealed. Results stay hidden under meeting rules until released by the meeting admin.'
                                      : 'Tally sealed.'}
                                  </p>
                                )}

                                {latest?.result && (
                                  <div className="mt-2.5 rounded-md bg-subtle/70 px-3 py-2.5 text-xs">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge tone={latest.result.passed ? 'success' : 'warning'}>
                                          {latest.result.passed ? 'Carried' : 'Not carried'}
                                        </Badge>
                                        <span className="text-ink-3">
                                          {latest.result.resolutionKind === 'SPECIAL' ? 'Special' : 'Ordinary'} (
                                          {latest.result.majorityNumerator}/{latest.result.majorityDenominator})
                                        </span>
                                      </div>
                                      {latest.result.inputHash && (
                                        <span
                                          className="font-mono text-ink-3"
                                          title={latest.result.inputHash}
                                        >
                                          Seal {latest.result.inputHash.slice(0, 12)}…
                                        </span>
                                      )}
                                    </div>
                                    <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                                      <div>
                                        <dt className="text-ink-3">For</dt>
                                        <dd className="font-medium text-ink tabular">
                                          {formatShares(latest.result.forVotes)} (
                                          {formatVotePct(latest.result.forVotes, latest.result.baseVotes)})
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-ink-3">Against</dt>
                                        <dd className="font-medium text-ink tabular">
                                          {formatShares(latest.result.againstVotes)} (
                                          {formatVotePct(latest.result.againstVotes, latest.result.baseVotes)})
                                        </dd>
                                      </div>
                                      <div>
                                        <dt className="text-ink-3">Abstain</dt>
                                        <dd className="font-medium text-ink tabular">
                                          {formatShares(latest.result.abstainVotes)} (
                                          {formatNumber(latest.result.abstainCount ?? 0)} ballots)
                                        </dd>
                                      </div>
                                    </dl>
                                    <p className="mt-1.5 text-ink-3 tabular">
                                      Voting base {formatShares(latest.result.baseVotes)} · Eligible{' '}
                                      {formatShares(latest.result.eligibleVotes)}
                                    </p>
                                  </div>
                                )}

                                {verification && (
                                  <p
                                    className={`mt-2 text-xs ${
                                      verification.auditChainValid &&
                                      verification.tallyValid &&
                                      verification.inputHashValid
                                        ? 'text-success'
                                        : 'text-danger'
                                    }`}
                                  >
                                    {verification.auditChainValid &&
                                    verification.tallyValid &&
                                    verification.inputHashValid
                                      ? `Integrity verified: ${verification.auditEventCount} chained audit events, sealed tally and input hash match.`
                                      : verification.error ?? 'Integrity verification failed'}
                                  </p>
                                )}

                                {itemSessions.length > 1 && (
                                  <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs text-ink-3">
                                    {itemSessions.slice(0, -1).map((prev) => (
                                      <li key={prev.id} className="tabular">
                                        Session {prev.sessionNumber} (closed{' '}
                                        {formatDateTime(prev.closedAt)}):{' '}
                                        {prev.result
                                          ? `${prev.result.passed ? 'Carried' : 'Not carried'} · For ${formatShares(prev.result.forVotes)} / Against ${formatShares(prev.result.againstVotes)}`
                                          : 'Tally sealed'}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader
              title="Announcements"
              description="Shown immediately in the shareholder and board rooms."
            />
            {canAnnounce && d.state !== 'COMPLETED' && d.state !== 'ARCHIVED' && (
              <form
                className="border-b border-line px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (announcementText.trim().length >= 3) {
                    publishAnnouncement.mutate(announcementText.trim());
                  }
                }}
              >
                <Field label="Message to participants" htmlFor="announcement-body" hint="Plain text, up to 1,000 characters">
                  <Textarea
                    id="announcement-body"
                    rows={3}
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Registration desk closes in 5 minutes..."
                  />
                </Field>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    loading={publishAnnouncement.isPending}
                    disabled={announcementText.trim().length < 3}
                  >
                    <Megaphone aria-hidden /> Publish announcement
                  </Button>
                </div>
              </form>
            )}

            {d.announcements.length === 0 ? (
              <EmptyState title="No announcements" description="Published messages appear here for all participants." />
            ) : (
              <ul className="divide-y divide-line">
                {d.announcements.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3.5 text-sm">
                    <div className="min-w-0">
                      <p className="whitespace-pre-line text-ink">{a.body}</p>
                      <p className="mt-1 text-xs text-ink-3 tabular">
                        {formatDateTime(a.createdAt)}
                        {a.author ? ` · ${a.author}` : ''}
                      </p>
                    </div>
                    {canAnnounce && d.state !== 'COMPLETED' && d.state !== 'ARCHIVED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={retractAnnouncement.isPending}
                        aria-label={`Withdraw announcement from ${formatDateTime(a.createdAt)}`}
                        onClick={() => retractAnnouncement.mutate(a.id)}
                      >
                        <Trash2 aria-hidden /> Withdraw
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent
          title="Configure Zoom meeting ID"
          description="Used by the Zoom Meeting SDK adapter when Zoom credentials are configured on the server."
        >
          <VideoRoomForm
            liveBase={liveBase}
            initialValue={d.videoRoomId ?? ''}
            onDone={() => {
              setRoomDialogOpen(false);
              refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(openVoteTarget)} onOpenChange={(o) => !o && setOpenVoteTarget(null)}>
        {openVoteTarget && (
          <DialogContent
            title={
              openVoteTarget.priorCount > 0
                ? `Reopen voting for item ${openVoteTarget.agendaNumber}?`
                : `Open voting for item ${openVoteTarget.agendaNumber}?`
            }
            description={openVoteTarget.agendaTitle}
          >
            <OpenVotingForm
              votingBase={votingBase}
              agendaItemId={openVoteTarget.agendaItemId}
              defaultMethod={d.rules.votingMethod}
              requiresReason={openVoteTarget.priorCount > 0}
              onDone={() => {
                setOpenVoteTarget(null);
                refresh();
              }}
            />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={Boolean(auditSessionId)} onOpenChange={(o) => !o && setAuditSessionId(null)}>
        {auditSessionId && (
          <DialogContent
            title="Vote audit chain"
            description="Hash-chained session lifecycle and anonymized ballot events (no ballot choices stored)."
          >
            <VoteAuditDialogBody votingBase={votingBase} sessionId={auditSessionId} />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function OpenVotingForm({
  votingBase,
  agendaItemId,
  defaultMethod,
  requiresReason,
  onDone,
}: {
  votingBase: string;
  agendaItemId: string;
  defaultMethod: VotingMethod;
  requiresReason: boolean;
  onDone: () => void;
}) {
  const [method, setMethod] = React.useState<VotingMethod>(defaultMethod);
  const [durationSeconds, setDurationSeconds] = React.useState('');
  const [reopenReason, setReopenReason] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  const open = useMutation({
    mutationFn: () =>
      api.post<StaffVotingSessionDto>(`${votingBase}/sessions/open`, {
        agendaItemId,
        method,
        ...(durationSeconds.trim() ? { durationSeconds: Number(durationSeconds) } : {}),
        ...(requiresReason ? { reopenReason: reopenReason.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success('Voting session opened');
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
        open.mutate();
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <Field label="Voting method" htmlFor="open-vote-method">
          <Select
            id="open-vote-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as VotingMethod)}
          >
            {VOTING_METHODS.map((vm) => (
              <option key={vm} value={vm}>
                {VOTING_METHOD_LABELS[vm]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Auto-close after (seconds)"
          htmlFor="open-vote-duration"
          optional
          hint="Leave blank to keep open until manually closed by the meeting admin (min 10 seconds if set)."
          error={errors.durationSeconds?.[0]}
        >
          <Input
            id="open-vote-duration"
            type="number"
            min={10}
            max={86400}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            placeholder="Manual close"
          />
        </Field>
        {requiresReason && (
          <Field
            label="Reason for opening a new voting session"
            htmlFor="open-vote-reason"
            hint="Closing is final; provide at least 5 characters explaining why a new session is required."
            error={errors.reopenReason?.[0]}
          >
            <Textarea
              id="open-vote-reason"
              rows={2}
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
            />
          </Field>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button
          type="submit"
          loading={open.isPending}
          disabled={requiresReason && reopenReason.trim().length < 5}
        >
          Open voting session
        </Button>
      </DialogFooter>
    </form>
  );
}

function VoteAuditDialogBody({ votingBase, sessionId }: { votingBase: string; sessionId: string }) {
  const q = useQuery({
    queryKey: ['vote-audit', votingBase, sessionId],
    queryFn: () => api.get<VoteAuditEventDto[]>(`${votingBase}/sessions/${sessionId}/audit`),
  });

  if (q.isPending) {
    return (
      <div className="p-5">
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="p-5">
        <Alert tone="danger">{q.error.message}</Alert>
      </div>
    );
  }

  return (
    <>
      <div className="max-h-80 overflow-y-auto px-5 py-4">
        <ol className="divide-y divide-line text-xs">
          {q.data.map((ev) => (
            <li key={ev.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink tabular">
                  #{ev.sequenceNo} · {ev.eventType}
                </span>
                <span className="text-ink-3 tabular">{formatDateTime(ev.occurredAt)}</span>
              </div>
              {ev.actorName && <p className="mt-0.5 text-ink-2">Actor: {ev.actorName}</p>}
              {ev.reason && <p className="mt-0.5 text-ink-3">{ev.reason}</p>}
              <p className="mt-0.5 truncate font-mono text-[11px] text-ink-3" title={ev.hash}>
                Hash: {ev.hash}
              </p>
            </li>
          ))}
        </ol>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Close
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

function VideoRoomForm({
  liveBase,
  initialValue,
  onDone,
}: {
  liveBase: string;
  initialValue: string;
  onDone: () => void;
}) {
  const [val, setVal] = React.useState(initialValue);
  const [err, setErr] = React.useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.put(`${liveBase}/video-room`, { videoRoomId: val.trim() || null }),
    onSuccess: () => {
      toast.success('Video room updated');
      onDone();
    },
    onError: (e) => setErr(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex flex-col gap-4 px-5 py-5">
        {err && <Alert tone="danger">{err}</Alert>}
        <Field label="Zoom meeting number" htmlFor="zoom-room-id" optional hint="Leave blank to clear the room ID.">
          <Input
            id="zoom-room-id"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 81234567890"
            maxLength={40}
          />
        </Field>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" loading={save.isPending}>
          Save Zoom ID
        </Button>
      </DialogFooter>
    </form>
  );
}

