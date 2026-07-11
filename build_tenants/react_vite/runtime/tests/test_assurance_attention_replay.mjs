import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, '../../src');

async function loadTypeScriptModule(relativePath) {
  const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
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

function snapshot(projectRef, basis) {
  const execution = {
    executionId: 'execution-a',
    correlationId: 'correlation-a',
    runRefs: ['run://fixture/a'],
  };
  return {
    schemaVersion: '1',
    projectRoot: projectRef.root,
    revision: basis,
    execution,
    catalogAdmission: { status: 'ready', catalog: {}, sourceRefs: ['catalog'], reason: null },
    evidenceBundleRef: 'build-evidence-bundle://execution-a',
    gateAssessments: [{
      gateRef: 'gate://fixture/tests',
      label: 'Tests',
      requirementRef: 'requirement://fixture/tests',
      status: 'failed',
    }],
    assetDeliveries: [],
    attentionItems: [{
      attentionId: 'attention-a',
      sourceRef: 'proof://fixture/tests',
      reactionRefs: ['reaction://odd_manager/open-run-inspector'],
    }],
    summary: { posture: 'failed' },
    observedAt: '2026-07-11T00:01:00.000Z',
    sourceRefs: ['assurance://fixture'],
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
  const repeatedContext = update.updateAssuranceAttention(context.state, {
    type: 'assurance/context-changed', project: projectRef, revision: basis, executionId: 'execution-a',
  });
  assert.deepEqual(repeatedContext.commands, []);
  assert.equal(repeatedContext.state.pendingCommands[0].commandId, context.commands[0].commandId);

  const loaded = update.updateAssuranceAttention(repeatedContext.state, {
    type: 'assurance/load-succeeded',
    commandId: context.commands[0].commandId,
    projectRoot: projectRef.root,
    snapshot: snapshot(projectRef, basis),
  }).state;
  assert.equal(loaded.status, 'ready');
  assert.equal(loaded.selectedAssessmentRef, 'gate://fixture/tests');
  assert.equal(loaded.selectedAttentionId, 'attention-a');

  const blocked = update.updateAssuranceAttention(loaded, {
    type: 'attention/reaction-requested',
    attentionId: 'attention-a',
    reactionRef: 'reaction://odd_manager/approve',
  });
  assert.deepEqual(blocked.commands, []);

  const inspect = update.updateAssuranceAttention(loaded, {
    type: 'attention/reaction-requested',
    attentionId: 'attention-a',
    reactionRef: 'reaction://odd_manager/open-run-inspector',
  });
  assert.equal(inspect.commands[0].type, 'assurance.open-run-inspector');
  assert.equal(inspect.commands[0].executionId, 'execution-a');
  assert.equal(inspect.commands[0].runRef, 'run://fixture/a');
  assert.equal(inspect.commands[0].revision, basis.revision);
  assert.equal(inspect.commands[0].sourceRef, 'proof://fixture/tests');
  assert.equal(inspect.state.snapshot.attentionItems.length, 1);
  const consumed = update.updateAssuranceAttention(inspect.state, {
    type: 'assurance/supporting-command-consumed', commandId: inspect.commands[0].commandId,
  }).state;
  assert.equal(consumed.pendingCommands.length, 0);
  assert.equal(consumed.snapshot.attentionItems.length, 1);
});

test('Assurance replay rejects late Project and stale revision results', async () => {
  const update = await loadTypeScriptModule('capabilities/assurance-attention/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/assurance-attention/state.ts');
  const projectA = project('project-a');
  const projectB = project('project-b');
  const basisA = revision('a');
  const basisB = revision('b');
  const contextA = update.updateAssuranceAttention(stateModule.createAssuranceAttentionState(), {
    type: 'assurance/context-changed', project: projectA, revision: basisA, executionId: null,
  });
  const contextB = update.updateAssuranceAttention(contextA.state, {
    type: 'assurance/context-changed', project: projectB, revision: basisB, executionId: null,
  });
  const late = update.updateAssuranceAttention(contextB.state, {
    type: 'assurance/load-succeeded',
    commandId: contextA.commands[0].commandId,
    projectRoot: projectA.root,
    snapshot: snapshot(projectA, basisA),
  });
  assert.equal(late.state.project.root, projectB.root);
  assert.equal(late.state.snapshot, null);

  const stale = update.updateAssuranceAttention(contextB.state, {
    type: 'assurance/load-succeeded',
    commandId: contextB.commands[0].commandId,
    projectRoot: projectB.root,
    snapshot: snapshot(projectB, revision('c')),
  }).state;
  assert.equal(stale.status, 'stale');
  assert.match(stale.error, /stale/);
});
