import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detectPublishedWorkspaceIdentity } from './workspace-identity-service.mjs';
import { indexAbgEventCarrier } from './abg-event-carrier-service.mjs';
import { probeRetainedRunRoot } from './retained-run-observation-service.mjs';
import { parseStrictJson } from './strict-json-service.mjs';

const DEFAULT_MAX_DISCOVERY_DIRECTORIES = 20000;
const DEFAULT_MAX_RUNS = 120;
const DEFAULT_MAX_CARRIER_DEPTH = 7;
const DEFAULT_MAX_RUN_DEPTH = 7;
const DEFAULT_MAX_PROOF_BYTES = 32 * 1024 * 1024;
const DISCOVERY_CACHE_TTL_MS = 3000;
const MAX_DISCOVERY_DIAGNOSTICS = 240;
const GENERIC_EVIDENCE_CANDIDATE_NAME = 'generic-live-workflow-evidence-candidate.json';

const CARRIER_NAMES = new Set(['test_runs', 'proof_inputs', 'runs', 'run_archives']);
const IGNORED_NAMES = new Set([
  '.git', '.venv', '__pycache__', 'coverage', 'dist', 'node_modules',
  'site-packages', 'target', '.metals', '.bloop', '.idea',
]);
const RUN_AUXILIARY_FILES = [
  'sandbox-identity.json',
  'test-execution-result.json',
  'depth-proof-map.json',
  'mutation-outcomes.json',
  'sandbox-summary.json',
];

const topologyCache = new Map();

function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function sameFileStats(left, right) {
  return Boolean(left && right)
    && left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

function isDirectory(path) {
  return Boolean(statOf(path)?.isDirectory());
}

function listDir(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function boundedJson(path, maxBytes = DEFAULT_MAX_PROOF_BYTES) {
  const before = statOf(path);
  if (!before?.isFile()) return null;
  if (before.size > maxBytes) return null;
  try {
    const source = readFileSync(path, 'utf8');
    const after = statOf(path);
    if (!sameFileStats(before, after)) {
      return {
        value: null,
        source: null,
        stats: after ?? before,
        error: {
          code: 'changed_during_read',
          message: 'JSON carrier changed while it was being read',
        },
      };
    }
    return { value: parseStrictJson(source), source, stats: after, error: null };
  } catch (error) {
    return {
      value: null,
      source: null,
      stats: before,
      error: {
        code: error?.code === 'duplicate_json_key' ? 'duplicate_json_key' : 'invalid_json',
        message: error instanceof Error ? error.message : 'invalid JSON',
      },
    };
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function boundedStringOrNull(value, maxBytes) {
  const selected = stringOrNull(value);
  return selected && Buffer.byteLength(selected) <= maxBytes ? selected : null;
}

function statusTokenOrNull(value, maxBytes = 80) {
  const selected = boundedStringOrNull(value, maxBytes);
  return selected && /^[a-z][a-z0-9_]*$/u.test(selected) ? selected : null;
}

function identifierTokenOrNull(value, maxBytes) {
  const selected = boundedStringOrNull(value, maxBytes);
  return selected && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(selected) ? selected : null;
}

function logicalRefOrNull(value) {
  const ref = boundedStringOrNull(value, 4096);
  return ref
    && /^(?:[a-z][a-z0-9+.-]*:(?:\/\/)?[^\s]+|[a-z][a-z0-9._-]+@[0-9]+)$/iu.test(ref)
    && !/^file:/iu.test(ref)
    ? ref
    : null;
}

function eventRunIdentities(eventIndex) {
  const published = [...new Set(eventIndex.compactEvents
    .map((event) => stringOrNull(event.runId))
    .filter(Boolean))];
  if (eventIndex.envelopeProfile !== 'abiogenesis_4_6_flat') return published;

  // The retained 4.6 envelope adapter exposes `requirement_route_fact_projected`
  // execution-basis refs through its legacy runId slot. They are not Run
  // identities. Admit a legacy carrier only when every extra value has that
  // exact known shape and there is exactly one explicit run:// identity; if the
  // carrier has only those basis refs, retain the legacy path-derived identity.
  const retained = [...new Set(eventIndex.compactEvents
    .filter((event) => !(
      event.kind === 'requirement_route_fact_projected'
      && stringOrNull(event.runId)?.startsWith('execution_basis:')
    ))
    .map((event) => stringOrNull(event.runId))
    .filter(Boolean))];
  const explicitRunIds = retained.filter((value) => /^run:\/\/[^\s]+$/u.test(value));
  if (explicitRunIds.length === 1 && retained.length === 1) {
    return explicitRunIds;
  }
  if (retained.length === 0) return [];
  return retained;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sha256DigestOrNull(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value) ? value : null;
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON does not admit non-finite numbers');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  if (!isRecord(value)) throw new TypeError('canonical JSON value is unsupported');
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function sha256Canonical(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function normalizedRelative(projectRoot, path) {
  return relative(projectRoot, path).split(sep).join('/');
}

function withinRoot(root, path) {
  const rel = relative(resolve(root), resolve(path));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function realWithinRoot(root, path) {
  try {
    return withinRoot(realpathSync(root), realpathSync(path));
  } catch {
    return false;
  }
}

function looksLikeRunProof(value) {
  if (!isRecord(value)) return false;
  if (Array.isArray(value.eventSequence) && isRecord(value.eventCounts)) return true;
  return Boolean(
    stringOrNull(value.graphRef)
    && stringOrNull(value.graphFunctionRef)
    && (stringOrNull(value.proofClass) || stringOrNull(value.scenarioId)),
  );
}

function proofCandidates(runRoot) {
  return listDir(runRoot)
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'sandbox-identity.json')
    .sort((left, right) => {
      const leftScore = left.name.endsWith('-proof.json') ? 0 : left.name.includes('proof') ? 1 : 2;
      const rightScore = right.name.endsWith('-proof.json') ? 0 : right.name.includes('proof') ? 1 : 2;
      return leftScore - rightScore || left.name.localeCompare(right.name);
    })
    .slice(0, 32);
}

function legacyRunIdFor(projectRoot, runRoot) {
  const rel = normalizedRelative(projectRoot, runRoot);
  return createHash('sha1').update(`${resolve(projectRoot)}::${rel}`).digest('hex').slice(0, 16);
}

function runKeyFor(projectRoot, identityParsed, eventPath) {
  const identityDigest = createHash('sha256').update(identityParsed?.source ?? '').digest('hex');
  return `run-observation:sha256:${createHash('sha256')
    .update(`${resolve(projectRoot)}\n${identityDigest}\n${resolve(eventPath)}`)
    .digest('hex')}`;
}

function selectedWorkspaceRoot(projectRoot, runRoot, identity) {
  const published = stringOrNull(identity?.workspaceRoot);
  if (published && isDirectory(published) && withinRoot(projectRoot, published)) return resolve(published);
  const instance = join(runRoot, 'instance');
  if (isDirectory(instance)) return instance;
  const workspace = join(runRoot, 'workspace');
  if (isDirectory(workspace)) return workspace;
  return runRoot;
}

function runStatus(eventIndex) {
  if (eventIndex.eventPosture === 'terminal_converged') return 'converged';
  if (eventIndex.eventPosture === 'terminal_failed') return 'failed';
  return 'unknown';
}

function runArtifactPaths(runRoot, proofPath, identityPath, proof) {
  const values = [proofPath, identityPath];
  const workspaceRoot = selectedWorkspaceRoot(runRoot, runRoot, {});
  for (const name of RUN_AUXILIARY_FILES) {
    for (const parent of [runRoot, workspaceRoot]) {
      const path = join(parent, name);
      if (existsSync(path)) values.push(path);
    }
  }
  for (const candidate of [proof?.eventLogPath, proof?.event_log_path]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const path = resolve(runRoot, candidate);
    if (existsSync(path)) values.push(path);
  }
  return [...new Set(values.filter(Boolean).map((path) => resolve(path)))];
}

function probeRunRoot(projectRoot, runRoot, options, diagnostics = []) {
  const identityPath = join(runRoot, 'sandbox-identity.json');
  const identityParsed = boundedJson(identityPath, options.maxProofBytes);
  const identity = isRecord(identityParsed?.value) ? identityParsed.value : null;
  if (!identityParsed) return null;
  const runIsInsideProject = realWithinRoot(projectRoot, runRoot);
  const projectIsInsideRun = realWithinRoot(runRoot, projectRoot);
  if (!runIsInsideProject && !projectIsInsideRun) {
    diagnostics.push({
      severity: 'error',
      code: 'run_root_escape',
      message: 'candidate run root escapes the admitted Project/run boundary',
      sourceRef: identityPath,
    });
    return null;
  }
  if (!realWithinRoot(runRoot, identityPath)) {
    diagnostics.push({
      severity: 'error',
      code: 'run_identity_escape',
      message: 'run identity carrier escapes the admitted run root',
      sourceRef: identityPath,
    });
    return null;
  }
  if (!identity || identityParsed.error) {
    diagnostics.push({
      severity: 'error',
      code: identityParsed.error?.code === 'duplicate_json_key' ? 'run_identity_duplicate_key' : 'run_identity_invalid',
      message: identityParsed.error?.message ?? 'run identity carrier must be a JSON object',
      sourceRef: identityPath,
    });
    return null;
  }
  const publishedRunRoot = stringOrNull(identity.runRoot);
  if (publishedRunRoot && resolve(publishedRunRoot) !== resolve(runRoot)) {
    diagnostics.push({ severity: 'error', code: 'run_identity_conflict', message: 'published runRoot contradicts the containing run root', sourceRef: identityPath });
    return null;
  }
  const publishedWorkspaceRoot = stringOrNull(identity.workspaceRoot);
  if (publishedWorkspaceRoot && (!isDirectory(publishedWorkspaceRoot) || !withinRoot(runRoot, publishedWorkspaceRoot) || !realWithinRoot(runRoot, publishedWorkspaceRoot))) {
    diagnostics.push({ severity: 'error', code: 'run_workspace_escape', message: 'published workspaceRoot is missing or escapes the admitted run root', sourceRef: identityPath });
    return null;
  }
  const workspaceRoot = selectedWorkspaceRoot(projectRoot, runRoot, identity);
  if (!withinRoot(runRoot, workspaceRoot) || !realWithinRoot(runRoot, workspaceRoot)) {
    diagnostics.push({ severity: 'error', code: 'run_workspace_escape', message: 'resolved workspaceRoot escapes the admitted run root', sourceRef: identityPath });
    return null;
  }
  const workspaceIdentityPath = join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json');
  const workspaceIdentityParsed = existsSync(workspaceIdentityPath)
    ? boundedJson(workspaceIdentityPath, options.maxProofBytes)
    : null;
  if (workspaceIdentityParsed && !realWithinRoot(workspaceRoot, workspaceIdentityPath)) {
    diagnostics.push({ severity: 'error', code: 'run_workspace_identity_escape', message: 'workspace identity carrier escapes the published workspace root', sourceRef: workspaceIdentityPath });
    return null;
  }
  if (workspaceIdentityParsed?.error) {
    diagnostics.push({ severity: 'error', code: 'run_workspace_identity_invalid', message: workspaceIdentityParsed.error.message, sourceRef: workspaceIdentityPath });
    return null;
  }
  if (workspaceIdentityParsed?.source !== null && workspaceIdentityParsed?.source !== undefined
    && workspaceIdentityParsed.source !== identityParsed.source) {
    diagnostics.push({ severity: 'error', code: 'run_identity_conflict', message: 'run-root and workspace identity carriers differ', sourceRef: workspaceIdentityPath });
    return null;
  }
  const eventPath = join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl');
  if (!statOf(eventPath)?.isFile()) {
    diagnostics.push({ severity: 'warning', code: 'run_event_carrier_missing', message: 'published run has no canonical workspace event carrier', sourceRef: eventPath });
    return null;
  }
  if (!realWithinRoot(workspaceRoot, eventPath)) {
    diagnostics.push({ severity: 'error', code: 'run_event_carrier_escape', message: 'event carrier escapes the published workspace root', sourceRef: eventPath });
    return null;
  }
  const eventIndex = indexAbgEventCarrier(eventPath, { refresh: options.refresh === true });
  if (eventIndex.state !== 'ready' || eventIndex.eventCount === 0 || eventIndex.envelopeProfile === 'unknown') {
    diagnostics.push({
      severity: 'warning',
      code: 'run_event_carrier_unadmitted',
      message: eventIndex.eventCount === 0
        ? 'canonical event carrier has no admitted events'
        : 'canonical event carrier does not match a supported stable envelope profile',
      sourceRef: eventPath,
    });
    return null;
  }
  const eventRunIds = eventRunIdentities(eventIndex);
  if (eventRunIds.some((value) => !/^run:\/\/[^\s]+$/u.test(value))) {
    diagnostics.push({
      severity: 'error',
      code: 'run_event_identity_invalid',
      message: 'canonical event carrier publishes a non-Run identity in the run identity slot',
      sourceRef: eventPath,
    });
    return null;
  }
  if (eventRunIds.length > 1) {
    diagnostics.push({
      severity: 'error',
      code: 'run_event_identity_ambiguous',
      message: 'canonical event carrier publishes more than one run identity',
      sourceRef: eventPath,
    });
    return null;
  }
  let selectedProof = null;
  let proofState = 'absent';
  let proofError = null;
  for (const entry of proofCandidates(runRoot)) {
    const path = join(runRoot, entry.name);
    const parsed = boundedJson(path, options.maxProofBytes);
    if (parsed?.error && (entry.name.endsWith('-proof.json') || entry.name.includes('proof'))) {
      proofState = 'unreadable';
      proofError = parsed.error;
      selectedProof = { path, ...parsed };
      break;
    }
    if (parsed && looksLikeRunProof(parsed.value)) {
      proofState = 'present';
      selectedProof = { path, ...parsed };
      break;
    }
  }
  const proof = selectedProof?.value ?? null;
  const modifiedMs = Math.max(
    selectedProof?.stats?.mtimeMs ?? 0,
    identityParsed?.stats?.mtimeMs ?? 0,
    statOf(eventPath)?.mtimeMs ?? 0,
  );
  const legacyRunId = legacyRunIdFor(projectRoot, runRoot);
  const publishedRunId = stringOrNull(identity.runId)
    ?? stringOrNull(identity.runRef)
    ?? stringOrNull(proof?.runId)
    ?? stringOrNull(proof?.runRef);
  const eventRunId = eventRunIds[0] ?? null;
  if (publishedRunId && eventRunId && publishedRunId !== eventRunId) {
    diagnostics.push({
      severity: 'error',
      code: 'run_event_identity_conflict',
      message: 'published run identity contradicts the canonical event carrier',
      sourceRef: eventPath,
    });
    return null;
  }
  const runId = publishedRunId ?? eventRunId ?? legacyRunId;
  return {
    runId,
    legacyRunId: runId === legacyRunId ? legacyRunId : null,
    runKey: runKeyFor(projectRoot, identityParsed, eventPath),
    runRoot,
    relativeRunRoot: normalizedRelative(projectRoot, runRoot),
    workspaceRoot,
    proofPath: selectedProof?.path ?? null,
    proofState,
    proofError,
    identityPath,
    workspaceIdentityPath: workspaceIdentityParsed ? workspaceIdentityPath : null,
    eventPath,
    identity,
    scenarioId: stringOrNull(identity.scenarioId) ?? stringOrNull(proof?.scenarioId),
    scenarioKind: stringOrNull(identity.scenarioKind) ?? stringOrNull(proof?.scenarioKind),
    proofClass: stringOrNull(identity.scenarioProofClass) ?? stringOrNull(identity.proofClass) ?? stringOrNull(proof?.proofClass),
    graphRef: stringOrNull(identity.graphRef) ?? stringOrNull(proof?.graphRef),
    graphFunctionRef: stringOrNull(identity.graphFunctionRef) ?? stringOrNull(proof?.graphFunctionRef),
    overlayRef: stringOrNull(identity.overlayRef) ?? stringOrNull(proof?.overlayRef),
    startupConfigRef: stringOrNull(identity.startupConfigRef) ?? stringOrNull(proof?.startupConfigRef),
    substrate: isRecord(identity.substrate) ? identity.substrate : isRecord(proof?.substrate) ? proof.substrate : null,
    status: runStatus(eventIndex),
    eventPosture: eventIndex.eventPosture,
    eventProfile: eventIndex.envelopeProfile,
    eventGeneration: eventIndex.generation,
    modifiedAt: new Date(modifiedMs).toISOString(),
    modifiedMs,
    eventCount: eventIndex.eventCount,
    lastEventAt: eventIndex.lastEventAt,
    artifactPaths: runArtifactPaths(runRoot, selectedProof?.path ?? null, identityPath, proof ?? {}),
    proofMtimeMs: selectedProof?.stats?.mtimeMs ?? 0,
    identityMtimeMs: identityParsed.stats.mtimeMs,
  };
}

function genericCandidateDiagnostic(diagnostics, code, message, sourceRef) {
  diagnostics.push({ severity: 'error', code, message, sourceRef });
  return null;
}

function probeGenericRunRoot(projectRoot, runRoot, options, diagnostics = []) {
  const evidencePath = join(runRoot, GENERIC_EVIDENCE_CANDIDATE_NAME);
  const evidenceParsed = boundedJson(evidencePath, options.maxProofBytes);
  if (!evidenceParsed) return null;
  if (!realWithinRoot(projectRoot, runRoot) || !realWithinRoot(runRoot, evidencePath)) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_boundary_escape',
      'generic workflow evidence candidate escapes the admitted Project/run boundary',
      evidencePath,
    );
  }
  const candidate = evidenceParsed.value;
  if (evidenceParsed.error || !isRecord(candidate)) {
    return genericCandidateDiagnostic(
      diagnostics,
      evidenceParsed.error?.code === 'duplicate_json_key'
        ? 'generic_candidate_duplicate_key'
        : 'generic_candidate_invalid',
      evidenceParsed.error?.message ?? 'generic workflow evidence candidate must be a JSON object',
      evidencePath,
    );
  }
  if (candidate.kind !== 'generic_live_workflow_evidence_candidate' || candidate.schemaVersion !== '1') {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_contract_invalid',
      'generic workflow evidence candidate kind or schema version is unsupported',
      evidencePath,
    );
  }
  const scenarioKey = identifierTokenOrNull(candidate.scenarioKey, 160);
  const scenarioId = identifierTokenOrNull(candidate.scenarioId, 240);
  const authority = statusTokenOrNull(candidate.authority);
  const candidateDisposition = statusTokenOrNull(candidate.disposition);
  const run = candidate.run;
  const terminalPrefix = candidate.terminalPrefix;
  const storeIdentity = terminalPrefix?.storeIdentity;
  const validation = candidate.validation;
  const abiArtifact = candidate.abiArtifact;
  const evidenceFiles = candidate.files;
  const evidenceOrdinals = Array.isArray(evidenceFiles)
    ? evidenceFiles.map((entry) => numberOrNull(entry?.ordinal))
    : [];
  const evidenceRowsValid = Array.isArray(evidenceFiles)
    && evidenceFiles.every((entry) => (
      isRecord(entry)
      && Number.isSafeInteger(entry.ordinal)
      && entry.ordinal >= 0
      && isRecord(entry.predecessorObservation)
      && isRecord(entry.successorObservation)
      && statusTokenOrNull(entry.predecessorObservation.state) !== null
      && statusTokenOrNull(entry.successorObservation.state) !== null
    ))
    && evidenceOrdinals.every((ordinal) => ordinal !== null)
    && new Set(evidenceOrdinals).size === evidenceOrdinals.length;
  if (
    !scenarioKey || !scenarioId || !authority || !candidateDisposition
    || !hasExactKeys(run, ['ref', 'digest'])
    || !hasExactKeys(terminalPrefix, [
      'kind', 'schemaVersion', 'eventLogRef', 'prefixLength', 'prefixDigest',
      'storeIdentity', 'coordinateDigest',
    ])
    || !hasExactKeys(storeIdentity, ['device', 'inode', 'eventContractDigest'])
    || !isRecord(validation)
    || validation.kind !== 'generic_scenario_validation'
    || validation.schemaVersion !== '1'
    || !statusTokenOrNull(validation.disposition)
    || !isRecord(abiArtifact)
    || !evidenceRowsValid
  ) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_contract_invalid',
      'generic workflow evidence candidate is missing an exact critical identity or posture field',
      evidencePath,
    );
  }
  const runRef = logicalRefOrNull(run.ref);
  const runDigest = sha256DigestOrNull(run.digest);
  const prefixDigest = sha256DigestOrNull(terminalPrefix.prefixDigest);
  const coordinateDigest = sha256DigestOrNull(terminalPrefix.coordinateDigest);
  const eventContractDigest = sha256DigestOrNull(storeIdentity.eventContractDigest);
  const artifactProductId = logicalRefOrNull(abiArtifact.productId);
  const artifactPackageVersion = boundedStringOrNull(abiArtifact.packageVersion, 160);
  const artifactContentDigest = sha256DigestOrNull(abiArtifact.productContentDigest);
  const artifactManifestDigest = sha256DigestOrNull(abiArtifact.productManifestDigest);
  if (
    !runRef || !runDigest || !prefixDigest || !coordinateDigest || !eventContractDigest
    || !artifactProductId || !artifactPackageVersion
    || !artifactContentDigest || !artifactManifestDigest
    || terminalPrefix.kind !== 'durable_prefix_coordinate'
    || terminalPrefix.schemaVersion !== '5.0.0'
    || !Number.isSafeInteger(terminalPrefix.prefixLength)
    || terminalPrefix.prefixLength < 0
    || !Number.isSafeInteger(storeIdentity.device)
    || storeIdentity.device < 0
    || !Number.isSafeInteger(storeIdentity.inode)
    || storeIdentity.inode < 0
  ) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_identity_invalid',
      'generic workflow evidence candidate carries an invalid run, artifact, or durable-prefix identity',
      evidencePath,
    );
  }
  const eventPath = join(runRoot, 'runtime', 'events.jsonl');
  const workspaceRoot = join(runRoot, 'worksite');
  if (!statOf(eventPath)?.isFile() || !isDirectory(workspaceRoot)) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_carrier_missing',
      'generic workflow evidence candidate lacks its exact runtime event carrier or mutable worksite',
      evidencePath,
    );
  }
  if (
    !realWithinRoot(projectRoot, eventPath)
    || !realWithinRoot(runRoot, eventPath)
    || !realWithinRoot(projectRoot, workspaceRoot)
    || !realWithinRoot(runRoot, workspaceRoot)
  ) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_carrier_escape',
      'generic workflow event carrier or worksite escapes the admitted Project/run boundary',
      evidencePath,
    );
  }
  let publishedEventPath;
  try {
    const url = new URL(terminalPrefix.eventLogRef);
    if (url.protocol !== 'file:' || url.host !== '') throw new TypeError('eventLogRef must be a local file URI');
    publishedEventPath = resolve(fileURLToPath(url));
  } catch {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_event_ref_invalid',
      'generic workflow durable prefix does not publish a canonical local event-log reference',
      evidencePath,
    );
  }
  if (
    publishedEventPath !== resolve(eventPath)
    || terminalPrefix.eventLogRef !== pathToFileURL(resolve(eventPath)).href
  ) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_event_ref_conflict',
      'generic workflow durable prefix does not bind the exact runtime event carrier',
      evidencePath,
    );
  }
  const coordinateBody = {
    kind: terminalPrefix.kind,
    schemaVersion: terminalPrefix.schemaVersion,
    eventLogRef: terminalPrefix.eventLogRef,
    prefixLength: terminalPrefix.prefixLength,
    prefixDigest: terminalPrefix.prefixDigest,
    storeIdentity: {
      device: storeIdentity.device,
      inode: storeIdentity.inode,
      eventContractDigest: storeIdentity.eventContractDigest,
    },
  };
  if (sha256Canonical(coordinateBody) !== coordinateDigest) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_coordinate_digest_mismatch',
      'generic workflow durable-prefix coordinate digest does not match its canonical preimage',
      evidencePath,
    );
  }
  const eventStats = statOf(eventPath);
  if (eventStats.dev !== storeIdentity.device || eventStats.ino !== storeIdentity.inode) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_store_identity_mismatch',
      'generic workflow event carrier no longer has the published durable store identity',
      evidencePath,
    );
  }
  const eventIndex = indexAbgEventCarrier(eventPath, {
    refresh: options.refresh === true,
    publishedEventContractDigest: eventContractDigest,
    contractBindingPosture: 'durable_prefix_coordinate_verified',
  });
  if (
    eventIndex.state !== 'ready'
    || eventIndex.envelopeProfile !== 'abiogenesis_5_root'
    || eventIndex.eventCount === 0
    || eventIndex.pendingBytes !== 0
    || eventIndex.observedSizeBytes !== terminalPrefix.prefixLength
    || eventIndex.completePrefixBytes !== terminalPrefix.prefixLength
    || eventIndex.completePrefixDigest !== prefixDigest
    || eventIndex.eventContractDigest !== eventContractDigest
  ) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_prefix_mismatch',
      'generic workflow evidence does not bind the exact complete admitted event prefix',
      evidencePath,
    );
  }
  const runScopedEvents = eventIndex.compactEvents.filter((event) => event.runId !== undefined);
  if (
    runScopedEvents.length === 0
    || runScopedEvents.some((event) => event.runId !== runRef)
  ) {
    return genericCandidateDiagnostic(
      diagnostics,
      'generic_candidate_run_identity_mismatch',
      'generic workflow run reference does not bind every run-scoped event',
      evidencePath,
    );
  }
  const modifiedMs = Math.max(evidenceParsed.stats.mtimeMs, eventStats.mtimeMs);
  const identity = {
    kind: candidate.kind,
    schemaVersion: candidate.schemaVersion,
    scenarioId,
    scenarioKey,
    runRef,
    substrate: {
      productId: artifactProductId,
      packageName: '@abiogenesis/typescript-tenant',
      packageVersion: artifactPackageVersion,
      productContentDigest: artifactContentDigest,
      productManifestDigest: artifactManifestDigest,
    },
  };
  return {
    runId: runRef,
    legacyRunId: null,
    runKey: runKeyFor(projectRoot, evidenceParsed, eventPath),
    runRoot,
    relativeRunRoot: normalizedRelative(projectRoot, runRoot),
    workspaceRoot,
    proofPath: evidencePath,
    proofState: 'candidate',
    proofError: null,
    proofContentDigest: `sha256:${createHash('sha256').update(evidenceParsed.source).digest('hex')}`,
    proofFileIdentity: {
      device: evidenceParsed.stats.dev,
      inode: evidenceParsed.stats.ino,
      sizeBytes: evidenceParsed.stats.size,
      modifiedMs: evidenceParsed.stats.mtimeMs,
    },
    identityPath: evidencePath,
    workspaceIdentityPath: null,
    eventPath,
    identity,
    carrierKind: 'generic_live_workflow_evidence_candidate',
    requiresExplicitSelection: true,
    scenarioId,
    scenarioKey,
    scenarioKind: 'generic_live_workflow',
    proofClass: 'generic_live_workflow_evidence_candidate',
    graphRef: null,
    graphFunctionRef: null,
    overlayRef: null,
    startupConfigRef: null,
    substrate: identity.substrate,
    authority,
    candidateDisposition,
    validationDisposition: statusTokenOrNull(validation.disposition),
    runDigest,
    eventContractDigest,
    eventContractBindingPosture: 'durable_prefix_coordinate_verified',
    eventPrefixLength: terminalPrefix.prefixLength,
    eventPrefixDigest: prefixDigest,
    eventCoordinateDigest: coordinateDigest,
    status: runStatus(eventIndex),
    eventPosture: eventIndex.eventPosture,
    eventProfile: eventIndex.envelopeProfile,
    eventGeneration: eventIndex.generation,
    modifiedAt: new Date(modifiedMs).toISOString(),
    modifiedMs,
    eventCount: eventIndex.eventCount,
    lastEventAt: eventIndex.lastEventAt,
    artifactPaths: [evidencePath, eventPath],
    proofMtimeMs: evidenceParsed.stats.mtimeMs,
    identityMtimeMs: evidenceParsed.stats.mtimeMs,
  };
}

function discoverCarrierRoots(projectRoot, options, diagnostics) {
  const roots = new Set();
  for (const direct of [
    join(projectRoot, 'test_runs'),
    join(projectRoot, '.ai-workspace', 'runs'),
    join(projectRoot, '.ai-workspace', 'archives'),
    join(projectRoot, '.ai-workspace', 'comments'),
  ]) {
    if (isDirectory(direct)) roots.add(resolve(direct));
  }
  const queue = [{ path: projectRoot, depth: 0 }];
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length && visited < options.maxDiscoveryDirectories) {
    const current = queue[cursor++];
    visited += 1;
    if (listDir(current.path).some((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))) roots.add(resolve(current.path));
    if (current.depth >= options.maxCarrierDepth) continue;
    for (const entry of listDir(current.path).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || IGNORED_NAMES.has(entry.name)) continue;
      const path = join(current.path, entry.name);
      if (CARRIER_NAMES.has(entry.name)) {
        roots.add(resolve(path));
        continue;
      }
      if (entry.name === '.ai-workspace') {
        for (const child of ['runs', 'archives', 'comments']) {
          const candidate = join(path, child);
          if (isDirectory(candidate)) roots.add(resolve(candidate));
        }
        continue;
      }
      queue.push({ path, depth: current.depth + 1 });
    }
  }
  if (cursor < queue.length) {
    diagnostics.push({
      severity: 'warning',
      code: 'carrier_discovery_truncated',
      message: `run-carrier discovery reached ${options.maxDiscoveryDirectories} directories`,
      sourceRef: projectRoot,
    });
  }
  return { roots: [...roots], visited };
}

function discoverRunsInCarrier(projectRoot, carrierRoot, options, diagnostics, seenRunRoots) {
  const runs = [];
  const queue = [{ path: carrierRoot, depth: 0 }];
  let cursor = 0;
  while (cursor < queue.length && options.visitedRunDirectories < options.maxDiscoveryDirectories) {
    const current = queue[cursor++];
    options.visitedRunDirectories += 1;
    const resolvedCurrent = resolve(current.path);
    if (!seenRunRoots.has(resolvedCurrent)) {
      const run = probeRetainedRunRoot(projectRoot, resolvedCurrent, options, diagnostics)
        ?? probeGenericRunRoot(projectRoot, resolvedCurrent, options, diagnostics)
        ?? probeRunRoot(projectRoot, resolvedCurrent, options, diagnostics);
      if (run) {
        seenRunRoots.add(resolvedCurrent);
        runs.push(run, ...(run.relatedRuns ?? []));
        continue;
      }
    }
    if (current.depth >= options.maxRunDepth) continue;
    for (const entry of listDir(current.path).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || IGNORED_NAMES.has(entry.name)) continue;
      queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
    }
  }
  if (cursor < queue.length) {
    diagnostics.push({
      severity: 'warning',
      code: 'run_discovery_truncated',
      message: `run discovery reached ${options.maxDiscoveryDirectories} directories`,
      sourceRef: carrierRoot,
    });
  }
  return runs;
}

function containingRun(projectRoot, options, diagnostics) {
  let candidate = projectRoot;
  for (let depth = 0; depth < 8; depth += 1) {
    const run = probeRetainedRunRoot(projectRoot, candidate, options, diagnostics)
      ?? probeGenericRunRoot(projectRoot, candidate, options, diagnostics)
      ?? probeRunRoot(projectRoot, candidate, options, diagnostics);
    if (run) return run;
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  return null;
}

function runPreference(run) {
  if (run.requiresExplicitSelection) return 4;
  if (run.identityPath && run.workspaceRoot !== run.runRoot) return 3;
  if (run.runRoot.includes(`${sep}test_runs${sep}`)) return 2;
  return 1;
}

export function discoverProjectObservationTopology(projectRootInput, inputOptions = {}) {
  const projectRoot = resolve(projectRootInput || '.');
  const options = {
    refresh: inputOptions.refresh === true,
    maxDiscoveryDirectories: Number.isFinite(inputOptions.maxDiscoveryDirectories)
      ? Math.max(100, Math.floor(inputOptions.maxDiscoveryDirectories))
      : DEFAULT_MAX_DISCOVERY_DIRECTORIES,
    maxRuns: Number.isFinite(inputOptions.maxRuns)
      ? Math.max(1, Math.floor(inputOptions.maxRuns))
      : DEFAULT_MAX_RUNS,
    maxCarrierDepth: Number.isFinite(inputOptions.maxCarrierDepth)
      ? Math.max(1, Math.floor(inputOptions.maxCarrierDepth))
      : DEFAULT_MAX_CARRIER_DEPTH,
    maxRunDepth: Number.isFinite(inputOptions.maxRunDepth)
      ? Math.max(1, Math.floor(inputOptions.maxRunDepth))
      : DEFAULT_MAX_RUN_DEPTH,
    maxProofBytes: Number.isFinite(inputOptions.maxProofBytes)
      ? Math.max(1024, Math.floor(inputOptions.maxProofBytes))
      : DEFAULT_MAX_PROOF_BYTES,
    visitedRunDirectories: 0,
  };
  const cached = topologyCache.get(projectRoot);
  const now = Date.now();
  if (!inputOptions.refresh && cached && now - cached.cachedAt < DISCOVERY_CACHE_TTL_MS) {
    return cached.value;
  }
  const diagnostics = [];
  if (!isDirectory(projectRoot)) {
    return {
      kind: 'project_observation_topology',
      version: 1,
      generatedAt: new Date().toISOString(),
      projectRoot,
      identity: detectPublishedWorkspaceIdentity(projectRoot),
      runCarrierRoots: [],
      runs: [],
      diagnostics: [{ severity: 'error', code: 'project_root_missing', message: 'Project root is not a directory', sourceRef: projectRoot }],
    };
  }
  const carrierDiscovery = discoverCarrierRoots(projectRoot, options, diagnostics);
  const seenRunRoots = new Set();
  const runs = [];
  const directRun = containingRun(projectRoot, options, diagnostics);
  if (directRun) {
    seenRunRoots.add(resolve(directRun.runRoot));
    runs.push(directRun, ...(directRun.relatedRuns ?? []));
  }
  for (const carrierRoot of carrierDiscovery.roots) {
    runs.push(...discoverRunsInCarrier(projectRoot, carrierRoot, options, diagnostics, seenRunRoots));
  }
  // An explicit invocation/read carrier for the same immutable Run source takes
  // precedence over a dependency-only row discovered from a shared archive.
  const receiptRuns = new Set(runs.filter((run) => run.discoveryAuthority !== 'event_opening').map((run) => `${run.runId}:${run.runDigest}`));
  for (let i = runs.length - 1; i >= 0; i -= 1) if (runs[i].discoveryAuthority === 'event_opening' && receiptRuns.has(`${runs[i].runId}:${runs[i].runDigest}`)) runs.splice(i, 1);
  runs.sort((left, right) => {
    const preference = runPreference(right) - runPreference(left);
    if (preference !== 0) return preference;
    if (left.requiresExplicitSelection && right.requiresExplicitSelection) {
      return (left.scenarioKey ?? '').localeCompare(right.scenarioKey ?? '')
        || left.runId.localeCompare(right.runId);
    }
    return right.modifiedMs - left.modifiedMs || left.runRoot.localeCompare(right.runRoot);
  });
  const truncated = runs.length > options.maxRuns;
  const retainedRuns = runs.slice(0, options.maxRuns).map(({ modifiedMs, ...run }) => run);
  const retainedRunIdCounts = new Map();
  for (const run of retainedRuns) {
    retainedRunIdCounts.set(run.runId, (retainedRunIdCounts.get(run.runId) ?? 0) + 1);
  }
  for (const [runId, count] of retainedRunIdCounts) {
    if (count < 2) continue;
    diagnostics.push({
      severity: 'warning',
      code: 'run_identity_reused',
      message: `published run identity is reused by ${count} retained carrier rows and cannot be selected without another exact coordinate`,
      sourceRef: runId,
    });
  }
  if (truncated) {
    diagnostics.push({
      severity: 'info',
      code: 'run_index_bounded',
      message: `showing the ${options.maxRuns} most recently modified runs of ${runs.length} discovered`,
      sourceRef: projectRoot,
    });
  }
  const boundedDiagnostics = diagnostics.length <= MAX_DISCOVERY_DIAGNOSTICS
    ? diagnostics
    : [
        ...diagnostics.slice(0, MAX_DISCOVERY_DIAGNOSTICS - 1),
        {
          severity: 'warning',
          code: 'run_discovery_diagnostics_bounded',
          message: `showing ${MAX_DISCOVERY_DIAGNOSTICS - 1} of ${diagnostics.length} run-discovery diagnostics`,
          sourceRef: projectRoot,
        },
      ];
  const value = {
    kind: 'project_observation_topology',
    version: 1,
    generatedAt: new Date().toISOString(),
    projectRoot,
    identity: detectPublishedWorkspaceIdentity(projectRoot),
    runCarrierRoots: carrierDiscovery.roots,
    runs: retainedRuns,
    diagnostics: boundedDiagnostics,
    scan: {
      carrierDirectoryCount: carrierDiscovery.visited,
      runDirectoryCount: options.visitedRunDirectories,
      maxDirectories: options.maxDiscoveryDirectories,
      truncated: diagnostics.some((entry) => entry.code.endsWith('_truncated')),
    },
  };
  topologyCache.set(projectRoot, { cachedAt: now, value });
  return value;
}

export function selectObservationRun(topology, runId = null) {
  if (!topology?.runs?.length) return null;
  if (runId) {
    const matches = topology.runs.filter((run) => run.runId === runId || run.runKey === runId);
    return matches.length === 1 ? matches[0] : null;
  }
  if (topology.runs.some((run) => run.requiresExplicitSelection === true)) return null;
  const counts = new Map();
  for (const run of topology.runs) counts.set(run.runId, (counts.get(run.runId) ?? 0) + 1);
  return topology.runs.find((run) => (
    run.requiresExplicitSelection !== true && counts.get(run.runId) === 1
  )) ?? null;
}

export function loadObservationRunProofSnapshot(run, maxBytes = DEFAULT_MAX_PROOF_BYTES) {
  if (!run?.proofPath || run.proofState === 'unreadable') {
    return { state: 'absent', value: null };
  }
  const parsed = boundedJson(run.proofPath, maxBytes);
  if (!parsed || parsed.error || parsed.source === null) {
    return { state: 'unreadable', value: null };
  }
  if (run.proofContentDigest) {
    const observedDigest = `sha256:${createHash('sha256').update(parsed.source).digest('hex')}`;
    const expected = run.proofFileIdentity;
    const exactFileIdentity = expected
      && parsed.stats.dev === expected.device
      && parsed.stats.ino === expected.inode
      && parsed.stats.size === expected.sizeBytes
      && parsed.stats.mtimeMs === expected.modifiedMs;
    if (observedDigest !== run.proofContentDigest || !exactFileIdentity) {
      return { state: 'changed', value: null };
    }
  }
  return { state: 'ready', value: parsed.value };
}

export function loadObservationRunProof(run, maxBytes = DEFAULT_MAX_PROOF_BYTES) {
  return loadObservationRunProofSnapshot(run, maxBytes).value;
}
