import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  PERMISSIONS,
  PUBLISHED_STATES,
  STAGE_LABELS,
  containsBangla,
  meetingRulesSchema,
  participantCapabilities,
  pollThresholdMet,
  type AgendaStage,
  type AnnouncementDto,
  type AttendanceSummary,
  type BoardRoom,
  type LiveAgendaItem,
  type LiveConsole,
  type MeetingRoom,
  type MeetingRules,
  type MeetingState,
  type MotionDto,
  type MotionKind,
  type PollDemandSummary,
  type QuestionDto,
  type QuestionStatus,
  type RoomRegistration,
  type VideoJoinInfo,
} from '@irm/shared';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AccessService } from '../access/access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { StorageService } from '../storage/storage.service.js';
import { MeetingEventsService } from './meeting-events.service.js';
import { VideoService } from './video.service.js';
import { VotingService } from '../voting/voting.service.js';

type Tx = Prisma.TransactionClient;

export function sniffAudioMime(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'audio/webm';
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return 'audio/ogg';
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg';
  if (buf.length >= 2 && buf[0] === 0xff && ((buf[1] ?? 0) & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buf.length >= 8 && buf.subarray(4, 8).toString('latin1') === 'ftyp') return 'audio/mp4';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WAVE') return 'audio/wav';
  return null;
}

@Injectable()
export class LiveService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly events: MeetingEventsService,
    private readonly video: VideoService,
    private readonly voting: VotingService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Close any open attendance rows left over from a previous process exit.
    await this.prisma.meetingAttendance.updateMany({
      where: { leftAt: null },
      data: { leftAt: new Date() },
    });
  }

  // ─── Staff Live Console ────────────────────────────────────────────────

  async getConsole(companyId: string, meetingId: string, p?: AuthPrincipal): Promise<LiveConsole> {
    return this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({
        where: { id: meetingId, companyId },
        include: {
          agendaItems: {
            orderBy: { position: 'asc' },
            include: { resolution: true },
          },
        },
      });
      if (!m) throw new NotFoundException('Meeting not found');

      const rules = meetingRulesSchema.parse(m.rules);
      const motions = await tx.motion.findMany({
        where: { meetingId },
        orderBy: { createdAt: 'asc' },
      });

      const shareholderIds = [...new Set(motions.map((mot) => mot.shareholderId))];
      const shareholders = shareholderIds.length
        ? await tx.shareholder.findMany({
            where: { id: { in: shareholderIds } },
            select: { id: true, name: true },
          })
        : [];
      const holderNameMap = new Map(shareholders.map((s) => [s.id, s.name]));

      const motionsByItem = new Map<string, MotionDto[]>();
      for (const mot of motions) {
        const list = motionsByItem.get(mot.agendaItemId) ?? [];
        list.push({
          id: mot.id,
          kind: mot.kind,
          status: mot.status,
          shareholderName: holderNameMap.get(mot.shareholderId) ?? 'Shareholder',
          actingAs: mot.actingAs,
          createdAt: mot.createdAt.toISOString(),
        });
        motionsByItem.set(mot.agendaItemId, list);
      }

      const pollDemands = await tx.pollDemand.findMany({
        where: { meetingId },
      });
      const pollDemandsByItem = new Map<string, { count: number; votes: bigint }>();
      for (const pd of pollDemands) {
        const cur = pollDemandsByItem.get(pd.agendaItemId) ?? { count: 0, votes: 0n };
        cur.count += 1;
        cur.votes += pd.votes;
        pollDemandsByItem.set(pd.agendaItemId, cur);
      }

      const entitlements = await tx.votingEntitlement.findMany({
        where: { meetingId },
        select: { id: true, weight: true },
      });
      const totalMeetingVotes = entitlements.reduce((sum, e) => sum + e.weight, 0n);

      const agenda = m.agendaItems.map((item) => {
        const itemMotions = motionsByItem.get(item.id) ?? [];
        const acceptedProposal = itemMotions.find((mot) => mot.kind === 'PROPOSAL' && mot.status === 'ACCEPTED') ?? null;
        const acceptedSeconding = itemMotions.find((mot) => mot.kind === 'SECONDING' && mot.status === 'ACCEPTED') ?? null;

        const pdStats = pollDemandsByItem.get(item.id) ?? { count: 0, votes: 0n };
        const thresholdMet = pollThresholdMet(rules, pdStats, totalMeetingVotes);

        return {
          id: item.id,
          number: item.number,
          title: item.title,
          description: item.description,
          position: item.position,
          resolution: item.resolution
            ? {
                kind: item.resolution.kind,
                text: item.resolution.text,
                requiresProposal: item.resolution.requiresProposal,
                requiresSeconding: item.resolution.requiresSeconding,
              }
            : null,
          stages: {
            PROPOSAL: item.proposalOpen,
            SECONDING: item.secondingOpen,
            POLL_DEMAND: item.pollDemandOpen,
          },
          accepted: {
            PROPOSAL: acceptedProposal,
            SECONDING: acceptedSeconding,
          },
          motions: itemMotions,
          pollDemands: {
            count: pdStats.count,
            votes: pdStats.votes.toString(),
            thresholdMet,
          },
        };
      });

      const attendance = await this.compileAttendanceSummary(tx, meetingId, totalMeetingVotes);
      const announcements = await this.loadAnnouncements(tx, meetingId);

      const questionCounts = await tx.meetingQuestion.groupBy({
        by: ['status'],
        where: { meetingId },
        _count: { status: true },
      });
      const questions: Record<QuestionStatus, number> = {
        PENDING: 0,
        APPROVED: 0,
        REJECTED: 0,
        FORWARDED: 0,
      };
      for (const qc of questionCounts) {
        questions[qc.status as QuestionStatus] = qc._count.status;
      }

      const votingSessions = p ? await this.voting.buildStaffSessions(tx, m, p, false) : [];

      return {
        meetingId: m.id,
        videoRoomId: m.videoRoomId,
        state: m.state as MeetingState,
        version: m.version,
        rules,
        activeAgendaItemId: m.activeAgendaItemId,
        agenda,
        attendance,
        announcements,
        questions,
        votingSessions,
      };
    });
  }

  private async compileAttendanceSummary(tx: Tx, meetingId: string, totalMeetingVotes: bigint): Promise<AttendanceSummary> {
    const activeAttendance = await tx.meetingAttendance.findMany({
      where: { meetingId, leftAt: null },
    });

    const participantAttendances = activeAttendance.filter((a) => a.role === 'PARTICIPANT');
    const staffAttendances = activeAttendance.filter((a) => a.role !== 'PARTICIPANT');

    const distinctParticipantUsers = new Set(participantAttendances.map((a) => a.userId));
    const distinctStaffUsers = new Set(staffAttendances.map((a) => a.userId));

    const allParticipantIds = [...new Set(participantAttendances.flatMap((a) => a.participantIds))];
    const registrations = allParticipantIds.length
      ? await tx.meetingParticipant.findMany({
          where: { id: { in: allParticipantIds }, status: 'REGISTERED' },
          select: { id: true, entitlementIds: true },
        })
      : [];

    const activeEntitlementIds = [...new Set(registrations.flatMap((r) => r.entitlementIds))];
    const activeEntitlements = activeEntitlementIds.length
      ? await tx.votingEntitlement.findMany({
          where: { id: { in: activeEntitlementIds } },
          select: { weight: true },
        })
      : [];
    const votesPresent = activeEntitlements.reduce((sum, e) => sum + e.weight, 0n);

    const totalRegistered = await tx.meetingParticipant.count({
      where: { meetingId, status: 'REGISTERED' },
    });

    return {
      participantsPresent: distinctParticipantUsers.size,
      votesPresent: votesPresent.toString(),
      registered: totalRegistered,
      totalVotes: totalMeetingVotes.toString(),
      staffPresent: distinctStaffUsers.size,
    };
  }

  private async loadAnnouncements(tx: Tx, meetingId: string, includeAuthor = true): Promise<AnnouncementDto[]> {
    const raw = await tx.meetingAnnouncement.findMany({
      where: { meetingId, retractedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!includeAuthor || raw.length === 0) {
      return raw.map((a) => ({
        id: a.id,
        body: a.body,
        createdAt: a.createdAt.toISOString(),
        author: null,
      }));
    }
    const creatorIds = [...new Set(raw.map((a) => a.createdById))];
    const creators = await tx.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, fullName: true },
    });
    const creatorMap = new Map(creators.map((c) => [c.id, c.fullName]));
    return raw.map((a) => ({
      id: a.id,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
      author: creatorMap.get(a.createdById) ?? null,
    }));
  }

  // ─── Stage, Video Room & Agenda Controls ───────────────────────────────

  async setVideoRoomId(
    companyId: string,
    meetingId: string,
    videoRoomId: string | null,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<{ videoRoomId: string | null }> {
    const normalized = videoRoomId?.trim() ? videoRoomId.trim() : null;
    await this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.state === 'COMPLETED' || m.state === 'ARCHIVED') {
        throw new ConflictException('Video room cannot be changed after the meeting has ended');
      }

      await tx.meeting.update({
        where: { id: meetingId },
        data: { videoRoomId: normalized },
      });

      await this.audit.record(
        {
          action: 'meeting.video_room_set',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'meeting',
          targetId: meetingId,
          metadata: { videoRoomId: normalized },
          meta,
        },
        tx,
      );
    });
    return { videoRoomId: normalized };
  }

  async setActiveAgendaItem(
    companyId: string,
    meetingId: string,
    agendaItemId: string | null,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.state !== 'LIVE') {
        throw new ConflictException('Active agenda item can only be changed while the meeting is live');
      }

      if (agendaItemId) {
        const item = await tx.agendaItem.findFirst({ where: { id: agendaItemId, meetingId } });
        if (!item) throw new BadRequestException('Agenda item not found in this meeting');
      }

      await tx.meeting.update({
        where: { id: meetingId },
        data: { activeAgendaItemId: agendaItemId },
      });

      await this.audit.record(
        {
          action: 'agenda.set_active',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'meeting',
          targetId: meetingId,
          metadata: { activeAgendaItemId: agendaItemId },
          meta,
        },
        tx,
      );
    });

    this.events.emit(meetingId, 'agenda.active', 'all', { agendaItemId });
  }

  async toggleStage(
    companyId: string,
    meetingId: string,
    agendaItemId: string,
    stage: AgendaStage,
    open: boolean,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.state !== 'LIVE') {
        throw new ConflictException('Agenda stages can only be changed while the meeting is live');
      }

      const item = await tx.agendaItem.findFirst({
        where: { id: agendaItemId, meetingId, companyId },
        include: { resolution: true },
      });
      if (!item) throw new NotFoundException('Agenda item not found');

      if (open) {
        if (!item.resolution) {
          throw new BadRequestException('Procedural agenda items without a resolution do not have motion or poll stages');
        }
        const rules = meetingRulesSchema.parse(m.rules);
        if (stage === 'PROPOSAL' && !item.resolution.requiresProposal) {
          throw new ConflictException('This resolution does not require a proposal');
        }
        if (stage === 'SECONDING' && !item.resolution.requiresSeconding) {
          throw new ConflictException('This resolution does not require seconding');
        }
        if (stage === 'POLL_DEMAND' && !rules.pollDemand.enabled) {
          throw new ConflictException('Poll demands are not enabled in the governance rules for this meeting');
        }
      }

      const field = stage === 'PROPOSAL' ? 'proposalOpen' : stage === 'SECONDING' ? 'secondingOpen' : 'pollDemandOpen';

      await tx.agendaItem.update({
        where: { id: agendaItemId },
        data: { [field]: open },
      });

      await this.audit.record(
        {
          action: 'agenda.stage_toggle',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: item.tenantId,
          companyId: item.companyId,
          targetType: 'agenda_item',
          targetId: agendaItemId,
          metadata: { stage, open },
          meta,
        },
        tx,
      );
    });

    this.events.emit(meetingId, 'agenda.stage', 'all', { agendaItemId, stage, open });
  }

  async acceptMotion(
    companyId: string,
    meetingId: string,
    motionId: string,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<MotionDto> {
    const result = await this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');
      if (m.state !== 'LIVE') throw new ConflictException('Motions can only be accepted while the meeting is live');

      const mot = await tx.motion.findFirst({ where: { id: motionId, meetingId, companyId } });
      if (!mot) throw new NotFoundException('Motion not found');
      if (mot.status === 'ACCEPTED') {
        const holder = await tx.shareholder.findFirst({ where: { id: mot.shareholderId }, select: { name: true } });
        return {
          dto: {
            id: mot.id,
            kind: mot.kind,
            status: mot.status,
            shareholderName: holder?.name ?? 'Shareholder',
            actingAs: mot.actingAs,
            createdAt: mot.createdAt.toISOString(),
          } satisfies MotionDto,
          agendaItemId: mot.agendaItemId,
        };
      }
      if (mot.status !== 'SUBMITTED') {
        throw new ConflictException('Only submitted motions can be accepted');
      }

      const alreadyAccepted = await tx.motion.findFirst({
        where: { agendaItemId: mot.agendaItemId, kind: mot.kind, status: 'ACCEPTED' },
      });
      if (alreadyAccepted) {
        throw new ConflictException(`A ${mot.kind.toLowerCase()} has already been accepted for this agenda item`);
      }

      const now = new Date();
      try {
        await tx.motion.update({
          where: { id: motionId },
          data: { status: 'ACCEPTED', decidedAt: now, decidedById: p.userId },
        });
      } catch (err: unknown) {
        const isConflict = typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
        if (isConflict) {
          throw new ConflictException(`A ${mot.kind.toLowerCase()} has already been accepted for this agenda item`);
        }
        throw err;
      }

      await tx.motion.updateMany({
        where: { agendaItemId: mot.agendaItemId, kind: mot.kind, status: 'SUBMITTED', NOT: { id: motionId } },
        data: { status: 'REJECTED', decidedAt: now, decidedById: p.userId },
      });

      const stageField = mot.kind === 'PROPOSAL' ? 'proposalOpen' : 'secondingOpen';
      await tx.agendaItem.update({
        where: { id: mot.agendaItemId },
        data: { [stageField]: false },
      });

      const holder = await tx.shareholder.findFirst({ where: { id: mot.shareholderId }, select: { name: true } });

      await this.audit.record(
        {
          action: 'motion.accept_staff',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'motion',
          targetId: mot.id,
          metadata: { kind: mot.kind, agendaItemId: mot.agendaItemId },
          meta,
        },
        tx,
      );

      return {
        dto: {
          id: mot.id,
          kind: mot.kind,
          status: 'ACCEPTED' as const,
          shareholderName: holder?.name ?? 'Shareholder',
          actingAs: mot.actingAs,
          createdAt: mot.createdAt.toISOString(),
        },
        agendaItemId: mot.agendaItemId,
      };
    });

    this.events.emit(meetingId, 'motion.changed', 'all', { agendaItemId: result.agendaItemId, kind: result.dto.kind });
    this.events.emit(meetingId, 'agenda.stage', 'all', { agendaItemId: result.agendaItemId, stage: result.dto.kind, open: false });
    return result.dto;
  }

  // ─── Announcements ─────────────────────────────────────────────────────

  async createAnnouncement(
    companyId: string,
    meetingId: string,
    body: string,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<AnnouncementDto> {
    const ann = await this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');

      const created = await tx.meetingAnnouncement.create({
        data: {
          tenantId: m.tenantId,
          companyId: m.companyId,
          meetingId,
          body,
          createdById: p.userId,
        },
      });

      await this.audit.record(
        {
          action: 'meeting.announcement_create',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'meeting_announcement',
          targetId: created.id,
          metadata: { bodyLength: body.length },
          meta,
        },
        tx,
      );

      return created;
    });

    this.events.emit(meetingId, 'announcement', 'all', { id: ann.id });
    return {
      id: ann.id,
      body: ann.body,
      createdAt: ann.createdAt.toISOString(),
      author: p.fullName,
    };
  }

  async retractAnnouncement(
    companyId: string,
    meetingId: string,
    id: string,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<void> {
    await this.prisma.scoped([companyId], async (tx) => {
      const ann = await tx.meetingAnnouncement.findFirst({ where: { id, meetingId, companyId } });
      if (!ann) throw new NotFoundException('Announcement not found');
      if (ann.retractedAt) return;

      await tx.meetingAnnouncement.update({
        where: { id },
        data: { retractedAt: new Date() },
      });

      await this.audit.record(
        {
          action: 'meeting.announcement_retract',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: ann.tenantId,
          companyId: ann.companyId,
          targetType: 'meeting_announcement',
          targetId: id,
          metadata: {},
          meta,
        },
        tx,
      );
    });

    this.events.emit(meetingId, 'announcement', 'all', { id, retracted: true });
  }

  // ─── Question Moderation ───────────────────────────────────────────────

  async getQuestionsForModeration(companyId: string, meetingId: string): Promise<QuestionDto[]> {
    return this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');

      const questions = await tx.meetingQuestion.findMany({
        where: { meetingId },
        orderBy: { createdAt: 'desc' },
        include: {
          actions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return this.mapStaffQuestions(tx, questions);
    });
  }

  private async mapStaffQuestions(
    tx: Tx,
    questions: Prisma.MeetingQuestionGetPayload<{ include: { actions: true } }>[],
  ): Promise<QuestionDto[]> {
    if (questions.length === 0) return [];

    const agendaItemIds = [...new Set(questions.map((q) => q.agendaItemId).filter((id): id is string => !!id))];
    const agendaItems = agendaItemIds.length
      ? await tx.agendaItem.findMany({
          where: { id: { in: agendaItemIds } },
          select: { id: true, number: true, title: true },
        })
      : [];
    const itemMap = new Map(agendaItems.map((ai) => [ai.id, ai]));

    const shareholderIds = [...new Set(questions.map((q) => q.shareholderId))];
    const shareholders = await tx.shareholder.findMany({
      where: { id: { in: shareholderIds } },
      select: { id: true, name: true },
    });
    const holderMap = new Map(shareholders.map((s) => [s.id, s.name]));

    const userIds = [
      ...new Set([
        ...questions.map((q) => q.userId),
        ...questions.flatMap((q) => q.actions.map((a) => a.actorUserId)),
      ]),
    ];
    const users = await tx.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    return questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      text: q.text,
      durationSeconds: q.durationSeconds,
      bangla: q.text ? containsBangla(q.text) : false,
      status: q.status,
      agendaItem: q.agendaItemId ? (itemMap.get(q.agendaItemId) ?? null) : null,
      createdAt: q.createdAt.toISOString(),
      submitter: {
        name: userMap.get(q.userId) ?? 'Participant',
        actingAs: q.actingAs,
        shareholderName: holderMap.get(q.shareholderId) ?? 'Shareholder',
      },
      history: q.actions.map((act) => ({
        action: act.action,
        note: act.note,
        actor: userMap.get(act.actorUserId) ?? null,
        at: act.createdAt.toISOString(),
      })),
    }));
  }

  async moderateQuestion(
    companyId: string,
    meetingId: string,
    questionId: string,
    action: 'APPROVE' | 'REJECT' | 'FORWARD',
    note: string | undefined,
    p: AuthPrincipal,
    meta: RequestMeta,
  ): Promise<QuestionDto> {
    const dto = await this.prisma.scoped([companyId], async (tx) => {
      const q = await tx.meetingQuestion.findFirst({ where: { id: questionId, meetingId, companyId } });
      if (!q) throw new NotFoundException('Question not found');

      const newStatus: QuestionStatus =
        action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'FORWARDED';

      await tx.meetingQuestion.update({
        where: { id: questionId },
        data: { status: newStatus },
      });

      await tx.moderationAction.create({
        data: {
          tenantId: q.tenantId,
          companyId: q.companyId,
          questionId,
          actorUserId: p.userId,
          action,
          note: note ?? null,
        },
      });

      await this.audit.record(
        {
          action: 'question.moderate',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          actorEmail: p.email,
          tenantId: q.tenantId,
          companyId: q.companyId,
          targetType: 'meeting_question',
          targetId: questionId,
          metadata: { action, fromStatus: q.status, toStatus: newStatus },
          meta,
        },
        tx,
      );

      const updated = await tx.meetingQuestion.findUniqueOrThrow({
        where: { id: questionId },
        include: { actions: { orderBy: { createdAt: 'asc' } } },
      });
      const mapped = await this.mapStaffQuestions(tx, [updated]);
      return mapped[0]!;
    });

    this.events.emit(meetingId, 'question.updated', 'moderators', { questionId, status: dto.status });
    this.events.emit(meetingId, 'question.updated', 'staff', { questionId, status: dto.status });
    // Notify room so the submitter's "My questions" status refreshes.
    this.events.emit(meetingId, 'question.updated', 'all', { status: dto.status });
    if (dto.status === 'FORWARDED') {
      this.events.emit(meetingId, 'question.forwarded', 'board', { questionId });
    }

    return dto;
  }

  async getQuestionAudio(companyId: string, meetingId: string, questionId: string, onlyForwarded = false) {
    const file = await this.prisma.scoped([companyId], async (tx) => {
      const q = await tx.meetingQuestion.findFirst({ where: { id: questionId, meetingId, companyId } });
      if (!q || !q.fileId) throw new NotFoundException('Audio not found');
      if (onlyForwarded && q.status !== 'FORWARDED') {
        throw new NotFoundException('Audio not found');
      }
      return tx.storedFile.findUniqueOrThrow({ where: { id: q.fileId } });
    });
    const buffer = await this.storage.get(file.storageKey);
    return { buffer, mimeType: file.mimeType, originalName: file.originalName };
  }

  // ─── Board Room View ───────────────────────────────────────────────────

  async getBoardRoom(companyId: string, meetingId: string, p?: AuthPrincipal): Promise<BoardRoom> {
    return this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({
        where: { id: meetingId, companyId },
        include: {
          agendaItems: { orderBy: { position: 'asc' }, include: { resolution: true } },
        },
      });
      if (!m) throw new NotFoundException('Meeting not found');

      const forwardedRaw = await tx.meetingQuestion.findMany({
        where: { meetingId, status: 'FORWARDED' },
        orderBy: { createdAt: 'asc' },
        include: { actions: { orderBy: { createdAt: 'asc' } } },
      });
      const forwardedQuestions = await this.mapStaffQuestions(tx, forwardedRaw);

      const acceptedMotions = await this.loadAcceptedMotionsByItem(tx, meetingId);

      const entitlements = await tx.votingEntitlement.findMany({
        where: { meetingId },
        select: { weight: true },
      });
      const totalVotes = entitlements.reduce((sum, e) => sum + e.weight, 0n);
      const attendance = await this.compileAttendanceSummary(tx, meetingId, totalVotes);
      const announcements = await this.loadAnnouncements(tx, meetingId, true);

      const agenda: LiveAgendaItem[] = m.agendaItems.map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        description: item.description,
        position: item.position,
        resolution: item.resolution
          ? {
              kind: item.resolution.kind,
              text: item.resolution.text,
              requiresProposal: item.resolution.requiresProposal,
              requiresSeconding: item.resolution.requiresSeconding,
            }
          : null,
        stages: {
          PROPOSAL: item.proposalOpen,
          SECONDING: item.secondingOpen,
          POLL_DEMAND: item.pollDemandOpen,
        },
        accepted: acceptedMotions.get(item.id) ?? { PROPOSAL: null, SECONDING: null },
      }));

      const votingSessions = p ? await this.voting.buildStaffSessions(tx, m, p, true) : [];

      return {
        meetingId: m.id,
        state: m.state as MeetingState,
        activeAgendaItemId: m.activeAgendaItemId,
        agenda,
        forwardedQuestions,
        attendance,
        announcements,
        votingSessions,
      };
    });
  }

  private async loadAcceptedMotionsByItem(
    tx: Tx,
    meetingId: string,
  ): Promise<Map<string, { PROPOSAL: MotionDto | null; SECONDING: MotionDto | null }>> {
    const motions = await tx.motion.findMany({
      where: { meetingId, status: 'ACCEPTED' },
    });
    const out = new Map<string, { PROPOSAL: MotionDto | null; SECONDING: MotionDto | null }>();
    if (motions.length === 0) return out;

    const holderIds = [...new Set(motions.map((mot) => mot.shareholderId))];
    const holders = await tx.shareholder.findMany({
      where: { id: { in: holderIds } },
      select: { id: true, name: true },
    });
    const holderMap = new Map(holders.map((h) => [h.id, h.name]));

    for (const mot of motions) {
      const cur = out.get(mot.agendaItemId) ?? { PROPOSAL: null, SECONDING: null };
      const dto: MotionDto = {
        id: mot.id,
        kind: mot.kind,
        status: mot.status,
        shareholderName: holderMap.get(mot.shareholderId) ?? 'Shareholder',
        actingAs: mot.actingAs,
        createdAt: mot.createdAt.toISOString(),
      };
      if (mot.kind === 'PROPOSAL') cur.PROPOSAL = dto;
      else cur.SECONDING = dto;
      out.set(mot.agendaItemId, cur);
    }
    return out;
  }

  // ─── Participant Room View ─────────────────────────────────────────────

  async getRoom(p: AuthPrincipal, meetingId: string, meta?: RequestMeta): Promise<MeetingRoom> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    return this.prisma.scoped(companyIds, async (tx) => {
      const m = await tx.meeting.findFirst({
        where: { id: meetingId, companyId: { in: companyIds }, state: { in: [...PUBLISHED_STATES] } },
        include: {
          agendaItems: { orderBy: { position: 'asc' }, include: { resolution: true } },
        },
      });
      if (!m) throw new NotFoundException('Meeting not found');

      const regs = await tx.meetingParticipant.findMany({
        where: { userId: p.userId, meetingId, status: 'REGISTERED' },
      });
      if (regs.length === 0) throw new ForbiddenException('You are not registered for this meeting');

      await this.access.assert(
        p,
        PERMISSIONS.MEETING_JOIN_SHAREHOLDER,
        { tenantId: m.tenantId, companyId: m.companyId },
        meta,
      );

      const company = await tx.company.findFirst({
        where: { id: m.companyId },
        select: { shortName: true },
      });

      const rules = meetingRulesSchema.parse(m.rules);

      const allEntitlementIds = [...new Set(regs.flatMap((r) => r.entitlementIds))];
      const entitlements = allEntitlementIds.length
        ? await tx.votingEntitlement.findMany({
            where: { id: { in: allEntitlementIds } },
            select: { id: true, weight: true },
          })
        : [];
      const weightMap = new Map(entitlements.map((e) => [e.id, e.weight]));

      const regHolderIds = [...new Set(regs.map((r) => r.shareholderId))];
      const holders = await tx.shareholder.findMany({
        where: { id: { in: regHolderIds } },
        select: { id: true, name: true },
      });
      const holderMap = new Map(holders.map((h) => [h.id, h.name]));

      const proxyIds = regs.map((r) => r.proxyId).filter((id): id is string => !!id);
      const proxies = proxyIds.length
        ? await tx.proxyAuthorization.findMany({
            where: { id: { in: proxyIds } },
            select: { id: true, scope: true },
          })
        : [];
      const proxyMap = new Map(proxies.map((pr) => [pr.id, pr.scope]));

      const votingCtx = await this.voting.buildParticipantContext(tx, p.userId, m, regs);

      const registrations: RoomRegistration[] = regs.map((r) => {
        const votes = r.entitlementIds.reduce((sum, eid) => sum + (weightMap.get(eid) ?? 0n), 0n);
        const proxyScope = r.proxyId ? proxyMap.get(r.proxyId) : null;
        const capabilities = participantCapabilities({ kind: r.kind, proxyScope }, rules);

        return {
          participantId: r.id,
          kind: r.kind,
          label:
            r.kind === 'SHAREHOLDER'
              ? 'Shareholder'
              : r.kind === 'CORPORATE_REPRESENTATIVE'
                ? 'Corporate representative'
                : 'Proxy',
          shareholderName: holderMap.get(r.shareholderId) ?? 'Shareholder',
          votes: votes.toString(),
          capabilities,
          proxySuspendedByShareholder: votingCtx.proxySuspendedByParticipant.get(r.id) ?? false,
          entitlements: votingCtx.entitlementsByParticipant.get(r.id) ?? [],
        };
      });

      const acceptedMotionsByItem = await this.loadAcceptedMotionsByItem(tx, meetingId);
      const itemInfoMap = new Map(m.agendaItems.map((i) => [i.id, { id: i.id, number: i.number, title: i.title }]));

      const agenda: LiveAgendaItem[] = m.agendaItems.map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        description: item.description,
        position: item.position,
        resolution: item.resolution
          ? {
              kind: item.resolution.kind,
              text: item.resolution.text,
              requiresProposal: item.resolution.requiresProposal,
              requiresSeconding: item.resolution.requiresSeconding,
            }
          : null,
        stages: {
          PROPOSAL: item.proposalOpen,
          SECONDING: item.secondingOpen,
          POLL_DEMAND: item.pollDemandOpen,
        },
        accepted: acceptedMotionsByItem.get(item.id) ?? { PROPOSAL: null, SECONDING: null },
      }));

      const myMotions = await tx.motion.findMany({
        where: { meetingId, userId: p.userId },
        select: { agendaItemId: true, kind: true, status: true },
      });

      const myPollDemands = await tx.pollDemand.findMany({
        where: { meetingId, userId: p.userId },
        select: { agendaItemId: true },
      });

      const myQuestions = await tx.meetingQuestion.findMany({
        where: { meetingId, userId: p.userId },
        orderBy: { createdAt: 'desc' },
      });
      const myQuestionsDto: QuestionDto[] = myQuestions.map((q) => ({
        id: q.id,
        kind: q.kind,
        text: q.text,
        durationSeconds: q.durationSeconds,
        bangla: q.text ? containsBangla(q.text) : false,
        status: q.status,
        agendaItem: q.agendaItemId ? (itemInfoMap.get(q.agendaItemId) ?? null) : null,
        createdAt: q.createdAt.toISOString(),
        submitter: null,
        history: [],
      }));

      const announcements = await this.loadAnnouncements(tx, meetingId, false);

      const activeAttendance = await tx.meetingAttendance.findMany({
        where: { meetingId, leftAt: null, role: 'PARTICIPANT' },
        select: { userId: true },
      });
      const distinctParticipants = new Set(activeAttendance.map((a) => a.userId)).size;

      return {
        meetingId: m.id,
        companyName: company?.shortName ?? 'Company',
        title: m.title,
        type: m.type as 'AGM' | 'EGM',
        state: m.state as MeetingState,
        scheduledStart: m.scheduledStart.toISOString(),
        activeAgendaItemId: m.activeAgendaItemId,
        agenda,
        registrations,
        myMotions,
        myPollDemands: myPollDemands.map((pd) => pd.agendaItemId),
        myQuestions: myQuestionsDto,
        announcements,
        attendance: { participantsPresent: distinctParticipants },
        audioMaxSeconds: rules.audioQuestionMaxSeconds,
        votingSessions: votingCtx.votingSessions,
      };
    });
  }

  async getParticipantVideoJoin(p: AuthPrincipal, meetingId: string, meta?: RequestMeta): Promise<VideoJoinInfo> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const m = await this.prisma.scoped(companyIds, async (tx) => {
      const found = await this.findParticipantMeeting(tx, companyIds, meetingId);
      await this.resolveRegistration(tx, p.userId, meetingId);
      await this.access.assert(
        p,
        PERMISSIONS.MEETING_JOIN_SHAREHOLDER,
        { tenantId: found.tenantId, companyId: found.companyId },
        meta,
      );
      return found;
    });

    return this.video.joinInfo(m.videoRoomId, 'attendee', p.fullName);
  }

  // ─── Participant Actions (Motion, Poll Demand, Questions) ──────────────

  async submitMotion(
    p: AuthPrincipal,
    meetingId: string,
    input: { agendaItemId: string; kind: MotionKind; participantId?: string },
    meta: RequestMeta,
  ): Promise<MotionDto> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const result = await this.prisma.scoped(companyIds, async (tx) => {
      const m = await this.findParticipantMeeting(tx, companyIds, meetingId);
      const reg = await this.resolveRegistration(tx, p.userId, meetingId, input.participantId);
      await this.access.assert(
        p,
        input.kind === 'PROPOSAL' ? PERMISSIONS.PROPOSAL_SUBMIT : PERMISSIONS.SECONDING_SUBMIT,
        { tenantId: m.tenantId, companyId: m.companyId },
        meta,
      );

      if (m.state !== 'LIVE') throw new ConflictException('The meeting is not currently live');

      const rules = meetingRulesSchema.parse(m.rules);
      const proxyScope = reg.proxyId
        ? (await tx.proxyAuthorization.findFirst({ where: { id: reg.proxyId } }))?.scope
        : null;
      const caps = participantCapabilities({ kind: reg.kind, proxyScope }, rules);

      if (input.kind === 'PROPOSAL' && !caps.propose) {
        throw new ForbiddenException('Your registration does not permit proposing resolutions');
      }
      if (input.kind === 'SECONDING' && !caps.second) {
        throw new ForbiddenException('Your registration does not permit seconding resolutions');
      }

      const item = await tx.agendaItem.findFirst({
        where: { id: input.agendaItemId, meetingId },
        include: { resolution: true },
      });
      if (!item) throw new NotFoundException('Agenda item not found');
      if (!item.resolution) {
        throw new BadRequestException('This agenda item does not carry a resolution');
      }

      if (input.kind === 'PROPOSAL' && rules.proposal.minHolding > 0) {
        const ents = await tx.votingEntitlement.findMany({
          where: { id: { in: reg.entitlementIds } },
          include: { snapshot: { select: { quantity: true } } },
        });
        const shares = ents.reduce((sum, e) => sum + e.snapshot.quantity, 0n);
        if (shares < BigInt(rules.proposal.minHolding)) {
          throw new ForbiddenException(`At least ${rules.proposal.minHolding} shares are required to propose`);
        }
      }

      const autoAccept = input.kind === 'SECONDING' || rules.proposal.mode === 'FIRST_ACCEPTED';

      // Check existing accepted motion first so sequential callers after acceptance get a clear 409.
      const existingAccepted = await tx.motion.findFirst({
        where: { agendaItemId: input.agendaItemId, kind: input.kind, status: 'ACCEPTED' },
      });
      if (existingAccepted) {
        throw new ConflictException(`A ${input.kind.toLowerCase()} has already been accepted for this agenda item`);
      }

      const stageOpen = input.kind === 'PROPOSAL' ? item.proposalOpen : item.secondingOpen;
      if (!stageOpen) {
        throw new ConflictException(`${STAGE_LABELS[input.kind]} stage is not open for this agenda item`);
      }

      if (input.kind === 'SECONDING' && rules.seconding.excludeProposer) {
        const acceptedProposer = await tx.motion.findFirst({
          where: { agendaItemId: input.agendaItemId, kind: 'PROPOSAL', status: 'ACCEPTED' },
        });
        if (
          acceptedProposer &&
          (acceptedProposer.userId === p.userId || acceptedProposer.shareholderId === reg.shareholderId)
        ) {
          throw new BadRequestException('The proposer cannot also second the motion');
        }
      }

      const alreadyMine = await tx.motion.findFirst({
        where: { agendaItemId: input.agendaItemId, kind: input.kind, participantId: reg.id },
      });
      if (alreadyMine) {
        throw new ConflictException(`You have already submitted a ${input.kind.toLowerCase()} for this agenda item`);
      }

      try {
        const created = await tx.motion.create({
          data: {
            tenantId: m.tenantId,
            companyId: m.companyId,
            meetingId,
            agendaItemId: input.agendaItemId,
            kind: input.kind,
            participantId: reg.id,
            userId: p.userId,
            shareholderId: reg.shareholderId,
            actingAs: reg.kind,
            status: autoAccept ? 'ACCEPTED' : 'SUBMITTED',
            decidedAt: autoAccept ? new Date() : null,
          },
        });

        if (autoAccept) {
          const stageField = input.kind === 'PROPOSAL' ? 'proposalOpen' : 'secondingOpen';
          await tx.agendaItem.update({
            where: { id: input.agendaItemId },
            data: { [stageField]: false },
          });
        }

        const holder = await tx.shareholder.findFirst({
          where: { id: reg.shareholderId },
          select: { name: true },
        });

        await this.audit.record(
          {
            action: autoAccept ? 'motion.accept' : 'motion.submit',
            outcome: 'SUCCESS',
            actorUserId: p.userId,
            tenantId: m.tenantId,
            companyId: m.companyId,
            targetType: 'motion',
            targetId: created.id,
            metadata: { kind: input.kind, agendaItemId: input.agendaItemId, status: created.status },
            meta,
          },
          tx,
        );

        return {
          dto: {
            id: created.id,
            kind: created.kind,
            status: created.status,
            shareholderName: holder?.name ?? 'Shareholder',
            actingAs: created.actingAs,
            createdAt: created.createdAt.toISOString(),
          } satisfies MotionDto,
          autoClosed: autoAccept,
        };
      } catch (err: unknown) {
        const isConflict = typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
        if (isConflict) {
          throw new ConflictException(`A ${input.kind.toLowerCase()} has already been accepted for this agenda item`);
        }
        throw err;
      }
    });

    this.events.emit(meetingId, 'motion.changed', 'all', { agendaItemId: input.agendaItemId, kind: input.kind });
    if (result.autoClosed) {
      this.events.emit(meetingId, 'agenda.stage', 'all', { agendaItemId: input.agendaItemId, stage: input.kind, open: false });
    }
    return result.dto;
  }

  async submitPollDemand(
    p: AuthPrincipal,
    meetingId: string,
    input: { agendaItemId: string; participantId?: string },
    meta: RequestMeta,
  ): Promise<PollDemandSummary> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const summary = await this.prisma.scoped(companyIds, async (tx) => {
      const m = await this.findParticipantMeeting(tx, companyIds, meetingId);
      const reg = await this.resolveRegistration(tx, p.userId, meetingId, input.participantId);
      await this.access.assert(
        p,
        PERMISSIONS.POLL_DEMAND_SUBMIT,
        { tenantId: m.tenantId, companyId: m.companyId },
        meta,
      );

      if (m.state !== 'LIVE') throw new ConflictException('The meeting is not currently live');

      const rules = meetingRulesSchema.parse(m.rules);
      const proxyScope = reg.proxyId
        ? (await tx.proxyAuthorization.findFirst({ where: { id: reg.proxyId } }))?.scope
        : null;
      const caps = participantCapabilities({ kind: reg.kind, proxyScope }, rules);

      if (!caps.demandPoll) {
        throw new ForbiddenException('Your registration does not permit demanding a poll');
      }

      const item = await tx.agendaItem.findFirst({ where: { id: input.agendaItemId, meetingId } });
      if (!item) throw new NotFoundException('Agenda item not found');
      if (!item.pollDemandOpen) throw new ConflictException('Poll demand stage is not open for this agenda item');

      const alreadyDemanded = await tx.pollDemand.findFirst({
        where: { agendaItemId: input.agendaItemId, participantId: reg.id },
      });
      if (alreadyDemanded) {
        throw new ConflictException('You have already demanded a poll for this agenda item');
      }

      const entitlements = await tx.votingEntitlement.findMany({
        where: { id: { in: reg.entitlementIds } },
        select: { weight: true },
      });
      const participantVotes = entitlements.reduce((sum, e) => sum + e.weight, 0n);

      try {
        await tx.pollDemand.create({
          data: {
            tenantId: m.tenantId,
            companyId: m.companyId,
            meetingId,
            agendaItemId: input.agendaItemId,
            participantId: reg.id,
            userId: p.userId,
            shareholderId: reg.shareholderId,
            actingAs: reg.kind,
            votes: participantVotes,
          },
        });
      } catch (err: unknown) {
        const isConflict = typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002';
        if (isConflict) {
          throw new ConflictException('You have already demanded a poll for this agenda item');
        }
        throw err;
      }

      await this.audit.record(
        {
          action: 'poll.demand',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'agenda_item',
          targetId: input.agendaItemId,
          metadata: { votes: participantVotes.toString() },
          meta,
        },
        tx,
      );

      const allDemands = await tx.pollDemand.findMany({ where: { agendaItemId: input.agendaItemId } });
      const totalDemandsVotes = allDemands.reduce((sum, pd) => sum + pd.votes, 0n);

      const allEntitlements = await tx.votingEntitlement.findMany({ where: { meetingId }, select: { weight: true } });
      const totalMeetingVotes = allEntitlements.reduce((sum, e) => sum + e.weight, 0n);

      const thresholdMet = pollThresholdMet(
        rules,
        { count: allDemands.length, votes: totalDemandsVotes },
        totalMeetingVotes,
      );

      return {
        count: allDemands.length,
        votes: totalDemandsVotes.toString(),
        thresholdMet,
      };
    });

    this.events.emit(meetingId, 'poll.demand', 'all', { agendaItemId: input.agendaItemId });
    return summary;
  }

  async submitTextQuestion(
    p: AuthPrincipal,
    meetingId: string,
    input: { text: string; agendaItemId?: string; participantId?: string },
    meta: RequestMeta,
  ): Promise<QuestionDto> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const { q, agendaItem } = await this.prisma.scoped(companyIds, async (tx) => {
      const m = await this.findParticipantMeeting(tx, companyIds, meetingId);
      const reg = await this.resolveRegistration(tx, p.userId, meetingId, input.participantId);
      await this.access.assert(
        p,
        PERMISSIONS.QUESTION_SUBMIT,
        { tenantId: m.tenantId, companyId: m.companyId },
        meta,
      );

      if (m.state !== 'LIVE') throw new ConflictException('The meeting is not currently live');

      const rules = meetingRulesSchema.parse(m.rules);
      const proxyScope = reg.proxyId
        ? (await tx.proxyAuthorization.findFirst({ where: { id: reg.proxyId } }))?.scope
        : null;
      const caps = participantCapabilities({ kind: reg.kind, proxyScope }, rules);

      if (!caps.ask) throw new ForbiddenException('Your registration does not permit asking questions');

      const agendaItemId = input.agendaItemId || null;
      let foundItem: { id: string; number: string; title: string } | null = null;
      if (agendaItemId) {
        const item = await tx.agendaItem.findFirst({
          where: { id: agendaItemId, meetingId },
          select: { id: true, number: true, title: true },
        });
        if (!item) throw new BadRequestException('Agenda item not found in this meeting');
        foundItem = item;
      }

      const created = await tx.meetingQuestion.create({
        data: {
          tenantId: m.tenantId,
          companyId: m.companyId,
          meetingId,
          agendaItemId,
          participantId: reg.id,
          userId: p.userId,
          shareholderId: reg.shareholderId,
          actingAs: reg.kind,
          kind: 'TEXT',
          text: input.text,
          status: 'PENDING',
        },
      });

      await this.audit.record(
        {
          action: 'question.submit',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'meeting_question',
          targetId: created.id,
          metadata: { kind: 'TEXT', textLength: input.text.length, bangla: containsBangla(input.text) },
          meta,
        },
        tx,
      );

      return { q: created, agendaItem: foundItem };
    });

    this.events.emit(meetingId, 'question.new', 'moderators', { questionId: q.id });
    this.events.emit(meetingId, 'question.new', 'staff', { questionId: q.id });

    return {
      id: q.id,
      kind: 'TEXT',
      text: q.text,
      durationSeconds: null,
      bangla: containsBangla(q.text ?? ''),
      status: 'PENDING',
      agendaItem,
      createdAt: q.createdAt.toISOString(),
      submitter: null,
      history: [],
    };
  }

  async submitAudioQuestion(
    p: AuthPrincipal,
    meetingId: string,
    file: { buffer: Buffer; originalname: string },
    durationSeconds: number,
    agendaItemId: string | undefined,
    participantId: string | undefined,
    meta: RequestMeta,
  ): Promise<QuestionDto> {
    if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 180) {
      throw new BadRequestException('Audio duration must be between 1 and 180 seconds');
    }
    const detectedMime = sniffAudioMime(file.buffer);
    if (!detectedMime) {
      throw new BadRequestException('Unsupported audio format. Submit WebM, Ogg, MP3, MP4, or WAV audio');
    }

    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const { q, agendaItem } = await this.prisma.scoped(companyIds, async (tx) => {
      const m = await this.findParticipantMeeting(tx, companyIds, meetingId);
      const reg = await this.resolveRegistration(tx, p.userId, meetingId, participantId);
      await this.access.assert(
        p,
        PERMISSIONS.QUESTION_SUBMIT,
        { tenantId: m.tenantId, companyId: m.companyId },
        meta,
      );

      if (m.state !== 'LIVE') throw new ConflictException('The meeting is not currently live');

      const rules = meetingRulesSchema.parse(m.rules);
      if (Math.round(durationSeconds) > rules.audioQuestionMaxSeconds) {
        throw new BadRequestException(
          `Audio questions for this meeting may not exceed ${rules.audioQuestionMaxSeconds} seconds`,
        );
      }

      const proxyScope = reg.proxyId
        ? (await tx.proxyAuthorization.findFirst({ where: { id: reg.proxyId } }))?.scope
        : null;
      const caps = participantCapabilities({ kind: reg.kind, proxyScope }, rules);

      if (!caps.ask) throw new ForbiddenException('Your registration does not permit asking questions');

      const resolvedAgendaItemId = agendaItemId || null;
      let foundItem: { id: string; number: string; title: string } | null = null;
      if (resolvedAgendaItemId) {
        const item = await tx.agendaItem.findFirst({
          where: { id: resolvedAgendaItemId, meetingId },
          select: { id: true, number: true, title: true },
        });
        if (!item) throw new BadRequestException('Agenda item not found in this meeting');
        foundItem = item;
      }

      const stored = await this.storage.put(file.buffer, `audio-questions/${m.companyId}`);
      const storedFile = await tx.storedFile.create({
        data: {
          tenantId: m.tenantId,
          companyId: m.companyId,
          kind: 'AUDIO_QUESTION',
          storageKey: stored.key,
          originalName: file.originalname.replace(/[^\w.\- ()]/g, '_').slice(0, 255) || 'question.webm',
          mimeType: detectedMime,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          uploadedById: p.userId,
        },
      });

      const created = await tx.meetingQuestion.create({
        data: {
          tenantId: m.tenantId,
          companyId: m.companyId,
          meetingId,
          agendaItemId: resolvedAgendaItemId,
          participantId: reg.id,
          userId: p.userId,
          shareholderId: reg.shareholderId,
          actingAs: reg.kind,
          kind: 'AUDIO',
          fileId: storedFile.id,
          durationSeconds: Math.round(durationSeconds),
          status: 'PENDING',
        },
      });

      await this.audit.record(
        {
          action: 'question.submit_audio',
          outcome: 'SUCCESS',
          actorUserId: p.userId,
          tenantId: m.tenantId,
          companyId: m.companyId,
          targetType: 'meeting_question',
          targetId: created.id,
          metadata: { kind: 'AUDIO', durationSeconds: Math.round(durationSeconds), sizeBytes: stored.sizeBytes },
          meta,
        },
        tx,
      );

      return { q: created, agendaItem: foundItem };
    });

    this.events.emit(meetingId, 'question.new', 'moderators', { questionId: q.id });
    this.events.emit(meetingId, 'question.new', 'staff', { questionId: q.id });

    return {
      id: q.id,
      kind: 'AUDIO',
      text: null,
      durationSeconds: q.durationSeconds,
      bangla: false,
      status: 'PENDING',
      agendaItem,
      createdAt: q.createdAt.toISOString(),
      submitter: null,
      history: [],
    };
  }

  // ─── Attendance Heartbeat & Lifecycle ──────────────────────────────────

  async recordStaffAttendance(
    companyId: string,
    p: AuthPrincipal,
    meetingId: string,
    role: 'BOARD' | 'MODERATOR' | 'STAFF',
    meta: RequestMeta,
  ): Promise<string | null> {
    const result = await this.prisma.scoped([companyId], async (tx) => {
      const m = await tx.meeting.findFirst({ where: { id: meetingId, companyId } });
      if (!m) throw new NotFoundException('Meeting not found');

      const created = await tx.meetingAttendance.create({
        data: {
          tenantId: m.tenantId,
          companyId: m.companyId,
          meetingId,
          userId: p.userId,
          role,
          participantIds: [],
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
      return created.id;
    });

    this.events.emit(meetingId, 'attendance.count', 'staff');
    this.events.emit(meetingId, 'attendance.count', 'board');
    return result;
  }

  async closeStaffAttendance(companyId: string, meetingId: string, attendanceId: string): Promise<void> {
    const count = await this.prisma.scoped([companyId], async (tx) => {
      const res = await tx.meetingAttendance.updateMany({
        where: { id: attendanceId, meetingId, leftAt: null },
        data: { leftAt: new Date() },
      });
      return res.count;
    });
    if (count > 0) {
      this.events.emit(meetingId, 'attendance.count', 'staff');
      this.events.emit(meetingId, 'attendance.count', 'board');
    }
  }

  async recordParticipantAttendance(
    p: AuthPrincipal,
    meetingId: string,
    meta: RequestMeta,
    createFreshRow = false,
  ): Promise<string | null> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) throw new NotFoundException('Meeting not found');

    const { id, changed } = await this.prisma.scoped(companyIds, async (tx) => {
      const m = await this.findParticipantMeeting(tx, companyIds, meetingId);
      const regs = await tx.meetingParticipant.findMany({
        where: { userId: p.userId, meetingId, status: 'REGISTERED' },
        select: { id: true },
      });
      if (regs.length === 0) throw new ForbiddenException('You are not registered for this meeting');

      await this.access.assert(
        p,
        PERMISSIONS.MEETING_JOIN_SHAREHOLDER,
        { tenantId: m.tenantId, companyId: m.companyId },
        meta,
      );

      const participantIds = regs.map((r) => r.id);

      if (!createFreshRow) {
        const active = await tx.meetingAttendance.findFirst({
          where: { meetingId, userId: p.userId, role: 'PARTICIPANT', leftAt: null },
        });
        if (active) {
          if (active.participantIds.length !== participantIds.length) {
            await tx.meetingAttendance.update({
              where: { id: active.id },
              data: { participantIds },
            });
            return { id: active.id, changed: true };
          }
          return { id: active.id, changed: false };
        }
      }

      const created = await tx.meetingAttendance.create({
        data: {
          tenantId: m.tenantId,
          companyId: m.companyId,
          meetingId,
          userId: p.userId,
          role: 'PARTICIPANT',
          participantIds,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
      return { id: created.id, changed: true };
    });

    if (changed) {
      this.events.emit(meetingId, 'attendance.count', 'all');
    }
    return id;
  }

  async closeParticipantAttendance(p: AuthPrincipal, meetingId: string, attendanceId?: string): Promise<void> {
    const companyIds = await this.participantCompanies(p);
    if (companyIds.length === 0) return;

    const updated = await this.prisma.scoped(companyIds, async (tx) => {
      const res = await tx.meetingAttendance.updateMany({
        where: {
          meetingId,
          userId: p.userId,
          leftAt: null,
          ...(attendanceId ? { id: attendanceId } : {}),
        },
        data: { leftAt: new Date() },
      });
      return res.count;
    });

    if (updated > 0) {
      this.events.emit(meetingId, 'attendance.count', 'all');
    }
  }

  // ─── Video Join Info ───────────────────────────────────────────────────

  async getVideoJoin(companyId: string, meetingId: string, role: 'host' | 'board' | 'attendee', displayName: string) {
    const m = await this.prisma.scoped([companyId], (tx) => tx.meeting.findFirst({ where: { id: meetingId, companyId } }));
    if (!m) throw new NotFoundException('Meeting not found');
    return this.video.joinInfo(m.videoRoomId, role, displayName);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

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

  private async findParticipantMeeting(tx: Tx, companyIds: string[], meetingId: string) {
    const m = await tx.meeting.findFirst({
      where: {
        id: meetingId,
        companyId: { in: companyIds },
        state: { in: [...PUBLISHED_STATES] },
      },
    });
    if (!m) throw new NotFoundException('Meeting not found');
    return m;
  }

  private async resolveRegistration(tx: Tx, userId: string, meetingId: string, participantId?: string) {
    if (participantId) {
      const reg = await tx.meetingParticipant.findFirst({
        where: { id: participantId, meetingId, userId, status: 'REGISTERED' },
      });
      if (!reg) throw new NotFoundException('Registration not found');
      return reg;
    }
    const regs = await tx.meetingParticipant.findMany({
      where: { userId, meetingId, status: 'REGISTERED' },
    });
    if (regs.length === 0) throw new ForbiddenException('You are not registered for this meeting');
    if (regs.length > 1) throw new BadRequestException('Specify which registration to act under');
    return regs[0]!;
  }
}
