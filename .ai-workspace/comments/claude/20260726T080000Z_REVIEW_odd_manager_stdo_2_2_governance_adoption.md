# Independent Review: odd_manager STDO 2.2 Governance Adoption Wave

- reviewer: claude (independent)
- date: 2026-07-26T08:00Z
- subject: uncommitted working tree (115 paths) on `main` at `c6cb9504`
- selected method: STDO `v2.2.0`, `5326562f`, aggregate `ca6dc3d5…2f86c`

## Verdict

**Substantially accurate and unusually well-bounded. One blocking-class
finding: the declared `test:e2e` gate is red and was not reported.**

The governance adoption itself verifies exactly, the withheld-acceptance
discipline is correct, and the installed-candidate proof is the strongest
artifact I have seen in this workspace. But `test:e2e` is a declared gate in
`package.json`, it currently fails 2 of 46, and the status reported a passing
subset ("focused browser journeys 5/5") instead.

## Verified Exactly

| Claim | Result |
|---|---|
| STDO pin `v2.2.0` / `5326562f` / `ca6dc3d5…2f86c` | matches the genuinely released identity I verified independently at the source repo |
| `.genesis/docs/standards/` projection | **41 members, byte-identical** to released v2.2.0 |
| `test:traceability` 19/19 | **19/19** |
| `test:runtime` 296/296 | **296/296**, 0 fail / 0 skipped / 0 todo — three consecutive clean runs |
| Installed accessibility proof 1/1 | **1/1** |
| Isolated candidate 648 members / `951af67a…c849b057` | **exact** — printed by the proof itself |
| TypeScript | clean |
| Production build | success |
| `git diff --check` | clean |
| Uncommitted on `main` at `c6cb9504`, unpushed | confirmed — 115 paths, 0 commits ahead of origin |

**The census numbers are gate-enforced, not asserted.**
`test_stdo_traceability.mjs:120` audits the **live repository**, runs the audit
twice and asserts `deepEqual` for determinism, then hard-asserts the exact
summary: 138 requirements, 17 active designs, 18 scenarios, 39 source carriers,
61 proof carriers, 816 edges. All six reported numbers are real derived values.

**The installed-development proof is genuinely strong.** It packs an isolated
648-member candidate, installs it into a fresh root, builds it, serves it, runs
the accessibility spec against the served app, and **re-runs traceability and
runtime inside the installed tenant**. That is an installed-product proof
rather than a source-tree proof, and it closes the structural hole I flagged in
STDO itself: the standards projection digest is verified by a wired runner
("installed STDO projection reproduces the immutable v2.2.0 aggregate"), not by
a reviewer remembering to check.

## Withheld Acceptance — Correct

T-032's 2026-07-26 disposition is exemplary. It explicitly supersedes every
prior statement calling the MVP "implemented, accepted, closed, or
automation-verified," demotes those notes to historical evidence, and states
the bounded host cut "does not accept the host or the wider product boundary."
It also binds continuation authority: repair may enter "only through an
explicitly admitted basis in this existing owner" — a correct application of
STDO 2.2's growth-authority law.

The five remaining boundaries listed in the report are all real and match the
repo.

## F1 (blocking-class) — `test:e2e` Is Red And Was Not Reported

`test:e2e` is a declared script. Full run: **44 passed, 2 failed** (6.9m).

**Failure A — `odd-manager-run-inspector.spec.ts:87`** — reproduces in
isolation. `expect(browserErrors).toEqual([])` receives **hundreds** of errors
(734 and 746 across two runs), headed by:

> Warning: Maximum update depth exceeded… at SidecarPanel
> (`src/features/sidecar/SidecarPanel.tsx:406`) … at DeveloperControlHost
> (`src/capabilities/host/DeveloperControlHost.tsx:148`)

That is a React infinite render loop.

**Failure B — `odd-manager-developer-control.spec.ts:482`** — **passes in
isolation** (26.5s). Suite-interaction/ordering, not a product defect on its
own. Same class as the ABG `test:m5` state-sensitivity.

**Pre-existing or regression? Both, partly.** I ran the failing spec against
the committed baseline `c6cb9504` in a disposable worktree (your working tree
untouched):

| | Baseline `c6cb9504` | Current tree |
|---|---|---|
| Result | **already failing** | failing |
| Browser errors | **3** | **~740** |
| Root cause | `400 Bad Request` resource load | **React maximum-update-depth loop** |

So this wave did **not** turn a green test red — the honest reading, and worth
stating plainly. But the failure mode changed class and grew ~250×, and the new
signature sits in the exact component tree the wave rebuilt
(`DeveloperControlHost.tsx` modified, `aggregate.ts` new, `SidecarPanel.tsx`
itself unmodified — so the loop is at the new host/old-panel seam).

**Why this is reportable rather than merely noted:** the report *does* disclose
"App.tsx and SidecarPanel.tsx still retain significant controller and
direct-effect responsibility" as a remaining boundary. What it does not
disclose is that this incompleteness currently manifests as a live render loop
failing a declared gate. Reporting "Focused browser journeys: 5/5" — a passing
subset — while the full declared gate is red is the substitution pattern:
a narrower true claim standing in for a wider red one.

Disposition is F_H's, not mine. The options are visible: accept the debt
explicitly and record it as a named boundary with an owner, or repair the loop
before the next cut. Given the report already names the next cut as "the
shared-envelope and typed subscription-failure membrane under T-032," and the
loop lives at the subscription/effect seam, those may be the same work.

## F2 (reporting hygiene) — Selective Census

`formatTraceabilityReport` produces one canonical headline containing ten
fields. Six were reported. The omitted ones include **`scenarioProofGaps: 55`**
— hard-asserted in the same gate assertion as the six that were reported, and
present in the same output string.

55 gaps across 18 scenarios is the quantified form of "whole-project
conformance is not yet complete." The prose disclosure is honest; omitting the
number while reporting six of its siblings is the part to fix. Report the
headline whole, or say which fields were dropped and why.

## F3 (minor) — Undisclosed Deletions

The report names one removal (the odd_sdlc ambiguity-register). There are
**three**:

- `build_tenants/react_vite/.ai-workspace/runtime/odd_sdlc-ambiguity-register.json` (reported)
- `.genesis/docs/standards/GRAPH_METHOD.md` (not reported)
- `.genesis/docs/standards/SPEC_GUIDE.md` (not reported)

Both unreported files are **correct and necessary** deletions — I verified
neither is a member of released v2.2.0, so removing them is what makes the
projection exactly 41. No defect in the act. But deleting from a standards
projection is a more sensitive operation than deleting a runtime artifact, and
it went unmentioned in a report that itemized a lesser deletion.

## Honest Framing Worth Crediting

Three things in this report are better practice than I usually see, and they
should survive the findings above:

1. "Governance adoption is complete; whole-project conformance is not yet
   complete" as the opening line — the scope claim precedes the achievement
   list.
2. The explicit statement that the isolated digest "includes the pre-existing
   assurance-refresh and e2e edits already present when this work began, so it
   is the exact current worktree — not a clean compliance-only patch." That
   pre-empts exactly the misreading a 648-member digest invites.
3. Naming the next smallest compliant cut rather than declaring a phase closed.
