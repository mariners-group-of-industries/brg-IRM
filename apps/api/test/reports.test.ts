import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp, companyId, login, USERS, type Client } from './helpers.js';

describe('Phase F: Official Reports Generation (PDF, XLSX, CSV)', () => {
  let app: INestApplication;
  let admin: Client;
  let padmaAdmin: Client;
  let cid = '';
  let meetingId = '';

  beforeAll(async () => {
    app = await bootApp();
    admin = await login(app, USERS.marinersAdmin);
    padmaAdmin = await login(app, USERS.padmaAdmin);

    cid = await companyId(admin, 'mariners-ventures');

    // Create a meeting with agenda items for report testing
    const mRes = await admin
      .post(`/companies/${cid}/meetings`, {
        type: 'AGM',
        title: 'Official Reports Test AGM 2026',
        scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
        recordDate: '2026-10-31',
        mode: 'VIRTUAL',
      })
      .expect(201);
    meetingId = mRes.body.id;

    await admin
      .patch(`/companies/${cid}/meetings/${meetingId}`, {
        noticeText: 'Official notice convening the annual general meeting with required statutory text for compliance.',
      })
      .expect(200);

    await admin
      .post(`/companies/${cid}/meetings/${meetingId}/agenda`, {
        number: '1',
        title: 'Adoption of audited accounts for FY 2025-26',
        description: 'Consider and adopt the financial statements for the fiscal year.',
        hasResolution: true,
        resolutionKind: 'ORDINARY',
        resolutionText: 'RESOLVED that audited financial statements be approved.',
        requiresProposal: true,
        requiresSeconding: true,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates voting results reports in PDF, XLSX, and CSV', async () => {
    // PDF
    const pdfRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/voting-results?format=pdf`)
      .expect(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.headers['content-disposition']).toContain('attachment');
    expect(Number(pdfRes.headers['content-length'])).toBeGreaterThan(500);

    // XLSX
    const xlsxRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/voting-results?format=xlsx`)
      .expect(200);
    expect(xlsxRes.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(Number(xlsxRes.headers['content-length'])).toBeGreaterThan(500);

    // CSV
    const csvRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/voting-results?format=csv`)
      .expect(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    const csvText = csvRes.text || csvRes.body.toString('utf-8');
    expect(csvText).toContain('Official Voting Results Tally Sheet');
    expect(csvText).toContain('Adoption of audited accounts for FY 2025-26');
  });

  it('generates attendance reports in all three formats', async () => {
    const pdfRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/attendance?format=pdf`)
      .expect(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');

    const csvRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/attendance?format=csv`)
      .expect(200);
    const csvText = csvRes.text || csvRes.body.toString('utf-8');
    expect(csvText).toContain('Attendance & Quorum Log');
  });

  it('generates motions, questions, and audit reports', async () => {
    // Motions
    const motionsCsv = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/motions?format=csv`)
      .expect(200);
    expect(motionsCsv.text || motionsCsv.body.toString('utf-8')).toContain('Proposals, Seconding & Poll Demands');

    // Questions
    const questionsCsv = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/questions?format=csv`)
      .expect(200);
    expect(questionsCsv.text || questionsCsv.body.toString('utf-8')).toContain('Questions & Moderation Log');

    // Audit
    const auditCsv = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/audit?format=csv`)
      .expect(200);
    expect(auditCsv.text || auditCsv.body.toString('utf-8')).toContain('Meeting Audit Trail');
  });

  it('rejects invalid report kinds or invalid formats', async () => {
    await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/unknown-kind?format=pdf`)
      .expect(400);

    await admin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/voting-results?format=invalid-format`)
      .expect(400);
  });

  it('enforces tenant isolation on report endpoints', async () => {
    await padmaAdmin
      .get(`/companies/${cid}/meetings/${meetingId}/reports/voting-results?format=pdf`)
      .expect(404);
  });
});
