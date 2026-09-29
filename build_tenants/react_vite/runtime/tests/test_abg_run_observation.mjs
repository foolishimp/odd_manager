import { appendFileSync } from 'node:fs';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunFixture } from './_run-fixture.mjs';
import { discoverProjectObservationTopology } from '../../src/server/project-observation-topology-service.mjs';
import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';
import { loadTraversalSummary } from '../../src/server/traversal-projection-service.mjs';

const fixture = createRunFixture();
after(() => fixture.cleanup());

test('Project observation topology derives identity from PRODUCT and admits related run roots', () => {
  const topology = discoverProjectObservationTopology(fixture.projectRoot, { refresh: true });
  assert.equal(topology.kind, 'project_observation_topology');
  assert.equal(topology.identity.id, 'fixture_product');
  assert.equal(topology.identity.sourceRef, 'specification/PRODUCT.md');
  assert.equal(topology.runs.length, 1);
  assert.equal(topology.runs[0].runRoot, fixture.runRoot);
  assert.equal(topology.runs[0].workspaceRoot, fixture.workspaceRoot);
  assert.ok(topology.runCarrierRoots.some((root) => root.endsWith('/test_runs')));
});

test('generic ABG run observation recovers operational sections from admitted carriers', () => {
  const observation = loadAbgRunObservation(fixture.projectRoot, { refresh: true });
  assert.equal(observation.kind, 'abg_run_observation');
  assert.equal(observation.state, 'ready');
  assert.equal(observation.projectRoot, fixture.projectRoot);
  assert.equal(observation.selectedRunRoot, fixture.runRoot);
  assert.equal(observation.selectedWorkspaceRoot, fixture.workspaceRoot);

  assert.equal(observation.activity.currentVectorIndex, 1);
  assert.equal(observation.activity.retryCount, 1);
  assert.equal(observation.activity.continuationCount, 1);
  assert.equal(observation.functions.length, 1);
  assert.equal(observation.functions[0].graphFunctionRef, 'graph-function://fixture/software-build/full');
  assert.equal(observation.stages.length, 2);
  assert.equal(observation.assets.length, 2);
  assert.ok(observation.transcripts.some((entry) => entry.kind === 'startup'));
  assert.ok(observation.transcripts.some((entry) => entry.kind === 'stdout'));
  assert.ok(observation.events.some((entry) => entry.kind === 'fixture_novel_event'));
  assert.ok(observation.eventKinds.some((entry) => entry.kind === 'fixture_novel_event' && entry.count === 1));
  const eventArtifact = observation.artifacts.find((entry) => entry.role === 'event_log');
  assert.ok(observation.systemReferences.some((entry) => entry.kind === 'event_digest' && entry.ref === eventArtifact.digest));
  assert.equal(eventArtifact.digestState, 'verified');
  assert.equal(eventArtifact.observedDigest, eventArtifact.digest);
  const projectEventArtifact = observation.artifacts.find((entry) => entry.path === fixture.projectEventLogPath);
  assert.equal(projectEventArtifact.digestState, 'not_declared');
  assert.equal(projectEventArtifact.digest, null);
  assert.ok(projectEventArtifact.observedDigest);

  assert.equal(observation.assurance.testStatus, 0);
  assert.equal(observation.assurance.testPassCount, 3);
  assert.equal(observation.assurance.depthProofRowCount, 1);
  assert.equal(observation.assurance.mutationCount, 1);
  assert.equal(observation.assurance.mutationKillCount, 1);
  assert.equal(observation.assurance.mutationRestoreMismatchCount, 0);
  assert.ok(observation.artifacts.some((entry) => entry.role === 'proof'));
  assert.ok(observation.artifacts.some((entry) => entry.role === 'test_result'));
  assert.ok(observation.artifacts.some((entry) => entry.role === 'vector_artifacts'));
});

test('event ledger verification fails closed when the observed bytes drift from proof truth', () => {
  appendFileSync(fixture.eventLogPath, `${JSON.stringify({
    index: 21,
    kind: 'fixture_drift',
    edge: null,
    vectorIndex: null,
    graphFunctionRef: null,
    eventId: 'fixture-event:21',
    eventTime: '2026-07-10T00:00:21.000Z',
    eventTimeUnixMs: Date.parse('2026-07-10T00:00:21.000Z'),
    eventAdmissionOrdinal: 21,
  })}\n`, 'utf8');
  const observation = loadAbgRunObservation(fixture.projectRoot, { refresh: true });
  const eventArtifact = observation.artifacts.find((entry) => entry.role === 'event_log');
  assert.equal(eventArtifact.digestState, 'mismatch');
  assert.notEqual(eventArtifact.observedDigest, eventArtifact.digest);

  const traversal = loadTraversalSummary(fixture.projectRoot, { refresh: true });
  assert.equal(traversal.state, 'ready');
  assert.ok(traversal.diagnostics.some((entry) => entry.code === 'proof_candidate_conflict'));
  assert.equal(traversal.eventLogDigest, eventArtifact.observedDigest);
});

test('ABG catalog projects admitted registry truth, rejection, variants, and construction catalog refs', () => {
  const observation = loadAbgRunObservation(fixture.projectRoot, { refresh: true });
  assert.equal(observation.catalog.state, 'ready');
  assert.equal(observation.catalog.sourceKind, 'abg_runtime_events');
  assert.equal(observation.catalog.admissionEventCount, 3);
  assert.equal(observation.catalog.entryCount, 2);
  assert.deepEqual(observation.catalog.entryKindCounts, [
    { kind: 'graph_function', count: 1 },
    { kind: 'node_type', count: 1 },
  ]);

  const nodeType = observation.catalog.entries.find((entry) => entry.entryKind === 'node_type');
  assert.equal(nodeType.name, 'fixture.type.catalogued_asset');
  assert.equal(nodeType.entryRef, null);
  assert.equal(nodeType.templateRef, 'inline:fixture.type.catalogued_asset');
  assert.deepEqual(nodeType.inputTypeRefs, ['fixture.type.catalogued_asset']);
  assert.deepEqual(nodeType.declarationKeys, ['fixture.catalog.declaration']);
  assert.equal(nodeType.admissionCount, 2);
  assert.equal(nodeType.variantCount, 2);
  assert.deepEqual(nodeType.sourceEventIndexes, [16, 17]);

  const graphFunction = observation.catalog.entries.find((entry) => entry.entryKind === 'graph_function');
  assert.equal(graphFunction.entryRef, 'graph-function://fixture/software-build/full');
  assert.equal(graphFunction.admissionCount, 1);
  assert.equal(observation.catalog.rejectedEventCount, 1);
  assert.equal(observation.catalog.rejectedEntries[0].rejectionReason, 'contract_identity_mismatch');
  assert.equal(observation.catalog.constructionCatalogEventCount, 1);
  assert.equal(observation.catalog.constructionCatalogs[0].catalogRef, 'construction-catalog://fixture/1');
  assert.equal(observation.catalog.truncated, false);
});

test('run projection remains bounded and a missing selected run fails honestly', () => {
  const observation = loadAbgRunObservation(fixture.projectRoot);
  assert.ok(observation.events.length <= 240);
  assert.ok(Buffer.byteLength(JSON.stringify(observation)) < 512 * 1024);

  const discovery = loadAbgRunObservation(fixture.projectRoot, { allowImplicitSelection: false });
  assert.equal(discovery.state, 'unsupported');
  assert.equal(discovery.selectedRunId, null);
  assert.equal(discovery.runs.length, 1);
  assert.ok(discovery.diagnostics.some((entry) => entry.code === 'run_selection_required'));
  const blankDiscovery = loadAbgRunObservation(fixture.projectRoot, {
    runId: '   ',
    allowImplicitSelection: false,
  });
  assert.equal(blankDiscovery.selectedRunId, null);
  assert.ok(blankDiscovery.diagnostics.some((entry) => entry.code === 'run_selection_required'));
  const traversalDiscovery = loadTraversalSummary(fixture.projectRoot, { allowImplicitSelection: false });
  assert.equal(traversalDiscovery.state, 'unsupported');
  assert.equal(traversalDiscovery.runId, null);
  assert.ok(traversalDiscovery.diagnostics.some((entry) => entry.code === 'run_selection_required'));
  const blankTraversalDiscovery = loadTraversalSummary(fixture.projectRoot, {
    runId: '   ',
    allowImplicitSelection: false,
  });
  assert.equal(blankTraversalDiscovery.runId, null);
  assert.ok(blankTraversalDiscovery.diagnostics.some((entry) => entry.code === 'run_selection_required'));

  const missing = loadAbgRunObservation(fixture.projectRoot, { runId: 'missing-run' });
  assert.equal(missing.state, 'unsupported');
  assert.equal(missing.selectedRunId, null);
  assert.ok(missing.diagnostics.some((entry) => entry.code === 'selected_run_missing'));
});
