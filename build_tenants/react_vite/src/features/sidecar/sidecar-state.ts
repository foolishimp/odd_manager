import type { TicketRecord } from '../../contracts/ticket';
import type { CommentRecord } from '../../contracts/comment';
import type { SessionRecord, SessionSurfaceDiagnostic } from '../../contracts/session';
import type { ProjectRecord } from '../../contracts/project';
import type { RunInspectorFocus } from '../../lib/projectDeepLink';
import type { AiWorkspaceObservation } from '../../contracts/ai-workspace-observation';
import type { AbgRunObservation, AbgRunSection } from '../../contracts/abg-run-observation';
import type {
  TraversalProjection,
  TraversalVectorDetail,
  TraversalVectorVariant,
} from '../../contracts/traversal';
import type { SurfaceData } from '../../lib/types';

export interface ContextRecord {
  project: { id: string; root: string; odd_type: string };
  workspace: { id: string; profile: string };
  session: null | { id: string };
}

export type SelectionKind = 'project' | 'ticket' | 'comment' | 'session' | 'surface' | 'traversal' | 'ticket-board' | 'ai-workspace' | null;
export type SidecarExplorerProviderId = 'tickets' | 'comments' | 'specification' | 'build-tenants' | 'history' | 'browse';
export type SidecarInfoSurface = SidecarExplorerProviderId;

export interface SidecarExplorerProvider {
  id: SidecarExplorerProviderId;
  label: string;
  shortLabel: string;
  selectionKind?: Exclude<SelectionKind, null>;
}

export const SIDECAR_EXPLORER_PROVIDERS: SidecarExplorerProvider[] = [
  { id: 'tickets', label: 'Tickets', shortLabel: 'T', selectionKind: 'ticket' },
  { id: 'comments', label: 'Comments', shortLabel: 'C', selectionKind: 'comment' },
  { id: 'specification', label: 'Specification', shortLabel: 'S', selectionKind: 'surface' },
  { id: 'build-tenants', label: 'Build Tenants', shortLabel: 'B', selectionKind: 'surface' },
  { id: 'browse', label: 'Browse', shortLabel: 'F' },
  { id: 'history', label: 'Recent Paths', shortLabel: 'H' },
];

export const SIDECAR_CANONICAL_PROVIDER_RELATIVE_PATHS = [
  '.ai-workspace/tickets',
  '.ai-workspace/comments',
  'specification',
  'build_tenants',
] as const;

export type SidecarPathHistorySource = 'browse' | 'provider' | 'pinned_folder' | 'history';

export interface SidecarPathHistoryEntry {
  absolutePath: string;
  projectRoot: string;
  relativePath: string;
  source: SidecarPathHistorySource;
  timestamp: string;
}

export interface SidecarPinnedFoldersState {
  projectRoot: string | null;
  paths: string[];
  activePath: string | null;
  loaded: boolean;
}

export interface SidecarSurfaceLoadState {
  projectRoot: string | null;
  relativePath: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  requestId: number;
  surface: SurfaceData | null;
  error: string | null;
  tailFollow: boolean;
}

export interface SidecarFolderEntry {
  name: string;
  absolutePath: string;
  kind?: 'directory' | 'file';
  updatedAt?: string;
  hasWorkspace?: boolean;
  markers?: string[];
}

export interface SidecarFolderLoadState {
  projectRoot: string;
  path: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
  requestId: number;
  entries: SidecarFolderEntry[];
  truncated: boolean;
  state: 'present' | 'missing' | 'not_directory';
  error: string | null;
  loadedAt: number | null;
}

export const SIDECAR_TAIL_FOLLOW_REFRESH_MS = 1_500;
export const SIDECAR_RUN_REFRESH_MS = 30_000;

export type SidecarSub =
  | {
      type: 'project-registry.changed';
      subscriptionId: string;
      projectRoot: string | null;
    }
  | {
      type: 'surface.tail-follow';
      subscriptionId: string;
      projectRoot: string | null;
      relativePath: string;
      intervalMs: number;
    }
  | {
      type: 'run.refresh';
      subscriptionId: string;
      workspaceRoot: string;
      runId: string | null;
      intervalMs: number;
    }
  | {
      type: 'oddterm.attach';
      subscriptionId: string;
      projectRoot: string;
      sessionId: string;
    };

export type OddTermReadyIdentity = {
  workspaceRoot: string;
  sessionId: string;
  subscriptionId: string;
};

export function oddTermReadyMatchesSubscription(
  subscription: Extract<SidecarSub, { type: 'oddterm.attach' }>,
  ready: OddTermReadyIdentity,
) {
  return (
    ready.workspaceRoot === subscription.projectRoot
    && ready.sessionId === subscription.sessionId
    && ready.subscriptionId === subscription.subscriptionId
  );
}

export interface SidecarSubscriptionFailure {
  subscriptionId: string;
  subscriptionType: SidecarSub['type'];
  error: string;
}

function sidecarActiveViewerTabs(state: SidecarState) {
  const workspace = state.ui.viewerWorkspace;
  return workspace.groups.flatMap((group) => {
    if (!group.activeTabId) return [];
    const tab = workspace.tabs.find((candidate) => candidate.id === group.activeTabId);
    return tab ? [tab] : [];
  });
}

export function sidecarSubscriptions(
  state: SidecarState,
  tailFollowIntervalMs = SIDECAR_TAIL_FOLLOW_REFRESH_MS,
  runRefreshIntervalMs = SIDECAR_RUN_REFRESH_MS,
): SidecarSub[] {
  const admittedProjectRoot = state.context?.project.root ?? null;
  const registryProjectRoot = state.activeLoadRoot ?? admittedProjectRoot;
  const activeViewerTabs = sidecarActiveViewerTabs(state);
  const subscriptions: SidecarSub[] = [{
    type: 'project-registry.changed',
    subscriptionId: `project-registry.changed:${registryProjectRoot ?? 'none'}`,
    projectRoot: registryProjectRoot,
  }];

  for (const load of Object.values(state.surfaceLoads)) {
    if (
      !admittedProjectRoot
      || !load.tailFollow
      || load.projectRoot !== admittedProjectRoot
      || !activeViewerTabs.some((tab) => tab.kind === 'surface' && tab.objectId === load.relativePath)
    ) {
      continue;
    }
    subscriptions.push({
      type: 'surface.tail-follow',
      subscriptionId: `surface.tail-follow:${load.projectRoot ?? 'none'}:${load.relativePath}`,
      projectRoot: load.projectRoot,
      relativePath: load.relativePath,
      intervalMs: tailFollowIntervalMs,
    });
  }

  if (
    admittedProjectRoot
    && state.traversal.workspaceRoot === admittedProjectRoot
    && state.traversal.runStatus === 'ready'
    && activeViewerTabs.some((tab) => tab.kind === 'traversal')
  ) {
    subscriptions.push({
      type: 'run.refresh',
      subscriptionId: `run.refresh:${admittedProjectRoot}:${state.traversal.selectedRunId ?? 'latest'}`,
      workspaceRoot: admittedProjectRoot,
      runId: state.traversal.selectedRunId,
      intervalMs: runRefreshIntervalMs,
    });
  }

  if (admittedProjectRoot && !state.ui.shellCollapsed) {
    const activeSessionIds = new Set<string>();
    for (const group of state.ui.terminalWorkspace.groups) {
      if (!group.activeTabId) continue;
      const tab = state.ui.terminalWorkspace.tabs.find((candidate) => candidate.id === group.activeTabId);
      if (tab && state.sessions.records.some((session) => session.id === tab.sessionId)) {
        activeSessionIds.add(tab.sessionId);
      }
    }
    for (const sessionId of activeSessionIds) {
      subscriptions.push({
        type: 'oddterm.attach',
        subscriptionId: `oddterm.attach:${admittedProjectRoot}:${sessionId}`,
        projectRoot: admittedProjectRoot,
        sessionId,
      });
    }
  }

  return subscriptions;
}

export const SIDECAR_PATH_HISTORY_LIMIT = 24;

export interface Selection {
  kind: SelectionKind;
  id: string | null;
}

export type SidecarShellLayout = 'single' | 'split-vertical' | 'split-horizontal';
export type SidecarResizeTarget = 'explorer' | 'contextRail' | 'bottomDock';
export type SidecarPaneGroupId = 'main' | 'secondary' | 'tertiary' | 'quaternary';

export const SIDECAR_PANE_GROUP_IDS: SidecarPaneGroupId[] = ['main', 'secondary', 'tertiary', 'quaternary'];
export const SIDECAR_MAX_PANE_GROUPS = SIDECAR_PANE_GROUP_IDS.length;
export const SIDECAR_MIN_PANE_RATIO = 0.12;

export interface SidecarResizeGesture {
  target: SidecarResizeTarget;
  pointerId: number | null;
  startClientX: number;
  startClientY: number;
  startValuePx: number;
}

export interface SidecarWorkbenchLayout {
  explorerWidthPx: number;
  contextRailWidthPx: number;
  bottomDockHeightPx: number;
  activeResize: SidecarResizeGesture | null;
}

export type SidecarViewerTabKind = Exclude<SelectionKind, null>;
export type SidecarViewerGroupId = SidecarPaneGroupId;
export type SidecarViewerSplit = 'single' | 'split-vertical' | 'split-horizontal';

export interface SidecarViewerTab {
  id: string;
  kind: SidecarViewerTabKind;
  objectId: string;
}

export type SidecarDocumentFitMode = 'none' | 'width';

export interface SidecarDocumentViewerState {
  zoom: number;
  fit: SidecarDocumentFitMode;
}

export interface SidecarViewerGroup {
  id: SidecarViewerGroupId;
  tabIds: string[];
  activeTabId: string | null;
}

export interface SidecarViewerWorkspace {
  split: SidecarViewerSplit;
  activeGroupId: SidecarViewerGroupId;
  tabs: SidecarViewerTab[];
  groups: SidecarViewerGroup[];
  ratios: number[];
}

export type SidecarTerminalGroupId = SidecarPaneGroupId;
export type SidecarTerminalSplit = SidecarShellLayout;

export interface SidecarTerminalTab {
  id: string;
  sessionId: string;
}

export interface SidecarTerminalGroup {
  id: SidecarTerminalGroupId;
  tabIds: string[];
  activeTabId: string | null;
}

export interface SidecarTerminalWorkspace {
  split: SidecarTerminalSplit;
  activeGroupId: SidecarTerminalGroupId;
  tabs: SidecarTerminalTab[];
  groups: SidecarTerminalGroup[];
  ratios: number[];
}

export const SIDECAR_WORKBENCH_LAYOUT_DEFAULTS: SidecarWorkbenchLayout = {
  explorerWidthPx: 384,
  contextRailWidthPx: 72,
  bottomDockHeightPx: 544,
  activeResize: null,
};

export const SIDECAR_WORKBENCH_LAYOUT_LIMITS: Record<SidecarResizeTarget, { min: number; max: number }> = {
  explorer: { min: 256, max: 640 },
  contextRail: { min: 64, max: 220 },
  bottomDock: { min: 120, max: 820 },
};

export const SIDECAR_BOTTOM_DOCK_COLLAPSE_THRESHOLD_PX = 180;
export const SIDECAR_BOTTOM_DOCK_RESTORE_THRESHOLD_PX = 240;
export const SIDECAR_BOTTOM_DOCK_RESTORE_MIN_HEIGHT_PX = 360;
export const SIDECAR_HORIZONTAL_SPLIT_DOCK_HEIGHT_PX = 720;

export const SIDECAR_VIEWER_WORKSPACE_DEFAULTS: SidecarViewerWorkspace = {
  split: 'single',
  activeGroupId: 'main',
  tabs: [],
  groups: [{ id: 'main', tabIds: [], activeTabId: null }],
  ratios: [1],
};

export const SIDECAR_TERMINAL_WORKSPACE_DEFAULTS: SidecarTerminalWorkspace = {
  split: 'single',
  activeGroupId: 'main',
  tabs: [],
  groups: [{ id: 'main', tabIds: [], activeTabId: null }],
  ratios: [1],
};

export const SIDECAR_LAYOUT_PROFILE_VERSION = 1;

export interface SidecarLayoutProfile {
  version: typeof SIDECAR_LAYOUT_PROFILE_VERSION;
  contextKey: string;
  ui: {
    infoCollapsed: boolean;
    infoPinned: boolean;
    shellCollapsed: boolean;
    shellLayout: SidecarShellLayout;
    activeInfoSurface: SidecarInfoSurface;
    workbenchLayout: SidecarWorkbenchLayout;
    viewerWorkspace: SidecarViewerWorkspace;
    documentViewers: Record<string, SidecarDocumentViewerState>;
    terminalWorkspace: SidecarTerminalWorkspace;
  };
}

export type SidecarLayoutProfileValidation =
  | { ok: true; profile: SidecarLayoutProfile }
  | { ok: false; error: string };

// Traversal View (sprint W7) — recursion-aware, lazy-loading observation of a
// live traversal run. The summary is bounded; per-vector detail is fetched on
// selection only and cached FIFO with a hard cap.
export type SidecarTraversalStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SidecarTraversalSelectedVector {
  index: number;
  variant: TraversalVectorVariant;
  attempt: number | null;
}

export interface SidecarTraversalDetailEntry {
  key: string;
  detail: TraversalVectorDetail;
}

export const SIDECAR_TRAVERSAL_DETAIL_CACHE_LIMIT = 8;

export interface SidecarTraversalState {
  status: SidecarTraversalStatus;
  runStatus: SidecarTraversalStatus;
  workspaceRoot: string | null;
  requestedRunId: string | null;
  selectedRunId: string | null;
  section: AbgRunSection;
  runObservation: AbgRunObservation | null;
  runError: string | null;
  summary: TraversalProjection | null;
  error: string | null;
  selectedVector: SidecarTraversalSelectedVector | null;
  detailStatus: SidecarTraversalStatus;
  detailError: string | null;
  details: SidecarTraversalDetailEntry[];
}

export const INITIAL_SIDECAR_TRAVERSAL_STATE: SidecarTraversalState = Object.freeze({
  status: 'idle' as const,
  runStatus: 'idle' as const,
  workspaceRoot: null,
  requestedRunId: null,
  selectedRunId: null,
  section: 'overview' as const,
  runObservation: null,
  runError: null,
  summary: null,
  error: null,
  selectedVector: null,
  detailStatus: 'idle' as const,
  detailError: null,
  details: Object.freeze([]) as unknown as SidecarTraversalDetailEntry[],
});

export function traversalDetailKey(index: number, variant: TraversalVectorVariant, attempt: number | null, runId: string | null = null) {
  return `${runId ?? 'default'}:${index}:${variant}:${attempt === null ? 'latest' : attempt}`;
}

// Ticket Board (sprint W8) — reducer-owned selection for the Drill View
// instantiation over the tickets surface. Records ride the batch surface load
// (state.tickets); this slice only carries which card is drilled into, plus
// the workspace root the selection was made against (stale-root guard, same
// law as the traversal slice).
export interface SidecarTicketBoardState {
  workspaceRoot: string | null;
  selectedTicketId: string | null;
}

export const INITIAL_SIDECAR_TICKET_BOARD_STATE: SidecarTicketBoardState = Object.freeze({
  workspaceRoot: null,
  selectedTicketId: null,
});

export interface SidecarState {
  context: ContextRecord | null;
  projects: ProjectRecord[];
  tickets: TicketRecord[];
  comments: CommentRecord[];
  sessions: { records: SessionRecord[]; diagnostic: SessionSurfaceDiagnostic | null };
  aiWorkspaceObservation: AiWorkspaceObservation | null;
  traversal: SidecarTraversalState;
  runFocus: RunInspectorFocus | null;
  ticketBoard: SidecarTicketBoardState;
  selection: Selection;
  pathHistory: SidecarPathHistoryEntry[];
  pathHistoryLoaded: boolean;
  pinnedFolders: SidecarPinnedFoldersState;
  initialSurfaceAppliedKey: string | null;
  surfaceLoads: Record<string, SidecarSurfaceLoadState>;
  folderLoads: Record<string, SidecarFolderLoadState>;
  activeSessionId: string | null;
  secondarySessionId: string | null;
  ui: {
    infoCollapsed: boolean;
    infoPinned: boolean;
    shellCollapsed: boolean;
    shellLayout: SidecarShellLayout;
    activeInfoSurface: SidecarInfoSurface;
    workbenchLayout: SidecarWorkbenchLayout;
    viewerWorkspace: SidecarViewerWorkspace;
    documentViewers: Record<string, SidecarDocumentViewerState>;
    terminalWorkspace: SidecarTerminalWorkspace;
  };
  unreadIds: string[];
  viewerAgent: string;
  lastAction: { ok: boolean; message?: string; error?: string } | null;
  replyDraft: { parentId: string; body: string } | null;
  loading: boolean;
  activeLoadRoot: string | null;
  activeLoadGeneration: number | null;
  nextLoadGeneration: number;
  /** A requested cross-Project history target; opened only after its Context loads. */
  pendingHistorySurface: { projectId: string; projectRoot: string; relativePath: string } | null;
  /** Suppresses the host's one initial-surface replay after a history target has opened. */
  pendingHistoryInitialSurfaceRoot: string | null;
  subscriptionFailures: SidecarSubscriptionFailure[];
  pendingCommands: PendingSidecarCmd[];
  inFlightActions: PendingSidecarCmd[];
  nextCommandId: number;
}

export type SidecarLoadReason = 'initial' | 'project_selected' | 'action_completed' | 'session_refresh';

export interface SidecarLoadPayload {
  context?: ContextRecord | null;
  projects?: ProjectRecord[];
  comments?: CommentRecord[];
  tickets?: TicketRecord[];
  sessions?: { records: SessionRecord[]; diagnostic: SessionSurfaceDiagnostic | null };
  aiWorkspaceObservation?: AiWorkspaceObservation | null;
  pathHistory?: SidecarPathHistoryEntry[];
  unreadIds?: string[];
  selection?: Selection;
  activeSessionId?: string | null;
  secondarySessionId?: string | null;
  ui?: SidecarState['ui'];
  replyDraft?: { parentId: string; body: string } | null;
  lastAction?: { ok: boolean; message?: string; error?: string } | null;
  viewerAgent?: string;
}

export type SidecarMsg =
  | { type: 'load/request'; projectRoot: string | null; reason: SidecarLoadReason }
  | { type: 'load/start'; projectRoot: string | null; generation: number }
  | {
      type: 'load/done';
      projectRoot: string | null;
      generation: number;
      payload: SidecarLoadPayload;
    }
  | { type: 'load/failed'; projectRoot: string | null; generation: number; error: string; payload?: SidecarLoadPayload }
  | { type: 'cmd/dispatched'; ids: string[] }
  | { type: 'ui/toggle-workspace'; workspace: 'info' | 'shell'; collapsed?: boolean }
  | { type: 'ui/set-info-pinned'; pinned?: boolean }
  | { type: 'ui/set-shell-layout'; layout: SidecarShellLayout }
  | { type: 'ui/select-info-surface'; surface: SidecarInfoSurface; open?: boolean }
  | { type: 'ui/resize-start'; target: SidecarResizeTarget; pointerId: number | null; clientX: number; clientY: number }
  | { type: 'ui/resize-preview'; target: SidecarResizeTarget; valuePx: number }
  | { type: 'ui/resize-commit'; target?: SidecarResizeTarget; valuePx?: number }
  | { type: 'ui/resize-by'; target: SidecarResizeTarget; deltaPx: number }
  | { type: 'ui/resize-reset'; target?: SidecarResizeTarget }
  | { type: 'layout/profile-loaded'; contextKey: string; payload: unknown }
  | { type: 'layout/profile-load-failed'; contextKey: string; error: string }
  | { type: 'layout/profile-save-failed'; contextKey: string; error: string }
  | { type: 'layout/profile-reset' }
  | { type: 'viewer/open'; kind: SidecarViewerTabKind; id: string; groupId?: SidecarViewerGroupId }
  | { type: 'viewer/select-tab'; groupId: SidecarViewerGroupId; tabId: string }
  | { type: 'viewer/close-tab'; groupId: SidecarViewerGroupId; tabId: string }
  | { type: 'viewer/close-group'; groupId: SidecarViewerGroupId }
  | { type: 'viewer/split'; split: SidecarViewerSplit }
  | { type: 'viewer/split-add-vertical' }
  | { type: 'viewer/resize-boundary'; index: number; deltaRatio: number }
  | { type: 'viewer/reset-ratios' }
  | { type: 'viewer/focus-group'; groupId: SidecarViewerGroupId }
  | { type: 'document/zoom'; tabId: string; delta: number }
  | { type: 'document/reset'; tabId: string }
  | { type: 'document/fit-width'; tabId: string }
  | { type: 'terminal/open'; sessionId: string; groupId?: SidecarTerminalGroupId }
  | { type: 'terminal/jump-to-session'; sessionId: string }
  | { type: 'terminal/select-tab'; groupId: SidecarTerminalGroupId; tabId: string }
  | { type: 'terminal/close-tab'; groupId: SidecarTerminalGroupId; tabId: string }
  | { type: 'terminal/split'; split: SidecarTerminalSplit }
  | { type: 'terminal/split-add-vertical' }
  | { type: 'terminal/resize-boundary'; index: number; deltaRatio: number }
  | { type: 'terminal/reset-ratios' }
  | { type: 'terminal/focus-group'; groupId: SidecarTerminalGroupId }
  | { type: 'select'; kind: Exclude<SelectionKind, null>; id: string }
  | { type: 'path-history/load'; entries: unknown }
  | { type: 'path-history/read-request' }
  | { type: 'path-history/read-succeeded'; entries: unknown }
  | { type: 'path-history/read-failed'; error: string }
  | { type: 'path-history/write-succeeded' }
  | { type: 'path-history/write-failed'; error: string }
  | { type: 'path-history/copy-request'; entry: SidecarPathHistoryEntry }
  | { type: 'pinned-folders/read-request'; projectRoot: string }
  | { type: 'pinned-folders/read-succeeded'; projectRoot: string; paths: unknown }
  | { type: 'pinned-folders/read-failed'; projectRoot: string; error: string }
  | { type: 'pinned-folders/set'; projectRoot: string; paths: string[]; activePath?: string | null }
  | { type: 'pinned-folders/select'; projectRoot: string; path: string | null }
  | { type: 'pinned-folders/write-succeeded'; projectRoot: string }
  | { type: 'pinned-folders/write-failed'; projectRoot: string; error: string }
  | { type: 'layout/profile-read-request'; contextKey: string }
  | { type: 'layout/profile-read-succeeded'; contextKey: string; payload: unknown }
  | { type: 'layout/profile-write-request'; contextKey: string; profile: SidecarLayoutProfile }
  | { type: 'layout/profile-write-succeeded'; contextKey: string }
  | { type: 'initial-surface/request'; surface: 'project-workbench' | 'run-inspector' | 'ticket-board' | 'ai-workspace'; projectRoot: string; hasRunFocus: boolean }
  | { type: 'surface/load-request'; projectRoot: string | null; relativePath: string; refresh?: boolean }
  | { type: 'surface/load-succeeded'; key: string; requestId: number; surface: SurfaceData }
  | { type: 'surface/load-failed'; key: string; requestId: number; error: string }
  | { type: 'surface/tail-follow-set'; projectRoot: string | null; relativePath: string; enabled: boolean }
  | { type: 'surface/tail-ticked'; projectRoot: string | null; relativePath: string }
  | { type: 'project-registry/changed'; subscriptionId: string; projectRoot: string | null }
  | { type: 'run/refresh-ticked'; subscriptionId: string; workspaceRoot: string; runId: string | null }
  | { type: 'subscription/ready'; subscriptionId: string; subscriptionType: SidecarSub['type'] }
  | { type: 'subscription/failed'; subscriptionId: string; subscriptionType: SidecarSub['type']; error: string }
  | { type: 'folder/load-request'; path: string }
  | { type: 'folder/load-succeeded'; path: string; requestId: number; payload: unknown; loadedAt: number }
  | { type: 'folder/load-failed'; path: string; requestId: number; error: string }
  | { type: 'project/activate-request'; projectId: string; projectRoot: string; relativePath: string }
  | { type: 'project/activate-succeeded'; projectId: string; projectRoot: string; relativePath: string }
  | { type: 'project/activate-failed'; projectId: string; error: string }
  | { type: 'session/select'; id: string }
  | { type: 'session/select-secondary'; id: string | null }
  | { type: 'ticket/transition/request'; id: string; toLane: string }
  | { type: 'comment/toggle-read/request'; id: string; currentlyUnread: boolean }
  | { type: 'reply/open'; parentId: string }
  | { type: 'reply/edit'; body: string }
  | { type: 'reply/cancel' }
  | { type: 'reply/submit/request'; parentId: string; body: string }
  | { type: 'session/spawn/request'; groupId?: SidecarTerminalGroupId; cwd?: string | null; label?: string }
  | { type: 'session/spawn/done'; projectRoot: string; record: SessionRecord; groupId: SidecarTerminalGroupId }
  | { type: 'session/spawn/failed'; projectRoot: string | null; error: string }
  | { type: 'session/kill/request'; id: string }
  | { type: 'traversal/load'; workspaceRoot?: string | null; runId?: string | null; refresh?: boolean }
  | { type: 'run/focus-admitted'; focus: RunInspectorFocus | null }
  | { type: 'traversal/load-succeeded'; workspaceRoot: string | null; requestedRunId: string | null; summary: TraversalProjection }
  | { type: 'traversal/load-failed'; workspaceRoot: string | null; requestedRunId: string | null; error: string }
  | { type: 'run/load-succeeded'; workspaceRoot: string | null; requestedRunId: string | null; observation: AbgRunObservation }
  | { type: 'run/load-failed'; workspaceRoot: string | null; requestedRunId: string | null; error: string }
  | { type: 'run/select'; runId: string }
  | { type: 'run/select-section'; section: AbgRunSection }
  | { type: 'traversal/select-vector'; index: number; variant?: TraversalVectorVariant; attempt?: number | null }
  | {
      type: 'traversal/vector-succeeded';
      workspaceRoot: string | null;
      runId: string | null;
      index: number;
      variant: TraversalVectorVariant;
      attempt: number | null;
      detail: TraversalVectorDetail;
    }
  | {
      type: 'traversal/vector-failed';
      workspaceRoot: string | null;
      runId: string | null;
      index: number;
      variant: TraversalVectorVariant;
      attempt: number | null;
      error: string;
    }
  | { type: 'traversal/clear' }
  | { type: 'ticket-board/select'; id: string | null }
  | {
      type: 'action/result';
      commandId: string;
      context: ContextRecord;
      ok: boolean;
      message?: string;
      error?: string;
    }
  | { type: 'action/feedback'; ok: boolean; message?: string; error?: string };

export type SidecarCmd =
  | { type: 'load'; projectRoot: string | null; reason: SidecarLoadReason }
  | { type: 'context.publish'; context: ContextRecord }
  | { type: 'ticket.transition'; id: string; toLane: string; context: ContextRecord }
  | { type: 'comment.toggleRead'; id: string; currentlyUnread: boolean; context: ContextRecord }
  | { type: 'comment.reply'; parentId: string; body: string; context: ContextRecord }
  | { type: 'clipboard.write'; text: string; label: string; context: ContextRecord }
  | { type: 'storage.read'; scope: 'path-history' | 'pinned-folders' | 'layout-profile'; key: string; projectRoot?: string; contextKey?: string }
  | { type: 'storage.write'; scope: 'path-history' | 'pinned-folders' | 'layout-profile'; key: string; value: unknown; projectRoot?: string; contextKey?: string }
  | { type: 'project.activate'; projectId: string; projectRoot: string; relativePath: string }
  | { type: 'surface.load'; key: string; requestId: number; projectRoot: string | null; relativePath: string }
  | { type: 'folder.load'; projectRoot: string; path: string; requestId: number }
  | {
      type: 'session.spawn';
      projectRoot: string | null;
      groupId: SidecarTerminalGroupId;
      cwd: string | null;
      label: string | null;
      existingSessionIds: string[];
    }
  | { type: 'session.kill'; id: string; context: ContextRecord }
  | { type: 'traversal.loadSummary'; workspaceRoot: string | null; runId: string | null; refresh: boolean }
  | { type: 'run.loadObservation'; workspaceRoot: string | null; runId: string | null; refresh: boolean }
  | {
      type: 'traversal.loadVectorDetail';
      workspaceRoot: string | null;
      runId: string | null;
      index: number;
      variant: TraversalVectorVariant;
      attempt: number | null;
    };

export interface PendingSidecarCmd {
  id: string;
  cmd: SidecarCmd;
  loadGeneration?: number;
}

type ResultBearingSidecarCmd = Extract<
  SidecarCmd,
  {
    type:
      | 'ticket.transition'
      | 'comment.toggleRead'
      | 'comment.reply'
      | 'clipboard.write'
      | 'session.kill';
  }
>;

export const INITIAL_SIDECAR_STATE: SidecarState = {
  context: null,
  projects: [],
  tickets: [],
  comments: [],
  sessions: { records: [], diagnostic: null },
  aiWorkspaceObservation: null,
  traversal: { ...INITIAL_SIDECAR_TRAVERSAL_STATE, details: [] },
  runFocus: null,
  ticketBoard: { ...INITIAL_SIDECAR_TICKET_BOARD_STATE },
  selection: { kind: null, id: null },
  pathHistory: [],
  pathHistoryLoaded: false,
  pinnedFolders: { projectRoot: null, paths: [], activePath: null, loaded: false },
  initialSurfaceAppliedKey: null,
  surfaceLoads: {},
  folderLoads: {},
  activeSessionId: null,
  secondarySessionId: null,
  ui: {
    infoCollapsed: false,
    infoPinned: false,
    shellCollapsed: true,
    shellLayout: 'single',
    activeInfoSurface: 'tickets',
    workbenchLayout: { ...SIDECAR_WORKBENCH_LAYOUT_DEFAULTS },
    viewerWorkspace: { ...SIDECAR_VIEWER_WORKSPACE_DEFAULTS, groups: [...SIDECAR_VIEWER_WORKSPACE_DEFAULTS.groups] },
    documentViewers: {},
    terminalWorkspace: { ...SIDECAR_TERMINAL_WORKSPACE_DEFAULTS, groups: [...SIDECAR_TERMINAL_WORKSPACE_DEFAULTS.groups] },
  },
  unreadIds: [],
  viewerAgent: 'operator',
  lastAction: null,
  replyDraft: null,
  loading: true,
  activeLoadRoot: null,
  activeLoadGeneration: null,
  nextLoadGeneration: 1,
  pendingHistorySurface: null,
  pendingHistoryInitialSurfaceRoot: null,
  subscriptionFailures: [],
  pendingCommands: [],
  inFlightActions: [],
  nextCommandId: 1,
};

function currentProjectRoot(state: SidecarState) {
  return state.context?.project.root ?? null;
}

function sidecarContextsEqual(
  left: ContextRecord | null,
  right: ContextRecord | null,
) {
  return (
    left !== null
    && right !== null
    && left.project.id === right.project.id
    && left.project.root === right.project.root
    && left.project.odd_type === right.project.odd_type
    && left.workspace.id === right.workspace.id
    && left.workspace.profile === right.workspace.profile
    && (left.session?.id ?? null) === (right.session?.id ?? null)
  );
}

function isResultBearingSidecarCmd(cmd: SidecarCmd): cmd is ResultBearingSidecarCmd {
  return (
    cmd.type === 'ticket.transition'
    || cmd.type === 'comment.toggleRead'
    || cmd.type === 'comment.reply'
    || cmd.type === 'clipboard.write'
    || cmd.type === 'session.kill'
  );
}

function pendingActionForResult(
  state: SidecarState,
  msg: Extract<SidecarMsg, { type: 'action/result' }>,
) {
  const pending = state.inFlightActions.find((entry) => entry.id === msg.commandId);
  if (
    !pending
    || !isResultBearingSidecarCmd(pending.cmd)
    || !sidecarContextsEqual(pending.cmd.context, msg.context)
    || !sidecarContextsEqual(state.context, msg.context)
    || (
      state.activeLoadRoot !== null
      && state.activeLoadRoot !== msg.context.project.root
    )
  ) {
    return null;
  }
  return pending as PendingSidecarCmd & { cmd: ResultBearingSidecarCmd };
}

function actionResultReloads(cmd: ResultBearingSidecarCmd) {
  return (
    cmd.type === 'ticket.transition'
    || cmd.type === 'comment.toggleRead'
    || cmd.type === 'comment.reply'
    || cmd.type === 'session.kill'
  );
}

function retainActionsForCurrentContext(state: SidecarState) {
  return state.inFlightActions.filter(
    (entry) => (
      isResultBearingSidecarCmd(entry.cmd)
      && sidecarContextsEqual(entry.cmd.context, state.context)
    ),
  );
}

function isPathWithinProjectRoot(projectRoot: string, candidate: string) {
  const normalizedRoot = projectRoot.replace(/\/+$/, '') || '/';
  return candidate === normalizedRoot
    || (normalizedRoot === '/' ? candidate.startsWith('/') : candidate.startsWith(`${normalizedRoot}/`));
}

function isBoundedRelativePath(path: string) {
  return Boolean(path)
    && !path.startsWith('/')
    && !path.includes('\0')
    && !path.split(/[\\/]+/).some((segment) => segment === '.' || segment === '..');
}

function surfaceMatchesLoad(load: SidecarSurfaceLoadState, surface: SurfaceData) {
  if (
    !load.projectRoot
    || !isBoundedRelativePath(load.relativePath)
    || surface.relative_path !== load.relativePath
    || surface.path !== immediateChildPath(load.projectRoot, load.relativePath)
    || !isPathWithinProjectRoot(load.projectRoot, surface.path)
  ) {
    return false;
  }
  if (surface.kind !== 'directory') return true;
  const names = new Set<string>();
  const paths = new Set<string>();
  for (const entry of surface.entries) {
    if (
      !entry.name
      || entry.name === '.'
      || entry.name === '..'
      || /[\\/]/.test(entry.name)
      || entry.relative_path !== `${load.relativePath.replace(/[\\/]+$/, '')}/${entry.name}`
      || names.has(entry.name)
      || paths.has(entry.relative_path)
    ) {
      return false;
    }
    names.add(entry.name);
    paths.add(entry.relative_path);
  }
  return true;
}

function admittedSidecarSubscription(
  state: SidecarState,
  subscriptionId: string,
  subscriptionType: SidecarSub['type'],
) {
  return sidecarSubscriptions(state).find((subscription) => (
    subscription.subscriptionId === subscriptionId && subscription.type === subscriptionType
  )) ?? null;
}

function withoutSubscriptionFailure(state: SidecarState, subscriptionId: string) {
  if (!state.subscriptionFailures.some((failure) => failure.subscriptionId === subscriptionId)) return state;
  return {
    ...state,
    subscriptionFailures: state.subscriptionFailures.filter(
      (failure) => failure.subscriptionId !== subscriptionId,
    ),
  };
}

export function sidecarSurfaceLoadKey(projectRoot: string | null, relativePath: string) {
  return `${projectRoot ?? 'none'}:${relativePath}`;
}

function immediateChildPath(parent: string, name: string) {
  const normalizedParent = parent.replace(/\/+$/, '') || '/';
  return normalizedParent === '/' ? `/${name}` : `${normalizedParent}/${name}`;
}

function admittedFolderPayload(
  value: unknown,
  projectRoot: string,
  requestedPath: string,
): {
  entries: SidecarFolderEntry[];
  truncated: boolean;
  state: 'present' | 'missing' | 'not_directory';
} | null {
  if (!isRecord(value)) return null;
  if (
    value.path !== requestedPath
    || !isPathWithinProjectRoot(projectRoot, requestedPath)
    || typeof value.truncated !== 'boolean'
    || (value.state !== 'present' && value.state !== 'missing' && value.state !== 'not_directory')
    || !Array.isArray(value.entries)
  ) {
    return null;
  }
  const entries: SidecarFolderEntry[] = [];
  const names = new Set<string>();
  const paths = new Set<string>();
  for (const entry of value.entries) {
    if (!isRecord(entry)) return null;
    if (
      typeof entry.name !== 'string'
      || !entry.name
      || entry.name === '.'
      || entry.name === '..'
      || /[\\/]/.test(entry.name)
      || typeof entry.absolutePath !== 'string'
      || entry.absolutePath !== immediateChildPath(requestedPath, entry.name)
      || !isPathWithinProjectRoot(projectRoot, entry.absolutePath)
      || (entry.kind !== 'directory' && entry.kind !== 'file')
      || (entry.updatedAt !== undefined && typeof entry.updatedAt !== 'string')
      || (entry.hasWorkspace !== undefined && typeof entry.hasWorkspace !== 'boolean')
      || (
        entry.markers !== undefined
        && (!Array.isArray(entry.markers) || !entry.markers.every((marker) => typeof marker === 'string'))
      )
      || names.has(entry.name)
      || paths.has(entry.absolutePath)
    ) {
      return null;
    }
    names.add(entry.name);
    paths.add(entry.absolutePath);
    entries.push({
      name: entry.name,
      absolutePath: entry.absolutePath,
      kind: entry.kind,
      updatedAt: entry.updatedAt as string | undefined,
      hasWorkspace: entry.hasWorkspace as boolean | undefined,
      markers: entry.markers as string[] | undefined,
    });
  }
  if (value.state !== 'present' && entries.length > 0) return null;
  return {
    entries,
    truncated: value.truncated,
    state: value.state,
  };
}

function normalizePinnedFolderPaths(value: unknown, projectRoot: string) {
  if (!Array.isArray(value)) return [];
  const normalizedRoot = projectRoot.replace(/\/+$/, '');
  const canonicalProviderPaths = new Set(
    SIDECAR_CANONICAL_PROVIDER_RELATIVE_PATHS.map((relativePath) => `${normalizedRoot}/${relativePath}`),
  );
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const path = entry.trim().replace(/\/+$/, '');
    if (!path || (path !== normalizedRoot && !path.startsWith(`${normalizedRoot}/`))) continue;
    if (canonicalProviderPaths.has(path)) continue;
    seen.add(path);
  }
  return [...seen].sort((left, right) => left.localeCompare(right));
}

function pinnedFolderStoragePayloadIsCanonical(value: unknown, projectRoot: string) {
  if (!Array.isArray(value)) return false;
  const normalized = normalizePinnedFolderPaths(value, projectRoot);
  return value.length === normalized.length
    && value.every((entry, index) => entry === normalized[index]);
}

function traversalRequestedRoot(state: SidecarState, msg: Extract<SidecarMsg, { type: 'traversal/load' }>) {
  return msg.workspaceRoot !== undefined ? msg.workspaceRoot : currentProjectRoot(state);
}

function traversalRequestedRunId(state: SidecarState, msg: Extract<SidecarMsg, { type: 'traversal/load' }>) {
  return msg.runId !== undefined ? msg.runId : state.traversal.selectedRunId;
}

function normalizedTraversalSelection(msg: Extract<SidecarMsg, { type: 'traversal/select-vector' }>): SidecarTraversalSelectedVector {
  return {
    index: msg.index,
    variant: msg.variant ?? 'primary',
    attempt: msg.attempt === undefined ? null : msg.attempt,
  };
}

function traversalCacheHasKey(traversal: SidecarTraversalState, key: string) {
  return traversal.details.some((entry) => entry.key === key);
}

// Bounded FIFO detail cache: dedupe by key, append newest, evict oldest
// beyond SIDECAR_TRAVERSAL_DETAIL_CACHE_LIMIT.
function appendTraversalDetail(
  details: SidecarTraversalDetailEntry[],
  entry: SidecarTraversalDetailEntry,
  protectedKey: string | null = null,
): SidecarTraversalDetailEntry[] {
  const retained = details.filter((candidate) => candidate.key !== entry.key);
  const next = [...retained, entry];
  while (next.length > SIDECAR_TRAVERSAL_DETAIL_CACHE_LIMIT) {
    const evictionIndex = next.findIndex((candidate) => candidate.key !== protectedKey);
    if (evictionIndex < 0) break;
    next.splice(evictionIndex, 1);
  }
  return next;
}

// Ticket Board stale-root guard: a board selection is only meaningful against
// the workspace root and ticket records it was made from. Cleared when the
// workspace root changes or when the selected ticket leaves the loaded
// records; kept (referentially stable) otherwise so tab switches survive.
function reconciledTicketBoardState(
  board: SidecarTicketBoardState,
  tickets: TicketRecord[],
  workspaceRoot: string | null,
): SidecarTicketBoardState {
  if (board.selectedTicketId === null) return board;
  if (board.workspaceRoot !== workspaceRoot || !tickets.some((ticket) => ticket.id === board.selectedTicketId)) {
    return { workspaceRoot, selectedTicketId: null };
  }
  return board;
}

function reconciledTraversalState(traversal: SidecarTraversalState, workspaceRoot: string | null): SidecarTraversalState {
  if (traversal.workspaceRoot === null || traversal.workspaceRoot === workspaceRoot) return traversal;
  return { ...INITIAL_SIDECAR_TRAVERSAL_STATE, details: [] };
}

function firstLiveSessionId(sessions: SessionRecord[]) {
  return sessions.find((session) => session.status === 'running' || session.status === 'live')?.id
    ?? sessions[0]?.id
    ?? null;
}

function firstSecondarySessionId(sessions: SessionRecord[], primarySessionId: string | null) {
  return sessions.find((session) => session.id !== primarySessionId)?.id ?? null;
}

function getLayoutValue(layout: SidecarWorkbenchLayout, target: SidecarResizeTarget) {
  if (target === 'explorer') return layout.explorerWidthPx;
  if (target === 'contextRail') return layout.contextRailWidthPx;
  return layout.bottomDockHeightPx;
}

function clampLayoutValue(target: SidecarResizeTarget, valuePx: number) {
  const limits = SIDECAR_WORKBENCH_LAYOUT_LIMITS[target];
  if (!Number.isFinite(valuePx)) return getLayoutValue(SIDECAR_WORKBENCH_LAYOUT_DEFAULTS, target);
  return Math.min(limits.max, Math.max(limits.min, Math.round(valuePx)));
}

function setLayoutValue(layout: SidecarWorkbenchLayout, target: SidecarResizeTarget, valuePx: number): SidecarWorkbenchLayout {
  const nextValue = clampLayoutValue(target, valuePx);
  if (target === 'explorer') return { ...layout, explorerWidthPx: nextValue };
  if (target === 'contextRail') return { ...layout, contextRailWidthPx: nextValue };
  return { ...layout, bottomDockHeightPx: nextValue };
}

function bottomDockResizeState(
  state: SidecarState,
  valuePx: number,
  activeResize: SidecarResizeGesture | null = state.ui.workbenchLayout.activeResize,
) {
  const nextHeight = clampLayoutValue('bottomDock', valuePx);
  if (nextHeight <= SIDECAR_BOTTOM_DOCK_COLLAPSE_THRESHOLD_PX) {
    return {
      ...state,
      ui: {
        ...state.ui,
        shellCollapsed: true,
        workbenchLayout: {
          ...state.ui.workbenchLayout,
          bottomDockHeightPx: nextHeight,
          activeResize,
        },
      },
    };
  }
  if (state.ui.shellCollapsed && nextHeight >= SIDECAR_BOTTOM_DOCK_RESTORE_THRESHOLD_PX) {
    return {
      ...state,
      ui: {
        ...state.ui,
        shellCollapsed: false,
        workbenchLayout: {
          ...state.ui.workbenchLayout,
          bottomDockHeightPx: Math.max(nextHeight, SIDECAR_BOTTOM_DOCK_RESTORE_MIN_HEIGHT_PX),
          activeResize,
        },
      },
    };
  }
  return {
    ...state,
    ui: {
      ...state.ui,
      workbenchLayout: {
        ...state.ui.workbenchLayout,
        bottomDockHeightPx: nextHeight,
        activeResize,
      },
    },
  };
}

function resetLayoutValue(layout: SidecarWorkbenchLayout, target: SidecarResizeTarget): SidecarWorkbenchLayout {
  return setLayoutValue(layout, target, getLayoutValue(SIDECAR_WORKBENCH_LAYOUT_DEFAULTS, target));
}

function expandBottomDockForHorizontalSplit(layout: SidecarWorkbenchLayout): SidecarWorkbenchLayout {
  return normalizeWorkbenchLayout({
    ...layout,
    bottomDockHeightPx: Math.max(layout.bottomDockHeightPx, SIDECAR_HORIZONTAL_SPLIT_DOCK_HEIGHT_PX),
    activeResize: null,
  });
}

function normalizeWorkbenchLayout(layout: SidecarWorkbenchLayout | undefined): SidecarWorkbenchLayout {
  const source = layout ?? SIDECAR_WORKBENCH_LAYOUT_DEFAULTS;
  return {
    explorerWidthPx: clampLayoutValue('explorer', source.explorerWidthPx),
    contextRailWidthPx: clampLayoutValue('contextRail', source.contextRailWidthPx),
    bottomDockHeightPx: clampLayoutValue('bottomDock', source.bottomDockHeightPx),
    activeResize: source.activeResize
      ? {
          ...source.activeResize,
          startValuePx: clampLayoutValue(source.activeResize.target, source.activeResize.startValuePx),
        }
      : null,
  };
}

function equalPaneRatios(count: number) {
  return Array.from({ length: Math.max(1, count) }, () => 1);
}

function normalizePaneRatios(ratios: unknown, count: number) {
  const groupCount = Math.max(1, count);
  if (!Array.isArray(ratios) || ratios.length !== groupCount || !ratios.every((ratio) => typeof ratio === 'number' && Number.isFinite(ratio) && ratio > 0)) {
    return equalPaneRatios(groupCount);
  }
  const clamped = ratios.map((ratio) => Math.max(SIDECAR_MIN_PANE_RATIO, ratio));
  const sum = clamped.reduce((total, ratio) => total + ratio, 0);
  return clamped.map((ratio) => Number((ratio / sum).toFixed(4)));
}

function resizePaneRatios(ratios: number[], index: number, deltaRatio: number) {
  const normalized = normalizePaneRatios(ratios, ratios.length);
  if (!Number.isFinite(deltaRatio) || index < 0 || index >= normalized.length - 1) return normalized;
  const left = normalized[index];
  const right = normalized[index + 1];
  const delta = Math.max(SIDECAR_MIN_PANE_RATIO - left, Math.min(right - SIDECAR_MIN_PANE_RATIO, deltaRatio));
  const next = [...normalized];
  next[index] = left + delta;
  next[index + 1] = right - delta;
  return normalizePaneRatios(next, next.length);
}

function nextPaneGroupId(groups: { id: SidecarPaneGroupId }[]) {
  const used = new Set(groups.map((group) => group.id));
  return SIDECAR_PANE_GROUP_IDS.find((id) => !used.has(id)) ?? null;
}

function viewerTabId(kind: SidecarViewerTabKind, objectId: string) {
  return `${kind}:${objectId}`;
}

function defaultViewerWorkspace(): SidecarViewerWorkspace {
  return {
    ...SIDECAR_VIEWER_WORKSPACE_DEFAULTS,
    groups: SIDECAR_VIEWER_WORKSPACE_DEFAULTS.groups.map((group) => ({ ...group, tabIds: [...group.tabIds] })),
    tabs: [...SIDECAR_VIEWER_WORKSPACE_DEFAULTS.tabs],
    ratios: [...SIDECAR_VIEWER_WORKSPACE_DEFAULTS.ratios],
  };
}

function normalizeViewerWorkspace(workspace: SidecarViewerWorkspace | undefined): SidecarViewerWorkspace {
  const source = workspace ?? defaultViewerWorkspace();
  const tabs = [...source.tabs];
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const sourceGroups = source.groups ?? [];
  const normalizedById = new Map<SidecarViewerGroupId, SidecarViewerGroup>();
  for (const id of SIDECAR_PANE_GROUP_IDS) {
    const group = sourceGroups.find((candidate) => candidate.id === id);
    if (group) normalizedById.set(id, normalizeViewerGroup(group, tabIds));
  }
  const normalizedMain = normalizedById.get('main') ?? { id: 'main', tabIds: [], activeTabId: null };
  const split = source.split ?? 'single';
  let groups: SidecarViewerGroup[];
  if (split === 'single') {
    groups = [normalizedMain];
  } else if (split === 'split-horizontal') {
    groups = [
      normalizedMain,
      normalizedById.get('secondary') ?? { id: 'secondary', tabIds: [], activeTabId: null },
    ];
  } else {
    groups = SIDECAR_PANE_GROUP_IDS
      .map((id) => (id === 'main' ? normalizedMain : normalizedById.get(id) ?? null))
      .filter((group): group is SidecarViewerGroup => Boolean(group))
      .slice(0, SIDECAR_MAX_PANE_GROUPS);
    if (groups.length === 1) {
      groups = [...groups, { id: 'secondary', tabIds: [], activeTabId: null }];
    }
  }
  const activeGroupId = groups.some((group) => group.id === source.activeGroupId) ? source.activeGroupId : 'main';
  return {
    split,
    activeGroupId,
    tabs,
    groups,
    ratios: normalizePaneRatios(source.ratios, groups.length),
  };
}

function normalizeViewerGroup(group: SidecarViewerGroup, validTabIds: Set<string>): SidecarViewerGroup {
  const tabIds = group.tabIds.filter((tabId, index, values) => validTabIds.has(tabId) && values.indexOf(tabId) === index);
  const activeTabId = group.activeTabId && tabIds.includes(group.activeTabId)
    ? group.activeTabId
    : tabIds[0] ?? null;
  return { ...group, tabIds, activeTabId };
}

function findViewerTab(workspace: SidecarViewerWorkspace, tabId: string) {
  return workspace.tabs.find((tab) => tab.id === tabId) ?? null;
}

function findViewerGroup(workspace: SidecarViewerWorkspace, groupId: SidecarViewerGroupId) {
  return workspace.groups.find((group) => group.id === groupId) ?? null;
}

function activeViewerTab(workspace: SidecarViewerWorkspace) {
  const group = findViewerGroup(workspace, workspace.activeGroupId) ?? workspace.groups[0] ?? null;
  return group?.activeTabId ? findViewerTab(workspace, group.activeTabId) : null;
}

function selectionFromViewerTab(tab: SidecarViewerTab | null): Selection {
  return tab ? { kind: tab.kind, id: tab.objectId } : { kind: null, id: null };
}

export const SIDECAR_DOCUMENT_VIEWER_DEFAULTS: SidecarDocumentViewerState = {
  zoom: 1,
  fit: 'none',
};

export const SIDECAR_DOCUMENT_ZOOM_MIN = 0.5;
export const SIDECAR_DOCUMENT_ZOOM_MAX = 2.5;
export const SIDECAR_DOCUMENT_ZOOM_STEP = 0.15;

function normalizeDocumentViewerState(value: unknown): SidecarDocumentViewerState {
  if (!isRecord(value)) return { ...SIDECAR_DOCUMENT_VIEWER_DEFAULTS };
  const zoom = typeof value.zoom === 'number' && Number.isFinite(value.zoom)
    ? Math.min(SIDECAR_DOCUMENT_ZOOM_MAX, Math.max(SIDECAR_DOCUMENT_ZOOM_MIN, Number(value.zoom.toFixed(2))))
    : SIDECAR_DOCUMENT_VIEWER_DEFAULTS.zoom;
  const fit = value.fit === 'width' ? 'width' : 'none';
  return { zoom, fit };
}

function normalizeDocumentViewers(value: unknown, workspace: SidecarViewerWorkspace): Record<string, SidecarDocumentViewerState> {
  if (!isRecord(value)) return {};
  const validTabIds = new Set(workspace.tabs.filter((tab) => tab.kind === 'surface').map((tab) => tab.id));
  const next: Record<string, SidecarDocumentViewerState> = {};
  for (const [tabId, viewerState] of Object.entries(value)) {
    if (!validTabIds.has(tabId)) continue;
    next[tabId] = normalizeDocumentViewerState(viewerState);
  }
  return next;
}

function updateDocumentViewer(
  viewers: Record<string, SidecarDocumentViewerState>,
  workspace: SidecarViewerWorkspace,
  tabId: string,
  update: (state: SidecarDocumentViewerState) => SidecarDocumentViewerState,
) {
  if (findViewerTab(normalizeViewerWorkspace(workspace), tabId)?.kind !== 'surface') {
    return pruneDocumentViewers(viewers, workspace);
  }
  return {
    ...pruneDocumentViewers(viewers, workspace),
    [tabId]: normalizeDocumentViewerState(update(normalizeDocumentViewerState(viewers[tabId]))),
  };
}

function openViewerTab(
  workspace: SidecarViewerWorkspace,
  kind: SidecarViewerTabKind,
  objectId: string,
  groupId: SidecarViewerGroupId = workspace.activeGroupId,
): SidecarViewerWorkspace {
  const normalized = normalizeViewerWorkspace(workspace);
  const targetGroupId = normalized.groups.some((group) => group.id === groupId) ? groupId : normalized.activeGroupId;
  const tabId = viewerTabId(kind, objectId);
  const tabs = normalized.tabs.some((tab) => tab.id === tabId)
    ? normalized.tabs
    : [...normalized.tabs, { id: tabId, kind, objectId }];
  const groups = normalized.groups.map((group) => {
    if (group.id !== targetGroupId) return group;
    const tabIds = group.tabIds.includes(tabId) ? group.tabIds : [...group.tabIds, tabId];
    return { ...group, tabIds, activeTabId: tabId };
  });
  return { ...normalized, tabs, groups, activeGroupId: targetGroupId };
}

function selectViewerTab(workspace: SidecarViewerWorkspace, groupId: SidecarViewerGroupId, tabId: string): SidecarViewerWorkspace {
  const normalized = normalizeViewerWorkspace(workspace);
  if (!findViewerTab(normalized, tabId)) return normalized;
  const groups = normalized.groups.map((group) => {
    if (group.id !== groupId) return group;
    const tabIds = group.tabIds.includes(tabId) ? group.tabIds : [...group.tabIds, tabId];
    return { ...group, tabIds, activeTabId: tabId };
  });
  return { ...normalized, groups, activeGroupId: groupId };
}

function closeViewerTab(workspace: SidecarViewerWorkspace, groupId: SidecarViewerGroupId, tabId: string): SidecarViewerWorkspace {
  const normalized = normalizeViewerWorkspace(workspace);
  const groups = normalized.groups.map((group) => {
    if (group.id !== groupId) return group;
    const tabIndex = group.tabIds.indexOf(tabId);
    const tabIds = group.tabIds.filter((candidate) => candidate !== tabId);
    const fallbackIndex = Math.max(0, Math.min(tabIndex, tabIds.length - 1));
    const activeTabId = group.activeTabId === tabId ? tabIds[fallbackIndex] ?? null : group.activeTabId;
    return { ...group, tabIds, activeTabId };
  });
  const referenced = new Set(groups.flatMap((group) => group.tabIds));
  const tabs = normalized.tabs.filter((tab) => referenced.has(tab.id));
  return normalizeViewerWorkspace({ ...normalized, tabs, groups, activeGroupId: groupId });
}

function closeEmptyViewerGroup(workspace: SidecarViewerWorkspace, groupId: SidecarViewerGroupId): SidecarViewerWorkspace {
  const normalized = normalizeViewerWorkspace(workspace);
  if (normalized.split === 'single' || groupId === 'main') return normalized;
  const target = findViewerGroup(normalized, groupId);
  if (!target || target.tabIds.length > 0) return normalized;
  const groups = normalized.groups.filter((group) => group.id !== groupId);
  if (groups.length <= 1) {
    return normalizeViewerWorkspace({
      ...normalized,
      split: 'single',
      activeGroupId: 'main',
      groups,
      ratios: [1],
    });
  }
  return normalizeViewerWorkspace({
    ...normalized,
    split: 'split-vertical',
    activeGroupId: groups.some((group) => group.id === normalized.activeGroupId) ? normalized.activeGroupId : groups[0].id,
    groups,
    ratios: normalizePaneRatios(
      groups.map((group) => normalized.ratios[normalized.groups.findIndex((candidate) => candidate.id === group.id)] ?? 1),
      groups.length,
    ),
  });
}

function pruneDocumentViewers(
  viewers: Record<string, SidecarDocumentViewerState>,
  workspace: SidecarViewerWorkspace,
) {
  return normalizeDocumentViewers(viewers, workspace);
}

function setViewerSplit(workspace: SidecarViewerWorkspace, split: SidecarViewerSplit): SidecarViewerWorkspace {
  const normalized = normalizeViewerWorkspace(workspace);
  const mainGroup = findViewerGroup(normalized, 'main') ?? { id: 'main', tabIds: [], activeTabId: null };
  if (split === 'single') {
    return normalizeViewerWorkspace({ ...normalized, split, activeGroupId: 'main', groups: [mainGroup], ratios: [1] });
  }
  const existingSecondary = findViewerGroup(normalized, 'secondary');
  const secondaryGroup = existingSecondary ?? {
    id: 'secondary' as const,
    tabIds: mainGroup.activeTabId ? [mainGroup.activeTabId] : [],
    activeTabId: mainGroup.activeTabId,
  };
  if (split === 'split-horizontal') {
    return normalizeViewerWorkspace({ ...normalized, split, groups: [mainGroup, secondaryGroup], ratios: [1, 1] });
  }
  const groups = normalized.split === 'split-vertical' && normalized.groups.length > 1
    ? normalized.groups
    : [mainGroup, secondaryGroup];
  return normalizeViewerWorkspace({ ...normalized, split, groups, ratios: normalizePaneRatios(normalized.ratios, groups.length) });
}

function addViewerVerticalGroup(workspace: SidecarViewerWorkspace): SidecarViewerWorkspace {
  const current = normalizeViewerWorkspace(workspace);
  const normalized = current.split === 'split-vertical' && current.groups.length > 1
    ? current
    : setViewerSplit(current, 'split-vertical');
  if (current.split !== 'split-vertical' || current.groups.length <= 1) return normalized;
  if (normalized.groups.length >= SIDECAR_MAX_PANE_GROUPS) return normalized;
  const nextId = nextPaneGroupId(normalized.groups);
  if (!nextId) return normalized;
  const groups = [...normalized.groups, { id: nextId, tabIds: [], activeTabId: null }];
  return normalizeViewerWorkspace({ ...normalized, split: 'split-vertical', groups, activeGroupId: nextId, ratios: equalPaneRatios(groups.length) });
}

function resizeViewerBoundary(workspace: SidecarViewerWorkspace, index: number, deltaRatio: number): SidecarViewerWorkspace {
  const normalized = normalizeViewerWorkspace(workspace);
  if (normalized.split === 'single') return normalized;
  return { ...normalized, ratios: resizePaneRatios(normalized.ratios, index, deltaRatio) };
}

function terminalTabId(sessionId: string) {
  return `session:${sessionId}`;
}

function defaultTerminalWorkspace(): SidecarTerminalWorkspace {
  return {
    ...SIDECAR_TERMINAL_WORKSPACE_DEFAULTS,
    groups: SIDECAR_TERMINAL_WORKSPACE_DEFAULTS.groups.map((group) => ({ ...group, tabIds: [...group.tabIds] })),
    tabs: [...SIDECAR_TERMINAL_WORKSPACE_DEFAULTS.tabs],
    ratios: [...SIDECAR_TERMINAL_WORKSPACE_DEFAULTS.ratios],
  };
}

function normalizeTerminalWorkspace(
  workspace: SidecarTerminalWorkspace | undefined,
  sessions: SessionRecord[],
  seedSessionId: string | null = null,
): SidecarTerminalWorkspace {
  const source = workspace ?? defaultTerminalWorkspace();
  const validSessionIds = new Set(sessions.map((session) => session.id));
  const tabs: SidecarTerminalTab[] = [];
  for (const tab of source.tabs ?? []) {
    if (!validSessionIds.has(tab.sessionId)) continue;
    if (tabs.some((candidate) => candidate.id === tab.id)) continue;
    tabs.push(tab);
  }
  if (seedSessionId && validSessionIds.has(seedSessionId) && !tabs.some((tab) => tab.sessionId === seedSessionId)) {
    tabs.push({ id: terminalTabId(seedSessionId), sessionId: seedSessionId });
  }
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const sourceGroups = source.groups ?? [];
  const mainGroup = sourceGroups.find((group) => group.id === 'main') ?? { id: 'main', tabIds: [], activeTabId: null };
  let normalizedMain = normalizeTerminalGroup(mainGroup, tabIds);
  if (normalizedMain.tabIds.length === 0 && tabs.length > 0) {
    normalizedMain = { ...normalizedMain, tabIds: [tabs[0].id], activeTabId: tabs[0].id };
  }
  const normalizedById = new Map<SidecarTerminalGroupId, SidecarTerminalGroup>([['main', normalizedMain]]);
  for (const id of SIDECAR_PANE_GROUP_IDS.filter((candidate) => candidate !== 'main')) {
    const group = sourceGroups.find((candidate) => candidate.id === id);
    if (group) normalizedById.set(id, normalizeTerminalGroup(group, tabIds));
  }
  const split = source.split ?? 'single';
  let nextGroups: SidecarTerminalGroup[];
  if (split === 'single') {
    nextGroups = [normalizedMain];
  } else if (split === 'split-horizontal') {
    nextGroups = [
      normalizedMain,
      normalizedById.get('secondary') ?? { id: 'secondary', tabIds: [], activeTabId: null },
    ];
  } else {
    nextGroups = SIDECAR_PANE_GROUP_IDS
      .map((id) => normalizedById.get(id) ?? null)
      .filter((group): group is SidecarTerminalGroup => Boolean(group))
      .slice(0, SIDECAR_MAX_PANE_GROUPS);
    if (nextGroups.length === 1) {
      nextGroups = [...nextGroups, { id: 'secondary', tabIds: [], activeTabId: null }];
    }
  }
  const activeGroupId = nextGroups.some((group) => group.id === source.activeGroupId) ? source.activeGroupId : 'main';
  return {
    split,
    activeGroupId,
    tabs,
    groups: nextGroups,
    ratios: normalizePaneRatios(source.ratios, nextGroups.length),
  };
}

function normalizeTerminalGroup(group: SidecarTerminalGroup, validTabIds: Set<string>): SidecarTerminalGroup {
  const tabIds = group.tabIds.filter((tabId, index, values) => validTabIds.has(tabId) && values.indexOf(tabId) === index);
  const activeTabId = group.activeTabId && tabIds.includes(group.activeTabId)
    ? group.activeTabId
    : tabIds[0] ?? null;
  return { ...group, tabIds, activeTabId };
}

function findTerminalTab(workspace: SidecarTerminalWorkspace, tabId: string) {
  return workspace.tabs.find((tab) => tab.id === tabId) ?? null;
}

function findTerminalGroup(workspace: SidecarTerminalWorkspace, groupId: SidecarTerminalGroupId) {
  return workspace.groups.find((group) => group.id === groupId) ?? null;
}

function activeTerminalTab(workspace: SidecarTerminalWorkspace) {
  const group = findTerminalGroup(workspace, workspace.activeGroupId) ?? workspace.groups[0] ?? null;
  return group?.activeTabId ? findTerminalTab(workspace, group.activeTabId) : null;
}

function openTerminalTab(
  workspace: SidecarTerminalWorkspace,
  sessions: SessionRecord[],
  sessionId: string,
  groupId: SidecarTerminalGroupId = workspace.activeGroupId,
): SidecarTerminalWorkspace {
  const normalized = normalizeTerminalWorkspace(workspace, sessions);
  if (!sessions.some((session) => session.id === sessionId)) return normalized;
  const targetGroupId = normalized.groups.some((group) => group.id === groupId) ? groupId : normalized.activeGroupId;
  const tabId = terminalTabId(sessionId);
  const tabs = normalized.tabs.some((tab) => tab.id === tabId)
    ? normalized.tabs
    : [...normalized.tabs, { id: tabId, sessionId }];
  const groups = normalized.groups.map((group) => {
    if (group.id !== targetGroupId) return group;
    const tabIds = group.tabIds.includes(tabId) ? group.tabIds : [...group.tabIds, tabId];
    return { ...group, tabIds, activeTabId: tabId };
  });
  return { ...normalized, tabs, groups, activeGroupId: targetGroupId };
}

function selectTerminalTab(
  workspace: SidecarTerminalWorkspace,
  sessions: SessionRecord[],
  groupId: SidecarTerminalGroupId,
  tabId: string,
): SidecarTerminalWorkspace {
  const normalized = normalizeTerminalWorkspace(workspace, sessions);
  if (!findTerminalTab(normalized, tabId)) return normalized;
  const groups = normalized.groups.map((group) => {
    if (group.id !== groupId) return group;
    const tabIds = group.tabIds.includes(tabId) ? group.tabIds : [...group.tabIds, tabId];
    return { ...group, tabIds, activeTabId: tabId };
  });
  return { ...normalized, groups, activeGroupId: groupId };
}

function closeTerminalTab(
  workspace: SidecarTerminalWorkspace,
  sessions: SessionRecord[],
  groupId: SidecarTerminalGroupId,
  tabId: string,
): SidecarTerminalWorkspace {
  const normalized = normalizeTerminalWorkspace(workspace, sessions);
  const groups = normalized.groups.map((group) => {
    if (group.id !== groupId) return group;
    const tabIndex = group.tabIds.indexOf(tabId);
    const tabIds = group.tabIds.filter((candidate) => candidate !== tabId);
    const fallbackIndex = Math.max(0, Math.min(tabIndex, tabIds.length - 1));
    const activeTabId = group.activeTabId === tabId ? tabIds[fallbackIndex] ?? null : group.activeTabId;
    return { ...group, tabIds, activeTabId };
  });
  const referenced = new Set(groups.flatMap((group) => group.tabIds));
  const tabs = normalized.tabs.filter((tab) => referenced.has(tab.id));
  const activeGroupId = groups.find((group) => group.id === groupId)?.activeTabId
    ? groupId
    : groups.find((group) => group.activeTabId)?.id ?? groupId;
  return normalizeTerminalWorkspace({ ...normalized, tabs, groups, activeGroupId }, sessions);
}

function setTerminalSplit(
  workspace: SidecarTerminalWorkspace,
  sessions: SessionRecord[],
  split: SidecarTerminalSplit,
): SidecarTerminalWorkspace {
  const normalized = normalizeTerminalWorkspace(workspace, sessions);
  const mainGroup = findTerminalGroup(normalized, 'main') ?? { id: 'main', tabIds: [], activeTabId: null };
  if (split === 'single') {
    return normalizeTerminalWorkspace({ ...normalized, split, activeGroupId: 'main', groups: [mainGroup], ratios: [1] }, sessions);
  }
  const existingSecondary = findTerminalGroup(normalized, 'secondary');
  const seedSecondaryTabId = normalized.tabs.find((tab) => tab.id !== mainGroup.activeTabId)?.id ?? mainGroup.activeTabId;
  const secondaryGroup = existingSecondary ?? {
    id: 'secondary' as const,
    tabIds: seedSecondaryTabId ? [seedSecondaryTabId] : [],
    activeTabId: seedSecondaryTabId,
  };
  if (split === 'split-horizontal') {
    return normalizeTerminalWorkspace({ ...normalized, split, groups: [mainGroup, secondaryGroup], ratios: [1, 1] }, sessions);
  }
  const groups = normalized.split === 'split-vertical' && normalized.groups.length > 1
    ? normalized.groups
    : [mainGroup, secondaryGroup];
  return normalizeTerminalWorkspace({ ...normalized, split, groups, ratios: normalizePaneRatios(normalized.ratios, groups.length) }, sessions);
}

function addTerminalVerticalGroup(workspace: SidecarTerminalWorkspace, sessions: SessionRecord[]): SidecarTerminalWorkspace {
  const current = normalizeTerminalWorkspace(workspace, sessions);
  const normalized = current.split === 'split-vertical' && current.groups.length > 1
    ? current
    : setTerminalSplit(current, sessions, 'split-vertical');
  if (current.split !== 'split-vertical' || current.groups.length <= 1) return normalized;
  if (normalized.groups.length >= SIDECAR_MAX_PANE_GROUPS) return normalized;
  const nextId = nextPaneGroupId(normalized.groups);
  if (!nextId) return normalized;
  const groups = [...normalized.groups, { id: nextId, tabIds: [], activeTabId: null }];
  return normalizeTerminalWorkspace({ ...normalized, split: 'split-vertical', groups, activeGroupId: nextId, ratios: equalPaneRatios(groups.length) }, sessions);
}

function resizeTerminalBoundary(workspace: SidecarTerminalWorkspace, sessions: SessionRecord[], index: number, deltaRatio: number): SidecarTerminalWorkspace {
  const normalized = normalizeTerminalWorkspace(workspace, sessions);
  if (normalized.split === 'single') return normalized;
  return { ...normalized, ratios: resizePaneRatios(normalized.ratios, index, deltaRatio) };
}

function secondarySessionIdFromTerminalWorkspace(workspace: SidecarTerminalWorkspace, activeSessionId: string | null) {
  const secondaryGroup = findTerminalGroup(workspace, 'secondary');
  const secondaryTab = secondaryGroup?.activeTabId ? findTerminalTab(workspace, secondaryGroup.activeTabId) : null;
  return secondaryTab && secondaryTab.sessionId !== activeSessionId ? secondaryTab.sessionId : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : null;
}

function isPathHistorySource(value: unknown): value is SidecarPathHistorySource {
  return value === 'browse' || value === 'provider' || value === 'pinned_folder' || value === 'history';
}

function validPathHistoryEntry(value: unknown): SidecarPathHistoryEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.absolutePath !== 'string' || !value.absolutePath.startsWith('/')) return null;
  if (typeof value.projectRoot !== 'string' || !value.projectRoot.startsWith('/')) return null;
  if (typeof value.relativePath !== 'string' || !value.relativePath.trim()) return null;
  if (typeof value.timestamp !== 'string' || !value.timestamp.trim()) return null;
  if (!isPathHistorySource(value.source)) return null;
  return {
    absolutePath: value.absolutePath,
    projectRoot: value.projectRoot,
    relativePath: value.relativePath,
    source: value.source,
    timestamp: value.timestamp,
  };
}

function normalizePathHistory(entries: unknown): SidecarPathHistoryEntry[] {
  if (!Array.isArray(entries)) return [];
  const next: SidecarPathHistoryEntry[] = [];
  for (const candidate of entries) {
    const entry = validPathHistoryEntry(candidate);
    if (!entry) continue;
    const existingIndex = next.findIndex((current) => current.absolutePath === entry.absolutePath);
    if (existingIndex >= 0) next.splice(existingIndex, 1);
    next.push(entry);
  }
  return next
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, SIDECAR_PATH_HISTORY_LIMIT);
}

function appendPathHistory(history: SidecarPathHistoryEntry[], entry: SidecarPathHistoryEntry): SidecarPathHistoryEntry[] {
  const validEntry = validPathHistoryEntry(entry);
  if (!validEntry) return normalizePathHistory(history);
  const retained = normalizePathHistory(history).filter((candidate) => candidate.absolutePath !== validEntry.absolutePath);
  return [validEntry, ...retained].slice(0, SIDECAR_PATH_HISTORY_LIMIT);
}

function isShellLayout(value: unknown): value is SidecarShellLayout {
  return value === 'single' || value === 'split-vertical' || value === 'split-horizontal';
}

function isViewerSplit(value: unknown): value is SidecarViewerSplit {
  return value === 'single' || value === 'split-vertical' || value === 'split-horizontal';
}

function isViewerGroupId(value: unknown): value is SidecarViewerGroupId {
  return SIDECAR_PANE_GROUP_IDS.some((id) => id === value);
}

function isTerminalGroupId(value: unknown): value is SidecarTerminalGroupId {
  return SIDECAR_PANE_GROUP_IDS.some((id) => id === value);
}

function isViewerTabKind(value: unknown): value is SidecarViewerTabKind {
  return value === 'project' || value === 'ticket' || value === 'comment' || value === 'session' || value === 'surface' || value === 'traversal' || value === 'ticket-board' || value === 'ai-workspace';
}

function isInfoSurface(value: unknown): value is SidecarInfoSurface {
  return SIDECAR_EXPLORER_PROVIDERS.some((provider) => provider.id === value);
}

function validWorkbenchLayout(value: unknown): SidecarWorkbenchLayout | null {
  if (!isRecord(value)) return null;
  const { explorerWidthPx, contextRailWidthPx, bottomDockHeightPx } = value;
  if (typeof explorerWidthPx !== 'number' || typeof contextRailWidthPx !== 'number' || typeof bottomDockHeightPx !== 'number') {
    return null;
  }
  return normalizeWorkbenchLayout({
    explorerWidthPx,
    contextRailWidthPx,
    bottomDockHeightPx,
    activeResize: null,
  });
}

function validViewerWorkspace(value: unknown): SidecarViewerWorkspace | null {
  if (!isRecord(value) || !isViewerSplit(value.split) || !isViewerGroupId(value.activeGroupId)) return null;
  if (!Array.isArray(value.tabs) || !Array.isArray(value.groups)) return null;
  const tabs: SidecarViewerTab[] = [];
  for (const tab of value.tabs) {
    if (!isRecord(tab) || typeof tab.id !== 'string' || typeof tab.objectId !== 'string') {
      return null;
    }
    // Forward-only profile migration: discard tabs whose viewer kind was
    // retired without rejecting unrelated pane geometry and operator layout.
    if (!isViewerTabKind(tab.kind)) continue;
    if (tab.id !== viewerTabId(tab.kind, tab.objectId)) return null;
    tabs.push({ id: tab.id, kind: tab.kind, objectId: tab.objectId });
  }
  const groups: SidecarViewerGroup[] = [];
  for (const group of value.groups) {
    const tabIds = isRecord(group) ? stringArray(group.tabIds) : null;
    if (!isRecord(group) || !isViewerGroupId(group.id) || !tabIds) return null;
    if (group.activeTabId !== null && typeof group.activeTabId !== 'string') return null;
    groups.push({ id: group.id, tabIds, activeTabId: group.activeTabId });
  }
  return normalizeViewerWorkspace({ split: value.split, activeGroupId: value.activeGroupId, tabs, groups, ratios: normalizePaneRatios(value.ratios, groups.length) });
}

function validDocumentViewers(value: unknown, workspace: SidecarViewerWorkspace): Record<string, SidecarDocumentViewerState> {
  return normalizeDocumentViewers(value, workspace);
}

function validTerminalWorkspace(value: unknown): SidecarTerminalWorkspace | null {
  if (!isRecord(value) || !isShellLayout(value.split) || !isTerminalGroupId(value.activeGroupId)) return null;
  if (!Array.isArray(value.tabs) || !Array.isArray(value.groups)) return null;
  const tabs: SidecarTerminalTab[] = [];
  for (const tab of value.tabs) {
    if (!isRecord(tab) || typeof tab.id !== 'string' || typeof tab.sessionId !== 'string') return null;
    if (tab.id !== terminalTabId(tab.sessionId)) return null;
    tabs.push({ id: tab.id, sessionId: tab.sessionId });
  }
  const groups: SidecarTerminalGroup[] = [];
  for (const group of value.groups) {
    const tabIds = isRecord(group) ? stringArray(group.tabIds) : null;
    if (!isRecord(group) || !isTerminalGroupId(group.id) || !tabIds) return null;
    if (group.activeTabId !== null && typeof group.activeTabId !== 'string') return null;
    groups.push({ id: group.id, tabIds, activeTabId: group.activeTabId });
  }
  return { split: value.split, activeGroupId: value.activeGroupId, tabs, groups, ratios: normalizePaneRatios(value.ratios, groups.length) };
}

export function validateSidecarLayoutProfile(payload: unknown, contextKey: string): SidecarLayoutProfileValidation {
  if (!isRecord(payload)) return { ok: false, error: 'layout profile is not an object' };
  if (payload.version !== SIDECAR_LAYOUT_PROFILE_VERSION) return { ok: false, error: 'layout profile version is unsupported' };
  if (payload.contextKey !== contextKey) return { ok: false, error: 'layout profile context does not match active Context' };
  if (!isRecord(payload.ui)) return { ok: false, error: 'layout profile ui is not an object' };
  const ui = payload.ui;
  const workbenchLayout = validWorkbenchLayout(ui.workbenchLayout);
  const viewerWorkspace = validViewerWorkspace(ui.viewerWorkspace);
  const terminalWorkspace = validTerminalWorkspace(ui.terminalWorkspace);
  if (typeof ui.infoCollapsed !== 'boolean') return { ok: false, error: 'layout profile infoCollapsed is invalid' };
  if (ui.infoPinned !== undefined && typeof ui.infoPinned !== 'boolean') return { ok: false, error: 'layout profile infoPinned is invalid' };
  if (typeof ui.shellCollapsed !== 'boolean') return { ok: false, error: 'layout profile shellCollapsed is invalid' };
  if (!isShellLayout(ui.shellLayout)) return { ok: false, error: 'layout profile shellLayout is invalid' };
  if (!isInfoSurface(ui.activeInfoSurface)) return { ok: false, error: 'layout profile activeInfoSurface is invalid' };
  if (!workbenchLayout) return { ok: false, error: 'layout profile workbenchLayout is invalid' };
  if (!viewerWorkspace) return { ok: false, error: 'layout profile viewerWorkspace is invalid' };
  if (!terminalWorkspace) return { ok: false, error: 'layout profile terminalWorkspace is invalid' };
  return {
    ok: true,
    profile: {
      version: SIDECAR_LAYOUT_PROFILE_VERSION,
      contextKey,
      ui: {
        infoCollapsed: ui.infoCollapsed,
        infoPinned: ui.infoPinned === true,
        shellCollapsed: ui.shellCollapsed,
        shellLayout: terminalWorkspace.split,
        activeInfoSurface: ui.activeInfoSurface,
        workbenchLayout,
        viewerWorkspace,
        documentViewers: validDocumentViewers(ui.documentViewers, viewerWorkspace),
        terminalWorkspace,
      },
    },
  };
}

export function sidecarLayoutProfileFromState(state: SidecarState, contextKey: string): SidecarLayoutProfile {
  const terminalWorkspace = normalizeTerminalWorkspace(state.ui.terminalWorkspace, state.sessions.records);
  return {
    version: SIDECAR_LAYOUT_PROFILE_VERSION,
    contextKey,
    ui: {
      infoCollapsed: state.ui.infoCollapsed,
      infoPinned: state.ui.infoPinned,
      shellCollapsed: state.ui.shellCollapsed,
      shellLayout: terminalWorkspace.split,
      activeInfoSurface: state.ui.activeInfoSurface,
      workbenchLayout: normalizeWorkbenchLayout({
        ...state.ui.workbenchLayout,
        activeResize: null,
      }),
      viewerWorkspace: normalizeViewerWorkspace(state.ui.viewerWorkspace),
      documentViewers: normalizeDocumentViewers(state.ui.documentViewers, normalizeViewerWorkspace(state.ui.viewerWorkspace)),
      terminalWorkspace,
    },
  };
}

function defaultWorkbenchUi(state: SidecarState): SidecarState['ui'] {
  const terminalWorkspace = normalizeTerminalWorkspace(defaultTerminalWorkspace(), state.sessions.records, state.activeSessionId);
  return {
    infoCollapsed: false,
    infoPinned: false,
    shellCollapsed: true,
    shellLayout: terminalWorkspace.split,
    activeInfoSurface: 'tickets',
    workbenchLayout: { ...SIDECAR_WORKBENCH_LAYOUT_DEFAULTS },
    viewerWorkspace: defaultViewerWorkspace(),
    documentViewers: {},
    terminalWorkspace,
  };
}

function normalizeLoadedState(state: SidecarState) {
  const activeSessionStillExists = state.activeSessionId
    ? state.sessions.records.some((session) => session.id === state.activeSessionId)
    : false;
  const activeSessionId = activeSessionStillExists
    ? state.activeSessionId
    : firstLiveSessionId(state.sessions.records);
  const secondarySessionStillExists = state.secondarySessionId
    ? state.sessions.records.some((session) => session.id === state.secondarySessionId && session.id !== activeSessionId)
    : false;
  const secondarySessionId = secondarySessionStillExists
    ? state.secondarySessionId
    : firstSecondarySessionId(state.sessions.records, activeSessionId);
  const workbenchLayout = normalizeWorkbenchLayout(state.ui.workbenchLayout);
  const viewerWorkspace = normalizeViewerWorkspace(state.ui.viewerWorkspace);
  const documentViewers = normalizeDocumentViewers(state.ui.documentViewers, viewerWorkspace);
  const terminalWorkspace = normalizeTerminalWorkspace(state.ui.terminalWorkspace, state.sessions.records, activeSessionId);
  const terminalTab = activeTerminalTab(terminalWorkspace);
  const normalizedActiveSessionId = terminalTab?.sessionId ?? activeSessionId;
  const normalized = {
    ...state,
    activeSessionId: normalizedActiveSessionId,
    secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, normalizedActiveSessionId) ?? secondarySessionId,
    ticketBoard: reconciledTicketBoardState(state.ticketBoard, state.tickets, state.context?.project.root ?? null),
    traversal: reconciledTraversalState(state.traversal, state.context?.project.root ?? null),
    ui: {
      ...state.ui,
      shellLayout: terminalWorkspace.split,
      workbenchLayout,
      viewerWorkspace,
      documentViewers,
      terminalWorkspace,
    },
  };
  return {
    ...normalized,
    inFlightActions: retainActionsForCurrentContext(normalized),
  };
}

function consumePendingHistorySurface(
  state: SidecarState,
  project: ContextRecord['project'],
): SidecarState {
  const pending = state.pendingHistorySurface;
  if (
    !pending
    || pending.projectId !== project.id
    || pending.projectRoot !== project.root
  ) {
    return state;
  }
  const viewerWorkspace = openViewerTab(
    state.ui.viewerWorkspace,
    'surface',
    pending.relativePath,
  );
  return {
    ...state,
    pendingHistorySurface: null,
    pendingHistoryInitialSurfaceRoot: pending.projectRoot,
    selection: selectionFromViewerTab(activeViewerTab(viewerWorkspace)),
    ui: { ...state.ui, viewerWorkspace },
  };
}

function hasLoadProjectionPayload(payload: Extract<SidecarMsg, { type: 'load/done' }>['payload']) {
  return (
    payload.context !== undefined
    || payload.projects !== undefined
    || payload.comments !== undefined
    || payload.tickets !== undefined
    || payload.sessions !== undefined
    || payload.aiWorkspaceObservation !== undefined
    || payload.pathHistory !== undefined
    || payload.unreadIds !== undefined
    || payload.selection !== undefined
    || payload.activeSessionId !== undefined
    || payload.secondarySessionId !== undefined
    || payload.replyDraft !== undefined
    || payload.ui !== undefined
    || payload.viewerAgent !== undefined
  );
}

function expectedLoadProjectIdentity(
  state: SidecarState,
  requestedRoot: string | null,
): { id: string; root: string } | null {
  if (requestedRoot === null) return null;
  if (state.pendingHistorySurface?.projectRoot === requestedRoot) {
    return {
      id: state.pendingHistorySurface.projectId,
      root: state.pendingHistorySurface.projectRoot,
    };
  }
  const registered = state.projects.find((project) => project.root === requestedRoot);
  if (registered) return { id: registered.id, root: registered.root };
  if (state.context?.project.root === requestedRoot) {
    return { id: state.context.project.id, root: state.context.project.root };
  }
  return null;
}

function loadPayloadMatchesProjectIdentity(
  state: SidecarState,
  payload: SidecarLoadPayload,
  requestedRoot: string | null,
) {
  const context = payload.context ?? null;
  const contextRoot = payload.context?.project.root ?? null;
  if (requestedRoot !== null && contextRoot !== null && contextRoot !== requestedRoot) return false;
  const expectedIdentity = expectedLoadProjectIdentity(state, requestedRoot);
  if (
    context
    && expectedIdentity
    && (
      context.project.id !== expectedIdentity.id
      || context.project.root !== expectedIdentity.root
    )
  ) {
    return false;
  }
  if (context && payload.projects) {
    const contextProject = payload.projects.find(
      (project) => project.root === context.project.root,
    );
    if (
      !contextProject
      || contextProject.id !== context.project.id
      || contextProject.odd_type !== context.project.odd_type
    ) {
      return false;
    }
  }
  const admittedRoot = requestedRoot ?? contextRoot;
  if (
    admittedRoot !== null
    && payload.aiWorkspaceObservation
    && payload.aiWorkspaceObservation.projectRoot !== admittedRoot
  ) {
    return false;
  }
  if (
    admittedRoot !== null
    && payload.sessions
    && payload.sessions.records.some((record) => !isPathWithinProjectRoot(admittedRoot, record.cwd))
  ) {
    return false;
  }
  return true;
}

function isLoadPayloadMismatch(state: SidecarState, requestedRoot: string | null) {
  return requestedRoot !== null && state.context?.project?.root !== requestedRoot;
}

export function updateSidecarState(state: SidecarState, msg: SidecarMsg): SidecarState {
  switch (msg.type) {
    case 'subscription/ready':
      if (!admittedSidecarSubscription(state, msg.subscriptionId, msg.subscriptionType)) return state;
      return withoutSubscriptionFailure(state, msg.subscriptionId);
    case 'subscription/failed': {
      if (!admittedSidecarSubscription(state, msg.subscriptionId, msg.subscriptionType)) return state;
      const failure: SidecarSubscriptionFailure = {
        subscriptionId: msg.subscriptionId,
        subscriptionType: msg.subscriptionType,
        error: msg.error,
      };
      const current = state.subscriptionFailures.find(
        (candidate) => candidate.subscriptionId === msg.subscriptionId,
      );
      if (
        current
        && current.subscriptionType === failure.subscriptionType
        && current.error === failure.error
      ) {
        return state;
      }
      return {
        ...state,
        subscriptionFailures: [
          ...state.subscriptionFailures.filter(
            (candidate) => candidate.subscriptionId !== msg.subscriptionId,
          ),
          failure,
        ],
      };
    }
    case 'project-registry/changed': {
      const subscription = admittedSidecarSubscription(
        state,
        msg.subscriptionId,
        'project-registry.changed',
      );
      if (
        subscription?.type !== 'project-registry.changed'
        || subscription.projectRoot !== msg.projectRoot
      ) {
        return state;
      }
      return updateSidecarState(
        withoutSubscriptionFailure(state, msg.subscriptionId),
        { type: 'load/request', projectRoot: msg.projectRoot, reason: 'action_completed' },
      );
    }
    case 'run/refresh-ticked': {
      const subscription = admittedSidecarSubscription(state, msg.subscriptionId, 'run.refresh');
      if (
        subscription?.type !== 'run.refresh'
        || subscription.workspaceRoot !== msg.workspaceRoot
        || subscription.runId !== msg.runId
      ) {
        return state;
      }
      return updateSidecarState(
        withoutSubscriptionFailure(state, msg.subscriptionId),
        {
          type: 'traversal/load',
          workspaceRoot: msg.workspaceRoot,
          runId: msg.runId,
          refresh: true,
        },
      );
    }
    case 'run/focus-admitted':
      return { ...state, runFocus: msg.focus };
    case 'load/request':
      return {
        ...state,
        loading: true,
        activeLoadRoot: msg.projectRoot,
        activeLoadGeneration: state.nextLoadGeneration,
        inFlightActions: msg.projectRoot !== currentProjectRoot(state)
          ? []
          : state.inFlightActions,
        subscriptionFailures: [],
        pendingHistoryInitialSurfaceRoot: state.pendingHistoryInitialSurfaceRoot === msg.projectRoot
          ? state.pendingHistoryInitialSurfaceRoot
          : null,
      };
    case 'load/start':
      if (
        state.activeLoadRoot !== msg.projectRoot
        || state.activeLoadGeneration !== msg.generation
      ) {
        return state;
      }
      return {
        ...state,
        loading: true,
        activeLoadRoot: msg.projectRoot,
        pendingHistoryInitialSurfaceRoot: state.pendingHistoryInitialSurfaceRoot === msg.projectRoot
          ? state.pendingHistoryInitialSurfaceRoot
          : null,
      };
    case 'load/done':
      if (
        state.activeLoadRoot !== msg.projectRoot
        || state.activeLoadGeneration !== msg.generation
      ) {
        return state;
      }
      if (!loadPayloadMatchesProjectIdentity(state, msg.payload, msg.projectRoot)) {
        return normalizeLoadedState({
          ...state,
          loading: false,
          activeLoadRoot: null,
          activeLoadGeneration: null,
          lastAction: {
            ok: false,
            error: 'load rejected: response identities do not belong to the requested Project',
          },
        });
      }
      if (!hasLoadProjectionPayload(msg.payload)) {
        const next = normalizeLoadedState({
          ...state,
          ...(msg.payload.lastAction ? { lastAction: msg.payload.lastAction } : {}),
          loading: false,
          activeLoadRoot: null,
          activeLoadGeneration: null,
        });
        if (isLoadPayloadMismatch(state, msg.projectRoot)) {
          return {
            ...next,
            tickets: [],
            comments: [],
            projects: [],
            pathHistory: [],
            aiWorkspaceObservation: null,
            unreadIds: [],
            traversal: { ...INITIAL_SIDECAR_TRAVERSAL_STATE, details: [] },
            runFocus: null,
            ticketBoard: { ...INITIAL_SIDECAR_TICKET_BOARD_STATE },
            selection: { kind: null, id: null },
          };
        }
        return next;
      }
      {
        const loaded = normalizeLoadedState({
          ...state,
          ...msg.payload,
          loading: false,
          activeLoadRoot: null,
          activeLoadGeneration: null,
        });
        return msg.payload.context
          ? consumePendingHistorySurface(loaded, msg.payload.context.project)
          : loaded;
      }
    case 'load/failed':
      if (
        state.activeLoadRoot !== msg.projectRoot
        || state.activeLoadGeneration !== msg.generation
      ) return state;
      if (msg.payload && !loadPayloadMatchesProjectIdentity(state, msg.payload, msg.projectRoot)) {
        return normalizeLoadedState({
          ...state,
          loading: false,
          activeLoadRoot: null,
          activeLoadGeneration: null,
          lastAction: {
            ok: false,
            error: 'load rejected: failure payload identities do not belong to the requested Project',
          },
        });
      }
      {
        const loaded = normalizeLoadedState({
          ...state,
          ...(msg.payload ?? {}),
          loading: false,
          activeLoadRoot: null,
          activeLoadGeneration: null,
          lastAction: { ok: false, error: msg.error },
        });
        if (
          !msg.payload?.context
          || msg.payload.context.project.root !== msg.projectRoot
        ) {
          return loaded;
        }
        return consumePendingHistorySurface(loaded, msg.payload.context.project);
      }
    case 'cmd/dispatched': {
      const dispatched = new Set(msg.ids);
      return { ...state, pendingCommands: state.pendingCommands.filter((entry) => !dispatched.has(entry.id)) };
    }
    case 'ui/toggle-workspace': {
      const key = msg.workspace === 'info' ? 'infoCollapsed' : 'shellCollapsed';
      const collapsed = msg.collapsed ?? !state.ui[key];
      return {
        ...state,
        ui: {
          ...state.ui,
          [key]: collapsed,
          ...(msg.workspace === 'info' && collapsed ? { infoPinned: false } : {}),
        },
      };
    }
    case 'ui/set-info-pinned':
      return {
        ...state,
        ui: {
          ...state.ui,
          infoCollapsed: false,
          infoPinned: msg.pinned ?? !state.ui.infoPinned,
        },
      };
    case 'ui/set-shell-layout': {
      const terminalWorkspace = setTerminalSplit(state.ui.terminalWorkspace, state.sessions.records, msg.layout);
      return {
        ...state,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, state.activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: msg.layout,
          terminalWorkspace,
        },
      };
    }
    case 'ui/select-info-surface':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeInfoSurface: msg.surface,
          infoCollapsed: msg.open === false ? true : false,
          infoPinned: msg.open === false ? false : state.ui.infoPinned,
        },
      };
    case 'ui/resize-start': {
      const startValuePx = getLayoutValue(state.ui.workbenchLayout, msg.target);
      return {
        ...state,
        ui: {
          ...state.ui,
          workbenchLayout: {
            ...state.ui.workbenchLayout,
            activeResize: {
              target: msg.target,
              pointerId: msg.pointerId,
              startClientX: msg.clientX,
              startClientY: msg.clientY,
              startValuePx,
            },
          },
        },
      };
    }
    case 'ui/resize-preview':
      return {
        ...state,
        ui: {
          ...state.ui,
          workbenchLayout: setLayoutValue(state.ui.workbenchLayout, msg.target, msg.valuePx),
        },
      };
    case 'ui/resize-commit': {
      if (msg.target === 'bottomDock' && typeof msg.valuePx === 'number') {
        const next = bottomDockResizeState(state, msg.valuePx, null);
        return {
          ...next,
          ui: {
            ...next.ui,
            workbenchLayout: {
              ...next.ui.workbenchLayout,
              activeResize: null,
            },
          },
        };
      }
      const workbenchLayout = msg.target && typeof msg.valuePx === 'number'
        ? setLayoutValue(state.ui.workbenchLayout, msg.target, msg.valuePx)
        : state.ui.workbenchLayout;
      return {
        ...state,
        ui: {
          ...state.ui,
          workbenchLayout: {
            ...workbenchLayout,
            activeResize: null,
          },
        },
      };
    }
    case 'ui/resize-by': {
      if (msg.target === 'bottomDock') {
        return bottomDockResizeState(
          state,
          getLayoutValue(state.ui.workbenchLayout, msg.target) + msg.deltaPx,
          state.ui.workbenchLayout.activeResize,
        );
      }
      return {
        ...state,
        ui: {
          ...state.ui,
          workbenchLayout: setLayoutValue(
            state.ui.workbenchLayout,
            msg.target,
            getLayoutValue(state.ui.workbenchLayout, msg.target) + msg.deltaPx,
          ),
        },
      };
    }
    case 'ui/resize-reset': {
      const workbenchLayout = msg.target
        ? resetLayoutValue(state.ui.workbenchLayout, msg.target)
        : { ...SIDECAR_WORKBENCH_LAYOUT_DEFAULTS };
      return {
        ...state,
        ui: {
          ...state.ui,
          workbenchLayout: {
            ...workbenchLayout,
            activeResize: null,
          },
        },
      };
    }
    case 'layout/profile-loaded': {
      const validation = validateSidecarLayoutProfile(msg.payload, msg.contextKey);
      if (!validation.ok) {
        return { ...state, lastAction: { ok: false, error: `layout profile rejected: ${validation.error}` } };
      }
      const activeViewerGroupId = state.ui.viewerWorkspace.activeGroupId;
      const profileHasActiveViewerGroup = validation.profile.ui.viewerWorkspace.groups.some(
        (group) => group.id === activeViewerGroupId,
      );
      const viewerWorkspaceBase = state.selection.kind
        && state.selection.id
        && !profileHasActiveViewerGroup
        ? state.ui.viewerWorkspace
        : validation.profile.ui.viewerWorkspace;
      const viewerWorkspace = state.selection.kind && state.selection.id
        ? openViewerTab(
            viewerWorkspaceBase,
            state.selection.kind,
            state.selection.id,
            activeViewerGroupId,
          )
        : validation.profile.ui.viewerWorkspace;
      const terminalWorkspace = normalizeTerminalWorkspace(
        validation.profile.ui.terminalWorkspace,
        state.sessions.records,
        state.activeSessionId,
      );
      const terminalTab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = terminalTab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          infoCollapsed: validation.profile.ui.infoCollapsed,
          infoPinned: validation.profile.ui.infoPinned,
          shellCollapsed: validation.profile.ui.shellCollapsed,
          shellLayout: terminalWorkspace.split,
          activeInfoSurface: validation.profile.ui.activeInfoSurface,
          workbenchLayout: validation.profile.ui.workbenchLayout,
          viewerWorkspace,
          documentViewers: normalizeDocumentViewers(validation.profile.ui.documentViewers, viewerWorkspace),
          terminalWorkspace,
        },
      };
    }
    case 'layout/profile-read-succeeded':
      return updateSidecarState(state, {
        type: 'layout/profile-loaded', contextKey: msg.contextKey, payload: msg.payload,
      });
    case 'layout/profile-load-failed':
      return { ...state, lastAction: { ok: false, error: `layout profile load failed: ${msg.error}` } };
    case 'layout/profile-save-failed':
      return { ...state, lastAction: { ok: false, error: `layout profile save failed: ${msg.error}` } };
    case 'layout/profile-reset': {
      const ui = defaultWorkbenchUi(state);
      const terminalTab = activeTerminalTab(ui.terminalWorkspace);
      const activeSessionId = terminalTab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(ui.terminalWorkspace, activeSessionId),
        ui,
      };
    }
    case 'viewer/open': {
      const viewerWorkspace = openViewerTab(state.ui.viewerWorkspace, msg.kind, msg.id, msg.groupId);
      const tab = activeViewerTab(viewerWorkspace);
      return {
        ...state,
        selection: selectionFromViewerTab(tab),
        ui: {
          ...state.ui,
          viewerWorkspace,
          documentViewers: pruneDocumentViewers(state.ui.documentViewers, viewerWorkspace),
        },
      };
    }
    case 'viewer/select-tab': {
      const viewerWorkspace = selectViewerTab(state.ui.viewerWorkspace, msg.groupId, msg.tabId);
      const tab = activeViewerTab(viewerWorkspace);
      const terminalWorkspace = tab?.kind === 'session'
        ? openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, tab.objectId)
        : state.ui.terminalWorkspace;
      const activeSessionId = tab?.kind === 'session' ? tab.objectId : state.activeSessionId;
      return {
        ...state,
        selection: selectionFromViewerTab(tab),
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId) ?? state.secondarySessionId,
        ui: {
          ...state.ui,
          viewerWorkspace,
          documentViewers: pruneDocumentViewers(state.ui.documentViewers, viewerWorkspace),
          terminalWorkspace,
        },
      };
    }
    case 'viewer/close-tab': {
      const viewerWorkspace = closeViewerTab(state.ui.viewerWorkspace, msg.groupId, msg.tabId);
      const tab = activeViewerTab(viewerWorkspace);
      const terminalWorkspace = tab?.kind === 'session'
        ? openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, tab.objectId)
        : state.ui.terminalWorkspace;
      const activeSessionId = tab?.kind === 'session' ? tab.objectId : state.activeSessionId;
      return {
        ...state,
        selection: selectionFromViewerTab(tab),
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId) ?? state.secondarySessionId,
        ui: {
          ...state.ui,
          viewerWorkspace,
          documentViewers: pruneDocumentViewers(state.ui.documentViewers, viewerWorkspace),
          terminalWorkspace,
        },
      };
    }
    case 'viewer/close-group': {
      const viewerWorkspace = closeEmptyViewerGroup(state.ui.viewerWorkspace, msg.groupId);
      const tab = activeViewerTab(viewerWorkspace);
      return {
        ...state,
        selection: selectionFromViewerTab(tab),
        ui: {
          ...state.ui,
          viewerWorkspace,
          documentViewers: pruneDocumentViewers(state.ui.documentViewers, viewerWorkspace),
        },
      };
    }
    case 'viewer/split':
      return {
        ...state,
        ui: {
          ...state.ui,
          viewerWorkspace: setViewerSplit(state.ui.viewerWorkspace, msg.split),
        },
      };
    case 'viewer/split-add-vertical':
      return {
        ...state,
        ui: {
          ...state.ui,
          viewerWorkspace: addViewerVerticalGroup(state.ui.viewerWorkspace),
        },
      };
    case 'viewer/resize-boundary':
      return {
        ...state,
        ui: {
          ...state.ui,
          viewerWorkspace: resizeViewerBoundary(state.ui.viewerWorkspace, msg.index, msg.deltaRatio),
        },
      };
    case 'viewer/reset-ratios': {
      const viewerWorkspace = normalizeViewerWorkspace(state.ui.viewerWorkspace);
      return {
        ...state,
        ui: {
          ...state.ui,
          viewerWorkspace: { ...viewerWorkspace, ratios: equalPaneRatios(viewerWorkspace.groups.length) },
        },
      };
    }
    case 'viewer/focus-group': {
      const viewerWorkspace = normalizeViewerWorkspace({
        ...state.ui.viewerWorkspace,
        activeGroupId: msg.groupId,
      });
      const tab = activeViewerTab(viewerWorkspace);
      const terminalWorkspace = tab?.kind === 'session'
        ? openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, tab.objectId)
        : state.ui.terminalWorkspace;
      const activeSessionId = tab?.kind === 'session' ? tab.objectId : state.activeSessionId;
      return {
        ...state,
        selection: selectionFromViewerTab(tab),
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId) ?? state.secondarySessionId,
        ui: {
          ...state.ui,
          viewerWorkspace,
          terminalWorkspace,
        },
      };
    }
    case 'document/zoom':
      return {
        ...state,
        ui: {
          ...state.ui,
          documentViewers: updateDocumentViewer(state.ui.documentViewers, state.ui.viewerWorkspace, msg.tabId, (viewerState) => ({
            zoom: viewerState.zoom + msg.delta,
            fit: 'none',
          })),
        },
      };
    case 'document/reset':
      return {
        ...state,
        ui: {
          ...state.ui,
          documentViewers: updateDocumentViewer(state.ui.documentViewers, state.ui.viewerWorkspace, msg.tabId, () => ({
            ...SIDECAR_DOCUMENT_VIEWER_DEFAULTS,
          })),
        },
      };
    case 'document/fit-width':
      return {
        ...state,
        ui: {
          ...state.ui,
          documentViewers: updateDocumentViewer(state.ui.documentViewers, state.ui.viewerWorkspace, msg.tabId, () => ({
            zoom: 1,
            fit: 'width',
          })),
        },
      };
    case 'terminal/open': {
      const terminalWorkspace = openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.sessionId, msg.groupId);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/jump-to-session': {
      const terminalWorkspace = openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.sessionId);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellCollapsed: false,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/select-tab': {
      const terminalWorkspace = selectTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.groupId, msg.tabId);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/close-tab': {
      const terminalWorkspace = closeTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.groupId, msg.tabId);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/split': {
      const terminalWorkspace = setTerminalSplit(state.ui.terminalWorkspace, state.sessions.records, msg.split);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      const workbenchLayout = msg.split === 'split-horizontal'
        ? expandBottomDockForHorizontalSplit(state.ui.workbenchLayout)
        : state.ui.workbenchLayout;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          workbenchLayout,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/split-add-vertical': {
      const terminalWorkspace = addTerminalVerticalGroup(state.ui.terminalWorkspace, state.sessions.records);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/resize-boundary': {
      const terminalWorkspace = resizeTerminalBoundary(state.ui.terminalWorkspace, state.sessions.records, msg.index, msg.deltaRatio);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'terminal/reset-ratios': {
      const terminalWorkspace = normalizeTerminalWorkspace(state.ui.terminalWorkspace, state.sessions.records);
      return {
        ...state,
        ui: {
          ...state.ui,
          terminalWorkspace: { ...terminalWorkspace, ratios: equalPaneRatios(terminalWorkspace.groups.length) },
        },
      };
    }
    case 'terminal/focus-group': {
      const terminalWorkspace = normalizeTerminalWorkspace({
        ...state.ui.terminalWorkspace,
        activeGroupId: msg.groupId,
      }, state.sessions.records);
      const tab = activeTerminalTab(terminalWorkspace);
      const activeSessionId = tab?.sessionId ?? state.activeSessionId;
      return {
        ...state,
        activeSessionId,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, activeSessionId),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'path-history/load':
    case 'path-history/read-succeeded':
      return { ...state, pathHistory: normalizePathHistory(msg.entries), pathHistoryLoaded: true };
    case 'path-history/read-failed':
      return { ...state, pathHistoryLoaded: true, lastAction: { ok: false, error: `path history load failed: ${msg.error}` } };
    case 'path-history/write-failed':
      return { ...state, lastAction: { ok: false, error: `path history save failed: ${msg.error}` } };
    case 'path-history/write-succeeded':
      return state;
    case 'path-history/copy-request':
      return { ...state, pathHistory: appendPathHistory(state.pathHistory, msg.entry), pathHistoryLoaded: true };
    case 'pinned-folders/read-succeeded': {
      const paths = normalizePinnedFolderPaths(msg.paths, msg.projectRoot);
      return {
        ...state,
        pinnedFolders: { projectRoot: msg.projectRoot, paths, activePath: null, loaded: true },
      };
    }
    case 'pinned-folders/read-failed':
      return {
        ...state,
        pinnedFolders: { projectRoot: msg.projectRoot, paths: [], activePath: null, loaded: true },
        lastAction: { ok: false, error: `pinned folders load failed: ${msg.error}` },
      };
    case 'pinned-folders/set': {
      const paths = normalizePinnedFolderPaths(msg.paths, msg.projectRoot);
      const activePath = msg.activePath && paths.includes(msg.activePath) ? msg.activePath : null;
      return {
        ...state,
        pinnedFolders: { projectRoot: msg.projectRoot, paths, activePath, loaded: true },
      };
    }
    case 'pinned-folders/select':
      if (state.pinnedFolders.projectRoot !== msg.projectRoot) return state;
      return {
        ...state,
        pinnedFolders: {
          ...state.pinnedFolders,
          activePath: msg.path && state.pinnedFolders.paths.includes(msg.path) ? msg.path : null,
        },
      };
    case 'pinned-folders/write-failed':
      return { ...state, lastAction: { ok: false, error: `pinned folders save failed: ${msg.error}` } };
    case 'pinned-folders/write-succeeded':
      return state;
    case 'initial-surface/request': {
      const key = `${msg.projectRoot}:${msg.surface}:${msg.hasRunFocus ? 'focus' : 'plain'}`;
      if (state.pendingHistoryInitialSurfaceRoot === msg.projectRoot) {
        return {
          ...state,
          initialSurfaceAppliedKey: key,
          pendingHistoryInitialSurfaceRoot: null,
        };
      }
      if (state.initialSurfaceAppliedKey === key || currentProjectRoot(state) !== msg.projectRoot) return state;
      let next: SidecarState = { ...state, initialSurfaceAppliedKey: key };
      if (msg.surface === 'run-inspector') {
        if (msg.hasRunFocus) {
          next = updateSidecarState(next, { type: 'ui/toggle-workspace', workspace: 'info', collapsed: true });
          next = updateSidecarState(next, { type: 'ui/toggle-workspace', workspace: 'shell', collapsed: true });
        }
        next = updateSidecarState(next, { type: 'viewer/open', kind: 'traversal', id: msg.projectRoot });
        return updateSidecarState(next, { type: 'traversal/load', workspaceRoot: msg.projectRoot });
      }
      return updateSidecarState(next, {
        type: 'viewer/open',
        kind: msg.surface === 'ticket-board' ? 'ticket-board' : 'ai-workspace',
        id: msg.projectRoot,
      });
    }
    case 'surface/load-request': {
      if (
        msg.projectRoot === null
        || msg.projectRoot !== currentProjectRoot(state)
        || !isBoundedRelativePath(msg.relativePath)
      ) {
        return state;
      }
      const key = sidecarSurfaceLoadKey(msg.projectRoot, msg.relativePath);
      const previous = state.surfaceLoads[key];
      const requestId = (previous?.requestId ?? 0) + 1;
      return {
        ...state,
        surfaceLoads: {
          ...state.surfaceLoads,
          [key]: { projectRoot: msg.projectRoot, relativePath: msg.relativePath, status: 'loading', requestId, surface: previous?.surface ?? null, error: null, tailFollow: previous?.tailFollow ?? false },
        },
      };
    }
    case 'surface/load-succeeded': {
      const current = state.surfaceLoads[msg.key];
      if (!current || current.requestId !== msg.requestId) return state;
      if (!surfaceMatchesLoad(current, msg.surface)) {
        return {
          ...state,
          surfaceLoads: {
            ...state.surfaceLoads,
            [msg.key]: {
              ...current,
              status: 'error',
              error: 'surface response rejected: identity does not match the requested Project surface',
            },
          },
        };
      }
      return { ...state, surfaceLoads: { ...state.surfaceLoads, [msg.key]: { ...current, status: 'ready', surface: msg.surface, error: null } } };
    }
    case 'surface/load-failed': {
      const current = state.surfaceLoads[msg.key];
      if (!current || current.requestId !== msg.requestId) return state;
      return { ...state, surfaceLoads: { ...state.surfaceLoads, [msg.key]: { ...current, status: 'error', error: msg.error } } };
    }
    case 'surface/tail-follow-set': {
      const key = sidecarSurfaceLoadKey(msg.projectRoot, msg.relativePath);
      const current = state.surfaceLoads[key] ?? { projectRoot: msg.projectRoot, relativePath: msg.relativePath, status: 'idle' as const, requestId: 0, surface: null, error: null, tailFollow: false };
      return { ...state, surfaceLoads: { ...state.surfaceLoads, [key]: { ...current, tailFollow: msg.enabled } } };
    }
    case 'surface/tail-ticked': {
      const subscription = sidecarSubscriptions(state).find((candidate) => (
        candidate.type === 'surface.tail-follow'
        && candidate.projectRoot === msg.projectRoot
        && candidate.relativePath === msg.relativePath
      ));
      if (!subscription) return state;
      return updateSidecarState(
        withoutSubscriptionFailure(state, subscription.subscriptionId),
        { type: 'surface/load-request', projectRoot: msg.projectRoot, relativePath: msg.relativePath, refresh: true },
      );
    }
    case 'folder/load-request': {
      const projectRoot = currentProjectRoot(state);
      if (!projectRoot || !isPathWithinProjectRoot(projectRoot, msg.path)) return state;
      const previous = state.folderLoads[msg.path];
      const requestId = (previous?.requestId ?? 0) + 1;
      return {
        ...state,
        folderLoads: {
          ...state.folderLoads,
          [msg.path]: {
            projectRoot,
            path: msg.path,
            status: 'loading',
            requestId,
            entries: previous?.entries ?? [],
            truncated: previous?.truncated ?? false,
            state: previous?.state ?? 'present',
            error: null,
            loadedAt: previous?.loadedAt ?? null,
          },
        },
      };
    }
    case 'folder/load-succeeded': {
      const current = state.folderLoads[msg.path];
      if (!current || current.requestId !== msg.requestId) return state;
      if (current.projectRoot !== currentProjectRoot(state)) return state;
      const payload = admittedFolderPayload(msg.payload, current.projectRoot, msg.path);
      if (!payload) {
        return {
          ...state,
          folderLoads: {
            ...state.folderLoads,
            [msg.path]: {
              ...current,
              status: 'error',
              error: 'folder response rejected: identity or child ancestry is invalid',
            },
          },
        };
      }
      return {
        ...state,
        folderLoads: {
          ...state.folderLoads,
          [msg.path]: {
            ...current,
            status: 'ready',
            entries: payload.entries,
            truncated: payload.truncated,
            state: payload.state,
            error: null,
            loadedAt: msg.loadedAt,
          },
        },
      };
    }
    case 'folder/load-failed': {
      const current = state.folderLoads[msg.path];
      if (!current || current.requestId !== msg.requestId) return state;
      return { ...state, folderLoads: { ...state.folderLoads, [msg.path]: { ...current, status: 'error', error: msg.error } } };
    }
    case 'project/activate-request':
      return { ...state, lastAction: null };
    case 'project/activate-succeeded':
      return {
        ...state,
        pendingHistorySurface: {
          projectId: msg.projectId,
          projectRoot: msg.projectRoot,
          relativePath: msg.relativePath,
        },
        selection: { kind: 'project', id: msg.projectId },
      };
    case 'project/activate-failed':
      return {
        ...state,
        lastAction: { ok: false, error: `Project activation failed: ${msg.error}` },
      };
    case 'select': {
      const viewerWorkspace = openViewerTab(state.ui.viewerWorkspace, msg.kind, msg.id);
      const terminalWorkspace = msg.kind === 'session'
        ? openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.id)
        : state.ui.terminalWorkspace;
      const next: SidecarState = {
        ...state,
        selection: { kind: msg.kind, id: msg.id },
        ui: {
          ...state.ui,
          viewerWorkspace,
          terminalWorkspace,
        },
      };
      if (msg.kind === 'session') {
        next.activeSessionId = msg.id;
        next.secondarySessionId = secondarySessionIdFromTerminalWorkspace(terminalWorkspace, msg.id);
      }
      if (msg.kind === 'project') {
        const project = state.projects.find((candidate) => candidate.id === msg.id);
        if (project && state.context) {
          next.context = {
            ...state.context,
            project: { id: project.id, root: project.root, odd_type: project.odd_type },
          };
          next.traversal = reconciledTraversalState(state.traversal, project.root);
          next.inFlightActions = retainActionsForCurrentContext(next);
        }
      }
      return next;
    }
    case 'session/select': {
      const terminalWorkspace = openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.id);
      return {
        ...state,
        activeSessionId: msg.id,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, msg.id),
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'session/select-secondary': {
      const terminalWorkspace = msg.id && msg.id !== state.activeSessionId
        ? openTerminalTab(state.ui.terminalWorkspace, state.sessions.records, msg.id, 'secondary')
        : state.ui.terminalWorkspace;
      return {
        ...state,
        secondarySessionId: msg.id && msg.id !== state.activeSessionId ? msg.id : null,
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'session/spawn/done': {
      if (
        state.context?.project.root !== msg.projectRoot
        || !isPathWithinProjectRoot(msg.projectRoot, msg.record.cwd)
      ) {
        return state;
      }
      const records = state.sessions.records.some((session) => session.id === msg.record.id)
        ? state.sessions.records.map((session) => (session.id === msg.record.id ? msg.record : session))
        : [...state.sessions.records, msg.record];
      const sessions = { ...state.sessions, records };
      const terminalWorkspace = openTerminalTab(state.ui.terminalWorkspace, records, msg.record.id, msg.groupId);
      return {
        ...state,
        sessions,
        activeSessionId: msg.record.id,
        secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, msg.record.id),
        lastAction: { ok: true, message: `spawned ${msg.record.id}` },
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
    }
    case 'session/spawn/failed':
      if (currentProjectRoot(state) !== msg.projectRoot) return state;
      return { ...state, lastAction: { ok: false, error: msg.error } };
    case 'reply/open':
      return { ...state, replyDraft: { parentId: msg.parentId, body: '' } };
    case 'reply/edit':
      return state.replyDraft ? { ...state, replyDraft: { ...state.replyDraft, body: msg.body } } : state;
    case 'reply/cancel':
      return { ...state, replyDraft: null };
    case 'traversal/load': {
      const workspaceRoot = traversalRequestedRoot(state, msg);
      const requestedRunId = traversalRequestedRunId(state, msg);
      if (workspaceRoot !== state.traversal.workspaceRoot || requestedRunId !== state.traversal.requestedRunId) {
        return {
          ...state,
          traversal: {
            ...INITIAL_SIDECAR_TRAVERSAL_STATE,
            details: [],
            status: 'loading',
            runStatus: 'loading',
            workspaceRoot,
            requestedRunId,
            selectedRunId: requestedRunId,
            section: workspaceRoot === state.traversal.workspaceRoot ? state.traversal.section : 'overview',
          },
        };
      }
      return {
        ...state,
        traversal: { ...state.traversal, status: 'loading', runStatus: 'loading', error: null, runError: null },
      };
    }
    case 'traversal/load-succeeded':
      if (msg.workspaceRoot !== state.traversal.workspaceRoot || (msg.requestedRunId ?? null) !== state.traversal.requestedRunId) return state;
      {
        const details = state.traversal.details.filter((entry) => !entry.key.endsWith(':latest'));
        const selectedVector = state.traversal.selectedVector?.attempt === null ? null : state.traversal.selectedVector;
        return {
          ...state,
          traversal: {
            ...state.traversal,
            status: 'ready',
            summary: msg.summary,
            selectedRunId: msg.summary.runId ?? state.traversal.selectedRunId,
            selectedVector,
            detailStatus: selectedVector ? state.traversal.detailStatus : 'idle',
            detailError: selectedVector ? state.traversal.detailError : null,
            details,
            error: null,
          },
        };
      }
    case 'traversal/load-failed':
      if (msg.workspaceRoot !== state.traversal.workspaceRoot || (msg.requestedRunId ?? null) !== state.traversal.requestedRunId) return state;
      return {
        ...state,
        traversal: { ...state.traversal, status: 'error', error: msg.error },
      };
    case 'run/load-succeeded':
      if (msg.workspaceRoot !== state.traversal.workspaceRoot || (msg.requestedRunId ?? null) !== state.traversal.requestedRunId) return state;
      return {
        ...state,
        traversal: {
          ...state.traversal,
          runStatus: 'ready',
          runObservation: msg.observation,
          selectedRunId: msg.observation.selectedRunId ?? state.traversal.selectedRunId,
          runError: null,
        },
      };
    case 'run/load-failed':
      if (msg.workspaceRoot !== state.traversal.workspaceRoot || (msg.requestedRunId ?? null) !== state.traversal.requestedRunId) return state;
      return {
        ...state,
        traversal: { ...state.traversal, runStatus: 'error', runError: msg.error },
      };
    case 'run/select':
      if (!state.traversal.runObservation?.runs.some((run) => run.runId === msg.runId)) return state;
      return {
        ...state,
        traversal: {
          ...state.traversal,
          status: 'loading',
          runStatus: 'loading',
          requestedRunId: msg.runId,
          selectedRunId: msg.runId,
          summary: null,
          error: null,
          runError: null,
          selectedVector: null,
          detailStatus: 'idle',
          detailError: null,
          details: [],
        },
      };
    case 'run/select-section':
      return { ...state, traversal: { ...state.traversal, section: msg.section } };
    case 'traversal/select-vector': {
      const selectedVector = normalizedTraversalSelection(msg);
      const key = traversalDetailKey(selectedVector.index, selectedVector.variant, selectedVector.attempt, state.traversal.selectedRunId);
      const cached = traversalCacheHasKey(state.traversal, key);
      return {
        ...state,
        traversal: {
          ...state.traversal,
          selectedVector,
          detailStatus: cached ? 'ready' : 'loading',
          detailError: null,
        },
      };
    }
    case 'traversal/vector-succeeded': {
      if (msg.workspaceRoot !== state.traversal.workspaceRoot || (msg.runId ?? null) !== state.traversal.selectedRunId) return state;
      const key = traversalDetailKey(msg.index, msg.variant, msg.attempt, msg.runId ?? null);
      const selection = state.traversal.selectedVector;
      const selectedKey = selection === null
        ? null
        : traversalDetailKey(selection.index, selection.variant, selection.attempt, state.traversal.selectedRunId);
      const details = appendTraversalDetail(state.traversal.details, { key, detail: msg.detail }, selectedKey);
      const matchesSelection = selection !== null
        && selectedKey === key;
      return {
        ...state,
        traversal: {
          ...state.traversal,
          details,
          ...(matchesSelection ? { detailStatus: 'ready' as const, detailError: null } : {}),
        },
      };
    }
    case 'traversal/vector-failed': {
      if (msg.workspaceRoot !== state.traversal.workspaceRoot || (msg.runId ?? null) !== state.traversal.selectedRunId) return state;
      const key = traversalDetailKey(msg.index, msg.variant, msg.attempt, msg.runId ?? null);
      const selection = state.traversal.selectedVector;
      const matchesSelection = selection !== null
        && traversalDetailKey(selection.index, selection.variant, selection.attempt, state.traversal.selectedRunId) === key;
      if (!matchesSelection) return state;
      return {
        ...state,
        traversal: { ...state.traversal, detailStatus: 'error', detailError: msg.error },
      };
    }
    case 'traversal/clear':
      return { ...state, traversal: { ...INITIAL_SIDECAR_TRAVERSAL_STATE, details: [] } };
    case 'ticket-board/select': {
      // Selection is product state (UX_METHOD §5): reducer-owned, validated
      // against the loaded ticket records. Unknown ids resolve to null.
      const workspaceRoot = currentProjectRoot(state);
      const selectedTicketId = msg.id !== null && state.tickets.some((ticket) => ticket.id === msg.id)
        ? msg.id
        : null;
      return { ...state, ticketBoard: { workspaceRoot, selectedTicketId } };
    }
    case 'action/result': {
      const pending = pendingActionForResult(state, msg);
      if (!pending) return state;
      return {
        ...state,
        inFlightActions: state.inFlightActions.filter(
          (entry) => entry.id !== pending.id,
        ),
        lastAction: { ok: msg.ok, message: msg.message, error: msg.error },
        replyDraft: msg.ok && pending.cmd.type === 'comment.reply'
          ? null
          : state.replyDraft,
      };
    }
    case 'action/feedback':
      return { ...state, lastAction: { ok: msg.ok, message: msg.message, error: msg.error } };
    default:
      return state;
  }
}

export function describeSidecarCommands(state: SidecarState, msg: SidecarMsg): SidecarCmd[] {
  switch (msg.type) {
    case 'load/request':
      return [{ type: 'load', projectRoot: msg.projectRoot, reason: msg.reason }];
    case 'load/done':
    case 'load/failed': {
      const pending = state.pendingHistorySurface;
      const payload = msg.payload;
      const context = payload?.context;
      if (
        state.activeLoadRoot !== msg.projectRoot
        || state.activeLoadGeneration !== msg.generation
        || !pending
        || pending.projectRoot !== msg.projectRoot
        || !payload
        || !context
        || context.project.root !== msg.projectRoot
        || context.project.id !== pending.projectId
        || !loadPayloadMatchesProjectIdentity(state, payload, msg.projectRoot)
      ) {
        return [];
      }
      return [{ type: 'context.publish', context }];
    }
    case 'select': {
      if (msg.kind !== 'project') return [];
      const project = state.projects.find((candidate) => candidate.id === msg.id);
      return project ? [{ type: 'load', projectRoot: project.root, reason: 'project_selected' }] : [];
    }
    case 'ticket/transition/request':
      return state.context
        ? [{ type: 'ticket.transition', id: msg.id, toLane: msg.toLane, context: state.context }]
        : [];
    case 'comment/toggle-read/request':
      return state.context
        ? [{
          type: 'comment.toggleRead',
          id: msg.id,
          currentlyUnread: msg.currentlyUnread,
          context: state.context,
        }]
        : [];
    case 'reply/submit/request':
      return state.context
        ? [{ type: 'comment.reply', parentId: msg.parentId, body: msg.body, context: state.context }]
        : [];
    case 'path-history/copy-request':
      return [
        ...(state.context
          ? [{
            type: 'clipboard.write' as const,
            text: msg.entry.absolutePath,
            label: msg.entry.relativePath,
            context: state.context,
          }]
          : []),
        { type: 'storage.write', scope: 'path-history', key: 'oman-sidecar-path-history', value: appendPathHistory(state.pathHistory, msg.entry) },
      ];
    case 'path-history/read-request':
      return [{ type: 'storage.read', scope: 'path-history', key: 'oman-sidecar-path-history' }];
    case 'pinned-folders/read-request':
      return [{ type: 'storage.read', scope: 'pinned-folders', key: `oman-sidecar-pinned-folders:${msg.projectRoot}`, projectRoot: msg.projectRoot }];
    case 'pinned-folders/read-succeeded': {
      if (pinnedFolderStoragePayloadIsCanonical(msg.paths, msg.projectRoot)) return [];
      return [{
        type: 'storage.write',
        scope: 'pinned-folders',
        key: `oman-sidecar-pinned-folders:${msg.projectRoot}`,
        projectRoot: msg.projectRoot,
        value: normalizePinnedFolderPaths(msg.paths, msg.projectRoot),
      }];
    }
    case 'pinned-folders/set':
      return [{ type: 'storage.write', scope: 'pinned-folders', key: `oman-sidecar-pinned-folders:${msg.projectRoot}`, projectRoot: msg.projectRoot, value: normalizePinnedFolderPaths(msg.paths, msg.projectRoot) }];
    case 'layout/profile-read-request':
      return [{ type: 'storage.read', scope: 'layout-profile', key: `oman-sidecar-layout:${msg.contextKey}`, contextKey: msg.contextKey }];
    case 'layout/profile-write-request':
      return [{ type: 'storage.write', scope: 'layout-profile', key: `oman-sidecar-layout:${msg.contextKey}`, contextKey: msg.contextKey, value: msg.profile }];
    case 'project/activate-request':
      return [{
        type: 'project.activate',
        projectId: msg.projectId,
        projectRoot: msg.projectRoot,
        relativePath: msg.relativePath,
      }];
    case 'project/activate-succeeded':
      return [{ type: 'load', projectRoot: msg.projectRoot, reason: 'project_selected' }];
    case 'session/spawn/request':
      return [{
        type: 'session.spawn',
        projectRoot: currentProjectRoot(state),
        groupId: msg.groupId ?? state.ui.terminalWorkspace.activeGroupId,
        cwd: msg.cwd ?? null,
        label: msg.label ?? null,
        existingSessionIds: state.sessions.records.map((session) => session.id),
      }];
    case 'session/kill/request':
      return state.context
        ? [{ type: 'session.kill', id: msg.id, context: state.context }]
        : [];
    case 'action/result': {
      const pending = pendingActionForResult(state, msg);
      return pending && msg.ok && actionResultReloads(pending.cmd)
        ? [{
          type: 'load',
          projectRoot: pending.cmd.context.project.root,
          reason: 'action_completed',
        }]
        : [];
    }
    case 'project-registry/changed': {
      const subscription = admittedSidecarSubscription(
        state,
        msg.subscriptionId,
        'project-registry.changed',
      );
      return subscription?.type === 'project-registry.changed'
        && subscription.projectRoot === msg.projectRoot
        ? [{ type: 'load', projectRoot: msg.projectRoot, reason: 'action_completed' }]
        : [];
    }
    case 'run/refresh-ticked': {
      const subscription = admittedSidecarSubscription(state, msg.subscriptionId, 'run.refresh');
      if (
        subscription?.type !== 'run.refresh'
        || subscription.workspaceRoot !== msg.workspaceRoot
        || subscription.runId !== msg.runId
      ) {
        return [];
      }
      return [
        { type: 'run.loadObservation', workspaceRoot: msg.workspaceRoot, runId: msg.runId, refresh: true },
        { type: 'traversal.loadSummary', workspaceRoot: msg.workspaceRoot, runId: msg.runId, refresh: true },
      ];
    }
    case 'traversal/load': {
      const workspaceRoot = traversalRequestedRoot(state, msg);
      const runId = traversalRequestedRunId(state, msg);
      const refresh = msg.refresh === true;
      return [
        { type: 'run.loadObservation', workspaceRoot, runId, refresh },
        { type: 'traversal.loadSummary', workspaceRoot, runId, refresh },
      ];
    }
    case 'initial-surface/request':
      if (state.pendingHistoryInitialSurfaceRoot === msg.projectRoot) return [];
      if (state.initialSurfaceAppliedKey === `${msg.projectRoot}:${msg.surface}:${msg.hasRunFocus ? 'focus' : 'plain'}` || currentProjectRoot(state) !== msg.projectRoot) return [];
      return msg.surface === 'run-inspector'
        ? [
          { type: 'run.loadObservation', workspaceRoot: msg.projectRoot, runId: state.traversal.selectedRunId, refresh: false },
          { type: 'traversal.loadSummary', workspaceRoot: msg.projectRoot, runId: state.traversal.selectedRunId, refresh: false },
        ]
        : [];
    case 'surface/load-request': {
      if (
        msg.projectRoot === null
        || msg.projectRoot !== currentProjectRoot(state)
        || !isBoundedRelativePath(msg.relativePath)
      ) {
        return [];
      }
      const key = sidecarSurfaceLoadKey(msg.projectRoot, msg.relativePath);
      const nextRequestId = (state.surfaceLoads[key]?.requestId ?? 0) + 1;
      return [{ type: 'surface.load', key, requestId: nextRequestId, projectRoot: msg.projectRoot, relativePath: msg.relativePath }];
    }
    case 'surface/tail-ticked': {
      const subscription = sidecarSubscriptions(state).find((candidate) => (
        candidate.type === 'surface.tail-follow'
        && candidate.projectRoot === msg.projectRoot
        && candidate.relativePath === msg.relativePath
      ));
      if (!subscription) return [];
      const key = sidecarSurfaceLoadKey(msg.projectRoot, msg.relativePath);
      const current = state.surfaceLoads[key];
      return current
        ? [{ type: 'surface.load', key, requestId: current.requestId + 1, projectRoot: msg.projectRoot, relativePath: msg.relativePath }]
        : [];
    }
    case 'folder/load-request': {
      const projectRoot = currentProjectRoot(state);
      return projectRoot && isPathWithinProjectRoot(projectRoot, msg.path)
        ? [{
          type: 'folder.load',
          projectRoot,
          path: msg.path,
          requestId: (state.folderLoads[msg.path]?.requestId ?? 0) + 1,
        }]
        : [];
    }
    case 'run/select':
      return [
        { type: 'run.loadObservation', workspaceRoot: state.traversal.workspaceRoot, runId: msg.runId, refresh: false },
        { type: 'traversal.loadSummary', workspaceRoot: state.traversal.workspaceRoot, runId: msg.runId, refresh: false },
      ];
    case 'traversal/select-vector': {
      const selection = normalizedTraversalSelection(msg);
      const key = traversalDetailKey(selection.index, selection.variant, selection.attempt, state.traversal.selectedRunId);
      if (traversalCacheHasKey(state.traversal, key)) return [];
      return [{
        type: 'traversal.loadVectorDetail',
        workspaceRoot: state.traversal.workspaceRoot,
        runId: state.traversal.selectedRunId,
        index: selection.index,
        variant: selection.variant,
        attempt: selection.attempt,
      }];
    }
    default:
      return [];
  }
}

export function reduceSidecarState(state: SidecarState, msg: SidecarMsg) {
  const commands = describeSidecarCommands(state, msg);
  let next = updateSidecarState(state, msg);
  if (commands.length > 0) {
    let nextLoadGeneration = state.nextLoadGeneration;
    const pendingCommands = commands.map((cmd, index) => {
      const pending: PendingSidecarCmd = {
        id: `cmd-${state.nextCommandId + index}`,
        cmd,
      };
      if (cmd.type === 'load') {
        pending.loadGeneration = nextLoadGeneration;
        nextLoadGeneration += 1;
      }
      return pending;
    });
    const resultBearing = pendingCommands.filter(
      (entry) => isResultBearingSidecarCmd(entry.cmd),
    );
    const latestLoad = [...pendingCommands].reverse().find(
      (entry) => entry.cmd.type === 'load',
    );
    next = {
      ...next,
      pendingCommands: [...next.pendingCommands, ...pendingCommands],
      inFlightActions: [...next.inFlightActions, ...resultBearing],
      nextCommandId: state.nextCommandId + pendingCommands.length,
      nextLoadGeneration,
      ...(latestLoad?.cmd.type === 'load'
        ? {
          loading: true,
          activeLoadRoot: latestLoad.cmd.projectRoot,
          activeLoadGeneration: latestLoad.loadGeneration ?? null,
          inFlightActions: latestLoad.cmd.projectRoot !== currentProjectRoot(next)
            ? []
            : [...next.inFlightActions, ...resultBearing],
        }
        : {}),
    };
  }
  return { state: next, commands };
}

export function replaySidecarMessages(initialState: SidecarState, messages: SidecarMsg[]) {
  let state = initialState;
  const commands: SidecarCmd[] = [];
  for (const message of messages) {
    const result = reduceSidecarState(state, message);
    commands.push(...result.commands);
    state = result.state;
  }
  return { state, commands };
}
