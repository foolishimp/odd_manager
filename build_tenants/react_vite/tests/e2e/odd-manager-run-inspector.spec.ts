import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ODD_GLC_ROOT = '/Users/jim/src/apps/odd_glc';

async function activeProjectRoot(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/projects/registry');
    const payload = await response.json();
    return {
      activeRoot: payload.diagnostic?.active_project_root ?? null,
      roots: Array.isArray(payload.projects) ? payload.projects.map((project: { root: string }) => project.root) : [],
    };
  });
}

async function activateProject(page: Page, root: string) {
  const ok = await page.evaluate(async (projectRoot) => {
    const response = await fetch('/api/projects/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ root: projectRoot, setActive: true }),
    });
    return response.ok;
  }, root);
  expect(ok).toBe(true);
}

async function closeWorkspaceChrome(page: Page) {
  const flyout = page.getByRole('complementary', { name: 'Sidecar selection flyout' });
  if (await flyout.isVisible().catch(() => false)) {
    await flyout.getByRole('button', { name: 'Close selection flyout' }).click();
  }
  const shell = page.getByRole('button', { name: 'Minimize shell workspace' });
  if (await shell.isVisible().catch(() => false)) await shell.click();
}

async function selectDataMapperRun(page: Page) {
  const runSelect = page.getByRole('combobox', { name: 'Select observed run' });
  await expect(runSelect).toBeVisible({ timeout: 30_000 });
  const option = runSelect.locator('option').filter({
    hasText: 'SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT',
  }).first();
  await expect(option).toHaveCount(1);
  const value = await option.getAttribute('value');
  if (!value) throw new Error('Data-mapper run option has no value');
  await runSelect.selectOption(value);
  await expect(
    page.getByRole('heading', { name: 'SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT' }),
  ).toBeVisible({ timeout: 30_000 });
}

test('registered local Project deep link opens a landing view and can target the data-mapper Run Inspector', async ({ page }) => {
  await page.goto('/');
  const initial = await activeProjectRoot(page);
  try {
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await expect(page.getByRole('banner')).toContainText(ODD_GLC_ROOT);
    await expect.poll(async () => (await activeProjectRoot(page)).activeRoot).toBe(ODD_GLC_ROOT);
    expect(new URL(page.url()).searchParams.get('project')).toBe(ODD_GLC_ROOT);
    await expect(page.getByRole('tab', { name: /AI Workspace/ })).toBeVisible();

    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}&view=run-inspector`);
    await selectDataMapperRun(page);
  } finally {
    if (initial.activeRoot) await activateProject(page, initial.activeRoot).catch(() => undefined);
  }
});

test('unregistered local Project deep link fails closed without changing the registry', async ({ page }) => {
  await page.goto('/');
  const initial = await activeProjectRoot(page);
  const unregisteredRoot = mkdtempSync(join(tmpdir(), 'odd-manager-deep-link-'));
  try {
    await page.goto(`/?project=${encodeURIComponent(unregisteredRoot)}`);
    await expect(page.getByRole('alert')).toContainText(`Project deep link is not registered: ${unregisteredRoot}`);
    await expect.poll(async () => (await activeProjectRoot(page)).activeRoot).toBe(initial.activeRoot);
    const registry = await activeProjectRoot(page);
    expect(registry.roots).not.toContain(unregisteredRoot);
  } finally {
    rmSync(unregisteredRoot, { recursive: true, force: true });
  }
});

test('generic Run Inspector recovers ABG operational capability from the odd_glc Project', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/');
  const initial = await activeProjectRoot(page);
  const wasRegistered = initial.roots.includes(ODD_GLC_ROOT);
  try {
    await activateProject(page, ODD_GLC_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    await selectDataMapperRun(page);
    await closeWorkspaceChrome(page);

    const run = page.locator('.sidecar-run');
    await expect(run).toContainText('4.6.0-rc.2');
    await expect(run).toContainText('4840 events');
    await expect(run).toContainText('28/30 closed');
    await expect(run.getByRole('button', { name: 'New run shell' })).toBeEnabled();
    await expect.poll(
      () => run.getByRole('combobox', { name: 'Select observed run' }).locator('option').count(),
    ).toBeGreaterThanOrEqual(3);

    const sections = run.locator('.sidecar-run__sections');
    await expect(sections.getByRole('button')).toHaveCount(12);

    await sections.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(run.locator('.sidecar-run__graph-node')).toHaveCount(28);
    await expect(run).toContainText('overlay://odd_glc/software-build-lifecycle');

    await sections.getByRole('button', { name: 'Traversal', exact: true }).click();
    await expect(run.locator('.sidecar-traversal__vector')).toHaveCount(28);
    await expect(run).toContainText('34 unknown event kinds');

    await sections.getByRole('button', { name: 'Functions', exact: true }).click();
    await expect(run).toContainText('graph-function://odd_glc/software-build/full-lifecycle');

    await sections.getByRole('button', { name: 'Catalog', exact: true }).click();
    const catalog = run.getByRole('region', { name: 'ABG catalog' });
    await expect(catalog).toBeVisible();
    await expect(catalog.getByLabel('ABG catalog summary')).toContainText('48');
    await expect(catalog.getByLabel('ABG catalog summary')).toContainText('192');
    await expect(catalog.locator('.sidecar-run__table tbody tr')).toHaveCount(48);
    await expect(catalog).toContainText('odd_glc.type.requirement_set');

    await catalog.getByRole('button', { name: 'graph function 1', exact: true }).click();
    await expect(catalog.locator('.sidecar-run__table tbody tr')).toHaveCount(1);
    await expect(catalog).toContainText('full-lifecycle');

    await catalog.getByRole('button', { name: 'All 48', exact: true }).click();
    await catalog.getByRole('searchbox', { name: 'Filter ABG catalog' }).fill('mutation_kill');
    await expect(catalog.locator('.sidecar-run__table tbody tr')).toHaveCount(1);
    await catalog.getByRole('searchbox', { name: 'Filter ABG catalog' }).clear();
    await expect(catalog.locator('.sidecar-run__table tbody tr')).toHaveCount(48);

    await sections.getByRole('button', { name: 'Assets', exact: true }).click();
    await expect(run.locator('.sidecar-run__table tbody tr')).toHaveCount(46);

    await sections.getByRole('button', { name: 'Diagnostics', exact: true }).click();
    await expect(run).toContainText('run_contains_retries');

    await sections.getByRole('button', { name: 'Assurance', exact: true }).click();
    await expect(run).toContainText('16/16');
    await expect(run).toContainText('22');
    await expect(run.locator('.sidecar-run__table tbody tr')).toHaveCount(8);

    await sections.getByRole('button', { name: 'Events', exact: true }).click();
    await expect(run.locator('.sidecar-run__event-kinds > div')).toHaveCount(40);
    await expect(run).toContainText('requirement_route_fact_projected');

    await sections.getByRole('button', { name: 'Stages', exact: true }).click();
    await expect(run.locator('.sidecar-run__table tbody tr')).toHaveCount(28);

    await sections.getByRole('button', { name: 'Transcripts', exact: true }).click();
    await expect(run.locator('.sidecar-run__transcripts details')).toHaveCount(27);

    await sections.getByRole('button', { name: 'Artifacts', exact: true }).click();
    await expect(run).toContainText('test-execution-result.json');
    await expect(run).toContainText('depth-proof-map.json');
    await expect(run).toContainText('mutation-outcomes.json');

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      runWidth: document.querySelector('.sidecar-run')?.scrollWidth ?? 0,
      runClientWidth: document.querySelector('.sidecar-run')?.clientWidth ?? 0,
    }));
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.runWidth).toBeLessThanOrEqual(layout.runClientWidth);
    expect(browserErrors).toEqual([]);
  } finally {
    if (initial.activeRoot) await activateProject(page, initial.activeRoot).catch(() => undefined);
    if (!wasRegistered) {
      await page.evaluate(async (root) => {
        await fetch('/api/projects/unregister', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root }),
        });
      }, ODD_GLC_ROOT).catch(() => undefined);
    }
  }
});

test('Run Inspector remains viewport-contained on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const initial = await activeProjectRoot(page);
  const wasRegistered = initial.roots.includes(ODD_GLC_ROOT);
  try {
    await activateProject(page, ODD_GLC_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    await expect(page.locator('.sidecar-run')).toBeVisible({ timeout: 30_000 });
    await closeWorkspaceChrome(page);
    const layout = await page.evaluate(() => {
      const run = document.querySelector('.sidecar-run');
      const sections = document.querySelector('.sidecar-run__sections');
      return {
        viewportWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        runWidth: run?.scrollWidth ?? 0,
        runClientWidth: run?.clientWidth ?? 0,
        sectionsWidth: sections?.scrollWidth ?? 0,
        sectionsClientWidth: sections?.clientWidth ?? 0,
      };
    });
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.runWidth).toBeLessThanOrEqual(layout.runClientWidth);
    expect(layout.sectionsWidth).toBeGreaterThan(layout.sectionsClientWidth);
  } finally {
    if (initial.activeRoot) await activateProject(page, initial.activeRoot).catch(() => undefined);
    if (!wasRegistered) {
      await page.evaluate(async (root) => {
        await fetch('/api/projects/unregister', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root }),
        });
      }, ODD_GLC_ROOT).catch(() => undefined);
    }
  }
});

test('AI Workspace indexes large Project evidence without false overlays or stretched groups', async ({ page }) => {
  await page.goto('/');
  const initial = await activeProjectRoot(page);
  const wasRegistered = initial.roots.includes(ODD_GLC_ROOT);
  try {
    await activateProject(page, ODD_GLC_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await page.getByRole('button', { name: 'Open AI Workspace' }).click();
    const workspace = page.locator('.sidecar-ai-workspace-view');
    await expect(workspace).toBeVisible({ timeout: 30_000 });
    await closeWorkspaceChrome(page);

    await expect(workspace).toContainText('artifacts');
    await expect(workspace.locator('.sidecar-ai-workspace-summary__feature').filter({ hasText: 'Domain Overlays' })).toContainText('missing');
    await expect(workspace.locator('.sidecar-ai-workspace-summary__artifact-group').filter({ hasText: 'Events' })).toContainText('event_log_jsonl');
    await expect(workspace).not.toContainText('jsonl_parse_failed');
    await expect(workspace).not.toContainText('62 domain_overlay');

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      groupHeights: [...document.querySelectorAll('.sidecar-ai-workspace-summary__artifact-group')]
        .map((element) => element.getBoundingClientRect().height),
    }));
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(Math.max(...layout.groupHeights)).toBeLessThan(450);
  } finally {
    if (initial.activeRoot) await activateProject(page, initial.activeRoot).catch(() => undefined);
    if (!wasRegistered) {
      await page.evaluate(async (root) => {
        await fetch('/api/projects/unregister', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ root }),
        });
      }, ODD_GLC_ROOT).catch(() => undefined);
    }
  }
});
