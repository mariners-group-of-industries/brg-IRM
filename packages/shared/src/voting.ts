import { z } from 'zod';
import type { ResolutionKind } from './meeting.js';

export const VOTING_METHODS = ['SHARE_WEIGHTED', 'ONE_MEMBER_ONE_VOTE'] as const;
export type VotingMethod = (typeof VOTING_METHODS)[number];
export const VOTING_METHOD_LABELS: Record<VotingMethod, string> = {
  SHARE_WEIGHTED: 'Poll (weighted by shares)',
  ONE_MEMBER_ONE_VOTE: 'Show of hands (one vote per member)',
};

export const BALLOT_CHOICES = ['FOR', 'AGAINST', 'ABSTAIN'] as const;
export type BallotChoice = (typeof BALLOT_CHOICES)[number];
export const BALLOT_CHOICE_LABELS: Record<BallotChoice, string> = {
  FOR: 'For',
  AGAINST: 'Against',
  ABSTAIN: 'Abstain',
};

export const VOTE_AUDIT_EVENT_TYPES = [
  'SESSION_OPENED',
  'BALLOT_CAST',
  'BALLOT_SUPERSEDED',
  'VOTE_REJECTED',
  'SESSION_CLOSED',
  'RESULTS_RELEASED',
] as const;
export type VoteAuditEventType = (typeof VOTE_AUDIT_EVENT_TYPES)[number];

export const PRIVILEGED_GRANT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'REVOKED'] as const;
export type PrivilegedGrantStatus = (typeof PRIVILEGED_GRANT_STATUSES)[number];

export const PRIVILEGED_GRANT_DECISIONS = ['APPROVE', 'REJECT', 'REVOKE'] as const;
export type PrivilegedGrantDecision = (typeof PRIVILEGED_GRANT_DECISIONS)[number];

// ─── Inputs ────────────────────────────────────────────────────────────

export const openVotingSessionSchema = z
  .object({
    agendaItemId: z.string().uuid(),
    method: z.enum(VOTING_METHODS).optional(),
    closesAt: z.string().datetime({ offset: true }).nullable().optional(),
    durationSeconds: z.number().int().min(10).max(86_400).nullable().optional(),
    reopenReason: z.string().trim().max(500).optional(),
  })
  .refine((v) => !(v.closesAt && v.durationSeconds), {
    message: 'Specify either closesAt or durationSeconds, not both',
    path: ['durationSeconds'],
  });
export type OpenVotingSessionInput = z.input<typeof openVotingSessionSchema>;

export const singleEntitlementVoteSchema = z.object({
  entitlementId: z.string().uuid(),
  choice: z.enum(BALLOT_CHOICES),
});

export const castVoteSchema = z
  .object({
    votingSessionId: z.string().uuid(),
    participantId: z.string().uuid().optional(),
    choice: z.enum(BALLOT_CHOICES).optional(),
    entitlementId: z.string().uuid().optional(),
    votes: z.array(singleEntitlementVoteSchema).min(1).max(100).optional(),
  })
  .refine((v) => (v.choice !== undefined) !== (v.votes !== undefined), {
    message: 'Provide either choice or per-entitlement votes',
  })
  .refine((v) => !(v.entitlementId && v.votes), {
    message: 'Do not combine entitlementId with votes',
  })
  .refine(
    (v) => !v.votes || new Set(v.votes.map((x) => x.entitlementId)).size === v.votes.length,
    { message: 'Each entitlement may appear at most once per submission', path: ['votes'] },
  );
export type CastVoteInput = z.input<typeof castVoteSchema>;

export const requestPrivilegedGrantSchema = z.object({
  meetingId: z.string().uuid(),
  granteeUserId: z.string().uuid(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  reason: z.string().trim().min(10, 'Provide a justification of at least 10 characters').max(500),
});
export type RequestPrivilegedGrantInput = z.input<typeof requestPrivilegedGrantSchema>;

export const decidePrivilegedGrantSchema = z
  .object({
    decision: z.enum(PRIVILEGED_GRANT_DECISIONS),
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === 'APPROVE' || (v.note ?? '').trim().length >= 3, {
    message: 'Provide a reason for rejecting or revoking',
    path: ['note'],
  });
export type DecidePrivilegedGrantInput = z.input<typeof decidePrivilegedGrantSchema>;

// ─── Pure deterministic tally ──────────────────────────────────────────

export interface TallyBallotInput {
  choice: BallotChoice;
  weight: bigint;
}

export interface TallyComputationInput {
  ballots: readonly TallyBallotInput[];
  resolutionKind: ResolutionKind;
  majority: { numerator: number; denominator: number };
  abstainCountsInBase: boolean;
  eligibleVotes: bigint;
}

export interface TallyComputationOutput {
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  forCount: number;
  againstCount: number;
  abstainCount: number;
  ballotCount: number;
  baseVotes: bigint;
  eligibleVotes: bigint;
  passed: boolean;
}

/**
 * Deterministic bigint-exact majority calculation (zero floating point).
 * - ORDINARY resolutions pass when strictly greater: forVotes * den > baseVotes * num.
 * - SPECIAL resolutions pass when at least: forVotes * den >= baseVotes * num.
 * - Zero votes in base never passes.
 */
export function computeTally(input: TallyComputationInput): TallyComputationOutput {
  let forVotes = 0n;
  let againstVotes = 0n;
  let abstainVotes = 0n;
  let forCount = 0;
  let againstCount = 0;
  let abstainCount = 0;

  for (const b of input.ballots) {
    if (b.choice === 'FOR') {
      forVotes += b.weight;
      forCount += 1;
    } else if (b.choice === 'AGAINST') {
      againstVotes += b.weight;
      againstCount += 1;
    } else {
      abstainVotes += b.weight;
      abstainCount += 1;
    }
  }

  const baseVotes = input.abstainCountsInBase
    ? forVotes + againstVotes + abstainVotes
    : forVotes + againstVotes;

  let passed = false;
  if (baseVotes > 0n) {
    const lhs = forVotes * BigInt(input.majority.denominator);
    const rhs = baseVotes * BigInt(input.majority.numerator);
    passed = input.resolutionKind === 'SPECIAL' ? lhs >= rhs : lhs > rhs;
  }

  return {
    forVotes,
    againstVotes,
    abstainVotes,
    forCount,
    againstCount,
    abstainCount,
    ballotCount: forCount + againstCount + abstainCount,
    baseVotes,
    eligibleVotes: input.eligibleVotes,
    passed,
  };
}

