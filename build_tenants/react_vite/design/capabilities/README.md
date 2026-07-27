# Developer Control Capability Modules

**Status**: Active
**Date**: 2026-07-11
**Tenant**: `react_vite`
**Governance**: STDO-UX
**Parent Design**: `build_tenants/common/design/DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md`
**ADR**: `build_tenants/react_vite/design/adr/0003-modular-capability-host-and-command-membrane.md`

## Registry

| Module | Design | First implementation wave |
| --- | --- | --- |
| Capability Host | `capability-host.md` | W16 |
| Build Portfolio | `build-portfolio.md` | W16 shell, W17 MVP |
| Project Workbench | `project-workbench.md` | W16 shell, W17 MVP |
| Specification Proposal | `specification-proposal.md` | W16 unavailable shell, W18 MVP |
| Build Control | `build-control.md` | W16 unavailable shell, W19/W20 MVPs |
| Assurance and Attention | `assurance-attention.md` | W16 read-only shell, W21 MVP |
| Run Observation | `run-observation.md` | W16 existing-observation adapter |

Each module owns its State, Msg, Update, Cmd, Sub, selectors, contribution,
view, ingress, and replay proof. Only its public `index.ts` may be imported by
the host. Capability-to-capability imports are forbidden.

The structural shell is not the capability MVP. Each module reports its
availability and functional posture separately.

## Current Implementation And Design-Method Disposition

The registry and each module's `Implements`, STDO-UX binding, code-entrypoint,
and executable-proof metadata project the accepted manager-local boundary
`B-OM-DEVCTRL-LOCAL-001` and Ontology `ONT-OM-DEVCTRL-001` in the parent
design. The aggregate consumes the shared command-envelope/result schemas,
subscription failures are typed and replayable, and application/Sidecar
continuation crosses named reducers and effect membranes.

Acceptance is limited to this manager-owned structural and interaction
boundary and remains subject to the exact T-032 deterministic validation
bundle. It does not make an absent external carrier available, establish
functional Build/Assure completion, or close the live odd_glc steel thread.
