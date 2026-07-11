---
id: T-034
title: Deliver the Build Portfolio and Project Workbench MVP
type: feature
ticket_category: ordinary
status: completed
review_status: accepted
proof_status: verified_by_automation
goal: G-006
source_ticket: T-032
sprint: SPRINT-2026-07-10-abg46-observation-reprice
build_tenant: react_vite
owner: codex
change_intent: >-
  Deliver W17 MVP 1: a dense cross-Project portfolio and a goal-oriented
  Project Workbench that frame Review, Tune, Build, and Assure over one shared
  Context.
change_class: design_reframe
re_entry_point: react_vite_capability_design
affected_boundary: Build Portfolio and Project Workbench capability modules, Sidecar Project Browser retirement, Project registry and revision/readiness projection, navigation, deep links, runtime and browser proof
priority: high
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-11T19:57:31+10:00
dependencies:
  - T-033
governance_scope: STDO-UX, REQ-OM-DEV-*, REQ-OM-CAP-*
target_truth: >-
  A developer can assess and prioritize multiple registered Projects without
  changing active Context, then enter one Project Workbench while preserving
  identity, revision, readiness, freshness, attention, and supporting
  observation context.
closure_law: >-
  Close when the portfolio and workbench meet REQ-OM-DEV-* through their own
  capability modules, Project deep links land in the workbench, and replay plus
  browser proof establishes multi-Project isolation and coherent drilldown.
evaluation_criteria:
  - Portfolio rows expose Project identity, revision, readiness, build/run summary, assurance, freshness, participants, and attention where available.
  - Missing capability inputs remain explicit.
  - Project Workbench composes Review, Tune, Build, and Assure without copying capability state.
  - Supporting AI Workspace, Run Inspector, files, tickets, and shells preserve originating Context.
  - Cross-Project late results are rejected.
proof_surface:
  - build_tenants/react_vite/src/capabilities/build-portfolio/
  - build_tenants/react_vite/src/capabilities/project-workbench/
  - build_tenants/react_vite/runtime/tests/
  - build_tenants/react_vite/tests/e2e/
non_closure_conditions:
  - The Project selector is presented as the portfolio.
  - The workbench becomes another monolithic state or service owner.
  - Readiness or attention lacks source references.
  - Deep links still default to a supporting observation tab.
---

# T-034: Build Portfolio And Project Workbench MVP

T-033 is accepted and closed. This ticket owns W17 and no proposal or build
mutation behavior.

## Operator Refinement 2026-07-11

The Sidecar Project Browser was an early Project Workbench. Its cross-Project
discovery, registry, selection, and activation responsibilities move into Build
Portfolio. The migration removes the Sidecar provider and its registry command
family rather than leaving duplicate selectors. Sidecar Browse remains
Project-local; Recent Paths retains only an explicit handoff to an already
registered historical Project.

The re-entry point is tenant capability design because ownership changed while
the W14 requirements remained stable.

## Implementation Evidence 2026-07-11

- Added one runtime-validated Build Portfolio projection over every maintained
  Project. Rows preserve Project/ref identity, admitted Git revision and dirty
  posture, specification/build/run/assurance posture, participant observation,
  freshness, and source-attributed attention.
- Replaced the structural portfolio shell with a dense operational table,
  filtering, ordering, row focus, source detail, and explicit Open/Remove
  actions. Row focus does not change Context.
- Moved candidate filesystem browsing, registry registration/removal, and
  explicit activation into the Build Portfolio State/Msg/Update/Cmd boundary.
  All effects cross the shared correlated command runtime.
- Removed the Projects provider, Project Browser JSX, cross-Project browse
  state, registry commands, project-browser tree controls, and associated CSS
  from Sidecar. Sidecar Browse remains Project-local.
- Kept Project Workbench as the goal-oriented Project deep-link landing and
  preserved supporting AI Workspace, Run Inspector, tickets, files, and shell
  navigation through the host.
- Fixed the Add Project load race: opening the browser while the portfolio root
  is still loading resumes the browse command after root admission.
- Excluded the local contracts package from Vite dependency prebundling so the
  browser and Node adapters consume the current built schema during iterative
  development.

## Verification 2026-07-11

- `npm run test:runtime:node`: 223/223 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; the existing large-chunk warning remains.
- `npx playwright test`: 38/38 passed on isolated API/client ports.
- The exact live `127.0.0.1:5175/?project=...odd_glc` deep link rendered four
  portfolio rows with no console/page errors and no Projects affordance in
  Sidecar.
- Desktop 1600x1100 and mobile 390x844 Workbench and Add Project states were
  visually inspected. Body width stayed viewport-contained; the portfolio
  table and Project browser use bounded internal scrolling.
- `git diff --check`: passed.

## Scenario Completion Audit 2026-07-11

- Portfolio Attention rows now publish one `portfolio.open-attention` command
  through the capability registry instead of leaving source refs as inert text.
- The host activates the exact Project and routes build/execution sources to
  Build, assurance sources to Assure, and specification/revision sources to
  Tune. Where a concrete execution or Attention Item exists, it is selected by
  identity.
- Browser proof enters the real odd_glc Project through its missing-carrier
  Portfolio Attention row and arrives at the Build phase with the product-owned
  unavailable reason intact.

## Review Boundary

This is W17 MVP 1. Build execution remains honestly unavailable, run posture is
unobserved where no admitted active/recent build carrier exists, and proposal,
single-build, concurrency, and evidence-grade assurance remain T-035 through
T-039 work.

## Prime-Set Acceptance 2026-07-11

Accepted. The closure law is met by the one Build Portfolio and Project
Workbench ownership boundary, Project deep-link landing, multi-Project
projection, stale-result guards, and replay/browser proof. Ongoing integrated
product and live-carrier work is owned by T-032 rather than keeping this
completed capability slice active.
