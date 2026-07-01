import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const projectionModulePath = resolve(here, '../../src/features/sidecar/ai-workspace-browser.ts');

async function loadProjectionModule() {
  const source = readFileSync(projectionModulePath, 'utf8');
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

function feature(id, label, state, artifactCount = 0, capabilities = []) {
  return {
    id,
    label,
    state,
    relativePath: id,
    sourceRefs: [],
    artifactCount,
    capabilities,
    diagnostics: [],
  };
}

function artifact(featureId, artifactKind, relativePath, viewerCapabilities = ['browse.raw']) {
  return {
    kind: 'ai_workspace_artifact',
    artifactId: relativePath,
    featureId,
    artifactKind,
    state: 'present',
    relativePath,
    absolutePath: `/workspace/odd_glc/${relativePath}`,
    sizeBytes: 10,
    modifiedAt: '2026-07-01T00:00:00.000Z',
    viewerCapabilities,
    diagnostics: [],
  };
}

function observation() {
  return {
    kind: 'ai_workspace_observation',
    version: 1,
    generatedAt: '2026-07-01T00:00:00.000Z',
    projectRoot: '/workspace/odd_glc',
    aiWorkspaceRoot: '/workspace/odd_glc/.ai-workspace',
    readOnly: true,
    features: [
      feature('ai_workspace', '.ai-workspace', 'present', 1, ['browse.raw']),
      feature('context', 'Context', 'present', 1, ['context.read']),
      feature('tickets', 'Tickets', 'missing'),
      feature('events', 'Events', 'present', 1, ['events.inspect']),
      feature('proofs', 'Proofs', 'present', 2, ['proof.inspect']),
      feature('test_runs', 'Test Runs', 'present', 1, ['test_run.inspect']),
      feature('domain_overlays', 'Domain Overlays', 'present', 1, ['domain_overlay.inspect']),
    ],
    artifacts: [
      artifact('proofs', 'proof_artifact', 'build_tenants/odd_glc/typescript/test_runs/live/proof.json', ['proof.inspect', 'browse.raw']),
      artifact('proofs', 'proof_manifest', 'build_tenants/odd_glc/typescript/test/proof_inputs/manifest.json', ['proof.inspect', 'browse.raw']),
      artifact('events', 'event_log_jsonl', '.ai-workspace/events/abg-runtime-events.jsonl', ['events.inspect', 'browse.raw']),
      artifact('test_runs', 'test_run_summary', 'test_runs/scenario/sandbox-summary.json', ['test_run.inspect', 'browse.raw']),
      artifact('domain_overlays', 'domain_overlay', '.ai-workspace/overlays/software-build-overlay.json', ['domain_overlay.inspect', 'browse.raw']),
    ],
    capabilities: ['browse.raw', 'context.read', 'events.inspect', 'proof.inspect', 'test_run.inspect', 'domain_overlay.inspect'],
    diagnostics: {
      projectRoot: '/workspace/odd_glc',
      aiWorkspaceRoot: '/workspace/odd_glc/.ai-workspace',
      scannedDirectoryCount: 10,
      scannedFileCount: 5,
      maxDirectories: 100,
      maxArtifacts: 100,
      truncated: false,
      ignoredNames: [],
    },
  };
}

test('aiWorkspaceBrowserSummary derives ordered feature and artifact-group projections', async () => {
  const module = await loadProjectionModule();
  const summary = module.aiWorkspaceBrowserSummary(observation());

  assert.equal(summary.presentFeatureCount, 6);
  assert.equal(summary.artifactCount, 5);
  assert.equal(summary.capabilityCount, 6);
  assert.equal(summary.features[0].id, 'ai_workspace');
  assert.equal(summary.features.find((entry) => entry.id === 'tickets').state, 'missing');
  assert.deepEqual(summary.artifactGroups.map((group) => group.featureId), [
    'events',
    'proofs',
    'test_runs',
    'domain_overlays',
  ]);
  assert.deepEqual([...summary.artifactGroups.find((group) => group.featureId === 'proofs').artifactKinds].sort(), [
    'proof_artifact',
    'proof_manifest',
  ]);
});

test('ai workspace artifact helpers derive compact labels and primary capabilities', async () => {
  const module = await loadProjectionModule();
  const proofArtifact = artifact(
    'proofs',
    'proof_artifact',
    'build_tenants/odd_glc/typescript/test_runs/live/proof.json',
    ['proof.inspect', 'browse.raw'],
  );
  const rawArtifact = artifact('context', 'raw_file', '.ai-workspace/context/project_bootstrap.md');

  assert.equal(module.aiWorkspaceArtifactLabel(proofArtifact), 'proof.json');
  assert.equal(module.aiWorkspacePrimaryCapability(proofArtifact), 'proof.inspect');
  assert.equal(module.aiWorkspaceArtifactLabel(rawArtifact), 'project_bootstrap.md');
  assert.equal(module.aiWorkspacePrimaryCapability(rawArtifact), 'browse.raw');
});

test('isAiWorkspaceObservationForProject ignores trailing slashes and rejects stale projects', async () => {
  const module = await loadProjectionModule();
  const current = observation();

  assert.equal(module.isAiWorkspaceObservationForProject(current, '/workspace/odd_glc/'), true);
  assert.equal(module.isAiWorkspaceObservationForProject(current, '/workspace/odd_sdlc'), false);
  assert.equal(module.isAiWorkspaceObservationForProject(null, '/workspace/odd_glc'), false);
});
