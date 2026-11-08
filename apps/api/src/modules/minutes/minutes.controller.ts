import { Controller, Get, Put, Post, Param, ParseUUIDPipe, Body, ForbiddenException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MinutesService } from './minutes.service.js';
import { AccessService } from '../access/access.service.js';
import { Meta, Principal } from '../../common/decorators.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { PERMISSIONS } from '@irm/shared';

@ApiTags('minutes')
@Controller('companies/:companyId/meetings/:meetingId/minutes')
export class MinutesController {
  constructor(
    private readonly minutes: MinutesService,
    private readonly access: AccessService,
  ) {}

  private assertStaff(p: AuthPrincipal) {
    if (p.kind !== 'STAFF') throw new ForbiddenException('Staff account required');
  }

  @Get()
  async get(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ) {
    this.assertStaff(p);
    const company = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ);
    return this.minutes.getMinutes(p, { tenantId: company.tenantId, companyId: company.id }, meetingId);
  }

  @Put()
  async update(
    @Principal() p: AuthPrincipal,
    @Meta() meta: RequestMeta,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
  ) {
    this.assertStaff(p);
    const company = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_UPDATE, meta);
    return this.minutes.updateMinutes(p, { tenantId: company.tenantId, companyId: company.id }, meetingId, body, meta);
  }

  @Post('finalize')
  async finalize(
    @Principal() p: AuthPrincipal,
    @Meta() meta: RequestMeta,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Body() body: unknown,
  ) {
    this.assertStaff(p);
    const company = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_UPDATE, meta);
    return this.minutes.finalizeMinutes(p, { tenantId: company.tenantId, companyId: company.id }, meetingId, body, meta);
  }

  @Post('publish')
  async publish(
    @Principal() p: AuthPrincipal,
    @Meta() meta: RequestMeta,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ) {
    this.assertStaff(p);
    const company = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_UPDATE, meta);
    return this.minutes.publishMinutes(p, { tenantId: company.tenantId, companyId: company.id }, meetingId, meta);
  }

  @Post('reopen')
  async reopen(
    @Principal() p: AuthPrincipal,
    @Meta() meta: RequestMeta,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
  ) {
    this.assertStaff(p);
    const company = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_UPDATE, meta);
    return this.minutes.reopenMinutes(p, { tenantId: company.tenantId, companyId: company.id }, meetingId, meta);
  }
}
