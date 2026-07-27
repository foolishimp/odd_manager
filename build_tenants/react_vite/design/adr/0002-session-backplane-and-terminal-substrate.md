# ADR 0002 - Session Backplane And Terminal Substrate

**Status**: Accepted
**Date**: 2026-04-27
**Repriced**: 2026-05-25 - single Node/screen terminal source of truth
**Tenant**: `react_vite`
**Closes tickets**: B-005, B-010
**Governance**: STDO-UX (`SPEC_METHOD`, `TICKET_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)
**Implements**: `PO-OM-OPERATE-001`; `PO-OM-DEVELOPER-001`; `PO-OM-MODULES-001`; `REQ-OM-WRK-*`; `REQ-OM-SES-*`
**Code Entrypoints**: `build_tenants/react_vite/src/server/oddterm-pool-service.mjs`; `build_tenants/react_vite/src/server/session-pty-screen.mjs`; `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx`; `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts`
**Executable Proof**: `build_tenants/react_vite/runtime/tests/test_session_pty_screen.mjs` :: `rehydrateFromScreen reconciles persisted records with live screen sessions`; `build_tenants/react_vite/runtime/tests/test_oddterm_node_screen.mjs` :: `OddTerm rehydrates and reconnects live screen sessions from backend state`; `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs` :: `session spawn and correlated kill replay expose commands on the admitted Context`
**STDO-UX Bindings**: State=SidecarState session and terminal-workspace slices including retained kill command identity and Context; Msg=SidecarMsg session and terminal variants including correlated kill results; Update=reduceSidecarState; Cmd=SidecarCmd session spawn kill attach and resize commands; Sub=OddTerm WebSocket output attachment lifecycle; Ingress=SessionRecord plus oddterm service admission; View=SidecarPanel session navigator and terminal workspace; Membrane=Sidecar terminal adapter and oddterm-pool-service; Replay=build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs :: session spawn and correlated kill replay expose commands on the admitted Context; Accessibility=build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts :: sidecar workbench resize controls support keyboard and pointer operation
**Accepted Ontology And Design Basis**: `ONT-OM-DEVCTRL-001` and `B-OM-DEVCTRL-LOCAL-001`; the session backplane projects `P-CONTEXT`, `P-COMMAND`, `P-RESULT`, `P-OBSERVATION`, and `P-REPLAY`.
**Accessibility Proof Scope**: Terminal labeling and controls, keyboard/pointer resize, focus/navigation, representative contrast, and narrow-screen containment are exercised. No screen-reader certification beyond Product's accessibility minimum is claimed.
**Implementation Acceptance**: Accepted for the manager-local session and effect-private terminal adapter subject to the exact T-032 validation bundle. xterm, DOM, ResizeObserver, timer, and WebSocket objects are membrane-private handles and cannot establish Project, evidence, or closure truth.

---

## Context

The sidecar session surface previously used `session-pty` naming while the
implementation was a `child_process.spawn` pipe bridge. That bridge can stream
output into xterm.js, but it is not a native pty and does not survive an
`odd_manager` API restart.

T-021 added a GNU `screen` module for restart-survivable sessions, but it was
not wired into the public API path. B-005 and B-010 re-enter this design point.

---

## Decision

The sidecar supports one terminal substrate:

| Substrate | Name | Survival | Attach Model | Resize Claim |
|---|---|---:|---|---|
| GNU `screen` | `node-screen-pty` | yes, when executable and runnable | replay/poll `screenlog.0`, input via `screen -X stuff` | no native resize guarantee |

The product no longer carries a Python PTY bridge or a pipe compatibility
fallback. If GNU `screen` is unavailable, OddTerm fails closed and reports the
missing terminal substrate.

User-facing and proof-facing language calls this an OddTerm session backed by
the Node GNU `screen` adapter. Native resize remains explicitly unclaimed until
a future terminal library proves that behavior.

---

## Consequences

The product can truthfully support restart-survivable sessions in environments
where `screen` is runnable. Restricted environments without GNU `screen` must
install or expose that substrate rather than silently dropping to a weaker
terminal model.

The OddTerm registry under `.ai-workspace/runtime/oddterm` is rehydrated when
session state is listed or attached. A browser crash or reload therefore
recovers by discovering the backend-managed `screen` sessions and reconnecting
to the selected session id; an explicit stale id fails closed instead of
silently creating a different shell.

Rehydration does not trust persisted carrier addresses. Both OddTerm and the
legacy SessionAssetSurface require the exact persisted Project root, canonical
session id, admitted cwd, and server-derived screen identity before consulting
live `screen` state. Screen names are derived from both Project root and session
id, so copied cross-Project metadata cannot alias a global screen. Transcript,
record, metadata, and screen-configuration paths are derived from that same
identity; persisted path or screen aliases never select a carrier.

The `.ai-workspace/runtime/oddterm`,
`.ai-workspace/runtime/sessions`, and
`.ai-workspace/runtime/conversation_history` registry chains, per-session
directories, and files must be realpath-contained regular non-symlink
carriers. The conversation metadata and entries that supply terminal replay
are admitted through that same Project runtime membrane and must bind the exact
Project root, canonical history id, and owning session or room. They are not a
weaker secondary transcript path. Copied cross-Project history metadata,
external symlink roots, record files, transcript or history files, traversal
ids, and encoded-slash ids fail before rehydrate, attach, replay, input, or
kill. A rejected persisted record confers no terminal authority even when the
screen name it supplies is globally live.

Every new session's working directory is admitted against the exact registered
Project before a registry record or `screen` process is created. It must be a
resolvable directory whose lexical and real Project-relative paths agree;
outside paths and symlink-re-rooted paths fail closed.

The xterm.js UI is still appropriate as a terminal emulator surface, but the
current substrate does not claim full pty parity. Resize is accepted as a
control message for forward compatibility, but it is not a closure condition
for this ADR.

---

## Verification

Required proof surfaces:

- `test_session_pty_screen.mjs`: screen-backed spawn and rehydrate, skipped
  with explicit diagnostics when screen cannot run
- `test_oddterm_node_screen.mjs`: OddTerm browser-session backend uses the
  same Node/screen substrate, streams appended `screenlog.0` output, and
  rehydrates a live session from persisted backend state
- `test_terminal_persisted_authority.mjs`: cross-Project copied state,
  symlinked runtime carriers, transcript aliases, and traversal ids cannot
  rehydrate, attach, replay, input, or kill either terminal substrate
- `test_conversation_history_service.mjs`: terminal replay metadata and entry
  carriers reject symlinked runtime roots, history directories, files, and
  non-canonical or cross-Project history identities
- API `/api/sessions` diagnostics: selected runtime capability is reported to
  consumers
