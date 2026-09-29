import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { visualGraphProjectionSchema } from '@odd-manager/developer-control-contracts';
import { ABI5_ROOT_EVENT_CONTRACT_DIGEST } from '../../src/server/abg-event-carrier-service.mjs';
import { discoverProjectObservationTopology } from '../../src/server/project-observation-topology-service.mjs';
import { loadVisualGraphProjection } from '../../src/server/visual-graph-projection-service.mjs';
import {
  ABI5_EVENT_MODULE_PATH,
  exactAbi5ArtifactAvailable,
  fixtureSha,
} from '../../qualification/abg5-run-fixture.mjs';

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function digest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function canonicalDigest(value) {
  return digest(canonicalJson(value));
}

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

async function actorProcessEvents() {
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  const runId = 'run://fixture/actor-process-pairing';
  const graphCallId = 'graph-call://fixture/actor-process-pairing';
  const frameId = 'frame://fixture/actor-process-pairing';
  const cCallRef = 'c-call://fixture/actor-process-pairing';
  const actorA = 'actor-invocation://fixture/a';
  const actorB = 'actor-invocation://fixture/b';
  const processA1 = 'process://fixture/a/1';
  const processA2 = 'process://fixture/a/2';
  const crossedProcessB = 'process://fixture/b/crossed';
  const base = (kind, index, aggregateType, aggregateId, parentAggregateId, payload, identities = {}) => ({
    kind,
    eventTime: new Date(Date.parse('2026-09-02T00:00:00.000Z') + index * 1000).toISOString(),
    aggregateType,
    aggregateId,
    parentAggregateId,
    causationEventRefs: [],
    correlationId: 'correlation://fixture/actor-process-pairing',
    workflowVersion: '5.0.0',
    scopeClass: 'run',
    basisId: 'basis://fixture/actor-process-pairing',
    ...identities,
    payload,
  });
  const scoped = { runId, graphCallId, frameId };
  const candidates = [
    base('run_segment_opened', 0, 'run', runId, null, {
      executionBasisDigest: fixtureSha('1'),
      executionBasisRef: 'execution-basis://fixture/actor-process-pairing',
      graphDigest: fixtureSha('2'),
      graphFunctionRef: 'graph-function://fixture/actor-process-pairing',
      graphRef: 'graph://fixture/actor-process-pairing',
      invocationAdmissionRef: 'invocation-admission://fixture/actor-process-pairing',
      invocationRef: 'invocation://fixture/actor-process-pairing',
      programRef: 'program://fixture/actor-process-pairing',
      runDigest: fixtureSha('3'),
      runId,
      workspaceBindingId: 'workspace-binding://fixture/actor-process-pairing',
    }, { runId }),
    base('actor_invocation_started', 1, 'actor_invocation', actorA, cCallRef, {
      actorInvocationRef: actorA,
      actorRef: 'actor://fixture/a',
      cCallRef,
      transportBindingRef: 'transport-binding://fixture/a',
    }, scoped),
    base('actor_process_started', 2, 'process', processA1, actorA, {
      actorInvocationRef: actorA,
      processId: 101,
      processRef: processA1,
    }, scoped),
    base('actor_process_exited', 3, 'process', processA1, actorA, {
      actorInvocationRef: actorA,
      processRef: processA1,
      signal: null,
      status: 0,
    }, scoped),
    base('actor_process_started', 4, 'process', processA2, actorA, {
      actorInvocationRef: actorA,
      processId: 102,
      processRef: processA2,
    }, scoped),
    base('actor_invocation_closed', 5, 'actor_invocation', actorA, cCallRef, {
      actorInvocationRef: actorA,
      cCallRef,
      disposition: 'success',
      processRef: processA2,
    }, scoped),
    base('actor_invocation_started', 6, 'actor_invocation', actorB, cCallRef, {
      actorInvocationRef: actorB,
      actorRef: 'actor://fixture/b',
      cCallRef,
      transportBindingRef: 'transport-binding://fixture/b',
    }, scoped),
    base('actor_process_started', 7, 'process', crossedProcessB, actorB, {
      actorInvocationRef: actorA,
      processId: 201,
      processRef: crossedProcessB,
    }, scoped),
  ];
  const events = [];
  for (const candidate of candidates) {
    events.push(abi5.projectRuntimeEventFromValidatedHistory(events, candidate));
  }
  return {
    events,
    runId,
    actorA,
    actorB,
    processA1,
    processA2,
    crossedProcessB,
  };
}

async function actorOnlyEvents(count) {
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  const runId = 'run://fixture/actor-session-bound';
  const graphCallId = 'graph-call://fixture/actor-session-bound';
  const frameId = 'frame://fixture/actor-session-bound';
  const cCallRef = 'c-call://fixture/actor-session-bound';
  const base = (kind, index, aggregateType, aggregateId, parentAggregateId, payload, identities = {}) => ({
    kind,
    eventTime: new Date(Date.parse('2026-09-02T01:00:00.000Z') + index * 1000).toISOString(),
    aggregateType,
    aggregateId,
    parentAggregateId,
    causationEventRefs: [],
    correlationId: 'correlation://fixture/actor-session-bound',
    workflowVersion: '5.0.0',
    scopeClass: 'run',
    basisId: 'basis://fixture/actor-session-bound',
    ...identities,
    payload,
  });
  const candidates = [base('run_segment_opened', 0, 'run', runId, null, {
    executionBasisDigest: fixtureSha('1'),
    executionBasisRef: 'execution-basis://fixture/actor-session-bound',
    graphDigest: fixtureSha('2'),
    graphFunctionRef: 'graph-function://fixture/actor-session-bound',
    graphRef: 'graph://fixture/actor-session-bound',
    invocationAdmissionRef: 'invocation-admission://fixture/actor-session-bound',
    invocationRef: 'invocation://fixture/actor-session-bound',
    programRef: 'program://fixture/actor-session-bound',
    runDigest: fixtureSha('3'),
    runId,
    workspaceBindingId: 'workspace-binding://fixture/actor-session-bound',
  }, { runId })];
  const actorIds = [];
  for (let index = 0; index < count; index += 1) {
    const actorInvocationId = `actor-invocation://fixture/bounded/${String(index).padStart(3, '0')}`;
    actorIds.push(actorInvocationId);
    candidates.push(base(
      'actor_invocation_started',
      index + 1,
      'actor_invocation',
      actorInvocationId,
      cCallRef,
      {
        actorInvocationRef: actorInvocationId,
        actorRef: `actor://fixture/bounded/${String(index).padStart(3, '0')}`,
        cCallRef,
        transportBindingRef: `transport-binding://fixture/bounded/${String(index).padStart(3, '0')}`,
      },
      { runId, graphCallId, frameId },
    ));
  }
  const events = [];
  for (const candidate of candidates) {
    events.push(abi5.projectRuntimeEventFromValidatedHistory(events, candidate));
  }
  return { events, runId, actorIds };
}

async function createFixture(eventContractDigest, emittedInput = null) {
  const holderRoot = mkdtempSync(join(tmpdir(), 'odd-manager-actor-process-pairing-'));
  const projectRoot = join(holderRoot, 'project');
  const runRoot = join(projectRoot, 'test_runs', 'actor-process-pairing', 'run-1');
  const eventPath = join(runRoot, 'runtime', 'events.jsonl');
  const emitted = emittedInput ?? await actorProcessEvents();
  const eventBytes = `${emitted.events.map(canonicalJson).join('\n')}\n`;
  write(eventPath, eventBytes);
  mkdirSync(join(runRoot, 'worksite'), { recursive: true });
  write(join(projectRoot, 'specification', 'PRODUCT.md'), '# actor_process_pairing fixture\n');
  const eventStats = statSync(eventPath);
  const coordinateBody = {
    kind: 'durable_prefix_coordinate',
    schemaVersion: '5.0.0',
    eventLogRef: pathToFileURL(eventPath).href,
    prefixLength: Buffer.byteLength(eventBytes),
    prefixDigest: digest(eventBytes),
    storeIdentity: {
      device: eventStats.dev,
      inode: eventStats.ino,
      eventContractDigest,
    },
  };
  const evidence = {
    kind: 'generic_live_workflow_evidence_candidate',
    schemaVersion: '1',
    authority: 'diagnostic_only',
    disposition: 'awaiting_review',
    scenarioKey: 'actor-process-pairing',
    scenarioId: 'SCN-ACTOR-PROCESS-PAIRING',
    abiArtifact: {
      productId: 'product://abiogenesis/typescript-tenant@5.0.0-fixture',
      packageVersion: '5.0.0-fixture',
      productContentDigest: fixtureSha('4'),
      productManifestDigest: fixtureSha('5'),
    },
    terminalPrefix: {
      ...coordinateBody,
      coordinateDigest: canonicalDigest(coordinateBody),
    },
    run: { ref: emitted.runId, digest: fixtureSha('6') },
    validation: {
      kind: 'generic_scenario_validation',
      schemaVersion: '1',
      disposition: 'satisfied',
    },
    files: [],
  };
  write(
    join(runRoot, 'generic-live-workflow-evidence-candidate.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  const matches = topology.runs.filter((run) => run.runId === emitted.runId);
  assert.equal(matches.length, 1, JSON.stringify(topology.diagnostics));
  return {
    projectRoot,
    emitted,
    generation: matches[0].eventGeneration,
    cleanup: () => rmSync(holderRoot, { recursive: true, force: true }),
  };
}

function loadFixture(fixture) {
  return loadVisualGraphProjection(fixture.projectRoot, {
    runId: fixture.emitted.runId,
    generation: fixture.generation,
    refresh: true,
  });
}

test('built-in ABI5 actor sessions retain distinct exact actor/process loci and withhold a crossed payload identity', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createFixture(ABI5_ROOT_EVENT_CONTRACT_DIGEST);
  context.after(fixture.cleanup);
  const projection = loadFixture(fixture);

  assert.equal(visualGraphProjectionSchema.safeParse(projection).success, true);
  assert.equal(projection.state, 'partial');
  assert.equal(projection.actorSessions.state, 'partial');
  assert.equal(projection.actorSessions.interactionDisposition, 'unavailable');
  assert.equal(projection.actorSessions.sessions.length, 3);
  assert.equal(new Set(projection.actorSessions.sessions.map((session) => session.id)).size, 3);

  const actorASessions = projection.actorSessions.sessions.filter(
    (session) => session.actorInvocationId === fixture.emitted.actorA,
  );
  assert.deepEqual(
    actorASessions.map((session) => session.processAggregateId).sort(),
    [fixture.emitted.processA1, fixture.emitted.processA2].sort(),
  );
  const exitedProcess = actorASessions.find(
    (session) => session.processAggregateId === fixture.emitted.processA1,
  );
  assert.equal(exitedProcess.actorRef, 'actor://fixture/a');
  assert.equal(exitedProcess.lifecycleState, 'completed');
  assert.equal(exitedProcess.terminalDisposition, 'completed');
  assert.equal(exitedProcess.canAttach, false);

  const stillRunningProcess = actorASessions.find(
    (session) => session.processAggregateId === fixture.emitted.processA2,
  );
  assert.equal(stillRunningProcess.actorRef, 'actor://fixture/a');
  assert.equal(stillRunningProcess.lifecycleState, 'running');
  assert.equal(stillRunningProcess.terminalDisposition, 'unavailable');
  assert.equal(stillRunningProcess.canAttach, false);

  const actorBSession = projection.actorSessions.sessions.find(
    (session) => session.actorInvocationId === fixture.emitted.actorB,
  );
  assert.equal(actorBSession.processAggregateId, null);
  assert.equal(actorBSession.lifecycleState, 'running');
  assert.equal(actorBSession.canAttach, false);
  assert.equal(
    projection.actorSessions.sessions.some(
      (session) => session.processAggregateId === fixture.emitted.crossedProcessB,
    ),
    false,
  );
  assert.ok(projection.diagnostics.some(
    (entry) => entry.code === 'actor_process_relation_conflicting',
  ));
});

test('external ABI5 structural observation pairs only through the retained parent and leaves lifecycle semantics unknown', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createFixture(fixtureSha('9'));
  context.after(fixture.cleanup);
  const projection = loadFixture(fixture);

  assert.equal(visualGraphProjectionSchema.safeParse(projection).success, true);
  assert.equal(projection.actorSessions.sessions.length, 3);
  const structurallyPaired = projection.actorSessions.sessions.find(
    (session) => session.processAggregateId === fixture.emitted.crossedProcessB,
  );
  assert.equal(structurallyPaired.actorInvocationId, fixture.emitted.actorB);
  assert.ok(projection.actorSessions.sessions.every((session) => (
    session.lifecycleState === 'unknown'
    && session.terminalDisposition === 'unknown'
    && session.actorRef === null
    && session.canAttach === false
  )));
  assert.equal(
    projection.diagnostics.some((entry) => entry.code === 'actor_process_relation_conflicting'),
    false,
  );
  assert.ok(projection.diagnostics.some(
    (entry) => entry.code === 'external_event_contract_lifecycle_uninterpreted',
  ));
});

test('actor-session loci are deterministically bounded without admitting attach capability', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const emitted = await actorOnlyEvents(81);
  const fixture = await createFixture(ABI5_ROOT_EVENT_CONTRACT_DIGEST, emitted);
  context.after(fixture.cleanup);
  const first = loadFixture(fixture);
  const second = loadFixture(fixture);

  assert.equal(first.actorSessions.sessions.length, 80);
  assert.equal(first.limits.actorSessionsTruncated, true);
  assert.ok(first.diagnostics.some((entry) => entry.code === 'actor_sessions_bounded'));
  assert.deepEqual(
    first.actorSessions.sessions.map((session) => session.id),
    second.actorSessions.sessions.map((session) => session.id),
  );
  assert.deepEqual(
    first.actorSessions.sessions.map((session) => session.actorInvocationId),
    emitted.actorIds.slice(0, 80),
  );
  assert.ok(first.actorSessions.sessions.every((session) => session.canAttach === false));
  assert.equal(visualGraphProjectionSchema.safeParse(first).success, true);
});
