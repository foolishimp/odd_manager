# REVIEW: W21 Assurance And Attention MVP

**Author**: codex
**Date**: 2026-07-11T17:20:30+10:00
**Addresses**: T-038; W21; REQ-OM-ASR-001 through REQ-OM-ASR-008
**Status**: Closed

## Summary

The odd_manager-owned W21 assurance boundary is implementation-complete and
automation-verified. It is ready for operator UX review. Live odd_glc closure
remains gated by its unpublished catalog and evidence adapter.

## Findings

No manager-boundary defect blocks review.

- Required meaning comes only from a descriptor-matched product catalog.
- Positive assessments require execution/revision/key/ref/digest evidence.
- Missing evidence after converged process remains missing and blocking.
- F_D failure remains failed while an F_H obligation is open.
- Stale source, evidence revision, digest, and key identity remain visible.
- Attention derives from assessment rows and cannot dismiss or mutate them.
- The only installed reaction opens the canonical Run Inspector and preserves
  the Workbench Assure context on return.

## Compression Review

There is one catalog loader, one Build evidence boundary, one assessment
service, one State/Msg/Update/Cmd algebra, one matrix renderer, and one Attention
projection. Portfolio consumes summaries; Run Inspector remains the sole
forensic renderer.

## Proof

- assurance service: 8/8 passed;
- Assurance Msg replay: 2/2 passed;
- focused Playwright: passed in 6.2 seconds;
- TypeScript and production build: passed;
- missing, verified, and mobile stale screenshots visually inspected.

## External Gate

Dynamic fixture evidence proves manager assessment behavior only. odd_glc must
publish the same standard catalog/evidence contracts before T-038 or T-039 can
claim data-mapper assurance.
