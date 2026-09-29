import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { visualGraphProjectionSchema } from '@odd-manager/developer-control-contracts';
import {
  ABI5_ROOT_EVENT_CONTRACT_DIGEST,
  indexAbgEventCarrier,
} from '../../src/server/abg-event-carrier-service.mjs';
import {
  discoverProjectObservationTopology,
  selectObservationRun,
} from '../../src/server/project-observation-topology-service.mjs';
import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';
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

function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
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

function bytesDigest(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

async function syntheticEvents(options = {}) {
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  const runId = 'run://fixture/visual-graph';
  const graphCallId = 'graph-call://fixture/visual-graph/1';
  const frameId = 'frame://fixture/visual-graph/1';
  const graphFunctionRef = 'graph-function://fixture/visual-graph';
  const constructionResultEventCount = options.constructionResultEvents?.length ?? 0;
  const openActorEventCount = options.openActorChild === true ? 1 : 0;
  const openActorInvocationId = 'actor-invocation://fixture/visual-graph/open-child';
  const base = (kind, index, aggregateType, aggregateId, parentAggregateId, payload, identities = {}) => ({
    kind,
    eventTime: new Date(Date.parse('2026-09-02T00:00:00.000Z') + index * 1000).toISOString(),
    aggregateType,
    aggregateId,
    parentAggregateId,
    causationEventRefs: [],
    correlationId: 'correlation://fixture/visual-graph',
    workflowVersion: '5.0.0',
    scopeClass: 'run',
    basisId: 'basis://fixture/visual-graph',
    ...identities,
    payload,
  });
  const candidates = [
    base('run_segment_opened', 0, 'run', runId, null, {
      executionBasisDigest: fixtureSha('a'),
      executionBasisRef: 'execution-basis://fixture/visual-graph',
      graphDigest: fixtureSha('b'),
      graphFunctionRef,
      graphRef: 'graph://fixture/visual-graph',
      invocationAdmissionRef: 'invocation-admission://fixture/visual-graph',
      invocationRef: 'invocation://fixture/visual-graph',
      programRef: 'program://fixture/visual-graph',
      runDigest: fixtureSha('c'),
      runId,
      workspaceBindingId: 'workspace-binding://fixture/visual-graph',
    }, { runId, graphFunctionRef }),
    base('graph_call_opened', 1, 'graph_call', graphCallId, runId, {
      graphCallId,
      graphCallDigest: fixtureSha('d'),
    }, { runId, graphCallId, graphFunctionRef }),
    base(
      'frame_opened',
      2,
      'frame',
      frameId,
      options.frameParentMode === 'deferred' ? null : graphCallId,
      {
      frameId,
      frameDigest: fixtureSha('e'),
      frameLineageId: 'frame-lineage://fixture/visual-graph',
      attempt: 1,
      parentFrameId: null,
      },
      {
        runId,
        graphCallId,
        frameId,
        frameLineageId: 'frame-lineage://fixture/visual-graph',
        graphFunctionRef,
      },
    ),
    ...(options.constructionResultEvents ?? []).map((descriptor, offset) => {
      const cCallRef = descriptor.cCallRef ?? `c-call://fixture/visual-graph/result-${offset + 1}`;
      const value = descriptor.matchConstructionResult
        ? structuredClone(options.constructionResultValue)
        : structuredClone(descriptor.value);
      const valueDigest = value === undefined
        ? null
        : descriptor.claimedValueDigest ?? canonicalDigest(value);
      const payload = {
        cCallRef,
        resultClass: 'success',
        resultRef: descriptor.resultRef ?? `result://fixture/visual-graph/${offset + 1}`,
        resultDigest: descriptor.resultDigest ?? canonicalDigest({
          resultRef: descriptor.resultRef ?? `result://fixture/visual-graph/${offset + 1}`,
          valueDigest,
        }),
        valueKind: descriptor.valueKind ?? 'worksite_construction_result',
        ...(value === undefined ? {} : { value, valueDigest }),
      };
      return base('c_call_result_admitted', 3 + offset, 'c_call', cCallRef, frameId, payload, {
        runId,
        graphCallId,
        frameId,
        frameLineageId: 'frame-lineage://fixture/visual-graph',
        graphFunctionRef,
      });
    }),
    ...(options.openActorChild === true ? [base(
      'actor_invocation_started',
      3 + constructionResultEventCount,
      'actor_invocation',
      openActorInvocationId,
      'c-call://fixture/visual-graph/open-child-parent',
      {
        actorInvocationRef: openActorInvocationId,
        actorRef: 'actor://fixture/visual-graph/open-child',
        cCallRef: 'c-call://fixture/visual-graph/open-child-parent',
        transportBindingRef: 'transport-binding://fixture/visual-graph/open-child',
      },
      {
        runId,
        graphCallId,
        frameId,
        frameLineageId: 'frame-lineage://fixture/visual-graph',
        graphFunctionRef,
      },
    )] : []),
    base(
      'terminal_reached',
      3 + constructionResultEventCount + openActorEventCount,
      'frame',
      frameId,
      options.frameParentMode === 'conflicting' ? runId : graphCallId,
      {
      closureRef: 'closure://fixture/visual-graph',
      closureDigest: fixtureSha('f'),
      routeRef: 'route://fixture/visual-graph/terminal',
      terminalKind: 'completed',
      },
      {
        runId,
        graphCallId,
        frameId,
        frameLineageId: 'frame-lineage://fixture/visual-graph',
        graphFunctionRef,
      },
    ),
    base('frame_closed', 4 + constructionResultEventCount + openActorEventCount, 'frame', frameId, graphCallId, {
      frameId,
      terminalReachedEventRef: '__terminal__',
    }, {
      runId,
      graphCallId,
      frameId,
      frameLineageId: 'frame-lineage://fixture/visual-graph',
      graphFunctionRef,
    }),
    base('graph_call_closed', 5 + constructionResultEventCount + openActorEventCount, 'graph_call', graphCallId, runId, {
      graphCallId,
      frameClosedEventRef: '__frame_closed__',
    }, { runId, graphCallId, graphFunctionRef }),
    base('run_closed', 6 + constructionResultEventCount + openActorEventCount, 'run', runId, null, {
      runId,
      graphCallClosedEventRef: '__graph_closed__',
    }, { runId, graphFunctionRef }),
  ];
  const history = [];
  for (const [index, source] of candidates.entries()) {
    const candidate = structuredClone(source);
    if (index === 1) candidate.causationEventRefs = [history[0].eventId];
    if (candidate.kind === 'c_call_result_admitted') {
      candidate.causationEventRefs = [history.find((event) => event.kind === 'frame_opened').eventId];
    }
    if (candidate.kind === 'terminal_reached') candidate.causationEventRefs = [history[0].eventId];
    if (['frame_closed', 'graph_call_closed', 'run_closed'].includes(candidate.kind)) {
      candidate.causationEventRefs = [history.at(-1).eventId];
    }
    if (candidate.payload.terminalReachedEventRef === '__terminal__') {
      candidate.payload.terminalReachedEventRef = history.find((event) => event.kind === 'terminal_reached').eventId;
    }
    if (candidate.payload.frameClosedEventRef === '__frame_closed__') {
      candidate.payload.frameClosedEventRef = history.find((event) => event.kind === 'frame_closed').eventId;
    }
    if (candidate.payload.graphCallClosedEventRef === '__graph_closed__') {
      candidate.payload.graphCallClosedEventRef = history.find((event) => event.kind === 'graph_call_closed').eventId;
    }
    history.push(abi5.projectRuntimeEventFromValidatedHistory(history, candidate));
  }
  return { events: history, runId, graphCallId, frameId, openActorInvocationId };
}

async function createGenericFixture(options = {}) {
  const holderRoot = mkdtempSync(join(tmpdir(), 'odd-manager-visual-graph-'));
  const projectRoot = join(holderRoot, 'project');
  const runRoot = join(projectRoot, 'test_runs', 'generic-live-workflow', 'fixture', 'run-1');
  const workspaceRoot = join(runRoot, 'worksite');
  const eventPath = join(runRoot, 'runtime', 'events.jsonl');
  const worksiteBytes = 'retained workspace bytes\n';
  const worksitePath = join(workspaceRoot, 'artifact.txt');
  write(worksitePath, worksiteBytes);
  write(join(projectRoot, 'specification', 'PRODUCT.md'), '# visual_graph_fixture Product\n');
  const predecessorDigest = fixtureSha('1');
  const successorDigest = fixtureSha('2');
  const subjectDigest = fixtureSha('3');
  const bindingDigest = fixtureSha('4');
  const fileDigest = bytesDigest(worksiteBytes);
  const predecessorObservation = {
    kind: 'worksite_observation',
    schemaVersion: '5.0.0',
    observationRef: `worksite-observation://fixture/${predecessorDigest.slice(7)}`,
    observationDigest: predecessorDigest,
    workspaceBindingIdentity: `workspace-binding://fixture/${bindingDigest.slice(7)}`,
    subjectRef: `worksite-subject://fixture/${subjectDigest.slice(7)}`,
    subjectDigest,
    state: 'absent',
  };
  const successorObservation = {
    kind: 'worksite_observation',
    schemaVersion: '5.0.0',
    observationRef: `worksite-observation://fixture/${successorDigest.slice(7)}`,
    observationDigest: successorDigest,
    workspaceBindingIdentity: `workspace-binding://fixture/${bindingDigest.slice(7)}`,
    subjectRef: `worksite-subject://fixture/${subjectDigest.slice(7)}`,
    subjectDigest,
    state: 'file',
    byteLength: Buffer.byteLength(worksiteBytes),
    fileDigest,
  };
  const receipt = {
    kind: 'worksite_file_replace_receipt',
    schemaVersion: '5.0.0',
    receiptRef: 'worksite-file-replace-receipt://fixture/1',
    receiptDigest: fixtureSha('5'),
    authorizationRef: 'worksite-effect-authorization://fixture/1',
    authorizationDigest: fixtureSha('6'),
    beforeObservationRef: predecessorObservation.observationRef,
    beforeObservationDigest: predecessorObservation.observationDigest,
    afterObservationRef: successorObservation.observationRef,
    afterObservationDigest: successorObservation.observationDigest,
    writtenDigest: fileDigest,
    committed: true,
  };
  const constructionMembers = [{
    ordinal: 0,
    inputMemberRef: 'worksite-construction-target://fixture/1',
    outputMemberRef: 'fan-out-output-member://fixture/1',
    receipt,
    successorObservation,
  }];
  const constructionBody = {
    sourceApplicationRef: 'graph-function-application://fixture/1',
    members: constructionMembers,
  };
  const constructionResultDigest = canonicalDigest(constructionBody);
  const constructionResult = {
    kind: 'worksite_construction_result',
    schemaVersion: '5.0.0',
    resultRef: `worksite-construction-result://abiogenesis/${constructionResultDigest.slice('sha256:'.length)}`,
    resultDigest: constructionResultDigest,
    ...constructionBody,
  };
  const emitted = await syntheticEvents({
    ...options,
    constructionResultValue: constructionResult,
  });
  const eventBytes = `${emitted.events.map(canonicalJson).join('\n')}\n`;
  const actualEventPath = options.eventEscape
    ? join(holderRoot, 'outside', 'events.jsonl')
    : eventPath;
  write(actualEventPath, eventBytes);
  if (options.eventEscape) {
    mkdirSync(dirname(eventPath), { recursive: true });
    symlinkSync(actualEventPath, eventPath);
  }
  const eventStats = statSync(eventPath);
  const publishedEventContractDigest = options.eventContractDigest
    ?? fixtureSha('9');
  const coordinateBody = {
    kind: 'durable_prefix_coordinate',
    schemaVersion: '5.0.0',
    eventLogRef: pathToFileURL(eventPath).href,
    prefixLength: Buffer.byteLength(eventBytes),
    prefixDigest: options.prefixMismatch ? fixtureSha('7') : bytesDigest(eventBytes),
    storeIdentity: {
      device: eventStats.dev,
      inode: eventStats.ino,
      eventContractDigest: publishedEventContractDigest,
    },
  };
  const evidence = {
    kind: 'generic_live_workflow_evidence_candidate',
    schemaVersion: '1',
    authority: 'diagnostic_only',
    disposition: 'awaiting_review',
    scenarioKey: 'fixture',
    scenarioId: 'SCN-VISUAL-GRAPH-FIXTURE',
    abiArtifact: {
      path: '/private/tmp/SECRET_ARTIFACT.tgz',
      sha256: fixtureSha('a'),
      productId: 'product://abiogenesis/typescript-tenant@5.0.0-fixture',
      packageVersion: '5.0.0-fixture',
      productContentDigest: fixtureSha('b'),
      productManifestDigest: fixtureSha('c'),
    },
    worker: {
      actorRef: 'actor://fixture/worker',
      appendArgs: ['--secret', 'TOP_SECRET_ARGUMENT'],
      prompt: 'TOP_SECRET_PROMPT',
      promptDigest: fixtureSha('d'),
    },
    terminalPrefix: {
      ...coordinateBody,
      coordinateDigest: canonicalDigest(coordinateBody),
    },
    run: { ref: emitted.runId, digest: fixtureSha('8') },
    validation: {
      kind: 'generic_scenario_validation',
      schemaVersion: '1',
      disposition: 'satisfied',
      commands: [{
        id: 'validation://fixture/secret',
        cwd: '/private/tmp/SECRET_CWD',
        command: 'secret-command',
        args: ['TOP_SECRET_ARGUMENT'],
        exitCode: 0,
        stdout: 'TOP_SECRET_STDOUT',
        stderr: '',
      }],
      predicates: [],
      reports: { rows: [], totals: null },
    },
    constructionResult,
    files: [{
      ordinal: 0,
      relativePath: 'artifact.txt',
      predecessorObservation,
      successorObservation,
      byteLength: Buffer.byteLength(worksiteBytes),
      sha256: fileDigest,
    }],
  };
  write(
    join(runRoot, 'generic-live-workflow-evidence-candidate.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  return {
    holderRoot,
    projectRoot,
    runRoot,
    workspaceRoot,
    eventPath,
    emitted,
    constructionResult,
    publishedEventContractDigest,
    cleanup: () => rmSync(holderRoot, { recursive: true, force: true }),
  };
}

function fixtureGeneration(fixture) {
  const topology = discoverProjectObservationTopology(fixture.projectRoot, { refresh: true });
  const matches = topology.runs.filter((run) => run.runId === fixture.emitted.runId);
  assert.equal(matches.length, 1);
  return matches[0].eventGeneration;
}

function loadFixtureProjection(fixture, input = {}) {
  return loadVisualGraphProjection(fixture.projectRoot, {
    runId: fixture.emitted.runId,
    generation: fixtureGeneration(fixture),
    refresh: true,
    ...input,
  });
}

test('visual graph projection uses only explicit aggregate parents and causation, folds closed active state, and redacts unsafe evidence', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
  });
  context.after(fixture.cleanup);

  const topology = discoverProjectObservationTopology(fixture.projectRoot, { refresh: true });
  assert.equal(selectObservationRun(topology), null, 'generic candidates require an explicit run identity');
  assert.equal(selectObservationRun(topology, fixture.emitted.runId)?.runId, fixture.emitted.runId);
  const generation = fixtureGeneration(fixture);
  const runKeyAlias = topology.runs.find((run) => run.runId === fixture.emitted.runId)?.runKey;
  assert.ok(runKeyAlias);
  const aliasProjection = loadVisualGraphProjection(fixture.projectRoot, {
    runId: runKeyAlias,
    generation,
    refresh: true,
  });
  assert.equal(aliasProjection.state, 'missing');
  assert.equal(aliasProjection.run, null);
  assert.ok(aliasProjection.diagnostics.some((entry) => entry.code === 'selected_run_missing'));

  const invalidIdentityProjection = loadVisualGraphProjection(fixture.projectRoot, {
    runId: 'not-a-published-run-identity',
    generation,
    refresh: true,
  });
  assert.equal(invalidIdentityProjection.state, 'invalid');
  assert.equal(invalidIdentityProjection.run, null);
  assert.ok(invalidIdentityProjection.diagnostics.some((entry) => entry.code === 'run_identity_invalid'));

  for (const [suppliedGeneration, code] of [
    [undefined, 'exact_event_generation_required'],
    ['not-a-digest', 'event_generation_invalid'],
    ['x'.repeat(4097), 'event_generation_invalid'],
  ]) {
    const invalidBasis = loadVisualGraphProjection(fixture.projectRoot, {
      runId: fixture.emitted.runId,
      ...(suppliedGeneration === undefined ? {} : { generation: suppliedGeneration }),
      refresh: true,
    });
    assert.equal(invalidBasis.state, 'invalid');
    assert.equal(invalidBasis.run, null);
    assert.ok(invalidBasis.diagnostics.some((entry) => entry.code === code));
  }

  const projection = loadFixtureProjection(fixture);
  assert.equal(visualGraphProjectionSchema.safeParse(projection).success, true);
  assert.equal(projection.state, 'partial');
  assert.equal(projection.run.runId, fixture.emitted.runId);
  assert.equal(projection.run.closed, true);
  assert.deepEqual(projection.occurrenceGraph.activeNodeIds, []);
  assert.ok(projection.occurrenceGraph.lastObservedNodeId);
  assert.equal(projection.declarationTopology.state, 'partial');
  assert.equal(projection.declarationTopology.nodes.length, 0);
  assert.equal(projection.declarationTopology.edges.length, 0);
  assert.ok(projection.declarationTopology.references.some((entry) => entry.kind === 'graph_function'));

  const graphNode = projection.occurrenceGraph.nodes.find((node) => node.aggregateId === fixture.emitted.graphCallId);
  const frameNode = projection.occurrenceGraph.nodes.find((node) => node.aggregateId === fixture.emitted.frameId);
  assert.ok(graphNode);
  assert.ok(frameNode);
  assert.ok(projection.occurrenceGraph.edges.some((edge) => (
    edge.kind === 'aggregate_parent'
    && edge.sourceNodeId === graphNode.id
    && edge.targetNodeId === frameNode.id
  )));
  assert.equal(projection.occurrenceGraph.edges.some((edge) => (
    edge.kind === 'event_causation'
    && edge.sourceEvent.eventId === fixture.emitted.events[1].eventId
    && edge.targetEvent.eventId === fixture.emitted.events[2].eventId
  )), false, 'ordinal adjacency is not a causation relation');
  assert.ok(projection.occurrenceGraph.edges.some((edge) => (
    edge.kind === 'event_causation'
    && edge.sourceEvent.eventId === fixture.emitted.events[0].eventId
    && edge.targetEvent.eventId === fixture.emitted.events[3].eventId
  )));

  assert.equal(projection.workspaceObservations.state, 'partial');
  assert.equal(projection.workspaceObservations.currentness, 'unobserved');
  assert.equal(projection.workspaceObservations.observations.length, 1);
  assert.deepEqual(projection.workspaceObservations.observations[0].current, {
    state: 'unobserved',
    byteLength: null,
    digest: null,
    posture: 'unavailable',
  });
  assert.ok(projection.diagnostics.some((entry) => (
    entry.code === 'workspace_current_subject_binding_unavailable'
  )));
  assert.equal(projection.actorSessions.interactionDisposition, 'unavailable');
  assert.equal(projection.actorSessions.sessions.length, 0);

  const serialized = JSON.stringify(projection);
  for (const forbidden of [
    'TOP_SECRET', 'relativePath', 'SECRET_CWD', 'secret-command',
    '"appendArgs"', '"prompt"', '"stdout"', '"args"', '"cwd"',
  ]) {
    assert.equal(serialized.includes(forbidden), false, `projection leaked ${forbidden}`);
  }
});

test('run closure does not fabricate closure for an explicitly open child occurrence', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
    openActorChild: true,
  });
  context.after(fixture.cleanup);

  const projection = loadFixtureProjection(fixture);
  const child = projection.occurrenceGraph.nodes.find((node) => (
    node.aggregateId === fixture.emitted.openActorInvocationId
  ));
  assert.equal(projection.run.closed, true);
  assert.equal(projection.occurrenceGraph.state, 'partial');
  assert.equal(child.state, 'open');
  assert.ok(projection.occurrenceGraph.activeNodeIds.includes(child.id));
  assert.ok(projection.diagnostics.some((entry) => (
    entry.code === 'closed_run_retains_active_children'
  )));
  assert.equal(visualGraphProjectionSchema.safeParse(projection).success, true);
});

test('occurrence parents may be published after first observation but conflicting explicit parents are withheld', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const deferred = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
    frameParentMode: 'deferred',
  });
  const conflicting = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
    frameParentMode: 'conflicting',
  });
  context.after(() => {
    deferred.cleanup();
    conflicting.cleanup();
  });

  const deferredProjection = loadFixtureProjection(deferred);
  const deferredGraph = deferredProjection.occurrenceGraph.nodes.find((node) => (
    node.aggregateId === deferred.emitted.graphCallId
  ));
  const deferredFrame = deferredProjection.occurrenceGraph.nodes.find((node) => (
    node.aggregateId === deferred.emitted.frameId
  ));
  assert.ok(deferredProjection.occurrenceGraph.edges.some((edge) => (
    edge.kind === 'aggregate_parent'
    && edge.sourceNodeId === deferredGraph.id
    && edge.targetNodeId === deferredFrame.id
    && edge.targetEvent.kind === 'terminal_reached'
  )));

  const conflictingProjection = loadFixtureProjection(conflicting);
  const conflictingFrame = conflictingProjection.occurrenceGraph.nodes.find((node) => (
    node.aggregateId === conflicting.emitted.frameId
  ));
  assert.equal(conflictingProjection.occurrenceGraph.edges.some((edge) => (
    edge.kind === 'aggregate_parent' && edge.targetNodeId === conflictingFrame.id
  )), false);
  assert.ok(conflictingProjection.diagnostics.some((entry) => (
    entry.code === 'aggregate_parent_identity_conflicting'
  )));
});

test('event contract identity remains unpublished without evidence and binds a distinct published durable-prefix contract without a false pinned claim', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture();
  context.after(fixture.cleanup);
  const unbound = indexAbgEventCarrier(fixture.eventPath, { refresh: true });
  assert.equal(unbound.eventContractDigest, null);
  assert.equal(unbound.builtInEventContractDigest, ABI5_ROOT_EVENT_CONTRACT_DIGEST);
  assert.equal(unbound.contractPosture, 'built_in_registry_envelope_validated_unpublished');

  const bound = indexAbgEventCarrier(fixture.eventPath, {
    refresh: true,
    publishedEventContractDigest: fixture.publishedEventContractDigest,
    contractBindingPosture: 'durable_prefix_coordinate_verified',
  });
  assert.equal(bound.eventContractDigest, fixture.publishedEventContractDigest);
  assert.equal(bound.builtInEventContractDigest, ABI5_ROOT_EVENT_CONTRACT_DIGEST);
  assert.equal(bound.contractPosture, 'published_contract_distinct_from_builtin_registry');
  assert.equal(bound.contractBindingPosture, 'durable_prefix_coordinate_verified');
  assert.equal(bound.builtInRootContractValidated, false);
  assert.equal(bound.eventPosture, 'external_contract_uninterpreted');
  assert.equal(bound.terminalEvent, null);
  assert.ok(bound.diagnostics.some((entry) => (
    entry.code === 'external_event_contract_semantics_uninterpreted'
  )));
  assert.notEqual(bound.contractPosture, 'pinned_root_envelope_verified');
});

test('a distinct external event contract retains structural projection when optional value and digest semantics differ', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture({
    constructionResultEvents: [{
      cCallRef: 'c-call://fixture/visual-graph/external-value',
      value: { kind: 'externally_defined_result', accepted: true },
      claimedValueDigest: fixtureSha('8'),
    }],
  });
  context.after(fixture.cleanup);

  const projection = loadFixtureProjection(fixture);
  const parsed = visualGraphProjectionSchema.safeParse(projection);
  assert.equal(parsed.success, true, parsed.success ? undefined : JSON.stringify(parsed.error.issues));
  assert.equal(projection.state, 'partial');
  assert.equal(projection.run.eventContract.posture, 'published_contract_distinct_from_builtin_registry');
  assert.equal(projection.run.eventPosture, 'external_contract_uninterpreted');
  assert.equal(projection.run.closed, false);
  assert.ok(projection.occurrenceGraph.nodes.some((node) => (
    node.aggregateId === 'c-call://fixture/visual-graph/external-value'
    && node.state === 'unknown'
  )));
  assert.equal(projection.workspaceObservations.state, 'partial');
  assert.equal(projection.workspaceObservations.observations.length, 1);
  assert.equal(projection.workspaceObservations.observations[0].sourceEvent, null);
  assert.ok(projection.diagnostics.some((entry) => (
    entry.code === 'external_event_contract_lifecycle_uninterpreted'
  )));
});

test('workspace projection admits only an exact retained O0/effect/O1 construction chain', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const missingOrdinal = await createGenericFixture();
  const missingFileDigest = await createGenericFixture();
  const mismatchedBinding = await createGenericFixture();
  const mismatchedMember = await createGenericFixture();
  const uncommittedReceipt = await createGenericFixture();
  const duplicateMember = await createGenericFixture();
  context.after(() => {
    missingOrdinal.cleanup();
    missingFileDigest.cleanup();
    mismatchedBinding.cleanup();
    mismatchedMember.cleanup();
    uncommittedReceipt.cleanup();
    duplicateMember.cleanup();
  });

  const ordinalEvidencePath = join(
    missingOrdinal.runRoot,
    'generic-live-workflow-evidence-candidate.json',
  );
  const ordinalEvidence = JSON.parse(readFileSync(ordinalEvidencePath, 'utf8'));
  delete ordinalEvidence.files[0].ordinal;
  write(ordinalEvidencePath, `${JSON.stringify(ordinalEvidence, null, 2)}\n`);
  const ordinalTopology = discoverProjectObservationTopology(missingOrdinal.projectRoot, { refresh: true });
  assert.equal(ordinalTopology.runs.length, 0);
  assert.ok(ordinalTopology.diagnostics.some((entry) => entry.code === 'generic_candidate_contract_invalid'));

  const digestEvidencePath = join(
    missingFileDigest.runRoot,
    'generic-live-workflow-evidence-candidate.json',
  );
  const digestEvidence = JSON.parse(readFileSync(digestEvidencePath, 'utf8'));
  delete digestEvidence.files[0].successorObservation.fileDigest;
  delete digestEvidence.constructionResult.members[0].successorObservation.fileDigest;
  write(digestEvidencePath, `${JSON.stringify(digestEvidence, null, 2)}\n`);
  const digestProjection = loadFixtureProjection(missingFileDigest);
  assert.equal(digestProjection.workspaceObservations.observations.length, 0);
  assert.equal(digestProjection.workspaceObservations.currentness, 'unobserved');
  assert.ok(digestProjection.diagnostics.some((entry) => (
    entry.code === 'workspace_observation_rows_invalid'
  )));

  const invalidChains = [
    [mismatchedBinding, (evidence) => {
      evidence.files[0].predecessorObservation.workspaceBindingIdentity = 'workspace-binding://fixture/other';
    }],
    [mismatchedMember, (evidence) => {
      evidence.constructionResult.members[0].successorObservation.observationDigest = fixtureSha('0');
    }],
    [uncommittedReceipt, (evidence) => {
      evidence.constructionResult.members[0].receipt.committed = false;
    }],
    [duplicateMember, (evidence) => {
      evidence.constructionResult.members.push(structuredClone(evidence.constructionResult.members[0]));
    }],
  ];
  for (const [fixture, mutate] of invalidChains) {
    const evidencePath = join(fixture.runRoot, 'generic-live-workflow-evidence-candidate.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    mutate(evidence);
    write(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    const projection = loadFixtureProjection(fixture);
    assert.equal(projection.workspaceObservations.observations.length, 0);
    assert.equal(projection.workspaceObservations.currentness, 'unobserved');
    assert.ok(projection.diagnostics.some((entry) => (
      entry.code === 'workspace_observation_rows_invalid'
    )));
  }
});

test('workspace observation producer bounds retained rows before projection serialization', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture();
  context.after(fixture.cleanup);
  const evidencePath = join(
    fixture.runRoot,
    'generic-live-workflow-evidence-candidate.json',
  );
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const sourceRow = evidence.files[0];
  const sourceMember = evidence.constructionResult.members[0];
  evidence.files = [];
  evidence.constructionResult.members = [];
  for (let ordinal = 0; ordinal < 81; ordinal += 1) {
    const row = structuredClone(sourceRow);
    const member = structuredClone(sourceMember);
    const suffix = String(ordinal).padStart(3, '0');
    row.ordinal = ordinal;
    row.relativePath = `artifact-${suffix}.txt`;
    row.predecessorObservation.observationRef = `worksite-observation://fixture/bounded/${suffix}/before`;
    row.predecessorObservation.observationDigest = bytesDigest(`before:${suffix}`);
    row.successorObservation.observationRef = `worksite-observation://fixture/bounded/${suffix}/after`;
    row.successorObservation.observationDigest = bytesDigest(`after:${suffix}`);
    member.ordinal = ordinal;
    member.inputMemberRef = `worksite-construction-target://fixture/bounded/${suffix}`;
    member.outputMemberRef = `fan-out-output-member://fixture/bounded/${suffix}`;
    member.successorObservation = structuredClone(row.successorObservation);
    member.receipt.receiptRef = `worksite-file-replace-receipt://fixture/bounded/${suffix}`;
    member.receipt.receiptDigest = bytesDigest(`receipt:${suffix}`);
    member.receipt.authorizationRef = `worksite-effect-authorization://fixture/bounded/${suffix}`;
    member.receipt.authorizationDigest = bytesDigest(`authorization:${suffix}`);
    member.receipt.beforeObservationRef = row.predecessorObservation.observationRef;
    member.receipt.beforeObservationDigest = row.predecessorObservation.observationDigest;
    member.receipt.afterObservationRef = row.successorObservation.observationRef;
    member.receipt.afterObservationDigest = row.successorObservation.observationDigest;
    evidence.files.push(row);
    evidence.constructionResult.members.push(member);
  }
  const constructionBody = {
    sourceApplicationRef: evidence.constructionResult.sourceApplicationRef,
    members: evidence.constructionResult.members,
  };
  evidence.constructionResult.resultDigest = canonicalDigest(constructionBody);
  evidence.constructionResult.resultRef = `worksite-construction-result://abiogenesis/${evidence.constructionResult.resultDigest.slice('sha256:'.length)}`;
  write(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const projection = loadFixtureProjection(fixture);
  assert.equal(projection.workspaceObservations.observations.length, 80);
  assert.equal(projection.workspaceObservations.state, 'partial');
  assert.equal(projection.limits.workspaceObservationsTruncated, true);
  assert.ok(projection.diagnostics.some((entry) => (
    entry.code === 'workspace_observations_bounded'
  )));
  assert.equal(visualGraphProjectionSchema.safeParse(projection).success, true);
});

test('projection diagnostics are producer-bounded after repeated exact relation conflicts', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture();
  context.after(fixture.cleanup);
  const abi5 = await import(pathToFileURL(ABI5_EVENT_MODULE_PATH).href);
  const seeds = await syntheticEvents();
  const validHistory = [seeds.events[0]];
  const emitted = [seeds.events[0]];
  const graphSeed = runtimeEventCandidate(seeds.events[1]);
  for (let index = 0; index < 81; index += 1) {
    const graphCallId = `graph-call://fixture/diagnostic-bound/${index + 1}`;
    const firstCandidate = structuredClone(graphSeed);
    firstCandidate.eventTime = new Date(Date.parse('2026-09-02T03:00:00.000Z') + index * 2000).toISOString();
    firstCandidate.aggregateId = graphCallId;
    firstCandidate.parentAggregateId = seeds.runId;
    firstCandidate.graphCallId = graphCallId;
    firstCandidate.causationEventRefs = [];
    firstCandidate.payload.graphCallId = graphCallId;
    const first = abi5.projectRuntimeEventFromValidatedHistory(validHistory, firstCandidate);
    validHistory.push(first);
    emitted.push(first);

    const secondCandidate = structuredClone(firstCandidate);
    secondCandidate.eventTime = new Date(Date.parse(firstCandidate.eventTime) + 1000).toISOString();
    const validSecond = abi5.projectRuntimeEventFromValidatedHistory(validHistory, secondCandidate);
    validHistory.push(validSecond);
    const conflictingSecond = structuredClone(validSecond);
    conflictingSecond.parentAggregateId = `run://fixture/diagnostic-conflict/${index + 1}`;
    emitted.push(reprojectMutatedEvent(conflictingSecond));
  }
  const eventBytes = `${emitted.map(canonicalJson).join('\n')}\n`;
  write(fixture.eventPath, eventBytes);
  const eventStats = statSync(fixture.eventPath);
  const evidencePath = join(
    fixture.runRoot,
    'generic-live-workflow-evidence-candidate.json',
  );
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  const coordinateBody = {
    kind: 'durable_prefix_coordinate',
    schemaVersion: '5.0.0',
    eventLogRef: pathToFileURL(fixture.eventPath).href,
    prefixLength: Buffer.byteLength(eventBytes),
    prefixDigest: bytesDigest(eventBytes),
    storeIdentity: {
      device: eventStats.dev,
      inode: eventStats.ino,
      eventContractDigest: fixture.publishedEventContractDigest,
    },
  };
  evidence.terminalPrefix = {
    ...coordinateBody,
    coordinateDigest: canonicalDigest(coordinateBody),
  };
  write(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const projection = loadFixtureProjection(fixture);
  assert.equal(projection.state, 'partial');
  assert.equal(projection.diagnostics.length, 80);
  assert.equal(projection.limits.diagnosticsTruncated, true);
  assert.equal(projection.diagnostics.at(-1).code, 'visual_graph_diagnostics_bounded');
  assert.equal(visualGraphProjectionSchema.safeParse(projection).success, true);
});

test('workspace source events bind by exact construction result identity and refuse ambiguity', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const exact = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
    constructionResultEvents: [
      { matchConstructionResult: true },
      {
        value: {
          kind: 'worksite_construction_result',
          marker: 'unrelated',
        },
      },
    ],
  });
  const ambiguous = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
    constructionResultEvents: [
      { matchConstructionResult: true },
      { matchConstructionResult: true },
    ],
  });
  context.after(() => {
    exact.cleanup();
    ambiguous.cleanup();
  });

  const exactProjection = loadFixtureProjection(exact);
  const matchingEvent = exact.emitted.events.find((event) => (
    event.kind === 'c_call_result_admitted'
    && event.payload.valueKind === 'worksite_construction_result'
    && event.payload.valueDigest === canonicalDigest(exact.constructionResult)
  ));
  assert.equal(
    exactProjection.workspaceObservations.observations[0].sourceEvent.eventId,
    matchingEvent.eventId,
  );
  assert.equal(
    exactProjection.diagnostics.some((entry) => entry.code === 'workspace_construction_event_ambiguous'),
    false,
  );

  const ambiguousProjection = loadFixtureProjection(ambiguous);
  assert.equal(ambiguousProjection.workspaceObservations.observations[0].sourceEvent, null);
  assert.ok(ambiguousProjection.diagnostics.some((entry) => (
    entry.code === 'workspace_construction_event_ambiguous'
  )));
});

test('unsafe generic evidence posture tokens are withheld before browser projection', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const unsafeAuthority = await createGenericFixture();
  const unsafeDisposition = await createGenericFixture();
  context.after(() => {
    unsafeAuthority.cleanup();
    unsafeDisposition.cleanup();
  });
  const mutateCandidate = (fixture, mutate) => {
    const evidencePath = join(fixture.runRoot, 'generic-live-workflow-evidence-candidate.json');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    mutate(evidence);
    write(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    return discoverProjectObservationTopology(fixture.projectRoot, { refresh: true });
  };
  const authorityTopology = mutateCandidate(unsafeAuthority, (evidence) => {
    evidence.authority = '/Users/fixture/secret-authority';
  });
  const dispositionTopology = mutateCandidate(unsafeDisposition, (evidence) => {
    evidence.validation.disposition = 'satisfied\nSECRET_CONTROL_TEXT';
  });

  for (const topology of [authorityTopology, dispositionTopology]) {
    assert.equal(topology.runs.length, 0);
    assert.ok(topology.diagnostics.some((entry) => entry.code === 'generic_candidate_contract_invalid'));
    assert.equal(JSON.stringify(topology).includes('SECRET_CONTROL_TEXT'), false);
  }
});

test('cached topology refuses a changed evidence candidate and fresh discovery rejects duplicate ordinals', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const changed = await createGenericFixture();
  const duplicated = await createGenericFixture();
  context.after(() => {
    changed.cleanup();
    duplicated.cleanup();
  });

  const generation = fixtureGeneration(changed);
  const changedPath = join(changed.runRoot, 'generic-live-workflow-evidence-candidate.json');
  const changedEvidence = JSON.parse(readFileSync(changedPath, 'utf8'));
  changedEvidence.validation.predicates.push({ id: 'predicate://fixture/changed' });
  write(changedPath, `${JSON.stringify(changedEvidence, null, 2)}\n`);
  const changedProjection = loadVisualGraphProjection(changed.projectRoot, {
    runId: changed.emitted.runId,
    generation,
    refresh: false,
  });
  assert.equal(changedProjection.state, 'invalid');
  assert.equal(changedProjection.occurrenceGraph.nodes.length, 0);
  assert.equal(changedProjection.workspaceObservations.observations.length, 0);
  assert.ok(changedProjection.diagnostics.some((entry) => (
    entry.code === 'evidence_candidate_changed_during_projection'
  )));

  const duplicatedPath = join(duplicated.runRoot, 'generic-live-workflow-evidence-candidate.json');
  const duplicatedEvidence = JSON.parse(readFileSync(duplicatedPath, 'utf8'));
  duplicatedEvidence.files.push(structuredClone(duplicatedEvidence.files[0]));
  write(duplicatedPath, `${JSON.stringify(duplicatedEvidence, null, 2)}\n`);
  const duplicatedTopology = discoverProjectObservationTopology(duplicated.projectRoot, { refresh: true });
  assert.equal(duplicatedTopology.runs.length, 0);
  assert.ok(duplicatedTopology.diagnostics.some((entry) => (
    entry.code === 'generic_candidate_contract_invalid'
  )));
});

test('unsafe nested workspace state and kind values are rejected without reflection', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const unsafeState = await createGenericFixture();
  const unsafeKind = await createGenericFixture();
  context.after(() => {
    unsafeState.cleanup();
    unsafeKind.cleanup();
  });

  const statePath = join(unsafeState.runRoot, 'generic-live-workflow-evidence-candidate.json');
  const stateEvidence = JSON.parse(readFileSync(statePath, 'utf8'));
  stateEvidence.files[0].predecessorObservation.state = 'absent\nSECRET_NESTED_STATE';
  write(statePath, `${JSON.stringify(stateEvidence, null, 2)}\n`);
  const topology = discoverProjectObservationTopology(unsafeState.projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 0);
  assert.equal(JSON.stringify(topology).includes('SECRET_NESTED_STATE'), false);

  const kindPath = join(unsafeKind.runRoot, 'generic-live-workflow-evidence-candidate.json');
  const kindEvidence = JSON.parse(readFileSync(kindPath, 'utf8'));
  kindEvidence.files[0].predecessorObservation.kind = 'worksite_observation\u001bSECRET_NESTED_KIND';
  write(kindPath, `${JSON.stringify(kindEvidence, null, 2)}\n`);
  const projection = loadFixtureProjection(unsafeKind);
  assert.equal(projection.workspaceObservations.observations.length, 0);
  assert.ok(projection.diagnostics.some((entry) => entry.code === 'workspace_observation_rows_invalid'));
  assert.equal(JSON.stringify(projection).includes('SECRET_NESTED_KIND'), false);
});

test('an unbound evidence relative path cannot create mutable-workspace currentness even for matching bytes', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture();
  context.after(fixture.cleanup);
  write(join(fixture.workspaceRoot, 'other.txt'), 'retained workspace bytes\n');
  const evidencePath = join(
    fixture.runRoot,
    'generic-live-workflow-evidence-candidate.json',
  );
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  evidence.files[0].relativePath = 'other.txt';
  write(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  const projection = loadFixtureProjection(fixture);
  assert.equal(projection.workspaceObservations.observations.length, 1);
  assert.deepEqual(projection.workspaceObservations.observations[0].current, {
    state: 'unobserved',
    byteLength: null,
    digest: null,
    posture: 'unavailable',
  });
  assert.equal(projection.workspaceObservations.currentness, 'unobserved');
  assert.ok(projection.diagnostics.some((entry) => (
    entry.code === 'workspace_current_subject_binding_unavailable'
  )));
});

test('canonical visual contract rejects contradictory event-contract identity posture', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const fixture = await createGenericFixture();
  const builtInFixture = await createGenericFixture({
    eventContractDigest: ABI5_ROOT_EVENT_CONTRACT_DIGEST,
  });
  context.after(() => {
    fixture.cleanup();
    builtInFixture.cleanup();
  });
  const projection = loadFixtureProjection(fixture);
  const builtInProjection = loadFixtureProjection(builtInFixture);
  const contradictory = structuredClone(projection);
  contradictory.run.eventContract.publishedDigest = contradictory.run.eventContract.builtInRegistryDigest;
  assert.equal(visualGraphProjectionSchema.safeParse(contradictory).success, false);

  const unboundMatch = structuredClone(projection);
  unboundMatch.run.eventContract.publishedDigest = unboundMatch.run.eventContract.builtInRegistryDigest;
  unboundMatch.run.eventContract.posture = 'published_contract_matches_builtin_registry';
  unboundMatch.run.eventContract.bindingPosture = null;
  assert.equal(visualGraphProjectionSchema.safeParse(unboundMatch).success, false);

  const fabricatedBuiltInRegistry = structuredClone(projection);
  fabricatedBuiltInRegistry.run.eventContract.builtInRegistryDigest = fixtureSha('0');
  assert.equal(visualGraphProjectionSchema.safeParse(fabricatedBuiltInRegistry).success, false);

  const duplicateOccurrenceEdges = structuredClone(projection);
  duplicateOccurrenceEdges.occurrenceGraph.edges.push(
    structuredClone(duplicateOccurrenceEdges.occurrenceGraph.edges[0]),
  );
  assert.equal(visualGraphProjectionSchema.safeParse(duplicateOccurrenceEdges).success, false);

  const missingOccurrenceWithRows = structuredClone(projection);
  missingOccurrenceWithRows.occurrenceGraph.state = 'missing';
  assert.equal(visualGraphProjectionSchema.safeParse(missingOccurrenceWithRows).success, false);

  const missingWorkspaceWithRows = structuredClone(projection);
  missingWorkspaceWithRows.workspaceObservations.state = 'missing';
  assert.equal(visualGraphProjectionSchema.safeParse(missingWorkspaceWithRows).success, false);

  const duplicateWorkspaceOrdinal = structuredClone(projection);
  duplicateWorkspaceOrdinal.workspaceObservations.observations.push(
    structuredClone(duplicateWorkspaceOrdinal.workspaceObservations.observations[0]),
  );
  assert.equal(visualGraphProjectionSchema.safeParse(duplicateWorkspaceOrdinal).success, false);

  const falseReadyComposition = structuredClone(projection);
  falseReadyComposition.state = 'ready';
  assert.equal(visualGraphProjectionSchema.safeParse(falseReadyComposition).success, false);

  const reversedRunRange = structuredClone(projection);
  reversedRunRange.run.firstOrdinal = reversedRunRange.run.lastOrdinal + 1;
  assert.equal(visualGraphProjectionSchema.safeParse(reversedRunRange).success, false);

  const boundActorSessionProjection = structuredClone(builtInProjection);
  const coordinate = boundActorSessionProjection.occurrenceGraph.nodes[0].firstObserved;
  const actorInvocationId = 'actor-invocation://fixture/bound-session';
  const processAggregateId = 'process://fixture/bound-session';
  boundActorSessionProjection.occurrenceGraph.nodes.push(
    {
      id: 'occurrence-node://fixture/bound-actor-invocation',
      aggregateType: 'actor_invocation',
      aggregateId: actorInvocationId,
      label: 'Bound actor invocation',
      state: 'closed',
      firstObserved: coordinate,
      lastObserved: coordinate,
    },
    {
      id: 'occurrence-node://fixture/bound-process',
      aggregateType: 'process',
      aggregateId: processAggregateId,
      label: 'Bound process',
      state: 'closed',
      firstObserved: coordinate,
      lastObserved: coordinate,
    },
  );
  const parentEdgeTemplate = boundActorSessionProjection.occurrenceGraph.edges.find((edge) => (
    edge.kind === 'aggregate_parent'
  ));
  boundActorSessionProjection.occurrenceGraph.edges.push({
    ...structuredClone(parentEdgeTemplate),
    id: 'occurrence-edge://fixture/bound-actor-process',
    sourceNodeId: 'occurrence-node://fixture/bound-actor-invocation',
    targetNodeId: 'occurrence-node://fixture/bound-process',
    sourceEvent: coordinate,
    targetEvent: coordinate,
  });
  const completedSession = {
    id: 'actor-session://fixture/bound-session',
    actorInvocationId,
    processAggregateId,
    actorRef: 'actor://fixture/bound-session',
    lifecycleState: 'completed',
    terminalDisposition: 'completed',
    capabilityRefs: [],
    operationRefs: [],
    archiveRefs: [],
    canAttach: false,
    firstObserved: coordinate,
    lastObserved: coordinate,
  };
  boundActorSessionProjection.actorSessions = {
    state: 'partial',
    interactionDisposition: 'completed',
    sessions: [completedSession],
  };
  assert.equal(visualGraphProjectionSchema.safeParse(boundActorSessionProjection).success, true);

  const unboundActorInvocation = structuredClone(boundActorSessionProjection);
  unboundActorInvocation.actorSessions.sessions[0].actorInvocationId = 'actor-invocation://fixture/unbound';
  assert.equal(visualGraphProjectionSchema.safeParse(unboundActorInvocation).success, false);

  const unboundProcess = structuredClone(boundActorSessionProjection);
  unboundProcess.actorSessions.sessions[0].processAggregateId = 'process://fixture/unbound';
  assert.equal(visualGraphProjectionSchema.safeParse(unboundProcess).success, false);

  const archiveWithoutCarrier = structuredClone(boundActorSessionProjection);
  archiveWithoutCarrier.actorSessions.interactionDisposition = 'archive_available';
  archiveWithoutCarrier.actorSessions.sessions[0].terminalDisposition = 'archive_available';
  assert.equal(visualGraphProjectionSchema.safeParse(archiveWithoutCarrier).success, false);

  const contradictoryActorAggregate = structuredClone(projection);
  contradictoryActorAggregate.actorSessions.interactionDisposition = 'live_interactive';
  assert.equal(visualGraphProjectionSchema.safeParse(contradictoryActorAggregate).success, false);

  const duplicateActorSessions = structuredClone(boundActorSessionProjection);
  duplicateActorSessions.actorSessions.sessions.push(structuredClone(completedSession));
  assert.equal(visualGraphProjectionSchema.safeParse(duplicateActorSessions).success, false);

  const duplicateDeclarationNodes = structuredClone(projection);
  const declarationNode = {
    id: 'declaration-node://fixture/duplicate',
    kind: 'node',
    label: 'Duplicate declaration node',
    declarationRef: 'graph://fixture/visual-graph',
  };
  duplicateDeclarationNodes.declarationTopology = {
    state: 'ready',
    reason: 'published_bodies_admitted',
    references: [],
    nodes: [declarationNode, structuredClone(declarationNode)],
    edges: [],
  };
  assert.equal(visualGraphProjectionSchema.safeParse(duplicateDeclarationNodes).success, false);

  const duplicateDeclarationEdges = structuredClone(projection);
  const declarationTarget = {
    id: 'declaration-node://fixture/target',
    kind: 'graph_function',
    label: 'Declaration target',
    declarationRef: 'graph-function://fixture/visual-graph',
  };
  const declarationEdge = {
    id: 'declaration-edge://fixture/duplicate',
    kind: 'declared_vector',
    sourceNodeId: declarationNode.id,
    targetNodeId: declarationTarget.id,
    declarationRef: 'graph-function://fixture/visual-graph',
  };
  duplicateDeclarationEdges.declarationTopology = {
    state: 'ready',
    reason: 'published_bodies_admitted',
    references: [],
    nodes: [declarationNode, declarationTarget],
    edges: [declarationEdge, structuredClone(declarationEdge)],
  };
  assert.equal(visualGraphProjectionSchema.safeParse(duplicateDeclarationEdges).success, false);

  const emptyReadyDeclaration = structuredClone(projection);
  emptyReadyDeclaration.declarationTopology = {
    state: 'ready',
    reason: 'published_bodies_admitted',
    references: [],
    nodes: [],
    edges: [],
  };
  assert.equal(visualGraphProjectionSchema.safeParse(emptyReadyDeclaration).success, false);

  const partialWithBody = structuredClone(projection);
  partialWithBody.declarationTopology.nodes = [declarationNode];
  assert.equal(visualGraphProjectionSchema.safeParse(partialWithBody).success, false);

  const missingWithReference = structuredClone(projection);
  missingWithReference.declarationTopology = {
    state: 'missing',
    reason: 'no_declaration_carrier',
    references: [{
      kind: 'graph_function',
      ref: 'graph-function://fixture/visual-graph',
      sourceEvent: null,
    }],
    nodes: [],
    edges: [],
  };
  assert.equal(visualGraphProjectionSchema.safeParse(missingWithReference).success, false);

  const absentRunWithRows = structuredClone(projection);
  absentRunWithRows.run = null;
  assert.equal(visualGraphProjectionSchema.safeParse(absentRunWithRows).success, false);

  for (const state of ['unsupported', 'invalid']) {
    const terminalStateWithRows = structuredClone(projection);
    terminalStateWithRows.state = state;
    assert.equal(visualGraphProjectionSchema.safeParse(terminalStateWithRows).success, false);
  }

  const unsafeAggregateRef = structuredClone(projection);
  unsafeAggregateRef.occurrenceGraph.nodes[0].aggregateId = 'run://fixture/visual\u001bescape';
  assert.equal(visualGraphProjectionSchema.safeParse(unsafeAggregateRef).success, false);

  const unsafeCoordinateKind = structuredClone(projection);
  unsafeCoordinateKind.occurrenceGraph.nodes[0].firstObserved.kind = 'run_segment_opened\nunsafe';
  assert.equal(visualGraphProjectionSchema.safeParse(unsafeCoordinateKind).success, false);

  const boundedLongCoordinateKind = structuredClone(projection);
  boundedLongCoordinateKind.occurrenceGraph.nodes[0].firstObserved.kind = `event_${'a'.repeat(94)}`;
  assert.equal(visualGraphProjectionSchema.safeParse(boundedLongCoordinateKind).success, true);

  const overBoundCoordinateKind = structuredClone(projection);
  overBoundCoordinateKind.occurrenceGraph.nodes[0].firstObserved.kind = `event_${'a'.repeat(155)}`;
  assert.equal(visualGraphProjectionSchema.safeParse(overBoundCoordinateKind).success, false);

  const unsafeWorkspaceState = structuredClone(projection);
  unsafeWorkspaceState.workspaceObservations.observations[0].successor.state = '/Users/fixture/secret';
  assert.equal(visualGraphProjectionSchema.safeParse(unsafeWorkspaceState).success, false);
});

test('stale generations, complete-prefix digest mismatch, and cross-root event carriers fail closed', {
  skip: !exactAbi5ArtifactAvailable && 'exact ABIogenesis 5 artifact is unavailable',
}, async (context) => {
  const stable = await createGenericFixture();
  const mismatch = await createGenericFixture({ prefixMismatch: true });
  const escaped = await createGenericFixture({ eventEscape: true });
  context.after(() => {
    stable.cleanup();
    mismatch.cleanup();
    escaped.cleanup();
  });

  const stale = loadFixtureProjection(stable, {
    generation: fixtureSha('0'),
  });
  assert.equal(stale.state, 'invalid');
  assert.equal(stale.occurrenceGraph.nodes.length, 0);
  assert.ok(stale.diagnostics.some((entry) => entry.code === 'stale_event_generation'));

  const mismatchTopology = discoverProjectObservationTopology(mismatch.projectRoot, { refresh: true });
  assert.equal(mismatchTopology.runs.length, 0);
  assert.ok(mismatchTopology.diagnostics.some((entry) => entry.code === 'generic_candidate_prefix_mismatch'));

  const escapedTopology = discoverProjectObservationTopology(escaped.projectRoot, { refresh: true });
  assert.equal(escapedTopology.runs.length, 0);
  assert.ok(escapedTopology.diagnostics.some((entry) => entry.code === 'generic_candidate_carrier_escape'));
});

const CURRENT_RUST_PROJECT = '/Users/jim/src/apps/odd_glc';
const CURRENT_RUST_CANDIDATE = '/Users/jim/src/apps/odd_glc/build_tenants/odd_glc/typescript/test_runs/generic-live-workflow/rust-cli/20260901T134226091Z_pid61794/generic-live-workflow-evidence-candidate.json';
const CURRENT_RUST_RUN = 'run://abiogenesis/09822c42375f497e86c5306c9367d37c20b5e03d64d4c37402342755776bbf59';
const CURRENT_RUST_GENERATION = 'sha256:84b1c4612d64e6668bc887285d8c878388f900193bd520b9b925a03e975616a1';
const CURRENT_RUST_CONTRACT = 'sha256:abbd5c43dfa219af37f971b318f3a2fdce861b79f5dfc023295c76e1879becc1';

test('the exact retained rust-cli candidate is discovered by run ref and remains an honest partial observation', {
  skip: !existsSync(CURRENT_RUST_CANDIDATE) && 'current rust-cli retained candidate is unavailable',
}, () => {
  const candidate = JSON.parse(readFileSync(CURRENT_RUST_CANDIDATE, 'utf8'));
  assert.equal(candidate.run.ref, CURRENT_RUST_RUN);
  const discovery = loadAbgRunObservation(CURRENT_RUST_PROJECT, { refresh: true });
  assert.equal(discovery.state, 'unsupported');
  assert.equal(discovery.selectedRunId, null);
  assert.equal(discovery.runs.length, 4);
  assert.ok(discovery.runs.every((run) => run.runId.startsWith('run://abiogenesis/')));
  assert.equal(discovery.runs.some((run) => run.scenarioId === 'SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT'), false);
  const projection = loadVisualGraphProjection(CURRENT_RUST_PROJECT, {
    runId: CURRENT_RUST_RUN,
    generation: CURRENT_RUST_GENERATION,
    refresh: true,
  });
  assert.equal(projection.state, 'partial');
  assert.equal(projection.run.runId, CURRENT_RUST_RUN);
  assert.equal(projection.run.eventContract.publishedDigest, CURRENT_RUST_CONTRACT);
  assert.equal(projection.run.eventContract.builtInRegistryDigest, ABI5_ROOT_EVENT_CONTRACT_DIGEST);
  assert.equal(projection.run.eventContract.posture, 'published_contract_distinct_from_builtin_registry');
  assert.equal(projection.run.evidence.authority, 'diagnostic_only');
  assert.equal(projection.run.closed, false);
  assert.equal(projection.run.eventPosture, 'external_contract_uninterpreted');
  assert.deepEqual(projection.occurrenceGraph.activeNodeIds, []);
  assert.equal(projection.occurrenceGraph.state, 'partial');
  assert.ok(projection.diagnostics.some((entry) => entry.code === 'occurrence_profile_partial'));
  assert.equal(projection.declarationTopology.state, 'missing');
  assert.equal(projection.actorSessions.interactionDisposition, 'unavailable');
  assert.equal(projection.actorSessions.sessions[0].lifecycleState, 'unknown');
  assert.equal(projection.actorSessions.sessions[0].terminalDisposition, 'unknown');
  assert.equal(projection.actorSessions.sessions[0].canAttach, false);
  assert.ok(projection.occurrenceGraph.nodes.every((node) => node.state === 'unknown'));
  assert.ok(projection.diagnostics.some((entry) => (
    entry.code === 'external_event_contract_lifecycle_uninterpreted'
  )));
});
