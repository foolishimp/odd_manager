import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  discoverProjectObservationTopology,
  loadObservationRunProof,
  selectObservationRun,
} from './project-observation-topology-service.mjs';
import {
  abgEventCarrierSnapshot,
  abgEventSequence,
  detailAbgEventCarrier,
  indexAbgEventCarrier, scopeAbgEventCarrier,
  pageAbgEventCarrier,
  reconcileAbgProof,
} from './abg-event-carrier-service.mjs';

const VERSION = 3;
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
    runKey: run.runKey,
    runRoot: run.runRoot,
    workspaceRoot: run.workspaceRoot,
    scenarioId: run.scenarioId,
    observationLabel: run.observationLabel ?? null,
    scenarioKind: run.scenarioKind,
    proofClass: run.proofClass,
    graphFunctionRef: run.graphFunctionRef,
    status: run.status,
    modifiedAt: run.modifiedAt,
    lastEventAt: run.lastEventAt,
    eventCount: run.eventCount,
    eventPosture: run.eventPosture,
    eventProfile: run.eventProfile,
  };
}

function projectedRunCandidates(topology, selectedRun = null) {
  const explicit = topology.runs.filter((run) => run.requiresExplicitSelection === true);
  const family = explicit.length === 0
    ? topology.runs
    : !selectedRun || selectedRun.requiresExplicitSelection === true
      ? explicit
      : topology.runs.filter((run) => run.requiresExplicitSelection !== true);
  const counts = new Map();
  for (const run of family) counts.set(run.runId, (counts.get(run.runId) ?? 0) + 1);
  return family.filter((run) => counts.get(run.runId) === 1);
}

function emptyObservation(topology, state, diagnostics) {
  return {
    kind: 'abg_run_observation',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    state,
    projectRoot: topology.projectRoot,
    identity: identityProjection(topology.identity),
    runs: projectedRunCandidates(topology).map(runSummary),
    selectedRunId: null,
    selectedRunKey: null,
    selectedRunRoot: null,
    selectedWorkspaceRoot: null,
    carrierSnapshot: null,
    eventPosture: 'invalid',
    processPosture: 'unavailable',
    runtimeState: null,
    retainedObservation: null,
    proofReconciliation: { state: 'absent', sourceRef: null, conflicts: [], eventCount: null, eventDigest: null },
    compatibility: { posture: 'unknown', subject: null, reason: 'no admitted run event carrier' },
    systemReferences: [],
    substrate: null,
    activity: null,
    functions: [],
    catalog: emptyCatalogProjection(null),
    assets: [],
    assurance: null,
    eventKinds: [],
    events: [],
    eventPage: null,
    eventFamilies: emptyEventFamilies(),
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

const EVENT_FAMILY_MATCHERS = Object.freeze({
  run: /^(run_|graph_call_|frame_|terminal_)/u,
  retryContinuation: /^(retry_|continuation_)/u,
  actor: /^actor_/u,
  cCall: /^c_call_/u,
  payloadIntegrity: /(payload|response_contract|instruction|artifact_content)/u,
  assurance: /(requirement|authority|ambiguity|closure_input|evidence|assess|temporal|verdict)/u,
});

function emptyEventFamilies() {
  return Object.fromEntries(Object.keys(EVENT_FAMILY_MATCHERS).map((key) => [key, {
    eventCount: 0,
    kindCounts: [],
    rows: [],
    truncated: false,
  }]));
}

function eventFamilyProjection(sequence) {
  const projected = emptyEventFamilies();
  for (const [family, matcher] of Object.entries(EVENT_FAMILY_MATCHERS)) {
    const matching = sequence.filter((event) => isRecord(event) && matcher.test(event.kind));
    const counts = {};
    for (const event of matching) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
    const bounded = matching.length <= 12
      ? matching
      : [...matching.slice(0, 4), ...matching.slice(-8)];
    projected[family] = {
      eventCount: matching.length,
      kindCounts: eventKindRows(counts),
      rows: bounded.map((event) => ({
        ordinal: numberOrNull(event.sourceOrdinal) ?? numberOrNull(event.index) ?? 0,
        eventId: stringOrNull(event.eventId) ?? 'unknown',
        kind: stringOrNull(event.kind) ?? 'unknown',
        eventTime: stringOrNull(event.eventTime),
        graphCallId: stringOrNull(event.graphCallId),
        frameId: stringOrNull(event.frameId),
        vectorIndex: numberOrNull(event.vectorIndex),
        cCallRef: stringOrNull(event.cCallRef),
        actorInvocationRef: stringOrNull(event.actorInvocationRef),
        causationEventRefs: stringArray(event.causationEventRefs).slice(0, 80),
      })),
      truncated: matching.length > bounded.length,
    };
  }
  return projected;
}

function semanticVectorProjection(sequence) {
  const vectors = new Map();
  let invocationAttemptCount = 0;
  for (const event of sequence) {
    if (!isRecord(event)) continue;
    if (!['vector_traversal_planned', 'vector_evaluated', 'vector_closed'].includes(event.kind)) continue;
    const vectorIndex = numberOrNull(event.vectorIndex);
    if (vectorIndex === null) continue;
    const key = [
      stringOrNull(event.frameLineageId) ?? stringOrNull(event.frameId) ?? 'frame:unknown',
      `vector:${vectorIndex}`,
    ].join('|');
    const row = vectors.get(key) ?? {
      key,
      vectorIndex,
      plannedCount: 0,
      evaluatedCount: 0,
      closedCount: 0,
      retryCount: 0,
      firstOrdinal: numberOrNull(event.sourceOrdinal) ?? numberOrNull(event.index),
      lastOrdinal: numberOrNull(event.sourceOrdinal) ?? numberOrNull(event.index),
    };
    row.lastOrdinal = numberOrNull(event.sourceOrdinal) ?? numberOrNull(event.index);
    if (event.kind === 'vector_traversal_planned') {
      row.plannedCount += 1;
      invocationAttemptCount += 1;
    }
    if (event.kind === 'vector_evaluated') row.evaluatedCount += 1;
    if (event.kind === 'vector_closed') row.closedCount += 1;
    vectors.set(key, row);
  }
  const rows = [...vectors.values()].filter((row) => row.plannedCount > 0 || row.evaluatedCount > 0 || row.closedCount > 0);
  const openRows = rows.filter((row) => row.closedCount === 0);
  return {
    semanticVectorCount: rows.length,
    invocationAttemptCount,
    openSemanticVectorCount: openRows.length,
    currentVectorIndex: openRows.map((row) => row.vectorIndex).filter((value) => value !== null).at(-1) ?? null,
  };
}

function compatibilityProjection(run, eventIndex, proofReconciliation) {
  const substrate = isRecord(run.substrate) ? substrateOf(run.substrate) : null;
  if (eventIndex.state !== 'ready' || (run.eventPrefixLength !== undefined && (eventIndex.completePrefixBytes !== run.eventPrefixLength || eventIndex.completePrefixDigest !== run.eventPrefixDigest))) {
    return { posture: 'invalid_carrier', subject: substrate, reason: 'the event carrier did not admit a stable valid prefix' };
  }
  if (proofReconciliation.state === 'conflict') {
    return { posture: 'proof_conflict', subject: substrate, reason: 'terminal proof conflicts with the admitted event carrier' };
  }
  if (run.carrierKind === 'retained_published_run_observation' && eventIndex.contractPosture === 'stamped_profile_validated') return { posture: 'retained_profile_validated', subject: substrate, reason: 'Exact retained profile and prefix admitted; broader Product compatibility remains unqualified.' };
  if (eventIndex.envelopeProfile === 'abiogenesis_5_root') {
    const exactIdentity = substrate?.packageName === '@abiogenesis/typescript-tenant'
      && substrate?.packageVersion?.startsWith('5.0.0');
    return exactIdentity && eventIndex.contractPosture === 'pinned_root_envelope_verified'
      ? { posture: 'abiogenesis_5_root_envelope_supported', subject: substrate, reason: 'exact 5.0 identity and pinned root-envelope integrity were admitted' }
      : { posture: 'abiogenesis_5_identity_unconfirmed', subject: substrate, reason: '5.0 envelope was observed without an exact supported substrate identity or root-kind registry' };
  }
  if (eventIndex.envelopeProfile === 'abiogenesis_4_6_flat') {
    return { posture: 'abiogenesis_4_6_legacy_supported', subject: substrate, reason: 'legacy flat envelope is retained as an explicit compatibility profile' };
  }
  return { posture: 'unknown', subject: substrate, reason: 'event envelope profile is not supported' };
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
    snapshotCommit: stringOrNull(value.snapshotCommit),
    tarballSha256: stringOrNull(value.tarballSha256),
    productToolchainManifestDigest: stringOrNull(value.productToolchainManifestDigest),
    releaseSnapshotManifestSha256: stringOrNull(value.releaseSnapshotManifestSha256),
  };
}

function activityOf(run, projection, counts) {
  const sequence = Array.isArray(projection.eventSequence) ? projection.eventSequence : [];
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
  const semantic = semanticVectorProjection(sequence);
  const activeIndexes = plannedIndexes.filter((index) => !evaluatedIndexes.has(index));
  const currentVectorIndex = semantic.currentVectorIndex
    ?? (activeIndexes.length > 0 ? Math.max(...activeIndexes) : null);
  const semanticCountersAvailable = run.carrierKind !== 'retained_published_run_observation';
  return {
    status: run.status,
    eventCount: sequence.length,
    eventKindCount: Object.keys(counts).length,
    vectorPlannedCount: semanticCountersAvailable ? (numberOrNull(counts.vector_traversal_planned) ?? 0) : null,
    vectorEvaluatedCount: semanticCountersAvailable ? (numberOrNull(counts.vector_evaluated) ?? 0) : null,
    vectorClosedCount: semanticCountersAvailable ? (numberOrNull(counts.vector_closed) ?? 0) : null,
    semanticVectorCount: semanticCountersAvailable ? (semantic.semanticVectorCount) : null,
    vectorAttemptCount: semanticCountersAvailable ? (semantic.invocationAttemptCount) : null,
    openSemanticVectorCount: semanticCountersAvailable ? (semantic.openSemanticVectorCount) : null,
    retryCount: semanticCountersAvailable ? (numberOrNull(counts.retry_attempt_opened) ?? 0) : null,
    continuationCount: semanticCountersAvailable ? ((numberOrNull(counts.continuation_reopened) ?? 0) + (numberOrNull(counts.continuation_terminated) ?? 0)) : null,
    terminalCount: numberOrNull(counts.terminal_reached) ?? 0,
    currentVectorIndex,
    startedAt: stringOrNull(first?.eventTime),
    lastEventAt: stringOrNull(last?.eventTime),
    durationMs: numberOrNull(projection.campaignDurationMs)
      ?? numberOrNull(projection.durationMs)
      ?? (first && last ? Math.max(0, Date.parse(last.eventTime) - Date.parse(first.eventTime)) : null),
  };
}

function eventIndexOptions(run, refresh) {
  return {
    refresh,
    ...(run.eventContractDigest
      ? { publishedEventContractDigest: run.eventContractDigest }
      : {}),
    ...(run.eventContractBindingPosture
      ? { contractBindingPosture: run.eventContractBindingPosture }
      : {}),
  };
}

export function loadAbgRunObservation(projectRootInput, options = {}) {
  const topology = discoverProjectObservationTopology(projectRootInput, { refresh: options.refresh === true });
  const diagnostics = [...topology.diagnostics];
  const requestedRunId = typeof options.runId === 'string' && options.runId.trim()
    ? options.runId.trim()
    : null;
  const implicitSelectionDisabled = requestedRunId === null && options.allowImplicitSelection === false;
  const run = implicitSelectionDisabled ? null : selectObservationRun(topology, requestedRunId);
  if (!run) {
    if (requestedRunId) {
      diagnostics.push(diagnostic('warning', 'selected_run_missing', `Run ${requestedRunId} is not present in the Project topology.`));
    } else if (implicitSelectionDisabled && topology.runs.length > 0) {
      diagnostics.push(diagnostic(
        'info',
        'run_selection_required',
        'Run discovery published candidates without inferring a default or latest selection.',
      ));
    }
    return emptyObservation(topology, 'unsupported', diagnostics);
  }
  const ledgerIndex = indexAbgEventCarrier(
    run.eventPath,
    eventIndexOptions(run, options.refresh === true),
  );
  const eventIndex = run.carrierKind === 'retained_published_run_observation' ? scopeAbgEventCarrier(ledgerIndex, run.runId) : ledgerIndex;
  diagnostics.push(...eventIndex.diagnostics);
  if (eventIndex.state !== 'ready' || (run.eventPrefixLength !== undefined && (eventIndex.completePrefixBytes !== run.eventPrefixLength || eventIndex.completePrefixDigest !== run.eventPrefixDigest))) {
    diagnostics.push(diagnostic('error', 'run_event_carrier_unreadable', 'The selected run event carrier could not be admitted.', run.eventPath));
    return emptyObservation(topology, 'error', diagnostics);
  }
  const proof = loadObservationRunProof(run);
  const proofReconciliation = run.proofState === 'unreadable'
    ? {
        state: 'unreadable',
        sourceRef: run.proofPath,
        conflicts: [run.proofError?.message ?? 'proof carrier is unreadable'],
        eventCount: null,
        eventDigest: null,
      }
    : reconcileAbgProof(eventIndex, proof, run.identity, run.proofPath);
  if (proofReconciliation.state === 'unreadable') {
    diagnostics.push(diagnostic('warning', 'run_proof_unreadable', proofReconciliation.conflicts.join('; '), run.proofPath ?? run.eventPath));
  }
  if (proofReconciliation.state === 'conflict') {
    diagnostics.push(diagnostic('error', 'run_proof_conflict', proofReconciliation.conflicts.join('; '), run.proofPath ?? run.eventPath));
  }
  const admittedProof = proofReconciliation.state === 'reconciled' && isRecord(proof) ? proof : {};
  const sequence = abgEventSequence(eventIndex);
  const counts = { ...eventIndex.counts };
  const projection = {
    ...admittedProof,
    graphRef: run.graphRef,
    graphFunctionRef: run.graphFunctionRef,
    overlayRef: run.overlayRef,
    startupConfigRef: run.startupConfigRef,
    substrate: run.substrate,
    eventCounts: counts,
    eventSequence: sequence,
  };
  run.projectRoot = topology.projectRoot;
  const vectorScan = scanVectorArtifacts(run.workspaceRoot, diagnostics);
  const stages = stageRows(vectorScan.records);
  const activity = activityOf(run, projection, counts);
  const catalog = catalogProjection(projection, run.eventPath);
  if (activity.openSemanticVectorCount > 0 && eventIndex.eventPosture === 'non_terminal') {
    diagnostics.push(diagnostic('info', 'run_has_active_vector', `${activity.openSemanticVectorCount} semantic vector(s) remain open in the admitted non-terminal prefix.`));
  }
  if (activity.retryCount > 0) {
    diagnostics.push(diagnostic('info', 'run_contains_retries', `${activity.retryCount} retry attempt(s) are admitted by the event carrier.`));
  }
  if (catalog.unparsedAdmissionCount > 0) {
    diagnostics.push(diagnostic('warning', 'catalog_admission_unparsed', `${catalog.unparsedAdmissionCount} registry admission event(s) lacked a projectable catalog identity.`, run.eventPath));
  }
  if (catalog.truncated) {
    diagnostics.push(diagnostic('warning', 'catalog_projection_truncated', 'The ABG catalog projection exceeded its bounded row limit.', run.eventPath));
  }
  const initialPage = pageAbgEventCarrier(eventIndex, { start: 0, limit: 40 }).page;
  const legacyEventRows = initialPage.rows.map((event) => ({
    index: event.index,
    kind: event.kind,
    eventTime: event.eventTime,
    vectorIndex: event.vectorIndex,
    edge: event.edge,
    graphFunctionRef: null,
    detail: event.detail,
  }));
  return {
    kind: 'abg_run_observation',
    version: VERSION,
    generatedAt: new Date().toISOString(),
    state: 'ready',
    projectRoot: topology.projectRoot,
    identity: identityProjection(topology.identity),
    runs: projectedRunCandidates(topology, run).map(runSummary),
    selectedRunId: run.runId,
    selectedRunKey: run.runKey,
    selectedRunRoot: run.runRoot,
    selectedWorkspaceRoot: run.workspaceRoot,
    carrierSnapshot: abgEventCarrierSnapshot(eventIndex),
    eventPosture: eventIndex.eventPosture,
    processPosture: 'unavailable',
    runtimeState: run.runtimeState ?? null,
    retainedObservation: run.retainedObservation ?? null,
    proofReconciliation,
    compatibility: compatibilityProjection(run, eventIndex, proofReconciliation),
    systemReferences: systemReferences({
      ...projection,
      eventLogSha256: eventIndex.completePrefixDigest,
    }, run.eventPath),
    substrate: substrateOf(run.substrate),
    activity,
    functions: functionRows(projection, counts, stages, run.eventPath),
    catalog,
    assets: assetRows(vectorScan.records),
    assurance: assuranceSummary(run, admittedProof, counts),
    eventKinds: eventKindRows(counts),
    events: legacyEventRows,
    eventPage: initialPage,
    eventFamilies: eventFamilyProjection(sequence),
    stages,
    transcripts: transcriptRows(admittedProof, vectorScan.records, run.proofPath ?? run.eventPath),
    artifacts: artifactReferences(run, {
      ...admittedProof,
      eventLogSha256: isRecord(proof) ? stringOrNull(proof.eventLogSha256 ?? proof.eventLogDigest) : null,
    }, vectorScan.artifactDirectory),
    diagnostics,
  };
}

function selectedEventIndex(projectRootInput, options = {}) {
  const topology = discoverProjectObservationTopology(projectRootInput, { refresh: options.refresh === true });
  const run = selectObservationRun(topology, options.runId ?? null);
  if (!run) return { ok: false, code: 'selected_run_missing', error: 'selected run is not present in the Project topology' };
  const ledger = indexAbgEventCarrier(
    run.eventPath,
    eventIndexOptions(run, options.refresh === true),
  );
  const index = run.carrierKind === 'retained_published_run_observation' ? scopeAbgEventCarrier(ledger, run.runId) : ledger;
  if (index.state !== 'ready') return { ok: false, code: 'event_carrier_invalid', error: 'selected run event carrier is invalid' };
  if (run.eventPrefixLength !== undefined && (index.completePrefixBytes !== run.eventPrefixLength || index.completePrefixDigest !== run.eventPrefixDigest)) return { ok: false, code: 'stale_event_generation', error: 'retained prefix changed after topology admission' };
  return { ok: true, run, index };
}

export function loadAbgRunEventPage(projectRootInput, options = {}) {
  const selected = selectedEventIndex(projectRootInput, options);
  if (!selected.ok) return selected;
  return pageAbgEventCarrier(selected.index, {
    start: options.start,
    limit: options.limit,
    generation: options.generation,
  });
}

export function loadAbgRunEventDetail(projectRootInput, options = {}) {
  const selected = selectedEventIndex(projectRootInput, options);
  if (!selected.ok) return selected;
  return detailAbgEventCarrier(selected.index, {
    ordinal: options.ordinal,
    generation: options.generation,
  });
}
