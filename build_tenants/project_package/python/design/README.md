# Tenant Design

Tenant-local design surfaces live here.

This scaffold is not an active realization in `stdo_odd_manager.json` and has
no current implementation authority. Before reactivation, declare it as a
build tenant in the Product Definition, resolve the selected design-method
entrypoint through that definition, and explicitly adopt any shared law from
`build_tenants/common/design/`.

## Adopted Common Surfaces

List the exact shared surfaces from `build_tenants/common/` that this tenant
adopts.

- Shared design law under `build_tenants/common/design/`
- Shared qualification law under `build_tenants/common/qualification/` when it
  constrains tenant-local tests or evidence

If no common surface is currently adopted, say that explicitly.

## F_P Customization

Use `design/fp/` to describe tenant-local F_P tuning for bounded constructive turns.
