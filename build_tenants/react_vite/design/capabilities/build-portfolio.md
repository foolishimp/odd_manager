# Build Portfolio Capability

**Status**: Active
**Wave**: W16 structural shell, W17 MVP 1
**Requirements**: REQ-OM-DEV-001 through REQ-OM-DEV-003, REQ-OM-DEV-005, REQ-OM-DEV-008
**Implements**: `PO-OM-DEVELOPER-001`; `PO-OM-MODULES-001`; `REQ-OM-DEV-*`; `REQ-OM-CAP-*`
**Code Entrypoints**: `build_tenants/react_vite/src/capabilities/build-portfolio/index.ts`; `build_tenants/react_vite/src/effects/command-runtime/build-portfolio-command-runtime.ts`; `build_tenants/react_vite/src/server/project-asset-surface-service.mjs`; `build_tenants/react_vite/src/server/developer-control-bootstrap-service.mjs`
**Executable Proof**: `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `Build Portfolio loads multiple Projects without changing Context and rejects late results`; `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `Build Portfolio browser and registry actions remain explicit correlated commands`; `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts` :: `Build Portfolio refreshes, registers, inspects, and removes a discovered Project`
**STDO-UX Bindings**: State=BuildPortfolioState; Msg=BuildPortfolioMessage; Update=updateBuildPortfolio; Cmd=BuildPortfolioCommand; Sub=BuildPortfolioSubscription; Ingress=portfolio and Project schemas in developer-control-contracts plus bootstrap admission; View=BuildPortfolioView; Membrane=build-portfolio-command-runtime and project-asset-surface-service; Replay=build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: Build Portfolio loads multiple Projects without changing Context and rejects late results; Accessibility=build_tenants/react_vite/tests/e2e/odd-manager-accessibility.spec.ts :: developer control and workbench tabs provide keyboard parity and named panels
**Accepted Ontology And Design Basis**: `ONT-OM-DEVCTRL-001` and `B-OM-DEVCTRL-LOCAL-001` in the parent design; this module projects `P-CONTEXT`, `P-OWNERSHIP`, `P-COMMAND`, `P-SUBSCRIPTION`, and `P-FAIL-CLOSED`.
**Accessibility Proof Scope**: The public Review contribution, portfolio controls, focus handoff, named status, representative contrast, and responsive containment are exercised by the accepted parent proof bundle.
**Implementation Acceptance**: Accepted for the manager-local portfolio module subject to the exact T-032 validation bundle. Structural availability remains distinct from any external Build outcome.

## Responsibility

Own the developer's cross-Project review surface: registered-Project discovery,
registration, removal, explicit Project activation, revision/readiness posture,
active/recent build posture, assurance, freshness, participants, and
source-attributed attention. Observing or selecting a portfolio row does not
change active Context; only the explicit Open command does.

The former Sidecar Project Browser was an early workbench. W17 retires that
surface and migrates its cross-Project purpose here. Sidecar Browse remains
Project-local and does not mutate the Project registry.

## Inputs

- manager-maintained registered Project collection;
- configured candidate-browse root and typed filesystem entries;
- published Project identity;
- admitted ProjectRevision observation;
- BuildExecution summaries;
- gate/asset assurance summaries;
- AttentionItem summaries;
- capability availability.

## State

```text
BuildPortfolioState
  status
  contextProjectRoot
  portfolio
  scope
  sort
  selectedProjectId
  browser
  pendingCommands
  commandSequence
  activatedProjectRoot
  error
  actionError
```

Each row retains Project and revision identity. Cross-Project values are
summaries with source refs, not copied Project truth.

## Messages

```text
portfolio/context-changed
portfolio/refresh-requested
portfolio/poll-ticked
portfolio/load-succeeded
portfolio/scope-selected
portfolio/sort-selected
portfolio/project-selected
portfolio/project-activate-requested
portfolio/project-activated
portfolio/project-activation-consumed
portfolio/attention-open-requested
portfolio/attention-opened
portfolio/attention-focus-consumed
portfolio/project-unregister-requested
portfolio/project-unregistered
portfolio/browser-toggled
portfolio/browser-navigate-requested
portfolio/browser-loaded
portfolio/project-register-requested
portfolio/project-registered
portfolio/command-failed
```

## Commands And Subscriptions

| Cmd/Sub | Success | Failure |
| --- | --- | --- |
| `portfolio.load` | `portfolio/load-succeeded` | `portfolio/command-failed` |
| `portfolio.browse` | `portfolio/browser-loaded` | `portfolio/command-failed` |
| `portfolio.register` | `portfolio/project-registered` | `portfolio/command-failed` |
| `portfolio.unregister` | `portfolio/project-unregistered` | `portfolio/command-failed` |
| `portfolio.activate` | `portfolio/project-activated` | `portfolio/command-failed` |
| `portfolio.open-attention` | `portfolio/attention-opened` | `portfolio/command-failed` |

`portfolio.poll` is the declarative subscription while any projected row has a
queued or running Build Execution. Its timer event dispatches
`portfolio/poll-ticked`; that message emits the correlated `portfolio.load`
command named above only when no Portfolio load is already pending. The
aggregate admits the exact declared subscription before the React timer adapter
may interpret it. Adapter installation or tick failure dispatches typed
`aggregate/subscription-failed`; the aggregate accepts that failure only for
the still-declared subscription identity and retains it as replayable host
state. The adapter therefore supplies no independent lifecycle or failure
authority.

Portfolio admission requires unique Project IDs and roots, at most one active
row, globally unique attention identities, and build-activity latest-state
counts coherent with the projected row. Assurance-derived identities retain an
injective, labeled, UTF-16-length-framed Project/execution/kind/source tuple
with a distinct no-execution form. Two Projects may therefore publish
delimiter-bearing or identical catalog identities, and one catalog may use the
same source string across kinds, without collapsing distinct conditions. A
refresh requested while a load is in flight is retained as one queued
continuation. The older load is retired without installation and a fresh
correlated load runs, including after register or unregister succeeds. In
contrast, periodic `portfolio.poll` ticks
coalesce while that same load is pending; timer cadence cannot perpetually
occupy the continuation slot or prevent a coherent snapshot from reaching
`ready`.

Build and Assurance observers are part of the `portfolio.load` effect, not
optional evidence hints. If either observer throws, the portfolio projection
aborts and the existing command membrane returns `portfolio/command-failed`.
The service must not translate an observer exception into unavailable Build,
zero Build activity, partial Assurance, or absent Attention because each would
manufacture an ordinary posture from failed observation.

Each returned observer carrier is runtime-schema-admitted and then bound to the
row before projection. Build snapshot, descriptor admission, request, and
execution Project roots must name the row Project; snapshot, request, and
execution revisions must equal the row `ProjectRevision`; and every execution
must retain its admitted request/correlation identity. Assurance snapshot,
catalog admission, selected execution, gate assessment, asset delivery, and
Attention Item must name that same Project, revision, and the exact latest
execution selected from the admitted Build snapshot. Every execution-bound
Assurance Attention Item must also carry the selected execution's exact
correlation identity; a Project-level item with no selected execution must
carry the derived `project:<project-id>:assurance` correlation. The portfolio
attention summary preserves that admitted correlation instead of replacing or
dropping it. Any mismatch aborts the whole row observation explicitly. No
foreign state, Run ref, assurance posture, or attention summary is projected
as an ordinary row value.

`portfolio.open-attention` activates the source Project through the registry,
then publishes a typed capability focus for the host. Build execution and
assurance item selection still occur through the owning capability messages.
The capability has no build-submit, proposal-write, or assurance-close command.

## View

A dense, bounded Project table is the primary view. It presents identity,
revision, specification, build, assurance, runtime, freshness, participant,
and attention posture with filtering and source drilldown. The integrated Add
Project browser admits only workspace-marked directories. Remove is unavailable
for the active Project. The view is not a card-based marketing surface.

Attention actions name the admitted destination rather than using a generic
`Open source` label:

```text
revision | specification       -> Open Tune
build-carrier | build-execution -> Open Build
other admitted source kinds     -> Open Assure
```

One total attention-target selector owns both the capability ID carried by
`portfolio.open-attention` and the action label projected by the view. The view
must not maintain a second source-kind routing table. Unknown future source
kinds route to Assurance, where unsupported or unrecognized evidence remains
visible and cannot create a positive closure claim.

When a revision or specification target reaches Tune after the target Project
Context is admitted, the host forwards the same attention `sourceRef` through
`proposal/context-attached`. Build Portfolio does not import or mutate proposal
state; Specification Proposal remains the sole owner of attachment admission.

## Availability

- W16: structural shell only;
- W17: multi-Project projection, integrated registry browser, explicit
  activation/removal, and Project Workbench navigation; unavailable build/run
  sources remain explicit;
- later build/assurance MVPs enrich rows through shared product events.

## Proof

- multiple Project projection without active-context mutation;
- registry browse, refresh, register, remove, and explicit activation;
- Add Project opened during portfolio load resumes after browse-root admission;
- missing capability state;
- stale Project row;
- schema-valid foreign or mismatched Build and Assurance observations abort
  before row projection;
- Project switch and late-result rejection;
- attention drilldown preserves Project/build correlation;
- attention action text and reducer route derive from one total source-kind
  selector;
- narrow and desktop table containment.

## Ownership Invariants

- Build Portfolio is the only developer-control capability that mutates the
  Project registry.
- A row click changes portfolio focus only. `portfolio.activate` is required to
  change Context.
- Registry mutation and activation cross the shared command membrane and carry
  command/correlation identity.
- Sidecar exposes no Projects provider, Project Browser view, registry command,
  or cross-Project filesystem picker.
