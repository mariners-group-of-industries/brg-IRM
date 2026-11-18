"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  FileText,
  Landmark,
  Mic,
  MonitorPlay,
  Send,
  Square,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { PortalPhaseBadge } from "@/components/portal/meeting-state";
import {
  attendMeetingAction,
  castVoteAction,
  demandPollAction,
  proposeAction,
  secondAction,
  submitTextQuestionAction,
} from "@/app/portal/portal-actions";
import type { AgendaItem, AgendaStage, MeetingPhase } from "@/lib/types";

type LiveAgenda = {
  agendaId: string;
  stage: AgendaStage;
  for: number;
  against: number;
  abstain: number;
  demands: number;
  proposedBy: { name: string; boId: string } | null;
  secondedBy: { name: string; boId: string } | null;
};

type LiveQuestion = {
  id: string;
  kind: "text" | "audio";
  body?: string;
  audioId?: string;
  durationSec?: number;
  participantName: string;
  boId: string;
  at: string;
};

interface LivePayload {
  phase: MeetingPhase;
  activeAgendaId: string | null;
  registered: number;
  attended: number;
  eligible: number;
  questionsApproved: number;
  questionsPending: number;
  agenda: LiveAgenda[];
  votingOpen: boolean;
  pollDemandOpen: boolean;
  streamingProvider?: "irm_live" | "zoom" | "webex" | "none";
  streamUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  hostName?: string;
  myVotes: Record<string, { choice: string; reference: string }>;
  myDemands?: string[];
  questions: LiveQuestion[];
}

export interface RoomMeeting {
  id: string;
  companyId: string;
  type: "AGM" | "EGM";
  title: string;
  financialYear: string;
  date: string;
  mode: string;
  venue: string;
  status: string;
  votingMethod: string;
  pollDemandRule: string;
  votingOpen: boolean;
  pollDemandOpen: boolean;
  eligibleShareholders: number;
  registered: number;
  streamingProvider?: "irm_live" | "zoom" | "webex" | "none";
  streamUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  hostName?: string;
  agenda: AgendaItem[];
}

export interface RoomParticipant {
  participantId: string;
  kind: "individual" | "corporate" | "proxy";
  name: string;
  subjectName: string;
  boId: string;
  eligibleShares: number;
  votingRights: number;
}

const stageNames: Record<AgendaStage, string> = {
  closed: "Controls closed",
  proposal: "Proposal open",
  seconding: "Seconding open",
  poll: "Poll demand open",
  voting: "Voting open",
};

function sanitizeHttpUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function resolveStreamUrls(
  provider: "irm_live" | "zoom" | "webex" | "none",
  rawUrl: string | undefined,
  rawZoomId: string | undefined,
  rawPasscode: string | undefined,
  participantName: string,
) {
  if (provider === "none") {
    return { embedUrl: null, externalUrl: null, zoomDigits: null, passcode: null };
  }

  const cleanUrl = sanitizeHttpUrl(rawUrl);

  if (provider === "zoom") {
    let digits = (rawZoomId ?? "").replace(/\D/g, "");
    let pwd = (rawPasscode ?? "").trim();

    if (cleanUrl) {
      const idMatch = cleanUrl.match(/\/(?:j|wc|w|s)\/(\d{9,12})/);
      if (!digits && idMatch?.[1]) digits = idMatch[1];
      try {
        const u = new URL(cleanUrl);
        if (!pwd && u.searchParams.get("pwd")) pwd = u.searchParams.get("pwd") ?? "";
      } catch {
        // ignore
      }
    }

    const embedUrl = digits
      ? `https://app.zoom.us/wc/${digits}/join?prefer=1&uname=${encodeURIComponent(participantName)}${pwd ? `&pwd=${encodeURIComponent(pwd)}` : ""}`
      : null;
    const externalUrl =
      cleanUrl ?? (digits ? `https://zoom.us/j/${digits}${pwd ? `?pwd=${encodeURIComponent(pwd)}` : ""}` : null);

    return {
      embedUrl,
      externalUrl,
      zoomDigits: digits || null,
      passcode: pwd || null,
    };
  }

  // YouTube / Live Stream / Webex embed conversion
  if (cleanUrl) {
    try {
      const u = new URL(cleanUrl);
      if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
        const ytId =
          u.hostname.includes("youtu.be")
            ? u.pathname.replace(/^\//, "")
            : u.pathname.startsWith("/live/")
              ? u.pathname.replace("/live/", "")
              : u.pathname.startsWith("/embed/")
                ? u.pathname.replace("/embed/", "")
                : u.searchParams.get("v");
        if (ytId) {
          return {
            embedUrl: `https://www.youtube.com/embed/${ytId}`,
            externalUrl: cleanUrl,
            zoomDigits: null,
            passcode: null,
          };
        }
      }
    } catch {
      // ignore
    }
    return { embedUrl: cleanUrl, externalUrl: cleanUrl, zoomDigits: null, passcode: null };
  }

  return { embedUrl: null, externalUrl: null, zoomDigits: null, passcode: null };
}

export function RoomClient({
  meeting,
  participant,
  initialLive,
  registeredInitially,
}: {
  meeting: RoomMeeting;
  participant: RoomParticipant;
  initialLive: LivePayload;
  registeredInitially: boolean;
}) {
  const { t, locale, number } = usePortalLanguage();
  const [busy, setBusy] = useState(false);
  const [ballot, setBallot] = useState<AgendaItem | null>(null);
  const [choice, setChoice] = useState<"for" | "against" | "abstain">("for");
  const [receipt, setReceipt] = useState("");
  const [embedOpen, setEmbedOpen] = useState(false);

  const { data: live, error, refetch } = useQuery<LivePayload>({
    queryKey: ["portal-live", meeting.id],
    queryFn: async () => {
      const r = await fetch(`/api/portal/live/${meeting.id}`, { cache: "no-store" });
      if (!r.ok) throw Error("Could not load meeting");
      return r.json();
    },
    initialData: initialLive,
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });

  const active = live.phase === "live" || live.phase === "voting_open";
  const enabled = active && !error && registeredInitially;

  useEffect(() => {
    if (active) void attendMeetingAction(meeting.id);
  }, [active, meeting.id]);

  const provider = live.streamingProvider ?? meeting.streamingProvider ?? "zoom";
  const rawUrl = live.streamUrl ?? meeting.streamUrl;
  const rawZoomId = live.zoomMeetingId ?? meeting.zoomMeetingId;
  const rawPasscode = live.zoomPasscode ?? meeting.zoomPasscode;
  const hostName = live.hostName ?? meeting.hostName;

  const streamInfo = useMemo(
    () => resolveStreamUrls(provider, rawUrl, rawZoomId, rawPasscode, participant.name),
    [provider, rawUrl, rawZoomId, rawPasscode, participant.name],
  );

  async function act(action: "propose" | "second" | "poll", agendaId: string) {
    setBusy(true);
    try {
      const result =
        action === "propose"
          ? await proposeAction(meeting.id, agendaId)
          : action === "second"
            ? await secondAction(meeting.id, agendaId)
            : await demandPollAction(meeting.id, agendaId);
      if (!result.ok) toast.error(t(result.error ?? "Could not record the demand"));
      else {
        toast.success(t(action === "poll" ? "Poll demand recorded" : "Participation recorded"));
        await refetch();
      }
    } catch {
      toast.error(t("Could not update participation"));
    } finally {
      setBusy(false);
    }
  }

  async function vote() {
    if (!ballot) return;
    setBusy(true);
    try {
      const result = await castVoteAction(meeting.id, ballot.id, choice);
      if (!result.ok) toast.error(t(result.error));
      else {
        setReceipt(result.reference);
        await refetch();
      }
    } catch {
      toast.error(t("Could not record the vote"));
    } finally {
      setBusy(false);
    }
  }

  function copyCredentials() {
    const text = [
      streamInfo.zoomDigits ? `Meeting ID: ${rawZoomId || streamInfo.zoomDigits}` : "",
      streamInfo.passcode ? `Passcode: ${streamInfo.passcode}` : "",
      streamInfo.externalUrl ? `Join Link: ${streamInfo.externalUrl}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success(locale === "bn" ? "জুম তথ্য কপি করা হয়েছে" : "Zoom credentials copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/portal/meetings/${meeting.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t("Leave room")}
        </Link>
        <PortalPhaseBadge phase={live.phase} />
      </div>

      <header>
        <h1 className="text-2xl font-semibold">{meeting.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {meeting.financialYear} · {participant.subjectName} · {participant.boId}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-danger-soft p-3 text-sm text-destructive">
          {t("Could not load meeting updates. Retrying…")}
        </p>
      )}

      <section
        className={`rounded-xl border p-4 ${active ? "border-brand/25 bg-brand-soft" : "border-border bg-muted/50"}`}
        aria-live="polite"
      >
        <h2 className="text-sm font-semibold">
          {t(
            live.phase === "waiting"
              ? "Waiting for the chair"
              : live.phase === "ended"
                ? "Meeting has ended"
                : live.phase === "voting_open"
                  ? "Voting is open"
                  : "Meeting is now live",
          )}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t(
            live.phase === "waiting"
              ? "The chair has not started this meeting. Participation controls are disabled."
              : live.phase === "ended"
                ? "This meeting has ended. All participation controls are closed."
                : "Join the meeting room to follow the current agenda.",
          )}
        </p>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Live Zoom & Broadcast Video Stage */}
          <div className="overflow-hidden rounded-xl border border-brand-navy/30 bg-brand-navy text-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/20 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-teal-400" />
                <span className="font-semibold">
                  {provider === "zoom"
                    ? "Zoom Live Video Bridge"
                    : provider === "webex"
                      ? "Cisco Webex Stream"
                      : provider === "none"
                        ? "Audio & Voting Console"
                        : "Live Broadcast Stage"}
                </span>
                {hostName && <span className="hidden text-white/60 sm:inline">· Host: {hostName}</span>}
              </div>

              {streamInfo.zoomDigits && (
                <div className="flex items-center gap-2 font-mono text-[11px] text-teal-200">
                  <span>ID: {rawZoomId || streamInfo.zoomDigits}</span>
                  {streamInfo.passcode && <span>· Pass: {streamInfo.passcode}</span>}
                  <button
                    type="button"
                    onClick={copyCredentials}
                    title="Copy Zoom credentials"
                    className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {embedOpen && streamInfo.embedUrl ? (
              <div className="bg-black">
                <div className="relative aspect-video w-full">
                  <iframe
                    src={streamInfo.embedUrl}
                    title={`${meeting.title} Live Video`}
                    className="h-full w-full border-0"
                    allow="microphone; camera; fullscreen; display-capture; autoplay"
                    allowFullScreen
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-navy px-4 py-2 text-[11px] text-white/80">
                  <span>
                    {locale === "bn"
                      ? "ব্রাউজারে জুম লোড না হলে ডানপাশের 'Open in Zoom App' বাটনে চাপুন এবং এই পেজে ভোট দিন।"
                      : "If browser blocks third-party Zoom cookies, open Zoom App while voting on this tab."}
                  </span>
                  <div className="flex items-center gap-2">
                    {streamInfo.externalUrl && (
                      <a
                        href={streamInfo.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-white/10 px-2.5 py-1 font-medium text-white hover:bg-white/20"
                      >
                        Open in Zoom App
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEmbedOpen(false)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <X className="size-3.5" /> Minimize
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
                {provider === "none" ? (
                  <>
                    <Landmark className="size-8 text-white/70" aria-hidden />
                    <p className="text-sm font-medium">
                      {locale === "bn" ? "ভোট ও প্রশ্নোত্তর সেশন" : "Voting & Q&A Meeting Console"}
                    </p>
                    <p className="max-w-md text-xs text-white/70">
                      {meeting.venue}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/20 text-teal-300">
                      <Video className="size-6" aria-hidden />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">
                        {provider === "zoom"
                          ? locale === "bn"
                            ? "জুম লাইভ মিটিং প্রস্তুত — এখানেই যোগ দিন"
                            : "Zoom Meeting Ready — Watch & Vote Side by Side"
                          : locale === "bn"
                            ? "লাইভ ভিডিও সম্প্রচার প্রস্তুত"
                            : "Live Video Stream Ready"}
                      </p>
                      <p className="max-w-md text-xs text-white/70">
                        {streamInfo.externalUrl
                          ? locale === "bn"
                            ? "নিচের প্লেয়ারটি এই পেজের ভেতরেই চালু করতে পারেন অথবা জুম অ্যাপে খুলতে পারেন।"
                            : "Launch the embedded player inside this meeting room or open in the Zoom desktop/mobile app."
                          : locale === "bn"
                            ? "চেয়ারম্যান/সচিব মিটিং কন্ট্রোল থেকে জুম লিংক যুক্ত করলে সাথে সাথে এখানে দেখা যাবে।"
                            : "Stream link will appear as soon as the host publishes the Zoom / broadcast URL."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      {streamInfo.embedUrl && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setEmbedOpen(true)}
                          className="bg-teal-500 text-brand-navy hover:bg-teal-400 font-semibold"
                        >
                          <MonitorPlay className="mr-1.5 size-4" />
                          {provider === "zoom"
                            ? locale === "bn"
                              ? "এই পেজে জুম চালু করুন"
                              : "Join Zoom Inside Room"
                            : locale === "bn"
                              ? "লাইভ ভিডিও চালু করুন"
                              : "Load Live Player"}
                        </Button>
                      )}
                      {streamInfo.externalUrl && (
                        <a
                          href={streamInfo.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20"
                        >
                          {provider === "zoom"
                            ? locale === "bn"
                              ? "জুম অ্যাপে খুলুন"
                              : "Open in Zoom App"
                            : "Open Stream"}
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <section aria-labelledby="room-agenda">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="room-agenda" className="text-base font-semibold">
                {t("Agenda")}
              </h2>
              <Link
                href={`/portal/meetings/${meeting.id}#documents`}
                className="flex items-center gap-1 text-xs text-brand hover:underline"
              >
                <FileText className="size-4" />
                {t("View documents")}
              </Link>
            </div>
            <ol className="space-y-3">
              {meeting.agenda.map((item) => {
                const state = live.agenda.find((a) => a.agendaId === item.id);
                const opened = enabled && live.activeAgendaId === item.id;
                const voted = live.myVotes[item.id];
                const sameProposer = state?.proposedBy?.boId.slice(-4) === participant.boId.slice(-4);
                return (
                  <li
                    key={item.id}
                    className={`rounded-xl border bg-card p-4 ${opened ? "border-brand/40" : "border-border"}`}
                  >
                    <div className="flex gap-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                        {number(item.order)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium leading-6">
                          {locale === "bn" && item.titleBn ? item.titleBn : item.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t(item.kind === "special" ? "Special resolution" : "Ordinary resolution")} ·{" "}
                          {t(stageNames[opened ? state?.stage ?? "closed" : "closed"])}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {state?.proposedBy && (
                        <p>
                          {t("Proposed")}: {state.proposedBy.name} · {state.proposedBy.boId}
                        </p>
                      )}
                      {state?.secondedBy && (
                        <p>
                          {t("Seconded")}: {state.secondedBy.name} · {state.secondedBy.boId}
                        </p>
                      )}
                      <p>
                        {t("For")}: {number(state?.for ?? 0)} · {t("Against")}:{" "}
                        {number(state?.against ?? 0)} · {t("Abstain")}: {number(state?.abstain ?? 0)}
                      </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !opened || state?.stage !== "proposal" || !!state?.proposedBy}
                        title={t("Proposal is closed for this agenda. Wait for the chair.")}
                        onClick={() => act("propose", item.id)}
                      >
                        {t("Propose")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          busy ||
                          !opened ||
                          state?.stage !== "seconding" ||
                          !state?.proposedBy ||
                          !!state?.secondedBy ||
                          sameProposer
                        }
                        title={t("Seconding is unavailable. Wait for the chair and a proposal from another holder.")}
                        onClick={() => act("second", item.id)}
                      >
                        {t("Second")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          busy ||
                          !opened ||
                          state?.stage !== "poll" ||
                          live.myDemands?.includes(item.id)
                        }
                        title={t("Poll demand is closed for this agenda. Wait for the chair.")}
                        onClick={() => act("poll", item.id)}
                      >
                        {t("Poll demand")} ({number(state?.demands ?? 0)})
                      </Button>
                      {voted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="size-4" />
                          {t("Vote recorded")}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy || !opened || state?.stage !== "voting"}
                          title={t("Voting is closed for this agenda. Wait for the chair.")}
                          onClick={() => {
                            setBallot(item);
                            setReceipt("");
                            setChoice("for");
                          }}
                        >
                          {t("Vote here")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">{t("My participation")}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              {[
                ["Shares", participant.eligibleShares],
                ["Voting weight", participant.votingRights],
                ["Registered holders", live.registered],
                ["Present", live.attended],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{t(String(label))}</dt>
                  <dd className="mt-1 text-base font-semibold">{number(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <h2 className="border-b border-border p-4 text-sm font-semibold">
              {t("Questions to the board")}
            </h2>
            <ul className="max-h-80 space-y-3 overflow-y-auto p-4">
              {live.questions.map((q) => (
                <li key={q.id} className="rounded-lg bg-muted/40 p-3">
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    {q.participantName} · {q.boId}
                  </p>
                  {q.kind === "text" ? (
                    <p className="text-sm leading-6">{q.body}</p>
                  ) : (
                    <audio controls preload="none" src={`/api/portal/audio/${q.audioId}`} className="w-full" />
                  )}
                </li>
              ))}
            </ul>
            {!live.questions.length && (
              <p className="px-4 pb-4 text-xs text-muted-foreground">
                {t("No questions have been approved yet.")}
              </p>
            )}
            <QuestionComposer meetingId={meeting.id} enabled={!!enabled} />
          </section>
        </aside>
      </div>

      <Dialog
        open={!!ballot}
        onOpenChange={(open) => {
          if (!open && !busy) setBallot(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t(receipt ? "Vote recorded" : "Cast your vote")}</DialogTitle>
            <DialogDescription>
              {ballot ? (locale === "bn" && ballot.titleBn ? ballot.titleBn : ballot.title) : ""}
            </DialogDescription>
          </DialogHeader>
          {receipt ? (
            <>
              <p className="text-xs text-muted-foreground">{t("Vote reference")}</p>
              <p className="break-all rounded-lg bg-muted p-4 text-center font-mono text-sm font-semibold">
                {receipt}
              </p>
              <p className="text-xs leading-5 text-muted-foreground">
                {t("Keep this reference. This account cannot submit a second ballot for the same agenda.")}
              </p>
              <Button onClick={() => setBallot(null)}>{t("Done")}</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("Voting weight")}: {number(participant.votingRights)}
              </p>
              <fieldset className="space-y-2">
                <legend className="sr-only">{t("Cast your vote")}</legend>
                {(["for", "against", "abstain"] as const).map((c) => (
                  <label
                    key={c}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm ${
                      choice === c ? "border-brand bg-brand-soft" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ballot-choice"
                      value={c}
                      checked={choice === c}
                      onChange={() => setChoice(c)}
                      className="accent-brand"
                    />
                    {t(c === "for" ? "For" : c === "against" ? "Against" : "Abstain")}
                  </label>
                ))}
              </fieldset>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" disabled={busy} onClick={() => setBallot(null)}>
                  {t("Cancel")}
                </Button>
                <Button
                  disabled={
                    busy ||
                    !enabled ||
                    live.agenda.find((a) => a.agendaId === ballot?.id)?.stage !== "voting"
                  }
                  onClick={vote}
                >
                  {t("Confirm vote")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestionComposer({ meetingId, enabled }: { meetingId: string; enabled: boolean }) {
  const { t, number } = usePortalLanguage();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function send() {
    setBusy(true);
    setError("");
    try {
      const result = await submitTextQuestionAction(meetingId, body);
      if (!result.ok) setError(t(result.error));
      else {
        setBody("");
        toast.success(t("Question submitted for moderation"));
      }
    } catch {
      setError(t("Could not submit the question"));
    } finally {
      setBusy(false);
    }
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    setRecording(false);
  }

  async function record() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      const chunks: BlobPart[] = [];
      elapsed.current = 0;
      setSeconds(0);
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timer.current) clearInterval(timer.current);
        if (!mounted.current) return;
        setBusy(true);
        try {
          const form = new FormData();
          form.set("meetingId", meetingId);
          form.set("durationSec", String(Math.max(1, elapsed.current)));
          form.set("audio", new File(chunks, "question.webm", { type: mime }));
          const response = await fetch("/api/portal/audio", { method: "POST", body: form });
          const result = await response.json();
          if (!response.ok) setError(t(result.error ?? "Could not submit the question"));
          else toast.success(t("Audio question submitted for moderation"));
        } catch {
          setError(t("Could not submit the question"));
        } finally {
          if (mounted.current) setBusy(false);
        }
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      timer.current = setInterval(() => {
        elapsed.current++;
        setSeconds(elapsed.current);
        if (elapsed.current >= 150) stop();
      }, 1000);
    } catch {
      setError(t("Microphone unavailable — type your question instead."));
    }
  }

  return (
    <div className="space-y-3 border-t border-border p-4">
      <label htmlFor="question" className="text-xs font-medium">
        {t("Type your question")}
      </label>
      <Textarea
        id="question"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={500}
        disabled={!enabled || busy}
        placeholder={t("Type your question in Bangla or English…")}
      />
      <div className="flex items-center justify-between gap-2">
        {recording ? (
          <Button variant="destructive" onClick={stop}>
            <Square />
            {t("Stop recording")} {number(seconds)}s
          </Button>
        ) : (
          <Button
            variant="outline"
            aria-label={t("Record an audio question")}
            disabled={!enabled || busy}
            onClick={record}
          >
            <Mic />
            {t("Audio question")}
          </Button>
        )}
        <Button disabled={!enabled || busy || body.trim().length < 3} onClick={send}>
          <Send />
          {t(busy ? "Uploading…" : "Send")}
        </Button>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        {t("Comments appear after moderator approval.")}{" "}
        {t("Audio limit: {seconds} seconds", { seconds: 150 })}
      </p>
      {!enabled && (
        <p className="text-xs text-muted-foreground">
          {t("Register first. Participation is available when the meeting room is open.")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
