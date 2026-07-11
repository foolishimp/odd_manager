---
id: T-035
title: Deliver the Specification Proposal MVP
type: feature
ticket_category: ordinary
status: completed
review_status: accepted
proof_status: verified_by_automation
goal: G-006
source_ticket: T-032
sprint: SPRINT-2026-07-10-abg46-observation-reprice
build_tenant: react_vite
owner: codex
change_intent: >-
  Deliver W18 MVP 2: contextual prompting that produces an isolated,
  attributable, validated specification proposal with structured diff and
  explicit accept, reject, or refine actions.
change_class: design_reframe
re_entry_point: react_vite_capability_design
affected_boundary: Specification Proposal contracts, proposal store, participant adapter, validation catalog, atomic revision-checked acceptance, capability UX and proof
priority: high
triaged_at: 2026-07-11
created_at: 2026-07-11
updated_at: 2026-07-11T19:57:31+10:00
dependencies:
  - T-033
governance_scope: STDO-UX, REQ-OM-SPC-*, common design ADR-001
target_truth: >-
  Prompting creates candidate truth against a named Project Revision; the
  developer sees context, lineage, diff, and deterministic validation before an
  explicit attributed decision changes constitutional source.
closure_law: >-
  Close only when generate, validate, refine, accept, reject, stale-basis, and
  history paths use admitted typed carriers and replay proves no prompt or view
  can write specification directly.
evaluation_criteria:
  - Proposal carrier records Project, revision, participant, context, diff, validation, lineage, and decision.
  - Deterministic failure and stale basis block acceptance.
  - Acceptance is atomic and returns the resulting Project Revision.
  - Rejection changes no constitutional source.
  - Prompt and explicit control paths share commands.
proof_surface:
  - build_tenants/react_vite/src/capabilities/specification-proposal/
  - build_tenants/react_vite/src/server/
  - build_tenants/react_vite/runtime/tests/
  - build_tenants/react_vite/tests/e2e/
non_closure_conditions:
  - Agent output or prompt text is written directly to live specification.
  - Validation is optional, self-reported, or bypassed by human approval.
  - Stale proposals are silently rebased or partially applied.
  - Proposal history becomes constitutional authority.
---

# T-035: Specification Proposal MVP

This ticket owns W18 after the W16 host boundary closes.

## Operator Design Refinement 2026-07-11

The capability follows common design ADR-001: one authoritative proposal
function may be projected into multiple placements, but State, Msg, Update,
Cmd, validation, storage, diff semantics, and acceptance authority are not
duplicated. The first Workbench placement establishes the canonical function.

The ticket re-enters at capability design because W18 admits the previously
missing proposal carrier, read-only participant adapter, deterministic
validation catalog, and atomic acceptance membrane before realizing the UX.

## Implementation Evidence 2026-07-11

- Expanded the shared runtime-schema package with the persisted proposal,
  provider response, command ingress, decision, validation, attachment, and
  bounded history contracts used by browser and server.
- Added one manager-owned proposal service and store outside the target Project.
  Generation invokes one provider adapter in read-only mode and admits only a
  schema-constrained specification patch.
- Added exact specification content digests to Project Revision observation.
  Validation checks basis, specification-only paths, whitespace, and Git patch
  applicability. Acceptance locks the Project, reruns validation and basis
  checks, applies once, and records the resulting revision.
- Replaced the unavailable shell with one replayable State/Msg/Update/Cmd
  capability, one browser command interpreter, bounded attachment/prompt input,
  structured file/line diff, deterministic validation, refine/accept/reject,
  attributed decisions, and history projection.
- Acceptance refreshes shared Project Context from resulting source truth.
  Rejection changes no target source, and late cross-Project results fail
  closed.

## Compression Review 2026-07-11

- Common ADR-001 and `DESIGN_MODULE_METHOD` review found one proposal capability
  module, one provider/service boundary, one store, one validation catalog, one
  command interpreter, and one diff projection.
- Context attachment, validation rows, decision detail, diff lines, and
  placement state remain subordinate payloads rather than peer modules.
- No proposal logic was added to Sidecar, Project Workbench, host, or placement
  wrappers. The host only mounts the public module and interprets its commands.
- No recurrence required extraction beyond the existing shared Context,
  command, and schema packages.

## Verification 2026-07-11

- `npm run test:runtime:node`: 232/232 passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; the existing large-chunk warning remains.
- `npx playwright test`: 39/39 passed.
- Browser proof used a temporary governed Git Project and exercised attachment,
  generate, refine, structured diff, validation, accept, resulting Context
  refresh, reject, history, and desktop/mobile containment.
- Production generation remains bound to the read-only Codex adapter. The
  deterministic fixture provider is enabled only by the explicit Playwright
  environment and is not production participant proof.
- `git diff --check`: passed.

## Scenario Completion Audit 2026-07-11

- Acceptance now fails closed when source changes after validation, in both the
  reducer and service authority boundaries.
- `proposal/regenerate-requested` invokes the same admitted generation carrier
  against current Context, retains the stale proposal as predecessor, and
  leaves that predecessor explicitly rejectable rather than silently replacing
  history.
- Accepted and stale outcomes publish one typed `proposal.refresh-context`
  supporting command. The host no longer watches proposal status as a rival
  semantic branch.
- Replay, service, and browser proof cover source mutation, blocked stale
  acceptance, current-revision regeneration, valid replacement acceptance,
  stale predecessor rejection, lineage, and desktop/mobile containment.

## Review Boundary

T-036 and later build work do not depend on separate acceptance of this view
and may continue against the admitted carrier and automation proof.

## Prime-Set Acceptance 2026-07-11

Accepted. Generate, refine, deterministic validation, exact-basis acceptance,
rejection, stale regeneration, lineage, and history are present through one
typed proposal boundary. No prompt or view writes constitutional source
directly. Integrated product refinement remains under T-032.
