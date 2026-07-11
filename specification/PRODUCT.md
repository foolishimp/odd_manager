# Product

**Status**: Active
**Derived From**: `specification/INTENT.md`, `.genesis/docs/standards/SPEC_METHOD.md`, `.genesis/docs/standards/GRAPH_METHOD.md`
**Purpose**: Define the current control-plane product realization for `odd_manager`

## Product Position

`odd_manager` is an operator-facing control-plane product for outcome-driven
systems built on GTL and ABG.

It provides one lawful control surface over:

- a maintained portfolio of managed Projects and their selected revisions
- graph sets, typed assets, asset graphs, bindings, and workorders
- GTL declarations
- ABG runtime truth
- domain-package surfaces published by the active `odd_*` workspace contract
- workspace evidence, provenance, and closure material
- specification proposals, admitted semantic build requests, supervised build
  process lifecycle, gate/asset assurance, and operator attention
- multiple stakeholder entry lenses over one shared world model, including
  requirement-first and process-first delivery views

The observation contract is necessary but not the whole product. The manager
also admits typed product commands, coordinates bounded work across Projects,
and correlates those commands with runtime truth. It does not interpret GTL or
replace ABG.

The cross-domain foundation is:

- declared domain-package identity and query-contract identity
- URI-addressed assets
- declared asset types
- asset families and asset collections
- typed asset nodes
- explicit bindings
- named functions over asset graphs
- GTL graph-function carriers
- published jobs, programs, edge contracts, and work-act types where the
  upstream query library exposes them
- ambiguity register, ambiguity policy, and capability-gated stop-state overlays
- ABG runtime facts and aggregates
- direct ABG event and projector access for runtime state
- admitted, versioned GTL/ABG run projections, including graph-function
  selection, graph calls, frames, traversal, payload and evidence facts,
  continuation, assurance, event carriers, and source artifacts
- selected Project and source/specification revision identity
- typed specification proposals and their validation and acceptance posture
- typed build requests over published jobs, graph functions, workorders, or
  another domain-admitted semantic carrier
- manager-owned queue and external process-lifecycle facts correlated to
  ABG-owned run identity
- required and delivered gate, asset, evidence, residual, and attention facts
- domain-package query-library overlays for domain understanding that ABG does
  not own

The live core observation path is ABG/GTL first. ABG system-ledger and catalog
projection remains available even when no compatible domain pack is installed
or selected.

The current reference product and first full control-loop proof target is
`odd_glc`, interpreted through its published identity, callable carriers, run
proofs, event carriers, typed test assets, and product overlays. This proves
generic manager contracts; it does not create a hard-coded `odd_glc` lane.
Historical `odd_sdlc.query-domain` surfaces remain design history only; no
`odd_sdlc` runtime, adapter, or privileged projection defines the live product.

It is not:

- the GTL/ABG runtime itself
- the domain product itself
- a retrofit of a transport-metaphor dashboard
- a clone of Paperclip's company/org ontology

Its job is to make current truth legible and operable without inventing a rival
semantic center.

## Primary Persona And Interaction Goal

The first primary persona is the developer managing multiple Spec Method and
ODD-governed software Projects through `odd_glc` or another admitted domain
package.

The developer's primary interaction goal is:

> Move one or more selected Project revisions from governed specification to
> evidence-backed, gate-complete build outcomes.

The product organizes that goal as one loop:

```text
portfolio attention
  -> review Project
  -> tune specification through an attributable proposal
  -> validate and accept or reject the proposal
  -> submit an admitted semantic build
  -> supervise one or more concurrent build executions
  -> verify required gates, assets, evidence, and residuals
  -> converge, repair, escalate, or lawfully re-enter
```

Observation supports this loop at four levels:

1. portfolio awareness across Projects
2. goal-oriented Project review and control
3. live build supervision and intervention
4. forensic runtime and evidence inspection

AI Workspace and Run Inspector are supporting observation capabilities. They
are not the developer's end goal or the default organizing principle of the
product.

## Pre-release Compatibility Posture

`odd_manager` has no released product line yet.

Therefore the live operative surface is forward-only.

The product is not required to preserve backward compatibility for stale
pre-release observer contracts, payload shapes, UI structures, or terminology
that no longer match live upstream truth.

Compatibility may be kept only where it lowers migration cost without distorting
current constitutional or design truth.

## Product Terms

### Control Surface

One operator-facing surface that composes runtime truth, domain overlays,
policy, evidence, and coordination without introducing a second runtime or a
shadow semantic center.

### Developer Operator

The first primary user of the product: a developer who manages multiple
governed Projects, tunes specification, submits semantic builds, supervises
execution, and verifies evidence-backed delivery.

### Project

A filesystem and version-control entity (typically a Git repository) on disk
that the manager scopes over. Each Project carries an `odd_type` tag declaring
which Workspace lenses are admissible over it. The Project owns the workspace's
data, code, specifications, and `.ai-workspace/` runtime topology. One Project
may carry one or more Workspace lenses.

Projects are not limited to `odd_*` workspaces. A non-ODD Project, an
unknown-identity Project, `specification_methodology`, or a pre-bootstrap
source tree may be registered so the operator can browse files, inspect code,
copy paths, and prepare future bootstrap work. Domain-specific widgets must
fail closed when their required Workspace contract is absent, but the generic
Project/file workbench remains admissible.

### Project Revision

The immutable source and specification identity against which a proposal,
build request, run correlation, gate assessment, or asset-delivery claim is
made. A revision may identify a commit, an isolated worktree state, or another
admitted version-control snapshot. Dirty or changing state is explicit; it is
never silently treated as the same build basis.

### Manager Workspace

The `odd_manager` operator workspace that owns manager-local state, including
the maintained Project registry. This is distinct from the managed Project and
distinct from the `odd_*` Workspace lens applied to that Project.

### Project Registry

A manager-workspace-owned maintained list of Projects known to the operator.
Browse, scan, and manual path entry discover candidates; explicit registry
actions add or remove Projects. The registry is the Projects collection seen by
manager UX and agent surfaces.

### Project Portfolio

The manager-owned projection over registered Projects that presents identity,
revision, specification readiness, active build posture, gate/asset posture,
participants, freshness, and attention state. It coordinates selection and
operator action but does not merge Project truth into a central project model.

### File Path Memory

A manager-local operator utility that records recently selected project file
paths with their Project root, relative path, source selector, and selection
time. It exists to make CLI and agent handoff practical: selecting or copying a
file path makes the absolute path paste-ready and keeps a bounded recent-file
surface for re-copying or opening the file again. Built-in Tickets and Comments
selectors use the same filesystem-backed selection behavior as Browse and
pinned folders. File Path Memory is operator workspace state, not
source-project truth.

### Workspace

A governance identity and custom UX suite — concretely an `odd_*` package such
as `odd_glc` or a future `odd_*` domain. The Workspace
defines the methodology, the published domain contract, the enabled UX widgets,
and the policy overlays applied while operating over a Project. The Workspace
is the lens; the Project is the thing viewed through it.

### Context

The runtime binding `Context = Project × Workspace`. Context is the operational
unit the manager and any agent execute under. It scopes the filesystem root
(from Project), the published domain contract where available (from Workspace),
the enabled UX widgets, and the MCP
resources exposed to the agent. An agent execution binds to a Context — not to
a Workspace or a Project alone. Embedding semantics default to
local-by-default: a Context selection within an embedded widget scopes only
that pane; explicit pinning promotes the local selection to the global active
Context.

### Capability Module

An independently evolvable manager capability with declared inputs, product
contracts, STDO-UX state and message algebra, commands, subscriptions, views,
availability states, and proof. Capability modules integrate through shared
Context, typed commands and events, navigation, and evidence. They do not own
one another's internal state and are not separate applications or world models.

### Project Workbench

The goal-oriented composition surface for one selected Project. It integrates
capability contributions around `Review -> Tune -> Build -> Assure` while
remaining thin: capability state, commands, services, and domain rules stay
inside their owning modules or published product carriers. A registered Project
deep link resolves to this surface.

### Core System Page

A manager-owned page or tab whose meaning is stable across domain packages
because it is grounded in GTL/ABG runtime, history, evidence, provenance, or
traceability truth.

### Domain Package

A concrete `odd_*` package that publishes one domain-specific graph-function
world, query contract, domain model, and domain overlays over the GTL/ABG
substrate.

### Domain Contract

The published identity surface for one domain package and one query-model
version, used by the manager to determine what domain overlays and domain UI
surfaces are admissible.

### Domain UI Pack

A manager-owned adapter pack that binds one supported domain contract to
domain-specific tabs, inspector renderers, labels, and operator actions.

### Domain Page

A page or tab contributed by a compatible domain UI pack for one active domain
package, such as SDLC-specific builder/release views or world-model hierarchy
views.

### GraphSet

A workspace-scoped set of one or more published graphs observed by the manager.

### Asset

A durable truth or delivery surface identified by URI.

### Asset Type

The semantic role an asset fulfills in the domain.

### Asset Family

A named semantic grouping over related asset types and lifecycle lanes.

### Asset Collection

A named working set of assets treated as one bound scope.

### Asset Node

A typed locus in a graph that receives one asset or one asset-collection
binding.

### Asset Graph

The dependency topology over typed asset nodes.

### Asset Binding

The mapping from one concrete asset or asset collection into one typed asset
node at call time.

### WorkOrder

The manager-facing published callable transformation over typed asset nodes.

A workorder is realized by a domain function and carried by a GTL
`GraphFunction`.

### Graph Function

The GTL-level public named callable carrier underlying a published workorder.

Its declared `environment` contract is cumulative rather than one-step piped.

### Edge Contract

A published description of one lawful graph transition, its conditions, and its
closure posture.

### Program

A higher-order published workflow or carrier grouping over multiple callable
surfaces.

### Work Act Type

A published class of constructive or operational software-domain act used to
explain what kind of work happened and how it should be governed.

### Outcome

A derived convergence or posture view over graphs, assets, workorders, proof,
and closure state.

### Transition

A derived or explicit relation between typed asset states, graph boundaries, or
convergence targets.

### Work Vector

A productized operator or builder view over one public graph-function carrier
and its realized internal vectors.

It may summarize lawful composition or recursion, but it is not itself the
public callable carrier.

A work vector is not a runtime primitive.

### Entry Lens

A user-facing entry point that organizes one shared information model around
one primary supervisory question.

Entry lenses may emphasize different objects and filters, but they do not mint
a second world model or rival truth surface.

### Requirements View

A requirement-first entry lens for delivery stakeholders.

It frames current project state around human-readable requirements and their
downstream design, implementation, proof, work, and discussion surfaces.

### Process View

A process-first entry lens for delivery stakeholders.

It frames the same underlying project state around build activity, process
flow, and execution posture rather than around a selected requirement.

The Project Workbench is the goal-oriented process entry surface. Build
Portfolio contributes cross-Project queue and execution posture. Run Inspector
is the deep forensic process capability: it discovers admitted runs within the
selected Project and exposes overview, graph, traversal, functions, assets,
diagnostics, catalog, assurance, events, stages, transcripts, and artifacts
from one generic `AbgRunObservation` carrier. Domain overlays may label admitted
refs but do not own runtime truth. Historical Process Navigator and
Python/TypeScript SDLC projection shapes do not define the live contract.

### Information Widget

A reusable product read-model surface that presents one bounded slice of the
shared world model.

Information widgets are collapsible, drillable, and traceable to underlying
authoritative surfaces. Totals and summary badges are saved queries over shared
backing objects rather than independent truth.

### Requirement Workbench

The requirement-scoped inspection surface that gathers history, design,
implementation, proof, work tracking, and discussion around one selected
requirement.

### Specification Proposal

An attributable candidate change against named constitutional source surfaces.
It records context, participant, basis revision, proposed diff, deterministic
validation, affected authority and downstream surfaces, and acceptance or
rejection. A proposal is not constitutional truth until admitted through its
explicit acceptance carrier.

### Build Request

A manager-admitted command to execute one published semantic carrier against a
named Project Revision and Context. It declares command identity, carrier
reference, inputs, target/until posture where published, requested resources,
requester, policy basis, and correlation identity. It is not a shell string and
does not contain manager-authored traversal policy.

### Build Execution

The manager-owned queue and external process-lifecycle record created from one
admitted Build Request. It may be queued, starting, running, waiting for human
authority, converged, failed, cancelled, stale, or disconnected. It correlates
to zero or more ABG-owned Runs without becoming runtime truth itself.

### Build Portfolio

The bounded cross-Project projection over Build Requests and Build Executions,
including concurrency, queue, resource, freshness, correlation, and attention
posture.

### Gate Requirement

A product- or domain-published condition that must be satisfied for a named
build outcome. The manager may project and group gate requirements but does not
invent their meaning.

### Gate Assessment

A source-attributed projection of required, satisfied, failed, missing, stale,
unsupported, or human-decision posture for one Gate Requirement against one
Project Revision and Build Execution.

### Asset Delivery

A source-attributed relation between one required or expected asset and the
materialized artifact, producer, revision, evidence, digest, and freshness that
support its delivery claim.

### Attention Item

A manager projection identifying a condition that requires operator awareness
or action. It records source, severity, affected Project and Build Execution,
reason, freshness, and bounded lawful reactions. It does not silently perform
repair or choose runtime continuation.

### Semantic Job

A durable semantic work contract over published graph functions and declared
roles.

### Run

One engine-owned execution attempt over semantic work.

### Graph Call

One engine-owned realization of one published graph-function boundary against a
resolved live runtime environment.

### Frame

One recursive invocation aggregate inside a graph call.

### Continuation

One engine-owned durable open governance obligation or unresolved runtime
condition derived from event truth.

### Runtime Fact

An emitted ABG event or replay-derived runtime truth surface.

### Policy Surface

A declarative control surface over dispatch, evaluation, escalation, proof, or
closure without redefining graph law.

### Ambiguity Register

A query-derived domain surface that records major ambiguity, its current status,
policy action, threatened invariants, affected assets, and expected resolving
boundary.

### Capability Contract

A tenant-local declared capability surface that governs whether an executional
or operational stage is lawful.

### Bounded Stop State

An honest non-converged posture such as `pending_capability`, `fh_required`, or
another lawful blocked or carried state that marks why downstream closure has
not been reached.

### Proof Lane

A declared evidence and proving surface used to justify capability or closure
claims.

### Provenance

The attributable lineage that explains how a declaration, call, event, proof,
or closure claim came to exist.

## Goal Model

`GOALS.md` focuses the current wave of control-plane repricing work.

Intent sets the enduring direction.

Product defines the current manager boundary.

Requirements and shared design then decompose that boundary into constitutional
truth and realization law.

## Product End State

The intended end-state product shape is:

1. install `odd_manager` as its own GTL/ABG project
2. preserve a clean separation from `abiogenesis`, `odd_method`, and any one
   concrete domain package
3. publish the manager ontology around graph sets, typed assets, asset graphs,
   bindings, workorders, jobs, roles, runs, calls, continuations, evidence,
   provenance, and closure
4. start from one common workspace loader that resolves the selected
   workspace's primary identity before choosing domain landing pages, domain
   entry lenses, labels, and shell framing
5. split the UI into manager-owned core system pages plus domain-contributed
   pages and actions selected through compatible domain UI packs
6. publish the operator visual language and graph-workspace styling as
   `odd_manager`-owned design law
7. keep shared design law under `build_tenants/common/design/`
8. implement the operator UI in a tenant-local carrier after the design package
   hardens
9. support serious runtime supervision, failure recovery, policy inspection,
   evidence review, and closure explanation
10. treat all dashboard summaries as projections over declaration truth and ABG
   event truth rather than as shadow runtime state
11. remain forward-only before first release rather than carrying stale
   pre-release compatibility debt
12. make the multi-Project developer portfolio and Project Workbench the
    organizing surfaces for `Review -> Tune -> Build -> Assure`
13. admit typed specification proposals and build requests while preserving the
    authority split between manager coordination, domain semantics, and ABG
    runtime truth
14. supervise bounded concurrent external build processes with stable Project,
    revision, request, execution, and run correlation
15. expose required-versus-delivered gate and asset assurance and route explicit
    attention into bounded reaction or lawful re-entry
16. compose independently evolvable STDO-UX capability modules through shared
    Context, contracts, commands, events, navigation, and evidence

## Current Product Definition

The current product definition of `odd_manager` is:

- a fresh control-plane project boundary
- a design-first project initialized with the ABG installer
- a project with a published domain model under `specification/domain/`
- a project with a published operator visual system under
  `build_tenants/common/design/`
- a manager product subordinate to GTL/ABG runtime law, `odd_method`
  methodology, and the active workspace's published domain-package truth
- a control surface over ABG runtime truth and live domain query-derived
  overlays, including ambiguity and capability posture where published
- a new control-plane product that preserves an established shell, inspector,
  board, and graph-workspace visual language without inheriting a transport
  ontology
- a pre-release product with no obligation to preserve stale backward-compatible
  observer contracts while the live upstream surface is still repricing
- a product whose manager-owned core system pages remain cross-domain while
  domain pages and actions are selected through a compatible domain UI pack
- a product whose common loader resolves primary project identity separately
  from governance-package identity before selecting the initial landing page
  and domain page family
- a product whose common loader accepts a deep-linked absolute local path for
  an already registered Project, gives that link precedence over saved local
  context, keeps the selected Project path in the browser URL, and resolves the
  Project Workbench as the goal-oriented landing surface
- a product whose shell title and initial domain framing present the selected
  workspace as `Odd SDLC`, `Odd World Model`, or later `odd_*` domain lines
  according to primary identity rather than according to manager branding alone
- a product allowed to ship with placeholder domain-detail surfaces only where
  the current active domain package has not yet published richer semantic detail
- a product that composes ABG-native runtime projections with domain query
  results instead of depending on one monolithic observer payload
- a product that offers requirement-first and process-first stakeholder entry
  lenses over one shared world model rather than separate widget systems
- a product organized for its first primary persona: the developer operating a
  portfolio of governed software Projects through review, specification
  proposal, admitted build, supervision, and assurance
- a product whose manager-owned command authority covers proposal admission,
  queueing, bounded external process lifecycle, correlation, cancellation, and
  attributable operator decisions without taking ABG traversal or closure
  authority
- a product whose major capabilities are modular for independent iteration and
  integrated through clean typed boundaries rather than accumulated in one
  workbench component or duplicated state model
- a product whose information widgets remain collapsible, drillable, and
  traceable to human-readable and authoritative underlying surfaces
- a project whose live observation design law sits in
  `build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`
- a project whose installer-seeded `build_tenants/odd_manager/python/` surface
  remains starter scaffold only, not the chosen control-surface carrier

The current active implementation target is:

- `build_tenants/react_vite/`
- current core observation contract: versioned, source-attributed GTL/ABG run
  truth discovered through the selected Project topology
- current reference product: `odd_glc` data-mapper proof and event carriers
- current process-first surface: generic Sidecar Run Inspector with no
  privileged domain adapter

## Current Implementation Posture

The React tenant realizes the modular developer-control foundation and the
generic manager MVP. It provides Project registration and deep links, Build
Portfolio, the goal-oriented Project Workbench, attributable Specification
Proposals, typed Build Request admission, bounded single and concurrent build
supervision, gate/asset Assurance and Attention, durable shells, tickets,
files, AI Workspace observation, and deep Run Inspector and traversal
projections. These capabilities compose through one shared Project/revision
Context and typed command membrane without taking GTL traversal or ABG runtime
closure authority.

The manager-owned `Review -> Tune -> Build -> Assure` path is proven against
admitted dynamic product fixtures and a digest-pinned production adapter
contract. It is not yet proven against the named live `odd_glc` data-mapper
product carrier. `odd_glc` must publish its declarations-only non-test Build
Carrier Descriptor, execution adapter, Assurance Catalog, and matching build
evidence bundle, and the required ABIogenesis candidate must complete F_H
promotion. Until those external product facts exist, odd_manager reports the
capabilities as unavailable and does not substitute a test harness, browser
command, or shell path for product truth.

AI Workspace and Run Inspector remain supporting observation and forensic
capabilities inside this loop. They are not alternative product centers or
evidence authorities.
