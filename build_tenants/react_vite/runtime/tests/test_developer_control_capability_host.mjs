import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import {
  capabilitySubscriptionEventSchema,
  capabilitySubscriptionSchema,
} from '@odd-manager/developer-control-contracts';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, '../../src');
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

function contextCommand(commandId, projectRoot) {
  return {
    type: 'host.resolve-context',
    commandId,
    correlationId: `correlation-${commandId}`,
    projectRoot,
  };
}

test('host rejects a late Project result and admits only the latest Context basis', async () => {
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
  const command = {
    type: 'host.project-navigation',
    commandId: 'navigation-1',
    correlationId: 'navigation-correlation-1',
    projectRoot: '/workspace/project-a',
    surface: 'run-inspector',
  };
  const requested = module.updateDeveloperControlHost(
    module.createDeveloperControlHostState(),
    { type: 'host/navigation-requested', command },
  );
  assert.equal(requested.state.activeSurface, 'project-workbench');
  assert.equal(requested.state.requestedSurface, 'run-inspector');
  assert.deepEqual(requested.commands, [command]);

  const admitted = module.updateDeveloperControlHost(requested.state, {
    type: 'host/navigation-admitted',
    commandId: command.commandId,
    correlationId: command.correlationId,
    surface: 'run-inspector',
  }).state;
  assert.equal(admitted.activeSurface, 'run-inspector');
  assert.equal(admitted.requestedSurface, null);
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
    contextProjectRoot: projectA,
    portfolio: portfolio([projectA, projectB], projectA),
  });
  assert.equal(late.state.portfolio, null);

  const admitted = module.updateBuildPortfolio(requestedB.state, {
    type: 'portfolio/load-succeeded',
    commandId: requestedB.commands[0].commandId,
    contextProjectRoot: projectB,
    portfolio: portfolio([projectA, projectB], projectB),
  });
  assert.equal(admitted.state.portfolio.rows.length, 2);
  assert.equal(admitted.state.contextProjectRoot, projectB);
  assert.equal(admitted.state.selectedProjectId, 'project-1');
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

  const activate = module.updateBuildPortfolio(register.state, {
    type: 'portfolio/project-activate-requested',
    projectId: 'project-0',
  });
  assert.equal(activate.commands[0].type, 'portfolio.activate');
  assert.equal(activate.commands[0].contextProjectRoot, '/workspace/project-a');

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
