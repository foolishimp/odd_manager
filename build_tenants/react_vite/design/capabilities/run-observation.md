# Run Observation Capability

**Status**: Active
**Wave**: W16 structural adapter
**Requirements**: REQ-OM-CAP-006, REQ-OM-DEV-006, REQ-OM-ASR-008
**Existing Proof**: T-031 AI Workspace, Run Inspector, Traversal, and deep-link lanes
**Implements**: `PO-OM-OBSERVE-001`; `PO-OM-DEVELOPER-001`; `PO-OM-MODULES-001`; `PO-OM-AUDIT-001`; `REQ-OM-PROJ-*`; `REQ-OM-DEV-*`; `REQ-OM-ASR-*`; `REQ-OM-CAP-*`
**Code Entrypoints**: `build_tenants/react_vite/src/capabilities/run-observation/index.ts`; `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx`; `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts`; `build_tenants/react_vite/src/server/abg-run-observation-service.mjs`; `build_tenants/react_vite/src/server/traversal-projection-service.mjs`
**Executable Proof**: `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `run observation emits navigation intent rather than performing an effect`; `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs` :: `run observation replay admits the selected Project run and section changes stay pure`; `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts` :: `run observation opens as a supporting surface and workbench focus survives return`
**STDO-UX Bindings**: State=RunObservationState plus SidecarState run, traversal, surface, and refresh slices; Msg=RunObservationMessage plus SidecarMsg observation variants; Update=updateRunObservation and reduceSidecarState; Cmd=RunObservationCommand plus SidecarCmd observation commands; Sub=declared bounded refresh and external observation subscriptions; Ingress=ABG run AI Workspace traversal surface storage and terminal validators; View=RunObservationView plus the canonical Sidecar Run Inspector; Membrane=host navigation and Sidecar observation command/subscription adapters; Replay=build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs :: run observation replay admits the selected Project run and section changes stay pure; Accessibility=build_tenants/react_vite/tests/e2e/odd-manager-accessibility.spec.ts :: forensic Run Inspector and terminal controls retain named navigation and fit at 390px
**Accepted Ontology And Design Basis**: `ONT-OM-DEVCTRL-001` and `B-OM-DEVCTRL-LOCAL-001` in the parent design; this module projects `P-CONTEXT`, `P-OBSERVATION`, `P-REPLAY`, `P-AUTHORITY`, and `P-EVIDENCE`.
**Accessibility Proof Scope**: Supporting-surface focus, Run Inspector section navigation, terminal/forensic controls, status naming, representative contrast, and 390px containment are executable.
**Implementation Acceptance**: Accepted for the manager-local read-only observation boundary subject to the exact T-032 validation bundle. The exact 4.6 qualification does not grant Build, Assure, promotion, or closure authority.

## Responsibility

Own manager observation of Project `.ai-workspace` inventory and admitted
GTL/ABG runs, including graph, traversal, functions, catalog, assets,
diagnostics, assurance, events, stages, transcripts, artifacts, proof digest,
and source refs.

It does not own build requests, process lifecycle, portfolio scheduling,
proposal state, or assurance requirements.

## Inputs

- shared Context;
- `AiWorkspaceObservation`;
- `AbgRunObservation`;
- `TraversalProjection` and lazy vector detail;
- host focus and navigation messages.
- optional read-only Build forensic focus containing execution, Run reference,
  revision, and evidence source.

## State

Wave 1 extracts current AI Workspace and traversal/run state from the Sidecar
aggregate into `RunObservationState` without changing payload meaning:

```text
RunObservationState
  aiWorkspace
  runStatus
  runObservation
  selectedRunId
  section
  traversalSummary
  selectedVector
  detailStatus
  detailCache
  error
```

## Messages

The module owns the existing run/traversal message family, renamed only when
needed to prevent collision:

```text
run-observation/load-requested
run-observation/load-succeeded
run-observation/load-failed
run-observation/run-selected
run-observation/section-selected
run-observation/vector-selected
run-observation/vector-loaded
run-observation/vector-failed
run-observation/cleared
```

## Commands

| Cmd | Existing carrier |
| --- | --- |
| `run-observation.load-ai-workspace` | AI Workspace observation API |
| `run-observation.load-run` | ABG run observation API |
| `run-observation.load-traversal` | traversal projection API |
| `run-observation.load-vector` | lazy vector detail API |
| `run-observation.open-source` | host navigation |
| `run-observation.target-shell` | admitted RuntimeTarget/session action |

## Migration Rule

The module consumes the existing contracts and server services. It does not
fork or rewrite them in W16. Sidecar viewer tabs become a presentation adapter
over the module contribution until later layout work removes the adapter.

## Proof

- existing T-031 runtime tests remain green;
- Project/run stale-result guards remain green;
- AI Workspace and Run Inspector deep links remain available;
- large event ledgers remain bounded and digest-verified;
- traversal detail remains lazy and bounded;
- module replay reproduces current run selection and vector-detail behavior;
- no Build or assurance requirement state enters this module.
- the forensic focus is rendered by the existing Run Inspector and does not
  alter run selection or manufacture a missing run carrier.
