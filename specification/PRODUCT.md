# Product

**Status**: Active
**Derived From**: `specification/INTENT.md`, `.genesis/docs/standards/SPEC_METHOD.md`, `.genesis/docs/standards/GRAPH_METHOD.md`
**Purpose**: Define the current control-plane product realization for `odd_manager`

## Product Position

`odd_manager` is an operator-facing control-plane product for outcome-driven
systems built on GTL and ABG.

It provides one lawful control surface over:

- graph sets, typed assets, asset graphs, bindings, and workorders
- GTL declarations
- ABG runtime truth
- domain-package surfaces published by the active `odd_*` workspace contract
- workspace evidence, provenance, and closure material
- multiple stakeholder entry lenses over one shared world model, including
  requirement-first and process-first delivery views

The manager may be implemented against a stable observation contract before the
full multi-domain library hardens.

That stable contract is:

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
- domain-package query-library overlays for domain understanding that ABG does
  not own

The first supported concrete pack is the observed `odd_sdlc` query-domain line
currently carried as `odd_sdlc.query-domain v16`.

That first pack is expected to project generated requirement, scenario,
design, test, release, operational-cycle, execution-contract, start-target,
asset-ownership, capability, and gap-dossier surfaces like those emitted by
the observed `data_mapper.test38` workspace. Those remain domain overlays over
the manager's shared core ontology rather than new GTL/ABG runtime primitives.

It is not:

- the GTL/ABG runtime itself
- the domain product itself
- a retrofit of a transport-metaphor dashboard
- a clone of Paperclip's company/org ontology

Its job is to make current truth legible and operable without inventing a rival
semantic center.

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

### Project

A filesystem and version-control entity (typically a Git repository) on disk
that the manager scopes over. Each Project carries an `odd_type` tag declaring
which Workspace lenses are admissible over it. The Project owns the workspace's
data, code, specifications, and `.ai-workspace/` runtime topology. One Project
may carry one or more Workspace lenses.

### Manager Workspace

The `odd_manager` operator workspace that owns manager-local state, including
the maintained Project registry. This is distinct from the managed Project and
distinct from the `odd_*` Workspace lens applied to that Project.

### Project Registry

A manager-workspace-owned maintained list of Projects known to the operator.
Browse, scan, and manual path entry discover candidates; explicit registry
actions add or remove Projects. The registry is the Projects collection seen by
manager UX and agent surfaces.

### File Path Memory

A manager-local operator utility that records recently selected project file
paths with their Project root, relative path, source selector, and selection
time. It exists to make CLI and agent handoff practical: selecting or copying a
file path makes the absolute path paste-ready and keeps a bounded recent-file
surface for re-copying or opening the file again. File Path Memory is operator
workspace state, not source-project truth.

### Workspace

A governance identity and custom UX suite — concretely an `odd_*` package such
as `odd_sdlc`, `odd_world_model`, or a future `odd_*` domain. The Workspace
defines the methodology, the installed query contract, the enabled UX widgets,
and the policy overlays applied while operating over a Project. The Workspace
is the lens; the Project is the thing viewed through it.

### Context

The runtime binding `Context = Project × Workspace`. Context is the operational
unit the manager and any agent execute under. It scopes the filesystem root
(from Project), the installed query contract (from Workspace, e.g.
`odd_sdlc.query_contract` v16), the enabled UX widgets, and the MCP resources
exposed to the agent. An agent execution binds to a Context — not to a
Workspace or a Project alone. Embedding semantics default to local-by-default:
a Context selection within an embedded widget scopes only that pane; explicit
pinning promotes the local selection to the global active Context.

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
- a product whose shell title and initial domain framing present the selected
  workspace as `Odd SDLC`, `Odd World Model`, or later `odd_*` domain lines
  according to primary identity rather than according to manager branding alone
- a product allowed to ship with placeholder domain-detail surfaces only where
  the current active domain package has not yet published richer semantic detail
- a product that composes ABG-native runtime projections with domain query
  results instead of depending on one monolithic observer payload
- a product that offers requirement-first and process-first stakeholder entry
  lenses over one shared world model rather than separate widget systems
- a product whose information widgets remain collapsible, drillable, and
  traceable to human-readable and authoritative underlying surfaces
- a project whose live design law currently sits in
  `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- a project whose installer-seeded `build_tenants/odd_manager/python/` surface
  remains starter scaffold only, not the chosen control-surface carrier

The current active implementation target is:

- `build_tenants/react_vite/`
- current first supported domain contract: `odd_sdlc.query-domain`
- immediate next control-plane repricing: treat `odd_sdlc` requirement-first and
  process-first pages as one domain pack, and treat `odd_world_model` landing
  and future world-model pages as a separate domain pack selected by primary
  workspace identity
