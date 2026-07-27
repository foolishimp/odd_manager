# Tenant Design

Tenant-local design surfaces live here.

Use `.genesis/docs/standards/` as the governing method reference and `build_tenants/common/design/` for shared realization law.

## Adopted Common Surfaces

List the exact shared surfaces from `build_tenants/common/` that this tenant
adopts.

- Shared design law under `build_tenants/common/design/`
- Shared qualification law under `build_tenants/common/qualification/` when it
  constrains tenant-local tests or evidence

If no common surface is currently adopted, say that explicitly.

## ADRs

Tenant-local Architecture Decision Records live under `design/adrs/`.

ADRs are the durable design memory layer per `SPEC_METHOD.md` `## ADR Conventions` and `## ADR Folder Convention`. Use `design/adrs/ADR-NNN-short-slug.md` as the default filename pattern; namespace-prefixed local IDs are permitted when this tenant's design surface already uses them.

Cross-tenant decisions belong under `build_tenants/common/design/adrs/`, not here.

See `design/adrs/README.md` for the full ADR conventions and `design/adrs/ADR_TEMPLATE.md` for the canonical ADR shape.

## F_P Customization

Use `design/fp/` to describe tenant-local F_P tuning for bounded constructive turns.
