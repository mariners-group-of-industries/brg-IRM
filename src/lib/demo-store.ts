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
  ApprovalItem,
  Company,
  CompanySettings,
  CommunicationBroadcast,
  DemoParticipant,
  IntegrationAdapter,
  InvestorRecord,
  Meeting,
  MeetingQuestionRecord,
  NoticeDispatchRecord,
  ParticipantKind,
  PortalDemand,
  PortalVote,
  PortalNotification,
  MeetingDocument,
  AgendaStage,
  SupportTicket,
} from "./types";
import { AGENDA_STAGES, agendaOpen, meetingPhase } from "./meeting-rules";
import { auditRegistry, registry } from "./shareholder-store";
import { holdingBalance } from "./shareholders";
import { grantCompanyToAdmins } from "./demo-users";

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

const SEED_COMPANY_SETTINGS: CompanySettings[] = [
  {
    companyId: "co_meghna",
    quorumPercent: 25,
    quorumMinMembers: 5,
    pollDemandThresholdPercent: 10,
    defaultProxyLimit: 1,
    proxyDeadlineHoursBefore: 48,
    noticeDaysRequired: 21,
    signatoryName: "Nusrat Jahan, FCS",
    signatoryTitle: "Company Secretary",
    sealReference: "MTL-SEAL-2026-01",
    updatedAt: "2026-11-10T09:00:00.000Z",
  },
  {
    companyId: "co_delta",
    quorumPercent: 25,
    quorumMinMembers: 5,
    pollDemandThresholdPercent: 10,
    defaultProxyLimit: 1,
    proxyDeadlineHoursBefore: 48,
    noticeDaysRequired: 21,
    signatoryName: "Kamrul Hasan, ACS",
    signatoryTitle: "Company Secretary",
    sealReference: "DPL-SEAL-2026-04",
    updatedAt: "2026-11-08T10:30:00.000Z",
  },
  {
    companyId: "co_karnaphuli",
    quorumPercent: 20,
    quorumMinMembers: 5,
    pollDemandThresholdPercent: 10,
    defaultProxyLimit: 1,
    proxyDeadlineHoursBefore: 48,
    noticeDaysRequired: 21,
    signatoryName: "Tariqul Islam",
    signatoryTitle: "Company Secretary",
    sealReference: "KCCL-SEAL-2026-02",
    updatedAt: "2026-10-25T11:00:00.000Z",
  },
  {
    companyId: "co_padma",
    quorumPercent: 30,
    quorumMinMembers: 2,
    pollDemandThresholdPercent: 10,
    defaultProxyLimit: 2,
    proxyDeadlineHoursBefore: 24,
    noticeDaysRequired: 14,
    signatoryName: "Farid Uddin Ahmed",
    signatoryTitle: "Managing Director & Secretary",
    sealReference: "PAIL-SEAL-2026-01",
    updatedAt: "2026-10-18T14:15:00.000Z",
  },
];

const SEED_INVESTORS: InvestorRecord[] = [
  {
    id: "inv_1",
    companyId: "co_meghna",
    kind: "individual",
    name: "Rashedul Islam",
    tin: "100456789012",
    email: "rashedul.islam@dhaka-invest.bd",
    phone: "+8801711000152",
    country: "Bangladesh",
    kycStatus: "verified",
    relationshipManager: "Nusrat Jahan",
    communicationPreference: "both",
    linkedBoIds: ["12012345678901234"],
    notes: "Long-term ordinary shareholder; regular AGM attendee.",
    updatedAt: "2026-11-12T08:30:00.000Z",
  },
  {
    id: "inv_2",
    companyId: "co_meghna",
    kind: "corporate",
    name: "Eastern Investments Limited",
    tin: "100998877661",
    email: "custody@easterninvest.com.bd",
    phone: "+8801710000003",
    country: "Bangladesh",
    kycStatus: "verified",
    relationshipManager: "Aditi Rahman",
    communicationPreference: "email",
    linkedBoIds: ["12012345678910003"],
    notes: "Institutional asset manager holding ordinary equity block.",
    updatedAt: "2026-11-14T10:15:00.000Z",
  },
  {
    id: "inv_3",
    companyId: "co_delta",
    kind: "corporate",
    name: "Delta Holdings & Pension Trust",
    tin: "100554433221",
    email: "trustee@deltaholdings.com.bd",
    phone: "+8801711000920",
    country: "Bangladesh",
    kycStatus: "verified",
    relationshipManager: "Aditi Rahman",
    communicationPreference: "email",
    linkedBoIds: ["12012345678909999"],
    notes: "Board-authorized institutional representative Imran Kabir on file.",
    updatedAt: "2026-11-05T11:20:00.000Z",
  },
  {
    id: "inv_4",
    companyId: "co_karnaphuli",
    kind: "foreign",
    name: "Bay Maritime Capital Partners",
    tin: "N/A (FII-SG-884)",
    email: "ir-desk@baymaritime.sg",
    phone: "+6568124400",
    country: "Singapore",
    kycStatus: "pending",
    relationshipManager: "Rakib Ahmed",
    communicationPreference: "email",
    linkedBoIds: ["12012345678903333"],
    notes: "Updated custodian board resolution requested prior to FY26 dividend.",
    updatedAt: "2026-11-15T06:45:00.000Z",
  },
];

const SEED_NOTICE_DISPATCHES: NoticeDispatchRecord[] = [
  {
    id: "nd_1",
    meetingId: "mtg_agm_2026",
    companyId: "co_meghna",
    channel: "portal",
    language: "bilingual",
    recipientCount: 12480,
    dispatchedBy: "secretary@demo.local",
    dispatchedAt: "2026-11-17T02:20:00.000Z",
    status: "published",
    reference: "NTC-MTL-2026-001",
  },
  {
    id: "nd_2",
    meetingId: "mtg_agm_2026",
    companyId: "co_meghna",
    channel: "newspaper",
    language: "bilingual",
    recipientCount: 2,
    dispatchedBy: "secretary@demo.local",
    dispatchedAt: "2026-11-17T04:00:00.000Z",
    status: "delivered",
    reference: "NP-FE-PA-2026-11",
  },
  {
    id: "nd_3",
    meetingId: "mtg_egm_bonus",
    companyId: "co_meghna",
    channel: "email",
    language: "en",
    recipientCount: 12480,
    dispatchedBy: "secretary@demo.local",
    dispatchedAt: "2026-11-05T08:15:00.000Z",
    status: "delivered",
    reference: "EML-MTL-EGM-2026",
  },
];

const SEED_COMMUNICATIONS: CommunicationBroadcast[] = [
  {
    id: "comm_1",
    companyId: "co_meghna",
    meetingId: "mtg_agm_2026",
    category: "notice",
    subject: "23rd AGM Statutory Notice & Proxy Submission Guidelines",
    body: "Shareholders holding shares as of the record date (20 Nov 2026) are invited to register and review the audited FY 2025–26 accounts via the Shareholder Portal.",
    channels: ["portal", "email"],
    recipientCount: 12480,
    sentBy: "secretary@demo.local",
    sentAt: "2026-11-17T02:25:00.000Z",
    status: "delivered",
  },
  {
    id: "comm_2",
    companyId: "co_karnaphuli",
    meetingId: "mtg_egm_cement",
    category: "results",
    subject: "Certified EGM Poll Results — Rights Share Offer",
    body: "Both Special Resolutions for the Rights Issue and Authorized Capital increase passed with 96.4% shareholder approval. Minutes are available for download.",
    channels: ["portal", "email", "sms"],
    recipientCount: 8120,
    sentBy: "admin@demo.local",
    sentAt: "2026-10-30T13:10:00.000Z",
    status: "delivered",
  },
];

const SEED_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: "tkt_1",
    ticketNo: "IRM-2026-104",
    companyId: "co_meghna",
    boId: "12012345678902345",
    shareholderName: "Farhana Akter",
    category: "meeting_access",
    subject: "Confirming mobile number for 23rd AGM OTP delivery",
    description: "Shareholder requested verification that the updated 017••••08 contact on the CDBL snapshot will receive the portal OTP.",
    priority: "medium",
    status: "in_progress",
    assignedTo: "Nusrat Jahan",
    createdAt: "2026-11-16T09:15:00.000Z",
    updatedAt: "2026-11-17T04:10:00.000Z",
  },
  {
    id: "tkt_2",
    ticketNo: "IRM-2026-105",
    companyId: "co_meghna",
    boId: "12012345678901234",
    shareholderName: "Rashedul Islam",
    category: "proxy_instrument",
    subject: "Verification status of proxy instrument DEMO-PROXY-001",
    description: "Shareholder inquired whether Mahir Rahman's proxy form has been cleared for the 23rd AGM.",
    priority: "low",
    status: "resolved",
    assignedTo: "Rakib Ahmed",
    resolutionNote: "Verified signature against specimen record; approved in register authorizations.",
    createdAt: "2026-11-14T11:00:00.000Z",
    updatedAt: "2026-11-15T15:30:00.000Z",
  },
  {
    id: "tkt_3",
    ticketNo: "IRM-2026-106",
    companyId: "co_delta",
    boId: "12012345678910001",
    shareholderName: "Tanvir Ahmed",
    category: "dividend_claim",
    subject: "Unclaimed FY 2024–25 cash dividend BEFTN re-routing",
    description: "Shareholder updated bank routing number with depository participant and requested re-dispatch of dividend warrant.",
    priority: "high",
    status: "open",
    assignedTo: "Aditi Rahman",
    createdAt: "2026-11-17T05:20:00.000Z",
    updatedAt: "2026-11-17T05:20:00.000Z",
  },
];

const SEED_INTEGRATIONS: IntegrationAdapter[] = [
  {
    id: "int_cdbl",
    key: "cdbl",
    name: "CDBL Beneficial Owner Sync",
    provider: "Central Depository Bangladesh Ltd (CDBL)",
    category: "Share Register",
    status: "connected",
    endpoint: "https://cds-api.cdbl.com.bd/v2/snapshots",
    lastSyncAt: "2026-11-17T01:10:00.000Z",
    lastSyncSummary: "Synchronized 12,480 BO records across Meghna Textiles & Delta Pharma.",
  },
  {
    id: "int_sms",
    key: "sms_gateway",
    name: "SMS OTP & Notice Gateway",
    provider: "SSL Wireless (Bangladesh)",
    category: "Messaging",
    status: "connected",
    endpoint: "https://smsplus.sslwireless.com/api/v3/send-sms",
    lastSyncAt: "2026-11-17T02:20:00.000Z",
    lastSyncSummary: "Gateway healthy · 99.4% delivery rate in last 24h.",
  },
  {
    id: "int_email",
    key: "email_smtp",
    name: "Transactional Email Relay",
    provider: "Resend / Enterprise SMTP",
    category: "Messaging",
    status: "connected",
    endpoint: "smtp://relay.brg1-irm.internal:587",
    lastSyncAt: "2026-11-17T02:25:00.000Z",
    lastSyncSummary: "DKIM & SPF verified · Notice batch queue clear.",
  },
  {
    id: "int_video",
    key: "video_bridge",
    name: "Live AGM Video Bridge",
    provider: "Zoom Enterprise Webinar SDK",
    category: "Meeting Room",
    status: "sandbox",
    endpoint: "https://api.zoom.us/v2/webinars",
    lastSyncAt: "2026-11-16T16:00:00.000Z",
    lastSyncSummary: "Test bridge verified for 23rd AGM Hybrid Hall stream.",
  },
  {
    id: "int_rjsc",
    key: "rjsc_filing",
    name: "RJSC & BSEC Filing Packager",
    provider: "RJSC / DSE Electronic Exporter",
    category: "Regulatory",
    status: "connected",
    endpoint: "https://filing.brg1-irm.internal/bsec-xbrl",
    lastSyncAt: "2026-10-30T13:30:00.000Z",
    lastSyncSummary: "Last Form-XV & voting summary package exported for Karnaphuli EGM.",
  },
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
  approvals: ApprovalItem[];
  companySettings: CompanySettings[];
  investors: InvestorRecord[];
  noticeDispatches: NoticeDispatchRecord[];
  communications: CommunicationBroadcast[];
  supportTickets: SupportTicket[];
  integrations: IntegrationAdapter[];
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
    approvals: DEMO_APPROVALS.map((a) => ({ ...a, status: "pending" as const })),
    companySettings: structuredClone(SEED_COMPANY_SETTINGS),
    investors: structuredClone(SEED_INVESTORS),
    noticeDispatches: structuredClone(SEED_NOTICE_DISPATCHES),
    communications: structuredClone(SEED_COMMUNICATIONS),
    supportTickets: structuredClone(SEED_SUPPORT_TICKETS),
    integrations: structuredClone(SEED_INTEGRATIONS),
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
demoStore.approvals ??= DEMO_APPROVALS.map((a) => ({ ...a, status: "pending" as const }));
demoStore.companySettings ??= structuredClone(SEED_COMPANY_SETTINGS);
demoStore.investors ??= structuredClone(SEED_INVESTORS);
demoStore.noticeDispatches ??= structuredClone(SEED_NOTICE_DISPATCHES);
demoStore.communications ??= structuredClone(SEED_COMMUNICATIONS);
demoStore.supportTickets ??= structuredClone(SEED_SUPPORT_TICKETS);
demoStore.integrations ??= structuredClone(SEED_INTEGRATIONS);
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

export function listApprovals(): ApprovalItem[] {
  return demoStore.approvals;
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

/* --- writes & module workflows --------------------------------------- */

export function createCompany(
  input: Omit<Company, "id">,
  actor: string,
): Company {
  if (demoStore.companies.some((c) => c.registrationNo.toLowerCase() === input.registrationNo.trim().toLowerCase())) {
    throw new Error("A company with this registration number already exists");
  }
  const slug = input.shortName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  const company: Company = {
    ...input,
    id: `co_${slug || "entity"}_${Date.now().toString(36).slice(-4)}`,
  };
  demoStore.companies.push(company);
  demoStore.companySettings.push({
    companyId: company.id,
    quorumPercent: 25,
    quorumMinMembers: company.type === "Private Limited" ? 2 : 5,
    pollDemandThresholdPercent: 10,
    defaultProxyLimit: 1,
    proxyDeadlineHoursBefore: 48,
    noticeDaysRequired: company.type === "Private Limited" ? 14 : 21,
    signatoryName: actor,
    signatoryTitle: "Company Secretary",
    sealReference: `${company.shortName.slice(0, 4).toUpperCase()}-SEAL-${new Date().getFullYear()}`,
    updatedAt: new Date().toISOString(),
  });
  grantCompanyToAdmins(company.id);
  auditRegistry(registry, actor, "company.create", `company:${company.id}`, company.id);
  pushActivity(actor, "Onboarded entity", company.name, "success");
  return company;
}

export function decideApproval(
  id: string,
  decision: "approved" | "rejected",
  actor: string,
  note?: string,
) {
  const item = demoStore.approvals.find((a) => a.id === id);
  if (!item) return null;
  item.status = decision;
  item.decidedBy = actor;
  item.decidedAt = new Date().toISOString();
  item.note = note?.trim() || undefined;
  auditRegistry(registry, actor, `approval.${decision}`, `approval:${item.id}`, item.companyId);
  pushActivity(actor, `${decision === "approved" ? "Approved" : "Rejected"}`, item.title, decision === "approved" ? "success" : "warning");
  return item;
}

export function getCompanySettings(companyId: string): CompanySettings {
  let settings = demoStore.companySettings.find((s) => s.companyId === companyId);
  if (!settings) {
    settings = {
      companyId,
      quorumPercent: 25,
      quorumMinMembers: 5,
      pollDemandThresholdPercent: 10,
      defaultProxyLimit: 1,
      proxyDeadlineHoursBefore: 48,
      noticeDaysRequired: 21,
      signatoryName: "Company Secretary",
      signatoryTitle: "Company Secretary",
      sealReference: "BRG1-SEAL",
      updatedAt: new Date().toISOString(),
    };
    demoStore.companySettings.push(settings);
  }
  return settings;
}

export function saveCompanySettings(
  companyId: string,
  patch: Omit<CompanySettings, "companyId" | "updatedAt">,
  actor: string,
  applyToUpcomingMeetings = false,
): CompanySettings {
  const existing = getCompanySettings(companyId);
  Object.assign(existing, patch, { updatedAt: new Date().toISOString() });
  if (applyToUpcomingMeetings) {
    for (const m of demoStore.meetings) {
      if (m.companyId === companyId && !["completed", "archived"].includes(m.status)) {
        m.proxyLimitPerHolder = patch.defaultProxyLimit;
        m.pollDemandRule = `Shares carrying ≥ ${patch.pollDemandThresholdPercent}% of voting rights`;
      }
    }
  }
  auditRegistry(registry, actor, "settings.update", `company:${companyId}`, companyId);
  pushActivity(actor, "Updated governance & legal rules for", getCompany(companyId)?.shortName ?? companyId, "info");
  return existing;
}

export function listInvestors(companyId?: string): InvestorRecord[] {
  return (companyId ? demoStore.investors.filter((i) => i.companyId === companyId) : demoStore.investors)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveInvestor(
  input: Omit<InvestorRecord, "id" | "updatedAt">,
  actor: string,
  id?: string,
): InvestorRecord {
  const now = new Date().toISOString();
  if (id) {
    const existing = demoStore.investors.find((i) => i.id === id);
    if (!existing) throw new Error("Investor record not found");
    Object.assign(existing, input, { updatedAt: now });
    auditRegistry(registry, actor, "investor.update", `investor:${id}`, existing.companyId);
    pushActivity(actor, "Updated investor KYC profile", existing.name, "info");
    return existing;
  }
  const investor: InvestorRecord = {
    ...input,
    id: `inv_${crypto.randomUUID().slice(0, 8)}`,
    updatedAt: now,
  };
  demoStore.investors.unshift(investor);
  auditRegistry(registry, actor, "investor.create", `investor:${investor.id}`, investor.companyId);
  pushActivity(actor, "Created investor profile", investor.name, "success");
  return investor;
}

export function updateInvestorKyc(
  id: string,
  kycStatus: InvestorRecord["kycStatus"],
  actor: string,
): InvestorRecord | null {
  const investor = demoStore.investors.find((i) => i.id === id);
  if (!investor) return null;
  investor.kycStatus = kycStatus;
  investor.updatedAt = new Date().toISOString();
  auditRegistry(registry, actor, `investor.kyc.${kycStatus}`, `investor:${id}`, investor.companyId);
  pushActivity(actor, `Marked investor KYC as ${kycStatus}`, investor.name, kycStatus === "verified" ? "success" : "warning");
  return investor;
}

export function listNoticeDispatches(companyId?: string, meetingId?: string): NoticeDispatchRecord[] {
  return demoStore.noticeDispatches
    .filter((d) => (!companyId || d.companyId === companyId) && (!meetingId || d.meetingId === meetingId))
    .slice()
    .sort((a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt));
}

export function dispatchStatutoryNotice(
  input: {
    meetingId: string;
    channels: ("portal" | "email" | "sms" | "newspaper")[];
    language: "en" | "bn" | "bilingual";
    noticeText?: string;
  },
  actor: string,
): NoticeDispatchRecord[] {
  const meeting = getMeeting(input.meetingId);
  if (!meeting) throw new Error("Meeting not found");
  const company = getCompany(meeting.companyId);
  const now = new Date().toISOString();

  // Publish meeting & generate portal notice document if not published yet
  if (!meeting.noticePublished) {
    meeting.noticePublished = true;
    meeting.noticePublishedAt = now;
  }
  if (["draft", "notice_pending"].includes(meeting.status)) {
    meeting.status = "notice_sent";
  }

  const existingDoc = demoStore.documents.find((d) => d.meetingId === meeting.id && d.kind === "notice");
  const textContent =
    input.noticeText?.trim() ||
    `${company?.name ?? ""}\nSTATUTORY NOTICE — ${meeting.title} (${meeting.financialYear})\nDate: ${meeting.date} (${meeting.timezone})\nRecord Date: ${meeting.recordDate.slice(0, 10)}\nVenue: ${meeting.venue}\n\nAGENDA:\n${meeting.agenda.map((a) => `${a.order}. ${a.title}${a.titleBn ? ` / ${a.titleBn}` : ""}`).join("\n")}`;

  if (existingDoc) {
    existingDoc.published = true;
    existingDoc.publishedAt = now;
    existingDoc.text = textContent;
    existingDoc.content = new TextEncoder().encode(textContent);
  } else {
    demoStore.documents.push({
      id: `doc_notice_${meeting.id}_${Date.now().toString(36)}`,
      companyId: meeting.companyId,
      meetingId: meeting.id,
      title: `Statutory Notice — ${meeting.title}`,
      kind: "notice",
      fileName: `notice-${meeting.id}.txt`,
      mimeType: "text/plain",
      content: new TextEncoder().encode(textContent),
      text: textContent,
      published: true,
      createdAt: now,
      publishedAt: now,
    });
  }

  const created: NoticeDispatchRecord[] = input.channels.map((channel) => {
    const rec: NoticeDispatchRecord = {
      id: `nd_${crypto.randomUUID().slice(0, 8)}`,
      meetingId: meeting.id,
      companyId: meeting.companyId,
      channel,
      language: input.language,
      recipientCount: channel === "newspaper" ? 2 : meeting.eligibleShareholders,
      dispatchedBy: actor,
      dispatchedAt: now,
      status: channel === "portal" ? "published" : "delivered",
      reference: `NTC-${channel.toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    };
    demoStore.noticeDispatches.unshift(rec);
    return rec;
  });

  if (input.channels.includes("portal")) {
    notifyMeeting(meeting.id, "notice", "Statutory Meeting Notice Published", `${meeting.title} — Notice and agenda are now live.`);
  }
  auditRegistry(registry, actor, "meeting.notice.dispatch", `meeting:${meeting.id}`, meeting.companyId);
  pushActivity(actor, `Dispatched statutory notice (${input.channels.join(", ")}) for`, meeting.title, "success");
  return created;
}

export function listCommunications(companyId?: string): CommunicationBroadcast[] {
  return (companyId ? demoStore.communications.filter((c) => c.companyId === companyId) : demoStore.communications)
    .slice()
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function sendCommunicationBroadcast(
  input: {
    companyId: string;
    meetingId?: string;
    category: CommunicationBroadcast["category"];
    subject: string;
    body: string;
    channels: ("portal" | "email" | "sms")[];
  },
  actor: string,
): CommunicationBroadcast {
  const company = getCompany(input.companyId);
  if (!company) throw new Error("Company not found");
  const now = new Date().toISOString();
  const broadcast: CommunicationBroadcast = {
    id: `comm_${crypto.randomUUID().slice(0, 8)}`,
    companyId: input.companyId,
    meetingId: input.meetingId || undefined,
    category: input.category,
    subject: input.subject.trim(),
    body: input.body.trim(),
    channels: input.channels,
    recipientCount: company.totalShareholders,
    sentBy: actor,
    sentAt: now,
    status: "delivered",
  };
  demoStore.communications.unshift(broadcast);

  if (input.channels.includes("portal")) {
    const targetMeeting =
      (input.meetingId ? getMeeting(input.meetingId) : undefined) ??
      listMeetings(input.companyId).find(isPublishedMeeting);
    if (targetMeeting && isPublishedMeeting(targetMeeting)) {
      for (const pid of listCompanyParticipantIds(input.companyId)) {
        notifyParticipant(pid, targetMeeting.id, "notice", broadcast.subject, broadcast.body);
      }
    }
  }
  auditRegistry(registry, actor, "communication.send", `communication:${broadcast.id}`, input.companyId);
  pushActivity(actor, `Sent ${input.category} broadcast (${input.channels.join("/")}) to`, company.shortName, "info");
  return broadcast;
}

export function listSupportTickets(companyId?: string): SupportTicket[] {
  return (companyId ? demoStore.supportTickets.filter((t) => t.companyId === companyId) : demoStore.supportTickets)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createSupportTicket(
  input: Omit<SupportTicket, "id" | "ticketNo" | "status" | "createdAt" | "updatedAt">,
  actor: string,
): SupportTicket {
  const now = new Date().toISOString();
  const seq = 104 + demoStore.supportTickets.length;
  const ticket: SupportTicket = {
    ...input,
    id: `tkt_${crypto.randomUUID().slice(0, 8)}`,
    ticketNo: `IRM-${new Date().getFullYear()}-${seq}`,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  demoStore.supportTickets.unshift(ticket);
  auditRegistry(registry, actor, "support.ticket.create", `ticket:${ticket.ticketNo}`, ticket.companyId);
  pushActivity(actor, "Opened support ticket", `${ticket.ticketNo} · ${ticket.subject}`, "warning");
  return ticket;
}

export function updateSupportTicket(
  id: string,
  patch: { status?: SupportTicket["status"]; assignedTo?: string; resolutionNote?: string },
  actor: string,
): SupportTicket | null {
  const ticket = demoStore.supportTickets.find((t) => t.id === id);
  if (!ticket) return null;
  if (patch.status) ticket.status = patch.status;
  if (patch.assignedTo !== undefined) ticket.assignedTo = patch.assignedTo;
  if (patch.resolutionNote !== undefined) ticket.resolutionNote = patch.resolutionNote;
  ticket.updatedAt = new Date().toISOString();
  auditRegistry(registry, actor, `support.ticket.${ticket.status}`, `ticket:${ticket.ticketNo}`, ticket.companyId);
  pushActivity(actor, `Updated ticket ${ticket.ticketNo} to ${ticket.status.replaceAll("_", " ")}`, ticket.subject, ticket.status === "resolved" ? "success" : "info");
  return ticket;
}

export function listIntegrations(): IntegrationAdapter[] {
  return demoStore.integrations;
}

export function updateIntegration(
  id: string,
  patch: { provider?: string; endpoint?: string; status?: IntegrationAdapter["status"] },
  actor: string,
): IntegrationAdapter | null {
  const adapter = demoStore.integrations.find((i) => i.id === id);
  if (!adapter) return null;
  if (patch.provider !== undefined) adapter.provider = patch.provider.trim();
  if (patch.endpoint !== undefined) adapter.endpoint = patch.endpoint.trim();
  if (patch.status) adapter.status = patch.status;
  auditRegistry(registry, actor, "integration.update", `integration:${adapter.key}`, "");
  pushActivity(actor, "Updated integration config", adapter.name, "info");
  return adapter;
}

export function triggerIntegrationSync(id: string, actor: string): IntegrationAdapter | null {
  const adapter = demoStore.integrations.find((i) => i.id === id);
  if (!adapter) return null;
  adapter.lastSyncAt = new Date().toISOString();
  adapter.status = adapter.status === "disconnected" ? "connected" : adapter.status;
  adapter.lastSyncSummary = `Handshake & sync completed cleanly at ${adapter.lastSyncAt.slice(11, 19)} UTC · ${registry.holders.length} register records verified.`;
  auditRegistry(registry, actor, "integration.sync", `integration:${adapter.key}`, "");
  pushActivity(actor, "Synchronized integration", adapter.name, "success");
  return adapter;
}

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

/* --- shareholder portal (live register & seeded lookup) --------------- */

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ").replace(/\./g, "");

function listCompanyParticipantIds(companyId: string): string[] {
  const ids = new Set<string>();
  const seededKeys = new Set<string>();
  for (const p of DEMO_PARTICIPANTS) {
    if (p.companyId === companyId) {
      ids.add(p.id);
      if (p.kind === "individual") seededKeys.add(`${p.companyId}:${p.boId}`);
    }
  }
  for (const h of registry.holders) {
    if (h.companyId === companyId && h.status === "active" && !seededKeys.has(`${h.companyId}:${h.boId}`)) {
      ids.add(h.id);
    }
  }
  for (const a of registry.authorizations) {
    if (a.companyId === companyId && a.status === "approved" && a.participantId) {
      ids.add(a.participantId);
    }
  }
  return [...ids];
}

export function findParticipant(
  kind: ParticipantKind,
  boId: string,
  name: string,
): DemoParticipant | undefined {
  const target = normalize(name);
  const cleanBoId = boId.trim();

  // 1. Seeded participants
  const seededMatch = DEMO_PARTICIPANTS.map((p) => getParticipantById(p.id)).find(
    (p) => p && p.kind === kind && p.boId.trim() === cleanBoId && normalize(p.name) === target,
  );
  if (seededMatch) return seededMatch;

  // 2. Dynamic individual shareholders from legal register
  if (kind === "individual") {
    const holder = registry.holders.find(
      (h) =>
        h.status === "active" &&
        h.kind === "individual" &&
        h.boId.trim() === cleanBoId &&
        normalize(h.name) === target,
    );
    if (holder) return getParticipantById(holder.id);
  }

  // 3. Dynamic approved proxies / corporate representatives from registry authorizations
  if (kind === "proxy" || kind === "corporate") {
    const holder = registry.holders.find((h) => h.status === "active" && h.boId.trim() === cleanBoId);
    if (holder) {
      const auth = registry.authorizations.find(
        (a) =>
          a.holderId === holder.id &&
          a.status === "approved" &&
          a.kind === kind &&
          normalize(a.name) === target,
      );
      if (auth) {
        auth.participantId ??= `p_auth_${auth.id}`;
        return getParticipantById(auth.participantId);
      }
    }
  }

  return undefined;
}

export function getParticipantById(id: string): DemoParticipant | undefined {
  // 1. Seeded participants
  const participant = DEMO_PARTICIPANTS.find((p) => p.id === id);
  if (participant) {
    const holder = registry.holders.find((h) => h.companyId === participant.companyId && h.boId === participant.boId && h.status === "active");
    if (!holder) return undefined;
    const shares = holdingBalance(registry.entries, holder.id);
    return { ...participant, name: participant.kind === "individual" ? holder.name : participant.name, subjectName: holder.name, eligibleShares: shares, votingRights: participant.eligibleShares ? shares * (participant.votingRights / participant.eligibleShares) : 0 };
  }

  // 2. Active shareholders in the legal register
  const holder = registry.holders.find((h) => h.id === id && h.status === "active");
  if (holder) {
    const shares = holdingBalance(registry.entries, holder.id);
    return {
      id: holder.id,
      kind: holder.kind === "corporate" ? "corporate" : "individual",
      boId: holder.boId,
      name: holder.name,
      subjectName: holder.name,
      companyId: holder.companyId,
      eligibleShares: shares,
      votingRights: shares,
      mobile: holder.mobile ? `${holder.mobile.slice(0, 2)}••••••••${holder.mobile.slice(-2)}` : "01••••••••00",
      otp: "482391",
    };
  }

  // 3. Approved proxies / corporate representatives in authorizations
  const auth = registry.authorizations.find(
    (a) => a.status === "approved" && (a.participantId === id || `p_auth_${a.id}` === id),
  );
  if (auth) {
    const authHolder = registry.holders.find((h) => h.id === auth.holderId && h.status === "active");
    if (!authHolder) return undefined;
    const shares = holdingBalance(registry.entries, authHolder.id);
    return {
      id: auth.participantId ?? `p_auth_${auth.id}`,
      kind: auth.kind,
      boId: authHolder.boId,
      name: auth.name,
      subjectName: authHolder.name,
      companyId: authHolder.companyId,
      eligibleShares: shares,
      votingRights: shares,
      mobile: authHolder.mobile ? `${authHolder.mobile.slice(0, 2)}••••••••${authHolder.mobile.slice(-2)}` : "01••••••••00",
      otp: "482391",
    };
  }

  return undefined;
}

export function isPublishedMeeting(meeting: Meeting) {
  return !["draft", "notice_pending", "archived"].includes(meeting.status) && meeting.noticePublished;
}
function sameAccount(a: string, b: string) {
  const first = DEMO_PARTICIPANTS.find((p) => p.id === a) ?? getParticipantById(a);
  const second = DEMO_PARTICIPANTS.find((p) => p.id === b) ?? getParticipantById(b);
  return !!first && !!second && first.companyId === second.companyId && first.boId === second.boId;
}
export function participantRights(meetingId: string, participantId: string) {
  const participant = getParticipantById(participantId); const meeting = getMeeting(meetingId);
  if (!participant || !meeting || participant.companyId !== meeting.companyId || !isPublishedMeeting(meeting)) return null;
  // Class-based/weighted rules require explicit entitlement data; do not silently
  // substitute one-share/one-vote when that configuration has not been wired.
  if (meeting.votingEntitlement && meeting.votingEntitlement !== "one_share_one_vote") return null;
  if ((participant.kind === "proxy" && !meeting.proxiesAllowed) || (participant.kind === "corporate" && !meeting.corporateRepresentatives)) return null;
  const holder = registry.holders.find((h) => h.companyId === participant.companyId && h.boId === participant.boId && h.status === "active");
  if (!holder) return null;
  if (participant.kind !== "individual" && !registry.authorizations.some((a) => a.holderId === holder.id && a.meetingId === meetingId && a.status === "approved" && a.kind === participant.kind && a.name === participant.name && (a.participantId === participant.id || `p_auth_${a.id}` === participant.id))) return null;
  const registration = demoStore.portal.registrations.find((r) => r.meetingId === meetingId && sameAccount(r.participantId, participantId));
  const shares = registration?.shares ?? holdingBalance(registry.entries, holder.id, meeting.shareClassId, meeting.recordDate.slice(0, 10));
  const seeded = DEMO_PARTICIPANTS.find((p) => p.id === participantId);
  const ratio = seeded && seeded.eligibleShares ? seeded.votingRights / seeded.eligibleShares : 1;
  const votingRights = registration?.votingRights ?? shares * ratio;
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
  const meeting = getMeeting(meetingId);
  if (!meeting) return;
  for (const pid of listCompanyParticipantIds(meeting.companyId)) {
    if (participantRights(meetingId, pid) && (!registeredOnly || isRegistered(meetingId, pid))) {
      notifyParticipant(pid, meetingId, kind, title, detail);
    }
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
