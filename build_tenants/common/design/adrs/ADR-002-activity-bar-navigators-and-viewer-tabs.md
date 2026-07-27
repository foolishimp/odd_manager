---
Status: accepted
Date: 2026-07-11
Governance:
  - .genesis/docs/standards/DESIGN_MODULE_METHOD.md
  - .genesis/docs/standards/UX_METHOD.md
Derives from:
  - build_tenants/common/design/adrs/ADR-001-canonical-ux-functions-and-projection-instances.md
  - build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md
Supersedes: none
Superseded by: none
---

# ADR-002: Activity-Bar Navigators And Viewer Tabs

**Implements**: `PO-OM-OBSERVE-001`; `PO-OM-LENSES-001`; `PO-OM-DEVELOPER-001`; `PO-OM-AUDIT-001`; `REQ-OM-NAV-*`; `REQ-OM-INS-*`; `REQ-OM-LNS-*`
**Code Entrypoints**: `build_tenants/react_vite/src/features/sidecar/SidecarPanel.tsx`; `build_tenants/react_vite/src/features/sidecar/sidecar-state.ts`; `build_tenants/react_vite/src/features/sidecar/ai-workspace-browser.ts`
**Executable Proof**: `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` :: `sidecar selector uses the same filesystem browser for tickets and comments`; `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` :: `AI Workspace delegates Tickets and Comments to canonical left navigators`; `build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts` :: `sidecar Build Tenants is a first-class navigator rather than a pinned favorite`
**STDO-UX Bindings**: State=SidecarState provider flyout and viewer-workspace slices; Msg=SidecarMsg provider selection browser and viewer-tab variants; Update=reduceSidecarState; Cmd=SidecarCmd load and navigation commands; Sub=no autonomous provider subscription with refresh command-driven; Ingress=filesystem browser and AI Workspace response validation; View=SidecarPanel activity bar flyout and viewer groups; Membrane=Sidecar HTTP browser and navigation effect adapters; Replay=build_tenants/react_vite/runtime/tests/test_sidecar_msg_replay.mjs :: rail flyout surface selection replays without Cmd effects; Accessibility=build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts :: sidecar selector uses the same filesystem browser for tickets and comments
**Accepted Ontology And Design Basis**: `ONT-OM-DEVCTRL-001` and `B-OM-DEVCTRL-LOCAL-001`; this ADR projects `P-CONTEXT`, `P-OBSERVATION`, and `P-REPLAY`.
**Accessibility Proof Scope**: Navigator/viewer keyboard traversal, focus return, expanded/selected annotations, representative contrast, and responsive containment are exercised by the declared operator bundle.
**Implementation Acceptance**: Accepted for the manager-local activity-bar, navigator, and viewer-tab relation subject to the exact T-032 validation bundle.

## Context

The Sidecar shell has two distinct interaction roles:

- the left activity bar and flyout choose and browse a collection;
- the right viewer workspace renders selected objects in tabs.

The initial AI Workspace tab flattened discovered tickets and comments into
artifact rows even though the Sidecar already had richer collection
navigators. Specification and Build Tenants were also presented as default
favorites despite being stable Project-level navigation functions.

That shape violated ADR-001. It created weaker rival navigation for tickets
and comments, and represented canonical Project roots as user-pinned
exceptions.

## Decision

The Sidecar follows one activity-bar/navigator/viewer grammar:

```text
activity-bar provider
  -> provider flyout
  -> collection hierarchy, filter, sort, refresh
  -> object selection
  -> canonical viewer tab
  -> optional tab-to-tab navigation
```

The first built-in collection providers are peers:

| Symbol | Provider | Root | Navigator responsibility |
| --- | --- | --- | --- |
| `T` | Tickets | `.ai-workspace/tickets/` | lane hierarchy, name/time order, refresh, ticket source selection |
| `C` | Comments | `.ai-workspace/comments/` | author/time hierarchy, name/time order, refresh, commentary source selection |
| `S` | Specification | `specification/` | constitutional source hierarchy, name/time order, refresh, document selection |
| `B` | Build Tenants | `build_tenants/` | realization hierarchy, name/time order, refresh, source/document selection |

Browse and Recent Paths remain system navigators at the bottom of the activity
bar. User favorites remain a separate dynamic family between built-in and
system providers. A canonical provider root cannot also be stored or rendered
as a favorite.

The viewer workspace owns tabs, splits, document presentation, ticket detail,
commentary detail, and specialized observation views. A navigator opens those
tabs through the canonical selection path. A viewer tab may open another tab
or activate a navigator when that transition preserves Context and uses the
same canonical function.

## AI Workspace Boundary

AI Workspace remains the read-only feature inventory for Project-owned
`.ai-workspace` observation. It reports feature availability, counts,
capabilities, and source identity.

AI Workspace is not a second collection navigator:

- Tickets and Comments activate their canonical left providers.
- Runtime, events, proofs, catalogs, and run artifacts use Run Inspector or
  their canonical specialized viewer when one exists.
- Raw artifact rows remain only for feature families that do not yet have a
  canonical navigator or specialized viewer.
- AI Workspace does not reconstruct sorting, hierarchy, status lanes, source
  actions, or detail rendering owned elsewhere.

## Ownership

| Carrier | Owner | Rule |
| --- | --- | --- |
| Provider registry | Sidecar shell | Declares stable activity-bar identity and root binding only |
| Navigator state | Canonical navigator function | Owns expansion, sorting, refresh, and selection continuation |
| Favorite paths | Sidecar user profile | Contains user-selected non-canonical Project paths only |
| Viewer tabs | Sidecar viewer workspace | Owns tab placement, focus, splits, and close behavior |
| Object meaning | Ticket, Commentary, Document, or observation function | Never reconstructed by provider, favorite, or placement code |
| AI Workspace inventory | AI Workspace observation function | Detects availability and routes to canonical functions |

## Interaction Contract

1. Selecting `T`, `C`, `S`, or `B` opens its flyout and clears any active
   favorite binding.
2. The selected provider remains visibly active while its flyout is open or
   collapsed.
3. Selecting a file or domain object opens or focuses one canonical viewer tab.
4. Switching providers does not close existing viewer tabs.
5. Missing provider roots render an honest missing state in the flyout.
6. Stored favorites equal to a canonical provider root are removed during
   profile admission.
7. Keyboard and pointer interaction use the same typed selection messages.

## Proof

Closure requires:

- provider-registry replay proving `T`, `C`, `S`, and `B` are peers;
- profile/favorite proof rejecting canonical roots as favorites;
- browser proof for provider selection, sorting, refresh, and tab opening;
- AI Workspace proof that Tickets and Comments activate their canonical
  navigators and are not rendered as rival artifact lists;
- desktop and mobile containment checks.
