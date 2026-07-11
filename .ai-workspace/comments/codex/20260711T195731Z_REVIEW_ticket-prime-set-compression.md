# REVIEW: Ticket Prime-Set Compression

**Author**: codex
**Date**: 2026-07-11T19:57:31+10:00
**Addresses**: T-031; T-032; active and backlog ticket lanes
**Status**: Closed

## Finding

The ticket board had 10 active and 3 backlog records. That live set mixed four
different classes:

- current product owners;
- completed manager capability iterations awaiting redundant review;
- repeated copies of one live odd_glc external carrier gate;
- targets tied to the retired odd_sdlc Process Navigator, Project selector, or
  an unadmitted richer PDF.js adapter.

This obscured the actual current work and made completed implementation look
unfinished.

## Decision

Keep two active prime tickets:

| Ticket | Prime responsibility | Remaining truth |
| --- | --- | --- |
| T-031 | Observation, Run Inspector, AI Workspace, navigator/viewer UX | Implementation proof is complete; integrated UX remains under operator review |
| T-032 | Multi-Project developer control and live product steel thread | Manager MVP is complete; odd_glc carrier/evidence publication and ABIogenesis F_H promotion remain external gates |

The backlog is empty. New deferred work must re-enter against current product,
requirement, and design authority rather than inherit a stale carrier.

## Transitions

Accepted completed slices:

- T-034 Build Portfolio and Project Workbench;
- T-035 Specification Proposal;
- T-037 concurrent Build Control;
- B-076 context-switch correction and B-078 Project Browser cleanup as
  historical implementations before the T-034 ownership move.

Completed with an external residual merged into T-032:

- T-036 single Build Control;
- T-038 Assurance and Attention;
- T-039 integrated developer-control steel thread.

The manager-owned closure evidence remains on those records. Their missing
live odd_glc carrier, adapter, catalog, evidence, and promotion facts are not
closed; they now have one owner in T-032.

Completed by supersession:

- B-069: current product truth is the one browser-native, same-origin PDF
  adapter; PDF.js page-state controls require fresh design intake;
- T-027: its TracedCalloutEvidence carrier belonged to the retired process
  projection; T-031 owns current generic run observation;
- T-028: odd_sdlc install health and the legacy selector are retired; T-034
  established generic Build Portfolio readiness and capability availability.

One historical metadata defect was also normalized: T-010 was already in the
completed lane but still declared `status: active`; its retired standalone
Project Agent/Sidecar selector target is superseded by T-034 and the shared
capability Context.

## Result

```text
before: active 10, backlog 3
after:  active 2,  backlog 0
history: 11 records moved to completed, 1 hidden status normalized, 0 deleted
```

The active sprint now names T-031 and T-032 as the prime set and carries the
live odd_glc closure gate once.

## Verification Basis

- runtime and replay: 263/263 passed;
- TypeScript: passed;
- production build: passed with the existing chunk-size warning;
- Playwright: 44/44 passed in 4.4 minutes;
- `git diff --check`: passed before this metadata-only compression;
- ticket lane and metadata checks are rerun after transition.
