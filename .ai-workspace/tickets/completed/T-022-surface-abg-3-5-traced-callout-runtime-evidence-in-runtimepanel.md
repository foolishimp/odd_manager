---
id: T-022
title: Surface ABG 3.5.0-rc.1 traced call-out runtime evidence in the sidecar Process Navigator (per-leaf overlay extension to SidecarProcessProjection)
type: feature
ticket_category: ui_substrate_alignment
status: completed
review_status: closed
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Extend the existing live SidecarProcessProjection carrier with a typed per-leaf TracedCalloutEvidence overlay, and extend the sidecar Process Navigator (ProcessNavigatorPanel) to render typed outcome, executor profile, parser observations, retry/tool counts, terminal session id, and trace archive references from the ABG 3.5.0-rc.1 universal traced call-out substrate (T-108 / T-109 / T-110 / T-111). The legacy `RuntimePanel.tsx` workspace-route surface is not the target; it consumes the older ManagerWorld projection and is on the retirement path.
change_class: design_reframe
re_entry_point: design
affected_boundary: SidecarProcessProjection contract under `src/contracts/process.ts` (extension), sidecar process projection builder under `src/server/sidecar-process-projection.mjs` (per-leaf TracedCalloutEvidence admission), sidecar state under `src/features/sidecar/sidecar-state.ts`, sidecar render under `src/features/sidecar/SidecarPanel.tsx` (ProcessNavigatorPanel + per-leaf workbench)
priority: high
triaged_at: 2026-05-04
created_at: 2026-05-04
updated_at: 2026-05-05
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
depends_on:
  - abiogenesis T-108 traced process substrate (completed)
  - abiogenesis T-109 universal traced agent call-out interface (completed)
  - abiogenesis T-110 odd_sdlc migration to ABG 3.5.0-rc.1 traced callout substrate (completed)
  - abiogenesis T-111 literal PTY/xterm executor (completed)
intake_source: Mid-implementation discovery — the sidecar's ProcessNavigatorPanel already consumes `SidecarProcessProjection` live via `/api/sidecar/process` (server-side `loadSidecarProcessProjection` in `sidecar-process-projection.mjs` spawns the installed `odd-sdlc-ts query-domain --workspace <root>` and validates `contractVersion === 'ts-v1'`, returning `unsupportedProcessProjection` on contract mismatch). REQ-OM-LNS-003's live-projection invariant is largely realized in the sidecar. What is missing is the per-leaf overlay carrying the ABG 3.5 traced call-out evidence (`TracedProcessOutcome`, executor profile, parser observations, trace archive ref). The legacy `RuntimePanel.tsx` is a separate workspace-route surface driven by ManagerWorld and is not in scope for this ticket.
target_truth: The sidecar's ProcessNavigatorPanel and per-leaf workbench render, per supervised actor invocation, the typed `outcome.kind` from `TracedProcessOutcome`, the `executorProfile`, the `streamModel`, the `apiRetryCount` and `toolCallCount` and `structuredEventCount`, the `terminalSessionId` (when pty-terminal), and a navigable reference to the per-call trace archive shape (`meta.json`, `command.json`, `events.ndjson`, `result.json`, `terminal.transcript`, `screenlog.0`). The data is admitted through the existing SidecarProcessProjection carrier (extended with a typed `TracedCalloutEvidence` field on per-leaf overlay records). Rendering is pure over reducer state. No React component reads the trace archive directly from disk. Live source: `.ai-workspace/runtime/odd_sdlc/operator-runs/<oprun>/.../result.json` per the t109 reference run shape.
superseded_truth: The sidecar's ProcessNavigatorPanel renders process records from the live SidecarProcessProjection but has no typed per-leaf overlay carrying the ABG 3.5 traced call-out evidence. The legacy `RuntimePanel.tsx` workspace-route surface — outside the scope of this ticket — renders ManagerWorld run aggregates only and is on the retirement path.
closure_law: This ticket closes only when the SidecarProcessProjection carrier is extended with a typed `TracedCalloutEvidence` per-leaf overlay reading live workspace state via the existing `odd-sdlc-ts query-domain ts-v1` projection path (no memoized or snapshotted state, Python projection layer not extended), the sidecar reducer admits the new field as typed projection state, the sidecar ProcessNavigatorPanel and per-leaf workbench render the evidence, and a Msg-replay proof exercises a fixture trace archive end-to-end through reducer + Cmd to final rendered state.
evaluation_criteria:
  - typed `TracedCalloutEvidence` shape published as an addition to `src/contracts/process.ts`
  - sidecar process projection builder reads per-operator-run `result.json` and admits one TracedCalloutEvidence per supervised actor invocation, attaching it to the per-leaf overlay carried by SidecarProcessProjection
  - sidecar reducer carries the new field as typed state
  - sidecar ProcessNavigatorPanel renders outcome, executor profile, stream model, retry/tool counts, terminal session id, trace archive ref per leaf invocation
  - Msg-replay proof under `runtime/tests/` covers initial empty state through fixture-driven projection admission to final rendered state
  - PTY-terminal runs surface the screenlog.0 reference as a click-through asset link
  - non-claude generic-text runs render with their applicable subset of fields without UI errors
proof_surface:
  - typed contract addition in `src/contracts/process.ts`
  - sidecar process projection extension in `src/server/sidecar-process-projection.mjs`
  - sidecar state extension in `src/features/sidecar/sidecar-state.ts`
  - sidecar render update in `src/features/sidecar/SidecarPanel.tsx` (ProcessNavigatorPanel + per-leaf workbench)
  - Msg-replay proof fixture under `runtime/tests/test_sidecar_traced_callout_msg_replay.mjs`
  - playwright e2e walk that opens the sidecar Process Navigator against a workspace with admitted TracedCalloutEvidence
non_closure_conditions:
  - the sidecar render reads the trace archive directly from disk in a useEffect
  - new fields land in the sidecar state without flowing through SidecarProcessProjection
  - Msg-replay proof omits the projection admission step
  - outcome rendering uses string match on text instead of `outcome.kind` discriminator
  - PTY-terminal terminalSessionId rendered as opaque text without a navigable reference
  - non-claude generic-text runs rendered with claude-only fields shown as null without explicit absent-state handling
  - extension hidden inside the sidecar render without lifting the typed shape into the contract surface
  - the projection builder returns a memoized, snapshotted, or build-time-cached overlay instead of reading the live workspace state at admission time
  - Python projection layers (`runtime/odd_manager_world.py`, `runtime/manager_world.py`, etc.) are extended in parallel with the TypeScript carrier — Python tenant is retired and the sidecar is TypeScript-only
  - freshness model not declared (pull-on-demand vs subscription) in the projection contract
  - implementation builds on the legacy `src/features/runtime/RuntimePanel.tsx` instead of the sidecar; that surface is retiring
---

# T-022: Surface ABG 3.5.0-rc.1 Traced Call-out Runtime Evidence In RuntimePanel

## Completion Update — 2026-05-05 Codex

Closed against the revised sidecar target, not the legacy RuntimePanel.

Implemented and verified:

- `TracedCalloutEvidence` is published in `src/contracts/process.ts` with runtime type guards.
- `src/server/sidecar-process-projection.mjs` admits traced call-out evidence from live op-run `result.json` archives into `SidecarLeafOverlay.tracedEvidence`.
- Latest overlay status now derives from the latest op-run only, so stale failed evidence cannot poison a later successful invocation.
- `traceArchiveRoot` now points at the latest admitted invocation, with click-through exposed in the leaf workbench.
- PTY terminal transcript and result paths are openable through the surface viewer.
- Generic/local-spawn evidence renders without terminal-only fields.

Proof:

- `node --test runtime/tests/test_sidecar_process_projection.mjs runtime/tests/test_sidecar_process_navigator_msg_replay.mjs` — 11 pass.
- `npm run test:runtime:node` — 137 pass.
- `npm run build` — pass.
- `npx playwright test tests/e2e/odd-manager-process-navigator.spec.ts` — 4 pass.

## STDO Triage

### First Missing Layer

Design.

The substrate publishes typed runtime evidence (`TracedProcessResult`,
`TracedProcessOutcome`, `actor_process_*` events, trace archive shape). The
UI surface that operators read first for runtime health does not yet have a
typed AssetSurface for any of it. The missing layer is the AssetSurface
contract that lifts substrate observation into a UI-shaped read model.

### Lawful Change Class

`design_reframe`. New typed AssetSurface contract plus rendering surface.
Existing `world.runtime` aggregates remain; this widens the carrier without
breaking consumers.

## Carrier Boundary (UX_METHOD §3A)

Every new product-truth Msg in this ticket maps to a typed AssetSurface
action. No React component reads the trace archive directly. The carrier
chain is:

```
ABG event stream + per-call trace archive
  -> projection builder (runtime/server)
    -> AssetSurface action: admit TracedCalloutEvidence
      -> ManagerWorld.runtime.runs[*].traced_callout_evidence
        -> RuntimePanel render
```

## Carrier Shape

```ts
type TracedProcessOutcomeKind =
  | "exited"
  | "signaled"
  | "hard_timeout"
  | "inactivity_timeout"
  | "executor_unavailable"
  | "launch_failed"
  | "process_error"
  | "lost_terminal";

type TracedCalloutEvidence = {
  kind: "traced_callout_evidence";
  invocation_id: string;
  outcome: { kind: TracedProcessOutcomeKind; detail: string | null };
  executor_profile: "local-spawn" | "pty-terminal";
  stream_model: "stdio" | "terminal-transcript";
  parser: "generic-text" | "claude-stream-json";
  status: number | null;
  signal: string | null;
  timed_out: boolean;
  inactivity_timed_out: boolean;
  structured_event_count: number;
  api_retry_count: number;
  tool_call_count: number;
  terminal_session_id: string | null;
  trace_archive_root: string;
  trace_archive_paths: {
    meta: string;
    command: string;
    events: string;
    stdout: string;
    stderr: string;
    final_output: string;
    result: string;
    terminal_transcript: string | null;
  };
};
```

## Implementation Slices

1. Author the `TracedCalloutEvidence` carrier in `src/contracts/runtime.ts`
   (or the appropriate existing contracts module) with runtime validation
   per UX_METHOD §10.
2. Extend the runtime AssetSurface server (`src/server/*-asset-surface-service.mjs`)
   with an action that reads per-operator-run `result.json` and admits one
   TracedCalloutEvidence per supervised actor invocation.
3. Extend `ManagerWorld.runtime.runs` items in `src/lib/types.ts` with an
   optional `traced_callout_evidence: TracedCalloutEvidence | null` field.
4. Extend the Sidecar reducer to handle the AssetSurface admission Msg.
5. Update RuntimePanel rendering to surface outcome, executor profile,
   stream model, retry/tool counts, terminal session id, and trace archive
   click-through.
6. Author Msg-replay proof at
   `runtime/tests/test_runtime_panel_traced_callout_msg_replay.mjs`
   covering initial empty state, AssetSurface admission, final rendered
   state, with fixtures for both PTY-terminal and local-spawn runs and for
   claude-stream-json + generic-text parsers.
7. Add a playwright walk that opens the runtime tab against a workspace
   carrying admitted TracedCalloutEvidence.

## Closure Criteria

T-022 closes only when:

- typed contract published, ManagerWorld type extended, AssetSurface
  admission wired
- RuntimePanel renders all fields named in `Carrier Shape`
- Msg-replay proof passes for both executor profiles and both parsers
- e2e walk renders without console errors against a workspace with admitted
  evidence
- non-claude / generic-text runs render with the correct subset of fields
  using explicit absent-state styling, not silent nulls

## Non-Closure Statement

T-022 is not closed by reading trace archive paths directly from React.
It closes only when traced call-out observation enters UI state through an
admitted AssetSurface carrier and the Msg-replay proof exercises that
admission to final rendered state.
