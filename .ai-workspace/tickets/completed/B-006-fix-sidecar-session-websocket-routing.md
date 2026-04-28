---
id: B-006
title: Fix SidecarPanel session WebSocket routing through the active client host
type: bug
ticket_category: corrective_review
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Make xterm session attach work from the normal Vite client by routing /ws/sessions to the API server or by constructing the correct API WebSocket URL.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx, build_tenants/react_vite/vite.config.ts, build_tenants/react_vite/src/server/session-pty-service.mjs
priority: high
triaged_at: 2026-04-27
created_at: 2026-04-27
updated_at: 2026-04-27
build_tenant: react_vite
source_ticket: T-020
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: Codex sidecar-wave code review found that SidecarPanel connects to ws://window.location.host/ws/sessions/:id while Vite only proxies /api, so the WebSocket does not reach the API server in the normal dev topology.
target_truth: A session selected in SidecarPanel opens a working xterm WebSocket against the same session id that /api/sessions/spawn returned, both in dev and in the API-served deployment topology.
superseded_truth: SidecarPanel assumes the browser host is also the session WebSocket host, while only /api is proxied.
closure_law: This bug closes when a browser-side integration or e2e proof spawns a session from SidecarPanel, opens the WebSocket, sends input, observes output, detaches, reattaches, and kills the session without manually changing ports.
evaluation_criteria:
  - Vite dev server proxies /ws/sessions to the API server or SidecarPanel derives the API WebSocket origin explicitly
  - SidecarPanel includes projectRoot on the WebSocket request when needed
  - attach errors are surfaced as actionable UI state, not just terminal text
  - e2e or WebSocket-level test covers spawn, attach, input, output, reattach, kill
proof_surface:
  - Vite proxy or URL construction change
  - WebSocket lifecycle test
  - SidecarPanel manual run evidence or Playwright proof
non_closure_conditions:
  - WebSocket works only when the client is served directly by the API server
  - /ws remains unproxied in dev
  - test covers spawn but not attach/input/output
---

## STDO Reading

This is a UX realization defect under T-020. The sidecar view emits a lawful
session attach action, but the delivery binding points at the wrong host.
