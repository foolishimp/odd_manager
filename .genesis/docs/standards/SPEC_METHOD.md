# Spec-Driven Homeostatic Methodology

## Canonical Compression

Spec-driven development treats specification as constitutional source, not
commentary on code. Methodology defines the process constitution. Intent,
product definition, and requirements define the project constitution.
Specification defines `WHAT`. Design and realization define `HOW`. In tenanted
projects, `build_tenants/` holds one or more independent `HOW` realizations of
the shared `WHAT`; it does not define a rival constitution. Requirements define
the full constitutional what: capabilities, guarantees, governance, and
verification obligations. Design defines the structural how, and ADRs are one
durable form of that design record. The SDLC is a governed disambiguation
pipeline: each major boundary reduces the space of lawful interpretations and
must surface major ambiguity explicitly. Ambiguity detection is mandatory;
blocking or escalation is policy-driven by declared risk appetite, except for
hard-stop prerequisite failures. Products, applications, modules, graph
functions, build tenants, and runtime surfaces are implementations of the
constitutional documents, not substitutes for them. Scenarios verify
operational meaning where capability claims need end-to-end proof. Code
realizes decisions. Design must
be derivable from requirements, which are themselves derivable from goals,
intent, and product definition; code must be derivable from requirements and
design. Iteration is cumulative repricing, not waterfall.
Events, projection, and delta reveal drift. Every live requirement family must
have design ownership, explicit classification, and downstream closure or
explicit deferment. Every design record must ground itself in requirements.
Shipping behavior must trace back to constitutional authority. Live
constitutional surfaces are versioned history and must change by supersession
or withdrawal, not silent in-place mutation. New intent emerges from real use
cases hitting the current model through explicit gap analysis, not ad hoc
pressure. Sprints are execution-control batches for pricing proof cost and
forcing close review; they are not authority layers and cannot hide drift.

---

## Position

Spec-driven development treats specification as constitutional source, not as
commentary on code after the fact.

The point is to make software re-derivable, auditable, and correctable under
explicit authority.

Its overriding bias is declarative rather than imperative.

In the age of LLMs, the system should primarily declare truths, structures,
interfaces, constraints, and evidence surfaces, then let lawful processing
derive and realize work from that declared surface.

Imperative procedure still exists, but it is subordinate to declared authority.

---

## Probabilistic Work Boundary

Spec-driven development exists to govern the boundary around work, not to absorb
the worker's internal solution strategy into the framework.

For any probabilistic, agentic, or delegated work unit, the live specification
and design should declare:

- the input and output contract
- the required context
- the capability or role expectation
- the admissible evidence and evaluator regime
- the provenance obligation
- the lawful stop, hold, gap, continuation, or completion states

The worker, tool, agent, or domain implementation owns the internal HOW inside
that declared boundary unless the product explicitly promotes part of that HOW
into reusable declared structure.

Deterministic checks and validation are evidence surfaces. They may optimize or
prove a domain-local path where the domain can make part of the work precise.
They do not authorize the methodology, runtime, or framework to absorb domain
solution strategy as constitutional law.

In graph-native refinements such as `ODD_METHOD.md`, this boundary is usually
one vector or edge traversal. The traversal is the admissible external space.
Any unconstrained part of an F_P worker's reasoning remains hidden
worker-internal traversal and must be forced back through declared contracts,
evidence, provenance, and control truth.

If a framework layer begins prescribing domain solution strategy beyond the
declared work contract and control truth, it has crossed its authority boundary.

---

## Recursive Product Taxonomy

Software is recursive and compositional.

A released product may be used to build:

- the next released version of itself
- a dependent product
- downstream project artifacts

Most taxonomy drift in recursive software systems comes from collapsing these
roles into one overloaded word such as `product`.

This methodology therefore distinguishes:

- **Substrate**: a lower product or runtime used to build other products
- **Source Project**: the mutable workspace building the next release cut
- **Release Cut**: the tapped immutable boundary over the accepted feature set
- **Product**: the released immutable thing resulting from that release cut
- **Install**: a stamped workspace instance of that released product
- **Artifact**: any published output built by a source project or by a
  configured installed product

The governing rules are:

- do not call a mutable source workspace a product
- do not confuse a tapped release or installed product with the mutable source
  project building the next cut
- `PRODUCT.md` is the product-definition surface of a source project, not the
  released product artifact itself
- products may depend on other products
- installed products may build the next version of themselves or other products

The compiler analogy is the intended model:

`bootstrap source -> release P0 -> install P0 -> use P0 to build source for P1 -> release P1`

This taxonomy is load-bearing.

If it is blurred, dependency and self-hosting errors compound quickly and are
expensive to unwind.

---

## Manifesto

We define the current **goals** for the active body of work before repricing deeper constitutional layers.

We work from **intent** before implementation.

We define the current **product definition** in explicit present-tense terms before decomposing it into detailed requirements.

We define the full constitutional **what** in **requirements**, not merely a feature list.

We prefer declaring desired truth and lawful boundaries over prescribing step-by-step imperative procedure.

We make **design** the explicit structural bridge between requirements and code.

We require **code** to be derivable from requirements and design, not defended as accidental precedent.

We treat spec-driven development as a **disambiguation pipeline**: each major gate reduces the space of lawful interpretations before downstream realization proceeds.

We demand **evidence** for claims through scenarios, tests, events, projection, and delta.

We treat **repricing** as part of correctness: when reality exposes a constitutional gap, the specification must change.

We keep **authority directional** even while iterating: goals govern intent, intent governs product definition, product definition governs requirements, requirements govern design, and requirements plus design govern code.

We keep the **live operative surface** in the present tense only: once a new current reality is established, transitional paths are erased from the live product unless explicitly retained as compatibility features.

We treat **derived artifacts** — indexes, trace matrices, reports, automation, generated views — as helpful read models, never as constitutional truth.

If these claims do not hold, the work is not genuinely spec-driven.

---

## Spec-Drivenness Litmus

The work is not genuinely spec-driven if any of these fail:

1. Given goals, a competent team cannot derive a conformant intent surface.
2. Given intent, a competent team cannot derive a conformant product-definition surface.
3. Given product definition, a competent team cannot derive conformant requirements.
4. Given requirements, a competent team cannot derive a conformant design.
5. Given requirements and design, a competent team cannot derive conformant code.
6. A live requirement has no explicit status, category, or owning design decision.
7. A live requirement has no downstream realization or explicit deferment surface.
8. Code behavior exists without requirement and design authority.
9. A live domain artifact is rewritten in place after becoming part of the live constitutional surface.
10. A capability claim has no operational evidence.
11. Drift is discovered, but the constitutional source is not repriced.
12. A major ambiguity at a constitutional or realization boundary is neither recorded nor explicitly governed.
13. A material product, module, function, application, runtime surface, or
    capability has no declared operational lifecycle signal and no recorded
    gap for unanswered release, deployment, live-use, telemetry, or retirement
    questions.

---

## Process Constitution

This methodology is not only a local operating note for one implementation. It is the process constitution for building projects by spec-driven development.

Its role is meta-constitutional:

- it defines how goals, intent, product, requirements, design, code, evidence, and repricing relate
- it defines what counts as specification sufficiency
- it defines what kinds of requirement truth exist
- it defines how authority flows during iterative delivery

Therefore, if a project's implementation disappears, this methodology should still be sufficient to bootstrap a new spec-driven project process from scratch.

The important boundary is:

- `SPEC_METHOD.md` defines the process constitution
- `GOALS.md` defines the current overriding concerns for the active body of work
- `INTENT.md` defines domain direction
- `PRODUCT.md` defines the current product-definition surface of the mutable source project
- `specification/requirements/` is the live requirement surface derived from product definition
- a shared design surface plus any tenant-local design surfaces choose the concrete mechanism
- when a project realization model uses build tenants, `build_tenants/` is the project-owned realization root beneath one shared specification

The authoritative split is strict:

- `specification/` defines `WHAT`
- design and realization surfaces define `HOW`
- no build-tenant, design, code, or derived surface may become co-equal constitutional authority with `specification/`

Structurally, `requirements/` is a folder under `specification/`. Requirements may be stored as individual files or grouped into requirement families. The purpose of this shape is to avoid collapsing the constitutional surface into one monolithic requirements document.

This is one expression of the broader declarative bias: we prefer declaring requirement structure and family boundaries over maintaining one imperative catch-all document.

So if project-specific design and code disappeared, recovery would proceed through this methodology plus the surviving domain specification. Methodology alone can bootstrap the process; methodology plus domain specification can reconstruct the project.

---

## One Constitutional Surface And Version Boundary (`STDO-SURFACE-001`)

The shared methodology is modular in authorship and singular in authority.
Each law has one owning standard; other standards consume it by reference. The
standards become operative only as one complete released STDO version.

A released cut identifies its exact member set, member digests, review basis,
human acceptance, and immutable identity. Compressions, templates, comments,
candidate work, installed copies, and mutable source are derived, evidential, or
authoring surfaces. They cannot become a selectable partial constitution or
reinterpret the owning standards.

STDO owns normative construction algebra, authority relations, abstract state
and transition laws, admissibility conditions, necessary causal order, and
evidence invariants. Consumers own concrete Product realization: instantiated
types and schemas, files, tools, runtime and orchestration machinery, tests,
and executable conformance implementation. A concrete form is method law only
when the method explicitly accepts it as an interoperability boundary.

A shared-method amendment cannot create an executable tool, workflow engine,
runtime, assurance system, or consumer realization as STDO Product scope
without separate explicit human authorization. An agent recording a ruling
cannot widen its subject, implication, authority, or change class.

Only a released method version is publication authority. Mutable method source
may author a future cut; it must not silently govern a consumer.

---

## Constitutional Chain

```
Goals → Intent → Product Definition → Requirements → Design → Code → Events → Projection → Delta
                                                                                       ↓
                                                                                  Scenarios
                                                                                       ↓
                                                                                Gap Analysis
                                                                                       ↓
                                                                    Repricing / New Goals / Intent
```

- **Goals** define the current overriding concerns for the active body of work.
- **Intent** defines purpose and direction.
- **Product Definition** defines the current product realization of the mutable source project, its key terms, and end-state shape in terms that can be decomposed into requirements.
- **Requirements** define invariant truths the system must satisfy.
- **Design** defines the structural decisions, interfaces, carrier surfaces, and delivery topology that make those truths achievable.
- **ADRs** are one durable form of design record, not a second constitutional layer above design.
- **Code** realizes those decisions.
- **Events** record what actually happened.
- **Projection** reconstructs current truth from the event stream.
- **Delta** reveals drift between intended truth and realized state.
- **Scenarios** test operational meaning — can the system actually do the thing the words describe?
- **Gap analysis** identifies where real use cases hit the current model and reveal insufficiency.
- **Repricing** updates goals, intent, product, requirements, design, or code when the system no longer harmonizes. When gap analysis reveals constitutional insufficiency, it generates new **Goals** and/or **Intent**.

This is the homeostatic loop. Every link in the chain is load-bearing. A break at any link — goals with no downstream repricing path, an unowned requirement, an ungrounded design record, code without a design decision — creates accidental law.

`GOALS.md` is the bounded work-wave surface. It captures the current overriding concerns for the next body of work, keeps temporary focus out of deeper constitutional layers until it is intentionally repriced there, and is more immediate than intent while remaining higher-level than product definition and requirements.

`PRODUCT.md` is the bridge between direction and obligation. It states the current product-definition surface of the mutable source project in present-tense terms, names the product terms and boundaries that downstream layers rely on, and provides the surface that requirements decompose.

`PRODUCT.md` is not the tapped release artifact and not the installed product.

Those belong to the recursive product taxonomy above.

Requirements are the constitutional **what** of the project. They are not limited to user-visible product features. The live requirement surface may include capabilities, invariants, constraints, governance, and verification obligations. What matters is that each requirement states something the project must make true.

Design is the structural **how**. It chooses the concrete realization that satisfies requirement truth: interfaces, topology, file placement, carrier documents, entry/control surfaces, runtime wiring, and lawful tenant boundaries. Requirements may require such surfaces to exist and be delivered; design chooses where and how they are realized unless the path itself is constitutional.

Where a project uses build tenants, that split remains exact:

- `specification/` is the shared constitutional `WHAT`
- `build_tenants/` contains one or more independent `HOW` realizations of that shared `WHAT`
- tenant-local realization is derivative unless and until the governing truth is ratified in specification

---

## Sprint Execution Boundary

A sprint is a bounded execution-control surface.

It is not a new layer in the constitutional chain.

A sprint may batch work, coordinate tickets or iteration entries, price proof
cost, and force close review under existing Goals, Intent, Product Definition,
Requirements, and Design authority. It must not create, supersede, weaken, or
override that authority.

A lawful sprint states at least:

- the goal or work-wave it serves
- the upstream authority surfaces it depends on
- the scope it admits
- the product, requirement, design, runtime, data-contract, or governance
  boundaries it excludes
- the change classes it expects to contain
- the local proof or compliance debt, if any, that may be deferred during the
  sprint
- the closure trigger and closure law
- the paydown or repricing path for debt discovered at close

Sprints exist because proof cost is not uniform. For some work, especially
projection-surface and UX iteration, proving every micro-change before the next
change can cost more than making the bounded change visible and correcting it
at close. That optimization is lawful only when the deferred cost remains local,
visible, bounded, and repayable.

Deferred compliance inside a sprint is escrow, not acceptance. It cannot satisfy
method, release, or product closure until it is paid down, explicitly accepted
under the governing method, or repriced into the appropriate upstream surface.

A sprint may be recommended for close when any of these become true:

- its timebox expires
- the intended scope has been reached
- accumulated changed surface area makes continued iteration more expensive
  than review
- review uncertainty makes more work unsafe without reconciliation
- discovered gaps suggest the sprint boundary is no longer the right container

Sprint close is a forensic reconciliation event, not automatic approval. Close
review compares the accumulated work and evidence against the governing
authority, classifies each gap, accepts compliant work, opens paydown work for
local debt, and escalates any authority drift through the lawful change class.

If a sprint discovers a goal, intent, product, requirement, design, runtime,
data-contract, governance, or other product-truth change, the sprint manifest
does not authorize landing that change. The work must be split, escalated,
repriced, or carried as explicit paydown according to the governing method.

`TICKET_METHOD.md` defines the sprint and ticket mechanics. Domain refinements,
such as `UX_METHOD.md`, may define when sprint compliance escrow is an
appropriate cost optimization for that domain.

---

## Ambiguity Governance Rule

Spec-driven development is not only a derivation pipeline. It is a governed
disambiguation pipeline.

The point of the upstream chain is to progressively reduce ambiguity:

- goals narrow active priority and work-wave focus
- intent narrows direction and scope
- product narrows current realization shape and terms
- requirements narrow constitutional obligation
- build-tenant or stack choice narrows executable realization class
- design narrows structural interpretation
- implementation narrows local realization detail

This narrowing is not uniform. The methodology distinguishes between:

- **major ambiguity**: ambiguity that materially changes architecture, stack,
  product boundary, execution/deployment admissibility, public contract shape,
  or other downstream realization law
- **micro ambiguity**: local implementation choice that remains inside an
  already-governed design boundary

Major ambiguity must always be surfaced and governed. It may not remain hidden
inside informal operator judgment, ambient precedent, or silent model choice.

Therefore, at each major boundary the process must:

- detect and record the major ambiguity that remains or is newly introduced
- identify the affected invariant, asset, or decision boundary
- record the decision taken if work proceeds
- record whether the ambiguity was resolved, carried forward, escalated, or
  blocked

Ambiguity detection is mandatory. Blocking is policy.

The default governance model is:

- ambiguity may be carried or decided by lawful probabilistic processing when
  project policy allows it
- ambiguity may be escalated to explicit human adjudication when project policy
  requires it
- the threshold between those actions is determined by declared risk appetite,
  not by silent convenience

Projects may therefore choose different ambiguity-handling policies. A lower
risk appetite escalates more major ambiguity to explicit human judgment. A
higher risk appetite permits more bounded probabilistic decision-making. In either
case, the ambiguity and the decision must be recorded.

Some conditions are not optional ambiguity decisions and therefore remain hard
stops regardless of risk appetite. Typical hard-stop classes include:

- violated invariant or guarantee
- absent required authority surface
- missing declared capability for an executional or operational stage
- undeclared irreversible side effect
- explicit policy gate requiring human approval

The methodology is therefore not "eliminate all ambiguity before work." It is
"make ambiguity visible, govern it explicitly, and reduce it progressively until
downstream realization is sufficiently constrained."

---

## Operational Lifecycle Sufficiency Rule

Constitutional specification must treat a designed thing as more than its build
shape.

Any material product, application, module, graph function, runtime surface,
plugin surface, public interface, data surface, or capability has an operational
lifecycle. The canonical operational lifecycle chain is:

```text
intent
  -> requirement
  -> build
  -> assurance
  -> release
  -> deployment
  -> live usage
  -> observed telemetry
  -> retirement
```

`PRODUCT.md` and the requirement surface do not need to prescribe the detailed
implementation mechanism for every phase. They do need to provide enough
constitutional signal for downstream design to derive the intended lifecycle,
or explicitly record the unresolved ambiguity.

For product definition, this means naming the current product boundary, intended
use context, release/install posture, live-use posture, observability posture,
and retirement or supersession posture where those materially affect the
product's meaning.

For requirements, this means stating any invariant obligation that governs
build, assurance, release, deployment, live usage, telemetry, retirement,
ownership, source truth, authority boundary, or downstream interpretation. A
requirement may defer a phase only by naming the deferment and the surface that
will own its later resolution.

This rule is an ambiguity detector, not a demand that every requirement become
a release plan. If a phase is not applicable, say why. If the phase is unknown,
record a named gap such as `Gap:` or `Unanswered:`. Silent absence is not a
valid lifecycle answer.

When the lifecycle signal is missing, downstream design may not fill the gap by
local convention, implementation precedent, prompt prose, or test fixture. It
must reprice the appropriate constitutional surface or carry the ambiguity as
explicit, governed debt.

---

## Change Management Rule

Every substantive change begins with intake triage, an explicit declared change
intent, and a lawful re-entry point into the constitutional chain.

### Universal Intake Triage

There is one front door for substantive change.

The intake label does not determine the process class.

That means a reported:

- bug
- feature request
- issue
- regression
- operator finding
- release blocker
- scenario failure

all enter through the same intake-triage process.

Intake triage must determine:

- whether the report represents a substantive change at all
- the affected product boundary and intended scope
- the lawful change class
- the lawful re-entry point into the constitutional chain
- the downstream surfaces and evidence that must be repriced, re-derived, or
  re-proved
- whether the work remains within the currently declared release scope or
  requires repricing of that release plan

No bug, feature, issue, or other intake may bypass this triage by going
straight to code, tests, or release handling.

The purpose of triage is not to create a separate tracking bureaucracy. It is
to classify impact correctly so the change enters the method at the right
constitutional boundary.

The minimum lawful change classes are:

- `goal_reprice`: current bounded work-wave focus changes; re-enters at Goals and may flow through Intent, Product, Requirements, Design, Code, and Evidence where that focus changes deeper constitutional truth
- `intent_reprice`: directional or scope change; re-enters at Intent and flows through Product, Requirements, Design, Code, and Evidence
- `product_reprice`: current product realization changes while directional intent remains stable; re-enters at Product and flows through Requirements, Design, Code, and Evidence
- `requirement_reprice`: constitutional truth changes while project direction remains stable; re-enters at Requirements and flows through Design, Code, and Evidence
- `design_reframe`: realization structure changes while active intent and requirement truth remain stable; re-enters at Design and flows through Code and Evidence
- `realization_refactor`: local code, configuration, or attribute change with no intended constitutional or structural change; re-enters at the realized surface only and must prove no upstream drift

Smaller changes may re-enter below Goals only if they explicitly assert that no
upstream constitutional surface is changing.

The absence of a declared change class is process drift.

---

## Consistency Gate Rule

No gate may close while the affected active surfaces are internally inconsistent.

For the declared change span, the framework must prove:

- the upstream surface remains sufficient for the downstream surface
- downstream artifacts do not contradict active upstream truth
- tests and qualification prove the active intended behavior rather than stale precedent

If that proof is missing, the change remains open even if one local artifact already looks correct.

When a code/test mismatch appears during ticketed work, implementation behavior
is evidence but not authority. The mismatch is reconciled through the admitted
ticket, its intake triage, its lawful re-entry point, and the governing
requirement, design, module, graph, carrier, or closure surface. `TICKET_METHOD.md`
defines the ticket-local test-case authority rule.

---

## Product Outcome Conservation (`STDO-UP-013`)

Every Product-outcome-bearing work wave identifies one explicitly selected,
unresolved, directly verifiable Product-defined outcome and declares the
acceptance interval for that instance. Product-progress claims and promotion
onto the supported Product path are judged against that same outcome.

Evidence distinguishes material advance, prerequisite readiness, preservation,
and regression. Only material advance projects Product progress. Prerequisite
work names the Product obligation it enables and remains bounded. Preservation
is useful evidence but is not progress.

The exact bound outcome instance stops selecting later Product-progress work
when the owning authority accepts it. Its witnesses remain regression and
preservation evidence. Acceptance exhausts only that instance and its declared
acceptance interval. It does not discharge an enduring guarantee, recurring
obligation, or broader Product family beyond the accepted instance. Further
work against the accepted instance is preservation, a named bounded
prerequisite for another admitted outcome, or a new change requiring lawful
repricing; it is not additional progress against the accepted instance.

Selecting the next unresolved outcome already defined by Product is a Goals and
work-sequencing decision. Changing an outcome's meaning or scope, or introducing
a new Product outcome, requires lawful re-entry at Product.

Evidence evaluates and constrains its bound Product claim. Completion of a
proof surface, matrix, coverage ledger, inventory, design-method artifact, test
suite, or other evidence surface cannot by itself select, enlarge, or replace
the Product outcome. If an assurance capability is explicitly defined as
Product behavior, delivery of that capability is judged as Product progress;
its evidence still does not author the claim. The same artifact may be Product
output for one claim and evidence for another only when those roles are
declared separately.

Within a Product-outcome-bearing work wave, material realization growth derives
authority from the selected unresolved Product outcome, an admitted named
bounded prerequisite to it, or an admitted named bounded experiment whose
stated observation discriminates a stated decision for it. A prerequisite or
experiment authorizes only its declared provisional bound. It does not select
or enlarge the Product outcome, authorize downstream work, confer promotion or
closure, or waive applicable Prime, design, safety, authority, or release law.

Admission or renewal of a prerequisite or experiment belongs to the authority
owning the selected work wave, or its explicitly bounded proxy, and is recorded
in the existing durable Goals or ticket authority. The admitted basis states
its provisional bound and exhaustion or falsification condition. Satisfaction
of an experiment's stated decision-discriminating observation exhausts that
experiment. Drafting or validating a ticket or execution contract, retaining
active status, or holding a prior admission cannot create, extend, or renew the
basis.

Acceptance of the selected outcome, discharge of an admitted prerequisite, or
resolution of an admitted experiment's stated decision exhausts that basis. A
basis or bound also ends when another admitted terminal condition is reached or
it is rejected, withdrawn, superseded, repriced away, or falsified by evidence.
Ended authority cannot be renewed by repair, continuation, evidence, active
ticket or run state, or prior admission; further material work requires a new
admission by the owning authority or its explicitly bounded proxy.

Retention as supported Product behavior, required evidence, regression
protection, or bounded donor material does not confer further growth authority.
Consumers own deletion, archival, quarantine, and salvage mechanics. Salvage
carries only the explicitly re-adopted semantics; it does not inherit the
enclosing work's authority, dependencies, completion claim, or power to select
further work.

A regression or unresolved gap blocks further promotion on the affected path
until repaired, repriced, or accepted by the owning authority. It does not
globally serialize independent work. Parallel work may proceed under its own
admitted basis but cannot be laundered into the governed outcome's progress
claim.

Outcome success is necessary delivery evidence, not complete Product or release
closure.

## Proportional Method And Delivery (`STDO-UP-014`)

Proportionality is the relation between semantic ambiguity removed and
effective reasoning complexity introduced. A method obligation is proportional
when its contraction of the admissible interpretation space justifies the
additional concepts, relations, projections, and evidence that an agent must
hold together to reach a correct decision.

Effective reasoning complexity includes independent concepts and authority
surfaces, cross-document joins, exceptions and branching, states and
transitions, duplicated representations requiring reconciliation, and the
detail required to decide the governed question. It is not raw line count,
artifact count, or context-window size. Detailed algebra, Ontology, IACS,
Prime, or semantic views may be highly proportional when they eliminate rival
interpretations. A short additional ticket, receipt, or summary may be
disproportionate when it creates another truth surface without reducing
uncertainty.

A proportional method deliberately constrains the admissible reasoning and
realization space. Each constraint must identify the semantic ambiguity it
removes and must contract enough of the admissible interpretation space to
justify the reasoning complexity it introduces. Rival authority, uncertainty
over failure classification, and evidence uncertainty count only where they
leave materially distinct admissible semantic, authority, outcome, or
acceptance interpretations. They measure or evidence the same interpretation
space removed; they are not independent proportional benefits.

The method does not prescribe an internal decomposition, search,
collaboration, tool, or synthesis procedure when variation in that procedure
cannot affect a governed semantic, authority, evidence, safety, or release
property. Increased agent capability may enlarge the bounded relation an agent
can resolve; it does not grant authority, weaken an invariant, or waive
acceptance.

The owning law may justify one coherent constraint family once. This does not
require a rationale field, receipt, or repeated audit for every clause or
consumer application.

For symbolic design, materially divergent implementation paths, runtime states,
tests, reviews, and reconciliation joins are counterfactual evidence of the
semantic alternatives that the design contracts. They are not an independent
numerator. When one bounded symbolic model can resolve those material
alternatives within effective reasoning capacity, resolving it at design
altitude is proportional even when the model is detailed. A prior design
surface that removes no material semantic alternative remains
disproportionate.

A method addition is disproportionate when it duplicates truth, increases
reconciliation paths, or expands the bounded reasoning surface without
materially reducing ambiguity. Existing obligations should absorb new detail
where they can do so without weakening ownership or meaning.

Delivery priority applies the same relation to the current Product outcome,
likelihood, impact, reversibility, dependency, and cost of delayed Product
feedback. Probability informs lawful priority; it does not waive authority,
integrity, safety, retained release claims, or another hard stop.

The default priority is work that exposes or advances the smallest supported
Product path and its highest-value likely failures. Defensive or prerequisite
work that displaces that path identifies the affected claim, evidence basis,
bounded effort, return condition, and expected Product consequence. This is a
priority relation, not a fixed global execution sequence or scheduling runtime.

---

## Core Interface Migration Rule

Core interface changes are not ordinary local patches.

Where a change alters a load-bearing contract, carrier, resolver, provider,
projection law, closure law, or other shared interface that multiple surfaces
depend on, the work must be handled as a constitutional migration rather than
as incremental patching.

The governing rule is:

- change the authoritative core contract first
- ban bridge code for that contract family as an authoritative surface
- audit every producer and every consumer of the impacted interface
- migrate each producer and consumer to the new contract
- chase every downstream effect until no superseded closure law remains
- run complete migration-closure proof only after the migration wave is
  complete; bounded Product-slice proof remains governed by the path-relative
  promotion rule below

This rule exists because partial interface migration creates recurring drift:

- one producer writes the new contract while another still writes the old one
- runtime reads one carrier while reporting or topology reads another
- compatibility aliases silently remain authoritative
- projections become a second truth surface
- tests go green while architecture remains split

Spec-driven development forbids declaring such a state complete.

### Constitutional Migration Options

Core interface and major implementation replacement work has two lawful
constitutional strategies:

- **Inside-Out Hard-Break Migration**: use this when the project remains on the
  same implementation line and the authoritative source truth is being replaced
  in place. The work proceeds from source carrier outward through a sequence of
  deliberate breaks and repairs.
- **Fundamental Re-Adoption Migration**: use this when the rewrite is major and
  the project is intentionally re-deriving itself on a materially different
  implementation basis, such as a new runtime model, carrier model, type
  system, execution substrate, or realization tree. The prior implementation is
  moved sideways and treated as reference material, not live authority.

Where bounded evolution and fundamental re-adoption are both lawful and
feasible, and a working predecessor can reach the admitted Product outcome
without retaining competing or ambiguous authority, evolution on the supported
Product path is the rebuttable selection presumption. This does not require
continuing an unsafe or constitutionally inadmissible predecessor path. It
conserves accepted predecessor semantics and Product feedback; it does not
require preserving an internal implementation or public mechanism that Product
authority explicitly supersedes.

When bounded evolution includes a core-interface migration, it uses the
Inside-Out Hard-Break strategy. Bounded evolution is a strategy-selection
presumption, not a third migration strategy.

Fundamental re-adoption requires explicit selection by the human authority
owning the affected Product boundary. The selection compares re-adoption with
bounded evolution across Product value, feedback latency, authority risk,
reversibility, total cost, and retained predecessor semantics. It also states a
bounded abort or re-entry condition. Implementation scale or architectural
preference alone does not select re-adoption.

Both strategies share these non-negotiable rules:

- no proxy interface partial implementation may stand in for the new contract in
  any acceptance path
- no bridge or fallback path may remain silently authoritative
- promotion of an affected Product outcome requires one unambiguous
  authoritative path for that outcome
- competing or ambiguous executable authority on the promoted acceptance path
  blocks that outcome
- residual material from the superseded interface family outside the promoted
  path may be deferred only when it is explicitly non-authoritative for the
  promoted outcome or governs an explicitly specified, disjoint Product or
  compatibility scope with deterministic routing, cannot falsify current or
  retained Product claims, and retains a bounded migration, qualification, or
  release disposition
- tests are leak detectors and proof surfaces, not the migration plan

For this rule, the affected acceptance path is the full causal closure of the
outcome: every admitted entrypoint, producer, consumer, resolver, fallback,
shared state surface, event, projection, and proof surface capable of changing,
interpreting, or closing the outcome. Singular authority means one governing
authority across that closure, not one selected successful trace. If the same
request, fact, identity, state, or projection is admissible to old and new
authority, authority is competing and promotion blocks.

Product-slice promotion and complete migration closure are distinct claims. An
intermediate Product outcome may be promoted while its enclosing migration
remains open only when the outcome's acceptance path has singular authority and
the residual implementation satisfies the deferment rule above. That promotion
does not close the migration or waive its final retirement criteria. The
slice's identity and acceptance criteria derive from Product plus every causally
applicable live requirement, accepted design relation, and retained predecessor
claim. Ticket or review wording cannot narrow that authority away.

Active migration status does not renew an accepted slice's exhausted growth
authority. Work that only discharges already admitted removal, demotion, and
migration-closure proof obligations may continue within that existing bound
without claiming further Product progress. Further material producer or
consumer growth requires another still-live basis admitted under
`STDO-UP-013`; ticket activity alone is not that basis.

### What Counts As A Core Interface

A core interface includes any shared contract or carrier that materially governs:

- runtime closure
- reporting or status truth
- topology or frame progression
- proof or qualification outcome
- event or projection semantics
- identity or binding resolution
- provider or resolver behavior

If changing the interface can alter how multiple surfaces decide "what is true
now," it is a core interface change.

### Required Migration Protocol

Every core interface migration must explicitly declare:

1. the exact affected migration scope
2. every explicitly excluded or disjoint Product or compatibility scope and its
   deterministic routing relation
3. the new authoritative contract
4. the superseded contract or surface
5. the authoritative closure law for the new contract
6. the full set of producers of the old and new contract
7. the full set of consumers of the old and new contract
8. every projection, report, status surface, and proof surface that derives from it

Every old path must then be classified as one of:

- `remove`
- `replace`
- `re-authorize`
- `temporary scaffolding`

Temporary scaffolding is lawful only if it is explicitly non-authoritative and
scheduled for removal before closure.

### Bridge Prohibition

For a core interface migration:

- no compatibility alias may remain authoritative
- no fallback identity law may remain as silent runtime behavior
- no bridge path may participate in acceptance as if it were the new contract
- no old reader or writer may remain authoritative for the promoted outcome
  once the new contract governs that outcome
- no proxy or partial implementation of the new interface may stand between old
  and new truth as if it were completion

The only lawful exception is an explicit compatibility feature retained as part
of the live product. In that case the compatibility path must be:

- intentionally specified
- explicitly bounded
- clearly identified as compatibility rather than current native truth

### Projection Discipline

Projections, reports, status views, and topology views may reflect the
authoritative carrier.

They must not become a second closure surface.

Therefore:

- if runtime, reporting, topology, and proof can disagree about closure because
  they consume different carriers or different closure laws, the migration is
  incomplete
- if a projection can independently close while the authoritative carrier is
  still open, the migration is incomplete
- if the authoritative carrier can close while a projection still depends on an
  older law, the migration is incomplete

### Inside-Out First Sequencing

Inside-out hard-break migrations must proceed from the new authoritative source
carrier outward.

Therefore:

- the full best-guess interface family must be discovered before proof is used
  as closure evidence, including producers, consumers, projections, prompts,
  reports, wrappers, replay paths, ingest paths, bootstrap paths, and proof
  surfaces
- authoritative producer and source-carrier work comes before downstream
  consumer, projection, prompt, dossier, report, or review-surface hardening
- downstream exploration may exist only as isolated non-authoritative work; it
  must not land in public runtime, projection, prompt, report, or proof entry
  points until the source carrier is published and admitted
- a downstream projection ticket must not close while the source-carrier ticket
  it depends on is still open
- dependency direction must reflect this order explicitly so the ticket set
  exposes the migration wave from source truth to downstream read models

### Hard-Break Discipline

Inside-out migration is a hard-break sequence over one interface family.

The migration wave is the ordered set of those breaks. It is not a separate mode
that permits competing or ambiguous dual truth over the same request, fact,
identity, state, or projection. Explicitly specified, deterministically routed,
non-overlapping Product or compatibility scopes may coexist while the enclosing
migration remains open.

For each break:

1. publish or admit the new deepest authoritative source carrier
2. deliberately sever one old authoritative seam
3. keep that seam broken
4. repair outward from source truth to consumers, then projections, then
   prompts/reports, then proof surfaces
5. run negative proof that the severed seam is rejected rather than merely
   unused

During this sequence:

- tests may discover missed interfaces, but they do not replace the required
  interface inventory
- newly discovered affected interfaces remain part of the same migration wave
  unless the work is explicitly repriced upward
- re-enabling the old seam through wrappers, fallbacks, projections, or prompt
  paths is a migration defect

### Proof-Last Rule For Core Interface Changes

Complete migration-closure proof is not valid while producers and consumers
are split across old and new contracts. Bounded Product-slice proof may establish
only the exact intermediate outcome permitted by the path-relative promotion
rule; it cannot establish migration closure.

Therefore:

- tests that pass only because bridge-state semantics remain alive do not count
  as closure proof
- green local tests do not overrule a split architecture
- migration-closure proof belongs after migration, not during a partially
  migrated state
- per-break proof must show the severed old seam is rejected or fails closed
  before downstream hardening can count as progress

### Closure Criterion

A core interface migration is complete across its declared affected scope only
when all of the following are true:

- every authoritative producer writes the new contract
- every authoritative consumer reads the new contract
- all superseded authoritative paths are removed or explicitly re-authorized
- projections are downstream of the same authoritative truth rather than acting
  as competing truth surfaces
- runtime, reporting, topology, and proof share one closure law
- no temporary scaffolding remains in the acceptance path

Until those conditions hold, the work remains an active migration wave rather
than a completed refactor.

An accepted intermediate Product slice within that wave must therefore name the
slice it closes and keep the enclosing migration visibly open. It must not
project slice acceptance as migration, qualification, or release closure.

---

## Release Version Boundary

The only operative version identifier is the tapped release version.

That version is:

- a point-in-time release decision
- a boundary over the feature set accepted for that cut
- part of release metadata and release-process evaluation

It is not part of the live project specification.

Active constitutional and shared realization surfaces should therefore describe
current truth by role, boundary, and status rather than by release-line version
labels.

Release criteria, release taps, and the process for cutting a release belong to
a separate release process surface such as `RELEASE_METHOD.md`.

---

## Evidence Rules

The following rules govern how constitutional claims are proved in practice.

### Proof Target Identity And Adequacy (`STDO-UP-001`)

Every load-bearing proof identifies the exact subject, intended property,
governing basis, relation between witness and claim, nearest weaker excluded
property, and falsification condition before selecting its witness. Without
those relations, the result is evidence discovery rather than closure-grade
proof.

Packaging, syntax, compilation, file presence, invocation, or local behavior
must not substitute for semantic, authority-bearing, installed, release, or
end-to-end proof merely because the weaker property is easier to measure.

### Semantic, Evidence, And Projection Separation (`STDO-UP-008`)

The method distinguishes:

- **semantic basis**: constitutional and accepted-design relations defining
  what a claim means;
- **evidence basis**: exact artifacts, events, logs, tests, and observations
  used to evaluate it; and
- **state projection**: a current view derived from admitted semantic and
  evidence bases.

Evidence change may invalidate a verdict without changing law. Projection
change may invalidate a view without changing semantic truth. Semantic change
requires lawful re-entry and invalidates affected downstream acceptance. A
broad digest may conservatively invalidate review, but it does not prove that
every semantic relation changed.

## Verification Layers

Each layer in the chain preserves a distinct kind of truth:

| Layer | What it preserves | Primary question answered |
|-------|-------------------|---------------------------|
| **Requirements** | Invariant truth | "What must be true?" |
| **Design** | Structural choice | "How is that truth realized?" |
| **Scenarios** | Operational meaning | "Can the realized system actually do the claimed thing?" |

Without scenarios, important capabilities can appear "covered" because the words exist in requirements and design. Scenarios force the sharper question: can the product *really* do the thing? A requirement can say "compositional graphs" and a design ADR can describe Fragment types, but only a scenario asks "can I model a reusable discovery workflow and apply it twice?"

Scenarios are the product-owner layer. They are concrete, end-to-end use cases that validate the chain from intent to realized behavior. When a scenario cannot be written, the capability is not yet real. When a scenario fails, the gap is between the system's actual behavior and its claimed capability — not between the spec's words and the spec's other words.

Scenarios do not replace requirement categories. They primarily validate capability claims and other behavior with concrete operational meaning. Constraints, governance rules, and verification-infrastructure requirements may require different evidence in addition to, or instead of, end-to-end scenarios.

---

## Testing Strategy Taxonomy

Every executable proof surface must declare its authority source.

For ticketed work, the immediate proof authority is the admitted ticket and its
triage path. Tests derive from the ticket's lawful re-entry point and the
governing constitutional or realization-law surfaces it cites; they do not
derive expected results from current implementation behavior.

Authority source is not the same thing as execution breadth. A test may be
small or broad, fast or slow, deterministic or live, but it still derives from
one of two primary authorities:

1. **Design/module conformance tests**
2. **UAT / acceptance tests**

Design/module conformance tests derive from realization authority:

- governing design
- module ownership
- IACS or equivalent carrier inventory
- structural carrier diagrams when present
- boundary-local fail-closed law

They answer:

- did the implementation realize the module or design boundary correctly?

Unit tests are design/module conformance tests. Module integration tests,
negative tests, and fail-closed tests may also be design/module conformance
tests when their proof target is a designed module boundary rather than a user
scenario.

UAT / acceptance tests derive from constitutional user or product authority:

- requirements
- acceptance criteria
- declared scenarios or use cases
- product-level release or qualification claims

They answer:

- does the composed product satisfy the claimed requirement or scenario?

Under this method, only sandbox tests or an explicitly equivalent isolated
composed-product proof lane may be called UAT / acceptance tests.

A sandbox test must exercise the deployed, installed, or otherwise runnable
product form through declared application, public, runtime, or control surfaces.
It must be driven by a requirement-sourced scenario or acceptance case. Direct
source-level unit tests, helper tests, and module integration tests may be
valuable proof, but they are not UAT and cannot close user acceptance by
themselves.

Sandbox UAT has two lawful execution modes:

- **Harnessed sandbox UAT**: exercises the full composed product path with a
  deterministic, fake, recorded, or injected worker/result surface.
- **Live sandbox UAT**: exercises the full composed product path with a real
  configured worker, tool, agent, service, or other external probabilistic
  transport where the product depends on that live boundary.

Harnessed sandbox UAT proves composition, orchestration, control, projection,
archive, and scenario wiring without relying on live probabilistic execution.
It is the right lane for deterministic reproducibility.

Live sandbox UAT proves that the same scenario can cross the real external
probabilistic boundary and return evidence through the declared result,
evaluation, provenance, and projection surfaces. Where a product or release
claim depends on live probabilistic compute, semantic green, unit green, module
integration green, and harnessed sandbox green are necessary but not sufficient
for live acceptance.

Terminology rules:

- `unit` names module/design conformance scope, not user acceptance.
- `integration` names execution breadth, not authority source.
- `sandbox` names composed-product acceptance execution.
- `harnessed`, `fake`, `recorded`, or `deterministic` name non-live sandbox
  execution.
- `live` is reserved for real external worker or transport execution. A status
  projection named "live" is not live UAT unless it crosses that real boundary.

If a project uses different local filenames or runner labels, the local test
surface must still map each executable lane back to this taxonomy before
claiming closure.

### Fixture And Proof Portability Rule

Required closure lanes must be reproducible from the declared source boundary.

A unit, semantic, or module-design conformance lane must not depend on an
undeclared local path, sibling workspace, operator home directory, or mutable
external fixture.

If a proof needs external project evidence, one of these must be true:

- a minimal fixture is checked into the source boundary
- a fixture manifest declares the external source, version, and acquisition or
  binding rule
- the test is classified as harnessed sandbox, live sandbox, reference
  comparison, or optional local evidence rather than required semantic closure

Missing external fixtures must fail with a governed diagnostic that names the
fixture authority and lane. They must not masquerade as product semantic failure.

---

## Test Authority Rule

Every live requirement must have written testcase authority.

That authority may include scenario bundles, ordered testcase sequences, negative
or control cases, and other explicit evidence cases as appropriate to the kind of
truth being proved, but it must exist in written form and be traceable.

No live requirement is considered fully proved if it relies only on informal
operator confidence, ambient habit, or an unlabeled test corpus.

---

## Scenario Bundle Rule

Features are not proved by isolated assertions alone.

Where a requirement claims meaningful system behavior, the proving surface should
be a scenario bundle or equivalent ordered set of testcases that exercises that
behavior through a coherent sequence rather than as disconnected fragments.

The purpose of the scenario bundle is to show:

- what feature or use-case boundary is being exercised
- which testcase sequence proves it
- what outcomes are expected at each significant step

This is the layer that makes operational meaning inspectable.

Declared scenarios and use cases are not downstream decoration. They put
pressure on feature intent and design decisions by forcing the project to name
the real operational boundary, sequence, actors, controls, and expected
outcomes that matter. For that reason, they are also the best source for
identifying the significant code and control paths that the proving surface must
exercise.

---

## Installed Dev Proof Rule

Where a system has an installable or runnable development form, the decisive
proving lane runs against an installed development version as if it were an
independent project or externalized target, not only against the source tree in
place.

That proof should prefer:

- fresh sandbox or equivalent isolated environment
- installed or built development artifact
- execution through the same declared entry/control/runtime surfaces the real
  product uses

Direct source-level or unit-level checks may remain useful, but they do not
replace installed-dev proof of the system under test.

---

## Significant Path Coverage Rule

The proving surface must declare and exercise the significant paths for the
behavior being claimed.

Exhaustive proof does not mean every possible branch in every file. It means the
project names the meaningful paths and proves them intentionally.

The significant paths usually include, where relevant:

- intended success path
- fail-closed or rejection path
- boundary or control path
- integration, dispatch, or transport path
- recovery, retry, or replay path

If the significant paths are not declared, scenario coverage cannot be judged.
If they are declared but not exercised, the behavior is not fully proved.

---

## Requirement Categories

Every live requirement family shall be categorized by what kind of truth it asserts. This prevents the common mistake of treating the entire requirement surface as if it were only a feature list.

| Category | Meaning | Typical question |
|----------|---------|------------------|
| **Capability** | A behavior, function, or surface the system must provide | "What can the system do?" |
| **Constraint / Guarantee** | An invariant, law, safety property, portability rule, or semantic guarantee that bounds how the system may behave | "What must always remain true?" |
| **Governance** | A policy or control rule over lifecycle, authority, visibility, release, or operator action | "What governs use and change?" |
| **Verification** | A requirement on tests, evidence, traceability, qualification, or forensic surfaces | "How do we know the claim is true?" |

Requirements remain part of the constitutional layer in all four cases. A category is not a priority label and not a claim that the requirement is user-facing. It is a statement of what kind of project truth the requirement owns.

The important distinction is:

- Requirements describe the full constitutional **what**.
- Design describes the structural **how**. ADRs are one durable design form.
- Scenarios validate the operational meaning of capability claims.

Therefore, not every requirement should be translated into a marketed "feature." Some requirements are better expressed as guarantees, constraints, governance rules, or verification obligations.

Requirements should also avoid freezing concrete realization choices prematurely. Unless a path, filename, or packaging rule is itself part of the constitutional truth, those choices belong to design rather than the requirement surface.

---

## Reconstruction Litmus

The methodology is specification-driven only if the layers are reconstructable in order:

1. Given **Goals**, a competent team should be able to derive a conformant **Intent** surface.
2. Given **Intent**, a competent team should be able to derive a conformant **Product** definition.
3. Given **Product**, a competent team should be able to derive conformant **Requirements**.
4. Given **Requirements**, a competent team should be able to derive a conformant **Design**.
5. Given **Requirements + Design**, a competent team should be able to derive conformant **Code**.

This does not mean the derivation is unique. Different designs may satisfy the same requirements, and different codebases may satisfy the same design. The test is sufficiency, not determinism.

Failures at any boundary indicate a specification defect:

- If intent cannot be derived from goals, the goals surface is unclear, contradictory, or not concrete enough to orient the next bounded wave of work.
- If product cannot be derived from intent, the intent surface is too vague, contradictory, or not concrete enough to guide realization.
- If requirements cannot be derived from product, the product surface is underspecified, contradictory, or not decomposable enough to govern implementation.
- If design cannot be derived from requirements, the requirement surface is underspecified, contradictory, or polluted with accidental implementation detail.
- If code cannot be derived from requirements plus design, the design surface is incomplete, ambiguous, or not operational enough.

The purpose of ADRs and design documents is therefore not decorative explanation. They are the load-bearing bridge between constitutional truth and executable realization.

Reconstruction sufficiency also depends on ambiguity governance. If a boundary
can be crossed only by hiding a major unresolved ambiguity, the upstream surface
is not yet sufficient even if some downstream artifact can be produced.

## Design Rule

Requirements state what control or delivery surfaces must exist.

Design decides the concrete mechanism that realizes them.

If a technology stack, carrier, or runtime is not already constrained by an
upstream constitutional surface, choosing it is part of design rather than a
separate upstream authority.

That boundary matters especially for agent-facing bootstrap and control surfaces:

- requirements may say that authoritative bootstrap or control surfaces must be present, carry bare axioms, and route to the canonical method
- design decides whether those surfaces are entry documents, embedded blocks, standalone compiled artifacts, or another lawful topology

If filenames and placement are hardcoded in requirements without constitutional necessity, the requirement surface has absorbed design detail and made re-derivation harder.

---

## Renewal Path

Intent is not only top-down. The full homeostatic cycle includes a reverse path where real use cases generate new intent:

```
Current spec → real-world use case → gap analysis → new goals / intent
```

This is how the system stays alive instead of becoming a frozen constitution. The generative rule:

1. A real use case (scenario, deployment, external review) hits the current model
2. Gap analysis identifies what the constitution cannot express
3. If the gap is constitutional (not just a missing implementation), new goals and/or intent are written
4. The repriced surface then flows forward through the chain: product → requirements → design → code

New intents emerge from repeated, real use-case pressure against the current model — not from abstract speculation. The gap must be concrete before it becomes intent. Ad hoc coding pressure does not generate intent; explicit gap analysis does.

This flow is not a one-pass waterfall computation. It is a cumulative iteration:

- requirements and design are refined over time
- code is repeatedly re-derived against the current constitutional surface
- gaps discovered during implementation, testing, replay, or scenario work feed back into repricing

What must remain stable is the full direction of authority: goals govern intent, intent governs product, product governs requirements, requirements govern design, and requirements plus design govern code, even when the project advances through many iterations.

---

## Trace Closure And Anti-Drift Rule

Spec-driven development requires constitutional trace closure.

### Ownership

- Every live requirement family must map to one or more owning design
  decisions.
- Every ADR or other design record must ground itself in requirements via an
  explicit `Implements:` line.

### Downstream Closure

- No live requirement may remain as a free-floating statement of intent. If it
  is live, it must either:
  - be realized through the downstream chain, or
  - be explicitly deferred with an honest surface that records the deferment.
- Every live requirement family must therefore have downstream closure:
  realized in design/code/tests, or explicitly deferred through an honest
  deferment surface.
- No shipping code or tests may exist as ungoverned behavior. If behavior
  exists, it must trace back out to live requirements and the design decisions
  that authorize it.
- No hidden product surface is allowed. Behavior without trace authority is
  accidental law even if it works.

### Drift Signals

- Unowned requirements, ungrounded design records, deferred requirements
  without explicit deferment, and code without trace authority are design
  drift.
- If an ADR or other design artifact has no requirement grounding, it is design
  without constitutional authority.
- If code behavior has no design owner, the design has already drifted.
- If shipping code or tests cannot trace back out to live requirement and
  design authority, they are ungoverned product surface.
- If tests validate implementation habit rather than requirement truth, they
  lock in drift.
- If events and projection reveal persistent delta, either code is wrong or the
  requirement/design stack is stale.
- If a capability has requirements and design but no scenario, its operational
  meaning is unverified.
- If a requirement is treated as a product feature when it is actually a
  guarantee, governance rule, or verification obligation, the requirement
  surface has been misclassified.
- If a live constitutional artifact is corrected by in-place mutation rather
  than supersession or withdrawal, constitutional history has been corrupted.
- If a real use case reveals a gap not expressible in current requirements, a
  new intent is needed, not a code hack.

Trace closure is stricter than documentation completeness. It is the rule that
closes the constitution over realized behavior.

---

## Live Surface Immutability

The project may accumulate multiple live domain surfaces over time. A live surface is versioned constitutional history, not scratch space.

- Engine code, design documents, tests, and tooling may be refactored aggressively while they remain mutable implementation surfaces.
- Live domain artifacts, once published as live constitutional surfaces, are immutable in place.
- If a live domain artifact is wrong, the valid actions are:
  - supersede it with a new version, or
  - withdraw/delete it from the live surface.
- Transitional implementation paths, migration scaffolds, and fallback behaviors have no permanent authority in the live surface. Once superseded, they are deleted unless explicitly retained as compatibility features.

The past is preserved by version control, operational event history where present, and superseded constitutional artifacts. Spec-driven development does not require shipping compatibility shims forever, but it also does not allow silent mutation of live constitutional history.

---

## Fundamental Migration Rule

A fundamental migration is a constitutional reset, not an in-place refactor.

This rule applies when a project intentionally abandons a prior constitutional shape and re-derives itself on a new branch, version line, or methodology basis.

In that case:

- inherited constitutional documents from the prior line become migration source material, not live authority in the new line
- it is lawful to zero inherited constitutional surfaces on the migration line and rebuild them from first principles
- nothing carries forward by default; every retained statement, requirement, design choice, or guide rule must be explicitly re-adopted
- every carry-forward is intentional and should land in the correct layer: goals, intent, product, requirements, design, guide, or template
- old design and code may be used as reference implementations, but they do not govern the new constitutional surface unless explicitly re-derived and re-adopted
- absence from the new constitutional surface means "not yet adopted" and carries no automatic authority from the prior line
- the prior implementation may be moved sideways as a reference line, but that
  sideways line has no live implementation authority in the new line
- every inherited module, interface, carrier, projection, and proof surface must
  be explicitly classified before reuse

The required implementation classifications are:

- `carry_across`: the module remains materially the same and is intentionally
  re-adopted into the new line
- `redundant`: the module is no longer needed in the new line
- `rewrite`: the module remains needed but must be rebuilt under the new
  requirements and design

Unclassified inherited implementation is a defect.

The purpose of this rule is to prevent accidental law from leaking through migration by mere inheritance. Fundamental migration is controlled adoption, not passive preservation.

When performing a fundamental migration:

1. Declare the migration line and treat the prior line as source material.
2. Establish fresh constitutional surfaces for method, goals, intent, product, requirements, and design.
3. Move the prior implementation sideways if needed so it cannot continue as ambient live authority.
4. Classify inherited constitutional material as adopted, superseded, deferred, or orphaned.
5. Classify inherited implementation material as `carry_across`, `redundant`, or `rewrite`.
6. Copy forward only what is intentionally retained.
7. Re-derive downstream design and code from the new constitutional surfaces, not from ambient precedent.

For a fundamental migration:

- `carry_across` does not mean automatic copy-forward; it means explicit
  re-adoption under the new line
- direct runtime, projection, prompt, proof, or review dependence on the
  sideways implementation line is bridge debt
- proxy interfaces that partially imitate the target line while still depending
  on the sideways line are not lawful closure

This is a lawful form of supersession, not a violation of live-surface immutability, because the new line is creating a new constitutional surface rather than silently mutating the old one.

---

## Transformation Wave Rule

Refactor and migration should be understood as a transformation wave over
mutable implementation surfaces.

While the wave is in flight:

- temporary mixed-state implementation may exist only below the current break
  boundary and only as explicitly non-authoritative plumbing
- transitional adapters or scaffolds may exist only when they are named,
  bounded, and outside the acceptance path
- refactor state may still carry traces of the prior operative model, but never
  as competing or ambiguous dual authority over the same request, fact,
  identity, state, or projection

Explicitly specified, deterministically routed, non-overlapping Product or
compatibility scopes are not competing authority under this rule. They may
coexist while the enclosing migration remains visibly open.

When the wave lands across its declared affected scope:

- only the new current operative surface remains live for that scope
- prior operative paths for that scope are erased from the live product
- the path taken to get there survives only in version control, event history, and superseded records
- mixed old/new operative models are not a stable end state

The only lawful exception is an explicit compatibility feature.

If compatibility is retained, it must be:

- named as current product behavior
- justified in the specification
- bounded in scope
- tested as an intentional feature

Otherwise the correct action is deletion, not passive preservation.

---

## Legacy Classification Rule

Every inherited or legacy requirement must be classified as one of:

| Classification | Meaning | Action |
|---------------|---------|--------|
| **Deferred** | Retained in the live surface as an explicit not-yet-operative or not-yet-realized obligation | Keep with an honest deferment surface and do not present as current closure |
| **Superseded** | Ownership has moved to a newer constitutional surface or design decision | Add Implements/Supersedes to the governing design record |
| **Active** | Remains live constitutional law in the current surface | Must have an owning design decision — write or update one |
| **Orphaned** | No longer part of the intended system | Remove or explicitly supersede |

Nothing live may remain unclassified.

---

## Requirement Classification Rules

Every live requirement family must be classified on two independent axes:

1. **Lifecycle status**
   - Active
   - Deferred
   - Superseded
   - Orphaned
2. **Requirement category**
   - Capability
   - Constraint / Guarantee
   - Governance
   - Verification

These axes answer different questions. Lifecycle status says whether the requirement still belongs in the constitution and whether it is operative or explicitly deferred. Requirement category says what kind of project truth it asserts. A live requirement is incomplete if either axis is missing.

In project documents, this classification shall be explicit in requirement header metadata. `Status` carries lifecycle status. `Category` carries the requirement kind.

---

## Specification Surface Rule

The active specification layers have distinct constitutional roles:

- **Goals** orient the current bounded work wave. They shall not be used as a substitute requirement surface.
- **Intent** states why the system exists and what directional change is in or out of scope. It shall not carry optional realization detail unless that detail is itself constitutional.
- **Product** states the current concrete product definition and bridges intent to requirements. It is not a release note surface. It shall carry enough operational lifecycle signal for downstream requirements and design to understand intended use, release/install posture, live-use posture, observability posture, and retirement or supersession posture where those materially affect product meaning.
- **Requirements** state stable obligations that must be true. They shall carry explicit acceptance criteria and remain sufficient for downstream design derivation, including lifecycle obligations or named lifecycle ambiguity gaps where build, assurance, release, deployment, live usage, telemetry, or retirement materially affect the obligation.
- **Design** states how requirement truth is realized. It is downstream of requirements and may choose structure, interfaces, carriers, packaging, and tenant boundaries.
- **ADRs** are durable design memory. They are not a second requirement surface.

Constitutional specification is current-surface law and shall be written in present tense.

Dead law shall not remain in active constitutional artifacts for historical comfort. If something is no longer live, it shall be deleted, superseded, or moved to commentary. A migration wave does not justify preserving stale constitutional wording inside the live surface.

During a change wave, write the live constitutional surface in terms of the current truth and the declared affected boundary. Do not use version-line branding such as `2.0`, `3.0`, or similar labels merely to indicate recency. Reserve explicit version labels for tapped release facts or clearly historical or superseded material.

Before treating a downstream specification artifact as complete, check the whole affected span:

1. Is the change class clear?
2. Is the re-entry point lawful for that class?
3. Can each downstream layer still be derived from the upstream layer?
4. Do the active intent, product, requirements, design, and qualification surfaces still say the same thing in the affected scope?

If not, the gate is not actually closed.

---

## Bootstrap Rule

The target constitutional shape for a project is:

- `.genesis/docs/standards/SPEC_METHOD.md` as installed process constitution
- `specification/GOALS.md` as current work-wave orientation
- `specification/INTENT.md` as domain direction
- `specification/PRODUCT.md` as current product-definition surface
- `specification/requirements/` as the live requirement surface
- a live shared design surface
- any tenant-local design surfaces required by the realization model

The authoritative path split is:

- mutable methodology authoring lives in the source workspace under
  `specification_methodology/specification/standards/` and governs only a
  future candidate cut
- released methodology authority is the exact immutable STDO version selected
  by the consumer
- installed methodology distribution lives under `.genesis/docs/standards/`
  and must match that selected release
- project-owned constitutional surfaces live under `specification/`

Projects shall not create a competing local methodology root such as
`specification/standards/`.

Method authority is singular:

- selected immutable STDO release authority, projected into the installed
  `.genesis/docs/standards/` distribution
- project constitutional authority in `specification/`

When editing or repricing methodology, the mutable source path is authoring
authority for the candidate being constructed. It is not operative consumer
law before release and explicit selection.

When operating inside an installed workspace, the installed path is the
operative local distribution of the selected immutable release until the
consumer explicitly adopts and installs another released cut.

If the realization model is tenanted, the target project topology also includes:

- `build_tenants/` as the project-owned realization root for one-to-many independent `HOW` realizations of the shared `WHAT` defined in specification
- `build_tenants/TENANT_REGISTRY.md` as the canonical registry of tenant families, variants, and activity state
- `build_tenants/common/` as the shared realization root for cross-tenant law
- `docs/` as project-owned supporting documentation

The corresponding folder shape is:

```text
.genesis/docs/standards/
├── *_METHOD.md
├── *_GUIDE.md
└── *_TEMPLATE.md

specification/
├── GOALS.md
├── INTENT.md
├── PRODUCT.md
└── requirements/
    └── *.md

```

This shape is structural rather than exhaustive. It declares where constitutional specification and realization-law surfaces belong. Concrete implementation layout remains a design decision unless separately ratified.

Projects do not need to start with a complete `requirements/` tree on day zero.

Requirements may be sourced from any legitimate constitutional input, including:

- `GOALS.md`
- `INTENT.md`
- `PRODUCT.md`
- existing requirement documents
- imported standards or policy material
- prior project versions
- migration or repricing source material

Most projects begin by deriving `INTENT.md` from `GOALS.md`, then `PRODUCT.md` from `INTENT.md`, then the first requirement surface from the product definition, but that is the usual starting point, not the only lawful source.

The bootstrap sequence is:

1. Establish or install `.genesis/docs/standards/SPEC_METHOD.md`.
2. Write or confirm `GOALS.md`.
3. Run the `goals → intent` step and write or confirm `INTENT.md`.
4. Run the `intent → product` step and write or confirm `PRODUCT.md`.
5. Gather the requirement source material relevant to the project.
6. Run the `product → requirements` step and write the resulting live surface under `requirements/`.
7. Store requirements as individual files or grouped requirement families, whichever yields the clearest constitutional surface.
8. Classify each live requirement family by lifecycle status and requirement category.
9. Treat `requirements/` as the authoritative requirement surface going forward.

Once `requirements/` exists as the live constitutional surface, no rival monolithic requirements document should remain co-equal authority with it.

This rule exists to keep the requirement surface structurally clear, derivable, and non-monolithic.

---

## Method

When any substantive intake arrives:

1. Triage the intake and classify the change.
2. Determine the lawful re-entry point into the constitutional chain.
3. Identify the affected downstream span that must remain consistent.
4. Only then treat the work as implementation, repricing, or release-bound change.

When a feature is introduced or changed:

1. Update **Goals** if the current bounded work wave or overriding concerns have changed.
2. Update **Intent** if the purpose or scope has changed.
3. Update **Product** if the current product realization, terms, boundaries, or end-state shape have changed.
4. Update **Requirements** so the invariant truths are explicit as a decomposition of the product definition, including any lifecycle obligations or named lifecycle ambiguity gaps, and classify each new or changed requirement by category.
5. Establish or update **Design** so it owns the governing structural `HOW`.
   When `DESIGN_MODULE_METHOD.md` applies, use its decision-completeness rule:
   design, implementation, and tests may co-evolve only when
   `co_evolution_admissible(B)` holds. Otherwise accept the smallest causally
   closed affected design set before retained implementation establishes an
   unresolved, contradictory, or materially non-equivalent relation.

   When `DESIGN_MODULE_METHOD.md` does not apply, design, implementation, and
   tests may co-evolve when upstream truth leaves no unresolved material design
   decision. When such a decision remains, accept the affected design before
   retained implementation establishes it. ADRs are one valid design form.
6. Write **Scenarios** for capability claims that require operational proof, and define other evidence surfaces for non-capability requirements where appropriate.
7. Prefer declarative expression of the problem and acceptance surface before adding imperative mechanism.
8. Check the reconstruction boundary: can the current goals support the current intent, can the current intent support the current product, can the current product support the intended requirements, can the current requirements support the intended design, and can the current design support the intended implementation?
9. Record any major ambiguity discovered at the active boundary, and govern it according to declared risk appetite rather than silent convenience.
10. Develop **Code** under the selected design relation and reconcile design,
    implementation, and tests before promotion or closure.
11. Use **Events, Projection, and Delta** to verify whether reality still satisfies the requirements.

When bootstrapping a project or repricing a requirement surface:

1. Start from `.genesis/docs/standards/SPEC_METHOD.md` and `GOALS.md`.
2. Perform the `goals → intent` step and write or confirm `INTENT.md`.
3. Perform the `intent → product` step and write or confirm `PRODUCT.md` as the current product-definition bridge.
4. Gather requirement source material from the relevant constitutional inputs.
5. Perform the `product → requirements` step and write the resulting live surface under `requirements/`.
6. Store requirements as individual files or grouped requirement families, whichever best preserves clarity and avoids monolithic sprawl.
7. Make `requirements/` the sole live requirement authority before proceeding to design and code.
8. Prefer declarative structure over procedural workaround while shaping the new requirement surface.
9. Record any major ambiguity that remains at the current boundary before downstream realization proceeds.
10. Only after that surface exists should downstream design and implementation be treated as constitutionally grounded.

When a real use case reveals a gap:

1. Run intake triage first and classify the report as a lawful change.
2. Then write the **Scenario** as the first substantive project artifact for the
   gap so the pressure becomes concrete and testable.
3. Run **Gap Analysis** — is this a missing implementation or a constitutional insufficiency?
4. If constitutional: reprice **Goals** when the current work wave changes, write a new **Intent**, then flow forward (product → requirements → design → code).
5. If implementation: write requirements/design as needed, then implement.

The intake source does not change this rule.

A bug report, feature request, failed testcase, release blocker, or operator
observation still enters through intake triage first, then follows the lawful
change class selected there.

---

## ADR Conventions

Each ADR shall explicitly include:

| Field | Purpose |
|-------|---------|
| `Status:` | `active`, `superseded`, or `retired` |
| `Implements:` | REQ-* IDs this ADR makes true |
| `Derives from:` | INT-* or strategy document that motivated the decision |
| `Supersedes:` | Prior ADR or doctrine this replaces |
| `Superseded by:` | Successor ADR when this ADR is `Status: superseded` |
| `Retained special case:` | When earlier behavior is intentionally retained as a special case of the current surface |

Write ADRs per decision boundary, not per requirement file. The question is: "what design choice makes these ACs true?" That is the ADR boundary.

If a requirement names an operational mechanism, the ADR must name that mechanism too. If a requirement expands the event taxonomy, the EC ADR must be repriced immediately — event semantics must not drift into a second constitution.

### ADR Folder Convention

ADRs are stored in an `adrs/` subdirectory under the design surface that owns the decision.

- tenant-local build-tenant ADRs: `build_tenants/<tenant-path>/design/adrs/`
- shared or cross-tenant ADRs: `build_tenants/common/design/adrs/`
- non-tenanted or project-local ADRs: `<governing-design-surface>/adrs/`

The `<tenant-path>` is one or more path segments that uniquely identify the
build tenant within `build_tenants/`. Both capability-oriented
`<product-family>/<realization-variant>` paths and single-label
`<realization-variant>` paths are lawful, provided the project's
`build_tenants/TENANT_REGISTRY.md` records the tenant identity used. The
recommended scaffold is `<product-family>/<realization-variant>`; existing
single-segment layouts remain conformant and do not require migration.

The governing design surface is the closest design surface whose authority owns the decision. ADRs must not be placed in comments, generated views, runtime archives, or requirement folders.

Filename convention is `ADR-<local-id>-short-slug.md`. The local ID is unique within the owning `adrs/` directory. Numeric IDs such as `ADR-001-...` are the default; namespace-prefixed IDs such as `ADR-GM-005-...` are allowed when the owning design surface already uses them.

A `REGISTRY.md` index alongside the ADR files is recommended for tooling and review but is not required. The constitutional source remains each ADR file; a registry is a read model that may drift unless tooling maintains it.
