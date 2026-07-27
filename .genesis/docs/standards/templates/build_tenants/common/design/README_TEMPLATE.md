# Common Tenant Design

Shared realization design for this project lives here.

Use this surface only for design law that genuinely applies across multiple build tenants.

## ADRs

Cross-tenant Architecture Decision Records live under `design/adrs/`.

ADRs at this surface govern decisions that apply to two or more build tenants. Tenant-local decisions belong under `build_tenants/<tenant-path>/design/adrs/`, not here.

ADR conventions and frontmatter shape are defined in `SPEC_METHOD.md` `## ADR Conventions` and `## ADR Folder Convention`. See `design/adrs/README.md` for the full conventions and `design/adrs/ADR_TEMPLATE.md` for the canonical ADR shape.

Numbering is local to this `adrs/` directory; cross-tenant ADR IDs do not share numbering with tenant-local ADR IDs.
