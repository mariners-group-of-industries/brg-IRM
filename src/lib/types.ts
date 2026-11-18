export type MeetingType = "AGM" | "EGM";
export type MeetingStatus =
  | "draft"
  | "notice_pending"
  | "notice_sent"
  | "scheduled"
  | "live"
  | "voting_open"
  | "completed"
  | "archived";
export type MeetingMode = "physical" | "virtual" | "hybrid";

export interface Company {
  id: string;
  name: string;
  shortName: string;
  registrationNo: string;
  tin: string;
  sector: string;
  type: "Public Limited" | "Private Limited";
  listed: boolean;
  shareClasses: string[];
  paidUpCapital: number;
  totalShareholders: number;
}

export interface AgendaItem {
  id: string;
  order: number;
  title: string;
  /** Bilingual agenda support (English + Bangla). */
  titleBn?: string;
  kind: "ordinary" | "special";
  resolution?: string;
  status: "proposed" | "seconded" | "passed" | "rejected" | "pending";
  stage?: AgendaStage;
}
export type AgendaStage = "closed" | "proposal" | "seconding" | "poll" | "voting";
export type MeetingPhase = "waiting" | "live" | "voting_open" | "ended";

export interface Meeting {
  id: string;
  companyId: string;
  type: MeetingType;
  title: string;
  titleBn?: string;
  financialYear: string;
  date: string; // ISO
  timezone: string;
  mode: MeetingMode;
  venue: string;
  status: MeetingStatus;
  recordDate: string;
  eligibleShareholders: number;
  registered: number;
  attended: number;
  noticePublished: boolean;
  noticePublishedAt?: string;
  votingMethod: "show_of_hands" | "poll" | "hybrid";
  pollDemandRule: string;
  proxiesAllowed?: boolean;
  corporateRepresentatives?: boolean;
  proxyLimitPerHolder?: number;
  proxyDeadline?: string;
  registrationOpens?: string;
  registrationCloses?: string;
  shareClassId?: string;
  votingEntitlement?: "one_share_one_vote" | "class_based" | "weighted";
  /** Chair-controlled switches (demo): voting window and poll demand. */
  votingOpen?: boolean;
  pollDemandOpen?: boolean;
  activeAgendaId?: string;
  streamingProvider?: "irm_live" | "zoom" | "webex" | "none";
  streamUrl?: string;
  zoomMeetingId?: string;
  zoomPasscode?: string;
  hostName?: string;
  agenda: AgendaItem[];
}

export interface ActivityItem {
  id: string;
  at: string; // ISO
  actor: string;
  action: string;
  target?: string;
  tone: "info" | "success" | "warning";
}

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface ApprovalItem {
  id: string;
  title: string;
  companyId: string;
  requestedBy: string;
  requestedAt: string;
  dueDate: string;
  kind: "notice" | "resolution" | "document" | "proxy_batch";
  status?: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

export interface CompanySettings {
  companyId: string;
  quorumPercent: number;
  quorumMinMembers: number;
  pollDemandThresholdPercent: number;
  defaultProxyLimit: number;
  proxyDeadlineHoursBefore: number;
  noticeDaysRequired: number;
  signatoryName: string;
  signatoryTitle: string;
  sealReference: string;
  updatedAt: string;
}

export interface InvestorRecord {
  id: string;
  companyId: string;
  kind: "individual" | "corporate" | "foreign";
  name: string;
  tin: string;
  email: string;
  phone: string;
  country: string;
  kycStatus: "verified" | "pending" | "expired" | "rejected";
  relationshipManager: string;
  communicationPreference: "email" | "sms" | "both";
  linkedBoIds: string[];
  notes: string;
  updatedAt: string;
}

export interface NoticeDispatchRecord {
  id: string;
  meetingId: string;
  companyId: string;
  channel: "portal" | "email" | "sms" | "newspaper";
  language: "en" | "bn" | "bilingual";
  recipientCount: number;
  dispatchedBy: string;
  dispatchedAt: string;
  status: "delivered" | "published";
  reference: string;
}

export interface CommunicationBroadcast {
  id: string;
  companyId: string;
  meetingId?: string;
  category: "notice" | "reminder" | "dividend" | "results" | "general";
  subject: string;
  body: string;
  channels: ("portal" | "email" | "sms")[];
  recipientCount: number;
  sentBy: string;
  sentAt: string;
  status: "delivered";
}

export interface SupportTicket {
  id: string;
  ticketNo: string;
  companyId: string;
  boId: string;
  shareholderName: string;
  category: "bo_verification" | "proxy_instrument" | "dividend_claim" | "meeting_access" | "register_update";
  subject: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "resolved";
  assignedTo: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationAdapter {
  id: string;
  key: "cdbl" | "sms_gateway" | "email_smtp" | "video_bridge" | "rjsc_filing";
  name: string;
  provider: string;
  category: string;
  status: "connected" | "sandbox" | "disconnected";
  endpoint: string;
  lastSyncAt: string;
  lastSyncSummary: string;
}

export interface AppNotification {
  id: string;
  title: string;
  detail: string;
  at: string;
  read: boolean;
  tone: "info" | "warning" | "success";
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  companyId?: string;
}

/* --- shareholder portal (Phase 5 demo) ---------------------------------- */

export type ParticipantKind = "individual" | "corporate" | "proxy";

export interface DemoParticipant {
  id: string;
  kind: ParticipantKind;
  /** BO ID / folio — the register lookup key. */
  boId: string;
  /** Display name (individual: own; corporate: authorized person; proxy: proxy). */
  name: string;
  /** Legal account holder (individual: own name; corporate: company; proxy: grantor). */
  subjectName: string;
  companyId: string;
  eligibleShares: number;
  votingRights: number;
  /** Obfuscated mobile shown after identity match. Demo only. */
  mobile: string;
  /** Fixed OTP for the demo flow. In production this is a one-time SMS/email code. */
  otp: string;
}

export interface PortalVote {
  id: string;
  meetingId: string;
  agendaId: string;
  participantId: string;
  choice: "for" | "against" | "abstain";
  weight: number;
  reference: string;
  at: string;
}

export interface PortalDemand {
  id: string;
  meetingId: string;
  agendaId: string;
  participantId: string;
  shares: number;
  at: string;
}

export type QuestionStatus = "pending" | "approved" | "dismissed";
export type QuestionKind = "text" | "audio";

export interface MeetingQuestionRecord {
  id: string;
  meetingId: string;
  participantId: string;
  participantName: string;
  boId: string;
  kind: QuestionKind;
  body?: string;
  audioId?: string;
  durationSec?: number;
  status: QuestionStatus;
  at: string;
}

export interface PortalNotification {
  id: string;
  participantId: string;
  companyId: string;
  meetingId: string;
  kind: "notice" | "registration" | "deadline" | "meeting_started" | "meeting_ended" | "voting_open" | "voting_closed" | "question_approved" | "question_dismissed" | "document" | "appointment";
  title: string;
  detail: string;
  at: string;
  readAt?: string;
}

export interface MeetingDocument {
  id: string;
  companyId: string;
  meetingId: string;
  title: string;
  kind: "notice" | "annual_report" | "financials" | "minutes" | "form";
  fileName: string;
  mimeType: "text/plain" | "application/pdf";
  content: Uint8Array;
  text?: string;
  published: boolean;
  createdAt: string;
  publishedAt?: string;
}
