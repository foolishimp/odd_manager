# B-004 Fix Generated Bootstrap Summary Count Drift

- id: B-004
- type: bug
- status: active
- goal: control-surface-reprice
- priority: medium
- created_at: 2026-04-14
- updated_at: 2026-04-14

## Context

`data_mapper.test32/specification/requirements/10-generated-bootstrap.md`
publishes a valid table inventory of 79 unique `REQ-*` / `RIC-*` ids, but the
same file's `Inventory Summary` block is stale.

Published rows currently resolve to:

- 71 `REQ-*`
- 8 `RIC-*`
- 79 total requirement / implementation-constraint ids

The summary block still states:

- 59 `REQ-*`
- 8 `RIC-*`

This is a producer-side data defect. It does not cause the original
`odd_manager` observer bug by itself, but it does create false inventory
communication inside the workspace's own generated publication surface.

## Acceptance

- The generated bootstrap summary is recomputed from the live published table
  inventory rather than copied forward as stale text.
- The summary counts match the actual set of unique `REQ-*` and `RIC-*` ids in
  the same file.
- The producer path has a regression check so count drift does not silently
  recur.

## Links

- incident workspace: `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper.test32/specification/requirements/10-generated-bootstrap.md`
- consumer context: `build_tenants/react_vite/runtime/odd_manager_world.py`
- ticket method: `/Users/jim/src/apps/specification_methodology/specification/standards/TICKET_METHOD.md`
