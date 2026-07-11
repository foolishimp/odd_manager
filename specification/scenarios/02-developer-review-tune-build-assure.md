# Developer Review Tune Build Assure

**Status**: Active
**Derives From**:
- `specification/PRODUCT.md`
- `specification/requirements/11-developer-portfolio-and-project-workbench.md`
- `specification/requirements/12-specification-proposal-and-change-control.md`
- `specification/requirements/13-build-admission-and-supervision.md`
- `specification/requirements/14-gate-asset-assurance-and-attention.md`
- `specification/requirements/15-modular-capability-composition.md`

## Purpose

This scenario bundle proves the first primary developer interaction goal:
moving a selected governed Project revision from review through specification
tuning, admitted build execution, and evidence-backed gate/asset assurance.

The first reference Project is `odd_glc` and the first reference build is its
data-mapper software-build carrier. The scenario proves generic manager
contracts, not an `odd_glc`-specific control path.

## Scenario 1 - Developer enters through portfolio and Project deep link

Actor: developer operator

Preconditions
- multiple Projects are registered
- `odd_glc` has published identity and an admitted source/specification revision
- at least one Project lacks a build carrier or current run

Sequence
- open the Project Portfolio
- inspect Project identity, revision, readiness, active build, assurance,
  freshness, participant, and attention posture without changing Project focus
- filter to Projects requiring attention
- open the registered `odd_glc` Project deep link
- inspect the Project Workbench and its Review, Tune, Build, and Assure
  capability posture
- open AI Workspace and Run Inspector as supporting drills, then return to the
  same Project Workbench context

Expected outcomes
- portfolio rows remain source-attributed and Project-isolated
- missing capabilities are explicit and do not remove generic Project use
- the Project-only deep link opens the Project Workbench
- supporting observation does not replace or lose the developer goal context
- late data from another Project is rejected

## Scenario 2 - Developer tunes specification through a proposal

Actor: developer operator with an agent participant

Preconditions
- the selected Project Workbench is bound to a named Project Revision
- one requirement or specification concern is selected

Sequence
- open the Specification Proposal capability
- attach the selected requirement, one relevant run/gate observation, and the
  source specification file as bounded context
- prompt a scoped change
- inspect proposal participant, basis revision, context, affected surfaces, and
  structured diff
- run the applicable deterministic validation
- request one refinement and inspect the successor relationship
- accept the validated proposal explicitly
- refresh Project readiness against the resulting revision

Expected outcomes
- prompting creates candidate truth and does not mutate specification directly
- the original and refined proposals remain attributable
- deterministic validation closes before acceptance
- acceptance records actor, basis revision, resulting revision, and changed
  surfaces
- readiness is recomputed from admitted source rather than patched in the view

## Scenario 3 - Developer submits and supervises one build

Actor: developer operator

Preconditions
- the selected Project publishes one admitted data-mapper build carrier
- the accepted Project Revision is visible
- no deterministic admission failure remains

Sequence
- inspect the carrier, declared inputs, target/until posture, resource posture,
  and revision basis
- submit one Build Request
- observe request admission and Build Execution transition through queued,
  starting, and running
- follow correlation from operator intent to request, process, and emitted ABG
  Run identity
- inspect live freshness and open Run Inspector for graph/runtime forensics
- observe process outcome separately from assurance posture

Expected outcomes
- the build uses a typed carrier rather than hidden shell text
- Project, revision, request, execution, process, and run identities do not drift
- odd_manager supervises process lifecycle but does not choose ABG traversal or
  closure
- refresh/reconnect returns to the same Build Execution where identity remains
  valid
- successful process exit does not manufacture gate or asset success

## Scenario 4 - Developer verifies required gates and assets

Actor: developer operator

Preconditions
- the Build Execution has an admitted run and product/domain-published gate and
  asset requirements

Sequence
- open the Assure contribution in the Project Workbench
- compare required and delivered gates and assets
- inspect one satisfied deterministic gate and its evidence
- inspect one delivered asset, producer, revision, digest, and source artifact
- inspect any missing, stale, unsupported, waiting-human, or residual posture
- drill from an assessment into Run Inspector evidence
- accept the outcome only when every required condition has admitted closure

Expected outcomes
- every positive claim has source evidence and matching revision
- F_D, F_P, and F_H posture remains distinguishable
- totals derive from the assessed set
- missing or stale evidence remains visible
- final assurance explains what was delivered and what remains open

## Scenario 5 - Project publishes no lawful build carrier

Actor: developer operator

Preconditions
- a registered Project is browseable but publishes no admitted build carrier

Sequence
- open the Project Workbench
- inspect Build capability availability
- open a generic shell for ordinary manual work
- attempt to request an admitted build
- create or open upstream work for the missing carrier

Expected outcomes
- Build reports unsupported or unavailable and names the missing contract
- no shell command is synthesized or misrepresented as a Build Request
- other Project capabilities remain usable
- the carrier gap becomes a durable re-entry or work item

## Traceability

| Scenario | Primary requirements |
| --- | --- |
| Portfolio and deep link | REQ-OM-DEV-001 through REQ-OM-DEV-008 |
| Specification proposal | REQ-OM-SPC-001 through REQ-OM-SPC-008 |
| Single build | REQ-OM-BLD-001 through REQ-OM-BLD-004, REQ-OM-BLD-006 through REQ-OM-BLD-009 |
| Gate and asset assurance | REQ-OM-ASR-001 through REQ-OM-ASR-005, REQ-OM-ASR-008 |
| Missing carrier | REQ-OM-BLD-002, REQ-OM-CAP-005 |
