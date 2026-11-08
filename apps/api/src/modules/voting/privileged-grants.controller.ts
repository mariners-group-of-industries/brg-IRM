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
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  PERMISSIONS,
  decidePrivilegedGrantSchema,
  requestPrivilegedGrantSchema,
  type PrivilegedGrantDto,
  type PrivilegedGrantListDto,
} from '@irm/shared';
import { Meta, Principal } from '../../common/decorators.js';
import type { AuthPrincipal, RequestMeta } from '../../common/request-context.js';
import { parseBody } from '../../common/zod.js';
import { AccessService } from '../access/access.service.js';
import { VotingService } from './voting.service.js';

@ApiTags('privileged-grants')
@Controller('companies/:companyId/privileged-grants')
export class PrivilegedGrantsController {
  constructor(
    private readonly voting: VotingService,
    private readonly access: AccessService,
  ) {}

  private assertStaff(p: AuthPrincipal) {
    if (p.kind !== 'STAFF') {
      throw new ForbiddenException('Staff account required');
    }
  }

  @Get()
  async list(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Query('meetingId') meetingId?: string,
  ): Promise<PrivilegedGrantListDto> {
    this.assertStaff(p);
    if (meetingId !== undefined && !z.string().uuid().safeParse(meetingId).success) {
      throw new BadRequestException('meetingId must be a valid UUID');
    }
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.MEETING_READ);
    return this.voting.listPrivilegedGrants(p, { tenantId: c.tenantId, companyId: c.id }, meetingId);
  }

  @Post()
  async request(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<PrivilegedGrantDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.AUTHORIZATION_MANAGE, meta);
    const input = parseBody(requestPrivilegedGrantSchema, body);
    return this.voting.requestPrivilegedGrant(p, { tenantId: c.tenantId, companyId: c.id }, input, meta);
  }

  @Post(':id/decision')
  @HttpCode(200)
  async decide(
    @Principal() p: AuthPrincipal,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Meta() meta: RequestMeta,
  ): Promise<PrivilegedGrantDto> {
    this.assertStaff(p);
    const c = await this.access.assertCompany(p, companyId, PERMISSIONS.AUTHORIZATION_MANAGE, meta);
    const input = parseBody(decidePrivilegedGrantSchema, body);
    return this.voting.decidePrivilegedGrant(p, { tenantId: c.tenantId, companyId: c.id }, id, input, meta);
  }
}

