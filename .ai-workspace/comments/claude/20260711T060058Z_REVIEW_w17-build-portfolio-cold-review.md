---
kind: review
agent: claude
date: 2026-07-11T06:00:58Z
ticket: T-034
authority: commentary (per POSTING_GUIDE.md)
---

# Cold Review — W17 Build Portfolio + Project Workbench MVP (T-032/T-033/T-034)

Independent cold review (claude) of the codex-owned wave; the codex W17 post
is a self-review and correctly routes F_H acceptance to the operator. This
review ran all declared gates, a 22-agent adversarial finder/verifier pass
over the 107-file diff, and an authority/conformance trace.

## Gates (all enumerated; all run)

| Gate | Result | Claim match |
| --- | --- | --- |
| npm run build | GREEN | matches |
| tsc --noEmit | GREEN — 0 errors (repo-wide first) | matches |
| test:runtime:node | GREEN 223/223 | matches |
| test:e2e (Playwright) | GREEN 38/38 — the four chronic pre-existing failures are gone | matches |
| git diff --check | GREEN | — |
| live instance :5175 | answers 200 | matches |
| lint | STILL NO LINT GATE DECLARED (standing F_H item from the 2026-07-10 review) | — |

## Authority / Method (sound)

- Genuine spec-first trace: T-032 product_reprice → INTENT/PRODUCT/GOALS
  G-006/G-007 → new REQ-OM-DEV-* / REQ-OM-CAP-* families + scenarios →
  realization. Sidecar demotion lawfully repriced (REQ-OM-NAV-002 retitled;
  requirement 10 re-anchored on Workbench + Build Portfolio + Run Inspector).
- STDO-UX: membrane declared (ADR 0003) and proven — Build Portfolio replay
  incl. late-result rejection; e2e asserts multi-row portfolio and Sidecar
  Projects-control removal.
- The IA/selection-authority change was NOT escrow-deferred; recorded as
  operator direction. Correct.

## Verified Findings (ranked)

1. **[P0] First-run deadlock** — developer-control-bootstrap-service.mjs:181.
   Empty registry → bootstrap 400 → WorkbenchComposition never mounts → the
   only registration UI (Build Portfolio Add Project) is unreachable. Fresh
   checkout/new machine is permanently stuck without hand-editing
   projects.local.json. The removed Sidecar provider was the old escape hatch.
2. **[P0] Layout-profile wipe, same class as the prior wave's bug** —
   sidecar-state.ts:1240. Profiles with activeInfoSurface 'projects' (the
   removed provider) fail WHOLE-profile validation at unchanged version 1;
   defaults overwrite the stored profile. The wave migrated retired viewer-tab
   kinds correctly but missed this field. Removed kinds must migrate (e.g. →
   'tickets'), never fail the profile.
3. **[P0] Host-tab navigation silently broken** — SidecarPanel.tsx:643 +
   DeveloperControlHost.tsx (~:244). One-shot openedInitialSurface ref +
   same mounted SidecarPanel instance (no key) → every non-workbench tab
   after the first shows the previous surface while the host highlights the
   new tab.
4. **[P1] Lost removal guard** — build-portfolio/view.tsx:197. Old guard
   disabled removal for context-root OR registry-active; new Remove keeps
   only registry-active. Context/active divergence windows (activate
   in-flight, stale localStorage root) allow removing the project the
   operator is standing in.
5. **[P1] Residual reload race** — build-portfolio/update.ts:43. enqueueLoad
   dedup silently drops the reload requested by project-registered/
   unregistered/registry-changed when a load is already in flight — the
   "Add Project loading race" fix is real for resume but this path can still
   serve a stale portfolio.
6. **[P1] Weakened JSONL validation** — ai-workspace-observation-service.mjs:212.
   Oversize ledgers went from honest error state to ok:true/deferred —
   observation now reports present for artifacts it never validated
   (silent-drop class the sprint outlawed).
7. **[P1] Event-loop-blocking git calls** — developer-control-bootstrap-service.mjs:36.
   Two synchronous git subprocesses per registered project per bootstrap call
   on the single-threaded server (PTY websockets stall).
8. **[P2] Unvalidated external payloads entering UX state** —
   build-portfolio-command-runtime.ts:53 (browse entries, activate result
   root) — violates UX_METHOD §10 at the new membrane's own seam.
9. **[P2] Dead CapabilityModule wiring** — DeveloperControlHost.tsx:313
   hardcodes an if/else composition chain while ADR 0003's CapabilityModule
   abstraction goes unused — two capabilities frozen out of the declared
   module shape; per-capability tests/ dir also absent and unenforced.
10. **[P2] Three parallel activation paths** — SidecarPanel.tsx:830: the
    portfolio.activate membrane, handleHistoryOpen's direct
    setActiveProject, and the App.tsx reconciliation — registry write
    authority is not yet singular, contra ADR 0003.

## Conformance flags

- C1: PRODUCT.md "Current Implementation Posture" (freshly authored this
  wave) claims Build Portfolio/Workbench "not yet realized … active product
  gaps" — contradicting T-033 (accepted) and T-034 (delivered) in the same
  tree. Present-tense product truth understates realized surface; repair at
  T-034 close.
- C2: T-034 carries no performed ## Triage (front-matter + one sentence);
  contrast T-032's performed walk. Owner's triage-first law applies to
  realization children too.
- C3: verified_by_automation is broadly honest, but "four rows" and
  desktop/mobile density are manual-only, and the 225→223 / 40→38 test-count
  drops are unexplained in the ticket.

## Verdict

The architecture and authority trace are sound and the gates are the
cleanest this repo has shown (tsc 0, e2e 38/38). Do NOT accept T-034 yet:
findings 1–3 are operator-facing hard breaks (first-run deadlock,
profile destruction, broken tab navigation) and finding 4 removes a
data-protecting guard. Recommended: fix 1–5 (+6 as sprint-law regression)
before F_H acceptance; 7–10 and C1–C3 may ride as named debt with owners if
the operator so rules. Lint-gate absence remains an open F_H ruling.
