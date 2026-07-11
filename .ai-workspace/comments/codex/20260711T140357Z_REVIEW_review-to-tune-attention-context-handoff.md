# Review: Review-To-Tune Attention Context Handoff

Date: 2026-07-12
Scope: T-031 and T-032 integrated UX review
Change class: design reframe with Msg-only realization

## Finding

Build and Assure attention opened views that retained their source through
descriptor, execution, catalog, or evidence state. Revision/specification
attention selected Tune correctly but discarded its `sourceRef`, leaving an
empty proposal-context list. The developer could see where to act but not the
observation that justified the transition.

This violated the source-attribution intent of REQ-OM-DEV-003 and the explicit
context law of REQ-OM-SPC-002.

## Decision

- Extend the existing `proposal/context-attached` Msg with an optional direct
  `sourceRef`.
- Manual Attach omits the field and consumes the visible attachment draft.
- The host supplies the admitted attention ref only after target Project
  Context matches.
- Both paths use one bounded, deduplicated attachment set and one proposal
  generation payload.
- Project change clears proposal drafts and attachments; same-Project revision
  refresh retains explicit context.

## Boundary

No new command, effect, proposal carrier, patch path, or mutation authority was
introduced. Build Portfolio still owns attention selection; the host owns the
cross-capability handoff; Specification Proposal alone owns attachment
admission and rendering. The host cannot inject prompt, patch, status, or
acceptance truth.

## Proof

- focused proposal Msg replay: 6/6 passed;
- focused browser route with exact attached attention source: 1/1 passed;
- runtime/replay: 268/268 passed;
- TypeScript: passed;
- production build: passed with the existing Vite large-chunk warning;
- Playwright: 45/45 passed in 4.6 minutes;
- desktop and 390px live Tune review: exact `git://` source visible and
  removable, no overflow or console errors;
- `git diff --check`: passed.

## Residual

T-031 and T-032 remain at operator review. T-032's live odd_glc carrier remains
lawfully downstream of the ABIogenesis/odd_glc DS sequence; this iteration does
not alter that dependency.
