import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

function installFakeOddSdlcCli(root, queryPayload, catalogPayload = null) {
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
      "if (command === 'query-domain') { console.log(JSON.stringify({ payload: queryPayload })); process.exit(0); }",
      "if (command === 'catalog') { console.log(JSON.stringify({ payload: catalogPayload })); process.exit(0); }",
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
  writeFileSync(join(opRunPath, 'handoff_manifest.json'), JSON.stringify({ edgeName: leafName }));
  writeFileSync(join(opRunPath, 'worker_process_events.jsonl'), '');
  if (options.postflight) writeFileSync(join(opRunPath, 'postflight.json'), JSON.stringify({ ok: true }));
  if (options.fpEvaluate) writeFileSync(join(opRunPath, 'fp_evaluate_result.json'), JSON.stringify({ ok: true }));
  writeFileSync(join(tracePath, 'result.json'), JSON.stringify(result));
  const mtime = new Date(options.mtime ?? Date.now());
  utimesSync(opRunPath, mtime, mtime);
  return opRunPath;
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
