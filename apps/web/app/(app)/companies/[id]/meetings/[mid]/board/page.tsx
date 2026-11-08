'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, MessageSquare, Radio } from 'lucide-react';
import type { BoardRoom, VideoJoinInfo } from '@irm/shared';
import { Alert, Badge, EmptyState, Panel, PanelHeader, Skeleton } from '@irm/ui';
import { VideoStage } from '@/components/video-stage';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber, formatShares, formatVotePct } from '@/lib/format';
import { useMeetingEvents } from '@/lib/use-meeting-events';
import { useCompany } from '../../../company-context';
import { meetingKey, useMeeting } from '../meeting-context';

export default function MeetingBoardRoomPage() {
  const c = useCompany();
  const m = useMeeting();
  const liveBase = `/companies/${c.id}/meetings/${m.id}/live`;
  const boardKey = [...meetingKey(c.id, m.id), 'board-room'] as const;
  const videoKey = [...meetingKey(c.id, m.id), 'board-video'] as const;

  const boardQ = useQuery({
    queryKey: boardKey,
    queryFn: () => api.get<BoardRoom>(`${liveBase}/board`),
  });

  const videoQ = useQuery({
    queryKey: videoKey,
    queryFn: () => api.get<VideoJoinInfo>(`${liveBase}/video`),
  });

  const { connected } = useMeetingEvents({
    eventsPath: `${liveBase}/events`,
    queryKeys: [boardKey, videoKey, meetingKey(c.id, m.id)],
  });

  if (boardQ.isError) return <Alert tone="danger">{boardQ.error.message}</Alert>;
  if (boardQ.isPending) return <Skeleton className="h-72" />;

  const d = boardQ.data;
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
            <dt className="text-xs text-ink-3">Forwarded questions</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-ink tabular">
              {formatNumber(d.forwardedQuestions.length)}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-3">Ready for the chair & board</dd>
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
          />

          <Panel>
            <PanelHeader
              title="Questions forwarded to the board"
              description="Approved by moderators for response during the meeting."
            />
            {d.forwardedQuestions.length === 0 ? (
              <EmptyState
                icon={<MessageSquare aria-hidden />}
                title="No forwarded questions yet"
                description="Questions forwarded by the moderator appear here immediately."
              />
            ) : (
              <ul className="divide-y divide-line">
                {d.forwardedQuestions.map((q) => {
                  const who = q.submitter
                    ? q.submitter.actingAs === 'SHAREHOLDER'
                      ? q.submitter.shareholderName
                      : `${q.submitter.name} (for ${q.submitter.shareholderName})`
                    : 'Shareholder';
                  return (
                    <li key={q.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-ink">{who}</span>
                        <span className="text-xs text-ink-3 tabular">· {formatDateTime(q.createdAt)}</span>
                        {q.agendaItem && (
                          <Badge tone="neutral">
                            Item {q.agendaItem.number}: {q.agendaItem.title}
                          </Badge>
                        )}
                        {q.bangla && <Badge tone="info">Bangla</Badge>}
                        {q.kind === 'AUDIO' && (
                          <Badge tone="accent">Audio · {q.durationSeconds ?? 0}s</Badge>
                        )}
                      </div>

                      {q.kind === 'TEXT' ? (
                        <p
                          lang={q.bangla ? 'bn' : undefined}
                          className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink"
                        >
                          {q.text}
                        </p>
                      ) : (
                        <div className="mt-2">
                          <audio
                            controls
                            preload="metadata"
                            src={`/api/v1${liveBase}/questions/${q.id}/audio`}
                            aria-label={`Forwarded audio question from ${who}`}
                            className="h-10 w-full max-w-md"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Resolution voting results"
              description="Official results appear once released by the meeting admin."
            />
            {d.agenda.filter((a) => a.resolution).length === 0 ? (
              <EmptyState title="No resolutions on this agenda" />
            ) : (
              <ol className="divide-y divide-line">
                {d.agenda
                  .filter((a) => a.resolution)
                  .map((a) => {
                    const itemSessions = d.votingSessions.filter((s) => s.agendaItemId === a.id);
                    const latest = itemSessions[itemSessions.length - 1] ?? null;
                    return (
                      <li key={a.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">
                              {a.number}
                            </span>
                            <span className="font-medium text-ink">{a.title}</span>
                          </div>
                          {!latest ? (
                            <Badge tone="neutral">Voting not opened</Badge>
                          ) : !latest.closedAt ? (
                            <Badge tone="accent" dot>
                              Voting open
                            </Badge>
                          ) : latest.result ? (
                            <Badge tone={latest.result.passed ? 'success' : 'warning'}>
                              {latest.result.passed ? 'Carried' : 'Not carried'}
                            </Badge>
                          ) : (
                            <Badge tone="warning">Waiting for release</Badge>
                          )}
                        </div>

                        {latest?.result ? (
                          <dl className="mt-3 grid gap-2 pl-8 text-xs sm:grid-cols-3">
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
                                {formatShares(latest.result.abstainVotes)}
                              </dd>
                            </div>
                          </dl>
                        ) : latest && !latest.closedAt ? (
                          <p className="mt-2 pl-8 text-xs text-ink-3 tabular">
                            {formatNumber(latest.ballotsCast)} ballots recorded so far
                          </p>
                        ) : latest?.closedAt ? (
                          <p className="mt-2 pl-8 text-xs text-ink-3">
                            Tally sealed. Results become visible to board members after release.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel>
            <PanelHeader title="Agenda & motions" description="Current item and accepted proposers & seconders." />
            <ol className="divide-y divide-line">
              {d.agenda.map((a) => {
                const isActive = d.activeAgendaItemId === a.id;
                return (
                  <li key={a.id} className="px-5 py-3.5 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">
                        {a.number}
                      </span>
                      <span className="font-medium text-ink">{a.title}</span>
                      {isActive && (
                        <Badge tone="accent" dot>
                          <Radio className="size-3" aria-hidden /> Active
                        </Badge>
                      )}
                    </div>
                    {a.resolution && (
                      <div className="mt-2 flex flex-col gap-1 pl-8 text-xs text-ink-3">
                        <span>
                          Proposer:{' '}
                          {a.accepted.PROPOSAL ? (
                            <span className="inline-flex items-center gap-1 font-medium text-ink">
                              <CheckCircle2 className="size-3 text-success" aria-hidden />
                              {a.accepted.PROPOSAL.shareholderName}
                            </span>
                          ) : (
                            '—'
                          )}
                        </span>
                        <span>
                          Seconder:{' '}
                          {a.accepted.SECONDING ? (
                            <span className="inline-flex items-center gap-1 font-medium text-ink">
                              <CheckCircle2 className="size-3 text-success" aria-hidden />
                              {a.accepted.SECONDING.shareholderName}
                            </span>
                          ) : (
                            '—'
                          )}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </Panel>

          {d.announcements.length > 0 && (
            <Panel>
              <PanelHeader title="Announcements" />
              <ul className="divide-y divide-line">
                {d.announcements.map((a) => (
                  <li key={a.id} className="px-5 py-3.5 text-sm">
                    <p className="whitespace-pre-line text-ink">{a.body}</p>
                    <p className="mt-1 text-xs text-ink-3 tabular">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

