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
  Fragment,
  useCallback,
  useEffect,
  useMemo,
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
  type RefObject,
  type WheelEvent,
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
  SidecarProcessTone,
} from '../../contracts/process';
import {
  PROJECT_REGISTRY_CHANGED_EVENT,
  browsePath,
  registerProject,
  setActiveProject,
  unregisterProject,
} from '../../lib/collaboration';
import type { SurfaceData, SurfaceEntry } from '../../lib/types';
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
  SidecarBrowseFsEntry,
  SidecarBrowseLoaded,
  SidecarCmd,
  SidecarExplorerProviderId,
  SidecarInfoSurface,
  SidecarMsg,
  SidecarPathHistoryEntry,
  SidecarPathHistorySource,
  SidecarProcessGraphMode,
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
const SIDECAR_TAIL_FOLLOW_REFRESH_MS = 1500;

type NavigatorSortMode = 'time' | 'alpha';
type ProjectBrowserTab = 'favourites' | 'recent' | 'pick';

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
  loadedAt: number | null;
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
    return;
  }

  if (cmd.type === 'browse.path') {
    try {
      const raw = await browsePath(cmd.path ?? undefined);
      const validated = validateBrowseResult(raw);
      dispatch({ type: 'browse/loaded', result: validated, scope: cmd.scope });
    } catch (err) {
      dispatch({ type: 'browse/load-failed', error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (cmd.type === 'projects.register') {
    try {
      const result = await registerProject(cmd.path, { setActive: false });
      if (!result.ok || !result.project) {
        dispatch({ type: 'browse/favourite-failed', path: cmd.path, error: 'registry did not return a project' });
        return;
      }
      dispatch({
        type: 'browse/favourite-succeeded',
        project: result.project,
        projects: result.projects,
      });
      dispatch({ type: 'action/result', ok: true, message: `favourited ${cmd.path}` });
    } catch (err) {
      dispatch({
        type: 'browse/favourite-failed',
        path: cmd.path,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (cmd.type === 'projects.unregister') {
    try {
      const result = await unregisterProject(cmd.projectId);
      if (!result.ok) {
        dispatch({ type: 'projects/unfavourite-failed', projectId: cmd.projectId, error: 'unregister rejected' });
        return;
      }
      dispatch({
        type: 'projects/unfavourite-succeeded',
        projectId: cmd.projectId,
        projects: result.projects,
      });
      dispatch({ type: 'action/result', ok: true, message: `unfavourited ${cmd.projectId}` });
    } catch (err) {
      dispatch({
        type: 'projects/unfavourite-failed',
        projectId: cmd.projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// Validate filesystem browse payloads before they enter reducer-owned UI state.
function validateBrowseResult(raw: unknown): SidecarBrowseLoaded {
  if (!raw || typeof raw !== 'object') {
    throw new Error('browse response is not an object');
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.path !== 'string' || record.path.length === 0) {
    throw new Error('browse response is missing path');
  }
  const parent = record.parent;
  if (parent !== null && typeof parent !== 'string') {
    throw new Error('browse response parent is not string|null');
  }
  if (!Array.isArray(record.entries)) {
    throw new Error('browse response entries is not an array');
  }
  const entries: SidecarBrowseFsEntry[] = [];
  for (const entry of record.entries) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    if (typeof rec.name !== 'string' || typeof rec.absolutePath !== 'string') continue;
    const kindValue = rec.kind;
    const kind: 'directory' | 'file' | undefined =
      kindValue === 'directory' || kindValue === 'file' ? kindValue : undefined;
    entries.push(Object.freeze({
      name: rec.name,
      absolutePath: rec.absolutePath,
      kind,
      hasWorkspace: rec.hasWorkspace === true,
    }));
  }
  return Object.freeze({
    path: record.path,
    parent,
    entries: Object.freeze(entries),
    truncated: record.truncated === true,
  });
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
  const pendingProjectSelection = useRef<{ root: string; projectId: string } | null>(null);
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
    const pending = pendingProjectSelection.current;
    if (!pending || state.loading || !state.context) return;
    if (normalizePinnedPath(state.context.project.root) !== normalizePinnedPath(pending.root)) return;
    pendingProjectSelection.current = null;
    dispatch({ type: 'select', kind: 'project', id: pending.projectId });
  }, [state.context, state.loading]);

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
    pendingProjectSelection.current = { root: project.root, projectId: project.id };
    try {
      const result = await setActiveProject(project.id);
      pendingProjectContextRoot.current = result.project.root;
      pendingProjectSelection.current = { root: result.project.root, projectId: result.project.id };
      dispatch({ type: 'select', kind: 'project', id: result.project.id });
      if (currentProjectRoot && normalizePinnedPath(currentProjectRoot) === normalizePinnedPath(result.project.root)) {
        pendingProjectSelection.current = null;
      }
    } catch (caught) {
      pendingProjectSelection.current = null;
      dispatch({ type: 'action/result', ok: false, error: caught instanceof Error ? caught.message : String(caught) });
    }
  };

  const handleProjectRootOpen = async (root: string) => {
    try {
      const result = await setActiveProject(root, { registerIfMissing: false });
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

  const handleRefreshSessions = () => {
    if (!state.context) return;
    dispatch({ type: 'load/request', projectRoot: state.context.project.root, reason: 'session_refresh' });
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
  const selectedProcessNavigatorTitle = selectedProcessNavigator ? 'Process Navigator' : null;
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
                dispatch={dispatch}
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
            detail="Graph, function, asset, and live-run navigator"
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
                onRefresh={handleRefreshSessions}
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

function parentFolderPath(path: string | null) {
  if (!path) return null;
  const normalized = normalizePinnedPath(path);
  if (!normalized || normalized === '/') return null;
  const index = normalized.lastIndexOf('/');
  if (index <= 0) return '/';
  return normalized.slice(0, index);
}

interface FolderPathSegment {
  label: string;
  path: string;
}

function folderPathSegments(path: string | null): FolderPathSegment[] {
  if (!path) return [];
  const normalized = normalizePinnedPath(path);
  if (!normalized) return [];
  if (normalized === '/') return [{ label: '/', path: '/' }];
  const absolute = normalized.startsWith('/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return [];
  const segments: FolderPathSegment[] = [];
  if (absolute) {
    segments.push({ label: '/', path: '/' });
  }
  let current = absolute ? '' : '';
  for (const part of parts) {
    current = absolute
      ? `${current}/${part}`
      : current
        ? `${current}/${part}`
        : part;
    segments.push({ label: part, path: current });
  }
  return segments;
}

interface ProjectFavouriteCandidate {
  path: string;
  label: string;
  meta: string;
}

function projectFavouriteCandidatesFromHistory(
  entries: SidecarPathHistoryEntry[],
  currentProjectRoot: string | null,
  projects: ProjectRecord[],
) {
  const registeredRoots = new Set(projects.map((project) => normalizePinnedPath(project.root)));
  const seen = new Set<string>();
  const candidates: ProjectFavouriteCandidate[] = [];
  for (const entry of entries) {
    const candidate = parentFolderPath(entry.absolutePath);
    if (!candidate || registeredRoots.has(candidate) || seen.has(candidate)) continue;
    seen.add(candidate);
    candidates.push({
      path: candidate,
      label: folderDisplayPath(candidate, currentProjectRoot),
      meta: entry.relativePath,
    });
    if (candidates.length >= 6) break;
  }
  return candidates;
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
    loadedAt: null,
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

function scrollHorizontalOverflowOnWheel(event: WheelEvent<HTMLDivElement>) {
  const target = event.currentTarget;
  if (target.scrollWidth <= target.clientWidth) return;
  if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  target.scrollLeft += event.deltaY;
  event.preventDefault();
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
  dispatch,
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
  dispatch: Dispatch<SidecarMsg>;
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
  const [projectBrowserTab, setProjectBrowserTab] = useState<ProjectBrowserTab>('favourites');
  const projectRootPath = projectRoot ? normalizePinnedPath(projectRoot) : null;
  const builtInFolderPath = builtInNavigatorFolderForSurface(surface, projectRoot);
  const selectedProjectRootPath = state.selection.kind === 'project'
    ? state.projects.find((project) => project.id === state.selection.id)?.root ?? null
    : null;
  const normalizedSelectedProjectRootPath = selectedProjectRootPath ? normalizePinnedPath(selectedProjectRootPath) : null;

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
        loadedAt: current[path]?.loadedAt ?? null,
      },
    }));
    try {
      const payload = await fetchJson(
        `/api/fs/browse?path=${encodeURIComponent(path)}&includeFiles=1&includeHidden=1&maxEntries=0&refresh=${Date.now()}`,
        { cache: 'no-store' },
      );
      const load = { ...asNavigatorFolderLoad(payload), loadedAt: Date.now() };
      setFolderLoads((current) => ({ ...current, [path]: load }));
    } catch (err) {
      setFolderLoads((current) => ({
        ...current,
        [path]: {
          entries: current[path]?.entries ?? [],
          truncated: false,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          loadedAt: current[path]?.loadedAt ?? null,
        },
      }));
    }
  }, []);

  const handleFolderToggle = useCallback((key: string, path: string, collapsed: boolean) => {
    const nextCollapsed = !collapsed;
    patchGroup(key, { collapsed: nextCollapsed });
    if (!nextCollapsed && !folderLoads[path]?.loading) {
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
    const currentlyExpanded = expandedProjectRoots[normalizedRoot] ?? (normalizedRoot === normalizedSelectedProjectRootPath);
    const nextExpanded = !currentlyExpanded;
    setExpandedProjectRoots((current) => ({
      ...current,
      [normalizedRoot]: nextExpanded,
    }));
    if (nextExpanded && !folderLoads[normalizedRoot]?.loading) {
      void loadFolder(normalizedRoot);
    }
  };

  const selectProjectBrowserTab = (tab: ProjectBrowserTab) => {
    setProjectBrowserTab(tab);
    if (tab === 'pick') {
      dispatch({ type: 'browse/scope-set', scope: 'cross-project' });
    }
  };

  const sortToolbar = (
    <NavigatorSortToolbar
      sort={navigatorSort}
      onSort={(sort) => setNavigatorSort((current) => ({ ...current, sort }))}
      onReverse={() => setNavigatorSort((current) => ({ ...current, reverse: !current.reverse }))}
    />
  );
  const folderRefreshAction = (path: string | null, label: string) => {
    if (!path) return null;
    const normalizedPath = normalizePinnedPath(path);
    const load = folderLoads[normalizedPath] ?? null;
    return (
      <FolderRefreshButton
        label={label}
        loading={load?.loading === true}
        loadedAt={load?.loadedAt ?? null}
        onRefresh={() => void loadFolder(normalizedPath)}
      />
    );
  };
  const actionsWithRefresh = (refreshAction: ReactNode) => (
    <>
      {refreshAction}
      {headerActions}
    </>
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
    const roots = state.projects
      .map((project) => normalizePinnedPath(project.root))
      .filter((root) => root && ((expandedProjectRoots[root] ?? (root === normalizedSelectedProjectRootPath)) === true));
    for (const root of roots) {
      if (!folderLoads[root]) void loadFolder(root);
    }
  }, [expandedProjectRoots, folderLoads, loadFolder, normalizedSelectedProjectRootPath, state.projects, surface]);

  if (activePinnedFolderPath && projectRoot) {
    const displayPath = folderDisplayPath(activePinnedFolderPath, projectRoot);
    return (
      <Pane
        title={displayPath}
        count={folderLoads[activePinnedFolderPath]?.entries.length ?? 0}
        actions={actionsWithRefresh(folderRefreshAction(activePinnedFolderPath, displayPath))}
      >
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
      <Pane
        title={infoSurfaceTitle(surface)}
        count={folderLoads[builtInFolderPath]?.entries.length ?? infoSurfaceCount(surface, state)}
        actions={actionsWithRefresh(folderRefreshAction(builtInFolderPath, displayPath))}
      >
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
    const browseState = state.ui.browse;
    const projectFavouriteCandidates = projectFavouriteCandidatesFromHistory(state.pathHistory, projectRoot, state.projects);
    const projectFavouriteRoots = state.projects.map((project) => normalizePinnedPath(project.root));
    const projectBrowserTabs: Array<{ id: ProjectBrowserTab; label: string; count: number }> = [
      { id: 'favourites', label: 'Favourite', count: state.projects.length },
      { id: 'recent', label: 'Recent', count: projectFavouriteCandidates.length },
      { id: 'pick', label: 'Browse', count: browseState.entries.length },
    ];
    const projectBrowserRootIsVisible = (root: string | null) => Boolean(
      root &&
      state.projects.some((project) => normalizePinnedPath(project.root) === root) &&
      (expandedProjectRoots[root] ?? root === normalizedSelectedProjectRootPath)
    );
    const visibleProjectBrowserRoots = state.projects
      .map((project) => normalizePinnedPath(project.root))
      .filter((root) => projectBrowserRootIsVisible(root));
    const projectBrowserVisibleFolderPaths = (() => {
      const visibleFolders = new Set<string>();
      const collectFolder = (folderPath: string, defaultCollapsed: boolean) => {
        const normalizedPath = normalizePinnedPath(folderPath);
        if (!normalizedPath || visibleFolders.has(normalizedPath)) return;
        visibleFolders.add(normalizedPath);
        const group = navigatorGroupState(
          groupStates,
          navigatorGroupKey('folder', normalizedPath),
          { collapsed: defaultCollapsed, sort: 'time', reverse: true },
        );
        if (group.collapsed) return;
        const load = folderLoads[normalizedPath] ?? null;
        for (const entry of load?.entries ?? []) {
          if ((entry.kind ?? 'directory') === 'directory') collectFolder(entry.absolutePath, true);
        }
      };
      for (const root of visibleProjectBrowserRoots) collectFolder(root, false);
      return Array.from(visibleFolders);
    })();
    const projectBrowserVisibleRefreshLoading = projectBrowserVisibleFolderPaths.some((path) => folderLoads[path]?.loading === true);
    const projectBrowserRefreshAction = projectBrowserTab === 'pick'
      ? (
        <FolderRefreshButton
          label={browseState.currentPath ?? 'current folder'}
          loading={browseState.loading}
          disabled={!browseState.currentPath}
          onRefresh={() => {
            if (browseState.currentPath) dispatch({ type: 'browse/navigate-to', path: browseState.currentPath });
          }}
        />
      )
      : (
        <FolderRefreshButton
          label="Project Browser visible folders"
          loading={projectBrowserVisibleRefreshLoading}
          disabled={projectBrowserVisibleFolderPaths.length === 0}
          onRefresh={() => {
            for (const path of projectBrowserVisibleFolderPaths) void loadFolder(path);
          }}
        />
      );
    const projectBrowserTabStrip = (
      <div
        className="sidecar-project-browser__tabs sidecar-project-browser__tabs--header"
        role="tablist"
        aria-label="Project Browser views"
        onWheel={scrollHorizontalOverflowOnWheel}
      >
        {projectBrowserTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={projectBrowserTab === tab.id}
            className={`sidecar-project-browser__tab${projectBrowserTab === tab.id ? ' is-active' : ''}`}
            onClick={() => selectProjectBrowserTab(tab.id)}
          >
            <span>{tab.label}</span>
            <span>{tab.count}</span>
          </button>
        ))}
      </div>
    );
    return (
      <Pane
        title="Project Browser"
        count={state.projects.length}
        actions={actionsWithRefresh(projectBrowserRefreshAction)}
        titleAddon={projectBrowserTabStrip}
      >
        <div className="sidecar-project-browser sidecar-project-browser--tabbed">
          {projectBrowserTab === 'favourites' ? (
            <div className="sidecar-project-browser__panel" role="tabpanel" aria-label="Favourite">
              {sortToolbar}
              {state.projects.length === 0 ? <NavigatorEmptyState>No Project favourites.</NavigatorEmptyState> : null}
              {state.projects.map((project) => {
                const normalizedRoot = normalizePinnedPath(project.root);
                const selected = state.selection.kind === 'project' && state.selection.id === project.id;
                const expanded = expandedProjectRoots[normalizedRoot] ?? selected;
                const activeRoot = projectRoot ? normalizePinnedPath(projectRoot) : null;
                const unfavouriteDisabled = normalizedRoot === activeRoot || project.is_active === true;
                const unfavouriteTitle = unfavouriteDisabled
                  ? 'Open another Project before removing this favourite.'
                  : `Unfavourite project ${project.name || project.id}`;
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
                      <div className="sidecar-row__actions">
                        <button
                          type="button"
                          className={`sidecar-tree-control sidecar-tree-control--text${expanded ? ' is-active' : ''}`}
                          onClick={() => toggleProjectBrowse(project.root)}
                          aria-expanded={expanded}
                          title={`Browse folders under ${project.root}`}
                        >
                          Browse
                        </button>
                        <button
                          type="button"
                          className="sidecar-tree-control sidecar-tree-control--text sidecar-tree-control--compact"
                          onClick={() => dispatch({ type: 'projects/unfavourite', projectId: project.id })}
                          aria-label={`Unfavourite project ${project.name || project.id}`}
                          title={unfavouriteTitle}
                          disabled={unfavouriteDisabled}
                        >
                          [U]
                        </button>
                      </div>
                    </div>
                    {state.ui.browse.unfavouriteError && state.selection.kind === 'project' && state.selection.id === project.id ? (
                      <div className="sidecar-row__error" role="alert">{state.ui.browse.unfavouriteError}</div>
                    ) : null}
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
                          onSurfaceSelect={onSurfaceSelect}
                          pathSource="browse"
                          pinnedFolders={[]}
                          onPinFolder={() => undefined}
                          onUnpinFolder={() => undefined}
                          navigatorSort={navigatorSort}
                          projectBrowser
                          projectFavouriteRoots={projectFavouriteRoots}
                          onProjectFavourite={(path) => dispatch({ type: 'browse/favourite-folder', path })}
                          onProjectRootOpen={onProjectRootOpen}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {projectBrowserTab === 'recent' ? (
            <div className="sidecar-project-browser__panel" role="tabpanel" aria-label="Recent folders">
              {projectFavouriteCandidates.length === 0 ? (
                <NavigatorEmptyState>No recent folder candidates.</NavigatorEmptyState>
              ) : null}
              {projectFavouriteCandidates.map((candidate) => (
                <div key={candidate.path} className="sidecar-row sidecar-row--project-candidate">
                  <div className="sidecar-project-browser__main" title={candidate.path}>
                    <div className="sidecar-row__title">{candidate.label}</div>
                    <div className="sidecar-row__meta">{candidate.meta}</div>
                  </div>
                  <button
                    type="button"
                    className="sidecar-tree-control sidecar-tree-control--text sidecar-tree-control--compact"
                    onClick={() => dispatch({ type: 'browse/favourite-folder', path: candidate.path })}
                    aria-label={`Add ${candidate.label} to Project Favourites`}
                    title={`Add ${candidate.path} to Project Favourites`}
                  >
                    [+]
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {projectBrowserTab === 'pick' ? (
            <div className="sidecar-project-browser__panel" role="tabpanel" aria-label="Browse Project Favourite">
              <div className="sidecar-project-picker">
                <div className="sidecar-project-picker__header">
                  <FolderPathBreadcrumb
                    currentPath={browseState.currentPath}
                    loading={browseState.loading}
                    onNavigate={(path) => dispatch({ type: 'browse/navigate-to', path })}
                  />
                </div>
                {browseState.error ? (
                  <div className="sidecar-row__error" role="alert">{browseState.error}</div>
                ) : null}
                {browseState.favouriteError ? (
                  <div className="sidecar-row__error" role="alert">{browseState.favouriteError}</div>
                ) : null}
                {browseState.loading ? <NavigatorEmptyState>Loading folders...</NavigatorEmptyState> : null}
                {!browseState.loading && browseState.entries.length === 0 && browseState.currentPath ? (
                  <NavigatorEmptyState>No subfolders here.</NavigatorEmptyState>
                ) : null}
                {!browseState.loading && browseState.entries.length > 0 ? (
                  <div className="sidecar-project-picker__entries">
                    {browseState.entries.filter((entry) => entry.kind !== 'file').map((entry) => {
                      const registered = state.projects.some((project) => normalizePinnedPath(project.root) === normalizePinnedPath(entry.absolutePath));
                      return (
                        <div key={entry.absolutePath} className="sidecar-row sidecar-row--project-candidate">
                          <div className="sidecar-project-browser__main" title={entry.absolutePath}>
                            <button
                              type="button"
                              className="sidecar-project-picker__name-button"
                              onClick={() => dispatch({ type: 'browse/navigate-to', path: entry.absolutePath })}
                              title={`Browse ${entry.absolutePath}`}
                            >
                              {entry.name}
                            </button>
                            <div className="sidecar-row__meta sidecar-project-picker__meta">
                              {entry.hasWorkspace ? (
                                <button
                                  type="button"
                                  className="sidecar-project-picker__workspace-button"
                                  onClick={() => onProjectRootOpen(entry.absolutePath)}
                                  aria-label={`Open workspace ${entry.name}`}
                                  title={`Open workspace ${entry.absolutePath}`}
                                >
                                  wspace
                                </button>
                              ) : null}
                              <span>{entry.absolutePath}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="sidecar-tree-control sidecar-tree-control--text sidecar-tree-control--compact"
                            onClick={() => dispatch({ type: 'browse/favourite-folder', path: entry.absolutePath })}
                            aria-label={`Add ${entry.name} to Project Favourites`}
                            title={registered ? 'Already a Project Favourite.' : `Add ${entry.absolutePath} to Project Favourites`}
                            disabled={registered}
                          >
                            [+]
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {browseState.truncated ? (
                  <div className="sidecar-project-picker__notice">Listing truncated.</div>
                ) : null}
              </div>
            </div>
          ) : null}
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
    const browseCount = projectRootPath ? folderLoads[projectRootPath]?.entries.length ?? 0 : 0;
    return (
      <Pane
        title="Browse"
        count={browseCount}
        actions={actionsWithRefresh(folderRefreshAction(projectRootPath, 'Browse root'))}
      >
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

function FolderRefreshButton({ label, loading = false, disabled = false, loadedAt = null, onRefresh }: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  loadedAt?: number | null;
  onRefresh: () => void;
}) {
  const effectiveDisabled = disabled || loading;
  const loadedAtDetail = loadedAt ? `; last read ${formatFolderLoadedAt(loadedAt)}` : '';
  const actionLabel = loading ? `Refreshing ${label}` : `Refresh ${label}`;
  return (
    <button
      type="button"
      className="sidecar-tree-control sidecar-tree-control--refresh"
      onClick={onRefresh}
      disabled={effectiveDisabled}
      aria-label={actionLabel}
      title={`${actionLabel}${loadedAtDetail}`}
    >
      <span aria-hidden="true">{loading ? '...' : '↻'}</span>
    </button>
  );
}

function formatFolderLoadedAt(value: number) {
  const ageSeconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  if (ageSeconds < 5) return 'just now';
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function FolderPathBreadcrumb({ currentPath, loading, onNavigate }: {
  currentPath: string | null;
  loading: boolean;
  onNavigate: (path: string) => void;
}) {
  const segments = folderPathSegments(currentPath);
  if (segments.length === 0) {
    return (
      <span className="sidecar-project-picker__path" title={currentPath ?? ''}>
        {loading ? 'Loading...' : 'No folder loaded'}
      </span>
    );
  }
  const normalizedCurrent = currentPath ? normalizePinnedPath(currentPath) : null;
  return (
    <nav
      className="sidecar-project-picker__path sidecar-project-picker__breadcrumb"
      aria-label="Current folder path"
      title={currentPath ?? ''}
    >
      {segments.map((segment, index) => {
        const isCurrent = normalizedCurrent === segment.path;
        return (
          <span key={segment.path} className="sidecar-project-picker__crumb">
            {index > 0 ? <span className="sidecar-project-picker__separator" aria-hidden="true">/</span> : null}
            {isCurrent ? (
              <span className="sidecar-project-picker__segment is-current">{segment.label}</span>
            ) : (
              <button
                type="button"
                className="sidecar-project-picker__segment"
                onClick={() => onNavigate(segment.path)}
                aria-label={`Navigate to ${segment.path}`}
                title={`Navigate to ${segment.path}`}
              >
                {segment.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function FolderTreeNode({ path, label, depth, projectRoot, groupStates, folderLoads, defaultCollapsed = true, onPatchGroup, onToggle, onSurfaceSelect, pathSource, pinnedFolders, onPinFolder, onUnpinFolder, navigatorSort, projectBrowser = false, projectFavouriteRoots = [], onProjectFavourite, canOpenProject = false, onProjectRootOpen }: {
  path: string;
  label: string;
  depth: number;
  projectRoot: string | null;
  groupStates: Record<string, NavigatorGroupState>;
  folderLoads: Record<string, NavigatorFolderLoad>;
  defaultCollapsed?: boolean;
  onPatchGroup: (key: string, patch: Partial<NavigatorGroupState>) => void;
  onToggle: (key: string, path: string, collapsed: boolean) => void;
  onSurfaceSelect: (relativePath: string, absolutePath: string, source: SidecarPathHistorySource) => void;
  pathSource: SidecarPathHistorySource;
  pinnedFolders: string[];
  onPinFolder: (path: string) => void;
  onUnpinFolder: (path: string) => void;
  navigatorSort: NavigatorSortState;
  projectBrowser?: boolean;
  projectFavouriteRoots?: string[];
  onProjectFavourite?: (path: string) => void;
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
  const isProjectFavourite = projectFavouriteRoots.includes(normalizedPath);
  const isBuiltIn = builtInNavigatorFolders(projectRoot).map(normalizePinnedPath).includes(normalizedPath);
  const pinLabel = `${isPinned ? 'Unpin' : 'Pin'} ${label}`;
  const projectFavouriteLabel = `Add ${label} to Project Favourites`;
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
      {projectBrowser && depth > 0 && onProjectFavourite ? (
        <button
          type="button"
          className="sidecar-tree-control sidecar-tree-control--text sidecar-tree-control--compact"
          onClick={() => onProjectFavourite(normalizedPath)}
          aria-label={projectFavouriteLabel}
          title={isProjectFavourite ? 'Already a Project Favourite.' : `Add ${normalizedPath} to Project Favourites`}
          disabled={isProjectFavourite}
        >
          [+]
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
              onSurfaceSelect={onSurfaceSelect}
              pathSource={pathSource}
              pinnedFolders={pinnedFolders}
              onPinFolder={onPinFolder}
              onUnpinFolder={onUnpinFolder}
              navigatorSort={navigatorSort}
              projectBrowser={projectBrowser}
              projectFavouriteRoots={projectFavouriteRoots}
              onProjectFavourite={onProjectFavourite}
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

function Pane({ title, count, extraCount, actions, titleAddon, children }: PropsWithChildrenLike<{ title: string; count: number; extraCount?: number; actions?: ReactNode; titleAddon?: ReactNode }>) {
  return (
    <section className="sidecar-pane">
      <div className={`sidecar-pane__header${titleAddon ? ' sidecar-pane__header--with-title-addon' : ''}`}>
        <div className={`sidecar-pane__title-row${titleAddon ? ' sidecar-pane__title-row--with-addon' : ''}`}>
          <h3>
            <span className="sidecar-pane__title">{title}</span>
            <span className="sidecar-pane__title-count">({count})</span>
          </h3>
          {titleAddon ? <div className="sidecar-pane__title-addon">{titleAddon}</div> : null}
        </div>
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
    return 'Process Navigator';
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
          <EmptyViewerPane
            canClose={workspace.split !== 'single' && group.id !== 'main'}
            onClose={() => dispatch({ type: 'viewer/close-group', groupId: group.id })}
          />
        )}
      </div>
    </section>
  );
}

function EmptyViewerPane({ canClose, onClose }: {
  canClose: boolean;
  onClose: () => void;
}) {
  return (
    <div className={`sidecar-inspector__empty sidecar-viewer-empty-pane${canClose ? ' can-close' : ''}`}>
      {canClose ? (
        <button
          type="button"
          className="sidecar-viewer-empty-pane__close"
          aria-label="Close empty viewer pane"
          title="Close empty viewer pane"
          onClick={onClose}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
      <span>No viewer tab is open.</span>
    </div>
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
    return <ProcessNavigatorSimplePanel state={state} dispatch={dispatch} />;
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

type ProcessNavigatorSimpleTab = 'graphs' | 'functions' | 'assets' | 'live';
type ProcessNavigatorSection = {
  tab: ProcessNavigatorSimpleTab;
  label: string;
  count: number;
};
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

function buildProcessNavigatorSections(input: {
  graphTabCount: number;
  functionCount: number;
  assetCount: number;
  liveAttemptCount: number;
}): ProcessNavigatorSection[] {
  const sections: ProcessNavigatorSection[] = [
    { tab: 'live', label: 'Runtime State', count: input.liveAttemptCount },
  ];
  if (input.graphTabCount > 0) {
    sections.push({ tab: 'graphs', label: 'Graph Overlays', count: input.graphTabCount });
  }
  if (input.functionCount > 0) {
    sections.push({ tab: 'functions', label: 'Function Catalog', count: input.functionCount });
  }
  if (input.assetCount > 0) {
    sections.push({ tab: 'assets', label: 'Asset Nodes', count: input.assetCount });
  }
  return sections;
}

function ProcessNavigatorSimplePanel({ state, dispatch }: {
  state: SidecarState;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const projection = state.process;
  const [activeTab, setActiveTab] = useState<ProcessNavigatorSimpleTab>('live');
  const [selectedOverlayRef, setSelectedOverlayRef] = useState<string | null>(null);
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);
  const [selectedAssetName, setSelectedAssetName] = useState<string | null>(null);
  const liveRefreshRoot = state.context?.project.root ?? projection?.workspaceRoot ?? null;
  const requestLiveRefresh = useCallback(() => {
    if (!liveRefreshRoot || state.loading) return;
    dispatch({ type: 'load/request', projectRoot: liveRefreshRoot, reason: 'action_completed' });
  }, [dispatch, liveRefreshRoot, state.loading]);

  useEffect(() => {
    if (activeTab !== 'live' || !liveRefreshRoot || state.loading || typeof window === 'undefined') return undefined;
    const refreshTimer = window.setInterval(() => {
      dispatch({ type: 'load/request', projectRoot: liveRefreshRoot, reason: 'action_completed' });
    }, 30000);
    return () => window.clearInterval(refreshTimer);
  }, [activeTab, dispatch, liveRefreshRoot, state.loading]);

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
  const workspaceRun = projection.workspaceRun ?? null;
  const liveAttemptCount = workspaceRun?.operatorRunCount ?? projection.liveAnalysis?.attempts.length ?? 0;
  const processSections = buildProcessNavigatorSections({
    graphTabCount,
    functionCount: functionItems.length,
    assetCount: assetRelationships.length,
    liveAttemptCount,
  });
  const activeProcessTab = processSections.some((section) => section.tab === activeTab)
    ? activeTab
    : processSections[0]?.tab ?? 'live';
  const selectedOverlay = traversalOverlays.find((overlay) => overlay.overlayRef === selectedOverlayRef) ?? traversalOverlays[0] ?? null;
  const selectedFunction = functionItems.find((item) => item.id === selectedFunctionId) ?? functionItems[0] ?? null;
  const selectedAsset = assetRelationships.find((asset) => asset.name === selectedAssetName) ?? assetRelationships[0] ?? null;
  const simpleMap = selectedOverlay && activeProcessTab === 'graphs'
    ? buildSimpleOverlayGraph(selectedOverlay)
    : selectedFunction && catalog && activeProcessTab === 'functions'
      ? buildSimpleFunctionGraph(selectedFunction, catalog)
      : selectedAsset && catalog && activeProcessTab === 'assets'
        ? buildSimpleAssetGraph(selectedAsset, catalog)
        : null;
  const defaultSelectedRecordId = activeProcessTab === 'live'
    ? null
    : activeProcessTab === 'graphs' && selectedOverlay
    ? processGraphRecordId('overlay-function', selectedOverlay.defaultStartTarget || selectedOverlay.graphFunctionRefs[0] || selectedOverlay.overlayRef)
    : activeProcessTab === 'functions' && selectedFunction
      ? processGraphRecordId('function', selectedFunction.name)
      : activeProcessTab === 'assets' && selectedAsset
        ? processGraphRecordId('asset', selectedAsset.name)
        : null;
  const selectedRecordId = simpleMap && state.ui.activeProcessRecordId && processMapHasRecordId(simpleMap, state.ui.activeProcessRecordId)
    ? state.ui.activeProcessRecordId
    : defaultSelectedRecordId;
  const graphTitle = activeProcessTab === 'graphs'
    ? selectedOverlay?.name ?? 'Graph Overlays'
    : activeProcessTab === 'functions'
      ? selectedFunction?.title ?? 'Function Catalog'
      : activeProcessTab === 'live'
        ? 'Runtime State'
      : selectedAsset?.name ?? 'Asset Nodes';
  const graphSummary = activeProcessTab === 'graphs'
    ? selectedOverlay?.intent ?? 'No graph overlay is selected.'
    : activeProcessTab === 'functions'
      ? selectedFunction?.summary ?? 'No graph function is selected.'
      : activeProcessTab === 'live'
        ? 'Current odd_sdlc operator-run, stage-process, and live-analysis state.'
      : selectedAsset
        ? `Produced by ${selectedAsset.producers.length} and consumed by ${selectedAsset.consumers.length}.`
        : 'No asset node is selected.';
  const openTracePath = (absolutePath: string) => {
    const relativePath = relativeProjectPath(state.context?.project.root ?? projection.workspaceRoot, absolutePath);
    if (!relativePath) {
      dispatch({ type: 'action/result', ok: false, error: 'Trace archive is outside the active Project.' });
      return;
    }
    dispatch({ type: 'viewer/open', kind: 'surface', id: relativePath });
  };

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
          {workspaceRun ? <Pill kind={workspaceRun.activeFeedbackLoopCount > 0 ? 'active' : 'default'}>{workspaceRun.stageProcessCount} stage processes</Pill> : null}
          {projection.liveAnalysis && <Pill kind={liveAnalysisTone(projection.liveAnalysis.liveness.productiveSignal)}>{projection.liveAnalysis.telemetry.operatorRunCount} analyze runs</Pill>}
        </div>
      </div>

      <div className="sidecar-process-simple__tabs" role="tablist" aria-label="Process navigator sections">
        {processSections.map(({ tab, label, count }) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeProcessTab === tab}
            className={`process-tab sidecar-process-simple__tab${activeProcessTab === tab ? ' is-selected' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <strong>{label}</strong>
            <span className="status-chip default">{count}</span>
          </button>
        ))}
      </div>

      {activeProcessTab === 'live' ? (
        <section className="sidecar-process-simple__live sidecar-process-map" aria-label="Runtime State">
          <ProcessLiveViewPanel
            analysis={projection.liveAnalysis ?? null}
            workspaceRun={workspaceRun}
            projectRoot={liveRefreshRoot}
            onOpenTracePath={openTracePath}
            onRefresh={requestLiveRefresh}
            refreshing={state.loading && state.activeLoadRoot === liveRefreshRoot}
            liveActiveRunRowCollapsed={state.ui.liveActiveRunRowCollapsed}
            onLiveActiveRunRowCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-active-run-row-collapsed', collapsed })}
            liveInternalRowCollapsed={state.ui.liveInternalRowCollapsed}
            onLiveInternalRowCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-internal-row-collapsed', collapsed })}
            liveTranscriptCollapsed={state.ui.liveTranscriptCollapsed}
            onLiveTranscriptCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-transcript-collapsed', collapsed })}
            liveDetailRowCollapsed={state.ui.liveDetailRowCollapsed}
            onLiveDetailRowCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-detail-row-collapsed', collapsed })}
            liveGapRowCollapsed={state.ui.liveGapRowCollapsed}
            onLiveGapRowCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-gap-row-collapsed', collapsed })}
            liveEventViewerCollapsed={state.ui.liveEventViewerCollapsed}
            onLiveEventViewerCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-event-viewer-collapsed', collapsed })}
            onLiveAllCollapsedChange={(collapsed) => dispatch({ type: 'process/set-live-all-collapsed', collapsed })}
          />
        </section>
      ) : (
        <ProcessSimpleGraphPanel
          title={graphTitle}
          summary={graphSummary}
          map={simpleMap}
          selectedRecordId={selectedRecordId}
          graphMode={state.ui.activeProcessGraphMode}
          onGraphModeChange={(mode) => dispatch({ type: 'process/set-graph-mode', mode })}
          onSelectRecord={(id) => {
            dispatch({ type: 'process/select-record', id });
            const parsed = parseProcessGraphRecordId(id);
            if (!parsed) return;
            if (parsed.kind === 'overlay') setSelectedOverlayRef(parsed.value);
            if (parsed.kind === 'function') setSelectedFunctionId(functionItems.find((item) => item.name === parsed.value)?.id ?? selectedFunctionId);
            if (parsed.kind === 'asset') setSelectedAssetName(parsed.value);
          }}
        />
      )}

      {activeProcessTab === 'graphs' && (
        <section className="sidecar-process-simple__section" aria-label="Graph overlays">
          {traversalOverlays.length ? (
            <div className="sidecar-process-overlay-grid">
              {traversalOverlays.map((overlay) => (
                <ProcessOverlayCard
                  key={overlay.overlayRef}
                  overlay={overlay}
                  selected={selectedOverlay?.overlayRef === overlay.overlayRef}
                  onSelect={() => {
                    const firstRef = overlay.defaultStartTarget || overlay.graphFunctionRefs[0] || overlay.overlayRef;
                    setSelectedOverlayRef(overlay.overlayRef);
                    dispatch({ type: 'process/select-record', id: processGraphRecordId('overlay-function', firstRef) });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="sidecar-inspector__empty">
              No TypeScript graph overlay catalog is projected for this workspace.
            </div>
          )}
        </section>
      )}

      {activeProcessTab === 'functions' && (
        <section className="sidecar-process-simple__section" aria-label="Graph functions">
          {catalog ? (
            <div className="sidecar-process-function-groups">
              <ProcessFunctionGroup title="Executive Graph Functions" count={catalog.executives.length}>
                {functionItems.filter((item) => item.source === 'executive').map((item) => (
                  <ProcessFunctionCard
                    key={item.id}
                    item={item}
                    selected={selectedFunction?.id === item.id}
                    onSelect={() => {
                      setSelectedFunctionId(item.id);
                      dispatch({ type: 'process/select-record', id: processGraphRecordId('function', item.name) });
                    }}
                  />
                ))}
              </ProcessFunctionGroup>
              <ProcessFunctionGroup title="Leaf Graph Functions" count={catalog.leaves.length}>
                {functionItems.filter((item) => item.source === 'leaf').map((item) => (
                  <ProcessFunctionCard
                    key={item.id}
                    item={item}
                    selected={selectedFunction?.id === item.id}
                    onSelect={() => {
                      setSelectedFunctionId(item.id);
                      dispatch({ type: 'process/select-record', id: processGraphRecordId('function', item.name) });
                    }}
                  />
                ))}
              </ProcessFunctionGroup>
              <ProcessFunctionGroup title="Library Graph Functions" count={catalog.library.length}>
                {functionItems.filter((item) => item.source === 'library').map((item) => (
                  <ProcessFunctionCard
                    key={item.id}
                    item={item}
                    selected={selectedFunction?.id === item.id}
                    onSelect={() => {
                      setSelectedFunctionId(item.id);
                      dispatch({ type: 'process/select-record', id: processGraphRecordId('function', item.name) });
                    }}
                  />
                ))}
              </ProcessFunctionGroup>
            </div>
          ) : (
            <div className="sidecar-inspector__empty">No graph-function catalog is projected for this workspace.</div>
          )}
        </section>
      )}

      {activeProcessTab === 'assets' && (
        <section className="sidecar-process-simple__section" aria-label="Leaf node assets and relationships">
          {assetRelationships.length ? (
            <div className="sidecar-process-assets">
              {assetRelationships.map((asset) => (
                <ProcessAssetCard
                  key={asset.name}
                  asset={asset}
                  selected={selectedAsset?.name === asset.name}
                  onSelect={() => {
                    setSelectedAssetName(asset.name);
                    dispatch({ type: 'process/select-record', id: processGraphRecordId('asset', asset.name) });
                  }}
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

function ProcessSimpleGraphPanel({ title, summary, map, selectedRecordId, graphMode, onGraphModeChange, onSelectRecord }: {
  title: string;
  summary: string;
  map: SidecarProcessMap | null;
  selectedRecordId: string | null;
  graphMode: SidecarProcessGraphMode;
  onGraphModeChange: (mode: SidecarProcessGraphMode) => void;
  onSelectRecord: (id: string) => void;
}) {
  const activeRecordIds = map ? processMapRecordIds(map) : [];
  const toggleGraphMode = () => onGraphModeChange(graphMode === 'compressed' ? 'expanded' : 'compressed');
  return (
    <section className={`sidecar-process-simple__graph sidecar-process-simple__graph--${graphMode} sidecar-process-map`} aria-label="Selected process graph">
      <div className="sidecar-process-simple__graph-header">
        <div>
          <span className="panel__eyebrow">Selected Graph</span>
          <h3>{title}</h3>
        </div>
        <p>{summary}</p>
        <button
          type="button"
          className="sidecar-process-simple__mode-toggle"
          onClick={toggleGraphMode}
          disabled={!map}
          aria-expanded={graphMode === 'expanded'}
          aria-label={graphMode === 'compressed' ? 'Show full graph' : 'Show compressed navigator'}
          title={graphMode === 'compressed' ? 'Show full graph' : 'Show compressed navigator'}
        >
          <span aria-hidden="true">{graphMode === 'compressed' ? '⌄' : '⌃'}</span>
        </button>
      </div>
      {map ? (
        graphMode === 'compressed' ? (
          <ProcessCompressedNavigator
            map={map}
            selectedRecordId={selectedRecordId}
            onSelectRecord={onSelectRecord}
          />
        ) : (
          <ProcessGraphMap
            map={map}
            activeRecordIds={activeRecordIds}
            selectedRecordId={selectedRecordId}
            onSelectRecord={onSelectRecord}
          />
        )
      ) : (
        <div className="sidecar-inspector__empty">Select a process object to render its graph.</div>
      )}
    </section>
  );
}

const PROCESS_RAIL_ROWS = 2;
const PROCESS_RAIL_COLUMN_WIDTH = 136;

type ProcessRailNode = SidecarProcessMap['nodes'][number];
type ProcessRailColumn = {
  key: string;
  index: number;
  topNode: ProcessRailNode | null;
  bottomNode: ProcessRailNode | null;
  topConnectorTone: SidecarProcessTone | null;
  bottomConnectorTone: SidecarProcessTone | null;
  topConnectorEmphasis: 'selected' | 'related' | 'muted' | null;
  bottomConnectorEmphasis: 'selected' | 'related' | 'muted' | null;
  hiddenCount: number;
};
type ProcessRailModel = {
  columns: ProcessRailColumn[];
  selectedNodeIds: Set<string>;
  relatedNodeIds: Set<string>;
  focusRange: { start: number; end: number } | null;
};

function ProcessCompressedNavigator({ map, selectedRecordId, onSelectRecord }: {
  map: SidecarProcessMap;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  const topLaneRef = useRef<HTMLDivElement | null>(null);
  const bottomLaneRef = useRef<HTMLDivElement | null>(null);
  const rail = useMemo(() => buildProcessRailModel(map, selectedRecordId), [map, selectedRecordId]);

  useEffect(() => {
    if (!rail.focusRange) return;
    const center = ((rail.focusRange.start + rail.focusRange.end + 1) * PROCESS_RAIL_COLUMN_WIDTH) / 2;
    for (const element of [topLaneRef.current, bottomLaneRef.current]) {
      if (!element) continue;
      const nextLeft = Math.max(center - element.clientWidth / 2, 0);
      element.scrollTo({ left: nextLeft, behavior: 'smooth' });
    }
  }, [rail.focusRange]);

  return (
    <section className="sidecar-process-compressed" aria-label="Compressed process navigator">
      <div className="sidecar-process-compressed__legend">
        <span className="panel__eyebrow">Compressed Navigator</span>
        <p>Two guarded lanes over the same left-to-right process order. Selecting a stop centers its direct neighborhood.</p>
      </div>
      <div className="sidecar-process-compressed__lane-shell">
        <ProcessCompressedLane
          laneRef={topLaneRef}
          lane="top"
          columns={rail.columns}
          selectedNodeIds={rail.selectedNodeIds}
          relatedNodeIds={rail.relatedNodeIds}
          onSelectRecord={onSelectRecord}
        />
        <ProcessCompressedLane
          laneRef={bottomLaneRef}
          lane="bottom"
          columns={rail.columns}
          selectedNodeIds={rail.selectedNodeIds}
          relatedNodeIds={rail.relatedNodeIds}
          onSelectRecord={onSelectRecord}
        />
      </div>
    </section>
  );
}

function ProcessCompressedLane({ laneRef, lane, columns, selectedNodeIds, relatedNodeIds, onSelectRecord }: {
  laneRef: RefObject<HTMLDivElement | null>;
  lane: 'top' | 'bottom';
  columns: ProcessRailColumn[];
  selectedNodeIds: Set<string>;
  relatedNodeIds: Set<string>;
  onSelectRecord: (id: string) => void;
}) {
  return (
    <div ref={laneRef} className={`sidecar-process-compressed__lane sidecar-process-compressed__lane--${lane}`}>
      <div
        className="sidecar-process-compressed__track"
        style={{ gridTemplateColumns: `repeat(${columns.length}, ${PROCESS_RAIL_COLUMN_WIDTH}px)` } as CSSProperties}
      >
        {columns.map((column) => {
          const node = lane === 'top' ? column.topNode : column.bottomNode;
          const connectorTone = lane === 'top' ? column.topConnectorTone : column.bottomConnectorTone;
          const connectorState = lane === 'top' ? column.topConnectorEmphasis : column.bottomConnectorEmphasis;
          const stateClass = node
            ? selectedNodeIds.has(node.id)
              ? 'is-selected'
              : relatedNodeIds.has(node.id)
                ? 'is-related'
                : selectedNodeIds.size > 0
                  ? 'is-muted'
                  : ''
            : '';
          const primaryRecordId = node?.recordIds[0] ?? null;
          return (
            <div key={`${lane}:${column.key}`} className="sidecar-process-compressed__slot">
              {node ? (
                <button
                  type="button"
                  className={`sidecar-process-compressed__stop sidecar-process-compressed__stop--${node.tone} ${stateClass}`}
                  disabled={!primaryRecordId}
                  onClick={() => primaryRecordId ? onSelectRecord(primaryRecordId) : undefined}
                  title={node.summary}
                >
                  <span className={`sidecar-process-compressed__signal sidecar-process-compressed__signal--${node.tone}`} />
                  <span className="sidecar-process-compressed__label">{node.label}</span>
                  {lane === 'top' && column.hiddenCount > 0 ? (
                    <span className="sidecar-process-compressed__overflow" title={`${column.hiddenCount} additional node(s) are collapsed in this stage`}>
                      +{column.hiddenCount}
                    </span>
                  ) : null}
                </button>
              ) : (
                <div className="sidecar-process-compressed__spacer" aria-hidden="true" />
              )}
              {connectorTone ? (
                <span
                  className={`sidecar-process-compressed__connector sidecar-process-compressed__connector--${connectorTone}${connectorState ? ` is-${connectorState}` : ''}`}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function buildProcessRailModel(map: SidecarProcessMap, selectedRecordId: string | null): ProcessRailModel {
  const buckets = new Map<number, ProcessRailNode[]>();
  for (const node of map.nodes) {
    const bucket = buckets.get(node.column) ?? [];
    bucket.push(node);
    buckets.set(node.column, bucket);
  }

  const selectedNodeIds = new Set(
    selectedRecordId
      ? map.nodes.filter((node) => node.recordIds.includes(selectedRecordId)).map((node) => node.id)
      : [],
  );
  const relatedNodeIds = new Set<string>();
  if (selectedNodeIds.size > 0) {
    for (const edge of map.edges) {
      if (selectedNodeIds.has(edge.from)) relatedNodeIds.add(edge.to);
      if (selectedNodeIds.has(edge.to)) relatedNodeIds.add(edge.from);
    }
  }

  const orderedBuckets = [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, nodes]) => nodes.sort((left, right) => left.row - right.row || left.label.localeCompare(right.label)));

  const nodeToColumnIndex = new Map<string, number>();
  orderedBuckets.forEach((bucket, index) => {
    bucket.forEach((node) => nodeToColumnIndex.set(node.id, index));
  });

  const columns = orderedBuckets.map((bucket, index): ProcessRailColumn => {
    const prioritized = [...bucket].sort((left, right) => {
      const leftRank = processRailPriority(left.id, selectedNodeIds, relatedNodeIds);
      const rightRank = processRailPriority(right.id, selectedNodeIds, relatedNodeIds);
      return leftRank - rightRank || left.row - right.row || left.label.localeCompare(right.label);
    });
    const visible = prioritized.slice(0, PROCESS_RAIL_ROWS).sort((left, right) => left.row - right.row);
    return {
      key: bucket.map((node) => node.id).join(':'),
      index,
      topNode: visible[0] ?? null,
      bottomNode: visible[1] ?? null,
      topConnectorTone: null,
      bottomConnectorTone: null,
      topConnectorEmphasis: null,
      bottomConnectorEmphasis: null,
      hiddenCount: Math.max(bucket.length - visible.length, 0),
    };
  });

  for (let index = 0; index < columns.length - 1; index += 1) {
    const current = columns[index];
    const next = columns[index + 1];
    if (current.topNode && next.topNode) {
      current.topConnectorTone = processRailConnectorTone(map, current.topNode, next.topNode);
      current.topConnectorEmphasis = processRailConnectorEmphasis(current.topNode.id, next.topNode.id, selectedNodeIds, relatedNodeIds);
    }
    if (current.bottomNode && next.bottomNode) {
      current.bottomConnectorTone = processRailConnectorTone(map, current.bottomNode, next.bottomNode);
      current.bottomConnectorEmphasis = processRailConnectorEmphasis(current.bottomNode.id, next.bottomNode.id, selectedNodeIds, relatedNodeIds);
    }
  }

  const focusColumnIndexes = new Set<number>();
  selectedNodeIds.forEach((nodeId) => {
    const columnIndex = nodeToColumnIndex.get(nodeId);
    if (columnIndex !== undefined) focusColumnIndexes.add(columnIndex);
  });
  relatedNodeIds.forEach((nodeId) => {
    const columnIndex = nodeToColumnIndex.get(nodeId);
    if (columnIndex !== undefined) focusColumnIndexes.add(columnIndex);
  });
  const orderedFocus = [...focusColumnIndexes].sort((left, right) => left - right);
  const focusRange = orderedFocus.length
    ? {
        start: Math.max(orderedFocus[0] - 1, 0),
        end: Math.min(orderedFocus[orderedFocus.length - 1] + 1, columns.length - 1),
      }
    : null;

  return { columns, selectedNodeIds, relatedNodeIds, focusRange };
}

function processRailPriority(nodeId: string, selectedNodeIds: Set<string>, relatedNodeIds: Set<string>) {
  if (selectedNodeIds.has(nodeId)) return 0;
  if (relatedNodeIds.has(nodeId)) return 1;
  return 2;
}

function processRailConnectorTone(map: SidecarProcessMap, left: ProcessRailNode, right: ProcessRailNode): SidecarProcessTone {
  const edge = map.edges.find((candidate) =>
    (candidate.from === left.id && candidate.to === right.id) ||
    (candidate.from === right.id && candidate.to === left.id),
  );
  if (edge) return edge.tone;
  if (left.tone === 'blocked' || right.tone === 'blocked') return 'blocked';
  if (left.tone === 'active' || right.tone === 'active') return 'active';
  if (left.tone === 'pending' || right.tone === 'pending') return 'pending';
  return 'converged';
}

function processRailConnectorEmphasis(
  leftId: string,
  rightId: string,
  selectedNodeIds: Set<string>,
  relatedNodeIds: Set<string>,
) {
  if (selectedNodeIds.has(leftId) || selectedNodeIds.has(rightId)) return 'selected';
  if (relatedNodeIds.has(leftId) || relatedNodeIds.has(rightId)) return 'related';
  return selectedNodeIds.size > 0 ? 'muted' : null;
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

function processMapHasRecordId(map: SidecarProcessMap, recordId: string) {
  return map.nodes.some((node) => node.recordIds.includes(recordId)) ||
    map.edges.some((edge) => edge.recordIds.includes(recordId));
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


type SidecarLiveAnalysis = NonNullable<SidecarProcessProjection['liveAnalysis']>;
type SidecarLiveAnalysisAttempt = SidecarLiveAnalysis['attempts'][number];
type SidecarLiveAnalysisDiagnostic = SidecarLiveAnalysis['diagnostics'][number];
type SidecarLiveAnalysisEvent = SidecarLiveAnalysisAttempt['detail']['events'][number];
type SidecarLiveAnalysisCliTranscript = SidecarLiveAnalysisAttempt['detail']['cliTranscript'];
type SidecarLiveAnalysisCliTranscriptInput = Partial<SidecarLiveAnalysisCliTranscript> | null | undefined;
type SidecarLiveAnalysisStageProcess = NonNullable<SidecarLiveAnalysisAttempt['detail']['stageProcesses']>[number];
type SidecarLiveAnalysisStageProcessInput = Partial<SidecarLiveAnalysisStageProcess> | null | undefined;
type SidecarLiveAnalysisEventSourceFilter = 'all' | SidecarLiveAnalysisEvent['sourceKind'];
type SidecarSdlcWorkspaceRun = NonNullable<SidecarProcessProjection['workspaceRun']>;
type SidecarSdlcOperatorRun = SidecarSdlcWorkspaceRun['operatorRuns'][number];

const LIVE_ASSURANCE_LEDGER_DESCRIPTIONS: Record<string, { summary: string; detail: string }> = Object.freeze({
  materialization: {
    summary: 'Checks that declared product files were produced with valid paths, roles, and file evidence.',
    detail: 'Measures the materialization contract: output paths stay inside the allowed root, files exist, byte or digest checks match, and product roles line up with the handoff.',
  },
  shallow_realization: {
    summary: 'Rejects placeholder, stub, constant-success, identity-only, or trace-only output.',
    detail: 'Measures whether the produced implementation is more than a shell. It looks for placeholders, constant success logic, identity-only transforms, and tests that only prove a trace exists.',
  },
  semantic_convergence: {
    summary: 'Checks that candidate evidence covers the target meaning, not just the target shape.',
    detail: 'Measures semantic coverage against the declared target. Missing, restated, or contradicted semantic claims keep the same edge open or force repricing.',
  },
  component_depth: {
    summary: 'Checks component-depth register rows against observed component and framework truth.',
    detail: 'Measures whether admitted component rows have stable ids, file paths, public boundaries, requirement allocation, source refs, and required materialized files for the target surface.',
  },
  requirement_fulfillment: {
    summary: 'Checks that admitted requirements have closure evidence for this edge authority.',
    detail: 'Measures requirement authority coverage from the closure register and lineage evidence. It can pass even when a produced file is still shallow if requirement evidence is otherwise fulfilled.',
  },
  obligation_carry: {
    summary: 'Checks prior retry obligations were closed, carried forward, or repriced.',
    detail: 'Measures continuity across retries. Prior gap pressure cannot disappear silently; each prior obligation must be closed, remain carried, or be repriced.',
  },
  ambiguity: {
    summary: 'Checks unresolved ambiguity is typed as re-entry pressure instead of hidden in prose.',
    detail: 'Measures ambiguity handling over the edge contract. Ambiguity must become explicit state with lawful retry, escalation, or repricing pressure.',
  },
  capability: {
    summary: 'Checks produced evidence covers the required capability inventory.',
    detail: 'Measures whether generated product evidence covers tenant or project capability contracts, especially for code surfaces with declared capability requirements.',
  },
  design_completeness: {
    summary: 'Checks design rows are complete enough to support downstream implementation or tests.',
    detail: 'Measures whether design evidence has the structural completeness needed by later materialization and execution edges.',
  },
});

function liveAssuranceLedgerDescription(dimension: string) {
  return LIVE_ASSURANCE_LEDGER_DESCRIPTIONS[dimension] ?? {
    summary: 'Checks one deterministic assurance dimension in the archived traversal fold.',
    detail: `Measures archived assurance dimension ${dimension}. The verdict contributes to the folded next lawful action.`,
  };
}

function ProcessLiveRowGroup({ widgetNames, ariaLabel, collapsed, onCollapsedChange, meta, children, className }: {
  widgetNames: readonly string[];
  ariaLabel: string;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  meta: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const rowLabel = widgetNames.join(' / ');
  return (
    <section className={`sidecar-live-view__detail-row-group${collapsed ? ' is-collapsed' : ''}${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      <button
        type="button"
        className="sidecar-live-view__row-collapse-toggle"
        onClick={() => onCollapsedChange(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${rowLabel} row`}
        title={`${collapsed ? 'Expand' : 'Collapse'} ${rowLabel} row`}
      >
        <span className="panel__eyebrow sidecar-live-view__row-label">
          {widgetNames.map((widgetName, index) => (
            <Fragment key={widgetName}>
              {index > 0 ? <span className="sidecar-live-view__row-label-separator" aria-hidden="true"> / </span> : null}
              <span className="sidecar-live-view__row-label-item">{widgetName}</span>
            </Fragment>
          ))}
        </span>
        <span className="sidecar-live-view__row-collapse-meta">
          {meta}
          <span className="sidecar-live-view__row-collapse-symbol" aria-hidden="true">{collapsed ? '⊞' : '⊟'}</span>
        </span>
      </button>
      {!collapsed ? children : null}
    </section>
  );
}

function ProcessLiveViewPanel({
  analysis,
  workspaceRun,
  projectRoot,
  onOpenTracePath,
  onRefresh,
  refreshing,
  liveActiveRunRowCollapsed,
  onLiveActiveRunRowCollapsedChange,
  liveInternalRowCollapsed,
  onLiveInternalRowCollapsedChange,
  liveTranscriptCollapsed,
  onLiveTranscriptCollapsedChange,
  liveDetailRowCollapsed,
  onLiveDetailRowCollapsedChange,
  liveGapRowCollapsed,
  onLiveGapRowCollapsedChange,
  liveEventViewerCollapsed,
  onLiveEventViewerCollapsedChange,
  onLiveAllCollapsedChange,
}: {
  analysis: SidecarProcessProjection['liveAnalysis'] | null | undefined;
  workspaceRun: SidecarProcessProjection['workspaceRun'] | null | undefined;
  projectRoot: string | null;
  onOpenTracePath: (absolutePath: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  liveActiveRunRowCollapsed: boolean;
  onLiveActiveRunRowCollapsedChange: (collapsed: boolean) => void;
  liveInternalRowCollapsed: boolean;
  onLiveInternalRowCollapsedChange: (collapsed: boolean) => void;
  liveTranscriptCollapsed: boolean;
  onLiveTranscriptCollapsedChange: (collapsed: boolean) => void;
  liveDetailRowCollapsed: boolean;
  onLiveDetailRowCollapsedChange: (collapsed: boolean) => void;
  liveGapRowCollapsed: boolean;
  onLiveGapRowCollapsedChange: (collapsed: boolean) => void;
  liveEventViewerCollapsed: boolean;
  onLiveEventViewerCollapsedChange: (collapsed: boolean) => void;
  onLiveAllCollapsedChange: (collapsed: boolean) => void;
}) {
  const [selectedAttemptRef, setSelectedAttemptRef] = useState<string | null>(null);
  if (!analysis && !workspaceRun) {
    return <div className="sidecar-inspector__empty">No live odd_sdlc runtime projection is available for this Project.</div>;
  }
  const attempts = analysis?.attempts ?? [];
  const liveness = analysis?.liveness ?? null;
  const activeAttemptRef = liveness?.activeOperatorRunRef ?? null;
  const latestAttempt = attempts[attempts.length - 1] ?? null;
  const selectedAttempt =
    attempts.find((attempt) => attempt.operatorRunRef === selectedAttemptRef) ??
    attempts.find((attempt) => activeAttemptRef !== null && attempt.operatorRunRef === activeAttemptRef) ??
    latestAttempt;
  const selectedOperatorRun = selectedAttempt
    ? findWorkspaceOperatorRunForAttempt(workspaceRun ?? null, selectedAttempt)
    : workspaceRun?.operatorRuns.at(-1) ?? null;
  const visibleDiagnostics = analysis?.diagnostics.slice(0, 6) ?? [];
  const activeRunTone = liveness ? liveAnalysisTone(liveness.productiveSignal) : workspaceRun?.activeFeedbackLoopCount ? 'active' : 'pending';
  const diagnosticsTone = (analysis?.diagnostics ?? []).some((diagnostic) => diagnostic.severity === 'error')
    ? 'blocked'
    : (analysis?.diagnostics.length ?? 0) > 0
      ? 'pending'
      : 'active';

  return (
    <div className="sidecar-live-view" aria-label="Live analyze-run view">
      <header className="sidecar-live-view__header">
        <div>
          <span className="panel__eyebrow">Live View</span>
          <h3>{analysis?.telemetry.scenarioName ?? 'odd_sdlc runtime projection'}</h3>
          <p>{analysis ? `${analysis.telemetry.inspectedKind} · ${analysis.telemetry.profile} · ${analysis.telemetry.inspectedRoot}` : workspaceRun?.workspaceRoot ?? 'workspace runtime'}</p>
        </div>
        <div className="sidecar-live-view__actions">
          <Pill kind={liveness ? liveAnalysisTone(liveness.productiveSignal) : workspaceRun?.activeFeedbackLoopCount ? 'active' : 'pending'}>
            {liveness ? liveness.productiveSignal.replace(/_/g, ' ') : workspaceRun?.activeFeedbackLoopCount ? 'feedback loop' : 'runtime artifacts'}
          </Pill>
          {liveness?.activeOperatorRunPath ? (
            <button
              type="button"
              className="status-chip active"
              onClick={() => onOpenTracePath(liveness.activeOperatorRunPath as string)}
            >
              Active archive
            </button>
          ) : null}
          <div className="sidecar-live-view__global-row-actions" aria-label="Process Navigator row visibility">
            <button
              type="button"
              className="status-chip default sidecar-live-view__global-row-toggle"
              onClick={() => onLiveAllCollapsedChange(true)}
              aria-label="Collapse all Process Navigator rows"
              title="Collapse all Process Navigator rows"
            >
              <span aria-hidden="true">⊟</span>
            </button>
            <button
              type="button"
              className="status-chip default sidecar-live-view__global-row-toggle"
              onClick={() => onLiveAllCollapsedChange(false)}
              aria-label="Expand all Process Navigator rows"
              title="Expand all Process Navigator rows"
            >
              <span aria-hidden="true">⊞</span>
            </button>
          </div>
        </div>
      </header>

      <div className="sidecar-live-view__stats" aria-label="Analyze-run summary">
        <span className="sidecar-process-map-stat sidecar-process-map-stat--active">
          <strong>{workspaceRun?.operatorRunCount ?? analysis?.telemetry.operatorRunCount ?? 0}</strong>
          <small>operator runs</small>
        </span>
        {workspaceRun ? (
          <>
            <span className="sidecar-process-map-stat sidecar-process-map-stat--active">
              <strong>{workspaceRun.stageProcessCount}</strong>
              <small>stage processes</small>
            </span>
            <span className="sidecar-process-map-stat">
              <strong>{workspaceRun.transcriptSurfaceCount}</strong>
              <small>transcript surfaces</small>
            </span>
          </>
        ) : null}
        <span className="sidecar-process-map-stat sidecar-process-map-stat--blocked">
          <strong>{workspaceRun?.activeFeedbackLoopCount ?? ((analysis?.telemetry.sameEdgeRetryCount ?? 0) + (analysis?.telemetry.blockedAttemptCount ?? 0))}</strong>
          <small>feedback loops</small>
        </span>
        <span className="sidecar-process-map-stat sidecar-process-map-stat--converged">
          <strong>{analysis ? formatDurationMs(analysis.telemetry.totalWorkerElapsedMs) : '—'}</strong>
          <small>worker time</small>
        </span>
        <span className="sidecar-process-map-stat">
          <strong>{analysis ? formatBytes(analysis.telemetry.archiveBytes.totalBytes) : '—'}</strong>
          <small>archive</small>
        </span>
        <span className="sidecar-process-map-stat">
          <strong>{analysis?.telemetry.finalClosureDisposition ?? `${workspaceRun?.closeCount ?? 0} close`}</strong>
          <small>final disposition</small>
        </span>
        <span className="sidecar-process-map-stat">
          <strong title={analysis?.generatedAt ?? ''}>{analysis ? formatLiveRefreshTime(analysis.generatedAt) : '—'}</strong>
          <small>last refresh</small>
        </span>
        <button
          type="button"
          className="sidecar-process-map-stat sidecar-live-view__refresh-button"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <strong>{refreshing ? 'refreshing' : 'Refresh'}</strong>
          <small>force refresh</small>
        </button>
      </div>

      <ol className="sidecar-live-view__timeline" aria-label="Analyze-run attempts">
        {attempts.length ? attempts.map((attempt) => {
          const operatorRun = findWorkspaceOperatorRunForAttempt(workspaceRun ?? null, attempt);
          const tone = liveAttemptTone(attempt, operatorRun);
          const active = activeAttemptRef !== null && attempt.operatorRunRef === activeAttemptRef;
          const canOpen = Boolean(attempt.operatorRunPath);
          const stageProcessCount = attempt.detail.stageProcesses?.length
            ?? operatorRun?.stages.reduce((total, stage) => total + stage.processInvocations.length, 0)
            ?? 0;
          const eventCount = attempt.detail.events?.length ?? 0;
          const dispositionLabel = operatorRun?.activeFeedbackLoop
            ? 'feedback loop'
            : operatorRun?.closureDecision?.disposition ?? attempt.closureDisposition ?? attempt.postflightStatus ?? attempt.fpEvaluateStatus ?? 'open';
          return (
            <li key={attempt.operatorRunRef} className={`sidecar-live-view__attempt sidecar-live-view__attempt--${tone}${active ? ' is-active' : ''}`}>
              <button
                type="button"
                disabled={!canOpen && attempts.length === 0}
                aria-pressed={selectedAttempt?.operatorRunRef === attempt.operatorRunRef}
                onClick={() => setSelectedAttemptRef(attempt.operatorRunRef)}
                title={attempt.operatorRunPath ?? attempt.operatorRunRef}
              >
                <span className="sidecar-live-view__attempt-index">{attempt.attemptOrdinal + 1}</span>
                <strong>{operatorRun?.edge?.edgeName ?? attempt.graphFunctionName ?? attempt.graphVectorRef ?? 'unmapped edge'}</strong>
                <small>{operatorRun?.edge?.targetAssetType ?? attempt.targetAssetType ?? attempt.traversalClass}</small>
                <span className={`status-chip ${tone}`}>{dispositionLabel}</span>
                <span className="sidecar-live-view__attempt-metrics">
                  <span>{stageProcessCount} stages</span>
                  <span>{eventCount} events</span>
                </span>
              </button>
            </li>
          );
        }) : (
          <li className="sidecar-inspector__empty">No operator-run attempts were reported by analyze-run.</li>
        )}
      </ol>

      {selectedAttempt ? (
        <ProcessLiveRunDetail
          attempt={selectedAttempt}
          operatorRun={selectedOperatorRun}
          projectRoot={projectRoot}
          internalRowCollapsed={liveInternalRowCollapsed}
          onInternalRowCollapsedChange={onLiveInternalRowCollapsedChange}
          detailRowCollapsed={liveDetailRowCollapsed}
          onDetailRowCollapsedChange={onLiveDetailRowCollapsedChange}
          gapRowCollapsed={liveGapRowCollapsed}
          onGapRowCollapsedChange={onLiveGapRowCollapsedChange}
          eventViewerCollapsed={liveEventViewerCollapsed}
          onEventViewerCollapsedChange={onLiveEventViewerCollapsedChange}
          transcriptCollapsed={liveTranscriptCollapsed}
          onTranscriptCollapsedChange={onLiveTranscriptCollapsedChange}
          onOpenTracePath={onOpenTracePath}
        />
      ) : selectedOperatorRun ? (
        <ProcessSelectedRunSummary operatorRun={selectedOperatorRun} onOpenTracePath={onOpenTracePath} />
      ) : null}

      <ProcessLiveRowGroup
        widgetNames={['Active Run', 'Diagnostics']}
        ariaLabel="active run and diagnostics row"
        collapsed={liveActiveRunRowCollapsed}
        onCollapsedChange={onLiveActiveRunRowCollapsedChange}
        meta={(
          <>
            <span className={`status-chip ${activeRunTone}`}>{liveness?.processAlive === true ? 'alive' : liveness?.processAlive === false ? 'not alive' : 'unknown'}</span>
            <span className={`status-chip ${diagnosticsTone}`}>{analysis?.diagnostics.length ?? 0} diagnostics</span>
          </>
        )}
      >
        <div className="sidecar-live-view__details">
          <section className="sidecar-live-view__detail">
            <div className="requirements-explorer__section-heading">
              <span className="panel__eyebrow">Active Run</span>
              <span className={`status-chip ${activeRunTone}`}>{liveness?.processAlive === true ? 'alive' : liveness?.processAlive === false ? 'not alive' : 'unknown'}</span>
            </div>
            <MetaGrid items={[
              ['Active edge', liveness?.activeEdgeRef ?? latestAttempt?.graphFunctionName ?? selectedOperatorRun?.edge?.edgeName ?? '—'],
              ['Graph vector', liveness?.activeGraphVectorRef ?? latestAttempt?.graphVectorRef ?? selectedOperatorRun?.nextActionProjection?.nextGraphVectorRef ?? '—'],
              ['Target', liveness?.activeTargetAssetType ?? latestAttempt?.targetAssetType ?? selectedOperatorRun?.edge?.targetAssetType ?? '—'],
              ['Worker pid', liveness?.workerPid === null || liveness?.workerPid === undefined ? '—' : String(liveness.workerPid)],
              ['No-output gap', liveness?.maxNoOutputGapMs === null || liveness?.maxNoOutputGapMs === undefined ? '—' : formatDurationMs(liveness.maxNoOutputGapMs)],
              ['Archive growth/min', liveness?.archiveGrowthBytesPerMinute === null || liveness?.archiveGrowthBytesPerMinute === undefined ? '—' : formatBytes(liveness.archiveGrowthBytesPerMinute)],
              ['Last blocking reason', liveness?.lastBlockingReason ?? selectedOperatorRun?.blockingReasons[0]?.code ?? '—'],
            ]} />
          </section>

          <section className="sidecar-live-view__detail">
            <div className="requirements-explorer__section-heading">
              <span className="panel__eyebrow">Diagnostics</span>
              <span className={`status-chip ${diagnosticsTone}`}>
                {analysis?.diagnostics.length ?? 0}
              </span>
            </div>
            {visibleDiagnostics.length ? (
              <ul className="sidecar-live-view__diagnostics">
                {visibleDiagnostics.map((diagnostic) => (
                  <LiveAnalysisDiagnosticRow key={`${diagnostic.code}:${diagnostic.detail}`} diagnostic={diagnostic} onOpenTracePath={onOpenTracePath} />
                ))}
              </ul>
            ) : (
              <div className="sidecar-body-text">No analyze-run diagnostics were reported.</div>
            )}
          </section>
        </div>
      </ProcessLiveRowGroup>
    </div>
  );
}

function ProcessSelectedRunSummary({
  operatorRun,
  onOpenTracePath,
}: {
  operatorRun: SidecarSdlcOperatorRun;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const stageCliCount = operatorRun.stages.reduce((total, stage) => total + stage.processInvocations.length, 0);
  const closureLabel = operatorRun.closureDecision?.disposition ?? operatorRun.status ?? 'open';
  const selectedRunStartedAt = operatorRun.startedAt ?? parseOperatorRunStartedAt(operatorRun.operatorRunPath);
  return (
    <section className="sidecar-live-view__run-detail" aria-label="Selected run detail">
      <header className="sidecar-live-view__run-header">
        <div>
          <span className="panel__eyebrow">Selected Run</span>
          <h4>{operatorRun.edge?.edgeName ?? operatorRun.edge?.graphFunctionName ?? operatorRun.operatorRunId}</h4>
          <p>{operatorRun.operatorRunPath}</p>
        </div>
        <div className="sidecar-live-view__actions">
          <span className={`status-chip ${operatorRun.activeFeedbackLoop ? 'active' : operatorRun.status === 'blocked' ? 'blocked' : 'pending'}`}>{closureLabel}</span>
          <span className="status-chip default" title={selectedRunStartedAt ?? undefined}>
            Started {formatLiveRunStartedAt(selectedRunStartedAt)}
          </span>
          <span className="status-chip default">{stageCliCount} stage CLIs</span>
          <button type="button" className="status-chip default" onClick={() => onOpenTracePath(operatorRun.operatorRunPath)}>
            Open archive
          </button>
        </div>
      </header>
      <MetaGrid items={[
        ['Graph function', operatorRun.edge?.graphFunctionName ?? '—'],
        ['Graph vector', operatorRun.edge?.graphVectorRef ?? operatorRun.nextActionProjection?.nextGraphVectorRef ?? '—'],
        ['Target', operatorRun.edge?.targetAssetType ?? '—'],
        ['Status', operatorRun.status ?? '—'],
      ]} />
    </section>
  );
}

function ProcessLiveRunDetail({
  attempt,
  operatorRun,
  projectRoot,
  internalRowCollapsed,
  onInternalRowCollapsedChange,
  detailRowCollapsed,
  onDetailRowCollapsedChange,
  gapRowCollapsed,
  onGapRowCollapsedChange,
  eventViewerCollapsed,
  onEventViewerCollapsedChange,
  transcriptCollapsed,
  onTranscriptCollapsedChange,
  onOpenTracePath,
}: {
  attempt: SidecarLiveAnalysisAttempt;
  operatorRun: SidecarSdlcOperatorRun | null;
  projectRoot: string | null;
  internalRowCollapsed: boolean;
  onInternalRowCollapsedChange: (collapsed: boolean) => void;
  detailRowCollapsed: boolean;
  onDetailRowCollapsedChange: (collapsed: boolean) => void;
  gapRowCollapsed: boolean;
  onGapRowCollapsedChange: (collapsed: boolean) => void;
  eventViewerCollapsed: boolean;
  onEventViewerCollapsedChange: (collapsed: boolean) => void;
  transcriptCollapsed: boolean;
  onTranscriptCollapsedChange: (collapsed: boolean) => void;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const edge = attempt.detail.edgeAssurance;
  const assurance = attempt.detail.assurance;
  const transformStage = operatorRun?.stages.find((stage) => stage.stageKind === 'transform') ?? null;
  const postflightStage = operatorRun?.stages.find((stage) => stage.stageKind === 'system_postflight') ?? null;
  const evaluatorStage = operatorRun?.stages.find((stage) => stage.stageKind === 'evaluate_review_grade') ?? null;
  const closure = operatorRun?.closureDecision ?? null;
  const nextAction = operatorRun?.nextActionProjection ?? null;
  const activeFeedbackLoop = Boolean(operatorRun?.activeFeedbackLoop);
  const counts = edge?.counts ?? null;
  const outstanding =
    counts === null
      ? null
      : counts.partial + counts.blocked + counts.unfulfilled + counts.missing;
  const gapCount =
    attempt.detail.runtimeGaps.length +
    attempt.detail.diagnostics.length +
    attempt.detail.retryForensics.length +
    (edge?.gapPressureRefs.length ?? 0) +
    (edge?.edgeResidualPressureRefs.length ?? 0);
  const ledgerTone =
    activeFeedbackLoop
      ? 'active'
      : edge?.closeReady === true
      ? 'active'
      : edge?.carrierState === 'absent' || gapCount > 0
        ? 'blocked'
        : 'pending';
  const closureLabel = activeFeedbackLoop
    ? 'retry feedback loop'
    : closure?.disposition ?? edge?.closureDisposition ?? attempt.closureDisposition ?? 'open';
  const selectedRunStartedAt = operatorRun?.startedAt ?? parseOperatorRunStartedAt(attempt.operatorRunPath ?? attempt.operatorRunRef);
  return (
    <section className="sidecar-live-view__run-detail" aria-label="Selected run detail">
      <header className="sidecar-live-view__run-header">
        <div>
          <span className="panel__eyebrow">Selected Run</span>
          <h4>{operatorRun?.edge?.edgeName ?? attempt.graphFunctionName ?? attempt.graphVectorRef ?? 'unmapped edge'}</h4>
          <p>{operatorRun?.operatorRunPath ?? attempt.operatorRunPath ?? attempt.operatorRunRef}</p>
        </div>
        <div className="sidecar-live-view__actions">
          <span className={`status-chip ${ledgerTone}`}>{closureLabel}</span>
          <span className="status-chip default" title={selectedRunStartedAt ?? undefined}>
            Started {formatLiveRunStartedAt(selectedRunStartedAt)}
          </span>
          {operatorRun ? (
            <span className="status-chip default">{operatorRun.stages.reduce((total, stage) => total + stage.processInvocations.length, 0)} stage CLIs</span>
          ) : null}
          {attempt.operatorRunPath ? (
            <button type="button" className="status-chip default" onClick={() => onOpenTracePath(attempt.operatorRunPath as string)}>
              Open archive
            </button>
          ) : null}
        </div>
      </header>

      <ProcessLiveInternalStateWidget
        attempt={attempt}
        operatorRun={operatorRun}
        projectRoot={projectRoot}
        collapsed={internalRowCollapsed}
        onCollapsedChange={onInternalRowCollapsedChange}
        onOpenTracePath={onOpenTracePath}
      />

      <ProcessLiveRowGroup
        widgetNames={['Ledger State', 'Assurance Ledgers']}
        ariaLabel="ledger state and assurance row"
        collapsed={detailRowCollapsed}
        onCollapsedChange={onDetailRowCollapsedChange}
        meta={(
          <>
            <span className={`status-chip ${ledgerTone}`}>{edge?.carrierState ?? 'absent'}</span>
            <span className={`status-chip ${assurance?.missingRequiredDimensions.length ? 'blocked' : assurance ? 'active' : 'default'}`}>
              {assurance?.status ?? 'missing'}
            </span>
          </>
        )}
      >
        <div className="sidecar-live-view__detail-grid sidecar-live-view__detail-grid--primary">
            <section className="sidecar-live-view__detail">
              <div className="requirements-explorer__section-heading">
                <span className="panel__eyebrow">Ledger State</span>
                <span className={`status-chip ${ledgerTone}`}>{edge?.carrierState ?? 'absent'}</span>
              </div>
              <div className="sidecar-live-view__stats sidecar-live-view__stats--compact">
                <span className="sidecar-process-map-stat sidecar-process-map-stat--active">
                  <strong>{counts?.fulfilled ?? '—'}</strong>
                  <small>completed</small>
                </span>
                <span className={`sidecar-process-map-stat ${outstanding && outstanding > 0 ? 'sidecar-process-map-stat--blocked' : ''}`}>
                  <strong>{outstanding ?? '—'}</strong>
                  <small>outstanding</small>
                </span>
                <span className="sidecar-process-map-stat">
                  <strong>{counts?.expected ?? attempt.requirementObligationCount ?? '—'}</strong>
                  <small>expected</small>
                </span>
              </div>
              <MetaGrid items={[
                ['Edge name', operatorRun?.edge?.edgeName ?? attempt.graphFunctionName ?? '—'],
                ['Worker status', transformStage?.status ?? attempt.workerStatus ?? '—'],
                ['Postflight status', postflightStage?.status ?? attempt.postflightStatus ?? '—'],
                ['Evaluator review', evaluatorStage?.status ?? attempt.fpEvaluateStatus ?? '—'],
                ['Closure', closureLabel],
                ['Next lawful action', nextAction?.nextActionBasisKind ?? edge?.nextActionBasisKind ?? attempt.selectedNextActionRef ?? '—'],
                ['Chooses next traversal', nextAction ? formatLiveBoolean(nextAction.choosesNextTraversal) : '—'],
                ['Edge converged', formatLiveBoolean(edge?.edgeConverged)],
                ['Carry converged', formatLiveBoolean(edge?.carryConverged)],
                ['Fulfillment', formatLiveBoolean(edge?.fulfillmentConverged)],
                ['Admitted', formatLiveBoolean(edge?.admitted)],
                ['Target cert', formatLiveBoolean(edge?.targetCertificationPassed)],
                ['F_D recheck', formatLiveBoolean(edge?.fdRecheckPassed)],
                ['Target carrier', edge?.targetAssetType ?? attempt.targetAssetType ?? '—'],
                ['Next graph vector', nextAction?.nextGraphVectorRef ?? edge?.nextGraphVectorRef ?? '—'],
              ]} />
            </section>

            <section className="sidecar-live-view__detail">
              <div className="requirements-explorer__section-heading">
                <span className="panel__eyebrow">Assurance Ledgers</span>
                <span className={`status-chip ${assurance?.missingRequiredDimensions.length ? 'blocked' : assurance ? 'active' : 'default'}`}>
                  {assurance?.status ?? 'missing'}
                </span>
              </div>
              {assurance?.ledgers.length ? (
                <ul className="sidecar-live-view__ledger-list">
                  {assurance.ledgers.map((ledger) => {
                    const description = liveAssuranceLedgerDescription(ledger.dimension);
                    return (
                      <li key={ledger.dimension}>
                        <div className="sidecar-live-view__ledger-head">
                          <strong>{ledger.dimension}</strong>
                          <span
                            className="sidecar-live-view__ledger-info"
                            title={description.detail}
                            aria-label={`${ledger.dimension}: ${description.detail}`}
                            tabIndex={0}
                          >
                            i
                          </span>
                        </div>
                        <span className={`status-chip ${ledger.verdict === 'satisfied' ? 'active' : ledger.verdict === 'blocked' ? 'blocked' : ledger.verdict === 'open_gap' ? 'pending' : 'default'}`}>
                          {ledger.verdict}
                        </span>
                        <p className="sidecar-live-view__ledger-description">{description.summary}</p>
                        <small>{ledger.evidenceRefCount} evidence · {ledger.reasonCount} reasons</small>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="sidecar-body-text">No assurance ledger fold was archived for this run.</div>
              )}
            </section>
        </div>
      </ProcessLiveRowGroup>

      <ProcessLiveRowGroup
        widgetNames={['Gap Analysis', 'Requirement / Stage State']}
        ariaLabel="gap analysis and requirement state row"
        collapsed={gapRowCollapsed}
        onCollapsedChange={onGapRowCollapsedChange}
        meta={(
          <>
            <span className={`status-chip ${gapCount > 0 ? 'blocked' : 'active'}`}>{gapCount} gaps</span>
            <span className={`status-chip ${outstanding && outstanding > 0 ? 'blocked' : counts ? 'active' : 'pending'}`}>
              {counts ? `${counts.fulfilled}/${counts.expected}` : attempt.requirementObligationCount ?? '—'}
            </span>
          </>
        )}
      >
        <div className="sidecar-live-view__detail-grid">
        <section className="sidecar-live-view__detail">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Gap Analysis</span>
            <span className={`status-chip ${gapCount > 0 ? 'blocked' : 'active'}`}>{gapCount}</span>
          </div>
          <LiveAnalysisRunGapList attempt={attempt} edge={edge} operatorRun={operatorRun} />
        </section>

        <section className="sidecar-live-view__detail">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Requirement / Stage State</span>
            <span className={`status-chip ${outstanding && outstanding > 0 ? 'blocked' : counts ? 'active' : 'pending'}`}>
              {counts ? `${counts.fulfilled}/${counts.expected}` : attempt.requirementObligationCount ?? '—'}
            </span>
          </div>
          <MetaGrid items={[
            ['Requirement obligations', attempt.requirementObligationCount === null ? '—' : String(attempt.requirementObligationCount)],
            ['Product lineage', String(attempt.productLineageCount)],
            ['Product files written', String(attempt.productFilesWritten.length)],
            ['Product files replayed', String(attempt.productFilesReplayed.length)],
            ['Residual pressure', String(edge?.edgeResidualPressureRefs.length ?? attempt.residualPressureRefCount)],
            ['Runtime artifacts', attempt.detail.runtimeGaps.length ? `${attempt.detail.runtimeGaps.length} gaps` : 'complete'],
          ]} />
          {attempt.detail.stageCoverage.length ? (
            <ul className="sidecar-live-view__stage-list">
              {attempt.detail.stageCoverage.map((stage) => (
                <li key={`${stage.test35StageRef}:${stage.expectedEdgeName}`}>
                  <strong>{stage.test35StageRef}</strong>
                  <span className={`status-chip ${stage.stageClass === 'missing' ? 'blocked' : stage.stageClass === 'unmapped' ? 'pending' : 'active'}`}>
                    {stage.stageClass}
                  </span>
                  <small>{stage.expectedEdgeName} → {stage.mappedEdgeName ?? 'unmapped'}</small>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        </div>
      </ProcessLiveRowGroup>

      <ProcessLiveEventViewer
        attempt={attempt}
        collapsed={eventViewerCollapsed}
        onCollapsedChange={onEventViewerCollapsedChange}
        onOpenTracePath={onOpenTracePath}
      />

      <ProcessLiveCliTranscriptWidget
        stageProcesses={attempt.detail.stageProcesses ?? []}
        transcripts={attempt.detail.cliTranscripts?.length ? attempt.detail.cliTranscripts : [attempt.detail.cliTranscript]}
        collapsed={transcriptCollapsed}
        onCollapsedChange={onTranscriptCollapsedChange}
        onOpenTracePath={onOpenTracePath}
      />
    </section>
  );
}

type ProcessLiveActionTone = SidecarProcessTone | 'default';

interface ProcessLiveActionLink {
  key: string;
  label: string;
  path: string;
  tone: ProcessLiveActionTone;
}

interface ProcessLiveInternalStep {
  id: string;
  label: string;
  boundary: string;
  status: string;
  tone: ProcessLiveActionTone;
  detail: string;
  actions: ProcessLiveActionLink[];
}

function ProcessLiveInternalStateWidget({ attempt, operatorRun, projectRoot, collapsed, onCollapsedChange, onOpenTracePath }: {
  attempt: SidecarLiveAnalysisAttempt;
  operatorRun: SidecarSdlcOperatorRun | null;
  projectRoot: string | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const stageProcesses = useMemo(() => (attempt.detail.stageProcesses ?? [])
    .map(normalizeLiveAnalysisStageProcess)
    .filter((process): process is SidecarLiveAnalysisStageProcess => Boolean(process)), [attempt.detail.stageProcesses]);
  const transformProcesses = stageProcesses.filter((process) => process.role === 'transform' || process.stageKind === 'transform_worker');
  const evaluationProcesses = stageProcesses.filter((process) => process.role === 'evaluate' || process.stageKind.includes('evaluator'));
  const allTranscripts = stageProcesses.flatMap((process) => process.transcriptSurfaces);
  const primaryTailTranscript = allTranscripts.find((transcript) => transcript.sourcePath && isTailFollowSurfacePath(transcript.sourcePath))
    ?? allTranscripts.find((transcript) => transcript.sourcePath)
    ?? null;
  const allArtifacts = [
    ...(operatorRun?.systemArtifacts ?? []),
    ...(operatorRun?.stages.flatMap((stage) => stage.artifacts) ?? []),
  ];
  const evaluationFindings = [
    ...(operatorRun?.evaluationFindings ?? []),
    ...(operatorRun?.stages.flatMap((stage) => stage.findings) ?? []),
  ];
  const blockingReasons = [
    ...(operatorRun?.blockingReasons ?? []),
    ...(operatorRun?.stages.flatMap((stage) => stage.blockingReasons) ?? []),
  ];
  const events = attempt.detail.events ?? [];
  const runtimeEventCount = events.filter((event) => event.sourceKind === 'runtime_event').length;
  const workerEventCount = events.filter((event) => event.sourceKind === 'worker_event').length;
  const artifactEventCount = events.filter((event) => event.sourceKind === 'artifact').length;
  const transformStage = operatorRun?.stages.find((stage) => stage.stageKind === 'transform') ?? null;
  const postflightStage = operatorRun?.stages.find((stage) => stage.stageKind === 'system_postflight') ?? null;
  const designEvaluationStage = operatorRun?.stages.find((stage) => stage.stageKind === 'evaluate_design_depth') ?? null;
  const reviewEvaluationStage = operatorRun?.stages.find((stage) => stage.stageKind === 'evaluate_review_grade') ?? null;
  const assuranceStage = operatorRun?.stages.find((stage) => stage.stageKind === 'assurance') ?? null;
  const closureStage = operatorRun?.stages.find((stage) => stage.stageKind === 'closure') ?? null;
  const nextActionStage = operatorRun?.stages.find((stage) => stage.stageKind === 'next_action') ?? null;
  const edge = attempt.detail.edgeAssurance;
  const assurance = attempt.detail.assurance;
  const closure = operatorRun?.closureDecision ?? null;
  const nextAction = operatorRun?.nextActionProjection ?? null;
  const operatorRunPath = operatorRun?.operatorRunPath ?? attempt.operatorRunPath ?? null;
  const admissionArtifacts = allArtifacts.filter((artifact) => (
    artifact.role === 'authority_admission' ||
    /admission|postflight|carrier|result/i.test(`${artifact.label} ${artifact.path}`)
  ));
  const readModelArtifacts = allArtifacts.filter((artifact) => artifact.role === 'read_model' || /projection|next_action|consequence/i.test(`${artifact.label} ${artifact.path}`));
  const transformArtifactLinks = uniqueLiveActionLinks([
    ...transformProcesses.flatMap((process) => liveStageProcessLinks(process, projectRoot)),
    ...liveArtifactLinks(admissionArtifacts.slice(0, 3), projectRoot),
  ]);
  const evaluationArtifactLinks = uniqueLiveActionLinks([
    ...evaluationProcesses.flatMap((process) => liveStageProcessLinks(process, projectRoot)),
    ...liveArtifactLinks((operatorRun?.stages.filter((stage) => stage.stageKind.startsWith('evaluate')).flatMap((stage) => stage.artifacts) ?? []).slice(0, 3), projectRoot),
  ]);
  const closureLinks = uniqueLiveActionLinks([
    liveActionLink('Ledger', edge?.ledgerRef ?? null, projectRoot),
    liveActionLink('Closure', edge?.closureDecisionRef ?? closure?.decisionRef ?? null, projectRoot),
    liveActionLink('Next action', edge?.selectedActionRef ?? nextAction?.selectedActionRef ?? null, projectRoot),
  ]);
  const runAssetLinks = uniqueLiveActionLinks([
    liveActionLink('Run archive', operatorRunPath, projectRoot, 'active'),
    liveActionLink('Tail live', primaryTailTranscript?.sourcePath ?? null, projectRoot, 'active'),
    ...stageProcesses.flatMap((process) => liveStageProcessLinks(process, projectRoot)),
    ...liveArtifactLinks(allArtifacts, projectRoot),
  ]).slice(0, 14);
  const productFileLinks = uniqueLiveActionLinks([
    ...attempt.productFilesWritten.map((path) => liveActionLink('Written', path, projectRoot, 'active')),
    ...attempt.productFilesReplayed.map((path) => liveActionLink('Replayed', path, projectRoot)),
  ]).slice(0, 10);
  const steps: ProcessLiveInternalStep[] = [
    {
      id: 'gtl-edge',
      label: 'GTL graph function edge',
      boundary: 'contract',
      status: operatorRun?.edge || attempt.graphFunctionName ? 'selected' : 'pending',
      tone: operatorRun?.edge || attempt.graphFunctionName ? 'active' : 'pending',
      detail: operatorRun?.edge?.edgeName ?? attempt.graphFunctionName ?? attempt.graphVectorRef ?? 'No selected graph edge was projected.',
      actions: uniqueLiveActionLinks([liveActionLink('Archive', operatorRunPath, projectRoot)]),
    },
    {
      id: 'abg-frame-open',
      label: 'ABG start / frame open',
      boundary: 'system event',
      status: runtimeEventCount > 0 ? `${runtimeEventCount} events` : 'pending',
      tone: runtimeEventCount > 0 ? 'active' : 'pending',
      detail: compactIdentity(attempt.operatorRunRef),
      actions: uniqueLiveActionLinks([liveActionLink('Archive', operatorRunPath, projectRoot)]),
    },
    {
      id: 'edge-policy',
      label: 'SDLC EdgePolicy selected',
      boundary: 'policy fact',
      status: edge?.edgeAssuranceContractRef ? 'admitted' : 'pending',
      tone: edge?.edgeAssuranceContractRef ? 'active' : 'pending',
      detail: edge?.edgeAssuranceContractRef ?? operatorRun?.edge?.edgeAssuranceContractRef ?? 'No edge policy carrier was projected.',
      actions: closureLinks.slice(0, 1),
    },
    {
      id: 'composition',
      label: 'ABG selected composition',
      boundary: 'composition',
      status: operatorRun?.edge?.graphVectorRef || attempt.graphVectorRef ? 'selected' : 'pending',
      tone: operatorRun?.edge?.graphVectorRef || attempt.graphVectorRef ? 'active' : 'pending',
      detail: operatorRun?.edge?.graphVectorRef ?? attempt.graphVectorRef ?? 'No graph vector identity was projected.',
      actions: [],
    },
    {
      id: 'transform-plugin',
      label: 'plugin.transform.C',
      boundary: 'plugin',
      status: transformStage?.status ?? attempt.workerStatus ?? (transformProcesses.length ? 'invoked' : 'pending'),
      tone: transformStage?.status === 'failed' ? 'blocked' : transformProcesses.length || transformStage ? 'active' : 'pending',
      detail: `${transformProcesses.length} process invocation${transformProcesses.length === 1 ? '' : 's'} · ${workerEventCount} worker events`,
      actions: transformArtifactLinks.slice(0, 4),
    },
    {
      id: 'transform-admission',
      label: 'system admission/write transform result',
      boundary: 'system write',
      status: postflightStage?.status ?? attempt.postflightStatus ?? (admissionArtifacts.length ? 'recorded' : 'pending'),
      tone: attempt.postflightStatus === 'failed' ? 'blocked' : admissionArtifacts.length || postflightStage ? 'active' : 'pending',
      detail: `${admissionArtifacts.length} admission artifact${admissionArtifacts.length === 1 ? '' : 's'}`,
      actions: liveArtifactLinks(admissionArtifacts.slice(0, 4), projectRoot),
    },
    {
      id: 'evaluation-plan',
      label: 'system plan evaluation set',
      boundary: 'deterministic plan',
      status: designEvaluationStage || reviewEvaluationStage || evaluationFindings.length ? 'planned' : 'pending',
      tone: designEvaluationStage || reviewEvaluationStage || evaluationFindings.length ? 'active' : 'pending',
      detail: `${evaluationFindings.length} finding${evaluationFindings.length === 1 ? '' : 's'} projected`,
      actions: evaluationArtifactLinks.slice(0, 3),
    },
    {
      id: 'evaluate-plugin',
      label: 'plugin.evaluate.C.rule[*]',
      boundary: 'plugin',
      status: reviewEvaluationStage?.status ?? designEvaluationStage?.status ?? attempt.fpEvaluateStatus ?? (evaluationProcesses.length ? 'invoked' : 'pending'),
      tone: evaluationProcesses.length || reviewEvaluationStage || designEvaluationStage ? 'active' : 'pending',
      detail: `${evaluationProcesses.length} evaluator process${evaluationProcesses.length === 1 ? '' : 'es'}`,
      actions: evaluationArtifactLinks.slice(0, 4),
    },
    {
      id: 'evaluation-admission',
      label: 'system admission/write evaluation outcomes',
      boundary: 'system write',
      status: evaluationFindings.length ? `${evaluationFindings.length} outcomes` : 'pending',
      tone: blockingReasons.length ? 'blocked' : evaluationFindings.length ? 'active' : 'pending',
      detail: blockingReasons.length ? `${blockingReasons.length} blocking reason${blockingReasons.length === 1 ? '' : 's'}` : 'No blocking evaluator outcome projected.',
      actions: evaluationArtifactLinks.slice(0, 3),
    },
    {
      id: 'evaluation-collect',
      label: 'system collect evaluation set',
      boundary: 'projection',
      status: assurance ? assurance.status ?? 'collected' : 'pending',
      tone: assurance?.missingRequiredDimensions.length ? 'blocked' : assurance ? 'active' : 'pending',
      detail: assurance ? `${assurance.satisfiedDimensions.length} satisfied · ${assurance.missingRequiredDimensions.length} missing` : 'No assurance summary was projected.',
      actions: closureLinks.slice(0, 1),
    },
    {
      id: 'assurance-fold',
      label: 'system assurance / closure fold',
      boundary: 'deterministic fold',
      status: closure?.disposition ?? edge?.closureDisposition ?? attempt.closureDisposition ?? 'open',
      tone: closure?.disposition === 'close' || edge?.closeReady ? 'converged' : blockingReasons.length ? 'blocked' : edge || closure ? 'active' : 'pending',
      detail: edge ? `${edge.carrierState} · close ready ${formatLiveBoolean(edge.closeReady)}` : 'No edge assurance carrier was projected.',
      actions: closureLinks,
    },
    {
      id: 'consequence-plugin',
      label: 'plugin.consequence.C',
      boundary: 'projection',
      status: nextAction?.nextActionBasisKind ?? nextActionStage?.status ?? 'pending',
      tone: nextAction ? 'active' : 'pending',
      detail: nextAction?.selectedActionRef ?? attempt.selectedNextActionRef ?? 'No next-action projection was selected.',
      actions: uniqueLiveActionLinks([liveActionLink('Next action', nextAction?.selectedActionRef ?? attempt.selectedNextActionRef, projectRoot)]),
    },
    {
      id: 'consequence-admission',
      label: 'system admission/write consequence projection',
      boundary: 'system write',
      status: readModelArtifacts.length ? `${readModelArtifacts.length} read models` : nextAction ? 'admitted' : 'pending',
      tone: nextAction || readModelArtifacts.length ? 'active' : 'pending',
      detail: nextAction?.overlayStopDisposition ?? 'No consequence read model artifact was projected.',
      actions: uniqueLiveActionLinks([
        ...liveArtifactLinks(readModelArtifacts.slice(0, 3), projectRoot),
        liveActionLink('Next action', nextAction?.selectedActionRef ?? null, projectRoot),
      ]),
    },
    {
      id: 'traversal-transition',
      label: 'traversal transition',
      boundary: 'ABG event',
      status: nextAction?.choosesNextTraversal ? 'chosen' : nextAction?.nextGraphVectorRef ? 'projected' : 'pending',
      tone: nextAction?.choosesNextTraversal || nextAction?.nextGraphVectorRef ? 'active' : 'pending',
      detail: nextAction?.nextGraphVectorRef ?? edge?.nextGraphVectorRef ?? 'No next graph vector was projected.',
      actions: [],
    },
  ];

  return (
    <ProcessLiveRowGroup
      widgetNames={['Internal State', 'Run Assets']}
      ariaLabel="internal state and run assets row"
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      className="sidecar-live-view__detail-row-group--wide sidecar-live-view__detail-row-group--internal"
      meta={(
        <>
          <span className="status-chip default">{steps.length} boundaries</span>
          <span className={`status-chip ${runAssetLinks.length ? 'active' : 'default'}`}>{runAssetLinks.length} assets</span>
          <span className={`status-chip ${primaryTailTranscript ? 'active' : 'default'}`}>{primaryTailTranscript ? 'tail ready' : 'no tail'}</span>
        </>
      )}
    >
      <div className="sidecar-live-view__internal-layout">
        <section className="sidecar-live-view__detail sidecar-live-view__detail--wide sidecar-live-view__internal-state">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Internal State</span>
            <span className="status-chip default">{artifactEventCount} artifact events</span>
          </div>
          <ol className="sidecar-live-view__internal-steps" aria-label="Selected run internal boundary state">
            {steps.map((step, index) => (
              <li key={step.id} className={`sidecar-live-view__internal-step sidecar-live-view__internal-step--${step.tone}`}>
                <span className="sidecar-live-view__internal-step-index">{index + 1}</span>
                <div className="sidecar-live-view__internal-step-main">
                  <div className="sidecar-live-view__internal-step-title">
                    <strong>{step.label}</strong>
                    <span className={`status-chip ${step.tone}`}>{step.status}</span>
                  </div>
                  <small>{step.boundary}</small>
                  <p>{step.detail}</p>
                </div>
                {step.actions.length ? (
                  <div className="sidecar-live-view__internal-step-actions">
                    {step.actions.map((action) => (
                      <button key={action.key} type="button" className={`status-chip ${action.tone}`} onClick={() => onOpenTracePath(action.path)}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="sidecar-live-view__detail">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Run Assets</span>
            <span className={`status-chip ${runAssetLinks.length ? 'active' : 'default'}`}>{runAssetLinks.length}</span>
          </div>
          {runAssetLinks.length ? (
            <div className="sidecar-live-view__asset-links" aria-label="Run asset links">
              {runAssetLinks.map((link) => (
                <button key={link.key} type="button" className={`status-chip ${link.tone}`} onClick={() => onOpenTracePath(link.path)}>
                  {link.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="sidecar-body-text">No run asset paths were projected.</div>
          )}
        </section>

        <section className="sidecar-live-view__detail">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Product Files</span>
            <span className={`status-chip ${productFileLinks.length ? 'active' : 'default'}`}>{productFileLinks.length}</span>
          </div>
          {productFileLinks.length ? (
            <div className="sidecar-live-view__asset-links" aria-label="Product file links">
              {productFileLinks.map((link) => (
                <button key={link.key} type="button" className={`status-chip ${link.tone}`} onClick={() => onOpenTracePath(link.path)}>
                  {link.label}
                  <span>{folderDisplayPath(link.path, projectRoot)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="sidecar-body-text">No product files were declared by this run.</div>
          )}
        </section>
      </div>
    </ProcessLiveRowGroup>
  );
}

function liveActionLink(label: string, pathRef: string | null | undefined, projectRoot: string | null, tone: ProcessLiveActionTone = 'default'): ProcessLiveActionLink | null {
  const path = projectPathRefToAbsolutePath(projectRoot, pathRef ?? null);
  if (!path) return null;
  return {
    key: `${label}:${path}`,
    label,
    path,
    tone,
  };
}

function liveStageProcessLinks(stageProcess: SidecarLiveAnalysisStageProcess, projectRoot: string | null): Array<ProcessLiveActionLink | null> {
  const tailTranscript = stageProcess.transcriptSurfaces.find((transcript) => transcript.sourcePath && isTailFollowSurfacePath(transcript.sourcePath))
    ?? stageProcess.transcriptSurfaces.find((transcript) => transcript.sourcePath)
    ?? null;
  return [
    liveActionLink('Archive', stageProcess.operatorRunPath, projectRoot),
    liveActionLink('Started', stageProcess.processStartedPath, projectRoot),
    liveActionLink('Events', stageProcess.processEventsPath, projectRoot),
    liveActionLink('Tail', tailTranscript?.sourcePath ?? null, projectRoot, tailTranscript ? 'active' : 'default'),
  ];
}

function liveArtifactLinks(artifacts: SidecarSdlcOperatorRun['systemArtifacts'], projectRoot: string | null): Array<ProcessLiveActionLink | null> {
  return artifacts.map((artifact) => liveActionLink(artifact.label || artifact.role, artifact.path, projectRoot, artifact.role === 'authority_admission' ? 'active' : 'default'));
}

function uniqueLiveActionLinks(links: Array<ProcessLiveActionLink | null | undefined>) {
  const seen = new Set<string>();
  const next: ProcessLiveActionLink[] = [];
  links.forEach((link) => {
    if (!link || seen.has(link.key)) return;
    seen.add(link.key);
    next.push(link);
  });
  return next;
}

function ProcessLiveEventViewer({ attempt, collapsed, onCollapsedChange, onOpenTracePath }: {
  attempt: SidecarLiveAnalysisAttempt;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const [sourceFilter, setSourceFilter] = useState<SidecarLiveAnalysisEventSourceFilter>('all');
  const [collapsedEventKeys, setCollapsedEventKeys] = useState<Set<string>>(() => new Set());
  const events = attempt.detail.events ?? [];
  const sourceFilters: Array<{ id: SidecarLiveAnalysisEventSourceFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: events.length },
    { id: 'artifact', label: 'Artifacts', count: events.filter((event) => event.sourceKind === 'artifact').length },
    { id: 'runtime_event', label: 'Runtime', count: events.filter((event) => event.sourceKind === 'runtime_event').length },
    { id: 'worker_event', label: 'Worker', count: events.filter((event) => event.sourceKind === 'worker_event').length },
  ];
  const visibleEvents = sourceFilter === 'all'
    ? events
    : events.filter((event) => event.sourceKind === sourceFilter);
  const visibleEventKeys = visibleEvents.map(liveAnalysisEventKey);

  useEffect(() => {
    const currentKeys = new Set(events.map(liveAnalysisEventKey));
    setCollapsedEventKeys((previous) => {
      let changed = false;
      const next = new Set<string>();
      previous.forEach((key) => {
        if (currentKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      return changed ? next : previous;
    });
  }, [events]);

  const setEventCollapsed = (key: string, collapsed: boolean) => {
    setCollapsedEventKeys((previous) => {
      const next = new Set(previous);
      if (collapsed) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const setVisibleEventsCollapsed = (collapsed: boolean) => {
    setCollapsedEventKeys((previous) => {
      const next = new Set(previous);
      visibleEventKeys.forEach((key) => {
        if (collapsed) {
          next.add(key);
        } else {
          next.delete(key);
        }
      });
      return next;
    });
  };

  return (
    <ProcessLiveRowGroup
      widgetNames={['Event Viewer']}
      ariaLabel="event viewer row"
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      className="sidecar-live-view__detail-row-group--wide"
      meta={(
        <>
          <span className={`status-chip ${events.length ? 'active' : 'default'}`}>{visibleEvents.length}/{events.length}</span>
          <span className="status-chip default">{sourceFilter.replace(/_/g, ' ')}</span>
        </>
      )}
    >
      <section className="sidecar-live-view__detail sidecar-live-view__detail--wide sidecar-live-view__event-viewer" aria-label="Stage event viewer">
        <div className="requirements-explorer__section-heading sidecar-live-view__event-heading">
          <p className="sidecar-live-view__event-scope">
            Filtered to {attempt.graphFunctionName ?? attempt.graphVectorRef ?? 'selected stage'} · {attempt.targetAssetType ?? attempt.traversalClass}
          </p>
          <span className={`status-chip ${events.length ? 'active' : 'default'}`}>{visibleEvents.length}/{events.length}</span>
        </div>

        <div className="sidecar-live-view__event-filters" role="tablist" aria-label="Event source filters">
          {sourceFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`process-tab sidecar-live-view__event-filter${sourceFilter === filter.id ? ' is-selected' : ''}`}
              onClick={() => setSourceFilter(filter.id)}
              aria-selected={sourceFilter === filter.id}
              role="tab"
            >
              <span>{filter.label}</span>
              <span className="status-chip default">{filter.count}</span>
            </button>
          ))}
          {visibleEvents.length ? (
            <div className="sidecar-live-view__event-row-actions" aria-label="Event row visibility">
              <button
                type="button"
                className="status-chip default sidecar-live-view__event-row-toggle"
                onClick={() => setVisibleEventsCollapsed(true)}
                aria-label="Collapse all event rows"
                title="Collapse all event rows"
              >
                <span aria-hidden="true">⊟</span>
              </button>
              <button
                type="button"
                className="status-chip default sidecar-live-view__event-row-toggle"
                onClick={() => setVisibleEventsCollapsed(false)}
                aria-label="Expand all event rows"
                title="Expand all event rows"
              >
                <span aria-hidden="true">⊞</span>
              </button>
            </div>
          ) : null}
        </div>

        {visibleEvents.length ? (
          <ol className="sidecar-live-view__event-list" aria-label="Scrollable stage event tickets">
            {visibleEvents.map((event) => {
              const key = liveAnalysisEventKey(event);
              return (
                <ProcessLiveEventTicket
                  key={key}
                  event={event}
                  collapsed={collapsedEventKeys.has(key)}
                  onCollapsedChange={(collapsed) => setEventCollapsed(key, collapsed)}
                  onOpenTracePath={onOpenTracePath}
                />
              );
            })}
          </ol>
        ) : (
          <div className="sidecar-body-text">No archived events matched this selected stage filter.</div>
        )}
      </section>
    </ProcessLiveRowGroup>
  );
}

function liveAnalysisEventKey(event: SidecarLiveAnalysisEvent) {
  return `${event.sourceKind}:${event.index}:${event.eventType}`;
}

function ProcessLiveEventTicket({ event, collapsed, onCollapsedChange, onOpenTracePath }: {
  event: SidecarLiveAnalysisEvent;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const sourcePath = event.sourcePath ? refToAbsolutePath(event.sourcePath) ?? event.sourcePath : null;
  const eventTime = event.observedAtMs ?? event.elapsedMs;
  return (
    <li className={`sidecar-live-view__event-ticket sidecar-live-view__event-ticket--${event.tone}${collapsed ? ' is-collapsed' : ''}`}>
      <header className="sidecar-live-view__event-ticket-header">
        <button
          type="button"
          className="sidecar-live-view__event-ticket-toggle"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${event.title} details`}
          title={`${collapsed ? 'Expand' : 'Collapse'} ${event.title} details`}
        >
          <div className="sidecar-live-view__event-ticket-title">
            <span className="sidecar-live-view__event-index">{event.index + 1}</span>
            <div>
              <strong>{event.title}</strong>
              <small>{event.eventType} · {event.sourceKind.replace(/_/g, ' ')}</small>
            </div>
          </div>
          <div className="sidecar-live-view__event-ticket-actions">
            {eventTime !== null ? <span className="status-chip default">{formatDurationMs(eventTime)}</span> : null}
            <span className={`status-chip ${event.tone}`}>{event.tone}</span>
            <span className="sidecar-live-view__collapsible-chevron" aria-hidden="true">{collapsed ? '>' : 'v'}</span>
          </div>
        </button>
        {sourcePath ? (
          <button type="button" className="status-chip default sidecar-live-view__event-source" onClick={() => onOpenTracePath(sourcePath)}>
            Source
          </button>
        ) : null}
      </header>
      {!collapsed ? (
        <div className="sidecar-live-view__event-ticket-body">
          <p className="sidecar-live-view__event-summary">{event.summary}</p>
          {event.detailRows.length ? (
            <dl className="sidecar-live-view__event-fields">
              {event.detailRows.map((row, rowIndex) => (
                <div key={`${event.index}:${rowIndex}:${row.label}:${row.value}`}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {event.evidenceRefs.length ? (
            <div className="sidecar-live-view__event-evidence" aria-label="Event evidence refs">
              {event.evidenceRefs.map((ref) => {
                const path = refToAbsolutePath(ref);
                return path ? (
                  <button key={ref} type="button" className="status-chip default" onClick={() => onOpenTracePath(path)}>
                    {compactIdentity(ref)}
                  </button>
                ) : (
                  <span key={ref} className="status-chip default">{compactIdentity(ref)}</span>
                );
              })}
            </div>
          ) : null}
          {event.rawPreview ? (
            <details className="sidecar-live-view__event-raw">
              <summary>Raw event payload</summary>
              <pre>{event.rawPreview}</pre>
            </details>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ProcessLiveCliTranscriptWidget({ stageProcesses = [], transcripts, collapsed, onCollapsedChange, onOpenTracePath }: {
  stageProcesses?: SidecarLiveAnalysisStageProcessInput[];
  transcripts: SidecarLiveAnalysisCliTranscriptInput[];
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const transcriptModel = useMemo(() => {
    const normalizedStageProcesses = stageProcesses
      .map(normalizeLiveAnalysisStageProcess)
      .filter((process): process is SidecarLiveAnalysisStageProcess => Boolean(process));
    const fallbackTranscripts = transcripts
      .map(normalizeLiveAnalysisCliTranscript)
      .filter((transcript): transcript is SidecarLiveAnalysisCliTranscript => Boolean(transcript));
    const seen = new Set<string>();
    const processGroups = normalizedStageProcesses.map((process) => {
      const surfaces = process.transcriptSurfaces.filter((surface) => {
        if (seen.has(surface.id)) return false;
        seen.add(surface.id);
        return true;
      });
      return { id: process.id, label: process.label, surfaces };
    });
    const ungroupedSurfaces = fallbackTranscripts.filter((surface) => {
      if (seen.has(surface.id)) return false;
      seen.add(surface.id);
      return true;
    });
    const groups = [
      ...processGroups,
      ...(ungroupedSurfaces.length || !processGroups.length
        ? [{ id: 'ungrouped-transcript-surfaces', label: 'Unattributed transcript surfaces', surfaces: ungroupedSurfaces }]
        : []),
    ].filter((group) => group.surfaces.length || group.id !== 'ungrouped-transcript-surfaces');
    const groupedSurfaces = groups.flatMap((group) => group.surfaces);
    return {
      stageProcesses: normalizedStageProcesses,
      groups,
      transcripts: groupedSurfaces.length ? groupedSurfaces : fallbackTranscripts,
    };
  }, [stageProcesses, transcripts]);
  const normalizedStageProcesses = transcriptModel.stageProcesses;
  const normalizedTranscripts = transcriptModel.transcripts;
  const transcriptGroups = transcriptModel.groups;
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(normalizedTranscripts[0]?.id ?? null);
  const transcript = normalizedTranscripts.find((candidate) => candidate.id === selectedTranscriptId) ?? normalizedTranscripts[0];

  useEffect(() => {
    if (!transcript) {
      if (selectedTranscriptId !== null) setSelectedTranscriptId(null);
      return;
    }
    if (!selectedTranscriptId || !normalizedTranscripts.some((candidate) => candidate.id === selectedTranscriptId)) {
      setSelectedTranscriptId(transcript.id);
    }
  }, [selectedTranscriptId, transcript, normalizedTranscripts]);

  if (!transcript) return null;

  return (
    <ProcessLiveRowGroup
      widgetNames={['Stage Processes', 'Transcript Surfaces']}
      ariaLabel="stage process transcript surfaces row"
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      className="sidecar-live-view__detail-row-group--wide sidecar-live-view__detail-row-group--transcript"
      meta={(
        <>
          <span className={`status-chip ${transcript.sourceKind === 'missing' ? 'default' : 'active'}`}>
            {transcript.lineCount} lines
          </span>
          <span className="status-chip default">{normalizedStageProcesses.length} {normalizedStageProcesses.length === 1 ? 'stage process' : 'stage processes'}</span>
          <span className="status-chip default">{normalizedTranscripts.length} {normalizedTranscripts.length === 1 ? 'surface' : 'surfaces'}</span>
          <span className="status-chip default">{transcript.sourceKind.replace(/_/g, ' ')}</span>
        </>
      )}
    >
      <section className="sidecar-live-view__detail sidecar-live-view__detail--wide sidecar-live-view__detail--transcript" aria-label="Stage process transcript surfaces">
        <div className="sidecar-live-view__transcript-body-wrap">
          <div className="sidecar-live-view__transcript-toolbar">
            {normalizedTranscripts.length > 1 ? (
              <label className="sidecar-live-view__transcript-selector">
                <span>Surface</span>
                <select
                  value={transcript.id}
                  onChange={(event) => setSelectedTranscriptId(event.target.value)}
                  aria-label="Select transcript surface"
                >
                  {transcriptGroups.length ? (
                    transcriptGroups.map((group) => (
                      <optgroup key={group.id} label={group.label}>
                        {group.surfaces.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    normalizedTranscripts.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : (
              <span>{transcript.label}</span>
            )}
            <span>{transcript.role.replace(/_/g, ' ')}</span>
            <span>{transcript.sourceKind.replace(/_/g, ' ')}</span>
            <span>{formatBytes(transcript.byteCount)}</span>
            {transcript.sourcePath ? (
              <button type="button" className="status-chip default" onClick={() => onOpenTracePath(transcript.sourcePath as string)}>
                {isTailFollowSurfacePath(transcript.sourcePath) ? 'Tail raw' : 'Open raw'}
              </button>
            ) : null}
          </div>
          {transcript.lines.length ? (
            <ol className="sidecar-live-view__transcript" aria-label="Scrollable transcript surface">
              {transcript.lines.map((line) => (
                <li key={`${line.index}:${line.eventType}`} className={`sidecar-live-view__transcript-line sidecar-live-view__transcript-line--${line.tone}`}>
                  <span className="sidecar-live-view__transcript-index">{line.index + 1}</span>
                  <div className="sidecar-live-view__transcript-body">
                    <div className="sidecar-live-view__transcript-meta">
                      <span className={`status-chip ${line.tone}`}>{line.label}</span>
                      <small>{line.role ?? line.eventType}</small>
                    </div>
                    <pre>{line.text}</pre>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="sidecar-body-text">No transcript surface was archived for this run.</div>
          )}
        </div>
      </section>
    </ProcessLiveRowGroup>
  );
}

function normalizeLiveAnalysisCliTranscript(transcript: SidecarLiveAnalysisCliTranscriptInput): SidecarLiveAnalysisCliTranscript | null {
  if (!transcript || transcript.kind !== 'sidecar_live_analysis_cli_transcript') return null;
  const sourceKind = isLiveAnalysisTranscriptSourceKind(transcript.sourceKind) ? transcript.sourceKind : 'missing';
  const sourcePath = typeof transcript.sourcePath === 'string' ? transcript.sourcePath : null;
  const role = typeof transcript.role === 'string' && transcript.role.trim()
    ? transcript.role
    : sourceKind === 'missing'
      ? 'missing'
      : 'transform';
  const label = typeof transcript.label === 'string' && transcript.label.trim()
    ? transcript.label
    : defaultLiveCliTranscriptLabel(role, sourceKind);
  const id = typeof transcript.id === 'string' && transcript.id.trim()
    ? transcript.id
    : `cli:${sourcePath ?? label}`;
  return {
    kind: 'sidecar_live_analysis_cli_transcript',
    id,
    label,
    role,
    sourceKind,
    sourcePath,
    byteCount: typeof transcript.byteCount === 'number' && Number.isFinite(transcript.byteCount) ? transcript.byteCount : 0,
    lineCount: typeof transcript.lineCount === 'number' && Number.isFinite(transcript.lineCount) ? transcript.lineCount : 0,
    lines: Array.isArray(transcript.lines) ? transcript.lines : [],
  };
}

function normalizeLiveAnalysisStageProcess(stageProcess: SidecarLiveAnalysisStageProcessInput): SidecarLiveAnalysisStageProcess | null {
  if (!stageProcess || stageProcess.kind !== 'sidecar_live_analysis_stage_process') return null;
  const stageKind = isLiveAnalysisStageProcessKind(stageProcess.stageKind) ? stageProcess.stageKind : 'unknown';
  const label = typeof stageProcess.label === 'string' && stageProcess.label.trim()
    ? stageProcess.label
    : defaultLiveAnalysisStageProcessLabel(stageKind);
  const id = typeof stageProcess.id === 'string' && stageProcess.id.trim()
    ? stageProcess.id
    : `stage-process:${label}`;
  const role = typeof stageProcess.role === 'string' && stageProcess.role.trim()
    ? stageProcess.role
    : stageKind.includes('evaluator')
      ? 'evaluate'
      : stageKind.includes('worker')
        ? 'transform'
        : 'worker';
  const transcriptSurfaces = Array.isArray(stageProcess.transcriptSurfaces)
    ? stageProcess.transcriptSurfaces
      .map(normalizeLiveAnalysisCliTranscript)
      .filter((transcript): transcript is SidecarLiveAnalysisCliTranscript => Boolean(transcript))
    : [];
  return {
    kind: 'sidecar_live_analysis_stage_process',
    id,
    label,
    stageKind,
    role,
    operatorRunPath: typeof stageProcess.operatorRunPath === 'string' ? stageProcess.operatorRunPath : null,
    processStartedPath: typeof stageProcess.processStartedPath === 'string' ? stageProcess.processStartedPath : null,
    processEventsPath: typeof stageProcess.processEventsPath === 'string' ? stageProcess.processEventsPath : null,
    transcriptSurfaces,
  };
}

function isLiveAnalysisTranscriptSourceKind(value: unknown): value is SidecarLiveAnalysisCliTranscript['sourceKind'] {
  return value === 'terminal_transcript'
    || value === 'terminal_screenlog'
    || value === 'process_events'
    || value === 'trace_events'
    || value === 'worker_stdout'
    || value === 'worker_stderr'
    || value === 'last_message'
    || value === 'final_output'
    || value === 'run_summary'
    || value === 'missing';
}

function isLiveAnalysisStageProcessKind(value: unknown): value is SidecarLiveAnalysisStageProcess['stageKind'] {
  return value === 'transform_worker'
    || value === 'design_depth_evaluator'
    || value === 'review_grade_evaluator'
    || value === 'evaluator'
    || value === 'worker'
    || value === 'unknown';
}

function defaultLiveAnalysisStageProcessLabel(stageKind: SidecarLiveAnalysisStageProcess['stageKind']) {
  if (stageKind === 'transform_worker') return 'transform.C/F_P worker';
  if (stageKind === 'design_depth_evaluator') return 'evaluate.C/F_P design depth';
  if (stageKind === 'review_grade_evaluator') return 'evaluate.C/F_P review grade';
  if (stageKind === 'evaluator') return 'evaluate.C/F_P evaluator';
  if (stageKind === 'worker') return 'worker process';
  return 'stage process';
}

function defaultLiveCliTranscriptLabel(role: string, sourceKind: SidecarLiveAnalysisCliTranscript['sourceKind']) {
  const roleLabel = role === 'evaluate'
    ? 'Evaluator'
    : role === 'consequence'
      ? 'Consequence'
      : role === 'human_callout'
        ? 'Human callout'
        : role === 'missing'
          ? 'No'
          : 'Transform';
  if (sourceKind === 'process_events') return `${roleLabel} process events`;
  if (sourceKind === 'trace_events') return `${roleLabel} trace events`;
  if (sourceKind === 'worker_stdout') return `${roleLabel} stdout`;
  if (sourceKind === 'worker_stderr') return `${roleLabel} stderr`;
  if (sourceKind === 'last_message') return `${roleLabel} last message`;
  if (sourceKind === 'final_output') return `${roleLabel} final output`;
  if (sourceKind === 'run_summary') return `${roleLabel} run summary`;
  if (sourceKind === 'missing') return 'No transcript surface';
  if (sourceKind === 'terminal_screenlog') return `${roleLabel} screen log`;
  return `${roleLabel} terminal transcript`;
}

function LiveAnalysisRunGapList({ attempt, edge, operatorRun }: {
  attempt: SidecarLiveAnalysisAttempt;
  edge: SidecarLiveAnalysisAttempt['detail']['edgeAssurance'];
  operatorRun: SidecarSdlcOperatorRun | null;
}) {
  const rows = [
    ...(operatorRun?.blockingReasons ?? []).map((reason) => ({
      key: `blocking:${reason.code}:${reason.detail ?? ''}`,
      tone: reason.retryable ? 'pending' : 'blocked',
      label: reason.code,
      value: reason.retryable ? 'retryable' : 'blocked',
      detail: [
        reason.reasonClass,
        reason.lawfulReentryPoint,
        reason.detail ?? reason.message,
      ].filter(Boolean).join(' · ') || 'blocking reason',
    })),
    ...attempt.detail.runtimeGaps.map((gap) => ({
      key: `gap:${gap.artifact}`,
      tone: gap.status === 'missing' ? 'blocked' : 'pending',
      label: gap.artifact,
      value: gap.status,
      detail: gap.detail ?? 'runtime artifact gap',
    })),
    ...attempt.detail.diagnostics.map((diagnostic) => ({
      key: `diag:${diagnostic.code}:${diagnostic.detail}`,
      tone: diagnostic.severity === 'error' ? 'blocked' : diagnostic.severity === 'warn' ? 'pending' : 'default',
      label: diagnostic.code,
      value: diagnostic.severity,
      detail: diagnostic.detail,
    })),
    ...attempt.detail.retryForensics.map((retry) => ({
      key: `retry:${retry.edgeName}:${retry.likelyCauseClass}`,
      tone: 'pending',
      label: retry.edgeName,
      value: retry.likelyCauseClass,
      detail: retry.blockingReasonCodes.join(', ') || 'retry forensic',
    })),
    ...(edge?.edgeResidualPressureRefs ?? []).map((ref) => ({
      key: `residual:${ref}`,
      tone: 'blocked',
      label: 'residual pressure',
      value: 'open',
      detail: ref,
    })),
    ...(edge?.gapPressureRefs ?? []).map((ref) => ({
      key: `gap-pressure:${ref}`,
      tone: 'pending',
      label: 'gap pressure',
      value: 'carried',
      detail: ref,
    })),
  ] as Array<{ key: string; tone: string; label: string; value: string; detail: string }>;

  if (rows.length === 0) {
    return <div className="sidecar-body-text">No runtime gaps, residual pressure, retry forensic, or diagnostics are attached to this run.</div>;
  }
  return (
    <ul className="sidecar-live-view__gap-list">
      {rows.map((row) => (
        <li key={row.key}>
          <div>
            <strong>{row.label}</strong>
            <span className={`status-chip ${row.tone}`}>{row.value}</span>
          </div>
          <p>{row.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function LiveAnalysisDiagnosticRow({ diagnostic, onOpenTracePath }: {
  diagnostic: SidecarLiveAnalysisDiagnostic;
  onOpenTracePath: (absolutePath: string) => void;
}) {
  const operatorPath = refToAbsolutePath(diagnostic.operatorRunRef);
  return (
    <li className="sidecar-live-view__diagnostic">
      <div>
        <span className={`status-chip ${diagnostic.severity === 'error' ? 'blocked' : diagnostic.severity === 'warn' ? 'pending' : 'default'}`}>{diagnostic.severity}</span>
        <strong>{diagnostic.code}</strong>
      </div>
      <p>{diagnostic.detail}</p>
      {operatorPath ? (
        <button type="button" className="status-chip default" onClick={() => onOpenTracePath(operatorPath)}>
          Run archive
        </button>
      ) : null}
    </li>
  );
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

function compactIdentity(value: string | null) {
  if (!value) return '—';
  if (value.length <= 72) return value;
  return `${value.slice(0, 34)}...${value.slice(-28)}`;
}

function liveAnalysisTone(signal: string) {
  if (signal === 'progressing' || signal === 'completed') return 'active';
  if (signal === 'aborted_or_killed' || signal === 'stalled_no_io' || signal === 'stalled_with_io') return 'blocked';
  return 'pending';
}

function findWorkspaceOperatorRunForAttempt(
  workspaceRun: SidecarSdlcWorkspaceRun | null,
  attempt: SidecarLiveAnalysisAttempt,
) {
  if (!workspaceRun) return null;
  return workspaceRun.operatorRuns.find((operatorRun) => {
    if (attempt.operatorRunPath && operatorRun.operatorRunPath === attempt.operatorRunPath) return true;
    if (attempt.operatorRunRef && attempt.operatorRunRef.endsWith(`/${operatorRun.operatorRunId}`)) return true;
    return false;
  }) ?? null;
}

function liveAttemptTone(attempt: SidecarLiveAnalysisAttempt, operatorRun: SidecarSdlcOperatorRun | null = null) {
  if (operatorRun?.activeFeedbackLoop) return 'active';
  const closureDisposition = operatorRun?.closureDecision?.disposition ?? attempt.closureDisposition;
  if (closureDisposition === 'close') return 'converged';
  if (closureDisposition === 'retry' || closureDisposition === 'repair' || closureDisposition === 're-enter' || closureDisposition === 'reprice' || closureDisposition === 'yield') return 'pending';
  if (attempt.postflightStatus === 'passed' && !closureDisposition) return 'converged';
  if (
    closureDisposition === 'block' ||
    attempt.blockingReasonCodes.length > 0
  ) {
    return 'blocked';
  }
  if (attempt.fpEvaluateStatus || attempt.workerStatus) return 'active';
  return 'pending';
}

function formatLiveBoolean(value: boolean | null | undefined) {
  if (value === true) return 'pass';
  if (value === false) return 'fail';
  return '—';
}

function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
}

function formatLiveRefreshTime(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatLiveRunStartedAt(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

function parseOperatorRunStartedAt(ref: string | null | undefined) {
  if (!ref) return null;
  const token = ref.split('/').filter(Boolean).at(-1) ?? ref;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{0,3})Z(?:_|$)/.exec(token);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction = ''] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.padEnd(3, '0') || '0'),
  ));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${Math.round(value)}B`;
  const kib = value / 1024;
  if (kib < 1024) return `${kib.toFixed(kib < 10 ? 1 : 0)}KiB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib < 10 ? 1 : 0)}MiB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib < 10 ? 1 : 0)}GiB`;
}

function refToAbsolutePath(ref: string | null) {
  if (!ref) return null;
  if (!ref.startsWith('file://')) return ref.startsWith('/') ? ref : null;
  try {
    return decodeURIComponent(new URL(ref).pathname);
  } catch {
    return ref.slice('file://'.length) || null;
  }
}

function projectPathRefToAbsolutePath(projectRoot: string | null, ref: string | null) {
  if (!ref) return null;
  const absolute = refToAbsolutePath(ref);
  if (absolute) return absolute;
  if (!projectRoot) return null;
  const trimmed = ref.trim();
  if (
    !trimmed ||
    trimmed.startsWith('../') ||
    trimmed.includes('\0') ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return null;
  }
  return absoluteProjectPath(projectRoot, trimmed);
}

function isTailFollowSurfacePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const filename = normalized.split('/').pop() ?? normalized;
  return (
    filename === 'terminal.transcript' ||
    filename === 'screenlog.0' ||
    filename.endsWith('.transcript')
  );
}

interface DirectorySurfaceLoad {
  entries: SurfaceEntry[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  loadedAt: number | null;
}

function directorySurfaceLoad(surface: Extract<SurfaceData, { kind: 'directory' }>): DirectorySurfaceLoad {
  return {
    entries: surface.entries,
    loading: false,
    error: null,
    truncated: surface.truncated,
    loadedAt: Date.now(),
  };
}

function directorySurfaceLabel(relativePath: string) {
  const normalized = relativePath.replace(/\/+$/, '');
  if (!normalized || normalized === '.') return '.';
  return normalized.split('/').filter(Boolean).at(-1) ?? normalized;
}

function directorySurfaceGroupKey(relativePath: string) {
  return navigatorGroupKey('surface-directory', relativePath);
}

function DirectorySurfaceBrowser({ projectRoot, surface, dispatch }: {
  projectRoot: string | null;
  surface: Extract<SurfaceData, { kind: 'directory' }>;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const [groupStates, setGroupStates] = useState<Record<string, NavigatorGroupState>>({});
  const [navigatorSort, setNavigatorSort] = useState<NavigatorSortState>({ sort: 'time', reverse: true });
  const [directoryLoads, setDirectoryLoads] = useState<Record<string, DirectorySurfaceLoad>>({
    [surface.relative_path]: directorySurfaceLoad(surface),
  });

  const patchGroup = useCallback((key: string, patch: Partial<NavigatorGroupState>) => {
    setGroupStates((current) => updateNavigatorGroup(current, key, patch));
  }, []);

  const openSurfaceTab = useCallback((relativePath: string) => {
    dispatch({ type: 'select', kind: 'surface', id: relativePath });
  }, [dispatch]);

  const loadDirectory = useCallback(async (relativePath: string) => {
    if (!projectRoot) {
      setDirectoryLoads((current) => ({
        ...current,
        [relativePath]: {
          entries: current[relativePath]?.entries ?? [],
          loading: false,
          error: 'No Project context is available.',
          truncated: false,
          loadedAt: current[relativePath]?.loadedAt ?? null,
        },
      }));
      return;
    }
    setDirectoryLoads((current) => ({
      ...current,
      [relativePath]: {
        entries: current[relativePath]?.entries ?? [],
        loading: true,
        error: null,
        truncated: current[relativePath]?.truncated ?? false,
        loadedAt: current[relativePath]?.loadedAt ?? null,
      },
    }));
    try {
      const params = new URLSearchParams({ workspaceRoot: projectRoot, relativePath });
      const payload = await fetchJson(`/api/surface?${params.toString()}`) as SurfaceData;
      if (payload.kind !== 'directory') {
        throw new Error(`${relativePath} is not a directory surface`);
      }
      setDirectoryLoads((current) => ({
        ...current,
        [relativePath]: directorySurfaceLoad(payload),
      }));
    } catch (err) {
      setDirectoryLoads((current) => ({
        ...current,
        [relativePath]: {
          entries: current[relativePath]?.entries ?? [],
          loading: false,
          error: err instanceof Error ? err.message : String(err),
          truncated: current[relativePath]?.truncated ?? false,
          loadedAt: current[relativePath]?.loadedAt ?? null,
        },
      }));
    }
  }, [projectRoot]);

  const toggleDirectory = useCallback((relativePath: string, collapsed: boolean) => {
    const key = directorySurfaceGroupKey(relativePath);
    const nextCollapsed = !collapsed;
    patchGroup(key, { collapsed: nextCollapsed });
    if (!nextCollapsed && !directoryLoads[relativePath]?.loading && !directoryLoads[relativePath]?.loadedAt) {
      void loadDirectory(relativePath);
    }
  }, [directoryLoads, loadDirectory, patchGroup]);

  useEffect(() => {
    setDirectoryLoads((current) => ({
      ...current,
      [surface.relative_path]: directorySurfaceLoad(surface),
    }));
    setGroupStates((current) => updateNavigatorGroup(current, directorySurfaceGroupKey(surface.relative_path), { collapsed: false }));
  }, [surface]);

  return (
    <div className="sidecar-surface-inspector sidecar-directory-tab" aria-label={`Directory surface ${surface.relative_path}`}>
      <div className="sidecar-directory-tab__header">
        <div>
          <div className="sidecar-inspector__id">{surface.relative_path}</div>
          <h2 className="sidecar-inspector__title">Directory</h2>
        </div>
        <FolderRefreshButton
          label={surface.relative_path}
          loading={directoryLoads[surface.relative_path]?.loading === true}
          loadedAt={directoryLoads[surface.relative_path]?.loadedAt ?? null}
          onRefresh={() => void loadDirectory(surface.relative_path)}
        />
      </div>
      <div className="sidecar-directory-tab__path">
        <FolderPathBreadcrumb
          currentPath={surface.relative_path}
          loading={directoryLoads[surface.relative_path]?.loading === true}
          onNavigate={openSurfaceTab}
        />
      </div>
      <NavigatorSortToolbar
        sort={navigatorSort}
        onSort={(sort) => setNavigatorSort((current) => ({ ...current, sort }))}
        onReverse={() => setNavigatorSort((current) => ({ ...current, reverse: !current.reverse }))}
      />
      <div className="sidecar-folder-tree sidecar-folder-tree--surface-tab">
        <DirectorySurfaceNode
          relativePath={surface.relative_path}
          label={directorySurfaceLabel(surface.relative_path)}
          depth={0}
          groupStates={groupStates}
          directoryLoads={directoryLoads}
          defaultCollapsed={false}
          onPatchGroup={patchGroup}
          onToggle={toggleDirectory}
          onOpenSurface={openSurfaceTab}
          onLoadDirectory={loadDirectory}
          navigatorSort={navigatorSort}
        />
      </div>
    </div>
  );
}

function DirectorySurfaceNode({ relativePath, label, depth, groupStates, directoryLoads, defaultCollapsed = true, onPatchGroup, onToggle, onOpenSurface, onLoadDirectory, navigatorSort }: {
  relativePath: string;
  label: string;
  depth: number;
  groupStates: Record<string, NavigatorGroupState>;
  directoryLoads: Record<string, DirectorySurfaceLoad>;
  defaultCollapsed?: boolean;
  onPatchGroup: (key: string, patch: Partial<NavigatorGroupState>) => void;
  onToggle: (relativePath: string, collapsed: boolean) => void;
  onOpenSurface: (relativePath: string) => void;
  onLoadDirectory: (relativePath: string) => void;
  navigatorSort: NavigatorSortState;
}) {
  const key = directorySurfaceGroupKey(relativePath);
  const group = navigatorGroupState(groupStates, key, { collapsed: defaultCollapsed, sort: 'time', reverse: true });
  const load = directoryLoads[relativePath] ?? null;
  const entries = compareBySort(load?.entries ?? [], { ...group, ...navigatorSort }, (entry) => entry.name, (entry) => entry.name);
  const controls = (
    <>
      <button
        type="button"
        className="sidecar-tree-control sidecar-tree-control--text sidecar-tree-control--open"
        onClick={() => onOpenSurface(relativePath)}
        aria-label={`Open ${relativePath} in a surface tab`}
        title={`Open ${relativePath} in a surface tab`}
      >
        Open
      </button>
      <FolderRefreshButton
        label={relativePath}
        loading={load?.loading === true}
        loadedAt={load?.loadedAt ?? null}
        onRefresh={() => onLoadDirectory(relativePath)}
      />
    </>
  );

  return (
    <div className="sidecar-folder-node sidecar-folder-node--surface-tab" style={{ '--sidecar-tree-depth': depth } as CSSProperties}>
      <NavigatorTreeGroup
        label={label}
        count={entries.length}
        group={group}
        onToggle={() => onToggle(relativePath, group.collapsed)}
        extraControls={controls}
      >
        {load?.loading ? <NavigatorEmptyState>Loading folders...</NavigatorEmptyState> : null}
        {load?.error ? <div className="sidecar-navigator-error">{load.error}</div> : null}
        {load && !load.loading && !load.error && entries.length === 0 ? <NavigatorEmptyState>No child entries.</NavigatorEmptyState> : null}
        {entries.map((entry) => {
          if (entry.kind === 'file') {
            return (
              <button
                key={entry.relative_path}
                type="button"
                className="sidecar-row sidecar-row--surface-file"
                onClick={() => onOpenSurface(entry.relative_path)}
                title={entry.relative_path}
              >
                <div className="sidecar-row__title">{entry.name}</div>
                <div className="sidecar-row__meta">{entry.relative_path}</div>
              </button>
            );
          }
          return (
            <DirectorySurfaceNode
              key={entry.relative_path}
              relativePath={entry.relative_path}
              label={entry.name}
              depth={depth + 1}
              groupStates={groupStates}
              directoryLoads={directoryLoads}
              onPatchGroup={onPatchGroup}
              onToggle={onToggle}
              onOpenSurface={onOpenSurface}
              onLoadDirectory={onLoadDirectory}
              navigatorSort={navigatorSort}
            />
          );
        })}
        {load?.truncated ? <NavigatorEmptyState>Listing truncated.</NavigatorEmptyState> : null}
      </NavigatorTreeGroup>
    </div>
  );
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
  const tailFollowSurface = isTailFollowSurfacePath(relativePath);

  useEffect(() => {
    if (!projectRoot) {
      setSurface(null);
      setError('No Project context is available.');
      return;
    }
    let cancelled = false;
    let refreshTimer: number | null = null;
    const loadSurface = (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams({ workspaceRoot: projectRoot, relativePath });
      void fetchJson(`/api/surface?${params.toString()}`)
        .then((payload) => {
          if (!cancelled) {
            setSurface(payload as SurfaceData);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setSurface(null);
            setError(err instanceof Error ? err.message : String(err));
          }
        })
        .finally(() => {
          if (!cancelled && showLoading) setLoading(false);
        });
    };
    loadSurface(true);
    if (tailFollowSurface && typeof window !== 'undefined') {
      refreshTimer = window.setInterval(() => loadSurface(false), SIDECAR_TAIL_FOLLOW_REFRESH_MS);
    }
    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
    };
  }, [projectRoot, relativePath, tailFollowSurface]);

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
    const sourceUrl = descriptor.format === 'pdf'
      ? surfaceRawUrl(projectRoot, surface.relative_path)
      : undefined;
    return (
      <div className="sidecar-surface-inspector">
        <DocumentViewer
          descriptor={descriptor}
          content={surface.content}
          sourceUrl={sourceUrl}
          state={viewerState}
          scrollMode="outer"
          followAppends={tailFollowSurface}
          onZoomIn={() => dispatch({ type: 'document/zoom', tabId, delta: 0.15 })}
          onZoomOut={() => dispatch({ type: 'document/zoom', tabId, delta: -0.15 })}
          onZoomBy={(delta) => dispatch({ type: 'document/zoom', tabId, delta })}
          onReset={() => dispatch({ type: 'document/reset', tabId })}
          onFitWidth={() => dispatch({ type: 'document/fit-width', tabId })}
        />
      </div>
    );
  }
  if (surface.kind === 'directory') {
    return <DirectorySurfaceBrowser projectRoot={projectRoot} surface={surface} dispatch={dispatch} />;
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

function surfaceRawUrl(projectRoot: string, relativePath: string) {
  const params = new URLSearchParams({ workspaceRoot: projectRoot, relativePath });
  return `/api/surface/raw?${params.toString()}`;
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

function TerminalWorkspace({ state, projectRoot, dispatch, onSpawn, onKill, onRefresh, onCollapse }: {
  state: SidecarState;
  projectRoot: string | null;
  dispatch: Dispatch<SidecarMsg>;
  onSpawn: (groupId?: SidecarTerminalGroupId) => void;
  onKill: (id: string) => void;
  onRefresh: () => void;
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
        <button
          className="ghost agent-console__terminal-action sidecar-terminal-toolbar__refresh"
          type="button"
          disabled={!projectRoot}
          onClick={onRefresh}
        >
          Refresh
        </button>
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
  | { type: 'resize_ack'; cols: number; rows: number; seq?: number | null; duplicate?: boolean }
  | { type: 'resize_error'; message: string; seq?: number | null }
  | { type: 'error'; message: string };

const ODDTERM_RESIZE_DEBOUNCE_MS = 180;
const ODDTERM_RESIZE_MAX_WAIT_MS = 900;
const ODDTERM_RESIZE_MIN_COLS = 20;
const ODDTERM_RESIZE_MIN_ROWS = 6;
const ODDTERM_RESIZE_MAX_COLS = 300;
const ODDTERM_RESIZE_MAX_ROWS = 120;

type PendingTerminalResize = {
  cols: number;
  rows: number;
  seq: number;
};

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
    let pendingResizeTimer: number | null = null;
    let pendingResizeMaxTimer: number | null = null;
    let pendingResize: PendingTerminalResize | null = null;
    let lastSentResize: PendingTerminalResize | null = null;
    let resizeSeq = 0;

    function setConnectionStatus(nextStatus: TerminalStatus) {
      statusRef.current = nextStatus;
      terminal.options.disableStdin = nextStatus !== 'connected';
    }

    function send(payload: Record<string, unknown>) {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(payload));
      return true;
    }

    function clearResizeTimers() {
      if (pendingResizeTimer !== null) {
        window.clearTimeout(pendingResizeTimer);
        pendingResizeTimer = null;
      }
      if (pendingResizeMaxTimer !== null) {
        window.clearTimeout(pendingResizeMaxTimer);
        pendingResizeMaxTimer = null;
      }
    }

    function normalizeTerminalResize(cols: number, rows: number) {
      if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;
      return {
        cols: Math.max(
          ODDTERM_RESIZE_MIN_COLS,
          Math.min(ODDTERM_RESIZE_MAX_COLS, Math.floor(cols)),
        ),
        rows: Math.max(
          ODDTERM_RESIZE_MIN_ROWS,
          Math.min(ODDTERM_RESIZE_MAX_ROWS, Math.floor(rows)),
        ),
      };
    }

    function flushResize() {
      clearResizeTimers();
      const nextResize = pendingResize;
      pendingResize = null;
      if (!nextResize || disposed) return;
      if (lastSentResize?.cols === nextResize.cols && lastSentResize.rows === nextResize.rows) return;
      const sent = send({
        type: 'resize',
        cols: nextResize.cols,
        rows: nextResize.rows,
        seq: nextResize.seq,
      });
      if (sent) {
        lastSentResize = nextResize;
      }
    }

    function queueResize(cols: number, rows: number, immediate = false) {
      const normalized = normalizeTerminalResize(cols, rows);
      if (!normalized) return;
      if (!pendingResize && lastSentResize?.cols === normalized.cols && lastSentResize.rows === normalized.rows) {
        return;
      }

      resizeSeq += 1;
      pendingResize = {
        cols: normalized.cols,
        rows: normalized.rows,
        seq: resizeSeq,
      };

      if (immediate) {
        flushResize();
        return;
      }

      if (pendingResizeTimer !== null) window.clearTimeout(pendingResizeTimer);
      pendingResizeTimer = window.setTimeout(flushResize, ODDTERM_RESIZE_DEBOUNCE_MS);
      if (pendingResizeMaxTimer === null) {
        pendingResizeMaxTimer = window.setTimeout(flushResize, ODDTERM_RESIZE_MAX_WAIT_MS);
      }
    }

    function safeFitAndResize(immediate = false) {
      if (disposed || terminalRef.current !== terminal || !host.isConnected) return;
      try {
        fitAddon.fit();
        queueResize(terminal.cols, terminal.rows, immediate);
      } catch {
        // xterm may not have renderer dimensions during React dev probe mounts.
      }
    }

    function scheduleFitAndResize(immediate = false) {
      if (pendingFitFrame !== null) window.cancelAnimationFrame(pendingFitFrame);
      pendingFitFrame = window.requestAnimationFrame(() => {
        pendingFitFrame = null;
        safeFitAndResize(immediate);
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
      scheduleFitAndResize(true);
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
      if (payload.type === 'resize_ack') {
        return;
      }
      if (payload.type === 'resize_error') {
        if (payload.seq == null || payload.seq === lastSentResize?.seq) {
          lastSentResize = null;
        }
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
      clearResizeTimers();
      pendingResize = null;
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
