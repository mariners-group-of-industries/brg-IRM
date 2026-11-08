import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { AccessService } from '../access/access.service.js';
import { Principal } from '../../common/decorators.js';
import type { AuthPrincipal } from '../../common/request-context.js';
import { PERMISSIONS, REPORT_FORMATS, REPORT_KINDS, type ReportFormat, type ReportKind } from '@irm/shared';

@ApiTags('reports')
@Controller('companies/:companyId/meetings/:meetingId/reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly access: AccessService,
  ) {}

  private assertStaff(p: AuthPrincipal) {
    if (p.kind !== 'STAFF') {
      throw new ForbiddenException('Staff account required');
    }
  }

  @Get(':kind')
  async downloadReport(
    @Principal() p: AuthPrincipal,
    @Res() res: Response,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('meetingId', new ParseUUIDPipe()) meetingId: string,
    @Param('kind') rawKind: string,
    @Query('format') rawFormat?: string,
  ) {
    this.assertStaff(p);
    const kind = rawKind.toUpperCase().replace(/-/g, '_') as ReportKind;
    if (!REPORT_KINDS.includes(kind)) {
      throw new BadRequestException(`Unknown report kind: ${rawKind}. Allowed: ${REPORT_KINDS.join(', ')}`);
    }

    const format = (rawFormat?.toLowerCase() || 'pdf') as ReportFormat;
    if (!REPORT_FORMATS.includes(format)) {
      throw new BadRequestException(`Unknown format: ${rawFormat}. Allowed: ${REPORT_FORMATS.join(', ')}`);
    }

    const company = await this.access.assertCompany(p, companyId, PERMISSIONS.REPORT_GENERATE);
    const scope = { tenantId: company.tenantId, companyId: company.id };
    const { filename, contentType, buffer } = await this.reports.generateReport(p, scope, meetingId, kind, format);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
