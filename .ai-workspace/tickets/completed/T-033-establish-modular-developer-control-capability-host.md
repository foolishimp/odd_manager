---
id: T-033
title: Establish the modular developer-control capability host
type: feature
ticket_category: ordinary
status: completed
review_status: accepted
proof_status: verified_by_automation
goal: G-007
source_ticket: T-032
sprint: SPRINT-2026-07-10-abg46-observation-reprice
build_tenant: react_vite
owner: codex
change_intent: >-
  Build the W16 structural capability foundation so developer-control
  capabilities can iterate independently through one shared Context, command
  membrane, navigation model, and evidence world.
change_class: realization_refactor
re_entry_point: react_vite_realization
affected_boundary: >-
  React application/Sidecar composition, internal shared contracts package,
  capability host and registry, command runtime, capability module shells,
  Project deep-link landing, Run Observation adapter, replay and dependency
  proof
priority: critical
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-11T14:57:47+10:00
dependencies:
  - T-032 W15 design admission
governance_scope: STDO-UX, Developer Control Capability Architecture, ADR 0003
target_truth: >-
  The React tenant composes Build Portfolio, Project Workbench, Specification
  Proposal, Build Control, Assurance and Attention, and Run Observation as
  separate capability modules through one pure host reducer and one typed
  command/subscription runtime. Existing AI Workspace and Run Inspector truth
  remains available through Run Observation. Proposal and Build actions remain
  explicitly unavailable until their constructive carriers are admitted.
closure_law: >-
  Close only when the capability host, shared runtime-validated contract
  package, module shells, command membrane, Project Workbench deep-link landing,
  existing observation adapter, module replay, integration replay, dependency
  checks, and browser proof are present without introducing a replacement
  monolith or claiming functional MVP completion.
evaluation_criteria:
  - Every capability has a public module entry and owned State, Msg, Update, Cmd, Sub, contribution, view, and local proof surface.
  - The host owns Context, registration, command correlation, subscriptions, and navigation but no capability-domain decisions.
  - Browser and Node server adapters consume one built runtime-schema contract package.
  - Capability-to-capability internal imports fail a structural test.
  - Project-only deep links open the Project Workbench.
  - AI Workspace, Run Inspector, Traversal, tickets, files, and shells remain reachable without duplicated truth.
  - Specification Proposal and Build Control render exact unavailable reasons and expose no constructive command.
  - Current T-031 runtime, type, build, and browser proof remains green.
proof_surface:
  - build_tenants/common/design/DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md
  - build_tenants/react_vite/design/adr/0003-modular-capability-host-and-command-membrane.md
  - build_tenants/react_vite/design/capabilities/
  - build_tenants/react_vite/packages/developer-control-contracts/
  - build_tenants/react_vite/src/capabilities/
  - build_tenants/react_vite/src/effects/command-runtime/
  - build_tenants/react_vite/runtime/tests/
  - build_tenants/react_vite/tests/e2e/
non_closure_conditions:
  - Capability modules are presentation wrappers over one shared Sidecar state or mutable service center.
  - The host branches on proposal, build, assurance, or runtime domain meaning.
  - New developer-control state or commands are added to SidecarPanel.tsx.
  - A proposal or Build control is enabled without its admitted carrier.
  - Existing observation behavior regresses or is copied into a second projection path.
  - Structural availability is represented as functional MVP completion.
---

# T-033: Modular Developer-Control Capability Host

## Triage

The product, requirements, common design, tenant ADR, and capability modules now
govern this boundary. The first missing layer is tenant realization.

## Execution Order

1. Create and build the shared runtime-schema contract package.
2. Implement host State/Msg/Update/Cmd/Sub and command runtime.
3. Register capability shells with explicit availability.
4. Adapt current Run Observation and supporting tools through public module
   contributions.
5. Make Project Workbench the Project deep-link landing.
6. Add module replay, integration replay, dependency, runtime, and browser
   proof.

This ticket establishes structure only. T-034 through T-039 own functional
MVPs.

## Implementation Evidence 2026-07-11

- Added the built `@odd-manager/developer-control-contracts` Zod package and
  made browser and Node adapters consume the same runtime schemas.
- Added pure host Context, registration, command-correlation, subscription,
  navigation, stale-Project, and stale-revision admission boundaries.
- Added separate Build Portfolio, Project Workbench, Specification Proposal,
  Build Control, Assurance and Attention, and Run Observation modules. Each
  owns public State, Msg, Update, Cmd/Sub, selector, contribution, and view
  surfaces.
- Composed the Project Workbench above the existing Sidecar. No new
  developer-control state or command entered `SidecarPanel.tsx`.
- Changed Project-only deep links to Project Workbench while retaining explicit
  AI Workspace, Run Inspector, Tickets, files, and shell access.
- Proposal and Build remain unavailable with exact missing-carrier reasons,
  no action button, and no command-producing reducer path.
- Added Git Project revision observation and Project/revision-basis rejection
  for late Context and subscription events.

## Verification 2026-07-11

- `npm run build`: passed; existing Vite chunk-size warning remains.
- `npm run test:runtime:node`: 225/225 passed.
- `npx playwright test`: 40/40 passed on isolated API/client ports.
- The exact live `127.0.0.1:5175/?project=...odd_glc` deep link was exercised
  in Chromium after refreshing the 4175 API; Project Workbench rendered with
  admitted Context and no console/page errors.
- Desktop and 390x844 Playwright screenshots were visually inspected.
- Mobile proof measures viewport containment and asserts that the capability
  ledger does not overlap the supporting Run Observation surface.
- Dependency proof rejects capability-internal cross-imports and confirms the
  host composes public module entries only.
- Proposal/Build negative proof confirms no constructive button or command is
  present.

## Review Boundary

This is structural Wave 1 only. Portfolio enrichment, proposals, builds,
concurrency, and evidence-grade assurance remain owned by T-034 through T-039.
The current data-mapper harness is not exposed as a Build carrier.

## Operator Acceptance 2026-07-11

The operator advanced execution into W17 and refined the remaining ownership
boundary: the Sidecar Project Browser was an early workbench and now belongs in
the Build Portfolio contribution. That direction accepts the W16 host boundary
and closes this structural ticket; the migration itself is owned and proved by
T-034.
