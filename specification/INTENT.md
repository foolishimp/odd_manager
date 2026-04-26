# Intent

**Status**: Active
**Date**: 2026-04-06
**Derived From**: current repo initialization and project repricing

## Purpose

`odd_manager` exists to provide a serious operator-facing control surface for
outcome-driven systems built on GTL and ABG, with `odd_method` shaping how
domain packages are authored and with concrete `odd_*` domain packages
publishing the domain-specific graph-function worlds the manager supervises.

It exists because the canonical truth is now split cleanly:

- `abiogenesis` owns language and runtime law
- `odd_method` owns the method for building domain packages such as
  `odd_sdlc`, `odd_world_model`, and later `odd_*` lines
- a concrete domain package owns the currently active domain-specific graph
  functions, query overlays, and control semantics for one workspace
- the manager product must therefore become its own control-plane project

`odd_manager` must make those systems:

- visible
- governable
- auditable
- explainable
- operable under attributable runtime and policy truth

## Outcomes

The project must deliver:

- a separate project-owned control-plane boundary under `odd_manager`
- a canonical dashboard design rooted in GTL/ABG truth rather than inherited
  transport metaphor language
- a published operator visual language covering shell, inspector, board, and
  graph-workspace surfaces
- a published domain model for the observed graph-native workspace
- operator-facing read models over graph sets, typed assets, asset bindings,
  workorders, jobs, roles, runs, graph calls, frames, continuations, evidence,
  provenance, and closure
- explicit host surfaces for manager-owned core pages and domain-contributed
  pages or actions selected through the active domain package contract
- a versioned contract seam that lets one manager installation supervise
  different `odd_*` domain packages without forking the whole control plane
- a common loader that resolves the selected workspace's primary project
  identity before choosing domain landing pages, domain entry lenses, and shell
  framing
- industrial-grade observability, governance, and audit posture over live
  runtime truth
- a tenant-local implementation path for the UI without turning the UI into a
  second runtime

## Constraints

The project is constrained by these rules:

- `.genesis/docs/standards/SPEC_METHOD.md` is the governing process
  constitution
- `.genesis/docs/standards/GRAPH_METHOD.md` is the stronger method surface for
  graph-native work
- the current source project is authored as an `odd_sdlc`-governed software
  product project under `SPEC_METHOD.md`, but the shipped manager boundary must
  not collapse into one permanent `odd_sdlc`-only UI
- `abiogenesis` remains canonical truth for GTL and ABG objects, boundaries,
  runtime law, and projection law
- `odd_method` remains methodology, not the one and only domain package the
  manager may supervise
- concrete domain semantics must come from published domain-package contracts,
  not from sibling-repo assumptions or manager-local hardcoding
- primary project identity must remain distinct from governance-package
  identity; an `odd_sdlc`-governed project may still be primarily
  `odd_world_model` and must be presented that way
- `odd_manager` must not create a shadow runtime after ABG dispatch
- derived operator lenses are allowed, but they must derive from canonical
  domain and runtime truth
- core runtime pages may be cross-domain, but domain-specific tabs and actions
  must be admitted through the active domain-package contract
- the common loader must choose domain landing pages and shell titling from the
  selected workspace's primary identity rather than from governance-only
  markers
- inherited transport metaphors may inform migration, but they must not remain
  the primary ontology
- the product tone remains operational and serious rather than playful
- the operator visual language, including graph-workspace styling, is retained
  as first-class design law even while the semantic model is rebuilt around
  graphs, typed assets, and workorders
