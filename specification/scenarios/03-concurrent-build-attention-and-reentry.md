# Concurrent Build Attention And Re-Entry

**Status**: Active
**Derives From**:
- `specification/PRODUCT.md`
- `specification/requirements/11-developer-portfolio-and-project-workbench.md`
- `specification/requirements/12-specification-proposal-and-change-control.md`
- `specification/requirements/13-build-admission-and-supervision.md`
- `specification/requirements/14-gate-asset-assurance-and-attention.md`
- `specification/requirements/15-modular-capability-composition.md`

## Purpose

This scenario bundle proves multi-Project concurrency, failure visibility,
bounded developer reaction, and lawful re-entry without cross-Project state
collision or manager-owned runtime policy.

## Scenario 1 - Two Project builds execute concurrently

Actor: developer operator

Preconditions
- two registered Projects publish admitted build carriers
- the configured concurrency limit admits both builds

Sequence
- submit one Build Request for each Project revision
- observe both requests enter the Build Portfolio
- start both Build Executions
- alternate focus between executions while each emits process and runtime state
- open the Project Workbench and Run Inspector for each execution
- allow one execution to converge while the other remains running

Expected outcomes
- Project, revision, request, process, run, output, freshness, and attention
  identity remain isolated
- one execution's completion does not change the other's state
- switching focus rejects late responses from the prior Context
- the portfolio reports concurrency usage and queued/running distinction

## Scenario 2 - Proposal becomes stale before acceptance

Actor: developer operator with an agent participant

Preconditions
- a validated Specification Proposal exists against revision A
- Project authority changes to revision B before acceptance

Sequence
- attempt to accept the proposal
- inspect the detected basis mismatch
- choose regeneration or explicit reconciliation
- validate the replacement proposal
- reject the stale proposal

Expected outcomes
- the stale proposal does not mutate revision B
- no silent rebase or partial apply occurs
- replacement proposal lineage names the new basis
- rejection and replacement remain attributable

## Scenario 3 - Deterministic failure and human gate coexist

Actor: developer operator acting as an authorized human evaluator

Preconditions
- one Build Execution has a failed F_D gate and an open F_H obligation

Sequence
- inspect the resulting Attention Items
- open deterministic failure evidence
- attempt human approval
- route repair at the smallest lawful re-entry point
- rerun the applicable admitted work after repair
- resolve the human obligation only after deterministic truth passes

Expected outcomes
- F_H approval cannot override F_D failure
- each attention item retains its source and correlation identity
- repair or rerun occurs only through an admitted command
- attention resolves from changed source truth rather than a UI dismissal

## Scenario 4 - Build heartbeat becomes stale or disconnected

Actor: developer operator

Preconditions
- one Build Execution is running

Sequence
- interrupt manager connectivity or backend heartbeat
- observe stale and then disconnected posture
- reconnect to the backend
- attach to the surviving execution if its identity remains valid
- cancel explicitly if continuation is no longer desired

Expected outcomes
- stale/disconnected does not become failed or converged automatically
- reconnect uses the existing execution identity
- cancellation records actor, request, outcome, and time
- no ABG continuation decision is inferred from process connectivity

## Scenario 5 - Proof digest or revision mismatch blocks assurance

Actor: developer operator

Preconditions
- a gate or asset appears complete but its proof digest or Project Revision does
  not match the selected Build Execution

Sequence
- inspect assurance and portfolio attention
- drill into the mismatched proof and source revision
- choose investigate, rebuild, or lawful re-entry
- admit replacement evidence through the owning build/runtime path

Expected outcomes
- the assessment remains mismatch or stale rather than green
- the attention item identifies affected Project, build, gate/asset, and source
- replacement evidence does not erase the mismatched history
- verified posture appears only after admitted matching evidence

## Scenario 6 - One capability iterates without breaking integration

Actor: product developer maintaining `odd_manager`

Preconditions
- the structural capability host is admitted
- Project Workbench, Build Portfolio, Specification Proposal, Build Control,
  Assurance and Attention, and Run Observation publish capability boundaries

Sequence
- replace or extend one capability's internal realization
- replay that capability's local interaction family
- run integration replay for Context, correlation, navigation, and stale-result
  handling
- open the same Project deep link and existing Run Inspector
- inspect availability for capabilities not changed

Expected outcomes
- unrelated capability state and behavior remain unchanged
- no capability imports or mutates another capability's internal state
- shared Context and command correlation continue through the host
- structural availability is not reported as functional MVP completion
- existing observation proof remains valid

## Traceability

| Scenario | Primary requirements |
| --- | --- |
| Concurrent builds | REQ-OM-DEV-008, REQ-OM-BLD-003 through REQ-OM-BLD-005, REQ-OM-BLD-008 |
| Stale proposal | REQ-OM-SPC-005 through REQ-OM-SPC-008 |
| F_D and F_H | REQ-OM-BLD-007, REQ-OM-ASR-003, REQ-OM-ASR-005 through REQ-OM-ASR-007 |
| Stale/disconnected build | REQ-OM-BLD-004, REQ-OM-BLD-007, REQ-OM-BLD-008 |
| Proof/revision mismatch | REQ-OM-DEV-005, REQ-OM-ASR-003, REQ-OM-ASR-004, REQ-OM-ASR-006 through REQ-OM-ASR-008 |
| Capability iteration | REQ-OM-CAP-001 through REQ-OM-CAP-008 |
