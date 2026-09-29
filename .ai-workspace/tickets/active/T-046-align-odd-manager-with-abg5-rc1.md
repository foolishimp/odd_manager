---
id: T-046
title: Align odd_manager with the current ABIogenesis 5.0 RC1 candidate
type: feature
ticket_category: ordinary
status: active
review_status: i01_r2_satisfied_executive_accepted
proof_status: i01_exact_successor_installed_proof_passed_remaining_iterations_open
goal: G-009
build_tenant: react_vite
owner: unassigned
priority: high
triaged_at: 2026-09-29
created_at: 2026-09-29
updated_at: 2026-09-29
intake_source: Direct Product-owner request to align odd_manager with current ABIogenesis work, inspect the latest runs and model, and give the work its own ticket and iterative sprint
change_intent: make current ABG 5 runs discoverable and explainable through the existing manager model and Run Inspector as RC1 debugging converges
change_class: requirement_reprice
re_entry_point: requirements_current_external_contract
affected_boundary: current ABG observation contract, React/Vite adapters and projections, inspector detail, exact installed qualification
selected_method_basis: stdo_odd_manager.json#/constitution/stdo/basis
sprint: SPRINT-2026-09-29-abg5-rc1-alignment
requirements:
  - REQ-OM-ABG-001
  - REQ-OM-ABG-002
  - REQ-OM-ABG-003
  - REQ-OM-ABG-004
  - REQ-OM-ABG-005
  - REQ-OM-ABG-006
  - REQ-OM-ABG-007
  - REQ-OM-ABG-008
  - REQ-OM-ABG-009
  - REQ-OM-ABG-010
target_truth: the manager presents exact admitted ABG identities, event history and published read projections through its existing control-plane capabilities
superseded_truth: the historical dev.286 adapter and scenario proof filenames are sufficient to interpret the current ABG 5 candidate
closure_law: close on the bounded installed observation outcome and explicit disposition of every task, with exact candidate and evidence identities; retain separate ticket and release acceptance boundaries
evaluation_criteria: current-run discovery, physical and logical event integrity, per-Run status, causal drill-down, provenance, installed browser use and bounded negative cases
non_closure_conditions: source-only probes, transient fixtures, inferred runtime facts, inherited acceptance, or an unqualified general RC1 compatibility label
proof_surface: exact compatibility manifest and portable fixtures, runtime/replay tests, installed server/browser evidence and sprint close review
---

# T-046: ABG 5.0 RC1 Alignment

## Outcome And Intake

An operator can open the current ABIogenesis runs in `odd_manager`, understand
their actual status, inspect the selected graph and call, and trace results,
retained work and assurance to their admitted evidence.

The Product owner expects minor changes while ABIogenesis is actively debugging.
Keep the existing Project/Workspace, Project Workbench, Build Execution and Run
Observation model, capability host, shell and Run Inspector. The first missing
layer is the requirement binding to the current external event profile and
per-Run status contract. Reprice those bounded clauses under unchanged Product
intent, bind the common design, then make bounded realization changes. A new
Product model or ABG runtime architecture is not the premise of this ticket.

This durable ticket owns the current-candidate integration outcome. The
[dedicated sprint](../../sprints/SPRINT-2026-09-29-abg5-rc1-alignment.md) owns
iteration selection and close review. Existing tickets remain the owners of
their narrower capabilities and acceptance records; this ticket neither
duplicates nor silently closes them.

## Authority

- [G-009 and current wave](../../../specification/GOALS.md#goal-selection),
  [Intent](../../../specification/INTENT.md),
  [Product](../../../specification/PRODUCT.md) and
  [domain model](../../../specification/domain/DOMAIN_MODEL.md).
- [Observation requirements](../../../specification/requirements/16-abg-event-stream-compatibility.md).
- [Event compatibility design](../../../build_tenants/common/design/ABG_EVENT_STREAM_COMPATIBILITY.md)
  and [visual runtime design](../../../build_tenants/common/design/VISUAL_GRAPH_RUNTIME_OBSERVATION.md),
  each with its recorded acceptance boundary.
- [Project frame basis](../../../specification/REFERENCE_FRAME_BASIS.md) and
  the exact STDO basis selected by `stdo_odd_manager.json`. The current
  2.5.1 selection and finite activation are recorded below; earlier evidence
  retains its original basis.

## Starting Evidence

The inspected source is `../abiogenesis` on `main`, HEAD
`8a21b20fb624adc29f2ac9ca688c7032217afe48`, with concurrent uncommitted debugging
work. That checkout is a discovery reference, not the identity of either
installed witness. Its package version is `5.0.0-rc.1`; whole-release
qualification remains open. Exact archive and run identities govern each
observation claim.

| Subject | Evidence and bounded meaning |
| --- | --- |
| S6 installed LIVE05 | [Return](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s6-raw-contract-01/installed-live-05/run-return.md), [freeze](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s6-raw-contract-01/installed-live-05/run-freeze.json), [review](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s6-raw-contract-01/installed-live-05/review.md). Accepted lifecycle witness: baseline failure, correction, retest, specification, design, independent UAT and Run closure at ordinal 26582. Four authored assets and seven support obligations. Core SHA-256 `1722953b7391e593079e3436b729b13c55457c734fb441d5e08b604edf9c462d`. |
| Newer S7 retained-work pair | [First return](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s7-pending-consumer-01/source-use-installed-01/first-run-return.md), [fresh return](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s7-pending-consumer-01/source-use-installed-01/fresh-run-return.md), [freeze](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s7-pending-consumer-01/source-use-installed-01/fresh-run-freeze.json), [review](../../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE/s7-pending-consumer-01/source-use-installed-01/review.md). The first Run stops on a genuine gap at ordinal 2318; its replay is `blocked` and no terminal Result exists. A fresh invocation preserves original producer identity, performs new independent assessment and closes at shared-ledger ordinal 4485. Core SHA-256 `c4bff846362ac59cd928fffcacb6a33a669c178d0380d03aea6c1e3b1fbd9ee1`. |

The S7 fresh ledger contains two Runs and 13 admitted-body reference storage
records. Fresh use of retained work is qualified by this witness; exact
`current_intent` resumption is a separate, still-evolving upstream capability.
Earlier failed S6 attempts remain negative evidence, not completed runs.

At intake, the manager rejected these event streams at the first envelope because
`eventContractDigest` was unsupported. Discovery also expected historical
sandbox/generic evidence carriers, and several projections depended on legacy
vector or scenario-proof filenames. Those intake gaps selected the sequence
below; the I-01 disposition records the accepted bounded repair.

## Required Changes

Paths in this table are relative to `build_tenants/react_vite/` unless stated.
Rows are work scope, not completed changes or newly ratified design.

| Task | Required change and completion evidence | Existing owner / implementation seam |
| --- | --- | --- |
| A-01 Event admission | Bind the current published event profile, including `eventContractDigest`; decode admitted-body references before semantic validation. Preserve the physical byte-prefix identity separately from restored logical events. Broken references, wrong digests and unknown profiles give explicit diagnostics. | T-042; `src/server/abg-event-carrier-service.mjs`, `src/server/abi5-root-event-contract.mjs` |
| A-02 Run discovery | Discover published Run references, digests and prefixes without requiring a scenario proof or sandbox identity shape. Admit multiple Runs in one history, select the requested Run, and retain source-event dependencies needed for decoding and provenance. | T-042; `src/server/project-observation-topology-service.mjs` |
| A-03 Runtime status | Project the published status/replay contract and its freshness/coverage. Preserve blocked, held, stopped, refused, failed and closed meanings where supplied. Keep process/native liveness separately evidenced. A child closure or failure cannot decide the whole Run. | T-042/T-043; observation contract, event and observation services |
| A-04 Traversal and call detail | Join exact GraphCall, runtime Frame, CCall, attempt, input, Result, evaluation and parent foldback identities. Provide bounded inspector drill-down without requiring legacy vector files. | T-043/T-044 and T-040 presentation; observation, traversal and visual graph projections |
| A-05 Catalog and declaration graph | Read the published catalog and exact Program, GraphFunction and overlay bodies. Populate declaration nodes/edges and connect occurrences to their definitions; runtime registry events are insufficient as the catalog source. | T-040; `src/server/abg-run-observation-service.mjs`, `src/server/visual-graph-projection-service.mjs` |
| A-06 Retained-work provenance | Show source Result, original producer/call/actor, current use and new assessment as distinct relations. The S7 pair must preserve old attribution while showing new Run closure. Distinguish fresh reuse from exact continuation. | T-043/T-044; shared identity contracts and occurrence projection |
| A-07 Assets and assurance | Project admitted Results, workspace effects/observations and support obligations. Show S6's four authored assets and seven obligations with their evidence; use domain overlays for domain meaning instead of generic scenario filenames. | T-044; asset, assurance and workspace projection seams |
| A-08 Context and actor explanation | Distinguish manager UI Context, governance/reference-frame context and ABG runtime Frame. Show admitted selection reasons, actor input/output and session capability only where the carrier provides them. | T-040/T-044; shared contracts and Run Inspector |
| A-09 Baseline and qualification | Refresh model/design/requirement references only where the inspected contract requires it. Replace the stale dev.286 development baseline with exact selected candidate identities and portable or reproducibly resolved evidence. Qualify each delivered slice through installed server/browser use, including negative cases. | T-046 integration; T-045 exact compatibility qualification |
| A-10 Operational capability disposition | Map supported published invoke/start/intervention capabilities and record absent or unqualified operations. Recheck `current_intent` and `selected_action` when upstream evidence exists. External Build/Assure remains T-032; native human-response work reserved upstream for 5.1 is not an RC1 observation dependency. | T-032 plus T-046 capability disposition; no new control admitted by an observation adapter |

## First Deliverable

The bounded I-01 outcome is accepted on the exact W2 successor under the
[recorded R2 judgment and E01 disposition](../../comments/codex/20260929_T046_ABG5_ALIGNMENT/20260929T061233_REVIEW_I01-disposition.md#e01-disposition-and-next-frontier).
The following criteria retain the first deliverable's scope.

Re-enter `REQ-OM-ABG-002`'s old dev.286 digest binding and
`REQ-OM-ABG-003`'s terminal-only status clauses at Requirements. Bind the
published current profile and per-Run read semantics in common design before
realization. This scoped `requirement_reprice` follows the direct alignment
instruction and changes no Product intent or ABG-owned runtime meaning.

Complete A-01 through A-03, enough A-04 to inspect a selected call, and the
matching A-09 qualification. From the existing Project and Run Inspector:

- discover S6 LIVE05 and both S7 Run identities;
- open bounded event pages and detail without reading the whole ledger into
  browser state;
- reconcile S6's closed status, S7's blocked source Run and its distinct closed
  fresh Run with the published reads;
- retain event ordering, source references, lazy detail and stale-generation
  rejection through referenced-body decoding and a shared ledger;
- show failures and non-terminal prefixes truthfully, including child-terminal
  counterexamples, without inventing process liveness.

Portable fixture/manifest resolution and an installed browser path are part of
this deliverable. The missing `/private/tmp` dev.286 archive used by retained
T-040 proof is a fixture dependency to replace, not proof that the present
implementation has failed its semantic contract.

## Ownership And Completion

- [T-040](T-040-restore-visual-graph-traversal-and-contextual-pty-observation.md)
  retains graph, workspace and actor-session presentation ownership.
- [T-042](T-042-admit-proof-independent-abg-event-stream-observation.md),
  [T-043](../backlog/T-043-conserve-abg-attempt-retry-and-continuation-identity.md)
  and [T-044](../backlog/T-044-project-abg-actor-c-call-payload-and-assurance-families.md)
  retain event admission, identity and typed observation ownership.
- [T-045](../backlog/T-045-qualify-exact-abg-event-stream-compatibility-portfolio.md)
  retains exact Product compatibility qualification. Its broader odd_glc
  portfolio is not silently replaced by the ABIogenesis witnesses.
- [T-032](T-032-reprice-odd-manager-around-developer-build-operations.md)
  retains the separate external Build/Assure outcome; T-041 governance
  acceptance retains its existing status.

At each iteration, bind the candidate, changed contract relations and existing
ticket obligations before writing. Reuse unchanged accepted evidence. Do not
wait for final ABIogenesis release qualification to deliver a bounded observer
slice, and do not promote that slice into a general compatibility claim.

Ticket closure requires A-01 through A-09's bounded current-candidate outcome
through the installed Product path, and an explicit A-10 capability disposition.
Any unresolved required observation behavior keeps this ticket open even if
the execution sprint closes with durable follow-up work. Existing tickets
close only against their own recorded obligations.

## Activation And Current Checkpoint

2026-09-29: intake selects a bounded G-009 work wave (`goal_reprice`) and this
ticket's design re-entry. The same actor explicitly leaves Executive and
enters Writer for the Product-owner-requested tracking operation. Exact write
territory: this ticket, its sprint manifest, `specification/GOALS.md` selection
and `README.md` routing. Return condition: linked, internally consistent work
carriers with the current evidence and first deliverable recorded.

This checkpoint records the plan and evidence gap. It executes no implementation
iteration, changes no upstream repository, and makes no new acceptance or
release claim. Future construction requires its own bounded Worker activation.

Writer return: required ticket/sprint metadata, local links, authority routes
and whitespace checks pass. Comparison with the pre-write file inventory found
changes only in the four granted tracking files; pre-existing work elsewhere
is preserved. The Writer activation is closed and the actor returns to
Executive. I-01 remains selected with implementation pending.

## STDO 2.5.1 Setup Activation

The subsequent 2026-09-29 Product-owner instruction starts this sprint under
STDO 2.5.1, retains the root actor as Executive and selects a_c for context
management. It authorizes this basis adoption without another confirmation.

- Selected basis: `stdo://releases/v2.5.1-rc.1/`; installed manifest SHA-256
  `5d306da13994e69aa9f215d4c1cd2d0be96283c1e33a652b58e6e9262d036b64`.
  The toolchain selected the highest published immutable cut on
  `stdo://channels/2.5.1` and adopted accepted plan
  `20c4184c71d049bc9f6e9ee57b56dad797b96090700d3b0b1a891b20b7062268`.
  `stdo status --definition stdo_odd_manager.json --verify` passes.
- Superseded activation basis: `stdo://releases/v2.5.0-rc.4/`, manifest
  `4fa2556d0127bebce8f7184cc4a3cb708a175b2e40552c55cb211f2426d5049e`,
  project frame `urn:odd-manager:reference-frame-basis:source-project:1`.
  The current project-frame revision is `:2`. Prior proof identities and
  T-041 acceptance are unchanged; earlier activations need explicit rebinding.
- Executive activation `T046-E01`: root Codex actor `/root`; selection,
  bounded delegation and disposition under the direct instruction. It carries
  the Product boundary, G-009 outcome, dependencies and residuals. It performs
  no file, Git, provider or implementation effects while occupying Executive.
- Setup Worker activation `T046-W00`: Codex `/root/t046_basis_context`;
  method/toolchain and configuration-writing capability. Exact operation:
  adopt the requested immutable method basis and record the current actor and
  finite context configuration. Grant territory: `stdo_odd_manager.json`
  (selector, toolchain basis/schema and calculus entrypoint), tool-managed STDO
  marker spans only in `AGENTS.md` and `CLAUDE.md`,
  `specification/GOVERNANCE.md`, `specification/REFERENCE_FRAME_BASIS.md`,
  T-046/current-basis direction in `specification/GOALS.md`, this ticket, its
  sprint manifest and
  [context.md](../../comments/codex/20260929_T046_ABG5_ALIGNMENT/context.md).
  Preserve unrelated dirty work. No implementation, upstream edits, commit,
  provider run, agent delegation, ticket closure or continuation is granted.
- Material basis: the exact installed method; current project authority and
  configuration bytes; T-046's pinned S6/S7 evidence; the live source routes
  and digests in the context projection. Its AC-005/006/009/010/011/014 view is
  an attention aid, with no formal whole-model a_c conformance claim.
- Return contract: `candidate_ready`/`satisfied`, `refused`/`falsified`,
  `incomplete`/`indeterminate`, or `re_entry_requested`/`out_of_frame` or
  `invalid_basis`, to `T046-E01`. Return exact changed-file identities,
  verification, residuals and required re-entry; stop before implementation.
  Source or basis drift, authority conflict or required out-of-territory
  repair returns to Executive. Independent review, when required, receives a
  separate exact-candidate activation and cannot be replaced by self-review.

I-01's ready frontier is the bounded requirement correction, common-design
binding and their review conditions, followed by A-01–A-03, basic A-04 and
matching A-09. Each constructor receives its own exact grant. The full manager
model and shell remain; T-040 and T-042 through T-045 retain narrower owners.

Executive `T046-E01` separately activates `T046-I01-W1` after verified basis
adoption. Its territory is the current Product development-target binding,
requirement family 16, common event compatibility design and the I-01
server/contracts/inspector/tests/qualification cone. Its first frontier is the
bounded requirement correction and common-design binding. This setup Worker
retains only the tracking/governance/context territory above. W1's separate
activation carries construction authority; W00's return carries none forward.

W00 closed return: `candidate_ready` / `satisfied` for basis and context setup.
Exact installed-basis verification passes; bootstrap dry-run reports both
targets unchanged after tool-managed refresh. Project-owned bytes outside the
STDO markers are preserved. Granted-file links and whitespace checks pass.
The pre-write inventory distinguishes these nine setup files from W1's
concurrent, disjoint construction changes. The context binds preconstruction
inputs and preserves residuals; W1 must return its exact successor candidate.
No implementation proof, T-041 closure or compatibility acceptance is claimed.
W00 returns to E01 and stops with no follow-on construction.

## I-01 Review And Disposition

Writer `T046-D01` records E01's explicit decision after the closed R2 result.
Its [activation, prewrite hashes, original judgments and disposition](../../comments/codex/20260929_T046_ABG5_ALIGNMENT/20260929T061233_REVIEW_I01-disposition.md)
bind this recording operation and the separately refreshed context.

- W1 candidate `7a0b8c921d48741a9e7215d00146741d33c1e5b6a78e4773a122fc7506b51277`
  passed construction proof but R1 returned `falsified`. E01 withheld
  acceptance and activated W2. The preserved historical subject stays rejected.
- W2 candidate `58c256eeb18852eae332739e16c7c1c4a724e8221e8798c54265b091d944812b`
  contains 717 frozen members. Its installed proof passes 165 focused tests,
  typecheck, build and browser 1/1, with no skip/retry. R2 independently
  returned `satisfied`, closed both findings and reported no unresolved
  in-scope material finding; it assigned no disposition.
- E01 accepts A-01 through A-03, basic lazy-call A-04 and matching A-09 on
  that exact successor and selected STDO basis. This is frozen `ddc961...`
  profile/base Run replay coverage. Broader T-046 and existing ticket
  acceptance obligations remain open.
- E01 selects I-02 source/contract reacquisition and graph/call/declaration
  explanation as the next frontier. No I-02 constructor is activated here.
  `a25d22...`/`current_intent` needs a fresh qualified delta; nativeLiveness
  stays unqualified with status unavailable and identity/events retained.
  I-02/I-03 rich projections and I-04 combined qualification/disposition remain.

D01's later ticket/sprint/context/GOALS updates and disposition post are
tracking changes outside the frozen proof claim. Implementation, requirements,
design, method basis, original Worker returns and original proofs are unchanged.
The final whole worktree is not relabeled as the frozen 717-member candidate.
T-046 and the sprint remain active; no other ticket is closed.
