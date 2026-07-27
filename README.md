# odd_manager

`odd_manager` is the operator-facing control-plane product for the OODD line.

It is a separate project boundary from:

- `abiogenesis`, which remains canonical GTL/ABG language and runtime truth
- `odd_sdlc`, which remains the emerging outcome-driven builder/domain line
  and is still in build
- `paperclip`, which remains a UX/control-plane reference rather than semantic
  authority

Start here:

- `AGENTS.md`
- `CLAUDE.md`
- `.genesis/docs/standards/SPEC_METHOD.md`
- `.genesis/docs/standards/ODD_METHOD.md`
- `.genesis/docs/standards/DESIGN_MODULE_METHOD.md`
- `.genesis/docs/standards/UX_METHOD.md`
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/domain/DOMAIN_MODEL.md`
- `specification/GOALS.md`
- `specification/requirements/01-control-plane-boundary.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- `.genesis/docs/LLM_GTL_APP_BUILDER_GUIDE.md`

Current repo posture:

- the project is initialized with the ABG/GTL substrate and is governed by its
  own `odd_manager` specification boundary
- the design package lives under `build_tenants/common/design/`
- the shared design package publishes the shell, inspector, board, and
  graph-workspace visual language that future UI carriers must preserve
- the active UI implementation carrier is `build_tenants/react_vite/`
- `odd_manager` observes `odd_sdlc` and other `odd_` products through their
  published GTL/ABG ledgers, catalogs, projections, and compatible domain packs

Governance basis:

- selected method: STDO `v2.2.1`
- release commit: `8ad868eb0c9a3bdd075ff17ec4f7923d5ceec1cf`
- standards member-set digest:
  `df1064dea1e1926436a3123280071a5082c5dc03b8418d07e46e839cbed20aed`
- operative installed distribution: `.genesis/docs/standards/`
- applicable extension: STDO-UX through the released
  `DESIGN_MODULE_METHOD.md` and `UX_METHOD.md` members
- local conformance status: the bounded Product-to-proof, STDO-UX, and
  design-method prerequisite passed its exact deterministic validation bundle,
  was directly accepted on 2026-07-27, and has exhausted its growth authority
- live ticket status: `T-032` remains active only for the external
  Build/Assure steel thread and explicit functional scenario gaps

Current upstream qualification:

- exact subject: `odd_glc` `0.1.0` on ABIogenesis `4.6.0-rc.3`
- admitted operation: immutable read-only run/proof observation
- Build and Assure: unavailable without published odd_glc carriers
- compatibility range: exact release pair only; no general 4.6 or
  ABIogenesis 5 claim
