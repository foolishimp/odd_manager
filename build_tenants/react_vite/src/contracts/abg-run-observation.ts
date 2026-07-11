export const ABG_RUN_OBSERVATION_VERSION = 2;

export type AbgRunObservationState = 'ready' | 'unsupported' | 'error';
export type AbgRunStatus = 'active' | 'converged' | 'failed' | 'unknown';
export type AbgRunSection =
  | 'overview'
  | 'graph'
  | 'traversal'
  | 'functions'
  | 'catalog'
  | 'assets'
  | 'diagnostics'
  | 'assurance'
  | 'events'
  | 'stages'
  | 'transcripts'
  | 'artifacts';

export interface AbgObservationDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  sourceRef?: string;
  vectorIndex?: number;
}

export interface AbgProjectIdentity {
  id: string;
  label: string;
  kind: string;
  version: string | null;
  sourceRef: string | null;
  confidence: string;
  governancePackages: string[];
}

export interface AbgRunSummary {
  runId: string;
  runRoot: string;
  workspaceRoot: string;
  scenarioId: string | null;
  scenarioKind: string | null;
  proofClass: string | null;
  graphFunctionRef: string | null;
  status: AbgRunStatus;
  modifiedAt: string;
  lastEventAt: string | null;
  eventCount: number;
}

export interface AbgSystemReference {
  kind: 'graph' | 'graph_function' | 'overlay' | 'startup' | 'event_digest' | 'runtime_binding';
  ref: string;
  sourceRef: string;
}

export interface AbgRunActivity {
  status: AbgRunStatus;
  eventCount: number;
  eventKindCount: number;
  vectorPlannedCount: number;
  vectorEvaluatedCount: number;
  vectorClosedCount: number;
  retryCount: number;
  continuationCount: number;
  terminalCount: number;
  currentVectorIndex: number | null;
  startedAt: string | null;
  lastEventAt: string | null;
  durationMs: number | null;
}

export interface AbgFunctionActivity {
  graphFunctionRef: string;
  selectedCount: number;
  callCount: number;
  frameCount: number;
  vectorIndexes: number[];
  sourceRef: string;
}

export interface AbgCatalogEntryKindCount {
  kind: string;
  count: number;
}

export interface AbgCatalogEntry {
  projectionKey: string;
  entryKind: string;
  name: string;
  entryRef: string | null;
  declarationRef: string | null;
  graphFunctionRef: string | null;
  templateRef: string | null;
  tags: string[];
  inputTypeRefs: string[];
  outputTypeRefs: string[];
  declarationKeys: string[];
  admissionCount: number;
  variantCount: number;
  sourceEventIndexes: number[];
  sourceRef: string;
}

export interface AbgRejectedCatalogEntry {
  entryKind: string;
  entryRef: string | null;
  declarationRef: string | null;
  rejectionReason: string | null;
  conflictingEntryRefs: string[];
  sourceEventIndex: number | null;
  sourceRef: string;
}

export interface AbgConstructionCatalog {
  catalogRef: string;
  episodeId: string | null;
  hookResolutionRef: string | null;
  fallbackConfigDigest: string | null;
  traversalPublicationRefs: string[];
  admissionCount: number;
  sourceEventIndexes: number[];
  sourceRef: string;
}

export interface AbgCatalogProjection {
  state: 'ready' | 'missing';
  sourceKind: 'abg_runtime_events';
  sourceRef: string | null;
  admissionEventCount: number;
  unparsedAdmissionCount: number;
  rejectedEventCount: number;
  constructionCatalogEventCount: number;
  entryCount: number;
  entryKindCounts: AbgCatalogEntryKindCount[];
  entries: AbgCatalogEntry[];
  rejectedEntries: AbgRejectedCatalogEntry[];
  constructionCatalogs: AbgConstructionCatalog[];
  truncated: boolean;
}

export interface AbgAssetActivity {
  path: string;
  producerVectorIndex: number;
  producerStage: string | null;
  targetTypeRef: string | null;
  sha256: string | null;
  byteLength: number | null;
  lineCount: number | null;
  sourceRef: string;
}

export interface AbgTestReportSummary {
  path: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
}

export interface AbgAssuranceSummary {
  evidenceAdmittedCount: number;
  payloadObservedCount: number;
  payloadValidatedCount: number;
  judgedCallCount: number;
  requirementCount: number;
  requirementReachedCount: number;
  testStatus: number | null;
  testPassCount: number | null;
  testReports: AbgTestReportSummary[];
  depthProofRowCount: number;
  depthClasses: string[];
  mutationCount: number;
  mutationKillCount: number;
  mutationRestoreMismatchCount: number;
}

export interface AbgEventKindCount {
  kind: string;
  count: number;
}

export interface AbgEventRow {
  index: number;
  kind: string;
  eventTime: string | null;
  vectorIndex: number | null;
  edge: string | null;
  graphFunctionRef: string | null;
  detail: string | null;
}

export interface AbgStageActivity {
  vectorIndex: number;
  edge: string | null;
  stage: string | null;
  sourceTypeRef: string | null;
  targetTypeRef: string | null;
  status: 'accepted' | 'rejected' | 'pending';
  attemptCount: number;
  hasEvaluator: boolean;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  processEventRef: string | null;
  sourceRef: string | null;
}

export interface AbgTranscript {
  transcriptId: string;
  kind: 'startup' | 'stdout' | 'process_trace';
  label: string;
  contentPreview: string;
  sourceRef: string;
  vectorIndex: number | null;
  truncated: boolean;
}

export interface AbgArtifactReference {
  role: 'proof' | 'identity' | 'event_log' | 'test_result' | 'depth_proof' | 'mutation_outcomes' | 'vector_artifacts' | 'other';
  label: string;
  path: string;
  state: 'present' | 'missing';
  sizeBytes: number | null;
  modifiedAt: string | null;
  digest: string | null;
  observedDigest: string | null;
  digestState: 'verified' | 'mismatch' | 'not_declared' | 'unavailable' | 'not_applicable';
}

export interface AbgRunObservation {
  kind: 'abg_run_observation';
  version: typeof ABG_RUN_OBSERVATION_VERSION;
  generatedAt: string;
  state: AbgRunObservationState;
  projectRoot: string;
  identity: AbgProjectIdentity;
  runs: AbgRunSummary[];
  selectedRunId: string | null;
  selectedRunRoot: string | null;
  selectedWorkspaceRoot: string | null;
  systemReferences: AbgSystemReference[];
  substrate: {
    productId: string | null;
    packageName: string | null;
    packageVersion: string | null;
    releaseTag: string | null;
    sourceCommit: string | null;
  } | null;
  activity: AbgRunActivity | null;
  functions: AbgFunctionActivity[];
  catalog: AbgCatalogProjection;
  assets: AbgAssetActivity[];
  assurance: AbgAssuranceSummary | null;
  eventKinds: AbgEventKindCount[];
  events: AbgEventRow[];
  stages: AbgStageActivity[];
  transcripts: AbgTranscript[];
  artifacts: AbgArtifactReference[];
  diagnostics: AbgObservationDiagnostic[];
}
