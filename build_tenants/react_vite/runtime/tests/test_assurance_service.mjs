import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  assuranceAttentionIdentity,
  assuranceCatalogSchema,
  assuranceSnapshotSchema,
  buildEvidenceBundleSchema,
} from '@odd-manager/developer-control-contracts';
import {
  FIXTURE_EXECUTION_ADAPTER_REF,
  PROJECT_SNAPSHOT_PROVISIONER_REF,
} from '../../src/server/build-carrier-descriptor-service.mjs';
import { createBuildControlService } from '../../src/server/build-control-service.mjs';
import { createAssuranceService } from '../../src/server/assurance-service.mjs';
import { loadDeveloperControlPortfolio } from '../../src/server/developer-control-bootstrap-service.mjs';
import { observeProjectRevision } from '../../src/server/project-revision-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, '../../src');
const developerControlContractsUrl = new URL(
  '../../packages/developer-control-contracts/dist/index.js',
  import.meta.url,
).href;

async function loadTypeScriptModule(relativePath) {
  const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8');
  let compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  compiled = compiled
    .replaceAll(
      '"@odd-manager/developer-control-contracts"',
      JSON.stringify(developerControlContractsUrl),
    )
    .replaceAll(
      "'@odd-manager/developer-control-contracts'",
      JSON.stringify(developerControlContractsUrl),
    );
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`);
}

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
        positiveDecisionRequirement: null,
        reactionRefs: inspect,
        sourceRefs: [`requirements://${productId}/tests`],
      },
      {
        gateRef: 'gate://fixture/depth',
        label: 'Probabilistic depth gate',
        requirementRef: 'requirement://fixture/depth',
        regime: 'F_P',
        evidenceKey: 'depth',
        positiveDecisionRequirement: {
          kind: 'probabilistic',
          evaluatorRef: 'evaluator://fixture/depth-reviewer',
          authorityRef: 'authority://fixture/probabilistic-assurance',
          basisRefs: [
            'requirement://fixture/depth',
            'policy://fixture/probabilistic-assurance/v1',
          ],
          requiredFactRefs: [
            'fact://fixture/depth/coverage',
            'fact://fixture/depth/residual-risk',
          ],
        },
        reactionRefs: inspect,
        sourceRefs: [`requirements://${productId}/depth`],
      },
      {
        gateRef: 'gate://fixture/human-review',
        label: 'Human review gate',
        requirementRef: 'requirement://fixture/human-review',
        regime: 'F_H',
        evidenceKey: 'human-review',
        positiveDecisionRequirement: {
          kind: 'human',
          decisionRef: 'decision://fixture/human-review/approval',
          requiredOutcome: 'approved',
          authorityRef: 'authority://fixture/human-release-review',
          basisRefs: [
            'requirement://fixture/human-review',
            'policy://fixture/human-release-review/v1',
          ],
        },
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

function evidencePaths(current, executionId) {
  const root = join(
    current.managerStateRoot,
    '.ai-workspace', 'runtime', 'developer-control', 'build-control', 'executions',
    executionId,
  );
  return {
    bundle: join(root, 'assurance-evidence.json'),
    evidence: (key) => join(root, 'evidence', `${key}.json`),
  };
}

function rewriteGateDecision(current, runResult, gateRef, mutate) {
  const paths = evidencePaths(current, runResult.execution.executionId);
  const bundle = JSON.parse(readFileSync(paths.bundle, 'utf8'));
  const gate = bundle.gateResults.find((entry) => entry.gateRef === gateRef);
  assert.ok(gate, `missing gate result ${gateRef}`);
  mutate(gate);
  const evidencePath = paths.evidence(gate.evidenceKey);
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
  evidence.decision = gate.decision;
  const content = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(evidencePath, content, 'utf8');
  gate.digest = `sha256:${createHash('sha256').update(content).digest('hex')}`;
  writeFileSync(paths.bundle, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  return bundle;
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
    assert.equal(
      snapshot.gateAssessments.find((entry) => entry.regime === 'F_P').decision.evaluatorRef,
      'evaluator://fixture/depth-reviewer',
    );
    assert.equal(
      snapshot.gateAssessments.find((entry) => entry.regime === 'F_H').decision.actorRef,
      'actor://human/fixture-reviewer',
    );
    assert.ok(snapshot.assetDeliveries.every((entry) => entry.evidenceRefs.length > 0 && entry.digest));
    assert.equal(snapshot.attentionItems.length, 0);
  } finally {
    current.cleanup();
  }
});

test('digest-valid generic passed evidence cannot satisfy F_P or F_H gates', async () => {
  const current = fixture('assurance_generic_passed');
  try {
    const result = await run(current, 'complete');
    rewriteGateDecision(current, result, 'gate://fixture/depth', (gate) => {
      gate.decision = null;
    });
    rewriteGateDecision(current, result, 'gate://fixture/human-review', (gate) => {
      gate.decision = null;
    });

    const snapshot = assess(current, result);
    const probabilistic = snapshot.gateAssessments.find((entry) => entry.regime === 'F_P');
    const human = snapshot.gateAssessments.find((entry) => entry.regime === 'F_H');
    assert.equal(probabilistic.status, 'stale');
    assert.match(probabilistic.detail, /probabilistic decision has not been supplied/);
    assert.equal(human.status, 'waiting_human');
    assert.match(human.detail, /human decision has not been supplied/);
    assert.equal(snapshot.summary.posture, 'stale');
    assert.notEqual(snapshot.summary.posture, 'verified');
  } finally {
    current.cleanup();
  }
});

test('F_P and F_H evidence cannot replace catalog-admitted authority or basis', async () => {
  const current = fixture('assurance_authority_mismatch');
  try {
    const result = await run(current, 'complete');
    rewriteGateDecision(current, result, 'gate://fixture/depth', (gate) => {
      gate.decision.authorityRef = 'authority://foreign/probabilistic';
    });
    rewriteGateDecision(current, result, 'gate://fixture/human-review', (gate) => {
      gate.decision.basisRefs = ['policy://foreign/human-review'];
    });

    const snapshot = assess(current, result);
    for (const regime of ['F_P', 'F_H']) {
      const assessment = snapshot.gateAssessments.find((entry) => entry.regime === regime);
      assert.equal(assessment.status, 'stale');
      assert.match(assessment.detail, /authority or basis does not match/);
    }
    assert.equal(snapshot.summary.posture, 'stale');
  } finally {
    current.cleanup();
  }
});

test('F_P satisfaction requires the exact catalog-required decision facts', async () => {
  const current = fixture('assurance_fact_mismatch');
  try {
    const result = await run(current, 'complete');
    rewriteGateDecision(current, result, 'gate://fixture/depth', (gate) => {
      gate.decision.facts = [{
        factRef: 'fact://fixture/depth/coverage',
        outcome: 'satisfied',
      }];
    });

    const snapshot = assess(current, result);
    const probabilistic = snapshot.gateAssessments.find((entry) => entry.regime === 'F_P');
    assert.equal(probabilistic.status, 'stale');
    assert.match(probabilistic.detail, /facts do not exactly match/);
    assert.equal(snapshot.summary.posture, 'stale');
  } finally {
    current.cleanup();
  }
});

test('assurance contracts bind non-deterministic positive decisions to catalog authority', async () => {
  const current = fixture('assurance_contract_authority');
  try {
    const admittedCatalog = catalog('assurance_contract_authority');
    const missingProbabilisticAuthority = structuredClone(admittedCatalog);
    missingProbabilisticAuthority.gates.find((entry) => entry.regime === 'F_P').positiveDecisionRequirement = null;
    assert.equal(assuranceCatalogSchema.safeParse(missingProbabilisticAuthority).success, false);

    const result = await run(current, 'complete');
    const paths = evidencePaths(current, result.execution.executionId);
    const bundle = JSON.parse(readFileSync(paths.bundle, 'utf8'));
    const missingHumanActor = structuredClone(bundle);
    delete missingHumanActor.gateResults.find((entry) => entry.gateRef === 'gate://fixture/human-review').decision.actorRef;
    assert.equal(buildEvidenceBundleSchema.safeParse(missingHumanActor).success, false);

    const snapshot = assess(current, result);
    const foreignAuthority = structuredClone(snapshot);
    foreignAuthority.gateAssessments.find((entry) => entry.regime === 'F_P').decision.authorityRef =
      'authority://foreign/probabilistic';
    assert.equal(assuranceSnapshotSchema.safeParse(foreignAuthority).success, false);

    const genericHumanPass = structuredClone(snapshot);
    genericHumanPass.gateAssessments.find((entry) => entry.regime === 'F_H').decision = null;
    assert.equal(assuranceSnapshotSchema.safeParse(genericHumanPass).success, false);
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
    const projectSnapshot = current.assurance.snapshot({
      project: current.project,
      revision,
      executionId: null,
    });
    assert.equal(projectSnapshot.catalogAdmission.status, 'unavailable');
    assert.equal(projectSnapshot.summary.posture, 'unsupported');
    assert.equal(projectSnapshot.attentionItems.length, 1);
    assert.equal(projectSnapshot.attentionItems[0].executionId, null);
    assert.equal(
      projectSnapshot.attentionItems[0].correlationId,
      `project:${current.project.id}:assurance`,
    );
    assert.match(projectSnapshot.attentionItems[0].reason, /.odd\/assurance-catalog.json/);

    const result = await run(current, 'none');
    const executionSnapshot = assess(current, result);
    assert.equal(executionSnapshot.catalogAdmission.status, 'unavailable');
    assert.equal(executionSnapshot.attentionItems.length, 1);
    assert.equal(
      executionSnapshot.attentionItems[0].executionId,
      result.execution.executionId,
    );
    assert.equal(
      executionSnapshot.attentionItems[0].correlationId,
      result.execution.correlationId,
    );
  } finally {
    current.cleanup();
  }
});

test('length-framed attention identities keep boundary-shifted Projects, sentinel execution, and equal cross-kind refs distinct through service, schema, reducer, and Portfolio', async () => {
  const alpha = fixture('global_attention_alpha');
  const beta = fixture('global_attention_beta');
  try {
    const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
    const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
    const fixtures = [alpha, beta];
    alpha.project.id = 'alpha';
    beta.project.id = 'alpha:unassessed:gate:beta';
    const adversarialRefs = new Map([
      [alpha, 'beta:unassessed:gate:condition://x'],
      [beta, 'condition://x'],
    ]);
    const projects = fixtures.map((current, index) => ({
      id: current.project.id,
      name: current.project.label,
      root: current.root,
      odd_type: current.project.publishedProductRef.replace('product://', ''),
      has_ai_workspace: true,
      has_genesis: false,
      build_tenants: ['react_vite'],
      is_active: index === 0,
    }));
    const byProjectId = new Map(fixtures.map((current) => [
      current.project.id,
      current,
    ]));
    const serviceAttentionIdsByProject = new Map();
    for (const current of fixtures) {
      const catalogPath = join(current.root, '.odd', 'assurance-catalog.json');
      const equalCrossKindCatalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
      equalCrossKindCatalog.gates[0].gateRef = adversarialRefs.get(current);
      equalCrossKindCatalog.assets[0].requirementRef =
        equalCrossKindCatalog.gates[0].gateRef;
      writeFileSync(
        catalogPath,
        `${JSON.stringify(equalCrossKindCatalog, null, 2)}\n`,
        'utf8',
      );
    }
    const legacyAlpha = (
      `assurance:${alpha.project.id}:unassessed:gate:${adversarialRefs.get(alpha)}`
    );
    const legacyBeta = (
      `assurance:${beta.project.id}:unassessed:gate:${adversarialRefs.get(beta)}`
    );
    assert.equal(legacyAlpha, legacyBeta);
    assert.notEqual(
      assuranceAttentionIdentity({
        projectId: alpha.project.id,
        executionId: null,
        sourceKind: 'gate',
        sourceIdentity: adversarialRefs.get(alpha),
      }),
      assuranceAttentionIdentity({
        projectId: beta.project.id,
        executionId: null,
        sourceKind: 'gate',
        sourceIdentity: adversarialRefs.get(beta),
      }),
    );
    const absentExecution = assuranceAttentionIdentity({
      projectId: 'sentinel-project',
      executionId: null,
      sourceKind: 'gate',
      sourceIdentity: 'condition://sentinel',
    });
    const literalSentinelExecution = assuranceAttentionIdentity({
      projectId: 'sentinel-project',
      executionId: 'unassessed',
      sourceKind: 'gate',
      sourceIdentity: 'condition://sentinel',
    });
    assert.notEqual(absentExecution, literalSentinelExecution);
    assert.match(absentExecution, /\|execution:none\|/);
    assert.match(literalSentinelExecution, /\|execution:10:unassessed\|/);

    for (const current of fixtures) {
      const revision = observeProjectRevision(current.root);
      const snapshot = current.assurance.snapshot({
        project: current.project,
        revision,
        executionId: null,
      });
      assert.deepEqual(
        snapshot.attentionItems.map((item) => item.attentionId),
        [
          assuranceAttentionIdentity({
            projectId: current.project.id,
            executionId: null,
            sourceKind: 'gate',
            sourceIdentity: adversarialRefs.get(current),
          }),
          assuranceAttentionIdentity({
            projectId: current.project.id,
            executionId: null,
            sourceKind: 'gate',
            sourceIdentity: 'gate://fixture/depth',
          }),
          assuranceAttentionIdentity({
            projectId: current.project.id,
            executionId: null,
            sourceKind: 'gate',
            sourceIdentity: 'gate://fixture/human-review',
          }),
          assuranceAttentionIdentity({
            projectId: current.project.id,
            executionId: null,
            sourceKind: 'asset',
            sourceIdentity: adversarialRefs.get(current),
          }),
        ],
      );
      assert.deepEqual(
        snapshot.attentionItems
          .filter((item) => item.attentionId.endsWith(adversarialRefs.get(current)))
          .map((item) => item.sourceKind),
        ['gate', 'asset'],
      );
      assert.ok(snapshot.attentionItems.every(
        (item) => item.correlationId === `project:${current.project.id}:assurance`,
      ));
      serviceAttentionIdsByProject.set(
        current.project.id,
        new Set(snapshot.attentionItems.map((item) => item.attentionId)),
      );
      const projectFreeIdentity = structuredClone(snapshot);
      projectFreeIdentity.attentionItems[0].attentionId =
        'assurance:unassessed:gate://fixture/tests';
      assert.equal(assuranceSnapshotSchema.safeParse(projectFreeIdentity).success, false);
      const kindFreeIdentity = structuredClone(snapshot);
      kindFreeIdentity.attentionItems[0].attentionId =
        `assurance:${current.project.id}:unassessed:gate://fixture/tests`;
      assert.equal(assuranceSnapshotSchema.safeParse(kindFreeIdentity).success, false);

      const context = update.updateAssuranceAttention(
        stateModule.createAssuranceAttentionState(),
        {
          type: 'assurance/context-changed',
          project: current.project,
          revision,
          executionId: null,
        },
      );
      const admitted = update.updateAssuranceAttention(context.state, {
        type: 'assurance/load-succeeded',
        commandId: context.commands[0].commandId,
        correlationId: context.commands[0].correlationId,
        projectRoot: current.root,
        snapshot,
      }).state;
      assert.equal(admitted.status, 'ready');
      assert.deepEqual(
        admitted.snapshot.attentionItems.map((item) => item.attentionId),
        snapshot.attentionItems.map((item) => item.attentionId),
      );
    }

    const portfolio = loadDeveloperControlPortfolio(projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
      buildObservation(projectRef) {
        return byProjectId.get(projectRef.id).build.snapshot(projectRef);
      },
      assuranceObservation(projectRef, revision, executionId) {
        assert.equal(executionId, null);
        return byProjectId.get(projectRef.id).assurance.snapshot({
          project: projectRef,
          revision,
          executionId,
        });
      },
    });
    const attentionIds = portfolio.rows.flatMap(
      (row) => row.attention.map((item) => item.attentionId),
    );
    const assuranceAttention = portfolio.rows.flatMap(
      (row) => row.attention.filter((item) => ['gate', 'asset'].includes(item.sourceKind)),
    );
    assert.equal(portfolio.rows.length, 2);
    assert.equal(new Set(attentionIds).size, attentionIds.length);
    assert.equal(assuranceAttention.length, 8);
    assert.equal(
      new Set(assuranceAttention.map((item) => item.attentionId)).size,
      assuranceAttention.length,
    );
    for (const row of portfolio.rows) {
      const serviceAttentionIds = serviceAttentionIdsByProject.get(row.project.id);
      assert.ok(row.attention.filter(
        (item) => ['gate', 'asset'].includes(item.sourceKind),
      ).every((item) => serviceAttentionIds.has(item.attentionId)));
    }
  } finally {
    alpha.cleanup();
    beta.cleanup();
  }
});

test('real non-ready catalog snapshots retain Project and execution correlation through reducer admission', async () => {
  const current = fixture('assurance_catalog_reducer');
  try {
    const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
    const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
    rmSync(join(current.root, '.odd', 'assurance-catalog.json'));

    const revision = observeProjectRevision(current.root);
    const projectContext = update.updateAssuranceAttention(
      stateModule.createAssuranceAttentionState(),
      {
        type: 'assurance/context-changed',
        project: current.project,
        revision,
        executionId: null,
      },
    );
    const projectSnapshot = current.assurance.snapshot({
      project: current.project,
      revision,
      executionId: null,
    });
    const admittedProject = update.updateAssuranceAttention(projectContext.state, {
      type: 'assurance/load-succeeded',
      commandId: projectContext.commands[0].commandId,
      correlationId: projectContext.commands[0].correlationId,
      projectRoot: current.root,
      snapshot: projectSnapshot,
    }).state;
    assert.equal(admittedProject.status, 'ready');
    assert.equal(admittedProject.snapshot.attentionItems[0].executionId, null);
    assert.equal(
      admittedProject.snapshot.attentionItems[0].correlationId,
      `project:${current.project.id}:assurance`,
    );

    const result = await run(current, 'none');
    const executionContext = update.updateAssuranceAttention(
      stateModule.createAssuranceAttentionState(),
      {
        type: 'assurance/context-changed',
        project: current.project,
        revision: result.revision,
        executionId: result.execution.executionId,
      },
    );
    const executionSnapshot = assess(current, result);
    const admittedExecution = update.updateAssuranceAttention(executionContext.state, {
      type: 'assurance/load-succeeded',
      commandId: executionContext.commands[0].commandId,
      correlationId: executionContext.commands[0].correlationId,
      projectRoot: current.root,
      snapshot: executionSnapshot,
    }).state;
    assert.equal(admittedExecution.status, 'ready');
    assert.equal(
      admittedExecution.snapshot.attentionItems[0].executionId,
      result.execution.executionId,
    );
    assert.equal(
      admittedExecution.snapshot.attentionItems[0].correlationId,
      result.execution.correlationId,
    );
  } finally {
    current.cleanup();
  }
});

test('symlinked assurance catalog cannot become Project-published authority', () => {
  const current = fixture('assurance_catalog_symlink');
  const externalRoot = mkdtempSync(join(tmpdir(), 'odd-manager-external-assurance-'));
  try {
    const catalogPath = join(current.root, '.odd', 'assurance-catalog.json');
    const externalCatalogPath = join(externalRoot, 'assurance-catalog.json');
    writeFileSync(externalCatalogPath, readFileSync(catalogPath));
    rmSync(catalogPath);
    symlinkSync(externalCatalogPath, catalogPath);

    const revision = observeProjectRevision(current.root);
    const snapshot = current.assurance.snapshot({
      project: current.project,
      revision,
      executionId: null,
    });
    assert.equal(snapshot.catalogAdmission.status, 'error');
    assert.match(snapshot.catalogAdmission.reason, /regular non-symlink file/);
    assert.equal(snapshot.summary.posture, 'unsupported');
    assert.deepEqual(snapshot.gateAssessments, []);
    assert.deepEqual(snapshot.assetDeliveries, []);
    assert.equal(snapshot.evidenceBundleRef, null);
  } finally {
    rmSync(externalRoot, { recursive: true, force: true });
    current.cleanup();
  }
});

test('unsupported foreign catalog cannot select positive rows or reactions', async () => {
  const current = fixture('assurance_foreign_catalog');
  try {
    const catalogPath = join(current.root, '.odd', 'assurance-catalog.json');
    const foreignCatalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
    foreignCatalog.productRef = 'product://foreign';
    writeFileSync(catalogPath, `${JSON.stringify(foreignCatalog, null, 2)}\n`, 'utf8');

    const result = await run(current, 'complete');
    const snapshot = assess(current, result);
    assert.equal(snapshot.catalogAdmission.status, 'unsupported');
    assert.equal(snapshot.catalogAdmission.catalog.productRef, 'product://foreign');
    assert.equal(snapshot.summary.posture, 'unsupported');
    assert.deepEqual(snapshot.gateAssessments, []);
    assert.deepEqual(snapshot.assetDeliveries, []);
    assert.equal(snapshot.evidenceBundleRef, null);
    assert.equal(snapshot.attentionItems.length, 1);
    assert.equal(snapshot.attentionItems[0].sourceKind, 'assurance-catalog');
    assert.deepEqual(snapshot.attentionItems[0].reactionRefs, []);
    assert.equal(snapshot.summary.blockingAttentionCount, 1);
  } finally {
    current.cleanup();
  }
});
