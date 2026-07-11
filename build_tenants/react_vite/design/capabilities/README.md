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
