/**
 * Demo runtime store (development mode only).
 *
 * Seeded from demo-data. Meetings created through the UI are appended to an
 * in-memory global so every screen sees them. Nothing is written to disk;
 * data resets on server restart. This is deliberately isolated from the
 * future Prisma repositories.
 */
import {
  DEMO_ACTIVITY,
  DEMO_APPROVALS,
  DEMO_AUDIT,
  DEMO_COMPANIES,
  DEMO_MEETINGS,
  DEMO_NOTIFICATIONS,
  DEMO_PARTICIPANTS,
  DEMO_TURNOUT,
} from "./demo-data";
import type {
  ActivityItem,
  Company,
  Meeting,
  MeetingQuestionRecord,
  ParticipantKind,
  PortalDemand,
  PortalVote,
  PortalNotification,
  MeetingDocument,
  AgendaStage,
} from "./types";
import { AGENDA_STAGES, agendaOpen, meetingPhase } from "./meeting-rules";
import { auditRegistry, registry } from "./shareholder-store";
import { holdingBalance } from "./shareholders";

interface AudioBlob {
  buffer: Buffer;
  mimeType: string;
  durationSec: number;
}

/** Seeded tallies so the demo room looks like a live meeting, not a void. */
const SEED_BALLOTS: Record<string, Record<string, { for: number; against: number; abstain: number }>> = {
  mtg_agm_2026: {
    ag1: { for: 182, against: 9, abstain: 14 },
    ag2: { for: 171, against: 22, abstain: 12 },
    ag3: { for: 196, against: 3, abstain: 6 },
    ag4: { for: 154, against: 31, abstain: 20 },
    ag5: { for: 138, against: 44, abstain: 23 },
  },
};
const SEED_DEMANDS: Record<string, Record<string, number>> = {
  mtg_agm_2026: { ag5: 3 },
};
const SEED_PROPOSED: Record<string, { agendaId: string; name: string; boId: string }[]> = {
  mtg_agm_2026: [
    { agendaId: "ag1", name: "Farhana Akter", boId: "…2345" },
    { agendaId: "ag2", name: "Farhana Akter", boId: "…2345" },
  ],
};
const SEED_SECONDED: Record<string, { agendaId: string; name: string; boId: string }[]> = {
  mtg_agm_2026: [{ agendaId: "ag1", name: "Rakibul Hasan", boId: "…7821" }],
};
const SEED_QUESTIONS: MeetingQuestionRecord[] = [
  { id: "q_seed_1", meetingId: "mtg_agm_2026", participantId: "p_farhana", participantName: "Farhana Akter", boId: "…2345", kind: "text", body: "Will the auditor comment on the related-party pricing review?", status: "approved", at: "2026-11-17T02:30:00.000Z" },
  { id: "q_seed_2", meetingId: "mtg_agm_2026", participantId: "p_rashedul", participantName: "Rashedul Islam", boId: "…1234", kind: "text", body: "Dividend tax হার কি এবারো 10% থাকবে?", status: "approved", at: "2026-11-17T02:41:00.000Z" },
  { id: "q_seed_3", meetingId: "mtg_agm_2026", participantId: "p_farhana", participantName: "Farhana Akter", boId: "…2345", kind: "text", body: "Please confirm the record date snapshot methodology.", status: "pending", at: "2026-11-17T03:05:00.000Z" },
];

interface PortalState {
  registrations: { meetingId: string; participantId: string; at: string; shares?: number; votingRights?: number }[];
  attendance: { meetingId: string; participantId: string; at: string }[];
  votes: PortalVote[];
  demands: PortalDemand[];
  proposals: { meetingId: string; agendaId: string; participantId: string; name: string; boId: string; at: string }[];
  seconds: { meetingId: string; agendaId: string; participantId: string; name: string; boId: string; at: string }[];
  questions: MeetingQuestionRecord[];
  audio: Map<string, AudioBlob>;
}

interface DemoStore {
  companies: Company[];
  meetings: Meeting[];
  activity: ActivityItem[];
  portal: PortalState;
  portalNotifications: PortalNotification[];
  documents: MeetingDocument[];
}

const globalStore = globalThis as unknown as { __irmDemo?: DemoStore };

function seed(): DemoStore {
  return {
    companies: structuredClone(DEMO_COMPANIES),
    meetings: structuredClone(DEMO_MEETINGS),
    activity: structuredClone(DEMO_ACTIVITY),
    portalNotifications: [],
    documents: [],
    portal: {
      registrations: [],
      attendance: [],
      votes: [],
      demands: [],
      proposals: [],
      seconds: [],
      questions: structuredClone(SEED_QUESTIONS),
      audio: new Map(),
    },
  };
}

export const demoStore: DemoStore = (globalStore.__irmDemo ??= seed());
// Keep an existing demo session usable when development hot reload adds fields.
demoStore.portal.attendance ??= [];
demoStore.portalNotifications ??= [];
demoStore.documents ??= [];
for (const template of DEMO_MEETINGS) {
  const existing = demoStore.meetings.find((m) => m.id === template.id);
  if (!existing) continue;
  existing.proxiesAllowed ??= template.proxiesAllowed;
  existing.corporateRepresentatives ??= template.corporateRepresentatives;
  existing.proxyLimitPerHolder ??= template.proxyLimitPerHolder;
  existing.proxyDeadline ??= template.proxyDeadline;
  existing.registrationOpens ??= template.registrationOpens;
  existing.registrationCloses ??= template.registrationCloses;
  existing.shareClassId ??= template.shareClassId;
  existing.votingEntitlement ??= template.votingEntitlement;
}

/* --- reads ---------------------------------------------------------- */

export function listCompanies(): Company[] {
  return demoStore.companies;
}

export function getCompany(id: string): Company | undefined {
  return demoStore.companies.find((c) => c.id === id);
}

export function listMeetings(companyId?: string): Meeting[] {
  const meetings = companyId
    ? demoStore.meetings.filter((m) => m.companyId === companyId)
    : demoStore.meetings;
  return [...meetings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function getMeeting(id: string): Meeting | undefined {
  return demoStore.meetings.find((m) => m.id === id);
}

export function listActivity(): ActivityItem[] {
  return [...demoStore.activity].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

export function listApprovals() {
  return DEMO_APPROVALS;
}

export function listAudit() {
  return [...registry.audit, ...DEMO_AUDIT].sort((a, b) => b.at.localeCompare(a.at));
}

export function listNotifications() {
  return DEMO_NOTIFICATIONS;
}

export function turnoverSeries() {
  return DEMO_TURNOUT;
}

/* --- writes ---------------------------------------------------------- */

export function createMeeting(
  input: Omit<Meeting, "id" | "registered" | "attended" | "noticePublished" | "agenda"> & {
    agenda: Meeting["agenda"];
  },
): Meeting {
  const meeting: Meeting = {
    ...input,
    id: `mtg_${Date.now().toString(36)}`,
    registered: 0,
    attended: 0,
    noticePublished: false,
  };
  demoStore.meetings.push(meeting);
  demoStore.activity.unshift({
    id: `ac_${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    actor: "You",
    action: "Created draft meeting",
    target: `${meeting.title} — ${meeting.financialYear}`,
    tone: "info",
  });
  return meeting;
}

/* --- shareholder portal (Phase 5 demo) ------------------------------- */

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\./g, "");

export function findParticipant(
  kind: ParticipantKind,
  boId: string,
  name: string,
) {
  const target = normalize(name);
  return DEMO_PARTICIPANTS.map((p) => getParticipantById(p.id)).find(
    (p) => p && p.kind === kind && p.boId.trim() === boId.trim() && normalize(p.name) === target,
  );
}

export function getParticipantById(id: string) {
  const participant = DEMO_PARTICIPANTS.find((p) => p.id === id);
  if (!participant) return undefined;
  const holder = registry.holders.find((h) => h.companyId === participant.companyId && h.boId === participant.boId && h.status === "active");
  if (!holder) return undefined;
  const shares = holdingBalance(registry.entries, holder.id);
  return { ...participant, name: participant.kind === "individual" ? holder.name : participant.name, subjectName: holder.name, eligibleShares: shares, votingRights: participant.eligibleShares ? shares * (participant.votingRights / participant.eligibleShares) : 0 };
}

export function isPublishedMeeting(meeting: Meeting) {
  return !["draft", "notice_pending", "archived"].includes(meeting.status) && meeting.noticePublished;
}
function sameAccount(a: string, b: string) {
  const first = DEMO_PARTICIPANTS.find((p) => p.id === a);
  const second = DEMO_PARTICIPANTS.find((p) => p.id === b);
  return !!first && !!second && first.companyId === second.companyId && first.boId === second.boId;
}
export function participantRights(meetingId: string, participantId: string) {
  const participant = getParticipantById(participantId); const meeting = getMeeting(meetingId);
  if (!participant || !meeting || participant.companyId !== meeting.companyId || !isPublishedMeeting(meeting)) return null;
  // Class-based/weighted rules require explicit entitlement data; do not silently
  // substitute one-share/one-vote when that configuration has not been wired.
  if (meeting.votingEntitlement && meeting.votingEntitlement !== "one_share_one_vote") return null;
  if ((participant.kind === "proxy" && !meeting.proxiesAllowed) || (participant.kind === "corporate" && !meeting.corporateRepresentatives)) return null;
  const holder = registry.holders.find((h) => h.companyId === participant.companyId && h.boId === participant.boId)!;
  if (participant.kind !== "individual" && !registry.authorizations.some((a) => a.holderId === holder.id && a.meetingId === meetingId && a.status === "approved" && a.kind === participant.kind && a.name === participant.name && a.participantId === participant.id)) return null;
  const registration = demoStore.portal.registrations.find((r) => r.meetingId === meetingId && sameAccount(r.participantId, participantId));
  const shares = registration?.shares ?? holdingBalance(registry.entries, holder.id, meeting.shareClassId, meeting.recordDate.slice(0, 10));
  const seeded = DEMO_PARTICIPANTS.find((p) => p.id === participantId)!;
  const votingRights = registration?.votingRights ?? shares * (seeded.votingRights / seeded.eligibleShares);
  return shares > 0 ? { shares, votingRights } : null;
}
export function canParticipate(meetingId: string, participantId: string) {
  const meeting = getMeeting(meetingId);
  return !!meeting && ["live", "voting_open"].includes(meeting.status) && !!participantRights(meetingId, participantId) && isRegistered(meetingId, participantId);
}
export function canViewRoom(meetingId: string, participantId: string) {
  return !!participantRights(meetingId, participantId) && isRegistered(meetingId, participantId);
}
export function recordAttendance(meetingId: string, participantId: string) {
  if (!canParticipate(meetingId, participantId)) return false;
  if (demoStore.portal.attendance.some((a) => a.meetingId === meetingId && sameAccount(a.participantId, participantId))) return true;
  demoStore.portal.attendance.push({ meetingId, participantId, at: new Date().toISOString() });
  getMeeting(meetingId)!.attended += 1;
  auditRegistry(registry, `participant:${participantId}`, "meeting.attend", `meeting:${meetingId}`, getMeeting(meetingId)!.companyId);
  pushActivity(getParticipantById(participantId)!.name, "Joined meeting", getMeeting(meetingId)!.title);
  return true;
}

function pushActivity(actor: string, action: string, target: string, tone: ActivityItem["tone"] = "info") {
  demoStore.activity.unshift({
    id: `ac_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`,
    at: new Date().toISOString(),
    actor,
    action,
    target,
    tone,
  });
}

export function isRegistered(meetingId: string, participantId: string) {
  return demoStore.portal.registrations.some(
    (r) => r.meetingId === meetingId && sameAccount(r.participantId, participantId),
  );
}

export function registerParticipant(meetingId: string, participantId: string) {
  const existing = demoStore.portal.registrations.find(
    (r) => r.meetingId === meetingId && sameAccount(r.participantId, participantId),
  );
  if (existing) return { already: true as const, at: existing.at };
  const meeting = getMeeting(meetingId);
  const participant = getParticipantById(participantId);
  const rights = participantRights(meetingId, participantId);
  if (!meeting || !participant || !rights || ["completed", "archived"].includes(meeting.status)) return { already: false as const, error: "not_found" as const };
  const now = new Date();
  if ((meeting.registrationOpens && now < new Date(meeting.registrationOpens)) || (meeting.registrationCloses && now > new Date(meeting.registrationCloses))) return { already: false as const, error: "registration_closed" as const };
  const at = new Date().toISOString();
  demoStore.portal.registrations.push({ meetingId, participantId, at, shares: rights.shares, votingRights: rights.votingRights });
  meeting.registered += 1;
  notifyParticipant(participantId, meetingId, "registration", "Registration confirmed", "Your meeting registration is confirmed.");
  auditRegistry(registry, `participant:${participantId}`, "meeting.register", `meeting:${meetingId}`, meeting.companyId);
  pushActivity(
    `${participant.name} (${participant.kind === "proxy" ? "Proxy" : participant.kind === "corporate" ? "Corporate rep" : "Shareholder"})`,
    "Registered for",
    meeting.title,
    "success",
  );
  return { already: false as const, at };
}

export function hasVoted(meetingId: string, agendaId: string, participantId: string) {
  return demoStore.portal.votes.some(
    (v) => v.meetingId === meetingId && v.agendaId === agendaId && sameAccount(v.participantId, participantId),
  );
}

export function castVote(
  meetingId: string,
  agendaId: string,
  participantId: string,
  choice: PortalVote["choice"],
) {
  const meeting = getMeeting(meetingId);
  if (!canParticipate(meetingId, participantId) || !meeting || !agendaOpen(meeting, agendaId, "voting") || !["for", "against", "abstain"].includes(choice)) return { ok: false as const, error: "not_found" as const };
  if (hasVoted(meetingId, agendaId, participantId)) {
    return { ok: false as const, error: "already_voted" as const };
  }
  const participant = getParticipantById(participantId);
  if (!participant) return { ok: false as const, error: "not_found" as const };
  const weight = participantRights(meetingId, participantId)!.votingRights;
  const reference = `VTX-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0")}`;
  demoStore.portal.votes.push({
    id: `vote_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`,
    meetingId,
    agendaId,
    participantId,
    choice,
    weight,
    reference,
    at: new Date().toISOString(),
  });
  pushActivity(
    participant.name,
    `Submitted ballot on agenda ${agendaId} of`,
    getMeeting(meetingId)?.title ?? meetingId,
    "info",
  );
  auditRegistry(registry, `participant:${participantId}`, "ballot.submit", `receipt:${reference}`, participant.companyId);
  return { ok: true as const, reference, weight };
}

type Actor = { participantId: string; name: string; boId: string };

export function proposeItem(meetingId: string, agendaId: string, actor: Actor) {
  if (!canParticipate(meetingId, actor.participantId) || !agendaOpen(getMeeting(meetingId)!, agendaId, "proposal")) return { status: "unavailable" as const, name: "", boId: "" };
  return firstActor(demoStore.portal.proposals, meetingId, agendaId, actor, SEED_PROPOSED[meetingId]?.filter((s) => s.agendaId === agendaId));
}
export function secondItem(meetingId: string, agendaId: string, actor: Actor) {
  if (!canParticipate(meetingId, actor.participantId) || !agendaOpen(getMeeting(meetingId)!, agendaId, "seconding")) return { status: "unavailable" as const, name: "", boId: "" };
  const proposal = demoStore.portal.proposals.find((p) => p.meetingId === meetingId && p.agendaId === agendaId);
  const seed = SEED_PROPOSED[meetingId]?.find((p) => p.agendaId === agendaId);
  if ((!proposal && !seed) || (proposal && sameAccount(proposal.participantId, actor.participantId)) || (seed && getParticipantById(actor.participantId)?.name === seed.name)) return { status: "unavailable" as const, name: "", boId: "" };
  return firstActor(demoStore.portal.seconds, meetingId, agendaId, actor, SEED_SECONDED[meetingId]?.filter((s) => s.agendaId === agendaId));
}

function firstActor(
  list: { meetingId: string; agendaId: string; participantId: string; name: string; boId: string; at: string }[],
  meetingId: string,
  agendaId: string,
  actor: Actor,
  seeds?: { agendaId: string; name: string; boId: string }[],
) {
  const seed = seeds?.[0];
  const existing = list.find((e) => e.meetingId === meetingId && e.agendaId === agendaId);
  if (existing || seed) {
    const who = existing ? { name: existing.name, boId: existing.boId } : { name: seed!.name, boId: seed!.boId };
    return { status: "already" as const, ...who };
  }
  list.push({ meetingId, agendaId, participantId: actor.participantId, name: actor.name, boId: actor.boId, at: new Date().toISOString() });
  auditRegistry(registry, `participant:${actor.participantId}`, list === demoStore.portal.proposals ? "agenda.propose" : "agenda.second", `meeting:${meetingId}/agenda:${agendaId}`, getMeeting(meetingId)!.companyId);
  pushActivity(actor.name, "Recorded first proposal/second on agenda", `${agendaId} · ${getMeeting(meetingId)?.title ?? meetingId}`, "info");
  return { status: "recorded" as const, name: actor.name, boId: actor.boId };
}

export function demandPoll(meetingId: string, agendaId: string, participantId: string) {
  if (!canParticipate(meetingId, participantId) || !agendaOpen(getMeeting(meetingId)!, agendaId, "poll")) return { ok: false as const, error: "not_found" as const };
  const participant = getParticipantById(participantId);
  if (!participant) return { ok: false as const, error: "not_found" as const };
  const already = demoStore.portal.demands.some(
    (d) => d.meetingId === meetingId && d.agendaId === agendaId && sameAccount(d.participantId, participantId),
  );
  if (already) {
    return { ok: false as const, error: "already_demanded" as const, count: demandCount(meetingId, agendaId) };
  }
  demoStore.portal.demands.push({
    id: `dem_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`,
    meetingId,
    agendaId,
    participantId,
    shares: participantRights(meetingId, participantId)!.votingRights,
    at: new Date().toISOString(),
  });
  auditRegistry(registry, `participant:${participantId}`, "poll.demand", `meeting:${meetingId}/agenda:${agendaId}`, participant.companyId);
  return { ok: true as const, count: demandCount(meetingId, agendaId) };
}

function demandCount(meetingId: string, agendaId: string) {
  return (
    (SEED_DEMANDS[meetingId]?.[agendaId] ?? 0) +
    demoStore.portal.demands.filter((d) => d.meetingId === meetingId && d.agendaId === agendaId).length
  );
}

export function submitTextQuestion(meetingId: string, participantId: string, body: string) {
  if (!canParticipate(meetingId, participantId)) return { ok: false as const };
  const participant = getParticipantById(participantId);
  if (!participant) return { ok: false as const, error: "not_found" as const };
  demoStore.portal.questions.push({
    id: `q_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`,
    meetingId,
    participantId,
    participantName: participant.name,
    boId: participant.boId.slice(-4).padStart(4, "…"),
    kind: "text",
    body: body.trim(),
    status: "pending",
    at: new Date().toISOString(),
  });
  auditRegistry(registry, `participant:${participantId}`, "question.submit.text", `meeting:${meetingId}`, participant.companyId);
  return { ok: true as const };
}

export function attachAudioQuestion(
  meetingId: string,
  participantId: string,
  audio: AudioBlob,
) {
  if (!canParticipate(meetingId, participantId)) return { ok: false as const };
  const participant = getParticipantById(participantId);
  if (!participant) return { ok: false as const, error: "not_found" as const };
  const audioId = `aud_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
  demoStore.portal.audio.set(audioId, audio);
  demoStore.portal.questions.push({
    id: `q_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4)}`,
    meetingId,
    participantId,
    participantName: participant.name,
    boId: participant.boId.slice(-4).padStart(4, "…"),
    kind: "audio",
    audioId,
    durationSec: audio.durationSec,
    status: "pending",
    at: new Date().toISOString(),
  });
  auditRegistry(registry, `participant:${participantId}`, "question.submit.audio", `meeting:${meetingId}`, participant.companyId);
  return { ok: true as const, audioId };
}

export function getAudio(audioId: string) {
  return demoStore.portal.audio.get(audioId);
}

export function listQuestions(meetingId: string) {
  return demoStore.portal.questions.filter((q) => q.meetingId === meetingId);
}

export function moderateQuestion(id: string, action: "approve" | "dismiss", meetingId: string, actor: string) {
  const question = demoStore.portal.questions.find((q) => q.id === id && q.meetingId === meetingId);
  if (!question) return false;
  const nextStatus=action === "approve" ? "approved" : "dismissed";
  if (question.status===nextStatus) return true;
  question.status = nextStatus;
  notifyParticipant(question.participantId, meetingId, action === "approve" ? "question_approved" : "question_dismissed", action === "approve" ? "Your question was approved" : "Your question was reviewed", action === "approve" ? "Your question is now visible in the meeting room." : "Your question was dismissed by the moderator.");
  auditRegistry(registry, actor, `question.${action}`, `question:${id}`, getMeeting(question.meetingId)!.companyId);
  return true;
}

export interface LiveAgendaState {
  agendaId: string;
  stage: AgendaStage;
  for: number;
  against: number;
  abstain: number;
  votes: number;
  demands: number;
  proposedBy: { name: string; boId: string } | null;
  secondedBy: { name: string; boId: string } | null;
}

export function getLiveState(meetingId: string) {
  const meeting = getMeeting(meetingId);
  const base = SEED_BALLOTS[meetingId] ?? {};
  const agenda: LiveAgendaState[] = (meeting?.agenda ?? []).map((item) => {
    const seedTally = base[item.id] ?? { for: 0, against: 0, abstain: 0 };
    const cast = demoStore.portal.votes.filter((v) => v.meetingId === meetingId && v.agendaId === item.id);
    const tally = { for: seedTally.for, against: seedTally.against, abstain: seedTally.abstain };
    for (const vote of cast) tally[vote.choice] += vote.weight;
    const seedPropose = SEED_PROPOSED[meetingId]?.find((s) => s.agendaId === item.id);
    const seedSecond = SEED_SECONDED[meetingId]?.find((s) => s.agendaId === item.id);
    const myPropose = demoStore.portal.proposals.find((p) => p.meetingId === meetingId && p.agendaId === item.id);
    const mySecond = demoStore.portal.seconds.find((s) => s.meetingId === meetingId && s.agendaId === item.id);
    const proposed = myPropose ?? (seedPropose ? { ...seedPropose, participantId: "", at: "" } : undefined);
    const seconded = mySecond ?? (seedSecond ? { ...seedSecond, participantId: "", at: "" } : undefined);
    return {
      agendaId: item.id,
      stage: item.stage ?? "closed",
      ...tally,
      votes: tally.for + tally.against + tally.abstain,
      demands: demandCount(meetingId, item.id),
      proposedBy: proposed ? { name: proposed.name, boId: proposed.boId } : null,
      secondedBy: seconded ? { name: seconded.name, boId: seconded.boId } : null,
    };
  });
  return {
    meetingId,
    phase: meeting ? meetingPhase(meeting) : "ended",
    status: meeting?.status,
    activeAgendaId: meeting?.activeAgendaId ?? null,
    registered: meeting?.registered ?? 0,
    attended: meeting?.attended ?? 0,
    eligible: meeting?.eligibleShareholders ?? 0,
    questionsApproved: demoStore.portal.questions.filter(
      (q) => q.meetingId === meetingId && q.status === "approved",
    ).length,
    questionsPending: demoStore.portal.questions.filter(
      (q) => q.meetingId === meetingId && q.status === "pending",
    ).length,
    agenda,
    votingOpen: !!meeting && meetingPhase(meeting) === "voting_open",
    pollDemandOpen: !!meeting && meeting.agenda.some((a) => a.stage === "poll") && ["live", "voting_open"].includes(meeting.status),
  };
}

export function setMeetingSwitch(meetingId: string, key: "votingOpen" | "pollDemandOpen", value: boolean, actor = "Demo operator") {
  const meeting = getMeeting(meetingId);
  if (!meeting || !["votingOpen", "pollDemandOpen"].includes(key) || typeof value !== "boolean") return false;
  if (!meeting.activeAgendaId) return false;
  return setAgendaStage(meetingId, meeting.activeAgendaId, value ? key === "votingOpen" ? "voting" : "poll" : "closed", actor);
}

export function myVotes(meetingId: string, participantId: string) {
  const mine: Record<string, { choice: string; reference: string }> = {};
  for (const vote of demoStore.portal.votes) {
    if (vote.meetingId === meetingId && sameAccount(vote.participantId, participantId)) {
      mine[vote.agendaId] = vote.participantId === participantId ? { choice: vote.choice, reference: vote.reference } : { choice: "recorded", reference: "" };
    }
  }
  return mine;
}

export function approvedQuestions(meetingId: string) {
  return demoStore.portal.questions
    .filter((q) => q.meetingId === meetingId && q.status === "approved")
    .map((q) => ({
      id: q.id,
      kind: q.kind,
      body: q.body,
      audioId: q.audioId,
      durationSec: q.durationSec,
      participantName: q.participantName,
      boId: q.boId,
      at: q.at,
    }));
}
export function myPollDemands(meetingId: string, participantId: string) { return demoStore.portal.demands.filter(d=>d.meetingId===meetingId&&sameAccount(d.participantId,participantId)).map(d=>d.agendaId); }

export function findQuestionByAudio(audioId: string) {
  for (const question of demoStore.portal.questions) {
    if (question.audioId === audioId) return question;
  }
  return undefined;
}

export function notifyParticipant(participantId: string, meetingId: string, kind: PortalNotification["kind"], title: string, detail: string, id = crypto.randomUUID()) {
  const participant = getParticipantById(participantId); const meeting = getMeeting(meetingId);
  if (!participant || !meeting || participant.companyId !== meeting.companyId || !isPublishedMeeting(meeting)) return;
  if (participant.kind !== "individual" && !participantRights(meetingId, participantId)) return;
  if (demoStore.portalNotifications.some((n) => n.id === id && n.participantId === participantId)) return;
  demoStore.portalNotifications.unshift({ id, participantId, companyId: meeting.companyId, meetingId, kind, title, detail, at: new Date().toISOString() });
  auditRegistry(registry, "system", "notification.create", `notification:${id}`, meeting.companyId);
}
function notifyMeeting(meetingId: string, kind: PortalNotification["kind"], title: string, detail: string, registeredOnly = false) {
  for (const p of DEMO_PARTICIPANTS) {
    if (participantRights(meetingId, p.id) && (!registeredOnly || isRegistered(meetingId, p.id))) notifyParticipant(p.id, meetingId, kind, title, detail);
  }
}
export function setMeetingLifecycle(meetingId: string, transition: "start" | "end", actor: string) {
  const meeting = getMeeting(meetingId);
  if (!meeting || !isPublishedMeeting(meeting) || !["start", "end"].includes(transition)) return false;
  if (transition === "start" && meetingPhase(meeting) !== "waiting") return false;
  if (transition === "end" && !["live", "voting_open"].includes(meetingPhase(meeting))) return false;
  meeting.status = transition === "start" ? "live" : "completed";
  meeting.votingOpen = false; meeting.pollDemandOpen = false;
  meeting.agenda.forEach((a) => { a.stage = "closed"; });
  notifyMeeting(meetingId, transition === "start" ? "meeting_started" : "meeting_ended", transition === "start" ? "Meeting is now live" : "Meeting has ended", transition === "start" ? "Join the meeting room to follow the current agenda." : "Review the meeting outcomes and published documents.");
  auditRegistry(registry, actor, `meeting.${transition}`, `meeting:${meetingId}`, meeting.companyId);
  return true;
}
export function setAgendaStage(meetingId: string, agendaId: string, stage: AgendaStage, actor: string) {
  const meeting = getMeeting(meetingId); const agenda = meeting?.agenda.find((a) => a.id === agendaId);
  if (!meeting || !agenda || !AGENDA_STAGES.includes(stage) || !["live", "voting_open"].includes(meeting.status)) return false;
  const previousVoting = meeting.agenda.find((a) => a.stage === "voting");
  if (meeting.activeAgendaId === agendaId && agenda.stage === stage) return true;
  meeting.agenda.forEach((a) => { a.stage = a.id === agendaId ? stage : "closed"; });
  meeting.activeAgendaId = agendaId; meeting.votingOpen = stage === "voting"; meeting.pollDemandOpen = stage === "poll";
  if (previousVoting && (previousVoting.id !== agendaId || stage !== "voting")) notifyMeeting(meetingId, "voting_closed", "Voting window closed", previousVoting.title, true);
  if (stage === "voting") notifyMeeting(meetingId, "voting_open", "Voting is open", agenda.title, true);
  auditRegistry(registry, actor, `agenda.stage.${stage}`, `meeting:${meetingId}/agenda:${agendaId}`, meeting.companyId);
  return true;
}
export function portalNotifications(participantId: string) {
  const participant = getParticipantById(participantId);
  if (!participant) return [];
  // Stable reminders reflect configured windows; no background sender or invented deadline.
  for (const meeting of listMeetings(participant.companyId)) {
    if (!isPublishedMeeting(meeting) || (participant.kind !== "individual" && !participantRights(meeting.id, participantId))) continue;
    const noticeId = `notice_${participantId}_${meeting.id}`;
    if (!demoStore.portalNotifications.some(n=>n.id===noticeId)) {
      notifyParticipant(participantId, meeting.id, "notice", "Meeting notice available", "Read the published meeting notice.", noticeId);
    }
    if (meetingPhase(meeting) === "ended" || !participantRights(meeting.id, participantId)) continue;
    if (meeting.registrationCloses && !isRegistered(meeting.id, participantId)) {
      const id = `deadline_${participantId}_${meeting.id}_${meeting.registrationCloses}`;
      notifyParticipant(participantId, meeting.id, "deadline", "Registration deadline", meeting.registrationCloses, id);
    }
  }
  return demoStore.portalNotifications.filter((n) => n.participantId === participantId && n.companyId === participant.companyId && !(n.kind === "deadline" && (isRegistered(n.meetingId,participantId) || (getMeeting(n.meetingId) && meetingPhase(getMeeting(n.meetingId)!) === "ended"))) && !!getMeeting(n.meetingId) && isPublishedMeeting(getMeeting(n.meetingId)!) && (participant.kind === "individual" || participantRights(n.meetingId, participantId)))
    .map((n) => ({ ...n, meetingTitle: getMeeting(n.meetingId)!.title }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
export function markPortalNotificationRead(participantId: string, id?: string) {
  const notifications = portalNotifications(participantId);
  if (id && !notifications.some((n) => n.id === id)) return false;
  const allowed = new Set(notifications.filter((n) => !id || n.id === id).map((n) => n.id));
  for (const n of demoStore.portalNotifications) {
    if (n.participantId !== participantId || !allowed.has(n.id) || n.readAt) continue;
    n.readAt = new Date().toISOString();
    auditRegistry(registry, `participant:${participantId}`, "notification.read", `notification:${n.id}`, n.companyId);
  }
  return true;
}
export function addMeetingDocument(input: Omit<MeetingDocument, "id" | "createdAt" | "publishedAt">, actor: string) {
  const meeting = getMeeting(input.meetingId);
  if (!meeting || meeting.companyId !== input.companyId) throw new Error("Meeting not found");
  const now = new Date().toISOString();
  const document: MeetingDocument = { ...input, id: `doc_${crypto.randomUUID()}`, createdAt: now, publishedAt: input.published ? now : undefined };
  demoStore.documents.push(document);
  if (document.published) notifyMeeting(meeting.id, "document", "New document published", document.title);
  auditRegistry(registry, actor, "document.create", `document:${document.id}`, document.companyId);
  return document;
}
export function publishMeetingDocument(documentId: string, published: boolean, actor: string) {
  const document = demoStore.documents.find((d) => d.id === documentId);
  if (!document || typeof published !== "boolean") return false;
  if (document.published === published) return true;
  document.published = published; document.publishedAt = published ? new Date().toISOString() : undefined;
  if (published && document.kind === "notice") {
    const meeting=getMeeting(document.meetingId)!;
    if (!meeting.noticePublished) {
      meeting.noticePublished=true; meeting.noticePublishedAt=document.publishedAt;
      if (["draft","notice_pending"].includes(meeting.status)) meeting.status="notice_sent";
      auditRegistry(registry,actor,"meeting.notice.publish",`meeting:${meeting.id}`,meeting.companyId);
    }
  }
  if (published) notifyMeeting(document.meetingId, "document", "New document published", document.title);
  auditRegistry(registry, actor, published ? "document.publish" : "document.withdraw", `document:${documentId}`, document.companyId);
  return true;
}
export function listMeetingDocuments(meetingId: string, publishedOnly = true) {
  return demoStore.documents.filter((d) => d.meetingId === meetingId && (!publishedOnly || d.published)).map(({ content, ...d }) => ({ ...d, bytes: content.byteLength }));
}

// Fictional, readable/downloadable sample texts. Actual uploads remain private in memory.
if (!demoStore.documents.length) {
  for (const meeting of demoStore.meetings.filter(isPublishedMeeting)) {
    const company = getCompany(meeting.companyId)!;
    const notice = `DEMO NOTICE — FICTIONAL DATA\n\n${company.name}\n${meeting.title}\n${meeting.financialYear}\n\nMeeting: ${meeting.date} (${meeting.timezone})\nRecord date: ${meeting.recordDate.slice(0, 10)}\nVenue: ${meeting.venue}\n\nAGENDA\n${meeting.agenda.map((a) => `${a.order}. ${a.title}`).join("\n")}\n\nThis sample notice is for testing the portal and is not a statutory company filing.`;
    demoStore.documents.push({ id: `doc_notice_${meeting.id}`, companyId: meeting.companyId, meetingId: meeting.id, title: "Meeting notice (demo)", kind: "notice", fileName: `notice-${meeting.id}.txt`, mimeType: "text/plain", content: new TextEncoder().encode(notice), text: notice, published: true, createdAt: "2026-11-01T00:00:00Z", publishedAt: "2026-11-01T00:00:00Z" });
    if (meeting.type === "AGM") {
      const report = `DEMO ANNUAL REPORT EXTRACT — FICTIONAL DATA\n\n${company.name}\n${meeting.financialYear}\n\nCompany registration: ${company.registrationNo}\nSector: ${company.sector}\nPaid-up capital in the demo company profile: BDT ${company.paidUpCapital.toLocaleString("en-BD")}\n\nThis fictional extract demonstrates document reading and downloading. It does not contain audited financial statements and must not be used as an official annual report.`;
      demoStore.documents.push({ id: `doc_report_${meeting.id}`, companyId: meeting.companyId, meetingId: meeting.id, title: "Annual report (demo extract)", kind: "annual_report", fileName: `annual-report-${meeting.id}.txt`, mimeType: "text/plain", content: new TextEncoder().encode(report), text: report, published: true, createdAt: "2026-11-01T00:00:00Z", publishedAt: "2026-11-01T00:00:00Z" });
    }
  }
}
