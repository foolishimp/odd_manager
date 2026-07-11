# REVIEW: W19 Single Build Control MVP

**Author**: codex
**Date**: 2026-07-11T16:48:24+10:00
**Addresses**: T-036; W19; `build_tenants/react_vite/design/capabilities/build-control.md`; common design ADR-001
**Status**: Closed

## Summary

The odd_manager-owned W19 boundary is implementation-complete and
automation-verified. It is ready for operator UX review. Live ticket closure
remains blocked by the absent odd_glc non-test carrier and adapter.

## Findings

No closure-blocking defect remains in the manager implementation boundary.

- Descriptor, product, provisioner, adapter, input, and revision admission fail
  before process start.
- The manager mints and verifies an immutable worksite; the browser cannot name
  a process plan or worksite.
- One durable supervisor owns queue/process lifecycle, output, attach,
  cancellation, and recovery posture.
- A schema-valid carrier terminal result, not exit zero, establishes execution
  convergence.
- Process outcome, carrier result, ABG Run refs, and assurance are distinct.
- Reducer and HTTP results reject stale revision and cross-Project traffic.

## Compression Review

The boundary has one descriptor loader, one provisioner registry, one adapter
registry, one supervisor/store, one State/Msg/Update/Cmd algebra, one command
interpreter, and one canonical Workbench projection. Portfolio and Assurance
must consume this downstream truth; neither may reconstruct process state.

## Proof

- direct service proof: 6/6 passed;
- Build Msg and host replay: 11/11 passed;
- focused Playwright: 2/2 passed;
- TypeScript and production build: passed;
- desktop and 390x844 screenshots inspected; no width overflow or overlap;
- admitted browser scenario exercised real convergence, output attachment, and
  cancellation while assurance remained `Not established`.

## External Gate

The fixture adapter exists only under `OMAN_BUILD_FIXTURE_MODE=1` and proves
manager lifecycle behavior. odd_glc still publishes no admitted non-test
carrier. Retain T-036 active until odd_glc T-033/T-034 and their ABIogenesis
authority gate close.
