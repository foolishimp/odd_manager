# T-001 Establish Requirements View Workbench

- id: T-001
- type: feature
- status: active
- goal: control-surface-reprice
- change_class: product_reprice
- reentry: product -> requirements -> design -> scenarios -> implementation
- priority: high
- created_at: 2026-04-13
- updated_at: 2026-04-13

## Context

`Requirements View` is now a dedicated top-level page in `odd_manager`, but it
is only a blank placeholder. The next step is to define it as a requirement-
framed workbench for business analysts, scrum masters, and product managers.

`Process View` is a distinct entry point over nearly the same underlying
information model. It should be driven by build activity, process flow, and
execution context rather than by a selected requirement, but it should reuse
the same widget family wherever possible. The product should avoid making
design, implementation, test, ticket, comment, and risk widgets artificially
requirements-only when those same widgets are also needed from a process/build-
activity lens.

The page must not behave like a dashboard of disconnected metrics. The primary
object is the requirement. Totals, summaries, and counts are only saved queries
over the requirement set.

The page must make the full downstream reality of a requirement inspectable:

- human-readable requirement text
- requirement history and change over time
- linked design surfaces
- linked modules and implementation surfaces
- linked tests, testcase authority, and scenario bundles
- eventual test runs and results
- linked bugs and tickets
- linked discussion and comments from OddBoard

This must align with the method surfaces rather than inventing rival product
law:

- requirements are the constitutional `what`
- design is the structural `how`
- testcase authority and scenarios are the proof layer
- tickets are durable work-item authority
- comments are the discussion/publication layer and must not become task-status
  authority

The page also needs a reusable widget architecture. The product should not
implement one-off counts or dead-end text blocks. Each visible object must
support drilldown, drillthrough, or direct inspection of underlying surfaces.

## Acceptance

- `Requirements View` is defined as a requirement-first workbench for BA,
  Scrum, and PM use rather than a runtime-first dashboard.
- `Process View` is tracked as a separate entry point over the same broad
  information model, driven by build activity and process-flow filtering rather
  than requirement-first selection.
- Every widget on the page is collapsible.
- No widget presents dead-end text for a live object. If a requirement, total,
  ticket, test, module, or comment is shown, the operator can inspect more
  detail or drill through to the underlying surface.
- Totals are implemented as filtered queries over a shared backing list, not as
  separate logic paths with disconnected semantics.
- Large record sets are presented through bounded navigators with independent
  scrolling, pagination, or virtualization rather than by pushing downstream
  workbench content out of view.
- Applying a total, posture card, or saved query makes the changed filter state
  explicit at the affected explorer and returns focus there so the operator can
  see what changed without hunting through the page.
- When one widget controls another widget's query or focus, the page makes that
  hierarchy explicit through shared framing or local grouping rather than
  leaving the dependency implicit.
- The page has a primary `Requirements Explorer` widget that lists
  human-readable requirement rows with search, filtering, grouping, and sort.
- Selecting a requirement opens a `Requirement Workbench` that keeps all other
  requirement-scoped widgets in the context of that selected requirement.
- The `Requirement Workbench` includes a `Requirement Summary` widget with full
  human-readable requirement text, acceptance criteria, status, priority, and
  source surface links.
- The `Requirement Workbench` includes a `Requirement History` widget that
  surfaces changes, supersessions, repricing, or other requirement-local
  history when that evidence exists.
- The `Requirement Workbench` includes a `Design Drilldown` widget that exposes
  linked design documents, ADRs, and design surfaces for the selected
  requirement.
- The `Requirement Workbench` includes an `Implementation Drilldown` widget
  that exposes linked modules, code surfaces, and implementation claims for the
  selected requirement.
- The `Requirement Workbench` includes a `Test Authority` widget that exposes
  testcase authority, scenarios, ordered testcase sequences, and acceptance
  proof surfaces for the selected requirement.
- The `Requirement Workbench` includes a `Test Execution` widget shape for
  eventual run history, latest results, failures, and proving-lane evidence,
  even if some workspaces do not yet publish complete run data.
- The `Requirement Workbench` includes a `Delivery Work` widget that exposes
  linked durable tickets from `.ai-workspace/tickets/` and differentiates them
  from comment-layer discussion.
- The `Requirement Workbench` includes a `Discussion` widget that exposes
  OddBoard comments, reviews, handoffs, decisions, and closure notes while
  clearly labeling them as commentary rather than task-status authority.
- The `Requirement Workbench` includes an `Open Issues / Risks` widget that
  exposes blockers, missing capabilities, failing tests, unresolved tickets,
  and other requirement-local risk surfaces.
- The reusable widget stack is defined explicitly so specialized requirement
  widgets are composed from shared primitives such as `WidgetFrame`,
  `RecordList<T>`, `FilteredRecordList<T>`, `RecordDetail<T>`,
  `LinkedRecordList<T>`, `TimelineWidget<T>`, and `EvidenceWidget<T>`.
- The reusable widget stack is view-agnostic where the underlying concern is
  shared. `Requirements View` and `Process View` should reuse the same
  primitives and, where lawful, the same higher-order widgets with different
  entry filters and selection drivers.
- The specialized widget family is tracked explicitly, including at least:
  `RequirementsSnapshotWidget`, `RequirementsExplorerWidget`,
  `RequirementSummaryWidget`, `RequirementHistoryWidget`,
  `RequirementDesignWidget`, `RequirementImplementationWidget`,
  `RequirementTestAuthorityWidget`, `RequirementTestExecutionWidget`,
  `RequirementTicketsWidget`, `RequirementCommentsWidget`, and
  `RequirementRisksWidget`.
- Shared cross-cutting widgets such as design drilldown, implementation
  drilldown, test authority, test execution, tickets, comments, and risks are
  not to be hard-coded as requirements-only if they also serve the
  process/build-activity entry point.
- The page law preserves ticket/comment authority separation:
  `.ai-workspace/tickets/` remains durable work authority and OddBoard comment
  surfaces remain discussion/publication.

## Links

- product: `specification/PRODUCT.md`
- requirements: `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`
- scenario: `specification/scenarios/01-requirements-and-process-entry-lenses.md`
- design: `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- page: `build_tenants/react_vite/src/routes/WorkspaceRoute.tsx`
- page labels: `build_tenants/react_vite/src/lib/presentation.ts`
- page ids: `build_tenants/react_vite/src/lib/types.ts`
- methodology: `/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_METHOD.md`
- ticket method: `/Users/jim/src/apps/specification_methodology/specification/standards/TICKET_METHOD.md`
- posting guide: `/Users/jim/src/apps/specification_methodology/specification/standards/POSTING_GUIDE.md`
