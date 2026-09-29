---
id: SPRINT-2026-09-29-abg5-rc1-alignment
title: Iterate odd_manager alignment with the current ABG 5.0 RC1 candidate
status: active
goal: G-009
opened_at: 2026-09-29
updated_at: 2026-09-29
authority_refs:
  - specification/GOALS.md
  - specification/INTENT.md
  - specification/PRODUCT.md
  - specification/requirements/16-abg-event-stream-compatibility.md
  - build_tenants/common/design/ABG_EVENT_STREAM_COMPATIBILITY.md
  - build_tenants/common/design/VISUAL_GRAPH_RUNTIME_OBSERVATION.md
  - specification/REFERENCE_FRAME_BASIS.md
  - stdo_odd_manager.json#/constitution/stdo/basis
scope: current-candidate ABG observation adapters, projections and Run Inspector integration, delivered in four bounded iterations under T-046
excluded_boundaries:
  - upstream ABIogenesis or odd_glc source and runtime semantics
  - manager Product redesign or further method-basis changes beyond the selected STDO 2.5.1 setup
  - fabricated runtime, governance, liveness or provenance truth
  - external Build/Assure implementation or unqualified control operations
  - general RC1 release acceptance or inherited acceptance of other tickets
expected_change_classes:
  - requirement_reprice for the bounded current event-profile and per-Run status binding under unchanged Product intent
  - design_reframe through T-046 for the external contract binding
  - realization_refactor for bounded implementations under that binding
included_tickets:
  - T-046 as the integration outcome owner
  - T-040 for selected graph and actor presentation work
  - T-042 for current carrier admission and discovery
  - T-043 for selected identity and provenance work
  - T-044 for selected typed call, asset and assurance work
  - T-045 for matching exact installed qualification
closure_trigger: completion of I-01 through I-04, Product-owner close request, or a material upstream contract change that exceeds the admitted design binding
closure_law: freeze iteration, review every selected result and residual against its exact authority and evidence, and record accepted, local_paydown, design_reframe, requirement_reprice, product_reprice or remove disposition
proof_surface: exact candidate and fixture manifest, focused runtime and UX replay checks, installed server/browser observation, durable iteration returns and close review
deferred_compliance: none at opening; each delivered slice carries its own meaningful proof
non_closure_conditions: unresolved items lack disposition, retained proof identities are silently retargeted, material contract changes are hidden as cleanup, or required evidence depends on undeclared temporary files
paydown_policy: keep unfinished required behavior in T-046 and its owning ticket; create a new durable paydown ticket only for an uncovered residual that survives this sprint; route authority changes through the owning layer
---

# ABG 5.0 RC1 Alignment Sprint

Deliver current ABG runs through the existing manager in small, inspectable
slices while upstream debugging continues. The source of the task list,
starting S6/S7 evidence and overall outcome is
[T-046](../tickets/active/T-046-align-odd-manager-with-abg5-rc1.md).

This is a new bounded execution batch under
[G-009](../../specification/GOALS.md#goal-selection). It leaves the older ABG 4.6
sprint's review and external residual records intact. Inclusion here does not
change another ticket's status, acceptance gates or previously bound proof.

## Working Assumptions

- The current manager model and capability architecture remain the starting
  point. Expect local contract and projection changes as RC1 stabilizes.
- ABIogenesis owns runtime facts and published read semantics. The manager
  owns admission, bounded read models and operator presentation.
- The manager methodology is the verified immutable STDO 2.5.1 cut selected in
  `stdo_odd_manager.json`. Direct Product-owner instruction admits this setup;
  observing an external Run alone never adopts its method basis. The T-046
  setup activation rebinds the Executive/Worker configuration and finite a_c
  context while retaining historical proof and T-041 acceptance identities.
- Freeze exact artifact, event profile, carrier prefix and proof identities
  for each iteration. Later upstream fixes are new evidence, not retrospective
  changes to an accepted result.

## Iterations

| Iteration | Status | Tasks and operator-visible result | Completion check |
| --- | --- | --- | --- |
| I-01 Current runs in the inspector | accepted on exact W2 successor | A-01–A-03, minimum A-04, matching A-09. Current-profile requirements/design bind discovery of S6 and both S7 Runs, bounded events, canonical status and basic call detail. | R2 satisfied; E01 accepted candidate `58c256...812b` / 717 members. Matching 165 tests, typecheck/build and installed browser 1/1 passed; frozen ddc/base-read scope only. |
| I-02 Explain graph execution | selected frontier; reacquisition only | Reacquire source/contract, then scope A-04 completion, A-05 and relevant A-08. Published declaration topology and graph/frame/call/attempt/result/foldback explanation remain outstanding; no constructor is activated here. | Operator can move from declaration to occurrence to lazy call detail; missing definitions or actor carriers produce explicit unavailable states. Selection and refresh replay correctly. |
| I-03 Explain retained work and assurance | queued after I-02 | A-06, A-07 and remaining A-08. Expose source/current-use/new-assessment provenance, authored assets, support obligations and distinct governance/runtime contexts. | S7 retains original producer attribution and distinct Run closure; S6 assets and obligations agree with admitted evidence. Workspace observations keep their observation time and basis. |
| I-04 Qualify the bounded candidate | queued after delivered slices | Complete A-09 and A-10 disposition. Refresh the exact compatibility matrix, exercise the combined installed path, and record supported versus absent operational capabilities. | Durable proof binds the manager candidate including dirty-state identity, exact upstream subjects and all selected scenarios. Existing T-045 and T-032 residuals remain explicitly owned. |

E01 selects I-02 source/contract reacquisition and graph/call/declaration
explanation as the next frontier after I-01 acceptance. The
[disposition](../comments/codex/20260929_T046_ABG5_ALIGNMENT/20260929T061233_REVIEW_I01-disposition.md#e01-disposition-and-next-frontier)
and [context projection](../comments/codex/20260929_T046_ABG5_ALIGNMENT/context.md)
bind the exact accepted subject, remaining dependencies and residuals. No I-02
constructor is activated by this selection or D01 recording. I-02/I-03 detail
is repriced from current owners and the accepted bounded result; their rows
grant no new Product truth or missing upstream capability.

## Iteration Return

Keep one short return in this manifest or link the existing owning ticket's
return. Record only the information needed to resume and review:

1. Exact manager candidate, upstream artifact/profile and selected Run/prefix.
2. Contract delta, affected task rows and named Worker write territory.
3. Operator-visible result and meaningful positive/negative evidence.
4. Disposition, remaining gaps and the next selected increment.

Reacquire current upstream definitions at each boundary. If a fix only changes
an adapter detail or witness, rerun the affected proof. If it changes authority,
runtime meaning, a public contract or the agreed Product boundary, record the
delta in the owning ticket and re-enter at the first changed layer before
implementation. Such changes cannot be deferred as compliance cleanup.

## Evidence And Close Review

Every delivered iteration includes the relevant runtime/ingress/replay checks
and an installed server/browser walkthrough. Retain S6 negative attempts and
the S7 blocked-source/fresh-closed distinction alongside the positive paths.
Reject malformed profiles or references, mismatched digests, stale generations
and child-terminal evidence that would misstate a Run's condition.

Use tracked fixtures or a reproducible resolver with verified identities;
workspace links in T-046 locate source evidence but are not a portable proof
package. Existing 4.6 subjects remain separately labeled regression evidence.
Proof should not require a vanished `/private/tmp` package or a fresh paid
actor run simply to reproduce an observer assertion.

Move the sprint to `closing` before close review. Review all four iteration
rows, every selected task and any explicitly recorded deferred work. Classify
each result under the closure law, with a durable owner for every surviving
obligation. Only then move to `closed`. Sprint closure does not imply T-046,
T-045, an ABIogenesis release, or the external Build/Assure outcome is accepted.

## Opening Checkpoint

2026-09-29: Product owner requested a dedicated ticket and sprint after the
live-tree/model review. T-046 and this manifest are selected; I-01 is the first
delivery. No implementation iteration or new compatibility proof is complete.
The Writer activation and exact tracking-only write territory are recorded in
T-046. No compliance debt is deferred at opening.

STDO 2.5.1 setup return: W00 supplies `candidate_ready` / `satisfied` for the
verified method basis, refreshed bootstrap markers and finite context. E01 has
separately activated I-01 Worker W1 for the bounded requirement/design binding
and construction cone. W00 stops at setup; no delivered I-01 outcome or new
compatibility claim follows from this return.

## I-01 Accepted Return

[D01's record](../comments/codex/20260929_T046_ABG5_ALIGNMENT/20260929T061233_REVIEW_I01-disposition.md)
preserves W1's passing proof, R1's falsified judgment and E01's withholding;
then W2's exact successor, R2's satisfied judgment and E01's bounded acceptance.
The accepted candidate is
`58c256eeb18852eae332739e16c7c1c4a724e8221e8798c54265b091d944812b`,
717 frozen members. The maximum of 13 measured responses is 113,280 bytes.

I-01 covers the frozen ddc profile and base Run replay branch only. The
a25/current_intent delta and nativeLiveness remain unqualified. Rich graph,
provenance, assets and assurance work remains in I-02/I-03; I-04's combined
candidate/capability disposition and broader compatibility proof remain open.
Later tracking changes are separate from the frozen installed proof. This
sprint and T-046 stay active, with existing tickets retaining their own owners.
