# REVIEW: W17 Build Portfolio And Project Workbench MVP

**Addresses**: `.ai-workspace/tickets/active/T-034-deliver-build-portfolio-and-project-workbench-mvp.md`

**Status**: Ready for operator review

## Decision Surface

Build Portfolio now owns the cross-Project experience. The former Sidecar
Project Browser was an early workbench and has been retired rather than copied.

The Workbench now provides:

- one dense portfolio over all registered Projects;
- explicit Project and Git revision identity;
- specification, build, assurance, runtime, participant, freshness, and
  source-attributed attention posture;
- All/Attention filtering and deterministic ordering;
- row focus without Context mutation;
- explicit Open and Remove commands;
- an integrated candidate browser with refresh, breadcrumbs, workspace
  detection, registration, and active-Project protection.

Sidecar keeps Project-local Browse, tickets, comments, shells, AI Workspace,
Run Inspector, and Recent Paths. It no longer exposes a Projects provider,
registry mutation, cross-Project picker, or parallel Project Browser.

## STDO-UX Boundary

Build Portfolio owns its State, Msg, Update, Cmd, view, and proof. Registry
browse/register/unregister/activate effects cross the shared command membrane
with command and correlation identity. The host transfers only an admitted
activation result into URL and Context state.

Opening Add Project before portfolio loading finishes is replay-safe: the
browse command resumes when the configured root is admitted. Late Project
results remain rejected.

## Honest Limits

The portfolio does not infer Build readiness or run progress from source shape.
Build remains `unavailable` without a manager-callable carrier, run remains
`unobserved` without an admitted active/recent build projection, and assurance
remains read-only/partial. Proposal and Build mutation stay outside T-034.

## Proof

- Node runtime lane: 223/223 passed;
- TypeScript: passed;
- production build: passed with the existing large-chunk warning;
- complete Playwright lane: 38/38 passed;
- exact live deep link: `http://127.0.0.1:5175/?project=%2FUsers%2Fjim%2Fsrc%2Fapps%2Fodd_glc`;
- live portfolio: four rows, zero browser console/page errors, zero Sidecar
  Projects controls;
- desktop 1600x1100 and mobile 390x844 Workbench and Add Project states were
  visually inspected;
- body width remained viewport-contained and dense table/browser overflow is
  bounded internally;
- `git diff --check` passed.

## Review Focus

Review whether the portfolio is now the correct place to discover, compare,
register, remove, and explicitly open Projects; whether the selected-Project
detail carries enough source context; and whether the Workbench/Sidecar
boundary is clean enough for W18-W21 iteration.
