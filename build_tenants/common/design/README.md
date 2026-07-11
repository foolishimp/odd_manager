# Common Tenant Design

Shared realization design for this project lives here.

Use this surface only for design law that genuinely applies across multiple
build tenants.

Current canonical design artifacts:

- `DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md`
- `AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`
- `ASSET_SURFACE_AND_TOPOLOGY.md`
- `adrs/ADR-001-canonical-ux-functions-and-projection-instances.md`
- `adrs/ADR-002-activity-bar-navigators-and-viewer-tabs.md`

`ODD_MANAGER_DASHBOARD.md` is superseded design history. It does not define the
live developer-control capability architecture.

This is the correct home for the initial dashboard package because the product
boundary and information architecture must harden before tenant-local UI
implementation begins.
