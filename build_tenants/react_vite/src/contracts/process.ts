export type SidecarProcessViewId = 'active_work' | 'blocked_waiting' | 'ready_handoff';

export type SidecarProcessMapId = 'process_flow' | 'builder_governance' | 'runtime_evidence';

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
    value.activeProcessFlowVariant !== undefined &&
    !isSidecarProcessFlowVariantId(value.activeProcessFlowVariant)
  )
    return false;
  return true;
}
