// Traversal projection contract.
//
// Shared boundary for the invocation-aware Traversal View. The
// server derives a bounded summary from an overlay-live proof plus the
// per-vector artifact directory; per-vector detail is fetched lazily. The
// client never receives the full event sequence or all vector artifacts.
//
// Graph calls open invocation frames and vectors belong to frames. Parent/child
// recursion is shown only when the source carrier publishes that linkage; the
// projection does not infer a frame stack from event order. Event kinds are an
// open set: uninterpreted kinds are surfaced, never silently dropped.

export const TRAVERSAL_PROJECTION_VERSION = 1;

export type TraversalProjectionState = 'ready' | 'unsupported' | 'error';

export interface TraversalDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  sourceRef?: string;
}

export interface TraversalScenario {
  scenarioId: string | null;
  scenarioKind: string | null;
  proofClass: string | null;
  durationMs: number | null;
}

export interface TraversalSubstratePin {
  productId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  releaseTag: string | null;
  sourceCommit: string | null;
}

export interface TraversalFrame {
  frameOrdinal: number;
  graphFunctionRef: string | null;
  edge: string | null;
  vectorIndex: number | null;
  openedAt: string | null;
}

export interface TraversalVectorRow {
  vectorIndex: number;
  edge: string | null;
  stage: string | null;
  attemptCount: number;
  hasEvaluator: boolean;
  accepted: boolean | null;
  durationMs: number | null;
  plannedAt: string | null;
  evaluatedAt: string | null;
  frameOrdinal: number | null;
}

export interface TraversalRequirementLineageRow {
  requirementId: string;
  spanIds: string[];
  vectorIndexes: number[];
  reachedVectorIndexes: number[];
  enteringPromptRefCounts: number[];
  coverageStatuses: string[];
  foldStates: string[];
  residualPressureRefs: string[];
}

export interface TraversalProjection {
  kind: 'traversal_projection';
  version: typeof TRAVERSAL_PROJECTION_VERSION;
  state: TraversalProjectionState;
  runId: string | null;
  runRoot: string | null;
  workspaceRoot: string;
  graphRef: string | null;
  graphFunctionRef: string | null;
  overlayRef: string | null;
  startupConfigRef: string | null;
  eventLogDigest: string | null;
  frameLineageState: 'published' | 'unavailable';
  scenario: TraversalScenario;
  substrate: TraversalSubstratePin | null;
  eventCounts: Record<string, number>;
  unknownEventKinds: string[];
  frames: TraversalFrame[];
  vectors: TraversalVectorRow[];
  currentVectorIndex: number | null;
  requirementLineage: TraversalRequirementLineageRow[];
  diagnostics: TraversalDiagnostic[];
}

export type TraversalVectorVariant = 'primary' | 'evaluator';

export interface TraversalVectorVariantRef {
  variant: TraversalVectorVariant;
  attempt: number;
}

export interface TraversalVectorFileRow {
  path: string;
  sha256: string | null;
  byteLength: number | null;
  lineCount: number | null;
}

export interface TraversalVectorContentPreview {
  path: string;
  contentPreview: string;
}

export interface TraversalVectorStagePlan {
  sourceTypeRef: string | null;
  targetTypeRef: string | null;
  vectorId: string | null;
  filesToProduce: string[];
  executeBeforeAssessment: boolean | null;
}

export interface TraversalVectorAssessment {
  accepted: boolean | null;
  reason: string | null;
  nodeTypesUsed: string[];
}

export interface TraversalVectorTiming {
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
}

export interface TraversalVectorDetail {
  kind: 'traversal_vector_detail';
  version: typeof TRAVERSAL_PROJECTION_VERSION;
  vectorIndex: number;
  variant: TraversalVectorVariant;
  attempt: number;
  edge: string | null;
  stage: string | null;
  stagePlan: TraversalVectorStagePlan | null;
  assessment: TraversalVectorAssessment | null;
  materializedFiles: TraversalVectorFileRow[];
  contentPreviews: TraversalVectorContentPreview[];
  timing: TraversalVectorTiming | null;
  availableVariants: TraversalVectorVariantRef[];
  sourcePath: string;
}
