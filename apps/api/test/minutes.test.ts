import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp, clientFor, companyId, login, PASSWORD, USERS, type Client } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Phase F: Meeting minutes management & archive guard', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Client;
  let meetingAdmin: Client;
  let padmaAdmin: Client;
  let cid = '';
  let meetingId = '';

  beforeAll(async () => {
    app = await bootApp();
    prisma = app.get(PrismaService);
    admin = await login(app, USERS.marinersAdmin);
    meetingAdmin = await login(app, USERS.meetingAdmin);
    padmaAdmin = await login(app, USERS.padmaAdmin);

    cid = await companyId(admin, 'mariners-ventures');

    // Create a meeting in DRAFT, move it along to COMPLETED for minutes testing
    const mRes = await admin
      .post(`/companies/${cid}/meetings`, {
        type: 'AGM',
        title: 'Minutes & Reports Test AGM 2026',
        scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
        recordDate: '2026-10-31',
        mode: 'VIRTUAL',
      })
      .expect(201);
    meetingId = mRes.body.id;

    // Add notice text and an agenda item
    await admin
      .patch(`/companies/${cid}/meetings/${meetingId}`, {
        noticeText: 'Official notice convening the annual general meeting with required statutory text for compliance.',
      })
      .expect(200);

    await admin
      .post(`/companies/${cid}/meetings/${meetingId}/agenda`, {
        number: '1',
        title: 'Adoption of audited accounts and auditors report',
        description: 'Consider and adopt the financial statements for the fiscal year.',
        hasResolution: true,
        resolutionKind: 'ORDINARY',
        resolutionText: 'RESOLVED that the audited financial statements be adopted.',
        requiresProposal: true,
        requiresSeconding: true,
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates auto-suggested draft minutes when none exist', async () => {
    const res = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/minutes`)
      .expect(200);

    expect(res.body.minutes).toBeNull();
    expect(res.body.suggestedDraft).toContain('MINUTES OF THE MINUTES & REPORTS TEST AGM 2026');
    expect(res.body.suggestedDraft).toContain('Adoption of audited accounts and auditors report');
  });

  it('enforces permission checks and tenant isolation on minutes', async () => {
    // Padma admin cannot view or edit Mariners minutes
    await padmaAdmin
      .get(`/companies/${cid}/meetings/${meetingId}/minutes`)
      .expect(404);

    await padmaAdmin
      .put(`/companies/${cid}/meetings/${meetingId}/minutes`, {
        content: 'Malicious minutes content',
      })
      .expect(404);
  });

  it('saves draft minutes and allows updates', async () => {
    const draftContent = `# Official Minutes\n\nMeeting was called to order. Quorum verified.`;
    const res = await admin
      .put(`/companies/${cid}/meetings/${meetingId}/minutes`, { content: draftContent })
      .expect(200);

    expect(res.body.status).toBe('DRAFT');
    expect(res.body.content).toBe(draftContent);
    expect(res.body.signedBy).toBeNull();

    // Verify it is saved
    const getRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/minutes`)
      .expect(200);
    expect(getRes.body.minutes.content).toBe(draftContent);
    expect(getRes.body.minutes.status).toBe('DRAFT');
  });

  it('blocks archiving when meeting is COMPLETED and minutes are still DRAFT', async () => {
    // Manually set meeting state to COMPLETED for testing the transition guard
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { state: 'COMPLETED', snapshotTakenAt: new Date() },
    });

    const m = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

    // Transition to ARCHIVED should fail with 409 because minutes are DRAFT
    const archiveRes = await admin
      .post(`/companies/${cid}/meetings/${meetingId}/transition`, {
        to: 'ARCHIVED',
        expectedVersion: m.version,
      })
      .expect(409);

    expect(archiveRes.body.message).toContain('minutes');
  });

  it('finalizes minutes with signature and allows archiving', async () => {
    const finalizeRes = await admin
      .post(`/companies/${cid}/meetings/${meetingId}/minutes/finalize`, {
        signedBy: 'Mahmudul Hasan (Chairman of the Board)',
      })
      .expect(201);

    expect(finalizeRes.body.status).toBe('FINAL');
    expect(finalizeRes.body.signedBy).toBe('Mahmudul Hasan (Chairman of the Board)');
    expect(finalizeRes.body.finalizedAt).toBeTruthy();

    const m = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

    // Now transitioning to ARCHIVED should succeed!
    await admin
      .post(`/companies/${cid}/meetings/${meetingId}/transition`, {
        to: 'ARCHIVED',
        expectedVersion: m.version,
      })
      .expect(200);

    const updatedM = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
    expect(updatedM.state).toBe('ARCHIVED');
  });

  it('publishes minutes and makes them available to participants', async () => {
    // First publish minutes
    await admin
      .post(`/companies/${cid}/meetings/${meetingId}/minutes/publish`, {})
      .expect(201);

    const getRes = await admin
      .get(`/companies/${cid}/meetings/${meetingId}/minutes`)
      .expect(200);
    expect(getRes.body.minutes.status).toBe('PUBLISHED');
    expect(getRes.body.minutes.publishedAt).toBeTruthy();
  });
});
