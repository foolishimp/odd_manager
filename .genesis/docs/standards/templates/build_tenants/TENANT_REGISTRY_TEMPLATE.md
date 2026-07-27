# Tenant Registry

`build_tenants/` is the project-owned realization root beneath the shared project specification.

Use it for one-to-many independent implementations of the same constitutional `specification/`.

This file is the canonical registry surface for the project's build tenants.

The constitutional `specification/` surface is singleton project truth.

`build_tenants/` is many-valued realization structure beneath that truth.

## Structure

- `common/` holds shared realization/design law adopted across more than one tenant.
- `<family>/<variant>/` holds one concrete tenant realization. The `<family>/<variant>` shape is the recommended scaffold; single-label tenant paths such as `<variant>/` are also lawful per `SPEC_METHOD.md` `## ADR Folder Convention`. Pick one shape per project and stay with it.

## Registry

Suggested lifecycle states include:

- `Planned`
- `In Development`
- `Paused`
- `Released`
- `Deprecated`

| Entry | Kind | Path | Status | Notes |
| --- | --- | --- | --- | --- |
| `common` | shared root | `build_tenants/common/` | In Development | Shared realization law across tenants |
| `<family>/<variant>` | variant | `build_tenants/<family>/<variant>/` | Planned | Replace with the current tenant candidates for this project |

Record the currently active realization focus explicitly in the table notes or an adjacent short section when more than one tenant exists.
