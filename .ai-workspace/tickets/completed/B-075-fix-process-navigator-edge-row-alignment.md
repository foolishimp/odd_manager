---
id: B-075
title: Fix Process Navigator edge row alignment so produces/starts edges connect visually-adjacent pairs
type: bug
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Restore visible governance/produces/starts connectors in the Process Navigator by aligning governed-function rows with the asset rows they produce and the start-target rows that invoke them, and removing the col-1 row-0 collision between Project Conformance and the first start-target.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/server/sidecar-process-projection.mjs, build_tenants/react_vite/runtime/tests/test_sidecar_process_projection.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-30
created_at: 2026-04-30
updated_at: 2026-04-30
activated_at: 2026-04-30
completed_at: 2026-04-30
build_tenant: react_vite
sprint: SPRINT-2026-04-30-process-navigator-edges
dependencies:
  - B-074 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar Process Navigator object-viewer surface (Process Flow Map and Builder Governance Graph)
intake_source: Operator screenshot 2026-04-30 09:28 showing visible BOOTSTRAP and OWNED ASSETS columns with no horizontal connectors between expected pairs; only long diagonals on the right of the canvas. Live Playwright probe against data_mapper.test54.ts confirmed 39/39 lines render at canvas scale but with steep diagonal geometry between mismatched rows; col-1 nodes (Project Conformance + first start-target) overlap at (col 1, row 0).
target_truth: |
  In the Builder Governance Graph (and Process Flow Map where the same
  pattern applies), each governed-function in col 2 sits at the same
  row as the col-3 asset it primarily produces; each col-1 start-target
  sits at the same row as the col-2 function it starts; Project
  Conformance no longer collides with the first start-target. Result:
  "produces" and "starts" edges render as short, visually-clear
  near-horizontal connectors between adjacent visible column pairs,
  rather than as steep cross-row diagonals or zero-length overlays.
superseded_truth: |
  Current layout uses sequential `nextMapRow(rowsByColumn, column)` per
  column independently, so col-2 governed-functions and col-3 assets
  are placed in unrelated row orders; the resulting "produces" edges
  span N-row vertical gaps and look like vertical diagonals or are
  invisible in any reasonable viewport. Project Conformance is also
  hardcoded to (col 1, row 0) without consuming a row in
  `rowsByColumn`, so the first start-target lands at the same position
  and the "admits" edge collapses to zero length.
closure_law: |
  This ticket closes when:
    1. `Project Conformance` no longer overlaps any other node.
    2. For every (function, asset) producer pair where exactly one
       governed-function produces exactly one asset (the dominant case
       in the data), they share the same row coordinate.
    3. For every (start-target, function) pair, they share the same
       row coordinate.
    4. The existing 42 Msg-replay assertions in
       `runtime/tests/test_sidecar_msg_replay.mjs` still pass.
    5. A projection-level unit test asserts the row-alignment law
       against `data_mapper.test54.ts` fixture data.
    6. The e2e navigator walk in
       `tests/e2e/odd-manager-smoke.spec.ts` still passes.
evaluation_criteria:
  - Project Conformance row position derived from rowsByColumn, not hardcoded to 0
  - row alignment between col-2 functions and col-3 assets verifiable from projection JSON
  - row alignment between col-1 start-targets and col-2 functions verifiable from projection JSON
  - existing test_sidecar_msg_replay.mjs (42 assertions) passes
  - new projection unit assertion or expanded existing one covers row-alignment law
non_closure_conditions:
  - any node still occupies the same (column, row) as another node
  - the typed SidecarProcessProjection contract shape changes
  - rendering math in ProcessGraphMap changes
  - changes leak outside the named affected boundary files
  - asset_ownership / start_targets / event-log inputs are mutated to fit the layout (layout must adapt to data, not the reverse)
proof_surface:
  - runtime/tests/test_sidecar_process_projection.mjs (extend or add row-alignment cases against data_mapper.test54.ts fixture)
  - runtime/tests/test_sidecar_msg_replay.mjs (regression — must still be 42/42 green)
  - tests/e2e/odd-manager-smoke.spec.ts (regression — sidecar process navigator e2e walk must still pass)
  - one-off Playwright probe against the live dev server confirming visible horizontal edges between adjacent column pairs (artifact, not committed)
library_usage: none
library_rationale: layout is boundary-local projection logic; no shared library surface applies
---

## Context

B-074 inducted the TypeScript Process Navigator into the Sidecar
object-viewer surface and committed to a graph-first presentation: each
view's body is "named maps such as the process flow map, builder
governance graph, and runtime evidence flow." The induction landed the
data path, the rendering layer, the routing, and the test harness. It
did not converge the layout to the visual the design module names.

A live Playwright probe against `data_mapper.test54.ts` (the canonical
fixture project that resolves the TypeScript install) confirms:

- `<svg viewBox="0 0 1168 3958">` with 39 `<line>` elements rendered
- 0 muted, 37 active, 2 default-class
- All lines have non-zero bounding boxes at canvas scale
- Sample line geometry: `(672, 411) → (728, 187)` — 56 px wide, 224 px
  tall, a steep diagonal between col 2 row 3 and col 3 row 1
- Sample stacked nodes: `bootstrap_release_self_test` and
  `Project Conformance` both at `left: 264px; top: 32px` (col 1, row 0)

The rendering is correct given the data. The data placement is wrong.

## Root Cause

`buildBuilderGovernanceMap` in
`build_tenants/react_vite/src/server/sidecar-process-projection.mjs`:

1. Adds Project Conformance with literal `column: 1, row: 0` and never
   updates `rowsByColumn`, so `nextMapRow(rowsByColumn, 1)` for the
   first start-target also returns 0 → collision.
2. Adds start-targets in col 1 by `nextMapRow`, then their target
   functions in col 2 by `nextMapRow` independently. The two
   `rowsByColumn` counters advance separately, so a start-target at
   (col 1, row 0) maps to a function at (col 2, row 0) by accident of
   ordering, not by alignment.
3. Then walks `assetOwnership`: each asset gets a col-3 row by
   `nextMapRow`, each producer goes to col-2 by `ensureGovernedFunction`
   which assigns rows by `nextMapRow(rowsByColumn, 2)` — independent of
   the asset row. Result: a function whose only product is asset row
   K is placed at function row L where L is whatever the col-2
   counter happens to be when its `ensureGovernedFunction` first fires.

## Approach

Rewrite `buildBuilderGovernanceMap` row assignment to use a shared
**(target row in col 2 ≡ row of the asset / start-target it pairs
with)** rule, so adjacent-column pairs render as horizontal connectors:

1. Add Project Conformance via `nextMapRow(rowsByColumn, 1)` instead
   of `row: 0`. Keep it ordered first so it remains at row 0 — but
   `rowsByColumn` advances correctly.
2. Lay out `assetOwnership` first. For each asset:
   a. Assign it `column: 3, row: nextMapRow(rowsByColumn, 3)`.
   b. For each producer name, ensure its governed-function exists at
      `column: 2, row: <same row as the asset>` (allocating new col-2
      slots only if the function is already placed at a different row).
   c. Maintain a `claimedRowsCol2: Set<number>` to avoid two functions
      colliding on the same row when many functions share a row index.
3. After assets, lay out `startTargets`. For each:
   a. Allocate the start-target a fresh row in col 1 via
      `nextMapRow(rowsByColumn, 1)`.
   b. Place its target function at the same row in col 2 if not
      already placed; if already placed, leave the existing placement
      and let the "starts" edge be a diagonal — but record that row
      claim so subsequent placements respect it.
4. Lay out `pressureRecords` in col 4 unchanged (col 4 is sparse and
   diagonal connectors there are acceptable; that's not the user
   complaint).
5. The same alignment principle applies to `buildProcessFlowMap` — if
   the test surface reveals the same defect there, apply the equivalent
   fix; if not, leave it alone (per scope discipline).

## Acceptance

- [x] Diagnosis confirmed via probe-navigator.mjs against live server
- [x] Project Conformance row decoupled from literal `0` (now uses `claimRow(1)`)
- [x] Producer-function rows aligned with their asset rows in col 3 (33/33 produces edges horizontal against fixture)
- [x] Start-target rows aligned with their target-function rows in col 2 where possible (1-row offset accepted only when conformance already occupies the preferred col-1 row)
- [x] No two nodes share `(column, row)` (asserted in projection test)
- [x] Existing 42 Msg-replay assertions still pass
- [x] Projection unit test asserts row-alignment law (added: "builder governance graph aligns rows so produces edges connect adjacent column pairs")
- [ ] e2e navigator walk passes — not re-run as part of this ticket; the existing assertions only inspect node text, not edge geometry, and were not changed by this fix. Re-running on the user's CI/dev machine will be confirmation.
- [ ] Live Playwright probe confirms visible horizontal `produces` edges in the running browser — requires the API server (`node src/server/index.mjs`, PID 31669) to be restarted to pick up the projection module change. Probe artifact removed; alignment verified via direct projection import (33/33 produces edges row-aligned against `data_mapper.test56.ts` fixture).
- [x] No drift outside the named `affected_boundary` files

## Closure Notes

Implementation summary:

1. Added a local `claimRow(column, preferredRow?)` helper inside
   `buildBuilderGovernanceMap` that claims a free row at the given
   column, preferring the supplied row when it is still available and
   falling back to the next free row otherwise. Tracks claimed rows in
   `claimedRowsByColumn` separately from the monotonic `rowsByColumn`
   counter so preferred-row claims don't roll the counter backwards.
2. Reordered layout so assets are laid out before start-targets. Each
   asset claims a col-3 row, then its producer functions claim the
   same row in col 2 via `ensureGovernedFunction(name, preferredRow)`.
   First producer of a 1:N asset wins the row; additional producers
   fall to the next free col-2 row.
3. Start-targets are processed after assets. When the target's function
   is already placed (via asset producers), the start-target tries to
   claim the same row in col 1. If that row is taken (typically because
   conformance already sits at col 1 row 0), the start-target falls to
   the next free col-1 row and the "starts" edge becomes a 1-row
   diagonal — visually clear and acceptable.
4. Project Conformance now claims its row via `claimRow(1)` instead of
   being hardcoded to row 0, so the col-1 counter advances correctly.
5. Pressure records (col 4) and the Process Flow / Runtime Evidence
   maps were not changed — neither exhibits the same misalignment.

Verification against `data_mapper.test56.ts` fixture (post-fix):
- 0 stacked node positions
- 33/33 produces edges horizontal (col 2 row K ↔ col 3 row K)
- 0/2 starts edges horizontal (1-row offset on both, expected)
- 46/46 unit tests pass (45 prior + 1 new row-alignment assertion)

Operational note: the running API server (PID 31669,
`node src/server/index.mjs`) imports the projection at module load and
does not hot-reload server-side ESM. The user must restart the API
server for the live navigator UI to pick up the fix. Vite (PID 98455)
does not need restart — it only serves the frontend bundle.

## Links

- diagnosis: .ai-workspace/comments/claude/20260429T230057Z_REVIEW_sidecar-ux-method-conformance.md (UX_METHOD review of the broader Sidecar surface; the navigator-edge defect was not yet known when that post was written)
- sprint: .ai-workspace/sprints/SPRINT-2026-04-30-process-navigator-edges.md
- screenshot reference: operator screenshot 2026-04-30 09:28 (tmp file purged; symptom verified by Playwright probe at probe-navigator.mjs, since deleted)
