import { expect, test, type Browser, type Page } from '@playwright/test';

// Full reference scenario against dev (WP-8 DoD, AT-01, AT-03, AT-05, AT-06, AT-29), run on
// a freshly reset environment with replayed signals. The only manual step is the approval:
// the test waits for an approver to decide, then checks the executed plan.
// Signed-in states are files outside the repository:
//   E2E_PLANNER_STATE  storage state of a planner or admin user
//   E2E_APPROVER_STATE storage state of the assigned approver (optional; read-only checks)
const reference = 'EXC-2026-0914';
const planner = process.env.E2E_PLANNER_STATE;
const approver = process.env.E2E_APPROVER_STATE;
const minutes = (count: number) => count * 60_000;

test.skip(!planner, 'set E2E_PLANNER_STATE to a signed-in planner storage state');

async function signedIn(browser: Browser, state: string): Promise<Page> {
  const context = await browser.newContext({ storageState: state });
  return context.newPage();
}

async function caseStatus(page: Page) {
  await page.goto(`/cases/${reference}/signal`);
  return (await page.locator('.case-meta .badge').first().innerText()).toLowerCase();
}

test('WP-8 reference scenario runs live up to approval and executes after it', async ({ browser }) => {
  const page = await signedIn(browser, planner!);

  // AT-01: six actionable cases; the reference case ranks first.
  await page.goto('/board');
  await expect(page.getByText(reference).first()).toBeVisible({ timeout: minutes(2) });

  // AT-03: the photographed quantity is UNCONFIRMED; the planner confirms 640.
  await expect.poll(() => caseStatus(page), { timeout: minutes(5), intervals: [10_000] }).toMatch(/waiting planner|awaiting approval|monitoring/);
  if ((await caseStatus(page)).includes('waiting planner')) {
    await page.getByRole('button', { name: 'Review field QUANTITY' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Confirm extracted field' });
    await dialog.getByLabel('Confirmed value').fill('640');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Submit confirmed request' }).click();
    await expect(page.getByText('Request accepted. Follow refreshed server state and trace for the outcome.')).toBeVisible();
  }

  // AT-05: options with checks; the alternate supplier is blocked by V-06.
  await expect.poll(() => caseStatus(page), { timeout: minutes(8), intervals: [15_000] }).toMatch(/awaiting approval|monitoring|executing/);
  await page.goto(`/cases/${reference}/options`);
  await expect(page.getByText(/Blocked · .*V-06/)).toBeVisible();
  await expect(page.getByText(/^Chosen plan: /)).toBeVisible();

  // AT-29 / FR-RTE-08: both plan parts and the time left are shown.
  await page.goto(`/cases/${reference}/approve`);
  await expect(page.getByText(/^Tier 2 · /).first()).toBeVisible();
  await expect(page.getByText(/min left|Decided/).first()).toBeVisible();

  if (approver) {
    const approval = await signedIn(browser, approver);
    await approval.goto(`/approvals/${reference}`);
    await expect(approval.getByRole('button', { name: 'Review & approve' })).toBeVisible();
  }

  // Manual step: the assigned approver approves in the console before the deadline.
  await expect.poll(() => caseStatus(page), { timeout: minutes(30), intervals: [20_000] }).toMatch(/monitoring|closed/);

  // AT-06: the execute view shows SAP documents and the saved undo plan.
  await page.goto(`/cases/${reference}/execute`);
  await expect(page.getByText('SAP document').first()).toBeVisible();
  await expect(page.getByText('undo saved').first()).toBeVisible();
});
