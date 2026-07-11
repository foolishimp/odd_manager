// Traversal projection service (sprint W7).
//
// Derives a bounded, recursion-aware traversal summary from an overlay-live
// proof JSON at a run root, merged with a directory scan of the per-vector
// artifact directory under the run's instance workspace. Per-vector detail is
// resolved lazily from a single artifact file, with hard caps, so the client
// never receives the full event sequence or all vector artifacts.
//
// Event kinds are treated as an open set: kinds present in the proof's
// eventCounts that this projection does not interpret are surfaced through
// `unknownEventKinds`, never silently dropped.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  discoverProjectObservationTopology,
  loadObservationRunProof,
  selectObservationRun,
} from './project-observation-topology-service.mjs';

const TRAVERSAL_PROJECTION_VERSION = 1;
const DEFAULT_MAX_PROOF_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_ARTIFACT_BYTES = 4 * 1024 * 1024;
const MAX_PROOF_CANDIDATES = 24;
const MAX_MATERIALIZED_FILE_ROWS = 200;
const MAX_CONTENT_PREVIEWS = 10;
const MAX_CONTENT_PREVIEW_CHARS = 400;
const MAX_ASSESSMENT_REASON_CHARS = 2000;
const MAX_REQUIREMENT_LINEAGE_ROWS = 64;

// The event kinds this summary derivation interprets. Every other kind in the
// proof's eventCounts is surfaced as unknown — the set of runtime event kinds
// is open and must never be silently narrowed here.
const UNDERSTOOD_EVENT_KINDS = new Set([
  'graph_call_opened',
  'frame_opened',
  'vector_traversal_planned',
  'vector_evaluated',
  'vector_closed',
  'terminal_reached',
]);

const AI_WORKSPACE_DIR = '.ai-workspace';
const LIVE_SCENARIO_PARENT_DIR = 'glc-software-build-live';
const VECTOR_ARTIFACT_PATTERN = /-vector-(\d+)(?:-attempt-(\d+))?(-evaluator(?:-attempt-(\d+))?)?-artifact\.json$/;
const VECTOR_EVALUATOR_FILE_PATTERN = /-vector-(\d+)(?:-attempt-\d+)?-evaluator[.-]/;

const summaryCache = new Map();
const resolutionCache = new Map();
const MAX_RESOLUTION_CACHE_ENTRIES = 32;

function diagnostic(severity, code, message, sourceRef = undefined) {
  return { severity, code, message, ...(sourceRef ? { sourceRef } : {}) };
}

function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function isDirectory(path) {
  const stats = statOf(path);
  return Boolean(stats && stats.isDirectory());
}

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function boundedReadJson(path, maxBytes) {
  const stats = statOf(path);
  if (!stats || !stats.isFile()) {
    return { ok: false, error: 'missing_file' };
  }
  if (stats.size > maxBytes) {
    return { ok: false, error: `json_too_large:${stats.size}` };
  }
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')), mtimeMs: stats.mtimeMs };
  } catch {
    return { ok: false, error: 'invalid_json' };
  }
}

function resolutionCacheKey(workspaceRootInput, runId) {
  return `${resolve(workspaceRootInput || '.')}::${runId ?? 'latest'}`;
}

function rememberResolution(workspaceRootInput, runId, resolvedRun) {
  const key = resolutionCacheKey(workspaceRootInput, runId);
  resolutionCache.delete(key);
  resolutionCache.set(key, resolvedRun);
  while (resolutionCache.size > MAX_RESOLUTION_CACHE_ENTRIES) {
    resolutionCache.delete(resolutionCache.keys().next().value);
  }
}

function cachedResolution(workspaceRootInput, runId) {
  const key = resolutionCacheKey(workspaceRootInput, runId);
  const cached = resolutionCache.get(key);
  if (!cached) return null;
  const currentMtimeMs = statOf(cached.proofPath)?.mtimeMs ?? null;
  if (currentMtimeMs === null || currentMtimeMs !== cached.proofMtimeMs) {
    resolutionCache.delete(key);
    return null;
  }
  resolutionCache.delete(key);
  resolutionCache.set(key, cached);
  return cached;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function finiteNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArrayOf(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function numberArrayOf(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'number' && Number.isFinite(entry)) : [];
}

function looksLikeTraversalProof(value) {
  if (!isRecord(value)) return false;
  const kind = typeof value.kind === 'string' ? value.kind : '';
  if (kind.endsWith('overlay_live_proof')) return true;
  return Array.isArray(value.eventSequence) && isRecord(value.requirementLineageCanary);
}

function probeRunRootDirectory(candidateRoot, diagnostics) {
  if (!isDirectory(candidateRoot)) return null;
  if (!existsSync(join(candidateRoot, 'sandbox-identity.json'))) return null;
  const entries = listDir(candidateRoot)
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'sandbox-identity.json')
    .map((entry) => entry.name)
    .sort((left, right) => {
      const leftProof = left.endsWith('-proof.json') ? 0 : 1;
      const rightProof = right.endsWith('-proof.json') ? 0 : 1;
      if (leftProof !== rightProof) return leftProof - rightProof;
      return left.localeCompare(right);
    })
    .slice(0, MAX_PROOF_CANDIDATES);
  for (const name of entries) {
    const path = join(candidateRoot, name);
    const parsed = boundedReadJson(path, DEFAULT_MAX_PROOF_BYTES);
    if (!parsed.ok) {
      if (name.endsWith('-proof.json')) {
        diagnostics.push(diagnostic('warning', 'proof_candidate_unreadable', `proof candidate could not be read: ${parsed.error}`, path));
      }
      continue;
    }
    if (looksLikeTraversalProof(parsed.value)) {
      return { runRoot: candidateRoot, proofPath: path, proof: parsed.value, proofMtimeMs: parsed.mtimeMs };
    }
  }
  return null;
}

// Resolve the run root for a registered workspace root: the workspace root
// itself or its parent must contain a traversal proof JSON plus
// sandbox-identity.json. Anything else is an honest 'unsupported'.
export function resolveTraversalRunRoot(workspaceRootInput, options = {}) {
  const workspaceRoot = resolve(workspaceRootInput || '.');
  const diagnostics = [];
  if (!isDirectory(workspaceRoot)) {
    return {
      state: 'unsupported',
      workspaceRoot,
      diagnostics: [diagnostic('error', 'workspace_root_missing', `workspaceRoot is not a directory: ${workspaceRoot}`)],
    };
  }
  const topology = discoverProjectObservationTopology(workspaceRoot, { refresh: options.refresh === true });
  const topologyRun = selectObservationRun(topology, options.runId ?? null);
  if (topologyRun) {
    const proof = loadObservationRunProof(topologyRun);
    if (proof) {
      return {
        state: 'ready',
        workspaceRoot,
        runId: topologyRun.runId,
        runRoot: topologyRun.runRoot,
        proofPath: topologyRun.proofPath,
        proof,
        proofMtimeMs: topologyRun.proofMtimeMs,
        diagnostics: [...topology.diagnostics],
      };
    }
  }
  if (options.runId) {
    diagnostics.push(diagnostic('warning', 'selected_run_missing', `run ${options.runId} is not present in the Project observation topology`, workspaceRoot));
  }
  for (const candidateRoot of [workspaceRoot, dirname(workspaceRoot)]) {
    const resolved = probeRunRootDirectory(candidateRoot, diagnostics);
    if (resolved) {
      return { state: 'ready', workspaceRoot, runId: null, ...resolved, diagnostics };
    }
  }
  diagnostics.push(diagnostic(
    'info',
    'run_topology_missing',
    'neither workspaceRoot nor its parent contains a traversal proof JSON alongside sandbox-identity.json',
    workspaceRoot,
  ));
  return { state: 'unsupported', workspaceRoot, diagnostics };
}

function substratePin(value) {
  if (!isRecord(value)) return null;
  return {
    productId: stringOrNull(value.productId),
    packageName: stringOrNull(value.packageName),
    packageVersion: stringOrNull(value.packageVersion),
    releaseTag: stringOrNull(value.releaseTag),
    sourceCommit: stringOrNull(value.sourceCommit),
  };
}

function requirementLineageRows(canary, diagnostics) {
  if (!isRecord(canary) || !Array.isArray(canary.requirements)) return [];
  if (canary.requirements.length > MAX_REQUIREMENT_LINEAGE_ROWS) {
    diagnostics.push(diagnostic(
      'warning',
      'requirement_lineage_truncated',
      `requirement lineage capped at ${MAX_REQUIREMENT_LINEAGE_ROWS} of ${canary.requirements.length} rows`,
    ));
  }
  return canary.requirements.slice(0, MAX_REQUIREMENT_LINEAGE_ROWS)
    .filter((row) => isRecord(row) && typeof row.requirementId === 'string')
    .map((row) => ({
      requirementId: row.requirementId,
      spanIds: stringArrayOf(row.spanIds),
      vectorIndexes: numberArrayOf(row.vectorIndexes),
      reachedVectorIndexes: numberArrayOf(row.reachedVectorIndexes),
      enteringPromptRefCounts: numberArrayOf(row.enteringPromptRefCounts),
      coverageStatuses: stringArrayOf(row.coverageStatuses),
      foldStates: stringArrayOf(row.foldStates),
      residualPressureRefs: stringArrayOf(row.residualPressureRefs),
    }));
}

// Derive invocation frames and vector rows from the proof event sequence.
// Recursion model: each graph call opens an invocation frame; the vector the
// frame traverses is announced by the next vector_traversal_planned event.
function deriveFramesAndVectors(eventSequence, fallbackGraphFunctionRef) {
  const frames = [];
  const vectorsByIndex = new Map();
  let openFrame = null;

  const ensureVector = (vectorIndex) => {
    if (!vectorsByIndex.has(vectorIndex)) {
      vectorsByIndex.set(vectorIndex, {
        vectorIndex,
        edge: null,
        stage: null,
        attemptCount: 0,
        hasEvaluator: false,
        accepted: null,
        durationMs: null,
        plannedAt: null,
        plannedAtUnixMs: null,
        evaluatedAt: null,
        evaluatedAtUnixMs: null,
        plannedEventCount: 0,
        frameOrdinal: null,
      });
    }
    return vectorsByIndex.get(vectorIndex);
  };

  for (const event of eventSequence) {
    if (!isRecord(event) || typeof event.kind !== 'string') continue;
    const kind = event.kind;
    const eventTime = stringOrNull(event.eventTime);
    if (kind === 'graph_call_opened') {
      openFrame = {
        frameOrdinal: frames.length,
        graphFunctionRef: stringOrNull(event.graphFunctionRef) ?? fallbackGraphFunctionRef,
        edge: stringOrNull(event.edge),
        vectorIndex: finiteNumberOrNull(event.vectorIndex),
        openedAt: eventTime,
        frameOpened: false,
      };
      frames.push(openFrame);
      continue;
    }
    if (kind === 'frame_opened') {
      if (openFrame && !openFrame.frameOpened) {
        openFrame.frameOpened = true;
        if (!openFrame.openedAt) openFrame.openedAt = eventTime;
      } else {
        openFrame = {
          frameOrdinal: frames.length,
          graphFunctionRef: stringOrNull(event.graphFunctionRef) ?? fallbackGraphFunctionRef,
          edge: stringOrNull(event.edge),
          vectorIndex: finiteNumberOrNull(event.vectorIndex),
          openedAt: eventTime,
          frameOpened: true,
        };
        frames.push(openFrame);
      }
      continue;
    }
    if (kind === 'vector_traversal_planned') {
      const vectorIndex = finiteNumberOrNull(event.vectorIndex);
      if (vectorIndex === null) continue;
      if (openFrame && openFrame.vectorIndex === null) {
        openFrame.vectorIndex = vectorIndex;
        if (!openFrame.edge) openFrame.edge = stringOrNull(event.edge);
        if (!openFrame.graphFunctionRef) openFrame.graphFunctionRef = stringOrNull(event.graphFunctionRef);
      }
      const vector = ensureVector(vectorIndex);
      vector.plannedEventCount += 1;
      if (!vector.edge) vector.edge = stringOrNull(event.edge);
      if (vector.plannedAt === null) {
        vector.plannedAt = eventTime;
        vector.plannedAtUnixMs = finiteNumberOrNull(event.eventTimeUnixMs);
      }
      if (openFrame && openFrame.vectorIndex === vectorIndex) {
        vector.frameOrdinal = openFrame.frameOrdinal;
      }
      continue;
    }
    if (kind === 'vector_evaluated') {
      const vectorIndex = finiteNumberOrNull(event.vectorIndex);
      if (vectorIndex === null) continue;
      const vector = ensureVector(vectorIndex);
      if (!vector.edge) vector.edge = stringOrNull(event.edge);
      vector.evaluatedAt = eventTime;
      vector.evaluatedAtUnixMs = finiteNumberOrNull(event.eventTimeUnixMs);
    }
  }

  for (const vector of vectorsByIndex.values()) {
    if (vector.plannedAtUnixMs !== null && vector.evaluatedAtUnixMs !== null) {
      vector.durationMs = Math.max(0, vector.evaluatedAtUnixMs - vector.plannedAtUnixMs);
    }
  }

  return {
    frames: frames.map((frame) => ({
      frameOrdinal: frame.frameOrdinal,
      graphFunctionRef: frame.graphFunctionRef,
      edge: frame.edge,
      vectorIndex: frame.vectorIndex,
      openedAt: frame.openedAt,
    })),
    vectorsByIndex,
  };
}

function instanceWorkspaceDir(workspaceRoot, runRoot) {
  const candidates = [
    join(runRoot, 'instance', AI_WORKSPACE_DIR),
    join(runRoot, 'workspace', AI_WORKSPACE_DIR),
    join(workspaceRoot, AI_WORKSPACE_DIR),
  ];
  for (const candidate of candidates) {
    if (isDirectory(candidate)) return candidate;
  }
  return null;
}

// The scenario-name segment of the artifact directory is derived from the
// directory listing (validated against scenarioKind when possible), never
// hardcoded to a specific scenario.
function resolveVectorArtifactDir(workspaceRoot, runRoot, scenarioKind, diagnostics) {
  const aiWorkspaceDir = instanceWorkspaceDir(workspaceRoot, runRoot);
  if (!aiWorkspaceDir) {
    diagnostics.push(diagnostic('info', 'instance_workspace_missing', 'no instance .ai-workspace directory was found for this run'));
    return null;
  }
  const parentCandidates = [];
  const preferredParent = join(aiWorkspaceDir, LIVE_SCENARIO_PARENT_DIR);
  if (isDirectory(preferredParent)) parentCandidates.push(preferredParent);
  for (const entry of listDir(aiWorkspaceDir)) {
    const path = join(aiWorkspaceDir, entry.name);
    if (entry.isDirectory() && path !== preferredParent) parentCandidates.push(path);
  }
  const normalizedScenarioKind = String(scenarioKind ?? '').replace(/_/g, '-').toLowerCase();
  const matches = [];
  for (const parent of parentCandidates) {
    for (const entry of listDir(parent)) {
      if (!entry.isDirectory()) continue;
      const scenarioDir = join(parent, entry.name);
      const hasVectorArtifacts = listDir(scenarioDir)
        .some((file) => file.isFile() && VECTOR_ARTIFACT_PATTERN.test(file.name));
      if (hasVectorArtifacts) {
        matches.push({ scenarioDir, scenarioName: entry.name });
      }
    }
    if (matches.length > 0) break;
  }
  if (matches.length === 0) {
    diagnostics.push(diagnostic('info', 'vector_artifact_dir_missing', 'no per-vector artifact directory was found under the instance .ai-workspace'));
    return null;
  }
  const preferred = matches.find((match) => normalizedScenarioKind.startsWith(match.scenarioName.toLowerCase()));
  const chosen = preferred ?? matches[0];
  if (matches.length > 1 && !preferred) {
    diagnostics.push(diagnostic(
      'warning',
      'vector_artifact_dir_ambiguous',
      `multiple vector artifact directories found; using ${chosen.scenarioName}`,
      chosen.scenarioDir,
    ));
  }
  return chosen;
}

function scanVectorArtifacts(scenarioDir) {
  // One directory read; group artifact files and evaluator sidecar files per
  // vector without loading any file contents.
  const byVector = new Map();
  const ensure = (vectorIndex) => {
    if (!byVector.has(vectorIndex)) {
      byVector.set(vectorIndex, { primary: new Map(), evaluator: new Map(), hasEvaluatorFiles: false });
    }
    return byVector.get(vectorIndex);
  };
  for (const entry of listDir(scenarioDir)) {
    if (!entry.isFile()) continue;
    const artifactMatch = VECTOR_ARTIFACT_PATTERN.exec(entry.name);
    if (artifactMatch) {
      const vectorIndex = Number(artifactMatch[1]);
      const record = ensure(vectorIndex);
      if (artifactMatch[3]) {
        const attempt = artifactMatch[4] ? Number(artifactMatch[4]) : 1;
        record.evaluator.set(attempt, join(scenarioDir, entry.name));
        record.hasEvaluatorFiles = true;
      } else {
        const attempt = artifactMatch[2] ? Number(artifactMatch[2]) : 1;
        record.primary.set(attempt, join(scenarioDir, entry.name));
      }
      continue;
    }
    const evaluatorMatch = VECTOR_EVALUATOR_FILE_PATTERN.exec(entry.name);
    if (evaluatorMatch) {
      ensure(Number(evaluatorMatch[1])).hasEvaluatorFiles = true;
    }
  }
  return byVector;
}

function latestAttempt(attemptMap) {
  let latest = null;
  for (const attempt of attemptMap.keys()) {
    if (latest === null || attempt > latest) latest = attempt;
  }
  return latest;
}

function mergeArtifactScanIntoVectors(vectorsByIndex, artifactsByVector, diagnostics) {
  for (const [vectorIndex, record] of artifactsByVector) {
    if (!vectorsByIndex.has(vectorIndex)) {
      vectorsByIndex.set(vectorIndex, {
        vectorIndex,
        edge: null,
        stage: null,
        attemptCount: 0,
        hasEvaluator: false,
        accepted: null,
        durationMs: null,
        plannedAt: null,
        plannedAtUnixMs: null,
        evaluatedAt: null,
        evaluatedAtUnixMs: null,
        plannedEventCount: 0,
        frameOrdinal: null,
      });
    }
    const vector = vectorsByIndex.get(vectorIndex);
    vector.attemptCount = Math.max(record.primary.size, vector.plannedEventCount, vector.attemptCount);
    vector.hasEvaluator = record.hasEvaluatorFiles;
    const attempt = latestAttempt(record.primary);
    if (attempt !== null) {
      // Only the LATEST attempt's artifact is read, bounded, for the accepted
      // flag and stage — the summary never loads every vector artifact body.
      const artifactPath = record.primary.get(attempt);
      const parsed = boundedReadJson(artifactPath, DEFAULT_MAX_ARTIFACT_BYTES);
      if (!parsed.ok) {
        diagnostics.push(diagnostic('warning', 'vector_artifact_unreadable', `vector ${vectorIndex} artifact could not be read: ${parsed.error}`, artifactPath));
      } else if (isRecord(parsed.value)) {
        const artifact = parsed.value;
        if (isRecord(artifact.assessment) && typeof artifact.assessment.accepted === 'boolean') {
          vector.accepted = artifact.assessment.accepted;
        }
        if (!vector.stage) vector.stage = stringOrNull(artifact.stage);
        if (!vector.edge) vector.edge = stringOrNull(artifact.edge);
      }
    }
  }
  for (const vector of vectorsByIndex.values()) {
    if (vector.attemptCount === 0) {
      vector.attemptCount = Math.max(1, vector.plannedEventCount);
    }
  }
}

function deriveCurrentVectorIndex(vectorsByIndex) {
  let highestEvaluated = null;
  let highestPlanned = null;
  for (const vector of vectorsByIndex.values()) {
    if (vector.evaluatedAt !== null) {
      if (highestEvaluated === null || vector.vectorIndex > highestEvaluated) highestEvaluated = vector.vectorIndex;
    }
    if (vector.plannedAt !== null) {
      if (highestPlanned === null || vector.vectorIndex > highestPlanned) highestPlanned = vector.vectorIndex;
    }
  }
  if (highestPlanned === null) return highestEvaluated;
  if (highestEvaluated === null) return highestPlanned;
  return Math.max(highestPlanned, highestEvaluated);
}

function unsupportedProjection(workspaceRoot, diagnostics) {
  return {
    kind: 'traversal_projection',
    version: TRAVERSAL_PROJECTION_VERSION,
    state: 'unsupported',
    runId: null,
    runRoot: null,
    workspaceRoot,
    graphRef: null,
    graphFunctionRef: null,
    overlayRef: null,
    startupConfigRef: null,
    eventLogDigest: null,
    frameLineageState: 'unavailable',
    scenario: { scenarioId: null, scenarioKind: null, proofClass: null, durationMs: null },
    substrate: null,
    eventCounts: {},
    unknownEventKinds: [],
    frames: [],
    vectors: [],
    currentVectorIndex: null,
    requirementLineage: [],
    diagnostics,
  };
}

export function loadTraversalSummary(workspaceRootInput, options = {}) {
  const resolved = resolveTraversalRunRoot(workspaceRootInput, options);
  if (resolved.state !== 'ready') {
    return unsupportedProjection(resolved.workspaceRoot, resolved.diagnostics);
  }
  rememberResolution(workspaceRootInput, options.runId ?? null, resolved);
  if (resolved.runId) rememberResolution(workspaceRootInput, resolved.runId, resolved);
  const { workspaceRoot, runId, runRoot, proofPath, proof, proofMtimeMs } = resolved;

  const diagnostics = [...resolved.diagnostics];
  const eventSequence = Array.isArray(proof.eventSequence) ? proof.eventSequence : [];
  if (eventSequence.length === 0) {
    diagnostics.push(diagnostic('warning', 'event_sequence_empty', 'proof has no eventSequence entries', proofPath));
  }

  const fallbackGraphFunctionRef = stringOrNull(proof.graphFunctionRef);
  const { frames, vectorsByIndex } = deriveFramesAndVectors(eventSequence, fallbackGraphFunctionRef);

  const scenarioKind = stringOrNull(proof.scenarioKind);
  const artifactDir = resolveVectorArtifactDir(workspaceRoot, runRoot, scenarioKind, diagnostics);
  const artifactDirectoryMtimeMs = artifactDir ? statOf(artifactDir.scenarioDir)?.mtimeMs ?? 0 : 0;
  const cacheKey = runRoot;
  const cached = summaryCache.get(cacheKey);
  if (
    !options.refresh
    && cached
    && cached.proofMtimeMs === proofMtimeMs
    && cached.artifactDirectoryMtimeMs === artifactDirectoryMtimeMs
    && cached.workspaceRoot === workspaceRoot
  ) {
    return cached.summary;
  }
  if (artifactDir) {
    mergeArtifactScanIntoVectors(vectorsByIndex, scanVectorArtifacts(artifactDir.scenarioDir), diagnostics);
  } else {
    for (const vector of vectorsByIndex.values()) {
      if (vector.attemptCount === 0) vector.attemptCount = Math.max(1, vector.plannedEventCount);
    }
  }

  const eventCounts = {};
  if (isRecord(proof.eventCounts)) {
    for (const [kind, count] of Object.entries(proof.eventCounts)) {
      if (typeof count === 'number' && Number.isFinite(count)) eventCounts[kind] = count;
    }
  } else {
    diagnostics.push(diagnostic('warning', 'event_counts_missing', 'proof has no eventCounts map', proofPath));
  }
  const unknownEventKinds = Object.keys(eventCounts)
    .filter((kind) => !UNDERSTOOD_EVENT_KINDS.has(kind))
    .sort();

  const vectors = [...vectorsByIndex.values()]
    .sort((left, right) => left.vectorIndex - right.vectorIndex)
    .map((vector) => ({
      vectorIndex: vector.vectorIndex,
      edge: vector.edge,
      stage: vector.stage,
      attemptCount: vector.attemptCount,
      hasEvaluator: vector.hasEvaluator,
      accepted: vector.accepted,
      durationMs: vector.durationMs,
      plannedAt: vector.plannedAt,
      evaluatedAt: vector.evaluatedAt,
      frameOrdinal: vector.frameOrdinal,
    }));

  const summary = {
    kind: 'traversal_projection',
    version: TRAVERSAL_PROJECTION_VERSION,
    state: 'ready',
    runId,
    runRoot,
    workspaceRoot,
    graphRef: stringOrNull(proof.graphRef),
    graphFunctionRef: fallbackGraphFunctionRef,
    overlayRef: stringOrNull(proof.overlayRef),
    startupConfigRef: stringOrNull(proof.startupConfigRef),
    eventLogDigest: stringOrNull(proof.eventLogSha256) ?? stringOrNull(proof.eventLogDigest),
    frameLineageState: eventSequence.some((event) => isRecord(event) && finiteNumberOrNull(event.parentFrameOrdinal) !== null)
      ? 'published'
      : 'unavailable',
    scenario: {
      scenarioId: stringOrNull(proof.scenarioId),
      scenarioKind,
      proofClass: stringOrNull(proof.proofClass),
      durationMs: finiteNumberOrNull(proof.durationMs),
    },
    substrate: substratePin(proof.substrate),
    eventCounts,
    unknownEventKinds,
    frames,
    vectors,
    currentVectorIndex: deriveCurrentVectorIndex(vectorsByIndex),
    requirementLineage: requirementLineageRows(proof.requirementLineageCanary, diagnostics),
    diagnostics,
  };

  summaryCache.set(cacheKey, { proofMtimeMs, artifactDirectoryMtimeMs, workspaceRoot, summary });
  return summary;
}

function availableVariantRefs(record) {
  const refs = [];
  for (const attempt of [...record.primary.keys()].sort((left, right) => left - right)) {
    refs.push({ variant: 'primary', attempt });
  }
  for (const attempt of [...record.evaluator.keys()].sort((left, right) => left - right)) {
    refs.push({ variant: 'evaluator', attempt });
  }
  return refs;
}

function cappedPreview(text) {
  const value = String(text);
  return value.length > MAX_CONTENT_PREVIEW_CHARS ? value.slice(0, MAX_CONTENT_PREVIEW_CHARS) : value;
}

function fileRowsOf(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => isRecord(entry) && typeof entry.path === 'string')
    .slice(0, MAX_MATERIALIZED_FILE_ROWS)
    .map((entry) => ({
      path: entry.path,
      sha256: stringOrNull(entry.sha256),
      byteLength: finiteNumberOrNull(entry.byteLength),
      lineCount: finiteNumberOrNull(entry.lineCount),
    }));
}

function contentPreviewsOf(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => isRecord(entry) && typeof entry.path === 'string' && typeof entry.contentPreview === 'string')
    .slice(0, MAX_CONTENT_PREVIEWS)
    .map((entry) => ({ path: entry.path, contentPreview: cappedPreview(entry.contentPreview) }));
}

function stagePlanOf(value) {
  if (!isRecord(value)) return null;
  return {
    sourceTypeRef: stringOrNull(value.sourceTypeRef),
    targetTypeRef: stringOrNull(value.targetTypeRef),
    vectorId: stringOrNull(value.vectorId),
    filesToProduce: stringArrayOf(value.filesToProduce),
    executeBeforeAssessment: typeof value.executeBeforeAssessment === 'boolean' ? value.executeBeforeAssessment : null,
  };
}

function assessmentOf(value) {
  if (!isRecord(value)) return null;
  const reason = stringOrNull(value.reason);
  return {
    accepted: typeof value.accepted === 'boolean' ? value.accepted : null,
    reason: reason && reason.length > MAX_ASSESSMENT_REASON_CHARS ? reason.slice(0, MAX_ASSESSMENT_REASON_CHARS) : reason,
    nodeTypesUsed: stringArrayOf(value.nodeTypesUsed),
  };
}

function timingOf(value) {
  const dispatch = isRecord(value) && isRecord(value.dispatch) ? value.dispatch : null;
  if (!dispatch) return null;
  return {
    startedAt: stringOrNull(dispatch.startedAt),
    endedAt: stringOrNull(dispatch.endedAt),
    durationMs: finiteNumberOrNull(dispatch.durationMs),
  };
}

export function loadTraversalVectorDetail(workspaceRootInput, request = {}) {
  const vectorIndex = Number(request.vectorIndex);
  if (!Number.isInteger(vectorIndex) || vectorIndex < 0) {
    return { ok: false, error: 'vector detail requires a non-negative integer vector index' };
  }
  const variant = request.variant === 'evaluator' ? 'evaluator' : 'primary';

  const requestedRunId = request.runId ?? null;
  const resolved = cachedResolution(workspaceRootInput, requestedRunId)
    ?? resolveTraversalRunRoot(workspaceRootInput, { runId: requestedRunId });
  if (resolved.state !== 'ready') {
    return {
      ok: false,
      error: 'traversal run topology was not found for this workspaceRoot',
      diagnostics: resolved.diagnostics,
    };
  }
  rememberResolution(workspaceRootInput, requestedRunId, resolved);
  if (resolved.runId) rememberResolution(workspaceRootInput, resolved.runId, resolved);
  const diagnostics = [];
  const scenarioKind = stringOrNull(resolved.proof.scenarioKind);
  const artifactDir = resolveVectorArtifactDir(resolved.workspaceRoot, resolved.runRoot, scenarioKind, diagnostics);
  if (!artifactDir) {
    return { ok: false, error: 'no per-vector artifact directory was found for this run', diagnostics };
  }
  const record = scanVectorArtifacts(artifactDir.scenarioDir).get(vectorIndex);
  if (!record) {
    return { ok: false, error: `no artifacts were found for vector ${vectorIndex}` };
  }
  const attemptMap = variant === 'evaluator' ? record.evaluator : record.primary;
  const attempt = Number.isInteger(request.attempt) && request.attempt > 0
    ? request.attempt
    : latestAttempt(attemptMap);
  const artifactPath = attempt === null ? undefined : attemptMap.get(attempt);
  if (!artifactPath) {
    return {
      ok: false,
      error: `no ${variant} artifact was found for vector ${vectorIndex}${attempt === null ? '' : ` attempt ${attempt}`}`,
    };
  }
  const parsed = boundedReadJson(artifactPath, DEFAULT_MAX_ARTIFACT_BYTES);
  if (!parsed.ok) {
    return { ok: false, error: `vector artifact could not be read: ${parsed.error}` };
  }
  const artifact = isRecord(parsed.value) ? parsed.value : {};
  const candidateFiles = isRecord(artifact.candidateEvidence) ? artifact.candidateEvidence.materializedFiles : undefined;
  const materializedFiles = fileRowsOf(candidateFiles).length > 0
    ? fileRowsOf(candidateFiles)
    : fileRowsOf(artifact.materializedFileSummaries);

  return {
    ok: true,
    detail: {
      kind: 'traversal_vector_detail',
      version: TRAVERSAL_PROJECTION_VERSION,
      vectorIndex,
      variant,
      attempt,
      edge: stringOrNull(artifact.edge),
      stage: stringOrNull(artifact.stage),
      stagePlan: stagePlanOf(artifact.stagePlan),
      assessment: assessmentOf(artifact.assessment),
      materializedFiles,
      contentPreviews: contentPreviewsOf(artifact.materializedFileSummaries),
      timing: timingOf(artifact.timing),
      availableVariants: availableVariantRefs(record),
      sourcePath: artifactPath,
    },
  };
}
