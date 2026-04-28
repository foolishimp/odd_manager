---
id: B-072
title: Add file path clipboard history and recent file memory
type: feature
ticket_category: ordinary
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make file browsing immediately useful for terminal-agent workflows by copying clicked file paths and retaining a recent file/path history.
change_class: product_reprice
re_entry_point: product
affected_boundary: specification/PRODUCT.md, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md, build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/src/features/sidecar/sidecar-state.ts, build_tenants/react_vite/src/app/styles.css, build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs, build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
priority: high
triaged_at: 2026-04-29
created_at: 2026-04-29
updated_at: 2026-04-29
activated_at: 2026-04-29
completed_at: 2026-04-28T16:13:01Z
build_tenant: react_vite
dependencies:
  - B-060 completed
  - B-071 backlog
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - U: UX_METHOD.md
ux_surface_scope: Sidecar file browser, selector history, and terminal handoff workflow
intake_source: Operator request that clicking files in the explorer copy the full file path to clipboard and build a clipboard/history memory for recent files, with the immediate utility priority on this behavior.
target_truth: When the operator clicks or explicitly copies a file in Sidecar file browsing, the absolute file path is copied to the system clipboard and recorded in a recent file/path history. The history is browsable, can re-copy a path, and can open the file into the selected viewer pane.
superseded_truth: File selection opens or previews a record but does not reliably provide a paste-ready absolute path or a short recent-file memory for CLI agent workflows.
closure_law: This ticket closes only when the product surface records the path-memory utility, implementation copies full paths through an explicit command path, recent file history is visible and reusable, and tests cover clipboard and history behavior.
evaluation_criteria:
  - PRODUCT or design surface records file path clipboard/history as an operator utility
  - clicking a file or pressing an explicit copy affordance copies the absolute path, not only the relative path
  - copy success and failure are visible without navigating away from Sidecar
  - recent path history records file path, project root, relative path, timestamp, and source selector
  - history has a compact flyout/browser surface similar to recent files
  - clicking a history item copies its path back to clipboard
  - history item can also open the file into the selected viewer pane
  - history length is bounded and stable across normal Sidecar navigation
  - terminal input focus is preserved so the copied path can be pasted into Codex, Claude, or shell sessions
  - browser proof covers copy-on-file-click and copy-from-history
  - runtime replay proof covers history append, dedupe, and bounded retention
  - `npm run build` passes
  - `npm run test:sidecar-wave` passes
  - `npm run test:e2e` passes
proof_surface:
  - specification/PRODUCT.md
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/app/styles.css
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts
non_closure_conditions:
  - only relative paths are copied
  - browser clipboard failure is silent
  - path history is hidden in local component state and cannot be replayed
  - selecting a history item unexpectedly navigates away from Sidecar
  - this ticket expands into autonomous agent pane control before the clipboard/history workflow is delivered
future_extension:
  - window-aware agent commands can later consume the same selected-pane and recent-path model to open documents in viewer panes on behalf of a CLI agent
---

## SPEC_METHOD Triage

This is a product reprice because it adds a visible operator utility to the
Sidecar product surface: a file path clipboard and recent file memory. The
intent remains stable: improve operator control over project context and CLI
agent workflows.

Lawful re-entry point: Product.

## Immediate Utility Scope

Deliver the narrow workflow first:

1. File click or copy action writes the absolute path to clipboard.
2. The copied file enters recent path history.
3. The history can re-copy or open the file in a viewer pane.
4. The terminal remains ready for paste.

Full agent window-awareness is intentionally deferred. This ticket should not
wait for agents to directly command viewer panes.

## Closure Evidence

Closed at `20260428T161301Z`.

Implemented:

- Added `File Path Memory` to the product surface as a manager-local operator
  utility.
- Added the B-072 design rule to the Sidecar workspace design module.
- Added `Recent Paths` as a Sidecar explorer provider.
- Added typed `SidecarPathHistoryEntry` state with bounded retention, dedupe,
  and replay proof.
- Added a declared `clipboard.write` command interpreted at the Sidecar effect
  membrane.
- File rows now open the selected file and request copy of the absolute path.
- Recent path rows can re-copy the path and open files in the active viewer
  pane when the recorded Project matches the current Context.
- Persisted recent path history in manager-local browser storage.

Verification passed:

- `npm run build`
- `npm run test:sidecar-wave`
- `npm run test:e2e -- --grep "sidecar browse navigator pins project folders"`
- `npm run test:e2e` (26 Playwright tests)
