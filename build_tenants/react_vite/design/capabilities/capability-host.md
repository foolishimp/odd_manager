# Capability Host

**Status**: Active
**Wave**: W16 structural foundation
**Requirements**: REQ-OM-CAP-002 through REQ-OM-CAP-005, REQ-OM-CAP-008
**Implements**: `PO-OM-MODULES-001`; `PO-OM-DEVELOPER-001`; `REQ-OM-CAP-*`
**Code Entrypoints**: `build_tenants/react_vite/src/capabilities/host/aggregate.ts`; `build_tenants/react_vite/src/capabilities/host/DeveloperControlHost.tsx`; `build_tenants/react_vite/src/effects/command-runtime/developer-control-aggregate-runtime.ts`; `build_tenants/react_vite/src/routes/WorkspaceRoute.tsx`
**Executable Proof**: `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `host rejects unknown, duplicate, and uncorrelated capability traffic`; `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `aggregate Project switch retires prior Project work and ignores a late proposal completion`; `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `aggregate Project switch preserves only target-Project attention through Context admission`; `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `aggregate result admission binds the outer command to the exact inner identity`; `build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs` :: `aggregate subscription ticks are admitted from the current declaration, not caller shape`; `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` :: `capability host owns the route and mounts sidecar as a supporting surface`
**STDO-UX Bindings**: State=DeveloperControlAggregateState; Msg=DeveloperControlAggregateMessage; Update=updateDeveloperControlAggregate; Cmd=DeveloperControlAggregateCommand; Sub=DeveloperControlAggregateSubscription values; Ingress=developerControlBootstrapSchema for Context, runtime-parsed command-envelope/result admission for post-Context Portfolio/Proposal/Build/Assurance effects, correlated typed host results for bootstrap/navigation, and subscription event/failure admission; View=DeveloperControlHost; Membrane=developer-control-aggregate-runtime, with the shared envelope/result seam limited to post-Context capability effects and correlated typed host/subscription adapters for bootstrap, navigation, and subscriptions; Replay=build_tenants/react_vite/runtime/tests/test_developer_control_capability_host.mjs :: aggregate replay owns cross-capability command lifecycle and admitted run focus; Accessibility=build_tenants/react_vite/tests/e2e/odd-manager-accessibility.spec.ts :: developer-control status, custom tabs, and representative text/control tokens meet keyboard and AA expectations
**Accepted Ontology And Design Basis**: `ONT-OM-DEVCTRL-001` and `B-OM-DEVCTRL-LOCAL-001` in the parent design. This module projects `P-CONTEXT`, `P-OWNERSHIP`, `P-COMMAND`, `P-RESULT`, and `P-SUBSCRIPTION`.
**Accessibility Proof Scope**: Primary and hosted tabs have keyboard movement, selected-state and focus handoff, named panels, live status semantics, representative AA contrast, and responsive containment. Product claims no stricter screen-reader certification.
**Implementation Acceptance**: Accepted for the manager-local host boundary subject to the exact T-032 validation bundle. Post-Context capability command envelope/result parsing, correlated typed host bootstrap/navigation results, and typed declared-subscription failure replay are live; external capability availability remains independently fail closed.

## Responsibility

Own shared Context, ProjectRevision admission, capability registration,
message routing, command correlation, subscriptions, navigation, and
integration replay. The host owns no proposal, build, assurance, or runtime
domain decisions.

Context admission may establish that a registered Project has no observable
ProjectRevision. In that state the host keeps Portfolio, Workbench, file,
shell, and separately admitted read-only observation available, while
Specification Proposal, Build Control, and Assurance and Attention remain
typed `unavailable`. A revision-observation failure produces typed `error`
instead. Constructive carrier or catalog admission cannot make a
revision-dependent capability ready without the revision basis.

## State

```text
HostState
  contextStatus
  context
  revision
  registeredCapabilities
  pendingCommands
  commandResults
  subscriptions
  navigation
  error
```

## Host And Aggregate Lifecycle Messages

```text
host/context-requested
host/context-admitted
host/context-failed
host/capability-registered
host/subscription-declared
host/subscription-cleared
host/subscription-event
host/navigation-requested
host/navigation-admitted
host/navigation-failed
aggregate/command-started
aggregate/command-resolved
aggregate/command-failed
aggregate/registry-changed
aggregate/subscription-ticked
aggregate/subscription-failed
```

## Commands And Subscriptions

| Cmd/Sub | Target | Success | Failure |
| --- | --- | --- | --- |
| `host.resolve-context` | registered Project/context API | `host/context-admitted` | `host/context-failed` |
| `aggregate.interpret-{portfolio,proposal,build,assurance}` | admitted capability-specific runtime adapter | `aggregate/command-resolved` with owning success Msg and succeeded `CommandResult` | `aggregate/command-resolved` with owning failure Msg and failed `CommandResult`; interpreter rejection uses `aggregate/command-failed` |
| `host.project-navigation` | URL/navigation adapter | `host/navigation-admitted` | `host/navigation-failed` |
| `aggregate.activate-project` | application-shell activation callback | `aggregate/command-resolved` with `project-activated` | `aggregate/command-failed` |
| `aggregate.project-registry`, `portfolio.poll`, `build.poll` | declared registry event or bounded timer source | `aggregate/registry-changed` or `aggregate/subscription-ticked` | `aggregate/subscription-failed` |

Only the `aggregate.interpret-{portfolio,proposal,build,assurance}` family crosses
the shared `CommandEnvelope`/`CommandResult` seam. Context bootstrap cannot
carry an already admitted Context; host navigation and local activation are
correlated integration commands rather than capability effect commands.
Application-shell and Sidecar effects remain outside this module in their own
typed command runtimes.

All Project-scoped HTTP ingress and both shell WebSocket upgrade paths pass
through one server-side Project Context admission function before any
Project-local surface construction, session rehydration, observation, or
mutation. Admission is exact against the current maintained registry: an alias,
descendant, stale root, or unregistered filesystem location receives `403` and
cannot create Context as a side effect. The admitted Context publishes the
registry record's exact Project id, root, and ODD identity. Health, filesystem
browse, workspace discovery, cross-Project portfolio observation, and explicit
registry management remain global boundaries and do not imply Context
admission.

## Update Rules

- reject unregistered capability messages;
- reject duplicate capability identities;
- reject result command/correlation ids not pending in the host or aggregate;
- reject result or event Project/revision basis that differs from its request;
- deliver validated product events only to declared subscribers;
- preserve current Context when requested Context admission fails;
- record `requestedSurface` and requested forensic `runFocus` as pending
  navigation-command intent only; selected-tab, panel, and forensic-focus
  projection derive exclusively from admitted aggregate state;
- commit visible surface and forensic focus only after the exact correlated
  navigation command is admitted, preserve both admitted values on failure,
  carry only the admitted surface across a Project transition, and clear
  Project-local forensic focus there;
- gate proposal, build, and assurance availability on a non-null admitted
  ProjectRevision without suppressing unrelated Project work;
- never inspect capability payloads to decide product workflow.
- route explicit capability supporting commands such as Context refresh or
  forensic navigation without taking ownership of their domain meaning.
- translate an admitted periodic subscription event into the owning
  capability's typed poll Msg; the capability coalesces that tick while its
  same load is pending, without consuming explicit refresh continuation.

## View Contribution

The host has no product page. It provides Context, navigation, capability
availability, and command-status bindings to the application shell and Project
Workbench. Pending navigation may project busy status, but it cannot select or
mount the requested surface or replace the admitted forensic focus before
correlated admission.

## Proof

- context success/failure replay;
- non-Git Context replay proving revision-dependent capabilities unavailable;
- revision-observation-failure replay proving typed capability error;
- Project-switch late-result rejection;
- duplicate/unknown capability rejection;
- shared capability command envelope/result success/failure/correlation replay;
- subscription event routing replay;
- navigation and deep-link replay, including pending, failure, success, and
  Project-transition handling of admitted visible surface and forensic focus;
- dependency test preventing internal capability imports.

## Non-Closure

- host reducer branches on build or proposal status meaning;
- effect handler decides the next state transition;
- capability state is stored in the host rather than in the capability slice;
- commands can bypass correlation validation.
