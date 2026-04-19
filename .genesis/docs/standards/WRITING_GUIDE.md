# Writing Guide

**Governance**: Maintained by the methodology author. Read-only for agents unless explicitly asked to revise it.

**Scope**: Applies to human-facing prose written for this repo, including the practical writing of goals, intent, product, requirements, design documents, and ADRs.

---

## Purpose

This guide exists to keep repository prose direct, technical, and non-generic.

Its main job is to suppress AI-sounding writing.

---

## Core Rule

Write as if the reader is technically fluent and short on time.

State the claim. State the reason. Remove the performance around it.

---

## Style Rules

1. Prefer direct positive statements over contrast framing.
2. Remove setup paragraphs that announce what the section will say.
3. Use concrete nouns and verbs instead of motivational or promotional language.
4. Keep one claim per sentence when possible.
5. Prefer precise technical vocabulary over vague intensifiers.
6. Use examples only when they reduce ambiguity.
7. Do not write filler transitions whose only purpose is tone.

---

## Remove These Habits

- “not X, but Y”
- “simply”
- “just”
- “clearly”
- “obviously”
- “powerful”
- “robust”
- “seamless”
- “game-changing”
- generic reassurance
- dramatic phrasing

These usually add tone without adding information.

---

## Good Prose

Good prose in this repo is:

- factual
- bounded
- explicit about authority
- explicit about uncertainty
- easy to challenge

If a sentence sounds polished but carries no new constraint or observation, cut it.

---

## Bad Prose

Bad prose in this repo:

- implies conclusions instead of grounding them
- repeats the same claim in different words
- mixes current reality with target intent without labeling the difference
- explains basic concepts to an expert audience
- turns straightforward instructions into brand language

---

## Method Alignment

Method documents should sound constitutional.

Requirements should sound normative.

Design should sound structural.

Commentary should sound analytical.

If the tone does not match the authority layer, rewrite it.

---

## Specification Artifact Practice

`SPEC_METHOD.md` is the constitutional authority for specification-layer roles and closure.

This guide handles the practical writing discipline for those artifacts.

When writing specification artifacts:

- state the current live truth, not a narrated transition
- keep each sentence in the right layer
- remove stale law instead of carrying it forward for comfort
- keep design detail out of constitutional layers unless the detail is itself constitutional

If a sentence sounds informative but does not change authority, constraint, or derivability, cut it.

---

## Practical Layer Checks

When writing or revising a specification artifact, ask:

1. Can the next downstream layer derive from this?
2. Does this artifact state current truth rather than work in progress?
3. Does any sentence belong in a lower layer instead?

If any answer is wrong, rewrite or delete.

---

## Current-Surface Writing

Active specification should describe the current constitutional surface in present tense.

If something is no longer live:

- delete it
- supersede it
- or move it to commentary

Do not leave dead law in the active surface.

During a change wave, prefer terms such as:

- active
- current
- base
- live
- shared
- tenant-local

Use explicit version labels only for tapped release facts or clearly historical material.
