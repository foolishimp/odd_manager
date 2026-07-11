# Project Workbench Capability

**Status**: Active
**Wave**: W16 structural shell, W17 MVP 1
**Requirements**: REQ-OM-DEV-004, REQ-OM-DEV-006, REQ-OM-DEV-007, REQ-OM-CAP-002

## Responsibility

Compose capability contributions around the selected developer goal:

```text
Review -> Tune -> Build -> Assure
```

The workbench owns framing, capability focus, and supporting drill navigation.
It owns no capability business state or process orchestration.

Build Portfolio is the Review contribution and owns the integrated Project
registry/browser. The Workbench composes it; it does not copy portfolio or
registry state. Sidecar remains a supporting Project-local tool surface.

## Inputs

- admitted shared Context and ProjectRevision;
- CapabilityContribution records;
- portfolio-selected attention/focus;
- host navigation state.

## State

```text
ProjectWorkbenchState
  contextKey
  activePhase
  activeCapabilityId
  focusedObjectRef
  supportingView
  layout
```

Layout is workbench state. Proposal, build, assurance, and run data are not.

## Messages

```text
workbench/context-changed
workbench/phase-selected
workbench/capability-selected
workbench/object-focused
workbench/supporting-view-opened
workbench/supporting-view-closed
workbench/layout-changed
```

## Commands

Only host navigation and persisted layout commands are admissible. The
workbench cannot generate proposal, build, gate, or runtime commands.

## View

- compact Project/revision identity header;
- phase navigation for Review, Tune, Build, and Assure;
- phase navigation that projects the admitted Review, Tune, Build, and Assure
  capability availability through the shared availability renderer;
- active capability workspace;
- supporting files, tickets, shells, AI Workspace, and Run Observation drills;
- explicit unavailable/unsupported capability states.

Cross-Project discovery and activation occur through the Build Portfolio
contribution. Sidecar is entered only after Context is admitted and exposes no
parallel Project Browser.

The Project-only deep link opens this view. Explicit view parameters may focus
a supporting capability without changing Context.

The identity header must not repeat an unlabeled capability `ready` state. A
bare `READY` beside Project identity is ambiguous with Project/build readiness,
especially when Build or Assurance is unavailable. Project and build posture
remain owned by Build Portfolio, Build Control, and Assurance.

### Availability Compression

The four phase controls are the compact cross-phase capability overview. Each
control projects the corresponding admitted `CapabilityContribution` through
the shared availability-state renderer:

```text
Review  <- Build Portfolio
Tune    <- Specification Proposal
Build   <- Build Control
Assure  <- Assurance and Attention
```

The active capability renders the same contribution with its full reason and
source references. Run Observation renders its availability in the supporting
contribution. The Workbench must not add a separate capability-status sidebar,
copy contribution state, or describe capability availability as Project or
phase completion. The compact phase skin renders contract `ready` as
`available`; it does not mean the Project has completed that phase.

This compression preserves one renderer and one contribution truth while
allowing compact navigation and full active-detail projections. Removing the
sidebar gives the active capability the full Workbench width on desktop and
keeps all four statuses visible in the first mobile viewport.

## Proof

- Project deep-link landing;
- phase/capability focus replay;
- phase availability projection from admitted contributions with no copied
  status state or separate sidebar ledger;
- capability contribution composition without copied state;
- unsupported capability rendering;
- open Run Observation and return without losing Project/build focus;
- responsive focus and text containment.
