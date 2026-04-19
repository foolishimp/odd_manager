# Glossary Guide

**Governance**: Maintained by the methodology author.

**Scope**: Shared terminology reference for the specification methodology
library.

**Relation**: Companion glossary for `SPEC_METHOD.md` and its refinements.
Use this guide to keep terminology stable across method, guide, and product
surfaces.

---

## Purpose

This glossary centralizes the highest-load terms that otherwise drift across
recursive product, graph-native, and world-model work.

It is a reference surface, not a constitutional method in its own right.

---

## Recursive Product Terms

### Substrate

A lower product or runtime used to build other products.

### Source Project

The mutable workspace building the next release cut.

### Release Cut

The tapped immutable boundary over the accepted feature set.

### Product

The released immutable thing resulting from a release cut.

### Install

A stamped workspace instance of a released product.

### Artifact

Any published output built by a source project or by a configured installed
product.

### Product Definition

The present-tense source-project surface recorded in `PRODUCT.md`.

This is not the released product artifact itself.

---

## Graph-Native Terms

### GTL

Graph Transformation Language.

The language expression used to declare graph-native products in graph terms.

### ABG

Abiogenesis runtime / substrate.

The execution and binding runtime that traverses and realizes GTL-declared
program space.

---

## Ambiguity Terms

### Lawful Probabilistic Processing

Bounded non-human processing permitted by policy to carry or resolve declared
ambiguity.

This is the substrate-agnostic baseline term.

### Human Adjudication

Explicit human judgment used to resolve declared ambiguity when policy or risk
appetite requires it.

### F_P

Historical graph/runtime shorthand for probabilistic or delegated processing.

Use only in graph-native or runtime-specific surfaces, not as baseline
methodology terminology.

### F_H

Historical graph/runtime shorthand for human adjudication.

Use only in graph-native or runtime-specific surfaces, not as baseline
methodology terminology.

---

## World-Model Terms

### Builder Project

A configured project instance of a builder app with its own source inputs,
settings, and publication lane.

This is a specialization of `Source Project` used in world-model work to avoid
overloading the bare word `project`.

### Published Domain Artifact

An immutable published semantic output of a builder project.

### World Model Object

A machine-reasonable representation of something treated as real in a bounded
context.

### Markov Object

A stable self-bounding world-model object whose internal state can be reasoned
about through its effective blanket.

### Treatment Surface

A semantic reinterpretation from one domain into another.

### Covariance Edge

A declared relation showing how changes in one object correspond to changes in
another.

### Adjoint Mapping

The interpret-back contract paired with a treatment.

### Composed World Model

A higher-order world model built by referencing and stitching published domain
artifacts while preserving their identity, version, and local authority.

### Query Plane

An optional downstream serving surface for traversal or query over published
domain artifacts and composed world models.

---

## Usage Rule

When a term is defined here and also appears in a method or guide, the glossary
meaning should be treated as the shared default unless the downstream document
explicitly narrows it for a bounded domain.
