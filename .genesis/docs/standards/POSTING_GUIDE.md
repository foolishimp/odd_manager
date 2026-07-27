# Posting Guide

Posting is the commentary layer of the repo.

Posts are for:

- analysis
- criticism
- proposed changes
- handoff
- repricing of confidence

Posts are not constitutional truth. They are working commentary that may later influence specification or design.

---

## Boundary

Use a post when the content is:

- provisional
- investigative
- comparative
- argumentative
- not yet ratified

Do not use a post for:

- live requirements
- live design decisions
- active process law

Those belong in `specification/` or ratified design surfaces.

---

## Location

Posts live under:

```text
.ai-workspace/comments/<agent>/
```

Capability example:

- `.ai-workspace/comments/<agent-id>/`

---

## Filename

Use:

```text
YYYYMMDDTHHMMSS_CATEGORY_SUBJECT.md
```

Example:

```text
20260327T120000_REVIEW_bootloader-boundary.md
```

The subject should be short, specific, and stable enough to scan later.

---

## Categories

Use these categories:

- `REVIEW` for critique of code, spec, design, or another post
- `STRATEGY` for a proposed technical or methodological direction
- `GAP` for a precise insufficiency or contradiction
- `SCHEMA` for data model, event model, interface, or contract shape
- `HANDOFF` for bounded transfer of context or task state
- `MATRIX` for explicit decision comparison across options

---

## Structure

Use this base shape:

```markdown
# {CATEGORY}: {Subject}

**Author**: {agent}
**Date**: {ISO 8601}
**Addresses**: {artifact, issue, or boundary under discussion}
**Status**: Draft
**Updated**: {ISO 8601, optional}

## Summary
{short summary}

## Analysis
{main content}

## Recommended Action
{next step}
```

If `MATRIX` is used, the central section is a decision table rather than free prose.

---

## Discussion State And Mutability

Posts are mutable while they are part of an open discussion.

Use `Status` to make the discussion state explicit:

- `Draft` for a post still being shaped by its author
- `Open` for a post published into an active discussion
- `Closed` for a post whose discussion has concluded

While a post is `Draft` or `Open`, update the same post when the change is
still part of the same bounded discussion. This includes:

- correcting mistakes
- incorporating replies
- refining recommendations
- repricing confidence
- adding new evidence that belongs to the same subject

When updating an open post, preserve the original `Date` as the first
publication time. Add or update `Updated` when useful.

Once a post is `Closed`, updating it is discouraged. Prefer a new post when a
later change would materially alter a closed conclusion, reopen an old dispute,
or start a new bounded subject.

Closed posts are not constitutional truth. They are stable commentary records
unless and until their content is adopted into `specification/`, ratified
design, or accepted implementation.

---

## Posting Rules

1. State whether the post describes current reality, target direction, or both.
2. Separate findings from recommendations.
3. Use exact file or requirement references when making claims.
4. Do not present a post as if it were already ratified.
5. Do not rewrite closed history by stealth. Open posts may be revised in
   place; closed posts should normally be superseded by a new post.
6. Keep one post to one bounded subject.

---

## Ratification

A post becomes consequential only when its content is explicitly adopted into:

- `specification/`
- ratified design
- accepted implementation

Until then it is commentary, not law.

## Shared Method Adoption And Propagation (`STDO-UP-012`)

Reusable method change preserves this authority relation:

```text
incident or review evidence
  -> shared-method intake
  -> one owning standard
  -> consistency and independent review
  -> human-authority acceptance
  -> one complete released STDO version
  -> explicit consumer selection
  -> consumer-owned realization and evidence
```

This is authority causality, not a prescribed intake workflow or artifact set.
An executable tool, runtime, carrier schema, or assurance implementation cannot
enter STDO merely because it accompanies a method lesson; it requires separate
Product authorization. Other standards consume admitted law by reference, and
consumers select complete released versions rather than mixing members from
different cuts.
