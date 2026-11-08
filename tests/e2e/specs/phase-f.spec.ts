import fs from 'node:fs';
import { expect, test, type APIRequestContext, type Browser } from '@playwright/test';
import { as, expectNoHorizontalOverflow, shot } from './helpers';

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

async function createMeetingForReports(browser: Browser, companyId: string, label: string): Promise<string> {
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

  await admin.request.patch(`/api/v1/companies/${companyId}/meetings/${meeting.id}`, {
    headers: adminHeaders,
    data: {
      noticeText:
        'Notice is hereby given that the Annual General Meeting of Mariners Ventures PLC will be held virtually to transact the business set out in the agenda.',
    },
  });

  await admin.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/agenda`, {
    headers: adminHeaders,
    data: {
      number: '1',
      title: 'Adoption of audited financial statements for FY 2025-26',
      hasResolution: true,
      resolutionKind: 'ORDINARY',
      resolutionText:
        'RESOLVED that the audited financial statements for the year ended 30 June 2026 be and are hereby adopted.',
      requiresProposal: true,
      requiresSeconding: true,
    },
  });

  // Assign a board member so meeting can transition to scheduled
  const directorCtx = await browser.newContext(as('director'));
  const directorMe = await (await directorCtx.request.get('/api/v1/auth/me')).json();
  await directorCtx.close();

  await admin.request.put(`/api/v1/companies/${companyId}/meetings/${meeting.id}/staff`, {
    headers: adminHeaders,
    data: {
      boardMemberIds: [directorMe.id],
      moderatorIds: [],
    },
  });

  // Publish to SCHEDULED
  let detail = (await (await admin.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  await admin.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: adminHeaders,
    data: { to: 'SCHEDULED', expectedVersion: detail.version },
  });

  // Open REGISTRATION
  detail = (await (await admin.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  await admin.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: adminHeaders,
    data: { to: 'REGISTRATION_OPEN', expectedVersion: detail.version },
  });
  await admin.close();

  // Start LIVE
  const ops = await browser.newContext(as('meetingAdmin'));
  const opsHeaders = await csrf(ops.request);
  detail = (await (await ops.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  await ops.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: opsHeaders,
    data: { to: 'LIVE', expectedVersion: detail.version },
  });

  // End meeting to COMPLETED
  detail = (await (await ops.request.get(`/api/v1/companies/${companyId}/meetings/${meeting.id}`)).json()) as {
    version: number;
  };
  await ops.request.post(`/api/v1/companies/${companyId}/meetings/${meeting.id}/transition`, {
    headers: opsHeaders,
    data: { to: 'COMPLETED', expectedVersion: detail.version },
  });
  await ops.close();

  return meeting.id;
}

test.describe('Phase F: Reports, Minutes, and Hardening', () => {
  test('staff manages reports, drafts minutes, finalizes, archives meeting, and publishes to portal', async ({
    browser,
  }) => {
    const cid = await venturesId(browser);
    const mid = await createMeetingForReports(browser, cid, `Phase F Governance AGM ${Date.now().toString().slice(-6)}`);

    const adminCtx = await browser.newContext(as('meghnaAdmin'));
    const page = await adminCtx.newPage();

    // 1. Navigate to Reports & minutes tab
    await page.goto(`/companies/${cid}/meetings/${mid}/reports`);
    await page.waitForLoadState('networkidle');

    // Verify the official governance reports are listed
    await expect(page.getByText('Official Governance Reports')).toBeVisible();
    await expect(page.getByText('Voting Results Tally Sheet')).toBeVisible();
    await expect(page.getByText('Attendance & Quorum Log')).toBeVisible();
    await expect(page.getByText('Proposals, Seconding & Poll Demands')).toBeVisible();
    await expect(page.getByText('Questions & Moderation Log')).toBeVisible();
    await expect(page.getByText('Meeting Audit Trail')).toBeVisible();

    // 2. Pre-fill minutes from meeting data
    const prefillBtn = page.getByRole('button', { name: /Pre-fill from meeting data/i });
    await expect(prefillBtn).toBeVisible();
    await prefillBtn.click();

    // Content should appear in textarea
    const textarea = page.locator('#minutesContent');
    await expect(textarea).toBeVisible();
    await expect(textarea).not.toBeEmpty();

    // 3. Save Draft
    await page.getByRole('button', { name: /Save draft/i }).click();
    await expect(page.getByText('Minutes draft saved successfully.')).toBeVisible();

    await shot(page, 'f01-reports-and-minutes.png');

    // 4. Verify Archive is blocked while minutes are draft
    await page.goto(`/companies/${cid}/meetings/${mid}`);
    await page.waitForLoadState('networkidle');
    const archiveBtn = page.getByRole('button', { name: /^Archive$/i });
    await expect(archiveBtn).toBeDisabled();

    // 5. Finalize Minutes
    await page.goto(`/companies/${cid}/meetings/${mid}/reports`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Finalize minutes/i }).click();
    await expect(page.getByRole('heading', { name: /Finalize Meeting Minutes/i })).toBeVisible();

    await shot(page, 'f02-finalize-minutes-modal.png');

    await page.locator('#signedBy').fill('Mahmudul Hasan (Chairman of the Board)');
    await page.getByRole('button', { name: /Confirm and finalize/i }).click();

    await expect(page.getByText('Minutes have been finalized.')).toBeVisible();
    await expect(page.getByText('Finalized', { exact: true })).toBeVisible();

    // 6. Archive Meeting
    await page.goto(`/companies/${cid}/meetings/${mid}`);
    await page.waitForLoadState('networkidle');
    const enabledArchiveBtn = page.getByRole('button', { name: /^Archive$/i });
    await expect(enabledArchiveBtn).toBeEnabled();
    await enabledArchiveBtn.click();

    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();

    await shot(page, 'f03-archived-meeting-minutes.png');

    // 7. Publish to Shareholders
    await page.goto(`/companies/${cid}/meetings/${mid}/reports`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Publish to shareholders/i }).click();
    await expect(page.getByText('Published to the Shareholder Portal')).toBeVisible();

    // 8. Verify Shareholder portal sees outcomes and minutes
    await adminCtx.close();

    if (fs.existsSync(ABDUL_AUTH)) fs.unlinkSync(ABDUL_AUTH);
    await signInAbdulIfNeeded(browser, cid);
    const holderCtx = await browser.newContext({ storageState: ABDUL_AUTH });
    const holderPage = await holderCtx.newPage();
    await holderPage.goto(`/portal/meetings/${mid}`);
    await holderPage.waitForLoadState('networkidle');

    await expect(holderPage.getByText('Official meeting documents & outcomes')).toBeVisible();
    await expect(holderPage.getByText('Official Voting Results Sheet')).toBeVisible();
    await expect(holderPage.getByText('Official Meeting Minutes')).toBeVisible();

    await shot(holderPage, 'f04-shareholder-outcomes.png');
    await holderCtx.close();
  });

  test('reports and minutes view renders cleanly on mobile @mobile', async ({ browser }) => {
    const cid = await venturesId(browser);
    const mid = await createMeetingForReports(browser, cid, `Mobile Phase F AGM ${Date.now().toString().slice(-6)}`);

    const adminCtx = await browser.newContext({
      ...as('meghnaAdmin'),
      viewport: { width: 390, height: 844 },
    });
    const page = await adminCtx.newPage();

    await page.goto(`/companies/${cid}/meetings/${mid}/reports`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Official Governance Reports')).toBeVisible();
    await expect(page.getByText('Official Meeting Minutes')).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await shot(page, 'm08-reports-and-minutes-mobile.png');
    await adminCtx.close();
  });
});
