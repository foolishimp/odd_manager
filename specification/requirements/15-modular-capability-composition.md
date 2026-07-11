# Modular Capability Composition

**Family**: `REQ-OM-CAP-*`
**Status**: Active
**Category**: Constraint / Guarantee
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`, `specification/GOALS.md` G-007

### REQ-OM-CAP-001 - Major developer capabilities are independently evolvable

The product shall maintain explicit ownership boundaries for Build Portfolio,
Project Workbench, Specification Proposal, Build Control, Assurance and
Attention, and Run Observation.

Acceptance Criteria
- each capability declares the product inputs, actions, projections,
  availability states, and proof it owns
- one capability can iterate without requiring unrelated capability behavior to
  be rewritten
- capability ownership is architectural rather than a presentation-only tab or
  folder distinction
- shared behavior has one named owner or shared contract boundary

### REQ-OM-CAP-002 - Capability modules compose into one product world

Capability independence shall not create separate Project, revision, build,
participant, evidence, selection, or status truth models.

Acceptance Criteria
- capabilities share admitted Context and product identities
- cross-capability outcomes flow through typed product contracts, commands, or
  events
- a capability does not read rendered state or mutate another capability's
  internal state
- the Project Workbench integrates capability contributions without duplicating
  their state or business rules

### REQ-OM-CAP-003 - Every capability follows STDO-UX

Each product UX capability shall declare and prove its STDO-UX interaction
surface.

Acceptance Criteria
- product-meaningful state and messages are typed
- update is pure and side effects are declared commands or subscriptions
- external payloads are runtime-validated before state admission
- product-truth-changing messages map to admitted carriers
- module-level Msg replay covers each product-meaningful interaction family

### REQ-OM-CAP-004 - One explicit host owns integration effects

The integrated product shall route cross-capability Context, navigation,
command, subscription, and correlation effects through a declared host
boundary.

Acceptance Criteria
- the host does not own capability-specific domain decisions
- success and failure return to the capability that issued the command
- correlation identity survives command interpretation and external response
- integration effects are replayable without relying on view or effect-handler
  memory

### REQ-OM-CAP-005 - Capability availability is explicit

Each capability shall report whether its required contracts and data are
unavailable, loading, ready, stale, unsupported, or failed.

Acceptance Criteria
- missing product carriers disable only the affected capability
- one unsupported capability does not make generic Project work unavailable
- availability does not imply functional completion or successful assurance
- the developer can inspect why a capability is unavailable or stale

### REQ-OM-CAP-006 - Existing observation capabilities cross the same boundary

AI Workspace and Run Observation shall participate in the modular capability
model without changing their underlying GTL/ABG ownership.

Acceptance Criteria
- existing Project deep links, observation, traversal, artifacts, and source
  references remain available through the capability host
- migration does not duplicate Run Inspector state or projection services
- domain overlays remain layered over manager-owned core observation
- current observation proof remains valid after structural composition

### REQ-OM-CAP-007 - Structural foundation and functional MVP closure are distinct

The product shall distinguish establishment of clean capability boundaries from
delivery of functional capability MVPs.

Acceptance Criteria
- the structural wave closes only on contracts, ownership, composition,
  availability, effect routing, and boundary proof
- structural capability shells are not represented as functional MVP completion
- each later MVP has its own user-visible outcome and proof surface
- bypassing an admitted boundary to accelerate an MVP is a non-closure condition

### REQ-OM-CAP-008 - Module and integration boundaries are executable proof

The capability architecture shall be protected by automated local and
integration proof.

Acceptance Criteria
- module replay proves local state, message, command, success, and failure flow
- integration replay proves Context changes, command correlation, late-result
  rejection, navigation, and cross-capability outcomes
- dependency checks detect capability-to-capability internal imports or a new
  central semantic component
- browser proof confirms the integrated experience remains coherent across
  supported viewport sizes
