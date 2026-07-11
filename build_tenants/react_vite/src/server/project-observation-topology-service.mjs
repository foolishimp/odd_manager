import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { detectPublishedWorkspaceIdentity } from './workspace-identity-service.mjs';

const DEFAULT_MAX_DISCOVERY_DIRECTORIES = 20000;
const DEFAULT_MAX_RUNS = 120;
const DEFAULT_MAX_CARRIER_DEPTH = 7;
const DEFAULT_MAX_RUN_DEPTH = 7;
const DEFAULT_MAX_PROOF_BYTES = 32 * 1024 * 1024;
const DISCOVERY_CACHE_TTL_MS = 3000;

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
  const stats = statOf(path);
  if (!stats?.isFile()) return null;
  if (stats.size > maxBytes) return null;
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')), stats };
  } catch {
    return null;
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizedRelative(projectRoot, path) {
  return relative(projectRoot, path).split(sep).join('/');
}

function withinRoot(root, path) {
  const rel = relative(resolve(root), resolve(path));
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
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

function runIdFor(projectRoot, runRoot) {
  const rel = normalizedRelative(projectRoot, runRoot);
  return createHash('sha1').update(`${resolve(projectRoot)}::${rel}`).digest('hex').slice(0, 16);
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

function runStatus(proof) {
  const eventCounts = isRecord(proof?.eventCounts) ? proof.eventCounts : {};
  const terminalCount = numberOrNull(eventCounts.terminal_reached) ?? 0;
  const planned = numberOrNull(eventCounts.vector_traversal_planned) ?? 0;
  const evaluated = numberOrNull(eventCounts.vector_evaluated) ?? 0;
  const closed = numberOrNull(eventCounts.vector_closed) ?? 0;
  if (terminalCount > 0 && evaluated >= planned) return 'converged';
  if (planned > evaluated || evaluated > closed) return 'active';
  return terminalCount > 0 ? 'converged' : 'unknown';
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

function probeRunRoot(projectRoot, runRoot, options) {
  const identityPath = join(runRoot, 'sandbox-identity.json');
  const identityParsed = boundedJson(identityPath, options.maxProofBytes);
  const identity = isRecord(identityParsed?.value) ? identityParsed.value : null;
  let selectedProof = null;
  for (const entry of proofCandidates(runRoot)) {
    const path = join(runRoot, entry.name);
    const parsed = boundedJson(path, options.maxProofBytes);
    if (parsed && looksLikeRunProof(parsed.value)) {
      selectedProof = { path, ...parsed };
      break;
    }
  }
  if (!selectedProof) return null;
  const proof = selectedProof.value;
  const workspaceRoot = selectedWorkspaceRoot(projectRoot, runRoot, identity);
  const eventSequence = Array.isArray(proof.eventSequence) ? proof.eventSequence : [];
  const lastEvent = eventSequence.at(-1);
  const modifiedMs = Math.max(selectedProof.stats.mtimeMs, identityParsed?.stats?.mtimeMs ?? 0);
  return {
    runId: runIdFor(projectRoot, runRoot),
    runRoot,
    relativeRunRoot: normalizedRelative(projectRoot, runRoot),
    workspaceRoot,
    proofPath: selectedProof.path,
    identityPath: identityParsed ? identityPath : null,
    scenarioId: stringOrNull(proof.scenarioId) ?? stringOrNull(identity?.scenarioId),
    scenarioKind: stringOrNull(proof.scenarioKind) ?? stringOrNull(identity?.scenarioKind),
    proofClass: stringOrNull(proof.proofClass) ?? stringOrNull(identity?.scenarioProofClass),
    graphRef: stringOrNull(proof.graphRef) ?? stringOrNull(identity?.graphRef),
    graphFunctionRef: stringOrNull(proof.graphFunctionRef) ?? stringOrNull(identity?.graphFunctionRef),
    overlayRef: stringOrNull(proof.overlayRef) ?? stringOrNull(identity?.overlayRef),
    startupConfigRef: stringOrNull(proof.startupConfigRef) ?? stringOrNull(identity?.startupConfigRef),
    status: runStatus(proof),
    modifiedAt: new Date(modifiedMs).toISOString(),
    modifiedMs,
    eventCount: eventSequence.length,
    lastEventAt: stringOrNull(lastEvent?.eventTime),
    artifactPaths: runArtifactPaths(runRoot, selectedProof.path, identityParsed ? identityPath : null, proof),
    proofMtimeMs: selectedProof.stats.mtimeMs,
    identityMtimeMs: identityParsed?.stats?.mtimeMs ?? 0,
  };
}

function discoverCarrierRoots(projectRoot, options, diagnostics) {
  const roots = new Set();
  for (const direct of [
    join(projectRoot, 'test_runs'),
    join(projectRoot, '.ai-workspace', 'runs'),
    join(projectRoot, '.ai-workspace', 'archives'),
  ]) {
    if (isDirectory(direct)) roots.add(resolve(direct));
  }
  const queue = [{ path: projectRoot, depth: 0 }];
  let cursor = 0;
  let visited = 0;
  while (cursor < queue.length && visited < options.maxDiscoveryDirectories) {
    const current = queue[cursor++];
    visited += 1;
    if (current.depth >= options.maxCarrierDepth) continue;
    for (const entry of listDir(current.path).sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || IGNORED_NAMES.has(entry.name)) continue;
      const path = join(current.path, entry.name);
      if (CARRIER_NAMES.has(entry.name)) {
        roots.add(resolve(path));
        continue;
      }
      if (entry.name === '.ai-workspace') {
        for (const child of ['runs', 'archives']) {
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
      const run = probeRunRoot(projectRoot, resolvedCurrent, options);
      if (run) {
        seenRunRoots.add(resolvedCurrent);
        runs.push(run);
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

function containingRun(projectRoot, options) {
  let candidate = projectRoot;
  for (let depth = 0; depth < 8; depth += 1) {
    const run = probeRunRoot(projectRoot, candidate, options);
    if (run) return run;
    const parent = dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  return null;
}

function runPreference(run) {
  if (run.identityPath && run.workspaceRoot !== run.runRoot) return 3;
  if (run.runRoot.includes(`${sep}test_runs${sep}`)) return 2;
  return 1;
}

export function discoverProjectObservationTopology(projectRootInput, inputOptions = {}) {
  const projectRoot = resolve(projectRootInput || '.');
  const options = {
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
  const directRun = containingRun(projectRoot, options);
  if (directRun) {
    seenRunRoots.add(resolve(directRun.runRoot));
    runs.push(directRun);
  }
  for (const carrierRoot of carrierDiscovery.roots) {
    runs.push(...discoverRunsInCarrier(projectRoot, carrierRoot, options, diagnostics, seenRunRoots));
  }
  runs.sort((left, right) => (
    runPreference(right) - runPreference(left)
    || right.modifiedMs - left.modifiedMs
    || left.runRoot.localeCompare(right.runRoot)
  ));
  const truncated = runs.length > options.maxRuns;
  const retainedRuns = runs.slice(0, options.maxRuns).map(({ modifiedMs, ...run }) => run);
  if (truncated) {
    diagnostics.push({
      severity: 'info',
      code: 'run_index_bounded',
      message: `showing the ${options.maxRuns} most recently modified runs of ${runs.length} discovered`,
      sourceRef: projectRoot,
    });
  }
  const value = {
    kind: 'project_observation_topology',
    version: 1,
    generatedAt: new Date().toISOString(),
    projectRoot,
    identity: detectPublishedWorkspaceIdentity(projectRoot),
    runCarrierRoots: carrierDiscovery.roots,
    runs: retainedRuns,
    diagnostics,
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
  if (runId) return topology.runs.find((run) => run.runId === runId) ?? null;
  return topology.runs[0] ?? null;
}

export function loadObservationRunProof(run, maxBytes = DEFAULT_MAX_PROOF_BYTES) {
  if (!run?.proofPath) return null;
  return boundedJson(run.proofPath, maxBytes)?.value ?? null;
}
