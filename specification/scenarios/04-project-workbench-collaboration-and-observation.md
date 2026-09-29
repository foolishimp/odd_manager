# Project Workbench Collaboration And Observation

**Status**: Active
**Derives From**:
- `specification/PRODUCT.md`
- `specification/requirements/04-orientation-and-navigation.md`
- `specification/requirements/05-inspection-governance-and-evidence.md`
- `specification/requirements/06-operator-workbench.md`
- `specification/requirements/07-live-coordination-and-durable-record.md`
- `specification/requirements/08-session-workspace-and-provider-adapters.md`

## Purpose

This bundle supplies written testcase authority for the Project-scoped
orientation, inspection, collaboration, and session capabilities that support
the developer-control loop. It exercises existing Product behavior; it does
not select another realization outcome.

## SCN-OM-NAV-001 - Project orientation preserves one Context

Actor: developer operator

Sequence
- enter through an exact registered Project deep link;
- switch the active Project through Build Portfolio;
- open files, AI Workspace, and Run Inspector from the same Project;
- return to the Project Workbench.

Expected outcomes
- the URL, active Context, shell, workbench, and supporting Sidecar agree on
  Project identity;
- late observations from another Project are rejected;
- unavailable domain detail does not remove generic Project navigation.

## SCN-OM-INS-001 - Operator inspects source-attributed runtime evidence

Actor: developer operator

Sequence
- open AI Workspace for the selected Project;
- select an admitted run and inspect overview, graph, traversal, events,
  evidence, diagnostics, and artifacts;
- drill into one source reference and return to the selected run.

Expected outcomes
- summaries remain derived and source-attributed;
- missing, malformed, stale, and unsupported carriers fail honestly;
- inspection never chooses traversal, continuation, or closure.

## SCN-OM-WRK-001 - Workbench actions preserve attributable intent

Actor: developer operator

Sequence
- open the Project-scoped workbench;
- select a source object and attach it to an operator interaction;
- use an explicit control and inspect the correlated result;
- move focus to a supporting surface and return.

Expected outcomes
- selected Context frames the action without becoming hidden authority;
- explicit and conversational controls use the same admitted carriers;
- focus changes remain replayable and do not lose Product context.

## SCN-OM-COL-001 - Live coordination and durable record remain distinct

Actor: developer operator with a named participant

Sequence
- create a durable topic;
- open a live room over that topic;
- post an attributable room message;
- inspect the durable comment record and participant receipt state.

Expected outcomes
- ticket state, durable commentary, and live room traffic remain distinct;
- attribution and attachment provenance survive promotion;
- no participant can spoof another author's durable record.

## SCN-OM-SES-001 - Session workspace survives attach and replay

Actor: developer operator

Sequence
- create a labeled Project-scoped shell session;
- send terminal input and observe output;
- detach and reattach to the same session;
- inspect persisted session identity and transcript.

Expected outcomes
- session identity and Project scope survive attachment changes;
- provider behavior remains outside the generic session substrate;
- replay and restart recovery do not invent a second terminal truth source.

## Executable Proof Bindings

These bindings intentionally separate written testcase authority from proof
closure. A narrow executable selector is attached only to the
requirement-specific observable it actually discriminates. The remaining
interaction gaps stay explicit under T-032.

| Scenario | Requirement | Requirement-specific authority case | Proof posture | Proof selector or gap |
| --- | --- | --- | --- | --- |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-001` | Answer immediate supervisory questions from a home surface with source-attributed status and attention | Executable proof gap | none — no composed-product testcase asserts the complete home supervisory question set |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-002` | Enter the selected Project through the Review, Tune, Build, and Assure control-loop orientation | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: project-only deep link opens the modular developer Project Workbench` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-003` | Open run observation and return while preserving the originating workbench focus and Project Context | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: run observation opens as a supporting surface and workbench focus survives return` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-004` | Recover a simplified ABG topology from admitted carriers while retaining source references | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: T-040 Run Inspector renders the retained ABG 5 rust-cli occurrence projection without inventing topology or terminal control` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-005` | Drill from Project Workbench to run detail and return without losing visible world context | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: run observation opens as a supporting surface and workbench focus survives return` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-006` | Switch between compressed and expanded navigation while retaining one selected world object | Executable proof gap | none — no composed-product testcase compares compressed and expanded modes against one world identity |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-007` | Project an admitted run through bounded object-appropriate overview, graph, event, and evidence lenses | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: Run Inspector requires an exact current ABG 5 candidate and does not surface the legacy Data Mapper as selectable` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-008` | Apply one published visual and interaction language across orientation surfaces and capability tabs | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-accessibility.spec.ts :: developer control and workbench tabs provide keyboard parity and named panels` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-009` | Preserve the dense supervisory spatial aesthetic across graph and workspace viewport classes | Executable proof gap | none — no deterministic visual comparison or complete viewport scenario proves this aesthetic requirement |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-010` | Resolve the registered Project identity to a non-empty identity-appropriate landing view | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: registered local Project deep link opens a landing view and can target an exact Run Inspector candidate` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-011` | Admit a registered local Project to generic workspace use without requiring ODD-specific carriers | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: registered local Project deep link opens a landing view and can target an exact Run Inspector candidate` |
| `SCN-OM-NAV-001` | `REQ-OM-NAV-012` | Open an exact registered local Project root through a directly addressable deep link | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: registered local Project deep link opens a landing view and can target an exact Run Inspector candidate` |
| `SCN-OM-INS-001` | `REQ-OM-INS-001` | Present run overview, graph, traversal, events, evidence, diagnostics, and artifacts as explicit categories | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: Run Inspector requires an exact current ABG 5 candidate and does not surface the legacy Data Mapper as selectable` |
| `SCN-OM-INS-001` | `REQ-OM-INS-002` | Identify the authority owner and source carrier for every projected inspection category | Executable proof gap | none — no composed-product testcase checks ownership labels and source authority for every inspection category |
| `SCN-OM-INS-001` | `REQ-OM-INS-003` | Explain the selected run's Project, carrier, attempt, and source identity before local detail | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: T-040 Run Inspector renders the retained ABG 5 rust-cli occurrence projection without inventing topology or terminal control` |
| `SCN-OM-INS-001` | `REQ-OM-INS-004` | Expose route, runtime, evidence, and consequence sections for one admitted run | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: Run Inspector requires an exact current ABG 5 candidate and does not surface the legacy Data Mapper as selectable` |
| `SCN-OM-INS-001` | `REQ-OM-INS-005` | Display governance decisions with context, actor attribution, and source references | Executable proof gap | none — the Run Inspector test does not exercise attributable governance decision history |
| `SCN-OM-INS-001` | `REQ-OM-INS-006` | Keep raw event and artifact detail behind bounded progressive disclosure from run summaries | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-run-inspector.spec.ts :: T-040 Run Inspector renders the retained ABG 5 rust-cli occurrence projection without inventing topology or terminal control` |
| `SCN-OM-WRK-001` | `REQ-OM-WRK-001` | Open one Project-scoped operator workbench from the exact registered Project link | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: project-only deep link opens the modular developer Project Workbench` |
| `SCN-OM-WRK-001` | `REQ-OM-WRK-002` | Retain Project context when selected object focus moves into and back from a supporting surface | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: run observation opens as a supporting surface and workbench focus survives return` |
| `SCN-OM-WRK-001` | `REQ-OM-WRK-003` | Route conversational intent and explicit controls through the same admitted command surface | Executable proof gap | none — no composed-product testcase compares conversational and explicit control carriers |
| `SCN-OM-WRK-001` | `REQ-OM-WRK-004` | Drive supporting-surface focus intentionally and restore the originating workbench contribution | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-developer-control.spec.ts :: run observation opens as a supporting surface and workbench focus survives return` |
| `SCN-OM-WRK-001` | `REQ-OM-WRK-005` | Coordinate operator and named participant interaction within one Project-scoped workbench | Executable proof gap | none — the live collaboration test exercises only an operator message and no multi-participant workbench interaction |
| `SCN-OM-WRK-001` | `REQ-OM-WRK-006` | Replay an explicit attached comment action through draft, submit, result, and cancellation states | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs :: comment reply draft, submit request, result, and cancel replay deterministically` |
| `SCN-OM-COL-001` | `REQ-OM-COL-001` | Create a durable topic and post separate live room traffic without collapsing the two records | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts :: creates a topic and posts an operator room message through the live collaboration API` |
| `SCN-OM-COL-001` | `REQ-OM-COL-002` | Persist the created topic as the canonical durable discussion object | Scenario proof | `build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts :: creates a topic and posts an operator room message through the live collaboration API` |
| `SCN-OM-COL-001` | `REQ-OM-COL-003` | Open a live room over a durable topic and attached asset while preserving both identities | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts :: creates a topic and posts an operator room message through the live collaboration API` |
| `SCN-OM-COL-001` | `REQ-OM-COL-004` | Promote and reattach live coordination material while retaining complete provenance | Executable proof gap | none — no executable testcase covers promotion followed by provenance-preserving reattachment |
| `SCN-OM-COL-001` | `REQ-OM-COL-005` | Render room context with attached assets and all visible named participants | Executable proof gap | none — the live collaboration test does not assert attached assets or participant visibility |
| `SCN-OM-COL-001` | `REQ-OM-COL-006` | Make direct worker-to-asset work visible with worker, asset, and source attribution | Executable proof gap | none — no executable worker-to-asset scenario is installed |
| `SCN-OM-COL-001` | `REQ-OM-COL-007` | Deliver room messages according to participant membership and explicit receipt state | Executable proof gap | none — the live collaboration test does not exercise participant membership or receipts |
| `SCN-OM-SES-001` | `REQ-OM-SES-001` | Create a Project-scoped shell and round-trip terminal input through the live session service | Supporting proof; scenario gap | `build_tenants/react_vite/tests/e2e/odd-manager-collaboration.spec.ts :: creates a live local shell and round-trips terminal input` |
| `SCN-OM-SES-001` | `REQ-OM-SES-002` | Create and distinguish multiple labeled sessions inside one Project workspace | Executable proof gap | none — the composed-product shell test creates only one session |
| `SCN-OM-SES-001` | `REQ-OM-SES-003` | Preserve manageable session history and transcript identity across detach and restart | Supporting proof; scenario gap | `build_tenants/react_vite/runtime/tests/test_session_pty.mjs :: mounted WebSocket supports spawn, attach, input, replay, reattach, and kill` |
| `SCN-OM-SES-001` | `REQ-OM-SES-004` | Attach and detach an existing session from a live room without changing session identity | Executable proof gap | none — no executable testcase connects session attachment lifecycle to a live room |
| `SCN-OM-SES-001` | `REQ-OM-SES-005` | Share bounded session material into a room only through an explicit operator action | Executable proof gap | none — no executable session-to-room sharing testcase is installed |
| `SCN-OM-SES-001` | `REQ-OM-SES-006` | Provision a named room participant through a provider adapter over the generic session substrate | Executable proof gap | none — no provider-adapter participant provisioning testcase is installed |
| `SCN-OM-SES-001` | `REQ-OM-SES-007` | Keep provider-specific behavior outside the generic session state and command boundary | Executable proof gap | none — current structural tests do not prove the complete provider separation boundary |
| `SCN-OM-SES-001` | `REQ-OM-SES-008` | Bootstrap a room-capable participant from an existing identified session | Executable proof gap | none — no executable existing-session participant bootstrap testcase is installed |
| `SCN-OM-SES-001` | `REQ-OM-SES-009` | Limit provider stream injection to bootstrap without creating a second terminal truth source | Executable proof gap | none — no executable negative testcase constrains post-bootstrap provider stream injection |
