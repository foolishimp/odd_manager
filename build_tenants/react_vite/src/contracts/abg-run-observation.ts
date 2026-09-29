export const ABG_RUN_OBSERVATION_VERSION = 3;

export type AbgRunObservationState = 'ready' | 'unsupported' | 'error';
export type AbgPublishedRunStatus = 'active' | 'blocked' | 'closed' | 'failed' | 'gap_stopped' | 'held' | 'refused' | 'stopped' | 'workspace';
export type AbgRunStatus = AbgPublishedRunStatus | 'converged' | 'unknown';
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
  observationLabel?: string | null;
  runId: string;
  runKey: string;
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
  eventPosture: AbgEventPosture;
  eventProfile: AbgEventEnvelopeProfile;
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
  vectorPlannedCount: number | null;
  vectorEvaluatedCount: number | null;
  vectorClosedCount: number | null;
  semanticVectorCount: number | null;
  vectorAttemptCount: number | null;
  openSemanticVectorCount: number | null;
  retryCount: number | null;
  continuationCount: number | null;
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

export type AbgEventPosture =
  | 'non_terminal'
  | 'terminal_converged'
  | 'terminal_failed'
  | 'terminal_observed'
  | 'run_closed'
  | 'terminal_other'
  | 'external_contract_uninterpreted'
  | 'invalid';
export type AbgEventEnvelopeProfile = 'abiogenesis_4_6_flat' | 'abiogenesis_5_root' | 'unknown';

export interface AbgEventCarrierSnapshot {
  physicalRecordCount?: number;
  storageReferenceCount?: number;
  selectedRunId?: string | null;
  ledgerEventCount?: number;
  dependencyEventCount?: number;
  state: 'ready' | 'invalid';
  sourceRef: string;
  generation: string;
  envelopeProfile: AbgEventEnvelopeProfile;
  workflowVersion: string | null;
  eventContractDigest: string | null;
  contractPosture: string;
  observedSizeBytes: number;
  completePrefixBytes: number;
  pendingBytes: number;
  eventCount: number;
  firstOrdinal: number | null;
  lastOrdinal: number | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
  maxLineBytes: number;
  completePrefixDigest: string | null;
  stable: boolean;
  eventPosture: AbgEventPosture;
  terminalEvent: {
    eventId: string;
    ordinal: number;
    eventTime: string;
    terminalKind: string | null;
    reason: string | null;
    basisId: string | null;
  } | null;
  limits: { maxCarrierBytes: number; maxLineBytes: number; maxEvents: number; maxIndexBytes: number };
}

export interface AbgEventPageRow extends AbgEventRow {
  ordinal: number;
  eventId: string;
  graphCallId: string | null;
  frameId: string | null;
  cCallRef: string | null;
  actorInvocationRef: string | null;
  causationEventRefs: string[];
}

export interface AbgEventPage {
  kind: 'abg_event_page';
  version: 1;
  generation: string;
  start: number;
  limit: number;
  total: number;
  rows: AbgEventPageRow[];
  nextStart: number | null;
  previousStart: number | null;
}

export interface AbgEventDetail {
  logicalByteLength?: number;
  storageReference?: { sourceEventRef: string; sourcePayloadDigest: string; sourceSlot: 'basis_input' | 'c_call_result_value'; bodyDigest: string } | null;
  kind: 'abg_event_detail';
  version: 1;
  generation: string;
  ordinal: number;
  eventId: string;
  eventKind: string;
  sourceRef: string;
  sourceByteOffset: number;
  sourceByteLength: number;
  value: Record<string, unknown> | null;
  truncated: boolean;
  refusal: string | null;
}

export interface AbgEventFamilyProjection {
  eventCount: number;
  kindCounts: AbgEventKindCount[];
  rows: Array<{
    ordinal: number;
    eventId: string;
    kind: string;
    eventTime: string | null;
    graphCallId: string | null;
    frameId: string | null;
    vectorIndex: number | null;
    cCallRef: string | null;
    actorInvocationRef: string | null;
    causationEventRefs: string[];
  }>;
  truncated: boolean;
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

export interface AbgSubstrateIdentity {
  productId: string | null;
  packageName: string | null;
  packageVersion: string | null;
  releaseTag: string | null;
  sourceCommit: string | null;
  snapshotCommit: string | null;
  tarballSha256: string | null;
  productToolchainManifestDigest: string | null;
  releaseSnapshotManifestSha256: string | null;
}

export interface AbgRetainedPrefix {
  kind: 'durable_prefix_coordinate'; schemaVersion: '5.0.0';
  eventLogRef: string; prefixLength: number; prefixDigest: string; coordinateDigest: string;
  storeIdentity: { device: number; inode: number; eventContractDigest: string };
}
export interface AbgRunObservation {
  runtimeState?: {
    state: 'published' | 'unavailable'; status: AbgPublishedRunStatus | null;
    reason: string; sourceRef: string | null; sourceDigest: string | null;
    prefix: AbgRetainedPrefix | null; asOfOrdinal: number | null;
    replayRef: string | null; replayDigest: string | null; terminalResultRef: string | null;
    replayFromOrdinal: number | null; replayLimit: number | null;
    coverage: 'exact_retained_prefix' | 'unavailable';
  } | null;
  retainedObservation?: {
    kind: 'retained_prefix_resolution'; originalCoordinate: AbgRetainedPrefix;
    archiveSourceRef: string; receiptSourceRef: string; receiptDigest: string;
  } | null;
  kind: 'abg_run_observation';
  version: typeof ABG_RUN_OBSERVATION_VERSION;
  generatedAt: string;
  state: AbgRunObservationState;
  projectRoot: string;
  identity: AbgProjectIdentity;
  runs: AbgRunSummary[];
  selectedRunId: string | null;
  selectedRunKey: string | null;
  selectedRunRoot: string | null;
  selectedWorkspaceRoot: string | null;
  carrierSnapshot: AbgEventCarrierSnapshot | null;
  eventPosture: AbgEventPosture;
  processPosture: 'unavailable' | 'queued' | 'starting' | 'running' | 'waiting_human' | 'exited' | 'cancelled' | 'disconnected';
  proofReconciliation: {
    state: 'absent' | 'pending' | 'reconciled' | 'conflict' | 'unreadable' | 'unsupported';
    sourceRef: string | null;
    conflicts: string[];
    eventCount: number | null;
    eventDigest: string | null;
  };
  compatibility: {
    posture: string;
    subject: AbgSubstrateIdentity | null;
    reason: string;
  };
  systemReferences: AbgSystemReference[];
  substrate: AbgSubstrateIdentity | null;
  activity: AbgRunActivity | null;
  functions: AbgFunctionActivity[];
  catalog: AbgCatalogProjection;
  assets: AbgAssetActivity[];
  assurance: AbgAssuranceSummary | null;
  eventKinds: AbgEventKindCount[];
  events: AbgEventRow[];
  eventPage: AbgEventPage | null;
  eventFamilies: Record<'run' | 'retryContinuation' | 'actor' | 'cCall' | 'payloadIntegrity' | 'assurance', AbgEventFamilyProjection>;
  stages: AbgStageActivity[];
  transcripts: AbgTranscript[];
  artifacts: AbgArtifactReference[];
  diagnostics: AbgObservationDiagnostic[];
}
