import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  abgEventSequence,
  indexAbgEventCarrier,
} from '../../src/server/abg-event-carrier-service.mjs';
import { discoverProjectObservationTopology } from '../../src/server/project-observation-topology-service.mjs';
import { loadVisualGraphProjection } from '../../src/server/visual-graph-projection-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(here, '../..');
const repositoryRoot = resolve(tenantRoot, '../..');
const oddGlcRoot = '/Users/jim/src/apps/odd_glc';
const proofPath = resolve(tenantRoot, 'qualification/t040-visual-runtime-observation-proof.json');
const ticketPath = resolve(repositoryRoot, '.ai-workspace/tickets/active/T-040-restore-visual-graph-traversal-and-contextual-pty-observation.md');
const definitionPath = resolve(repositoryRoot, 'stdo_odd_manager.json');

function digestBytes(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function digestFile(path) {
  return digestBytes(readFileSync(path));
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON does not admit non-finite numbers');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function canonicalDigest(value) {
  return digestBytes(canonicalJson(value));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function withinRepository(relativePath) {
  const path = resolve(repositoryRoot, relativePath);
  assert.ok(path.startsWith(`${repositoryRoot}${sep}`), `proof artifact escapes repository: ${relativePath}`);
  return path;
}

test('T-040 proof replays exact artifact, governance, installed-subject, and projection bindings', () => {
  const proof = readJson(proofPath);
  assert.equal(proof.kind, 't040_visual_runtime_observation_qualification');
  assert.equal(proof.schemaVersion, '1');
  assert.equal(proof.disposition, 'partial_bounded_implementation');
  assert.equal(proof.ticket.id, 'T-040');
  assert.equal(proof.ticket.status, 'active');
  assert.equal(proof.ticket.closureClaim, false);
  assert.equal(proof.ticket.currentSha256, digestFile(ticketPath));
  assert.equal(proof.governance.release, 'v2.5.0-rc.4');
  assert.equal(proof.governance.definitionSha256, digestFile(definitionPath));

  assert.ok(Array.isArray(proof.implementationArtifacts));
  assert.ok(proof.implementationArtifacts.length > 0);
  const artifactPaths = new Set();
  for (const artifact of proof.implementationArtifacts) {
    assert.equal(artifactPaths.has(artifact.path), false, `duplicate proof artifact: ${artifact.path}`);
    artifactPaths.add(artifact.path);
    assert.equal(artifact.sha256, digestFile(withinRepository(artifact.path)), artifact.path);
  }

  const subject = proof.installedSubject;
  const candidatePath = resolve(oddGlcRoot, subject.candidateRelativePath);
  assert.ok(candidatePath.startsWith(`${oddGlcRoot}${sep}`));
  assert.equal(subject.candidateSha256, digestFile(candidatePath));
  const candidate = readJson(candidatePath);
  assert.equal(subject.scenarioKey, candidate.scenarioKey);
  assert.equal(subject.scenarioId, candidate.scenarioId);
  assert.equal(subject.authority, candidate.authority);
  assert.equal(subject.candidateDisposition, candidate.disposition);
  assert.equal(subject.validationDisposition, candidate.validation.disposition);
  assert.equal(subject.runId, candidate.run.ref);
  assert.equal(subject.runDigest, candidate.run.digest);
  assert.deepEqual(subject.abiArtifact, {
    productId: candidate.abiArtifact.productId,
    packageVersion: candidate.abiArtifact.packageVersion,
    sha256: candidate.abiArtifact.sha256,
    productContentDigest: candidate.abiArtifact.productContentDigest,
    productManifestDigest: candidate.abiArtifact.productManifestDigest,
  });
  assert.equal(digestFile(candidate.abiArtifact.path), candidate.abiArtifact.sha256);

  const { coordinateDigest, ...coordinateBody } = candidate.terminalPrefix;
  assert.equal(coordinateDigest, canonicalDigest(coordinateBody));
  assert.equal(subject.terminalPrefix.coordinateDigest, coordinateDigest);
  assert.equal(subject.terminalPrefix.byteLength, coordinateBody.prefixLength);
  assert.equal(subject.terminalPrefix.sha256, coordinateBody.prefixDigest);
  const eventPath = fileURLToPath(coordinateBody.eventLogRef);
  const eventBytes = readFileSync(eventPath);
  assert.ok(eventBytes.length >= coordinateBody.prefixLength);
  assert.equal(digestBytes(eventBytes.subarray(0, coordinateBody.prefixLength)), coordinateBody.prefixDigest);

  const index = indexAbgEventCarrier(eventPath, {
    refresh: true,
    publishedEventContractDigest: candidate.terminalPrefix.storeIdentity.eventContractDigest,
    contractBindingPosture: 'durable_prefix_coordinate_verified',
  });
  assert.equal(index.state, 'ready');
  assert.equal(index.generation, subject.eventGeneration);
  assert.equal(index.eventCount, subject.eventCount);
  assert.equal(abgEventSequence(index).filter((event) => event.runId === subject.runId).length, subject.runScopedEventCount);

  const projection = loadVisualGraphProjection(oddGlcRoot, {
    runId: subject.runId,
    generation: subject.eventGeneration,
    refresh: true,
  });
  assert.equal(projection.state, proof.projection.state);
  assert.equal(projection.run.eventPosture, subject.eventPosture);
  assert.equal(projection.run.closed, subject.closed);
  assert.deepEqual(projection.run.eventContract, subject.eventContract);
  assert.deepEqual({
    state: projection.declarationTopology.state,
    reason: projection.declarationTopology.reason,
    references: projection.declarationTopology.references.length,
    nodes: projection.declarationTopology.nodes.length,
    edges: projection.declarationTopology.edges.length,
  }, proof.projection.declarationTopology);
  assert.deepEqual({
    state: projection.occurrenceGraph.state,
    nodes: projection.occurrenceGraph.nodes.length,
    edges: projection.occurrenceGraph.edges.length,
    aggregateParentEdges: projection.occurrenceGraph.edges.filter((edge) => edge.kind === 'aggregate_parent').length,
    eventCausationEdges: projection.occurrenceGraph.edges.filter((edge) => edge.kind === 'event_causation').length,
    activeNodes: projection.occurrenceGraph.activeNodeIds.length,
    lastObservedNodes: projection.occurrenceGraph.lastObservedNodeId === null ? 0 : 1,
  }, proof.projection.occurrenceGraph);
  assert.deepEqual({
    state: projection.workspaceObservations.state,
    currentness: projection.workspaceObservations.currentness,
    observations: projection.workspaceObservations.observations.length,
    currentStates: [...new Set(projection.workspaceObservations.observations.map((row) => (
      `${row.current.state}:${row.current.posture}`
    )))],
    model: 'immutable_O0_effect_O1_observations_over_separately_mutable_workspace',
  }, proof.projection.workspaceObservations);
  const session = projection.actorSessions.sessions[0] ?? null;
  assert.deepEqual({
    state: projection.actorSessions.state,
    sessions: projection.actorSessions.sessions.length,
    lifecycleState: session?.lifecycleState ?? null,
    terminalDisposition: session?.terminalDisposition ?? null,
    interactionDisposition: projection.actorSessions.interactionDisposition,
    canAttach: session?.canAttach ?? false,
    capabilityRefs: session?.capabilityRefs.length ?? 0,
    operationRefs: session?.operationRefs.length ?? 0,
    archiveRefs: session?.archiveRefs.length ?? 0,
  }, proof.projection.actorSessions);
  assert.deepEqual(projection.diagnostics.map((entry) => entry.code), proof.projection.diagnostics);
  assert.equal(Object.entries(projection.limits)
    .filter(([key]) => key.endsWith('Truncated'))
    .some(([, value]) => value === true), proof.projection.truncated);
  assert.ok(projection.workspaceObservations.observations.every((row) => row.sourceEvent === null));

  const serialized = JSON.stringify(projection);
  for (const forbidden of ['/Users/', '/private/', 'file://', 'relativePath', '"cwd"', '"args"', '"prompt"', '"stdout"']) {
    assert.equal(serialized.includes(forbidden), false, `projection leaked forbidden summary material: ${forbidden}`);
  }

  const topology = discoverProjectObservationTopology(oddGlcRoot, { refresh: true });
  const byScenario = new Map(topology.runs.map((run) => [run.scenarioKey, run]));
  for (const row of proof.scenarioPortfolio) {
    const retained = byScenario.get(row.scenarioKey) ?? null;
    assert.equal(Boolean(retained), row.retainedCandidate, row.scenarioKey);
    if (!retained) continue;
    assert.equal(retained.authority, row.authority);
    assert.equal(retained.candidateDisposition, row.candidateDisposition);
    assert.equal(retained.validationDisposition, row.validationDisposition);
  }

  assert.match(
    proof.qualification.installedDevelopment.candidateManifestExcludingProofSha256,
    /^sha256:[0-9a-f]{64}$/u,
  );
  assert.ok(Number.isSafeInteger(proof.qualification.installedDevelopment.candidateMemberCountExcludingProof));
});
