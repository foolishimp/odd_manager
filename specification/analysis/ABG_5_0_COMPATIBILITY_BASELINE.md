# ABIogenesis 5.0 Compatibility Working Baseline

**Status**: Implementation and qualification baseline; exact odd_glc-on-5.0
runtime claim remains blocked  
**Observed**: 2026-08-28 (Australia/Sydney)  
**Goal**: G-009  
**Analyzer**: `scripts/analyze_abg_event_stream.mjs`

## Subject Boundary

The Product owner identifies the odd_glc runs as the behavioral target and the
ABIogenesis `5.0.0-dev.286` Product artifact as the contract target for shaping
`odd_manager`. That selection does not overwrite identities published by any
carrier.

Every inspected sandbox and terminal proof currently self-identifies its ABG
substrate as:

- product: `abiogenesis`;
- package: `@abiogenesis/typescript-tenant@4.6.0-rc.3`;
- release: `v4.6.0-rc.3`;
- source commit: `5213301cdbfd35952badf19c27519caa9e7e6968`;
- snapshot commit: `f4f081f66ef8d3ce0c737ddb9d7530176711279a`.

The snapshot commit is the immutable `v4.6.0-rc.3` release commit. Therefore
these bytes are a lawful behavioral target for the ABIogenesis 5.0 development
wave, but they cannot prove an exact `5.0` release compatibility claim. That
claim remains gated on an odd_glc runtime carrier that publishes an exact
ABIogenesis 5.0 identity and on replay of the same installed manager contract
suite against it.

## Exact ABIogenesis 5.0 Contract Artifact

The exact selected ABIogenesis artifact is:

- checkout: `/Users/jim/src/apps/abiogenesis-5-root-build`;
- package: `@abiogenesis/typescript-tenant@5.0.0-dev.286`;
- toolchain schema: `5.0.0`;
- compatibility ref: `compatibility://abiogenesis/major/5`;
- root-event contract digest:
  `sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d`.

Its root event carrier is not the 4.6 flat envelope. It requires canonical
JSON records with `workflowVersion: "5.0.0"`, one-based `admissionOrdinal`,
aggregate and causal identities, a nested `payload`, `payloadDigest`, and a
content-derived `eventId`. The exact package, toolchain manifest, source, build,
and contract identities are pinned in
`build_tenants/react_vite/qualification/abg-5-compatibility-portfolio.json`.
The qualification fixture is emitted by that exact ABIogenesis module rather
than restamped by odd_manager.

## Run Roots

The original completed-run base was:

```text
/Users/jim/src/apps/odd_glc-v21-typed-payload-digest-4cc265f/
  build_tenants/odd_glc/typescript/test_runs/
  glc_software_build_overlay_live/
```

The originally supplied `odd_glc` v21 source checkout is detached at
`f028c71af30c7d594d2caff3307e5e3e6cfb3dbe`. Each run owns an exact
`sandbox-identity.json`, append-only
`instance/.ai-workspace/events/events.jsonl`, and, only after successful
terminal qualification, `odd-glc-software-build-overlay-live-proof.json`.

The latest admitted successor portfolio is the clean detached checkout
`/Users/jim/src/apps/odd_glc-v22-v2-direct-on-disk-f028c71` at
`2a1f68a1e7b295f6de5215128bcdc6c44512a706`. Its six completed Hello World
roots and latest stopped Data Mapper root are pinned in the qualification
portfolio. Those newer run carriers still self-identify their ABIogenesis
substrate as `4.6.0-rc.3`; the v22 checkout's migration intent does not restamp
the runtime bytes.

## Completed Hello World Census

All six rows are structurally valid, ordinal-contiguous from zero, free of
duplicate event identities and time regressions, and end in one
`terminal_reached(converged)` event. Each proof reproduces both the complete
event count and the event-stream SHA-256.

| Scenario | Run root suffix | Events / kinds | Event SHA-256 | Proof SHA-256 | Event-schema fingerprint |
| --- | --- | ---: | --- | --- | --- |
| `SCN-GLC-HELLO-WORLD-CLI-BASIC` | `basic-cli/20260827T213931731Z_pid12453` | 690 / 38 | `0b7cbd886bc712d6a1b98e59144ca15732a87acad2473176169feab63c95a08e` | `c8aeba48f4abf0b99db29edc585c1ecb998ce5708ba9973ea63fafa9d05ab170` | `01b9f04d1ecd6bd534ba5340de47947f8613ceb6bc6059b54615be110b3d152d` |
| `SCN-GLC-HELLO-WORLD-JS-TENANT-TEST` | `js-tenant-test/20260827T214723759Z_pid34740` | 690 / 38 | `ff989da7db6a24b147fd0a6c2db121a5a4b9356bb12a0bb6a7223b188907bd40` | `151e4b0d95cc49a69e51630bbb97505df15290d457fed2a80dac89898979f7e4` | `01b9f04d1ecd6bd534ba5340de47947f8613ceb6bc6059b54615be110b3d152d` |
| `SCN-GLC-HELLO-WORLD-JS-SDLC-BOOTSTRAP` | `js-sdlc-bootstrap/20260827T215457286Z_pid57749` | 730 / 38 | `33170618b57f1dd47d3fa4ac816fc8263ca162f635b61ff42bafd45c4ecbd09b` | `206da4b28b9dbff3e95202cfb490373c217cce27afb45bfe3ad1b9ad34f66d12` | `01b9f04d1ecd6bd534ba5340de47947f8613ceb6bc6059b54615be110b3d152d` |
| `SCN-GLC-HELLO-WORLD-RUST-CLI` | `rust-cli/20260827T220108448Z_pid77689` | 666 / 38 | `a8debc333894e9676bbc259f71aeb96da0f8f35338309ee807aefafc7aa10057` | `0b6df39556df2ba579273e2b9825b24ab34b6155fe85e65ba84d5cae1ae3c93e` | `01b9f04d1ecd6bd534ba5340de47947f8613ceb6bc6059b54615be110b3d152d` |
| `SCN-GLC-HELLO-WORLD-RUST-SERVICE` | `rust-service/20260827T220845364Z_pid1124` | 666 / 38 | `f9c47a798d594242a6e09f58e682e02d4d33cf92abc8047c07ef4e255511dc20` | `e50c5b3d49045ac5227cc74613944a08721587f01ff7e8acbc29376075f6e3dc` | `01b9f04d1ecd6bd534ba5340de47947f8613ceb6bc6059b54615be110b3d152d` |
| `SCN-GLC-HELLO-WORLD-PARALLEL-JS` | `parallel-js/20260827T221643026Z_pid25197` | 690 / 38 | `a89b79e25ac14f71702f8c8b6484a6684324148108ffde5b3e5143a77ab9aaaf` | `d19f7bae635fc97cf7d15f507350620f1a4d32e9d8410b53b157f33cc74a2400` | `01b9f04d1ecd6bd534ba5340de47947f8613ceb6bc6059b54615be110b3d152d` |

All six current carriers publish the 38-kind schema, including retry,
continuation, and rejection families. Maximum observed JSONL line sizes range
from 331,052 to 384,665 bytes, so a line reader must not assume conventional
log-line sizes.

## Non-Terminal Data Mapper Subjects

The prior stopped diagnostic subject is:

```text
/Users/jim/src/apps/odd_glc-response-contract-contentlines-cdf448/
  build_tenants/odd_glc/typescript/test_runs/
  glc_software_build_overlay_live/data-mapper-full/
  20260827T134052134Z_pid21689
```

Its stable observation has 3,020 events, 35 event kinds, a maximum line of
4,117,268 bytes, event SHA-256
`ff22a7c9da83085b9676b6e2ed97eb8331e57ccf940286e6bef73b3074d6996c`,
and schema fingerprint
`d5131003819810212f2f0b976a5837947b27ef62c255553af774b7193022250d`.
It is structurally valid but non-terminal. Its last admitted event is
`c_call_fibre_selected` at ordinal 3019. It has no terminal proof; stopped
process posture is external observation and must not be manufactured from
event absence.

The later v21 Data Mapper subject is:

```text
/Users/jim/src/apps/odd_glc-v21-typed-payload-digest-4cc265f/
  build_tenants/odd_glc/typescript/test_runs/
  glc_software_build_overlay_live/data-mapper-full/
  20260827T175209212Z_pid36532
```

It subsequently stopped at 2,250 structurally valid events, 79,789,753 bytes,
and no terminal proof. Its stable
`sandbox-identity.json` SHA-256 was
`6642538ac9124c56aa6180f7b922b23438f90adf01dea88d0171c45b76e8fe5d`.
It publishes the same substrate pins and uses the repaired `odd_glc` packed
artifact digest
`feb91e870fda9ebba3dd1a424f6a822edc213e2ce6d6d4daa4cc0f3dc2a1b081`.

The latest v22 stopped Data Mapper subject is
`data-mapper-full/20260827T222432708Z_pid45404`. It admits 2,061 events,
69,046,898 bytes, a 3,139,398-byte maximum line, and exact prefix digest
`sha256:11a6a84e2d7e82fc5ab38f9bd7715fab614748f78951c986e83c0cf4b191b57b`.
It remains non-terminal and has no proof.

## Current odd_manager Implementation Probe

`AbgRunObservation` v3 and Traversal now consume one shared identity/event
basis rather than `proof.eventSequence`. Current qualification establishes:

- all latest six return `state: ready`, reconcile exact proof count/digest, and
  retain their published `4.6.0-rc.3` compatibility profile;
- catalog projection admits 47 entries with zero unparsed admissions;
- every lane projects eight semantic vectors, keeps retry attempts distinct,
  and reports no false open closure;
- all event kinds remain visible through the open-set unknown-kind surface.
- both stopped Data Mapper roots return `ready`, `non_terminal`, proof
  `absent`, and process posture `unavailable`;
- the 126,104,826-byte / 4,117,268-byte-line significant path returns a bounded
  browser projection under 512 KiB;
- an exact seven-event 5.0 carrier emitted by
  `@abiogenesis/typescript-tenant@5.0.0-dev.286` passes canonical envelope,
  payload digest, event identity, causation, pagination, detail, proof
  reconciliation, traversal, and negative-integrity checks.
- the source-blind installed candidate pages and opens exact 5.0 event detail,
  and observes the latest stopped Data Mapper as non-terminal with absent proof
  and unavailable process liveness.

This proves exact 5.0 root-envelope readiness and exact 4.6 carrier support. It
does not prove odd_glc-on-ABIogenesis-5.0 runtime compatibility because no
such self-identified odd_glc run carrier is currently available.

## Contract Delta

The development target is not a version-string substitution. It requires:

1. identity-first discovery from `sandbox-identity.json` before a terminal
   proof exists;
2. bounded incremental JSONL ingestion with ordinal, identity, timestamp, and
   schema checks;
3. `non_terminal` event posture kept distinct from external process liveness;
4. distinct `graph_call`, invocation frame, semantic vector, retry attempt,
   continuation, actor invocation, and `c_call` identities;
5. typed response-contract, prompt/manifest/artifact digest, payload
   validation/rejection, authority, ambiguity, closure-input, temporal-verdict,
   and requirement-route projections;
6. late proof reconciliation against the exact event count and digest;
7. bounded operation over at least the observed 126,104,826-byte carrier and
   4,117,268-byte single event without loading the whole stream in the browser;
8. honest unknown-event and unsupported-version diagnostics;
9. exact ABIogenesis 5.0 self-identity before any 5.0 compatibility claim.

## Non-Claims

- These runs do not authorize `odd_manager` to select traversal, retries,
  continuation, evidence, closure, or domain meaning.
- A non-terminal stream is not proof that a process is running, stopped,
  failed, or waiting.
- Successful parsing of a `4.6.0-rc.3` carrier is not an ABIogenesis 5.0 release
  qualification.
- The live Data Mapper snapshot is diagnostic input, not a completed lane.
- No exact odd_glc-on-ABIogenesis-5.0 runtime claim is made from the synthetic
  contract fixture or from the 4.6 run portfolio.

## Reproduction

```sh
node scripts/analyze_abg_event_stream.mjs --pretty <run-root>
cd build_tenants/react_vite && npm run test:qualification:abg5
```

The analyzer streams the JSONL carrier, detects mutation during the read,
checks ordinal continuity and core event identity, fingerprints the event
schema, and reconciles a proof when present. It does not import or execute the
observed runtime.
