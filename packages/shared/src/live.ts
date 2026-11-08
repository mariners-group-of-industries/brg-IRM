import { z } from 'zod';
import type { MeetingRules } from './meeting.js';
import type { ParticipantKind, ProxyScope } from './shareholder.js';

// ─── Stages ────────────────────────────────────────────────────────────

export const AGENDA_STAGES = ['PROPOSAL', 'SECONDING', 'POLL_DEMAND'] as const;
export type AgendaStage = (typeof AGENDA_STAGES)[number];
export const STAGE_LABELS: Record<AgendaStage, string> = {
  PROPOSAL: 'Proposal',
  SECONDING: 'Seconding',
  POLL_DEMAND: 'Poll demand',
};

export const MOTION_KINDS = ['PROPOSAL', 'SECONDING'] as const;
export type MotionKind = (typeof MOTION_KINDS)[number];

// ─── Capabilities ──────────────────────────────────────────────────────

export interface ParticipantCapabilities {
  propose: boolean;
  second: boolean;
  demandPoll: boolean;
  ask: boolean;
  /** Used by the voting engine in Phase E. */
  vote: boolean;
}

/**
 * What a registered participant may do in the live meeting, from their capacity and
 * the meeting rules. Members and corporate representatives have full rights. A proxy
 * may speak (propose, second, ask) only if the rules allow it, and may demand a poll
 * or vote only with an "attend and vote" appointment.
 *
 * These are configuration-driven defaults, not legal conclusions. See docs/VOTING_RULES.md.
 */
export function participantCapabilities(
  p: { kind: ParticipantKind; proxyScope?: ProxyScope | null },
  rules: Pick<MeetingRules, 'proxy' | 'pollDemand'>,
): ParticipantCapabilities {
  if (p.kind !== 'PROXY_REPRESENTATIVE') {
    return { propose: true, second: true, demandPoll: rules.pollDemand.enabled, ask: true, vote: true };
  }
  const votes = p.proxyScope === 'ATTEND_AND_VOTE';
  const speak = rules.proxy.canSpeak;
  return { propose: speak, second: speak, demandPoll: votes && rules.pollDemand.enabled, ask: speak, vote: votes };
}

/** Whether recorded poll demands meet the configured threshold. Reported to the chair; never auto-acts. */
export function pollThresholdMet(
  rules: Pick<MeetingRules, 'pollDemand'>,
  demands: { count: number; votes: bigint },
  totalVotes: bigint,
): boolean {
  const t = rules.pollDemand;
  if (demands.count === 0) return false;
  if (t.threshold === 'ANY_MEMBER') return true;
  if (t.threshold === 'MEMBERS_COUNT') return demands.count >= (t.thresholdValue ?? 1);
  if (totalVotes === 0n) return false;
  // Compare as integers: votes * 10000 >= total * percent * 100.
  const pct = BigInt(Math.round((t.thresholdValue ?? 0) * 100));
  return demands.votes * 10000n >= totalVotes * pct;
}

// ─── Inputs ────────────────────────────────────────────────────────────

export const stageToggleSchema = z.object({
  agendaItemId: z.string().uuid(),
  stage: z.enum(AGENDA_STAGES),
  open: z.boolean(),
});

export const activeItemSchema = z.object({ agendaItemId: z.string().uuid().nullable() });

export const motionSchema = z.object({
  agendaItemId: z.string().uuid(),
  kind: z.enum(MOTION_KINDS),
  /** Which registration to act under, when the person has more than one. */
  participantId: z.string().uuid().optional(),
});

export const pollDemandSchema = z.object({
  agendaItemId: z.string().uuid(),
  participantId: z.string().uuid().optional(),
});

export const textQuestionSchema = z.object({
  text: z.string().trim().min(3, 'Write at least a few words').max(2000, 'Keep it under 2,000 characters'),
  agendaItemId: z.string().uuid().optional().or(z.literal('')),
  participantId: z.string().uuid().optional(),
});

export const QUESTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'FORWARDED'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const MODERATION_ACTIONS = ['APPROVE', 'REJECT', 'FORWARD'] as const;
export type ModerationActionKind = (typeof MODERATION_ACTIONS)[number];

export const moderationSchema = z
  .object({ action: z.enum(MODERATION_ACTIONS), note: z.string().trim().max(500).optional() })
  .refine((v) => v.action !== 'REJECT' || (v.note ?? '').length >= 3, { message: 'Give a reason for rejecting', path: ['note'] });

export const announcementSchema = z.object({ body: z.string().trim().min(3).max(1000) });

export const videoRoomSchema = z.object({
  videoRoomId: z.string().trim().max(40, 'Keep it under 40 characters').nullable(),
});

/** Bangla detection for display and filtering. */
export const containsBangla = (s: string) => /[ঀ-৿]/.test(s);

// ─── Real-time events ──────────────────────────────────────────────────

/** Events are pointers only; clients refetch authoritative state over REST. */
export type MeetingEventType =
  | 'meeting.state'
  | 'agenda.active'
  | 'agenda.stage'
  | 'motion.changed'
  | 'poll.demand'
  | 'attendance.count'
  | 'announcement'
  | 'question.new'
  | 'question.updated'
  | 'question.forwarded';

export interface MeetingEvent {
  type: MeetingEventType;
  meetingId: string;
  at: string;
  /** Monotonic per process; a gap means the client should refetch everything. */
  seq: number;
  data?: Record<string, string | number | boolean | null>;
}
