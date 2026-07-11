---
id: T-032
title: Reprice odd_manager around the multi-project developer build control loop
type: feature
ticket_category: ordinary
status: active
review_status: ready_for_operator_review
proof_status: manager_mvp_verified_live_odd_glc_blocked
goal: establish-multi-project-developer-build-control
owner: codex
change_intent: >-
  Refine odd_manager around its first primary persona: a developer who manages
  multiple Spec Method and ODD-governed Projects, reviews and tunes
  specification through attributable prompting, executes builds concurrently,
  supervises their progress, and verifies that every required gate and asset is
  delivered.
change_class: product_reprice
re_entry_point: product_definition
affected_boundary: >-
  specification intent, product definition, current goals, domain model,
  operator-workbench and process-lens requirements, new build-control and
  assurance requirements, developer scenarios, UX design modules, and
  downstream command-carrier and React realization tickets
priority: critical
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-12T00:03:57+10:00
dependencies: []
sprint: SPRINT-2026-07-10-abg46-observation-reprice
related_work:
  - T-031
design_commentary:
  - .ai-workspace/comments/operator/20260711T025804Z_STRATEGY_modular-integrated-developer-control-capabilities.md
governance_scope: STDO Method, ODD Method, STDO-UX Method, GTL/ABG command and runtime boundaries
intake_source: >-
  Operator persona refinement on 2026-07-11: the first odd_manager persona is
  a developer managing many Spec Method/ODD Projects who reviews and tunes
  specification, triggers concurrent builds, observes execution, and ensures
  all build gates and assets are delivered.
target_truth: >-
  odd_manager is a goal-oriented developer control plane over a portfolio of
  governed Projects. It lets the developer move each selected specification
  revision through review, proposed specification change, admitted semantic
  build submission, concurrent execution supervision, and evidence-backed
  gate/asset closure. The manager owns portfolio coordination, command
  admission, scheduling, process lifecycle, operator interaction, and
  attention routing while GTL/odd_glc owns the published build program and ABG
  owns traversal, continuation, evidence, and runtime closure truth.
superseded_truth: >-
  odd_manager is primarily a read-oriented single-Project artifact and run
  inspector in which the developer must infer project readiness, tune
  specification outside the product, launch builds through terminal knowledge,
  and reconstruct gate or asset completion from separate observation surfaces.
closure_law: >-
  Close this product-reprice ticket only when live constitutional product truth
  names the developer persona and primary interaction goal, defines the
  multi-Project review-tune-build-assure loop, reconciles manager command
  authority with GTL/ABG runtime ownership, and admits traceable requirements
  and scenarios for portfolio observation, specification proposals, concurrent
  build control, live supervision, attention handling, and gate/asset
  assurance. Downstream design and tenant-local realization work must be
  ticketed separately; a speculative Build button or shell-command wrapper is
  not closure.
evaluation_criteria:
  - The first primary persona is explicitly the developer operating multiple Spec Method/ODD-governed Projects through odd_glc or another admitted domain package.
  - The primary interaction goal is stated as moving selected Project revisions from governed specification through assured build completion.
  - The product defines portfolio, Project, build, intervention, and forensic observation levels and the transitions between them.
  - The product defines one coherent Review -> Tune -> Build -> Assure interaction loop instead of treating artifact inspection as the user's end goal.
  - Specification prompting produces attributable proposals against named authority surfaces, with diff, validation, and explicit acceptance or rejection before constitutional truth changes.
  - Build submission is a typed product command over an admitted Job, GraphFunction, workorder, or equivalent published carrier and is pinned to Project and source/specification revision identity.
  - Concurrent builds expose queued, starting, running, waiting-human, converged, failed, cancelled, and stale or disconnected posture without creating manager-owned runtime truth.
  - Gate and asset assurance distinguishes required, delivered, failed, missing, stale, and unsupported states and links every closure claim to source evidence.
  - Attention and reaction semantics cover deterministic failure, probabilistic work, human gates, stale heartbeat, proof mismatch, specification drift, cancellation, retry, and lawful re-entry.
  - Existing AI Workspace and Run Inspector capabilities are positioned as supporting project and forensic observation surfaces within the developer control loop.
  - The registered Project deep link has a ratified goal-oriented Project landing target, even if its implementation remains a downstream ticket.
  - Separate downstream tickets exist for the command carrier, portfolio/workbench design, specification proposal workflow, build supervision, assurance matrix, and tenant-local UX realization.
proof_surface:
  - specification/INTENT.md
  - specification/PRODUCT.md
  - specification/GOALS.md
  - specification/domain/DOMAIN_MODEL.md
  - specification/requirements/06-operator-workbench.md
  - specification/requirements/10-entry-lenses-and-delivery-workspaces.md
  - specification/requirements/
  - specification/scenarios/
  - build_tenants/common/design/
  - downstream tickets linked from T-032
non_closure_conditions:
  - The persona exists only in this ticket or commentary and is absent from live product authority.
  - The product still describes itself as read-oriented without defining lawful build submission and supervision authority.
  - Multi-Project operation is reduced to a project selector with no portfolio attention or concurrent-build model.
  - Specification prompting can mutate constitutional files without a visible proposal, deterministic validation, attribution, and explicit acceptance path.
  - A Build action constructs an opaque shell command in the view or bypasses a typed admitted product carrier.
  - odd_manager chooses graph traversal, continuation, retry policy, evidence admission, or runtime closure on ABG's behalf.
  - Gate completion is inferred from UI state, process exit, or log text without evidence-backed gate and asset carriers.
  - AI Workspace or Run Inspector remains the primary destination and artifact inspection is presented as completion of the developer's interaction goal.
  - React implementation begins without ratified product, requirement, scenario, command-carrier, and STDO-UX design authority.
---

# T-032: Multi-Project Developer Build Control

## Triage

Smallest lawful re-entry point: product definition.

The current intent already calls `odd_manager` an operator-facing control plane
and requires governed, auditable, and operable systems. Current realization is
strongest at retrospective Project and run observation. It does not yet define
the first persona's complete goal or the manager's lawful command authority for
moving a Project into a build. That missing product shape must be resolved
before adding controls or another entry lens.

## Persona

The first primary persona is a developer who:

- manages multiple software Projects governed by Spec Method and ODD;
- uses `odd_glc` or another admitted domain package to build software;
- reviews a Project's specification and delivery posture;
- tunes specification through contextual, attributable prompting;
- executes multiple Project builds concurrently;
- supervises live builds and intervenes when authority or repair is required;
- verifies that all required gates, proof, and material assets are delivered.

The persona is shorthand for one interaction goal, not a demographic profile.

## Primary Interaction Goal

Move one or more governed Project revisions from current specification intent
to evidence-backed, gate-complete build outcomes while preserving authority,
runtime ownership, and the ability to re-enter at the correct constitutional
layer when a build exposes a gap.

The developer's loop is:

```text
portfolio attention
  -> review Project
  -> tune specification through proposal
  -> validate and accept the proposal
  -> submit admitted build
  -> supervise concurrent execution
  -> inspect required gates and assets
  -> converge, repair, or lawfully re-enter
```

## Observation, Interaction, And Reaction

| Level | Developer question | Required observation | Primary interaction | Product reaction |
| --- | --- | --- | --- | --- |
| Portfolio | Which Projects need attention? | Project identity, source/spec revision, readiness, active builds, gate posture, blockers, participants, freshness | Select, filter, queue, prioritize, pause, cancel | Keep state live, rank explicit attention conditions, preserve per-Project context |
| Project | Is this Project ready to build? | Specification delta, requirements, design/proof coverage, tickets, latest and active runs | Review authority, attach context, open a tuning interaction | Preserve framing and show the impact of proposed or accepted change |
| Tune | What must change before building? | Exact authority source, affected downstream surfaces, validation result, proposal lineage | Prompt, inspect diff, refine, accept, reject | Apply only admitted changes and expose resulting readiness delta |
| Build | Is execution progressing lawfully? | Queue state, admitted command, revision identity, run identity, current graph/runtime posture, heartbeat | Submit, attach, approve human gate, cancel, retry through admitted policy | Correlate command and run events without choosing ABG continuation |
| Assure | Did the build deliver everything required? | Required and delivered gates/assets, evidence, provenance, freshness, failures and residuals | Drill into evidence, compare runs, request repair, accept outcome | Converge only from admitted evidence or route an explicit re-entry |
| Forensic | Why did this fail or diverge? | Graph, traversal, events, diagnostics, transcripts, artifacts, proof digests | Inspect source truth and open contextual repair work | Retain Run Inspector as deep evidence, not the top-level user goal |

## Product Boundary To Ratify

`odd_manager` may:

- admit a typed build request against a published semantic carrier;
- schedule many admitted requests subject to explicit resource policy;
- start, attach to, cancel, and report external process lifecycle;
- collect and project command, run, gate, asset, and attention state;
- submit explicit human decisions and policy-authorized retry requests;
- route the developer into specification, requirement, design, or realization
  re-entry.

`odd_manager` must not:

- invent a build program when no published carrier exists;
- encode the build as view-owned shell text;
- choose GTL traversal or ABG continuation;
- manufacture evidence, gate satisfaction, or closure;
- allow an agent proposal to become constitutional truth through prompting
  alone.

## Required Product Surfaces

1. **Build Portfolio** - dense cross-Project readiness, queue, run, gate, asset,
   and attention posture.
2. **Project Workbench** - one `Review -> Tune -> Build -> Assure` surface and
   the default destination for a Project deep link.
3. **Specification Proposal Workspace** - contextual prompting, authority
   attachments, proposed diff, validation, attribution, and accept/reject.
4. **Build Submission And Supervision** - typed request, concurrency posture,
   live lifecycle, participant visibility, and bounded commands.
5. **Gate And Asset Assurance Matrix** - required-versus-delivered state with
   source evidence and explicit residuals.
6. **Attention Queue** - failures, human decisions, stale state, proof mismatch,
   specification drift, and lawful re-entry actions.
7. **Run Inspector** - deep runtime and proof investigation reached from the
   Project/build context.

## First Steel Thread

Use the `odd_glc` data-mapper Project as the first full interaction proof:

```text
deep-link Project
  -> review specification and readiness
  -> prompt one scoped proposal
  -> inspect validation and accept the diff
  -> submit the published data-mapper build carrier
  -> observe its live ABG run
  -> verify every required gate and asset
  -> converge or create a traceable re-entry action
```

The steel thread must prove the generic product contracts. It must not create an
`odd_glc`-specific manager runtime or duplicate ABG policy in the UI.

## Sequencing

1. Ratify persona, interaction goal, product command boundary, and terminology.
2. Reprice goals, domain model, requirements, and scenarios.
3. Publish the typed build-request and build-portfolio contracts upstream of UX.
4. Ratify STDO-UX design modules and Msg/Cmd interaction families.
5. Issue tenant-local realization tickets for the React carrier.
6. Prove the data-mapper steel thread, including concurrent execution and
   negative authority tests.

## Excluded From This Ticket

- implementing Build controls in React;
- inventing a generic scheduler before its product contract is ratified;
- modifying `odd_glc`, ABG, or GTL source authority;
- claiming implementation closure from the existing read-only Run Inspector.

## Execution Status 2026-07-11

The product reprice and manager-owned MVP are implemented through W22. The
capability host now composes one Portfolio, Project Workbench, Specification
Proposal, Build Control, Assurance and Attention, and supporting Run
Observation boundary around shared Project/revision Context and correlated
commands. The generic Review -> Tune -> Build -> Assure journey, concurrent
real-process supervision, negative authority paths, replay, runtime, desktop,
and mobile proof are automation-verified.

Production adapter installation is now an explicit manager-local,
digest-pinned authority surface rather than an unimplemented constructor
parameter. Product descriptors can name installed identities only; they cannot
install modules or provide process plans.

The final scenario audit also closes stale proposal regeneration, exact
attention-source routing, context-preserving forensic drilldown, and
stale/disconnected external execution recovery. Approval, retry, repair, and
human decisions remain product-carrier-owned reactions; odd_manager exposes
them only when an admitted catalog publishes the command.

T-032 remains active for operator review and the named live odd_glc steel
thread. odd_glc has not published its non-test Build Carrier Descriptor,
execution adapter, Assurance Catalog, or build evidence bundle, and the
upstream ABIogenesis candidate still requires F_H promotion. The manager fails
closed at that boundary and does not substitute fixture or shell execution for
product truth.

## Prime Active Role 2026-07-11

T-032 is the one active owner for the developer-control product and its live
external steel thread. T-034 and T-035 are accepted completed capability
slices. The manager-owned portions of T-036 through T-039 are also accepted;
their repeated live-product residual is compressed here rather than copied
across four active tickets.

The remaining closure facts are exact:

- odd_glc must publish a non-test Build Carrier Descriptor;
- odd_glc must publish a digest-pinned execution adapter module;
- odd_glc must publish an Assurance Catalog and matching build evidence bundle;
- the upstream ABIogenesis candidate still requires F_H promotion;
- the resulting live data-mapper journey must satisfy the T-032 and sprint
  closure laws without fixture or shell substitution.

## External Carrier Dependency Audit 2026-07-11

The live external residual is sequenced by ABIogenesis `GOAL-035`, not by an
odd_manager implementation gap. Its current dependency order is:

```text
DS-1  ABIogenesis T-223
  -> DS-1F T-225
  -> DS-2 T-226/T-179 design and T-227/T-228 realization
  -> DS-3 operator product
  -> DS-4/DS-4Q conformance and qualification
  -> DS-5 T-234 installed self-hosted R5/I1
  -> DS-6 odd_glc T-033 design and T-038 realization/campaign
  -> manager-callable odd_glc carrier and live T-032 steel thread
```

T-223 is the current executable leaf. odd_glc T-033 is explicitly queued
behind ABIogenesis T-226 and T-179 design. odd_glc T-038 requires T-033 plus
ABIogenesis T-223, T-227, T-228, and T-234. Its manager-callable carrier ticket
T-034 also waits for T-033. odd_manager therefore must remain fail closed and
must not bypass the phase order with a shell plan, fixture carrier, or local
substitute descriptor.

## Prime-Set Workbench UX Iteration 2026-07-11

The live product posture now distinguishes the implemented manager MVP from
that external steel-thread residual. The Project Workbench identity strip no
longer projects an ambiguous global `READY`; admitted capability contributions
remain the one availability truth and are now projected through phase controls
and active module detail. This keeps Project identity, capability admission,
build lifecycle, and assurance truth on separate clean boundaries.

Final proof for this iteration:

- `npm run test:runtime:node`: 266 tests, 262 passed, 4 environment-dependent
  screen tests skipped, 0 failed;
- `npx tsc --noEmit`: passed;
- `npm run build`: passed with the existing Vite large-chunk warning;
- `npx playwright test`: 44/44 passed in 4.4 minutes;
- `git diff --check`: passed.

## Project Workbench Phase Availability Compression 2026-07-11

REQ-OM-DEV-001 requires the developer to determine current phase, outstanding
obligation, and next lawful interaction without reconstructing unrelated
screens. The integrated review found that the four phase controls, a separate
six-row status sidebar, and each active capability header repeated related
posture while the sidebar reduced the primary workspace by roughly one quarter.

The Workbench now uses one admitted contribution path in two lawful skins:

- compact `available`, `unavailable`, stale, unsupported, or error state in the
  corresponding Review, Tune, Build, or Assure phase control;
- full capability state, reason, and source references in the active module.

Run Observation retains its supporting contribution status. Project Workbench
does not copy capability state, infer phase completion, or add any command. The
separate sidebar is removed and the active capability receives the full canvas
width. Desktop and 390px mobile proof covers all phase states and exact missing
carrier reason projection.

Final proof: host boundary 10/10; focused Workbench browser 2/2; corrected
real-process workflows 2/2; runtime/replay 266/266; TypeScript passed;
production build passed with the existing chunk warning; Playwright 44/44 in
4.5 minutes; live desktop/mobile review had no overflow or console errors; and
`git diff --check` passed.

This iteration changes no external-carrier dependency. The ABIogenesis and
odd_glc DS sequence recorded above remains the live T-032 steel-thread gate.

## Source-Attributed Next Interaction Iteration 2026-07-11

REQ-OM-DEV-001 and REQ-OM-DEV-003 require outstanding obligations to expose a
traceable next lawful interaction. Build Portfolio previously routed attention
correctly but labeled every action `Open source`, forcing the developer to infer
the destination.

One total Build Portfolio selector now owns both command and display truth:

```text
revision | specification        -> specification-proposal -> Open Tune
build-carrier | build-execution -> build-control          -> Open Build
other source kinds              -> assurance-attention    -> Open Assure
```

The reducer uses the selector's capability ID for
`portfolio.open-attention`; the view uses its action label. The fallback is
Assure because unknown evidence must remain inspectable and cannot be promoted
to closure. No new state, command kind, capability import, or route table was
introduced.

The focused TypeScript replay harness was extended to resolve local runtime
imports recursively as compiled data URLs. This preserves the prime selector
module instead of forcing reducer-local duplication for test convenience.

Final proof: focused host/selector 11/11; focused three-route browser 1/1;
runtime/replay 267/267; TypeScript passed; production build passed with the
existing chunk warning; Playwright 45/45 in 4.9 minutes; desktop/mobile live
review had no overflow or console errors; and `git diff --check` passed.

The external odd_glc carrier sequence remains unchanged.

## Review-To-Tune Context Continuity 2026-07-12

REQ-OM-DEV-003 and REQ-OM-SPC-002 require an attention transition to retain the
source that justifies it. `Open Tune` previously changed phase but left the
proposal composer with no attached attention context.

The host now forwards the admitted attention `sourceRef` only after the target
Project Context matches. It uses the existing `proposal/context-attached` Msg
with an optional direct `sourceRef`; manual Attach continues to consume the
visible draft through the same reducer branch. Both paths share the 12-ref
bound, deduplication, removal, and proposal-generation payload. The handoff
cannot inject prompt text, patch content, proposal status, or constitutional
mutation.

Project Context change now clears all candidate drafts and attachments before
new history admission. Same-Project revision refresh retains explicit context.
Replay proves both sides of that boundary, and browser proof verifies the exact
`git://` attention source is visible in Tune before generation.

Final proof: focused proposal replay 6/6; focused three-route browser 1/1;
runtime/replay 268/268; TypeScript passed; production build passed with the
existing chunk warning; Playwright 45/45 in 4.6 minutes; desktop/mobile live
review had no overflow or console errors; and `git diff --check` passed.

The external odd_glc carrier sequence remains unchanged.
