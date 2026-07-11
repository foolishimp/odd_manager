# Domain Model - odd_manager

**Version**: 0.5.0
**Date**: 2026-07-11
**Status**: Active
**Derives From**:
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/requirements/02-canonical-ontology.md`
- `specification/requirements/03-read-model-and-projection.md`
- `specification/requirements/06-operator-workbench.md`
- `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`

## Purpose

This document defines the cross-domain objects that `odd_manager` coordinates,
commands, observes, and projects. It defines manager product semantics, not GTL
language law or ABG runtime law, and it does not promote one domain product's
labels into manager ontology.

## Position

`odd_manager` is a developer-facing control plane over a portfolio of selected
Projects. Its core model is:

```text
DeveloperOperator
  -> ProjectPortfolio
  -> Context(Project, Workspace)
  -> ProjectRevision
  -> ProjectWorkbench
       -> SpecificationProposal
       -> BuildRequest
            -> BuildExecution
                 -> AdmittedRun[]
                 -> GateAssessment[]
                 -> AssetDelivery[]
                 -> AttentionItem[]
       -> RunObservation
```

The manager owns portfolio coordination, command admission, bounded queue and
external process lifecycle, correlation, operator decisions, and projections.
A Build Request invokes only a published semantic carrier. GTL owns that
carrier's declared program and ABG owns traversal, continuation, runtime event
truth, evidence admission, and closure.

The current reference evidence is the `odd_glc` data-mapper run family. That
reference proves the generic model; it does not create an `odd_glc`-specific
manager lane.

Historical Process Navigator and `odd_sdlc.query-domain` carriers are retired
pre-release material. They do not define a live compatibility contract.

## Core Control And Observation Contract

Across Projects, the manager may coordinate:

- registered Project selection and portfolio attention
- immutable source/specification revision identity
- attributable specification proposals and explicit acceptance or rejection
- typed build requests over published semantic carriers
- bounded build queue, concurrency, and external process lifecycle
- correlation between manager commands, build executions, and ABG-owned runs
- explicit operator decisions, cancellation, retry requests, and lawful
  constitutional re-entry

The manager does not infer or author graph traversal, runtime continuation,
evidence admission, or closure policy while coordinating that work.

Across Projects, the manager may observe:

- published product identity and separately published governance packages
- Project-owned `.ai-workspace` features and artifacts
- run carrier roots, timestamped run roots, and generated run workspaces
- proof and identity carriers that admit a run
- graph, graph-function, overlay, and startup references
- runs, graph calls, frames, traversal vectors, retries, and continuations
- payload, evidence, witness, assurance, and terminal facts
- event-kind counts, bounded event rows, and digest-pinned event ledgers
- materialized assets and the vector/stage that produced them
- test execution, requirement lineage, depth proof, and mutation outcomes
- bounded transcripts, process traces, and source artifact references
- product/domain overlays that add labels without redefining runtime truth
- specification readiness and proposal posture
- build requests, queue/process lifecycle, correlation, and freshness
- published gate requirements and evidence-backed gate assessments
- required and delivered asset relations
- attention conditions and their bounded lawful reactions

Missing features are lawful. They are represented as missing, incomplete,
unsupported, or error states at the relevant lens while the Project remains
browseable.

## Core Objects

### DeveloperOperator

The first primary actor: a developer who manages multiple governed software
Projects, reviews and proposes specification change, submits admitted semantic
builds, supervises execution, and assesses gate/asset delivery.

### ProjectPortfolio

The manager-owned bounded projection over registered Projects. It carries
published identity, selected revision, specification readiness, build/run
posture, gate and asset posture, freshness, participants, and attention. It
does not consolidate Project-owned truth into a new central authority.

### Project

A filesystem and version-control root selected by the operator. The Project is
the ownership boundary for source, specification, `.ai-workspace`, build
outputs, observation, commands, and shells.

### Context

The operational binding of one Project and one admitted Workspace/domain lens.
Context determines available domain semantics and capability contributions. It
does not replace Project identity or source revision identity.

### ProjectRevision

The admitted immutable source and specification basis for a proposal, build,
run correlation, gate assessment, or asset-delivery claim. Commit, worktree,
dirty-state, and snapshot posture remain explicit.

### ManagerCapability

An independently evolvable manager capability with declared product inputs,
actions, projections, availability states, STDO-UX interaction algebra, and
proof. Manager capabilities share Context and product contracts but do not read
or mutate one another's internal state.

The initial capability family is:

- Build Portfolio
- Project Workbench
- Specification Proposal
- Build Control
- Assurance and Attention
- Run Observation

### ProjectWorkbench

The thin composition surface for one selected Project and its developer goal.
It arranges capability contributions around `Review -> Tune -> Build -> Assure`
without becoming their semantic owner or orchestration engine.

### PublishedIdentity

The primary product identity read from published product or install carriers.
Governance-package identities are separate attributes. Repository basename and
hard-coded product lists are not identity authority.

### ProjectObservationTopology

The bounded relation between one Project and its observable carriers:

```text
ProjectObservationTopology
  = PublishedIdentity
  + ProjectAiWorkspaceRoot
  + RunCarrierRoot[]
  + AdmittedRun[]
  + Diagnostic[]
```

A run workspace below a timestamped run root remains part of the owning
Project. It is not a second Project merely because it can host a shell.

### AdmittedRun

A run discovered from a bounded proof or identity carrier. It records run id,
run root, workspace root, scenario identity, proof class, graph-function ref,
status, event count, and source artifacts.

### Run

One engine-owned execution attempt. The manager observes run state and does not
advance it.

### GraphCall

One engine-owned invocation of a published graph-function boundary.

### Frame

The engine-owned invocation context in which traversal vectors are evaluated.
Frame lineage is shown only when published; absence is explicit.

### TraversalVector

One observed vector evaluation within a frame, including edge, attempt,
assessment, stage plan, evidence, and source artifact where available.

### Continuation

Engine-owned state describing lawful re-entry or termination after an
evaluation. The manager projects continuation facts but never chooses them.

### EventCarrier

A source-attributed event sequence or event ledger. Large ledgers are never
sent whole to the browser. The manager exposes complete published kind counts,
bounded high-signal rows, file metadata, and SHA-256 verification against the
proof-declared digest. Unknown event kinds remain visible.

### ProofCarrier

A bounded artifact that admits run identity, runtime refs, event counts,
event-ledger digest, substrate version, and assurance facts.

### Asset

A materialized output observed with path, producer vector, producer stage,
target type, content digest, and source artifact.

### Assurance

A projection over admitted evidence, payload validation, requirement lineage,
test reports, depth proof, and mutation outcomes. Assurance is source-linked;
it is not inferred from visual state.

### DomainOverlay

Product-owned meaning layered over admitted core truth. An overlay may label
graphs, stages, assets, scenarios, or readiness. It must not redefine run,
graph-call, frame, traversal, evidence, continuation, or event truth.

### AbgRunObservation

The manager-owned typed projection over one admitted run. It independently
exposes:

- overview
- graph
- traversal
- functions
- assets
- diagnostics
- assurance
- events
- stages
- transcripts
- artifacts

The projection is bounded, versioned, source-attributed, and runtime-validated
before reducer admission.

### RuntimeTarget

An admitted run workspace directory that may be used as the working directory
for a Project-owned local shell. Runtime targeting changes shell location; it
does not change Project identity.

### SpecificationProposal

An attributable candidate change against named specification authority. It
records Project, basis revision, attached context, participant, proposed diff,
validation results, affected surfaces, and acceptance or rejection. Proposal
generation does not mutate constitutional truth.

### BuildRequest

A manager-admitted command to execute a published Job, GraphFunction,
workorder, or equivalent domain carrier against one Context and
ProjectRevision. It records request identity, carrier reference, inputs,
requester, resource posture, policy basis, and correlation identity. It is not
an opaque shell command and contains no manager-authored graph policy.

### BuildExecution

The manager-owned lifecycle record produced from one BuildRequest. It covers
queue and external process state and may be:

- queued
- starting
- running
- waiting_human
- converged
- failed
- cancelled
- stale
- disconnected

A BuildExecution correlates to zero or more engine-owned Runs. It does not
replace run or event truth.

### BuildPortfolio

The bounded projection over active and recent BuildRequests and
BuildExecutions across registered Projects, including concurrency, resource,
freshness, participant, correlation, and attention posture.

### CommandCorrelation

The stable identity relation connecting operator intent, typed command,
external process lifecycle, emitted runtime identity, resulting evidence, and
the ProjectRevision on which the action was based.

### GateRequirement

A product- or domain-published condition required for one named build outcome.
The manager observes and groups this meaning but does not invent it.

### GateAssessment

The source-attributed relation between one GateRequirement and one
ProjectRevision/BuildExecution. Its posture is required, satisfied, failed,
missing, stale, unsupported, or waiting for human authority. A satisfied state
requires admitted evidence.

### AssetDelivery

The source-attributed relation between one required or expected asset and its
materialized artifact, producer, ProjectRevision, content digest, freshness,
and evidence.

### AttentionItem

A manager projection of a condition requiring developer awareness or action.
It records source, severity, affected Project and BuildExecution, reason,
freshness, and bounded lawful reactions. It may route repair, cancellation,
retry request, approval, escalation, or constitutional re-entry; it never
silently performs them.

## Ownership Rules

### GTL-Owned

- typed graph nodes and edges
- graph structure and graph functions
- published callable carriers, jobs, roles, and declared input/output contracts

### ABG-Owned

- runs, graph calls, frames, traversal, retries, and continuations
- event emission, admission, ordering, and replay
- payload, evidence, witness, fold, residual, and terminal truth
- runtime lineage and provenance

### Product-Owned

- primary product identity
- scenario and proof meaning
- domain overlays
- product-specific requirement, test, depth, mutation, and artifact meaning
- published build carriers and their domain inputs
- required gate and asset semantics
- specification validation and acceptance semantics where product-specific

### DeveloperOperator-Owned

- proposal acceptance or rejection where human authority is required
- explicit build submission, cancellation, approval, escalation, and re-entry
  decisions within admitted policy
- portfolio focus and prioritization

### odd_manager-Owned

- Project registry and selected Project context
- Project Portfolio and Build Portfolio projections
- admitted ProjectRevision and command-correlation identity
- specification-proposal workflow and attribution, but not unreviewed
  constitutional mutation
- BuildRequest admission against a published carrier
- bounded queue, concurrency, and external process lifecycle
- correlation of BuildExecution to ABG-owned Runs
- bounded run discovery and observation topology
- typed read projections and runtime validation
- operator grouping, drill-down, refresh, shell targeting, and attention routing
- explicit submission of attributable operator decisions through admitted
  command boundaries
- honest missing, incomplete, unsupported, mismatch, and error states
- source-reference preservation

## Publishing Rules

1. Core GTL/ABG truth remains stable across product overlays.
2. Identity comes from published carriers, not path labels.
3. Run discovery remains bounded and Project-scoped.
4. No run projection is admitted without proof or identity evidence.
5. No event digest is shown as verified until the observed carrier matches it.
6. Unknown event kinds are surfaced, never silently discarded.
7. Domain overlays extend core truth without replacing it.
8. Large carriers produce bounded projections rather than browser payloads.
9. Every operational row keeps a source reference where one is published.
10. Every BuildRequest names Project, ProjectRevision, published semantic
    carrier, requester, and correlation identity.
11. The manager may schedule and supervise admitted external process lifecycle;
    it does not choose graph traversal, continuation, evidence admission, or
    runtime closure.
12. Specification generation produces a proposal. Constitutional truth changes
    only through explicit validated acceptance.
13. Process exit, rendered UI state, or unstructured log text cannot establish
    gate satisfaction or asset delivery without admitted evidence.
14. Manager capabilities compose through shared Context, typed contracts,
    commands, events, navigation, and evidence; they do not mutate one another's
    internal state.
15. The Project Workbench composes capability meaning but does not become a
    hidden constructive carrier or orchestration engine.
