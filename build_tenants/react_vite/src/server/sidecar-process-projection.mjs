import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export const SIDECAR_PROCESS_CONTRACT_NAME = "odd_sdlc.query-domain";
export const SIDECAR_PROCESS_CONTRACT_VERSION = "ts-v1";
export const SIDECAR_PROCESS_CATALOG_CONTRACT_NAME = "odd_sdlc.catalog";
export const SIDECAR_PROCESS_EVENT_LOG_RELATIVE_PATH = ".ai-workspace/events/events.jsonl";
export const SIDECAR_OPERATOR_RUNS_RELATIVE_PATH = ".ai-workspace/runtime/odd_sdlc/operator-runs";

// T-026: requirement refs every leaf graph function carries per the upstream
// odd_sdlc TypeScript module (`graphFunctionDeclarations` in module.ts).
// Held as a default because the CLI catalog payload does not surface
// declarations per leaf; the upstream module guarantees these refs.
const SIDECAR_LEAF_DEFAULT_REQUIREMENT_REFS = Object.freeze([
  "REQ-F-ODDSDLC-013",
  "REQ-F-ODDSDLC-014",
  "REQ-F-ODDSDLC-015"
]);

const SIDECAR_LEAF_DEFAULT_PROOF_OBLIGATIONS = Object.freeze([
  "target_binding",
  "operation_type",
  "evidence_refs",
  "input_output_identity_or_digest"
]);

const SIDECAR_LEAF_DEFAULT_TRAVERSAL_MODULATION = "single_vertical_slice";

// T-022: outcome kinds enumerated by abiogenesis 3.5.0-rc.1 traced call-out
// substrate (T-108 / T-109 / T-110 / T-111).
const TRACED_OUTCOME_KINDS = new Set([
  "exited",
  "signaled",
  "hard_timeout",
  "inactivity_timeout",
  "executor_unavailable",
  "launch_failed",
  "process_error",
  "lost_terminal"
]);
const TRACED_EXECUTOR_PROFILES = new Set(["local-spawn", "pty-terminal"]);
const TRACED_STREAM_MODELS = new Set(["stdio", "terminal-transcript"]);
const TRACED_PARSERS = new Set(["generic-text", "claude-stream-json"]);
const ASSURANCE_CELL_STATES = new Set(["pass", "fail", "pending"]);
const EDGE_CLOSURE_DISPOSITIONS = new Set([
  "close",
  "yield",
  "retry",
  "repair",
  "re-enter",
  "reprice",
  "block"
]);
const LEAF_INVOCATION_STATUSES = new Set([
  "queued",
  "running",
  "fp_succeeded",
  "fd_postflight_passed",
  "failed",
  "unattested"
]);

export const SIDECAR_PROCESS_VIEWS = Object.freeze([
  Object.freeze({
    id: "active_work",
    label: "Active Work",
    summary: "Graph calls, frames, vectors, and worker assessments currently moving through the TypeScript process lane."
  }),
  Object.freeze({
    id: "blocked_waiting",
    label: "Blocked / Waiting",
    summary: "Blocked vectors, retry repair, reopened continuation, and fail-closed process pressure."
  }),
  Object.freeze({
    id: "ready_handoff",
    label: "Ready for Handoff",
    summary: "Closed vectors and advanced process objects with downstream handoff evidence."
  })
]);

const TS_INSTALL_PROJECTION_RELATIVE_PATH = ".ai-workspace/runtime/odd_sdlc-typescript-installation.json";
const TS_INSTALL_MANIFEST_RELATIVE_PATH = ".abiogenesis/odd_sdlc/typescript/install-manifest.json";

const ACTIVE_EVENT_KINDS = new Set([
  "graph_call_opened",
  "frame_opened",
  "vector_traversal_planned",
  "assessed",
  "retry_attempt_opened"
]);

const BLOCKED_EVENT_KINDS = new Set([
  "retry_repair_planned",
  "continuation_reopened",
  "continuation_terminated"
]);

const READY_EVENT_KINDS = new Set(["vector_closed"]);

const SUPPORTED_TS_EVENT_KINDS = new Set([
  "graph_call_opened",
  "frame_opened",
  "vector_traversal_planned",
  "vector_evaluated",
  "vector_closed",
  "assessed",
  "retry_repair_planned",
  "retry_attempt_opened",
  "continuation_terminated",
  "continuation_reopened"
]);

const SIDECAR_PROCESS_MAX_EVENT_LOG_BYTES = 1024 * 1024;
const SIDECAR_PROCESS_MAX_EVENT_LOG_EVENTS = 1200;
const LIVE_ANALYSIS_MAX_ATTEMPTS = 24;
const LIVE_ANALYSIS_MAX_DIAGNOSTICS = 240;
const LIVE_ANALYSIS_MAX_RUNTIME_GAPS = 360;
const LIVE_ANALYSIS_MAX_RETRY_FORENSICS = 240;
const LIVE_ANALYSIS_MAX_STAGE_COVERAGE = 360;
const LIVE_ANALYSIS_MAX_EVIDENCE_REFS = 240;
const LIVE_ANALYSIS_MAX_GRAPH_EDGE_SEQUENCE = 240;

export function loadSidecarProcessProjection(workspaceRoot) {
  const root = String(workspaceRoot ?? "").trim();
  if (!root) {
    return unsupportedProcessProjection("", "workspace root is required");
  }

  const installValidation = validateTypeScriptInstall(root);
  if (!installValidation.ok) {
    return unsupportedProcessProjection(root, installValidation.reason);
  }
  const queryDomain = loadInstalledQueryDomain(root, installValidation.manifest);
  const traversalOverlays = mapTraversalOverlays(queryDomain);

  // T-026: catalog backbone. Live read each call (no memoization).
  const catalog = loadInstalledCatalog(root, installValidation.manifest);

  // T-026: per-leaf overlay from latest op-run. Live scan each call.
  // T-022: traced evidence is folded into each overlay's tracedEvidence.
  const leafOverlays = loadLeafOverlaysForLatestOpRun(root);
  const liveAnalysis = loadLiveAnalysisProjection(root, installValidation.manifest);

  const eventPath = join(root, SIDECAR_PROCESS_EVENT_LOG_RELATIVE_PATH);
  if (!existsSync(eventPath)) {
    const records = [];
    return {
      ...baseProjection(root),
      supported: true,
      views: materializeViews([]),
      records,
      maps: decorateMapsWithOverlays(materializeProcessMaps(records, queryDomain), leafOverlays),
      traversalOverlays,
      catalog,
      leafOverlays,
      liveAnalysis
    };
  }

  const eventRead = readRuntimeEvents(eventPath, {
    maxBytes: SIDECAR_PROCESS_MAX_EVENT_LOG_BYTES,
    maxEvents: SIDECAR_PROCESS_MAX_EVENT_LOG_EVENTS
  });
  if (eventRead.events.length > 0 && !eventRead.events.some(isTypeScriptRuntimeEvent)) {
    return unsupportedProcessProjection(root, "event log does not contain odd_sdlc TypeScript runtime basis");
  }

  const records = projectProcessRecords(eventRead.events);
  return {
    ...baseProjection(root),
    supported: true,
    eventCount: eventRead.events.length,
    eventKinds: uniqueSorted(eventRead.events.map((event) => stringField(event, "kind")).filter(Boolean)),
    views: materializeViews(records),
    records,
    maps: decorateMapsWithOverlays(materializeProcessMaps(records, queryDomain), leafOverlays),
    traversalOverlays,
    catalog,
    leafOverlays,
    liveAnalysis
  };
}

// ---------------------------------------------------------------------------
// T-024: per-edge outcome glyph decoration. Folds the most recent
// TracedCalloutEvidence per leaf onto every edge whose label or id matches
// the leaf name. Pure post-pass — does not mutate the original maps.
// ---------------------------------------------------------------------------

function decorateMapsWithOverlays(maps, leafOverlays) {
  if (!Array.isArray(leafOverlays) || leafOverlays.length === 0) return maps;
  const overlayByLeaf = new Map(leafOverlays.map((ov) => [ov.leafName, ov]));
  // Edges are keyed `flow-function:<leafName>:<hash>` or
  // `governed-function:<leafName>:<hash>` on either `from` or `to`.
  // The producing leaf carries the outcome (the edge represents the leaf's
  // primary output surface). Match by extracting a leaf name from endpoint ids
  // first, then fall back to a raw edge label match.
  const leafNameFromNodeId = (nodeId) => {
    const match = String(nodeId || "").match(/^(?:flow-function|governed-function):([^:]+):/);
    return match ? match[1] : null;
  };
  return Object.freeze(
    maps.map((map) => {
      const decoratedEdges = map.edges.map((edge) => {
        const leafKey =
          leafNameFromNodeId(edge.from) ||
          leafNameFromNodeId(edge.to) ||
          // fallback: some maps use raw leaf names as edge id/label
          (overlayByLeaf.has(edge.label) ? edge.label : null) ||
          edge.id ||
          "";
        const overlay = overlayByLeaf.get(leafKey);
        if (!overlay) return edge;
        const evidence = overlay.tracedEvidence[overlay.tracedEvidence.length - 1] ?? null;
        return Object.freeze({
          ...edge,
          latestOutcome: evidence ? evidence.outcome.kind : null,
          executorProfile: evidence ? evidence.executorProfile : null,
          traceArchiveRoot: overlay.traceArchiveRoot ?? null,
        });
      });
      return Object.freeze({ ...map, edges: Object.freeze(decoratedEdges) });
    })
  );
}

// ---------------------------------------------------------------------------
// T-026: catalog loader. Invokes `odd-sdlc-ts catalog` (sibling of
// query-domain) on the active workspace's installed TS tenant. Returns
// SidecarProcessCatalog or null when the install is unreachable / the
// payload contract is unrecognised.
// ---------------------------------------------------------------------------

function loadInstalledCatalog(root, manifest) {
  const commandPath = queryDomainCommandPath(root, manifest);
  if (!commandPath || !existsSync(commandPath)) return null;
  const result = spawnSync(process.execPath, [commandPath, "catalog", "--workspace", root], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
    timeout: 10_000
  });
  if (result.error || result.status !== 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const payload = parsed?.payload;
  if (payload?.kind !== "sdlc_graph_function_catalog") return null;
  return mapSdlcCatalogToSidecar(payload, root);
}

function loadLiveAnalysisProjection(root, manifest) {
  const commandPath = queryDomainCommandPath(root, manifest);
  if (!commandPath || !existsSync(commandPath)) return null;
  const result = spawnSync(process.execPath, [commandPath, "analyze-run", "--workspace", root, "--format", "json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
    timeout: 15_000
  });
  if (result.error || result.status !== 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const analysis = extractSdlcFdRunAnalysis(parsed);
  return analysis ? mapLiveAnalysisToSidecar(analysis) : null;
}

function extractSdlcFdRunAnalysis(payload) {
  if (payload?.kind === "sdlc_fd_run_analysis") return payload;
  if (payload?.kind === "sdlc_analyze_run_cli_envelope" && payload?.analysis?.kind === "sdlc_fd_run_analysis") {
    return payload.analysis;
  }
  if (payload?.analysis?.kind === "sdlc_fd_run_analysis") return payload.analysis;
  if (payload?.payload?.kind === "sdlc_fd_run_analysis") return payload.payload;
  if (payload?.payload?.analysis?.kind === "sdlc_fd_run_analysis") return payload.payload.analysis;
  return null;
}

function mapLiveAnalysisToSidecar(analysis) {
  const telemetry = isObject(analysis.currentStateTelemetrySummary)
    ? analysis.currentStateTelemetrySummary
    : {};
  const liveness = isObject(analysis.activeRunLiveness)
    ? analysis.activeRunLiveness
    : {};
  const archiveBytes = isObject(telemetry.archiveBytes) ? telemetry.archiveBytes : {};
  const attempts = Array.isArray(analysis.edgeTraversal) ? analysis.edgeTraversal : [];
  const diagnostics = Array.isArray(analysis.diagnostics) ? analysis.diagnostics : [];
  const runtimeArtifactGaps = Array.isArray(analysis.runtimeArtifactGaps) ? analysis.runtimeArtifactGaps : [];
  const retryForensics = Array.isArray(analysis.retryForensics) ? analysis.retryForensics : [];
  const conceptualStageCoverage = Array.isArray(analysis.conceptualStageCoverage)
    ? analysis.conceptualStageCoverage
    : [];
  const summaryDrift = isObject(analysis.summaryDrift) && Array.isArray(analysis.summaryDrift.drifts)
    ? analysis.summaryDrift.drifts
    : [];
  const activeOperatorRunRef = stringOrNull(liveness, "activeOperatorRunRef");
  const projectedAttempts = selectLiveAnalysisAttempts(attempts, activeOperatorRunRef, LIVE_ANALYSIS_MAX_ATTEMPTS);
  const projectedAttemptRefs = new Set(projectedAttempts.map((attempt) => stringField(attempt, "operatorRunRef")).filter(Boolean));
  const projectedDiagnostics = selectLiveAnalysisRowsByRef(
    diagnostics,
    projectedAttemptRefs,
    "operatorRunRef",
    LIVE_ANALYSIS_MAX_DIAGNOSTICS,
    true
  );
  const sidecarDiagnostics = projectedDiagnostics.map(mapLiveAnalysisDiagnosticToSidecar).filter(Boolean);
  const detailIndex = Object.freeze({
    runtimeGapsByRun: groupByOperatorRunRef(
      selectLiveAnalysisRowsByRef(runtimeArtifactGaps, projectedAttemptRefs, "operatorRunRef", LIVE_ANALYSIS_MAX_RUNTIME_GAPS),
      mapLiveAnalysisRuntimeGapToSidecar
    ),
    diagnosticsByRun: groupMappedByKey(sidecarDiagnostics, (diagnostic) => diagnostic.operatorRunRef),
    retryForensicsByRun: groupByAttemptRef(
      selectLiveAnalysisRowsByRef(retryForensics, projectedAttemptRefs, "attemptRef", LIVE_ANALYSIS_MAX_RETRY_FORENSICS),
      mapLiveAnalysisRetryForensicToSidecar
    ),
    stageCoverageByRun: groupStageCoverageByOperatorRun(
      selectLiveAnalysisStageCoverage(conceptualStageCoverage, projectedAttemptRefs, LIVE_ANALYSIS_MAX_STAGE_COVERAGE)
    )
  });
  return Object.freeze({
    kind: "sidecar_live_analysis_projection",
    sourceKind: "sdlc_fd_run_analysis",
    version: numberField(analysis, "version") ?? 1,
    generatedAt: new Date().toISOString(),
    readOnly: true,
    telemetry: Object.freeze({
      inspectedRoot: stringField(telemetry, "inspectedRoot"),
      inspectedKind: liveAnalysisInspectedKind(stringField(telemetry, "inspectedKind")),
      scenarioName: stringOrNull(telemetry, "scenarioName"),
      profile: liveAnalysisProfile(stringField(telemetry, "profile")),
      operatorRunCount: numberField(telemetry, "operatorRunCount") ?? attempts.length,
      graphEdgeSequence: Object.freeze(stringArray(telemetry.graphEdgeSequence).slice(-LIVE_ANALYSIS_MAX_GRAPH_EDGE_SEQUENCE)),
      sameEdgeRetryCount: numberField(telemetry, "sameEdgeRetryCount") ?? 0,
      blockedAttemptCount: numberField(telemetry, "blockedAttemptCount") ?? 0,
      repairAttemptCount: numberField(telemetry, "repairAttemptCount") ?? 0,
      abortedAttemptCount: numberField(telemetry, "abortedAttemptCount") ?? 0,
      finalClosureDisposition: stringOrNull(telemetry, "finalClosureDisposition"),
      totalWallClockMs: numberOrNull(telemetry, "totalWallClockMs"),
      totalWorkerElapsedMs: numberField(telemetry, "totalWorkerElapsedMs") ?? 0,
      archiveBytes: Object.freeze({
        totalBytes: numberField(archiveBytes, "totalBytes") ?? 0,
        promptContextBytes: numberField(archiveBytes, "promptContextBytes") ?? 0,
        handoffBytes: numberField(archiveBytes, "handoffBytes") ?? 0,
        stdoutBytes: numberField(archiveBytes, "stdoutBytes") ?? 0,
        runtimeEventBytes: numberField(archiveBytes, "runtimeEventBytes") ?? 0
      }),
      productFileCount: numberField(telemetry, "productFileCount") ?? 0,
      requirementObligationCount: numberField(telemetry, "requirementObligationCount") ?? 0,
      productFileLineageCount: numberField(telemetry, "productFileLineageCount") ?? 0
    }),
    liveness: Object.freeze({
      activeOperatorRunRef,
      activeOperatorRunPath: fileRefToPath(activeOperatorRunRef),
      activeEdgeRef: stringOrNull(liveness, "activeEdgeRef"),
      activeGraphVectorRef: stringOrNull(liveness, "activeGraphVectorRef"),
      activeTargetAssetType: stringOrNull(liveness, "activeTargetAssetType"),
      workerPid: numberOrNull(liveness, "workerPid"),
      processAlive: booleanOrNull(liveness?.processAlive),
      lastEventAtMs: numberOrNull(liveness, "lastEventAtMs"),
      lastStdoutAtMs: numberOrNull(liveness, "lastStdoutAtMs"),
      heartbeatAgeMs: numberOrNull(liveness, "heartbeatAgeMs"),
      maxNoOutputGapMs: numberOrNull(liveness, "maxNoOutputGapMs"),
      archiveGrowthBytesPerMinute: numberOrNull(liveness, "archiveGrowthBytesPerMinute"),
      productiveSignal: liveAnalysisProductiveSignal(stringField(liveness, "productiveSignal")),
      lastBlockingReason: liveAnalysisBlockingReason(liveness.lastBlockingReason)
    }),
    attempts: Object.freeze(projectedAttempts.map((attempt) => mapLiveAnalysisAttemptToSidecar(attempt, detailIndex)).filter(Boolean)),
    diagnostics: Object.freeze(sidecarDiagnostics),
    runtimeArtifactGapCount: runtimeArtifactGaps.length,
    retryForensicCount: retryForensics.length,
    summaryDriftCount: summaryDrift.length,
    evidenceIndex: Object.freeze(stringArray(analysis.evidenceIndex).slice(-LIVE_ANALYSIS_MAX_EVIDENCE_REFS))
  });
}

function selectLiveAnalysisAttempts(attempts, activeOperatorRunRef, maxAttempts) {
  const validAttempts = attempts.filter(isObject);
  if (validAttempts.length <= maxAttempts) return validAttempts;
  const recentAttempts = validAttempts.slice(-maxAttempts);
  if (!activeOperatorRunRef || recentAttempts.some((attempt) => stringField(attempt, "operatorRunRef") === activeOperatorRunRef)) {
    return recentAttempts;
  }
  const activeAttempt = validAttempts.find((attempt) => stringField(attempt, "operatorRunRef") === activeOperatorRunRef);
  if (!activeAttempt) return recentAttempts;
  return [activeAttempt, ...recentAttempts.slice(1)];
}

function selectLiveAnalysisRowsByRef(items, selectedRefs, refKey, maxRows, includeGlobal = false) {
  const projected = items.filter((item) => {
    if (!isObject(item)) return false;
    const ref = stringField(item, refKey);
    return ref ? selectedRefs.has(ref) : includeGlobal;
  });
  return projected.slice(-maxRows);
}

function selectLiveAnalysisStageCoverage(stages, selectedRefs, maxRows) {
  const projected = stages.filter((stage) => {
    if (!isObject(stage)) return false;
    return stringArray(stage.operatorRunRefs).some((ref) => selectedRefs.has(ref));
  });
  return projected.slice(-maxRows);
}

function mapLiveAnalysisAttemptToSidecar(attempt, detailIndex) {
  if (!isObject(attempt)) return null;
  const operatorRunRef = stringField(attempt, "operatorRunRef");
  if (!operatorRunRef) return null;
  const operatorRunPath = fileRefToPath(operatorRunRef);
  const graphFunctionName = stringOrNull(attempt, "graphFunctionName");
  const targetAssetType = stringOrNull(attempt, "targetAssetType");
  const cliTranscripts = operatorRunPath
    ? readLiveAnalysisCliTranscripts(operatorRunPath, { graphFunctionName, targetAssetType })
    : Object.freeze([emptyLiveAnalysisCliTranscript()]);
  const manifest = operatorRunPath ? readOpRunManifest(operatorRunPath) : null;
  const edgeAssurance = operatorRunPath
    ? readEdgeAssuranceOverlay(operatorRunPath, graphFunctionName ?? "", manifest)
    : null;
  return Object.freeze({
    kind: "sidecar_live_analysis_attempt",
    attemptOrdinal: numberField(attempt, "attemptOrdinal") ?? 0,
    operatorRunRef,
    operatorRunPath,
    graphFunctionName,
    graphVectorRef: stringOrNull(attempt, "graphVectorRef"),
    targetAssetType,
    traversalClass: liveAnalysisStageClass(stringField(attempt, "traversalClass")),
    workerElapsedMs: numberOrNull(attempt, "workerElapsedMs"),
    edgeWindowElapsedMs: numberOrNull(attempt, "edgeWindowElapsedMs"),
    deterministicElapsedMs: numberOrNull(attempt, "deterministicElapsedMs"),
    fpEvaluateStatus: stringOrNull(attempt, "fpEvaluateStatus"),
    postflightStatus: stringOrNull(attempt, "postflightStatus"),
    executionEvidenceStatus: stringOrNull(attempt, "executionEvidenceStatus"),
    executionEvidenceReportCount: numberField(attempt, "executionEvidenceReportCount") ?? 0,
    residualPressureRefCount: numberField(attempt, "residualPressureRefCount") ?? 0,
    residualPressureTransition: stringOrNull(attempt, "residualPressureTransition"),
    closureDisposition: stringOrNull(attempt, "closureDisposition"),
    selectedNextActionRef: stringOrNull(attempt, "selectedNextActionRef"),
    predecessorAttemptRef: stringOrNull(attempt, "predecessorAttemptRef"),
    blockingReasonCodes: Object.freeze(stringArray(attempt.blockingReasonCodes)),
    productFilesWritten: Object.freeze(stringArray(attempt.productFilesWritten)),
    productFilesReplayed: Object.freeze(stringArray(attempt.productFilesReplayed)),
    requirementObligationCount: numberOrNull(attempt, "requirementObligationCount"),
    productLineageCount: numberField(attempt, "productLineageCount") ?? 0,
    promptContextBytes: numberField(attempt, "promptContextBytes") ?? 0,
    handoffBytes: numberField(attempt, "handoffBytes") ?? 0,
    stdoutBytes: numberField(attempt, "stdoutBytes") ?? 0,
    eventBytes: numberField(attempt, "eventBytes") ?? 0,
    workerStatus: stringOrNull(attempt, "workerStatus"),
    detail: Object.freeze({
      kind: "sidecar_live_analysis_run_detail",
      edgeAssurance,
      assurance: operatorRunPath ? readLiveAnalysisAssuranceSummary(operatorRunPath) : null,
      runtimeGaps: Object.freeze(detailIndex.runtimeGapsByRun.get(operatorRunRef) ?? []),
      diagnostics: Object.freeze(detailIndex.diagnosticsByRun.get(operatorRunRef) ?? []),
      retryForensics: Object.freeze(detailIndex.retryForensicsByRun.get(operatorRunRef) ?? []),
      stageCoverage: Object.freeze(detailIndex.stageCoverageByRun.get(operatorRunRef) ?? []),
      cliTranscript: cliTranscripts[0] ?? emptyLiveAnalysisCliTranscript(),
      cliTranscripts,
      events: operatorRunPath ? readLiveAnalysisEventTickets(operatorRunPath) : Object.freeze([])
    })
  });
}

function mapLiveAnalysisDiagnosticToSidecar(diagnostic) {
  if (!isObject(diagnostic)) return null;
  const code = stringField(diagnostic, "code");
  if (!code) return null;
  return Object.freeze({
    kind: "sidecar_live_analysis_diagnostic",
    code,
    severity: liveAnalysisDiagnosticSeverity(stringField(diagnostic, "severity")),
    detail: stringField(diagnostic, "detail"),
    evidenceRefs: Object.freeze(stringArray(diagnostic.evidenceRefs)),
    operatorRunRef: stringOrNull(diagnostic, "operatorRunRef"),
    edgeName: stringOrNull(diagnostic, "edgeName"),
    policyRef: stringOrNull(diagnostic, "policyRef")
  });
}

function mapLiveAnalysisRuntimeGapToSidecar(gap) {
  if (!isObject(gap)) return null;
  const artifact = stringField(gap, "artifact");
  if (!artifact) return null;
  return Object.freeze({
    kind: "sidecar_live_analysis_runtime_gap",
    artifact,
    status: liveAnalysisRuntimeGapStatus(stringField(gap, "status")),
    detail: stringOrNull(gap, "detail")
  });
}

function mapLiveAnalysisRetryForensicToSidecar(retry) {
  if (!isObject(retry)) return null;
  const edgeName = stringField(retry, "edgeName");
  if (!edgeName) return null;
  return Object.freeze({
    kind: "sidecar_live_analysis_retry_forensic",
    edgeName,
    predecessorAttemptRef: stringOrNull(retry, "predecessorAttemptRef"),
    workerSecondsBefore: numberOrNull(retry, "workerSecondsBefore"),
    blockingReasonCodes: Object.freeze(stringArray(retry.blockingReasonCodes)),
    changedFiles: Object.freeze(stringArray(retry.changedFiles)),
    productFilesObserved: Object.freeze(stringArray(retry.productFilesObserved)),
    productFilesMaterialized: Object.freeze(stringArray(retry.productFilesMaterialized)),
    productFilesReplayed: Object.freeze(stringArray(retry.productFilesReplayed)),
    lineageStatus: liveAnalysisLineageStatus(stringField(retry, "lineageStatus")),
    outsideWorkspaceReadCount: numberField(retry, "outsideWorkspaceReadCount") ?? 0,
    schemaViolationCount: numberField(retry, "schemaViolationCount") ?? 0,
    likelyCauseClass: liveAnalysisRetryCauseClass(stringField(retry, "likelyCauseClass"))
  });
}

function mapLiveAnalysisStageCoverageToSidecar(stage) {
  if (!isObject(stage)) return null;
  const test35StageRef = stringField(stage, "test35StageRef");
  const expectedEdgeName = stringField(stage, "expectedEdgeName");
  const expectedTargetAssetType = stringField(stage, "expectedTargetAssetType");
  if (!test35StageRef || !expectedEdgeName || !expectedTargetAssetType) return null;
  return Object.freeze({
    kind: "sidecar_live_analysis_stage_coverage",
    test35StageRef,
    expectedEdgeName,
    expectedTargetAssetType,
    mappedEdgeName: stringOrNull(stage, "mappedEdgeName"),
    mappedTargetAssetType: stringOrNull(stage, "mappedTargetAssetType"),
    stageClass: liveAnalysisStageClass(stringField(stage, "stageClass"))
  });
}

function readLiveAnalysisAssuranceSummary(operatorRunPath) {
  const payload = readJsonFile(join(operatorRunPath, "assurance_satisfaction.json"));
  if (!isObject(payload)) return null;
  const ledgers = Array.isArray(payload.ledgers) ? payload.ledgers : [];
  return Object.freeze({
    kind: "sidecar_live_analysis_assurance_summary",
    status: stringOrNull(payload, "status"),
    satisfiedDimensions: Object.freeze(stringArray(payload.satisfiedDimensions)),
    missingRequiredDimensions: Object.freeze(stringArray(payload.missingRequiredDimensions)),
    gapReasonCount: Array.isArray(payload.gapReasons) ? payload.gapReasons.length : 0,
    blockingReasonCount: Array.isArray(payload.blockingReasons) ? payload.blockingReasons.length : 0,
    ledgers: Object.freeze(ledgers.map(mapLiveAnalysisAssuranceLedgerToSidecar).filter(Boolean))
  });
}

function emptyLiveAnalysisCliTranscript(overrides = {}) {
  return Object.freeze({
    kind: "sidecar_live_analysis_cli_transcript",
    id: stringField(overrides, "id") || "cli:missing",
    label: stringField(overrides, "label") || "No CLI transcript",
    role: stringField(overrides, "role") || "missing",
    sourceKind: "missing",
    sourcePath: null,
    byteCount: 0,
    lineCount: 0,
    lines: Object.freeze([])
  });
}

function readLiveAnalysisCliTranscript(operatorRunPath, context = {}) {
  const transcripts = readLiveAnalysisCliTranscripts(operatorRunPath, context);
  return transcripts[0] ?? emptyLiveAnalysisCliTranscript();
}

function readLiveAnalysisCliTranscripts(operatorRunPath, context = {}) {
  const candidates = discoverLiveAnalysisCliTranscriptCandidates(operatorRunPath, context);
  const transcripts = candidates
    .map((candidate) => readLiveAnalysisCliTranscriptCandidate(candidate))
    .filter((transcript) => transcript.sourceKind !== "missing");
  return Object.freeze(transcripts.length ? transcripts : [emptyLiveAnalysisCliTranscript()]);
}

function discoverLiveAnalysisCliTranscriptCandidates(operatorRunPath, context = {}) {
  const candidates = [];
  const seen = new Set();
  const addCandidate = (candidate) => {
    const sourcePath = typeof candidate?.path === "string" ? candidate.path : "";
    if (!sourcePath || seen.has(sourcePath)) return;
    try {
      if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) return;
    } catch {
      return;
    }
    seen.add(sourcePath);
    const basePath = typeof candidate.basePath === "string" ? candidate.basePath : operatorRunPath;
    candidates.push(Object.freeze({
      sourceKind: candidate.sourceKind,
      path: sourcePath,
      role: candidate.role || inferCliTranscriptRole(basePath, sourcePath),
      label: candidate.label || cliTranscriptLabel(
        candidate.role || inferCliTranscriptRole(basePath, sourcePath),
        candidate.sourceKind,
        basePath,
        sourcePath
      )
    }));
  };

  for (const ref of readDeclaredTerminalTranscriptRefs(operatorRunPath)) {
    addCandidate({
      sourceKind: "terminal_transcript",
      path: ref,
      role: "transform",
      label: "Transform CLI"
    });
  }

  scanLiveAnalysisCliTranscriptFiles(operatorRunPath).forEach(addCandidate);
  discoverRelatedLiveAnalysisCliTranscriptCandidates(operatorRunPath, context).forEach(addCandidate);

  if (candidates.some(isTerminalCliSurfaceCandidate)) {
    return Object.freeze(
      candidates
        .filter(isTerminalCliSurfaceCandidate)
        .slice(0, LIVE_ANALYSIS_MAX_TRANSCRIPT_CANDIDATES)
    );
  }

  const fallbackCandidates = [
    {
      sourceKind: "terminal_transcript",
      path: join(operatorRunPath, "worker_process_events.jsonl.trace", "terminal.transcript"),
      role: "transform",
      label: "Transform CLI"
    },
    {
      sourceKind: "worker_stdout",
      path: join(operatorRunPath, "worker_stdout.log"),
      role: "transform",
      label: "Transform stdout"
    },
    {
      sourceKind: "final_output",
      path: join(operatorRunPath, "worker_process_events.jsonl.trace", "final_output.txt"),
      role: "transform",
      label: "Transform final output"
    }
  ];
  fallbackCandidates.forEach(addCandidate);
  return Object.freeze(candidates.slice(0, LIVE_ANALYSIS_MAX_TRANSCRIPT_CANDIDATES));
}

function discoverRelatedLiveAnalysisCliTranscriptCandidates(operatorRunPath, context = {}) {
  const matchContext = normalizeLiveAnalysisCliContext(context);
  if (!matchContext.graphFunctionName && !matchContext.targetAssetType) return [];
  const operatorRunsRoot = dirname(operatorRunPath);
  let entries;
  try {
    entries = readdirSync(operatorRunsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  const runEntries = entries
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(-LIVE_ANALYSIS_MAX_RELATED_TRANSCRIPT_RUNS);
  for (const entry of runEntries) {
    const runPath = join(operatorRunsRoot, entry.name);
    if (runPath === operatorRunPath) continue;
    if (!operatorRunMatchesCliContext(readOpRunManifest(runPath), matchContext)) continue;
    const relatedCandidates = scanLiveAnalysisCliTranscriptFiles(runPath)
      .filter(isRelatedStageCliCandidate)
      .map((candidate) => Object.freeze({ ...candidate, basePath: runPath }));
    for (const candidate of relatedCandidates) {
      found.push(candidate);
      if (found.length >= LIVE_ANALYSIS_MAX_TRANSCRIPT_CANDIDATES) return found;
    }
  }
  return found;
}

function normalizeLiveAnalysisCliContext(context) {
  return Object.freeze({
    graphFunctionName: stringOrNull(context, "graphFunctionName"),
    targetAssetType: stringOrNull(context, "targetAssetType")
  });
}

function operatorRunMatchesCliContext(manifest, context) {
  if (!isObject(manifest)) return false;
  const graphFunctionName = stringOrNull(context, "graphFunctionName");
  const targetAssetType = stringOrNull(context, "targetAssetType");
  const manifestGraphNames = new Set([
    stringOrNull(manifest, "graphFunctionName"),
    stringOrNull(manifest, "edgeName")
  ].filter(Boolean));
  if (graphFunctionName && manifestGraphNames.has(graphFunctionName)) return true;
  if (targetAssetType && stringOrNull(manifest, "targetAssetType") === targetAssetType) return true;
  return false;
}

function isRelatedStageCliCandidate(candidate) {
  const role = stringField(candidate, "role");
  return role === "evaluate" || role === "consequence" || role === "human_callout";
}

function isTerminalCliSurfaceCandidate(candidate) {
  return candidate?.sourceKind === "terminal_transcript" || candidate?.sourceKind === "terminal_screenlog";
}

function readDeclaredTerminalTranscriptRefs(operatorRunPath) {
  const refs = [];
  for (const filename of ["worker_process_summary.json", "worker_run.json"]) {
    const payload = readJsonFile(join(operatorRunPath, filename));
    const ref = pathFromArchiveRef(stringField(payload, "terminalTranscriptRef"));
    if (ref) refs.push(ref);
    const traceRoot = pathFromArchiveRef(stringField(payload, "traceRoot"));
    if (traceRoot) refs.push(join(traceRoot, "terminal.transcript"));
  }
  refs.push(join(operatorRunPath, "worker_process_events.jsonl.trace", "terminal.transcript"));
  return uniqueInOrder(refs);
}

function scanLiveAnalysisCliTranscriptFiles(operatorRunPath) {
  const found = [];
  let visited = 0;
  const walk = (currentPath, depth) => {
    if (depth > LIVE_ANALYSIS_MAX_TRANSCRIPT_SCAN_DEPTH || visited > LIVE_ANALYSIS_MAX_TRANSCRIPT_SCAN_ENTRIES) return;
    let entries;
    try {
      entries = readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (visited > LIVE_ANALYSIS_MAX_TRANSCRIPT_SCAN_ENTRIES) return;
      const entryPath = join(currentPath, entry.name);
      visited += 1;
      if (entry.isDirectory()) {
        walk(entryPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const sourceKind = liveAnalysisCliSourceKindForPath(entryPath);
      if (!sourceKind) continue;
      const role = inferCliTranscriptRole(operatorRunPath, entryPath);
      found.push(Object.freeze({
        sourceKind,
        path: entryPath,
        role,
        label: cliTranscriptLabel(role, sourceKind, operatorRunPath, entryPath)
      }));
    }
  };
  walk(operatorRunPath, 0);
  return found;
}

function liveAnalysisCliSourceKindForPath(path) {
  const normalized = String(path || "").replace(/\\/g, "/");
  if (normalized.endsWith("/terminal_session/screenlog.0")) return "terminal_screenlog";
  if (normalized.endsWith("/terminal.transcript") || normalized.endsWith(".transcript")) return "terminal_transcript";
  if (normalized.endsWith("/stdout.raw") || normalized.endsWith("_stdout.log")) return "worker_stdout";
  if (normalized.endsWith("/stderr.raw") || normalized.endsWith("_stderr.log")) return "worker_stderr";
  if (normalized.endsWith("/final_output.txt")) return "final_output";
  return null;
}

function inferCliTranscriptRole(operatorRunPath, path) {
  const rel = relative(operatorRunPath, path).replace(/\\/g, "/").toLowerCase();
  if (rel.includes("evaluate") || rel.includes("evaluator")) return "evaluate";
  if (rel.includes("consequence")) return "consequence";
  if (rel.includes("human_callout") || rel.includes("human-callout")) return "human_callout";
  if (rel.includes("transform") || rel.startsWith("worker_") || rel.startsWith("worker_process")) return "transform";
  return "worker";
}

function cliTranscriptLabel(role, sourceKind, operatorRunPath, path) {
  const roleLabel = {
    transform: "Transform",
    evaluate: "Evaluator",
    consequence: "Consequence",
    human_callout: "Human callout",
    worker: "Worker"
  }[role] || "Worker";
  if (sourceKind === "terminal_transcript") return `${roleLabel} CLI`;
  if (sourceKind === "terminal_screenlog") return `${roleLabel} screen log`;
  if (sourceKind === "worker_stdout") return `${roleLabel} stdout`;
  if (sourceKind === "worker_stderr") return `${roleLabel} stderr`;
  if (sourceKind === "final_output") return `${roleLabel} final output`;
  const rel = relative(operatorRunPath, path).replace(/\\/g, "/");
  return `${roleLabel} ${rel.split("/").pop() || "transcript"}`;
}

function pathFromArchiveRef(ref) {
  if (typeof ref !== "string" || !ref.trim()) return null;
  return ref.startsWith("file://") ? fileRefToPath(ref) : ref;
}

function readLiveAnalysisCliTranscriptCandidate(candidate) {
  let raw;
  let byteCount = 0;
  try {
    byteCount = statSync(candidate.path).size;
    raw = byteCount > LIVE_ANALYSIS_MAX_TRANSCRIPT_BYTES
      ? readFileHead(candidate.path, LIVE_ANALYSIS_MAX_TRANSCRIPT_BYTES)
      : readFileSync(candidate.path, "utf8");
  } catch {
    return emptyLiveAnalysisCliTranscript();
  }
  const byteLimited = byteCount > LIVE_ANALYSIS_MAX_TRANSCRIPT_BYTES;
  if (byteLimited && !/\r?\n$/.test(raw)) {
    raw = dropPartialTrailingLine(raw);
  }
  const sourceLines = raw.split(/\r?\n/);
  const lineCount = raw.endsWith("\n") ? Math.max(0, sourceLines.length - 1) : sourceLines.length;
  const projectedRows = sourceLines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => line.length > 0 || index < lineCount);
  const projectedLines = projectedRows
    .slice(0, LIVE_ANALYSIS_MAX_TRANSCRIPT_LINES)
    .map(({ line, index }) => mapLiveAnalysisTranscriptLine(line, index));
  if (byteLimited || projectedRows.length > LIVE_ANALYSIS_MAX_TRANSCRIPT_LINES) {
    projectedLines.push(transcriptLine(
      projectedLines.length,
      "transcript_truncated",
      null,
      "archive truncated",
      [
        `${projectedLines.length} transcript lines are projected in Live View.`,
        `${formatLiveBytes(byteCount)} remain available in the source archive.`
      ].join("\n"),
      "pending"
    ));
  }
  return Object.freeze({
    kind: "sidecar_live_analysis_cli_transcript",
    id: cliTranscriptId(candidate),
    label: candidate.label,
    role: candidate.role,
    sourceKind: candidate.sourceKind,
    sourcePath: candidate.path,
    byteCount,
    lineCount,
    lines: Object.freeze(projectedLines)
  });
}

function cliTranscriptId(candidate) {
  const raw = String(candidate?.path || candidate?.label || "missing");
  return `cli:${raw.replace(/[^A-Za-z0-9_.:/-]+/g, "-")}`;
}

function mapLiveAnalysisTranscriptLine(line, index) {
  const cleanLine = stripAnsi(line);
  const fallback = (label, tone = "default") => Object.freeze({
    kind: "sidecar_live_analysis_transcript_line",
    index,
    eventType: "raw",
    role: null,
    label,
    text: cleanLine,
    tone
  });
  const trimmed = cleanLine.trim();
  if (!trimmed.startsWith("{")) {
    return fallback(trimmed.includes("__ABG_PTY_EXIT") ? "PTY exit" : "terminal");
  }
  let payload;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return fallback("terminal");
  }
  const eventType = stringField(payload, "type") || "event";
  if (eventType === "system") {
    return transcriptLine(index, eventType, null, "system init", [
      `cwd: ${stringField(payload, "cwd") || "unknown"}`,
      `model: ${stringField(payload, "model") || "unknown"}`,
      `session: ${stringField(payload, "session_id") || "unknown"}`
    ].join("\n"), "default");
  }
  if (eventType === "rate_limit_event") {
    const info = isObject(payload.rate_limit_info) ? payload.rate_limit_info : {};
    return transcriptLine(index, eventType, null, "rate limit", JSON.stringify(info, null, 2), "pending");
  }
  if (eventType === "assistant") {
    const message = isObject(payload.message) ? payload.message : {};
    return transcriptLine(
      index,
      eventType,
      "assistant",
      "assistant",
      transcriptMessageContent(message),
      "active"
    );
  }
  if (eventType === "user") {
    const message = isObject(payload.message) ? payload.message : {};
    return transcriptLine(
      index,
      eventType,
      "user",
      "tool result",
      transcriptMessageContent(message),
      "default"
    );
  }
  if (eventType === "result") {
    return transcriptLine(
      index,
      eventType,
      null,
      stringField(payload, "subtype") || "result",
      stringField(payload, "result") || JSON.stringify(payload, null, 2),
      payload.is_error === true ? "blocked" : "active"
    );
  }
  return transcriptLine(index, eventType, null, eventType, JSON.stringify(payload, null, 2), "default");
}

function transcriptLine(index, eventType, role, label, text, tone) {
  return Object.freeze({
    kind: "sidecar_live_analysis_transcript_line",
    index,
    eventType,
    role,
    label,
    text: truncateLiveEventPreview(String(text ?? ""), LIVE_ANALYSIS_MAX_TRANSCRIPT_LINE_CHARS),
    tone
  });
}

function transcriptMessageContent(message) {
  const content = Array.isArray(message?.content) ? message.content : [];
  if (content.length === 0) return JSON.stringify(message, null, 2);
  const rendered = content.map((entry) => {
    if (typeof entry === "string") return entry;
    if (!isObject(entry)) return JSON.stringify(entry);
    const type = stringField(entry, "type");
    if (type === "text") return stringField(entry, "text");
    if (type === "thinking") return "[thinking omitted]";
    if (type === "tool_use") {
      const name = stringField(entry, "name") || "tool";
      const input = entry.input === undefined ? "" : `\n${JSON.stringify(entry.input, null, 2)}`;
      return `Tool call: ${name}${input}`;
    }
    if (type === "tool_result") {
      const toolUseId = stringField(entry, "tool_use_id");
      const result = typeof entry.content === "string"
        ? entry.content
        : JSON.stringify(entry.content ?? entry, null, 2);
      return `${toolUseId ? `Tool result: ${toolUseId}\n` : ""}${result}`;
    }
    return JSON.stringify(entry, null, 2);
  });
  return rendered.filter((part) => typeof part === "string" && part.length > 0).join("\n\n");
}

const LIVE_ANALYSIS_EVENT_ARTIFACTS = Object.freeze([
  ["run.json", "Run envelope"],
  ["run_compact.json", "Run compact"],
  ["operator_summary.json", "Operator summary"],
  ["worker_process_started.json", "Worker process started"],
  ["worker_process_started_context.json", "Worker launch context"],
  ["worker_run.json", "Worker run"],
  ["worker_result_report.json", "Worker result report"],
  ["worker_process_summary.json", "Worker process summary"],
  ["fp_evaluate_result.json", "F_P evaluate result"],
  ["fp_transform_result.json", "F_P transform result"],
  ["fp_transform_request.json", "F_P transform request"],
  ["post_transform_observation.json", "Post-transform observation"],
  ["postflight.json", "Postflight"],
  ["sdlc_construction_intent.json", "Construction intent"],
  ["traversal_intent_package.json", "Traversal intent"],
  ["sdlc_edge_fulfillment_ledger.json", "Edge fulfillment ledger"],
  ["sdlc_edge_closure_decision.json", "Edge closure decision"],
  ["sdlc_next_action_projection.json", "Next action projection"],
  ["sdlc_edge_residual_pressure.json", "Residual pressure"],
  ["sdlc_edge_gain.json", "Edge gain"],
  ["assurance_satisfaction.json", "Assurance satisfaction"],
  ["assurance_ledgers.json", "Assurance ledgers"],
  ["product_materialization_manifest.json", "Product materialization"],
  ["handoff_manifest.json", "Handoff manifest"],
  ["runtime_liveness_observer_projection.json", "Runtime liveness observer"],
  ["hook_outcome.json", "Hook outcome"],
  ["sdlc_decomposition_summary.json", "Decomposition summary"],
  ["sdlc_implementation_decomposition_summary.json", "Implementation decomposition"],
  ["sdlc_frontdoor_decomposition_summary.json", "Frontdoor decomposition"],
  ["sdlc_overlay_segment_completion.json", "Overlay segment completion"],
  ["sdlc_traversal_hop_selection.json", "Traversal hop selection"],
  ["sdlc_frontdoor_traversal_hop_selection.json", "Frontdoor traversal hop"],
  ["sdlc_module_dependency_map.json", "Module dependency map"],
  ["sdlc_module_dependency_traversal_selection.json", "Module dependency traversal"],
  ["conformed_project.json", "Conformed project"],
]);

const LIVE_ANALYSIS_MAX_RUNTIME_EVENTS = 420;
const LIVE_ANALYSIS_MAX_WORKER_EVENTS = 120;
const LIVE_ANALYSIS_EVENT_PREVIEW_BYTES = 2600;
const LIVE_ANALYSIS_MAX_JSON_PARSE_BYTES = 8 * 1024 * 1024;
const LIVE_ANALYSIS_MAX_EVENT_STREAM_BYTES = 4 * 1024 * 1024;
const LIVE_ANALYSIS_MAX_TRANSCRIPT_BYTES = 512 * 1024;
const LIVE_ANALYSIS_MAX_TRANSCRIPT_LINES = 600;
const LIVE_ANALYSIS_MAX_TRANSCRIPT_LINE_CHARS = 6000;
const LIVE_ANALYSIS_MAX_TRANSCRIPT_CANDIDATES = 12;
const LIVE_ANALYSIS_MAX_TRANSCRIPT_SCAN_DEPTH = 5;
const LIVE_ANALYSIS_MAX_TRANSCRIPT_SCAN_ENTRIES = 600;
const LIVE_ANALYSIS_MAX_RELATED_TRANSCRIPT_RUNS = 120;
const LIVE_ANALYSIS_MAX_MANIFEST_PARSE_BYTES = 2 * 1024 * 1024;
const LIVE_ANALYSIS_MANIFEST_HEAD_BYTES = 256 * 1024;
const LIVE_ANALYSIS_MAX_TRACE_RESULT_PARSE_BYTES = 256 * 1024;
const LIVE_ANALYSIS_TRACE_RESULT_HEAD_BYTES = 256 * 1024;

function readLiveAnalysisEventTickets(operatorRunPath) {
  const rows = [];
  let index = 0;
  for (const [fileName, title] of LIVE_ANALYSIS_EVENT_ARTIFACTS) {
    const sourcePath = join(operatorRunPath, fileName);
    if (!existsSync(sourcePath)) continue;
    const read = readBoundedJsonFile(sourcePath, LIVE_ANALYSIS_MAX_JSON_PARSE_BYTES);
    if (read.skipped) {
      rows.push(liveAnalysisSkippedArchiveTicket({
        index: index++,
        sourceKind: "artifact",
        sourcePath,
        eventType: fileName.replace(/\.json$/, ""),
        title,
        byteSize: read.byteSize,
        limitBytes: LIVE_ANALYSIS_MAX_JSON_PARSE_BYTES,
        reason: read.reason
      }));
      continue;
    }
    const payload = read.payload;
    if (payload === null) continue;
    rows.push(liveAnalysisEventTicket({
      index: index++,
      sourceKind: "artifact",
      sourcePath,
      eventType: fileName.replace(/\.json$/, ""),
      title,
      summary: summarizeLiveArtifact(fileName, payload),
      tone: liveArtifactTone(fileName, payload),
      elapsedMs: null,
      observedAtMs: null,
      detailRows: liveEventDetailRows(payload, liveArtifactPreferredKeys(fileName)),
      evidenceRefs: liveEventEvidenceRefs(payload),
      rawPayload: payload
    }));
  }

  const runtimePath = join(operatorRunPath, "runtime_events.json");
  const runtimeRead = readBoundedJsonFile(runtimePath, LIVE_ANALYSIS_MAX_JSON_PARSE_BYTES);
  if (runtimeRead.skipped) {
    rows.push(liveAnalysisSkippedArchiveTicket({
      index: index++,
      sourceKind: "runtime_event",
      sourcePath: runtimePath,
      eventType: "runtime_events_deferred",
      title: "Runtime events deferred",
      byteSize: runtimeRead.byteSize,
      limitBytes: LIVE_ANALYSIS_MAX_JSON_PARSE_BYTES,
      reason: runtimeRead.reason
    }));
  }
  const runtimePayload = runtimeRead.skipped ? null : runtimeRead.payload;
  const runtimeEvents = Array.isArray(runtimePayload?.events) ? runtimePayload.events : [];
  runtimeEvents.slice(0, LIVE_ANALYSIS_MAX_RUNTIME_EVENTS).forEach((event) => {
    if (!isObject(event)) return;
    rows.push(mapRuntimeEventTicket(event, index++, runtimePath, "runtime_event"));
  });
  if (runtimeEvents.length > LIVE_ANALYSIS_MAX_RUNTIME_EVENTS) {
    rows.push(liveAnalysisEventTicket({
      index: index++,
      sourceKind: "runtime_event",
      sourcePath: runtimePath,
      eventType: "runtime_events_truncated",
      title: "Runtime events truncated",
      summary: `${runtimeEvents.length - LIVE_ANALYSIS_MAX_RUNTIME_EVENTS} additional runtime events are available in the raw archive.`,
      tone: "pending",
      elapsedMs: null,
      observedAtMs: null,
      detailRows: liveDetailRows([
        ["Projected", String(LIVE_ANALYSIS_MAX_RUNTIME_EVENTS)],
        ["Archived", String(runtimeEvents.length)]
      ]),
      evidenceRefs: [],
      rawPayload: { archived: runtimeEvents.length, projected: LIVE_ANALYSIS_MAX_RUNTIME_EVENTS }
    }));
  }

  const workerPath = join(operatorRunPath, "worker_process_events.jsonl");
  if (existsSync(workerPath)) {
    const workerRead = readRuntimeEvents(workerPath, {
      maxBytes: LIVE_ANALYSIS_MAX_EVENT_STREAM_BYTES,
      maxEvents: LIVE_ANALYSIS_MAX_WORKER_EVENTS
    });
    workerRead.events.forEach((event) => {
      rows.push(mapWorkerEventTicket(event, index++, workerPath));
    });
    if (workerRead.truncated) {
      rows.push(liveAnalysisEventTicket({
        index: index++,
        sourceKind: "worker_event",
        sourcePath: workerPath,
        eventType: "worker_events_truncated",
        title: "Worker stream truncated",
        summary: "Additional worker stream events are available in the raw JSONL archive.",
        tone: "pending",
        elapsedMs: null,
        observedAtMs: null,
        detailRows: liveDetailRows([
          ["Projected", String(workerRead.events.length)],
          ["Archive size", formatLiveBytes(workerRead.byteSize)],
          ["Read limit", `${formatLiveBytes(LIVE_ANALYSIS_MAX_EVENT_STREAM_BYTES)} / ${LIVE_ANALYSIS_MAX_WORKER_EVENTS} events`]
        ]),
        evidenceRefs: [],
        rawPayload: {
          archivedBytes: workerRead.byteSize,
          projected: workerRead.events.length,
          maxBytes: LIVE_ANALYSIS_MAX_EVENT_STREAM_BYTES,
          maxEvents: LIVE_ANALYSIS_MAX_WORKER_EVENTS
        }
      }));
    }
  }

  return Object.freeze(rows);
}

function mapRuntimeEventTicket(event, index, sourcePath, sourceKind) {
  const eventType = stringField(event, "kind") || stringField(event, "type") || "event";
  return liveAnalysisEventTicket({
    index,
    sourceKind,
    sourcePath,
    eventType,
    title: humanizeLiveEvent(eventType),
    summary: summarizeRuntimeEvent(event),
    tone: liveRuntimeEventTone(event),
    elapsedMs: numberOrNull(event, "elapsedMs"),
    observedAtMs: numberOrNull(event, "observedAtMs"),
    detailRows: liveEventDetailRows(event, [
      "edge",
      "vectorIndex",
      "graphFunctionId",
      "workerId",
      "backendId",
      "probeSource",
      "streamName",
      "byteLength",
      "pid",
      "exitCode",
      "status",
      "detail",
      "activityRef",
      "correlationId"
    ]),
    evidenceRefs: liveEventEvidenceRefs(event),
    rawPayload: event
  });
}

function mapWorkerEventTicket(event, index, sourcePath) {
  const eventType = stringField(event, "type") || stringField(event, "kind") || "worker_event";
  return liveAnalysisEventTicket({
    index,
    sourceKind: "worker_event",
    sourcePath,
    eventType,
    title: humanizeLiveEvent(eventType),
    summary: summarizeWorkerEvent(event),
    tone: liveWorkerEventTone(event),
    elapsedMs: null,
    observedAtMs: null,
    detailRows: liveEventDetailRows(event, [
      "type",
      "subtype",
      "role",
      "is_error",
      "duration_ms",
      "total_cost_usd",
      "session_id",
      "cwd",
      "model"
    ]),
    evidenceRefs: liveEventEvidenceRefs(event),
    rawPayload: event
  });
}

function liveAnalysisSkippedArchiveTicket({
  index,
  sourceKind,
  sourcePath,
  eventType,
  title,
  byteSize,
  limitBytes,
  reason
}) {
  return liveAnalysisEventTicket({
    index,
    sourceKind,
    sourcePath,
    eventType,
    title,
    summary: `${title} is ${formatLiveBytes(byteSize)}; preview parsing was deferred to keep the Live View responsive.`,
    tone: "pending",
    elapsedMs: null,
    observedAtMs: null,
    detailRows: liveDetailRows([
      ["Archive size", formatLiveBytes(byteSize)],
      ["Parse limit", formatLiveBytes(limitBytes)],
      ["Reason", reason ?? "oversized_json"]
    ]),
    evidenceRefs: [],
    rawPayload: {
      deferred: true,
      reason: reason ?? "oversized_json",
      sourcePath,
      byteSize,
      limitBytes
    }
  });
}

function liveAnalysisEventTicket({
  index,
  sourceKind,
  sourcePath,
  eventType,
  title,
  summary,
  tone,
  elapsedMs,
  observedAtMs,
  detailRows,
  evidenceRefs,
  rawPayload
}) {
  return Object.freeze({
    kind: "sidecar_live_analysis_event",
    index,
    sourceKind,
    sourcePath,
    eventType,
    title,
    summary,
    tone,
    elapsedMs,
    observedAtMs,
    detailRows: Object.freeze(detailRows),
    evidenceRefs: Object.freeze(evidenceRefs),
    rawPreview: truncateLiveEventPreview(JSON.stringify(rawPayload, null, 2))
  });
}

function summarizeLiveArtifact(fileName, payload) {
  if (!isObject(payload)) {
    return Array.isArray(payload)
      ? `${fileName} archived ${payload.length} rows.`
      : `${fileName} archived ${typeof payload} payload.`;
  }
  const candidates = [
    stringField(payload, "summary"),
    stringField(payload, "detail"),
    stringField(payload, "status"),
    stringField(payload, "disposition"),
    stringField(payload, "targetCarrierAdmissionStatus"),
    stringField(payload, "result"),
    stringField(payload, "outcome")
  ].filter(Boolean);
  if (candidates.length > 0) return candidates[0];
  const kind = stringField(payload, "kind") || fileName.replace(/\.json$/, "");
  const fieldCount = Object.keys(payload).length;
  return `${humanizeLiveEvent(kind)} artifact with ${fieldCount} top-level fields.`;
}

function summarizeRuntimeEvent(event) {
  const detail = stringField(event, "detail");
  if (detail) return detail;
  const edge = stringField(event, "edge");
  const probe = stringField(event, "probeSource");
  const streamName = stringField(event, "streamName");
  const byteLength = numberField(event, "byteLength");
  if (edge && probe) return `${edge} emitted ${probe}${byteLength === null ? "" : ` (${byteLength} bytes)`}.`;
  if (edge) return `${edge} runtime event.`;
  if (probe) return `Runtime probe ${probe} observed.`;
  if (streamName) return `${streamName} stream activity observed.`;
  return "Runtime event archived for this selected stage.";
}

function summarizeWorkerEvent(event) {
  const type = stringField(event, "type") || "worker_event";
  if (type === "assistant" || type === "user") {
    const message = isObject(event.message) ? event.message : {};
    return truncateLiveEventPreview(transcriptMessageContent(message), 360);
  }
  if (type === "result") {
    return stringField(event, "subtype") || stringField(event, "result") || "worker result event";
  }
  if (type === "system") {
    return `worker session ${stringField(event, "session_id") || "unknown"} initialized`;
  }
  return stringField(event, "subtype") || `${type} worker stream event`;
}

function liveArtifactPreferredKeys(fileName) {
  const common = [
    "kind",
    "status",
    "disposition",
    "edge",
    "edgeName",
    "graphFunctionName",
    "graphVectorRef",
    "targetAssetType",
    "workerStatus",
    "pid",
    "exitCode",
    "command",
    "cwd",
    "durationMs",
    "elapsedMs",
    "admitted",
    "closeReady",
    "edgeConverged",
    "carryConverged",
    "fulfillmentConverged",
    "targetCarrierAdmissionStatus",
    "targetCertificationPassed",
    "fdRecheckPassed",
    "selectedNextActionRef",
    "nextGraphVectorRef"
  ];
  if (fileName.includes("assurance")) {
    return ["kind", "status", "satisfiedDimensions", "missingRequiredDimensions", "gapReasons", "blockingReasons", ...common];
  }
  if (fileName.includes("ledger")) {
    return ["kind", "version", "edgeName", "targetAssetType", "counts", "rows", "gapPressureRefs", ...common];
  }
  return common;
}

function liveEventDetailRows(payload, preferredKeys) {
  if (!isObject(payload)) {
    return liveDetailRows([
      ["Payload", Array.isArray(payload) ? `${payload.length} rows` : typeof payload]
    ]);
  }
  const rows = [];
  for (const key of preferredKeys) {
    if (payload[key] === undefined || payload[key] === null) continue;
    rows.push(liveDetailRow(humanizeLiveEvent(key), summarizeLiveValue(payload[key])));
    if (rows.length >= 14) break;
  }
  if (rows.length < 10) {
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null || preferredKeys.includes(key)) continue;
      rows.push(liveDetailRow(humanizeLiveEvent(key), summarizeLiveValue(value)));
      if (rows.length >= 14) break;
    }
  }
  return rows;
}

function liveDetailRows(entries) {
  return entries.map(([label, value]) => liveDetailRow(label, value));
}

function liveDetailRow(label, value) {
  return Object.freeze({
    kind: "sidecar_live_analysis_event_detail_row",
    label,
    value: String(value)
  });
}

function summarizeLiveValue(value) {
  let rendered;
  if (Array.isArray(value)) {
    if (value.length === 0) return "0";
    const sample = value.slice(0, 4).map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join(", ");
    rendered = value.length > 4 ? `${value.length} rows: ${sample}` : sample;
    return truncateLiveSummary(rendered);
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    const sample = keys.slice(0, 5).map((key) => `${key}: ${summarizeLiveScalar(value[key])}`).join("; ");
    rendered = keys.length > 5 ? `${keys.length} fields: ${sample}` : sample || "{}";
    return truncateLiveSummary(rendered);
  }
  return truncateLiveSummary(summarizeLiveScalar(value));
}

function summarizeLiveScalar(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "0";
    const sample = value.slice(0, 3).map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join(", ");
    return value.length > 3 ? `${value.length} rows: ${sample}` : sample;
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    return keys.length ? `${keys.length} fields: ${keys.slice(0, 4).join(", ")}` : "{}";
  }
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 237)}...` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "—";
  return String(value);
}

function truncateLiveSummary(value) {
  return value.length > 420 ? `${value.slice(0, 417)}...` : value;
}

function liveEventEvidenceRefs(payload) {
  if (!isObject(payload)) return [];
  const refs = [
    ...stringArray(payload.evidenceRefs),
    ...stringArray(payload.reasonRefs),
    ...stringArray(payload.basisRefs),
    ...stringArray(payload.causationEventRefs)
  ];
  for (const key of ["stdoutRef", "stderrRef", "streamRef", "ledgerRef", "decisionRef", "edgeGainRef"]) {
    const value = stringField(payload, key);
    if (value) refs.push(value);
  }
  return uniqueInOrder(refs).slice(0, 12);
}

function liveArtifactTone(fileName, payload) {
  const folded = JSON.stringify(payload).toLowerCase();
  const status = isObject(payload) ? `${stringField(payload, "status")} ${stringField(payload, "disposition")} ${stringField(payload, "outcome")}`.toLowerCase() : "";
  if (status.includes("fail") || status.includes("error") || status.includes("block") || folded.includes('"is_error":true')) return "blocked";
  if (status.includes("retry") || status.includes("repair") || fileName.includes("residual_pressure")) return "pending";
  if (status.includes("pass") || status.includes("close") || fileName.includes("gain") || fileName.includes("assurance")) return "active";
  return "default";
}

function liveRuntimeEventTone(event) {
  const kind = stringField(event, "kind").toLowerCase();
  const detail = stringField(event, "detail").toLowerCase();
  if (kind.includes("error") || kind.includes("failed") || detail.includes("failed") || detail.includes("error")) return "blocked";
  if (kind.includes("closed") || kind.includes("validated") || kind.includes("admitted") || kind.includes("result")) return "active";
  if (kind.includes("dispatch") || kind.includes("planned") || kind.includes("started") || kind.includes("probe")) return "pending";
  return "default";
}

function liveWorkerEventTone(event) {
  if (event?.is_error === true) return "blocked";
  const type = stringField(event, "type");
  if (type === "result") return "active";
  if (type === "assistant") return "active";
  if (type === "rate_limit_event") return "pending";
  return "default";
}

function humanizeLiveEvent(value) {
  return String(value)
    .replace(/\.json$/, "")
    .replace(/[_:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncateLiveEventPreview(value, maxLength = LIVE_ANALYSIS_EVENT_PREVIEW_BYTES) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n... truncated ${value.length - maxLength} chars`;
}

function stripAnsi(value) {
  return value
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b[()#][0-9A-Za-z]/g, "");
}

function mapLiveAnalysisAssuranceLedgerToSidecar(ledger) {
  if (!isObject(ledger)) return null;
  const dimension = stringField(ledger, "dimension");
  if (!dimension) return null;
  return Object.freeze({
    kind: "sidecar_live_analysis_assurance_ledger",
    dimension,
    verdict: stringField(ledger, "verdict") || "unknown",
    required: booleanOrNull(ledger.required) ?? true,
    evidenceRefCount: stringArray(ledger.evidenceRefs).length,
    carryForwardObligationRefCount: stringArray(ledger.carryForwardObligationRefs).length,
    reasonCount: Array.isArray(ledger.reasons) ? ledger.reasons.length : 0
  });
}

function groupByOperatorRunRef(items, mapper) {
  const grouped = new Map();
  for (const item of items) {
    if (!isObject(item)) continue;
    const operatorRunRef = stringField(item, "operatorRunRef");
    if (!operatorRunRef) continue;
    const mapped = mapper(item);
    if (!mapped) continue;
    appendMapValue(grouped, operatorRunRef, mapped);
  }
  return grouped;
}

function groupByAttemptRef(items, mapper) {
  const grouped = new Map();
  for (const item of items) {
    if (!isObject(item)) continue;
    const attemptRef = stringField(item, "attemptRef");
    if (!attemptRef) continue;
    const mapped = mapper(item);
    if (!mapped) continue;
    appendMapValue(grouped, attemptRef, mapped);
  }
  return grouped;
}

function groupMappedByKey(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    appendMapValue(grouped, key, item);
  }
  return grouped;
}

function groupStageCoverageByOperatorRun(stages) {
  const grouped = new Map();
  for (const stage of stages) {
    if (!isObject(stage)) continue;
    const mapped = mapLiveAnalysisStageCoverageToSidecar(stage);
    if (!mapped) continue;
    for (const ref of stringArray(stage.operatorRunRefs)) {
      appendMapValue(grouped, ref, mapped);
    }
  }
  return grouped;
}

function appendMapValue(map, key, value) {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

function fileRefToPath(ref) {
  if (typeof ref !== "string" || !ref.startsWith("file://")) return ref || null;
  try {
    return decodeURIComponent(new URL(ref).pathname);
  } catch {
    return ref.slice("file://".length) || null;
  }
}

function liveAnalysisInspectedKind(value) {
  return value === "run-archive" || value === "operator-run" ? value : "workspace";
}

function liveAnalysisProfile(value) {
  return value === "hello_world" || value === "data_mapper" ? value : "generic";
}

function liveAnalysisDiagnosticSeverity(value) {
  return value === "error" || value === "warn" ? value : "info";
}

function liveAnalysisProductiveSignal(value) {
  return value === "progressing" ||
    value === "stalled_with_io" ||
    value === "stalled_no_io" ||
    value === "completed" ||
    value === "aborted_or_killed"
    ? value
    : "unknown";
}

function liveAnalysisStageClass(value) {
  return value === "constructive" ||
    value === "projection" ||
    value === "rollup" ||
    value === "missing" ||
    value === "unmapped"
    ? value
    : "unmapped";
}

function liveAnalysisRuntimeGapStatus(value) {
  return value === "malformed" || value === "incomplete" ? value : "missing";
}

function liveAnalysisRetryCauseClass(value) {
  return value === "prompt_schema_gap" ||
    value === "framework_carrier_parser_drift" ||
    value === "worker_policy_violation" ||
    value === "target_carrier_admission_missing" ||
    value === "deterministic_evaluator_bug" ||
    value === "harness_bug" ||
    value === "runtime_bug" ||
    value === "tenant_source_defect"
    ? value
    : "unknown";
}

function liveAnalysisLineageStatus(value) {
  return value === "present" || value === "absent" ? value : "unknown";
}

function liveAnalysisBlockingReason(value) {
  if (typeof value === "string") return value;
  if (isObject(value)) {
    return stringField(value, "code") || stringField(value, "kind") || null;
  }
  return null;
}

function mapSdlcCatalogToSidecar(payload, installRoot) {
  const executives = Array.isArray(payload.executives) ? payload.executives : [];
  const functions = Array.isArray(payload.functions) ? payload.functions : [];
  const libraryFunctions = Array.isArray(payload.libraryFunctions) ? payload.libraryFunctions : [];

  // Catalog origin is derived from executive `steps` arrays.
  // bootstrap_release_self_test owns BOOTSTRAP_RELEASE_FUNCTION_CATALOG names;
  // release_operational_cycle owns OPERATIONAL_FUNCTION_CATALOG names;
  // anything else is triage.
  const bootstrapNames = new Set(
    stringArray(executives.find((e) => e?.name === "bootstrap_release_self_test")?.steps ?? [])
  );
  const operationalNames = new Set(
    stringArray(executives.find((e) => e?.name === "release_operational_cycle")?.steps ?? [])
  );

  const sidecarLeaves = functions.map((fn) => mapLeafToSidecar(fn, bootstrapNames, operationalNames));
  const sidecarExecutives = executives.map(mapExecutiveToSidecar).filter(Boolean);
  const sidecarLibrary = libraryFunctions.map(mapLibraryToSidecar).filter(Boolean);

  return Object.freeze({
    kind: "sidecar_process_catalog",
    contractName: SIDECAR_PROCESS_CATALOG_CONTRACT_NAME,
    contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
    fetchedAt: new Date().toISOString(),
    installRoot,
    executives: Object.freeze(sidecarExecutives),
    leaves: Object.freeze(sidecarLeaves),
    library: Object.freeze(sidecarLibrary)
  });
}

function mapLeafToSidecar(fn, bootstrapNames, operationalNames) {
  const name = stringField(fn, "name") || "";
  const catalog = bootstrapNames.has(name)
    ? "bootstrap"
    : operationalNames.has(name)
    ? "operational"
    : "triage";
  return Object.freeze({
    kind: "sidecar_leaf_graph_function_view",
    name,
    intent: stringField(fn, "intent"),
    inputs: stringArray(fn?.inputs),
    outputs: stringArray(fn?.outputs),
    catalog,
    transformContractRef:
      stringField(fn, "transformContractRef") || `transform://odd_sdlc/${name}`,
    evaluationContractRef:
      stringField(fn, "evaluationContractRef") || `evaluation://odd_sdlc/${name}`,
    traversalModulationStrategy: SIDECAR_LEAF_DEFAULT_TRAVERSAL_MODULATION,
    proofObligations: SIDECAR_LEAF_DEFAULT_PROOF_OBLIGATIONS,
    requirementRefs: SIDECAR_LEAF_DEFAULT_REQUIREMENT_REFS,
    evaluators: Object.freeze([
      Object.freeze({
        name: `${name}_core_fd`,
        regime: "F_D",
        binding: `fd://odd_sdlc/${name}/core`
      }),
      Object.freeze({
        name: `${name}_semantic_fp`,
        regime: "F_P",
        binding: `fp://odd_sdlc/${name}/construct`
      })
    ]),
    operator: Object.freeze({
      name: "odd_sdlc_typescript_builder",
      regime: "F_P",
      binding: "agent://odd_sdlc/typescript-builder"
    })
  });
}

function mapExecutiveToSidecar(executive) {
  if (!executive || typeof executive.name !== "string") return null;
  return Object.freeze({
    kind: "sidecar_executive_view",
    name: executive.name,
    intent: stringField(executive, "intent"),
    steps: stringArray(executive.steps),
    outputs: stringArray(executive.outputs)
  });
}

function mapLibraryToSidecar(libraryFn) {
  if (!libraryFn || typeof libraryFn.name !== "string") return null;
  return Object.freeze({
    kind: "sidecar_library_function_view",
    name: libraryFn.name,
    intent: stringField(libraryFn, "intent"),
    stableOuterContract: stringField(libraryFn, "stableOuterContract"),
    computeOrder: stringArray(libraryFn.computeOrder),
    abgOwnedRuntimeTruth: stringArray(libraryFn.abgOwnedRuntimeTruth),
    sdlcOwnedDomainTruth: stringArray(libraryFn.sdlcOwnedDomainTruth)
  });
}

function mapTraversalOverlays(queryDomain) {
  const overlays = Array.isArray(queryDomain?.traversalOverlays?.overlays)
    ? queryDomain.traversalOverlays.overlays
    : [];
  return Object.freeze(overlays.map(mapTraversalOverlayToSidecar).filter(Boolean));
}

function mapTraversalOverlayToSidecar(overlay) {
  if (!isObject(overlay) || typeof overlay.overlayRef !== "string") return null;
  const termination = isObject(overlay.termination) ? overlay.termination : {};
  const assetTemplates = Array.isArray(overlay.assetTemplates) ? overlay.assetTemplates : [];
  return Object.freeze({
    kind: "sidecar_traversal_overlay",
    overlayRef: overlay.overlayRef,
    name: stringField(overlay, "name") || overlay.overlayRef,
    intent: stringField(overlay, "intent"),
    graphFunctionRefs: Object.freeze(stringArray(overlay.graphFunctionRefs)),
    graphVectorRefs: Object.freeze(stringArray(overlay.graphVectorRefs)),
    publicStartTargets: Object.freeze(stringArray(overlay.publicStartTargets)),
    defaultStartTarget: stringField(overlay, "defaultStartTarget"),
    terminalAssetTypes: Object.freeze(stringArray(termination.terminalAssetTypes)),
    terminalGraphFunctionRefs: Object.freeze(stringArray(termination.terminalGraphFunctionRefs)),
    lawfulStopDispositions: Object.freeze(stringArray(termination.lawfulStopDispositions)),
    nextEligibleOverlayRefs: Object.freeze(stringArray(termination.nextEligibleOverlayRefs)),
    predecessorOverlayRefs: Object.freeze(stringArray(overlay.predecessorOverlayRefs)),
    assetTemplates: Object.freeze(assetTemplates.map(mapOverlayAssetTemplateToSidecar).filter(Boolean))
  });
}

function mapOverlayAssetTemplateToSidecar(template) {
  if (!isObject(template) || typeof template.assetType !== "string") return null;
  const terminalRole = stringField(template, "terminalRole");
  return Object.freeze({
    kind: "sidecar_overlay_asset_template",
    assetType: template.assetType,
    defaultPath: stringField(template, "defaultPath"),
    producerGraphFunctionRef: stringField(template, "producerGraphFunctionRef"),
    terminalRole:
      terminalRole === "supporting_asset" ? "supporting_asset" : "terminal_asset",
    templateRef: stringField(template, "templateRef")
  });
}

// ---------------------------------------------------------------------------
// T-026 + T-022: per-leaf overlay loader. Reads the latest op-run dir under
// .ai-workspace/runtime/odd_sdlc/operator-runs/, and for each leaf trace
// directory builds a SidecarLeafOverlay. Folds traced call-out evidence
// from `result.json` (if present) into the overlay's tracedEvidence array.
// Returns [] when no op-runs are present.
// ---------------------------------------------------------------------------

function loadLeafOverlaysForLatestOpRun(root) {
  // Each timestamped dir under .ai-workspace/runtime/odd_sdlc/operator-runs/
  // is ONE supervised actor invocation; its leaf identity lives in
  // handoff_manifest.json:edgeName. Many operator-runs accumulate over time
  // — same leaf may be invoked across multiple operator-runs (retries, repair,
  // separate executive passes). Group all operator-runs by leaf name and
  // produce one overlay per leaf with accumulated evidence.
  const runsDir = join(root, SIDECAR_OPERATOR_RUNS_RELATIVE_PATH);
  if (!existsSync(runsDir)) return [];
  let entries;
  try {
    entries = readdirSync(runsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const opRunDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const path = join(runsDir, entry.name);
      let mtime = 0;
      try {
        mtime = statSync(path).mtimeMs;
      } catch {
        /* swallow */
      }
      return { name: entry.name, path, mtime };
    })
    .sort((a, b) => a.mtime - b.mtime || a.name.localeCompare(b.name)); // oldest -> newest so derived status reflects most recent
  const byLeaf = new Map();
  for (const opRun of opRunDirs) {
    const manifest = readOpRunManifest(opRun.path);
    if (!manifest) continue;
    const leafName = stringField(manifest, "edgeName");
    if (!leafName) continue;
    let group = byLeaf.get(leafName);
    if (!group) {
      group = { leafName, opRunIds: [], opRunPaths: [], latestPath: opRun.path };
      byLeaf.set(leafName, group);
    }
    group.opRunIds.push(opRun.name);
    group.opRunPaths.push(opRun.path);
    group.latestPath = opRun.path;
  }
  const overlays = [];
  for (const group of byLeaf.values()) {
    overlays.push(buildLeafOverlay(group));
  }
  return overlays;
}

function readOpRunManifest(opRunPath) {
  const manifestPath = join(opRunPath, "handoff_manifest.json");
  if (!existsSync(manifestPath)) return null;
  const read = readBoundedJsonFile(manifestPath, LIVE_ANALYSIS_MAX_MANIFEST_PARSE_BYTES);
  if (isObject(read.payload)) return read.payload;
  if (!read.skipped) return null;
  return readOpRunManifestHeader(manifestPath);
}

function readOpRunManifestHeader(manifestPath) {
  let head = "";
  try {
    head = readFileHead(manifestPath, LIVE_ANALYSIS_MANIFEST_HEAD_BYTES);
  } catch {
    return null;
  }
  const kind = readJsonHeaderString(head, "kind");
  const edgeName = readJsonHeaderString(head, "edgeName");
  const graphFunctionName = readJsonHeaderString(head, "graphFunctionName");
  if (kind !== "sdlc_worker_handoff_manifest" && !edgeName && !graphFunctionName) return null;
  return Object.freeze({
    kind: kind || "sdlc_worker_handoff_manifest",
    graphFunctionName,
    edgeName: edgeName || graphFunctionName,
    vectorIndex: readJsonHeaderNumber(head, "vectorIndex"),
    targetAssetType: readJsonHeaderString(head, "targetAssetType"),
    edgeAssuranceContractRef: readJsonHeaderString(head, "edgeAssuranceContractRef"),
    edgeAssuranceContractDigest: readJsonHeaderString(head, "edgeAssuranceContractDigest")
  });
}

function readJsonHeaderString(text, key) {
  const match = text.match(new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function readJsonHeaderNumber(text, key) {
  const match = text.match(new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function readJsonHeaderBoolean(text, key) {
  const match = text.match(new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(true|false)`));
  return match ? match[1] === "true" : null;
}

function readNestedJsonHeaderString(text, objectKey, key) {
  const match = text.match(new RegExp(`"${escapeRegExp(objectKey)}"\\s*:\\s*\\{[\\s\\S]{0,4000}?"${escapeRegExp(key)}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLeafOverlay(group) {
  // Latest op-run drives the assurance vector + status. Earlier op-runs
  // contribute to invocation count and accumulated traced evidence.
  const latestPath = group.latestPath;
  const latestManifest = readOpRunManifest(latestPath);
  const assuranceVector = readAssuranceVector(
    join(latestPath, "assurance_satisfaction.json")
  );
  const tracedEvidence = [];
  let latestTracedEvidence = [];
  for (const opRunPath of group.opRunPaths) {
    const evidence = collectTracedEvidence(opRunPath);
    if (opRunPath === latestPath) latestTracedEvidence = evidence;
    tracedEvidence.push(...evidence);
  }
  const latestStatus = deriveLeafStatus(latestPath, latestTracedEvidence);
  const latestTraceArchiveRoot =
    latestTracedEvidence.at(-1)?.traceArchiveRoot ??
    tracedEvidence.at(-1)?.traceArchiveRoot ??
    null;
  const opRunIdLabel =
    group.opRunIds.length === 1
      ? group.opRunIds[0]
      : `${group.opRunIds[0]}..${group.opRunIds[group.opRunIds.length - 1]}`;
  return Object.freeze({
    kind: "sidecar_leaf_overlay",
    leafName: group.leafName,
    opRunId: opRunIdLabel,
    invocationCount: group.opRunIds.length,
    latestStatus,
    assuranceVector,
    traceArchiveRoot: latestTraceArchiveRoot,
    tracedEvidence: Object.freeze(tracedEvidence),
    edgeAssurance: readEdgeAssuranceOverlay(latestPath, group.leafName, latestManifest)
  });
}

function readAssuranceVector(path) {
  if (!existsSync(path)) return null;
  const json = readJsonFile(path);
  if (!json || typeof json !== "object") return null;
  const cell = (key) => {
    const raw = stringField(json, key);
    return ASSURANCE_CELL_STATES.has(raw) ? raw : "pending";
  };
  return Object.freeze({
    kind: "sidecar_assurance_ledger_vector",
    materialization: cell("materialization"),
    semanticConvergence: cell("semanticConvergence"),
    obligationCarry: cell("obligationCarry"),
    requirementFulfillment: cell("requirementFulfillment"),
    ambiguity: cell("ambiguity"),
    capability: cell("capability"),
    shallowRealization: cell("shallowRealization")
  });
}

function collectTracedEvidence(opRunPath) {
  // Per the t109 reference run, the traced call-out archive lives at
  // <opRunPath>/worker_process_events.jsonl.trace/, with the result envelope
  // at .../result.json directly inside that dir. Earlier traces pre-T-109 may
  // also place result.json directly under the op-run.
  const candidates = [];
  const archiveDir = join(opRunPath, "worker_process_events.jsonl.trace");
  const archiveResult = join(archiveDir, "result.json");
  if (existsSync(archiveResult)) candidates.push({ path: archiveResult, archive: archiveDir });
  const directResult = join(opRunPath, "result.json");
  if (existsSync(directResult)) candidates.push({ path: directResult, archive: opRunPath });
  return candidates
    .map(({ path, archive }) => admitTracedEvidenceFromResult(path, archive))
    .filter(Boolean);
}

function readEdgeAssuranceOverlay(opRunPath, leafName, manifest) {
  const ledger = readJsonFile(join(opRunPath, "sdlc_edge_fulfillment_ledger.json"));
  const closure = readJsonFile(join(opRunPath, "sdlc_edge_closure_decision.json"));
  const nextAction = readJsonFile(join(opRunPath, "sdlc_next_action_projection.json"));
  const productManifestPath = join(opRunPath, "product_materialization_manifest.json");
  const workerResult = readJsonFile(join(opRunPath, "worker_result_report.json"));
  const postflightPresent = existsSync(join(opRunPath, "postflight.json"));
  const ledgerOk = isObject(ledger) && ledger.kind === "sdlc_edge_fulfillment_ledger";
  const closureOk = isObject(closure) && closure.kind === "sdlc_edge_closure_decision";
  const nextActionOk = isObject(nextAction) && nextAction.kind === "sdlc_next_action_projection";
  const manifestOk = isObject(manifest) && manifest.kind === "sdlc_worker_handoff_manifest";
  const carrierAbsent = !ledgerOk && !closureOk && !nextActionOk;

  if (carrierAbsent && !existsSync(productManifestPath) && !isObject(workerResult) && !postflightPresent) {
    return null;
  }

  const closureDisposition = EDGE_CLOSURE_DISPOSITIONS.has(stringField(closure, "disposition"))
    ? stringField(closure, "disposition")
    : null;
  const edgeAssuranceContractRef =
    stringOrNull(ledger, "edgeAssuranceContractRef") ??
    stringOrNull(closure, "edgeAssuranceContractRef") ??
    stringOrNull(manifest, "edgeAssuranceContractRef");
  const edgeAssuranceContractDigest =
    stringOrNull(ledger, "edgeAssuranceContractDigest") ??
    stringOrNull(closure, "edgeAssuranceContractDigest") ??
    stringOrNull(manifest, "edgeAssuranceContractDigest");
  const edgeGainRef =
    stringOrNull(ledger, "edgeGainRef") ??
    stringOrNull(closure, "edgeGainRef");
  const edgeClosureFunctionRef = stringOrNull(closure, "edgeClosureFunctionRef");
  const edgeResidualPressureRefs = uniqueInOrder([
    ...stringArray(ledger?.edgeResidualPressureRefs),
    ...stringArray(closure?.edgeResidualPressureRefs)
  ]);
  const reasonRefs = uniqueInOrder(stringArray(closure?.reasonRefs));
  const gapPressureRefs = uniqueInOrder(stringArray(nextAction?.gapPressureRefs));
  const edgeConverged = booleanOrNull(ledger?.edgeConverged);
  const diagnostics = [];
  if (!ledgerOk) diagnostics.push("edge_fulfillment_ledger_missing");
  if (!closureOk) diagnostics.push("edge_closure_decision_missing");
  if (existsSync(productManifestPath) && (!ledgerOk || !closureOk)) {
    diagnostics.push("artifact_presence_without_edge_closure_carrier");
  }
  if (isObject(workerResult) && (!ledgerOk || !closureOk)) {
    diagnostics.push("worker_report_without_edge_closure_carrier");
  }
  if (hasWorkerPercentComplete(workerResult)) {
    diagnostics.push("worker_percent_complete_not_metric_authority");
  }
  if (postflightPresent && closureDisposition !== "close") {
    diagnostics.push("postflight_success_not_metric_authority");
  }
  if (ledgerOk || closureOk || nextActionOk || manifestOk) {
    if (!edgeAssuranceContractRef) diagnostics.push("edge_assurance_contract_ref_missing");
    if (!edgeAssuranceContractDigest) diagnostics.push("edge_assurance_contract_digest_missing");
    if (!edgeGainRef) diagnostics.push("edge_gain_ref_missing");
    if (closureOk && !edgeClosureFunctionRef) diagnostics.push("edge_closure_function_ref_missing");
  }
  if (
    closureOk &&
    closureDisposition !== "close" &&
    edgeResidualPressureRefs.length === 0 &&
    reasonRefs.length === 0 &&
    gapPressureRefs.length === 0
  ) {
    diagnostics.push("non_close_without_residual_pressure_refs");
  }

  const closeReady = Boolean(
    ledgerOk &&
    closureOk &&
    closureDisposition === "close" &&
    edgeConverged === true &&
    edgeAssuranceContractRef &&
    edgeGainRef &&
    edgeClosureFunctionRef
  );
  const carrierState =
    carrierAbsent
      ? "absent"
      : diagnostics.some((code) =>
          code.endsWith("_missing") ||
          code === "edge_fulfillment_ledger_missing" ||
          code === "edge_closure_decision_missing"
        )
      ? "incomplete"
      : "complete";

  return Object.freeze({
    kind: "sidecar_edge_assurance_overlay",
    carrierState,
    opRunRoot: opRunPath,
    edgeName: stringField(manifest, "edgeName") || leafName,
    edgeRef: stringOrNull(ledger, "edgeRef"),
    vectorIndex: numberOrNull(manifest, "vectorIndex"),
    targetAssetType: stringOrNull(manifest, "targetAssetType"),
    edgeAssuranceContractRef,
    edgeAssuranceContractDigest,
    edgeGainRef,
    edgeClosureFunctionRef,
    edgeResidualPressureRefs: Object.freeze(edgeResidualPressureRefs),
    ledgerRef: stringOrNull(ledger, "ledgerRef"),
    ledgerVersionRef: stringOrNull(ledger, "ledgerVersionRef"),
    closureDecisionRef: stringOrNull(closure, "decisionRef"),
    closureDisposition,
    closeReady,
    edgeConverged,
    carryConverged: booleanOrNull(ledger?.carryConverged),
    fulfillmentConverged: booleanOrNull(ledger?.fulfillmentConverged),
    admitted: booleanOrNull(ledger?.admitted),
    targetCertificationPassed: booleanOrNull(ledger?.targetCertificationPassed),
    fdRecheckPassed: booleanOrNull(ledger?.fdRecheckPassed),
    counts: edgeAssuranceCounts(ledger?.counts),
    materializationRefCount: stringArray(ledger?.materializationRefs).length,
    admissionRefCount: stringArray(ledger?.admissionRefs).length,
    evidenceBundleRefCount: stringArray(ledger?.evidenceBundleRefs).length,
    targetBindingRefCount: stringArray(ledger?.targetBindingRefs).length,
    nextActionBasisKind: stringOrNull(nextAction, "nextActionBasisKind"),
    nextGraphVectorRef: stringOrNull(nextAction, "nextGraphVectorRef"),
    selectedActionRef: stringOrNull(nextAction, "selectedActionRef"),
    reasonRefs: Object.freeze(reasonRefs),
    gapPressureRefs: Object.freeze(gapPressureRefs),
    diagnostics: Object.freeze(uniqueInOrder(diagnostics))
  });
}

function admitTracedEvidenceFromResult(resultPath, archiveRoot) {
  const json = readTracedResult(resultPath);
  if (!json || typeof json !== "object") return null;
  const outcomeKind = stringField(json?.outcome, "kind");
  const executorProfile = stringField(json, "executorProfile");
  const streamModel = stringField(json, "streamModel");
  const parser = stringField(json, "parser");
  if (
    !TRACED_OUTCOME_KINDS.has(outcomeKind) ||
    !TRACED_EXECUTOR_PROFILES.has(executorProfile) ||
    !TRACED_STREAM_MODELS.has(streamModel) ||
    !TRACED_PARSERS.has(parser)
  ) {
    return null;
  }
  // Substrate publishes apiRetryEvents / toolCallEvents as arrays; surface
  // their length as the count fields the contract expects.
  const apiRetryCount = Array.isArray(json?.apiRetryEvents)
    ? json.apiRetryEvents.length
    : typeof json?.apiRetryCount === "number"
    ? json.apiRetryCount
    : 0;
  const toolCallCount = Array.isArray(json?.toolCallEvents)
    ? json.toolCallEvents.length
    : typeof json?.toolCallCount === "number"
    ? json.toolCallCount
    : 0;
  const structuredEventCount =
    typeof json?.structuredEventCount === "number" ? json.structuredEventCount : 0;
  // The substrate's own paths block (when present) wins over derived defaults.
  const substratePaths = isObject(json?.paths) ? json.paths : null;
  const tracePath = (name, fallback) =>
    typeof substratePaths?.[name] === "string" && substratePaths[name].trim()
      ? substratePaths[name]
      : fallback;
  const traceArchivePaths = Object.freeze({
    meta: tracePath("meta", join(archiveRoot, "meta.json")),
    command: tracePath("command", join(archiveRoot, "command.json")),
    events: tracePath("events", join(archiveRoot, "events.ndjson")),
    stdout: tracePath("stdout", join(archiveRoot, "stdout.log")),
    stderr: tracePath("stderr", join(archiveRoot, "stderr.log")),
    finalOutput: tracePath("finalOutput", join(archiveRoot, "final_output.json")),
    result: tracePath("result", resultPath),
    terminalTranscript:
      executorProfile === "pty-terminal"
        ? tracePath("terminalTranscript", join(archiveRoot, "terminal.transcript"))
        : null
  });
  return Object.freeze({
    kind: "traced_callout_evidence",
    invocationId:
      stringField(json, "sessionId") ||
      stringField(json, "invocationId") ||
      stableRecordId("inv", resultPath),
    outcome: Object.freeze({
      kind: outcomeKind,
      detail: typeof json?.outcome?.detail === "string" ? json.outcome.detail : null
    }),
    executorProfile,
    streamModel,
    parser,
    status: typeof json?.status === "number" ? json.status : null,
    signal: typeof json?.signal === "string" ? json.signal : null,
    timedOut: Boolean(json?.timedOut),
    inactivityTimedOut: Boolean(json?.inactivityTimedOut),
    structuredEventCount,
    apiRetryCount,
    toolCallCount,
    terminalSessionId:
      typeof json?.terminalSessionId === "string" ? json.terminalSessionId : null,
    traceArchiveRoot: archiveRoot,
    traceArchivePaths
  });
}

function readTracedResult(resultPath) {
  const read = readBoundedJsonFile(resultPath, LIVE_ANALYSIS_MAX_TRACE_RESULT_PARSE_BYTES);
  if (isObject(read.payload)) return read.payload;
  if (!read.skipped) return null;
  return readTracedResultHeader(resultPath);
}

function readTracedResultHeader(resultPath) {
  let head = "";
  try {
    head = readFileHead(resultPath, LIVE_ANALYSIS_TRACE_RESULT_HEAD_BYTES);
  } catch {
    return null;
  }
  const outcomeKind = readNestedJsonHeaderString(head, "outcome", "kind");
  const executorProfile = readJsonHeaderString(head, "executorProfile");
  const streamModel = readJsonHeaderString(head, "streamModel");
  const parser = readJsonHeaderString(head, "parser");
  if (!outcomeKind || !executorProfile || !streamModel || !parser) return null;
  return Object.freeze({
    kind: readJsonHeaderString(head, "kind") || "traced_process_result",
    sessionId: readJsonHeaderString(head, "sessionId"),
    executorProfile,
    terminalSessionId: readJsonHeaderString(head, "terminalSessionId"),
    streamModel,
    outcome: Object.freeze({
      kind: outcomeKind,
      detail: readNestedJsonHeaderString(head, "outcome", "detail") || null
    }),
    parser,
    status: readJsonHeaderNumber(head, "status"),
    signal: readJsonHeaderString(head, "signal") || null,
    timedOut: readJsonHeaderBoolean(head, "timedOut") === true,
    inactivityTimedOut: readJsonHeaderBoolean(head, "inactivityTimedOut") === true,
    structuredEventCount: readJsonHeaderNumber(head, "structuredEventCount") ?? 0,
    apiRetryCount: readJsonHeaderNumber(head, "apiRetryCount") ?? 0,
    toolCallCount: readJsonHeaderNumber(head, "toolCallCount") ?? 0
  });
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deriveLeafStatus(leafPath, tracedEvidence) {
  // Status precedence: any failure outcome -> failed; postflight pass -> fd_postflight_passed;
  // FP success without postflight -> fp_succeeded; assurance fold present -> running;
  // nothing -> unattested.
  for (const evidence of tracedEvidence) {
    const kind = evidence?.outcome?.kind;
    if (
      kind === "signaled" ||
      kind === "hard_timeout" ||
      kind === "inactivity_timeout" ||
      kind === "executor_unavailable" ||
      kind === "launch_failed" ||
      kind === "process_error" ||
      kind === "lost_terminal"
    ) {
      return "failed";
    }
    if (kind === "exited" && evidence?.status !== 0) {
      return "failed";
    }
  }
  if (existsSync(join(leafPath, "postflight.json"))) return "fd_postflight_passed";
  if (existsSync(join(leafPath, "fp_evaluate_result.json"))) return "fp_succeeded";
  if (existsSync(join(leafPath, "worker_process_events.jsonl"))) return "running";
  return "unattested";
}

function edgeAssuranceCounts(value) {
  if (!isObject(value)) return null;
  const counts = {
    expected: numberField(value, "expected"),
    fulfilled: numberField(value, "fulfilled"),
    partial: numberField(value, "partial"),
    blocked: numberField(value, "blocked"),
    unfulfilled: numberField(value, "unfulfilled"),
    missing: numberField(value, "missing"),
    extra: numberField(value, "extra")
  };
  if (Object.values(counts).some((entry) => entry === null)) return null;
  return Object.freeze(counts);
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function hasWorkerPercentComplete(value, depth = 0) {
  if (!isObject(value) || depth > 3) return false;
  for (const [key, entry] of Object.entries(value)) {
    if (/percent.*complete/i.test(key) || /complete.*percent/i.test(key)) {
      return true;
    }
    if (Array.isArray(entry)) {
      if (entry.some((item) => hasWorkerPercentComplete(item, depth + 1))) return true;
      continue;
    }
    if (hasWorkerPercentComplete(entry, depth + 1)) return true;
  }
  return false;
}

function validateTypeScriptInstall(root) {
  const projectionPath = join(root, TS_INSTALL_PROJECTION_RELATIVE_PATH);
  const manifestPath = join(root, TS_INSTALL_MANIFEST_RELATIVE_PATH);
  if (!existsSync(projectionPath) || !existsSync(manifestPath)) {
    return { ok: false, reason: "odd_sdlc TypeScript installation projection is missing" };
  }
  const projection = readJsonFile(projectionPath);
  const manifest = readJsonFile(manifestPath);
  if (projection?.kind !== "odd_sdlc_typescript_installation_projection") {
    return { ok: false, reason: "odd_sdlc TypeScript installation projection has unsupported kind" };
  }
  if (manifest?.kind !== "odd_sdlc_typescript_install_manifest") {
    return { ok: false, reason: "odd_sdlc TypeScript install manifest has unsupported kind" };
  }
  if (manifest?.packageName !== "@odd-sdlc/typescript-tenant") {
    return { ok: false, reason: "workspace is not installed from @odd-sdlc/typescript-tenant" };
  }
  return { ok: true, projection, manifest };
}

function loadInstalledQueryDomain(root, manifest) {
  const commandPath = queryDomainCommandPath(root, manifest);
  if (!commandPath || !existsSync(commandPath)) return null;
  const result = spawnSync(process.execPath, [commandPath, "query-domain", "--workspace", root], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
    timeout: 10_000
  });
  if (result.error || result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    const payload = parsed?.payload;
    if (
      payload?.kind === "sdlc_query_domain_projection" &&
      payload?.contractName === SIDECAR_PROCESS_CONTRACT_NAME &&
      payload?.contractVersion === SIDECAR_PROCESS_CONTRACT_VERSION
    ) {
      return payload;
    }
  } catch {
    return null;
  }
  return null;
}

function queryDomainCommandPath(root, manifest) {
  const bindings = Array.isArray(manifest?.commandBindings) ? manifest.commandBindings : [];
  const binding = bindings.find((entry) => entry?.commandName === "odd-sdlc-ts") ?? bindings[0] ?? null;
  const packageCommandPath = typeof binding?.packageCommandPath === "string" ? binding.packageCommandPath : "";
  if (packageCommandPath) return packageCommandPath;
  const commandPath = typeof binding?.commandPath === "string" ? binding.commandPath : "";
  if (commandPath) return commandPath;
  return join(root, "node_modules/@odd-sdlc/typescript-tenant/build/semantic/code/src/cli/main.js");
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readBoundedJsonFile(path, maxBytes) {
  if (!existsSync(path)) {
    return { payload: null, skipped: false, byteSize: 0, reason: "missing" };
  }
  const byteSize = fileSizeBytes(path);
  if (byteSize > maxBytes) {
    return { payload: null, skipped: true, byteSize, reason: "oversized_json" };
  }
  return { payload: readJsonFile(path), skipped: false, byteSize, reason: null };
}

function readRuntimeEvents(path, options = {}) {
  const events = [];
  const malformed = [];
  const maxBytes = Number.isFinite(options.maxBytes) ? Math.max(0, Math.floor(options.maxBytes)) : null;
  const maxEvents = Number.isFinite(options.maxEvents) ? Math.max(0, Math.floor(options.maxEvents)) : null;
  const byteSize = fileSizeBytes(path);
  const byteLimited = maxBytes !== null && byteSize > maxBytes;
  let text = byteLimited ? readFileHead(path, maxBytes) : readFileSync(path, "utf8");
  if (byteLimited && !/\r?\n$/.test(text)) {
    text = dropPartialTrailingLine(text);
  }
  let truncated = byteLimited;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (maxEvents !== null && events.length >= maxEvents) {
      truncated = true;
      return;
    }
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        events.push(Object.freeze({ ...parsed, __eventIndex: index }));
      }
    } catch {
      malformed.push(index);
    }
  });
  return { events, malformed, truncated, byteSize };
}

function readFileHead(path, maxBytes) {
  if (maxBytes <= 0) return "";
  const fd = openSync(path, "r");
  try {
    const buffer = Buffer.allocUnsafe(maxBytes);
    const bytesRead = readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    closeSync(fd);
  }
}

function dropPartialTrailingLine(value) {
  const lastLf = value.lastIndexOf("\n");
  const lastCr = value.lastIndexOf("\r");
  const lastBreak = Math.max(lastLf, lastCr);
  return lastBreak >= 0 ? value.slice(0, lastBreak + 1) : "";
}

function fileSizeBytes(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function formatLiveBytes(value) {
  const bytes = Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GiB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KiB`;
  return `${bytes}B`;
}

function isTypeScriptRuntimeEvent(event) {
  const basisId = stringField(event, "basisId");
  const resolvedRuntimeRef = stringField(event, "resolvedRuntimeRef");
  return basisId.includes('"moduleName":"odd_sdlc_typescript"') ||
    resolvedRuntimeRef.includes("typescript");
}

function projectProcessRecords(events) {
  const records = new Map();
  const latestVectorByEdge = new Map();

  events.forEach((event, index) => {
    const kind = stringField(event, "kind");
    if (!SUPPORTED_TS_EVENT_KINDS.has(kind)) return;

    if (kind === "graph_call_opened") {
      const id = stableRecordId("call", stringField(event, "graphCallId") || `${index}`);
      upsertRecord(records, id, {
        kind: "graph_call",
        title: graphFunctionTitle(event),
        summary: `Graph call opened for ${graphFunctionTitle(event)}.`,
        viewIds: ["active_work"],
        tone: "active",
        status: "opened",
        graphFunctionId: stringOrNull(event, "graphFunctionId"),
        graphCallId: stringOrNull(event, "graphCallId"),
        frameId: null,
        vectorIndex: null,
        edge: edgeFromEvent(event),
        runId: stringOrNull(event, "runId"),
        workKey: stringOrNull(event, "workKey"),
        eventKinds: [kind],
        evidenceRefs: refsFromEvent(event),
        lastEventIndex: event.__eventIndex ?? index
      });
      return;
    }

    if (kind === "frame_opened") {
      const id = stableRecordId("frame", stringField(event, "frameId") || `${index}`);
      upsertRecord(records, id, {
        kind: "frame",
        title: "Frame opened",
        summary: `Frame opened with ${numberField(event, "vectorCount") ?? 0} vector(s).`,
        viewIds: ["active_work"],
        tone: "active",
        status: "opened",
        graphFunctionId: null,
        graphCallId: stringOrNull(event, "graphCallId"),
        frameId: stringOrNull(event, "frameId"),
        vectorIndex: null,
        edge: null,
        runId: stringOrNull(event, "runId"),
        workKey: stringOrNull(event, "workKey"),
        eventKinds: [kind],
        evidenceRefs: refsFromEvent(event),
        lastEventIndex: event.__eventIndex ?? index
      });
      return;
    }

    if (kind === "vector_traversal_planned" || kind === "vector_evaluated" || kind === "vector_closed") {
      const id = vectorRecordId(event, index);
      latestVectorByEdge.set(edgeFromEvent(event) ?? id, id);
      const status = vectorStatus(event, kind);
      const viewIds = viewIdsForEvent(kind, status);
      upsertRecord(records, id, {
        kind: "vector",
        title: edgeFromEvent(event) ?? "unnamed vector",
        summary: vectorSummary(event, kind, status),
        viewIds,
        tone: toneForViews(viewIds),
        status,
        graphFunctionId: null,
        graphCallId: stringOrNull(event, "graphCallId"),
        frameId: stringOrNull(event, "frameId"),
        vectorIndex: numberOrNull(event, "vectorIndex"),
        edge: edgeFromEvent(event),
        runId: stringOrNull(event, "runId"),
        workKey: stringOrNull(event, "workKey"),
        eventKinds: [kind],
        evidenceRefs: refsFromEvent(event),
        lastEventIndex: event.__eventIndex ?? index
      });
      return;
    }

    const edge = edgeFromEvent(event);
    const vectorId = edge ? latestVectorByEdge.get(edge) : null;
    const id = vectorId ?? stableRecordId(kind, edge || stringField(event, "graphCallId") || `${index}`);
    const status = statusForNonVectorEvent(event, kind);
    const viewIds = viewIdsForEvent(kind, status);
    upsertRecord(records, id, {
      kind: kind === "assessed" ? "assessment" : "continuation",
      title: edge || kind,
      summary: nonVectorSummary(event, kind, status),
      viewIds,
      tone: toneForViews(viewIds),
      status,
      graphFunctionId: null,
      graphCallId: stringOrNull(event, "graphCallId") || stringOrNull(event, "retryCallId"),
      frameId: stringOrNull(event, "frameId"),
      vectorIndex: numberOrNull(event, "vectorIndex"),
      edge,
      runId: stringOrNull(event, "runId") || stringOrNull(event, "retryRunId"),
      workKey: stringOrNull(event, "workKey"),
      eventKinds: [kind],
      evidenceRefs: refsFromEvent(event),
      lastEventIndex: event.__eventIndex ?? index
    });
  });

  return Object.freeze([...records.values()].sort((left, right) => right.lastEventIndex - left.lastEventIndex));
}

function upsertRecord(records, id, next) {
  const existing = records.get(id);
  if (!existing) {
    records.set(id, freezeRecord({ id, ...next }));
    return;
  }
  records.set(id, freezeRecord({
    ...existing,
    ...next,
    viewIds: uniqueInOrder([...existing.viewIds, ...next.viewIds]),
    eventKinds: uniqueInOrder([...existing.eventKinds, ...next.eventKinds]),
    evidenceRefs: uniqueInOrder([...existing.evidenceRefs, ...next.evidenceRefs]),
    graphFunctionId: next.graphFunctionId ?? existing.graphFunctionId,
    graphCallId: next.graphCallId ?? existing.graphCallId,
    frameId: next.frameId ?? existing.frameId,
    vectorIndex: next.vectorIndex ?? existing.vectorIndex,
    edge: next.edge ?? existing.edge,
    runId: next.runId ?? existing.runId,
    workKey: next.workKey ?? existing.workKey,
    lastEventIndex: Math.max(existing.lastEventIndex, next.lastEventIndex)
  }));
}

function freezeRecord(record) {
  return Object.freeze({
    ...record,
    viewIds: Object.freeze(record.viewIds),
    eventKinds: Object.freeze(record.eventKinds),
    evidenceRefs: Object.freeze(record.evidenceRefs)
  });
}

function materializeViews(records) {
  return Object.freeze(SIDECAR_PROCESS_VIEWS.map((view) => Object.freeze({
    ...view,
    recordIds: Object.freeze(records.filter((record) => record.viewIds.includes(view.id)).map((record) => record.id))
  })));
}

function materializeProcessMaps(records, queryDomain) {
  return Object.freeze([
    buildProcessFlowMap(records, queryDomain),
    buildBuilderGovernanceMap(records, queryDomain),
    buildRuntimeEvidenceMap(records)
  ]);
}

function buildProcessFlowMap(records, queryDomain) {
  const graphFunctions = graphFunctionSurfaces(queryDomain, records);
  const recordsByName = recordsByGraphFunctionName(records);
  const nodes = new Map();
  const edges = [];
  const rowsByColumn = new Map();
  const nodeIdByFunction = new Map();
  const producerNamesByAsset = new Map();

  for (const graphFunction of graphFunctions) {
    for (const outputName of stringArray(graphFunction.outputNames)) {
      const producers = producerNamesByAsset.get(outputName) ?? [];
      producers.push(graphFunction.name);
      producerNamesByAsset.set(outputName, producers);
    }
  }

  for (const graphFunction of graphFunctions) {
    const lane = processLaneForGraphFunction(graphFunction);
    const row = nextMapRow(rowsByColumn, lane.column);
    const recordIds = recordIdsForGraphFunction(graphFunction.name, recordsByName);
    const id = stableRecordId("flow-function", graphFunction.name);
    nodeIdByFunction.set(graphFunction.name, id);
    addMapNode(nodes, {
      id,
      label: graphFunction.name,
      summary: graphFunctionSummary(graphFunction),
      kind: "graph_function",
      tone: toneForRecordIds(recordIds, records),
      lane: lane.label,
      column: lane.column,
      row,
      recordIds
    });
  }

  for (const graphFunction of graphFunctions) {
    const to = nodeIdByFunction.get(graphFunction.name);
    if (!to) continue;
    for (const inputName of stringArray(graphFunction.inputNames)) {
      for (const producerName of producerNamesByAsset.get(inputName) ?? []) {
        if (producerName === graphFunction.name) continue;
        const from = nodeIdByFunction.get(producerName);
        if (!from) continue;
        const fromNode = nodes.get(from);
        const toNode = nodes.get(to);
        edges.push(mapEdge({
          from,
          to,
          label: inputName,
          tone: strongestTone([fromNode?.tone, toNode?.tone]),
          recordIds: uniqueInOrder([...(fromNode?.recordIds ?? []), ...(toNode?.recordIds ?? [])])
        }));
      }
    }
  }

  if (edges.length === 0) {
    const ordered = [...nodes.values()].sort(compareMapNodes);
    for (let index = 1; index < ordered.length; index += 1) {
      edges.push(mapEdge({
        from: ordered[index - 1].id,
        to: ordered[index].id,
        label: "observed flow",
        tone: strongestTone([ordered[index - 1].tone, ordered[index].tone]),
        recordIds: uniqueInOrder([...ordered[index - 1].recordIds, ...ordered[index].recordIds])
      }));
    }
  }

  return freezeMap({
    id: "process_flow",
    label: "Process Flow Map",
    summary: queryDomain
      ? "Graph-function handoffs derived from the TypeScript query-domain function catalog."
      : "Runtime graph-function flow derived from observed TypeScript events.",
    nodes,
    edges,
    stats: [
      mapStat("Graph functions", graphFunctions.length, graphFunctions.length ? "active" : "pending"),
      mapStat("Handoffs", uniqueMapEdges(edges).length, edges.length ? "active" : "pending"),
      mapStat("Runtime anchors", records.filter((record) => record.edge || record.graphFunctionId).length, records.length ? "active" : "pending")
    ]
  });
}

function buildBuilderGovernanceMap(records, queryDomain) {
  const recordsByName = recordsByGraphFunctionName(records);
  const nodes = new Map();
  const edges = [];
  const rowsByColumn = new Map();
  const claimedRowsByColumn = new Map();
  const functionNodeIds = new Map();

  // Coordinated row allocator. Each column owns a Set of claimed rows and a
  // monotonic counter (the next row to consider). claimRow lets a single
  // column reserve a row; claimCoordRow reserves the *same* row in two
  // columns at once, which is the algorithmic key to making BOTH `starts`
  // (col 1 ↔ col 2) AND `produces` (col 2 ↔ col 3) horizontal at the
  // same time. Using independent per-column counters cannot satisfy both
  // alignment obligations on col 2 simultaneously; cooperative allocation
  // does, by ensuring the two paired endpoints share a row by construction.
  function ensureColumnState(column) {
    let claimed = claimedRowsByColumn.get(column);
    if (!claimed) { claimed = new Set(); claimedRowsByColumn.set(column, claimed); }
    return claimed;
  }
  function claimRow(column, preferredRow) {
    const claimed = ensureColumnState(column);
    let row;
    if (typeof preferredRow === "number" && preferredRow >= 0 && !claimed.has(preferredRow)) {
      row = preferredRow;
    } else {
      let candidate = rowsByColumn.get(column) ?? 0;
      while (claimed.has(candidate)) candidate += 1;
      row = candidate;
    }
    claimed.add(row);
    rowsByColumn.set(column, Math.max(rowsByColumn.get(column) ?? 0, row + 1));
    return row;
  }
  function claimCoordRow(colA, colB, preferredRow) {
    const claimedA = ensureColumnState(colA);
    const claimedB = ensureColumnState(colB);
    if (
      typeof preferredRow === "number"
      && preferredRow >= 0
      && !claimedA.has(preferredRow)
      && !claimedB.has(preferredRow)
    ) {
      claimedA.add(preferredRow);
      claimedB.add(preferredRow);
      rowsByColumn.set(colA, Math.max(rowsByColumn.get(colA) ?? 0, preferredRow + 1));
      rowsByColumn.set(colB, Math.max(rowsByColumn.get(colB) ?? 0, preferredRow + 1));
      return preferredRow;
    }
    let candidate = Math.max(rowsByColumn.get(colA) ?? 0, rowsByColumn.get(colB) ?? 0);
    while (claimedA.has(candidate) || claimedB.has(candidate)) candidate += 1;
    claimedA.add(candidate);
    claimedB.add(candidate);
    rowsByColumn.set(colA, Math.max(rowsByColumn.get(colA) ?? 0, candidate + 1));
    rowsByColumn.set(colB, Math.max(rowsByColumn.get(colB) ?? 0, candidate + 1));
    return candidate;
  }

  const rootId = "governance:odd-sdlc-typescript";
  addMapNode(nodes, {
    id: rootId,
    label: "odd_sdlc TypeScript Builder",
    summary: "Installed governance package over the selected Project.",
    kind: "governance",
    tone: "active",
    lane: "Governance",
    column: 0,
    row: claimRow(0),
    recordIds: []
  });

  const conformanceStatus = stringField(queryDomain?.projectConformance ?? {}, "status") || "unknown";
  const conformanceId = "governance:project-conformance";
  addMapNode(nodes, {
    id: conformanceId,
    label: "Project Conformance",
    summary: queryDomain?.projectConformance
      ? `${conformanceStatus} under ${queryDomain.projectConformance.governingGraphFunction ?? "governing graph function"}.`
      : "The TypeScript query-domain conformance report is not available.",
    kind: "governance",
    tone: toneForGovernanceStatus(conformanceStatus),
    lane: "Governance",
    column: 1,
    row: claimRow(1),
    recordIds: recordIdsForGraphFunction("Fg_conform_project", recordsByName)
  });
  edges.push(mapEdge({ from: rootId, to: conformanceId, label: "governs", tone: toneForGovernanceStatus(conformanceStatus) }));

  const startTargets = queryArray(queryDomain, "startTargets");
  const assetOwnership = queryArray(queryDomain, "assetOwnership");
  const graphFunctions = graphFunctionSurfaces(queryDomain, records);

  // Place a function node at col 2. The caller may pass a row that has
  // already been reserved (via claimCoordRow or a prior claimRow), in which
  // case it is used directly. Otherwise the row is freshly claimed in col 2.
  function ensureGovernedFunction(name, opts = {}) {
    const existing = functionNodeIds.get(name);
    if (existing) return existing;
    const graphFunction = graphFunctions.find((entry) => entry.name === name) ?? {
      name,
      inputNames: [],
      outputNames: [],
      vectorNames: []
    };
    const lane = processLaneForGraphFunction(graphFunction);
    const id = stableRecordId("governed-function", name);
    functionNodeIds.set(name, id);
    const recordIds = recordIdsForGraphFunction(name, recordsByName);
    const row = typeof opts.row === "number"
      ? opts.row
      : claimRow(2, opts.preferredRow);
    addMapNode(nodes, {
      id,
      label: name,
      summary: graphFunctionSummary(graphFunction),
      kind: "graph_function",
      tone: toneForRecordIds(recordIds, records),
      lane: lane.label,
      column: 2,
      row,
      recordIds
    });
    return id;
  }

  // Lay out start-targets first. Each start-target and its function are
  // allocated a row that is fresh in BOTH col 1 and col 2 simultaneously
  // via claimCoordRow, so the `starts` edge is horizontal by construction.
  // If a start-target's function is also produced by an asset (rare), the
  // asset will later try to align to this same row in col 3.
  for (const target of startTargets) {
    const name = stringField(target, "name");
    if (!name) continue;
    const id = stableRecordId("start-target", name);
    const recordIds = recordIdsForGraphFunction(name, recordsByName);
    const row = claimCoordRow(1, 2);
    addMapNode(nodes, {
      id,
      label: name,
      summary: `${stringField(target, "jobName") || "published job"} start target.`,
      kind: "start_target",
      tone: toneForRecordIds(recordIds, records),
      lane: "Start Targets",
      column: 1,
      row,
      recordIds
    });
    edges.push(mapEdge({ from: conformanceId, to: id, label: "admits", tone: toneForRecordIds(recordIds, records), recordIds }));
    const functionId = ensureGovernedFunction(name, { row });
    edges.push(mapEdge({ from: id, to: functionId, label: "starts", tone: toneForRecordIds(recordIds, records), recordIds }));
  }

  // Lay out assets next. Each asset and its primary producer are allocated
  // a row that is fresh in BOTH col 2 and col 3 simultaneously via
  // claimCoordRow, so the `produces` edge for the primary producer is
  // horizontal by construction. If the primary producer was already placed
  // earlier (because it is also a start-target's function), reuse that row
  // for the asset when col 3 has it free; this keeps the edge horizontal
  // for the dual-role function. Subsequent producers of a 1:N asset land
  // at the next free col-2 row (acceptable diagonal — explicit 1:N case).
  for (const ownership of assetOwnership) {
    const assetType = stringField(ownership, "assetType");
    if (!assetType) continue;
    const assetId = stableRecordId("owned-asset", assetType);
    const producers = stringArray(ownership.producerGraphFunctions);
    const primaryName = producers[0];
    const primaryExisting = primaryName ? functionNodeIds.get(primaryName) : null;
    const primaryRow = primaryExisting ? nodes.get(primaryExisting)?.row : undefined;

    let assetRow;
    if (typeof primaryRow === "number") {
      // Primary producer already placed (start-target overlap): try to align
      // the asset to the same row in col 3.
      assetRow = claimRow(3, primaryRow);
    } else if (primaryName) {
      // Primary producer not yet placed: cooperatively allocate a row that
      // is fresh in both col 2 (for the producer) and col 3 (for the asset).
      assetRow = claimCoordRow(2, 3);
    } else {
      // No producer (degenerate input): just place the asset.
      assetRow = claimRow(3);
    }

    addMapNode(nodes, {
      id: assetId,
      label: assetType,
      summary: `Owned asset type produced by ${producers.join(", ") || "unpublished graph functions"}.`,
      kind: "asset",
      tone: "pending",
      lane: "Owned Assets",
      column: 3,
      row: assetRow,
      recordIds: []
    });

    for (const producerName of producers) {
      // Primary producer reuses the asset's row directly (already reserved
      // in col 2 by claimCoordRow above when the function is fresh, or
      // already placed at primaryRow when the function pre-existed).
      // Subsequent producers fall back to the next free col-2 row.
      const isPrimary = producerName === primaryName;
      const opts = isPrimary ? { row: assetRow } : {};
      const functionId = ensureGovernedFunction(producerName, opts);
      const functionNode = nodes.get(functionId);
      edges.push(mapEdge({
        from: functionId,
        to: assetId,
        label: "produces",
        tone: functionNode?.tone ?? "pending",
        recordIds: functionNode?.recordIds ?? []
      }));
    }
  }

  const pressureRecords = records.filter((record) => record.tone === "blocked" || record.eventKinds.some((kind) => kind.includes("continuation")));
  for (const record of pressureRecords) {
    const id = stableRecordId("runtime-pressure", record.id);
    addMapNode(nodes, {
      id,
      label: record.title,
      summary: record.summary,
      kind: "runtime",
      tone: record.tone,
      lane: "Runtime Pressure",
      column: 4,
      row: claimRow(4),
      recordIds: [record.id]
    });
    const graphName = graphNamesForRecord(record)[0];
    const functionId = graphName ? ensureGovernedFunction(graphName) : conformanceId;
    edges.push(mapEdge({ from: functionId, to: id, label: record.status, tone: record.tone, recordIds: [record.id] }));
  }

  return freezeMap({
    id: "builder_governance",
    label: "Builder Governance Graph",
    summary: "Start targets, conformance, owned assets, and runtime pressure projected from the TypeScript builder contract.",
    nodes,
    edges,
    stats: [
      mapStat("Conformance", conformanceStatus, toneForGovernanceStatus(conformanceStatus)),
      mapStat("Start targets", startTargets.length, startTargets.length ? "active" : "pending"),
      mapStat("Owned assets", assetOwnership.length, assetOwnership.length ? "active" : "pending"),
      mapStat("Runtime pressure", pressureRecords.length, pressureRecords.length ? "blocked" : "converged")
    ]
  });
}

function buildRuntimeEvidenceMap(records) {
  const ordered = [...records].sort((left, right) => left.lastEventIndex - right.lastEventIndex);
  const layout = layoutRuntimeEvidenceRows(ordered);
  const nodes = new Map();
  const edges = [];
  const rowsByColumn = new Map();

  for (const record of ordered) {
    const lane = runtimeLaneForRecord(record);
    addMapNode(nodes, {
      id: record.id,
      label: record.title,
      summary: `${record.status}; ${record.eventKinds.join(", ")}`,
      kind: runtimeNodeKind(record),
      tone: record.tone,
      lane: lane.label,
      column: lane.column,
      row: layout.rowByRecordId.get(record.id) ?? nextMapRow(rowsByColumn, lane.column),
      recordIds: [record.id]
    });
  }

  for (const group of layout.groups) {
    const graphCalls = group.records.filter((record) => record.kind === "graph_call").sort(compareRuntimeRecords);
    const frames = group.records.filter((record) => record.kind === "frame").sort(compareRuntimeRecords);
    const vectors = group.records.filter((record) => record.vectorIndex !== null).sort(compareRuntimeVectors);
    const runtimePressure = group.records
      .filter((record) => record.kind !== "graph_call" && record.kind !== "frame" && record.vectorIndex === null)
      .sort(compareRuntimeRecords);
    const linkedVectorIds = new Set();

    for (const graphCall of graphCalls.filter((record) => record.graphCallId)) {
      for (const frame of frames.filter((record) => record.graphCallId === graphCall.graphCallId)) {
        edges.push(mapEdge({
          from: graphCall.id,
          to: frame.id,
          label: "opens frame",
          tone: strongestTone([graphCall.tone, frame.tone]),
          recordIds: [graphCall.id, frame.id]
        }));
      }
    }

    for (const frame of frames.filter((record) => record.frameId)) {
      const frameVectors = vectors.filter((record) => record.frameId === frame.frameId);
      const firstVector = frameVectors[0];
      if (!firstVector) continue;
      linkedVectorIds.add(firstVector.id);
      edges.push(mapEdge({
        from: frame.id,
        to: firstVector.id,
        label: "starts vector",
        tone: strongestTone([frame.tone, firstVector.tone]),
        recordIds: [frame.id, firstVector.id]
      }));
      pushRuntimeVectorChain(edges, frameVectors, linkedVectorIds);
    }

    const unlinkedVectors = vectors.filter((record) => !linkedVectorIds.has(record.id));
    const graphAnchors = graphCalls.length ? graphCalls : frames;
    for (const anchor of graphAnchors.filter((record) => record.graphCallId || record.frameId)) {
      const anchorVectors = unlinkedVectors.filter((record) => (
        (anchor.graphCallId && record.graphCallId === anchor.graphCallId) ||
        (anchor.frameId && record.frameId === anchor.frameId)
      ));
      const firstVector = anchorVectors[0];
      if (!firstVector) continue;
      linkedVectorIds.add(firstVector.id);
      edges.push(mapEdge({
        from: anchor.id,
        to: firstVector.id,
        label: "starts vector",
        tone: strongestTone([anchor.tone, firstVector.tone]),
        recordIds: [anchor.id, firstVector.id]
      }));
      pushRuntimeVectorChain(edges, anchorVectors, linkedVectorIds);
    }

    for (const pressure of runtimePressure) {
      const source = runtimePressureSource(pressure, vectors, frames, graphCalls);
      if (!source) continue;
      edges.push(mapEdge({
        from: source.id,
        to: pressure.id,
        label: pressure.status,
        tone: strongestTone([source.tone, pressure.tone]),
        recordIds: [source.id, pressure.id]
      }));
    }
  }

  return freezeMap({
    id: "runtime_evidence",
    label: "Runtime Evidence Flow",
    summary: "Graph calls, frames, vectors, assessments, and continuations projected as TypeScript runtime carrier lineage.",
    nodes,
    edges,
    stats: [
      mapStat("Graph calls", records.filter((record) => record.kind === "graph_call").length, "active"),
      mapStat("Frames", records.filter((record) => record.kind === "frame").length, "active"),
      mapStat("Vectors", records.filter((record) => record.vectorIndex !== null).length, "active"),
      mapStat("Event families", uniqueSorted(records.flatMap((record) => record.eventKinds)).length, "active")
    ]
  });
}

function layoutRuntimeEvidenceRows(records) {
  const groups = runtimeEvidenceGroups(records);
  const rowByRecordId = new Map();
  let nextRow = 0;

  for (const group of groups) {
    const graphCalls = group.records.filter((record) => record.kind === "graph_call").sort(compareRuntimeRecords);
    const frames = group.records.filter((record) => record.kind === "frame").sort(compareRuntimeRecords);
    const vectors = group.records.filter((record) => record.vectorIndex !== null).sort(compareRuntimeVectors);
    const runtimePressure = group.records
      .filter((record) => record.kind !== "graph_call" && record.kind !== "frame" && record.vectorIndex === null)
      .sort(compareRuntimeRecords);
    const groupHeight = Math.max(1, graphCalls.length, frames.length, vectors.length, runtimePressure.length);

    graphCalls.forEach((record, index) => {
      rowByRecordId.set(record.id, nextRow + Math.min(index, groupHeight - 1));
    });
    frames.forEach((record, index) => {
      rowByRecordId.set(record.id, nextRow + Math.min(index, groupHeight - 1));
    });
    vectors.forEach((record, index) => {
      rowByRecordId.set(record.id, nextRow + index);
    });
    runtimePressure.forEach((record, index) => {
      rowByRecordId.set(record.id, nextRow + index);
    });

    nextRow += groupHeight + 1;
  }

  return { groups, rowByRecordId };
}

function runtimeEvidenceGroups(records) {
  const frameIdByGraphCallId = new Map();
  for (const record of records) {
    if (record.kind === "frame" && record.graphCallId && record.frameId) {
      frameIdByGraphCallId.set(record.graphCallId, record.frameId);
    }
  }
  const groupsByKey = new Map();
  for (const record of records) {
    const key = runtimeEvidenceScopeKey(record, frameIdByGraphCallId);
    const existing = groupsByKey.get(key);
    if (existing) {
      existing.records.push(record);
      existing.firstEventIndex = Math.min(existing.firstEventIndex, record.lastEventIndex);
      continue;
    }
    groupsByKey.set(key, {
      key,
      firstEventIndex: record.lastEventIndex,
      records: [record]
    });
  }
  return [...groupsByKey.values()].sort((left, right) => left.firstEventIndex - right.firstEventIndex);
}

function runtimeEvidenceScopeKey(record, frameIdByGraphCallId) {
  if (record.frameId) return record.frameId;
  if (record.graphCallId && frameIdByGraphCallId.has(record.graphCallId)) {
    return frameIdByGraphCallId.get(record.graphCallId);
  }
  return record.graphCallId ?? record.runId ?? record.workKey ?? record.id;
}

function pushRuntimeVectorChain(edges, vectors, linkedVectorIds) {
  for (let index = 1; index < vectors.length; index += 1) {
    const previous = vectors[index - 1];
    const current = vectors[index];
    linkedVectorIds.add(current.id);
    edges.push(mapEdge({
      from: previous.id,
      to: current.id,
      label: "next vector",
      tone: strongestTone([previous.tone, current.tone]),
      recordIds: [previous.id, current.id]
    }));
  }
}

function runtimePressureSource(record, vectors, frames, graphCalls) {
  const vector = vectors.find((candidate) => (
    (record.vectorIndex !== null && candidate.vectorIndex === record.vectorIndex) ||
    (record.edge && candidate.edge === record.edge)
  ));
  if (vector) return vector;
  const frame = frames.find((candidate) => record.frameId && candidate.frameId === record.frameId);
  if (frame) return frame;
  return graphCalls.find((candidate) => record.graphCallId && candidate.graphCallId === record.graphCallId) ?? null;
}

function compareRuntimeVectors(left, right) {
  const leftIndex = left.vectorIndex ?? Number.MAX_SAFE_INTEGER;
  const rightIndex = right.vectorIndex ?? Number.MAX_SAFE_INTEGER;
  return leftIndex - rightIndex || compareRuntimeRecords(left, right);
}

function compareRuntimeRecords(left, right) {
  return left.lastEventIndex - right.lastEventIndex || left.title.localeCompare(right.title);
}

function graphFunctionSurfaces(queryDomain, records) {
  const graphFunctions = queryArray(queryDomain, "graphFunctions")
    .map((entry) => ({
      name: stringField(entry, "name"),
      inputNames: stringArray(entry.inputNames),
      outputNames: stringArray(entry.outputNames),
      vectorNames: stringArray(entry.vectorNames)
    }))
    .filter((entry) => entry.name);
  if (graphFunctions.length > 0) return graphFunctions;
  return uniqueInOrder(records.flatMap(graphNamesForRecord))
    .map((name) => ({
      name,
      inputNames: [],
      outputNames: [],
      vectorNames: [name]
    }));
}

function recordsByGraphFunctionName(records) {
  const byName = new Map();
  for (const record of records) {
    for (const name of graphNamesForRecord(record)) {
      const existing = byName.get(name) ?? [];
      existing.push(record);
      byName.set(name, existing);
    }
  }
  return byName;
}

function graphNamesForRecord(record) {
  return uniqueInOrder([
    record.edge,
    graphFunctionNameFromId(record.graphFunctionId),
    record.kind === "graph_call" ? record.title : null
  ].filter(Boolean));
}

function graphFunctionNameFromId(value) {
  if (!value) return null;
  return String(value).split(":").filter(Boolean).at(-1) ?? null;
}

function recordIdsForGraphFunction(name, recordsByName) {
  return Object.freeze((recordsByName.get(name) ?? []).map((record) => record.id));
}

function graphFunctionSummary(graphFunction) {
  const inputs = stringArray(graphFunction.inputNames);
  const outputs = stringArray(graphFunction.outputNames);
  if (inputs.length || outputs.length) {
    return `${inputs.length || 0} input(s) to ${outputs.length || 0} output(s): ${outputs.slice(0, 3).join(", ") || "no output surface"}.`;
  }
  const vectors = stringArray(graphFunction.vectorNames);
  return vectors.length ? `${vectors.length} vector(s): ${vectors.slice(0, 3).join(", ")}.` : "Observed runtime graph function.";
}

function processLaneForGraphFunction(graphFunction) {
  const text = [graphFunction.name, ...stringArray(graphFunction.inputNames), ...stringArray(graphFunction.outputNames)]
    .join(" ")
    .toLowerCase();
  if (/(gap_|repricing|ticket_work|retire_gap|triage|route)/.test(text)) return { label: "Governance Loop", column: 6 };
  if (/(runtime|retrofit|maintenance|operational)/.test(text)) return { label: "Runtime", column: 5 };
  if (/(release|deployment|build_execution|test_execution|deployed)/.test(text)) return { label: "Release / Ops", column: 4 };
  if (/(test|testcase|qualification|uat)/.test(text)) return { label: "Test", column: 3 };
  if (/(implementation|realization|code|stack|module)/.test(text)) return { label: "Build", column: 2 };
  if (/(design|scenario|feature)/.test(text)) return { label: "Design", column: 1 };
  return { label: "Bootstrap", column: 0 };
}

function runtimeLaneForRecord(record) {
  if (record.kind === "graph_call") return { label: "Graph Calls", column: 0 };
  if (record.kind === "frame") return { label: "Frames", column: 1 };
  if (record.vectorIndex !== null) return { label: "Vectors", column: 2 };
  return { label: "Assessments / Continuations", column: 3 };
}

function runtimeNodeKind(record) {
  if (record.kind === "frame") return "frame";
  if (record.vectorIndex !== null) return "vector";
  if (record.kind === "graph_call") return "graph_function";
  return "runtime";
}

function toneForRecordIds(recordIds, records) {
  const recordSet = new Set(recordIds);
  return strongestTone(records.filter((record) => recordSet.has(record.id)).map((record) => record.tone));
}

function strongestTone(tones) {
  if (tones.includes("blocked")) return "blocked";
  if (tones.includes("active")) return "active";
  if (tones.includes("pending")) return "pending";
  if (tones.includes("converged")) return "converged";
  return "pending";
}

function toneForGovernanceStatus(status) {
  if (status === "passed" || status === "converged") return "converged";
  if (status === "blocked" || status === "failed") return "blocked";
  if (status === "active") return "active";
  return "pending";
}

function mapStat(label, value, tone) {
  return Object.freeze({ label, value: String(value), tone });
}

function addMapNode(nodes, node) {
  const existing = nodes.get(node.id);
  if (!existing) {
    nodes.set(node.id, {
      ...node,
      recordIds: uniqueInOrder(node.recordIds ?? [])
    });
    return;
  }
  nodes.set(node.id, {
    ...existing,
    ...node,
    tone: strongestTone([existing.tone, node.tone]),
    recordIds: uniqueInOrder([...(existing.recordIds ?? []), ...(node.recordIds ?? [])])
  });
}

function mapEdge(input) {
  return {
    id: stableRecordId("map-edge", `${input.from}->${input.to}:${input.label}`),
    from: input.from,
    to: input.to,
    label: input.label,
    tone: input.tone ?? "pending",
    recordIds: uniqueInOrder(input.recordIds ?? [])
  };
}

function freezeMap(input) {
  const nodes = Object.freeze([...input.nodes.values()].sort(compareMapNodes).map((node) => Object.freeze({
    ...node,
    recordIds: Object.freeze(uniqueInOrder(node.recordIds ?? []))
  })));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Object.freeze(uniqueMapEdges(input.edges)
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge) => Object.freeze({
      ...edge,
      recordIds: Object.freeze(uniqueInOrder(edge.recordIds ?? []))
    })));
  return Object.freeze({
    id: input.id,
    label: input.label,
    summary: input.summary,
    nodes,
    edges,
    stats: Object.freeze(input.stats)
  });
}

function uniqueMapEdges(edges) {
  const byId = new Map();
  for (const edge of edges) {
    const existing = byId.get(edge.id);
    if (!existing) {
      byId.set(edge.id, edge);
      continue;
    }
    byId.set(edge.id, {
      ...existing,
      tone: strongestTone([existing.tone, edge.tone]),
      recordIds: uniqueInOrder([...(existing.recordIds ?? []), ...(edge.recordIds ?? [])])
    });
  }
  return [...byId.values()];
}

function compareMapNodes(left, right) {
  return left.column - right.column || left.row - right.row || left.label.localeCompare(right.label);
}

function nextMapRow(rowsByColumn, column) {
  const current = rowsByColumn.get(column) ?? 0;
  rowsByColumn.set(column, current + 1);
  return current;
}

function queryArray(queryDomain, key) {
  const value = queryDomain?.[key];
  return Array.isArray(value) ? value : [];
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function baseProjection(workspaceRoot) {
  return {
    kind: "sidecar_process_projection",
    supported: false,
    contractName: SIDECAR_PROCESS_CONTRACT_NAME,
    contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
    runtimeModel: "abg-native",
    queryModel: "odd-domain-read-model",
    readOnly: true,
    workspaceRoot,
    eventLogRelativePath: SIDECAR_PROCESS_EVENT_LOG_RELATIVE_PATH,
    eventCount: 0,
    eventKinds: [],
    views: materializeViews([]),
    records: [],
    maps: Object.freeze([]),
    traversalOverlays: Object.freeze([])
  };
}

function unsupportedProcessProjection(workspaceRoot, reason) {
  return {
    ...baseProjection(workspaceRoot),
    supported: false,
    unsupportedReason: reason
  };
}

function vectorRecordId(event, fallbackIndex) {
  return stableRecordId("vector", [
    stringField(event, "graphCallId"),
    stringField(event, "frameId"),
    String(numberField(event, "vectorIndex") ?? fallbackIndex),
    edgeFromEvent(event) ?? ""
  ].join(":"));
}

function stableRecordId(prefix, value) {
  const text = String(value);
  const readable = text.replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 72) || "record";
  const digest = createHash("sha1").update(text).digest("hex").slice(0, 12);
  return `${prefix}:${readable}:${digest}`;
}

function graphFunctionTitle(event) {
  const graphFunctionId = stringField(event, "graphFunctionId");
  const fromId = graphFunctionId.split(":").filter(Boolean).at(-1);
  return fromId || edgeFromEvent(event) || "graph function";
}

function vectorStatus(event, kind) {
  if (kind === "vector_closed") return stringField(event, "closureKind") || "closed";
  if (kind === "vector_evaluated") return stringField(event, "status") || "evaluated";
  return "planned";
}

function statusForNonVectorEvent(event, kind) {
  if (kind === "assessed") return stringField(event, "assessmentKind") || "assessed";
  if (kind === "retry_repair_planned") return "retry_repair_planned";
  if (kind === "retry_attempt_opened") return "retry_attempt_opened";
  if (kind === "continuation_reopened") return "continuation_reopened";
  if (kind === "continuation_terminated") return stringField(event, "reason") || "continuation_terminated";
  return kind;
}

function viewIdsForEvent(kind, status) {
  const views = [];
  if (ACTIVE_EVENT_KINDS.has(kind)) views.push("active_work");
  if (BLOCKED_EVENT_KINDS.has(kind) || status === "blocked") views.push("blocked_waiting");
  if (READY_EVENT_KINDS.has(kind) || status === "advanced" || status === "closed") views.push("ready_handoff");
  return views.length > 0 ? views : ["active_work"];
}

function toneForViews(viewIds) {
  if (viewIds.includes("blocked_waiting")) return "blocked";
  if (viewIds.includes("ready_handoff")) return "converged";
  return "active";
}

function vectorSummary(event, kind, status) {
  const edge = edgeFromEvent(event) ?? "unnamed vector";
  const vectorIndex = numberField(event, "vectorIndex");
  if (kind === "vector_evaluated") {
    const evaluators = Array.isArray(event.evaluatorIds) ? event.evaluatorIds.join(", ") : "declared evaluators";
    return `Vector ${vectorIndex ?? "-"} ${edge} evaluated as ${status} by ${evaluators}.`;
  }
  if (kind === "vector_closed") {
    return `Vector ${vectorIndex ?? "-"} ${edge} closed with ${status} closure.`;
  }
  return `Vector ${vectorIndex ?? "-"} ${edge} planned for traversal.`;
}

function nonVectorSummary(event, kind, status) {
  const edge = edgeFromEvent(event) ?? "current edge";
  if (kind === "assessed") {
    const assessmentKind = stringField(event, "assessmentKind") || "assessment";
    return `${assessmentKind} assessment admitted for ${edge}.`;
  }
  if (kind === "retry_repair_planned") {
    return `Retry repair planned for ${edge}.`;
  }
  if (kind === "retry_attempt_opened") {
    return `Retry attempt opened for ${edge}.`;
  }
  if (kind === "continuation_reopened") {
    return `Continuation reopened for ${edge}.`;
  }
  if (kind === "continuation_terminated") {
    return `Continuation terminated for ${edge}: ${status}.`;
  }
  return `${kind} observed for ${edge}.`;
}

function refsFromEvent(event) {
  const refs = [
    stringField(event, "publishedLedgerRef"),
    stringField(event, "manifestId"),
    stringField(event, "priorManifestId"),
    stringField(event, "sourceProjectionRef"),
    stringField(event, "continuationId"),
    stringField(event, "closedContinuationId")
  ].filter(Boolean);
  return uniqueInOrder(refs);
}

function edgeFromEvent(event) {
  return stringOrNull(event, "edge") ??
    stringOrNull(event, "selectedEdgeGraphFunction") ??
    stringOrNull(event, "targetGraphFunction");
}

function stringField(event, key) {
  const value = event?.[key];
  return typeof value === "string" ? value : "";
}

function stringOrNull(event, key) {
  const value = stringField(event, key);
  return value || null;
}

function numberField(event, key) {
  const value = event?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrNull(event, key) {
  return numberField(event, key);
}

function uniqueInOrder(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}
