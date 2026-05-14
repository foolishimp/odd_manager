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
