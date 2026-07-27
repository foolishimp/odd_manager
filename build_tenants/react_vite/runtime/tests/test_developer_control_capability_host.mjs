import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import {
  assuranceAttentionIdentity,
  capabilitySubscriptionEventSchema,
  capabilitySubscriptionSchema,
  commandResultSchema,
} from '@odd-manager/developer-control-contracts';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, '../../src');
const developerControlContractsUrl = new URL(
  '../../packages/developer-control-contracts/dist/index.js',
  import.meta.url,
).href;
const compiledModuleUrls = new Map();

async function compiledTypeScriptModuleUrl(relativePath) {
  if (compiledModuleUrls.has(relativePath)) return compiledModuleUrls.get(relativePath);
  const pending = (async () => {
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
    const localSpecifiers = [...compiled.matchAll(/from\s+["'](\.[^"']+)["']/g)]
      .map((match) => match[1]);
    for (const specifier of new Set(localSpecifiers)) {
      const candidate = join(dirname(relativePath), specifier);
      const dependencyPath = existsSync(resolve(sourceRoot, candidate)) ? candidate : `${candidate}.ts`;
      const dependencyUrl = await compiledTypeScriptModuleUrl(dependencyPath);
      compiled = compiled
        .replaceAll(`"${specifier}"`, JSON.stringify(dependencyUrl))
        .replaceAll(`'${specifier}'`, JSON.stringify(dependencyUrl));
    }
    return `data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`;
  })();
  compiledModuleUrls.set(relativePath, pending);
  return pending;
}

async function loadTypeScriptModule(relativePath) {
  return import(await compiledTypeScriptModuleUrl(relativePath));
}

function bootstrap(projectRoot) {
  const capabilityIds = [
    'build-portfolio',
    'project-workbench',
    'specification-proposal',
    'build-control',
    'assurance-attention',
    'run-observation',
  ];
  return {
    schemaVersion: '1',
    context: {
      project: {
        id: projectRoot.split('/').at(-1),
        root: projectRoot,
        label: projectRoot.split('/').at(-1),
        publishedProductRef: null,
      },
      workspaceRef: null,
      revision: null,
    },
    capabilities: capabilityIds.map((id) => ({
      id,
      label: id,
      summary: id,
      implementationStage: 'structural',
      requiredContractRefs: [],
      availability: { kind: 'ready', contractRefs: [] },
      defaultRoute: id,
      attentionCount: 0,
    })),
    observedAt: '2026-07-11T00:00:00.000Z',
    sourceRefs: ['fixture'],
  };
}

function revision(seed = 'a') {
  return {
    kind: 'commit',
    revision: seed.repeat(40).slice(0, 40),
    dirty: false,
    sourceDigest: seed.repeat(40).slice(0, 40),
    specificationDigest: `sha256:specification-${seed}`,
    observedAt: '2026-07-11T00:00:00.000Z',
  };
}

function fixtureDepthAttentionId(
  projectId = 'project-a',
  executionId = 'execution-a',
) {
  return assuranceAttentionIdentity({
    projectId,
    executionId,
    sourceKind: 'gate',
    sourceIdentity: 'gate://fixture/depth',
  });
}

function assuranceSnapshot(projectRoot, basis, {
  executionId = 'execution-a',
  runRefs = ['run://fixture/a'],
  sourceRef = 'requirements://project-a/depth',
} = {}) {
  const project = {
    id: 'project-a',
    root: projectRoot,
    label: 'Project A',
    publishedProductRef: 'product://project-a',
  };
  return {
    schemaVersion: '1',
    projectRoot,
    revision: basis,
    execution: {
      schemaVersion: '1',
      executionId,
      requestId: 'request-a',
      correlationId: 'correlation-a',
      project,
      revision: basis,
      state: 'converged',
      attempt: 1,
      queuePosition: null,
      processRef: 'process://fixture/a',
      worksiteRef: `worksite://odd_manager/${executionId}`,
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
          resultRef: `result://${executionId}`,
          detail: 'fixture execution converged',
          runRefs,
          sourceRefs: [`fixture://${executionId}/result`],
        },
        stdoutRef: `stdout://${executionId}`,
        stderrRef: `stderr://${executionId}`,
        observedAt: '2026-07-11T00:01:00.000Z',
      },
      cancelRequestedAt: null,
      cancelledBy: null,
      assuranceSummaryRef: null,
      sourceRefs: [`build-execution://${executionId}`],
    },
    catalogAdmission: {
      schemaVersion: '1',
      projectRoot,
      status: 'ready',
      catalog: {
        schemaVersion: '1',
        catalogRef: 'assurance-catalog://project-a/software-build',
        productRef: project.publishedProductRef,
        requirementCatalogRef: 'requirements://project-a/software-build',
        assetCatalogRef: 'assets://project-a/software-build',
        gates: [{
          gateRef: 'gate://fixture/depth',
          label: 'Depth',
          requirementRef: 'requirement://project-a/depth',
          regime: 'F_D',
          evidenceKey: 'depth',
          positiveDecisionRequirement: null,
          reactionRefs: ['reaction://odd_manager/open-run-inspector'],
          sourceRefs: [sourceRef],
        }],
        assets: [],
        sourceRefs: ['catalog://fixture'],
      },
      reason: null,
      sourceRefs: ['catalog://fixture'],
    },
    evidenceBundleRef: `build-evidence-bundle://${executionId}`,
    gateAssessments: [{
      gateRef: 'gate://fixture/depth',
      label: 'Depth',
      requirementRef: 'requirement://project-a/depth',
      project,
      revision: basis,
      executionId,
      regime: 'F_D',
      status: 'stale',
      detail: 'Evidence digest does not match the admitted file.',
      producerRef: 'producer://fixture',
      evidenceDigest: 'sha256:fixture-depth',
      evidenceRefs: ['proof://fixture/depth'],
      decision: null,
      sourceRefs: [sourceRef],
      assessedAt: '2026-07-11T00:01:00.000Z',
    }],
    assetDeliveries: [],
    attentionItems: [{
      attentionId: fixtureDepthAttentionId(project.id, executionId),
      correlationId: 'correlation-a',
      project,
      executionId,
      sourceKind: 'gate',
      sourceRef,
      severity: 'blocking',
      reason: 'Evidence digest does not match the admitted file.',
      observedAt: '2026-07-11T00:01:00.000Z',
      reactionRefs: ['reaction://odd_manager/open-run-inspector'],
    }],
    summary: {
      posture: 'stale',
      gateCounts: {
        total: 1, satisfied: 0, failed: 0, missing: 0, stale: 1, waitingHuman: 0,
      },
      assetCounts: {
        total: 0, delivered: 0, failed: 0, missing: 0, stale: 0,
      },
      blockingAttentionCount: 1,
    },
    observedAt: '2026-07-11T00:01:00.000Z',
    sourceRefs: [`build-execution://${executionId}`],
  };
}

function portfolio(projectRoots, activeRoot = projectRoots[0]) {
  return {
    schemaVersion: '1',
    rows: projectRoots.map((root, index) => ({
      project: {
        id: `project-${index}`,
        root,
        label: root.split('/').at(-1),
        publishedProductRef: null,
      },
      revision: null,
      active: root === activeRoot,
      specification: { kind: 'present', label: 'present', sourceRefs: [`${root}/specification`] },
      build: { kind: 'unavailable', label: 'carrier missing', sourceRefs: [`descriptor://${index}`] },
      buildActivity: {
        queuedCount: 0,
        runningCount: 0,
        waitingHumanCount: 0,
        terminalCount: 0,
        latestExecutionId: null,
        latestState: null,
        sourceRefs: [],
      },
      run: { kind: 'unobserved', label: 'not loaded', sourceRefs: [`run://${index}`] },
      assurance: { kind: 'partial', label: 'read only', sourceRefs: [`proof://${index}`] },
      participants: { kind: 'unobserved', count: null, sourceRefs: [`participants://${index}`] },
      features: { hasAiWorkspace: true, hasGenesis: false, buildTenants: [] },
      freshness: { observedAt: '2026-07-11T00:00:00.000Z', sourceRefs: [`project://${index}`] },
      attention: [{
        attentionId: `attention-${index}`,
        correlationId: `project:project-${index}:build-carrier`,
        severity: 'warning',
        sourceKind: 'build-carrier',
        sourceRef: `descriptor://${index}`,
        reason: 'carrier missing',
      }],
      sourceRefs: [`project://${index}`],
    })),
    browseRoot: '/workspace',
    observedAt: '2026-07-11T00:00:00.000Z',
    sourceRefs: ['portfolio-fixture'],
  };
}

function runningBuildControlFixture(projectRoot, basis) {
  const project = {
    id: 'project-a',
    root: projectRoot,
    label: 'Project A',
    publishedProductRef: 'product://project-a',
  };
  const descriptor = {
    schemaVersion: '1',
    descriptorRef: 'build-carrier-descriptor://project-a/software-build',
    productRef: project.publishedProductRef,
    productVersion: '1.0.0',
    carrierKind: 'graph_function',
    carrierRef: 'graph-function://project-a/software-build',
    startupConfigRef: 'startup://project-a/software-build',
    publicStartTarget: 'start://project-a/software-build',
    inputSchemaRef: 'schema://project-a/build-input',
    worksiteProvisionerRef: 'worksite-provisioner://odd_manager/project-snapshot/v1',
    executionAdapterRef: 'execution-adapter://odd_manager/fixture/v1',
    supportedCommands: ['submit', 'attach', 'cancel'],
    requirementCatalogRefs: ['requirements://project-a'],
    expectedAssetCatalogRefs: ['assets://project-a'],
    proofRefs: ['proof://project-a'],
  };
  const request = {
    schemaVersion: '1',
    requestId: 'request-a',
    correlationId: 'correlation-a',
    project,
    revision: basis,
    descriptorBinding: descriptor,
    adapterBinding: {
      adapterRef: descriptor.executionAdapterRef,
      sourceRefs: [descriptor.executionAdapterRef],
    },
    descriptorRef: descriptor.descriptorRef,
    carrierRef: descriptor.carrierRef,
    startupConfigRef: descriptor.startupConfigRef,
    publicStartTarget: descriptor.publicStartTarget,
    inputs: { label: 'aggregate-poll' },
    requestedBy: 'actor://operator/test',
    requestedAt: '2026-07-11T00:00:00.000Z',
    resourcePolicyRef: 'resource-policy://odd_manager/build/default-v1',
    authorityRefs: descriptor.requirementCatalogRefs,
  };
  const execution = {
    schemaVersion: '1',
    executionId: 'execution-a',
    requestId: request.requestId,
    correlationId: request.correlationId,
    project,
    revision: basis,
    state: 'running',
    attempt: 1,
    queuePosition: null,
    processRef: 'process://local/100',
    worksiteRef: 'worksite://odd_manager/execution-a',
    runRefs: [],
    startedAt: '2026-07-11T00:00:01.000Z',
    updatedAt: '2026-07-11T00:01:00.000Z',
    completedAt: null,
    heartbeatAt: '2026-07-11T00:01:00.000Z',
    resumedAt: null,
    resumedBy: null,
    processOutcome: null,
    cancelRequestedAt: null,
    cancelledBy: null,
    assuranceSummaryRef: null,
    sourceRefs: ['build-execution://execution-a'],
  };
  return {
    project,
    execution,
    snapshot: {
      schemaVersion: '1',
      projectRoot,
      revision: basis,
      descriptorAdmission: {
        schemaVersion: '1',
        projectRoot,
        status: 'ready',
        descriptor,
        reason: null,
        sourceRefs: ['.odd/build-carrier.json'],
      },
      requests: [request],
      executions: [execution],
      scheduler: {
        maxConcurrent: 2,
        maxQueued: 10,
        runningCount: 1,
        queuedCount: 0,
        availableSlots: 1,
      },
      observedAt: '2026-07-11T00:01:00.000Z',
      sourceRefs: ['supervisor://odd_manager/build-control/v1'],
    },
  };
}

function registryProject(root, active = true) {
  return {
    id: 'project-0',
    name: 'Project A',
    root,
    odd_type: 'odd_manager',
    has_ai_workspace: true,
    has_genesis: true,
    installed_packages: ['odd_manager'],
    build_tenants: ['react_vite'],
    registry_source: 'registry',
    registered_at: '2026-07-11T00:00:00.000Z',
    updated_at: '2026-07-11T00:00:00.000Z',
    tags: [],
    is_active: active,
  };
}

function registryDiagnostic(activeRoot, candidateCount = 1) {
  return {
    registry_root: '/workspace/odd_manager/.ai-workspace/runtime/odd_manager/projects.local.json',
    manager_workspace_root: '/workspace/odd_manager',
    registry_version: 1,
    active_project_root: activeRoot,
    candidate_count: candidateCount,
  };
}

async function withJsonFetch(payload, action) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  try {
    return await action();
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function contextCommand(commandId, projectRoot) {
  return {
    type: 'host.resolve-context',
    commandId,
    correlationId: `correlation-${commandId}`,
    projectRoot,
  };
}

test('host rejects late Project generations and admits only the exact latest Context command', async () => {
  const module = await loadTypeScriptModule('capabilities/host/state.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const commandA = contextCommand('context-a', projectA);
  const commandB = contextCommand('context-b', projectB);
  const requested = module.replayDeveloperControlHostMessages(
    module.createDeveloperControlHostState(),
    [
      { type: 'host/context-requested', command: commandA },
      { type: 'host/context-requested', command: commandB },
    ],
  );
  assert.deepEqual(requested.commands, [commandA, commandB]);

  const stale = module.updateDeveloperControlHost(requested.state, {
    type: 'host/context-admitted',
    commandId: commandA.commandId,
    correlationId: commandA.correlationId,
    bootstrap: bootstrap(projectA),
  }).state;
  assert.equal(stale.bootstrap, null);
  assert.equal(stale.contextStatus, 'loading');
  assert.match(stale.commandResults.at(-1).detail, /latest Project request/);

  const admitted = module.updateDeveloperControlHost(stale, {
    type: 'host/context-admitted',
    commandId: commandB.commandId,
    correlationId: commandB.correlationId,
    bootstrap: bootstrap(projectB),
  }).state;
  assert.equal(admitted.contextStatus, 'ready');
  assert.equal(admitted.bootstrap.context.project.root, projectB);
  assert.equal(admitted.pendingCommands.length, 0);

  const firstSameProject = contextCommand('context-same-project-1', projectA);
  const latestSameProject = contextCommand('context-same-project-2', projectA);
  const sameProjectRequested = module.replayDeveloperControlHostMessages(
    module.createDeveloperControlHostState(),
    [
      { type: 'host/context-requested', command: firstSameProject },
      { type: 'host/context-requested', command: latestSameProject },
    ],
  ).state;
  assert.deepEqual(sameProjectRequested.pendingCommands, [latestSameProject]);

  const mismatchedSameProjectCorrelation = module.updateDeveloperControlHost(
    sameProjectRequested,
    {
      type: 'host/context-admitted',
      commandId: latestSameProject.commandId,
      correlationId: firstSameProject.correlationId,
      bootstrap: bootstrap(projectA),
    },
  ).state;
  assert.equal(mismatchedSameProjectCorrelation.bootstrap, null);
  assert.deepEqual(mismatchedSameProjectCorrelation.pendingCommands, [latestSameProject]);
  assert.equal(mismatchedSameProjectCorrelation.commandResults.at(-1).status, 'rejected');

  const staleSameProjectSuccess = module.updateDeveloperControlHost(mismatchedSameProjectCorrelation, {
    type: 'host/context-admitted',
    commandId: firstSameProject.commandId,
    correlationId: firstSameProject.correlationId,
    bootstrap: bootstrap(projectA),
  }).state;
  assert.equal(staleSameProjectSuccess.bootstrap, null);
  assert.deepEqual(staleSameProjectSuccess.pendingCommands, [latestSameProject]);
  assert.equal(staleSameProjectSuccess.commandResults.at(-1).status, 'rejected');
  assert.match(staleSameProjectSuccess.commandResults.at(-1).detail, /no matching pending command/);

  const staleSameProjectFailure = module.updateDeveloperControlHost(staleSameProjectSuccess, {
    type: 'host/context-failed',
    commandId: firstSameProject.commandId,
    correlationId: firstSameProject.correlationId,
    error: 'retired generation failed',
  }).state;
  assert.equal(staleSameProjectFailure.contextStatus, 'loading');
  assert.equal(staleSameProjectFailure.error, null);
  assert.deepEqual(staleSameProjectFailure.pendingCommands, [latestSameProject]);
  assert.equal(staleSameProjectFailure.commandResults.at(-1).status, 'rejected');
  assert.match(staleSameProjectFailure.commandResults.at(-1).detail, /no matching pending command/);

  const latestSameProjectSuccess = module.updateDeveloperControlHost(staleSameProjectFailure, {
    type: 'host/context-admitted',
    commandId: latestSameProject.commandId,
    correlationId: latestSameProject.correlationId,
    bootstrap: bootstrap(projectA),
  }).state;
  assert.equal(latestSameProjectSuccess.contextStatus, 'ready');
  assert.equal(latestSameProjectSuccess.bootstrap.context.project.root, projectA);
  assert.equal(latestSameProjectSuccess.pendingCommands.length, 0);

  const firstFailureGeneration = contextCommand('context-failure-1', projectA);
  const latestFailureGeneration = contextCommand('context-failure-2', projectA);
  const failureRequested = module.replayDeveloperControlHostMessages(
    module.createDeveloperControlHostState(),
    [
      { type: 'host/context-requested', command: firstFailureGeneration },
      { type: 'host/context-requested', command: latestFailureGeneration },
    ],
  ).state;
  const exactFailure = module.updateDeveloperControlHost(failureRequested, {
    type: 'host/context-failed',
    commandId: latestFailureGeneration.commandId,
    correlationId: latestFailureGeneration.correlationId,
    error: 'latest generation failed',
  }).state;
  assert.equal(exactFailure.contextStatus, 'error');
  assert.equal(exactFailure.error, 'latest generation failed');
  assert.equal(exactFailure.pendingCommands.length, 0);
  const lateFailureGeneration = module.updateDeveloperControlHost(exactFailure, {
    type: 'host/context-failed',
    commandId: firstFailureGeneration.commandId,
    correlationId: firstFailureGeneration.correlationId,
    error: 'retired generation arrived late',
  }).state;
  assert.equal(lateFailureGeneration.contextStatus, 'error');
  assert.equal(lateFailureGeneration.error, 'latest generation failed');
  assert.equal(lateFailureGeneration.commandResults.at(-1).status, 'rejected');

  const wrongRootCommand = contextCommand('context-wrong-root', projectA);
  const wrongRootRequested = module.updateDeveloperControlHost(
    module.createDeveloperControlHostState(),
    { type: 'host/context-requested', command: wrongRootCommand },
  ).state;
  const wrongRootRejected = module.updateDeveloperControlHost(wrongRootRequested, {
    type: 'host/context-admitted',
    commandId: wrongRootCommand.commandId,
    correlationId: wrongRootCommand.correlationId,
    bootstrap: bootstrap(projectB),
  }).state;
  assert.equal(wrongRootRejected.contextStatus, 'error');
  assert.equal(
    wrongRootRejected.error,
    'Context result Project does not match the requested Project.',
  );
  assert.equal(wrongRootRejected.bootstrap, null);
  assert.equal(wrongRootRejected.pendingCommands.length, 0);
  assert.equal(wrongRootRejected.commandResults.at(-1).status, 'rejected');

  const wrongRootRetryCommand = contextCommand('context-wrong-root-retry', projectA);
  const wrongRootRetry = module.updateDeveloperControlHost(wrongRootRejected, {
    type: 'host/context-requested',
    command: wrongRootRetryCommand,
  }).state;
  assert.equal(wrongRootRetry.contextStatus, 'loading');
  assert.equal(wrongRootRetry.error, null);
  assert.deepEqual(wrongRootRetry.pendingCommands, [wrongRootRetryCommand]);
  const retiredWrongRootReplay = module.updateDeveloperControlHost(wrongRootRetry, {
    type: 'host/context-admitted',
    commandId: wrongRootCommand.commandId,
    correlationId: wrongRootCommand.correlationId,
    bootstrap: bootstrap(projectB),
  }).state;
  assert.equal(retiredWrongRootReplay.contextStatus, 'loading');
  assert.deepEqual(retiredWrongRootReplay.pendingCommands, [wrongRootRetryCommand]);
  assert.equal(retiredWrongRootReplay.commandResults.at(-1).status, 'rejected');

  const wrongRootRetryAdmitted = module.updateDeveloperControlHost(retiredWrongRootReplay, {
    type: 'host/context-admitted',
    commandId: wrongRootRetryCommand.commandId,
    correlationId: wrongRootRetryCommand.correlationId,
    bootstrap: bootstrap(projectA),
  }).state;
  assert.equal(wrongRootRetryAdmitted.contextStatus, 'ready');
  assert.equal(wrongRootRetryAdmitted.bootstrap.context.project.root, projectA);
  assert.equal(wrongRootRetryAdmitted.pendingCommands.length, 0);
});

test('Project Workbench compresses admitted phase availability without a sidebar ledger', () => {
  const source = readFileSync(resolve(sourceRoot, 'capabilities/project-workbench/view.tsx'), 'utf8');
  const hostSource = readFileSync(resolve(sourceRoot, 'capabilities/host/DeveloperControlHost.tsx'), 'utf8');
  const styles = readFileSync(resolve(sourceRoot, 'app/styles.css'), 'utf8');
  const identity = source.slice(
    source.indexOf('<header className="project-workbench__identity">'),
    source.indexOf('</header>'),
  );
  assert.doesNotMatch(identity, /CapabilityAvailability/);
  assert.match(source, /phaseContributions\.find/);
  assert.match(source, /<CapabilityAvailabilityState/);
  assert.match(source, /readyLabel="available"/);
  assert.doesNotMatch(source, /project-workbench__ledger/);
  assert.match(hostSource, /phaseContributions=\{contributions\}/);
  assert.doesNotMatch(hostSource, /const capabilityLedger/);
  assert.doesNotMatch(styles, /project-workbench__ledger/);
});

test('host rejects unknown, duplicate, and uncorrelated capability traffic', async () => {
  const module = await loadTypeScriptModule('capabilities/host/state.ts');
  const initial = module.createDeveloperControlHostState();
  const duplicate = module.updateDeveloperControlHost(initial, {
    type: 'host/capability-registered',
    capabilityId: 'build-control',
  }).state;
  const unknown = module.updateDeveloperControlHost(duplicate, {
    type: 'host/capability-registered',
    capabilityId: 'not-a-capability',
  }).state;
  assert.deepEqual(unknown.registrationErrors, [
    'Duplicate capability: build-control',
    'Unknown capability: not-a-capability',
  ]);

  const uncorrelated = module.updateDeveloperControlHost(unknown, {
    type: 'host/context-admitted',
    commandId: 'unknown',
    correlationId: 'unknown',
    bootstrap: bootstrap('/workspace/project-a'),
  }).state;
  assert.equal(uncorrelated.bootstrap, null);
  assert.equal(uncorrelated.commandResults.at(-1).status, 'rejected');
});

test('navigation changes focus only after its correlated command is admitted', async () => {
  const module = await loadTypeScriptModule('capabilities/host/state.ts');
  const firstCommand = {
    type: 'host.project-navigation',
    commandId: 'navigation-1',
    correlationId: 'navigation-correlation-1',
    projectRoot: '/workspace/project-a',
    surface: 'run-inspector',
  };
  const firstRequested = module.updateDeveloperControlHost(
    module.createDeveloperControlHostState(),
    { type: 'host/navigation-requested', command: firstCommand },
  );
  assert.equal(firstRequested.state.activeSurface, 'project-workbench');
  assert.equal(firstRequested.state.requestedSurface, 'run-inspector');
  assert.deepEqual(firstRequested.commands, [firstCommand]);

  const latestCommand = {
    ...firstCommand,
    commandId: 'navigation-2',
    correlationId: 'navigation-correlation-2',
    surface: 'ticket-board',
  };
  const latestRequested = module.updateDeveloperControlHost(
    firstRequested.state,
    { type: 'host/navigation-requested', command: latestCommand },
  );
  assert.deepEqual(latestRequested.state.pendingCommands, [latestCommand]);
  assert.equal(latestRequested.state.requestedSurface, 'ticket-board');

  const lateSuccess = module.updateDeveloperControlHost(latestRequested.state, {
    type: 'host/navigation-admitted',
    commandId: firstCommand.commandId,
    correlationId: firstCommand.correlationId,
    surface: 'run-inspector',
  }).state;
  assert.strictEqual(lateSuccess, latestRequested.state);
  const lateFailure = module.updateDeveloperControlHost(latestRequested.state, {
    type: 'host/navigation-failed',
    commandId: firstCommand.commandId,
    correlationId: firstCommand.correlationId,
    error: 'retired navigation failed',
  }).state;
  assert.strictEqual(lateFailure, latestRequested.state);

  const admitted = module.updateDeveloperControlHost(latestRequested.state, {
    type: 'host/navigation-admitted',
    commandId: latestCommand.commandId,
    correlationId: latestCommand.correlationId,
    surface: latestCommand.surface,
  }).state;
  assert.equal(admitted.activeSurface, 'ticket-board');
  assert.equal(admitted.requestedSurface, null);
});

test('aggregate presents only admitted navigation through pending, failure, and Project switch replay', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const initial = module.createDeveloperControlAggregateState(projectA);

  const requested = module.updateDeveloperControlAggregate(initial, {
    type: 'aggregate/surface-requested',
    surface: 'run-inspector',
  });
  const navigation = requested.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(navigation);
  assert.equal(requested.state.host.requestedSurface, 'run-inspector');
  assert.equal(
    module.selectDeveloperControlPresentedSurface(requested.state),
    'project-workbench',
  );

  const failed = module.replayDeveloperControlAggregate(requested.state, [
    {
      type: 'aggregate/command-started',
      aggregateCommandId: navigation.aggregateCommandId,
    },
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: navigation.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/navigation-failed',
          commandId: navigation.command.commandId,
          correlationId: navigation.command.correlationId,
          error: 'navigation unavailable',
        },
      },
    },
  ]).state;
  assert.equal(failed.host.requestedSurface, null);
  assert.equal(
    module.selectDeveloperControlPresentedSurface(failed),
    'project-workbench',
  );

  const pendingSwitch = module.updateDeveloperControlAggregate(failed, {
    type: 'aggregate/surface-requested',
    surface: 'ticket-board',
  }).state;
  assert.equal(pendingSwitch.host.requestedSurface, 'ticket-board');
  const switched = module.replayDeveloperControlAggregate(pendingSwitch, [{
    type: 'aggregate/project-observed',
    projectRoot: projectB,
  }]).state;
  assert.equal(switched.projectRoot, projectB);
  assert.equal(switched.host.requestedSurface, null);
  assert.equal(
    module.selectDeveloperControlPresentedSurface(switched),
    'project-workbench',
  );
});

test('aggregate admits forensic focus only after navigation success and discards pending focus on Project switch', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const focusA = {
    projectRoot: projectA,
    executionId: 'execution-a',
    runRef: 'run://forensic/a',
    revision: 'revision-a',
    sourceRef: 'evidence://forensic/a',
  };
  const focusB = {
    projectRoot: projectA,
    executionId: 'execution-b',
    runRef: 'run://forensic/b',
    revision: 'revision-b',
    sourceRef: 'evidence://forensic/b',
  };
  let state = module.createDeveloperControlAggregateState(
    projectA,
    'run-inspector',
    focusA,
  );

  const firstRequest = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/surface-requested',
    surface: 'run-inspector',
    runFocus: focusB,
  });
  const failedNavigation = firstRequest.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(failedNavigation);
  assert.deepEqual(failedNavigation.command.runFocus, focusB);
  assert.deepEqual(firstRequest.state.runFocus, focusA);

  state = module.replayDeveloperControlAggregate(firstRequest.state, [
    {
      type: 'aggregate/command-started',
      aggregateCommandId: failedNavigation.aggregateCommandId,
    },
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: failedNavigation.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/navigation-failed',
          commandId: failedNavigation.command.commandId,
          correlationId: failedNavigation.command.correlationId,
          error: 'forensic navigation unavailable',
        },
      },
    },
  ]).state;
  assert.deepEqual(state.runFocus, focusA);
  assert.equal(state.host.requestedSurface, null);

  const secondRequest = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/surface-requested',
    surface: 'run-inspector',
    runFocus: focusB,
  });
  const admittedNavigation = secondRequest.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(admittedNavigation);
  assert.deepEqual(secondRequest.state.runFocus, focusA);

  state = module.replayDeveloperControlAggregate(secondRequest.state, [
    {
      type: 'aggregate/command-started',
      aggregateCommandId: admittedNavigation.aggregateCommandId,
    },
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: admittedNavigation.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/navigation-admitted',
          commandId: admittedNavigation.command.commandId,
          correlationId: admittedNavigation.command.correlationId,
          surface: admittedNavigation.command.surface,
        },
      },
    },
  ]).state;
  assert.deepEqual(state.runFocus, focusB);
  assert.equal(state.host.activeSurface, 'run-inspector');

  const pendingSwitch = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/surface-requested',
    surface: 'run-inspector',
    runFocus: focusA,
  }).state;
  assert.deepEqual(pendingSwitch.runFocus, focusB);
  assert.deepEqual(
    pendingSwitch.host.pendingCommands.find(
      (command) => command.type === 'host.project-navigation',
    )?.runFocus,
    focusA,
  );

  const switched = module.replayDeveloperControlAggregate(pendingSwitch, [{
    type: 'aggregate/project-observed',
    projectRoot: projectB,
  }]).state;
  assert.equal(switched.projectRoot, projectB);
  assert.equal(switched.runFocus, null);
  assert.equal(switched.host.requestedSurface, null);
});

test('host routes only schema-valid subscription events on the admitted Project and revision basis', async () => {
  const module = await loadTypeScriptModule('capabilities/host/state.ts');
  const root = '/workspace/project-a';
  const command = contextCommand('context-subscription', root);
  const ready = module.replayDeveloperControlHostMessages(
    module.createDeveloperControlHostState(),
    [
      { type: 'host/context-requested', command },
      {
        type: 'host/context-admitted',
        commandId: command.commandId,
        correlationId: command.correlationId,
        bootstrap: bootstrap(root),
      },
    ],
  ).state;
  const subscription = capabilitySubscriptionSchema.parse({
    schemaVersion: '1',
    subscriptionId: 'run-observation-project-a',
    capabilityId: 'run-observation',
    projectRoot: root,
    basisRevision: null,
    sourceRef: 'events://project-a/runs',
    eventKind: 'run.changed',
  });
  const declared = module.updateDeveloperControlHost(ready, {
    type: 'host/subscription-declared',
    subscription,
  }).state;
  assert.deepEqual(declared.subscriptions, [subscription]);

  const event = capabilitySubscriptionEventSchema.parse({
    schemaVersion: '1',
    eventId: 'event-1',
    subscriptionId: subscription.subscriptionId,
    capabilityId: subscription.capabilityId,
    projectRoot: root,
    basisRevision: null,
    observedAt: '2026-07-11T00:00:01.000Z',
    payload: { runId: 'run-1' },
  });
  const routed = module.updateDeveloperControlHost(declared, {
    type: 'host/subscription-event',
    event,
  });
  assert.deepEqual(routed.deliveries, [{
    capabilityId: 'run-observation',
    subscriptionId: subscription.subscriptionId,
    event,
  }]);

  const rejected = module.updateDeveloperControlHost(declared, {
    type: 'host/subscription-event',
    event: { ...event, eventId: 'event-stale', projectRoot: '/workspace/project-b' },
  });
  assert.deepEqual(rejected.deliveries, []);
  assert.match(rejected.state.registrationErrors.at(-1), /event-stale/);
});

test('proposal and Build replay emit typed carrier commands without shell execution text', async () => {
  const proposal = await loadTypeScriptModule('capabilities/specification-proposal/update.ts');
  const proposalState = await loadTypeScriptModule('capabilities/specification-proposal/state.ts');
  const build = await loadTypeScriptModule('capabilities/build-control/update.ts');
  const buildState = await loadTypeScriptModule('capabilities/build-control/state.ts');
  const project = {
    id: 'project-a',
    root: '/workspace/project-a',
    label: 'Project A',
    publishedProductRef: 'product://project-a',
  };
  const revision = {
    kind: 'commit',
    revision: 'a'.repeat(40),
    dirty: false,
    sourceDigest: 'a'.repeat(40),
    specificationDigest: 'sha256:spec-a',
    observedAt: '2026-07-11T00:00:00.000Z',
  };
  const context = proposal.updateSpecificationProposal(
    proposalState.createSpecificationProposalState(),
    { type: 'proposal/context-changed', project, revision },
  );
  assert.equal(context.commands[0].type, 'proposal.history');
  const loaded = proposal.updateSpecificationProposal(context.state, {
    type: 'proposal/history-loaded',
    commandId: context.commands[0].commandId,
    correlationId: context.commands[0].correlationId,
    projectRoot: project.root,
    history: {
      schemaVersion: '1',
      projectRoot: project.root,
      proposals: [],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://fixture'],
    },
  }).state;
  const requested = proposal.replaySpecificationProposalMessages(loaded, [
    { type: 'proposal/context-attachment-edited', value: 'specification/PRODUCT.md' },
    { type: 'proposal/context-attached' },
    { type: 'proposal/prompt-edited', value: 'Clarify the product boundary.' },
    { type: 'proposal/generate-requested' },
  ]);
  assert.equal(requested.commands.length, 1);
  assert.deepEqual(requested.commands[0].contextAttachmentRefs, ['specification/PRODUCT.md']);
  assert.equal(requested.commands[0].basisRevision.specificationDigest, revision.specificationDigest);

  const buildContext = build.updateBuildControl(buildState.createBuildControlState(), {
    type: 'build/context-changed', project, revision,
  });
  assert.equal(buildContext.commands[0].type, 'build.load');
  assert.equal(buildContext.commands[0].projectRoot, project.root);
  assert.match(
    readFileSync(resolve(sourceRoot, 'capabilities/specification-proposal/view.tsx'), 'utf8'),
    /proposal\/accept-requested/,
  );
  const buildView = readFileSync(resolve(sourceRoot, 'capabilities/build-control/view.tsx'), 'utf8');
  assert.match(buildView, /build\/submit-requested/);
  assert.doesNotMatch(buildView, /\/bin\/(?:ba)?sh|child_process|execFile|spawn\(/);
});

test('run observation emits navigation intent rather than performing an effect', async () => {
  const module = await loadTypeScriptModule('capabilities/run-observation/update.ts');
  const result = module.updateRunObservation(
    { selectedSurface: 'ai-workspace' },
    { type: 'run-observation/surface-requested', surface: 'run-inspector' },
  );
  assert.deepEqual(result, {
    state: { selectedSurface: 'run-inspector' },
    commands: [{ type: 'supporting-surface.open', surface: 'run-inspector' }],
  });
});

test('Assurance runtime revalidates exact execution focus and rejects missing or mismatched authority', async () => {
  const runtime = await loadTypeScriptModule(
    'effects/command-runtime/assurance-attention-command-runtime.ts',
  );
  const projectRoot = '/workspace/project-a';
  const basis = revision('a');
  const loadCommand = {
    type: 'assurance.load',
    commandId: 'assurance-load-1',
    correlationId: 'assurance:project-a:execution-a:1',
    projectRoot,
    basisRevision: basis,
    project: {
      id: 'project-a',
      root: projectRoot,
      label: 'Project A',
      publishedProductRef: 'product://project-a',
    },
    executionId: 'execution-a',
  };
  const driftedLoad = await withJsonFetch(
    assuranceSnapshot(projectRoot, revision('b')),
    () => runtime.interpretAssuranceAttentionCommand(loadCommand),
  );
  assert.deepEqual(driftedLoad, {
    type: 'assurance/command-failed',
    commandId: loadCommand.commandId,
    correlationId: loadCommand.correlationId,
    failureKind: 'stale_basis',
    error: 'Assurance response ProjectRevision is newer than or different from the pending load basis.',
  });

  const command = {
    type: 'assurance.open-run-inspector',
    commandId: 'assurance-inspect-1',
    correlationId: 'assurance:project-a:inspect:1',
    projectRoot,
    basisRevision: basis,
    executionId: 'execution-a',
    focusBasis: {
      kind: 'attention-reaction',
      attentionId: fixtureDepthAttentionId(),
      reactionRef: 'reaction://odd_manager/open-run-inspector',
      sourceRef: 'requirements://project-a/depth',
    },
  };

  const resolved = await withJsonFetch(
    assuranceSnapshot(projectRoot, basis),
    () => runtime.interpretAssuranceAttentionCommand(command),
  );
  assert.deepEqual(resolved, {
    type: 'assurance/inspector-focus-resolved',
    commandId: command.commandId,
    correlationId: command.correlationId,
    projectRoot,
    executionId: 'execution-a',
    runRef: 'run://fixture/a',
    revision: basis.revision,
    sourceRef: command.focusBasis.sourceRef,
  });

  const missingRun = await withJsonFetch(
    assuranceSnapshot(projectRoot, basis, { runRefs: [] }),
    () => runtime.interpretAssuranceAttentionCommand(command),
  );
  assert.equal(missingRun.type, 'assurance/inspector-focus-failed');
  assert.match(missingRun.error, /no admitted run reference/);

  const mismatchedExecution = await withJsonFetch(
    assuranceSnapshot(projectRoot, basis, { executionId: 'execution-b' }),
    () => runtime.interpretAssuranceAttentionCommand(command),
  );
  assert.equal(mismatchedExecution.type, 'assurance/inspector-focus-failed');
  assert.match(mismatchedExecution.error, /does not match the admitted Project, Revision, and Build Execution/);

  const mismatchedProject = await withJsonFetch(
    assuranceSnapshot('/workspace/project-b', basis),
    () => runtime.interpretAssuranceAttentionCommand(command),
  );
  assert.equal(mismatchedProject.type, 'assurance/inspector-focus-failed');
  assert.match(mismatchedProject.error, /does not match the admitted Project, Revision, and Build Execution/);

  const executionEvidenceCommand = {
    ...command,
    commandId: 'assurance-inspect-2',
    correlationId: 'assurance:project-a:inspect:2',
    focusBasis: {
      kind: 'execution-evidence',
      sourceRef: 'build-evidence-bundle://execution-a',
    },
  };
  const executionEvidenceResolved = await withJsonFetch(
    assuranceSnapshot(projectRoot, basis),
    () => runtime.interpretAssuranceAttentionCommand(executionEvidenceCommand),
  );
  assert.equal(executionEvidenceResolved.type, 'assurance/inspector-focus-resolved');
  assert.equal(executionEvidenceResolved.runRef, 'run://fixture/a');
  assert.equal(
    executionEvidenceResolved.sourceRef,
    'build-evidence-bundle://execution-a',
  );

  const mismatchedEvidence = await withJsonFetch(
    {
      ...assuranceSnapshot(projectRoot, basis),
      evidenceBundleRef: 'build-evidence-bundle://execution-other',
    },
    () => runtime.interpretAssuranceAttentionCommand(executionEvidenceCommand),
  );
  assert.equal(mismatchedEvidence.type, 'assurance/inspector-focus-failed');
  assert.match(mismatchedEvidence.error, /no longer carries the selected execution evidence/);
});

test('aggregate navigates from Assurance only after runtime admits a fresh non-null run reference', async () => {
  const aggregate = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const runtime = await loadTypeScriptModule(
    'effects/command-runtime/developer-control-aggregate-runtime.ts',
  );
  const projectRoot = '/workspace/project-a';
  const basis = revision('a');
  const staleSnapshot = assuranceSnapshot(projectRoot, basis, { runRefs: [] });
  let state = aggregate.createDeveloperControlAggregateState(projectRoot);
  state = {
    ...state,
    pendingCommands: [],
    host: {
      ...state.host,
      contextStatus: 'ready',
      bootstrap: {
        ...bootstrap(projectRoot),
        context: {
          ...bootstrap(projectRoot).context,
          revision: basis,
        },
      },
      pendingCommands: [],
    },
    assurance: {
      status: 'stale',
      project: staleSnapshot.execution.project,
      basisRevision: basis,
      executionId: 'execution-a',
      snapshot: staleSnapshot,
      filter: 'attention',
      selectedAssessmentRef: null,
      selectedAttentionId: staleSnapshot.attentionItems[0].attentionId,
      refreshQueued: false,
      pendingCommands: [],
      commandSequence: 0,
      error: null,
    },
  };

  const requested = aggregate.updateDeveloperControlAggregate(state, {
    type: 'aggregate/assurance-message',
    message: {
      type: 'attention/reaction-requested',
      attentionId: staleSnapshot.attentionItems[0].attentionId,
      reactionRef: 'reaction://odd_manager/open-run-inspector',
    },
  });
  const effect = requested.commands.find(
    (command) => command.type === 'aggregate.interpret-assurance',
  );
  assert.ok(effect);
  assert.equal(effect.command.type, 'assurance.open-run-inspector');
  assert.deepEqual(effect.command.focusBasis, {
    kind: 'attention-reaction',
    attentionId: staleSnapshot.attentionItems[0].attentionId,
    reactionRef: 'reaction://odd_manager/open-run-inspector',
    sourceRef: 'requirements://project-a/depth',
  });
  assert.equal(
    requested.commands.some((command) => (
      command.type === 'aggregate.interpret-host'
      && command.command.type === 'host.project-navigation'
    )),
    false,
  );

  const running = aggregate.updateDeveloperControlAggregate(requested.state, {
    type: 'aggregate/command-started',
    aggregateCommandId: effect.aggregateCommandId,
  }).state;
  const runningEffect = running.pendingCommands.find(
    (command) => command.aggregateCommandId === effect.aggregateCommandId,
  );
  const resolved = await withJsonFetch(
    assuranceSnapshot(projectRoot, basis),
    () => runtime.interpretDeveloperControlAggregateCommand(runningEffect, () => undefined),
  );
  const navigated = aggregate.updateDeveloperControlAggregate(running, resolved);
  const navigation = navigated.commands.find((command) => (
    command.type === 'aggregate.interpret-host'
    && command.command.type === 'host.project-navigation'
  ));
  assert.ok(navigation);
  assert.deepEqual(navigation.command.runFocus, {
    projectRoot,
    executionId: 'execution-a',
    runRef: 'run://fixture/a',
    revision: basis.revision,
    sourceRef: 'requirements://project-a/depth',
  });
});

test('Build Portfolio loads multiple Projects without changing Context and rejects late results', async () => {
  const module = await loadTypeScriptModule('capabilities/build-portfolio/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-portfolio/state.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const requestedA = module.updateBuildPortfolio(stateModule.createBuildPortfolioState(), {
    type: 'portfolio/context-changed',
    projectRoot: projectA,
  });
  assert.equal(requestedA.commands[0].type, 'portfolio.load');
  assert.equal(requestedA.state.contextProjectRoot, projectA);

  const requestedB = module.updateBuildPortfolio(requestedA.state, {
    type: 'portfolio/context-changed',
    projectRoot: projectB,
  });
  assert.equal(requestedB.state.contextProjectRoot, projectB);
  const late = module.updateBuildPortfolio(requestedB.state, {
    type: 'portfolio/load-succeeded',
    commandId: requestedA.commands[0].commandId,
    correlationId: requestedA.commands[0].correlationId,
    contextProjectRoot: projectA,
    portfolio: portfolio([projectA, projectB], projectA),
  });
  assert.equal(late.state.portfolio, null);

  const admitted = module.updateBuildPortfolio(requestedB.state, {
    type: 'portfolio/load-succeeded',
    commandId: requestedB.commands[0].commandId,
    correlationId: requestedB.commands[0].correlationId,
    contextProjectRoot: projectB,
    portfolio: portfolio([projectA, projectB], projectB),
  });
  assert.equal(admitted.state.portfolio.rows.length, 2);
  assert.equal(admitted.state.contextProjectRoot, projectB);
  assert.equal(admitted.state.selectedProjectId, 'project-1');

  const periodicLoad = module.updateBuildPortfolio(admitted.state, {
    type: 'portfolio/poll-ticked',
  });
  assert.equal(periodicLoad.commands.length, 1);
  assert.equal(periodicLoad.commands[0].type, 'portfolio.load');
  const coalescedPeriodicLoad = module.updateBuildPortfolio(periodicLoad.state, {
    type: 'portfolio/poll-ticked',
  });
  assert.strictEqual(coalescedPeriodicLoad.state, periodicLoad.state);
  assert.deepEqual(coalescedPeriodicLoad.commands, []);
  assert.equal(coalescedPeriodicLoad.state.refreshQueued, false);

  const semanticRequest = module.updateBuildPortfolio(
    stateModule.createBuildPortfolioState(),
    {
      type: 'portfolio/context-changed',
      projectRoot: projectB,
    },
  );
  const semanticCommand = semanticRequest.commands[0];
  const validSemanticPortfolio = portfolio([projectA, projectB], projectB);
  const duplicateProject = structuredClone(validSemanticPortfolio);
  duplicateProject.rows[1].project.id = duplicateProject.rows[0].project.id;
  const duplicateRoot = structuredClone(validSemanticPortfolio);
  duplicateRoot.rows[1].project.root = duplicateRoot.rows[0].project.root;
  const duplicateActive = structuredClone(validSemanticPortfolio);
  duplicateActive.rows[0].active = true;
  duplicateActive.rows[1].active = true;
  const duplicateAttention = structuredClone(validSemanticPortfolio);
  duplicateAttention.rows[1].attention[0].attentionId =
    duplicateAttention.rows[0].attention[0].attentionId;
  const incoherentLatestActivity = structuredClone(validSemanticPortfolio);
  incoherentLatestActivity.rows[0].buildActivity.latestExecutionId = 'execution-forged';
  incoherentLatestActivity.rows[0].buildActivity.latestState = 'queued';
  for (const [label, malformedPortfolio] of [
    ['duplicate Project identity', duplicateProject],
    ['duplicate Project root', duplicateRoot],
    ['multiple active Projects', duplicateActive],
    ['duplicate attention identity', duplicateAttention],
    ['incoherent latest activity', incoherentLatestActivity],
  ]) {
    const rejected = module.updateBuildPortfolio(semanticRequest.state, {
      type: 'portfolio/load-succeeded',
      commandId: semanticCommand.commandId,
      correlationId: semanticCommand.correlationId,
      contextProjectRoot: projectB,
      portfolio: malformedPortfolio,
    });
    assert.equal(rejected.state, semanticRequest.state, label);
    assert.deepEqual(rejected.commands, [], label);
    assert.deepEqual(rejected.state.pendingCommands, [semanticCommand], label);
  }

  const refresh = module.updateBuildPortfolio(admitted.state, {
    type: 'portfolio/refresh-requested',
  });
  assert.equal(refresh.commands.length, 1);
  assert.equal(refresh.commands[0].type, 'portfolio.load');
  assert.equal(refresh.state.refreshQueued, false);
  const staleLoad = refresh.commands[0];

  const queuedRefresh = module.updateBuildPortfolio(refresh.state, {
    type: 'portfolio/refresh-requested',
  });
  assert.deepEqual(queuedRefresh.commands, []);
  assert.equal(queuedRefresh.state.refreshQueued, true);
  assert.equal(
    queuedRefresh.state.pendingCommands.some(
      (command) => command.commandId === staleLoad.commandId,
    ),
    true,
  );

  const registration = module.updateBuildPortfolio(queuedRefresh.state, {
    type: 'portfolio/project-register-requested',
    path: '/workspace/project-c',
  });
  const registerCommand = registration.commands[0];
  assert.equal(registerCommand.type, 'portfolio.register');
  const mutationSucceeded = module.updateBuildPortfolio(registration.state, {
    type: 'portfolio/project-registered',
    commandId: registerCommand.commandId,
    correlationId: registerCommand.correlationId,
    path: registerCommand.path,
    projectId: 'project-c',
    projectRoot: registerCommand.path,
  });
  assert.deepEqual(mutationSucceeded.commands, []);
  assert.equal(mutationSucceeded.state.refreshQueued, true);
  assert.equal(
    mutationSucceeded.state.pendingCommands.some(
      (command) => command.commandId === registerCommand.commandId,
    ),
    false,
  );
  assert.equal(
    mutationSucceeded.state.pendingCommands.some(
      (command) => command.commandId === staleLoad.commandId,
    ),
    true,
  );

  const stalePortfolio = {
    ...portfolio([projectA, projectB], projectB),
    observedAt: '2026-07-11T00:01:00.000Z',
  };
  const followUp = module.updateBuildPortfolio(mutationSucceeded.state, {
    type: 'portfolio/load-succeeded',
    commandId: staleLoad.commandId,
    correlationId: staleLoad.correlationId,
    contextProjectRoot: projectB,
    portfolio: stalePortfolio,
  });
  assert.equal(followUp.commands.length, 1);
  assert.equal(followUp.commands[0].type, 'portfolio.load');
  assert.notEqual(followUp.commands[0].commandId, staleLoad.commandId);
  assert.equal(followUp.state.portfolio, admitted.state.portfolio);
  assert.equal(followUp.state.refreshQueued, false);
  assert.equal(
    followUp.state.pendingCommands.some(
      (command) => command.commandId === staleLoad.commandId,
    ),
    false,
  );

  const duplicateStale = module.updateBuildPortfolio(followUp.state, {
    type: 'portfolio/load-succeeded',
    commandId: staleLoad.commandId,
    correlationId: staleLoad.correlationId,
    contextProjectRoot: projectB,
    portfolio: stalePortfolio,
  });
  assert.equal(duplicateStale.state, followUp.state);
  assert.deepEqual(duplicateStale.commands, []);

  const freshLoad = followUp.commands[0];
  const freshPortfolio = {
    ...portfolio([projectA, projectB, '/workspace/project-c'], projectB),
    observedAt: '2026-07-11T00:02:00.000Z',
  };
  const freshAdmitted = module.updateBuildPortfolio(followUp.state, {
    type: 'portfolio/load-succeeded',
    commandId: freshLoad.commandId,
    correlationId: freshLoad.correlationId,
    contextProjectRoot: projectB,
    portfolio: freshPortfolio,
  });
  assert.equal(freshAdmitted.state.status, 'ready');
  assert.deepEqual(freshAdmitted.state.portfolio, freshPortfolio);
  assert.equal(freshAdmitted.state.refreshQueued, false);
  assert.equal(freshAdmitted.state.pendingCommands.length, 0);
  assert.deepEqual(freshAdmitted.commands, []);

  const cleared = module.updateBuildPortfolio(admitted.state, {
    type: 'portfolio/context-cleared',
  });
  assert.equal(cleared.state.contextProjectRoot, null);
  assert.equal(cleared.state.portfolio, null);
  assert.equal(cleared.state.pendingCommands.length, 0);
  assert.equal(cleared.state.commandSequence, admitted.state.commandSequence);
  assert.equal(cleared.state.scope, admitted.state.scope);
  assert.equal(cleared.state.sort, admitted.state.sort);
  assert.deepEqual(cleared.commands, []);
});

test('Build Portfolio command ingress admits only schema-valid portfolio, browser, and registry payloads', async () => {
  const module = await loadTypeScriptModule('effects/command-runtime/build-portfolio-command-runtime.ts');
  const projectRoot = '/workspace/project-a';
  const baseCommand = {
    commandId: 'portfolio-ingress-1',
    correlationId: 'portfolio:/workspace/project-a:1',
    contextProjectRoot: projectRoot,
  };

  const loaded = await withJsonFetch(
    portfolio([projectRoot]),
    () => module.interpretBuildPortfolioCommand({ ...baseCommand, type: 'portfolio.load' }),
  );
  assert.equal(loaded.type, 'portfolio/load-succeeded');
  assert.equal(loaded.portfolio.rows[0].project.root, projectRoot);

  const rejectedPortfolio = await withJsonFetch(
    { ...portfolio([projectRoot]), rows: [{ project: { root: projectRoot } }] },
    () => module.interpretBuildPortfolioCommand({ ...baseCommand, type: 'portfolio.load' }),
  );
  assert.equal(rejectedPortfolio.type, 'portfolio/command-failed');
  assert.equal('portfolio' in rejectedPortfolio, false);

  const browserPayload = {
    path: '/workspace',
    parent: '/',
    entries: [{
      name: 'project-a',
      absolutePath: projectRoot,
      kind: 'directory',
      updatedAt: '2026-07-11T00:00:00.000Z',
      hasWorkspace: true,
      markers: ['.ai-workspace'],
      profile: {
        primary_identity: 'odd_manager',
        governance_identities: [],
        active_domain_pack: null,
        shell_title: 'Project A',
        confidence: 'high',
        markers: ['.ai-workspace'],
      },
    }],
    truncated: false,
    state: 'present',
  };
  const browsed = await withJsonFetch(
    browserPayload,
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.browse',
      path: '/workspace',
    }),
  );
  assert.equal(browsed.type, 'portfolio/browser-loaded');
  assert.equal(browsed.entries[0].absolutePath, projectRoot);

  const rejectedBrowser = await withJsonFetch(
    {
      ...browserPayload,
      entries: [{ ...browserPayload.entries[0], absolutePath: 42 }],
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.browse',
      path: '/workspace',
    }),
  );
  assert.equal(rejectedBrowser.type, 'portfolio/command-failed');
  assert.equal('entries' in rejectedBrowser, false);

  const project = registryProject(projectRoot);
  const activated = await withJsonFetch(
    {
      ok: true,
      project,
      projects: [project],
      diagnostic: registryDiagnostic(projectRoot),
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.activate',
      projectId: project.id,
      projectRoot,
    }),
  );
  assert.equal(activated.type, 'portfolio/project-activated');
  assert.equal(activated.projectId, project.id);
  assert.equal(activated.projectRoot, projectRoot);

  const otherProject = {
    ...project,
    id: 'project-other',
    root: '/workspace/project-other',
    name: 'Project Other',
  };
  const rejectedRegistry = await withJsonFetch(
    {
      ok: true,
      project: otherProject,
      projects: [otherProject],
      diagnostic: registryDiagnostic(otherProject.root),
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.activate',
      projectId: project.id,
      projectRoot,
    }),
  );
  assert.equal(rejectedRegistry.type, 'portfolio/command-failed');
  assert.equal('projectRoot' in rejectedRegistry, false);
  assert.equal(rejectedRegistry.failedCommand.type, 'portfolio.activate');
  assert.equal(rejectedRegistry.failedCommand.projectId, project.id);
  assert.equal(rejectedRegistry.failedCommand.projectRoot, projectRoot);

  const collaboration = await loadTypeScriptModule('lib/collaboration.ts');
  const registry = await withJsonFetch(
    {
      projects: [project],
      diagnostic: registryDiagnostic(projectRoot),
    },
    () => collaboration.loadProjectRegistry(),
  );
  assert.equal(registry.projects[0].root, projectRoot);
  await assert.rejects(() => withJsonFetch(
    {
      projects: [{ id: project.id, root: projectRoot }],
      diagnostic: registryDiagnostic(projectRoot),
    },
    () => collaboration.loadProjectRegistry(),
  ));

  const registeredProject = {
    ...project,
    id: 'project-new',
    root: '/workspace/project-new',
    name: 'Project New',
    is_active: false,
  };
  const registered = await withJsonFetch(
    {
      ok: true,
      project: registeredProject,
      projects: [project, registeredProject],
      diagnostic: registryDiagnostic(projectRoot, 2),
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.register',
      path: registeredProject.root,
    }),
  );
  assert.equal(registered.type, 'portfolio/project-registered');
  assert.equal(registered.path, registeredProject.root);
  assert.equal(registered.projectId, registeredProject.id);
  assert.equal(registered.projectRoot, registeredProject.root);

  const inactiveOtherProject = { ...otherProject, is_active: false };
  const rejectedRegistration = await withJsonFetch(
    {
      ok: true,
      project: inactiveOtherProject,
      projects: [project, inactiveOtherProject],
      diagnostic: registryDiagnostic(projectRoot, 2),
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.register',
      path: registeredProject.root,
    }),
  );
  assert.equal(rejectedRegistration.type, 'portfolio/command-failed');
  assert.equal(rejectedRegistration.failedCommand.type, 'portfolio.register');
  assert.equal(rejectedRegistration.failedCommand.path, registeredProject.root);

  const unregistered = await withJsonFetch(
    {
      ok: true,
      removed: project,
      projects: [],
      diagnostic: registryDiagnostic(null, 0),
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.unregister',
      projectId: project.id,
      projectRoot,
    }),
  );
  assert.equal(unregistered.type, 'portfolio/project-unregistered');
  assert.equal(unregistered.projectId, project.id);
  assert.equal(unregistered.projectRoot, projectRoot);

  const rejectedRemoval = await withJsonFetch(
    {
      ok: true,
      removed: otherProject,
      projects: [project],
      diagnostic: registryDiagnostic(projectRoot),
    },
    () => module.interpretBuildPortfolioCommand({
      ...baseCommand,
      type: 'portfolio.unregister',
      projectId: project.id,
      projectRoot,
    }),
  );
  assert.equal(rejectedRemoval.type, 'portfolio/command-failed');
  assert.equal(rejectedRemoval.failedCommand.type, 'portfolio.unregister');
  assert.equal(rejectedRemoval.failedCommand.projectId, project.id);
  assert.equal(rejectedRemoval.failedCommand.projectRoot, projectRoot);
});

test('Build Portfolio browser and registry actions remain explicit correlated commands', async () => {
  const module = await loadTypeScriptModule('capabilities/build-portfolio/update.ts');
  const stateModule = await loadTypeScriptModule('capabilities/build-portfolio/state.ts');
  const loaded = module.replayBuildPortfolioMessages(stateModule.createBuildPortfolioState(), [
    { type: 'portfolio/context-changed', projectRoot: '/workspace/project-a' },
  ]).state;
  const openedDuringLoad = module.updateBuildPortfolio(loaded, {
    type: 'portfolio/browser-toggled',
    open: true,
  });
  assert.equal(openedDuringLoad.state.browser.open, true);
  assert.deepEqual(openedDuringLoad.commands, []);
  const resumedAfterLoad = module.updateBuildPortfolio(openedDuringLoad.state, {
    type: 'portfolio/load-succeeded',
    commandId: loaded.pendingCommands[0].commandId,
    correlationId: loaded.pendingCommands[0].correlationId,
    contextProjectRoot: '/workspace/project-a',
    portfolio: portfolio(['/workspace/project-a']),
  });
  assert.equal(resumedAfterLoad.commands[0].type, 'portfolio.browse');
  assert.equal(resumedAfterLoad.commands[0].path, '/workspace');

  const withPortfolio = {
    ...loaded,
    status: 'ready',
    portfolio: portfolio(['/workspace/project-a']),
    pendingCommands: [],
  };
  const browser = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/browser-toggled',
    open: true,
  });
  assert.equal(browser.commands[0].type, 'portfolio.browse');
  assert.equal(browser.commands[0].path, '/workspace');

  const register = module.updateBuildPortfolio(browser.state, {
    type: 'portfolio/project-register-requested',
    path: '/workspace/new-project',
  });
  assert.equal(register.commands[0].type, 'portfolio.register');
  assert.equal(register.commands[0].path, '/workspace/new-project');

  const activate = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-activate-requested',
    projectId: 'project-0',
  });
  assert.equal(activate.commands[0].type, 'portfolio.activate');
  assert.equal(activate.commands[0].contextProjectRoot, '/workspace/project-a');
  assert.equal(activate.commands[0].projectRoot, '/workspace/project-a');
  const forgedActivation = module.updateBuildPortfolio(activate.state, {
    type: 'portfolio/project-activated',
    commandId: activate.commands[0].commandId,
    correlationId: activate.commands[0].correlationId,
    projectId: 'project-0',
    projectRoot: '/workspace/project-other',
  });
  assert.equal(forgedActivation.state, activate.state);
  const admittedActivation = module.updateBuildPortfolio(activate.state, {
    type: 'portfolio/project-activated',
    commandId: activate.commands[0].commandId,
    correlationId: activate.commands[0].correlationId,
    projectId: activate.commands[0].projectId,
    projectRoot: activate.commands[0].projectRoot,
  });
  assert.equal(admittedActivation.state.activatedProjectRoot, '/workspace/project-a');
  assert.equal(admittedActivation.state.pendingCommands.length, 0);

  const activateFailure = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-activate-requested',
    projectId: 'project-0',
  });
  const wrongActivateFailure = module.updateBuildPortfolio(activateFailure.state, {
    type: 'portfolio/command-failed',
    commandId: activateFailure.commands[0].commandId,
    correlationId: activateFailure.commands[0].correlationId,
    failedCommand: {
      ...activateFailure.commands[0],
      projectRoot: '/workspace/project-other',
    },
    error: 'forged target',
  });
  assert.equal(wrongActivateFailure.state, activateFailure.state);
  const wrongActivateFailureType = module.updateBuildPortfolio(activateFailure.state, {
    type: 'portfolio/command-failed',
    commandId: activateFailure.commands[0].commandId,
    correlationId: activateFailure.commands[0].correlationId,
    failedCommand: {
      ...activateFailure.commands[0],
      type: 'portfolio.unregister',
    },
    error: 'forged command type',
  });
  assert.equal(wrongActivateFailureType.state, activateFailure.state);
  const admittedActivateFailure = module.updateBuildPortfolio(activateFailure.state, {
    type: 'portfolio/command-failed',
    commandId: activateFailure.commands[0].commandId,
    correlationId: activateFailure.commands[0].correlationId,
    failedCommand: activateFailure.commands[0],
    error: 'activation failed',
  });
  assert.equal(admittedActivateFailure.state.pendingCommands.length, 0);
  assert.equal(admittedActivateFailure.state.actionError, 'activation failed');

  const registerResult = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-register-requested',
    path: '/workspace/new-project',
  });
  const forgedRegistration = module.updateBuildPortfolio(registerResult.state, {
    type: 'portfolio/project-registered',
    commandId: registerResult.commands[0].commandId,
    correlationId: registerResult.commands[0].correlationId,
    path: '/workspace/new-project',
    projectId: 'project-new',
    projectRoot: '/workspace/project-other',
  });
  assert.equal(forgedRegistration.state, registerResult.state);
  const admittedRegistration = module.updateBuildPortfolio(registerResult.state, {
    type: 'portfolio/project-registered',
    commandId: registerResult.commands[0].commandId,
    correlationId: registerResult.commands[0].correlationId,
    path: registerResult.commands[0].path,
    projectId: 'project-new',
    projectRoot: registerResult.commands[0].path,
  });
  assert.equal(admittedRegistration.commands[0].type, 'portfolio.load');
  assert.equal(
    admittedRegistration.state.pendingCommands.some(
      (command) => command.type === 'portfolio.register',
    ),
    false,
  );

  const registerFailure = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-register-requested',
    path: '/workspace/new-project',
  });
  const wrongRegisterFailure = module.updateBuildPortfolio(registerFailure.state, {
    type: 'portfolio/command-failed',
    commandId: registerFailure.commands[0].commandId,
    correlationId: registerFailure.commands[0].correlationId,
    failedCommand: {
      ...registerFailure.commands[0],
      path: '/workspace/project-other',
    },
    error: 'forged target',
  });
  assert.equal(wrongRegisterFailure.state, registerFailure.state);

  const unregister = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-unregister-requested',
    projectId: 'project-0',
  });
  assert.equal(unregister.commands[0].type, 'portfolio.unregister');
  assert.equal(unregister.commands[0].projectRoot, '/workspace/project-a');
  const forgedUnregistration = module.updateBuildPortfolio(unregister.state, {
    type: 'portfolio/project-unregistered',
    commandId: unregister.commands[0].commandId,
    correlationId: unregister.commands[0].correlationId,
    projectId: 'project-0',
    projectRoot: '/workspace/project-other',
  });
  assert.equal(forgedUnregistration.state, unregister.state);
  const admittedUnregistration = module.updateBuildPortfolio(unregister.state, {
    type: 'portfolio/project-unregistered',
    commandId: unregister.commands[0].commandId,
    correlationId: unregister.commands[0].correlationId,
    projectId: unregister.commands[0].projectId,
    projectRoot: unregister.commands[0].projectRoot,
  });
  assert.equal(admittedUnregistration.commands[0].type, 'portfolio.load');
  assert.equal(
    admittedUnregistration.state.pendingCommands.some(
      (command) => command.type === 'portfolio.unregister',
    ),
    false,
  );

  const unregisterFailure = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-unregister-requested',
    projectId: 'project-0',
  });
  const wrongUnregisterFailure = module.updateBuildPortfolio(unregisterFailure.state, {
    type: 'portfolio/command-failed',
    commandId: unregisterFailure.commands[0].commandId,
    correlationId: unregisterFailure.commands[0].correlationId,
    failedCommand: {
      ...unregisterFailure.commands[0],
      projectId: 'project-other',
    },
    error: 'forged target',
  });
  assert.equal(wrongUnregisterFailure.state, unregisterFailure.state);

  const missingProjectRequest = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/project-activate-requested',
    projectId: 'project-missing',
  });
  assert.deepEqual(missingProjectRequest.commands, []);

  const attention = module.updateBuildPortfolio(withPortfolio, {
    type: 'portfolio/attention-open-requested',
    projectId: 'project-0',
    attentionId: 'attention-0',
  });
  assert.equal(attention.commands[0].type, 'portfolio.open-attention');
  assert.equal(attention.commands[0].projectRoot, '/workspace/project-a');
  assert.equal(attention.commands[0].sourceRef, 'descriptor://0');
  assert.equal(attention.commands[0].targetCapabilityId, 'build-control');
  const opened = module.updateBuildPortfolio(attention.state, {
    type: 'portfolio/attention-opened',
    commandId: attention.commands[0].commandId,
    correlationId: attention.commands[0].correlationId,
    projectRoot: attention.commands[0].projectRoot,
    attentionId: attention.commands[0].attentionId,
    sourceKind: attention.commands[0].sourceKind,
    sourceRef: attention.commands[0].sourceRef,
    targetCapabilityId: attention.commands[0].targetCapabilityId,
  });
  assert.deepEqual(opened.state.openedAttention, {
    projectRoot: '/workspace/project-a',
    attentionId: 'attention-0',
    sourceKind: 'build-carrier',
    sourceRef: 'descriptor://0',
    targetCapabilityId: 'build-control',
  });
});

test('Build Portfolio derives attention labels and routes from one total selector', async () => {
  const module = await loadTypeScriptModule('capabilities/build-portfolio/selectors.ts');
  assert.deepEqual(module.buildPortfolioAttentionTarget('revision'), {
    capabilityId: 'specification-proposal',
    actionLabel: 'Open Tune',
  });
  assert.deepEqual(module.buildPortfolioAttentionTarget('specification'), {
    capabilityId: 'specification-proposal',
    actionLabel: 'Open Tune',
  });
  assert.deepEqual(module.buildPortfolioAttentionTarget('build-carrier'), {
    capabilityId: 'build-control',
    actionLabel: 'Open Build',
  });
  assert.deepEqual(module.buildPortfolioAttentionTarget('build-execution'), {
    capabilityId: 'build-control',
    actionLabel: 'Open Build',
  });
  assert.deepEqual(module.buildPortfolioAttentionTarget('future-evidence-kind'), {
    capabilityId: 'assurance-attention',
    actionLabel: 'Open Assure',
  });
});

test('portfolio and Build subscriptions cover their declared active lifecycle states', async () => {
  const portfolio = await loadTypeScriptModule('capabilities/build-portfolio/subscriptions.ts');
  const build = await loadTypeScriptModule('capabilities/build-control/subscriptions.ts');
  const projectRoot = '/workspace/project-a';
  const basisRevision = revision('a');

  assert.deepEqual(
    portfolio.buildPortfolioSubscriptions({
      portfolio: {
        rows: [{
          buildActivity: {
            queuedCount: 0,
            runningCount: 1,
          },
        }],
      },
    }, projectRoot, basisRevision),
    [{
      type: 'portfolio.poll',
      projectRoot,
      basisRevision,
      intervalMs: 800,
    }],
  );
  assert.deepEqual(
    portfolio.buildPortfolioSubscriptions(
      { portfolio: { rows: [] } },
      projectRoot,
      basisRevision,
    ),
    [],
  );

  assert.deepEqual(
    build.buildControlSubscriptions({
      snapshot: {
        executions: [{ state: 'waiting_human' }],
      },
    }, projectRoot, basisRevision),
    [{
      type: 'build.poll',
      projectRoot,
      basisRevision,
      intervalMs: 600,
    }],
  );
  assert.deepEqual(
    build.buildControlSubscriptions({
      snapshot: {
        executions: [{ state: 'converged' }],
      },
    }, projectRoot, basisRevision),
    [],
  );
});

test('host integration replay owns attention routing without effect decisions', async () => {
  const module = await loadTypeScriptModule('capabilities/host/integration.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const proposalFocus = {
    projectRoot: projectB,
    projectId: 'project-b',
    attentionId: 'attention-proposal',
    sourceKind: 'specification',
    sourceRef: 'specification://requirement',
    targetCapabilityId: 'specification-proposal',
  };

  const observed = module.updateDeveloperControlIntegration(
    module.createDeveloperControlIntegrationState(),
    {
      type: 'integration/attention-observed',
      focus: proposalFocus,
      activeProjectRoot: projectA,
    },
  );
  assert.deepEqual(
    observed.commands.map((command) => command.type),
    ['integration.activate-project'],
  );
  const consumed = module.updateDeveloperControlIntegration(observed.state, {
    type: 'integration/command-consumed',
    commandId: observed.commands[0].commandId,
  }).state;
  const proposalReady = module.updateDeveloperControlIntegration(consumed, {
    type: 'integration/reconcile',
    activeProjectRoot: projectB,
    contextProjectRoot: projectB,
    buildExecutionIds: [],
    buildProjectionReady: false,
    assuranceAttentionIds: [],
    assuranceProjectionReady: false,
  });
  assert.deepEqual(
    proposalReady.commands.map((command) => [
      command.type,
      'message' in command ? command.message.type : null,
    ]),
    [
      ['integration.dispatch-workbench', 'workbench/phase-selected'],
      ['integration.dispatch-proposal', 'proposal/context-attached'],
    ],
  );
  assert.equal(proposalReady.state.attentionFocus, null);

  const buildFocus = {
    projectRoot: projectA,
    projectId: 'project-a',
    attentionId: 'attention-build',
    sourceKind: 'build-execution',
    sourceRef: 'build-execution://execution-1',
    targetCapabilityId: 'build-control',
  };
  const buildObserved = module.updateDeveloperControlIntegration(
    module.createDeveloperControlIntegrationState(),
    {
      type: 'integration/attention-observed',
      focus: buildFocus,
      activeProjectRoot: projectA,
    },
  ).state;
  const buildWaiting = module.updateDeveloperControlIntegration(buildObserved, {
    type: 'integration/reconcile',
    activeProjectRoot: projectA,
    contextProjectRoot: projectA,
    buildExecutionIds: [],
    buildProjectionReady: false,
    assuranceAttentionIds: [],
    assuranceProjectionReady: false,
  });
  assert.deepEqual(
    buildWaiting.commands.map((command) => command.type),
    ['integration.dispatch-workbench'],
  );
  assert.equal(buildWaiting.state.attentionPrepared, true);
  const buildReady = module.updateDeveloperControlIntegration(buildWaiting.state, {
    type: 'integration/reconcile',
    activeProjectRoot: projectA,
    contextProjectRoot: projectA,
    buildExecutionIds: ['execution-1'],
    buildProjectionReady: true,
    assuranceAttentionIds: [],
    assuranceProjectionReady: false,
  });
  assert.deepEqual(
    buildReady.commands.map((command) => [
      command.type,
      'message' in command ? command.message.type : null,
    ]),
    [['integration.dispatch-build', 'build/execution-selected']],
  );
  assert.equal(buildReady.state.attentionFocus, null);
});

test('aggregate replay owns cross-capability command lifecycle and admitted run focus', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const initialFocus = {
    projectRoot: projectA,
    executionId: 'execution-1',
    runRef: 'run://1',
    revision: 'revision-1',
    sourceRef: 'evidence://1',
  };
  let state = module.createDeveloperControlAggregateState(
    projectA,
    'run-inspector',
    initialFocus,
  );
  assert.deepEqual(
    state.pendingCommands.map((command) => command.type),
    ['aggregate.interpret-host'],
  );
  assert.equal(state.portfolio.contextProjectRoot, null);
  assert.equal(state.runFocus.executionId, 'execution-1');

  const contextEffect = state.pendingCommands[0];
  state = module.replayDeveloperControlAggregate(state, [
    {
      type: 'aggregate/command-started',
      aggregateCommandId: contextEffect.aggregateCommandId,
    },
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: contextEffect.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/context-admitted',
          commandId: contextEffect.command.commandId,
          correlationId: contextEffect.command.correlationId,
          bootstrap: bootstrap(projectA),
        },
      },
    },
  ]).state;
  assert.equal(state.host.contextStatus, 'ready');
  assert.equal(state.host.bootstrap.context.project.root, projectA);
  assert.equal(state.portfolio.contextProjectRoot, projectA);
  assert.ok(state.pendingCommands.some(
    (command) => command.type === 'aggregate.interpret-portfolio' && command.envelope,
  ));
  assert.equal(
    state.pendingCommands.some((command) => (
      command.aggregateCommandId === contextEffect.aggregateCommandId
    )),
    false,
  );

  const requested = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/surface-requested',
    surface: 'run-inspector',
    runFocus: initialFocus,
  });
  const navigation = requested.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(navigation);
  assert.equal(navigation.command.type, 'host.project-navigation');
  assert.deepEqual(navigation.command.runFocus, initialFocus);

  const activation = module.updateDeveloperControlAggregate(requested.state, {
    type: 'aggregate/project-activation-requested',
    projectRoot: projectB,
  });
  assert.equal(
    activation.commands.at(-1).type,
    'aggregate.activate-project',
  );
  const observed = module.updateDeveloperControlAggregate(activation.state, {
    type: 'aggregate/project-observed',
    projectRoot: projectB,
  });
  assert.equal(observed.state.projectRoot, projectB);
  assert.equal(observed.state.runFocus, null);
  assert.deepEqual(
    observed.commands.map((command) => command.type),
    ['aggregate.interpret-host'],
  );
  assert.equal(observed.state.portfolio.contextProjectRoot, null);
});

test('aggregate Project switch retires prior Project work and ignores a late proposal completion', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const projectA = {
    id: 'project-a',
    root: '/workspace/project-a',
    label: 'Project A',
    publishedProductRef: 'product://project-a',
  };
  const projectB = '/workspace/project-b';
  const basisRevision = {
    kind: 'commit',
    revision: 'a'.repeat(40),
    dirty: false,
    sourceDigest: 'a'.repeat(40),
    specificationDigest: 'sha256:spec-a',
    observedAt: '2026-07-11T00:00:00.000Z',
  };
  const proposal = {
    proposalId: 'proposal-a',
    project: projectA,
    basisRevision,
    status: 'valid',
  };
  const command = {
    type: 'proposal.accept',
    commandId: 'proposal-accept-a',
    correlationId: 'proposal:/workspace/project-a:accept',
    projectRoot: projectA.root,
    basisRevision,
    proposalId: proposal.proposalId,
    actorRef: 'actor://operator/jim',
  };
  const aggregateCommand = {
    type: 'aggregate.interpret-proposal',
    aggregateCommandId: 'aggregate-proposal-accept-a',
    status: 'running',
    command,
  };
  let state = module.createDeveloperControlAggregateState(projectA.root);
  state = {
    ...state,
    proposal: {
      ...state.proposal,
      status: 'accepting',
      project: projectA,
      basisRevision,
      currentProposal: proposal,
      pendingCommands: [command],
    },
    pendingCommands: [aggregateCommand],
  };

  const switched = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/project-observed',
    projectRoot: projectB,
  }).state;
  assert.equal(switched.projectRoot, projectB);
  assert.equal(switched.host.requestedProjectRoot, projectB);
  assert.equal(switched.proposal.project, null);
  assert.equal(
    switched.pendingCommands.some(
      (pending) => pending.aggregateCommandId === aggregateCommand.aggregateCommandId,
    ),
    false,
  );

  const late = module.updateDeveloperControlAggregate(switched, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: aggregateCommand.aggregateCommandId,
    result: {
      type: 'proposal',
      message: {
        type: 'proposal/accepted',
        commandId: command.commandId,
        correlationId: command.correlationId,
        projectRoot: projectA.root,
        proposal: {
          ...proposal,
          status: 'accepted',
        },
      },
    },
  }).state;
  assert.equal(late.projectRoot, projectB);
  assert.equal(late.host.requestedProjectRoot, projectB);
  assert.equal(
    late.pendingCommands.some(
      (pending) => 'command' in pending && pending.command.projectRoot === projectA.root,
    ),
    false,
  );
});

test('aggregate Project switch preserves only target-Project attention through Context admission', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const projectA = '/workspace/project-a';
  const projectB = '/workspace/project-b';
  const focus = {
    projectRoot: projectB,
    projectId: 'project-b',
    attentionId: 'attention-proposal',
    sourceKind: 'specification',
    sourceRef: 'specification://requirement',
    targetCapabilityId: 'specification-proposal',
  };
  let state = module.createDeveloperControlAggregateState(projectA);
  state = {
    ...state,
    integration: {
      ...state.integration,
      attentionFocus: focus,
    },
  };

  state = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/project-observed',
    projectRoot: projectB,
  }).state;
  assert.deepEqual(state.integration.attentionFocus, focus);
  const contextCommand = state.pendingCommands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(contextCommand);

  state = module.replayDeveloperControlAggregate(state, [
    {
      type: 'aggregate/command-started',
      aggregateCommandId: contextCommand.aggregateCommandId,
    },
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: contextCommand.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/context-admitted',
          commandId: contextCommand.command.commandId,
          correlationId: contextCommand.command.correlationId,
          bootstrap: bootstrap(projectB),
        },
      },
    },
  ]).state;
  assert.equal(state.workbench.activePhase, 'tune');
  assert.deepEqual(state.proposal.contextAttachmentRefs, [focus.sourceRef]);
  assert.equal(state.integration.attentionFocus, null);
});

test('aggregate result admission binds the outer command to the exact inner identity', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const project = {
    id: 'project-a',
    root: '/workspace/project-a',
    label: 'Project A',
    publishedProductRef: 'product://project-a',
  };
  const basisRevision = {
    kind: 'commit',
    revision: 'a'.repeat(40),
    dirty: false,
    sourceDigest: 'a'.repeat(40),
    specificationDigest: 'sha256:spec-a',
    observedAt: '2026-07-11T00:00:00.000Z',
  };
  const proposalCommands = ['a', 'b'].map((suffix) => ({
    type: 'proposal.generate',
    commandId: `proposal-generate-${suffix}`,
    correlationId: `proposal:${project.root}:${suffix}`,
    project,
    basisRevision,
    prompt: `Proposal ${suffix}`,
    contextAttachmentRefs: [],
    predecessorProposalId: null,
  }));
  const aggregateCommands = proposalCommands.map((command, index) => ({
    type: 'aggregate.interpret-proposal',
    aggregateCommandId: `aggregate-proposal-${index + 1}`,
    status: 'running',
    command,
  }));
  let state = module.createDeveloperControlAggregateState(project.root);
  state = {
    ...state,
    proposal: {
      ...state.proposal,
      status: 'generating',
      project,
      basisRevision,
      pendingCommands: proposalCommands,
    },
    pendingCommands: aggregateCommands,
  };

  const mismatched = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: aggregateCommands[0].aggregateCommandId,
    result: {
      type: 'proposal',
      message: {
        type: 'proposal/generated',
        commandId: proposalCommands[1].commandId,
        correlationId: proposalCommands[1].correlationId,
        projectRoot: project.root,
        proposal: {
          proposalId: 'proposal-b',
          project,
          basisRevision,
          status: 'draft',
        },
      },
    },
  }).state;
  assert.deepEqual(mismatched.pendingCommands, [aggregateCommands[1]]);
  assert.deepEqual(mismatched.proposal.pendingCommands, [proposalCommands[1]]);
  assert.equal(mismatched.proposal.currentProposal, null);
  assert.match(mismatched.membraneErrors.at(-1), /result mismatch/);

  const runningReference = mismatched.pendingCommands[0];
  const duplicateStart = module.updateDeveloperControlAggregate(mismatched, {
    type: 'aggregate/command-started',
    aggregateCommandId: runningReference.aggregateCommandId,
  }).state;
  assert.equal(duplicateStart.pendingCommands[0], runningReference);

  const unknownFailure = module.updateDeveloperControlAggregate(duplicateStart, {
    type: 'aggregate/command-failed',
    aggregateCommandId: 'aggregate-command-unknown',
    error: 'must not enter the membrane ledger',
  }).state;
  assert.deepEqual(unknownFailure.membraneErrors, duplicateStart.membraneErrors);

  const activationCommand = {
    type: 'aggregate.activate-project',
    aggregateCommandId: 'aggregate-activate-project-a',
    status: 'running',
    projectRoot: project.root,
  };
  const activationState = {
    ...unknownFailure,
    pendingCommands: [activationCommand],
  };
  const wrongActivation = module.updateDeveloperControlAggregate(activationState, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: activationCommand.aggregateCommandId,
    result: {
      type: 'project-activated',
      projectRoot: '/workspace/project-b',
    },
  }).state;
  assert.deepEqual(wrongActivation.pendingCommands, []);
  assert.match(wrongActivation.membraneErrors.at(-1), /result mismatch/);

  const wrongKindActivation = module.updateDeveloperControlAggregate(activationState, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: activationCommand.aggregateCommandId,
    result: {
      type: 'host',
      message: {
        type: 'host/context-failed',
        commandId: 'wrong-kind',
        correlationId: 'wrong-kind',
        error: 'wrong result kind',
      },
    },
  }).state;
  assert.deepEqual(wrongKindActivation.pendingCommands, []);
  assert.match(wrongKindActivation.membraneErrors.at(-1), /result mismatch/);

  const malformedActivation = module.updateDeveloperControlAggregate(activationState, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: activationCommand.aggregateCommandId,
    result: null,
  }).state;
  assert.deepEqual(malformedActivation.pendingCommands, []);
  assert.match(malformedActivation.membraneErrors.at(-1), /result mismatch/);

  const activationRetry = module.updateDeveloperControlAggregate(malformedActivation, {
    type: 'aggregate/project-activation-requested',
    projectRoot: '/workspace/project-b',
  });
  const activationRetryCommand = activationRetry.commands.find(
    (candidate) => candidate.type === 'aggregate.activate-project',
  );
  assert.ok(activationRetryCommand);
  const activationRetryRunning = module.updateDeveloperControlAggregate(
    activationRetry.state,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: activationRetryCommand.aggregateCommandId,
    },
  ).state;
  const activationRetryResolved = module.updateDeveloperControlAggregate(
    activationRetryRunning,
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: activationRetryCommand.aggregateCommandId,
      result: {
        type: 'project-activated',
        projectRoot: activationRetryCommand.projectRoot,
      },
    },
  ).state;
  assert.equal(
    activationRetryResolved.pendingCommands.some(
      (candidate) => candidate.aggregateCommandId === activationRetryCommand.aggregateCommandId,
    ),
    false,
  );
  assert.equal(
    activationRetryResolved.membraneErrors.at(-1),
    malformedActivation.membraneErrors.at(-1),
  );

  const directDeliveries = [
    {
      wrapper: 'aggregate/portfolio-message',
      stateKey: 'portfolio',
      message: {
        type: 'portfolio/load-succeeded',
        commandId: 'forged-portfolio',
        correlationId: 'forged-portfolio-correlation',
      },
    },
    {
      wrapper: 'aggregate/proposal-message',
      stateKey: 'proposal',
      message: {
        type: 'proposal/generate-failed',
        commandId: 'forged-proposal',
        correlationId: 'forged-proposal-correlation',
        error: 'forged proposal failure',
      },
    },
    {
      wrapper: 'aggregate/build-message',
      stateKey: 'build',
      message: {
        type: 'build/snapshot-loaded',
        commandId: 'forged-build',
        correlationId: 'forged-build-correlation',
      },
    },
    {
      wrapper: 'aggregate/assurance-message',
      stateKey: 'assurance',
      message: {
        type: 'assurance/load-failed',
        commandId: 'forged-assurance',
        correlationId: 'forged-assurance-correlation',
        error: 'forged assurance failure',
      },
    },
  ];
  let ingressState = module.createDeveloperControlAggregateState(project.root);
  const pendingHostCommand = ingressState.host.pendingCommands.find(
    (command) => command.type === 'host.resolve-context',
  );
  assert.ok(pendingHostCommand);
  const directHostResult = module.updateDeveloperControlAggregate(ingressState, {
    type: 'aggregate/host-message',
    message: {
      type: 'host/context-admitted',
      commandId: pendingHostCommand.commandId,
      correlationId: pendingHostCommand.correlationId,
      bootstrap: bootstrap(project.root),
    },
  });
  assert.equal(directHostResult.state.host, ingressState.host);
  assert.deepEqual(
    directHostResult.state.pendingCommands,
    ingressState.pendingCommands,
  );
  assert.deepEqual(directHostResult.commands, []);
  assert.match(
    directHostResult.state.membraneErrors.at(-1),
    /Direct Host result rejected/,
  );
  ingressState = directHostResult.state;

  for (const direct of directDeliveries) {
    const priorCapabilityState = ingressState[direct.stateKey];
    const rejected = module.updateDeveloperControlAggregate(ingressState, {
      type: direct.wrapper,
      message: direct.message,
    });
    assert.equal(rejected.state[direct.stateKey], priorCapabilityState);
    assert.deepEqual(rejected.commands, []);
    assert.match(rejected.state.membraneErrors.at(-1), /Direct capability result rejected/);
    ingressState = rejected.state;
  }

  const declaredSubscription = {
    subscriptionId: 'host-lawful-event',
    capabilityId: 'build-portfolio',
    projectRoot: project.root,
    basisRevision: null,
    eventKinds: ['registry.changed'],
  };
  const lawfulHostState = {
    ...ingressState,
    host: {
      ...ingressState.host,
      subscriptions: [declaredSubscription],
    },
  };
  const lawfulHostEvent = module.updateDeveloperControlAggregate(lawfulHostState, {
    type: 'aggregate/host-message',
    message: {
      type: 'host/subscription-cleared',
      subscriptionId: declaredSubscription.subscriptionId,
    },
  }).state;
  assert.deepEqual(lawfulHostEvent.host.subscriptions, []);
  assert.equal(
    lawfulHostEvent.membraneErrors.at(-1),
    ingressState.membraneErrors.at(-1),
  );

  const uiPortfolio = module.updateDeveloperControlAggregate(lawfulHostEvent, {
    type: 'aggregate/portfolio-message',
    message: { type: 'portfolio/scope-selected', scope: 'attention' },
  }).state;
  assert.equal(uiPortfolio.portfolio.scope, 'attention');
  const uiProposal = module.updateDeveloperControlAggregate(uiPortfolio, {
    type: 'aggregate/proposal-message',
    message: { type: 'proposal/prompt-edited', value: 'admitted UI prompt' },
  }).state;
  assert.equal(uiProposal.proposal.promptDraft, 'admitted UI prompt');
  const uiBuild = module.updateDeveloperControlAggregate(uiProposal, {
    type: 'aggregate/build-message',
    message: { type: 'build/input-edited', value: '{"admitted":true}' },
  }).state;
  assert.equal(uiBuild.build.inputDraft, '{"admitted":true}');
  const uiAssurance = module.updateDeveloperControlAggregate(uiBuild, {
    type: 'aggregate/assurance-message',
    message: { type: 'assurance/filter-selected', filter: 'attention' },
  }).state;
  assert.equal(uiAssurance.assurance.filter, 'attention');
});

test('aggregate subscription ticks are admitted from the current declaration, not caller shape', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const project = {
    id: 'project-a',
    root: '/workspace/project-a',
    label: 'Project A',
    publishedProductRef: 'product://project-a',
  };
  const basisRevision = {
    kind: 'commit',
    revision: 'a'.repeat(40),
    dirty: false,
    sourceDigest: 'a'.repeat(40),
    specificationDigest: 'sha256:spec-a',
    observedAt: '2026-07-11T00:00:00.000Z',
  };
  const initial = module.createDeveloperControlAggregateState(project.root);
  const state = {
    ...initial,
    host: {
      ...initial.host,
      contextStatus: 'ready',
      bootstrap: {
        ...bootstrap(project.root),
        context: {
          ...bootstrap(project.root).context,
          project,
          revision: basisRevision,
        },
      },
      pendingCommands: [],
    },
    pendingCommands: [],
    build: {
      ...initial.build,
      status: 'ready',
      project,
      basisRevision,
      snapshot: {
        executions: [{ state: 'running' }],
      },
    },
  };
  const declaration = module.selectDeveloperControlAggregateSubscriptions(state).find(
    (subscription) => subscription.type === 'build.poll',
  );
  assert.ok(declaration);
  assert.deepEqual(declaration.basisRevision, basisRevision);
  assert.match(declaration.subscriptionId, /aggregate\.build\.poll/);

  const spoofed = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/subscription-ticked',
    subscription: {
      ...declaration,
      basisRevision: revision('b'),
    },
  });
  assert.equal(spoofed.state.build, state.build);
  assert.deepEqual(spoofed.commands, []);

  const ticked = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/subscription-ticked',
    subscription: declaration,
  });
  assert.ok(ticked.commands.some((command) => (
    command.type === 'aggregate.interpret-build'
    && command.command.type === 'build.load'
    && command.command.basisRevision.revision === basisRevision.revision
  )));
  const repeatedBuildTick = module.updateDeveloperControlAggregate(ticked.state, {
    type: 'aggregate/subscription-ticked',
    subscription: declaration,
  });
  assert.deepEqual(repeatedBuildTick.commands, []);
  assert.equal(
    repeatedBuildTick.state.build.pendingCommands.filter(
      (command) => command.type === 'build.load',
    ).length,
    1,
  );

  const activePortfolio = structuredClone(portfolio([project.root], project.root));
  activePortfolio.rows[0].buildActivity = {
    queuedCount: 0,
    runningCount: 1,
    waitingHumanCount: 0,
    terminalCount: 0,
    latestExecutionId: 'execution-a',
    latestState: 'running',
    sourceRefs: ['build-execution://execution-a'],
  };
  const portfolioState = {
    ...state,
    portfolio: {
      ...state.portfolio,
      status: 'ready',
      contextProjectRoot: project.root,
      portfolio: activePortfolio,
    },
  };
  const portfolioDeclaration = module.selectDeveloperControlAggregateSubscriptions(
    portfolioState,
  ).find((subscription) => subscription.type === 'portfolio.poll');
  assert.ok(portfolioDeclaration);
  const portfolioTicked = module.updateDeveloperControlAggregate(portfolioState, {
    type: 'aggregate/subscription-ticked',
    subscription: portfolioDeclaration,
  });
  assert.ok(portfolioTicked.commands.some((command) => (
    command.type === 'aggregate.interpret-portfolio'
    && command.command.type === 'portfolio.load'
  )));
  const repeatedPortfolioTick = module.updateDeveloperControlAggregate(
    portfolioTicked.state,
    {
      type: 'aggregate/subscription-ticked',
      subscription: portfolioDeclaration,
    },
  );
  assert.deepEqual(repeatedPortfolioTick.commands, []);
  assert.equal(repeatedPortfolioTick.state.portfolio.refreshQueued, false);
  assert.equal(
    repeatedPortfolioTick.state.portfolio.pendingCommands.filter(
      (command) => command.type === 'portfolio.load',
    ).length,
    1,
  );

  const nextBasis = revision('b');
  const repricedState = {
    ...state,
    host: {
      ...state.host,
      bootstrap: {
        ...state.host.bootstrap,
        context: {
          ...state.host.bootstrap.context,
          revision: nextBasis,
        },
      },
    },
  };
  const repricedDeclaration = module.selectDeveloperControlAggregateSubscriptions(
    repricedState,
  ).find((subscription) => subscription.type === 'build.poll');
  assert.ok(repricedDeclaration);
  assert.notEqual(repricedDeclaration.subscriptionId, declaration.subscriptionId);
  assert.deepEqual(repricedDeclaration.basisRevision, nextBasis);

  const staleTick = module.updateDeveloperControlAggregate(repricedState, {
    type: 'aggregate/subscription-ticked',
    subscription: declaration,
  });
  assert.equal(staleTick.state.build, repricedState.build);
  assert.deepEqual(staleTick.commands, []);

  const staleFailure = module.updateDeveloperControlAggregate(repricedState, {
    type: 'aggregate/subscription-failed',
    subscription: declaration,
    error: 'stale revision listener',
  }).state;
  assert.deepEqual(staleFailure.subscriptionFailures, []);

  const admittedFailure = module.updateDeveloperControlAggregate(repricedState, {
    type: 'aggregate/subscription-failed',
    subscription: repricedDeclaration,
    error: 'current revision listener',
  }).state;
  assert.deepEqual(admittedFailure.subscriptionFailures, [{
    subscriptionId: repricedDeclaration.subscriptionId,
    subscriptionType: 'build.poll',
    projectRoot: project.root,
    basisRevision: nextBasis,
    error: 'current revision listener',
  }]);
});

test('aggregate preserves one explicit Build continuation behind an admitted poll', async () => {
  const aggregate = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const runtime = await loadTypeScriptModule(
    'effects/command-runtime/developer-control-aggregate-runtime.ts',
  );
  const projectRoot = '/workspace/project-a';
  const basisRevision = revision('a');
  const fixture = runningBuildControlFixture(projectRoot, basisRevision);
  const initial = aggregate.createDeveloperControlAggregateState(projectRoot);
  const state = {
    ...initial,
    host: {
      ...initial.host,
      contextStatus: 'ready',
      bootstrap: {
        ...bootstrap(projectRoot),
        context: {
          ...bootstrap(projectRoot).context,
          project: fixture.project,
          revision: basisRevision,
        },
      },
      pendingCommands: [],
    },
    build: {
      ...initial.build,
      status: 'ready',
      project: fixture.project,
      basisRevision,
      snapshot: fixture.snapshot,
      selectedExecutionId: fixture.execution.executionId,
    },
    pendingCommands: [],
  };
  const declaration = aggregate.selectDeveloperControlAggregateSubscriptions(state).find(
    (subscription) => subscription.type === 'build.poll',
  );
  assert.ok(declaration);
  const ticked = aggregate.updateDeveloperControlAggregate(state, {
    type: 'aggregate/subscription-ticked',
    subscription: declaration,
  });
  const pollCommand = ticked.commands.find((command) => (
    command.type === 'aggregate.interpret-build'
    && command.command.type === 'build.load'
  ));
  assert.ok(pollCommand);

  const manualBehindPoll = aggregate.updateDeveloperControlAggregate(ticked.state, {
    type: 'aggregate/build-message',
    message: { type: 'build/refresh-requested' },
  });
  assert.deepEqual(manualBehindPoll.commands, []);
  assert.equal(manualBehindPoll.state.build.refreshQueued, true);
  assert.equal(
    manualBehindPoll.state.build.pendingCommands.filter(
      (command) => command.type === 'build.load',
    ).length,
    1,
  );

  const cancelRequested = aggregate.updateDeveloperControlAggregate(ticked.state, {
    type: 'aggregate/build-message',
    message: {
      type: 'build/cancel-requested',
      actorRef: 'actor://operator/test',
    },
  });
  const cancelCommand = cancelRequested.commands.find((command) => (
    command.type === 'aggregate.interpret-build'
    && command.command.type === 'build.cancel'
  ));
  assert.ok(cancelCommand);
  const cancelRunning = aggregate.updateDeveloperControlAggregate(
    cancelRequested.state,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: cancelCommand.aggregateCommandId,
    },
  ).state;
  const admittedCancelCommand = cancelRunning.pendingCommands.find(
    (command) => command.aggregateCommandId === cancelCommand.aggregateCommandId,
  );
  const acknowledgedExecution = {
    ...fixture.execution,
    updatedAt: '2026-07-11T00:02:00.000Z',
    heartbeatAt: '2026-07-11T00:02:00.000Z',
    cancelRequestedAt: '2026-07-11T00:02:00.000Z',
    cancelledBy: 'actor://operator/test',
  };
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ execution: acknowledgedExecution }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
    const acknowledgedResult = await runtime.interpretDeveloperControlAggregateCommand(
      admittedCancelCommand,
      () => {},
    );
    const acknowledged = aggregate.updateDeveloperControlAggregate(
      cancelRunning,
      acknowledgedResult,
    );
    assert.equal(acknowledged.state.build.refreshQueued, true);
    assert.equal(
      acknowledged.state.build.pendingCommands.filter(
        (command) => command.type === 'build.load',
      ).length,
      1,
    );
    assert.equal(
      acknowledged.state.build.pendingCommands.some(
        (command) => command.commandId === cancelCommand.command.commandId,
      ),
      false,
    );
    assert.equal(
      acknowledged.commands.some((command) => (
        command.type === 'aggregate.interpret-build'
        && command.command.type === 'build.load'
      )),
      false,
    );

    const pollRunning = aggregate.updateDeveloperControlAggregate(
      acknowledged.state,
      {
        type: 'aggregate/command-started',
        aggregateCommandId: pollCommand.aggregateCommandId,
      },
    ).state;
    const admittedPollCommand = pollRunning.pendingCommands.find(
      (command) => command.aggregateCommandId === pollCommand.aggregateCommandId,
    );
    globalThis.fetch = async () => new Response(
      JSON.stringify({ error: 'superseded poll failed' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    );
    const failedPollResult = await runtime.interpretDeveloperControlAggregateCommand(
      admittedPollCommand,
      () => {},
    );
    const followedUp = aggregate.updateDeveloperControlAggregate(
      pollRunning,
      failedPollResult,
    );
    assert.equal(followedUp.state.build.refreshQueued, false);
    assert.ok(followedUp.commands.some((command) => (
      command.type === 'aggregate.interpret-build'
      && command.command.type === 'build.load'
      && command.command.commandId !== pollCommand.command.commandId
    )));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('aggregate defers capability work until Context admission and then gives it a schema-valid shared envelope', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const projectRoot = '/workspace/project-envelope';
  const firstBootstrap = {
    ...bootstrap(projectRoot),
    context: {
      ...bootstrap(projectRoot).context,
      revision: revision('a'),
    },
  };
  const malformedHostInitial = module.createDeveloperControlAggregateState(projectRoot);
  const malformedHostCommand = malformedHostInitial.pendingCommands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  const malformedHostRunning = module.updateDeveloperControlAggregate(
    malformedHostInitial,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: malformedHostCommand.aggregateCommandId,
    },
  ).state;
  const malformedHostResult = module.updateDeveloperControlAggregate(
    malformedHostRunning,
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: malformedHostCommand.aggregateCommandId,
      result: {
        type: 'host',
        message: null,
      },
    },
  ).state;
  assert.equal(malformedHostResult.pendingCommands.length, 0);
  assert.equal(malformedHostResult.host.pendingCommands.length, 0);
  assert.equal(malformedHostResult.host.contextStatus, 'error');
  assert.equal(
    malformedHostResult.host.error,
    `Aggregate command result mismatch: ${malformedHostCommand.aggregateCommandId}.`,
  );
  assert.match(malformedHostResult.membraneErrors.at(-1), /result mismatch/);

  const wrongKindHostInitial = module.createDeveloperControlAggregateState(projectRoot);
  const wrongKindHostCommand = wrongKindHostInitial.pendingCommands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  const wrongKindHostRunning = module.updateDeveloperControlAggregate(
    wrongKindHostInitial,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: wrongKindHostCommand.aggregateCommandId,
    },
  ).state;
  const wrongKindHostResult = module.updateDeveloperControlAggregate(
    wrongKindHostRunning,
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: wrongKindHostCommand.aggregateCommandId,
      result: {
        type: 'project-activated',
        projectRoot,
      },
    },
  ).state;
  assert.equal(wrongKindHostResult.pendingCommands.length, 0);
  assert.equal(wrongKindHostResult.host.pendingCommands.length, 0);
  assert.equal(wrongKindHostResult.host.contextStatus, 'error');
  assert.match(wrongKindHostResult.membraneErrors.at(-1), /result mismatch/);

  const malformedHostRetry = module.updateDeveloperControlAggregate(
    malformedHostResult,
    { type: 'aggregate/context-retry-requested' },
  );
  const malformedHostRetryCommand = malformedHostRetry.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(malformedHostRetryCommand);
  const malformedHostRetryRunning = module.updateDeveloperControlAggregate(
    malformedHostRetry.state,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: malformedHostRetryCommand.aggregateCommandId,
    },
  ).state;
  const malformedHostRetryAdmitted = module.updateDeveloperControlAggregate(
    malformedHostRetryRunning,
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: malformedHostRetryCommand.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/context-admitted',
          commandId: malformedHostRetryCommand.command.commandId,
          correlationId: malformedHostRetryCommand.command.correlationId,
          bootstrap: firstBootstrap,
        },
      },
    },
  ).state;
  assert.equal(malformedHostRetryAdmitted.host.contextStatus, 'ready');
  assert.equal(malformedHostRetryAdmitted.host.bootstrap.context.project.root, projectRoot);
  assert.equal(
    malformedHostRetryAdmitted.pendingCommands.some(
      (command) => command.aggregateCommandId === malformedHostRetryCommand.aggregateCommandId,
    ),
    false,
  );

  let wrongRootState = module.createDeveloperControlAggregateState(projectRoot);
  const wrongRootContextCommand = wrongRootState.pendingCommands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  wrongRootState = module.updateDeveloperControlAggregate(wrongRootState, {
    type: 'aggregate/command-started',
    aggregateCommandId: wrongRootContextCommand.aggregateCommandId,
  }).state;
  const wrongRootResolved = module.updateDeveloperControlAggregate(wrongRootState, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: wrongRootContextCommand.aggregateCommandId,
    result: {
      type: 'host',
      message: {
        type: 'host/context-admitted',
        commandId: wrongRootContextCommand.command.commandId,
        correlationId: wrongRootContextCommand.command.correlationId,
        bootstrap: bootstrap('/workspace/project-wrong'),
      },
    },
  }).state;
  assert.equal(wrongRootResolved.host.contextStatus, 'error');
  assert.equal(
    wrongRootResolved.host.error,
    'Context result Project does not match the requested Project.',
  );
  assert.equal(wrongRootResolved.host.pendingCommands.length, 0);
  assert.equal(wrongRootResolved.pendingCommands.length, 0);

  const wrongRootRetry = module.updateDeveloperControlAggregate(wrongRootResolved, {
    type: 'aggregate/context-retry-requested',
  });
  const wrongRootRetryCommand = wrongRootRetry.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(wrongRootRetryCommand);
  const wrongRootRetryRunning = module.updateDeveloperControlAggregate(
    wrongRootRetry.state,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: wrongRootRetryCommand.aggregateCommandId,
    },
  ).state;
  const wrongRootRetryAdmitted = module.updateDeveloperControlAggregate(
    wrongRootRetryRunning,
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: wrongRootRetryCommand.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/context-admitted',
          commandId: wrongRootRetryCommand.command.commandId,
          correlationId: wrongRootRetryCommand.command.correlationId,
          bootstrap: firstBootstrap,
        },
      },
    },
  ).state;
  assert.equal(wrongRootRetryAdmitted.host.contextStatus, 'ready');
  assert.equal(wrongRootRetryAdmitted.host.bootstrap.context.project.root, projectRoot);
  assert.equal(
    wrongRootRetryAdmitted.pendingCommands.some(
      (command) => command.aggregateCommandId === wrongRootRetryCommand.aggregateCommandId,
    ),
    false,
  );

  let state = module.createDeveloperControlAggregateState(projectRoot);
  assert.deepEqual(
    state.pendingCommands.map((command) => command.type),
    ['aggregate.interpret-host'],
  );
  assert.equal(state.portfolio.contextProjectRoot, null);
  const contextCommand = state.pendingCommands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(contextCommand);
  state = module.replayDeveloperControlAggregate(state, [
    {
      type: 'aggregate/command-started',
      aggregateCommandId: contextCommand.aggregateCommandId,
    },
    {
      type: 'aggregate/command-resolved',
      aggregateCommandId: contextCommand.aggregateCommandId,
      result: {
        type: 'host',
        message: {
          type: 'host/context-admitted',
          commandId: contextCommand.command.commandId,
          correlationId: contextCommand.command.correlationId,
          bootstrap: firstBootstrap,
        },
      },
    },
  ]).state;
  const capabilityCommands = state.pendingCommands.filter((command) => (
    command.type !== 'aggregate.interpret-host'
  ));
  assert.ok(capabilityCommands.length > 0);
  assert.ok(capabilityCommands.some((command) => command.type === 'aggregate.interpret-portfolio'));
  for (const command of capabilityCommands) {
    assert.ok(command.envelope, `${command.type} must carry the shared envelope`);
    assert.equal(command.envelope.commandId, command.command.commandId);
    assert.equal(command.envelope.correlationId, command.command.correlationId);
    assert.equal(command.envelope.kind, command.command.type);
    assert.equal(command.envelope.context.project.root, projectRoot);
    assert.deepEqual(command.envelope.context.revision, revision('a'));
  }

  const retiredCapabilityCommand = capabilityCommands.find(
    (command) => command.type === 'aggregate.interpret-portfolio',
  );
  const retryRequested = module.updateDeveloperControlAggregate(state, {
    type: 'aggregate/context-retry-requested',
  });
  const retryContextCommand = retryRequested.commands.find(
    (command) => command.type === 'aggregate.interpret-host',
  );
  assert.ok(retryContextCommand);
  const retryRunning = module.updateDeveloperControlAggregate(
    retryRequested.state,
    {
      type: 'aggregate/command-started',
      aggregateCommandId: retryContextCommand.aggregateCommandId,
    },
  ).state;
  const refreshed = module.updateDeveloperControlAggregate(retryRunning, {
    type: 'aggregate/command-resolved',
    aggregateCommandId: retryContextCommand.aggregateCommandId,
    result: {
      type: 'host',
      message: {
        type: 'host/context-admitted',
        commandId: retryContextCommand.command.commandId,
        correlationId: retryContextCommand.command.correlationId,
        bootstrap: {
          ...bootstrap(projectRoot),
          context: {
            ...bootstrap(projectRoot).context,
            revision: revision('b'),
          },
        },
      },
    },
  }).state;
  assert.equal(
    refreshed.pendingCommands.some(
      (command) => command.aggregateCommandId === retiredCapabilityCommand.aggregateCommandId,
    ),
    false,
  );
  assert.equal(
    refreshed.pendingCommands
      .filter((command) => command.envelope)
      .every((command) => (
        command.envelope.context.revision.revision === revision('b').revision
      )),
    true,
  );
});

test('aggregate runtime validates and returns the shared envelope/result carrier', async () => {
  const runtime = await loadTypeScriptModule('effects/command-runtime/developer-control-aggregate-runtime.ts');
  const projectRoot = '/workspace/project-envelope-runtime';
  const context = {
    ...bootstrap(projectRoot).context,
    revision: revision('a'),
  };
  const command = {
    type: 'aggregate.interpret-portfolio',
    aggregateCommandId: 'aggregate-envelope-runtime',
    status: 'running',
    command: {
      type: 'portfolio.load',
      commandId: 'portfolio-load-1',
      correlationId: 'portfolio:/workspace/project-envelope-runtime:1',
      contextProjectRoot: projectRoot,
    },
    envelope: {
      schemaVersion: '1',
      commandId: 'portfolio-load-1',
      correlationId: 'portfolio:/workspace/project-envelope-runtime:1',
      capabilityId: 'build-portfolio',
      kind: 'portfolio.load',
      context,
      requestedBy: 'odd-manager://aggregate',
      requestedAt: 'aggregate:portfolio-load-1',
      payload: { type: 'portfolio.load' },
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => portfolio([projectRoot]),
  });
  try {
    const resolved = await runtime.interpretDeveloperControlAggregateCommand(command, () => {});
    assert.equal(resolved.type, 'aggregate/command-resolved');
    assert.equal(resolved.result.type, 'portfolio');
    assert.deepEqual(resolved.result.envelope, command.envelope);
    assert.equal(resolved.result.commandResult.status, 'succeeded');
    assert.equal(resolved.result.commandResult.commandId, command.command.commandId);
    assert.equal(resolved.result.commandResult.correlationId, command.command.correlationId);

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ rows: 'not-a-portfolio' }),
    });
    const failed = await runtime.interpretDeveloperControlAggregateCommand(command, () => {});
    assert.equal(failed.type, 'aggregate/command-resolved');
    assert.equal(failed.result.type, 'portfolio');
    assert.equal(failed.result.message.type, 'portfolio/command-failed');
    assert.equal(failed.result.commandResult.status, 'failed');
    assert.equal(
      failed.result.commandResult.failureKind,
      failed.result.message.type,
    );
    assert.equal(failed.result.commandResult.error, failed.result.message.error);
    assert.equal(failed.result.commandResult.retryable, false);
    assert.deepEqual(failed.result.commandResult.value, failed.result.message);
    commandResultSchema.parse(failed.result.commandResult);

    const aggregate = await loadTypeScriptModule('capabilities/host/aggregate.ts');
    const initial = aggregate.createDeveloperControlAggregateState(projectRoot);
    const running = {
      ...initial,
      host: {
        ...initial.host,
        contextStatus: 'ready',
        bootstrap: {
          ...bootstrap(projectRoot),
          context,
        },
        pendingCommands: [],
      },
      portfolio: {
        ...initial.portfolio,
        status: 'loading',
        contextProjectRoot: projectRoot,
        pendingCommands: [command.command],
        commandSequence: 1,
      },
      pendingCommands: [command],
    };
    const assertRetiredMismatch = (mismatchState) => {
      assert.equal(mismatchState.pendingCommands.length, 0);
      assert.equal(mismatchState.portfolio.pendingCommands.length, 0);
      assert.equal(mismatchState.portfolio.status, 'error');
      assert.equal(
        mismatchState.portfolio.error,
        `Aggregate command result mismatch: ${command.aggregateCommandId}.`,
      );
      assert.match(mismatchState.membraneErrors.at(-1), /result mismatch/);
    };

    const malformedCommandResult = aggregate.updateDeveloperControlAggregate(running, {
      ...resolved,
      result: {
        ...resolved.result,
        commandResult: {
          status: 'succeeded',
          commandId: command.command.commandId,
          correlationId: command.command.correlationId,
          completedAt: 42,
          sourceRefs: ['fixture://malformed-command-result'],
          value: resolved.result.message,
        },
      },
    }).state;
    assertRetiredMismatch(malformedCommandResult);

    const retryRequested = aggregate.updateDeveloperControlAggregate(
      malformedCommandResult,
      {
        type: 'aggregate/portfolio-message',
        message: { type: 'portfolio/refresh-requested' },
      },
    );
    const retryCommand = retryRequested.commands.find(
      (candidate) => candidate.type === 'aggregate.interpret-portfolio',
    );
    assert.ok(retryCommand);
    assert.notEqual(retryCommand.command.commandId, command.command.commandId);
    const retryRunning = aggregate.updateDeveloperControlAggregate(
      retryRequested.state,
      {
        type: 'aggregate/command-started',
        aggregateCommandId: retryCommand.aggregateCommandId,
      },
    ).state;
    const admittedRetryCommand = retryRunning.pendingCommands.find(
      (candidate) => candidate.aggregateCommandId === retryCommand.aggregateCommandId,
    );
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => portfolio([projectRoot]),
    });
    const retryResolved = await runtime.interpretDeveloperControlAggregateCommand(
      admittedRetryCommand,
      () => {},
    );
    const retryAdmitted = aggregate.updateDeveloperControlAggregate(
      retryRunning,
      retryResolved,
    ).state;
    assert.equal(retryAdmitted.pendingCommands.length, 0);
    assert.equal(retryAdmitted.portfolio.pendingCommands.length, 0);
    assert.equal(retryAdmitted.portfolio.status, 'ready');
    assert.equal(retryAdmitted.portfolio.portfolio.rows[0].project.root, projectRoot);

    const forgedSuccess = aggregate.updateDeveloperControlAggregate(running, {
      ...failed,
      result: {
        ...failed.result,
        commandResult: {
          status: 'succeeded',
          commandId: command.command.commandId,
          correlationId: command.command.correlationId,
          completedAt: '2026-07-27T00:00:00.000Z',
          sourceRefs: ['fixture://forged-success'],
          value: failed.result.message,
        },
      },
    }).state;
    assertRetiredMismatch(forgedSuccess);

    const tamperedFailureValue = aggregate.updateDeveloperControlAggregate(running, {
      ...failed,
      result: {
        ...failed.result,
        commandResult: {
          ...failed.result.commandResult,
          value: {
            ...failed.result.message,
            contextProjectRoot: '/workspace/forged-failure',
          },
        },
      },
    }).state;
    assertRetiredMismatch(tamperedFailureValue);

    const staleRevisionEnvelope = aggregate.updateDeveloperControlAggregate(running, {
      ...resolved,
      result: {
        ...resolved.result,
        envelope: {
          ...resolved.result.envelope,
          context: {
            ...resolved.result.envelope.context,
            revision: revision('b'),
          },
        },
      },
    }).state;
    assertRetiredMismatch(staleRevisionEnvelope);

    const staleCurrentContext = aggregate.updateDeveloperControlAggregate({
      ...running,
      host: {
        ...running.host,
        bootstrap: {
          ...running.host.bootstrap,
          context: {
            ...running.host.bootstrap.context,
            revision: revision('b'),
          },
        },
      },
    }, resolved).state;
    assertRetiredMismatch(staleCurrentContext);

    const tamperedSuccessValue = aggregate.updateDeveloperControlAggregate(running, {
      ...resolved,
      result: {
        ...resolved.result,
        commandResult: {
          ...resolved.result.commandResult,
          value: {
            ...resolved.result.message,
            contextProjectRoot: '/workspace/forged-result',
          },
        },
      },
    }).state;
    assertRetiredMismatch(tamperedSuccessValue);

    const semanticallyInvalidMessage = {
      ...resolved.result.message,
      contextProjectRoot: '/workspace/wrong-semantic-owner',
    };
    const semanticRejection = aggregate.updateDeveloperControlAggregate(running, {
      ...resolved,
      result: {
        ...resolved.result,
        message: semanticallyInvalidMessage,
        commandResult: {
          ...resolved.result.commandResult,
          value: semanticallyInvalidMessage,
        },
      },
    }).state;
    assert.equal(semanticRejection.pendingCommands.length, 0);
    assert.equal(semanticRejection.portfolio.pendingCommands.length, 0);
    assert.equal(semanticRejection.portfolio.status, 'error');
    assert.match(semanticRejection.membraneErrors.at(-1), /semantic result rejected/);
    const retriedAfterSemanticRejection = aggregate.updateDeveloperControlAggregate(
      semanticRejection,
      {
        type: 'aggregate/portfolio-message',
        message: { type: 'portfolio/refresh-requested' },
      },
    );
    assert.ok(retriedAfterSemanticRejection.commands.some(
      (candidate) => (
        candidate.type === 'aggregate.interpret-portfolio'
        && candidate.command.type === 'portfolio.load'
        && candidate.command.commandId !== command.command.commandId
      ),
    ));

    const runtimeFailure = aggregate.updateDeveloperControlAggregate(running, {
      type: 'aggregate/command-failed',
      aggregateCommandId: command.aggregateCommandId,
      error: 'portfolio interpreter crashed',
    }).state;
    assert.equal(runtimeFailure.pendingCommands.length, 0);
    assert.equal(runtimeFailure.portfolio.pendingCommands.length, 0);
    assert.equal(runtimeFailure.portfolio.status, 'error');
    assert.equal(runtimeFailure.portfolio.error, 'portfolio interpreter crashed');
    const retriedAfterRuntimeFailure = aggregate.updateDeveloperControlAggregate(
      runtimeFailure,
      {
        type: 'aggregate/portfolio-message',
        message: { type: 'portfolio/refresh-requested' },
      },
    );
    assert.ok(retriedAfterRuntimeFailure.commands.some(
      (candidate) => (
        candidate.type === 'aggregate.interpret-portfolio'
        && candidate.command.type === 'portfolio.load'
      ),
    ));

    const admittedFailure = aggregate.updateDeveloperControlAggregate(running, failed).state;
    assert.equal(admittedFailure.pendingCommands.length, 0);
    assert.equal(admittedFailure.portfolio.pendingCommands.length, 0);
    assert.equal(admittedFailure.portfolio.status, 'error');
    assert.equal(admittedFailure.portfolio.error, failed.result.message.error);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('aggregate records only declared subscription installation failures for replay', async () => {
  const module = await loadTypeScriptModule('capabilities/host/aggregate.ts');
  const initial = module.createDeveloperControlAggregateState('/workspace/project-subscription');
  const registrySubscription = {
    type: 'aggregate.project-registry',
    subscriptionId: 'aggregate.project-registry',
  };
  const failed = module.updateDeveloperControlAggregate(initial, {
    type: 'aggregate/subscription-failed',
    subscription: registrySubscription,
    error: 'listener installation denied',
  }).state;
  assert.deepEqual(failed.subscriptionFailures, [{
    subscriptionId: 'aggregate.project-registry',
    subscriptionType: 'aggregate.project-registry',
    projectRoot: null,
    basisRevision: null,
    error: 'listener installation denied',
  }]);
  const rejected = module.updateDeveloperControlAggregate(failed, {
    type: 'aggregate/subscription-failed',
    subscription: {
      ...registrySubscription,
      subscriptionId: 'aggregate.unknown',
    },
    error: 'must not enter replay state',
  }).state;
  assert.deepEqual(rejected.subscriptionFailures, failed.subscriptionFailures);
});

test('each capability owns its structural public surfaces and cross-capability imports stay at host ports', () => {
  const capabilitiesRoot = resolve(sourceRoot, 'capabilities');
  const capabilityNames = [
    'build-portfolio',
    'project-workbench',
    'specification-proposal',
    'build-control',
    'assurance-attention',
    'run-observation',
  ];
  const requiredFiles = [
    'index.ts',
    'state.ts',
    'messages.ts',
    'update.ts',
    'selectors.ts',
    'contribution.ts',
    'view.tsx',
  ];
  for (const capabilityName of capabilityNames) {
    for (const file of requiredFiles) {
      assert.equal(
        existsSync(join(capabilitiesRoot, capabilityName, file)),
        true,
        `${capabilityName} must own ${file}`,
      );
    }
    for (const file of readdirSync(join(capabilitiesRoot, capabilityName))) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      const source = readFileSync(join(capabilitiesRoot, capabilityName, file), 'utf8');
      for (const otherCapability of capabilityNames.filter((name) => name !== capabilityName)) {
        assert.doesNotMatch(
          source,
          new RegExp(`from ["']\\.\\./${otherCapability}(?:/[^"']+)?["']`),
          `${capabilityName}/${file} imports ${otherCapability}`,
        );
      }
    }
  }

  const hostSource = readFileSync(resolve(capabilitiesRoot, 'host/DeveloperControlHost.tsx'), 'utf8');
  for (const capabilityName of capabilityNames) {
    assert.match(hostSource, new RegExp(`from ["']\\.\\./${capabilityName}["']`));
    assert.doesNotMatch(hostSource, new RegExp(`from ["']\\.\\./${capabilityName}/`));
  }
  assert.doesNotMatch(
    readFileSync(resolve(sourceRoot, 'features/sidecar/SidecarPanel.tsx'), 'utf8'),
    /capabilities\/(?:build-portfolio|project-workbench|specification-proposal|build-control|assurance-attention|run-observation)/,
  );
});
