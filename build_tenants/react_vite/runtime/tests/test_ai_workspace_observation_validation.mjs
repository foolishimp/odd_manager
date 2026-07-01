import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const validationModulePath = resolve(here, '../../src/features/sidecar/ai-workspace-observation-validation.ts');

async function loadValidationModule() {
  const source = readFileSync(validationModulePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const encoded = Buffer.from(compiled, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function observation(overrides = {}) {
  const projectRoot = '/workspace/odd_glc';
  const aiWorkspaceRoot = `${projectRoot}/.ai-workspace`;
  return {
    kind: 'ai_workspace_observation',
    version: 1,
    generatedAt: '2026-07-01T00:00:00.000Z',
    projectRoot,
    aiWorkspaceRoot,
    readOnly: true,
    features: [
      {
        id: 'proofs',
        label: 'Proofs',
        state: 'present',
        relativePath: 'test/fixtures',
        sourceRefs: ['test/fixtures'],
        artifactCount: 1,
        capabilities: ['proof.inspect', 'browse.raw'],
        diagnostics: [],
      },
    ],
    artifacts: [
      {
        kind: 'ai_workspace_artifact',
        artifactId: 'test/fixtures/proof.json',
        featureId: 'proofs',
        artifactKind: 'proof_artifact',
        state: 'present',
        relativePath: 'test/fixtures/proof.json',
        absolutePath: `${projectRoot}/test/fixtures/proof.json`,
        sizeBytes: 120,
        modifiedAt: '2026-07-01T00:00:00.000Z',
        viewerCapabilities: ['proof.inspect', 'browse.raw'],
        diagnostics: [],
      },
    ],
    capabilities: ['proof.inspect', 'browse.raw'],
    diagnostics: {
      projectRoot,
      aiWorkspaceRoot,
      scannedDirectoryCount: 3,
      scannedFileCount: 7,
      maxDirectories: 6000,
      maxArtifacts: 1200,
      truncated: false,
      ignoredNames: ['node_modules', '.git'],
    },
    ...overrides,
  };
}

test('client observation admission returns a typed sanitized observation', async () => {
  const module = await loadValidationModule();
  const admitted = module.asAiWorkspaceObservation(observation());

  assert.equal(admitted.kind, 'ai_workspace_observation');
  assert.equal(admitted.readOnly, true);
  assert.equal(admitted.features[0].id, 'proofs');
  assert.equal(admitted.artifacts[0].artifactKind, 'proof_artifact');
  assert.deepEqual(admitted.capabilities, ['proof.inspect', 'browse.raw']);
});

test('client observation admission fails closed for unknown feature ids', async () => {
  const module = await loadValidationModule();
  const payload = observation({
    features: [
      {
        ...observation().features[0],
        id: 'odd_glc_native_runtime',
      },
    ],
  });

  assert.throws(
    () => module.asAiWorkspaceObservation(payload),
    /features\[0\]\.id is unsupported/,
  );
});

test('client observation admission rejects mismatched diagnostics carriers', async () => {
  const module = await loadValidationModule();
  const payload = observation({
    diagnostics: {
      ...observation().diagnostics,
      projectRoot: '/workspace/other',
    },
  });

  assert.throws(
    () => module.asAiWorkspaceObservation(payload),
    /diagnostics paths do not match/,
  );
});

test('client observation admission rejects malformed artifact capabilities', async () => {
  const module = await loadValidationModule();
  const payload = observation({
    artifacts: [
      {
        ...observation().artifacts[0],
        viewerCapabilities: ['proof.inspect', 'runtime.mutate'],
      },
    ],
  });

  assert.throws(
    () => module.asAiWorkspaceObservation(payload),
    /viewerCapabilities\[1\] is unsupported/,
  );
});
