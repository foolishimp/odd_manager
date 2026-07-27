# Glossary Guide

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

## Test Authority Terms

### Design/Module Conformance Test

An executable proof surface derived from design or module authority.

It proves that implementation realizes a designed boundary correctly. Unit
tests, module integration tests, negative tests, and fail-closed tests may all
belong to this family when their source authority is a module or design surface.

### Unit Test

A module-owned design conformance proof lane.

In this methodology, a canonical unit test derives from module ownership and
carrier law, not merely from helper function layout.

### UAT / Acceptance Test

An executable proof surface derived from requirements, acceptance criteria,
declared scenarios, or use cases.

It proves that the composed product satisfies claimed user or product behavior.
Under `SPEC_METHOD.md`, UAT / acceptance tests must run as sandbox tests or an
explicitly equivalent isolated composed-product proof lane.

### Sandbox Test

A UAT / acceptance test that exercises the deployed, installed, or otherwise
runnable product form through declared application, public, runtime, or control
surfaces.

The test must be driven by requirement-sourced scenario or acceptance authority.

### Harnessed Sandbox Test

A sandbox test that exercises the composed product path with deterministic,
fake, recorded, or injected worker/result surfaces.

It proves scenario wiring and control behavior without relying on live external
probabilistic execution.

### Live Sandbox Test

A sandbox test that exercises the composed product path with a real configured
worker, tool, agent, service, or external probabilistic transport.

It is the acceptance lane required when a product or release claim depends on
live probabilistic compute.

---

## Graph-Native Terms

### GTL

Graph Transformation Language.

The language expression used to declare graph-native products in graph terms.

### ABG

The singular traversal-governance, binding, and runtime-truth authority role
used by the graph-native method.

A consumer binds this role to a concrete conforming realization and immutable
dependency identity. The method role does not select or derive authority from a
particular repository, package, vendor, or downstream product.

### Edge Traversal

One bounded invocation of a declared graph transition.

The traversal is the admissible external work space: it carries the declared
input, output, context, evaluator regime, provenance obligation, and lawful
control states for one movement across a graph boundary.

### Probabilistic Compute

Bounded constructive work whose internal solution path is not fully determined
by the framework.

`ODD_METHOD.md` gives the graph-native definition: one vector or edge traversal
is the bounded unit of probabilistic compute, and the traversal contract defines
the admissible external space.

---

## Ambiguity Terms

### Lawful Probabilistic Processing

Bounded non-human processing permitted by policy to carry or resolve declared
ambiguity.

This is the substrate-agnostic baseline term for permission to use
probabilistic compute under a declared boundary.

### F_D

Historical graph/runtime shorthand for deterministic evaluation or proof.

F_D can validate, measure, or optimize a domain-owned path when the domain can
make part of the work precise.

It does not move domain HOW into the framework.

### Human Adjudication

Explicit human judgment used to resolve declared ambiguity when policy or risk
appetite requires it.

### F_P

Historical graph/runtime shorthand for a bounded probabilistic worker turn under
a declared traversal boundary.

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
