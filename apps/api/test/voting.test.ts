import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp, clientFor, companyId, cookieFrom, login, PASSWORD, USERS, type Client } from './helpers.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const STAFF_PASS = 'Str0ng!Passphrase2026';

const NOTICE =
  'Notice is hereby given that the Annual General Meeting of Mariners Agro Limited will be held virtually to consider the resolutions below.';
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().replace('Z', '+00:00');
const TODAY = () => new Date().toISOString().slice(0, 10);

describe('Phase E: secure voting, tallies, secrecy, proxy precedence and four-eyes inspection', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let groupAdmin: Client; // Tenant COMPANY_ADMIN
  let padmaAdmin: Client; // Foreign company admin
  let platformAdmin: Client; // PLATFORM_SUPER_ADMIN
  let agAdmin: Client; // Second Company Admin (company-scoped)
  let agMeetingAdmin: Client; // MEETING_ADMIN
  let agDirector: Client; // BOARD_MEMBER
  let agModerator: Client; // MODERATOR

  let agCompanyId = '';
  let agTenantId = '';
  let padmaCompanyId = '';

  let agAdminUserId = '';
  let agMeetingAdminUserId = '';
  let agDirectorUserId = '';
  let agModeratorUserId = '';
  let groupAdminUserId = '';

  // Shareholder & authorization IDs
  let bobHolderId = '';
  let danHolderId = '';
  let evaHolderId = '';
  let zenithHolderId = '';
  let zenithC1Id = '';
  let zenithC2Id = '';

  // Participant clients (seeded in beforeAll / tests)
  let aliceClient: Client; // Mixed classes: ORD 1000*1 + PREF 500*2 = 2000 votes
  let bobClient: Client; // ORD 1500*1 = 1500 votes
  let caraClient: Client; // NV 5000*0 = 0 votes (non-entitled)
  let repClient: Client; // Corporate rep for Zenith: C1 (3000*1) + C2 (2000*2) = 7000 votes
  let danClient: Client; // ORD 500*1 = 500 votes
  let evaClient: Client; // ORD 1000*1 = 1000 votes
  let bobProxyClient: Client; // Approved proxy (ATTEND_AND_VOTE) for Bob on Meeting 1
  let danAttendProxyClient: Client; // Approved proxy (ATTEND only) for Dan on Meeting 1
  let evaRevokedProxyClient: Client; // Approved proxy -> later REVOKED on Meeting 1
  let evaExpiredProxyClient: Client; // Approved proxy -> expired validUntil in DB on Meeting 1
  let wrongMeetingProxyClient: Client; // Approved proxy for Bob on Meeting 2 (wrong meeting for M1)

  // Meetings
  let meeting1Id = '';
  let m1Item1Id = ''; // Ordinary resolution
  let m1Item2Id = ''; // Special resolution
  let m1Item3Id = ''; // Procedural (no resolution)

  let meeting2Id = ''; // Used for wrong-meeting proxy & concurrency/allowChange tests
  let m2Item1Id = '';
  let m2Item2Id = '';

  let meeting3Id = ''; // Used for STAFF_AFTER_CLOSE, showWeights: false, PROXY_REMAINS_VALID
  let m3Item1Id = '';

  const mBase = () => `/companies/${agCompanyId}/meetings`;

  function voteRequest(
    c: Client,
    mId: string,
    idempotencyKey: string | null,
    body: object,
  ) {
    let req = request(app.getHttpServer())
      .post(`/api/v1/participant/meetings/${mId}/live/vote`)
      .set('Cookie', c.cookie)
      .set('X-CSRF-Token', c.csrf);
    if (idempotencyKey !== null) {
      req = req.set('Idempotency-Key', idempotencyKey);
    }
    return req.send(body);
  }

  async function loginParticipant(
    kind: 'SHAREHOLDER' | 'CORPORATE_REPRESENTATIVE' | 'PROXY_REPRESENTATIVE',
    idOrEmail: string,
    recipient: string,
  ): Promise<Client> {
    await prisma.otpChallenge.deleteMany({ where: { consumedAt: { not: null } } });
    const reqBody =
      kind === 'SHAREHOLDER'
        ? { kind, companyId: agCompanyId, identifier: idOrEmail }
        : { kind, companyId: agCompanyId, email: idOrEmail };
    const ch = await request(app.getHttpServer())
      .post('/api/v1/participant/otp/request')
      .send(reqBody)
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
    await prisma.otpChallenge.delete({ where: { id: ch.body.challengeId } });
    return clientFor(app, cookieFrom(ok), ok.body.csrfToken);
  }

  async function registerFor(c: Client, mId: string): Promise<void> {
    const view = (await c.get(`/participant/meetings/${mId}`).expect(200)).body as {
      eligibility: { key: string; eligible: boolean; registered: boolean }[];
    };
    const elig = view.eligibility.find((e) => e.eligible);
    if (!elig) throw new Error(`No eligible registration found for meeting ${mId}`);
    if (!elig.registered) {
      await c.post(`/participant/meetings/${mId}/register`, { key: elig.key }).expect(200);
    }
  }

  beforeAll(async () => {
    app = await bootApp();
    prisma = app.get(PrismaService);

    groupAdmin = await login(app, USERS.groupAdmin);
    padmaAdmin = await login(app, USERS.padmaAdmin);
    platformAdmin = await login(app, USERS.platform);

    const companies = (await platformAdmin.get('/companies?pageSize=100').expect(200)).body.items as {
      id: string;
      slug: string;
      tenantId: string;
    }[];
    const ag = companies.find((c) => c.slug === 'mariners-agro')!;
    agCompanyId = ag.id;
    agTenantId = ag.tenantId;
    padmaCompanyId = companies.find((c) => c.slug === 'padma-pharma')!.id;

    groupAdminUserId = (await groupAdmin.get('/auth/me').expect(200)).body.user.id;

    // Create dedicated company staff on mariners-agro
    const suffix = Date.now().toString().slice(-6);
    const createStaff = async (tag: string, roleKey: string) => {
      const email = `voting.${tag}.${suffix}@marinersagro.example`;
      const created = await groupAdmin
        .post('/users', { email, fullName: `Agro ${tag}`, password: STAFF_PASS })
        .expect(201);
      await groupAdmin
        .post('/assignments', { userId: created.body.id, roleKey, scope: 'COMPANY', companyId: agCompanyId })
        .expect(201);
      const client = await login(app, email, STAFF_PASS);
      return { id: created.body.id as string, client };
    };

    const ca = await createStaff('CompanyAdmin', 'COMPANY_ADMIN');
    agAdminUserId = ca.id;
    agAdmin = ca.client;

    const ma = await createStaff('MeetingAdmin', 'MEETING_ADMIN');
    agMeetingAdminUserId = ma.id;
    agMeetingAdmin = ma.client;

    const bm = await createStaff('BoardMember', 'BOARD_MEMBER');
    agDirectorUserId = bm.id;
    agDirector = bm.client;

    const mod = await createStaff('Moderator', 'MODERATOR');
    agModeratorUserId = mod.id;
    agModerator = mod.client;

    // Create share classes on mariners-agro: ORD (1 vote/share), PREF (2 votes/share), NV (0 votes/share)
    const ordClass = (
      await agAdmin
        .post(`/companies/${agCompanyId}/share-classes`, {
          code: 'ORD',
          name: 'Ordinary shares',
          votesPerShare: 1,
        })
        .expect(201)
    ).body as { id: string };
    const prefClass = (
      await agAdmin
        .post(`/companies/${agCompanyId}/share-classes`, {
          code: 'PREF',
          name: 'Preference voting shares',
          votesPerShare: 2,
        })
        .expect(201)
    ).body as { id: string };
    const nvClass = (
      await agAdmin
        .post(`/companies/${agCompanyId}/share-classes`, {
          code: 'NV',
          name: 'Non-voting shares',
          votesPerShare: 0,
        })
        .expect(201)
    ).body as { id: string };

    // Seed clean mixed-class register on mariners-agro
    const scope = { tenantId: agTenantId, companyId: agCompanyId };
    const asOfDate = new Date('2026-10-31T00:00:00Z');

    const addHolder = async (opts: {
      name: string;
      type: 'INDIVIDUAL' | 'CORPORATE';
      email: string;
      accounts: { bo: string; holdings: { shareClassId: string; quantity: bigint }[] }[];
    }) => {
      const s = await prisma.shareholder.create({
        data: { ...scope, type: opts.type, name: opts.name },
      });
      const identityIds: string[] = [];
      for (const acc of opts.accounts) {
        const ident = await prisma.shareholderIdentity.create({
          data: { ...scope, shareholderId: s.id, kind: 'BO', value: acc.bo },
        });
        identityIds.push(ident.id);
        for (const h of acc.holdings) {
          await prisma.shareholding.create({
            data: {
              ...scope,
              identityId: ident.id,
              shareClassId: h.shareClassId,
              quantity: h.quantity,
              asOfDate,
            },
          });
        }
      }
      await prisma.shareholderContact.create({
        data: { ...scope, shareholderId: s.id, kind: 'EMAIL', value: opts.email, source: 'REGISTER', verifiedAt: new Date() },
      });
      return { shareholderId: s.id, identityIds };
    };

    // 1. Alice: ORD 1000*1 + PREF 500*2 = 2000 votes
    await addHolder({
      name: 'Alice Mixed',
      type: 'INDIVIDUAL',
      email: `alice.${suffix}@example.com`,
      accounts: [
        {
          bo: '1201960000000001',
          holdings: [
            { shareClassId: ordClass.id, quantity: 1000n },
            { shareClassId: prefClass.id, quantity: 500n },
          ],
        },
      ],
    });

    // 2. Bob: ORD 1500*1 = 1500 votes
    bobHolderId = (
      await addHolder({
        name: 'Bob Holder',
        type: 'INDIVIDUAL',
        email: `bob.${suffix}@example.com`,
        accounts: [{ bo: '1201960000000002', holdings: [{ shareClassId: ordClass.id, quantity: 1500n }] }],
      })
    ).shareholderId;

    // 3. Cara: NV 5000*0 = 0 votes (non-voting class only -> non-entitled)
    await addHolder({
      name: 'Cara NonVoting',
      type: 'INDIVIDUAL',
      email: `cara.${suffix}@example.com`,
      accounts: [{ bo: '1201960000000003', holdings: [{ shareClassId: nvClass.id, quantity: 5000n }] }],
    });

    // 4. Zenith Corp: C1 (ORD 3000*1 = 3000) + C2 (PREF 2000*2 = 4000) = 7000 votes across 2 accounts
    const zenith = await addHolder({
      name: 'Zenith Investments Ltd',
      type: 'CORPORATE',
      email: `zenith.${suffix}@example.com`,
      accounts: [
        { bo: '1201960000000004', holdings: [{ shareClassId: ordClass.id, quantity: 3000n }] },
        { bo: '1201960000000005', holdings: [{ shareClassId: prefClass.id, quantity: 2000n }] },
      ],
    });
    zenithHolderId = zenith.shareholderId;
    zenithC1Id = zenith.identityIds[0]!;
    zenithC2Id = zenith.identityIds[1]!;

    // 5. Dan: ORD 500*1 = 500 votes
    danHolderId = (
      await addHolder({
        name: 'Dan Minor',
        type: 'INDIVIDUAL',
        email: `dan.${suffix}@example.com`,
        accounts: [{ bo: '1201960000000006', holdings: [{ shareClassId: ordClass.id, quantity: 500n }] }],
      })
    ).shareholderId;

    // 6. Eva: ORD 1000*1 = 1000 votes
    evaHolderId = (
      await addHolder({
        name: 'Eva Grantor',
        type: 'INDIVIDUAL',
        email: `eva.${suffix}@example.com`,
        accounts: [{ bo: '1201960000000007', holdings: [{ shareClassId: ordClass.id, quantity: 1000n }] }],
      })
    ).shareholderId;

    // Approve corporate rep for Zenith (covering both accounts C1 & C2)
    const corpRep = (
      await agAdmin
        .post(`/companies/${agCompanyId}/corporate-representatives`, {
          shareholderId: zenithHolderId,
          fullName: 'Zenith Rep',
          designation: 'CFO',
          email: `rep.zenith.${suffix}@example.com`,
          identityIds: [zenithC1Id, zenithC2Id],
          validFrom: '2026-01-01',
          validUntil: '2027-12-31',
        })
        .expect(201)
    ).body as { id: string };
    await groupAdmin
      .post(`/companies/${agCompanyId}/corporate-representatives/${corpRep.id}/decision`, { decision: 'APPROVE' })
      .expect(200);

    // Helper to create, populate, publish, open registration for a meeting
    const setupMeeting = async (
      title: string,
      rulesPatch: object,
      assignStaff = true,
    ): Promise<{ id: string; item1Id: string; item2Id: string; item3Id: string }> => {
      const m = (
        await agAdmin
          .post(mBase(), { type: 'AGM', title, scheduledStart: inDays(10), recordDate: '2026-10-31' })
          .expect(201)
      ).body as { id: string; version: number; rules: Record<string, unknown> };
      await agAdmin.patch(`${mBase()}/${m.id}`, { noticeText: NOTICE }).expect(200);
      await agAdmin
        .post(`${mBase()}/${m.id}/agenda`, {
          number: '1',
          title: 'Adopt financial statements',
          hasResolution: true,
          resolutionKind: 'ORDINARY',
          resolutionText: 'RESOLVED that the financial statements be adopted.',
        })
        .expect(201);
      await agAdmin
        .post(`${mBase()}/${m.id}/agenda`, {
          number: '2',
          title: 'Amend Articles of Association',
          hasResolution: true,
          resolutionKind: 'SPECIAL',
          resolutionText: 'RESOLVED that the Articles of Association be amended as proposed.',
        })
        .expect(201);
      const items = (
        await agAdmin
          .post(`${mBase()}/${m.id}/agenda`, {
            number: '3',
            title: 'Chair closing remarks',
            hasResolution: false,
          })
          .expect(201)
      ).body as { id: string; number: string }[];

      if (assignStaff) {
        await agAdmin
          .put(`${mBase()}/${m.id}/staff`, {
            boardMemberIds: [agDirectorUserId],
            moderatorIds: [agModeratorUserId],
          })
          .expect(200);
      }

      const cur = (await agAdmin.get(`${mBase()}/${m.id}`).expect(200)).body as {
        version: number;
        rules: Record<string, unknown>;
      };
      await agAdmin
        .put(`${mBase()}/${m.id}/rules`, { ...cur.rules, ...rulesPatch })
        .expect(200);

      const s1 = (await agAdmin.get(`${mBase()}/${m.id}`).expect(200)).body.version;
      await agAdmin
        .post(`${mBase()}/${m.id}/transition`, { to: 'SCHEDULED', expectedVersion: s1 })
        .expect(200);
      const s2 = (await agAdmin.get(`${mBase()}/${m.id}`).expect(200)).body.version;
      await agAdmin
        .post(`${mBase()}/${m.id}/transition`, { to: 'REGISTRATION_OPEN', expectedVersion: s2 })
        .expect(200);

      return {
        id: m.id,
        item1Id: items.find((i) => i.number === '1')!.id,
        item2Id: items.find((i) => i.number === '2')!.id,
        item3Id: items.find((i) => i.number === '3')!.id,
      };
    };

    // Meeting 1: defaults (SHARE_WEIGHTED, allowVoteChange=false, ALL_AFTER_RELEASE, SHAREHOLDER_REVOKES_PROXY)
    const m1 = await setupMeeting(`Agro AGM M1 ${suffix}`, {});
    meeting1Id = m1.id;
    m1Item1Id = m1.item1Id;
    m1Item2Id = m1.item2Id;
    m1Item3Id = m1.item3Id;

    // Meeting 2: allowVoteChange=true, abstainCountsInBase=true (also target for M2-scoped proxy!)
    const m2 = await setupMeeting(`Agro EGM M2 ${suffix}`, {
      allowVoteChange: true,
      abstainCountsInBase: true,
    });
    meeting2Id = m2.id;
    m2Item1Id = m2.item1Id;
    m2Item2Id = m2.item2Id;

    // Meeting 3: STAFF_AFTER_CLOSE, showWeights=false, PROXY_REMAINS_VALID
    const m3 = await setupMeeting(`Agro EGM M3 ${suffix}`, {
      results: { visibility: 'STAFF_AFTER_CLOSE', showWeights: false },
      proxy: {
        allowed: true,
        lodgementDeadlineHours: 72,
        maxPerProxy: null,
        canSpeak: false,
        shareholderPresencePrecedence: 'PROXY_REMAINS_VALID',
      },
    });
    meeting3Id = m3.id;
    m3Item1Id = m3.item1Id;

    // Create proxies for M1 and M2 before starting meetings
    const makeProxy = async (opts: {
      grantorShareholderId: string;
      meetingId: string;
      fullName: string;
      email: string;
      scope: 'ATTEND' | 'ATTEND_AND_VOTE';
    }) => {
      const p = (
        await agAdmin
          .post(`/companies/${agCompanyId}/proxies`, {
            ...opts,
            validFrom: '2026-01-01',
            validUntil: '2027-12-31',
          })
          .expect(201)
      ).body as { id: string };
      await groupAdmin
        .post(`/companies/${agCompanyId}/proxies/${p.id}/decision`, { decision: 'APPROVE' })
        .expect(200);
      return p.id;
    };

    const bobProxyEmail = `proxy.bob.${suffix}@example.com`;
    await makeProxy({
      grantorShareholderId: bobHolderId,
      meetingId: meeting1Id,
      fullName: 'Bob Vote Proxy',
      email: bobProxyEmail,
      scope: 'ATTEND_AND_VOTE',
    });

    const danProxyEmail = `proxy.dan.attend.${suffix}@example.com`;
    await makeProxy({
      grantorShareholderId: danHolderId,
      meetingId: meeting1Id,
      fullName: 'Dan Attend Proxy',
      email: danProxyEmail,
      scope: 'ATTEND',
    });

    const evaRevProxyEmail = `proxy.eva.revoked.${suffix}@example.com`;
    const evaRevProxyId = await makeProxy({
      grantorShareholderId: evaHolderId,
      meetingId: meeting1Id,
      fullName: 'Eva Revoked Proxy',
      email: evaRevProxyEmail,
      scope: 'ATTEND_AND_VOTE',
    });

    const evaExpProxyEmail = `proxy.eva.expired.${suffix}@example.com`;
    const evaExpProxyId = await makeProxy({
      grantorShareholderId: evaHolderId,
      meetingId: meeting1Id,
      fullName: 'Eva Expired Proxy',
      email: evaExpProxyEmail,
      scope: 'ATTEND_AND_VOTE',
    });

    const wrongMeetingProxyEmail = `proxy.wrong.meeting.${suffix}@example.com`;
    await makeProxy({
      grantorShareholderId: bobHolderId,
      meetingId: meeting2Id,
      fullName: 'Wrong Meeting Proxy',
      email: wrongMeetingProxyEmail,
      scope: 'ATTEND_AND_VOTE',
    });

    // Also approve Bob's proxy for Meeting 3 (PROXY_REMAINS_VALID check)
    await makeProxy({
      grantorShareholderId: bobHolderId,
      meetingId: meeting3Id,
      fullName: 'Bob Vote Proxy M3',
      email: bobProxyEmail,
      scope: 'ATTEND_AND_VOTE',
    });

    // Sign in participants via OTP
    aliceClient = await loginParticipant('SHAREHOLDER', '1201960000000001', `alice.${suffix}@example.com`);
    bobClient = await loginParticipant('SHAREHOLDER', '1201960000000002', `bob.${suffix}@example.com`);
    caraClient = await loginParticipant('SHAREHOLDER', '1201960000000003', `cara.${suffix}@example.com`);
    repClient = await loginParticipant(
      'CORPORATE_REPRESENTATIVE',
      `rep.zenith.${suffix}@example.com`,
      `rep.zenith.${suffix}@example.com`,
    );
    danClient = await loginParticipant('SHAREHOLDER', '1201960000000006', `dan.${suffix}@example.com`);
    evaClient = await loginParticipant('SHAREHOLDER', '1201960000000007', `eva.${suffix}@example.com`);

    bobProxyClient = await loginParticipant('PROXY_REPRESENTATIVE', bobProxyEmail, bobProxyEmail);
    danAttendProxyClient = await loginParticipant('PROXY_REPRESENTATIVE', danProxyEmail, danProxyEmail);
    evaRevokedProxyClient = await loginParticipant('PROXY_REPRESENTATIVE', evaRevProxyEmail, evaRevProxyEmail);
    evaExpiredProxyClient = await loginParticipant('PROXY_REPRESENTATIVE', evaExpProxyEmail, evaExpProxyEmail);
    wrongMeetingProxyClient = await loginParticipant(
      'PROXY_REPRESENTATIVE',
      wrongMeetingProxyEmail,
      wrongMeetingProxyEmail,
    );

    // Register participants for Meeting 1 BEFORE revoking/expiring test proxies so they have real MeetingParticipant rows
    await registerFor(aliceClient, meeting1Id);
    await registerFor(bobClient, meeting1Id);
    await registerFor(repClient, meeting1Id);
    await registerFor(danClient, meeting1Id);
    await registerFor(evaClient, meeting1Id);
    await registerFor(bobProxyClient, meeting1Id);
    await registerFor(danAttendProxyClient, meeting1Id);
    await registerFor(evaRevokedProxyClient, meeting1Id);
    await registerFor(evaExpiredProxyClient, meeting1Id);

    // Now revoke Eva's revoked proxy via API, and expire Eva's expired proxy validUntil directly in DB
    await groupAdmin
      .post(`/companies/${agCompanyId}/proxies/${evaRevProxyId}/decision`, {
        decision: 'REVOKE',
        note: 'Withdrawn by grantor',
      })
      .expect(200);
    await prisma.proxyAuthorization.update({
      where: { id: evaExpProxyId },
      data: { validFrom: new Date('2020-01-01T00:00:00Z'), validUntil: new Date('2020-01-02T00:00:00Z') },
    });

    // Register participants for Meeting 2 & Meeting 3
    for (const c of [aliceClient, bobClient, repClient, danClient, evaClient]) {
      await registerFor(c, meeting2Id);
      await registerFor(c, meeting3Id);
    }
    await registerFor(wrongMeetingProxyClient, meeting2Id);
    await registerFor(bobProxyClient, meeting3Id);

    // Transition M1, M2, M3 -> LIVE via Meeting Admin
    for (const mid of [meeting1Id, meeting2Id, meeting3Id]) {
      const v = (await agMeetingAdmin.get(`${mBase()}/${mid}`).expect(200)).body.version;
      await agMeetingAdmin
        .post(`${mBase()}/${mid}/transition`, { to: 'LIVE', expectedVersion: v })
        .expect(200);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Session Lifecycle, Permissions, Isolation & Meeting Transitions ───

  it('enforces voting permissions, rejects non-resolutions, blocks end-meeting with open session, and blocks platform/foreign access', async () => {
    // Company Admin, Board Member, Moderator, Platform Admin, Foreign Admin cannot open voting sessions
    await agAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id }).expect(403);
    await agDirector.post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id }).expect(403);
    await agModerator.post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id }).expect(403);
    await platformAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id }).expect(403);
    await padmaAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id }).expect(404);

    // Participants cannot call staff voting or grant endpoints
    await aliceClient.get(`${mBase()}/${meeting1Id}/voting/sessions`).expect(403);
    await aliceClient.post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id }).expect(403);

    // Procedural item (no resolution) rejected with 400
    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item3Id })
      .expect(400);

    // Meeting Admin opens session 1 on Item 1
    const s1 = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id })
        .expect(201)
    ).body as { id: string; sessionNumber: number; method: string };
    expect(s1.sessionNumber).toBe(1);
    expect(s1.method).toBe('SHARE_WEIGHTED');

    // Opening a second concurrent session on the same item fails (409)
    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id })
      .expect(409);

    // Ending meeting is blocked while any voting session is open
    const cur = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}`).expect(200)).body;
    const ctrl = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/control`).expect(200)).body as {
      transitions: { to: string; allowed: boolean; checks: { key: string; ok: boolean }[] }[];
    };
    const endCheck = ctrl.transitions.find((t) => t.to === 'COMPLETED')!;
    expect(endCheck.allowed).toBe(false);
    expect(endCheck.checks.find((c) => c.key === 'votingClosed')?.ok).toBe(false);
    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/transition`, { to: 'COMPLETED', expectedVersion: cur.version })
      .expect(409);

    // Pausing meeting is allowed and PAUSED still permits closing the session
    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/transition`, { to: 'PAUSED', expectedVersion: cur.version })
      .expect(200);
    // Staff without voting.control cannot close
    await agAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s1.id}/close`, {}).expect(403);
    // Meeting Admin closes cleanly while paused
    const closed = (
      await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s1.id}/close`, {}).expect(200)
    ).body as { closedAt: string };
    expect(closed.closedAt).not.toBeNull();

    // Closing an already closed session fails (409)
    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s1.id}/close`, {}).expect(409);

    // While paused, opening a NEW voting session is blocked (409)
    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, {
        agendaItemId: m1Item1Id,
        reopenReason: 'Cannot open while paused',
      })
      .expect(409);

    // Resume M1 back to LIVE and verify opening session #2 requires reopenReason >= 5 chars (400)
    const pausedVer = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}`).expect(200)).body.version;
    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/transition`, { to: 'LIVE', expectedVersion: pausedVer })
      .expect(200);

    await agMeetingAdmin
      .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item1Id })
      .expect(400);

    const s2 = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, {
          agendaItemId: m1Item1Id,
          reopenReason: 'Recount requested after resolution clarification',
        })
        .expect(201)
    ).body as { id: string; sessionNumber: number; reopenReason: string };
    expect(s2.sessionNumber).toBe(2);
    expect(s2.reopenReason).toContain('Recount requested');
    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s2.id}/close`, {}).expect(200);
  });

  // ── 2. Core Casting, Mixed Classes, Non-Entitled, Closed/Expired, Secrecy ─

  it('casts ballots with mixed-class weights, blocks non-entitled/wrong-company/closed/expired/dup/vote-change, and hides pre-release results', async () => {
    const s = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, { agendaItemId: m1Item2Id })
        .expect(201)
    ).body as { id: string };

    // Missing Idempotency-Key header -> 400
    await voteRequest(aliceClient, meeting1Id, null, { votingSessionId: s.id, choice: 'FOR' }).expect(400);

    // Cara holds NV non-voting shares only -> cannot register or vote
    const caraView = (await caraClient.get(`/participant/meetings/${meeting1Id}`).expect(200)).body as {
      eligibility: { eligible: boolean; reason: string }[];
    };
    expect(caraView.eligibility[0]!.eligible).toBe(false);
    await voteRequest(caraClient, meeting1Id, 'cara-1', { votingSessionId: s.id, choice: 'FOR' }).expect(403);

    // Staff/wrong-company session blocked
    await voteRequest(aliceClient, meeting1Id, 'bad-session', {
      votingSessionId: '00000000-0000-4000-8000-000000000000',
      choice: 'FOR',
    }).expect(404);

    // Wrong-company entitlement supplied to split vote -> rejected (403/400)
    const padmaEnt = await prisma.votingEntitlement.findFirst({ where: { companyId: padmaCompanyId } });
    if (padmaEnt) {
      await voteRequest(aliceClient, meeting1Id, 'foreign-ent-1', {
        votingSessionId: s.id,
        entitlementId: padmaEnt.id,
        choice: 'FOR',
      }).expect(403);
    }

    // Alice votes FOR across mixed share classes (ORD 1000*1 + PREF 500*2 = 2000 votes)
    const aliceVote = (
      await voteRequest(aliceClient, meeting1Id, 'alice-m1-s1', {
        votingSessionId: s.id,
        choice: 'FOR',
      }).expect(200)
    ).body as { replayed: boolean; ballots: { choice: string; weight: string }[] };
    expect(aliceVote.replayed).toBe(false);
    const aliceTotal = aliceVote.ballots.reduce((sum, b) => sum + BigInt(b.weight), 0n);
    expect(aliceTotal).toBe(2000n);
    expect(aliceVote.ballots.every((b) => b.choice === 'FOR')).toBe(true);

    // Idempotent replay with same key + same payload returns saved result with replayed: true
    const replay = (
      await voteRequest(aliceClient, meeting1Id, 'alice-m1-s1', {
        votingSessionId: s.id,
        choice: 'FOR',
      }).expect(200)
    ).body as { replayed: boolean; ballots: { id: string }[] };
    expect(replay.replayed).toBe(true);
    expect(replay.ballots).toHaveLength(aliceVote.ballots.length);

    // Reusing same Idempotency-Key with different payload -> 409 Conflict
    await voteRequest(aliceClient, meeting1Id, 'alice-m1-s1', {
      votingSessionId: s.id,
      choice: 'AGAINST',
    }).expect(409);

    // Duplicate vote with new key when allowVoteChange=false -> 409 + VOTE_REJECTED audit event
    await voteRequest(aliceClient, meeting1Id, 'alice-m1-s1-dup', {
      votingSessionId: s.id,
      choice: 'AGAINST',
    }).expect(409);

    // Dan votes FOR (500)
    await voteRequest(danClient, meeting1Id, 'dan-m1-1', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(200);

    // Eva votes AGAINST (1000)
    await voteRequest(evaClient, meeting1Id, 'eva-m1-1', {
      votingSessionId: s.id,
      choice: 'AGAINST',
    }).expect(200);

    // Corporate representative Zenith splits across 2 accounts: C1 (3000 ORD) -> FOR, C2 (2000 PREF -> 4000 votes) -> AGAINST!
    const roomRep = (await repClient.get(`/participant/meetings/${meeting1Id}/live/room`).expect(200)).body as {
      registrations: {
        id: string;
        kind: string;
        entitlements: { entitlementId: string; votes: string }[];
      }[];
    };
    const zenithEnts = roomRep.registrations[0]!.entitlements;
    const c1Ent = zenithEnts.find((e) => e.votes === '3000')!;
    const c2Ent = zenithEnts.find((e) => e.votes === '4000')!;
    const splitVote = (
      await voteRequest(repClient, meeting1Id, 'zenith-split-1', {
        votingSessionId: s.id,
        votes: [
          { entitlementId: c1Ent.entitlementId, choice: 'FOR' },
          { entitlementId: c2Ent.entitlementId, choice: 'AGAINST' },
        ],
      }).expect(200)
    ).body as { ballots: { choice: string; weight: string }[] };
    expect(splitVote.ballots).toHaveLength(2);

    // Close session
    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/close`, {}).expect(200);

    // Voting on closed session rejected (409)
    await voteRequest(bobClient, meeting1Id, 'bob-too-late', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(409);

    // Verify Special Resolution math: FOR = 2000 + 500 + 3000 = 5500, AGAINST = 1000 + 4000 = 5000, ABSTAIN = 0.
    // Total base = 10500. 5500/10500 < 3/4 -> passed = false!
    // Check ALL_AFTER_RELEASE secrecy: before release, CA, MA, BM, and Participants do NOT see result!
    await agAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/results`).expect(403);
    await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/results`).expect(403);
    await agDirector.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/results`).expect(403);

    const boardPre = (await agDirector.get(`${mBase()}/${meeting1Id}/live/board`).expect(200)).body as {
      votingSessions: { id: string; result: unknown }[];
    };
    expect(boardPre.votingSessions.find((vs) => vs.id === s.id)!.result).toBeNull();

    const partPre = (await aliceClient.get(`/participant/meetings/${meeting1Id}/live/results`).expect(200)).body as {
      id: string;
      result: unknown;
    }[];
    expect(partPre.find((vs) => vs.id === s.id)!.result).toBeNull();

    // Release requires VOTING_RESULTS_RELEASE (Company Admin lacks it -> 403)
    await agAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/release`, {}).expect(403);
    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/release`, {}).expect(200);

    // Now everyone sees the exact sealed result
    const rel = (await agAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/results`).expect(200)).body as {
      forVotes: string;
      againstVotes: string;
      abstainVotes: string;
      baseVotes: string;
      passed: boolean;
      weightsHidden: boolean;
    };
    expect(rel.forVotes).toBe('5500');
    expect(rel.againstVotes).toBe('5000');
    expect(rel.abstainVotes).toBe('0');
    expect(rel.baseVotes).toBe('10500');
    expect(rel.passed).toBe(false);
    expect(rel.weightsHidden).toBe(false);

    // Board & participant also see released results now
    const boardPost = (await agDirector.get(`${mBase()}/${meeting1Id}/live/board`).expect(200)).body as {
      votingSessions: { id: string; result: { forVotes: string } | null }[];
    };
    expect(boardPost.votingSessions.find((vs) => vs.id === s.id)!.result?.forVotes).toBe('5500');

    // Audit trail & cryptographic verification pass post-release (and rejected vote event is present!)
    const audit = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/audit`).expect(200)).body as {
      eventType: string;
    }[];
    expect(audit.map((a) => a.eventType)).toContain('VOTE_REJECTED');
    expect(audit.map((a) => a.eventType)).toContain('RESULTS_RELEASED');

    const verify = (
      await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/verify`).expect(200)
    ).body as { auditChainValid: boolean; tallyValid: boolean; inputHashValid: boolean; error: string | null };
    expect(verify).toMatchObject({ auditChainValid: true, tallyValid: true, inputHashValid: true, error: null });

    // Expired session (closesAt in past):
    const expSession = await prisma.votingSession.create({
      data: {
        tenantId: agTenantId,
        companyId: agCompanyId,
        meetingId: meeting1Id,
        agendaItemId: m1Item2Id,
        sessionNumber: 99,
        method: 'SHARE_WEIGHTED',
        choices: ['FOR', 'AGAINST', 'ABSTAIN'],
        abstainCountsInBase: false,
        allowChange: false,
        majorityNumerator: 3,
        majorityDenominator: 4,
        openedById: agMeetingAdminUserId,
        closesAt: new Date(Date.now() - 5000),
      },
    });
    await voteRequest(bobClient, meeting1Id, 'bob-expired', {
      votingSessionId: expSession.id,
      choice: 'FOR',
    }).expect(409);
    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${expSession.id}/close`, {}).expect(200);
  });

  // ── 3. Proxy & Precedence Rules ──────────────────────────────────────────

  it('enforces proxy scope, revocation, expiry, wrong meeting, and grantor presence precedence', async () => {
    const s = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, {
          agendaItemId: m1Item1Id,
          reopenReason: 'Proxy validation round',
        })
        .expect(201)
    ).body as { id: string };

    // Attend-only proxy cannot vote
    await voteRequest(danAttendProxyClient, meeting1Id, 'dan-attend-only', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(403);

    // Revoked proxy rejected (session terminated -> 401/403)
    const revRes = await voteRequest(evaRevokedProxyClient, meeting1Id, 'eva-rev-1', {
      votingSessionId: s.id,
      choice: 'FOR',
    });
    expect([401, 403]).toContain(revRes.status);

    // Expired proxy (validUntil in past while keeping cookie) rejected with 403
    await voteRequest(evaExpiredProxyClient, meeting1Id, 'eva-exp-1', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(403);

    // Wrong-meeting proxy (registered for M2, tries to vote on M1) rejected with 403
    await voteRequest(wrongMeetingProxyClient, meeting1Id, 'wrong-m-1', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(403);

    // Bob's approved proxy votes FOR while Bob is NOT present in live room
    await voteRequest(bobProxyClient, meeting1Id, 'bob-proxy-m1', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(200);

    // Bob (grantor) now enters the live room (creates active attendance) AND casts AGAINST directly!
    // Even though allowVoteChange=false on M1, shareholder direct vote supersedes proxy ballot under SHAREHOLDER_REVOKES_PROXY!
    await bobClient.get(`/participant/meetings/${meeting1Id}/live/room`).expect(200);

    // First verify proxy cannot re-vote / is suspended while grantor is present
    const bobProxyRoom = (await bobProxyClient.get(`/participant/meetings/${meeting1Id}/live/room`).expect(200)).body as {
      registrations: { proxySuspendedByShareholder: boolean }[];
    };
    expect(bobProxyRoom.registrations[0]!.proxySuspendedByShareholder).toBe(true);

    // Grantor direct ballot supersedes prior proxy FOR with AGAINST
    await voteRequest(bobClient, meeting1Id, 'bob-direct-m1', {
      votingSessionId: s.id,
      choice: 'AGAINST',
    }).expect(200);

    // Clean up Bob's open attendance so other tests aren't affected
    await bobClient.post(`/participant/meetings/${meeting1Id}/live/attendance/leave`, {}).expect(200);

    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/close`, {}).expect(200);
    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/release`, {}).expect(200);

    const res = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/results`).expect(200)).body as {
      forVotes: string;
      againstVotes: string;
      ballotCount: number;
    };
    expect(res.forVotes).toBe('0');
    expect(res.againstVotes).toBe('1500');
    expect(res.ballotCount).toBe(1);

    const audit = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${s.id}/audit`).expect(200)).body as {
      eventType: string;
    }[];
    expect(audit.map((a) => a.eventType)).toContain('BALLOT_SUPERSEDED');

    // Audit log recorded proxy.precedence_superseded without storing ballot choices
    const supersededLog = await prisma.auditLog.findFirst({
      where: { companyId: agCompanyId, action: 'proxy.precedence_superseded' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(supersededLog).not.toBeNull();
  });

  // ── 4. 50 Parallel Concurrent Submissions (Distinct Keys & Same Key) ─────

  it('handles 50 parallel submissions on the same entitlement with distinct keys and with shared idempotency key', async () => {
    // Use Meeting 2, Item 1 (allowVoteChange=true, abstainCountsInBase=true) — first test concurrency under SAME key & DISTINCT keys!
    // Wait: test ONE_MEMBER_ONE_VOTE + distinct keys in an allowChange=false session on M1, and shared key concurrency too!
    const openCon = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting1Id}/voting/sessions/open`, {
          agendaItemId: m1Item1Id,
          reopenReason: '50-way concurrency stress test',
        })
        .expect(201)
    ).body as { id: string };

    // (a) 50 parallel requests from Alice with 50 DISTINCT Idempotency-Keys on the SAME entitlement when allowVoteChange=false:
    // Exactly 1 MUST succeed (200) and 49 MUST fail with 409! Zero 500s!
    const aliceRoom = (await aliceClient.get(`/participant/meetings/${meeting1Id}/live/room`).expect(200)).body as {
      registrations: { entitlements: { entitlementId: string }[] }[];
    };
    await aliceClient.post(`/participant/meetings/${meeting1Id}/live/attendance/leave`, {}).expect(200);
    const aliceSingleEntId = aliceRoom.registrations[0]!.entitlements[0]!.entitlementId;
    const distinctResponses = await Promise.all(
      Array.from({ length: 50 }, (_, idx) =>
        voteRequest(aliceClient, meeting1Id, `race-distinct-${idx}-${Date.now()}`, {
          votingSessionId: openCon.id,
          entitlementId: aliceSingleEntId,
          choice: 'FOR',
        }),
      ),
    );
    const ok200 = distinctResponses.filter((r) => r.status === 200);
    const err409 = distinctResponses.filter((r) => r.status === 409);
    expect(distinctResponses.some((r) => r.status >= 500)).toBe(false);
    expect(ok200).toHaveLength(1);
    expect(err409).toHaveLength(49);

    const aliceBallotCount = await prisma.ballot.count({
      where: { votingSessionId: openCon.id, entitlementId: aliceSingleEntId, supersededAt: null },
    });
    expect(aliceBallotCount).toBe(1);

    // (b) 50 parallel requests from Dan with the IDENTICAL Idempotency-Key & payload:
    // Every request must return 200 (first creates ballot, others replay cleanly or succeed under lock) with ONLY 1 ballot row!
    const sharedKey = `race-same-${Date.now()}`;
    const sameResponses = await Promise.all(
      Array.from({ length: 50 }, () =>
        voteRequest(danClient, meeting1Id, sharedKey, {
          votingSessionId: openCon.id,
          choice: 'FOR',
        }),
      ),
    );
    expect(sameResponses.every((r) => r.status === 200)).toBe(true);
    expect(sameResponses.filter((r) => r.body.replayed === true)).toHaveLength(49);
    const danBallots = await prisma.ballot.findMany({
      where: { votingSessionId: openCon.id, idempotencyKey: sharedKey },
    });
    expect(danBallots).toHaveLength(1);

    await agMeetingAdmin.post(`${mBase()}/${meeting1Id}/voting/sessions/${openCon.id}/close`, {}).expect(200);
    const verify = (
      await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${openCon.id}/verify`).expect(200)
    ).body as { auditChainValid: boolean; tallyValid: boolean; inputHashValid: boolean };
    expect(verify).toMatchObject({ auditChainValid: true, tallyValid: true, inputHashValid: true });
  });

  // ── 5. Vote Change Allowed, abstainCountsInBase, Exact Tie & 3/4 Edge, OMOV ─

  it('supports allowVoteChange, abstainCountsInBase=true, exact tie fail, exact 3/4 special pass, and ONE_MEMBER_ONE_VOTE', async () => {
    // Meeting 2: allowVoteChange=true, abstainCountsInBase=true
    // Open Item 1 (ORDINARY) in SHARE_WEIGHTED
    const s1 = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting2Id}/voting/sessions/open`, { agendaItemId: m2Item1Id })
        .expect(201)
    ).body as { id: string };

    // Bob votes FOR (1500), then changes his vote to AGAINST (1500) -> ALLOWED because allowVoteChange=true
    await voteRequest(bobClient, meeting2Id, 'm2-bob-1', { votingSessionId: s1.id, choice: 'FOR' }).expect(200);
    await voteRequest(bobClient, meeting2Id, 'm2-bob-2', { votingSessionId: s1.id, choice: 'AGAINST' }).expect(200);

    // Dan votes ABSTAIN (500) -> counts in base because abstainCountsInBase=true on M2!
    await voteRequest(danClient, meeting2Id, 'm2-dan-1', { votingSessionId: s1.id, choice: 'ABSTAIN' }).expect(200);

    // Alice votes FOR (2000). Totals: FOR=2000, AGAINST=1500, ABSTAIN=500 -> base=4000. 2000/4000 = exact 1/2 tie -> ORDINARY FAILS (> 1/2 required)!
    await voteRequest(aliceClient, meeting2Id, 'm2-alice-1', { votingSessionId: s1.id, choice: 'FOR' }).expect(200);

    await agMeetingAdmin.post(`${mBase()}/${meeting2Id}/voting/sessions/${s1.id}/close`, {}).expect(200);
    await agMeetingAdmin.post(`${mBase()}/${meeting2Id}/voting/sessions/${s1.id}/release`, {}).expect(200);

    const m2Res = (await agAdmin.get(`${mBase()}/${meeting2Id}/voting/sessions/${s1.id}/results`).expect(200)).body as {
      forVotes: string;
      againstVotes: string;
      abstainVotes: string;
      baseVotes: string;
      passed: boolean;
    };
    expect(m2Res.forVotes).toBe('2000');
    expect(m2Res.againstVotes).toBe('1500');
    expect(m2Res.abstainVotes).toBe('500');
    expect(m2Res.baseVotes).toBe('4000');
    expect(m2Res.passed).toBe(false); // exact 50% does not satisfy strictly > 1/2!

    // Check prior ballot superseded in DB + verifySessionIntegrity passes
    const totalBobBallots = await prisma.ballot.count({
      where: { votingSessionId: s1.id, shareholderId: bobHolderId },
    });
    expect(totalBobBallots).toBe(2);
    const v1 = (
      await agAdmin.get(`${mBase()}/${meeting2Id}/voting/sessions/${s1.id}/verify`).expect(200)
    ).body as { auditChainValid: boolean; tallyValid: boolean; inputHashValid: boolean };
    expect(v1).toMatchObject({ auditChainValid: true, tallyValid: true, inputHashValid: true });

    // Open Item 2 (SPECIAL) on M2 using ONE_MEMBER_ONE_VOTE override!
    // Check exact 3/4 threshold: 3 members FOR, 1 member AGAINST, 0 ABSTAIN -> 3/4 = 0.75 -> SPECIAL PASSES (>= 3/4)!
    // Also verify Zenith's corporate rep split across C1/C2 is BLOCKED under ONE_MEMBER_ONE_VOTE and gets weight = 1 once!
    const omov = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting2Id}/voting/sessions/open`, {
          agendaItemId: m2Item2Id,
          method: 'ONE_MEMBER_ONE_VOTE',
        })
        .expect(201)
    ).body as { id: string; method: string };
    expect(omov.method).toBe('ONE_MEMBER_ONE_VOTE');

    const repRoom = (await repClient.get(`/participant/meetings/${meeting2Id}/live/room`).expect(200)).body as {
      registrations: { entitlements: { entitlementId: string }[] }[];
    };
    const [e1, e2] = repRoom.registrations[0]!.entitlements;
    await voteRequest(repClient, meeting2Id, 'omov-split', {
      votingSessionId: omov.id,
      votes: [
        { entitlementId: e1!.entitlementId, choice: 'FOR' },
        { entitlementId: e2!.entitlementId, choice: 'AGAINST' },
      ],
    }).expect(400);

    // 3 FOR (Alice, Zenith single 1-member vote, Dan), 1 AGAINST (Bob) -> 3/4 exact!
    const aliceOmov = (
      await voteRequest(aliceClient, meeting2Id, 'omov-alice', { votingSessionId: omov.id, choice: 'FOR' }).expect(200)
    ).body as { ballots: { weight: string }[] };
    expect(aliceOmov.ballots).toHaveLength(1);
    expect(aliceOmov.ballots[0]!.weight).toBe('1');

    const repOmov = (
      await voteRequest(repClient, meeting2Id, 'omov-zenith', { votingSessionId: omov.id, choice: 'FOR' }).expect(200)
    ).body as { ballots: { weight: string }[] };
    expect(repOmov.ballots).toHaveLength(1);
    expect(repOmov.ballots[0]!.weight).toBe('1');

    // Trying to submit second Zenith account C2 under ONE_MEMBER_ONE_VOTE -> blocked by allowChange or unique index!
    // (Wait: on M2 allowVoteChange=true, so voting again on C2 replaces C1 instead of creating 2 effective ballots for Zenith! Verify count stays 1!)
    await voteRequest(repClient, meeting2Id, 'omov-zenith-c2', {
      votingSessionId: omov.id,
      entitlementId: e2!.entitlementId,
      choice: 'FOR',
    }).expect(200);
    expect(
      await prisma.ballot.count({
        where: { votingSessionId: omov.id, shareholderId: zenithHolderId, supersededAt: null },
      }),
    ).toBe(1);

    await voteRequest(danClient, meeting2Id, 'omov-dan', { votingSessionId: omov.id, choice: 'FOR' }).expect(200);
    await voteRequest(bobClient, meeting2Id, 'omov-bob', { votingSessionId: omov.id, choice: 'AGAINST' }).expect(200);

    await agMeetingAdmin.post(`${mBase()}/${meeting2Id}/voting/sessions/${omov.id}/close`, {}).expect(200);
    await agMeetingAdmin.post(`${mBase()}/${meeting2Id}/voting/sessions/${omov.id}/release`, {}).expect(200);

    const omovRes = (await agAdmin.get(`${mBase()}/${meeting2Id}/voting/sessions/${omov.id}/results`).expect(200)).body as {
      forVotes: string;
      againstVotes: string;
      eligibleVotes: string;
      baseVotes: string;
      passed: boolean;
    };
    expect(omovRes.forVotes).toBe('3');
    expect(omovRes.againstVotes).toBe('1');
    expect(omovRes.baseVotes).toBe('4');
    expect(omovRes.eligibleVotes).toBe('5'); // 5 shareholders hold voting shares on mariners-agro
    expect(omovRes.passed).toBe(true); // 3/4 >= 3/4 passes!
  });

  // ── 6. STAFF_AFTER_CLOSE vs Board/Participant & showWeights=false & PROXY_REMAINS_VALID

  it('respects STAFF_AFTER_CLOSE (hidden from board until release), showWeights=false, and PROXY_REMAINS_VALID', async () => {
    const s = (
      await agMeetingAdmin
        .post(`${mBase()}/${meeting3Id}/voting/sessions/open`, { agendaItemId: m3Item1Id })
        .expect(201)
    ).body as { id: string };

    // Bob enters the live room (present), yet PROXY_REMAINS_VALID allows Bob's proxy to cast ballot when Bob hasn't voted directly!
    await bobClient.get(`/participant/meetings/${meeting3Id}/live/room`).expect(200);
    const proxyRoom = (await bobProxyClient.get(`/participant/meetings/${meeting3Id}/live/room`).expect(200)).body as {
      registrations: { proxySuspendedByShareholder: boolean }[];
    };
    expect(proxyRoom.registrations[0]!.proxySuspendedByShareholder).toBe(false);
    await voteRequest(bobProxyClient, meeting3Id, 'm3-proxy-bob', {
      votingSessionId: s.id,
      choice: 'FOR',
    }).expect(200);
    await bobClient.post(`/participant/meetings/${meeting3Id}/live/attendance/leave`, {}).expect(200);

    await agMeetingAdmin.post(`${mBase()}/${meeting3Id}/voting/sessions/${s.id}/close`, {}).expect(200);

    // Company Admin and Meeting Admin CAN see pre-release results on M3
    const caPre = (await agAdmin.get(`${mBase()}/${meeting3Id}/voting/sessions/${s.id}/results`).expect(200)).body as {
      forVotes: string;
      passed: boolean;
    };
    expect(caPre.forVotes).toBe('1500');
    expect(caPre.passed).toBe(true);

    // Board Member STILL CANNOT see results pre-release!
    await agDirector.get(`${mBase()}/${meeting3Id}/voting/sessions/${s.id}/results`).expect(403);
    const boardPre = (await agDirector.get(`${mBase()}/${meeting3Id}/live/board`).expect(200)).body as {
      votingSessions: { id: string; result: unknown }[];
    };
    expect(boardPre.votingSessions[0]!.result).toBeNull();

    // Release -> now Board sees full counts, and Participants see passed WITHOUT weights (weightsHidden=true)!
    await agMeetingAdmin.post(`${mBase()}/${meeting3Id}/voting/sessions/${s.id}/release`, {}).expect(200);
    const boardPost = (await agDirector.get(`${mBase()}/${meeting3Id}/live/board`).expect(200)).body as {
      votingSessions: { id: string; result: { forVotes: string | null; passed: boolean } | null }[];
    };
    expect(boardPost.votingSessions[0]!.result?.forVotes).toBe('1500');

    const partPost = (await bobClient.get(`/participant/meetings/${meeting3Id}/live/results`).expect(200)).body as {
      result: { forVotes: string | null; baseVotes: string | null; weightsHidden: boolean; passed: boolean } | null;
    }[];
    expect(partPost[0]!.result).toMatchObject({
      forVotes: null,
      baseVotes: null,
      weightsHidden: true,
      passed: true,
    });
  });

  // ── 7. Scrutineer Four-Eyes Privileged Grant & Ballot Inspection ──────────

  it('enforces four-eyes privileged grant lifecycle, expiry, revocation, and audited individual ballot inspection', async () => {
    const sessions = (await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions`).expect(200)).body as {
      id: string;
      ballotsCast: number;
    }[];
    const targetSessionId = sessions.find((s) => s.ballotsCast > 0)!.id;

    // Without active grant, nobody can inspect individual ballots (not CA, not MA, not Platform Admin, not Foreign Admin)
    await agAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(403);
    await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(403);
    await platformAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(403);
    await padmaAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(404);

    // Non-AUTHORIZATION_MANAGE roles (Meeting Admin) cannot request grants
    await agMeetingAdmin
      .post(`/companies/${agCompanyId}/privileged-grants`, {
        meetingId: meeting1Id,
        granteeUserId: agAdminUserId,
        durationMinutes: 15,
        reason: 'Independent audit check',
      })
      .expect(403);

    // Company Admin 1 requests access for Meeting Admin (Wait: test both self-approval and grantee-approval!)
    const grantReq = (
      await agAdmin
        .post(`/companies/${agCompanyId}/privileged-grants`, {
          meetingId: meeting1Id,
          granteeUserId: agMeetingAdminUserId,
          durationMinutes: 15,
          reason: 'Verify split corporate votes for resolution 2',
        })
        .expect(201)
    ).body as { id: string; status: string };
    expect(grantReq.status).toBe('PENDING');

    // Requester (agAdmin) CANNOT approve their own request (403)
    await agAdmin
      .post(`/companies/${agCompanyId}/privileged-grants/${grantReq.id}/decision`, { decision: 'APPROVE' })
      .expect(403);

    // Grantee (even if another admin requested it!) CANNOT approve their own grant if they had AUTHORIZATION_MANAGE ->
    // verify this by creating a request where requester = groupAdmin and grantee = agAdmin, then agAdmin tries to APPROVE!
    const selfGranteeReq = (
      await groupAdmin
        .post(`/companies/${agCompanyId}/privileged-grants`, {
          meetingId: meeting1Id,
          granteeUserId: agAdminUserId,
          durationMinutes: 15,
          reason: 'Audit verification by Company Secretary',
        })
        .expect(201)
    ).body as { id: string };
    await agAdmin
      .post(`/companies/${agCompanyId}/privileged-grants/${selfGranteeReq.id}/decision`, { decision: 'APPROVE' })
      .expect(403);

    // Independent second admin (groupAdmin) approves grantReq for agMeetingAdmin
    const approved = (
      await groupAdmin
        .post(`/companies/${agCompanyId}/privileged-grants/${grantReq.id}/decision`, {
          decision: 'APPROVE',
          note: 'Approved by Group Admin',
        })
        .expect(200)
    ).body as { status: string; effectiveNow: boolean };
    expect(approved.status).toBe('APPROVED');
    expect(approved.effectiveNow).toBe(true);

    // Non-grantee (agAdmin, groupAdmin) STILL get 403; only grantee (agMeetingAdmin) sees ballots!
    await agAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(403);
    const inspected = (
      await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(200)
    ).body as { shareholderName: string; choice: string; weight: string }[];
    expect(inspected.length).toBeGreaterThan(0);

    // Verify inspection audit log exists and NEVER leaks ballot choices in audit_logs metadata
    const inspectLog = await prisma.auditLog.findFirst({
      where: { companyId: agCompanyId, action: 'voting.individual_inspection' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(inspectLog).not.toBeNull();
    expect(JSON.stringify(inspectLog!.metadata)).not.toContain('AGAINST');

    // Revoke grant -> immediately returns 403
    await agAdmin
      .post(`/companies/${agCompanyId}/privileged-grants/${grantReq.id}/decision`, {
        decision: 'REVOKE',
        note: 'Scrutiny completed',
      })
      .expect(200);
    await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(403);

    // Requester (groupAdmin) also cannot REJECT their own request under SQL & API four-eyes rules (403)
    await groupAdmin
      .post(`/companies/${agCompanyId}/privileged-grants/${selfGranteeReq.id}/decision`, {
        decision: 'REJECT',
        note: 'Self reject blocked',
      })
      .expect(403);

    // An independent third admin (agAdmin requests for agModerator -> groupAdmin rejects) succeeds
    const rejectableReq = (
      await agAdmin
        .post(`/companies/${agCompanyId}/privileged-grants`, {
          meetingId: meeting1Id,
          granteeUserId: agModeratorUserId,
          durationMinutes: 15,
          reason: 'Moderator verification request to be declined',
        })
        .expect(201)
    ).body as { id: string };
    await groupAdmin
      .post(`/companies/${agCompanyId}/privileged-grants/${rejectableReq.id}/decision`, {
        decision: 'REJECT',
        note: 'Not required',
      })
      .expect(200);
    // Expired approved grant in DB also blocked immediately
    await prisma.privilegedAccessGrant.update({
      where: { id: grantReq.id },
      data: { status: 'APPROVED', revokedAt: null, expiresAt: new Date('2020-01-01T00:00:00Z') },
    });
    await agMeetingAdmin.get(`${mBase()}/${meeting1Id}/voting/sessions/${targetSessionId}/ballots`).expect(403);
  });

  // ── 8. Database Immutability Triggers & Four-Eyes DB CHECK Constraint ────

  it('blocks direct database UPDATE and DELETE on ballots, vote_audit_events, closed voting_sessions and sealed voting_results', async () => {
    const anyBallot = await prisma.ballot.findFirstOrThrow({ where: { companyId: agCompanyId } });
    const anyEvent = await prisma.voteAuditEvent.findFirstOrThrow({ where: { companyId: agCompanyId } });
    const anyClosedSession = await prisma.votingSession.findFirstOrThrow({
      where: { companyId: agCompanyId, closedAt: { not: null } },
    });
    const anyResult = await prisma.votingResult.findFirstOrThrow({ where: { companyId: agCompanyId } });

    // Ballot: updating choice or deleting must fail
    await expect(
      prisma.$executeRaw`UPDATE ballots SET choice = 'AGAINST' WHERE id = ${anyBallot.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`UPDATE ballots SET weight = 999999 WHERE id = ${anyBallot.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`DELETE FROM ballots WHERE id = ${anyBallot.id}::uuid`,
    ).rejects.toThrow();

    // VoteAuditEvent: updating hash/reason or deleting must fail
    await expect(
      prisma.$executeRaw`UPDATE vote_audit_events SET reason = 'tampered' WHERE id = ${anyEvent.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`DELETE FROM vote_audit_events WHERE id = ${anyEvent.id}::uuid`,
    ).rejects.toThrow();

    // Closed VotingSession: reopening (closed_at = NULL) or deleting must fail
    await expect(
      prisma.$executeRaw`UPDATE voting_sessions SET closed_at = NULL WHERE id = ${anyClosedSession.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`DELETE FROM voting_sessions WHERE id = ${anyClosedSession.id}::uuid`,
    ).rejects.toThrow();

    // VotingResult: modifying tally or deleting must fail
    await expect(
      prisma.$executeRaw`UPDATE voting_results SET for_votes = 999999 WHERE id = ${anyResult.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`DELETE FROM voting_results WHERE id = ${anyResult.id}::uuid`,
    ).rejects.toThrow();

    // Four-eyes DB check constraint on privileged_access_grants: decided_by_id == requested_by_id rejected by Postgres
    await expect(
      prisma.$executeRaw`
        INSERT INTO privileged_access_grants
          (id, tenant_id, company_id, meeting_id, grantee_user_id, reason, duration_minutes, status, requested_by_id, decided_by_id)
        VALUES
          (gen_random_uuid(), ${agTenantId}::uuid, ${agCompanyId}::uuid, ${meeting1Id}::uuid,
           ${agMeetingAdminUserId}::uuid, 'SQL self approve attempt', 15, 'APPROVED',
           ${agAdminUserId}::uuid, ${agAdminUserId}::uuid)
      `,
    ).rejects.toThrow();
  });
});
