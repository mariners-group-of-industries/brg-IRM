import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MinutesService } from './minutes.service.js';
import { Principal } from '../../common/decorators.js';
import type { AuthPrincipal } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('portal-minutes')
@Controller('participant/meetings/:meetingId/minutes')
export class PortalMinutesController {
  constructor(
    private readonly minutes: MinutesService,
    private readonly prisma: PrismaService,
  ) {}

  private assertParticipant(p: AuthPrincipal) {
    if (p.kind !== 'PARTICIPANT') {
      throw new ForbiddenException('This area is for registered meeting participants');
    }
  }

  @Get()
  async getPublishedMinutes(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    this.assertParticipant(p);
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
    });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const [links, participant] = await Promise.all([
      this.prisma.participantLink.findMany({
        where: { userId: p.userId, companyId: meeting.companyId },
      }),
      this.prisma.meetingParticipant.findFirst({
        where: { meetingId, userId: p.userId },
      }),
    ]);

    if (links.length === 0 && !participant) {
      throw new NotFoundException('You do not have access to this meeting');
    }

    return this.minutes.getPublishedMinutesForParticipant(meeting.companyId, meetingId);
  }
}
