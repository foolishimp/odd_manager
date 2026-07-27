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

function registry(projects, activeRoot = null, managerRoot = '/workspace/manager') {
  return {
    projects,
    diagnostic: { active_project_root: activeRoot, manager_workspace_root: managerRoot },
  };
}

test('App shell correlates bootstrap effects and replays an admitted active deep link', async () => {
  const stateModule = await loadTypeScriptModule('app/shell/state.ts');
  const updateModule = await loadTypeScriptModule('app/shell/update.ts');
  let state = stateModule.createAppShellState();

  let transition = updateModule.updateAppShell(state, {
    type: 'shell.browser-ready',
    search: '?project=/workspace/linked&view=run-inspector&execution=e-1&revision=r-1&source=proof://e-1',
  });
  assert.deepEqual(transition.commands.map((command) => command.type), ['shell.load-preferences']);
  const preferencesCommand = transition.commands[0];
  state = transition.state;

  const foreignPreferences = updateModule.updateAppShell(state, {
    type: 'shell.preferences-loaded',
    commandId: 'foreign-preferences',
    workspaceRoot: '/workspace/foreign',
    theme: 'dark',
  });
  assert.strictEqual(foreignPreferences.state, state);
  const foreignPreferenceFailure = updateModule.updateAppShell(state, {
    type: 'shell.command-failed',
    commandId: 'foreign-preferences',
    commandType: 'shell.load-preferences',
    error: 'foreign failure',
  });
  assert.strictEqual(foreignPreferenceFailure.state, state);

  transition = updateModule.updateAppShell(state, {
    type: 'shell.preferences-loaded',
    commandId: preferencesCommand.commandId,
    workspaceRoot: '/workspace/stored',
    theme: 'dark-grey',
  });
  assert.deepEqual(transition.commands.map((command) => command.type), [
    'shell.apply-theme', 'shell.persist-theme', 'shell.persist-workspace', 'shell.load-registry',
  ]);
  const registryCommand = transition.commands.find((command) => command.type === 'shell.load-registry');
  state = transition.state;

  const retiredPreferences = updateModule.updateAppShell(state, {
    type: 'shell.preferences-loaded',
    commandId: preferencesCommand.commandId,
    workspaceRoot: '/workspace/late',
    theme: 'dark',
  });
  assert.strictEqual(retiredPreferences.state, state);
  const foreignRegistry = updateModule.updateAppShell(state, {
    type: 'shell.registry-loaded',
    commandId: 'foreign-registry',
    registry: registry([{ id: 'foreign', root: '/workspace/foreign', is_active: true }]),
  });
  assert.strictEqual(foreignRegistry.state, state);

  transition = updateModule.updateAppShell(state, {
    type: 'shell.registry-loaded',
    commandId: registryCommand.commandId,
    registry: registry([{ id: 'linked', root: '/workspace/linked', is_active: true }], '/workspace/linked'),
  });
  assert.equal(transition.state.workspaceReady, true);
  assert.equal(transition.state.workspaceRoot, '/workspace/linked');
  assert.equal(transition.state.theme, 'dark-grey');
  assert.equal(transition.state.initialSurface, 'run-inspector');
  assert.deepEqual(transition.state.initialRunFocus, {
    projectRoot: '/workspace/linked', executionId: 'e-1', runRef: null, revision: 'r-1', sourceRef: 'proof://e-1',
  });
  assert.equal(transition.commands.some((command) => command.type === 'shell.replace-project-url'), true);

  const retiredRegistry = updateModule.updateAppShell(transition.state, {
    type: 'shell.command-failed',
    commandId: registryCommand.commandId,
    commandType: 'shell.load-registry',
    error: 'late registry failure',
  });
  assert.strictEqual(retiredRegistry.state, transition.state);

  const preferenceFailureRequest = updateModule.updateAppShell(
    stateModule.createAppShellState(),
    { type: 'shell.browser-ready', search: '' },
  );
  const preferenceFailure = updateModule.updateAppShell(preferenceFailureRequest.state, {
    type: 'shell.command-failed',
    commandId: preferenceFailureRequest.commands[0].commandId,
    commandType: 'shell.load-preferences',
    error: 'preferences unavailable',
  });
  assert.equal(preferenceFailure.state.error, 'preferences unavailable');
  assert.equal(preferenceFailure.state.preferencesCommandId, null);
  const latePreferenceSuccess = updateModule.updateAppShell(preferenceFailure.state, {
    type: 'shell.preferences-loaded',
    commandId: preferenceFailureRequest.commands[0].commandId,
    workspaceRoot: '/workspace/late',
    theme: 'dark',
  });
  assert.strictEqual(latePreferenceSuccess.state, preferenceFailure.state);

  const registryFailureRequest = updateModule.updateAppShell(
    stateModule.createAppShellState(),
    { type: 'shell.browser-ready', search: '' },
  );
  const registryFailurePreferences = updateModule.updateAppShell(registryFailureRequest.state, {
    type: 'shell.preferences-loaded',
    commandId: registryFailureRequest.commands[0].commandId,
    workspaceRoot: '/workspace/stored',
    theme: 'light',
  });
  const registryFailureCommand = registryFailurePreferences.commands.find(
    (command) => command.type === 'shell.load-registry',
  );
  const registryFailure = updateModule.updateAppShell(registryFailurePreferences.state, {
    type: 'shell.command-failed',
    commandId: registryFailureCommand.commandId,
    commandType: 'shell.load-registry',
    error: 'registry unavailable',
  });
  assert.equal(registryFailure.state.error, 'registry unavailable');
  assert.equal(registryFailure.state.registryCommandId, null);
  const lateRegistrySuccess = updateModule.updateAppShell(registryFailure.state, {
    type: 'shell.registry-loaded',
    commandId: registryFailureCommand.commandId,
    registry: registry([{ id: 'late', root: '/workspace/late', is_active: true }]),
  });
  assert.strictEqual(lateRegistrySuccess.state, registryFailure.state);
});

test('App shell makes inactive deep-link activation explicit and fails back without retaining authority', async () => {
  const stateModule = await loadTypeScriptModule('app/shell/state.ts');
  const updateModule = await loadTypeScriptModule('app/shell/update.ts');
  let transition = updateModule.updateAppShell(stateModule.createAppShellState(), {
    type: 'shell.browser-ready', search: '?project=/workspace/linked',
  });
  const preferencesCommand = transition.commands[0];
  transition = updateModule.updateAppShell(transition.state, {
    type: 'shell.preferences-loaded',
    commandId: preferencesCommand.commandId,
    workspaceRoot: '/workspace/stored',
    theme: 'light',
  });
  const registryCommand = transition.commands.find((command) => command.type === 'shell.load-registry');
  const activation = updateModule.updateAppShell(transition.state, {
    type: 'shell.registry-loaded',
    commandId: registryCommand.commandId,
    registry: registry([
      { id: 'fallback', root: '/workspace/fallback', is_active: true },
      { id: 'linked', root: '/workspace/linked', is_active: false },
    ], '/workspace/fallback'),
  });
  assert.equal(activation.state.workspaceReady, false);
  assert.deepEqual(activation.commands.map((command) => command.type), ['shell.activate-project']);

  const rejected = updateModule.updateAppShell(activation.state, {
    type: 'shell.project-activation-failed',
    commandId: activation.commands[0].commandId,
    error: 'activation denied',
  });
  assert.equal(rejected.state.workspaceReady, true);
  assert.equal(rejected.state.workspaceRoot, '/workspace/fallback');
  assert.equal(rejected.state.error, 'activation denied');
  assert.equal(rejected.state.initialSurface, 'project-workbench');
});

test('App shell routes theme and workspace continuation through typed commands', async () => {
  const stateModule = await loadTypeScriptModule('app/shell/state.ts');
  const updateModule = await loadTypeScriptModule('app/shell/update.ts');
  const initial = {
    ...stateModule.createAppShellState(),
    workspaceReady: true,
    workspaceRoot: '/workspace/a',
  };
  const requested = updateModule.updateAppShell(initial, {
    type: 'shell.theme-toggle-requested',
  });
  assert.equal(requested.state.theme, 'dark-grey');
  assert.deepEqual(
    requested.commands.map((command) => command.type),
    ['shell.apply-theme', 'shell.persist-theme'],
  );
  const applyTheme = requested.commands.find(
    (command) => command.type === 'shell.apply-theme',
  );
  const persistTheme = requested.commands.find(
    (command) => command.type === 'shell.persist-theme',
  );
  assert.deepEqual(requested.state.inFlightCommands, requested.commands);

  const wrongTypeSuccess = updateModule.updateAppShell(requested.state, {
    type: 'shell.command-succeeded',
    commandId: applyTheme.commandId,
    commandType: 'shell.persist-theme',
  });
  assert.strictEqual(wrongTypeSuccess.state, requested.state);

  const applied = updateModule.updateAppShell(requested.state, {
    type: 'shell.command-succeeded',
    commandId: applyTheme.commandId,
    commandType: applyTheme.type,
  });
  assert.deepEqual(applied.state.inFlightCommands, [persistTheme]);

  const wrongTypeFailure = updateModule.updateAppShell(applied.state, {
    type: 'shell.command-failed',
    commandId: persistTheme.commandId,
    commandType: 'shell.replace-project-url',
    error: 'forged URL failure',
  });
  assert.strictEqual(wrongTypeFailure.state, applied.state);

  const persistenceFailure = updateModule.updateAppShell(applied.state, {
    type: 'shell.command-failed',
    commandId: persistTheme.commandId,
    commandType: persistTheme.type,
    error: 'theme persistence unavailable',
  });
  assert.deepEqual(persistenceFailure.state.inFlightCommands, []);
  assert.equal(persistenceFailure.state.error, 'theme persistence unavailable');

  const workspace = updateModule.updateAppShell(persistenceFailure.state, {
    type: 'shell.workspace-requested',
    workspaceRoot: ' /workspace/b ',
  });
  assert.equal(workspace.state.workspaceRoot, '/workspace/b');
  assert.deepEqual(workspace.commands.map((command) => command.type), ['shell.persist-workspace', 'shell.replace-project-url']);
  assert.equal(workspace.commands[1].workspaceRoot, '/workspace/b');
  const persistedWorkspace = workspace.commands.find(
    (command) => command.type === 'shell.persist-workspace',
  );
  const replacedUrl = workspace.commands.find(
    (command) => command.type === 'shell.replace-project-url',
  );
  const persisted = updateModule.updateAppShell(workspace.state, {
    type: 'shell.command-succeeded',
    commandId: persistedWorkspace.commandId,
    commandType: persistedWorkspace.type,
  });
  const urlFailure = updateModule.updateAppShell(persisted.state, {
    type: 'shell.command-failed',
    commandId: replacedUrl.commandId,
    commandType: replacedUrl.type,
    error: 'history replacement denied',
  });
  assert.deepEqual(urlFailure.state.inFlightCommands, []);
  assert.equal(urlFailure.state.error, 'history replacement denied');
});

test('App shell rejects foreign and retired Project activation results', async () => {
  const stateModule = await loadTypeScriptModule('app/shell/state.ts');
  const updateModule = await loadTypeScriptModule('app/shell/update.ts');
  let transition = updateModule.updateAppShell(stateModule.createAppShellState(), {
    type: 'shell.browser-ready',
    search: '?project=/workspace/linked',
  });
  const preferencesCommand = transition.commands[0];
  transition = updateModule.updateAppShell(transition.state, {
    type: 'shell.preferences-loaded',
    commandId: preferencesCommand.commandId,
    workspaceRoot: '/workspace/fallback',
    theme: 'light',
  });
  const registryCommand = transition.commands.find((command) => command.type === 'shell.load-registry');
  const activation = updateModule.updateAppShell(transition.state, {
    type: 'shell.registry-loaded',
    commandId: registryCommand.commandId,
    registry: registry([
      { id: 'fallback', root: '/workspace/fallback', is_active: true },
      { id: 'linked', root: '/workspace/linked', is_active: false },
    ], '/workspace/fallback'),
  });
  const activationCommand = activation.commands[0];
  assert.equal(activationCommand.projectId, 'linked');
  assert.equal(activationCommand.projectRoot, '/workspace/linked');

  const foreign = updateModule.updateAppShell(activation.state, {
    type: 'shell.project-activated',
    commandId: 'foreign-activation',
    projectId: 'linked',
    projectRoot: '/workspace/linked',
  });
  assert.strictEqual(foreign.state, activation.state);
  assert.equal(foreign.state.workspaceReady, false);

  const mismatchedReturnedProject = updateModule.updateAppShell(activation.state, {
    type: 'shell.project-activated',
    commandId: activationCommand.commandId,
    projectId: activationCommand.projectId,
    projectRoot: '/workspace/same-id-wrong-root',
  });
  assert.strictEqual(mismatchedReturnedProject.state, activation.state);
  assert.equal(mismatchedReturnedProject.state.workspaceReady, false);
  assert.equal(
    mismatchedReturnedProject.state.inFlightCommands.some(
      (command) => command.commandId === activationCommand.commandId,
    ),
    true,
  );

  const superseded = updateModule.updateAppShell(activation.state, {
    type: 'shell.workspace-requested',
    workspaceRoot: '/workspace/operator-choice',
  });
  const late = updateModule.updateAppShell(superseded.state, {
    type: 'shell.project-activated',
    commandId: activationCommand.commandId,
    projectId: activationCommand.projectId,
    projectRoot: activationCommand.projectRoot,
  });
  assert.strictEqual(late.state, superseded.state);
  assert.equal(late.state.workspaceRoot, '/workspace/operator-choice');

  const lateFailure = updateModule.updateAppShell(superseded.state, {
    type: 'shell.project-activation-failed',
    commandId: activationCommand.commandId,
    error: 'retired activation failed',
  });
  assert.strictEqual(lateFailure.state, superseded.state);
  assert.equal(lateFailure.state.error, null);

  const admitted = updateModule.updateAppShell(activation.state, {
    type: 'shell.project-activated',
    commandId: activationCommand.commandId,
    projectId: activationCommand.projectId,
    projectRoot: activationCommand.projectRoot,
  });
  assert.equal(admitted.state.workspaceReady, true);
  assert.equal(admitted.state.workspaceRoot, '/workspace/linked');
  assert.equal(
    admitted.state.inFlightCommands.some(
      (command) => command.commandId === activationCommand.commandId,
    ),
    false,
  );
});

test('Project URL projection uses live host navigation and clears cross-Project run focus', async () => {
  const urlModule = await loadTypeScriptModule('app/shell/url.ts');
  const effectSource = readFileSync(
    resolve(sourceRoot, 'app/shell/effect-runtime.ts'),
    'utf8',
  );
  const currentHostUrl = [
    'http://localhost:5173/',
    '?project=/workspace/a',
    '&view=run-inspector',
    '&execution=execution-a',
    '&runRef=run://a',
    '&revision=revision-a',
    '&source=evidence://a',
    '&keep=value',
    '#tail',
  ].join('');

  const sameProject = new URL(
    urlModule.projectUrl(currentHostUrl, '/workspace/a/'),
    'http://localhost:5173',
  );
  assert.equal(sameProject.searchParams.get('view'), 'run-inspector');
  assert.equal(sameProject.searchParams.get('execution'), 'execution-a');
  assert.equal(sameProject.searchParams.get('runRef'), 'run://a');
  assert.equal(sameProject.searchParams.get('revision'), 'revision-a');
  assert.equal(sameProject.searchParams.get('source'), 'evidence://a');

  const switched = new URL(
    urlModule.projectUrl(currentHostUrl, '/workspace/b'),
    'http://localhost:5173',
  );
  assert.equal(switched.searchParams.get('project'), '/workspace/b');
  assert.equal(switched.searchParams.get('view'), 'run-inspector');
  assert.equal(switched.searchParams.get('keep'), 'value');
  assert.equal(switched.hash, '#tail');
  for (const parameter of ['execution', 'runRef', 'revision', 'source']) {
    assert.equal(switched.searchParams.has(parameter), false);
  }

  assert.equal(
    urlModule.activatedProjectMatches(
      { projectId: 'project-b', projectRoot: '/workspace/b/' },
      { id: 'project-b', root: '/workspace/b' },
    ),
    true,
  );
  assert.equal(
    urlModule.activatedProjectMatches(
      { projectId: 'project-b', projectRoot: '/workspace/b' },
      { id: 'project-b', root: '/workspace/c' },
    ),
    false,
  );
  assert.match(
    effectSource,
    /const result = await setActiveProject\(command\.projectId,[\s\S]*if \(!activatedProjectMatches\(command, result\.project\)\)[\s\S]*throw new Error[\s\S]*type: "shell\.project-activated"/,
  );
});
