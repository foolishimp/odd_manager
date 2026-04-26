# Inspection, Governance, And Evidence

**Family**: `REQ-OM-INS-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`

### REQ-OM-INS-001 - Supervisory information is organized into explicit categories

`odd_manager` shall organize supervisory information into explicit categories so
operators do not have to infer product state from overlapping generic panels.

Acceptance Criteria
- the product distinguishes posture, orientation, runtime, continuations,
  policy, evidence, provenance, and local context
- those categories remain traceable to the same underlying world
- operators can answer ordinary supervisory questions without reading raw logs
  first

### REQ-OM-INS-002 - Information categories have primary owners

The product shall assign primary page or panel owners for each information
category so repeated facts remain derived rather than independently re-authored.

Acceptance Criteria
- the home surface owns posture
- the orientation surface owns topology and focus selection
- runtime surfaces own run, call, and frame inspection
- continuation surfaces own open obligation management
- evidence and policy surfaces own proof, closure, and governance detail
- provenance surfaces own event-derived narrative and lineage

### REQ-OM-INS-003 - Local inspection explains why the selected object exists

The first layer of local inspection shall explain the selected object in mandate
terms rather than leading with raw implementation detail.

Acceptance Criteria
- the first explanation layer states what the selected object is for
- the first explanation layer states why the object matters to current managed
  outcomes or closure
- raw ids, evaluator names, and lower-level evidence remain reachable as deeper
  layers rather than replacing the narrative layer

### REQ-OM-INS-004 - Local inspection explains route, runtime, and consequence

The selected-object view shall explain current local state, route consequence,
and current runtime carriage where available.

Acceptance Criteria
- the inspection view can show relevant upstream and downstream consequence
- the inspection view can show role, worker, and backend identities when
  available
- the inspection view can explain what is blocking, gating, enabling, or
  carrying the selected object in plain operational language

### REQ-OM-INS-005 - Governance decisions are visible, contextualized, and attributable

The product shall surface governance decisions as visible, contextualized, and
attributable operator work rather than burying them in logs or detached helpers.

Acceptance Criteria
- open governance decisions appear in a dedicated reviewable surface
- each decision view includes the relevant object, criteria, evidence context,
  and provenance
- resulting operator actions remain attributable and replayable

### REQ-OM-INS-006 - Evidence and raw detail are progressively disclosed

The product shall use progressive disclosure so operators can move from meaning
to evidence and raw detail without losing context.

Acceptance Criteria
- the first layer of detail presents narrative explanation
- supporting evidence, event facts, and raw detail remain reachable from the
  same local context
- lawful actions remain adjacent to the context and evidence that justify them
- ordinary supervisory use does not force raw evidence to become the first
  explanation layer
