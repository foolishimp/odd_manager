import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createRunFixture } from './_run-fixture.mjs';
import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const validationModulePath = resolve(here, '../../src/features/sidecar/abg-run-observation-validation.ts');
const fixture = createRunFixture();
after(() => fixture.cleanup());

async function loadValidationModule() {
  const source = readFileSync(validationModulePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`);
}

test('client admission validates the complete generic run observation boundary', async () => {
  const module = await loadValidationModule();
  const payload = loadAbgRunObservation(fixture.projectRoot, { refresh: true });
  const admitted = module.asAbgRunObservation(payload);
  assert.equal(admitted.state, 'ready');
  assert.equal(admitted.identity.id, 'fixture_product');
  assert.equal(admitted.stages.length, 2);
  assert.equal(admitted.assurance.mutationKillCount, 1);
  assert.equal(admitted.catalog.entryCount, 2);
  assert.equal(admitted.catalog.entries[0].sourceEventIndexes.length > 0, true);
});

test('client admission rejects malformed operational rows before reducer state', async () => {
  const module = await loadValidationModule();
  const payload = loadAbgRunObservation(fixture.projectRoot);
  payload.events[0].index = 'not-an-index';
  assert.throws(() => module.asAbgRunObservation(payload), /events\[0\]\.index must be a finite number/);
});

test('client admission rejects malformed catalog rows before reducer state', async () => {
  const module = await loadValidationModule();
  const payload = loadAbgRunObservation(fixture.projectRoot, { refresh: true });
  payload.catalog.entries[0].admissionCount = 'many';
  assert.throws(() => module.asAbgRunObservation(payload), /catalog\.entries\[0\]\.admissionCount must be a finite number/);
});
