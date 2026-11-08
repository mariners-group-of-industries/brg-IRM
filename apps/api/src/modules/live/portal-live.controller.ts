import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { finalize, map, type Observable } from 'rxjs';
import {
  motionSchema,
  pollDemandSchema,
  textQuestionSchema,
  type MeetingEvent,
  type MeetingRoom,
  type MotionDto,
  type PollDemandSummary,
  type QuestionDto,
  type VideoJoinInfo,
} from '@irm/shared';
import { Meta, Principal } from '../../common/decorators.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { parseBody } from '../../common/zod.js';
import { LiveService } from './live.service.js';
import { MeetingEventsService, type Audience } from './meeting-events.service.js';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@ApiTags('portal-live')
@Controller('participant/meetings/:meetingId/live')
export class PortalLiveController {
  constructor(
    private readonly live: LiveService,
    private readonly events: MeetingEventsService,
  ) {}

  private assertParticipant(p: AuthPrincipal) {
    if (p.kind !== 'PARTICIPANT') {
      throw new ForbiddenException('This area is for registered meeting participants');
    }
  }

  @Get('room')
  async room(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Meta() meta: RequestMeta,
  ): Promise<MeetingRoom> {
    this.assertParticipant(p);
    await this.live.recordParticipantAttendance(p, meetingId, meta);
    return this.live.getRoom(p, meetingId, meta);
  }

  @Get('video')
  async video(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Meta() meta: RequestMeta,
  ): Promise<VideoJoinInfo> {
    this.assertParticipant(p);
    return this.live.getParticipantVideoJoin(p, meetingId, meta);
  }

  @Post('motion')
  @HttpCode(200)
  async motion(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<MotionDto> {
    this.assertParticipant(p);
    const input = parseBody(motionSchema, body);
    return this.live.submitMotion(p, meetingId, input, meta);
  }

  @Post('poll-demand')
  @HttpCode(200)
  async pollDemand(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<PollDemandSummary> {
    this.assertParticipant(p);
    const input = parseBody(pollDemandSchema, body);
    return this.live.submitPollDemand(p, meetingId, input, meta);
  }

  @Post('questions')
  async submitTextQuestion(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<QuestionDto> {
    this.assertParticipant(p);
    const input = parseBody(textQuestionSchema, body);
    return this.live.submitTextQuestion(p, meetingId, input, meta);
  }

  @Post('questions/audio')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  async submitAudioQuestion(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { durationSeconds?: string | number; agendaItemId?: string; participantId?: string },
    @Meta() meta: RequestMeta,
  ): Promise<QuestionDto> {
    this.assertParticipant(p);
    if (!file || !file.buffer) {
      throw new BadRequestException('Audio file is required');
    }
    const durationSeconds = Number(body.durationSeconds);
    if (Number.isNaN(durationSeconds)) {
      throw new BadRequestException('durationSeconds is required and must be a number');
    }

    return this.live.submitAudioQuestion(
      p,
      meetingId,
      { buffer: file.buffer, originalname: file.originalname },
      durationSeconds,
      body.agendaItemId,
      body.participantId,
      meta,
    );
  }

  @Post('attendance/heartbeat')
  @HttpCode(200)
  async heartbeat(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Meta() meta: RequestMeta,
  ): Promise<{ ok: true }> {
    this.assertParticipant(p);
    await this.live.recordParticipantAttendance(p, meetingId, meta);
    return { ok: true };
  }

  @Post('attendance/leave')
  @HttpCode(200)
  async leave(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<{ ok: true }> {
    this.assertParticipant(p);
    await this.live.closeParticipantAttendance(p, meetingId);
    return { ok: true };
  }

  @Sse('events')
  async streamEvents(
    @Principal() p: AuthPrincipal,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Meta() meta: RequestMeta,
  ): Promise<Observable<MessageEvent>> {
    this.assertParticipant(p);
    const attendanceId = await this.live.recordParticipantAttendance(p, meetingId, meta, true);

    const audiences = new Set<Audience>(['all']);
    return this.events.stream(meetingId, audiences).pipe(
      map((ev: MeetingEvent) => ({ data: ev })),
      finalize(() => {
        if (attendanceId) {
          void this.live.closeParticipantAttendance(p, meetingId, attendanceId);
        }
      }),
    );
  }
}
