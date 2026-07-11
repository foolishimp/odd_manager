// B-014 — executable UX_METHOD Msg-replay proof for SidecarPanel state.
//
// Loads the actual TypeScript state module, transpiles it in memory, and
// replays product-meaningful Msg logs without DOM, network, refs, timers, or
// component closures.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const stateModulePath = resolve(here, '../../src/features/sidecar/sidecar-state.ts');
const sidecarPanelPath = resolve(here, '../../src/features/sidecar/SidecarPanel.tsx');
const workspaceRoutePath = resolve(here, '../../src/routes/WorkspaceRoute.tsx');
const developerControlHostPath = resolve(here, '../../src/capabilities/host/DeveloperControlHost.tsx');
const buildPortfolioViewPath = resolve(here, '../../src/capabilities/build-portfolio/view.tsx');
const buildPortfolioStatePath = resolve(here, '../../src/capabilities/build-portfolio/state.ts');
const buildPortfolioRuntimePath = resolve(here, '../../src/effects/command-runtime/build-portfolio-command-runtime.ts');
const appShellPath = resolve(here, '../../src/layout/AppShell.tsx');
const serverIndexPath = resolve(here, '../../src/server/index.mjs');
const collaborationPath = resolve(here, '../../src/lib/collaboration.ts');
const stylesPath = resolve(here, '../../src/app/styles.css');
const documentViewerPath = resolve(here, '../../src/components/DocumentViewer.tsx');

async function loadStateModule() {
  const source = readFileSync(stateModulePath, 'utf-8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const encoded = Buffer.from(compiled, 'utf-8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function baseState(module) {
  return {
    ...module.INITIAL_SIDECAR_STATE,
    loading: false,
    context: {
      project: { id: 'odd_manager', root: '/workspace/odd_manager', odd_type: 'unknown' },
      workspace: { id: 'react_vite', profile: 'unknown' },
      session: null,
    },
    projects: [
      {
        id: 'odd_manager',
        root: '/workspace/odd_manager',
        odd_type: 'unknown',
        has_ai_workspace: true,
        has_genesis: true,
        installed_packages: [],
        build_tenants: ['react_vite'],
      },
      {
        id: 'data_mapper',
        root: '/workspace/data_mapper',
        odd_type: 'unknown',
        has_ai_workspace: true,
        has_genesis: true,
        installed_packages: [],
        build_tenants: ['scala_sbt'],
      },
    ],
    tickets: [
      { id: 'T-100', title: 'Fix mapping', lane: 'active', status: 'active' },
    ],
    comments: [
      { id: 'codex/20260427T010101Z_REVIEW_note', author: 'codex', filename: 'note.md' },
    ],
    sessions: {
      records: [{ id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' }],
      diagnostic: { backplane: 'registry' },
    },
    unreadIds: ['codex/20260427T010101Z_REVIEW_note'],
  };
}

function observationFor(projectRoot, featureState = 'present') {
  return {
    kind: 'ai_workspace_observation',
    version: 1,
    generatedAt: '2026-07-01T00:00:00.000Z',
    projectRoot,
    aiWorkspaceRoot: `${projectRoot}/.ai-workspace`,
    readOnly: true,
    features: [
      {
        id: 'ai_workspace',
        label: '.ai-workspace',
        state: featureState,
        relativePath: '.ai-workspace',
        sourceRefs: featureState === 'present' ? ['.ai-workspace'] : [],
        artifactCount: 0,
        capabilities: featureState === 'present' ? ['browse.raw'] : [],
        diagnostics: [],
      },
    ],
    artifacts: [],
    capabilities: featureState === 'present' ? ['browse.raw'] : [],
    diagnostics: {
      projectRoot,
      aiWorkspaceRoot: `${projectRoot}/.ai-workspace`,
      scannedDirectoryCount: 0,
      scannedFileCount: 0,
      maxDirectories: 1,
      maxArtifacts: 1,
      truncated: false,
      ignoredNames: [],
    },
  };
}

function readSidecarCssBlock() {
  const styles = readFileSync(stylesPath, 'utf-8');
  const start = styles.indexOf('.sidecar-panel');
  const end = styles.indexOf('.agent-console__room-chip', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return styles.slice(start, end);
}

test('project selection replays to new Context and emits load Cmd', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'select', kind: 'project', id: 'data_mapper' },
  ]);
  assert.equal(result.state.selection.kind, 'project');
  assert.equal(result.state.selection.id, 'data_mapper');
  assert.equal(result.state.context.project.root, '/workspace/data_mapper');
  assert.deepEqual(result.commands, [
    { type: 'load', projectRoot: '/workspace/data_mapper', reason: 'project_selected' },
  ]);
});

test('stale project load result cannot overwrite a newer requested root', async () => {
  const module = await loadStateModule();
  const requested = module.replaySidecarMessages(baseState(module), [
    { type: 'load/request', projectRoot: '/workspace/data_mapper', reason: 'project_selected' },
  ]).state;

  const stale = module.updateSidecarState(requested, {
    type: 'load/done',
    projectRoot: '/workspace/odd_manager',
    payload: {
      context: {
        project: { id: 'odd_manager', root: '/workspace/odd_manager', odd_type: 'unknown' },
        workspace: { id: 'react_vite', profile: 'unknown' },
        session: null,
      },
      tickets: [{ id: 'STALE', title: 'stale ticket', lane: 'active', status: 'active' }],
      aiWorkspaceObservation: observationFor('/workspace/odd_manager'),
    },
  });
  assert.equal(stale.context.project.root, '/workspace/odd_manager');
  assert.equal(stale.activeLoadRoot, '/workspace/data_mapper');
  assert.deepEqual(stale.tickets, requested.tickets);
  assert.equal(stale.aiWorkspaceObservation, requested.aiWorkspaceObservation);

  const current = module.updateSidecarState(stale, {
    type: 'load/done',
    projectRoot: '/workspace/data_mapper',
    payload: {
      context: {
        project: { id: 'data_mapper', root: '/workspace/data_mapper', odd_type: 'unknown' },
        workspace: { id: 'scala_sbt', profile: 'unknown' },
        session: null,
      },
      tickets: [{ id: 'CURRENT', title: 'current ticket', lane: 'active', status: 'active' }],
      aiWorkspaceObservation: observationFor('/workspace/data_mapper'),
    },
  });
  assert.equal(current.context.project.root, '/workspace/data_mapper');
  assert.equal(current.activeLoadRoot, null);
  assert.equal(current.tickets[0].id, 'CURRENT');
  assert.equal(current.aiWorkspaceObservation.projectRoot, '/workspace/data_mapper');
  assert.equal(current.aiWorkspaceObservation.features[0].state, 'present');
});

test('ticket transition request and result replay exposes transition Cmd and reload intent', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ticket/transition/request', id: 'T-100', toLane: 'completed' },
    { type: 'action/result', ok: true, message: 'T-100: active -> completed', reload: true },
  ]);
  assert.deepEqual(result.commands, [
    { type: 'ticket.transition', id: 'T-100', toLane: 'completed', projectRoot: '/workspace/odd_manager' },
    { type: 'load', projectRoot: '/workspace/odd_manager', reason: 'action_completed' },
  ]);
  assert.deepEqual(result.state.lastAction, { ok: true, message: 'T-100: active -> completed', error: undefined });
});

test('comment reply draft, submit request, result, and cancel replay deterministically', async () => {
  const module = await loadStateModule();
  const parentId = 'codex/20260427T010101Z_REVIEW_note';
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'reply/open', parentId },
    { type: 'reply/edit', body: 'reply body' },
    { type: 'reply/submit/request', parentId, body: 'reply body' },
    { type: 'action/result', ok: true, message: 'reply created', reload: true },
    { type: 'reply/cancel' },
  ]);
  assert.deepEqual(result.commands, [
    { type: 'comment.reply', parentId, body: 'reply body', projectRoot: '/workspace/odd_manager' },
    { type: 'load', projectRoot: '/workspace/odd_manager', reason: 'action_completed' },
  ]);
  assert.equal(result.state.replyDraft, null);
  assert.deepEqual(result.state.lastAction, { ok: true, message: 'reply created', error: undefined });
});

test('path history copy request appends recent path and emits clipboard Cmd', async () => {
  const module = await loadStateModule();
  const entry = {
    absolutePath: '/workspace/odd_manager/specification/PRODUCT.md',
    projectRoot: '/workspace/odd_manager',
    relativePath: 'specification/PRODUCT.md',
    source: 'provider',
    timestamp: '2026-04-29T00:00:00.000Z',
  };
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'path-history/copy-request', entry },
  ]);
  assert.deepEqual(result.commands, [
    { type: 'clipboard.write', text: entry.absolutePath, label: entry.relativePath },
  ]);
  assert.deepEqual(result.state.pathHistory, [entry]);
});

test('path history dedupes, moves latest to front, and keeps bounded retention', async () => {
  const module = await loadStateModule();
  const messages = Array.from({ length: module.SIDECAR_PATH_HISTORY_LIMIT + 4 }, (_, index) => ({
    type: 'path-history/copy-request',
    entry: {
      absolutePath: `/workspace/odd_manager/file-${index}.md`,
      projectRoot: '/workspace/odd_manager',
      relativePath: `file-${index}.md`,
      source: 'browse',
      timestamp: `2026-04-29T00:00:${String(index).padStart(2, '0')}.000Z`,
    },
  }));
  messages.push({
    type: 'path-history/copy-request',
    entry: {
      absolutePath: '/workspace/odd_manager/file-10.md',
      projectRoot: '/workspace/odd_manager',
      relativePath: 'file-10.md',
      source: 'history',
      timestamp: '2026-04-29T00:01:00.000Z',
    },
  });

  const result = module.replaySidecarMessages(baseState(module), messages);
  assert.equal(result.state.pathHistory.length, module.SIDECAR_PATH_HISTORY_LIMIT);
  assert.equal(result.state.pathHistory[0].absolutePath, '/workspace/odd_manager/file-10.md');
  assert.equal(
    result.state.pathHistory.filter((entry) => entry.absolutePath === '/workspace/odd_manager/file-10.md').length,
    1,
  );
});

test('session spawn and kill replay exposes session Cmds with current project root', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'session/spawn/request' },
    { type: 'action/result', ok: true, message: 'spawned sess-2', reload: true },
    { type: 'select', kind: 'session', id: 'sess-1' },
    { type: 'session/kill/request', id: 'sess-1' },
    { type: 'action/result', ok: true, message: 'killed sess-1', reload: true },
  ]);
  assert.deepEqual(result.commands, [
    { type: 'session.spawn', projectRoot: '/workspace/odd_manager', groupId: 'main', cwd: null, label: null },
    { type: 'load', projectRoot: '/workspace/odd_manager', reason: 'action_completed' },
    { type: 'session.kill', id: 'sess-1', projectRoot: '/workspace/odd_manager' },
    { type: 'load', projectRoot: '/workspace/odd_manager', reason: 'action_completed' },
  ]);
  assert.equal(result.state.selection.kind, 'session');
  assert.equal(result.state.selection.id, 'sess-1');
});

test('workspace collapse replay changes UI state without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/set-info-pinned', pinned: true },
    { type: 'ui/toggle-workspace', workspace: 'info', collapsed: true },
    { type: 'ui/toggle-workspace', workspace: 'shell', collapsed: true },
    { type: 'ui/toggle-workspace', workspace: 'info', collapsed: false },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.infoCollapsed, false);
  assert.equal(result.state.ui.infoPinned, false);
  assert.equal(result.state.ui.shellCollapsed, true);
});

test('fresh Sidecar state keeps the terminal dock collapsed until explicitly restored', async () => {
  const module = await loadStateModule();
  assert.equal(module.INITIAL_SIDECAR_STATE.ui.shellCollapsed, true);
  const restored = module.replaySidecarMessages(module.INITIAL_SIDECAR_STATE, [
    { type: 'ui/toggle-workspace', workspace: 'shell', collapsed: false },
  ]);
  assert.deepEqual(restored.commands, []);
  assert.equal(restored.state.ui.shellCollapsed, false);
});

test('selection flyout pin replay opens the browser without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/toggle-workspace', workspace: 'info', collapsed: true },
    { type: 'ui/set-info-pinned', pinned: true },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.infoCollapsed, false);
  assert.equal(result.state.ui.infoPinned, true);
});

test('section minimize and restore replay independently without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/toggle-workspace', workspace: 'info', collapsed: true },
    { type: 'ui/toggle-workspace', workspace: 'shell', collapsed: true },
    { type: 'ui/toggle-workspace', workspace: 'info' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.infoCollapsed, false);
  assert.equal(result.state.ui.shellCollapsed, true);
});

test('terminal hide CSS reclaims the expanded bottom dock row', () => {
  const styles = readFileSync(stylesPath, 'utf-8');
  assert.match(
    styles,
    /\.shell--sidecar\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);[^}]*height:\s*100vh;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    styles,
    /\.shell--sidecar\s+\.route-wrap\s*\{[^}]*gap:\s*0;[^}]*min-height:\s*0;/s,
  );
  assert.match(
    styles,
    /\.shell--sidecar\s+\.workspace-view--sidecar,\s*\.shell--sidecar\s+\.sidecar-panel--workbench,\s*\.shell--sidecar\s+\.sidecar-workbench\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
  );
  assert.match(
    styles,
    /\.sidecar-workbench\.is-bottom-collapsed\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto;/s,
  );
  assert.doesNotMatch(
    styles,
    /\.sidecar-workbench\.is-bottom-collapsed\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(10rem,\s*1fr\)\s+minmax\(34rem,\s*68vh\)/s,
  );
});

test('section chrome commands are consolidated into the right rail', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');
  const railSource = source.slice(
    source.indexOf('<aside className="sidecar-context-rail"'),
    source.indexOf('<section className="sidecar-bottom-dock"'),
  );
  assert.doesNotMatch(source, /sidecar-section-controls/);
  assert.doesNotMatch(styles, /\.sidecar-section-controls\s*\{/);
  assert.doesNotMatch(railSource, /Restore info browser|Minimize info browser/);
  assert.match(railSource, /<ContextRailCommand[\s\S]*label=\{state\.ui\.shellCollapsed \? 'Restore shell workspace' : 'Minimize shell workspace'\}/);
  assert.match(railSource, /<ContextRailCommand[\s\S]*label="Reset sidecar layout"/);
  assert.match(styles, /\.sidecar-context-rail__command\s*\{/);
});

test('workbench resize replay updates layout state without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/resize-start', target: 'explorer', pointerId: 7, clientX: 100, clientY: 200 },
    { type: 'ui/resize-preview', target: 'explorer', valuePx: 448 },
    { type: 'ui/resize-commit', target: 'explorer', valuePx: 472 },
    { type: 'ui/resize-by', target: 'contextRail', deltaPx: 48 },
    { type: 'ui/resize-by', target: 'bottomDock', deltaPx: -80 },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.workbenchLayout.explorerWidthPx, 472);
  assert.equal(result.state.ui.workbenchLayout.contextRailWidthPx, 120);
  assert.equal(result.state.ui.workbenchLayout.bottomDockHeightPx, 464);
  assert.equal(result.state.ui.workbenchLayout.activeResize, null);
});

test('workbench resize replay clamps values and resets by target without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/resize-preview', target: 'explorer', valuePx: 9999 },
    { type: 'ui/resize-preview', target: 'contextRail', valuePx: -1 },
    { type: 'ui/resize-preview', target: 'bottomDock', valuePx: Number.NaN },
    { type: 'ui/resize-reset', target: 'explorer' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.workbenchLayout.explorerWidthPx, 384);
  assert.equal(result.state.ui.workbenchLayout.contextRailWidthPx, 64);
  assert.equal(result.state.ui.workbenchLayout.bottomDockHeightPx, 544);
  assert.equal(result.state.ui.workbenchLayout.activeResize, null);
});

test('bottom dock resize crosses collapse and restore thresholds without Cmd effects', async () => {
  const module = await loadStateModule();
  const collapsed = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/resize-start', target: 'bottomDock', pointerId: 7, clientX: 100, clientY: 200 },
    { type: 'ui/resize-preview', target: 'bottomDock', valuePx: 150 },
    { type: 'ui/resize-commit', target: 'bottomDock', valuePx: 150 },
  ]);
  assert.deepEqual(collapsed.commands, []);
  assert.equal(collapsed.state.ui.shellCollapsed, true);
  assert.equal(collapsed.state.ui.workbenchLayout.bottomDockHeightPx, 150);
  assert.equal(collapsed.state.ui.workbenchLayout.activeResize, null);

  const restored = module.replaySidecarMessages(collapsed.state, [
    { type: 'ui/resize-start', target: 'bottomDock', pointerId: 8, clientX: 100, clientY: 200 },
    { type: 'ui/resize-commit', target: 'bottomDock', valuePx: 260 },
  ]);
  assert.deepEqual(restored.commands, []);
  assert.equal(restored.state.ui.shellCollapsed, false);
  assert.equal(restored.state.ui.workbenchLayout.bottomDockHeightPx, 360);
});

test('workbench resize CSS consumes reducer-owned layout variables and exposes handles', () => {
  const styles = readFileSync(stylesPath, 'utf-8');
  assert.match(styles, /grid-template-columns:\s*3\.35rem\s+minmax\(0,\s*1fr\)\s+3\.25rem;/s);
  assert.match(styles, /grid-template-rows:\s*minmax\(10rem,\s*1fr\)\s+clamp\(7\.5rem,\s*var\(--sidecar-bottom-dock-height,\s*34rem\),\s*72vh\);/s);
  assert.match(styles, /width:\s*min\(var\(--sidecar-explorer-width,\s*24rem\),\s*calc\(100%\s*-\s*1\.5rem\)\);/s);
  assert.match(styles, /\.sidecar-resize-handle--vertical\s*\{/s);
  assert.match(styles, /\.sidecar-resize-handle--horizontal\s*\{/s);
});

test('layout profile load validates and applies persisted workbench state without Cmd effects', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const persistedState = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/resize-preview', target: 'explorer', valuePx: 512 },
    { type: 'ui/resize-preview', target: 'contextRail', valuePx: 128 },
    { type: 'ui/select-info-surface', surface: 'comments' },
    { type: 'ui/set-info-pinned', pinned: true },
    { type: 'session/select', id: 'sess-1' },
  ]).state;
  const profile = module.sidecarLayoutProfileFromState(persistedState, contextKey);
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'layout/profile-loaded', contextKey, payload: profile },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.workbenchLayout.explorerWidthPx, 512);
  assert.equal(result.state.ui.workbenchLayout.contextRailWidthPx, 128);
  assert.equal(result.state.ui.activeInfoSurface, 'comments');
  assert.equal(result.state.ui.infoPinned, true);
  assert.equal(result.state.ui.terminalWorkspace.groups[0].activeTabId, 'session:sess-1');
});

test('layout profile load preserves the actively selected viewer object', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const emptyProfile = module.sidecarLayoutProfileFromState(baseState(module), contextKey);
  const selected = module.replaySidecarMessages(baseState(module), [
    { type: 'select', kind: 'project', id: 'odd_manager' },
  ]).state;

  const result = module.replaySidecarMessages(selected, [
    { type: 'layout/profile-loaded', contextKey, payload: emptyProfile },
  ]);

  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'project');
  assert.equal(result.state.selection.id, 'odd_manager');
  assert.equal(result.state.ui.viewerWorkspace.groups[0].activeTabId, 'project:odd_manager');
  assert.ok(result.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'project:odd_manager'));
});

test('layout profile migration drops retired viewer tabs without erasing operator layout', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const profile = module.sidecarLayoutProfileFromState(baseState(module), contextKey);
  profile.ui.workbenchLayout.explorerWidthPx = 512;
  profile.ui.viewerWorkspace.tabs.push({ id: 'process:navigator', kind: 'process', objectId: 'navigator' });
  profile.ui.viewerWorkspace.groups[0].tabIds.push('process:navigator');
  profile.ui.viewerWorkspace.groups[0].activeTabId = 'process:navigator';

  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'layout/profile-loaded', contextKey, payload: profile },
  ]);

  assert.deepEqual(result.commands, []);
  assert.equal(result.state.lastAction, null);
  assert.equal(result.state.ui.workbenchLayout.explorerWidthPx, 512);
  assert.equal(result.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'process:navigator'), false);
  assert.equal(result.state.ui.viewerWorkspace.groups[0].activeTabId, null);
});

test('document viewer zoom state is scoped to surface tabs and persists in layout profiles', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'surface', id: 'specification/PRODUCT.md' },
    { type: 'document/zoom', tabId: 'surface:specification/PRODUCT.md', delta: 0.15 },
    { type: 'document/zoom', tabId: 'surface:specification/PRODUCT.md', delta: 0.15 },
    { type: 'document/fit-width', tabId: 'surface:specification/PRODUCT.md' },
    { type: 'document/zoom', tabId: 'ticket:T-100', delta: 1 },
  ]);
  assert.deepEqual(result.commands, []);
  assert.deepEqual(result.state.ui.documentViewers, {
    'surface:specification/PRODUCT.md': { zoom: 1, fit: 'width' },
  });

  const zoomed = module.replaySidecarMessages(result.state, [
    { type: 'document/zoom', tabId: 'surface:specification/PRODUCT.md', delta: 0.15 },
  ]);
  assert.deepEqual(zoomed.state.ui.documentViewers['surface:specification/PRODUCT.md'], { zoom: 1.15, fit: 'none' });

  const profile = module.sidecarLayoutProfileFromState(zoomed.state, contextKey);
  assert.deepEqual(profile.ui.documentViewers['surface:specification/PRODUCT.md'], { zoom: 1.15, fit: 'none' });

  const restored = module.replaySidecarMessages(baseState(module), [
    { type: 'layout/profile-loaded', contextKey, payload: profile },
  ]);
  assert.deepEqual(restored.state.ui.documentViewers['surface:specification/PRODUCT.md'], { zoom: 1.15, fit: 'none' });

  const closed = module.replaySidecarMessages(restored.state, [
    { type: 'viewer/close-tab', groupId: 'main', tabId: 'surface:specification/PRODUCT.md' },
  ]);
  assert.deepEqual(closed.state.ui.documentViewers, {});
});

test('shared document viewer adapter governs Markdown, code, HTML, PDF, and selectable text', () => {
  const source = readFileSync(documentViewerPath, 'utf-8');
  const sidecarSource = readFileSync(sidecarPanelPath, 'utf-8');
  const serverSource = readFileSync(serverIndexPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');

  assert.match(source, /export type DocumentViewerScrollMode = "internal" \| "outer"/);
  assert.match(source, /export type DocumentViewerFormat = "markdown" \| "code" \| "html" \| "pdf" \| "text"/);
  assert.match(source, /export interface DocumentViewerSurfacePicker/);
  assert.match(source, /mediaType:\s*mediaTypeForDocumentFormat\(format,\s*extension\)/);
  assert.match(source, /extension === "\.html" \|\| extension === "\.htm"/);
  assert.match(source, /extension === "\.pdf"/);
  assert.match(source, /scrollMode = "internal"/);
  assert.match(source, /followAppends = false/);
  assert.match(source, /tailFollowAvailable = false/);
  assert.match(source, /tailFollowEnabled = false/);
  assert.match(source, /rawModeAvailable = false/);
  assert.match(source, /rawModeEnabled = false/);
  assert.match(source, /document-viewer--outer-scroll/);
  assert.match(source, /function HtmlDocumentContent/);
  assert.match(source, /sandbox="allow-same-origin"/);
  assert.match(source, /srcDoc=\{content\}/);
  assert.match(source, /viewport\.addEventListener\("wheel",\s*handleNativeWheel,\s*\{\s*passive:\s*false,\s*capture:\s*true\s*\}\)/);
  assert.match(source, /viewport\.removeEventListener\("wheel",\s*handleNativeWheel,\s*\{\s*capture:\s*true\s*\}\)/);
  assert.match(source, /frameWindow\.addEventListener\("wheel",\s*handleFrameWheel,\s*\{\s*passive:\s*false,\s*capture:\s*true\s*\}\)/);
  assert.match(source, /function PdfDocumentContent/);
  assert.match(source, /src=\{sourceUrl\}/);
  assert.match(source, /DOCUMENT_PINCH_ZOOM_SENSITIVITY/);
  assert.match(source, /function handlePinchZoom/);
  assert.match(source, /descriptor\.format === "pdf"/);
  assert.match(source, /onZoomBy\(delta\)/);
  assert.match(source, /securityLevel:\s*"strict"/);
  assert.match(source, /flowchart:\s*\{\s*htmlLabels:\s*false\s*\}/);
  assert.match(source, /stableHash\(`\$\{descriptorId\}:\$\{blockIndex\}:\$\{source\}`\)/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /import\(["']shiki["']\)/);
  for (const language of ['typescript', 'tsx', 'javascript', 'jsx', 'json', 'yaml', 'java', 'scala', 'rust', 'markdown']) {
    assert.match(source, new RegExp(`${language}: \\(\\) => import\\("@shikijs/langs/${language}"\\)`));
  }
  assert.match(source, /"github-light":\s*\(\) => import\("@shikijs\/themes\/github-light"\)/);
  assert.match(source, /"github-dark":\s*\(\) => import\("@shikijs\/themes\/github-dark"\)/);
  assert.match(source, /theme:\s*appTheme === "light" \? "github-light" : "github-dark"/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /dangerouslySetInnerHTML=\{\{\s*__html:\s*html\s*\}\}/);
  assert.match(source, /isCompactMarkdownCodeBlock\(source,\s*normalizedLanguage\)/);
  assert.match(source, /markdown-viewer__code-block\$\{compact \? " is-compact" : ""\}/);
  assert.doesNotMatch(source, /onPointerDown=\{beginPan\}/);
  assert.doesNotMatch(source, /setPointerCapture\(event\.pointerId\)/);
  assert.doesNotMatch(source, /pan\.xScroller\.scrollLeft/);
  assert.doesNotMatch(source, /pan\.yScroller\.scrollTop/);
  assert.match(source, /onWheel=\{handleWheel\}/);
  assert.match(source, /nearestScrollableParent\(viewport\)/);
  assert.match(source, /window\.getComputedStyle\(element\)/);
  assert.match(source, /yScroller\.scrollTop = yScroller\.scrollHeight/);
  assert.match(source, /aria-label=\{tailFollowEnabled \? "Pause tail follow" : "Resume tail follow"\}/);
  assert.match(source, /className="navigator-mode-toggle document-viewer__control document-viewer__control--tail"/);
  assert.match(source, /aria-label=\{rawModeEnabled \? "Show formatted log" : "Show raw log"\}/);
  assert.match(source, /className="navigator-mode-toggle document-viewer__control document-viewer__control--raw"/);
  assert.match(source, /className="document-viewer__surface-picker"/);
  assert.match(source, /aria-label="Select terminal surface"/);
  assert.ok(
    source.indexOf('document-viewer__control--tail') < source.indexOf('document-viewer__control--raw'),
    'Raw mode toggle must sit immediately after Tail in the document toolbar.',
  );
  assert.ok(
    source.indexOf('document-viewer__control--raw') < source.indexOf('document-viewer__surface-picker'),
    'Surface picker must sit after Tail and Raw in the document toolbar.',
  );
  assert.match(source, /viewport\.clientWidth \/ zoom/);
  assert.match(source, /--document-viewer-layout-width/);
  assert.match(source, /content\.offsetWidth \* \(zoom - 1\)/);
  assert.match(source, /content\.offsetHeight \* \(zoom - 1\)/);
  assert.doesNotMatch(source, /Math\.max\(0,\s*content\.offsetWidth \* \(zoom - 1\)\)/);
  assert.match(source, /normalizeMermaidSvg\(hostRef\.current\)/);
  assert.match(source, /svg\.style\.width = `\$\{viewBoxWidth\}px`/);
  assert.match(source, /className="markdown-viewer__table-wrap"/);
  assert.match(styles, /\.document-viewer__viewport\s*\{[^}]*overflow:\s*auto;[^}]*touch-action:\s*pan-x\s+pan-y;[^}]*user-select:\s*text;/s);
  assert.doesNotMatch(styles, /cursor:\s*grab/);
  assert.doesNotMatch(styles, /cursor:\s*grabbing/);
  assert.match(styles, /\.document-viewer__viewport\s*\{[^}]*container-type:\s*inline-size;/s);
  assert.match(styles, /\.document-viewer__embed-frame\s*\{[^}]*height:\s*clamp\(32rem,\s*72vh,\s*56rem\);/s);
  assert.match(styles, /\.document-viewer__html-frame\s*\{[^}]*border:\s*1px solid/s);
  assert.match(styles, /\.document-viewer__pdf-frame\s*\{/s);
  assert.match(styles, /\.document-viewer--outer-scroll\s*\{[^}]*grid-template-rows:\s*auto\s+auto;[^}]*align-content:\s*start;/s);
  assert.match(styles, /\.document-viewer--outer-scroll\s+\.document-viewer__viewport\s*\{[^}]*overflow:\s*visible;/s);
  assert.match(styles, /\.document-viewer__toolbar\s+\.navigator-mode-toggle\.document-viewer__control--tail,\s*\.document-viewer__toolbar\s+\.navigator-mode-toggle\.document-viewer__control--raw\s*\{[^}]*width:\s*2\.7rem;/s);
  assert.match(styles, /\.document-viewer__toolbar\s+\.navigator-mode-toggle\.document-viewer__control--tail\[aria-pressed="true"\],\s*\.document-viewer__toolbar\s+\.navigator-mode-toggle\.document-viewer__control--raw\[aria-pressed="true"\]\s*\{/s);
  assert.match(styles, /\.document-viewer__surface-picker\s*\{[^}]*display:\s*inline-flex;[^}]*font-size:\s*0\.68rem;/s);
  assert.match(styles, /\.document-viewer__surface-picker\s+select\s*\{[^}]*width:\s*clamp\(9rem,\s*18vw,\s*17rem\);/s);
  assert.match(sidecarSource, /<DocumentViewer[\s\S]*?scrollMode="outer"/);
  assert.match(sidecarSource, /const \[tailFollowEnabled,\s*setTailFollowEnabled\] = useState\(tailFollowSurface\)/);
  assert.match(sidecarSource, /const \[rawTailSurface,\s*setRawTailSurface\] = useState\(false\)/);
  assert.match(sidecarSource, /setRawTailSurface\(false\)/);
  assert.match(sidecarSource, /tailFollowSurface && tailFollowEnabled && typeof window !== 'undefined'/);
  assert.match(sidecarSource, /const renderedContent = tailFollowSurface && !rawTailSurface[\s\S]*\? formatTailSurfaceContent\(surface\.content\)[\s\S]*: surface\.content;/);
  assert.match(sidecarSource, /followAppends=\{tailFollowSurface && tailFollowEnabled\}/);
  assert.match(sidecarSource, /tailFollowAvailable=\{tailFollowSurface\}/);
  assert.match(sidecarSource, /rawModeAvailable=\{tailFollowSurface\}/);
  assert.match(sidecarSource, /rawModeEnabled=\{rawTailSurface\}/);
  assert.match(sidecarSource, /onTailFollowToggle=\{\(\) => setTailFollowEnabled\(\(enabled\) => !enabled\)\}/);
  assert.match(sidecarSource, /onRawModeToggle=\{\(\) => setRawTailSurface\(\(raw\) => !raw\)\}/);
  assert.match(sidecarSource, /onZoomBy=\{\(delta\) => dispatch\(\{ type: 'document\/zoom', tabId, delta \}\)\}/);
  assert.match(sidecarSource, /descriptor\.format === 'pdf'[\s\S]*?surfaceRawUrl\(projectRoot,\s*surface\.relative_path\)/);
  assert.match(sidecarSource, /sourceUrl=\{sourceUrl\}/);
  assert.match(sidecarSource, /function surfaceRawUrl\(projectRoot: string,\s*relativePath: string\)/);
  assert.match(sidecarSource, /\/api\/surface\/raw\?\$\{params\.toString\(\)\}/);
  assert.match(serverSource, /url\.pathname === "\/api\/surface\/raw"/);
  assert.match(serverSource, /writeRawSurface\(response,\s*workspaceRoot,\s*relativePath,\s*\{\s*headOnly:\s*request\.method === "HEAD"\s*\}\)/);
  assert.match(serverSource, /"Content-Disposition": `inline; filename\*=UTF-8''\$\{encodeURIComponent\(basename\(resolved\.target\)\)\}`/);
  assert.match(sidecarSource, /const SIDECAR_TAIL_FOLLOW_REFRESH_MS = 1500/);
  assert.match(sidecarSource, /function isTailFollowSurfacePath/);
  assert.match(sidecarSource, /filename === 'terminal\.transcript'/);
  assert.match(sidecarSource, /filename === 'screenlog\.0'/);
  assert.match(sidecarSource, /filename === 'stdout\.log'/);
  assert.match(sidecarSource, /filename === 'stderr\.log'/);
  assert.match(sidecarSource, /filename\.endsWith\('_stdout\.log'\)/);
  assert.match(sidecarSource, /filename\.endsWith\('_stderr\.log'\)/);
  assert.match(sidecarSource, /filename\.endsWith\('\.transcript'\)/);
  assert.match(sidecarSource, /function formatTailSurfaceContent\(content: string\)/);
  assert.match(sidecarSource, /parsed\.type === 'system' && parsed\.subtype === 'thinking_tokens'/);
  assert.match(sidecarSource, /kind === 'thinking'/);
  assert.match(sidecarSource, /return `thinking \$\{thinking\}`/);
  assert.match(sidecarSource, /function preserveTailText\(value: string\)/);
  assert.match(sidecarSource, /return result \? `\$\{headline\}\\n\$\{result\}` : headline;/);
  assert.match(sidecarSource, /\[filtered \$\{hiddenThinkingEvents\} thinking-token telemetry/);
  assert.match(serverSource, /updatedAt: session\.lastOutputAt \?\? session\.lastResizeAt \?\? session\.createdAt \?\? null/);
  assert.match(serverSource, /lastOutputAt: session\.lastOutputAt/);
  assert.match(sidecarSource, /window\.setInterval\(\(\) => loadSurface\(false\), SIDECAR_TAIL_FOLLOW_REFRESH_MS\)/);
  assert.match(styles, /\.document-viewer__content\s*\{[^}]*width:\s*var\(--document-viewer-layout-width,\s*100%\);[^}]*max-width:\s*var\(--document-viewer-layout-width,\s*100%\);/s);
  assert.match(styles, /\.document-viewer__viewport\.is-fit-width\s+\.document-viewer__content/s);
  assert.match(styles, /\.markdown-viewer__table-wrap\s*\{[^}]*width:\s*min\(100%,\s*100cqw\);[^}]*max-width:\s*100cqw;[^}]*overflow-x:\s*auto;/s);
  assert.match(styles, /\.markdown-viewer table\s*\{[^}]*table-layout:\s*fixed;/s);
  assert.match(styles, /\.markdown-viewer table\s*\{[^}]*font-size:\s*0\.74rem;[^}]*line-height:\s*1\.25;/s);
  assert.match(styles, /\.markdown-viewer th,\s*\.markdown-viewer td\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(styles, /\.markdown-viewer th,\s*\.markdown-viewer td\s*\{[^}]*padding:\s*0\.3rem\s+0\.4rem;/s);
  assert.match(styles, /\.markdown-viewer td \.markdown-viewer__inline-code\s*\{[^}]*padding:\s*0\.015rem\s+0\.18rem;[^}]*line-height:\s*1\.15;/s);
  assert.match(styles, /\.document-viewer \.markdown-viewer__inline-code\s*\{[^}]*padding:\s*0\s+0\.08rem;[^}]*border:\s*0;[^}]*line-height:\s*inherit;/s);
  assert.match(styles, /\.document-viewer \.markdown-viewer__code-block\s*\{[^}]*border:\s*0;[^}]*border-left:\s*2px solid color-mix\(in srgb,\s*var\(--code-border\)\s*76%,\s*transparent\);[^}]*border-radius:\s*0;/s);
  assert.match(styles, /\.document-viewer \.markdown-viewer__code-block\.is-compact,\s*\.document-viewer \.document-viewer__highlight\.is-compact pre\s*\{[^}]*display:\s*inline-block;[^}]*background:\s*transparent\s*!important;/s);
  assert.match(styles, /\.markdown-viewer__mermaid\s*\{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;/s);
  assert.match(styles, /\.markdown-viewer__mermaid svg\s*\{[^}]*margin:\s*0;/s);
  assert.match(styles, /\.document-viewer__highlight pre\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--code-bg\)\s*52%,\s*transparent\)\s*!important;/s);
  assert.match(styles, /\.document-viewer__highlight pre\s*\{[^}]*overflow:\s*visible;/s);
});

test('Sidecar load keeps registry context available when a workspace-scoped surface fails', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const stateSource = readFileSync(stateModulePath, 'utf-8');
  assert.match(source, /settleSurface\('projects'/);
  assert.match(source, /payload\.projects = projects\.value/);
  assert.match(source, /load partial:/);
  assert.doesNotMatch(source, /const error = `load failed:/);
  assert.doesNotMatch(stateSource, /\{ id: 'projects', label: 'Projects'/);
});

test('Sidecar browser requests uncapped filesystem entries while generic browse stays bounded', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const serverSource = readFileSync(serverIndexPath, 'utf-8');
  const collaborationSource = readFileSync(collaborationPath, 'utf-8');
  assert.match(source, /\/api\/fs\/browse\?path=\$\{encodeURIComponent\(path\)\}&includeFiles=1&includeHidden=1&maxEntries=0/);
  assert.match(source, /&refresh=\$\{Date\.now\(\)\}`,[\s\S]*?\{ cache: 'no-store' \}/);
  assert.match(source, /No child entries\./);
  assert.match(source, /Showing first 500 entries\./);
  assert.doesNotMatch(source, /Showing first 500 folders\./);
  assert.match(collaborationSource, /params\.set\("refresh", String\(Date\.now\(\)\)\);/);
  assert.match(collaborationSource, /fetch\(`\/api\/fs\/browse\$\{query\}`, \{ cache: "no-store" \}\)/);
  assert.match(serverSource, /function browseMaxEntriesFromParam\(value\)/);
  assert.match(serverSource, /if \(normalized === "all"\) return 0;/);
  assert.match(serverSource, /const listedEntries = maxEntries > 0 \? visibleEntries\.slice\(0, maxEntries\) : visibleEntries;/);
  assert.match(serverSource, /truncated: maxEntries > 0 && visibleEntries\.length > maxEntries/);
});

test('directory surface tabs reuse the Sidecar folder browser and open entries as surface tabs', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');

  assert.match(source, /function DirectorySurfaceBrowser/);
  assert.match(source, /function DirectorySurfaceNode/);
  assert.match(source, /return <DirectorySurfaceBrowser projectRoot=\{projectRoot\} surface=\{surface\} dispatch=\{dispatch\} \/>;/);
  assert.doesNotMatch(source, /sidecar-surface-entry-list[\s\S]*surface\.entries\.map/);
  assert.match(source, /const payload = await fetchJson\(`\/api\/surface\?\$\{params\.toString\(\)\}`\) as SurfaceData;/);
  assert.match(source, /<NavigatorSortToolbar[\s\S]*sort=\{navigatorSort\}/);
  assert.match(source, /<NavigatorTreeGroup[\s\S]*label=\{label\}[\s\S]*extraControls=\{controls\}/);
  assert.match(source, /className="sidecar-folder-tree sidecar-folder-tree--surface-tab"/);
  assert.match(source, /dispatch\(\{ type: 'select', kind: 'surface', id: relativePath \}\);/);
  assert.match(source, /onClick=\{\(\) => onOpenSurface\(entry\.relative_path\)\}/);
  assert.match(styles, /\.sidecar-directory-tab\s*\{[^}]*align-content:\s*start;[^}]*gap:\s*0\.44rem;/s);
  assert.match(styles, /\.sidecar-directory-tab__header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  assert.match(styles, /\.sidecar-folder-tree--surface-tab\s*\{[^}]*gap:\s*0\.1rem;/s);
});

test('Build Portfolio activation promotes one active Project root while Sidecar stays on that Context', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const routeSource = readFileSync(workspaceRoutePath, 'utf-8');
  const hostSource = readFileSync(developerControlHostPath, 'utf-8');
  const appShellSource = readFileSync(appShellPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');
  assert.match(source, /const currentProjectRoot = state\.activeLoadRoot \?\? state\.context\?\.project\.root \?\? projectRoot \?\? null;/);
  assert.match(source, /await setActiveProject\(project\.id\)/);
  assert.doesNotMatch(source, /registerIfMissing: false/);
  assert.match(routeSource, /<DeveloperControlHost[\s\S]*projectRoot=\{workspaceRoot\}[\s\S]*onProjectRootChange=\{onProjectRootChange\}/);
  assert.match(hostSource, /if \(!portfolioState\.activatedProjectRoot\) return;/);
  assert.match(hostSource, /dispatchPortfolio\(\{ type: "portfolio\/project-activation-consumed" \}\);/);
  assert.match(hostSource, /if \(nextRoot !== projectRoot\) onProjectRootChange\(nextRoot\);/);
  assert.match(hostSource, /<SidecarPanel[\s\S]*projectRoot=\{projectRoot\}[\s\S]*onContextChange=\{\(context\) => \{/);
  assert.match(hostSource, /if \(context\.project\.root !== projectRoot\) \{[\s\S]*onProjectRootChange\(context\.project\.root\);/);
  assert.doesNotMatch(routeSource, /selectedPage|ManagerWorld|RequirementsWorkspace|ProcessWorkspace|RuntimePanel|BuilderPanel|GraphWorkspace|HomePanel|InspectorPanel|WorldModelPanel|OddBoardWidget|OddTermWorkspaceWidget/);
  assert.doesNotMatch(appShellSource, /manager-nav|shell__control-card--status|Single STDO-UX workbench|<strong>Sidecar<\/strong>/);
  assert.match(appShellSource, /className="secondary shell__icon-button"/);
  assert.match(styles, /\.shell--sidecar \.shell__title > div\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*baseline;/s);
  assert.match(styles, /\.shell--sidecar \.shell__header\s*\{[^}]*grid-template-columns:\s*minmax\(10rem,\s*1fr\) auto;[^}]*padding:\s*0\.14rem 0\.28rem;/s);
  assert.match(source, /const contextWasSelectedHere = pendingProjectContextRoot\.current === contextRoot;/);
  assert.match(source, /if \(projectRoot && contextRoot !== projectRoot && !contextWasSelectedHere\) return;/);
  assert.match(source, /projectRootOverride=\{currentProjectRoot\}/);
  assert.match(source, /const projectRoot = projectRootOverride \?\? state\.context\?\.project\.root \?\? null;/);
  assert.match(source, /return normalizedPath === root \|\| normalizedPath\.startsWith\(`\$\{root\}\/`\);/);
  assert.match(source, /const activeProjectPinnedFolderPath = activePinnedFolderPath && isProjectFolderPath\(activePinnedFolderPath, currentProjectRoot\)/);
});

test('invalid layout profile load fails closed without replacing current layout', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/resize-preview', target: 'explorer', valuePx: 456 },
    { type: 'layout/profile-loaded', contextKey, payload: { version: 1, contextKey: 'wrong-context', ui: {} } },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.workbenchLayout.explorerWidthPx, 456);
  assert.equal(result.state.lastAction.ok, false);
  assert.match(result.state.lastAction.error, /layout profile rejected/);
});

test('layout profile reset and save failure replay without product Cmd effects', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/resize-preview', target: 'explorer', valuePx: 512 },
    { type: 'ui/toggle-workspace', workspace: 'shell', collapsed: true },
    { type: 'session/select', id: 'sess-1' },
    { type: 'layout/profile-reset' },
    { type: 'layout/profile-save-failed', contextKey, error: 'quota exceeded' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.workbenchLayout.explorerWidthPx, 384);
  assert.equal(result.state.ui.shellCollapsed, true);
  assert.equal(result.state.ui.terminalWorkspace.groups[0].activeTabId, 'session:sess-1');
  assert.equal(result.state.lastAction.ok, false);
  assert.match(result.state.lastAction.error, /layout profile save failed/);
});

test('rail flyout surface selection replays without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/toggle-workspace', workspace: 'info', collapsed: true },
    { type: 'ui/select-info-surface', surface: 'browse' },
    { type: 'ui/select-info-surface', surface: 'specification' },
    { type: 'ui/select-info-surface', surface: 'build-tenants' },
    { type: 'ui/select-info-surface', surface: 'comments', open: false },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.activeInfoSurface, 'comments');
  assert.equal(result.state.ui.infoCollapsed, true);
});

test('explorer provider registry omits Projects and sessions while session selection replays without Cmd effects', async () => {
  const module = await loadStateModule();
  assert.deepEqual(
    module.SIDECAR_EXPLORER_PROVIDERS.map((provider) => provider.id),
    ['tickets', 'comments', 'specification', 'build-tenants', 'browse', 'history'],
  );
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'select', kind: 'session', id: 'sess-1' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.activeInfoSurface, 'tickets');
  assert.equal(result.state.selection.kind, 'session');
  assert.equal(result.state.selection.id, 'sess-1');
  assert.equal(result.state.activeSessionId, 'sess-1');
});

test('Tickets folder navigator projects canonical lane counts without a second ticket store', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  assert.match(source, /const ticketFolderCounts = useMemo/);
  assert.match(source, /state\.tickets\.filter\(\(ticket\) => ticket\.lane === lane\)\.length/);
  assert.match(source, /count=\{folderCounts\?\.\[normalizedPath\] \?\? entries\.length\}/);
  assert.match(source, /folderCounts=\{ticketFolderCounts\}/);
});

test('viewer tab open, select, split, and close replay without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'select', kind: 'ticket', id: 'T-100' },
    { type: 'select', kind: 'comment', id: 'codex/20260427T010101Z_REVIEW_note' },
    { type: 'viewer/select-tab', groupId: 'main', tabId: 'ticket:T-100' },
    { type: 'viewer/split', split: 'split-vertical' },
    { type: 'viewer/focus-group', groupId: 'secondary' },
    { type: 'viewer/open', kind: 'project', id: 'odd_manager' },
    { type: 'viewer/focus-group', groupId: 'main' },
    { type: 'viewer/close-tab', groupId: 'main', tabId: 'ticket:T-100' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.viewerWorkspace.split, 'split-vertical');
  assert.deepEqual(
    result.state.ui.viewerWorkspace.tabs.map((tab) => tab.id).sort(),
    ['comment:codex/20260427T010101Z_REVIEW_note', 'project:odd_manager', 'ticket:T-100'],
  );
  const main = result.state.ui.viewerWorkspace.groups.find((group) => group.id === 'main');
  const secondary = result.state.ui.viewerWorkspace.groups.find((group) => group.id === 'secondary');
  assert.equal(main.activeTabId, 'comment:codex/20260427T010101Z_REVIEW_note');
  assert.equal(secondary.activeTabId, 'project:odd_manager');
  assert.equal(result.state.ui.viewerWorkspace.activeGroupId, 'main');
  assert.equal(result.state.selection.kind, 'comment');
  assert.equal(result.state.selection.id, 'codex/20260427T010101Z_REVIEW_note');
});

test('viewer split reset keeps main group and emits no Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'select', kind: 'ticket', id: 'T-100' },
    { type: 'viewer/split', split: 'split-horizontal' },
    { type: 'viewer/split', split: 'single' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.viewerWorkspace.split, 'single');
  assert.deepEqual(result.state.ui.viewerWorkspace.groups.map((group) => group.id), ['main']);
  assert.equal(result.state.ui.viewerWorkspace.groups[0].activeTabId, 'ticket:T-100');
});

test('viewer horizontal split resizes and empty pane can collapse without Cmd effects', async () => {
  const module = await loadStateModule();
  const resized = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/split', split: 'split-horizontal' },
    { type: 'select', kind: 'ticket', id: 'T-100' },
    { type: 'viewer/resize-boundary', index: 0, deltaRatio: 0.2 },
  ]);
  assert.deepEqual(resized.commands, []);
  assert.equal(resized.state.ui.viewerWorkspace.split, 'split-horizontal');
  assert.ok(resized.state.ui.viewerWorkspace.ratios[0] > resized.state.ui.viewerWorkspace.ratios[1]);

  const collapsed = module.replaySidecarMessages(resized.state, [
    { type: 'viewer/close-group', groupId: 'secondary' },
  ]);
  assert.deepEqual(collapsed.commands, []);
  assert.equal(collapsed.state.ui.viewerWorkspace.split, 'single');
  assert.deepEqual(collapsed.state.ui.viewerWorkspace.groups.map((group) => group.id), ['main']);
  assert.equal(collapsed.state.ui.viewerWorkspace.groups[0].activeTabId, 'ticket:T-100');
});

test('empty viewer split group can be targeted before opening a tab', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/split', split: 'split-vertical' },
    { type: 'viewer/focus-group', groupId: 'secondary' },
    { type: 'select', kind: 'comment', id: 'codex/20260427T010101Z_REVIEW_note' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.viewerWorkspace.activeGroupId, 'secondary');
  const main = result.state.ui.viewerWorkspace.groups.find((group) => group.id === 'main');
  const secondary = result.state.ui.viewerWorkspace.groups.find((group) => group.id === 'secondary');
  assert.equal(main.activeTabId, null);
  assert.equal(secondary.activeTabId, 'comment:codex/20260427T010101Z_REVIEW_note');
  assert.equal(result.state.selection.kind, 'comment');
});

test('viewer vertical split can add panes and resize adjacent ratios without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/split-add-vertical' },
    { type: 'viewer/split-add-vertical' },
    { type: 'viewer/resize-boundary', index: 0, deltaRatio: 0.2 },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.viewerWorkspace.split, 'split-vertical');
  assert.deepEqual(result.state.ui.viewerWorkspace.groups.map((group) => group.id), ['main', 'secondary', 'tertiary']);
  assert.equal(result.state.ui.viewerWorkspace.activeGroupId, 'tertiary');
  assert.equal(result.state.ui.viewerWorkspace.ratios.length, 3);
  assert.ok(result.state.ui.viewerWorkspace.ratios[0] > result.state.ui.viewerWorkspace.ratios[1]);
});

test('terminal tab open, select, split, and close replay without Cmd effects', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    sessions: {
      records: [
        { id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
        { id: 'sess-2', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
      ],
      diagnostic: { backplane: 'registry' },
    },
    activeSessionId: null,
    secondarySessionId: null,
  };
  const result = module.replaySidecarMessages(state, [
    { type: 'session/select', id: 'sess-1' },
    { type: 'session/select', id: 'sess-2' },
    { type: 'terminal/select-tab', groupId: 'main', tabId: 'session:sess-1' },
    { type: 'terminal/split', split: 'split-vertical' },
    { type: 'terminal/focus-group', groupId: 'secondary' },
    { type: 'terminal/close-tab', groupId: 'secondary', tabId: 'session:sess-2' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.terminalWorkspace.split, 'split-vertical');
  assert.deepEqual(
    result.state.ui.terminalWorkspace.tabs.map((tab) => tab.id).sort(),
    ['session:sess-1', 'session:sess-2'],
  );
  const main = result.state.ui.terminalWorkspace.groups.find((group) => group.id === 'main');
  const secondary = result.state.ui.terminalWorkspace.groups.find((group) => group.id === 'secondary');
  assert.equal(main.activeTabId, 'session:sess-1');
  assert.equal(secondary.activeTabId, null);
  assert.equal(result.state.ui.terminalWorkspace.activeGroupId, 'main');
  assert.equal(result.state.activeSessionId, 'sess-1');
});

test('terminal jump-to-session opens dock and selects target shell without Cmd effects', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    sessions: {
      records: [
        { id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
        { id: 'pty-fixture-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'stopped' },
      ],
      diagnostic: { backplane: 'registry' },
    },
    activeSessionId: 'sess-1',
    ui: {
      ...baseState(module).ui,
      shellCollapsed: true,
    },
  };
  const result = module.replaySidecarMessages(state, [
    { type: 'terminal/jump-to-session', sessionId: 'pty-fixture-1' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.shellCollapsed, false);
  assert.equal(result.state.activeSessionId, 'pty-fixture-1');
  assert.equal(result.state.ui.terminalWorkspace.groups[0].activeTabId, 'session:pty-fixture-1');
});

test('terminal horizontal split resizes adjacent ratios without Cmd effects', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    sessions: {
      records: [
        { id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
        { id: 'sess-2', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
      ],
      diagnostic: { backplane: 'registry' },
    },
  };
  const result = module.replaySidecarMessages(state, [
    { type: 'terminal/open', sessionId: 'sess-1' },
    { type: 'terminal/split', split: 'split-horizontal' },
    { type: 'terminal/resize-boundary', index: 0, deltaRatio: 0.2 },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.terminalWorkspace.split, 'split-horizontal');
  assert.ok(result.state.ui.terminalWorkspace.ratios[0] > result.state.ui.terminalWorkspace.ratios[1]);
});

test('terminal split reset keeps main group and emits no Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'session/select', id: 'sess-1' },
    { type: 'terminal/split', split: 'split-horizontal' },
    { type: 'terminal/split', split: 'single' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.terminalWorkspace.split, 'single');
  assert.deepEqual(result.state.ui.terminalWorkspace.groups.map((group) => group.id), ['main']);
  assert.equal(result.state.ui.terminalWorkspace.groups[0].activeTabId, 'session:sess-1');
  assert.equal(result.state.ui.shellLayout, 'single');
});

test('terminal horizontal split expands dock height without Cmd effects', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    ui: {
      ...baseState(module).ui,
      workbenchLayout: {
        ...baseState(module).ui.workbenchLayout,
        bottomDockHeightPx: 240,
      },
    },
  };
  const result = module.replaySidecarMessages(state, [
    { type: 'terminal/split', split: 'split-horizontal' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.terminalWorkspace.split, 'split-horizontal');
  assert.equal(result.state.ui.workbenchLayout.bottomDockHeightPx, module.SIDECAR_HORIZONTAL_SPLIT_DOCK_HEIGHT_PX);
});

test('empty terminal split group can be targeted for session select and spawn', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    sessions: {
      records: [
        { id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
        { id: 'sess-2', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
      ],
      diagnostic: { backplane: 'registry' },
    },
    activeSessionId: null,
    secondarySessionId: null,
  };
  const selected = module.replaySidecarMessages(state, [
    { type: 'terminal/split', split: 'split-vertical' },
    { type: 'terminal/focus-group', groupId: 'secondary' },
    { type: 'session/select', id: 'sess-1' },
  ]);
  assert.deepEqual(selected.commands, []);
  assert.equal(selected.state.ui.terminalWorkspace.activeGroupId, 'secondary');
  const selectedSecondary = selected.state.ui.terminalWorkspace.groups.find((group) => group.id === 'secondary');
  assert.equal(selectedSecondary.activeTabId, 'session:sess-1');
  assert.equal(selected.state.activeSessionId, 'sess-1');

  const spawned = module.replaySidecarMessages(state, [
    { type: 'terminal/split', split: 'split-vertical' },
    { type: 'terminal/focus-group', groupId: 'secondary' },
    { type: 'session/spawn/request' },
    {
      type: 'session/spawn/done',
      groupId: 'secondary',
      record: { id: 'sess-3', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
    },
  ]);
  assert.deepEqual(spawned.commands, [
    { type: 'session.spawn', projectRoot: '/workspace/odd_manager', groupId: 'secondary', cwd: null, label: null },
  ]);
  const spawnedSecondary = spawned.state.ui.terminalWorkspace.groups.find((group) => group.id === 'secondary');
  assert.equal(spawnedSecondary.activeTabId, 'session:sess-3');
  assert.equal(spawned.state.activeSessionId, 'sess-3');
});

test('terminal vertical split can add panes and resize adjacent ratios without Cmd effects', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    sessions: {
      records: [
        { id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
        { id: 'sess-2', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
      ],
      diagnostic: { backplane: 'registry' },
    },
  };
  const result = module.replaySidecarMessages(state, [
    { type: 'terminal/split-add-vertical' },
    { type: 'terminal/split-add-vertical' },
    { type: 'terminal/resize-boundary', index: 1, deltaRatio: -0.16 },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.terminalWorkspace.split, 'split-vertical');
  assert.deepEqual(result.state.ui.terminalWorkspace.groups.map((group) => group.id), ['main', 'secondary', 'tertiary']);
  assert.equal(result.state.ui.terminalWorkspace.activeGroupId, 'tertiary');
  assert.equal(result.state.ui.terminalWorkspace.ratios.length, 3);
  assert.ok(result.state.ui.terminalWorkspace.ratios[1] < result.state.ui.terminalWorkspace.ratios[2]);
});

test('session select keeps info selection independent', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'select', kind: 'ticket', id: 'T-100' },
    { type: 'session/select', id: 'sess-1' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'ticket');
  assert.equal(result.state.selection.id, 'T-100');
  assert.equal(result.state.activeSessionId, 'sess-1');
});

test('shell layout and secondary window selection replay without Cmd effects', async () => {
  const module = await loadStateModule();
  const state = {
    ...baseState(module),
    sessions: {
      records: [
        { id: 'sess-1', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
        { id: 'sess-2', agent_type: 'shell', cwd: '/workspace/odd_manager', status: 'running' },
      ],
      diagnostic: { backplane: 'registry' },
    },
    activeSessionId: 'sess-1',
    secondarySessionId: null,
  };
  const result = module.replaySidecarMessages(state, [
    { type: 'ui/set-shell-layout', layout: 'split-vertical' },
    { type: 'session/select-secondary', id: 'sess-2' },
    { type: 'ui/set-shell-layout', layout: 'split-horizontal' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.shellLayout, 'split-horizontal');
  assert.equal(result.state.activeSessionId, 'sess-1');
  assert.equal(result.state.secondarySessionId, 'sess-2');
});

test('sidecar design grammar keeps complexity in sidebars and work areas low-border', () => {
  const sidecarBlock = readSidecarCssBlock();
  assert.match(sidecarBlock, /--sidecar-radius:\s*8px;/);
  assert.match(sidecarBlock, /--sidecar-radius-sm:\s*6px;/);
  assert.match(
    sidecarBlock,
    /\.sidecar-activity-rail,\s*\.sidecar-context-rail,\s*\.sidecar-flyout\s*\{[^}]*border:\s*1px\s+solid\s+var\(--line\);[^}]*border-radius:\s*var\(--sidecar-radius\);/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-canvas,\s*\.sidecar-bottom-dock\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-workbench\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-viewer-group,\s*\.sidecar-terminal-group\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;/s,
  );
});

test('sidecar right rail is a narrow sweep-out context affordance', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const railSource = source.slice(
    source.indexOf('<aside className="sidecar-context-rail"'),
    source.indexOf('<section className="sidecar-bottom-dock"'),
  );
  assert.match(railSource, /<ContextRailItem[\s\S]*symbol="P"[\s\S]*label="Project"/);
  assert.match(railSource, /<ContextRailItem[\s\S]*symbol="O"[\s\S]*label="Selection"/);
  assert.match(railSource, /<ContextRailCommand[\s\S]*label="Reset sidecar layout"/);
  assert.doesNotMatch(railSource, /symbol="N0"/);
  assert.doesNotMatch(railSource, /ResizeHandle/);
  assert.doesNotMatch(railSource, /target="contextRail"/);

  const sidecarBlock = readSidecarCssBlock();
  assert.match(sidecarBlock, /grid-template-columns:\s*3\.35rem\s+minmax\(0,\s*1fr\)\s+3\.25rem;/s);
  assert.match(
    sidecarBlock,
    /\.sidecar-context-rail\s*\{[^}]*grid-row:\s*1;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow-y:\s*auto;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-context-rail__detail\s*\{[^}]*position:\s*absolute;[^}]*right:\s*calc\(100%\s*\+\s*0\.5rem\);[^}]*opacity:\s*0;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-context-rail__item:hover\s+\.sidecar-context-rail__detail,\s*\.sidecar-context-rail__item:focus\s+\.sidecar-context-rail__detail,\s*\.sidecar-context-rail__item:focus-visible\s+\.sidecar-context-rail__detail\s*\{[^}]*opacity:\s*1;/s,
  );
});

test('sidecar viewer and terminal tabs share one visual grammar and theme token surface', () => {
  const sidecarBlock = readSidecarCssBlock();
  assert.match(sidecarBlock, /\.sidecar-viewer-tabs,\s*\.sidecar-terminal-toolbar__tabs\s*\{/s);
  assert.match(sidecarBlock, /\.sidecar-viewer-tab,\s*\.sidecar-terminal-tab\s*\{/s);
  assert.match(sidecarBlock, /\.sidecar-viewer-tab\.is-selected,\s*\.sidecar-terminal-tab\.is-selected\s*\{/s);
  assert.doesNotMatch(sidecarBlock, /:root\[data-theme="dark"\]\s+\.sidecar-/);
  assert.doesNotMatch(sidecarBlock, /background:\s*rgba\(/);
});

test('sidecar theme contrast surfaces are tokenized across light, dark grey, and dark blue', () => {
  const styles = readFileSync(stylesPath, 'utf-8');
  assert.match(styles, /:root\s*\{[\s\S]*--code-bg:\s*#edf1f2;[\s\S]*--code-ink:\s*#1c2d3e;[\s\S]*--code-border:\s*#cbd4d8;/);
  assert.match(styles, /:root\[data-theme="dark"\]\s*\{[\s\S]*--code-bg:\s*#0d1524;[\s\S]*--code-ink:\s*#edf4ff;[\s\S]*--code-border:\s*#27364d;/);
  assert.match(styles, /:root\[data-theme="dark-grey"\]\s*\{[\s\S]*--code-bg:\s*#171717;[\s\S]*--code-ink:\s*#d4d4d4;[\s\S]*--code-border:\s*#3c3c3c;/);
  assert.match(styles, /\.summary-pill\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--panel\)\s*72%,\s*transparent\);/s);
  assert.match(styles, /\.agent-console__layout-toggle\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--panel\)\s*78%,\s*transparent\);/s);
  assert.match(styles, /\.agent-console__secondary-picker select\s*\{[^}]*background:\s*color-mix\(in srgb,\s*var\(--panel\)\s*82%,\s*transparent\);/s);
  assert.match(styles, /\.markdown-viewer__code-block\s*\{[^}]*border:\s*1px solid var\(--code-border\);[^}]*background:\s*var\(--code-bg\);[^}]*color:\s*var\(--code-ink\);/s);
  assert.doesNotMatch(styles, /\.markdown-viewer__code-block\s*\{[^}]*background:\s*rgba\(11,\s*18,\s*32/s);
});

test('sidecar density grammar collapses terminal chrome into the selected-pane toolbar', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const terminalWorkspaceSource = source.slice(
    source.indexOf('function TerminalWorkspace'),
    source.indexOf('function TerminalGroupPane'),
  );
  const terminalGroupSource = source.slice(
    source.indexOf('function TerminalGroupPane'),
    source.indexOf('function TerminalTabBody'),
  );
  const sessionWindowSource = source.slice(
    source.indexOf('function SessionTerminalWindow'),
    source.indexOf('type TerminalStatus'),
  );
  const sidecarTerminalSource = source.slice(
    source.indexOf('function SidecarTerminal'),
    source.indexOf('function MetaGrid'),
  );
  assert.match(terminalWorkspaceSource, /className="sidecar-terminal-toolbar"/);
  assert.match(terminalWorkspaceSource, /className="agent-console__select sidecar-shell-session-select"/);
  assert.match(terminalWorkspaceSource, /className="sidecar-terminal-toolbar__context"/);
  assert.match(terminalWorkspaceSource, /sidecar-terminal-toolbar__refresh/);
  assert.match(terminalWorkspaceSource, /className="sidecar-terminal-toolbar__tabs"/);
  assert.doesNotMatch(terminalWorkspaceSource, /sidecar-shell-manager/);
  assert.doesNotMatch(terminalGroupSource, /sidecar-terminal-tabs/);
  assert.doesNotMatch(sessionWindowSource, /<MetaGrid/);
  assert.doesNotMatch(sessionWindowSource, /sidecar-session-window__body/);
  assert.match(sessionWindowSource, /<SidecarTerminal session=\{session\} projectRoot=\{projectRoot\} \/>/);
  assert.doesNotMatch(sidecarTerminalSource, /agent-console__terminal-bar/);
  assert.match(source, /const ODDTERM_RESIZE_DEBOUNCE_MS = 180;/);
  assert.match(source, /const ODDTERM_RESIZE_MAX_WAIT_MS = 900;/);
  assert.match(sidecarTerminalSource, /lastSentResize\?\.cols === nextResize\.cols && lastSentResize\.rows === nextResize\.rows/);
  assert.match(sidecarTerminalSource, /seq: nextResize\.seq/);
  assert.match(sidecarTerminalSource, /payload\.type === 'resize_ack'/);
  assert.match(sidecarTerminalSource, /payload\.type === 'resize_error'/);
  assert.match(sidecarTerminalSource, /lastSentResize = null/);
});

test('sidecar density CSS keeps controls shallow and gives height to terminal host', () => {
  const sidecarBlock = readSidecarCssBlock();
  assert.match(
    sidecarBlock,
    /\.sidecar-context-rail__command\s*\{[^}]*box-shadow:\s*none;[^}]*cursor:\s*pointer;[^}]*transform:\s*none;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(10rem,\s*18rem\)\s+minmax\(12rem,\s*0\.85fr\)\s+auto\s+minmax\(12rem,\s*1\.15fr\)\s+auto\s+auto\s+auto;[^}]*padding:\s*0\.22rem\s+0\.28rem;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-group\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-bottom-dock\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-workbench\.is-bottom-collapsed\s+\.sidecar-bottom-dock\s*\{[^}]*grid-template-rows:\s*auto;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-bottom-dock\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-shell-layout\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);[^}]*height:\s*100%;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-workspace\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-groups\s*\{[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-terminal-group,\s*\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-terminal-group__body,\s*\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-session-window,\s*\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-terminal,\s*\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-terminal-placeholder\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-session-window,\s*\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-terminal\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-pane-split-handle\s*\{[^}]*place-items:\s*center;[^}]*background:\s*transparent;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-bottom-dock\s+\.sidecar-session-window,\s*\.sidecar-bottom-dock\s+\.sidecar-terminal\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*padding:\s*0;/s,
  );
  assert.match(
    sidecarBlock,
    /height:\s*clamp\(26rem,\s*calc\(var\(--sidecar-bottom-dock-height,\s*34rem\)\s*-\s*3\.8rem\),\s*48rem\);/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-bottom-dock\s+\.sidecar-shell-terminal-layout\.agent-console__terminal-layout--split-horizontal\s+\.sidecar-terminal\s+\.agent-console__terminal-host,\s*\.sidecar-bottom-dock\s+\.sidecar-terminal-workspace--split-horizontal\s+\.sidecar-terminal\s+\.agent-console__terminal-host\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
  );
  assert.doesNotMatch(
    sidecarBlock,
    /\.sidecar-bottom-dock\s+\.sidecar-shell-terminal-layout\.agent-console__terminal-layout--split-horizontal[\s\S]*?height:\s*clamp\(18rem,\s*32vh,\s*26rem\);/s,
  );
});

test('sidecar info browser splitter is compact canvas chrome, not a viewer toolbar row', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const canvasHeaderSource = source.slice(
    source.indexOf('className="sidecar-canvas__header"'),
    source.indexOf('<ViewerWorkspace'),
  );
  const viewerToggleSource = source.slice(
    source.indexOf('function ViewerLayoutToggle'),
    source.indexOf('function ViewerWorkspace'),
  );
  const viewerWorkspaceSource = source.slice(
    source.indexOf('function ViewerWorkspace'),
    source.indexOf('function ViewerGroupPane'),
  );
  assert.match(canvasHeaderSource, /<ViewerLayoutToggle[\s\S]*dispatch\(\{ type: 'viewer\/split', split \}\)/);
  assert.match(viewerToggleSource, /aria-label="Sidecar viewer layout"/);
  assert.match(viewerToggleSource, /onClick=\{\(\) => onSplit\(nextSplit\)\}/);
  assert.match(viewerWorkspaceSource, /className="sidecar-viewer-groups"/);
  assert.doesNotMatch(viewerWorkspaceSource, /sidecar-viewer-toolbar/);
  assert.doesNotMatch(viewerWorkspaceSource, /sidecar-viewer-layout-toggle/);
});

test('sidecar split controls keep add-pane affordance and remove duplicate Split V label', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const viewerToggleSource = source.slice(
    source.indexOf('function ViewerLayoutToggle'),
    source.indexOf('function ViewerWorkspace'),
  );
  const terminalWorkspaceSource = source.slice(
    source.indexOf('function TerminalWorkspace'),
    source.indexOf('function TerminalGroupPane'),
  );
  assert.doesNotMatch(viewerToggleSource, /Split V/);
  assert.doesNotMatch(terminalWorkspaceSource, /Split V/);
  assert.match(viewerToggleSource, /aria-label="Add vertical viewer pane"/);
  assert.match(terminalWorkspaceSource, /aria-label="Add vertical terminal pane"/);
  assert.match(viewerToggleSource, /split === 'split-vertical'/);
  assert.match(terminalWorkspaceSource, /terminalWorkspace\.split === 'split-vertical'/);
});

test('sidecar info browser splitter CSS keeps the viewer workspace shallow', () => {
  const sidecarBlock = readSidecarCssBlock();
  assert.match(
    sidecarBlock,
    /\.sidecar-canvas__header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*align-items:\s*center;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-canvas__header\s+\.sidecar-viewer-layout-toggle\s*\{[^}]*min-height:\s*1\.62rem;[^}]*padding:\s*0\.12rem;[^}]*border-radius:\s*var\(--sidecar-radius\);/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-viewer-workspace\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);[^}]*gap:\s*0;[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-viewer-groups\s*\{[^}]*gap:\s*var\(--sidecar-gap\);[^}]*height:\s*100%;[^}]*overflow:\s*hidden;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-viewer-workspace--split-horizontal\s+\.sidecar-viewer-group,\s*\.sidecar-viewer-workspace--split-horizontal\s+\.sidecar-viewer-body,\s*\.sidecar-viewer-workspace--split-horizontal\s+\.sidecar-inspector,\s*\.sidecar-viewer-workspace--split-horizontal\s+\.sidecar-inspector__empty\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s,
  );
  assert.doesNotMatch(sidecarBlock, /\.sidecar-viewer-toolbar\s*\{/);
});

test('sidecar split targeting markup exposes empty groups and compact action feedback', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const viewerGroupSource = source.slice(
    source.indexOf('function ViewerGroupPane'),
    source.indexOf('function ViewerTabBody'),
  );
  const terminalGroupSource = source.slice(
    source.indexOf('function TerminalGroupPane'),
    source.indexOf('function TerminalTabBody'),
  );
  const collapsedDockSource = source.slice(
    source.indexOf('{state.ui.shellCollapsed ? ('),
    source.indexOf(') : (', source.indexOf('{state.ui.shellCollapsed ? (')),
  );
  assert.match(viewerGroupSource, /tabIndex=\{0\}/);
  assert.match(viewerGroupSource, /onPointerDownCapture=\{\(\) => dispatch\(\{ type: 'viewer\/focus-group', groupId: group\.id \}\)\}/);
  assert.match(viewerGroupSource, /<EmptyViewerPane[\s\S]*type: 'viewer\/close-group'/);
  assert.match(terminalGroupSource, /tabIndex=\{0\}/);
  assert.match(terminalGroupSource, /onPointerDownCapture=\{\(\) => dispatch\(\{ type: 'terminal\/focus-group', groupId: group\.id \}\)\}/);
  assert.match(collapsedDockSource, /<ResizeHandle[\s\S]*target="bottomDock"[\s\S]*label="Resize terminal dock"/);

  const sidecarBlock = readSidecarCssBlock();
  assert.match(
    sidecarBlock,
    /\.sidecar-action-result\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s,
  );
});

test('Build Portfolio owns Project discovery and registry mutation while Sidecar Browse stays Project-local', () => {
  const sidecarSource = readFileSync(sidecarPanelPath, 'utf-8');
  const sidecarStateSource = readFileSync(stateModulePath, 'utf-8');
  const portfolioViewSource = readFileSync(buildPortfolioViewPath, 'utf-8');
  const portfolioStateSource = readFileSync(buildPortfolioStatePath, 'utf-8');
  const portfolioRuntimeSource = readFileSync(buildPortfolioRuntimePath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');

  const browseStart = sidecarSource.indexOf("if (surface === 'browse') {");
  const browseEnd = sidecarSource.indexOf('return null;', browseStart);
  assert.notEqual(browseStart, -1);
  assert.notEqual(browseEnd, -1);
  const browseSource = sidecarSource.slice(browseStart, browseEnd);

  assert.doesNotMatch(sidecarStateSource, /id: 'projects'/);
  assert.doesNotMatch(sidecarStateSource, /browse\/scope-set|browse\/favourite-folder|projects\/unfavourite/);
  assert.doesNotMatch(sidecarSource, /surface === 'projects'|Project Browser|Project Favourites/);
  assert.doesNotMatch(sidecarSource, /registerProject|unregisterProject/);
  assert.doesNotMatch(sidecarSource, /projectBrowser|projectFavouriteRoots|onProjectFavourite/);
  assert.match(browseSource, /<Pane\s+title="Browse"/);
  assert.match(browseSource, /projectRootPath/);
  assert.doesNotMatch(browseSource, /cross-project|state\.projects/);

  assert.match(portfolioViewSource, /<table className="build-portfolio__table" aria-label="Build Portfolio Projects">/);
  assert.match(portfolioViewSource, /aria-label="Add Project browser"/);
  assert.match(portfolioViewSource, /type: "portfolio\/project-register-requested"/);
  assert.match(portfolioViewSource, /type: "portfolio\/project-activate-requested"/);
  assert.match(portfolioViewSource, /type: "portfolio\/project-unregister-requested"/);
  assert.match(portfolioStateSource, /type: "portfolio\.browse"/);
  assert.match(portfolioStateSource, /type: "portfolio\.register"/);
  assert.match(portfolioStateSource, /type: "portfolio\.unregister"/);
  assert.match(portfolioStateSource, /type: "portfolio\.activate"/);
  assert.match(portfolioRuntimeSource, /browsePath,/);
  assert.match(portfolioRuntimeSource, /registerProject,/);
  assert.match(portfolioRuntimeSource, /setActiveProject,/);
  assert.match(portfolioRuntimeSource, /unregisterProject,/);

  assert.doesNotMatch(styles, /\.sidecar-project-browser|\.sidecar-project-picker/);
  assert.match(styles, /\.build-portfolio__table\s*\{/);
  assert.match(styles, /\.build-portfolio__browser\s*\{/);
  assert.match(styles, /\.sidecar-folder-breadcrumb\s*\{/);
});

// Traversal View (sprint W7) — Msg-replay proofs for the traversal family.
// Deterministic payloads are injected; no network, DOM, or timers.

function traversalSummaryFor(workspaceRoot) {
  return {
    kind: 'traversal_projection',
    version: 1,
    state: 'ready',
    runRoot: `${workspaceRoot}-run`,
    workspaceRoot,
    scenario: {
      scenarioId: 'SCN-TEST',
      scenarioKind: 'test_kind',
      proofClass: 'full_lifecycle_graph_traversal_compliance',
      durationMs: 1000,
    },
    substrate: {
      productId: 'abiogenesis',
      packageName: '@abiogenesis/typescript-tenant',
      packageVersion: '4.6.0-rc.1',
      releaseTag: 'v4.6.0-rc.1',
      sourceCommit: 'deadbeef',
    },
    eventCounts: { frame_opened: 2, vector_traversal_planned: 2, novel_event_kind: 3 },
    unknownEventKinds: ['novel_event_kind'],
    frames: [
      { frameOrdinal: 0, graphFunctionRef: null, edge: 'edge-a', vectorIndex: 0, openedAt: '2026-07-09T18:00:00.000Z' },
      { frameOrdinal: 1, graphFunctionRef: null, edge: 'edge-b', vectorIndex: 1, openedAt: '2026-07-09T18:01:00.000Z' },
    ],
    vectors: [
      {
        vectorIndex: 0,
        edge: 'edge-a',
        stage: 'stage-a',
        attemptCount: 1,
        hasEvaluator: true,
        accepted: true,
        durationMs: 60000,
        plannedAt: '2026-07-09T18:00:00.000Z',
        evaluatedAt: '2026-07-09T18:01:00.000Z',
        frameOrdinal: 0,
      },
      {
        vectorIndex: 1,
        edge: 'edge-b',
        stage: 'stage-b',
        attemptCount: 2,
        hasEvaluator: false,
        accepted: null,
        durationMs: null,
        plannedAt: '2026-07-09T18:01:00.000Z',
        evaluatedAt: null,
        frameOrdinal: 1,
      },
    ],
    currentVectorIndex: 1,
    requirementLineage: [
      {
        requirementId: 'REQ-TEST-1',
        spanIds: ['span://test/1'],
        vectorIndexes: [0],
        reachedVectorIndexes: [0],
        enteringPromptRefCounts: [1],
        coverageStatuses: ['eligible'],
        foldStates: ['satisfied'],
        residualPressureRefs: [],
      },
    ],
    diagnostics: [],
  };
}

function traversalDetailFor(index, attempt = 1, variant = 'primary') {
  return {
    kind: 'traversal_vector_detail',
    version: 1,
    vectorIndex: index,
    variant,
    attempt,
    edge: `edge-${index}`,
    stage: `stage-${index}`,
    stagePlan: {
      sourceTypeRef: 'test.type.source',
      targetTypeRef: 'test.type.target',
      vectorId: `graph-vector://test/${index}`,
      filesToProduce: ['out.md'],
      executeBeforeAssessment: false,
    },
    assessment: { accepted: true, reason: 'deterministic test assessment', nodeTypesUsed: ['test.type.source'] },
    materializedFiles: [{ path: 'out.md', sha256: 'sha256:abc', byteLength: 10, lineCount: 2 }],
    contentPreviews: [{ path: 'out.md', contentPreview: '# out' }],
    timing: { startedAt: '2026-07-09T18:00:00.000Z', endedAt: '2026-07-09T18:00:30.000Z', durationMs: 30000 },
    availableVariants: [{ variant: 'primary', attempt: 1 }],
    sourcePath: `/runs/vector-${index}-artifact.json`,
  };
}

function runObservationFor(projectRoot, selectedRunId = 'run-a') {
  const runs = ['run-a', 'run-b'].map((runId, index) => ({
    runId,
    runRoot: `${projectRoot}/test_runs/${runId}`,
    workspaceRoot: `${projectRoot}/test_runs/${runId}/instance`,
    scenarioId: `SCN-${runId.toUpperCase()}`,
    scenarioKind: 'fixture',
    proofClass: 'fixture-proof',
    graphFunctionRef: 'graph-function://fixture/full',
    status: 'converged',
    modifiedAt: `2026-07-10T00:0${index}:00.000Z`,
    lastEventAt: `2026-07-10T00:0${index}:30.000Z`,
    eventCount: 10 + index,
  }));
  return {
    kind: 'abg_run_observation',
    version: 2,
    generatedAt: '2026-07-10T00:02:00.000Z',
    state: 'ready',
    projectRoot,
    identity: { id: 'fixture', label: 'Fixture', kind: 'source_project', version: null, sourceRef: 'specification/PRODUCT.md', confidence: 'high', governancePackages: [] },
    runs,
    selectedRunId,
    selectedRunRoot: runs.find((run) => run.runId === selectedRunId)?.runRoot ?? null,
    selectedWorkspaceRoot: runs.find((run) => run.runId === selectedRunId)?.workspaceRoot ?? null,
    systemReferences: [],
    substrate: null,
    activity: null,
    functions: [],
    catalog: {
      state: 'missing',
      sourceKind: 'abg_runtime_events',
      sourceRef: null,
      admissionEventCount: 0,
      unparsedAdmissionCount: 0,
      rejectedEventCount: 0,
      constructionCatalogEventCount: 0,
      entryCount: 0,
      entryKindCounts: [],
      entries: [],
      rejectedEntries: [],
      constructionCatalogs: [],
      truncated: false,
    },
    assets: [],
    assurance: null,
    eventKinds: [],
    events: [],
    stages: [],
    transcripts: [],
    artifacts: [],
    diagnostics: [],
  };
}

test('traversal load replay emits summary Cmd and absorbs the ready projection', async () => {
  const module = await loadStateModule();
  const summary = traversalSummaryFor('/workspace/odd_manager');
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary },
  ]);
  assert.deepEqual(result.commands, [
    { type: 'run.loadObservation', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
    { type: 'traversal.loadSummary', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
  ]);
  assert.equal(result.state.traversal.status, 'ready');
  assert.equal(result.state.traversal.workspaceRoot, '/workspace/odd_manager');
  assert.equal(result.state.traversal.summary, summary);
  assert.equal(result.state.traversal.error, null);
});

test('traversal load failure replay lands in an honest error state and can retry', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-failed', workspaceRoot: '/workspace/odd_manager', error: 'proof unreadable' },
  ]);
  assert.equal(result.state.traversal.status, 'error');
  assert.equal(result.state.traversal.error, 'proof unreadable');
  assert.equal(result.state.traversal.summary, null);

  const retried = module.replaySidecarMessages(result.state, [
    { type: 'traversal/load', workspaceRoot: '/workspace/odd_manager' },
  ]);
  assert.equal(retried.state.traversal.status, 'loading');
  assert.deepEqual(retried.commands, [
    { type: 'run.loadObservation', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
    { type: 'traversal.loadSummary', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
  ]);
});

test('stale traversal summary for another root cannot overwrite the requested root', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load', workspaceRoot: '/workspace/data_mapper' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary: traversalSummaryFor('/workspace/odd_manager') },
  ]);
  assert.equal(result.state.traversal.status, 'loading');
  assert.equal(result.state.traversal.summary, null);
});

test('run observation replay admits the selected Project run and section changes stay pure', async () => {
  const module = await loadStateModule();
  const observation = runObservationFor('/workspace/odd_manager');
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'run/load-succeeded', workspaceRoot: '/workspace/odd_manager', requestedRunId: null, observation },
    { type: 'run/select-section', section: 'catalog' },
  ]);
  assert.equal(result.state.traversal.runStatus, 'ready');
  assert.equal(result.state.traversal.selectedRunId, 'run-a');
  assert.equal(result.state.traversal.section, 'catalog');
  assert.equal(result.state.traversal.runObservation, observation);
  assert.deepEqual(result.commands, [
    { type: 'run.loadObservation', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
    { type: 'traversal.loadSummary', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
  ]);
});

test('Run Inspector focus preserves originating execution, run, revision, and evidence source', async () => {
  const module = await loadStateModule();
  const focus = {
    projectRoot: '/workspace/odd_manager',
    executionId: 'execution-42',
    runRef: 'run://odd_manager/42',
    revision: 'revision-42',
    sourceRef: 'build-evidence://execution-42/tests',
  };
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'run/focus-admitted', focus },
    { type: 'traversal/load' },
  ]);
  assert.deepEqual(result.state.runFocus, focus);
  assert.deepEqual(result.commands, [
    { type: 'run.loadObservation', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
    { type: 'traversal.loadSummary', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
  ]);
});

test('run selection emits both projections and rejects stale same-Project run responses', async () => {
  const module = await loadStateModule();
  const primed = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'run/load-succeeded', workspaceRoot: '/workspace/odd_manager', requestedRunId: null, observation: runObservationFor('/workspace/odd_manager') },
  ]);
  const selected = module.replaySidecarMessages(primed.state, [
    { type: 'run/select', runId: 'run-b' },
    { type: 'run/load-succeeded', workspaceRoot: '/workspace/odd_manager', requestedRunId: 'run-a', observation: runObservationFor('/workspace/odd_manager', 'run-a') },
  ]);
  assert.equal(selected.state.traversal.selectedRunId, 'run-b');
  assert.equal(selected.state.traversal.runStatus, 'loading');
  assert.deepEqual(selected.commands, [
    { type: 'run.loadObservation', workspaceRoot: '/workspace/odd_manager', runId: 'run-b', refresh: false },
    { type: 'traversal.loadSummary', workspaceRoot: '/workspace/odd_manager', runId: 'run-b', refresh: false },
  ]);
});

test('Project switch clears all run-scoped state without requiring a traversal reload', async () => {
  const module = await loadStateModule();
  const primed = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'run/load-succeeded', workspaceRoot: '/workspace/odd_manager', requestedRunId: null, observation: runObservationFor('/workspace/odd_manager') },
  ]).state;
  const switched = module.replaySidecarMessages(primed, [
    { type: 'load/request', projectRoot: '/workspace/data_mapper', reason: 'project_selected' },
    {
      type: 'load/done',
      projectRoot: '/workspace/data_mapper',
      payload: {
        context: { project: { id: 'data_mapper', root: '/workspace/data_mapper', odd_type: 'fixture' }, workspace: { id: 'scala_sbt', profile: 'fixture' }, session: null },
      },
    },
  ]);
  assert.equal(switched.state.traversal.workspaceRoot, null);
  assert.equal(switched.state.traversal.runObservation, null);
  assert.equal(switched.state.traversal.summary, null);
  assert.equal(switched.state.traversal.selectedRunId, null);
});

test('run shell targeting emits a Project-owned session command with admitted cwd', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'session/spawn/request', cwd: '/workspace/odd_manager/test_runs/run-a/instance', label: 'SCN-RUN-A shell' },
  ]);
  assert.deepEqual(result.commands, [{
    type: 'session.spawn',
    projectRoot: '/workspace/odd_manager',
    groupId: 'main',
    cwd: '/workspace/odd_manager/test_runs/run-a/instance',
    label: 'SCN-RUN-A shell',
  }]);
});

test('traversal vector selection replays a lazy detail Cmd and success fills the pane', async () => {
  const module = await loadStateModule();
  const summary = traversalSummaryFor('/workspace/odd_manager');
  const detail = traversalDetailFor(1);
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary },
    { type: 'traversal/select-vector', index: 1 },
    { type: 'traversal/vector-succeeded', workspaceRoot: '/workspace/odd_manager', index: 1, variant: 'primary', attempt: null, detail },
  ]);
  assert.deepEqual(result.commands, [
    { type: 'run.loadObservation', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
    { type: 'traversal.loadSummary', workspaceRoot: '/workspace/odd_manager', runId: null, refresh: false },
    { type: 'traversal.loadVectorDetail', workspaceRoot: '/workspace/odd_manager', runId: null, index: 1, variant: 'primary', attempt: null },
  ]);
  assert.deepEqual(result.state.traversal.selectedVector, { index: 1, variant: 'primary', attempt: null });
  assert.equal(result.state.traversal.detailStatus, 'ready');
  assert.equal(result.state.traversal.details.length, 1);
  assert.equal(result.state.traversal.details[0].detail, detail);

  // Re-selecting a cached vector must NOT emit another fetch Cmd.
  const reselected = module.replaySidecarMessages(result.state, [
    { type: 'traversal/select-vector', index: 1 },
  ]);
  assert.deepEqual(reselected.commands, []);
  assert.equal(reselected.state.traversal.detailStatus, 'ready');
});

test('traversal vector detail failure replays to an honest detail error', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary: traversalSummaryFor('/workspace/odd_manager') },
    { type: 'traversal/select-vector', index: 0 },
    { type: 'traversal/vector-failed', workspaceRoot: '/workspace/odd_manager', index: 0, variant: 'primary', attempt: null, error: 'artifact unreadable' },
  ]);
  assert.equal(result.state.traversal.detailStatus, 'error');
  assert.equal(result.state.traversal.detailError, 'artifact unreadable');
  assert.equal(result.state.traversal.details.length, 0);
});

test('traversal detail cache keeps at most 8 entries and evicts the oldest first', async () => {
  const module = await loadStateModule();
  const messages = [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary: traversalSummaryFor('/workspace/odd_manager') },
  ];
  for (let index = 0; index < 9; index += 1) {
    messages.push({ type: 'traversal/select-vector', index });
    messages.push({
      type: 'traversal/vector-succeeded',
      workspaceRoot: '/workspace/odd_manager',
      index,
      variant: 'primary',
      attempt: null,
      detail: traversalDetailFor(index),
    });
  }
  const result = module.replaySidecarMessages(baseState(module), messages);
  assert.equal(result.state.traversal.details.length, 8, 'cache is capped at 8 entries');
  const cachedIndexes = result.state.traversal.details.map((entry) => entry.detail.vectorIndex);
  assert.deepEqual(cachedIndexes, [1, 2, 3, 4, 5, 6, 7, 8], 'oldest entry (vector 0) was evicted');

  // Selecting the evicted vector must fetch again; a cached one must not.
  const evicted = module.replaySidecarMessages(result.state, [
    { type: 'traversal/select-vector', index: 0 },
  ]);
  assert.deepEqual(evicted.commands, [
    { type: 'traversal.loadVectorDetail', workspaceRoot: '/workspace/odd_manager', runId: null, index: 0, variant: 'primary', attempt: null },
  ]);
  assert.equal(evicted.state.traversal.detailStatus, 'loading');
});

test('late traversal responses cannot evict the selected vector detail', async () => {
  const module = await loadStateModule();
  const messages = [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary: traversalSummaryFor('/workspace/odd_manager') },
  ];
  for (let index = 0; index < 8; index += 1) {
    messages.push({ type: 'traversal/select-vector', index });
    messages.push({
      type: 'traversal/vector-succeeded',
      workspaceRoot: '/workspace/odd_manager',
      index,
      variant: 'primary',
      attempt: null,
      detail: traversalDetailFor(index),
    });
  }
  const primed = module.replaySidecarMessages(baseState(module), messages).state;
  const late = module.replaySidecarMessages(primed, [8, 9].map((index) => ({
    type: 'traversal/vector-succeeded',
    workspaceRoot: '/workspace/odd_manager',
    index,
    variant: 'primary',
    attempt: null,
    detail: traversalDetailFor(index),
  })));

  assert.equal(late.state.traversal.details.length, 8);
  assert.equal(late.state.traversal.selectedVector.index, 7);
  assert.ok(late.state.traversal.details.some((entry) => entry.detail.vectorIndex === 7));
  assert.equal(late.state.traversal.detailStatus, 'ready');
});

test('summary refresh invalidates latest detail cache entries but preserves explicit attempts', async () => {
  const module = await loadStateModule();
  const summary = traversalSummaryFor('/workspace/odd_manager');
  const primed = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary },
    { type: 'traversal/select-vector', index: 1 },
    { type: 'traversal/vector-succeeded', workspaceRoot: '/workspace/odd_manager', index: 1, variant: 'primary', attempt: null, detail: traversalDetailFor(1) },
    { type: 'traversal/select-vector', index: 2, attempt: 1 },
    { type: 'traversal/vector-succeeded', workspaceRoot: '/workspace/odd_manager', index: 2, variant: 'primary', attempt: 1, detail: traversalDetailFor(2) },
    { type: 'traversal/select-vector', index: 1 },
  ]).state;

  const refreshed = module.replaySidecarMessages(primed, [
    { type: 'traversal/load', refresh: true },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary },
  ]);

  assert.equal(refreshed.state.traversal.selectedVector, null);
  assert.equal(refreshed.state.traversal.detailStatus, 'idle');
  assert.equal(refreshed.state.traversal.details.some((entry) => entry.key.endsWith(':latest')), false);
  assert.ok(refreshed.state.traversal.details.some((entry) => entry.key.endsWith(':1')));
});

test('traversal variant switch replays a distinct lazy Cmd per variant/attempt', async () => {
  const module = await loadStateModule();
  const primed = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary: traversalSummaryFor('/workspace/odd_manager') },
    { type: 'traversal/select-vector', index: 1 },
    { type: 'traversal/vector-succeeded', workspaceRoot: '/workspace/odd_manager', index: 1, variant: 'primary', attempt: null, detail: traversalDetailFor(1) },
  ]);
  const switched = module.replaySidecarMessages(primed.state, [
    { type: 'traversal/select-vector', index: 1, variant: 'evaluator', attempt: 1 },
  ]);
  assert.deepEqual(switched.commands, [
    { type: 'traversal.loadVectorDetail', workspaceRoot: '/workspace/odd_manager', runId: null, index: 1, variant: 'evaluator', attempt: 1 },
  ]);
  assert.deepEqual(switched.state.traversal.selectedVector, { index: 1, variant: 'evaluator', attempt: 1 });
  assert.equal(switched.state.traversal.detailStatus, 'loading');
});

test('traversal clear replays back to the initial slice', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'traversal/load' },
    { type: 'traversal/load-succeeded', workspaceRoot: '/workspace/odd_manager', summary: traversalSummaryFor('/workspace/odd_manager') },
    { type: 'traversal/select-vector', index: 0 },
    { type: 'traversal/clear' },
  ]);
  assert.equal(result.state.traversal.status, 'idle');
  assert.equal(result.state.traversal.summary, null);
  assert.equal(result.state.traversal.selectedVector, null);
  assert.deepEqual(result.state.traversal.details, []);
});

// Ticket Board (sprint W8) — Msg-replay proofs for the ticket-board/select
// family over the shared Drill View instantiation. Records ride the batch
// surface load; selection is reducer-owned product state.

test('ticket board open and card select replay to reducer-owned selection without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'ticket-board', id: '/workspace/odd_manager' },
    { type: 'ticket-board/select', id: 'T-100' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'ticket-board');
  assert.equal(result.state.selection.id, '/workspace/odd_manager');
  assert.ok(result.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'ticket-board:/workspace/odd_manager'));
  assert.deepEqual(result.state.ticketBoard, {
    workspaceRoot: '/workspace/odd_manager',
    selectedTicketId: 'T-100',
  });
});

test('ticket board selection survives viewer tab switches away and back', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'ticket-board', id: '/workspace/odd_manager' },
    { type: 'ticket-board/select', id: 'T-100' },
    { type: 'select', kind: 'ticket', id: 'T-100' },
    { type: 'viewer/select-tab', groupId: 'main', tabId: 'ticket-board:/workspace/odd_manager' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'ticket-board');
  assert.equal(result.state.ticketBoard.selectedTicketId, 'T-100');
});

test('ticket board select null clears the board selection', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ticket-board/select', id: 'T-100' },
    { type: 'ticket-board/select', id: null },
  ]);
  assert.deepEqual(result.commands, []);
  assert.deepEqual(result.state.ticketBoard, {
    workspaceRoot: '/workspace/odd_manager',
    selectedTicketId: null,
  });
});

test('ticket board rejects an unknown ticket id at reduce time', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ticket-board/select', id: 'T-404' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ticketBoard.selectedTicketId, null);
});

test('ticket board selection clears when a different workspace root loads (stale-root guard)', async () => {
  const module = await loadStateModule();
  const selected = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'ticket-board', id: '/workspace/odd_manager' },
    { type: 'ticket-board/select', id: 'T-100' },
    { type: 'select', kind: 'project', id: 'data_mapper' },
  ]);
  assert.deepEqual(selected.commands, [
    { type: 'load', projectRoot: '/workspace/data_mapper', reason: 'project_selected' },
  ]);
  assert.equal(selected.state.ticketBoard.selectedTicketId, 'T-100');

  const loaded = module.replaySidecarMessages(selected.state, [
    { type: 'load/request', projectRoot: '/workspace/data_mapper', reason: 'project_selected' },
    {
      type: 'load/done',
      projectRoot: '/workspace/data_mapper',
      payload: {
        context: {
          project: { id: 'data_mapper', root: '/workspace/data_mapper', odd_type: 'unknown' },
          workspace: { id: 'scala_sbt', profile: 'unknown' },
          session: null,
        },
        // Same ticket id existing in the new workspace must NOT keep the
        // stale selection: the root changed, so the selection clears.
        tickets: [{ id: 'T-100', title: 'Same id, different workspace', lane: 'active', status: 'active' }],
      },
    },
  ]);
  assert.deepEqual(loaded.state.ticketBoard, {
    workspaceRoot: '/workspace/data_mapper',
    selectedTicketId: null,
  });
});

test('ticket board selection survives a same-root reload that still carries the ticket', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ticket-board/select', id: 'T-100' },
    { type: 'load/request', projectRoot: '/workspace/odd_manager', reason: 'action_completed' },
    {
      type: 'load/done',
      projectRoot: '/workspace/odd_manager',
      payload: {
        tickets: [
          { id: 'T-100', title: 'Fix mapping', lane: 'completed', status: 'done' },
          { id: 'T-101', title: 'New ticket', lane: 'active', status: 'active' },
        ],
      },
    },
  ]);
  assert.equal(result.state.ticketBoard.selectedTicketId, 'T-100');

  // A reload that drops the selected ticket clears the selection honestly.
  const dropped = module.replaySidecarMessages(result.state, [
    { type: 'load/request', projectRoot: '/workspace/odd_manager', reason: 'action_completed' },
    {
      type: 'load/done',
      projectRoot: '/workspace/odd_manager',
      payload: { tickets: [{ id: 'T-101', title: 'New ticket', lane: 'active', status: 'active' }] },
    },
  ]);
  assert.equal(dropped.state.ticketBoard.selectedTicketId, null);
});

// AI Workspace viewer — Msg-replay proofs for promoting the .ai-workspace
// observation summary to a first-class viewer tab. The observation rides the batch surface load
// (state.aiWorkspaceObservation); opening the tab is a pure viewer action.

test('ai-workspace viewer open replays to a first-class canvas tab without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'ai-workspace', id: '/workspace/odd_manager' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'ai-workspace');
  assert.equal(result.state.selection.id, '/workspace/odd_manager');
  assert.ok(result.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'ai-workspace:/workspace/odd_manager'));
  assert.equal(result.state.ui.viewerWorkspace.groups[0].activeTabId, 'ai-workspace:/workspace/odd_manager');
});

test('ai-workspace tab survives viewer tab switches away and back', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'ai-workspace', id: '/workspace/odd_manager' },
    { type: 'select', kind: 'ticket', id: 'T-100' },
    { type: 'viewer/select-tab', groupId: 'main', tabId: 'ai-workspace:/workspace/odd_manager' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'ai-workspace');
  assert.equal(result.state.selection.id, '/workspace/odd_manager');
  assert.ok(result.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'ticket:T-100'));
  assert.ok(result.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'ai-workspace:/workspace/odd_manager'));
});

test('layout profile restore accepts a persisted ai-workspace viewer tab', async () => {
  const module = await loadStateModule();
  const contextKey = '/workspace/odd_manager::react_vite';
  const persisted = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'ai-workspace', id: '/workspace/odd_manager' },
  ]).state;
  const profile = module.sidecarLayoutProfileFromState(persisted, contextKey);
  assert.ok(profile.ui.viewerWorkspace.tabs.some((tab) => tab.kind === 'ai-workspace'));

  const restored = module.replaySidecarMessages(baseState(module), [
    { type: 'layout/profile-loaded', contextKey, payload: profile },
  ]);
  assert.deepEqual(restored.commands, []);
  assert.equal(restored.state.lastAction, null, 'profile carrying an ai-workspace tab is not rejected');
  assert.ok(restored.state.ui.viewerWorkspace.tabs.some((tab) => tab.id === 'ai-workspace:/workspace/odd_manager'));
  assert.equal(restored.state.ui.viewerWorkspace.groups[0].activeTabId, 'ai-workspace:/workspace/odd_manager');
});

test('ai-workspace viewer guards against an observation for a different root (stale-root guard)', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const summary = source.slice(
    source.indexOf('function AiWorkspaceObservationSummary('),
    source.indexOf('function FolderTreeNode('),
  );
  const inspector = source.slice(
    source.indexOf('function AiWorkspaceInspector('),
    source.indexOf('function terminalTabTitle('),
  );
  assert.match(inspector, /isAiWorkspaceObservationForProject\(state\.aiWorkspaceObservation,\s*projectRoot\)/);
  assert.match(inspector, /carries no feature-detected \.ai-workspace observation/);
  assert.match(inspector, /<AiWorkspaceObservationSummary/);
  assert.match(inspector, /onInfoSurfaceSelect\(featureId\)/);
  assert.match(inspector, /expanded/);
  assert.match(summary, /group\.featureId !== 'tickets'/);
  assert.match(summary, /group\.featureId !== 'comments'/);
  assert.match(summary, /Open \$\{feature\.label\} navigator/);
});
