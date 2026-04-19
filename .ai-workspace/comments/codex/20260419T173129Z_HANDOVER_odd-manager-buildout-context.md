# odd_manager Buildout Handover

**Author**: Codex
**Date**: 2026-04-19T17:31:29Z
**Status**: Open handover
**Scope**: carry current `odd_manager` buildout context into a fresh Codex session

## Why This Post Exists

This session is closing and the next Codex session should pick up `odd_manager`
without having to re-discover the current architecture, current edits, or the
current methodological risks.

This post is commentary, not constitutional truth.

## User Direction Driving This Wave

The user clarified the target stack and the intended manager shape:

- `abiogenesis` and GTL remain the foundation
- `odd_method` is methodology for domain packages, not the one permanent domain
- `odd_sdlc` is one concrete domain package
- a future `odd_world_model` is another concrete domain package
- future `odd_*` domain packages may exist over the same substrate
- `odd_manager` should host:
  - core GTL/ABG system pages that are cross-domain
  - domain-specific pages and actions contributed by the active domain
- the manager needs one internal source of truth for active domain identity and
  version so one manager installation can supervise different domain contracts

The user also explicitly wants the spec surfaces to start taking form now under
`SPEC_METHOD.md`, with `odd_manager` treated as an `odd_sdlc`-governed product
project during this buildout.

## Work Completed In This Session

### 1. Refreshed the workspace onto the latest live odd_sdlc install

I reran the `odd_sdlc` install into this workspace so `odd_manager` picks up
the current domain/runtime line.

Important details:

- first install attempt used the wrong tenant shape and pointed the workspace at
  a `python` tenant
- that was corrected by rerunning install for the real active carrier:
  `react_vite`
- the active project constraints now point at:
  - `.ai-workspace/context/project_constraints.yml`
  - `build_tenants/react_vite/`
- the workspace-local installed runtime now lives under:
  - `.genesis/odd_sdlc/`

Relevant surfaces:

- `.ai-workspace/context/project_constraints.yml`
- `.genesis/odd_sdlc/`
- `AGENTS.md`
- `CLAUDE.md`

Note:

- the installer updated many `.genesis` files and removed older starter
  `build_tenants/odd_manager/python/` scaffold files
- this means the repo is currently dirty in many places that were not hand-edited

### 2. Reworked the runtime/domain seam in the React/Vite tenant

I changed the manager runtime helper so it no longer assumes `odd_method` is the
only domain source.

Main code changes:

- `build_tenants/react_vite/runtime/odd_manager_world.py`
  - prefers workspace-local installed `odd_sdlc` code from
    `.genesis/odd_sdlc/python/code`
  - falls back to live source repo `../odd_sdlc/build_tenants/python/code`
  - keeps the legacy `odd_method` path only as a fallback
  - defines explicit manager-side domain contract projection metadata:
    - `odd_manager.domain-world`
    - current supported source contract:
      `odd_sdlc.query-domain v10`
- `build_tenants/react_vite/src/lib/types.ts`
  - added `DomainContractView`
  - attached domain-contract compatibility state to the projected domain model
- `build_tenants/react_vite/runtime/tests/test_odd_manager_world.py`
  - added focused tests for supported and unsupported query-contract versions

Verification run in this session:

```bash
python -m unittest build_tenants/react_vite/runtime/tests/test_odd_manager_world.py
```

Result:

- `Ran 4 tests`
- `OK`

What this means:

- the manager now projects explicit upstream contract identity/version
- the current active supported contract is `odd_sdlc.query-domain v10`
- unknown versions degrade to explicit `unsupported`

### 3. Restored basic repo bootstrap surface

The install flow had stripped the repo root `README.md`, so I restored it.

Relevant file:

- `README.md`

### 4. Repriced the constitutional surface toward a host/domain model

I updated these constitutional files:

- `specification/INTENT.md`
- `specification/PRODUCT.md`
- `specification/requirements/01-control-plane-boundary.md`
- `specification/requirements/02-canonical-ontology.md`
- `specification/requirements/03-read-model-and-projection.md`

Core repricing introduced:

- `odd_method` is treated as methodology, not the one permanent domain line
- concrete `odd_*` domain packages own active domain semantics
- `odd_manager` is defined as:
  - a control-plane host
  - with manager-owned core system pages
  - plus domain-contributed pages and actions
- explicit domain identity / contract identity was raised into product and
  requirements
- compatibility state across domain contracts was raised into product and
  requirements

New important product terms introduced:

- `Core System Page`
- `Domain Package`
- `Domain Contract`
- `Domain UI Pack`
- `Domain Page`

## Critical Self-Review Findings

I reviewed the spec work using `SPEC_METHOD.md`. The repricing is directionally
correct, but it is not closure-ready.

### Finding 1: downstream chain still contradicts the repriced product boundary

These downstream surfaces still encode the old single-domain / builder framing:

- `specification/domain/DOMAIN_MODEL.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

Examples:

- `DOMAIN_MODEL.md` still derives directly from hardcoded `odd_method` sources
- `DOMAIN_MODEL.md` still says `odd_method` owns the read-only domain query logic
- `ODD_MANAGER_DASHBOARD.md` still treats `Builder` as a standing page
- `ODD_MANAGER_DASHBOARD.md` still treats `odd_method` as the builder/domain line

Method implication:

- under the consistency gate in `SPEC_METHOD.md`, this is still an active
  migration wave, not a closed repricing

### Finding 2: one requirement file still derives from design

`specification/requirements/03-read-model-and-projection.md` currently says it
derives from:

- `specification/PRODUCT.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

That is backwards under `SPEC_METHOD.md`.

Requirements are constitutional `WHAT`.
Design is structural `HOW`.

So this file still needs repricing to remove design as an upstream authority
surface.

### Finding 3: Domain UI Pack is currently half constitutional, half design

The current repricing made `Domain UI Pack` too concrete too early.

Problem:

- the product and requirement layers now partially specify the mechanism
- but the design layer still does not define the actual compatibility structure
  cleanly

Method-safe restatement:

- specification should require an explicit versioned compatibility boundary for
  domain-contributed pages/actions
- design should decide whether the realization carrier is a pack, plugin,
  registry, or another mechanism

### Finding 4: the future-domain contract is still incomplete

The runtime can now identify the active upstream domain contract, but the
manager still does not have a published contribution contract for what a domain
is allowed to contribute.

Missing or underdefined surfaces:

- domain entity families
- domain action intents
- domain page classes
- domain inspector contribution classes
- domain navigation contribution classes

Without that, the host model is only partial and still leans on manager-local
convention.

## Current Code Reality That Still Needs Refactor

The React/Vite carrier still contains older semantics that do not match the
repriced host/domain model.

Examples found during this session:

- `build_tenants/react_vite/src/lib/types.ts`
  - `CommandName` still includes `iterate`
- `build_tenants/react_vite/src/app/App.tsx`
  - still exposes `iterate`
- `build_tenants/react_vite/src/routes/WorkspaceRoute.tsx`
  - still uses `odd_method` wording
  - still passes `selectedStationId`
- `build_tenants/react_vite/src/lib/collaboration.ts`
  - still uses `stationId`
- `build_tenants/react_vite/src/features/oddboard/OddBoardWidget.tsx`
  - still uses `selectedStationId`
- `build_tenants/react_vite/src/features/oddterm/*`
  - still uses `selectedStationId`
- `build_tenants/react_vite/src/server/oddboard-service.mjs`
  - still uses station/train vocabulary deeply
- `build_tenants/react_vite/src/layout/AppShell.tsx`
  - still frames language “over odd_method”
- `build_tenants/react_vite/src/features/builder/BuilderPanel.tsx`
  - still treats the manager as a viewer over the `odd_method` project model

This means the runtime seam moved forward, but the UI and collaboration model
are still architecturally behind the new spec direction.

## Current Repo Posture

The repo is dirty. Not all current changes are hand-authored in this session.

Important current dirt sources:

- installer-updated `.genesis/**`
- deletion of older `build_tenants/odd_manager/python/**` starter scaffold
- current hand edits in:
  - `README.md`
  - `build_tenants/react_vite/runtime/odd_manager_world.py`
  - `build_tenants/react_vite/src/lib/types.ts`
  - `build_tenants/react_vite/runtime/tests/test_odd_manager_world.py`
  - `specification/INTENT.md`
  - `specification/PRODUCT.md`
  - `specification/requirements/01-control-plane-boundary.md`
  - `specification/requirements/02-canonical-ontology.md`
  - `specification/requirements/03-read-model-and-projection.md`

Do not assume a clean worktree.
Read before touching.

## Recommended Next Steps

This is the order I would resume in.

### 1. Finish the constitutional chain before claiming the host/domain repricing is settled

Reprice these next:

- `specification/domain/DOMAIN_MODEL.md`
- `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
- `README.md`

Goal:

- remove the lingering “odd_method is the builder/domain line” framing
- restate the design around:
  - core system pages
  - domain-contributed pages/actions
  - explicit domain compatibility resolution

### 2. Tighten the spec/design boundary for domain contributions

Decide and ratify:

- what is constitutional:
  - explicit versioned domain contribution boundary
  - active domain identity/version
  - supported vs unsupported compatibility state
- what is design:
  - the actual manager-side registry / pack / plugin carrier

If `Domain UI Pack` stays, it should likely move toward design ownership rather
than remaining this concrete in product/requirements.

### 3. Audit the rest of the requirement families for stale builder framing

At minimum inspect and likely reprice:

- `specification/requirements/04-orientation-and-navigation.md`
- `specification/requirements/06-operator-workbench.md`
- `specification/requirements/10-entry-lenses-and-delivery-workspaces.md`

Reason:

- these files still talk about builder/process framing in ways that may now need
  to split into:
  - cross-domain core pages
  - domain-contributed pages

### 4. Then start the UI carrier refactor

Likely implementation wave:

- reclassify current pages into:
  - core system pages
  - odd_sdlc-specific domain pages
- decide whether current `Builder` becomes:
  - an `odd_sdlc` domain page only
  - or a more generic domain page slot with `odd_sdlc` as the first concrete pack
- start unwinding `stationId` / transport vocabulary from collaboration and
  session surfaces
- unwind stale `odd_method` wording from UI copy and page summaries

### 5. Keep the current runtime contract seam, but generalize it next

The current runtime seam is still basically:

- manager projection contract:
  - `odd_manager.domain-world v1`
- supported upstream source:
  - `odd_sdlc.query-domain v10`

That is fine for now, but the next real step is to make the supported-domain
registry more explicit and less `odd_sdlc`-hardcoded.

## Suggested Read Order For The Next Codex Session

Start here:

1. `AGENTS.md`
2. `specification/GOALS.md`
3. `specification/INTENT.md`
4. `specification/PRODUCT.md`
5. `specification/requirements/01-control-plane-boundary.md`
6. `specification/requirements/02-canonical-ontology.md`
7. `specification/requirements/03-read-model-and-projection.md`
8. this handover post
9. `specification/domain/DOMAIN_MODEL.md`
10. `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`
11. `build_tenants/react_vite/runtime/odd_manager_world.py`
12. `build_tenants/react_vite/src/lib/types.ts`
13. `build_tenants/react_vite/runtime/tests/test_odd_manager_world.py`

Useful resume commands:

```bash
python -m unittest build_tenants/react_vite/runtime/tests/test_odd_manager_world.py
rg -n "odd_method|stationId|selectedStationId|iterate" build_tenants/react_vite/src build_tenants/react_vite/runtime
git status --short
```

## Practical Resume Summary

If you only remember five things, remember these:

1. The manager is being repriced from “viewer over the odd_method builder line”
   into “host over core GTL/ABG pages plus domain-contributed pages/actions.”
2. The runtime seam has already been moved partway: installed `odd_sdlc`,
   explicit domain contract projection, tests green.
3. The spec repricing is only half-finished because `DOMAIN_MODEL.md` and the
   shared dashboard design still encode the old worldview.
4. The UI carrier still has heavy legacy vocabulary: `Builder`, `iterate`,
   `stationId`, and `odd_method` copy.
5. The next lawful wave is: finish constitutional/design alignment first, then
   refactor the UI carrier against that aligned model.
