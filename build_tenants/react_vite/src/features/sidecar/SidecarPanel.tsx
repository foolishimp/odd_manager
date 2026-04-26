// SidecarPanel — the real React Project Agent Widget. Closes T-010.
//
// Realizes the four AssetSurfaces (Projects, Tickets, Comments, Sessions)
// + the Context bar + the Inspector in React, governed by UX_METHOD §4 (Elm
// process model: View = f(State), Msg → Update, Cmd at the effect membrane)
// and ADR 0001 (stack: typed reducer + Cmd interpreter + shared contracts).
//
// Steel-thread first cut:
//   - useReducer for State / Msg / Update (RTK upgrade is circle-back)
//   - useEffect as the effect membrane invoking Cmd descriptors
//   - fetch against the scaffold backend at SIDECAR_BACKEND (default
//     http://localhost:4174) so the component works without index.mjs edits;
//     T-014 will wire equivalent /api routes into the main odd_manager
//     server and this constant becomes a relative '/api' path.
//
// Mounting (user's 1-line circle-back):
//   import { SidecarPanel } from './features/sidecar/SidecarPanel';
//   ...
//   <SidecarPanel />
//
// The component owns its own State; embedding sites can pass `onContextChange`
// to lift the active Context up. Pin-to-global semantics: the embedded
// surface's selection is local; calling onContextChange promotes to global.

import { useEffect, useReducer, useCallback } from 'react';
import type { TicketRecord } from '../../contracts/ticket';
import type { CommentRecord } from '../../contracts/comment';
import type { SessionRecord, SessionSurfaceDiagnostic } from '../../contracts/session';
import type { ProjectRecord } from '../../contracts/project';

// Endpoints served by the main odd_manager server (src/server/index.mjs).
// T-016 absorbed the scaffold's routes; relative '' lets Vite proxy /api/* to
// the dev server backend automatically.
const SIDECAR_BACKEND = (typeof window !== 'undefined' && (window as { __SIDECAR_BACKEND__?: string }).__SIDECAR_BACKEND__) || '';

interface ContextRecord {
  project: { id: string; root: string; odd_type: string };
  workspace: { id: string; profile: string };
  session: null | { id: string };
}

type SelectionKind = 'project' | 'ticket' | 'comment' | 'session' | null;
interface Selection { kind: SelectionKind; id: string | null }

interface State {
  context: ContextRecord | null;
  projects: ProjectRecord[];
  tickets: TicketRecord[];
  comments: CommentRecord[];
  sessions: { records: SessionRecord[]; diagnostic: SessionSurfaceDiagnostic | null };
  selection: Selection;
  unreadIds: string[];
  viewerAgent: string;
  lastAction: { ok: boolean; message?: string; error?: string } | null;
  replyDraft: { parentId: string; body: string } | null;
  loading: boolean;
}

type Msg =
  | { type: 'load/start' }
  | { type: 'load/done'; payload: Partial<State> }
  | { type: 'select'; kind: Exclude<SelectionKind, null>; id: string }
  | { type: 'reply/open'; parentId: string }
  | { type: 'reply/edit'; body: string }
  | { type: 'reply/cancel' }
  | { type: 'action/result'; ok: boolean; message?: string; error?: string };

const INITIAL_STATE: State = {
  context: null,
  projects: [],
  tickets: [],
  comments: [],
  sessions: { records: [], diagnostic: null },
  selection: { kind: null, id: null },
  unreadIds: [],
  viewerAgent: 'operator',
  lastAction: null,
  replyDraft: null,
  loading: true,
};

// Update : (Msg, State) → State (Cmd-producing actions live in event handlers
// below; effect membrane is useEffect interpreting "load" requests)
function update(state: State, msg: Msg): State {
  switch (msg.type) {
    case 'load/start':
      return { ...state, loading: true };
    case 'load/done':
      return { ...state, ...msg.payload, loading: false };
    case 'select': {
      const next: State = { ...state, selection: { kind: msg.kind, id: msg.id } };
      if (msg.kind === 'project') {
        const p = state.projects.find((x) => x.id === msg.id);
        if (p && state.context) {
          next.context = { ...state.context, project: { id: p.id, root: p.root, odd_type: p.odd_type } };
        }
      }
      return next;
    }
    case 'reply/open':
      return { ...state, replyDraft: { parentId: msg.parentId, body: '' } };
    case 'reply/edit':
      return state.replyDraft ? { ...state, replyDraft: { ...state.replyDraft, body: msg.body } } : state;
    case 'reply/cancel':
      return { ...state, replyDraft: null };
    case 'action/result':
      return { ...state, lastAction: { ok: msg.ok, message: msg.message, error: msg.error } };
    default:
      return state;
  }
}

interface SidecarPanelProps {
  onContextChange?: (ctx: ContextRecord) => void;
  backend?: string;
  viewerAgent?: string;
}

export function SidecarPanel({ onContextChange, backend = SIDECAR_BACKEND, viewerAgent = 'operator' }: SidecarPanelProps) {
  const [state, dispatch] = useReducer(update, { ...INITIAL_STATE, viewerAgent });

  const load = useCallback(async () => {
    dispatch({ type: 'load/start' });
    try {
      const [ctx, projects, tickets, comments, sessions, unread] = await Promise.all([
        fetch(`${backend}/api/context`).then((r) => r.json()),
        fetch(`${backend}/api/projects`).then((r) => r.json()),
        fetch(`${backend}/api/tickets`).then((r) => r.json()),
        fetch(`${backend}/api/comments`).then((r) => r.json()),
        fetch(`${backend}/api/sessions`).then((r) => r.json()),
        fetch(`${backend}/api/comments/unread?agent=${encodeURIComponent(viewerAgent)}`).then((r) => r.json()),
      ]);
      dispatch({
        type: 'load/done',
        payload: {
          context: ctx,
          projects,
          tickets,
          comments,
          sessions,
          unreadIds: unread.unread_ids ?? [],
        },
      });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: `load failed: ${err}` });
    }
  }, [backend, viewerAgent]);

  useEffect(() => {
    load();
  }, [load]);

  // Lift Context to embedding site whenever it changes.
  useEffect(() => {
    if (state.context && onContextChange) onContextChange(state.context);
  }, [state.context, onContextChange]);

  const handleTransition = async (id: string, toLane: string) => {
    try {
      const r = await fetch(`${backend}/api/tickets/${encodeURIComponent(id)}/transition?to=${encodeURIComponent(toLane)}`, { method: 'POST' });
      const result = await r.json();
      dispatch({ type: 'action/result', ok: result.ok, message: result.ok ? `${id}: ${result.fromLane} → ${result.toLane}` : undefined, error: result.error });
      load();
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
  };

  const handleToggleRead = async (id: string, currentlyUnread: boolean) => {
    const path = currentlyUnread ? 'mark-read' : 'mark-unread';
    try {
      const r = await fetch(`${backend}/api/comments/${encodeURIComponent(id)}/${path}?agent=${encodeURIComponent(viewerAgent)}`, { method: 'POST' });
      const result = await r.json();
      dispatch({ type: 'action/result', ok: result.ok, message: result.ok ? `${id} → ${currentlyUnread ? 'read' : 'unread'}` : undefined, error: result.error });
      load();
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
  };

  const handleReplySubmit = async (parentId: string, body: string) => {
    try {
      const r = await fetch(`${backend}/api/comments/${encodeURIComponent(parentId)}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ author: viewerAgent, body }),
      });
      const result = await r.json();
      dispatch({ type: 'action/result', ok: result.ok, message: result.ok ? `reply created: ${result.id}` : undefined, error: result.error });
      dispatch({ type: 'reply/cancel' });
      load();
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
  };

  if (state.loading && !state.context) return <div className="sidecar-panel">Loading…</div>;

  const selectedTicket = state.selection.kind === 'ticket' ? state.tickets.find((t) => t.id === state.selection.id) : null;
  const selectedComment = state.selection.kind === 'comment' ? state.comments.find((c) => c.id === state.selection.id) : null;
  const selectedProject = state.selection.kind === 'project' ? state.projects.find((p) => p.id === state.selection.id) : null;
  const selectedSession = state.selection.kind === 'session' ? state.sessions.records.find((s) => s.id === state.selection.id) : null;

  return (
    <div className="sidecar-panel" style={panelStyle}>
      <ContextBar context={state.context} unreadCount={state.unreadIds.length} viewerAgent={state.viewerAgent} />
      <div style={layoutStyle}>
        <Pane title="Projects" count={state.projects.length}>
          {state.projects.map((p) => (
            <Row key={p.id} selected={state.selection.kind === 'project' && state.selection.id === p.id} onClick={() => dispatch({ type: 'select', kind: 'project', id: p.id })}>
              <div style={titleStyle}>{p.id}</div>
              <div style={metaStyle}>
                {p.odd_type !== 'unknown' && <Pill kind="odd-type">{p.odd_type}</Pill>}
                {p.build_tenants.length > 0 && <span>{p.build_tenants.length} tenant{p.build_tenants.length === 1 ? '' : 's'}</span>}
              </div>
            </Row>
          ))}
        </Pane>

        <Pane title="Tickets" count={state.tickets.length}>
          {(['active', 'backlog', 'completed'] as const).map((lane) => {
            const items = state.tickets.filter((t) => t.lane === lane);
            if (!items.length) return null;
            return (
              <div key={lane}>
                <h3 style={laneHeaderStyle}>{lane} ({items.length})</h3>
                {items.map((t) => {
                  const isStdoUx = (t.governanceScope || '').includes('UX');
                  return (
                    <Row key={t.id} selected={state.selection.kind === 'ticket' && state.selection.id === t.id} onClick={() => dispatch({ type: 'select', kind: 'ticket', id: t.id })}>
                      <div style={idStyle}>{t.id}</div>
                      <div style={titleStyle}>{t.title}</div>
                      {isStdoUx && <div style={metaStyle}><Pill kind="stdo-ux">STDO-UX</Pill></div>}
                    </Row>
                  );
                })}
              </div>
            );
          })}
        </Pane>

        <Pane title="Comments" count={state.comments.length} extraCount={state.unreadIds.length}>
          {state.comments.map((c) => {
            const isUnread = state.unreadIds.includes(c.id);
            return (
              <Row key={c.id} selected={state.selection.kind === 'comment' && state.selection.id === c.id} onClick={() => dispatch({ type: 'select', kind: 'comment', id: c.id })}>
                <div style={mutedIdStyle}>{c.author}{isUnread && <span style={{ color: '#ff6affc7', marginLeft: 4 }}>●</span>}</div>
                <div style={titleStyle}>{c.title || c.subject || c.filename}</div>
                <div style={metaStyle}>
                  {c.category && <Pill kind={`cat-${c.category.toLowerCase()}`}>{c.category}</Pill>}
                  {c.timestamp && <span>{c.timestamp.slice(0, 8)}</span>}
                </div>
              </Row>
            );
          })}
        </Pane>

        <Pane title="Sessions" count={state.sessions.records.length}>
          {state.sessions.records.length === 0 ? (
            <div style={emptyStyle}>{state.sessions.diagnostic?.notes?.[0] || 'no sessions'}<br /><br /><small>backplane: {state.sessions.diagnostic?.backplane || '—'}</small></div>
          ) : state.sessions.records.map((s) => (
            <Row key={s.id} selected={state.selection.kind === 'session' && state.selection.id === s.id} onClick={() => dispatch({ type: 'select', kind: 'session', id: s.id })}>
              <div style={idStyle}>{s.id}</div>
              <div style={titleStyle}>{s.agent_type}</div>
              <div style={metaStyle}>{s.status}</div>
            </Row>
          ))}
        </Pane>
      </div>

      <Inspector>
        {state.lastAction && (
          <div style={state.lastAction.ok ? actionOkStyle : actionErrorStyle}>
            {state.lastAction.ok ? `✓ ${state.lastAction.message}` : `✗ ${state.lastAction.error}`}
          </div>
        )}
        {selectedTicket && <TicketInspector t={selectedTicket} onTransition={handleTransition} />}
        {selectedComment && <CommentInspector
          c={selectedComment}
          isUnread={state.unreadIds.includes(selectedComment.id)}
          replying={state.replyDraft?.parentId === selectedComment.id}
          replyDraft={state.replyDraft}
          viewerAgent={viewerAgent}
          onToggleRead={handleToggleRead}
          onReplyOpen={(id) => dispatch({ type: 'reply/open', parentId: id })}
          onReplyEdit={(body) => dispatch({ type: 'reply/edit', body })}
          onReplyCancel={() => dispatch({ type: 'reply/cancel' })}
          onReplySubmit={handleReplySubmit}
        />}
        {selectedProject && <ProjectInspector p={selectedProject} />}
        {selectedSession && <SessionInspector s={selectedSession} />}
        {!selectedTicket && !selectedComment && !selectedProject && !selectedSession && (
          <div style={emptyStyle}>select an item from any pane</div>
        )}
      </Inspector>
    </div>
  );
}

// =============================================================================
// Subcomponents (pure projections of their props — UX_METHOD §4 / §9)
// =============================================================================

function ContextBar({ context, unreadCount, viewerAgent }: { context: ContextRecord | null; unreadCount: number; viewerAgent: string }) {
  if (!context) return <div style={contextBarStyle}>—</div>;
  return (
    <div style={contextBarStyle}>
      <Field label="Project" value={context.project.id} />
      <Field label="odd_type" value={context.project.odd_type} />
      <Field label="Workspace" value={context.workspace.id} />
      <Field label="Profile" value={context.workspace.profile} />
      <Field label="Viewer" value={viewerAgent} />
      <Field label="Unread" value={String(unreadCount)} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ color: '#8a96a8', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 9 }}>{label}</span>
      <span style={{ color: '#e6ecf3', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12 }}>{value}</span>
    </div>
  );
}

function Pane({ title, count, extraCount, children }: PropsWithChildrenLike<{ title: string; count: number; extraCount?: number }>) {
  return (
    <section style={paneStyle}>
      <h2 style={paneHeaderStyle}>
        {title} <span style={{ color: '#6aa8ff', fontWeight: 400 }}>{count}</span>
        {extraCount ? <span style={{ color: '#ff6affc7' }}> · {extraCount} unread</span> : null}
      </h2>
      <div style={paneBodyStyle}>{children}</div>
    </section>
  );
}

function Row({ selected, onClick, children }: PropsWithChildrenLike<{ selected: boolean; onClick: () => void }>) {
  return (
    <div style={selected ? rowSelectedStyle : rowStyle} onClick={onClick}>{children}</div>
  );
}

function Pill({ kind, children }: PropsWithChildrenLike<{ kind: string }>) {
  const map: Record<string, React.CSSProperties> = {
    'odd-type': { background: '#1f2a3d', color: '#6affff' },
    'stdo-ux': { background: '#3d1f3d', color: '#ff6affc7' },
    'lane-active': { background: '#1f3d2d', color: '#6affa3' },
    'lane-completed': { background: '#2a2f3d', color: '#d8d8d8' },
    'lane-backlog': { background: '#3d2f1f', color: '#ffa86a' },
    'cat-review': { background: '#1f2a3d', color: '#6aa8ff' },
    'cat-strategy': { background: '#2a3d1f', color: '#a3ff6a' },
    'cat-handover': { background: '#3d2f1f', color: '#ffa86a' },
  };
  const style = map[kind] ?? { background: '#1f2a3d', color: '#6aa8ff' };
  return <span style={{ ...pillBaseStyle, ...style }}>{children}</span>;
}

function Inspector({ children }: PropsWithChildrenLike<{}>) {
  return <aside style={inspectorStyle}>{children}</aside>;
}

function TicketInspector({ t, onTransition }: { t: TicketRecord; onTransition: (id: string, lane: string) => void }) {
  const isStdoUx = (t.governanceScope || '').includes('UX');
  const lanes = ['active', 'backlog', 'completed'] as const;
  return (
    <div>
      <div style={inspectorIdStyle}>{t.id}</div>
      <h2 style={inspectorTitleStyle}>{t.title}</h2>
      <Pill kind={`lane-${t.lane}`}>{t.lane}</Pill>
      {isStdoUx && <Pill kind="stdo-ux">STDO-UX</Pill>}
      <Pill kind="default">{t.changeClass}</Pill>
      <div style={actionsStyle}>
        <span style={{ fontSize: 10, color: '#8a96a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transition</span>
        {lanes.map((lane) => (
          <button key={lane} disabled={t.lane === lane} onClick={() => onTransition(t.id, lane)} style={t.lane === lane ? buttonDisabledStyle : buttonStyle}>→ {lane}</button>
        ))}
      </div>
      <MetaGrid items={[
        ['Goal', t.goal || '—'],
        ['Build tenant', t.buildTenant || '—'],
        ['Governance', t.governanceScope || '—'],
        ['Dependencies', Array.isArray(t.dependencies) ? t.dependencies.join(', ') : '—'],
      ]} />
      {t.targetTruth && <Section title="Target truth"><div style={bodyTextStyle}>{t.targetTruth}</div></Section>}
      {t.evaluationCriteria && t.evaluationCriteria.length > 0 && (
        <Section title="Evaluation criteria">
          <ul>{t.evaluationCriteria.map((c, i) => <li key={i} style={{ fontSize: 11, lineHeight: 1.4, color: '#b6c3d3', marginBottom: 3 }}>{c}</li>)}</ul>
        </Section>
      )}
    </div>
  );
}

function CommentInspector({ c, isUnread, replying, replyDraft, viewerAgent, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  c: CommentRecord; isUnread: boolean; replying: boolean; replyDraft: { parentId: string; body: string } | null;
  viewerAgent: string;
  onToggleRead: (id: string, currentlyUnread: boolean) => void;
  onReplyOpen: (id: string) => void;
  onReplyEdit: (body: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (parentId: string, body: string) => void;
}) {
  return (
    <div>
      <div style={inspectorIdStyle}>{c.id}</div>
      <h2 style={inspectorTitleStyle}>{c.title || c.subject || c.filename}</h2>
      <Pill kind={`cat-${(c.category || '').toLowerCase()}`}>{c.category || '—'}</Pill>
      {isUnread && <Pill kind="stdo-ux">unread for {viewerAgent}</Pill>}
      <div style={actionsStyle}>
        <span style={{ fontSize: 10, color: '#8a96a8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</span>
        <button onClick={() => onToggleRead(c.id, isUnread)} style={buttonStyle}>{isUnread ? 'Mark read' : 'Mark unread'}</button>
        <button onClick={() => onReplyOpen(c.id)} disabled={replying} style={replying ? buttonDisabledStyle : buttonStyle}>Reply</button>
      </div>
      {replying && replyDraft && (
        <div style={{ marginTop: 12, padding: 12, background: '#0f1620', border: '1px solid #2a323d', borderRadius: 4 }}>
          <div style={{ fontSize: 10, color: '#8a96a8', textTransform: 'uppercase', marginBottom: 6 }}>Reply as <code>{viewerAgent}</code></div>
          <textarea value={replyDraft.body} onChange={(e) => onReplyEdit(e.target.value)} style={textareaStyle} autoFocus />
          <div style={{ ...actionsStyle, marginTop: 6 }}>
            <button onClick={() => onReplySubmit(c.id, replyDraft.body)} style={{ ...buttonStyle, borderColor: '#6aa8ff', color: '#6aa8ff' }}>Submit reply</button>
            <button onClick={onReplyCancel} style={buttonStyle}>Cancel</button>
          </div>
        </div>
      )}
      <MetaGrid items={[
        ['Author', c.author],
        ['Date', c.date || c.timestamp || '—'],
        ['Status', c.status || '—'],
        ['Addresses', c.addresses || '—'],
        ['Source', c.sourcePath],
      ]} />
      {c.body && <Section title="Body (excerpt)"><div style={bodyTextStyle}>{c.body.slice(0, 1500)}{c.body.length > 1500 ? '\n\n…(truncated)' : ''}</div></Section>}
    </div>
  );
}

function ProjectInspector({ p }: { p: ProjectRecord }) {
  return (
    <div>
      <div style={inspectorIdStyle}>{p.id}</div>
      <h2 style={inspectorTitleStyle}>Project</h2>
      <MetaGrid items={[
        ['Root', p.root],
        ['odd_type', p.odd_type],
        ['.ai-workspace', p.has_ai_workspace ? 'present' : 'absent'],
        ['.genesis', p.has_genesis ? 'present' : 'absent'],
        ['Packages', p.installed_packages.join(', ') || '—'],
        ['Tenants', p.build_tenants.join(', ') || '—'],
      ]} />
    </div>
  );
}

function SessionInspector({ s }: { s: SessionRecord }) {
  return (
    <div>
      <div style={inspectorIdStyle}>{s.id}</div>
      <h2 style={inspectorTitleStyle}>Session</h2>
      <MetaGrid items={[
        ['Agent', s.agent_type],
        ['Status', s.status],
        ['CWD', s.cwd],
        ['Started', s.started_at || '—'],
        ['Project', s.context_at_spawn?.project || '—'],
        ['Workspace', s.context_at_spawn?.workspace || '—'],
        ['Transcript', s.transcript_ref || '—'],
      ]} />
    </div>
  );
}

function MetaGrid({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '3px 14px', margin: '12px 0', fontSize: 11 }}>
      {items.map(([label, value]) => (
        <Fragment key={label}>
          <div style={{ color: '#8a96a8', textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.05em', alignSelf: 'center' }}>{label}</div>
          <div style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: '#d8e1ec', fontSize: 11, wordBreak: 'break-word' }}>{value}</div>
        </Fragment>
      ))}
    </div>
  );
}

function Section({ title, children }: PropsWithChildrenLike<{ title: string }>) {
  return (
    <>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a96a8', marginTop: 12, marginBottom: 4 }}>{title}</div>
      {children}
    </>
  );
}

import { Fragment } from 'react';
import type { PropsWithChildren } from 'react';
type PropsWithChildrenLike<T> = PropsWithChildren<T>;

// =============================================================================
// Inline styles — minimal, dark-theme; T-014 will move these to the tenant
// stylesheet system. Steel-thread inline keeps the component self-contained.
// =============================================================================

const panelStyle: React.CSSProperties = { font: '13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', background: '#0e1116', color: '#d8e1ec', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const contextBarStyle: React.CSSProperties = { display: 'flex', gap: 20, padding: '10px 20px', background: '#1c2230', borderBottom: '1px solid #2a323d', fontSize: 11, alignItems: 'center', flex: 'none' };
const layoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '220px 1fr 1fr 280px', flex: 1, overflow: 'hidden', minHeight: 0 };
const paneStyle: React.CSSProperties = { borderRight: '1px solid #2a323d', display: 'flex', flexDirection: 'column', minHeight: 0 };
const paneHeaderStyle: React.CSSProperties = { margin: 0, padding: '8px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8a96a8', background: '#161b22', borderBottom: '1px solid #2a323d', flex: 'none', fontWeight: 600 };
const paneBodyStyle: React.CSSProperties = { flex: 1, overflowY: 'auto', minHeight: 0 };
const rowStyle: React.CSSProperties = { display: 'block', padding: '5px 12px', borderLeft: '3px solid transparent', cursor: 'pointer' };
const rowSelectedStyle: React.CSSProperties = { ...rowStyle, background: '#1f2a3d', borderLeftColor: '#6aa8ff' };
const idStyle: React.CSSProperties = { fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', color: '#6aa8ff', fontSize: 11 };
const mutedIdStyle: React.CSSProperties = { ...idStyle, color: '#8a96a8' };
const titleStyle: React.CSSProperties = { fontSize: 12, color: '#d8e1ec', marginTop: 1, lineHeight: 1.3 };
const metaStyle: React.CSSProperties = { fontSize: 10, color: '#8a96a8', marginTop: 1 };
const laneHeaderStyle: React.CSSProperties = { margin: '8px 12px 2px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#8a96a8' };
const pillBaseStyle: React.CSSProperties = { display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: 9, marginRight: 3 };
const inspectorStyle: React.CSSProperties = { borderTop: '1px solid #2a323d', height: '30vh', overflowY: 'auto', padding: '16px 20px', flex: 'none', background: '#0a0d12' };
const inspectorIdStyle: React.CSSProperties = { color: '#6aa8ff', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 12 };
const inspectorTitleStyle: React.CSSProperties = { margin: '0 0 6px', fontSize: 14 };
const actionsStyle: React.CSSProperties = { display: 'flex', gap: 6, margin: '12px 0', alignItems: 'center', flexWrap: 'wrap' };
const buttonStyle: React.CSSProperties = { background: '#1f2a3d', color: '#d8e1ec', border: '1px solid #2a3a52', padding: '4px 10px', fontSize: 11, borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit' };
const buttonDisabledStyle: React.CSSProperties = { ...buttonStyle, opacity: 0.4, cursor: 'default' };
const textareaStyle: React.CSSProperties = { width: '100%', minHeight: 80, background: '#0a0d12', color: '#d8e1ec', border: '1px solid #2a323d', borderRadius: 3, padding: 6, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, boxSizing: 'border-box' };
const actionOkStyle: React.CSSProperties = { marginTop: 0, marginBottom: 8, fontSize: 11, padding: '6px 10px', borderRadius: 3, background: '#1f3d2d', color: '#6affa3' };
const actionErrorStyle: React.CSSProperties = { ...actionOkStyle, background: '#3d1f1f', color: '#ff6a6a' };
const bodyTextStyle: React.CSSProperties = { whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11, lineHeight: 1.5, color: '#b6c3d3' };
const emptyStyle: React.CSSProperties = { padding: '32px 16px', textAlign: 'center', color: '#8a96a8', fontSize: 11 };
