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
// to lift the active Context up. Project navigation inside Sidecar is a
// context-producing action, so the shell label and Project-scoped reads stay in
// the same root.

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
import {
  DocumentViewer,
  documentDescriptorForPath,
} from '../../components/DocumentViewer';
import type { TicketRecord } from '../../contracts/ticket';
import type { CommentRecord } from '../../contracts/comment';
import type { SessionRecord } from '../../contracts/session';
import type { ProjectRecord } from '../../contracts/project';
import type {
  SidecarProcessMap,
  SidecarProcessProjection,
  SidecarProcessRecord,
} from '../../contracts/process';
import { PROJECT_REGISTRY_CHANGED_EVENT, setActiveProject } from '../../lib/collaboration';
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
  SidecarDocumentViewerState,
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

interface NavigatorSortState {
  sort: NavigatorSortMode;
  reverse: boolean;
}

interface NavigatorFsEntry {
  name: string;
  absolutePath: string;
  kind?: 'directory' | 'file';
  updatedAt?: string;
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

function asProcessProjection(value: unknown) {
  const payload = asRecord(value, 'process projection');
  if (payload.kind !== 'sidecar_process_projection') {
    throw new Error('process projection kind is unsupported');
  }
  return payload as unknown as SidecarProcessProjection;
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

type SettledSurface<T> = { ok: true; value: T } | { ok: false; error: string };

async function settleSurface<T>(label: string, load: () => Promise<T>): Promise<SettledSurface<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (err) {
    return { ok: false, error: `${label}: ${err instanceof Error ? err.message : String(err)}` };
  }
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
    dispatch({ type: 'load/start', projectRoot: cmd.projectRoot });
    const [ctx, projects, tickets, comments, sessions, unread, processProjection] = await Promise.all([
      settleSurface('context', async () => asRecord(await fetchJson(apiUrl(backend, '/api/context', cmd.projectRoot)), 'context') as unknown as ContextRecord),
      settleSurface('projects', async () => asArray<ProjectRecord>(await fetchJson(`${backend}/api/projects`), 'projects')),
      settleSurface('tickets', async () => asArray<TicketRecord>(await fetchJson(apiUrl(backend, '/api/tickets', cmd.projectRoot)), 'tickets')),
      settleSurface('comments', async () => asArray<CommentRecord>(await fetchJson(apiUrl(backend, '/api/comments', cmd.projectRoot)), 'comments')),
      settleSurface('sessions', async () => asSessionCollection(await fetchJson(apiUrl(backend, '/api/sidecar/sessions', cmd.projectRoot)))),
      settleSurface('unread comments', async () => unreadIdsFrom(await fetchJson(apiUrl(backend, '/api/comments/unread', cmd.projectRoot, { agent: viewerAgent })))),
      settleSurface('process', async () => asProcessProjection(await fetchJson(apiUrl(backend, '/api/sidecar/process', cmd.projectRoot)))),
    ]);
    const payload: Extract<SidecarMsg, { type: 'load/done' }>['payload'] = {};
    const errors: string[] = [];
    if (ctx.ok) payload.context = ctx.value;
    else errors.push(ctx.error);
    if (projects.ok) payload.projects = projects.value;
    else errors.push(projects.error);
    if (tickets.ok) payload.tickets = tickets.value;
    else {
      payload.tickets = [];
      errors.push(tickets.error);
    }
    if (comments.ok) payload.comments = comments.value;
    else {
      payload.comments = [];
      errors.push(comments.error);
    }
    if (sessions.ok) payload.sessions = sessions.value;
    else {
      payload.sessions = { records: [], diagnostic: null };
      errors.push(sessions.error);
    }
    if (unread.ok) payload.unreadIds = unread.value;
    else {
      payload.unreadIds = [];
      errors.push(unread.error);
    }
    if (processProjection.ok) payload.process = processProjection.value;
    else {
      payload.process = null;
      errors.push(processProjection.error);
    }
    if (errors.length > 0) {
      payload.lastAction = { ok: false, error: `load partial: ${errors.join('; ')}` };
    }
    dispatch({ type: 'load/done', projectRoot: cmd.projectRoot, payload });
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
  const pendingProjectContextRoot = useRef<string | null>(null);
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

  const currentProjectRoot = state.activeLoadRoot ?? state.context?.project.root ?? projectRoot ?? null;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleProjectRegistryChanged = () => {
      dispatch({ type: 'load/request', projectRoot: currentProjectRoot, reason: 'action_completed' });
    };
    window.addEventListener(PROJECT_REGISTRY_CHANGED_EVENT, handleProjectRegistryChanged);
    return () => window.removeEventListener(PROJECT_REGISTRY_CHANGED_EVENT, handleProjectRegistryChanged);
  }, [currentProjectRoot]);

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
    if (!state.context || !onContextChange) return;
    const contextRoot = state.context.project.root;
    const contextWasSelectedHere = pendingProjectContextRoot.current === contextRoot;
    if (projectRoot && contextRoot !== projectRoot && !contextWasSelectedHere) return;
    if (contextWasSelectedHere) pendingProjectContextRoot.current = null;
    onContextChange(state.context);
  }, [projectRoot, state.context, onContextChange]);

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

  const [pinnedFolders, setPinnedFolders] = useState<string[] | null>(null);
  const [pinnedFoldersRoot, setPinnedFoldersRoot] = useState<string | null>(null);
  const [activePinnedFolderPath, setActivePinnedFolderPath] = useState<string | null>(null);
  const resolvedPinnedFolders = currentProjectRoot
    ? sanitizePinnedFolders(pinnedFolders ?? defaultPinnedFolders(currentProjectRoot), currentProjectRoot)
    : [];
  const activeProjectPinnedFolderPath = activePinnedFolderPath && isProjectFolderPath(activePinnedFolderPath, currentProjectRoot)
    ? activePinnedFolderPath
    : null;

  useEffect(() => {
    setActivePinnedFolderPath(null);
    if (!currentProjectRoot || typeof window === 'undefined') {
      setPinnedFoldersRoot(null);
      setPinnedFolders(null);
      return;
    }
    try {
      const raw = window.localStorage.getItem(pinnedFoldersStorageKey(currentProjectRoot));
      if (!raw) {
        const next = sanitizePinnedFolders(defaultPinnedFolders(currentProjectRoot), currentProjectRoot);
        setPinnedFoldersRoot(currentProjectRoot);
        setPinnedFolders(next);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      const next = Array.isArray(parsed)
        ? sanitizePinnedFolders(parsed.filter((path): path is string => typeof path === 'string'), currentProjectRoot)
        : sanitizePinnedFolders(defaultPinnedFolders(currentProjectRoot), currentProjectRoot);
      setPinnedFoldersRoot(currentProjectRoot);
      setPinnedFolders(next);
    } catch {
      const next = sanitizePinnedFolders(defaultPinnedFolders(currentProjectRoot), currentProjectRoot);
      setPinnedFoldersRoot(currentProjectRoot);
      setPinnedFolders(next);
    }
  }, [currentProjectRoot]);

  useEffect(() => {
    if (!currentProjectRoot || pinnedFolders === null || typeof window === 'undefined') return;
    if (pinnedFoldersRoot !== currentProjectRoot) return;
    const sanitized = sanitizePinnedFolders(pinnedFolders, currentProjectRoot);
    window.localStorage.setItem(pinnedFoldersStorageKey(currentProjectRoot), JSON.stringify(sanitized));
    if (sanitized.length !== pinnedFolders.length || sanitized.some((path, index) => path !== pinnedFolders[index])) {
      setPinnedFolders(sanitized);
    }
  }, [currentProjectRoot, pinnedFolders, pinnedFoldersRoot]);

  const handlePinnedFoldersChange = (paths: string[], activatePath?: string) => {
    const next = currentProjectRoot ? sanitizePinnedFolders(paths, currentProjectRoot) : dedupeSortedPins(paths);
    setPinnedFoldersRoot(currentProjectRoot);
    setPinnedFolders(next);
    const normalizedActivatePath = activatePath ? normalizePinnedPath(activatePath) : '';
    if (normalizedActivatePath && next.includes(normalizedActivatePath)) {
      setActivePinnedFolderPath(normalizedActivatePath);
      dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: false });
    }
  };

  const handlePinnedFolderUnpin = (path: string) => {
    const next = resolvedPinnedFolders.filter((candidate) => candidate !== path);
    setPinnedFoldersRoot(currentProjectRoot);
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

  const handleFileSurfaceSelect = (relativePath: string, absolutePath: string, source: SidecarPathHistorySource) => {
    handleSurfaceSelect(relativePath, absolutePath, source);
  };

  const handleProjectSelect = async (project: ProjectRecord) => {
    try {
      const result = await setActiveProject(project.id);
      pendingProjectContextRoot.current = result.project.root;
      dispatch({ type: 'select', kind: 'project', id: result.project.id });
    } catch (caught) {
      dispatch({ type: 'action/result', ok: false, error: caught instanceof Error ? caught.message : String(caught) });
    }
  };

  const handleProjectRootOpen = async (root: string) => {
    try {
      const result = await setActiveProject(root);
      pendingProjectContextRoot.current = result.project.root;
      dispatch({ type: 'load/request', projectRoot: result.project.root, reason: 'project_selected' });
    } catch (caught) {
      dispatch({ type: 'action/result', ok: false, error: caught instanceof Error ? caught.message : String(caught) });
    }
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

  const handleHistoryOpen = async (entry: SidecarPathHistoryEntry) => {
    const targetRoot = normalizePinnedPath(entry.projectRoot);
    if (!targetRoot) {
      dispatch({ type: 'action/result', ok: false, error: 'Recent path has no recorded Project root.' });
      return;
    }
    if (currentProjectRoot && normalizePinnedPath(currentProjectRoot) === targetRoot) {
      dispatch({ type: 'select', kind: 'surface', id: entry.relativePath });
      return;
    }
    const project = state.projects.find((candidate) => normalizePinnedPath(candidate.root) === targetRoot);
    if (!project) {
      dispatch({ type: 'action/result', ok: false, error: `Recent path Project is not registered: ${entry.projectRoot}` });
      return;
    }
    try {
      const result = await setActiveProject(project.id);
      pendingProjectContextRoot.current = result.project.root;
      setActivePinnedFolderPath(null);
      dispatch({ type: 'select', kind: 'project', id: result.project.id });
      dispatch({ type: 'select', kind: 'surface', id: entry.relativePath });
    } catch (caught) {
      dispatch({ type: 'action/result', ok: false, error: caught instanceof Error ? caught.message : String(caught) });
    }
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
  const selectedProcessNavigator = state.selection.kind === 'process';
  const selectedProcessNavigatorTitle = selectedProcessNavigator
    ? state.selection.id === 'navigator' ? 'Process Navigator N0' : 'Process Navigator'
    : null;
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
  const workbenchLayout = state.ui.workbenchLayout;
  const workbenchStyle = {
    '--sidecar-explorer-width': `${workbenchLayout.explorerWidthPx}px`,
    '--sidecar-bottom-dock-height': `${workbenchLayout.bottomDockHeightPx}px`,
  } as CSSProperties;
  const selectedObjectTitle = selectedTicket?.title
    ?? selectedComment?.title
    ?? selectedComment?.subject
    ?? selectedComment?.filename
    ?? selectedProject?.id
    ?? selectedSurfacePath
    ?? selectedProcessNavigatorTitle
    ?? (selectedInspectorSession ? sessionLabel(selectedInspectorSession) : null)
    ?? 'No object selected';
  const selectedObjectKind = state.selection.kind ?? 'workspace';
  const systemInfoProviderIds = new Set<SidecarInfoSurface>(['browse', 'history']);
  const primaryInfoProviders = SIDECAR_EXPLORER_PROVIDERS.filter((provider) => !systemInfoProviderIds.has(provider.id));
  const systemInfoProviders = SIDECAR_EXPLORER_PROVIDERS.filter((provider) => systemInfoProviderIds.has(provider.id));
  const selectionHeaderActions = (
    <div className="sidecar-flyout__actions">
      <button
        type="button"
        className={`navigator-mode-toggle${state.ui.infoPinned ? ' is-active' : ''}`}
        onClick={() => dispatch({ type: 'ui/set-info-pinned' })}
        aria-pressed={state.ui.infoPinned}
        aria-label={state.ui.infoPinned ? 'Unpin selection flyout' : 'Pin selection flyout'}
        title={state.ui.infoPinned ? 'Unpin selection flyout' : 'Pin selection flyout'}
      >
        <span aria-hidden="true">P</span>
      </button>
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
  );

  return (
    <div className="sidecar-panel sidecar-panel--workbench">
      <div
        className={`sidecar-workbench${state.ui.infoCollapsed ? ' is-left-collapsed' : ''}${state.ui.infoPinned ? ' is-left-pinned' : ''}${state.ui.shellCollapsed ? ' is-bottom-collapsed' : ''}`}
        style={workbenchStyle}
      >
        <nav className="sidecar-activity-rail" aria-label="Sidecar selection surfaces">
          <div className="sidecar-rail-stack">
            {primaryInfoProviders.map((provider) => (
              <RailButton
                key={provider.id}
                label={provider.label}
                shortLabel={provider.shortLabel}
                count={infoSurfaceCount(provider.id, state)}
                selected={!activeProjectPinnedFolderPath && activeInfoSurface === provider.id}
                onClick={() => handleInfoSurfaceSelect(provider.id)}
              />
            ))}
            {resolvedPinnedFolders.length > 0 ? <div className="sidecar-rail-divider" role="separator" aria-label="Favorites" /> : null}
            {resolvedPinnedFolders.map((path) => (
              <PinnedRailButton
                key={`pin:${path}`}
                label={pinnedFolderRailLabel(path, currentProjectRoot)}
                shortLabel={pinnedFolderShortLabel(path, currentProjectRoot)}
                selected={activeProjectPinnedFolderPath === path}
                onClick={() => handlePinnedFolderSelect(path)}
                onUnpin={() => handlePinnedFolderUnpin(path)}
              />
            ))}
          </div>
          <div className="sidecar-rail-bottom">
            {systemInfoProviders.length > 0 ? <div className="sidecar-rail-divider" role="separator" aria-label="System navigation" /> : null}
            {systemInfoProviders.map((provider) => (
              <RailButton
                key={provider.id}
                label={provider.label}
                shortLabel={provider.shortLabel}
                count={provider.id === 'browse' ? 'fs' : infoSurfaceCount(provider.id, state)}
                selected={!activeProjectPinnedFolderPath && activeInfoSurface === provider.id}
                onClick={() => handleInfoSurfaceSelect(provider.id)}
              />
            ))}
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
            if (state.ui.infoPinned) return;
            if (event.target instanceof Element && event.target.closest('.sidecar-flyout')) return;
            dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: true });
          }}
        >
          {!state.ui.infoCollapsed ? (
            <aside className="sidecar-flyout" aria-label="Sidecar selection flyout">
              <SelectionFlyout
                surface={activeInfoSurface}
                state={state}
                activePinnedFolderPath={activeProjectPinnedFolderPath}
                pinnedFolders={resolvedPinnedFolders}
                headerActions={selectionHeaderActions}
                projectRootOverride={currentProjectRoot}
                onPinnedFoldersChange={handlePinnedFoldersChange}
                onPinnedFolderUnpin={handlePinnedFolderUnpin}
                onProjectSelect={handleProjectSelect}
                onProjectRootOpen={handleProjectRootOpen}
                onSurfaceSelect={handleFileSurfaceSelect}
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
          <ContextRailCommand
            symbol="N"
            label="Open Process Navigator"
            value={state.process?.supported ? 'ts-v1' : 'unsupported'}
            detail="Simplified graph/function/assets navigator"
            active={state.selection.kind === 'process' && state.selection.id === 'navigator-simple'}
            onClick={() => {
              dispatch({ type: 'viewer/open', kind: 'process', id: 'navigator-simple' });
              dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: true });
            }}
          />
          <ContextRailCommand
            symbol="N0"
            label="Open Process Navigator N0"
            value={state.process?.supported ? 'legacy' : 'unsupported'}
            detail="Original TypeScript odd_sdlc process projection"
            active={state.selection.kind === 'process' && state.selection.id === 'navigator'}
            onClick={() => {
              dispatch({ type: 'viewer/open', kind: 'process', id: 'navigator' });
              dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: true });
            }}
          />
          <ContextRailCommand
            symbol="$"
            label={state.ui.shellCollapsed ? 'Restore shell workspace' : 'Minimize shell workspace'}
            value={state.ui.shellCollapsed ? 'collapsed' : 'open'}
            detail={shellSummary}
            active={!state.ui.shellCollapsed}
            onClick={() => dispatch({ type: 'ui/toggle-workspace', workspace: 'shell' })}
          />
          <ContextRailCommand
            symbol="R"
            label="Reset sidecar layout"
            value="default"
            detail="Reset layout profile"
            onClick={() => dispatch({ type: 'layout/profile-reset' })}
          />
          <div className="sidecar-context-rail__divider" role="separator" aria-label="Context" />
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

function builtInNavigatorFolderForSurface(surface: SidecarInfoSurface, projectRoot: string | null) {
  if (!projectRoot) return null;
  if (surface === 'tickets') return absoluteProjectPath(projectRoot, '.ai-workspace/tickets');
  if (surface === 'comments') return absoluteProjectPath(projectRoot, '.ai-workspace/comments');
  return null;
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
  return entry.updatedAt || entry.name;
}

function dedupeSortedPins(paths: string[]) {
  return Array.from(new Set(paths.map(normalizePinnedPath).filter(Boolean)));
}

function sanitizePinnedFolders(paths: string[], projectRoot: string | null) {
  const root = projectRoot ? normalizePinnedPath(projectRoot) : null;
  const blocked = new Set(builtInNavigatorFolders(projectRoot).map(normalizePinnedPath));
  return dedupeSortedPins(paths).filter((path) => {
    if (blocked.has(path)) return false;
    return isProjectFolderPath(path, root);
  });
}

function isProjectFolderPath(path: string, projectRoot: string | null) {
  const root = projectRoot ? normalizePinnedPath(projectRoot) : null;
  if (!root) return false;
  const normalizedPath = normalizePinnedPath(path);
  return normalizedPath === root || normalizedPath.startsWith(`${root}/`);
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
      .map((entry) => ({
        ...entry,
        updatedAt: typeof (entry as { updatedAt?: unknown }).updatedAt === 'string'
          ? (entry as { updatedAt: string }).updatedAt
          : undefined,
      }))
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
  headerActions,
  projectRootOverride,
  onPinnedFoldersChange,
  onPinnedFolderUnpin,
  onProjectSelect,
  onProjectRootOpen,
  onSurfaceSelect,
  onPathHistoryCopy,
  onPathHistoryOpen,
}: {
  surface: SidecarInfoSurface;
  state: SidecarState;
  activePinnedFolderPath: string | null;
  pinnedFolders: string[];
  headerActions?: ReactNode;
  projectRootOverride?: string | null;
  onPinnedFoldersChange: (paths: string[], activatePath?: string) => void;
  onPinnedFolderUnpin: (path: string) => void;
  onProjectSelect: (project: ProjectRecord) => void;
  onProjectRootOpen: (root: string) => void;
  onSurfaceSelect: (relativePath: string, absolutePath: string, source: SidecarPathHistorySource) => void;
  onPathHistoryCopy: (entry: SidecarPathHistoryEntry) => void;
  onPathHistoryOpen: (entry: SidecarPathHistoryEntry) => void;
}) {
  const projectRoot = projectRootOverride ?? state.context?.project.root ?? null;
  const [groupStates, setGroupStates] = useState<Record<string, NavigatorGroupState>>({});
  const [navigatorSort, setNavigatorSort] = useState<NavigatorSortState>({ sort: 'time', reverse: true });
  const [pinDraft, setPinDraft] = useState('');
  const [folderLoads, setFolderLoads] = useState<Record<string, NavigatorFolderLoad>>({});
  const [expandedProjectRoots, setExpandedProjectRoots] = useState<Record<string, boolean>>({});
  const projectRootPath = projectRoot ? normalizePinnedPath(projectRoot) : null;
  const builtInFolderPath = builtInNavigatorFolderForSurface(surface, projectRoot);

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
      const payload = await fetchJson(`/api/fs/browse?path=${encodeURIComponent(path)}&includeFiles=1&includeHidden=1&maxEntries=0`);
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

  const toggleProjectBrowse = (root: string) => {
    const normalizedRoot = normalizePinnedPath(root);
    setExpandedProjectRoots((current) => ({
      ...current,
      [normalizedRoot]: !current[normalizedRoot],
    }));
    if (!folderLoads[normalizedRoot]) {
      void loadFolder(normalizedRoot);
    }
  };

  const sortToolbar = (
    <NavigatorSortToolbar
      sort={navigatorSort}
      onSort={(sort) => setNavigatorSort((current) => ({ ...current, sort }))}
      onReverse={() => setNavigatorSort((current) => ({ ...current, reverse: !current.reverse }))}
    />
  );

  useEffect(() => {
    if (surface !== 'browse' || !projectRootPath || folderLoads[projectRootPath]) return;
    void loadFolder(projectRootPath);
  }, [surface, projectRootPath, folderLoads, loadFolder]);

  useEffect(() => {
    if (!builtInFolderPath || folderLoads[builtInFolderPath]) return;
    void loadFolder(builtInFolderPath);
  }, [builtInFolderPath, folderLoads, loadFolder]);

  useEffect(() => {
    if (!activePinnedFolderPath || folderLoads[activePinnedFolderPath]) return;
    void loadFolder(activePinnedFolderPath);
  }, [activePinnedFolderPath, folderLoads, loadFolder]);

  useEffect(() => {
    if (surface !== 'projects') return;
    const selectedProjectRoot = state.selection.kind === 'project'
      ? state.projects.find((project) => project.id === state.selection.id)?.root ?? null
      : null;
    const normalizedSelectedProjectRoot = selectedProjectRoot ? normalizePinnedPath(selectedProjectRoot) : null;
    const roots = state.projects
      .map((project) => normalizePinnedPath(project.root))
      .filter((root) => root && ((expandedProjectRoots[root] ?? (root === normalizedSelectedProjectRoot)) === true));
    for (const root of roots) {
      if (!folderLoads[root]) void loadFolder(root);
    }
  }, [expandedProjectRoots, folderLoads, loadFolder, state.projects, state.selection, surface]);

  if (activePinnedFolderPath && projectRoot) {
    const displayPath = folderDisplayPath(activePinnedFolderPath, projectRoot);
    return (
      <Pane title={displayPath} count={folderLoads[activePinnedFolderPath]?.entries.length ?? 0} actions={headerActions}>
        {sortToolbar}
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
            navigatorSort={navigatorSort}
          />
        </div>
      </Pane>
    );
  }

  if (builtInFolderPath && projectRoot) {
    const displayPath = folderDisplayPath(builtInFolderPath, projectRoot);
    return (
      <Pane title={infoSurfaceTitle(surface)} count={folderLoads[builtInFolderPath]?.entries.length ?? infoSurfaceCount(surface, state)} actions={headerActions}>
        {sortToolbar}
        <div className="sidecar-folder-tree">
          <FolderTreeNode
            path={builtInFolderPath}
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
            navigatorSort={navigatorSort}
          />
        </div>
      </Pane>
    );
  }

  if (surface === 'tickets' || surface === 'comments') {
    return (
      <Pane title={infoSurfaceTitle(surface)} count={0} actions={headerActions}>
        <NavigatorEmptyState>Select a Project to browse {infoSurfaceTitle(surface).toLowerCase()}.</NavigatorEmptyState>
      </Pane>
    );
  }

  if (surface === 'projects') {
    return (
      <Pane title="Projects" count={state.projects.length} actions={headerActions}>
        {sortToolbar}
        <div className="sidecar-project-browser">
          {state.projects.map((project) => {
            const normalizedRoot = normalizePinnedPath(project.root);
            const selected = state.selection.kind === 'project' && state.selection.id === project.id;
            const expanded = expandedProjectRoots[normalizedRoot] ?? selected;
            return (
              <div key={project.id} className="sidecar-project-browser__entry">
                <div className={`sidecar-row sidecar-row--project${selected ? ' is-selected' : ''}`}>
                  <button
                    type="button"
                    className="sidecar-project-browser__main"
                    onClick={() => onProjectSelect(project)}
                  >
                    <div className="sidecar-row__title">{project.name || project.id}</div>
                    <div className="sidecar-row__meta">
                      {project.odd_type !== 'unknown' && <Pill kind="odd-type">{project.odd_type}</Pill>}
                      {project.build_tenants.length > 0 && <span>{project.build_tenants.length} tenant{project.build_tenants.length === 1 ? '' : 's'}</span>}
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`sidecar-tree-control sidecar-tree-control--text${expanded ? ' is-active' : ''}`}
                    onClick={() => toggleProjectBrowse(project.root)}
                    aria-expanded={expanded}
                    title={`Browse folders under ${project.root}`}
                  >
                    {expanded ? 'Hide' : 'Browse'}
                  </button>
                </div>
                {expanded ? (
                  <div className="sidecar-project-browser__tree">
                    <FolderTreeNode
                      path={normalizedRoot}
                      label="."
                      depth={0}
                      projectRoot={normalizedRoot}
                      groupStates={groupStates}
                      folderLoads={folderLoads}
                      defaultCollapsed={false}
                      onPatchGroup={patchGroup}
                      onToggle={handleFolderToggle}
                      onLoad={loadFolder}
                      onSurfaceSelect={onSurfaceSelect}
                      pathSource="browse"
                      pinnedFolders={[]}
                      onPinFolder={() => undefined}
                      onUnpinFolder={() => undefined}
                      navigatorSort={navigatorSort}
                      projectBrowser
                      onProjectRootOpen={onProjectRootOpen}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Pane>
    );
  }

  if (surface === 'history') {
    return (
      <PathHistoryPane
        entries={state.pathHistory}
        currentProjectRoot={projectRoot}
        headerActions={headerActions}
        onCopy={onPathHistoryCopy}
        onOpen={onPathHistoryOpen}
      />
    );
  }

  if (surface === 'browse') {
    return (
      <Pane title="Browse" count={projectRootPath ? folderLoads[projectRootPath]?.entries.length ?? 0 : 0} actions={headerActions}>
        {sortToolbar}
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
              navigatorSort={navigatorSort}
            />
          </div>
        ) : null}
      </Pane>
    );
  }

  return null;
}

function PathHistoryPane({ entries, currentProjectRoot, headerActions, onCopy, onOpen }: {
  entries: SidecarPathHistoryEntry[];
  currentProjectRoot: string | null;
  headerActions?: ReactNode;
  onCopy: (entry: SidecarPathHistoryEntry) => void;
  onOpen: (entry: SidecarPathHistoryEntry) => void;
}) {
  return (
    <Pane title="Recent Paths" count={entries.length} actions={headerActions}>
      {entries.length === 0 ? <NavigatorEmptyState>No recent file paths.</NavigatorEmptyState> : null}
      {entries.map((entry) => {
        const sameProject = Boolean(currentProjectRoot && normalizePinnedPath(entry.projectRoot) === normalizePinnedPath(currentProjectRoot));
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
              onClick={() => onOpen(entry)}
              aria-label={`Open path ${entry.relativePath}`}
              title={sameProject ? `Open ${entry.relativePath}` : 'Switch to the recorded Project and open this path'}
            >
              Open
            </button>
          </div>
        );
      })}
    </Pane>
  );
}

function NavigatorSortToolbar({ sort, onSort, onReverse }: {
  sort: NavigatorSortState;
  onSort: (sort: NavigatorSortMode) => void;
  onReverse: () => void;
}) {
  return (
    <div className="sidecar-navigator-toolbar" aria-label="Browse sort controls">
      <span className="sidecar-navigator-toolbar__label">Sort</span>
      <div className="sidecar-navigator-toolbar__controls">
        <button
          type="button"
          className={`sidecar-tree-control sidecar-tree-control--text${sort.sort === 'alpha' ? ' is-active' : ''}`}
          onClick={() => onSort('alpha')}
          aria-pressed={sort.sort === 'alpha'}
          title="Sort folders alphabetically"
        >
          Name
        </button>
        <button
          type="button"
          className={`sidecar-tree-control sidecar-tree-control--text${sort.sort === 'time' ? ' is-active' : ''}`}
          onClick={() => onSort('time')}
          aria-pressed={sort.sort === 'time'}
          title="Sort folders by time"
        >
          Time
        </button>
        <button
          type="button"
          className={`sidecar-tree-control sidecar-tree-control--text${sort.reverse ? ' is-active' : ''}`}
          onClick={onReverse}
          aria-pressed={sort.reverse}
          title="Reverse folder sort"
        >
          Reverse
        </button>
      </div>
    </div>
  );
}

function NavigatorTreeGroup({ label, count, group, onToggle, extraControls, children }: PropsWithChildrenLike<{
  label: string;
  count: number;
  group: NavigatorGroupState;
  onToggle: () => void;
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
        <div className="sidecar-tree-group__controls" aria-label={`${label} folder controls`}>
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

function FolderTreeNode({ path, label, depth, projectRoot, groupStates, folderLoads, defaultCollapsed = true, onPatchGroup, onToggle, onLoad, onSurfaceSelect, pathSource, pinnedFolders, onPinFolder, onUnpinFolder, navigatorSort, projectBrowser = false, canOpenProject = false, onProjectRootOpen }: {
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
  navigatorSort: NavigatorSortState;
  projectBrowser?: boolean;
  canOpenProject?: boolean;
  onProjectRootOpen?: (root: string) => void;
}) {
  const key = navigatorGroupKey('folder', path);
  const group = navigatorGroupState(groupStates, key, { collapsed: defaultCollapsed, sort: 'time', reverse: true });
  const load = folderLoads[path] ?? null;
  const visibleEntries = projectBrowser
    ? (load?.entries ?? []).filter((entry) => (entry.kind ?? 'directory') === 'directory')
    : load?.entries ?? [];
  const entries = compareBySort(visibleEntries, { ...group, ...navigatorSort }, (entry) => entry.name, folderEntryTime);
  const normalizedPath = normalizePinnedPath(path);
  const isPinned = pinnedFolders.includes(normalizedPath);
  const isBuiltIn = builtInNavigatorFolders(projectRoot).map(normalizePinnedPath).includes(normalizedPath);
  const pinLabel = `${isPinned ? 'Unpin' : 'Pin'} ${label}`;
  const controls = (
    <>
      {canOpenProject && onProjectRootOpen ? (
        <button
          type="button"
          className="sidecar-tree-control sidecar-tree-control--text sidecar-tree-control--open"
          onClick={() => onProjectRootOpen(normalizedPath)}
          title={`Open Project ${normalizedPath}`}
        >
          Open
        </button>
      ) : null}
      {!projectBrowser && !isBuiltIn ? (
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
    </>
  );

  return (
    <div className="sidecar-folder-node" style={{ '--sidecar-tree-depth': depth } as CSSProperties}>
      <NavigatorTreeGroup
        label={label}
        count={entries.length}
        group={group}
        onToggle={() => onToggle(key, path, group.collapsed)}
        extraControls={controls}
      >
        {load?.loading ? <NavigatorEmptyState>Loading folders...</NavigatorEmptyState> : null}
        {load?.error ? <div className="sidecar-navigator-error">{load.error}</div> : null}
        {load && !load.loading && !load.error && entries.length === 0 ? <NavigatorEmptyState>No child entries.</NavigatorEmptyState> : null}
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
              navigatorSort={navigatorSort}
              projectBrowser={projectBrowser}
              canOpenProject={entry.hasWorkspace === true}
              onProjectRootOpen={onProjectRootOpen}
            />
          );
        })}
        {load?.truncated ? <NavigatorEmptyState>Showing first 500 entries.</NavigatorEmptyState> : null}
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

function ContextRailCommand({ symbol, label, value, detail, active = false, onClick }: {
  symbol: string;
  label: string;
  value: string;
  detail: string;
  active?: boolean;
  onClick: () => void;
}) {
  const detailId = `sidecar-context-command-${safeClassSuffix(label)}`;
  return (
    <button
      type="button"
      className={`sidecar-context-rail__item sidecar-context-rail__command${active ? ' is-active' : ''}`}
      aria-describedby={detailId}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <span className="sidecar-context-rail__symbol" aria-hidden="true">{symbol}</span>
      <div className="sidecar-context-rail__detail" id={detailId}>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </button>
  );
}

function Pane({ title, count, extraCount, actions, children }: PropsWithChildrenLike<{ title: string; count: number; extraCount?: number; actions?: ReactNode }>) {
  return (
    <section className="sidecar-pane">
      <div className="sidecar-pane__header">
        <h3>
          <span className="sidecar-pane__title">{title}</span>
          <span className="sidecar-pane__title-count">({count})</span>
        </h3>
        <div className="sidecar-pane__header-actions">
          {extraCount ? <span className="summary-pill summary-pill--warn sidecar-pane__count">{extraCount} unread</span> : null}
          {actions}
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
  if (tab.kind === 'process') {
    return tab.objectId === 'navigator' ? 'Process Navigator N0' : 'Process Navigator';
  }
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
  if (tab.kind === 'process') {
    return { kind: tab.kind, record: state.process };
  }
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
            dispatch={dispatch}
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

function ViewerTabBody({ tab, state, viewerAgent, dispatch, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  tab: SidecarViewerTab;
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
  if (tab.kind === 'process') {
    if (tab.objectId === 'navigator-simple') {
      return <ProcessNavigatorSimplePanel state={state} dispatch={dispatch} />;
    }
    return <ProcessNavigatorPanel state={state} dispatch={dispatch} />;
  }
  if (tab.kind === 'surface') {
    return (
      <Inspector>
        <SurfaceInspector
          projectRoot={state.context?.project.root ?? null}
          tabId={tab.id}
          relativePath={tab.objectId}
          viewerState={state.ui.documentViewers[tab.id]}
          dispatch={dispatch}
        />
      </Inspector>
    );
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

type ProcessNavigatorSimpleTab = 'graphs' | 'functions' | 'assets';
type ProcessSimpleFunctionItem = {
  id: string;
  name: string;
  eyebrow: string;
  title: string;
  summary: string;
  meta: Array<[string, string]>;
  source: 'executive' | 'leaf' | 'library';
  executive?: NonNullable<SidecarProcessProjection['catalog']>['executives'][number];
  leaf?: NonNullable<SidecarProcessProjection['catalog']>['leaves'][number];
  library?: NonNullable<SidecarProcessProjection['catalog']>['library'][number];
};

function ProcessNavigatorSimplePanel({ state, dispatch }: {
  state: SidecarState;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const projection = state.process;
  const [activeTab, setActiveTab] = useState<ProcessNavigatorSimpleTab>('graphs');
  const [selectedOverlayRef, setSelectedOverlayRef] = useState<string | null>(null);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [selectedAssetName, setSelectedAssetName] = useState<string | null>(null);

  if (!projection) {
    return <div className="sidecar-inspector__empty">Process projection is not loaded.</div>;
  }
  if (!projection.supported) {
    return (
      <div className="sidecar-process-navigator sidecar-process-navigator--unsupported">
        <div className="sidecar-process-navigator__header">
          <span className="panel__eyebrow">Process Navigator</span>
          <h2>TypeScript process contract unavailable</h2>
          <Pill kind="blocked">unsupported</Pill>
        </div>
        <p>{projection.unsupportedReason ?? 'This Project does not expose the odd_sdlc TypeScript process contract.'}</p>
      </div>
    );
  }

  const catalog = projection.catalog ?? null;
  const traversalOverlays = projection.traversalOverlays ?? [];
  const graphTabCount = traversalOverlays.length;
  const assetRelationships = catalog ? processAssetRelationships(catalog) : [];
  const functionItems = catalog ? processFunctionItems(catalog) : [];
  const selectedOverlay = traversalOverlays.find((overlay) => overlay.overlayRef === selectedOverlayRef) ?? traversalOverlays[0] ?? null;
  const selectedFunction = functionItems.find((item) => item.id === selectedFunctionId) ?? functionItems[0] ?? null;
  const selectedAsset = assetRelationships.find((asset) => asset.name === selectedAssetName) ?? assetRelationships[0] ?? null;
  const simpleMap = selectedOverlay && activeTab === 'graphs'
    ? buildSimpleOverlayGraph(selectedOverlay)
    : selectedFunction && catalog && activeTab === 'functions'
      ? buildSimpleFunctionGraph(selectedFunction, catalog)
      : selectedAsset && catalog && activeTab === 'assets'
        ? buildSimpleAssetGraph(selectedAsset, catalog)
        : null;
  const selectedRecordId = activeTab === 'graphs' && selectedOverlay
    ? processGraphRecordId('overlay-function', selectedOverlay.defaultStartTarget || selectedOverlay.graphFunctionRefs[0] || selectedOverlay.overlayRef)
    : activeTab === 'functions' && selectedFunction
      ? processGraphRecordId('function', selectedFunction.name)
      : activeTab === 'assets' && selectedAsset
        ? processGraphRecordId('asset', selectedAsset.name)
        : null;
  const graphTitle = activeTab === 'graphs'
    ? selectedOverlay?.name ?? 'Graph Overlays'
    : activeTab === 'functions'
      ? selectedFunction?.title ?? 'Graph Functions'
      : selectedAsset?.name ?? 'Leaf Assets';
  const graphSummary = activeTab === 'graphs'
    ? selectedOverlay?.intent ?? 'No graph overlay is selected.'
    : activeTab === 'functions'
      ? selectedFunction?.summary ?? 'No graph function is selected.'
      : selectedAsset
        ? `Produced by ${selectedAsset.producers.length} and consumed by ${selectedAsset.consumers.length}.`
        : 'No leaf asset is selected.';

  return (
    <div className="sidecar-process-simple" aria-label="Process Navigator">
      <div className="sidecar-process-navigator__header">
        <div>
          <span className="panel__eyebrow">Process Navigator</span>
          <h2>Supported process surfaces</h2>
        </div>
        <div className="sidecar-process-navigator__badges">
          <Pill kind="process">ts-v1</Pill>
          <Pill kind="default">{graphTabCount} overlays</Pill>
          <Pill kind="default">{catalog ? catalog.executives.length + catalog.library.length + catalog.leaves.length : 0} functions</Pill>
          <Pill kind="default">{assetRelationships.length} assets</Pill>
        </div>
      </div>

      <div className="sidecar-process-simple__tabs" role="tablist" aria-label="Process navigator sections">
        {([
          ['graphs', 'Graph Overlays', graphTabCount],
          ['functions', 'Graph Functions', catalog ? catalog.executives.length + catalog.library.length + catalog.leaves.length : 0],
          ['assets', 'Leaf Assets', assetRelationships.length],
        ] as const).map(([tab, label, count]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`process-tab sidecar-process-simple__tab${activeTab === tab ? ' is-selected' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <strong>{label}</strong>
            <span className="status-chip default">{count}</span>
          </button>
        ))}
      </div>

      <ProcessSimpleGraphPanel
        title={graphTitle}
        summary={graphSummary}
        map={simpleMap}
        selectedRecordId={selectedRecordId}
        onSelectRecord={(id) => {
          const parsed = parseProcessGraphRecordId(id);
          if (!parsed) return;
          if (parsed.kind === 'overlay') setSelectedOverlayRef(parsed.value);
          if (parsed.kind === 'function') setSelectedFunctionId(functionItems.find((item) => item.name === parsed.value)?.id ?? selectedFunctionId);
          if (parsed.kind === 'asset') setSelectedAssetName(parsed.value);
        }}
      />

      {activeTab === 'graphs' && (
        <section className="sidecar-process-simple__section" aria-label="Graph overlays">
          {traversalOverlays.length ? (
            <div className="sidecar-process-overlay-grid">
              {traversalOverlays.map((overlay) => (
                <ProcessOverlayCard
                  key={overlay.overlayRef}
                  overlay={overlay}
                  selected={selectedOverlay?.overlayRef === overlay.overlayRef}
                  onSelect={() => setSelectedOverlayRef(overlay.overlayRef)}
                />
              ))}
            </div>
          ) : (
            <div className="sidecar-inspector__empty">
              No TypeScript graph overlay catalog is projected for this workspace. Use N0 for the legacy process maps.
            </div>
          )}
        </section>
      )}

      {activeTab === 'functions' && (
        <section className="sidecar-process-simple__section" aria-label="Graph functions">
          {catalog ? (
            <div className="sidecar-process-function-groups">
              <ProcessFunctionGroup title="Executive Graph Functions" count={catalog.executives.length}>
                {functionItems.filter((item) => item.source === 'executive').map((item) => (
                  <ProcessFunctionCard
                    key={item.id}
                    item={item}
                    selected={selectedFunction?.id === item.id}
                    onSelect={() => setSelectedFunctionId(item.id)}
                  />
                ))}
              </ProcessFunctionGroup>
              <ProcessFunctionGroup title="Leaf Graph Functions" count={catalog.leaves.length}>
                {functionItems.filter((item) => item.source === 'leaf').map((item) => (
                  <ProcessFunctionCard
                    key={item.id}
                    item={item}
                    selected={selectedFunction?.id === item.id}
                    onSelect={() => setSelectedFunctionId(item.id)}
                  />
                ))}
              </ProcessFunctionGroup>
              <ProcessFunctionGroup title="Library Graph Functions" count={catalog.library.length}>
                {functionItems.filter((item) => item.source === 'library').map((item) => (
                  <ProcessFunctionCard
                    key={item.id}
                    item={item}
                    selected={selectedFunction?.id === item.id}
                    onSelect={() => setSelectedFunctionId(item.id)}
                  />
                ))}
              </ProcessFunctionGroup>
            </div>
          ) : (
            <div className="sidecar-inspector__empty">No graph-function catalog is projected for this workspace.</div>
          )}
        </section>
      )}

      {activeTab === 'assets' && (
        <section className="sidecar-process-simple__section" aria-label="Leaf node assets and relationships">
          {assetRelationships.length ? (
            <div className="sidecar-process-assets">
              {assetRelationships.map((asset) => (
                <ProcessAssetCard
                  key={asset.name}
                  asset={asset}
                  selected={selectedAsset?.name === asset.name}
                  onSelect={() => setSelectedAssetName(asset.name)}
                />
              ))}
            </div>
          ) : (
            <div className="sidecar-inspector__empty">No leaf asset relationships are projected for this workspace.</div>
          )}
        </section>
      )}
    </div>
  );
}

function ProcessSimpleGraphPanel({ title, summary, map, selectedRecordId, onSelectRecord }: {
  title: string;
  summary: string;
  map: SidecarProcessMap | null;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  const activeRecordIds = map ? processMapRecordIds(map) : [];
  return (
    <section className="sidecar-process-simple__graph sidecar-process-map" aria-label="Selected process graph">
      <div className="sidecar-process-simple__graph-header">
        <div>
          <span className="panel__eyebrow">Selected Graph</span>
          <h3>{title}</h3>
        </div>
        <p>{summary}</p>
      </div>
      {map ? (
        <ProcessGraphMap
          map={map}
          activeRecordIds={activeRecordIds}
          selectedRecordId={selectedRecordId}
          onSelectRecord={onSelectRecord}
        />
      ) : (
        <div className="sidecar-inspector__empty">Select a process object to render its graph.</div>
      )}
    </section>
  );
}

function ProcessOverlayCard({ overlay, selected = false, onSelect }: {
  overlay: NonNullable<SidecarProcessProjection['traversalOverlays']>[number];
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <article
      className={`sidecar-process-overlay-card${selected ? ' is-selected' : ''}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(event) => handleCardKeySelect(event, onSelect)}
    >
      <header>
        <div>
          <span className="panel__eyebrow">graph overlay</span>
          <strong>{overlay.name}</strong>
        </div>
        <div className="inline-pills">
          <span className="status-chip default">{overlay.graphFunctionRefs.length} fn</span>
          <span className="status-chip default">{overlay.graphVectorRefs.length} vec</span>
        </div>
      </header>
      <p>{overlay.intent}</p>
      <dl>
        <div>
          <dt>start</dt>
          <dd>{overlay.defaultStartTarget || formatProcessList(overlay.publicStartTargets)}</dd>
        </div>
        <div>
          <dt>terminal assets</dt>
          <dd>{formatProcessList(overlay.terminalAssetTypes)}</dd>
        </div>
        <div>
          <dt>predecessors</dt>
          <dd>{formatProcessList(overlay.predecessorOverlayRefs)}</dd>
        </div>
        <div>
          <dt>next</dt>
          <dd>{formatProcessList(overlay.nextEligibleOverlayRefs)}</dd>
        </div>
      </dl>
      <div className="sidecar-process-overlay-card__templates">
        {overlay.assetTemplates.length ? overlay.assetTemplates.map((template) => (
          <span key={template.templateRef || `${overlay.overlayRef}:${template.assetType}`} className="status-chip default">
            {template.assetType}
          </span>
        )) : (
          <span className="status-chip pending">no asset template</span>
        )}
      </div>
    </article>
  );
}

function ProcessFunctionGroup({ title, count, children }: PropsWithChildrenLike<{ title: string; count: number }>) {
  return (
    <section className="sidecar-process-function-group" aria-label={title}>
      <div className="requirements-explorer__section-heading">
        <span className="panel__eyebrow">{title}</span>
        <span className="status-chip default">{count}</span>
      </div>
      <div className="sidecar-process-function-group__list">{children}</div>
    </section>
  );
}

function ProcessFunctionCard({ item, selected = false, onSelect }: {
  item: ProcessSimpleFunctionItem;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <article
      className={`sidecar-process-function-card${selected ? ' is-selected' : ''}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(event) => handleCardKeySelect(event, onSelect)}
    >
      <header>
        <span className="panel__eyebrow">{item.eyebrow}</span>
        <strong>{item.title}</strong>
      </header>
      <p>{item.summary}</p>
      <dl>
        {item.meta.map(([label, value]) => (
          <div key={`${item.id}:${label}`}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function ProcessAssetCard({ asset, selected = false, onSelect }: {
  asset: ReturnType<typeof processAssetRelationships>[number];
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <article
      className={`sidecar-process-asset-card${selected ? ' is-selected' : ''}`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(event) => handleCardKeySelect(event, onSelect)}
    >
      <header>
        <span className="panel__eyebrow">asset</span>
        <strong>{asset.name}</strong>
      </header>
      <div className="sidecar-process-asset-card__relations">
        <ProcessRelationList label="Produced by" names={asset.producers} emptyLabel="No producer in catalog" />
        <ProcessRelationList label="Consumed by" names={asset.consumers} emptyLabel="No consumer in catalog" />
      </div>
    </article>
  );
}

function handleCardKeySelect(event: KeyboardEvent<HTMLElement>, onSelect?: () => void) {
  if (!onSelect) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  onSelect();
}

function ProcessRelationList({ label, names, emptyLabel }: {
  label: string;
  names: string[];
  emptyLabel: string;
}) {
  return (
    <div className="sidecar-process-relation-list">
      <span className="panel__eyebrow">{label}</span>
      <div className="inline-pills">
        {names.length ? names.map((name) => (
          <span key={`${label}:${name}`} className="status-chip default">{name}</span>
        )) : (
          <span className="status-chip pending">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function formatProcessList(values: string[], emptyLabel = '-') {
  return values.length ? values.join(', ') : emptyLabel;
}

function processFunctionItems(catalog: NonNullable<SidecarProcessProjection['catalog']>): ProcessSimpleFunctionItem[] {
  return [
    ...catalog.executives.map((fn): ProcessSimpleFunctionItem => ({
      id: processSimpleFunctionId('executive', fn.name),
      name: fn.name,
      eyebrow: 'executive',
      title: fn.name,
      summary: fn.intent,
      source: 'executive',
      executive: fn,
      meta: [
        ['steps', fn.steps.length ? fn.steps.join(' -> ') : '-'],
        ['outputs', fn.outputs.join(', ') || '-'],
      ],
    })),
    ...catalog.leaves.map((leaf): ProcessSimpleFunctionItem => ({
      id: processSimpleFunctionId('leaf', leaf.name),
      name: leaf.name,
      eyebrow: leaf.catalog,
      title: leaf.name,
      summary: leaf.intent,
      source: 'leaf',
      leaf,
      meta: [
        ['inputs', leaf.inputs.join(', ') || '-'],
        ['outputs', leaf.outputs.join(', ') || '-'],
        ['modulation', leaf.traversalModulationStrategy],
      ],
    })),
    ...catalog.library.map((fn): ProcessSimpleFunctionItem => ({
      id: processSimpleFunctionId('library', fn.name),
      name: fn.name,
      eyebrow: 'library',
      title: fn.name,
      summary: fn.intent,
      source: 'library',
      library: fn,
      meta: [
        ['contract', fn.stableOuterContract],
        ['compute', fn.computeOrder.join(' -> ') || '-'],
      ],
    })),
  ];
}

function processSimpleFunctionId(kind: ProcessSimpleFunctionItem['source'], name: string) {
  return `${kind}:${name}`;
}

function processAssetRelationships(catalog: NonNullable<SidecarProcessProjection['catalog']>) {
  const assets = new Map<string, { name: string; producers: Set<string>; consumers: Set<string> }>();
  const ensureAsset = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = assets.get(trimmed);
    if (existing) return existing;
    const next = { name: trimmed, producers: new Set<string>(), consumers: new Set<string>() };
    assets.set(trimmed, next);
    return next;
  };
  for (const leaf of catalog.leaves) {
    for (const input of leaf.inputs) ensureAsset(input)?.consumers.add(leaf.name);
    for (const output of leaf.outputs) ensureAsset(output)?.producers.add(leaf.name);
  }
  return Array.from(assets.values())
    .map((asset) => ({
      name: asset.name,
      producers: Array.from(asset.producers).sort((a, b) => a.localeCompare(b)),
      consumers: Array.from(asset.consumers).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildSimpleOverlayGraph(overlay: NonNullable<SidecarProcessProjection['traversalOverlays']>[number]): SidecarProcessMap {
  const rowByColumn = new Map<number, number>();
  const nodes = overlay.graphFunctionRefs.map((ref, index): SidecarProcessMap['nodes'][number] => {
    const stage = processFunctionStage(ref);
    const row = rowByColumn.get(stage.column) ?? 0;
    rowByColumn.set(stage.column, row + 1);
    return {
      id: processGraphNodeId('overlay-function', ref, index),
      label: ref,
      summary: `${overlay.name}: ${ref}`,
      kind: overlay.defaultStartTarget === ref ? 'start_target' : 'graph_function',
      tone: overlay.terminalGraphFunctionRefs.includes(ref) ? 'converged' : overlay.defaultStartTarget === ref ? 'pending' : 'active',
      lane: stage.label,
      column: stage.column,
      row,
      recordIds: [
        processGraphRecordId('overlay-function', ref),
        processGraphRecordId('function', ref),
      ],
    };
  });
  const nodeByRef = new Map(overlay.graphFunctionRefs.map((ref, index) => [ref, nodes[index]]));
  const edges: SidecarProcessMap['edges'] = [];
  overlay.graphFunctionRefs.slice(0, -1).forEach((fromRef, index) => {
    const toRef = overlay.graphFunctionRefs[index + 1];
    const from = nodeByRef.get(fromRef);
    const to = nodeByRef.get(toRef);
    if (!from || !to) return;
    edges.push({
      id: `edge:${from.id}:${to.id}`,
      from: from.id,
      to: to.id,
      label: overlay.graphVectorRefs[index] ?? 'graph vector',
      tone: 'active',
      recordIds: [processGraphRecordId('overlay', overlay.overlayRef)],
    });
  });
  return {
    id: 'process_flow',
    label: overlay.name,
    summary: overlay.intent,
    nodes,
    edges,
    stats: [
      { label: 'functions', value: String(overlay.graphFunctionRefs.length), tone: 'active' },
      { label: 'vectors', value: String(overlay.graphVectorRefs.length), tone: 'pending' },
      { label: 'terminal assets', value: String(overlay.terminalAssetTypes.length), tone: 'converged' },
    ],
  };
}

function buildSimpleFunctionGraph(
  item: ProcessSimpleFunctionItem,
  catalog: NonNullable<SidecarProcessProjection['catalog']>,
): SidecarProcessMap {
  if (item.executive) {
    return buildSimpleExecutiveGraph(item, item.executive);
  }
  if (item.library) {
    return buildSimpleLibraryGraph(item, item.library);
  }
  const leaf = item.leaf;
  if (!leaf) return emptySimpleProcessMap(item.title, item.summary);
  const nodes: SidecarProcessMap['nodes'] = [];
  const edges: SidecarProcessMap['edges'] = [];
  const selectedNodeId = processGraphNodeId('function', leaf.name);
  const producersByAsset = new Map<string, string[]>();
  const consumersByAsset = new Map<string, string[]>();
  for (const candidate of catalog.leaves) {
    for (const output of candidate.outputs) {
      if (!producersByAsset.has(output)) producersByAsset.set(output, []);
      producersByAsset.get(output)!.push(candidate.name);
    }
    for (const input of candidate.inputs) {
      if (!consumersByAsset.has(input)) consumersByAsset.set(input, []);
      consumersByAsset.get(input)!.push(candidate.name);
    }
  }
  nodes.push(processGraphNode({
    id: selectedNodeId,
    label: leaf.name,
    summary: leaf.intent,
    kind: 'graph_function',
    tone: 'active',
    lane: processFunctionStage(leaf.name).label,
    column: 2,
    row: Math.max(0, Math.floor(Math.max(leaf.inputs.length, leaf.outputs.length) / 2)),
    recordIds: [processGraphRecordId('function', leaf.name)],
  }));
  leaf.inputs.forEach((asset, row) => {
    const assetNodeId = processGraphNodeId('asset', asset, row);
    nodes.push(processGraphNode({
      id: assetNodeId,
      label: asset,
      summary: `Input asset for ${leaf.name}`,
      kind: 'asset',
      tone: 'pending',
      lane: 'INPUT',
      column: 1,
      row,
      recordIds: [processGraphRecordId('asset', asset)],
    }));
    edges.push(processGraphEdge(assetNodeId, selectedNodeId, 'input', processGraphRecordId('asset', asset)));
    const producer = (producersByAsset.get(asset) ?? []).find((name) => name !== leaf.name);
    if (producer) {
      const producerNodeId = processGraphNodeId('function', producer, row);
      nodes.push(processGraphNode({
        id: producerNodeId,
        label: producer,
        summary: `Produces ${asset}`,
        kind: 'graph_function',
        tone: 'converged',
        lane: processFunctionStage(producer).label,
        column: 0,
        row,
        recordIds: [processGraphRecordId('function', producer)],
      }));
      edges.push(processGraphEdge(producerNodeId, assetNodeId, 'produces', processGraphRecordId('function', producer)));
    }
  });
  leaf.outputs.forEach((asset, row) => {
    const assetNodeId = processGraphNodeId('asset', asset, row + leaf.inputs.length);
    nodes.push(processGraphNode({
      id: assetNodeId,
      label: asset,
      summary: `Output asset for ${leaf.name}`,
      kind: 'asset',
      tone: 'converged',
      lane: 'OUTPUT',
      column: 3,
      row,
      recordIds: [processGraphRecordId('asset', asset)],
    }));
    edges.push(processGraphEdge(selectedNodeId, assetNodeId, 'output', processGraphRecordId('asset', asset)));
    const consumer = (consumersByAsset.get(asset) ?? []).find((name) => name !== leaf.name);
    if (consumer) {
      const consumerNodeId = processGraphNodeId('function', consumer, row);
      nodes.push(processGraphNode({
        id: consumerNodeId,
        label: consumer,
        summary: `Consumes ${asset}`,
        kind: 'graph_function',
        tone: 'active',
        lane: processFunctionStage(consumer).label,
        column: 4,
        row,
        recordIds: [processGraphRecordId('function', consumer)],
      }));
      edges.push(processGraphEdge(assetNodeId, consumerNodeId, 'consumed by', processGraphRecordId('function', consumer)));
    }
  });
  return {
    id: 'process_flow',
    label: item.title,
    summary: item.summary,
    nodes: dedupeProcessGraphNodes(nodes),
    edges: dedupeProcessGraphEdges(edges),
    stats: [
      { label: 'inputs', value: String(leaf.inputs.length), tone: 'pending' },
      { label: 'outputs', value: String(leaf.outputs.length), tone: 'converged' },
      { label: 'requirements', value: String(leaf.requirementRefs.length), tone: 'active' },
    ],
  };
}

function buildSimpleExecutiveGraph(item: ProcessSimpleFunctionItem, fn: NonNullable<ProcessSimpleFunctionItem['executive']>): SidecarProcessMap {
  const nodes: SidecarProcessMap['nodes'] = [
    processGraphNode({
      id: processGraphNodeId('function', fn.name),
      label: fn.name,
      summary: fn.intent,
      kind: 'start_target',
      tone: 'active',
      lane: 'EXECUTIVE',
      column: 0,
      row: 0,
      recordIds: [processGraphRecordId('function', fn.name)],
    }),
  ];
  const edges: SidecarProcessMap['edges'] = [];
  fn.steps.forEach((step, index) => {
    const nodeId = processGraphNodeId('function', step, index);
    nodes.push(processGraphNode({
      id: nodeId,
      label: step,
      summary: `${fn.name} step ${index + 1}`,
      kind: 'graph_function',
      tone: 'pending',
      lane: processFunctionStage(step).label,
      column: index + 1,
      row: 0,
      recordIds: [processGraphRecordId('function', step)],
    }));
    const previous = index === 0 ? processGraphNodeId('function', fn.name) : processGraphNodeId('function', fn.steps[index - 1], index - 1);
    edges.push(processGraphEdge(previous, nodeId, 'step', processGraphRecordId('function', step)));
  });
  return {
    id: 'process_flow',
    label: item.title,
    summary: item.summary,
    nodes,
    edges,
    stats: [
      { label: 'steps', value: String(fn.steps.length), tone: 'active' },
      { label: 'outputs', value: String(fn.outputs.length), tone: 'converged' },
    ],
  };
}

function buildSimpleLibraryGraph(item: ProcessSimpleFunctionItem, fn: NonNullable<ProcessSimpleFunctionItem['library']>): SidecarProcessMap {
  const nodes: SidecarProcessMap['nodes'] = [];
  const edges: SidecarProcessMap['edges'] = [];
  fn.computeOrder.forEach((step, index) => {
    const nodeId = processGraphNodeId('function', step, index);
    nodes.push(processGraphNode({
      id: nodeId,
      label: step,
      summary: `${fn.name} compute order ${index + 1}`,
      kind: 'graph_function',
      tone: 'pending',
      lane: processFunctionStage(step).label,
      column: index,
      row: 0,
      recordIds: [processGraphRecordId('function', step)],
    }));
    if (index > 0) {
      edges.push(processGraphEdge(processGraphNodeId('function', fn.computeOrder[index - 1], index - 1), nodeId, 'compute', processGraphRecordId('function', step)));
    }
  });
  const libraryNodeId = processGraphNodeId('function', fn.name);
  nodes.push(processGraphNode({
    id: libraryNodeId,
    label: fn.name,
    summary: fn.intent,
    kind: 'graph_function',
    tone: 'active',
    lane: 'LIBRARY',
    column: fn.computeOrder.length,
    row: 0,
    recordIds: [processGraphRecordId('function', fn.name)],
  }));
  if (fn.computeOrder.length > 0) {
    edges.push(processGraphEdge(processGraphNodeId('function', fn.computeOrder.at(-1)!, fn.computeOrder.length - 1), libraryNodeId, 'realizes', processGraphRecordId('function', fn.name)));
  }
  return {
    id: 'process_flow',
    label: item.title,
    summary: item.summary,
    nodes,
    edges,
    stats: [
      { label: 'compute', value: String(fn.computeOrder.length), tone: 'active' },
      { label: 'domain truth', value: String(fn.sdlcOwnedDomainTruth.length), tone: 'converged' },
    ],
  };
}

function buildSimpleAssetGraph(
  asset: ReturnType<typeof processAssetRelationships>[number],
  catalog: NonNullable<SidecarProcessProjection['catalog']>,
): SidecarProcessMap {
  const nodes: SidecarProcessMap['nodes'] = [
    processGraphNode({
      id: processGraphNodeId('asset', asset.name),
      label: asset.name,
      summary: 'Leaf asset relationship focus.',
      kind: 'asset',
      tone: 'active',
      lane: 'ASSET',
      column: 1,
      row: Math.max(0, Math.floor(Math.max(asset.producers.length, asset.consumers.length) / 2)),
      recordIds: [processGraphRecordId('asset', asset.name)],
    }),
  ];
  const edges: SidecarProcessMap['edges'] = [];
  asset.producers.forEach((producer, row) => {
    const leaf = catalog.leaves.find((candidate) => candidate.name === producer);
    const nodeId = processGraphNodeId('function', producer, row);
    nodes.push(processGraphNode({
      id: nodeId,
      label: producer,
      summary: leaf?.intent ?? `Produces ${asset.name}`,
      kind: 'graph_function',
      tone: 'converged',
      lane: processFunctionStage(producer).label,
      column: 0,
      row,
      recordIds: [processGraphRecordId('function', producer)],
    }));
    edges.push(processGraphEdge(nodeId, processGraphNodeId('asset', asset.name), 'produces', processGraphRecordId('function', producer)));
  });
  asset.consumers.forEach((consumer, row) => {
    const leaf = catalog.leaves.find((candidate) => candidate.name === consumer);
    const nodeId = processGraphNodeId('function', consumer, row);
    nodes.push(processGraphNode({
      id: nodeId,
      label: consumer,
      summary: leaf?.intent ?? `Consumes ${asset.name}`,
      kind: 'graph_function',
      tone: 'pending',
      lane: processFunctionStage(consumer).label,
      column: 2,
      row,
      recordIds: [processGraphRecordId('function', consumer)],
    }));
    edges.push(processGraphEdge(processGraphNodeId('asset', asset.name), nodeId, 'consumes', processGraphRecordId('function', consumer)));
  });
  return {
    id: 'process_flow',
    label: asset.name,
    summary: `Produced by ${asset.producers.length} function(s); consumed by ${asset.consumers.length} function(s).`,
    nodes: dedupeProcessGraphNodes(nodes),
    edges: dedupeProcessGraphEdges(edges),
    stats: [
      { label: 'producers', value: String(asset.producers.length), tone: 'converged' },
      { label: 'consumers', value: String(asset.consumers.length), tone: 'pending' },
    ],
  };
}

function emptySimpleProcessMap(label: string, summary: string): SidecarProcessMap {
  return {
    id: 'process_flow',
    label,
    summary,
    nodes: [],
    edges: [],
    stats: [],
  };
}

function processGraphNode(input: SidecarProcessMap['nodes'][number]): SidecarProcessMap['nodes'][number] {
  return input;
}

function processGraphEdge(from: string, to: string, label: string, recordId: string): SidecarProcessMap['edges'][number] {
  return {
    id: `edge:${from}:${to}:${label}`,
    from,
    to,
    label,
    tone: 'active',
    recordIds: [recordId],
  };
}

function dedupeProcessGraphNodes(nodes: SidecarProcessMap['nodes']): SidecarProcessMap['nodes'] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function dedupeProcessGraphEdges(edges: SidecarProcessMap['edges']): SidecarProcessMap['edges'] {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    if (seen.has(edge.id)) return false;
    seen.add(edge.id);
    return true;
  });
}

function processMapRecordIds(map: SidecarProcessMap) {
  return Array.from(new Set([
    ...map.nodes.flatMap((node) => node.recordIds),
    ...map.edges.flatMap((edge) => edge.recordIds),
  ]));
}

function processGraphNodeId(kind: string, value: string, index?: number) {
  return `${kind}:${index ?? 'main'}:${safeProcessGraphId(value)}`;
}

function processGraphRecordId(kind: string, value: string) {
  return `${kind}:${value}`;
}

function parseProcessGraphRecordId(id: string) {
  const separator = id.indexOf(':');
  if (separator < 0) return null;
  return {
    kind: id.slice(0, separator),
    value: id.slice(separator + 1),
  };
}

function safeProcessGraphId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'node';
}

function processFunctionStage(name: string): { column: number; label: string } {
  const lower = name.toLowerCase();
  if (/(ingress|conform|obligation|carry|gap|governance)/.test(lower)) return { column: 6, label: 'GOVERNANCE LOOP' };
  if (/(runtime|operational|retrofit)/.test(lower)) return { column: 5, label: 'RUNTIME' };
  if (/(release|deploy|deployment)/.test(lower)) return { column: 4, label: 'RELEASE / OPS' };
  if (/(test|uat|qualify|testcase)/.test(lower)) return { column: 3, label: 'TEST' };
  if (/(materialize|module|component|code|build|adr)/.test(lower)) return { column: 2, label: 'BUILD' };
  if (/(design|scenario|feature|solution|architecture|implementation)/.test(lower)) return { column: 1, label: 'DESIGN' };
  if (/(bootstrap|intent|product|goal|requirement|ambiguity|capability)/.test(lower)) return { column: 0, label: 'BOOTSTRAP' };
  return { column: 2, label: 'BUILD' };
}

function ProcessNavigatorPanel({ state, dispatch }: {
  state: SidecarState;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const projection = state.process;
  const [search, setSearch] = useState('');
  if (!projection) {
    return <div className="sidecar-inspector__empty">Process projection is not loaded.</div>;
  }
  if (!projection.supported) {
    return (
      <div className="sidecar-process-navigator sidecar-process-navigator--unsupported">
        <div className="sidecar-process-navigator__header">
          <span className="panel__eyebrow">Process Navigator</span>
          <h2>TypeScript process contract unavailable</h2>
          <Pill kind="blocked">unsupported</Pill>
        </div>
        <p>{projection.unsupportedReason ?? 'This Project does not expose the odd_sdlc TypeScript process contract.'}</p>
        <MetaGrid items={[
          ['Required contract', `${projection.contractName} ${projection.contractVersion}`],
          ['Project', projection.workspaceRoot || state.context?.project.root || '—'],
          ['Generic workspace', 'Browse, pinned folders, recent paths, and shells remain available.'],
        ]} />
      </div>
    );
  }

  const activeView = projection.views.find((view) => view.id === state.ui.activeProcessView) ?? projection.views[0] ?? null;
  const viewRecords = activeView
    ? projection.records.filter((record) => activeView.recordIds.includes(record.id))
    : projection.records;
  const normalizedSearch = search.trim().toLowerCase();
  const records = normalizedSearch
    ? viewRecords.filter((record) => processRecordMatchesSearch(record, normalizedSearch))
    : viewRecords;
  const selectedRecord = records.find((record) => record.id === state.ui.activeProcessRecordId)
    ?? records[0]
    ?? null;
  const activeMap = projection.maps.find((map) => map.id === state.ui.activeProcessMap)
    ?? projection.maps[0]
    ?? null;
  const activeRecordIds = records.map((record) => record.id);
  const openTracePath = (absolutePath: string) => {
    const relativePath = relativeProjectPath(state.context?.project.root ?? projection.workspaceRoot, absolutePath);
    if (!relativePath) {
      dispatch({ type: 'action/result', ok: false, error: 'Trace archive is outside the active Project.' });
      return;
    }
    dispatch({ type: 'viewer/open', kind: 'surface', id: relativePath });
  };

  return (
    <div className="sidecar-process-navigator" aria-label="Sidecar Process Navigator">
      <div className="sidecar-process-navigator__header">
        <div>
          <span className="panel__eyebrow">Process Navigator</span>
          <h2>TypeScript graph maps</h2>
        </div>
        <div className="sidecar-process-navigator__badges">
          <Pill kind="process">ts-v1</Pill>
          <Pill kind="default">{projection.eventCount} events</Pill>
          <Pill kind="default">{records.length} of {projection.records.length}</Pill>
          <Pill kind="default">{projection.maps.length} maps</Pill>
          {projection.catalog && (
            <span aria-label={`${projection.catalog.executives.length} executives, ${projection.catalog.library.length} library functions`}>
              <Pill kind="default">{projection.catalog.leaves.length} leaves</Pill>
            </span>
          )}
          {projection.leafOverlays && projection.leafOverlays.length > 0 && (
            <span aria-label={`${projection.leafOverlays.reduce((n, ov) => n + ov.tracedEvidence.length, 0)} traced invocations`}>
              <Pill kind="active">{projection.leafOverlays.length} active overlays</Pill>
            </span>
          )}
        </div>
      </div>

      <div className="sidecar-process-map-stack">
        <div className="sidecar-process-maps process-tab-grid" role="tablist" aria-label="Process maps">
          {projection.maps.map((map) => {
            const selected = activeMap?.id === map.id;
            return (
              <button
                key={map.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="sidecar-process-map"
                className={`sidecar-process-map-tab process-tab${selected ? ' is-selected' : ''}`}
                onClick={() => dispatch({ type: 'process/select-map', map: map.id })}
              >
                <div className="process-tab__meta">
                  <strong>{map.label}</strong>
                  <span className={`status-chip ${selected ? 'active' : 'default'}`}>{map.nodes.length}</span>
                </div>
                <p>{map.summary}</p>
              </button>
            );
          })}
        </div>

        <section className="sidecar-process-map process-map-host" id="sidecar-process-map" aria-label={activeMap?.label ?? 'Process graph'}>
          {activeMap ? (
            activeMap.id === 'process_flow' && projection.catalog ? (
              <ProcessFlowMapVariantHost
                map={activeMap}
                catalog={projection.catalog}
                overlays={projection.leafOverlays ?? []}
                activeRecordIds={activeRecordIds}
                selectedRecordId={selectedRecord?.id ?? null}
                activeVariant={state.ui.activeProcessFlowVariant}
                activeLeafName={state.ui.activeLeafName}
                onSelectVariant={(variant) => dispatch({ type: 'process/select-variant', variant })}
                onSelectRecord={(id) => dispatch({ type: 'process/select-record', id })}
                onSelectLeaf={(leafName) => dispatch({ type: 'process/select-leaf', leafName })}
                onOpenTracePath={openTracePath}
              />
            ) : (
              <ProcessGraphMap
                map={activeMap}
                activeRecordIds={activeRecordIds}
                selectedRecordId={selectedRecord?.id ?? null}
                onSelectRecord={(id) => dispatch({ type: 'process/select-record', id })}
                onOpenTracePath={openTracePath}
              />
            )
          ) : (
            <div className="sidecar-inspector__empty">No TypeScript process map is projected.</div>
          )}
        </section>
      </div>

      <div className="sidecar-process-navigator__views">
        <div className="requirements-explorer__section-heading">
          <span className="panel__eyebrow">Saved Views</span>
        </div>
        <div className="sidecar-process-views process-tab-grid" role="tablist" aria-label="Process views">
          {projection.views.map((view) => {
            const selected = activeView?.id === view.id;
            return (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="sidecar-process-map"
                className={`sidecar-process-view process-tab${selected ? ' is-selected' : ''}`}
                onClick={() => dispatch({ type: 'process/select-view', view: view.id })}
              >
                <div className="process-tab__meta">
                  <strong>{view.label}</strong>
                  <span className={`status-chip ${selected ? 'active' : 'default'}`}>{view.recordIds.length}</span>
                </div>
                <p>{view.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sidecar-process-query process-explorer__query" aria-live="polite">
        <div className="process-explorer__query-heading">
          <span className="panel__eyebrow">Active Query</span>
          <span className={`status-chip ${activeView ? 'active' : 'pending'}`}>{activeView?.label ?? 'Process'}</span>
        </div>
        <strong>{describeProcessQueryHeadline(records.length, viewRecords.length)}</strong>
        <p>{describeProcessQuerySummary(activeMap, selectedRecord, normalizedSearch)}</p>
        <div className="inline-pills">
          {normalizedSearch ? <Pill kind="attention">Search: {search.trim()}</Pill> : null}
          {selectedRecord ? <Pill kind={selectedRecord.tone}>Focused: {selectedRecord.title}</Pill> : null}
        </div>
      </div>

      <div className="sidecar-process-layout sidecar-process-layout--graph process-page__lens">
        <section className="sidecar-process-records process-page__explorer" aria-label="Process Explorer">
          <div className="process-explorer__controls">
            <div className="requirements-explorer__section-heading">
              <span className="panel__eyebrow">Process Explorer</span>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search TypeScript process objects"
              aria-label="Search process objects"
            />
          </div>
          <div className="process-explorer__list">
            <div className="list-stack">
              {records.length ? records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  className={`sidecar-process-record list-row${selectedRecord?.id === record.id ? ' is-selected' : ''}`}
                  onClick={() => dispatch({ type: 'process/select-record', id: record.id })}
                >
                  <div className="list-row__meta">
                    <span className="panel__eyebrow">{record.kind}</span>
                    <span className={`status-chip ${record.tone}`}>{record.status}</span>
                  </div>
                  <strong className="list-row__title">{record.title}</strong>
                  <p className="list-row__summary">{record.summary}</p>
                </button>
              )) : (
                <div className="empty-state">
                  <strong>No process records match the current query.</strong>
                  <p>Clear the search to restore the active process lane.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="sidecar-process-detail process-page__workbench" aria-label="Selected process record">
          <ProcessMapSummary map={activeMap} activeViewLabel={activeView?.label ?? 'Process'} visibleRecordCount={records.length} />
          {selectedRecord ? <ProcessRecordDetail record={selectedRecord} projection={projection} /> : (
            <div className="sidecar-inspector__empty">No process record selected.</div>
          )}
        </section>
      </div>

      {projection.catalog && (
        <ProcessCatalogPicker
          catalog={projection.catalog}
          overlays={projection.leafOverlays ?? []}
          activeLeafName={state.ui.activeLeafName}
          onSelectLeaf={(leafName) => dispatch({ type: 'process/select-leaf', leafName })}
        />
      )}

      {projection.catalog && state.ui.activeLeafName && (
        <LeafWorkbenchPanel
          catalog={projection.catalog}
          overlays={projection.leafOverlays ?? []}
          activeLeafName={state.ui.activeLeafName}
          onClose={() => dispatch({ type: 'process/select-leaf', leafName: null })}
          onOpenTracePath={openTracePath}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// T-026: catalog picker. Shows executives + leaves grouped by catalog
// (bootstrap / operational / triage) + library functions. Clicking a leaf
// focuses it for the workbench. Read-only over admitted projection.
// ---------------------------------------------------------------------------

function ProcessCatalogPicker({
  catalog,
  overlays,
  activeLeafName,
  onSelectLeaf,
}: {
  catalog: NonNullable<SidecarProcessProjection['catalog']>;
  overlays: NonNullable<SidecarProcessProjection['leafOverlays']>;
  activeLeafName: string | null;
  onSelectLeaf: (leafName: string) => void;
}) {
  const leavesByCatalog = {
    bootstrap: catalog.leaves.filter((l) => l.catalog === 'bootstrap'),
    operational: catalog.leaves.filter((l) => l.catalog === 'operational'),
    triage: catalog.leaves.filter((l) => l.catalog === 'triage'),
  };
  const overlayByLeaf = new Map(overlays.map((ov) => [ov.leafName, ov]));

  return (
    <section className="sidecar-process-catalog" aria-label="Published TS module catalog">
      <div className="requirements-explorer__section-heading">
        <span className="panel__eyebrow">Catalog</span>
        <span className="status-chip default">{catalog.leaves.length} leaves · {catalog.executives.length} executives · {catalog.library.length} library</span>
      </div>
      {(['bootstrap', 'operational', 'triage'] as const).map((catalogId) => {
        const leaves = leavesByCatalog[catalogId];
        if (leaves.length === 0) return null;
        return (
          <details key={catalogId} className="sidecar-process-catalog__group" open={catalogId !== 'triage'}>
            <summary>
              <strong>{catalogId === 'bootstrap' ? 'Bootstrap → Release' : catalogId === 'operational' ? 'Operational Cycle' : 'Triage Lane'}</strong>
              <span className="status-chip default">{leaves.length}</span>
            </summary>
            <ul className="sidecar-process-catalog__leaves">
              {leaves.map((leaf) => {
                const overlay = overlayByLeaf.get(leaf.name);
                const selected = leaf.name === activeLeafName;
                return (
                  <li key={leaf.name}>
                    <button
                      type="button"
                      className={`sidecar-process-catalog__leaf list-row${selected ? ' is-selected' : ''}`}
                      onClick={() => onSelectLeaf(leaf.name)}
                      aria-pressed={selected}
                    >
                      <div className="sidecar-process-catalog__leaf-meta">
                        <strong>{leaf.name}</strong>
                        <span className="status-chip default">{overlay?.latestStatus ?? 'unattested'}</span>
                      </div>
                      <p>{leaf.intent}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------------------
// T-022 + T-026: per-leaf workbench. Shows leaf metadata, overlay status,
// 7-dim assurance vector, and traced call-out evidence per supervised actor
// invocation. All data flows from admitted carriers; nothing reads disk.
// ---------------------------------------------------------------------------

function LeafWorkbenchPanel({
  catalog,
  overlays,
  activeLeafName,
  onClose,
  onOpenTracePath,
}: {
  catalog: NonNullable<SidecarProcessProjection['catalog']>;
  overlays: NonNullable<SidecarProcessProjection['leafOverlays']>;
  activeLeafName: string;
  onClose: () => void;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const leaf = catalog.leaves.find((l) => l.name === activeLeafName) ?? null;
  const overlay = overlays.find((ov) => ov.leafName === activeLeafName) ?? null;

  if (!leaf) {
    return (
      <section className="sidecar-leaf-workbench" aria-label="Leaf workbench">
        <header>
          <span className="panel__eyebrow">Leaf Workbench</span>
          <button type="button" className="sidecar-leaf-workbench__close" onClick={onClose}>×</button>
        </header>
        <p>Leaf <code>{activeLeafName}</code> is not present in the published catalog.</p>
      </section>
    );
  }

  return (
    <section className="sidecar-leaf-workbench" aria-label={`Leaf workbench: ${leaf.name}`}>
      <header className="sidecar-leaf-workbench__header">
        <div>
          <span className="panel__eyebrow">{leaf.catalog}</span>
          <h3>{leaf.name}</h3>
          <p>{leaf.intent}</p>
        </div>
        <button type="button" className="sidecar-leaf-workbench__close" onClick={onClose} aria-label="Close leaf workbench">×</button>
      </header>

      <MetaGrid items={[
        ['Inputs', leaf.inputs.join(', ') || '—'],
        ['Outputs', leaf.outputs.join(', ') || '—'],
        ['Transform contract', leaf.transformContractRef],
        ['Evaluation contract', leaf.evaluationContractRef],
        ['Modulation', leaf.traversalModulationStrategy],
        ['Operator', `${leaf.operator.name} (${leaf.operator.regime})`],
        ['Evaluators', leaf.evaluators.map((e) => `${e.name} (${e.regime})`).join(', ')],
        ['Requirement refs', leaf.requirementRefs.join(', ') || '—'],
        ['Proof obligations', leaf.proofObligations.join(', ') || '—'],
      ]} />

      {overlay ? (
        <>
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Op-run Overlay</span>
            <span className="status-chip default">{overlay.latestStatus}</span>
            <span className="status-chip default">{overlay.invocationCount} invocations</span>
          </div>
          {overlay.assuranceVector && (
            <AssuranceVectorGrid vector={overlay.assuranceVector} />
          )}
          {overlay.edgeAssurance && (
            <EdgeAssurancePanel assurance={overlay.edgeAssurance} onOpenTracePath={onOpenTracePath} />
          )}
          {overlay.tracedEvidence.length > 0 ? (
            <ul className="sidecar-leaf-workbench__evidence">
              {overlay.tracedEvidence.map((evidence) => (
                <li key={evidence.invocationId} className="sidecar-leaf-workbench__evidence-row">
                  <div className="sidecar-leaf-workbench__evidence-head">
                    <Pill kind={evidence.outcome.kind === 'exited' && evidence.status === 0 ? 'process' : 'blocked'}>
                      {evidence.outcome.kind}
                    </Pill>
                    <span className="status-chip default">{evidence.executorProfile}</span>
                    <span className="status-chip default">{evidence.parser}</span>
                    {evidence.status !== null && (
                      <span className="status-chip default">status {evidence.status}</span>
                    )}
                    <button
                      type="button"
                      className="status-chip active"
                      onClick={() => onOpenTracePath(evidence.traceArchiveRoot)}
                    >
                      Trace archive
                    </button>
                    <button
                      type="button"
                      className="status-chip default"
                      onClick={() => onOpenTracePath(evidence.traceArchivePaths.result)}
                    >
                      Result
                    </button>
                    {evidence.traceArchivePaths.terminalTranscript && (
                      <button
                        type="button"
                        className="status-chip default"
                        onClick={() => onOpenTracePath(evidence.traceArchivePaths.terminalTranscript as string)}
                      >
                        Terminal transcript
                      </button>
                    )}
                  </div>
                  <MetaGrid items={[
                    ['Invocation', evidence.invocationId],
                    ['Stream model', evidence.streamModel],
                    ['Structured events', String(evidence.structuredEventCount)],
                    ['API retries', String(evidence.apiRetryCount)],
                    ['Tool calls', String(evidence.toolCallCount)],
                    ['Terminal session', evidence.terminalSessionId ?? '—'],
                    ['Trace archive', evidence.traceArchiveRoot],
                    ['Result', evidence.traceArchivePaths.result],
                  ]} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="sidecar-inspector__empty">No traced evidence admitted yet for this leaf.</div>
          )}
        </>
      ) : (
        <div className="sidecar-inspector__empty">No active op-run overlay carries an invocation of this leaf yet.</div>
      )}
    </section>
  );
}

function AssuranceVectorGrid({ vector }: {
  vector: NonNullable<NonNullable<SidecarProcessProjection['leafOverlays']>[number]['assuranceVector']>;
}) {
  const cells: Array<[string, 'pass' | 'fail' | 'pending']> = [
    ['materialization', vector.materialization],
    ['semantic', vector.semanticConvergence],
    ['obligation', vector.obligationCarry],
    ['requirement', vector.requirementFulfillment],
    ['ambiguity', vector.ambiguity],
    ['capability', vector.capability],
    ['shallow', vector.shallowRealization],
  ];
  return (
    <div className="sidecar-leaf-workbench__assurance" role="group" aria-label="7-dim assurance vector">
      {cells.map(([label, state]) => (
        <span key={label} className={`status-chip ${state === 'pass' ? 'active' : state === 'fail' ? 'blocked' : 'pending'}`}>
          {label}: {state}
        </span>
      ))}
    </div>
  );
}

function EdgeAssurancePanel({
  assurance,
  onOpenTracePath,
}: {
  assurance: NonNullable<NonNullable<SidecarProcessProjection['leafOverlays']>[number]['edgeAssurance']>;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const counts = assurance.counts;
  const countText = counts
    ? `${counts.fulfilled}/${counts.expected} fulfilled; ${counts.blocked + counts.unfulfilled + counts.missing} open`
    : '—';
  return (
    <section className="sidecar-edge-assurance" aria-label="Edge assurance">
      <div className="requirements-explorer__section-heading">
        <span className="panel__eyebrow">Edge Assurance</span>
        <span className={`status-chip ${assuranceCarrierKind(assurance.carrierState)}`}>{assurance.carrierState}</span>
        <span className={`status-chip ${closureDispositionKind(assurance.closureDisposition, assurance.closeReady)}`}>
          {assurance.closureDisposition ?? 'no closure'}
        </span>
        {assurance.closeReady && <span className="status-chip active">close ready</span>}
      </div>
      <MetaGrid items={[
        ['Edge', assurance.edgeName],
        ['Target', assurance.targetAssetType ?? '—'],
        ['Vector', assurance.vectorIndex === null ? '—' : String(assurance.vectorIndex)],
        ['Counts', countText],
        ['Edge converged', assurance.edgeConverged === null ? '—' : assurance.edgeConverged ? 'yes' : 'no'],
        ['Target certified', assurance.targetCertificationPassed === null ? '—' : assurance.targetCertificationPassed ? 'yes' : 'no'],
        ['Contract', assurance.edgeAssuranceContractRef ?? '—'],
        ['Gain', assurance.edgeGainRef ?? '—'],
        ['Closure function', assurance.edgeClosureFunctionRef ?? '—'],
        ['Next vector', assurance.nextGraphVectorRef ?? '—'],
      ]} />
      <div className="sidecar-edge-assurance__refs">
        {assurance.ledgerRef && (
          <button type="button" className="status-chip default" onClick={() => onOpenTracePath(`${assurance.opRunRoot}/sdlc_edge_fulfillment_ledger.json`)}>
            Ledger
          </button>
        )}
        {assurance.closureDecisionRef && (
          <button type="button" className="status-chip default" onClick={() => onOpenTracePath(`${assurance.opRunRoot}/sdlc_edge_closure_decision.json`)}>
            Closure
          </button>
        )}
        {assurance.selectedActionRef && (
          <button type="button" className="status-chip default" onClick={() => onOpenTracePath(`${assurance.opRunRoot}/sdlc_next_action_projection.json`)}>
            Next action
          </button>
        )}
      </div>
      {assurance.edgeResidualPressureRefs.length > 0 && (
        <Section title="Residual pressure">
          <ul className="sidecar-criteria-list">
            {assurance.edgeResidualPressureRefs.slice(0, 6).map((ref) => <li key={ref}>{ref}</li>)}
          </ul>
        </Section>
      )}
      {assurance.diagnostics.length > 0 && (
        <Section title="Diagnostics">
          <div className="inline-pills">
            {assurance.diagnostics.map((diagnostic) => (
              <Pill key={diagnostic} kind={diagnostic.includes('missing') || diagnostic.includes('without') ? 'blocked' : 'default'}>
                {diagnostic}
              </Pill>
            ))}
          </div>
        </Section>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// T-026: process-flow-map variant host. V0 is canonical (the existing
// ProcessGraphMap rendering). V1 / V2 / V4 ship under §13A scaffold-exemption
// labels and are read-only renderings of the same admitted carriers.
// ---------------------------------------------------------------------------

type ProcessFlowMapVariantHostProps = {
  map: SidecarProcessMap;
  catalog: NonNullable<SidecarProcessProjection['catalog']>;
  overlays: NonNullable<SidecarProcessProjection['leafOverlays']>;
  activeRecordIds: string[];
  selectedRecordId: string | null;
  activeVariant: 'v0' | 'v1' | 'v2' | 'v4';
  activeLeafName: string | null;
  onSelectVariant: (variant: 'v0' | 'v1' | 'v2' | 'v4') => void;
  onSelectRecord: (id: string | null) => void;
  onSelectLeaf: (leafName: string) => void;
  onOpenTracePath: (absolutePath: string) => void;
};

const PROCESS_FLOW_VARIANT_DESCRIPTORS: Array<{
  id: 'v0' | 'v1' | 'v2' | 'v4';
  label: string;
  badge: 'canonical' | 'paydown' | 'scaffold';
  hint: string;
}> = [
  { id: 'v0', label: 'V0 Baseline', badge: 'paydown', hint: 'Existing graph map retained as local paydown.' },
  { id: 'v1', label: 'V1 Three-lane', badge: 'canonical', hint: 'Canonical process flow map.' },
  { id: 'v2', label: 'V2 Asset-DAG', badge: 'scaffold', hint: 'Asset-surface-centric topology (§13A scaffold).' },
  { id: 'v4', label: 'V4 Assurance Matrix', badge: 'scaffold', hint: '43-row × 7-col closure grid (§13A scaffold).' },
];

function ProcessFlowMapVariantHost(props: ProcessFlowMapVariantHostProps) {
  const { map, catalog, overlays, activeRecordIds, selectedRecordId, activeVariant, activeLeafName, onSelectVariant, onSelectRecord, onSelectLeaf, onOpenTracePath } = props;
  return (
    <div className="sidecar-process-flow-variant-host">
      <div className="sidecar-process-flow-variants" role="tablist" aria-label="Process flow map variants">
        {PROCESS_FLOW_VARIANT_DESCRIPTORS.map((descriptor) => {
          const selected = descriptor.id === activeVariant;
          return (
            <button
              key={descriptor.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`sidecar-process-flow-variant-tab process-tab${selected ? ' is-selected' : ''}`}
              onClick={() => onSelectVariant(descriptor.id)}
              title={descriptor.hint}
            >
              <strong>{descriptor.label}</strong>
              {descriptor.badge === 'canonical' && (
                <span className="status-chip active" aria-label="Canonical process flow map">canonical</span>
              )}
              {descriptor.badge === 'paydown' && (
                <span className="status-chip default" aria-label="Local paydown variant">paydown</span>
              )}
              {descriptor.badge === 'scaffold' && (
                <span className="status-chip pending" aria-label="§13A scaffold (exploratory)">scaffold</span>
              )}
            </button>
          );
        })}
      </div>
      {activeVariant === 'v0' && (
        <ProcessGraphMap
          map={map}
          activeRecordIds={activeRecordIds}
          selectedRecordId={selectedRecordId}
          onSelectRecord={onSelectRecord}
          onOpenTracePath={onOpenTracePath}
        />
      )}
      {activeVariant === 'v1' && (
        <ProcessFlowMapV1ThreeLane
          catalog={catalog}
          overlays={overlays}
          activeLeafName={activeLeafName}
          onSelectLeaf={onSelectLeaf}
        />
      )}
      {activeVariant === 'v2' && (
        <ProcessFlowMapV2AssetDag
          catalog={catalog}
          overlays={overlays}
          activeLeafName={activeLeafName}
          onSelectLeaf={onSelectLeaf}
        />
      )}
      {activeVariant === 'v4' && (
        <ProcessFlowMapV4AssuranceMatrix
          catalog={catalog}
          overlays={overlays}
          activeLeafName={activeLeafName}
          onSelectLeaf={onSelectLeaf}
        />
      )}
    </div>
  );
}

type VariantBaseProps = {
  catalog: NonNullable<SidecarProcessProjection['catalog']>;
  overlays: NonNullable<SidecarProcessProjection['leafOverlays']>;
  activeLeafName: string | null;
  onSelectLeaf: (leafName: string) => void;
};

// Helper: derive leaf-status class from overlay status.
function leafStatusKind(status: string | undefined): 'active' | 'blocked' | 'pending' | 'default' {
  if (!status) return 'default';
  if (status === 'fd_postflight_passed' || status === 'fp_succeeded') return 'active';
  if (status === 'failed') return 'blocked';
  if (status === 'running' || status === 'queued') return 'pending';
  return 'default';
}

function assuranceCarrierKind(state: string | undefined): 'active' | 'blocked' | 'pending' | 'default' {
  if (state === 'complete') return 'active';
  if (state === 'incomplete') return 'blocked';
  if (state === 'absent') return 'pending';
  return 'default';
}

function closureDispositionKind(
  disposition: string | null | undefined,
  closeReady = false,
): 'active' | 'blocked' | 'pending' | 'default' {
  if (closeReady || disposition === 'close') return 'active';
  if (disposition === 'yield') return 'pending';
  if (disposition === 'retry' || disposition === 'repair' || disposition === 're-enter' || disposition === 'reprice' || disposition === 'block') return 'blocked';
  return 'default';
}

// V1 — three-lane structural map. Bootstrap chain | Operational chain | Triage lane.
function ProcessFlowMapV1ThreeLane({ catalog, overlays, activeLeafName, onSelectLeaf }: VariantBaseProps) {
  const overlayByLeaf = new Map(overlays.map((ov) => [ov.leafName, ov]));
  const lanes: Array<{ id: 'bootstrap' | 'operational' | 'triage'; label: string; leaves: typeof catalog.leaves }> = [
    { id: 'bootstrap', label: 'Bootstrap → Release', leaves: catalog.leaves.filter((l) => l.catalog === 'bootstrap') },
    { id: 'operational', label: 'Operational Cycle', leaves: catalog.leaves.filter((l) => l.catalog === 'operational') },
    { id: 'triage', label: 'Triage Lane', leaves: catalog.leaves.filter((l) => l.catalog === 'triage') },
  ];
  return (
    <div className="sidecar-process-flow-v1" role="region" aria-label="Three-lane structural map">
      <div className="sidecar-process-flow-v1__lanes">
        {lanes.map((lane) => (
          <section key={lane.id} className="sidecar-process-flow-v1__lane" aria-label={lane.label}>
            <header><strong>{lane.label}</strong> <span className="status-chip default">{lane.leaves.length}</span></header>
            <ol className="sidecar-process-flow-v1__chain">
              {lane.leaves.map((leaf, index) => {
                const overlay = overlayByLeaf.get(leaf.name);
                const selected = leaf.name === activeLeafName;
                return (
                  <li key={leaf.name}>
                    <button
                      type="button"
                      className={`sidecar-process-flow-v1__node list-row${selected ? ' is-selected' : ''}`}
                      onClick={() => onSelectLeaf(leaf.name)}
                      aria-pressed={selected}
                    >
                      <span className="sidecar-process-flow-v1__index">{index + 1}</span>
                      <div className="sidecar-process-flow-v1__node-meta">
                        <strong>{leaf.name}</strong>
                        <span className={`status-chip ${leafStatusKind(overlay?.latestStatus)}`}>
                          {overlay?.latestStatus ?? 'unattested'}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
              {lane.leaves.length === 0 && (
                <li><div className="sidecar-inspector__empty">No leaves in this lane.</div></li>
              )}
            </ol>
          </section>
        ))}
      </div>
      <details className="sidecar-process-flow-v1__library">
        <summary><strong>Library functions</strong> <span className="status-chip default">{catalog.library.length}</span></summary>
        <ul>
          {catalog.library.map((fn) => (
            <li key={fn.name}>
              <strong>{fn.name}</strong>
              <p>{fn.intent}</p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

// V2 — asset-DAG. Nodes are *_surface assets; group leaves by the surface they produce.
function ProcessFlowMapV2AssetDag({ catalog, overlays, activeLeafName, onSelectLeaf }: VariantBaseProps) {
  const overlayByLeaf = new Map(overlays.map((ov) => [ov.leafName, ov]));
  // Each surface is produced by one leaf (each leaf has one primary output).
  // Group leaves by their primary output surface and show producers + consumers.
  const surfaceProducers = new Map<string, typeof catalog.leaves[number]>();
  for (const leaf of catalog.leaves) {
    const primary = leaf.outputs[0];
    if (primary && !surfaceProducers.has(primary)) {
      surfaceProducers.set(primary, leaf);
    }
  }
  // Compute fan-in: for each surface, count how many other leaves consume it.
  const surfaceFanIn = new Map<string, string[]>();
  for (const leaf of catalog.leaves) {
    for (const input of leaf.inputs) {
      if (!surfaceFanIn.has(input)) surfaceFanIn.set(input, []);
      surfaceFanIn.get(input)!.push(leaf.name);
    }
  }
  const surfaces = Array.from(surfaceProducers.keys());
  return (
    <div className="sidecar-process-flow-v2" role="region" aria-label="Asset-DAG variant">
      <div className="sidecar-process-flow-v1__scaffold-banner">
        §13A scaffold — V2 asset-DAG (owning ticket: T-026)
      </div>
      <ul className="sidecar-process-flow-v2__surfaces">
        {surfaces.map((surface) => {
          const producer = surfaceProducers.get(surface)!;
          const consumers = surfaceFanIn.get(surface) ?? [];
          const overlay = overlayByLeaf.get(producer.name);
          const selected = producer.name === activeLeafName;
          return (
            <li key={surface}>
              <button
                type="button"
                className={`sidecar-process-flow-v2__surface list-row${selected ? ' is-selected' : ''}`}
                onClick={() => onSelectLeaf(producer.name)}
              >
                <div className="sidecar-process-flow-v2__surface-head">
                  <strong>{surface}</strong>
                  <span className={`status-chip ${leafStatusKind(overlay?.latestStatus)}`}>
                    {overlay?.latestStatus ?? 'unattested'}
                  </span>
                </div>
                <p>produced by <code>{producer.name}</code> ({producer.catalog})</p>
                <p className="sidecar-process-flow-v2__fan">
                  {consumers.length === 0
                    ? 'terminal surface (not consumed downstream)'
                    : `feeds ${consumers.length} downstream leaf${consumers.length === 1 ? '' : 'es'}`}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// V4 — assurance matrix. The assurance-vector columns stay intact; T-164 adds
// ledger-derived edge close/gain/residual cells beside invocation status.
function ProcessFlowMapV4AssuranceMatrix({ catalog, overlays, activeLeafName, onSelectLeaf }: VariantBaseProps) {
  const overlayByLeaf = new Map(overlays.map((ov) => [ov.leafName, ov]));
  const dims: Array<['materialization' | 'semanticConvergence' | 'obligationCarry' | 'requirementFulfillment' | 'ambiguity' | 'capability' | 'shallowRealization', string]> = [
    ['materialization', 'mat'],
    ['semanticConvergence', 'sem'],
    ['obligationCarry', 'obl'],
    ['requirementFulfillment', 'req'],
    ['ambiguity', 'amb'],
    ['capability', 'cap'],
    ['shallowRealization', 'shal'],
  ];
  return (
    <div className="sidecar-process-flow-v4" role="region" aria-label="Assurance-matrix variant">
      <div className="sidecar-process-flow-v1__scaffold-banner">
        §13A scaffold — V4 assurance matrix (owning ticket: T-026)
      </div>
      <table className="sidecar-process-flow-v4__matrix">
        <thead>
          <tr>
            <th scope="col">Leaf</th>
            <th scope="col">Catalog</th>
            <th scope="col">Status</th>
            <th scope="col">Close</th>
            <th scope="col">Gain</th>
            <th scope="col">Residual</th>
            {dims.map(([key, label]) => (
              <th key={key} scope="col">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {catalog.leaves.map((leaf) => {
            const overlay = overlayByLeaf.get(leaf.name);
            const assurance = overlay?.edgeAssurance ?? null;
            const selected = leaf.name === activeLeafName;
            return (
              <tr
                key={leaf.name}
                className={selected ? 'is-selected' : ''}
                onClick={() => onSelectLeaf(leaf.name)}
                style={{ cursor: 'pointer' }}
              >
                <th scope="row">{leaf.name}</th>
                <td>{leaf.catalog}</td>
                <td><span className={`status-chip ${leafStatusKind(overlay?.latestStatus)}`}>{overlay?.latestStatus ?? 'unattested'}</span></td>
                <td>
                  <span className={`status-chip ${closureDispositionKind(assurance?.closureDisposition, assurance?.closeReady)}`}>
                    {assurance?.closureDisposition ?? '—'}
                  </span>
                </td>
                <td>
                  <span className={`status-chip ${assurance?.edgeGainRef ? 'active' : 'default'}`}>
                    {assurance?.edgeGainRef ? 'carried' : '—'}
                  </span>
                </td>
                <td>
                  <span className={`status-chip ${(assurance?.edgeResidualPressureRefs.length ?? 0) > 0 ? 'blocked' : 'default'}`}>
                    {assurance?.edgeResidualPressureRefs.length ?? '—'}
                  </span>
                </td>
                {dims.map(([key]) => {
                  const cell = overlay?.assuranceVector?.[key];
                  return (
                    <td key={key}>
                      <span className={`status-chip ${cell === 'pass' ? 'active' : cell === 'fail' ? 'blocked' : cell === 'pending' ? 'pending' : 'default'}`}>
                        {cell ?? '—'}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function processRecordMatchesSearch(record: SidecarProcessRecord, normalizedSearch: string) {
  const haystack = [
    record.title,
    record.summary,
    record.kind,
    record.status,
    record.edge ?? '',
    record.workKey ?? '',
    record.graphFunctionId ?? '',
    ...record.eventKinds,
    ...record.evidenceRefs,
  ].join(' ').toLowerCase();
  return haystack.includes(normalizedSearch);
}

function describeProcessQueryHeadline(visibleCount: number, totalCount: number) {
  const noun = totalCount === 1 ? 'process record' : 'process records';
  return `Showing ${visibleCount} of ${totalCount} ${noun}.`;
}

function describeProcessQuerySummary(
  map: SidecarProcessMap | null,
  record: SidecarProcessRecord | null,
  normalizedSearch: string,
) {
  const parts = [
    map ? `${map.label} is the active graph carrier.` : null,
    record ? `${record.title} anchors the workbench.` : 'No process object is focused.',
    normalizedSearch ? 'Search is narrowing the active process lane.' : null,
  ].filter(Boolean);
  return parts.join(' ');
}

function ProcessGraphMap({ map, activeRecordIds, selectedRecordId, onSelectRecord, onOpenTracePath }: {
  map: SidecarProcessMap;
  activeRecordIds: string[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onOpenTracePath?: (absolutePath: string) => void;
}) {
  if (map.nodes.length === 0) {
    return <div className="sidecar-inspector__empty">This map has no projected graph nodes.</div>;
  }

  const activeRecordSet = new Set(activeRecordIds);
  const nodeWidth = 176;
  const nodeHeight = 86;
  const columnGap = 232;
  const rowGap = 112;
  const padding = 32;
  const positions = new Map(map.nodes.map((node) => [
    node.id,
    {
      x: padding + node.column * columnGap,
      y: padding + node.row * rowGap,
    },
  ]));
  const maxColumn = Math.max(0, ...map.nodes.map((node) => node.column));
  const maxRow = Math.max(0, ...map.nodes.map((node) => node.row));
  const width = padding * 2 + nodeWidth + maxColumn * columnGap;
  const height = padding * 2 + nodeHeight + maxRow * rowGap;

  return (
    <div className="sidecar-process-map__viewport">
      <div className="sidecar-process-map__canvas" style={{ width, height } as CSSProperties}>
        <svg
          className="sidecar-process-map__edges"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden="true"
        >
          {map.edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const active = edge.recordIds.length === 0 || edge.recordIds.some((id) => activeRecordSet.has(id));
            const selected = selectedRecordId ? edge.recordIds.includes(selectedRecordId) : false;
            const start = processMapEdgeAnchor(from, to, nodeWidth, nodeHeight);
            const end = processMapEdgeAnchor(to, from, nodeWidth, nodeHeight);
            return (
              <line
                key={edge.id}
                className={`sidecar-process-map__edge sidecar-process-map__edge--${edge.tone}${active ? '' : ' is-muted'}${selected ? ' is-selected' : ''}`}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
            );
          })}
        </svg>
        {map.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const active = edge.recordIds.length === 0 || edge.recordIds.some((id) => activeRecordSet.has(id));
          const selected = selectedRecordId ? edge.recordIds.includes(selectedRecordId) : false;
          const start = processMapEdgeAnchor(from, to, nodeWidth, nodeHeight);
          const end = processMapEdgeAnchor(to, from, nodeWidth, nodeHeight);
          const x = (start.x + end.x) / 2;
          const y = (start.y + end.y) / 2;
          const primaryRecordId = edge.recordIds.find((id) => activeRecordSet.has(id)) ?? edge.recordIds[0] ?? null;
          const canOpenTrace = Boolean(edge.traceArchiveRoot && onOpenTracePath);
          const canSelectRecord = Boolean(primaryRecordId);
          const disabled = !canOpenTrace && !canSelectRecord;
          return (
            <button
              key={`${edge.id}:glyph`}
              type="button"
              disabled={disabled}
              className={`sidecar-process-map__edge-glyph sidecar-process-map__edge-glyph--outcome-${edge.latestOutcome ?? 'unattested'} sidecar-process-map__edge-glyph--executor-${edge.executorProfile ?? 'unattested'}${active ? '' : ' is-muted'}${selected ? ' is-selected' : ''}`}
              style={{ left: x, top: y } as CSSProperties}
              title={processEdgeGlyphLabel(edge)}
              aria-label={processEdgeGlyphLabel(edge)}
              onClick={() => {
                if (edge.traceArchiveRoot && onOpenTracePath) {
                  onOpenTracePath(edge.traceArchiveRoot);
                  return;
                }
                if (primaryRecordId) onSelectRecord(primaryRecordId);
              }}
            >
              <span className="sidecar-process-map__edge-outcome" aria-hidden="true" />
              <span className="sidecar-process-map__edge-executor" aria-hidden="true" />
            </button>
          );
        })}
        {map.nodes.map((node) => {
          const position = positions.get(node.id);
          if (!position) return null;
          const active = node.recordIds.length === 0 || node.recordIds.some((id) => activeRecordSet.has(id));
          const selected = selectedRecordId ? node.recordIds.includes(selectedRecordId) : false;
          const primaryRecordId = node.recordIds.find((id) => activeRecordSet.has(id)) ?? null;
          return (
            <button
              key={node.id}
              type="button"
              disabled={!primaryRecordId}
              className={`sidecar-process-map-node sidecar-process-map-node--${node.kind} sidecar-process-map-node--${node.tone}${active ? '' : ' is-muted'}${selected ? ' is-selected' : ''}`}
              style={{ left: position.x, top: position.y } as CSSProperties}
              onClick={() => primaryRecordId ? onSelectRecord(primaryRecordId) : undefined}
              title={node.summary}
            >
              <span className="panel__eyebrow">{node.lane}</span>
              <strong>{node.label}</strong>
              <small>{node.kind.replace(/_/g, ' ')}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function processMapEdgeAnchor(
  node: { x: number; y: number },
  other: { x: number; y: number },
  nodeWidth: number,
  nodeHeight: number,
): { x: number; y: number } {
  const dx = other.x - node.x;
  const dy = other.y - node.y;
  const centerX = node.x + nodeWidth / 2;
  const centerY = node.y + nodeHeight / 2;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? node.x + nodeWidth : node.x,
      y: centerY,
    };
  }
  return {
    x: centerX,
    y: dy >= 0 ? node.y + nodeHeight : node.y,
  };
}

function processEdgeGlyphLabel(edge: SidecarProcessMap['edges'][number]) {
  const outcome = edge.latestOutcome ?? 'unattested';
  const executor = edge.executorProfile ?? 'no executor evidence';
  const trace = edge.traceArchiveRoot ? `Trace archive: ${edge.traceArchiveRoot}` : 'No trace archive admitted';
  return `${edge.label}: ${outcome}; ${executor}. ${trace}`;
}

function ProcessMapSummary({ map, activeViewLabel, visibleRecordCount }: {
  map: SidecarProcessMap | null;
  activeViewLabel: string;
  visibleRecordCount: number;
}) {
  if (!map) return null;
  return (
    <div className="sidecar-process-map-summary">
      <div>
        <span className="panel__eyebrow">{activeViewLabel}</span>
        <h3>{map.label}</h3>
        <p>{map.summary}</p>
      </div>
      <div className="sidecar-process-map-summary__stats">
        {map.stats.map((stat) => (
          <span key={`${stat.label}:${stat.value}`} className={`sidecar-process-map-stat sidecar-process-map-stat--${stat.tone}`}>
            <strong>{stat.value}</strong>
            <small>{stat.label}</small>
          </span>
        ))}
        <span className="sidecar-process-map-stat sidecar-process-map-stat--active">
          <strong>{visibleRecordCount}</strong>
          <small>visible records</small>
        </span>
      </div>
    </div>
  );
}

function ProcessRecordDetail({ record, projection }: {
  record: SidecarProcessRecord;
  projection: SidecarProcessProjection;
}) {
  return (
    <div>
      <div className="sidecar-inspector__id">{record.edge ?? record.kind}</div>
      <h2 className="sidecar-inspector__title">{record.title}</h2>
      <div className="inline-pills">
        <Pill kind={record.tone}>{record.status}</Pill>
        {record.vectorIndex !== null ? <Pill kind="default">vector {record.vectorIndex}</Pill> : null}
        <Pill kind="default">{record.eventKinds.length} event kinds</Pill>
      </div>
      <p className="sidecar-body-text">{record.summary}</p>
      <MetaGrid items={[
        ['Contract', `${projection.contractName} ${projection.contractVersion}`],
        ['Run', record.runId ?? '—'],
        ['Work key', record.workKey ?? '—'],
        ['Graph call', compactIdentity(record.graphCallId)],
        ['Frame', compactIdentity(record.frameId)],
      ]} />
      <Section title="Observed Events">
        <div className="inline-pills">
          {record.eventKinds.map((kind) => <Pill key={kind} kind="default">{kind}</Pill>)}
        </div>
      </Section>
      <Section title="Evidence">
        {record.evidenceRefs.length === 0 ? <div className="sidecar-body-text">No evidence refs attached to this record.</div> : null}
        <ul className="sidecar-criteria-list">
          {record.evidenceRefs.slice(0, 8).map((ref) => <li key={ref}>{ref}</li>)}
        </ul>
      </Section>
    </div>
  );
}

function compactIdentity(value: string | null) {
  if (!value) return '—';
  if (value.length <= 72) return value;
  return `${value.slice(0, 34)}...${value.slice(-28)}`;
}

function SurfaceInspector({ projectRoot, tabId, relativePath, viewerState, dispatch }: {
  projectRoot: string | null;
  tabId: string;
  relativePath: string;
  viewerState: SidecarDocumentViewerState | undefined;
  dispatch: Dispatch<SidecarMsg>;
}) {
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
    const descriptor = documentDescriptorForPath(surface.relative_path);
    return (
      <div className="sidecar-surface-inspector">
        <DocumentViewer
          descriptor={descriptor}
          content={surface.content}
          state={viewerState}
          onZoomIn={() => dispatch({ type: 'document/zoom', tabId, delta: 0.15 })}
          onZoomOut={() => dispatch({ type: 'document/zoom', tabId, delta: -0.15 })}
          onReset={() => dispatch({ type: 'document/reset', tabId })}
          onFitWidth={() => dispatch({ type: 'document/fit-width', tabId })}
        />
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
  if (surface.kind === 'unreadable') {
    const reason = surface.reason === 'permission_denied'
      ? 'Permission denied.'
      : surface.reason === 'outside_workspace'
        ? 'The path is outside the active Project root.'
        : 'The file could not be read.';
    return (
      <div className="sidecar-inspector__empty">
        Surface unavailable: {surface.relative_path}. {reason}
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
    if (event.target.value) {
      dispatch({
        type: 'terminal/open',
        sessionId: event.target.value,
        groupId: activeGroup?.id ?? terminalWorkspace.activeGroupId,
      });
    }
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
