# SPRINT-2026-05-13 Sidecar Project Context

- id: SPRINT-2026-05-13-sidecar-project-context
- title: Repair Sidecar project context and browser root fidelity
- status: open
- goal: realize-ai-workspace-topology-and-agent-interoperability
- opened_at: 2026-05-13T09:04:20+10:00
- updated_at: 2026-05-13T09:18:20+10:00

## Authority

- specification/PRODUCT.md
- specification/requirements/04-orientation-and-navigation.md
- specification/requirements/10-entry-lenses-and-delivery-workspaces.md
- build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
- .ai-workspace/tickets/active/B-076-fix-project-selector-sidebar-context-switch.md

## Scope

This sprint keeps B-076 open until Sidecar project selection, visible context,
Browse roots, Recent Paths, pinned folders, and project-scoped API calls all
share one active Project root without requiring a full browser reload.

The recovered failure mode is root drift: a Sidecar project tab or Browse view
can load one workspace while the shell title/control still advertises another
Project. That is treated as active sprint work, not closed delivery.

## Included Tickets

- B-076: active

## Current Evidence

- Sidecar project selection promotes the selected Project through the active
  Project registry path before reducer selection.
- Recent Paths and opened roots use the same active Project promotion path.
- Sidecar derives effective browser root from active load or loaded context
  before falling back to the embedding prop.
- Pinned-folder persistence is guarded by the root it was loaded for.
- Sidecar Browse requests uncapped entries while generic folder browsing stays
  bounded by default.
- Targeted reducer replay, build, focused Playwright lanes, full Sidecar wave,
  and full e2e have passed in the active sprint pass.

## Closure Gates

- [x] Run and record full `npm run test:sidecar-wave`.
- [x] Run and record full `npm run test:e2e`.
- [x] Re-check the live browser against a steel-thread workspace and verify the
  shell root label, Sidecar root, Browse root, and visible Project context agree.
- [x] Confirm unrelated dirty worktree changes are not required for B-076
  implementation closure.
- [ ] Operator close review and ticket transition.

## 2026-05-13 Sprint Evidence

- `npm run build`: passed.
- `npm run test:sidecar-wave`: passed, 142 Node runtime tests and 9 Python
  runtime tests.
- `npm run test:e2e`: passed, 38 browser tests.
- Live steel-thread proof used
  `/Users/jim/src/apps/odd_sdlc/build_tenants/typescript/test_env/test_runs/data_mapper_steel_thread_sandbox/20260512T170956378Z_pid24944/workspace`.
  The shell root control, Sidecar Project rail, and Browse flyout all resolved
  to that workspace, and Browse showed root entries from the steel-thread
  workspace rather than the prior `data_mapper.test35` Project.

## Excluded Boundaries

- no GTL/ABG runtime semantics
- no odd_sdlc query-contract changes
- no Process Navigator product-law changes
- no document-viewer capability expansion
- no Project registry redesign beyond active-root propagation needed for B-076

## Sprint Operating Rule

Do not mark B-076 complete while the full sprint closure gates remain open.
Targeted proof can support implementation confidence, but closure requires the
declared full-lane evidence or an explicit sprint review that narrows the gates.
