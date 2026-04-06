# LLM GTL App Builder Guide

**Status**: Current builder guide
**Audience**: LLM agentic coders building GTL/ABG domain apps
**Purpose**: Define what a GTL domain app is, what the builder authors, what ABG owns, how apps bootstrap and initialize, what hooks exist, what the runtime produces, and how to run the current kernel

## Position

This is the primary builder guide.

Read this guide when you need to build a GTL/ABG app from first principles.

Use the GTL reference guide and the constitutions for deeper type and runtime
detail.

## Why GTL/ABG Exists

GTL/ABG exists to turn probabilistic LLM work into governed, eventually
deterministic, repeatable outcomes.

The system does not guarantee deterministic token output.

It guarantees explicit governance over:

- what was declared
- what callable carrier was invoked
- what runtime facts were emitted
- what proof was produced
- what closed
- what remained open
- what was corrected, superseded, or repriced

Build with GTL/ABG when process truth, audit, replay, and closure matter.

## What You Can Build

Build these classes of systems with GTL/ABG:

- workflow-native applications
- agentic build systems
- outcome-driven delivery systems
- governed internal tools
- evidence and proving pipelines
- approval and escalation systems
- recursive work systems where one callable may open more work

Examples:

- design-to-code delivery
- outcome-driven development
- compliance and attestation workflows
- operational runbooks with audit
- internal agent platforms with correction and replay

Do not use GTL/ABG for:

- static brochure sites
- simple CRUD products with no meaningful workflow law
- apps where audit, correction, replay, and proof do not matter

## What A GTL Domain App Is

A GTL domain app is a configured domain product over the GTL/ABG substrate.

It has these layers:

```text
App
= Bootstrap Surface
+ Initialization Surface
+ Domain Configuration
+ GTL Program Surface
+ Policy Hook Bindings
+ ABG Runtime
+ Projection / Audit Surface
+ Proof Surface
```

The app is not identical to the runtime.

The app is not identical to the GTL module.

The app is the full configured product boundary.

## App Ontology

The app ontology has these primary objects:

- **Outcome**
  - a declared product or workflow state with explicit meaning and closure
    expectations
- **Transition**
  - one lawful move between outcomes
- **Graph Function**
  - the public named callable carrier for constructive work
- **Work Vector**
  - the product view over one graph function or lawful graph-function
    composition
- **Semantic Job**
  - the durable work contract over published graph functions
- **Policy Surface**
  - declarative config over dispatch, evaluation, escalation, proof, or closure
- **Runtime Fact**
  - event truth emitted by ABG
- **Graph Call**
  - one runtime realization of one published graph function
- **Frame**
  - one runtime invocation boundary for recursive or local execution
- **Continuation**
  - one open runtime obligation derived from emitted facts
- **Proof Lane**
  - the declared proving surface for one capability or closure claim

The core execution rule is:

```text
Job -> GraphFunction -> GraphCall -> materialized graph -> internal GraphVector traversal
```

`GraphFunction` is the public callable carrier.

`GraphVector` remains internal realized structure.

## What The Builder Authors

The builder authors these surfaces:

- outcome and transition declarations
- graph-function catalog
- semantic jobs and roles
- hook refs and replay-safe config
- contexts
- domain configuration
- proof lanes and scenario authority
- correction and repricing surfaces where needed

The builder does not author:

- hidden runtime controller logic
- post-dispatch shadow runtime behavior
- ad hoc policy semantics outside declared hook surfaces
- opaque prompt choreography as constitutional law

## Bootstrap

Bootstrap creates the app boundary in a workspace.

Bootstrap should:

- install or copy the runtime substrate
- create the app-owned configuration skeleton
- register the domain package or module roots
- install the coder-facing bootloader or builder guide
- create the initial proof and audit surfaces
- make the app structurally runnable

Bootstrap answers:

- what roots exist
- what files exist
- what the default app shape is
- what config surfaces are expected

Bootstrap does not create hidden runtime truth.

It creates the declared product boundary.

## Initialization

Initialization creates a live configured app instance from the bootstrapped
boundary.

Initialization should:

- read domain configuration
- resolve GTL module or module set
- resolve the graph-function catalog
- resolve hook refs to executable implementations
- bind contexts
- bind runtime contract and policy defaults
- produce the effective callable and runtime surfaces for this app instance

Initialization answers:

- which graph functions are live
- which policy bundle is active
- which contexts are bound
- which jobs are callable
- which runtime defaults govern execution

Bootstrap creates the app structure.

Initialization activates one configured instance of that app.

## Domain Configuration

Domain configuration is the app-owned declarative config surface.

It should include:

- domain identity
- module import roots
- active GTL module or modules
- graph-function catalog publication points
- default policy bundle refs
- context locators
- proof and closure defaults
- operator and evaluator binding refs
- runtime defaults

Domain configuration is not a second runtime.

It configures the substrate and the domain declarations.

## GTL Program Surface

The GTL program surface is the domain declaration layer.

It includes:

- outcomes and nodes
- transitions and graph vectors
- graph functions
- candidate families
- refinement boundaries
- jobs
- roles
- module publication

This is where the app declares what work exists and what callable carriers are
available.

## Hook Model

The hook model should stay narrow and explicit.

The main hook concerns are:

- `dispatch`
- `evaluation`
- `escalation`
- `proof`
- `closure`

These concerns attach through GTL declaration surfaces:

- `GraphFunction.declarations`
- `GraphVector.declarations`
- `Role.policy_hooks`
- `CandidateFamily.policy_hints`

### `dispatch`

Dispatch governs how constructive work is routed.

Examples:

- default `F_P` dispatch
- deterministic-first dispatch
- worker or backend preference

### `evaluation`

Evaluation governs how convergence is checked.

Examples:

- evaluator ordering
- deterministic precheck policy
- retryable evaluation law

### `escalation`

Escalation governs how unresolved work moves across regimes.

Examples:

- `F_D -> F_P`
- `F_P -> F_H`
- fail-closed vs continue-open law

### `proof`

Proof governs what evidence is required before success can count.

Examples:

- deterministic proof checks
- artifact-attestation hooks
- post-run proof requirements

### `closure`

Closure governs what must hold for the boundary to close.

Examples:

- proof passed
- no open continuation of a required kind
- required approval present

### `role hooks`

Role hooks govern authority, assignment, and approval constraints.

### `candidate-family hints`

Candidate-family hints influence selection policy.

They do not become a second execution runtime.

## What ABG Owns

ABG owns runtime truth and runtime progression.

ABG owns:

- graph-call execution
- frame progression
- continuation truth
- event emission
- proof and closure facts
- replay and projection
- correction and supersession fact emission

ABG does not own domain semantics beyond declared law.

ABG interprets and enforces declared law.

## What The App Produces

A GTL/ABG app produces more than application behavior.

It produces:

- a declared app model
- a graph-function catalog
- semantic jobs and roles
- evented runtime truth
- projected run, graph-call, frame, and continuation state
- proof and closure facts
- correction and supersession paths
- written testcase authority and proof lanes

This is the real output:

- the application behavior
- the governance and observability around that behavior

## Build Lifecycle

The build lifecycle is:

1. bootstrap the app boundary
2. initialize the configured instance
3. declare outcomes and transitions
4. publish graph functions
5. attach hooks and policy config
6. publish semantic jobs
7. run one graph call
8. inspect emitted runtime facts
9. correct, supersede, or reprice
10. prove capability through scenarios

This is the shortest useful builder loop.

## Operator UX

The right UX for GTL/ABG apps is artifact-first.

The primary operator surfaces are:

- **Define**
  - outcomes, transitions, graph functions, jobs
- **Build**
  - graph-function authoring and refinement
- **Run**
  - graph calls and active execution
- **Audit**
  - event stream, projections, proof, closure
- **Correct**
  - continuation resolution, supersession, retry, repricing
- **Prove**
  - scenarios, qualification, installed-dev evidence

The main visible objects should be:

- outcomes
- graph functions
- runs
- graph calls
- continuations
- evidence
- proof status

The UX should expose lawful next moves from runtime facts.

## Running The Current Kernel

The live kernel in this repo is `abiogenesis`.

### Run from source

```bash
cd /Users/jim/src/apps/abiogenesis
PYTHONPATH=build_tenants/abiogenesis/python/code python -m genesis --help
```

Current commands:

- `start`
- `iterate`
- `gaps`
- `emit-event`
- `assess-result`
- `check-tags`
- `check-req-coverage`
- `check-impl-coverage`
- `check-validates-coverage`
- `check-bootloader-consistency`

Common commands:

```bash
PYTHONPATH=build_tenants/abiogenesis/python/code python -m genesis gaps --workspace .
PYTHONPATH=build_tenants/abiogenesis/python/code python -m genesis iterate --workspace .
PYTHONPATH=build_tenants/abiogenesis/python/code python -m genesis start --auto --workspace .
```

### Install the kernel into another workspace

```bash
python /Users/jim/src/apps/abiogenesis/build_tenants/abiogenesis/python/code/gen-install.py --target /path/to/project
```

This installs:

```text
/path/to/project/.genesis/
├── genesis/
├── gtl/
└── genesis.yml
```

Then run:

```bash
cd /path/to/project
PYTHONPATH=.genesis python -m genesis gaps --workspace .
PYTHONPATH=.genesis python -m genesis start --auto --workspace .
```

## What To Inspect After A Run

Inspect these in order:

1. `.ai-workspace/events/events.jsonl`
2. projected run state
3. projected graph-call state
4. open continuations
5. proof and closure facts

Ask these questions:

- what graph function was called
- what runtime facts were emitted
- what failed or remained open
- whether proof passed
- whether closure passed
- whether the run completed, failed, or was superseded

The post-mortem audit is the decisive operational surface.

## First Practical Slice

If you are starting from zero, do this:

1. bootstrap the workspace
2. initialize one configured instance
3. declare one small outcome graph
4. publish one named graph function
5. publish one semantic job over it
6. run one graph call
7. inspect the event log
8. add one proof lane

That is enough to prove whether the app should stay on GTL/ABG.

## Reference Surfaces

Use these when you need more detail:

- [GTL_Technical_Guide.md](./GTL_Technical_Guide.md)
- [GTL_3_CONSTITUTIONAL_DESIGN.md](/Users/jim/src/apps/abiogenesis/specification/GTL_3_CONSTITUTIONAL_DESIGN.md)
- [ABG_3_CONSTITUTIONAL_DESIGN.md](/Users/jim/src/apps/abiogenesis/specification/ABG_3_CONSTITUTIONAL_DESIGN.md)
