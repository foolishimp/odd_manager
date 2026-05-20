export type SidecarProcessViewId = 'active_work' | 'blocked_waiting' | 'ready_handoff';

export type SidecarProcessMapId = 'process_flow' | 'builder_governance' | 'runtime_evidence' | 'live_view';

export type SidecarProcessTone = 'active' | 'blocked' | 'converged' | 'pending';

export type SidecarProcessMapNodeKind =
  | 'asset'
  | 'frame'
  | 'governance'
  | 'graph_function'
  | 'runtime'
  | 'start_target'
  | 'vector';

export interface SidecarProcessView {
  id: SidecarProcessViewId;
  label: string;
  summary: string;
  recordIds: string[];
}

export interface SidecarProcessRecord {
  id: string;
  viewIds: SidecarProcessViewId[];
  title: string;
  summary: string;
  kind: string;
  tone: SidecarProcessTone;
  status: string;
  graphFunctionId: string | null;
  graphCallId: string | null;
  frameId: string | null;
  vectorIndex: number | null;
  edge: string | null;
  runId: string | null;
  workKey: string | null;
  eventKinds: string[];
  evidenceRefs: string[];
  lastEventIndex: number;
}

export interface SidecarProcessMapNode {
  id: string;
  label: string;
  summary: string;
  kind: SidecarProcessMapNodeKind;
  tone: SidecarProcessTone;
  lane: string;
  column: number;
  row: number;
  recordIds: string[];
}

export interface SidecarProcessMapEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  tone: SidecarProcessTone;
  recordIds: string[];
  // T-024: per-edge outcome glyph + executor profile, projected from the
  // most recent TracedCalloutEvidence for the leaf this edge represents.
  // Absent when no overlay carries an admitted invocation.
  latestOutcome?: TracedProcessOutcomeKind | null;
  executorProfile?: TracedExecutorProfile | null;
  traceArchiveRoot?: string | null;
}

export interface SidecarProcessMapStat {
  label: string;
  value: string;
  tone: SidecarProcessTone;
}

export interface SidecarProcessMap {
  id: SidecarProcessMapId;
  label: string;
  summary: string;
  nodes: SidecarProcessMapNode[];
  edges: SidecarProcessMapEdge[];
  stats: SidecarProcessMapStat[];
}

export interface SidecarProcessProjection {
  kind: 'sidecar_process_projection';
  supported: boolean;
  unsupportedReason?: string;
  contractName: 'odd_sdlc.query-domain';
  contractVersion: 'ts-v1';
  runtimeModel: 'abg-native';
  queryModel: 'odd-domain-read-model';
  readOnly: true;
  workspaceRoot: string;
  eventLogRelativePath: string;
  eventCount: number;
  eventKinds: string[];
  views: SidecarProcessView[];
  records: SidecarProcessRecord[];
  maps: SidecarProcessMap[];
  // Installed odd_sdlc TypeScript traversal overlays projected from query-domain.
  // These are the operator-level graph overlays, distinct from Sidecar's internal
  // process-map renderings.
  traversalOverlays?: SidecarTraversalOverlay[];
  // T-026: catalog backbone projected from `odd-sdlc-ts catalog`.
  // Present when supported === true and the install responds with ts-v1.
  catalog?: SidecarProcessCatalog;
  // T-026: per-leaf overlay projected from `.ai-workspace/runtime/odd_sdlc/operator-runs/<oprun>/`.
  // Each entry keyed by leaf graph function name; absent when no op-run is selected.
  leafOverlays?: SidecarLeafOverlay[];
  // T-161: read-only FD run analysis projection from `odd-sdlc-ts analyze-run`.
  // This is an admitted analysis read model over operator-run archives; the UX
  // renders it but does not inspect the filesystem directly.
  liveAnalysis?: SidecarLiveAnalysisProjection | null;
  // T-026: variant identifier for the process flow map, selected by the sidecar reducer.
  // The carrier itself is variant-agnostic; this field records which variant the consumer is rendering.
  // Absent on initial fetch; set when the user picks a variant from the tab strip.
  activeProcessFlowVariant?: SidecarProcessFlowVariantId;
}

// ---------------------------------------------------------------------------
// T-026: catalog dimension — executives, leaves, library functions, triage.
// Maps directly onto `BOOTSTRAP_RELEASE_FUNCTION_CATALOG`,
// `OPERATIONAL_FUNCTION_CATALOG`, `TRIAGE_FUNCTION_CATALOG`, and
// `REUSABLE_GRAPH_FUNCTION_CATALOG` published by the odd_sdlc TS tenant.
// ---------------------------------------------------------------------------

export type SidecarLeafCatalogId = 'bootstrap' | 'operational' | 'triage';

export type SidecarComputeRegime = 'F_D' | 'F_P' | 'F_H';

export interface SidecarLeafEvaluator {
  name: string;
  regime: SidecarComputeRegime;
  binding: string;
}

export interface SidecarLeafGraphFunctionView {
  kind: 'sidecar_leaf_graph_function_view';
  name: string;
  intent: string;
  inputs: string[];
  outputs: string[];
  catalog: SidecarLeafCatalogId;
  transformContractRef: string;
  evaluationContractRef: string;
  traversalModulationStrategy: string;
  proofObligations: string[];
  requirementRefs: string[];
  evaluators: SidecarLeafEvaluator[];
  operator: SidecarLeafEvaluator;
}

export interface SidecarExecutiveView {
  kind: 'sidecar_executive_view';
  name: string;
  intent: string;
  steps: string[];
  outputs: string[];
}

export interface SidecarLibraryFunctionView {
  kind: 'sidecar_library_function_view';
  name: string;
  intent: string;
  stableOuterContract: string;
  computeOrder: string[];
  abgOwnedRuntimeTruth: string[];
  sdlcOwnedDomainTruth: string[];
}

export interface SidecarProcessCatalog {
  kind: 'sidecar_process_catalog';
  contractName: 'odd_sdlc.catalog';
  contractVersion: 'ts-v1';
  fetchedAt: string;
  installRoot: string;
  executives: SidecarExecutiveView[];
  leaves: SidecarLeafGraphFunctionView[];
  library: SidecarLibraryFunctionView[];
}

export type SidecarOverlayTerminalRole = 'terminal_asset' | 'supporting_asset';

export interface SidecarOverlayAssetTemplate {
  kind: 'sidecar_overlay_asset_template';
  assetType: string;
  defaultPath: string;
  producerGraphFunctionRef: string;
  terminalRole: SidecarOverlayTerminalRole;
  templateRef: string;
}

export interface SidecarTraversalOverlay {
  kind: 'sidecar_traversal_overlay';
  overlayRef: string;
  name: string;
  intent: string;
  graphFunctionRefs: string[];
  graphVectorRefs: string[];
  publicStartTargets: string[];
  defaultStartTarget: string;
  terminalAssetTypes: string[];
  terminalGraphFunctionRefs: string[];
  lawfulStopDispositions: string[];
  nextEligibleOverlayRefs: string[];
  predecessorOverlayRefs: string[];
  assetTemplates: SidecarOverlayAssetTemplate[];
}

// ---------------------------------------------------------------------------
// T-026: per-leaf overlay — runtime status + 7-dim assurance vector + trace
// archive ref + (optional) traced call-out evidence per supervised actor
// invocation. Built per active op-run from the workspace's
// `.ai-workspace/runtime/odd_sdlc/operator-runs/<oprun>/` substrate.
// ---------------------------------------------------------------------------

export type SidecarLeafInvocationStatus =
  | 'queued'
  | 'running'
  | 'fp_succeeded'
  | 'fd_postflight_passed'
  | 'failed'
  | 'unattested';

export type SidecarAssuranceCellState = 'pass' | 'fail' | 'pending';

export interface SidecarAssuranceLedgerVector {
  kind: 'sidecar_assurance_ledger_vector';
  materialization: SidecarAssuranceCellState;
  semanticConvergence: SidecarAssuranceCellState;
  obligationCarry: SidecarAssuranceCellState;
  requirementFulfillment: SidecarAssuranceCellState;
  ambiguity: SidecarAssuranceCellState;
  capability: SidecarAssuranceCellState;
  shallowRealization: SidecarAssuranceCellState;
}

export type SidecarEdgeClosureDisposition =
  | 'close'
  | 'yield'
  | 'retry'
  | 'repair'
  | 're-enter'
  | 'reprice'
  | 'block';

export type SidecarEdgeAssuranceCarrierState =
  | 'absent'
  | 'incomplete'
  | 'complete';

export interface SidecarEdgeAssuranceCounts {
  expected: number;
  fulfilled: number;
  partial: number;
  blocked: number;
  unfulfilled: number;
  missing: number;
  extra: number;
}

export interface SidecarEdgeAssuranceOverlay {
  kind: 'sidecar_edge_assurance_overlay';
  carrierState: SidecarEdgeAssuranceCarrierState;
  opRunRoot: string;
  edgeName: string;
  edgeRef: string | null;
  vectorIndex: number | null;
  targetAssetType: string | null;
  edgeAssuranceContractRef: string | null;
  edgeAssuranceContractDigest: string | null;
  edgeGainRef: string | null;
  edgeClosureFunctionRef: string | null;
  edgeResidualPressureRefs: string[];
  ledgerRef: string | null;
  ledgerVersionRef: string | null;
  closureDecisionRef: string | null;
  closureDisposition: SidecarEdgeClosureDisposition | null;
  closeReady: boolean;
  edgeConverged: boolean | null;
  carryConverged: boolean | null;
  fulfillmentConverged: boolean | null;
  admitted: boolean | null;
  targetCertificationPassed: boolean | null;
  fdRecheckPassed: boolean | null;
  counts: SidecarEdgeAssuranceCounts | null;
  materializationRefCount: number;
  admissionRefCount: number;
  evidenceBundleRefCount: number;
  targetBindingRefCount: number;
  nextActionBasisKind: string | null;
  nextGraphVectorRef: string | null;
  selectedActionRef: string | null;
  reasonRefs: string[];
  gapPressureRefs: string[];
  diagnostics: string[];
}

export interface SidecarLeafOverlay {
  kind: 'sidecar_leaf_overlay';
  leafName: string;
  opRunId: string;
  invocationCount: number;
  latestStatus: SidecarLeafInvocationStatus;
  assuranceVector: SidecarAssuranceLedgerVector | null;
  traceArchiveRoot: string | null;
  // T-022: per-call traced evidence. Multiple invocations of one leaf
  // produce multiple TracedCalloutEvidence entries; the array is empty
  // when no admitted invocation has produced result.json yet.
  tracedEvidence: TracedCalloutEvidence[];
  // T-164: ledger-derived edge close state. This is separate from invocation
  // status because worker/postflight/artifact evidence is not metric authority.
  edgeAssurance: SidecarEdgeAssuranceOverlay | null;
}

// ---------------------------------------------------------------------------
// T-161 live analysis — compact read model over `sdlc_fd_run_analysis`.
// The backend maps the installed odd_sdlc analysis payload into this stable
// Sidecar contract so the Process Navigator can render live run detail without
// re-declaring the upstream analyzer's full internal type surface.
// ---------------------------------------------------------------------------

export type SidecarLiveAnalysisInspectedKind = 'workspace' | 'run-archive' | 'operator-run';

export type SidecarLiveAnalysisProfile = 'hello_world' | 'data_mapper' | 'generic';

export type SidecarLiveAnalysisDiagnosticSeverity = 'info' | 'warn' | 'error';

export type SidecarLiveAnalysisProductiveSignal =
  | 'progressing'
  | 'stalled_with_io'
  | 'stalled_no_io'
  | 'completed'
  | 'aborted_or_killed'
  | 'unknown';

export type SidecarLiveAnalysisStageClass =
  | 'constructive'
  | 'projection'
  | 'rollup'
  | 'missing'
  | 'unmapped';

export type SidecarLiveAnalysisRuntimeGapStatus = 'missing' | 'malformed' | 'incomplete';

export type SidecarLiveAnalysisRetryCauseClass =
  | 'prompt_schema_gap'
  | 'framework_carrier_parser_drift'
  | 'worker_policy_violation'
  | 'target_carrier_admission_missing'
  | 'deterministic_evaluator_bug'
  | 'harness_bug'
  | 'runtime_bug'
  | 'tenant_source_defect'
  | 'unknown';

export type SidecarLiveAnalysisLineageStatus = 'present' | 'absent' | 'unknown';

export type SidecarLiveAnalysisTranscriptSourceKind =
  | 'terminal_transcript'
  | 'worker_stdout'
  | 'final_output'
  | 'missing';

export type SidecarLiveAnalysisTranscriptTone =
  | 'default'
  | 'active'
  | 'pending'
  | 'blocked';

export interface SidecarLiveAnalysisByteSummary {
  totalBytes: number;
  promptContextBytes: number;
  handoffBytes: number;
  stdoutBytes: number;
  runtimeEventBytes: number;
}

export interface SidecarLiveAnalysisTelemetry {
  inspectedRoot: string;
  inspectedKind: SidecarLiveAnalysisInspectedKind;
  scenarioName: string | null;
  profile: SidecarLiveAnalysisProfile;
  operatorRunCount: number;
  graphEdgeSequence: string[];
  sameEdgeRetryCount: number;
  blockedAttemptCount: number;
  repairAttemptCount: number;
  abortedAttemptCount: number;
  finalClosureDisposition: string | null;
  totalWallClockMs: number | null;
  totalWorkerElapsedMs: number;
  archiveBytes: SidecarLiveAnalysisByteSummary;
  productFileCount: number;
  requirementObligationCount: number;
  productFileLineageCount: number;
}

export interface SidecarLiveAnalysisLiveness {
  activeOperatorRunRef: string | null;
  activeOperatorRunPath: string | null;
  activeEdgeRef: string | null;
  activeGraphVectorRef: string | null;
  activeTargetAssetType: string | null;
  workerPid: number | null;
  processAlive: boolean | null;
  lastEventAtMs: number | null;
  lastStdoutAtMs: number | null;
  heartbeatAgeMs: number | null;
  maxNoOutputGapMs: number | null;
  archiveGrowthBytesPerMinute: number | null;
  productiveSignal: SidecarLiveAnalysisProductiveSignal;
  lastBlockingReason: string | null;
}

export interface SidecarLiveAnalysisAttempt {
  kind: 'sidecar_live_analysis_attempt';
  attemptOrdinal: number;
  operatorRunRef: string;
  operatorRunPath: string | null;
  graphFunctionName: string | null;
  graphVectorRef: string | null;
  targetAssetType: string | null;
  traversalClass: SidecarLiveAnalysisStageClass;
  workerElapsedMs: number | null;
  edgeWindowElapsedMs: number | null;
  deterministicElapsedMs: number | null;
  fpEvaluateStatus: string | null;
  postflightStatus: string | null;
  executionEvidenceStatus: string | null;
  executionEvidenceReportCount: number;
  residualPressureRefCount: number;
  residualPressureTransition: string | null;
  closureDisposition: string | null;
  selectedNextActionRef: string | null;
  predecessorAttemptRef: string | null;
  blockingReasonCodes: string[];
  productFilesWritten: string[];
  productFilesReplayed: string[];
  requirementObligationCount: number | null;
  productLineageCount: number;
  promptContextBytes: number;
  handoffBytes: number;
  stdoutBytes: number;
  eventBytes: number;
  workerStatus: string | null;
  detail: SidecarLiveAnalysisRunDetail;
}

export interface SidecarLiveAnalysisDiagnostic {
  kind: 'sidecar_live_analysis_diagnostic';
  code: string;
  severity: SidecarLiveAnalysisDiagnosticSeverity;
  detail: string;
  evidenceRefs: string[];
  operatorRunRef: string | null;
  edgeName: string | null;
  policyRef: string | null;
}

export interface SidecarLiveAnalysisRuntimeGap {
  kind: 'sidecar_live_analysis_runtime_gap';
  artifact: string;
  status: SidecarLiveAnalysisRuntimeGapStatus;
  detail: string | null;
}

export interface SidecarLiveAnalysisRetryForensic {
  kind: 'sidecar_live_analysis_retry_forensic';
  edgeName: string;
  predecessorAttemptRef: string | null;
  workerSecondsBefore: number | null;
  blockingReasonCodes: string[];
  changedFiles: string[];
  productFilesObserved: string[];
  productFilesMaterialized: string[];
  productFilesReplayed: string[];
  lineageStatus: SidecarLiveAnalysisLineageStatus;
  outsideWorkspaceReadCount: number;
  schemaViolationCount: number;
  likelyCauseClass: SidecarLiveAnalysisRetryCauseClass;
}

export interface SidecarLiveAnalysisStageCoverage {
  kind: 'sidecar_live_analysis_stage_coverage';
  test35StageRef: string;
  expectedEdgeName: string;
  expectedTargetAssetType: string;
  mappedEdgeName: string | null;
  mappedTargetAssetType: string | null;
  stageClass: SidecarLiveAnalysisStageClass;
}

export interface SidecarLiveAnalysisAssuranceLedgerSummary {
  kind: 'sidecar_live_analysis_assurance_ledger';
  dimension: string;
  verdict: string;
  required: boolean;
  evidenceRefCount: number;
  carryForwardObligationRefCount: number;
  reasonCount: number;
}

export interface SidecarLiveAnalysisAssuranceSummary {
  kind: 'sidecar_live_analysis_assurance_summary';
  status: string | null;
  satisfiedDimensions: string[];
  missingRequiredDimensions: string[];
  gapReasonCount: number;
  blockingReasonCount: number;
  ledgers: SidecarLiveAnalysisAssuranceLedgerSummary[];
}

export interface SidecarLiveAnalysisTranscriptLine {
  kind: 'sidecar_live_analysis_transcript_line';
  index: number;
  eventType: string;
  role: string | null;
  label: string;
  text: string;
  tone: SidecarLiveAnalysisTranscriptTone;
}

export interface SidecarLiveAnalysisCliTranscript {
  kind: 'sidecar_live_analysis_cli_transcript';
  sourceKind: SidecarLiveAnalysisTranscriptSourceKind;
  sourcePath: string | null;
  byteCount: number;
  lineCount: number;
  lines: SidecarLiveAnalysisTranscriptLine[];
}

export interface SidecarLiveAnalysisRunDetail {
  kind: 'sidecar_live_analysis_run_detail';
  edgeAssurance: SidecarEdgeAssuranceOverlay | null;
  assurance: SidecarLiveAnalysisAssuranceSummary | null;
  runtimeGaps: SidecarLiveAnalysisRuntimeGap[];
  diagnostics: SidecarLiveAnalysisDiagnostic[];
  retryForensics: SidecarLiveAnalysisRetryForensic[];
  stageCoverage: SidecarLiveAnalysisStageCoverage[];
  cliTranscript: SidecarLiveAnalysisCliTranscript;
}

export interface SidecarLiveAnalysisProjection {
  kind: 'sidecar_live_analysis_projection';
  sourceKind: 'sdlc_fd_run_analysis';
  version: number;
  generatedAt: string;
  readOnly: true;
  telemetry: SidecarLiveAnalysisTelemetry;
  liveness: SidecarLiveAnalysisLiveness;
  attempts: SidecarLiveAnalysisAttempt[];
  diagnostics: SidecarLiveAnalysisDiagnostic[];
  runtimeArtifactGapCount: number;
  retryForensicCount: number;
  summaryDriftCount: number;
  evidenceIndex: string[];
}

// ---------------------------------------------------------------------------
// T-022: TracedCalloutEvidence per supervised actor invocation.
// Maps onto the `result.json` shape published by abiogenesis 3.5.0-rc.1
// universal traced call-out substrate (T-108 / T-109 / T-110 / T-111).
// ---------------------------------------------------------------------------

export type TracedProcessOutcomeKind =
  | 'exited'
  | 'signaled'
  | 'hard_timeout'
  | 'inactivity_timeout'
  | 'executor_unavailable'
  | 'launch_failed'
  | 'process_error'
  | 'lost_terminal';

export type TracedExecutorProfile = 'local-spawn' | 'pty-terminal';

export type TracedStreamModel = 'stdio' | 'terminal-transcript';

export type TracedParser = 'generic-text' | 'claude-stream-json';

export interface TracedProcessOutcome {
  kind: TracedProcessOutcomeKind;
  detail: string | null;
}

export interface TracedArchivePaths {
  meta: string;
  command: string;
  events: string;
  stdout: string;
  stderr: string;
  finalOutput: string;
  result: string;
  // null when executor profile is not pty-terminal.
  terminalTranscript: string | null;
}

export interface TracedCalloutEvidence {
  kind: 'traced_callout_evidence';
  invocationId: string;
  outcome: TracedProcessOutcome;
  executorProfile: TracedExecutorProfile;
  streamModel: TracedStreamModel;
  parser: TracedParser;
  status: number | null;
  signal: string | null;
  timedOut: boolean;
  inactivityTimedOut: boolean;
  structuredEventCount: number;
  apiRetryCount: number;
  toolCallCount: number;
  // null when executor profile is not pty-terminal.
  terminalSessionId: string | null;
  traceArchiveRoot: string;
  traceArchivePaths: TracedArchivePaths;
}

// ---------------------------------------------------------------------------
// T-026: process flow map variant identifiers. Variants V1/V2/V4 are §13A
// scaffolds and carry the variant-tab label, retirement condition, and
// owning-ticket metadata at render time. V0 is the canonical baseline.
// ---------------------------------------------------------------------------

export type SidecarProcessFlowVariantId = 'v0' | 'v1' | 'v2' | 'v4';

export interface SidecarProcessFlowVariantDescriptor {
  id: SidecarProcessFlowVariantId;
  label: string;
  scaffoldKind: 'baseline' | 'scaffold';
  retirementCondition: string | null;
  owningTicket: string | null;
}

export const SIDECAR_PROCESS_FLOW_VARIANTS: readonly SidecarProcessFlowVariantDescriptor[] = [
  {
    id: 'v0',
    label: 'Baseline',
    scaffoldKind: 'scaffold',
    retirementCondition: 'local paydown after V1 canonical promotion (T-026)',
    owningTicket: 'T-026',
  },
  {
    id: 'v1',
    label: 'Three-lane Structural',
    scaffoldKind: 'baseline',
    retirementCondition: null,
    owningTicket: null,
  },
  {
    id: 'v2',
    label: 'Asset-DAG',
    scaffoldKind: 'scaffold',
    retirementCondition: 'sprint close review (T-026)',
    owningTicket: 'T-026',
  },
  {
    id: 'v4',
    label: 'Assurance Matrix',
    scaffoldKind: 'scaffold',
    retirementCondition: 'sprint close review (T-026)',
    owningTicket: 'T-026',
  },
];

// ---------------------------------------------------------------------------
// Runtime validators (UX_METHOD §10). Hand-rolled type guards consistent
// with the existing project lightweight-validator posture (no zod / ajv
// dependency added). Every untrusted-seam payload (HTTP responses, file
// reads, etc.) must pass through these before entering UX state.
// ---------------------------------------------------------------------------

const TRACED_OUTCOME_KINDS: readonly TracedProcessOutcomeKind[] = [
  'exited',
  'signaled',
  'hard_timeout',
  'inactivity_timeout',
  'executor_unavailable',
  'launch_failed',
  'process_error',
  'lost_terminal',
];

const TRACED_EXECUTOR_PROFILES: readonly TracedExecutorProfile[] = [
  'local-spawn',
  'pty-terminal',
];

const TRACED_STREAM_MODELS: readonly TracedStreamModel[] = [
  'stdio',
  'terminal-transcript',
];

const TRACED_PARSERS: readonly TracedParser[] = [
  'generic-text',
  'claude-stream-json',
];

const LEAF_INVOCATION_STATUSES: readonly SidecarLeafInvocationStatus[] = [
  'queued',
  'running',
  'fp_succeeded',
  'fd_postflight_passed',
  'failed',
  'unattested',
];

const ASSURANCE_CELL_STATES: readonly SidecarAssuranceCellState[] = [
  'pass',
  'fail',
  'pending',
];

const EDGE_CLOSURE_DISPOSITIONS: readonly SidecarEdgeClosureDisposition[] = [
  'close',
  'yield',
  'retry',
  'repair',
  're-enter',
  'reprice',
  'block',
];

const EDGE_ASSURANCE_CARRIER_STATES: readonly SidecarEdgeAssuranceCarrierState[] = [
  'absent',
  'incomplete',
  'complete',
];

const COMPUTE_REGIMES: readonly SidecarComputeRegime[] = ['F_D', 'F_P', 'F_H'];

const OVERLAY_TERMINAL_ROLES: readonly SidecarOverlayTerminalRole[] = [
  'terminal_asset',
  'supporting_asset',
];

const LEAF_CATALOG_IDS: readonly SidecarLeafCatalogId[] = [
  'bootstrap',
  'operational',
  'triage',
];

const FLOW_VARIANT_IDS: readonly SidecarProcessFlowVariantId[] = [
  'v0',
  'v1',
  'v2',
  'v4',
];

const LIVE_ANALYSIS_INSPECTED_KINDS: readonly SidecarLiveAnalysisInspectedKind[] = [
  'workspace',
  'run-archive',
  'operator-run',
];

const LIVE_ANALYSIS_PROFILES: readonly SidecarLiveAnalysisProfile[] = [
  'hello_world',
  'data_mapper',
  'generic',
];

const LIVE_ANALYSIS_DIAGNOSTIC_SEVERITIES: readonly SidecarLiveAnalysisDiagnosticSeverity[] = [
  'info',
  'warn',
  'error',
];

const LIVE_ANALYSIS_PRODUCTIVE_SIGNALS: readonly SidecarLiveAnalysisProductiveSignal[] = [
  'progressing',
  'stalled_with_io',
  'stalled_no_io',
  'completed',
  'aborted_or_killed',
  'unknown',
];

const LIVE_ANALYSIS_STAGE_CLASSES: readonly SidecarLiveAnalysisStageClass[] = [
  'constructive',
  'projection',
  'rollup',
  'missing',
  'unmapped',
];

const LIVE_ANALYSIS_RUNTIME_GAP_STATUSES: readonly SidecarLiveAnalysisRuntimeGapStatus[] = [
  'missing',
  'malformed',
  'incomplete',
];

const LIVE_ANALYSIS_RETRY_CAUSE_CLASSES: readonly SidecarLiveAnalysisRetryCauseClass[] = [
  'prompt_schema_gap',
  'framework_carrier_parser_drift',
  'worker_policy_violation',
  'target_carrier_admission_missing',
  'deterministic_evaluator_bug',
  'harness_bug',
  'runtime_bug',
  'tenant_source_defect',
  'unknown',
];

const LIVE_ANALYSIS_LINEAGE_STATUSES: readonly SidecarLiveAnalysisLineageStatus[] = [
  'present',
  'absent',
  'unknown',
];

const LIVE_ANALYSIS_TRANSCRIPT_SOURCE_KINDS: readonly SidecarLiveAnalysisTranscriptSourceKind[] = [
  'terminal_transcript',
  'worker_stdout',
  'final_output',
  'missing',
];

const LIVE_ANALYSIS_TRANSCRIPT_TONES: readonly SidecarLiveAnalysisTranscriptTone[] = [
  'default',
  'active',
  'pending',
  'blocked',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

export function isTracedProcessOutcome(value: unknown): value is TracedProcessOutcome {
  if (!isObject(value)) return false;
  if (!isOneOf(value.kind, TRACED_OUTCOME_KINDS)) return false;
  if (value.detail !== null && typeof value.detail !== 'string') return false;
  return true;
}

export function isTracedArchivePaths(value: unknown): value is TracedArchivePaths {
  if (!isObject(value)) return false;
  return (
    typeof value.meta === 'string' &&
    typeof value.command === 'string' &&
    typeof value.events === 'string' &&
    typeof value.stdout === 'string' &&
    typeof value.stderr === 'string' &&
    typeof value.finalOutput === 'string' &&
    typeof value.result === 'string' &&
    (value.terminalTranscript === null ||
      typeof value.terminalTranscript === 'string')
  );
}

export function isTracedCalloutEvidence(value: unknown): value is TracedCalloutEvidence {
  if (!isObject(value)) return false;
  if (value.kind !== 'traced_callout_evidence') return false;
  if (typeof value.invocationId !== 'string') return false;
  if (!isTracedProcessOutcome(value.outcome)) return false;
  if (!isOneOf(value.executorProfile, TRACED_EXECUTOR_PROFILES)) return false;
  if (!isOneOf(value.streamModel, TRACED_STREAM_MODELS)) return false;
  if (!isOneOf(value.parser, TRACED_PARSERS)) return false;
  if (value.status !== null && typeof value.status !== 'number') return false;
  if (value.signal !== null && typeof value.signal !== 'string') return false;
  if (typeof value.timedOut !== 'boolean') return false;
  if (typeof value.inactivityTimedOut !== 'boolean') return false;
  if (typeof value.structuredEventCount !== 'number') return false;
  if (typeof value.apiRetryCount !== 'number') return false;
  if (typeof value.toolCallCount !== 'number') return false;
  if (
    value.terminalSessionId !== null &&
    typeof value.terminalSessionId !== 'string'
  )
    return false;
  if (typeof value.traceArchiveRoot !== 'string') return false;
  if (!isTracedArchivePaths(value.traceArchivePaths)) return false;
  return true;
}

export function isSidecarAssuranceLedgerVector(
  value: unknown,
): value is SidecarAssuranceLedgerVector {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_assurance_ledger_vector') return false;
  return (
    isOneOf(value.materialization, ASSURANCE_CELL_STATES) &&
    isOneOf(value.semanticConvergence, ASSURANCE_CELL_STATES) &&
    isOneOf(value.obligationCarry, ASSURANCE_CELL_STATES) &&
    isOneOf(value.requirementFulfillment, ASSURANCE_CELL_STATES) &&
    isOneOf(value.ambiguity, ASSURANCE_CELL_STATES) &&
    isOneOf(value.capability, ASSURANCE_CELL_STATES) &&
    isOneOf(value.shallowRealization, ASSURANCE_CELL_STATES)
  );
}

export function isSidecarEdgeAssuranceCounts(
  value: unknown,
): value is SidecarEdgeAssuranceCounts {
  if (!isObject(value)) return false;
  return (
    typeof value.expected === 'number' &&
    typeof value.fulfilled === 'number' &&
    typeof value.partial === 'number' &&
    typeof value.blocked === 'number' &&
    typeof value.unfulfilled === 'number' &&
    typeof value.missing === 'number' &&
    typeof value.extra === 'number'
  );
}

export function isSidecarEdgeAssuranceOverlay(
  value: unknown,
): value is SidecarEdgeAssuranceOverlay {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_edge_assurance_overlay') return false;
  if (!isOneOf(value.carrierState, EDGE_ASSURANCE_CARRIER_STATES)) return false;
  if (typeof value.opRunRoot !== 'string') return false;
  if (typeof value.edgeName !== 'string') return false;
  if (!isNullableString(value.edgeRef)) return false;
  if (!isNullableNumber(value.vectorIndex)) return false;
  if (!isNullableString(value.targetAssetType)) return false;
  if (!isNullableString(value.edgeAssuranceContractRef)) return false;
  if (!isNullableString(value.edgeAssuranceContractDigest)) return false;
  if (!isNullableString(value.edgeGainRef)) return false;
  if (!isNullableString(value.edgeClosureFunctionRef)) return false;
  if (!isStringArray(value.edgeResidualPressureRefs)) return false;
  if (!isNullableString(value.ledgerRef)) return false;
  if (!isNullableString(value.ledgerVersionRef)) return false;
  if (!isNullableString(value.closureDecisionRef)) return false;
  if (
    value.closureDisposition !== null &&
    !isOneOf(value.closureDisposition, EDGE_CLOSURE_DISPOSITIONS)
  )
    return false;
  if (typeof value.closeReady !== 'boolean') return false;
  if (!isNullableBoolean(value.edgeConverged)) return false;
  if (!isNullableBoolean(value.carryConverged)) return false;
  if (!isNullableBoolean(value.fulfillmentConverged)) return false;
  if (!isNullableBoolean(value.admitted)) return false;
  if (!isNullableBoolean(value.targetCertificationPassed)) return false;
  if (!isNullableBoolean(value.fdRecheckPassed)) return false;
  if (value.counts !== null && !isSidecarEdgeAssuranceCounts(value.counts)) return false;
  if (typeof value.materializationRefCount !== 'number') return false;
  if (typeof value.admissionRefCount !== 'number') return false;
  if (typeof value.evidenceBundleRefCount !== 'number') return false;
  if (typeof value.targetBindingRefCount !== 'number') return false;
  if (!isNullableString(value.nextActionBasisKind)) return false;
  if (!isNullableString(value.nextGraphVectorRef)) return false;
  if (!isNullableString(value.selectedActionRef)) return false;
  if (!isStringArray(value.reasonRefs)) return false;
  if (!isStringArray(value.gapPressureRefs)) return false;
  if (!isStringArray(value.diagnostics)) return false;
  return true;
}

export function isSidecarLeafOverlay(value: unknown): value is SidecarLeafOverlay {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_leaf_overlay') return false;
  if (typeof value.leafName !== 'string') return false;
  if (typeof value.opRunId !== 'string') return false;
  if (typeof value.invocationCount !== 'number') return false;
  if (!isOneOf(value.latestStatus, LEAF_INVOCATION_STATUSES)) return false;
  if (
    value.assuranceVector !== null &&
    !isSidecarAssuranceLedgerVector(value.assuranceVector)
  )
    return false;
  if (
    value.traceArchiveRoot !== null &&
    typeof value.traceArchiveRoot !== 'string'
  )
    return false;
  if (!Array.isArray(value.tracedEvidence)) return false;
  if (!value.tracedEvidence.every(isTracedCalloutEvidence)) return false;
  if (
    value.edgeAssurance !== null &&
    !isSidecarEdgeAssuranceOverlay(value.edgeAssurance)
  )
    return false;
  return true;
}

export function isSidecarLiveAnalysisByteSummary(
  value: unknown,
): value is SidecarLiveAnalysisByteSummary {
  if (!isObject(value)) return false;
  return (
    typeof value.totalBytes === 'number' &&
    typeof value.promptContextBytes === 'number' &&
    typeof value.handoffBytes === 'number' &&
    typeof value.stdoutBytes === 'number' &&
    typeof value.runtimeEventBytes === 'number'
  );
}

export function isSidecarLiveAnalysisTelemetry(
  value: unknown,
): value is SidecarLiveAnalysisTelemetry {
  if (!isObject(value)) return false;
  return (
    typeof value.inspectedRoot === 'string' &&
    isOneOf(value.inspectedKind, LIVE_ANALYSIS_INSPECTED_KINDS) &&
    isNullableString(value.scenarioName) &&
    isOneOf(value.profile, LIVE_ANALYSIS_PROFILES) &&
    typeof value.operatorRunCount === 'number' &&
    isStringArray(value.graphEdgeSequence) &&
    typeof value.sameEdgeRetryCount === 'number' &&
    typeof value.blockedAttemptCount === 'number' &&
    typeof value.repairAttemptCount === 'number' &&
    typeof value.abortedAttemptCount === 'number' &&
    isNullableString(value.finalClosureDisposition) &&
    isNullableNumber(value.totalWallClockMs) &&
    typeof value.totalWorkerElapsedMs === 'number' &&
    isSidecarLiveAnalysisByteSummary(value.archiveBytes) &&
    typeof value.productFileCount === 'number' &&
    typeof value.requirementObligationCount === 'number' &&
    typeof value.productFileLineageCount === 'number'
  );
}

export function isSidecarLiveAnalysisLiveness(
  value: unknown,
): value is SidecarLiveAnalysisLiveness {
  if (!isObject(value)) return false;
  return (
    isNullableString(value.activeOperatorRunRef) &&
    isNullableString(value.activeOperatorRunPath) &&
    isNullableString(value.activeEdgeRef) &&
    isNullableString(value.activeGraphVectorRef) &&
    isNullableString(value.activeTargetAssetType) &&
    isNullableNumber(value.workerPid) &&
    isNullableBoolean(value.processAlive) &&
    isNullableNumber(value.lastEventAtMs) &&
    isNullableNumber(value.lastStdoutAtMs) &&
    isNullableNumber(value.heartbeatAgeMs) &&
    isNullableNumber(value.maxNoOutputGapMs) &&
    isNullableNumber(value.archiveGrowthBytesPerMinute) &&
    isOneOf(value.productiveSignal, LIVE_ANALYSIS_PRODUCTIVE_SIGNALS) &&
    isNullableString(value.lastBlockingReason)
  );
}

export function isSidecarLiveAnalysisRuntimeGap(
  value: unknown,
): value is SidecarLiveAnalysisRuntimeGap {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_runtime_gap' &&
    typeof value.artifact === 'string' &&
    isOneOf(value.status, LIVE_ANALYSIS_RUNTIME_GAP_STATUSES) &&
    isNullableString(value.detail)
  );
}

export function isSidecarLiveAnalysisRetryForensic(
  value: unknown,
): value is SidecarLiveAnalysisRetryForensic {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_retry_forensic' &&
    typeof value.edgeName === 'string' &&
    isNullableString(value.predecessorAttemptRef) &&
    isNullableNumber(value.workerSecondsBefore) &&
    isStringArray(value.blockingReasonCodes) &&
    isStringArray(value.changedFiles) &&
    isStringArray(value.productFilesObserved) &&
    isStringArray(value.productFilesMaterialized) &&
    isStringArray(value.productFilesReplayed) &&
    isOneOf(value.lineageStatus, LIVE_ANALYSIS_LINEAGE_STATUSES) &&
    typeof value.outsideWorkspaceReadCount === 'number' &&
    typeof value.schemaViolationCount === 'number' &&
    isOneOf(value.likelyCauseClass, LIVE_ANALYSIS_RETRY_CAUSE_CLASSES)
  );
}

export function isSidecarLiveAnalysisStageCoverage(
  value: unknown,
): value is SidecarLiveAnalysisStageCoverage {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_stage_coverage' &&
    typeof value.test35StageRef === 'string' &&
    typeof value.expectedEdgeName === 'string' &&
    typeof value.expectedTargetAssetType === 'string' &&
    isNullableString(value.mappedEdgeName) &&
    isNullableString(value.mappedTargetAssetType) &&
    isOneOf(value.stageClass, LIVE_ANALYSIS_STAGE_CLASSES)
  );
}

export function isSidecarLiveAnalysisAssuranceLedgerSummary(
  value: unknown,
): value is SidecarLiveAnalysisAssuranceLedgerSummary {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_assurance_ledger' &&
    typeof value.dimension === 'string' &&
    typeof value.verdict === 'string' &&
    typeof value.required === 'boolean' &&
    typeof value.evidenceRefCount === 'number' &&
    typeof value.carryForwardObligationRefCount === 'number' &&
    typeof value.reasonCount === 'number'
  );
}

export function isSidecarLiveAnalysisAssuranceSummary(
  value: unknown,
): value is SidecarLiveAnalysisAssuranceSummary {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_assurance_summary' &&
    isNullableString(value.status) &&
    isStringArray(value.satisfiedDimensions) &&
    isStringArray(value.missingRequiredDimensions) &&
    typeof value.gapReasonCount === 'number' &&
    typeof value.blockingReasonCount === 'number' &&
    Array.isArray(value.ledgers) &&
    value.ledgers.every(isSidecarLiveAnalysisAssuranceLedgerSummary)
  );
}

export function isSidecarLiveAnalysisTranscriptLine(
  value: unknown,
): value is SidecarLiveAnalysisTranscriptLine {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_transcript_line' &&
    typeof value.index === 'number' &&
    typeof value.eventType === 'string' &&
    isNullableString(value.role) &&
    typeof value.label === 'string' &&
    typeof value.text === 'string' &&
    isOneOf(value.tone, LIVE_ANALYSIS_TRANSCRIPT_TONES)
  );
}

export function isSidecarLiveAnalysisCliTranscript(
  value: unknown,
): value is SidecarLiveAnalysisCliTranscript {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_cli_transcript' &&
    isOneOf(value.sourceKind, LIVE_ANALYSIS_TRANSCRIPT_SOURCE_KINDS) &&
    isNullableString(value.sourcePath) &&
    typeof value.byteCount === 'number' &&
    typeof value.lineCount === 'number' &&
    Array.isArray(value.lines) &&
    value.lines.every(isSidecarLiveAnalysisTranscriptLine)
  );
}

export function isSidecarLiveAnalysisRunDetail(
  value: unknown,
): value is SidecarLiveAnalysisRunDetail {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_run_detail' &&
    (value.edgeAssurance === null || isSidecarEdgeAssuranceOverlay(value.edgeAssurance)) &&
    (value.assurance === null || isSidecarLiveAnalysisAssuranceSummary(value.assurance)) &&
    Array.isArray(value.runtimeGaps) &&
    value.runtimeGaps.every(isSidecarLiveAnalysisRuntimeGap) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isSidecarLiveAnalysisDiagnostic) &&
    Array.isArray(value.retryForensics) &&
    value.retryForensics.every(isSidecarLiveAnalysisRetryForensic) &&
    Array.isArray(value.stageCoverage) &&
    value.stageCoverage.every(isSidecarLiveAnalysisStageCoverage) &&
    isSidecarLiveAnalysisCliTranscript(value.cliTranscript)
  );
}

export function isSidecarLiveAnalysisAttempt(
  value: unknown,
): value is SidecarLiveAnalysisAttempt {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_attempt' &&
    typeof value.attemptOrdinal === 'number' &&
    typeof value.operatorRunRef === 'string' &&
    isNullableString(value.operatorRunPath) &&
    isNullableString(value.graphFunctionName) &&
    isNullableString(value.graphVectorRef) &&
    isNullableString(value.targetAssetType) &&
    isOneOf(value.traversalClass, LIVE_ANALYSIS_STAGE_CLASSES) &&
    isNullableNumber(value.workerElapsedMs) &&
    isNullableNumber(value.edgeWindowElapsedMs) &&
    isNullableNumber(value.deterministicElapsedMs) &&
    isNullableString(value.fpEvaluateStatus) &&
    isNullableString(value.postflightStatus) &&
    isNullableString(value.executionEvidenceStatus) &&
    typeof value.executionEvidenceReportCount === 'number' &&
    typeof value.residualPressureRefCount === 'number' &&
    isNullableString(value.residualPressureTransition) &&
    isNullableString(value.closureDisposition) &&
    isNullableString(value.selectedNextActionRef) &&
    isNullableString(value.predecessorAttemptRef) &&
    isStringArray(value.blockingReasonCodes) &&
    isStringArray(value.productFilesWritten) &&
    isStringArray(value.productFilesReplayed) &&
    isNullableNumber(value.requirementObligationCount) &&
    typeof value.productLineageCount === 'number' &&
    typeof value.promptContextBytes === 'number' &&
    typeof value.handoffBytes === 'number' &&
    typeof value.stdoutBytes === 'number' &&
    typeof value.eventBytes === 'number' &&
    isNullableString(value.workerStatus) &&
    isSidecarLiveAnalysisRunDetail(value.detail)
  );
}

export function isSidecarLiveAnalysisDiagnostic(
  value: unknown,
): value is SidecarLiveAnalysisDiagnostic {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_live_analysis_diagnostic' &&
    typeof value.code === 'string' &&
    isOneOf(value.severity, LIVE_ANALYSIS_DIAGNOSTIC_SEVERITIES) &&
    typeof value.detail === 'string' &&
    isStringArray(value.evidenceRefs) &&
    isNullableString(value.operatorRunRef) &&
    isNullableString(value.edgeName) &&
    isNullableString(value.policyRef)
  );
}

export function isSidecarLiveAnalysisProjection(
  value: unknown,
): value is SidecarLiveAnalysisProjection {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_live_analysis_projection') return false;
  if (value.sourceKind !== 'sdlc_fd_run_analysis') return false;
  if (typeof value.version !== 'number') return false;
  if (typeof value.generatedAt !== 'string') return false;
  if (value.readOnly !== true) return false;
  if (!isSidecarLiveAnalysisTelemetry(value.telemetry)) return false;
  if (!isSidecarLiveAnalysisLiveness(value.liveness)) return false;
  if (!Array.isArray(value.attempts) || !value.attempts.every(isSidecarLiveAnalysisAttempt)) return false;
  if (!Array.isArray(value.diagnostics) || !value.diagnostics.every(isSidecarLiveAnalysisDiagnostic)) return false;
  if (typeof value.runtimeArtifactGapCount !== 'number') return false;
  if (typeof value.retryForensicCount !== 'number') return false;
  if (typeof value.summaryDriftCount !== 'number') return false;
  if (!isStringArray(value.evidenceIndex)) return false;
  return true;
}

export function isSidecarLeafEvaluator(value: unknown): value is SidecarLeafEvaluator {
  if (!isObject(value)) return false;
  return (
    typeof value.name === 'string' &&
    isOneOf(value.regime, COMPUTE_REGIMES) &&
    typeof value.binding === 'string'
  );
}

export function isSidecarLeafGraphFunctionView(
  value: unknown,
): value is SidecarLeafGraphFunctionView {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_leaf_graph_function_view') return false;
  if (typeof value.name !== 'string') return false;
  if (typeof value.intent !== 'string') return false;
  if (!isStringArray(value.inputs)) return false;
  if (!isStringArray(value.outputs)) return false;
  if (!isOneOf(value.catalog, LEAF_CATALOG_IDS)) return false;
  if (typeof value.transformContractRef !== 'string') return false;
  if (typeof value.evaluationContractRef !== 'string') return false;
  if (typeof value.traversalModulationStrategy !== 'string') return false;
  if (!isStringArray(value.proofObligations)) return false;
  if (!isStringArray(value.requirementRefs)) return false;
  if (!Array.isArray(value.evaluators)) return false;
  if (!value.evaluators.every(isSidecarLeafEvaluator)) return false;
  if (!isSidecarLeafEvaluator(value.operator)) return false;
  return true;
}

export function isSidecarExecutiveView(value: unknown): value is SidecarExecutiveView {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_executive_view' &&
    typeof value.name === 'string' &&
    typeof value.intent === 'string' &&
    isStringArray(value.steps) &&
    isStringArray(value.outputs)
  );
}

export function isSidecarLibraryFunctionView(
  value: unknown,
): value is SidecarLibraryFunctionView {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_library_function_view' &&
    typeof value.name === 'string' &&
    typeof value.intent === 'string' &&
    typeof value.stableOuterContract === 'string' &&
    isStringArray(value.computeOrder) &&
    isStringArray(value.abgOwnedRuntimeTruth) &&
    isStringArray(value.sdlcOwnedDomainTruth)
  );
}

export function isSidecarProcessCatalog(value: unknown): value is SidecarProcessCatalog {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_process_catalog') return false;
  if (value.contractName !== 'odd_sdlc.catalog') return false;
  if (value.contractVersion !== 'ts-v1') return false;
  if (typeof value.fetchedAt !== 'string') return false;
  if (typeof value.installRoot !== 'string') return false;
  if (!Array.isArray(value.executives)) return false;
  if (!value.executives.every(isSidecarExecutiveView)) return false;
  if (!Array.isArray(value.leaves)) return false;
  if (!value.leaves.every(isSidecarLeafGraphFunctionView)) return false;
  if (!Array.isArray(value.library)) return false;
  if (!value.library.every(isSidecarLibraryFunctionView)) return false;
  return true;
}

export function isSidecarOverlayAssetTemplate(
  value: unknown,
): value is SidecarOverlayAssetTemplate {
  if (!isObject(value)) return false;
  return (
    value.kind === 'sidecar_overlay_asset_template' &&
    typeof value.assetType === 'string' &&
    typeof value.defaultPath === 'string' &&
    typeof value.producerGraphFunctionRef === 'string' &&
    isOneOf(value.terminalRole, OVERLAY_TERMINAL_ROLES) &&
    typeof value.templateRef === 'string'
  );
}

export function isSidecarTraversalOverlay(value: unknown): value is SidecarTraversalOverlay {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_traversal_overlay') return false;
  if (typeof value.overlayRef !== 'string') return false;
  if (typeof value.name !== 'string') return false;
  if (typeof value.intent !== 'string') return false;
  if (!isStringArray(value.graphFunctionRefs)) return false;
  if (!isStringArray(value.graphVectorRefs)) return false;
  if (!isStringArray(value.publicStartTargets)) return false;
  if (typeof value.defaultStartTarget !== 'string') return false;
  if (!isStringArray(value.terminalAssetTypes)) return false;
  if (!isStringArray(value.terminalGraphFunctionRefs)) return false;
  if (!isStringArray(value.lawfulStopDispositions)) return false;
  if (!isStringArray(value.nextEligibleOverlayRefs)) return false;
  if (!isStringArray(value.predecessorOverlayRefs)) return false;
  if (!Array.isArray(value.assetTemplates)) return false;
  if (!value.assetTemplates.every(isSidecarOverlayAssetTemplate)) return false;
  return true;
}

export function isSidecarProcessFlowVariantId(
  value: unknown,
): value is SidecarProcessFlowVariantId {
  return isOneOf(value, FLOW_VARIANT_IDS);
}

// Top-level guard. Use this at the `/api/sidecar/process` response seam to
// reject malformed payloads before they enter UX state. The legacy
// `payload.kind === 'sidecar_process_projection'` check at the sidecar
// fetch site is preserved; this guard widens it with the new fields.
export function isSidecarProcessProjection(
  value: unknown,
): value is SidecarProcessProjection {
  if (!isObject(value)) return false;
  if (value.kind !== 'sidecar_process_projection') return false;
  if (typeof value.supported !== 'boolean') return false;
  if (
    value.unsupportedReason !== undefined &&
    typeof value.unsupportedReason !== 'string'
  )
    return false;
  if (value.contractName !== 'odd_sdlc.query-domain') return false;
  if (value.contractVersion !== 'ts-v1') return false;
  if (value.runtimeModel !== 'abg-native') return false;
  if (value.queryModel !== 'odd-domain-read-model') return false;
  if (value.readOnly !== true) return false;
  if (typeof value.workspaceRoot !== 'string') return false;
  if (typeof value.eventLogRelativePath !== 'string') return false;
  if (typeof value.eventCount !== 'number') return false;
  if (!isStringArray(value.eventKinds)) return false;
  // Existing list shapes are validated structurally; extension fields
  // are validated when present.
  if (!Array.isArray(value.views)) return false;
  if (!Array.isArray(value.records)) return false;
  if (!Array.isArray(value.maps)) return false;
  if (value.traversalOverlays !== undefined) {
    if (!Array.isArray(value.traversalOverlays)) return false;
    if (!value.traversalOverlays.every(isSidecarTraversalOverlay)) return false;
  }
  if (
    value.catalog !== undefined &&
    !isSidecarProcessCatalog(value.catalog)
  )
    return false;
  if (value.leafOverlays !== undefined) {
    if (!Array.isArray(value.leafOverlays)) return false;
    if (!value.leafOverlays.every(isSidecarLeafOverlay)) return false;
  }
  if (
    value.liveAnalysis !== undefined &&
    value.liveAnalysis !== null &&
    !isSidecarLiveAnalysisProjection(value.liveAnalysis)
  )
    return false;
  if (
    value.activeProcessFlowVariant !== undefined &&
    !isSidecarProcessFlowVariantId(value.activeProcessFlowVariant)
  )
    return false;
  return true;
}
