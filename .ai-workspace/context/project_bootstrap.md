# Project Bootstrap

This generated surface is a deterministic read model over imported project authority.
It is not a replacement for project-owned specification truth.

## Workspace Identity
- workspace: `odd_manager`
- project slug: `odd_manager`
- platform: `react_vite`

## Project Identity
- authoritative project title: not confidently determined from imported authority
- identity source: no explicit imported identity surface detected
- workspace/template/bootstrap provenance does not change project identity

## Source Titles
- `specification/INTENT.md`: odd_manager Intent

## Ontology Anchors
- `specification/INTENT.md` → odd_manager Intent

## Read Order
- `specification/INTENT.md` when present
- `specification/requirements/00-imported-sources.md`
- imported requirement-like sources listed there
- `.ai-workspace/runtime/odd_sdlc-ambiguity-register.json` for current major ambiguity state
- `.ai-workspace/runtime/odd_sdlc-requirement-closure.json` for live requirement carry-forward and code/test closure state
- `specification/PRODUCT.md` and `specification/GOALS.md` only after the imported authority

## Installed Runtime Start Surface
- inspect current gaps with `PYTHONPATH=.genesis python -m genesis gaps --workspace .`
- trigger bounded odd_sdlc traversal with `PYTHONPATH=.genesis python -m genesis start --auto --workspace .`
- add `--human-proxy` only when you expect an explicit F_H approval lane; it does not proxy F_P transport failures
- deployment, runtime-return, and similar side-effect stages only traverse when the active build tenant declares the required technology capability contracts in `project_constraints.yml`
- major ambiguity is always recorded; `project_constraints.yml` declares `ambiguity_risk_appetite`, which governs whether unresolved major ambiguity is carried by `F_P` or escalated to `F_H` unless it is a hard-stop prerequisite
- when release/deployment/runtime remain at `pending_evidence` with no returned execution data, treat the converged boundary as `construction_complete_pending_execution`
- treat legacy bootstrap instructions or older scaffold references in imported project docs as provenance only, not active runtime guidance for this installed workspace

## Interpretation Rule
- use this surface to orient quickly
- use imported project sources as authority
- treat copied template/bootstrap history as provenance rather than live workspace guidance
- if ontology remains incomplete, say so explicitly rather than inferring it from repository context
