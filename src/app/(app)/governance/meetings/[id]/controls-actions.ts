"use server";

import { requirePermission } from "@/lib/require-permission";
import { notFound } from "next/navigation";
import { getMeeting, setMeetingSwitch, setAgendaStage, setMeetingLifecycle } from "@/lib/demo-store";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Chair/admin controls for the demo meeting room. Company-scoped and
 * permission-checked exactly like every other privileged action.
 */
export async function setSwitchAction(
  meetingId: string,
  key: "votingOpen" | "pollDemandOpen",
  value: boolean,
) {
  const session = await requirePermission("meetings.control");
  const meeting = getMeeting(meetingId);
  if (!meeting) notFound();
  if (
    session.role !== "Platform Super Admin" &&
    !session.companyIds.includes(meeting.companyId)
  ) {
    notFound();
  }
  if (!setMeetingSwitch(meetingId, key, value, session.email)) return { ok: false as const, error: "Invalid meeting control" };
  revalidatePath("/portal", "layout");
  return { ok: true as const };
}

async function chairMeeting(meetingId: string) {
  const session = await requirePermission("meetings.control"); const meeting = getMeeting(meetingId);
  if (!meeting || (session.role !== "Platform Super Admin" && !session.companyIds.includes(meeting.companyId))) notFound();
  return { meeting, session };
}
export async function setMeetingLifecycleAction(meetingId: string, transition: "start" | "end") {
  const { session } = await chairMeeting(meetingId);
  if (!setMeetingLifecycle(meetingId, transition, session.email)) return { ok: false as const, error: "This meeting transition is not available" };
  revalidatePath(`/governance/meetings/${meetingId}`); revalidatePath("/portal", "layout");
  return { ok: true as const };
}
export async function setAgendaStageAction(meetingId: string, agendaId: string, stage: string) {
  const { meeting, session } = await chairMeeting(meetingId);
  if (!meeting.agenda.some((a) => a.id === agendaId)) notFound();
  const parsed = z.enum(["closed", "proposal", "seconding", "poll", "voting"]).safeParse(stage);
  if (!parsed.success || !setAgendaStage(meetingId, agendaId, parsed.data, session.email)) return { ok: false as const, error: "Start the meeting before opening an agenda stage" };
  revalidatePath(`/governance/meetings/${meetingId}`); revalidatePath("/portal", "layout");
  return { ok: true as const };
}
