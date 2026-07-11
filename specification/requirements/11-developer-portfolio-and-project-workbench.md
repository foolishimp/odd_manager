# Developer Portfolio And Project Workbench

**Family**: `REQ-OM-DEV-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`, `specification/GOALS.md` G-006

### REQ-OM-DEV-001 - The developer interaction goal organizes the primary experience

`odd_manager` shall organize its primary developer experience around moving one
or more selected Project revisions from governed specification to
evidence-backed, gate-complete build outcomes.

Acceptance Criteria
- artifact browsing, shell access, and run inspection remain supporting tasks
  rather than the primary completion model
- the primary experience exposes the progression from review through tune,
  build, and assurance
- the developer can determine the current phase, outstanding obligation, and
  next lawful interaction without reconstructing them from unrelated screens

### REQ-OM-DEV-002 - The product provides a multi-Project portfolio

The product shall provide one bounded portfolio over registered Projects.

Acceptance Criteria
- the portfolio can show more than one Project without changing active Project
  merely to learn its status
- each Project row preserves published identity and current admitted revision
- each Project exposes specification readiness, active or recent build posture,
  gate/asset posture, freshness, participants, and attention where available
- missing domain or runtime features remain explicit and do not remove the
  Project from generic portfolio use

### REQ-OM-DEV-003 - Portfolio attention is actionable and source-attributed

The portfolio shall make conditions requiring developer attention visible and
traceable.

Acceptance Criteria
- blocked, failed, stale, waiting-human, proof-mismatch, and missing-carrier
  conditions can be distinguished
- each attention summary identifies its source Project and relevant build,
  proposal, gate, asset, or run context
- selecting attention opens the capability and evidence that justify it
- portfolio ordering or filtering does not invent severity or closure truth

### REQ-OM-DEV-004 - Each Project has one goal-oriented workbench

The product shall provide a Project Workbench that integrates the selected
Project's Review, Tune, Build, and Assure capabilities.

Acceptance Criteria
- the selected Project and admitted revision remain visible throughout the loop
- the workbench shows capability contributions through one shared Context and
  world model
- moving between capabilities preserves relevant Project and build focus
- the workbench does not duplicate capability-owned state or create a second
  orchestration truth
- AI Workspace, files, tickets, shells, and Run Inspector remain reachable as
  supporting drills

### REQ-OM-DEV-005 - Project revision identity is explicit wherever results can diverge

The product shall expose the source and specification revision associated with
proposals, build requests, build executions, gate assessments, and asset
delivery claims.

Acceptance Criteria
- commit, worktree, dirty, or other admitted snapshot posture is visible
- a change in revision cannot silently reuse readiness, build, assurance, or
  delivery claims from a different basis
- stale or mismatched revision state is represented explicitly
- the developer can trace a result back to the revision on which it was based

### REQ-OM-DEV-006 - Observation is progressively disclosed by developer question

The product shall provide portfolio, Project, build-intervention, and forensic
observation levels over one shared truth model.

Acceptance Criteria
- portfolio observation answers which Projects need attention
- Project observation answers whether the selected Project is ready to advance
- build observation answers whether execution is progressing and needs action
- forensic observation explains why a run, gate, asset, or proof diverged
- moving to a deeper level preserves the originating Project and build context

### REQ-OM-DEV-007 - Registered Project deep links open the Project Workbench

A Project-only deep link shall resolve the registered Project and open its
goal-oriented Project Workbench.

Acceptance Criteria
- exact registry admission and URL synchronization continue to follow
  REQ-OM-NAV-012
- the landing surface is non-empty when the Project is admitted
- capability absence is shown inside the workbench rather than replaced by an
  empty canvas or an unrelated default tab
- explicit view parameters may open supporting manager capabilities while
  preserving the same Project Context

### REQ-OM-DEV-008 - Project truth remains isolated across the portfolio

The product shall coordinate multiple Projects without consolidating their
source, specification, runtime, evidence, or closure truth into a rival central
authority.

Acceptance Criteria
- every proposal, command, execution, run, gate, asset, and attention item
  retains Project identity
- switching Project focus cannot admit a late result from the prior Project
- one Project's successful build or proof cannot satisfy another Project's gate
- cross-Project summaries remain projections with drilldown to Project-owned
  sources
