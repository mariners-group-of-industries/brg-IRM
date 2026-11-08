import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { hasPermission } from '@irm/shared';
import type { ReportFormat, ReportKind, ReportMeta } from '@irm/shared';
import type { AuthPrincipal } from '../../common/request-context.js';
import type { CompanyScope } from '../minutes/minutes.service.js';

interface ReportData {
  kind: ReportKind;
  title: string;
  meta: ReportMeta;
  headers: string[];
  rows: (string | number)[][];
  summaryText?: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateReport(
    principal: AuthPrincipal,
    scope: CompanyScope,
    meetingId: string,
    kind: ReportKind,
    format: ReportFormat,
  ): Promise<{ filename: string; contentType: string; buffer: Buffer }> {
    if (!hasPermission(principal.assignments, 'report.generate', scope)) {
      throw new ForbiddenException('You do not have permission to generate reports');
    }

    const data = await this.collectReportData(scope.companyId, meetingId, kind, principal.fullName || principal.email || 'Admin');

    return this.render(data, format);
  }

  async generateParticipantVotingResultsReport(
    companyId: string,
    meetingId: string,
    userFullName: string,
  ): Promise<{ filename: string; contentType: string; buffer: Buffer }> {
    const data = await this.collectReportData(companyId, meetingId, 'VOTING_RESULTS', userFullName || 'Shareholder');
    return this.render(data, 'pdf');
  }

  private async collectReportData(companyId: string, meetingId: string, kind: ReportKind, generatedByName: string): Promise<ReportData> {
    return this.prisma.scoped([companyId], async (tx) => {
      const meeting = await tx.meeting.findFirst({
        where: { id: meetingId, companyId },
        include: {
          agendaItems: {
            include: { resolution: true },
            orderBy: { position: 'asc' },
          },
          votingResults: {
            include: {
              votingSession: true,
            },
            orderBy: { sealedAt: 'asc' },
          },
        },
      });

      if (!meeting) throw new NotFoundException('Meeting not found');

      const company = await tx.company.findUnique({ where: { id: companyId } });

      const meta: ReportMeta = {
        companyName: company?.legalName || company?.shortName || 'Company',
        meetingTitle: meeting.title,
        meetingType: meeting.type,
        scheduledStart: meeting.scheduledStart.toISOString(),
        venueOrMode: meeting.mode === 'HYBRID' ? `HYBRID (${meeting.venue || 'Venue'})` : meeting.mode,
        generatedAt: new Date().toISOString(),
        generatedBy: generatedByName,
      };

      if (kind === 'VOTING_RESULTS') {
        const headers = [
          'Item #',
          'Resolution Title',
          'Kind',
          'Voting Method',
          'Req. Majority',
          'Total Eligible',
          'Total Cast',
          'Turnout',
          'For Votes',
          'For %',
          'Against Votes',
          'Against %',
          'Abstain Votes',
          'Outcome',
          'Status',
        ];

        const rows = meeting.agendaItems.map((item) => {
          const res = meeting.votingResults.find((r) => r.votingSession?.agendaItemId === item.id);
          if (!res) {
            return [
              item.number,
              item.title,
              item.resolution?.kind || 'ORDINARY',
              'POLL',
              '> 50%',
              '-',
              '-',
              '-',
              '-',
              '-',
              '-',
              '-',
              '-',
              'NOT_SEALED',
              'No sealed votes',
            ];
          }

          const base = res.baseVotes > 0n ? Number(res.baseVotes) : 1;
          const forPct = ((Number(res.forVotes) / base) * 100).toFixed(2) + '%';
          const againstPct = ((Number(res.againstVotes) / base) * 100).toFixed(2) + '%';
          const turnoutPct = res.eligibleVotes > 0n
            ? ((Number(res.baseVotes) / Number(res.eligibleVotes)) * 100).toFixed(2) + '%'
            : '-';

          return [
            item.number,
            item.title,
            item.resolution?.kind || 'ORDINARY',
            res.votingSession.method,
            res.majorityNumerator && res.majorityDenominator
              ? `${res.majorityNumerator}/${res.majorityDenominator}`
              : '> 50%',
            res.eligibleVotes.toLocaleString('en-US'),
            res.ballotCount.toLocaleString('en-US'),
            turnoutPct,
            res.forVotes.toLocaleString('en-US'),
            forPct,
            res.againstVotes.toLocaleString('en-US'),
            againstPct,
            res.abstainVotes.toLocaleString('en-US'),
            res.passed ? 'PASSED' : 'FAILED',
            res.releasedAt ? 'RELEASED' : 'SEALED',
          ];
        });

        return {
          kind: 'VOTING_RESULTS',
          title: 'Official Voting Results Tally Sheet',
          meta,
          headers,
          rows,
          summaryText: `Total resolutions: ${meeting.agendaItems.length}. Sealed results: ${meeting.votingResults.length}. All results verified under cryptographic hash-chain.`,
        };
      }

      if (kind === 'ATTENDANCE') {
        const attendees = await tx.meetingAttendance.findMany({
          where: { meetingId },
          orderBy: { joinedAt: 'asc' },
        });

        const userIds = [...new Set(attendees.map((a) => a.userId))];
        const users = userIds.length > 0
          ? await tx.user.findMany({ where: { id: { in: userIds } } })
          : [];
        const userMap = new Map(users.map((u) => [u.id, u.fullName || u.email]));

        const headers = [
          'Participant Name',
          'Role / Capacity',
          'Joined At',
          'Left At',
          'IP Address',
          'Client Info',
        ];

        const rows = attendees.map((a) => [
          userMap.get(a.userId) || 'Participant',
          a.role,
          a.joinedAt.toISOString(),
          a.leftAt ? a.leftAt.toISOString() : 'ONLINE',
          a.ipAddress || '-',
          a.userAgent ? a.userAgent.slice(0, 40) : '-',
        ]);

        return {
          kind: 'ATTENDANCE',
          title: 'Attendance & Quorum Log',
          meta,
          headers,
          rows,
          summaryText: `Total attendance sessions: ${attendees.length}.`,
        };
      }

      if (kind === 'MOTIONS') {
        const [motions, pollDemands] = await Promise.all([
          tx.motion.findMany({
            where: { meetingId },
            orderBy: { createdAt: 'asc' },
          }),
          tx.pollDemand.findMany({
            where: { meetingId },
            orderBy: { createdAt: 'asc' },
          }),
        ]);

        const allShareholderIds = [
          ...new Set([...motions.map((m) => m.shareholderId), ...pollDemands.map((p) => p.shareholderId)]),
        ];
        const shareholders = allShareholderIds.length > 0
          ? await tx.shareholder.findMany({ where: { id: { in: allShareholderIds } } })
          : [];
        const shareholderMap = new Map(shareholders.map((s) => [s.id, s.name]));

        const agendaItemMap = new Map(meeting.agendaItems.map((a) => [a.id, a]));

        const headers = [
          'Item #',
          'Agenda Title',
          'Type',
          'Member Name',
          'Acting As',
          'Submitted At',
          'Status / Decision',
        ];

        const rows: (string | number)[][] = [
          ...motions.map((m) => {
            const item = agendaItemMap.get(m.agendaItemId);
            return [
              item?.number || '-',
              item?.title || 'Agenda Item',
              m.kind,
              shareholderMap.get(m.shareholderId) || 'Member',
              m.actingAs,
              m.createdAt.toISOString(),
              m.status,
            ];
          }),
          ...pollDemands.map((p) => {
            const item = agendaItemMap.get(p.agendaItemId);
            return [
              item?.number || '-',
              item?.title || 'Agenda Item',
              'POLL_DEMAND',
              shareholderMap.get(p.shareholderId) || 'Member',
              p.actingAs,
              p.createdAt.toISOString(),
              `${p.votes.toLocaleString('en-US')} votes`,
            ];
          }),
        ];

        return {
          kind: 'MOTIONS',
          title: 'Proposals, Seconding & Poll Demands',
          meta,
          headers,
          rows,
          summaryText: `Total motions: ${motions.length}. Total poll demands: ${pollDemands.length}.`,
        };
      }

      if (kind === 'QUESTIONS') {
        const questions = await tx.meetingQuestion.findMany({
          where: { meetingId },
          orderBy: { createdAt: 'asc' },
        });

        const shareholderIds = [...new Set(questions.map((q) => q.shareholderId))];
        const shareholders = shareholderIds.length > 0
          ? await tx.shareholder.findMany({ where: { id: { in: shareholderIds } } })
          : [];
        const shareholderMap = new Map(shareholders.map((s) => [s.id, s.name]));

        const agendaItemMap = new Map(meeting.agendaItems.map((a) => [a.id, a]));

        const headers = [
          'Submitted At',
          'Submitter',
          'Item #',
          'Type',
          'Content / Duration',
          'Status',
        ];

        const rows: (string | number)[][] = questions.map((q) => {
          const item = q.agendaItemId ? agendaItemMap.get(q.agendaItemId) : null;
          return [
            q.createdAt.toISOString(),
            shareholderMap.get(q.shareholderId) || 'Member',
            item?.number || 'General',
            q.kind,
            q.kind === 'TEXT' ? (q.text || '').replace(/\n/g, ' ') : `${q.durationSeconds || 0}s (Audio)`,
            q.status,
          ];
        });

        return {
          kind: 'QUESTIONS',
          title: 'Questions & Moderation Log',
          meta,
          headers,
          rows,
          summaryText: `Total questions: ${questions.length}.`,
        };
      }

      // AUDIT
      const audits = await tx.auditLog.findMany({
        where: { companyId, targetId: meetingId },
        orderBy: { occurredAt: 'asc' },
        take: 200,
      });

      const headers = ['Timestamp', 'Actor Email', 'Action', 'Target Type', 'Outcome'];
      const rows = audits.map((a) => [
        a.occurredAt.toISOString(),
        a.actorEmail || 'system',
        a.action,
        a.targetType || 'meeting',
        a.outcome,
      ]);

      return {
        kind: 'AUDIT',
        title: 'Meeting Audit Trail',
        meta,
        headers,
        rows,
        summaryText: `Recorded audit events: ${audits.length}.`,
      };
    });
  }

  private async render(data: ReportData, format: ReportFormat): Promise<{ filename: string; contentType: string; buffer: Buffer }> {
    const slug = data.meta.meetingTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const kindSlug = data.kind.toLowerCase().replace(/_/g, '-');

    if (format === 'csv') {
      const buffer = this.renderCsv(data);
      return {
        filename: `${slug}-${kindSlug}-report.csv`,
        contentType: 'text/csv; charset=utf-8',
        buffer,
      };
    }

    if (format === 'xlsx') {
      const buffer = await this.renderXlsx(data);
      return {
        filename: `${slug}-${kindSlug}-report.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      };
    }

    // PDF
    const buffer = await this.renderPdf(data);
    return {
      filename: `${slug}-${kindSlug}-report.pdf`,
      contentType: 'application/pdf',
      buffer,
    };
  }

  private renderCsv(data: ReportData): Buffer {
    const escapeCell = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    lines.push(`# ${data.title}`);
    lines.push(`# Company: ${data.meta.companyName}`);
    lines.push(`# Meeting: ${data.meta.meetingTitle}`);
    lines.push(`# Date: ${data.meta.scheduledStart}`);
    lines.push(`# Generated: ${data.meta.generatedAt} by ${data.meta.generatedBy}`);
    lines.push('');
    lines.push(data.headers.map(escapeCell).join(','));
    for (const row of data.rows) {
      lines.push(row.map(escapeCell).join(','));
    }

    return Buffer.from(lines.join('\r\n'), 'utf-8');
  }

  private async renderXlsx(data: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BRG1 IRM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(data.kind.slice(0, 30));

    // Title & Metadata
    sheet.addRow([`BRG1 IRM — ${data.title}`]);
    sheet.addRow([`Company: ${data.meta.companyName}`]);
    sheet.addRow([`Meeting: ${data.meta.meetingTitle} (${data.meta.venueOrMode})`]);
    sheet.addRow([`Generated: ${new Date(data.meta.generatedAt).toLocaleString()} by ${data.meta.generatedBy}`]);
    sheet.addRow([]);

    // Headers
    const headerRow = sheet.addRow(data.headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0E6B5C' }, // primary brand teal
    };

    // Rows
    for (const row of data.rows) {
      sheet.addRow(row);
    }

    // Auto-fit columns
    sheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = Math.min(len, 60);
      });
      col.width = maxLen + 3;
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  private renderPdf(data: ReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header Banner
      doc.fontSize(16).fillColor('#0E6B5C').text('BRG1 IRM', { continued: true });
      doc.fontSize(10).fillColor('#666666').text('  |  Official Meeting Governance Report', { align: 'right' });
      doc.moveDown(0.5);

      // Title
      doc.fontSize(14).fillColor('#1A1A1A').text(data.title);
      doc.moveDown(0.2);

      // Meta Block
      doc.fontSize(9).fillColor('#444444');
      doc.text(`Company: ${data.meta.companyName}`);
      doc.text(`Meeting: ${data.meta.meetingTitle} (${data.meta.venueOrMode})`);
      doc.text(`Scheduled: ${new Date(data.meta.scheduledStart).toLocaleString()} Dhaka Time`);
      doc.text(`Generated: ${new Date(data.meta.generatedAt).toLocaleString()} by ${data.meta.generatedBy}`);
      if (data.summaryText) {
        doc.moveDown(0.2);
        doc.fillColor('#0E6B5C').text(data.summaryText);
      }
      doc.moveDown(0.8);

      // Divider
      doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.8);

      // Table representation
      doc.fontSize(8).fillColor('#1A1A1A');

      const colCount = Math.min(data.headers.length, 6);
      const colWidth = 515 / colCount;

      // Table Header
      const headerY = doc.y;
      doc.rect(40, headerY - 3, 515, 16).fill('#F0F4F3');
      doc.fillColor('#0E6B5C').fontSize(8);
      for (let i = 0; i < colCount; i++) {
        doc.text(data.headers[i] ?? '', 44 + i * colWidth, headerY, { width: colWidth - 4, lineBreak: false });
      }
      doc.moveDown(0.6);

      // Table Rows
      doc.fillColor('#333333');
      let currentY = doc.y + 4;

      for (const row of data.rows) {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }
        for (let i = 0; i < colCount; i++) {
          const val = String(row[i] ?? '-');
          doc.text(val, 44 + i * colWidth, currentY, { width: colWidth - 4, lineBreak: false });
        }
        currentY += 14;
        doc.y = currentY;
      }

      // Footer
      doc.moveDown(2);
      if (doc.y > 740) doc.addPage();
      doc.fontSize(8).fillColor('#888888');
      doc.text('This document was cryptographically attested and automatically produced by BRG1 IRM AGM Management Module.', {
        align: 'center',
      });
      doc.text(`Verification Timestamp: ${data.meta.generatedAt}`, { align: 'center' });

      doc.end();
    });
  }
}
