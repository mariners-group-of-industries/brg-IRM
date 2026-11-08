import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  castVoteSchema,
  type CastVoteResult,
  type ParticipantVotingSessionDto,
} from '@irm/shared';
import { Meta, Principal } from '../../common/decorators.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { parseBody } from '../../common/zod.js';
import { VotingService } from './voting.service.js';

@ApiTags('portal-voting')
@Controller('participant/meetings/:meetingId/live')
export class PortalVotingController {
  constructor(private readonly voting: VotingService) {}

  private assertParticipant(p: AuthPrincipal) {
    if (p.kind !== 'PARTICIPANT') {
      throw new ForbiddenException('This area is for registered meeting participants');
    }
  }

  @Post('vote')
  @HttpCode(200)
  async castVote(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<CastVoteResult> {
    this.assertParticipant(p);
    const input = parseBody(castVoteSchema, body);
    return this.voting.castBallot(p, meetingId, idempotencyKey, input, meta);
  }

  @Get('results')
  async results(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<ParticipantVotingSessionDto[]> {
    this.assertParticipant(p);
    return this.voting.getParticipantResults(p, meetingId);
  }
}

