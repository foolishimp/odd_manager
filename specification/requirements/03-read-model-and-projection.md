# Read Model And Projection

**Family**: `REQ-OM-PROJ-*`
**Status**: Active
**Category**: Constraint / Guarantee
**Derives From**: `specification/PRODUCT.md`, `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

### REQ-OM-PROJ-001 - The managed system is projected as a live workspace world

`odd_manager` shall project the managed system as a live workspace world rather
than as a static report bundle or one synthetic summary file.

Acceptance Criteria
- the product reads and projects declaration, runtime, evidence, and policy
  surfaces as part of one managed world
- the product can project one graph set containing multiple graphs where the
  managed workspace exposes them
- operator-visible claims remain traceable to the underlying surfaces that
  justify them
- the UI can represent missing, stale, or not-yet-generated surfaces honestly

### REQ-OM-PROJ-002 - Authoritative projections exist for graph and runtime aggregates

The product shall expose explicit projections for the core graph and runtime
aggregates that matter to supervision.

Acceptance Criteria
- explicit projections exist for graph set, asset graph, asset binding, and
  workorder
- explicit projections exist for run, graph call, frame, and continuation
- runtime truth is not hidden only inside one coarse aggregate or one generic
  status summary
- the operator can inspect a selected aggregate without reconstructing it from
  raw events by hand

### REQ-OM-PROJ-003 - Distinct runtime identities remain distinct

The product shall preserve distinct runtime identities when the managed system
keeps them distinct.

Acceptance Criteria
- the UI can distinguish semantic role, resolved worker identity, and backend
  identity where available
- the product does not collapse all runtime activity into one unlabeled actor
  surface
- recent or active work can show enough identity detail to support review and
  post-mortem understanding

### REQ-OM-PROJ-004 - Operational status distinguishes the important kinds of waiting and failure

The product shall distinguish the main kinds of waiting, blocking, and failure
instead of collapsing them into one generic status.

Acceptance Criteria
- the product can distinguish active work, governance waiting, deterministic
  proof failure, runtime defect, policy defect, probabilistic non-convergence,
  and superseded work
- operator-facing explanations describe why a selected object is waiting or
  blocked
- the product can show what last changed state and what kind of condition is
  presently open

### REQ-OM-PROJ-005 - Cost and context delivery remain inspectable

The product shall make live-turn cost and context delivery inspectable enough
to support runtime supervision.

Acceptance Criteria
- where available, a run or graph call exposes elapsed time and other useful
  cost proxies
- where available, the product can show whether context was delivered by
  locator, attachment, or inline material
- the operator can inspect which authority surfaces dominated the working
  context of a selected turn

### REQ-OM-PROJ-006 - Typed asset semantics remain visible in projections

The product shall preserve asset typing and binding semantics in its projected
read model.

Acceptance Criteria
- projected asset views show stable identity and declared type
- projected graph views can show which typed nodes are bound and which remain
  open
- projected workorder views can show typed inputs and outputs without requiring
  manual reconstruction

### REQ-OM-PROJ-007 - Derived summaries never overwrite authoritative truth

The product shall keep derived dashboards, posture summaries, and queues
subordinate to authoritative declaration and runtime truth.

Acceptance Criteria
- derived summaries can be traced back to their source objects
- correcting or replaying authoritative truth can update derived summaries
  deterministically
- the UI does not require operators to trust a summary that cannot be expanded
  into its justifying objects and evidence

### REQ-OM-PROJ-008 - Missing builder detail is represented as explicit placeholder state

The product shall represent missing, provisional, or not-yet-published
builder-domain detail as explicit placeholder state rather than as silent
absence or fabricated structure.

Acceptance Criteria
- projections can render partial graph, workorder, asset-type, gap, or
  convergence detail when only stable identity and binding data are available
- placeholder views still expose authoritative ids, bindings, carrier names,
  and runtime links
- the UI makes it clear whether a field is published truth, derived summary, or
  provisional placeholder

### REQ-OM-PROJ-009 - Runtime projections are ABG-native and domain overlays are query-derived

The product shall derive runtime projections from ABG-native truth and derive
domain overlays from `odd_method` query logic rather than asking one side to
masquerade as the other.

Acceptance Criteria
- `run`, `graph_call`, `continuation`, `frame`, and event-derived runtime
  status are projected from ABG truth
- asset views, binding views, function catalog views, and gap or convergence
  overlays may be projected from `odd_method` query-library results
- the composed UI can identify whether a field came from ABG runtime
  projection, ODD domain query, or manager-derived summary
- the first query cadence may be on-demand rather than background-synchronized
