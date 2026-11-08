import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  PERMISSIONS,
  openVotingSessionSchema,
  type IndividualBallotInspectionDto,
  type SessionIntegrityVerificationDto,
  type StaffVotingSessionDto,
  type VoteAuditEventDto,
  type VotingResultDto,
} from '@irm/shared';
import { Meta, Principal } from '../../common/decorators.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { parseBody } from '../../common/zod.js';
import { AccessService } from '../access/access.service.js';
import { VotingService } from './voting.service.js';

@ApiTags('voting')
@Controller('companies/:companyId/meetings/:meetingId/voting')
export class VotingController {
  constructor(
    private readonly voting: VotingService,
    private readonly access: AccessService,
  ) {}

  private assertStaff(p: AuthPrincipal) {
    if (p.kind !== 'STAFF') {
      throw new ForbiddenException('Staff account required');
    }
  }

  @Get('sessions')
  async listSessions(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ): Promise<StaffVotingSessionDto[]> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ);
    return this.voting.listStaffSessions(p, { tenantId: c.tenantId, companyId: c.id }, meetingId);
  }

  @Post('sessions/open')
  async openSession(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<StaffVotingSessionDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.VOTING_CONTROL, meta);
    const input = parseBody(openVotingSessionSchema, body);
    return this.voting.openSession(p, { tenantId: c.tenantId, companyId: c.id }, meetingId, input, meta);
  }

  @Post('sessions/:sessionId/close')
  @HttpCode(200)
  async closeSession(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Meta() meta: RequestMeta,
  ): Promise<StaffVotingSessionDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.VOTING_CONTROL, meta);
    return this.voting.closeSession(p, { tenantId: c.tenantId, companyId: c.id }, meetingId, sessionId, meta);
  }

  @Post('sessions/:sessionId/release')
  @HttpCode(200)
  async releaseResults(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Meta() meta: RequestMeta,
  ): Promise<StaffVotingSessionDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.VOTING_RESULTS_RELEASE, meta);
    return this.voting.releaseResults(p, { tenantId: c.tenantId, companyId: c.id }, meetingId, sessionId, meta);
  }

  @Get('sessions/:sessionId/results')
  async getResults(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<VotingResultDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.VOTING_RESULTS_READ);
    return this.voting.getSessionResults(p, { tenantId: c.tenantId, companyId: c.id }, meetingId, sessionId);
  }

  @Get('sessions/:sessionId/audit')
  async getAudit(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<VoteAuditEventDto[]> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.VOTING_RESULTS_READ);
    return this.voting.getSessionAudit({ tenantId: c.tenantId, companyId: c.id }, meetingId, sessionId);
  }

  @Get('sessions/:sessionId/verify')
  async verifyIntegrity(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<SessionIntegrityVerificationDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.VOTING_RESULTS_READ);
    return this.voting.verifySessionIntegrity({ tenantId: c.tenantId, companyId: c.id }, meetingId, sessionId);
  }

  @Get('sessions/:sessionId/ballots')
  async inspectBallots(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Meta() meta: RequestMeta,
  ): Promise<IndividualBallotInspectionDto[]> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ, meta);
    return this.voting.inspectSessionBallots(p, { tenantId: c.tenantId, companyId: c.id }, meetingId, sessionId, meta);
  }
}

