import assert from 'node:assert/strict';
import test from 'node:test';

import { visualGraphProjectionSchema } from '@odd-manager/developer-control-contracts';

const BUILT_IN_EVENT_CONTRACT_DIGEST = 'sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d';
const digest = (character) => `sha256:${character.repeat(64)}`;
const coordinate = (ordinal, kind = 'fixture_event') => ({
  eventId: `event://fixture/${ordinal}/${kind}`,
  ordinal,
  kind,
});

function baseProjection() {
  const runNodeId = 'occurrence-node://fixture/run';
  const beforeObservationRef = 'worksite-observation://fixture/before';
  const afterObservationRef = 'worksite-observation://fixture/after';
  const beforeObservationDigest = digest('1');
  const afterObservationDigest = digest('2');
  const fileDigest = digest('3');
  return {
    kind: 'visual_graph_projection',
    version: 1,
    generatedAt: '2026-09-02T00:00:00.000Z',
    state: 'partial',
    run: {
      runId: 'run://fixture/contract-invariants',
      runDigest: digest('4'),
      scenarioKey: 'contract-invariants',
      scenarioId: 'SCN-CONTRACT-INVARIANTS',
      eventGeneration: digest('5'),
      eventCount: 3,
      firstOrdinal: 0,
      lastOrdinal: 2,
      eventPosture: 'terminal_converged',
      closed: true,
      eventContract: {
        publishedDigest: null,
        builtInRegistryDigest: BUILT_IN_EVENT_CONTRACT_DIGEST,
        posture: 'built_in_registry_envelope_validated_unpublished',
        bindingPosture: null,
      },
      evidence: {
        authority: 'diagnostic_only',
        disposition: 'awaiting_review',
        validationDisposition: 'satisfied',
      },
    },
    declarationTopology: {
      state: 'missing',
      reason: 'no_declaration_carrier',
      references: [],
      nodes: [],
      edges: [],
    },
    occurrenceGraph: {
      state: 'partial',
      nodes: [{
        id: runNodeId,
        aggregateType: 'run',
        aggregateId: 'run://fixture/contract-invariants',
        label: 'Fixture run',
        state: 'closed',
        firstObserved: coordinate(0, 'run_segment_opened'),
        lastObserved: coordinate(2, 'run_closed'),
      }],
      edges: [],
      activeNodeIds: [],
      lastObservedNodeId: runNodeId,
    },
    workspaceObservations: {
      state: 'partial',
      currentness: 'matches_retained_observations',
      observations: [{
        ordinal: 0,
        sourceEvent: null,
        predecessor: {
          observationRef: beforeObservationRef,
          observationDigest: beforeObservationDigest,
          subjectRef: 'worksite-subject://fixture/artifact',
          subjectDigest: digest('6'),
          bindingRef: 'workspace-binding://fixture/worksite',
          state: 'absent',
          byteLength: null,
          fileDigest: null,
        },
        successor: {
          observationRef: afterObservationRef,
          observationDigest: afterObservationDigest,
          subjectRef: 'worksite-subject://fixture/artifact',
          subjectDigest: digest('6'),
          bindingRef: 'workspace-binding://fixture/worksite',
          state: 'file',
          byteLength: 17,
          fileDigest,
        },
        receipt: {
          receiptRef: 'worksite-effect-receipt://fixture/artifact',
          receiptDigest: digest('7'),
          authorizationRef: 'worksite-effect-authorization://fixture/artifact',
          authorizationDigest: digest('8'),
          beforeObservationRef,
          beforeObservationDigest,
          afterObservationRef,
          afterObservationDigest,
          writtenDigest: fileDigest,
          committed: true,
        },
        current: {
          state: 'present',
          byteLength: 17,
          digest: fileDigest,
          posture: 'matches_retained',
        },
      }],
    },
    actorSessions: {
      state: 'missing',
      interactionDisposition: 'unavailable',
      sessions: [],
    },
    diagnostics: [],
    limits: {
      maxNodes: 240,
      maxEdges: 480,
      maxWorkspaceObservations: 80,
      maxActorSessions: 80,
      maxDiagnostics: 80,
      nodesTruncated: false,
      edgesTruncated: false,
      workspaceObservationsTruncated: false,
      actorSessionsTruncated: false,
      diagnosticsTruncated: false,
    },
  };
}

function issueMessages(value) {
  const result = visualGraphProjectionSchema.safeParse(value);
  assert.equal(result.success, false, 'fixture was expected to violate the canonical projection contract');
  return result.error.issues.map((issue) => issue.message);
}

function assertRejectedWith(value, expectedMessage) {
  assert.ok(
    issueMessages(value).some((message) => message.includes(expectedMessage)),
    `expected a canonical-contract issue containing: ${expectedMessage}`,
  );
}

function assertAccepted(value) {
  const result = visualGraphProjectionSchema.safeParse(value);
  assert.equal(result.success, true, result.success ? undefined : JSON.stringify(result.error.issues));
}

function assertArrayBoundRejected(value, path) {
  const result = visualGraphProjectionSchema.safeParse(value);
  assert.equal(result.success, false, 'fixture was expected to exceed a canonical array bound');
  assert.ok(result.error.issues.some((issue) => (
    issue.code === 'too_big' && JSON.stringify(issue.path) === JSON.stringify(path)
  )), `expected a too_big issue at ${path.join('.')}: ${JSON.stringify(result.error.issues)}`);
}

function withReadyDeclaration(value) {
  value.declarationTopology = {
    state: 'ready',
    reason: 'published_bodies_admitted',
    references: [],
    nodes: [{
      id: 'declaration-node://fixture/root',
      kind: 'graph',
      label: 'Fixture graph',
      declarationRef: 'graph://fixture/contract-invariants',
    }],
    edges: [],
  };
  return value;
}

function withActorPairs(value) {
  const actorA = {
    id: 'occurrence-node://fixture/actor-a',
    aggregateType: 'actor_invocation',
    aggregateId: 'actor-invocation://fixture/a',
    label: 'Actor A',
    state: 'closed',
    firstObserved: coordinate(1, 'actor_invocation_started'),
    lastObserved: coordinate(2, 'actor_invocation_closed'),
  };
  const actorB = {
    ...structuredClone(actorA),
    id: 'occurrence-node://fixture/actor-b',
    aggregateId: 'actor-invocation://fixture/b',
    label: 'Actor B',
  };
  const processA = {
    id: 'occurrence-node://fixture/process-a',
    aggregateType: 'process',
    aggregateId: 'process://fixture/a',
    label: 'Process A',
    state: 'closed',
    firstObserved: coordinate(1, 'actor_process_started'),
    lastObserved: coordinate(2, 'actor_process_exited'),
  };
  const processB = {
    ...structuredClone(processA),
    id: 'occurrence-node://fixture/process-b',
    aggregateId: 'process://fixture/b',
    label: 'Process B',
  };
  value.occurrenceGraph.nodes.push(actorA, actorB, processA, processB);
  value.occurrenceGraph.edges.push(
    {
      id: 'occurrence-edge://fixture/actor-a-process-a',
      kind: 'aggregate_parent',
      sourceNodeId: actorA.id,
      targetNodeId: processA.id,
      sourceEvent: actorA.firstObserved,
      targetEvent: processA.firstObserved,
    },
    {
      id: 'occurrence-edge://fixture/actor-b-process-b',
      kind: 'aggregate_parent',
      sourceNodeId: actorB.id,
      targetNodeId: processB.id,
      sourceEvent: actorB.firstObserved,
      targetEvent: processB.firstObserved,
    },
  );
  const session = (suffix) => ({
    id: `actor-session://fixture/${suffix}`,
    actorInvocationId: `actor-invocation://fixture/${suffix}`,
    processAggregateId: `process://fixture/${suffix}`,
    actorRef: `actor://fixture/${suffix}`,
    lifecycleState: 'completed',
    terminalDisposition: 'completed',
    capabilityRefs: [],
    operationRefs: [],
    archiveRefs: [],
    canAttach: false,
    firstObserved: coordinate(1, 'actor_invocation_started'),
    lastObserved: coordinate(2, 'actor_invocation_closed'),
  });
  value.actorSessions = {
    state: 'partial',
    interactionDisposition: 'completed',
    sessions: [session('a'), session('b')],
  };
  return value;
}

function withExternalUninterpretedContract(value) {
  value.run.eventContract = {
    publishedDigest: digest('a'),
    builtInRegistryDigest: BUILT_IN_EVENT_CONTRACT_DIGEST,
    posture: 'published_contract_distinct_from_builtin_registry',
    bindingPosture: 'durable_prefix_coordinate_verified',
  };
  value.run.eventPosture = 'external_contract_uninterpreted';
  value.run.closed = false;
  value.occurrenceGraph.activeNodeIds = [];
  for (const node of value.occurrenceGraph.nodes) node.state = 'unknown';
  if (value.actorSessions.sessions.length > 0) {
    value.actorSessions.interactionDisposition = 'unknown';
    for (const session of value.actorSessions.sessions) {
      session.lifecycleState = 'unknown';
      session.terminalDisposition = 'unknown';
    }
  }
  return value;
}

test('workspace O0/effect/O1 identities and committed receipt remain one exact chain', () => {
  assertAccepted(baseProjection());
  const mutations = [
    [(row) => { row.predecessor.observationRef = null; }, 'snapshot requires exact identity'],
    [(row) => { row.predecessor.subjectRef = null; row.successor.subjectRef = null; }, 'snapshot requires exact identity'],
    [(row) => { row.predecessor.bindingRef = null; row.successor.bindingRef = null; }, 'snapshot requires exact identity'],
    [(row) => { row.successor.state = 'file'; row.successor.fileDigest = null; row.receipt.writtenDigest = null; }, 'coherent file or absence facts'],
    [(row) => { row.receipt.receiptRef = null; }, 'receipt requires exact identity'],
    [(row) => { row.receipt.authorizationDigest = null; }, 'receipt requires exact identity'],
    [(row) => { row.successor.subjectRef = 'worksite-subject://fixture/other'; }, 'same subject reference and digest'],
    [(row) => { row.successor.subjectDigest = digest('9'); }, 'same subject reference and digest'],
    [(row) => { row.successor.bindingRef = 'workspace-binding://fixture/other'; }, 'same workspace identity'],
    [(row) => { row.receipt.committed = false; }, 'must be explicitly committed'],
    [(row) => { row.receipt.committed = null; }, 'must be explicitly committed'],
    [(row) => { row.receipt.beforeObservationRef = 'worksite-observation://fixture/other'; }, 'exact O0 reference and digest'],
    [(row) => { row.receipt.beforeObservationDigest = digest('9'); }, 'exact O0 reference and digest'],
    [(row) => { row.receipt.afterObservationRef = 'worksite-observation://fixture/other'; }, 'exact O1 reference and digest'],
    [(row) => { row.receipt.afterObservationDigest = digest('9'); }, 'exact O1 reference and digest'],
    [(row) => { row.receipt.writtenDigest = digest('9'); }, 'written digest must equal'],
  ];
  for (const [mutate, expectedMessage] of mutations) {
    const projection = baseProjection();
    mutate(projection.workspaceObservations.observations[0]);
    assertRejectedWith(projection, expectedMessage);
  }
});

test('matches-retained currentness is exact for files and coherent for retained absence', () => {
  for (const mutate of [
    (row) => { row.current.digest = digest('9'); },
    (row) => { row.current.byteLength += 1; },
    (row) => { row.current.state = 'unreadable'; },
    (row) => { row.successor.fileDigest = null; row.receipt.writtenDigest = null; },
  ]) {
    const projection = baseProjection();
    mutate(projection.workspaceObservations.observations[0]);
    assertRejectedWith(projection, 'matches-retained currentness requires');
  }

  const retainedAbsence = baseProjection();
  const absenceRow = retainedAbsence.workspaceObservations.observations[0];
  absenceRow.successor.state = 'absent';
  absenceRow.successor.byteLength = null;
  absenceRow.successor.fileDigest = null;
  absenceRow.receipt.writtenDigest = null;
  absenceRow.current = {
    state: 'missing',
    byteLength: null,
    digest: null,
    posture: 'matches_retained',
  };
  assertAccepted(retainedAbsence);

  const contradictoryAbsence = structuredClone(retainedAbsence);
  contradictoryAbsence.workspaceObservations.observations[0].current.state = 'present';
  assertRejectedWith(contradictoryAbsence, 'coherent retained absence');

  const unavailableCurrent = baseProjection();
  unavailableCurrent.workspaceObservations.currentness = 'unobserved';
  unavailableCurrent.workspaceObservations.observations[0].current = {
    state: 'unobserved',
    byteLength: null,
    digest: null,
    posture: 'unavailable',
  };
  assertAccepted(unavailableCurrent);

  const unavailableWithBytes = structuredClone(unavailableCurrent);
  unavailableWithBytes.workspaceObservations.observations[0].current.byteLength = 17;
  assertRejectedWith(unavailableWithBytes, 'unavailable workspace currentness requires');

  const missingWithChangedBytes = structuredClone(unavailableCurrent);
  missingWithChangedBytes.workspaceObservations.currentness = 'workspace_changed';
  missingWithChangedBytes.workspaceObservations.observations[0].current = {
    state: 'missing',
    byteLength: 17,
    digest: null,
    posture: 'changed',
  };
  assertRejectedWith(missingWithChangedBytes, 'byte facts must be complete exactly when the subject is present');

  const unreadableChanged = structuredClone(unavailableCurrent);
  unreadableChanged.workspaceObservations.currentness = 'workspace_changed';
  unreadableChanged.workspaceObservations.observations[0].current = {
    state: 'unreadable',
    byteLength: null,
    digest: null,
    posture: 'changed',
  };
  assertRejectedWith(unreadableChanged, 'changed workspace currentness requires');

  for (const current of [
    {
      state: 'present',
      byteLength: 17,
      digest: digest('3'),
      posture: 'not_applicable',
    },
    {
      state: 'missing',
      byteLength: null,
      digest: null,
      posture: 'not_applicable',
    },
  ]) {
    const notApplicable = structuredClone(unavailableCurrent);
    notApplicable.workspaceObservations.observations[0].current = current;
    assert.equal(
      visualGraphProjectionSchema.safeParse(notApplicable).success,
      false,
      'not_applicable is not a workspace-currentness posture on retained rows',
    );
  }

  const falseAggregateMatch = structuredClone(unavailableCurrent);
  falseAggregateMatch.workspaceObservations.currentness = 'matches_retained_observations';
  assertRejectedWith(falseAggregateMatch, 'requires every retained row to match');

  const falseAggregateChange = structuredClone(unavailableCurrent);
  falseAggregateChange.workspaceObservations.currentness = 'workspace_changed';
  assertRejectedWith(falseAggregateChange, 'requires at least one changed retained row');

  const falseAggregateUnobserved = baseProjection();
  falseAggregateUnobserved.workspaceObservations.currentness = 'unobserved';
  assertRejectedWith(falseAggregateUnobserved, 'cannot contain observed match or change claims');
});

test('occurrence nodes have ordered observation bounds and unique active identities', () => {
  const reversed = baseProjection();
  reversed.occurrenceGraph.nodes[0].firstObserved.ordinal = 3;
  assertRejectedWith(reversed, 'first-observed ordinal cannot follow');

  const duplicateActive = baseProjection();
  duplicateActive.run.closed = false;
  duplicateActive.occurrenceGraph.nodes[0].state = 'open';
  duplicateActive.occurrenceGraph.activeNodeIds = [
    duplicateActive.occurrenceGraph.nodes[0].id,
    duplicateActive.occurrenceGraph.nodes[0].id,
  ];
  assertRejectedWith(duplicateActive, 'active occurrence identities must be unique');

  const openButInactive = baseProjection();
  openButInactive.run.closed = false;
  openButInactive.occurrenceGraph.nodes[0].state = 'open';
  assertRejectedWith(openButInactive, 'active occurrence identities must exactly equal');

  const closedButActive = baseProjection();
  closedButActive.run.closed = false;
  closedButActive.occurrenceGraph.activeNodeIds = [closedButActive.occurrenceGraph.nodes[0].id];
  assertRejectedWith(closedButActive, 'active occurrence identities must exactly equal');

  const closedRunWithOpenChild = baseProjection();
  const child = {
    id: 'occurrence-node://fixture/open-child',
    aggregateType: 'actor_invocation',
    aggregateId: 'actor-invocation://fixture/open-child',
    label: 'Open child',
    state: 'open',
    firstObserved: coordinate(1, 'actor_invocation_started'),
    lastObserved: coordinate(1, 'actor_invocation_started'),
  };
  closedRunWithOpenChild.occurrenceGraph.nodes.push(child);
  closedRunWithOpenChild.occurrenceGraph.activeNodeIds = [child.id];
  assertAccepted(closedRunWithOpenChild);

  const falselyReadyClosedRun = structuredClone(closedRunWithOpenChild);
  falselyReadyClosedRun.occurrenceGraph.state = 'ready';
  assertRejectedWith(falselyReadyClosedRun, 'requires a partial occurrence posture');
});

test('shared graph truncation receipts preserve unaffected ready planes but prevent ready composition', () => {
  const declarationBounded = baseProjection();
  declarationBounded.declarationTopology = {
    state: 'partial',
    reason: 'references_without_bodies',
    references: [{ kind: 'graph', ref: 'graph://fixture/bounded', sourceEvent: null }],
    nodes: [],
    edges: [],
  };
  declarationBounded.occurrenceGraph.state = 'ready';
  declarationBounded.limits.nodesTruncated = true;
  assertAccepted(declarationBounded);

  const occurrenceBounded = withReadyDeclaration(baseProjection());
  occurrenceBounded.occurrenceGraph.state = 'partial';
  occurrenceBounded.limits.edgesTruncated = true;
  assertAccepted(occurrenceBounded);

  const workspace = baseProjection();
  workspace.workspaceObservations.state = 'ready';
  workspace.limits.workspaceObservationsTruncated = true;
  assertRejectedWith(workspace, 'ready workspace-observation plane cannot carry');

  const actors = withActorPairs(baseProjection());
  actors.actorSessions.state = 'ready';
  actors.limits.actorSessionsTruncated = true;
  assertRejectedWith(actors, 'ready actor-session plane cannot carry');

  const ready = withReadyDeclaration(baseProjection());
  ready.state = 'ready';
  ready.occurrenceGraph.state = 'ready';
  ready.workspaceObservations.state = 'ready';
  assertAccepted(ready);
  for (const flag of [
    'nodesTruncated',
    'edgesTruncated',
    'workspaceObservationsTruncated',
    'actorSessionsTruncated',
    'diagnosticsTruncated',
  ]) {
    const truncated = structuredClone(ready);
    truncated.limits[flag] = true;
    assertRejectedWith(truncated, 'ready visual graph composition cannot carry any truncation');
  }
});

test('actor sessions bind an explicit actor-invocation to process aggregate-parent edge', () => {
  const bound = withActorPairs(baseProjection());
  assertAccepted(bound);

  for (const [sessionIndex, crossedProcess] of [[0, 'b'], [1, 'a']]) {
    const crossed = structuredClone(bound);
    crossed.actorSessions.sessions[sessionIndex].processAggregateId = `process://fixture/${crossedProcess}`;
    assertRejectedWith(crossed, 'exact actor-invocation to process aggregate-parent edge');
  }

  const wrongEdgeKind = structuredClone(bound);
  wrongEdgeKind.occurrenceGraph.edges[0].kind = 'event_causation';
  assertRejectedWith(wrongEdgeKind, 'exact actor-invocation to process aggregate-parent edge');

  const processNotPublished = structuredClone(bound);
  processNotPublished.actorSessions.sessions[0].processAggregateId = null;
  assertAccepted(processNotPublished);
});

test('a distinct external contract retains structural relations without fabricating lifecycle meaning', () => {
  const external = withExternalUninterpretedContract(withActorPairs(baseProjection()));
  assert.ok(external.occurrenceGraph.edges.some((edge) => edge.kind === 'aggregate_parent'));
  assertAccepted(external);

  const interpretedPosture = structuredClone(external);
  interpretedPosture.run.eventPosture = 'terminal_converged';
  assertRejectedWith(interpretedPosture, 'distinct external event contract must remain lifecycle-uninterpreted');

  const closed = structuredClone(external);
  closed.run.closed = true;
  assertRejectedWith(closed, 'cannot close the run');

  const active = structuredClone(external);
  active.occurrenceGraph.activeNodeIds = [active.occurrenceGraph.nodes[0].id];
  assertRejectedWith(active, 'cannot identify active occurrences');

  const closedOccurrence = structuredClone(external);
  closedOccurrence.occurrenceGraph.nodes[0].state = 'closed';
  assertRejectedWith(closedOccurrence, 'occurrence lifecycle state must remain unknown');

  const completedActor = structuredClone(external);
  completedActor.actorSessions.sessions[0].lifecycleState = 'completed';
  completedActor.actorSessions.sessions[0].terminalDisposition = 'completed';
  assertRejectedWith(completedActor, 'actor lifecycle state must remain unknown');

  const revokedActor = structuredClone(external);
  revokedActor.actorSessions.sessions[0].terminalDisposition = 'revoked';
  assertRejectedWith(revokedActor, 'actor terminal disposition must remain unknown');

  const postureAlone = baseProjection();
  postureAlone.run.eventPosture = 'external_contract_uninterpreted';
  assertRejectedWith(postureAlone, 'cannot close the run');
});

test('every visual graph collection and per-session reference family enforces its wire bound', () => {
  const coordinateZero = coordinate(0);
  const cases = [
    {
      path: ['declarationTopology', 'references'],
      count: 241,
      assign(value, count) {
        value.declarationTopology.references = Array.from({ length: count }, (_, index) => ({
          kind: 'graph', ref: `graph://fixture/bound/${index}`, sourceEvent: null,
        }));
      },
    },
    {
      path: ['declarationTopology', 'nodes'],
      count: 241,
      assign(value, count) {
        value.declarationTopology.nodes = Array.from({ length: count }, (_, index) => ({
          id: `declaration-node://fixture/bound/${index}`,
          kind: 'node', label: `Node ${index}`, declarationRef: `graph://fixture/bound/${index}`,
        }));
      },
    },
    {
      path: ['declarationTopology', 'edges'],
      count: 481,
      assign(value, count) {
        value.declarationTopology.edges = Array.from({ length: count }, (_, index) => ({
          id: `declaration-edge://fixture/bound/${index}`,
          kind: 'declared_vector',
          sourceNodeId: 'declaration-node://fixture/source',
          targetNodeId: 'declaration-node://fixture/target',
          declarationRef: `graph://fixture/bound/${index}`,
        }));
      },
    },
    {
      path: ['occurrenceGraph', 'nodes'],
      count: 241,
      assign(value, count) {
        value.occurrenceGraph.nodes = Array.from({ length: count }, (_, index) => ({
          id: `occurrence-node://fixture/bound/${index}`,
          aggregateType: 'c_call', aggregateId: `c-call://fixture/bound/${index}`,
          label: `C-call ${index}`, state: 'unknown',
          firstObserved: coordinateZero, lastObserved: coordinateZero,
        }));
      },
    },
    {
      path: ['occurrenceGraph', 'edges'],
      count: 481,
      assign(value, count) {
        const nodeId = value.occurrenceGraph.nodes[0].id;
        value.occurrenceGraph.edges = Array.from({ length: count }, (_, index) => ({
          id: `occurrence-edge://fixture/bound/${index}`,
          kind: 'event_causation', sourceNodeId: nodeId, targetNodeId: nodeId,
          sourceEvent: coordinateZero, targetEvent: coordinateZero,
        }));
      },
    },
    {
      path: ['occurrenceGraph', 'activeNodeIds'],
      count: 241,
      assign(value, count) {
        value.run.closed = false;
        value.occurrenceGraph.activeNodeIds = Array.from(
          { length: count }, (_, index) => `occurrence-node://fixture/active/${index}`,
        );
      },
    },
    {
      path: ['workspaceObservations', 'observations'],
      count: 81,
      assign(value, count) {
        const row = value.workspaceObservations.observations[0];
        value.workspaceObservations.observations = Array.from({ length: count }, (_, index) => ({
          ...structuredClone(row), ordinal: index,
        }));
      },
    },
    {
      path: ['actorSessions', 'sessions'],
      count: 81,
      prepare: withActorPairs,
      assign(value, count) {
        const session = value.actorSessions.sessions[0];
        value.actorSessions.sessions = Array.from({ length: count }, (_, index) => ({
          ...structuredClone(session), id: `actor-session://fixture/bound/${index}`,
        }));
      },
    },
    {
      path: ['diagnostics'],
      count: 81,
      assign(value, count) {
        value.diagnostics = Array.from({ length: count }, (_, index) => ({
          severity: 'info', code: `bounded_${index}`, message: `Bounded diagnostic ${index}`,
          sourceEvent: null,
        }));
      },
    },
  ];
  for (const subject of cases) {
    const projection = subject.prepare ? subject.prepare(baseProjection()) : baseProjection();
    subject.assign(projection, subject.count);
    assertArrayBoundRejected(projection, subject.path);
  }

  for (const family of ['capabilityRefs', 'operationRefs', 'archiveRefs']) {
    const projection = withActorPairs(baseProjection());
    projection.actorSessions.sessions[0][family] = Array.from(
      { length: 13 }, (_, index) => `capability-ref://fixture/${family}/${index}`,
    );
    assertArrayBoundRejected(projection, ['actorSessions', 'sessions', 0, family]);
  }
});
