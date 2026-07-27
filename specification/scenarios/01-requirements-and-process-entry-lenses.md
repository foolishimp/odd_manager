# Requirements And Process Entry Lenses

**Status**: Active
**Derives From**:
- `specification/PRODUCT.md`
- `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

## Purpose

This scenario bundle proves the operational meaning of the delivery-oriented
entry lenses.

It tests that `odd_manager` can present one shared project reality through both
a requirement-first and a process-first framing without creating dead-end
widgets, disconnected truth, or rival work-tracking authority.

## SCN-OM-LNS-001 - BA inspects one requirement end to end

Actor: business analyst or product manager

Sequence
- open `Requirements View`
- search or filter the requirement explorer
- select one human-readable requirement
- inspect its summary and acceptance material
- drill into linked design surfaces
- drill into linked implementation surfaces such as modules or code carriers
- inspect testcase authority and any available test execution results
- inspect linked tickets or bugs
- inspect linked OddBoard discussion without confusing comments with ticket
  status authority

Expected outcomes
- the operator stays inside one requirement-framed workbench
- each visible object and total can open richer detail or an authoritative
  source surface
- the operator can determine whether the requirement is specified, implemented,
  proved, blocked, or still open

## SCN-OM-LNS-002 - Scrum master starts from process activity

Actor: scrum master or delivery lead

Sequence
- open `Process View`
- start from Project Portfolio attention, build activity, process flow, or
  execution posture in the Project Workbench
- select the relevant process focus
- inspect the linked requirement, design, implementation, proof, ticket, and
  discussion surfaces through the shared widget family
- open Run Inspector when graph, traversal, event, transcript, artifact, or
  proof forensics are required
- compare the process-selected view with the corresponding requirement-selected
  view for the same underlying concern

Expected outcomes
- `Process View` acts as a distinct entry lens rather than as a duplicate page
- Project Workbench remains the goal-oriented composition surface while Run
  Inspector remains a supporting forensic capability
- the shared widget family remains recognizable and reusable across both entry
  lenses
- process-first filtering does not create a second truth model or a second
  ticket/comment authority model

## Significant Paths

- success path: both entry lenses can reach the same underlying requirement,
  design, implementation, proof, and work-tracking surfaces
- authority path: tickets remain durable work authority while comments remain
  discussion/publication
- drilldown path: visible totals and rows remain drillable rather than dead-end
  text
- divergence path: entry-lens-specific filtering changes framing without
  changing the underlying object truth

## Executable Proof Bindings

Each row is one written testcase authority. `Scenario proof` means the named
composed-product test directly asserts only the bounded case in that row; it
does not promote the whole requirement or family. A gap or deferment is not an
executable proof claim.

| Scenario | Requirement | Requirement-specific authority case | Proof posture | Proof selector or gap |
| --- | --- | --- | --- | --- |
| `SCN-OM-LNS-001` | `REQ-OM-LNS-001` | Show that requirement-first and process-first lenses project the same selected requirement identity and source truth | Deferred | none — no requirement-first realization outcome or admitted carrier is selected |
| `SCN-OM-LNS-001` | `REQ-OM-LNS-002` | Enter Requirements View from a human-readable requirement and keep that requirement as the primary frame through drill-down | Deferred | none — no requirement-first realization outcome or admitted carrier is selected |
| `SCN-OM-LNS-001` | `REQ-OM-LNS-004` | Reuse the same widget contract across both entry lenses without copying an independent truth model | Deferred | none — no cross-domain requirement carrier is installed for this widget family |
| `SCN-OM-LNS-001` | `REQ-OM-LNS-007` | Expose specification, design, implementation, proof, and work posture from one selected requirement | Deferred | none — no requirement-first realization outcome or admitted carrier is selected |
| `SCN-OM-LNS-001` | `REQ-OM-LNS-009` | Keep board and session tools reachable while a requirement remains the primary work frame | Deferred | none — no requirement-first realization outcome or admitted carrier is selected |
| `SCN-OM-LNS-002` | `REQ-OM-LNS-003` | Traverse Review, Tune, Build, and Assure from process activity while preserving one selected Project basis | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: integrated Review Tune Build Assure journey preserves one revised Project basis across concurrent work` |
| `SCN-OM-LNS-002` | `REQ-OM-LNS-005` | Collapse and restore independent supporting sections without losing their selected Project context | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts :: sidecar sections minimize and restore independently` |
| `SCN-OM-LNS-002` | `REQ-OM-LNS-006` | Open an actionable portfolio attention total into its admitted Tune, Build, or Assure target | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: portfolio attention names and opens its admitted Tune, Build, or Assure target` |
| `SCN-OM-LNS-002` | `REQ-OM-LNS-008` | Compare ticket status authority with comment discussion from the same process-selected concern | Executable proof gap | none — no composed-product testcase compares ticket and comment authority in one delivery view |
| `SCN-OM-LNS-002` | `REQ-OM-LNS-010` | Resolve a registered Project identity to its non-empty Project Workbench landing surface | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: project-only deep link opens the modular developer Project Workbench` |
