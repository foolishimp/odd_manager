// T-026 + T-022 — UX_METHOD §8A Msg-replay proof for the sidecar Process
// Navigator extensions: variant selection, leaf focus selection, and the
// admission of the extended SidecarProcessProjection envelope (catalog
// dimension + per-leaf overlay + traced evidence).
//
// No DOM. No network. No filesystem reads beyond loading the transpiled
// state module. The reducer is replayed against fixture inputs only.
//
// Proves:
//   - process/select-variant reduces to ui.activeProcessFlowVariant
//   - process/select-leaf reduces to ui.activeLeafName
//   - load/done with a projection carrying catalog + leafOverlays carries
//     those fields through to state.process without mutation or memoization
//   - the typed shape survives the round-trip cleanly

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const stateModulePath = resolve(here, '../../src/features/sidecar/sidecar-state.ts');

async function loadStateModule() {
  const source = readFileSync(stateModulePath, 'utf-8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const encoded = Buffer.from(compiled, 'utf-8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function fixtureCatalog() {
  return Object.freeze({
    kind: 'sidecar_process_catalog',
    contractName: 'odd_sdlc.catalog',
    contractVersion: 'ts-v1',
    fetchedAt: '2026-05-04T22:00:00.000Z',
    installRoot: '/fixture/workspace',
    executives: [
      Object.freeze({
        kind: 'sidecar_executive_view',
        name: 'bootstrap_release_self_test',
        intent: 'fixture executive',
        steps: ['derive_intent_surface'],
        outputs: ['release_surface'],
      }),
    ],
    leaves: [
      Object.freeze({
        kind: 'sidecar_leaf_graph_function_view',
        name: 'derive_intent_surface',
        intent: 'fixture leaf',
        inputs: ['input_set'],
        outputs: ['intent_surface'],
        catalog: 'bootstrap',
        transformContractRef: 'transform://odd_sdlc/derive_intent_surface',
        evaluationContractRef: 'evaluation://odd_sdlc/derive_intent_surface',
        traversalModulationStrategy: 'single_vertical_slice',
        proofObligations: ['target_binding'],
        requirementRefs: ['REQ-F-ODDSDLC-013'],
        evaluators: [
          Object.freeze({ name: 'derive_intent_surface_core_fd', regime: 'F_D', binding: 'fd://x' }),
          Object.freeze({ name: 'derive_intent_surface_semantic_fp', regime: 'F_P', binding: 'fp://x' }),
        ],
        operator: Object.freeze({
          name: 'odd_sdlc_typescript_builder',
          regime: 'F_P',
          binding: 'agent://odd_sdlc/typescript-builder',
        }),
      }),
    ],
    library: [],
  });
}

function fixtureTracedEvidence() {
  return Object.freeze({
    kind: 'traced_callout_evidence',
    invocationId: 'sess-fixture-1',
    outcome: Object.freeze({ kind: 'exited', detail: null }),
    executorProfile: 'pty-terminal',
    streamModel: 'terminal-transcript',
    parser: 'claude-stream-json',
    status: 0,
    signal: null,
    timedOut: false,
    inactivityTimedOut: false,
    structuredEventCount: 42,
    apiRetryCount: 0,
    toolCallCount: 7,
    terminalSessionId: 'pty-fixture-1',
    traceArchiveRoot: '/fixture/archive',
    traceArchivePaths: Object.freeze({
      meta: '/fixture/archive/meta.json',
      command: '/fixture/archive/command.json',
      events: '/fixture/archive/events.ndjson',
      stdout: '/fixture/archive/stdout.log',
      stderr: '/fixture/archive/stderr.log',
      finalOutput: '/fixture/archive/final_output.json',
      result: '/fixture/archive/result.json',
      terminalTranscript: '/fixture/archive/terminal.transcript',
    }),
  });
}

function fixtureLeafOverlay() {
  return Object.freeze({
    kind: 'sidecar_leaf_overlay',
    leafName: 'derive_intent_surface',
    opRunId: '20260504T120000Z_pid1',
    invocationCount: 1,
    latestStatus: 'fd_postflight_passed',
    assuranceVector: Object.freeze({
      kind: 'sidecar_assurance_ledger_vector',
      materialization: 'pass',
      semanticConvergence: 'pass',
      obligationCarry: 'pass',
      requirementFulfillment: 'pass',
      ambiguity: 'pass',
      capability: 'pass',
      shallowRealization: 'pass',
    }),
    traceArchiveRoot: '/fixture/archive',
    tracedEvidence: [fixtureTracedEvidence()],
    edgeAssurance: null,
  });
}

function fixtureLiveAnalysis() {
  return Object.freeze({
    kind: 'sidecar_live_analysis_projection',
    sourceKind: 'sdlc_fd_run_analysis',
    version: 1,
    generatedAt: '2026-05-18T12:00:00.000Z',
    readOnly: true,
    telemetry: Object.freeze({
      inspectedRoot: '/fixture/workspace',
      inspectedKind: 'workspace',
      scenarioName: 'fixture-workspace',
      profile: 'generic',
      operatorRunCount: 1,
      graphEdgeSequence: ['derive_intent_surface'],
      sameEdgeRetryCount: 0,
      blockedAttemptCount: 0,
      repairAttemptCount: 0,
      abortedAttemptCount: 0,
      finalClosureDisposition: 'close',
      totalWallClockMs: 1000,
      totalWorkerElapsedMs: 900,
      archiveBytes: Object.freeze({
        totalBytes: 2048,
        promptContextBytes: 300,
        handoffBytes: 200,
        stdoutBytes: 100,
        runtimeEventBytes: 80,
      }),
      productFileCount: 1,
      requirementObligationCount: 2,
      productFileLineageCount: 2,
    }),
    liveness: Object.freeze({
      activeOperatorRunRef: 'file:///fixture/workspace/.ai-workspace/runtime/odd_sdlc/operator-runs/20260518T010000Z_pid1',
      activeOperatorRunPath: '/fixture/workspace/.ai-workspace/runtime/odd_sdlc/operator-runs/20260518T010000Z_pid1',
      activeEdgeRef: 'derive_intent_surface',
      activeGraphVectorRef: 'derive_intent_surface',
      activeTargetAssetType: 'intent_surface',
      workerPid: 123,
      processAlive: false,
      lastEventAtMs: 100,
      lastStdoutAtMs: 120,
      heartbeatAgeMs: null,
      maxNoOutputGapMs: 40,
      archiveGrowthBytesPerMinute: 0,
      productiveSignal: 'completed',
      lastBlockingReason: null,
    }),
    attempts: [
      Object.freeze({
        kind: 'sidecar_live_analysis_attempt',
        attemptOrdinal: 0,
        operatorRunRef: 'file:///fixture/workspace/.ai-workspace/runtime/odd_sdlc/operator-runs/20260518T010000Z_pid1',
        operatorRunPath: '/fixture/workspace/.ai-workspace/runtime/odd_sdlc/operator-runs/20260518T010000Z_pid1',
        graphFunctionName: 'derive_intent_surface',
        graphVectorRef: 'derive_intent_surface',
        targetAssetType: 'intent_surface',
        traversalClass: 'constructive',
        workerElapsedMs: 900,
        edgeWindowElapsedMs: 1000,
        deterministicElapsedMs: 100,
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
        requirementObligationCount: 2,
        productLineageCount: 2,
        promptContextBytes: 300,
        handoffBytes: 200,
        stdoutBytes: 100,
        eventBytes: 80,
        workerStatus: 'worker_invoked',
        detail: Object.freeze({
          kind: 'sidecar_live_analysis_run_detail',
          edgeAssurance: null,
          assurance: Object.freeze({
            kind: 'sidecar_live_analysis_assurance_summary',
            status: 'close_allowed',
            satisfiedDimensions: ['semantic_convergence', 'requirement_fulfillment'],
            missingRequiredDimensions: [],
            gapReasonCount: 0,
            blockingReasonCount: 0,
            ledgers: [
              Object.freeze({
                kind: 'sidecar_live_analysis_assurance_ledger',
                dimension: 'requirement_fulfillment',
                verdict: 'satisfied',
                required: true,
                evidenceRefCount: 2,
                carryForwardObligationRefCount: 0,
                reasonCount: 0,
              }),
            ],
          }),
          runtimeGaps: [],
          diagnostics: [],
          retryForensics: [],
          stageCoverage: [
            Object.freeze({
              kind: 'sidecar_live_analysis_stage_coverage',
              test35StageRef: 'test35://stage/intent',
              expectedEdgeName: 'derive_intent_surface',
              expectedTargetAssetType: 'intent_surface',
              mappedEdgeName: 'derive_intent_surface',
              mappedTargetAssetType: 'intent_surface',
              stageClass: 'constructive',
            }),
          ],
          cliTranscript: Object.freeze({
            kind: 'sidecar_live_analysis_cli_transcript',
            sourceKind: 'terminal_transcript',
            sourcePath: '/fixture/archive/terminal.transcript',
            byteCount: 42,
            lineCount: 2,
            lines: [
              Object.freeze({
                kind: 'sidecar_live_analysis_transcript_line',
                index: 0,
                eventType: 'assistant',
                role: 'assistant',
                label: 'assistant',
                text: 'Tool call: Read',
                tone: 'active',
              }),
              Object.freeze({
                kind: 'sidecar_live_analysis_transcript_line',
                index: 1,
                eventType: 'result',
                role: null,
                label: 'success',
                text: 'completed',
                tone: 'active',
              }),
            ],
          }),
        }),
      }),
    ],
    diagnostics: [],
    runtimeArtifactGapCount: 0,
    retryForensicCount: 0,
    summaryDriftCount: 0,
    evidenceIndex: ['file:///fixture/workspace/.ai-workspace/runtime/odd_sdlc/operator-runs/20260518T010000Z_pid1'],
  });
}

function fixtureProjection() {
  return Object.freeze({
    kind: 'sidecar_process_projection',
    supported: true,
    contractName: 'odd_sdlc.query-domain',
    contractVersion: 'ts-v1',
    runtimeModel: 'abg-native',
    queryModel: 'odd-domain-read-model',
    readOnly: true,
    workspaceRoot: '/fixture/workspace',
    eventLogRelativePath: '.ai-workspace/events/events.jsonl',
    eventCount: 0,
    eventKinds: [],
    views: [],
    records: [],
    maps: [],
    catalog: fixtureCatalog(),
    leafOverlays: [fixtureLeafOverlay()],
    liveAnalysis: fixtureLiveAnalysis(),
  });
}

test('process/select-variant reduces ui.activeProcessFlowVariant deterministically', async () => {
  const module = await loadStateModule();
  const initial = module.INITIAL_SIDECAR_STATE;
  assert.equal(initial.ui.activeProcessFlowVariant, 'v1', 'initial variant defaults to canonical V1');

  const stateV0 = module.updateSidecarState(initial, { type: 'process/select-variant', variant: 'v0' });
  assert.equal(stateV0.ui.activeProcessFlowVariant, 'v0');

  const stateV2 = module.updateSidecarState(stateV0, { type: 'process/select-variant', variant: 'v2' });
  assert.equal(stateV2.ui.activeProcessFlowVariant, 'v2');

  const stateV4 = module.updateSidecarState(stateV2, { type: 'process/select-variant', variant: 'v4' });
  assert.equal(stateV4.ui.activeProcessFlowVariant, 'v4');

  const stateV1 = module.updateSidecarState(stateV4, { type: 'process/select-variant', variant: 'v1' });
  assert.equal(stateV1.ui.activeProcessFlowVariant, 'v1');

  // Other ui fields untouched by variant selection.
  assert.equal(stateV1.ui.activeProcessView, initial.ui.activeProcessView);
  assert.equal(stateV1.ui.activeProcessMap, initial.ui.activeProcessMap);
  assert.equal(stateV1.ui.activeLeafName, initial.ui.activeLeafName);
});

test('process/select-map admits the Live View tab through reducer state only', async () => {
  const module = await loadStateModule();
  const selected = module.updateSidecarState(module.INITIAL_SIDECAR_STATE, {
    type: 'process/select-map',
    map: 'live_view',
  });
  assert.equal(selected.ui.activeProcessMap, 'live_view');
  assert.equal(selected.pendingCommands.length, 0);
});

test('process/set-graph-mode toggles the graph between full and compressed representations', async () => {
  const module = await loadStateModule();
  const initial = module.INITIAL_SIDECAR_STATE;
  assert.equal(initial.ui.activeProcessGraphMode, 'expanded');

  const compressed = module.updateSidecarState(initial, {
    type: 'process/set-graph-mode',
    mode: 'compressed',
  });
  assert.equal(compressed.ui.activeProcessGraphMode, 'compressed');

  const expanded = module.updateSidecarState(compressed, {
    type: 'process/set-graph-mode',
    mode: 'expanded',
  });
  assert.equal(expanded.ui.activeProcessGraphMode, 'expanded');
  assert.equal(expanded.pendingCommands.length, 0);
});

test('process/select-leaf reduces ui.activeLeafName, including null clear', async () => {
  const module = await loadStateModule();
  const initial = module.INITIAL_SIDECAR_STATE;
  assert.equal(initial.ui.activeLeafName, null, 'initial leaf focus is null');

  const focused = module.updateSidecarState(initial, {
    type: 'process/select-leaf',
    leafName: 'derive_intent_surface',
  });
  assert.equal(focused.ui.activeLeafName, 'derive_intent_surface');

  const cleared = module.updateSidecarState(focused, { type: 'process/select-leaf', leafName: null });
  assert.equal(cleared.ui.activeLeafName, null);
});

test('load/done admits SidecarProcessProjection with catalog + leafOverlays + tracedEvidence into state', async () => {
  const module = await loadStateModule();
  const requested = module.updateSidecarState(module.INITIAL_SIDECAR_STATE, {
    type: 'load/request',
    projectRoot: '/fixture/workspace',
    reason: 'initial',
  });
  const loaded = module.updateSidecarState(requested, {
    type: 'load/done',
    projectRoot: '/fixture/workspace',
    payload: {
      context: {
        project: { id: 'fixture', root: '/fixture/workspace', odd_type: 'odd_sdlc' },
        workspace: { id: 'react_vite', profile: 'odd_sdlc' },
        session: null,
      },
      process: fixtureProjection(),
    },
  });

  assert.equal(loaded.process.kind, 'sidecar_process_projection');
  assert.equal(loaded.process.contractVersion, 'ts-v1');
  assert.equal(loaded.process.supported, true);
  assert.equal(loaded.process.catalog.executives.length, 1);
  assert.equal(loaded.process.catalog.leaves.length, 1);
  assert.equal(loaded.process.catalog.leaves[0].catalog, 'bootstrap');
  assert.equal(loaded.process.leafOverlays.length, 1);
  assert.equal(loaded.process.liveAnalysis.kind, 'sidecar_live_analysis_projection');
  assert.equal(loaded.process.liveAnalysis.telemetry.operatorRunCount, 1);
  assert.equal(loaded.process.liveAnalysis.attempts[0].graphFunctionName, 'derive_intent_surface');
  const overlay = loaded.process.leafOverlays[0];
  assert.equal(overlay.leafName, 'derive_intent_surface');
  assert.equal(overlay.latestStatus, 'fd_postflight_passed');
  assert.equal(overlay.tracedEvidence.length, 1);
  assert.equal(overlay.tracedEvidence[0].outcome.kind, 'exited');
  assert.equal(overlay.tracedEvidence[0].executorProfile, 'pty-terminal');
  assert.equal(overlay.tracedEvidence[0].toolCallCount, 7);
  // 7-dim assurance vector survives intact.
  assert.equal(overlay.assuranceVector.materialization, 'pass');
  assert.equal(overlay.assuranceVector.shallowRealization, 'pass');
});

test('failed load clears stale process projection and process focus', async () => {
  const module = await loadStateModule();
  const loaded = module.updateSidecarState(
    module.updateSidecarState(module.INITIAL_SIDECAR_STATE, {
      type: 'load/request',
      projectRoot: '/fixture/workspace',
      reason: 'initial',
    }),
    {
      type: 'load/done',
      projectRoot: '/fixture/workspace',
      payload: {
        context: {
          project: { id: 'fixture', root: '/fixture/workspace', odd_type: 'odd_sdlc' },
          workspace: { id: 'react_vite', profile: 'odd_sdlc' },
          session: null,
        },
        process: fixtureProjection(),
      },
    },
  );
  const focused = module.updateSidecarState(
    module.updateSidecarState(loaded, { type: 'process/select-record', id: 'record-1' }),
    { type: 'process/select-leaf', leafName: 'derive_intent_surface' },
  );

  const failed = module.updateSidecarState(
    module.updateSidecarState(focused, {
      type: 'load/request',
      projectRoot: '/fixture/workspace',
      reason: 'action_completed',
    }),
    {
      type: 'load/done',
      projectRoot: '/fixture/workspace',
      payload: {
        lastAction: { ok: false, error: 'load failed: process projection unavailable' },
      },
    },
  );

  assert.equal(failed.loading, false);
  assert.equal(failed.process, null);
  assert.equal(failed.ui.activeProcessRecordId, null);
  assert.equal(failed.ui.activeLeafName, null);
  assert.equal(failed.lastAction.ok, false);
  assert.match(failed.lastAction.error, /process projection unavailable/);
});

test('Msg-replay sequence: load → select-variant → select-leaf produces deterministic final state', async () => {
  const module = await loadStateModule();
  const result = module.replaySidecarMessages(module.INITIAL_SIDECAR_STATE, [
    { type: 'load/request', projectRoot: '/fixture/workspace', reason: 'initial' },
    {
      type: 'load/done',
      projectRoot: '/fixture/workspace',
      payload: {
        context: {
          project: { id: 'fixture', root: '/fixture/workspace', odd_type: 'odd_sdlc' },
          workspace: { id: 'react_vite', profile: 'odd_sdlc' },
          session: null,
        },
        process: fixtureProjection(),
      },
    },
    { type: 'process/select-variant', variant: 'v1' },
    { type: 'process/select-leaf', leafName: 'derive_intent_surface' },
  ]);

  assert.equal(result.state.process.kind, 'sidecar_process_projection');
  assert.equal(result.state.process.catalog.leaves[0].name, 'derive_intent_surface');
  assert.equal(result.state.ui.activeProcessFlowVariant, 'v1');
  assert.equal(result.state.ui.activeLeafName, 'derive_intent_surface');
  // Replay closes deterministically: identical inputs yield identical state.
  const replayAgain = module.replaySidecarMessages(module.INITIAL_SIDECAR_STATE, [
    { type: 'load/request', projectRoot: '/fixture/workspace', reason: 'initial' },
    {
      type: 'load/done',
      projectRoot: '/fixture/workspace',
      payload: {
        context: {
          project: { id: 'fixture', root: '/fixture/workspace', odd_type: 'odd_sdlc' },
          workspace: { id: 'react_vite', profile: 'odd_sdlc' },
          session: null,
        },
        process: fixtureProjection(),
      },
    },
    { type: 'process/select-variant', variant: 'v1' },
    { type: 'process/select-leaf', leafName: 'derive_intent_surface' },
  ]);
  assert.equal(
    replayAgain.state.ui.activeProcessFlowVariant,
    result.state.ui.activeProcessFlowVariant,
  );
  assert.equal(replayAgain.state.ui.activeLeafName, result.state.ui.activeLeafName);
  assert.equal(replayAgain.state.process.catalog.leaves.length, result.state.process.catalog.leaves.length);
});
