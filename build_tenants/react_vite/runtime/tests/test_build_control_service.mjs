import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  FIXTURE_EXECUTION_ADAPTER_REF,
  loadBuildCarrierDescriptor,
  PROJECT_SNAPSHOT_PROVISIONER_REF,
} from '../../src/server/build-carrier-descriptor-service.mjs';
import {
  BuildControlError,
  createBuildControlService,
} from '../../src/server/build-control-service.mjs';
import { provisionProjectSnapshot } from '../../src/server/build-worksite-provisioner.mjs';
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

function createProject(productId) {
  const root = mkdtempSync(join(tmpdir(), `odd-manager-${productId}-`));
  mkdirSync(join(root, '.ai-workspace'), { recursive: true });
  mkdirSync(join(root, '.odd'), { recursive: true });
  mkdirSync(join(root, 'specification'), { recursive: true });
  writeFileSync(join(root, 'specification', 'PRODUCT.md'), `# ${productId} Product\n`, 'utf8');
  writeFileSync(join(root, 'source.txt'), `${productId} source\n`, 'utf8');
  writeFileSync(join(root, '.odd', 'build-carrier.json'), `${JSON.stringify(descriptor(productId), null, 2)}\n`, 'utf8');
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', [
    '-C', root,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
  return {
    root,
    project: {
      id: `${productId}-project`,
      root,
      label: productId,
      publishedProductRef: `product://${productId}`,
    },
    cleanup() { rmSync(root, { recursive: true, force: true }); },
  };
}

function createService(options = {}) {
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-build-state-'));
  let sequence = 0;
  const service = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    maxConcurrent: options.maxConcurrent ?? 2,
    maxQueued: options.maxQueued ?? 10,
    idFactory: (kind) => `${kind}-${++sequence}`,
  });
  return {
    managerStateRoot,
    service,
    cleanup() {
      service.shutdown();
      rmSync(managerStateRoot, { recursive: true, force: true });
    },
  };
}

function submit(service, current, inputs) {
  return service.submit({
    project: current.project,
    revision: observeProjectRevision(current.root),
    inputs,
    requestedBy: 'actor://operator/test',
  });
}

test('descriptor admission fails closed for missing, invalid, mismatched, and uninstalled carriers', () => {
  const current = createProject('fixture_admission');
  try {
    const refs = {
      provisionerRefs: new Set([PROJECT_SNAPSHOT_PROVISIONER_REF]),
      adapterRefs: new Set([FIXTURE_EXECUTION_ADAPTER_REF]),
    };
    assert.equal(loadBuildCarrierDescriptor(current.project, refs).status, 'ready');

    const mismatched = loadBuildCarrierDescriptor({
      ...current.project,
      publishedProductRef: 'product://other',
    }, refs);
    assert.equal(mismatched.status, 'unsupported');
    assert.match(mismatched.reason, /does not match/);

    const uninstalled = loadBuildCarrierDescriptor(current.project, {
      provisionerRefs: refs.provisionerRefs,
      adapterRefs: new Set(),
    });
    assert.equal(uninstalled.status, 'unsupported');
    assert.match(uninstalled.reason, /Execution adapter is not installed/);

    rmSync(join(current.root, '.odd', 'build-carrier.json'));
    const missing = loadBuildCarrierDescriptor(current.project, refs);
    assert.equal(missing.status, 'unavailable');
    assert.match(missing.reason, /.odd\/build-carrier.json/);
  } finally {
    current.cleanup();
  }
});

test('one admitted build preserves revision, process, typed result, output, and absent assurance', async () => {
  const current = createProject('fixture_single');
  const fixture = createService({ maxConcurrent: 1 });
  try {
    const submitted = submit(fixture.service, current, {
      durationMs: 150,
      outcome: 'converged',
      label: 'single',
    });
    assert.equal(submitted.execution.state, 'queued');
    const terminal = await fixture.service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === submitted.execution.executionId)?.state === 'converged'
        ? store.executions.find((entry) => entry.executionId === submitted.execution.executionId)
        : null
    ));
    assert.equal(terminal.processOutcome.kind, 'typed_result');
    assert.equal(terminal.processOutcome.exitCode, 0);
    assert.equal(terminal.processOutcome.terminalResult.kind, 'converged');
    assert.deepEqual(terminal.runRefs, ['run://fixture/single']);
    assert.equal(terminal.assuranceSummaryRef, null);
    assert.match(terminal.processRef, /^process:\/\/local\/\d+$/);

    const attached = fixture.service.attach({
      projectRoot: current.root,
      executionId: terminal.executionId,
      actorRef: 'actor://operator/test',
    }, current.project);
    assert.match(attached.output.stdout, /fixture build started/);
    assert.match(attached.output.stdout, /fixture build converged/);
    assert.equal(attached.output.stderr, '');

    const snapshot = fixture.service.snapshot(current.project);
    assert.equal(snapshot.executions[0].executionId, terminal.executionId);
    assert.equal(snapshot.scheduler.runningCount, 0);
    assert.equal(snapshot.descriptorAdmission.status, 'ready');
    const worksitePath = join(
      fixture.managerStateRoot,
      '.ai-workspace', 'runtime', 'developer-control', 'build-worksites',
      terminal.executionId, 'workspace', 'source.txt',
    );
    assert.equal(readFileSync(worksitePath, 'utf8'), 'fixture_single source\n');
  } finally {
    fixture.cleanup();
    current.cleanup();
  }
});

test('cancellation is attributable and does not manufacture a terminal carrier result', async () => {
  const current = createProject('fixture_cancel');
  const fixture = createService({ maxConcurrent: 1 });
  try {
    const submitted = submit(fixture.service, current, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'cancel-me',
    });
    await fixture.service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === submitted.execution.executionId)?.state === 'running'
    ));
    fixture.service.cancel({
      projectRoot: current.root,
      executionId: submitted.execution.executionId,
      actorRef: 'actor://operator/canceller',
    }, current.project);
    const cancelled = await fixture.service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === submitted.execution.executionId);
      return execution?.state === 'cancelled' ? execution : null;
    });
    assert.equal(cancelled.cancelledBy, 'actor://operator/canceller');
    assert.equal(cancelled.processOutcome.kind, 'cancelled');
    assert.equal(cancelled.processOutcome.terminalResult, null);
    assert.equal(cancelled.assuranceSummaryRef, null);
  } finally {
    fixture.cleanup();
    current.cleanup();
  }
});

test('two Project builds consume separate concurrent slots and preserve isolated outcomes', async () => {
  const alpha = createProject('fixture_alpha');
  const beta = createProject('fixture_beta');
  const fixture = createService({ maxConcurrent: 2 });
  try {
    const first = submit(fixture.service, alpha, {
      durationMs: 500,
      outcome: 'converged',
      label: 'alpha',
    });
    const second = submit(fixture.service, beta, {
      durationMs: 700,
      outcome: 'failed',
      label: 'beta',
    });
    await fixture.service.waitFor((store) => (
      store.executions.filter((entry) => entry.state === 'running').length === 2
    ));
    assert.equal(fixture.service.snapshot(alpha.project).scheduler.runningCount, 2);

    const alphaTerminal = await fixture.service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === first.execution.executionId);
      return execution?.state === 'converged' ? execution : null;
    });
    const betaWhileAlphaDone = fixture.service.snapshot(beta.project).executions.find(
      (entry) => entry.executionId === second.execution.executionId,
    );
    assert.ok(['running', 'failed'].includes(betaWhileAlphaDone.state));
    const betaTerminal = await fixture.service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === second.execution.executionId);
      return execution?.state === 'failed' ? execution : null;
    });
    assert.deepEqual(alphaTerminal.runRefs, ['run://fixture/alpha']);
    assert.deepEqual(betaTerminal.runRefs, ['run://fixture/beta']);
    assert.equal(alphaTerminal.project.root, alpha.root);
    assert.equal(betaTerminal.project.root, beta.root);
  } finally {
    fixture.cleanup();
    alpha.cleanup();
    beta.cleanup();
  }
});

test('two builds for one Project retain independent request, execution, process, worksite, output, and run identity', async () => {
  const current = createProject('fixture_same_project');
  const fixture = createService({ maxConcurrent: 2 });
  try {
    const first = submit(fixture.service, current, {
      durationMs: 450,
      outcome: 'converged',
      label: 'same-project-alpha',
    });
    const second = submit(fixture.service, current, {
      durationMs: 650,
      outcome: 'converged',
      label: 'same-project-beta',
    });
    await fixture.service.waitFor((store) => (
      store.executions.filter((entry) => entry.state === 'running').length === 2
    ));
    const running = fixture.service.snapshot(current.project).executions;
    assert.equal(running.length, 2);
    assert.notEqual(running[0].requestId, running[1].requestId);
    assert.notEqual(running[0].executionId, running[1].executionId);
    assert.notEqual(running[0].processRef, running[1].processRef);
    assert.notEqual(running[0].worksiteRef, running[1].worksiteRef);

    const firstTerminal = await fixture.service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === first.execution.executionId);
      return execution?.state === 'converged' ? execution : null;
    });
    const secondTerminal = await fixture.service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === second.execution.executionId);
      return execution?.state === 'converged' ? execution : null;
    });
    assert.deepEqual(firstTerminal.runRefs, ['run://fixture/same-project-alpha']);
    assert.deepEqual(secondTerminal.runRefs, ['run://fixture/same-project-beta']);
    const firstOutput = fixture.service.attach({
      projectRoot: current.root,
      executionId: firstTerminal.executionId,
      actorRef: 'actor://operator/test',
    }, current.project).output.stdout;
    const secondOutput = fixture.service.attach({
      projectRoot: current.root,
      executionId: secondTerminal.executionId,
      actorRef: 'actor://operator/test',
    }, current.project).output.stdout;
    assert.match(firstOutput, /same-project-alpha/);
    assert.doesNotMatch(firstOutput, /same-project-beta/);
    assert.match(secondOutput, /same-project-beta/);
    assert.doesNotMatch(secondOutput, /same-project-alpha/);
  } finally {
    fixture.cleanup();
    current.cleanup();
  }
});

test('bounded scheduler queues excess work and starts it only after a slot is released', async () => {
  const alpha = createProject('fixture_queue_alpha');
  const beta = createProject('fixture_queue_beta');
  const fixture = createService({ maxConcurrent: 1 });
  try {
    const first = submit(fixture.service, alpha, {
      durationMs: 400,
      outcome: 'converged',
      label: 'queue-alpha',
    });
    const second = submit(fixture.service, beta, {
      durationMs: 100,
      outcome: 'converged',
      label: 'queue-beta',
    });
    const queued = await fixture.service.waitFor((store) => {
      const firstExecution = store.executions.find((entry) => entry.executionId === first.execution.executionId);
      const secondExecution = store.executions.find((entry) => entry.executionId === second.execution.executionId);
      return firstExecution?.state === 'running' && secondExecution?.state === 'queued'
        ? secondExecution
        : null;
    });
    assert.equal(queued.queuePosition, 0);
    assert.deepEqual(fixture.service.snapshot(beta.project).scheduler, {
      maxConcurrent: 1,
      maxQueued: 10,
      runningCount: 1,
      queuedCount: 1,
      availableSlots: 0,
    });
    const secondTerminal = await fixture.service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === second.execution.executionId);
      return execution?.state === 'converged' ? execution : null;
    });
    assert.ok(secondTerminal.startedAt > first.execution.updatedAt);
  } finally {
    fixture.cleanup();
    alpha.cleanup();
    beta.cleanup();
  }
});

test('supervisor restart preserves identities and projects stale before disconnected', async () => {
  const current = createProject('fixture_reconnect');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-reconnect-state-'));
  let sequence = 0;
  const fakeChild = new EventEmitter();
  fakeChild.pid = 4242;
  fakeChild.stdout = new PassThrough();
  fakeChild.stderr = new PassThrough();
  fakeChild.kill = () => true;
  const first = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    maxConcurrent: 2,
    idFactory: (kind) => `${kind}-${++sequence}`,
    spawnProcess: () => fakeChild,
  });
  let recovered;
  let recoveredNow = '2026-07-11T00:00:00.000Z';
  try {
    const submitted = submit(first, current, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'reconnect',
    });
    await first.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === submitted.execution.executionId)?.state === 'running'
    ));
    recovered = createBuildControlService({
      managerStateRoot,
      fixtureMode: true,
      maxConcurrent: 2,
      recoveryDisconnectMs: 1_000,
      now: () => recoveredNow,
    });
    const stale = recovered.snapshot(current.project);
    assert.equal(stale.executions[0].executionId, submitted.execution.executionId);
    assert.equal(stale.executions[0].requestId, submitted.request.requestId);
    assert.equal(stale.executions[0].processRef, 'process://local/4242');
    assert.equal(stale.executions[0].state, 'stale');
    assert.equal(stale.scheduler.maxConcurrent, 2);
    assert.equal(stale.scheduler.runningCount, 0);

    recoveredNow = '2026-07-11T00:00:01.001Z';
    const disconnected = recovered.snapshot(current.project);
    assert.equal(disconnected.executions[0].executionId, submitted.execution.executionId);
    assert.equal(disconnected.executions[0].state, 'disconnected');
  } finally {
    first.shutdown();
    recovered?.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
    current.cleanup();
  }
});

test('carrier-gated reconnect resumes the same execution and external cancellation is adapter-confirmed', async () => {
  const current = createProject('fixture_resume');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-resume-state-'));
  const adapterRef = 'execution-adapter://test/resumable/v1';
  const published = {
    ...descriptor('fixture_resume'),
    executionAdapterRef: adapterRef,
    supportedCommands: ['submit', 'attach', 'cancel', 'resume'],
  };
  writeFileSync(
    join(current.root, '.odd', 'build-carrier.json'),
    `${JSON.stringify(published, null, 2)}\n`,
    'utf8',
  );
  const fakeChild = new EventEmitter();
  fakeChild.pid = 4343;
  fakeChild.stdout = new PassThrough();
  fakeChild.stderr = new PassThrough();
  fakeChild.kill = () => true;
  let cancellationCount = 0;
  let observationCount = 0;
  const adapter = {
    adapterRef,
    sourceRefs: ['execution-adapter-test://resumable'],
    validateInputs: (input) => input,
    createProcessPlan({ paths }) {
      return {
        executable: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000)'],
        cwd: paths.worksitePath,
        env: { PATH: process.env.PATH ?? '' },
        resultPath: paths.resultPath,
        adapterSourceRefs: ['execution-adapter-test://resumable/start'],
      };
    },
    observeExecution({ execution, observedAt }) {
      observationCount += 1;
      return {
        schemaVersion: '1',
        executionId: execution.executionId,
        state: 'running',
        processRef: execution.processRef,
        heartbeatAt: observedAt,
        runRefs: execution.runRefs,
        terminalResult: null,
        sourceRefs: ['execution-adapter-test://resumable/observation'],
      };
    },
    cancelExecution({ execution }) {
      cancellationCount += 1;
      return {
        schemaVersion: '1',
        executionId: execution.executionId,
        cancelled: true,
        sourceRefs: ['execution-adapter-test://resumable/cancelled'],
      };
    },
  };
  let sequence = 0;
  const first = createBuildControlService({
    managerStateRoot,
    adapters: new Map([[adapterRef, adapter]]),
    idFactory: (kind) => `${kind}-${++sequence}`,
    spawnProcess: () => fakeChild,
  });
  let recovered;
  try {
    const submitted = submit(first, current, { label: 'resumable' });
    await first.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === submitted.execution.executionId)?.state === 'running'
    ));
    recovered = createBuildControlService({
      managerStateRoot,
      adapters: new Map([[adapterRef, adapter]]),
      recoveryDisconnectMs: 0,
    });
    const disconnected = recovered.snapshot(current.project).executions[0];
    assert.equal(disconnected.state, 'disconnected');

    const resumed = recovered.resume({
      projectRoot: current.root,
      executionId: disconnected.executionId,
      actorRef: 'actor://operator/test',
    }, current.project);
    assert.equal(resumed.executionId, submitted.execution.executionId);
    assert.equal(resumed.requestId, submitted.request.requestId);
    assert.equal(resumed.processRef, 'process://local/4343');
    assert.equal(resumed.state, 'running');
    assert.equal(resumed.resumedBy, 'actor://operator/test');
    assert.ok(resumed.resumedAt);
    assert.ok(resumed.sourceRefs.includes('execution-adapter-test://resumable/observation'));
    const refreshed = recovered.snapshot(current.project).executions[0];
    assert.equal(refreshed.executionId, resumed.executionId);
    assert.equal(refreshed.state, 'running');
    assert.equal(observationCount, 2);

    const attached = recovered.attach({
      projectRoot: current.root,
      executionId: resumed.executionId,
      actorRef: 'actor://operator/test',
    }, current.project);
    assert.equal(attached.execution.executionId, resumed.executionId);

    const cancelled = recovered.cancel({
      projectRoot: current.root,
      executionId: resumed.executionId,
      actorRef: 'actor://operator/test',
    }, current.project);
    assert.equal(cancelled.state, 'cancelled');
    assert.equal(cancelled.cancelledBy, 'actor://operator/test');
    assert.equal(cancellationCount, 1);
    assert.ok(cancelled.sourceRefs.includes('execution-adapter-test://resumable/cancelled'));
  } finally {
    first.shutdown();
    recovered?.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
    current.cleanup();
  }
});

test('snapshot provisioner rejects a symlink that escapes the Project basis', () => {
  const current = createProject('fixture_symlink');
  const destination = mkdtempSync(join(tmpdir(), 'odd-manager-worksite-'));
  try {
    symlinkSync('/tmp', join(current.root, 'external-link'));
    assert.throws(
      () => provisionProjectSnapshot({
        projectRoot: current.root,
        projectId: current.project.id,
        revision: observeProjectRevision(current.root),
        destinationRoot: join(destination, 'workspace'),
      }),
      /rejects external symlink/,
    );
  } finally {
    rmSync(destination, { recursive: true, force: true });
    current.cleanup();
  }
});

test('arbitrary process fields in browser input are rejected by the installed adapter schema', () => {
  const current = createProject('fixture_security');
  const fixture = createService();
  try {
    assert.throws(
      () => submit(fixture.service, current, {
        durationMs: 100,
        outcome: 'converged',
        label: 'security',
        executable: '/bin/sh',
      }),
      (error) => error instanceof BuildControlError && /unsupported fields: executable/.test(error.message),
    );
  } finally {
    fixture.cleanup();
    current.cleanup();
  }
});
