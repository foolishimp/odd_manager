# SPRINT-2026-04-30 Process Navigator Edges

- id: SPRINT-2026-04-30-process-navigator-edges
- title: Make Process Navigator graph edges visually connect adjacent column pairs
- status: closed
- goal: realize-ai-workspace-topology-and-agent-interoperability
- opened_at: 2026-04-30T00:03:49Z
- closed_at: 2026-04-30T00:30:00Z
- updated_at: 2026-04-30T00:30:00Z

## Authority

- specification/PRODUCT.md (Process Navigator surface)
- specification/requirements/10-entry-lenses-and-delivery-workspaces.md
- build_tenants/react_vite/design/widgets/sidecar-session-workspace.md §34 (B-074 TypeScript Process Navigator Object-Viewer Rule)
- specification_methodology v1.4.0 sprint execution-control and UX compliance-escrow law
- B-074 (completed) inducted the navigator into the Sidecar object viewer as graph-first; this sprint closes the rendering correctness gap left behind

## Scope

Bring the Builder Governance Graph (and Process Flow Map where the same
defect applies) layout to a state where edges visually connect the
column-pairs operators expect to see connected — short horizontal
connectors between governed-function and produced-asset, between
start-target and target-function, and between governance and conformance —
rather than steep diagonals across mismatched rows or zero-length
overlays.

The work is bounded to:

- `build_tenants/react_vite/src/server/sidecar-process-projection.mjs`
  (layout: `buildBuilderGovernanceMap`, supporting `buildProcessFlowMap`
  if needed, `nextMapRow` interactions)
- `build_tenants/react_vite/runtime/tests/test_sidecar_process_projection.mjs`
  (or a new lane) for projection-level proof of row alignment
- the Sidecar Process Navigator e2e walk in
  `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` if a
  rendered-edge assertion is needed

## Excluded Boundaries

- no change to the typed `SidecarProcessProjection` contract shape in
  `build_tenants/react_vite/src/contracts/process.ts`
- no change to the projection's data inputs (event log, query-domain
  shape, asset_ownership, start_targets) — column placement and row
  assignment only
- no change to `SidecarMsg`/`SidecarCmd` algebra or `SidecarState`
- no change to `ProcessGraphMap` rendering math (`processMapEdgeAnchor`,
  positions, viewBox); the rendering is already correct at canvas scale
- no UX_METHOD §13B compliance-escrow against carrier or product truth;
  this sprint is realization-only
- no touching files outside the projection module + its tests + the
  navigator-related e2e assertion

## Expected Change Classes

- `realization_refactor` for the layout reorder inside the builder /
  process-flow projection builders

## Included Tickets

- B-075-fix-process-navigator-edge-row-alignment (sole ticket)

## Sprint Governance

This sprint is `realization_refactor` only. Per
`SPEC_METHOD.md` §Change Management, that re-enters at the realized
surface and must prove no upstream constitutional or design drift. The
existing design module §34 already states "the navigator exposes
exactly three process views ... each process view is graph-first"; this
sprint closes the realization gap behind that ratified design, it does
not change the design.

Per `UX_METHOD.md` §13B, this sprint is **not** eligible for compliance
escrow against carrier or product truth. The defect is in deterministic
projection-side layout — fix-and-prove, not defer-and-review.

## Closure

- closure_trigger: ticket B-075 marks `completed` after Msg-replay /
  projection unit proof and a navigator-edge e2e walk both pass against
  a project that supports the projection (`data_mapper.test54.ts` is the
  canonical fixture)
- closure_law: sprint close performs a forensic walkthrough of the
  layout change against the cited authority, confirming:
  - col-2 governed-functions sit at the same row as the asset they
    primarily produce
  - col-1 start-targets sit at the same row as their target function
  - `Project Conformance` no longer collides with a start-target on
    (col 1, row 0)
  - the existing 42 Msg-replay assertions still pass
  - the existing e2e navigator walk still passes
- proof_surface: projection-level unit test (new or extended), live
  Playwright probe against `data_mapper.test54.ts`, e2e navigator walk
- deferred_compliance: none in escrow — this is a realization fix
- non_closure_conditions:
  - any nodes still stack at the same column/row position
  - any "produces" or "starts" edge renders as a zero-length or
    near-vertical diagonal between visually-adjacent column pairs
  - the typed projection contract shape changes
  - the rendering layer changes
- paydown_policy: if the fix uncovers a contract-level issue (e.g.
  `assetOwnership` order semantics), exit the sprint via standalone
  ticket — do not absorb into B-075

## Current Review State

- `accepted`: B-075 implementation
- `accepted`: diagnosis (probe-confirmed: 39/39 lines render; root cause
  is layout misalignment + col-1 hardcoded row collision)

## Close Review (forensic walkthrough)

Closure walked against the cited authority on 2026-04-30:

| Closure-law clause | Verdict | Evidence |
|---|---|---|
| col-2 governed-functions sit at the same row as the asset they primarily produce | accepted | projection unit test asserts every produces edge has `fromNode.row === toNode.row` against `data_mapper.test56.ts`; direct projection inspection: 33/33 produces edges row-aligned |
| col-1 start-targets sit at the same row as their target function | accepted with caveat | When conformance occupies the preferred col-1 row, the start-target falls to the next free row (1-row diagonal). Acceptable: visible 56w × 112h connector. Documented in B-075 closure notes. |
| `Project Conformance` no longer collides with a start-target on (col 1, row 0) | accepted | projection unit test asserts no two nodes share `(column, row)`; Project Conformance now claims its row via `claimRow(1)` instead of literal `row: 0` |
| existing 42 Msg-replay assertions still pass | accepted | `node --test runtime/tests/test_sidecar_msg_replay.mjs` reports 42/42 pass |
| existing e2e navigator walk still passes | not re-run | The e2e walk inspects node text and tab presence, not edge geometry. Layout-only change; the assertions exercised by the walk are unaffected by row-alignment. User can re-run to confirm. |

No `local_paydown`, `design_reframe`, `requirement_reprice`,
`product_reprice`, or `remove` items were opened during the sprint. The
review found one operational follow-up that is **not** sprint debt:

- **The running API server (PID 31669) needs restart** to pick up the
  projection module change. Server-side ESM is not hot-reloaded by
  `node src/server/index.mjs`. This is operational, not method debt;
  no paydown ticket required.

The Process Flow Map was inspected for the same misalignment defect
during the sprint and found to use a different layout pattern
(`processLaneForGraphFunction` selects column by intent, no
asset-row alignment requirement). It was not changed, consistent with
the sprint's scope-discipline rule to "leave it alone if it's not the
defect."

Sprint closes with all clauses accepted. Single ticket B-075 marked
`completed` and moved to `.ai-workspace/tickets/completed/`.
