# Tenant ADRs

This folder holds the Architecture Decision Records that govern this build tenant.

ADRs are the durable design memory for tenant-local realization choices. They are the form of `Design` defined in `SPEC_METHOD.md` `## ADR Conventions` — not a separate constitutional layer above design, and not a second requirement surface.

## When to write a tenant-local ADR

Write an ADR here when the decision:

- governs only this build tenant (the path segment(s) under `build_tenants/` that identify this tenant — e.g., `<family>/<variant>` or a single-label tenant path)
- chooses a concrete realization that satisfies one or more requirements declared under `specification/requirements/`
- introduces a structural or interface choice future maintainers will need to know about
- supersedes a prior tenant-local decision

If the decision applies across two or more tenants, write the ADR at `build_tenants/common/design/adrs/` instead.

If the decision changes constitutional truth (intent / product / requirement), it does not belong in an ADR — re-enter through `SPEC_METHOD.md` triage and reprice the appropriate constitutional layer first.

## File shape

Filename: `ADR-<local-id>-short-slug.md`

The local ID is unique within this `adrs/` directory. Numeric IDs (`ADR-001-...`, `ADR-002-...`) are the default. Namespace-prefixed IDs (`ADR-GM-005-...`) are allowed when this tenant's design surface already uses them; pick one convention and stay with it.

Each ADR carries the frontmatter required by `SPEC_METHOD.md` `## ADR Conventions`:

- `Status:` — `active` | `superseded` | `retired`
- `Implements:` — REQ-* IDs this ADR makes true
- `Derives from:` — INT-* or strategy document that motivated the decision
- `Supersedes:` — prior ADR or doctrine this replaces (when applicable)
- `Superseded by:` — successor ADR (when `Status:` is `superseded`)
- `Retained special case:` — when earlier behavior is intentionally retained as a special case (when applicable)

See `ADR_TEMPLATE.md` in this directory for the canonical body shape.

## Boundary rule

One ADR per decision boundary, not per requirement file. The ADR question is: *what design choice makes these acceptance criteria true?* Multiple requirements may share one ADR; one requirement may be implemented by multiple ADRs.

## Supersession

When a later ADR supersedes this one, set `Status: superseded` and `Superseded by:` to the successor ADR's local ID, and leave the file in place. ADRs are append-only history; do not delete superseded ADRs unless they are being explicitly retired.

## Optional registry

A `REGISTRY.md` index alongside the ADR files is recommended for tooling and review but not required. If you maintain one, treat it as a read model over the ADR files; the ADR files remain the accepted design authority.
