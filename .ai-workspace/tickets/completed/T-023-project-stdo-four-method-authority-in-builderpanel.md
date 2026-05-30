---
id: T-023
title: Project STDO four-method authority surface in BuilderPanel
type: feature
ticket_category: ui_substrate_alignment
status: superseded
review_status: superseded_by_t030
goal: realize-ai-workspace-topology-and-agent-interoperability
build_tenant: react_vite
owner: unassigned
change_intent: Project the STDO four-method constitutional authority (SPEC_METHOD, TICKET_METHOD, DESIGN_MODULE_METHOD, ODD_METHOD) plus the F_D / F_P / F_H regime distribution per published graph function, so BuilderPanel reflects the constitutional surface that the bootloader now names and that operators must read against to understand which authority governs a given builder artifact.
change_class: design_reframe
re_entry_point: design
affected_boundary: AssetSurface contract for installed standards mirror, ManagerWorld.domain authority carriers, BuilderPanel rendering, sidecar process projection (read-only consumer)
priority: medium
triaged_at: 2026-05-04
created_at: 2026-05-04
updated_at: 2026-05-30
governance_scope: STDO Method
governance_scope_expansion:
  - S: SPEC_METHOD.md
  - T: TICKET_METHOD.md
  - D: DESIGN_MODULE_METHOD.md
  - O: ODD_METHOD.md
  - U: UX_METHOD.md
depends_on:
  - abiogenesis bootloader STDO update (completed 2026-05-04)
  - abiogenesis installer smoke list extension (completed 2026-05-04)
superseded_by: T-030
intake_source: The bootloader at `abiogenesis/CLAUDE.md` and `abiogenesis/AGENTS.md` now names STDO as the four-method constitutional governance. odd_manager's BuilderPanel currently shows graph functions, workorders, ambiguity register, and asset taxonomy without any reference to the constitutional authority that governs them. Operators reading BuilderPanel cannot tell which method authorises a given builder artifact.
target_truth: BuilderPanel renders, alongside published graph functions and workorders, the four STDO methods as a discrete authority surface, each with its installed mirror path and a count of artifacts authorised under it. Each published graph function exposes its primary authority binding (which constitutional method authorises it), its declared F_D / F_P / F_H regime distribution per edge, and a derivation chain summary (REQ-* -> ADR-* -> Module).
superseded_truth: BuilderPanel surfaces graph functions and workorders without reference to STDO four-method authority or per-edge regime distribution.
closure_law: This ticket closes only when the STDO authority surface is admitted as a typed AssetSurface carrier, ManagerWorld.domain exposes it, BuilderPanel renders it, and a Msg-replay proof covers admission through final rendered state.
evaluation_criteria:
  - typed StdoAuthoritySurface carrier published in `src/contracts/`
  - AssetSurface action reads `.abiogenesis/docs/standards/` mirror and admits one StdoAuthoritySurface per workspace
  - ManagerWorld.domain.stdo_authority field carries the surface
  - BuilderPanel renders the four STDO methods with installed mirror paths and authorised-artifact counts
  - per-graph-function rendering shows primary authority binding and per-edge F_D/F_P/F_H regime distribution
  - derivation chain summary visible per published graph function
  - Msg-replay proof covers initial state, AssetSurface admission, final rendered state
proof_surface:
  - typed contract addition
  - AssetSurface service extension reading installed standards mirror
  - ManagerWorld type extension
  - BuilderPanel rendering update
  - Msg-replay proof under `runtime/tests/`
  - playwright walk opening the builder tab
non_closure_conditions:
  - rendering STDO method names as a static hardcoded list rather than projecting from the installed mirror
  - F_D / F_P / F_H regime distribution computed in the React render path rather than admitted through typed carrier
  - derivation chain summary rendered as free-text string rather than typed REQ/ADR/Module references
  - companion methods (UX, IDENTITY, WORLD_MODEL, RELEASE, WRITING, POSTING, GLOSSARY) conflated with the four STDO methods in the rendering
  - extension hidden inside BuilderPanel without lifting the typed carrier into the contract surface
---

# T-023: Project STDO Four-Method Authority In BuilderPanel

## Supersession Update - 2026-05-30

Superseded by `T-030`.

The BuilderPanel and ManagerWorld route projection no longer exist in the live
React tenant. Any future STDO authority operator surface must enter through the
Sidecar state/message/command/view surface and typed asset contracts rather
than reviving this legacy route target.

## STDO Triage

### First Missing Layer

Design.

The bootloader names STDO as the constitutional governance surface. The
UI does not yet have a typed read model for it. The missing layer is the
AssetSurface contract that lifts the installed standards mirror into a
UI-shaped representation, plus the per-graph-function authority binding
projection.

### Lawful Change Class

`design_reframe`. New typed carriers, no existing carrier change.

## Carrier Boundary (UX_METHOD §3A)

```
.abiogenesis/docs/standards/  +  graph function authority bindings
  -> projection builder
    -> AssetSurface action: admit StdoAuthoritySurface
      -> ManagerWorld.domain.stdo_authority
        -> BuilderPanel render
```

## Carrier Shape (sketch)

```ts
type StdoMethodKind =
  | "spec_method"
  | "ticket_method"
  | "design_module_method"
  | "odd_method";

type StdoAuthoritySurface = {
  kind: "stdo_authority_surface";
  methods: ReadonlyArray<{
    kind: StdoMethodKind;
    installed_path: string;
    file_present: boolean;
    authorised_artifact_count: number;
  }>;
  companion_guides: ReadonlyArray<{
    name: string;
    installed_path: string;
    file_present: boolean;
  }>;
};

type GraphFunctionAuthorityBinding = {
  kind: "graph_function_authority_binding";
  graph_function_id: string;
  primary_method: StdoMethodKind;
  derivation_chain: ReadonlyArray<{
    kind: "requirement" | "adr" | "module";
    ref: string;
    title: string | null;
  }>;
  regime_distribution: ReadonlyArray<{
    edge_id: string;
    regime: "F_D" | "F_P" | "F_H";
  }>;
};
```

## Implementation Slices

1. Author `StdoAuthoritySurface` and `GraphFunctionAuthorityBinding` in
   `src/contracts/`.
2. Extend AssetSurface service to read `.abiogenesis/docs/standards/`,
   verify file presence per smoke list, and admit StdoAuthoritySurface.
3. Extend per-graph-function projection in
   `src/server/sidecar-process-projection.mjs` (or appropriate carrier)
   to compute authority binding from the published Module.
4. Extend ManagerWorld.domain to carry the new fields.
5. Update BuilderPanel rendering: add a top-level STDO authority section
   above the existing graph-function block; per-graph-function row gains
   primary method, regime distribution sparkline, and derivation chain
   summary.
6. Msg-replay proof at
   `runtime/tests/test_builder_panel_stdo_authority_msg_replay.mjs`.

## Closure Criteria

- typed carriers published
- AssetSurface admission wired
- BuilderPanel renders STDO methods, per-graph-function authority binding,
  regime distribution
- Msg-replay proof passes
- companion guides rendered as a separate block, not conflated with the
  four STDO methods

## Non-Closure Statement

T-023 is not closed by hardcoding the four method names in JSX. It closes
only when the standards mirror is admitted as a typed projection and the
per-graph-function authority binding is computed by a typed projection
builder, not by string matching in the render path.
