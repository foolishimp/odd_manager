---
id: T-010
title: Realize Project Agent Widget as Context producer in pure sidecar tab
type: feature
ticket_category: build_wave
status: backlog
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Build the Project Agent Widget as a standalone Context producer in a pure sidecar tab so it can be embedded into any workspace UX with one prop/event contract, with terminal spawn from the widget passing Context to SessionAssetSurface.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: AppShell sidecar route, ProjectSelector and FolderBrowser components, embedding contract, Context emission shape, terminal spawn from widget
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
dependencies:
  - T-009 completed
  - T-013 completed
  - T-015 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: existing src/features/project-selector/FolderBrowser.tsx and ProjectSelector.tsx (mid-flight uncommitted); comments/claude/20260424T140000Z_STRATEGY P2 + P3
target_truth: Project Agent Widget exists as a standalone component reachable via a "sidecar" tab in AppShell; emits active_context://current = { project, workspace, session? } as a single record matching the MCP resource shape; embeds into at least one other workspace UX (RequirementsWorkspace, ProcessWorkspace, or BuilderPanel); selection is local-by-default within an embedding and promotes to global on explicit pin; terminal spawn from the widget passes Context to SessionAssetSurface.
superseded_truth: Project selection is implicit per-page, with no Context emission, no embeddable contract, and no global vs local selection semantics; uncommitted in-flight widget code lacks a stable contract.
closure_law: this ticket closes when the widget exists as a standalone component, has a documented prop/event contract, emits the active_context shape (identical to the MCP resource shape from T-011), is successfully embedded in at least one other workspace UX, and a terminal spawned from the widget inherits the emitted Context.
evaluation_criteria:
  - sidecar tab route exists in AppShell
  - widget emits active_context on selection in the shape ratified by T-005
  - emission shape matches the MCP resource shape with no adapter layer
  - embedding contract is documented and consumed in at least one other surface
  - pin promotes local selection to global Context lawfully
  - terminal spawn from widget passes Context to SessionAssetSurface
  - all in-flight uncommitted ProjectSelector / FolderBrowser code is brought under this ticket
  - tenant ADR records the UX realization stack choice per UX_METHOD §12 before implementation begins
  - State / Msg / Update / Cmd shapes declared in the tenant design module before implementation per UX_METHOD §13
  - widget binds to AssetSurfaces through their action registries per UX_METHOD §7 (no direct file or service writes)
  - widget passes the UX_METHOD §8 Msg-replay test on at least one full selection scenario
proof_surface:
  - Project Agent Widget component
  - sidecar tab route in AppShell
  - one embedded usage proof
  - Context-emission test
  - terminal-spawn-from-widget test
  - documented prop/event contract
  - tenant ADR at build_tenants/react_vite/design/ recording the UX realization stack
  - design module entry declaring State / Msg / Update / Cmd for the widget
  - Msg-replay test for at least one selection scenario
non_closure_conditions:
  - widget only works in sidecar tab and not when embedded
  - emission shape diverges from MCP resource shape
  - pin semantics are global-only or local-only with no promotion path
  - in-flight uncommitted work remains outside this ticket's scope
  - view owns state continuation (UX_METHOD §8 / §14 #4 violation)
  - effect handler contains conditional logic that decides state transitions (UX_METHOD §6 / §14 #3)
  - product-meaningful state held in view-local state cells outside the reducer (UX_METHOD §14 #2)
  - widget behavior cannot be replayed from a Msg log (UX_METHOD §14 #12)
---

## STDO Reading

This ticket is the Context producer; everything else in the wave is a Context consumer.
