'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ChevronLeft, LogOut, Mic, Radio, Square } from 'lucide-react';
import {
  BALLOT_CHOICE_LABELS,
  VOTING_METHOD_LABELS,
  type BallotChoice,
  type CastVoteResult,
  type MeetingEvent,
  type MeetingRoom,
  type MotionDto,
  type MotionKind,
  type ParticipantVotingSessionDto,
  type QuestionDto,
  type QuestionStatus,
  type RoomRegistration,
  type VideoJoinInfo,
} from '@irm/shared';
import { Alert, Badge, Button, Field, Panel, PanelHeader, Select, Skeleton, Textarea, cn } from '@irm/ui';
import { BrandMark } from '@/components/brand';
import { MeetingStateBadge } from '@/components/status';
import { VideoStage } from '@/components/video-stage';
import { api } from '@/lib/api';
import { formatDateTime, formatShares, formatVotePct } from '@/lib/format';
import { useMe } from '@/lib/session';
import { useMeetingEvents } from '@/lib/use-meeting-events';

const QUESTION_STATUS_SHAREHOLDER: Record<QuestionStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' }> = {
  PENDING: { label: 'Received', tone: 'neutral' },
  APPROVED: { label: 'Reviewed', tone: 'info' },
  FORWARDED: { label: 'With the board', tone: 'success' },
  REJECTED: { label: 'Closed', tone: 'warning' },
};

export default function ShareholderMeetingRoomPage() {
  useMe();
  const { mid } = useParams<{ mid: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const liveBase = `/participant/meetings/${mid}/live`;
  const roomKey = ['portal-meeting-room', mid] as const;
  const videoKey = ['portal-meeting-video', mid] as const;

  const roomQ = useQuery({
    queryKey: roomKey,
    queryFn: () => api.get<MeetingRoom>(`${liveBase}/room`),
    retry: false,
  });

  const videoQ = useQuery({
    queryKey: videoKey,
    queryFn: () => api.get<VideoJoinInfo>(`${liveBase}/video`),
    enabled: roomQ.isSuccess,
  });

  const [politeStatus, setPoliteStatus] = React.useState('');

  const handleEvent = React.useCallback((ev: MeetingEvent) => {
    if (ev.type === 'announcement') {
      setPoliteStatus('New announcement from the chair.');
    } else if (ev.type === 'agenda.active') {
      setPoliteStatus('Active agenda item updated.');
    } else if (ev.type === 'agenda.stage') {
      setPoliteStatus('Agenda stage updated.');
    } else if (ev.type === 'voting.session') {
      setPoliteStatus('Voting status updated.');
    } else if (ev.type === 'results.released') {
      setPoliteStatus('Official voting results have been released.');
    }
  }, []);

  const { connected } = useMeetingEvents({
    eventsPath: roomQ.isSuccess ? `${liveBase}/events` : null,
    queryKeys: [roomKey, videoKey],
    heartbeatPath: roomQ.isSuccess ? `${liveBase}/attendance/heartbeat` : null,
    onEvent: handleEvent,
  });

  const [selectedParticipantId, setSelectedParticipantId] = React.useState<string>('');
  const activeReg =
    roomQ.data?.registrations.find((r) => r.participantId === selectedParticipantId) ??
    roomQ.data?.registrations[0];
  const effectiveParticipantId = activeReg?.participantId;

  const leaveRoom = async () => {
    try {
      await api.post(`${liveBase}/attendance/leave`);
    } catch {
      // Leaving is best-effort; SSE close also marks attendance ended.
    }
    router.push(`/portal/meetings/${mid}`);
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: roomKey });
  };

  const submitMotion = useMutation({
    mutationFn: (vars: { agendaItemId: string; kind: MotionKind }) =>
      api.post<MotionDto>(`${liveBase}/motion`, {
        agendaItemId: vars.agendaItemId,
        kind: vars.kind,
        participantId: effectiveParticipantId,
      }),
    onSuccess: (res) => {
      refresh();
      toast.success(
        res.status === 'ACCEPTED'
          ? res.kind === 'PROPOSAL'
            ? 'Your proposal has been recorded'
            : 'Your seconding has been recorded'
          : 'Your motion has been submitted',
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const submitPollDemand = useMutation({
    mutationFn: (agendaItemId: string) =>
      api.post(`${liveBase}/poll-demand`, {
        agendaItemId,
        participantId: effectiveParticipantId,
      }),
    onSuccess: () => {
      refresh();
      toast.success('Your poll demand has been recorded');
    },
    onError: (e) => toast.error(e.message),
  });

  if (roomQ.isPending) {
    return (
      <div className="min-h-dvh bg-canvas text-base">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <BrandMark />
            <p className="font-semibold text-ink">Meeting room</p>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-80" />
        </main>
      </div>
    );
  }

  if (roomQ.isError) {
    return (
      <div className="min-h-dvh bg-canvas text-base">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
            <BrandMark />
            <p className="font-semibold text-ink">Shareholder portal</p>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-3xl px-4 py-8">
          <Alert tone="danger" title="Could not enter the meeting room">
            {roomQ.error.message}
          </Alert>
          <div className="mt-5">
            <Button asChild size="lg" variant="secondary">
              <Link href={`/portal/meetings/${mid}`}>
                <ChevronLeft aria-hidden /> Back to meeting details
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const room = roomQ.data;
  const activeItem = room.agenda.find((a) => a.id === room.activeAgendaItemId) ?? null;
  const isLive = room.state === 'LIVE';

  return (
    <div className="min-h-dvh bg-canvas text-base">
      <div role="status" aria-live="polite" className="sr-only">
        {politeStatus}
      </div>

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{room.companyName}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm text-ink-3">{room.title}</span>
                <MeetingStateBadge state={room.state} />
              </div>
            </div>
          </div>

          <Button variant="secondary" size="lg" onClick={leaveRoom}>
            <LogOut aria-hidden /> Leave room
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6">
        {room.registrations.length > 1 ? (
          <Panel className="mb-6">
            <div className="px-5 py-4">
              <Field
                label="Acting as"
                htmlFor="capacity-select"
                hint="Choose which registered shareholding or representation you are acting for."
              >
                <Select
                  id="capacity-select"
                  className="max-w-lg"
                  value={activeReg?.participantId ?? ''}
                  onChange={(e) => setSelectedParticipantId(e.target.value)}
                >
                  {room.registrations.map((r) => (
                    <option key={r.participantId} value={r.participantId}>
                      {r.shareholderName} — {r.label} ({formatShares(r.votes)} votes)
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Panel>
        ) : activeReg ? (
          <p className="mb-5 text-base text-ink-2">
            Participating for <span className="font-semibold text-ink">{activeReg.shareholderName}</span> ·{' '}
            <span className="tabular">{formatShares(activeReg.votes)}</span> votes
          </p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <VideoStage
              shareholderFacing
              video={videoQ.data}
              loading={videoQ.isPending}
              meetingTitle={room.title}
              meetingState={room.state}
              activeItem={activeItem ? { number: activeItem.number, title: activeItem.title } : null}
              connected={connected}
            />

            {room.announcements.length > 0 && (
              <Panel>
                <PanelHeader title="Announcements" />
                <ul className="divide-y divide-line">
                  {room.announcements.map((a) => (
                    <li key={a.id} className="px-5 py-4">
                      <p className="text-base leading-relaxed whitespace-pre-line text-ink">{a.body}</p>
                      <p className="mt-1 text-sm text-ink-3 tabular">{formatDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel>
              <PanelHeader title="Agenda" />
              <ol className="divide-y divide-line">
                {room.agenda.map((a) => {
                  const current = room.activeAgendaItemId === a.id;
                  return (
                    <li key={a.id} className="flex gap-4 px-5 py-4">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-subtle text-base font-semibold text-ink-2">
                        {a.number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-medium text-ink">{a.title}</p>
                          {current && (
                            <Badge tone="accent" dot>
                              <Radio className="size-3" aria-hidden /> Current item
                            </Badge>
                          )}
                        </div>
                        {a.resolution && (
                          <>
                            <Badge
                              tone={a.resolution.kind === 'SPECIAL' ? 'warning' : 'neutral'}
                              className="mt-1.5"
                            >
                              {a.resolution.kind === 'SPECIAL' ? 'Special resolution' : 'Ordinary resolution'}
                            </Badge>
                            <p className="mt-2 text-base leading-relaxed text-ink-2">{a.resolution.text}</p>
                            {(a.accepted.PROPOSAL || a.accepted.SECONDING) && (
                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base text-ink-2">
                                {a.accepted.PROPOSAL && (
                                  <span>
                                    Proposed by{' '}
                                    <strong className="font-medium text-ink">
                                      {a.accepted.PROPOSAL.shareholderName}
                                    </strong>
                                  </span>
                                )}
                                {a.accepted.SECONDING && (
                                  <span>
                                    Seconded by{' '}
                                    <strong className="font-medium text-ink">
                                      {a.accepted.SECONDING.shareholderName}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            )}

                            {(() => {
                              const itemSessions = room.votingSessions.filter(
                                (s) => s.agendaItemId === a.id,
                              );
                              const latest = itemSessions[itemSessions.length - 1] ?? null;
                              if (!latest?.result) return null;
                              const r = latest.result;
                              return (
                                <div className="mt-3 rounded-md bg-subtle/70 px-3.5 py-2.5 text-base text-ink-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge tone={r.passed ? 'success' : 'warning'}>
                                      {r.passed ? 'Carried' : 'Not carried'}
                                    </Badge>
                                    <span className="font-medium text-ink">
                                      Official result ({r.resolutionKind === 'SPECIAL' ? 'Special resolution' : 'Ordinary resolution'})
                                    </span>
                                  </div>
                                  {r.weightsHidden ? (
                                    <p className="mt-1 text-sm text-ink-3">
                                      Numeric vote counts are hidden per meeting governance rules.
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-sm text-ink tabular">
                                      For: <strong className="font-semibold text-ink">{formatShares(r.forVotes)}</strong> ({formatVotePct(r.forVotes, r.baseVotes)}) · Against: <strong className="font-semibold text-ink">{formatShares(r.againstVotes)}</strong> ({formatVotePct(r.againstVotes, r.baseVotes)}){r.abstainVotes && r.abstainVotes !== '0' ? ` · Abstain: ${formatShares(r.abstainVotes)}` : ''}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </div>

          <div className="flex flex-col gap-6">
            <Panel>
              <PanelHeader
                title="Current item"
                description={
                  activeItem
                    ? `Item ${activeItem.number}: ${activeItem.title}`
                    : 'Stages open as each agenda item is called.'
                }
              />

              {!activeItem ? (
                <div className="divide-y divide-line">
                  <p className="px-5 py-4 text-base text-ink-2">
                    Waiting for the chair to call an agenda item. Proposal, seconding and poll demand controls stay locked until opened.
                  </p>
                  <div className="flex flex-col gap-3 px-5 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium text-ink">Proposal</span>
                      <Badge tone="neutral">Not open yet</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium text-ink">Seconding</span>
                      <Badge tone="neutral">Not open yet</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium text-ink">Poll demand</span>
                      <Badge tone="neutral">Not open yet</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium text-ink">Voting</span>
                      <Badge tone="neutral">Not open yet</Badge>
                    </div>
                  </div>
                </div>
              ) : !activeItem.resolution ? (
                <p className="px-5 py-4 text-base text-ink-2">
                  This is a discussion item without a formal resolution. You may submit questions below.
                </p>
              ) : (
                <div className="divide-y divide-line">
                  {activeItem.resolution.requiresProposal && (
                    <MotionStageRow
                      title="Proposal"
                      buttonLabel="Propose resolution"
                      stageOpen={isLive && activeItem.stages.PROPOSAL}
                      accepted={activeItem.accepted.PROPOSAL}
                      myMotion={
                        room.myMotions.find(
                          (m) => m.agendaItemId === activeItem.id && m.kind === 'PROPOSAL',
                        ) ?? null
                      }
                      permitted={Boolean(activeReg?.capabilities.propose)}
                      loading={
                        submitMotion.isPending && submitMotion.variables?.kind === 'PROPOSAL'
                      }
                      onSubmit={() =>
                        submitMotion.mutate({ agendaItemId: activeItem.id, kind: 'PROPOSAL' })
                      }
                    />
                  )}

                  {activeItem.resolution.requiresSeconding && (
                    <MotionStageRow
                      title="Seconding"
                      buttonLabel="Second resolution"
                      stageOpen={isLive && activeItem.stages.SECONDING}
                      accepted={activeItem.accepted.SECONDING}
                      myMotion={
                        room.myMotions.find(
                          (m) => m.agendaItemId === activeItem.id && m.kind === 'SECONDING',
                        ) ?? null
                      }
                      permitted={Boolean(activeReg?.capabilities.second)}
                      loading={
                        submitMotion.isPending && submitMotion.variables?.kind === 'SECONDING'
                      }
                      onSubmit={() =>
                        submitMotion.mutate({ agendaItemId: activeItem.id, kind: 'SECONDING' })
                      }
                    />
                  )}

                  <div className="px-5 py-4">
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-base font-medium text-ink">Poll demand</span>
                      {room.myPollDemands.includes(activeItem.id) ? (
                        <Badge tone="success" dot>
                          Recorded
                        </Badge>
                      ) : isLive && activeItem.stages.POLL_DEMAND ? (
                        <Badge tone="accent" dot>
                          Open now
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Not open yet</Badge>
                      )}
                    </div>

                    {room.myPollDemands.includes(activeItem.id) ? (
                      <p className="flex items-center gap-2 text-base text-success">
                        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                        Your poll demand has been recorded for this item.
                      </p>
                    ) : (
                      <Button
                        type="button"
                        size="lg"
                        variant={isLive && activeItem.stages.POLL_DEMAND ? 'primary' : 'secondary'}
                        className="w-full"
                        loading={submitPollDemand.isPending}
                        disabled={
                          !isLive ||
                          !activeItem.stages.POLL_DEMAND ||
                          !activeReg?.capabilities.demandPoll ||
                          submitPollDemand.isPending
                        }
                        onClick={() => submitPollDemand.mutate(activeItem.id)}
                      >
                        Demand a poll
                      </Button>
                    )}
                  </div>

                  <VotingStageRow
                    key={`${activeItem.id}-${room.votingSessions.filter((s) => s.agendaItemId === activeItem.id).slice(-1)[0]?.id ?? 'none'}-${activeReg?.participantId ?? 'none'}`}
                    liveBase={liveBase}
                    session={
                      room.votingSessions
                        .filter((s) => s.agendaItemId === activeItem.id)
                        .slice(-1)[0] ?? null
                    }
                    registration={activeReg}
                    onVoted={refresh}
                  />
                </div>
              )}
            </Panel>

            <QuestionsSection
              liveBase={liveBase}
              room={room}
              participantId={activeReg?.participantId}
              canAsk={
                Boolean(activeReg?.capabilities.ask) &&
                (room.state === 'REGISTRATION_OPEN' || room.state === 'LIVE' || room.state === 'PAUSED')
              }
              onSubmitted={refresh}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function MotionStageRow({
  title,
  buttonLabel,
  stageOpen,
  accepted,
  myMotion,
  permitted,
  loading,
  onSubmit,
}: {
  title: string;
  buttonLabel: string;
  stageOpen: boolean;
  accepted: MotionDto | null;
  myMotion: { status: MotionDto['status'] } | null;
  permitted: boolean;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="px-5 py-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-medium text-ink">{title}</span>
        {accepted ? (
          <Badge tone="success" dot>
            Accepted
          </Badge>
        ) : stageOpen ? (
          <Badge tone="accent" dot>
            Open now
          </Badge>
        ) : (
          <Badge tone="neutral">Not open yet</Badge>
        )}
      </div>

      {accepted ? (
        <p className="flex items-center gap-2 text-base text-ink-2">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          <span>
            {title === 'Proposal' ? 'Proposed by ' : 'Seconded by '}
            <strong className="font-medium text-ink">{accepted.shareholderName}</strong>
          </span>
        </p>
      ) : myMotion ? (
        <p className="text-base text-ink-2">
          Your {title.toLowerCase()} has been submitted ({myMotion.status.toLowerCase()}).
        </p>
      ) : (
        <>
          <Button
            type="button"
            size="lg"
            variant={stageOpen ? 'primary' : 'secondary'}
            className="w-full"
            loading={loading}
            disabled={!stageOpen || !permitted || loading}
            onClick={onSubmit}
          >
            {buttonLabel}
          </Button>
          {stageOpen && !permitted && (
            <p className="mt-2 text-base text-ink-3">
              Your proxy appointment does not include speaking rights for this stage.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function QuestionsSection({
  liveBase,
  room,
  participantId,
  canAsk,
  onSubmitted,
}: {
  liveBase: string;
  room: MeetingRoom;
  participantId: string | undefined;
  canAsk: boolean;
  onSubmitted: () => void;
}) {
  const [mode, setMode] = React.useState<'TEXT' | 'AUDIO'>('TEXT');
  const [agendaItemId, setAgendaItemId] = React.useState<string>('');
  const [text, setText] = React.useState('');

  // Audio recording state
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [micError, setMicError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const startedAtRef = React.useRef<number>(0);

  const cleanupRecording = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // Ignore already-stopped recorder
      }
    }
    recorderRef.current = null;
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, [cleanupRecording]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const discardAudio = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAudioBlob(null);
    setElapsed(0);
  };

  const startRecording = async () => {
    setMicError(null);
    discardAudio();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('Audio recording is not supported in this browser. Please submit a written question.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const secs = Math.max(1, Math.min(room.audioMaxSeconds, Math.round((Date.now() - startedAtRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setElapsed(secs);
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setRecording(false);
        if (streamRef.current) {
          for (const t of streamRef.current.getTracks()) t.stop();
          streamRef.current = null;
        }
      };

      recorder.start();
      timerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setElapsed(secs);
        if (secs >= room.audioMaxSeconds) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (recorder.state !== 'inactive') recorder.stop();
        }
      }, 500);
    } catch {
      setMicError('Microphone access was denied or unavailable. You can submit a written question instead.');
      cleanupRecording();
      setRecording(false);
    }
  };

  const stopRecording = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  };

  const submitText = useMutation({
    mutationFn: () =>
      api.post<QuestionDto>(`${liveBase}/questions`, {
        text: text.trim(),
        agendaItemId: agendaItemId || undefined,
        participantId,
      }),
    onSuccess: () => {
      setText('');
      onSubmitted();
      toast.success('Your question has been submitted');
    },
    onError: (e) => toast.error(e.message),
  });

  const submitAudio = useMutation({
    mutationFn: () => {
      if (!audioBlob) throw new Error('Record an audio question first');
      const ext = audioBlob.type.includes('ogg') ? 'ogg' : audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      const form = new FormData();
      form.append('file', audioBlob, `question.${ext}`);
      form.append('durationSeconds', String(Math.max(1, elapsed)));
      if (agendaItemId) form.append('agendaItemId', agendaItemId);
      if (participantId) form.append('participantId', participantId);
      return api.upload<QuestionDto>(`${liveBase}/questions/audio`, form);
    },
    onSuccess: () => {
      discardAudio();
      onSubmitted();
      toast.success('Your audio question has been submitted');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Panel>
      <PanelHeader
        title="Ask a question"
        description="Questions are reviewed by the moderator before going to the board."
      />

      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Question format">
          <Button
            type="button"
            size="lg"
            variant={mode === 'TEXT' ? 'primary' : 'secondary'}
            aria-pressed={mode === 'TEXT'}
            onClick={() => setMode('TEXT')}
          >
            Written
          </Button>
          <Button
            type="button"
            size="lg"
            variant={mode === 'AUDIO' ? 'primary' : 'secondary'}
            aria-pressed={mode === 'AUDIO'}
            onClick={() => setMode('AUDIO')}
          >
            Audio
          </Button>
        </div>

        <Field label="Agenda item" htmlFor="question-agenda" optional>
          <Select id="question-agenda" value={agendaItemId} onChange={(e) => setAgendaItemId(e.target.value)}>
            <option value="">General meeting question</option>
            {room.agenda.map((a) => (
              <option key={a.id} value={a.id}>
                Item {a.number}: {a.title}
              </option>
            ))}
          </Select>
        </Field>

        {mode === 'TEXT' ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canAsk && text.trim().length >= 3) submitText.mutate();
            }}
          >
            <Field label="Your question" htmlFor="question-text">
              <Textarea
                id="question-text"
                rows={4}
                className="text-base"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your question..."
                disabled={!canAsk}
              />
            </Field>
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={submitText.isPending}
              disabled={!canAsk || text.trim().length < 3}
            >
              Submit question
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink-2">
              Record a voice question up to <span className="tabular">{room.audioMaxSeconds}</span> seconds.
            </p>
            {micError && <Alert tone="warning">{micError}</Alert>}

            {!recording && !audioBlob && (
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!canAsk}
                onClick={startRecording}
              >
                <Mic aria-hidden /> Start recording
              </Button>
            )}

            {recording && (
              <div className="flex flex-col gap-3">
                <p className="text-base font-medium text-danger tabular">
                  Recording… {elapsed}s / {room.audioMaxSeconds}s
                </p>
                <Button type="button" size="lg" variant="danger" className="w-full" onClick={stopRecording}>
                  <Square aria-hidden /> Stop recording
                </Button>
              </div>
            )}

            {audioBlob && previewUrl && (
              <div className="flex flex-col gap-3">
                <audio controls src={previewUrl} aria-label="Recorded audio preview" className="h-11 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="lg" variant="secondary" onClick={discardAudio}>
                    Discard
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="primary"
                    loading={submitAudio.isPending}
                    onClick={() => submitAudio.mutate()}
                  >
                    Send audio
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {room.myQuestions.length > 0 && (
        <div className="border-t border-line">
          <p className="px-5 pt-4 pb-2 text-base font-semibold text-ink">
            Your questions
          </p>
          <ul className="divide-y divide-line">
            {room.myQuestions.map((q) => {
              const st = QUESTION_STATUS_SHAREHOLDER[q.status];
              return (
                <li key={q.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-ink-3 tabular">{formatDateTime(q.createdAt)}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  {q.kind === 'TEXT' ? (
                    <p
                      lang={q.bangla ? 'bn' : undefined}
                      className="mt-1.5 text-base leading-relaxed whitespace-pre-line text-ink"
                    >
                      {q.text}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-base text-ink-2">
                      Audio question ({q.durationSeconds ?? 0}s)
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

function VotingStageRow({
  liveBase,
  session,
  registration,
  onVoted,
}: {
  liveBase: string;
  session: ParticipantVotingSessionDto | null;
  registration: RoomRegistration | undefined;
  onVoted: () => void;
}) {
  const entitlements = React.useMemo(
    () => registration?.entitlements ?? [],
    [registration?.entitlements],
  );
  const entIdSet = React.useMemo(
    () => new Set(entitlements.map((e) => e.entitlementId)),
    [entitlements],
  );
  const myBallots = React.useMemo(
    () => (session?.myBallots ?? []).filter((b) => entIdSet.has(b.entitlementId)),
    [session?.myBallots, entIdSet],
  );

  const [userChoice, setUserChoice] = React.useState<BallotChoice | null>(null);
  const selectedChoice: BallotChoice =
    userChoice ?? myBallots[0]?.choice ?? session?.choices[0] ?? 'FOR';

  const [splitMode, setSplitMode] = React.useState(false);
  const [userSplitChoices, setUserSplitChoices] = React.useState<Record<string, BallotChoice>>({});
  const getSplitChoice = (entId: string): BallotChoice =>
    userSplitChoices[entId] ??
    myBallots.find((b) => b.entitlementId === entId)?.choice ??
    session?.choices[0] ??
    'FOR';

  const pendingKeyRef = React.useRef<{ signature: string; key: string } | null>(null);

  const getIdempotencyKey = (signature: string): string => {
    if (pendingKeyRef.current && pendingKeyRef.current.signature === signature) {
      return pendingKeyRef.current.key;
    }
    const key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}-${Math.random()}`;
    pendingKeyRef.current = { signature, key };
    return key;
  };

  const castVote = useMutation({
    mutationFn: (vars: { payload: object; signature: string }) => {
      const key = getIdempotencyKey(vars.signature);
      return api.post<CastVoteResult>(`${liveBase}/vote`, vars.payload, {
        headers: { 'idempotency-key': key },
      });
    },
    onSuccess: (res) => {
      pendingKeyRef.current = null;
      onVoted();
      toast.success(
        res.replayed
          ? 'Your ballot was already recorded'
          : myBallots.length > 0
            ? 'Your ballot has been updated'
            : 'Your ballot has been cast',
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const canSplit =
    Boolean(session && session.method === 'SHARE_WEIGHTED' && entitlements.length > 1);

  const handleCastSingle = (choice: BallotChoice) => {
    if (!session || !registration) return;
    const payload = {
      votingSessionId: session.id,
      participantId: registration.participantId,
      choice,
    };
    const signature = `${session.id}:${registration.participantId}:single:${choice}`;
    castVote.mutate({ payload, signature });
  };

  const handleCastSplit = () => {
    if (!session || !registration) return;
    const votes = entitlements.map((ent) => ({
      entitlementId: ent.entitlementId,
      choice: getSplitChoice(ent.entitlementId),
    }));
    const payload = {
      votingSessionId: session.id,
      participantId: registration.participantId,
      votes,
    };
    const signature = `${session.id}:${registration.participantId}:split:${JSON.stringify(votes)}`;
    castVote.mutate({ payload, signature });
  };

  return (
    <div className="px-5 py-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-medium text-ink">Voting</span>
        {!session ? (
          <Badge tone="neutral">Not open yet</Badge>
        ) : session.result ? (
          <Badge tone={session.result.passed ? 'success' : 'warning'}>
            {session.result.passed ? 'Result: Carried' : 'Result: Not carried'}
          </Badge>
        ) : session.openForVoting && myBallots.length > 0 && !session.allowChange ? (
          <Badge tone="success" dot>
            Voted
          </Badge>
        ) : session.openForVoting && myBallots.length > 0 && session.allowChange ? (
          <Badge tone="accent" dot>
            Voted · Changeable
          </Badge>
        ) : session.openForVoting ? (
          <Badge tone="accent" dot>
            Open now
          </Badge>
        ) : (
          <Badge tone="neutral">Closed · awaiting release</Badge>
        )}
      </div>

      {session && (
        <p className="text-sm text-ink-3">
          {VOTING_METHOD_LABELS[session.method]}
          {session.closesAt && session.openForVoting
            ? ` · Closes ${formatDateTime(session.closesAt)}`
            : ''}
        </p>
      )}

      {registration?.proxySuspendedByShareholder ? (
        <Alert tone="warning" title="Proxy authority suspended" className="mt-3">
          Your proxy voting authority is suspended because the shareholder is attending the meeting or voted directly.
        </Alert>
      ) : !registration?.capabilities.vote ? (
        <p className="mt-3 text-base text-ink-3">
          Your proxy appointment is for attendance only and does not include voting rights.
        </p>
      ) : session?.result ? (
        <div className="mt-3 rounded-md bg-subtle/80 p-3 text-base text-ink-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={session.result.passed ? 'success' : 'warning'}>
              {session.result.passed ? 'Carried' : 'Not carried'}
            </Badge>
            <span className="font-medium text-ink">Official result</span>
          </div>
          {session.result.weightsHidden ? (
            <p className="mt-1 text-sm text-ink-3">
              Numeric vote counts are hidden per meeting governance rules.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink tabular">
              For: <strong className="font-semibold text-ink">{formatShares(session.result.forVotes)}</strong> ({formatVotePct(session.result.forVotes, session.result.baseVotes)}) · Against: <strong className="font-semibold text-ink">{formatShares(session.result.againstVotes)}</strong> ({formatVotePct(session.result.againstVotes, session.result.baseVotes)}){session.result.abstainVotes && session.result.abstainVotes !== '0' ? ` · Abstain: ${formatShares(session.result.abstainVotes)}` : ''}
            </p>
          )}
        </div>
      ) : session?.openForVoting ? (
        <div className="mt-3">
          {myBallots.length > 0 && !session.allowChange ? (
            <div className="rounded-md bg-subtle/80 p-3 text-base text-ink">
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                Your ballot has been recorded and cannot be changed in this session.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
                {myBallots.map((b) => (
                  <li key={b.id} className="tabular">
                    {BALLOT_CHOICE_LABELS[b.choice]} · {formatShares(b.weight)} votes
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              {myBallots.length > 0 && (
                <p className="mb-2.5 text-sm text-ink-3">
                  Your current ballot is recorded. You may change it until voting closes.
                </p>
              )}

              {canSplit && (
                <div className="mb-3">
                  <button
                    type="button"
                    className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    onClick={() => setSplitMode((prev) => !prev)}
                  >
                    {splitMode ? 'Vote the same across all accounts' : 'Split votes by account'}
                  </button>
                </div>
              )}

              {!splitMode ? (
                <div>
                  <div
                    className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                    role="radiogroup"
                    aria-label="Resolution vote choice"
                  >
                    {session.choices.map((ch) => {
                      const active = selectedChoice === ch;
                      return (
                        <button
                          key={ch}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setUserChoice(ch)}
                          className={cn(
                            'flex h-11 items-center justify-center rounded-md border text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                            active
                              ? 'border-accent bg-accent-soft text-accent-ink ring-1 ring-accent'
                              : 'border-line-strong bg-surface text-ink hover:bg-subtle',
                          )}
                        >
                          {BALLOT_CHOICE_LABELS[ch]}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-2 text-xs text-ink-3 tabular">
                    {session.method === 'SHARE_WEIGHTED'
                      ? `Applies to ${formatShares(registration.votes)} votes across ${entitlements.length} registered account${entitlements.length === 1 ? '' : 's'}.`
                      : 'Show of hands: 1 vote for this shareholder.'}
                  </p>

                  <Button
                    type="button"
                    size="lg"
                    variant="primary"
                    className="mt-3.5 w-full"
                    loading={castVote.isPending}
                    disabled={!selectedChoice || castVote.isPending}
                    onClick={() => handleCastSingle(selectedChoice)}
                  >
                    {myBallots.length > 0 ? 'Update ballot' : 'Cast ballot'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-ink-3">
                    Select a choice for each of your registered accounts:
                  </p>
                  <ul className="divide-y divide-line rounded-md border border-line bg-surface">
                    {entitlements.map((ent) => (
                      <li key={ent.entitlementId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-mono text-xs text-ink">{ent.accountLabel}</p>
                          <p className="text-xs text-ink-3 tabular">
                            {ent.shareClass} · {formatShares(ent.votes)} votes
                          </p>
                        </div>
                        <div className="flex gap-1.5" role="radiogroup" aria-label={`Choice for ${ent.accountLabel}`}>
                          {session.choices.map((ch) => {
                            const active = getSplitChoice(ent.entitlementId) === ch;
                            return (
                              <button
                                key={ch}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() =>
                                  setUserSplitChoices((prev) => ({
                                    ...prev,
                                    [ent.entitlementId]: ch,
                                  }))
                                }
                                className={cn(
                                  'h-9 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                                  active
                                    ? 'border-accent bg-accent-soft text-accent-ink ring-1 ring-accent'
                                    : 'border-line-strong bg-surface text-ink hover:bg-subtle',
                                )}
                              >
                                {BALLOT_CHOICE_LABELS[ch]}
                              </button>
                            );
                          })}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <Button
                    type="button"
                    size="lg"
                    variant="primary"
                    className="mt-1 w-full"
                    loading={castVote.isPending}
                    disabled={castVote.isPending}
                    onClick={handleCastSplit}
                  >
                    {myBallots.length > 0 ? 'Update split ballot' : 'Cast split ballot'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : session ? (
        <div className="mt-3">
          <p className="text-base text-ink-3">
            Voting for this resolution has closed. Official results will appear here once released by the chair.
          </p>
          {myBallots.length > 0 && (
            <p className="mt-1.5 text-sm text-ink-2 tabular">
              Your recorded ballot: {myBallots.map((b) => BALLOT_CHOICE_LABELS[b.choice]).join(', ')} ({formatShares(registration.votes)} votes)
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

