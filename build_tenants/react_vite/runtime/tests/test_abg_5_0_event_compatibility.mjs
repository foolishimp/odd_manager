import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdtempSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABI5_ROOT_EVENT_CONTRACT_DIGEST,
  detailAbgEventCarrier,
  indexAbgEventCarrier,
  pageAbgEventCarrier,
} from '../../src/server/abg-event-carrier-service.mjs';
import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';
import { loadTraversalSummary } from '../../src/server/traversal-projection-service.mjs';
import { loadVisualGraphProjection } from '../../src/server/visual-graph-projection-service.mjs';

const ABI5_ROOT = '/Users/jim/src/apps/abiogenesis-5-root-build';
const ABI5_PACKAGE_PATH = join(ABI5_ROOT, 'build_tenants/abiogenesis/typescript/package.json');
const ABI5_MANIFEST_PATH = join(ABI5_ROOT, 'build_tenants/abiogenesis/typescript/product-toolchain-manifest.json');
const ABI5_EVENT_MODULE_PATH = join(ABI5_ROOT, 'build_tenants/abiogenesis/typescript/build/code/src/abg/event_store.js');
const exactAbi5ArtifactAvailable = [ABI5_PACKAGE_PATH, ABI5_MANIFEST_PATH, ABI5_EVENT_MODULE_PATH].every(existsSync);

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha(character) {
  return `sha256:${character.repeat(64).slice(0, 64)}`;
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
}

function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function reprojectMutatedEvent(event) {
  const {
    eventId: _eventId,
    admissionOrdinal,
    payloadDigest: _payloadDigest,
    ...candidate
  } = event;
  const payloadDigest = canonicalDigest(candidate.payload);
  const eventId = `event://abiogenesis/${canonicalDigest({
    ...candidate,
    payloadDigest,
    admissionOrdinal,
  }).slice('sha256:'.length)}`;
  return { ...candidate, payloadDigest, admissionOrdinal, eventId };
}

function runtimeEventCandidate(event) {
  const {
    eventId: _eventId,
    admissionOrdinal: _admissionOrdinal,
    payloadDigest: _payloadDigest,
    ...candidate
  } = event;
  return candidate;
}

function writeEventCarrier(path, events) {
  writeFileSync(path, `${events.map((event) => canonicalJson(event)).join('\n')}\n`, 'utf8');
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
      executionBasisDigest: sha('a'), executionBasisRef: 'execution-basis://fixture/1',
      graphDigest: sha('b'), graphFunctionRef, graphRef: 'graph://fixture/abi5',
      invocationAdmissionRef: 'invocation-admission://fixture/1', invocationRef: 'invocation://fixture/1',
      programRef: 'program://fixture/1', runDigest: sha('c'), runId,
      workspaceBindingId: 'workspace-binding://fixture/1',
    }, { runId, graphFunctionRef }),
    base('graph_call_opened', 1, 'graph_call', graphCallId, runId, {
      graphCallId, graphCallDigest: sha('d'),
    }, { runId, graphCallId, graphFunctionRef }),
    base('frame_opened', 2, 'frame', frameId, graphCallId, {
      frameId, frameDigest: sha('e'), frameLineageId: 'frame-lineage://fixture/1', attempt: 1, parentFrameId: null,
    }, { runId, graphCallId, frameId, frameLineageId: 'frame-lineage://fixture/1', graphFunctionRef }),
    base('terminal_reached', 3, 'frame', frameId, graphCallId, {
      closureRef: 'closure://fixture/1', closureDigest: sha('f'), routeRef: 'route://fixture/terminal', terminalKind: 'converged',
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

async function exactAbi5Events() {
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  assert.equal(abi5.ROOT_EVENT_CONTRACT_DIGEST, ABI5_ROOT_EVENT_CONTRACT_DIGEST);
  const history = [];
  for (const source of abi5Candidates()) {
    const candidate = structuredClone(source);
    if (history.length > 0) candidate.causationEventRefs = [history.at(-1).eventId];
    for (const key of ['terminalReachedEventRef', 'frameClosedEventRef', 'graphCallClosedEventRef']) {
      if (candidate.payload[key] === '__previous__') candidate.payload[key] = history.at(-1).eventId;
    }
    history.push(abi5.projectRuntimeEventFromValidatedHistory(history, candidate));
  }
  return history;
}

async function createAbi5Fixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-abi5-fixture-'));
  const runRoot = join(projectRoot, 'test_runs', 'abi5', '20260828T000000000Z_pid1');
  const workspaceRoot = join(runRoot, 'instance');
  const eventPath = join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl');
  const events = await exactAbi5Events();
  const content = `${events.map((event) => canonicalJson(event)).join('\n')}\n`;
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
  const eventCounts = Object.fromEntries([...new Set(events.map((event) => event.kind))]
    .map((kind) => [kind, events.filter((event) => event.kind === kind).length]));
  writeJson(join(runRoot, 'abi5-proof.json'), {
    kind: 'abi5_overlay_live_proof', scenarioId: identity.scenarioId,
    scenarioKind: identity.scenarioKind, proofClass: identity.scenarioProofClass,
    graphRef: identity.graphRef, graphFunctionRef: identity.graphFunctionRef,
    overlayRef: identity.overlayRef, startupConfigRef: identity.startupConfigRef,
    substrate: identity.substrate, eventCounts, eventSequence: events,
    eventLogSha256: `sha256:${createHash('sha256').update(content).digest('hex')}`,
  });
  return { projectRoot, runRoot, workspaceRoot, eventPath, events, cleanup: () => rmSync(projectRoot, { recursive: true, force: true }) };
}

test('exact ABIogenesis 5.0 artifact envelope is validated without inventing an unpublished event-contract binding', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async () => {
  const packageRecord = JSON.parse(readFileSync(ABI5_PACKAGE_PATH, 'utf8'));
  const manifest = JSON.parse(readFileSync(ABI5_MANIFEST_PATH, 'utf8'));
  assert.equal(packageRecord.name, '@abiogenesis/typescript-tenant');
  assert.equal(packageRecord.version, '5.0.0-dev.286');
  assert.equal(manifest.schemaVersion, '5.0.0');
  assert.ok(manifest.compatibilityRefs.includes('compatibility://abiogenesis/major/5'));

  const fixture = await createAbi5Fixture();
  try {
    const index = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
    assert.equal(index.state, 'ready');
    assert.equal(index.envelopeProfile, 'abiogenesis_5_root');
    assert.equal(index.eventContractDigest, null);
    assert.equal(index.builtInEventContractDigest, ABI5_ROOT_EVENT_CONTRACT_DIGEST);
    assert.equal(index.contractPosture, 'built_in_registry_envelope_validated_unpublished');
    assert.equal(index.eventPosture, 'terminal_converged');
    assert.equal(index.firstOrdinal, 1);
    assert.equal(index.lastOrdinal, 7);

    const page = pageAbgEventCarrier(index, { start: 0, limit: 3, generation: index.generation });
    assert.equal(page.ok, true);
    assert.equal(page.page.rows[1].graphCallId, 'graph-call://fixture/abi5/1');
    const detail = detailAbgEventCarrier(index, { ordinal: 4, generation: index.generation });
    assert.equal(detail.ok, true, detail.error);
    assert.equal(detail.detail.value.payload.terminalKind, 'converged');

    const observation = loadAbgRunObservation(fixture.projectRoot, { refresh: true });
    assert.equal(observation.state, 'ready');
    assert.equal(observation.version, 3);
    assert.equal(observation.selectedRunId, 'run://fixture/abi5');
    assert.equal(observation.proofReconciliation.state, 'reconciled');
    assert.equal(observation.compatibility.posture, 'abiogenesis_5_identity_unconfirmed');
    assert.equal(observation.eventPosture, 'terminal_converged');
    assert.equal(observation.eventFamilies.run.eventCount, 7);

    const traversal = loadTraversalSummary(fixture.projectRoot, { refresh: true });
    assert.equal(traversal.state, 'ready');
    assert.equal(traversal.eventLogDigest, index.completePrefixDigest);
    assert.equal(traversal.frames.length, 1);
  } finally {
    fixture.cleanup();
  }
});

test('ABIogenesis 5.0 integrity failures and stale generations fail closed', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async () => {
  const fixture = await createAbi5Fixture();
  try {
    const admitted = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
    const lines = readFileSync(fixture.eventPath, 'utf8').trimEnd().split('\n');
    const corrupted = JSON.parse(lines[2]);
    corrupted.payloadDigest = sha('0');
    lines[2] = JSON.stringify(corrupted);
    writeFileSync(fixture.eventPath, `${lines.join('\n')}\n`, 'utf8');
    const invalid = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
    assert.equal(invalid.state, 'invalid');
    assert.ok(invalid.diagnostics.some((entry) => entry.code === 'event_envelope_invalid'));
    const stale = detailAbgEventCarrier(admitted, { ordinal: 1, generation: admitted.generation });
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'stale_event_generation');
  } finally {
    fixture.cleanup();
  }
});

test('ABIogenesis 5 terminal posture is driven by exact event kinds rather than free-form terminal text', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async (context) => {
  const fixture = await createAbi5Fixture();
  context.after(fixture.cleanup);
  const events = structuredClone(fixture.events.slice(0, 4));
  events.at(-1).payload.terminalKind = 'failed_by_label_only';
  events[events.length - 1] = reprojectMutatedEvent(events.at(-1));
  writeEventCarrier(fixture.eventPath, events);

  const index = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(index.state, 'ready', JSON.stringify(index.diagnostics));
  assert.equal(index.eventPosture, 'terminal_observed');
  assert.equal(index.terminalEvent.terminalKind, 'failed_by_label_only');
});

test('exact built-in ABIogenesis 5 kind contracts reject wrong categories, open payloads, and broken identity bindings', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async (context) => {
  const fixture = await createAbi5Fixture();
  context.after(fixture.cleanup);
  const cases = [
    {
      label: 'kind and aggregate category',
      mutate(event) {
        event.aggregateType = 'frame';
        event.aggregateId = 'frame://fixture/abi5/1';
        event.parentAggregateId = 'graph-call://fixture/abi5/1';
        event.graphCallId = 'graph-call://fixture/abi5/1';
        event.frameId = 'frame://fixture/abi5/1';
        event.frameLineageId = 'frame-lineage://fixture/1';
      },
      message: 'kind, aggregate type, and scope class',
    },
    {
      label: 'closed payload keys',
      mutate(event) { event.payload.unpublishedField = true; },
      message: 'payload matches no admitted event-contract variant',
    },
    {
      label: 'aggregate and scope identity',
      mutate(event) { event.aggregateId = 'run://fixture/abi5/wrong'; },
      message: 'aggregate identity differs from its scope identity',
    },
    {
      label: 'required payload identity type',
      mutate(event) { event.payload.graphCallClosedEventRef = null; },
      message: 'invalid required identity',
    },
    {
      label: 'unknown built-in event kind',
      mutate(event) { event.kind = 'run_closed_alias'; },
      message: 'outside the exact built-in root registry',
    },
    {
      label: 'kind-specific value constraint',
      mutate(event) {
        event.kind = 'run_stopped';
        event.payload = {
          disposition: 'invented_disposition',
          routeRef: 'route://fixture/abi5/stop',
          reasonRef: 'reason://fixture/abi5/stop',
        };
      },
      message: 'run stop event carries an unknown disposition',
    },
  ];
  for (const publishedEventContractDigest of [null, ABI5_ROOT_EVENT_CONTRACT_DIGEST]) {
    for (const subject of cases) {
      const events = structuredClone(fixture.events);
      subject.mutate(events.at(-1));
      events[events.length - 1] = reprojectMutatedEvent(events.at(-1));
      writeEventCarrier(fixture.eventPath, events);
      const index = indexAbgEventCarrier(fixture.eventPath, {
        refresh: true,
        ...(publishedEventContractDigest
          ? { publishedEventContractDigest }
          : {}),
      });
      assert.equal(index.state, 'invalid', `${subject.label}: ${JSON.stringify(index.diagnostics)}`);
      assert.ok(index.diagnostics.some((entry) => entry.message.includes(subject.message)), (
        `${subject.label}: ${JSON.stringify(index.diagnostics)}`
      ));
    }
  }
});

test('a distinct published ABIogenesis 5 contract stays observable but cannot claim built-in lifecycle semantics', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async (context) => {
  const fixture = await createAbi5Fixture();
  context.after(fixture.cleanup);
  const events = structuredClone(fixture.events);
  const last = events.at(-1);
  last.aggregateType = 'frame';
  last.aggregateId = 'frame://fixture/abi5/1';
  last.parentAggregateId = 'graph-call://fixture/abi5/1';
  last.graphCallId = 'graph-call://fixture/abi5/1';
  last.frameId = 'frame://fixture/abi5/1';
  last.frameLineageId = 'frame-lineage://fixture/1';
  events[events.length - 1] = reprojectMutatedEvent(last);
  writeEventCarrier(fixture.eventPath, events);

  const index = indexAbgEventCarrier(fixture.eventPath, {
    refresh: true,
    publishedEventContractDigest: sha('9'),
    contractBindingPosture: 'durable_prefix_coordinate_verified',
  });
  assert.equal(index.state, 'ready', JSON.stringify(index.diagnostics));
  assert.equal(index.contractPosture, 'published_contract_distinct_from_builtin_registry');
  assert.equal(index.builtInRootContractValidated, false);
  assert.equal(index.eventPosture, 'external_contract_uninterpreted');
  assert.equal(index.terminalEvent, null);
  assert.ok(index.diagnostics.some((entry) => (
    entry.code === 'external_event_contract_semantics_uninterpreted'
  )));
});

test('projection-critical ABIogenesis 5 identities and causation sets refuse overflow before compaction', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async (context) => {
  const fixture = await createAbi5Fixture();
  context.after(fixture.cleanup);
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);

  const repeatedHistory = [];
  const repeatedSeed = abi5Candidates()[0];
  for (let index = 0; index < 201; index += 1) {
    const candidate = structuredClone(repeatedSeed);
    candidate.eventTime = new Date(Date.parse('2026-08-28T00:00:00.000Z') + index * 1000).toISOString();
    repeatedHistory.push(abi5.projectRuntimeEventFromValidatedHistory(repeatedHistory, candidate));
  }
  const graphCandidate = structuredClone(abi5Candidates()[1]);
  graphCandidate.eventTime = '2026-08-28T00:04:00.000Z';
  graphCandidate.causationEventRefs = repeatedHistory.map((event) => event.eventId);
  const overBoundCausation = abi5.projectRuntimeEventFromValidatedHistory(repeatedHistory, graphCandidate);
  writeEventCarrier(fixture.eventPath, [...repeatedHistory, overBoundCausation]);
  const causationIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(causationIndex.state, 'invalid');
  assert.ok(causationIndex.diagnostics.some((entry) => (
    entry.message.includes('causationEventRefs exceed the bounded visual projection limit')
  )));

  const overBoundParentCandidate = runtimeEventCandidate(fixture.events.at(-1));
  overBoundParentCandidate.parentAggregateId = `graph-call://fixture/${'p'.repeat(4096)}`;
  const overBoundParent = abi5.projectRuntimeEventFromValidatedHistory(
    fixture.events.slice(0, -1),
    overBoundParentCandidate,
  );
  writeEventCarrier(fixture.eventPath, [...fixture.events.slice(0, -1), overBoundParent]);
  const parentIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(parentIndex.state, 'invalid');
  assert.ok(parentIndex.diagnostics.some((entry) => (
    entry.message.includes('parentAggregateId is not a canonical bounded visual projection identity')
  )));

  const overBoundGraphRefCandidate = structuredClone(abi5Candidates()[0]);
  overBoundGraphRefCandidate.payload.graphRef = `graph://fixture/${'g'.repeat(4096)}`;
  const overBoundGraphRef = abi5.projectRuntimeEventFromValidatedHistory([], overBoundGraphRefCandidate);
  writeEventCarrier(fixture.eventPath, [overBoundGraphRef]);
  const graphRefIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(graphRefIndex.state, 'invalid');
  assert.ok(graphRefIndex.diagnostics.some((entry) => (
    entry.message.includes('graphRef is not a canonical bounded visual projection identity')
  )));

  const firstRunEvent = fixture.events[0];
  const pathGraphCallCandidate = structuredClone(runtimeEventCandidate(fixture.events[1]));
  pathGraphCallCandidate.aggregateId = '/private/tmp/SECRET_GRAPH_CALL';
  pathGraphCallCandidate.graphCallId = '/private/tmp/SECRET_GRAPH_CALL';
  pathGraphCallCandidate.payload.graphCallId = '/private/tmp/SECRET_GRAPH_CALL';
  const pathGraphCall = abi5.projectRuntimeEventFromValidatedHistory(
    [firstRunEvent],
    pathGraphCallCandidate,
  );
  writeEventCarrier(fixture.eventPath, [firstRunEvent, pathGraphCall]);
  const pathRefIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(pathRefIndex.state, 'invalid');
  assert.ok(pathRefIndex.diagnostics.some((entry) => (
    entry.message.includes('aggregateId is not a canonical bounded visual projection identity')
  )));
  assert.equal(JSON.stringify(pathRefIndex.diagnostics).includes('SECRET_GRAPH_CALL'), false);

  const controlGraphRefCandidate = structuredClone(abi5Candidates()[0]);
  controlGraphRefCandidate.payload.graphRef = 'graph://fixture/\u001bSECRET_GRAPH_REF';
  const controlGraphRef = abi5.projectRuntimeEventFromValidatedHistory([], controlGraphRefCandidate);
  writeEventCarrier(fixture.eventPath, [controlGraphRef]);
  const controlRefIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(controlRefIndex.state, 'invalid');
  assert.ok(controlRefIndex.diagnostics.some((entry) => (
    entry.message.includes('graphRef is not a canonical bounded visual projection identity')
  )));
  assert.equal(JSON.stringify(controlRefIndex.diagnostics).includes('SECRET_GRAPH_REF'), false);

  const externalLongKind = reprojectMutatedEvent({
    ...fixture.events[0],
    kind: 'a'.repeat(161),
  });
  writeEventCarrier(fixture.eventPath, [externalLongKind]);
  const kindIndex = indexAbgEventCarrier(fixture.eventPath, {
    refresh: true,
    publishedEventContractDigest: sha('9'),
    contractBindingPosture: 'durable_prefix_coordinate_verified',
  });
  assert.equal(kindIndex.state, 'invalid');
  assert.ok(kindIndex.diagnostics.some((entry) => (
    entry.message.includes('event kind exceeds the bounded visual projection limit')
  )));

  const valueHistory = [];
  for (const source of abi5Candidates().slice(0, 3)) {
    const candidate = structuredClone(source);
    if (valueHistory.length > 0) candidate.causationEventRefs = [valueHistory.at(-1).eventId];
    valueHistory.push(abi5.projectRuntimeEventFromValidatedHistory(valueHistory, candidate));
  }
  const cCallRef = 'c-call://fixture/abi5/value-digest-spoof';
  const spoofedValueCandidate = {
    kind: 'c_call_result_admitted',
    eventTime: '2026-08-28T00:00:04.000Z',
    aggregateType: 'c_call',
    aggregateId: cCallRef,
    parentAggregateId: 'frame://fixture/abi5/1',
    causationEventRefs: [valueHistory.at(-1).eventId],
    correlationId: 'correlation://fixture/abi5',
    workflowVersion: '5.0.0',
    scopeClass: 'run',
    basisId: 'basis://fixture/abi5',
    runId: 'run://fixture/abi5',
    graphCallId: 'graph-call://fixture/abi5/1',
    frameId: 'frame://fixture/abi5/1',
    frameLineageId: 'frame-lineage://fixture/1',
    graphFunctionRef: 'graph-function://fixture/abi5',
    payload: {
      cCallRef,
      resultClass: 'success',
      resultRef: 'result://fixture/abi5/value-digest-spoof',
      resultDigest: sha('8'),
      valueKind: 'worksite_construction_result',
      valueDigest: canonicalDigest({ retained: 'claimed' }),
      value: { retained: 'different' },
    },
  };

  const matchingValueCandidate = structuredClone(spoofedValueCandidate);
  matchingValueCandidate.payload.valueDigest = canonicalDigest(matchingValueCandidate.payload.value);
  const matchingValueEvent = abi5.projectRuntimeEventFromValidatedHistory(
    valueHistory,
    matchingValueCandidate,
  );
  writeEventCarrier(fixture.eventPath, [...valueHistory, matchingValueEvent]);
  const matchingValueIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(matchingValueIndex.state, 'ready', JSON.stringify(matchingValueIndex.diagnostics));

  const digestOnlyCandidate = structuredClone(matchingValueCandidate);
  delete digestOnlyCandidate.payload.value;
  const digestOnlyEvent = abi5.projectRuntimeEventFromValidatedHistory(
    valueHistory,
    digestOnlyCandidate,
  );
  writeEventCarrier(fixture.eventPath, [...valueHistory, digestOnlyEvent]);
  const digestOnlyIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(digestOnlyIndex.state, 'ready', JSON.stringify(digestOnlyIndex.diagnostics));

  const spoofedValueEvent = abi5.projectRuntimeEventFromValidatedHistory(
    valueHistory,
    spoofedValueCandidate,
  );
  writeEventCarrier(fixture.eventPath, [...valueHistory, spoofedValueEvent]);
  const spoofedValueIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(spoofedValueIndex.state, 'invalid');
  assert.ok(spoofedValueIndex.diagnostics.some((entry) => (
    entry.message.includes('valueDigest does not certify the compacted payload value')
  )));
});

test('visual occurrence projection bounds causation work and output at exact retained relation boundaries', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async (context) => {
  const fixture = await createAbi5Fixture();
  context.after(fixture.cleanup);
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  const history = [];
  const runSeed = abi5Candidates()[0];
  for (let index = 0; index < 200; index += 1) {
    const candidate = structuredClone(runSeed);
    candidate.eventTime = new Date(Date.parse('2026-08-28T00:00:00.000Z') + index * 1000).toISOString();
    history.push(abi5.projectRuntimeEventFromValidatedHistory(history, candidate));
  }
  const causes = history.map((event) => event.eventId);
  for (let index = 0; index < 3; index += 1) {
    const candidate = structuredClone(abi5Candidates()[1]);
    const graphCallId = `graph-call://fixture/bounded-causation/${index + 1}`;
    candidate.eventTime = new Date(Date.parse('2026-08-28T00:05:00.000Z') + index * 1000).toISOString();
    candidate.aggregateId = graphCallId;
    candidate.graphCallId = graphCallId;
    candidate.payload.graphCallId = graphCallId;
    candidate.causationEventRefs = causes;
    history.push(abi5.projectRuntimeEventFromValidatedHistory(history, candidate));
  }
  writeEventCarrier(fixture.eventPath, history);
  const index = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(index.state, 'ready', JSON.stringify(index.diagnostics));
  const projection = loadVisualGraphProjection(fixture.projectRoot, {
    runId: 'run://fixture/abi5',
    generation: index.generation,
    refresh: true,
  });
  assert.equal(projection.state, 'partial');
  assert.equal(projection.occurrenceGraph.edges.length, 480);
  assert.equal(projection.limits.edgesTruncated, true);
  assert.ok(projection.diagnostics.some((entry) => entry.code === 'occurrence_edges_bounded'));

  const nodeHistory = [abi5.projectRuntimeEventFromValidatedHistory([], structuredClone(runSeed))];
  for (let index = 0; index < 240; index += 1) {
    const candidate = structuredClone(abi5Candidates()[1]);
    const graphCallId = `graph-call://fixture/bounded-nodes/${index + 1}`;
    candidate.eventTime = new Date(Date.parse('2026-08-28T01:00:00.000Z') + index * 1000).toISOString();
    candidate.aggregateId = graphCallId;
    candidate.graphCallId = graphCallId;
    candidate.payload.graphCallId = graphCallId;
    nodeHistory.push(abi5.projectRuntimeEventFromValidatedHistory(nodeHistory, candidate));
  }
  writeEventCarrier(fixture.eventPath, nodeHistory);
  const nodeIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(nodeIndex.state, 'ready', JSON.stringify(nodeIndex.diagnostics));
  const nodeProjection = loadVisualGraphProjection(fixture.projectRoot, {
    runId: 'run://fixture/abi5',
    generation: nodeIndex.generation,
    refresh: true,
  });
  assert.equal(nodeProjection.state, 'partial');
  assert.equal(nodeProjection.occurrenceGraph.nodes.length, 240);
  assert.equal(nodeProjection.limits.nodesTruncated, true);
  assert.ok(nodeProjection.diagnostics.some((entry) => entry.code === 'occurrence_nodes_bounded'));

  const declarationHistory = [];
  for (let index = 0; index < 241; index += 1) {
    const candidate = structuredClone(runSeed);
    const graphFunctionRef = `graph-function://fixture/bounded-declaration/${index + 1}`;
    candidate.eventTime = new Date(Date.parse('2026-08-28T02:00:00.000Z') + index * 1000).toISOString();
    candidate.graphFunctionRef = graphFunctionRef;
    candidate.payload.graphFunctionRef = graphFunctionRef;
    declarationHistory.push(abi5.projectRuntimeEventFromValidatedHistory(declarationHistory, candidate));
  }
  writeEventCarrier(fixture.eventPath, declarationHistory);
  const declarationIndex = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(declarationIndex.state, 'ready', JSON.stringify(declarationIndex.diagnostics));
  const declarationProjection = loadVisualGraphProjection(fixture.projectRoot, {
    runId: 'run://fixture/abi5',
    generation: declarationIndex.generation,
    refresh: true,
  });
  assert.equal(declarationProjection.state, 'partial');
  assert.equal(declarationProjection.declarationTopology.state, 'partial');
  assert.equal(declarationProjection.declarationTopology.references.length, 240);
  assert.equal(declarationProjection.occurrenceGraph.state, 'ready');
  assert.equal(declarationProjection.limits.nodesTruncated, true);
  assert.ok(declarationProjection.diagnostics.some((entry) => (
    entry.code === 'declaration_references_bounded'
  )));
});

test('visual graph projection sanitizes unsafe sandbox scenario labels and never throws across its contract boundary', {
  skip: !exactAbi5ArtifactAvailable && 'ABIogenesis 5.0 artifact is not present in this workspace',
}, async (context) => {
  const fixture = await createAbi5Fixture();
  context.after(fixture.cleanup);
  for (const identityPath of [
    join(fixture.runRoot, 'sandbox-identity.json'),
    join(fixture.workspaceRoot, '.ai-workspace', 'sandbox-identity.json'),
  ]) {
    const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
    identity.scenarioId = 'unsafe scenario';
    writeJson(identityPath, identity);
  }
  const index = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  let projection;
  assert.doesNotThrow(() => {
    projection = loadVisualGraphProjection(fixture.projectRoot, {
      runId: 'run://fixture/abi5',
      generation: index.generation,
      refresh: true,
    });
  });
  assert.equal(projection.state, 'partial');
  assert.equal(projection.run.scenarioId, null);
  assert.equal(JSON.stringify(projection).includes('unsafe scenario'), false);
});
