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
    kind: 'commit',
    revision: seed.repeat(40).slice(0, 40),
    dirty: false,
    sourceDigest: seed.repeat(40).slice(0, 40),
    specificationDigest: `sha256:spec-${seed}`,
    observedAt: '2026-07-11T00:00:00.000Z',
  };
}

function descriptor(id) {
  return {
    schemaVersion: '1',
    descriptorRef: `build-carrier-descriptor://${id}/software-build`,
    productRef: `product://${id}`,
    productVersion: '1.0.0',
    carrierKind: 'graph_function',
    carrierRef: `graph-function://${id}/software-build`,
    startupConfigRef: `startup://${id}/software-build`,
    publicStartTarget: `start://${id}/software-build`,
    inputSchemaRef: `schema://${id}/build-input`,
    worksiteProvisionerRef: 'worksite-provisioner://odd_manager/project-snapshot/v1',
    executionAdapterRef: 'execution-adapter://odd_manager/fixture/v1',
    supportedCommands: ['submit', 'attach', 'cancel'],
    requirementCatalogRefs: [`requirements://${id}`],
    expectedAssetCatalogRefs: [`assets://${id}`],
    proofRefs: [`proof://${id}`],
  };
}

function requestRecord(id, projectRef, basis) {
  return {
    schemaVersion: '1',
    requestId: `request-${id}`,
    correlationId: `correlation-${id}`,
    project: projectRef,
    revision: basis,
    descriptorRef: `build-carrier-descriptor://${projectRef.id}/software-build`,
    carrierRef: `graph-function://${projectRef.id}/software-build`,
    startupConfigRef: `startup://${projectRef.id}/software-build`,
    publicStartTarget: `start://${projectRef.id}/software-build`,
    inputs: { label: id },
    requestedBy: 'actor://operator/test',
    requestedAt: '2026-07-11T00:01:00.000Z',
    resourcePolicyRef: 'resource-policy://odd_manager/build/default-v1',
    authorityRefs: [`requirements://${projectRef.id}`],
  };
}

function executionRecord(id, projectRef, basis, state = 'running') {
  return {
    schemaVersion: '1',
    executionId: `execution-${id}`,
    requestId: `request-${id}`,
    correlationId: `correlation-${id}`,
    project: projectRef,
    revision: basis,
    state,
    attempt: 1,
    queuePosition: state === 'queued' ? 0 : null,
    processRef: state === 'running' ? 'process://local/100' : null,
    worksiteRef: `worksite://odd_manager/execution-${id}`,
    runRefs: [],
    startedAt: state === 'queued' ? null : '2026-07-11T00:01:01.000Z',
    updatedAt: '2026-07-11T00:01:02.000Z',
    completedAt: null,
    heartbeatAt: state === 'queued' ? null : '2026-07-11T00:01:02.000Z',
    processOutcome: null,
    cancelRequestedAt: null,
    cancelledBy: null,
    assuranceSummaryRef: null,
    sourceRefs: [`build-execution://execution-${id}`],
  };
}

function snapshot(projectRef, basis, executions = []) {
  return {
    schemaVersion: '1',
    projectRoot: projectRef.root,
    revision: basis,
    descriptorAdmission: {
      schemaVersion: '1',
      projectRoot: projectRef.root,
      status: 'ready',
      descriptor: descriptor(projectRef.id),
      reason: null,
      sourceRefs: [`.odd/build-carrier.json`],
    },
    requests: executions.map((entry) => requestRecord(entry.executionId.slice('execution-'.length), projectRef, basis)),
    executions,
    scheduler: { maxConcurrent: 2, maxQueued: 10, runningCount: executions.length, queuedCount: 0, availableSlots: Math.max(0, 2 - executions.length) },
    observedAt: '2026-07-11T00:01:02.000Z',
    sourceRefs: ['supervisor://odd_manager/build-control/v1'],
  };
}

test('Build Msg replay carries one typed submit through selection and output attachment', async () => {
  const update = await loadTypeScriptModule('capabilities/build-control/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-control/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const context = update.updateBuildControl(stateModule.createBuildControlState(), {
    type: 'build/context-changed', project: projectRef, revision: basis,
  });
  assert.deepEqual(context.commands.map((entry) => entry.type), ['build.load']);
  const ready = update.updateBuildControl(context.state, {
    type: 'build/snapshot-loaded',
    commandId: context.commands[0].commandId,
    projectRoot: projectRef.root,
    snapshot: snapshot(projectRef, basis),
  }).state;
  const requested = update.replayBuildControlMessages(ready, [
    { type: 'build/input-edited', value: '{"durationMs":100,"outcome":"converged","label":"a"}' },
    { type: 'build/submit-requested', actorRef: 'actor://operator/test' },
  ]);
  assert.equal(requested.commands.length, 1);
  assert.equal(requested.commands[0].type, 'build.submit');
  assert.deepEqual(requested.commands[0].inputs, { durationMs: 100, outcome: 'converged', label: 'a' });
  assert.equal('executable' in requested.commands[0], false);

  const execution = executionRecord('a', projectRef, basis);
  const request = requestRecord('a', projectRef, basis);
  const submitted = update.updateBuildControl(requested.state, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    projectRoot: projectRef.root,
    result: { request, execution, snapshot: snapshot(projectRef, basis, [execution]) },
  });
  assert.equal(submitted.state.selectedExecutionId, execution.executionId);
  assert.equal(submitted.commands[0].type, 'build.attach');
  assert.equal(submitted.commands[0].executionId, execution.executionId);

  const attached = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    projectRoot: projectRef.root,
    attached: {
      schemaVersion: '1',
      execution,
      output: {
        schemaVersion: '1', executionId: execution.executionId,
        stdout: 'running\n', stderr: '', stdoutTruncated: false, stderrTruncated: false,
        observedAt: '2026-07-11T00:01:03.000Z', sourceRefs: ['stdout', 'stderr'],
      },
      sourceRefs: [`build-execution://${execution.executionId}`],
    },
  }).state;
  assert.equal(attached.attached.output.stdout, 'running\n');

  const cancel = update.updateBuildControl(attached, {
    type: 'build/cancel-requested', actorRef: 'actor://operator/test',
  });
  assert.equal(cancel.commands[0].type, 'build.cancel');
  assert.equal(cancel.commands[0].executionId, execution.executionId);
});

test('Build replay rejects late cross-Project results and blocks stale-basis submission', async () => {
  const update = await loadTypeScriptModule('capabilities/build-control/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-control/state.ts');
  const projectA = project('project-a');
  const projectB = project('project-b');
  const basisA = revision('a');
  const basisB = revision('b');
  const contextA = update.updateBuildControl(stateModule.createBuildControlState(), {
    type: 'build/context-changed', project: projectA, revision: basisA,
  });
  const contextB = update.updateBuildControl(contextA.state, {
    type: 'build/context-changed', project: projectB, revision: basisB,
  });
  const late = update.updateBuildControl(contextB.state, {
    type: 'build/snapshot-loaded',
    commandId: contextA.commands[0].commandId,
    projectRoot: projectA.root,
    snapshot: snapshot(projectA, basisA),
  });
  assert.equal(late.state.project.root, projectB.root);
  assert.equal(late.state.snapshot, null);

  const stale = update.updateBuildControl(contextB.state, {
    type: 'build/snapshot-loaded',
    commandId: contextB.commands[0].commandId,
    projectRoot: projectB.root,
    snapshot: snapshot(projectB, revision('c')),
  }).state;
  assert.equal(stale.status, 'stale');
  assert.match(stale.error, /Revision changed/);
  const blocked = update.updateBuildControl(stale, {
    type: 'build/submit-requested', actorRef: 'actor://operator/test',
  });
  assert.deepEqual(blocked.commands, []);
});

test('Build replay reconnects only a selected stale or disconnected execution identity', async () => {
  const update = await loadTypeScriptModule('capabilities/build-control/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-control/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const disconnected = {
    ...executionRecord('resume', projectRef, basis, 'disconnected'),
    processRef: 'process://external/100',
  };
  const ready = {
    ...stateModule.createBuildControlState(),
    status: 'ready',
    project: projectRef,
    basisRevision: basis,
    snapshot: snapshot(projectRef, basis, [disconnected]),
    selectedExecutionId: disconnected.executionId,
  };
  const request = update.updateBuildControl(ready, {
    type: 'build/resume-requested', actorRef: 'actor://operator/test',
  });
  assert.equal(request.state.status, 'resuming');
  assert.equal(request.commands[0].type, 'build.resume');
  assert.equal(request.commands[0].executionId, disconnected.executionId);

  const running = {
    ...disconnected,
    state: 'running',
    heartbeatAt: '2026-07-11T00:02:00.000Z',
    updatedAt: '2026-07-11T00:02:00.000Z',
  };
  const resumed = update.updateBuildControl(request.state, {
    type: 'build/resumed',
    commandId: request.commands[0].commandId,
    projectRoot: projectRef.root,
    execution: running,
  });
  assert.equal(resumed.state.snapshot.executions[0].executionId, disconnected.executionId);
  assert.equal(resumed.state.snapshot.executions[0].state, 'running');
  assert.equal(resumed.commands[0].type, 'build.attach');
});
