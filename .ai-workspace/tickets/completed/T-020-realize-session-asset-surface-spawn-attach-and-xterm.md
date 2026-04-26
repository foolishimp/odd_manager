---
id: T-020
title: Realize SessionAssetSurface spawn / attach / kill plus xterm.js attachment
type: feature
ticket_category: build_wave
status: completed
goal: realize-ai-workspace-topology-and-agent-interoperability
change_intent: Add the interactive half of SessionAssetSurface — spawn / attach / detach / rename / kill actions backed by a real pty, plus a WebSocket-attached xterm.js terminal in the scaffold so the operator can type into a real coding-agent session through the sidecar.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/server/session-asset-surface-service.mjs spawn/attach/kill, pty backplane (tmux or native), WebSocket bridge between pty and xterm.js, scaffold terminal pane
priority: high
triaged_at: 2026-04-26
created_at: 2026-04-26
updated_at: 2026-04-26
build_tenant: react_vite
source_ticket: T-009
dependencies:
  - T-009 completed
governance_scope: STDO-UX Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
intake_source: T-009 spin-out (work bounded to read path on closure); ASSET_SURFACE_AND_TOPOLOGY.md §2.5 Action Registry for sessions; existing src/features/oddterm/ as a working xterm.js reference
target_truth: SessionAssetSurface supports spawn (creates a pty inheriting active Context — cwd from project, env from workspace_profile), attach (binds an xterm.js instance over a WebSocket bridge to the pty), detach, rename, and kill actions. Scaffold renders a real interactive terminal pane an operator can type into.
superseded_truth: Sessions are list-only (T-009 read); scaffold cannot interact with terminals; spawn requires manually starting a process outside the surface.
closure_law: this ticket closes when an operator can spawn, attach, type into, detach, and kill a session through the scaffold; spawned sessions provably inherit Context per T-009 contract; attach is bidirectional (input from xterm.js to pty, output from pty to xterm.js).
evaluation_criteria:
  - spawn action creates a pty with cwd from active Context project.root and env carrying workspace_profile + odd_type
  - attach binds xterm.js to the pty over a WebSocket; bidirectional read/write works
  - detach disconnects xterm.js without killing the pty
  - kill terminates the pty cleanly; transcript reference preserved
  - xterm.js library bundled as a tenant-local dep (decision recorded in ADR follow-up)
  - scaffold terminal pane operates without page reload
  - integration test exercises spawn → attach → input → output → detach → re-attach → kill
proof_surface:
  - src/server/session-asset-surface-service.mjs spawn / attach / kill implementations
  - WebSocket bridge module
  - scaffold xterm.js pane
  - integration test for the full lifecycle
non_closure_conditions:
  - spawn ignores active Context
  - attach is one-directional (input or output only)
  - kill leaves an orphan pty
  - xterm.js loaded from CDN without pinning (must be tenant-local)
---

## STDO Reading

The interactive terminal increment — closes the user-facing half of T-009 spun out for incremental progression.
