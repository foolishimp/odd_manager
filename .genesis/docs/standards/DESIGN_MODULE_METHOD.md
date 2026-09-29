# Design Module Method

## 1. Purpose

This method exists for projects that want a stronger implementation discipline
than "write code that passes."

Its bias is toward:

- low coupling
- modular composition
- immutable typed carriers
- total or nearly-total semantic transforms
- explicit effect boundaries

The goal is not language ideology.

The goals are:

- reduce ambiguity
- reduce entropy
- eliminate avoidable tech debt
- increase refactorability
- reduce hidden authority, hidden mutation, and semantic drift in realization
  code
- preserve enough evidence that later reviewers can audit, refactor, and
  reconstruct why the realization took its current shape

This method is therefore about realization design and implementation shape.

It does not mandate one optimal authoring path for every agent, worker, or
runtime.

Agentic coders may sometimes move faster by deriving implementation and proof in
the same work pass. That is acceptable only when
`co_evolution_admissible(B)` holds under the proportional sequencing rule below
and the boundary reaches decision completeness before any design-method closure
claim.

One pillar of spec-driven development is bounded intermediate traversal over
the graph.

Specification gives the global `WHAT`. Every intermediate traversal should have
a finite, inspectable unit for reasoning, implementation, evaluation, proof, and
later refactor. A module boundary is one realization-level tool for creating
that unit; it is not the only possible bounded traversal. Without bounded units,
reviewers and agents must traverse too much context at once, and correctness
depends on memory rather than on preserved structure.

It does not replace constitutional authority from `SPEC_METHOD.md`.

It does not replace graph-native law from `ODD_METHOD.md`.

It governs how the Ontology, architecture, and realization modules should be
derived once the project has decided the outcomes and capabilities it is
building. A product decision that functionality is required does not decide how
many entities, functions, public operations, carriers, or modules should exist.

For an ODD-governed product, this method does not authorize replacing a graph
function, edge traversal, or GTL module with deterministic implementation
modules. It governs the deterministic realization shape inside or beneath those
ODD carriers.

These rules apply to:

- module boundaries
- schema and carrier families
- entity and record design
- interface contracts

They are not limited to one programming language or one runtime binding.

---

## 2. Position

The preferred realization shape is functionally biased.

That means:

- semantic meaning should live in typed carriers and explicit transforms
- imperative coordination should be subordinate to admitted truth
- side effects should be isolated to explicit boundary modules
- mutable shared state should be minimized and justified

This method does **not** require a functional programming language.

It does require a functional design discipline.

A Python, Scala, TypeScript, Kotlin, or Java implementation may all satisfy
this method if they keep semantic law in explicit carriers and transforms rather
than hidden orchestration.

---

## 3. Core Rule

The core rule is:

**semantic steps should read as transforms over admitted truth; effects should
be explicit and pushed to the edge**

If a reader must inspect orchestration code, mutable workspace state, service
methods, or fallback defaults to determine what the system means, the design is
too imperative and too coupled.

## 3A. ODD Alignment And Escalation Rule

When this method is used inside an ODD-governed product, reviewers must first
ask whether the boundary is an operative graph traversal.

If the boundary represents product movement from one typed asset state to
another, the governing shape is:

1. outcome traversal under `ODD_METHOD.md`
2. declarative GTL/ABG carrier structure
3. deterministic module realization under this method

This method may govern:

- `F_D` evaluators and proofs
- carrier constructors and admissions
- deterministic transforms inside an edge traversal
- effect shells that publish the traversal result
- projections over already-admitted carrier truth

This method must not be used to hide:

- graph functions inside service methods
- edge traversal semantics inside module orchestration
- continuation or re-entry decisions inside deterministic controllers
- semantic target movement inside constructors, materializers, or projections
- probabilistic worker boundaries inside imperative prompt or dispatch code

If a deterministic module appears to own "what work is next", "what target is
being moved to", "what closes the traversal", or "what graph function is being
performed", the boundary should be repriced against `ODD_METHOD.md` before
claiming design-method closure.

In ODD products, the module boundary is a realization cut inside the graph
program. It is not the program.

## 3B. Boundary Closure Evaluators

When this method governs a boundary, each design or implementation change
should be judged against three overriding evaluators.

These are not optional heuristics.

If a change improves local ergonomics, test output, or static-checker output
but fails one of these evaluators, it is not real progress under this method.

### 1. Authority Seam Closure

Each change must not increase the number of truth surfaces.

When duplicate or rival truth surfaces already exist, seam-closure work should
reduce them.

This means:

- one authoritative carrier or contract at each semantic boundary
- no controller-side reconstruction of already-admitted truth
- no downstream surface silently rebuilding source truth from raw artifacts
- no raw or open payload trusted past ingress

The test is:

- if the authoritative carrier were removed, would the system fail closed, or
  would another path silently reconstruct the same meaning?

If meaning survives by reconstruction, the seam is not closed.

For projection and query modules, seam closure also requires source coherence:

- the projection must name the admitted carrier, runtime, event, or source truth
  it derives from
- reconstructed catalog, ownership, route, status, or closure truth must be
  structurally compared against the admitted source carrier before publication
- same-name but different-shape carriers must fail closed unless an explicit
  migration design makes the divergence lawful
- negative tests must cover structural drift, not only missing source truth

### 2. Essential Carrier Consolidation

Each change should collapse the slice to the few real identity-bearing carrier
families.

This means:

- declare the Irreducible Architectural Carrier Set first
- keep Subordinate Payloads subordinate by default
- avoid fragment classes, interfaces, or result records created only to satisfy
  typing, serialization, or convenience extraction

Progress here is:

- fewer sharper carrier families
- less duplicate authority
- less boundary inflation

Not:

- one more wrapper layer
- one more branch-local peer type
- one more public record that only mirrors payload detail

### 3. Enforcement After Proof

Typing, schemas, validators, contracts, or codecs exist to lock in a seam that
has already been made real.

This means:

- parse, validate, or construct first
- admit and narrow the boundary explicitly
- then use types or schemas to enforce the proved shape

It does **not** mean:

- relabel an open payload and call it closed
- wrap loose data in a typed envelope while keeping the same authority path
- use casts, unchecked assertions, or dynamic mutation as fake closure

This evaluator is language-agnostic.

In one language it may be `mypy --strict`, in another a sealed ADT plus a
schema parser, in another a compiler-enforced sum type plus decoder. The rule
is the same: proof first, enforcement second.

## 3B. Ingress Collapse Rule

Foreign, dynamic, or weakly-typed input is lawful only at ingress.

Once admitted, it must collapse immediately into local carrier truth before
semantic transforms begin.

The required shape is:

1. receive foreign input
2. parse, validate, or normalize it once
3. construct local admitted carrier truth
4. consume only that local truth in semantic kernels

The following are not lawful seam closure:

- repeated parsing of the same loose payload in multiple modules
- `from_dict(...).to_dict()` or equivalent round-trip ceremony that preserves
  the same open authority
- loaders that merely relabel stored JSON or map data without validating it
- semantic kernels that continue to inspect open payload fragments directly

---

## 4. Functional Bias Without Language Mandate

Projects using this method must prefer:

- immutable data carriers over mutable shared objects
- closed typed carriers over open dict or string protocols
- parsing and admitting foreign data once at ingress
- explicit return values over hidden mutation
- explicit failure carriers over ambient exception-driven control flow where
  practical
- composition of small transforms over long controller procedures

Projects using this method must avoid:

- one giant mutable workspace object
- one orchestration method that owns semantic law
- hidden read/write coupling through globals, shared registries, or mutable
  service state
- typed envelopes over open payload truth
- dynamic payload mutation at the semantic center
- effectful helpers that both decide meaning and perform writes
- proxy interfaces that partially imitate a new design while preserving the old
  authority path

---

## 4A. Python Typing Rule

When this method governs a Python boundary, repo-authored Python must be fully
typed.

That means:

- every function, method, and callable surface has explicit parameter and return
  annotations
- semantic carriers are closed and typed
- repo-authored tests, scripts, and support code are typed too; they do not get
  a lower bar than production code

Under this method, the following do **not** count as typed semantic design:

- untyped `def`
- implicit `Any`
- semantic `dict[str, Any]`
- semantic `Mapping[str, Any]`
- semantic `object` payloads used as carrier truth
- unchecked JSON blobs passed through multiple layers and interpreted by
  `.get(...)` chains

For Python, `dict[str, Any]` at the semantic center is untyped design debt, not
an acceptable carrier.

The required shape is:

- use `dataclass`, `TypedDict`, `Protocol`, `Literal`, `Enum`, or other closed
  typed forms for local carriers
- parse and validate dynamic input at the boundary
- narrow untyped external data into local typed carriers before semantic
  transforms begin
- keep `Any` at foreign boundaries only, and collapse it immediately

`Any`, `cast(...)`, and `# type: ignore` are allowed only when all of the
following are true:

- the boundary is genuinely foreign or dynamically typed
- the local code cannot express the shape more precisely
- the use is narrow, explicit, and justified in place
- the imprecision does not cross into the semantic kernel as governing truth

Python boundaries using this method must be checked with a strict static typing
pass such as `mypy --strict` or an equivalent strict checker configuration.

If the checker cannot run cleanly on the adopted boundary, the boundary is not
yet implementation-conformant under this method.

---

## 4B. Ontology-First Design Rule

Every new or materially changed active semantic boundary must derive its
semantic model from one accepted **Ontology**. Before a new or changed entity,
function, authority, effect, Prime-conformant carrier, module boundary, public
operation, or schema is promoted, the affected boundary must first produce a
candidate Ontology slice and carry it through the acceptance sequence below.

The Ontology is the prior **semantic-design authority** for the boundary. It is
subordinate to constitutional `WHAT`: it derives from intent, product,
requirements, and applicable graph or domain method. It does not invent product
meaning. Once accepted, it governs semantic entities, relationships,
invariants, lifecycle, authority, functions, composition, and effects.

The Ontology does not replace target architecture or module design. Accepted
design remains the structural `HOW` for topology, interfaces, carrier placement,
module boundaries, algorithms, and local realization. Implementation and tests
derive from requirements plus accepted design and must preserve the accepted
Ontology; they are not direct substitutes for either layer.

Ontology acceptance must identify the constitutional sources it derives from
and the design authority that accepted it. It must carry stable element or
relation identities plus a version or basis that makes source change,
staleness, and the affected projection set decidable. A reprice of a governing
source invalidates only the affected Ontology relations and downstream
projections until their impact is re-evaluated. Code, tests, generated schemas,
or a single implementing agent cannot self-ratify missing Ontology authority.
The Ontology verdict may live in the same design pack and acceptance record as
the three-view verdict; this rule does not require a second document, ticket, or
approval ceremony.

Proportionality applies. A **material semantic boundary** is one whose change
affects identity, authority, lifecycle, public contract, externally observable
Product meaning, cross-module topology, or accepted effect or closure law. A
`realization_refactor` wholly inside an accepted boundary may cite the existing
Ontology and design basis and prove `no ontology delta`; it does not require
re-authoring or re-accepting unchanged evidence. A semantic or structural
change must publish only the affected Ontology/design delta and its projection
impact set. Unaffected maintenance and unrelated boundaries do not freeze
merely because one source digest changed.

### Proportional Design Sequencing

For one governed boundary `B`, let `M(B)` be its complete material-relation set
defined under Decision-Complete Symbolic Design, and let `U(B)` be the
unresolved members of that set:

```text
U(B) = unresolved(M(B))
decision_complete(B) iff
  U(B) = empty
  and M(B) is jointly satisfiable
  and every network admitted by M(B) is semantically equivalent under the
      governing Product, requirements, and accepted design relations
co_evolution_admissible(B) iff decision_complete(B)
design_gate(B) =
  the smallest causally closed affected set needed to establish
  decision_complete(B)
```

Design sequencing follows `decision_complete(B)` rather than one global
authoring order:

- **co-evolution** is lawful only when `decision_complete(B)` holds. Design
  still owns the structural `HOW`, but design, implementation, and tests may
  evolve together and reconcile before promotion or closure;
- **design-gated** sequencing is required when implementation would otherwise
  establish an unresolved or contradictory relation, or choose between
  materially non-equivalent networks, with durable consequences for future
  change. The affected design decision must be accepted before retained
  implementation establishes it. A disposable spike may supply evidence
  without becoming the selected design.

Neither mode is the global default. The same proportionality relation selects
between them. Proportionality decides which relations are material and bounds
the smallest affected gate; decision completeness is the resulting
admissibility test. Where a bounded symbolic model can contract the material
semantic alternatives within effective reasoning capacity, the code,
runtime-state, test, review, and reconciliation space thereby removed is
counterfactual evidence of that contraction, not an independent reason for a
design gate. Where no material alternative remains, a separate prior gate adds
ceremony without disambiguation.

The bidirectional design-and-implementation relation is an evidence relation,
not bidirectional semantic authority. Implementation may provide a
counterexample, falsify a constraint, or expose hidden ambiguity. It may not
select the missing semantic answer, rewrite upstream truth to legalize itself,
or ratify a material design decision after establishing it.

The selected relation and its basis belong in the existing work or design
carrier; this rule does not require a separate artifact. If implementation
exposes previously hidden architectural ambiguity, the boundary switches to
design-gated sequencing at the smallest causally closed affected decision set
rather than retroactively invalidating unrelated work. Serial implementation
repairs do not establish design acceptance. Repeated or cross-cutting material
surprises are evidence that the affected design cut is underconstrained and
require one bounded `design_reframe`; retained code remains provisional
evidence until that reframe is accepted.

This applies the governing proportionality law: a prior design gate is
warranted when it removes material semantic ambiguity whose alternatives would
establish materially different durable architecture, and that contraction
justifies its reasoning load. It is disproportionate when upstream truth leaves
no materially divergent architecture to adjudicate and a separate prior
acceptance would add no disambiguation. Design still records and owns the
resulting `HOW` before promotion or closure.

For this method:

```text
Ontology =
  entities
  + identities
  + relationships
  + invariants
  + lifecycle
  + authority
  + atomic functions
  + higher-order composition
  + effects
  + projections
```

A class inventory, schema list, endpoint list, command list, or carrier census
alone is not an Ontology.

### Decision-Complete Symbolic Design

For one governed boundary `B`, the complete material-relation set is:

```text
M(B) =
  entities
  + identities
  + relationships
  + cardinalities
  + invariants
  + authorities
  + authority transitions
  + functions
  + higher-order composition laws
  + topology
  + lifecycle states and transitions
  + public contracts
  + externally observable Product meaning
  + declared domains and admission conditions
  + failure and refusal routes
  + effect and closure laws
  + projections
  + module mappings
  + material algorithmic obligations
```

A design boundary is **decision-complete** when `U(B)` is empty, `M(B)` forms
one jointly satisfiable constraint network, and every network admitted by
`M(B)` is semantically equivalent under the governing Product, requirements,
and accepted design relations.

Ontology, Prime contraction, IACS, target design, domain/sequence/state views,
public contracts, module boundaries, implementation, and tests are projections
of that one network at different reasoning altitudes. Their presence, section
names, individual plausibility, or mechanical validity does not establish
decision completeness.

The boundary is underconstrained whenever `decision_complete(B)` is false,
including when implementation must introduce a new material semantic decision,
projections contradict one another, or two materially non-equivalent networks
remain admissible. Local algorithm and layout choices may remain open only when
every admitted choice is semantically equivalent under the accepted network.
Contradictory projections make the design unsatisfiable and block promotion.

Decision completeness does not require another document. The constraint
network may be expressed through the existing Ontology, algebra, module mapping,
and views when those surfaces jointly carry the complete relation.

### Bounded Frame Conservation (`STDO-UP-017`)

`M(B)` closes one governed boundary. A bounded local action is taken inside a
frame that derives from other accepted frames, and its lawfulness depends on
relations the acting frame does not itself own.

`Global` and `local` are relative to the selected frame. Each material design
frame must identify:

- the governing frames and accepted relations from which it derives;
- the bounded affected relation set of the proposed action;
- the applicable inherited invariants;
- the authority and composition seams crossing that set; and
- the subordinate frames opened by unresolved material distinctions.

A frame may derive from more than one governing frame. A persistence component
belongs to an entity lifecycle boundary and an operational consistency
boundary; an admission function belongs to a domain transition and a
runtime-authority boundary; a shared callable may be consumed by several
sibling domains without becoming subordinate to one. A single governing frame
is lawful where the structure is genuinely hierarchical, and is not required.
Governing frames form a constraint network for the same reason `M(B)` does.

Every seam crossing the affected set must either include its causally relevant
far-side relation in that set, or state why that relation cannot affect, and
cannot be affected by, the bounded action. This makes the declared set testable
against its own declared seams without requiring a closure algorithm or
recursive expansion through irrelevant relations.

The result is evaluated against every affected governing frame, preserves each
applicable accepted relation, and updates only affected subordinate
projections. A bounded local action conserves governing truth; it does not
rewrite it. A result that changes a governing relation re-enters at that
relation before acceptance.

A subordinate frame opens only when a material distinction cannot be resolved
at the governing altitude. This rule does not require recursively documenting
irrelevant descendants.

This law is false if a change is locally valid inside the selected frame but
violates, duplicates, or silently reinterprets an invariant in any affected
governing frame.

Discovered functionality is evidence about required behavior. It is not yet an
architectural operation. A discovered verb, screen action, endpoint, command,
ticket phrase, or use case shall not be promoted directly into a public
operation identity, peer carrier, module, or implementation function. It must
first be derived through the Ontology.

The required derivation order is:

```text
constitutional functionality
  -> candidate Ontology
  -> logical completeness
  -> whole-family Prime contraction
  -> accepted Ontology basis
  -> Irreducible Architectural Carrier Set
  -> target design and domain, sequence, and state projections
  -> public contract and adapter projections
  -> implementation and test projections
```

### Native Constructability Before Design Acceptance (`STDO-UP-002`)

A semantically coherent design is not acceptable when its selected substrate
cannot natively construct the required identities, relationships, transitions,
authority boundaries, effects, lifecycle, composition, publication, and
retirement behavior.

A missing substrate capability remains an explicit design gap or triggers
lawful re-entry. It must not be hidden behind a reference bridge, adapter,
filesystem runner, test double, or promised future feature. This is a
constructability obligation, not a prescribed implementation; the consumer
chooses the substrate and evidence mechanism.

### Entity And Lifecycle Completeness

The Ontology must enumerate the entities inside the active boundary, their
identities, relationships, cardinalities, invariants, lifecycle states, and
authority owners.

For each entity, design evidence must provide this logical-completeness matrix
or an equivalent closed representation:

| Entity | Identity | Authority owner | Declare/create | Read/project | Update/transition | Delete/retire |
|---|---|---|---|---|---|---|

This matrix applies to identity-bearing entities and independently governed
value families. A Subordinate Payload or value object inherits the lifecycle
and authority of its owning entity unless it passes the Promotion Test; it does
not require a ceremonial peer lifecycle row.

The lifecycle columns are completeness questions, not a mandate for mutable
CRUD:

- create may be declaration, construction, admission, or materialization;
- read should normally be a typed projection over authoritative truth;
- update should normally be an admitted transition or new version rather than
  in-place semantic mutation;
- delete should normally be retirement, revocation, decommission, or
  supersession where history or identity must remain true.

Every cell must identify a lawful function, declare `not_applicable` with a
reason, or name a `Gap:` / `Unanswered:` item and owner. Silence is not
logical-completeness evidence.

This entity lifecycle is distinct from the operational module lifecycle in
section 6C. The Ontology describes what states and transformations exist for
domain entities. Section 6C confirms how the resulting realization is built,
released, deployed, observed, and retired.

### Authority Model

Authority is part of the Ontology, not metadata added to an operation after its
shape has been selected.

For every Ontology function or lifecycle transition that crosses a semantic,
authority, admission, effect, persistence, or public boundary, design evidence
must provide this authority matrix or an equivalent closed representation:

| Function or transition | Proposer | Evaluator | Verifier | Admitter | Executor | Projector | Retirement owner |
|---|---|---|---|---|---|---|---|

The model must distinguish:

- actor identity from authority;
- available capability from authority admitted for the current basis;
- proposal from evaluation, verification, admission, execution, projection,
  and retirement;
- attribution from permission; and
- ownership of domain meaning from ownership of runtime effects.

One owner may lawfully occupy more than one role only when the governing
authority explicitly says so. Role coincidence must not be inferred from
implementation convenience.

Pure subordinate helpers inherit the authority envelope of their owning
Ontology function and do not require peer authority rows unless they cross one
of those boundaries.

Composition must not widen authority implicitly. A composed or higher-order
function has no more authority than the authority law admitted for its inputs,
constituent functions, and current basis. Delegation, elevation, transfer, or
retirement authority requires a named typed transition and an owning admission
boundary. Projections cannot create authority, and downstream code cannot
reconstruct an authority witness from actor labels, capability strings, or
payload shape.

### Transformation Admission Completeness (`STDO-UP-016`)

The authority matrix names who admits. It does not by itself establish the
relation that decides which candidate transformation becomes durable entity
truth. Two designs can complete the matrix plausibly and still leave two
materially different ways to admit the same transformation.

For every consequential entity-transition domain, design evidence must contain
the complete transformation-admission relation over entity identity,
predecessor basis, authority scope, candidate family, decision cardinality,
admission predicate, resulting durable fact, and supersession law — through the
authority matrix above or an equivalent closed representation:

| Entity transition domain | Predecessor basis | Candidate family | Admission relation | Durable result | Competing-path disposition |
|---|---|---|---|---|---|

Singularity attaches to the complete decision relation, not to one actor,
callable, or component. Multiple actors, stages, or implementations are lawful
as constituents or disjoint instances of that relation. A relation may lawfully
require one actor, multiple signatures, quorum, human step-up, delegated proxy
authority, or jurisdictional partitioning, provided its cardinality and
adjudication law are declared.

Competing-path disposition does not imply deletion. An equivalent path may be a
lawful constituent, replica, replacement, or deliberately independent
realization, provided its relationship to the singular admission law is
explicit.

A projection may produce a candidate transformation, but projection status does
not confer admission authority. Any consequential result must re-enter the
governing admission relation against its explicit predecessor basis. A
reconstructed projection state is not self-authenticating admission evidence.

This law is false if any of the following holds:

- two materially non-equivalent admission relations remain reachable for the
  same governed transition domain on the same entity identity, authority scope,
  and predecessor basis — disjoint scopes or identities are not a
  counterexample;
- a materially equivalent competing implementation remains reachable without
  being identified as a constituent, replica, replacement, or deliberately
  independent realization; or
- a projection-triggered reaction uses its own reconstructive state as
  self-authenticating admission evidence.

### Atomic Functions And Higher-Order Composition

The Ontology must derive the smallest parameterized atomic function families
that make the entity lifecycles logically complete. Variation that changes only
an entity kind, projection kind, transition kind, policy, or subordinate payload
should normally be a typed parameter or closed variant of one function family,
not another peer function.

The minimum function-derivation evidence is:

| Discovered functionality | Entity | Atomic function or template | Higher-order composition | Effect class | Required authority | Disposition |
|---|---|---|---|---|---|---|

Every row must be one of:

- derived through an admitted atomic function;
- derived through a declared higher-order composition;
- deferred with an owner and re-entry condition;
- excluded by current product authority; or
- unresolved as a named gap.

Where the boundary has higher-order behavior, the Ontology must name the
governing composition and effect algebra. Typical categories include unit or
lift, sequential composition, parallel or applicative composition, fold or
evaluation, retry or recovery, recursion or fixed point, and projection. The
design must state the applicable identity, closure, associativity, cardinality,
effect, and authority-conservation laws rather than hiding them in controller
flow.

This rule does not require monadic or category-theory vocabulary. An ODD product
may bind the requirement to GTL composition and ABG interpretation; another
product may use another explicit algebra. Composition, effects, and
implementation may be discovered iteratively only when
`co_evolution_admissible(B)` holds. Otherwise only a disposable spike may
supply evidence across the affected unresolved, contradictory, or materially
non-equivalent relation before its design is accepted. Every retained result
must be reconciled into accepted design before promotion or design-method
closure. No private helper, loop, adapter, or endpoint may become an undeclared
constructor.

### Prime Semantic Atoms And Universal Domain

A **Prime semantic atom** is one irreducible design relation: an atomic function
family, identity, authority transition, lifecycle relation, topology, effect,
closure law, or composition law that cannot be expressed honestly by composing
other accepted atoms while preserving the same meaning.

Prime is decided at semantic-design altitude. A file, source function, class,
schema record, public operation, diagram, module, or owner category is not a
Prime atom merely because it is small, typed, separately named, or independently
testable. One atom may project into several realization units, and one
realization unit may implement several atoms, provided the mapping is explicit
and introduces no rival meaning or authority. An atomic function is not proven
Prime until the complete candidate family has been contracted.

Every accepted Prime atom declares the admitted domain over which its law
holds. Within that domain it governs every admitted instance. A later use case
composes or parameterizes the atom; it does not fork, shadow, specialize, or
reinterpret the atom locally. An out-of-domain case may justify proposing
another candidate atom for design admission. An in-domain counterexample
falsifies the shared atom and re-enters at that atom's design boundary rather
than authorizing a feature-local replacement.

An atom without a declared admitted domain remains a candidate atom. It cannot
supply Prime acceptance or Prime-conformance to a realization projection.

### Whole-Family Prime Contraction

Prime review evaluates the complete candidate semantic-atom family and every
proposed realization projection, not only functions, carriers, or each atom in
isolation. The family includes every proposed identity, authority transition,
lifecycle relation, topology, function, composition law, effect, and closure
law. A function-and-carrier-only pass does not establish whole-family Prime.

Before promotion, review must ask:

- can several proposed operations be typed parameters of one atomic function?
- are several commands lifecycle transitions over one entity?
- are several reads projections over one source truth?
- are several implementations applications of one higher-order function?
- does the candidate introduce independent identity, authority, effect,
  lifecycle, reuse, or public pattern-match semantics?
- has every candidate atom kind entered the same contraction?
- does every realization unit map explicitly to its accepted atom or atoms?
- does any realization projection introduce, duplicate, or reinterpret meaning
  or authority?

A family of individually plausible functions is not Prime when one
parameterized template plus closed variants carries the same meaning and
authority. Recurrence must be contracted during design when visible; the
post-implementation recurrence rule is not a substitute for this prior pass.

### Recursive Prime And Root Conservation (`STDO-UP-003`)

At a material semantic boundary, Prime contraction applies to each candidate
semantic atom and then to the complete family produced by those contractions.
A locally irreducible atom is not globally Prime when the family duplicates
identity, authority, function, lifecycle, topology, effect, or projection
meaning. Local Prime-conformance of realization units does not prove the
semantic family globally Prime.

Contraction must preserve root authority and every retained semantic relation.
Reducing files, functions, operations, or authoring surfaces cannot compensate
for introducing another authority source or truth path. Prime evidence states
the complete candidate semantic-atom family; each atom's stable identity,
irreducible relation, admitted domain, and falsification condition; the
whole-family contraction relation; retained meaning and authority before and
after contraction; accepted loss; and the explicit total mapping from every
proposed realization projection to its accepted atom or atoms. Work inside an
accepted boundary cites the existing Prime basis rather than recreating it.

### Ontology Projection Law

The Ontology is one semantic truth. The following must preserve it and must not
become independent semantic authorities:

- class or domain diagrams;
- sequence diagrams;
- state and lifecycle diagrams;
- authority and effect matrices;
- the Irreducible Architectural Carrier Set;
- public APIs, operation registers, SDK and CLI surfaces;
- schemas, codecs, manifests, and generated catalogs;
- target architecture and module design;
- implementation modules through accepted target design; and
- test and proof inventories through requirements and accepted design.

Each design projection must identify its Ontology source and the identity,
relationship, lifecycle, authority, function, or effect law it preserves. Any
intentional omission or flattening must declare accepted loss and a failure
condition. Target design may add structural `HOW` that is absent from the
Ontology, but it may not originate rival semantic meaning. Implementation and
tests trace through that accepted design rather than bypassing it.

If a public operation, sequence message, state transition, carrier, or effect
cannot be traced through accepted design to the accepted Ontology, it is
ungrounded design and must not enter the active product line. An implementation
branch or test expectation must trace to requirements plus accepted design; it
must preserve, but need not be enumerated by, the Ontology.

---

## 5. Prime Law

Using the logically complete candidate Ontology, derive the Prime semantic
atoms before proposing top-level realization units. Whole-family Prime is part
of the evidence used to accept the Ontology basis. Target design, IACS,
modules, source functions, schemas, and tests project those accepted atoms; they
do not originate Prime meaning. Prime applies both to each semantic atom and to
the candidate family as a whole.

Prime-conformance applies to these realization projections:

- functions
- classes
- carrier types
- top-level schema records
- modules

Typed closure by itself is **not** sufficient reason to create a new top-level
type.

The hard vocabulary for this rule is:

- **Irreducible Architectural Carrier Set**: the smallest lawful top-level
  carrier family required for one boundary
- **Subordinate Payload**: payload detail that exists inside that boundary but
  is not top-level by default
- **Promotion Test**: the explicit test a subordinate payload must pass before
  it becomes a top-level type
- **Boundary Inflation**: the defect where subordinate payload detail is
  promoted into extra peer types without irreducible need

A top-level realization unit is **Prime-conformant** only when it projects one
or more accepted Prime atoms without introducing, duplicating, or
reinterpreting semantic authority. A topological or effect boundary must first
be derived and accepted as a Prime atom. Source-code size and one-to-one
correspondence with an atom are immaterial.

Typical lawful reasons to introduce a new top-level realization unit are:

- a new feature topology or branch in the admitted work graph
- a new typed carrier transformation
- a new effect boundary
- a new validation or admission boundary
- a new projection boundary

A realization unit is **not Prime-conformant** when it exists only to:

- shorten a call site without creating a new semantic boundary
- aggregate unrelated behavior for convenience
- preserve an old interface behind a new name
- shuttle data through one more wrapper layer
- hide mutation, fallback, or orchestration that should remain explicit
- name one more payload variation that does not carry independent authority
- turn internal record detail into public schema surface without an irreducible
  boundary
- mirror another top-level carrier with only small field variation
- respond to typing discomfort by multiplying peer classes instead of closing
  one governing carrier family

This is Occam's razor for design modules:

- prefer composition over convenience extraction
- prefer existing lawful functions over new wrappers
- prefer fewer sharper boundaries over many vague helper functions
- prefer fewer sharper carrier families over many payload-shaped peer types

The purpose of the Prime Law is not to minimize line count.

The purpose is to stop semantic fragmentation and helper sprawl from becoming
architecture.

### Boundary And Governance Cost (`STDO-UP-005`)

Review cuts, realization units, runtime modules, and work items are distinct
boundaries. They may relate many-to-one or one-to-many and must not be forced
into one-to-one decomposition for administrative convenience.

Prime review accounts for governance cost as well as implementation count.
Contraction is not successful when it increases authority centers, maintained
truth surfaces, acceptance boundaries, dependency cycles, manually reconciled
projections, or review burden. Evidence remains proportional to semantic
change and risk; this rule does not require one artifact or review per concern.

## 5A. Irreducible Architectural Carrier Set Rule

When defining a schema, carrier family, or typed public boundary, derive the
**Irreducible Architectural Carrier Set** from the accepted Ontology before
naming subordinate payloads or implementation modules.

The Irreducible Architectural Carrier Set is the smallest set of carriers
required to carry the real functionality and authority flow of the boundary.

That set should be named before subordinate payload records, helper result
shapes, or internal branch detail.

Examples of irreducible architectural carrier roles include:

- source truth carrier
- admission carrier
- execution carrier
- yielded or recovery carrier
- effect plan carrier
- public projection carrier

The following do **not** automatically justify a top-level carrier:

- one more branch-specific payload shape
- one more internal persistence detail
- one more read-model row shape
- one more field grouping extracted only to make typing easier

The required carrier-set evidence is:

1. cite the accepted Ontology and function-derivation evidence
2. declare the Irreducible Architectural Carrier Set
3. map each carrier to the Ontology identity, lifecycle, function, authority,
   effect, or projection law it carries
4. declare which carriers are authoritative and which are downstream
5. treat every other shape as a Subordinate Payload by default
6. keep subordinate payload detail private unless it passes the Promotion Test
7. reconcile the typed implementation to that carrier set before claiming
   design-method closure

The IACS is a realization projection of the Ontology. It must not replace the
Ontology or become the first surface on which entities, functions, lifecycle,
or authority acquire meaning.

If the accepted Ontology or Irreducible Architectural Carrier Set has not been
declared, the schema is not yet design-method complete under this method.

When `co_evolution_admissible(B)` holds, Ontology, carrier-set evidence,
implementation, and tests may develop together. Implementation may expose a
missing entity, relation, function, or carrier, but it cannot self-ratify that
meaning. Before the affected boundary is promoted or claims design-method
closure, the Ontology and IACS must be accepted and the typed implementation
reconciled to them. Under design-gated sequencing, the affected unresolved,
contradictory, or materially non-equivalent relation is accepted before
retained implementation establishes it.

## 5B. Promotion Test

A top-level class, dataclass, TypedDict, enum, or named schema record must
justify its existence as an architectural boundary, not merely as payload
detail.

A Subordinate Payload may be promoted to a top-level type only when at least
one of the following is true:

- it is an authoritative source carrier
- it is a public or persisted contract boundary
- it is an explicit variant of a public outcome family that consumers
  pattern-match directly
- it is reused across multiple modules without semantic bleed
- it is versioned, published, or admitted independently

Promotion is not lawful when the candidate type is only:

- internal record detail of one larger carrier
- a field grouping used once inside one module
- a temporary typing shim around an open dict
- a private payload variation that never crosses a true interface boundary
- a mirror of another type with cosmetic or local field differences

Default rule:

- if a shape does not need independent authority, independent reuse, or direct
  pattern-match semantics, it remains a Subordinate Payload and stays nested,
  private, or local to the carrier family

The burden of proof is on promotion.

Designers and reviewers should assume a candidate type stays subordinate until
an irreducible boundary is shown.

## 5C. Boundary Inflation Prohibition

Schema work must declare:

- the Irreducible Architectural Carrier Set
- which types are authoritative
- which types are downstream projections
- which shapes are Subordinate Payloads
- which Subordinate Payloads are intentionally deferred from promotion

This rule exists to stop type proliferation from turning one migration into many
parallel schema migrations.

If a schema or ticket lists a wide family of types, it must distinguish:

- the Irreducible Architectural Carrier Set
- Subordinate Payloads

Failing to make that distinction is design drift.

Typed closure does not excuse Boundary Inflation.

Boundary Inflation exists when:

- payload detail is promoted into peer types because the code feels hard to type
- internal records are turned into public schema surface without a new
  authoritative boundary
- many near-identical top-level types appear for one boundary where one carrier
  family would suffice
- one migration ticket silently becomes several parallel schema migrations

Boundary Inflation is design debt, not progress.

## 5D. Reference-Derived Module Design Rule

When a realization is being derived from an existing design line, released
tenant, or reference implementation, design-method completion must not rest on
code comparison alone.

The required derivation evidence is:

1. constitutional `WHAT`
2. reference design
3. target Ontology and reference-to-Ontology mapping
4. target design mapping
5. target module boundary assets
6. implementation

This rule exists to stop code-first ports from importing reference drift,
delivery quirks, helper sprawl, or accidental authority paths into the new
realization without a later audit trail.

The minimum lawful design assets for a reference-derived module boundary are:

- the named reference design surfaces being used as source material
- the accepted target Ontology, including the disposition of reference entities,
  functions, lifecycle, authority, effects, and projections
- the target design surfaces that replace or bind those source surfaces
- an explicit mapping that says what is preserved, reshaped, deferred, or
  demoted to delivery binding in the target line
- the target module boundary assets required by this method, including the
  Ontology-derived Irreducible Architectural Carrier Set and three-view design
  asset

The design question is not:

- "how do I port these files?"

It is:

- "what is the target module boundary, and how does the new realization derive
  it from the reference design without inheriting incidental implementation
  drift?"

If a target realization cannot show that derivation chain, it is not yet
design-method complete under this method.

## 5E. Ontology And Three-View Behavioral Design Gate

Every new or materially changed semantic or typed module boundary must carry
one accepted Ontology and one complete three-view Mermaid design asset before
the boundary is promoted or claims design-method closure. When
`co_evolution_admissible(B)` holds, design evidence, implementation, and tests
may develop together before that gate. Otherwise the affected unresolved,
contradictory, or materially non-equivalent relation is accepted before
retained implementation establishes it. Unchanged boundaries cite their
accepted basis; local realization work with no material semantic-boundary delta
does not recreate this gate.

The asset must contain all three views:

1. a Mermaid `classDiagram` domain model;
2. a Mermaid `sequenceDiagram` execution model; and
3. a Mermaid `stateDiagram-v2` lifecycle model.

A project may ratify another text-native diagram format only when it preserves
the same three distinct views and the same cross-view checks. One broad flowchart
does not substitute for the three models.

The three views may be sections of one existing design surface and may share
one acceptance decision. This rule does not require three files, three tickets,
three reviews, or three approval ceremonies.

The views are not decorative and they are not peer truth surfaces. They are
fidelity-checked projections of the accepted Ontology. Together they are the
sign-off surface for domain identity, authority, behavior, lifecycle, and axiom
conformance.

### Ontology evidence

The design asset must cite one accepted Ontology for the active boundary and
include or reference its:

- entity and relationship inventory;
- invariant and cardinality law;
- entity-lifecycle completeness matrix;
- authority matrix;
- atomic-function and higher-order-function derivation matrix;
- governing composition and effect algebra where applicable;
- whole-family Prime contraction, including every accepted atom's admitted
  domain and realization-projection mapping; and
- explicit deferred, excluded, and unresolved functionality.

The Ontology may be a boundary-bounded slice of a wider accepted product
Ontology. The slice must cite its parent and preserve parent identity,
relationship, lifecycle, authority, and function law. Copying selected rows into
a new local model without that derivation creates another truth surface.

### Invariant Reconstruction Sufficiency (`STDO-UP-018`)

The evidence above is not a documentation deliverable. It is the durable
reasoning state a bounded actor needs, because the actor selecting a local
action generally does not hold the reasoning that produced the governing
frames. Dialogue, commentary, prior-agent memory, and implementation folklore
are not that state.

Given an accepted material-frame basis, as determined by the existing material
semantic boundary definition, and a proposed bounded action, the selected STDO
basis together with the accepted design must be sufficient to recover every
governing relation in the action's causally closed affected set, and to decide
whether the action preserves, changes, duplicates, or violates each of those
relations.

The two inputs are distinct and neither substitutes for the other. The selected
method describes which relations are required and how to reason about them; the
accepted design supplies the concrete invariant values. A design that restates
federal decision law to satisfy this rule reproduces the local-method
duplication this law exists to remove.

The four decisions are distinguished as follows:

| Decision | The action, against a governing relation |
|---|---|
| preserves | leaves the relation intact and operates inside it |
| changes | alters the relation itself, and therefore re-enters at that relation before acceptance |
| duplicates | establishes an equivalent path that is explicitly disposed as a constituent, replica, replacement, or deliberately independent realization |
| violates | contradicts the relation, or establishes an equivalent path that is left undisposed |

The boundary between `changes` and `violates` is the locus of acceptance, not
the size of the delta: an otherwise lawful change accepted inside the acting
frame rather than at the relation it changes is a violation. The boundary
between `duplicates` and `violates` is disposition, not equivalence: an
equivalent path is lawful when disposed and a defect when not.

Sufficiency is bound to a declared action and its affected set. It is not a
claim over an unbounded space of possible future changes, and the performance
of any particular reviewer is not evidence either way.

This obligation adds no artifact. It is satisfied through the Ontology
evidence, authority matrix, transformation-admission relation, frame
declaration, views, and module mapping already required, and is a property of
that material rather than a separate package.

This law is false if, for a declared bounded action, the accepted design does
not expose a governing relation in that action's causally closed affected set,
or the preserve, change, duplicate, or violate decision cannot be reached from
the selected STDO basis and accepted design, without conversation history,
commentary, prior-worker memory, or implementation folklore.

Where the sufficiency of a boundary is tested, the test uses named cases with
known governing relations and expected decisions, evaluated with conversation
history, commentary, prior-worker memory, and implementation folklore withheld.

### Domain model

The `classDiagram` is the structural domain projection of the Ontology. It must
show, for the active boundary:

- domain identities and cardinalities rather than helper-class decomposition;
- entity ownership, invariants, and lawful lifecycle relationships;
- atomic function families and their entity inputs and outputs where they cross
  the active boundary;
- higher-order composition relationships where they determine boundary shape;
- IACS carriers and their Prime-atom projection mappings;
- subordinate payloads;
- effect-edge-only payloads;
- downstream-only projections;
- deferred families outside the active slice;
- authoritative versus downstream role;
- public versus module-local visibility; and
- composition, containment, association, and real variant-family structure.

The standard stereotype vocabulary is:

- `<<prime-conformant>>`
- `<<subordinate>>`
- `<<effect-edge>>`
- `<<deferred>>`
- `<<authoritative>>`
- `<<downstream>>`

The standard visibility vocabulary is:

- `+` public or exported
- `-` module-local or private

The standard relationship expectations are:

- composition for owned subordinate payloads;
- association for downstream consumption; and
- inheritance only for real variant or outcome families.

### Sequence model

The `sequenceDiagram` is the behavioral projection of Ontology functions and
authority. It must show the supported execution path from admitted input to
result or truthful stop. It must name the owner and required authority of every
decision, admission, execution, projection, and effect boundary. Where
applicable it must show malformed input or output, retry, recursion,
fan-out/fan-in, nested workflow, and human escalation paths.

Every participant must exist in the domain model or be an explicitly external
actor. Every message must bind to a declared carrier transform, graph/C
constructor, interpreter action, or effect-handler call. A private loop,
service method, plugin, shell, or script may not silently replace a declared
workflow transition.

Every message must also bind to an Ontology function and its admitted authority
role. Actor identity or call reachability alone does not authorize a message.

### State model

The `stateDiagram-v2` is the lifecycle projection of Ontology entities. It must
show the complete admitted lifecycle for the active boundary, including
refusal, blocked, continuation, retry, escalation, and terminal states that the
boundary can produce. Every transition must bind to an Ontology function and
name its owning authority, admission, compiler, interpreter, event, projection,
or external act.

Controller-local memory is not a lawful source of lifecycle truth when the
product declares replay, event, graph, or carrier ownership.

### Cross-view axiom evaluation

The design pack must evaluate every applicable product, graph, language,
runtime, handler, and module axiom with one of:

- `pass`;
- `fail`; or
- `not_applicable`, with a reason.

The minimum evaluation columns are:

| Axiom | Ontology evidence | Authority | Domain evidence | Sequence evidence | State evidence | Native enforcement | Admission/compiler enforcement | Verdict | Gap owner |
|---|---|---|---|---|---|---|---|---|---|

The cross-view evaluation must prove that:

- every element in each view derives from the accepted Ontology;
- every discovered functionality row has a derived, deferred, excluded, or gap
  disposition;
- every sequence participant and lifecycle carrier exists in the domain model;
- every sequence message has a declared semantic or effect boundary;
- every lifecycle transition is derivable from admitted truth;
- every function and transition has an explicit authority path and composition
  does not widen that authority implicitly;
- every public operation is a projection of an Ontology function rather than an
  independently authored semantic peer;
- raw probabilistic output cannot transition directly to accepted or closed;
- handlers and plugins own interiors only when the runtime owns admission,
  events, continuation, and closure;
- native types enforce locally decidable relations; and
- admission or semantic compilation owns global references, completeness, and
  realization gaps.

For graph-native work, every batch, retry, recursion, or nested workflow must
be visible through the product's declared graph or compute algebra. A relied-on
`semantic_not_realized` constructor is a blocking gap. It may not be replaced
by imperative glue in a plugin, shell, service, script, or test harness.

### Gate and retrospective work

For a new or semantically changed boundary, the Ontology and design verdict must
both be `accepted` before the affected implementation, public contract, or
semantic carrier is promoted or the work claims design-method closure. Any
failed applicable axiom, missing functionality disposition, unresolved
authority path, or blocking realization gap keeps the verdict non-accepted.

For an unchanged `realization_refactor`, the gate is proportional: cite the
accepted Ontology and design basis, identify the touched projection set, and
prove that entities, relationships, lifecycle, authority, functions, effects,
and public semantics have no delta. That proof reuses the existing verdict; it
does not create a new Ontology or acceptance ceremony.

When `co_evolution_admissible(B)` holds, implementation may precede or develop
with design evidence and may be retained after reconciliation. Until the
design gate is accepted, it is provisional evidence: it does not author
semantic truth, earn publication authority, or satisfy promotion or closure.
Otherwise only a disposable spike may cross the affected unresolved,
contradictory, or materially non-equivalent relation before design acceptance.

Existing implementation placed under retrospective review may continue to
inform the affected design. Co-evolution remains lawful only while
`co_evolution_admissible(B)` holds; newly discovered material ambiguity,
contradiction, or materially non-equivalent network makes
`decision_complete(B)` false and activates the design gate for that decision.
Promotion and design-method closure remain blocked until the required
Ontology, three-view asset, and axiom evaluation are accepted. The design must
evaluate the code against prior authority; it must not rewrite the Ontology or
diagrams merely to rationalize an unlawful implementation shape.

The asset must stay boundary-bounded. It is a defect if it mixes an active
semantic boundary with unrelated bootstrap, test-harness, projection, or
delivery shapes merely to look complete.

If the Ontology, any of the three views, the cross-view evaluation, or either
accepted verdict is absent, the boundary is not design-method complete. Work
may continue as provisional co-evolution only when
`co_evolution_admissible(B)` holds, but the affected boundary may not be
promoted, published, or closed.

### Computational Realization Projection (`STDO-UP-019`)

The three views project domain structure, execution, and lifecycle. They
deliberately show domain identities, so they do not reveal that two
domain-distinct components rest on the same data structures and algorithms.
Repeated machinery is therefore invisible to a domain-only reading, and each
occurrence looks correctly owned and correctly named within its own entity.

**Component role sets.** Every material realization component has an explicit
set of semantic and operational roles. Technology capability does not confer
authority. A component's declared role set is design authority; where a role
carries authority, composition and use preserve the applicable authority
relation under `STDO-UP-004`, which is supporting law here rather than the
owner of the role model.

A component may lawfully hold several roles. Three cases must be distinguished:
behavior already inside an abstract declared role is ordinary variation; a new
operational responsibility and a new semantic or authoritative role are each
design changes. Only the latter two require re-entry. Use of a component
outside its declared role set must not silently establish identity, admission,
lifecycle, ordering, closure, or projection truth.

**The projection.** At a material semantic boundary, the design must project
the domain design into its computational realization: abstract data types,
identity and key structures, algorithms, algebraic laws, mutation and effect
boundaries, selected implementations, and domain-to-computational mappings. The
cross-view evaluation extends to prove the domain views and this projection
describe one system.

**The projection is subordinate.** It reveals repeated implementation
structure; it cannot decide semantic identity, ownership, or authority.
Computational similarity produces a candidate, never an adjudication:

```text
computational similarity
  -> commonization candidate
  -> semantic and operational equivalence evaluation
  -> reuse, parameterized common relation, or justified separation
```

Two components may share a map or an append-only sequence while differing in
identity and key law, ownership, ordering, admissible mutation, consistency and
concurrency, retention, failure semantics, access policy, lifecycle, or
authority over truth.

A materially non-equivalent law among those dimensions requires separation.
Other differences justify separation only when evaluation shows that
parameterization or adaptation would weaken ownership, authority, lifecycle,
failure, or operational constraints. The existence of a difference does not by
itself discharge Prime contraction or recurrence review.

**Disposition is two-part.** Each material algorithmic obligation in `M(B)`
carries a *semantic disposition* — existing accepted relation, extension, or
new candidate relation — and a *realization disposition* — consume, implement
locally, optimize, adapt, or deliberately duplicate under stated non-semantic
constraints. Isolation, substrate, performance, security, and dependency
ownership are each lawful grounds for an independent implementation.

The invariant is not that equivalent code is never rebuilt. It is that a local
realization must not present an existing accepted semantic or authoritative
relation as newly owned local truth.

This law is false if any of the following holds:

- two domain-named components implement materially equivalent abstract data
  types or algorithms without a semantic disposition;
- a generic building block becomes a new semantic authority;
- superficially similar operations are commonized despite different identity,
  ordering, failure, ownership, or lifecycle law; or
- a local realization presents an existing accepted relation as newly owned
  local truth.

## 5F. Theoretical Framing For Boundary Law

This method is operational and stands on its own. It does not require a user to
adopt the world-model domain or accept any empirical ontology program before
using it.

The capitalized `Ontology` in section 4B is the engineering Ontology of one
designed boundary. It does not require adoption of the Constraint-Emergence
Ontology, a world-model theory, or any other metaphysical or empirical claim.

The current world-model work does, however, provide a useful theoretical
framing for why these rules are shaped this way.

`WORLD_MODEL_METHOD.md` treats a Markov object as a candidate
identity-bearing cut: a stable self-bounding pattern whose effective blanket
separates what is load-bearing for identity from what is load-bearing for
context. Under that framing, the engineering problem is not "how do I name more
field groups?" but "what is the smallest lawful boundary that preserves the
thing's identity under variation?"

Read that framing into this method carefully:

- the **Irreducible Architectural Carrier Set** is the software-design analogue
  of the smallest identity-bearing cut
- the **Promotion Test** asks whether a subordinate payload has enough
  independent authority to count as its own boundary rather than as evidence
  carried inside another one
- **Boundary Inflation** is the software-design form of mistaking many sensed
  fragments, attributes, or payload groupings for many real peer objects
- strong typing at the semantic boundary prevents the identity-bearing cut from
  remaining fuzzy, reconstructive, or controller-owned

This is a theoretical justification, not an extra prerequisite.

The rules in this file remain engineering law even where the Markov-object
construct is irrelevant, unavailable, or still only candidate-class. The
theoretical framing sharpens the ask; it does not expand the scope of the
method.

## 6. Design Module Taxonomy

When this method governs a realization boundary, modules should be classified by
role.

Recommended roles are:

- **Carrier module**: defines typed immutable inputs, outputs, contracts,
  transitions, records, or envelopes
- **Semantic kernel module**: implements the main transforms over carriers
  without performing side effects
- **Effect shell module**: performs event emission, file publication, network
  calls, subprocess execution, persistence, or operator delivery
- **Projection module**: derives read models or reports from authoritative
  source truth
- **Binding or adapter module**: converts between external boundaries and the
  project's internal carriers without inventing semantic law
- **Constructor or materialization module**: writes generated or built artifacts
  from admitted carriers and explicit plans

The point of the taxonomy is not naming ceremony.

Modules are realization-level tools for bounding graph-traversal reasoning.

The point is to give reviewers, maintainers, and future refactor work a stable
cut for global reasoning without letting semantic law smear across mixed
authority surfaces.

A good module boundary improves the likelihood of correct traversal because the
computation and evaluation surface is better constrained. This is true for any
intermediate traversal of the graph under finite context, attention, and time.
Review can ask what the bounded unit owns, what it consumes, what it emits, and
what proof is sufficient without re-reading the whole system.

That same constrained surface makes later consolidation into reusable libraries
easier. Repeated module-local computations are visible as recurrence candidates
instead of disappearing into broad orchestration code.

## 6A. Design To Module To (Implementation, Unit Tests) Evidence Route

For a new or materially changed realization boundary, the canonical evidence
relation is:

```text
constitutional WHAT and owning requirements
  -> Ontology, IACS, target design, and three-view evidence
  -> implementation and module-derived unit tests
  -> reconciliation and acceptance
  -> promotion and design-method closure

implementation and module-derived unit tests
  -> evidence, counterexample, or falsification input
  -> affected Ontology or design relation
```

The first chain is semantic derivation. The second is evidence feedback and
cannot select or accept the affected semantic answer. When
`co_evolution_admissible(B)` holds, the two chains may proceed together without
making implementation semantic authority. Design still owns the structural
`HOW`. Where `decision_complete(B)` is false, the relation is design-gated at
the smallest causally closed affected decision set and retained implementation
follows its acceptance. An unchanged `realization_refactor` cites the accepted
relation and proves no material semantic-boundary delta; it does not recreate
the evidence.

Where construction is probabilistic or agentic, `SPEC_METHOD.md`'s Agentic
Construction Execution relation governs the handoff from this accepted design
basis into bounded construction, assessment, disposition, checkpoint, and
continuation. This method supplies the governing-frame, transformation-
admission, invariant-reconstruction, computational-realization, and module
evidence consumed by that protocol; it does not define a second execution
protocol.

Completeness requires:

- the final implementation must be traceable to the accepted Ontology;
- the final implementation must be traceable to design and module boundary
  assets
- unit tests must be traceable to module ownership, not only to helper layout
- implementation-first discoveries must be reconciled into the Ontology and
  three-view evidence before promotion or closure; and
- implementation may not compensate for an unrealized declared constructor by
  introducing a hidden controller or alternative authority path.

Unit tests may be discovered from implementation behavior, but the closure proof
must be re-expressed against module ownership rather than code helper shape.

The module boundary is the intermediate reasoning surface that lets
implementation and unit tests be audited against the same ownership cut.

It does not outrank constitutional truth or ratified design.

The minimum complete evidence chain is:

1. constitutional `WHAT`
2. accepted Ontology
3. target design
4. target module boundary assets and Ontology-derived IACS
5. accepted domain, sequence, and state projections with axiom evaluation
6. implementation
7. unit tests derived from the same Ontology and module boundary

Where a reference realization exists, the complete evidence chain becomes:

1. constitutional `WHAT`
2. reference design
3. accepted target Ontology and reference-to-Ontology mapping
4. target design mapping
5. target module boundary assets and Ontology-derived IACS
6. accepted domain, sequence, and state projections with axiom evaluation
7. implementation and unit tests derived from the same Ontology

If a change jumps from design or code straight to tests and never reconstructs
the module boundary, the proof surface is too weak.

## 6B. Module-Derived Unit Test Rule

Unit tests under this method are module-owned proof lanes.

They must derive from module ownership evidence, not from code shape alone.

That means a unit test should be traceable to:

- the accepted Ontology and applicable entity, lifecycle, authority, function,
  effect, or projection law
- the governing module design
- the active IACS or equivalent carrier inventory
- the module-bounded domain, sequence, and state projections
- the requirement families the module owns

Unit tests must not be authored primarily from:

- helper function boundaries
- private method layout
- incidental branch structure
- temporary implementation decomposition
- mock convenience that hides the real module contract

The required question is not:

- "what functions exist to test?"

It is:

- "what does this module own, and what proof does that ownership require?"

This does not prohibit helper-level tests.

It does prohibit helper-level tests from becoming the canonical proof surface
for a module boundary.

Canonical rule:

- module-owned unit tests are authoritative for module proof
- broader integration, scenario, and sandbox lanes remain downstream proof
  families
- transitional slice-gating tests may exist, but they do not replace
  module-derived unit proof

If a module has code but no module-derived unit test lane, the module is not
closure-ready under this method.

---

## 6C. Module Lifecycle Confirmation Rule

Every designed module, function, application surface, runtime surface, plugin
surface, public interface, data surface, graph function, or GTL module exists
inside an operational lifecycle. This method must confirm that lifecycle signal
at the realization boundary before design-method closure.

The canonical operational lifecycle chain is defined by `SPEC_METHOD.md` under
the Operational Lifecycle Sufficiency Rule. This method consumes that canonical
chain; it does not redefine the phases.

This checklist is not a release plan and does not replace `RELEASE_METHOD.md`.
It is an ambiguity detector for ultimate intended use.

For each governed boundary, design-module-method evidence must state, or point
to a surface that states:

- the upstream intent and requirement authority
- the build or realization surface
- the assurance and proof surface
- the release or packaging posture
- the deployment or install posture
- the live usage or invocation posture
- the observed telemetry, projection, or monitoring posture
- the retirement, revocation, supersession, or decommission posture
- the owner, source truth, and authority boundary for the lifecycle decisions

Each lifecycle phase must be one of:

- answered by the active design, requirement, release, deployment, or telemetry
  surface
- declared not applicable with a reason
- recorded as a named `Gap:` or `Unanswered:` item with an owning follow-up

A phase list without answers, not-applicable reasons, or named gaps is not
design-method evidence.

Implementation proves the selected lifecycle path only within the authority it
owns. Code, tests, generated artifacts, or runtime fixtures may confirm that a
lifecycle claim is real, but they may not invent lifecycle authority that the
product, requirements, design, release, or operational surface did not declare.

If the lifecycle checklist exposes missing release, deployment, live-use,
telemetry, or retirement truth, the module may still proceed only when that gap
is explicitly governed. It may not close by relying on local convention,
implementation precedent, mutable runtime state, prompt prose, or test-only
fixture behavior.

---

## 7. Immutable Carrier Rule

Source truth should be carried in typed immutable values unless mutation is
materially necessary.

Preferred shape:

- constructor or parser produces a typed carrier
- transforms consume one carrier and return another carrier or a closed result
- projections read those carriers without mutating them

Mutable carrier state requires explicit justification when it is:

- performance-critical
- required by the host runtime or framework
- modeling a genuinely stateful boundary rather than semantic truth

Convenience is not sufficient justification.

---

## 8. Totality Rule

Semantic functions should be total or as close to total as the language and
problem allow.

Preferred shape:

- invalid input is rejected at the boundary
- semantic kernels consume admitted carriers only
- failure is returned in a typed and explicit form when practical

Projects using this method should prefer:

- `Result`-like or closed outcome carriers
- explicit validation stages
- explicit "unsupported" or "rejected" outcomes

Projects using this method should avoid:

- partial functions that assume hidden preconditions
- semantic `.get(...)` fallback chains
- controller code that reconstructs missing truth from defaults

---

## 9. Effect-Edge Rule

Effects should be explicit and isolated.

Typical effect edges include:

- file writes
- network calls
- subprocess execution
- event append
- manifest publication
- prompt delivery
- database mutation

Semantic kernels should not perform these effects while also deciding the law.

The preferred sequence is:

1. admit or parse the authoritative input
2. transform it into a typed plan or outcome
3. apply effects at the edge using that plan or outcome
4. publish resulting events or projections downstream

If a function both decides the semantic meaning and directly performs the write,
the design should be treated as suspect.

---

## 10. No Semantic Center Rule

No controller, manager, service method, runtime loop, or public wrapper should
be the hidden semantic center of the system.

That includes:

- deciding meaning procedurally in orchestration code
- rebuilding truth from payload fragments
- rehydrating current law from legacy files or fallbacks
- flattening typed meaning into ad hoc dict handling and `.get(...)` chains

A module is acting as an unlawful semantic center when reviewers must read it to
discover:

- what counts as closure
- what identity means
- what failure means
- what work is next
- what the current truth is

Those meanings should already exist in carriers, contracts, or explicit design
modules.

---

## 11. Coupling Rule

Coupling should be reduced by dependency shape, not only by file count.

Preferred dependency direction is:

`carriers -> semantic kernels -> effect shells -> projections`

Not:

`controllers -> service helpers -> mutable runtime state -> projections`

Design is too coupled when:

- many modules read and mutate the same object
- projections must inspect implementation state to infer truth
- a consumer can silently rebuild source truth from raw artifacts
- tests pass only because multiple modules still carry the same meaning

Reducing coupling means reducing the number of places where meaning can be
invented.

---

## 11A. Governance/Strategy Separation Rule

When a boundary governs, observes, routes, audits, or evaluates another actor,
executor, builder, or substrate, it must publish governance truth, not
imperative strategy law, unless strategy ownership is explicitly part of the
boundary's ratified responsibility.

Lawful governance publication includes:

- current state
- preserved structure
- unmet pressure or unresolved ids
- route eligibility
- lawful edit or proof frontier
- admitted policy identity
- prior-turn or prior-run continuity

Unlawful strategy drift includes:

- imperative instructions about how the downstream actor should repair or act
- framework-owned preference rules masquerading as observability
- budgets, scores, counters, or heuristic ratings that recreate the governed
  actor's own judgment unless that assessment boundary is explicitly owned
- prompt, report, or read-model surfaces that become hidden strategy doctrine

The required distinction is:

- governance surfaces describe the state, boundary, and admissible routes
- strategy surfaces prescribe how another actor should do the work

If a system is meant to remain governance/observability over another actor, it
must not drift into replacement decision-engine behavior through contexts,
projections, prompts, or route helpers.

---

## 11B. Opportunistic Optimization Rule

When a realization boundary is lawfully open for migration, refactor, or
bounded implementation work, the area should be left better than it was found.

This does not outrank constitutional truth, declared module ownership evidence,
or functional equivalence. It is subordinate to them.

Opportunistic optimization is lawful only when it is:

- boundary-local to the active design or module surface
- behavior-preserving at the declared semantic boundary
- authority-neutral, with no change to ownership of truth
- visibility-neutral, with no silent promotion of subordinate payloads
- effect-neutral, with no hidden expansion of runtime, persistence, or
  bootstrap doctrine

Examples of lawful opportunistic cleanup include:

- removing parser re-entry on locally assembled truth
- consolidating duplicated module-local route logic
- replacing a poor local algorithm or repeated scan inside the active boundary
  when semantic behavior stays the same
- simplifying proof fixtures or module-derived tests without changing their
  governing module claims

Examples that are not opportunistic cleanup and therefore require explicit
design re-entry include:

- repricing lookup, indexing, caching, or persistence strategy across module
  boundaries
- changing public carriers, visibility, or ownership of truth
- widening effect boundaries or runtime observability doctrine
- introducing performance behavior that changes product expectations rather
  than only improving local realization quality

When a cross-boundary opportunity is discovered during lawful cleanup, it must
not be silently absorbed into the active boundary. It is repricing input. If
the owning authority admits follow-up implementation, that work enters
separately at the smallest lawful re-entry point.

This method owns the scope-separation rule. It does not own the work-tracking
mechanism. For ticketed work, `TICKET_METHOD.md` governs whether admitted
follow-up is recorded and how it affects ticket closure.

The test is simple:

- if the improvement stays inside the active boundary and preserves declared
  behavior, it is lawful cleanup
- if it changes authority, public meaning, or cross-boundary realization
  doctrine, it is a new design decision

Leaving an opened area better than it was found is good realization practice.
Using cleanup as cover for unauthorized redesign is not.

---

## 11C. Recurrence Extraction Rule

When the same realization pattern appears across more than one processed
boundary, review must treat that pattern as a commonization candidate rather
than as another purely local cleanup.

Module boundaries make this review possible. They constrain computation and
evaluation enough that repeated local shapes can be compared honestly and
consolidated into libraries without changing product truth.

A recurrence candidate is usually:

- not product truth
- authority-neutral
- reused across two or more tickets or module boundaries
- consumable through local adapters without changing semantic ownership

Typical candidates include:

- expectation derivation
- nested contract or policy carriers
- proof-helper or fixture shaping
- effect-edge request or plan shaping
- constructor or materialization helpers that do not own semantic law

The rule of two is:

- the second credible recurrence forces a library/commonization review
- the third local rebuild is not acceptable by default

A third local rebuild is not design-method conformant unless one of these is
true:

- the active boundary consumes an existing reusable library/commonization surface
- the active boundary extends that surface before the local implementation lands
- review records an explicit do-not-commonize decision and why the pattern is
  still boundary-specific

For ticketed implementation work, `TICKET_METHOD.md` owns the ticket-level
recording and enforcement of that decision through fields such as
`library_usage`, `governing_library`, and `library_rationale`. This section
defines the design-method review obligation, not a rival ticket lifecycle.

Preferred commonization order is:

1. boundary-local cleanup
2. tenant-local reusable library
3. shared/common propagation only through separate design re-entry

If a reusable pattern remains tenant-local and authority-neutral, it should be
extracted into a reusable library/common realization surface rather than being
recreated inside each module.

If commonization would change ownership, public carriers, module boundaries, or
shared/common law, it is no longer recurrence extraction. It is a separate
design decision and must be treated that way.

---

## 11D. Post-Ticket Design Review Rule

When a ticket adopts this method and claims its boundary has been processed, the
design-method closure claim should not rest on implementation status alone.

The processed boundary must be checked against its accepted design basis and
exact closure claim before the ticket claims closure under this method. This
check may be part of the ticket's normal verification; it does not require a
separate artifact, review round, or reviewer.

`TICKET_METHOD.md` remains the authority for ticket status, closure mechanics,
reopening, dependency handling, and follow-up ticket recording. This rule states
what the design check must cover when this method governs the ticketed
boundary.

That check must determine:

- whether the boundary stayed lawful under the current design and module assets
- whether the exact claim includes every causally applicable live requirement,
  accepted design relation, and retained predecessor claim
- whether the exact closure claim leaves competing or ambiguous authority on
  its acceptance path
- whether implementation established a material architectural decision with
  durable consequences that forecloses an admitted Product outcome
- whether any discovered issue falsifies the current claim or an applicable
  hard stop

The check reconstructs the complete selected function from governing
requirements through the accepted Ontology, Prime atoms, IACS, views, target
modules, implementation, and module-owned proof. It does not begin and end with
the previous review findings. Exact hashes establish subject identity; headings
and artifact presence establish location; green tests establish only the
properties they actually assert. None supplies a missing semantic relation or
substitutes a weaker property for the governed claim.

The required consequence is:

- an issue that falsifies the current claim or applicable hard stop blocks the
  design-method closure claim
- ticket or review wording cannot narrow applicable active authority away
- boundary-local cleanup or commonization is absorbed only when required to make
  the current claim true, preserve singular authority, satisfy accepted design,
  or avoid the durable architectural foreclosure above
- other cleanup, recurrence, generality, and cross-boundary opportunities are
  repricing inputs; they do not automatically widen the subject, block its
  bounded claim, or require a follow-up ticket
- any repricing admitted by the owning authority enters through the smallest
  lawful re-entry point

This rule keeps design closure truthful without turning discovery into automatic
scope expansion. Current defects and hard stops remain blocking. Useful
observations may survive as repricing input. Unclaimed future capability and
optional cleanup do not become implicit work.

No processed ticket that has adopted this method should claim design-method
closure until this bounded design check is complete.

---

## 12. Interface Bleed Prohibition

No interface should bleed semantic authority into another interface family.

Interface bleed exists when:

- one interface reconstructs another interface's source truth
- projection logic becomes closure logic
- report or prompt logic becomes admission logic
- public wrappers decide kernel semantics
- adapters invent meaning instead of translating boundaries

The required shape is:

- each interface family has one authoritative source truth
- downstream interfaces consume that truth
- crossing an interface boundary does not create a new semantic center

Low coupling requires semantic non-bleed, not only small functions.

---

## 13. Proxy Interface Prohibition

Projects using this method must not use proxy or partial interface
implementation as a substitute for real migration or real design completion.

A proxy interface is a new-looking surface that:

- forwards to the old authority path
- reconstructs missing truth from the old path
- keeps the old path executable behind a new name
- allows proofs to stay green while the old law still governs

This is bridge debt, not progress.

If compatibility is intentionally retained, it must be treated as an explicit
feature with its own bounded authority and proof.

Otherwise the proxy path must be removed.

---

## 14. Design Review Questions

When reviewing code under this method, ask:

1. Does semantic law live in typed carriers or in orchestration code?
2. Are the main steps readable as transforms over admitted truth?
3. Are effects isolated to explicit edge modules?
4. Can projections or reports invent closure independently?
5. Does each projection/query module derive from an admitted source carrier, or
   can it reconstruct a same-name but structurally different truth surface?
6. Is mutation justified, bounded, and local?
7. Can consumers pattern-match the source carrier directly?
8. Is any proxy or compatibility surface still silently authoritative?
9. Would removing the authoritative carrier make the system fail closed rather
   than silently rebuilding truth?
10. Does each new function project accepted Prime atoms without convenience
    aggregation or rival semantic authority?
11. Does any interface bleed semantic authority into another interface family?
12. For Python, does any governed semantic surface still rely on `Any`, open
    dict payloads, or untyped defs?
13. Has the boundary declared its Irreducible Architectural Carrier Set?
14. Which shapes are Subordinate Payloads, and why are they not staying
    subordinate?
15. Does every promoted top-level type pass the Promotion Test?
16. Has typed closure caused Boundary Inflation by multiplying peer types or
    parallel schema migrations?
17. Does this change avoid increasing truth surfaces, and reduce duplicate truth
    where duplicate truth exists?
18. Is any foreign or open payload still trusted past ingress?
19. Did enforcement follow proof, or is the typing/schema work cosmetic?
20. If this boundary governs another actor, is it publishing state and
    admissible routes, or imperatively prescribing strategy?
21. If a reference realization exists, has the target boundary been derived
    explicitly from reference design to target design to target module assets
    rather than from code drift?
22. Does a module-bounded domain projection exist and accurately show IACS
    carriers, their Prime-atom projection mappings, subordinate payloads,
    visibility, ownership, and deferred families from the accepted Ontology?
23. Do the unit tests derive from module ownership and module assets rather
    than from helper layout or incidental code shape?
24. If the change claims cleanup or optimization, does it stay boundary-local,
    behavior-preserving, and authority-neutral rather than becoming silent
    redesign?
25. If a cross-boundary opportunity was discovered, was it kept out of the
    current change unless the owning authority admitted it at the lawful
    re-entry point?
26. If the same realization pattern has already appeared elsewhere, did review
    make an explicit library/commonization decision rather than allowing
    another silent local rebuild?
27. If this would be the third local rebuild of the same realization pattern,
    is the change design-method conformant because it consumes or extends the
    governing library or records an explicit do-not-commonize decision?
28. If the ticket is making a design-method closure claim, did the bounded
    design check cover the exact claim and applicable hard stops without
    automatically absorbing optional discovery?
29. If the project is ODD-governed, is this module realizing a declared
    outcome traversal rather than substituting for the graph function?
30. Has review checked whether a deterministic module boundary is actually an
    operative edge traversal that should be declared under `ODD_METHOD.md`?
31. Do `F_D` evaluators, deterministic transforms, and effect shells remain
    subordinate to the GTL/ABG graph carrier rather than becoming the hidden
    program?
32. Does the boundary have a lifecycle confirmation against the canonical
    `SPEC_METHOD.md` operational lifecycle chain, or named `Gap:` /
    `Unanswered:` items for unresolved phases?
33. Are release, deployment, live usage, observed telemetry, and retirement
    questions answered by the proper authority surface rather than invented by
    implementation, prompt prose, local convention, or fixtures?
34. If a lifecycle phase is declared not applicable, is the reason explicit and
    compatible with the product and requirement authority?
35. Does the boundary have distinct Mermaid domain, sequence, and state-machine
    views rather than one carrier inventory or broad flowchart?
36. Does every sequence participant exist in the domain model, and does every
    message bind to a declared transform, graph/C constructor, interpreter act,
    or effect boundary?
37. Does every state transition derive from admitted carrier, event, or
    projection truth rather than controller-local memory?
38. Does the axiom matrix evaluate every applicable product, graph, language,
    runtime, handler, and module law with `pass`, `fail`, or reasoned
    `not_applicable`?
39. Is any relied-on graph, batch, retry, recursion, or workflow constructor
    still `semantic_not_realized`, and if so are promotion and closure blocked
    rather than bypassed with imperative glue?
40. Is the proportional sequencing relation justified, and is the design
    verdict explicitly `accepted` before promotion or closure and, where
    design-gated, before retained implementation establishes an unresolved or
    contradictory relation or chooses a materially non-equivalent network?
41. Does one accepted Ontology exist before IACS, public operation, schema,
    module, or implementation promotion?
42. Does the Ontology enumerate entities, identities, relationships,
    invariants, and logical lifecycle completeness without treating mutable CRUD
    as the default?
43. Does every Ontology function or transition declare proposer, evaluator,
    verifier, admitter, executor, projector, and retirement authority as
    applicable, with actor and capability kept distinct from authority?
44. Has every discovered functionality item been derived through an atomic
    function or higher-order composition, explicitly deferred or excluded, or
    assigned to a named gap?
45. Was Prime contraction applied to the complete candidate semantic-atom
    family and all proposed realization projections, with every accepted
    atom's admitted domain recorded, rather than only to functions, carriers,
    or isolated units?
46. Does the boundary declare its composition and effect algebra and prove
    identity, closure, cardinality, effect, and authority conservation where
    applicable?
47. Are the class, sequence, state, IACS, public contract, adapter, code, and
    test surfaces traceable projections of the Ontology with any accepted loss
    declared?
48. Would removing the Ontology reveal ungrounded meaning in a downstream view,
    operation register, controller, or implementation branch?

If these questions cannot be answered cleanly, the realization is too coupled
or too imperative.

---

## 14A. Functional Realization Review Checklist

When a project claims functional bias, pure transforms, immutable carriers,
single-owner truth, or low-coupling realization, review must explicitly check:

- [ ] Does the change preserve the constitutional `WHAT` and keep realization work
      inside lawful `HOW` surfaces only?
- [ ] Does the active boundary have one accepted Ontology that derives its
      entities, identities, relationships, invariants, lifecycle, authority,
      atomic functions, higher-order composition, effects, and projections?
- [ ] Does the entity-lifecycle completeness matrix give every declare/create,
      read/project, update/transition, and delete/retire question a lawful
      function, reasoned `not_applicable`, or named owned gap?
- [ ] Does the authority matrix distinguish actor, capability, proposal,
      evaluation, verification, admission, execution, projection, and
      retirement without implicit authority widening?
- [ ] Does the function-derivation matrix dispose every discovered
      functionality item and prevent direct verb-to-operation promotion?
- [ ] Has whole-family Prime contraction factored repeated behavior into
      parameterized atomic functions and declared higher-order composition
      before peer functions, operations, or carriers are promoted?
- [ ] Does Prime evidence cover the complete candidate semantic-atom family,
      record every accepted atom's admitted domain, and map accepted atoms to
      every proposed realization projection?
- [ ] Are the IACS, three views, public contracts, adapters, implementation, and
      tests fidelity-checked projections of the accepted Ontology rather than
      independent design authorities?
- [ ] If a reference realization exists, is the new realization functionally
      equivalent at the semantic boundary without copying incidental
      implementation drift?
- [ ] If a reference realization exists, does the target design explicitly map
      reference design to target design to target module boundary before
      implementation?
- [ ] Do implementation and unit tests both derive from the same module
      boundary assets rather than from code-first decomposition?
- [ ] Does each semantic truth surface still have one clear authoritative owner?
- [ ] Does the change reduce duplicated truth, controller reconstruction, and
      rival local authority paths?
- [ ] Do semantic functions consume admitted carriers only?
- [ ] Are semantic functions pure for the same admitted inputs?
- [ ] Are time, randomness, UUID minting, environment reads, process state,
      filesystem, network, and global registries absent from the semantic
      center?
- [ ] If identity is introduced, is identity creation explicitly owned by a
      declared ingress or effect boundary rather than hidden inside semantic
      helpers?
- [ ] Are carriers immutable and returned as new values rather than mutated in
      place?
- [ ] Is shared mutable state absent from the semantic center?
- [ ] Do semantic transforms operate directly on local admitted carriers rather
      than re-entering parsers, validators, or loaders on locally assembled
      truth?
- [ ] Is invalid or incomplete truth rejected at ingress instead of being
      repaired procedurally inside semantic code?
- [ ] Are defaults explicit, ratified, and carrier-owned rather than
      helper-owned?
- [ ] Does each function have one clear owner and one clear responsibility
      rather than mixing admission, semantics, and effects?
- [ ] Is coupling low by dependency shape:
      semantic algebra depends on carrier contracts, not runtime shells;
      admission depends on validation, not semantic orchestration; effect code
      stays at the edge
- [ ] Does no function both decide semantic meaning and perform effects?
- [ ] Are effect boundaries explicit, typed, and unable to erase carrier truth
      into open objects?
- [ ] Do package, bootstrap, controller, adapter, and runtime-shell layers stay
      below the semantic center?
- [ ] Do governance and observability surfaces publish facts, eligibility, and
      provenance only without imperative builder or executor strategy?
- [ ] Does the active boundary have complete Mermaid domain, sequence, and
      state-machine views that match the current IACS, visibility, ownership,
      behavior, lifecycle, and deferred-family split?
- [ ] Does the active boundary carry a complete cross-view axiom matrix and an
      explicit `accepted` design verdict with no bypassed realization gap?
- [ ] Do the unit tests for the active boundary derive from module ownership,
      IACS, and structural carrier assets rather than from helper layout?
- [ ] If the change includes cleanup or optimization, does it stay
      boundary-local, behavior-preserving, and authority-neutral?
- [ ] If the same realization pattern has appeared before, has the ticket made
      an explicit library/commonization decision rather than rebuilding it
      again silently?
- [ ] If a reusable library/commonization surface exists, does the ticket
      explicitly consume or extend it rather than duplicating the pattern
      locally?
- [ ] If no reusable library/commonization surface is used, is there an
      explicit rationale that the pattern is boundary-specific or not yet a
      lawful commonization candidate?
- [ ] If a cross-boundary opportunity was discovered, was it kept out of the
      current change unless the owning authority admitted it at the lawful
      re-entry point?
- [ ] If the ticket is making a design-method closure claim, did the bounded
      design check cover the exact claim and applicable hard stops without
      automatically absorbing optional discovery?
- [ ] Is there a negative proof showing that an imperative bypass, open-payload
      bypass, or effect-edge erasure fails closed?
- [ ] If the project is ODD-governed, does the deterministic module sit inside
      a declared outcome traversal rather than replacing one?
- [ ] If the module appears to decide next work, traversal closure, semantic
      target movement, or graph-function identity, has the boundary been
      repriced under `ODD_METHOD.md`?
- [ ] Does the active boundary carry lifecycle confirmation against the
      canonical `SPEC_METHOD.md` operational lifecycle chain, with each phase
      answered, declared not applicable with a reason, or recorded as a named
      `Gap:` / `Unanswered:` item?
- [ ] Are release, deployment, live usage, telemetry, and retirement claims
      confirmed against product, requirement, design, release, or operational
      authority rather than derived from implementation convention or fixtures?

For a new or materially changed boundary, the compact hard-gate version of this
checklist is:

- [ ] accepted Ontology before promotion or closure and, where design-gated,
      before retained implementation establishes an unresolved or contradictory
      relation or chooses a materially non-equivalent network
- [ ] complete entity lifecycle, authority, and function-derivation evidence
- [ ] whole-family Prime contraction, accepted atom domains, realization
      projection mappings, and declared composition/effect algebra
- [ ] pure functions in the semantic center
- [ ] immutable carriers with no shared mutable semantic state
- [ ] one owner per truth surface
- [ ] low coupling between admission, algebra, and effect edges
- [ ] no hidden runtime authority in semantic code
- [ ] accepted domain, sequence, and state-machine projections of the Ontology
- [ ] complete cross-view axiom evaluation with no bypassed realization gap
- [ ] functional equivalence to specification and, when present, the reference
      realization at the semantic boundary
- [ ] lifecycle confirmation or named lifecycle gaps against the canonical
      `SPEC_METHOD.md` operational lifecycle chain
- [ ] negative proof for imperative or open bypass

This checklist is language-agnostic.
It governs module design, carrier design, data-entity design, and review of
realization work in any language.

For an unchanged boundary, the hard gate is the accepted basis plus evidence
of no material semantic-boundary delta. It does not require a new Ontology,
IACS, three-view asset, cross-view evaluation, or unit-test lane.

---

## 15. Adoption Guidance

Projects may adopt this method by:

- citing it in ADRs or design surfaces
- naming it in `AGENTS.md` as the preferred realization discipline
- using it as review criteria for implementation-migration tickets
- classifying implementation modules by the taxonomy in this method

When a project adopts this method, it must apply it consistently across the
named boundary:

- Ontology and architecture derivation
- design modules
- runtime or execution kernels
- prompt assembly and reporting paths
- constructors and materializers
- projection and query surfaces

For migrations involving carrier closure, schema closure, or governance
boundaries, projects should make the Boundary Closure Evaluators explicit in
the governing ADR or ticket rather than leaving them implicit.

Every new or materially changed adopted semantic boundary must declare or cite
its accepted Ontology before claiming design-method completion. The Ontology
evidence must include entity lifecycle, authority, function derivation,
whole-family Prime, each accepted atom's admitted domain, atom-to-realization
projection mappings, and projection traceability at the granularity applicable
to the material change.

When the material change includes schema or typed carrier work, the project
must derive and reconcile the Irreducible Architectural Carrier Set from that
Ontology before claiming design-method completion.

When the new or materially changed boundary is derived from an existing
realization, the project must also publish the reference-to-target derivation
asset and the Ontology-derived three-view design asset before claiming
design-method completion for the changed boundary.

When the new or materially changed boundary has active implementation, the
project must also publish a module-derived unit test lane before claiming
closure for that change.

Partial adoption is allowed, but the adopted boundary and adopted rule family
should be named explicitly.

Partial adoption may narrow scope.

It must not be used to claim design-method completion while skipping the evidence
needed to audit, refactor, or reconstruct the realized boundary.

---

## 16. Relationship To Other Method Surfaces

- `SPEC_METHOD.md` governs constitutional process, authority flow, repricing,
  and migration law
- `RELEASE_METHOD.md` governs release-cut, product, install, and tap-process
  evaluation
- `ODD_METHOD.md` governs graph-native constructive carrier law
- `DESIGN_MODULE_METHOD.md` governs preferred realization structure inside
  implementation and design modules
- `UX_METHOD.md` refines this method for UX surfaces with rendering,
  state-transition, and effect-membrane rules; load it only when the work
  realizes a UX surface

So:

- `SPEC_METHOD.md` answers what is lawful process
- `RELEASE_METHOD.md` answers what is a lawful release, product, install, and
  tap decision
- `ODD_METHOD.md` answers what is lawful graph-native product shape
- `DESIGN_MODULE_METHOD.md` answers what is the preferred implementation design
  discipline when you want Ontology-first derivation, low coupling, no
  interface bleed, and explicit authority and effect management
- `UX_METHOD.md` answers the additional discipline that applies when a module
  realizes a UI surface

For ODD-governed products, `ODD_METHOD.md` decides whether the operative unit is
an outcome traversal, graph function, GTL module, or ABG runtime boundary.
`DESIGN_MODULE_METHOD.md` then governs the deterministic module structure that
realizes, evaluates, adapts, or projects inside that ODD boundary. When that
boundary includes a UX surface, `UX_METHOD.md` adds the render-purity,
reducer-purity, effect-membrane, and AssetSurface-binding rules required for
strong functional consistency between front-end and back-end.

The module lifecycle confirmation rule in this method detects whether the
realization has enough lifecycle signal to be safely built and reviewed. It
does not decide release eligibility, tap acceptance, install policy, or
operational rollout. Those decisions remain governed by `RELEASE_METHOD.md` and
project-owned release, deployment, or operational surfaces.

---

## 17. Non-Goals

This method does not require:

- one specific programming language
- elimination of all imperative code
- monadic or category-theory vocabulary
- replacing every exception with a custom algebraic type

It does require that the implementation shape remain readable, modular, and
honest about where meaning lives and where effects happen.

Where a boundary composes higher-order functions or effectful computation, it
does require an explicit composition and effect algebra with its applicable
identity, closure, cardinality, effect, and authority-conservation laws. The
vocabulary is optional; the law is not.
