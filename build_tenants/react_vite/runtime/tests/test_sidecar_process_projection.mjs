import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import {
  loadSidecarProcessProjection,
  SIDECAR_PROCESS_CONTRACT_NAME,
  SIDECAR_PROCESS_CONTRACT_VERSION,
} from '../../src/server/sidecar-process-projection.mjs';

const DATA_MAPPER_TEST56 =
  '/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test56.ts';

function installedTempWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-process-'));
  mkdirSync(join(root, '.ai-workspace/runtime'), { recursive: true });
  mkdirSync(join(root, '.ai-workspace/events'), { recursive: true });
  mkdirSync(join(root, '.abiogenesis/odd_sdlc/typescript'), { recursive: true });
  writeFileSync(
    join(root, '.ai-workspace/runtime/odd_sdlc-typescript-installation.json'),
    JSON.stringify({ kind: 'odd_sdlc_typescript_installation_projection' }),
  );
  writeFileSync(
    join(root, '.abiogenesis/odd_sdlc/typescript/install-manifest.json'),
    JSON.stringify({
      kind: 'odd_sdlc_typescript_install_manifest',
      packageName: '@odd-sdlc/typescript-tenant',
    }),
  );
  return root;
}

function installFakeOddSdlcCli(root, queryPayload, catalogPayload = null, analysisPayload = null) {
  const cliPath = join(root, 'fake-odd-sdlc-cli.mjs');
  writeFileSync(
    cliPath,
    [
      'const command = process.argv[2];',
      `const queryPayload = ${JSON.stringify(queryPayload)};`,
      `const catalogPayload = ${JSON.stringify(catalogPayload ?? {
        kind: 'sdlc_graph_function_catalog',
        executives: [],
        functions: [],
        libraryFunctions: [],
      })};`,
      `const analysisPayload = ${JSON.stringify(analysisPayload)};`,
      "if (command === 'query-domain') { console.log(JSON.stringify({ payload: queryPayload })); process.exit(0); }",
      "if (command === 'catalog') { console.log(JSON.stringify({ payload: catalogPayload })); process.exit(0); }",
      "if (command === 'analyze-run' && analysisPayload) { console.log(JSON.stringify(analysisPayload)); process.exit(0); }",
      "console.error(`unsupported command ${command}`);",
      'process.exit(1);',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(root, '.abiogenesis/odd_sdlc/typescript/install-manifest.json'),
    JSON.stringify({
      kind: 'odd_sdlc_typescript_install_manifest',
      packageName: '@odd-sdlc/typescript-tenant',
      commandBindings: [{ commandName: 'odd-sdlc-ts', packageCommandPath: cliPath }],
    }),
  );
  return cliPath;
}

function writeOpRun(root, name, leafName, result, options = {}) {
  const opRunPath = join(root, '.ai-workspace/runtime/odd_sdlc/operator-runs', name);
  const tracePath = join(opRunPath, 'worker_process_events.jsonl.trace');
  mkdirSync(tracePath, { recursive: true });
  writeJsonFile(join(opRunPath, 'handoff_manifest.json'), {
    kind: 'sdlc_worker_handoff_manifest',
    edgeName: leafName,
    ...options.manifest,
  });
  writeFileSync(join(opRunPath, 'worker_process_events.jsonl'), '');
  if (options.postflight) writeJsonFile(join(opRunPath, 'postflight.json'), { ok: true });
  if (options.fpEvaluate) writeJsonFile(join(opRunPath, 'fp_evaluate_result.json'), { ok: true });
  writeJsonFile(join(tracePath, 'result.json'), result);
  const mtime = new Date(options.mtime ?? Date.now());
  utimesSync(opRunPath, mtime, mtime);
  return opRunPath;
}

function writeJsonFile(path, value) {
  writeFileSync(path, JSON.stringify(value));
}

function tracedResult(overrides = {}) {
  return {
    outcome: { kind: 'exited', detail: null },
    executorProfile: 'pty-terminal',
    streamModel: 'terminal-transcript',
    parser: 'claude-stream-json',
    status: 0,
    signal: null,
    timedOut: false,
    inactivityTimedOut: false,
    structuredEventCount: 2,
    apiRetryEvents: [],
    toolCallEvents: [],
    terminalSessionId: 'pty-fixture',
    ...overrides,
  };
}

function analysisPayload(overrides = {}) {
  const {
    operatorRunRef = 'file:///fixture/workspace/.ai-workspace/runtime/odd_sdlc/operator-runs/20260518T010000Z_pid1',
    ...rest
  } = overrides;
  return {
    kind: 'sdlc_fd_run_analysis',
    version: 1,
    inspectedRoot: '/fixture/workspace',
    inspectedKind: 'workspace',
    profile: 'generic',
    readOnly: true,
    currentStateTelemetrySummary: {
      inspectedRoot: '/fixture/workspace',
      inspectedKind: 'workspace',
      scenarioName: 'fixture-workspace',
      profile: 'generic',
      operatorRunCount: 2,
      graphEdgeSequence: ['derive_intent_surface', 'derive_design_surface'],
      sameEdgeRetryCount: 1,
      blockedAttemptCount: 1,
      repairAttemptCount: 0,
      yieldedAttemptCount: 0,
      abortedAttemptCount: 0,
      finalClosureDisposition: 'retry',
      totalWallClockMs: 1234,
      totalWorkerElapsedMs: 1100,
      unattributedElapsedMs: 134,
      archiveBytes: {
        totalBytes: 4096,
        promptContextBytes: 512,
        handoffBytes: 256,
        stdoutBytes: 128,
        runtimeEventBytes: 64,
      },
      productFileCount: 1,
      requirementObligationCount: 3,
      productFileLineageCount: 2,
    },
    edgeTraversal: [
      {
        attemptOrdinal: 0,
        operatorRunRef,
        graphFunctionName: 'derive_intent_surface',
        graphVectorRef: 'derive_intent_surface',
        targetAssetType: 'intent_surface',
        traversalClass: 'constructive',
        workerElapsedMs: 500,
        edgeWindowElapsedMs: 550,
        deterministicElapsedMs: 50,
        fpEvaluateStatus: 'passed',
        postflightStatus: 'passed',
        executionEvidenceStatus: null,
        executionEvidenceReportCount: 0,
        residualPressureRefCount: 0,
        residualPressureTransition: 'cleared',
        closureDisposition: 'close',
        selectedNextActionRef: null,
        predecessorAttemptRef: null,
        blockingReasonCodes: [],
        productFilesWritten: ['specification/INTENT.md'],
        productFilesReplayed: [],
        requirementObligationCount: 3,
        productLineageCount: 2,
        promptContextBytes: 512,
        handoffBytes: 256,
        stdoutBytes: 128,
        eventBytes: 64,
        workerStatus: 'worker_invoked',
      },
    ],
    activeRunLiveness: {
      activeOperatorRunRef: operatorRunRef,
      activeEdgeRef: 'derive_intent_surface',
      activeGraphVectorRef: 'derive_intent_surface',
      activeTargetAssetType: 'intent_surface',
      workerPid: 123,
      processAlive: false,
      lastEventAtMs: 100,
      lastStdoutAtMs: 120,
      heartbeatAgeMs: null,
      maxNoOutputGapMs: 50,
      archiveGrowthBytesPerMinute: 0,
      productiveSignal: 'completed',
      lastBlockingReason: null,
    },
    runtimeArtifactGaps: [{
      operatorRunRef,
      artifact: 'worker_run.json',
      status: 'missing',
      detail: null,
    }],
    diagnostics: [
      {
        kind: 'sdlc_fd_run_analysis_diagnostic',
        code: 'runtime_artifact_missing',
        severity: 'warn',
        detail: 'worker_run.json missing',
        evidenceRefs: [operatorRunRef],
        operatorRunRef,
        edgeName: 'derive_intent_surface',
        policyRef: null,
      },
    ],
    bloatAndSlopeAnalysis: {},
    retryForensics: [{
      edgeName: 'derive_intent_surface',
      attemptRef: operatorRunRef,
      predecessorAttemptRef: null,
      workerSecondsBefore: null,
      blockingReasonCodes: ['worker_authority_read_outside_workspace'],
      changedFiles: [],
      productFilesObserved: [],
      productFilesMaterialized: [],
      productFilesReplayed: [],
      lineageStatus: 'unknown',
      outsideWorkspaceReadCount: 1,
      schemaViolationCount: 0,
      likelyCauseClass: 'worker_policy_violation',
    }],
    conceptualStageCoverage: [{
      kind: 'sdlc_fd_run_analysis_conceptual_stage_coverage',
      test35StageRef: 'test35://stage/intent',
      expectedEdgeName: 'derive_intent_surface',
      expectedTargetAssetType: 'intent_surface',
      mappedEdgeName: 'derive_intent_surface',
      mappedTargetAssetType: 'intent_surface',
      stageClass: 'constructive',
      operatorRunRefs: [operatorRunRef],
    }],
    summaryDrift: { drifts: [{ field: 'operatorRunCount' }] },
    evidenceIndex: [operatorRunRef],
    ...rest,
  };
}

test('data_mapper test56 TypeScript event log projects the three Sidecar process views', () => {
  assert.ok(existsSync(DATA_MAPPER_TEST56), 'data_mapper.test56.ts fixture is required');
  const projection = loadSidecarProcessProjection(DATA_MAPPER_TEST56);

  assert.equal(projection.supported, true);
  assert.equal(projection.contractName, SIDECAR_PROCESS_CONTRACT_NAME);
  assert.equal(projection.contractVersion, SIDECAR_PROCESS_CONTRACT_VERSION);
  assert.equal(projection.readOnly, true);
  assert.deepEqual(
    projection.views.map((view) => view.label),
    ['Active Work', 'Blocked / Waiting', 'Ready for Handoff'],
  );
  assert.deepEqual(
    projection.views.map((view) => view.id),
    ['active_work', 'blocked_waiting', 'ready_handoff'],
  );
  for (const kind of [
    'graph_call_opened',
    'frame_opened',
    'vector_traversal_planned',
    'vector_evaluated',
    'vector_closed',
    'assessed',
  ]) {
    assert.ok(projection.eventKinds.includes(kind), `${kind} should be projected`);
  }
  assert.ok(projection.eventCount > 0);
  assert.ok(projection.records.length > 0);
  assert.ok(projection.views.some((view) => view.id === 'blocked_waiting' && view.recordIds.length > 0));
  assert.ok(projection.views.some((view) => view.id === 'ready_handoff' && view.recordIds.length > 0));
  assert.deepEqual(
    projection.maps.map((map) => map.label),
    ['Process Flow Map', 'Builder Governance Graph', 'Runtime Evidence Flow'],
  );
  assert.ok(
    projection.maps.find((map) => map.id === 'process_flow')?.nodes.some((node) => node.label === 'derive_code_surface'),
    'process flow map should expose query-domain graph functions',
  );
  assert.ok(
    projection.maps.find((map) => map.id === 'builder_governance')?.nodes.some((node) => node.label === 'Project Conformance'),
    'builder governance graph should expose project conformance',
  );
  assert.ok(
    projection.maps.find((map) => map.id === 'runtime_evidence')?.nodes.some((node) => node.label === 'derive_code_surface'),
    'runtime evidence flow should expose observed vector records',
  );
  const runtimeEvidence = projection.maps.find((map) => map.id === 'runtime_evidence');
  assert.ok(runtimeEvidence, 'runtime evidence flow should be present');
  assert.equal(
    runtimeEvidence.edges.some((edge) => edge.label === 'event log'),
    false,
    'runtime evidence flow should not draw collapsed event-log adjacency as process graph edges',
  );
  assert.ok(
    runtimeEvidence.edges.some((edge) => edge.label === 'next vector'),
    'runtime evidence flow should preserve vector-index progression',
  );
});

test('builder governance graph aligns rows so produces edges connect adjacent column pairs', () => {
  assert.ok(existsSync(DATA_MAPPER_TEST56), 'data_mapper.test56.ts fixture is required');
  const projection = loadSidecarProcessProjection(DATA_MAPPER_TEST56);
  const map = projection.maps.find((entry) => entry.id === 'builder_governance');
  assert.ok(map, 'builder governance graph should be present');

  // No two nodes may occupy the same (column, row) cell. The earlier defect
  // placed Project Conformance and the first start-target both at
  // (col 1, row 0) because Project Conformance was hardcoded to row 0
  // without consuming the col-1 row counter.
  const seen = new Map();
  for (const node of map.nodes) {
    const key = `${node.column}:${node.row}`;
    const existing = seen.get(key);
    assert.equal(
      existing,
      undefined,
      `builder governance node ${node.label} collides with ${existing} at (col ${node.column}, row ${node.row})`,
    );
    seen.set(key, node.label);
  }

  // Every "produces" edge must connect a col-2 governed-function to its
  // col-3 asset at the same row. The earlier defect placed col-2 and col-3
  // rows on independent counters, so produces edges rendered as steep
  // cross-row diagonals between visually-adjacent BOOTSTRAP and OWNED
  // ASSETS pairs.
  const producesEdges = map.edges.filter((edge) => edge.label === 'produces');
  assert.ok(producesEdges.length > 0, 'produces edges should exist for fixture data');
  for (const edge of producesEdges) {
    const fromNode = map.nodes.find((node) => node.id === edge.from);
    const toNode = map.nodes.find((node) => node.id === edge.to);
    assert.ok(fromNode && toNode, `produces edge endpoints must resolve: ${edge.id}`);
    assert.equal(fromNode.column, 2, `produces edge from-node must be col 2: ${fromNode.label}`);
    assert.equal(toNode.column, 3, `produces edge to-node must be col 3: ${toNode.label}`);
    assert.equal(
      fromNode.row,
      toNode.row,
      `produces edge ${fromNode.label} -> ${toNode.label} must be row-aligned (got col2 row=${fromNode.row}, col3 row=${toNode.row})`,
    );
  }

  // Every "starts" edge must connect a col-1 start-target to its col-2
  // function at the same row. An earlier in-progress fix made produces
  // horizontal but pushed start-target functions to col-2 rows after the
  // asset-producer band, turning the starts edges into long diagonals
  // that cut vertically through the BOOTSTRAP column. The coordinated
  // claimCoordRow allocator now reserves the same row in col 1 and col 2
  // simultaneously, by construction.
  const startsEdges = map.edges.filter((edge) => edge.label === 'starts');
  assert.ok(startsEdges.length > 0, 'starts edges should exist for fixture data');
  for (const edge of startsEdges) {
    const fromNode = map.nodes.find((node) => node.id === edge.from);
    const toNode = map.nodes.find((node) => node.id === edge.to);
    assert.ok(fromNode && toNode, `starts edge endpoints must resolve: ${edge.id}`);
    assert.equal(fromNode.column, 1, `starts edge from-node must be col 1: ${fromNode.label}`);
    assert.equal(toNode.column, 2, `starts edge to-node must be col 2: ${toNode.label}`);
    assert.equal(
      fromNode.row,
      toNode.row,
      `starts edge ${fromNode.label} -> ${toNode.label} must be row-aligned (got col1 row=${fromNode.row}, col2 row=${toNode.row})`,
    );
  }
});

test('missing TypeScript odd_sdlc install fails closed while preserving generic Project support', () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-generic-'));
  const projection = loadSidecarProcessProjection(root);

  assert.equal(projection.supported, false);
  assert.match(projection.unsupportedReason ?? '', /TypeScript installation projection is missing/);
  assert.deepEqual(
    projection.views.map((view) => view.label),
    ['Active Work', 'Blocked / Waiting', 'Ready for Handoff'],
  );
  assert.equal(projection.records.length, 0);
  assert.equal(projection.maps.length, 0);
});

test('legacy non-TypeScript process event shape is explicitly unsupported', () => {
  const root = installedTempWorkspace();
  writeFileSync(
    join(root, '.ai-workspace/events/events.jsonl'),
    `${JSON.stringify({
      kind: 'graph_call_opened',
      basisId: 'execution_basis:{"moduleName":"odd_sdlc_python"}',
      resolvedRuntimeRef: 'runtime://abiogenesis/python',
      graphCallId: 'graph-call:python',
      graphFunctionId: 'graph-function:odd_sdlc:Fg_legacy_python',
    })}\n`,
  );

  const projection = loadSidecarProcessProjection(root);
  assert.equal(projection.supported, false);
  assert.match(projection.unsupportedReason ?? '', /does not contain odd_sdlc TypeScript runtime basis/);
  assert.equal(projection.contractName, SIDECAR_PROCESS_CONTRACT_NAME);
  assert.equal(projection.contractVersion, SIDECAR_PROCESS_CONTRACT_VERSION);
  assert.equal(projection.maps.length, 0);
});

test('large TypeScript process event logs are capped before projection', () => {
  const root = installedTempWorkspace();
  installFakeOddSdlcCli(root, {
    kind: 'sdlc_query_domain_projection',
    contractName: SIDECAR_PROCESS_CONTRACT_NAME,
    contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
    graphFunctions: [],
  });
  const line = JSON.stringify({
    kind: 'graph_call_opened',
    basisId: 'execution_basis:{"moduleName":"odd_sdlc_typescript"}',
    graphFunctionId: 'derive_intent_surface',
    graphCallId: 'graph-call-fixture',
    frameId: 'frame-fixture',
    detail: 'x'.repeat(760),
  });
  writeFileSync(
    join(root, '.ai-workspace/events/events.jsonl'),
    Array.from({ length: 13000 }, () => line).join('\n'),
  );

  const projection = loadSidecarProcessProjection(root);
  assert.equal(projection.supported, true);
  assert.ok(projection.eventCount > 0);
  assert.ok(projection.eventCount < 13000, 'projection should not parse the entire oversized event log');
  assert.ok(projection.eventKinds.includes('graph_call_opened'));
});

test('per-leaf overlay derives status and trace archive from latest invocation only', () => {
  const root = installedTempWorkspace();
  writeOpRun(
    root,
    '20260504T010000Z_pid1',
    'derive_intent_surface',
    tracedResult({
      outcome: { kind: 'hard_timeout', detail: 'stale failure' },
      status: null,
      timedOut: true,
    }),
    { mtime: '2026-05-04T01:00:00.000Z' },
  );
  const latestPath = writeOpRun(
    root,
    '20260504T020000Z_pid2',
    'derive_intent_surface',
    tracedResult({
      sessionId: 'pty-latest',
      outcome: { kind: 'exited', detail: null },
      status: 0,
    }),
    { mtime: '2026-05-04T02:00:00.000Z', postflight: true },
  );

  const projection = loadSidecarProcessProjection(root);
  assert.equal(projection.supported, true);
  assert.equal(projection.leafOverlays.length, 1);
  const overlay = projection.leafOverlays[0];
  assert.equal(overlay.leafName, 'derive_intent_surface');
  assert.equal(overlay.invocationCount, 2);
  assert.equal(
    overlay.latestStatus,
    'fd_postflight_passed',
    'stale failed evidence from an older op-run must not poison latest status',
  );
  assert.equal(overlay.tracedEvidence.length, 2);
  assert.equal(overlay.tracedEvidence[0].outcome.kind, 'hard_timeout');
  assert.equal(overlay.tracedEvidence[1].outcome.kind, 'exited');
  assert.equal(
    overlay.traceArchiveRoot,
    join(latestPath, 'worker_process_events.jsonl.trace'),
    'overlay traceArchiveRoot should point at the latest admitted invocation',
  );
});

test('per-edge outcome decoration uses the latest traced invocation and trace archive', () => {
  const root = installedTempWorkspace();
  installFakeOddSdlcCli(root, {
    kind: 'sdlc_query_domain_projection',
    contractName: SIDECAR_PROCESS_CONTRACT_NAME,
    contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
    graphFunctions: [
      {
        name: 'derive_intent_surface',
        inputNames: [],
        outputNames: ['intent_surface'],
        vectorNames: ['derive_intent_surface'],
      },
      {
        name: 'derive_design_surface',
        inputNames: ['intent_surface'],
        outputNames: ['design_surface'],
        vectorNames: ['derive_design_surface'],
      },
    ],
    startTargets: [{ name: 'derive_intent_surface', jobName: 'bootstrap_release_self_test' }],
    assetOwnership: [
      { assetType: 'intent_surface', producerGraphFunctions: ['derive_intent_surface'] },
    ],
    projectConformance: {
      status: 'conformant',
      governingGraphFunction: 'Fg_conform_project',
    },
  });
  writeOpRun(
    root,
    '20260504T010000Z_pid1',
    'derive_intent_surface',
    tracedResult({
      outcome: { kind: 'process_error', detail: 'stale failure' },
      status: 1,
    }),
    { mtime: '2026-05-04T01:00:00.000Z' },
  );
  const latestPath = writeOpRun(
    root,
    '20260504T020000Z_pid2',
    'derive_intent_surface',
    tracedResult({
      outcome: { kind: 'exited', detail: null },
      status: 0,
      executorProfile: 'local-spawn',
      streamModel: 'stdio',
      terminalSessionId: null,
    }),
    { mtime: '2026-05-04T02:00:00.000Z', postflight: true },
  );

  const projection = loadSidecarProcessProjection(root);
  const flow = projection.maps.find((map) => map.id === 'process_flow');
  assert.ok(flow, 'process flow map should be projected from fake query-domain payload');
  const decorated = flow.edges.find((edge) => edge.label === 'intent_surface');
  assert.ok(decorated, 'handoff edge should exist for produced intent_surface');
  assert.equal(decorated.latestOutcome, 'exited');
  assert.equal(decorated.executorProfile, 'local-spawn');
  assert.equal(decorated.traceArchiveRoot, join(latestPath, 'worker_process_events.jsonl.trace'));
});

test('T-161 analyze-run output projects as Process Navigator Live View read model', () => {
  const root = installedTempWorkspace();
  const opRunPath = writeOpRun(
    root,
    '20260518T010000Z_pid1',
    'derive_intent_surface',
    tracedResult({ sessionId: 'live-analysis-fixture' }),
  );
  const operatorRunRef = pathToFileURL(opRunPath).href;
  writeJsonFile(join(opRunPath, 'runtime_events.json'), {
    kind: 'sdlc_runtime_event_archive_projection',
    eventCount: 2,
    events: [
      {
        kind: 'actor_process_started',
        edge: 'derive_intent_surface',
        workerId: 'worker://odd-sdlc/fixture',
        backendId: 'backend://fixture',
        detail: 'worker process started',
        elapsedMs: 3,
        evidenceRefs: [operatorRunRef],
      },
      {
        kind: 'payload_validated',
        edge: 'derive_intent_surface',
        detail: 'closure payload validated',
        elapsedMs: 24,
      },
    ],
  });
  writeFileSync(
    join(opRunPath, 'worker_process_events.jsonl'),
    [
      JSON.stringify({ type: 'system', cwd: root, model: 'fixture-model', session_id: 'fixture-session' }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'completed' }),
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(opRunPath, 'worker_process_events.jsonl.trace', 'terminal.transcript'),
    [
      JSON.stringify({ type: 'system', cwd: root, model: 'fixture-model', session_id: 'fixture-session' }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Read', input: { file_path: 'specification/INTENT.md' } }],
        },
      }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'completed' }),
      '',
    ].join('\n'),
  );
  installFakeOddSdlcCli(
    root,
    {
      kind: 'sdlc_query_domain_projection',
      contractName: SIDECAR_PROCESS_CONTRACT_NAME,
      contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
      graphFunctions: [],
    },
    null,
    analysisPayload({ operatorRunRef }),
  );

  const projection = loadSidecarProcessProjection(root);
  assert.equal(projection.supported, true);
  assert.equal(projection.liveAnalysis.kind, 'sidecar_live_analysis_projection');
  assert.equal(projection.liveAnalysis.sourceKind, 'sdlc_fd_run_analysis');
  assert.equal(projection.liveAnalysis.readOnly, true);
  assert.equal(projection.liveAnalysis.telemetry.operatorRunCount, 2);
  assert.equal(projection.liveAnalysis.telemetry.sameEdgeRetryCount, 1);
  assert.equal(projection.liveAnalysis.liveness.productiveSignal, 'completed');
  assert.equal(
    projection.liveAnalysis.liveness.activeOperatorRunPath,
    opRunPath,
  );
  assert.equal(projection.liveAnalysis.attempts.length, 1);
  assert.equal(projection.liveAnalysis.attempts[0].graphFunctionName, 'derive_intent_surface');
  assert.equal(projection.liveAnalysis.attempts[0].operatorRunPath, opRunPath);
  assert.equal(projection.liveAnalysis.attempts[0].detail.kind, 'sidecar_live_analysis_run_detail');
  assert.equal(projection.liveAnalysis.attempts[0].detail.runtimeGaps[0].artifact, 'worker_run.json');
  assert.equal(projection.liveAnalysis.attempts[0].detail.diagnostics[0].code, 'runtime_artifact_missing');
  assert.equal(projection.liveAnalysis.attempts[0].detail.retryForensics[0].likelyCauseClass, 'worker_policy_violation');
  assert.equal(projection.liveAnalysis.attempts[0].detail.stageCoverage[0].test35StageRef, 'test35://stage/intent');
  assert.equal(projection.liveAnalysis.attempts[0].detail.cliTranscript.sourceKind, 'terminal_transcript');
  assert.equal(projection.liveAnalysis.attempts[0].detail.cliTranscript.lineCount, 3);
  assert.match(projection.liveAnalysis.attempts[0].detail.cliTranscript.lines[1].text, /Tool call: Read/);
  assert.ok(
    projection.liveAnalysis.attempts[0].detail.events.length >= 4,
    'event viewer should project artifact, runtime, and worker tickets for the selected stage',
  );
  assert.ok(projection.liveAnalysis.attempts[0].detail.events.some((event) => event.sourceKind === 'artifact' && event.eventType === 'handoff_manifest'));
  assert.ok(projection.liveAnalysis.attempts[0].detail.events.some((event) => event.sourceKind === 'runtime_event' && event.eventType === 'actor_process_started'));
  assert.ok(projection.liveAnalysis.attempts[0].detail.events.some((event) => event.sourceKind === 'worker_event' && event.eventType === 'system'));
  assert.match(
    projection.liveAnalysis.attempts[0].detail.events.find((event) => event.eventType === 'actor_process_started').rawPreview,
    /worker process started/,
  );
  assert.equal(projection.liveAnalysis.diagnostics[0].kind, 'sidecar_live_analysis_diagnostic');
  assert.equal(projection.liveAnalysis.runtimeArtifactGapCount, 1);
  assert.equal(projection.liveAnalysis.retryForensicCount, 1);
  assert.equal(projection.liveAnalysis.summaryDriftCount, 1);
});

test('Live View event projection defers oversized archive JSON instead of parsing it', () => {
  const root = installedTempWorkspace();
  const opRunPath = writeOpRun(
    root,
    '20260518T020000Z_pid2',
    'derive_intent_surface',
    tracedResult({ sessionId: 'oversized-archive-fixture' }),
  );
  const operatorRunRef = pathToFileURL(opRunPath).href;
  writeFileSync(
    join(opRunPath, 'fp_transform_request.json'),
    `{"payload":"${'x'.repeat(9 * 1024 * 1024)}"}`,
  );
  installFakeOddSdlcCli(
    root,
    {
      kind: 'sdlc_query_domain_projection',
      contractName: SIDECAR_PROCESS_CONTRACT_NAME,
      contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
      graphFunctions: [],
    },
    null,
    analysisPayload({ operatorRunRef }),
  );

  const projection = loadSidecarProcessProjection(root);
  const event = projection.liveAnalysis.attempts[0].detail.events.find(
    (candidate) => candidate.eventType === 'fp_transform_request',
  );
  assert.ok(event, 'oversized artifact should still be visible as an event ticket');
  assert.equal(event.sourceKind, 'artifact');
  assert.equal(event.tone, 'pending');
  assert.match(event.summary, /preview parsing was deferred/);
  assert.match(event.rawPreview, /"deferred": true/);
  assert.match(event.rawPreview, /"reason": "oversized_json"/);
  assert.ok(event.rawPreview.length < 2600, 'raw preview should remain bounded');
  assert.ok(event.detailRows.some((row) => row.label === 'Archive size'));
  assert.ok(event.detailRows.some((row) => row.label === 'Parse limit'));
});

test('T-164 edge assurance carriers are projected without treating postflight as closure authority', () => {
  const root = installedTempWorkspace();
  installFakeOddSdlcCli(root, {
    kind: 'sdlc_query_domain_projection',
    contractName: SIDECAR_PROCESS_CONTRACT_NAME,
    contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
    graphFunctions: [
      {
        name: 'derive_design_surface',
        inputNames: ['requirement_surface'],
        outputNames: ['design_surface'],
        vectorNames: ['derive_design_surface'],
      },
    ],
  });
  const opRunPath = writeOpRun(
    root,
    '20260514T010000Z_pid164',
    'derive_design_surface',
    tracedResult({ sessionId: 'edge-assurance-fixture' }),
    {
      postflight: true,
      manifest: {
        graphFunctionName: 'bootstrap_release_self_test',
        vectorIndex: 3,
        targetAssetType: 'design_surface',
        inputAssetTypes: ['requirement_surface'],
        edgeAssuranceContractRef: 'edge-assurance-contract://odd-sdlc/derive_design_surface',
        edgeAssuranceContractDigest: 'sha256:t164-design-contract',
      },
    },
  );
  writeJsonFile(join(opRunPath, 'sdlc_edge_fulfillment_ledger.json'), {
    kind: 'sdlc_edge_fulfillment_ledger',
    ledgerRef: 'ledger://odd-sdlc/t164/design',
    ledgerVersionRef: 'ledger-version://odd-sdlc/t164/design/1',
    edgeRef: 'edge://odd-sdlc/bootstrap/derive-design/3',
    edgeAssuranceContractRef: 'edge-assurance-contract://odd-sdlc/derive_design_surface',
    edgeAssuranceContractDigest: 'sha256:t164-design-contract',
    edgeGainRef: 'edge-gain://odd-sdlc/t164/design',
    edgeResidualPressureRefs: ['pressure://odd-sdlc/t164/design/missing-proof'],
    targetBindingRefs: ['target-binding://odd-sdlc/t164/design'],
    evidenceBundleRefs: ['evidence://odd-sdlc/t164/design/worksite'],
    materializationRefs: ['file://build_tenants/app/design/design_surface.md'],
    admissionRefs: ['evidence://odd-sdlc/t164/design/worksite'],
    counts: {
      expected: 2,
      fulfilled: 1,
      partial: 0,
      blocked: 1,
      unfulfilled: 0,
      missing: 0,
      extra: 0,
    },
    carryConverged: true,
    fulfillmentConverged: false,
    admitted: true,
    targetCertificationPassed: false,
    fdRecheckPassed: true,
    edgeConverged: false,
  });
  writeJsonFile(join(opRunPath, 'sdlc_edge_closure_decision.json'), {
    kind: 'sdlc_edge_closure_decision',
    decisionRef: 'closure-decision://odd-sdlc/t164/design/1',
    ledgerRef: 'ledger://odd-sdlc/t164/design',
    ledgerVersionRef: 'ledger-version://odd-sdlc/t164/design/1',
    edgeAssuranceContractRef: 'edge-assurance-contract://odd-sdlc/derive_design_surface',
    edgeAssuranceContractDigest: 'sha256:t164-design-contract',
    edgeGainRef: 'edge-gain://odd-sdlc/t164/design',
    edgeClosureFunctionRef: 'function://odd-sdlc/edge-gain/solution_formalisation/close-edge',
    edgeResidualPressureRefs: ['pressure://odd-sdlc/t164/design/missing-proof'],
    disposition: 'retry',
    reasonRefs: ['blocking-reason://odd-sdlc/t164/design/missing-proof'],
  });
  writeJsonFile(join(opRunPath, 'sdlc_next_action_projection.json'), {
    kind: 'sdlc_next_action_projection',
    nextActionBasisKind: 'post_retry',
    selectedActionRef: 'construction-action://odd-sdlc/t164/design/retry',
    nextGraphVectorRef: 'derive_design_surface',
    gapPressureRefs: ['pressure://odd-sdlc/t164/design/missing-proof'],
  });

  const projection = loadSidecarProcessProjection(root);
  const overlay = projection.leafOverlays.find((entry) => entry.leafName === 'derive_design_surface');
  assert.ok(overlay, 'leaf overlay should be projected');
  assert.equal(overlay.latestStatus, 'fd_postflight_passed');
  assert.equal(overlay.edgeAssurance.carrierState, 'complete');
  assert.equal(overlay.edgeAssurance.closureDisposition, 'retry');
  assert.equal(overlay.edgeAssurance.closeReady, false);
  assert.equal(overlay.edgeAssurance.edgeAssuranceContractRef, 'edge-assurance-contract://odd-sdlc/derive_design_surface');
  assert.equal(overlay.edgeAssurance.edgeGainRef, 'edge-gain://odd-sdlc/t164/design');
  assert.deepEqual(overlay.edgeAssurance.edgeResidualPressureRefs, ['pressure://odd-sdlc/t164/design/missing-proof']);
  assert.equal(overlay.edgeAssurance.counts.expected, 2);
  assert.equal(overlay.edgeAssurance.counts.fulfilled, 1);
  assert.equal(overlay.edgeAssurance.targetCertificationPassed, false);
  assert.ok(
    overlay.edgeAssurance.diagnostics.includes('postflight_success_not_metric_authority'),
    'postflight success must remain separate from edge closure',
  );
});

test('T-164 artifact presence and worker percent complete do not close Sidecar edge assurance', () => {
  const root = installedTempWorkspace();
  const opRunPath = writeOpRun(
    root,
    '20260514T020000Z_pid164',
    'derive_component_code_surface',
    tracedResult({ sessionId: 'artifact-only-fixture' }),
    {
      postflight: true,
      manifest: {
        vectorIndex: 8,
        targetAssetType: 'component_code_surface',
      },
    },
  );
  writeJsonFile(join(opRunPath, 'product_materialization_manifest.json'), {
    kind: 'sdlc_product_materialization_manifest',
    files: [{ relativePath: 'src/main.rs', role: 'source' }],
  });
  writeJsonFile(join(opRunPath, 'worker_result_report.json'), {
    kind: 'odd_sdlc.worker_result_report',
    workerPercentComplete: 100,
    summary: 'worker claimed complete',
  });

  const projection = loadSidecarProcessProjection(root);
  const overlay = projection.leafOverlays.find((entry) => entry.leafName === 'derive_component_code_surface');
  assert.ok(overlay, 'leaf overlay should be projected from the op-run manifest');
  assert.equal(overlay.latestStatus, 'fd_postflight_passed');
  assert.equal(overlay.edgeAssurance.carrierState, 'absent');
  assert.equal(overlay.edgeAssurance.closeReady, false);
  assert.equal(overlay.edgeAssurance.closureDisposition, null);
  assert.ok(overlay.edgeAssurance.diagnostics.includes('edge_fulfillment_ledger_missing'));
  assert.ok(overlay.edgeAssurance.diagnostics.includes('edge_closure_decision_missing'));
  assert.ok(overlay.edgeAssurance.diagnostics.includes('artifact_presence_without_edge_closure_carrier'));
  assert.ok(overlay.edgeAssurance.diagnostics.includes('worker_percent_complete_not_metric_authority'));
});

test('query-domain traversal overlays project as Sidecar graph overlays', () => {
  const root = installedTempWorkspace();
  installFakeOddSdlcCli(root, {
    kind: 'sdlc_query_domain_projection',
    contractName: SIDECAR_PROCESS_CONTRACT_NAME,
    contractVersion: SIDECAR_PROCESS_CONTRACT_VERSION,
    traversalOverlays: {
      kind: 'sdlc_traversal_overlay_catalog',
      overlays: [
        {
          kind: 'sdlc_traversal_overlay',
          overlayRef: 'overlay://odd-sdlc/lite-design-module-implementation',
          name: 'lite_design_module_implementation',
          intent: 'fixture traversal overlay',
          graphFunctionRefs: [
            'lite_design_module_implementation',
            'derive_lite_component_code_surface',
          ],
          graphVectorRefs: ['derive_lite_component_code_surface'],
          publicStartTargets: ['lite_design_module_implementation'],
          defaultStartTarget: 'lite_design_module_implementation',
          termination: {
            terminalAssetTypes: ['component_code_surface'],
            terminalGraphFunctionRefs: ['derive_lite_component_code_surface'],
            lawfulStopDispositions: ['overlay_segment_complete', 'blocked'],
            nextEligibleOverlayRefs: ['overlay://odd-sdlc/current-full-traversal'],
          },
          predecessorOverlayRefs: ['overlay://odd-sdlc/solution-architecture'],
          assetTemplates: [
            {
              kind: 'sdlc_overlay_asset_template',
              assetType: 'component_code_surface',
              defaultPath: 'build_tenants/hello_world_javascript/src/hello.js',
              producerGraphFunctionRef: 'derive_lite_component_code_surface',
              terminalRole: 'terminal_asset',
              templateRef: 'overlay://odd-sdlc/lite-design-module-implementation/asset-template/component_code_surface',
            },
          ],
        },
      ],
    },
  });

  const projection = loadSidecarProcessProjection(root);
  assert.equal(projection.supported, true);
  assert.equal(projection.traversalOverlays.length, 1);
  const overlay = projection.traversalOverlays[0];
  assert.equal(overlay.kind, 'sidecar_traversal_overlay');
  assert.equal(overlay.name, 'lite_design_module_implementation');
  assert.deepEqual(overlay.terminalAssetTypes, ['component_code_surface']);
  assert.deepEqual(overlay.nextEligibleOverlayRefs, ['overlay://odd-sdlc/current-full-traversal']);
  assert.equal(overlay.assetTemplates[0].kind, 'sidecar_overlay_asset_template');
  assert.equal(overlay.assetTemplates[0].assetType, 'component_code_surface');
});
