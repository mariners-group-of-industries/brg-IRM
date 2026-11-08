import type { ResolutionKind } from './meeting.js';
import type { ParticipantKind } from './shareholder.js';
import type { ShareCount } from './shareholder-types.js';
import type { BallotChoice, PrivilegedGrantStatus, VoteAuditEventType, VotingMethod } from './voting.js';

export interface VotingResultDto {
  forVotes: ShareCount | null;
  againstVotes: ShareCount | null;
  abstainVotes: ShareCount | null;
  forCount: number | null;
  againstCount: number | null;
  abstainCount: number | null;
  ballotCount: number | null;
  baseVotes: ShareCount | null;
  eligibleVotes: ShareCount | null;
  abstainCountsInBase: boolean;
  majorityNumerator: number;
  majorityDenominator: number;
  resolutionKind: ResolutionKind;
  passed: boolean;
  inputHash: string | null;
  sealedAt: string;
  releasedAt: string | null;
  weightsHidden: boolean;
}

export interface StaffVotingSessionDto {
  id: string;
  agendaItemId: string;
  agendaNumber: string;
  agendaTitle: string;
  resolutionKind: ResolutionKind;
  sessionNumber: number;
  method: VotingMethod;
  choices: BallotChoice[];
  abstainCountsInBase: boolean;
  allowChange: boolean;
  majorityNumerator: number;
  majorityDenominator: number;
  openedAt: string;
  closesAt: string | null;
  closedAt: string | null;
  reopenReason: string | null;
  ballotsCast: number;
  votesCast: ShareCount;
  releasedAt: string | null;
  resultsVisibleToCaller: boolean;
  result: VotingResultDto | null;
}

export interface ParticipantEntitlementDto {
  entitlementId: string;
  accountLabel: string;
  shareClass: string;
  votes: ShareCount;
}

export interface ParticipantBallotDto {
  id: string;
  entitlementId: string;
  choice: BallotChoice;
  weight: ShareCount;
  castAt: string;
}

export interface ParticipantVotingSessionDto {
  id: string;
  agendaItemId: string;
  sessionNumber: number;
  method: VotingMethod;
  choices: BallotChoice[];
  allowChange: boolean;
  openedAt: string;
  closesAt: string | null;
  closedAt: string | null;
  releasedAt: string | null;
  openForVoting: boolean;
  myBallots: ParticipantBallotDto[];
  result: VotingResultDto | null;
}

export interface CastVoteResult {
  votingSessionId: string;
  replayed: boolean;
  ballots: ParticipantBallotDto[];
}

export interface VoteAuditEventDto {
  id: string;
  sequenceNo: number;
  eventType: VoteAuditEventType;
  actorName: string | null;
  entitlementId: string | null;
  ballotId: string | null;
  reason: string | null;
  prevHash: string;
  hash: string;
  occurredAt: string;
}

export interface SessionIntegrityVerificationDto {
  votingSessionId: string;
  auditChainValid: boolean;
  auditEventCount: number;
  headHash: string | null;
  tallyValid: boolean;
  inputHashValid: boolean;
  error: string | null;
}

export interface IndividualBallotInspectionDto {
  id: string;
  entitlementId: string;
  shareholderName: string;
  accountLabel: string;
  shareClass: string;
  actingAs: ParticipantKind;
  choice: BallotChoice;
  weight: ShareCount;
  castAt: string;
  supersededAt: string | null;
}

export interface PrivilegedGrantDto {
  id: string;
  meetingId: string;
  permission: string;
  grantee: { userId: string; fullName: string; email: string | null };
  reason: string;
  durationMinutes: number;
  status: PrivilegedGrantStatus;
  effectiveNow: boolean;
  requestedBy: { userId: string; fullName: string; email: string | null };
  requestedAt: string;
  decidedBy: { userId: string; fullName: string } | null;
  decidedAt: string | null;
  decisionNote: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: { userId: string; fullName: string } | null;
  revokeNote: string | null;
}

export interface PrivilegedGrantCandidateDto {
  userId: string;
  fullName: string;
  email: string | null;
  roles: string[];
}

export interface PrivilegedGrantListDto {
  grants: PrivilegedGrantDto[];
  candidates: PrivilegedGrantCandidateDto[];
}

