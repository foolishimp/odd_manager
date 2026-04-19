# T-003 Establish Structured Requirement Inventory Observer Contract

- id: T-003
- type: feature
- status: active
- goal: control-surface-reprice
- change_class: product_reprice
- reentry: product -> requirements -> design -> implementation
- priority: high
- created_at: 2026-04-14
- updated_at: 2026-04-14

## Context

`data_mapper.test32` exposed a deeper observer-contract defect in `odd_manager`.
The immediate parser bug is now patched, but the manager is still deriving
requirement truth primarily by scraping markdown publication shapes from the
workspace.

That is too weak for a canonical observer surface.

`odd_sdlc` is publishing valid requirement information in multiple shapes:

- authored requirement blocks
- generated tabular inventory indexes
- closure/evidence registers when available

`odd_manager` should not treat markdown grammar as the primary truth source when
the product depends on accurate requirement counts, posture, evidence links, and
drilldown surfaces.

The method-correct direction is one structured requirement inventory /
requirement-closure observer contract that the producer publishes and the
observer consumes as the primary truth surface. Markdown should remain a human
publication surface, not the only durable machine-readable interface.

## Acceptance

- `odd_manager` observes one canonical structured requirement inventory surface
  as the primary source for requirement projection.
- The structured observer contract carries at least:
  - requirement id
  - title
  - family / family title
  - priority
  - type
  - status / closure posture
  - traces
  - linked authority / implementation / test evidence refs
- Markdown parsing is reduced to fallback or enrichment behavior rather than
  being the primary requirement truth path.
- Empty or missing closure/evidence registers are surfaced explicitly as an
  observer gap rather than silently collapsing requirement posture to shallow
  defaults.
- `odd_manager` has direct regression coverage for the structured inventory path
  and for any remaining markdown fallback path.

## Links

- incident workspace: `/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper.test32`
- runtime adapter: `build_tenants/react_vite/runtime/odd_manager_world.py`
- tests: `build_tenants/react_vite/runtime/tests/test_odd_manager_world.py`
- methodology: `/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_METHOD.md`
- spec guide: `/Users/jim/src/apps/specification_methodology/specification/standards/SPEC_GUIDE.md`
- ticket method: `/Users/jim/src/apps/specification_methodology/specification/standards/TICKET_METHOD.md`
