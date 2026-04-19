# Project Requirements

Project-specific requirement families live in this folder.

Use `.genesis/docs/standards/` as the governing method reference when writing or revising these files.

## Rules

- Write requirement families as separate `*.md` files.
- Every requirement family must declare `Family`, `Status`, and `Category`
  metadata in the header.
- `Status` must use the lifecycle vocabulary from `SPEC_METHOD.md`:
  `Active`, `Deferred`, `Superseded`, or `Orphaned`.
- `Category` must use the requirement-category vocabulary from
  `SPEC_METHOD.md`: `Capability`, `Constraint / Guarantee`, `Governance`, or
  `Verification`.
- Use deterministic REQ headers in the form `### REQ-...`.
- Replace `00-starter.md` with real project requirement families as the project becomes concrete.
