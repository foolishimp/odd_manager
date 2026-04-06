# Tenant Registry

`build_tenants/` is the project-owned realization root beneath the shared project specification.

Use it for one-to-many independent implementations of the same constitutional `specification/`.

This file is the canonical registry surface for the project's build tenants.

The constitutional `specification/` surface is singleton project truth.

`build_tenants/` is many-valued realization structure beneath that truth.

## Structure

- `common/` holds shared realization/design law adopted across more than one tenant.
- `<family>/<variant>/` holds one concrete tenant realization.

## Registry

Suggested lifecycle states include:

- `Planned`
- `In Development`
- `Paused`
- `Released`
- `Deprecated`

| Entry | Kind | Path | Status | Notes |
| --- | --- | --- | --- | --- |
| `common` | shared root | `build_tenants/common/` | Active | Shared realization law across tenants |
| `odd_manager/python` | variant | `build_tenants/odd_manager/python/` | Planned | Starter tenant scaffold seeded by installer; not the chosen UI carrier |
| `react_vite` | variant | `build_tenants/react_vite/` | In Development | Active operator UI carrier preserving the established shell and graph styling while shifting semantics to `odd_manager` |
