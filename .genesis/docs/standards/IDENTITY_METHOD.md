# Identity Method

**Governance**: Maintained by the methodology author.

**Scope**: Shared identity and naming method for constitutional surfaces,
runtime artifacts, and derived domain products.

**Relation**: Composes with `SPEC_METHOD.md`, `ODD_METHOD.md`,
`WORLD_MODEL_METHOD.md`, and `RELEASE_METHOD.md`.

Use this method when defining, parsing, publishing, or overriding identities
for requirements, design surfaces, scenarios, runtime artifacts, and other
governed objects.

---

## Position

Identity must be:

- scoped
- typed
- unique
- stable enough for the governed purpose

Identity is not a flat global string convention.

Identity is made unique by hierarchy and type.

That means:

- the same literal token may be lawful in different scopes when its authority
  and kind differ
- one string format is not sufficient to define identity across all products
  and runtime surfaces
- a human-readable form may help recognition, but readability is secondary to
  uniqueness and stable governed meaning

The engine should carry identity safely.

The domain should define semantic identity law for its own constitutional
objects.

---

## Core Law

### 1. Scoped Identity

Identity is always scoped.

At minimum, identity should be interpretable through:

- authority
- kind
- value

So the minimum semantic model is:

`identity = authority + kind + value`

Optional additional coordinates may include:

- parent scope
- revision
- publication version
- temporal coordinates

### 2. Uniqueness Law

Identity must be unique within its lawful scope.

The requirement is not “every id must look globally unique as a naked string.”

The requirement is:

- no two live objects of the same kind may share the same identity within the
  same authority scope
- aliasing across scopes must remain explicit
- serialization must preserve enough hierarchy to prevent accidental collision

### 3. Type Law

Identity is typed.

Different kinds of thing should not be collapsed into one undifferentiated id
space.

Examples of distinct identity kinds include:

- goal
- intent
- requirement
- requirement_family
- acceptance_criterion
- scenario
- design_decision
- graph_function
- asset_surface
- release
- install
- run
- graph_call
- continuation
- event

The method must not treat a family id as if it were a concrete requirement id,
or a release version as if it were object identity.

### 4. Stability Law

Identity should remain stable for the governed lifecycle it serves.

This does not mean every identity is immutable forever.

It means identity must be stable enough to support:

- traceability
- comparison
- replay
- publication
- supersession

If an identity changes, the method should make the relationship explicit rather
than silently reusing the old one for a different object.

---

## Human-Readable vs Opaque Identity

Identity may be:

- opaque, such as a GUID or UUID
- human-readable, such as `REQ-F-ODDSVC-001`
- hybrid, where one component is readable and another is opaque

The governing rule is:

- readability is a convenience for recognition
- uniqueness and scoped meaning are the actual law

Therefore:

- a GUID is lawful even when it carries no human meaning
- a readable id is lawful only if it still preserves uniqueness in scope
- no reader should infer that a readable id is safer or more authoritative than
  an opaque one merely because it looks meaningful

---

## Identity Hierarchy

Identity should be made unique by hierarchy where appropriate.

One useful general model is:

`authority / kind / value / revision`

Not every serialization needs all four visible segments, but the semantic model
should be available.

Examples:

- `(odd_sdlc, requirement, REQ-F-ODDSVC-001)`
- `(odd_sdlc, requirement_family, REQ-F-ODDSVC)`
- `(abiogenesis, run, 550e8400-e29b-41d4-a716-446655440000)`
- `(abiogenesis, release, 3.1.0-rc.1)`

The important point is that:

- `REQ-F-ODDSVC` and `REQ-F-ODDSVC-001` are not the same kind of identity
- a runtime `run_id` and a domain requirement id do not belong to the same
  semantic category even if both serialize as strings

---

## Authority Split

### Engine-Owned Identity

The substrate or runtime may define default identities for runtime-owned
objects, such as:

- runs
- graph calls
- jobs
- frames
- continuations
- events

For these, the engine may use opaque ids and engine-local generation rules.

Those rules should optimize for:

- uniqueness
- replay safety
- event-stream integrity

The engine should not impose domain-specific semantic grammar on domain-owned
objects.

### Domain-Owned Identity

Derived domains own the semantic identity grammar for their own constitutional
objects, such as:

- requirements
- requirement families
- acceptance criteria
- scenarios
- ADRs or design decisions
- published domain assets

The domain must define:

- which identity kinds exist
- how they are distinguished
- what makes them unique
- how they are parsed or read

The runtime may transport those identities, but it should not silently invent
their meaning.

---

## Default Formats And Overrides

### ABG Defaults

ABG may publish default identity generators, validators, and normalizers for
its own runtime surfaces and for common default ODD surface kinds used by
default `F_D` helpers.

These defaults are:

- starter conventions
- convenience contracts
- not universal doctrine

They are lawful only so long as derived domains may override them.

### Derived Domain Overrides

Derived domains may override identity format and structure for their own kinds.

An override is lawful only if it preserves:

- scoped uniqueness
- explicit kind distinction
- deterministic parsing or reading
- non-aliasing between family and member identities
- stable downstream traceability

Overrides must be published in domain authority.

They must not exist only as ad hoc regex assumptions hidden in implementation
code.

### Override Publication Surface

When a domain overrides ABG defaults, the override must be published in a
lawful domain authority surface rather than inferred only from implementation
code.

At minimum, the domain should publish:

- the identity kinds in scope
- the serialization or readable form used for those kinds
- the scope or hierarchy that makes them unique
- the distinction between grouping identities and concrete executable or
  traceable identities

Suitable publication surfaces include:

- `PRODUCT.md` for the active identity kinds and their governed role
- requirement surfaces for obligations around identity stability or uniqueness
- design or ADR surfaces for parsing, serialization, or normalization rules
- a dedicated identity registry surface such as `IDENTITY.md` when the domain
  has enough complexity to justify one

The important rule is that identity overrides must be visible in domain
authority, auditable, and recoverable without reverse-engineering regexes from
implementation code.

---

## Parsing Law

Regex extraction from prose is not a complete identity model.

At most, regex may be a provisional extractor over a surface whose identity law
is already defined elsewhere.

Therefore:

- a parser must distinguish between concrete identity kinds and grouping labels
- family markers, display aliases, and prose headings must not be promoted into
  executable or traceable object identities unless the governing identity law
  says they are first-class identities of their own kind
- acceptance criteria, testcases, and similar subordinate identities must not
  be collapsed into requirement identity merely because their readable form is
  derived from a requirement token

If a domain needs family ids, it should publish them explicitly as
`requirement_family` identities rather than rely on string-shape accidents.

---

## Release Version Boundary

Release version is not the same thing as object identity.

Per `RELEASE_METHOD.md` and `SPEC_METHOD.md`:

- the tapped release version is the only operative release version identifier
- release version is a release-process fact
- release version is not the live constitutional identity of every object in
  the project

So the method must distinguish:

- object identity
- release identity
- publication/revision coordinates

These may relate, but they are not interchangeable.

---

## Minimum Questions

When defining or auditing an identity surface, ask:

1. What authority owns this identity?
2. What kind of thing does this identity denote?
3. What scope makes it unique?
4. Is the identity stable enough for the governed lifecycle?
5. Is the readable form only convenience, or is it being over-trusted?
6. Can a parser distinguish families, members, aliases, and revisions without
   ambiguity?
7. Is this an engine/runtime id, a domain semantic id, or a release id?

If those questions cannot be answered, the identity surface is under-defined.

---

## Examples

### Lawful

- runtime event ids generated as UUIDs by ABG
- requirement ids such as `REQ-F-ODDSVC-001` when the domain defines them as
  concrete `requirement` identities
- family ids such as `REQ-F-ODDSVC` when the domain defines them separately as
  `requirement_family`
- acceptance-criterion ids such as `REQ-F-ODDSVC-001-AC-01` when the domain
  defines them as a separate `acceptance_criterion` identity kind

### Unlawful

- treating `REQ-F-ODDSVC-*` or `REQ-F-ODDSVC` as a concrete requirement merely
  because a broad regex matched it
- using release version as the identity of every live source object
- assuming a readable string is globally unique without its authority and kind

---

## Consequence For Implementations

Implementations should prefer:

- typed identity readers
- explicit identity-kind distinctions
- source-of-authority parsing contracts

They should avoid:

- broad regex mining as the real identity model
- silent coercion between family ids and concrete ids
- leaking engine id grammar into domain semantics

If a project currently relies on those patterns, the first lawful repair is to
contain the immediate bug. The enduring repair is to publish explicit identity
law and move implementations onto it.
