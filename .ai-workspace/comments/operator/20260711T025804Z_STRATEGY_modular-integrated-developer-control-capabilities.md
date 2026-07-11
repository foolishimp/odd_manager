# STRATEGY: Modular Integrated Developer Control Capabilities

**Author**: operator
**Recorded By**: codex
**Date**: 2026-07-11T02:58:04Z
**Addresses**: T-032; SPRINT-2026-07-10 W15-W22; developer build-control UX design
**Status**: Open

## Summary

The developer control experience must be modular and integrated across clean,
typed boundaries. Modularity exists to let each major capability iterate at
its own pace. Integration exists to preserve one Project context, one operator
intent surface, one command/effect membrane, and one source-attributed world
model.

The first implementation wave is structural. It establishes capability
boundaries, contracts, composition, STDO-UX state transitions, and executable
boundary proof. It does not claim the complete developer workflow as an MVP.
Subsequent MVP iterations add useful vertical behavior within one capability at
a time without reopening the whole workbench.

This post records target direction. It becomes design law only when adopted by
ratified product, requirement, and design surfaces.

## Owner Direction

The design must satisfy four constraints:

1. Major capabilities are modules with explicit ownership and contracts.
2. The modules compose into one coherent developer interaction loop.
3. Every UX capability follows STDO-UX State, Msg, Update, Cmd, Sub, ingress
   validation, effect-membrane, and replay rules.
4. The first wave establishes structure and clean boundaries for later MVP
   iterations rather than filling one large component with premature behavior.

## Current Reality

The existing Sidecar proves useful shared workbench concepts: selected Project
context, viewer composition, terminal composition, URL/deep-link state, typed
contracts, and reducer-owned interaction state.

It also shows the next structural constraint:

- `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx` currently
  carries approximately 5,637 lines;
- `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts` currently
  carries approximately 2,414 lines;
- Project navigation, AI Workspace, Run Inspector, traversal, tickets, files,
  shells, and their interaction plumbing converge through those surfaces.

Adding portfolio, specification proposal, build control, assurance, and
attention behavior directly to that center would make each iteration depend on
the whole workbench. The current capabilities should be preserved, but the new
wave needs a capability composition boundary before adding product-changing
actions.

## Design Position

### Modularity

A capability module is an independently evolvable product slice with:

- one named responsibility and owner;
- declared product contracts and required feature inputs;
- runtime validation at every external seam;
- module-owned State and Msg algebra;
- pure Update and declared Cmd/Sub algebra;
- a view projected from admitted state;
- explicit commands for product-truth changes;
- module-level replay, contract, and accessibility proof;
- explicit loading, missing, unsupported, stale, error, and ready states.

Modularity does not mean separate applications, micro-frontends, duplicated
stores, or isolated tabs. A tab is presentation. A module is an ownership and
contract boundary.

### Integration

The modules integrate through stable shared boundaries:

- Project identity, revision, and active Context;
- selection, navigation, and deep-link commands;
- operator and participant identity;
- typed proposal, build, runtime, gate, asset, and attention carriers;
- one command/effect interpreter;
- one source-reference and evidence vocabulary;
- shared visual primitives and accessibility behavior;
- explicit cross-capability messages where one accepted outcome changes
  another capability's projection.

No capability may write another capability's internal state, call another
view, or infer product truth from another module's rendered state. Integration
occurs through admitted product events, shared contracts, and host composition.

## Capability Map

| Capability | Owns | Consumes | Must not own |
| --- | --- | --- | --- |
| Build Portfolio | Cross-Project readiness, active-build summary, queue and attention projection | Project registry, revision identity, build/run/gate summaries | Project internals, ABG continuation, capability-local editing state |
| Project Workbench | Goal-oriented composition of Review, Tune, Build, and Assure | Active Context and registered capability contributions | A second copy of capability state or hidden orchestration logic |
| Specification Proposal | Context attachment, prompt interaction, proposal identity, validation, diff, accept/reject | Specification authority, participant/session carrier, validation commands | Direct unreviewed mutation of constitutional truth |
| Build Control | BuildRequest admission, queue/process lifecycle, correlation, attach/cancel and governed retry requests | Published Job/GraphFunction or equivalent carrier, Project revision, ABG run identity | Graph traversal, continuation, evidence admission, or closure policy |
| Assurance And Attention | Required-versus-delivered gates/assets, evidence drilldown, residuals and bounded reactions | Requirement lineage, run proof, gate/asset carriers, policy posture | Invented green status or silent automatic repair |
| Run Observation | Deep graph, traversal, event, transcript, artifact and proof inspection | Admitted ABG/GTL Project/run truth | Portfolio scheduling or build-command authority |

The Project Workbench is the composition surface. It should remain thin. It
binds capability contributions around the developer goal but does not absorb
their reducers, commands, services, or domain logic.

## STDO-UX Composition Law

Each capability publishes its UX algebra:

```text
Capability = State + Msg + Update + Cmd + Sub + View + Ingress + Proof
```

The workbench host composes those algebras:

```text
AppState
  = SharedContext
  + PortfolioState
  + ProjectWorkbenchState
  + SpecificationProposalState
  + BuildControlState
  + AssuranceAttentionState
  + RunObservationState
```

Composition rules:

1. A module's Update is pure and receives only its declared State and Msg.
2. Product-truth-changing Msgs produce typed Cmd values against admitted
   product carriers.
3. One host effect membrane interprets commands and returns typed success or
   failure Msgs to the owning module.
4. Shared Context changes are explicit host messages. Modules react through
   declared context-change messages, not ambient reads.
5. External payloads are runtime-validated before module state admission.
6. Module replay proves local interaction. Integration replay proves Context,
   command, and cross-capability event flow.
7. If a constructive carrier is missing, the action is unavailable with an
   explicit reason. The view cannot synthesize the missing behavior.

The concrete composition mechanism remains a design decision. It may use
composed reducers, a capability registry, or another TEA-preserving form. The
law is explicit ownership and message flow, not a particular framework API.

## Wave 1: Structural Foundation

The first wave should deliver structure with one read-only integration proof.

Deliverables:

1. Ratified capability map and dependency direction.
2. Shared contract package for Context, navigation, command correlation,
   source references, capability status, and host contribution metadata.
3. Capability registration and composition boundary in the workbench host.
4. Per-capability directories and design modules declaring State, Msg, Update,
   Cmd, Sub, ingress, view, and proof ownership.
5. A single host command/effect membrane with typed routing back to the owning
   module.
6. Shared deep-link and active-Project propagation across all registered
   capability skeletons.
7. Explicit capability availability states: unavailable, loading, ready,
   stale, unsupported, and error.
8. Existing AI Workspace and Run Inspector admitted through the same
   capability-host boundary without changing their runtime semantics.
9. A Project Workbench shell that composes capability summaries and opens
   existing observation drills.
10. Module-level replay fixtures plus an integration replay proving Project
    context change, command correlation, stale-result rejection, and focus.
11. Import/dependency tests that prevent capability-to-capability internal
    coupling and a new central component from replacing `SidecarPanel`.

Wave 1 does not need working specification mutation, build submission,
concurrency, or gate closure. Controls for carriers that do not yet exist stay
absent or explicitly unavailable.

### Wave 1 Closure

Wave 1 closes when:

- each major capability has a ratified module boundary and executable shell;
- the Project Workbench composes modules without owning their internal state;
- module dependencies point through shared contracts and host ports;
- product-truth actions cannot bypass typed commands;
- current Project deep links and run observation still work through the new
  composition structure;
- replay and dependency tests demonstrate the boundaries;
- no claim is made that structural availability equals functional MVP
  completion.

## Subsequent MVP Iterations

Each MVP is a vertical increment inside one capability boundary:

| Iteration | Primary capability | User-visible outcome |
| --- | --- | --- |
| MVP 1 | Build Portfolio and Project Workbench | Developer can see and prioritize multiple Projects from one accurate portfolio |
| MVP 2 | Specification Proposal | Developer can prompt one scoped proposal, validate it, and accept or reject its diff |
| MVP 3 | Build Control | Developer can submit and supervise one typed build against a pinned Project revision |
| MVP 4 | Build Control plus Portfolio | Developer can run and distinguish multiple concurrent Project builds |
| MVP 5 | Assurance And Attention | Developer can verify required gates/assets and take a lawful reaction from an evidence-backed attention item |
| Integration MVP | All capabilities | Developer completes the odd_glc data-mapper Review -> Tune -> Build -> Assure steel thread |

An MVP may refine its module contract when evidence requires it, but it must not
reach into another module to make local progress. Cross-capability needs re-enter
through the shared contract or host-composition design.

## Design Failure Conditions

The design has failed if:

- new capability behavior continues accumulating in `SidecarPanel.tsx` or one
  replacement monolith;
- modules are only folders while sharing mutable state and direct service
  calls;
- each capability creates its own Project, build, evidence, or participant
  identity;
- cross-module callbacks form an implicit orchestration graph;
- the workbench host owns capability-specific business rules;
- STDO-UX commands are replaced by effect handlers that choose continuation;
- the structural wave is declared an MVP despite carrying no useful vertical
  capability;
- an MVP bypasses the structural boundary to ship faster.

## Recommended Action

Adopt this direction during T-032 W15 as the capability and STDO-UX design
boundary. Reprice the sprint so W16 is the structural foundation wave and later
workstreams are explicit capability MVP iterations. Give each major capability
its own design module, downstream ticket, implementation boundary, and proof
surface before parallel implementation begins.
