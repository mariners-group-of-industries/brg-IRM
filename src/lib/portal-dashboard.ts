import "server-only";
import {
  demoStore, getCompany, getParticipantById, hasVoted, isPublishedMeeting,
  isRegistered, listMeetings, participantRights,
} from "./demo-store";
import { registry } from "./shareholder-store";
import { holdingBalance, maskValue } from "./shareholders";
import type { Meeting } from "./types";
import { meetingDeadlines, meetingPhase } from "./meeting-rules";

export type RegistrationAvailability = "available" | "not_open" | "closed" | "ineligible" | "completed" | "registered";
export interface PortalMeetingSummary {
  meeting: Meeting;
  registered: boolean;
  canEnter: boolean;
  availability: RegistrationAvailability;
  shares: number;
  votingRights: number;
  votesCast: number;
  phase: ReturnType<typeof meetingPhase>;
  deadlines: ReturnType<typeof meetingDeadlines>;
}
export interface PortalTimelineItem {
  id: string;
  title: string;
  detail: string;
  at: string;
  href: string;
  kind: "registration" | "attendance" | "ballot" | "question" | "authorization";
}

/** Server callers supply the authenticated participant ID, never browser-supplied company/holder IDs. */
export function getPortalDashboard(participantId: string, now = new Date()) {
  const participant = getParticipantById(participantId);
  if (!participant) return null;
  const company = getCompany(participant.companyId);
  const holder = registry.holders.find((h) => h.companyId === participant.companyId && h.boId === participant.boId && h.status === "active");
  if (!company || !holder) return null;

  const sameAccount = (id: string) => {
    const actor = getParticipantById(id);
    return actor?.companyId === company.id && actor.boId === participant.boId;
  };
  const meetings: PortalMeetingSummary[] = listMeetings(company.id)
    .filter((m) => isPublishedMeeting(m) && (participant.kind === "individual" || participantRights(m.id, participantId)))
    .map((meeting) => {
      const rights = participantRights(meeting.id, participantId);
      const registered = isRegistered(meeting.id, participantId);
      let availability: RegistrationAvailability = "available";
      if (meeting.status === "completed") availability = "completed";
      else if (!rights) availability = "ineligible";
      else if (registered) availability = "registered";
      else if (meeting.registrationOpens && now < new Date(meeting.registrationOpens)) availability = "not_open";
      else if (meeting.registrationCloses && now > new Date(meeting.registrationCloses)) availability = "closed";
      return {
        meeting, registered, availability,
        canEnter: registered && !!rights && meetingPhase(meeting) !== "ended",
        phase: meetingPhase(meeting), deadlines: meetingDeadlines(meeting, now),
        shares: rights?.shares ?? 0,
        votingRights: rights?.votingRights ?? 0,
        votesCast: meeting.agenda.filter((a) => hasVoted(meeting.id, a.id, participantId)).length,
      };
    });

  const visibleIds = new Set(meetings.map((m) => m.meeting.id));
  const titleFor = (id: string) => meetings.find((m) => m.meeting.id === id)!.meeting.title;
  const upcoming = meetings.filter((m) => m.meeting.status !== "completed");
  const featured = upcoming.find((m) => ["live", "voting_open"].includes(m.meeting.status)) ?? upcoming[0] ?? null;
  const registrations = demoStore.portal.registrations.filter((r) => visibleIds.has(r.meetingId) && sameAccount(r.participantId));
  const attendance = demoStore.portal.attendance.filter((a) => visibleIds.has(a.meetingId) && sameAccount(a.participantId));
  // A delegate's personal receipts/questions must not disclose another actor's private submissions.
  const votes = demoStore.portal.votes.filter((v) => visibleIds.has(v.meetingId) && v.participantId === participantId);
  const questions = demoStore.portal.questions.filter((q) => visibleIds.has(q.meetingId) && q.participantId === participantId);
  const authorizations = registry.authorizations.filter((a) => a.companyId === company.id && a.holderId === holder.id && (participant.kind === "individual" || a.participantId === participantId));
  const lastChange = (entity: string, fallback: string) => registry.audit.find((entry) => entry.companyId === company.id && entry.entity === entity)?.at ?? fallback;

  const timeline: PortalTimelineItem[] = [
    ...registrations.map((r) => ({ id: `registration_${r.meetingId}`, title: "Meeting registration confirmed", detail: titleFor(r.meetingId), at: r.at, href: `/portal/meetings/${r.meetingId}`, kind: "registration" as const })),
    ...attendance.map((a) => ({ id: `attendance_${a.meetingId}`, title: "Joined meeting room", detail: titleFor(a.meetingId), at: a.at, href: `/portal/meetings/${a.meetingId}`, kind: "attendance" as const })),
    ...votes.map((v) => ({ id: v.id, title: "Ballot receipt issued", detail: `${titleFor(v.meetingId)} · ${v.reference}`, at: v.at, href: "/portal/account#receipts", kind: "ballot" as const })),
    ...questions.map((q) => ({ id: q.id, title: q.status === "approved" ? "Question approved" : q.status === "dismissed" ? "Question reviewed — dismissed" : "Question awaiting moderation", detail: titleFor(q.meetingId), at: lastChange(`question:${q.id}`, q.at), href: "/portal/account#questions", kind: "question" as const })),
    ...authorizations.filter((a) => visibleIds.has(a.meetingId)).map((a) => ({ id: a.id, title: `Appointment ${a.status}`, detail: `${a.name} · ${titleFor(a.meetingId)}`, at: lastChange(`authorization:${a.id}`, a.at), href: "/portal/account#appointments", kind: "authorization" as const })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);

  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((p) => [p.type, p.value]));
  const asOf = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const holdings = company.shareClasses.map((shareClass) => ({ shareClass, shares: holdingBalance(registry.entries, holder.id, shareClass, asOf) }));
  return {
    company,
    identity: { name: participant.name, subjectName: holder.name, kind: participant.kind, maskedBoId: maskValue(holder.boId) },
    holdings,
    totalShares: holdings.reduce((total, h) => total + h.shares, 0),
    meetings, upcoming, featured,
    past: meetings.filter((m) => m.meeting.status === "completed"),
    registrationCount: registrations.length,
    receiptCount: votes.length,
    pendingQuestions: questions.filter((q) => q.status === "pending").length,
    approvedQuestions: questions.filter((q) => q.status === "approved").length,
    questionCount: questions.length,
    approvedAppointments: authorizations.filter((a) => a.status === "approved").length,
    pendingAppointments: authorizations.filter((a) => a.status === "pending").length,
    timeline,
    receipts: votes.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3).map((v) => ({ reference: v.reference, at: v.at, meetingTitle: titleFor(v.meetingId) })),
  };
}

