# Review: Prime Active First-Use UX Iteration

Date: 2026-07-11
Scope: T-031 and T-032 integrated review
Change class: design reframe with tenant-local realization

## Findings

1. Project Workbench repeated capability availability as a bare `READY` beside
   Project identity. This was ambiguous when Build or Assurance were
   unsupported and duplicated the capability-status ledger.
2. A fresh Sidecar profile opened a large terminal dock. It displaced the
   primary viewer before the developer had chosen a terminal interaction,
   especially on mobile.
3. Ticket lane folders displayed zero until expanded even when canonical ticket
   records were loaded. The navigator therefore hid the Active, Backlog, and
   Completed posture it is intended to summarize.
4. `PRODUCT.md` retained a stale posture statement that described the delivered
   Portfolio, Workbench, Proposal, Build, concurrency, and Assurance modules as
   unimplemented.
5. The live odd_glc carrier residual cannot lawfully be implemented from
   odd_manager now. ABIogenesis `GOAL-035` places it after DS-1 through DS-5;
   T-223 is the current executable leaf and odd_glc T-033/T-038 own DS-6.

## Decision

- Keep Project identity free of capability status. The one capability ledger
  owns availability and unsupported reasons.
- Start fresh/reset profiles with the terminal collapsed. Preserve explicit
  saved expansion and open the dock for terminal commands.
- Derive ticket lane counts from canonical `TicketRecord.lane`; retain the
  shared filesystem navigator for expansion and the one ticket viewer for
  rendering.
- State Project Workbench as the Project-only deep-link target. Keep AI
  Workspace and Run Inspector as explicit supporting carriers.
- Keep the manager fail closed until the upstream installed carrier, adapter,
  assurance catalog/evidence, and F_H-capable product truth exist.

## Realization

- Reconciled current product posture in `specification/PRODUCT.md`.
- Updated Project Workbench and Sidecar widget design law.
- Removed duplicate Workbench readiness from the identity header.
- Changed fresh/reset terminal posture to collapsed without overriding saved
  profile intent.
- Added canonical Active, Backlog, and Completed lane-count projection.
- Added runtime, source-boundary, and Playwright assertions for the new law.

## Final Proof

- focused runtime/replay: 91/91 passed;
- full runtime/replay: 266 tests, 262 passed, 4 environment-dependent screen
  tests skipped, 0 failed;
- TypeScript: passed;
- production build: passed with the existing Vite chunk warning;
- focused Playwright: 12/12 passed;
- full Playwright: 44/44 passed in 4.4 minutes;
- live desktop/mobile probes: correct lane counts, terminal collapsed, no
  duplicate Workbench readiness, contained mobile width, and no console errors;
- `git diff --check`: passed.

The local first-use iteration is complete. T-031 remains open for operator UX
review. T-032 remains open for operator review and its lawfully sequenced live
odd_glc carrier steel thread.
