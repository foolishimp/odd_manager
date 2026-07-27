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

## SCN-OM-DEV-001 - Developer enters through portfolio and Project deep link

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

## SCN-OM-SPC-001 - Developer tunes specification through a proposal

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

## SCN-OM-BLD-001 - Developer submits and supervises one build

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

## SCN-OM-ASR-001 - Developer verifies required gates and assets

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

## SCN-OM-BLD-002 - Project publishes no lawful build carrier

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

## Executable Proof Bindings

Each row is one written testcase authority. `Scenario proof` names a
composed-product assertion for only the observable stated in that row.
`Supporting proof; scenario gap` records executable evidence that is narrower
than the scenario and cannot close Product acceptance.

| Scenario | Requirement | Requirement-specific authority case | Proof posture | Proof selector or gap |
| --- | --- | --- | --- | --- |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-001` | Open the developer-control goal as the primary Project Workbench rather than an unrelated inspection surface | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: project-only deep link opens the modular developer Project Workbench` |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-002` | Discover, register, inspect, and remove Projects through one multi-Project portfolio | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build Portfolio refreshes, registers, inspects, and removes a discovered Project` |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-003` | Name one source-attributed attention condition and open its admitted capability target | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: portfolio attention names and opens its admitted Tune, Build, or Assure target` |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-004` | Open one goal-oriented workbench for the Project selected by the exact deep link | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: project-only deep link opens the modular developer Project Workbench` |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-005` | Carry one revised Project basis through Review, Tune, Build, and Assure without identity drift | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: integrated Review Tune Build Assure journey preserves one revised Project basis across concurrent work` |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-006` | Open run observation as supporting detail and return without losing workbench focus | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: run observation opens as a supporting surface and workbench focus survives return` |
| `SCN-OM-DEV-001` | `REQ-OM-DEV-007` | Resolve a registered Project-only deep link directly to the Project Workbench | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: project-only deep link opens the modular developer Project Workbench` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-001` | Generate a proposal with visible participant attribution before any specification mutation | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-002` | Preserve the selected Project basis and bounded attached context through proposal refinement | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-003` | Render the proposal change as structured affected surfaces and diff material before acceptance | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-004` | Prevent acceptance until the proposal has completed its deterministic validation transition | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-005` | Exercise explicit accept and reject actions while retaining their actor and proposal identity | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-007` | Observe readiness after accepted proposal source changes without assigning readiness authority to the view | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-SPC-001` | `REQ-OM-SPC-008` | Review predecessor and successor proposal lineage after refinement and disposition | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage` |
| `SCN-OM-BLD-001` | `REQ-OM-BLD-001` | Submit one typed admitted fixture carrier request without exposing free-form shell execution text | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build Control submits, supervises, attaches, converges, and cancels real fixture processes` |
| `SCN-OM-BLD-001` | `REQ-OM-BLD-003` | Preserve Project, revision, request, execution, process, and output correlation during one build | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build Control submits, supervises, attaches, converges, and cancels real fixture processes` |
| `SCN-OM-BLD-001` | `REQ-OM-BLD-004` | Supervise bounded process start, attachment, output, convergence, and explicit cancellation | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build Control submits, supervises, attaches, converges, and cancels real fixture processes` |
| `SCN-OM-BLD-001` | `REQ-OM-BLD-006` | Show that manager supervision does not select ABG traversal, continuation, or closure policy | Executable proof gap | none — no composed-product testcase proves the negative authority boundary against a live admitted runtime |
| `SCN-OM-BLD-001` | `REQ-OM-BLD-008` | Attach to the selected execution and display live output and freshness without switching execution identity | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build Control submits, supervises, attaches, converges, and cancels real fixture processes` |
| `SCN-OM-BLD-001` | `REQ-OM-BLD-009` | Keep process completion separate from missing, verified, and stale assurance posture | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-ASR-001` | `REQ-OM-ASR-001` | Derive the required gate and asset rows from the published assurance catalog | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-ASR-001` | `REQ-OM-ASR-002` | Compare required catalog rows with delivered evidence as missing, verified, or stale | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-ASR-001` | `REQ-OM-ASR-003` | Require matching admitted evidence before projecting a positive assurance row | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-ASR-001` | `REQ-OM-ASR-004` | Project stale posture when the evidence revision no longer matches the selected build basis | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-ASR-001` | `REQ-OM-ASR-005` | Distinguish the evaluator regime behind each gate rather than flattening all rows into process status | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-ASR-001` | `REQ-OM-ASR-008` | Drill from an assurance row to the existing evidence carrier while retaining build identity | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit` |
| `SCN-OM-BLD-002` | `REQ-OM-BLD-002` | Keep Build visibly unavailable when no lawful carrier is installed and synthesize no shell request | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build remains visibly unavailable without a lawful carrier` |
| `SCN-OM-BLD-002` | `REQ-OM-CAP-005` | Expose missing build-carrier availability explicitly while leaving generic Project use available | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: Build remains visibly unavailable without a lawful carrier` |
