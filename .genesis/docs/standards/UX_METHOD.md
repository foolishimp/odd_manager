# UX Method

## 1. Position

`UX_METHOD.md` exists to make one instruction precise:

`using UX_METHOD, build this UI surface`

The method adopts the **Elm Architecture (TEA)** as its constitutional process model:

- the view is a pure projection of typed state
- state transitions are pure reductions over typed messages
- side effects are values described by the reducer and interpreted at a declared effect membrane
- the runtime owns lifecycle; the view does not own continuation

The view is not a state owner.

Stateful local mutation in views, two-way bindings without action emission, and effect-handlers-as-controllers are method violations even when they are conventionally accepted in the surrounding ecosystem.

### 1A. Constitutional Authority Rule

When a product, ticket, design module, or review adopts this method for a UX
surface, `UX_METHOD.md` is the sole UX realization authority for that surface.

Project-local ADRs may choose the stack. They may not weaken the process model.

Existing code, component-library convention, screenshots, comments, design
history, prototype behavior, and generated artifacts are evidence only. They do
not override this method.

If this method appears ambiguous in a concrete case, the surface fails closed:
the work must either satisfy the stricter interpretation, reprice through the
governing constitutional method, or record a scoped exemption in the design
module before implementation proceeds.

---

## 2. Method Role

`SPEC_METHOD.md` defines constitutional process and lawful re-entry.

`ODD_METHOD.md` defines graph-native constructive carrier law.

`DESIGN_MODULE_METHOD.md` defines deterministic module-level realization discipline.

`UX_METHOD.md` refines `DESIGN_MODULE_METHOD.md` with the additional rules required when a module realizes a UX surface — render purity, state-transition algebra, effect-membrane discipline, and accessibility minimums — under the Elm Architecture process model.

`UX_METHOD.md` does not duplicate `DESIGN_MODULE_METHOD.md`. Where the parent method already governs (immutability, totality, effect-edge discipline, no-semantic-center, coupling), `UX_METHOD.md` cites and extends it. Where UX has concerns the parent does not address (render lifecycle, browser events, layout, accessibility), `UX_METHOD.md` is authoritative.

---

## 3. Method Composition

`UX_METHOD.md` composes with the upstream methods on a per-surface basis:

- when a module realizes a UX surface, both `DESIGN_MODULE_METHOD.md` and `UX_METHOD.md` apply
- when a module realizes a non-UX surface, only `DESIGN_MODULE_METHOD.md` applies
- when an ODD product publishes a projection / query surface that includes UX (`§10` of `ODD_METHOD.md`), `UX_METHOD.md` governs that surface's realization

The composition rule is:

- `ODD_METHOD.md` answers what graph-native shape the product takes
- `DESIGN_MODULE_METHOD.md` answers what realization discipline the modules follow
- `UX_METHOD.md` answers what additional discipline UX surfaces follow

### 3A. UX Projection And Constructive Carrier Boundary

UX surfaces are projection and control surfaces. They render admitted truth and
emit typed messages.

A UX-local `Msg` may govern view-local concerns such as expansion state, sort
order, filter text, focus movement, or draft input.

A UX `Msg` that changes product truth is not merely a UX concern. Product-truth
changes include:

- writing, creating, moving, or deleting assets
- changing Context, selection authority, pinning, or global product state
- spawning, attaching, or resuming sessions
- dispatching agents, jobs, workorders, graph calls, or runtime commands
- changing closure, approval, continuation, lineage, provenance, or evidence
- publishing, accepting, rejecting, or superseding product records

Such a message must map to one admitted product carrier:

- an `AssetSurface` action
- a published graph function or lawful graph-function composition
- a workorder, job, or runtime command admitted by the product's design
- an ABG event or command boundary where ABG is the runtime authority
- another typed product contract named by the design module

The UX layer must not become the hidden constructive carrier. If no admitted
carrier exists for a product-truth-changing message, the UX surface is blocked
until the carrier is authored or the requirement is repriced.

---

## 4. Process Model — Elm Architecture

The constitutional process model is the Elm Architecture:

- **State** — typed state shape held by the runtime, not by the view
- **Msg** — typed message algebra naming every action a user or system can emit
- **Update** — pure reducer of signature `(Msg, State) → (State, Cmd)`; describes side effects as `Cmd` values, does not perform them
- **View** — pure function of signature `State → ViewTree`; given the same state, produces the same output
- **Cmd / Sub** — typed descriptions of side effects to schedule and external sources to subscribe to; interpreted by the runtime at the effect membrane

The runtime owns the loop:

`current State → render View → user emits Msg → Update produces new State and Cmds → runtime interprets Cmds → repeat`

This loop is the Elm Architecture. It is the constitutional process model of UX work under this method.

---

## 4A. Process Model Without Language Or Framework Mandate

The process model is the Elm Architecture. The implementation stack is the project's choice, recorded in the project's design module.

This mirrors `DESIGN_MODULE_METHOD.md` §4 ("Functional Bias Without Language Mandate"). The rule is:

- the **process model** is constitutional and not negotiable
- the **stack** is project-local and free, provided it preserves the model

Any realization that preserves §4–§8 is method-compliant. Examples (non-normative):

- **A language-integrated reducer runtime** — enables typed state, message,
  update, command, and view relations as native runtime capabilities.
- **A typed reducer with an effect interpreter** — enables a host-language UI
  stack to preserve pure update and an explicit effect membrane.
- **A reactive-signal realization behind a reducer** — enables reactive
  projection while forbidding signal mutation outside the reducer.
- **A server-rendered hypermedia realization** — enables server-side state
  derivation as the reducer and uses the request/response boundary as the
  effect membrane.

What is constitutionally rejected: any realization that lets the view own state continuation, performs side effects in render code, mutates state outside a typed reducer, or carries multi-step view-local state machines that bypass `Msg`. Two-way binding without `Msg` emission, imperative DOM manipulation in render code, and effect-handlers used as controllers are violations regardless of stack.

A project that selects a framework records the choice in its design module along with a short justification of how the framework preserves the §4 process model. The method does not rank frameworks. The method tests realizations against §4–§8.

---

## 5. State Transition Law

State changes through typed messages applied by the pure reducer (`Update` of §4).

A UX surface declares:

- its `State` shape
- its `Msg` algebra
- its `Update : (Msg, State) → (State, Cmd)`
- its `Cmd` algebra
- its `Sub` algebra when the surface subscribes to external or runtime events

Each `Cmd` declaration names:

- the effect kind
- the typed input payload
- the admitted carrier or external boundary it targets
- the success `Msg` emitted back to the reducer
- the failure `Msg` emitted back to the reducer
- any deterministic correlation key required for replay

The reducer is pure. It does not perform I/O, log to side channels, or mutate global state. Effects scheduled by `Cmd` are interpreted by the runtime at the effect membrane (see §6).

View-local ephemera (open/closed flags, hover state, draft input) may be held in implementation-local state cells where the framework provides them, but only when the value is genuinely view-local (not observed by other views, not part of the product's state surface, not consequential after the view unmounts). Product-meaningful state goes through the reducer without exception.

The discipline test for whether state belongs in the reducer or in view-local ephemera: if losing the value on unmount changes the product's behavior or another part of the UI's view, it belongs in the reducer.

---

## 6. Effect Membrane Rule

Side effects are isolated to a declared effect membrane.

The membrane interprets `Cmd` values produced by the reducer and translates side-effect outcomes back into `Msg` values delivered to the reducer.

Inside the membrane:

- I/O is allowed
- subscriptions to external sources are allowed
- imperative interop with the host platform is allowed (DOM, file system, native APIs)

Outside the membrane (in render code, in pure helpers consumed by render, in the reducer):

- no I/O
- no subscriptions
- no imperative platform manipulation

The membrane has one job: interpret declared `Cmd` values. It is not where logic lives. Branching, conditional state derivation, and multi-step business decisions belong in the reducer; the membrane interprets a single declared `Cmd` per effect.

A platform-specific effect handler (whatever name the chosen framework gives it: `useEffect`, `createEffect`, `onMount`, `subscribe`, server-action handler) is part of the membrane only when it interprets a declared `Cmd`. A handler that contains conditional logic deciding state transitions is a method violation. Move the logic to the reducer; let the handler interpret one `Cmd`.

---

## 7. AssetSurface Binding Rule

When the product publishes typed asset surfaces (per `ODD_METHOD.md` §11 carrier law and the local product's design), a UX surface binds to one or more `AssetSurface` contracts as its data source and action target.

Binding requirements:

- the UX surface's `State` is derived from `AssetSurface` projections, not from a UX-local re-declaration of the asset shape
- the UX surface's product-truth-changing `Msg` variants map one-to-one to `AssetSurface` action-registry entries or wrap them through a documented projection with no hidden semantic change
- UX-local `Msg` variants are reserved for view-local concerns (open/closed, sort order, filter input)
- selection within the UX surface emits a Context update (or equivalent) consistent with the product's selection contract
- writes from the UX surface go through the `AssetSurface` action registry, not through direct file or service calls

This is the rule that produces strong functional consistency between front-end and back-end: the same typed contract is the ground truth on both sides.

If the product does not publish `AssetSurface` contracts, the design module must
name the equivalent typed contract and apply the same binding law to that
contract. Absence of an admitted contract blocks product-truth-changing UX
actions.

---

## 8. UX Twin Of ODD §11.5A — View Does Not Own Continuation

`ODD_METHOD.md` §11.5A states that ABG owns continuation; the product is a cooperative bounded-step subsystem.

The UX twin: **the view does not own state continuation.**

State transitions flow through declared `Msg` actions interpreted by the reducer. A view does not:

- decide on its own what the next state will be after a user event
- chain multiple state updates locally without emitting them as separate `Msg` values
- carry hidden inter-event state in refs, closures, or module-level variables

If a view appears to need a multi-step local state machine, that state machine belongs in the reducer as part of `State`, with explicit `Msg` transitions between phases. The view becomes a pure projection of which phase it is in.

The discipline test is the **Msg-replay test**: can you replay the view's behavior by replaying its `Msg` log against an empty `State`? If the answer is no, continuation has leaked into the view.

### 8A. Msg-Replay Proof Requirement

Every product UX surface must carry at least one executable Msg-replay proof for
each product-meaningful interaction family before claiming method closure.

A replay proof includes:

- an initial `State` fixture
- an ordered `Msg` log
- the expected final `State`
- the expected ordered `Cmd` values
- the success and failure `Msg` values returned by interpreted `Cmd`s
- injected deterministic values for time, randomness, generated ids, and
  external payloads

The proof fails if correctness depends on:

- DOM state not represented in `State`
- mutable refs, module variables, closures, timers, or effect-handler memory
- network or file results that bypass typed `Msg`
- view-local state that changes product behavior after unmount or replay

For a pure projection-only surface, the replay proof may be a no-effect proof:
`Msg` log plus final `State` and empty `Cmd` sequence.

---

## 9. View Shape Rule

A view is a pure function from typed state to a view tree.

The view:

- accepts typed input (state, props, context)
- returns a typed view tree
- declares its consumed inputs explicitly
- does not capture mutable state in closures across renders
- does not read from sources outside its declared input

Whether the implementation expresses this as a function, a function component, a template, a server-rendered handler, a signal-derived expression, or another framework-specific shape is a stack decision recorded in the design module. The constitutional rule is the function signature `State → ViewTree` and the absence of side effects in the body.

A view that depends on out-of-render mutation (e.g., a ref written from inside an effect handler and read during render) is a method violation under §6 unless the mutation is part of the declared effect membrane (e.g., a platform handle for imperative interop already named in the design module).

---

## 10. Type Sharing Rule

UX-consumed types come from the shared front-end / back-end contract.

A UX surface does not re-declare back-end record shapes. It imports them from the shared contract module (typically the same package or a dedicated `contracts/` package).

Runtime validation is mandatory at every untrusted or out-of-process seam:

- HTTP or RPC responses
- MCP payloads
- file-loaded records
- websocket or event-stream messages
- agent or worker outputs
- URL, storage, clipboard, or browser integration payloads

The project uses a typed-schema mechanism so the same type definition is the
source of both compile-time types and runtime validators. The mechanism choice
is project-local. Compile-time TypeScript alone is not sufficient at these
seams.

UX-local types are allowed for view-local concerns: form input draft state, sort order enums, filter strings. UX-local types do not shadow back-end types.

---

## 11. Accessibility Minimum

A UX surface that is the public face of a product capability declares:

- semantic structure (heading levels, landmarks, lists, or platform-equivalent affordances)
- keyboard or platform-equivalent navigability for every action that has a pointer interaction
- focus management on dynamic content changes
- accessibility annotations for any custom interactive element that lacks a native semantic equivalent
- color contrast at the project's declared accessibility standard (WCAG AA is the recommended default for web)

Accessibility is not optional for product capabilities. It is optional for internal-only debug surfaces; the design module records the exemption.

This section is intentionally minimal. Projects with stricter accessibility obligations (regulated industry, public-sector procurement) author a project-local accessibility refinement and cite it from their design modules.

---

## 12. Realization Discretion

The method is opinionated about the process model. It is not opinionated about the realization stack.

The project chooses:

- the language
- the framework or runtime
- the state-container library (if any)
- the effect-interpreter mechanism
- the runtime validator (if any)
- the build, bundling, and deployment toolchain

The project records its choices in the design module along with a short justification of how each choice preserves the §4 Elm process model and the §6 effect-membrane rule.

The method does not rank stacks. It tests realizations. A realization is method-compliant when §4–§10 hold under inspection and the §14 failure patterns are absent.

---

## 13. Adoption Guidance

A project adopts `UX_METHOD.md` by:

1. naming the method in the project's UX-related design modules
2. recording the realization stack choice (per §12) and the justification
3. declaring the Irreducible Architectural Carrier Set and structural carrier
   diagram required by `DESIGN_MODULE_METHOD.md`
4. declaring the `State`, `Msg`, `Update`, `Cmd`, and `Sub` shapes for each UX
   surface in the design module before implementation
5. declaring the `AssetSurface` or equivalent typed-contract bindings (per §7)
   the surface consumes and emits to
6. naming the effect-membrane mechanism (per §6) and the `Cmd` algebra it
   interprets
7. naming the executable Msg-replay proof surface required by §8A
8. naming any §11 accessibility refinement the project requires
9. noting any §9 view-shape or §6 effect-membrane exemptions explicitly

Adoption is per-project. A project may adopt this method only for some UX surfaces (e.g., the production UI but not internal debug tools), with the scope recorded in the design module.

### 13A. Scaffold And Exemption Law

A UX surface is governed by this method by default when any of these are true:

- it is reachable from the product shell
- it is used as proof for a ticket, requirement, design module, release, or
  review
- it can mutate product truth
- it can spawn, attach, resume, or dispatch work
- it can change Context, selection authority, closure, continuation, evidence,
  or provenance

A scaffold, prototype, debug pane, or temporary proof surface may be exempt only
when the design module or ticket records:

- the exemption scope
- the permitted operations
- whether mutation is forbidden or explicitly bounded
- a visible scaffold/debug label where user-facing
- the authoritative surface that will supersede it
- the retirement condition and owning ticket
- the non-closure condition preventing release if the scaffold remains

An exempt scaffold cannot become the production UX by accumulation. It must be
retired, repriced into a governed UX surface, or kept outside product closure.

### 13B. UX Sprint Compliance Escrow

UX is the primary governed use case for sprint compliance escrow.

Under `SPEC_METHOD.md` and `TICKET_METHOD.md`, a UX sprint may defer local UX
compliance proof during a short iteration window when per-change proof cost is
higher than expected correction cost.

This is a cost-optimization rule. It does not weaken the UX process model.

A UX sprint may escrow:

- screenshots or walkthrough capture
- visual review
- copy, spacing, density, and layout cleanup
- accessibility review and remediation
- Msg-replay proof updates for product-meaningful interaction families
- design-module wording cleanup
- trace cleanup between changed UX states and governing authority

A UX sprint may not escrow:

- product-truth-changing `Msg` variants that lack an admitted carrier
- new or changed `AssetSurface` contracts or equivalent typed product contracts
- new navigation, information architecture, or selection authority that changes
  product meaning
- runtime, governance, closure, continuation, lineage, provenance, or evidence
  semantics
- release criteria or method law

If one of those appears, the sprint records the finding and the work exits the
UX sprint path through standalone repricing or sprint supersession. The UX layer
must still not become the hidden constructive carrier.

A UX sprint should close when continued iteration is more expensive or less
trustworthy than review. Valid close triggers include:

- the declared timebox ends
- accumulated changed states are too numerous for casual review
- screenshots or walkthrough evidence no longer explain the current surface
- interaction behavior changed beyond visual polish
- reviewer uncertainty makes more iteration unsafe without reconciliation

UX sprint close is a forensic walkthrough. The walkthrough reviews each changed
screen, state, and product-meaningful interaction against the cited authority.

Each finding is classified as:

- `accepted`: compliant with this method and the cited design
- `local_paydown`: local UX debt remains and is captured by a paydown ticket
- `design_reframe`: design authority must change
- `requirement_reprice`: requirement authority must change
- `product_reprice`: product definition must change
- `remove`: the change should be backed out or kept out of closure

The sprint may close with explicit local paydown tickets only where the debt is
local to UX realization and the governing method allows follow-up. It may not
close while product-truth carrier gaps, hidden state continuation, or authority
drift remain unclassified.

Method closure for a product UX surface still requires the §8A Msg-replay proof
and §11 accessibility obligations unless an explicit exemption is recorded. The
sprint can defer those obligations during iteration; it cannot erase them.

---

## 14. Failure Pattern

A UX surface is violating this method when any of these are true:

1. render code mutates state directly (assignments inside the render body, mutating a prop or context value)
2. view-local state cells carry product-meaningful state instead of view-local ephemera
3. an effect handler contains conditional logic that decides state transitions
4. multi-step state machines live in the view rather than in the reducer
5. mutable refs are read during render outside the declared effect membrane
6. UX-local types shadow or re-declare back-end types instead of importing from the shared contract
7. selection or action emission writes to file or network without going through an `AssetSurface` action
8. view-shape exemptions (per §9) are taken without a recorded design-module entry
9. accessibility is omitted on a public product capability without a recorded exemption
10. two-way binding emits no typed `Msg` action and the reducer is bypassed
11. logic that should be a `Cmd` is implemented imperatively inside an effect handler
12. the view's behavior cannot be replayed by replaying its `Msg` log against an empty `State`
13. a product-truth-changing UX message has no admitted carrier, graph function, runtime command, or typed product contract
14. external data crosses into UX state without runtime validation
15. a scaffold or debug surface is reachable, mutating, or used as proof without the §13A exemption record
16. a project-local ADR, component convention, or existing code pattern is used to weaken this method
17. a UX sprint claims closure while deferred proof, accessibility, carrier,
    scaffold, or authority debt remains unclassified or un-ticketed

Any of these is a method violation. Repeated violations are not normalized by usage; they are repaired or the surface is repriced.

---

## 15. Review Questions

A UX surface review under this method should answer:

1. What is the surface's `State`, `Msg`, and `Update`?
2. What is the surface's `Cmd` and `Sub` algebra?
3. Which `AssetSurface` or equivalent typed contracts does it bind to?
4. Which product-truth-changing messages map to admitted carriers?
5. Where is the effect membrane, and what `Cmd` values does it interpret?
6. Is `View = f(State)` provably pure for this surface?
7. Can the surface's behavior be replayed from a `Msg` log (the §8A Msg-replay proof)?
8. Are all UX-consumed types imported from the shared contract?
9. Are all out-of-process payloads runtime-validated before entering UX state?
10. Are view-shape, effect-membrane, accessibility, scaffold, or debug exemptions documented?
11. What realization stack is chosen, and how does it preserve the §4 Elm process model?
12. Does the surface honor the §8 view-does-not-own-continuation rule under user replay?
13. Does the design module include the `DESIGN_MODULE_METHOD.md` carrier set and structural carrier diagram required for closure?
14. If the work used a UX sprint, did close review classify every deferred proof,
    accessibility, carrier, scaffold, and authority finding?

If any of these cannot be answered, the design module is incomplete.

---

## 16. Relationship To Other Method Surfaces

- `SPEC_METHOD.md` governs constitutional process, authority flow, repricing, and migration law.
- `ODD_METHOD.md` governs graph-native constructive carrier law. UX surfaces are projection / query surfaces under §10 of that method.
- `DESIGN_MODULE_METHOD.md` governs deterministic realization discipline at the module level. `UX_METHOD.md` refines it for UX modules.
- `TICKET_METHOD.md` governs ticket and sprint lifecycle. UX work may use sprint compliance escrow under §13B when the sprint boundary makes deferred proof visible, bounded, and payable.
- `WORLD_MODEL_METHOD.md` governs world-model semantic law for products that have a world-model dimension. UX surfaces over world-model state still bind through `AssetSurface` (or equivalent) per §7.

A UX-touching design module reads `DESIGN_MODULE_METHOD.md` plus `UX_METHOD.md`. A non-UX design module reads `DESIGN_MODULE_METHOD.md` only and ignores this surface.

---

## 17. Non-Goals

`UX_METHOD.md` is not:

- a styling guide or design system specification
- a component library
- a brand or visual-identity surface
- a wireframing or prototyping process
- a research method for user studies
- a stack ranking or framework recommendation

Those are valid concerns; they belong in product-local surfaces, not in this constitutional method.

---

## 18. Canonical Compression

`UX_METHOD.md` adopts the **Elm Architecture** as the constitutional UX process model and refines `DESIGN_MODULE_METHOD.md` for UX surfaces. The model: typed `State` held by the runtime, typed `Msg` algebra, pure `Update : (Msg, State) → (State, Cmd)`, pure `View : State → ViewTree`, side effects as `Cmd` values interpreted at a declared effect membrane that returns `Msg` to the reducer. The view does not own continuation (UX twin of `ODD_METHOD.md` §11.5A); the **Msg-replay test** is the discipline check. The realization stack is the project's choice, recorded in the design module along with justification of model preservation. The method tests realizations against §4–§10 and the §14 failure patterns; it does not rank stacks, languages, or frameworks.

When adopted, this method is the sole UX realization authority for the covered
surface. Product-truth-changing UX messages must map to admitted product
carriers; the UX layer must not become the hidden constructive carrier. External
payloads are runtime-validated before entering UX state. Scaffolds and debug
surfaces are governed unless explicitly exempted, bounded, and retired. UX
sprints may defer local proof and cleanup only as visible compliance escrow;
close review must classify and pay down the debt before method closure is
claimed.
