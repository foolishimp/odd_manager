import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';
import {
  discoverProjectObservationTopology,
  selectObservationRun,
} from '../../src/server/project-observation-topology-service.mjs';

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

function legacyEvent() {
  return `${JSON.stringify({
    kind: 'basis_admitted',
    eventId: 'event://fixture/0',
    eventTime: '2026-08-28T00:00:00.000Z',
    eventTimeUnixMs: Date.parse('2026-08-28T00:00:00.000Z'),
    eventAdmissionOrdinal: 0,
  })}\n`;
}

function legacyEvents(entries) {
  return `${entries.map((entry, ordinal) => JSON.stringify({
    kind: entry.kind,
    eventId: `event://fixture/${ordinal}`,
    eventTime: new Date(Date.parse('2026-08-28T00:00:00.000Z') + ordinal * 1000).toISOString(),
    eventTimeUnixMs: Date.parse('2026-08-28T00:00:00.000Z') + ordinal * 1000,
    eventAdmissionOrdinal: ordinal,
    runId: entry.runId,
  })).join('\n')}\n`;
}

function identity(runRoot, workspaceRoot) {
  return {
    kind: 'fixture_run',
    schemaVersion: '1',
    scenarioId: 'SCN-BOUNDARY',
    scenarioKind: 'boundary',
    runRoot,
    workspaceRoot,
    substrate: {
      productId: 'abiogenesis',
      packageName: '@abiogenesis/typescript-tenant',
      packageVersion: '4.6.0-rc.3',
    },
  };
}

test('an explicit-selection carrier prevents a legacy default from shadowing it', () => {
  const generic = {
    runId: 'run://fixture/generic',
    runKey: 'run-observation:sha256:generic',
    requiresExplicitSelection: true,
  };
  const legacy = {
    runId: 'run://fixture/legacy',
    runKey: 'run-observation:sha256:legacy',
    requiresExplicitSelection: false,
  };
  assert.equal(selectObservationRun({ runs: [generic, legacy] }), null);
  assert.equal(selectObservationRun({ runs: [generic, legacy] }, generic.runId), generic);
  assert.equal(selectObservationRun({ runs: [generic, legacy] }, legacy.runId), legacy);
  assert.equal(selectObservationRun({ runs: [legacy] }), legacy);
  const reused = { ...legacy, runKey: 'run-observation:sha256:reused' };
  assert.equal(selectObservationRun({ runs: [legacy, reused] }, legacy.runId), null);
  assert.equal(selectObservationRun({ runs: [legacy, reused] }, legacy.runKey), legacy);
  assert.equal(selectObservationRun({ runs: [legacy, reused] }), null);
});

test('legacy execution-basis noise is ignored only for the exact requirement-route event kind', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-legacy-basis-adapter-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const runRoot = join(projectRoot, 'test_runs', 'lane', 'run');
  const workspaceRoot = join(runRoot, 'instance');
  const carrierIdentity = `${JSON.stringify(identity(runRoot, workspaceRoot))}\n`;
  write(join(runRoot, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), legacyEvents([
    { kind: 'basis_admitted', runId: 'run://fixture/exact-legacy-run' },
    { kind: 'requirement_route_fact_projected', runId: 'execution_basis:fixture-noise' },
  ]));

  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 1);
  assert.equal(topology.runs[0].runId, 'run://fixture/exact-legacy-run');
});

test('legacy execution-basis-shaped run identity on any other event kind is invalid', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-legacy-basis-reject-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const runRoot = join(projectRoot, 'test_runs', 'lane', 'run');
  const workspaceRoot = join(runRoot, 'instance');
  const carrierIdentity = `${JSON.stringify(identity(runRoot, workspaceRoot))}\n`;
  write(join(runRoot, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), legacyEvents([
    { kind: 'basis_admitted', runId: 'run://fixture/exact-legacy-run' },
    { kind: 'basis_admitted', runId: 'execution_basis:not-route-noise' },
  ]));

  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 0);
  assert.ok(topology.diagnostics.some((entry) => entry.code === 'run_event_identity_invalid'));
});

test('a sole wrong-kind execution-basis value cannot masquerade as a legacy run identity', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-legacy-basis-sole-reject-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const runRoot = join(projectRoot, 'test_runs', 'lane', 'run');
  const workspaceRoot = join(runRoot, 'instance');
  const carrierIdentity = `${JSON.stringify(identity(runRoot, workspaceRoot))}\n`;
  write(join(runRoot, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), legacyEvents([
    { kind: 'basis_admitted', runId: 'execution_basis:not-route-noise' },
  ]));

  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 0);
  assert.ok(topology.diagnostics.some((entry) => entry.code === 'run_event_identity_invalid'));
});

test('a sole arbitrary non-Run ref cannot become a legacy run identity', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-legacy-non-run-reject-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const runRoot = join(projectRoot, 'test_runs', 'lane', 'run');
  const workspaceRoot = join(runRoot, 'instance');
  const carrierIdentity = `${JSON.stringify(identity(runRoot, workspaceRoot))}\n`;
  write(join(runRoot, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), legacyEvents([
    { kind: 'basis_admitted', runId: 'basis://fixture/not-a-run' },
  ]));

  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 0);
  assert.ok(topology.diagnostics.some((entry) => entry.code === 'run_event_identity_invalid'));
});

test('run discovery rejects a test_runs symlink that escapes the admitted Project', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-run-boundary-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const projectRoot = join(root, 'project');
  const outsideRun = join(root, 'outside', 'run');
  const workspaceRoot = join(outsideRun, 'instance');
  mkdirSync(projectRoot, { recursive: true });
  mkdirSync(join(workspaceRoot, '.ai-workspace', 'events'), { recursive: true });
  const carrierIdentity = `${JSON.stringify(identity(outsideRun, workspaceRoot))}\n`;
  write(join(outsideRun, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), legacyEvent());
  symlinkSync(join(root, 'outside'), join(projectRoot, 'test_runs'));

  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 0);
  assert.ok(topology.diagnostics.some((entry) => entry.code === 'run_root_escape'));
});

test('malformed proof remains an explicit unreadable posture without replacing event truth', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-proof-posture-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const runRoot = join(projectRoot, 'test_runs', 'lane', 'run');
  const workspaceRoot = join(runRoot, 'instance');
  const carrierIdentity = `${JSON.stringify(identity(runRoot, workspaceRoot))}\n`;
  write(join(runRoot, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), legacyEvent());
  write(join(runRoot, 'broken-proof.json'), '{"eventSequence": [}\n');

  const observation = loadAbgRunObservation(projectRoot, { refresh: true });
  assert.equal(observation.state, 'ready');
  assert.equal(observation.carrierSnapshot.eventCount, 1);
  assert.equal(observation.proofReconciliation.state, 'unreadable');
  assert.ok(observation.diagnostics.some((entry) => entry.code === 'run_proof_unreadable'));
});

test('an empty event file cannot become an admitted run merely because identity exists', (context) => {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-empty-carrier-'));
  context.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  const runRoot = join(projectRoot, 'test_runs', 'lane', 'run');
  const workspaceRoot = join(runRoot, 'instance');
  const carrierIdentity = `${JSON.stringify(identity(runRoot, workspaceRoot))}\n`;
  write(join(runRoot, 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'sandbox-identity.json'), carrierIdentity);
  write(join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl'), '');

  const topology = discoverProjectObservationTopology(projectRoot, { refresh: true });
  assert.equal(topology.runs.length, 0);
  assert.ok(topology.diagnostics.some((entry) => entry.code === 'run_event_carrier_unadmitted'));
});
