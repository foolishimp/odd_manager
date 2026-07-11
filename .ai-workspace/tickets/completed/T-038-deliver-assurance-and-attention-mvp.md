---
id: T-038
title: Deliver the Assurance and Attention MVP
type: feature
ticket_category: ordinary
status: completed
review_status: manager_slice_accepted_external_residual_merged_into_t032
proof_status: verified_by_automation
execution_state: manager_mvp_complete_external_residual_owned_by_t032
goal: G-006
source_ticket: T-032
sprint: SPRINT-2026-07-10-abg46-observation-reprice
build_tenant: react_vite
owner: codex
change_intent: >-
  Deliver W21 MVP 5: required-versus-delivered gate and asset assurance,
  evidence drilldown, Attention Items, and bounded lawful reactions.
change_class: realization_refactor
re_entry_point: react_vite_realization
affected_boundary: gate/asset requirement catalogs, assurance projection, revision/freshness validation, attention derivation, reaction commands, Run Observation drilldown and proof
priority: high
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-11T19:57:31+10:00
merged_into: T-032
dependencies:
  - T-034
  - T-036
governance_scope: STDO-UX, REQ-OM-ASR-*
target_truth: >-
  The developer can see every required gate and asset against admitted delivery
  evidence, distinguish F_D/F_P/F_H and stale/mismatch posture, and invoke only
  reactions lawful for one source-attributed Attention Item.
closure_law: >-
  Close when positive claims require matching admitted evidence, process exit
  cannot turn the matrix green, revision/proof mismatches remain visible, and
  reaction success/failure is replayable without silent repair.
evaluation_criteria:
  - Required gate and asset semantics retain product/domain source refs.
  - Every satisfied/delivered state has matching revision and evidence.
  - F_H cannot override F_D failure.
  - Attention items preserve source, severity, correlation, freshness, and bounded reactions.
  - Drilldown reaches existing forensic evidence without losing build context.
proof_surface:
  - build_tenants/react_vite/src/capabilities/assurance-attention/
  - build_tenants/react_vite/runtime/tests/
  - build_tenants/react_vite/tests/e2e/
  - odd_glc data-mapper gate and asset proof
non_closure_conditions:
  - A green build badge substitutes for the assessed matrix.
  - Process exit or log text closes a gate.
  - Attention dismissal mutates source truth.
  - Evidence from another revision or build is silently reused.
---

# T-038: Assurance And Attention MVP

This ticket owns W21 after build/run correlation and the portfolio are live.

## Execution Refinement 2026-07-11

Assurance consumes the canonical Build Execution and its adapter-published
evidence bundle. The first catalog binding is
`<Project>/.odd/assurance-catalog.json`; it must agree with the admitted Build
Carrier Descriptor refs. No process output, terminal state, or view state is an
evidence adapter.

The manager implementation and dynamic fixture proof may proceed while odd_glc
carrier work remains open. T-038 live odd_glc closure and T-039 steel-thread
closure cannot cite fixture evidence.

## Manager Implementation Evidence 2026-07-11

- Added the runtime-validated Assurance Catalog and Build Evidence Bundle
  contracts plus derived Gate Assessment, Asset Delivery, Assurance Summary,
  snapshot, and Attention Item contracts shared by browser and server.
- Added one fixed Project catalog binding at
  `.odd/assurance-catalog.json`. Product and descriptor catalog refs must agree;
  missing, empty, malformed, duplicate, and mismatched catalogs fail honestly.
- Extended the adapter boundary with one execution/revision-bound evidence
  bundle and server-owned evidence files. Positive rows require matching
  execution, Project, revision, evidence key, evidence refs, and SHA-256 digest.
- Added one read-only assessment service. It derives required/expected,
  missing, satisfied/delivered, failed, stale, unsupported, and waiting-human
  posture and Attention Items without mutating source truth.
- Added one State/Msg/Update/Cmd capability with stale/late guards, matrix and
  Attention modes, evidence/source detail, refresh, selection, and a
  catalog-bounded Run Inspector reaction. The reaction changes navigation only.
- Portfolio consumes the downstream assurance/attention projection and owns no
  assessment logic.

## Verification 2026-07-11

- Assessment service proof covers converged-without-evidence, complete verified
  evidence, digest mismatch, evidence-key reassignment, evidence revision
  mismatch, F_D failure with F_H waiting, source revision drift, and missing
  catalog.
- Msg replay covers load, selection, reaction admission, reaction consumption,
  duplicate Context during an in-flight load, stale basis, and late Project
  rejection.
- Playwright proves missing evidence after process convergence, fully verified
  gates/assets, digest mismatch, persistent blocking Attention, Run Inspector
  drill/return, and desktop/mobile containment.
- TypeScript contracts and production build pass. Screenshots were inspected
  with no overlap, width escape, or unreadable identity detail.

## Scenario Completion Audit 2026-07-11

- Portfolio and Assurance source actions now route through named commands and
  preserve exact Attention/build identity rather than relying on placement
  state.
- The Run Inspector deep link carries one bounded forensic focus envelope:
  execution, run reference, source revision, and evidence source. The Sidecar
  retains that envelope even when the observed Project has no admitted run.
- Forensic entry collapses supporting panes so the context strip remains
  visible; ordinary navigation clears the focus parameters and restores normal
  Run Inspector behavior.
- Browser proof asserts URL identity, visible forensic context, return to the
  same Assure state, and clearing on generic navigation. The final screenshot
  is visually contained and passes the compositor pixel check.

## Remaining Closure Gate

The manager boundary was ready for operator review. odd_glc had not published
its Build Carrier Descriptor, Assurance Catalog, or standard adapter evidence
bundle, so this slice did not claim live data-mapper assurance.

## Prime-Set Compression 2026-07-11

The manager-owned assurance and attention slice is accepted: positive claims
require matching evidence, F_D/F_H posture remains lawful, mismatches stay
visible, and forensic navigation preserves build context. This ticket is
completed by compression without claiming live odd_glc assurance. Publication
of the product catalog and evidence bundle remains visible only on T-032.
