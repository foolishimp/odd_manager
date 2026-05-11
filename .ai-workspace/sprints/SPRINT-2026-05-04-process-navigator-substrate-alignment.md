# SPRINT-2026-05-04 Process Navigator Substrate Alignment

- id: SPRINT-2026-05-04-process-navigator-substrate-alignment
- title: Align odd_manager Process Navigator surfaces with the live odd_sdlc TypeScript projection and ABG 3.5.0-rc.1 traced call-out substrate
- status: open
- goal: realize-ai-workspace-topology-and-agent-interoperability
- opened_at: 2026-05-04T22:50:00Z
- updated_at: 2026-05-04T22:50:00Z

## Authority

- specification/PRODUCT.md §Process Navigator (workspace://specification/PRODUCT.md)
- specification/requirements/10-entry-lenses-and-delivery-workspaces.md REQ-OM-LNS-003
- specification/requirements/04-orientation-and-navigation.md
- abiogenesis 3.5.0-rc.1 substrate (T-108 traced process, T-109 universal traced call-out, T-110 odd_sdlc migration, T-111 PTY executor — all closed upstream)
- odd_sdlc TypeScript tenant publishing `odd_sdlc.query-domain ts-v1` (the contract REQ-OM-LNS-003 obligates)
- /Users/jim/src/apps/specification_methodology/specification/standards/UX_METHOD.md
- /Users/jim/src/apps/specification_methodology/specification/standards/SPEC_METHOD.md
- /Users/jim/src/apps/specification_methodology/specification/standards/TICKET_METHOD.md
- /Users/jim/src/apps/specification_methodology/specification/standards/DESIGN_MODULE_METHOD.md
- /Users/jim/src/apps/specification_methodology/specification/standards/ODD_METHOD.md
- canonical reference run for installed-state shape: `/Users/jim/src/apps/odd_sdlc/build_tenants/typescript/test_env/test_runs/t109_live_installed_data_mapper_pty/<latest>/workspace/`

## Triage Grounding

REQ-OM-LNS-003 is the live load-bearing requirement. It already obligates:

- the TypeScript query contract `odd_sdlc.query-domain ts-v1`
- explicit rejection of legacy Python SDLC process projection shapes
- exactly three operator views (Active Work, Blocked / Waiting, Ready for Handoff)
- three graph-first maps (process flow, builder governance, runtime evidence) under those views
- projection from ABG/odd_sdlc TypeScript truth
- read-only posture (no traversal, continuation, edge selection, or gap closure decisions in the navigator)

The current ProcessWorkspace implementation does not realize this requirement: it encodes a hardcoded stage list, may accept Python projection shapes, and lacks the live-projection invariant. This sprint closes that realization gap.

The Python tenant is retired; the sidecar is TypeScript-only. The substrate publishes typed runtime evidence (TracedProcessOutcome, executor profile, parser observations, trace archive shape) that the UI does not yet admit.

## Scope

This sprint realizes REQ-OM-LNS-003 plus the ABG 3.5.0-rc.1 traced call-out substrate awareness in the odd_manager UI. It admits two source-carrier waves and lands one cross-cutting audit:

### Wave 1 — Source Carriers (parallel)

- **T-022** Surface ABG 3.5.0-rc.1 traced call-out runtime evidence in RuntimePanel — admits `TracedCalloutEvidence` per supervised actor invocation
- **T-026** Rebuild Process Navigator over live odd_sdlc TypeScript projection under variant portfolio — admits `LiveModuleProjection` and `LiveOpRunProjection`, structurally rebuilds ProcessWorkspace under the three-view × three-map shape required by REQ-OM-LNS-003, ships a §13A scaffold-exemption variant portfolio (V0 / V1 / V2 / V4) over the process flow map only

### Wave 2 — Downstream Consumers (depends on Wave 1)

- **T-024** Render per-edge outcome and executor profile in ProcessWorkspace and Builder Governance graph — consumes T-022's `TracedCalloutEvidence` and T-026's `LiveModuleProjection`; glyph rendering decorates whichever process flow map variant is promoted to canonical at sprint close

### Cross-Cutting (parallel from start, needs only carrier shapes)

- **T-025** Audit additional odd_manager tabs for new-substrate coverage — produces classification document with parameterized `consumes_carrier(<id>)` vocabulary and follow-up tickets for `extension_required` panels

## Excluded Boundaries

- T-023 (STDO four-method authority projection in BuilderPanel) is **deferred** to backlog. Triage found its First Missing Layer is Requirements, not Design — no live requirement obligates STDO authority projection in BuilderPanel. T-023 cannot enter design re-entry under this sprint without a `requirement_reprice` first. Left in `tickets/backlog/` for future revival.
- Python projection layers (`runtime/odd_manager_world.py`, `runtime/manager_world.py`) are **not** extended. Python tenant is retired. Sprint closure is blocked if any ticket extends a Python projection in parallel with the TypeScript carriers.
- Method-authority decoration (T-023's intended scope) is out. Authority binding rendering is not part of this sprint.
- New AssetSurfaces beyond `LiveModuleProjection`, `LiveOpRunProjection`, and `TracedCalloutEvidence` are out of scope; if T-025 audit identifies additional carrier needs, those land as follow-up tickets, not in this sprint.
- Modifications to `odd_sdlc.query-domain ts-v1` upstream — out of scope. This sprint consumes the contract; if the contract surface is missing or insufficient, sprint exits via standalone repricing (see §SPEC_METHOD §Lawful Re-Entry).
- Scaffolding outside the §13A boilerplate per variant — out of scope; if a variant needs additional scaffolds, that's a non-closure condition.

## Expected Change Classes

- `design_reframe` × 3 — T-022, T-024, T-026 (new typed carriers + design-level realization changes; requirements stable)
- `realization_refactor` × 1 — T-025 (audit + follow-up ticket admission; no new carrier introduced by the audit ticket itself)

## Sprint Compliance Escrow (UX_METHOD §13B)

This sprint **is eligible** for compliance escrow against:

- screenshot or walkthrough capture (deferrable during iteration)
- visual review (deferrable during iteration)
- copy, spacing, density, and layout cleanup (deferrable during iteration)
- accessibility review and remediation (deferrable during iteration; close still requires §11)
- Msg-replay proof updates for product-meaningful interaction families (deferrable during iteration; close requires final proofs per §8A)
- design-module wording cleanup (deferrable during iteration)
- trace cleanup between changed UX states and governing authority (deferrable during iteration)

This sprint **is not eligible** for compliance escrow against:

- product-truth-changing `Msg` variants that lack an admitted carrier (`TracedCalloutEvidence`, `LiveModuleProjection`, `LiveOpRunProjection`, or carriers admitted by T-024 must land before close)
- new or changed `AssetSurface` contracts beyond those declared in this sprint
- new navigation, information architecture, or selection authority that changes product meaning beyond what REQ-OM-LNS-003 already authorises
- runtime, governance, closure, continuation, lineage, provenance, or evidence semantics
- the live-projection invariant (no carrier may return memoized or snapshotted state)
- Python projection rejection (no projection layer may accept legacy Python SDLC shapes)
- release criteria or method law

If any of those appear during execution, the sprint records the finding and the work exits the UX sprint path through standalone repricing or sprint supersession.

## Variant Scaffold Law (UX_METHOD §13A)

T-026 ships V0 (baseline, canonical) plus V1 (three-lane structural), V2 (asset-DAG), V4 (assurance-matrix) as parallel variants of the process flow map only. V1 / V2 / V4 are §13A scaffolds and each carries:

- visible scaffold/debug label rendered in the variant tab
- permitted operations: read-only projection of admitted carriers (no product-truth-changing Msgs distinct from V0)
- mutation policy: forbidden — variants share the same admitted carriers and Msg algebra; only View differs
- superseding surface: the variant promoted to canonical at sprint close (or V0 if no variant is promoted)
- retirement condition: sprint close review
- owning ticket: T-026
- non-closure condition: sprint cannot close while any variant remains unclassified under the §13B vocabulary

Builder governance map and runtime evidence map render once each — variants are not in scope on those maps for this sprint.

## Closure

### Closure Triggers

The sprint closes when all four included tickets reach `completed` and sprint close review classifies every variant.

### Required Closure Evidence

- T-022, T-024, T-025, T-026 each marked `completed`
- §8A Msg-replay proofs pass for `LiveModuleProjection`, `LiveOpRunProjection`, `TracedCalloutEvidence`, and each shipped process-flow-map variant
- playwright e2e walks pass for the navigator (view × map × variant switching) and for the runtime panel (TracedCalloutEvidence rendering)
- forensic walkthrough classifies every variant (V0 / V1 / V2 / V4) under `accepted | local_paydown | design_reframe | requirement_reprice | product_reprice | remove`
- exactly one process-flow-map variant promoted to canonical, OR the wave is returned to design with a recorded reprice
- T-025 audit document published under `.ai-workspace/comments/claude/<timestamp>Z_REVIEW_odd-manager-tabs-substrate-coverage.md`
- every `extension_required` finding from T-025 has a follow-up backlog ticket admitted

### Non-Closure Conditions

- any ticket extends a Python projection layer in parallel with the TypeScript carriers
- any carrier returns memoized or snapshotted state instead of reading live workspace truth at admission time
- any projection accepts legacy Python SDLC shapes instead of rejecting them with a typed `UnsupportedFormatState`
- ProcessWorkspace renders fewer than three operator views or more than three graph-first maps
- variant scaffolds ship without §13A boilerplate
- variants ship with product-truth-changing Msgs that diverge from V0's algebra
- the navigator's `Cmd` algebra includes write paths that bypass an admitted AssetSurface action registry
- the navigator carries traversal, continuation, edge-selection, or gap-closure decision logic (REQ-OM-LNS-003 forbids it)
- close review claims completion without classifying every variant under the §13B vocabulary
- T-023 quietly migrated into this sprint without an upstream `requirement_reprice`

## Included Tickets

- `tickets/active/T-022-surface-abg-3-5-traced-callout-runtime-evidence-in-runtimepanel.md`
- `tickets/active/T-024-render-per-edge-outcome-and-executor-in-processworkspace.md`
- `tickets/active/T-025-audit-additional-tabs-for-new-substrate-coverage.md`
- `tickets/active/T-026-rebuild-process-navigator-over-live-ts-projection.md`

## Excluded From This Sprint

- `tickets/backlog/T-023-project-stdo-four-method-authority-in-builderpanel.md` — deferred pending requirement_reprice. Triage found no live requirement obligating STDO authority projection in BuilderPanel; cannot enter design re-entry without an upstream authoring requirement.

## Sprint Governance

This sprint is `design_reframe` × 3 plus `realization_refactor` × 1.
Per `SPEC_METHOD.md` §Change Management, that re-enters at design and at
the realized surface respectively, and must prove no upstream
constitutional drift. REQ-OM-LNS-003 is the load-bearing live
requirement; this sprint realizes it, it does not change it.

Per `UX_METHOD.md` §13B, this sprint **is** eligible for compliance
escrow against the visual / a11y / replay-update / cleanup categories
listed above. It is **not** eligible for escrow against carrier or
product-truth obligations or against the live-projection invariant.

Per `UX_METHOD.md` §13A, the process-flow-map variants ship under
scaffold-exemption boilerplate; sprint cannot close while any variant
remains unclassified.

Per `TICKET_METHOD.md` §Inside-Out First Ticket Sequencing, the source
carriers (T-022, T-026) lead the wave; the downstream consumer (T-024)
follows; the cross-cutting audit (T-025) runs in parallel from carrier
shape.
