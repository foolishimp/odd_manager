# Spec Guide

**Governance**: Maintained by the methodology author. Read-only for agents unless explicitly asked to revise it.

**Scope**: Applies when writing or revising goals, intent, product, requirements, design documents, and ADRs.

---

## Position

`SPEC_METHOD.md` is the constitutional process document.

`SPEC_GUIDE.md` is the practical writing guide for producing specification artifacts that conform to that method.

The relationship is:

- `SPEC_METHOD.md` defines authority, chain, and sufficiency
- `SPEC_GUIDE.md` explains how to write artifacts within that structure

This guide does not replace the method. It operationalizes it.

---

## What This Guide Covers

This guide covers:

- how to write clear goals
- how to write clear intent
- how to write clear product definition
- how to write requirement families
- how to keep design downstream of requirements
- how to keep specification present-tense and current-surface
- how to avoid implementation bleed into constitutional documents

---

## Writing By Layer

### Goals

Goals state the current overriding concerns for the active body of work.

They should:

- orient one bounded work wave or session
- keep temporary focus out of deeper constitutional surfaces
- avoid pretending to be requirements or release versions

If a statement is a longer-lived directional claim, it belongs in intent.

### Intent

Intent states:

- why the system exists
- what directional change is being sought
- what is in scope or out of scope

Intent should not hardcode realization detail unless the detail is itself constitutional.

Intent is downstream of goals and upstream of product definition.

### Product

Product states what the product is becoming in concrete terms.

It should:

- bridge intent to requirements
- define the end-state product shape
- define key product terms and boundaries
- accrete as the product matures rather than being replaced by release notes

If a statement is still directional, it belongs in intent.

If a statement is already a detailed obligation, it belongs in requirements.

### Requirements

Requirements state what must be true.

They should:

- define stable obligations
- use explicit acceptance criteria
- avoid naming one implementation path unless that path is constitutional
- remain sufficient for downstream design derivation

### Design

Design states how requirement truth is realized.

Design may choose:

- interfaces
- structure
- packaging
- carrier surfaces
- tenant boundaries

If a statement is optional across lawful realizations, it probably belongs in design, not in requirements.

### ADRs

ADRs record ratified design decisions.

They should capture:

- context
- decision
- consequences

They are durable design memory, not a second requirement surface.

---

## Sufficiency Test

Before keeping a spec artifact, ask:

1. Can the next downstream layer derive from this?
2. Does this artifact state truth, or does it merely describe work in progress?
3. Does any sentence belong in a lower layer instead?

If the answer to any of these is wrong, rewrite or delete.

---

## Present-Tense Rule

Active specification should describe the current constitutional surface in present tense.

Do not preserve legacy wording inside live spec artifacts just for historical memory.

If something is no longer live:

- delete it
- supersede it
- or move it to commentary

Do not leave dead law in the active surface.

---

## Deletion Rule

When a fundamental migration is in progress, deletion is preferable to stale carry-forward.

Restore only what is intentionally re-adopted into the new model.

That keeps specification authoritative instead of archival.

---

## Change-Wave Writing Rule

When documenting a change wave, write the live surface in terms of the current
truth and the declared affected boundary.

Do not name the live constitutional surface by version-line branding such as
`2.0`, `3.0`, or similar labels merely to indicate recency. Prefer terms such as:

- active
- current
- base
- live
- shared
- tenant-local

Use explicit version labels only for the tapped release version or for clearly
historical/superseded material. Release version is a release-process fact, not
constitutional project truth.

---

## Gate Sufficiency Rule

Before treating a downstream artifact as complete, check the whole affected span:

1. Is the change class clear?
2. Is the re-entry point lawful for that class?
3. Can each downstream layer still be derived from the upstream layer?
4. Do active intent, requirements, design, and qualification say the same thing in the affected scope?

If not, the gate is not actually closed.
