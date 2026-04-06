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
  as the builder line or the runtime substrate

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

### REQ-OM-BND-004 - The emerging builder line remains a separate ownership boundary

`odd_manager` shall integrate with the emerging builder line as a separate
ownership boundary while that line is still being built.

Acceptance Criteria
- builder/domain framing can be inspected from the control plane without being
  absorbed into the manager product
- the control plane can link to builder-owned objects, functions, and assets
  without redefining their semantics
- incomplete builder surfaces are represented honestly rather than padded with
  invented manager-owned substitutes

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
  gap meaning may come from `odd_method` query-library logic
- query-library results do not redefine ABG-native `run`, `graph_call`,
  `continuation`, or `frame` aggregates
- the composition boundary remains explicit in design and implementation
