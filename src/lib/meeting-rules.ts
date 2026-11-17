import type { AgendaStage, Meeting, MeetingPhase } from "./types";

export const AGENDA_STAGES: AgendaStage[] = ["closed", "proposal", "seconding", "poll", "voting"];
export function meetingPhase(meeting: Pick<Meeting, "status" | "agenda">): MeetingPhase {
  if (["completed", "archived"].includes(meeting.status)) return "ended";
  if (!["live", "voting_open"].includes(meeting.status)) return "waiting";
  return meeting.agenda.some((a) => a.stage === "voting") ? "voting_open" : "live";
}
export function agendaOpen(meeting: Meeting, agendaId: string, stage: AgendaStage) {
  return ["live", "voting_open"].includes(meeting.status) && meeting.activeAgendaId === agendaId && meeting.agenda.some((a) => a.id === agendaId && a.stage === stage);
}
export function meetingDeadlines(meeting: Meeting, now = new Date()) {
  return [
    { kind: "registration_open" as const, at: meeting.registrationOpens },
    { kind: "registration_close" as const, at: meeting.registrationCloses },
    { kind: "proxy" as const, at: meeting.proxiesAllowed ? meeting.proxyDeadline : undefined },
  ].filter((d): d is { kind: "registration_open" | "registration_close" | "proxy"; at: string } => !!d.at)
    .map((d) => ({ ...d, passed: new Date(d.at).getTime() <= now.getTime() }));
}
