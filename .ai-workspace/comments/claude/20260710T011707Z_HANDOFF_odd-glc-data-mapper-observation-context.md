---
kind: handoff
agent: claude
date: 2026-07-10T01:17:07Z
ticket: T-031
authority: commentary (per POSTING_GUIDE.md)
---

# Context Checkpoint — odd_manager Observation of Latest odd_glc + GTL/ABG, Reference View = odd_glc data-mapper Run

Intent sentence this checkpoint serves: make odd_manager work with the latest
odd_glc and GTL/ABG; odd_glc's test environment has been running a data_mapper
scenario, which is the reference test view for odd_manager.

This is a read-model over three repos as observed 2026-07-10. Verify pins and
paths before acting; runs and RCs move.

## 1. Version Lattice

- abiogenesis (GTL/ABG substrate): released `4.5.1` ("Foundation Release");
  live RC `4.6.0-rc.2` (T-217 "Consciousness Wave"). "ABG 3" is the
  constitutional generation (`REQ-R-ABG3-*`); `4.x` is the release train over
  it. There is no ABG 4 constitution.
- 4.6-line observer-relevant deltas: witness/attestation event layer
  (typed, actor-attributed operator acts; replay-log digest attestation),
  citability as replay predicate, EVENTS-025 per-event basis scope
  (fail-closed — breaking for stream consumers), EVENTS-026 structured
  `payload_rejected` issue rows. Release note:
  `abiogenesis/docs/ABIOGENESIS_RC_RELEASE_NOTE.md`.
- odd_glc: mid-repin 4.5.1 → `4.6.0-rc.1` (HEAD `47aeda5` is the repin;
  `.abiogenesis/install-manifest.json` still stamps 4.5.1 — live migration,
  metadata layers inconsistent by design of the moment).
- odd_manager: spec pins observation contract to "ABG 4.2" (GOALS G-001,
  PRODUCT.md, REQ-OM-PROJ-017); legacy Process Navigator realization pins
  abiogenesis `3.5.0-rc.1` + odd_sdlc. This 4.2→4.5/4.6 drift is the gap.
- Per-product version detection (no execution needed):
  `.abiogenesis/install-manifest.json → runtimePackage.packageVersion`
  (redundant stamps in `toolchain-binding.json`, `install-provenance.json`,
  installed `AGENTS.md`/`CLAUDE.md` header).

## 2. Reference Test View (odd_glc data-mapper run)

Scenario `SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT` (env
`ODD_GLC_LIVE_SCENARIO=data-mapper-full`), defined as scenario data in
`odd_glc/build_tenants/odd_glc/typescript/test/glc-software-build-overlay-live.test.mjs`
over `graph-function://odd_glc/software-build/full-lifecycle`. Rebuilds the
odd_sdlc t164 witness as a Scala/SBT CDME build: 8 modules, 8 typed
requirements (`REQ-CDME-CORE`…`REQ-CDME-ENGINE`), positive+negative evidence
shapes, 5 depth classes.

Sole persisted run root (new runs appear as timestamped siblings):

```
odd_glc/build_tenants/odd_glc/typescript/test_runs/
  glc_software_build_overlay_live/data-mapper-full/20260709T180312781Z_pid37013/
```

Ran on ABG 4.6.0-rc.1, 2026-07-09, ~56 min, 28 vectors. Observer-readable
artifacts, summary-first:

1. `odd-glc-software-build-overlay-live-proof.json` (~2 MB) — scenario id,
   substrate pin, `eventLogSha256`, event counts, requirement-lineage canary
   (8 requirement rows: spans, reached vectors, prompt-pressure counts,
   coverage statuses, fold states all `satisfied`, zero dropped / zero
   pressure-missing), `dataMapperGate`, event sequence.
2. `sandbox-identity.json` — run identity, substrate pin, roots,
   pty-terminal executor profile, `terminalProofRequired`.
3. `instance/test-execution-result.json` — sbt, 20/20 green, 8 suites.
4. `instance/depth-proof-map.json`, `instance/mutation-outcomes.json` —
   earned-depth + mutation-kill (odd_glc T-032 surface).
5. `instance/.ai-workspace/events/events.jsonl` (~124 MB) — authoritative ABG
   replay ledger, digest-pinned by the proof. Ingestion must stay
   projection/summary-first; never whole-ledger loads.
6. `instance/.ai-workspace/glc-software-build-live/data-mapper-full/` —
   480 per-vector artifacts (artifact.json / prompt / transport / review /
   trace, with attempt and evaluator variants).

Closure law for this campaign (odd_glc T-031/T-032, standing): closes only by
requirements delivered as code proven by exhaustive strongly-typed UAT;
root-cause every failure in the builder (ABI/GTL/binding), never compensate in
the scenario; F_D asserts mechanical truth only, semantic adequacy is F_P over
declared calibration.

## 3. odd_manager Ingestion Lanes (current)

- Legacy lane: `build_tenants/react_vite/src/server/sidecar-process-projection.mjs`
  (+ `src/contracts/process.ts`). odd_sdlc-privileged: fail-closed
  `@odd-sdlc/typescript-tenant` install validation, `odd-sdlc-ts` CLI
  shell-outs, fixed ledger/catalog filenames, two hardcoded event-kind enums
  (`ABG_SYSTEM_EVENT_KINDS`, `SUPPORTED_TS_EVENT_KINDS`) that silently drop
  unknown kinds. odd_glc can never pass this lane; generic fallback only reads
  `.ai-workspace/events/events.jsonl` + odd_sdlc `operator-runs` shapes, so a
  test-run-rooted odd_glc layout is invisible to it.
- Generic lane (odd_manager T-031): `ai-workspace-observation-service.mjs` +
  `src/contracts/ai-workspace-observation.ts` +
  `/api/ai-workspace/observation`. Version-agnostic content sniffing over
  `.ai-workspace`, `test_runs`, proof inputs. odd_glc is registered in
  `.ai-workspace/runtime/odd_manager/projects.local.json` and is the active
  project. T-031 slices S-001–S-005 complete; S-006 in progress (generic
  viewers live; proof-to-event traversal linkage missing); S-007–S-010
  pending (generic ABG system viewer, overlay layering, Process Navigator
  migration, cleanup). Design companion:
  `build_tenants/common/design/AI_WORKSPACE_OBSERVABILITY_MIGRATION.md`.

Naming collision: inside odd_manager, `data_mapper` historically means the
odd_sdlc fixture line (`ai_sdlc_examples/.../data_mapper.test35/56.ts`,
`SidecarLiveAnalysisProfile 'data_mapper'`). The reference view here is the
odd_glc `SCN-GLC-DATA-MAPPER-FULL-SCALA-SBT` family — a different artifact
family. Keep them distinct in all new work. odd_manager T-031's stated proof
target is odd_glc Hello World; the data-mapper run is newer, richer, and on
newer substrate than the ticket anticipated.

## 4. Triage Framing (proposed, not yet ratified)

Upward-propagation walk lands first at specification: GOALS G-001 and
REQ-OM-PROJ-017 name "ABG 4.2," which no longer names the substrate the
reference run emits. Derived change class: `requirement_reprice`
(observation-contract truth changes), realized through T-031's remaining
slices:

1. Reprice GOALS/requirements from "ABG 4.2" to the ABG3-generation contract
   at the 4.5.1/4.6 release line, with per-product version detection.
2. Extend T-031's proof target (or open a successor ticket) from odd_glc
   Hello World to the data-mapper-full run root as the reference test view.
3. Realize S-007–S-010 against that reference; under 4.6 fail-closed scope
   typing, silent-drop event-kind enums are a defect, not a fallback.

Affected span: `process.ts`, `ai-workspace-observation.ts`, the observation
service, `sidecar-process-projection.mjs`, and the spec surfaces naming 4.2.

## 5. Cold-Start Reload Order

1. This post.
2. STDO compression:
   `specification_methodology/specification/standards/authority_compressions/stdo_compressed.md`
   (verify source digests).
3. odd_manager `CLAUDE.md`, `specification/GOALS.md`, active ticket T-031.
4. The reference run root (§2) — confirm it still exists or find the newest
   sibling.
5. abiogenesis `docs/ABIOGENESIS_RC_RELEASE_NOTE.md` for the current RC state.
