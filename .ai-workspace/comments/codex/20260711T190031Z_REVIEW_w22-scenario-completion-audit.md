# REVIEW: W22 Scenario Completion Audit

**Author**: codex
**Date**: 2026-07-11T19:00:31+10:00
**Addresses**: T-032; T-034 through T-039; W22; developer-control failure scenarios
**Status**: Closed

## Summary

The manager-owned developer-control MVP now covers the complete scenario
matrix. This audit supersedes the earlier statement that no manager-boundary
defect remained: stale proposal recovery, attention-source routing,
context-preserving forensic navigation, and external execution reconnect and
cancel semantics required additional realization.

The corrected manager boundary is automation-verified and ready for operator
review. The sprint remains open because odd_glc still publishes none of the
live product carriers required by the named data-mapper steel thread.

## Scenario Matrix

1. Concurrent work is isolated across Projects and within one Project. Request,
   execution, process, worksite, output, run, revision, and evidence identity do
   not collide.
2. Acceptance of a stale proposal fails closed. The developer can regenerate
   from the current Project revision through the same participant carrier;
   predecessor lineage is retained and the stale proposal remains explicitly
   rejectable.
3. Assurance derives F_D and F_H posture from admitted catalog and evidence
   truth. Approval, retry, and repair exist only when the product catalog
   publishes the owning command; the fixture catalog publishes no such command,
   so the manager does not invent one.
4. Recovered active executions become stale and then disconnected after the
   bounded recovery window. Reconnect preserves the execution identity and
   records actor/time; external cancellation requires adapter confirmation.
5. Proof mismatch and revision drift produce source-attributed attention. The
   source action carries Project, execution, run, revision, and evidence refs
   into the one Run Inspector and clears them on ordinary navigation.
6. Capability modules remain independently replayable and compose through the
   shared host, command membrane, Context, and projection contracts. The full
   runtime, type, build, and browser lanes remain green after the corrections.

## Proof

- runtime and replay: 263/263 passed;
- TypeScript: passed;
- production build: passed with the existing chunk-size warning;
- complete Playwright lane: 43/43 passed in 4.3 minutes;
- explicit concurrent journey: passed in 24.1 seconds;
- integrated Review/Tune/Build/Assure journey: passed in 35.1 seconds;
- desktop/mobile screenshots: visually inspected and viewport-contained;
- integrated, concurrency, proposal, and forensic captures: no near-black
  compositor regions under independent pixel checks;
- `git diff --check`: passed after evidence reconciliation.

## External Gate

The live odd_glc Project remains correctly unavailable for Build and Assurance.
It has no `.odd/build-carrier.json`, no `.odd/assurance-catalog.json`, no
digest-pinned production execution adapter, and no standard evidence bundle.
ABIogenesis promotion authority also remains external. Fixture proof is manager
conformance proof and is not represented as live odd_glc data-mapper closure.

## Live Review Surface

Production-mode smoke on the real Project passed at:

`http://127.0.0.1:5176/?project=%2FUsers%2Fjim%2Fsrc%2Fapps%2Fodd_glc`

The API is healthy on `127.0.0.1:4174`. Bootstrap admits the exact registered
odd_glc Project and current dirty revision. Build admission reports
`unavailable`, names `.odd/build-carrier.json` as the missing source, publishes
no submit command, and keeps shell fallback prohibited. The Workbench renders
that state with no page or console errors.
