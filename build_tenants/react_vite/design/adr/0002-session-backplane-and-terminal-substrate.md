# ADR 0002 - Session Backplane And Terminal Substrate

**Status**: Accepted
**Date**: 2026-04-27
**Repriced**: 2026-05-25 - single Node/screen terminal source of truth
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
- API `/api/sessions` diagnostics: selected runtime capability is reported to
  consumers
