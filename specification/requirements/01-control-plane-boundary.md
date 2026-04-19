# Control-Plane Boundary

**Family**: `REQ-OM-BND-*`
**Status**: Active
**Category**: Constraint / Guarantee
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`

### REQ-OM-BND-001 - odd_manager is a separate control-plane product boundary

`odd_manager` shall exist as its own control-plane product boundary rather than
as an embedded UI layer inside another product.

Acceptance Criteria
- the product has its own project-owned requirement, design, and tenant
  surfaces
- the control plane remains subordinate to external declaration and runtime
  truth rather than collapsing those ownership boundaries into itself
- implementation work can proceed without requiring the product to masquerade
  as a domain package or the runtime substrate

### REQ-OM-BND-002 - The product does not create a shadow runtime

`odd_manager` shall treat declaration truth and runtime fact truth as
authoritative and shall not create post-dispatch control state that competes
with them.

Acceptance Criteria
- operator-visible status derives from authoritative declaration or runtime
  surfaces
- UI summaries and queues remain projections rather than rival mutable control
  state
- actions route through lawful runtime and policy mechanisms instead of through
  UI-local shortcuts

### REQ-OM-BND-003 - Legacy transport metaphors are not canonical ontology

The live product shall not treat transport metaphors, route-simulator language,
or inherited lifecycle shorthand as canonical semantic objects.

Acceptance Criteria
- the primary live ontology is expressed in terms of product, graph, runtime,
  policy, and proof objects
- simplified visual metaphors may exist only as derived orientation aids
- the product does not require operators to think in inherited metaphor terms
  in order to understand current truth

### REQ-OM-BND-004 - Domain packages remain separate ownership boundaries

`odd_manager` shall integrate with domain packages as separate ownership
boundaries rather than absorbing them into the manager product.

Acceptance Criteria
- domain framing can be inspected from the control plane without being
  absorbed into the manager product
- the control plane can link to domain-owned objects, functions, and assets
  without redefining their semantics
- incomplete domain surfaces are represented honestly rather than padded with
  invented manager-owned substitutes

### REQ-OM-BND-008 - odd_manager is a host over core pages and domain-contributed surfaces

`odd_manager` shall operate as a control-plane host that keeps core GTL/ABG
pages manager-owned while admitting domain-specific tabs and actions only
through the active domain package contract.

Acceptance Criteria
- core system pages remain available across supported domains for runtime,
  history, provenance, evidence, traceability, and related GTL/ABG truth
- domain-specific pages and actions are contributed through a compatible
  manager-side domain UI pack rather than hardcoded as unconditional global
  product truth
- the product can support more than one `odd_*` domain package without forking
  the whole manager shell
- unsupported or missing domain packs do not remove core system pages

### REQ-OM-BND-009 - Domain-contributed surfaces do not redefine runtime law

`odd_manager` shall not allow a domain UI pack to redefine GTL/ABG runtime
objects or their governing semantics.

Acceptance Criteria
- domain-contributed pages may add domain-specific meaning, navigation, and
  actions, but they do not redefine `run`, `graph_call`, `frame`,
  `continuation`, or event truth
- manager-owned runtime pages remain authoritative for ABG-native runtime
  interpretation
- domain labels or summaries remain traceable to their published domain
  contract rather than to UI-local reinterpretation

### REQ-OM-BND-005 - Shared design law hardens before tenant-local implementation

The product shall harden shared design law before committing to tenant-local UI
carrier detail.

Acceptance Criteria
- cross-tenant control-plane law is written in shared design surfaces before
  implementation-specific layout or framework detail becomes authoritative
- tenant-local work remains derivable from the shared design package
- implementation scaffolds do not become accidental constitutional truth

### REQ-OM-BND-006 - Operator actions remain lawful and context-derived

The product shall surface operator actions that are admissible for the current
selected context and current runtime state.

Acceptance Criteria
- available actions vary with the selected object, policy state, and runtime
  admissibility
- the UI does not surface arbitrary global actions that ignore local context
- actions remain adjacent to the evidence and context that justify them

### REQ-OM-BND-007 - Runtime truth and domain query overlays remain separate ownership lines

`odd_manager` shall compose runtime truth and domain understanding from
separate ownership lines rather than collapsing them into one served payload or
one manager-owned model.

Acceptance Criteria
- realtime runtime state is read from ABG event truth and ABG runtime
  projections
- domain overlays such as asset views, bindings, function catalog detail, or
  gap meaning may come from active domain-package query-library logic
- query-library results do not redefine ABG-native `run`, `graph_call`,
  `continuation`, or `frame` aggregates
- the composition boundary remains explicit in design and implementation
