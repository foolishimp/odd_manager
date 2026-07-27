import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
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
import {
  fingerprintProjectSource,
  observeProjectRevision,
} from '../../src/server/project-revision-service.mjs';

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

function buildControlStorePath(managerStateRoot) {
  return join(
    managerStateRoot,
    '.ai-workspace',
    'runtime',
    'developer-control',
    'build-control',
    'state.json',
  );
}

function writeTypedTerminalResult(managerStateRoot, executionId, label) {
  const resultPath = join(
    managerStateRoot,
    '.ai-workspace',
    'runtime',
    'developer-control',
    'build-control',
    'executions',
    executionId,
    'terminal-result.json',
  );
  writeFileSync(resultPath, `${JSON.stringify({
    kind: 'converged',
    resultRef: `build-result://test/${label}`,
    detail: `Test carrier ${label} converged.`,
    runRefs: [`run://test/${label}`],
    sourceRefs: [`test-carrier://${label}`],
  }, null, 2)}\n`, 'utf8');
}

test('descriptor admission fails closed for missing, invalid, mismatched, and uninstalled carriers', () => {
  const current = createProject('fixture_admission');
  const outside = mkdtempSync(join(tmpdir(), 'odd-manager-descriptor-outside-'));
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

    const outsideDescriptor = join(outside, 'build-carrier.json');
    writeFileSync(
      outsideDescriptor,
      `${JSON.stringify(descriptor('fixture_admission'), null, 2)}\n`,
      'utf8',
    );
    symlinkSync(outsideDescriptor, join(current.root, '.odd', 'build-carrier.json'));
    const externalSymlink = loadBuildCarrierDescriptor(current.project, refs);
    assert.equal(externalSymlink.status, 'error');
    assert.match(externalSymlink.reason, /regular non-symlink Project file/);

    unlinkSync(join(current.root, '.odd', 'build-carrier.json'));
    const internalDescriptor = join(current.root, 'internal-build-carrier.json');
    writeFileSync(
      internalDescriptor,
      `${JSON.stringify(descriptor('fixture_admission'), null, 2)}\n`,
      'utf8',
    );
    symlinkSync('../internal-build-carrier.json', join(current.root, '.odd', 'build-carrier.json'));
    const internalSymlink = loadBuildCarrierDescriptor(current.project, refs);
    assert.equal(internalSymlink.status, 'error');
    assert.match(internalSymlink.reason, /regular non-symlink Project file/);
  } finally {
    rmSync(outside, { recursive: true, force: true });
    current.cleanup();
  }
});

test('initial submit persistence failure leaves no phantom authority and the next submit is clean', async () => {
  const current = createProject('fixture_submit_store_fault');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-submit-store-fault-'));
  const storePath = join(
    managerStateRoot,
    '.ai-workspace',
    'runtime',
    'developer-control',
    'build-control',
    'state.json',
  );
  let sequence = 0;
  let injectFailure = true;
  const service = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    maxConcurrent: 1,
    idFactory: (kind) => `${kind}-${++sequence}`,
    beforeStoreCommit({ store }) {
      if (
        injectFailure
        && store.requests.length === 1
        && store.executions.length === 1
        && store.executions[0].state === 'queued'
      ) {
        injectFailure = false;
        throw new Error('injected initial-submit store failure');
      }
    },
  });
  try {
    const before = service.snapshot(current.project);
    assert.deepEqual(before.requests, []);
    assert.deepEqual(before.executions, []);

    assert.throws(
      () => submit(service, current, {
        durationMs: 25,
        outcome: 'converged',
        label: 'must-not-persist',
      }),
      /injected initial-submit store failure/,
    );

    const afterFailure = service.snapshot(current.project);
    assert.deepEqual(afterFailure.requests, before.requests);
    assert.deepEqual(afterFailure.executions, before.executions);
    assert.deepEqual(afterFailure.scheduler, before.scheduler);
    assert.equal(existsSync(storePath), false);

    const accepted = submit(service, current, {
      durationMs: 25,
      outcome: 'converged',
      label: 'clean-successor',
    });
    assert.equal(accepted.snapshot.requests.length, 1);
    assert.equal(accepted.snapshot.executions.length, 1);
    assert.equal(accepted.snapshot.requests[0].requestId, accepted.request.requestId);
    assert.equal(accepted.snapshot.executions[0].executionId, accepted.execution.executionId);
    assert.equal(accepted.snapshot.executions[0].queuePosition, 0);
    assert.equal(
      accepted.snapshot.requests.some((entry) => entry.inputs.label === 'must-not-persist'),
      false,
    );

    await service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === accepted.execution.executionId)?.state === 'converged'
    ));
    const finalSnapshot = service.snapshot(current.project);
    assert.equal(finalSnapshot.requests.length, 1);
    assert.equal(finalSnapshot.executions.length, 1);
    assert.equal(finalSnapshot.requests[0].inputs.label, 'clean-successor');
  } finally {
    service.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
    current.cleanup();
  }
});

test('durable store load rejects duplicate identities and incoherent request-to-execution relations', async () => {
  const current = createProject('fixture_store_relations');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-store-relations-base-'));
  let sequence = 0;
  const service = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    maxConcurrent: 1,
    idFactory: (kind) => `${kind}-${++sequence}`,
  });
  try {
    const submitted = submit(service, current, {
      durationMs: 25,
      outcome: 'converged',
      label: 'relation-basis',
    });
    await service.waitFor((store) => (
      store.executions.find(
        (entry) => entry.executionId === submitted.execution.executionId,
      )?.state === 'converged'
    ));
    service.shutdown();
    const basis = JSON.parse(readFileSync(buildControlStorePath(managerStateRoot), 'utf8'));
    const clone = () => structuredClone(basis);
    const cases = [
      {
        name: 'duplicate request identity',
        expected: /duplicate Build Request identity/,
        mutate(candidate) {
          candidate.requests.push(structuredClone(candidate.requests[0]));
        },
      },
      {
        name: 'duplicate execution identity',
        expected: /duplicate Build Execution identity/,
        mutate(candidate) {
          candidate.executions.push(structuredClone(candidate.executions[0]));
        },
      },
      {
        name: 'duplicate correlation identity',
        expected: /duplicate Build Request correlation identity/,
        mutate(candidate) {
          const request = {
            ...structuredClone(candidate.requests[0]),
            requestId: 'request-duplicate-correlation',
          };
          const execution = {
            ...structuredClone(candidate.executions[0]),
            executionId: 'execution-duplicate-correlation',
            requestId: request.requestId,
            worksiteRef: 'worksite://odd_manager/execution-duplicate-correlation',
          };
          candidate.requests.push(request);
          candidate.executions.push(execution);
        },
      },
      {
        name: 'correlation mismatch',
        expected: /correlation does not match Build Request/,
        mutate(candidate) {
          candidate.executions[0].correlationId = 'correlation-mismatch';
        },
      },
      {
        name: 'Project mismatch',
        expected: /Project does not match Build Request/,
        mutate(candidate) {
          candidate.executions[0].project.label = 'other-project-label';
        },
      },
      {
        name: 'Project Revision mismatch',
        expected: /Project Revision does not match Build Request/,
        mutate(candidate) {
          candidate.executions[0].revision.observedAt = '2030-01-01T00:00:00.000Z';
        },
      },
      {
        name: 'request without one execution',
        expected: /must relate to exactly one Build Execution/,
        mutate(candidate) {
          candidate.requests.push({
            ...structuredClone(candidate.requests[0]),
            requestId: 'request-without-execution',
            correlationId: 'correlation-without-execution',
          });
        },
      },
      {
        name: 'cross-kind identity reuse',
        expected: /reuses a request, execution, or correlation identity/,
        mutate(candidate) {
          candidate.requests[0].requestId = candidate.executions[0].executionId;
          candidate.executions[0].requestId = candidate.executions[0].executionId;
        },
      },
    ];

    for (const fixture of cases) {
      const candidateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-store-relations-case-'));
      try {
        const candidate = clone();
        fixture.mutate(candidate);
        const candidateStorePath = buildControlStorePath(candidateRoot);
        mkdirSync(join(candidateRoot, '.ai-workspace', 'runtime', 'developer-control', 'build-control'), {
          recursive: true,
        });
        writeFileSync(candidateStorePath, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8');
        assert.throws(
          () => createBuildControlService({
            managerStateRoot: candidateRoot,
            fixtureMode: true,
          }),
          (error) => (
            error instanceof BuildControlError
            && error.statusCode === 500
            && fixture.expected.test(error.message)
          ),
          fixture.name,
        );
      } finally {
        rmSync(candidateRoot, { recursive: true, force: true });
      }
    }
  } finally {
    service.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
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
    const acknowledged = fixture.service.cancel({
      projectRoot: current.root,
      executionId: submitted.execution.executionId,
      actorRef: 'actor://operator/canceller',
    }, current.project);
    assert.equal(acknowledged.state, 'running');
    assert.equal(acknowledged.cancelledBy, 'actor://operator/canceller');
    assert.ok(acknowledged.cancelRequestedAt);
    assert.equal(acknowledged.processOutcome, null);
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

test('queued and running cancellation retain immutable descriptor authority after Project descriptor drift', async () => {
  const current = createProject('fixture_cancel_descriptor_drift');
  const fixture = createService({ maxConcurrent: 1 });
  try {
    const runningSubmission = submit(fixture.service, current, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'running-before-drift',
    });
    const queuedSubmission = submit(fixture.service, current, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'queued-before-drift',
    });
    await fixture.service.waitFor((store) => {
      const running = store.executions.find(
        (entry) => entry.executionId === runningSubmission.execution.executionId,
      );
      const queued = store.executions.find(
        (entry) => entry.executionId === queuedSubmission.execution.executionId,
      );
      return running?.state === 'running' && queued?.state === 'queued';
    });

    writeFileSync(
      join(current.root, '.odd', 'build-carrier.json'),
      `${JSON.stringify({
        ...descriptor('fixture_cancel_descriptor_drift'),
        executionAdapterRef: 'execution-adapter://fixture/repriced/v2',
        supportedCommands: ['submit'],
      }, null, 2)}\n`,
      'utf8',
    );
    assert.equal(fixture.service.snapshot(current.project).descriptorAdmission.status, 'unsupported');

    const queuedCancelled = fixture.service.cancel({
      projectRoot: current.root,
      executionId: queuedSubmission.execution.executionId,
      actorRef: 'actor://operator/descriptor-drift',
    }, current.project);
    assert.equal(queuedCancelled.state, 'cancelled');

    const runningAcknowledged = fixture.service.cancel({
      projectRoot: current.root,
      executionId: runningSubmission.execution.executionId,
      actorRef: 'actor://operator/descriptor-drift',
    }, current.project);
    assert.equal(runningAcknowledged.state, 'running');
    const runningCancelled = await fixture.service.waitFor((store) => {
      const execution = store.executions.find(
        (entry) => entry.executionId === runningSubmission.execution.executionId,
      );
      return execution?.state === 'cancelled' ? execution : null;
    });
    assert.equal(runningCancelled.cancelledBy, 'actor://operator/descriptor-drift');
  } finally {
    fixture.cleanup();
    current.cleanup();
  }
});

test('a rejected process signal preserves durable cancel intent and a synchronously observed typed result', async () => {
  const current = createProject('fixture_cancel_rejected_signal');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-cancel-rejected-state-'));
  const fakeChild = new EventEmitter();
  fakeChild.pid = 4545;
  fakeChild.stdout = new PassThrough();
  fakeChild.stderr = new PassThrough();
  let executionId = null;
  fakeChild.kill = () => {
    writeTypedTerminalResult(managerStateRoot, executionId, 'rejected-signal');
    fakeChild.emit('close', 0, null);
    return false;
  };
  let sequence = 0;
  const service = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    maxConcurrent: 1,
    idFactory: (kind) => `${kind}-${++sequence}`,
    spawnProcess: () => fakeChild,
  });
  try {
    const submitted = submit(service, current, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'rejected-signal',
    });
    executionId = submitted.execution.executionId;
    await service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === executionId)?.state === 'running'
    ));

    assert.throws(
      () => service.cancel({
        projectRoot: current.root,
        executionId,
        actorRef: 'actor://operator/canceller',
      }, current.project),
      (error) => (
        error instanceof BuildControlError
        && error.statusCode === 409
        && /could not be signalled/.test(error.message)
        && error.execution?.state === 'converged'
      ),
    );

    const terminal = service.snapshot(current.project).executions.find(
      (entry) => entry.executionId === executionId,
    );
    assert.equal(terminal.state, 'converged');
    assert.ok(terminal.cancelRequestedAt);
    assert.equal(terminal.cancelledBy, 'actor://operator/canceller');
    assert.equal(terminal.processOutcome.kind, 'typed_result');
    assert.equal(terminal.processOutcome.signal, null);
    assert.equal(terminal.processOutcome.terminalResult.resultRef, 'build-result://test/rejected-signal');
    assert.deepEqual(terminal.runRefs, ['run://test/rejected-signal']);
  } finally {
    service.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
    current.cleanup();
  }
});

test('durable cancel intent precedes local signals and external adapter cancellation effects', async () => {
  const localProject = createProject('fixture_cancel_intent_local');
  const localStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-cancel-intent-local-'));
  const localChild = new EventEmitter();
  localChild.pid = 4747;
  localChild.stdout = new PassThrough();
  localChild.stderr = new PassThrough();
  let localSignalCount = 0;
  localChild.kill = () => {
    localSignalCount += 1;
    return true;
  };
  let localSequence = 0;
  let localFaultArmed = false;
  const localService = createBuildControlService({
    managerStateRoot: localStateRoot,
    fixtureMode: true,
    maxConcurrent: 1,
    idFactory: (kind) => `${kind}-${++localSequence}`,
    spawnProcess: () => localChild,
    beforeStoreCommit({ store }) {
      if (
        localFaultArmed
        && store.executions.some((entry) => (
          entry.state === 'running'
          && entry.cancelRequestedAt !== null
        ))
      ) {
        throw new Error('injected local cancel-intent persistence failure');
      }
    },
  });

  const externalProject = createProject('fixture_cancel_intent_external');
  const externalStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-cancel-intent-external-'));
  const externalAdapterRef = 'execution-adapter://test/cancel-intent-external/v1';
  const externalDescriptor = {
    ...descriptor('fixture_cancel_intent_external'),
    executionAdapterRef: externalAdapterRef,
  };
  writeFileSync(
    join(externalProject.root, '.odd', 'build-carrier.json'),
    `${JSON.stringify(externalDescriptor, null, 2)}\n`,
    'utf8',
  );
  const externalChild = new EventEmitter();
  externalChild.pid = 4848;
  externalChild.stdout = new PassThrough();
  externalChild.stderr = new PassThrough();
  externalChild.kill = () => true;
  let externalCancelCount = 0;
  const externalAdapter = {
    adapterRef: externalAdapterRef,
    sourceRefs: ['adapter-module-sha256://cancel-intent-external'],
    validateInputs: (input) => input,
    createProcessPlan({ paths }) {
      return {
        executable: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000)'],
        cwd: paths.worksitePath,
        env: { PATH: process.env.PATH ?? '' },
        resultPath: paths.resultPath,
        adapterSourceRefs: ['adapter-module-sha256://cancel-intent-external'],
      };
    },
    cancelExecution({ execution }) {
      externalCancelCount += 1;
      return {
        schemaVersion: '1',
        executionId: execution.executionId,
        cancelled: true,
        sourceRefs: ['adapter-test://cancel-intent-confirmed'],
      };
    },
  };
  let externalSequence = 0;
  const firstExternalService = createBuildControlService({
    managerStateRoot: externalStateRoot,
    adapters: new Map([[externalAdapterRef, externalAdapter]]),
    maxConcurrent: 1,
    idFactory: (kind) => `${kind}-${++externalSequence}`,
    spawnProcess: () => externalChild,
  });
  let recoveredExternalService = null;
  try {
    const localSubmission = submit(localService, localProject, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'cancel-intent-local',
    });
    await localService.waitFor((store) => (
      store.executions.find(
        (entry) => entry.executionId === localSubmission.execution.executionId,
      )?.state === 'running'
    ));
    localFaultArmed = true;
    assert.throws(
      () => localService.cancel({
        projectRoot: localProject.root,
        executionId: localSubmission.execution.executionId,
        actorRef: 'actor://operator/local-canceller',
      }, localProject.project),
      /injected local cancel-intent persistence failure/,
    );
    assert.equal(localSignalCount, 0);
    const localAfterFault = localService.snapshot(localProject.project).executions[0];
    assert.equal(localAfterFault.cancelRequestedAt, null);
    assert.equal(localAfterFault.cancelledBy, null);

    localFaultArmed = false;
    const localAcknowledged = localService.cancel({
      projectRoot: localProject.root,
      executionId: localSubmission.execution.executionId,
      actorRef: 'actor://operator/local-canceller',
    }, localProject.project);
    assert.equal(localSignalCount, 1);
    assert.ok(localAcknowledged.cancelRequestedAt);
    assert.equal(localAcknowledged.cancelledBy, 'actor://operator/local-canceller');

    const externalSubmission = submit(firstExternalService, externalProject, {
      label: 'cancel-intent-external',
    });
    await firstExternalService.waitFor((store) => (
      store.executions.find(
        (entry) => entry.executionId === externalSubmission.execution.executionId,
      )?.state === 'running'
    ));
    let externalFaultArmed = false;
    recoveredExternalService = createBuildControlService({
      managerStateRoot: externalStateRoot,
      adapters: new Map([[externalAdapterRef, externalAdapter]]),
      recoveryDisconnectMs: 0,
      beforeStoreCommit({ store }) {
        if (
          externalFaultArmed
          && store.executions.some((entry) => entry.cancelRequestedAt !== null)
        ) {
          throw new Error('injected external cancel-intent persistence failure');
        }
      },
    });
    const disconnected = recoveredExternalService.snapshot(externalProject.project).executions[0];
    assert.equal(disconnected.state, 'disconnected');
    externalFaultArmed = true;
    assert.throws(
      () => recoveredExternalService.cancel({
        projectRoot: externalProject.root,
        executionId: externalSubmission.execution.executionId,
        actorRef: 'actor://operator/external-canceller',
      }, externalProject.project),
      /injected external cancel-intent persistence failure/,
    );
    assert.equal(externalCancelCount, 0);
    const externalAfterFault = recoveredExternalService.snapshot(externalProject.project).executions[0];
    assert.equal(externalAfterFault.cancelRequestedAt, null);
    assert.equal(externalAfterFault.cancelledBy, null);

    externalFaultArmed = false;
    const externalCancelled = recoveredExternalService.cancel({
      projectRoot: externalProject.root,
      executionId: externalSubmission.execution.executionId,
      actorRef: 'actor://operator/external-canceller',
    }, externalProject.project);
    assert.equal(externalCancelCount, 1);
    assert.equal(externalCancelled.state, 'cancelled');
    assert.ok(externalCancelled.cancelRequestedAt);
    assert.equal(externalCancelled.cancelledBy, 'actor://operator/external-canceller');
  } finally {
    localService.shutdown();
    firstExternalService.shutdown();
    recoveredExternalService?.shutdown();
    rmSync(localStateRoot, { recursive: true, force: true });
    rmSync(externalStateRoot, { recursive: true, force: true });
    localProject.cleanup();
    externalProject.cleanup();
  }
});

test('an accepted signal followed by normal typed completion does not manufacture cancellation', async () => {
  const current = createProject('fixture_cancel_ignored_signal');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-cancel-ignored-state-'));
  const fakeChild = new EventEmitter();
  fakeChild.pid = 4646;
  fakeChild.stdout = new PassThrough();
  fakeChild.stderr = new PassThrough();
  fakeChild.kill = (signal) => signal === 'SIGTERM';
  let sequence = 0;
  const service = createBuildControlService({
    managerStateRoot,
    fixtureMode: true,
    maxConcurrent: 1,
    idFactory: (kind) => `${kind}-${++sequence}`,
    spawnProcess: () => fakeChild,
  });
  try {
    const submitted = submit(service, current, {
      durationMs: 5_000,
      outcome: 'converged',
      label: 'ignored-signal',
    });
    const executionId = submitted.execution.executionId;
    await service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === executionId)?.state === 'running'
    ));

    const acknowledged = service.cancel({
      projectRoot: current.root,
      executionId,
      actorRef: 'actor://operator/canceller',
    }, current.project);
    assert.equal(acknowledged.state, 'running');
    assert.ok(acknowledged.cancelRequestedAt);
    assert.equal(acknowledged.cancelledBy, 'actor://operator/canceller');

    writeTypedTerminalResult(managerStateRoot, executionId, 'ignored-signal');
    fakeChild.emit('close', 0, null);
    const terminal = await service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === executionId);
      return execution?.state === 'converged' ? execution : null;
    });
    assert.equal(terminal.cancelRequestedAt, acknowledged.cancelRequestedAt);
    assert.equal(terminal.cancelledBy, 'actor://operator/canceller');
    assert.equal(terminal.processOutcome.kind, 'typed_result');
    assert.equal(terminal.processOutcome.signal, null);
    assert.equal(terminal.processOutcome.terminalResult.resultRef, 'build-result://test/ignored-signal');
    assert.deepEqual(terminal.runRefs, ['run://test/ignored-signal']);
  } finally {
    service.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
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

test('queue renumbering advances observation time for a Project-local refresh', async () => {
  const alpha = createProject('fixture_queue_shift_alpha');
  const beta = createProject('fixture_queue_shift_beta');
  const gamma = createProject('fixture_queue_shift_gamma');
  const fixture = createService({ maxConcurrent: 1 });
  try {
    const active = submit(fixture.service, alpha, {
      durationMs: 1_000,
      outcome: 'converged',
      label: 'queue-shift-active',
    });
    await fixture.service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === active.execution.executionId)?.state === 'running'
    ));
    const second = submit(fixture.service, beta, {
      durationMs: 100,
      outcome: 'converged',
      label: 'queue-shift-second',
    });
    const third = submit(fixture.service, gamma, {
      durationMs: 100,
      outcome: 'converged',
      label: 'queue-shift-third',
    });
    const before = fixture.service.snapshot(gamma.project).executions.find(
      (entry) => entry.executionId === third.execution.executionId,
    );
    assert.equal(before.state, 'queued');
    assert.equal(before.queuePosition, 1);

    fixture.service.cancel({
      projectRoot: beta.root,
      executionId: second.execution.executionId,
      actorRef: 'actor://operator/test',
    }, beta.project);
    const after = fixture.service.snapshot(gamma.project).executions.find(
      (entry) => entry.executionId === third.execution.executionId,
    );
    assert.equal(after.state, 'queued');
    assert.equal(after.queuePosition, 0);
    assert.ok(Date.parse(after.updatedAt) > Date.parse(before.updatedAt));
    fixture.service.cancel({
      projectRoot: gamma.root,
      executionId: third.execution.executionId,
      actorRef: 'actor://operator/test',
    }, gamma.project);
    fixture.service.cancel({
      projectRoot: alpha.root,
      executionId: active.execution.executionId,
      actorRef: 'actor://operator/test',
    }, alpha.project);
    await fixture.service.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === active.execution.executionId)?.state === 'cancelled'
    ));
  } finally {
    fixture.cleanup();
    alpha.cleanup();
    beta.cleanup();
    gamma.cleanup();
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

function markerAdapter(adapterRef, markerPath) {
  return {
    adapterRef,
    sourceRefs: [`test-adapter-source://${adapterRef.split('://').at(-1)}`],
    validateInputs: (input) => input,
    createProcessPlan({ paths }) {
      return {
        executable: process.execPath,
        args: [
          '-e',
          `require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'product-work-ran')`,
        ],
        cwd: paths.worksitePath,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          TMPDIR: process.env.TMPDIR ?? '',
        },
        resultPath: paths.resultPath,
        adapterSourceRefs: [`test-plan://${adapterRef.split('://').at(-1)}`],
      };
    },
  };
}

async function waitForCondition(predicate, detail, timeoutMs = 3_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
  }
  assert.fail(detail);
}

async function assertProcessTerminated(pid) {
  await waitForCondition(() => {
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      if (error?.code === 'ESRCH') return true;
      throw error;
    }
  }, `gated child ${pid} did not terminate`);
}

test('restart before the durable launch-gate commit aborts without Product work', async () => {
  const current = createProject('fixture_gated_launch_recovery');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-gated-launch-state-'));
  const markerPath = join(managerStateRoot, 'product-work.marker');
  const adapterRef = 'execution-adapter://test/gated-launch-recovery/v1';
  const adapter = markerAdapter(adapterRef, markerPath);
  writeFileSync(
    join(current.root, '.odd', 'build-carrier.json'),
    `${JSON.stringify({
      ...descriptor('fixture_gated_launch_recovery'),
      executionAdapterRef: adapterRef,
    }, null, 2)}\n`,
    'utf8',
  );
  let recovered = null;
  let recoveredExecution = null;
  let gatedPid = null;
  let sequence = 0;
  const serviceOptions = {
    managerStateRoot,
    adapters: new Map([[adapterRef, adapter]]),
    maxConcurrent: 1,
  };
  const first = createBuildControlService({
    ...serviceOptions,
    idFactory: (kind) => `${kind}-${++sequence}`,
    afterSpawnBeforeRunningPersist({ executionId, processRef }) {
      gatedPid = Number(processRef.split('/').at(-1));
      recovered = createBuildControlService(serviceOptions);
      recoveredExecution = recovered.snapshot(current.project).executions.find(
        (entry) => entry.executionId === executionId,
      );
      return false;
    },
  });
  try {
    const submitted = submit(first, current, { label: 'gated-recovery' });
    await waitForCondition(() => recoveredExecution !== null, 'restart boundary was not observed');
    assert.equal(recoveredExecution.executionId, submitted.execution.executionId);
    assert.equal(recoveredExecution.state, 'failed');
    assert.equal(recoveredExecution.processRef, null);
    assert.equal(recoveredExecution.processOutcome.kind, 'spawn_error');
    assert.ok(
      recoveredExecution.sourceRefs.includes(
        'supervisor://odd_manager/recovered-gated-launch-abort',
      ),
    );
    await assertProcessTerminated(gatedPid);
    assert.equal(existsSync(markerPath), false);
  } finally {
    first.shutdown();
    recovered?.shutdown();
    rmSync(managerStateRoot, { recursive: true, force: true });
    current.cleanup();
  }
});

test('hook and durable-store faults close the launch gate and terminate before Product work', async () => {
  for (const fault of ['hook', 'persist']) {
    const current = createProject(`fixture_gated_${fault}_fault`);
    const managerStateRoot = mkdtempSync(join(tmpdir(), `odd-manager-gated-${fault}-state-`));
    const markerPath = join(managerStateRoot, 'product-work.marker');
    const adapterRef = `execution-adapter://test/gated-${fault}/v1`;
    const adapter = markerAdapter(adapterRef, markerPath);
    writeFileSync(
      join(current.root, '.odd', 'build-carrier.json'),
      `${JSON.stringify({
        ...descriptor(`fixture_gated_${fault}_fault`),
        executionAdapterRef: adapterRef,
      }, null, 2)}\n`,
      'utf8',
    );
    let gatedPid = null;
    let injectedPersistFault = false;
    let sequence = 0;
    const service = createBuildControlService({
      managerStateRoot,
      adapters: new Map([[adapterRef, adapter]]),
      maxConcurrent: 1,
      idFactory: (kind) => `${kind}-${++sequence}`,
      afterSpawnBeforeRunningPersist({ processRef }) {
        gatedPid = Number(processRef.split('/').at(-1));
        if (fault === 'hook') throw new Error('injected launch-hook failure');
        return true;
      },
      beforeStoreCommit({ store }) {
        if (
          fault === 'persist'
          && !injectedPersistFault
          && store.executions.some((entry) => entry.state === 'running')
        ) {
          injectedPersistFault = true;
          throw new Error('injected durable-store failure');
        }
      },
    });
    try {
      const submitted = submit(service, current, { label: fault });
      const failed = await service.waitFor((store) => {
        const execution = store.executions.find(
          (entry) => entry.executionId === submitted.execution.executionId,
        );
        return execution?.state === 'failed' ? execution : null;
      });
      assert.equal(failed.processRef, null);
      assert.equal(failed.processOutcome.kind, 'spawn_error');
      assert.equal(Number.isInteger(gatedPid), true);
      await assertProcessTerminated(gatedPid);
      assert.equal(existsSync(markerPath), false);
    } finally {
      service.shutdown();
      rmSync(managerStateRoot, { recursive: true, force: true });
      current.cleanup();
    }
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
    writeFileSync(
      join(current.root, '.odd', 'build-carrier.json'),
      `${JSON.stringify({
        ...published,
        executionAdapterRef: 'execution-adapter://test/repriced/v2',
        supportedCommands: ['submit'],
      }, null, 2)}\n`,
      'utf8',
    );
    recovered = createBuildControlService({
      managerStateRoot,
      adapters: new Map([[adapterRef, adapter]]),
      recoveryDisconnectMs: 0,
    });
    const recoveredSnapshot = recovered.snapshot(current.project);
    assert.equal(recoveredSnapshot.descriptorAdmission.status, 'unsupported');
    const disconnected = recoveredSnapshot.executions[0];
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

test('reconnect persists same-execution typed terminal observations and refuses disconnected observations', async () => {
  for (const observedState of ['waiting_human', 'converged', 'failed', 'stale', 'disconnected']) {
    const productId = `fixture_resume_${observedState}`;
    const current = createProject(productId);
    const managerStateRoot = mkdtempSync(join(tmpdir(), `odd-manager-resume-${observedState}-`));
    const adapterRef = `execution-adapter://test/resume-${observedState}/v1`;
    writeFileSync(
      join(current.root, '.odd', 'build-carrier.json'),
      `${JSON.stringify({
        ...descriptor(productId),
        executionAdapterRef: adapterRef,
        supportedCommands: ['submit', 'attach', 'cancel', 'resume'],
      }, null, 2)}\n`,
      'utf8',
    );
    const fakeChild = new EventEmitter();
    fakeChild.pid = 5_000 + observedState.length;
    fakeChild.stdout = new PassThrough();
    fakeChild.stderr = new PassThrough();
    fakeChild.kill = () => true;
    const adapterSourceRef = `adapter-module-sha256://resume-${observedState}`;
    const adapter = {
      adapterRef,
      sourceRefs: [adapterSourceRef],
      validateInputs: (input) => input,
      createProcessPlan({ paths }) {
        return {
          executable: process.execPath,
          args: ['-e', 'setInterval(() => {}, 1000)'],
          cwd: paths.worksitePath,
          env: { PATH: process.env.PATH ?? '' },
          resultPath: paths.resultPath,
          adapterSourceRefs: [adapterSourceRef],
        };
      },
      observeExecution({ execution, observedAt }) {
        const typed = ['waiting_human', 'converged', 'failed'].includes(observedState);
        return {
          schemaVersion: '1',
          executionId: execution.executionId,
          state: observedState,
          processRef: execution.processRef,
          heartbeatAt: observedAt,
          runRefs: [`run://resume/${observedState}`],
          terminalResult: typed ? {
            kind: observedState,
            resultRef: `build-result://resume/${observedState}`,
            detail: `Adapter observed ${observedState}.`,
            runRefs: [`run://resume/${observedState}`],
            sourceRefs: [`adapter-observation://resume/${observedState}/result`],
          } : null,
          sourceRefs: [`adapter-observation://resume/${observedState}`],
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
    let recovered = null;
    try {
      const submitted = submit(first, current, { label: observedState });
      await first.waitFor((store) => (
        store.executions.find(
          (entry) => entry.executionId === submitted.execution.executionId,
        )?.state === 'running'
      ));
      recovered = createBuildControlService({
        managerStateRoot,
        adapters: new Map([[adapterRef, adapter]]),
        recoveryDisconnectMs: 0,
      });
      const disconnected = recovered.snapshot(current.project).executions[0];
      assert.equal(disconnected.state, 'disconnected');

      const command = {
        projectRoot: current.root,
        executionId: disconnected.executionId,
        actorRef: 'actor://operator/reconnect-test',
      };
      if (['stale', 'disconnected'].includes(observedState)) {
        assert.throws(
          () => recovered.resume(command, current.project),
          new RegExp(`did not re-establish supervision: ${observedState}`),
        );
        const afterRefusal = recovered.snapshot(current.project).executions[0];
        assert.equal(afterRefusal.state, 'disconnected');
        assert.equal(afterRefusal.resumedAt, null);
        assert.equal(afterRefusal.resumedBy, null);
      } else {
        const resumed = recovered.resume(command, current.project);
        assert.equal(resumed.executionId, disconnected.executionId);
        assert.equal(resumed.requestId, disconnected.requestId);
        assert.equal(resumed.correlationId, disconnected.correlationId);
        assert.equal(resumed.state, observedState);
        assert.equal(resumed.resumedBy, 'actor://operator/reconnect-test');
        assert.ok(resumed.resumedAt);
        assert.ok(resumed.completedAt);
        assert.equal(resumed.processOutcome.kind, 'adapter_observation');
        assert.equal(resumed.processOutcome.terminalResult.kind, observedState);
        assert.deepEqual(resumed.runRefs, [`run://resume/${observedState}`]);
        const persisted = recovered.snapshot(current.project).executions[0];
        assert.equal(persisted.state, observedState);
        assert.equal(persisted.processOutcome.terminalResult.resultRef, `build-result://resume/${observedState}`);
      }
    } finally {
      first.shutdown();
      recovered?.shutdown();
      rmSync(managerStateRoot, { recursive: true, force: true });
      current.cleanup();
    }
  }
});

test('recovery rejects a same-ref adapter whose immutable installation binding drifted', async () => {
  const current = createProject('fixture_adapter_binding_drift');
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-adapter-binding-state-'));
  const adapterRef = 'execution-adapter://test/bound-resume/v1';
  const published = {
    ...descriptor('fixture_adapter_binding_drift'),
    executionAdapterRef: adapterRef,
    supportedCommands: ['submit', 'attach', 'cancel', 'resume'],
  };
  writeFileSync(
    join(current.root, '.odd', 'build-carrier.json'),
    `${JSON.stringify(published, null, 2)}\n`,
    'utf8',
  );
  const fakeChild = new EventEmitter();
  fakeChild.pid = 4444;
  fakeChild.stdout = new PassThrough();
  fakeChild.stderr = new PassThrough();
  fakeChild.kill = () => true;
  const createAdapter = (sourceRef, counters) => ({
    adapterRef,
    sourceRefs: [sourceRef],
    validateInputs: (input) => input,
    createProcessPlan({ paths }) {
      return {
        executable: process.execPath,
        args: ['-e', 'setInterval(() => {}, 1000)'],
        cwd: paths.worksitePath,
        env: { PATH: process.env.PATH ?? '' },
        resultPath: paths.resultPath,
        adapterSourceRefs: [sourceRef],
      };
    },
    observeExecution({ execution, observedAt }) {
      counters.observe += 1;
      return {
        schemaVersion: '1',
        executionId: execution.executionId,
        state: 'running',
        processRef: execution.processRef,
        heartbeatAt: observedAt,
        runRefs: execution.runRefs,
        terminalResult: null,
        sourceRefs: [sourceRef],
      };
    },
    cancelExecution({ execution }) {
      counters.cancel += 1;
      return {
        schemaVersion: '1',
        executionId: execution.executionId,
        cancelled: true,
        sourceRefs: [sourceRef],
      };
    },
  });
  const originalCounters = { observe: 0, cancel: 0 };
  const driftedCounters = { observe: 0, cancel: 0 };
  const originalAdapter = createAdapter('adapter-module-sha256://original', originalCounters);
  const driftedAdapter = createAdapter('adapter-module-sha256://drifted', driftedCounters);
  let sequence = 0;
  const first = createBuildControlService({
    managerStateRoot,
    adapters: new Map([[adapterRef, originalAdapter]]),
    idFactory: (kind) => `${kind}-${++sequence}`,
    spawnProcess: () => fakeChild,
  });
  let recovered;
  try {
    const submitted = submit(first, current, { label: 'bound-adapter' });
    await first.waitFor((store) => (
      store.executions.find((entry) => entry.executionId === submitted.execution.executionId)?.state === 'running'
    ));
    recovered = createBuildControlService({
      managerStateRoot,
      adapters: new Map([[adapterRef, driftedAdapter]]),
      recoveryDisconnectMs: 0,
    });
    const disconnected = recovered.snapshot(current.project).executions[0];
    assert.equal(disconnected.state, 'disconnected');
    assert.throws(
      () => recovered.resume({
        projectRoot: current.root,
        executionId: disconnected.executionId,
        actorRef: 'actor://operator/test',
      }, current.project),
      /immutable Build Request execution-adapter binding/,
    );
    assert.throws(
      () => recovered.cancel({
        projectRoot: current.root,
        executionId: disconnected.executionId,
        actorRef: 'actor://operator/test',
      }, current.project),
      /immutable execution-adapter binding/,
    );
    assert.deepEqual(driftedCounters, { observe: 0, cancel: 0 });
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
    unlinkSync(join(current.root, 'external-link'));
    symlinkSync('/tmp', join(current.root, 'z-outside-hop'));
    symlinkSync('z-outside-hop', join(current.root, 'a-chained-link'));
    assert.throws(
      () => provisionProjectSnapshot({
        projectRoot: current.root,
        projectId: current.project.id,
        revision: observeProjectRevision(current.root),
        destinationRoot: join(destination, 'workspace'),
      }),
      /rejects external symlink: a-chained-link/,
    );
  } finally {
    rmSync(destination, { recursive: true, force: true });
    current.cleanup();
  }
});

test('snapshot provisioner rejects same-path dirty content drift from the admitted Build basis', () => {
  const current = createProject('fixture_dirty_basis');
  const destination = mkdtempSync(join(tmpdir(), 'odd-manager-dirty-worksite-'));
  try {
    writeFileSync(join(current.root, 'source.txt'), 'dirty source A\n', 'utf8');
    const admittedRevision = observeProjectRevision(current.root);
    writeFileSync(join(current.root, 'source.txt'), 'dirty source B\n', 'utf8');
    const changedRevision = observeProjectRevision(current.root);
    assert.notEqual(changedRevision.sourceDigest, admittedRevision.sourceDigest);
    assert.throws(
      () => provisionProjectSnapshot({
        projectRoot: current.root,
        projectId: current.project.id,
        revision: admittedRevision,
        destinationRoot: join(destination, 'workspace'),
      }),
      /Project Revision changed before worksite provisioning/,
    );
  } finally {
    rmSync(destination, { recursive: true, force: true });
    current.cleanup();
  }
});

test('snapshot provisioner fingerprints and copies nested source build and dist directories while excluding known generated roots', () => {
  const current = createProject('fixture_nested_source');
  const destination = mkdtempSync(join(tmpdir(), 'odd-manager-nested-source-worksite-'));
  try {
    mkdirSync(join(current.root, 'src', 'build'), { recursive: true });
    mkdirSync(join(current.root, 'src', 'dist'), { recursive: true });
    mkdirSync(join(current.root, 'build'), { recursive: true });
    mkdirSync(join(current.root, 'dist'), { recursive: true });
    mkdirSync(join(current.root, 'build_tenants', 'fixture', 'dist'), { recursive: true });
    mkdirSync(join(current.root, 'build_tenants', 'fixture', 'tests', 'artifacts'), { recursive: true });
    mkdirSync(join(current.root, 'build_tenants', 'fixture', '.ai-workspace', 'runtime'), { recursive: true });
    mkdirSync(join(current.root, 'build_tenants', 'fixture', 'test_runs'), { recursive: true });
    const nestedBuildPath = join(current.root, 'src', 'build', 'tool.ts');
    const nestedDistPath = join(current.root, 'src', 'dist', 'schema.json');
    writeFileSync(nestedBuildPath, 'export const version = 1;\n', 'utf8');
    writeFileSync(nestedDistPath, '{"version":1}\n', 'utf8');
    writeFileSync(join(current.root, 'build', 'generated.js'), 'generated A\n', 'utf8');
    writeFileSync(join(current.root, 'dist', 'bundle.js'), 'bundle A\n', 'utf8');
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', 'dist', 'bundle.js'),
      'tenant bundle A\n',
      'utf8',
    );
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', 'tests', 'artifacts', 'e2e-state.json'),
      '{"runtime":"A"}\n',
      'utf8',
    );
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', '.ai-workspace', 'runtime', 'state.json'),
      '{"runtime":"A"}\n',
      'utf8',
    );
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', 'test_runs', 'result.json'),
      '{"runtime":"A"}\n',
      'utf8',
    );

    const firstRevision = observeProjectRevision(current.root);
    writeFileSync(nestedBuildPath, 'export const version = 2;\n', 'utf8');
    const buildChangedRevision = observeProjectRevision(current.root);
    assert.notEqual(buildChangedRevision.sourceDigest, firstRevision.sourceDigest);
    writeFileSync(nestedDistPath, '{"version":2}\n', 'utf8');
    const distChangedRevision = observeProjectRevision(current.root);
    assert.notEqual(distChangedRevision.sourceDigest, buildChangedRevision.sourceDigest);

    writeFileSync(join(current.root, 'build', 'generated.js'), 'generated B\n', 'utf8');
    writeFileSync(join(current.root, 'dist', 'bundle.js'), 'bundle B\n', 'utf8');
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', 'dist', 'bundle.js'),
      'tenant bundle B\n',
      'utf8',
    );
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', 'tests', 'artifacts', 'e2e-state.json'),
      '{"runtime":"B"}\n',
      'utf8',
    );
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', '.ai-workspace', 'runtime', 'state.json'),
      '{"runtime":"B"}\n',
      'utf8',
    );
    writeFileSync(
      join(current.root, 'build_tenants', 'fixture', 'test_runs', 'result.json'),
      '{"runtime":"B"}\n',
      'utf8',
    );
    const generatedChangedRevision = observeProjectRevision(current.root);
    assert.equal(generatedChangedRevision.sourceDigest, distChangedRevision.sourceDigest);

    const worksiteRoot = join(destination, 'workspace');
    provisionProjectSnapshot({
      projectRoot: current.root,
      projectId: current.project.id,
      revision: generatedChangedRevision,
      destinationRoot: worksiteRoot,
    });
    assert.equal(readFileSync(join(worksiteRoot, 'src', 'build', 'tool.ts'), 'utf8'), 'export const version = 2;\n');
    assert.equal(readFileSync(join(worksiteRoot, 'src', 'dist', 'schema.json'), 'utf8'), '{"version":2}\n');
    assert.equal(existsSync(join(worksiteRoot, 'build')), false);
    assert.equal(existsSync(join(worksiteRoot, 'dist')), false);
    assert.equal(existsSync(join(worksiteRoot, 'build_tenants', 'fixture', 'dist')), false);
    assert.equal(
      existsSync(join(worksiteRoot, 'build_tenants', 'fixture', 'tests', 'artifacts')),
      false,
    );
    assert.equal(
      existsSync(join(worksiteRoot, 'build_tenants', 'fixture', '.ai-workspace', 'runtime')),
      false,
    );
    assert.equal(
      existsSync(join(worksiteRoot, 'build_tenants', 'fixture', 'test_runs')),
      false,
    );
  } finally {
    rmSync(destination, { recursive: true, force: true });
    current.cleanup();
  }
});

test('Project source fingerprint separates carrier kind and persistent-dirty executable semantics', () => {
  const current = createProject('fixture_fingerprint_kind');
  try {
    const carrierPath = join(current.root, 'carrier');
    writeFileSync(carrierPath, 'symlink:foo', 'utf8');
    const regularRevision = observeProjectRevision(current.root);
    unlinkSync(carrierPath);
    symlinkSync('foo', carrierPath);
    const symlinkRevision = observeProjectRevision(current.root);
    assert.notEqual(symlinkRevision.sourceDigest, regularRevision.sourceDigest);

    unlinkSync(carrierPath);
    const executablePath = join(current.root, 'dirty-tool.sh');
    writeFileSync(executablePath, '#!/bin/sh\necho dirty\n', 'utf8');
    chmodSync(executablePath, 0o644);
    const nonExecutableRevision = observeProjectRevision(current.root);
    chmodSync(executablePath, 0o755);
    const executableRevision = observeProjectRevision(current.root);
    assert.equal(nonExecutableRevision.kind, 'worktree');
    assert.equal(executableRevision.kind, 'worktree');
    assert.notEqual(executableRevision.sourceDigest, nonExecutableRevision.sourceDigest);

    const destination = mkdtempSync(join(tmpdir(), 'odd-manager-executable-worksite-'));
    try {
      const worksiteRoot = join(destination, 'workspace');
      provisionProjectSnapshot({
        projectRoot: current.root,
        projectId: current.project.id,
        revision: executableRevision,
        destinationRoot: worksiteRoot,
      });
      assert.notEqual(lstatSync(join(worksiteRoot, 'dirty-tool.sh')).mode & 0o111, 0);
    } finally {
      rmSync(destination, { recursive: true, force: true });
    }
  } finally {
    current.cleanup();
  }
});

test('Project source fingerprint rejects unsupported special-file carriers', () => {
  const current = createProject('fixture_special_file');
  try {
    execFileSync('mkfifo', [join(current.root, 'unsupported.pipe')]);
    assert.throws(
      () => fingerprintProjectSource(current.root),
      /Project source contains unsupported file type: unsupported\.pipe/,
    );
  } finally {
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
