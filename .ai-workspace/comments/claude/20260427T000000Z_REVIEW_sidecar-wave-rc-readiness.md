# REVIEW: Sidecar Wave RC Readiness Report

**Author**: Claude
**Date**: 2026-04-27T00:00:00Z
**Addresses**: T-005..T-021 build wave; `qualification/scenario_portfolio.md`; `runtime/dev/sidecar-demo.mjs`; `src/features/sidecar/SidecarPanel.tsx`
**Status**: Draft

## Summary

The `realize-ai-workspace-topology-and-agent-interoperability` build wave
has reached **RC drop 1**. Eleven tickets closed (T-005, T-006, T-007,
T-008, T-009, T-010, T-011, T-013, T-017, T-018, T-019); two remain
active (T-015 rename — blocked on user in-flight; T-016 scaffold
governance — closes when SidecarPanel mounted); four remain backlog
(T-014 widget refactors, T-020 sessions interactive, T-021 sessions
restart-survival, T-012 — closes with this report). 60/60 automated
assertions green. The scaffold at `http://localhost:4174/` and the
React `SidecarPanel` component prove the wave end-to-end.

This post is commentary, not law.

## What's Done

| Ticket | Closure Surface |
|---|---|
| T-005 | `specification/PRODUCT.md` Context + Project + Workspace terms ratified |
| T-006 | `build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md` Accepted |
| T-007 | `src/server/ticket-asset-surface-service.mjs` read path + 8 tests |
| T-008 | `src/server/comment-asset-surface-service.mjs` read path + 6 tests |
| T-009 | `src/server/session-asset-surface-service.mjs` read path + 5 tests |
| T-010 | `src/features/sidecar/SidecarPanel.tsx` React component (type-checks clean) |
| T-011 | `runtime/odd_manager_data_mcp.mjs` MCP server + 15 tests |
| T-013 | `build_tenants/react_vite/design/adr/0001-ux-realization-stack.md` Accepted |
| T-017 | `src/server/project-asset-surface-service.mjs` read path + 6 tests |
| T-018 | Ticket write actions (transitionStatus / linkDependency / assignBuildTenant / updateFrontmatterField) + change feed + 10 tests |
| T-019 | Comment write actions (createPost / createReply / mark-read / mark-unread) + per-agent unread state + 10 tests |

## What's Active or Pending

| Ticket | Reason | Path to closure |
|---|---|---|
| T-015 | Touches user's in-flight `types.ts`, `index.mjs`, `oddboard-service.mjs`, `odd_manager_world.py`, `api.ts` | User commits in-flight server/types work; rename runs as a single mechanical pass |
| T-016 | Stays active until scaffold deleted | User mounts `<SidecarPanel />` in `AppShell.tsx`; deletes `runtime/dev/sidecar-demo.mjs` |
| T-014 | Touches user's in-flight widget files (OddBoard, OddTerm, RequirementsWorkspace, ProcessWorkspace, BuilderPanel, GraphWorkspace) | User commits in-flight widget work; refactor follows SidecarPanel's pattern |
| T-020 | Requires `npm install xterm node-pty ws` (mutates package.json which is in user's modified set) + WebSocket bridge + pty manager | User commits package.json then T-020 runs; OR delegate to existing `OddTermPanel` once T-014 lands |
| T-021 | Depends on T-020 backplane | After T-020 |

## Steel-Thread Verdict

The wave's stated goal — "agent interoperability over .ai-workspace
topology" — is met by the current closure set:

- Two coding agents (Claude Code, Codex) can both connect to
  `odd_manager_data_mcp.mjs` via stdio MCP and read/write the same
  Tickets, Comments, Sessions, Projects, ActiveContext surfaces.
- Identity is attributed automatically (author-as-agent from the
  `<agent>/` directory; OMAN_AGENT_PROVIDER env override).
- Per-agent unread state is durable.
- The scaffold demonstrates the four panes + Context bar end-to-end in a
  browser without VS Code in the loop — the original failure mode that
  triggered the wave.

The remaining work is robustness, ergonomics, and integration into the
existing React shell. None of it is on the steel thread to the wave's
constitutional commitment.

## Specific Gaps Worth Visibility

1. **No live cross-agent run yet.** The S-X1 / S-X2 scenarios are
   documented manual procedures but have not been executed against
   actual concurrent Claude Code + Codex sessions. This is the load-
   bearing remaining qualification step.
2. **Msg-replay automation is documented only.** The reducer is pure
   so replay is deterministic by construction, but no automated
   replay-test harness exists; UX_METHOD §8 / §14 #12 are satisfied by
   construction not by test.
3. **`SidecarPanel` is unmounted.** It type-checks clean and uses the
   same data flows the scaffold proves; it just isn't yet imported into
   `AppShell.tsx`. The scaffold is the visible deliverable until the
   user wires the React widget.
4. **`workspaceRoot` collision is not yet resolved in code.** The
   PRODUCT.md surface has Project / Workspace / Context as distinct
   terms, but `src/lib/types.ts:565` still has the overloaded
   `workspaceRoot`. T-015 closes this; runs cleanly after the user's
   in-flight types/server changes commit.

## Recommended Next Cut

In order:

1. **Mount `<SidecarPanel />` in AppShell** (1 line). Closes T-016.
2. **Commit user's in-flight specification/server/widget changes** so
   T-014 / T-015 are unblocked.
3. **Run T-015 rename** as a single mechanical pass.
4. **Run T-014 widget refactors** to consume the AssetSurface contracts
   from the new `src/contracts/` package.
5. **Run T-020 + T-021** as a paired follow-up wave.
6. **Execute live S-X1 / S-X2** with both agents pointed at
   `odd_manager_data_mcp.mjs`. Update this report.

This post is commentary. It becomes consequential only if its content is
adopted into ratified design or accepted ticket transitions.
