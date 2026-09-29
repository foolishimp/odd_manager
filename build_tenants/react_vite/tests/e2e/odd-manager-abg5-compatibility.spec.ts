import { expect, test, type Page } from '@playwright/test';

import {
  createExactAbi5RunFixture,
  exactAbi5ArtifactAvailable,
} from '../../qualification/abg5-run-fixture.mjs';

const ODD_GLC_V22_ROOT = '/Users/jim/src/apps/odd_glc-v22-v2-direct-on-disk-f028c71';
const MANAGER_PROJECT_ROOT = process.env.ODD_MANAGER_E2E_PROJECT_ROOT ?? '/Users/jim/src/apps/odd_manager';

async function registryState(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/projects/registry');
    const payload = await response.json();
    return {
      activeRoot: payload.diagnostic?.active_project_root ?? null,
      roots: Array.isArray(payload.projects)
        ? payload.projects.map((project: { root: string }) => project.root)
        : [],
    };
  });
}

async function activateProject(page: Page, root: string) {
  const result = await page.evaluate(async (projectRoot) => {
    const response = await fetch('/api/projects/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root: projectRoot, setActive: true }),
    });
    return { ok: response.ok, body: await response.text() };
  }, root);
  expect(result.ok, result.body).toBe(true);
}

async function closeWorkspaceChrome(page: Page) {
  const flyout = page.getByRole('complementary', { name: 'Sidecar selection flyout' });
  if (await flyout.isVisible().catch(() => false)) {
    await flyout.getByRole('button', { name: 'Close selection flyout' }).click();
  }
  const shell = page.getByRole('button', { name: 'Minimize shell workspace' });
  if (await shell.isVisible().catch(() => false)) await shell.click();
}

test('installed Run Inspector consumes the exact ABIogenesis 5.0 root envelope through paging and lazy detail', async ({ page }) => {
  test.skip(!exactAbi5ArtifactAvailable, 'exact ABIogenesis 5.0 artifact is unavailable');
  const fixture = await createExactAbi5RunFixture();
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/');
  const initial = await registryState(page);
  try {
    await activateProject(page, fixture.projectRoot);
    // Initial registry recovery belongs to test setup, not to the selected ABI
    // fixture. Scope browser diagnostics to the exact Project navigation.
    browserErrors.length = 0;
    await page.goto(`/?project=${encodeURIComponent(fixture.projectRoot)}`);
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    await closeWorkspaceChrome(page);

    const run = page.locator('.sidecar-run');
    const runSelect = run.getByRole('combobox', { name: 'Select observed run' });
    await expect(runSelect).toBeVisible({ timeout: 30_000 });
    const fixtureOption = runSelect.locator('option').filter({ hasText: 'SCN-ABI5-FIXTURE' }).first();
    await expect(fixtureOption).toHaveCount(1);
    const fixtureRunId = await fixtureOption.getAttribute('value');
    if (!fixtureRunId) throw new Error('exact ABIogenesis 5 fixture option has no run identity');
    await runSelect.selectOption(fixtureRunId);
    await expect(run.getByRole('heading', { name: 'SCN-ABI5-FIXTURE' })).toBeVisible({ timeout: 30_000 });
    await expect(run).toContainText('5.0.0-dev.286');
    await expect(run).toContainText('terminal converged');
    await expect(run).toContainText('abiogenesis_5_root');
    await expect(run).toContainText('abiogenesis 5 identity unconfirmed');
    await expect(run).toContainText('reconciled');

    await run.getByRole('button', { name: 'Events', exact: true }).click();
    const eventSection = run.locator('.sidecar-run__section');
    await expect(eventSection).toContainText('1–7 of 7');
    await expect(eventSection.locator('tbody tr')).toHaveCount(7);
    await eventSection.getByRole('button', { name: '1', exact: true }).click();
    await expect(eventSection.getByText('Event #1', { exact: true })).toBeVisible();
    await expect(eventSection).toContainText('run_segment_opened');
    await expect(eventSection).toContainText('payloadDigest');
    await expect(eventSection).toContainText('causationEventRefs');
    expect(browserErrors).toEqual([]);
  } finally {
    const restoreRoot = initial.activeRoot ?? MANAGER_PROJECT_ROOT;
    await activateProject(page, restoreRoot).catch(() => undefined);
    if (!initial.roots.includes(fixture.projectRoot)) {
      await page.evaluate(async (root) => {
        await fetch('/api/projects/unregister', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ root }),
        });
      }, fixture.projectRoot).catch(() => undefined);
    }
    fixture.cleanup();
  }
});

test('installed Run Inspector observes the latest stopped Data Mapper without proof or invented process liveness', async ({ page }) => {
  await page.goto('/');
  const initial = await registryState(page);
  const wasRegistered = initial.roots.includes(ODD_GLC_V22_ROOT);
  try {
    await activateProject(page, ODD_GLC_V22_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_V22_ROOT)}`);
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    await closeWorkspaceChrome(page);

    const run = page.locator('.sidecar-run');
    const runSelect = run.getByRole('combobox', { name: 'Select observed run' });
    await expect(runSelect).toBeVisible({ timeout: 30_000 });
    const dataMapper = runSelect.locator('option').filter({ hasText: 'SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT' }).first();
    await expect(dataMapper).toHaveCount(1);
    const runId = await dataMapper.getAttribute('value');
    if (!runId) throw new Error('latest Data Mapper option has no run identity');
    await runSelect.selectOption(runId);

    await expect(run.getByRole('heading', { name: 'SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT' })).toBeVisible({ timeout: 30_000 });
    await expect(run).toContainText('4.6.0-rc.3');
    await expect(run).toContainText('2061 events');
    await expect(run).toContainText('non terminal');
    await expect(run).toContainText('Process postureunavailable');
    await expect(run).toContainText('Proofabsent');
    await expect(run).toContainText('abiogenesis 4 6 legacy supported');

    await run.getByRole('button', { name: 'Events', exact: true }).click();
    const eventSection = run.locator('.sidecar-run__section');
    await expect(eventSection).toContainText('1–40 of 2061');
    await eventSection.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(eventSection).toContainText('41–80 of 2061');
    await eventSection.getByRole('button', { name: '40', exact: true }).click();
    await expect(eventSection.getByText('Event #40', { exact: true })).toBeVisible();
    await expect(eventSection).toContainText('requirement_route_fact_projected');
  } finally {
    const restoreRoot = initial.activeRoot ?? MANAGER_PROJECT_ROOT;
    await activateProject(page, restoreRoot).catch(() => undefined);
    if (!wasRegistered) {
      await page.evaluate(async (root) => {
        await fetch('/api/projects/unregister', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ root }),
        });
      }, ODD_GLC_V22_ROOT).catch(() => undefined);
    }
  }
});
