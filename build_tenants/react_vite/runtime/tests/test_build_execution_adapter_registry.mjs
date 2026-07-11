import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  BuildExecutionAdapterRegistryError,
  loadBuildExecutionAdapterRegistry,
} from '../../src/server/build-execution-adapter-registry.mjs';
import {
  FIXTURE_EXECUTION_ADAPTER_REF,
  PROJECT_SNAPSHOT_PROVISIONER_REF,
} from '../../src/server/build-carrier-descriptor-service.mjs';
import { createBuildControlService } from '../../src/server/build-control-service.mjs';
import { observeProjectRevision } from '../../src/server/project-revision-service.mjs';

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeRegistry(path, entries) {
  writeFileSync(path, `${JSON.stringify({ schemaVersion: '1', adapters: entries }, null, 2)}\n`, 'utf8');
}

function createAdapterModule(root, options = {}) {
  const workerPath = join(root, 'adapter-worker.mjs');
  const modulePath = join(root, 'adapter.mjs');
  writeFileSync(workerPath, `
import { writeFileSync } from 'node:fs';
const [resultPath, label] = process.argv.slice(2);
console.log(\`[external-adapter] \${label}\`);
writeFileSync(resultPath, JSON.stringify({
  kind: 'converged',
  resultRef: \`result://external/\${label}\`,
  detail: 'External adapter emitted a typed terminal result.',
  runRefs: [\`run://external/\${label}\`],
  sourceRefs: ['runtime://external-adapter']
}, null, 2) + '\\n');
`, 'utf8');
  const cwdExpression = options.cwdExpression ?? 'paths.worksitePath';
  const resultPathExpression = options.resultPathExpression ?? 'paths.resultPath';
  const lifecycleMethods = options.lifecycleMethods === true ? `,
    observeExecution({ execution, observedAt }) {
      return {
        schemaVersion: '1', executionId: execution.executionId, state: 'running',
        processRef: execution.processRef ?? 'process://external/reconnected', heartbeatAt: observedAt,
        runRefs: execution.runRefs, terminalResult: null,
        sourceRefs: ['adapter-module://external-test/observed']
      };
    },
    cancelExecution({ execution }) {
      return {
        schemaVersion: '1', executionId: execution.executionId, cancelled: true,
        sourceRefs: ['adapter-module://external-test/cancelled']
      };
    }
  ` : '';
  writeFileSync(modulePath, `
export function createExternalAdapter(context) {
  return {
    adapterRef: context.adapterRef,
    validateInputs(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('inputs must be an object');
      const keys = Object.keys(value);
      if (keys.length !== 1 || keys[0] !== 'label' || !/^[a-z][a-z0-9-]{0,31}$/.test(value.label)) {
        throw new Error('label is the only admitted input');
      }
      return { label: value.label };
    },
    createProcessPlan({ request, paths }) {
      return {
        executable: process.execPath,
        args: [${JSON.stringify(workerPath)}, paths.resultPath, request.inputs.label],
        cwd: ${cwdExpression},
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          TMPDIR: process.env.TMPDIR ?? ''
        },
        resultPath: ${resultPathExpression},
        adapterSourceRefs: [context.adapterRef, 'adapter-module://external-test']
      };
    }${lifecycleMethods}
  };
}
`, 'utf8');
  return { modulePath, workerPath };
}

function createProject(root, adapterRef) {
  const productId = 'external_adapter_product';
  const projectRoot = join(root, 'project');
  mkdirSync(join(projectRoot, '.odd'), { recursive: true });
  mkdirSync(join(projectRoot, 'specification'), { recursive: true });
  writeFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), '# External Adapter Product\n', 'utf8');
  writeFileSync(join(projectRoot, 'source.txt'), 'external adapter source\n', 'utf8');
  writeFileSync(join(projectRoot, '.odd', 'build-carrier.json'), `${JSON.stringify({
    schemaVersion: '1',
    descriptorRef: `build-carrier-descriptor://${productId}/software-build`,
    productRef: `product://${productId}`,
    productVersion: '1.0.0',
    carrierKind: 'graph_function',
    carrierRef: `graph-function://${productId}/software-build`,
    startupConfigRef: `startup-config://${productId}/software-build`,
    publicStartTarget: `start-target://${productId}/software-build`,
    inputSchemaRef: `schema://${productId}/build-input/v1`,
    worksiteProvisionerRef: PROJECT_SNAPSHOT_PROVISIONER_REF,
    executionAdapterRef: adapterRef,
    supportedCommands: ['submit', 'attach', 'cancel'],
    requirementCatalogRefs: [`requirements://${productId}/software-build`],
    expectedAssetCatalogRefs: [`assets://${productId}/software-build`],
    proofRefs: [`proof://${productId}/carrier`],
  }, null, 2)}\n`, 'utf8');
  execFileSync('git', ['init', '--quiet', projectRoot]);
  execFileSync('git', ['-C', projectRoot, 'add', '.']);
  execFileSync('git', [
    '-C', projectRoot,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
  return {
    root: projectRoot,
    project: {
      id: `${productId}-project`,
      root: projectRoot,
      label: productId,
      publishedProductRef: `product://${productId}`,
    },
  };
}

test('production adapter registry is explicitly absent when no manager-local registry is installed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-adapter-absent-'));
  try {
    const loaded = await loadBuildExecutionAdapterRegistry({ managerStateRoot: root });
    assert.equal(loaded.status, 'absent');
    assert.equal(loaded.adapters.size, 0);
    assert.match(loaded.registryPath, /build-execution-adapters\.local\.json$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('adapter registry rejects digest drift and the reserved fixture identity', async () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-adapter-negative-'));
  const registryPath = join(root, 'registry.json');
  try {
    const { modulePath } = createAdapterModule(root);
    writeRegistry(registryPath, [{
      adapterRef: 'execution-adapter://example/drift/v1',
      modulePath,
      moduleSha256: '0'.repeat(64),
      exportName: 'createExternalAdapter',
      sourceRefs: ['adapter-install://example/drift'],
    }]);
    await assert.rejects(
      loadBuildExecutionAdapterRegistry({ managerStateRoot: root, registryPath }),
      (error) => error instanceof BuildExecutionAdapterRegistryError && /digest mismatch/.test(error.message),
    );

    writeRegistry(registryPath, [{
      adapterRef: FIXTURE_EXECUTION_ADAPTER_REF,
      modulePath,
      moduleSha256: sha256(modulePath),
      exportName: 'createExternalAdapter',
      sourceRefs: ['adapter-install://fixture-forbidden'],
    }]);
    await assert.rejects(
      loadBuildExecutionAdapterRegistry({ managerStateRoot: root, registryPath }),
      /test-only fixture adapter cannot be installed/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('production registry preserves optional reconnect and external-cancel adapter methods', async () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-adapter-lifecycle-'));
  const registryPath = join(root, 'registry.json');
  const adapterRef = 'execution-adapter://example/lifecycle/v1';
  try {
    const { modulePath } = createAdapterModule(root, { lifecycleMethods: true });
    writeRegistry(registryPath, [{
      adapterRef,
      modulePath,
      moduleSha256: sha256(modulePath),
      exportName: 'createExternalAdapter',
      sourceRefs: ['adapter-install://example/lifecycle/v1'],
    }]);
    const loaded = await loadBuildExecutionAdapterRegistry({ managerStateRoot: root, registryPath });
    const adapter = loaded.adapters.get(adapterRef);
    assert.equal(typeof adapter.observeExecution, 'function');
    assert.equal(typeof adapter.cancelExecution, 'function');
    const execution = { executionId: 'execution-1', processRef: 'process://external/1', runRefs: [] };
    assert.equal(adapter.observeExecution({ execution, observedAt: '2026-07-11T00:00:00.000Z' }).executionId, 'execution-1');
    assert.equal(adapter.cancelExecution({ execution }).cancelled, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('digest-pinned external adapter executes through production service without fixture mode', async () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-adapter-live-'));
  const managerStateRoot = join(root, 'manager-state');
  const registryPath = join(root, 'registry.json');
  const adapterRef = 'execution-adapter://example/external/v1';
  let service;
  try {
    mkdirSync(managerStateRoot, { recursive: true });
    const { modulePath } = createAdapterModule(root);
    writeRegistry(registryPath, [{
      adapterRef,
      modulePath,
      moduleSha256: sha256(modulePath),
      exportName: 'createExternalAdapter',
      sourceRefs: ['adapter-install://example/external/v1'],
    }]);
    const loaded = await loadBuildExecutionAdapterRegistry({ managerStateRoot, registryPath });
    assert.equal(loaded.status, 'ready');
    assert.deepEqual([...loaded.adapters.keys()], [adapterRef]);

    const current = createProject(root, adapterRef);
    service = createBuildControlService({
      managerStateRoot,
      adapters: loaded.adapters,
      fixtureMode: false,
      maxConcurrent: 1,
      maxQueued: 2,
    });
    assert.equal(service.adapterRefs.has(FIXTURE_EXECUTION_ADAPTER_REF), false);
    assert.equal(service.descriptorAdmission(current.project).status, 'ready');
    const submitted = service.submit({
      project: current.project,
      revision: observeProjectRevision(current.root),
      inputs: { label: 'production-proof' },
      requestedBy: 'actor://operator/registry-test',
    });
    const terminal = await service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === submitted.execution.executionId);
      return execution?.state === 'converged' ? execution : null;
    });
    assert.deepEqual(terminal.runRefs, ['run://external/production-proof']);
    assert.equal(terminal.processOutcome.kind, 'typed_result');
    assert.equal(terminal.assuranceSummaryRef, null);
    assert.ok(terminal.sourceRefs.some((ref) => ref.startsWith('adapter-registry-sha256://')));
    assert.ok(terminal.sourceRefs.some((ref) => ref.startsWith('adapter-module-sha256://')));
    const attached = service.attach({
      projectRoot: current.root,
      executionId: terminal.executionId,
      actorRef: 'actor://operator/registry-test',
    }, current.project);
    assert.match(attached.output.stdout, /external-adapter.*production-proof/);
  } finally {
    service?.shutdown();
    rmSync(root, { recursive: true, force: true });
  }
});

test('installed adapter cannot move process cwd outside the minted worksite', async () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-adapter-membrane-'));
  const managerStateRoot = join(root, 'manager-state');
  const registryPath = join(root, 'registry.json');
  const adapterRef = 'execution-adapter://example/outside-cwd/v1';
  let service;
  let spawnCalled = false;
  try {
    mkdirSync(managerStateRoot, { recursive: true });
    const { modulePath } = createAdapterModule(root, { cwdExpression: JSON.stringify(tmpdir()) });
    writeRegistry(registryPath, [{
      adapterRef,
      modulePath,
      moduleSha256: sha256(modulePath),
      exportName: 'createExternalAdapter',
      sourceRefs: ['adapter-install://example/outside-cwd/v1'],
    }]);
    const loaded = await loadBuildExecutionAdapterRegistry({ managerStateRoot, registryPath });
    const current = createProject(root, adapterRef);
    service = createBuildControlService({
      managerStateRoot,
      adapters: loaded.adapters,
      fixtureMode: false,
      spawnProcess() {
        spawnCalled = true;
        throw new Error('spawn must not be reached');
      },
    });
    const submitted = service.submit({
      project: current.project,
      revision: observeProjectRevision(current.root),
      inputs: { label: 'outside-cwd' },
      requestedBy: 'actor://operator/registry-test',
    });
    const failed = await service.waitFor((store) => {
      const execution = store.executions.find((entry) => entry.executionId === submitted.execution.executionId);
      return execution?.state === 'failed' ? execution : null;
    });
    assert.equal(spawnCalled, false);
    assert.equal(failed.processOutcome.kind, 'spawn_error');
    const attached = service.attach({
      projectRoot: current.root,
      executionId: failed.executionId,
      actorRef: 'actor://operator/registry-test',
    }, current.project);
    assert.match(attached.output.stderr, /cwd must remain inside the minted worksite/);
  } finally {
    service?.shutdown();
    rmSync(root, { recursive: true, force: true });
  }
});
