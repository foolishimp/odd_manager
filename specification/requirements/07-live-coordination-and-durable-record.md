# Live Coordination And Durable Record

**Family**: `REQ-OM-COL-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/PRODUCT.md`, `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

### REQ-OM-COL-001 - Live coordination remains distinct from durable record

The product shall distinguish live coordination surfaces from durable project
record rather than forcing all interchange into one tool.

Acceptance Criteria
- the product can support live coordination without requiring durable record as
  the only interaction mechanism
- the product can support durable project record without requiring operators to
  reconstruct it from ephemeral activity by hand
- live and durable surfaces remain scoped to the same managed workspace world

### REQ-OM-COL-002 - Durable topics are canonical persistent discussion objects

The product shall provide durable topics as the canonical persistent discussion,
decision, and blocker objects.

Acceptance Criteria
- a durable topic can exist independently of any active live room
- a durable topic can be bound to a managed object or created as a workspace
  topic
- topic identity survives reload, reopen, and later review

### REQ-OM-COL-003 - Live rooms open over durable topics and attached assets

The product shall provide live rooms that operate over a persistent topic and
an explicit attached-asset set.

Acceptance Criteria
- a live room can be opened over an existing topic
- the room retains a stable reference back to its durable topic
- the room can accumulate additional attached assets without destroying the
  primary topic identity
- ending live room activity does not destroy the durable topic

### REQ-OM-COL-004 - Promotion and reattachment preserve provenance

The product shall support controlled movement of selected material between live
coordination and durable record while preserving provenance.

Acceptance Criteria
- selected excerpts from live interaction can be promoted into durable record
- durable topic material can be reattached into live room or workbench context
  where useful
- promoted or reattached content retains enough source, participant, workspace,
  and time context to remain understandable

### REQ-OM-COL-005 - Room context includes attached assets and visible participants

The live room model shall carry explicit attached assets and visible
participants rather than leaving room context implicit.

Acceptance Criteria
- a room can show its primary topic and additional attached assets
- a room can show which participants are currently attached
- attached assets remain identifiable without forcing the room to proxy all
  asset content
- room context can evolve without losing durable topic continuity

### REQ-OM-COL-006 - Direct worker-to-asset work remains visible and attributable

The product shall let live room coordination direct workers toward specific
attached assets and resulting updates without losing operator visibility.

Acceptance Criteria
- a participant can be directed toward a named attached asset inside a room
- room work can result in controlled topic updates, asset updates, or promoted
  records
- resulting updates remain attributable enough for replay and later review

### REQ-OM-COL-007 - Room delivery uses participant membership and receipt state

The live room model shall deliver room activity through explicit participant
membership and receipt state rather than through ambient terminal stream
injection.

Acceptance Criteria
- a participant can join or leave a room without destroying the underlying
  session substrate
- room delivery can be resumed from participant receipt state rather than only
  from terminal scrollback
- room fan-out can target all joined participants without requiring raw stdin
  injection into every attached shell
- the canonical room history remains the authoritative mailbox surface for live
  coordination
