# Common Tenant ADRs

This folder holds the Architecture Decision Records that govern realization across two or more build tenants.

ADRs at this surface are the durable design memory for cross-tenant realization choices. They are the form of `Design` defined in `SPEC_METHOD.md` `## ADR Conventions` — not a separate constitutional layer above design, and not a second requirement surface.

## When to write a cross-tenant ADR

Write an ADR here when the decision:

- governs more than one build tenant under this project
- chooses a concrete realization that satisfies one or more requirements declared under `specification/requirements/` and that requirement applies across tenants
- introduces a structural or interface choice that tenant-local realizations must comply with
- supersedes a prior cross-tenant decision

If the decision governs only one build tenant, write the ADR at that tenant's `build_tenants/<tenant-path>/design/adrs/` instead. The `<tenant-path>` is one or more segments per `SPEC_METHOD.md` `## ADR Folder Convention`.

If the decision changes constitutional truth (intent / product / requirement), it does not belong in an ADR — re-enter through `SPEC_METHOD.md` triage and reprice the appropriate constitutional layer first.

## File shape

Filename: `ADR-<local-id>-short-slug.md`

The local ID is unique within this `adrs/` directory. Numeric IDs (`ADR-001-...`, `ADR-002-...`) are the default. Namespace-prefixed IDs are allowed when this project's common design surface already uses them; pick one convention and stay with it.

Numbering is local to this directory. Cross-tenant ADR IDs do not share numbering with tenant-local ADR IDs under `build_tenants/<tenant-path>/design/adrs/`.

Each ADR carries the frontmatter required by `SPEC_METHOD.md` `## ADR Conventions`:

- `Status:` — `active` | `superseded` | `retired`
- `Implements:` — REQ-* IDs this ADR makes true
- `Derives from:` — INT-* or strategy document that motivated the decision
- `Supersedes:` — prior ADR or doctrine this replaces (when applicable)
- `Superseded by:` — successor ADR (when `Status:` is `superseded`)
- `Retained special case:` — when earlier behavior is intentionally retained as a special case (when applicable)

See `ADR_TEMPLATE.md` in this directory for the canonical body shape.

## Boundary rule

One ADR per decision boundary, not per requirement file. Cross-tenant scope is the constraint that distinguishes this folder from a tenant-local one — the decision must govern more than one tenant. If the scope narrows during implementation, move the ADR to the relevant tenant's `design/adrs/` and record the move in the supersession chain.

## Supersession

When a later ADR supersedes this one, set `Status: superseded` and `Superseded by:` to the successor ADR's local ID, and leave the file in place. ADRs are append-only history; do not delete superseded ADRs unless they are being explicitly retired.

## Optional registry

A `REGISTRY.md` index alongside the ADR files is recommended for tooling and review but not required. If you maintain one, treat it as a read model over the ADR files; the ADR files remain the accepted design authority.
