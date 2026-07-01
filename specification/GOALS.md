# Goals

**Status**: Active
**Date**: 2026-07-01
**Derived From**: `specification/INTENT.md`, `specification/PRODUCT.md`

## Position

Goals focus one bounded wave of work.

They are narrower than intent and shorter-lived than product definition.

They keep the current repricing and observation-contract work oriented without
turning temporary implementation choices into accidental law.

## Current Goals

### G-001 - Establish the ABG 4.2 system observation contract

Make ABG/GTL system truth the manager-owned observation core before any
domain-specific overlay is applied.

**Orients**:
- ABG runtime event truth and replay-derived projections
- ABG 4.2 system ledgers and catalogs
- registry entries, graph-function selections, node-type satisfaction, payload
  facts, and construction-action catalog entries
- explicit unsupported-domain state when a domain overlay is absent

### G-002 - Keep domain UI packs separate from the core system projection

Keep manager-owned GTL/ABG pages cross-domain while admitting domain-specific
surfaces only through compatible domain UI packs.

**Orients**:
- core runtime, history, provenance, evidence, and traceability pages
- explicit compatibility state for `odd_sdlc`, `odd_world_model`, and future
  `odd_*` packs
- no domain package redefining ABG run, graph-call, frame, continuation, or
  event truth

### G-003 - Preserve delivery entry lenses as domain overlays

Preserve requirements-first and process-first entry lenses without making their
current `odd_sdlc` shape permanent manager ontology.

**Orients**:
- `Requirements View` over compatible domain requirement and proof overlays
- `Process View` over ABG system projection plus compatible domain process
  overlays
- honest absence or incompatibility state where a selected project lacks a
  supported domain pack

### G-004 - Keep the manager workspace free of legacy local odd_sdlc runtime authority

Prevent the manager source project from being defined by the removed
workspace-local `odd_sdlc` Python runtime install or its generated local
read models.

**Orients**:
- no active runtime contract under `.genesis/odd_sdlc/`
- no live manager authority from `.ai-workspace/runtime/odd_sdlc-*`
- local bootstrap text names `odd_manager` as the product boundary
- observed `odd_sdlc` projects remain external managed products, not the
  manager workspace runtime
