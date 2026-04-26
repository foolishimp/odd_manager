// Sidecar demo — minimum viable visible "see it working" surface.
//
// Spins up a tiny HTTP server on a side port (default 4174) and serves:
//   GET /              → a single HTML page that renders the active Context,
//                        the project info, and a live list of tickets read
//                        through the new TicketAssetSurface.
//   GET /api/tickets   → typed JSON of all tickets in the current Project's
//                        .ai-workspace/tickets/ tree.
//   GET /api/context   → the active Context record (project + workspace).
//
// This is NOT the real T-010 widget. It is a scaffold that proves the
// AssetSurface + Context contracts end-to-end through HTTP and a browser.
// T-010 will replace this with the embeddable React component governed by
// UX_METHOD; this scaffold is throwaway.
//
// Run from repo root:
//   node build_tenants/react_vite/runtime/dev/sidecar-demo.mjs
//
// Then open http://localhost:4174/ in a browser.

import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createTicketSurface,
} from '../../src/server/ticket-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// runtime/dev → runtime → react_vite → abiogenesis → build_tenants → odd_manager
const projectRoot = resolve(here, '..', '..', '..', '..');
const PORT = Number(process.env.SIDECAR_PORT ?? 4174);

// Active Context — hard-coded for the scaffold. T-010 will source this from
// the Project Agent Widget's selection emission.
const ACTIVE_CONTEXT = {
  project: {
    id: 'odd_manager',
    root: projectRoot,
    odd_type: 'odd_sdlc',
  },
  workspace: {
    id: 'react_vite',
    profile: 'odd_sdlc',
  },
  session: null,
};

const ticketSurface = createTicketSurface(projectRoot);

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function htmlResponse(res, body) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

const SIDECAR_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>odd_manager sidecar (scaffold)</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 0; background: #0e1116; color: #d8e1ec; }
  header { padding: 16px 24px; background: #161b22; border-bottom: 1px solid #2a323d; }
  header h1 { margin: 0 0 4px 0; font-size: 18px; font-weight: 600; }
  header .subtitle { font-size: 12px; color: #8a96a8; }
  .context-bar { display: flex; gap: 24px; padding: 12px 24px; background: #1c2230; border-bottom: 1px solid #2a323d; font-size: 12px; }
  .context-bar .field { display: flex; flex-direction: column; gap: 2px; }
  .context-bar .label { color: #8a96a8; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
  .context-bar .value { color: #e6ecf3; font-family: ui-monospace, "SF Mono", Menlo, monospace; }
  .layout { display: grid; grid-template-columns: 320px 1fr; gap: 0; height: calc(100vh - 100px); }
  .lane-list { border-right: 1px solid #2a323d; overflow-y: auto; padding: 8px 0; }
  .lane-section { margin-bottom: 12px; }
  .lane-section h2 { margin: 8px 16px 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a96a8; }
  .ticket-row { display: block; padding: 6px 16px; border-left: 3px solid transparent; cursor: pointer; }
  .ticket-row:hover { background: #1c2230; }
  .ticket-row.selected { background: #1f2a3d; border-left-color: #6aa8ff; }
  .ticket-row .id { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #6aa8ff; font-size: 12px; }
  .ticket-row .title { font-size: 13px; color: #d8e1ec; margin-top: 1px; }
  .inspector { overflow-y: auto; padding: 24px; }
  .inspector h2 { margin: 0 0 8px; font-size: 16px; }
  .inspector .id { color: #6aa8ff; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 13px; }
  .inspector .meta-grid { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 16px 0; font-size: 12px; }
  .inspector .meta-grid .label { color: #8a96a8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; align-self: center; }
  .inspector .meta-grid .value { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #d8e1ec; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 3px; background: #1f2a3d; color: #6aa8ff; font-size: 10px; margin-right: 4px; }
  .pill.lane-active { background: #1f3d2d; color: #6affa3; }
  .pill.lane-completed { background: #2a2f3d; color: #d8d8d8; }
  .pill.lane-backlog { background: #3d2f1f; color: #ffa86a; }
  .pill.stdo-ux { background: #3d1f3d; color: #ff6affc7; }
  .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a96a8; margin-top: 16px; margin-bottom: 6px; }
  .body-text { white-space: pre-wrap; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; line-height: 1.5; color: #b6c3d3; }
  .empty { padding: 48px 24px; text-align: center; color: #8a96a8; }
  ul.criteria { padding-left: 20px; margin: 4px 0; }
  ul.criteria li { font-size: 12px; line-height: 1.5; color: #b6c3d3; margin-bottom: 4px; }
  .scaffold-banner { padding: 6px 16px; background: #3d2f1f; color: #ffa86a; font-size: 11px; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>odd_manager sidecar <span style="color:#8a96a8;font-weight:400;font-size:12px">(T-010 scaffold)</span></h1>
  <div class="subtitle">Live read of <code>.ai-workspace/tickets</code> via <code>TicketAssetSurface</code> (T-007)</div>
</header>
<div class="scaffold-banner">SCAFFOLD — this is a throwaway preview proving T-007 + Context end-to-end. The real sidecar tab lands as T-010 under UX_METHOD (Elm process model + Redux Toolkit + RTK Query).</div>
<div class="context-bar" id="context-bar"></div>
<div class="layout">
  <nav class="lane-list" id="lane-list"><div class="empty">loading…</div></nav>
  <main class="inspector" id="inspector"><div class="empty">select a ticket on the left</div></main>
</div>

<script type="module">
  // The view is a pure function of state. State updates via typed actions.
  // No mutation in render. This mini-shell hand-rolls the Elm-shape that
  // T-010's full implementation will realize through Redux Toolkit.

  const state = { context: null, tickets: [], selectedId: null };

  async function load() {
    const [ctxRes, ticketsRes] = await Promise.all([
      fetch('/api/context'),
      fetch('/api/tickets'),
    ]);
    state.context = await ctxRes.json();
    state.tickets = await ticketsRes.json();
    render();
  }

  function dispatch(msg) {
    // Update : (Msg, State) -> (State, Cmd). No Cmds in the scaffold.
    if (msg.type === 'select') {
      state.selectedId = msg.id;
      render();
    }
  }

  // View = f(State).
  function render() {
    renderContext();
    renderLaneList();
    renderInspector();
  }

  function renderContext() {
    const el = document.getElementById('context-bar');
    const c = state.context;
    if (!c) { el.innerHTML = ''; return; }
    el.innerHTML = \`
      <div class="field"><span class="label">Project</span><span class="value">\${c.project.id}</span></div>
      <div class="field"><span class="label">odd_type</span><span class="value">\${c.project.odd_type}</span></div>
      <div class="field"><span class="label">Workspace</span><span class="value">\${c.workspace.id}</span></div>
      <div class="field"><span class="label">Profile</span><span class="value">\${c.workspace.profile}</span></div>
      <div class="field"><span class="label">Session</span><span class="value">\${c.session ? c.session.id : '— none —'}</span></div>
      <div class="field"><span class="label">Tickets</span><span class="value">\${state.tickets.length}</span></div>
    \`;
  }

  function laneSection(label, lane) {
    const items = state.tickets.filter(t => t.lane === lane);
    if (!items.length) return '';
    const rows = items.map(t => \`
      <div class="ticket-row \${t.id === state.selectedId ? 'selected' : ''}" data-id="\${t.id}">
        <div class="id">\${t.id}</div>
        <div class="title">\${escape(t.title)}</div>
      </div>
    \`).join('');
    return \`<div class="lane-section"><h2>\${label} (\${items.length})</h2>\${rows}</div>\`;
  }

  function renderLaneList() {
    const el = document.getElementById('lane-list');
    el.innerHTML =
      laneSection('Active', 'active') +
      laneSection('Backlog', 'backlog') +
      laneSection('Completed', 'completed');
    el.querySelectorAll('.ticket-row').forEach(row => {
      row.addEventListener('click', () => dispatch({ type: 'select', id: row.dataset.id }));
    });
  }

  function renderInspector() {
    const el = document.getElementById('inspector');
    const t = state.tickets.find(x => x.id === state.selectedId);
    if (!t) { el.innerHTML = '<div class="empty">select a ticket on the left</div>'; return; }
    const isStdoUx = (t.governanceScope || '').includes('UX');
    const expansion = (t.governanceScopeExpansion || []).map(m => Object.entries(m)[0]).map(([k,v]) => \`<span class="pill">\${k}: \${v}</span>\`).join('');
    const criteria = (t.evaluationCriteria || []).map(c => \`<li>\${escape(c)}</li>\`).join('');
    const nonClosure = (t.nonClosureConditions || []).map(c => \`<li>\${escape(c)}</li>\`).join('');
    const deps = (t.dependencies || []).map(d => \`<span class="pill">\${escape(String(d))}</span>\`).join('');

    el.innerHTML = \`
      <div class="id">\${t.id}</div>
      <h2>\${escape(t.title)}</h2>
      <span class="pill lane-\${t.lane}">\${t.lane}</span>
      \${isStdoUx ? '<span class="pill stdo-ux">STDO-UX</span>' : ''}
      <span class="pill">\${escape(t.changeClass || '')}</span>
      <span class="pill">\${escape(t.type || '')}</span>

      <div class="meta-grid">
        <div class="label">Goal</div><div class="value">\${escape(t.goal || '—')}</div>
        <div class="label">Re-entry</div><div class="value">\${escape(t.reEntryPoint || '—')}</div>
        <div class="label">Build tenant</div><div class="value">\${escape(t.buildTenant || '—')}</div>
        <div class="label">Priority</div><div class="value">\${escape(t.priority || '—')}</div>
        <div class="label">Governance</div><div class="value">\${escape(t.governanceScope || '—')}</div>
        <div class="label">Expansion</div><div class="value">\${expansion || '—'}</div>
        <div class="label">Dependencies</div><div class="value">\${deps || '—'}</div>
        <div class="label">Source</div><div class="value">\${escape(t.sourcePath || '—')}</div>
      </div>

      \${t.changeIntent ? \`<div class="section-title">Change intent</div><div class="body-text">\${escape(t.changeIntent)}</div>\` : ''}
      \${t.targetTruth ? \`<div class="section-title">Target truth</div><div class="body-text">\${escape(t.targetTruth)}</div>\` : ''}
      \${t.closureLaw ? \`<div class="section-title">Closure law</div><div class="body-text">\${escape(t.closureLaw)}</div>\` : ''}
      \${criteria ? \`<div class="section-title">Evaluation criteria</div><ul class="criteria">\${criteria}</ul>\` : ''}
      \${nonClosure ? \`<div class="section-title">Non-closure conditions</div><ul class="criteria">\${nonClosure}</ul>\` : ''}
    \`;
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  load();
</script>
</body>
</html>`;

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/') {
    return htmlResponse(res, SIDECAR_HTML);
  }
  if (req.method === 'GET' && url.pathname === '/api/context') {
    return jsonResponse(res, 200, ACTIVE_CONTEXT);
  }
  if (req.method === 'GET' && url.pathname === '/api/tickets') {
    return jsonResponse(res, 200, ticketSurface.list());
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`sidecar demo: http://localhost:${PORT}/`);
  // eslint-disable-next-line no-console
  console.log(`  /api/context  active context`);
  // eslint-disable-next-line no-console
  console.log(`  /api/tickets  TicketAssetSurface live read (${ticketSurface.list().length} tickets)`);
});
