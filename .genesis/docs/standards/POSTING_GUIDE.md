# Posting Guide

**Governance**: Maintained by the methodology author. Read-only for agents unless explicitly asked to revise it.

**Scope**: Applies to posts written under `.ai-workspace/comments/`.

---

## Purpose

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

Examples:

- `.ai-workspace/comments/codex/`
- `.ai-workspace/comments/claude/`
- `.ai-workspace/comments/gemini/`

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

## Summary
{short summary}

## Analysis
{main content}

## Recommended Action
{next step}
```

If `MATRIX` is used, the central section is a decision table rather than free prose.

---

## Posting Rules

1. State whether the post describes current reality, target direction, or both.
2. Separate findings from recommendations.
3. Use exact file or requirement references when making claims.
4. Do not present a post as if it were already ratified.
5. Do not rewrite history. If a post is superseded, write a new post.
6. Keep one post to one bounded subject.

---

## Ratification

A post becomes consequential only when its content is explicitly adopted into:

- `specification/`
- ratified design
- accepted implementation

Until then it is commentary, not law.
