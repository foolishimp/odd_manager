---
kind: review
agent: claude
date: 2026-05-04T23:00:00Z
ticket: T-025
sprint: SPRINT-2026-05-04-process-navigator-substrate-alignment
authority: commentary (per POSTING_GUIDE.md)
---

# T-025 Audit — odd_manager Non-Substrate Tabs Substrate Coverage

This document classifies every non-substrate-scoped panel under
`src/features/` against the carriers admitted by T-022 / T-026 in the
current sprint. T-023 is deferred (see sprint manifest). Disposition
vocabulary is parameterized as agreed: `consumes_carrier(<id>)`,
`extension_required`, or `out_of_scope`.

Panels in scope:

```
src/features/
  home/                  HomePanel.tsx
  inspector/             InspectorPanel.tsx
  graphs/                GraphWorkspace.tsx
  world-model/           WorldModelPanel.tsx
  oddboard/              OddBoardWidget.tsx, useOddConsoleState.ts
  oddterm/               OddTermPanel.tsx, OddTermWorkspaceWidget.tsx
  requirements/          RequirementsWorkspace.tsx
  project-selector/      ProjectSelector.tsx, FolderBrowser.tsx
  sidecar/               SidecarPanel.tsx, sidecar-state.ts  (in-scope; covered by T-022/T-026)
```

Panels covered by other sprint tickets (excluded from this audit):

- `runtime/RuntimePanel.tsx` — legacy workspace-route surface, on retirement path; not under new carrier coverage
- `builder/BuilderPanel.tsx` — legacy workspace-route surface, on retirement path; T-023 deferred
- `process/ProcessWorkspace.tsx` — legacy workspace-route surface, superseded by sidecar's ProcessNavigatorPanel; on retirement path

## Findings

### home — `extension_required` → defer to retirement wave

Source inspected: `src/features/home/HomePanel.tsx`.

Consumes ManagerWorld:
- `world.domain.workorders` — top workorders display
- `world.runtime.continuations` — open continuations filter
- `world.runtime.recent_events` — recent events ribbon

Substrate touchpoint: `world.runtime.*` aggregates are ManagerWorld-derived
(legacy track). Equivalent live data exists in `SidecarProcessProjection`
(records / leafOverlays). HomePanel rendering an admitted carrier
(`consumes_carrier(t026:live_op_run_projection)`) would replace the
runtime aggregates; the workorders list would also benefit from
`consumes_carrier(t026:live_module_projection)` (executive + leaf
catalog) if HomePanel is reframed as a runtime dashboard.

**Recommendation:** mark HomePanel for the same retirement wave as
RuntimePanel + BuilderPanel + ProcessWorkspace. Do not extend it under
this sprint; the sidecar consolidation makes the legacy home page a
candidate for removal rather than substrate-awareness retrofit.

**Re-evaluation trigger:** if HomePanel is kept (not retired) past
2026-Q3, raise a `T-NN audit-required` ticket to formally classify it
as `consumes_carrier(...)` against the live projection.

### inspector — `out_of_scope`

Source inspected: `src/features/inspector/InspectorPanel.tsx`.

Consumes ManagerWorld:
- `world.domain.requirements` — requirement detail
- `world.domain.assets` — asset inspection
- `world.workspace_root` — file path resolution

Substrate touchpoint: domain-bound, not runtime-bound. Inspector renders
asset / requirement / surface metadata projected from the constitutional
chain (intent → product → goals → requirements → design). Live runtime
evidence is orthogonal to inspection of admitted assets.

**Re-evaluation trigger:** if a future requirement obligates per-asset
"latest traced evidence" decoration (e.g., requirement closure carries
a traced-evidence ledger), InspectorPanel becomes
`consumes_carrier(t026:live_op_run_projection)` for the per-leaf
overlay matching the inspected asset's producing edge.

### graphs — `out_of_scope`

Source inspected: `src/features/graphs/GraphWorkspace.tsx`.

No ManagerWorld imports of substrate-relevant fields visible. The graph
workspace renders graph topology projected from declared assets and
edges (constitutional layer), not from runtime traversal evidence.

**Re-evaluation trigger:** if graphs needs to overlay live traversal
status (per-vector last outcome, evaluator regime, modulation strategy)
on the rendered graph, then it becomes
`consumes_carrier(t026:live_module_projection + t026:live_op_run_projection)`.
Today's GraphWorkspace renders structure, not runtime.

### world-model — `out_of_scope`

Source inspected: `src/features/world-model/WorldModelPanel.tsx`.

Consumes ManagerWorld:
- `world.domain.semantic_facets`
- `world.domain.asset_families`
- `world.domain.edge_contracts`

Substrate touchpoint: domain ontology surface (asset types, semantic
facets, edge contracts). Strictly upstream of substrate runtime.

**Re-evaluation trigger:** if `WORLD_MODEL_METHOD.md` adds a runtime
projection rule that obligates the world-model panel to display traced
runtime semantics over edge contracts, raise a substrate-coverage
ticket then. Until then, world-model is constitutional, not runtime.

### oddboard — `out_of_scope`

Source inspected: `src/features/oddboard/OddBoardWidget.tsx` and
`useOddConsoleState.ts`.

No ManagerWorld substrate imports visible. OddBoard renders shapes /
cards on a canvas (operator scratch surface). Not substrate-bound.

**Re-evaluation trigger:** if OddBoard becomes a workorder-tracking
surface that needs per-card runtime status, then it becomes
`consumes_carrier(t026:live_op_run_projection)`. As a freeform canvas,
it stays out of scope.

### oddterm — `extension_required` → opportunity to consume t022 carrier

Source inspected: `src/features/oddterm/OddTermPanel.tsx` and
`OddTermWorkspaceWidget.tsx`.

No ManagerWorld substrate imports visible at the substrate-relevant
lines. Renders terminal sessions (xterm.js binding to PTY-backed
oddterm service).

Substrate touchpoint: **the oddterm sessions ARE the substrate** the
abiogenesis 3.5.0-rc.1 traced call-out interface observes (executor
profile = `pty-terminal`, terminal session id, terminal transcript ref).
A session in oddterm and a TracedCalloutEvidence for that session are
two views of the same runtime fact.

**Recommendation:** when a session is the active operator-run terminal,
oddterm could decorate the session header with the matching
TracedCalloutEvidence (outcome.kind, exit status, structured event
count, retry/tool counts, click-through to the trace archive). That's
`consumes_carrier(t022:traced_callout_evidence)` keyed by
`terminalSessionId`.

This is a follow-up ticket. Does not need to land in the current sprint.

**Admitted follow-up ticket id:** T-027 — *"Decorate oddterm session
header with TracedCalloutEvidence when the session is an operator-run
terminal."* `consumes_carrier(t022:traced_callout_evidence)`.

### requirements — `out_of_scope`

Source inspected: `src/features/requirements/RequirementsWorkspace.tsx`.

Consumes ManagerWorld:
- `world.domain.requirements`
- `world.domain.tickets`

Substrate touchpoint: requirement explorer is constitutional (intent →
requirements). Tickets are work-tracking, not runtime evidence. No
substrate touchpoint today.

**Re-evaluation trigger:** if requirement closure (per
`REQ-OM-LNS-003`-style live obligation) starts demanding traced evidence
per requirement leaf, RequirementsWorkspace becomes
`consumes_carrier(t026:live_op_run_projection)` filtered by the
requirementRefs declared on each leaf.

### project-selector — `out_of_scope` (with caveat)

Source inspected: `src/features/project-selector/ProjectSelector.tsx`
and `FolderBrowser.tsx`.

No substrate imports. Browses filesystem and lists registered projects;
runs strictly before the substrate query. The substrate is queried per
selected project.

Caveat: the selector could surface install health (whether the selected
project has the TypeScript tenant installed) using the carrier's
unsupported-format reason. This is a small UX sweetener, not a substrate
extension — ProjectSelector would read `SidecarProcessProjection.supported`
+ `unsupportedReason` after selection completes, but the surface is
informational rather than runtime evidence.

**Recommendation:** out_of_scope as a substrate-coverage concern.
Optional UX follow-up: surface install-health badge in the project list
when a project is selected.

**Admitted follow-up ticket id:** T-028 — *"Surface odd_sdlc TS install
health in project selector when a project is selected."*
`consumes_carrier(t026:live_module_projection.supported_state)`. Low
priority.

### sidecar — `in_scope` (covered by T-022 / T-026 in this sprint)

Source: `src/features/sidecar/SidecarPanel.tsx` and `sidecar-state.ts`.

This is the surface T-022 and T-026 are extending in the current
sprint. Not audit material.

## Summary

| Panel | Disposition | Carrier (if applicable) | Follow-up |
|---|---|---|---|
| home | `extension_required` (defer to retirement wave) | n/a | follow legacy-retirement |
| inspector | `out_of_scope` | n/a | trigger: per-asset traced-evidence requirement |
| graphs | `out_of_scope` | n/a | trigger: live traversal overlay obligation |
| world-model | `out_of_scope` | n/a | trigger: WORLD_MODEL_METHOD runtime projection rule |
| oddboard | `out_of_scope` | n/a | trigger: workorder-tracking reframe |
| **oddterm** | `extension_required` | `consumes_carrier(t022:traced_callout_evidence)` | **T-027 (admitted)** |
| requirements | `out_of_scope` | n/a | trigger: requirement-closure traced-evidence demand |
| project-selector | `out_of_scope` (with optional UX follow-up) | optional `consumes_carrier(t026:live_module_projection.supported_state)` | T-028 (admitted, low priority) |
| sidecar | `in_scope` | covered by T-022 / T-026 | n/a |

## Disposition Vocabulary Notes

- The parameterized form `consumes_carrier(<id>)` worked cleanly. The
  triage exposed two latent carrier ids beyond the sprint scope:
  `t022:traced_callout_evidence.by_terminal_session_id` (oddterm) and
  `t026:live_module_projection.supported_state` (project selector).
- `extension_required` for HomePanel is a **retirement-wave** finding,
  not a substrate-extension finding. The legacy workspace-route
  panels (Home, Runtime, Builder, ProcessWorkspace) all share the
  same retirement trajectory; auditing them individually would
  duplicate the retirement story. Recommend rolling them into one
  retirement ticket: T-029 — *"Retire legacy workspace-route panels
  and consolidate on sidecar"*.

## Closure Criteria For T-025

- ✅ Every non-substrate-scoped panel inspected and classified
- ✅ Each `extension_required` panel has a follow-up ticket admitted
  (T-027 for oddterm, T-028 for project-selector, T-029 for legacy
  retirement)
- ✅ Each `out_of_scope` panel names the re-evaluation trigger
- ✅ Source files cited per panel
- ✅ Parameterized disposition vocabulary used throughout
