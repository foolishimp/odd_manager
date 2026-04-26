// Sidecar proving scaffold — multi-pane visible "see it working" surface.
//
// Governance: T-016 (Govern sidecar proving scaffold lifecycle).
// Supersession: T-010 (Realize Project Agent Widget as Context producer in
// pure sidecar tab) deletes this file when it ships its real React widget
// inside AppShell. Until then this is a throwaway preview that proves the
// AssetSurface read paths and Context emission contract end-to-end.
//
// Banner displayed in served HTML so this is never mistaken for production UX.
//
// Spins up a tiny HTTP server on port 4174 by default and serves:
//   GET /              — single-page HTML mounting four panes:
//                        Projects | Tickets | Comments | Sessions
//   GET /api/context   — active Context record
//   GET /api/projects  — ProjectAssetSurface live read
//   GET /api/tickets   — TicketAssetSurface live read
//   GET /api/comments  — CommentAssetSurface live read
//   GET /api/sessions  — SessionAssetSurface live read (with diagnostic)
//
// Read-only across the board. Write actions and per-Project data sourcing
// are downstream tickets (T-018 / T-019 / T-020 / T-021 / T-010).
//
// Run from repo root:
//   node build_tenants/react_vite/runtime/dev/sidecar-demo.mjs
// Then open http://localhost:4174/

import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTicketSurface } from '../../src/server/ticket-asset-surface-service.mjs';
import { createCommentSurface } from '../../src/server/comment-asset-surface-service.mjs';
import { createSessionSurface } from '../../src/server/session-asset-surface-service.mjs';
import { createProjectSurface } from '../../src/server/project-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// runtime/dev → runtime → react_vite → abiogenesis → build_tenants → odd_manager
const projectRoot = resolve(here, '..', '..', '..', '..');
const PORT = Number(process.env.SIDECAR_PORT ?? 4174);
const REGISTRY_ROOT = process.env.PROJECT_REGISTRY_ROOT ?? '/Users/jim/src/apps';

// Active Context — initial value, updated by Project switcher selection in
// the browser. T-010 will source this from the Project Agent Widget's
// selection emission instead of hard-coding the initial state here.
const INITIAL_CONTEXT = {
  project: { id: 'odd_manager', root: projectRoot, odd_type: 'odd_sdlc' },
  workspace: { id: 'react_vite', profile: 'odd_sdlc' },
  session: null,
};

const ticketSurface = createTicketSurface(projectRoot);
const commentSurface = createCommentSurface(projectRoot);
const sessionSurface = createSessionSurface(projectRoot);
const projectSurface = createProjectSurface(REGISTRY_ROOT);

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
<title>odd_manager sidecar (T-016 scaffold)</title>
<style>
  :root { color-scheme: dark; }
  body { font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; margin: 0; padding: 0; background: #0e1116; color: #d8e1ec; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
  header { padding: 12px 20px; background: #161b22; border-bottom: 1px solid #2a323d; flex: none; }
  header h1 { margin: 0 0 2px 0; font-size: 17px; font-weight: 600; }
  header .subtitle { font-size: 11px; color: #8a96a8; }
  .scaffold-banner { padding: 6px 16px; background: #3d2f1f; color: #ffa86a; font-size: 11px; text-align: center; flex: none; }
  .context-bar { display: flex; gap: 20px; padding: 10px 20px; background: #1c2230; border-bottom: 1px solid #2a323d; font-size: 11px; flex: none; align-items: center; }
  .context-bar .field { display: flex; flex-direction: column; gap: 1px; }
  .context-bar .label { color: #8a96a8; text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px; }
  .context-bar .value { color: #e6ecf3; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
  .layout { display: grid; grid-template-columns: 220px 1fr 1fr 280px; flex: 1; overflow: hidden; min-height: 0; }
  .pane { border-right: 1px solid #2a323d; display: flex; flex-direction: column; min-height: 0; }
  .pane:last-child { border-right: none; }
  .pane h2 { margin: 0; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a96a8; background: #161b22; border-bottom: 1px solid #2a323d; flex: none; }
  .pane h2 .count { color: #6aa8ff; font-weight: 400; }
  .pane .body { flex: 1; overflow-y: auto; min-height: 0; }
  .pane .empty { padding: 24px 12px; color: #8a96a8; font-size: 11px; text-align: center; }
  .row { display: block; padding: 5px 12px; border-left: 3px solid transparent; cursor: pointer; }
  .row:hover { background: #1c2230; }
  .row.selected { background: #1f2a3d; border-left-color: #6aa8ff; }
  .row .id { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #6aa8ff; font-size: 11px; }
  .row .id.muted { color: #8a96a8; }
  .row .title { font-size: 12px; color: #d8e1ec; margin-top: 1px; line-height: 1.3; }
  .row .meta { font-size: 10px; color: #8a96a8; margin-top: 1px; }
  .pill { display: inline-block; padding: 1px 5px; border-radius: 3px; background: #1f2a3d; color: #6aa8ff; font-size: 9px; margin-right: 3px; }
  .pill.lane-active { background: #1f3d2d; color: #6affa3; }
  .pill.lane-completed { background: #2a2f3d; color: #d8d8d8; }
  .pill.lane-backlog { background: #3d2f1f; color: #ffa86a; }
  .pill.stdo-ux { background: #3d1f3d; color: #ff6affc7; }
  .pill.cat-review { background: #1f2a3d; color: #6aa8ff; }
  .pill.cat-strategy { background: #2a3d1f; color: #a3ff6a; }
  .pill.cat-handover { background: #3d2f1f; color: #ffa86a; }
  .pill.odd-type { background: #1f2a3d; color: #6affff; }
  .lane-section h3 { margin: 8px 12px 2px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a96a8; }
  .inspector { border-top: 1px solid #2a323d; height: 30vh; overflow-y: auto; padding: 16px 20px; flex: none; background: #0a0d12; }
  .inspector h2 { margin: 0 0 6px; font-size: 14px; }
  .inspector .id { color: #6aa8ff; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 12px; }
  .inspector .meta-grid { display: grid; grid-template-columns: max-content 1fr; gap: 3px 14px; margin: 12px 0; font-size: 11px; }
  .inspector .meta-grid .label { color: #8a96a8; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; align-self: center; }
  .inspector .meta-grid .value { font-family: ui-monospace, "SF Mono", Menlo, monospace; color: #d8e1ec; font-size: 11px; word-break: break-word; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #8a96a8; margin-top: 12px; margin-bottom: 4px; }
  .body-text { white-space: pre-wrap; font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; line-height: 1.5; color: #b6c3d3; }
  .empty-state { padding: 32px 16px; text-align: center; color: #8a96a8; font-size: 11px; }
  ul.criteria { padding-left: 18px; margin: 4px 0; }
  ul.criteria li { font-size: 11px; line-height: 1.4; color: #b6c3d3; margin-bottom: 3px; }
</style>
</head>
<body>
<header>
  <h1>odd_manager sidecar <span style="color:#8a96a8;font-weight:400;font-size:11px">(T-016 scaffold; T-010 supersedes)</span></h1>
  <div class="subtitle">Live read across <code>ProjectAssetSurface</code> · <code>TicketAssetSurface</code> · <code>CommentAssetSurface</code> · <code>SessionAssetSurface</code></div>
</header>
<div class="scaffold-banner">SCAFFOLD — vanilla JS, single file, no build step. The real sidecar tab lands as T-010 under UX_METHOD (Elm process model + Redux Toolkit + RTK Query). This file is deleted when T-010 ships.</div>
<div class="context-bar" id="context-bar"></div>
<div class="layout">
  <section class="pane" id="pane-projects">
    <h2>Projects <span class="count" id="count-projects"></span></h2>
    <div class="body" id="list-projects"><div class="empty">loading…</div></div>
  </section>
  <section class="pane" id="pane-tickets">
    <h2>Tickets <span class="count" id="count-tickets"></span></h2>
    <div class="body" id="list-tickets"><div class="empty">loading…</div></div>
  </section>
  <section class="pane" id="pane-comments">
    <h2>Comments <span class="count" id="count-comments"></span></h2>
    <div class="body" id="list-comments"><div class="empty">loading…</div></div>
  </section>
  <section class="pane" id="pane-sessions">
    <h2>Sessions <span class="count" id="count-sessions"></span></h2>
    <div class="body" id="list-sessions"><div class="empty">loading…</div></div>
  </section>
</div>
<aside class="inspector" id="inspector"><div class="empty-state">select an item from any pane</div></aside>

<script type="module">
  // The view is a pure function of state. State updates via typed actions.
  // No mutation in render. This mini-shell hand-rolls the Elm-shape that
  // T-010's full implementation will realize through Redux Toolkit per ADR 0001.

  const state = {
    context: null,
    projects: [],
    tickets: [],
    comments: [],
    sessions: { records: [], diagnostic: null },
    selection: { kind: null, id: null }, // { kind: 'project'|'ticket'|'comment'|'session', id }
  };

  async function load() {
    const [ctx, projects, tickets, comments, sessions] = await Promise.all([
      fetch('/api/context').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/tickets').then(r => r.json()),
      fetch('/api/comments').then(r => r.json()),
      fetch('/api/sessions').then(r => r.json()),
    ]);
    state.context = ctx;
    state.projects = projects;
    state.tickets = tickets;
    state.comments = comments;
    state.sessions = sessions;
    render();
  }

  function dispatch(msg) {
    // Update : (Msg, State) -> (State, Cmd). No Cmds in the scaffold.
    if (msg.type === 'select') {
      state.selection = { kind: msg.kind, id: msg.id };
      if (msg.kind === 'project') {
        const p = state.projects.find(x => x.id === msg.id);
        if (p) {
          state.context = {
            ...state.context,
            project: { id: p.id, root: p.root, odd_type: p.odd_type },
          };
        }
      }
      render();
    }
  }

  function render() {
    renderContext();
    renderProjects();
    renderTickets();
    renderComments();
    renderSessions();
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
    \`;
  }

  function renderProjects() {
    const el = document.getElementById('list-projects');
    document.getElementById('count-projects').textContent = state.projects.length;
    if (!state.projects.length) { el.innerHTML = '<div class="empty">no projects</div>'; return; }
    el.innerHTML = state.projects.map(p => \`
      <div class="row \${state.selection.kind==='project' && state.selection.id===p.id ? 'selected' : ''}" data-kind="project" data-id="\${p.id}">
        <div class="title">\${escape(p.id)}</div>
        <div class="meta">
          \${p.odd_type !== 'unknown' ? \`<span class="pill odd-type">\${p.odd_type}</span>\` : ''}
          \${p.build_tenants.length ? \`<span class="meta">\${p.build_tenants.length} tenant\${p.build_tenants.length===1?'':'s'}</span>\` : ''}
        </div>
      </div>
    \`).join('');
    bindRows(el);
  }

  function renderTickets() {
    const el = document.getElementById('list-tickets');
    document.getElementById('count-tickets').textContent = state.tickets.length;
    if (!state.tickets.length) { el.innerHTML = '<div class="empty">no tickets</div>'; return; }
    const groups = ['active', 'backlog', 'completed'];
    el.innerHTML = groups.map(lane => {
      const items = state.tickets.filter(t => t.lane === lane);
      if (!items.length) return '';
      const rows = items.map(t => {
        const isStdoUx = (t.governanceScope || '').includes('UX');
        return \`
        <div class="row \${state.selection.kind==='ticket' && state.selection.id===t.id ? 'selected' : ''}" data-kind="ticket" data-id="\${t.id}">
          <div class="id">\${t.id}</div>
          <div class="title">\${escape(t.title || '')}</div>
          \${isStdoUx ? '<div class="meta"><span class="pill stdo-ux">STDO-UX</span></div>' : ''}
        </div>\`;
      }).join('');
      return \`<div class="lane-section"><h3>\${lane} (\${items.length})</h3>\${rows}</div>\`;
    }).join('');
    bindRows(el);
  }

  function renderComments() {
    const el = document.getElementById('list-comments');
    document.getElementById('count-comments').textContent = state.comments.length;
    if (!state.comments.length) { el.innerHTML = '<div class="empty">no comments</div>'; return; }
    el.innerHTML = state.comments.map(c => {
      const catClass = c.category ? 'cat-' + c.category.toLowerCase() : '';
      return \`
      <div class="row \${state.selection.kind==='comment' && state.selection.id===c.id ? 'selected' : ''}" data-kind="comment" data-id="\${c.id}">
        <div class="id muted">\${c.author}</div>
        <div class="title">\${escape(c.title || c.subject || c.filename)}</div>
        <div class="meta">
          \${c.category ? \`<span class="pill \${catClass}">\${c.category}</span>\` : ''}
          \${c.timestamp ? \`<span>\${c.timestamp.slice(0,8)}</span>\` : ''}
        </div>
      </div>\`;
    }).join('');
    bindRows(el);
  }

  function renderSessions() {
    const el = document.getElementById('list-sessions');
    const records = state.sessions.records || [];
    document.getElementById('count-sessions').textContent = records.length;
    if (!records.length) {
      const note = state.sessions.diagnostic?.notes?.[0] || 'no sessions';
      el.innerHTML = \`<div class="empty">\${escape(note)}<br /><br /><span style="font-size:10px;color:#5a6473">backplane: \${state.sessions.diagnostic?.backplane || '—'}</span></div>\`;
      return;
    }
    el.innerHTML = records.map(s => \`
      <div class="row \${state.selection.kind==='session' && state.selection.id===s.id ? 'selected' : ''}" data-kind="session" data-id="\${s.id}">
        <div class="id">\${s.id}</div>
        <div class="title">\${s.agent_type}</div>
        <div class="meta">\${s.status}</div>
      </div>
    \`).join('');
    bindRows(el);
  }

  function bindRows(container) {
    container.querySelectorAll('.row').forEach(row => {
      row.addEventListener('click', () => dispatch({ type: 'select', kind: row.dataset.kind, id: row.dataset.id }));
    });
  }

  function renderInspector() {
    const el = document.getElementById('inspector');
    const sel = state.selection;
    if (!sel.kind) { el.innerHTML = '<div class="empty-state">select an item from any pane</div>'; return; }
    if (sel.kind === 'project') return renderProjectInspector(el);
    if (sel.kind === 'ticket') return renderTicketInspector(el);
    if (sel.kind === 'comment') return renderCommentInspector(el);
    if (sel.kind === 'session') return renderSessionInspector(el);
  }

  function renderProjectInspector(el) {
    const p = state.projects.find(x => x.id === state.selection.id);
    if (!p) { el.innerHTML = '<div class="empty-state">project not found</div>'; return; }
    el.innerHTML = \`
      <div class="id">\${p.id}</div>
      <h2>Project</h2>
      <div class="meta-grid">
        <div class="label">Root</div><div class="value">\${escape(p.root)}</div>
        <div class="label">odd_type</div><div class="value">\${p.odd_type}</div>
        <div class="label">.ai-workspace</div><div class="value">\${p.has_ai_workspace ? 'present' : 'absent'}</div>
        <div class="label">.genesis</div><div class="value">\${p.has_genesis ? 'present' : 'absent'}</div>
        <div class="label">Packages</div><div class="value">\${p.installed_packages.join(', ') || '—'}</div>
        <div class="label">Tenants</div><div class="value">\${p.build_tenants.join(', ') || '—'}</div>
      </div>
    \`;
  }

  function renderTicketInspector(el) {
    const t = state.tickets.find(x => x.id === state.selection.id);
    if (!t) { el.innerHTML = '<div class="empty-state">ticket not found</div>'; return; }
    const isStdoUx = (t.governanceScope || '').includes('UX');
    const expansion = (t.governanceScopeExpansion || []).map(m => Object.entries(m)[0]).map(([k,v]) => \`<span class="pill">\${k}: \${v}</span>\`).join('');
    const criteria = (t.evaluationCriteria || []).map(c => \`<li>\${escape(c)}</li>\`).join('');
    const deps = (Array.isArray(t.dependencies) ? t.dependencies : []).map(d => \`<span class="pill">\${escape(String(d))}</span>\`).join('');
    el.innerHTML = \`
      <div class="id">\${t.id}</div>
      <h2>\${escape(t.title || '')}</h2>
      <span class="pill lane-\${t.lane}">\${t.lane}</span>
      \${isStdoUx ? '<span class="pill stdo-ux">STDO-UX</span>' : ''}
      <span class="pill">\${escape(t.changeClass || '')}</span>
      <div class="meta-grid">
        <div class="label">Goal</div><div class="value">\${escape(t.goal || '—')}</div>
        <div class="label">Build tenant</div><div class="value">\${escape(t.buildTenant || '—')}</div>
        <div class="label">Governance</div><div class="value">\${escape(t.governanceScope || '—')} \${expansion}</div>
        <div class="label">Dependencies</div><div class="value">\${deps || '—'}</div>
      </div>
      \${t.targetTruth ? \`<div class="section-title">Target truth</div><div class="body-text">\${escape(t.targetTruth)}</div>\` : ''}
      \${t.closureLaw ? \`<div class="section-title">Closure law</div><div class="body-text">\${escape(t.closureLaw)}</div>\` : ''}
      \${criteria ? \`<div class="section-title">Evaluation criteria</div><ul class="criteria">\${criteria}</ul>\` : ''}
    \`;
  }

  function renderCommentInspector(el) {
    const c = state.comments.find(x => x.id === state.selection.id);
    if (!c) { el.innerHTML = '<div class="empty-state">comment not found</div>'; return; }
    el.innerHTML = \`
      <div class="id">\${c.id}</div>
      <h2>\${escape(c.title || c.subject || c.filename)}</h2>
      <span class="pill cat-\${(c.category||'').toLowerCase()}">\${c.category || '—'}</span>
      <div class="meta-grid">
        <div class="label">Author</div><div class="value">\${c.author}</div>
        <div class="label">Date</div><div class="value">\${escape(c.date || c.timestamp || '—')}</div>
        <div class="label">Status</div><div class="value">\${escape(c.status || '—')}</div>
        <div class="label">Addresses</div><div class="value">\${escape(c.addresses || '—')}</div>
        <div class="label">Source</div><div class="value">\${escape(c.sourcePath)}</div>
      </div>
      \${c.body ? \`<div class="section-title">Body (excerpt)</div><div class="body-text">\${escape(c.body.slice(0, 1500))}\${c.body.length > 1500 ? '\\n\\n…(truncated)' : ''}</div>\` : ''}
    \`;
  }

  function renderSessionInspector(el) {
    const records = state.sessions.records || [];
    const s = records.find(x => x.id === state.selection.id);
    if (!s) { el.innerHTML = '<div class="empty-state">session not found</div>'; return; }
    el.innerHTML = \`
      <div class="id">\${s.id}</div>
      <h2>Session</h2>
      <div class="meta-grid">
        <div class="label">Agent</div><div class="value">\${s.agent_type}</div>
        <div class="label">Status</div><div class="value">\${s.status}</div>
        <div class="label">CWD</div><div class="value">\${escape(s.cwd)}</div>
        <div class="label">Started</div><div class="value">\${escape(s.started_at || '—')}</div>
        <div class="label">Project</div><div class="value">\${escape(s.context_at_spawn?.project || '—')}</div>
        <div class="label">Workspace</div><div class="value">\${escape(s.context_at_spawn?.workspace || '—')}</div>
        <div class="label">Transcript</div><div class="value">\${escape(s.transcript_ref || '—')}</div>
      </div>
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
    return jsonResponse(res, 200, INITIAL_CONTEXT);
  }
  if (req.method === 'GET' && url.pathname === '/api/projects') {
    return jsonResponse(res, 200, projectSurface.list());
  }
  if (req.method === 'GET' && url.pathname === '/api/tickets') {
    return jsonResponse(res, 200, ticketSurface.list());
  }
  if (req.method === 'GET' && url.pathname === '/api/comments') {
    return jsonResponse(res, 200, commentSurface.list());
  }
  if (req.method === 'GET' && url.pathname === '/api/sessions') {
    return jsonResponse(res, 200, {
      records: sessionSurface.list(),
      diagnostic: sessionSurface.diagnostic(),
    });
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

server.listen(PORT, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`sidecar demo: http://localhost:${PORT}/`);
  // eslint-disable-next-line no-console
  console.log(`  /api/context   active context`);
  // eslint-disable-next-line no-console
  console.log(`  /api/projects  ${projectSurface.list().length} projects`);
  // eslint-disable-next-line no-console
  console.log(`  /api/tickets   ${ticketSurface.list().length} tickets`);
  // eslint-disable-next-line no-console
  console.log(`  /api/comments  ${commentSurface.list().length} comments`);
  // eslint-disable-next-line no-console
  console.log(`  /api/sessions  diagnostic ${sessionSurface.diagnostic().backplane}`);
});
