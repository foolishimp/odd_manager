import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { discoverProjectObservationTopology } from './project-observation-topology-service.mjs';

const OBSERVATION_VERSION = 1;
const DEFAULT_MAX_DIRECTORIES = 6000;
const DEFAULT_MAX_ARTIFACTS = 2400;
const DEFAULT_MAX_DEPTH = 14;
const DEFAULT_MAX_JSON_BYTES = 1024 * 1024;

const IGNORED_NAMES = [
  '.git',
  '.DS_Store',
  '.pytest_cache',
  '.venv',
  '__pycache__',
  'coverage',
  'dist',
  'node_modules',
  'site-packages',
];

const IGNORED_NAME_SET = new Set(IGNORED_NAMES);

const FEATURE_DEFS = [
  {
    id: 'ai_workspace',
    label: '.ai-workspace',
    relativePath: '.ai-workspace',
    directoryHints: ['.ai-workspace'],
    capabilities: ['browse.raw'],
  },
  {
    id: 'context',
    label: 'Context',
    relativePath: '.ai-workspace/context',
    directoryHints: ['.ai-workspace/context'],
    capabilities: ['context.read'],
  },
  {
    id: 'tickets',
    label: 'Tickets',
    relativePath: '.ai-workspace/tickets',
    directoryHints: ['.ai-workspace/tickets'],
    capabilities: ['tickets.inspect'],
  },
  {
    id: 'comments',
    label: 'Comments',
    relativePath: '.ai-workspace/comments',
    directoryHints: ['.ai-workspace/comments'],
    capabilities: ['comments.inspect'],
  },
  {
    id: 'runtime',
    label: 'Runtime',
    relativePath: '.ai-workspace/runtime',
    directoryHints: ['.ai-workspace/runtime'],
    capabilities: ['runtime.inspect'],
  },
  {
    id: 'events',
    label: 'Events',
    relativePath: '.ai-workspace/events',
    directoryHints: ['.ai-workspace/events'],
    capabilities: ['events.inspect'],
  },
  {
    id: 'ledgers',
    label: 'Ledgers',
    relativePath: '.ai-workspace/ledgers',
    directoryHints: ['.ai-workspace/ledgers'],
    capabilities: ['abg.system.inspect'],
  },
  {
    id: 'catalogs',
    label: 'Catalogs',
    relativePath: '.ai-workspace/catalogs',
    directoryHints: ['.ai-workspace/catalogs'],
    capabilities: ['abg.system.inspect'],
  },
  {
    id: 'proofs',
    label: 'Proofs',
    relativePath: '.ai-workspace/proofs',
    directoryHints: [
      '.ai-workspace/proofs',
      'test/proof_inputs',
      'test/fixtures',
    ],
    capabilities: ['proof.inspect'],
  },
  {
    id: 'test_runs',
    label: 'Test Runs',
    relativePath: 'test_runs',
    directoryHints: [
      'test_runs',
    ],
    capabilities: ['test_run.inspect'],
  },
  {
    id: 'domain_overlays',
    label: 'Domain Overlays',
    relativePath: null,
    directoryHints: ['.ai-workspace/overlays'],
    capabilities: ['domain_overlay.inspect'],
  },
];

const FEATURE_BY_ID = new Map(FEATURE_DEFS.map((feature) => [feature.id, feature]));

const ARTIFACT_KIND_CAPABILITIES = {
  context_document: ['context.read', 'browse.raw'],
  ticket: ['tickets.inspect', 'browse.raw'],
  comment: ['comments.inspect', 'browse.raw'],
  runtime_json: ['runtime.inspect', 'browse.raw'],
  event_log_jsonl: ['events.inspect', 'browse.raw'],
  system_ledger: ['abg.system.inspect', 'browse.raw'],
  system_catalog: ['abg.system.inspect', 'browse.raw'],
  proof_manifest: ['proof.inspect', 'browse.raw'],
  proof_artifact: ['proof.inspect', 'browse.raw'],
  test_run_summary: ['test_run.inspect', 'browse.raw'],
  domain_overlay: ['domain_overlay.inspect', 'browse.raw'],
  raw_file: ['browse.raw'],
};

function nowIso() {
  return new Date().toISOString();
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function statFile(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function toRelative(projectRoot, absolutePath) {
  return relative(projectRoot, absolutePath).split(sep).join('/');
}

function normalizeRelativePath(value) {
  return String(value ?? '').split(sep).join('/');
}

function artifactId(projectRoot, absolutePath) {
  const rel = toRelative(projectRoot, absolutePath);
  return createHash('sha1').update(`${resolve(projectRoot)}::${rel}`).digest('hex').slice(0, 16);
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}

function diagnostic(severity, code, message, sourceRef = undefined) {
  return {
    severity,
    code,
    message,
    ...(sourceRef ? { sourceRef } : {}),
  };
}

function safeReadJson(path, maxBytes) {
  const stats = statFile(path);
  if (!stats) {
    return { ok: false, error: 'missing_file' };
  }
  if (stats.size > maxBytes) {
    return { ok: false, error: `json_too_large:${stats.size}` };
  }
  try {
    return { ok: true, value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

function validateJsonl(path, maxBytes) {
  const stats = statFile(path);
  if (!stats) {
    return { ok: false, lineCount: 0, invalidLineCount: 0, error: 'missing_file' };
  }
  if (stats.size > maxBytes) {
    return {
      ok: true,
      deferred: true,
      lineCount: null,
      invalidLineCount: null,
      error: null,
      sizeBytes: stats.size,
    };
  }
  try {
    const lines = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim());
    let invalidLineCount = 0;
    for (const line of lines) {
      try {
        JSON.parse(line);
      } catch {
        invalidLineCount += 1;
      }
    }
    return {
      ok: invalidLineCount === 0,
      lineCount: lines.length,
      invalidLineCount,
      error: invalidLineCount === 0 ? null : 'invalid_jsonl_line',
    };
  } catch (caught) {
    return {
      ok: false,
      lineCount: 0,
      invalidLineCount: 0,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

function objectHasAnyKey(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return keys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function textIncludesAny(value, needles) {
  const normalized = String(value ?? '').toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

function jsonSuggestsProof(value) {
  return objectHasAnyKey(value, [
    'proof',
    'proofs',
    'proofKind',
    'proof_kind',
    'proofRefs',
    'proof_refs',
    'scenarioId',
    'scenario_id',
    'eventLogPath',
    'event_log_path',
    'eventLogDigest',
    'event_log_digest',
    'convergence',
    'requiredRuntimeTruth',
    'required_runtime_truth',
  ]);
}

function jsonSuggestsManifest(value) {
  return objectHasAnyKey(value, [
    'manifest',
    'manifestKind',
    'manifest_kind',
    'artifactRefs',
    'artifact_refs',
    'artifacts',
    'fixtures',
    'runs',
    'scenarios',
    'proofs',
  ]);
}

function jsonSuggestsTestRun(value) {
  return objectHasAnyKey(value, [
    'scenarioId',
    'scenario_id',
    'runId',
    'run_id',
    'status',
    'passed',
    'failed',
    'skipped',
    'durationMs',
    'duration_ms',
  ]);
}

function jsonSuggestsOverlay(value, relativePath) {
  const base = basename(String(relativePath ?? '')).toLowerCase();
  if (textIncludesAny(base, ['overlay', 'slot-map'])) return true;
  return objectHasAnyKey(value, [
    'overlayRef',
    'overlay_ref',
    'overlayRefs',
    'overlay_refs',
    'softwareBuildOverlayRef',
    'software_build_overlay_ref',
    'lifecycleSlotMapRef',
    'lifecycle_slot_map_ref',
  ]);
}

function jsonSuggestsSystemLedger(value, relativePath) {
  if (textIncludesAny(relativePath, ['ledger'])) return true;
  return objectHasAnyKey(value, [
    'payloadLedger',
    'payload_ledger',
    'evidenceLedger',
    'evidence_ledger',
    'ledgerRef',
    'ledger_ref',
  ]);
}

function jsonSuggestsSystemCatalog(value, relativePath) {
  if (textIncludesAny(relativePath, ['catalog'])) return true;
  return objectHasAnyKey(value, [
    'catalog',
    'catalogRef',
    'catalog_ref',
    'registry',
    'registryEntries',
    'registry_entries',
  ]);
}

function directoryExistsForFeature(projectRoot, feature) {
  return feature.directoryHints.some((relativePath) => isDirectory(join(projectRoot, relativePath)));
}

function shouldDescend(relativePath) {
  const parts = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  if (parts.some((part) => IGNORED_NAME_SET.has(part))) return false;
  if (parts.includes('src') && !parts.includes('.ai-workspace')) return false;
  if (parts.includes('dist') || parts.includes('coverage')) return false;
  return true;
}

function isCandidateArtifact(relativePath) {
  const rel = normalizeRelativePath(relativePath);
  const lower = rel.toLowerCase();
  const base = basename(lower);
  const ext = extname(lower);

  if (base.startsWith('.')) return false;
  if (lower.startsWith('.ai-workspace/context/') && ['.md', '.json', '.txt'].includes(ext)) return true;
  if (lower.startsWith('.ai-workspace/tickets/') && ['.md', '.json'].includes(ext)) return true;
  if (lower.startsWith('.ai-workspace/comments/') && ['.md', '.json'].includes(ext)) return true;
  if (lower.startsWith('.ai-workspace/runtime/') && ['.json', '.jsonl', '.md'].includes(ext)) return true;
  if (lower.startsWith('.ai-workspace/events/') && ['.json', '.jsonl'].includes(ext)) return true;
  if (lower.startsWith('.ai-workspace/ledgers/') && ['.json', '.jsonl'].includes(ext)) return true;
  if (lower.startsWith('.ai-workspace/catalogs/') && ['.json'].includes(ext)) return true;
  if (lower.includes('/.ai-workspace/proofs/') && ['.json', '.jsonl', '.md'].includes(ext)) return true;
  if (base === 'sandbox-summary.json') return true;
  if (base === 'sandbox-identity.json') return true;
  if (base === 'test-execution-result.json') return true;
  if (base === 'depth-proof-map.json') return true;
  if (base === 'mutation-outcomes.json') return true;
  if (base.includes('manifest') && ext === '.json') return true;
  if (base.includes('proof') && ext === '.json') return true;
  if (base.includes('event') && ext === '.jsonl') return true;
  if ((base.includes('ledger') || base.includes('catalog') || base.includes('overlay')) && ext === '.json') return true;
  return false;
}

function scanCandidateArtifacts(projectRoot, options) {
  const maxDirectories = Number.isFinite(options.maxDirectories)
    ? Math.max(1, Math.floor(options.maxDirectories))
    : DEFAULT_MAX_DIRECTORIES;
  const maxArtifacts = Number.isFinite(options.maxArtifacts)
    ? Math.max(1, Math.floor(options.maxArtifacts))
    : DEFAULT_MAX_ARTIFACTS;
  const maxDepth = Number.isFinite(options.maxDepth)
    ? Math.max(0, Math.floor(options.maxDepth))
    : DEFAULT_MAX_DEPTH;
  const roots = uniqueStrings([
    '.ai-workspace',
    'test/proof_inputs',
    'test/fixtures',
    ...(Array.isArray(options.extraScanRoots) ? options.extraScanRoots : []),
  ]);

  const queue = roots
    .map((relativePath) => ({ absolutePath: join(projectRoot, relativePath), relativePath, depth: 0 }))
    .filter((entry) => isDirectory(entry.absolutePath));
  const seenDirectories = new Set(queue.map((entry) => resolve(entry.absolutePath)));
  const artifacts = [];
  let scannedDirectoryCount = 0;
  let scannedFileCount = 0;
  let truncated = false;

  while (queue.length > 0) {
    if (scannedDirectoryCount >= maxDirectories || artifacts.length >= maxArtifacts) {
      truncated = true;
      break;
    }
    const current = queue.shift();
    if (!current) continue;
    scannedDirectoryCount += 1;
    let entries;
    try {
      entries = readdirSync(current.absolutePath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (IGNORED_NAME_SET.has(entry.name)) continue;
      const absolutePath = join(current.absolutePath, entry.name);
      const relativePath = toRelative(projectRoot, absolutePath);
      if (entry.isDirectory()) {
        const resolved = resolve(absolutePath);
        if (current.depth + 1 > maxDepth) continue;
        if (seenDirectories.has(resolved)) continue;
        if (!shouldDescend(relativePath)) continue;
        seenDirectories.add(resolved);
        queue.push({ absolutePath, relativePath, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      scannedFileCount += 1;
      if (!isCandidateArtifact(relativePath)) continue;
      artifacts.push(absolutePath);
      if (artifacts.length >= maxArtifacts) {
        truncated = true;
        break;
      }
    }
  }

  return {
    artifacts,
    scannedDirectoryCount,
    scannedFileCount,
    maxDirectories,
    maxArtifacts,
    truncated,
  };
}

function isTopologyArtifactName(name) {
  const base = String(name).toLowerCase();
  if (base.includes('instruction-manifest')) return false;
  return base.endsWith('-proof.json')
    || base.includes('live-manifest')
    || base === 'proof-input-summary.json'
    || base === 'sandbox-summary.json'
    || base === 'sandbox-identity.json'
    || base === 'test-execution-result.json'
    || base === 'depth-proof-map.json'
    || base === 'mutation-outcomes.json';
}

function scanTopologyArtifacts(carrierRoots, maxArtifacts = 1200) {
  const artifacts = [];
  const queue = carrierRoots.map((path) => ({ path, depth: 0 }));
  let cursor = 0;
  while (cursor < queue.length && artifacts.length < maxArtifacts) {
    const current = queue[cursor++];
    if (current.depth > 8) continue;
    let entries;
    try {
      entries = readdirSync(current.path, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_NAME_SET.has(entry.name) || entry.name === '.ai-workspace') continue;
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 });
      } else if (entry.isFile() && isTopologyArtifactName(entry.name)) {
        artifacts.push(join(current.path, entry.name));
        if (artifacts.length >= maxArtifacts) break;
      }
    }
  }
  return artifacts;
}

function classifyMarkdown(relativePath) {
  const lower = relativePath.toLowerCase();
  if (lower.startsWith('.ai-workspace/context/')) return { featureId: 'context', artifactKind: 'context_document' };
  if (lower.startsWith('.ai-workspace/tickets/')) return { featureId: 'tickets', artifactKind: 'ticket' };
  if (lower.startsWith('.ai-workspace/comments/')) return { featureId: 'comments', artifactKind: 'comment' };
  return { featureId: 'ai_workspace', artifactKind: 'raw_file' };
}

function classifyJsonArtifact(path, relativePath, options) {
  const lower = relativePath.toLowerCase();
  const base = basename(lower);
  const parsed = safeReadJson(path, options.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES);
  if (!parsed.ok) {
    if (parsed.error?.startsWith('json_too_large:')) {
      if (base.includes('proof') || base === 'depth-proof-map.json' || base === 'mutation-outcomes.json') {
        return {
          featureId: 'proofs',
          artifactKind: 'proof_artifact',
          state: 'present',
          diagnostics: [diagnostic('info', 'json_inspection_deferred', 'Large proof JSON is indexed by metadata and inspected through its bounded run projection.', relativePath)],
        };
      }
      if (base === 'test-execution-result.json' || base === 'sandbox-summary.json') {
        return {
          featureId: 'test_runs',
          artifactKind: 'test_run_summary',
          state: 'present',
          diagnostics: [diagnostic('info', 'json_inspection_deferred', 'Large test result is indexed by metadata.', relativePath)],
        };
      }
    }
    return {
      featureId: 'ai_workspace',
      artifactKind: 'raw_file',
      state: 'error',
      diagnostics: [
        diagnostic('error', 'json_parse_failed', `JSON artifact could not be validated: ${parsed.error}`, relativePath),
      ],
    };
  }

  const value = parsed.value;
  if (lower.startsWith('.ai-workspace/tickets/')) return { featureId: 'tickets', artifactKind: 'ticket' };
  if (lower.startsWith('.ai-workspace/comments/')) return { featureId: 'comments', artifactKind: 'comment' };
  if (lower.startsWith('.ai-workspace/context/')) return { featureId: 'context', artifactKind: 'context_document' };
  if (base === 'sandbox-summary.json' && jsonSuggestsTestRun(value)) {
    return { featureId: 'test_runs', artifactKind: 'test_run_summary' };
  }
  if (base === 'test-execution-result.json') {
    return { featureId: 'test_runs', artifactKind: 'test_run_summary' };
  }
  if (base === 'depth-proof-map.json' || base === 'mutation-outcomes.json') {
    return { featureId: 'proofs', artifactKind: 'proof_artifact' };
  }
  if (base === 'sandbox-identity.json') {
    return { featureId: 'runtime', artifactKind: 'runtime_json' };
  }
  if (base.includes('manifest') && (jsonSuggestsManifest(value) || jsonSuggestsProof(value))) {
    return { featureId: 'proofs', artifactKind: 'proof_manifest' };
  }
  if (base.includes('proof') && jsonSuggestsProof(value)) {
    return { featureId: 'proofs', artifactKind: 'proof_artifact' };
  }
  if (jsonSuggestsSystemLedger(value, relativePath)) {
    return { featureId: 'ledgers', artifactKind: 'system_ledger' };
  }
  if (jsonSuggestsSystemCatalog(value, relativePath)) {
    return { featureId: 'catalogs', artifactKind: 'system_catalog' };
  }
  if (jsonSuggestsOverlay(value, relativePath)) {
    return { featureId: 'domain_overlays', artifactKind: 'domain_overlay' };
  }
  if (lower.startsWith('.ai-workspace/runtime/')) return { featureId: 'runtime', artifactKind: 'runtime_json' };
  return { featureId: 'ai_workspace', artifactKind: 'raw_file' };
}

function classifyJsonlArtifact(path, relativePath, options) {
  const lower = relativePath.toLowerCase();
  const validation = validateJsonl(path, options.maxJsonBytes ?? DEFAULT_MAX_JSON_BYTES);
  if (!validation.ok) {
    return {
      featureId: lower.includes('event') ? 'events' : 'ai_workspace',
      artifactKind: 'raw_file',
      state: 'error',
      diagnostics: [
        diagnostic('error', 'jsonl_parse_failed', `JSONL artifact could not be validated: ${validation.error}`, relativePath),
      ],
    };
  }
  const deferredDiagnostics = validation.deferred
    ? [diagnostic(
        'info',
        'jsonl_digest_deferred',
        `Large JSONL carrier (${validation.sizeBytes} bytes) is indexed without whole-file parsing; run proofs expose its admitted digest.`,
        relativePath,
      )]
    : [];
  if (lower.startsWith('.ai-workspace/ledgers/') || lower.includes('/ledgers/')) {
    return { featureId: 'ledgers', artifactKind: 'system_ledger', diagnostics: deferredDiagnostics };
  }
  if (lower.startsWith('.ai-workspace/catalogs/') || lower.includes('/catalogs/')) {
    return { featureId: 'catalogs', artifactKind: 'system_catalog', diagnostics: deferredDiagnostics };
  }
  if (lower.startsWith('.ai-workspace/events/') || lower.includes('/events/') || lower.includes('event')) {
    return { featureId: 'events', artifactKind: 'event_log_jsonl', diagnostics: deferredDiagnostics };
  }
  if (lower.startsWith('.ai-workspace/runtime/')) return { featureId: 'runtime', artifactKind: 'runtime_json' };
  return { featureId: 'ai_workspace', artifactKind: 'raw_file' };
}

function classifyArtifact(projectRoot, path, options) {
  const relativePath = toRelative(projectRoot, path);
  const ext = extname(relativePath).toLowerCase();
  let classification;
  if (ext === '.md' || ext === '.txt') {
    classification = classifyMarkdown(relativePath);
  } else if (ext === '.json') {
    classification = classifyJsonArtifact(path, relativePath, options);
  } else if (ext === '.jsonl') {
    classification = classifyJsonlArtifact(path, relativePath, options);
  } else {
    classification = { featureId: 'ai_workspace', artifactKind: 'raw_file' };
  }

  const stats = statFile(path);
  const artifactKind = classification.artifactKind ?? 'raw_file';
  const state = classification.state ?? 'present';
  return {
    kind: 'ai_workspace_artifact',
    artifactId: artifactId(projectRoot, path),
    featureId: classification.featureId ?? 'ai_workspace',
    artifactKind,
    state,
    relativePath,
    absolutePath: path,
    sizeBytes: stats?.size ?? 0,
    modifiedAt: stats?.mtime ? stats.mtime.toISOString() : null,
    viewerCapabilities: ARTIFACT_KIND_CAPABILITIES[artifactKind] ?? ['browse.raw'],
    diagnostics: classification.diagnostics ?? [],
  };
}

function featureRecord(projectRoot, feature, artifacts) {
  const sourceRefs = [];
  const directoryPresent = directoryExistsForFeature(projectRoot, feature);
  const featureArtifacts = artifacts.filter((artifact) => artifact.featureId === feature.id);
  const presentArtifacts = featureArtifacts.filter((artifact) => artifact.state === 'present');
  const errorArtifacts = featureArtifacts.filter((artifact) => artifact.state === 'error');
  if (feature.relativePath && isDirectory(join(projectRoot, feature.relativePath))) {
    sourceRefs.push(feature.relativePath);
  }
  for (const artifact of featureArtifacts) {
    sourceRefs.push(artifact.relativePath);
  }

  let state = 'missing';
  if (presentArtifacts.length > 0) state = 'present';
  else if (errorArtifacts.length > 0) state = 'error';
  else if (directoryPresent) state = feature.id === 'ai_workspace' ? 'present' : 'incomplete';

  const capabilities = state === 'present'
    ? uniqueStrings(featureArtifacts.flatMap((artifact) => artifact.viewerCapabilities).concat(feature.capabilities))
    : state === 'incomplete' && feature.id === 'ai_workspace'
      ? ['browse.raw']
      : [];

  return {
    id: feature.id,
    label: feature.label,
    state,
    relativePath: feature.relativePath,
    sourceRefs: uniqueStrings(sourceRefs),
    artifactCount: featureArtifacts.length,
    capabilities,
    diagnostics: errorArtifacts.flatMap((artifact) => artifact.diagnostics),
  };
}

export function loadAiWorkspaceObservation(projectRootInput, options = {}) {
  const projectRoot = resolve(projectRootInput || '.');
  const aiWorkspaceRoot = join(projectRoot, '.ai-workspace');
  const scan = scanCandidateArtifacts(projectRoot, options);
  const topology = discoverProjectObservationTopology(projectRoot, {
    maxRuns: options.maxRuns,
    refresh: options.refresh === true,
  });
  const candidatePaths = uniqueStrings([
    ...scan.artifacts,
    ...scanTopologyArtifacts(topology.runCarrierRoots, options.maxTopologyArtifacts),
    ...topology.runs.flatMap((run) => run.artifactPaths),
  ]);
  const artifacts = candidatePaths
    .filter((path) => isFile(path))
    .map((path) => classifyArtifact(projectRoot, path, options))
    .sort((left, right) => {
      const featureDiff = left.featureId.localeCompare(right.featureId);
      if (featureDiff !== 0) return featureDiff;
      return left.relativePath.localeCompare(right.relativePath);
    });
  const features = FEATURE_DEFS.map((feature) => featureRecord(projectRoot, feature, artifacts));
  const capabilities = uniqueStrings(features.flatMap((feature) => feature.capabilities));

  return {
    kind: 'ai_workspace_observation',
    version: OBSERVATION_VERSION,
    generatedAt: nowIso(),
    projectRoot,
    aiWorkspaceRoot,
    readOnly: true,
    features,
    artifacts,
    capabilities,
    diagnostics: {
      projectRoot,
      aiWorkspaceRoot,
      scannedDirectoryCount: scan.scannedDirectoryCount,
      scannedFileCount: scan.scannedFileCount,
      maxDirectories: scan.maxDirectories,
      maxArtifacts: scan.maxArtifacts,
      truncated: scan.truncated,
      ignoredNames: IGNORED_NAMES,
    },
  };
}

export function createAiWorkspaceObservationService(projectRoot, options = {}) {
  return {
    load(loadOptions = {}) {
      return loadAiWorkspaceObservation(projectRoot, { ...options, ...loadOptions });
    },
  };
}

export function aiWorkspaceFeatureById(observation, id) {
  const feature = observation?.features?.find((candidate) => candidate.id === id) ?? null;
  if (feature) return feature;
  const def = FEATURE_BY_ID.get(id);
  return def
    ? {
        id: def.id,
        label: def.label,
        state: 'missing',
        relativePath: def.relativePath,
        sourceRefs: [],
        artifactCount: 0,
        capabilities: [],
        diagnostics: [],
      }
    : null;
}
