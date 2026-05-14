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
const serverIndexPath = resolve(here, '../../src/server/index.mjs');
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
      project: { id: 'odd_manager', root: '/workspace/odd_manager', odd_type: 'odd_sdlc' },
      workspace: { id: 'react_vite', profile: 'odd_sdlc' },
      session: null,
    },
    projects: [
      {
        id: 'odd_manager',
        root: '/workspace/odd_manager',
        odd_type: 'odd_sdlc',
        has_ai_workspace: true,
        has_genesis: true,
        installed_packages: ['odd_sdlc'],
        build_tenants: ['react_vite'],
      },
      {
        id: 'data_mapper',
        root: '/workspace/data_mapper',
        odd_type: 'odd_sdlc',
        has_ai_workspace: true,
        has_genesis: true,
        installed_packages: ['odd_sdlc'],
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
        project: { id: 'odd_manager', root: '/workspace/odd_manager', odd_type: 'odd_sdlc' },
        workspace: { id: 'react_vite', profile: 'odd_sdlc' },
        session: null,
      },
      tickets: [{ id: 'STALE', title: 'stale ticket', lane: 'active', status: 'active' }],
    },
  });
  assert.equal(stale.context.project.root, '/workspace/odd_manager');
  assert.equal(stale.activeLoadRoot, '/workspace/data_mapper');
  assert.deepEqual(stale.tickets, requested.tickets);

  const current = module.updateSidecarState(stale, {
    type: 'load/done',
    projectRoot: '/workspace/data_mapper',
    payload: {
      context: {
        project: { id: 'data_mapper', root: '/workspace/data_mapper', odd_type: 'odd_sdlc' },
        workspace: { id: 'scala_sbt', profile: 'odd_sdlc' },
        session: null,
      },
      tickets: [{ id: 'CURRENT', title: 'current ticket', lane: 'active', status: 'active' }],
    },
  });
  assert.equal(current.context.project.root, '/workspace/data_mapper');
  assert.equal(current.activeLoadRoot, null);
  assert.equal(current.tickets[0].id, 'CURRENT');
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
    source: 'browse',
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
    { type: 'session.spawn', projectRoot: '/workspace/odd_manager', groupId: 'main' },
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
  assert.match(railSource, /<ContextRailCommand[\s\S]*label="Open Process Navigator"/);
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
    { type: 'process/select-view', view: 'blocked_waiting' },
    { type: 'process/select-record', id: 'process-record-1' },
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
  assert.equal(result.state.ui.activeProcessView, 'blocked_waiting');
  assert.equal(result.state.ui.activeProcessRecordId, 'process-record-1');
  assert.equal(result.state.ui.terminalWorkspace.groups[0].activeTabId, 'session:sess-1');
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

test('shared document viewer adapter governs Mermaid, Shiki, and pointer panning', () => {
  const source = readFileSync(documentViewerPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');

  assert.match(source, /securityLevel:\s*"strict"/);
  assert.match(source, /flowchart:\s*\{\s*htmlLabels:\s*false\s*\}/);
  assert.match(source, /stableHash\(`\$\{descriptorId\}:\$\{blockIndex\}:\$\{source\}`\)/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /import\(["']shiki["']\)/);
  for (const language of ['python', 'typescript', 'tsx', 'javascript', 'jsx', 'json', 'yaml', 'java', 'scala', 'rust', 'markdown']) {
    assert.match(source, new RegExp(`${language}: \\(\\) => import\\("@shikijs/langs/${language}"\\)`));
  }
  assert.match(source, /"github-light":\s*\(\) => import\("@shikijs\/themes\/github-light"\)/);
  assert.match(source, /"github-dark":\s*\(\) => import\("@shikijs\/themes\/github-dark"\)/);
  assert.match(source, /theme:\s*appTheme === "light" \? "github-light" : "github-dark"/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /dangerouslySetInnerHTML=\{\{\s*__html:\s*html\s*\}\}/);
  assert.match(source, /onPointerDown=\{beginPan\}/);
  assert.match(source, /setPointerCapture\(event\.pointerId\)/);
  assert.match(source, /onWheel=\{handleWheel\}/);
  assert.match(source, /nearestScrollableParent\(viewport\)/);
  assert.match(source, /viewport\.clientWidth \/ zoom/);
  assert.match(source, /--document-viewer-layout-width/);
  assert.match(source, /content\.offsetWidth \* \(zoom - 1\)/);
  assert.match(source, /content\.offsetHeight \* \(zoom - 1\)/);
  assert.doesNotMatch(source, /Math\.max\(0,\s*content\.offsetWidth \* \(zoom - 1\)\)/);
  assert.match(source, /normalizeMermaidSvg\(hostRef\.current\)/);
  assert.match(source, /svg\.style\.width = `\$\{viewBoxWidth\}px`/);
  assert.match(source, /className="markdown-viewer__table-wrap"/);
  assert.match(styles, /\.document-viewer__viewport\s*\{[^}]*overflow:\s*auto;[^}]*cursor:\s*grab;[^}]*touch-action:\s*pan-x\s+pan-y;/s);
  assert.match(styles, /\.document-viewer__viewport\s*\{[^}]*container-type:\s*inline-size;/s);
  assert.match(styles, /\.document-viewer__content\s*\{[^}]*width:\s*var\(--document-viewer-layout-width,\s*100%\);[^}]*max-width:\s*var\(--document-viewer-layout-width,\s*100%\);/s);
  assert.match(styles, /\.document-viewer__viewport\.is-fit-width\s+\.document-viewer__content/s);
  assert.match(styles, /\.markdown-viewer__table-wrap\s*\{[^}]*width:\s*min\(100%,\s*100cqw\);[^}]*max-width:\s*100cqw;[^}]*overflow-x:\s*auto;/s);
  assert.match(styles, /\.markdown-viewer table\s*\{[^}]*table-layout:\s*fixed;/s);
  assert.match(styles, /\.markdown-viewer th,\s*\.markdown-viewer td\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(styles, /\.markdown-viewer__mermaid\s*\{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;/s);
  assert.match(styles, /\.markdown-viewer__mermaid svg\s*\{[^}]*margin:\s*0;/s);
  assert.match(styles, /\.document-viewer__highlight pre\s*\{[^}]*background:\s*var\(--code-bg\)\s*!important;/s);
  assert.match(styles, /\.document-viewer__highlight pre\s*\{[^}]*overflow:\s*visible;/s);
});

test('Sidecar load keeps Projects visible when a workspace-scoped surface fails', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  assert.match(source, /settleSurface\('projects'/);
  assert.match(source, /payload\.projects = projects\.value/);
  assert.match(source, /load partial:/);
  assert.doesNotMatch(source, /const error = `load failed:/);
});

test('Sidecar browser requests uncapped filesystem entries while generic browse stays bounded', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const serverSource = readFileSync(serverIndexPath, 'utf-8');
  assert.match(source, /\/api\/fs\/browse\?path=\$\{encodeURIComponent\(path\)\}&includeFiles=1&includeHidden=1&maxEntries=0/);
  assert.match(source, /No child entries\./);
  assert.match(source, /Showing first 500 entries\./);
  assert.doesNotMatch(source, /Showing first 500 folders\./);
  assert.match(serverSource, /function browseMaxEntriesFromParam\(value\)/);
  assert.match(serverSource, /if \(normalized === "all"\) return 0;/);
  assert.match(serverSource, /const listedEntries = maxEntries > 0 \? visibleEntries\.slice\(0, maxEntries\) : visibleEntries;/);
  assert.match(serverSource, /truncated: maxEntries > 0 && visibleEntries\.length > maxEntries/);
});

test('sidecar project selection promotes one active Project root across shell and browser', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const routeSource = readFileSync(workspaceRoutePath, 'utf-8');
  assert.match(source, /const currentProjectRoot = state\.activeLoadRoot \?\? state\.context\?\.project\.root \?\? projectRoot \?\? null;/);
  assert.match(source, /await setActiveProject\(project\.id\)/);
  assert.match(source, /await setActiveProject\(root\)/);
  assert.match(routeSource, /<SidecarPanel[\s\S]*projectRoot=\{workspaceRoot\}[\s\S]*onContextChange=\{\(ctx\) => \{/);
  assert.match(routeSource, /if \(ctx\.project\.root !== workspaceRoot\) \{[\s\S]*onProjectRootChange\(ctx\.project\.root\);/);
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
  assert.equal(result.state.ui.shellCollapsed, false);
  assert.equal(result.state.ui.terminalWorkspace.groups[0].activeTabId, 'session:sess-1');
  assert.equal(result.state.lastAction.ok, false);
  assert.match(result.state.lastAction.error, /layout profile save failed/);
});

test('rail flyout surface selection replays without Cmd effects', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'ui/toggle-workspace', workspace: 'info', collapsed: true },
    { type: 'ui/select-info-surface', surface: 'projects' },
    { type: 'ui/select-info-surface', surface: 'comments', open: false },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.ui.activeInfoSurface, 'comments');
  assert.equal(result.state.ui.infoCollapsed, true);
});

test('explorer provider registry omits sessions while session selection replays without Cmd effects', async () => {
  const module = await loadStateModule();
  assert.deepEqual(
    module.SIDECAR_EXPLORER_PROVIDERS.map((provider) => provider.id),
    ['projects', 'tickets', 'comments', 'browse', 'history'],
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

test('process navigator opens as an object viewer tab and keeps view selection in reducer state', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(baseState(module), [
    { type: 'viewer/open', kind: 'process', id: 'navigator' },
    { type: 'process/select-record', id: 'process-record-1' },
    { type: 'process/select-view', view: 'ready_handoff' },
    { type: 'process/select-record', id: 'process-record-2' },
  ]);
  assert.deepEqual(result.commands, []);
  assert.equal(result.state.selection.kind, 'process');
  assert.equal(result.state.selection.id, 'navigator');
  assert.equal(result.state.ui.activeProcessView, 'ready_handoff');
  assert.equal(result.state.ui.activeProcessRecordId, 'process-record-2');
  assert.deepEqual(
    result.state.ui.viewerWorkspace.tabs.map((tab) => [tab.id, tab.kind, tab.objectId]),
    [['process:navigator', 'process', 'navigator']],
  );
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
    { type: 'session.spawn', projectRoot: '/workspace/odd_manager', groupId: 'secondary' },
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
    /\.sidecar-workbench\s*\{[^}]*height:\s*calc\(100vh\s*-\s*4\.9rem\);[^}]*min-height:\s*calc\(100vh\s*-\s*200px\);/s,
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
  assert.match(railSource, /<ContextRailCommand[\s\S]*symbol="N0"[\s\S]*label="Open Process Navigator N0"/);
  assert.ok(
    railSource.indexOf('label="Open Process Navigator"') < railSource.indexOf("label={state.ui.shellCollapsed ? 'Restore shell workspace' : 'Minimize shell workspace'}"),
    'Process Navigator is the first right-rail command',
  );
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

test('process navigator source is right-rail selected and object-viewer hosted', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');
  const railSource = source.slice(
    source.indexOf('<aside className="sidecar-context-rail"'),
    source.indexOf('<section className="sidecar-bottom-dock"'),
  );
  const processPanelSource = source.slice(
    source.indexOf('function ProcessNavigatorPanel'),
    source.indexOf('function ProcessRecordDetail'),
  );
  const simpleProcessPanelSource = source.slice(
    source.indexOf('function ProcessNavigatorSimplePanel'),
    source.indexOf('function ProcessNavigatorPanel'),
  );

  assert.match(railSource, /<ContextRailCommand[\s\S]*label="Open Process Navigator"[\s\S]*type: 'viewer\/open', kind: 'process', id: 'navigator-simple'/);
  assert.match(railSource, /<ContextRailCommand[\s\S]*symbol="N0"[\s\S]*label="Open Process Navigator N0"[\s\S]*type: 'viewer\/open', kind: 'process', id: 'navigator'/);
  assert.match(railSource, /type: 'ui\/toggle-workspace', workspace: 'info', collapsed: true/);
  assert.match(source, /state\.ui\.infoPinned\) return;/);
  assert.match(source, /type: 'ui\/set-info-pinned'/);
  assert.match(styles, /\.sidecar-workbench\.is-left-pinned\s+\.sidecar-main-area\s*\{[^}]*grid-template-columns:\s*min\(var\(--sidecar-explorer-width,\s*24rem\),\s*42%\)\s+minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.sidecar-workbench\.is-left-pinned\s+\.sidecar-flyout\s*\{[^}]*position:\s*relative;[^}]*width:\s*100%;[^}]*height:\s*100%;/s);
  assert.match(styles, /\.sidecar-workbench\.is-left-pinned\s+\.sidecar-canvas\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(source, /if \(tab\.objectId === 'navigator-simple'\) \{[\s\S]*<ProcessNavigatorSimplePanel state=\{state\} dispatch=\{dispatch\} \/>/);
  assert.match(source, /return tab\.objectId === 'navigator' \? 'Process Navigator N0' : 'Process Navigator';/);
  assert.match(simpleProcessPanelSource, /Graph Overlays/);
  assert.match(simpleProcessPanelSource, /Graph Functions/);
  assert.match(simpleProcessPanelSource, /Leaf Assets/);
  assert.match(simpleProcessPanelSource, /traversalOverlays/);
  assert.match(simpleProcessPanelSource, /ProcessOverlayCard/);
  assert.match(simpleProcessPanelSource, /ProcessSimpleGraphPanel/);
  assert.match(simpleProcessPanelSource, /buildSimpleOverlayGraph/);
  assert.match(simpleProcessPanelSource, /buildSimpleFunctionGraph/);
  assert.match(simpleProcessPanelSource, /buildSimpleAssetGraph/);
  assert.match(simpleProcessPanelSource, /Use N0 for the legacy process maps/);
  assert.match(simpleProcessPanelSource, /processAssetRelationships/);
  assert.doesNotMatch(processPanelSource, /Observed SDLC Surfaces|Recent Failures|Recent Activity|Tests \/ Qualification/);
  assert.match(processPanelSource, /ProcessGraphMap/);
  assert.match(processPanelSource, /aria-label="Process maps"/);
  assert.match(processPanelSource, /type: 'process\/select-map'/);
  assert.match(processPanelSource, /<line[\s\S]*className=\{`sidecar-process-map__edge/);
  assert.match(processPanelSource, /const primaryRecordId = node\.recordIds\.find\(\(id\) => activeRecordSet\.has\(id\)\) \?\? null;/);
  assert.match(processPanelSource, /panel__eyebrow">Saved Views/);
  assert.match(processPanelSource, /panel__eyebrow">Active Query/);
  assert.match(processPanelSource, /panel__eyebrow">Process Explorer/);
  assert.match(styles, /\.sidecar-process-navigator\s*\{/);
  assert.match(styles, /\.sidecar-process-layout\s*\{[^}]*grid-template-columns:\s*minmax\(18rem,\s*0\.82fr\)\s+minmax\(0,\s*1\.28fr\);/s);
  assert.match(styles, /\.sidecar-process-map-stack\s*,\s*\.sidecar-process-navigator__views\s*\{/s);
  assert.match(styles, /\.sidecar-process-simple\s*\{/);
  assert.match(styles, /\.sidecar-process-simple__tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/s);
  assert.match(styles, /\.sidecar-process-simple__graph\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\);/s);
  assert.match(styles, /\.sidecar-process-simple__graph\s+\.sidecar-process-map__viewport\s*\{/);
  assert.match(styles, /\.sidecar-process-overlay-card\s*,\s*\.sidecar-process-function-card\s*,\s*\.sidecar-process-asset-card\s*\{/);
  assert.match(styles, /\.sidecar-process-overlay-card\.is-selected,\s*\.sidecar-process-function-card\.is-selected,\s*\.sidecar-process-asset-card\.is-selected\s*\{/);
  assert.match(styles, /\.sidecar-process-map__viewport\s*\{/);
  assert.match(styles, /\.sidecar-process-map__edge\s*\{[^}]*stroke-width:\s*8px;[^}]*opacity:\s*0\.24;/s);
  assert.match(styles, /\.sidecar-process-map__edge\.is-selected\s*\{[^}]*stroke-width:\s*14px;/s);
  assert.match(styles, /\.sidecar-process-map-node\.is-muted\s*\{[^}]*background:[^}]*var\(--panel\)[^}]*filter:\s*saturate\(0\.72\);/s);
});

test('process map edges use intrinsic canvas coordinates so line endpoints stay attached to nodes', () => {
  const source = readFileSync(sidecarPanelPath, 'utf-8');
  const styles = readFileSync(stylesPath, 'utf-8');
  const processPanelSource = source.slice(
    source.indexOf('function ProcessGraphMap'),
    source.indexOf('function processMapEdgeAnchor'),
  );

  assert.match(processPanelSource, /<svg[\s\S]*className="sidecar-process-map__edges"[\s\S]*width=\{width\}[\s\S]*height=\{height\}[\s\S]*viewBox=\{`0 0 \$\{width\} \$\{height\}`\}/);
  assert.match(styles, /\.sidecar-process-map__edges\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0\s+auto\s+auto\s+0;[^}]*pointer-events:\s*none;/s);
  assert.doesNotMatch(styles, /\.sidecar-process-map__edges\s*\{[^}]*width:\s*100%;/s);
  assert.doesNotMatch(styles, /\.sidecar-process-map__edges\s*\{[^}]*height:\s*100%;/s);
  assert.match(styles, /\.sidecar-process-map-node\s*\{[^}]*width:\s*176px;[^}]*height:\s*86px;/s);
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
  assert.match(terminalWorkspaceSource, /className="sidecar-terminal-toolbar__tabs"/);
  assert.doesNotMatch(terminalWorkspaceSource, /sidecar-shell-manager/);
  assert.doesNotMatch(terminalGroupSource, /sidecar-terminal-tabs/);
  assert.doesNotMatch(sessionWindowSource, /<MetaGrid/);
  assert.doesNotMatch(sessionWindowSource, /sidecar-session-window__body/);
  assert.match(sessionWindowSource, /<SidecarTerminal session=\{session\} projectRoot=\{projectRoot\} \/>/);
  assert.doesNotMatch(sidecarTerminalSource, /agent-console__terminal-bar/);
});

test('sidecar density CSS keeps controls shallow and gives height to terminal host', () => {
  const sidecarBlock = readSidecarCssBlock();
  assert.match(
    sidecarBlock,
    /\.sidecar-context-rail__command\s*\{[^}]*box-shadow:\s*none;[^}]*cursor:\s*pointer;[^}]*transform:\s*none;/s,
  );
  assert.match(
    sidecarBlock,
    /\.sidecar-terminal-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(10rem,\s*18rem\)\s+minmax\(12rem,\s*0\.85fr\)\s+minmax\(12rem,\s*1\.15fr\)\s+auto\s+auto\s+auto;[^}]*padding:\s*0\.22rem\s+0\.28rem;/s,
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
  assert.match(terminalGroupSource, /tabIndex=\{0\}/);
  assert.match(terminalGroupSource, /onPointerDownCapture=\{\(\) => dispatch\(\{ type: 'terminal\/focus-group', groupId: group\.id \}\)\}/);
  assert.match(collapsedDockSource, /<ResizeHandle[\s\S]*target="bottomDock"[\s\S]*label="Resize terminal dock"/);

  const sidecarBlock = readSidecarCssBlock();
  assert.match(
    sidecarBlock,
    /\.sidecar-action-result\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s,
  );
});
