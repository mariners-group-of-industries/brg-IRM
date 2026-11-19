"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Video } from "lucide-react";
import { toast } from "sonner";
import {
  setAgendaStageAction,
  setMeetingLifecycleAction,
  updateMeetingStreamAction,
} from "@/app/(app)/governance/meetings/[id]/controls-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/registry/shared";
import { meetingPhase } from "@/lib/meeting-rules";
import type { AgendaStage, Meeting, MeetingPhase } from "@/lib/types";

const stages: { value: AgendaStage; label: string }[] = [
  { value: "closed", label: "All controls closed" },
  { value: "proposal", label: "Open proposal" },
  { value: "seconding", label: "Open seconding" },
  { value: "poll", label: "Open poll demand" },
  { value: "voting", label: "Open voting" },
];

export function MeetingControls({ meetingId, meeting }: { meetingId: string; meeting: Meeting }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [provider, setProvider] = useState<"irm_live" | "zoom" | "webex" | "none">(
    meeting.streamingProvider ?? "zoom",
  );
  const [streamUrl, setStreamUrl] = useState(meeting.streamUrl ?? "");
  const [zoomMeetingId, setZoomMeetingId] = useState(meeting.zoomMeetingId ?? "");
  const [zoomPasscode, setZoomPasscode] = useState(meeting.zoomPasscode ?? "");

  const { data, refetch } = useQuery<{
    phase: MeetingPhase;
    activeAgendaId: string | null;
    agenda: { agendaId: string; stage: AgendaStage }[];
  }>({
    queryKey: ["chair-controls", meetingId],
    queryFn: async () => {
      const r = await fetch(`/api/portal/live/${meetingId}`, { cache: "no-store" });
      if (!r.ok) throw Error("Could not load controls");
      return r.json();
    },
    initialData: {
      phase: meetingPhase(meeting),
      activeAgendaId: meeting.activeAgendaId ?? null,
      agenda: meeting.agenda.map((a) => ({ agendaId: a.id, stage: a.stage ?? "closed" })),
    },
    refetchInterval: 3000,
  });

  function lifecycle(transition: "start" | "end") {
    startTransition(async () => {
      const result = await setMeetingLifecycleAction(meetingId, transition);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(transition === "start" ? "Meeting started" : "Meeting ended");
        await refetch();
        router.refresh();
      }
    });
  }

  function stage(agendaId: string, value: string) {
    startTransition(async () => {
      const result = await setAgendaStageAction(meetingId, agendaId, value);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Agenda controls updated");
        await refetch();
        router.refresh();
      }
    });
  }

  function saveBroadcast() {
    startTransition(async () => {
      const res = await updateMeetingStreamAction(meetingId, {
        streamingProvider: provider,
        streamUrl,
        zoomMeetingId,
        zoomPasscode,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Zoom / live broadcast settings updated for shareholder room");
        await refetch();
        router.refresh();
      }
    });
  }

  const live = data.phase === "live" || data.phase === "voting_open";

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-card" aria-labelledby="chair-controls">
      <div>
        <h2 id="chair-controls" className="text-sm font-semibold">Chair & agenda controls</h2>
        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
          State: <strong className="capitalize text-foreground">{data.phase.replaceAll("_", " ")}</strong>. Opening a stage closes every other agenda. Changes reach the portal within seconds.
        </p>
        <div className="my-3 flex flex-wrap gap-2">
          {data.phase === "waiting" && (
            <Button disabled={pending} onClick={() => lifecycle("start")}>Start meeting</Button>
          )}
          {live &&
            (!confirmEnd ? (
              <Button variant="destructive" disabled={pending} onClick={() => setConfirmEnd(true)}>
                End meeting
              </Button>
            ) : (
              <>
                <span className="self-center text-xs">Close all controls and end this meeting?</span>
                <Button variant="destructive" disabled={pending} onClick={() => lifecycle("end")}>Confirm end</Button>
                <Button variant="ghost" onClick={() => setConfirmEnd(false)}>Cancel</Button>
              </>
            ))}
        </div>
      </div>

      <ol className="space-y-3">
        {meeting.agenda.map((a) => (
          <li key={a.id} className="rounded-md border border-border p-3">
            <label htmlFor={`stage-${a.id}`} className="mb-2 block text-xs font-medium leading-5">
              {a.order}. {a.title}
            </label>
            <NativeSelect
              id={`stage-${a.id}`}
              value={data.agenda.find((s) => s.agendaId === a.id)?.stage ?? "closed"}
              disabled={pending || !live}
              onChange={(e) => stage(a.id, e.target.value)}
            >
              {stages.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </NativeSelect>
          </li>
        ))}
      </ol>
      {!live && (
        <p className="text-xs text-muted-foreground">
          Start the meeting to enable proposal, seconding, poll demand and voting stages.
        </p>
      )}

      {/* Zoom & Live Stream Connector */}
      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Video className="h-3.5 w-3.5 text-brand" />
          Zoom & live broadcast feed
        </h3>
        <Field label="Provider" htmlFor="ctrl-provider">
          <NativeSelect
            id="ctrl-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as "irm_live" | "zoom" | "webex" | "none")}
          >
            <option value="zoom">Zoom (Embedded Web Client + App Launch)</option>
            <option value="irm_live">YouTube / Custom Stream Embed</option>
            <option value="webex">Cisco Webex</option>
            <option value="none">No video stream</option>
          </NativeSelect>
        </Field>
        {provider !== "none" && (
          <>
            <Field label={provider === "zoom" ? "Zoom Join URL" : "Stream Embed / Watch URL"} htmlFor="ctrl-url">
              <Input
                id="ctrl-url"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder={provider === "zoom" ? "https://us06web.zoom.us/j/..." : "https://youtube.com/live/..."}
                className="h-8 text-xs font-mono"
              />
            </Field>
            {provider === "zoom" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Zoom Meeting ID" htmlFor="ctrl-zid">
                  <Input
                    id="ctrl-zid"
                    value={zoomMeetingId}
                    onChange={(e) => setZoomMeetingId(e.target.value)}
                    placeholder="842 9104 2219"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
                <Field label="Passcode" htmlFor="ctrl-zpwd">
                  <Input
                    id="ctrl-zpwd"
                    value={zoomPasscode}
                    onChange={(e) => setZoomPasscode(e.target.value)}
                    placeholder="AGM2026"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
              </div>
            )}
          </>
        )}
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={saveBroadcast} className="w-full">
          Update broadcast link in shareholder room
        </Button>
      </div>
    </section>
  );
}
