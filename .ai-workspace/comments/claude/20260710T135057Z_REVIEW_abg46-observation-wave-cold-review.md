---
kind: review
agent: claude
date: 2026-07-10T13:50:57Z
ticket: T-031
sprint: SPRINT-2026-07-10-abg46-observation-reprice
authority: commentary (per POSTING_GUIDE.md)
---

# Cold Review — ABG 4.6 Observation Wave (W0 retirement + W7/W8/W9 restores)

Reviewer disclosure: this wave was built under my own orchestration; treat
this as the -011 self-review class. The finding verification pass was
adversarial (independent finder/verifier fan-out, 28 candidates verified,
8 refuted). The close ruling is F_H and belongs to the operator.

## Scope Boundary (finding R-13, read first)

The working tree contains TWO workstreams:

1. The orchestrated wave this review targets: W0 retirement (~12,600 lines),
   W7 Traversal View, W8 DrillView/Tickets Board, W9 AI Workspace tab, plus
   sprint/ticket documentation.
2. A concurrent, unattributed workstream discovered during review:
   `specification/GOALS.md` reprice (G-001 rewritten off "ABG 4.2", new
   G-005), `specification/requirements/03-read-model-and-projection.md`
   (REQ-OM-PROJ-017 rewritten), new `workspace-identity-service.mjs`,
   `abg-run-observation-service.mjs`, `project-observation-topology-service.mjs`,
   `contracts/abg-run-observation.ts`, `abg-run-observation-validation.ts`,
   and edits to shared files (`index.mjs`, `SidecarPanel.tsx`,
   `ai-workspace-observation-service.mjs`, `oddterm-pool-service.mjs`,
   `AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`). This is W1/W2/W3-shaped work
   (it makes finding 10 true: it supersedes in-file identity detection my
   wave had kept).

All gates below ran over the COMBINED tree. The unattributed workstream is
wired into shared files, so the two waves are not separable by file list.
It has had no review of its own. Provenance needs operator attribution
before any commit; the planned three-slice commit is blocked until then.

## Gates (all declared gates enumerated per gates law)

| Gate | Result |
| --- | --- |
| `npm run build` (vite) | GREEN (3.8s) |
| `npm run test:runtime:node` | GREEN 193/193 |
| `npm run test:e2e` | **RED — 27 passed / 4 failed.** Same four baselined pre-existing at stashed-clean HEAD (collaboration x2: "Open workspace selector" control removed by f2110ca without spec update; smoke browser-refresh: renamed control; smoke terminal-panes: fixture session-count). Pre-existing does not make the gate green; acceptance is an F_H ruling. |
| `git diff --check` | GREEN |
| tsc advisory vs HEAD | GREEN in trend: 22 errors at HEAD → 14 in tree (8 removed, 0 introduced) |
| lint | **NO LINT GATE EXISTS** — no script, no CI. Under the gates law the declared gate set is itself incomplete. F_H ruling requested: declare a linter or record its absence as accepted debt. |

E2E side effect reconfirmed live: the suite mutated the live project
registry again during the gate run (injected `test_runs`,
`data_mapper.test35`, `managed-refresh-root`; stole the active pointer).
Restored post-run. This is finding R-11.

## Verified Findings (ranked; escrow class per STDO-UX §13B)

1. **[CONFIRMED / P0] Layout-profile wipe on upgrade** —
   `sidecar-state.ts:1218`. `isViewerTabKind` dropped `'process'` but the
   profile version stayed 1 and `validViewerWorkspace` fails the WHOLE
   profile on one unrecognized tab kind. Any operator who ever opened the
   Process Navigator loses their entire saved workbench (widths, splits,
   all tabs) silently on first launch, and the next save overwrites it.
   Class: `local_paydown` before commit — migrate/drop unknown tab kinds
   instead of failing the profile (or bump version with migration).

2. **[CONFIRMED / P1] Traversal detail cache evicts the selected vector**
   — `sidecar-state.ts:2145`. Late-arriving responses for abandoned
   selections can evict the selected vector's entry while `detailStatus`
   stays `ready`; detail pane goes permanently blank until reselect.
   Class: `local_paydown` (protect the selected key from eviction, or
   re-key status by selection).

3. **[CONFIRMED / P1] "latest" detail cache never invalidated on summary
   reload** — `sidecar-state.ts:2098`. After a retry lands, attempt-null
   ("latest") cache keys keep serving the superseded attempt as current.
   Class: `local_paydown` (flush attempt-null keys on
   `traversal/load-succeeded`).

4. **[CONFIRMED / P1] Per-request full-proof parse on the detail path** —
   `traversal-projection-service.mjs:652`. Every vector click re-reads and
   re-parses the proof (budget up to 16 MB) synchronously on the
   single-threaded server, stalling all APIs and PTY websockets.
   Class: `local_paydown` (reuse the summary cache for run-root/scenario
   resolution).

5. **[CONFIRMED / P1] Successor views shipped with zero browser-level
   coverage** — the retired lane's e2e spec was deleted; Traversal View,
   Tickets Board, and AI Workspace tab have replay proofs but no e2e. A
   DOM-level crash on real payloads passes every gate.
   Class: `local_paydown` (one smoke spec covering the three rail
   commands over the reference run; fold into the W3 fixture move).

6. **[PLAUSIBLE / P2] Summary cache keyed only on proof mtime** —
   `traversal-projection-service.mjs:502`. Vector artifacts written after
   the proof (live runs, retries) never refresh the summary until proof
   mtime changes or restart. Class: `local_paydown` (fold artifact-dir
   mtime into the cache key or add a short TTL). Note: consistent with
   the current reference (completed runs); bites on live observation,
   which is the product's stated direction.

7. **[CONFIRMED / P2] Raw internal errors leak through 404** —
   `index.mjs:1370`. Corrupted artifact JSON returns `404` with raw
   `JSON.parse` exception text rendered into the alert banner. Violates
   the honest-state law (W5). Class: `local_paydown`.

8. **[CONFIRMED / P2] Run-backed traversal tests skip silently off-machine**
   — `test_traversal_projection.mjs:19` hardcodes one timestamped run dir;
   when absent, all shape/bounds/lazy assertions skip and the lane looks
   green. Class: `local_paydown` with W3's committed-fixture move.

9. **[CONFIRMED / P3] Duplicated artifact-open flow** —
   `SidecarPanel.tsx:4417` re-implements the surface-open+path-history
   flow inline in the AI Workspace tab. Class: `local_paydown` (reuse) or
   `accepted` short-term.

10. **[CONFIRMED / P3] Dead identity mechanisms in index.mjs** — ~80 lines
    (`detectPrimaryIdentity`, `knownIdentityFromText/Name`,
    `detectGovernanceIdentities`) made unreachable by the CONCURRENT
    workstream's `workspace-identity-service.mjs`. Two rival identity
    mechanisms now coexist. Class: `remove` — but only after R-13
    attribution, since the supersession belongs to the other wave.

R-11. **[CONFIRMED / P1] e2e mutates the live registry** — reproduced
    twice today (fixtures injected, active pointer stolen). Class:
    `design_reframe` candidate (test-scoped registry root or env
    override) — carried by the sprint already, elevating severity: it
    corrupts operator state on every gate run.

R-12. **[F_H] No lint gate declared** — gates law finding; ruling
    requested.

R-13. **[F_H / blocking] Unattributed concurrent workstream** — see Scope
    Boundary. Needs attribution, its own review, and a commit plan that
    acknowledges interleaved shared files.

Also noted: B-079 is constitutionally obsolete (its subject was deleted,
not repriced); close it against S-009's repricing or rewrite it against
the Traversal View.

## Method Conformance (spot checks)

- UX_METHOD: new families carry typed contracts, runtime-validated
  ingress, pure reducers, declared Cmds, replay proofs incl. failure
  paths — conformant. Findings 2/3 are reducer-correctness defects inside
  that conformance, not method violations.
- No silent event drop: honored (34 unknown kinds surfaced). Finding 7 is
  the remaining honest-state gap on the error path.
- Ticket-first: the wave is carried by the sprint (operator-ratified
  carrier) and T-031 was updated with the full prune/restore record.
  Conformant given the operator's explicit sprint ruling.

## Review Verdict

The retirement is sound (mechanisms preserved, blast radius contained,
zero new type errors, honest 404 on the retired route). The restores are
method-conformant but carry three cache-correctness defects (1–3) of
which #1 is operator-data-destroying and must be fixed before commit.
E2E is red (pre-existing, F_H), lint gate absent (F_H), and the tree
contains a second unreviewed workstream (R-13, blocking commit
sequencing). Recommended order: attribute R-13 → fix 1–4 + 7 → e2e smoke
for successor views (5) → commit in attributed slices → separate review
for the concurrent wave.
