import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(here, '../../src/lib/projectDeepLink.ts');

async function loadModule() {
  const source = readFileSync(modulePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`);
}

test('Project deep-link parsing distinguishes absent, valid, and invalid local paths', async () => {
  const module = await loadModule();
  assert.deepEqual(module.parseProjectDeepLink(''), { state: 'absent' });
  assert.deepEqual(module.parseProjectDeepLink('?project=%2Fworkspace%2Fodd_glc%2F'), {
    state: 'ready',
    projectRoot: '/workspace/odd_glc',
  });
  assert.equal(module.parseProjectDeepLink('?project=workspace%2Fodd_glc').state, 'invalid');
  assert.equal(module.parseProjectDeepLink('?project=%2Fa&project=%2Fb').state, 'invalid');
});

test('Project deep links admit exact registered roots only', async () => {
  const module = await loadModule();
  const projects = [
    { id: 'odd-glc', root: '/workspace/odd_glc' },
    { id: 'manager', root: '/workspace/odd_manager' },
  ];
  assert.equal(module.registeredProjectForDeepLink('/workspace/odd_glc/', projects)?.id, 'odd-glc');
  assert.equal(module.registeredProjectForDeepLink('/workspace/odd_glc/run/instance', projects), null);
  assert.equal(module.registeredProjectForDeepLink('/workspace/unregistered', projects), null);
});

test('Project URL synchronization preserves unrelated query and fragment state', async () => {
  const module = await loadModule();
  assert.equal(
    module.projectDeepLinkUrl(
      'http://127.0.0.1:5175/?mode=compact&project=%2Fworkspace%2Fold#viewer',
      '/workspace/odd glc/',
    ),
    '/?mode=compact&project=%2Fworkspace%2Fodd+glc#viewer',
  );
});

test('Project deep links choose a non-empty generic landing or an explicit surface', async () => {
  const module = await loadModule();
  assert.equal(module.projectLandingSurface('?project=%2Fworkspace%2Fodd_glc'), 'project-workbench');
  assert.equal(module.projectLandingSurface('?project=%2Fworkspace%2Fodd_glc&view=ai-workspace'), 'ai-workspace');
  assert.equal(module.projectLandingSurface('?project=%2Fworkspace%2Fodd_glc&view=run-inspector'), 'run-inspector');
  assert.equal(module.projectLandingSurface('?project=%2Fworkspace%2Fodd_glc&view=ticket-board'), 'ticket-board');
  assert.equal(module.projectLandingSurface('?project=%2Fworkspace%2Fodd_glc&view=unknown'), 'project-workbench');
});

test('Run Inspector deep links preserve one bounded build forensic focus', async () => {
  const module = await loadModule();
  const search = new URLSearchParams({
    project: '/workspace/odd_glc',
    view: 'run-inspector',
    execution: 'execution-42',
    runRef: 'run://odd_glc/data-mapper-42',
    revision: 'abc123',
    source: 'build-evidence://execution-42/tests',
  });
  assert.deepEqual(module.runInspectorFocus(`?${search}`, '/workspace/odd_glc'), {
    projectRoot: '/workspace/odd_glc',
    executionId: 'execution-42',
    runRef: 'run://odd_glc/data-mapper-42',
    revision: 'abc123',
    sourceRef: 'build-evidence://execution-42/tests',
  });
  assert.equal(
    module.runInspectorFocus('?execution=a&execution=b&revision=c&source=d', '/workspace/odd_glc'),
    null,
  );
});
