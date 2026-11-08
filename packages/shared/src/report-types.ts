import { z } from 'zod';

export const REPORT_FORMATS = ['pdf', 'xlsx', 'csv'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_KINDS = [
  'VOTING_RESULTS',
  'ATTENDANCE',
  'MOTIONS',
  'QUESTIONS',
  'AUDIT',
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_LABELS: Record<ReportKind, string> = {
  VOTING_RESULTS: 'Voting Results Tally Sheet',
  ATTENDANCE: 'Attendance & Quorum Log',
  MOTIONS: 'Proposals, Seconding & Poll Demands',
  QUESTIONS: 'Questions & Moderation Log',
  AUDIT: 'Meeting Audit Trail',
};

export const REPORT_DESCRIPTIONS: Record<ReportKind, string> = {
  VOTING_RESULTS: 'Official tally of all agenda resolutions with vote counts, percentages, and pass/fail determinations.',
  ATTENDANCE: 'Complete record of registered participants, representation capacity, and online presence duration.',
  MOTIONS: 'Official log of accepted proposers, seconders, and poll demands recorded during proceedings.',
  QUESTIONS: 'Written and audio questions submitted by shareholders, with moderator decisions and timestamps.',
  AUDIT: 'Chronological security and governance trail of state transitions, rule modifications, and session events.',
};

export const reportQuerySchema = z.object({
  format: z.enum(REPORT_FORMATS).default('pdf'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export interface ReportMeta {
  companyName: string;
  meetingTitle: string;
  meetingType: string;
  scheduledStart: string;
  venueOrMode: string;
  generatedAt: string;
  generatedBy: string;
}

export interface VotingResultRow {
  resolutionNumber: string;
  title: string;
  resolutionKind: string;
  votingMethod: string;
  requiredMajority: string;
  totalEligibleVotes: string;
  totalCastVotes: string;
  turnoutPct: string;
  forVotes: string;
  forPct: string;
  againstVotes: string;
  againstPct: string;
  abstainVotes: string;
  abstainPct: string;
  outcome: 'PASSED' | 'FAILED';
  sealedAt: string;
  releasedAt: string;
}

export interface AttendanceRow {
  name: string;
  capacity: string;
  identifier: string;
  representedWeight: string;
  firstJoinedAt: string;
  lastSeenAt: string;
  durationMinutes: number;
  onlineNow: boolean;
}

export interface MotionRow {
  agendaNumber: string;
  agendaTitle: string;
  stage: 'PROPOSAL' | 'SECONDING';
  memberName: string;
  representedWeight: string;
  submittedAt: string;
  status: string;
}

export interface PollDemandRow {
  agendaNumber: string;
  agendaTitle: string;
  demandCount: number;
  representedWeight: string;
  thresholdType: string;
  thresholdMet: boolean;
  chairAccepted: boolean;
  decidedAt: string;
}

export interface QuestionRow {
  submittedAt: string;
  submitterName: string;
  agendaItem: string;
  kind: 'TEXT' | 'AUDIO';
  language: string;
  questionContent: string;
  status: string;
  moderatedBy: string;
  rejectionReason?: string;
}

export interface AuditLogRow {
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}
