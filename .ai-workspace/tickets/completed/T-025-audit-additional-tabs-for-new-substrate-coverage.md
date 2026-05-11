---
id: T-025
title: Audit additional odd_manager tabs for ABG 3.5 substrate coverage and decide per-tab disposition
type: spike
ticket_category: ui_substrate_alignment
status: completed
review_status: closed
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Produce a per-tab gap analysis covering every odd_manager workspace feature outside RuntimePanel / BuilderPanel / ProcessWorkspace, classify each tab's relationship to the ABG 3.5.0-rc.1 traced call-out substrate, and decide per tab whether it requires its own substrate-alignment ticket, can consume the carriers admitted by T-022 / T-023 / T-024 without further design, or is correctly out of scope.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: every workspace feature under `src/features/` outside runtime / builder / process; sidecar contract surface (read-only audit); produced output is one analysis document under `.ai-workspace/comments/claude/`
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
  - T-022 carrier shape draft (does not require T-022 implementation completion; the carrier shape alone is sufficient)
  - T-026 carrier shape draft (LiveModuleProjection / LiveOpRunProjection); audit can run in parallel with T-026 implementation
intake_source: Audit of `src/features/` lists nine non-substrate panels (`home`, `inspector`, `graphs`, `world-model`, `oddboard`, `oddterm`, `requirements`, `project-selector`, `sidecar`) plus the three already in scope (runtime, builder, process). Without an explicit per-tab disposition, three risks land: an additional tab quietly drifts past the substrate update; or each tab sprouts its own ad-hoc substrate-awareness logic instead of consuming a typed carrier; or out-of-scope tabs accumulate cargo-cult substrate references they do not need.
target_truth: One analysis document classifies every non-substrate-scoped panel against the ABG 3.5.0-rc.1 substrate plus the TypeScript-tenant projection surface. Each panel is classified as `extension_required`, `consumes_carrier(<id>)`, or `out_of_scope`. The `<id>` parameter names the specific admitted carrier (e.g., `consumes_carrier(t022:traced_callout_evidence)`, `consumes_carrier(t026:live_module_projection)`, `consumes_carrier(t026:live_op_run_projection)`). Each `extension_required` classification produces a follow-up STDO ticket scoped to that panel. Each `consumes_carrier(...)` classification names the carrier and the consumption shape. Each `out_of_scope` classification names the reason.
superseded_truth: Three named panels (runtime, builder, process) carry substrate-awareness work in T-022 / T-023 / T-024; the rest drift unaudited.
closure_law: This ticket closes only when the per-tab analysis document is published under `.ai-workspace/comments/claude/`, every panel has a typed disposition, and any `extension_required` classification has either a follow-up backlog ticket admitted or an explicit deferral note with re-evaluation trigger.
evaluation_criteria:
  - one analysis document covers all panels under `src/features/` outside runtime/builder/process
  - per-panel classification uses the parameterized disposition vocabulary
  - each `extension_required` panel has a backlog ticket id admitted in odd_manager
  - each `consumes_carrier(<id>)` panel names the specific admitted carrier and the consumption shape (which fields from which carrier)
  - each `out_of_scope` panel names the reason and the trigger that would re-open the question
  - the analysis cites the source files inspected per panel
proof_surface:
  - one analysis document under `.ai-workspace/comments/claude/<timestamp>_REVIEW_odd-manager-tabs-substrate-coverage.md`
  - any follow-up backlog tickets created from the analysis
  - cross-references between this ticket and the follow-ups
non_closure_conditions:
  - panels classified by panel name without inspecting source
  - `extension_required` classification without a follow-up ticket id
  - `out_of_scope` classification without a re-evaluation trigger named
  - the analysis document conflates "currently shows no substrate detail" with "should show no substrate detail"
  - audit lifts substrate awareness into a panel without going through the AssetSurface carrier admitted by T-022 / T-023 / T-024
---

# T-025: Audit Additional odd_manager Tabs For New-Substrate Coverage

## Completion Update — 2026-05-05 Codex

Closed.

Published audit:

- `.ai-workspace/comments/claude/20260504T230000Z_REVIEW_odd-manager-tabs-substrate-coverage.md`

Follow-up backlog tickets admitted from the audit:

- T-027 — decorate oddterm session headers with `t022:traced_callout_evidence.by_terminal_session_id`
- T-028 — surface odd_sdlc TypeScript install health in the project selector
- T-029 — retire legacy workspace-route panels and consolidate on the sidecar

The audit now uses admitted follow-up ticket ids instead of proposed/reserved ids.

## STDO Triage

### First Missing Layer

Realization.

T-022 / T-023 / T-024 cover three high-impact panels. Nine other panels
exist. Without a per-panel disposition the substrate update silently
leaves them stale or accumulates duplicated awareness logic. The missing
layer is the audit step itself.

### Lawful Change Class

`realization_refactor`. No new carrier is introduced by this ticket; the
output is an analysis document plus follow-up tickets, scoped to existing
panels.

## Panels In Scope

```
src/features/
  home/
  inspector/
  graphs/
  world-model/
  oddboard/
  oddterm/
  requirements/
  project-selector/
  sidecar/
```

`runtime/`, `builder/`, and `process/` are out of scope here (covered by
T-022 / T-023 / T-024).

## Disposition Vocabulary

Each panel receives exactly one of:

- `extension_required` — panel requires substrate or projection awareness
  that cannot be satisfied by the carriers admitted by T-022 / T-024 /
  T-026 (T-023 is deferred and out of this sprint). Triggers a follow-up
  backlog ticket.
- `consumes_carrier(<id>)` — panel can render the relevant evidence by
  reading an admitted carrier. The `<id>` parameter names the specific
  carrier and version, for example:
  - `consumes_carrier(t022:traced_callout_evidence)` — per-call ABG 3.5
    substrate evidence
  - `consumes_carrier(t026:live_module_projection)` — live published TS
    Module catalog (executives + leaves + library)
  - `consumes_carrier(t026:live_op_run_projection)` — live op-run overlay
    (per-leaf status + assurance vector + trace archive ref)
  - `consumes_carrier(t024:per_edge_outcome)` — per-edge `latest_outcome`
    + `executor_profile` projection
- `out_of_scope` — panel does not interact with the ABG/odd_sdlc
  substrate and should not. Names the reason (e.g., project selection,
  terminal rendering, file browsing) and the re-evaluation trigger.

The vocabulary is parameterized so the audit does not need rewriting if
additional carriers are admitted in subsequent waves.

## Implementation Slices

1. Inspect each panel's source to determine its current data surface.
2. Identify what substrate evidence (if any) the panel naturally surfaces.
3. Classify per disposition vocabulary.
4. For each `extension_required` panel, draft a backlog ticket. Initial
   T-IDs reserved: T-027, T-028, T-029 (T-026 is now in active scope as
   the Process Navigator structural rebuild). Allocate sequentially if
   more are required.
5. For each `consumes_carrier(<id>)` panel, produce a one-paragraph
   consumption shape note inside the analysis document naming the
   specific carrier and fields read.
6. For each `out_of_scope` panel, name the reason and trigger.
7. Publish the analysis under
   `.ai-workspace/comments/claude/<timestamp>Z_REVIEW_odd-manager-tabs-substrate-coverage.md`.

## Closure Criteria

- analysis document published with all nine panels classified
- every `extension_required` classification has a follow-up backlog ticket
- every `consumes_*` classification names the specific fields read
- every `out_of_scope` classification names the re-evaluation trigger
- the document cites the source files inspected per panel

## Non-Closure Statement

T-025 is not closed by listing the nine panels with one-line tags. It
closes only when each panel has a typed disposition, evidenced by source
inspection, and follow-up tickets exist for every panel that requires
work beyond consuming the T-022 / T-023 / T-024 carriers.
