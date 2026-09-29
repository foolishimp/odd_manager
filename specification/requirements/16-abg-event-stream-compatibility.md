# ABG Event-Stream Compatibility

**Family**: `REQ-OM-ABG-*`  
**Status**: Active implementation target; exact runtime-compatibility closure
remains gated  
**Category**: Capability  
**Derives From**: `specification/PRODUCT.md`, G-009, and `specification/analysis/ABG_5_0_COMPATIBILITY_BASELINE.md`  
**Product Outcomes**: `PO-OM-OBSERVE-001`, `PO-OM-AUDIT-001`  
**Downstream Disposition**: Repair admitted under T-042 for the bounded
identity-first event-index and observation-v3 migration, subject to exact
validation; T-043 and T-044 retain unclosed richer identity and presentation
work, and T-045 retains the installed exact runtime-carrier gate  
**Closure Gate**: An odd_glc-on-ABIogenesis-5.0 compatibility claim requires a
self-identified 5.0 odd_glc runtime carrier through the installed causal path  
**Testcase Authority**: `scripts/tests/test_analyze_abg_event_stream.mjs`,
`build_tenants/react_vite/runtime/tests/test_abg_event_carrier.mjs`,
`build_tenants/react_vite/runtime/tests/test_abg_5_0_event_compatibility.mjs`,
`build_tenants/react_vite/runtime/tests/test_abg_event_compatibility_portfolio.mjs`,
`build_tenants/react_vite/tests/e2e/odd-manager-abg5-compatibility.spec.ts`,
`build_tenants/react_vite/qualification/abg5-run-fixture.mjs`,
`build_tenants/react_vite/qualification/installed-development-proof.mjs`,
`build_tenants/react_vite/qualification/abg-5-compatibility-portfolio.json`,
`specification/analysis/ABG_5_0_COMPATIBILITY_BASELINE.md`,
`.ai-workspace/tickets/active/T-042-admit-proof-independent-abg-event-stream-observation.md`,
`.ai-workspace/tickets/backlog/T-043-conserve-abg-attempt-retry-and-continuation-identity.md`,
`.ai-workspace/tickets/backlog/T-044-project-abg-actor-c-call-payload-and-assurance-families.md`,
`.ai-workspace/tickets/backlog/T-045-qualify-exact-abg-event-stream-compatibility-portfolio.md`  
**Compatibility Gate**: No ABIogenesis 5.0 compatibility claim exists until an exact 5.0 carrier passes the declared installed-path qualification bundle

### REQ-OM-ABG-001 - Run discovery is identity-first and proof-independent

`odd_manager` shall admit a run from a bounded published run-identity carrier
and its durable ABG event stream before a terminal proof exists.

Acceptance Criteria
- `sandbox-identity.json` may establish the run root, workspace root, scenario,
  substrate, graph, graph-function, overlay, and startup references
- published invocation resource receipts may establish exact Run ref/digest
  and event-prefix identity without a sandbox or scenario proof; multiple Runs
  in one ledger remain separately selectable
- a retained-observation resolution may bind an original durable-prefix
  coordinate to archived bytes by exact length and digest; the original URI,
  device, inode and coordinate digest remain unchanged, and the resolution
  grants no runtime reopening authority
- native event carriers remain within their published workspace boundary;
  retained read-only resolutions remain within the admitted Project/archive
  boundary and conserve the original runtime coordinate
- a missing terminal proof does not make an otherwise valid non-terminal run
  undiscoverable
- a directory name, PID suffix, repository basename, or inferred product label
  cannot establish identity
- malformed, escaping, contradictory, or duplicate identity carriers fail
  closed with source-linked diagnostics

### REQ-OM-ABG-002 - Event ingestion is incremental, bounded, and fail-closed

The server shall validate ABG JSONL events incrementally without loading the
whole carrier into the browser or requiring a completed proof projection.

Acceptance Criteria
- each non-empty line is parsed and validated independently
- ingress selects exactly one published envelope profile for a carrier and
  rejects a mixed profile
- the retained 4.6 flat profile requires `kind`, `eventId`, `eventTime`,
  `eventTimeUnixMs`, and zero-based `eventAdmissionOrdinal`
- the 5.0 root profile requires canonical JSON, `workflowVersion: "5.0.0"`,
  `kind`, `eventId`, `eventTime`, aggregate/scope/basis/causal identities,
  nested `payload`, `payloadDigest`, and one-based `admissionOrdinal`
- the selected stamped 5.0 profile is
  `sha256:ddc961a2484be150193fa255d7dc7b933e52fb81b7b2c681f2bb97e1f9d5754c`;
  the manager validates its exact envelope, stamp, kind/payload contracts,
  payload digests, content-derived event ids and admitted causal refs; an
  unknown stamp or mixed stamped/unstamped profile fails closed
- admitted-body-reference storage records are decoded against earlier admitted
  body identities and verified digests before logical event validation;
  unresolved references and conflicting bodies fail closed
- physical prefix bytes/count/digest remain distinct from logical decoded
  events and selected-Run counts; Run filtering follows complete-prefix
  validation and preserves source ordinals and decoding/provenance dependencies
- ordinals are contiguous for a complete observed prefix and event identities
  are unique within the carrier
- read-time mutation is detected and reported instead of presenting a mixed
  prefix as an immutable snapshot
- generic event families remain open and source-linked; a kind outside the
  selected stamped 5.0 registry is a contract violation with its exact source
  ordinal, and cannot acquire semantic or compatibility posture
- configured limits are explicit and fail closed; the supported significant
  path includes a 126,104,826-byte carrier and a 4,117,268-byte event line
- UI responses remain bounded through cursors, ranges, summaries, or lazy
  detail rather than whole-ledger serialization

### REQ-OM-ABG-003 - Durable event posture and process liveness remain distinct

The manager shall not infer external process liveness from the absence,
presence, recency, or incompleteness of ABG events.

Acceptance Criteria
- Run state for the selected stamped 5.0 profile is scoped to the exact Run
  and is supported by a
  digest-bound published Run replay read at its stated prefix, or remains
  explicitly unavailable; blocked, held, stopped, refused, failed and closed
  dispositions retain their published meaning and coverage
- a valid selected-Run prefix without Run closure remains `non_terminal` event
  posture; a child terminal, child failure or child closure cannot decide the Run
- `non_terminal` is not silently relabeled running, stopped, failed, waiting,
  stale, or disconnected
- a terminal disposition is projected only from the admitted selected-Run
  closure relation and preserves its reason, event identity and basis; the
  retained 4.6 profile uses its separately bound terminal-event semantics
- process running/stopped/disconnected posture, when available, comes from a
  separate admitted process capability or manager-owned BuildExecution
- event freshness is displayed as observation metadata and never as process
  truth

### REQ-OM-ABG-004 - Invocation, vector, retry, and continuation identities are conserved

The projection shall keep aggregate Run, GraphCall, Frame, semantic vector,
vector invocation/attempt, retry, and continuation identities distinct.

Acceptance Criteria
- `graphCallId`, `frameId`, `vectorIndex`, attempt, retry, and continuation
  carriers are joined only by their published relations
- repeated planned/evaluated events for a retry do not create additional
  semantic vectors
- raw planned/evaluated/closed count subtraction is not used to contradict an
  admitted converged terminal
- retry and continuation histories remain visible even when the aggregate
  terminal is converged
- interleaved or nested frames are not reconstructed from array order alone
- unmatched or contradictory relations produce diagnostics rather than
  synthetic closure

### REQ-OM-ABG-005 - Actor and C-call lifecycles are separately projectable

Actor invocation and `c_call` event families shall be projected as distinct,
source-linked lifecycles without redefining their ABG meaning.

Acceptance Criteria
- actor start, result-artifact observation, response-contract admission, and
  actor closure correlate through their published invocation and result refs
- each `c_call` is keyed by `cCallRef` and may expose stage role, task ordinal,
  batch, selected fibre/program/regime, evidence, admitted result, and judgment
- a `c_call` is not treated as a GraphCall, frame, process, or semantic vector
- missing lifecycle members remain explicit partial state
- bounded detail preserves event identities and source ordinals

### REQ-OM-ABG-006 - Response and payload integrity carriers remain first-class

The projection shall preserve the causal and integrity relations published for
instructions, responses, artifacts, and typed payloads.

Acceptance Criteria
- response-contract projection retains manifest, prompt, artifact-content,
  response-admission, result, and output-contract refs or digests
- payload observation, validation, and rejection remain distinct events
- payload joins require exact `payloadRef`, digest, contract/schema, basis,
  graph-call, frame, and vector relations where published
- rejected payloads retain rejection class, reason, issues, and policy refs
- opaque refs are not parsed as substitute domain objects merely because they
  embed serialized text
- displayed integrity state identifies the exact supporting event carrier

### REQ-OM-ABG-007 - Requirement and assurance facts remain bounded open families

Requirement-route, authority, ambiguity, closure-input, evidence, and temporal
verdict events shall be available as bounded generic projections before any
domain overlay supplies richer meaning.

Acceptance Criteria
- requirement-route facts retain `routePayloadKind`, payload digest/ref,
  requirement payload kind, causal refs, and source projection refs
- route payload kinds remain an open set and may be summarized by kind without
  losing access to bounded exact rows
- authority snapshots retain authority/input digests, policy refs, closure
  capability, contradiction, and deferral posture
- temporal verdicts preserve property, formula, evaluation/gate point, status,
  vacuity, witnesses, consequence, and implicated-event refs
- repeated facts are streamed and indexed rather than copied wholesale into
  reducer state
- a domain overlay may label these facts but cannot redefine their ABG event
  identity or runtime disposition

### REQ-OM-ABG-008 - Terminal proof is reconciled as a late immutable carrier

When a proof appears, the manager shall reconcile it with the already admitted
event carrier instead of replacing event truth with an unrelated summary.

Acceptance Criteria
- proof event count equals the admitted complete event count
- proof event-log digest equals a digest of the exact event bytes
- proof substrate and run identity agree with the admitted identity carrier
- proof event sequence, when present, conserves event identities and ordinals
- mismatch becomes an explicit proof-conflict state and cannot produce positive
  assurance or compatibility posture
- absence of proof keeps the run observable but blocks proof-dependent closure

### REQ-OM-ABG-009 - Published substrate identity bounds compatibility

Compatibility posture shall be attached to the exact substrate identity
published by the run, not to an operator label or repository name.

Acceptance Criteria
- projection retains product id, package name/version, release tag, source and
  snapshot commits, tarball digest, and manifest digests where published
- the observed domain-product package identity and digest remain separate from
  the ABG substrate identity
- an operator-selected "ABIogenesis 5.0" development wave does not rewrite a
  carrier that self-identifies as `4.6.0-rc.3`
- unknown, missing, or contradictory substrate identity is visible and blocks
  a positive compatibility claim
- compatibility is exact-subject qualification, not a broad semver inference

### REQ-OM-ABG-010 - Compatibility requires installed causal-path proof

The ABIogenesis compatibility claim shall be proved against the exact installed
odd_manager causal path and an exact external carrier portfolio.

Acceptance Criteria
- qualification includes identity-only non-terminal discovery, incremental
  append, read-time mutation, terminal reconciliation, retry/continuation,
  payload rejection, large line, large carrier, unknown event, malformed event,
  digest mismatch, stale Project/run result, and UI boundedness paths
- the six completed Hello World subjects remain a behavioral baseline rather
  than being reduced to unit fixtures alone
- at least one non-terminal Data Mapper stream proves proof-independent
  observation without claiming process liveness
- an exact ABIogenesis 5.0 self-identified carrier must pass before the Product
  reports ABIogenesis 5.0 compatibility
- unit tests supplement but do not replace installed integration and browser
  proof of the supported operator outcome
