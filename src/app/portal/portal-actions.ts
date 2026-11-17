"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import {
  createPortalSession,
  clearPortalSession,
  getPortalSession,
} from "@/lib/portal-session";
import {
  castVote,
  demandPoll,
  findParticipant,
  getMeeting,
  isRegistered,
  proposeItem,
  registerParticipant,
  secondItem,
  submitTextQuestion,
  isPublishedMeeting,
  participantRights,
  canParticipate,
  recordAttendance,
} from "@/lib/demo-store";
import type { ParticipantKind } from "@/lib/types";
import { agendaOpen } from "@/lib/meeting-rules";

const identitySchema = z.object({
  kind: z.enum(["individual", "corporate", "proxy"]),
  boId: z.string().trim().min(6, "Enter your BO ID / folio ID").max(32),
  name: z.string().trim().min(3, "Enter the name exactly as on the register").max(120),
  /** Corporate: company name · Proxy: grantor's name (register check). */
  holderName: z.string().trim().max(160).optional().or(z.literal("")),
}).refine((v) => v.kind === "individual" || !!v.holderName?.trim(), { message: "Enter the legal holder name", path: ["holderName"] });

const GENERIC_IDENTITY_ERROR =
  "No matching register entry found. Check the BO ID / folio ID and name, or contact the company secretary.";

const normalizeLoose = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\./g, "").replace(/[^\p{L}\p{N} ]/gu, "");

function matchesHolder(match: { subjectName: string }, holderName?: string) {
  if (!holderName) return true; // holderName optional for individuals
  return normalizeLoose(match.subjectName) === normalizeLoose(holderName);
}

/** Step 1 — check the identity against the register. */
export async function verifyIdentityAction(input: {
  kind: ParticipantKind;
  boId: string;
  name: string;
  holderName?: string;
}) {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { kind, boId, name, holderName } = parsed.data;
  const match = findParticipant(kind, boId, name);
  if (!match || !matchesHolder(match, holderName)) {
    return { ok: false as const, error: GENERIC_IDENTITY_ERROR };
  }
  return {
    ok: true as const,
    mobile: match.mobile,
    subjectName: match.subjectName,
    eligibleShares: match.eligibleShares,
    kind: match.kind as ParticipantKind,
  };
}

/** Step 2 — verify the OTP and establish the portal session. */
export async function signInWithOtpAction(input: {
  kind: ParticipantKind;
  boId: string;
  name: string;
  holderName?: string;
  otp: string;
}) {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { kind, boId, name, holderName } = parsed.data;
  const match = findParticipant(kind, boId, name);
  if (!match || !matchesHolder(match, holderName)) {
    return { ok: false as const, error: GENERIC_IDENTITY_ERROR };
  }
  if (typeof input.otp !== "string" || input.otp.trim() !== match.otp) {
    return { ok: false as const, error: "Incorrect code. Check the SMS/email and try again." };
  }
  await createPortalSession({
    participantId: match.id,
    kind: match.kind,
    companyId: match.companyId,
    name: match.name,
    subjectName: match.subjectName,
    boId: match.boId,
    eligibleShares: match.eligibleShares,
    votingRights: match.votingRights,
  });
  return { ok: true as const };
}

export async function portalLogoutAction() {
  await clearPortalSession();
}

/** Meeting must exist and belong to the participant's company. */
async function authorizedMeeting(meetingId: string, participation = false) {
  const session = await getPortalSession();
  if (!session) return { ok: false as const, error: "Not signed in" };
  const meeting = getMeeting(meetingId);
  if (!meeting || meeting.companyId !== session.companyId || !isPublishedMeeting(meeting)) notFound();
  if (!participantRights(meetingId, session.participantId)) return { ok: false as const, error: "No current authorization or eligible holding for this meeting" };
  if (participation && !canParticipate(meetingId, session.participantId)) return { ok: false as const, error: "Register first. Participation is available when the meeting room is open." };
  return { ok: true as const, session, meeting };
}

export async function registerForMeetingAction(meetingId: string) {
  const gate = await authorizedMeeting(meetingId);
  if (!gate.ok) return gate;
  if (["completed", "archived"].includes(gate.meeting.status)) {
    return { ok: false as const, error: "Registration is closed for this meeting" };
  }
  const result = registerParticipant(gate.meeting.id, gate.session.participantId);
  if ("error" in result) return { ok: false as const, error: result.error === "registration_closed" ? "Registration is outside the configured opening and closing window" : "Could not register" };
  revalidatePath("/portal", "layout");
  return { ok: true as const, already: result.already, at: result.at };
}

export async function attendMeetingAction(meetingId: string) {
  const gate = await authorizedMeeting(meetingId, true);
  if (!gate.ok) return gate;
  const ok = recordAttendance(meetingId, gate.session.participantId);
  if (ok) revalidatePath("/portal", "layout");
  return { ok };
}

export async function checkRegistrationAction(meetingId: string) {
  const gate = await authorizedMeeting(meetingId);
  if (!gate.ok) return gate;
  return {
    ok: true as const,
    registered: isRegistered(gate.meeting.id, gate.session.participantId),
  };
}

export async function castVoteAction(
  meetingId: string,
  agendaId: string,
  choice: "for" | "against" | "abstain",
) {
  const gate = await authorizedMeeting(meetingId, true);
  if (!gate.ok) return gate;
  if (!agendaOpen(gate.meeting, agendaId, "voting")) {
    return { ok: false as const, error: "Voting is closed for this agenda. Wait for the chair." };
  }
  const agenda = gate.meeting.agenda.find((item) => item.id === agendaId);
  if (!agenda) return { ok: false as const, error: "Agenda item not found" };
  const result = castVote(gate.meeting.id, agendaId, gate.session.participantId, choice);
  if (!result.ok) {
    return { ok: false as const, error: result.error === "already_voted" ? "You have already voted on this agenda item." : "Could not record the vote" };
  }
  revalidatePath("/portal", "layout");
  return { ok: true as const, reference: result.reference, weight: result.weight };
}

export async function proposeAction(meetingId: string, agendaId: string) {
  const gate = await authorizedMeeting(meetingId, true);
  if (!gate.ok) return gate;
  const agenda = gate.meeting.agenda.find((item) => item.id === agendaId);
  if (!agenda) return { ok: false as const, error: "Agenda item not found" };
  const result = proposeItem(gate.meeting.id, agendaId, {
    participantId: gate.session.participantId,
    name: gate.session.name,
    boId: gate.session.boId.slice(-4).padStart(4, "…"),
  });
  if (result.status === "unavailable") return { ok: false as const, error: "Proposal is closed for this agenda. Wait for the chair." };
  return { ok: true as const, ...result };
}

export async function secondAction(meetingId: string, agendaId: string) {
  const gate = await authorizedMeeting(meetingId, true);
  if (!gate.ok) return gate;
  const agenda = gate.meeting.agenda.find((item) => item.id === agendaId);
  if (!agenda) return { ok: false as const, error: "Agenda item not found" };
  const result = secondItem(gate.meeting.id, agendaId, {
    participantId: gate.session.participantId,
    name: gate.session.name,
    boId: gate.session.boId.slice(-4).padStart(4, "…"),
  });
  if (result.status === "unavailable") return { ok: false as const, error: "Seconding is unavailable. Wait for the chair and a proposal from another holder." };
  return { ok: true as const, ...result };
}

export async function demandPollAction(meetingId: string, agendaId: string) {
  const gate = await authorizedMeeting(meetingId, true);
  if (!gate.ok) return gate;
  if (!agendaOpen(gate.meeting, agendaId, "poll")) {
    return { ok: false as const, error: "Poll demand is closed for this agenda. Wait for the chair." };
  }
  const agenda = gate.meeting.agenda.find((item) => item.id === agendaId);
  if (!agenda) return { ok: false as const, error: "Agenda item not found" };
  const result = demandPoll(gate.meeting.id, agendaId, gate.session.participantId);
  if (!result.ok) {
    return { ok: false as const, error: result.error === "already_demanded" ? "You have already demanded a poll for this item." : "Could not record the demand", count: ("count" in result ? result.count : 0) as number };
  }
  return { ok: true as const, count: result.count };
}

export async function submitTextQuestionAction(meetingId: string, body: string) {
  const gate = await authorizedMeeting(meetingId, true);
  if (!gate.ok) return gate;
  const trimmed = body.trim();
  if (trimmed.length < 3) return { ok: false as const, error: "Write at least a few words" };
  if (trimmed.length > 500) return { ok: false as const, error: "Keep it under 500 characters" };
  const result = submitTextQuestion(gate.meeting.id, gate.session.participantId, trimmed);
  if (!result.ok) return { ok: false as const, error: "Could not submit the question" };
  revalidatePath("/portal", "layout");
  return { ok: true as const };
}
