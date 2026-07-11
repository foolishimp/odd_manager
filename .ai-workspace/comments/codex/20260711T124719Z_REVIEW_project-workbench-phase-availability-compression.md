# Review: Project Workbench Phase Availability Compression

Date: 2026-07-11
Scope: T-031 and T-032 integrated UX review
Change class: design reframe with projection-only realization

## Finding

Project Workbench exposed four phase controls, a separate six-row capability
status sidebar, and active capability availability. The sidebar repeated the
Workbench itself, repeated supporting Run Observation, consumed roughly one
quarter of the desktop work area, and fell below the main work on compact
layouts. The developer still had to combine those surfaces to learn which
phases were available.

This conflicted with REQ-OM-DEV-001's requirement to expose current phase,
outstanding obligation, and next lawful interaction without reconstructing
unrelated screens. It also weakened the one-truth/compression design law.

## Decision

- Use Review, Tune, Build, and Assure controls as the compact cross-phase
  capability overview.
- Project each status from the existing admitted `CapabilityContribution`.
- Reuse the shared availability-state renderer; do not create a Workbench
  status model.
- Render contract `ready` as `available` in the compact phase skin so it cannot
  be read as Project or phase completion.
- Keep full reasons and source references in the active capability.
- Keep Run Observation availability in its supporting contribution.
- Remove the separate capability-status sidebar and give the active capability
  the full Workbench width.

## Boundary

No capability State, Msg, Update, Cmd, Sub, carrier, or runtime contract
changed. Workbench receives the same contribution collection already admitted
by the host and performs a pure phase-to-contribution projection. Missing Build
and Assurance carriers remain unavailable and expose their exact reasons.

## Proof

- focused host boundary: 10/10 passed;
- focused project deep-link and mobile containment: 2/2 passed;
- first full browser run: 42 passed, 2 strict-selector failures caused by
  duplicate test-hook attributes on the shared compact child;
- corrected real-process workflow rerun: 2/2 passed;
- final runtime/replay: 266/266 passed;
- TypeScript: passed;
- production build: passed with the existing Vite large-chunk warning;
- final Playwright: 44/44 passed in 4.5 minutes;
- live Review, Tune, Build, Assure, and 390px mobile review: no overflow or
  console errors;
- `git diff --check`: passed.

## Residual

T-031 remains open for operator UX review. T-032 remains open for operator
review and the lawfully sequenced live odd_glc carrier steel thread. This
iteration does not alter that external dependency path.
