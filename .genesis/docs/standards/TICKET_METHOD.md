# Ticket Method

**Governance**: Maintained by the methodology author. Read-only for agents unless explicitly asked to revise it.

**Scope**: Defines the minimal local-first ticket layer complementary to `POSTING_GUIDE.md`.

---

## Purpose

This document defines a minimal local-first work-tracking method that fits the
specification methodology without overloading deeper constitutional surfaces.

The method separates:

- `GOALS.md` for current epics and bounded work waves
- tickets for enduring work items
- `.ai-workspace/comments/` for ideas, proposals, reviews, handoffs, and
  closure

This document is complementary to `POSTING_GUIDE.md`.

- `TICKET_METHOD.md` defines durable work-item tracking
- `POSTING_GUIDE.md` defines how ideas, reviews, plans, handoffs, and closure
  are published into the comment layer

---

## Core Model

### Goals

`GOALS.md` holds the current epic layer.

Goals are:

- broader than one ticket
- narrower and more current than `INTENT.md`
- the place to state the active work wave and what matters now

Goals are not the durable unit of execution tracking.

### Tickets

Tickets are the enduring work records.

Each ticket is:

- one markdown file
- the source of truth for that unit of work
- durable across sessions
- typed, so bugs and features share one system

Tickets are used for:

- feature work
- bug tracking
- spikes
- chores

### Comments

`.ai-workspace/comments/` is the message board.

Comments are for:

- publishing ideas
- strategy notes
- reviews
- handoffs
- closure summaries
- decisions and reasoning

Comments are not task status authority. The publication rules for comments are
governed by `POSTING_GUIDE.md`.

---

## Minimal Layout

```text
specification/
├── GOALS.md
└── standards/
    ├── POSTING_GUIDE.md
    └── TICKET_METHOD.md

.ai-workspace/
├── tickets/
│   ├── active/
│   └── completed/
└── comments/
    ├── codex/
    ├── claude/
    └── gemini/
```

---

## Authority

- `GOALS.md` is the epic layer
- `.ai-workspace/tickets/active/` and `.ai-workspace/tickets/completed/` are
  the ticket authority
- `.ai-workspace/comments/` is the discussion and publication layer

There is no separate mandatory `ACTIVE_TASKS.md` in this model.

If a project later wants a board view, it may generate one from the ticket
folders, but that board is a projection only and must not become the source of
truth.

---

## Ticket Rules

### One File Per Ticket

Each ticket lives in its own markdown file.

Recommended naming:

- `T-001-add-product-layer.md`
- `B-002-fix-reset-manifest-id.md`
- `S-003-evaluate-linear-mcp.md`
- `C-004-clean-up-trace-tags.md`

The filename should carry:

- stable id
- short slug

### Required Fields

Each ticket must record at least:

- `id`
- `title`
- `type`
- `status`
- `goal`
- `created_at`
- `updated_at`

Recommended additional fields:

- `priority`
- `dependencies`
- `links`

### Allowed Types

Minimum common set:

- `feature`
- `bug`
- `spike`
- `chore`

Projects may add more, but this default set should be enough for most cases.

### Allowed Status

Minimum status model:

- `active`
- `completed`

Projects may add `blocked`, `cancelled`, or `deferred` later if needed, but the
base method starts with only `active` and `completed`.

### Archiving

Active tickets live in:

- `.ai-workspace/tickets/active/`

Completed tickets move to:

- `.ai-workspace/tickets/completed/`

This keeps the live set small enough that `rg` remains fast and readable.

---

## Recommended Ticket Shape

```md
# T-001 Add Product Layer To SPEC_METHOD

- id: T-001
- type: feature
- status: active
- goal: methodology-bootstrap
- priority: high
- created_at: 2026-04-07
- updated_at: 2026-04-07

## Context

`SPEC_METHOD.md` included intent and requirements flow but omitted the explicit
product-definition layer.

## Acceptance

- `PRODUCT.md` is part of the constitutional chain
- bootstrap sequence includes `intent -> product -> requirements`
- examples and reconstruction logic reflect the new layer

## Links

- comment: `.ai-workspace/comments/codex/...`
```

---

## Operating Mode

This method assumes:

- humans and agents can read the active ticket folder directly
- `rg` is sufficient for finding active work
- no database or board is required

Typical commands:

```bash
rg -n "^#|^- status:|^- type:|^- goal:" .ai-workspace/tickets/active
rg -n "T-001|B-002" .ai-workspace/tickets
```

---

## Relationship To Other Surfaces

- `GOALS.md` answers: what broad work wave matters now
- tickets answer: what durable units of work exist and what state they are in
- comments answer: what was proposed, argued, decided, reviewed, or handed off
- `POSTING_GUIDE.md` answers: how comment-layer publications are structured and
  named

This separation prevents:

- goals becoming an overloaded backlog
- comments becoming informal task status
- task boards becoming accidental authority

---

## Future Extensions

This minimal method can later grow into:

- a generated active board
- ticket dependency checks
- links from tickets to scenario, requirement, or ADR surfaces
- external sync with a real ticketing system
- message-board integration through an MCP layer such as Agent Mail

The durable local file model should remain valid even if those later extensions
are added.
