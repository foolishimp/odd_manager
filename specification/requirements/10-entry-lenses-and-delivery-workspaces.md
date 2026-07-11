# Entry Lenses And Delivery Workspaces

**Family**: `REQ-OM-LNS-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`

### REQ-OM-LNS-001 - Distinct entry lenses share one world model

`odd_manager` shall provide distinct stakeholder entry lenses over one shared
world model rather than creating separate truth silos per page.

Acceptance Criteria
- the product provides at least a requirement-first entry lens and a
  process-first entry lens
- entry lenses reuse the same underlying objects, status semantics, and
  selection model where the concern is shared
- changing entry lens does not invent a second state model or disconnected
  widget truth

### REQ-OM-LNS-002 - Requirements View is requirement-first

`Requirements View` shall organize project state around the requirement as the
primary framing object for BA, Scrum, and PM use.

Acceptance Criteria
- the primary explorer surface shows human-readable requirement rows rather
  than raw ids alone
- the requirement explorer behaves as a bounded navigator so large backlogs do
  not push the downstream workbench out of view
- selecting a requirement reveals requirement-scoped detail without losing the
  larger page context
- totals shown on the page are implemented as filtered queries over the shared
  requirement set rather than disconnected summary counters

### REQ-OM-LNS-003 - Process View is build-activity-first

`Process View` shall organize the same underlying project state around build
activity, process flow, and execution posture rather than around a selected
requirement.

The conforming process-first surface is the selected Project Workbench with
Build Portfolio and Build Control contributions. Sidecar `Run Inspector`
remains the deep forensic capability over admitted GTL/ABG run, traversal,
event, assurance, and artifact carriers discovered within the selected
Project. It has no privileged domain adapter.

Acceptance Criteria
- the primary surface can start from portfolio attention, process or
  build-activity objects, queues, or filters
- process-driven exploration can still reach the same linked design,
  implementation, proof, work, and discussion surfaces where relevant
- process-first framing does not require duplicating those downstream widgets
  into a second unrelated architecture
- the Project Workbench exposes Review, Tune, Build, and Assure posture while
  preserving capability ownership and one shared Context
- Build Portfolio distinguishes Project, revision, request, execution, run,
  freshness, and attention identity across concurrent work
- the Run Inspector exposes overview, graph, traversal, functions, catalog,
  assets, diagnostics, assurance, events, stages, transcripts, and artifacts
  when their admitted carriers are present
- run discovery starts from the selected Project and relates timestamped run
  roots and generated workspaces without registering them as separate Projects
- large event carriers remain bounded in the UX, preserve complete published
  event-kind counts, and expose digest verification rather than silently
  dropping unknown kinds
- missing or incompatible run carriers render an explicit unsupported or
  incomplete state while generic Project browsing remains available
- the manager projects process state from admitted GTL/ABG truth; it does not
  choose traversal, continuation, next edge, retry, or closure

### REQ-OM-LNS-004 - Shared widget architecture is reusable across entry lenses

The product shall treat delivery-oriented information widgets as reusable
building blocks that can serve more than one entry lens.

Acceptance Criteria
- the widget stack is built from shared primitives such as frame, list, filter,
  detail, timeline, and evidence surfaces
- requirement-first and process-first pages can reuse the same higher-order
  widgets where the underlying concern is shared
- when one widget changes the query, focus, or dataset of another widget, that
  dependency is made explicit through shared framing or local grouping rather
  than hidden cross-page coupling
- cross-cutting widgets such as design drilldown, implementation drilldown,
  test authority, test execution, tickets, comments, and risks are not
  hard-coded as requirement-only if they also serve process-first work

### REQ-OM-LNS-005 - Widgets are collapsible and progressively disclosed

Delivery-oriented widgets shall support progressive disclosure through
collapsible presentation rather than forcing one permanently expanded dashboard.

Acceptance Criteria
- each widget can be collapsed and reopened without losing its place in the
  surrounding page
- collapsed state does not remove the operator's ability to understand what the
  widget contains at a glance
- deeper evidence and raw detail remain reachable from the same page context

### REQ-OM-LNS-006 - Displayed objects and totals are drillable

The product shall not present live delivery objects or totals as dead-end text.

Acceptance Criteria
- displayed totals can open the filtered set they summarize
- applying a total, metric, or saved query makes the resulting filter state
  explicit near the affected list rather than causing a silent page change
- applying a saved query returns operator focus to the affected list so the
  changed result set is visible without hunting through the page
- displayed requirements, tickets, tests, modules, comments, and related
  objects can open richer detail or the underlying source surface
- the first visible layer remains human-readable while raw identities and
  authoritative references remain reachable as deeper layers

### REQ-OM-LNS-007 - Requirement workbench exposes downstream reality

When a requirement is selected, the product shall expose the downstream
reality needed to understand whether that requirement is truly covered.

Acceptance Criteria
- the requirement workbench includes human-readable summary and acceptance
  material for the selected requirement
- the workbench can expose requirement history, design links, implementation
  surfaces, testcase authority, test execution results where available, tickets
  or bugs, and discussion surfaces tied to that requirement
- the operator can move from the requirement context into underlying design,
  module, code, proof, ticket, and comment surfaces without losing requirement
  framing

### REQ-OM-LNS-008 - Ticket and comment authority remain distinct in delivery views

Delivery-oriented entry lenses shall preserve the authority split between
durable work tracking and discussion/publication.

Acceptance Criteria
- durable work items come from the ticket authority under `.ai-workspace/tickets/`
- comments, reviews, handoffs, and closure notes remain attributable discussion
  surfaces rather than task-status authority
- the UI distinguishes ticket state from comment-layer discussion even when
  both are shown in the same requirement or process context

### REQ-OM-LNS-009 - Board and session workspace remain ubiquitous tools

Stakeholder entry lenses shall retain the board and local session workspace as
ubiquitous tools rather than isolating them behind one specialized route.

Acceptance Criteria
- `Requirements View` can show OddBoard and the local shell workspace without
  forcing a route change
- `Process View` can show the same ubiquitous tools without introducing a
  separate collaboration substrate
- those tools remain attached to the same managed workspace truth as the entry
  lenses they accompany

### REQ-OM-LNS-010 - Domain entry lenses are selected at the primary-identity level

`odd_manager` shall choose optional domain entry lenses from published Project
identity and admitted feature carriers, not from repository basenames or a
hard-coded product list.

Acceptance Criteria
- published product identity is resolved separately from governance packages
- generic Project, file, AI Workspace, ticket, shell, and Run Inspector
  surfaces remain available independently of a domain pack
- a domain lens is enabled only when its declared feature and contract inputs
  are admitted
- shell and Project labels present published primary identity while
  manager-owned core surfaces remain cross-domain
