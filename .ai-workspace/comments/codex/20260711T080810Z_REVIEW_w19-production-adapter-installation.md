# REVIEW: W19 Production Adapter Installation

**Author**: codex
**Date**: 2026-07-11T18:08:10+10:00
**Addresses**: T-036; T-039; W19 completion audit
**Status**: Closed

## Summary

The completion audit found and corrected a manager-owned production gap. Build
Control accepted injected adapters in tests, but production server startup had
no governed installation path. A future odd_glc descriptor would therefore
have remained unsupported even after publication.

## Correction

- Added one manager-local adapter registry loaded before Build service startup.
- Registry shape, unique identities, module path, SHA-256, export, and source
  refs are runtime-validated.
- Registry or module failure stops server admission; no partial registry loads.
- The test-only fixture identity cannot enter production configuration.
- Adapter inputs must remain JSON values after product validation.
- Internal plans require an absolute executable, realpath-contained worksite
  cwd, manager-minted terminal-result path, bounded argv/environment, and no
  caller-selected spawn options.
- Registry and module digests enter Build Execution lineage.

## Proof

- digest-pinned external adapter executes a real typed-result process with
  fixture mode disabled;
- digest drift and fixture identity injection fail before service admission;
- cwd escape fails before spawn;
- same-Project and cross-Project concurrent identity isolation pass;
- full runtime/replay lane: 257/257 passed;
- TypeScript passed;
- full Playwright lane: 43/43 passed.

## Remaining Boundary

odd_manager now has the production installation membrane. It still cannot
invent the odd_glc adapter or build carrier. Those bytes remain owned by
odd_glc T-033/T-034 after upstream ABIogenesis design, realization, and F_H
promotion.
