# Specification Proposal And Change Control

**Family**: `REQ-OM-SPC-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`, `specification/GOALS.md` G-006

### REQ-OM-SPC-001 - Prompting produces an attributable specification proposal

Specification-tuning interaction shall produce a Specification Proposal rather
than directly mutating constitutional source.

Acceptance Criteria
- the proposal identifies Project, basis revision, participant, time, attached
  context, and named authority surfaces
- generated content remains candidate truth until accepted
- the developer can distinguish conversation, proposed change, validation
  result, and accepted product truth
- prompt and explicit-control entry paths produce the same proposal carrier

### REQ-OM-SPC-002 - Proposal context is explicit and bounded

The product shall show what local and Project-wide context is attached to a
specification interaction.

Acceptance Criteria
- selected requirement, design, ticket, evidence, run, gate, asset, or file
  context is named when attached
- local focus does not silently prevent a Project-wide question
- the developer can add, remove, or replace attached context before generation
- proposal lineage preserves the context actually used rather than current UI
  selection at a later time

### REQ-OM-SPC-003 - Proposed change is visible as a structured diff

The product shall present the exact candidate change and affected authority
surfaces before acceptance.

Acceptance Criteria
- additions, removals, and modifications are distinguishable
- unchanged surrounding context is available where needed for judgment
- affected requirements, scenarios, design, tickets, or implementation surfaces
  are identified when deterministically known
- proposal presentation does not hide generated files or combine unrelated
  changes into an unreviewable aggregate

### REQ-OM-SPC-004 - Deterministic validation precedes acceptance

A proposal shall run the applicable deterministic specification and repository
checks before it can be accepted.

Acceptance Criteria
- required validation checks and their results are visible
- deterministic failure cannot be overridden by agent confidence
- human approval does not convert a deterministic failure into passing truth
- unavailable validation is explicit and cannot be represented as success

### REQ-OM-SPC-005 - Acceptance and rejection are explicit attributable actions

The developer shall explicitly accept, reject, or request refinement of a
Specification Proposal.

Acceptance Criteria
- acceptance records actor, proposal identity, basis revision, validation
  basis, resulting revision, and changed surfaces
- rejection leaves constitutional source unchanged and records the decision
- refinement creates a traceable successor or revision of the proposal
- conversational and explicit controls invoke the same acceptance, rejection,
  or refinement commands

### REQ-OM-SPC-006 - Stale proposals fail closed

The product shall not apply a proposal whose authority basis has changed
without explicit reconciliation.

Acceptance Criteria
- revision or content mismatch is detected before acceptance
- stale proposals are not silently rebased or partially applied
- the developer can inspect the mismatch and request regeneration or explicit
  reconciliation
- a reconciled proposal receives a new attributable basis and validation result

### REQ-OM-SPC-007 - Accepted proposals update readiness through admitted truth

After accepted specification change, affected readiness and downstream posture
shall be recomputed from admitted source rather than patched in the view.

Acceptance Criteria
- the resulting Project revision becomes the visible basis for later builds
- affected requirement, scenario, design, proof, and ticket posture can be
  refreshed or invalidated explicitly
- old readiness remains attributable to its prior revision
- no capability infers acceptance merely because a diff disappeared from view

### REQ-OM-SPC-008 - Proposal history remains reviewable

The product shall preserve a bounded durable record of proposed, accepted,
rejected, stale, and superseded specification proposals.

Acceptance Criteria
- proposal history is scoped to its Project and source revision
- participant and action attribution remain visible
- accepted source remains constitutional authority while proposal history
  remains commentary/workflow evidence
- retention and truncation are explicit rather than silent
