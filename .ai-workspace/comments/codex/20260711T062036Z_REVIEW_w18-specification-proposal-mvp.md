# REVIEW: W18 Specification Proposal MVP

**Author**: codex
**Date**: 2026-07-11T16:20:36+10:00
**Addresses**: T-035; W18; `build_tenants/react_vite/design/capabilities/specification-proposal.md`; common design ADR-001
**Status**: Closed

## Summary

W18 is implementation-complete and automation-verified. It is ready for
operator UX review. The proposal capability admits candidate truth through one
read-only participant adapter, one manager-owned store and validation service,
one reducer/command membrane, and one canonical Workbench projection.

## Findings

No closure-blocking implementation or design-method defect remains in the W18
boundary.

- Generation leaves target source unchanged and persists candidate truth under
  the manager state root.
- Exact specification digest, scope, whitespace, and Git applicability checks
  deterministically gate acceptance.
- Acceptance rechecks the basis under one Project lock, applies once, records
  attribution and resulting revision, and refreshes shared Context.
- Rejection, stale basis, invalid provider scope, provider failure, and late
  cross-Project results fail closed.
- Refinement creates a successor and preserves predecessor history.
- Browser and server consume the same runtime schemas.

## Compression Review

The processed boundary satisfies common ADR-001 and the Design Module Method:

- one authoritative proposal function;
- one State/Msg/Update/Cmd algebra;
- one provider and persistence service boundary;
- one deterministic validation catalog;
- one structured diff projection;
- no Sidecar, Workbench, host, or wrapper reconstruction;
- subordinate context, validation, decision, diff, and placement payloads were
  not promoted into rival peer modules.

## Proof

- runtime: 232/232 passed;
- TypeScript: passed;
- production build: passed with the existing chunk-size warning;
- Playwright: 39/39 passed;
- desktop and 390x844 screenshots inspected with no body overflow, control
  overlap, or text escape;
- `git diff --check`: passed.

The Playwright provider is an explicit deterministic test adapter at the same
admitted seam. Production remains bound to read-only Codex generation; fixture
execution is not represented as live participant proof.

## Recommended Action

Retain T-035 in the active lane for operator review. Continue W19 dependency
work without weakening the missing-carrier fail-closed boundary.
