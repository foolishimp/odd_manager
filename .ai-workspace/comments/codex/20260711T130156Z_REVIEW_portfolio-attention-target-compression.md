# Review: Portfolio Attention Target Compression

Date: 2026-07-11
Scope: T-031 and T-032 integrated UX review
Change class: realization refactor under ratified Build Portfolio design

## Finding

Build Portfolio attention retained severity, Project, source kind, source ref,
and a correct admitted destination, but every visible action said
`Open source`. Revision pressure, missing build carriers, failed executions,
and assurance gaps therefore looked operationally identical even though they
opened different capabilities.

The mismatch weakened REQ-OM-DEV-001 and REQ-OM-DEV-003: the developer could
observe the obligation but still had to infer the next interaction.

## Decision

One total selector owns both parts of attention targeting:

```text
revision | specification        -> specification-proposal -> Open Tune
build-carrier | build-execution -> build-control          -> Open Build
other source kinds              -> assurance-attention    -> Open Assure
```

The reducer consumes `capabilityId`. The view consumes `actionLabel`. Unknown
future kinds route to Assure, where unsupported evidence remains visible and
cannot create a positive closure claim.

## Boundary

No new State, Msg, Cmd, effect, Context, source reference, or cross-capability
import was added. The existing `portfolio.open-attention` command remains the
only carrier. The view has no independent source-kind mapping.

The focused TypeScript replay loader was taught to resolve local runtime
imports recursively through compiled data URLs. This lets tests preserve the
same module boundary as production code.

## Proof

- focused host and total-selector proof: 11/11 passed;
- focused browser proof clicking Tune, Build, and Assure actions: 1/1 passed;
- runtime/replay: 267/267 passed;
- TypeScript: passed;
- production build: passed with the existing Vite large-chunk warning;
- Playwright: 45/45 passed in 4.9 minutes;
- desktop and 390px live review: all labels contained, all destinations
  correct, no console errors;
- `git diff --check`: passed.

## Residual

T-031 and T-032 remain at operator review. T-032's live odd_glc carrier remains
lawfully downstream of the ABIogenesis/odd_glc DS sequence; this iteration does
not alter that dependency.
