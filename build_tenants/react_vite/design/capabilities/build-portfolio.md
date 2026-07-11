# Build Portfolio Capability

**Status**: Active
**Wave**: W16 structural shell, W17 MVP 1
**Requirements**: REQ-OM-DEV-001 through REQ-OM-DEV-003, REQ-OM-DEV-005, REQ-OM-DEV-008

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
