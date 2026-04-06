# Operator Workbench

**Family**: `REQ-OM-WRK-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/PRODUCT.md`, `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

### REQ-OM-WRK-001 - The product provides a workspace-scoped operator workbench

`odd_manager` shall provide a first-class operator workbench scoped to the
selected managed workspace and available as a normal product surface.

Acceptance Criteria
- the operator can reason, direct work, and inspect project state while
  remaining inside the managed workspace surface
- the workbench is attached to the same truth observed by the orientation,
  runtime, and evidence surfaces
- the workbench remains part of the product rather than a detached generic
  assistant surface

### REQ-OM-WRK-002 - The workbench is selection-aware but not selection-bound

The operator workbench shall be aware of current selection and focus state
without being artificially restricted to only the currently selected object.

Acceptance Criteria
- current focus can be attached as working context where useful
- the operator can still ask workspace-wide questions or direct workspace-wide
  work while local focus exists
- the UI makes it clear when local context is being attached or emphasized

### REQ-OM-WRK-003 - Conversational and explicit controls share one operator-intent surface

The product shall treat conversational operations and explicit controls as
different front ends over the same operator-intent surface.

Acceptance Criteria
- deterministic actions and review actions can be invoked through either
  interaction mode
- invoking an action through conversation does not create a hidden workflow
  path or separate shadow state
- resulting truth updates flow through the same authoritative command, policy,
  and runtime mechanisms regardless of initiation path

### REQ-OM-WRK-004 - The workbench may drive UI focus intentionally

The operator workbench shall be able to drive UI focus when that helps the
operator stay oriented, provided the resulting changes remain explicit.

Acceptance Criteria
- the workbench may select objects, pages, lenses, or related surfaces on the
  operator's behalf
- focus changes remain visible in the shared world model
- the operator can override or redirect focus directly at any time

### REQ-OM-WRK-005 - Multi-participant interaction is supported

The operator workbench shall support multiple participants alongside the human
operator so coordination and reporting can happen inside one observable project
surface.

Acceptance Criteria
- the product can distinguish operator, worker, and system participants
- more than one worker may be present in the same workspace interaction surface
- participant identity remains visible enough to support attribution and later
  understanding

### REQ-OM-WRK-006 - Structured action and attachment are first-class workbench events

The workbench shall support structured action-bearing events rather than only
free-form prose.

Acceptance Criteria
- messages or turns may carry context attachments such as selected objects,
  evidence, topics, or sessions
- messages or turns may result in deterministic actions, review actions, or UI
  focus changes
- the product can distinguish free conversation from structured action-bearing
  events
- relevant action outcomes remain attributable and replayable
