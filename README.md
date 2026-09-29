# odd_manager

`odd_manager` is the operator-facing control-plane product for the OODD line.

It is a separate project boundary from:

- `abiogenesis`, which remains canonical GTL/ABG language and runtime truth
- `odd_sdlc`, which remains the emerging outcome-driven builder/domain line
  and is still in build
- `paperclip`, which remains a UX/control-plane reference rather than semantic
  authority

Start here:

- `stdo_odd_manager.json`
- `AGENTS.md`
- `CLAUDE.md`
- `specification/GOVERNANCE.md`
- `specification/REFERENCE_FRAME_BASIS.md`
- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/domain/DOMAIN_MODEL.md`
- `specification/GOALS.md`
- `specification/requirements/01-control-plane-boundary.md`
- `specification/analysis/ABG_5_0_COMPATIBILITY_BASELINE.md`
- `specification/requirements/16-abg-event-stream-compatibility.md`
- `build_tenants/common/design/ABG_EVENT_STREAM_COMPATIBILITY.md`
- `build_tenants/common/design/DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md`
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

- Product Definition Overlay: `stdo_odd_manager.json`
- operative distribution: the exact verified shared-store release selected by
  the Product Definition; inspect it with
  `stdo status --definition stdo_odd_manager.json --verify`
- `.genesis/docs/standards/` is historical provenance, not method authority
- project-owned application and frame surfaces:
  `specification/GOVERNANCE.md` and
  `specification/REFERENCE_FRAME_BASIS.md`
- applicable extension: STDO-UX through the released
  `DESIGN_MODULE_METHOD.md` and `UX_METHOD.md` members
- local conformance status: the bounded Product-to-proof, STDO-UX, and
  design-method prerequisite passed its exact deterministic validation bundle,
  was directly accepted on 2026-07-27, and has exhausted its growth authority
- governance status: T-041 is a clean candidate awaiting Product-owner
  acceptance; implementation authority does not follow from construction
- live Product status: `T-032` remains active only for the external
  Build/Assure steel thread; [T-046](.ai-workspace/tickets/active/T-046-align-odd-manager-with-abg5-rc1.md)
  owns current G-009 integration through the dedicated
  [ABG 5.0 RC1 alignment sprint](.ai-workspace/sprints/SPRINT-2026-09-29-abg5-rc1-alignment.md),
  with T-040 and T-042 through T-045 retaining their named responsibilities

Current upstream posture:

- retained qualification: exact `odd_glc` `0.1.0` Basic CLI proof on
  ABIogenesis `4.6.0-rc.3`
- selected alignment subjects: the current installed S6 lifecycle run and
  newer S7 stopped-source/fresh-invocation pair, pinned in T-046
- retained regression portfolio: six terminal Hello World streams plus
  non-terminal Data Mapper streams, bound in the compatibility baseline
- published substrate identity of the retained odd_glc portfolio:
  `@abiogenesis/typescript-tenant@4.6.0-rc.3`
- admitted development target: identity-first, proof-independent, bounded
  event-stream observation with late proof reconciliation
- Build and Assure: unavailable without published odd_glc carriers
- compatibility claim: no ABIogenesis 5.0 claim until an exact self-identified
  5.0 carrier passes the installed causal-path portfolio
