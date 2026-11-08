import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp, clientFor, companyId, cookieFrom, login, USERS, type Client } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ZoomProvider } from '../src/modules/live/video.service.js';

const NOTICE = 'Notice is hereby given that the 36th Annual General Meeting will be held virtually to transact the business below.';
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().replace('Z', '+00:00');
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString().replace('Z', '+00:00');

// Minimal valid WebM audio header (EBML magic bytes 1A 45 DF A3)
const WEBM_AUDIO = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x1f, 0x42, 0x86, 0x81, 0x01]);

describe('Phase D: live meeting', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Client; // Company Admin
  let group: Client; // Group Admin (second approver)
  let meetingAdmin: Client; // Meeting Admin
  let moderator: Client; // Moderator
  let director: Client; // Board Member
  let padma: Client; // Foreign company admin
  let ventures: string;
  let padmaCompanyId: string;

  let meetingId: string;
  let item1Id: string;
  let item2Id: string;

  let holder1: Client; // Abdul Karim (15,000 votes)
  let holder2: Client; // Rokeya Begum (8,500 votes)

  const base = () => `/companies/${ventures}/meetings`;
  const liveBase = () => `${base()}/${meetingId}/live`;

  async function participant(folioOrBo: string, recipient: string): Promise<Client> {
    await prisma.otpChallenge.deleteMany({ where: { consumedAt: { not: null } } });
    const ch = await request(app.getHttpServer())
      .post('/api/v1/participant/otp/request')
      .send({ kind: 'SHAREHOLDER', companyId: ventures, identifier: folioOrBo })
      .expect(200);

    const msg = await prisma.devOutboxMessage.findFirstOrThrow({
      where: { recipient },
      orderBy: { createdAt: 'desc' },
    });
    const code = /\b(\d{6})\b/.exec(msg.body)![1]!;

    const ok = await request(app.getHttpServer())
      .post('/api/v1/participant/otp/verify')
      .send({ challengeId: ch.body.challengeId, code })
      .expect(200);

    // Leave the per-subject OTP rate-limit window clean for sibling test files.
    await prisma.otpChallenge.delete({ where: { id: ch.body.challengeId } });

    return clientFor(app, cookieFrom(ok), ok.body.csrfToken);
  }

  beforeAll(async () => {
    app = await bootApp();
    prisma = app.get(PrismaService);
    admin = await login(app, USERS.marinersAdmin);
    group = await login(app, USERS.groupAdmin);
    meetingAdmin = await login(app, USERS.meetingAdmin);
    moderator = await login(app, USERS.moderator);
    director = await login(app, USERS.director);
    padma = await login(app, USERS.padmaAdmin);
    ventures = await companyId(admin, 'mariners-ventures');
    padmaCompanyId = await companyId(padma, 'padma-pharma');

    // 1. Create meeting
    const mRes = await admin
      .post(base(), {
        type: 'AGM',
        title: 'Live Annual General Meeting 2026',
        scheduledStart: inDays(10),
        recordDate: '2026-10-31',
      })
      .expect(201);
    meetingId = mRes.body.id;

    // 2. Add notice and two resolution agenda items + one procedural item
    await admin.patch(`${base()}/${meetingId}`, { noticeText: NOTICE }).expect(200);

    await admin
      .post(`${base()}/${meetingId}/agenda`, {
        number: '1',
        title: 'Receive and adopt the audited financial statements',
        hasResolution: true,
        resolutionKind: 'ORDINARY',
        resolutionText: 'RESOLVED that the audited financial statements be adopted.',
      })
      .expect(201);

    const agendaList = (
      await admin
        .post(`${base()}/${meetingId}/agenda`, {
          number: '2',
          title: 'Declare a 15% cash dividend',
          hasResolution: true,
          resolutionKind: 'ORDINARY',
          resolutionText: 'RESOLVED that a 15% cash dividend be declared.',
        })
        .expect(201)
    ).body as { id: string; number: string }[];

    item1Id = agendaList.find((a) => a.number === '1')!.id;
    item2Id = agendaList.find((a) => a.number === '2')!.id;

    // 3. Enable poll demands at 3% of total voting rights (total = 396,100; 3% = 11,883)
    const rules = (await admin.get(`${base()}/${meetingId}`).expect(200)).body.rules;
    await admin
      .put(`${base()}/${meetingId}/rules`, {
        ...rules,
        pollDemand: { enabled: true, threshold: 'VOTING_RIGHTS_PERCENT', thresholdValue: 3 },
      })
      .expect(200);

    // 4. Publish meeting & open registration (takes record-date snapshot)
    const cur1 = (await admin.get(`${base()}/${meetingId}`).expect(200)).body;
    await admin.post(`${base()}/${meetingId}/transition`, { to: 'SCHEDULED', expectedVersion: cur1.version }).expect(200);

    const cur2 = (await admin.get(`${base()}/${meetingId}`).expect(200)).body;
    await admin.post(`${base()}/${meetingId}/transition`, { to: 'REGISTRATION_OPEN', expectedVersion: cur2.version }).expect(200);

    // 5. Connect 2 shareholders and register for meeting
    holder1 = await participant('1201950000000001', '+8801711000001'); // Abdul Karim (15,000 votes)
    holder2 = await participant('1201950000000002', 'rokeya.begum@example.com'); // Rokeya Begum (8,500 votes)

    const reg1Options = (await holder1.get(`/participant/meetings/${meetingId}`).expect(200)).body.eligibility;
    await holder1.post(`/participant/meetings/${meetingId}/register`, { key: reg1Options[0].key }).expect(200);

    const reg2Options = (await holder2.get(`/participant/meetings/${meetingId}`).expect(200)).body.eligibility;
    await holder2.post(`/participant/meetings/${meetingId}/register`, { key: reg2Options[0].key }).expect(200);

    // Stage toggles are blocked before meeting is LIVE
    await meetingAdmin.post(`${liveBase()}/active-item`, { agendaItemId: item1Id }).expect(409);

    // 6. Meeting Admin starts meeting -> LIVE
    const cur3 = (await admin.get(`${base()}/${meetingId}`).expect(200)).body;
    await meetingAdmin.post(`${base()}/${meetingId}/transition`, { to: 'LIVE', expectedVersion: cur3.version }).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  it('displays the meeting admin live console with initial state', async () => {
    const res = await meetingAdmin.get(`${liveBase()}/console`).expect(200);
    expect(res.body.state).toBe('LIVE');
    expect(res.body.activeAgendaItemId).toBeNull();
    expect(res.body.agenda).toHaveLength(2);
    expect(res.body.agenda[0].stages).toEqual({ PROPOSAL: false, SECONDING: false, POLL_DEMAND: false });
    expect(res.body.attendance.registered).toBe(2);
    expect(res.body.attendance.totalVotes).toBe('396100');
    expect(res.body.questions).toEqual({ PENDING: 0, APPROVED: 0, REJECTED: 0, FORWARDED: 0 });
  });

  it('provides simulator video join info with development warning label and signs Zoom SDK JWTs', async () => {
    await meetingAdmin.put(`${liveBase()}/video-room`, { videoRoomId: '98765432101' }).expect(200);

    const adminVideo = await meetingAdmin.get(`${liveBase()}/video`).expect(200);
    expect(adminVideo.body.provider).toBe('simulator');
    expect(adminVideo.body.simulated).toBe(true);
    expect(adminVideo.body.role).toBe('host');
    expect(adminVideo.body.message).toContain('Simulated video (development only)');

    const boardVideo = await director.get(`${liveBase()}/video`).expect(200);
    expect(boardVideo.body.role).toBe('board');

    const partVideo = await holder1.get(`/participant/meetings/${meetingId}/live/video`).expect(200);
    expect(partVideo.body.provider).toBe('simulator');
    expect(partVideo.body.role).toBe('attendee');

    // Verify ZoomProvider HS256 JWT generation and room validation
    const zoom = new ZoomProvider('zoom-test-key', 'zoom-test-secret');
    expect(() => zoom.joinInfo({ roomId: null, role: 'host', displayName: 'Host' })).toThrow();
    const info = zoom.joinInfo({ roomId: '98765432101', role: 'host', displayName: 'Host' });
    expect(info.simulated).toBe(false);
    expect(info.provider).toBe('zoom');
    const [h, b, s] = info.signature!.split('.');
    const expectedSig = createHmac('sha256', 'zoom-test-secret').update(`${h}.${b}`).digest('base64url');
    expect(s).toBe(expectedSig);
    const payload = JSON.parse(Buffer.from(b!, 'base64url').toString('utf8'));
    expect(payload).toMatchObject({ sdkKey: 'zoom-test-key', mn: '98765432101', role: 1 });
  });

  it('sets active agenda item and toggles proposal stage', async () => {
    // Company admin cannot operate live meeting controls
    await admin.post(`${liveBase()}/active-item`, { agendaItemId: item1Id }).expect(403);

    await meetingAdmin.post(`${liveBase()}/active-item`, { agendaItemId: item1Id }).expect(200);
    await meetingAdmin.post(`${liveBase()}/stage`, { agendaItemId: item1Id, stage: 'PROPOSAL', open: true }).expect(200);

    const con = await meetingAdmin.get(`${liveBase()}/console`).expect(200);
    expect(con.body.activeAgendaItemId).toBe(item1Id);
    expect(con.body.agenda[0].stages.PROPOSAL).toBe(true);

    const room = await holder1.get(`/participant/meetings/${meetingId}/live/room`).expect(200);
    expect(room.body.activeAgendaItemId).toBe(item1Id);
    expect(room.body.agenda[0].stages.PROPOSAL).toBe(true);
    expect(room.body.audioMaxSeconds).toBe(150);
  });

  it('accepts the first proposal and rejects subsequent or concurrent proposals with 409 Conflict', async () => {
    // Sequential check on item 1
    const p1 = await holder1
      .post(`/participant/meetings/${meetingId}/live/motion`, { agendaItemId: item1Id, kind: 'PROPOSAL' })
      .expect(200);
    expect(p1.body.kind).toBe('PROPOSAL');
    expect(p1.body.status).toBe('ACCEPTED');
    expect(p1.body.shareholderName).toBe('Abdul Karim');

    // Second proposal on item 1 rejected with 409
    const p2 = await holder2
      .post(`/participant/meetings/${meetingId}/live/motion`, { agendaItemId: item1Id, kind: 'PROPOSAL' })
      .expect(409);
    expect(p2.body.message).toContain('already been accepted');

    // Other shareholder sees accepted proposer name in their room view
    const room2 = await holder2.get(`/participant/meetings/${meetingId}/live/room`).expect(200);
    expect(room2.body.agenda[0].accepted.PROPOSAL?.shareholderName).toBe('Abdul Karim');

    // True concurrent race on item 2: open proposal stage and fire both at the same time
    await meetingAdmin.post(`${liveBase()}/stage`, { agendaItemId: item2Id, stage: 'PROPOSAL', open: true }).expect(200);
    const [raceA, raceB] = await Promise.all([
      holder1.post(`/participant/meetings/${meetingId}/live/motion`, { agendaItemId: item2Id, kind: 'PROPOSAL' }),
      holder2.post(`/participant/meetings/${meetingId}/live/motion`, { agendaItemId: item2Id, kind: 'PROPOSAL' }),
    ]);
    const statuses = [raceA.status, raceB.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('enforces excludeProposer: proposer cannot second their own resolution', async () => {
    await meetingAdmin.post(`${liveBase()}/stage`, { agendaItemId: item1Id, stage: 'SECONDING', open: true }).expect(200);

    // Proposer (holder 1) tries to second -> rejected
    const bad = await holder1
      .post(`/participant/meetings/${meetingId}/live/motion`, { agendaItemId: item1Id, kind: 'SECONDING' })
      .expect(400);
    expect(bad.body.message).toContain('proposer cannot also second');

    // Other shareholder (holder 2) seconds -> accepted
    const s2 = await holder2
      .post(`/participant/meetings/${meetingId}/live/motion`, { agendaItemId: item1Id, kind: 'SECONDING' })
      .expect(200);
    expect(s2.body.status).toBe('ACCEPTED');
    expect(s2.body.shareholderName).toBe('Rokeya Begum');
  });

  it('handles poll demands, prevents duplicate demands, and evaluates configured 3% threshold', async () => {
    await meetingAdmin.post(`${liveBase()}/stage`, { agendaItemId: item1Id, stage: 'POLL_DEMAND', open: true }).expect(200);

    // Holder 2 (8,500 votes = 2.14% of 396,100) demands poll -> below 3% threshold
    const pd1 = await holder2
      .post(`/participant/meetings/${meetingId}/live/poll-demand`, { agendaItemId: item1Id })
      .expect(200);
    expect(pd1.body).toEqual({ count: 1, votes: '8500', thresholdMet: false });

    // Holder 2 cannot demand again
    await holder2
      .post(`/participant/meetings/${meetingId}/live/poll-demand`, { agendaItemId: item1Id })
      .expect(409);

    // Holder 1 (15,000 votes; combined 23,500 = 5.93% >= 3%) demands poll -> threshold met
    const pd2 = await holder1
      .post(`/participant/meetings/${meetingId}/live/poll-demand`, { agendaItemId: item1Id })
      .expect(200);
    expect(pd2.body).toEqual({ count: 2, votes: '23500', thresholdMet: true });

    const con = await meetingAdmin.get(`${liveBase()}/console`).expect(200);
    expect(con.body.agenda[0].pollDemands).toEqual({ count: 2, votes: '23500', thresholdMet: true });
  });

  it('broadcasts announcements and retracts them', async () => {
    const ann = await meetingAdmin
      .post(`${liveBase()}/announcements`, { body: 'Please prepare for voting on Agenda Item 1' })
      .expect(201);
    expect(ann.body.body).toContain('Please prepare for voting');

    const room1 = await holder1.get(`/participant/meetings/${meetingId}/live/room`).expect(200);
    expect(room1.body.announcements.some((a: { id: string }) => a.id === ann.body.id)).toBe(true);

    await meetingAdmin.delete(`${liveBase()}/announcements/${ann.body.id}`).expect(200);

    const room2 = await holder1.get(`/participant/meetings/${meetingId}/live/room`).expect(200);
    expect(room2.body.announcements.some((a: { id: string }) => a.id === ann.body.id)).toBe(false);
  });

  it('handles text (English & Bangla) and audio questions, moderation rules, and board forwarding', async () => {
    const q1 = await holder1
      .post(`/participant/meetings/${meetingId}/live/questions`, {
        text: 'When will the dividend be credited to our bank account?',
        agendaItemId: item2Id,
      })
      .expect(201);
    expect(q1.body.bangla).toBe(false);
    expect(q1.body.status).toBe('PENDING');

    const q2 = await holder2
      .post(`/participant/meetings/${meetingId}/live/questions`, {
        text: 'গত অর্থ বছরে কোম্পানির রপ্তানি আয় কত শতাংশ বৃদ্ধি পেয়েছে?',
        agendaItemId: item1Id,
      })
      .expect(201);
    expect(q2.body.bangla).toBe(true);

    const q3 = await holder1
      .upload(
        `/participant/meetings/${meetingId}/live/questions/audio`,
        'file',
        WEBM_AUDIO,
        'my-question.webm',
        { durationSeconds: '45', agendaItemId: item1Id },
      )
      .expect(201);
    expect(q3.body.kind).toBe('AUDIO');
    expect(q3.body.durationSeconds).toBe(45);

    // Exceeding configured audioQuestionMaxSeconds (150s) or invalid file bytes is rejected
    await holder1
      .upload(
        `/participant/meetings/${meetingId}/live/questions/audio`,
        'file',
        WEBM_AUDIO,
        'too-long.webm',
        { durationSeconds: '160' },
      )
      .expect(400);
    await holder1
      .upload(
        `/participant/meetings/${meetingId}/live/questions/audio`,
        'file',
        Buffer.from('not-audio-bytes'),
        'fake.webm',
        { durationSeconds: '20' },
      )
      .expect(400);

    // Moderator views queue & plays pending audio
    const modQuestions = await moderator.get(`${liveBase()}/moderation/questions`).expect(200);
    expect(modQuestions.body.length).toBeGreaterThanOrEqual(3);

    const audioStream = await moderator.get(`${liveBase()}/questions/${q3.body.id}/audio`).expect(200);
    expect(audioStream.headers['content-type']).toBe('audio/webm');

    // Board member cannot play unforwarded audio
    await director.get(`${liveBase()}/questions/${q3.body.id}/audio`).expect(404);

    // Rejecting without a reason is refused
    await moderator
      .post(`${liveBase()}/moderation/questions/${q1.body.id}/action`, { action: 'REJECT' })
      .expect(400);

    // Reject Question 1 with reason
    await moderator
      .post(`${liveBase()}/moderation/questions/${q1.body.id}/action`, {
        action: 'REJECT',
        note: 'This will be covered in agenda item 2',
      })
      .expect(200);

    // Forward Bangla Question 2 and Audio Question 3 to Board
    await moderator
      .post(`${liveBase()}/moderation/questions/${q2.body.id}/action`, { action: 'FORWARD' })
      .expect(200);
    await moderator
      .post(`${liveBase()}/moderation/questions/${q3.body.id}/action`, { action: 'FORWARD' })
      .expect(200);

    // Board member sees forwarded questions (and accepted motions) and can now stream forwarded audio
    const board = await director.get(`${liveBase()}/board`).expect(200);
    expect(board.body.forwardedQuestions.map((q: { id: string }) => q.id)).toEqual(
      expect.arrayContaining([q2.body.id, q3.body.id]),
    );
    expect(board.body.forwardedQuestions.some((q: { id: string }) => q.id === q1.body.id)).toBe(false);
    expect(board.body.agenda[0].accepted.PROPOSAL?.shareholderName).toBe('Abdul Karim');
    expect(board.body.agenda[0].accepted.SECONDING?.shareholderName).toBe('Rokeya Begum');

    const boardAudio = await director.get(`${liveBase()}/questions/${q3.body.id}/audio`).expect(200);
    expect(boardAudio.headers['content-type']).toBe('audio/webm');
  });

  it('tracks participant attendance and represented vote weight via heartbeat and leave', async () => {
    await holder1.post(`/participant/meetings/${meetingId}/live/attendance/heartbeat`).expect(200);
    await holder2.post(`/participant/meetings/${meetingId}/live/attendance/heartbeat`).expect(200);

    const con1 = await meetingAdmin.get(`${liveBase()}/console`).expect(200);
    expect(con1.body.attendance.participantsPresent).toBe(2);
    expect(con1.body.attendance.votesPresent).toBe('23500');

    await holder1.post(`/participant/meetings/${meetingId}/live/attendance/leave`).expect(200);

    const con2 = await meetingAdmin.get(`${liveBase()}/console`).expect(200);
    expect(con2.body.attendance.participantsPresent).toBe(1);
    expect(con2.body.attendance.votesPresent).toBe('8500');
  });

  it('enforces proxy lodgement deadline and maxPerProxy governance rules', async () => {
    const abdul = (await admin.get(`/companies/${ventures}/shareholders?q=Abdul`).expect(200)).body.items[0];
    const rokeya = (await admin.get(`/companies/${ventures}/shareholders?q=Rokeya`).expect(200)).body.items[0];

    // Meeting starting in 24 hours (< 72h default lodgementDeadlineHours) rejects proxy lodgement
    const soonMeeting = (
      await admin
        .post(base(), {
          type: 'EGM',
          title: 'Short Notice EGM 2026',
          scheduledStart: inHours(24),
          recordDate: '2026-10-31',
        })
        .expect(201)
    ).body;

    const late = await admin
      .post(`/companies/${ventures}/proxies`, {
        grantorShareholderId: abdul.id,
        fullName: 'Late Proxy',
        email: 'late.proxy@example.com',
        scope: 'ATTEND_AND_VOTE',
        meetingId: soonMeeting.id,
        validFrom: '2026-01-01',
        validUntil: '2027-12-31',
      })
      .expect(400);
    expect(late.body.message).toMatch(/lodgement closed 72 hours/i);

    // Meeting with maxPerProxy = 1 allows 1 proxy appointment and rejects a 2nd to the same email
    const cappedMeeting = (
      await admin
        .post(base(), {
          type: 'EGM',
          title: 'Capped Proxy EGM 2026',
          scheduledStart: inDays(10),
          recordDate: '2026-10-31',
        })
        .expect(201)
    ).body;
    const baseRules = (await admin.get(`${base()}/${cappedMeeting.id}`).expect(200)).body.rules;
    await admin
      .put(`${base()}/${cappedMeeting.id}/rules`, {
        ...baseRules,
        proxy: { ...baseRules.proxy, maxPerProxy: 1 },
      })
      .expect(200);

    const first = await admin
      .post(`/companies/${ventures}/proxies`, {
        grantorShareholderId: abdul.id,
        fullName: 'Capped Proxy',
        email: 'capped.proxy@example.com',
        scope: 'ATTEND_AND_VOTE',
        meetingId: cappedMeeting.id,
        validFrom: '2026-01-01',
        validUntil: '2027-12-31',
      })
      .expect(201);
    await group.post(`/companies/${ventures}/proxies/${first.body.id}/decision`, { decision: 'APPROVE' }).expect(200);

    const second = await admin
      .post(`/companies/${ventures}/proxies`, {
        grantorShareholderId: rokeya.id,
        fullName: 'Capped Proxy',
        email: 'capped.proxy@example.com',
        scope: 'ATTEND_AND_VOTE',
        meetingId: cappedMeeting.id,
        validFrom: '2026-01-01',
        validUntil: '2027-12-31',
      })
      .expect(400);
    expect(second.body.message).toMatch(/at most 1 appointment/i);
  });

  it('enforces cross-tenant 404 isolation, unregistered 403, and database immutability triggers', async () => {
    // Cross-tenant staff access returns 404, never 403
    await padma.get(`/companies/${ventures}/meetings/${meetingId}/live/console`).expect(404);
    await padma.get(`/companies/${padmaCompanyId}/meetings/${meetingId}/live/console`).expect(404);

    // Cross-tenant meeting ID from a participant returns 404, never 403
    const padmaMeeting = (
      await padma
        .post(`/companies/${padmaCompanyId}/meetings`, {
          type: 'AGM',
          title: 'Padma Annual General Meeting',
          scheduledStart: inDays(12),
          recordDate: '2026-10-31',
        })
        .expect(201)
    ).body;
    await holder1.get(`/participant/meetings/${padmaMeeting.id}/live/room`).expect(404);
    await holder1.get(`/participant/meetings/${padmaMeeting.id}/live/video`).expect(404);

    // Unregistered shareholder of the SAME company gets 403
    const unregistered = await participant('F-00017', '+8801811000017');
    await unregistered.get(`/participant/meetings/${meetingId}/live/room`).expect(403);

    // Database triggers block mutating poll_demands and moderation_actions, and deleting motions/questions
    const pdRow = await prisma.pollDemand.findFirstOrThrow({ where: { meetingId } });
    await expect(prisma.pollDemand.update({ where: { id: pdRow.id }, data: { votes: 1n } })).rejects.toThrow();
    await expect(prisma.pollDemand.delete({ where: { id: pdRow.id } })).rejects.toThrow();

    const modAction = await prisma.moderationAction.findFirstOrThrow({ where: { companyId: ventures } });
    await expect(prisma.moderationAction.update({ where: { id: modAction.id }, data: { note: 'tampered' } })).rejects.toThrow();
    await expect(prisma.moderationAction.delete({ where: { id: modAction.id } })).rejects.toThrow();

    const motionRow = await prisma.motion.findFirstOrThrow({ where: { meetingId } });
    await expect(prisma.motion.delete({ where: { id: motionRow.id } })).rejects.toThrow();
  });
});
