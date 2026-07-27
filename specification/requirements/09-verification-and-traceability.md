# Verification And Traceability

**Family**: `REQ-OM-VER-*`
**Status**: Active
**Category**: Verification
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`
**Product Outcomes**: `PO-OM-AUDIT-001`
**Downstream Disposition**: Repair admitted and accepted under T-032 for the Product-to-proof graph, exact STDO release check, source runtime/build/browser gates, exact 4.6 qualification, and isolated installed-development significant-path bundle, subject to their exact candidate run. Requirement-specific functional scenario gaps remain counted and explicit; they block only the corresponding unproved claims
**Testcase Authority**: `specification/scenarios/`, `build_tenants/react_vite/runtime/tests/test_stdo_traceability.mjs`, `build_tenants/react_vite/qualification/installed-development-proof.mjs`, `build_tenants/react_vite/runtime/tests/`, `build_tenants/react_vite/tests/e2e/`

### REQ-OM-VER-001 - Every live requirement family has downstream closure

Every live requirement family in `odd_manager` shall have downstream closure
through design, implementation, proof, or explicit deferment.

Acceptance Criteria
- each live family maps to one or more owning design decisions
- each live family is either realized downstream or explicitly deferred
- no live family remains as a free-floating statement with no closing surface

### REQ-OM-VER-002 - Capability claims require scenario bundles

Meaningful capability claims for the operator product shall be proved through
scenario bundles or equivalent ordered testcase sets.

Acceptance Criteria
- capability-oriented requirement families name the scenario bundles that prove
  their operational meaning
- scenarios exercise coherent operator sequences rather than disconnected
  assertions only
- the proving surface states expected outcomes at meaningful checkpoints

### REQ-OM-VER-003 - Installed development proof is required for operator-facing capability claims

Where the product has an installable or runnable development form, decisive
proof shall run against an installed development version rather than only
against source in place.

Acceptance Criteria
- decisive proof can execute through the same declared entry and runtime
  surfaces the product expects in practice
- direct source-level checks may supplement but not replace installed-dev proof
- proof lanes can record the installed-dev surface used for validation

### REQ-OM-VER-004 - Significant paths are declared and exercised

The proving surface shall declare and exercise the significant paths for each
meaningful behavior being claimed.

Acceptance Criteria
- significant paths include success, fail-closed, boundary, integration, and
  recovery paths where relevant
- proof material makes clear which significant paths were exercised
- capability claims are not treated as proved when the declared important paths
  remain untested

### REQ-OM-VER-005 - Operator-visible claims remain traceable to source truth

Operator-visible claims shall remain traceable back to the declaration,
runtime, policy, evidence, and provenance surfaces that justify them.

Acceptance Criteria
- a displayed claim can be expanded into the objects and evidence that justify
  it
- durable records, promoted excerpts, and replay surfaces preserve enough
  provenance for later review
- no major supervisory claim depends on opaque hidden state

### REQ-OM-VER-006 - Post-mortem audit remains decisive

The decisive post-mortem surface for supervised work shall remain replayable
audit over events, projections, continuations, proof, and closure.

Acceptance Criteria
- the operator can inspect what callable boundary ran, what facts were emitted,
  what remained open, and whether proof and closure passed
- replay and audit remain usable after live activity ends
- post-mortem explanation does not depend on unrecoverable ephemeral context
