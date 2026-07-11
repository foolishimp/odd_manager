import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function event(index, kind, extra = {}) {
  const eventTimeUnixMs = Date.parse('2026-07-10T00:00:00.000Z') + index * 1000;
  return {
    index,
    kind,
    edge: null,
    vectorIndex: null,
    graphFunctionRef: null,
    eventTime: new Date(eventTimeUnixMs).toISOString(),
    eventTimeUnixMs,
    eventAdmissionOrdinal: index,
    ...extra,
  };
}

function vectorArtifact(vectorIndex, attempt, accepted, artifactDir) {
  const suffix = attempt === 1 ? '' : `-attempt-${attempt}`;
  const path = join(artifactDir, `fixture-vector-${vectorIndex}${suffix}-artifact.json`);
  writeJson(path, {
    artifactKind: 'fixture_vector_artifact',
    vectorIndex,
    edge: `fixture_edge_${vectorIndex}`,
    stage: `fixture_stage_${vectorIndex}`,
    graphRef: 'graph://fixture/software-build',
    graphFunctionRef: 'graph-function://fixture/software-build/full',
    overlayRef: 'overlay://fixture/software-build',
    stagePlan: {
      sourceTypeRef: `fixture.type.source_${vectorIndex}`,
      targetTypeRef: `fixture.type.target_${vectorIndex}`,
      vectorId: `graph-vector://fixture/${vectorIndex}`,
      filesToProduce: [`out-${vectorIndex}.txt`],
      executeBeforeAssessment: false,
    },
    assessment: {
      accepted,
      reason: accepted === null ? null : `fixture assessment for vector ${vectorIndex} attempt ${attempt}`,
      nodeTypesUsed: [`fixture.type.source_${vectorIndex}`],
    },
    materializedFileSummaries: [{
      path: `out-${vectorIndex}.txt`,
      sha256: `sha256:fixture${vectorIndex}${attempt}`,
      byteLength: 20 + vectorIndex,
      lineCount: 2,
      contentPreview: `fixture output ${vectorIndex} attempt ${attempt}`,
    }],
    stdout: `fixture stdout for vector ${vectorIndex} attempt ${attempt}`,
    timing: {
      dispatch: {
        startedAt: '2026-07-10T00:00:00.000Z',
        endedAt: '2026-07-10T00:00:01.000Z',
        durationMs: 1000,
      },
      workerTrace: {
        eventsPath: join(artifactDir, `fixture-vector-${vectorIndex}${suffix}.trace`, 'events.ndjson'),
        eventCount: 2,
        eventKinds: ['process_started', 'process_exited'],
        timing: { durationMs: 1000 },
      },
    },
  });
  return path;
}

export function createRunFixture() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-run-fixture-'));
  mkdirSync(join(projectRoot, 'specification'), { recursive: true });
  writeFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), '# fixture_product Product\n\n## Product Identity\n\nFixture product.\n', 'utf8');
  mkdirSync(join(projectRoot, '.ai-workspace', 'events'), { recursive: true });
  const eventLogContent = '{"kind":"fixture_event"}\n';
  const projectEventLogPath = join(projectRoot, '.ai-workspace', 'events', 'events.jsonl');
  writeFileSync(projectEventLogPath, eventLogContent, 'utf8');
  const eventLogSha256 = `sha256:${createHash('sha256').update(eventLogContent).digest('hex')}`;

  const runRoot = join(projectRoot, 'build_tenants', 'fixture', 'typescript', 'test_runs', 'software-build', 'subject', '20260710T000000000Z_pid1');
  const workspaceRoot = join(runRoot, 'instance');
  const artifactDir = join(workspaceRoot, '.ai-workspace', 'software-build-live', 'fixture');
  mkdirSync(artifactDir, { recursive: true });
  const eventLogPath = join(workspaceRoot, '.ai-workspace', 'events', 'events.jsonl');
  mkdirSync(dirname(eventLogPath), { recursive: true });
  writeFileSync(eventLogPath, eventLogContent, 'utf8');

  writeJson(join(runRoot, 'sandbox-identity.json'), {
    kind: 'fixture_live_sandbox',
    scenarioId: 'SCN-FIXTURE-RUN',
    scenarioKind: 'fixture_run',
    scenarioProofClass: 'fixture_graph_traversal',
    graphRef: 'graph://fixture/software-build',
    graphFunctionRef: 'graph-function://fixture/software-build/full',
    overlayRef: 'overlay://fixture/software-build',
    startupConfigRef: 'startup://fixture/software-build',
    runRoot,
    workspaceRoot,
  });

  const eventSequence = [
    event(0, 'graph_function_selected'),
    event(1, 'graph_call_opened'),
    event(2, 'frame_opened'),
    event(3, 'vector_traversal_planned', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(4, 'payload_observed', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(5, 'payload_validated', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(6, 'evidence_admitted', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(7, 'vector_evaluated', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(8, 'vector_closed', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(9, 'retry_attempt_opened', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(10, 'continuation_reopened', { vectorIndex: 0, edge: 'fixture_edge_0' }),
    event(11, 'graph_function_selected'),
    event(12, 'graph_call_opened'),
    event(13, 'frame_opened'),
    event(14, 'vector_traversal_planned', { vectorIndex: 1, edge: 'fixture_edge_1' }),
    event(15, 'fixture_novel_event', { vectorIndex: 1, edge: 'fixture_edge_1', pressure: 'open' }),
    event(16, 'registry_entry_admitted', {
      graphFunctionRef: `graph_function:${JSON.stringify({
        name: 'fixture.type.catalogued_asset',
        inputs: [{ typeRef: 'fixture.type.catalogued_asset' }],
        outputs: [{ typeRef: 'fixture.type.catalogued_asset' }],
        template: { kind: 'inline_graph', ref: 'inline:fixture.type.catalogued_asset' },
        declarations: { entries: [{ key: 'fixture.catalog.declaration' }] },
        tags: ['gtl:node_type', 'node_type', 'non_callable'],
      })}`,
    }),
    event(17, 'registry_entry_admitted', {
      graphFunctionRef: `graph_function:${JSON.stringify({
        name: 'fixture.type.catalogued_asset',
        inputs: [{ typeRef: 'fixture.type.catalogued_asset' }],
        outputs: [{ typeRef: 'fixture.type.catalogued_asset' }],
        template: { kind: 'inline_graph', ref: 'inline:fixture.type.catalogued_asset' },
        declarations: { entries: [{ key: 'fixture.catalog.declaration' }] },
        tags: ['gtl:node_type', 'node_type', 'non_callable', 'fixture_variant'],
      })}`,
    }),
    event(18, 'registry_entry_admitted', {
      graphFunctionRef: 'graph-function://fixture/software-build/full',
    }),
    event(19, 'registry_entry_rejected', {
      entryKind: 'plugin',
      declarationRef: 'declaration://fixture/rejected-plugin',
      rejectionReason: 'contract_identity_mismatch',
      conflictingEntryRefs: ['plugin://fixture/existing'],
    }),
    event(20, 'construction_action_catalog_projected', {
      catalogRef: 'construction-catalog://fixture/1',
      episodeId: 'episode://fixture/1',
      hookResolutionRef: 'hook-resolution://fixture/default',
      fallbackConfigDigest: 'sha256:fixture-catalog',
      traversalPublicationRefs: ['refinement-boundary://fixture/full'],
    }),
  ];
  const eventCounts = Object.fromEntries([...new Set(eventSequence.map((entry) => entry.kind))].map((kind) => [kind, eventSequence.filter((entry) => entry.kind === kind).length]));
  writeJson(join(runRoot, 'fixture-live-proof.json'), {
    kind: 'fixture_overlay_live_proof',
    scenarioId: 'SCN-FIXTURE-RUN',
    scenarioKind: 'fixture_run',
    proofClass: 'fixture_graph_traversal',
    graphRef: 'graph://fixture/software-build',
    graphFunctionRef: 'graph-function://fixture/software-build/full',
    overlayRef: 'overlay://fixture/software-build',
    startupConfigRef: 'startup://fixture/software-build',
    runtimeBindingPath: 'runtime://fixture/binding',
    eventLogSha256,
    campaignDurationMs: 15000,
    substrate: {
      productId: 'fixture-substrate',
      packageName: '@fixture/runtime',
      packageVersion: '1.2.3',
      releaseTag: 'v1.2.3',
      sourceCommit: 'abcdef123456',
    },
    eventCounts,
    eventSequence,
    requirementLineageCanary: {
      requirements: [{
        requirementId: 'REQ-FIXTURE-001',
        spanIds: ['span://fixture/1'],
        vectorIndexes: [0, 1],
        reachedVectorIndexes: [0],
        enteringPromptRefCounts: [1],
        coverageStatuses: ['partial'],
        foldStates: ['open'],
        residualPressureRefs: ['pressure://fixture/open'],
      }],
    },
    startOutput: { command: 'start', status: 'active', event_kinds: eventSequence.map((entry) => entry.kind) },
  });

  vectorArtifact(0, 1, false, artifactDir);
  vectorArtifact(0, 2, true, artifactDir);
  vectorArtifact(1, 1, null, artifactDir);
  writeJson(join(artifactDir, 'fixture-vector-0-evaluator-artifact.json'), {
    vectorIndex: 0,
    edge: 'fixture_edge_0',
    stage: 'fixture_stage_0_evaluator',
    assessment: { accepted: true, reason: 'evaluator accepted', nodeTypesUsed: [] },
    materializedFileSummaries: [],
  });

  writeJson(join(workspaceRoot, 'test-execution-result.json'), {
    status: 0,
    observedTestPassCount: 3,
    observedTestReports: [{ path: 'TEST-fixture.xml', tests: 3, failures: 0, errors: 0, skipped: 0 }],
  });
  writeJson(join(workspaceRoot, 'depth-proof-map.json'), {
    rows: [{ requirementId: 'REQ-FIXTURE-001', depthClassRef: 'depth-class://positive', testIdentityRefs: ['fixture test'] }],
  });
  writeJson(join(workspaceRoot, 'mutation-outcomes.json'), {
    rows: [{ requirementId: 'REQ-FIXTURE-001', mutantIdentity: 'fixture mutant', suiteExit: 1, baselineDigest: 'sha256:same', restoreDigest: 'sha256:same' }],
  });

  return {
    projectRoot,
    runRoot,
    workspaceRoot,
    artifactDir,
    eventLogPath,
    projectEventLogPath,
    eventLogSha256,
    cleanup() { rmSync(projectRoot, { recursive: true, force: true }); },
    addAttempt(vectorIndex, attempt, accepted = true) {
      const path = vectorArtifact(vectorIndex, attempt, accepted, artifactDir);
      const future = new Date(Date.now() + 2000);
      utimesSync(artifactDir, future, future);
      return path;
    },
  };
}
