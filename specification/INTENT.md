# Intent

**Status**: Active
**Date**: 2026-07-11
**Derived From**: current repo initialization and project repricing

## Purpose

`odd_manager` exists to provide a serious operator-facing control surface for
outcome-driven systems built on GTL and ABG, with `odd_method` shaping how
domain packages are authored and with concrete `odd_*` domain packages
publishing the domain-specific graph-function worlds the manager supervises.

Its first primary persona is the developer operating multiple Spec Method and
ODD-governed Projects. The developer's primary interaction goal is to move one
or more selected Project revisions from governed specification through
evidence-backed, gate-complete build outcomes.

It exists because the canonical truth is now split cleanly:

- `abiogenesis` owns language and runtime law
- `odd_method` owns the method for building domain packages such as
  `odd_glc` and later `odd_*` lines
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
- a portfolio-level control surface over multiple Projects, their specification
  revisions, readiness, admitted builds, runtime posture, assurance, and
  attention state
- one coherent `Review -> Tune -> Build -> Assure` Project interaction loop
- attributable specification prompting that produces validated proposals for
  explicit acceptance or rejection before constitutional truth changes
- typed build-command admission, bounded concurrent process supervision, and
  correlation to ABG-owned run truth without moving graph policy into the
  manager
- evidence-backed required-versus-delivered gate and asset assurance with
  explicit repair, escalation, and lawful re-entry actions
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
- a modular but integrated capability architecture in which portfolio,
  Project workbench, specification proposal, build control, assurance,
  attention, and run observation can iterate behind clean typed boundaries

## Constraints

The project is constrained by these rules:

- `.genesis/docs/standards/SPEC_METHOD.md` is the governing process
  constitution
- `.genesis/docs/standards/GRAPH_METHOD.md` is the stronger method surface for
  graph-native work
- the current source project is authored as the `odd_manager` control-plane
  product under `SPEC_METHOD.md`; workspace-local `odd_sdlc` runtime installs
  are legacy provenance and must not define manager identity
- `abiogenesis` remains canonical truth for GTL and ABG objects, boundaries,
  runtime law, and projection law
- `odd_method` remains methodology, not the one and only domain package the
  manager may supervise
- concrete domain semantics must come from published domain-package contracts,
  not from sibling-repo assumptions or manager-local hardcoding
- primary project identity must remain distinct from governance-package
  identity; a Project governed by a shared runtime package may still be
  primarily `odd_glc` or another `odd_*` product and must be presented that way
- `odd_manager` must not create a shadow runtime after ABG dispatch
- `odd_manager` may admit published semantic work, schedule and supervise
  external process lifecycle, and submit attributable operator decisions; ABG
  remains owner of traversal, continuation, event truth, evidence admission,
  and runtime closure
- no build action may be implemented as hidden view-owned shell text when an
  admitted typed product carrier is required
- prompting may propose constitutional change, but may not make that change
  authoritative without visible validation, attribution, and explicit
  acceptance
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
- product UX follows STDO-UX: typed state and messages, pure update, declared
  commands and subscriptions, one explicit effect membrane, runtime ingress
  validation, and replay proof for product-meaningful interaction
- capability modules integrate through shared Context, product contracts,
  commands, events, evidence, and navigation; they do not mutate one another's
  internal state or create separate world models
- the operator visual language, including graph-workspace styling, is retained
  as first-class design law even while the semantic model is rebuilt around
  graphs, typed assets, and workorders
