import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  FIXTURE_EXECUTION_ADAPTER_REF,
  PROJECT_SNAPSHOT_PROVISIONER_REF,
} from '../../src/server/build-carrier-descriptor-service.mjs';
import { createBuildControlService } from '../../src/server/build-control-service.mjs';
import { createAssuranceService } from '../../src/server/assurance-service.mjs';
import { observeProjectRevision } from '../../src/server/project-revision-service.mjs';

function descriptor(productId) {
  return {
    schemaVersion: '1',
    descriptorRef: `build-carrier-descriptor://${productId}/software-build`,
    productRef: `product://${productId}`,
    productVersion: '0.0.1-fixture',
    carrierKind: 'graph_function',
    carrierRef: `graph-function://${productId}/software-build`,
    startupConfigRef: `startup-config://${productId}/software-build`,
    publicStartTarget: `start-target://${productId}/software-build`,
    inputSchemaRef: 'schema://odd_manager/fixture-build-input/v1',
    worksiteProvisionerRef: PROJECT_SNAPSHOT_PROVISIONER_REF,
    executionAdapterRef: FIXTURE_EXECUTION_ADAPTER_REF,
    supportedCommands: ['submit', 'attach', 'cancel'],
    requirementCatalogRefs: [`requirements://${productId}/software-build`],
    expectedAssetCatalogRefs: [`assets://${productId}/software-build`],
    proofRefs: [`proof://${productId}/carrier-fixture`],
  };
}

function catalog(productId) {
  const inspect = ['reaction://odd_manager/open-run-inspector'];
  return {
    schemaVersion: '1',
    catalogRef: `assurance-catalog://${productId}/software-build`,
    productRef: `product://${productId}`,
    requirementCatalogRef: `requirements://${productId}/software-build`,
    assetCatalogRef: `assets://${productId}/software-build`,
    gates: [
      {
        gateRef: 'gate://fixture/tests',
        label: 'Deterministic test gate',
        requirementRef: 'requirement://fixture/tests',
        regime: 'F_D',
        evidenceKey: 'tests',
        reactionRefs: inspect,
        sourceRefs: [`requirements://${productId}/tests`],
      },
      {
        gateRef: 'gate://fixture/depth',
        label: 'Deterministic depth gate',
        requirementRef: 'requirement://fixture/depth',
        regime: 'F_D',
        evidenceKey: 'depth',
        reactionRefs: inspect,
        sourceRefs: [`requirements://${productId}/depth`],
      },
      {
        gateRef: 'gate://fixture/human-review',
        label: 'Human review gate',
        requirementRef: 'requirement://fixture/human-review',
        regime: 'F_H',
        evidenceKey: 'human-review',
        reactionRefs: inspect,
        sourceRefs: [`requirements://${productId}/human-review`],
      },
    ],
    assets: [{
      requirementRef: 'requirement://fixture/software-package',
      label: 'Software package',
      evidenceKey: 'software-package',
      reactionRefs: inspect,
      sourceRefs: [`assets://${productId}/software-package`],
    }],
    sourceRefs: ['.odd/assurance-catalog.json'],
  };
}

function fixture(productId = 'assurance_fixture') {
  const root = mkdtempSync(join(tmpdir(), `odd-manager-${productId}-`));
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-assurance-state-'));
  mkdirSync(join(root, '.ai-workspace'), { recursive: true });
  mkdirSync(join(root, '.odd'), { recursive: true });
  mkdirSync(join(root, 'specification'), { recursive: true });
  writeFileSync(join(root, 'specification', 'PRODUCT.md'), `# ${productId} Product\n`, 'utf8');
  writeFileSync(join(root, 'source.txt'), 'fixture source\n', 'utf8');
  writeFileSync(join(root, '.odd', 'build-carrier.json'), `${JSON.stringify(descriptor(productId), null, 2)}\n`, 'utf8');
  writeFileSync(join(root, '.odd', 'assurance-catalog.json'), `${JSON.stringify(catalog(productId), null, 2)}\n`, 'utf8');
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', [
    '-C', root,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
  let sequence = 0;
  const build = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    idFactory: (kind) => `${kind}-${++sequence}`,
  });
  const assurance = createAssuranceService({ buildControlService: build });
  const project = {
    id: `${productId}-project`, root, label: productId, publishedProductRef: `product://${productId}`,
  };
  return {
    root,
    managerStateRoot,
    project,
    build,
    assurance,
    cleanup() {
      build.shutdown();
      rmSync(root, { recursive: true, force: true });
      rmSync(managerStateRoot, { recursive: true, force: true });
    },
  };
}

async function run(current, assuranceProfile = 'none') {
  const revision = observeProjectRevision(current.root);
  const submitted = current.build.submit({
    project: current.project,
    revision,
    inputs: {
      durationMs: 100,
      outcome: 'converged',
      label: `assurance-${assuranceProfile.replaceAll('_', '-')}`,
      assuranceProfile,
    },
    requestedBy: 'actor://operator/test',
  });
  const execution = await current.build.waitFor((store) => {
    const candidate = store.executions.find((entry) => entry.executionId === submitted.execution.executionId);
    return candidate?.state === 'converged' ? candidate : null;
  });
  return { revision, execution };
}

function assess(current, runResult, revision = runResult.revision) {
  return current.assurance.snapshot({
    project: current.project,
    revision,
    executionId: runResult.execution.executionId,
  });
}

test('a converged process with no evidence leaves every required gate and asset missing', async () => {
  const current = fixture('assurance_missing');
  try {
    const result = await run(current, 'none');
    const snapshot = assess(current, result);
    assert.equal(result.execution.processOutcome.kind, 'typed_result');
    assert.equal(snapshot.summary.posture, 'partial');
    assert.deepEqual(snapshot.gateAssessments.map((entry) => entry.status), ['missing', 'missing', 'missing']);
    assert.deepEqual(snapshot.assetDeliveries.map((entry) => entry.status), ['missing']);
    assert.equal(snapshot.summary.gateCounts.satisfied, 0);
    assert.equal(snapshot.summary.assetCounts.delivered, 0);
    assert.equal(snapshot.attentionItems.length, 4);
    assert.equal(snapshot.summary.blockingAttentionCount, 4);
  } finally {
    current.cleanup();
  }
});

test('matching execution, revision, evidence refs, and digests can verify all catalog rows', async () => {
  const current = fixture('assurance_complete');
  try {
    const result = await run(current, 'complete');
    const snapshot = assess(current, result);
    assert.equal(snapshot.summary.posture, 'verified');
    assert.deepEqual(snapshot.gateAssessments.map((entry) => entry.status), ['satisfied', 'satisfied', 'satisfied']);
    assert.deepEqual(snapshot.assetDeliveries.map((entry) => entry.status), ['delivered']);
    assert.ok(snapshot.gateAssessments.every((entry) => entry.evidenceRefs.length > 0 && entry.evidenceDigest));
    assert.ok(snapshot.assetDeliveries.every((entry) => entry.evidenceRefs.length > 0 && entry.digest));
    assert.equal(snapshot.attentionItems.length, 0);
  } finally {
    current.cleanup();
  }
});

test('proof digest mismatch prevents a positive gate and derives blocking attention', async () => {
  const current = fixture('assurance_mismatch');
  try {
    const result = await run(current, 'proof_mismatch');
    const snapshot = assess(current, result);
    assert.equal(snapshot.summary.posture, 'stale');
    assert.equal(snapshot.gateAssessments.find((entry) => entry.gateRef === 'gate://fixture/depth').status, 'stale');
    assert.match(snapshot.gateAssessments.find((entry) => entry.gateRef === 'gate://fixture/depth').detail, /digest does not match/);
    assert.equal(snapshot.summary.blockingAttentionCount, 1);
  } finally {
    current.cleanup();
  }
});

test('evidence from one key cannot be reassigned to another catalog gate', async () => {
  const current = fixture('assurance_key_mismatch');
  try {
    const result = await run(current, 'complete');
    const bundlePath = join(
      current.managerStateRoot,
      '.ai-workspace', 'runtime', 'developer-control', 'build-control', 'executions',
      result.execution.executionId,
      'assurance-evidence.json',
    );
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
    bundle.gateResults.find((entry) => entry.gateRef === 'gate://fixture/depth').evidenceKey = 'tests';
    writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    const snapshot = assess(current, result);
    const depth = snapshot.gateAssessments.find((entry) => entry.gateRef === 'gate://fixture/depth');
    assert.equal(depth.status, 'stale');
    assert.match(depth.detail, /does not match the required gate catalog key/);
  } finally {
    current.cleanup();
  }
});

test('evidence revision mismatch makes all assessed rows stale', async () => {
  const current = fixture('assurance_revision');
  try {
    const result = await run(current, 'revision_mismatch');
    const snapshot = assess(current, result);
    assert.equal(snapshot.summary.posture, 'stale');
    assert.ok(snapshot.gateAssessments.every((entry) => entry.status === 'stale'));
    assert.ok(snapshot.assetDeliveries.every((entry) => entry.status === 'stale'));
  } finally {
    current.cleanup();
  }
});

test('F_H waiting posture cannot override deterministic failure', async () => {
  const current = fixture('assurance_regimes');
  try {
    const result = await run(current, 'fd_fail_waiting_human');
    const snapshot = assess(current, result);
    assert.equal(snapshot.summary.posture, 'failed');
    assert.equal(snapshot.gateAssessments.find((entry) => entry.regime === 'F_H').status, 'waiting_human');
    assert.equal(snapshot.gateAssessments.find((entry) => entry.gateRef === 'gate://fixture/tests').status, 'failed');
    assert.equal(snapshot.summary.gateCounts.failed, 1);
    assert.equal(snapshot.summary.gateCounts.waitingHuman, 1);
  } finally {
    current.cleanup();
  }
});

test('source revision drift makes prior execution assurance stale', async () => {
  const current = fixture('assurance_source_drift');
  try {
    const result = await run(current, 'complete');
    writeFileSync(join(current.root, 'source.txt'), 'changed source\n', 'utf8');
    const currentRevision = observeProjectRevision(current.root);
    const snapshot = assess(current, result, currentRevision);
    assert.equal(snapshot.summary.posture, 'stale');
    assert.ok(snapshot.gateAssessments.every((entry) => entry.status === 'stale'));
  } finally {
    current.cleanup();
  }
});

test('missing assurance catalog is explicit unsupported posture, not empty success', async () => {
  const current = fixture('assurance_catalog_missing');
  try {
    rmSync(join(current.root, '.odd', 'assurance-catalog.json'));
    const revision = observeProjectRevision(current.root);
    const snapshot = current.assurance.snapshot({ project: current.project, revision, executionId: null });
    assert.equal(snapshot.catalogAdmission.status, 'unavailable');
    assert.equal(snapshot.summary.posture, 'unsupported');
    assert.equal(snapshot.attentionItems.length, 1);
    assert.match(snapshot.attentionItems[0].reason, /.odd\/assurance-catalog.json/);
  } finally {
    current.cleanup();
  }
});
