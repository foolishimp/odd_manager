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

State the situation that demands a decision. Cite the requirements or strategy material that frames the choice. Keep this section to the constraints, not the answer.

## Decision

State the chosen design in present tense. One decision per ADR — split into multiple ADRs if the choice covers more than one decision boundary.

Name concrete mechanisms when requirements name them. If a requirement names an operational mechanism, this ADR must name that mechanism too.

## Consequences

Describe what becomes true once this decision is in force:

- positive consequences the decision enables
- negative consequences or trade-offs the decision accepts
- downstream design or implementation work the decision requires
- proof or qualification surfaces affected

## Alternatives Considered

List the alternatives that were on the table, with one or two sentences on why each was rejected. Be specific enough that a future maintainer can recover the reasoning.

## Notes

Optional. Use for cross-references, related ADRs, or implementation hints that do not belong in the constitutional sections above. Do not put new requirements here — ADRs are durable design memory, not a second requirement surface.
