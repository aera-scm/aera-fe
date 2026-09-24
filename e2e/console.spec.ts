import { expect, test } from '@playwright/test';

const referenceId = 'EXC-2026-0914';

test('NFR-USE-02 board fits supported viewport and renders brand assets', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/board');
  await expect(page.getByRole('link', { name: 'Brake caliper housing', exact: true })).toBeVisible();
  await expect(page.getByText('Demo workspace', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('board.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('FR-UI-08 phone-first approval remains local and requires explicit confirmation', async ({ page }, testInfo) => {
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
  await page.goto('/approvals/' + referenceId);
  const review = page.getByRole('button', { name: 'Review & approve' });
  await expect(review).toBeDisabled();
  await page.getByLabel('Demo role').selectOption('approver');
  await review.click();
  const dialog = page.getByRole('dialog', { name: 'Confirm demo approval' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Confirm approval' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('approval.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Confirm approval' }).click();
  await expect(page.getByText('Demo plan approved. No real SAP action was performed.')).toBeVisible();
  expect(writes).toEqual([]);
});

test('FR-UI-03 all six stages remain reachable', async ({ page }) => {
  await page.goto('/cases/' + referenceId + '/signal');
  const rail = page.getByRole('navigation', { name: 'Case stages' });
  await expect(rail.getByRole('link')).toHaveCount(6);
  for (const stage of ['signal', 'triage', 'impact', 'options', 'approve', 'execute']) {
    await rail.locator('a[href$="/' + stage + '"]').click();
    await expect(page).toHaveURL(new RegExp('/' + stage + '$'));
    await expect(rail.locator('[aria-current="step"]')).toHaveAttribute('href', '/cases/' + referenceId + '/' + stage);
  }
  await expect(page.getByText('Workflow preview only. No live workflow or SAP document has been created.')).toBeVisible();
});

test('FR-UI-13 projection and what-if remain readable without changing the plan', async ({ page }, testInfo) => {
  await page.goto('/cases/' + referenceId + '/options');
  const panel = page.getByRole('article', { name: 'Stock projection' });
  await expect(panel.getByRole('img', { name: /Stock projection for plant 1010/ })).toBeVisible();
  await expect(panel.getByText('Synthetic projection')).toBeVisible();
  await panel.getByLabel('What-if quantity').fill('400');
  await panel.getByRole('button', { name: 'Run what-if' }).click();
  await expect(panel.getByText('What-if only. Plan version 1 remains unchanged.')).toBeVisible();
  await expect(panel.getByText('Synthetic projection only. Verifier checks require a connected workspace.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('projection.png'), fullPage: true });
});
