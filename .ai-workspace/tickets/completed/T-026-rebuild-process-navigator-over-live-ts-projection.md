---
id: T-026
title: Extend SidecarProcessProjection with catalog + per-leaf overlay and ship variant portfolio in the sidecar Process Navigator
type: feature
ticket_category: ui_substrate_alignment
status: completed
review_status: closed
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Mid-implementation discovery: the sidecar's ProcessNavigatorPanel already consumes `SidecarProcessProjection` live via `/api/sidecar/process` (server-side `loadSidecarProcessProjection` invokes `odd-sdlc-ts query-domain --workspace <root>` and validates `contractVersion === 'ts-v1'`, returning the unsupported-format state on contract mismatch). REQ-OM-LNS-003's live-projection invariant, TS-only posture, three views, three maps, and explicit Python rejection are largely already realized in the sidecar. This ticket therefore EXTENDS the existing carrier (it does not replace it) with the missing dimensions: catalog backbone (executives, leaves, library functions, triage lane), per-leaf overlay (op-run status, 7-dim assurance vector), and ships a §13A scaffold-exemption variant portfolio over the process flow map. The legacy `ProcessWorkspace.tsx` workspace-route surface is not the target; it is a separate ManagerWorld-driven surface on the retirement path.
change_class: design_reframe
re_entry_point: design
affected_boundary: SidecarProcessProjection contract under `src/contracts/process.ts` (extension), sidecar process projection builder under `src/server/sidecar-process-projection.mjs` (catalog + overlay admission via `odd-sdlc-ts catalog`), sidecar state under `src/features/sidecar/sidecar-state.ts`, sidecar render under `src/features/sidecar/SidecarPanel.tsx` (ProcessNavigatorPanel + per-leaf workbench + variant tab strip on process flow map)
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
  - abiogenesis 3.5.0-rc.1 substrate (released)
  - odd_sdlc TypeScript tenant publishing `odd_sdlc.query-domain ts-v1`
intake_source: ProcessWorkspace.tsx encodes a hardcoded stage list (`bootstrap | design | scenarios | build | test | release | …`) that does not match the TS tenant's published traversal. The TS tenant publishes 30 BOOTSTRAP leaves + 7 OPERATIONAL leaves + 6 TRIAGE leaves + 11 reusable library functions + 2 executives (`bootstrap_release_self_test`, `release_operational_cycle`). REQ-OM-LNS-003 obligates exactly three operator views (Active Work, Blocked / Waiting, Ready for Handoff), three graph-first maps under those views (process flow, builder governance, runtime evidence), the TypeScript query contract `odd_sdlc.query-domain ts-v1`, explicit rejection of legacy Python SDLC shapes, and projection from ABG/odd_sdlc TypeScript truth. The current implementation does not realize this requirement.
target_truth: The sidecar Process Navigator renders the live published TS Module catalog (executives + leaves + library + triage) plus per-leaf overlay (op-run status + 7-dim assurance vector) projected through the existing SidecarProcessProjection carrier (extended in this ticket). Three operator views and three graph-first maps remain in place. The process flow map ships variants V0 (existing baseline) + V1 (three-lane structural) + V2 (asset-DAG) + V4 (assurance-matrix), each non-baseline variant under §13A scaffold-exemption metadata, selectable from a tab strip on the map header. The carrier rejects Python projection shapes and unrecognised contract versions with the existing typed unsupported-format state. No render path reads catalog data from disk; no projection layer caches catalog state across navigation; the navigator renders only what the live install attests at admission time.
superseded_truth: SidecarProcessProjection carries records, views, and maps but no catalog dimension (executives / leaves / library / triage) and no per-leaf overlay (op-run status / assurance vector). The process flow map renders one fixed layout via `ProcessGraphMap` without variant exploration.
closure_law: This ticket closes only when (a) SidecarProcessProjection is extended with typed catalog (executives + leaves + library + triage) and per-leaf overlay (op-run status + 7-dim assurance vector) fields, populated from `odd-sdlc-ts catalog` and the active workspace's `.ai-workspace/runtime/odd_sdlc/operator-runs/<oprun>/` traces with declared pull-on-demand freshness; (b) the sidecar reducer admits the new fields as typed projection state; (c) ProcessNavigatorPanel renders the catalog backbone and per-leaf overlay alongside the existing three views and three maps; (d) the process flow map ships V0 / V1 / V2 / V4 variants with §13A scaffold-exemption metadata on V1/V2/V4; (e) §8A Msg-replay proofs pass for the projection extension and each shipped variant; (f) sprint close review classifies each variant `accepted | local_paydown | design_reframe | requirement_reprice | product_reprice | remove` and either promotes one variant to canonical or returns the wave to design.
evaluation_criteria:
  - typed `LiveModuleProjection` carrier published in `src/contracts/` with runtime validation per UX_METHOD §10
  - typed `LiveOpRunProjection` carrier published in `src/contracts/` with runtime validation per UX_METHOD §10
  - both carriers fetch via `odd_sdlc.query-domain ts-v1`; rejection of unrecognised contract versions surfaces as a typed `UnsupportedFormatState`
  - both carriers declare pull-on-demand freshness — no memoization across navigation, no snapshot files, no cached projection state
  - Python projection layers (`runtime/odd_manager_world.py`, `runtime/manager_world.py`, etc.) are not extended; tenancy is TypeScript-only
  - ProcessWorkspace renders exactly three operator views: `Active Work`, `Blocked / Waiting`, `Ready for Handoff`
  - ProcessWorkspace renders three graph-first maps under those views: process flow map, builder governance map, runtime evidence map
  - process flow map ships variants V0 / V1 / V2 / V4 selectable from a tab strip; V0 is the existing rendering, V1/V2/V4 carry §13A scaffold-exemption labels
  - §8A Msg-replay proofs land at `runtime/tests/test_live_module_projection_msg_replay.mjs`, `runtime/tests/test_live_op_run_projection_msg_replay.mjs`, and per-variant under `runtime/tests/test_process_flow_map_<variant>_msg_replay.mjs`
  - playwright walk opens the navigator against a workspace with admitted live projections and exercises view × map × variant switching
proof_surface:
  - typed contract additions under `src/contracts/`
  - AssetSurface service extensions under `src/server/`
  - ManagerWorld type extension under `src/lib/types.ts`
  - ProcessWorkspace structural rebuild under `src/features/process/`
  - per-variant process flow map renderers under `src/features/process/variants/`
  - Msg-replay proofs under `runtime/tests/`
  - playwright walk under `tests/e2e/`
non_closure_conditions:
  - any carrier returns a memoized, snapshotted, or build-time-cached projection instead of reading the live workspace state at admission time
  - any projection accepts legacy Python SDLC shapes (`runtime/odd_manager_world.py` outputs or successors) instead of rejecting them with typed `UnsupportedFormatState`
  - Python projection layer is extended in parallel with the TypeScript carriers
  - ProcessWorkspace renders fewer than three operator views or more than three graph-first maps
  - process-flow-map variants ship without §13A scaffold-exemption metadata (visible label, retirement condition, owning ticket, non-closure condition, superseding-surface declaration)
  - any variant carries product-truth-changing logic that is not present in the others (per §13A all variants share the same admitted carriers and Msg algebra; only View differs)
  - sprint close claims completion without classifying every variant under the §13B vocabulary
  - traversal, continuation, edge-selection, or gap-closure decision logic lives in the navigator (per REQ-OM-LNS-003: the substrate owns those; the navigator is read-only)
  - the navigator's `Cmd` algebra includes write paths that bypass an admitted AssetSurface action registry
---

# T-026: Rebuild Process Navigator Over Live odd_sdlc TypeScript Projection Under Variant Portfolio

## Completion Update — 2026-05-05 Codex

Closed.

Implemented and verified:

- `SidecarProcessProjection` carries the live TS catalog and per-leaf overlays.
- The projection remains pull-on-demand from the installed TypeScript tenant and op-run archives; no Python projection layer was extended.
- Load failure handling clears stale process projection and process focus.
- The sidecar renders catalog, leaf workbench, assurance grid, traced evidence, and edge glyph overlays.
- V1 is promoted to canonical default (`activeProcessFlowVariant: v1`).

Variant close classification:

- V0 baseline graph: `local_paydown` — retained as a comparison/paydown surface.
- V1 three-lane structural: `accepted` — promoted to canonical process-flow default.
- V2 asset-DAG: `design_reframe` — retained as a scaffold for later topology design.
- V4 assurance matrix: `accepted` — retained as a diagnostic map variant, not the canonical flow map.

Live t109 verification:

- catalog: 2 executives, 44 leaves, 11 library functions
- overlays: 14
- traced admissions: 19
- decorated edges: 63/175

Proof:

- `node --test runtime/tests/test_sidecar_process_projection.mjs runtime/tests/test_sidecar_process_navigator_msg_replay.mjs` — 11 pass.
- `npm run test:runtime:node` — 137 pass.
- `npm run build` — pass.
- `npx playwright test tests/e2e/odd-manager-process-navigator.spec.ts` — 4 pass.

## STDO Triage

### First Missing Layer

Design.

REQ-OM-LNS-003 already obligates the live TypeScript projection, the
three-view × three-map structure, and explicit Python rejection. Product
and Requirements are stable. The realization in `ProcessWorkspace.tsx`
encodes a hardcoded stage list that does not match the published TS
tenant catalog. The missing layer is the design pathway from the live
Module catalog through admitted AssetSurface carriers into the navigator
view tree.

### Lawful Change Class

`design_reframe`. New typed projection carriers and a structural rebuild
of the navigator. No requirement reprice, no product reprice — REQ-OM-LNS-003
is the live obligation this ticket realizes.

### Inside-Out Position

Source-carrier ticket. T-026 publishes `LiveModuleProjection` and
`LiveOpRunProjection`. Downstream consumers (T-024 per-edge glyph, T-025
audit) bind to these carrier shapes, so T-026 must close before they
land their consumption.

T-026 lands in parallel with T-022 (independent carrier:
`TracedCalloutEvidence` per supervised actor invocation). The two
carriers compose at runtime: `LiveOpRunProjection` provides per-leaf
overlay shape; `TracedCalloutEvidence` provides per-call evidence inside
each leaf invocation.

## Carrier Boundary (UX_METHOD §3A)

Every product-truth Msg in this ticket maps to one admitted AssetSurface
action. No render path reads from disk. No projection layer holds
cross-navigation state.

```
installed odd_sdlc TS tenant (workspace://node_modules/.bin/odd-sdlc-ts)
  -> AssetSurface action: admit LiveModuleProjection
    -> ManagerWorld.process.module_projection
      -> ProcessWorkspace render (three views × three maps)

.ai-workspace/events/events.jsonl  +  .ai-workspace/runtime/odd_sdlc/operator-runs/<oprun>/
  -> AssetSurface action: admit LiveOpRunProjection
    -> ManagerWorld.process.op_run_overlay
      -> ProcessWorkspace render (per-leaf status overlay)
```

The navigator does not choose traversal, continuation, next edge, or
gap closure (REQ-OM-LNS-003). It is a read-only projection of admitted
substrate truth.

## Carrier Shape

```ts
type SdlcQueryContractVersion = "ts-v1";

type UnsupportedFormatState = {
  kind: "unsupported_format_state";
  observed_contract: string | null;
  reason: "legacy_python_shape" | "unknown_version" | "missing";
};

type LeafGraphFunctionView = {
  kind: "leaf_graph_function_view";
  name: string;
  intent: string;
  inputs: ReadonlyArray<string>;
  outputs: ReadonlyArray<string>;
  catalog: "bootstrap" | "operational" | "triage";
  transform_contract_ref: string;
  evaluation_contract_ref: string;
  traversal_modulation_strategy: string;
  proof_obligations: ReadonlyArray<string>;
  requirement_refs: ReadonlyArray<string>;
  evaluators: ReadonlyArray<{ name: string; regime: "F_D" | "F_P" | "F_H"; binding: string }>;
  operator: { name: string; regime: "F_D" | "F_P" | "F_H"; binding: string };
};

type ExecutiveView = {
  kind: "executive_view";
  name: string;
  intent: string;
  steps: ReadonlyArray<string>;
  outputs: ReadonlyArray<string>;
};

type LibraryFunctionView = {
  kind: "library_function_view";
  name: string;
  intent: string;
  stable_outer_contract: string;
  compute_order: ReadonlyArray<string>;
};

type LiveModuleProjection = {
  kind: "live_module_projection";
  contract_version: SdlcQueryContractVersion;
  fetched_at: string;
  install_root: string;
  executives: ReadonlyArray<ExecutiveView>;
  leaves: ReadonlyArray<LeafGraphFunctionView>;
  library: ReadonlyArray<LibraryFunctionView>;
};

type LiveModuleProjectionState =
  | { kind: "pending" }
  | { kind: "loaded"; projection: LiveModuleProjection }
  | { kind: "failed"; reason: string }
  | { kind: "unsupported"; state: UnsupportedFormatState };

type LeafInvocationStatus =
  | "queued"
  | "running"
  | "fp_succeeded"
  | "fd_postflight_passed"
  | "failed"
  | "unattested";

type AssuranceLedgerVector = {
  kind: "assurance_ledger_vector";
  materialization: "pass" | "fail" | "pending";
  semantic_convergence: "pass" | "fail" | "pending";
  obligation_carry: "pass" | "fail" | "pending";
  requirement_fulfillment: "pass" | "fail" | "pending";
  ambiguity: "pass" | "fail" | "pending";
  capability: "pass" | "fail" | "pending";
  shallow_realization: "pass" | "fail" | "pending";
};

type LeafOverlay = {
  kind: "leaf_overlay";
  leaf_name: string;
  invocation_count: number;
  latest_status: LeafInvocationStatus;
  assurance_vector: AssuranceLedgerVector | null;
  trace_archive_root: string | null;
};

type LiveOpRunProjection = {
  kind: "live_op_run_projection";
  contract_version: SdlcQueryContractVersion;
  fetched_at: string;
  op_run_id: string;
  executive_kind: "bootstrap" | "operational";
  leaf_overlays: ReadonlyArray<LeafOverlay>;
  event_stream_offset: number;
};

type LiveOpRunProjectionState =
  | { kind: "pending" }
  | { kind: "loaded"; projection: LiveOpRunProjection }
  | { kind: "failed"; reason: string }
  | { kind: "unsupported"; state: UnsupportedFormatState };
```

## Three-View × Three-Map Structure (REQ-OM-LNS-003)

```
operator views (filters):
  - Active Work
  - Blocked / Waiting
  - Ready for Handoff

graph-first maps (renderings within each view):
  - process flow map     <- variant portfolio applies HERE (V0 / V1 / V2 / V4)
  - builder governance map  <- single rendering
  - runtime evidence map    <- single rendering, consumes T-022 carrier
```

The three views are operator-saved filters over `LiveOpRunProjection`
overlay status (not over catalog structure). The three maps are
renderings of the same projection state. Each map appears under each
view; the view filter affects which leaves are highlighted, not which
leaves are present.

## Variant Portfolio (process flow map only)

All variants share the same `State`, `Msg`, `Cmd`, and AssetSurface
bindings. Only the `View` differs. Per UX_METHOD §13A every non-baseline
variant is a scaffold and carries:

- visible scaffold/debug label in the rendered tab
- permitted operations: read-only projection of admitted carriers
- mutation policy: forbidden (no product-truth-changing Msgs distinct
  from V0)
- superseding surface: the variant promoted to canonical at sprint close
- retirement condition: sprint close review
- owning ticket: T-026
- non-closure condition: sprint cannot close while any variant remains
  unclassified

### V0 — existing process flow rendering (baseline)

Current `ProcessWorkspace` flow map preserved verbatim except that its
data source switches to `LiveModuleProjection` + `LiveOpRunProjection`
(no more hardcoded stage list, no Python projection acceptance). V0 is
the comparison baseline; it is **not** a §13A scaffold because it is the
canonical surface today.

### V1 — three-lane structural map

Bootstrap chain (30 leaves) | Operational chain (7 leaves) | Triage lane
(6 leaves, parallel governance lane). Library functions visible as a
side palette. Per-leaf workbench on click. Repair-edge fan-in rendered
explicitly. `release_depth_parity_surface` rendered as the closure gate
before the bootstrap terminal.

### V2 — asset-DAG (surface-centric)

Nodes are `*_surface` assets; edges are leaves (each leaf produces one
primary surface and consumes many). Renders the actual fan-in topology.
Layout: top-down by topological order over `LiveModuleProjection.leaves`.

### V4 — assurance-matrix dashboard

43-row × 7-column grid: rows = leaves, columns = the seven assurance
ledgers (materialization / semantic_convergence / obligation_carry /
requirement_fulfillment / ambiguity / capability / shallow_realization).
Cells = `pass | fail | pending` from `LeafOverlay.assurance_vector`.
Compact, not graph-shaped, but spots systemic gaps fast.

## Implementation Slices

1. Author `LiveModuleProjection`, `LiveOpRunProjection`,
   `UnsupportedFormatState`, and the supporting view types in
   `src/contracts/process.ts` (or new `src/contracts/process-projection.ts`)
   with runtime validators per UX_METHOD §10.
2. Extend `src/server/sidecar-process-projection.mjs` (or admit a new
   service) to invoke the installed TS tenant via `odd_sdlc.query-domain
   ts-v1` for the module projection, and to read
   `.ai-workspace/runtime/odd_sdlc/operator-runs/<oprun>/` plus
   `events.jsonl` tail for the op-run overlay. No memoization across
   calls; no Python-shape acceptance.
3. Extend `ManagerWorld` in `src/lib/types.ts` with
   `process.module_projection: LiveModuleProjectionState` and
   `process.op_run_overlay: LiveOpRunProjectionState`. Remove or
   deprecate any field that originated from the Python projection.
4. Replace ProcessWorkspace's hardcoded stage-list reducer with a typed
   reducer over the new projection states. Declare `State`, `Msg`,
   `Update`, `Cmd`, `Sub` per UX_METHOD §4.
5. Implement the three operator views as filters over
   `LiveOpRunProjection.leaf_overlays` (Active Work, Blocked / Waiting,
   Ready for Handoff).
6. Implement the three graph-first maps. Process flow map renders one of
   V0 / V1 / V2 / V4 selected by a tab strip on the map header. Builder
   governance and runtime evidence maps render once each.
7. Author Msg-replay proofs:
   `runtime/tests/test_live_module_projection_msg_replay.mjs`,
   `runtime/tests/test_live_op_run_projection_msg_replay.mjs`,
   and one per-variant proof under
   `runtime/tests/test_process_flow_map_v{0,1,2,4}_msg_replay.mjs`.
8. Add a playwright walk under `tests/e2e/` that opens the navigator,
   exercises view × map × variant switching, and asserts the
   unsupported-format state when the install is absent.

## Closure Criteria

T-026 closes only when:

- both AssetSurface carriers admit live projections via
  `odd_sdlc.query-domain ts-v1`, with declared pull-on-demand freshness
  and explicit Python-shape rejection
- ManagerWorld carries the new fields; no Python projection layer is
  extended
- ProcessWorkspace renders the three operator views and three graph-first
  maps
- V0 / V1 / V2 / V4 ship as selectable variants of the process flow map
  with §13A scaffold-exemption metadata on V1 / V2 / V4
- §8A Msg-replay proofs pass for both carriers and for every shipped
  variant
- playwright e2e walk passes
- sprint close review classifies every variant under
  `accepted | local_paydown | design_reframe | requirement_reprice | product_reprice | remove`
- one variant promoted to canonical at sprint close, or the wave is
  returned to design with a recorded reprice

## Non-Closure Statement

T-026 is not closed by replacing the hardcoded stage list with a
different hardcoded stage list. It closes only when the live TS Module
catalog drives the navigator's structural rendering, both projection
carriers are admitted with declared freshness and Python rejection, the
three-view × three-map structure realises REQ-OM-LNS-003, the four
process-flow-map variants ship under §13A scaffold law, and sprint close
review classifies every variant before any closure claim.

## Review Update 2026-05-05

Result from latest review run:

- runtime/node regression lane: **134 passed** (including `runtime/tests/test_sidecar_process_projection.mjs` and `runtime/tests/test_sidecar_process_navigator_msg_replay.mjs`)
- Playwright lane: run started but first e2e case failed (`open sidecar` did not show `.sidecar-process-navigator` element within timeout), so browser closure evidence is still incomplete.

Blocking follow-up findings to address before close:

1) `deriveLeafStatus()` can emit stale `"failed"` due to historical `tracedEvidence` scan instead of strictly latest invocation.
2) Load failure path in `SidecarPanel` uses `load/done` with partial payload; merged reducer state can retain prior `process` projection.
3) Overlay trace root selection currently pulls the first evidence entry, not the latest admitted evidence.

Service check (local):

- `lsof` shows Node listeners on **localhost:4173** and **localhost:5173**, so an odd_manager-related service appears to be running on both ports.
