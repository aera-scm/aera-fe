import { expect, test } from '@playwright/test';

const referenceId = 'EXC-2026-0914';

test('NFR-USE-02 board fits supported viewport and renders brand assets', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/board');
  await expect(page.getByRole('link', { name: 'Brake caliper housing', exact: true })).toBeVisible();
  await expect(page.getByText('Demo workspace', { exact: true })).toHaveCount(0);
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
  await page.getByLabel('Workspace role').selectOption('approver');
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
  await expect(panel.getByText('Synthetic projection')).toHaveCount(0);
  await panel.getByLabel('What-if quantity').fill('400');
  await panel.getByRole('button', { name: 'Run what-if' }).click();
  await expect(panel.getByText('What-if only. Plan version 1 remains unchanged.')).toBeVisible();
  await expect(panel.getByText('Synthetic projection only. Verifier checks require a connected workspace.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('projection.png'), fullPage: true });
});

test('FR-UI-15 judge mode fits viewport and labels synthetic preview', async ({ page }, testInfo) => {
  await page.goto('/lab/judge');
  await page.getByLabel('Workspace role').selectOption('admin');
  await expect(page.getByText('Choose a disruption. Watch AERA respond.')).toBeVisible();
  await page.getByLabel('Exception type').selectOption('CARRIER_DELAY');
  await page.getByLabel('Delivery channel').selectOption('CARRIER');
  await page.getByRole('button', { name: 'Preview inputs' }).click();
  await expect(page.getByText('Ready to test')).toBeVisible();
  await expect(page.getByText('Preview only. No Mirror mutation or signal delivery.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('lab-judge.png'), fullPage: true });
});

test('NFR-USE-02 responsive search and filter reset recover board results', async ({ page }, testInfo) => {
  await page.goto('/board');
  const search = page.getByLabel(testInfo.project.name === 'phone' ? 'Search cases on mobile' : 'Search cases', { exact: true });
  await search.fill('missing-material');
  await expect(page.getByText('No matching cases', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset search and filters' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('link', { name: 'Brake caliper housing', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh cases' }).click();
  await expect(page.getByRole('button', { name: 'Refresh cases' })).toBeEnabled();
  if (testInfo.project.name !== 'phone') {
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('readable text, light appearance and lower content remain accessible', async ({ page }) => {
  await page.goto('/board');
  await expect(page.getByRole('link', { name: 'Brake caliper housing', exact: true })).toBeVisible();
  expect(await page.locator('.case-title').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
  await page.evaluate(() => localStorage.setItem('aera-theme', 'dark'));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await expect(page.getByRole('button', { name: /Switch to .* mode/ })).toHaveCount(0);
  expect(await page.locator('.panel, .stat').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.locator('footer').scrollIntoViewIfNeeded();
  expect(await page.locator('footer').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/approvals/' + referenceId);
  await page.getByLabel('Workspace role').selectOption('approver');
  await page.getByRole('button', { name: 'Review & approve' }).click();
  const dialog = page.getByRole('dialog', { name: 'Confirm demo approval' });
  expect(await dialog.locator('[class^="awsui_container_"]').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 255, 255)');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.goto('/board');
  await page.setViewportSize({ width: 320, height: 600 });
  expect(await page.locator('.top-actions').evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 500 });
  if (await page.getByRole('button', { name: 'Toggle navigation' }).getAttribute('aria-expanded') !== 'true') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  const sidebar = page.locator('.sidebar');
  expect(await sidebar.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
  await sidebar.locator('.version-label').scrollIntoViewIfNeeded();
  expect(await sidebar.locator('.version-label').evaluate(element => element.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
});

test('sidebar can close reopen resize and persist without clipping content', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/board');
  const sidebar = page.locator('.sidebar');
  const resize = page.getByRole('separator', { name: 'Resize sidebar' });
  await expect(resize).toHaveAttribute('aria-valuenow', '220');
  const handle = await resize.boundingBox();
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 150);
  await page.mouse.down(); await page.mouse.move(290, handle!.y + 150); await page.mouse.up();
  await expect.poll(() => sidebar.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(270);
  await resize.focus(); await page.keyboard.press('Home');
  await expect(resize).toHaveAttribute('aria-valuenow', '180');
  await page.getByRole('button', { name: 'Close sidebar' }).click();
  await expect(sidebar).not.toBeVisible();
  expect(await page.locator('main').evaluate(element => parseFloat(getComputedStyle(element).marginLeft))).toBe(0);
  await page.reload(); await expect(sidebar).not.toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(sidebar).toBeVisible();
  await expect(resize).toHaveAttribute('aria-valuenow', '180');
  await page.setViewportSize({ width: 375, height: 600 });
  await expect(sidebar).not.toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(sidebar).toBeVisible();
  await page.keyboard.press('Escape'); await expect(sidebar).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollbarColor)).not.toBe('auto');
});

test('overview filters survive case review refresh and browser back', async ({ page }, testInfo) => {
  await page.goto('/board');
  const search = page.getByLabel(testInfo.project.name === 'phone' ? 'Search cases on mobile' : 'Search cases', { exact: true });
  await search.fill('MAT-48219');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Autonomy tier').selectOption('2');
  await expect(page).toHaveURL(/tier=2/);
  await page.reload();
  await expect(search).toHaveValue('MAT-48219');
  await expect(page.getByRole('button', { name: 'Remove tier filter' })).toBeVisible();
  await page.getByRole('link', { name: 'Brake caliper housing', exact: true }).click();
  await expect(page.locator('main')).toBeFocused();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Remove tier filter' })).toBeVisible();
  await page.getByRole('link', { name: 'Brake caliper housing', exact: true }).click();
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page.getByRole('button', { name: 'Remove tier filter' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove tier filter' }).click();
  await page.getByRole('button', { name: 'Remove search filter' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByLabel('Sort cases')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sidebar uses panel icons and respects reduced motion without redundant banners', async ({ page }) => {
  await page.goto('/board');
  await page.setViewportSize({ width: 1366, height: 768 });
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await expect(toggle.locator('.lucide-panel-left-close')).toBeVisible();
  await expect(page.getByText(/demo workspace|reference scenario|synthetic data|synthetic reference scenario/i)).toHaveCount(0);
  await toggle.click();
  await expect(toggle.locator('.lucide-panel-left-open')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('main').evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  expect(await page.locator('.route-view').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
});

test('tab branding and layouts adapt through phone tablet and wide screen sizes', async ({ page }) => {
  await page.goto('/board');
  await page.evaluate(() => localStorage.setItem('aera-sidebar-width', '320'));
  for (const width of [320, 641, 768, 820, 1024, 1101, 1280, 1440, 2560]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/cases/' + referenceId + '/options');
    await expect(page.getByRole('heading', { name: 'More than one way forward.' })).toBeVisible();
    await expect(page).toHaveTitle('AERA');
    await expect(page.getByLabel('Workspace role')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.top-actions').evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
  }
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 600 });
    for (const route of ['/board', '/approvals/' + referenceId, '/lab/judge', '/admin']) {
      await page.goto(route);
      await page.getByLabel('Workspace role').selectOption('admin');
      await expect(page.locator('h1').first()).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page).toHaveTitle('AERA');
    }
  }
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute('href', '/brand/logo%20pure.png');
  const response = await page.request.get('/brand/logo%20pure.png');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
});

test('English controls and formatted help remain usable on desktop and phone', async ({ page }, testInfo) => {
  await page.goto('/board');
  await expect(page.getByRole('button', { name: 'Change language' })).toHaveCount(0);
  const role = page.getByLabel('Workspace role');
  await role.focus();
  expect(await role.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('data:image/svg+xml');
  await role.selectOption('approver');
  await expect(role).toHaveValue('approver');
  const search = page.getByLabel(testInfo.project.name === 'phone' ? 'Search cases on mobile' : 'Search cases', { exact: true });
  await search.fill('MAT-48219');
  await expect(search).toBeFocused();
  await expect(page.getByRole('button', { name: 'Remove search filter' })).toBeVisible();
  if (testInfo.project.name === 'phone') await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Help & getting started' }).click();
  const help = page.getByRole('dialog', { name: 'Help & getting started' });
  await expect(help.getByRole('list', { name: 'Case workflow' }).locator('li')).toHaveCount(6);
  await expect(help.getByRole('heading', { name: 'Know your role' })).toBeVisible();
  await help.getByRole('heading', { name: 'Work faster' }).scrollIntoViewIfNeeded();
  expect(await help.locator('.help-guide').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await help.getByRole('button', { name: 'Got it' }).click();
  await expect(help).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('footer stays at viewport bottom without covering last page content', async ({ page }) => {
  for (const width of [320, 768, 1366]) {
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/board');
    const footer = page.locator('footer');
    await expect(footer.getByText('Problems move supply chains. AERA resolves them.')).toBeVisible();
    expect(await footer.evaluate(element => getComputedStyle(element).position)).toBe('fixed');
    await expect.poll(() => footer.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - innerHeight))).toBeLessThanOrEqual(1);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => footer.evaluate(element => Math.abs(element.getBoundingClientRect().bottom - innerHeight))).toBeLessThanOrEqual(1);
    const lastCard = page.locator('.bottom-grid');
    expect(await lastCard.evaluate(element => element.getBoundingClientRect().bottom)).toBeLessThanOrEqual(await footer.evaluate(element => element.getBoundingClientRect().top));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
