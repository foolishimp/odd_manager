import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  aiWorkspaceFeatureById,
  loadAiWorkspaceObservation,
} from '../../src/server/ai-workspace-observation-service.mjs';

function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'odd-manager-ai-workspace-observation-'));
}

function removeTempProject(root) {
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
}

function writeJson(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function artifactKinds(observation) {
  return new Set(observation.artifacts.map((artifact) => artifact.artifactKind));
}

function findArtifact(observation, relativePathSuffix) {
  return observation.artifacts.find((artifact) => artifact.relativePath.endsWith(relativePathSuffix));
}

test('observation reports a project with no .ai-workspace as observable but feature-missing', () => {
  const projectRoot = createTempProject();
  try {
    const observation = loadAiWorkspaceObservation(projectRoot);

    assert.equal(observation.kind, 'ai_workspace_observation');
    assert.equal(observation.projectRoot, projectRoot);
    assert.equal(observation.readOnly, true);
    assert.equal(aiWorkspaceFeatureById(observation, 'ai_workspace').state, 'missing');
    assert.equal(aiWorkspaceFeatureById(observation, 'tickets').state, 'missing');
    assert.deepEqual(observation.artifacts, []);
    assert.deepEqual(observation.capabilities, []);
  } finally {
    removeTempProject(projectRoot);
  }
});

test('observation detects partial .ai-workspace features independently', () => {
  const projectRoot = createTempProject();
  try {
    mkdirSync(join(projectRoot, '.ai-workspace', 'context'), { recursive: true });
    mkdirSync(join(projectRoot, '.ai-workspace', 'tickets', 'active'), { recursive: true });
    mkdirSync(join(projectRoot, '.ai-workspace', 'runtime'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.ai-workspace', 'context', 'project_bootstrap.md'),
      '# Bootstrap\n',
      'utf8',
    );
    writeFileSync(
      join(projectRoot, '.ai-workspace', 'tickets', 'active', 'T-001-test.md'),
      '# T-001\n',
      'utf8',
    );

    const observation = loadAiWorkspaceObservation(projectRoot);

    assert.equal(aiWorkspaceFeatureById(observation, 'ai_workspace').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'context').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'tickets').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'comments').state, 'missing');
    assert.equal(aiWorkspaceFeatureById(observation, 'runtime').state, 'incomplete');
    assert.ok(observation.capabilities.includes('context.read'));
    assert.ok(observation.capabilities.includes('tickets.inspect'));
    assert.ok(!observation.capabilities.includes('comments.inspect'));
  } finally {
    removeTempProject(projectRoot);
  }
});

test('observation classifies odd_glc-like proof and test-run artifacts without a domain adapter', () => {
  const projectRoot = createTempProject();
  try {
    mkdirSync(join(projectRoot, '.ai-workspace', 'context'), { recursive: true });
    writeFileSync(join(projectRoot, '.ai-workspace', 'context', 'project_bootstrap.md'), '# odd_glc\n', 'utf8');
    writeJson(
      join(
        projectRoot,
        'build_tenants',
        'odd_glc',
        'typescript',
        'test',
        'proof_inputs',
        'glc-software-build-overlay-live-manifest.json',
      ),
      {
        manifestKind: 'glc_software_build_overlay_live',
        scenarios: ['SCN-GLC-HELLO-WORLD-CLI-BASIC'],
        artifactRefs: ['test_runs/glc_software_build_overlay_live/basic-cli/proof.json'],
      },
    );
    writeJson(
      join(
        projectRoot,
        'build_tenants',
        'odd_glc',
        'typescript',
        'test_runs',
        'glc_software_build_overlay_live',
        'basic-cli',
        '20260701T010203000Z_pid1234',
        'odd-glc-software-build-overlay-live-proof.json',
      ),
      {
        proofKind: 'odd_glc.software_build_overlay_live',
        scenarioId: 'SCN-GLC-HELLO-WORLD-CLI-BASIC',
        eventLogPath: '.ai-workspace/events/abg-runtime-events.jsonl',
        eventLogDigest: 'sha256:test',
        requiredRuntimeTruth: ['graph_function_selected'],
      },
    );
    writeJson(
      join(
        projectRoot,
        'build_tenants',
        'odd_glc',
        'typescript',
        'test_runs',
        'hello_world_sandbox_parity',
        'SCN-GLC-HELLO-WORLD-CLI-BASIC',
        '20260701T010203000Z_pid1234_abcd',
        'sandbox-summary.json',
      ),
      {
        scenario_id: 'SCN-GLC-HELLO-WORLD-CLI-BASIC',
        run_id: '20260701T010203000Z_pid1234_abcd',
        status: 'passed',
      },
    );

    const observation = loadAiWorkspaceObservation(projectRoot);
    const kinds = artifactKinds(observation);

    assert.equal(aiWorkspaceFeatureById(observation, 'proofs').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'test_runs').state, 'present');
    assert.ok(kinds.has('proof_manifest'));
    assert.ok(kinds.has('proof_artifact'));
    assert.ok(kinds.has('test_run_summary'));
    assert.ok(observation.capabilities.includes('proof.inspect'));
    assert.ok(observation.capabilities.includes('test_run.inspect'));
  } finally {
    removeTempProject(projectRoot);
  }
});

test('observation classifies event, ledger, catalog, and overlay artifacts by capability', () => {
  const projectRoot = createTempProject();
  try {
    mkdirSync(join(projectRoot, '.ai-workspace', 'events'), { recursive: true });
    mkdirSync(join(projectRoot, '.ai-workspace', 'ledgers'), { recursive: true });
    mkdirSync(join(projectRoot, '.ai-workspace', 'catalogs'), { recursive: true });
    mkdirSync(join(projectRoot, '.ai-workspace', 'overlays'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.ai-workspace', 'events', 'abg-runtime-events.jsonl'),
      '{"kind":"registry_entry_admitted","event_ref":"evt-1"}\n{"kind":"graph_function_selected","event_ref":"evt-2"}\n',
      'utf8',
    );
    writeFileSync(
      join(projectRoot, '.ai-workspace', 'ledgers', 'payload-ledger.jsonl'),
      '{"payload_ref":"payload-1"}\n',
      'utf8',
    );
    writeJson(
      join(projectRoot, '.ai-workspace', 'catalogs', 'runtime-catalog.json'),
      {
        catalogRef: 'catalog://abg/runtime',
        registryEntries: ['registry://entry/1'],
      },
    );
    writeJson(
      join(projectRoot, '.ai-workspace', 'overlays', 'software-build-overlay.json'),
      {
        software_build_overlay_ref: 'odd_glc.overlay.software_build',
        lifecycle_slot_map_ref: 'odd_glc.lifecycle.slot_map',
      },
    );

    const observation = loadAiWorkspaceObservation(projectRoot);

    assert.equal(findArtifact(observation, 'abg-runtime-events.jsonl').artifactKind, 'event_log_jsonl');
    assert.equal(findArtifact(observation, 'payload-ledger.jsonl').artifactKind, 'system_ledger');
    assert.equal(findArtifact(observation, 'runtime-catalog.json').artifactKind, 'system_catalog');
    assert.equal(findArtifact(observation, 'software-build-overlay.json').artifactKind, 'domain_overlay');
    assert.equal(aiWorkspaceFeatureById(observation, 'events').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'ledgers').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'catalogs').state, 'present');
    assert.equal(aiWorkspaceFeatureById(observation, 'domain_overlays').state, 'present');
    assert.ok(observation.capabilities.includes('events.inspect'));
    assert.ok(observation.capabilities.includes('abg.system.inspect'));
    assert.ok(observation.capabilities.includes('domain_overlay.inspect'));
  } finally {
    removeTempProject(projectRoot);
  }
});

test('observation keeps unknown candidate artifacts browseable as raw files', () => {
  const projectRoot = createTempProject();
  try {
    mkdirSync(join(projectRoot, '.ai-workspace', 'runtime'), { recursive: true });
    writeFileSync(
      join(projectRoot, '.ai-workspace', 'runtime', 'notes.md'),
      '# Runtime notes\n',
      'utf8',
    );

    const observation = loadAiWorkspaceObservation(projectRoot);
    const artifact = findArtifact(observation, 'notes.md');

    assert.ok(artifact);
    assert.equal(artifact.artifactKind, 'raw_file');
    assert.equal(artifact.state, 'present');
    assert.deepEqual(artifact.viewerCapabilities, ['browse.raw']);
    assert.equal(aiWorkspaceFeatureById(observation, 'ai_workspace').state, 'present');
  } finally {
    removeTempProject(projectRoot);
  }
});

test('observation degrades malformed JSON candidates to raw error artifacts', () => {
  const projectRoot = createTempProject();
  try {
    const badManifest = join(projectRoot, 'test', 'proof_inputs', 'bad-proof-manifest.json');
    mkdirSync(join(projectRoot, 'test', 'proof_inputs'), { recursive: true });
    writeFileSync(badManifest, '{ bad json', 'utf8');

    const observation = loadAiWorkspaceObservation(projectRoot);
    const artifact = observation.artifacts.find((candidate) => candidate.relativePath.endsWith('bad-proof-manifest.json'));

    assert.ok(artifact);
    assert.equal(artifact.artifactKind, 'raw_file');
    assert.equal(artifact.state, 'error');
    assert.equal(artifact.viewerCapabilities.includes('browse.raw'), true);
    assert.equal(artifact.diagnostics[0].code, 'json_parse_failed');
  } finally {
    removeTempProject(projectRoot);
  }
});
