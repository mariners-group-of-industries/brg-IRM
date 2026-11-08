import fs from 'node:fs';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { as, expectNoHorizontalOverflow, shot } from './helpers';

async function venturesId(browser: Browser): Promise<string> {
  const ctx = await browser.newContext(as('platform'));
  const res = await ctx.request.get('/api/v1/companies?pageSize=100');
  const id = ((await res.json()).items as { id: string; slug: string }[]).find((c) => c.slug === 'mariners-ventures')!.id;
  await ctx.close();
  return id;
}

async function csrf(request: APIRequestContext): Promise<Record<string, string>> {
  const me = await (await request.get('/api/v1/auth/me')).json();
  return { 'X-CSRF-Token': me.csrfToken };
}

async function createAndStartLiveMeeting(browser: Browser, companyId: string, label: string): Promise<string> {
  const admin = await browser.newContext(as('meghnaAdmin'));
  const adminHeaders = await csrf(admin.request);

  const created = await admin.request.post(`/api/v1/companies/${companyId}/meetings`, {
    headers: adminHeaders,
    data: {
      title: label,
      type: 'AGM',
      mode: 'VIRTUAL',
      scheduledStart: '2026-12-29T11:00:00+06:00',
      recordDate: '2026-10-31',
    },
  });
  expect(created.ok()).toBeTruthy();
  const meeting = (await created.json()) as { id: string; version: number; rules: Record<string, unknown> };

  const patched = await admin.request.patch(`/api/v1/companies/${companyId}/meetings/${meeting.id}`, {
    headers: adminHeaders,
    data: {
      noticeText:
        'Notice is hereby given that the Annual General Meeting of Mariners Ventures PLC will be held virtually to transact the business set out in the agenda.',
    },
  });
  expect(patched.ok(), await patched.text()).toBeTruthy();

  const agendaRes = await admin.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/agenda`, {
    headers: adminHeaders,
    data: {
      number: '1',
      title: 'Adoption of audited financial statements for FY 2025-26',
      hasResolution: true,
      resolutionKind: 'ORDINARY',
      resolutionText:
        'RESOLVED that the audited financial statements for the year ended 30 June 2026 be and are hereby adopted.',
    },
  });
  expect(agendaRes.ok(), await agendaRes.text()).toBeTruthy();

  const rulesRes = await admin.request.put(`/api/v1/companies/${companyId}/meetings/${meeting.id}/rules`, {
    headers: adminHeaders,
    data: {
      ...meeting.rules,
      pollDemand: {
        enabled: true,
        threshold: 'VOTING_RIGHTS_PERCENT',
        thresholdValue: 3,
      },
    },
  });
  expect(rulesRes.ok(), await rulesRes.text()).toBeTruthy();

  let detail = (await (await admin.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  const pubRes = await admin.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: adminHeaders,
    data: { to: 'SCHEDULED', expectedVersion: detail.version },
  });
  expect(pubRes.ok(), await pubRes.text()).toBeTruthy();

  detail = (await (await admin.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  const regRes = await admin.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: adminHeaders,
    data: { to: 'REGISTRATION_OPEN', expectedVersion: detail.version },
  });
  expect(regRes.ok(), await regRes.text()).toBeTruthy();
  await admin.close();

  const ops = await browser.newContext(as('meetingAdmin'));
  const opsHeaders = await csrf(ops.request);
  detail = (await (await ops.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  const started = await ops.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: opsHeaders,
    data: { to: 'LIVE', expectedVersion: detail.version },
  });
  expect(started.ok(), await started.text()).toBeTruthy();
  await ops.close();

  return meeting.id;
}

const ABDUL_AUTH = '.auth/abdul.json';

async function signInAbdulIfNeeded(browser: Browser, companyId: string): Promise<void> {
  if (fs.existsSync(ABDUL_AUTH)) return;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/join/${companyId}`);
  await page.locator('#identifier').fill('1201950000000001');
  await page.getByRole('button', { name: /Send me a code/ }).click();
  await expect(page.getByRole('heading', { name: 'Enter your code' })).toBeVisible();
  const msgs = (await (await page.request.get('/api/v1/dev/outbox')).json()) as { recipient: string; body: string }[];
  const code = /\b(\d{6})\b/.exec(msgs.find((m) => m.recipient === '+8801711000001')!.body)![1]!;
  await page.getByLabel(/6-digit code/).fill(code);
  await page.getByRole('button', { name: /Sign in to/ }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await ctx.storageState({ path: ABDUL_AUTH });
  await ctx.close();
}

test.describe.serial('live AGM room, motions, moderation and board view', () => {
  const title = `E2E Live AGM ${Date.now().toString().slice(-6)}`;
  let companyId = '';
  let meetingId = '';

  test('meeting admin opens stages and announcements while a shareholder participates in real time', async ({
    browser,
  }) => {
    companyId = await venturesId(browser);
    meetingId = await createAndStartLiveMeeting(browser, companyId, title);

    // Remove any stale participant storage state from a previous run before authenticating fresh.
    if (fs.existsSync(ABDUL_AUTH)) fs.unlinkSync(ABDUL_AUTH);
    await signInAbdulIfNeeded(browser, companyId);

    const holderCtx = await browser.newContext({ storageState: ABDUL_AUTH });
    const holderPage = await holderCtx.newPage();
    await holderPage.goto(`/portal/meetings/${meetingId}`);
    await holderPage.getByRole('button', { name: /Register/ }).click();
    await expect(holderPage.getByText('Registered', { exact: true })).toBeVisible();

    await holderPage.getByRole('link', { name: /Enter meeting room/ }).click();
    await expect(holderPage).toHaveURL(new RegExp(`/portal/meetings/${meetingId}/room$`));
    await expect(holderPage.getByText('Simulated video (development only)').first()).toBeVisible();
    await expect(holderPage.getByText('Not open yet').first()).toBeVisible();
    await expectNoHorizontalOverflow(holderPage);
    await shot(holderPage, 'd01-shareholder-room-waiting');

    const opsCtx = await browser.newContext(as('meetingAdmin'));
    const opsPage = await opsCtx.newPage();
    await opsPage.goto(`/companies/${companyId}/meetings/${meetingId}/live`);
    await expect(opsPage.getByText('Simulated video (development only)').first()).toBeVisible();
    await expect(opsPage.getByText('15,000').first()).toBeVisible();
    await expectNoHorizontalOverflow(opsPage);

    // Chair selects active item 1 -> shareholder room updates via SSE without reload.
    await opsPage.getByRole('button', { name: 'Set active item 1' }).click();
    await expect(
      holderPage.getByText('Agenda item 1: Adoption of audited financial statements for FY 2025-26'),
    ).toBeVisible();

    // Chair opens Proposal stage -> shareholder proposes -> accepted proposer shown on both views.
    await opsPage.getByRole('button', { name: 'Proposal: closed (item 1)' }).click();
    const proposeBtn = holderPage.getByRole('button', { name: /Propose resolution/ });
    await expect(proposeBtn).toBeEnabled();
    await proposeBtn.click();
    await expect(holderPage.getByText('Proposed by').first()).toBeVisible();
    await expect(opsPage.getByText('Abdul Karim').first()).toBeVisible();

    // Chair opens Poll demand stage -> shareholder demands a poll (15,000 / 3,96,100 = 3.78% >= 3%).
    await opsPage.getByRole('button', { name: 'Poll demand: closed (item 1)' }).click();
    const pollBtn = holderPage.getByRole('button', { name: /Demand a poll/ });
    await expect(pollBtn).toBeEnabled();
    await pollBtn.click();
    await expect(holderPage.getByText('Your poll demand has been recorded for this item.')).toBeVisible();
    await expect(opsPage.getByText('Threshold met')).toBeVisible();

    // Chair publishes announcement -> appears in shareholder room via SSE.
    await opsPage.getByLabel('Message to participants').fill('Voting on item 1 will open after questions.');
    await opsPage.getByRole('button', { name: 'Publish announcement' }).click();
    await expect(holderPage.getByText('Voting on item 1 will open after questions.')).toBeVisible();

    await shot(opsPage, 'd02-live-console');
    await shot(holderPage, 'd03-shareholder-room-active');

    await opsCtx.close();
    await holderCtx.close();
  });

  test('shareholder submits a Bangla question, moderator forwards it, and board member sees it', async ({
    browser,
  }) => {
    const banglaQuestion = 'আগামী অর্থবছরের লভ্যাংশ নীতি সম্পর্কে পরিচালনা পর্ষদের পরিকল্পনা কী?';

    const holderCtx = await browser.newContext({ storageState: ABDUL_AUTH });
    const holderPage = await holderCtx.newPage();
    await holderPage.goto(`/portal/meetings/${meetingId}/room`);
    await holderPage.getByLabel(/Your question/).fill(banglaQuestion);
    await holderPage.getByRole('button', { name: /Submit question/ }).click();
    await expect(holderPage.getByText('Received', { exact: true })).toBeVisible();
    await expect(holderPage.getByText(banglaQuestion)).toBeVisible();

    // Moderator filters Bangla questions and forwards to the board.
    const modCtx = await browser.newContext(as('moderator'));
    const modPage = await modCtx.newPage();
    await modPage.goto(`/companies/${companyId}/meetings/${meetingId}/moderation`);
    await modPage.getByRole('button', { name: 'Bangla only' }).click();
    await expect(modPage.getByText(banglaQuestion)).toBeVisible();
    await expectNoHorizontalOverflow(modPage);
    await modPage.getByRole('button', { name: /Forward to board/ }).click();
    await expect(modPage.getByText('Forwarded', { exact: true }).first()).toBeVisible();
    await shot(modPage, 'd04-moderation');

    // Shareholder sees status update via SSE ("With the board").
    await expect(holderPage.getByText('With the board')).toBeVisible();

    // Board member sees the forwarded question and accepted proposer in the Board view.
    const boardCtx = await browser.newContext(as('director'));
    const boardPage = await boardCtx.newPage();
    await boardPage.goto(`/companies/${companyId}/meetings/${meetingId}/board`);
    await expect(boardPage.getByText('Simulated video (development only)').first()).toBeVisible();
    await expect(boardPage.getByText(banglaQuestion)).toBeVisible();
    await expect(boardPage.getByText('Abdul Karim').first()).toBeVisible();
    await expectNoHorizontalOverflow(boardPage);
    await shot(boardPage, 'd05-board-room');

    await boardCtx.close();
    await modCtx.close();
    await holderCtx.close();
  });
});

test('the live shareholder meeting room fits cleanly on a phone @mobile', async ({ browser, page }) => {
  const companyId = await venturesId(browser);
  const mobileMeetingId = await createAndStartLiveMeeting(
    browser,
    companyId,
    `Mobile Live AGM ${Date.now().toString().slice(-6)}`,
  );
  await signInAbdulIfNeeded(browser, companyId);

  const authState = JSON.parse(fs.readFileSync(ABDUL_AUTH, 'utf8')) as {
    cookies: Parameters<typeof page.context.prototype.addCookies>[0];
  };
  await page.context().addCookies(authState.cookies);

  await page.goto(`/portal/meetings/${mobileMeetingId}`);
  await page.getByRole('button', { name: /Register/ }).click();
  await expect(page.getByText('Registered', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Enter meeting room/ }).click();
  await expect(page.getByText('Simulated video (development only)').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Ask a question/ })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, 'm06-shareholder-room');
});

