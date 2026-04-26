# Read Model And Projection

**Family**: `REQ-OM-PROJ-*`
**Status**: Active
**Category**: Constraint / Guarantee
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`

### REQ-OM-PROJ-001 - The managed system is projected as a live workspace world

`odd_manager` shall project the managed system as a live workspace world rather
than as a static report bundle or one synthetic summary file.

Acceptance Criteria
- the product reads and projects declaration, runtime, evidence, and policy
  surfaces as part of one managed world
- the product can project ambiguity and capability posture as part of that same
  world rather than as out-of-band implementation notes
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
- the product can distinguish bounded stop states such as
  `pending_capability`, `fh_required`, carried ambiguity, and hard-blocked
  policy posture from generic failure
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
- projected views preserve asset-family, collection, and edge-contract semantics
  where upstream publishes them
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

### REQ-OM-PROJ-008 - Missing domain-pack detail is represented as explicit placeholder state

The product shall represent missing, provisional, or not-yet-published
domain-pack detail as explicit placeholder state rather than as silent
absence or fabricated structure.

Acceptance Criteria
- projections can render partial graph, workorder, asset-type, gap, or
  convergence detail when only stable identity and binding data are available
- ambiguity and capability surfaces that are explicitly published upstream are
  not treated as placeholder detail
- placeholder views still expose authoritative ids, bindings, carrier names,
  and runtime links
- the UI makes it clear whether a field is published truth, derived summary, or
  provisional placeholder

### REQ-OM-PROJ-009 - Runtime projections are ABG-native and domain overlays are query-derived

The product shall derive runtime projections from ABG-native truth and derive
domain overlays from active domain-package query logic rather than asking one
side to masquerade as the other.

Acceptance Criteria
- `run`, `graph_call`, `continuation`, `frame`, and event-derived runtime
  status are projected from ABG truth
- asset views, binding views, function catalog views, asset-family and program
  views, ambiguity register views, capability-posture views, and gap or
  convergence overlays may be projected from domain-package query-library
  results
- the composed UI can identify whether a field came from ABG runtime
  projection, ODD domain query, or manager-derived summary
- the first query cadence may be on-demand rather than background-synchronized

### REQ-OM-PROJ-010 - Query-contract metadata is explicit and drift-detectable

`odd_manager` shall surface enough upstream query-contract metadata to detect
observer drift explicitly rather than silently ignoring a repriced domain
payload.

Acceptance Criteria
- the projected domain payload retains explicit query-contract identity and
  version where upstream publishes it
- local adapter and type layers can distinguish supported contract shape from
  unrecognized drift
- incompatible upstream query-contract changes are surfaced as explicit
  integration work rather than hidden behind silent field dropping

### REQ-OM-PROJ-013 - Core system projections remain available across domain contracts

`odd_manager` shall keep core GTL/ABG projections available even when the
active workspace uses an unrecognized or partially supported domain contract.

Acceptance Criteria
- runtime, history, provenance, evidence, traceability, and other core
  GTL/ABG projections remain available independently of domain-pack support
- unsupported domain contracts degrade to explicit domain-compatibility state
  rather than to total world failure where core projections remain lawful
- domain-contract compatibility state is itself projected as explicit world
  information

### REQ-OM-PROJ-014 - Domain UI-pack resolution is explicit and versioned

`odd_manager` shall resolve domain-specific pages and actions through an
explicit manager-side compatibility layer keyed by published domain-contract
identity and version.

Acceptance Criteria
- the manager can determine whether a compatible domain UI pack exists for the
  active domain contract
- domain-specific tabs, labels, and actions are selected through that explicit
  compatibility layer rather than through repo-name or path heuristics
- one manager installation can support more than one domain contract version or
  more than one `odd_*` domain line through separate compatible packs
- incompatibility is surfaced explicitly rather than silently dropping fields or
  rendering stale domain actions

### REQ-OM-PROJ-012 - Gap projections preserve carry and fulfillment separation

`odd_manager` shall preserve the managed domain package's separation of carry and
fulfillment truth in its gap projections rather than merging them into a
blended delta scalar.

Acceptance Criteria
- projected gap views include `carry_converged`, `fulfillment_converged`, and
  `edge_converged` as distinct fields where the managed domain package
  publishes them
- the manager does not treat `combined_delta` as the primary closure signal
- carry blocking reasons and fulfillment blocking reasons can be inspected
  separately where the managed domain package publishes them
- span aggregation views preserve separate carry and fulfillment aggregates
  where the managed domain package publishes them

### REQ-OM-PROJ-011 - Ambiguity and capability posture is projected as first-class world state

`odd_manager` shall project ambiguity and capability posture as first-class
world state over the managed workspace.

Acceptance Criteria
- the world projection includes current ambiguity register state where upstream
  publishes it
- the world projection includes capability-gated stop states and their governing
  domain explanation where upstream publishes them
- overview and inspector layers can trace a blocked or carried posture back to
  the governing ambiguity or capability surface

### REQ-OM-PROJ-015 - The first supported odd_sdlc pack projects the observed delivery artifact family

`odd_manager` shall treat the published `odd_sdlc` delivery artifact family as
first-class domain overlays for the first supported domain pack.

Acceptance Criteria
- when the active workspace publishes them, projections can surface generated
  requirement inventory, requirement-closure, ambiguity-register,
  active-workflow, generated-scenario, testcase-authority, generated-design,
  test-run-archive, release, and FP ledger/manifest/result surfaces
- those surfaces remain domain overlays rather than being redefined as
  GTL/ABG-native runtime primitives
- missing or stale generated surfaces are represented honestly with explicit
  absence or staleness state
- core GTL/ABG runtime projections remain available regardless of whether the
  full `odd_sdlc` delivery artifact family is present

### REQ-OM-PROJ-016 - Workspace identity and governance identity are projected separately

`odd_manager` shall project the selected workspace's primary project identity
and governance-package identity as separate world facts.

Acceptance Criteria
- the manager can project a primary identity such as `odd_sdlc` or
  `odd_world_model` for the selected workspace
- the manager can also project the governing package or runtime package where
  that differs from primary identity
- domain-page resolution, landing-page selection, and shell framing can consume
  those projected identity fields without scraping labels out of unrelated UI
- identity uncertainty is represented explicitly instead of being silently
  guessed from repo naming alone
