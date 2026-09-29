import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ABI5_ROOT = '/Users/jim/src/apps/abiogenesis-5-root-build';
export const ABI5_PACKAGE_PATH = join(ABI5_ROOT, 'build_tenants/abiogenesis/typescript/package.json');
export const ABI5_MANIFEST_PATH = join(ABI5_ROOT, 'build_tenants/abiogenesis/typescript/product-toolchain-manifest.json');
export const ABI5_EVENT_MODULE_PATH = join(ABI5_ROOT, 'build_tenants/abiogenesis/typescript/build/code/src/abg/event_store.js');
export const exactAbi5ArtifactAvailable = [ABI5_PACKAGE_PATH, ABI5_MANIFEST_PATH, ABI5_EVENT_MODULE_PATH].every(existsSync);

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function fixtureSha(character) {
  return `sha256:${character.repeat(64).slice(0, 64)}`;
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

function abi5Candidates() {
  const runId = 'run://fixture/abi5';
  const graphCallId = 'graph-call://fixture/abi5/1';
  const frameId = 'frame://fixture/abi5/1';
  const graphFunctionRef = 'graph-function://fixture/abi5';
  const base = (kind, index, aggregateType, aggregateId, parentAggregateId, payload, identities = {}) => ({
    kind,
    eventTime: new Date(Date.parse('2026-08-28T00:00:00.000Z') + index * 1000).toISOString(),
    aggregateType,
    aggregateId,
    parentAggregateId,
    causationEventRefs: [],
    correlationId: 'correlation://fixture/abi5',
    workflowVersion: '5.0.0',
    scopeClass: 'run',
    basisId: 'basis://fixture/abi5',
    ...identities,
    payload,
  });
  return [
    base('run_segment_opened', 0, 'run', runId, null, {
      executionBasisDigest: fixtureSha('a'), executionBasisRef: 'execution-basis://fixture/1',
      graphDigest: fixtureSha('b'), graphFunctionRef, graphRef: 'graph://fixture/abi5',
      invocationAdmissionRef: 'invocation-admission://fixture/1', invocationRef: 'invocation://fixture/1',
      programRef: 'program://fixture/1', runDigest: fixtureSha('c'), runId,
      workspaceBindingId: 'workspace-binding://fixture/1',
    }, { runId, graphFunctionRef }),
    base('graph_call_opened', 1, 'graph_call', graphCallId, runId, {
      graphCallId, graphCallDigest: fixtureSha('d'),
    }, { runId, graphCallId, graphFunctionRef }),
    base('frame_opened', 2, 'frame', frameId, graphCallId, {
      frameId, frameDigest: fixtureSha('e'), frameLineageId: 'frame-lineage://fixture/1', attempt: 1, parentFrameId: null,
    }, { runId, graphCallId, frameId, frameLineageId: 'frame-lineage://fixture/1', graphFunctionRef }),
    base('terminal_reached', 3, 'frame', frameId, graphCallId, {
      closureRef: 'closure://fixture/1', closureDigest: fixtureSha('f'), routeRef: 'route://fixture/terminal', terminalKind: 'converged',
    }, { runId, graphCallId, frameId, frameLineageId: 'frame-lineage://fixture/1', graphFunctionRef }),
    base('frame_closed', 4, 'frame', frameId, graphCallId, {
      frameId, terminalReachedEventRef: '__previous__',
    }, { runId, graphCallId, frameId, frameLineageId: 'frame-lineage://fixture/1', graphFunctionRef }),
    base('graph_call_closed', 5, 'graph_call', graphCallId, runId, {
      graphCallId, frameClosedEventRef: '__previous__',
    }, { runId, graphCallId, graphFunctionRef }),
    base('run_closed', 6, 'run', runId, null, {
      runId, graphCallClosedEventRef: '__previous__',
    }, { runId, graphFunctionRef }),
  ];
}

export async function exactAbi5Events() {
  if (!exactAbi5ArtifactAvailable) throw new Error(`exact ABIogenesis 5.0 artifact is unavailable at ${ABI5_ROOT}`);
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  const history = [];
  for (const source of abi5Candidates()) {
    const candidate = structuredClone(source);
    if (history.length > 0) candidate.causationEventRefs = [history.at(-1).eventId];
    for (const key of ['terminalReachedEventRef', 'frameClosedEventRef', 'graphCallClosedEventRef']) {
      if (candidate.payload[key] === '__previous__') candidate.payload[key] = history.at(-1).eventId;
    }
    history.push(abi5.projectRuntimeEventFromValidatedHistory(history, candidate));
  }
  return { events: history, rootEventContractDigest: abi5.ROOT_EVENT_CONTRACT_DIGEST };
}

export async function createExactAbi5RunFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-abi5-fixture-'));
  const runRoot = join(projectRoot, 'test_runs', 'abi5', '20260828T000000000Z_pid1');
  const workspaceRoot = join(runRoot, 'instance');
  const eventPath = join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl');
  const emitted = await exactAbi5Events();
  const content = `${emitted.events.map((event) => canonicalJson(event)).join('\n')}\n`;
  mkdirSync(dirname(eventPath), { recursive: true });
  writeFileSync(eventPath, content, 'utf8');
  mkdirSync(join(projectRoot, 'specification'), { recursive: true });
  writeFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), '# abi5_fixture Product\n\n## Product Identity\n\nABI5 fixture.\n', 'utf8');
  const identity = {
    kind: 'odd_glc_abi5_software_build_live_sandbox', schemaVersion: '5.0.0',
    scenarioId: 'SCN-ABI5-FIXTURE', scenarioKind: 'abi5_contract_fixture',
    scenarioProofClass: 'abi5_root_event_contract', runRoot, workspaceRoot,
    graphRef: 'graph://fixture/abi5', graphFunctionRef: 'graph-function://fixture/abi5',
    overlayRef: 'overlay://fixture/abi5', startupConfigRef: 'startup://fixture/abi5',
    substrate: {
      productId: 'abiogenesis', packageName: '@abiogenesis/typescript-tenant',
      packageVersion: '5.0.0-dev.286', releaseTag: 'development-artifact',
      sourceCommit: 'artifact-under-test',
      productToolchainManifestDigest: `sha256:${createHash('sha256').update(readFileSync(ABI5_MANIFEST_PATH)).digest('hex')}`,
    },
  };
  writeJson(join(runRoot, 'sandbox-identity.json'), identity);
  writeJson(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), identity);
  const eventCounts = Object.fromEntries([...new Set(emitted.events.map((event) => event.kind))]
    .map((kind) => [kind, emitted.events.filter((event) => event.kind === kind).length]));
  writeJson(join(runRoot, 'abi5-proof.json'), {
    kind: 'abi5_overlay_live_proof', scenarioId: identity.scenarioId,
    scenarioKind: identity.scenarioKind, proofClass: identity.scenarioProofClass,
    graphRef: identity.graphRef, graphFunctionRef: identity.graphFunctionRef,
    overlayRef: identity.overlayRef, startupConfigRef: identity.startupConfigRef,
    substrate: identity.substrate, eventCounts, eventSequence: emitted.events,
    eventLogSha256: `sha256:${createHash('sha256').update(content).digest('hex')}`,
  });
  return {
    projectRoot,
    runRoot,
    workspaceRoot,
    eventPath,
    events: emitted.events,
    rootEventContractDigest: emitted.rootEventContractDigest,
    cleanup: () => rmSync(projectRoot, { recursive: true, force: true }),
  };
}
