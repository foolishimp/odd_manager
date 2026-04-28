# ADR 0002 - Session Backplane And Terminal Substrate

**Status**: Accepted
**Date**: 2026-04-27
**Tenant**: `react_vite`
**Closes tickets**: B-005, B-010
**Governance**: STDO-UX (`SPEC_METHOD`, `TICKET_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)

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

The sidecar supports two named substrates:

| Substrate | Name | Survival | Attach Model | Resize Claim |
|---|---|---:|---|---|
| GNU `screen` | `screen` | yes, when executable and runnable | replay/poll `screenlog.0`, input via `screen -X stuff` | no native resize guarantee |
| Node child process pipes | `pipe` | no | direct stdout/stderr stream, stdin pipe | no native resize guarantee |

The default backplane is `auto`: use `screen` when the runtime can actually
launch and observe a detached screen session; otherwise fall back to `pipe` and
report the reduced capability in diagnostics.

Operators may force behavior with `OMAN_SESSION_BACKPLANE`:

- `screen` or `survivable`: fail closed if screen is unavailable
- `pipe`, `process`, `child_process`, or `transient`: use the non-survivable
  pipe substrate
- unset or `auto`: prefer screen, fall back to pipe

User-facing and proof-facing language must call this a **session console** or
**session backplane** unless a future implementation adopts a real pty library
such as `node-pty` and proves native terminal semantics.

---

## Consequences

The product can truthfully support restart-survivable sessions in environments
where `screen` is runnable, while remaining usable in restricted environments
where detached terminal daemons are blocked.

The xterm.js UI is still appropriate as a terminal emulator surface, but the
current substrate does not claim full pty parity. Resize is accepted as a
control message for forward compatibility, but it is not a closure condition
for this ADR.

---

## Verification

Required proof surfaces:

- `test_session_pty.mjs`: pipe-backed spawn, transcript, kill, and WebSocket
  attach/input/replay/reattach/kill
- `test_session_pty_screen.mjs`: screen-backed spawn and rehydrate, skipped
  with explicit diagnostics when screen cannot run
- API `/api/sessions` diagnostics: selected runtime capability is reported to
  consumers

