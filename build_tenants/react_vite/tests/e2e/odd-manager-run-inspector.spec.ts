import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ODD_GLC_ROOT = '/Users/jim/src/apps/odd_glc';
const CURRENT_BASIC_RUN = 'run://abiogenesis/1532cc77bce3e6ec8060dba1e5038123f32222de676979d3775ce0e8114f6ab5';
const CURRENT_RUST_RUN = 'run://abiogenesis/09822c42375f497e86c5306c9367d37c20b5e03d64d4c37402342755776bbf59';

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

async function selectObservedRun(page: Page, runId: string, scenarioId: string) {
  const runSelect = page.getByRole('combobox', { name: 'Select observed run' });
  await expect(runSelect).toBeVisible({ timeout: 30_000 });
  const option = runSelect.locator(`option[value="${runId}"]`);
  await expect(option).toHaveCount(1);
  await expect(option).toContainText(scenarioId);
  await runSelect.selectOption(runId);
  await expect(page.getByRole('heading', { name: scenarioId })).toBeVisible({ timeout: 30_000 });
  return runId;
}

test('registered local Project deep link opens a landing view and can target an exact Run Inspector candidate', async ({ page }) => {
  await page.goto('/');
  const initial = await activeProjectRoot(page);
  try {
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await expect(page.getByRole('banner')).toContainText(ODD_GLC_ROOT);
    await expect.poll(async () => (await activeProjectRoot(page)).activeRoot).toBe(ODD_GLC_ROOT);
    expect(new URL(page.url()).searchParams.get('project')).toBe(ODD_GLC_ROOT);
    await expect(page.getByRole('tab', { name: /AI Workspace/ })).toBeVisible();

    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}&view=run-inspector`);
    await selectObservedRun(page, CURRENT_BASIC_RUN, 'SCN-GLC-HELLO-WORLD-CLI-BASIC');
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

test('Run Inspector requires an exact current ABG 5 candidate and does not surface the legacy Data Mapper as selectable', async ({ page, request }) => {
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
    const requestBasis = async (generation: string | null) => {
      const params = new URLSearchParams({ workspaceRoot: ODD_GLC_ROOT, runId: CURRENT_RUST_RUN });
      if (generation !== null) params.set('generation', generation);
      const response = await request.get(`/api/ai-workspace/run/visual-graph?${params}`);
      const value = await response.json();
      return { status: response.status(), code: value.code ?? null };
    };
    const basisRejections = {
      missing: await requestBasis(null),
      malformed: await requestBasis('not-a-digest'),
      overlong: await requestBasis('x'.repeat(4097)),
    };
    expect(basisRejections).toEqual({
      missing: { status: 400, code: 'visual_graph_basis_required' },
      malformed: { status: 400, code: 'visual_graph_basis_invalid' },
      overlong: { status: 400, code: 'visual_graph_basis_invalid' },
    });
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    const run = page.locator('.sidecar-run');
    await expect(run.getByRole('heading', { name: 'Select an admitted run' })).toBeVisible({ timeout: 30_000 });
    await expect(run).toContainText('No default or latest projection is inferred');
    const candidateSelect = run.getByRole('combobox', { name: 'Select observed run' });
    await expect.poll(() => candidateSelect.locator('option').count()).toBeGreaterThanOrEqual(5);
    await expect(candidateSelect.locator('option').filter({ hasText: 'SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT' })).toHaveCount(0);
    await expect(run.getByRole('button', { name: 'New run shell' })).toHaveCount(0);
    await expect(run.getByRole('button', { name: 'Open run shell' })).toHaveCount(0);

    await selectObservedRun(page, CURRENT_BASIC_RUN, 'SCN-GLC-HELLO-WORLD-CLI-BASIC');
    await closeWorkspaceChrome(page);
    await expect(run).toContainText('external contract uninterpreted');
    await expect(run).toContainText('136 events');
    await expect(run).toContainText('abiogenesis_5_root');

    const sections = run.locator('.sidecar-run__sections');
    await expect(sections.getByRole('button')).toHaveCount(12);

    await sections.getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(run.getByRole('heading', { name: 'Occurrence history' })).toBeVisible({ timeout: 30_000 });
    await expect(run.locator('.visual-graph__node')).not.toHaveCount(0);
    await expect(run).toContainText('diagnostic only');

    await sections.getByRole('button', { name: 'Events', exact: true }).click();
    await expect(run).toContainText('1–40 of 136');
    await expect(run).toContainText('ABG 5_root');

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

test('T-040 Run Inspector renders the retained ABG 5 rust-cli occurrence projection without inventing topology or terminal control', async ({ page }) => {
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
    const visualResponsePromise = page.waitForResponse((response) => (
      new URL(response.url()).pathname === '/api/ai-workspace/run/visual-graph'
    ));
    const runId = await selectObservedRun(page, CURRENT_RUST_RUN, 'SCN-GLC-HELLO-WORLD-RUST-CLI');
    expect(runId).toMatch(/^run:\/\/abiogenesis\//u);
    const visualResponse = await visualResponsePromise;
    expect(visualResponse.status()).toBe(200);
    const visualRequestUrl = new URL(visualResponse.url());
    const projection = await visualResponse.json();
    expect(visualRequestUrl.searchParams.get('runId')).toBe(runId);
    expect(visualRequestUrl.searchParams.get('generation')).toBe(projection.run.eventGeneration);
    expect(projection.run.runId).toBe(runId);
    expect(projection.run.eventContract.publishedDigest).toBe('sha256:abbd5c43dfa219af37f971b318f3a2fdce861b79f5dfc023295c76e1879becc1');
    expect(projection.run.eventContract.builtInRegistryDigest).toBe('sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d');
    expect(projection.run.eventContract.publishedDigest).not.toBe(projection.run.eventContract.builtInRegistryDigest);
    expect(projection.occurrenceGraph.nodes).toHaveLength(30);
    expect(projection.workspaceObservations.observations).toHaveLength(4);
    expect(projection.actorSessions.sessions).toHaveLength(1);
    expect(projection.run.closed).toBe(false);
    expect(projection.run.eventPosture).toBe('external_contract_uninterpreted');
    expect(projection.actorSessions.sessions[0].lifecycleState).toBe('unknown');
    expect(projection.actorSessions.sessions[0].terminalDisposition).toBe('unknown');
    expect(projection.diagnostics.some((entry: { code?: string }) => (
      entry.code === 'external_event_contract_lifecycle_uninterpreted'
    ))).toBe(true);
    const serializedProjection = JSON.stringify(projection);
    for (const forbidden of ['file:', '/Users/', '"relativePath"', '"prompt"', '"args"', '"cwd"', '"stdout"']) {
      expect(serializedProjection).not.toContain(forbidden);
    }
    await closeWorkspaceChrome(page);

    const run = page.locator('.sidecar-run');
    await expect(run.getByRole('button', { name: 'New run shell' })).toHaveCount(0);
    await expect(run.getByRole('button', { name: 'Open run shell' })).toHaveCount(0);
    await run.locator('.sidecar-run__sections').getByRole('button', { name: 'Graph', exact: true }).click();

    const graph = run.locator('.visual-graph');
    await expect(graph.getByRole('heading', { name: 'Occurrence history' })).toBeVisible({ timeout: 30_000 });
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30);
    const spatialEdges = graph.locator('.visual-graph__edges > path');
    await expect.poll(() => spatialEdges.count()).toBeGreaterThan(0);
    const distinctColumns = await graph.locator('.visual-graph__node').evaluateAll((nodes) => (
      new Set(nodes.map((node) => (node as HTMLElement).style.left)).size
    ));
    expect(distinctColumns).toBeGreaterThan(1);
    await expect(graph.locator('.visual-graph__node[tabindex="0"]')).toHaveCount(1);
    await expect(graph.locator('.visual-graph__node[tabindex="-1"]')).toHaveCount(29);

    const firstRovingNode = graph.locator('.visual-graph__node[tabindex="0"]');
    const firstRovingLabel = await firstRovingNode.getAttribute('aria-label');
    await firstRovingNode.focus();
    await firstRovingNode.press('ArrowRight');
    const keyboardSelectedNode = graph.locator('.visual-graph__node[aria-pressed="true"]');
    await expect(keyboardSelectedNode).toBeFocused();
    await expect(keyboardSelectedNode).toHaveAttribute('aria-pressed', 'true');
    await expect(keyboardSelectedNode).not.toHaveAttribute('aria-label', firstRovingLabel ?? '');
    const keyboardSelectedLabel = await keyboardSelectedNode.locator('strong').textContent();
    await expect(graph.locator('[data-visual-graph-detail="open"]')).toHaveCount(0);
    await keyboardSelectedNode.press('Enter');
    const keyboardDetail = graph.locator('[data-visual-graph-detail="open"]');
    await expect(keyboardDetail).toBeFocused();
    await expect(graph.locator('.visual-graph__detail-heading > strong')).toHaveText(keyboardSelectedLabel ?? '');
    await keyboardDetail.press('Escape');
    await expect(graph.locator('[data-visual-graph-detail="open"]')).toHaveCount(0);
    await expect(keyboardSelectedNode).toBeFocused();

    await expect(graph).toContainText('occurrence graph below is not declaration topology');
    await expect(graph).toContainText('Product overlays: unavailable');
    const traceability = graph.getByRole('region', { name: 'Selected run event-contract traceability' });
    await expect(traceability).toContainText('Published event-contract digest');
    await expect(traceability).toContainText('Built-in registry digest');
    await expect(traceability).toContainText('published contract distinct from builtin registry');
    await expect(traceability).toContainText('durable prefix coordinate verified');
    await expect(traceability).toContainText('diagnostic only');
    await expect(traceability).toContainText('awaiting review');

    const lastObserved = graph.locator('.visual-graph__node[data-node-cue="last-observed"]');
    await expect(lastObserved).toHaveCount(1);
    await expect(lastObserved).toContainText('◆ LAST OBSERVED');
    await lastObserved.click();
    await expect(graph.locator('.visual-graph__detail')).toContainText('Exact relations');
    await expect(graph.locator('.visual-graph__node[tabindex="0"]')).toHaveCount(1);

    await graph.getByRole('button', { name: 'Zoom in' }).click();
    await expect(graph.getByLabel('Current graph zoom')).toHaveText('115%');
    await graph.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(graph.getByText('Accessible occurrence graph table.', { exact: false })).toBeVisible();
    await expect(graph.getByRole('region', { name: 'Scrollable occurrence graph table' })).toHaveAttribute('tabindex', '0');
    const occurrenceTable = graph.locator('.visual-graph__table').first();
    await expect(occurrenceTable.locator('tbody tr')).toHaveCount(30);
    const expectedOccurrenceRelationRows = projection.occurrenceGraph.edges.reduce((count: number, edge: { sourceNodeId: string; targetNodeId: string }) => (
      count + (edge.sourceNodeId === edge.targetNodeId ? 1 : 2)
    ), 0);
    await expect(occurrenceTable.locator('tbody td:last-child code')).toHaveCount(expectedOccurrenceRelationRows);
    await expect(occurrenceTable).toContainText('incoming aggregate parent');
    await expect(occurrenceTable).toContainText('outgoing aggregate parent');
    const tableSelection = graph.locator('.visual-graph__table button[tabindex="0"]');
    await tableSelection.focus();
    await tableSelection.press('End');
    const tableLast = graph.locator('.visual-graph__table button[aria-pressed="true"]:focus');
    await expect(tableLast).toBeFocused();
    await expect(tableLast).toHaveAttribute('aria-expanded', 'false');
    await tableLast.press('Enter');
    const tableDetail = graph.locator('[data-visual-graph-detail="open"]');
    await expect(tableDetail).toBeFocused();
    await tableDetail.getByRole('button', { name: 'Close detail' }).click();
    await expect(tableLast).toBeFocused();

    const workspaceTable = graph.getByRole('region', { name: 'Scrollable workspace observation table' });
    await expect(workspaceTable.locator('tbody tr')).toHaveCount(4);
    await expect(workspaceTable).toContainText('Predecessor phase (O0)');
    await expect(workspaceTable).toContainText('Successor phase (O1)');
    await expect(workspaceTable).toContainText('Mutable currentness');
    await expect(workspaceTable).toContainText('unobserved');
    const actorTable = graph.getByRole('region', { name: 'Scrollable actor session table' });
    await expect(actorTable.locator('tbody tr')).toHaveCount(1);
    await expect(actorTable).toContainText('Lifecycle state');
    await expect(actorTable).toContainText('Terminal disposition');
    await expect(actorTable).toContainText('Attach admitted');

    await expect(graph).toContainText('Observation 0');
    await expect(graph.locator('.visual-graph__session-list article')).toContainText('unknown');
    await expect(graph.locator('.visual-graph__session-list article')).not.toContainText('archive candidate');
    await expect(graph.getByRole('button', { name: 'Live interaction unavailable' })).toBeDisabled();
    await expect(graph.getByRole('button', { name: /attach|watch/i })).toHaveCount(0);
    const eventPosturePill = run.locator('.sidecar-run__pills .summary-pill').filter({ hasText: 'external contract uninterpreted' });
    await expect(eventPosturePill).toHaveClass(/sidecar-pill--default/u);
    await expect(eventPosturePill).not.toHaveClass(/sidecar-pill--lane-active/u);

    const layout = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      graphWidth: document.querySelector('.visual-graph')?.scrollWidth ?? 0,
      graphClientWidth: document.querySelector('.visual-graph')?.clientWidth ?? 0,
    }));
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.graphWidth).toBeLessThanOrEqual(layout.graphClientWidth);
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

test('T-040 same-Run refresh failure keeps the retained projection visibly stale and retry replaces the failed request', async ({ page }) => {
  let visualRequestCount = 0;
  let failNextRunObservation = false;
  let runObservationFailureCount = 0;
  await page.route(/\/api\/ai-workspace\/run\?/, async (route) => {
    if (failNextRunObservation) {
      failNextRunObservation = false;
      runObservationFailureCount += 1;
      const response = await route.fetch();
      const observation = await response.json();
      Object.assign(observation, {
        state: 'unsupported',
        selectedRunId: null,
        selectedRunKey: null,
        selectedRunRoot: null,
        selectedWorkspaceRoot: null,
        carrierSnapshot: null,
        eventPosture: 'invalid',
        processPosture: 'unavailable',
        proofReconciliation: { state: 'absent', sourceRef: null, conflicts: [], eventCount: null, eventDigest: null },
        compatibility: { posture: 'unknown', subject: null, reason: 'no admitted run event carrier' },
        systemReferences: [],
        substrate: null,
        activity: null,
        functions: [],
        assets: [],
        assurance: null,
        eventKinds: [],
        events: [],
        eventPage: null,
        stages: [],
        transcripts: [],
        artifacts: [],
        diagnostics: [{
          severity: 'warning',
          code: 'selected_run_missing',
          message: 'Fixture selected run disappeared from Project topology.',
        }],
      });
      await route.fulfill({
        response,
        contentType: 'application/json',
        body: JSON.stringify(observation),
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/api/ai-workspace/run/visual-graph?*', async (route) => {
    visualRequestCount += 1;
    if (visualRequestCount === 2) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'fixture visual refresh unavailable' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  const initial = await activeProjectRoot(page);
  const wasRegistered = initial.roots.includes(ODD_GLC_ROOT);
  try {
    await activateProject(page, ODD_GLC_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    await selectObservedRun(page, CURRENT_RUST_RUN, 'SCN-GLC-HELLO-WORLD-RUST-CLI');
    await closeWorkspaceChrome(page);
    const run = page.locator('.sidecar-run');
    await run.locator('.sidecar-run__sections').getByRole('button', { name: 'Graph', exact: true }).click();
    const graph = run.locator('.visual-graph');
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30, { timeout: 30_000 });

    await run.locator('.sidecar-run__header').getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => visualRequestCount).toBe(2);
    const staleBanner = graph.locator('.visual-graph__refresh-status--error');
    await expect(staleBanner).toContainText('retained projection remains visible as stale evidence');
    await expect(staleBanner).toContainText('not current for the requested basis');
    await expect(staleBanner).toContainText('retained sha256:');
    await expect(staleBanner).toContainText('requested sha256:');
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30);

    await staleBanner.getByRole('button', { name: 'Retry visual projection' }).click();
    await expect.poll(() => visualRequestCount).toBe(3);
    await expect(graph.locator('.visual-graph__refresh-status')).toHaveCount(0);
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30);

    failNextRunObservation = true;
    await run.locator('.sidecar-run__header').getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(() => runObservationFailureCount).toBe(1);
    expect(visualRequestCount).toBe(3);
    const runStaleBanner = run.locator('.sidecar-run__refresh-status');
    await expect(runStaleBanner).toContainText('Run observation refresh failed');
    await expect(runStaleBanner).toContainText('Retained run data remains interactive but is stale');
    await expect(runStaleBanner).toContainText('Fixture selected run disappeared from Project topology');
    const upstreamStaleBanner = graph.locator('.visual-graph__refresh-status--error[data-refresh-source="run-observation"]');
    await expect(upstreamStaleBanner).toContainText('no requested event generation was admitted');
    await expect(upstreamStaleBanner).toContainText('requested generation not admitted');
    await expect(upstreamStaleBanner).not.toContainText('requested sha256:');
    await expect(upstreamStaleBanner).toContainText('Fixture selected run disappeared from Project topology');
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30);

    const retainedNode = graph.locator('.visual-graph__node').first();
    await retainedNode.focus();
    await retainedNode.press('Enter');
    const retainedDetail = graph.locator('[data-visual-graph-detail="open"]');
    await expect(retainedDetail).toBeFocused();
    await retainedDetail.press('Escape');
    await expect(retainedNode).toBeFocused();

    await upstreamStaleBanner.getByRole('button', { name: 'Retry run observation' }).click();
    await expect.poll(() => visualRequestCount).toBe(4);
    await expect(run.locator('.sidecar-run__refresh-status')).toHaveCount(0);
    await expect(graph.locator('.visual-graph__refresh-status')).toHaveCount(0);
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30);
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

test('T-040 ready declaration projection remains switchable with occurrence history and filters only admitted product-overlay rows', async ({ page }) => {
  await page.route('**/api/ai-workspace/run/visual-graph?*', async (route) => {
    const response = await route.fetch();
    const projection = await response.json();
    projection.declarationTopology = {
      state: 'ready',
      reason: 'published_bodies_admitted',
      references: [
        { kind: 'graph', ref: 'graph://fixture/declared', sourceEvent: null },
        { kind: 'graph_function', ref: 'graph-function://fixture/declared', sourceEvent: null },
        { kind: 'overlay', ref: 'overlay://fixture/product', sourceEvent: null },
      ],
      nodes: [
        { id: 'urn:odd-manager:test-declaration:graph', kind: 'graph', label: 'Declared graph', declarationRef: 'graph://fixture/declared' },
        { id: 'urn:odd-manager:test-declaration:function', kind: 'graph_function', label: 'Declared function', declarationRef: 'graph-function://fixture/declared' },
        { id: 'urn:odd-manager:test-declaration:overlay', kind: 'overlay', label: 'Product overlay', declarationRef: 'overlay://fixture/product' },
      ],
      edges: [
        { id: 'urn:odd-manager:test-declaration:edge:vector', kind: 'declared_vector', sourceNodeId: 'urn:odd-manager:test-declaration:graph', targetNodeId: 'urn:odd-manager:test-declaration:function', declarationRef: 'graph-function://fixture/declared' },
        { id: 'urn:odd-manager:test-declaration:edge:overlay', kind: 'overlay_application', sourceNodeId: 'urn:odd-manager:test-declaration:overlay', targetNodeId: 'urn:odd-manager:test-declaration:graph', declarationRef: 'overlay://fixture/product' },
      ],
    };
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(projection) });
  });

  await page.goto('/');
  const initial = await activeProjectRoot(page);
  const wasRegistered = initial.roots.includes(ODD_GLC_ROOT);
  try {
    await activateProject(page, ODD_GLC_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
    await page.getByRole('button', { name: 'Open Run Inspector' }).click();
    await selectObservedRun(page, CURRENT_RUST_RUN, 'SCN-GLC-HELLO-WORLD-RUST-CLI');
    await closeWorkspaceChrome(page);
    const run = page.locator('.sidecar-run');
    await run.locator('.sidecar-run__sections').getByRole('button', { name: 'Graph', exact: true }).click();
    const graph = run.locator('.visual-graph');

    await expect(graph.getByRole('heading', { name: 'Declared topology' })).toBeVisible({ timeout: 30_000 });
    await expect(graph).toContainText('no declaration-to-occurrence join is admitted');
    await expect(graph.locator('.visual-graph__node[data-node-plane="declaration"]')).toHaveCount(3);
    await expect(graph.locator('.visual-graph__edges > path[data-edge-kind="declared_vector"]')).toHaveCount(1);
    await expect(graph.locator('.visual-graph__edges > path[data-edge-kind="overlay_application"]')).toHaveCount(1);

    await graph.getByLabel('Product overlay layer').uncheck();
    await expect(graph.locator('.visual-graph__node[data-node-kind="overlay"]')).toHaveCount(0);
    await expect(graph.locator('.visual-graph__node[data-node-plane="declaration"]')).toHaveCount(2);
    await expect(graph.locator('.visual-graph__edges > path[data-edge-kind="overlay_application"]')).toHaveCount(0);
    await expect(graph.locator('.visual-graph__edges > path[data-edge-kind="declared_vector"]')).toHaveCount(1);
    const filteredDeclarationEdgeCount = await graph.locator('.visual-graph__edges > path').count();

    await graph.getByRole('button', { name: 'Occurrence history', exact: true }).click();
    await expect(graph.getByRole('heading', { name: 'Occurrence history' })).toBeVisible();
    await expect(graph.locator('.visual-graph__node')).toHaveCount(30);
    await graph.getByRole('button', { name: 'Declaration', exact: true }).click();
    await graph.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(graph.getByText('Accessible declaration topology table.', { exact: false })).toBeVisible();
    await expect(graph.getByRole('region', { name: 'Scrollable declaration topology table' })).toHaveAttribute('tabindex', '0');
    const declarationTable = graph.locator('.visual-graph__table').first();
    await expect(declarationTable.locator('tbody tr')).toHaveCount(2);
    await expect(declarationTable.locator('tbody td:last-child code')).toHaveCount(filteredDeclarationEdgeCount * 2);
    await expect(declarationTable).toContainText('incoming declared vector');
    await expect(declarationTable).toContainText('outgoing declared vector');
    const firstDeclarationRow = graph.locator('.visual-graph__table button[tabindex="0"]');
    await firstDeclarationRow.focus();
    await firstDeclarationRow.press('End');
    const selectedDeclarationRow = graph.locator('.visual-graph__table button[aria-pressed="true"]:focus');
    await expect(selectedDeclarationRow).toBeFocused();
    await selectedDeclarationRow.press('Enter');
    const declarationDetail = graph.locator('[data-visual-graph-detail="open"]');
    await expect(declarationDetail).toBeFocused();
    await declarationDetail.press('Escape');
    await expect(selectedDeclarationRow).toBeFocused();
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
    await selectObservedRun(page, CURRENT_RUST_RUN, 'SCN-GLC-HELLO-WORLD-RUST-CLI');
    await closeWorkspaceChrome(page);
    const run = page.locator('.sidecar-run');
    await run.locator('.sidecar-run__sections').getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(run.getByRole('heading', { name: 'Occurrence history' })).toBeVisible({ timeout: 30_000 });
    const layout = await page.evaluate(() => {
      const run = document.querySelector('.sidecar-run');
      const sections = document.querySelector('.sidecar-run__sections');
      const graph = document.querySelector('.visual-graph');
      const viewport = document.querySelector('.visual-graph__viewport');
      const graphRect = graph?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        runWidth: run?.scrollWidth ?? 0,
        runClientWidth: run?.clientWidth ?? 0,
        sectionsWidth: sections?.scrollWidth ?? 0,
        sectionsClientWidth: sections?.clientWidth ?? 0,
        graphWidth: graph?.scrollWidth ?? 0,
        graphClientWidth: graph?.clientWidth ?? 0,
        graphLeft: graphRect?.left ?? -1,
        graphRight: graphRect?.right ?? Number.POSITIVE_INFINITY,
        graphViewportWidth: viewport?.scrollWidth ?? 0,
        graphViewportClientWidth: viewport?.clientWidth ?? 0,
      };
    });
    expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.runWidth).toBeLessThanOrEqual(layout.runClientWidth);
    expect(layout.sectionsWidth).toBeGreaterThan(layout.sectionsClientWidth);
    expect(layout.graphWidth).toBeLessThanOrEqual(layout.graphClientWidth);
    expect(layout.graphLeft).toBeGreaterThanOrEqual(0);
    expect(layout.graphRight).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.graphViewportWidth).toBeGreaterThan(layout.graphViewportClientWidth);

    const graph = run.locator('.visual-graph');
    await graph.getByRole('button', { name: 'Table', exact: true }).click();
    const tableRegion = graph.getByRole('region', { name: 'Scrollable occurrence graph table' });
    await expect(tableRegion).toBeVisible();
    const tableButton = graph.locator('.visual-graph__table button[tabindex="0"]');
    await tableButton.focus();
    await tableButton.press('Enter');
    const detail = graph.locator('[data-visual-graph-detail="open"]');
    await expect(detail).toBeFocused();
    const tableLayout = await page.evaluate(() => {
      const graph = document.querySelector('.visual-graph');
      const table = document.querySelector('.visual-graph__table-scroll');
      const detail = document.querySelector('[data-visual-graph-detail="open"]');
      const graphRect = graph?.getBoundingClientRect();
      const detailRect = detail?.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        bodyWidth: document.body.scrollWidth,
        graphWidth: graph?.scrollWidth ?? 0,
        graphClientWidth: graph?.clientWidth ?? 0,
        graphLeft: graphRect?.left ?? -1,
        graphRight: graphRect?.right ?? Number.POSITIVE_INFINITY,
        tableWidth: table?.scrollWidth ?? 0,
        tableClientWidth: table?.clientWidth ?? 0,
        detailLeft: detailRect?.left ?? -1,
        detailRight: detailRect?.right ?? Number.POSITIVE_INFINITY,
      };
    });
    expect(tableLayout.bodyWidth).toBeLessThanOrEqual(tableLayout.viewportWidth);
    expect(tableLayout.graphWidth).toBeLessThanOrEqual(tableLayout.graphClientWidth);
    expect(tableLayout.graphLeft).toBeGreaterThanOrEqual(0);
    expect(tableLayout.graphRight).toBeLessThanOrEqual(tableLayout.viewportWidth);
    expect(tableLayout.tableWidth).toBeGreaterThan(tableLayout.tableClientWidth);
    expect(tableLayout.detailLeft).toBeGreaterThanOrEqual(0);
    expect(tableLayout.detailRight).toBeLessThanOrEqual(tableLayout.viewportWidth);
    await detail.press('Escape');
    await expect(tableButton).toBeFocused();
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
