import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { assuranceAttentionIdentity } from '@odd-manager/developer-control-contracts';

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

function project(id) {
  return { id, root: `/workspace/${id}`, label: id, publishedProductRef: `product://${id}` };
}

function revision(seed) {
  return {
    kind: 'commit', revision: seed.repeat(40).slice(0, 40), dirty: false,
    sourceDigest: seed.repeat(40).slice(0, 40), specificationDigest: `sha256:spec-${seed}`,
    observedAt: '2026-07-11T00:00:00.000Z',
  };
}

function fixtureGateAttentionId(projectId = 'project-a') {
  return assuranceAttentionIdentity({
    projectId,
    executionId: 'execution-a',
    sourceKind: 'gate',
    sourceIdentity: 'gate://fixture/tests',
  });
}

function snapshot(projectRef, basis, runRefs = ['run://fixture/a']) {
  const execution = {
    schemaVersion: '1',
    executionId: 'execution-a',
    requestId: 'request-a',
    correlationId: 'correlation-a',
    project: projectRef,
    revision: basis,
    state: 'converged',
    attempt: 1,
    queuePosition: null,
    processRef: 'process://fixture/a',
    worksiteRef: 'worksite://fixture/execution-a',
    runRefs,
    startedAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:01:00.000Z',
    completedAt: '2026-07-11T00:01:00.000Z',
    heartbeatAt: '2026-07-11T00:01:00.000Z',
    resumedAt: null,
    resumedBy: null,
    processOutcome: {
      kind: 'typed_result',
      exitCode: 0,
      signal: null,
      terminalResult: {
        kind: 'converged',
        resultRef: 'result://fixture/a',
        detail: 'fixture converged',
        runRefs,
        sourceRefs: ['result://fixture/a'],
      },
      stdoutRef: 'build-output://execution-a/stdout',
      stderrRef: 'build-output://execution-a/stderr',
      observedAt: '2026-07-11T00:01:00.000Z',
    },
    cancelRequestedAt: null,
    cancelledBy: null,
    assuranceSummaryRef: null,
    sourceRefs: ['build-execution://execution-a'],
  };
  return {
    schemaVersion: '1',
    projectRoot: projectRef.root,
    revision: basis,
    execution,
    catalogAdmission: {
      schemaVersion: '1',
      projectRoot: projectRef.root,
      status: 'ready',
      catalog: {
        schemaVersion: '1',
        catalogRef: 'assurance-catalog://fixture',
        productRef: projectRef.publishedProductRef,
        requirementCatalogRef: 'requirements://fixture',
        assetCatalogRef: 'assets://fixture',
        gates: [{
          gateRef: 'gate://fixture/tests',
          label: 'Tests',
          requirementRef: 'requirement://fixture/tests',
          regime: 'F_D',
          evidenceKey: 'tests',
          positiveDecisionRequirement: null,
          reactionRefs: ['reaction://odd_manager/open-run-inspector'],
          sourceRefs: ['gate://fixture/tests'],
        }],
        assets: [{
          requirementRef: 'requirement://fixture/artifact',
          label: 'Artifact',
          evidenceKey: 'artifact',
          reactionRefs: [],
          sourceRefs: ['asset://fixture/artifact'],
        }],
        sourceRefs: ['assurance-catalog://fixture'],
      },
      sourceRefs: ['catalog'],
      reason: null,
    },
    evidenceBundleRef: 'build-evidence-bundle://execution-a',
    gateAssessments: [{
      gateRef: 'gate://fixture/tests',
      label: 'Tests',
      requirementRef: 'requirement://fixture/tests',
      project: projectRef,
      revision: basis,
      executionId: execution.executionId,
      regime: 'F_D',
      status: 'failed',
      detail: 'The admitted evaluator reported failure.',
      producerRef: 'producer://fixture',
      evidenceDigest: 'sha256:gate-fixture',
      evidenceRefs: ['proof://fixture/tests'],
      decision: null,
      sourceRefs: ['gate://fixture/tests'],
      assessedAt: '2026-07-11T00:01:00.000Z',
    }],
    assetDeliveries: [{
      requirementRef: 'requirement://fixture/artifact',
      label: 'Artifact',
      artifactRef: 'artifact://fixture/output',
      project: projectRef,
      revision: basis,
      executionId: execution.executionId,
      status: 'delivered',
      detail: 'Evidence identity and digest match.',
      producerRef: 'producer://fixture',
      digest: 'sha256:asset-fixture',
      evidenceRefs: ['proof://fixture/artifact'],
      sourceRefs: ['asset://fixture/artifact'],
    }],
    attentionItems: [{
      attentionId: fixtureGateAttentionId(projectRef.id),
      correlationId: execution.correlationId,
      project: projectRef,
      executionId: execution.executionId,
      sourceKind: 'gate',
      sourceRef: 'gate://fixture/tests',
      severity: 'blocking',
      reason: 'Tests: The admitted evaluator reported failure.',
      observedAt: '2026-07-11T00:01:00.000Z',
      reactionRefs: ['reaction://odd_manager/open-run-inspector'],
    }],
    summary: {
      posture: 'failed',
      gateCounts: {
        total: 1, satisfied: 0, failed: 1, missing: 0, stale: 0, waitingHuman: 0,
      },
      assetCounts: {
        total: 1, delivered: 1, failed: 0, missing: 0, stale: 0,
      },
      blockingAttentionCount: 1,
    },
    observedAt: '2026-07-11T00:01:00.000Z',
    sourceRefs: ['assurance://fixture'],
  };
}

function verifiedSnapshot(projectRef, basis) {
  const current = snapshot(projectRef, basis);
  return {
    ...current,
    gateAssessments: [{
      ...current.gateAssessments[0],
      status: 'satisfied',
      detail: 'Evidence identity and digest match.',
    }],
    attentionItems: [],
    summary: {
      ...current.summary,
      posture: 'verified',
      gateCounts: {
        ...current.summary.gateCounts,
        satisfied: 1,
        failed: 0,
      },
      blockingAttentionCount: 0,
    },
  };
}

function nondeterministicVerifiedSnapshot(projectRef, basis) {
  const current = snapshot(projectRef, basis);
  const probabilisticRequirement = {
    kind: 'probabilistic',
    evaluatorRef: 'evaluator://fixture/probabilistic',
    authorityRef: 'authority://fixture/probabilistic',
    basisRefs: [
      'basis://fixture/probabilistic/requirements',
      'basis://fixture/probabilistic/design',
    ],
    requiredFactRefs: [
      'fact://fixture/probabilistic/requirements',
      'fact://fixture/probabilistic/design',
    ],
  };
  const humanRequirement = {
    kind: 'human',
    decisionRef: 'decision://fixture/release-approval',
    requiredOutcome: 'approved',
    authorityRef: 'authority://fixture/human',
    basisRefs: [
      'basis://fixture/human/review',
      'basis://fixture/human/candidate',
    ],
  };
  const gates = [
    {
      gateRef: 'gate://fixture/probabilistic',
      label: 'Probabilistic review',
      requirementRef: 'requirement://fixture/probabilistic',
      regime: 'F_P',
      evidenceKey: 'probabilistic',
      positiveDecisionRequirement: probabilisticRequirement,
      reactionRefs: ['reaction://odd_manager/open-run-inspector'],
      sourceRefs: ['gate://fixture/probabilistic'],
    },
    {
      gateRef: 'gate://fixture/human',
      label: 'Human approval',
      requirementRef: 'requirement://fixture/human',
      regime: 'F_H',
      evidenceKey: 'human',
      positiveDecisionRequirement: humanRequirement,
      reactionRefs: ['reaction://odd_manager/open-run-inspector'],
      sourceRefs: ['gate://fixture/human'],
    },
  ];
  const gateAssessments = [
    {
      ...current.gateAssessments[0],
      gateRef: gates[0].gateRef,
      label: gates[0].label,
      requirementRef: gates[0].requirementRef,
      regime: gates[0].regime,
      status: 'satisfied',
      detail: 'Catalog-admitted probabilistic decision satisfied every required fact.',
      evidenceDigest: 'sha256:probabilistic-fixture',
      evidenceRefs: ['proof://fixture/probabilistic'],
      decision: {
        kind: 'probabilistic',
        outcome: 'satisfied',
        evaluatorRef: probabilisticRequirement.evaluatorRef,
        authorityRef: probabilisticRequirement.authorityRef,
        basisRefs: [...probabilisticRequirement.basisRefs],
        facts: probabilisticRequirement.requiredFactRefs.map((factRef) => ({
          factRef,
          outcome: 'satisfied',
        })),
      },
      sourceRefs: [...gates[0].sourceRefs],
    },
    {
      ...current.gateAssessments[0],
      gateRef: gates[1].gateRef,
      label: gates[1].label,
      requirementRef: gates[1].requirementRef,
      regime: gates[1].regime,
      status: 'satisfied',
      detail: 'Catalog-admitted human decision approved the candidate.',
      evidenceDigest: 'sha256:human-fixture',
      evidenceRefs: ['proof://fixture/human'],
      decision: {
        kind: 'human',
        decisionRef: humanRequirement.decisionRef,
        outcome: humanRequirement.requiredOutcome,
        actorRef: 'actor://fixture/reviewer',
        authorityRef: humanRequirement.authorityRef,
        basisRefs: [...humanRequirement.basisRefs],
      },
      sourceRefs: [...gates[1].sourceRefs],
    },
  ];
  return {
    ...current,
    catalogAdmission: {
      ...current.catalogAdmission,
      catalog: {
        ...current.catalogAdmission.catalog,
        gates,
      },
    },
    gateAssessments,
    attentionItems: [],
    summary: {
      ...current.summary,
      posture: 'verified',
      gateCounts: {
        total: 2,
        satisfied: 2,
        failed: 0,
        missing: 0,
        stale: 0,
        waitingHuman: 0,
      },
      blockingAttentionCount: 0,
    },
  };
}

test('Assurance replay loads one guarded matrix and emits only catalog-admitted forensic reaction', async () => {
  const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const context = update.updateAssuranceAttention(stateModule.createAssuranceAttentionState(), {
    type: 'assurance/context-changed', project: projectRef, revision: basis, executionId: 'execution-a',
  });
  assert.equal(context.commands[0].type, 'assurance.load');
  assert.equal(context.commands[0].executionId, 'execution-a');
  const wrongLoadFailure = update.updateAssuranceAttention(context.state, {
    type: 'assurance/inspector-focus-failed',
    commandId: context.commands[0].commandId,
    correlationId: context.commands[0].correlationId,
    error: 'wrong failure variant',
  });
  assert.equal(wrongLoadFailure.state, context.state);
  assert.equal(wrongLoadFailure.state.pendingCommands.length, 1);
  const repeatedContext = update.updateAssuranceAttention(context.state, {
    type: 'assurance/context-changed', project: projectRef, revision: basis, executionId: 'execution-a',
  });
  assert.deepEqual(repeatedContext.commands, []);
  assert.equal(repeatedContext.state.pendingCommands[0].commandId, context.commands[0].commandId);

  const loaded = update.updateAssuranceAttention(repeatedContext.state, {
    type: 'assurance/load-succeeded',
    commandId: context.commands[0].commandId,
    correlationId: context.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: snapshot(projectRef, basis),
  }).state;
  assert.equal(loaded.status, 'ready');
  assert.equal(loaded.selectedAssessmentRef, 'gate://fixture/tests');
  assert.equal(loaded.selectedAttentionId, fixtureGateAttentionId());

  const blocked = update.updateAssuranceAttention(loaded, {
    type: 'attention/reaction-requested',
    attentionId: fixtureGateAttentionId(),
    reactionRef: 'reaction://odd_manager/approve',
  });
  assert.deepEqual(blocked.commands, []);

  const inspect = update.updateAssuranceAttention(loaded, {
    type: 'attention/reaction-requested',
    attentionId: fixtureGateAttentionId(),
    reactionRef: 'reaction://odd_manager/open-run-inspector',
  });
  assert.equal(inspect.commands[0].type, 'assurance.open-run-inspector');
  assert.equal(inspect.commands[0].executionId, 'execution-a');
  assert.deepEqual(inspect.commands[0].focusBasis, {
    kind: 'attention-reaction',
    attentionId: fixtureGateAttentionId(),
    reactionRef: 'reaction://odd_manager/open-run-inspector',
    sourceRef: 'gate://fixture/tests',
  });
  assert.equal(inspect.state.snapshot.attentionItems.length, 1);
  const wrongInspectorFailure = update.updateAssuranceAttention(inspect.state, {
    type: 'assurance/load-failed',
    commandId: inspect.commands[0].commandId,
    correlationId: inspect.commands[0].correlationId,
    error: 'wrong failure variant',
  });
  assert.equal(wrongInspectorFailure.state, inspect.state);
  assert.equal(wrongInspectorFailure.state.pendingCommands.length, 1);
  const consumed = update.updateAssuranceAttention(wrongInspectorFailure.state, {
    type: 'assurance/inspector-focus-resolved', commandId: inspect.commands[0].commandId,
    correlationId: inspect.commands[0].correlationId,
    projectRoot: projectRef.root,
    executionId: 'execution-a',
    runRef: 'run://fixture/a',
    revision: basis.revision,
    sourceRef: 'gate://fixture/tests',
  }).state;
  assert.equal(consumed.pendingCommands.length, 0);
  assert.equal(consumed.snapshot.attentionItems.length, 1);

  const footerInspect = update.updateAssuranceAttention(consumed, {
    type: 'assurance/run-inspector-requested',
  });
  assert.equal(footerInspect.commands[0].executionId, 'execution-a');
  assert.deepEqual(footerInspect.commands[0].focusBasis, {
    kind: 'execution-evidence',
    sourceRef: 'build-evidence-bundle://execution-a',
  });
  const failedInspect = update.updateAssuranceAttention(footerInspect.state, {
    type: 'assurance/inspector-focus-failed',
    commandId: footerInspect.commands[0].commandId,
    correlationId: footerInspect.commands[0].correlationId,
    error: 'forensic focus failed',
  }).state;
  assert.equal(failedInspect.pendingCommands.length, 0);
  assert.equal(failedInspect.error, 'forensic focus failed');
});

test('Assurance replay rejects late or semantically incoherent results', async () => {
  const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
  const projectA = project('project-a');
  const projectB = project('project-b');
  const basisA = revision('a');
  const basisB = revision('b');
  const contextA = update.updateAssuranceAttention(stateModule.createAssuranceAttentionState(), {
    type: 'assurance/context-changed', project: projectA, revision: basisA, executionId: null,
  });
  const sameRootDifferentIdentity = update.updateAssuranceAttention({
    ...stateModule.createAssuranceAttentionState(),
    project: projectA,
    basisRevision: basisA,
    executionId: 'execution-a',
    snapshot: snapshot(projectA, basisA),
  }, {
    type: 'assurance/context-changed',
    project: { ...projectA, id: 'project-a-replaced', label: 'replacement' },
    revision: basisA,
    executionId: 'execution-a',
  });
  assert.equal(sameRootDifferentIdentity.state.snapshot, null);
  assert.equal(sameRootDifferentIdentity.commands[0].type, 'assurance.load');

  const contextB = update.updateAssuranceAttention(contextA.state, {
    type: 'assurance/context-changed', project: projectB, revision: basisB, executionId: 'execution-a',
  });
  const late = update.updateAssuranceAttention(contextB.state, {
    type: 'assurance/load-succeeded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
    projectRoot: projectA.root,
    snapshot: snapshot(projectA, basisA),
  });
  assert.equal(late.state.project.root, projectB.root);
  assert.equal(late.state.snapshot, null);

  const current = snapshot(projectB, basisB);
  const otherProject = project('project-other');
  const satisfiedWithoutEvidence = {
    ...current,
    gateAssessments: [{
      ...current.gateAssessments[0],
      status: 'satisfied',
      producerRef: null,
      evidenceDigest: null,
      evidenceRefs: [],
    }],
    attentionItems: [],
    summary: {
      ...current.summary,
      posture: 'verified',
      gateCounts: {
        ...current.summary.gateCounts,
        satisfied: 1,
        failed: 0,
      },
      blockingAttentionCount: 0,
    },
  };
  const malformed = [
    ['ready catalog admission', {
      ...current,
      catalogAdmission: { ...current.catalogAdmission, catalog: null },
    }],
    ['catalog gate membership', {
      ...current,
      gateAssessments: [{
        ...current.gateAssessments[0],
        gateRef: 'gate://forged',
      }],
    }],
    ['response revision', { ...current, revision: revision('c') }],
    ['execution Project', {
      ...current,
      execution: { ...current.execution, project: otherProject },
    }],
    ['assessment Project', {
      ...current,
      gateAssessments: [{ ...current.gateAssessments[0], project: otherProject }],
    }],
    ['asset Project', {
      ...current,
      assetDeliveries: [{ ...current.assetDeliveries[0], project: otherProject }],
    }],
    ['attention Project', {
      ...current,
      attentionItems: [{ ...current.attentionItems[0], project: otherProject }],
    }],
    ['Project-free attention identity', {
      ...current,
      attentionItems: [{
        ...current.attentionItems[0],
        attentionId: 'assurance:execution-a:gate://fixture/tests',
      }],
    }],
    ['kind-free attention identity', {
      ...current,
      attentionItems: [{
        ...current.attentionItems[0],
        attentionId: 'assurance:project-b:execution-a:gate://fixture/tests',
      }],
    }],
    ['omitted derived attention', {
      ...current,
      attentionItems: [],
      summary: { ...current.summary, blockingAttentionCount: 0 },
    }],
    ['forged attention relation', {
      ...current,
      attentionItems: [{
        ...current.attentionItems[0],
        correlationId: 'correlation-forged',
        sourceRef: 'source://forged',
      }],
    }],
    ['duplicate gate assessment identity', {
      ...current,
      catalogAdmission: {
        ...current.catalogAdmission,
        catalog: {
          ...current.catalogAdmission.catalog,
          gates: [
            ...current.catalogAdmission.catalog.gates,
            {
              ...current.catalogAdmission.catalog.gates[0],
              gateRef: 'gate://fixture/second',
              requirementRef: 'requirement://fixture/second',
              evidenceKey: 'second',
            },
          ],
        },
      },
      gateAssessments: [
        current.gateAssessments[0],
        current.gateAssessments[0],
      ],
    }],
    ['duplicate asset delivery identity', {
      ...current,
      catalogAdmission: {
        ...current.catalogAdmission,
        catalog: {
          ...current.catalogAdmission.catalog,
          assets: [
            ...current.catalogAdmission.catalog.assets,
            {
              ...current.catalogAdmission.catalog.assets[0],
              requirementRef: 'requirement://fixture/second-asset',
              evidenceKey: 'second-asset',
            },
          ],
        },
      },
      assetDeliveries: [
        current.assetDeliveries[0],
        current.assetDeliveries[0],
      ],
    }],
    ['execution revision', {
      ...current,
      execution: { ...current.execution, revision: revision('c') },
    }],
    ['assessment revision', {
      ...current,
      gateAssessments: [{ ...current.gateAssessments[0], revision: revision('c') }],
    }],
    ['assessment execution', {
      ...current,
      gateAssessments: [{ ...current.gateAssessments[0], executionId: 'execution-other' }],
    }],
    ['satisfied gate evidence', satisfiedWithoutEvidence],
    ['delivered asset evidence', {
      ...current,
      assetDeliveries: [{
        ...current.assetDeliveries[0],
        artifactRef: null,
        producerRef: null,
        digest: null,
        evidenceRefs: [],
      }],
    }],
    ['summary totals', {
      ...current,
      summary: {
        ...current.summary,
        gateCounts: { ...current.summary.gateCounts, total: 2 },
      },
    }],
    ['summary posture', {
      ...current,
      summary: { ...current.summary, posture: 'verified' },
    }],
  ];
  for (const [label, candidate] of malformed) {
    const rejected = update.updateAssuranceAttention(contextB.state, {
      type: 'assurance/load-succeeded',
      commandId: contextB.commands[0].commandId,
      correlationId: contextB.commands[0].correlationId,
      projectRoot: projectB.root,
      snapshot: candidate,
    });
    assert.notEqual(rejected.state, contextB.state, `${label} must become explicit failure`);
    assert.equal(rejected.state.snapshot, null, `${label} must not enter State`);
    assert.equal(rejected.state.status, 'error', `${label} must become error`);
    assert.equal(rejected.state.pendingCommands.length, 0, `${label} must retire its command`);
    assert.match(rejected.state.error, /failed semantic admission/, label);
  }

  const admitted = update.updateAssuranceAttention(contextB.state, {
    type: 'assurance/load-succeeded',
    commandId: contextB.commands[0].commandId,
    correlationId: contextB.commands[0].correlationId,
    projectRoot: projectB.root,
    snapshot: current,
  }).state;
  assert.equal(admitted.status, 'ready');
  assert.equal(admitted.snapshot, current);
});

test('Assurance replay independently rejects satisfied F_P and F_H decisions outside catalog authority', async () => {
  const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const context = update.updateAssuranceAttention(stateModule.createAssuranceAttentionState(), {
    type: 'assurance/context-changed',
    project: projectRef,
    revision: basis,
    executionId: 'execution-a',
  });
  const current = nondeterministicVerifiedSnapshot(projectRef, basis);
  const mutations = [
    ['foreign F_P authority', (candidate) => {
      candidate.gateAssessments[0].decision.authorityRef = 'authority://foreign';
    }],
    ['foreign F_P basis', (candidate) => {
      candidate.gateAssessments[0].decision.basisRefs[1] = 'basis://foreign';
    }],
    ['reordered F_P basis', (candidate) => {
      candidate.gateAssessments[0].decision.basisRefs.reverse();
    }],
    ['foreign F_P evaluator', (candidate) => {
      candidate.gateAssessments[0].decision.evaluatorRef = 'evaluator://foreign';
    }],
    ['foreign F_P fact identity', (candidate) => {
      candidate.gateAssessments[0].decision.facts[1].factRef = 'fact://foreign';
    }],
    ['non-positive F_P fact', (candidate) => {
      candidate.gateAssessments[0].decision.facts[1].outcome = 'not_satisfied';
    }],
    ['non-positive F_P decision', (candidate) => {
      candidate.gateAssessments[0].decision.outcome = 'inconclusive';
    }],
    ['foreign F_H authority', (candidate) => {
      candidate.gateAssessments[1].decision.authorityRef = 'authority://foreign';
    }],
    ['foreign F_H basis', (candidate) => {
      candidate.gateAssessments[1].decision.basisRefs[1] = 'basis://foreign';
    }],
    ['reordered F_H basis', (candidate) => {
      candidate.gateAssessments[1].decision.basisRefs.reverse();
    }],
    ['foreign F_H decision', (candidate) => {
      candidate.gateAssessments[1].decision.decisionRef = 'decision://foreign';
    }],
    ['non-positive F_H decision', (candidate) => {
      candidate.gateAssessments[1].decision.outcome = 'rejected';
    }],
    ['unattributed F_H decision', (candidate) => {
      candidate.gateAssessments[1].decision.actorRef = '';
    }],
    ['wrong decision kind', (candidate) => {
      candidate.gateAssessments[0].decision = {
        ...candidate.gateAssessments[1].decision,
      };
    }],
  ];

  for (const [label, mutate] of mutations) {
    const candidate = structuredClone(current);
    mutate(candidate);
    const rejected = update.updateAssuranceAttention(context.state, {
      type: 'assurance/load-succeeded',
      commandId: context.commands[0].commandId,
      correlationId: context.commands[0].correlationId,
      projectRoot: projectRef.root,
      snapshot: candidate,
    }).state;
    assert.equal(rejected.status, 'error', label);
    assert.equal(rejected.snapshot, null, label);
    assert.equal(rejected.pendingCommands.length, 0, label);
    assert.match(rejected.error, /failed semantic admission/, label);
  }

  const admitted = update.updateAssuranceAttention(context.state, {
    type: 'assurance/load-succeeded',
    commandId: context.commands[0].commandId,
    correlationId: context.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: current,
  }).state;
  assert.equal(admitted.status, 'ready');
  assert.equal(admitted.snapshot, current);
});

test('Assurance replay coalesces a refresh requested during an in-flight load', async () => {
  const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const context = update.updateAssuranceAttention(stateModule.createAssuranceAttentionState(), {
    type: 'assurance/context-changed', project: projectRef, revision: basis, executionId: 'execution-a',
  });

  const queued = update.updateAssuranceAttention(context.state, {
    type: 'assurance/refresh-requested',
  });
  assert.deepEqual(queued.commands, []);
  assert.equal(queued.state.refreshQueued, true);

  const interim = update.updateAssuranceAttention(queued.state, {
    type: 'assurance/load-succeeded',
    commandId: context.commands[0].commandId,
    correlationId: context.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: snapshot(projectRef, basis, []),
  });
  assert.equal(interim.commands.length, 1);
  assert.equal(interim.commands[0].type, 'assurance.load');
  assert.equal(interim.state.refreshQueued, false);
  assert.equal(interim.state.snapshot.execution.runRefs.length, 0);

  const current = update.updateAssuranceAttention(interim.state, {
    type: 'assurance/load-succeeded',
    commandId: interim.commands[0].commandId,
    correlationId: interim.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: snapshot(projectRef, basis),
  });
  assert.equal(current.commands.length, 0);
  assert.deepEqual(current.state.snapshot.execution.runRefs, ['run://fixture/a']);

  const inspect = update.updateAssuranceAttention(current.state, {
    type: 'attention/reaction-requested',
    attentionId: fixtureGateAttentionId(),
    reactionRef: 'reaction://odd_manager/open-run-inspector',
  });
  assert.equal(inspect.commands[0].executionId, 'execution-a');
  assert.equal(inspect.commands[0].focusBasis.kind, 'attention-reaction');
});

test('Assurance source-drift refresh retires the command and clears the prior verified snapshot', async () => {
  const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const context = update.updateAssuranceAttention(stateModule.createAssuranceAttentionState(), {
    type: 'assurance/context-changed',
    project: projectRef,
    revision: basis,
    executionId: 'execution-a',
  });
  const loaded = update.updateAssuranceAttention(context.state, {
    type: 'assurance/load-succeeded',
    commandId: context.commands[0].commandId,
    correlationId: context.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: verifiedSnapshot(projectRef, basis),
  }).state;
  assert.equal(loaded.status, 'ready');
  assert.equal(loaded.snapshot.summary.posture, 'verified');

  const refresh = update.updateAssuranceAttention(loaded, {
    type: 'assurance/refresh-requested',
  });
  assert.equal(refresh.commands.length, 1);
  const stale = update.updateAssuranceAttention(refresh.state, {
    type: 'assurance/command-failed',
    commandId: refresh.commands[0].commandId,
    correlationId: refresh.commands[0].correlationId,
    failureKind: 'stale_basis',
    error: 'Assurance response ProjectRevision differs from the pending load basis.',
  });
  assert.equal(stale.state.status, 'stale');
  assert.equal(stale.state.snapshot, null);
  assert.equal(stale.state.pendingCommands.length, 0);
  assert.equal(stale.state.refreshQueued, false);
  assert.equal(stale.state.selectedAssessmentRef, null);
  assert.equal(stale.state.selectedAttentionId, null);
  assert.match(stale.state.error, /ProjectRevision differs/);
  assert.deepEqual(stale.commands, []);
});
