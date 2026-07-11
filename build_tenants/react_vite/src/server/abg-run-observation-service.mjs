import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  discoverProjectObservationTopology,
  loadObservationRunProof,
  selectObservationRun,
} from './project-observation-topology-service.mjs';

const VERSION = 2;
const MAX_AUXILIARY_BYTES = 8 * 1024 * 1024;
const MAX_VECTOR_ARTIFACT_BYTES = 4 * 1024 * 1024;
const MAX_VECTOR_SCAN_DIRECTORIES = 500;
const MAX_EVENT_ROWS = 240;
const MAX_CATALOG_ENTRIES = 500;
const MAX_CATALOG_REJECTIONS = 100;
const MAX_CATALOG_EVENT_INDEXES = 24;
const MAX_SERIALIZED_CATALOG_ENTRY_CHARS = 1024 * 1024;
const MAX_ASSETS = 600;
const MAX_TRANSCRIPTS = 80;
const MAX_TRANSCRIPT_CHARS = 6000;
const VECTOR_ARTIFACT_PATTERN = /-vector-(\d+)(?:-attempt-(\d+))?(-evaluator(?:-attempt-(\d+))?)?-artifact\.json$/;
const DIGEST_CHUNK_BYTES = 1024 * 1024;
const digestCache = new Map();

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function readJson(path, maxBytes = MAX_AUXILIARY_BYTES) {
  const stats = statOf(path);
  if (!stats?.isFile() || stats.size > maxBytes) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function sha256Of(path, stats) {
  const cacheKey = `${path}:${stats.size}:${stats.mtimeMs}`;
  const cached = digestCache.get(cacheKey);
  if (cached) return cached;
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(DIGEST_CHUNK_BYTES);
  const fd = openSync(path, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(fd);
  }
  const digest = `sha256:${hash.digest('hex')}`;
  digestCache.set(cacheKey, digest);
  return digest;
}

function digestObservation(path, expectedDigest, stats) {
  if (!stats?.isFile()) {
    return { digest: expectedDigest, observedDigest: null, digestState: 'unavailable' };
  }
  let observedDigest;
  try {
    observedDigest = sha256Of(path, stats);
  } catch {
    return { digest: expectedDigest, observedDigest: null, digestState: 'unavailable' };
  }
  if (!expectedDigest) return { digest: null, observedDigest, digestState: 'not_declared' };
  return {
    digest: expectedDigest,
    observedDigest,
    digestState: observedDigest === expectedDigest ? 'verified' : 'mismatch',
  };
}

function diagnostic(severity, code, message, sourceRef = undefined, vectorIndex = undefined) {
  return {
    severity,
    code,
    message,
    ...(sourceRef ? { sourceRef } : {}),
    ...(Number.isInteger(vectorIndex) ? { vectorIndex } : {}),
  };
}

function identityProjection(identity) {
  return {
    id: identity?.id ?? 'unknown',
    label: identity?.label ?? 'unknown',
    kind: identity?.kind ?? 'unknown',
    version: identity?.version ?? null,
    sourceRef: identity?.sourceRef ?? null,
    confidence: identity?.confidence ?? 'low',
    governancePackages: Array.isArray(identity?.governancePackages) ? identity.governancePackages : [],
  };
}

function runSummary(run) {
  return {
    runId: run.runId,
    runRoot: run.runRoot,
    workspaceRoot: run.workspaceRoot,
    scenarioId: run.scenarioId,
    scenarioKind: run.scenarioKind,
    proofClass: run.proofClass,
    graphFunctionRef: run.graphFunctionRef,
    status: run.status,
    modifiedAt: run.modifiedAt,
    lastEventAt: run.lastEventAt,
    eventCount: run.eventCount,
  };
}

function emptyObservation(topology, state, diagnostics) {
  return {
    kind: 'abg_run_observation',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    state,
    projectRoot: topology.projectRoot,
    identity: identityProjection(topology.identity),
    runs: topology.runs.map(runSummary),
    selectedRunId: null,
    selectedRunRoot: null,
    selectedWorkspaceRoot: null,
    systemReferences: [],
    substrate: null,
    activity: null,
    functions: [],
    catalog: emptyCatalogProjection(null),
    assets: [],
    assurance: null,
    eventKinds: [],
    events: [],
    stages: [],
    transcripts: [],
    artifacts: [],
    diagnostics,
  };
}

function eventCountsOf(proof) {
  const counts = {};
  if (!isRecord(proof?.eventCounts)) return counts;
  for (const [kind, count] of Object.entries(proof.eventCounts)) {
    if (typeof count === 'number' && Number.isFinite(count)) counts[kind] = count;
  }
  return counts;
}

function eventKindRows(counts) {
  return Object.entries(counts)
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind));
}

function eventDetail(event) {
  if (!isRecord(event)) return null;
  const ignored = new Set(['index', 'kind', 'eventTime', 'eventTimeUnixMs', 'eventAdmissionOrdinal', 'edge', 'vectorIndex', 'graphFunctionRef']);
  const entries = Object.entries(event)
    .filter(([key, value]) => !ignored.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${key}=${String(value)}`);
  return entries.length > 0 ? entries.join(' · ') : null;
}

function boundedEventRows(sequence) {
  if (!Array.isArray(sequence)) return [];
  const highSignalKinds = new Set([
    'graph_function_selected', 'graph_call_opened', 'frame_opened',
    'vector_traversal_planned', 'vector_evaluated', 'vector_closed',
    'retry_repair_planned', 'retry_attempt_opened', 'retry_progress_recorded',
    'continuation_reopened', 'continuation_terminated', 'terminal_reached',
    'actor_invocation_started', 'actor_invocation_closed',
  ]);
  const selected = [
    ...sequence.slice(0, 12),
    ...sequence.filter((event) => isRecord(event) && highSignalKinds.has(event.kind)),
    ...sequence.slice(-80),
  ];
  const byIndex = new Map();
  for (const event of selected) {
    if (!isRecord(event)) continue;
    const index = numberOrNull(event.index) ?? numberOrNull(event.eventAdmissionOrdinal);
    if (index === null) continue;
    byIndex.set(index, event);
  }
  return [...byIndex.entries()]
    .sort((left, right) => left[0] - right[0])
    .slice(-MAX_EVENT_ROWS)
    .map(([index, event]) => ({
      index,
      kind: stringOrNull(event.kind) ?? 'unknown',
      eventTime: stringOrNull(event.eventTime),
      vectorIndex: numberOrNull(event.vectorIndex),
      edge: stringOrNull(event.edge),
      graphFunctionRef: stringOrNull(event.graphFunctionRef),
      detail: eventDetail(event),
    }));
}

function emptyCatalogProjection(sourceRef) {
  return {
    state: 'missing',
    sourceKind: 'abg_runtime_events',
    sourceRef,
    admissionEventCount: 0,
    unparsedAdmissionCount: 0,
    rejectedEventCount: 0,
    constructionCatalogEventCount: 0,
    entryCount: 0,
    entryKindCounts: [],
    entries: [],
    rejectedEntries: [],
    constructionCatalogs: [],
    truncated: false,
  };
}

function catalogEventIndex(event) {
  return numberOrNull(event.index) ?? numberOrNull(event.eventAdmissionOrdinal);
}

function boundedEventIndexes(indexes) {
  return [...new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0))]
    .sort((left, right) => left - right)
    .slice(0, MAX_CATALOG_EVENT_INDEXES);
}

function parsedGraphFunctionCarrier(value) {
  if (typeof value !== 'string' || !value.startsWith('graph_function:')) return null;
  const source = value.slice('graph_function:'.length);
  if (!source || source.length > MAX_SERIALIZED_CATALOG_ENTRY_CHARS) return null;
  try {
    const parsed = JSON.parse(source);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function typeRefsFrom(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((entry) => isRecord(entry) ? stringOrNull(entry.typeRef) : null)
    .filter(Boolean))]
    .slice(0, 80);
}

function declarationKeysFrom(value) {
  const entries = isRecord(value) && Array.isArray(value.entries) ? value.entries : [];
  return [...new Set(entries
    .map((entry) => isRecord(entry) ? stringOrNull(entry.key) : null)
    .filter(Boolean))]
    .slice(0, 80);
}

function catalogEntryFromEvent(event, proofPath) {
  const rawGraphFunctionRef = stringOrNull(event.graphFunctionRef);
  const parsed = parsedGraphFunctionCarrier(rawGraphFunctionRef);
  const compactGraphFunctionRef = rawGraphFunctionRef && !rawGraphFunctionRef.startsWith('graph_function:')
    ? rawGraphFunctionRef
    : null;
  const entryRef = stringOrNull(event.entryRef) ?? compactGraphFunctionRef;
  const name = stringOrNull(parsed?.name) ?? entryRef ?? stringOrNull(event.declarationRef);
  if (!name) return null;
  const tags = [...new Set(stringArray(parsed?.tags))].slice(0, 80);
  const entryKind = stringOrNull(event.entryKind)
    ?? (tags.includes('gtl:node_type') || tags.includes('node_type') ? 'node_type' : 'graph_function');
  const template = isRecord(parsed?.template) ? parsed.template : null;
  const index = catalogEventIndex(event);
  const fingerprintSource = rawGraphFunctionRef ?? JSON.stringify({
    entryRef,
    declarationRef: event.declarationRef ?? null,
    entryKind,
    name,
  });
  return {
    projectionKey: `${entryKind}:${entryRef ?? name}`,
    entryKind,
    name,
    entryRef,
    declarationRef: stringOrNull(event.declarationRef),
    graphFunctionRef: compactGraphFunctionRef,
    templateRef: stringOrNull(template?.ref),
    tags,
    inputTypeRefs: typeRefsFrom(parsed?.inputs),
    outputTypeRefs: typeRefsFrom(parsed?.outputs),
    declarationKeys: declarationKeysFrom(parsed?.declarations),
    admissionCount: 1,
    variantCount: 1,
    sourceEventIndexes: index === null ? [] : [index],
    sourceRef: proofPath,
    _variantFingerprints: new Set([createHash('sha256').update(fingerprintSource).digest('hex')]),
  };
}

function rejectedCatalogEntryFromEvent(event, proofPath) {
  const index = catalogEventIndex(event);
  return {
    entryKind: stringOrNull(event.entryKind) ?? 'unknown',
    entryRef: stringOrNull(event.entryRef),
    declarationRef: stringOrNull(event.declarationRef),
    rejectionReason: stringOrNull(event.rejectionReason),
    conflictingEntryRefs: stringArray(event.conflictingEntryRefs).slice(0, 80),
    sourceEventIndex: index,
    sourceRef: proofPath,
  };
}

function constructionCatalogFromEvent(event, proofPath) {
  const catalogRef = stringOrNull(event.catalogRef);
  if (!catalogRef) return null;
  const index = catalogEventIndex(event);
  return {
    catalogRef,
    episodeId: stringOrNull(event.episodeId),
    hookResolutionRef: stringOrNull(event.hookResolutionRef),
    fallbackConfigDigest: stringOrNull(event.fallbackConfigDigest),
    traversalPublicationRefs: stringArray(event.traversalPublicationRefs).slice(0, 80),
    admissionCount: 1,
    sourceEventIndexes: index === null ? [] : [index],
    sourceRef: proofPath,
  };
}

function catalogProjection(proof, proofPath) {
  const sequence = Array.isArray(proof.eventSequence) ? proof.eventSequence : [];
  const entries = new Map();
  const rejectedEntries = [];
  const constructionCatalogs = new Map();
  let admissionEventCount = 0;
  let unparsedAdmissionCount = 0;
  let rejectedEventCount = 0;
  let constructionCatalogEventCount = 0;

  for (const event of sequence) {
    if (!isRecord(event)) continue;
    if (event.kind === 'registry_entry_admitted') {
      admissionEventCount += 1;
      const candidate = catalogEntryFromEvent(event, proofPath);
      if (!candidate) {
        unparsedAdmissionCount += 1;
        continue;
      }
      const current = entries.get(candidate.projectionKey);
      if (!current) {
        entries.set(candidate.projectionKey, candidate);
        continue;
      }
      current.admissionCount += 1;
      current.sourceEventIndexes = boundedEventIndexes([...current.sourceEventIndexes, ...candidate.sourceEventIndexes]);
      for (const fingerprint of candidate._variantFingerprints) current._variantFingerprints.add(fingerprint);
      current.variantCount = current._variantFingerprints.size;
      continue;
    }
    if (event.kind === 'registry_entry_rejected') {
      rejectedEventCount += 1;
      if (rejectedEntries.length < MAX_CATALOG_REJECTIONS) {
        rejectedEntries.push(rejectedCatalogEntryFromEvent(event, proofPath));
      }
      continue;
    }
    if (event.kind === 'construction_action_catalog_projected') {
      constructionCatalogEventCount += 1;
      const candidate = constructionCatalogFromEvent(event, proofPath);
      if (!candidate) continue;
      const current = constructionCatalogs.get(candidate.catalogRef);
      if (!current) {
        constructionCatalogs.set(candidate.catalogRef, candidate);
        continue;
      }
      current.admissionCount += 1;
      current.sourceEventIndexes = boundedEventIndexes([...current.sourceEventIndexes, ...candidate.sourceEventIndexes]);
    }
  }

  const allEntries = [...entries.values()]
    .sort((left, right) => left.entryKind.localeCompare(right.entryKind) || left.name.localeCompare(right.name));
  const entryKindCounts = [...new Set(allEntries.map((entry) => entry.entryKind))]
    .sort()
    .map((kind) => ({ kind, count: allEntries.filter((entry) => entry.entryKind === kind).length }));
  const projectedEntries = allEntries.slice(0, MAX_CATALOG_ENTRIES).map(({ _variantFingerprints, ...entry }) => entry);
  const hasCatalogEvents = admissionEventCount > 0 || rejectedEventCount > 0 || constructionCatalogEventCount > 0;
  return {
    state: hasCatalogEvents ? 'ready' : 'missing',
    sourceKind: 'abg_runtime_events',
    sourceRef: proofPath,
    admissionEventCount,
    unparsedAdmissionCount,
    rejectedEventCount,
    constructionCatalogEventCount,
    entryCount: allEntries.length,
    entryKindCounts,
    entries: projectedEntries,
    rejectedEntries,
    constructionCatalogs: [...constructionCatalogs.values()].sort((left, right) => left.catalogRef.localeCompare(right.catalogRef)),
    truncated: allEntries.length > projectedEntries.length || rejectedEventCount > rejectedEntries.length,
  };
}

function findVectorArtifactDirectory(workspaceRoot) {
  const root = join(workspaceRoot, '.ai-workspace');
  if (!statOf(root)?.isDirectory()) return null;
  const queue = [root];
  let cursor = 0;
  while (cursor < queue.length && cursor < MAX_VECTOR_SCAN_DIRECTORIES) {
    const current = queue[cursor++];
    const entries = listDir(current);
    if (entries.some((entry) => entry.isFile() && VECTOR_ARTIFACT_PATTERN.test(entry.name))) return current;
    for (const entry of entries) {
      if (entry.isDirectory()) queue.push(join(current, entry.name));
    }
  }
  return null;
}

function scanVectorArtifacts(workspaceRoot, diagnostics) {
  const artifactDirectory = findVectorArtifactDirectory(workspaceRoot);
  if (!artifactDirectory) return { artifactDirectory: null, records: [] };
  const grouped = new Map();
  for (const entry of listDir(artifactDirectory)) {
    if (!entry.isFile()) continue;
    const match = VECTOR_ARTIFACT_PATTERN.exec(entry.name);
    if (!match) continue;
    const vectorIndex = Number(match[1]);
    const evaluator = Boolean(match[3]);
    const attempt = Number(match[4] ?? match[2] ?? 1);
    const record = grouped.get(vectorIndex) ?? { vectorIndex, primary: new Map(), evaluator: new Map() };
    (evaluator ? record.evaluator : record.primary).set(attempt, join(artifactDirectory, entry.name));
    grouped.set(vectorIndex, record);
  }
  const records = [];
  for (const record of [...grouped.values()].sort((left, right) => left.vectorIndex - right.vectorIndex)) {
    const attempts = [...record.primary.keys()].sort((left, right) => left - right);
    const latestAttempt = attempts.at(-1) ?? null;
    const sourceRef = latestAttempt === null ? null : record.primary.get(latestAttempt);
    const value = sourceRef ? readJson(sourceRef, MAX_VECTOR_ARTIFACT_BYTES) : null;
    if (sourceRef && !value) {
      diagnostics.push(diagnostic('warning', 'vector_artifact_unreadable', `Vector ${record.vectorIndex} latest artifact could not be read.`, sourceRef, record.vectorIndex));
    }
    records.push({
      vectorIndex: record.vectorIndex,
      attemptCount: Math.max(record.primary.size, 1),
      hasEvaluator: record.evaluator.size > 0,
      sourceRef,
      value: isRecord(value) ? value : {},
    });
  }
  return { artifactDirectory, records };
}

function stageRows(vectorRecords) {
  return vectorRecords.map((record) => {
    const artifact = record.value;
    const plan = isRecord(artifact.stagePlan) ? artifact.stagePlan : {};
    const assessment = isRecord(artifact.assessment) ? artifact.assessment : {};
    const timing = isRecord(artifact.timing) && isRecord(artifact.timing.dispatch) ? artifact.timing.dispatch : {};
    const workerTrace = isRecord(artifact.timing) && isRecord(artifact.timing.workerTrace) ? artifact.timing.workerTrace : {};
    const accepted = typeof assessment.accepted === 'boolean' ? assessment.accepted : null;
    return {
      vectorIndex: record.vectorIndex,
      edge: stringOrNull(artifact.edge),
      stage: stringOrNull(artifact.stage),
      sourceTypeRef: stringOrNull(plan.sourceTypeRef),
      targetTypeRef: stringOrNull(plan.targetTypeRef),
      status: accepted === true ? 'accepted' : accepted === false ? 'rejected' : 'pending',
      attemptCount: record.attemptCount,
      hasEvaluator: record.hasEvaluator,
      startedAt: stringOrNull(timing.startedAt),
      endedAt: stringOrNull(timing.endedAt),
      durationMs: numberOrNull(timing.durationMs),
      processEventRef: stringOrNull(workerTrace.eventsPath),
      sourceRef: record.sourceRef,
    };
  });
}

function assetRows(vectorRecords) {
  const rows = [];
  for (const record of vectorRecords) {
    const artifact = record.value;
    const plan = isRecord(artifact.stagePlan) ? artifact.stagePlan : {};
    const candidates = Array.isArray(artifact.materializedFileSummaries)
      ? artifact.materializedFileSummaries
      : isRecord(artifact.candidateEvidence) && Array.isArray(artifact.candidateEvidence.materializedFiles)
        ? artifact.candidateEvidence.materializedFiles
        : [];
    for (const file of candidates) {
      if (!isRecord(file) || typeof file.path !== 'string') continue;
      rows.push({
        path: file.path,
        producerVectorIndex: record.vectorIndex,
        producerStage: stringOrNull(artifact.stage),
        targetTypeRef: stringOrNull(plan.targetTypeRef),
        sha256: stringOrNull(file.sha256),
        byteLength: numberOrNull(file.byteLength),
        lineCount: numberOrNull(file.lineCount),
        sourceRef: record.sourceRef ?? '',
      });
      if (rows.length >= MAX_ASSETS) return rows;
    }
  }
  return rows;
}

function cappedTranscript(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (!text) return { contentPreview: '', truncated: false };
  return {
    contentPreview: text.slice(0, MAX_TRANSCRIPT_CHARS),
    truncated: text.length > MAX_TRANSCRIPT_CHARS,
  };
}

function transcriptRows(proof, vectorRecords, proofPath) {
  const rows = [];
  if (proof.startOutput !== undefined) {
    const safeStartOutput = isRecord(proof.startOutput)
      ? Object.fromEntries(Object.entries(proof.startOutput).filter(([key]) => key !== 'event_kinds'))
      : proof.startOutput;
    const preview = cappedTranscript(safeStartOutput);
    rows.push({ transcriptId: 'startup', kind: 'startup', label: 'Startup result', ...preview, sourceRef: proofPath, vectorIndex: null });
  }
  for (const record of vectorRecords) {
    const stdout = stringOrNull(record.value.stdout);
    if (stdout) {
      const preview = cappedTranscript(stdout);
      rows.push({
        transcriptId: `vector-${record.vectorIndex}-stdout`,
        kind: 'stdout',
        label: `Vector ${record.vectorIndex} stdout`,
        ...preview,
        sourceRef: record.sourceRef ?? '',
        vectorIndex: record.vectorIndex,
      });
    }
    const workerTrace = isRecord(record.value.timing) && isRecord(record.value.timing.workerTrace)
      ? record.value.timing.workerTrace
      : null;
    if (workerTrace && stringOrNull(workerTrace.eventsPath)) {
      const preview = cappedTranscript({
        eventCount: numberOrNull(workerTrace.eventCount),
        eventKinds: stringArray(workerTrace.eventKinds),
        timing: workerTrace.timing ?? null,
      });
      rows.push({
        transcriptId: `vector-${record.vectorIndex}-trace`,
        kind: 'process_trace',
        label: `Vector ${record.vectorIndex} process trace`,
        ...preview,
        sourceRef: workerTrace.eventsPath,
        vectorIndex: record.vectorIndex,
      });
    }
    if (rows.length >= MAX_TRANSCRIPTS) break;
  }
  return rows.slice(0, MAX_TRANSCRIPTS);
}

function auxiliaryPath(run, name) {
  for (const root of [run.workspaceRoot, run.runRoot]) {
    const path = join(root, name);
    if (existsSync(path)) return path;
  }
  return null;
}

function assuranceSummary(run, proof, eventCounts) {
  const test = readJson(auxiliaryPath(run, 'test-execution-result.json'));
  const depth = readJson(auxiliaryPath(run, 'depth-proof-map.json'));
  const mutation = readJson(auxiliaryPath(run, 'mutation-outcomes.json'));
  const requirements = isRecord(proof.requirementLineageCanary) && Array.isArray(proof.requirementLineageCanary.requirements)
    ? proof.requirementLineageCanary.requirements
    : [];
  const depthRows = isRecord(depth) && Array.isArray(depth.rows) ? depth.rows : [];
  const mutationRows = isRecord(mutation) && Array.isArray(mutation.rows) ? mutation.rows : [];
  return {
    evidenceAdmittedCount: numberOrNull(eventCounts.evidence_admitted) ?? 0,
    payloadObservedCount: numberOrNull(eventCounts.payload_observed) ?? 0,
    payloadValidatedCount: numberOrNull(eventCounts.payload_validated) ?? 0,
    judgedCallCount: numberOrNull(eventCounts.c_call_judged) ?? 0,
    requirementCount: requirements.length,
    requirementReachedCount: requirements.filter((row) => isRecord(row) && Array.isArray(row.reachedVectorIndexes) && row.reachedVectorIndexes.length > 0).length,
    testStatus: isRecord(test) ? numberOrNull(test.status) : null,
    testPassCount: isRecord(test) ? numberOrNull(test.observedTestPassCount) : null,
    testReports: isRecord(test) && Array.isArray(test.observedTestReports)
      ? test.observedTestReports.filter(isRecord).slice(0, 100).map((row) => ({
          path: stringOrNull(row.path) ?? 'unknown',
          tests: numberOrNull(row.tests) ?? 0,
          failures: numberOrNull(row.failures) ?? 0,
          errors: numberOrNull(row.errors) ?? 0,
          skipped: numberOrNull(row.skipped) ?? 0,
        }))
      : [],
    depthProofRowCount: depthRows.length,
    depthClasses: [...new Set(depthRows.map((row) => isRecord(row) ? stringOrNull(row.depthClassRef) : null).filter(Boolean))].sort(),
    mutationCount: mutationRows.length,
    mutationKillCount: mutationRows.filter((row) => {
      const suiteExit = isRecord(row) ? numberOrNull(row.suiteExit) : null;
      return suiteExit !== null && suiteExit !== 0;
    }).length,
    mutationRestoreMismatchCount: mutationRows.filter((row) => isRecord(row) && stringOrNull(row.baselineDigest) !== stringOrNull(row.restoreDigest)).length,
  };
}

function systemReferences(proof, proofPath) {
  const definitions = [
    ['graph', proof.graphRef],
    ['graph_function', proof.graphFunctionRef],
    ['overlay', proof.overlayRef],
    ['startup', proof.startupConfigRef],
    ['event_digest', proof.eventLogSha256 ?? proof.eventLogDigest],
    ['runtime_binding', proof.runtimeBindingPath],
  ];
  return definitions
    .filter(([, ref]) => typeof ref === 'string' && ref.trim())
    .map(([kind, ref]) => ({ kind, ref, sourceRef: proofPath }));
}

function functionRows(proof, eventCounts, stages, proofPath) {
  const ref = stringOrNull(proof.graphFunctionRef);
  if (!ref) return [];
  return [{
    graphFunctionRef: ref,
    selectedCount: numberOrNull(eventCounts.graph_function_selected) ?? 0,
    callCount: numberOrNull(eventCounts.graph_call_opened) ?? 0,
    frameCount: numberOrNull(eventCounts.frame_opened) ?? 0,
    vectorIndexes: stages.map((stage) => stage.vectorIndex),
    sourceRef: proofPath,
  }];
}

function artifactRole(path, proofPath, identityPath) {
  if (path === proofPath) return 'proof';
  if (path === identityPath) return 'identity';
  const base = basename(path).toLowerCase();
  if (base.includes('event') && base.endsWith('.jsonl')) return 'event_log';
  if (base === 'test-execution-result.json' || base === 'sandbox-summary.json') return 'test_result';
  if (base === 'depth-proof-map.json') return 'depth_proof';
  if (base === 'mutation-outcomes.json') return 'mutation_outcomes';
  return 'other';
}

function artifactReferences(run, proof, vectorArtifactDirectory) {
  const paths = [...run.artifactPaths];
  const eventLogPaths = [];
  for (const root of [run.workspaceRoot, run.runRoot, run.projectRoot]) {
    const eventLogCandidate = join(root ?? '', '.ai-workspace', 'events', 'events.jsonl');
    if (eventLogCandidate && existsSync(eventLogCandidate)) {
      eventLogPaths.push(eventLogCandidate);
      paths.push(eventLogCandidate);
    }
  }
  // A proof declares one event-log digest. Bind it to the closest admitted
  // carrier for the selected run, not to unrelated Project-level ledgers.
  const declaredEventLogPath = eventLogPaths[0] ?? null;
  const expectedEventDigest = stringOrNull(proof.eventLogSha256 ?? proof.eventLogDigest);
  const rows = [...new Set(paths)].map((path) => {
    const stats = statOf(path);
    const role = artifactRole(path, run.proofPath, run.identityPath);
    const digest = role === 'event_log'
      ? digestObservation(path, path === declaredEventLogPath ? expectedEventDigest : null, stats)
      : { digest: null, observedDigest: null, digestState: 'not_applicable' };
    return {
      role,
      label: basename(path),
      path,
      state: stats ? 'present' : 'missing',
      sizeBytes: stats?.isFile() ? stats.size : null,
      modifiedAt: stats ? stats.mtime.toISOString() : null,
      ...digest,
    };
  });
  if (vectorArtifactDirectory) {
    const stats = statOf(vectorArtifactDirectory);
    rows.push({
      role: 'vector_artifacts',
      label: 'Vector artifacts',
      path: vectorArtifactDirectory,
      state: stats ? 'present' : 'missing',
      sizeBytes: null,
      modifiedAt: stats ? stats.mtime.toISOString() : null,
      digest: null,
      observedDigest: null,
      digestState: 'not_applicable',
    });
  }
  return rows;
}

function substrateOf(value) {
  if (!isRecord(value)) return null;
  return {
    productId: stringOrNull(value.productId),
    packageName: stringOrNull(value.packageName),
    packageVersion: stringOrNull(value.packageVersion),
    releaseTag: stringOrNull(value.releaseTag),
    sourceCommit: stringOrNull(value.sourceCommit),
  };
}

function activityOf(run, proof, counts, stages) {
  const sequence = Array.isArray(proof.eventSequence) ? proof.eventSequence : [];
  const first = sequence[0];
  const last = sequence.at(-1);
  const plannedIndexes = sequence
    .filter((event) => isRecord(event) && event.kind === 'vector_traversal_planned')
    .map((event) => numberOrNull(event.vectorIndex))
    .filter((value) => value !== null);
  const evaluatedIndexes = new Set(sequence
    .filter((event) => isRecord(event) && event.kind === 'vector_evaluated')
    .map((event) => numberOrNull(event.vectorIndex))
    .filter((value) => value !== null));
  const activeIndexes = plannedIndexes.filter((index) => !evaluatedIndexes.has(index));
  const currentVectorIndex = activeIndexes.length > 0
    ? Math.max(...activeIndexes)
    : stages.length > 0
      ? Math.max(...stages.map((stage) => stage.vectorIndex))
      : null;
  return {
    status: run.status,
    eventCount: sequence.length,
    eventKindCount: Object.keys(counts).length,
    vectorPlannedCount: numberOrNull(counts.vector_traversal_planned) ?? 0,
    vectorEvaluatedCount: numberOrNull(counts.vector_evaluated) ?? 0,
    vectorClosedCount: numberOrNull(counts.vector_closed) ?? 0,
    retryCount: numberOrNull(counts.retry_attempt_opened) ?? 0,
    continuationCount: (numberOrNull(counts.continuation_reopened) ?? 0) + (numberOrNull(counts.continuation_terminated) ?? 0),
    terminalCount: numberOrNull(counts.terminal_reached) ?? 0,
    currentVectorIndex,
    startedAt: stringOrNull(first?.eventTime),
    lastEventAt: stringOrNull(last?.eventTime),
    durationMs: numberOrNull(proof.campaignDurationMs) ?? numberOrNull(proof.durationMs),
  };
}

export function loadAbgRunObservation(projectRootInput, options = {}) {
  const topology = discoverProjectObservationTopology(projectRootInput, { refresh: options.refresh === true });
  const diagnostics = [...topology.diagnostics];
  const run = selectObservationRun(topology, options.runId ?? null);
  if (!run) {
    if (options.runId) diagnostics.push(diagnostic('warning', 'selected_run_missing', `Run ${options.runId} is not present in the Project topology.`));
    return emptyObservation(topology, 'unsupported', diagnostics);
  }
  const proof = loadObservationRunProof(run);
  if (!isRecord(proof)) {
    diagnostics.push(diagnostic('error', 'run_proof_unreadable', 'The selected run proof could not be admitted.', run.proofPath));
    return emptyObservation(topology, 'error', diagnostics);
  }
  run.projectRoot = topology.projectRoot;
  const vectorScan = scanVectorArtifacts(run.workspaceRoot, diagnostics);
  const stages = stageRows(vectorScan.records);
  const counts = eventCountsOf(proof);
  const activity = activityOf(run, proof, counts, stages);
  const catalog = catalogProjection(proof, run.proofPath);
  if (activity.vectorPlannedCount > activity.vectorEvaluatedCount) {
    diagnostics.push(diagnostic('info', 'run_has_active_vector', `${activity.vectorPlannedCount - activity.vectorEvaluatedCount} planned vector invocation(s) remain unevaluated.`));
  }
  if (activity.vectorEvaluatedCount > activity.vectorClosedCount) {
    diagnostics.push(diagnostic('info', 'run_has_open_closure', `${activity.vectorEvaluatedCount - activity.vectorClosedCount} evaluated vector invocation(s) remain unclosed.`));
  }
  if (activity.retryCount > 0) {
    diagnostics.push(diagnostic('info', 'run_contains_retries', `${activity.retryCount} retry attempt(s) are admitted by the event carrier.`));
  }
  if (catalog.unparsedAdmissionCount > 0) {
    diagnostics.push(diagnostic('warning', 'catalog_admission_unparsed', `${catalog.unparsedAdmissionCount} registry admission event(s) lacked a projectable catalog identity.`, run.proofPath));
  }
  if (catalog.truncated) {
    diagnostics.push(diagnostic('warning', 'catalog_projection_truncated', 'The ABG catalog projection exceeded its bounded row limit.', run.proofPath));
  }
  return {
    kind: 'abg_run_observation',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    state: 'ready',
    projectRoot: topology.projectRoot,
    identity: identityProjection(topology.identity),
    runs: topology.runs.map(runSummary),
    selectedRunId: run.runId,
    selectedRunRoot: run.runRoot,
    selectedWorkspaceRoot: run.workspaceRoot,
    systemReferences: systemReferences(proof, run.proofPath),
    substrate: substrateOf(proof.substrate),
    activity,
    functions: functionRows(proof, counts, stages, run.proofPath),
    catalog,
    assets: assetRows(vectorScan.records),
    assurance: assuranceSummary(run, proof, counts),
    eventKinds: eventKindRows(counts),
    events: boundedEventRows(proof.eventSequence),
    stages,
    transcripts: transcriptRows(proof, vectorScan.records, run.proofPath),
    artifacts: artifactReferences(run, proof, vectorScan.artifactDirectory),
    diagnostics,
  };
}
