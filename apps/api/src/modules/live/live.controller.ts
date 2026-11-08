import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  Sse,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { finalize, map, type Observable } from 'rxjs';
import {
  PERMISSIONS,
  activeItemSchema,
  announcementSchema,
  moderationSchema,
  stageToggleSchema,
  videoRoomSchema,
  type AnnouncementDto,
  type BoardRoom,
  type LiveConsole,
  type MeetingEvent,
  type MotionDto,
  type QuestionDto,
  type VideoJoinInfo,
} from '@irm/shared';
import { Meta, Principal } from '../../common/decorators.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { parseBody } from '../../common/zod.js';
import { AccessService } from '../access/access.service.js';
import { LiveService } from './live.service.js';
import { MeetingEventsService, type Audience } from './meeting-events.service.js';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@ApiTags('live')
@Controller('companies/:companyId/meetings/:meetingId/live')
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly access: AccessService,
    private readonly events: MeetingEventsService,
  ) {}

  @Get('console')
  async console(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<LiveConsole> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.ATTENDANCE_READ);
    return this.live.getConsole(companyId, meetingId);
  }

  @Put('video-room')
  async setVideoRoom(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<{ videoRoomId: string | null }> {
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ, meta);
    const scope = { tenantId: c.tenantId, companyId: c.id };
    if (!this.access.can(p, PERMISSIONS.MEETING_CONTROL, scope) && !this.access.can(p, PERMISSIONS.MEETING_UPDATE, scope)) {
      await this.access.assert(p, PERMISSIONS.MEETING_CONTROL, scope, meta);
    }
    const { videoRoomId } = parseBody(videoRoomSchema, body);
    return this.live.setVideoRoomId(companyId, meetingId, videoRoomId, p, meta);
  }

  @Post('active-item')
  @HttpCode(200)
  async setActiveAgendaItem(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<{ ok: true }> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_CONTROL, meta);
    const { agendaItemId } = parseBody(activeItemSchema, body);
    await this.live.setActiveAgendaItem(companyId, meetingId, agendaItemId, p, meta);
    return { ok: true };
  }

  @Post('stage')
  @HttpCode(200)
  async toggleStage(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<{ ok: true }> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_CONTROL, meta);
    const { agendaItemId, stage, open } = parseBody(stageToggleSchema, body);
    await this.live.toggleStage(companyId, meetingId, agendaItemId, stage, open, p, meta);
    return { ok: true };
  }

  @Post('motions/:id/accept')
  @HttpCode(200)
  async acceptMotion(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Meta() meta: RequestMeta,
  ): Promise<MotionDto> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_CONTROL, meta);
    return this.live.acceptMotion(companyId, meetingId, id, p, meta);
  }

  @Post('announcements')
  async createAnnouncement(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<AnnouncementDto> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.ANNOUNCEMENT_MANAGE, meta);
    const { body: text } = parseBody(announcementSchema, body);
    return this.live.createAnnouncement(companyId, meetingId, text, p, meta);
  }

  @Delete('announcements/:id')
  @HttpCode(200)
  async retractAnnouncement(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Meta() meta: RequestMeta,
  ): Promise<{ ok: true }> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.ANNOUNCEMENT_MANAGE, meta);
    await this.live.retractAnnouncement(companyId, meetingId, id, p, meta);
    return { ok: true };
  }

  @Get('moderation/questions')
  async getQuestions(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<QuestionDto[]> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.QUESTION_MODERATE);
    return this.live.getQuestionsForModeration(companyId, meetingId);
  }

  @Post('moderation/questions/:id/action')
  @HttpCode(200)
  async moderateQuestion(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<QuestionDto> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.QUESTION_MODERATE, meta);
    const { action, note } = parseBody(moderationSchema, body);
    return this.live.moderateQuestion(companyId, meetingId, id, action, note, p, meta);
  }

  @Get('questions/:id/audio')
  async getAudio(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response,
    @Meta() meta: RequestMeta,
  ): Promise<StreamableFile> {
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ, meta);
    const scope = { tenantId: c.tenantId, companyId: c.id };
    const canModerate = this.access.can(p, PERMISSIONS.QUESTION_MODERATE, scope);
    if (!canModerate) {
      await this.access.assert(p, PERMISSIONS.QUESTION_FORWARDED_READ, scope, meta);
    }
    const audio = await this.live.getQuestionAudio(companyId, meetingId, id, !canModerate);
    res.setHeader('Content-Type', audio.mimeType);
    res.setHeader('Content-Length', audio.buffer.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(audio.originalName)}"`);
    return new StreamableFile(audio.buffer);
  }

  @Get('board')
  async getBoardRoom(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<BoardRoom> {
    await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_JOIN_BOARD);
    return this.live.getBoardRoom(companyId, meetingId);
  }

  @Get('video')
  async getVideoJoin(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<VideoJoinInfo> {
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ);
    const scope = { tenantId: c.tenantId, companyId: c.id };
    const role: 'host' | 'board' | 'attendee' = this.access.can(p, PERMISSIONS.MEETING_CONTROL, scope)
      ? 'host'
      : this.access.can(p, PERMISSIONS.MEETING_JOIN_BOARD, scope)
        ? 'board'
        : 'attendee';
    return this.live.getVideoJoin(companyId, meetingId, role, p.fullName);
  }

  @Sse('events')
  async streamEvents(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Meta() meta: RequestMeta,
  ): Promise<Observable<MessageEvent>> {
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ, meta);
    const scope = { tenantId: c.tenantId, companyId: c.id };

    const isBoard = this.access.can(p, PERMISSIONS.MEETING_JOIN_BOARD, scope);
    const isMod = this.access.can(p, PERMISSIONS.QUESTION_MODERATE, scope);
    const role = isBoard ? 'BOARD' : isMod ? 'MODERATOR' : 'STAFF';

    const attendanceId = await this.live.recordStaffAttendance(companyId, p, meetingId, role, meta);

    const audiences = new Set<Audience>(['all', 'staff']);
    if (isBoard) audiences.add('board');
    if (isMod) audiences.add('moderators');

    return this.events.stream(meetingId, audiences).pipe(
      map((ev: MeetingEvent) => ({ data: ev })),
      finalize(() => {
        if (attendanceId) {
          void this.live.closeStaffAttendance(companyId, meetingId, attendanceId);
        }
      }),
    );
  }
}
