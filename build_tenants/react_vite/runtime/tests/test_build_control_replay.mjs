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
  const descriptorBinding = descriptor(projectRef.id);
  return {
    schemaVersion: '1',
    requestId: `request-${id}`,
    correlationId: `correlation-${id}`,
    project: projectRef,
    revision: basis,
    descriptorBinding,
    adapterBinding: {
      adapterRef: descriptorBinding.executionAdapterRef,
      sourceRefs: [descriptorBinding.executionAdapterRef],
    },
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
    resumedAt: null,
    resumedBy: null,
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
    correlationId: context.commands[0].correlationId,
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
  const request = {
    ...requestRecord('a', projectRef, basis),
    inputs: {
      ...requested.commands[0].inputs,
      assuranceProfile: 'none',
    },
    requestedBy: requested.commands[0].requestedBy,
  };
  assert.notDeepEqual(request.inputs, requested.commands[0].inputs);
  const submittedSnapshot = {
    ...snapshot(projectRef, basis, [execution]),
    requests: [request],
  };
  const incoherentAdmittedInputs = update.updateBuildControl(requested.state, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    correlationId: requested.commands[0].correlationId,
    projectRoot: projectRef.root,
    result: {
      request: { ...request, inputs: { forged: true } },
      execution,
      snapshot: submittedSnapshot,
    },
  });
  assert.strictEqual(incoherentAdmittedInputs.state, requested.state);

  const incoherentSubmittedSnapshot = update.updateBuildControl(requested.state, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    correlationId: requested.commands[0].correlationId,
    projectRoot: projectRef.root,
    result: {
      request,
      execution,
      snapshot: {
        ...submittedSnapshot,
        requests: [{ ...request, correlationId: 'correlation-forged' }],
      },
    },
  });
  assert.strictEqual(incoherentSubmittedSnapshot.state, requested.state);
  const incoherentScheduler = update.updateBuildControl(requested.state, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    correlationId: requested.commands[0].correlationId,
    projectRoot: projectRef.root,
    result: {
      request,
      execution,
      snapshot: {
        ...submittedSnapshot,
        scheduler: { ...submittedSnapshot.scheduler, runningCount: 0, availableSlots: 2 },
      },
    },
  });
  assert.strictEqual(incoherentScheduler.state, requested.state);
  const reusedSubmitIdentityState = { ...requested.state, snapshot: submittedSnapshot };
  const reusedSubmitIdentity = update.updateBuildControl(reusedSubmitIdentityState, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    correlationId: requested.commands[0].correlationId,
    projectRoot: projectRef.root,
    result: { request, execution, snapshot: submittedSnapshot },
  });
  assert.strictEqual(reusedSubmitIdentity.state, reusedSubmitIdentityState);

  const submitted = update.updateBuildControl(requested.state, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    correlationId: requested.commands[0].correlationId,
    projectRoot: projectRef.root,
    result: { request, execution, snapshot: submittedSnapshot },
  });
  assert.equal(submitted.state.selectedExecutionId, execution.executionId);
  assert.deepEqual(submitted.state.snapshot.requests[0].inputs, {
    durationMs: 100,
    outcome: 'converged',
    label: 'a',
    assuranceProfile: 'none',
  });
  assert.equal(submitted.commands[0].type, 'build.attach');
  assert.equal(submitted.commands[0].executionId, execution.executionId);

  const attachment = {
    schemaVersion: '1',
    execution,
    output: {
      schemaVersion: '1', executionId: execution.executionId,
      stdout: 'running\n', stderr: '', stdoutTruncated: false, stderrTruncated: false,
      observedAt: '2026-07-11T00:01:03.000Z', sourceRefs: ['stdout', 'stderr'],
    },
    sourceRefs: [`build-execution://${execution.executionId}`],
  };
  const wrongAttachmentOutput = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    correlationId: submitted.commands[0].correlationId,
    projectRoot: projectRef.root,
    attached: {
      ...attachment,
      output: { ...attachment.output, executionId: 'execution-forged' },
    },
  });
  assert.strictEqual(wrongAttachmentOutput.state, submitted.state);
  const wrongAttachmentIdentity = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    correlationId: submitted.commands[0].correlationId,
    projectRoot: projectRef.root,
    attached: {
      ...attachment,
      execution: { ...execution, worksiteRef: 'worksite://forged' },
    },
  });
  assert.strictEqual(wrongAttachmentIdentity.state, submitted.state);
  const malformedAttachmentTimestamp = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    correlationId: submitted.commands[0].correlationId,
    projectRoot: projectRef.root,
    attached: {
      ...attachment,
      output: { ...attachment.output, observedAt: 'not-a-timestamp' },
    },
  });
  assert.strictEqual(malformedAttachmentTimestamp.state, submitted.state);
  const staleAttachment = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    correlationId: submitted.commands[0].correlationId,
    projectRoot: projectRef.root,
    attached: {
      ...attachment,
      execution: {
        ...execution,
        updatedAt: '2026-07-11T00:00:00.000Z',
        heartbeatAt: '2026-07-11T00:00:00.000Z',
      },
    },
  });
  assert.strictEqual(staleAttachment.state, submitted.state);

  const attached = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    correlationId: submitted.commands[0].correlationId,
    projectRoot: projectRef.root,
    attached: attachment,
  }).state;
  assert.equal(attached.attached.output.stdout, 'running\n');

  const pollRefresh = update.updateBuildControl(attached, {
    type: 'build/poll-ticked',
  });
  assert.equal(pollRefresh.commands.length, 1);
  assert.equal(pollRefresh.commands[0].type, 'build.load');
  const coalescedPollRefresh = update.updateBuildControl(pollRefresh.state, {
    type: 'build/poll-ticked',
  });
  assert.strictEqual(coalescedPollRefresh.state, pollRefresh.state);
  assert.deepEqual(coalescedPollRefresh.commands, []);
  assert.equal(coalescedPollRefresh.state.refreshQueued, false);

  const manualBehindPoll = update.updateBuildControl(pollRefresh.state, {
    type: 'build/refresh-requested',
  });
  assert.deepEqual(manualBehindPoll.commands, []);
  assert.equal(manualBehindPoll.state.refreshQueued, true);
  assert.equal(
    manualBehindPoll.state.pendingCommands.filter(
      (command) => command.type === 'build.load',
    ).length,
    1,
  );
  const supersededPollSnapshot = {
    ...pollRefresh.state.snapshot,
    observedAt: '2026-07-11T00:02:00.000Z',
  };
  const manualFollowUp = update.updateBuildControl(manualBehindPoll.state, {
    type: 'build/snapshot-loaded',
    commandId: pollRefresh.commands[0].commandId,
    correlationId: pollRefresh.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: supersededPollSnapshot,
  });
  assert.equal(manualFollowUp.commands.length, 1);
  assert.equal(manualFollowUp.commands[0].type, 'build.load');
  assert.notEqual(manualFollowUp.commands[0].commandId, pollRefresh.commands[0].commandId);
  assert.strictEqual(manualFollowUp.state.snapshot, pollRefresh.state.snapshot);
  assert.equal(manualFollowUp.state.refreshQueued, false);

  const manualFollowUpAfterFailure = update.updateBuildControl(manualBehindPoll.state, {
    type: 'build/command-failed',
    commandId: pollRefresh.commands[0].commandId,
    correlationId: pollRefresh.commands[0].correlationId,
    error: 'superseded poll failed',
    execution: null,
  });
  assert.equal(manualFollowUpAfterFailure.commands.length, 1);
  assert.equal(manualFollowUpAfterFailure.commands[0].type, 'build.load');
  assert.notEqual(
    manualFollowUpAfterFailure.commands[0].commandId,
    pollRefresh.commands[0].commandId,
  );
  assert.equal(manualFollowUpAfterFailure.state.refreshQueued, false);

  const refresh = update.updateBuildControl(attached, {
    type: 'build/refresh-requested',
  });
  const historyDeletingRefresh = update.updateBuildControl(refresh.state, {
    type: 'build/snapshot-loaded',
    commandId: refresh.commands[0].commandId,
    correlationId: refresh.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: {
      ...snapshot(projectRef, basis),
      observedAt: '2026-07-11T00:02:00.000Z',
    },
  });
  assert.strictEqual(historyDeletingRefresh.state, refresh.state);

  const cancel = update.updateBuildControl(attached, {
    type: 'build/cancel-requested', actorRef: 'actor://operator/test',
  });
  assert.equal(cancel.commands[0].type, 'build.cancel');
  assert.equal(cancel.commands[0].executionId, execution.executionId);

  const cancelCommand = cancel.commands[0];
  const crossProjectFailure = update.updateBuildControl(cancel.state, {
    type: 'build/command-failed',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    error: 'cross-Project execution',
    execution: {
      ...execution,
      project: project('project-b'),
    },
  });
  assert.strictEqual(crossProjectFailure.state, cancel.state);

  const wrongBasisFailure = update.updateBuildControl(cancel.state, {
    type: 'build/command-failed',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    error: 'wrong execution basis',
    execution: {
      ...execution,
      revision: revision('b'),
    },
  });
  assert.strictEqual(wrongBasisFailure.state, cancel.state);

  const wrongExecutionFailure = update.updateBuildControl(cancel.state, {
    type: 'build/command-failed',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    error: 'wrong execution identity',
    execution: executionRecord('other', projectRef, basis),
  });
  assert.strictEqual(wrongExecutionFailure.state, cancel.state);

  const authorityIncreasingFailure = update.updateBuildControl(cancel.state, {
    type: 'build/command-failed',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    error: 'forged convergence',
    execution: {
      ...execution,
      state: 'converged',
      completedAt: '2026-07-11T00:01:04.000Z',
      heartbeatAt: '2026-07-11T00:01:04.000Z',
      processOutcome: {
        kind: 'typed_result',
        exitCode: 0,
        signal: null,
        terminalResult: {
          kind: 'converged',
          resultRef: 'result://forged',
          detail: 'forged',
          runRefs: [],
          sourceRefs: ['fixture://forged'],
        },
        stdoutRef: 'stdout://forged',
        stderrRef: 'stderr://forged',
        observedAt: '2026-07-11T00:01:04.000Z',
      },
    },
  });
  assert.strictEqual(authorityIncreasingFailure.state, cancel.state);

  const wrongCancelledSuccess = update.updateBuildControl(cancel.state, {
    type: 'build/cancelled',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    projectRoot: projectRef.root,
    execution: { ...execution, requestId: 'request-forged' },
  });
  assert.strictEqual(wrongCancelledSuccess.state, cancel.state);

  const admittedCancelFailure = update.updateBuildControl(cancel.state, {
    type: 'build/command-failed',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    error: 'adapter refused cancellation',
    execution: {
      ...execution,
      updatedAt: '2026-07-11T00:01:04.000Z',
      heartbeatAt: '2026-07-11T00:01:04.000Z',
      cancelRequestedAt: '2026-07-11T00:01:04.000Z',
      cancelledBy: 'actor://operator/test',
    },
  });
  assert.equal(admittedCancelFailure.state.status, 'error');
  assert.equal(admittedCancelFailure.state.error, 'adapter refused cancellation');
  assert.equal(
    admittedCancelFailure.state.snapshot.executions[0].cancelRequestedAt,
    '2026-07-11T00:01:04.000Z',
  );

  const acknowledgedCancellation = update.updateBuildControl(cancel.state, {
    type: 'build/cancellation-acknowledged',
    commandId: cancelCommand.commandId,
    correlationId: cancelCommand.correlationId,
    projectRoot: projectRef.root,
    execution: {
      ...execution,
      updatedAt: '2026-07-11T00:01:04.000Z',
      heartbeatAt: '2026-07-11T00:01:04.000Z',
      cancelRequestedAt: '2026-07-11T00:01:04.000Z',
      cancelledBy: 'actor://operator/test',
    },
  });
  assert.equal(acknowledgedCancellation.state.status, 'ready');
  assert.equal(
    acknowledgedCancellation.state.snapshot.executions[0].cancelledBy,
    'actor://operator/test',
  );
  assert.deepEqual(
    acknowledgedCancellation.commands.map((command) => command.type),
    ['build.load'],
  );

  const cancelBehindPoll = update.updateBuildControl(pollRefresh.state, {
    type: 'build/cancel-requested',
    actorRef: 'actor://operator/test',
  });
  const cancelBehindPollCommand = cancelBehindPoll.commands[0];
  assert.equal(cancelBehindPollCommand.type, 'build.cancel');
  const acknowledgedBehindPoll = update.updateBuildControl(cancelBehindPoll.state, {
    type: 'build/cancellation-acknowledged',
    commandId: cancelBehindPollCommand.commandId,
    correlationId: cancelBehindPollCommand.correlationId,
    projectRoot: projectRef.root,
    execution: {
      ...execution,
      updatedAt: '2026-07-11T00:01:04.000Z',
      heartbeatAt: '2026-07-11T00:01:04.000Z',
      cancelRequestedAt: '2026-07-11T00:01:04.000Z',
      cancelledBy: 'actor://operator/test',
    },
  });
  assert.deepEqual(acknowledgedBehindPoll.commands, []);
  assert.equal(acknowledgedBehindPoll.state.refreshQueued, true);
  assert.equal(
    acknowledgedBehindPoll.state.pendingCommands.filter(
      (command) => command.type === 'build.load',
    ).length,
    1,
  );
  assert.equal(
    acknowledgedBehindPoll.state.pendingCommands.some(
      (command) => command.commandId === cancelBehindPollCommand.commandId,
    ),
    false,
  );
});

test('Build execution command authority is selected from the immutable request descriptor', async () => {
  const selectors = await loadTypeScriptModule('capabilities/build-control/selectors.ts');
  const projectRef = project('project-bound-command');
  const basis = revision('b');
  const request = requestRecord('bound-command', projectRef, basis);
  request.descriptorBinding = {
    ...request.descriptorBinding,
    supportedCommands: ['submit', 'attach', 'cancel', 'resume'],
  };
  const stale = executionRecord('bound-command', projectRef, basis, 'stale');
  assert.deepEqual(
    selectors.buildExecutionCommandAvailability(stale, request),
    { canCancel: true, canResume: true },
  );
  assert.deepEqual(
    selectors.buildExecutionCommandAvailability(stale, {
      ...request,
      descriptorBinding: {
        ...request.descriptorBinding,
        supportedCommands: ['submit', 'attach'],
      },
    }),
    { canCancel: false, canResume: false },
  );
});

test('Build auto-attach admits the one queued-to-running process identity transition', async () => {
  const update = await loadTypeScriptModule('capabilities/build-control/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-control/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const loading = update.updateBuildControl(stateModule.createBuildControlState(), {
    type: 'build/context-changed', project: projectRef, revision: basis,
  });
  const ready = update.updateBuildControl(loading.state, {
    type: 'build/snapshot-loaded',
    commandId: loading.commands[0].commandId,
    correlationId: loading.commands[0].correlationId,
    projectRoot: projectRef.root,
    snapshot: snapshot(projectRef, basis),
  }).state;
  const requested = update.replayBuildControlMessages(ready, [
    { type: 'build/input-edited', value: '{"label":"queued"}' },
    { type: 'build/submit-requested', actorRef: 'actor://operator/test' },
  ]);
  const queued = executionRecord('queued', projectRef, basis, 'queued');
  const request = {
    ...requestRecord('queued', projectRef, basis),
    inputs: requested.commands[0].inputs,
    requestedBy: requested.commands[0].requestedBy,
  };
  const queuedSnapshot = {
    ...snapshot(projectRef, basis, [queued]),
    requests: [request],
    scheduler: {
      maxConcurrent: 2,
      maxQueued: 10,
      runningCount: 0,
      queuedCount: 1,
      availableSlots: 2,
    },
  };
  const submitted = update.updateBuildControl(requested.state, {
    type: 'build/submitted',
    commandId: requested.commands[0].commandId,
    correlationId: requested.commands[0].correlationId,
    projectRoot: projectRef.root,
    result: { request, execution: queued, snapshot: queuedSnapshot },
  });
  assert.equal(submitted.commands[0].type, 'build.attach');
  const running = {
    ...queued,
    state: 'running',
    queuePosition: null,
    processRef: 'process://local/queued',
    startedAt: '2026-07-11T00:01:03.000Z',
    updatedAt: '2026-07-11T00:01:03.000Z',
    heartbeatAt: '2026-07-11T00:01:03.000Z',
  };
  const attached = update.updateBuildControl(submitted.state, {
    type: 'build/attached',
    commandId: submitted.commands[0].commandId,
    correlationId: submitted.commands[0].correlationId,
    projectRoot: projectRef.root,
    attached: {
      schemaVersion: '1',
      execution: running,
      output: {
        schemaVersion: '1',
        executionId: running.executionId,
        stdout: '',
        stderr: '',
        stdoutTruncated: false,
        stderrTruncated: false,
        observedAt: '2026-07-11T00:01:03.000Z',
        sourceRefs: ['stdout', 'stderr'],
      },
      sourceRefs: [`build-execution://${running.executionId}`],
    },
  });
  assert.equal(attached.state.attached.execution.state, 'running');
  assert.equal(attached.state.attached.execution.processRef, 'process://local/queued');
  assert.equal(attached.state.pendingCommands.length, 0);
});

test('Build replay rejects late cross-Project results and blocks stale-basis submission', async () => {
  const update = await loadTypeScriptModule('capabilities/build-control/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-control/state.ts');
  const projectA = project('project-a');
  const projectB = project('project-b');
  const basisA = revision('a');
  const basisB = revision('b');
  const sameRootDifferentIdentity = update.updateBuildControl({
    ...stateModule.createBuildControlState(),
    status: 'ready',
    project: projectA,
    basisRevision: basisA,
    snapshot: snapshot(projectA, basisA),
    selectedExecutionId: null,
  }, {
    type: 'build/context-changed',
    project: { ...projectA, id: 'project-a-replaced', label: 'replacement' },
    revision: basisA,
  });
  assert.equal(sameRootDifferentIdentity.state.snapshot, null);
  assert.equal(sameRootDifferentIdentity.commands[0].type, 'build.load');

  const contextA = update.updateBuildControl(stateModule.createBuildControlState(), {
    type: 'build/context-changed', project: projectA, revision: basisA,
  });
  const contextB = update.updateBuildControl(contextA.state, {
    type: 'build/context-changed', project: projectB, revision: basisB,
  });
  const globalSchedulerSnapshot = {
    ...snapshot(projectB, basisB),
    scheduler: {
      maxConcurrent: 2,
      maxQueued: 10,
      runningCount: 1,
      queuedCount: 0,
      availableSlots: 1,
    },
  };
  const projectBWithProjectARunning = update.updateBuildControl(contextB.state, {
    type: 'build/snapshot-loaded',
    commandId: contextB.commands[0].commandId,
    correlationId: contextB.commands[0].correlationId,
    projectRoot: projectB.root,
    snapshot: globalSchedulerSnapshot,
  });
  assert.equal(projectBWithProjectARunning.state.status, 'ready');
  assert.equal(projectBWithProjectARunning.state.snapshot.executions.length, 0);
  assert.equal(projectBWithProjectARunning.state.snapshot.scheduler.runningCount, 1);
  const late = update.updateBuildControl(contextB.state, {
    type: 'build/snapshot-loaded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
    projectRoot: projectA.root,
    snapshot: snapshot(projectA, basisA),
  });
  assert.equal(late.state.project.root, projectB.root);
  assert.equal(late.state.snapshot, null);

  const crossProjectNested = update.updateBuildControl(contextB.state, {
    type: 'build/snapshot-loaded',
    commandId: contextB.commands[0].commandId,
    correlationId: contextB.commands[0].correlationId,
    projectRoot: projectB.root,
    snapshot: snapshot(projectB, basisB, [
      executionRecord('cross', projectA, basisB),
    ]),
  });
  assert.strictEqual(crossProjectNested.state, contextB.state);

  const stale = update.updateBuildControl(contextB.state, {
    type: 'build/snapshot-loaded',
    commandId: contextB.commands[0].commandId,
    correlationId: contextB.commands[0].correlationId,
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
    resumedAt: '2026-07-11T00:02:00.000Z',
    resumedBy: 'actor://operator/test',
  };
  const terminalResume = update.updateBuildControl(request.state, {
    type: 'build/resumed',
    commandId: request.commands[0].commandId,
    correlationId: request.commands[0].correlationId,
    projectRoot: projectRef.root,
    execution: {
      ...running,
      state: 'converged',
      completedAt: '2026-07-11T00:02:01.000Z',
      processOutcome: {
        kind: 'typed_result',
        exitCode: 0,
        signal: null,
        terminalResult: {
          kind: 'converged',
          resultRef: 'result://resume',
          detail: 'already complete',
          runRefs: [],
          sourceRefs: ['fixture://resume'],
        },
        stdoutRef: 'stdout://resume',
        stderrRef: 'stderr://resume',
        observedAt: '2026-07-11T00:02:01.000Z',
      },
    },
  });
  assert.strictEqual(terminalResume.state, request.state);
  const wrongResumeIdentity = update.updateBuildControl(request.state, {
    type: 'build/resumed',
    commandId: request.commands[0].commandId,
    correlationId: request.commands[0].correlationId,
    projectRoot: projectRef.root,
    execution: { ...running, correlationId: 'correlation-forged' },
  });
  assert.strictEqual(wrongResumeIdentity.state, request.state);
  const resumed = update.updateBuildControl(request.state, {
    type: 'build/resumed',
    commandId: request.commands[0].commandId,
    correlationId: request.commands[0].correlationId,
    projectRoot: projectRef.root,
    execution: running,
  });
  assert.equal(resumed.state.snapshot.executions[0].executionId, disconnected.executionId);
  assert.equal(resumed.state.snapshot.executions[0].state, 'running');
  assert.equal(resumed.commands[0].type, 'build.attach');
});
