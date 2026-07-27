---
kind: authority_compression_asset
asset_ref: authority-compression://stdo/ux-method/v1
source_ref: ../UX_METHOD.md
source_digest: a7cca45d6064d7fc864edd86e3913c9462cfe2a52ae3d1519c6a031713dccae7
compression_profile: prompt_authority_compact_v1
target_prompt_families:
  - transform
  - evaluate_design_depth
  - evaluate_review_grade
generated_by: codex
generated_at: 2026-06-06
stale_if_source_digest_changes: true
---

# UX_METHOD Compressed Authority

## Governing Claim

UX surfaces are projection and control surfaces. The view does not own
continuation, product truth, or hidden constructive work.

## Process Model

Use the Elm Architecture discipline:

`State -> View`

`Msg + State -> State + Cmd`

`Cmd -> effect membrane -> Msg`

## Prime Rules

- UX state derives from admitted product/runtime projections.
- Product-truth-changing `Msg` variants map to admitted carriers, graph
  functions, runtime commands, or typed product contracts.
- View-local messages are limited to local view concerns such as expansion,
  sorting, filtering, and draft input.
- External payloads are runtime-validated before entering UX state.
- UX-local types must not shadow backend or product contract types.
- Closure needs replay proof for meaningful interactions.

## Prompt-Relevant Rules

- For UI/operator-surface work, prompts must carry the governing UX method
  compact, not require workers to rediscover UX law from raw method text.
- If a worker changes product truth through UI behavior, the prompt must name
  the admitted carrier/action path.
- If the prompt cannot identify the carrier/action path, the correct result is
  block/re-entry, not local UI invention.
