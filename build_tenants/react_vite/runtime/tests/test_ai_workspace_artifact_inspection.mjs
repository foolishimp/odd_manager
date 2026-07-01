import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const inspectionModulePath = resolve(here, '../../src/features/sidecar/ai-workspace-artifact-inspection.ts');

async function loadInspectionModule() {
  const source = readFileSync(inspectionModulePath, 'utf8');
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

function artifact(artifactKind, relativePath, viewerCapabilities = ['browse.raw']) {
  const featureByKind = {
    event_log_jsonl: 'events',
    proof_manifest: 'proofs',
    proof_artifact: 'proofs',
    test_run_summary: 'test_runs',
    raw_file: 'context',
  };
  return {
    kind: 'ai_workspace_artifact',
    artifactId: relativePath,
    featureId: featureByKind[artifactKind] ?? 'runtime',
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

test('artifact path lookup matches canonical relative paths', async () => {
  const module = await loadInspectionModule();
  const observation = {
    artifacts: [
      artifact('proof_artifact', 'build_tenants/odd_glc/test_runs/proof.json', ['proof.inspect', 'browse.raw']),
    ],
  };

  assert.equal(
    module.aiWorkspaceArtifactForRelativePath(observation, '/build_tenants/odd_glc/test_runs/proof.json')?.artifactKind,
    'proof_artifact',
  );
  assert.equal(module.aiWorkspaceArtifactForRelativePath(observation, 'missing.json'), null);
});

test('JSON proof artifacts produce generic facts without odd_glc-specific parsing', async () => {
  const module = await loadInspectionModule();
  const inspection = module.inspectAiWorkspaceArtifact(
    artifact('proof_artifact', 'proof.json', ['proof.inspect', 'browse.raw']),
    JSON.stringify({
      kind: 'odd_glc_software_build_overlay_live_proof',
      scenarioId: 'SCN-GLC-HELLO-WORLD-CLI-BASIC',
      graphFunctionRef: 'graph-function://odd_glc/software-build/bootstrap-worksite',
      durationMs: 1200,
      artifactSha256s: ['sha256:a', 'sha256:b'],
    }),
  );

  assert.equal(inspection.supported, true);
  assert.equal(inspection.parseKind, 'json');
  assert.equal(inspection.summary.includes('SCN-GLC-HELLO-WORLD-CLI-BASIC'), true);
  assert.deepEqual(inspection.facts.find((fact) => fact.label === 'Artifact Sha256s count'), {
    label: 'Artifact Sha256s count',
    value: '2',
  });
  assert.equal(inspection.topLevelKeys.includes('graphFunctionRef'), true);
});

test('JSONL event artifacts summarize event kind counts and parse diagnostics', async () => {
  const module = await loadInspectionModule();
  const inspection = module.inspectAiWorkspaceArtifact(
    artifact('event_log_jsonl', '.ai-workspace/events/events.jsonl', ['events.inspect', 'browse.raw']),
    [
      JSON.stringify({ kind: 'basis_admitted', eventTime: '2026-07-01T00:00:00.000Z' }),
      JSON.stringify({ kind: 'basis_admitted', eventTime: '2026-07-01T00:00:01.000Z' }),
      JSON.stringify({ kind: 'graph_function_selected', eventTime: '2026-07-01T00:00:02.000Z' }),
      '{bad json',
    ].join('\n'),
  );

  assert.equal(inspection.parseKind, 'jsonl');
  assert.equal(inspection.summary, '3 events parsed from 4 lines.');
  assert.deepEqual(inspection.eventKinds.slice(0, 2), [
    { kind: 'basis_admitted', count: 2 },
    { kind: 'graph_function_selected', count: 1 },
  ]);
  assert.equal(inspection.diagnostics.length, 1);
});

test('JSONL event inspection is bounded and reports truncation', async () => {
  const module = await loadInspectionModule();
  const content = Array.from({ length: 2001 }, (_, index) => (
    JSON.stringify({ kind: index % 2 === 0 ? 'even_event' : 'odd_event' })
  )).join('\n');
  const inspection = module.inspectAiWorkspaceArtifact(
    artifact('event_log_jsonl', '.ai-workspace/events/events.jsonl', ['events.inspect', 'browse.raw']),
    content,
  );

  assert.equal(inspection.parseKind, 'jsonl');
  assert.equal(inspection.summary, '2000 events parsed from 2000 inspected lines.');
  assert.deepEqual(inspection.facts.find((fact) => fact.label === 'Inspected lines'), {
    label: 'Inspected lines',
    value: '2000',
  });
  assert.equal(inspection.diagnostics.includes('Inspection truncated to the first 2000 non-empty lines.'), true);
});

test('large JSON artifacts stay browseable without browser-side parse promotion', async () => {
  const module = await loadInspectionModule();
  const largeContent = `${JSON.stringify({ kind: 'proof', status: 'passed' })}${' '.repeat(1_500_001)}`;
  const inspection = module.inspectAiWorkspaceArtifact(
    artifact('proof_artifact', 'proof.json', ['proof.inspect', 'browse.raw']),
    largeContent,
  );

  assert.equal(inspection.supported, true);
  assert.equal(inspection.parseKind, 'raw');
  assert.equal(inspection.summary.includes('inspection skipped'), true);
  assert.deepEqual(inspection.facts.find((fact) => fact.label === 'Inspection limit bytes'), {
    label: 'Inspection limit bytes',
    value: '1500000',
  });
});

test('unsupported artifacts remain raw and non-authoritative', async () => {
  const module = await loadInspectionModule();
  const inspection = module.inspectAiWorkspaceArtifact(
    artifact('raw_file', '.ai-workspace/context/project_bootstrap.md'),
    '# Bootstrap',
  );

  assert.equal(inspection.supported, false);
  assert.equal(inspection.parseKind, 'raw');
});
