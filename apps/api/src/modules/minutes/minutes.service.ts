import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { hasPermission } from '@irm/shared';
import { generateMinutesDraft, type MeetingMinutesDto, type MinutesSeedData, updateMinutesSchema, finalizeMinutesSchema } from '@irm/shared';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';

export interface CompanyScope {
  tenantId: string;
  companyId: string;
}

@Injectable()
export class MinutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMinutes(principal: AuthPrincipal, scope: CompanyScope, meetingId: string): Promise<{ minutes: MeetingMinutesDto | null; suggestedDraft: string }> {
    if (!hasPermission(principal.assignments, 'meeting.read', scope)) {
      throw new ForbiddenException('You do not have permission to view meeting minutes');
    }

    return this.prisma.scoped([scope.companyId], async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, companyId: scope.companyId },
        include: {
          minutes: true,
          agendaItems: {
            include: { resolution: true },
            orderBy: { position: 'asc' },
          },
          staff: true,
          votingResults: {
            include: {
              votingSession: true,
            },
            orderBy: { sealedAt: 'asc' },
          },
        },
      });

      if (!meeting) throw new NotFoundException('Meeting not found');

      // Gather attendance and participant counts
      const [participantCount, motions] = await Promise.all([
        tx.meetingParticipant.count({ where: { meetingId } }),
        tx.motion.findMany({
          where: { meetingId, status: 'ACCEPTED' },
        }),
      ]);

      const staffUserIds = meeting.staff.map((s) => s.userId);
      const staffUsers = staffUserIds.length > 0
        ? await tx.user.findMany({ where: { id: { in: staffUserIds } } })
        : [];
      const staffUserMap = new Map(staffUsers.map((u) => [u.id, u.fullName || u.email]));
      const boardMembers = meeting.staff
        .filter((s) => s.role === 'BOARD_MEMBER')
        .map((s) => staffUserMap.get(s.userId) || 'Board Member');

      const motionShareholderIds = motions.map((m) => m.shareholderId);
      const shareholders = motionShareholderIds.length > 0
        ? await tx.shareholder.findMany({ where: { id: { in: motionShareholderIds } } })
        : [];
      const shareholderMap = new Map(shareholders.map((s) => [s.id, s.name]));

      // Calculate total represented share votes from snapshots or attendance
      const snapshotVotes = await tx.votingEntitlement.aggregate({
        where: { meetingId },
        _sum: { weight: true },
      });
      const totalRepresentedVotes = (snapshotVotes._sum.weight ?? 0n).toLocaleString('en-US');

      const company = await tx.company.findUnique({ where: { id: scope.companyId } });

      const seedData: MinutesSeedData = {
        companyName: company?.legalName || company?.shortName || 'Company',
        meetingTitle: meeting.title,
        meetingType: meeting.type,
        scheduledStart: meeting.scheduledStart.toISOString(),
        mode: meeting.mode,
        venue: meeting.venue,
        boardMembers,
        attendeeCount: participantCount,
        representedVotes: totalRepresentedVotes,
        resolutions: meeting.agendaItems.map((item) => {
          const resResult = meeting.votingResults.find((r) => r.votingSession?.agendaItemId === item.id);
          const proposal = motions.find((m) => m.agendaItemId === item.id && m.kind === 'PROPOSAL');
          const seconding = motions.find((m) => m.agendaItemId === item.id && m.kind === 'SECONDING');

          return {
            number: item.number,
            title: item.title,
            resolutionKind: item.resolution?.kind || 'ORDINARY',
            resolutionText: item.resolution?.text || item.description || item.title,
            proposerName: proposal ? shareholderMap.get(proposal.shareholderId) : undefined,
            seconderName: seconding ? shareholderMap.get(seconding.shareholderId) : undefined,
            forVotes: (resResult?.forVotes ?? 0n).toLocaleString('en-US'),
            againstVotes: (resResult?.againstVotes ?? 0n).toLocaleString('en-US'),
            abstainVotes: (resResult?.abstainVotes ?? 0n).toLocaleString('en-US'),
            outcome: resResult ? (resResult.passed ? 'PASSED' : 'FAILED') : 'PENDING',
            majorityPct: resResult && resResult.baseVotes > 0n
              ? ((Number(resResult.forVotes * 10000n / resResult.baseVotes)) / 100).toFixed(2)
              : '0.00',
          };
        }),
      };

      const suggestedDraft = generateMinutesDraft(seedData);

      const minutesDto: MeetingMinutesDto | null = meeting.minutes
        ? {
            id: meeting.minutes.id,
            meetingId: meeting.minutes.meetingId,
            content: meeting.minutes.content,
            status: meeting.minutes.status,
            signedBy: meeting.minutes.signedBy,
            finalizedAt: meeting.minutes.finalizedAt?.toISOString() ?? null,
            publishedAt: meeting.minutes.publishedAt?.toISOString() ?? null,
            createdAt: meeting.minutes.createdAt.toISOString(),
            updatedAt: meeting.minutes.updatedAt.toISOString(),
          }
        : null;

      return {
        minutes: minutesDto,
        suggestedDraft,
      };
    });
  }

  async updateMinutes(
    principal: AuthPrincipal,
    scope: CompanyScope,
    meetingId: string,
    rawInput: unknown,
    meta: RequestMeta,
  ): Promise<MeetingMinutesDto> {
    if (!hasPermission(principal.assignments, 'meeting.update', scope)) {
      throw new ForbiddenException('You do not have permission to edit meeting minutes');
    }
    const input = updateMinutesSchema.parse(rawInput);

    return this.prisma.scoped([scope.companyId], async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, companyId: scope.companyId },
        include: { minutes: true },
      });
      if (!meeting) throw new NotFoundException('Meeting not found');

      if (meeting.minutes?.status === 'PUBLISHED') {
        throw new ConflictException('Published minutes cannot be modified directly. Reopen them first.');
      }

      const minutes = await tx.meetingMinutes.upsert({
        where: { meetingId },
        create: {
          tenantId: scope.tenantId,
          companyId: scope.companyId,
          meetingId,
          content: input.content,
          status: 'DRAFT',
          createdById: principal.userId,
        },
        update: {
          content: input.content,
          status: 'DRAFT',
        },
      });

      await this.audit.record(
        {
          action: 'meeting.minutes.updated',
          outcome: 'SUCCESS',
          actorUserId: principal.userId,
          actorEmail: principal.email,
          ...scope,
          targetType: 'meeting_minutes',
          targetId: minutes.id,
          metadata: { meetingId, status: minutes.status },
          meta,
        },
        tx,
      );

      return {
        id: minutes.id,
        meetingId: minutes.meetingId,
        content: minutes.content,
        status: minutes.status,
        signedBy: minutes.signedBy,
        finalizedAt: minutes.finalizedAt?.toISOString() ?? null,
        publishedAt: minutes.publishedAt?.toISOString() ?? null,
        createdAt: minutes.createdAt.toISOString(),
        updatedAt: minutes.updatedAt.toISOString(),
      };
    });
  }

  async finalizeMinutes(
    principal: AuthPrincipal,
    scope: CompanyScope,
    meetingId: string,
    rawInput: unknown,
    meta: RequestMeta,
  ): Promise<MeetingMinutesDto> {
    if (!hasPermission(principal.assignments, 'meeting.update', scope)) {
      throw new ForbiddenException('You do not have permission to finalize meeting minutes');
    }
    const input = finalizeMinutesSchema.parse(rawInput);

    return this.prisma.scoped([scope.companyId], async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, companyId: scope.companyId },
        include: { minutes: true },
      });
      if (!meeting) throw new NotFoundException('Meeting not found');
      const content = meeting.minutes?.content ?? '# Minutes\n\nOfficial minutes of the meeting.';
      const minutes = await tx.meetingMinutes.upsert({
        where: { meetingId },
        create: {
          tenantId: scope.tenantId,
          companyId: scope.companyId,
          meetingId,
          content,
          status: 'FINAL',
          signedBy: input.signedBy,
          finalizedAt: new Date(),
          createdById: principal.userId,
        },
        update: {
          status: 'FINAL',
          signedBy: input.signedBy,
          finalizedAt: new Date(),
        },
      });

      await this.audit.record(
        {
          action: 'meeting.minutes.finalized',
          outcome: 'SUCCESS',
          actorUserId: principal.userId,
          actorEmail: principal.email,
          ...scope,
          targetType: 'meeting_minutes',
          targetId: minutes.id,
          metadata: { meetingId, signedBy: input.signedBy },
          meta,
        },
        tx,
      );

      return {
        id: minutes.id,
        meetingId: minutes.meetingId,
        content: minutes.content,
        status: minutes.status,
        signedBy: minutes.signedBy,
        finalizedAt: minutes.finalizedAt?.toISOString() ?? null,
        publishedAt: minutes.publishedAt?.toISOString() ?? null,
        createdAt: minutes.createdAt.toISOString(),
        updatedAt: minutes.updatedAt.toISOString(),
      };
    });
  }

  async publishMinutes(principal: AuthPrincipal, scope: CompanyScope, meetingId: string, meta: RequestMeta): Promise<MeetingMinutesDto> {
    if (!hasPermission(principal.assignments, 'meeting.update', scope)) {
      throw new ForbiddenException('You do not have permission to publish meeting minutes');
    }

    return this.prisma.scoped([scope.companyId], async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, companyId: scope.companyId },
        include: { minutes: true },
      });
      if (!meeting) throw new NotFoundException('Meeting not found');
      if (!meeting.minutes) throw new BadRequestException('No minutes drafted yet');

      const minutes = await tx.meetingMinutes.update({
        where: { meetingId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      await this.audit.record(
        {
          action: 'meeting.minutes.published',
          outcome: 'SUCCESS',
          actorUserId: principal.userId,
          actorEmail: principal.email,
          ...scope,
          targetType: 'meeting_minutes',
          targetId: minutes.id,
          metadata: { meetingId },
          meta,
        },
        tx,
      );

      return {
        id: minutes.id,
        meetingId: minutes.meetingId,
        content: minutes.content,
        status: minutes.status,
        signedBy: minutes.signedBy,
        finalizedAt: minutes.finalizedAt?.toISOString() ?? null,
        publishedAt: minutes.publishedAt?.toISOString() ?? null,
        createdAt: minutes.createdAt.toISOString(),
        updatedAt: minutes.updatedAt.toISOString(),
      };
    });
  }

  async reopenMinutes(principal: AuthPrincipal, scope: CompanyScope, meetingId: string, meta: RequestMeta): Promise<MeetingMinutesDto> {
    if (!hasPermission(principal.assignments, 'meeting.update', scope)) {
      throw new ForbiddenException('You do not have permission to edit meeting minutes');
    }

    return this.prisma.scoped([scope.companyId], async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, companyId: scope.companyId },
        include: { minutes: true },
      });
      if (!meeting) throw new NotFoundException('Meeting not found');
      if (!meeting.minutes) throw new BadRequestException('No minutes found');

      const minutes = await tx.meetingMinutes.update({
        where: { meetingId },
        data: {
          status: 'DRAFT',
        },
      });

      await this.audit.record(
        {
          action: 'meeting.minutes.reopened',
          outcome: 'SUCCESS',
          actorUserId: principal.userId,
          actorEmail: principal.email,
          ...scope,
          targetType: 'meeting_minutes',
          targetId: minutes.id,
          metadata: { meetingId },
          meta,
        },
        tx,
      );

      return {
        id: minutes.id,
        meetingId: minutes.meetingId,
        content: minutes.content,
        status: minutes.status,
        signedBy: minutes.signedBy,
        finalizedAt: minutes.finalizedAt?.toISOString() ?? null,
        publishedAt: minutes.publishedAt?.toISOString() ?? null,
        createdAt: minutes.createdAt.toISOString(),
        updatedAt: minutes.updatedAt.toISOString(),
      };
    });
  }

  async getPublishedMinutesForParticipant(companyId: string, meetingId: string): Promise<MeetingMinutesDto> {
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        meetingId,
        companyId,
        status: 'PUBLISHED',
      },
    });

    if (!minutes) {
      throw new NotFoundException('Minutes are not published for this meeting');
    }

    return {
      id: minutes.id,
      meetingId: minutes.meetingId,
      content: minutes.content,
      status: minutes.status,
      signedBy: minutes.signedBy,
      finalizedAt: minutes.finalizedAt?.toISOString() ?? null,
      publishedAt: minutes.publishedAt?.toISOString() ?? null,
      createdAt: minutes.createdAt.toISOString(),
      updatedAt: minutes.updatedAt.toISOString(),
    };
  }
}
