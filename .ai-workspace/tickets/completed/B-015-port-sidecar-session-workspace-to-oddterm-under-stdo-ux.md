---
id: B-015
title: Port Sidecar session workspace to the oddterm substrate under STDO-UX
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Replace the Sidecar session widget's broken copied terminal path with a method-conformant port over the reliable oddterm local shell substrate.
change_class: design_reframe
re_entry_point: design
affected_boundary: build_tenants/react_vite/src/features/sidecar, build_tenants/react_vite/src/server/index.mjs, build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-010
dependencies:
  - T-006 completed
  - T-009 completed
  - T-013 completed
  - T-014 completed
  - T-020 completed
  - T-021 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Operator observed that Local Shell Workspace is reliable while the copied Sidecar terminal path reports websocket errors. Operator correction requires code porting under UX_METHOD, SPEC_METHOD migration law, and DESIGN_MODULE_METHOD reference-derived module law rather than another in-place symptom patch.
target_truth: Sidecar sessions use the oddterm local shell substrate through a declared Sidecar Session Workspace design module, with Sidecar product actions emitted as typed Msg values, interpreted as declared Cmd values at the effect membrane, and rendered from shared SessionRecord contracts.
superseded_truth: Sidecar directly performs fetch/WebSocket effects in view handlers and embeds a copied xterm attachment path against the older /ws/sessions seam.
closure_law: This bug closes only when the Sidecar session path is derived from the design module, the old copied /ws/sessions terminal path is removed from the Sidecar acceptance path, product-changing actions replay as Msg/Cmd, and the tenant build plus sidecar replay/runtime proof commands pass.
evaluation_criteria:
  - design module classifies the existing OddTerm code as reference material and maps it to the target Sidecar boundary
  - Sidecar product actions dispatch typed Msg variants and are interpreted as declared Cmd values
  - Sidecar session listing/spawn/close uses the oddterm-backed session projection without mutating the existing OddTerm workspace implementation
  - terminal attach uses /api/oddterm and isolates xterm/WebSocket/ResizeObserver interop inside a terminal effect membrane
  - Msg-replay proof covers session spawn and close commands against the current Context
  - npm run build and npm run test:sidecar-wave pass
proof_surface:
  - build_tenants/react_vite/design/widgets/sidecar-session-workspace.md
  - build_tenants/react_vite/src/features/sidecar/sidecar-state.ts
  - build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx
  - build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs
  - npm run build
  - npm run test:sidecar-wave
non_closure_conditions:
  - Sidecar terminal still connects to /ws/sessions
  - product actions are performed directly in React event handlers
  - correctness depends on view-local continuation rather than Msg replay
  - old OddTerm workspace code is broken or rewritten as part of the port
---

## STDO Reading

This is a reference-derived UX port, not a new terminal feature. The reliable
oddterm substrate is preserved as reference/proven carrier behavior. The
Sidecar implementation must be re-derived under UX_METHOD and
DESIGN_MODULE_METHOD rather than copying the old local shell view's imperative
state and effect loops.

## Closure Evidence

- Design boundary added at `build_tenants/react_vite/design/widgets/sidecar-session-workspace.md`.
- Sidecar action handlers now dispatch typed `Msg` variants and run declared
  `Cmd` values through the effect membrane.
- Sidecar session list/spawn/close uses the oddterm-backed projection at
  `/api/sidecar/sessions`.
- Sidecar terminal attach uses `/api/oddterm`; the old `/ws/sessions` copied
  path is not in the Sidecar acceptance path.
- `npm run build` passed.
- `npm run test:sidecar-wave` passed: 82 Node tests and 7 Python tests.
- Browser verification at `http://127.0.0.1:5174/` selected a running Sidecar
  session, attached a connected terminal, spawned a shell, closed the spawned
  shell, and showed no new console warnings or errors after reload.
