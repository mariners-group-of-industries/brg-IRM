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
        threshold: 'ANY_MEMBER',
        thresholdValue: null,
      },
      results: {
        visibility: 'ALL_AFTER_RELEASE',
        showWeights: true,
      },
      proxy: {
        ...((meeting.rules.proxy as Record<string, unknown>) ?? {}),
        allowed: true,
        shareholderPresencePrecedence: 'SHAREHOLDER_REVOKES_PROXY',
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

test.describe.serial('Phase E: secure voting, tally, release, and four-eyes scrutineer inspection', () => {
  const title = `E2E Voting AGM ${Date.now().toString().slice(-6)}`;
  let companyId = '';
  let meetingId = '';

  test('meeting admin opens voting, shareholder casts ballot, admin seals and releases, integrity is verified', async ({
    browser,
  }) => {
    companyId = await venturesId(browser);
    meetingId = await createAndStartLiveMeeting(browser, companyId, title);

    if (fs.existsSync(ABDUL_AUTH)) fs.unlinkSync(ABDUL_AUTH);
    await signInAbdulIfNeeded(browser, companyId);

    // 1. Shareholder registers and enters live room
    const holderCtx = await browser.newContext({ storageState: ABDUL_AUTH });
    const holderPage = await holderCtx.newPage();
    await holderPage.goto(`/portal/meetings/${meetingId}`);
    await holderPage.getByRole('button', { name: /Register/ }).click();
    await expect(holderPage.getByText('Registered', { exact: true })).toBeVisible();

    await holderPage.getByRole('link', { name: /Enter meeting room/ }).click();
    await expect(holderPage).toHaveURL(new RegExp(`/portal/meetings/${meetingId}/room$`));
    await expect(holderPage.getByText('Simulated video (development only)').first()).toBeVisible();

    // 2. Meeting Admin opens live console
    const opsCtx = await browser.newContext(as('meetingAdmin'));
    const opsPage = await opsCtx.newPage();
    await opsPage.goto(`/companies/${companyId}/meetings/${meetingId}/live`);
    await expect(opsPage.getByText('Simulated video (development only)').first()).toBeVisible();

    // Set item 1 as active item
    await opsPage.getByRole('button', { name: 'Set active item 1' }).click();
    await expect(
      holderPage.getByText('Agenda item 1: Adoption of audited financial statements for FY 2025-26'),
    ).toBeVisible();

    // Open voting on item 1
    const openVoteBtn = opsPage.getByRole('button', { name: 'Open voting for item 1' });
    await expect(openVoteBtn).toBeVisible();
    await openVoteBtn.click();

    // Open voting dialog opens
    const dialogSubmit = opsPage.getByRole('button', { name: 'Open voting session' });
    await expect(dialogSubmit).toBeVisible();
    await dialogSubmit.click();
    await expect(opsPage.getByText('Voting session opened')).toBeVisible();

    // Console now shows Open · Session 1 and Close & seal tally button
    await expect(opsPage.getByText('Open · Session 1')).toBeVisible();
    await expect(opsPage.getByRole('button', { name: 'Close voting for item 1' })).toBeVisible();
    await shot(opsPage, 'e01-live-voting');

    // 3. Board Room verifies results remain hidden while voting is open
    const boardCtx = await browser.newContext(as('director'));
    const boardPage = await boardCtx.newPage();
    await boardPage.goto(`/companies/${companyId}/meetings/${meetingId}/board`);
    await expect(boardPage.getByText('Voting open', { exact: true })).toBeVisible();
    await shot(boardPage, 'e02-board-waiting');

    // 4. Shareholder sees voting open via real-time update
    await expect(holderPage.getByText('Open now', { exact: true })).toBeVisible();
    // Shareholder selects 'For' and casts ballot
    await holderPage.getByRole('radio', { name: 'For' }).click();
    const castBtn = holderPage.getByRole('button', { name: 'Cast ballot' });
    await expect(castBtn).toBeEnabled();
    await castBtn.click();
    await expect(holderPage.getByText('Your ballot has been cast')).toBeVisible();
    await expect(holderPage.getByText('Voted', { exact: true })).toBeVisible();
    await shot(holderPage, 'e03-shareholder-vote');

    // 5. Meeting Admin sees turnout update (1 ballots · 15,000 votes) and closes voting
    await expect(opsPage.getByText('1 ballots · 15,000 votes')).toBeVisible();
    await opsPage.getByRole('button', { name: 'Close voting for item 1' }).click();
    await expect(opsPage.getByText('Voting closed and tally sealed')).toBeVisible();
    await expect(opsPage.getByText('Closed · sealed · Session 1')).toBeVisible();

    // Under ALL_AFTER_RELEASE, results remain hidden before release
    await expect(opsPage.getByText('Tally sealed. Results stay hidden under meeting rules until released')).toBeVisible();

    // 6. Meeting Admin releases results
    const releaseBtn = opsPage.getByRole('button', { name: 'Release results for item 1' });
    await expect(releaseBtn).toBeVisible();
    await releaseBtn.click();
    await expect(opsPage.getByText('Voting results released')).toBeVisible();
    await expect(opsPage.getByText('Carried', { exact: true }).first()).toBeVisible();

    // Verify integrity button
    const verifyBtn = opsPage.getByRole('button', { name: 'Verify integrity for item 1' });
    await verifyBtn.click();
    await expect(opsPage.getByText(/Integrity verified/i).first()).toBeVisible();

    // Board room and Shareholder room receive results via SSE
    await expect(boardPage.getByText('Carried', { exact: true }).first()).toBeVisible();
    await expect(boardPage.getByText('15,000').first()).toBeVisible();

    await expect(holderPage.getByText('Carried', { exact: true }).first()).toBeVisible();
    await expect(holderPage.getByText('15,000').first()).toBeVisible();
    await shot(holderPage, 'e04-results-released');

    await opsCtx.close();
    await boardCtx.close();
    await holderCtx.close();
  });

  test('four-eyes scrutineer privileged access grant and individual ballot inspection', async ({
    browser,
  }) => {
    // 1. Company Admin requests scrutineer access for Director (Mahmudul Hasan)
    const caCtx = await browser.newContext(as('meghnaAdmin'));
    const caPage = await caCtx.newPage();
    await caPage.goto(`/companies/${companyId}/meetings/${meetingId}/grants`);
    await expect(caPage.getByRole('heading', { name: 'Scrutineer access grants' })).toBeVisible();
    await expectNoHorizontalOverflow(caPage);

    await caPage.getByRole('button', { name: /Request access/ }).click();
    await expect(caPage.getByRole('heading', { name: 'Request scrutineer access' })).toBeVisible();

    // Select Mahmudul Hasan (Board Member)
    await caPage.locator('#granteeUserId').selectOption({ label: 'Mahmudul Hasan (Board Member)' });
    await caPage.locator('#durationMinutes').fill('30');
    await caPage.locator('#grant-reason').fill('Auditing individual ballots for compliance with Companies Act 1994.');
    await caPage.getByRole('button', { name: 'Submit request' }).click();

    await expect(caPage.getByText('Scrutineer request submitted for approval')).toBeVisible();
    // Requester cannot approve their own request under four-eyes control
    await expect(caPage.getByText('Awaiting another admin')).toBeVisible();
    await shot(caPage, 'e05-scrutineer-grants');
    await caCtx.close();

    // 2. Group Admin approves the grant under four-eyes control
    const gaCtx = await browser.newContext(as('groupAdmin'));
    const gaPage = await gaCtx.newPage();
    await gaPage.goto(`/companies/${companyId}/meetings/${meetingId}/grants`);
    await expect(gaPage.getByRole('button', { name: 'Approve' })).toBeVisible();
    await gaPage.getByRole('button', { name: 'Approve' }).click();
    await expect(gaPage.getByText('Scrutineer access approved')).toBeVisible();
    await expect(gaPage.getByText('Active', { exact: true }).first()).toBeVisible();
    await gaCtx.close();

    // 3. Grantee (Director Mahmudul Hasan) now accesses individual ballot inspection
    const granteeCtx = await browser.newContext(as('director'));
    const granteePage = await granteeCtx.newPage();
    await granteePage.goto(`/companies/${companyId}/meetings/${meetingId}/grants`);
    await expect(granteePage.getByText('Your scrutineer grant is active')).toBeVisible();
    // Ballot inspection table shows the cast ballot
    await expect(granteePage.getByText('Abdul Karim')).toBeVisible();
    await expect(granteePage.getByText('15,000')).toBeVisible();
    await expect(granteePage.getByText('For', { exact: true }).first()).toBeVisible();
    await expect(granteePage.getByText('Effective').first()).toBeVisible();
    await expectNoHorizontalOverflow(granteePage);
    await granteeCtx.close();
  });
});

test('the live shareholder meeting room voting controls fit cleanly on a phone @mobile', async ({
  browser,
  page,
}) => {
  const companyId = await venturesId(browser);
  const mobileMeetingId = await createAndStartLiveMeeting(
    browser,
    companyId,
    `Mobile Voting AGM ${Date.now().toString().slice(-6)}`,
  );
  await signInAbdulIfNeeded(browser, companyId);

  // Meeting Admin opens voting
  const opsCtx = await browser.newContext(as('meetingAdmin'));
  const opsHeaders = await csrf(opsCtx.request);
  const agendaList = (await (await opsCtx.request.get(`/api/v1/companies/${companyId}/meetings/${mobileMeetingId}/live/console`)).json()).agenda as { id: string }[];
  const item1Id = agendaList[0]!.id;

  await opsCtx.request.post(`/api/v1/companies/${companyId}/meetings/${mobileMeetingId}/live/active-item`, {
    headers: opsHeaders,
    data: { agendaItemId: item1Id },
  });
  await opsCtx.request.post(`/api/v1/companies/${companyId}/meetings/${mobileMeetingId}/voting/sessions/open`, {
    headers: opsHeaders,
    data: { agendaItemId: item1Id },
  });
  await opsCtx.close();

  const authState = JSON.parse(fs.readFileSync(ABDUL_AUTH, 'utf8')) as {
    cookies: Parameters<typeof page.context.prototype.addCookies>[0];
  };
  await page.context().addCookies(authState.cookies);

  await page.goto(`/portal/meetings/${mobileMeetingId}`);
  await page.getByRole('button', { name: /Register/ }).click();
  await expect(page.getByText('Registered', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /Enter meeting room/ }).click();
  await expect(page.getByText('Simulated video (development only)').first()).toBeVisible();
  await expect(page.getByText('Open now', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'For' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cast ballot' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await shot(page, 'm07-shareholder-vote');
});
