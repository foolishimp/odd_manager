# Tenant Root

This root holds one concrete build tenant for the project.

Keep tenant-local design, tooling, traces, and implementation here unless they
are explicitly promoted to `build_tenants/common/`.

Current status:

- this tenant exists because the ABG installer seeds a standard starter carrier
- it is not the chosen operator UI implementation path
- the current design package proposes `build_tenants/react_vite/` as the target
  UI carrier after design acceptance
