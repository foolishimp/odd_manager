# Build Admission And Supervision

**Family**: `REQ-OM-BLD-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`, `specification/GOALS.md` G-006

### REQ-OM-BLD-001 - Every build starts from a typed admitted request

The product shall represent build submission as a typed Build Request over a
published semantic carrier.

Acceptance Criteria
- the request identifies Project, Project Revision, Context, requester,
  published Job, GraphFunction, workorder, or equivalent carrier, and
  correlation identity
- declared inputs, resource posture, policy basis, and target/until semantics
  are preserved where the carrier publishes them
- malformed, incomplete, unauthorized, or unsupported requests fail before
  process start
- a UI action or prompt cannot bypass the same admission path

### REQ-OM-BLD-002 - Missing constructive carriers fail closed

The product shall not invent build behavior when the selected Project publishes
no lawful build carrier.

Acceptance Criteria
- build capability reports unavailable or unsupported with the missing
  contract named
- the view does not synthesize an opaque shell command as fallback
- an operator may still use an ordinary Project shell without that shell being
  represented as an admitted build
- upstream carrier work is routed through a durable ticket or re-entry action

### REQ-OM-BLD-003 - Build execution preserves immutable basis and correlation

Every Build Execution shall remain correlated to its admitted request and
Project Revision.

Acceptance Criteria
- request, execution, process, run, evidence, and result identities can be
  traversed in both directions where published
- a source/specification change during execution is surfaced as divergence
  rather than silently changing the build basis
- late process or run events cannot attach to another request or Project
- retries or restarts receive explicit attempt identity

### REQ-OM-BLD-004 - The manager owns bounded queue and process lifecycle

The product shall expose manager-owned queue and external process lifecycle
without representing that lifecycle as ABG runtime truth.

Acceptance Criteria
- lifecycle distinguishes queued, starting, running, waiting-human, converged,
  failed, cancelled, stale, and disconnected posture
- timestamps, process identity, heartbeat/freshness, requester, and relevant
  resource posture are visible
- browser refresh or reconnect does not silently convert a live execution into
  an unknown new build
- process lifecycle remains distinguishable from ABG Run and convergence state

### REQ-OM-BLD-005 - Multiple Project builds can execute concurrently

The product shall support bounded concurrent Build Executions across registered
Projects.

Acceptance Criteria
- concurrency and queue limits are explicit
- each execution retains independent Project, revision, command, process,
  output, run, and attention identity
- completion, cancellation, failure, or stale state in one execution does not
  mutate another execution
- the portfolio can distinguish queued from actively consuming a concurrency
  slot
- tests prove cross-Project and same-Project concurrent isolation

### REQ-OM-BLD-006 - Manager command authority remains subordinate to GTL and ABG

Build supervision shall preserve the language/runtime ownership boundary.

Acceptance Criteria
- GTL or the admitted domain carrier defines the build program and lawful
  inputs
- ABG owns traversal, retries internal to runtime policy, continuation, event
  truth, evidence admission, folds, residuals, and closure
- odd_manager may submit, queue, start, attach, cancel an external process, and
  submit attributable operator decisions through admitted commands
- odd_manager does not choose the next graph edge or manufacture run closure

### REQ-OM-BLD-007 - Cancellation, retry, and human decisions are explicit commands

The developer shall be able to request bounded intervention without hidden
runtime mutation.

Acceptance Criteria
- cancellation identifies the affected Build Execution and records actor and
  outcome
- retry is available only where admitted policy publishes it and creates an
  explicit attempt or request identity
- human approval or rejection identifies the F_H obligation and authority
  basis
- intervention success and failure return attributable command results

### REQ-OM-BLD-008 - Live supervision is fresh, reconnectable, and honest

The product shall keep build posture current without hiding subscription or
connectivity failure.

Acceptance Criteria
- event, polling, or subscription freshness is visible
- stale and disconnected states are distinct from queued, waiting, failed, or
  converged states
- reconnect resumes the known Build Execution where backend identity remains
  valid
- refresh and late responses preserve Project/request stale guards

### REQ-OM-BLD-009 - Process completion does not establish build assurance

A zero process exit or terminal state shall not by itself establish gate,
asset, proof, or product closure.

Acceptance Criteria
- process outcome and assurance posture are separate fields
- build convergence is derived only from the admitted carrier/runtime meaning
  available for that build
- missing evidence remains missing after successful process exit
- the developer can navigate from process outcome to the evidence required for
  assurance
