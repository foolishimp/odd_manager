# T-002 Establish Process View Workbench

- id: T-002
- type: feature
- status: active
- goal: control-surface-reprice
- change_class: product_reprice
- reentry: product -> requirements -> design -> scenarios -> implementation
- priority: high
- dependencies: T-001
- created_at: 2026-04-13
- updated_at: 2026-04-13

## Context

`Process View` is now a distinct top-level page in `odd_manager`, but it is
still only a baseline surface. It should become the technical execution lens
for tech leads, architects, developers, and technical testers.

The page must not be a second copy of `Requirements View`, and it must not
collapse into a raw runtime log. It should start from process flow and lawful
execution state, then let operators inspect the technical reality of work in
motion, blocked handoffs, runtime evidence, and affected requirements.

The renamed `Process Flow Map` is now the correct entry point for this page. It
replaces the earlier `Bootstrap Asset Graph` framing. The map should remain the
top process lens, but the rest of the page must help operators answer:

- what is running or changing now
- what is blocked, and why
- what can happen next
- which artifacts are consumed or produced
- which requirements are affected by this process step
- what proof exists from runtime, qualification, and test surfaces

The page should reuse the same broad widget family as `Requirements View`
wherever the concern is shared, but it must be process-framed rather than
requirement-framed. The framing object here is the active process object:

- workflow step
- graph function
- workorder
- runtime run
- blocker
- handoff edge
- produced artifact

The page should follow the same explicit parent-child control hierarchy that is
working in `Requirements View`:

- one parent `Process Navigator`
- one top `Process Flow Map`
- one left `Process Explorer`
- one right `Process Workbench`
- inline detail within the workbench rather than orphan inspector panels

The page must preserve the methodology authority chain. Process inspection is
downstream of `INTENT.md`, `PRODUCT.md`, `GOALS.md`, requirements, and design.
It should show those governing surfaces where they constrain a step, but it
must not replace them with runtime paraphrase.

## Acceptance

- `Process View` is defined as the technical execution lens for tech leads,
  architects, developers, and technical testers.
- The page starts from `Process Flow Map` as the primary entry surface for the
  technical process lane.
- The page is not implemented as a second requirements dashboard and is not
  implemented as a raw event log.
- The page uses one parent `Process Navigator` surface with explicit hierarchy
  over its child explorer and workbench surfaces.
- The page uses one left `Process Explorer` and one right `Process Workbench`
  beneath the parent navigator, with the selected process object remaining the
  framing object for the right-hand pane.
- The page keeps drilldown inline within the process workbench rather than
  creating orphan context panels that compete with the selected process object.
- The top-level saved views for `Process Navigator` are tracked explicitly and
  include at least:
  - `Active Work`
  - `Blocked / Waiting`
  - `Ready for Handoff`
  - `Recent Failures`
  - `Recent Activity`
  - `Tests / Qualification`
- The page has a primary `Process Explorer` that lists technical process
  objects rather than requirement rows.
- The `Process Explorer` supports search, filtering, and bounded scrolling over
  technical process objects.
- The `Process Workbench` includes a `Step Summary` widget that explains the
  selected process object, current status, and next lawful action.
- The `Process Workbench` includes an `Inputs` widget exposing required
  artifacts, source surfaces, and upstream handoffs.
- The `Process Workbench` includes an `Outputs` widget exposing produced
  artifacts, records, and downstream handoff surfaces.
- The `Process Workbench` includes a `Requirement Impact` widget exposing which
  requirements are realized, affected, or blocked by the selected process
  object.
- The `Process Workbench` includes a `Governing Surfaces` widget exposing
  intent, product, goals, requirements, design, and policy surfaces that
  constrain the selected process object.
- The `Process Workbench` includes an `Implementation Surface` widget exposing
  linked modules, code surfaces, and implementation claims.
- The `Process Workbench` includes a `Test Authority` widget exposing linked
  testcase authority, test design, qualification, and acceptance surfaces.
- The `Process Workbench` includes a `Latest Execution` widget exposing the
  latest runtime run, result, delta, failure, and evidence for the selected
  process object when that evidence exists.
- The `Process Workbench` includes an `Open Blockers` widget exposing
  ambiguities, missing capabilities, and fail-closed conditions affecting the
  selected process object.
- The `Process Workbench` includes a `Delivery Records` widget exposing linked
  tickets, comments, decisions, and handoff notes without collapsing ticket
  authority into the comment layer.
- The page prioritizes technical situational awareness in this rough order:
  `Process Flow Map`, `Blocked / Waiting`, `Active Work`, `Process Workbench`,
  `Latest Execution`, `Test Authority / Test Results`, `Requirement Impact`.
- Shared widgets are reused from the same family established for
  `Requirements View` wherever the underlying concern is the same, but the page
  remains process-framed rather than requirement-framed.
- The page preserves the ticket/comment authority split from the methodology:
  tickets remain durable work authority and comments remain discussion and
  publication.

## Links

- related ticket: `.ai-workspace/tickets/active/T-001-establish-requirements-view-workbench.md`
- product: `specification/PRODUCT.md`
- requirements: `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`
- design: `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- route: `build_tenants/react_vite/src/routes/WorkspaceRoute.tsx`
- graph view: `build_tenants/react_vite/src/features/graphs/GraphWorkspace.tsx`
- methodology: `/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_METHOD.md`
- spec guide: `/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_GUIDE.md`
- ticket method: `/Users/jim/src/apps/specification_methodology/specification/standards/TICKET_METHOD.md`
