# Session Workspace And Provider Adapters

**Family**: `REQ-OM-SES-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/PRODUCT.md`, `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

### REQ-OM-SES-001 - The product provides a durable session workspace

The product shall provide a durable session workspace for execution-oriented
work rather than disposable anonymous shells.

Acceptance Criteria
- sessions can remain alive across UI refresh, reconnect, or temporary
  operator absence where the backend session remains valid
- sessions belong to the selected managed workspace rather than a browser-local
  widget
- operators can reopen and continue existing sessions rather than only creating
  new ones

### REQ-OM-SES-002 - Multiple labeled sessions are supported

The session workspace shall support multiple concurrent labeled sessions inside
one managed workspace.

Acceptance Criteria
- the operator can create more than one session for the same workspace
- session labels remain visible enough to distinguish purpose, owner, or
  participant identity
- the session workspace does not force all execution-oriented work through one
  monolithic stream

### REQ-OM-SES-003 - Session history is preserved and manageable

The product shall preserve rolling session history on disk and treat that
history as a managed asset.

Acceptance Criteria
- each session can retain a rolling output buffer beyond the current browser
  attachment
- retention is bounded by explicit budget rather than unbounded growth
- the operator can tell whether they are looking at live stream, replayed
  history, or both
- session history can later be promoted into durable record with provenance

### REQ-OM-SES-004 - Sessions can attach to and detach from live rooms without losing identity

The product shall let active rooms attach existing sessions and later detach
them without destroying their independent identity.

Acceptance Criteria
- a live room can attach one or more existing sessions from the workspace pool
- attached sessions remain independently workable from the session workspace
- detaching a session does not erase its history, label, or identity
- operators can tell which sessions are attached to which room

### REQ-OM-SES-005 - Sharing from sessions into rooms is explicit and bounded

The product shall require explicit bounded sharing from a session into a live
room rather than treating raw session output as ambient room traffic.

Acceptance Criteria
- the operator or worker can share a tail, selection, summary, or defined
  command result from a session into a room
- the scope of a share can be bounded by range, chunk, or summary
- shared excerpts retain session provenance and relevant room context
- room readability remains manageable when multiple sessions are attached

### REQ-OM-SES-006 - Provider adapters can provision named participants over the generic session substrate

The product shall support optional provider adapters that provision named
participants over the generic session substrate.

Acceptance Criteria
- an adapter can provision one or more participants for the workspace
- an adapter-provided participant can be associated with one or more durable
  sessions without making the substrate provider-specific
- the operator can understand which session belongs to which participant

### REQ-OM-SES-007 - The generic session substrate remains separate from provider-specific behavior

The product shall keep the session substrate generic while placing
provider-specific launch, capability, and reply behavior behind an optional
adapter boundary.

Acceptance Criteria
- the session substrate can run CLI-capable tools without requiring them to be
  modeled as first-class product types
- provider-specific behavior is introduced through an adapter layer rather than
  hardcoded into the generic session pool
- transport and backend choices do not remove the product's control over
  lifecycle context, promotion, attribution, or replay

### REQ-OM-SES-008 - Existing sessions can bootstrap room-capable participants

The product shall let an existing session bootstrap a provider-backed room
participant without losing ordinary shell usability.

Acceptance Criteria
- an existing session can launch a provider-backed participant for a selected
  topic or room
- bootstrap can be initiated from product controls rather than requiring manual
  environment assembly
- the launched participant remains attributable to the underlying session
- the session remains a durable generic shell before and after the participant
  process exits

### REQ-OM-SES-009 - Stream injection is bootstrap-only for provider adapters

The product shall limit terminal stream injection to one-shot bootstrap or
operator-directed shell input rather than using it as the primary live-room
delivery transport.

Acceptance Criteria
- a product control may inject a bounded launch command into a session to start
  a provider adapter
- ongoing room delivery and reply flow through the provider adapter boundary
  rather than raw terminal stdin
- the room model does not depend on shell output mirroring to determine whether
  a participant received a room message
