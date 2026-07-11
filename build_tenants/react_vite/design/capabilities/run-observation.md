# Run Observation Capability

**Status**: Active
**Wave**: W16 structural adapter
**Requirements**: REQ-OM-CAP-006, REQ-OM-DEV-006, REQ-OM-ASR-008
**Existing Proof**: T-031 AI Workspace, Run Inspector, Traversal, and deep-link lanes

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
