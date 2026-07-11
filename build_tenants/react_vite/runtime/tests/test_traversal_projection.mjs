import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRunFixture } from './_run-fixture.mjs';
import {
  loadTraversalSummary,
  loadTraversalVectorDetail,
  resolveTraversalRunRoot,
} from '../../src/server/traversal-projection-service.mjs';

const fixture = createRunFixture();
after(() => fixture.cleanup());

test('Project root resolves its admitted run without registering the run workspace as a Project', () => {
  const summary = loadTraversalSummary(fixture.projectRoot, { refresh: true });
  assert.equal(summary.kind, 'traversal_projection');
  assert.equal(summary.version, 1);
  assert.equal(summary.state, 'ready');
  assert.equal(summary.runRoot, fixture.runRoot);
  assert.equal(summary.workspaceRoot, fixture.projectRoot);
  assert.ok(summary.runId);
  assert.equal(summary.scenario.scenarioId, 'SCN-FIXTURE-RUN');
  assert.equal(summary.substrate.packageVersion, '1.2.3');
  assert.equal(summary.graphRef, 'graph://fixture/software-build');
  assert.equal(summary.graphFunctionRef, 'graph-function://fixture/software-build/full');
  assert.equal(summary.overlayRef, 'overlay://fixture/software-build');
  assert.equal(summary.startupConfigRef, 'startup://fixture/software-build');
  assert.equal(summary.eventLogDigest, fixture.eventLogSha256);
  assert.equal(summary.frameLineageState, 'unavailable');

  assert.equal(summary.vectors.length, 2);
  assert.equal(summary.frames.length, 2);
  assert.equal(summary.currentVectorIndex, 1, 'the higher planned unevaluated vector is current');
  assert.ok(summary.frames.every((frame) => frame.graphFunctionRef === 'graph-function://fixture/software-build/full'));

  const vector0 = summary.vectors.find((vector) => vector.vectorIndex === 0);
  assert.equal(vector0.accepted, true);
  assert.equal(vector0.attemptCount, 2);
  assert.equal(vector0.hasEvaluator, true);
  assert.ok(vector0.plannedAt);
  assert.ok(vector0.evaluatedAt);

  const vector1 = summary.vectors.find((vector) => vector.vectorIndex === 1);
  assert.equal(vector1.evaluatedAt, null);
});

test('unknown event kinds are surfaced and requirement lineage remains bounded', () => {
  const summary = loadTraversalSummary(fixture.projectRoot);
  assert.ok(summary.unknownEventKinds.includes('fixture_novel_event'));
  for (const kind of summary.unknownEventKinds) assert.ok(kind in summary.eventCounts);
  assert.equal(summary.requirementLineage.length, 1);
  assert.equal(summary.requirementLineage[0].requirementId, 'REQ-FIXTURE-001');
  assert.deepEqual(summary.requirementLineage[0].residualPressureRefs, ['pressure://fixture/open']);
});

test('summary stays bounded and excludes the source event sequence', () => {
  const summary = loadTraversalSummary(fixture.projectRoot);
  const bytes = Buffer.byteLength(JSON.stringify(summary));
  assert.ok(bytes < 200 * 1024, `summary is ${bytes} bytes`);
  assert.equal('eventSequence' in summary, false);
});

test('vector detail resolves lazily by selected run and lists attempts and evaluator variants', () => {
  const summary = loadTraversalSummary(fixture.projectRoot);
  const result = loadTraversalVectorDetail(fixture.projectRoot, { runId: summary.runId, vectorIndex: 0 });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.detail.attempt, 2);
  assert.equal(result.detail.stagePlan.sourceTypeRef, 'fixture.type.source_0');
  assert.equal(result.detail.stagePlan.targetTypeRef, 'fixture.type.target_0');
  assert.ok(result.detail.availableVariants.some((entry) => entry.variant === 'primary' && entry.attempt === 1));
  assert.ok(result.detail.availableVariants.some((entry) => entry.variant === 'primary' && entry.attempt === 2));
  assert.ok(result.detail.availableVariants.some((entry) => entry.variant === 'evaluator'));
  assert.ok(result.detail.contentPreviews.every((entry) => entry.contentPreview.length <= 400));

  const first = loadTraversalVectorDetail(fixture.projectRoot, { runId: summary.runId, vectorIndex: 0, attempt: 1 });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.detail.attempt, 1);
  assert.equal(first.detail.assessment.accepted, false);
});

test('summary cache invalidates when the vector artifact directory changes', () => {
  const before = loadTraversalSummary(fixture.projectRoot);
  assert.equal(before.vectors.find((vector) => vector.vectorIndex === 0).attemptCount, 2);
  fixture.addAttempt(0, 3, true);
  const afterChange = loadTraversalSummary(fixture.projectRoot);
  assert.equal(afterChange.vectors.find((vector) => vector.vectorIndex === 0).attemptCount, 3);
});

test('a directory without run topology yields an honest unsupported state', () => {
  const dir = mkdtempSync(join(tmpdir(), 'traversal-unsupported-'));
  try {
    const resolved = resolveTraversalRunRoot(dir);
    assert.equal(resolved.state, 'unsupported');
    assert.ok(resolved.diagnostics.some((entry) => entry.code === 'run_topology_missing'));
    const summary = loadTraversalSummary(dir);
    assert.equal(summary.state, 'unsupported');
    assert.equal(summary.runId, null);
    assert.equal(summary.runRoot, null);
    assert.deepEqual(summary.vectors, []);
    assert.equal(summary.currentVectorIndex, null);
    const detail = loadTraversalVectorDetail(dir, { vectorIndex: 0 });
    assert.equal(detail.ok, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid or missing vector requests fail honestly', () => {
  assert.equal(loadTraversalVectorDetail(fixture.projectRoot, { vectorIndex: -1 }).ok, false);
  const missing = loadTraversalVectorDetail(fixture.projectRoot, { vectorIndex: 9999 });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /vector 9999/);
});

test('corrupt vector artifacts return a stable error without leaking parser internals', () => {
  const isolated = createRunFixture();
  try {
    const summary = loadTraversalSummary(isolated.projectRoot, { refresh: true });
    writeFileSync(join(isolated.artifactDir, 'fixture-vector-0-attempt-2-artifact.json'), '{not-json', 'utf8');
    const result = loadTraversalVectorDetail(isolated.projectRoot, { runId: summary.runId, vectorIndex: 0 });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'vector artifact could not be read: invalid_json');
  } finally {
    isolated.cleanup();
  }
});
