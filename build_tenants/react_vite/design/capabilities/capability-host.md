# Capability Host

**Status**: Active
**Wave**: W16 structural foundation
**Requirements**: REQ-OM-CAP-002 through REQ-OM-CAP-005, REQ-OM-CAP-008

## Responsibility

Own shared Context, ProjectRevision admission, capability registration,
message routing, command correlation, subscriptions, navigation, and
integration replay. The host owns no proposal, build, assurance, or runtime
domain decisions.

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

## Messages

```text
host/context-requested
host/context-admitted
host/context-failed
host/capability-registered
host/capability-rejected
host/command-enqueued
host/command-succeeded
host/command-failed
host/subscription-event
host/navigation-requested
host/navigation-admitted
host/navigation-failed
```

## Commands And Subscriptions

| Cmd/Sub | Target | Success | Failure |
| --- | --- | --- | --- |
| `host.resolve-context` | registered Project/context API | `host/context-admitted` | `host/context-failed` |
| `host.interpret-command` | allowlisted command runtime adapter | `host/command-succeeded` | `host/command-failed` |
| `host.project-navigation` | URL/navigation adapter | `host/navigation-admitted` | `host/navigation-failed` |
| `host.subscribe` | declared capability event source | `host/subscription-event` | `host/command-failed` |

## Update Rules

- reject unregistered capability messages;
- reject duplicate capability identities;
- reject result command/correlation ids not pending in the host;
- reject result or event Project/revision basis that differs from its request;
- deliver validated product events only to declared subscribers;
- preserve current Context when requested Context admission fails;
- never inspect capability payloads to decide product workflow.
- route explicit capability supporting commands such as Context refresh or
  forensic navigation without taking ownership of their domain meaning.

## View Contribution

The host has no product page. It provides Context, navigation, capability
availability, and command-status bindings to the application shell and Project
Workbench.

## Proof

- context success/failure replay;
- Project-switch late-result rejection;
- duplicate/unknown capability rejection;
- command success/failure/correlation replay;
- subscription event routing replay;
- navigation and deep-link replay;
- dependency test preventing internal capability imports.

## Non-Closure

- host reducer branches on build or proposal status meaning;
- effect handler decides the next state transition;
- capability state is stored in the host rather than in the capability slice;
- commands can bypass correlation validation.
