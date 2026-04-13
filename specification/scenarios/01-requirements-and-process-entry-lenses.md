# Requirements And Process Entry Lenses

**Status**: Active
**Derives From**:
- `specification/PRODUCT.md`
- `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

## Purpose

This scenario bundle proves the operational meaning of the delivery-oriented
entry lenses.

It tests that `odd_manager` can present one shared project reality through both
a requirement-first and a process-first framing without creating dead-end
widgets, disconnected truth, or rival work-tracking authority.

## Scenario 1 - BA inspects one requirement end to end

Actor: business analyst or product manager

Sequence
- open `Requirements View`
- search or filter the requirement explorer
- select one human-readable requirement
- inspect its summary and acceptance material
- drill into linked design surfaces
- drill into linked implementation surfaces such as modules or code carriers
- inspect testcase authority and any available test execution results
- inspect linked tickets or bugs
- inspect linked OddBoard discussion without confusing comments with ticket
  status authority

Expected outcomes
- the operator stays inside one requirement-framed workbench
- each visible object and total can open richer detail or an authoritative
  source surface
- the operator can determine whether the requirement is specified, implemented,
  proved, blocked, or still open

## Scenario 2 - Scrum master starts from process activity

Actor: scrum master or delivery lead

Sequence
- open `Process View`
- start from build activity, process flow, or execution posture
- select the relevant process focus
- inspect the linked requirement, design, implementation, proof, ticket, and
  discussion surfaces through the shared widget family
- compare the process-selected view with the corresponding requirement-selected
  view for the same underlying concern

Expected outcomes
- `Process View` acts as a distinct entry lens rather than as a duplicate page
- the shared widget family remains recognizable and reusable across both entry
  lenses
- process-first filtering does not create a second truth model or a second
  ticket/comment authority model

## Significant Paths

- success path: both entry lenses can reach the same underlying requirement,
  design, implementation, proof, and work-tracking surfaces
- authority path: tickets remain durable work authority while comments remain
  discussion/publication
- drilldown path: visible totals and rows remain drillable rather than dead-end
  text
- divergence path: entry-lens-specific filtering changes framing without
  changing the underlying object truth
