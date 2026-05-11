import type { TicketRecord } from '../../contracts/ticket';
import type { CommentRecord } from '../../contracts/comment';
import type { SessionRecord, SessionSurfaceDiagnostic } from '../../contracts/session';
import type { ProjectRecord } from '../../contracts/project';
import type { SidecarProcessFlowVariantId, SidecarProcessMapId, SidecarProcessProjection, SidecarProcessViewId } from '../../contracts/process';

export interface ContextRecord {
  project: { id: string; root: string; odd_type: string };
  workspace: { id: string; profile: string };
  session: null | { id: string };
}

export type SelectionKind = 'project' | 'ticket' | 'comment' | 'session' | 'surface' | 'process' | null;
export type SidecarExplorerProviderId = 'projects' | 'tickets' | 'comments' | 'history' | 'browse';
export type SidecarInfoSurface = SidecarExplorerProviderId;

export interface SidecarExplorerProvider {
  id: SidecarExplorerProviderId;
  label: string;
  shortLabel: string;
  selectionKind?: Exclude<SelectionKind, null>;
}

export const SIDECAR_EXPLORER_PROVIDERS: SidecarExplorerProvider[] = [
  { id: 'projects', label: 'Projects', shortLabel: 'P', selectionKind: 'project' },
  { id: 'tickets', label: 'Tickets', shortLabel: 'T', selectionKind: 'ticket' },
  { id: 'comments', label: 'Comments', shortLabel: 'C', selectionKind: 'comment' },
  { id: 'history', label: 'Recent Paths', shortLabel: 'H' },
  { id: 'browse', label: 'Browse', shortLabel: 'B' },
];

export type SidecarPathHistorySource = 'browse' | 'pinned_folder' | 'history';

export interface SidecarPathHistoryEntry {
  absolutePath: string;
  projectRoot: string;
  relativePath: string;
  source: SidecarPathHistorySource;
  timestamp: string;
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
    activeProcessView: SidecarProcessViewId;
    activeProcessMap: SidecarProcessMapId;
    activeProcessRecordId: string | null;
    // T-026: variant selection over the process flow map. V0 is canonical;
    // V1/V2/V4 are §13A scaffolds. Persisted across sessions via the layout
    // profile so the operator's last-used variant is restored.
    activeProcessFlowVariant: SidecarProcessFlowVariantId;
    // T-026 + T-022: focused leaf for the per-leaf workbench (overlay,
    // assurance vector, traced evidence). Null when no leaf is focused.
    activeLeafName: string | null;
    workbenchLayout: SidecarWorkbenchLayout;
    viewerWorkspace: SidecarViewerWorkspace;
    documentViewers: Record<string, SidecarDocumentViewerState>;
    terminalWorkspace: SidecarTerminalWorkspace;
  };
}

export type SidecarLayoutProfileValidation =
  | { ok: true; profile: SidecarLayoutProfile }
  | { ok: false; error: string };

export interface SidecarState {
  context: ContextRecord | null;
  projects: ProjectRecord[];
  tickets: TicketRecord[];
  comments: CommentRecord[];
  sessions: { records: SessionRecord[]; diagnostic: SessionSurfaceDiagnostic | null };
  process: SidecarProcessProjection | null;
  selection: Selection;
  pathHistory: SidecarPathHistoryEntry[];
  activeSessionId: string | null;
  secondarySessionId: string | null;
  ui: {
    infoCollapsed: boolean;
    infoPinned: boolean;
    shellCollapsed: boolean;
    shellLayout: SidecarShellLayout;
    activeInfoSurface: SidecarInfoSurface;
    activeProcessView: SidecarProcessViewId;
    activeProcessMap: SidecarProcessMapId;
    activeProcessRecordId: string | null;
    activeProcessFlowVariant: SidecarProcessFlowVariantId;
    activeLeafName: string | null;
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
  pendingCommands: PendingSidecarCmd[];
  nextCommandId: number;
}

export type SidecarLoadReason = 'initial' | 'project_selected' | 'action_completed';

export type SidecarMsg =
  | { type: 'load/request'; projectRoot: string | null; reason: SidecarLoadReason }
  | { type: 'load/start'; projectRoot: string | null }
  | {
      type: 'load/done';
      projectRoot: string | null;
      payload: {
        context?: ContextRecord | null;
        projects?: ProjectRecord[];
        comments?: CommentRecord[];
        tickets?: TicketRecord[];
        sessions?: { records: SessionRecord[]; diagnostic: SessionSurfaceDiagnostic | null };
        pathHistory?: SidecarPathHistoryEntry[];
        unreadIds?: string[];
        process?: SidecarProcessProjection | null;
        selection?: Selection;
        activeSessionId?: string | null;
        secondarySessionId?: string | null;
        ui?: SidecarState['ui'];
        replyDraft?: { parentId: string; body: string } | null;
        lastAction?: { ok: boolean; message?: string; error?: string } | null;
        viewerAgent?: string;
      }
    }
  | { type: 'cmd/dispatched'; ids: string[] }
  | { type: 'ui/toggle-workspace'; workspace: 'info' | 'shell'; collapsed?: boolean }
  | { type: 'ui/set-info-pinned'; pinned?: boolean }
  | { type: 'ui/set-shell-layout'; layout: SidecarShellLayout }
  | { type: 'ui/select-info-surface'; surface: SidecarInfoSurface; open?: boolean }
  | { type: 'process/select-view'; view: SidecarProcessViewId }
  | { type: 'process/select-map'; map: SidecarProcessMapId }
  | { type: 'process/select-record'; id: string | null }
  | { type: 'process/select-variant'; variant: SidecarProcessFlowVariantId }
  | { type: 'process/select-leaf'; leafName: string | null }
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
  | { type: 'viewer/split'; split: SidecarViewerSplit }
  | { type: 'viewer/split-add-vertical' }
  | { type: 'viewer/resize-boundary'; index: number; deltaRatio: number }
  | { type: 'viewer/reset-ratios' }
  | { type: 'viewer/focus-group'; groupId: SidecarViewerGroupId }
  | { type: 'document/zoom'; tabId: string; delta: number }
  | { type: 'document/reset'; tabId: string }
  | { type: 'document/fit-width'; tabId: string }
  | { type: 'terminal/open'; sessionId: string; groupId?: SidecarTerminalGroupId }
  | { type: 'terminal/select-tab'; groupId: SidecarTerminalGroupId; tabId: string }
  | { type: 'terminal/close-tab'; groupId: SidecarTerminalGroupId; tabId: string }
  | { type: 'terminal/split'; split: SidecarTerminalSplit }
  | { type: 'terminal/split-add-vertical' }
  | { type: 'terminal/resize-boundary'; index: number; deltaRatio: number }
  | { type: 'terminal/reset-ratios' }
  | { type: 'terminal/focus-group'; groupId: SidecarTerminalGroupId }
  | { type: 'select'; kind: Exclude<SelectionKind, null>; id: string }
  | { type: 'path-history/load'; entries: unknown }
  | { type: 'path-history/copy-request'; entry: SidecarPathHistoryEntry }
  | { type: 'session/select'; id: string }
  | { type: 'session/select-secondary'; id: string | null }
  | { type: 'ticket/transition/request'; id: string; toLane: string }
  | { type: 'comment/toggle-read/request'; id: string; currentlyUnread: boolean }
  | { type: 'reply/open'; parentId: string }
  | { type: 'reply/edit'; body: string }
  | { type: 'reply/cancel' }
  | { type: 'reply/submit/request'; parentId: string; body: string }
  | { type: 'session/spawn/request'; groupId?: SidecarTerminalGroupId }
  | { type: 'session/spawn/done'; record: SessionRecord; groupId: SidecarTerminalGroupId }
  | { type: 'session/kill/request'; id: string }
  | { type: 'action/result'; ok: boolean; message?: string; error?: string; reload?: boolean };

export type SidecarCmd =
  | { type: 'load'; projectRoot: string | null; reason: SidecarLoadReason }
  | { type: 'ticket.transition'; id: string; toLane: string; projectRoot: string | null }
  | { type: 'comment.toggleRead'; id: string; currentlyUnread: boolean; projectRoot: string | null }
  | { type: 'comment.reply'; parentId: string; body: string; projectRoot: string | null }
  | { type: 'clipboard.write'; text: string; label: string }
  | { type: 'session.spawn'; projectRoot: string | null; groupId: SidecarTerminalGroupId }
  | { type: 'session.kill'; id: string; projectRoot: string | null };

export interface PendingSidecarCmd {
  id: string;
  cmd: SidecarCmd;
}

export const INITIAL_SIDECAR_STATE: SidecarState = {
  context: null,
  projects: [],
  tickets: [],
  comments: [],
  sessions: { records: [], diagnostic: null },
  process: null,
  selection: { kind: null, id: null },
  pathHistory: [],
  activeSessionId: null,
  secondarySessionId: null,
  ui: {
    infoCollapsed: false,
    infoPinned: false,
    shellCollapsed: false,
    shellLayout: 'single',
    activeInfoSurface: 'tickets',
    activeProcessView: 'active_work',
    activeProcessMap: 'process_flow',
    activeProcessRecordId: null,
    activeProcessFlowVariant: 'v1',
    activeLeafName: null,
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
  pendingCommands: [],
  nextCommandId: 1,
};

function currentProjectRoot(state: SidecarState) {
  return state.context?.project.root ?? null;
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
  if (normalized.split !== 'split-vertical') return normalized;
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
  if (normalized.split !== 'split-vertical') return normalized;
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
  return value === 'browse' || value === 'pinned_folder' || value === 'history';
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
  return value === 'project' || value === 'ticket' || value === 'comment' || value === 'session' || value === 'surface' || value === 'process';
}

function isInfoSurface(value: unknown): value is SidecarInfoSurface {
  return SIDECAR_EXPLORER_PROVIDERS.some((provider) => provider.id === value);
}

function isProcessView(value: unknown): value is SidecarProcessViewId {
  return value === 'active_work' || value === 'blocked_waiting' || value === 'ready_handoff';
}

function isProcessMap(value: unknown): value is SidecarProcessMapId {
  return value === 'process_flow' || value === 'builder_governance' || value === 'runtime_evidence';
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
    if (!isRecord(tab) || typeof tab.id !== 'string' || !isViewerTabKind(tab.kind) || typeof tab.objectId !== 'string') {
      return null;
    }
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
        activeProcessView: isProcessView(ui.activeProcessView) ? ui.activeProcessView : 'active_work',
        activeProcessMap: isProcessMap(ui.activeProcessMap) ? ui.activeProcessMap : 'process_flow',
        activeProcessRecordId: typeof ui.activeProcessRecordId === 'string' ? ui.activeProcessRecordId : null,
        activeProcessFlowVariant: isProcessFlowVariant(ui.activeProcessFlowVariant)
          ? (ui.activeProcessFlowVariant as SidecarProcessFlowVariantId)
          : 'v1',
        activeLeafName: typeof ui.activeLeafName === 'string' ? ui.activeLeafName : null,
        workbenchLayout,
        viewerWorkspace,
        documentViewers: validDocumentViewers(ui.documentViewers, viewerWorkspace),
        terminalWorkspace,
      },
    },
  };
}

function isProcessFlowVariant(value: unknown): value is SidecarProcessFlowVariantId {
  return value === 'v0' || value === 'v1' || value === 'v2' || value === 'v4';
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
      activeProcessView: state.ui.activeProcessView,
      activeProcessMap: state.ui.activeProcessMap,
      activeProcessRecordId: state.ui.activeProcessRecordId,
      activeProcessFlowVariant: state.ui.activeProcessFlowVariant,
      activeLeafName: state.ui.activeLeafName,
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
    shellCollapsed: false,
    shellLayout: terminalWorkspace.split,
    activeInfoSurface: 'tickets',
    activeProcessView: 'active_work',
    activeProcessMap: 'process_flow',
    activeProcessRecordId: null,
    activeProcessFlowVariant: 'v1',
    activeLeafName: null,
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
  return {
    ...state,
    activeSessionId: normalizedActiveSessionId,
    secondarySessionId: secondarySessionIdFromTerminalWorkspace(terminalWorkspace, normalizedActiveSessionId) ?? secondarySessionId,
    ui: {
      ...state.ui,
      shellLayout: terminalWorkspace.split,
      workbenchLayout,
      viewerWorkspace,
      documentViewers,
      terminalWorkspace,
    },
  };
}

function hasLoadProjectionPayload(payload: SidecarMsg & { type: 'load/done' }['payload']) {
  return (
    payload.context !== undefined
    || payload.projects !== undefined
    || payload.comments !== undefined
    || payload.tickets !== undefined
    || payload.sessions !== undefined
    || payload.pathHistory !== undefined
    || payload.unreadIds !== undefined
    || payload.process !== undefined
    || payload.selection !== undefined
    || payload.activeSessionId !== undefined
    || payload.secondarySessionId !== undefined
    || payload.replyDraft !== undefined
    || payload.ui !== undefined
    || payload.viewerAgent !== undefined
  );
}

function isLoadPayloadMismatch(state: SidecarState, requestedRoot: string | null) {
  return requestedRoot !== null && state.context?.project?.root !== requestedRoot;
}

function clearStaleProcessLoadState(state: SidecarState): SidecarState {
  return {
    ...state,
    process: null,
    ui: {
      ...state.ui,
      activeProcessRecordId: null,
      activeLeafName: null,
    },
  };
}

export function updateSidecarState(state: SidecarState, msg: SidecarMsg): SidecarState {
  switch (msg.type) {
    case 'load/request':
      return { ...state, loading: true, activeLoadRoot: msg.projectRoot };
    case 'load/start':
      return { ...state, loading: true, activeLoadRoot: msg.projectRoot };
    case 'load/done':
      if (state.activeLoadRoot !== msg.projectRoot) {
        return state;
      }
      if (!hasLoadProjectionPayload(msg.payload)) {
        const next = clearStaleProcessLoadState(normalizeLoadedState({
          ...state,
          ...(msg.payload.lastAction ? { lastAction: msg.payload.lastAction } : {}),
          loading: false,
          activeLoadRoot: null,
        }));
        if (isLoadPayloadMismatch(state, msg.projectRoot)) {
          return {
            ...next,
            tickets: [],
            comments: [],
            projects: [],
            pathHistory: [],
            unreadIds: [],
            selection: { kind: null, id: null },
          };
        }
        return next;
      }
      return normalizeLoadedState({ ...state, ...msg.payload, loading: false, activeLoadRoot: null });
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
    case 'process/select-view':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeProcessView: msg.view,
          activeProcessRecordId: null,
        },
      };
    case 'process/select-map':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeProcessMap: msg.map,
        },
      };
    case 'process/select-variant':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeProcessFlowVariant: msg.variant,
        },
      };
    case 'process/select-leaf':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeLeafName: msg.leafName,
        },
      };
    case 'process/select-record':
      return {
        ...state,
        ui: {
          ...state.ui,
          activeProcessRecordId: msg.id,
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
          activeProcessView: validation.profile.ui.activeProcessView,
          activeProcessMap: validation.profile.ui.activeProcessMap,
          activeProcessRecordId: validation.profile.ui.activeProcessRecordId,
          workbenchLayout: validation.profile.ui.workbenchLayout,
          viewerWorkspace: validation.profile.ui.viewerWorkspace,
          documentViewers: validation.profile.ui.documentViewers,
          terminalWorkspace,
        },
      };
    }
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
      return { ...state, pathHistory: normalizePathHistory(msg.entries) };
    case 'path-history/copy-request':
      return { ...state, pathHistory: appendPathHistory(state.pathHistory, msg.entry) };
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
        ui: {
          ...state.ui,
          shellLayout: terminalWorkspace.split,
          terminalWorkspace,
        },
      };
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

export function describeSidecarCommands(state: SidecarState, msg: SidecarMsg): SidecarCmd[] {
  switch (msg.type) {
    case 'load/request':
      return [{ type: 'load', projectRoot: msg.projectRoot, reason: msg.reason }];
    case 'select': {
      if (msg.kind !== 'project') return [];
      const project = state.projects.find((candidate) => candidate.id === msg.id);
      return project ? [{ type: 'load', projectRoot: project.root, reason: 'project_selected' }] : [];
    }
    case 'ticket/transition/request':
      return [{ type: 'ticket.transition', id: msg.id, toLane: msg.toLane, projectRoot: currentProjectRoot(state) }];
    case 'comment/toggle-read/request':
      return [{
        type: 'comment.toggleRead',
        id: msg.id,
        currentlyUnread: msg.currentlyUnread,
        projectRoot: currentProjectRoot(state),
      }];
    case 'reply/submit/request':
      return [{ type: 'comment.reply', parentId: msg.parentId, body: msg.body, projectRoot: currentProjectRoot(state) }];
    case 'path-history/copy-request':
      return [{ type: 'clipboard.write', text: msg.entry.absolutePath, label: msg.entry.relativePath }];
    case 'session/spawn/request':
      return [{
        type: 'session.spawn',
        projectRoot: currentProjectRoot(state),
        groupId: msg.groupId ?? state.ui.terminalWorkspace.activeGroupId,
      }];
    case 'session/kill/request':
      return [{ type: 'session.kill', id: msg.id, projectRoot: currentProjectRoot(state) }];
    case 'action/result':
      return msg.ok && msg.reload
        ? [{ type: 'load', projectRoot: currentProjectRoot(state), reason: 'action_completed' }]
        : [];
    default:
      return [];
  }
}

export function reduceSidecarState(state: SidecarState, msg: SidecarMsg) {
  const commands = describeSidecarCommands(state, msg);
  let next = updateSidecarState(state, msg);
  if (commands.length > 0) {
    const pendingCommands = commands.map((cmd, index) => ({
      id: `cmd-${state.nextCommandId + index}`,
      cmd,
    }));
    next = {
      ...next,
      pendingCommands: [...next.pendingCommands, ...pendingCommands],
      nextCommandId: state.nextCommandId + pendingCommands.length,
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
