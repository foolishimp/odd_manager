# odd_manager

`odd_manager` is the operator-facing control-plane product for the OODD line.

It is a separate project boundary from:

- `abiogenesis`, which remains canonical GTL/ABG language and runtime truth
- `odd_method`, which remains the emerging outcome-driven builder/domain line
  and is still in build
- `paperclip`, which remains a UX/control-plane reference rather than semantic authority

Start here:

- `AGENTS.md`
- `CLAUDE.md`
- `.genesis/docs/standards/SPEC_METHOD.md`
- `.genesis/docs/standards/GRAPH_METHOD.md`
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/domain/DOMAIN_MODEL.md`
- `specification/GOALS.md`
- `specification/requirements/01-control-plane-boundary.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- `.genesis/docs/LLM_GTL_APP_BUILDER_GUIDE.md`

Current repo posture:

- the project is initialized with the ABG installer
- the design package lives under `build_tenants/common/design/`
- the shared design package publishes the shell, inspector, board, and
  graph-workspace visual language that future UI carriers must preserve
- the installer-seeded `build_tenants/odd_manager/python/` surface is starter scaffold only
- the active UI implementation carrier is `build_tenants/react_vite/`
