# Workspace Bootstrap For Codex

This template bootstraps Codex for the multi-repo workspace rooted at
`<workspace-root>`.

This root is a coordination surface across many sibling source projects. It is
not one product with one shared local spec tree.

More specific `AGENTS.md` files inside child repositories override this file
for their subtree.

## Embedded Method Compression

### Core Position

- Specification is constitutional source, not commentary on code.
- Authority flows:
  `Goals -> Intent -> Product Definition -> Requirements -> Design -> Code -> Events -> Projection -> Delta -> Scenarios -> Gap Analysis -> Repricing`.
- `specification/` defines `WHAT`. Design, build tenants, and code define
  `HOW`.
- Active surfaces stay present tense. Historical, provisional, or comparative
  material belongs in comments, design history, or release notes, not in live
  constitutional text.
- Derived artifacts, generated views, comments, dashboards, indexes, and local
  precedent are read models. They do not outrank live specification or ratified
  design.
- Missing traceability is a defect. Ungrounded code, unowned requirements, or
  design without requirement authority are process drift.

### Recursive Product Taxonomy

- `Source Project`: mutable workspace building the next cut.
- `Release Cut`: immutable boundary over accepted work for one release.
- `Product`: released immutable thing.
- `Install`: stamped workspace instance of a released product.
- `Artifact`: published output built by a source project or installed product.
- `Development Product`: practical shorthand in this workspace for an installed
  product or lower product used as builder substrate for another product.

Do not blur source project, release cut, product, and install. `PRODUCT.md`
defines the current product-definition surface of the source project. It is not
the release artifact itself.

Compiler analogy:

`bootstrap source -> release P0 -> install P0 -> use installed P0 as dev product to build source for P1 -> release P1`

Recursive product rules:

- a product may be built over another product
- an installed product may build the next version of itself
- an installed product may build a dependent product
- when a product is acting as builder substrate, treat it as a dev product, not
  as the mutable source project being edited
- do not confuse the builder product with the product currently being authored
- do not confuse `PRODUCT.md` with the released artifact or with the builder
  substrate that happens to be running the build

### Lawful Re-Entry And Change Classes

Every substantive change starts with intake triage and must declare the
smallest lawful re-entry point:

- `goal_reprice`: current work-wave focus changes
- `intent_reprice`: direction or scope changes
- `product_reprice`: current product shape changes while intent stays stable
- `requirement_reprice`: constitutional truth changes while direction stays
  stable
- `design_reframe`: realization structure changes while requirements stay
  stable
- `realization_refactor`: local realization changes with no intended upstream
  change

No bug, feature, issue, or request skips triage and jumps straight to code.

### ODD Compression

Use this context for GTL, ABG, and ODD-shaped products in this workspace.

- An ODD product is:
  `typed domain assets or nodes + published graph functions + GTL module or public carrier + ABG runtime + projection or query surface + proof surface`.
- Graph functions are the primary constructive carrier.
- Do not hide the constructive carrier inside ad hoc service methods,
  orchestration loops, or one-off scripts.
- `specification/` owns intent, product, goals, requirements, and scenarios.
- `build_tenants/` and ratified design own realization structure, GTL
  publications, code, tests, and local proof surfaces.
- ABG owns traversal, runtime facts, frames, continuations, lineage,
  provenance, correction, and projection mechanics.
- The product owns domain meaning, function catalog, policy overlays, query
  overlays, and domain proof interpretation.

### Work Tracking And Commentary

- `GOALS.md` is the bounded current work-wave surface.
- `.ai-workspace/tickets/` is the durable work-item surface.
- `.ai-workspace/comments/<agent>/` is the commentary surface for analysis,
  review, strategy, gaps, handoff, schema notes, and closure.
- Posts are commentary, not law.
- If a pattern becomes reusable shared law, ratify it in
  `specification_methodology` instead of normalizing it by repetition.

### Writing Compression

- State the claim. State the reason. Cut setup.
- Use direct technical prose.
- Separate current reality from target direction.
- Prefer concrete nouns and verbs over promotional or motivational language.
- Remove filler such as reassurance, contrast framing, vague intensifiers, and
  polished sentences that add no constraint.

## Repo Entry Rule

Before changing a specific child repo, identify the owning repo and then read
its local authority surfaces in this order when present:

1. `README.md`
2. `specification/GOALS.md`
3. `specification/INTENT.md`
4. `specification/PRODUCT.md`
5. `specification/requirements/`
6. ratified design surfaces
7. deeper local `AGENTS.md` or `CLAUDE.md`

Apply these rules:

- specification defines `WHAT`
- design and realization define `HOW`
- comments, generated views, and stale precedent do not outrank live
  specification and design
- use the smallest lawful re-entry point from the change classes above
- if the repo is ODD-shaped, do not collapse the constructive carrier back into
  imperative glue

## Shared Method Source

The upstream shared methodology source of truth for this install lives under:

- `<method-standards-root>`

Use these source documents when exact constitutional wording matters or when
editing shared method:

- `SPEC_METHOD.md`
- `ODD_METHOD.md`
- `TICKET_METHOD.md`
- `POSTING_GUIDE.md`
- `WRITING_GUIDE.md`

Repo-local installed copies such as `.genesis/docs/standards/` may describe one
project's installed line, but they are local installs or mirrors, not the
upstream source authority.

## Workspace Rules

- Do not spread changes across sibling repos by drift. Work only in the named
  repo or in `specification_methodology` unless the task explicitly spans both.
- If a methodological change is shared law, update `specification_methodology`
  first and then update downstream installs only when requested or when the
  task explicitly includes propagation.
- When writing posts, handoffs, or reviews, keep them commentary and do not
  present them as ratified specification or design.
