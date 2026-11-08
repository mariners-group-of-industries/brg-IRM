import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { Principal } from '../../common/decorators.js';
import type { AuthPrincipal } from '../../common/request-context.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@ApiTags('portal-reports')
@Controller('participant/meetings/:meetingId/reports')
export class PortalReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  private assertParticipant(p: AuthPrincipal) {
    if (p.kind !== 'PARTICIPANT') {
      throw new ForbiddenException('This area is for registered meeting participants');
    }
  }

  @Get('voting-results')
  async downloadVotingResults(
    @Principal() p: AuthPrincipal,
    @Res() res: Response,
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

    const { filename, contentType, buffer } = await this.reports.generateParticipantVotingResultsReport(
      meeting.companyId,
      meetingId,
      p.fullName || 'Shareholder',
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
