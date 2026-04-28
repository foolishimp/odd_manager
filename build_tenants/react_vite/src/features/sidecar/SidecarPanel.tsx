// SidecarPanel — the real React Project Agent Widget. Closes T-010.
//
// Realizes Projects, Tickets, Comments, pinned folder navigation, terminal
// sessions, the Context bar, and the Inspector in React, governed by UX_METHOD §4 (Elm
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

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { MarkdownDocument } from '../../components/MarkdownDocument';
import type { TicketRecord } from '../../contracts/ticket';
import type { CommentRecord } from '../../contracts/comment';
import type { SessionRecord } from '../../contracts/session';
import type { ProjectRecord } from '../../contracts/project';
import type { SurfaceData } from '../../lib/types';
import {
  INITIAL_SIDECAR_STATE,
  SIDECAR_EXPLORER_PROVIDERS,
  SIDECAR_MAX_PANE_GROUPS,
  SIDECAR_WORKBENCH_LAYOUT_LIMITS,
  reduceSidecarState,
  sidecarLayoutProfileFromState,
} from './sidecar-state';
import type {
  ContextRecord,
  PendingSidecarCmd,
  SidecarCmd,
  SidecarExplorerProviderId,
  SidecarInfoSurface,
  SidecarMsg,
  SidecarPathHistoryEntry,
  SidecarPathHistorySource,
  SidecarResizeGesture,
  SidecarResizeTarget,
  SidecarState,
  SidecarTerminalGroup,
  SidecarTerminalGroupId,
  SidecarTerminalSplit,
  SidecarTerminalTab,
  SidecarViewerGroup,
  SidecarViewerGroupId,
  SidecarViewerSplit,
  SidecarViewerTab,
  SidecarWorkbenchLayout,
} from './sidecar-state';

// Endpoints served by the main odd_manager server (src/server/index.mjs).
// T-016 absorbed the scaffold's routes; relative '' lets Vite proxy /api/* to
// the dev server backend automatically.
const SIDECAR_BACKEND = (typeof window !== 'undefined' && (window as { __SIDECAR_BACKEND__?: string }).__SIDECAR_BACKEND__) || '';
const SIDECAR_LAYOUT_STORAGE_PREFIX = 'oman-sidecar-layout:';
const SIDECAR_PINNED_FOLDERS_STORAGE_PREFIX = 'oman-sidecar-pinned-folders:';
const SIDECAR_PATH_HISTORY_STORAGE_KEY = 'oman-sidecar-path-history';

type NavigatorSortMode = 'time' | 'alpha';

interface NavigatorGroupState {
  collapsed: boolean;
  sort: NavigatorSortMode;
  reverse: boolean;
}

interface NavigatorFsEntry {
  name: string;
  absolutePath: string;
  kind?: 'directory' | 'file';
  hasWorkspace?: boolean;
  markers?: string[];
}

interface NavigatorFolderLoad {
  entries: NavigatorFsEntry[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
}

function apiQuery(projectRoot?: string | null, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (projectRoot) params.set('workspaceRoot', projectRoot);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

function apiUrl(backend: string, path: string, projectRoot?: string | null, extra: Record<string, string> = {}) {
  return `${backend}${path}${apiQuery(projectRoot, extra)}`;
}

function splitGridStyle(split: SidecarViewerSplit | SidecarTerminalSplit, ratios: number[], groupCount: number): CSSProperties | undefined {
  if (split === 'single' || groupCount <= 1) return undefined;
  const safeRatios = ratios.length === groupCount ? ratios : Array.from({ length: groupCount }, () => 1);
  const tracks = safeRatios.map((ratio) => `minmax(0, ${Math.max(0.12, ratio)}fr)`);
  const template = tracks.reduce<string[]>((parts, track, index) => {
    if (index > 0) parts.push('0.36rem');
    parts.push(track);
    return parts;
  }, []).join(' ');
  return split === 'split-horizontal'
    ? { gridTemplateRows: template }
    : { gridTemplateColumns: template };
}

function oddTermSocketUrl(projectRoot: string, sessionId: string) {
  const url = new URL('/api/oddterm', window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('workspaceRoot', projectRoot);
  url.searchParams.set('sessionId', sessionId);
  return url.toString();
}

function sidecarLayoutContextKey(context: ContextRecord) {
  return `${context.project.root}::${context.workspace.id}`;
}

function sidecarLayoutStorageKey(contextKey: string) {
  return `${SIDECAR_LAYOUT_STORAGE_PREFIX}${contextKey}`;
}

function resizeTargetValue(layout: SidecarWorkbenchLayout, target: SidecarResizeTarget) {
  if (target === 'explorer') return layout.explorerWidthPx;
  if (target === 'contextRail') return layout.contextRailWidthPx;
  return layout.bottomDockHeightPx;
}

function resizeValueFromGesture(gesture: SidecarResizeGesture, clientX: number, clientY: number) {
  if (gesture.target === 'explorer') return gesture.startValuePx + (clientX - gesture.startClientX);
  if (gesture.target === 'contextRail') return gesture.startValuePx + (gesture.startClientX - clientX);
  return gesture.startValuePx + (gesture.startClientY - clientY);
}

function resizeDeltaFromKey(target: SidecarResizeTarget, event: KeyboardEvent<HTMLElement>) {
  const step = event.shiftKey ? 72 : 24;
  if (target === 'bottomDock') {
    if (event.key === 'ArrowUp') return step;
    if (event.key === 'ArrowDown') return -step;
    return null;
  }
  if (target === 'contextRail') {
    if (event.key === 'ArrowLeft') return step;
    if (event.key === 'ArrowRight') return -step;
    return null;
  }
  if (event.key === 'ArrowRight') return step;
  if (event.key === 'ArrowLeft') return -step;
  return null;
}

function update(state: SidecarState, msg: SidecarMsg): SidecarState {
  return reduceSidecarState(state, msg).state;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} response was not an object`);
  }
  return value as Record<string, unknown>;
}

function asArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} response was not an array`);
  }
  return value as T[];
}

function asSessionCollection(value: unknown) {
  const payload = asRecord(value, 'sessions');
  return {
    records: asArray<SessionRecord>(payload.records, 'sessions.records'),
    diagnostic: payload.diagnostic && typeof payload.diagnostic === 'object'
      ? payload.diagnostic as SidecarState['sessions']['diagnostic']
      : null,
  };
}

function unreadIdsFrom(value: unknown) {
  const payload = asRecord(value, 'unread comments');
  return Array.isArray(payload.unread_ids)
    ? payload.unread_ids.filter((id): id is string => typeof id === 'string')
    : [];
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(input, init);
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const error = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error)
      : `${response.status} ${response.statusText}`;
    throw new Error(error);
  }
  return payload;
}

function actionError(payload: Record<string, unknown>) {
  return typeof payload.error === 'string' ? payload.error : 'action failed';
}

async function interpretSidecarCommand(cmd: SidecarCmd, options: {
  backend: string;
  viewerAgent: string;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const { backend, viewerAgent, dispatch } = options;
  if (cmd.type === 'load') {
    dispatch({ type: 'load/start' });
    try {
      const [ctx, projects, tickets, comments, sessions, unread] = await Promise.all([
        fetchJson(apiUrl(backend, '/api/context', cmd.projectRoot)),
        fetchJson(`${backend}/api/projects`),
        fetchJson(apiUrl(backend, '/api/tickets', cmd.projectRoot)),
        fetchJson(apiUrl(backend, '/api/comments', cmd.projectRoot)),
        fetchJson(apiUrl(backend, '/api/sidecar/sessions', cmd.projectRoot)),
        fetchJson(apiUrl(backend, '/api/comments/unread', cmd.projectRoot, { agent: viewerAgent })),
      ]);
      dispatch({
        type: 'load/done',
        payload: {
          context: asRecord(ctx, 'context') as unknown as ContextRecord,
          projects: asArray<ProjectRecord>(projects, 'projects'),
          tickets: asArray<TicketRecord>(tickets, 'tickets'),
          comments: asArray<CommentRecord>(comments, 'comments'),
          sessions: asSessionCollection(sessions),
          unreadIds: unreadIdsFrom(unread),
        },
      });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: `load failed: ${err}` });
    }
    return;
  }

  if (cmd.type === 'clipboard.write') {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('clipboard API is unavailable');
      }
      await navigator.clipboard.writeText(cmd.text);
      dispatch({
        type: 'action/result',
        ok: true,
        message: `copied ${cmd.label}`,
      });
    } catch (err) {
      dispatch({
        type: 'action/result',
        ok: false,
        error: `clipboard copy failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return;
  }

  if (cmd.type === 'ticket.transition') {
    try {
      const result = asRecord(await fetchJson(apiUrl(backend, `/api/tickets/${encodeURIComponent(cmd.id)}/transition`, cmd.projectRoot, { to: cmd.toLane }), { method: 'POST' }), 'ticket transition');
      const ok = result.ok === true;
      dispatch({
        type: 'action/result',
        ok,
        message: ok ? `${cmd.id}: ${String(result.fromLane ?? '')} -> ${String(result.toLane ?? cmd.toLane)}` : undefined,
        error: ok ? undefined : actionError(result),
        reload: ok,
      });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
    return;
  }

  if (cmd.type === 'comment.toggleRead') {
    const path = cmd.currentlyUnread ? 'mark-read' : 'mark-unread';
    try {
      const result = asRecord(await fetchJson(apiUrl(backend, `/api/comments/${encodeURIComponent(cmd.id)}/${path}`, cmd.projectRoot, { agent: viewerAgent }), { method: 'POST' }), 'comment read action');
      const ok = result.ok === true;
      dispatch({
        type: 'action/result',
        ok,
        message: ok ? `${cmd.id} -> ${cmd.currentlyUnread ? 'read' : 'unread'}` : undefined,
        error: ok ? undefined : actionError(result),
        reload: ok,
      });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
    return;
  }

  if (cmd.type === 'comment.reply') {
    try {
      const result = asRecord(await fetchJson(apiUrl(backend, `/api/comments/${encodeURIComponent(cmd.parentId)}/reply`, cmd.projectRoot), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ author: viewerAgent, body: cmd.body }),
      }), 'comment reply');
      const ok = result.ok === true;
      dispatch({
        type: 'action/result',
        ok,
        message: ok ? `reply created: ${String(result.id ?? '')}` : undefined,
        error: ok ? undefined : actionError(result),
        reload: ok,
      });
      if (ok) dispatch({ type: 'reply/cancel' });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
    return;
  }

  if (cmd.type === 'session.spawn') {
    try {
      const result = asRecord(await fetchJson(apiUrl(backend, '/api/sidecar/sessions/spawn', cmd.projectRoot), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selectedTrainId: 'sidecar', label: 'sidecar shell' }),
      }), 'session spawn');
      const ok = result.ok === true;
      if (ok && typeof result.id === 'string' && typeof result.agent_type === 'string' && typeof result.cwd === 'string' && typeof result.status === 'string') {
        dispatch({ type: 'session/spawn/done', record: result as unknown as SessionRecord, groupId: cmd.groupId });
      }
      dispatch({
        type: 'action/result',
        ok,
        message: ok ? `spawned ${String(result.id ?? '')}` : undefined,
        error: ok ? undefined : actionError(result),
        reload: ok,
      });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
    return;
  }

  if (cmd.type === 'session.kill') {
    try {
      const result = asRecord(await fetchJson(apiUrl(backend, `/api/sidecar/sessions/${encodeURIComponent(cmd.id)}/kill`, cmd.projectRoot), { method: 'POST' }), 'session close');
      const ok = result.ok === true;
      dispatch({
        type: 'action/result',
        ok,
        message: ok ? `closed ${cmd.id}` : undefined,
        error: ok ? undefined : actionError(result),
        reload: ok,
      });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: String(err) });
    }
  }
}

interface SidecarPanelProps {
  onContextChange?: (ctx: ContextRecord) => void;
  backend?: string;
  viewerAgent?: string;
  projectRoot?: string | null;
}

export function SidecarPanel({ onContextChange, backend = SIDECAR_BACKEND, viewerAgent = 'operator', projectRoot = null }: SidecarPanelProps) {
  const [state, dispatch] = useReducer(update, { ...INITIAL_SIDECAR_STATE, viewerAgent });
  const processedCommandIds = useRef<Set<string>>(new Set());
  const loadedLayoutContextKeys = useRef<Set<string>>(new Set());
  const loadedPathHistory = useRef(false);
  const skipNextPathHistorySave = useRef(true);
  const suppressNextLayoutSave = useRef<Set<string>>(new Set());
  const lastSavedLayoutByContext = useRef<Map<string, string>>(new Map());
  const runCommand = useCallback((entry: PendingSidecarCmd) => {
    void interpretSidecarCommand(entry.cmd, { backend, viewerAgent, dispatch });
  }, [backend, viewerAgent]);
  const layoutContextKey = state.context ? sidecarLayoutContextKey(state.context) : null;

  useEffect(() => {
    dispatch({ type: 'load/request', projectRoot, reason: 'initial' });
  }, [projectRoot]);

  useEffect(() => {
    const pending = state.pendingCommands.filter((entry) => !processedCommandIds.current.has(entry.id));
    if (pending.length === 0) return;
    for (const entry of pending) {
      processedCommandIds.current.add(entry.id);
      runCommand(entry);
    }
    dispatch({ type: 'cmd/dispatched', ids: pending.map((entry) => entry.id) });
  }, [state.pendingCommands, runCommand]);

  useEffect(() => {
    if (typeof window === 'undefined' || loadedPathHistory.current) return;
    loadedPathHistory.current = true;
    try {
      const raw = window.localStorage.getItem(SIDECAR_PATH_HISTORY_STORAGE_KEY);
      if (!raw) return;
      dispatch({ type: 'path-history/load', entries: JSON.parse(raw) as unknown });
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: `path history load failed: ${String(err)}` });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !loadedPathHistory.current) return;
    if (skipNextPathHistorySave.current) {
      skipNextPathHistorySave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(SIDECAR_PATH_HISTORY_STORAGE_KEY, JSON.stringify(state.pathHistory));
    } catch (err) {
      dispatch({ type: 'action/result', ok: false, error: `path history save failed: ${String(err)}` });
    }
  }, [state.pathHistory]);

  // Lift Context to embedding site whenever it changes.
  useEffect(() => {
    if (state.context && onContextChange) onContextChange(state.context);
  }, [state.context, onContextChange]);

  useEffect(() => {
    if (!layoutContextKey || typeof window === 'undefined') return;
    if (loadedLayoutContextKeys.current.has(layoutContextKey)) return;
    loadedLayoutContextKeys.current.add(layoutContextKey);
    const storageKey = sidecarLayoutStorageKey(layoutContextKey);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      suppressNextLayoutSave.current.add(layoutContextKey);
      dispatch({ type: 'layout/profile-loaded', contextKey: layoutContextKey, payload: JSON.parse(raw) as unknown });
    } catch (err) {
      dispatch({ type: 'layout/profile-load-failed', contextKey: layoutContextKey, error: String(err) });
    }
  }, [layoutContextKey]);

  useEffect(() => {
    if (!layoutContextKey || !state.context || state.loading || typeof window === 'undefined') return;
    const storageKey = sidecarLayoutStorageKey(layoutContextKey);
    const profile = sidecarLayoutProfileFromState(state, layoutContextKey);
    const serialized = JSON.stringify(profile);
    if (suppressNextLayoutSave.current.has(layoutContextKey)) {
      suppressNextLayoutSave.current.delete(layoutContextKey);
      lastSavedLayoutByContext.current.set(layoutContextKey, serialized);
      return;
    }
    if (lastSavedLayoutByContext.current.get(layoutContextKey) === serialized) return;
    try {
      window.localStorage.setItem(storageKey, serialized);
      lastSavedLayoutByContext.current.set(layoutContextKey, serialized);
    } catch (err) {
      dispatch({ type: 'layout/profile-save-failed', contextKey: layoutContextKey, error: String(err) });
    }
  }, [layoutContextKey, state.context, state.loading, state.ui, state.sessions.records]);

  const currentProjectRoot = state.context?.project.root ?? null;
  const [pinnedFolders, setPinnedFolders] = useState<string[] | null>(null);
  const [activePinnedFolderPath, setActivePinnedFolderPath] = useState<string | null>(null);
  const resolvedPinnedFolders = currentProjectRoot
    ? sanitizePinnedFolders(pinnedFolders ?? defaultPinnedFolders(currentProjectRoot), currentProjectRoot)
    : [];

  useEffect(() => {
    setActivePinnedFolderPath(null);
    if (!currentProjectRoot || typeof window === 'undefined') {
      setPinnedFolders(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(pinnedFoldersStorageKey(currentProjectRoot));
      if (!raw) {
        setPinnedFolders(sanitizePinnedFolders(defaultPinnedFolders(currentProjectRoot), currentProjectRoot));
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      setPinnedFolders(Array.isArray(parsed)
        ? sanitizePinnedFolders(parsed.filter((path): path is string => typeof path === 'string'), currentProjectRoot)
        : sanitizePinnedFolders(defaultPinnedFolders(currentProjectRoot), currentProjectRoot));
    } catch {
      setPinnedFolders(sanitizePinnedFolders(defaultPinnedFolders(currentProjectRoot), currentProjectRoot));
    }
  }, [currentProjectRoot]);

  useEffect(() => {
    if (!currentProjectRoot || pinnedFolders === null || typeof window === 'undefined') return;
    const sanitized = sanitizePinnedFolders(pinnedFolders, currentProjectRoot);
    window.localStorage.setItem(pinnedFoldersStorageKey(currentProjectRoot), JSON.stringify(sanitized));
    if (sanitized.length !== pinnedFolders.length || sanitized.some((path, index) => path !== pinnedFolders[index])) {
      setPinnedFolders(sanitized);
    }
  }, [currentProjectRoot, pinnedFolders]);

  const handlePinnedFoldersChange = (paths: string[], activatePath?: string) => {
    const next = currentProjectRoot ? sanitizePinnedFolders(paths, currentProjectRoot) : dedupeSortedPins(paths);
    setPinnedFolders(next);
    const normalizedActivatePath = activatePath ? normalizePinnedPath(activatePath) : '';
    if (normalizedActivatePath && next.includes(normalizedActivatePath)) {
      setActivePinnedFolderPath(normalizedActivatePath);
      dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: false });
    }
  };

  const handlePinnedFolderUnpin = (path: string) => {
    const next = resolvedPinnedFolders.filter((candidate) => candidate !== path);
    setPinnedFolders(next);
  };

  const handleInfoSurfaceSelect = (surface: SidecarInfoSurface) => {
    setActivePinnedFolderPath(null);
    dispatch({ type: 'ui/select-info-surface', surface });
  };

  const handlePinnedFolderSelect = (path: string) => {
    setActivePinnedFolderPath(path);
    dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: false });
  };

  const handleProjectSelect = (project: ProjectRecord) => {
    dispatch({ type: 'select', kind: 'project', id: project.id });
  };

  const handleTransition = (id: string, toLane: string) => {
    dispatch({ type: 'ticket/transition/request', id, toLane });
  };

  const handleToggleRead = (id: string, currentlyUnread: boolean) => {
    dispatch({ type: 'comment/toggle-read/request', id, currentlyUnread });
  };

  const handleSpawnSession = (groupId: SidecarTerminalGroupId = state.ui.terminalWorkspace.activeGroupId) => {
    if (!state.context) return;
    dispatch({ type: 'session/spawn/request', groupId });
  };

  const handleKillSession = (id: string) => {
    dispatch({ type: 'session/kill/request', id });
  };

  const handleReplySubmit = (parentId: string, body: string) => {
    dispatch({ type: 'reply/submit/request', parentId, body });
  };

  const handlePathCopyRequest = (entry: SidecarPathHistoryEntry) => {
    dispatch({
      type: 'path-history/copy-request',
      entry: {
        ...entry,
        source: entry.source === 'history' ? 'history' : entry.source,
        timestamp: new Date().toISOString(),
      },
    });
  };

  const handleSurfaceSelect = (relativePath: string, absolutePath?: string, source: SidecarPathHistorySource = 'browse') => {
    dispatch({ type: 'select', kind: 'surface', id: relativePath });
    if (!currentProjectRoot || !absolutePath) return;
    const entry = pathHistoryEntry(currentProjectRoot, absolutePath, source);
    if (entry) handlePathCopyRequest(entry);
  };

  const handleHistoryOpen = (entry: SidecarPathHistoryEntry) => {
    if (entry.projectRoot !== currentProjectRoot) return;
    dispatch({ type: 'select', kind: 'surface', id: entry.relativePath });
  };

  if (state.loading && !state.context) {
    return (
      <section className="panel panel--agent-console sidecar-panel sidecar-panel--loading" aria-busy="true">
        <span className="panel__eyebrow">Project Agent Sidecar</span>
        <div className="sidecar-inspector__empty">Loading...</div>
      </section>
    );
  }

  const selectedTicket = state.selection.kind === 'ticket' ? state.tickets.find((t) => t.id === state.selection.id) : null;
  const selectedComment = state.selection.kind === 'comment' ? state.comments.find((c) => c.id === state.selection.id) : null;
  const selectedProject = state.selection.kind === 'project' ? state.projects.find((p) => p.id === state.selection.id) : null;
  const selectedSurfacePath = state.selection.kind === 'surface' ? state.selection.id : null;
  const activeInspectorSession = state.activeSessionId
    ? state.sessions.records.find((s) => s.id === state.activeSessionId) ?? null
    : null;
  const selectedInspectorSession = state.selection.kind === 'session'
    ? state.sessions.records.find((s) => s.id === state.selection.id) ?? activeInspectorSession
    : null;
  const liveSessionCount = state.sessions.records.filter((session) => session.status === 'running' || session.status === 'live').length;
  const shellSummary = state.sessions.records.length === 0
    ? 'No Sidecar shells are active for this workspace yet.'
    : `${state.sessions.records.length} shell${state.sessions.records.length === 1 ? '' : 's'}${liveSessionCount ? ` · ${liveSessionCount} live` : ''}.`;
  const activeInfoSurface = state.ui.activeInfoSurface;
  const activePinnedFolderLabel = activePinnedFolderPath
    ? folderDisplayPath(activePinnedFolderPath, currentProjectRoot)
    : null;
  const workbenchLayout = state.ui.workbenchLayout;
  const workbenchStyle = {
    '--sidecar-explorer-width': `${workbenchLayout.explorerWidthPx}px`,
    '--sidecar-bottom-dock-height': `${workbenchLayout.bottomDockHeightPx}px`,
  } as CSSProperties;
  const infoSummary = activePinnedFolderLabel
    ? `Folder · ${activePinnedFolderLabel}`
    : `${infoSurfaceTitle(activeInfoSurface)} · ${activeInfoSurface === 'browse' ? resolvedPinnedFolders.length : infoSurfaceCount(activeInfoSurface, state)}`;
  const selectedObjectTitle = selectedTicket?.title
    ?? selectedComment?.title
    ?? selectedComment?.subject
    ?? selectedComment?.filename
    ?? selectedProject?.id
    ?? selectedSurfacePath
    ?? (selectedInspectorSession ? sessionLabel(selectedInspectorSession) : null)
    ?? 'No object selected';
  const selectedObjectKind = state.selection.kind ?? 'workspace';
  const primaryInfoProviders = SIDECAR_EXPLORER_PROVIDERS.filter((provider) => provider.id !== 'browse');
  const browseProvider = SIDECAR_EXPLORER_PROVIDERS.find((provider) => provider.id === 'browse');

  return (
    <div className="sidecar-panel sidecar-panel--workbench">
      <div
        className={`sidecar-workbench${state.ui.infoCollapsed ? ' is-left-collapsed' : ''}${state.ui.shellCollapsed ? ' is-bottom-collapsed' : ''}`}
        style={workbenchStyle}
      >
        <div className="sidecar-section-controls" aria-label="Sidecar section controls">
          <SectionToggle
            label="Info Browser"
            summary={infoSummary}
            collapsed={state.ui.infoCollapsed}
            onClick={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'info' })}
          />
          <SectionToggle
            label="Shell Workspace"
            summary={shellSummary}
            collapsed={state.ui.shellCollapsed}
            onClick={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'shell' })}
          />
          <button
            type="button"
            className="sidecar-section-reset"
            onClick={() => dispatch({ type: 'layout/profile-reset' })}
            aria-label="Reset sidecar layout"
            title="Reset sidecar layout"
          >
            <span className="sidecar-section-toggle__icon" aria-hidden="true">R</span>
            <span className="sidecar-section-toggle__label">Reset Layout</span>
            <span className="sidecar-section-toggle__summary">default workbench</span>
          </button>
        </div>

        <nav className="sidecar-activity-rail" aria-label="Sidecar selection surfaces">
          <div className="sidecar-rail-stack">
            {primaryInfoProviders.map((provider) => (
              <RailButton
                key={provider.id}
                label={provider.label}
                shortLabel={provider.shortLabel}
                count={infoSurfaceCount(provider.id, state)}
                selected={!activePinnedFolderPath && activeInfoSurface === provider.id}
                onClick={() => handleInfoSurfaceSelect(provider.id)}
              />
            ))}
            {resolvedPinnedFolders.length > 0 ? <div className="sidecar-rail-divider" role="separator" aria-label="Favorites" /> : null}
            {resolvedPinnedFolders.map((path) => (
              <PinnedRailButton
                key={`pin:${path}`}
                label={pinnedFolderRailLabel(path, currentProjectRoot)}
                shortLabel={pinnedFolderShortLabel(path, currentProjectRoot)}
                selected={activePinnedFolderPath === path}
                onClick={() => handlePinnedFolderSelect(path)}
                onUnpin={() => handlePinnedFolderUnpin(path)}
              />
            ))}
          </div>
          <div className="sidecar-rail-bottom">
            {browseProvider ? (
              <RailButton
                key={browseProvider.id}
                label={browseProvider.label}
                shortLabel={browseProvider.shortLabel}
                count="fs"
                selected={!activePinnedFolderPath && activeInfoSurface === browseProvider.id}
                onClick={() => handleInfoSurfaceSelect(browseProvider.id)}
              />
            ) : null}
            <button
              type="button"
              className="sidecar-rail-toggle"
              onClick={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'info' })}
              aria-expanded={!state.ui.infoCollapsed}
              aria-label={state.ui.infoCollapsed ? 'Open selection flyout' : 'Close selection flyout'}
              title={state.ui.infoCollapsed ? 'Open selection flyout' : 'Close selection flyout'}
            >
              <span aria-hidden="true">{state.ui.infoCollapsed ? '›' : '‹'}</span>
            </button>
          </div>
        </nav>

        <div
          className="sidecar-main-area"
          onPointerDown={(event) => {
            if (state.ui.infoCollapsed) return;
            if (event.target instanceof Element && event.target.closest('.sidecar-flyout')) return;
            dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: true });
          }}
        >
          {!state.ui.infoCollapsed ? (
            <aside className="sidecar-flyout" aria-label="Sidecar selection flyout">
              <div className="sidecar-flyout__header">
                <div>
                  <span className="panel__eyebrow">Selection</span>
                  <h2>{activePinnedFolderLabel ?? infoSurfaceTitle(activeInfoSurface)}</h2>
                </div>
                <button
                  type="button"
                  className="navigator-mode-toggle"
                  onClick={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: true })}
                  aria-label="Close selection flyout"
                  title="Close selection flyout"
                >
                  <span aria-hidden="true">‹</span>
                </button>
              </div>
              <SelectionFlyout
                surface={activeInfoSurface}
                state={state}
                activePinnedFolderPath={activePinnedFolderPath}
                pinnedFolders={resolvedPinnedFolders}
                onPinnedFoldersChange={handlePinnedFoldersChange}
                onPinnedFolderUnpin={handlePinnedFolderUnpin}
                onProjectSelect={handleProjectSelect}
                onTicketSelect={(id) => dispatch({ type: 'select', kind: 'ticket', id })}
                onCommentSelect={(id) => dispatch({ type: 'select', kind: 'comment', id })}
                onSurfaceSelect={handleSurfaceSelect}
                onPathHistoryCopy={handlePathCopyRequest}
                onPathHistoryOpen={handleHistoryOpen}
              />
              <ResizeHandle
                target="explorer"
                label="Resize selection flyout"
                orientation="vertical"
                layout={workbenchLayout}
                dispatch={dispatch}
              />
            </aside>
          ) : null}

          <section className="sidecar-canvas" aria-label="Sidecar canvas">
            <div className="sidecar-canvas__header">
              <div className="sidecar-canvas__title">
                <span className="panel__eyebrow">Sidecar Canvas</span>
                <h2>{selectedObjectTitle}</h2>
                <span className="summary-pill">{selectedObjectKind}</span>
                {state.lastAction && <ActionResult result={state.lastAction} />}
              </div>
              <ViewerLayoutToggle
                split={state.ui.viewerWorkspace.split}
                groupCount={state.ui.viewerWorkspace.groups.length}
                onSplit={(split) => dispatch({ type: 'viewer/split', split })}
                onAddVertical={() => dispatch({ type: 'viewer/split-add-vertical' })}
              />
            </div>
            <ViewerWorkspace
              state={state}
              viewerAgent={viewerAgent}
              dispatch={dispatch}
              onTransition={handleTransition}
              onToggleRead={handleToggleRead}
              onReplyOpen={(id) => dispatch({ type: 'reply/open', parentId: id })}
              onReplyEdit={(body) => dispatch({ type: 'reply/edit', body })}
              onReplyCancel={() => dispatch({ type: 'reply/cancel' })}
              onReplySubmit={handleReplySubmit}
            />
          </section>
        </div>

        <aside className="sidecar-context-rail" aria-label="Sidecar context rail">
          <ContextRailItem
            symbol="P"
            label="Project"
            value={state.context?.project.id ?? '-'}
            detail={state.context?.project.root ?? 'No project context'}
          />
          <ContextRailItem
            symbol="O"
            label="Selection"
            value={selectedObjectKind}
            detail={selectedObjectTitle}
          />
          <ContextRailItem
            symbol="U"
            label="Unread"
            value={String(state.unreadIds.length)}
            detail={`Unread for ${viewerAgent}`}
            metric={String(state.unreadIds.length)}
          />
          <ContextRailItem
            symbol="$"
            label="Shells"
            value={`${state.sessions.records.length} shell${state.sessions.records.length === 1 ? '' : 's'}`}
            detail={`${liveSessionCount} live`}
            metric={String(state.sessions.records.length)}
          />
        </aside>

        <section className="sidecar-bottom-dock" aria-label="Sidecar terminal dock">
          {state.ui.shellCollapsed ? (
            <>
              <ResizeHandle
                target="bottomDock"
                label="Resize terminal dock"
                orientation="horizontal"
                layout={workbenchLayout}
                dispatch={dispatch}
              />
              <div className="sidecar-bottom-bar">
                <button
                  type="button"
                  className="sidecar-bottom-tab"
                  onClick={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'shell', collapsed: false })}
                  aria-expanded={false}
                >
                  Terminal
                </button>
                <span className="summary-pill">{shellSummary}</span>
                <span className="summary-pill">{state.context?.project.id ?? 'no project'}</span>
              </div>
            </>
          ) : (
            <>
              <ResizeHandle
                target="bottomDock"
                label="Resize terminal dock"
                orientation="horizontal"
                layout={workbenchLayout}
                dispatch={dispatch}
              />
              <TerminalWorkspace
                state={state}
                projectRoot={currentProjectRoot}
                dispatch={dispatch}
                onSpawn={handleSpawnSession}
                onKill={handleKillSession}
                onCollapse={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'shell', collapsed: true })}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// Subcomponents (pure projections of their props — UX_METHOD §4 / §9)
// =============================================================================

function defaultPinnedFolders(projectRoot: string | null) {
  if (!projectRoot) return [];
  return [
    'specification',
    'build_tenants',
  ].map((relativePath) => absoluteProjectPath(projectRoot, relativePath));
}

function builtInNavigatorFolders(projectRoot: string | null) {
  if (!projectRoot) return [];
  return [
    '.ai-workspace/tickets',
    '.ai-workspace/comments',
  ].map((relativePath) => absoluteProjectPath(projectRoot, relativePath));
}

function pinnedFoldersStorageKey(projectRoot: string) {
  return `${SIDECAR_PINNED_FOLDERS_STORAGE_PREFIX}${projectRoot}`;
}

function normalizePinnedPath(path: string) {
  const trimmed = path.trim();
  if (trimmed.length <= 1) return trimmed;
  return trimmed.replace(/\/+$/, '');
}

function absoluteProjectPath(projectRoot: string, inputPath: string) {
  const trimmed = inputPath.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return normalizePinnedPath(trimmed);
  const relative = trimmed.replace(/^\.?\//, '');
  return normalizePinnedPath(`${projectRoot.replace(/\/+$/, '')}/${relative}`);
}

function folderDisplayPath(path: string, projectRoot: string | null) {
  if (!projectRoot) return path;
  const root = projectRoot.replace(/\/+$/, '');
  if (path === root) return '.';
  if (path.startsWith(`${root}/`)) return `./${path.slice(root.length + 1)}`;
  return path;
}

function pinnedFolderRailLabel(path: string, projectRoot: string | null) {
  return `Pinned folder ${folderDisplayPath(path, projectRoot)}`;
}

function pinnedFolderShortLabel(path: string, projectRoot: string | null) {
  const display = folderDisplayPath(path, projectRoot).replace(/^\.\//, '');
  const leaf = display.split('/').filter(Boolean).at(-1) ?? display;
  const initials = leaf
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return initials || 'F';
}

function relativeProjectPath(projectRoot: string | null, path: string) {
  if (!projectRoot) return null;
  const root = projectRoot.replace(/\/+$/, '');
  const target = path.trim();
  if (!target) return null;
  if (target === root) return '.';
  if (target.startsWith(`${root}/`)) return target.slice(root.length + 1);
  return null;
}

function pathHistoryEntry(projectRoot: string, absolutePath: string, source: SidecarPathHistorySource): SidecarPathHistoryEntry | null {
  const relativePath = relativeProjectPath(projectRoot, absolutePath);
  if (!relativePath || relativePath === '.') return null;
  return {
    absolutePath: normalizePinnedPath(absolutePath),
    projectRoot: normalizePinnedPath(projectRoot),
    relativePath,
    source,
    timestamp: new Date().toISOString(),
  };
}

function pathHistorySourceLabel(source: SidecarPathHistorySource) {
  if (source === 'pinned_folder') return 'pinned';
  if (source === 'history') return 'recent';
  return 'browse';
}

function navigatorGroupKey(surface: string, id: string) {
  return `${surface}:${id}`;
}

function navigatorGroupState(
  groups: Record<string, NavigatorGroupState>,
  key: string,
  fallback: Partial<NavigatorGroupState> = {},
): NavigatorGroupState {
  return {
    collapsed: fallback.collapsed ?? false,
    sort: fallback.sort ?? 'time',
    reverse: fallback.reverse ?? true,
    ...groups[key],
  };
}

function updateNavigatorGroup(
  groups: Record<string, NavigatorGroupState>,
  key: string,
  patch: Partial<NavigatorGroupState>,
) {
  return {
    ...groups,
    [key]: {
      ...navigatorGroupState(groups, key),
      ...patch,
    },
  };
}

function compareText(left: string | undefined | null, right: string | undefined | null) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function compareBySort<T>(
  items: T[],
  group: NavigatorGroupState,
  alphaValue: (item: T) => string | undefined | null,
  timeValue: (item: T) => string | undefined | null,
) {
  const sorted = [...items].sort((left, right) => {
    const result = group.sort === 'alpha'
      ? compareText(alphaValue(left), alphaValue(right))
      : compareText(timeValue(left), timeValue(right)) || compareText(alphaValue(left), alphaValue(right));
    return group.reverse ? -result : result;
  });
  return sorted;
}

function ticketTime(ticket: TicketRecord) {
  return ticket.updatedAt || ticket.createdAt || ticket.id;
}

function commentTime(comment: CommentRecord) {
  return comment.timestamp || comment.date || comment.filename;
}

function folderEntryTime(entry: NavigatorFsEntry) {
  return entry.name;
}

function dedupeSortedPins(paths: string[]) {
  return Array.from(new Set(paths.map(normalizePinnedPath).filter(Boolean)));
}

function sanitizePinnedFolders(paths: string[], projectRoot: string | null) {
  const blocked = new Set(builtInNavigatorFolders(projectRoot).map(normalizePinnedPath));
  return dedupeSortedPins(paths).filter((path) => !blocked.has(path));
}

function asNavigatorFolderLoad(value: unknown): NavigatorFolderLoad {
  const payload = asRecord(value, 'folder browse');
  const entries = Array.isArray(payload.entries)
    ? payload.entries.filter((entry): entry is NavigatorFsEntry => (
        Boolean(entry)
        && typeof entry === 'object'
        && typeof (entry as { name?: unknown }).name === 'string'
        && typeof (entry as { absolutePath?: unknown }).absolutePath === 'string'
      ))
    : [];
  return {
    entries,
    loading: false,
    error: null,
    truncated: payload.truncated === true,
  };
}

function infoSurfaceTitle(surface: SidecarExplorerProviderId) {
  if (surface === 'browse') return 'Browse';
  if (surface === 'history') return 'Recent Paths';
  if (surface === 'projects') return 'Projects';
  if (surface === 'comments') return 'Comments';
  return 'Tickets';
}

function infoSurfaceCount(surface: SidecarExplorerProviderId, state: SidecarState) {
  if (surface === 'browse') return state.context ? 1 : 0;
  if (surface === 'history') return state.pathHistory.length;
  if (surface === 'projects') return state.projects.length;
  if (surface === 'comments') return state.comments.length;
  return state.tickets.length;
}

function SectionToggle({ label, summary, collapsed, onClick }: {
  label: string;
  summary: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  const action = collapsed ? 'Restore' : 'Minimize';
  const ariaLabel = `${action} ${label.toLowerCase()}`;
  return (
    <button
      type="button"
      className={`sidecar-section-toggle${collapsed ? ' is-collapsed' : ' is-open'}`}
      onClick={onClick}
      aria-expanded={!collapsed}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className="sidecar-section-toggle__icon" aria-hidden="true">{collapsed ? '▣' : '▢'}</span>
      <span className="sidecar-section-toggle__label">{label}</span>
      <span className="sidecar-section-toggle__summary">{summary}</span>
    </button>
  );
}

function RailButton({ label, shortLabel, count, selected, onClick }: {
  label: string;
  shortLabel: string;
  count: number | string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidecar-rail-button${selected ? ' is-selected' : ''}`}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
    >
      <span className="sidecar-rail-button__icon" aria-hidden="true">{shortLabel}</span>
      <span className="sidecar-rail-button__count">{count}</span>
    </button>
  );
}

function PinnedRailButton({ label, shortLabel, selected, onClick, onUnpin }: {
  label: string;
  shortLabel: string;
  selected: boolean;
  onClick: () => void;
  onUnpin: () => void;
}) {
  const unpinTarget = label.startsWith('Pinned folder ') ? label.slice('Pinned folder '.length) : label;
  const unpinLabel = `Unpin ${unpinTarget}`;
  return (
    <div className="sidecar-rail-pin-item">
      <button
        type="button"
        className={`sidecar-rail-button sidecar-rail-button--pinned${selected ? ' is-selected' : ''}`}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={label}
        title={label}
      >
        <span className="sidecar-rail-button__icon" aria-hidden="true">{shortLabel}</span>
      </button>
      <button
        type="button"
        className="sidecar-rail-pin-toggle"
        onClick={onUnpin}
        aria-label={unpinLabel}
        title={unpinLabel}
      >
        pin
      </button>
    </div>
  );
}

function ResizeHandle({ target, label, orientation, layout, dispatch }: {
  target: SidecarResizeTarget;
  label: string;
  orientation: 'horizontal' | 'vertical';
  layout: SidecarWorkbenchLayout;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const activeResize = layout.activeResize;
  const valueNow = resizeTargetValue(layout, target);
  const limits = SIDECAR_WORKBENCH_LAYOUT_LIMITS[target];
  const className = [
    'sidecar-resize-handle',
    `sidecar-resize-handle--${target}`,
    `sidecar-resize-handle--${orientation}`,
    activeResize?.target === target ? 'is-resizing' : '',
  ].filter(Boolean).join(' ');

  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dispatch({
      type: 'ui/resize-start',
      target,
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const previewResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!activeResize || activeResize.target !== target || activeResize.pointerId !== event.pointerId) return;
    dispatch({
      type: 'ui/resize-preview',
      target,
      valuePx: resizeValueFromGesture(activeResize, event.clientX, event.clientY),
    });
  };

  const commitResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!activeResize || activeResize.target !== target || activeResize.pointerId !== event.pointerId) {
      dispatch({ type: 'ui/resize-commit' });
      return;
    }
    dispatch({
      type: 'ui/resize-commit',
      target,
      valuePx: resizeValueFromGesture(activeResize, event.clientX, event.clientY),
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Home') {
      event.preventDefault();
      dispatch({ type: 'ui/resize-reset', target });
      return;
    }
    const deltaPx = resizeDeltaFromKey(target, event);
    if (deltaPx === null) return;
    event.preventDefault();
    dispatch({ type: 'ui/resize-by', target, deltaPx });
  };

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      aria-valuemin={limits.min}
      aria-valuemax={limits.max}
      aria-valuenow={valueNow}
      tabIndex={0}
      className={className}
      onPointerDown={startResize}
      onPointerMove={previewResize}
      onPointerUp={commitResize}
      onPointerCancel={commitResize}
      onKeyDown={handleKeyDown}
      title={`${label}. Use arrow keys to resize, Shift+Arrow for larger steps, Home to reset.`}
    >
      <span aria-hidden="true" />
    </div>
  );
}

function PaneSplitHandle({ surface, index, orientation, ratios, dispatch }: {
  surface: 'viewer' | 'terminal';
  index: number;
  orientation: 'horizontal' | 'vertical';
  ratios: number[];
  dispatch: Dispatch<SidecarMsg>;
}) {
  const dragRef = useRef<null | {
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
    totalPx: number;
    totalRatio: number;
  }>(null);
  const label = `${surface === 'viewer' ? 'Resize viewer split' : 'Resize terminal split'} ${index + 1}`;
  const sendResize = (deltaRatio: number) => {
    if (surface === 'viewer') {
      dispatch({ type: 'viewer/resize-boundary', index, deltaRatio });
    } else {
      dispatch({ type: 'terminal/resize-boundary', index, deltaRatio });
    }
  };
  const resetRatios = () => {
    dispatch(surface === 'viewer' ? { type: 'viewer/reset-ratios' } : { type: 'terminal/reset-ratios' });
  };
  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    const parentBox = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parentBox) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      totalPx: Math.max(1, orientation === 'vertical' ? parentBox.width : parentBox.height),
      totalRatio: Math.max(1, ratios.reduce((total, ratio) => total + ratio, 0)),
    };
  };
  const previewResize = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaPx = orientation === 'vertical'
      ? event.clientX - drag.lastClientX
      : event.clientY - drag.lastClientY;
    if (deltaPx === 0) return;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;
    sendResize((deltaPx / drag.totalPx) * drag.totalRatio);
  };
  const endResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Home') {
      event.preventDefault();
      resetRatios();
      return;
    }
    const step = event.shiftKey ? 0.08 : 0.04;
    const delta = orientation === 'vertical'
      ? event.key === 'ArrowRight'
        ? step
        : event.key === 'ArrowLeft'
          ? -step
          : null
      : event.key === 'ArrowDown'
        ? step
        : event.key === 'ArrowUp'
          ? -step
          : null;
    if (delta === null) return;
    event.preventDefault();
    sendResize(delta);
  };
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={orientation}
      tabIndex={0}
      className={`sidecar-pane-split-handle sidecar-pane-split-handle--${orientation}`}
      onPointerDown={startResize}
      onPointerMove={previewResize}
      onPointerUp={endResize}
      onPointerCancel={endResize}
      onKeyDown={handleKeyDown}
      title={`${label}. Drag to resize adjacent panes, use arrows to nudge, Home to reset.`}
    >
      <span aria-hidden="true" />
    </div>
  );
}

function SelectionFlyout({
  surface,
  state,
  activePinnedFolderPath,
  pinnedFolders,
  onPinnedFoldersChange,
  onPinnedFolderUnpin,
  onProjectSelect,
  onTicketSelect,
  onCommentSelect,
  onSurfaceSelect,
  onPathHistoryCopy,
  onPathHistoryOpen,
}: {
  surface: SidecarInfoSurface;
  state: SidecarState;
  activePinnedFolderPath: string | null;
  pinnedFolders: string[];
  onPinnedFoldersChange: (paths: string[], activatePath?: string) => void;
  onPinnedFolderUnpin: (path: string) => void;
  onProjectSelect: (project: ProjectRecord) => void;
  onTicketSelect: (id: string) => void;
  onCommentSelect: (id: string) => void;
  onSurfaceSelect: (relativePath: string, absolutePath: string, source: SidecarPathHistorySource) => void;
  onPathHistoryCopy: (entry: SidecarPathHistoryEntry) => void;
  onPathHistoryOpen: (entry: SidecarPathHistoryEntry) => void;
}) {
  const projectRoot = state.context?.project.root ?? null;
  const [groupStates, setGroupStates] = useState<Record<string, NavigatorGroupState>>({});
  const [pinDraft, setPinDraft] = useState('');
  const [folderLoads, setFolderLoads] = useState<Record<string, NavigatorFolderLoad>>({});
  const projectRootPath = projectRoot ? normalizePinnedPath(projectRoot) : null;

  const patchGroup = useCallback((key: string, patch: Partial<NavigatorGroupState>) => {
    setGroupStates((current) => updateNavigatorGroup(current, key, patch));
  }, []);

  const loadFolder = useCallback(async (path: string) => {
    setFolderLoads((current) => ({
      ...current,
      [path]: {
        entries: current[path]?.entries ?? [],
        truncated: current[path]?.truncated ?? false,
        loading: true,
        error: null,
      },
    }));
    try {
      const payload = await fetchJson(`/api/fs/browse?path=${encodeURIComponent(path)}&includeFiles=1`);
      const load = asNavigatorFolderLoad(payload);
      setFolderLoads((current) => ({ ...current, [path]: load }));
    } catch (err) {
      setFolderLoads((current) => ({
        ...current,
        [path]: {
          entries: current[path]?.entries ?? [],
          truncated: false,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  }, []);

  const handleFolderToggle = useCallback((key: string, path: string, collapsed: boolean) => {
    const nextCollapsed = !collapsed;
    patchGroup(key, { collapsed: nextCollapsed });
    if (!nextCollapsed && (!folderLoads[path] || folderLoads[path].error)) {
      void loadFolder(path);
    }
  }, [folderLoads, loadFolder, patchGroup]);

  const handlePinSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectRoot) return;
    const absolutePath = absoluteProjectPath(projectRoot, pinDraft);
    if (!absolutePath) return;
    onPinnedFoldersChange(dedupeSortedPins([...pinnedFolders, absolutePath]), absolutePath);
    setPinDraft('');
  };

  const handlePinFolder = (path: string) => {
    onPinnedFoldersChange(dedupeSortedPins([...pinnedFolders, path]), path);
  };

  const handleUnpin = (path: string) => {
    onPinnedFolderUnpin(path);
  };

  useEffect(() => {
    if (surface !== 'browse' || !projectRootPath || folderLoads[projectRootPath]) return;
    void loadFolder(projectRootPath);
  }, [surface, projectRootPath, folderLoads, loadFolder]);

  useEffect(() => {
    if (!activePinnedFolderPath || folderLoads[activePinnedFolderPath]) return;
    void loadFolder(activePinnedFolderPath);
  }, [activePinnedFolderPath, folderLoads, loadFolder]);

  if (activePinnedFolderPath && projectRoot) {
    const displayPath = folderDisplayPath(activePinnedFolderPath, projectRoot);
    return (
      <Pane title={displayPath} count={folderLoads[activePinnedFolderPath]?.entries.length ?? 0}>
        <div className="sidecar-folder-tree">
          <FolderTreeNode
            path={activePinnedFolderPath}
            label={displayPath}
            depth={0}
            projectRoot={projectRoot}
            groupStates={groupStates}
            folderLoads={folderLoads}
            defaultCollapsed={false}
            onPatchGroup={patchGroup}
            onToggle={handleFolderToggle}
            onLoad={loadFolder}
            onSurfaceSelect={onSurfaceSelect}
            pathSource="pinned_folder"
            pinnedFolders={pinnedFolders}
            onPinFolder={handlePinFolder}
            onUnpinFolder={handleUnpin}
          />
        </div>
      </Pane>
    );
  }

  if (surface === 'projects') {
    return (
      <Pane title="Projects" count={state.projects.length}>
        {state.projects.map((project) => (
          <Row
            key={project.id}
            selected={state.selection.kind === 'project' && state.selection.id === project.id}
            onClick={() => onProjectSelect(project)}
          >
            <div className="sidecar-row__title">{project.name || project.id}</div>
            <div className="sidecar-row__meta">
              {project.odd_type !== 'unknown' && <Pill kind="odd-type">{project.odd_type}</Pill>}
              {project.build_tenants.length > 0 && <span>{project.build_tenants.length} tenant{project.build_tenants.length === 1 ? '' : 's'}</span>}
            </div>
          </Row>
        ))}
      </Pane>
    );
  }

  if (surface === 'history') {
    return (
      <PathHistoryPane
        entries={state.pathHistory}
        currentProjectRoot={projectRoot}
        onCopy={onPathHistoryCopy}
        onOpen={onPathHistoryOpen}
      />
    );
  }

  if (surface === 'comments') {
    const commentsByAuthor = state.comments.reduce<Map<string, CommentRecord[]>>((groups, comment) => {
      const author = comment.author || 'unknown';
      groups.set(author, [...(groups.get(author) ?? []), comment]);
      return groups;
    }, new Map());
    const authors = Array.from(commentsByAuthor.keys()).sort((left, right) => compareText(left, right));
    return (
      <Pane title="Comments" count={state.comments.length} extraCount={state.unreadIds.length}>
        {authors.length === 0 ? <NavigatorEmptyState>No comments found.</NavigatorEmptyState> : null}
        {authors.map((author) => {
          const key = navigatorGroupKey('comments', author);
          const group = navigatorGroupState(groupStates, key);
          const items = compareBySort(
            commentsByAuthor.get(author) ?? [],
            group,
            (comment) => comment.title || comment.subject || comment.filename,
            commentTime,
          );
          return (
            <NavigatorTreeGroup
              key={key}
              label={author}
              count={items.length}
              group={group}
              onToggle={() => patchGroup(key, { collapsed: !group.collapsed })}
              onSort={(sort) => patchGroup(key, { sort })}
              onReverse={() => patchGroup(key, { reverse: !group.reverse })}
            >
              {items.map((comment) => {
                const isUnread = state.unreadIds.includes(comment.id);
                return (
                  <Row
                    key={comment.id}
                    selected={state.selection.kind === 'comment' && state.selection.id === comment.id}
                    onClick={() => onCommentSelect(comment.id)}
                  >
                    <div className="sidecar-row__id sidecar-row__id--muted">
                      {comment.author}{isUnread && <span className="sidecar-unread-dot" aria-label="unread" />}
                    </div>
                    <div className="sidecar-row__title">{comment.title || comment.subject || comment.filename}</div>
                    <div className="sidecar-row__meta">
                      {comment.category && <Pill kind={`cat-${comment.category.toLowerCase()}`}>{comment.category}</Pill>}
                      {comment.timestamp && <span>{comment.timestamp.slice(0, 8)}</span>}
                    </div>
                  </Row>
                );
              })}
            </NavigatorTreeGroup>
          );
        })}
      </Pane>
    );
  }

  if (surface === 'browse') {
    return (
      <Pane title="Browse" count={projectRootPath ? folderLoads[projectRootPath]?.entries.length ?? 0 : 0}>
        <form className="sidecar-pin-form" onSubmit={handlePinSubmit}>
          <input
            type="text"
            value={pinDraft}
            onChange={(event) => setPinDraft(event.currentTarget.value)}
            placeholder={projectRoot ? './specification/requirements' : 'Select a Project first'}
            aria-label="Folder path to pin"
            disabled={!projectRoot}
          />
          <button type="submit" className="secondary" disabled={!projectRoot || !pinDraft.trim()}>
            Pin
          </button>
        </form>
        {!projectRoot ? <NavigatorEmptyState>Select a Project to browse folders.</NavigatorEmptyState> : null}
        {projectRoot && projectRootPath ? (
          <div className="sidecar-folder-tree">
            <FolderTreeNode
              path={projectRootPath}
              label="."
              depth={0}
              projectRoot={projectRoot}
              groupStates={groupStates}
              folderLoads={folderLoads}
              defaultCollapsed={false}
              onPatchGroup={patchGroup}
              onToggle={handleFolderToggle}
              onLoad={loadFolder}
              onSurfaceSelect={onSurfaceSelect}
              pathSource="browse"
              pinnedFolders={pinnedFolders}
              onPinFolder={handlePinFolder}
              onUnpinFolder={handleUnpin}
            />
          </div>
        ) : null}
      </Pane>
    );
  }

  return (
    <Pane title="Tickets" count={state.tickets.length}>
      {(['active', 'backlog', 'completed'] as const).map((lane) => {
        const items = state.tickets.filter((ticket) => ticket.lane === lane);
        if (!items.length) return null;
        const key = navigatorGroupKey('tickets', lane);
        const group = navigatorGroupState(groupStates, key);
        const sortedItems = compareBySort(items, group, (ticket) => `${ticket.id} ${ticket.title}`, ticketTime);
        return (
          <NavigatorTreeGroup
            key={key}
            label={lane}
            count={items.length}
            group={group}
            onToggle={() => patchGroup(key, { collapsed: !group.collapsed })}
            onSort={(sort) => patchGroup(key, { sort })}
            onReverse={() => patchGroup(key, { reverse: !group.reverse })}
          >
            {sortedItems.map((ticket) => {
              const isStdoUx = (ticket.governanceScope || '').includes('UX');
              return (
                <Row
                  key={ticket.id}
                  selected={state.selection.kind === 'ticket' && state.selection.id === ticket.id}
                  onClick={() => onTicketSelect(ticket.id)}
                >
                  <div className="sidecar-row__id">{ticket.id}</div>
                  <div className="sidecar-row__title">{ticket.title}</div>
                  {isStdoUx && <div className="sidecar-row__meta"><Pill kind="stdo-ux">STDO-UX</Pill></div>}
                </Row>
              );
            })}
          </NavigatorTreeGroup>
        );
      })}
    </Pane>
  );
}

function PathHistoryPane({ entries, currentProjectRoot, onCopy, onOpen }: {
  entries: SidecarPathHistoryEntry[];
  currentProjectRoot: string | null;
  onCopy: (entry: SidecarPathHistoryEntry) => void;
  onOpen: (entry: SidecarPathHistoryEntry) => void;
}) {
  return (
    <Pane title="Recent Paths" count={entries.length}>
      {entries.length === 0 ? <NavigatorEmptyState>No recent file paths.</NavigatorEmptyState> : null}
      {entries.map((entry) => {
        const canOpen = Boolean(currentProjectRoot && entry.projectRoot === currentProjectRoot);
        return (
          <div key={`${entry.projectRoot}:${entry.absolutePath}`} className="sidecar-row sidecar-row--path-history">
            <button
              type="button"
              className="sidecar-path-history__main"
              onClick={() => onCopy({ ...entry, source: 'history' })}
              aria-label={`Copy path ${entry.relativePath}`}
              title={entry.absolutePath}
            >
              <div className="sidecar-row__id sidecar-row__id--muted">{pathHistorySourceLabel(entry.source)}</div>
              <div className="sidecar-row__title">{entry.relativePath}</div>
              <div className="sidecar-row__meta">{entry.absolutePath}</div>
            </button>
            <button
              type="button"
              className="sidecar-path-history__open"
              disabled={!canOpen}
              onClick={() => onOpen(entry)}
              aria-label={`Open path ${entry.relativePath}`}
              title={canOpen ? `Open ${entry.relativePath}` : 'Switch to the recorded Project before opening this path'}
            >
              Open
            </button>
          </div>
        );
      })}
    </Pane>
  );
}

function NavigatorTreeGroup({ label, count, group, onToggle, onSort, onReverse, extraControls, children }: PropsWithChildrenLike<{
  label: string;
  count: number;
  group: NavigatorGroupState;
  onToggle: () => void;
  onSort: (sort: NavigatorSortMode) => void;
  onReverse: () => void;
  extraControls?: ReactNode;
}>) {
  return (
    <section className={`sidecar-tree-group${group.collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidecar-tree-group__heading">
        <button
          type="button"
          className="sidecar-tree-group__toggle"
          onClick={onToggle}
          aria-expanded={!group.collapsed}
        >
          <span className="sidecar-tree-group__chevron" aria-hidden="true">{group.collapsed ? '>' : 'v'}</span>
          <strong title={label}>{label}</strong>
          <span>{count}</span>
        </button>
        <div className="sidecar-tree-group__controls" aria-label={`${label} sort controls`}>
          <button
            type="button"
            className={`sidecar-tree-control${group.sort === 'time' ? ' is-active' : ''}`}
            onClick={() => onSort('time')}
            aria-pressed={group.sort === 'time'}
            title={`Sort ${label} by time`}
          >
            T
          </button>
          <button
            type="button"
            className={`sidecar-tree-control${group.sort === 'alpha' ? ' is-active' : ''}`}
            onClick={() => onSort('alpha')}
            aria-pressed={group.sort === 'alpha'}
            title={`Sort ${label} alphabetically`}
          >
            A
          </button>
          <button
            type="button"
            className={`sidecar-tree-control${group.reverse ? ' is-active' : ''}`}
            onClick={onReverse}
            aria-pressed={group.reverse}
            title={`Reverse ${label} sort`}
          >
            R
          </button>
          {extraControls}
        </div>
      </div>
      {!group.collapsed ? <div className="sidecar-tree-group__body">{children}</div> : null}
    </section>
  );
}

function NavigatorEmptyState({ children }: PropsWithChildrenLike<{}>) {
  return <div className="sidecar-navigator-empty">{children}</div>;
}

function FolderTreeNode({ path, label, depth, projectRoot, groupStates, folderLoads, defaultCollapsed = true, onPatchGroup, onToggle, onLoad, onSurfaceSelect, pathSource, pinnedFolders, onPinFolder, onUnpinFolder }: {
  path: string;
  label: string;
  depth: number;
  projectRoot: string | null;
  groupStates: Record<string, NavigatorGroupState>;
  folderLoads: Record<string, NavigatorFolderLoad>;
  defaultCollapsed?: boolean;
  onPatchGroup: (key: string, patch: Partial<NavigatorGroupState>) => void;
  onToggle: (key: string, path: string, collapsed: boolean) => void;
  onLoad: (path: string) => void;
  onSurfaceSelect: (relativePath: string, absolutePath: string, source: SidecarPathHistorySource) => void;
  pathSource: SidecarPathHistorySource;
  pinnedFolders: string[];
  onPinFolder: (path: string) => void;
  onUnpinFolder: (path: string) => void;
}) {
  const key = navigatorGroupKey('folder', path);
  const group = navigatorGroupState(groupStates, key, { collapsed: defaultCollapsed, sort: 'alpha', reverse: false });
  const load = folderLoads[path] ?? null;
  const entries = compareBySort(load?.entries ?? [], group, (entry) => entry.name, folderEntryTime);
  const normalizedPath = normalizePinnedPath(path);
  const isPinned = pinnedFolders.includes(normalizedPath);
  const isBuiltIn = builtInNavigatorFolders(projectRoot).map(normalizePinnedPath).includes(normalizedPath);
  const pinLabel = `${isPinned ? 'Unpin' : 'Pin'} ${label}`;

  return (
    <div className="sidecar-folder-node" style={{ '--sidecar-tree-depth': depth } as CSSProperties}>
      <NavigatorTreeGroup
        label={label}
        count={load?.entries.length ?? 0}
        group={group}
        onToggle={() => onToggle(key, path, group.collapsed)}
        onSort={(sort) => {
          onPatchGroup(key, { sort });
          if (group.collapsed && !load) onLoad(path);
        }}
        onReverse={() => onPatchGroup(key, { reverse: !group.reverse })}
        extraControls={!isBuiltIn ? (
          <button
            type="button"
            className={`sidecar-tree-control${isPinned ? ' is-active' : ''}`}
            onClick={() => (isPinned ? onUnpinFolder(normalizedPath) : onPinFolder(normalizedPath))}
            aria-pressed={isPinned}
            aria-label={pinLabel}
            title={pinLabel}
          >
            {isPinned ? 'X' : 'P'}
          </button>
        ) : null}
      >
        {load?.loading ? <NavigatorEmptyState>Loading folders...</NavigatorEmptyState> : null}
        {load?.error ? <div className="sidecar-navigator-error">{load.error}</div> : null}
        {load && !load.loading && !load.error && entries.length === 0 ? <NavigatorEmptyState>No child folders.</NavigatorEmptyState> : null}
        {entries.map((entry) => {
          const entryKind = entry.kind ?? 'directory';
          if (entryKind === 'file') {
            const relativePath = relativeProjectPath(projectRoot, entry.absolutePath);
            return (
              <button
                key={entry.absolutePath}
                type="button"
                className="sidecar-row sidecar-row--surface-file"
                disabled={!relativePath}
                onClick={() => {
                  if (relativePath) onSurfaceSelect(relativePath, entry.absolutePath, pathSource);
                }}
                title={entry.absolutePath}
              >
                <div className="sidecar-row__id sidecar-row__id--muted">file</div>
                <div className="sidecar-row__title">{entry.name}</div>
                {relativePath ? <div className="sidecar-row__meta">{relativePath}</div> : null}
              </button>
            );
          }
          return (
            <FolderTreeNode
              key={entry.absolutePath}
              path={entry.absolutePath}
              label={entry.name}
              depth={depth + 1}
              projectRoot={projectRoot}
              groupStates={groupStates}
              folderLoads={folderLoads}
              onPatchGroup={onPatchGroup}
              onToggle={onToggle}
              onLoad={onLoad}
              onSurfaceSelect={onSurfaceSelect}
              pathSource={pathSource}
              pinnedFolders={pinnedFolders}
              onPinFolder={onPinFolder}
              onUnpinFolder={onUnpinFolder}
            />
          );
        })}
        {load?.truncated ? <NavigatorEmptyState>Showing first 500 folders.</NavigatorEmptyState> : null}
      </NavigatorTreeGroup>
    </div>
  );
}

function sessionLabel(session: SessionRecord) {
  return typeof session.raw?.label === 'string' && session.raw.label.trim()
    ? session.raw.label
    : session.agent_type;
}

function ActionResult({ result }: { result: NonNullable<SidecarState['lastAction']> }) {
  return (
    <div className={`sidecar-action-result ${result.ok ? 'sidecar-action-result--ok' : 'sidecar-action-result--error'}`}>
      {result.ok ? `OK ${result.message}` : `Error ${result.error}`}
    </div>
  );
}

function ContextBar({ context, unreadCount, viewerAgent }: { context: ContextRecord | null; unreadCount: number; viewerAgent: string }) {
  if (!context) return <div className="sidecar-context-strip" aria-label="Active Sidecar Context">-</div>;
  return (
    <div className="sidecar-context-strip" aria-label="Active Sidecar Context">
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
    <span className="summary-pill sidecar-context-pill">
      <span className="sidecar-context-pill__label">{label}</span>
      <strong title={value}>{value}</strong>
    </span>
  );
}

function ContextRailItem({ symbol, label, value, detail, metric }: {
  symbol: string;
  label: string;
  value: string;
  detail: string;
  metric?: string;
}) {
  const detailId = `sidecar-context-rail-${safeClassSuffix(label)}`;
  return (
    <div className="sidecar-context-rail__item" tabIndex={0} aria-describedby={detailId} aria-label={`${label}: ${value}`}>
      <span className="sidecar-context-rail__symbol" aria-hidden="true">{symbol}</span>
      {metric ? <strong className="sidecar-context-rail__metric">{metric}</strong> : null}
      <div className="sidecar-context-rail__detail" id={detailId}>
        <span>{label}</span>
        <strong title={value}>{value}</strong>
        <small title={detail}>{detail}</small>
      </div>
    </div>
  );
}

function Pane({ title, count, extraCount, children }: PropsWithChildrenLike<{ title: string; count: number; extraCount?: number }>) {
  return (
    <section className="sidecar-pane">
      <div className="sidecar-pane__header">
        <h3>{title}</h3>
        <div className="sidecar-pane__counts">
          <span className="summary-pill summary-pill--active sidecar-pane__count">{count}</span>
          {extraCount ? <span className="summary-pill summary-pill--warn sidecar-pane__count">{extraCount} unread</span> : null}
        </div>
      </div>
      <div className="sidecar-pane__body">{children}</div>
    </section>
  );
}

function Row({ selected, onClick, children }: PropsWithChildrenLike<{ selected: boolean; onClick: () => void }>) {
  return (
    <button type="button" className={`sidecar-row${selected ? ' is-selected' : ''}`} onClick={onClick}>{children}</button>
  );
}

function Pill({ kind, children }: PropsWithChildrenLike<{ kind: string }>) {
  return <span className={`summary-pill sidecar-pill sidecar-pill--${safeClassSuffix(kind)}`}>{children}</span>;
}

function safeClassSuffix(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

function viewerTabTitle(state: SidecarState, tab: SidecarViewerTab) {
  if (tab.kind === 'surface') {
    return tab.objectId.split('/').filter(Boolean).pop() ?? tab.objectId;
  }
  if (tab.kind === 'ticket') {
    return state.tickets.find((ticket) => ticket.id === tab.objectId)?.title ?? tab.objectId;
  }
  if (tab.kind === 'comment') {
    const comment = state.comments.find((candidate) => candidate.id === tab.objectId);
    return comment?.title ?? comment?.subject ?? comment?.filename ?? tab.objectId;
  }
  if (tab.kind === 'project') {
    return state.projects.find((project) => project.id === tab.objectId)?.id ?? tab.objectId;
  }
  const session = state.sessions.records.find((candidate) => candidate.id === tab.objectId);
  return session ? sessionLabel(session) : tab.objectId;
}

function resolveViewerTab(state: SidecarState, tab: SidecarViewerTab) {
  if (tab.kind === 'surface') {
    return { kind: tab.kind, record: tab.objectId };
  }
  if (tab.kind === 'ticket') {
    return { kind: tab.kind, record: state.tickets.find((ticket) => ticket.id === tab.objectId) ?? null };
  }
  if (tab.kind === 'comment') {
    return { kind: tab.kind, record: state.comments.find((comment) => comment.id === tab.objectId) ?? null };
  }
  if (tab.kind === 'project') {
    return { kind: tab.kind, record: state.projects.find((project) => project.id === tab.objectId) ?? null };
  }
  return { kind: tab.kind, record: state.sessions.records.find((session) => session.id === tab.objectId) ?? null };
}

function viewerGroupLabel(groupId: SidecarViewerGroupId) {
  if (groupId === 'main' || groupId === 'secondary') return groupId;
  if (groupId === 'tertiary') return 'third';
  return 'fourth';
}

function ViewerLayoutToggle({ split, groupCount, onSplit, onAddVertical }: {
  split: SidecarViewerSplit;
  groupCount: number;
  onSplit: (split: SidecarViewerSplit) => void;
  onAddVertical: () => void;
}) {
  return (
    <div className="agent-console__layout-toggle sidecar-viewer-layout-toggle" aria-label="Sidecar viewer layout">
      {([
        ['single', 'Single'],
        ['split-horizontal', 'Split H'],
      ] as const).map(([nextSplit, label]) => (
        <button
          key={nextSplit}
          type="button"
          className={`agent-console__layout-button${split === nextSplit ? ' is-active' : ''}`}
          aria-pressed={split === nextSplit}
          onClick={() => onSplit(nextSplit)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        className={`agent-console__layout-button${split === 'split-vertical' ? ' is-active' : ''}`}
        disabled={groupCount >= SIDECAR_MAX_PANE_GROUPS}
        aria-label="Add vertical viewer pane"
        title="Add vertical viewer pane"
        onClick={onAddVertical}
      >
        |+
      </button>
    </div>
  );
}

function ViewerWorkspace({ state, viewerAgent, dispatch, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  state: SidecarState;
  viewerAgent: string;
  dispatch: Dispatch<SidecarMsg>;
  onTransition: (id: string, lane: string) => void;
  onToggleRead: (id: string, currentlyUnread: boolean) => void;
  onReplyOpen: (id: string) => void;
  onReplyEdit: (body: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (parentId: string, body: string) => void;
}) {
  const viewerWorkspace = state.ui.viewerWorkspace;
  const splitOrientation = viewerWorkspace.split === 'split-horizontal' ? 'horizontal' : 'vertical';
  return (
    <div className={`sidecar-viewer-workspace sidecar-viewer-workspace--${viewerWorkspace.split}`}>
      <div
        className="sidecar-viewer-groups"
        style={splitGridStyle(viewerWorkspace.split, viewerWorkspace.ratios, viewerWorkspace.groups.length)}
      >
        {viewerWorkspace.groups.flatMap((group, index) => {
          const nodes = [
            <ViewerGroupPane
              key={group.id}
              group={group}
              state={state}
              viewerAgent={viewerAgent}
              active={viewerWorkspace.activeGroupId === group.id}
              dispatch={dispatch}
              onTransition={onTransition}
              onToggleRead={onToggleRead}
              onReplyOpen={onReplyOpen}
              onReplyEdit={onReplyEdit}
              onReplyCancel={onReplyCancel}
              onReplySubmit={onReplySubmit}
            />,
          ];
          if (viewerWorkspace.split !== 'single' && index < viewerWorkspace.groups.length - 1) {
            nodes.push(
              <PaneSplitHandle
                key={`viewer-split-${group.id}`}
                surface="viewer"
                index={index}
                orientation={splitOrientation}
                ratios={viewerWorkspace.ratios}
                dispatch={dispatch}
              />,
            );
          }
          return nodes;
        })}
      </div>
    </div>
  );
}

function ViewerGroupPane({ group, state, viewerAgent, active, dispatch, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  group: SidecarViewerGroup;
  state: SidecarState;
  viewerAgent: string;
  active: boolean;
  dispatch: Dispatch<SidecarMsg>;
  onTransition: (id: string, lane: string) => void;
  onToggleRead: (id: string, currentlyUnread: boolean) => void;
  onReplyOpen: (id: string) => void;
  onReplyEdit: (body: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (parentId: string, body: string) => void;
}) {
  const workspace = state.ui.viewerWorkspace;
  const tabs = group.tabIds
    .map((tabId) => workspace.tabs.find((tab) => tab.id === tabId) ?? null)
    .filter((tab): tab is SidecarViewerTab => Boolean(tab));
  const activeTab = group.activeTabId ? workspace.tabs.find((tab) => tab.id === group.activeTabId) ?? null : null;
  return (
    <section
      className={`sidecar-viewer-group${active ? ' is-active' : ''}`}
      aria-label={`Viewer group ${viewerGroupLabel(group.id)}`}
      aria-selected={active}
      tabIndex={0}
      onPointerDownCapture={() => dispatch({ type: 'viewer/focus-group', groupId: group.id })}
      onFocusCapture={() => dispatch({ type: 'viewer/focus-group', groupId: group.id })}
    >
      <div className="sidecar-viewer-tabs" role="tablist" aria-label={`Viewer tabs ${viewerGroupLabel(group.id)}`}>
        {tabs.map((tab) => {
          const title = viewerTabTitle(state, tab);
          const selected = group.activeTabId === tab.id;
          return (
            <div className={`sidecar-viewer-tab${selected ? ' is-selected' : ''}`} key={`${group.id}:${tab.id}`}>
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                className="sidecar-viewer-tab__button"
                onClick={() => dispatch({ type: 'viewer/select-tab', groupId: group.id, tabId: tab.id })}
              >
                <span className="sidecar-viewer-tab__kind">{tab.kind}</span>
                <strong>{title}</strong>
              </button>
              <button
                type="button"
                className="sidecar-viewer-tab__close"
                aria-label={`Close viewer tab ${title}`}
                title={`Close viewer tab ${title}`}
                onClick={() => dispatch({ type: 'viewer/close-tab', groupId: group.id, tabId: tab.id })}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          );
        })}
      </div>
      <div className="sidecar-viewer-body">
        {activeTab ? (
          <ViewerTabBody
            tab={activeTab}
            state={state}
            viewerAgent={viewerAgent}
            onTransition={onTransition}
            onToggleRead={onToggleRead}
            onReplyOpen={onReplyOpen}
            onReplyEdit={onReplyEdit}
            onReplyCancel={onReplyCancel}
            onReplySubmit={onReplySubmit}
          />
        ) : (
          <div className="sidecar-inspector__empty">Select an item from the flyout.</div>
        )}
      </div>
    </section>
  );
}

function ViewerTabBody({ tab, state, viewerAgent, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  tab: SidecarViewerTab;
  state: SidecarState;
  viewerAgent: string;
  onTransition: (id: string, lane: string) => void;
  onToggleRead: (id: string, currentlyUnread: boolean) => void;
  onReplyOpen: (id: string) => void;
  onReplyEdit: (body: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (parentId: string, body: string) => void;
}) {
  if (tab.kind === 'surface') {
    return <Inspector><SurfaceInspector projectRoot={state.context?.project.root ?? null} relativePath={tab.objectId} /></Inspector>;
  }
  const resolved = resolveViewerTab(state, tab);
  if (resolved.kind === 'ticket' && resolved.record) {
    return <Inspector><TicketInspector t={resolved.record} onTransition={onTransition} /></Inspector>;
  }
  if (resolved.kind === 'comment' && resolved.record) {
    return (
      <Inspector>
        <CommentInspector
          c={resolved.record}
          isUnread={state.unreadIds.includes(resolved.record.id)}
          replying={state.replyDraft?.parentId === resolved.record.id}
          replyDraft={state.replyDraft}
          viewerAgent={viewerAgent}
          onToggleRead={onToggleRead}
          onReplyOpen={onReplyOpen}
          onReplyEdit={onReplyEdit}
          onReplyCancel={onReplyCancel}
          onReplySubmit={onReplySubmit}
        />
      </Inspector>
    );
  }
  if (resolved.kind === 'project' && resolved.record) {
    return <Inspector><ProjectInspector p={resolved.record} /></Inspector>;
  }
  if (resolved.kind === 'session' && resolved.record) {
    return <Inspector><SessionInspector s={resolved.record} /></Inspector>;
  }
  return <div className="sidecar-inspector__empty">Selected record is no longer available.</div>;
}

function SurfaceInspector({ projectRoot, relativePath }: { projectRoot: string | null; relativePath: string }) {
  const [surface, setSurface] = useState<SurfaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectRoot) {
      setSurface(null);
      setError('No Project context is available.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ workspaceRoot: projectRoot, relativePath });
    void fetchJson(`/api/surface?${params.toString()}`)
      .then((payload) => {
        if (!cancelled) setSurface(payload as SurfaceData);
      })
      .catch((err) => {
        if (!cancelled) {
          setSurface(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectRoot, relativePath]);

  if (loading) {
    return <div className="sidecar-inspector__empty">Loading {relativePath}.</div>;
  }
  if (error) {
    return <div className="sidecar-inspector__empty">Surface load failed: {error}</div>;
  }
  if (!surface) {
    return <div className="sidecar-inspector__empty">Surface not loaded.</div>;
  }
  if (surface.kind === 'file') {
    return (
      <div className="sidecar-surface-inspector">
        <div className="sidecar-inspector__id">{surface.relative_path}</div>
        <MarkdownDocument content={surface.content} />
      </div>
    );
  }
  if (surface.kind === 'directory') {
    return (
      <div className="sidecar-surface-inspector">
        <div className="sidecar-inspector__id">{surface.relative_path}</div>
        <h2 className="sidecar-inspector__title">Directory</h2>
        <div className="sidecar-surface-entry-list">
          {surface.entries.map((entry) => (
            <div key={entry.relative_path} className="sidecar-surface-entry">
              <span className="panel__eyebrow">{entry.kind}</span>
              <strong>{entry.name}</strong>
              <small>{entry.relative_path}</small>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <div className="sidecar-inspector__empty">Surface not found: {surface.relative_path}</div>;
}

function Inspector({ children }: PropsWithChildrenLike<{}>) {
  return <aside className="sidecar-inspector" aria-label="Sidecar inspector">{children}</aside>;
}

function TicketInspector({ t, onTransition }: { t: TicketRecord; onTransition: (id: string, lane: string) => void }) {
  const isStdoUx = (t.governanceScope || '').includes('UX');
  const lanes = ['active', 'backlog', 'completed'] as const;
  return (
    <div>
      <div className="sidecar-inspector__id">{t.id}</div>
      <h2 className="sidecar-inspector__title">{t.title}</h2>
      <Pill kind={`lane-${t.lane}`}>{t.lane}</Pill>
      {isStdoUx && <Pill kind="stdo-ux">STDO-UX</Pill>}
      <Pill kind="default">{t.changeClass}</Pill>
      <div className="sidecar-actions">
        <span className="sidecar-actions__label">Transition</span>
        {lanes.map((lane) => (
          <button key={lane} className="secondary sidecar-action-button" type="button" disabled={t.lane === lane} onClick={() => onTransition(t.id, lane)}>to {lane}</button>
        ))}
      </div>
      <MetaGrid items={[
        ['Goal', t.goal || '—'],
        ['Build tenant', t.buildTenant || '—'],
        ['Governance', t.governanceScope || '—'],
        ['Dependencies', Array.isArray(t.dependencies) ? t.dependencies.join(', ') : '—'],
      ]} />
      {t.targetTruth && <Section title="Target truth"><div className="sidecar-body-text">{t.targetTruth}</div></Section>}
      {t.evaluationCriteria && t.evaluationCriteria.length > 0 && (
        <Section title="Evaluation criteria">
          <ul className="sidecar-criteria-list">{t.evaluationCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
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
      <div className="sidecar-inspector__id">{c.id}</div>
      <h2 className="sidecar-inspector__title">{c.title || c.subject || c.filename}</h2>
      <Pill kind={`cat-${(c.category || '').toLowerCase()}`}>{c.category || '—'}</Pill>
      {isUnread && <Pill kind="stdo-ux">unread for {viewerAgent}</Pill>}
      <div className="sidecar-actions">
        <span className="sidecar-actions__label">Actions</span>
        <button className="secondary sidecar-action-button" type="button" onClick={() => onToggleRead(c.id, isUnread)}>{isUnread ? 'Mark read' : 'Mark unread'}</button>
        <button className="secondary sidecar-action-button" type="button" onClick={() => onReplyOpen(c.id)} disabled={replying}>Reply</button>
      </div>
      {replying && replyDraft && (
        <div className="sidecar-reply">
          <div className="sidecar-reply__label">Reply as <code>{viewerAgent}</code></div>
          <textarea className="agent-console__textarea sidecar-reply__textarea" value={replyDraft.body} onChange={(e) => onReplyEdit(e.target.value)} autoFocus />
          <div className="sidecar-actions sidecar-actions--reply">
            <button className="sidecar-action-button" type="button" onClick={() => onReplySubmit(c.id, replyDraft.body)}>Submit reply</button>
            <button className="secondary sidecar-action-button" type="button" onClick={onReplyCancel}>Cancel</button>
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
      {c.body && <Section title="Body (excerpt)"><div className="sidecar-body-text">{c.body.slice(0, 1500)}{c.body.length > 1500 ? '\n\n...(truncated)' : ''}</div></Section>}
    </div>
  );
}

function ProjectInspector({ p }: { p: ProjectRecord }) {
  return (
    <div>
      <div className="sidecar-inspector__id">{p.id}</div>
      <h2 className="sidecar-inspector__title">{p.name || 'Project'}</h2>
      <MetaGrid items={[
        ['Root', p.root],
        ['odd_type', p.odd_type],
        ['Registry', p.registry_source || '—'],
        ['Active', p.is_active ? 'yes' : 'no'],
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
      <div className="sidecar-inspector__id">{s.id}</div>
      <h2 className="sidecar-inspector__title">{sessionLabel(s)}</h2>
      <Pill kind={`session-${s.status}`}>{s.status}</Pill>
      <MetaGrid items={[
        ['Agent type', s.agent_type],
        ['Status', s.status],
        ['CWD', s.cwd],
        ['Label', typeof s.raw?.label === 'string' ? s.raw.label : '—'],
        ['PID', typeof s.raw?.pid === 'number' ? String(s.raw.pid) : '—'],
      ]} />
    </div>
  );
}

function terminalTabTitle(state: SidecarState, tab: SidecarTerminalTab) {
  const session = state.sessions.records.find((candidate) => candidate.id === tab.sessionId);
  return session ? sessionLabel(session) : tab.sessionId;
}

function resolveTerminalTab(state: SidecarState, tab: SidecarTerminalTab) {
  return state.sessions.records.find((session) => session.id === tab.sessionId) ?? null;
}

function terminalGroupLabel(groupId: SidecarTerminalGroupId) {
  if (groupId === 'main' || groupId === 'secondary') return groupId;
  if (groupId === 'tertiary') return 'third';
  return 'fourth';
}

function terminalSessionStatus(session: SessionRecord | null): TerminalStatus {
  if (!session) return 'closed';
  const status = String(session.status ?? 'unknown').toLowerCase();
  if (status === 'running' || status === 'live') return 'connected';
  if (status === 'error' || status === 'failed') return 'error';
  if (status === 'detached' || status === 'stopped' || status === 'closed') return 'closed';
  return 'connecting';
}

function terminalSessionStatusLabel(session: SessionRecord | null) {
  return terminalSessionStatus(session) === 'connected' ? 'connected' : String(session?.status ?? 'no shell');
}

function terminalSessionMetaLabel(session: SessionRecord | null) {
  if (!session) return 'Select a shell or target an empty pane.';
  const raw = session.raw ?? {};
  const pid = typeof raw.pid === 'number' ? `pid ${raw.pid}` : null;
  const shell = typeof raw.shell === 'string' ? raw.shell : null;
  const backend = typeof raw.backend === 'string' ? raw.backend : null;
  const meta = [pid, shell, backend].filter(Boolean).join(' · ');
  return meta || session.cwd || session.id;
}

function TerminalWorkspace({ state, projectRoot, dispatch, onSpawn, onKill, onCollapse }: {
  state: SidecarState;
  projectRoot: string | null;
  dispatch: Dispatch<SidecarMsg>;
  onSpawn: (groupId?: SidecarTerminalGroupId) => void;
  onKill: (id: string) => void;
  onCollapse: () => void;
}) {
  const terminalWorkspace = state.ui.terminalWorkspace;
  const activeGroup = terminalWorkspace.groups.find((group) => group.id === terminalWorkspace.activeGroupId) ?? terminalWorkspace.groups[0] ?? null;
  const activeGroupTab = activeGroup?.activeTabId
    ? terminalWorkspace.tabs.find((tab) => tab.id === activeGroup.activeTabId) ?? null
    : null;
  const activeSession = activeGroupTab
    ? state.sessions.records.find((session) => session.id === activeGroupTab.sessionId) ?? null
    : null;
  const activeGroupTabs = activeGroup
    ? activeGroup.tabIds
      .map((tabId) => terminalWorkspace.tabs.find((tab) => tab.id === tabId) ?? null)
      .filter((tab): tab is SidecarTerminalTab => Boolean(tab))
    : [];
  const activeGroupLabel = terminalGroupLabel(activeGroup?.id ?? terminalWorkspace.activeGroupId);
  const activeTerminalStatus = terminalSessionStatus(activeSession);
  const activeSessionLive = activeTerminalStatus === 'connected';
  const activeSessionMeta = terminalSessionMetaLabel(activeSession);
  const splitOrientation = terminalWorkspace.split === 'split-horizontal' ? 'horizontal' : 'vertical';
  const handleSessionSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    if (event.target.value) dispatch({ type: 'session/select', id: event.target.value });
  };
  return (
    <div className="sidecar-shell-layout">
      <div className="sidecar-terminal-toolbar" aria-label="Terminal controls">
        <select
          className="agent-console__select sidecar-shell-session-select"
          aria-label="Select Sidecar shell session"
          value={activeSession?.id ?? ''}
          disabled={state.sessions.records.length === 0}
          onChange={handleSessionSelect}
        >
          <option value="">No shell</option>
          {state.sessions.records.map((session) => (
            <option key={session.id} value={session.id}>
              {sessionLabel(session)} · {session.status}
            </option>
          ))}
        </select>
        <div className="sidecar-terminal-toolbar__context" aria-live="polite">
          <span className={terminalStatusClassName(activeTerminalStatus)}>{terminalSessionStatusLabel(activeSession)}</span>
          <span className="agent-console__terminal-meta">{activeSessionMeta}</span>
          {activeSession ? (
            <button
              className="ghost agent-console__terminal-action sidecar-terminal-toolbar__close"
              type="button"
              disabled={!activeSessionLive}
              onClick={() => onKill(activeSession.id)}
            >
              Close
            </button>
          ) : null}
        </div>
        <div className="sidecar-terminal-toolbar__tabs" role="tablist" aria-label={`Terminal tabs ${activeGroupLabel}`}>
          {activeGroupTabs.map((tab) => {
            const title = terminalTabTitle(state, tab);
            const selected = activeGroup?.activeTabId === tab.id;
            return (
              <div className={`sidecar-terminal-tab${selected ? ' is-selected' : ''}`} key={`${activeGroup?.id ?? 'active'}:${tab.id}`}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className="sidecar-terminal-tab__button"
                  onClick={() => activeGroup && dispatch({ type: 'terminal/select-tab', groupId: activeGroup.id, tabId: tab.id })}
                >
                  <span className="sidecar-terminal-tab__kind">shell</span>
                  <strong>{title}</strong>
                </button>
                <button
                  type="button"
                  className="sidecar-terminal-tab__close"
                  aria-label={`Close terminal tab ${title}`}
                  title={`Close terminal tab ${title}`}
                  onClick={() => activeGroup && dispatch({ type: 'terminal/close-tab', groupId: activeGroup.id, tabId: tab.id })}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            );
          })}
        </div>
        <button className="agent-console__new-shell sidecar-spawn-button" type="button" onClick={() => onSpawn()}>+ Spawn</button>
        <div className="agent-console__layout-toggle sidecar-terminal-layout-toggle" aria-label="Sidecar terminal layout">
          {([
            ['single', 'Single'],
            ['split-horizontal', 'Split H'],
          ] as const).map(([split, label]) => (
            <button
              key={split}
              type="button"
              className={`agent-console__layout-button${terminalWorkspace.split === split ? ' is-active' : ''}`}
              aria-pressed={terminalWorkspace.split === split}
              onClick={() => dispatch({ type: 'terminal/split', split })}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`agent-console__layout-button${terminalWorkspace.split === 'split-vertical' ? ' is-active' : ''}`}
            disabled={terminalWorkspace.groups.length >= SIDECAR_MAX_PANE_GROUPS}
            aria-label="Add vertical terminal pane"
            title="Add vertical terminal pane"
            onClick={() => dispatch({ type: 'terminal/split-add-vertical' })}
          >
            |+
          </button>
        </div>
        <button
          type="button"
          className="navigator-mode-toggle sidecar-terminal-collapse"
          onClick={onCollapse}
          aria-expanded={true}
          aria-label="Collapse terminal dock"
          title="Collapse terminal dock"
        >
          <span aria-hidden="true">⌄</span>
        </button>
      </div>

      <div className={`sidecar-terminal-workspace sidecar-terminal-workspace--${terminalWorkspace.split}`}>
        <div
          className="sidecar-terminal-groups"
          style={splitGridStyle(terminalWorkspace.split, terminalWorkspace.ratios, terminalWorkspace.groups.length)}
        >
          {terminalWorkspace.groups.flatMap((group, index) => {
            const nodes = [
              <TerminalGroupPane
                key={group.id}
                group={group}
                state={state}
                projectRoot={projectRoot}
                active={terminalWorkspace.activeGroupId === group.id}
                dispatch={dispatch}
                onSpawn={onSpawn}
              />,
            ];
            if (terminalWorkspace.split !== 'single' && index < terminalWorkspace.groups.length - 1) {
              nodes.push(
                <PaneSplitHandle
                  key={`terminal-split-${group.id}`}
                  surface="terminal"
                  index={index}
                  orientation={splitOrientation}
                  ratios={terminalWorkspace.ratios}
                  dispatch={dispatch}
                />,
              );
            }
            return nodes;
          })}
        </div>
      </div>
    </div>
  );
}

function TerminalGroupPane({ group, state, projectRoot, active, dispatch, onSpawn }: {
  group: SidecarTerminalGroup;
  state: SidecarState;
  projectRoot: string | null;
  active: boolean;
  dispatch: Dispatch<SidecarMsg>;
  onSpawn: (groupId?: SidecarTerminalGroupId) => void;
}) {
  const workspace = state.ui.terminalWorkspace;
  const activeTab = group.activeTabId ? workspace.tabs.find((tab) => tab.id === group.activeTabId) ?? null : null;
  return (
    <section
      className={`sidecar-terminal-group${active ? ' is-active' : ''}`}
      aria-label={`Terminal group ${terminalGroupLabel(group.id)}`}
      aria-selected={active}
      tabIndex={0}
      onPointerDownCapture={() => dispatch({ type: 'terminal/focus-group', groupId: group.id })}
      onFocusCapture={() => dispatch({ type: 'terminal/focus-group', groupId: group.id })}
    >
      <div className="sidecar-terminal-group__body">
        <TerminalTabBody
          group={group}
          tab={activeTab}
          state={state}
          projectRoot={projectRoot}
          dispatch={dispatch}
          onSpawn={onSpawn}
        />
      </div>
    </section>
  );
}

function TerminalTabBody({ group, tab, state, projectRoot, dispatch, onSpawn }: {
  group: SidecarTerminalGroup;
  tab: SidecarTerminalTab | null;
  state: SidecarState;
  projectRoot: string | null;
  dispatch: Dispatch<SidecarMsg>;
  onSpawn: (groupId?: SidecarTerminalGroupId) => void;
}) {
  if (!tab) {
    return (
      <div className="agent-console__terminal-shell sidecar-terminal-placeholder">
        <div className="agent-console__terminal-empty">
          <p className="muted">{state.sessions.records.length === 0 ? 'No Sidecar shell is open yet.' : 'Select a shell from the session strip.'}</p>
          {state.sessions.records.length === 0 ? <button type="button" onClick={() => onSpawn(group.id)}>Create First Shell</button> : null}
        </div>
      </div>
    );
  }
  const session = resolveTerminalTab(state, tab);
  if (!session) {
    return (
      <div className="agent-console__terminal-shell sidecar-terminal-placeholder">
        <div className="agent-console__terminal-empty">
          <p className="muted">This terminal session is no longer available.</p>
        </div>
      </div>
    );
  }
  return (
    <SessionTerminalWindow
      session={session}
      projectRoot={projectRoot}
      selected={state.activeSessionId === session.id}
      onActivate={() => dispatch({ type: 'terminal/select-tab', groupId: group.id, tabId: tab.id })}
    />
  );
}

function SessionTerminalWindow({ session, selected, onActivate, projectRoot }: {
  session: SessionRecord;
  selected: boolean;
  onActivate: () => void;
  projectRoot: string | null;
}) {
  const isLive = session.status === 'running' || session.status === 'live';
  return (
    <section className={`agent-console__terminal-shell sidecar-session-window${selected ? ' is-active' : ''}`} onClick={onActivate}>
      {projectRoot && isLive ? (
        <SidecarTerminal session={session} projectRoot={projectRoot} />
      ) : (
        <div className="sidecar-terminal-placeholder">
          <p className="muted">This shell is not live.</p>
        </div>
      )}
    </section>
  );
}

type TerminalStatus = 'connecting' | 'connected' | 'closed' | 'error';

type TerminalEvent =
  | { type: 'ready'; workspaceRoot: string; shell: string; pid: number; backend?: string }
  | { type: 'data'; data: string }
  | { type: 'exit'; exitCode: number; signal: number | null }
  | { type: 'error'; message: string };

function terminalTheme() {
  return {
    background: '#0a0d12',
    foreground: '#d8e1ec',
    cursor: '#6aa8ff',
    black: '#0a0d12',
    brightBlack: '#526070',
    red: '#ff6a6a',
    brightRed: '#ff8b8b',
    green: '#6affa3',
    brightGreen: '#95ffc0',
    yellow: '#ffa86a',
    brightYellow: '#ffc08a',
    blue: '#6aa8ff',
    brightBlue: '#8fbfff',
    magenta: '#ff6aff',
    brightMagenta: '#ff9dff',
    cyan: '#6affff',
    brightCyan: '#9fffff',
    white: '#d8e1ec',
    brightWhite: '#ffffff',
  };
}

function SidecarTerminal({ session, projectRoot }: {
  session: SessionRecord;
  projectRoot: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const statusRef = useRef<TerminalStatus>('connecting');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
      fontSize: 12,
      lineHeight: 1.25,
      scrollback: 4000,
      theme: terminalTheme(),
    });
    const fitAddon = new FitAddon();
    let disposed = false;
    let pendingFitFrame: number | null = null;

    function setConnectionStatus(nextStatus: TerminalStatus) {
      statusRef.current = nextStatus;
      terminal.options.disableStdin = nextStatus !== 'connected';
    }

    function send(payload: Record<string, unknown>) {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify(payload));
    }

    function safeFitAndResize() {
      if (disposed || terminalRef.current !== terminal || !host.isConnected) return;
      try {
        fitAddon.fit();
        send({ type: 'resize', cols: terminal.cols, rows: terminal.rows });
      } catch {
        // xterm may not have renderer dimensions during React dev probe mounts.
      }
    }

    function scheduleFitAndResize() {
      if (pendingFitFrame !== null) window.cancelAnimationFrame(pendingFitFrame);
      pendingFitFrame = window.requestAnimationFrame(() => {
        pendingFitFrame = null;
        safeFitAndResize();
      });
    }

    terminal.loadAddon(fitAddon);
    host.replaceChildren();
    terminal.open(host);
    terminal.options.disableStdin = true;
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setConnectionStatus('connecting');

    const resizeObserver = new ResizeObserver(() => scheduleFitAndResize());
    resizeObserver.observe(host);
    const inputDisposable = terminal.onData((data) => {
      if (statusRef.current === 'connected') send({ type: 'input', data });
    });
    const socket = new WebSocket(oddTermSocketUrl(projectRoot, session.id));
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      if (disposed) {
        socket.close();
        return;
      }
      setConnectionStatus('connected');
      scheduleFitAndResize();
      terminal.focus();
    });

    socket.addEventListener('message', (event) => {
      if (disposed) return;
      let payload: TerminalEvent;
      try {
        payload = JSON.parse(String(event.data)) as TerminalEvent;
      } catch {
        return;
      }
      if (payload.type === 'ready') {
        return;
      }
      if (payload.type === 'data') {
        terminal.write(payload.data);
        return;
      }
      if (payload.type === 'exit') {
        setConnectionStatus('closed');
        terminal.writeln('');
        terminal.writeln(`[session exited: ${payload.exitCode}]`);
        socket.close();
        return;
      }
      if (payload.type === 'error') {
        setConnectionStatus('error');
        terminal.writeln('');
        terminal.writeln(`[oddterm error] ${payload.message}`);
      }
    });

    socket.addEventListener('close', () => {
      if (disposed) return;
      setConnectionStatus(statusRef.current === 'error' ? 'error' : 'closed');
    });

    socket.addEventListener('error', () => {
      if (disposed) return;
      setConnectionStatus('error');
    });

    scheduleFitAndResize();

    return () => {
      disposed = true;
      if (pendingFitFrame !== null) {
        window.cancelAnimationFrame(pendingFitFrame);
        pendingFitFrame = null;
      }
      resizeObserver.disconnect();
      inputDisposable.dispose();
      if (socket.readyState === WebSocket.OPEN) socket.close();
      socketRef.current = null;
      terminalRef.current = null;
      fitAddonRef.current = null;
      window.setTimeout(() => {
        try { fitAddon.dispose(); } catch { /* best effort */ }
        try { terminal.dispose(); } catch { /* best effort */ }
      }, 100);
    };
  }, [projectRoot, session.id]);

  return (
    <div className="agent-console__terminal-shell sidecar-terminal">
      <div className="agent-console__terminal-host sidecar-terminal__host" ref={hostRef} />
    </div>
  );
}

function MetaGrid({ items }: { items: [string, string][] }) {
  return (
    <dl className="sidecar-meta-grid">
      {items.map(([label, value]) => (
        <div className="sidecar-meta-grid__item" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: PropsWithChildrenLike<{ title: string }>) {
  return (
    <section className="sidecar-section">
      <div className="sidecar-section__title">{title}</div>
      {children}
    </section>
  );
}

type PropsWithChildrenLike<T> = PropsWithChildren<T>;

function terminalStatusClassName(status: TerminalStatus) {
  const className = status === 'connected'
    ? 'converged'
    : status === 'error'
      ? 'blocked'
      : status === 'closed'
        ? 'attention'
        : 'pending';
  return `status-chip ${className}`;
}
