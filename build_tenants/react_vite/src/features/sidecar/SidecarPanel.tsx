// SidecarPanel — the real React Project Agent Widget. Closes T-010.
//
// Realizes Project-local Tickets, Comments, Specification, Build Tenants,
// user-pinned folder navigation, terminal
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
} from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import {
  DocumentViewer,
  MarkdownDocumentContent,
  documentDescriptorForPath,
} from '../../components/DocumentViewer';
import { DrillView } from './DrillView';
import type { DrillLane, DrillTone } from './DrillView';
import type { TicketLane, TicketRecord } from '../../contracts/ticket';
import type { CommentRecord } from '../../contracts/comment';
import type { SessionRecord } from '../../contracts/session';
import type { ProjectRecord } from '../../contracts/project';
import type {
  ProjectLandingSurface,
  RunInspectorFocus,
} from '../../lib/projectDeepLink';
import type {
  AiWorkspaceArtifactRecord,
  AiWorkspaceFeatureId,
  AiWorkspaceObservation,
} from '../../contracts/ai-workspace-observation';
import {
  PROJECT_REGISTRY_CHANGED_EVENT,
  setActiveProject,
} from '../../lib/collaboration';
import type { SurfaceData, SurfaceEntry } from '../../lib/types';
import {
  INITIAL_SIDECAR_STATE,
  SIDECAR_EXPLORER_PROVIDERS,
  SIDECAR_MAX_PANE_GROUPS,
  SIDECAR_WORKBENCH_LAYOUT_LIMITS,
  reduceSidecarState,
  sidecarLayoutProfileFromState,
  traversalDetailKey,
} from './sidecar-state';
import {
  AI_WORKSPACE_SUMMARY_FEATURE_IDS,
  aiWorkspaceArtifactLabel,
  aiWorkspaceBrowserSummary,
  aiWorkspacePrimaryCapability,
  isAiWorkspaceObservationForProject,
} from './ai-workspace-browser';
import {
  aiWorkspaceArtifactForRelativePath,
  inspectAiWorkspaceArtifact,
} from './ai-workspace-artifact-inspection';
import type { AiWorkspaceArtifactInspection } from './ai-workspace-artifact-inspection';
import { asAiWorkspaceObservation } from './ai-workspace-observation-validation';
import { asAbgRunObservation } from './abg-run-observation-validation';
import { asTraversalProjection, asTraversalVectorDetail } from './traversal-validation';
import type {
  TraversalVectorDetail,
  TraversalVectorRow,
} from '../../contracts/traversal';
import type {
  AbgRunObservation,
  AbgRunSection,
} from '../../contracts/abg-run-observation';
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
  SidecarTraversalState,
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
  state?: 'present' | 'missing' | 'not_directory';
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
    const [ctx, projects, tickets, comments, sessions, unread, aiWorkspaceObservation] = await Promise.all([
      settleSurface('context', async () => asRecord(await fetchJson(apiUrl(backend, '/api/context', cmd.projectRoot)), 'context') as unknown as ContextRecord),
      settleSurface('projects', async () => asArray<ProjectRecord>(await fetchJson(`${backend}/api/projects`), 'projects')),
      settleSurface('tickets', async () => asArray<TicketRecord>(await fetchJson(apiUrl(backend, '/api/tickets', cmd.projectRoot)), 'tickets')),
      settleSurface('comments', async () => asArray<CommentRecord>(await fetchJson(apiUrl(backend, '/api/comments', cmd.projectRoot)), 'comments')),
      settleSurface('sessions', async () => asSessionCollection(await fetchJson(apiUrl(backend, '/api/sidecar/sessions', cmd.projectRoot)))),
      settleSurface('unread comments', async () => unreadIdsFrom(await fetchJson(apiUrl(backend, '/api/comments/unread', cmd.projectRoot, { agent: viewerAgent })))),
      settleSurface('ai-workspace observation', async () => asAiWorkspaceObservation(await fetchJson(apiUrl(backend, '/api/ai-workspace/observation', cmd.projectRoot)))),
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
    if (aiWorkspaceObservation.ok) payload.aiWorkspaceObservation = aiWorkspaceObservation.value;
    else {
      payload.aiWorkspaceObservation = null;
      errors.push(aiWorkspaceObservation.error);
    }
    if (errors.length > 0) {
      payload.lastAction = { ok: false, error: `load partial: ${errors.join('; ')}` };
    }
    dispatch({ type: 'load/done', projectRoot: cmd.projectRoot, payload });
    return;
  }

  if (cmd.type === 'traversal.loadSummary') {
    const extra: Record<string, string> = {};
    if (cmd.runId) extra.runId = cmd.runId;
    if (cmd.refresh) extra.refresh = '1';
    try {
      const summary = asTraversalProjection(await fetchJson(apiUrl(backend, '/api/ai-workspace/traversal', cmd.workspaceRoot, extra)));
      dispatch({ type: 'traversal/load-succeeded', workspaceRoot: cmd.workspaceRoot, requestedRunId: cmd.runId, summary });
    } catch (err) {
      dispatch({
        type: 'traversal/load-failed',
        workspaceRoot: cmd.workspaceRoot,
        requestedRunId: cmd.runId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (cmd.type === 'run.loadObservation') {
    const extra: Record<string, string> = {};
    if (cmd.runId) extra.runId = cmd.runId;
    if (cmd.refresh) extra.refresh = '1';
    try {
      const observation = asAbgRunObservation(await fetchJson(apiUrl(backend, '/api/ai-workspace/run', cmd.workspaceRoot, extra)));
      dispatch({ type: 'run/load-succeeded', workspaceRoot: cmd.workspaceRoot, requestedRunId: cmd.runId, observation });
    } catch (err) {
      dispatch({
        type: 'run/load-failed',
        workspaceRoot: cmd.workspaceRoot,
        requestedRunId: cmd.runId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (cmd.type === 'traversal.loadVectorDetail') {
    const extra: Record<string, string> = { index: String(cmd.index), variant: cmd.variant };
    if (cmd.attempt !== null) extra.attempt = String(cmd.attempt);
    if (cmd.runId) extra.runId = cmd.runId;
    try {
      const detail = asTraversalVectorDetail(await fetchJson(apiUrl(backend, '/api/ai-workspace/traversal/vector', cmd.workspaceRoot, extra)));
      dispatch({
        type: 'traversal/vector-succeeded',
        workspaceRoot: cmd.workspaceRoot,
        runId: cmd.runId,
        index: cmd.index,
        variant: cmd.variant,
        attempt: cmd.attempt,
        detail,
      });
    } catch (err) {
      dispatch({
        type: 'traversal/vector-failed',
        workspaceRoot: cmd.workspaceRoot,
        runId: cmd.runId,
        index: cmd.index,
        variant: cmd.variant,
        attempt: cmd.attempt,
        error: err instanceof Error ? err.message : String(err),
      });
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
        body: JSON.stringify({ selectedTrainId: 'sidecar', label: cmd.label ?? 'sidecar shell', cwd: cmd.cwd }),
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
        // session/spawn/done already admits the authoritative response. A second
        // full load can race a following spawn and replace both with a stale list.
        reload: false,
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

}

interface SidecarPanelProps {
  onContextChange?: (ctx: ContextRecord) => void;
  backend?: string;
  viewerAgent?: string;
  projectRoot?: string | null;
  initialSurface?: ProjectLandingSurface | null;
  runFocus?: RunInspectorFocus | null;
}

export function SidecarPanel({ onContextChange, backend = SIDECAR_BACKEND, viewerAgent = 'operator', projectRoot = null, initialSurface = null, runFocus = null }: SidecarPanelProps) {
  const [state, dispatch] = useReducer(update, { ...INITIAL_SIDECAR_STATE, viewerAgent });
  const processedCommandIds = useRef<Set<string>>(new Set());
  const loadedLayoutContextKeys = useRef<Set<string>>(new Set());
  const loadedPathHistory = useRef(false);
  const skipNextPathHistorySave = useRef(true);
  const suppressNextLayoutSave = useRef<Set<string>>(new Set());
  const lastSavedLayoutByContext = useRef<Map<string, string>>(new Map());
  const pendingProjectContextRoot = useRef<string | null>(null);
  const openedInitialSurface = useRef(false);
  const runCommand = useCallback((entry: PendingSidecarCmd) => {
    void interpretSidecarCommand(entry.cmd, { backend, viewerAgent, dispatch });
  }, [backend, viewerAgent]);
  const layoutContextKey = state.context ? sidecarLayoutContextKey(state.context) : null;

  useEffect(() => {
    dispatch({ type: 'load/request', projectRoot, reason: 'initial' });
  }, [projectRoot]);

  useEffect(() => {
    dispatch({
      type: 'run/focus-admitted',
      focus: runFocus?.projectRoot === projectRoot ? runFocus : null,
    });
  }, [projectRoot, runFocus]);

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
    if (!initialSurface || state.loading || !state.context) return;
    const contextRoot = state.context.project.root;
    if (projectRoot && normalizePinnedPath(contextRoot) !== normalizePinnedPath(projectRoot)) return;
    if (openedInitialSurface.current) return;
    openedInitialSurface.current = true;
    if (initialSurface === 'run-inspector') {
      if (runFocus) {
        dispatch({ type: 'ui/toggle-workspace', workspace: 'info', collapsed: true });
        dispatch({ type: 'ui/toggle-workspace', workspace: 'shell', collapsed: true });
      }
      dispatch({ type: 'viewer/open', kind: 'traversal', id: contextRoot });
      dispatch({ type: 'traversal/load', workspaceRoot: contextRoot });
      return;
    }
    dispatch({
      type: 'viewer/open',
      kind: initialSurface === 'ticket-board' ? 'ticket-board' : 'ai-workspace',
      id: contextRoot,
    });
  }, [initialSurface, projectRoot, runFocus, state.context, state.loading]);

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

  const handleOpenTraversal = () => {
    dispatch({ type: 'viewer/open', kind: 'traversal', id: currentProjectRoot ?? 'workspace' });
    dispatch({ type: 'traversal/load', workspaceRoot: currentProjectRoot });
  };

  // Ticket Board (sprint W8): records already ride the batch surface load, so
  // opening the board is a pure viewer action — no Cmd needed.
  const handleOpenTicketBoard = () => {
    dispatch({ type: 'viewer/open', kind: 'ticket-board', id: currentProjectRoot ?? 'workspace' });
  };

  // AI Workspace: the observation already rides the batch surface load
  // (state.aiWorkspaceObservation), so opening the viewer is a pure viewer
  // action — no Cmd needed.
  const handleOpenAiWorkspace = () => {
    dispatch({ type: 'viewer/open', kind: 'ai-workspace', id: currentProjectRoot ?? 'workspace' });
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
    dispatchSurfaceSelection(dispatch, currentProjectRoot, relativePath, absolutePath, source);
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
  const railAiWorkspaceObservation = isAiWorkspaceObservationForProject(state.aiWorkspaceObservation, currentProjectRoot)
    ? state.aiWorkspaceObservation
    : null;
  const aiWorkspaceRailValue = railAiWorkspaceObservation
    ? `${railAiWorkspaceObservation.features.filter((feature) => feature.state === 'present').length}/${AI_WORKSPACE_SUMMARY_FEATURE_IDS.length}`
    : 'none';
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
    ?? (state.selection.kind === 'traversal' ? 'Traversal' : null)
    ?? (state.selection.kind === 'ticket-board' ? 'Tickets Board' : null)
    ?? (state.selection.kind === 'ai-workspace' ? 'AI Workspace' : null)
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
              onInfoSurfaceSelect={handleInfoSurfaceSelect}
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
          <ContextRailCommand
            symbol="G"
            label="Open Run Inspector"
            value={state.traversal.summary?.state === 'ready' ? `v${state.traversal.summary.currentVectorIndex ?? '·'}` : 'run'}
            detail="Runtime, graph, traversal, evidence, and artifacts"
            active={state.selection.kind === 'traversal'}
            onClick={handleOpenTraversal}
          />
          <ContextRailCommand
            symbol="T"
            label="Open Ticket Board"
            value={`${state.tickets.length}`}
            detail="Drill View over the workspace tickets surface"
            active={state.selection.kind === 'ticket-board'}
            onClick={handleOpenTicketBoard}
          />
          <ContextRailCommand
            symbol="A"
            label="Open AI Workspace"
            value={aiWorkspaceRailValue}
            detail="Feature-detected .ai-workspace observation"
            active={state.selection.kind === 'ai-workspace'}
            onClick={handleOpenAiWorkspace}
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

function defaultPinnedFolders(_projectRoot: string | null) {
  return [];
}

function builtInNavigatorFolders(projectRoot: string | null) {
  if (!projectRoot) return [];
  return [
    '.ai-workspace/tickets',
    '.ai-workspace/comments',
    'specification',
    'build_tenants',
  ].map((relativePath) => absoluteProjectPath(projectRoot, relativePath));
}

function builtInNavigatorFolderForSurface(surface: SidecarInfoSurface, projectRoot: string | null) {
  if (!projectRoot) return null;
  if (surface === 'tickets') return absoluteProjectPath(projectRoot, '.ai-workspace/tickets');
  if (surface === 'comments') return absoluteProjectPath(projectRoot, '.ai-workspace/comments');
  if (surface === 'specification') return absoluteProjectPath(projectRoot, 'specification');
  if (surface === 'build-tenants') return absoluteProjectPath(projectRoot, 'build_tenants');
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
  const displayParts = display.split('/').filter(Boolean);
  const leaf = displayParts[displayParts.length - 1] ?? display;
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

function dispatchSurfaceSelection(
  dispatch: Dispatch<SidecarMsg>,
  projectRoot: string | null,
  relativePath: string,
  absolutePath?: string,
  source: SidecarPathHistorySource = 'browse',
) {
  dispatch({ type: 'select', kind: 'surface', id: relativePath });
  if (!projectRoot || !absolutePath) return;
  const entry = pathHistoryEntry(projectRoot, absolutePath, source);
  if (entry) dispatch({ type: 'path-history/copy-request', entry });
}

function pathHistorySourceLabel(source: SidecarPathHistorySource) {
  if (source === 'provider') return 'provider';
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
  const stored = groups[key];
  return {
    collapsed: stored?.collapsed ?? fallback.collapsed ?? false,
    sort: stored?.sort ?? fallback.sort ?? 'time',
    reverse: stored?.reverse ?? fallback.reverse ?? true,
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
    state: payload.state === 'missing' || payload.state === 'not_directory' ? payload.state : 'present',
  };
}

function infoSurfaceTitle(surface: SidecarExplorerProviderId) {
  if (surface === 'browse') return 'Browse';
  if (surface === 'history') return 'Recent Paths';
  if (surface === 'comments') return 'Comments';
  if (surface === 'specification') return 'Specification';
  if (surface === 'build-tenants') return 'Build Tenants';
  return 'Tickets';
}

function infoSurfaceCount(surface: SidecarExplorerProviderId, state: SidecarState) {
  if (surface === 'browse') return state.context ? 1 : 0;
  if (surface === 'history') return state.pathHistory.length;
  if (surface === 'comments') return state.comments.length;
  if (surface === 'specification' || surface === 'build-tenants') return 'dir';
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
  dispatch,
  activePinnedFolderPath,
  pinnedFolders,
  headerActions,
  projectRootOverride,
  onPinnedFoldersChange,
  onPinnedFolderUnpin,
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
  onSurfaceSelect: (relativePath: string, absolutePath: string, source: SidecarPathHistorySource) => void;
  onPathHistoryCopy: (entry: SidecarPathHistoryEntry) => void;
  onPathHistoryOpen: (entry: SidecarPathHistoryEntry) => void;
}) {
  const projectRoot = projectRootOverride ?? state.context?.project.root ?? null;
  const [groupStates, setGroupStates] = useState<Record<string, NavigatorGroupState>>({});
  const [navigatorSort, setNavigatorSort] = useState<NavigatorSortState>({ sort: 'time', reverse: true });
  const [pinDraft, setPinDraft] = useState('');
  const [folderLoads, setFolderLoads] = useState<Record<string, NavigatorFolderLoad>>({});
  const projectRootPath = projectRoot ? normalizePinnedPath(projectRoot) : null;
  const builtInFolderPath = builtInNavigatorFolderForSurface(surface, projectRoot);
  const ticketFolderCounts = useMemo(() => {
    if (surface !== 'tickets' || !builtInFolderPath) return undefined;
    const counts: Record<string, number> = {};
    for (const lane of ['active', 'backlog', 'completed'] as TicketLane[]) {
      counts[normalizePinnedPath(`${builtInFolderPath}/${lane}`)] = state.tickets.filter((ticket) => ticket.lane === lane).length;
    }
    return counts;
  }, [builtInFolderPath, state.tickets, surface]);

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
          state: current[path]?.state,
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
          state: current[path]?.state,
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
            folderCounts={ticketFolderCounts}
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
            pathSource="provider"
            pinnedFolders={pinnedFolders}
            onPinFolder={handlePinFolder}
            onUnpinFolder={handleUnpin}
            navigatorSort={navigatorSort}
            folderCounts={ticketFolderCounts}
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
              folderCounts={ticketFolderCounts}
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
      <span className="sidecar-folder-breadcrumb__path" title={currentPath ?? ''}>
        {loading ? 'Loading...' : 'No folder loaded'}
      </span>
    );
  }
  const normalizedCurrent = currentPath ? normalizePinnedPath(currentPath) : null;
  return (
    <nav
      className="sidecar-folder-breadcrumb__path sidecar-folder-breadcrumb"
      aria-label="Current folder path"
      title={currentPath ?? ''}
    >
      {segments.map((segment, index) => {
        const isCurrent = normalizedCurrent === segment.path;
        return (
          <span key={segment.path} className="sidecar-folder-breadcrumb__crumb">
            {index > 0 ? <span className="sidecar-folder-breadcrumb__separator" aria-hidden="true">/</span> : null}
            {isCurrent ? (
              <span className="sidecar-folder-breadcrumb__segment is-current">{segment.label}</span>
            ) : (
              <button
                type="button"
                className="sidecar-folder-breadcrumb__segment"
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

function AiWorkspaceObservationSummary({
  observation,
  onArtifactOpen,
  onFeatureOpen,
  expanded = false,
}: {
  observation: AiWorkspaceObservation;
  onArtifactOpen: (artifact: AiWorkspaceArtifactRecord) => void;
  onFeatureOpen?: (featureId: AiWorkspaceFeatureId) => void;
  expanded?: boolean;
}) {
  const summary = aiWorkspaceBrowserSummary(observation);
  const artifactGroups = summary.artifactGroups.filter((group) => group.featureId !== 'tickets' && group.featureId !== 'comments');
  const visibleArtifactGroups = expanded ? artifactGroups : artifactGroups.slice(0, 6);
  const hiddenArtifactGroupCount = artifactGroups.length - visibleArtifactGroups.length;
  return (
    <section
      className={`sidecar-ai-workspace-summary${expanded ? ' sidecar-ai-workspace-summary--expanded' : ''}`}
      aria-label=".ai-workspace observation summary"
    >
      <div className="sidecar-ai-workspace-summary__header">
        <div>
          <div className="sidecar-row__title">.ai-workspace</div>
          <div className="sidecar-row__meta" title={summary.aiWorkspaceRoot}>{summary.aiWorkspaceRoot}</div>
        </div>
        <div className="sidecar-ai-workspace-summary__stats" aria-label="Observation counts">
          <Pill kind="active">{summary.presentFeatureCount} present</Pill>
          <Pill kind="artifact">{summary.artifactCount} artifacts</Pill>
          <Pill kind="capability">{summary.capabilityCount} capabilities</Pill>
        </div>
      </div>
      <div className="sidecar-ai-workspace-summary__features" aria-label=".ai-workspace feature states">
        {summary.features.map((feature) => {
          const title = `${feature.label}: ${feature.state}, ${feature.artifactCount} artifact${feature.artifactCount === 1 ? '' : 's'}`;
          const navigatorFeature = feature.id === 'tickets' || feature.id === 'comments';
          const className = `sidecar-ai-workspace-summary__feature sidecar-ai-workspace-summary__feature--${safeClassSuffix(feature.state)}${navigatorFeature ? ' is-navigator' : ''}`;
          const content = (
            <>
              <span>{feature.label}</span>
              <strong>{feature.state}</strong>
            </>
          );
          return navigatorFeature && onFeatureOpen ? (
            <button
              key={feature.id}
              type="button"
              className={className}
              onClick={() => onFeatureOpen(feature.id)}
              aria-label={`Open ${feature.label} navigator`}
              title={`Open ${feature.label} navigator. ${title}`}
            >
              {content}
            </button>
          ) : (
            <span key={feature.id} className={className} title={title}>{content}</span>
          );
        })}
      </div>
      {artifactGroups.length > 0 ? (
        <div className="sidecar-ai-workspace-summary__artifact-groups" aria-label=".ai-workspace artifact groups">
          {visibleArtifactGroups.map((group) => {
            const visibleArtifacts = expanded ? group.artifacts : group.artifacts.slice(0, 3);
            const hiddenArtifactCount = group.artifactCount - visibleArtifacts.length;
            return (
              <div key={group.featureId} className="sidecar-ai-workspace-summary__artifact-group">
                <div className="sidecar-ai-workspace-summary__artifact-group-header">
                  <span>{group.label}</span>
                  <strong>{group.artifactCount}</strong>
                </div>
                <small>{group.artifactKinds.join(', ')}</small>
                <div className="sidecar-ai-workspace-summary__artifact-list">
                  {visibleArtifacts.map((artifact) => (
                    <button
                      key={artifact.artifactId}
                      type="button"
                      className="sidecar-ai-workspace-summary__artifact-row"
                      title={artifact.relativePath}
                      onClick={() => onArtifactOpen(artifact)}
                    >
                      <span>{aiWorkspaceArtifactLabel(artifact)}</span>
                      <small>{artifact.artifactKind}</small>
                      <strong>{aiWorkspacePrimaryCapability(artifact)}</strong>
                    </button>
                  ))}
                  {hiddenArtifactCount > 0 ? (
                    <div className="sidecar-ai-workspace-summary__artifact-more">
                      +{hiddenArtifactCount} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {hiddenArtifactGroupCount > 0 ? (
            <div className="sidecar-ai-workspace-summary__artifact-group-more">
              +{hiddenArtifactGroupCount} feature group{hiddenArtifactGroupCount === 1 ? '' : 's'}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function FolderTreeNode({ path, label, depth, projectRoot, groupStates, folderLoads, defaultCollapsed = true, onPatchGroup, onToggle, onSurfaceSelect, pathSource, pinnedFolders, onPinFolder, onUnpinFolder, navigatorSort, folderCounts }: {
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
  folderCounts?: Record<string, number>;
}) {
  const key = navigatorGroupKey('folder', path);
  const group = navigatorGroupState(groupStates, key, { collapsed: defaultCollapsed, sort: 'time', reverse: true });
  const load = folderLoads[path] ?? null;
  const entries = compareBySort(load?.entries ?? [], { ...group, ...navigatorSort }, (entry) => entry.name, folderEntryTime);
  const normalizedPath = normalizePinnedPath(path);
  const isPinned = pinnedFolders.includes(normalizedPath);
  const isBuiltIn = builtInNavigatorFolders(projectRoot).map(normalizePinnedPath).includes(normalizedPath);
  const pinLabel = `${isPinned ? 'Unpin' : 'Pin'} ${label}`;
  const controls = (
    <>
      {!isBuiltIn ? (
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
        count={folderCounts?.[normalizedPath] ?? entries.length}
        group={group}
        onToggle={() => onToggle(key, path, group.collapsed)}
        extraControls={controls}
      >
        {load?.loading ? <NavigatorEmptyState>Loading folders...</NavigatorEmptyState> : null}
        {load?.error ? <div className="sidecar-navigator-error">{load.error}</div> : null}
        {load?.state === 'missing' ? <NavigatorEmptyState>Folder is not present in this Project.</NavigatorEmptyState> : null}
        {load?.state === 'not_directory' ? <NavigatorEmptyState>This Project path is not a folder.</NavigatorEmptyState> : null}
        {load && !load.loading && !load.error && load.state === 'present' && entries.length === 0 ? <NavigatorEmptyState>No child entries.</NavigatorEmptyState> : null}
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
              folderCounts={folderCounts}
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
  if (tab.kind === 'surface') {
    return tab.objectId.split('/').filter(Boolean).pop() ?? tab.objectId;
  }
  if (tab.kind === 'traversal') {
    return 'Run Inspector';
  }
  if (tab.kind === 'ticket-board') {
    return 'Tickets Board';
  }
  if (tab.kind === 'ai-workspace') {
    return 'AI Workspace';
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

function ViewerWorkspace({ state, viewerAgent, dispatch, onInfoSurfaceSelect, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  state: SidecarState;
  viewerAgent: string;
  dispatch: Dispatch<SidecarMsg>;
  onInfoSurfaceSelect: (surface: SidecarInfoSurface) => void;
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
              onInfoSurfaceSelect={onInfoSurfaceSelect}
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

function ViewerGroupPane({ group, state, viewerAgent, active, dispatch, onInfoSurfaceSelect, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  group: SidecarViewerGroup;
  state: SidecarState;
  viewerAgent: string;
  active: boolean;
  dispatch: Dispatch<SidecarMsg>;
  onInfoSurfaceSelect: (surface: SidecarInfoSurface) => void;
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
            onInfoSurfaceSelect={onInfoSurfaceSelect}
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

function ViewerTabBody({ tab, state, viewerAgent, dispatch, onInfoSurfaceSelect, onTransition, onToggleRead, onReplyOpen, onReplyEdit, onReplyCancel, onReplySubmit }: {
  tab: SidecarViewerTab;
  state: SidecarState;
  viewerAgent: string;
  dispatch: Dispatch<SidecarMsg>;
  onInfoSurfaceSelect: (surface: SidecarInfoSurface) => void;
  onTransition: (id: string, lane: string) => void;
  onToggleRead: (id: string, currentlyUnread: boolean) => void;
  onReplyOpen: (id: string) => void;
  onReplyEdit: (body: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (parentId: string, body: string) => void;
}) {
  if (tab.kind === 'surface') {
    return (
      <Inspector>
        <SurfaceInspector
          projectRoot={state.context?.project.root ?? null}
          aiWorkspaceObservation={state.aiWorkspaceObservation}
          tabId={tab.id}
          relativePath={tab.objectId}
          viewerState={state.ui.documentViewers[tab.id]}
          dispatch={dispatch}
        />
      </Inspector>
    );
  }
  if (tab.kind === 'traversal') {
    return (
      <Inspector>
        <RunInspector state={state} dispatch={dispatch} />
      </Inspector>
    );
  }
  if (tab.kind === 'ticket-board') {
    return (
      <Inspector>
        <TicketBoardInspector state={state} dispatch={dispatch} />
      </Inspector>
    );
  }
  if (tab.kind === 'ai-workspace') {
    return (
      <Inspector>
        <AiWorkspaceInspector state={state} dispatch={dispatch} onInfoSurfaceSelect={onInfoSurfaceSelect} />
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

function isTailFollowSurfacePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  const filename = normalized.split('/').pop() ?? normalized;
  return (
    filename === 'terminal.transcript' ||
    filename === 'screenlog.0' ||
    filename === 'stdout.log' ||
    filename === 'stderr.log' ||
    filename.endsWith('_stdout.log') ||
    filename.endsWith('_stderr.log') ||
    filename.endsWith('.transcript')
  );
}

function formatTailSurfaceContent(content: string) {
  const output: string[] = [];
  let hiddenThinkingEvents = 0;
  let formattedEvents = 0;

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parsed = parseJsonRecord(trimmed);
    if (!parsed) {
      output.push(line);
      return;
    }
    if (parsed.type === 'system' && parsed.subtype === 'thinking_tokens') {
      hiddenThinkingEvents += 1;
      return;
    }
    const formatted = formatTailJsonEvent(parsed);
    output.push(formatted ?? line);
    if (formatted) formattedEvents += 1;
  });

  if (hiddenThinkingEvents > 0) {
    output.push(`[filtered ${hiddenThinkingEvents} thinking-token telemetry ${hiddenThinkingEvents === 1 ? 'event' : 'events'}]`);
  }

  if (formattedEvents === 0 && hiddenThinkingEvents === 0) return content;
  return output.join('\n');
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  if (!value.startsWith('{') || !value.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function formatTailJsonEvent(event: Record<string, unknown>) {
  const type = typeof event.type === 'string' ? event.type : 'event';
  const subtype = typeof event.subtype === 'string' ? event.subtype : null;
  const prefix = subtype ? `${type}:${subtype}` : type;
  const message = parseJsonRecordField(event.message);
  const content = message ? formatAgentMessageContent(message.content) : formatAgentMessageContent(event.content);
  const summary = content || formatTailEventSummary(event);
  return summary ? `[${prefix}] ${summary}` : `[${prefix}]`;
}

function parseJsonRecordField(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatAgentMessageContent(value: unknown): string | null {
  if (typeof value === 'string') return preserveTailText(value);
  if (!Array.isArray(value)) return null;
  const parts = value
    .map((part) => {
      if (typeof part === 'string') return preserveTailText(part);
      if (!part || typeof part !== 'object' || Array.isArray(part)) return null;
      const record = part as Record<string, unknown>;
      const kind = typeof record.type === 'string' ? record.type : 'part';
      if (kind === 'thinking') {
        const thinking = typeof record.thinking === 'string' ? compactTailText(record.thinking) : 'thinking block';
        return `thinking ${thinking}`;
      }
      if (typeof record.text === 'string') return preserveTailText(record.text);
      if (typeof record.content === 'string') return preserveTailText(record.content);
      if (kind === 'tool_use') {
        const name = typeof record.name === 'string' ? record.name : 'tool';
        return `tool ${name}${record.input === undefined ? '' : ` ${compactJson(record.input)}`}`;
      }
      if (kind === 'tool_result') {
        return `tool result${record.is_error === true ? ' error' : ''}${record.content === undefined ? '' : ` ${compactJson(record.content)}`}`;
      }
      return `${kind}${compactJson(record) ? ` ${compactJson(record)}` : ''}`;
    })
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join('\n') : null;
}

function formatTailEventSummary(event: Record<string, unknown>) {
  if (event.type === 'system' && event.subtype === 'init') {
    return [
      typeof event.cwd === 'string' ? `cwd ${event.cwd}` : null,
      typeof event.model === 'string' ? `model ${event.model}` : null,
      Array.isArray(event.tools) ? `tools ${event.tools.filter((tool): tool is string => typeof tool === 'string').join(', ')}` : null,
    ].filter((part): part is string => Boolean(part)).join(' · ');
  }
  if (event.type === 'rate_limit_event') {
    const info = parseJsonRecordField(event.rate_limit_info);
    return info
      ? `rate limit ${typeof info.status === 'string' ? info.status : 'updated'}${typeof info.rateLimitType === 'string' ? ` · ${info.rateLimitType}` : ''}`
      : 'rate limit updated';
  }
  if (event.type === 'result') {
    const headline = [
      typeof event.subtype === 'string' ? event.subtype : null,
      typeof event.duration_ms === 'number' ? `${event.duration_ms}ms` : null,
    ].filter((part): part is string => Boolean(part)).join(' · ');
    const result = typeof event.result === 'string' ? preserveTailText(event.result) : null;
    return result ? `${headline}\n${result}` : headline;
  }
  const entries = Object.entries(event)
    .filter(([key]) => !['type', 'subtype', 'uuid', 'session_id'].includes(key))
    .slice(0, 4)
    .map(([key, value]) => `${key}=${compactJson(value)}`);
  return entries.join(' · ');
}

function compactTailText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function preserveTailText(value: string) {
  return value.replace(/\r\n/g, '\n').trim();
}

function compactJson(value: unknown) {
  if (value === null || value === undefined) return '';
  const encoded = typeof value === 'string' ? value : JSON.stringify(value);
  const text = encoded === undefined ? String(value) : encoded;
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
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
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
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

function SurfaceInspector({ projectRoot, aiWorkspaceObservation, tabId, relativePath, viewerState, dispatch }: {
  projectRoot: string | null;
  aiWorkspaceObservation: AiWorkspaceObservation | null;
  tabId: string;
  relativePath: string;
  viewerState: SidecarDocumentViewerState | undefined;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const [surface, setSurface] = useState<SurfaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tailFollowSurface = isTailFollowSurfacePath(relativePath);
  const activeAiWorkspaceObservation = useMemo(
    () => isAiWorkspaceObservationForProject(aiWorkspaceObservation, projectRoot) ? aiWorkspaceObservation : null,
    [aiWorkspaceObservation, projectRoot],
  );
  const [tailFollowEnabled, setTailFollowEnabled] = useState(tailFollowSurface);
  const [rawTailSurface, setRawTailSurface] = useState(false);
  const aiWorkspaceArtifact = useMemo(() => (
    surface?.kind === 'file'
      ? aiWorkspaceArtifactForRelativePath(activeAiWorkspaceObservation, surface.relative_path)
      : null
  ), [activeAiWorkspaceObservation, surface]);
  const artifactInspection = useMemo(() => (
    surface?.kind === 'file' && aiWorkspaceArtifact
      ? inspectAiWorkspaceArtifact(aiWorkspaceArtifact, surface.content)
      : null
  ), [aiWorkspaceArtifact, surface]);

  useEffect(() => {
    setTailFollowEnabled(tailFollowSurface);
    setRawTailSurface(false);
  }, [relativePath, tailFollowSurface]);

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
    if (tailFollowSurface && tailFollowEnabled && typeof window !== 'undefined') {
      refreshTimer = window.setInterval(() => loadSurface(false), SIDECAR_TAIL_FOLLOW_REFRESH_MS);
    }
    return () => {
      cancelled = true;
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
    };
  }, [projectRoot, relativePath, tailFollowSurface, tailFollowEnabled]);

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
    const sourceUrl = descriptor.format === 'pdf' && projectRoot
      ? surfaceRawUrl(projectRoot, surface.relative_path)
      : undefined;
    const renderedContent = tailFollowSurface && !rawTailSurface
      ? formatTailSurfaceContent(surface.content)
      : surface.content;
    return (
      <div className="sidecar-surface-inspector">
        {artifactInspection ? <AiWorkspaceArtifactInspectionPanel inspection={artifactInspection} /> : null}
        <DocumentViewer
          descriptor={descriptor}
          content={renderedContent}
          sourceUrl={sourceUrl}
          state={viewerState}
          scrollMode="outer"
          followAppends={tailFollowSurface && tailFollowEnabled}
          tailFollowAvailable={tailFollowSurface}
          tailFollowEnabled={tailFollowEnabled}
          rawModeAvailable={tailFollowSurface}
          rawModeEnabled={rawTailSurface}
          onZoomIn={() => dispatch({ type: 'document/zoom', tabId, delta: 0.15 })}
          onZoomOut={() => dispatch({ type: 'document/zoom', tabId, delta: -0.15 })}
          onZoomBy={(delta) => dispatch({ type: 'document/zoom', tabId, delta })}
          onReset={() => dispatch({ type: 'document/reset', tabId })}
          onFitWidth={() => dispatch({ type: 'document/fit-width', tabId })}
          onTailFollowToggle={() => setTailFollowEnabled((enabled) => !enabled)}
          onRawModeToggle={() => setRawTailSurface((raw) => !raw)}
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

function AiWorkspaceArtifactInspectionPanel({ inspection }: { inspection: AiWorkspaceArtifactInspection }) {
  const statusKind = inspection.parseKind === 'error'
    ? 'error'
    : inspection.supported
      ? 'active'
      : 'default';
  return (
    <section className="sidecar-ai-artifact-inspection" aria-label=".ai-workspace artifact inspection">
      <div className="sidecar-ai-artifact-inspection__header">
        <div>
          <div className="sidecar-row__title">{inspection.title}</div>
          <div className="sidecar-row__meta">{inspection.summary}</div>
        </div>
        <div className="sidecar-ai-artifact-inspection__pills">
          <Pill kind={statusKind}>{inspection.parseKind}</Pill>
          <Pill kind="artifact">{inspection.artifactKind}</Pill>
          <Pill kind="default">{inspection.featureId}</Pill>
        </div>
      </div>
      {inspection.facts.length > 0 ? <MetaGrid items={inspection.facts.map((fact) => [fact.label, fact.value])} /> : null}
      {inspection.eventKinds.length > 0 ? (
        <div className="sidecar-ai-artifact-inspection__event-kinds" aria-label="Event kind counts">
          {inspection.eventKinds.map((entry) => (
            <span key={entry.kind} className="status-chip default">
              {entry.kind}
              <strong>{entry.count}</strong>
            </span>
          ))}
        </div>
      ) : null}
      {inspection.topLevelKeys.length > 0 ? (
        <div className="sidecar-ai-artifact-inspection__keys">
          {inspection.topLevelKeys.slice(0, 16).join(', ')}
          {inspection.topLevelKeys.length > 16 ? `, +${inspection.topLevelKeys.length - 16} more` : ''}
        </div>
      ) : null}
      {inspection.diagnostics.length > 0 ? (
        <div className="sidecar-ai-artifact-inspection__diagnostics">
          {inspection.diagnostics.map((diagnostic) => (
            <div key={diagnostic}>{diagnostic}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
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

// Traversal View (sprint W7) — restores the retired graph/vector observation
// on the generic observation lane. Bounded summary; per-vector detail is
// fetched lazily on selection through the traversal Cmd family.
function formatTraversalDuration(ms: number | null) {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes}m ${seconds}s`;
  return `${hours}h ${minutes % 60}m ${seconds}s`;
}

function shortSha(value: string | null) {
  if (!value) return '—';
  return value.replace(/^sha256:/, '').slice(0, 12);
}

function traversalVectorTone(vector: TraversalVectorRow): 'ok' | 'fail' | 'pending' {
  if (vector.accepted === true) return 'ok';
  if (vector.accepted === false) return 'fail';
  return 'pending';
}

const RUN_SECTION_ORDER: { id: AbgRunSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'graph', label: 'Graph' },
  { id: 'traversal', label: 'Traversal' },
  { id: 'functions', label: 'Functions' },
  { id: 'catalog', label: 'Catalog' },
  { id: 'assets', label: 'Assets' },
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'assurance', label: 'Assurance' },
  { id: 'events', label: 'Events' },
  { id: 'stages', label: 'Stages' },
  { id: 'transcripts', label: 'Transcripts' },
  { id: 'artifacts', label: 'Artifacts' },
];

function shortRunLabel(run: AbgRunObservation['runs'][number]) {
  const timestamp = run.modifiedAt ? new Date(run.modifiedAt).toLocaleString() : 'undated';
  return `${run.scenarioId ?? run.scenarioKind ?? run.runId} · ${timestamp}`;
}

function projectRelativeArtifactPath(projectRoot: string, path: string) {
  const normalizedRoot = projectRoot.replace(/\/+$/, '');
  return path.startsWith(`${normalizedRoot}/`) ? path.slice(normalizedRoot.length + 1) : null;
}

function BuildForensicFocus({ focus }: { focus: RunInspectorFocus | null }) {
  if (!focus) return null;
  return (
    <section className="sidecar-run__forensic-focus" aria-label="Build forensic context">
      <div><span>Execution</span><code>{focus.executionId}</code></div>
      <div><span>Run reference</span><code>{focus.runRef ?? 'Not published'}</code></div>
      <div><span>Revision</span><code>{focus.revision}</code></div>
      <div><span>Evidence source</span><code>{focus.sourceRef}</code></div>
    </section>
  );
}

function RunInspector({ state, dispatch }: {
  state: SidecarState;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const traversal = state.traversal;
  const projectRoot = state.context?.project.root ?? null;
  const observation = traversal.runObservation?.projectRoot === projectRoot ? traversal.runObservation : null;
  const runFocus = state.runFocus?.projectRoot === projectRoot ? state.runFocus : null;

  useEffect(() => {
    if (!projectRoot || traversal.runStatus !== 'ready') return undefined;
    const timer = window.setInterval(() => {
      dispatch({
        type: 'traversal/load',
        workspaceRoot: projectRoot,
        runId: traversal.selectedRunId,
        refresh: true,
      });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [dispatch, projectRoot, traversal.runStatus, traversal.selectedRunId]);

  if (traversal.workspaceRoot !== null && traversal.workspaceRoot !== projectRoot) {
    return (
      <div className="sidecar-run">
        <BuildForensicFocus focus={runFocus} />
        <div className="sidecar-inspector__empty">Run state belongs to a different Project and has been withheld.</div>
      </div>
    );
  }
  if ((traversal.runStatus === 'idle' || traversal.runStatus === 'loading') && !observation) {
    return (
      <div className="sidecar-run">
        <BuildForensicFocus focus={runFocus} />
        <div className="sidecar-inspector__empty" aria-busy="true">Discovering Project runs and admitted proof carriers...</div>
      </div>
    );
  }
  if (traversal.runStatus === 'error' && !observation) {
    return (
      <div className="sidecar-run sidecar-run--error">
        <BuildForensicFocus focus={runFocus} />
        <div className="sidecar-inspector__id">Run Inspector</div>
        <h2 className="sidecar-inspector__title">Run observation failed</h2>
        <div className="sidecar-traversal__error" role="alert">{traversal.runError ?? 'unknown error'}</div>
        <button type="button" className="secondary sidecar-action-button" onClick={() => dispatch({ type: 'traversal/load', workspaceRoot: projectRoot, refresh: true })}>Retry</button>
      </div>
    );
  }
  if (!observation || observation.state !== 'ready') {
    return (
      <div className="sidecar-run sidecar-run--unsupported">
        <BuildForensicFocus focus={runFocus} />
        <div className="sidecar-inspector__id">{observation?.identity.label ?? 'Run Inspector'}</div>
        <h2 className="sidecar-inspector__title">No admitted run is available</h2>
        {(observation?.diagnostics ?? []).map((entry, index) => (
          <div key={`${entry.code}:${index}`} className={`sidecar-run__diagnostic sidecar-run__diagnostic--${entry.severity}`}>
            <code>{entry.code}</code><span>{entry.message}</span>
          </div>
        ))}
      </div>
    );
  }

  const selectedRun = observation.runs.find((run) => run.runId === observation.selectedRunId) ?? observation.runs[0] ?? null;
  const selectedWorkspaceRoot = observation.selectedWorkspaceRoot;
  const matchingSession = selectedWorkspaceRoot
    ? state.sessions.records.find((session) => session.cwd === selectedWorkspaceRoot && ['running', 'live'].includes(session.status)) ?? null
    : null;
  const openRuntimeTarget = () => {
    dispatch({ type: 'ui/toggle-workspace', workspace: 'shell', collapsed: false });
    if (matchingSession) {
      dispatch({ type: 'terminal/open', sessionId: matchingSession.id });
      return;
    }
    if (selectedWorkspaceRoot) {
      dispatch({
        type: 'session/spawn/request',
        cwd: selectedWorkspaceRoot,
        label: `${selectedRun?.scenarioId ?? 'run'} shell`,
      });
    }
  };

  return (
    <div className="sidecar-run">
      <BuildForensicFocus focus={runFocus} />
      <header className="sidecar-run__header">
        <div className="sidecar-run__identity">
          <div className="sidecar-inspector__id">{observation.identity.id} · admitted run</div>
          <h2 className="sidecar-inspector__title">{selectedRun?.scenarioId ?? selectedRun?.scenarioKind ?? 'Run Inspector'}</h2>
          <div className="sidecar-run__pills">
            <Pill kind={observation.activity?.status === 'converged' ? 'lane-completed' : 'lane-active'}>{observation.activity?.status ?? 'unknown'}</Pill>
            <Pill kind="default">{observation.substrate?.packageVersion ?? 'unversioned substrate'}</Pill>
            <Pill kind="default">{observation.activity?.eventCount ?? 0} events</Pill>
            <Pill kind="default">{observation.activity?.vectorClosedCount ?? 0}/{observation.activity?.vectorPlannedCount ?? 0} closed</Pill>
          </div>
        </div>
        <div className="sidecar-run__controls">
          <label className="sidecar-run__run-select">
            <span>Run</span>
            <select
              aria-label="Select observed run"
              value={traversal.selectedRunId ?? observation.selectedRunId ?? ''}
              onChange={(event) => dispatch({ type: 'run/select', runId: event.target.value })}
            >
              {observation.runs.map((run) => <option key={run.runId} value={run.runId}>{shortRunLabel(run)}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="secondary sidecar-action-button"
            disabled={traversal.runStatus === 'loading'}
            onClick={() => dispatch({ type: 'traversal/load', workspaceRoot: projectRoot, runId: traversal.selectedRunId, refresh: true })}
          >
            {traversal.runStatus === 'loading' ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button" className="secondary sidecar-action-button" disabled={!selectedWorkspaceRoot} onClick={openRuntimeTarget}>
            {matchingSession ? 'Open run shell' : 'New run shell'}
          </button>
        </div>
      </header>

      <nav className="sidecar-run__sections" aria-label="Run observation sections">
        {RUN_SECTION_ORDER.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-pressed={traversal.section === section.id}
            className={traversal.section === section.id ? 'is-active' : ''}
            onClick={() => dispatch({ type: 'run/select-section', section: section.id })}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <div className="sidecar-run__section">
        {traversal.section === 'overview' && <RunOverview observation={observation} />}
        {traversal.section === 'graph' && <RunGraph observation={observation} />}
        {traversal.section === 'traversal' && <TraversalSection traversal={traversal} dispatch={dispatch} />}
        {traversal.section === 'functions' && <RunFunctions observation={observation} />}
        {traversal.section === 'catalog' && <RunCatalog observation={observation} />}
        {traversal.section === 'assets' && <RunAssets observation={observation} />}
        {traversal.section === 'diagnostics' && <RunDiagnostics observation={observation} />}
        {traversal.section === 'assurance' && <RunAssurance observation={observation} />}
        {traversal.section === 'events' && <RunEvents observation={observation} />}
        {traversal.section === 'stages' && <RunStages observation={observation} />}
        {traversal.section === 'transcripts' && <RunTranscripts observation={observation} />}
        {traversal.section === 'artifacts' && <RunArtifacts observation={observation} dispatch={dispatch} />}
      </div>
    </div>
  );
}

function RunOverview({ observation }: { observation: AbgRunObservation }) {
  const activity = observation.activity;
  return (
    <div className="sidecar-run__overview">
      <div className="sidecar-run__metrics" aria-label="Run activity summary">
        <div><strong>{activity?.currentVectorIndex ?? '—'}</strong><span>current vector</span></div>
        <div><strong>{activity?.retryCount ?? 0}</strong><span>retries</span></div>
        <div><strong>{activity?.continuationCount ?? 0}</strong><span>continuations</span></div>
        <div><strong>{activity?.eventKindCount ?? 0}</strong><span>event kinds</span></div>
        <div><strong>{formatTraversalDuration(activity?.durationMs ?? null)}</strong><span>duration</span></div>
      </div>
      <Section title="Runtime">
        <MetaGrid items={[
          ['Project root', observation.projectRoot],
          ['Run root', observation.selectedRunRoot ?? '—'],
          ['Workspace root', observation.selectedWorkspaceRoot ?? '—'],
          ['Started', activity?.startedAt ?? '—'],
          ['Last event', activity?.lastEventAt ?? '—'],
          ['Substrate', observation.substrate?.packageName ?? '—'],
          ['Source commit', observation.substrate?.sourceCommit ?? '—'],
        ]} />
      </Section>
      <Section title="System references">
        <div className="sidecar-run__references">
          {observation.systemReferences.map((reference) => (
            <div key={`${reference.kind}:${reference.ref}`}>
              <span>{reference.kind.replace(/_/g, ' ')}</span>
              <code>{reference.ref}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function RunGraph({ observation }: { observation: AbgRunObservation }) {
  const graphRef = observation.systemReferences.find((reference) => reference.kind === 'graph')?.ref ?? 'unpublished graph';
  const overlayRef = observation.systemReferences.find((reference) => reference.kind === 'overlay')?.ref ?? null;
  return (
    <div className="sidecar-run__graph">
      <div className="sidecar-run__graph-head">
        <code>{graphRef}</code>
        {overlayRef && <Pill kind="stdo-ux">{overlayRef}</Pill>}
      </div>
      <ol className="sidecar-run__graph-chain" aria-label="Observed graph vectors">
        {observation.stages.map((stage) => (
          <li key={stage.vectorIndex} className={`sidecar-run__graph-node sidecar-run__graph-node--${stage.status}`}>
            <span className="sidecar-run__graph-index">v{stage.vectorIndex}</span>
            <div><strong>{stage.edge ?? stage.stage ?? 'unlabelled edge'}</strong><code>{stage.sourceTypeRef ?? '—'} → {stage.targetTypeRef ?? '—'}</code></div>
            <span>{stage.status}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RunFunctions({ observation }: { observation: AbgRunObservation }) {
  return (
    <RunTable headers={['Graph function', 'Selections', 'Calls', 'Frames', 'Vectors']}>
      {observation.functions.map((fn) => (
        <tr key={fn.graphFunctionRef}>
          <td><code>{fn.graphFunctionRef}</code></td><td>{fn.selectedCount}</td><td>{fn.callCount}</td><td>{fn.frameCount}</td><td>{fn.vectorIndexes.length}</td>
        </tr>
      ))}
    </RunTable>
  );
}

function RunCatalog({ observation }: { observation: AbgRunObservation }) {
  const catalog = observation.catalog;
  const [query, setQuery] = useState('');
  const [entryKind, setEntryKind] = useState('all');
  const availableKinds = useMemo(() => catalog.entryKindCounts.map((entry) => entry.kind), [catalog.entryKindCounts]);

  useEffect(() => {
    if (entryKind !== 'all' && !availableKinds.includes(entryKind)) setEntryKind('all');
  }, [availableKinds, entryKind]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.entries.filter((entry) => {
      if (entryKind !== 'all' && entry.entryKind !== entryKind) return false;
      if (!normalizedQuery) return true;
      return [
        entry.name,
        entry.entryRef,
        entry.declarationRef,
        entry.graphFunctionRef,
        entry.templateRef,
        ...entry.tags,
        ...entry.inputTypeRefs,
        ...entry.outputTypeRefs,
        ...entry.declarationKeys,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [catalog.entries, entryKind, query]);

  if (catalog.state === 'missing') {
    return <div className="sidecar-inspector__empty">No ABG catalog events are published by this run.</div>;
  }

  return (
    <div className="sidecar-run__catalog" role="region" aria-label="ABG catalog">
      <div className="sidecar-run__metrics" aria-label="ABG catalog summary">
        <div><strong>{catalog.entryCount}</strong><span>unique entries</span></div>
        <div><strong>{catalog.admissionEventCount}</strong><span>admissions</span></div>
        <div><strong>{catalog.entryKindCounts.length}</strong><span>entry kinds</span></div>
        <div><strong>{catalog.rejectedEventCount}</strong><span>rejected</span></div>
        <div><strong>{catalog.constructionCatalogs.length}</strong><span>action catalogs</span></div>
      </div>

      <div className="sidecar-run__catalog-toolbar">
        <label>
          <span>Filter</span>
          <input
            type="search"
            aria-label="Filter ABG catalog"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="sidecar-run__catalog-kinds" role="group" aria-label="Catalog entry kind">
          <button type="button" aria-pressed={entryKind === 'all'} className={entryKind === 'all' ? 'is-active' : ''} onClick={() => setEntryKind('all')}>
            All {catalog.entryCount}
          </button>
          {catalog.entryKindCounts.map((entry) => (
            <button key={entry.kind} type="button" aria-pressed={entryKind === entry.kind} className={entryKind === entry.kind ? 'is-active' : ''} onClick={() => setEntryKind(entry.kind)}>
              {entry.kind.replace(/_/g, ' ')} {entry.count}
            </button>
          ))}
        </div>
        {catalog.truncated && <Pill kind="cat-defect">bounded result</Pill>}
      </div>

      {filteredEntries.length === 0 ? (
        <div className="sidecar-inspector__empty">No catalog entries match the current filter.</div>
      ) : (
        <RunTable headers={['Kind', 'Entry', 'Type flow', 'Declaration / template', 'Admissions', 'Source events']}>
          {filteredEntries.map((entry) => (
            <tr key={entry.projectionKey}>
              <td><Pill kind="default">{entry.entryKind.replace(/_/g, ' ')}</Pill></td>
              <td><strong>{entry.name}</strong>{entry.entryRef && entry.entryRef !== entry.name && <code>{entry.entryRef}</code>}</td>
              <td>
                <code>{entry.inputTypeRefs.join(', ') || '—'}</code>
                <span>→</span>
                <code>{entry.outputTypeRefs.join(', ') || '—'}</code>
              </td>
              <td>
                <code>{entry.declarationKeys.join(', ') || entry.templateRef || entry.declarationRef || '—'}</code>
              </td>
              <td>
                <strong>{entry.admissionCount}</strong>
                {entry.variantCount > 1 && <Pill kind="cat-defect">{entry.variantCount} variants</Pill>}
              </td>
              <td><code>{entry.sourceEventIndexes.map((index) => `#${index}`).join(' · ') || '—'}</code></td>
            </tr>
          ))}
        </RunTable>
      )}

      {catalog.rejectedEntries.length > 0 && (
        <Section title="Rejected admissions">
          <RunTable headers={['Kind', 'Entry / declaration', 'Reason', 'Conflicts', 'Source event']}>
            {catalog.rejectedEntries.map((entry, index) => (
              <tr key={`${entry.sourceEventIndex ?? 'unknown'}:${index}`}>
                <td><Pill kind="cat-defect">{entry.entryKind.replace(/_/g, ' ')}</Pill></td>
                <td><code>{entry.entryRef ?? entry.declarationRef ?? '—'}</code></td>
                <td>{entry.rejectionReason ?? '—'}</td>
                <td><code>{entry.conflictingEntryRefs.join(', ') || '—'}</code></td>
                <td>{entry.sourceEventIndex === null ? '—' : `#${entry.sourceEventIndex}`}</td>
              </tr>
            ))}
          </RunTable>
        </Section>
      )}

      {catalog.constructionCatalogs.length > 0 && (
        <Section title="Construction action catalogs">
          <RunTable headers={['Catalog', 'Episode', 'Hook resolution', 'Traversal publications', 'Admissions']}>
            {catalog.constructionCatalogs.map((entry) => (
              <tr key={entry.catalogRef}>
                <td><code>{entry.catalogRef}</code></td>
                <td><code>{entry.episodeId ?? '—'}</code></td>
                <td><code>{entry.hookResolutionRef ?? '—'}</code></td>
                <td><code>{entry.traversalPublicationRefs.join(', ') || '—'}</code></td>
                <td>{entry.admissionCount}</td>
              </tr>
            ))}
          </RunTable>
        </Section>
      )}

      <code className="sidecar-run__source-ref">{catalog.sourceRef ?? 'catalog source unavailable'}</code>
    </div>
  );
}

function RunAssets({ observation }: { observation: AbgRunObservation }) {
  return (
    <RunTable headers={['Asset', 'Producer', 'Target type', 'Bytes', 'Digest']}>
      {observation.assets.map((asset, index) => (
        <tr key={`${asset.producerVectorIndex}:${asset.path}:${index}`}>
          <td><code>{asset.path}</code></td>
          <td>v{asset.producerVectorIndex} · {asset.producerStage ?? '—'}</td>
          <td><code>{asset.targetTypeRef ?? '—'}</code></td>
          <td>{asset.byteLength ?? '—'}</td>
          <td><code>{shortSha(asset.sha256)}</code></td>
        </tr>
      ))}
    </RunTable>
  );
}

function RunDiagnostics({ observation }: { observation: AbgRunObservation }) {
  if (observation.diagnostics.length === 0) return <div className="sidecar-inspector__empty">No run diagnostics are projected.</div>;
  return (
    <div className="sidecar-run__diagnostics">
      {observation.diagnostics.map((entry, index) => (
        <div key={`${entry.code}:${entry.vectorIndex ?? 'run'}:${index}`} className={`sidecar-run__diagnostic sidecar-run__diagnostic--${entry.severity}`}>
          <div><code>{entry.code}</code>{entry.vectorIndex !== undefined && <Pill kind="default">v{entry.vectorIndex}</Pill>}</div>
          <span>{entry.message}</span>
          {entry.sourceRef && <code className="sidecar-run__source-ref">{entry.sourceRef}</code>}
        </div>
      ))}
    </div>
  );
}

function RunAssurance({ observation }: { observation: AbgRunObservation }) {
  const assurance = observation.assurance;
  if (!assurance) return <div className="sidecar-inspector__empty">No assurance carriers are available for this run.</div>;
  return (
    <div className="sidecar-run__assurance">
      <div className="sidecar-run__metrics">
        <div><strong>{assurance.evidenceAdmittedCount}</strong><span>evidence admitted</span></div>
        <div><strong>{assurance.requirementReachedCount}/{assurance.requirementCount}</strong><span>requirements reached</span></div>
        <div><strong>{assurance.testPassCount ?? '—'}</strong><span>tests passed</span></div>
        <div><strong>{assurance.depthProofRowCount}</strong><span>depth rows</span></div>
        <div><strong>{assurance.mutationKillCount}/{assurance.mutationCount}</strong><span>mutations killed</span></div>
      </div>
      <Section title="Admission">
        <MetaGrid items={[
          ['Payload observed', String(assurance.payloadObservedCount)],
          ['Payload validated', String(assurance.payloadValidatedCount)],
          ['Calls judged', String(assurance.judgedCallCount)],
          ['Test exit', assurance.testStatus === null ? '—' : String(assurance.testStatus)],
          ['Restore mismatches', String(assurance.mutationRestoreMismatchCount)],
          ['Depth classes', assurance.depthClasses.join(', ') || '—'],
        ]} />
      </Section>
      {assurance.testReports.length > 0 && (
        <RunTable headers={['Test report', 'Tests', 'Failures', 'Errors', 'Skipped']}>
          {assurance.testReports.map((report) => (
            <tr key={report.path}><td><code>{report.path}</code></td><td>{report.tests}</td><td>{report.failures}</td><td>{report.errors}</td><td>{report.skipped}</td></tr>
          ))}
        </RunTable>
      )}
    </div>
  );
}

function RunEvents({ observation }: { observation: AbgRunObservation }) {
  return (
    <div className="sidecar-run__events-layout">
      <aside className="sidecar-run__event-kinds" aria-label="Event kind counts">
        {observation.eventKinds.map((entry) => <div key={entry.kind}><code>{entry.kind}</code><strong>{entry.count}</strong></div>)}
      </aside>
      <RunTable headers={['#', 'Time', 'Kind', 'Vector', 'Edge', 'Detail']}>
        {observation.events.map((event) => (
          <tr key={event.index}><td>{event.index}</td><td>{event.eventTime ?? '—'}</td><td><code>{event.kind}</code></td><td>{event.vectorIndex === null ? '—' : `v${event.vectorIndex}`}</td><td><code>{event.edge ?? '—'}</code></td><td>{event.detail ?? '—'}</td></tr>
        ))}
      </RunTable>
    </div>
  );
}

function RunStages({ observation }: { observation: AbgRunObservation }) {
  return (
    <RunTable headers={['Vector', 'Stage / edge', 'Type flow', 'Attempts', 'Timing', 'Process trace', 'State']}>
      {observation.stages.map((stage) => (
        <tr key={stage.vectorIndex}>
          <td>v{stage.vectorIndex}</td>
          <td><strong>{stage.stage ?? '—'}</strong><code>{stage.edge ?? '—'}</code></td>
          <td><code>{stage.sourceTypeRef ?? '—'} → {stage.targetTypeRef ?? '—'}</code></td>
          <td>{stage.attemptCount}{stage.hasEvaluator ? ' + eval' : ''}</td>
          <td>{formatTraversalDuration(stage.durationMs)}</td>
          <td><code>{stage.processEventRef ?? '—'}</code></td>
          <td><Pill kind={stage.status === 'accepted' ? 'lane-completed' : stage.status === 'rejected' ? 'cat-defect' : 'lane-active'}>{stage.status}</Pill></td>
        </tr>
      ))}
    </RunTable>
  );
}

function RunTranscripts({ observation }: { observation: AbgRunObservation }) {
  if (observation.transcripts.length === 0) return <div className="sidecar-inspector__empty">No bounded transcript carriers are available.</div>;
  return (
    <div className="sidecar-run__transcripts">
      {observation.transcripts.map((transcript, index) => (
        <details key={transcript.transcriptId} open={index === 0}>
          <summary><strong>{transcript.label}</strong><span>{transcript.kind}{transcript.vectorIndex === null ? '' : ` · v${transcript.vectorIndex}`}</span></summary>
          <code className="sidecar-run__source-ref">{transcript.sourceRef}</code>
          <pre>{transcript.contentPreview}{transcript.truncated ? '\n[preview truncated]' : ''}</pre>
        </details>
      ))}
    </div>
  );
}

function RunArtifacts({ observation, dispatch }: { observation: AbgRunObservation; dispatch: Dispatch<SidecarMsg> }) {
  return (
    <RunTable headers={['Role', 'Artifact', 'Size', 'Modified', 'Digest', 'Open']}>
      {observation.artifacts.map((artifact) => {
        const relativePath = projectRelativeArtifactPath(observation.projectRoot, artifact.path);
        return (
          <tr key={`${artifact.role}:${artifact.path}`}>
            <td><Pill kind="default">{artifact.role.replace(/_/g, ' ')}</Pill></td>
            <td><code>{relativePath ?? artifact.path}</code></td>
            <td>{artifact.sizeBytes ?? '—'}</td>
            <td>{artifact.modifiedAt ?? '—'}</td>
            <td>
              {artifact.digestState !== 'not_applicable' ? (
                <span className="sidecar-run__digest">
                  <Pill kind={artifact.digestState === 'verified' ? 'lane-completed' : artifact.digestState === 'mismatch' ? 'cat-defect' : 'default'}>{artifact.digestState.replace(/_/g, ' ')}</Pill>
                  <code>{shortSha(artifact.observedDigest ?? artifact.digest)}</code>
                </span>
              ) : '—'}
            </td>
            <td><button type="button" className="secondary sidecar-action-button" disabled={!relativePath || artifact.role === 'vector_artifacts'} onClick={() => relativePath && dispatch({ type: 'select', kind: 'surface', id: relativePath })}>Open</button></td>
          </tr>
        );
      })}
    </RunTable>
  );
}

function RunTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="sidecar-run__table-scroll">
      <table className="sidecar-run__table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table>
    </div>
  );
}

function TraversalSection({ traversal, dispatch }: {
  traversal: SidecarTraversalState;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const summary = traversal.summary;
  if (traversal.status === 'idle') {
    return <div className="sidecar-inspector__empty">Open the Traversal View from the context rail to load the active run.</div>;
  }
  if (traversal.status === 'loading' && !summary) {
    return <div className="sidecar-inspector__empty" aria-busy="true">Loading traversal projection…</div>;
  }
  if (traversal.status === 'error') {
    return (
      <div className="sidecar-traversal sidecar-traversal--error">
        <div className="sidecar-inspector__id">Traversal</div>
        <h2 className="sidecar-inspector__title">Traversal projection failed</h2>
        <div className="sidecar-traversal__error" role="alert">{traversal.error ?? 'unknown error'}</div>
        <div className="sidecar-actions">
          <button
            type="button"
            className="secondary sidecar-action-button"
            onClick={() => dispatch({ type: 'traversal/load', workspaceRoot: traversal.workspaceRoot })}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!summary) {
    return <div className="sidecar-inspector__empty">No traversal projection is loaded.</div>;
  }
  if (summary.state !== 'ready') {
    return (
      <div className="sidecar-traversal sidecar-traversal--unsupported">
        <div className="sidecar-inspector__id">Traversal</div>
        <h2 className="sidecar-inspector__title">No traversal run for this workspace</h2>
        <Pill kind="default">{summary.state}</Pill>
        <div className="sidecar-traversal__diagnostics">
          {summary.diagnostics.length === 0
            ? <div className="sidecar-body-text">The workspace does not contain a recognisable run topology (proof JSON plus sandbox identity).</div>
            : summary.diagnostics.map((entry, index) => (
              <div key={`${entry.code}:${index}`} className={`sidecar-traversal__diagnostic sidecar-traversal__diagnostic--${entry.severity}`}>
                <code>{entry.code}</code>
                <span>{entry.message}</span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  const selection = traversal.selectedVector;
  const selectionKey = selection
    ? traversalDetailKey(selection.index, selection.variant, selection.attempt, traversal.selectedRunId)
    : null;
  const detailEntry = selectionKey
    ? traversal.details.find((entry) => entry.key === selectionKey) ?? null
    : null;

  return (
    <div className="sidecar-traversal">
      <header className="sidecar-traversal__header">
        <div>
          <div className="sidecar-inspector__id">{summary.scenario.scenarioId ?? 'traversal run'}</div>
          <h2 className="sidecar-inspector__title">Traversal View</h2>
        </div>
        <div className="sidecar-traversal__header-pills">
          <Pill kind="default">substrate {summary.substrate?.packageVersion ?? '—'}</Pill>
          <Pill kind="default">{summary.scenario.proofClass ?? 'no proof class'}</Pill>
          <Pill kind="default">{formatTraversalDuration(summary.scenario.durationMs)}</Pill>
          <Pill kind="stdo-ux">current vector {summary.currentVectorIndex ?? '—'}</Pill>
          {summary.unknownEventKinds.length > 0 && (
            <Pill kind="lane-backlog">{summary.unknownEventKinds.length} unknown event kinds</Pill>
          )}
        </div>
      </header>

      {summary.requirementLineage.length > 0 && (
        <section className="sidecar-traversal__lineage" aria-label="Requirement lineage">
          {summary.requirementLineage.map((row) => (
            <div key={row.requirementId} className="sidecar-traversal__lineage-row">
              <code className="sidecar-traversal__lineage-id">{row.requirementId}</code>
              <span className="sidecar-traversal__lineage-fold">{row.foldStates.join(', ') || '—'}</span>
              <span className="sidecar-traversal__lineage-coverage">{row.coverageStatuses.join(', ') || '—'}</span>
            </div>
          ))}
        </section>
      )}

      <div className="sidecar-traversal__layout">
        <section className="sidecar-traversal__chain" aria-label="Traversal vector chain">
          {summary.vectors.map((vector) => {
            const tone = traversalVectorTone(vector);
            const isCurrent = summary.currentVectorIndex === vector.vectorIndex;
            const isSelected = selection?.index === vector.vectorIndex;
            return (
              <button
                key={vector.vectorIndex}
                type="button"
                className={`sidecar-traversal__vector sidecar-traversal__vector--${tone}${isSelected ? ' is-selected' : ''}${isCurrent ? ' is-current' : ''}`}
                aria-pressed={isSelected}
                onClick={() => dispatch({ type: 'traversal/select-vector', index: vector.vectorIndex })}
              >
                <span className="sidecar-traversal__vector-frame" title={`invocation frame ${vector.frameOrdinal ?? '—'}`}>
                  {vector.frameOrdinal === null ? '·' : `⌐${vector.frameOrdinal}`}
                </span>
                <span className="sidecar-traversal__vector-index">v{vector.vectorIndex}</span>
                <span className="sidecar-traversal__vector-edge" title={vector.edge ?? undefined}>
                  {vector.edge ?? vector.stage ?? '(unlabelled vector)'}
                </span>
                <span className="sidecar-traversal__vector-badges">
                  {vector.attemptCount > 1 && <span className="sidecar-traversal__badge sidecar-traversal__badge--attempts">x{vector.attemptCount}</span>}
                  {vector.hasEvaluator && <span className="sidecar-traversal__badge sidecar-traversal__badge--evaluator">eval</span>}
                  {isCurrent && <span className="sidecar-traversal__badge sidecar-traversal__badge--current">current</span>}
                  <span className={`sidecar-traversal__badge sidecar-traversal__badge--${tone}`}>
                    {tone === 'ok' ? 'accepted' : tone === 'fail' ? 'rejected' : 'pending'}
                  </span>
                </span>
              </button>
            );
          })}
          {summary.vectors.length === 0 && (
            <div className="sidecar-inspector__empty">The proof contains no traversed vectors.</div>
          )}
        </section>

        <section className="sidecar-traversal__detail" aria-label="Vector detail">
          {!selection && <div className="sidecar-inspector__empty">Select a vector to load its detail.</div>}
          {selection && traversal.detailStatus === 'loading' && (
            <div className="sidecar-inspector__empty" aria-busy="true">Loading vector {selection.index} detail…</div>
          )}
          {selection && traversal.detailStatus === 'error' && (
            <div className="sidecar-traversal__error" role="alert">
              vector {selection.index}: {traversal.detailError ?? 'detail load failed'}
            </div>
          )}
          {selection && traversal.detailStatus === 'ready' && detailEntry && (
            <TraversalVectorDetailPane detail={detailEntry.detail} dispatch={dispatch} />
          )}
        </section>
      </div>
    </div>
  );
}

function TraversalVectorDetailPane({ detail, dispatch }: {
  detail: TraversalVectorDetail;
  dispatch: Dispatch<SidecarMsg>;
}) {
  return (
    <div className="sidecar-traversal__detail-body">
      <div className="sidecar-traversal__detail-head">
        <strong>v{detail.vectorIndex}</strong>
        <span className="sidecar-traversal__detail-stage">{detail.stage ?? detail.edge ?? '—'}</span>
        {detail.availableVariants.length > 1 && (
          <div className="sidecar-traversal__variants" role="group" aria-label="Vector variants and attempts">
            {detail.availableVariants.map((ref) => {
              const active = ref.variant === detail.variant && ref.attempt === detail.attempt;
              return (
                <button
                  key={`${ref.variant}:${ref.attempt}`}
                  type="button"
                  className={`sidecar-traversal__variant-button${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => dispatch({
                    type: 'traversal/select-vector',
                    index: detail.vectorIndex,
                    variant: ref.variant,
                    attempt: ref.attempt,
                  })}
                >
                  {ref.variant === 'evaluator' ? 'eval' : 'run'} #{ref.attempt}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {detail.stagePlan && (
        <Section title="Stage plan">
          <div className="sidecar-traversal__stage-plan">
            <div className="sidecar-traversal__type-flow">
              <code>{detail.stagePlan.sourceTypeRef ?? '—'}</code>
              <span aria-hidden="true">→</span>
              <code>{detail.stagePlan.targetTypeRef ?? '—'}</code>
            </div>
            {detail.stagePlan.filesToProduce.length > 0 && (
              <ul className="sidecar-traversal__files-to-produce">
                {detail.stagePlan.filesToProduce.map((path) => <li key={path}><code>{path}</code></li>)}
              </ul>
            )}
          </div>
        </Section>
      )}
      {detail.assessment && (
        <Section title="Assessment">
          <div className="sidecar-traversal__assessment">
            <Pill kind={detail.assessment.accepted === true ? 'lane-active' : detail.assessment.accepted === false ? 'cat-defect' : 'default'}>
              {detail.assessment.accepted === true ? 'accepted' : detail.assessment.accepted === false ? 'rejected' : 'unjudged'}
            </Pill>
            {detail.assessment.reason && <div className="sidecar-body-text">{detail.assessment.reason}</div>}
          </div>
        </Section>
      )}
      {detail.materializedFiles.length > 0 && (
        <Section title={`Materialized files (${detail.materializedFiles.length})`}>
          <div className="sidecar-traversal__files-scroll">
            <table className="sidecar-traversal__files">
              <thead>
                <tr><th>path</th><th>bytes</th><th>lines</th><th>sha256</th></tr>
              </thead>
              <tbody>
                {detail.materializedFiles.map((file) => (
                  <tr key={file.path}>
                    <td><code>{file.path}</code></td>
                    <td>{file.byteLength ?? '—'}</td>
                    <td>{file.lineCount ?? '—'}</td>
                    <td><code>{shortSha(file.sha256)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
      {detail.contentPreviews.length > 0 && (
        <Section title="Content previews">
          {detail.contentPreviews.map((preview) => (
            <div key={preview.path} className="sidecar-traversal__preview">
              <code className="sidecar-traversal__preview-path">{preview.path}</code>
              <pre className="sidecar-traversal__preview-body">{preview.contentPreview}</pre>
            </div>
          ))}
        </Section>
      )}
      {detail.timing && (
        <Section title="Timing">
          <MetaGrid items={[
            ['Started', detail.timing.startedAt ?? '—'],
            ['Ended', detail.timing.endedAt ?? '—'],
            ['Duration', formatTraversalDuration(detail.timing.durationMs)],
          ]} />
        </Section>
      )}
    </div>
  );
}

// Ticket Board (sprint W8) — instantiation #1 of the shared DrillView
// primitive: lanes are the on-disk ticket lanes, cards are ticket records
// from the batch surface load, the detail pane below renders the STDO
// frontmatter grid and the markdown body. Selection is reducer-owned
// (state.ticketBoard) per UX_METHOD §5.
const TICKET_BOARD_LANE_ORDER: { id: TicketLane; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'completed', label: 'Completed' },
];

function ticketPriorityTone(priority: string | undefined): DrillTone {
  const value = (priority ?? '').trim().toLowerCase();
  if (['critical', 'blocker', 'urgent', 'highest', 'p0'].includes(value)) return 'fail';
  if (['high', 'p1'].includes(value)) return 'warn';
  if (['low', 'lowest', 'p3', 'p4'].includes(value)) return 'ok';
  return 'neutral';
}

function ticketBoardLanes(tickets: TicketRecord[]): DrillLane[] {
  return TICKET_BOARD_LANE_ORDER.map(({ id, label }) => ({
    id,
    label,
    items: tickets
      .filter((ticket) => ticket.lane === id)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        subtitle: ticket.id,
        tone: ticketPriorityTone(ticket.priority),
        badges: [
          ...(ticket.type ? [{ label: ticket.type, kind: `type-${ticket.type}` }] : []),
          ...(ticket.status ? [{ label: ticket.status, kind: `status-${ticket.status}` }] : []),
        ],
      })),
  }));
}

function TicketBoardInspector({ state, dispatch }: {
  state: SidecarState;
  dispatch: Dispatch<SidecarMsg>;
}) {
  const workspaceLabel = state.context?.project.id ?? state.context?.project.root ?? 'this workspace';
  const selectedTicketId = state.ticketBoard.selectedTicketId;
  return (
    <DrillView
      className="sidecar-ticket-board"
      label="Tickets Board"
      lanes={ticketBoardLanes(state.tickets)}
      selectedId={selectedTicketId}
      onSelect={(id) => dispatch({ type: 'ticket-board/select', id: id === selectedTicketId ? null : id })}
      renderDetail={(id) => {
        const ticket = state.tickets.find((candidate) => candidate.id === id);
        return ticket
          ? <TicketBoardDetail t={ticket} />
          : <div className="sidecar-inspector__empty">Ticket {id} is no longer present in the loaded records.</div>;
      }}
      detailPlaceholder="Select a ticket card to inspect its STDO frontmatter and body."
      emptyMessage={`Workspace ${workspaceLabel} carries no tickets surface — no ticket records are loaded.`}
    />
  );
}

function ticketGovernanceExpansionSummary(t: TicketRecord) {
  return (t.governanceScopeExpansion ?? [])
    .flatMap((entry) => Object.entries(entry))
    .map(([letter, method]) => `${letter} → ${method}`)
    .join(', ');
}

function TicketBoardDetail({ t }: { t: TicketRecord }) {
  const fieldRows = ([
    ['Goal', t.goal],
    ['Change intent', t.changeIntent],
    ['Change class', t.changeClass],
    ['Re-entry point', t.reEntryPoint],
    ['Category', t.ticketCategory],
    ['Priority', t.priority],
    ['Depends on', t.dependencies?.join(', ')],
    ['Intake source', t.intakeSource],
    ['Affected boundary', t.affectedBoundary],
    ['Build tenant', t.buildTenant],
    ['Source ticket', t.sourceTicket],
    ['Governance', t.governanceScope],
    ['Governance expansion', ticketGovernanceExpansionSummary(t)],
    ['Closure law', t.closureLaw],
    ['Triaged', t.triagedAt],
    ['Created', t.createdAt],
    ['Updated', t.updatedAt],
    ['Source', t.sourcePath],
  ] as [string, string | undefined][]).filter(
    (entry): entry is [string, string] => Boolean(entry[1] && entry[1].trim()),
  );
  const listSections: [string, string[] | undefined][] = [
    ['Evaluation criteria', t.evaluationCriteria],
    ['Proof surface', t.proofSurface],
    ['Non-closure conditions', t.nonClosureConditions],
  ];
  return (
    <div className="sidecar-ticket-board__detail">
      <div className="sidecar-inspector__id">{t.id}</div>
      <h2 className="sidecar-inspector__title">{t.title}</h2>
      <div className="sidecar-ticket-board__detail-pills">
        <Pill kind={`lane-${t.lane}`}>{t.lane}</Pill>
        {t.status && <Pill kind="default">{t.status}</Pill>}
        {t.type && <Pill kind="default">{t.type}</Pill>}
        {t.priority && <Pill kind={`priority-${t.priority}`}>{t.priority}</Pill>}
      </div>
      {fieldRows.length > 0 && <MetaGrid items={fieldRows} />}
      {t.targetTruth && <Section title="Target truth"><div className="sidecar-body-text">{t.targetTruth}</div></Section>}
      {t.supersededTruth && <Section title="Superseded truth"><div className="sidecar-body-text">{t.supersededTruth}</div></Section>}
      {listSections.map(([title, entries]) => (
        entries && entries.length > 0 ? (
          <Section key={title} title={title}>
            <ul className="sidecar-criteria-list">
              {entries.map((entry, index) => <li key={index}>{entry}</li>)}
            </ul>
          </Section>
        ) : null
      ))}
      {t.body && t.body.trim() ? (
        <Section title="Body">
          <MarkdownDocumentContent descriptorId={`ticket-board:${t.id}`} content={t.body} />
        </Section>
      ) : (
        <div className="sidecar-inspector__empty">This ticket carries no markdown body.</div>
      )}
    </div>
  );
}

// AI Workspace viewer — first-class Sidecar canvas tab over the observation
// that already rides the batch surface load (state.aiWorkspaceObservation).
// The stale-root guard uses the same project-basis law as the batch loader:
// an observation for a different root renders as this root's honest absence.
function AiWorkspaceInspector({ state, dispatch, onInfoSurfaceSelect }: {
  state: SidecarState;
  dispatch: Dispatch<SidecarMsg>;
  onInfoSurfaceSelect: (surface: SidecarInfoSurface) => void;
}) {
  const projectRoot = state.context?.project.root ?? null;
  const observation = isAiWorkspaceObservationForProject(state.aiWorkspaceObservation, projectRoot)
    ? state.aiWorkspaceObservation
    : null;
  const workspaceLabel = state.context?.project.id ?? projectRoot ?? 'this workspace';
  if (!observation) {
    return (
      <div className="sidecar-inspector__empty">
        Workspace {workspaceLabel} carries no feature-detected .ai-workspace observation for its root
        {projectRoot ? ` (${projectRoot})` : ''}.
      </div>
    );
  }
  const handleArtifactOpen = (artifact: AiWorkspaceArtifactRecord) => {
    dispatchSurfaceSelection(dispatch, projectRoot, artifact.relativePath, artifact.absolutePath, 'browse');
  };
  const handleFeatureOpen = (featureId: AiWorkspaceFeatureId) => {
    if (featureId === 'tickets' || featureId === 'comments') {
      onInfoSurfaceSelect(featureId);
    }
  };
  return (
    <div className="sidecar-ai-workspace-view">
      <AiWorkspaceObservationSummary
        observation={observation}
        onArtifactOpen={handleArtifactOpen}
        onFeatureOpen={handleFeatureOpen}
        expanded
      />
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
  return (
    <section className={`agent-console__terminal-shell sidecar-session-window${selected ? ' is-active' : ''}`} onClick={onActivate}>
      {projectRoot ? (
        <SidecarTerminal session={session} projectRoot={projectRoot} />
      ) : (
        <div className="sidecar-terminal-placeholder">
          <p className="muted">Select a Project to attach this shell.</p>
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
      if (disposed || terminalRef.current !== terminal || !host?.isConnected) return;
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
