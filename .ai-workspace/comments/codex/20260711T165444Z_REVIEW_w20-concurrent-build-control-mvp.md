# REVIEW: W20 Concurrent Build Control MVP

**Author**: codex
**Date**: 2026-07-11T16:54:44+10:00
**Addresses**: T-037; W20; REQ-OM-BLD-003 through REQ-OM-BLD-008
**Status**: Closed

## Summary

The odd_manager-owned W20 scheduler and multi-Project projection boundary is
implementation-complete and automation-verified. It is ready for operator UX
review. Production activation remains constrained by the same missing non-test
product carriers as W19.

## Findings

No manager-boundary defect blocks review.

- Queue and active slots are explicit and bounded.
- Project, revision, request, execution, process, worksite, output, result, and
  run identities are isolated.
- Completion, failure, and cancellation update only the named execution.
- Restart keeps identities and reports unsupported attachment honestly as
  disconnected.
- Portfolio derives activity from the canonical supervisor and owns no second
  execution store.
- Focus changes and late results remain Project guarded.

## Proof

- Build service: 8/8 passed, including real two-process concurrency, FIFO queue,
  cancellation, and reconnect recovery;
- cross-Project Playwright: passed in 11.4 seconds;
- TypeScript and production build: passed;
- concurrent screenshot inspected with two occupied slots and no visual defect;
- fixture adapter is explicit and dynamic, not a static execution projection.

## External Gate

The manager can supervise any installed adapter matching the public contract.
No non-test odd_glc adapter is currently installed, so this record does not
claim the data-mapper steel thread.
