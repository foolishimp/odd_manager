---
id: T-024
title: Render per-edge outcome and executor profile glyphs in the sidecar Process Navigator (ProcessGraphMap)
type: feature
ticket_category: ui_substrate_alignment
status: completed
review_status: closed
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Project per-edge typed outcome (`TracedProcessOutcome.kind`) and executor profile (`local-spawn` or `pty-terminal`) into the sidecar Process Navigator's process flow map (rendered by `ProcessGraphMap` inside SidecarPanel) so operators can identify, per traversed edge, whether the run exited cleanly, signaled, hard-timed-out, inactivity-timed-out, ran without an executor, lost its terminal, or hit a process error, and which executor produced the evidence. The legacy `ProcessWorkspace.tsx` workspace-route surface is not the target — it consumes the older ManagerWorld projection and is on the retirement path.
change_class: design_reframe
re_entry_point: design
affected_boundary: sidecar process projection under `src/server/sidecar-process-projection.mjs`, sidecar contracts under `src/contracts/process.ts` (extension of `SidecarProcessMapEdge` and the per-leaf overlay), sidecar render under `src/features/sidecar/SidecarPanel.tsx` (ProcessGraphMap component)
priority: medium
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
  - T-022 (this ticket inherits the TracedCalloutEvidence carrier admitted in T-022; do not duplicate the carrier)
  - T-026 (this ticket renders per-edge glyphs over the structural surface T-026 lands; the canonical process flow map variant is selected at T-026 sprint close, and T-024's glyph rendering decorates that variant)
intake_source: ProcessWorkspace currently lays out edges by stage and lane without surfacing the typed outcome of the most recent traversal attempt. Operators reading the process flow cannot tell from the rendering alone whether an edge passed, hard-timed-out, lost a PTY terminal, or refused to launch. Builder Governance graph has the same gap. The substrate already publishes the typed outcome via T-108/T-109; the projection that ProcessWorkspace consumes does not yet carry it.
target_truth: ProcessWorkspace edges carry a typed outcome badge and an executor profile glyph, projected from the same TracedCalloutEvidence carrier T-022 admits. The Builder Governance graph reuses the same per-edge outcome/executor data when the underlying traversal evidence is admitted. No render-time text matching; the discriminator is `outcome.kind`.
superseded_truth: ProcessWorkspace renders edges without typed outcome or executor profile glyphs.
closure_law: This ticket closes only when ProcessWorkspace and Builder Governance graph render per-edge outcome and executor glyphs from the typed carrier admitted by T-022, and a Msg-replay proof covers admission to final rendered state.
evaluation_criteria:
  - sidecar process projection consumes TracedCalloutEvidence per edge and exposes a typed `latest_outcome` and `executor_profile` per edge node
  - ProcessWorkspace flow map renders one outcome glyph per edge (eight named kinds plus an "unattested" state when no evidence is present)
  - ProcessWorkspace lane sorting handles outcome states correctly (e.g., `hard_timeout` and `executor_unavailable` route to the blocked lane)
  - Builder Governance graph renders the same per-edge glyphs consistently with ProcessWorkspace
  - per-edge click-through reaches the trace archive ref carried in TracedCalloutEvidence
  - Msg-replay proof exercises a multi-edge fixture with mixed outcomes
proof_surface:
  - sidecar process projection extension
  - typed contract widening for SidecarProcessProjection edge node
  - ProcessWorkspace and GraphWorkspace rendering update
  - Msg-replay proof
  - playwright walk that loads a workspace with multi-edge mixed-outcome evidence
non_closure_conditions:
  - outcome glyph derived from text match on stdout instead of `outcome.kind`
  - executor profile inferred from path heuristics instead of admitted carrier field
  - `unattested` state collapsed with `exited` when evidence is absent
  - PTY-terminal `screenlog.0` reachable only by manual filesystem path entry, not click-through
  - per-edge outcome stored only in ProcessWorkspace component state, not in admitted projection
  - duplicate TracedCalloutEvidence carrier defined in T-024 instead of consuming the T-022 contract
  - glyph rendering committed to the pre-T-026 hardcoded stage list rather than the live `LiveModuleProjection` catalog T-026 publishes
  - glyph rendering hardcoded to one process-flow-map variant before sprint close has classified the variants and promoted a canonical surface
  - the per-edge projection holds memoized or snapshotted overlay state across navigation instead of refreshing from the live workspace per UX_METHOD §6
  - Python projection layers extended in parallel with the TypeScript projection — TS-tenant only
---

# T-024: Render Per-Edge Outcome And Executor In ProcessWorkspace

## Completion Update — 2026-05-05 Codex

Closed against the revised sidecar `ProcessGraphMap` target, not the legacy ProcessWorkspace route.

Implemented and verified:

- `SidecarProcessMapEdge` carries typed `latestOutcome`, `executorProfile`, and `traceArchiveRoot`.
- Server decoration folds the latest traced evidence per leaf onto process-flow and builder-governance edges.
- Decoration uses the latest admitted invocation, not historical stale evidence.
- `ProcessGraphMap` renders compact per-edge outcome/executor glyphs, with explicit unattested state when evidence is absent.
- Edge glyphs click through to the admitted trace archive when `traceArchiveRoot` is present.

Live t109 verification:

- catalog: 44 leaves
- overlays: 14
- traced admissions: 19
- edges decorated with typed outcome/executor: 63/175

Proof:

- focused projection regression covers stale historical failure versus latest successful edge decoration.
- `npm run test:runtime:node` — 137 pass.
- `npx playwright test tests/e2e/odd-manager-process-navigator.spec.ts` — 4 pass.

## STDO Triage

### First Missing Layer

Design.

ProcessWorkspace projects edges by stage and lane. Per-edge typed outcome
and executor profile are absent from the projection it consumes. The
missing layer is the projection extension that carries
TracedCalloutEvidence into per-edge node data.

### Lawful Change Class

`design_reframe`. Existing projection contract widens to carry typed
outcome per edge node; no existing carrier is removed.

## Dependency On T-022

This ticket reuses the `TracedCalloutEvidence` carrier T-022 admits. It
does not introduce a parallel evidence shape. The relationship is:

```
T-022: admit TracedCalloutEvidence per supervised actor invocation
  -> ManagerWorld.runtime.runs[*].traced_callout_evidence

T-024: per-edge projection builder folds the same evidence into
  SidecarProcessProjection.edge_nodes[*].latest_outcome, executor_profile
  -> ProcessWorkspace and Builder Governance graph rendering
```

## Glyph Mapping

| outcome.kind | glyph | lane routing |
|---|---|---|
| `exited` (status 0) | clean dot | in_flight or carried |
| `exited` (status non-zero) | red dot | blocked |
| `signaled` | crossed dot | blocked |
| `hard_timeout` | clock-stop | blocked |
| `inactivity_timeout` | hourglass | blocked |
| `executor_unavailable` | unplugged | blocked |
| `launch_failed` | broken-link | blocked |
| `process_error` | warning | blocked |
| `lost_terminal` | dropped-line | blocked |
| (no evidence admitted) | dim outline | upstream |

Executor profile glyph: filled square for `pty-terminal`, hollow square
for `local-spawn`. Rendered next to outcome glyph.

## Implementation Slices

1. Widen `SidecarProcessProjection` edge node type in
   `src/contracts/process.ts` with `latest_outcome` and `executor_profile`
   fields (typed, not free-text).
2. Extend `sidecar-process-projection.mjs` projection builder to fold the
   most recent TracedCalloutEvidence per edge into the edge node.
3. Update ProcessWorkspace rendering to draw the glyph and route to the
   appropriate lane.
4. Update Builder Governance graph rendering to use the same glyph.
5. Update per-edge click-through to navigate to the trace archive ref.
6. Msg-replay proof at
   `runtime/tests/test_process_workspace_outcome_msg_replay.mjs`
   covering: clean exited, hard_timeout, executor_unavailable,
   lost_terminal, no evidence admitted (unattested).

## Closure Criteria

- contract widening landed
- projection extension produces typed `latest_outcome` and
  `executor_profile` per edge
- ProcessWorkspace and Builder Governance graph render glyphs from the
  typed carrier
- click-through reaches the trace archive ref
- Msg-replay proof passes for the mixed-outcome fixture
- unattested edges visually distinguished from clean-exited edges

## Non-Closure Statement

T-024 is not closed by adding a colour ramp to existing edges driven by
text match. It closes only when the per-edge node carries typed outcome
and executor profile from the admitted projection, and rendering reads
the discriminator field directly.
