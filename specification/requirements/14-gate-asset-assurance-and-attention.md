# Gate Asset Assurance And Attention

**Family**: `REQ-OM-ASR-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`, `specification/GOALS.md` G-006

### REQ-OM-ASR-001 - Required gates and assets come from published meaning

The product shall obtain required gate and asset semantics from admitted
product, domain, requirement, scenario, build-carrier, or proof surfaces.

Acceptance Criteria
- every required gate or asset retains its source reference
- odd_manager does not invent domain-specific closure criteria
- unsupported or ambiguous requirement meaning is explicit
- requirement changes invalidate or reprice affected assessment posture

### REQ-OM-ASR-002 - Assurance compares required and delivered state explicitly

The product shall provide a required-versus-delivered gate and asset assurance
projection for each Build Execution and Project Revision.

Acceptance Criteria
- gate posture distinguishes required, satisfied, failed, missing, stale,
  unsupported, and waiting-human
- asset posture distinguishes expected, delivered, failed, missing, stale, and
  unsupported
- totals are derived from the visible assessed set rather than independent
  counters
- partial delivery remains partial and is not collapsed into a single green
  build badge

### REQ-OM-ASR-003 - Every positive assurance claim has admitted evidence

A satisfied gate or delivered asset shall be traceable to admitted evidence.

Acceptance Criteria
- gate assessment exposes evidence, producer, source artifact, and relevant
  requirement or policy lineage
- asset delivery exposes path or URI, producer, digest where published,
  Project Revision, and freshness
- proof digest mismatch prevents a verified state
- rendered UI state, process exit, or unstructured log text alone cannot close
  an assessment

### REQ-OM-ASR-004 - Revision and freshness mismatches fail honestly

Assurance shall remain bound to the revision and runtime basis from which it was
derived.

Acceptance Criteria
- evidence from a different Project Revision is not silently reused
- source/specification changes expose prior assessments as stale where affected
- late evidence cannot attach to another Build Execution through current UI
  selection
- refresh preserves prior attributable results while deriving current posture

### REQ-OM-ASR-005 - Evaluator regimes remain distinguishable

The product shall distinguish deterministic, probabilistic, and human
assurance posture.

Acceptance Criteria
- F_D results identify deterministic pass, fail, or unavailable state
- F_P work or assessment does not self-certify constitutional truth
- F_H obligations identify the required human decision and authority
- human approval cannot override deterministic failure

### REQ-OM-ASR-006 - Attention items identify one actionable condition

The product shall derive bounded Attention Items from admitted portfolio,
proposal, build, runtime, gate, asset, evidence, and freshness state.

Acceptance Criteria
- each item identifies source, severity, Project, relevant proposal/build/run or
  assessment, reason, and freshness
- deterministic failure, waiting-human, stale heartbeat, proof mismatch,
  specification drift, missing carrier, and residual posture are distinguishable
- duplicate projections of the same condition preserve one correlation identity
- attention ordering remains a projection and does not rewrite source severity

### REQ-OM-ASR-007 - Reactions are explicit, bounded, and lawful

Each actionable Attention Item shall expose only reactions admitted for its
source condition.

Acceptance Criteria
- reactions may include inspect evidence, refine proposal, cancel, submit
  policy-authorized retry, approve or reject, escalate, open durable work, or
  choose a lawful re-entry class
- choosing a reaction creates an attributable command or navigation event
- no attention item silently repairs specification, restarts runtime, or marks
  itself resolved
- command failure leaves the source condition visible

### REQ-OM-ASR-008 - Assurance drills into the existing forensic truth

The developer shall be able to move from an assessment or attention item into
the Project-owned evidence that explains it.

Acceptance Criteria
- gate and asset rows can open source requirements, proof, artifacts, events,
  transcripts, traversal, or Run Inspector sections where present
- drilldown preserves Project, Build Execution, Run, and revision context
- bounded summaries do not prevent access to authoritative source references
- missing forensic carriers remain explicit rather than inferred
