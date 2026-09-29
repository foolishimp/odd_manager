import type { VisualGraphProjection } from "@odd-manager/developer-control-contracts";

export type VisualGraphStatus = "idle" | "loading" | "ready" | "error";
export type VisualGraphRefreshSource = "run_observation" | "projection" | null;
export type VisualGraphMode = "spatial" | "table";
export type VisualGraphPlane = "declaration" | "occurrence";
export type VisualGraphOverlay = "declaration" | "product-overlays" | "workspace" | "actor-sessions";

export type VisualGraphSelectedOccurrenceNode = {
  plane: "occurrence";
  id: string;
  aggregateType: VisualGraphProjection["occurrenceGraph"]["nodes"][number]["aggregateType"];
};

export type VisualGraphSelectedDeclarationNode = {
  plane: "declaration";
  id: string;
  kind: VisualGraphProjection["declarationTopology"]["nodes"][number]["kind"];
};

export type VisualGraphSelectedNode =
  | VisualGraphSelectedOccurrenceNode
  | VisualGraphSelectedDeclarationNode;

export type VisualGraphRequestBasis = {
  projectRoot: string;
  runId: string;
  generation: string;
  requestId: number;
};

export type VisualGraphDetailState = {
  open: boolean;
  returnFocus: VisualGraphSelectedNode | null;
  focusRestorePending: boolean;
  focusRestoreRequestId: number;
};

export type SidecarVisualGraphState = {
  status: VisualGraphStatus;
  refreshSource: VisualGraphRefreshSource;
  basis: VisualGraphRequestBasis | null;
  nextRequestId: number;
  projection: VisualGraphProjection | null;
  error: string | null;
  selectedNode: VisualGraphSelectedNode | null;
  detail: VisualGraphDetailState;
  plane: VisualGraphPlane;
  mode: VisualGraphMode;
  zoom: number;
  overlayVisibility: Record<VisualGraphOverlay, boolean>;
};

export const VISUAL_GRAPH_MIN_ZOOM = 0.65;
export const VISUAL_GRAPH_MAX_ZOOM = 1.6;
export const VISUAL_GRAPH_ZOOM_STEP = 0.15;

export function clampVisualGraphZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(VISUAL_GRAPH_MAX_ZOOM, Math.max(VISUAL_GRAPH_MIN_ZOOM, Math.round(value * 100) / 100));
}

export function createInitialVisualGraphState(
  preferences?: Partial<Pick<SidecarVisualGraphState, "plane" | "mode" | "zoom" | "overlayVisibility">>,
): SidecarVisualGraphState {
  return {
    status: "idle",
    refreshSource: null,
    basis: null,
    nextRequestId: 1,
    projection: null,
    error: null,
    selectedNode: null,
    detail: {
      open: false,
      returnFocus: null,
      focusRestorePending: false,
      focusRestoreRequestId: 0,
    },
    plane: preferences?.plane ?? "declaration",
    mode: preferences?.mode ?? "spatial",
    zoom: clampVisualGraphZoom(preferences?.zoom ?? 1),
    overlayVisibility: preferences?.overlayVisibility ?? {
      declaration: true,
      "product-overlays": true,
      workspace: true,
      "actor-sessions": true,
    },
  };
}

export function selectedVisualGraphNodeStillExists(
  selection: VisualGraphSelectedNode | null,
  projection: VisualGraphProjection,
) {
  if (!selection) return null;
  if (selection.plane === "declaration") {
    const node = projection.declarationTopology.nodes.find((candidate) => candidate.id === selection.id);
    return node?.kind === selection.kind ? selection : null;
  }
  const node = projection.occurrenceGraph.nodes.find((candidate) => candidate.id === selection.id);
  return node?.aggregateType === selection.aggregateType ? selection : null;
}
