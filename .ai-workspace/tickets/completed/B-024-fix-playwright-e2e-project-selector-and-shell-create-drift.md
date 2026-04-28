---
id: B-024
title: Fix Playwright e2e project selector and shell create drift
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Restore browser verification for the current Sidecar and workspace selector wave by fixing stale shell-create targeting and aligning folder browse workspace detection with the managed-project contract.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/src/features/project-selector/FolderBrowser.tsx, build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: B-023
dependencies:
  - B-023 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Headless Playwright verification after the Sidecar hide fix found one ambiguous shell-create selector and one project selector browse mismatch for `.ai-workspace` projects.
target_truth: Playwright browser verification runs as a normal verification layer; shell creation targets one explicit control; folder browsing marks `.ai-workspace` project roots as managed workspaces consistently with ProjectAssetSurface.
superseded_truth: The e2e shell create test uses a broad locator that matches two valid controls, and folder browsing marks only `.genesis` roots as workspaces while ProjectAssetSurface treats `.ai-workspace` as the managed-project boundary.
closure_law: This ticket closes only when the browser selector tests target current UI semantics, folder browsing recognizes `.ai-workspace` managed projects, unknown workspace identity does not render as an Odd Manager identity tag in the folder list, and build plus sidecar wave plus Playwright e2e verification pass.
evaluation_criteria:
  - live shell e2e selects exactly one shell-create control
  - folder browse marks `.ai-workspace` roots as managed workspaces
  - unknown folder-browser workspace identity displays as `managed`, not `Odd Manager`
  - npm run build passes
  - npm run test:sidecar-wave passes
  - npm run test:e2e passes
proof_surface:
  - build_tenants/react_vite/src/server/index.mjs
  - build_tenants/react_vite/src/features/project-selector/FolderBrowser.tsx
  - build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
  - npm run build
  - npm run test:sidecar-wave
  - npm run test:e2e
non_closure_conditions:
  - Playwright is skipped after code changes that affect browser behavior
  - the shell-create test remains strict-mode ambiguous
  - `.ai-workspace` projects remain invisible as managed entries in folder browse
  - unknown identity roots are mislabeled as Odd Manager in the project selector list
---

## STDO Reading

This is a realization refactor over the verification and project-selector
surfaces. No product requirement changes. The browser proof surface revealed
test drift in shell creation and a classifier mismatch between the folder
browser and the existing ProjectAssetSurface managed-project boundary.

## Closure Evidence

- Folder browse now treats `.ai-workspace` as a managed workspace marker,
  aligning the browser selector with `ProjectAssetSurface`.
- Unknown folder-browser workspace identity now displays as `managed` instead
  of being mislabeled as `Odd Manager`.
- The live shell e2e now targets the explicit `+ New Local Shell` control.
- OddTerm and Sidecar terminal panes now ignore socket events after disposal,
  preventing stale close/error events from overwriting a live terminal state.
- OddTerm and Sidecar terminal panes clear stale xterm DOM before opening a
  replacement terminal instance, preventing duplicate helper textareas during
  rapid remount.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 87 Node tests and 7 Python tests.
- `npm run test:e2e` passed: 5 Playwright tests.
