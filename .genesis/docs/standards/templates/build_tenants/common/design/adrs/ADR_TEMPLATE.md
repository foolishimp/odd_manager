# ADR-<local-id> <Short Decision Title>

| Field | Value |
|-------|-------|
| `Status:` | `active` |
| `Implements:` | `REQ-*` IDs this ADR makes true |
| `Derives from:` | `INT-*` or strategy/design doc that motivated the decision |
| `Supersedes:` | Prior ADR or doctrine this replaces, or `none` |
| `Superseded by:` | Successor ADR if this one becomes `superseded`, otherwise omit |
| `Retained special case:` | When earlier behavior is intentionally retained, or `none` |

## Context

State the cross-tenant situation that demands a decision. Cite the requirements or strategy material that frames the choice. Identify the build tenants this decision is intended to govern. Keep this section to the constraints, not the answer.

## Decision

State the chosen design in present tense. One decision per ADR — split into multiple ADRs if the choice covers more than one decision boundary.

Name concrete mechanisms when requirements name them. If a requirement names an operational mechanism, this ADR must name that mechanism too.

## Consequences

Describe what becomes true once this decision is in force across the tenants it governs:

- positive consequences the decision enables
- negative consequences or trade-offs the decision accepts
- downstream design or implementation work the decision requires in each affected tenant
- proof or qualification surfaces affected
- migration cost for tenants that previously diverged from the decision

## Alternatives Considered

List the alternatives that were on the table, with one or two sentences on why each was rejected. Be specific enough that a future maintainer can recover the reasoning. Note any alternative that was kept lawful at the tenant-local level.

## Notes

Optional. Use for cross-references, related ADRs in tenant-local `design/adrs/` directories, or implementation hints that do not belong in the constitutional sections above. Do not put new requirements here — ADRs are durable design memory, not a second requirement surface.
