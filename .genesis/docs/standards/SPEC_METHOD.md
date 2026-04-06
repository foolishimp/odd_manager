# Spec-Driven Homeostatic Methodology

**Status**: Approved
**Date**: 2026-03-24
**Derived from**: 20260324T142230_NOTE_spec-driven-homeostatic-methodology.md
**Repriced**: 2026-03-24 — Verification Layers and Renewal Path added, derived from product-owner scenario analysis (20260324T165057_PRODUCT_SCENARIOS_abg-gtl-first-10.md)
**Repriced**: 2026-04-07 — Product definition layer made explicit in the constitutional chain, bootstrap rule, and spec-driven method
**Repriced**: 2026-04-07 — Goals layer made explicit in the constitutional chain, bootstrap rule, and spec-driven method

This document defines the philosophical baseline for spec-driven development.

It states why specification is authority, what the constitutional chain is, and
what counts as sufficiency, drift, proof, and repricing.

It is intentionally general.

Where a product is realized as a graph-native system, this baseline is refined
by a stronger constitutional method such as `GRAPH_METHOD.md`.

---

## Position

Spec-driven development treats specification as constitutional source, not as
commentary on code after the fact.

The point is to make software re-derivable, auditable, and correctable under
explicit authority.

Its overriding bias is declarative rather than imperative.

In the age of LLMs, the system should primarily declare truths, structures,
interfaces, constraints, and evidence surfaces, then let lawful processing
derive and realize work from that declared surface.

Imperative procedure still exists, but it is subordinate to declared authority.

---

## Manifesto

We define the current **goals** for the active body of work before repricing deeper constitutional layers.

We work from **intent** before implementation.

We define the current **product** in explicit present-tense terms before decomposing it into detailed requirements.

We define the full constitutional **what** in **requirements**, not merely a feature list.

We prefer declaring desired truth and lawful boundaries over prescribing step-by-step imperative procedure.

We make **design** the explicit structural bridge between requirements and code.

We require **code** to be derivable from requirements and design, not defended as accidental precedent.

We demand **evidence** for claims through scenarios, tests, events, projection, and delta.

We treat **repricing** as part of correctness: when reality exposes a constitutional gap, the specification must change.

We keep **authority directional** even while iterating: goals govern intent, intent governs product, product governs requirements, requirements govern design, and requirements plus design govern code.

We keep the **live operative surface** in the present tense only: once a new current reality is established, transitional paths are erased from the live product unless explicitly retained as compatibility features.

We treat **derived artifacts** — indexes, trace matrices, reports, automation, generated views — as helpful read models, never as constitutional truth.

If these claims do not hold, the work is not genuinely spec-driven.

---

## Litmus Tests

The work is not genuinely spec-driven if any of these fail:

1. Given goals, a competent team cannot derive a conformant intent surface.
2. Given intent, a competent team cannot derive a conformant product definition.
3. Given product definition, a competent team cannot derive conformant requirements.
4. Given requirements, a competent team cannot derive a conformant design.
5. Given requirements and design, a competent team cannot derive conformant code.
6. A live requirement has no explicit status, category, or owning design decision.
7. A live requirement has no downstream realization or explicit deferment surface.
8. Code behavior exists without requirement and design authority.
9. A live domain artifact is rewritten in place after becoming part of the live constitutional surface.
10. A capability claim has no operational evidence.
11. Drift is discovered, but the constitutional source is not repriced.

---

## Process Constitution

This methodology is not only a local operating note for one implementation. It is the process constitution for building projects by spec-driven development.

Its role is meta-constitutional:

- it defines how goals, intent, product, requirements, design, code, evidence, and repricing relate
- it defines what counts as specification sufficiency
- it defines what kinds of requirement truth exist
- it defines how authority flows during iterative delivery

Therefore, if a project's implementation disappears, this methodology should still be sufficient to bootstrap a new spec-driven project process from scratch.

The important boundary is:

- `SPEC_METHOD.md` defines the process constitution
- `GOALS.md` defines the current overriding concerns for the active body of work
- `INTENT.md` defines domain direction
- `PRODUCT.md` defines the current product realization
- `specification/requirements/` is the live requirement surface derived from product definition
- a shared design surface plus any tenant-local design surfaces choose the concrete mechanism
- when a project realization model uses build tenants, `build_tenants/` is the project-owned realization root beneath one shared specification

Structurally, `requirements/` is a folder under `specification/`. Requirements may be stored as individual files or grouped into requirement families. The purpose of this shape is to avoid collapsing the constitutional surface into one monolithic requirements document.

This is one expression of the broader declarative bias: we prefer declaring requirement structure and family boundaries over maintaining one imperative catch-all document.

So if project-specific design and code disappeared, recovery would proceed through this methodology plus the surviving domain specification. Methodology alone can bootstrap the process; methodology plus domain specification can reconstruct the project.

---

## Constitutional Chain

```
Goals → Intent → Product → Requirements → Design → Code → Events → Projection → Delta
                                                                                       ↓
                                                                                  Scenarios
                                                                                       ↓
                                                                                Gap Analysis
                                                                                       ↓
                                                                    Repricing / New Goals / Intent
```

- **Goals** define the current overriding concerns for the active body of work.
- **Intent** defines purpose and direction.
- **Product** defines the current product realization, key terms, and end-state shape in terms that can be decomposed into requirements.
- **Requirements** define invariant truths the system must satisfy.
- **Design** defines the structural decisions, interfaces, carrier surfaces, and delivery topology that make those truths achievable.
- **ADRs** are one durable form of design record, not a second constitutional layer above design.
- **Code** realizes those decisions.
- **Events** record what actually happened.
- **Projection** reconstructs current truth from the event stream.
- **Delta** reveals drift between intended truth and realized state.
- **Scenarios** test operational meaning — can the system actually do the thing the words describe?
- **Gap analysis** identifies where real use cases hit the current model and reveal insufficiency.
- **Repricing** updates goals, intent, product, requirements, design, or code when the system no longer harmonizes. When gap analysis reveals constitutional insufficiency, it generates new **Goals** and/or **Intent**.

This is the homeostatic loop. Every link in the chain is load-bearing. A break at any link — goals with no downstream repricing path, an unowned requirement, an ungrounded design record, code without a design decision — creates accidental law.

`GOALS.md` is the bounded work-wave surface. It captures the current overriding concerns for the next body of work, keeps temporary focus out of deeper constitutional layers until it is intentionally repriced there, and is more immediate than intent while remaining higher-level than product definition and requirements.

`PRODUCT.md` is the bridge between direction and obligation. It states the current product realization in present-tense terms, names the product terms and boundaries that downstream layers rely on, and provides the surface that requirements decompose.

Requirements are the constitutional **what** of the project. They are not limited to user-visible product features. The live requirement surface may include capabilities, invariants, constraints, governance, and verification obligations. What matters is that each requirement states something the project must make true.

Design is the structural **how**. It chooses the concrete realization that satisfies requirement truth: interfaces, topology, file placement, carrier documents, entry/control surfaces, runtime wiring, and lawful tenant boundaries. Requirements may require such surfaces to exist and be delivered; design chooses where and how they are realized unless the path itself is constitutional.

---

## Change Management Rule

Every substantive change begins with an explicit declared change intent and a lawful
re-entry point into the constitutional chain.

The minimum lawful change classes are:

- `goal_reprice`: current bounded work-wave focus changes; re-enters at Goals and may flow through Intent, Product, Requirements, Design, Code, and Evidence where that focus changes deeper constitutional truth
- `intent_reprice`: directional or scope change; re-enters at Intent and flows through Product, Requirements, Design, Code, and Evidence
- `product_reprice`: current product realization changes while directional intent remains stable; re-enters at Product and flows through Requirements, Design, Code, and Evidence
- `requirement_reprice`: constitutional truth changes while project direction remains stable; re-enters at Requirements and flows through Design, Code, and Evidence
- `design_reframe`: realization structure changes while active intent and requirement truth remain stable; re-enters at Design and flows through Code and Evidence
- `realization_refactor`: local code, configuration, or attribute change with no intended constitutional or structural change; re-enters at the realized surface only and must prove no upstream drift

Smaller changes may re-enter below Goals only if they explicitly assert that no
upstream constitutional surface is changing.

The absence of a declared change class is process drift.

---

## Consistency Gate Rule

No gate may close while the affected active surfaces are internally inconsistent.

For the declared change span, the framework must prove:

- the upstream surface remains sufficient for the downstream surface
- downstream artifacts do not contradict active upstream truth
- tests and qualification prove the active intended behavior rather than stale precedent

If that proof is missing, the change remains open even if one local artifact already looks correct.

---

## Release Version Boundary

The only operative version identifier is the tapped release version.

That version is:

- a point-in-time release decision
- a boundary over the feature set accepted for that cut
- part of release metadata and release-process evaluation

It is not part of the live project specification.

Active constitutional and shared realization surfaces should therefore describe
current truth by role, boundary, and status rather than by release-line version
labels.

Release criteria, release taps, and the process for cutting a release belong to
a separate release process surface such as `RELEASE_METHOD.md`.

---

## Verification Layers

Each layer in the chain preserves a distinct kind of truth:

| Layer | What it preserves | What it catches |
|-------|-------------------|-----------------|
| **Requirements** | Invariant truth | "The system must do X" |
| **Design** | Structural choice | "We chose mechanism Y to satisfy X" |
| **Scenarios** | Operational meaning | "Can I actually do Z with this system?" |

Without scenarios, important capabilities can appear "covered" because the words exist in requirements and design. Scenarios force the sharper question: can the product *really* do the thing? A requirement can say "compositional graphs" and a design ADR can describe Fragment types, but only a scenario asks "can I model a reusable discovery workflow and apply it twice?"

Scenarios are the product-owner layer. They are concrete, end-to-end use cases that validate the chain from intent to realized behavior. When a scenario cannot be written, the capability is not yet real. When a scenario fails, the gap is between the system's actual behavior and its claimed capability — not between the spec's words and the spec's other words.

Scenarios do not replace requirement categories. They primarily validate capability claims and other behavior with concrete operational meaning. Constraints, governance rules, and verification-infrastructure requirements may require different evidence in addition to, or instead of, end-to-end scenarios.

---

## Test Authority Rule

Every live requirement must have written testcase authority.

That authority may include scenario bundles, ordered testcase sequences, negative
or control cases, and other explicit evidence cases as appropriate to the kind of
truth being proved, but it must exist in written form and be traceable.

No live requirement is considered fully proved if it relies only on informal
operator confidence, ambient habit, or an unlabeled test corpus.

---

## Scenario Bundle Rule

Features are not proved by isolated assertions alone.

Where a requirement claims meaningful system behavior, the proving surface should
be a scenario bundle or equivalent ordered set of testcases that exercises that
behavior through a coherent sequence rather than as disconnected fragments.

The purpose of the scenario bundle is to show:

- what feature or use-case boundary is being exercised
- which testcase sequence proves it
- what outcomes are expected at each significant step

This is the layer that makes operational meaning inspectable.

Declared scenarios and use cases are not downstream decoration. They put
pressure on feature intent and design decisions by forcing the project to name
the real operational boundary, sequence, actors, controls, and expected
outcomes that matter. For that reason, they are also the best source for
identifying the significant code and control paths that the proving surface must
exercise.

---

## Installed Dev Proof Rule

Where a system has an installable or runnable development form, the decisive
proving lane runs against an installed development version as if it were an
independent project or externalized target, not only against the source tree in
place.

That proof should prefer:

- fresh sandbox or equivalent isolated environment
- installed or built development artifact
- execution through the same declared entry/control/runtime surfaces the real
  product uses

Direct source-level or unit-level checks may remain useful, but they do not
replace installed-dev proof of the system under test.

---

## Significant Path Coverage Rule

The proving surface must declare and exercise the significant paths for the
behavior being claimed.

Exhaustive proof does not mean every possible branch in every file. It means the
project names the meaningful paths and proves them intentionally.

The significant paths usually include, where relevant:

- intended success path
- fail-closed or rejection path
- boundary or control path
- integration, dispatch, or transport path
- recovery, retry, or replay path

If the significant paths are not declared, scenario coverage cannot be judged.
If they are declared but not exercised, the behavior is not fully proved.

---

## Requirement Categories

Every live requirement family shall be categorized by what kind of truth it asserts. This prevents the common mistake of treating the entire requirement surface as if it were only a feature list.

| Category | Meaning | Typical question |
|----------|---------|------------------|
| **Capability** | A behavior, function, or surface the system must provide | "What can the system do?" |
| **Constraint / Guarantee** | An invariant, law, safety property, portability rule, or semantic guarantee that bounds how the system may behave | "What must always remain true?" |
| **Governance** | A policy or control rule over lifecycle, authority, visibility, release, or operator action | "What governs use and change?" |
| **Verification** | A requirement on tests, evidence, traceability, qualification, or forensic surfaces | "How do we know the claim is true?" |

Requirements remain part of the constitutional layer in all four cases. A category is not a priority label and not a claim that the requirement is user-facing. It is a statement of what kind of project truth the requirement owns.

The important distinction is:

- Requirements describe the full constitutional **what**.
- Design describes the structural **how**. ADRs are one durable design form.
- Scenarios validate the operational meaning of capability claims.

Therefore, not every requirement should be translated into a marketed "feature." Some requirements are better expressed as guarantees, constraints, governance rules, or verification obligations.

Requirements should also avoid freezing concrete realization choices prematurely. Unless a path, filename, or packaging rule is itself part of the constitutional truth, those choices belong to design rather than the requirement surface.

---

## Reconstruction Litmus Test

The methodology is specification-driven only if the layers are reconstructable in order:

1. Given **Goals**, a competent team should be able to derive a conformant **Intent** surface.
2. Given **Intent**, a competent team should be able to derive a conformant **Product** definition.
3. Given **Product**, a competent team should be able to derive conformant **Requirements**.
4. Given **Requirements** and a chosen technology stack, a competent team should be able to derive a conformant **Design**.
5. Given **Requirements + Design**, a competent team should be able to derive conformant **Code**.

This does not mean the derivation is unique. Different designs may satisfy the same requirements, and different codebases may satisfy the same design. The test is sufficiency, not determinism.

Failures at any boundary indicate a specification defect:

- If intent cannot be derived from goals, the goals surface is unclear, contradictory, or not concrete enough to orient the next bounded wave of work.
- If product cannot be derived from intent, the intent surface is too vague, contradictory, or not concrete enough to guide realization.
- If requirements cannot be derived from product, the product surface is underspecified, contradictory, or not decomposable enough to govern implementation.
- If design cannot be derived from requirements, the requirement surface is underspecified, contradictory, or polluted with accidental implementation detail.
- If code cannot be derived from requirements plus design, the design surface is incomplete, ambiguous, or not operational enough.

The purpose of ADRs and design documents is therefore not decorative explanation. They are the load-bearing bridge between constitutional truth and executable realization.

## Design Rule

Requirements state what control or delivery surfaces must exist.

Design decides the concrete mechanism that realizes them.

That boundary matters especially for agent-facing bootstrap and control surfaces:

- requirements may say that authoritative bootstrap or control surfaces must be present, carry bare axioms, and route to the canonical method
- design decides whether those surfaces are entry documents, embedded blocks, standalone compiled artifacts, or another lawful topology

If filenames and placement are hardcoded in requirements without constitutional necessity, the requirement surface has absorbed design detail and made re-derivation harder.

---

## Renewal Path

Intent is not only top-down. The full homeostatic cycle includes a reverse path where real use cases generate new intent:

```
Current spec → real-world use case → gap analysis → new goals / intent
```

This is how the system stays alive instead of becoming a frozen constitution. The generative rule:

1. A real use case (scenario, deployment, external review) hits the current model
2. Gap analysis identifies what the constitution cannot express
3. If the gap is constitutional (not just a missing implementation), new goals and/or intent are written
4. The repriced surface then flows forward through the chain: product → requirements → design → code

New intents emerge from repeated, real use-case pressure against the current model — not from abstract speculation. The gap must be concrete before it becomes intent. Ad hoc coding pressure does not generate intent; explicit gap analysis does.

This flow is not a one-pass waterfall computation. It is a cumulative iteration:

- requirements and design are refined over time
- code is repeatedly re-derived against the current constitutional surface
- gaps discovered during implementation, testing, replay, or scenario work feed back into repricing

What must remain stable is the full direction of authority: goals govern intent, intent governs product, product governs requirements, requirements govern design, and requirements plus design govern code, even when the project advances through many iterations.

---

## Ownership Rules

1. Every live requirement family must map to one or more owning design decisions.
2. Every ADR or other design record must ground itself in requirements via an explicit `Implements:` line.
3. Every live requirement family must have downstream closure: realized in design/code/tests, or explicitly deferred through an honest deferment surface.
4. Every shipping code or test behavior must trace back to live requirement and design authority.
5. Unowned requirements, ungrounded design records, deferred requirements without explicit deferment, and code without trace authority are design drift. When that happens, code becomes accidental law.

---

## Trace Closure Rule

Spec-driven development requires constitutional trace closure.

- No live requirement may remain as a free-floating statement of intent. If it is live, it must either:
  - be realized through the downstream chain, or
  - be explicitly deferred with an honest surface that records the deferment.
- No shipping code or tests may exist as ungoverned behavior. If behavior exists, it must trace back out to live requirements and the design decisions that authorize it.
- No hidden product surface is allowed. Behavior without trace authority is accidental law even if it "works."

Trace closure is stricter than documentation completeness. It is the rule that closes the constitution over realized behavior.

---

## Live Surface Immutability

The project may accumulate multiple live domain surfaces over time. A live surface is versioned constitutional history, not scratch space.

- Engine code, design documents, tests, and tooling may be refactored aggressively while they remain mutable implementation surfaces.
- Live domain artifacts, once published as live constitutional surfaces, are immutable in place.
- If a live domain artifact is wrong, the valid actions are:
  - supersede it with a new version, or
  - withdraw/delete it from the live surface.
- Transitional implementation paths, migration scaffolds, and fallback behaviors have no permanent authority in the live surface. Once superseded, they are deleted unless explicitly retained as compatibility features.

The past is preserved by version control, operational event history where present, and superseded constitutional artifacts. Spec-driven development does not require shipping compatibility shims forever, but it also does not allow silent mutation of live constitutional history.

---

## Fundamental Migration Rule

A fundamental migration is a constitutional reset, not an in-place refactor.

This rule applies when a project intentionally abandons a prior constitutional shape and re-derives itself on a new branch, version line, or methodology basis.

In that case:

- inherited constitutional documents from the prior line become migration source material, not live authority in the new line
- it is lawful to zero inherited constitutional surfaces on the migration line and rebuild them from first principles
- nothing carries forward by default; every retained statement, requirement, design choice, or guide rule must be explicitly re-adopted
- every carry-forward is intentional and should land in the correct layer: goals, intent, product, requirements, design, guide, or template
- old design and code may be used as reference implementations, but they do not govern the new constitutional surface unless explicitly re-derived and re-adopted
- absence from the new constitutional surface means "not yet adopted" and carries no automatic authority from the prior line

The purpose of this rule is to prevent accidental law from leaking through migration by mere inheritance. Fundamental migration is controlled adoption, not passive preservation.

When performing a fundamental migration:

1. Declare the migration line and treat the prior line as source material.
2. Establish fresh constitutional surfaces for method, goals, intent, product, requirements, and design.
3. Classify inherited material as adopted, superseded, deferred, or orphaned.
4. Copy forward only what is intentionally retained.
5. Re-derive downstream design and code from the new constitutional surfaces, not from ambient precedent.

This is a lawful form of supersession, not a violation of live-surface immutability, because the new line is creating a new constitutional surface rather than silently mutating the old one.

---

## Transformation Wave Rule

Refactor and migration should be understood as a transformation wave over mutable implementation surfaces.

While the wave is in flight:

- temporary mixed-state implementation may exist
- transitional adapters or scaffolds may exist
- refactor state may still carry traces of the prior operative model

When the wave lands:

- only the new current operative surface remains live
- prior operative paths are erased from the live product
- the path taken to get there survives only in version control, event history, and superseded records
- mixed old/new operative models are not a stable end state

The only lawful exception is an explicit compatibility feature.

If compatibility is retained, it must be:

- named as current product behavior
- justified in the specification
- bounded in scope
- tested as an intentional feature

Otherwise the correct action is deletion, not passive preservation.

---

## Legacy Classification Rule

Every inherited or legacy requirement must be classified as one of:

| Classification | Meaning | Action |
|---------------|---------|--------|
| **Deferred** | Retained in the live surface as an explicit not-yet-operative or not-yet-realized obligation | Keep with an honest deferment surface and do not present as current closure |
| **Superseded** | Ownership has moved to a newer constitutional surface or design decision | Add Implements/Supersedes to the governing design record |
| **Active** | Remains live constitutional law in the current surface | Must have an owning design decision — write or update one |
| **Orphaned** | No longer part of the intended system | Remove or explicitly supersede |

Nothing live may remain unclassified.

---

## Requirement Classification Rules

Every live requirement family must be classified on two independent axes:

1. **Lifecycle status**
   - Active
   - Deferred
   - Superseded
   - Orphaned
2. **Requirement category**
   - Capability
   - Constraint / Guarantee
   - Governance
   - Verification

These axes answer different questions. Lifecycle status says whether the requirement still belongs in the constitution and whether it is operative or explicitly deferred. Requirement category says what kind of project truth it asserts. A live requirement is incomplete if either axis is missing.

In project documents, this classification shall be explicit in requirement header metadata. `Status` carries lifecycle status. `Category` carries the requirement kind.

---

## Anti-Drift Rules

- If a requirement is active law, it must map to one or more owning design decisions.
- If a live requirement is not yet realized, it must be explicitly deferred rather than silently orphaned.
- If an ADR or other design artifact has no requirement grounding, it is design without constitutional authority.
- If code behavior has no design owner, the design has already drifted.
- If shipping code or tests cannot trace back out to live requirement and design authority, they are ungoverned product surface.
- If tests validate implementation habit rather than requirement truth, they lock in drift.
- If events and projection reveal persistent delta, either code is wrong or the requirement/design stack is stale.
- If a capability has requirements and design but no scenario, its operational meaning is unverified — it may be vaporware.
- If a requirement is treated as a product feature when it is actually a guarantee, governance rule, or verification obligation, the requirement surface has been misclassified.
- If intent cannot be re-derived from goals, requirements cannot be re-derived from product, design cannot be re-derived from requirements, or code cannot be re-derived from requirements plus design, the constitutional chain is broken.
- If a live constitutional artifact is corrected by in-place mutation rather than supersession or withdrawal, constitutional history has been corrupted.
- If a real use case reveals a gap not expressible in current requirements, a new intent is needed — not a code hack.

---

## Bootstrap Rule

The target constitutional shape for a project is:

- `.genesis/docs/standards/SPEC_METHOD.md` as process constitution
- `specification/GOALS.md` as current work-wave orientation
- `specification/INTENT.md` as domain direction
- `specification/PRODUCT.md` as current product realization
- `specification/requirements/` as the live requirement surface
- a live shared design surface
- any tenant-local design surfaces required by the realization model

If the realization model is tenanted, the target project topology also includes:

- `build_tenants/` as the project-owned realization root for one-to-many independent implementations of the shared specification
- `build_tenants/TENANT_REGISTRY.md` as the canonical registry of tenant families, variants, and activity state
- `build_tenants/common/` as the shared realization root for cross-tenant law
- `docs/` as project-owned supporting documentation

The corresponding folder shape is:

```text
specification/
├── standards/
│   ├── *_METHOD.md
│   ├── *_GUIDE.md
│   └── *_TEMPLATE.md
├── GOALS.md
├── INTENT.md
├── PRODUCT.md
└── requirements/
    └── *.md

```

This shape is structural rather than exhaustive. It declares where constitutional specification and realization-law surfaces belong. Concrete implementation layout remains a design decision unless separately ratified.

Projects do not need to start with a complete `requirements/` tree on day zero.

Requirements may be sourced from any legitimate constitutional input, including:

- `GOALS.md`
- `INTENT.md`
- `PRODUCT.md`
- existing requirement documents
- imported standards or policy material
- prior project versions
- migration or repricing source material

Most projects begin by deriving `INTENT.md` from `GOALS.md`, then `PRODUCT.md` from `INTENT.md`, then the first requirement surface from the product definition, but that is the usual starting point, not the only lawful source.

The bootstrap sequence is:

1. Establish or install `.genesis/docs/standards/SPEC_METHOD.md`.
2. Write or confirm `GOALS.md`.
3. Run the `goals → intent` step and write or confirm `INTENT.md`.
4. Run the `intent → product` step and write or confirm `PRODUCT.md`.
5. Gather the requirement source material relevant to the project.
6. Run the `product → requirements` step and write the resulting live surface under `requirements/`.
7. Store requirements as individual files or grouped requirement families, whichever yields the clearest constitutional surface.
8. Classify each live requirement family by lifecycle status and requirement category.
9. Treat `requirements/` as the authoritative requirement surface going forward.

Once `requirements/` exists as the live constitutional surface, no rival monolithic requirements document should remain co-equal authority with it.

This rule exists to keep the requirement surface structurally clear, derivable, and non-monolithic.

---

## Method

When a feature is introduced or changed:

1. Update **Goals** if the current bounded work wave or overriding concerns have changed.
2. Update **Intent** if the purpose or scope has changed.
3. Update **Product** if the current product realization, terms, boundaries, or end-state shape have changed.
4. Update **Requirements** so the invariant truths are explicit as a decomposition of the product definition, and classify each new or changed requirement by category.
5. Update or write **Design** so the governing structural choice is explicit. ADRs are one valid design form.
6. Write **Scenarios** for capability claims that require operational proof, and define other evidence surfaces for non-capability requirements where appropriate.
7. Prefer declarative expression of the problem and acceptance surface before adding imperative mechanism.
8. Check the reconstruction boundary: can the current goals support the current intent, can the current intent support the current product, can the current product support the intended requirements, can the current requirements support the intended design, and can the current design support the intended implementation?
9. Only then implement **Code**.
10. Use **Events, Projection, and Delta** to verify whether reality still satisfies the requirements.

When bootstrapping a project or repricing a requirement surface:

1. Start from `.genesis/docs/standards/SPEC_METHOD.md` and `GOALS.md`.
2. Perform the `goals → intent` step and write or confirm `INTENT.md`.
3. Perform the `intent → product` step and write or confirm `PRODUCT.md` as the current product-definition bridge.
4. Gather requirement source material from the relevant constitutional inputs.
5. Perform the `product → requirements` step and write the resulting live surface under `requirements/`.
6. Store requirements as individual files or grouped requirement families, whichever best preserves clarity and avoids monolithic sprawl.
7. Make `requirements/` the sole live requirement authority before proceeding to design and code.
8. Prefer declarative structure over procedural workaround while shaping the new requirement surface.
9. Only after that surface exists should downstream design and implementation be treated as constitutionally grounded.

When a real use case reveals a gap:

1. Write the **Scenario** first — make the gap concrete and testable.
2. Run **Gap Analysis** — is this a missing implementation or a constitutional insufficiency?
3. If constitutional: reprice **Goals** when the current work wave changes, write a new **Intent**, then flow forward (product → requirements → design → code).
4. If implementation: write requirements/design as needed, then implement.

---

## ADR Conventions

Each ADR should explicitly include:

| Field | Purpose |
|-------|---------|
| `Implements:` | REQ-* IDs this ADR makes true |
| `Derives from:` | INT-* or strategy document that motivated the decision |
| `Supersedes:` | Prior ADR or doctrine this replaces |
| `Degenerate case:` | When earlier behavior is intentionally retained as a special case of the current surface |

Write ADRs per decision boundary, not per requirement file. The question is: "what design choice makes these ACs true?" That is the ADR boundary.

If a requirement names an operational mechanism, the ADR must name that mechanism too. If a requirement expands the event taxonomy, the EC ADR must be repriced immediately — event semantics must not drift into a second constitution.

---

## Stone Version

Spec-driven development treats specification as constitutional source, not commentary on code. Methodology defines the process constitution. Intent and requirements define the project constitution. Requirements define the full constitutional what: capabilities, guarantees, governance, and verification obligations. Design defines the structural how, and ADRs are one durable form of that design record. Scenarios verify operational meaning where capability claims need end-to-end proof. Code realizes decisions. Design must be derivable from intent and requirements; code must be derivable from requirements and design. Iteration is cumulative repricing, not waterfall. Events, projection, and delta reveal drift. Every live requirement family must have design ownership, explicit classification, and downstream closure or explicit deferment. Every design record must ground itself in requirements. Shipping behavior must trace back to constitutional authority. Live constitutional surfaces are versioned history and must change by supersession or withdrawal, not silent in-place mutation. New intent emerges from real use cases hitting the current model — through explicit gap analysis, not ad hoc pressure.
