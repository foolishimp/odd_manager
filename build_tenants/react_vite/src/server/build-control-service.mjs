import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAttachResponseSchema,
  buildControlSnapshotSchema,
  buildExecutionObservationSchema,
  buildExecutionIdentityRequestSchema,
  buildExecutionSchema,
  buildEvidenceBundleSchema,
  buildExternalCancelResultSchema,
  buildInternalProcessPlanSchema,
  buildOutputTailSchema,
  buildRequestSchema,
  buildSubmitRequestSchema,
  buildTerminalResultSchema,
  jsonValueSchema,
} from '@odd-manager/developer-control-contracts';
import {
  FIXTURE_EXECUTION_ADAPTER_REF,
  loadBuildCarrierDescriptor,
  PROJECT_SNAPSHOT_PROVISIONER_REF,
} from './build-carrier-descriptor-service.mjs';
import { provisionProjectSnapshot } from './build-worksite-provisioner.mjs';
import {
  observeProjectRevision,
  sameProjectRevisionBasis,
} from './project-revision-service.mjs';

const serverDir = dirname(fileURLToPath(import.meta.url));
const fixtureWorkerPath = join(serverDir, 'build-fixture-worker.mjs');
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_MAX_QUEUED = 100;
const DEFAULT_OUTPUT_TAIL_BYTES = 64 * 1024;
const DEFAULT_RECOVERY_DISCONNECT_MS = 1_500;
const TERMINAL_STATES = new Set(['converged', 'failed', 'cancelled']);
const SLOT_STATES = new Set(['starting', 'running']);
const RECOVERED_STALE_REF = 'supervisor://odd_manager/recovered-stale';
const RECOVERED_GATED_LAUNCH_REF = 'supervisor://odd_manager/recovered-gated-launch-abort';
const PROCESS_LAUNCH_GATE_REF = 'supervisor://odd_manager/process-launch-gate/v1';
const PROCESS_LAUNCH_GATE_SCRIPT = [
  'IFS= read -r odd_manager_launch_token || exit 125',
  '[ "$odd_manager_launch_token" = "$1" ] || exit 126',
  'shift',
  'exec "$@"',
].join('; ');

export class BuildControlError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'BuildControlError';
    this.statusCode = options.statusCode ?? 400;
    this.execution = options.execution ?? null;
  }
}

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function projectStoreId(projectRoot) {
  return Buffer.from(resolve(projectRoot)).toString('base64url');
}

function isPathWithin(root, candidate) {
  const value = relative(resolve(root), resolve(candidate));
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function normalizedAdapterSourceRefs(adapter) {
  const refs = Array.isArray(adapter?.sourceRefs) && adapter.sourceRefs.length > 0
    ? adapter.sourceRefs
    : [adapter?.adapterRef];
  return [...new Set(refs.filter((entry) => typeof entry === 'string' && entry.length > 0))].sort();
}

function adapterBindingFor(adapter) {
  return {
    adapterRef: adapter.adapterRef,
    sourceRefs: normalizedAdapterSourceRefs(adapter),
  };
}

function adapterMatchesBinding(adapter, binding) {
  return Boolean(
    adapter
    && adapter.adapterRef === binding.adapterRef
    && JSON.stringify(normalizedAdapterSourceRefs(adapter)) === JSON.stringify(binding.sourceRefs),
  );
}

function validateInternalProcessPlan(value, paths, adapter) {
  const plan = buildInternalProcessPlanSchema.parse(value);
  if (!isAbsolute(plan.executable)) {
    throw new Error('Execution adapter process executable must be an absolute server-installed path.');
  }
  if (!isAbsolute(plan.cwd)) {
    throw new Error('Execution adapter process cwd must be absolute.');
  }
  let realWorksitePath;
  let realCwd;
  try {
    realWorksitePath = realpathSync(paths.worksitePath);
    realCwd = realpathSync(plan.cwd);
  } catch {
    throw new Error('Execution adapter process cwd must resolve inside the minted worksite.');
  }
  if (!isPathWithin(realWorksitePath, realCwd)) {
    throw new Error('Execution adapter process cwd must remain inside the minted worksite.');
  }
  if (resolve(plan.resultPath) !== resolve(paths.resultPath)) {
    throw new Error('Execution adapter terminal result must use the manager-minted result path.');
  }
  return {
    ...plan,
    adapterSourceRefs: [
      ...new Set([
        ...(adapter.sourceRefs ?? []),
        ...plan.adapterSourceRefs,
      ]),
    ],
  };
}

function readTail(path, maxBytes) {
  if (!existsSync(path)) return { value: '', truncated: false };
  const size = statSync(path).size;
  const content = readFileSync(path);
  const start = Math.max(0, content.byteLength - maxBytes);
  return {
    value: content.subarray(start).toString('utf8'),
    truncated: start > 0 || size > maxBytes,
  };
}

function validateStore(value) {
  if (!value || value.schemaVersion !== '1') throw new Error('unsupported build-control store version');
  if (!Array.isArray(value.requests) || !Array.isArray(value.executions)) {
    throw new Error('build-control store requests and executions must be arrays');
  }
  const admitted = {
    schemaVersion: '1',
    requests: value.requests.map((entry) => buildRequestSchema.parse(entry)),
    executions: value.executions.map((entry) => buildExecutionSchema.parse(entry)),
  };
  const requestById = new Map();
  const requestCorrelationIds = new Set();
  for (const request of admitted.requests) {
    if (requestById.has(request.requestId)) {
      throw new Error(`duplicate Build Request identity: ${request.requestId}`);
    }
    if (requestCorrelationIds.has(request.correlationId)) {
      throw new Error(`duplicate Build Request correlation identity: ${request.correlationId}`);
    }
    requestById.set(request.requestId, request);
    requestCorrelationIds.add(request.correlationId);
  }

  const executionIds = new Set();
  const executionCorrelationIds = new Set();
  const executionCountByRequest = new Map();
  for (const execution of admitted.executions) {
    if (executionIds.has(execution.executionId)) {
      throw new Error(`duplicate Build Execution identity: ${execution.executionId}`);
    }
    if (executionCorrelationIds.has(execution.correlationId)) {
      throw new Error(`duplicate Build Execution correlation identity: ${execution.correlationId}`);
    }
    executionIds.add(execution.executionId);
    executionCorrelationIds.add(execution.correlationId);
    const request = requestById.get(execution.requestId);
    if (!request) {
      throw new Error(
        `Build Execution ${execution.executionId} references missing Build Request ${execution.requestId}`,
      );
    }
    if (execution.correlationId !== request.correlationId) {
      throw new Error(
        `Build Execution ${execution.executionId} correlation does not match Build Request ${request.requestId}`,
      );
    }
    if (JSON.stringify(execution.project) !== JSON.stringify(request.project)) {
      throw new Error(
        `Build Execution ${execution.executionId} Project does not match Build Request ${request.requestId}`,
      );
    }
    if (JSON.stringify(execution.revision) !== JSON.stringify(request.revision)) {
      throw new Error(
        `Build Execution ${execution.executionId} Project Revision does not match Build Request ${request.requestId}`,
      );
    }
    executionCountByRequest.set(
      request.requestId,
      (executionCountByRequest.get(request.requestId) ?? 0) + 1,
    );
  }

  for (const request of admitted.requests) {
    if (executionCountByRequest.get(request.requestId) !== 1) {
      throw new Error(`Build Request ${request.requestId} must relate to exactly one Build Execution`);
    }
    if (
      executionIds.has(request.requestId)
      || requestCorrelationIds.has(request.requestId)
      || executionIds.has(request.correlationId)
    ) {
      throw new Error(`Build Request ${request.requestId} reuses a request, execution, or correlation identity`);
    }
  }
  return admitted;
}

function validateFixtureInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BuildControlError('Fixture carrier inputs must be an object.');
  }
  const allowed = new Set(['durationMs', 'outcome', 'label', 'assuranceProfile']);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new BuildControlError(`Fixture carrier inputs contain unsupported fields: ${unknown.join(', ')}.`);
  }
  const durationMs = Number(value.durationMs ?? 500);
  const outcome = String(value.outcome ?? 'converged');
  const label = String(value.label ?? 'build');
  const assuranceProfile = String(value.assuranceProfile ?? 'none');
  if (!Number.isInteger(durationMs) || durationMs < 25 || durationMs > 30_000) {
    throw new BuildControlError('Fixture durationMs must be an integer from 25 through 30000.');
  }
  if (!['converged', 'failed', 'waiting_human'].includes(outcome)) {
    throw new BuildControlError('Fixture outcome must be converged, failed, or waiting_human.');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(label)) {
    throw new BuildControlError('Fixture label must be a bounded portable identifier.');
  }
  if (!['none', 'complete', 'partial', 'fd_fail_waiting_human', 'proof_mismatch', 'revision_mismatch'].includes(assuranceProfile)) {
    throw new BuildControlError('Fixture assuranceProfile is unsupported.');
  }
  return { durationMs, outcome, label, assuranceProfile };
}

function createFixtureAdapter() {
  return {
    adapterRef: FIXTURE_EXECUTION_ADAPTER_REF,
    sourceRefs: [FIXTURE_EXECUTION_ADAPTER_REF],
    validateInputs: validateFixtureInput,
    createProcessPlan({ request, execution, paths }) {
      const input = validateFixtureInput(request.inputs);
      const workerInput = {
        ...input,
        executionId: execution.executionId,
        projectRoot: request.project.root,
        revision: request.revision,
      };
      return {
        executable: process.execPath,
        args: [
          fixtureWorkerPath,
          Buffer.from(JSON.stringify(workerInput)).toString('base64url'),
          paths.resultPath,
          paths.evidenceBundlePath,
          paths.evidenceRoot,
        ],
        cwd: paths.worksitePath,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          TMPDIR: process.env.TMPDIR ?? '',
        },
        resultPath: paths.resultPath,
        adapterSourceRefs: [FIXTURE_EXECUTION_ADAPTER_REF, `fixture-input://${input.label}`],
      };
    },
  };
}

export function createBuildControlService(options) {
  if (!options?.managerStateRoot) throw new Error('managerStateRoot is required');
  const managerStateRoot = resolve(options.managerStateRoot);
  const maxConcurrent = Number(options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT);
  const maxQueued = Number(options.maxQueued ?? DEFAULT_MAX_QUEUED);
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new Error('maxConcurrent must be positive');
  if (!Number.isInteger(maxQueued) || maxQueued < 1) throw new Error('maxQueued must be positive');
  const now = options.now ?? (() => new Date().toISOString());
  const idFactory = options.idFactory ?? ((kind) => `${kind}-${randomUUID()}`);
  const spawnProcess = options.spawnProcess ?? spawn;
  const afterSpawnBeforeRunningPersist = options.afterSpawnBeforeRunningPersist ?? (() => true);
  const beforeStoreCommit = options.beforeStoreCommit ?? (() => {});
  const outputTailBytes = Number(options.outputTailBytes ?? DEFAULT_OUTPUT_TAIL_BYTES);
  const recoveryDisconnectMs = Number(options.recoveryDisconnectMs ?? DEFAULT_RECOVERY_DISCONNECT_MS);
  if (!Number.isFinite(recoveryDisconnectMs) || recoveryDisconnectMs < 0) {
    throw new Error('recoveryDisconnectMs must be non-negative');
  }
  const storeRoot = join(managerStateRoot, '.ai-workspace', 'runtime', 'developer-control', 'build-control');
  const storePath = join(storeRoot, 'state.json');
  const worksiteRoot = join(managerStateRoot, '.ai-workspace', 'runtime', 'developer-control', 'build-worksites');
  const executionRoot = join(storeRoot, 'executions');
  mkdirSync(storeRoot, { recursive: true });
  mkdirSync(worksiteRoot, { recursive: true });
  mkdirSync(executionRoot, { recursive: true });

  const provisioners = new Map([
    [PROJECT_SNAPSHOT_PROVISIONER_REF, provisionProjectSnapshot],
    ...(options.provisioners ? [...options.provisioners.entries()] : []),
  ]);
  const adapters = new Map(options.adapters ? [...options.adapters.entries()] : []);
  if (options.fixtureMode === true) adapters.set(FIXTURE_EXECUTION_ADAPTER_REF, createFixtureAdapter());
  const children = new Map();
  let pumpScheduled = false;
  let store = loadStore();

  function loadStore() {
    if (!existsSync(storePath)) return { schemaVersion: '1', requests: [], executions: [] };
    try {
      return validateStore(JSON.parse(readFileSync(storePath, 'utf8')));
    } catch (error) {
      throw new BuildControlError(`build-control store is invalid: ${errorDetail(error)}`, { statusCode: 500 });
    }
  }

  function writeStore(candidateStore = store) {
    const normalized = normalizeQueuePositions(candidateStore);
    const admitted = validateStore(normalized);
    mkdirSync(storeRoot, { recursive: true });
    const temporaryPath = `${storePath}.${process.pid}.${randomUUID()}.tmp`;
    let temporaryDescriptor = null;
    try {
      temporaryDescriptor = openSync(temporaryPath, 'wx', 0o600);
      writeFileSync(temporaryDescriptor, `${JSON.stringify(admitted, null, 2)}\n`, 'utf8');
      fsyncSync(temporaryDescriptor);
      closeSync(temporaryDescriptor);
      temporaryDescriptor = null;
      beforeStoreCommit(Object.freeze({
        storePath,
        temporaryPath,
        store: admitted,
      }));
      renameSync(temporaryPath, storePath);
      const directoryDescriptor = openSync(storeRoot, 'r');
      try {
        fsyncSync(directoryDescriptor);
      } finally {
        closeSync(directoryDescriptor);
      }
      store = admitted;
      return admitted;
    } catch (error) {
      if (temporaryDescriptor !== null) {
        try {
          closeSync(temporaryDescriptor);
        } catch {
          // Preserve the original durable-store failure.
        }
      }
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  function normalizeQueuePositions(candidateStore) {
    let position = 0;
    let queueObservedAt = null;
    const withQueuePosition = (execution, queuePosition) => {
      if (execution.queuePosition === queuePosition) return execution;
      queueObservedAt ??= now();
      const previousTime = Date.parse(execution.updatedAt);
      const observedTime = Date.parse(queueObservedAt);
      const updatedAt = new Date(Math.max(observedTime, previousTime + 1)).toISOString();
      return { ...execution, queuePosition, updatedAt };
    };
    const executions = candidateStore.executions.map((execution) => {
      if (execution.state !== 'queued') {
        return withQueuePosition(execution, null);
      }
      const next = withQueuePosition(execution, position);
      position += 1;
      return next;
    });
    return { ...candidateStore, executions };
  }

  function replaceExecution(next) {
    const admitted = buildExecutionSchema.parse(next);
    const committed = writeStore({
      ...store,
      executions: store.executions.map((entry) => (
        entry.executionId === admitted.executionId ? admitted : entry
      )),
    });
    return committed.executions.find((entry) => entry.executionId === admitted.executionId);
  }

  function executionPaths(executionId) {
    const root = join(executionRoot, executionId);
    return {
      root,
      stdoutPath: join(root, 'stdout.log'),
      stderrPath: join(root, 'stderr.log'),
      resultPath: join(root, 'terminal-result.json'),
      evidenceBundlePath: join(root, 'assurance-evidence.json'),
      evidenceRoot: join(root, 'evidence'),
      worksitePath: join(worksiteRoot, executionId, 'workspace'),
    };
  }

  function outputRefs(executionId) {
    return {
      stdoutRef: `build-output://${executionId}/stdout`,
      stderrRef: `build-output://${executionId}/stderr`,
    };
  }

  function applyExecutionObservation(execution, adapter, observation, observedAt) {
    const hasTypedOutcome = Boolean(observation.terminalResult);
    return replaceExecution({
      ...execution,
      state: observation.state,
      processRef: observation.processRef ?? execution.processRef,
      runRefs: observation.runRefs,
      updatedAt: observedAt,
      completedAt: hasTypedOutcome ? observedAt : null,
      heartbeatAt: observation.heartbeatAt,
      processOutcome: hasTypedOutcome ? {
        kind: 'adapter_observation',
        exitCode: null,
        signal: null,
        terminalResult: observation.terminalResult,
        ...outputRefs(execution.executionId),
        observedAt,
      } : null,
      sourceRefs: [...new Set([
        ...execution.sourceRefs,
        ...(adapter.sourceRefs ?? []),
        ...observation.sourceRefs,
        'supervisor://odd_manager/resumed-by-adapter',
      ])],
    });
  }

  function persistCancelIntent(execution, actorRef, observedAt) {
    if (execution.cancelRequestedAt !== null) {
      if (execution.cancelledBy !== actorRef) {
        throw new BuildControlError(
          `Build cancellation is already attributed to ${execution.cancelledBy}.`,
          { statusCode: 409, execution },
        );
      }
      return execution;
    }
    return replaceExecution({
      ...execution,
      updatedAt: observedAt,
      cancelRequestedAt: observedAt,
      cancelledBy: actorRef,
    });
  }

  function schedulerProjection() {
    const runningCount = store.executions.filter((entry) => SLOT_STATES.has(entry.state)).length;
    const queuedCount = store.executions.filter((entry) => entry.state === 'queued').length;
    return {
      maxConcurrent,
      maxQueued,
      runningCount,
      queuedCount,
      availableSlots: Math.max(0, maxConcurrent - runningCount),
    };
  }

  function descriptorAdmission(project) {
    return loadBuildCarrierDescriptor(project, {
      provisionerRefs: new Set(provisioners.keys()),
      adapterRefs: new Set(adapters.keys()),
    });
  }

  function adapterForRequest(request) {
    const adapter = adapters.get(request.adapterBinding.adapterRef) ?? null;
    return adapterMatchesBinding(adapter, request.adapterBinding) ? adapter : null;
  }

  function requestForExecution(execution) {
    const request = store.requests.find((entry) => entry.requestId === execution.requestId) ?? null;
    if (!request) throw new BuildControlError(`Build Request is missing for ${execution.executionId}.`, { statusCode: 500 });
    return request;
  }

  function schedulePump() {
    if (pumpScheduled) return;
    pumpScheduled = true;
    setTimeout(() => {
      pumpScheduled = false;
      pump();
    }, 0);
  }

  function failBeforeSpawn(execution, error, paths) {
    mkdirSync(paths.root, { recursive: true });
    appendFileSync(paths.stderrPath, `${errorDetail(error)}\n`, 'utf8');
    const observedAt = now();
    replaceExecution({
      ...execution,
      state: 'failed',
      queuePosition: null,
      updatedAt: observedAt,
      completedAt: observedAt,
      heartbeatAt: observedAt,
      processOutcome: {
        kind: 'spawn_error',
        exitCode: null,
        signal: null,
        terminalResult: null,
        ...outputRefs(execution.executionId),
        observedAt,
      },
    });
    schedulePump();
  }

  function startExecution(execution) {
    const request = requestForExecution(execution);
    const paths = executionPaths(execution.executionId);
    mkdirSync(paths.root, { recursive: true });
    writeFileSync(paths.stdoutPath, '', 'utf8');
    writeFileSync(paths.stderrPath, '', 'utf8');
    rmSync(paths.resultPath, { force: true });
    const descriptor = request.descriptorBinding;
    const provisioner = provisioners.get(descriptor.worksiteProvisionerRef);
    const adapter = adapterForRequest(request);
    if (!provisioner || !adapter) {
      failBeforeSpawn(
        execution,
        new Error('The immutable Build Request provisioner or execution-adapter binding is no longer installed.'),
        paths,
      );
      return;
    }

    let plan;
    try {
      const worksite = provisioner({
        projectRoot: request.project.root,
        projectId: request.project.id,
        revision: request.revision,
        destinationRoot: paths.worksitePath,
        observedAt: now(),
      });
      plan = validateInternalProcessPlan(adapter.createProcessPlan({
        descriptor,
        request,
        execution,
        worksite,
        paths,
      }), paths, adapter);
    } catch (error) {
      failBeforeSpawn(execution, error, paths);
      return;
    }

    const startedAt = now();
    const launchToken = randomUUID();
    let child;
    try {
      child = spawnProcess('/bin/sh', [
        '-c',
        PROCESS_LAUNCH_GATE_SCRIPT,
        'odd-manager-launch-gate',
        launchToken,
        plan.executable,
        ...plan.args,
      ], {
        cwd: plan.cwd,
        env: plan.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      failBeforeSpawn(execution, error, paths);
      return;
    }
    let gateReleased = false;
    let running = null;
    let record = null;
    const closeLaunchGate = () => {
      child.stdin?.destroy();
      try {
        child.kill('SIGTERM');
      } catch {
        // Closing the gate is already sufficient to keep Product work pre-execution.
      }
    };

    function recordOutput(path, chunk) {
      appendFileSync(path, chunk);
      const current = Date.now();
      if (current - record.lastHeartbeatWrite < 250 || record.finalized) return;
      record.lastHeartbeatWrite = current;
      const latest = store.executions.find((entry) => entry.executionId === running.executionId);
      if (!latest || latest.state !== 'running') return;
      const observedAt = now();
      replaceExecution({ ...latest, heartbeatAt: observedAt, updatedAt: observedAt });
    }

    try {
      if (
        options.spawnProcess === undefined
        && (
          !Number.isInteger(child.pid)
          || child.pid < 1
          || !child.stdin
          || typeof child.stdin.end !== 'function'
        )
      ) {
        throw new Error('The process launch gate did not expose a durable PID and writable release channel.');
      }
      const continueLaunch = afterSpawnBeforeRunningPersist(Object.freeze({
        executionId: execution.executionId,
        requestId: execution.requestId,
        processRef: child.pid ? `process://local/${child.pid}` : null,
      }));
      if (continueLaunch === false) {
        return;
      }
      running = replaceExecution({
        ...execution,
        state: 'running',
        queuePosition: null,
        processRef: child.pid ? `process://local/${child.pid}` : null,
        startedAt,
        updatedAt: startedAt,
        heartbeatAt: startedAt,
        sourceRefs: [...new Set([
          ...execution.sourceRefs,
          ...(plan.adapterSourceRefs ?? []),
          PROCESS_LAUNCH_GATE_REF,
        ])],
      });
      record = {
        child,
        paths,
        plan,
        lastHeartbeatWrite: 0,
        finalized: false,
        cancelSignalInFlight: false,
        deferredFinalization: null,
      };
      children.set(running.executionId, record);
      child.stdout?.on('data', (chunk) => recordOutput(paths.stdoutPath, chunk));
      child.stderr?.on('data', (chunk) => recordOutput(paths.stderrPath, chunk));
      child.on('error', (error) => observeProcessFinalization(running.executionId, null, null, error));
      child.on('close', (exitCode, signal) => (
        observeProcessFinalization(running.executionId, exitCode, signal, null)
      ));
      if (child.stdin && typeof child.stdin.end === 'function') {
        child.stdin.on('error', closeLaunchGate);
        child.stdin.end(`${launchToken}\n`);
      }
      gateReleased = true;
    } catch (error) {
      if (running === null) {
        try {
          failBeforeSpawn(execution, error, paths);
        } catch {
          // The launch remains closed even when the durable failure record is unavailable.
        }
      }
    } finally {
      if (!gateReleased) closeLaunchGate();
    }
  }

  function observeProcessFinalization(executionId, exitCode, signal, spawnError) {
    const record = children.get(executionId);
    if (record?.cancelSignalInFlight) {
      record.deferredFinalization ??= { exitCode, signal, spawnError };
      return;
    }
    finalizeProcess(executionId, exitCode, signal, spawnError);
  }

  function finalizeProcess(executionId, exitCode, signal, spawnError) {
    const record = children.get(executionId);
    if (record?.finalized) return;
    if (record) record.finalized = true;
    children.delete(executionId);
    const execution = store.executions.find((entry) => entry.executionId === executionId);
    if (!execution || TERMINAL_STATES.has(execution.state) || execution.state === 'waiting_human') {
      schedulePump();
      return;
    }
    const observedAt = now();
    let terminalResult = null;
    if (!spawnError && existsSync(record?.plan.resultPath ?? '')) {
      try {
        terminalResult = buildTerminalResultSchema.parse(JSON.parse(readFileSync(record.plan.resultPath, 'utf8')));
      } catch (error) {
        appendFileSync(record.paths.stderrPath, `Invalid terminal result: ${errorDetail(error)}\n`, 'utf8');
      }
    }
    const observedSignal = signal ? String(signal) : null;
    const cancelled = (
      execution.cancelRequestedAt !== null
      && execution.cancelledBy !== null
      && observedSignal !== null
    );
    const state = cancelled
      ? 'cancelled'
      : terminalResult
        ? terminalResult.kind
        : 'failed';
    const outcomeKind = cancelled
      ? 'cancelled'
      : spawnError
        ? 'spawn_error'
        : terminalResult
          ? 'typed_result'
          : 'process_exit';
    replaceExecution({
      ...execution,
      state,
      runRefs: cancelled ? execution.runRefs : (terminalResult?.runRefs ?? execution.runRefs),
      updatedAt: observedAt,
      completedAt: observedAt,
      heartbeatAt: observedAt,
      processOutcome: {
        kind: outcomeKind,
        exitCode: Number.isInteger(exitCode) ? exitCode : null,
        signal: observedSignal,
        terminalResult: cancelled ? null : terminalResult,
        ...outputRefs(executionId),
        observedAt,
      },
    });
    schedulePump();
  }

  function pump() {
    let { availableSlots } = schedulerProjection();
    while (availableSlots > 0) {
      const queued = store.executions.find((entry) => entry.state === 'queued');
      if (!queued) break;
      const observedAt = now();
      const starting = replaceExecution({
        ...queued,
        state: 'starting',
        queuePosition: null,
        updatedAt: observedAt,
        heartbeatAt: observedAt,
      });
      availableSlots -= 1;
      startExecution(starting);
    }
  }

  function recoverDurableState() {
    let changed = false;
    const observedAt = now();
    store.executions = store.executions.map((execution) => {
      if (!SLOT_STATES.has(execution.state)) return execution;
      changed = true;
      if (execution.state === 'starting' && execution.processRef === null) {
        const paths = executionPaths(execution.executionId);
        mkdirSync(paths.root, { recursive: true });
        appendFileSync(
          paths.stderrPath,
          'Supervisor restart aborted a process launch before the durable launch gate was released.\n',
          'utf8',
        );
        return buildExecutionSchema.parse({
          ...execution,
          state: 'failed',
          queuePosition: null,
          updatedAt: observedAt,
          completedAt: observedAt,
          heartbeatAt: observedAt,
          processOutcome: {
            kind: 'spawn_error',
            exitCode: null,
            signal: null,
            terminalResult: null,
            ...outputRefs(execution.executionId),
            observedAt,
          },
          sourceRefs: [...new Set([
            ...execution.sourceRefs,
            RECOVERED_GATED_LAUNCH_REF,
          ])],
        });
      }
      const recoveredSourceRefs = [
        ...execution.sourceRefs,
        RECOVERED_STALE_REF,
      ];
      return buildExecutionSchema.parse({
        ...execution,
        state: 'stale',
        queuePosition: null,
        updatedAt: observedAt,
        heartbeatAt: execution.heartbeatAt ?? observedAt,
        sourceRefs: [...new Set(recoveredSourceRefs)],
      });
    });
    if (changed) writeStore();
    if (store.executions.some((entry) => entry.state === 'queued')) schedulePump();
  }

  function reconcileRecoveredConnectivity() {
    const observedAt = now();
    const observedMs = Date.parse(observedAt);
    let changed = false;
    store.executions = store.executions.map((execution) => {
      if (execution.state !== 'stale' || !execution.sourceRefs.includes(RECOVERED_STALE_REF)) return execution;
      const staleSinceMs = Date.parse(execution.updatedAt);
      if (
        !Number.isFinite(observedMs)
        || !Number.isFinite(staleSinceMs)
        || observedMs - staleSinceMs < recoveryDisconnectMs
      ) return execution;
      changed = true;
      return buildExecutionSchema.parse({
        ...execution,
        state: 'disconnected',
        updatedAt: observedAt,
        sourceRefs: [...new Set([
          ...execution.sourceRefs,
          'supervisor://odd_manager/recovered-disconnected',
        ])],
      });
    });
    if (changed) writeStore();
  }

  function refreshResumedExecutions(project) {
    const projectRoot = resolve(project.root);
    const resumable = store.executions.filter((execution) => (
      resolve(execution.project.root) === projectRoot
      && execution.state === 'running'
      && execution.sourceRefs.includes('supervisor://odd_manager/resumed-by-adapter')
      && !children.has(execution.executionId)
    ));
    for (const execution of resumable) {
      const request = requestForExecution(execution);
      const descriptor = request.descriptorBinding;
      const adapter = adapterForRequest(request);
      const observedAt = now();
      try {
        if (!adapter || typeof adapter.observeExecution !== 'function') {
          throw new Error('The immutable Build Request execution-adapter binding is unavailable.');
        }
        const observation = buildExecutionObservationSchema.parse(adapter.observeExecution({
          descriptor,
          request,
          execution,
          paths: executionPaths(execution.executionId),
          observedAt,
        }));
        if (observation.executionId !== execution.executionId) {
          throw new Error('Execution adapter observation identity does not match.');
        }
        applyExecutionObservation(execution, adapter, observation, observedAt);
      } catch (error) {
        replaceExecution({
          ...execution,
          state: 'stale',
          updatedAt: observedAt,
          sourceRefs: [...new Set([
            ...execution.sourceRefs,
            RECOVERED_STALE_REF,
            `supervision-error://adapter/${encodeURIComponent(errorDetail(error))}`,
          ])],
        });
      }
    }
  }

  function projectSnapshot(project) {
    refreshResumedExecutions(project);
    reconcileRecoveredConnectivity();
    const projectRoot = resolve(project.root);
    const observedAt = now();
    const requests = store.requests.filter((entry) => resolve(entry.project.root) === projectRoot);
    const requestIds = new Set(requests.map((entry) => entry.requestId));
    const executions = store.executions.filter((entry) => requestIds.has(entry.requestId));
    return buildControlSnapshotSchema.parse({
      schemaVersion: '1',
      projectRoot,
      revision: observeProjectRevision(projectRoot, observedAt),
      descriptorAdmission: descriptorAdmission(project),
      requests,
      executions,
      scheduler: schedulerProjection(),
      observedAt,
      sourceRefs: [
        `build-control-store://${projectStoreId(projectRoot)}`,
        'supervisor://odd_manager/build-control/v1',
      ],
    });
  }

  recoverDurableState();

  return {
    maxConcurrent,
    maxQueued,
    provisionerRefs: new Set(provisioners.keys()),
    adapterRefs: new Set(adapters.keys()),
    descriptorAdmission,
    snapshot: projectSnapshot,

    submit(inputValue) {
      const input = buildSubmitRequestSchema.parse(inputValue);
      const project = { ...input.project, root: resolve(input.project.root) };
      const admission = descriptorAdmission(project);
      if (admission.status !== 'ready' || !admission.descriptor) {
        throw new BuildControlError(admission.reason ?? 'Build carrier is not admitted.', { statusCode: 409 });
      }
      const currentRevision = observeProjectRevision(project.root, now());
      if (!sameProjectRevisionBasis(input.revision, currentRevision)) {
        throw new BuildControlError('Build Request Project Revision is stale.', { statusCode: 409 });
      }
      const queuedCount = store.executions.filter((entry) => entry.state === 'queued').length;
      if (queuedCount >= maxQueued) {
        throw new BuildControlError(`Build queue limit ${maxQueued} is reached.`, { statusCode: 429 });
      }
      const requestedAt = now();
      const requestId = idFactory('request');
      const executionId = idFactory('execution');
      const correlationId = idFactory('correlation');
      const descriptor = admission.descriptor;
      const adapter = adapters.get(descriptor.executionAdapterRef);
      if (!adapter || typeof adapter.validateInputs !== 'function') {
        throw new BuildControlError(`Execution adapter cannot admit declared inputs: ${descriptor.executionAdapterRef}.`, {
          statusCode: 409,
        });
      }
      const admittedInputs = jsonValueSchema.parse(adapter.validateInputs(input.inputs));
      const request = buildRequestSchema.parse({
        schemaVersion: '1',
        requestId,
        correlationId,
        project,
        revision: input.revision,
        descriptorBinding: descriptor,
        adapterBinding: adapterBindingFor(adapter),
        descriptorRef: descriptor.descriptorRef,
        carrierRef: descriptor.carrierRef,
        startupConfigRef: descriptor.startupConfigRef,
        publicStartTarget: descriptor.publicStartTarget,
        inputs: admittedInputs,
        requestedBy: input.requestedBy,
        requestedAt,
        resourcePolicyRef: 'resource-policy://odd_manager/build/default-v1',
        authorityRefs: [
          descriptor.descriptorRef,
          descriptor.carrierRef,
          descriptor.startupConfigRef,
          ...descriptor.requirementCatalogRefs,
        ],
      });
      const execution = buildExecutionSchema.parse({
        schemaVersion: '1',
        executionId,
        requestId,
        correlationId,
        project,
        revision: input.revision,
        state: 'queued',
        attempt: 1,
        queuePosition: store.executions.filter((entry) => entry.state === 'queued').length,
        processRef: null,
        worksiteRef: `worksite://odd_manager/${executionId}`,
        runRefs: [],
        startedAt: null,
        updatedAt: requestedAt,
        completedAt: null,
        heartbeatAt: null,
        processOutcome: null,
        cancelRequestedAt: null,
        cancelledBy: null,
        assuranceSummaryRef: null,
        sourceRefs: [
          `build-request://${requestId}`,
          `build-execution://${executionId}`,
          descriptor.descriptorRef,
        ],
      });
      const committed = writeStore({
        ...store,
        requests: [...store.requests, request],
        executions: [...store.executions, execution],
      });
      const committedRequest = committed.requests.find(
        (entry) => entry.requestId === request.requestId,
      );
      const committedExecution = committed.executions.find(
        (entry) => entry.executionId === execution.executionId,
      );
      schedulePump();
      return {
        request: committedRequest,
        execution: committedExecution,
        snapshot: projectSnapshot(project),
      };
    },

    attach(inputValue, project) {
      const input = buildExecutionIdentityRequestSchema.parse(inputValue);
      const projectRoot = resolve(input.projectRoot);
      if (projectRoot !== resolve(project.root)) throw new BuildControlError('Attach Project identity does not match.');
      const execution = store.executions.find((entry) => entry.executionId === input.executionId) ?? null;
      if (!execution || resolve(execution.project.root) !== projectRoot) {
        throw new BuildControlError(`Build Execution not found: ${input.executionId}.`, { statusCode: 404 });
      }
      const paths = executionPaths(execution.executionId);
      const stdout = readTail(paths.stdoutPath, outputTailBytes);
      const stderr = readTail(paths.stderrPath, outputTailBytes);
      const output = buildOutputTailSchema.parse({
        schemaVersion: '1',
        executionId: execution.executionId,
        stdout: stdout.value,
        stderr: stderr.value,
        stdoutTruncated: stdout.truncated,
        stderrTruncated: stderr.truncated,
        observedAt: now(),
        sourceRefs: [outputRefs(execution.executionId).stdoutRef, outputRefs(execution.executionId).stderrRef],
      });
      return buildAttachResponseSchema.parse({
        schemaVersion: '1',
        execution,
        output,
        sourceRefs: [`build-execution://${execution.executionId}`, ...output.sourceRefs],
      });
    },

    resume(inputValue, project) {
      const input = buildExecutionIdentityRequestSchema.parse(inputValue);
      const projectRoot = resolve(input.projectRoot);
      if (projectRoot !== resolve(project.root)) throw new BuildControlError('Resume Project identity does not match.');
      const execution = store.executions.find((entry) => entry.executionId === input.executionId) ?? null;
      if (!execution || resolve(execution.project.root) !== projectRoot) {
        throw new BuildControlError(`Build Execution not found: ${input.executionId}.`, { statusCode: 404 });
      }
      if (!['stale', 'disconnected'].includes(execution.state)) {
        throw new BuildControlError(`Cannot resume a ${execution.state} Build Execution.`, { statusCode: 409, execution });
      }
      const request = requestForExecution(execution);
      const descriptor = request.descriptorBinding;
      if (!descriptor.supportedCommands.includes('resume')) {
        throw new BuildControlError('Build carrier does not publish resume support.', { statusCode: 409, execution });
      }
      const adapter = adapterForRequest(request);
      if (!adapter || typeof adapter.observeExecution !== 'function') {
        throw new BuildControlError(
          'The immutable Build Request execution-adapter binding cannot resume supervision.',
          { statusCode: 409, execution },
        );
      }
      let observation;
      try {
        observation = buildExecutionObservationSchema.parse(adapter.observeExecution({
          descriptor,
          request,
          execution,
          paths: executionPaths(execution.executionId),
          observedAt: now(),
        }));
      } catch (error) {
        throw new BuildControlError(`Execution adapter resume failed: ${errorDetail(error)}`, {
          statusCode: 409,
          execution,
        });
      }
      if (observation.executionId !== execution.executionId) {
        throw new BuildControlError('Execution adapter resume identity does not match.', { statusCode: 409, execution });
      }
      if (['stale', 'disconnected'].includes(observation.state)) {
        throw new BuildControlError(`Execution adapter did not re-establish supervision: ${observation.state}.`, {
          statusCode: 409,
          execution,
        });
      }
      const observedAt = now();
      const resumed = applyExecutionObservation({
        ...execution,
        resumedAt: observedAt,
        resumedBy: input.actorRef,
      }, adapter, observation, observedAt);
      schedulePump();
      return resumed;
    },

    evidence(executionId, projectRootInput) {
      const projectRoot = resolve(projectRootInput);
      const execution = store.executions.find((entry) => entry.executionId === executionId) ?? null;
      if (!execution || resolve(execution.project.root) !== projectRoot) return null;
      const paths = executionPaths(executionId);
      if (!existsSync(paths.evidenceBundlePath)) return null;
      let bundle;
      try {
        bundle = buildEvidenceBundleSchema.parse(JSON.parse(readFileSync(paths.evidenceBundlePath, 'utf8')));
      } catch (error) {
        throw new BuildControlError(`Build evidence bundle is invalid: ${errorDetail(error)}`, { statusCode: 500, execution });
      }
      if (
        bundle.executionId !== execution.executionId
        || resolve(bundle.projectRoot) !== projectRoot
      ) {
        throw new BuildControlError('Build evidence bundle identity does not match its execution.', { statusCode: 409, execution });
      }
      if (
        new Set(bundle.gateResults.map((entry) => entry.gateRef)).size !== bundle.gateResults.length
        || new Set(bundle.assetResults.map((entry) => entry.requirementRef)).size !== bundle.assetResults.length
      ) {
        throw new BuildControlError('Build evidence bundle contains duplicate gate or asset result identities.', {
          statusCode: 409,
          execution,
        });
      }
      return {
        bundle,
        observeEvidence(evidenceKey) {
          if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(evidenceKey)) {
            return { state: 'invalid', digest: null, sourceRef: `build-evidence://${executionId}/${evidenceKey}` };
          }
          const path = join(paths.evidenceRoot, `${evidenceKey}.json`);
          if (!existsSync(path)) {
            return { state: 'missing', digest: null, sourceRef: `build-evidence://${executionId}/${evidenceKey}` };
          }
          const digest = `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
          return { state: 'present', digest, sourceRef: `build-evidence://${executionId}/${evidenceKey}` };
        },
        sourceRefs: [
          `build-evidence-bundle://${executionId}`,
          `build-execution://${executionId}`,
        ],
      };
    },

    cancel(inputValue, project) {
      const input = buildExecutionIdentityRequestSchema.parse(inputValue);
      const projectRoot = resolve(input.projectRoot);
      if (projectRoot !== resolve(project.root)) throw new BuildControlError('Cancel Project identity does not match.');
      const execution = store.executions.find((entry) => entry.executionId === input.executionId) ?? null;
      if (!execution || resolve(execution.project.root) !== projectRoot) {
        throw new BuildControlError(`Build Execution not found: ${input.executionId}.`, { statusCode: 404 });
      }
      const request = requestForExecution(execution);
      const descriptor = request.descriptorBinding;
      if (!descriptor.supportedCommands.includes('cancel')) {
        throw new BuildControlError('Build carrier does not publish cancel support.', { statusCode: 409, execution });
      }
      if (TERMINAL_STATES.has(execution.state)) {
        throw new BuildControlError(`Cannot cancel a ${execution.state} Build Execution.`, { statusCode: 409, execution });
      }
      const observedAt = now();
      if (
        execution.state === 'queued'
        || execution.state === 'waiting_human'
      ) {
        const paths = executionPaths(execution.executionId);
        mkdirSync(paths.root, { recursive: true });
        const cancelled = replaceExecution({
          ...execution,
          state: 'cancelled',
          queuePosition: null,
          updatedAt: observedAt,
          completedAt: observedAt,
          heartbeatAt: observedAt,
          cancelRequestedAt: observedAt,
          cancelledBy: input.actorRef,
          processOutcome: {
            kind: 'cancelled',
            exitCode: null,
            signal: null,
            terminalResult: null,
            ...outputRefs(execution.executionId),
            observedAt,
          },
        });
        schedulePump();
        return cancelled;
      }
      const record = children.get(execution.executionId);
      const adapter = adapterForRequest(request);
      if (
        ['stale', 'disconnected'].includes(execution.state)
        && typeof adapter?.cancelExecution !== 'function'
      ) {
        throw new BuildControlError(
          'Recovered process cancellation requires the immutable execution-adapter binding.',
          { statusCode: 409, execution },
        );
      }
      if (record?.child) {
        let cancelling = null;
        let signalAccepted = false;
        let signalError = null;
        record.cancelSignalInFlight = true;
        try {
          cancelling = persistCancelIntent(execution, input.actorRef, observedAt);
          signalAccepted = record.child.kill('SIGTERM') === true;
        } catch (error) {
          if (cancelling === null) {
            record.cancelSignalInFlight = false;
            const deferred = record.deferredFinalization;
            record.deferredFinalization = null;
            if (deferred) {
              finalizeProcess(
                execution.executionId,
                deferred.exitCode,
                deferred.signal,
                deferred.spawnError,
              );
            }
            throw error;
          }
          signalError = error;
        } finally {
          record.cancelSignalInFlight = false;
        }

        const deferred = record.deferredFinalization;
        record.deferredFinalization = null;
        if (deferred) {
          finalizeProcess(
            execution.executionId,
            deferred.exitCode,
            deferred.signal,
            deferred.spawnError,
          );
        }
        if (signalAccepted) return cancelling;

        const current = store.executions.find(
          (entry) => entry.executionId === execution.executionId,
        ) ?? execution;
        throw new BuildControlError(
          signalError
            ? `Build process cancellation signal failed: ${errorDetail(signalError)}`
            : 'Build process could not be signalled for cancellation.',
          {
            statusCode: 409,
            execution: current,
          },
        );
      }

      if (
        ['running', 'stale', 'disconnected'].includes(execution.state)
        && typeof adapter?.cancelExecution === 'function'
      ) {
        const cancelling = persistCancelIntent(execution, input.actorRef, observedAt);
        let result;
        try {
          result = buildExternalCancelResultSchema.parse(adapter.cancelExecution({
            descriptor,
            request,
            execution: cancelling,
            paths: executionPaths(execution.executionId),
            actorRef: input.actorRef,
            observedAt,
          }));
        } catch (error) {
          throw new BuildControlError(`Execution adapter cancellation failed: ${errorDetail(error)}`, {
            statusCode: 409,
            execution: cancelling,
          });
        }
        if (result.executionId !== execution.executionId) {
          throw new BuildControlError('Execution adapter cancellation identity does not match.', {
            statusCode: 409,
            execution: cancelling,
          });
        }
        const cancelled = replaceExecution({
          ...cancelling,
          state: 'cancelled',
          queuePosition: null,
          completedAt: observedAt,
          heartbeatAt: observedAt,
          processOutcome: {
            kind: 'cancelled',
            exitCode: null,
            signal: null,
            terminalResult: null,
            ...outputRefs(execution.executionId),
            observedAt,
          },
          sourceRefs: [...new Set([
            ...cancelling.sourceRefs,
            ...(adapter.sourceRefs ?? []),
            ...result.sourceRefs,
          ])],
        });
        schedulePump();
        return cancelled;
      }
      throw new BuildControlError('Build process could not be signalled for cancellation.', {
        statusCode: 409,
        execution,
      });
    },

    async waitFor(predicate, timeoutMs = 10_000) {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const value = predicate(store);
        if (value) return value;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
      }
      throw new Error(`Build supervisor condition was not met within ${timeoutMs}ms.`);
    },

    shutdown() {
      for (const record of children.values()) record.child.kill('SIGTERM');
    },
  };
}
