---
id: T-027
title: Decorate oddterm session header with TracedCalloutEvidence when the session is an operator-run terminal
type: feature
ticket_category: ui_substrate_alignment
status: backlog
review_status: pending
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Let oddterm consume the T-022 traced call-out carrier by terminalSessionId and decorate active operator-run terminal sessions with typed outcome, executor profile, parser, retry/tool counts, and trace archive links.
change_class: realization_refactor
re_entry_point: realization
affected_boundary: src/features/oddterm/OddTermPanel.tsx, src/features/oddterm/OddTermWorkspaceWidget.tsx, sidecar Process Navigator traced-evidence carrier
priority: medium
created_at: 2026-05-05
updated_at: 2026-05-05
governance_scope: STDO Method
depends_on:
  - T-022
intake_source: T-025 audit classified oddterm as extension_required because an oddterm PTY session and a T-022 TracedCalloutEvidence.terminalSessionId can describe the same runtime fact.
target_truth: When an oddterm session corresponds to a traced operator-run terminal, the oddterm header renders the admitted TracedCalloutEvidence subset keyed by terminalSessionId and offers trace archive click-through. Non-operator sessions remain unchanged.
closure_law: This ticket closes only when oddterm consumes the T-022 carrier through typed state, does not read trace archives directly from React, and has a Msg-replay or focused component proof covering matched and unmatched terminal sessions.
---

# T-027: Decorate Oddterm Session Header With Traced Callout Evidence

## STDO Triage

First missing layer: realization.

The T-022 carrier exists in the sidecar process projection. oddterm has the terminal session surface, but does not yet join that session to admitted traced evidence.

## Carrier Consumption

`consumes_carrier(t022:traced_callout_evidence.by_terminal_session_id)`

Fields consumed:

- `terminalSessionId`
- `outcome.kind`
- `executorProfile`
- `parser`
- `apiRetryCount`
- `toolCallCount`
- `traceArchiveRoot`

## Closure Criteria

- oddterm session headers render evidence only when `terminalSessionId` matches
- unmatched sessions render no substrate decoration
- trace archive click-through uses admitted carrier paths
- proof covers matched and unmatched sessions
