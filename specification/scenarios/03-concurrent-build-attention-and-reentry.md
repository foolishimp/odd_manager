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

## SCN-OM-BLD-003 - Two Project builds execute concurrently

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

## SCN-OM-SPC-002 - Proposal becomes stale before acceptance

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

## SCN-OM-ASR-002 - Deterministic failure and human gate coexist

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

## SCN-OM-BLD-004 - Build heartbeat becomes stale or disconnected

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

## SCN-OM-ASR-003 - Proof digest or revision mismatch blocks assurance

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

## SCN-OM-CAP-001 - One capability iterates without breaking integration

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

## Executable Proof Bindings

Runtime replay and service tests below are deliberately recorded as supporting
proof only. They discriminate implementation behavior, but under STDO Test
Authority they do not by themselves close a composed-product scenario.

| Scenario | Requirement | Requirement-specific authority case | Proof posture | Proof selector or gap |
| --- | --- | --- | --- | --- |
| `SCN-OM-BLD-003` | `REQ-OM-DEV-008` | Alternate between two running Project builds without cross-Project focus, output, or outcome leakage | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated` |
| `SCN-OM-BLD-003` | `REQ-OM-BLD-003` | Preserve distinct request, execution, Project, revision, output, and outcome identities for both builds | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated` |
| `SCN-OM-BLD-003` | `REQ-OM-BLD-005` | Run two Project builds concurrently while each retains an independent lifecycle | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated` |
| `SCN-OM-BLD-003` | `REQ-OM-BLD-008` | Switch supervised execution focus while rejecting late output and preserving fresh selected state | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated` |
| `SCN-OM-SPC-002` | `REQ-OM-SPC-005` | Block stale acceptance and require a new explicit proposal disposition on the current basis | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_specification_proposal_replay.mjs :: stale proposal acceptance is blocked and regeneration preserves predecessor on the current basis` |
| `SCN-OM-SPC-002` | `REQ-OM-SPC-006` | Reject a proposal whose basis became stale and perform no silent rebase or partial apply | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_specification_proposal_replay.mjs :: stale proposal acceptance is blocked and regeneration preserves predecessor on the current basis` |
| `SCN-OM-SPC-002` | `REQ-OM-SPC-008` | Preserve predecessor identity when regeneration creates a proposal on the current basis | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_specification_proposal_replay.mjs :: stale proposal acceptance is blocked and regeneration preserves predecessor on the current basis` |
| `SCN-OM-ASR-002` | `REQ-OM-BLD-007` | Route repair and rerun through explicit attributable commands after deterministic failure | Executable proof gap | none — the service test has no composed-product human reaction and rerun sequence |
| `SCN-OM-ASR-002` | `REQ-OM-ASR-005` | Keep an F_H waiting posture from overriding an existing deterministic failure | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_assurance_service.mjs :: F_H waiting posture cannot override deterministic failure` |
| `SCN-OM-ASR-002` | `REQ-OM-ASR-006` | Identify the failed deterministic gate as one source-attributed actionable condition | Executable proof gap | none — no composed-product testcase asserts attention identity through the human-gate coexistence sequence |
| `SCN-OM-ASR-002` | `REQ-OM-ASR-007` | Permit human resolution only after deterministic truth passes through lawful re-entry | Executable proof gap | none — no executable scenario covers authorized human reaction followed by deterministic rerun |
| `SCN-OM-BLD-004` | `REQ-OM-BLD-004` | Recover supervisor state after restart without manufacturing a new execution identity | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_build_control_service.mjs :: supervisor restart preserves identities and projects stale before disconnected` |
| `SCN-OM-BLD-004` | `REQ-OM-BLD-007` | Record cancellation as attributable without manufacturing a terminal carrier result | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_build_control_service.mjs :: cancellation is attributable and does not manufacture a terminal carrier result` |
| `SCN-OM-BLD-004` | `REQ-OM-BLD-008` | Project stale then disconnected posture after restart while preserving the existing execution identity | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_build_control_service.mjs :: supervisor restart preserves identities and projects stale before disconnected` |
| `SCN-OM-ASR-003` | `REQ-OM-ASR-003` | Refuse a positive gate when the supplied proof digest does not match admitted evidence | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_assurance_service.mjs :: proof digest mismatch prevents a positive gate and derives blocking attention` |
| `SCN-OM-ASR-003` | `REQ-OM-ASR-004` | Keep mismatched proof posture non-positive instead of projecting verified assurance | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_assurance_service.mjs :: proof digest mismatch prevents a positive gate and derives blocking attention` |
| `SCN-OM-ASR-003` | `REQ-OM-ASR-006` | Derive a blocking attention condition from the mismatched proof digest | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_assurance_service.mjs :: proof digest mismatch prevents a positive gate and derives blocking attention` |
| `SCN-OM-ASR-003` | `REQ-OM-ASR-008` | Drill from the blocking assessment to mismatched proof and source-revision forensic detail | Executable proof gap | none — the service proof derives attention but has no composed-product forensic drill interaction |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-001` | Keep capability-owned public surfaces structurally independent across module boundaries | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: each capability owns its structural public surfaces and cross-capability imports stay at host ports` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-002` | Route capability integration through host-owned ports without importing another capability's internal state | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: each capability owns its structural public surfaces and cross-capability imports stay at host ports` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-003` | Replay every Product-meaningful interaction family through a conformant STDO-UX boundary | Scenario proof | `build_tenants/react_vite/qualification/installed-development-proof.mjs :: isolated development candidate proves the declared operator significant-path bundle` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-004` | Admit Context, correlation, navigation, and stale-result integration through one explicit host | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: aggregate Project switch preserves only target-Project attention through Context admission` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-005` | Keep structural capability availability distinct from functional MVP acceptance | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: Project Workbench compresses admitted phase availability without a sidebar ledger` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-006` | Cross run-observation capability boundaries through navigation intent rather than direct effects | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: run observation emits navigation intent rather than performing an effect` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-007` | Report structural availability without presenting it as functional MVP closure | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: Project Workbench compresses admitted phase availability without a sidebar ledger` |
| `SCN-OM-CAP-001` | `REQ-OM-CAP-008` | Execute structural import-boundary proof independently from Product acceptance claims | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: each capability owns its structural public surfaces and cross-capability imports stay at host ports` |
