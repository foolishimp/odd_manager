# REVIEW: W16 Developer-Control Capability Foundation

**Addresses**: `.ai-workspace/tickets/active/T-033-establish-modular-developer-control-capability-host.md`

**Status**: Ready for operator review

## Decision Surface

W16 now establishes the modular STDO-UX boundary required before capability
MVP iteration:

- one shared, runtime-validated Context and revision contract;
- one pure host reducer for registration, command correlation, subscriptions,
  stale-basis rejection, and navigation;
- separate Build Portfolio, Project Workbench, Specification Proposal, Build
  Control, Assurance and Attention, and Run Observation modules;
- one Project Workbench composition surface;
- the existing Sidecar retained as a supporting files, tickets, shells, AI
  Workspace, and Run Inspector adapter.

Project-only deep links now enter the Project Workbench. Explicit `view`
parameters still enter AI Workspace, Run Inspector, or Tickets.

## Carrier Boundary

Specification Proposal and Build Control are visibly unavailable. Neither
module can emit a constructive command. The current odd_glc data-mapper test
harness is not treated as a manager-callable Build carrier.

## Proof

- production build passed;
- Node runtime lane passed 225/225;
- Playwright lane passed 40/40;
- the live 5175 odd_glc deep link rendered in Chromium without console errors;
- desktop and 390x844 screenshots were inspected;
- mobile geometry proof rejects ledger/supporting-surface overlap;
- dependency proof rejects capability-internal cross-imports;
- late Context and subscription events fail on Project/revision mismatch;
- existing observation, file, ticket, and shell workflows remain green.

## Review Focus

Review the structural information hierarchy and capability boundaries, not
functional portfolio, proposal, build, concurrency, or assurance completion.
Those iterations remain T-034 through T-039.
