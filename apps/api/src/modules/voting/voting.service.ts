import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PERMISSIONS,
  computeTally,
  maskIdentifier,
  meetingRulesSchema,
  type BallotChoice,
  type CastVoteInput,
  type CastVoteResult,
  type DecidePrivilegedGrantInput,
  type IndividualBallotInspectionDto,
  type OpenVotingSessionInput,
  type ParticipantBallotDto,
  type ParticipantEntitlementDto,
  type ParticipantVotingSessionDto,
  type PrivilegedGrantCandidateDto,
  type PrivilegedGrantDto,
  type PrivilegedGrantListDto,
  type RequestPrivilegedGrantInput,
  type SessionIntegrityVerificationDto,
  type StaffVotingSessionDto,
  type VoteAuditEventDto,
  type VoteAuditEventType,
  type VotingMethod,
  type VotingResultDto,
} from '@irm/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { MeetingEventsService } from '../live/meeting-events.service.js';
import { isEffective } from '../register/authorization-rules.js';

type Tx = Prisma.TransactionClient;

export interface Scope {
  tenantId: string;
  companyId: string;
}

const GENESIS_PREV_HASH = '0'.repeat(64);
const BALLOT_INSPECTION_PERMISSION = PERMISSIONS.BALLOT_INDIVIDUAL_READ;

export function computeEventHash(params: {
  votingSessionId: string;
  sequenceNo: number;
  eventType: VoteAuditEventType;
  occurredAt: Date;
  actorUserId: string | null;
  entitlementId: string | null;
  ballotId: string | null;
  reason: string | null;
  prevHash: string;
}): string {
  const canonical = JSON.stringify({
    votingSessionId: params.votingSessionId,
    sequenceNo: params.sequenceNo,
    eventType: params.eventType,
    occurredAt: params.occurredAt.toISOString(),
    actorUserId: params.actorUserId,
    entitlementId: params.entitlementId,
    ballotId: params.ballotId,
    reason: params.reason,
    prevHash: params.prevHash,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function computeInputHash(
  votingSessionId: string,
  orderedEffectiveBallotIds: readonly string[],
  sealAuditHash: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ votingSessionId, ballotIds: orderedEffectiveBallotIds, sealAuditHash }))
    .digest('hex');
}

function isPgUniqueConflict(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

@Injectable()
export class VotingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly events: MeetingEventsService,
  ) {}

  // ─── Staff Session Lifecycle ───────────────────────────────────────────

  async listStaffSessions(
    p: AuthPrincipal,
    scope: Scope,
    meetingId: string,
    forBoardRoom = false,
  ): Promise<StaffVotingSessionDto[]> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId: scope.companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      return this.buildStaffSessions(tx, m, p, forBoardRoom);
    });
  }

  async buildStaffSessions(
    tx: Tx,
    meeting: { id: string; tenantId: string; companyId: string; rules: unknown },
    p: AuthPrincipal,
    forBoardRoom = false,
  ): Promise<StaffVotingSessionDto[]> {
    const rules = meetingRulesSchema.parse(meeting.rules);
    const sessions = await tx.votingSession.findMany({
      where: { meetingId: meeting.id },
      orderBy: [{ openedAt: 'asc' }, { sessionNumber: 'asc' }],
      include: {
        agendaItem: { include: { resolution: true } },
        result: true,
      },
    });
    if (sessions.length === 0) return [];

    const turnoutRows = await tx.ballot.groupBy({
      by: ['votingSessionId'],
      where: { meetingId: meeting.id, supersededAt: null },
      _count: { id: true },
      _sum: { weight: true },
    });
    const turnoutMap = new Map(
      turnoutRows.map((row) => [
        row.votingSessionId,
        { ballotsCast: row._count.id, votesCast: (row._sum.weight ?? 0n).toString() },
      ]),
    );

    const scope: Scope = { tenantId: meeting.tenantId, companyId: meeting.companyId };
    const visibilityAccess = this.resolveStaffResultVisibility(p, scope, rules.results.visibility, forBoardRoom);

    return sessions.map((s) => {
      const turnout = turnoutMap.get(s.id) ?? { ballotsCast: 0, votesCast: '0' };
      const canSeeResult =
        !!s.result &&
        (visibilityAccess === 'ALWAYS_CLOSED' || (visibilityAccess === 'RELEASED_ONLY' && s.result.releasedAt !== null));

      return {
        id: s.id,
        agendaItemId: s.agendaItemId,
        agendaNumber: s.agendaItem.number,
        agendaTitle: s.agendaItem.title,
        resolutionKind: s.agendaItem.resolution?.kind ?? 'ORDINARY',
        sessionNumber: s.sessionNumber,
        method: s.method,
        choices: s.choices as BallotChoice[],
        abstainCountsInBase: s.abstainCountsInBase,
        allowChange: s.allowChange,
        majorityNumerator: s.majorityNumerator,
        majorityDenominator: s.majorityDenominator,
        openedAt: s.openedAt.toISOString(),
        closesAt: s.closesAt?.toISOString() ?? null,
        closedAt: s.closedAt?.toISOString() ?? null,
        reopenReason: s.reopenReason,
        ballotsCast: turnout.ballotsCast,
        votesCast: turnout.votesCast,
        releasedAt: s.result?.releasedAt?.toISOString() ?? null,
        resultsVisibleToCaller: canSeeResult,
        result: canSeeResult && s.result ? this.toResultDto(s.result, true) : null,
      };
    });
  }

  /**
   * Determines whether a staff caller may see closed session results before public release.
   * - Callers without `voting.results.read` see no results.
   * - `BOARD_MEMBER`-only callers (and any view inside Board Room) NEVER see pre-release results.
   * - Company/Meeting Admins see pre-release results only when `rules.results.visibility === 'STAFF_AFTER_CLOSE'`.
   */
  private resolveStaffResultVisibility(
    p: AuthPrincipal,
    scope: Scope,
    visibilityRule: 'STAFF_AFTER_CLOSE' | 'ALL_AFTER_RELEASE',
    forBoardRoom: boolean,
  ): 'NONE' | 'RELEASED_ONLY' | 'ALWAYS_CLOSED' {
    const matchingWithRead = p.assignments.filter((a) => {
      const inScope =
        (a.scope === 'TENANT' && a.tenantId === scope.tenantId) ||
        (a.scope === 'COMPANY' && a.companyId === scope.companyId);
      return inScope && a.permissions.includes(PERMISSIONS.VOTING_RESULTS_READ);
    });
    if (matchingWithRead.length === 0) return 'NONE';
    if (forBoardRoom) return 'RELEASED_ONLY';
    const hasNonBoardReader = matchingWithRead.some((a) => a.roleKey !== 'BOARD_MEMBER');
    if (hasNonBoardReader && visibilityRule === 'STAFF_AFTER_CLOSE') return 'ALWAYS_CLOSED';
    return 'RELEASED_ONLY';
  }

  async openSession(
    p: AuthPrincipal,
    scope: Scope,
    meetingId: string,
    input: OpenVotingSessionInput,
    meta: RequestMeta,
  ): Promise<StaffVotingSessionDto> {
    const created = await this.prisma.scoped([scope.companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId: scope.companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.state !== 'LIVE') {
        throw new ConflictException('Voting sessions can only be opened while the meeting is live');
      }

      const item = await tx.agendaItem.findFirst({
        where: { id: input.agendaItemId, meetingId, companyId: scope.companyId },
        include: { resolution: true },
      });
      if (!item) throw new NotFoundException('Agenda item not found');
      if (!item.resolution) {
        throw new BadRequestException('Procedural agenda items without a resolution cannot be voted on');
      }

      const existingOpen = await tx.votingSession.findFirst({
        where: { agendaItemId: item.id, closedAt: null },
        select: { id: true },
      });
      if (existingOpen) {
        throw new ConflictException('A voting session is already open for this agenda item');
      }

      const priorCount = await tx.votingSession.count({ where: { agendaItemId: item.id } });
      const reopenReason = input.reopenReason?.trim() || null;
      if (priorCount > 0 && (!reopenReason || reopenReason.length < 5)) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: {
            reopenReason: [
              'Closing is final; provide a reason of at least 5 characters to open a new voting session',
            ],
          },
        });
      }

      let closesAt: Date | null = null;
      if (input.durationSeconds) {
        closesAt = new Date(Date.now() + input.durationSeconds * 1000);
      } else if (input.closesAt) {
        const parsedClose = new Date(input.closesAt);
        if (Number.isNaN(parsedClose.getTime()) || parsedClose <= new Date()) {
          throw new BadRequestException({
            message: 'Validation failed',
            errors: { closesAt: ['Closing time must be in the future'] },
          });
        }
        closesAt = parsedClose;
      }

      const rules = meetingRulesSchema.parse(m.rules);
      const method: VotingMethod = input.method ?? rules.votingMethod;
      const majority =
        item.resolution.kind === 'SPECIAL' ? rules.specialMajority : rules.ordinaryMajority;

      let session;
      try {
        session = await tx.votingSession.create({
          data: {
            tenantId: m.tenantId,
            companyId: m.companyId,
            meetingId: m.id,
            agendaItemId: item.id,
            sessionNumber: priorCount + 1,
            method,
            choices: rules.choices,
            abstainCountsInBase: rules.abstainCountsInBase,
            allowChange: rules.allowVoteChange,
            majorityNumerator: majority.numerator,
            majorityDenominator: majority.denominator,
            openedById: p.userId,
            closesAt,
            reopenReason,
          },
        });
      } catch (err) {
        if (isPgUniqueConflict(err)) {
          throw new ConflictException('A voting session is already open for this agenda item');
        }
        throw err;
      }

      await this.appendVoteAuditEvent(tx, session, 'SESSION_OPENED', {
        actorUserId: p.userId,
        reason: reopenReason ?? 'Voting session opened',
      });

      await this.audit.record(
        {
          action: 'voting.session_open',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          ...scope,
          targetType: 'voting_session',
          targetId: session.id,
          metadata: {
            meetingId: m.id,
            agendaItemId: item.id,
            sessionNumber: session.sessionNumber,
            method: session.method,
            hasReopenReason: !!reopenReason,
          },
          meta,
        },
        tx,
      );

      return (await this.buildStaffSessions(tx, m, p)).find((s) => s.id === session.id)!;
    });

    this.events.emit(meetingId, 'voting.session', 'all', {
      sessionId: created.id,
      agendaItemId: created.agendaItemId,
      status: 'OPEN',
    });
    return created;
  }

  async closeSession(
    p: AuthPrincipal,
    scope: Scope,
    meetingId: string,
    sessionId: string,
    meta: RequestMeta,
  ): Promise<StaffVotingSessionDto> {
    const updated = await this.prisma.scoped([scope.companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId: scope.companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.state !== 'LIVE' && m.state !== 'PAUSED') {
        throw new ConflictException('Voting sessions can only be closed while the meeting is live or paused');
      }

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM voting_sessions WHERE id = ${sessionId}::uuid AND meeting_id = ${meetingId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('Voting session not found');

      const session = await tx.votingSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { agendaItem: { include: { resolution: true } } },
      });
      if (session.closedAt !== null) {
        throw new ConflictException('This voting session is already closed');
      }
      if (!session.agendaItem.resolution) {
        throw new ConflictException('Resolution missing for voting session');
      }

      const effectiveBallots = await tx.ballot.findMany({
        where: { votingSessionId: session.id, supersededAt: null },
        orderBy: [{ castAt: 'asc' }, { id: 'asc' }],
      });

      const entitlements = await tx.votingEntitlement.findMany({
        where: { meetingId },
        select: { shareholderId: true, weight: true },
      });
      const eligibleVotes =
        session.method === 'ONE_MEMBER_ONE_VOTE'
          ? BigInt(new Set(entitlements.map((e) => e.shareholderId)).size)
          : entitlements.reduce((sum, e) => sum + e.weight, 0n);

      const tally = computeTally({
        ballots: effectiveBallots.map((b) => ({ choice: b.choice, weight: b.weight })),
        resolutionKind: session.agendaItem.resolution.kind,
        majority: { numerator: session.majorityNumerator, denominator: session.majorityDenominator },
        abstainCountsInBase: session.abstainCountsInBase,
        eligibleVotes,
      });

      const now = new Date();
      await tx.votingSession.update({
        where: { id: session.id },
        data: { closedAt: now, closedById: p.userId },
      });

      const sealEvent = await this.appendVoteAuditEvent(tx, session, 'SESSION_CLOSED', {
        actorUserId: p.userId,
        reason: 'Session closed and tally sealed',
      });

      const inputHash = computeInputHash(
        session.id,
        effectiveBallots.map((b) => b.id),
        sealEvent.hash,
      );

      await tx.votingResult.create({
        data: {
          tenantId: session.tenantId,
          companyId: session.companyId,
          meetingId: session.meetingId,
          votingSessionId: session.id,
          resolutionKind: session.agendaItem.resolution.kind,
          forVotes: tally.forVotes,
          againstVotes: tally.againstVotes,
          abstainVotes: tally.abstainVotes,
          forCount: tally.forCount,
          againstCount: tally.againstCount,
          abstainCount: tally.abstainCount,
          ballotCount: tally.ballotCount,
          baseVotes: tally.baseVotes,
          eligibleVotes: tally.eligibleVotes,
          abstainCountsInBase: session.abstainCountsInBase,
          majorityNumerator: session.majorityNumerator,
          majorityDenominator: session.majorityDenominator,
          passed: tally.passed,
          sealAuditSeq: sealEvent.sequenceNo,
          sealAuditHash: sealEvent.hash,
          inputHash,
          sealedAt: now,
        },
      });

      await this.audit.record(
        {
          action: 'voting.session_close',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          ...scope,
          targetType: 'voting_session',
          targetId: session.id,
          metadata: {
            meetingId,
            agendaItemId: session.agendaItemId,
            effectiveVotesCast: tally.ballotCount,
            passed: tally.passed,
          },
          meta,
        },
        tx,
      );

      return (await this.buildStaffSessions(tx, m, p)).find((s) => s.id === session.id)!;
    });

    this.events.emit(meetingId, 'voting.session', 'all', {
      sessionId: updated.id,
      agendaItemId: updated.agendaItemId,
      status: 'CLOSED',
    });
    return updated;
  }

  async releaseResults(
    p: AuthPrincipal,
    scope: Scope,
    meetingId: string,
    sessionId: string,
    meta: RequestMeta,
  ): Promise<StaffVotingSessionDto> {
    const updated = await this.prisma.scoped([scope.companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId: scope.companyId } });
      if (!m) throw new NotFoundException('Meeting not found');

      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM voting_sessions WHERE id = ${sessionId}::uuid AND meeting_id = ${meetingId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('Voting session not found');

      const session = await tx.votingSession.findUniqueOrThrow({ where: { id: sessionId } });
      if (session.closedAt === null) {
        throw new ConflictException('Close the voting session before releasing results');
      }

      const result = await tx.votingResult.findUnique({ where: { votingSessionId: session.id } });
      if (!result) throw new NotFoundException('Voting result not found');
      if (result.releasedAt !== null) {
        throw new ConflictException('Voting results have already been released');
      }

      await tx.votingResult.update({
        where: { id: result.id },
        data: { releasedAt: new Date(), releasedById: p.userId },
      });

      await this.appendVoteAuditEvent(tx, session, 'RESULTS_RELEASED', {
        actorUserId: p.userId,
        reason: 'Results released to participants and board',
      });

      await this.audit.record(
        {
          action: 'voting.results_release',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          ...scope,
          targetType: 'voting_session',
          targetId: session.id,
          metadata: { meetingId, agendaItemId: session.agendaItemId, passed: result.passed },
          meta,
        },
        tx,
      );

      return (await this.buildStaffSessions(tx, m, p)).find((s) => s.id === session.id)!;
    });

    this.events.emit(meetingId, 'results.released', 'all', {
      sessionId: updated.id,
      agendaItemId: updated.agendaItemId,
    });
    return updated;
  }

  async getSessionResults(
    p: AuthPrincipal,
    scope: Scope,
    meetingId: string,
    sessionId: string,
  ): Promise<VotingResultDto> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId: scope.companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      const rules = meetingRulesSchema.parse(m.rules);

      const session = await tx.votingSession.findFirst({
        where: { id: sessionId, meetingId },
        include: { result: true },
      });
      if (!session) throw new NotFoundException('Voting session not found');
      if (!session.closedAt || !session.result) {
        throw new ConflictException('Results are sealed until the voting session is closed');
      }

      const visibility = this.resolveStaffResultVisibility(p, scope, rules.results.visibility, false);
      if (visibility === 'NONE') {
        throw new ForbiddenException('You do not have permission to view voting results');
      }
      if (visibility === 'RELEASED_ONLY' && session.result.releasedAt === null) {
        throw new ForbiddenException('Voting results have not been released yet');
      }
      return this.toResultDto(session.result, true);
    });
  }

  async getSessionAudit(scope: Scope, meetingId: string, sessionId: string): Promise<VoteAuditEventDto[]> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const session = await tx.votingSession.findFirst({
        where: { id: sessionId, meetingId, companyId: scope.companyId },
        select: { id: true },
      });
      if (!session) throw new NotFoundException('Voting session not found');

      const events = await tx.voteAuditEvent.findMany({
        where: { votingSessionId: session.id },
        orderBy: { sequenceNo: 'asc' },
      });

      const userIds = [...new Set(events.map((e) => e.actorUserId).filter((u): u is string => !!u))];
      const users = userIds.length
        ? await tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u.fullName]));

      return events.map((e) => ({
        id: e.id,
        sequenceNo: e.sequenceNo,
        eventType: e.eventType as VoteAuditEventType,
        actorName: e.actorUserId ? (userMap.get(e.actorUserId) ?? null) : null,
        entitlementId: e.entitlementId,
        ballotId: e.ballotId,
        reason: e.reason,
        prevHash: e.prevHash,
        hash: e.hash,
        occurredAt: e.occurredAt.toISOString(),
      }));
    });
  }

  async verifySessionIntegrity(
    scope: Scope,
    meetingId: string,
    sessionId: string,
  ): Promise<SessionIntegrityVerificationDto> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const session = await tx.votingSession.findFirst({
        where: { id: sessionId, meetingId, companyId: scope.companyId },
        include: { result: true, agendaItem: { include: { resolution: true } } },
      });
      if (!session) throw new NotFoundException('Voting session not found');

      const events = await tx.voteAuditEvent.findMany({
        where: { votingSessionId: session.id },
        orderBy: { sequenceNo: 'asc' },
      });

      let auditChainValid = events.length > 0;
      let expectedSeq = 1;
      let expectedPrev = GENESIS_PREV_HASH;
      let error: string | null = events.length === 0 ? 'No vote audit events recorded' : null;

      for (const ev of events) {
        if (ev.sequenceNo !== expectedSeq) {
          auditChainValid = false;
          error = `Audit sequence gap at ${ev.sequenceNo}, expected ${expectedSeq}`;
          break;
        }
        if (ev.prevHash !== expectedPrev) {
          auditChainValid = false;
          error = `Audit prevHash mismatch at sequence ${ev.sequenceNo}`;
          break;
        }
        const computed = computeEventHash({
          votingSessionId: ev.votingSessionId,
          sequenceNo: ev.sequenceNo,
          eventType: ev.eventType as VoteAuditEventType,
          occurredAt: ev.occurredAt,
          actorUserId: ev.actorUserId,
          entitlementId: ev.entitlementId,
          ballotId: ev.ballotId,
          reason: ev.reason,
          prevHash: ev.prevHash,
        });
        if (computed !== ev.hash) {
          auditChainValid = false;
          error = `Audit hash mismatch at sequence ${ev.sequenceNo}`;
          break;
        }
        expectedSeq += 1;
        expectedPrev = ev.hash;
      }

      let tallyValid = true;
      let inputHashValid = true;

      if (session.result) {
        const effectiveBallots = await tx.ballot.findMany({
          where: { votingSessionId: session.id, supersededAt: null },
          orderBy: [{ castAt: 'asc' }, { id: 'asc' }],
        });
        const recomputed = computeTally({
          ballots: effectiveBallots.map((b) => ({ choice: b.choice, weight: b.weight })),
          resolutionKind: session.result.resolutionKind,
          majority: {
            numerator: session.result.majorityNumerator,
            denominator: session.result.majorityDenominator,
          },
          abstainCountsInBase: session.result.abstainCountsInBase,
          eligibleVotes: session.result.eligibleVotes,
        });

        tallyValid =
          recomputed.forVotes === session.result.forVotes &&
          recomputed.againstVotes === session.result.againstVotes &&
          recomputed.abstainVotes === session.result.abstainVotes &&
          recomputed.forCount === session.result.forCount &&
          recomputed.againstCount === session.result.againstCount &&
          recomputed.abstainCount === session.result.abstainCount &&
          recomputed.ballotCount === session.result.ballotCount &&
          recomputed.baseVotes === session.result.baseVotes &&
          recomputed.passed === session.result.passed;

        if (!tallyValid && !error) {
          error = 'Stored voting result does not match recomputed tally from effective ballots';
        }

        const sealEvent = events.find(
          (e) =>
            e.sequenceNo === session.result!.sealAuditSeq &&
            e.eventType === 'SESSION_CLOSED' &&
            e.hash === session.result!.sealAuditHash,
        );
        const expectedInputHash = sealEvent
          ? computeInputHash(
              session.id,
              effectiveBallots.map((b) => b.id),
              sealEvent.hash,
            )
          : null;
        inputHashValid = expectedInputHash === session.result.inputHash;
        if (!inputHashValid && !error) {
          error = 'Result inputHash does not match ordered effective ballots and close audit seal';
        }
      }

      return {
        votingSessionId: session.id,
        auditChainValid,
        auditEventCount: events.length,
        headHash: events[events.length - 1]?.hash ?? null,
        tallyValid,
        inputHashValid,
        error,
      };
    });
  }

  // ─── Participant Voting & Room Integration ─────────────────────────────

  async buildParticipantContext(
    tx: Tx,
    userId: string,
    meeting: { id: string; rules: unknown; state: string },
    regs: {
      id: string;
      kind: 'SHAREHOLDER' | 'CORPORATE_REPRESENTATIVE' | 'PROXY_REPRESENTATIVE';
      shareholderId: string;
      proxyId: string | null;
      corporateRepId: string | null;
      entitlementIds: string[];
    }[],
  ): Promise<{
    entitlementsByParticipant: Map<string, ParticipantEntitlementDto[]>;
    proxySuspendedByParticipant: Map<string, boolean>;
    votingSessions: ParticipantVotingSessionDto[];
  }> {
    const rules = meetingRulesSchema.parse(meeting.rules);

    const allEntitlementIds = [...new Set(regs.flatMap((r) => r.entitlementIds))];
    const entitlements = allEntitlementIds.length
      ? await tx.votingEntitlement.findMany({
          where: { id: { in: allEntitlementIds } },
          include: {
            snapshot: { select: { shareClassId: true } },
          },
          orderBy: { id: 'asc' },
        })
      : [];

    const identityIds = [...new Set(entitlements.map((e) => e.identityId))];
    const shareClassIds = [...new Set(entitlements.map((e) => e.snapshot.shareClassId))];

    const [identities, shareClasses] = await Promise.all([
      identityIds.length
        ? tx.shareholderIdentity.findMany({
            where: { id: { in: identityIds } },
            select: { id: true, kind: true, value: true },
          })
        : [],
      shareClassIds.length
        ? tx.shareClass.findMany({
            where: { id: { in: shareClassIds } },
            select: { id: true, code: true },
          })
        : [],
    ]);
    const idMap = new Map(identities.map((i) => [i.id, `${i.kind === 'BO' ? 'BO' : 'Folio'} ${maskIdentifier(i.value)}`]));
    const classMap = new Map(shareClasses.map((c) => [c.id, c.code]));
    const entMap = new Map(entitlements.map((e) => [e.id, e]));

    // Check corporate reps active status & allowed identityIds.
    const corpRepIds = regs.map((r) => r.corporateRepId).filter((x): x is string => !!x);
    const corpReps = corpRepIds.length
      ? await tx.corporateRepresentative.findMany({ where: { id: { in: corpRepIds } } })
      : [];
    const corpRepMap = new Map(corpReps.map((cr) => [cr.id, cr]));

    const entitlementsByParticipant = new Map<string, ParticipantEntitlementDto[]>();
    for (const r of regs) {
      const rep = r.corporateRepId ? corpRepMap.get(r.corporateRepId) : null;
      const allowedIdentitySet = rep ? new Set(rep.identityIds) : null;
      const dtos: ParticipantEntitlementDto[] = [];
      for (const eid of r.entitlementIds) {
        const ent = entMap.get(eid);
        if (!ent) continue;
        if (allowedIdentitySet && !allowedIdentitySet.has(ent.identityId)) continue;
        dtos.push({
          entitlementId: ent.id,
          accountLabel: idMap.get(ent.identityId) ?? 'Account',
          shareClass: classMap.get(ent.snapshot.shareClassId) ?? '',
          votes: ent.weight.toString(),
        });
      }
      entitlementsByParticipant.set(r.id, dtos);
    }

    const sessions = await tx.votingSession.findMany({
      where: { meetingId: meeting.id },
      orderBy: [{ openedAt: 'asc' }, { sessionNumber: 'asc' }],
      include: { result: true },
    });

    const now = new Date();
    const openSessionIds = sessions
      .filter((s) => s.closedAt === null && (!s.closesAt || s.closesAt > now))
      .map((s) => s.id);

    // Determine proxy suspension from shareholder presence in live attendance or direct ballot in open sessions.
    const proxyRegs = regs.filter((r) => r.kind === 'PROXY_REPRESENTATIVE');
    const proxySuspendedByParticipant = new Map<string, boolean>();
    if (proxyRegs.length > 0 && rules.proxy.shareholderPresencePrecedence === 'SHAREHOLDER_REVOKES_PROXY') {
      const grantorIds = [...new Set(proxyRegs.map((r) => r.shareholderId))];
      const directHolderRegs = await tx.meetingParticipant.findMany({
        where: {
          meetingId: meeting.id,
          shareholderId: { in: grantorIds },
          kind: 'SHAREHOLDER',
          status: 'REGISTERED',
        },
        select: { shareholderId: true, userId: true },
      });
      const activeUserIds = directHolderRegs.length
        ? new Set(
            (
              await tx.meetingAttendance.findMany({
                where: {
                  meetingId: meeting.id,
                  role: 'PARTICIPANT',
                  leftAt: null,
                  userId: { in: directHolderRegs.map((d) => d.userId) },
                },
                select: { userId: true },
              })
            ).map((a) => a.userId),
          )
        : new Set<string>();

      const presentShareholderIds = new Set(
        directHolderRegs.filter((d) => activeUserIds.has(d.userId)).map((d) => d.shareholderId),
      );
      if (openSessionIds.length > 0) {
        const directBallots = await tx.ballot.findMany({
          where: {
            votingSessionId: { in: openSessionIds },
            shareholderId: { in: grantorIds },
            actingAs: 'SHAREHOLDER',
            supersededAt: null,
          },
          select: { shareholderId: true },
        });
        for (const db of directBallots) presentShareholderIds.add(db.shareholderId);
      }

      for (const pr of proxyRegs) {
        proxySuspendedByParticipant.set(pr.id, presentShareholderIds.has(pr.shareholderId));
      }
    } else {
      for (const pr of proxyRegs) {
        proxySuspendedByParticipant.set(pr.id, false);
      }
    }

    const participantIds = regs.map((r) => r.id);
    const myEffectiveBallots = sessions.length
      ? await tx.ballot.findMany({
          where: {
            votingSessionId: { in: sessions.map((s) => s.id) },
            supersededAt: null,
            OR: [{ castingUserId: userId }, { participantId: { in: participantIds } }],
          },
          orderBy: { castAt: 'asc' },
        })
      : [];

    const ballotsBySession = new Map<string, ParticipantBallotDto[]>();
    for (const b of myEffectiveBallots) {
      const list = ballotsBySession.get(b.votingSessionId) ?? [];
      list.push({
        id: b.id,
        entitlementId: b.entitlementId,
        choice: b.choice as BallotChoice,
        weight: b.weight.toString(),
        castAt: b.castAt.toISOString(),
      });
      ballotsBySession.set(b.votingSessionId, list);
    }

    const meetingAllowsVoting = meeting.state === 'LIVE' || meeting.state === 'PAUSED';
    const votingSessions: ParticipantVotingSessionDto[] = sessions.map((s) => {
      const notExpired = !s.closesAt || s.closesAt > now;
      const openForVoting = meetingAllowsVoting && s.closedAt === null && notExpired;
      const released = s.result?.releasedAt !== null && s.result?.releasedAt !== undefined;
      return {
        id: s.id,
        agendaItemId: s.agendaItemId,
        sessionNumber: s.sessionNumber,
        method: s.method as VotingMethod,
        choices: s.choices as BallotChoice[],
        allowChange: s.allowChange,
        openedAt: s.openedAt.toISOString(),
        closesAt: s.closesAt?.toISOString() ?? null,
        closedAt: s.closedAt?.toISOString() ?? null,
        releasedAt: s.result?.releasedAt?.toISOString() ?? null,
        openForVoting,
        myBallots: ballotsBySession.get(s.id) ?? [],
        result: released && s.result ? this.toResultDto(s.result, rules.results.showWeights) : null,
      };
    });

    return {
      entitlementsByParticipant,
      proxySuspendedByParticipant,
      votingSessions,
    };
  }

  async getParticipantResults(p: AuthPrincipal, meetingId: string): Promise<ParticipantVotingSessionDto[]> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    return this.prisma.scoped(companyIds, async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId: { in: companyIds } } });
      if (!m) throw new NotFoundException('Meeting not found');
      const regs = await tx.meetingParticipant.findMany({
        where: { userId: p.userId, meetingId, status: 'REGISTERED' },
      });
      if (regs.length === 0) throw new ForbiddenException('You are not registered for this meeting');
      const ctx = await this.buildParticipantContext(tx, p.userId, m, regs);
      return ctx.votingSessions;
    });
  }

  async castBallot(
    p: AuthPrincipal,
    meetingId: string,
    rawIdempotencyKey: string | undefined,
    input: CastVoteInput,
    meta: RequestMeta,
  ): Promise<CastVoteResult> {
    const idempotencyKey = rawIdempotencyKey?.trim() ?? '';
    if (!idempotencyKey || idempotencyKey.length > 128) {
      throw new BadRequestException('Idempotency-Key header is required (1-128 characters)');
    }

    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const canonicalPayload = JSON.stringify({
      votingSessionId: input.votingSessionId,
      participantId: input.participantId ?? null,
      choice: input.choice ?? null,
      entitlementId: input.entitlementId ?? null,
      votes: input.votes
        ? [...input.votes].sort((a, b) => a.entitlementId.localeCompare(b.entitlementId))
        : null,
    });
    const requestHash = createHash('sha256').update(canonicalPayload).digest('hex');

    let knownSessionInScope = false;

    try {
      const res = await this.prisma.scoped(companyIds, async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM voting_sessions WHERE id = ${input.votingSessionId}::uuid AND meeting_id = ${meetingId}::uuid FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new NotFoundException('Voting session not found');
        }
        knownSessionInScope = true;

        const session = await tx.votingSession.findUniqueOrThrow({ where: { id: input.votingSessionId } });

        // Check idempotency record immediately after locking the session.
        const existingIdemp = await tx.voteIdempotencyRecord.findUnique({
          where: {
            votingSessionId_userId_idempotencyKey: {
              votingSessionId: session.id,
              userId: p.userId,
              idempotencyKey,
            },
          },
        });
        if (existingIdemp) {
          if (existingIdemp.requestHash !== requestHash) {
            throw new ConflictException('Idempotency-Key was already used with a different voting payload');
          }
          const saved = existingIdemp.response as unknown as CastVoteResult;
          return {
            result: { ...saved, replayed: true },
            emitBallot: false,
            sessionInfo: { tenantId: session.tenantId, companyId: session.companyId, agendaItemId: session.agendaItemId },
          };
        }

        const m = await tx.meeting.findFirst({ where: { id: session.meetingId, companyId: session.companyId } });
        if (!m) throw new NotFoundException('Meeting not found');
        if (m.state !== 'LIVE' && m.state !== 'PAUSED') {
          throw new ConflictException('Voting is only permitted while the meeting is live or paused');
        }
        if (session.closedAt !== null) {
          throw new ConflictException('This voting session is closed');
        }
        if (session.closesAt && session.closesAt <= new Date()) {
          throw new ConflictException('This voting session has expired');
        }

        const regs = await tx.meetingParticipant.findMany({
          where: { userId: p.userId, meetingId: m.id, status: 'REGISTERED' },
        });
        const reg = input.participantId
          ? regs.find((r) => r.id === input.participantId)
          : regs.length === 1
            ? regs[0]
            : null;

        if (!reg) {
          if (!input.participantId && regs.length > 1) {
            throw new BadRequestException('Specify which registration to vote under');
          }
          throw new ForbiddenException('You are not registered to vote in this meeting');
        }

        await this.access.assert(
          p,
          PERMISSIONS.VOTE_CAST,
          { tenantId: session.tenantId, companyId: session.companyId },
          meta,
        );

        const rules = meetingRulesSchema.parse(m.rules);

        let allowedIdentityIds: Set<string> | null = null;
        if (reg.kind === 'CORPORATE_REPRESENTATIVE') {
          const rep = reg.corporateRepId
            ? await tx.corporateRepresentative.findFirst({
                where: { id: reg.corporateRepId, companyId: session.companyId },
              })
            : null;
          if (!rep || !isEffective(rep)) {
            throw new ForbiddenException('Your corporate representative authorization is no longer active');
          }
          allowedIdentityIds = new Set(rep.identityIds);
        } else if (reg.kind === 'PROXY_REPRESENTATIVE') {
          if (!rules.proxy.allowed) {
            throw new ForbiddenException('Proxy voting is disabled for this meeting');
          }
          const proxy = reg.proxyId
            ? await tx.proxyAuthorization.findFirst({
                where: { id: reg.proxyId, companyId: session.companyId },
              })
            : null;
          if (!proxy || proxy.meetingId !== m.id || !isEffective(proxy)) {
            throw new ForbiddenException('Your proxy authorization is not active for this meeting');
          }
          if (proxy.scope !== 'ATTEND_AND_VOTE') {
            throw new ForbiddenException('Your proxy authorization is for attendance only');
          }
          if (rules.proxy.shareholderPresencePrecedence === 'SHAREHOLDER_REVOKES_PROXY') {
            const directHolderRegs = await tx.meetingParticipant.findMany({
              where: {
                meetingId: m.id,
                shareholderId: reg.shareholderId,
                kind: 'SHAREHOLDER',
                status: 'REGISTERED',
              },
              select: { userId: true },
            });
            const holderInRoom =
              directHolderRegs.length > 0 &&
              !!(await tx.meetingAttendance.findFirst({
                where: {
                  meetingId: m.id,
                  role: 'PARTICIPANT',
                  leftAt: null,
                  userId: { in: directHolderRegs.map((d) => d.userId) },
                },
                select: { id: true },
              }));
            const holderAlreadyVoted = !!(await tx.ballot.findFirst({
              where: {
                votingSessionId: session.id,
                shareholderId: reg.shareholderId,
                actingAs: 'SHAREHOLDER',
                supersededAt: null,
              },
              select: { id: true },
            }));
            if (holderInRoom || holderAlreadyVoted) {
              throw new ForbiddenException(
                'Proxy voting authority is suspended because the shareholder is present or has voted directly',
              );
            }
          }
        }

        // Lock entitlements in deterministic order to avoid deadlocks.
        const lockedEntIds = reg.entitlementIds.length
          ? (
              await tx.$queryRaw<{ id: string }[]>`
                SELECT id FROM voting_entitlements
                WHERE meeting_id = ${m.id}::uuid AND id = ANY (${reg.entitlementIds}::uuid[])
                ORDER BY id
                FOR UPDATE
              `
            ).map((r) => r.id)
          : [];
        const allEnts = lockedEntIds.length
          ? await tx.votingEntitlement.findMany({
              where: { id: { in: lockedEntIds } },
              orderBy: { id: 'asc' },
            })
          : [];
        const eligibleEnts = allowedIdentityIds
          ? allEnts.filter((e) => allowedIdentityIds.has(e.identityId))
          : allEnts;
        if (eligibleEnts.length === 0) {
          throw new ForbiddenException('You hold no voting entitlements for this meeting');
        }

        const entMap = new Map(eligibleEnts.map((e) => [e.id, e]));
        const targets: { entitlement: (typeof eligibleEnts)[number]; choice: BallotChoice }[] = [];

        if (input.votes) {
          if (session.method === 'ONE_MEMBER_ONE_VOTE' && input.votes.length > 1) {
            throw new BadRequestException(
              'Show of hands (one vote per member) does not permit split votes across accounts',
            );
          }
          for (const v of input.votes) {
            const ent = entMap.get(v.entitlementId);
            if (!ent) {
              throw new ForbiddenException('Specified voting entitlement is not covered by your registration');
            }
            targets.push({ entitlement: ent, choice: v.choice });
          }
        } else if (input.entitlementId) {
          const ent = entMap.get(input.entitlementId);
          if (!ent) {
            throw new ForbiddenException('Specified voting entitlement is not covered by your registration');
          }
          targets.push({ entitlement: ent, choice: input.choice! });
        } else if (session.method === 'ONE_MEMBER_ONE_VOTE') {
          targets.push({ entitlement: eligibleEnts[0]!, choice: input.choice! });
        } else {
          for (const ent of eligibleEnts) {
            targets.push({ entitlement: ent, choice: input.choice! });
          }
        }

        const enabledChoices = new Set(session.choices as BallotChoice[]);
        for (const t of targets) {
          if (!enabledChoices.has(t.choice)) {
            throw new BadRequestException(`Choice ${t.choice} is not permitted for this voting session`);
          }
        }

        const now = new Date();
        const createdBallots: ParticipantBallotDto[] = [];

        for (const target of targets) {
          // Under ONE_MEMBER_ONE_VOTE, check shareholder-level effective ballots across any account too.
          const existing =
            session.method === 'ONE_MEMBER_ONE_VOTE'
              ? await tx.ballot.findFirst({
                  where: {
                    votingSessionId: session.id,
                    shareholderId: reg.shareholderId,
                    supersededAt: null,
                  },
                })
              : await tx.ballot.findFirst({
                  where: {
                    votingSessionId: session.id,
                    entitlementId: target.entitlement.id,
                    supersededAt: null,
                  },
                });

          if (existing) {
            const proxySupersededByShareholder =
              reg.kind === 'SHAREHOLDER' &&
              existing.actingAs === 'PROXY_REPRESENTATIVE' &&
              rules.proxy.shareholderPresencePrecedence === 'SHAREHOLDER_REVOKES_PROXY';

            if (!proxySupersededByShareholder) {
              if (!session.allowChange) {
                throw new ConflictException(
                  'A vote has already been cast and changes are not allowed in this session',
                );
              }
              if (existing.castingUserId !== p.userId && reg.kind !== 'SHAREHOLDER') {
                throw new ForbiddenException('Only the original voter may change this ballot');
              }
            }

            await tx.ballot.update({
              where: { id: existing.id },
              data: { supersededAt: now },
            });

            const reason = proxySupersededByShareholder
              ? 'Superseded by grantor shareholder presence'
              : 'Superseded by voter vote change';

            await this.appendVoteAuditEvent(tx, session, 'BALLOT_SUPERSEDED', {
              actorUserId: p.userId,
              entitlementId: existing.entitlementId,
              ballotId: existing.id,
              reason,
            });

            if (proxySupersededByShareholder) {
              await this.audit.record(
                {
                  action: 'proxy.precedence_superseded',
                  outcome: 'SUCCESS',
                  actorUserId: p.userId,
                  tenantId: session.tenantId,
                  companyId: session.companyId,
                  targetType: 'voting_session',
                  targetId: session.id,
                  metadata: {
                    shareholderId: reg.shareholderId,
                    entitlementId: existing.entitlementId,
                  },
                  meta,
                },
                tx,
              );
            }
          }

          const weight = session.method === 'ONE_MEMBER_ONE_VOTE' ? 1n : target.entitlement.weight;

          let inserted;
          try {
            inserted = await tx.ballot.create({
              data: {
                tenantId: session.tenantId,
                companyId: session.companyId,
                meetingId: session.meetingId,
                votingSessionId: session.id,
                entitlementId: target.entitlement.id,
                participantId: reg.id,
                castingUserId: p.userId,
                shareholderId: reg.shareholderId,
                actingAs: reg.kind,
                method: session.method,
                choice: target.choice,
                weight,
                idempotencyKey,
                castAt: now,
              },
            });
          } catch (err) {
            if (isPgUniqueConflict(err)) {
              throw new ConflictException('A ballot has already been recorded for this entitlement');
            }
            throw err;
          }

          await this.appendVoteAuditEvent(tx, session, 'BALLOT_CAST', {
            actorUserId: p.userId,
            entitlementId: target.entitlement.id,
            ballotId: inserted.id,
          });

          createdBallots.push({
            id: inserted.id,
            entitlementId: inserted.entitlementId,
            choice: inserted.choice as BallotChoice,
            weight: inserted.weight.toString(),
            castAt: inserted.castAt.toISOString(),
          });
        }

        const castResult: CastVoteResult = {
          votingSessionId: session.id,
          replayed: false,
          ballots: createdBallots,
        };

        await tx.voteIdempotencyRecord.create({
          data: {
            tenantId: session.tenantId,
            companyId: session.companyId,
            meetingId: session.meetingId,
            votingSessionId: session.id,
            userId: p.userId,
            idempotencyKey,
            requestHash,
            response: castResult as unknown as Prisma.InputJsonValue,
          },
        });

        await this.audit.record(
          {
            action: 'vote.cast',
            outcome: 'SUCCESS',
            actorUserId: p.userId,
            tenantId: session.tenantId,
            companyId: session.companyId,
            targetType: 'voting_session',
            targetId: session.id,
            metadata: {
              meetingId: session.meetingId,
              actingAs: reg.kind,
              entitlementCount: createdBallots.length,
            },
            meta,
          },
          tx,
        );

        return {
          result: castResult,
          emitBallot: true,
          sessionInfo: { tenantId: session.tenantId, companyId: session.companyId, agendaItemId: session.agendaItemId },
        };
      });

      if (res.emitBallot) {
        this.events.emit(meetingId, 'voting.ballot', 'staff', {
          sessionId: res.result.votingSessionId,
          agendaItemId: res.sessionInfo.agendaItemId,
        });
      }
      return res.result;
    } catch (err) {
      if (knownSessionInScope && err instanceof HttpException && err.getStatus() < 500) {
        await this.recordRejectedVoteAudit(
          companyIds,
          input.votingSessionId,
          p.userId,
          input.entitlementId ?? input.votes?.[0]?.entitlementId ?? null,
          err.message,
          meta,
        );
      }
      throw err;
    }
  }

  private async recordRejectedVoteAudit(
    companyIds: string[],
    votingSessionId: string,
    actorUserId: string,
    entitlementId: string | null,
    reason: string,
    meta: RequestMeta,
  ): Promise<void> {
    try {
      await this.prisma.scoped(companyIds, async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM voting_sessions WHERE id = ${votingSessionId}::uuid FOR UPDATE
        `;
        if (locked.length === 0) return;
        const session = await tx.votingSession.findUniqueOrThrow({ where: { id: votingSessionId } });
        await this.appendVoteAuditEvent(tx, session, 'VOTE_REJECTED', {
          actorUserId,
          entitlementId,
          reason: reason.slice(0, 500),
        });
        await this.audit.record(
          {
            action: 'vote.rejected',
            outcome: 'DENIED',
            actorUserId,
            tenantId: session.tenantId,
            companyId: session.companyId,
            targetType: 'voting_session',
            targetId: session.id,
            metadata: { meetingId: session.meetingId, reason: reason.slice(0, 200) },
            meta,
          },
          tx,
        );
      });
    } catch {
      // Never mask the original HTTP error if audit persistence hits a secondary issue.
    }
  }

  // ─── Scrutineer Four-Eyes Privileged Grants & Inspection ───────────────

  async listPrivilegedGrants(
    p: AuthPrincipal,
    scope: Scope,
    meetingId?: string,
  ): Promise<PrivilegedGrantListDto> {
    const canManage = this.access.can(p, PERMISSIONS.AUTHORIZATION_MANAGE, scope);
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const grants = await tx.privilegedAccessGrant.findMany({
        where: {
          companyId: scope.companyId,
          ...(meetingId ? { meetingId } : {}),
          ...(!canManage ? { granteeUserId: p.userId } : {}),
        },
        orderBy: { requestedAt: 'desc' },
      });

      const userIds = [
        ...new Set(
          grants.flatMap((g) =>
            [g.granteeUserId, g.requestedById, g.decidedById, g.revokedById].filter(
              (u): u is string => !!u,
            ),
          ),
        ),
      ];
      const users = userIds.length
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      let candidates: PrivilegedGrantCandidateDto[] = [];
      if (canManage) {
        const staffAssignments = await this.prisma.userRoleAssignment.findMany({
          where: {
            revokedAt: null,
            OR: [
              { scope: 'COMPANY', companyId: scope.companyId },
              { scope: 'TENANT', tenantId: scope.tenantId },
            ],
            user: { kind: 'STAFF', status: 'ACTIVE' },
          },
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            role: { select: { name: true, participant: true } },
          },
        });
        const byUser = new Map<string, PrivilegedGrantCandidateDto>();
        for (const a of staffAssignments) {
          if (a.role.participant) continue;
          const existing = byUser.get(a.user.id);
          if (existing) {
            if (!existing.roles.includes(a.role.name)) existing.roles.push(a.role.name);
          } else {
            byUser.set(a.user.id, {
              userId: a.user.id,
              fullName: a.user.fullName,
              email: a.user.email,
              roles: [a.role.name],
            });
          }
        }
        candidates = [...byUser.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
      }

      const now = new Date();
      return {
        grants: grants.map((g) => this.toGrantDto(g, userMap, now)),
        candidates,
      };
    });
  }

  async requestPrivilegedGrant(
    p: AuthPrincipal,
    scope: Scope,
    input: RequestPrivilegedGrantInput,
    meta: RequestMeta,
  ): Promise<PrivilegedGrantDto> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: input.meetingId, companyId: scope.companyId } });
      if (!m) throw new NotFoundException('Meeting not found');

      const grantee = await this.prisma.user.findFirst({
        where: {
          id: input.granteeUserId,
          kind: 'STAFF',
          status: 'ACTIVE',
          assignments: {
            some: {
              revokedAt: null,
              role: { participant: false },
              OR: [
                { scope: 'COMPANY', companyId: scope.companyId },
                { scope: 'TENANT', tenantId: scope.tenantId },
              ],
            },
          },
        },
        select: { id: true, fullName: true, email: true },
      });
      if (!grantee) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: { granteeUserId: ['Grantee must be an active company staff member'] },
        });
      }

      const created = await tx.privilegedAccessGrant.create({
        data: {
          tenantId: scope.tenantId,
          companyId: scope.companyId,
          meetingId: m.id,
          permission: BALLOT_INSPECTION_PERMISSION,
          granteeUserId: grantee.id,
          reason: input.reason,
          durationMinutes: input.durationMinutes ?? 30,
          status: 'PENDING',
          requestedById: p.userId,
        },
      });

      await this.audit.record(
        {
          action: 'privileged_grant.request',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          ...scope,
          targetType: 'privileged_access_grant',
          targetId: created.id,
          metadata: {
            meetingId: m.id,
            granteeUserId: grantee.id,
            permission: BALLOT_INSPECTION_PERMISSION,
            durationMinutes: created.durationMinutes,
          },
          meta,
        },
        tx,
      );

      const userMap = new Map<string, { id: string; fullName: string; email: string | null }>([
        [grantee.id, grantee],
        [p.userId, { id: p.userId, fullName: p.fullName, email: p.email }],
      ]);
      return this.toGrantDto(created, userMap, new Date());
    });
  }

  async decidePrivilegedGrant(
    p: AuthPrincipal,
    scope: Scope,
    grantId: string,
    input: DecidePrivilegedGrantInput,
    meta: RequestMeta,
  ): Promise<PrivilegedGrantDto> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM privileged_access_grants WHERE id = ${grantId}::uuid AND company_id = ${scope.companyId}::uuid FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('Privileged access grant not found');

      const grant = await tx.privilegedAccessGrant.findUniqueOrThrow({ where: { id: grantId } });
      const now = new Date();

      let updated;
      if (input.decision === 'REVOKE') {
        if (grant.status !== 'APPROVED') {
          throw new ConflictException('Only approved grants can be revoked');
        }
        updated = await tx.privilegedAccessGrant.update({
          where: { id: grant.id },
          data: {
            status: 'REVOKED',
            revokedAt: now,
            revokedById: p.userId,
            revokeNote: input.note?.trim() || 'Revoked by administrator',
          },
        });
      } else {
        if (grant.status !== 'PENDING') {
          throw new ConflictException('This request has already been decided');
        }
        if (grant.requestedById === p.userId) {
          throw new ForbiddenException('Four-eyes rule: the requester cannot approve or reject their own request');
        }
        if (grant.granteeUserId === p.userId) {
          throw new ForbiddenException('Four-eyes rule: the grantee cannot decide their own privileged grant');
        }
        updated = await tx.privilegedAccessGrant.update({
          where: { id: grant.id },
          data: {
            status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            decidedById: p.userId,
            decidedAt: now,
            decisionNote: input.note?.trim() || null,
            ...(input.decision === 'APPROVE'
              ? { expiresAt: new Date(now.getTime() + grant.durationMinutes * 60_000) }
              : {}),
          },
        });
      }

      const actionName =
        input.decision === 'APPROVE'
          ? 'privileged_grant.approve'
          : input.decision === 'REJECT'
            ? 'privileged_grant.reject'
            : 'privileged_grant.revoke';

      await this.audit.record(
        {
          action: actionName,
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          ...scope,
          targetType: 'privileged_access_grant',
          targetId: grant.id,
          metadata: {
            meetingId: grant.meetingId,
            granteeUserId: grant.granteeUserId,
            status: updated.status,
          },
          meta,
        },
        tx,
      );

      const userIds = [
        updated.granteeUserId,
        updated.requestedById,
        updated.decidedById,
        updated.revokedById,
      ].filter((u): u is string => !!u);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true, email: true },
      });
      return this.toGrantDto(updated, new Map(users.map((u) => [u.id, u])), now);
    });
  }

  async inspectSessionBallots(
    p: AuthPrincipal,
    scope: Scope,
    meetingId: string,
    sessionId: string,
    meta: RequestMeta,
  ): Promise<IndividualBallotInspectionDto[]> {
    return this.prisma.scoped([scope.companyId], async (tx) => {
      const session = await tx.votingSession.findFirst({
        where: { id: sessionId, meetingId, companyId: scope.companyId },
        select: { id: true, meetingId: true },
      });
      if (!session) throw new NotFoundException('Voting session not found');

      const now = new Date();
      const activeGrant = await tx.privilegedAccessGrant.findFirst({
        where: {
          companyId: scope.companyId,
          meetingId,
          granteeUserId: p.userId,
          permission: BALLOT_INSPECTION_PERMISSION,
          status: 'APPROVED',
          revokedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { expiresAt: 'desc' },
      });

      if (!activeGrant) {
        await this.audit.record(
          {
            action: 'access.denied',
            outcome: 'DENIED',
            actorUserId: p.userId,
            actorEmail: p.email,
            ...scope,
            targetType: 'voting_session',
            targetId: sessionId,
            metadata: { permission: BALLOT_INSPECTION_PERMISSION, meetingId },
            meta,
          },
          tx,
        );
        throw new ForbiddenException(
          'Individual ballot inspection requires an active, approved four-eyes privileged grant',
        );
      }

      const ballots = await tx.ballot.findMany({
        where: { votingSessionId: session.id },
        orderBy: [{ castAt: 'asc' }, { id: 'asc' }],
        include: {
          entitlement: {
            include: {
              snapshot: { select: { shareClassId: true } },
            },
          },
        },
      });

      const shareholderIds = [...new Set(ballots.map((b) => b.shareholderId))];
      const identityIds = [...new Set(ballots.map((b) => b.entitlement.identityId))];
      const shareClassIds = [...new Set(ballots.map((b) => b.entitlement.snapshot.shareClassId))];

      const [holders, identities, shareClasses] = await Promise.all([
        shareholderIds.length
          ? tx.shareholder.findMany({ where: { id: { in: shareholderIds } }, select: { id: true, name: true } })
          : [],
        identityIds.length
          ? tx.shareholderIdentity.findMany({
              where: { id: { in: identityIds } },
              select: { id: true, kind: true, value: true },
            })
          : [],
        shareClassIds.length
          ? tx.shareClass.findMany({ where: { id: { in: shareClassIds } }, select: { id: true, code: true } })
          : [],
      ]);

      const holderMap = new Map(holders.map((h) => [h.id, h.name]));
      const idMap = new Map(
        identities.map((i) => [i.id, `${i.kind === 'BO' ? 'BO' : 'Folio'} ${maskIdentifier(i.value)}`]),
      );
      const classMap = new Map(shareClasses.map((c) => [c.id, c.code]));

      await this.audit.record(
        {
          action: 'voting.individual_inspection',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          ...scope,
          targetType: 'voting_session',
          targetId: sessionId,
          metadata: { meetingId, grantId: activeGrant.id, rowCount: ballots.length },
          meta,
        },
        tx,
      );

      return ballots.map((b) => ({
        id: b.id,
        entitlementId: b.entitlementId,
        shareholderName: holderMap.get(b.shareholderId) ?? 'Shareholder',
        accountLabel: idMap.get(b.entitlement.identityId) ?? 'Account',
        shareClass: classMap.get(b.entitlement.snapshot.shareClassId) ?? '',
        actingAs: b.actingAs,
        choice: b.choice as BallotChoice,
        weight: b.weight.toString(),
        castAt: b.castAt.toISOString(),
        supersededAt: b.supersededAt?.toISOString() ?? null,
      }));
    });
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────

  private async appendVoteAuditEvent(
    tx: Tx,
    session: { id: string; tenantId: string; companyId: string; meetingId: string },
    eventType: VoteAuditEventType,
    opts: {
      actorUserId?: string | null;
      entitlementId?: string | null;
      ballotId?: string | null;
      reason?: string | null;
    },
  ) {
    const last = await tx.voteAuditEvent.findFirst({
      where: { votingSessionId: session.id },
      orderBy: { sequenceNo: 'desc' },
      select: { sequenceNo: true, hash: true },
    });
    const sequenceNo = (last?.sequenceNo ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS_PREV_HASH;
    const occurredAt = new Date();
    const actorUserId = opts.actorUserId ?? null;
    const entitlementId = opts.entitlementId ?? null;
    const ballotId = opts.ballotId ?? null;
    const reason = opts.reason ?? null;
    const hash = computeEventHash({
      votingSessionId: session.id,
      sequenceNo,
      eventType,
      occurredAt,
      actorUserId,
      entitlementId,
      ballotId,
      reason,
      prevHash,
    });
    return tx.voteAuditEvent.create({
      data: {
        tenantId: session.tenantId,
        companyId: session.companyId,
        meetingId: session.meetingId,
        votingSessionId: session.id,
        sequenceNo,
        eventType,
        actorUserId,
        entitlementId,
        ballotId,
        reason,
        prevHash,
        hash,
        occurredAt,
      },
    });
  }

  private async participantCompanies(p: AuthPrincipal): Promise<string[]> {
    if (p.kind !== 'PARTICIPANT') {
      throw new ForbiddenException('This area is for registered meeting participants');
    }
    const links = await this.prisma.participantLink.findMany({
      where: { userId: p.userId },
      select: { companyId: true },
      distinct: ['companyId'],
    });
    return links.map((l) => l.companyId);
  }

  private toResultDto(
    r: Prisma.VotingResultGetPayload<object>,
    showWeights: boolean,
  ): VotingResultDto {
    return {
      forVotes: showWeights ? r.forVotes.toString() : null,
      againstVotes: showWeights ? r.againstVotes.toString() : null,
      abstainVotes: showWeights ? r.abstainVotes.toString() : null,
      forCount: showWeights ? r.forCount : null,
      againstCount: showWeights ? r.againstCount : null,
      abstainCount: showWeights ? r.abstainCount : null,
      ballotCount: showWeights ? r.ballotCount : null,
      baseVotes: showWeights ? r.baseVotes.toString() : null,
      eligibleVotes: showWeights ? r.eligibleVotes.toString() : null,
      abstainCountsInBase: r.abstainCountsInBase,
      majorityNumerator: r.majorityNumerator,
      majorityDenominator: r.majorityDenominator,
      resolutionKind: r.resolutionKind,
      passed: r.passed,
      inputHash: r.inputHash,
      sealedAt: r.sealedAt.toISOString(),
      releasedAt: r.releasedAt?.toISOString() ?? null,
      weightsHidden: !showWeights,
    };
  }

  private toGrantDto(
    g: Prisma.PrivilegedAccessGrantGetPayload<object>,
    users: Map<string, { id: string; fullName: string; email: string | null }>,
    now: Date,
  ): PrivilegedGrantDto {
    const grantee = users.get(g.granteeUserId);
    const requester = users.get(g.requestedById);
    const decider = g.decidedById ? users.get(g.decidedById) : undefined;
    const revoker = g.revokedById ? users.get(g.revokedById) : undefined;
    const effectiveNow =
      g.status === 'APPROVED' && !g.revokedAt && !!g.expiresAt && g.expiresAt > now;

    return {
      id: g.id,
      meetingId: g.meetingId,
      permission: g.permission,
      grantee: {
        userId: g.granteeUserId,
        fullName: grantee?.fullName ?? 'Staff member',
        email: grantee?.email ?? null,
      },
      reason: g.reason,
      durationMinutes: g.durationMinutes,
      status: g.status,
      effectiveNow,
      requestedBy: {
        userId: g.requestedById,
        fullName: requester?.fullName ?? 'Administrator',
        email: requester?.email ?? null,
      },
      requestedAt: g.requestedAt.toISOString(),
      decidedBy: g.decidedById
        ? { userId: g.decidedById, fullName: decider?.fullName ?? 'Administrator' }
        : null,
      decidedAt: g.decidedAt?.toISOString() ?? null,
      decisionNote: g.decisionNote,
      expiresAt: g.expiresAt?.toISOString() ?? null,
      revokedAt: g.revokedAt?.toISOString() ?? null,
      revokedBy: g.revokedById
        ? { userId: g.revokedById, fullName: revoker?.fullName ?? 'Administrator' }
        : null,
      revokeNote: g.revokeNote,
    };
  }
}
