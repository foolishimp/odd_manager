# GTL/ABG User Guide

**Status**: Current GTL 3 / ABG 3 user guide
**Audience**: People building or operating GTL/ABG applications
**Purpose**: Explain what GTL/ABG is for, what it builds, how the build loop works, what the runtime gives you, and how to run the current kernel

## Why Build With GTL/ABG

Build with GTL/ABG when you need probabilistic LLM work to produce governed,
eventually deterministic, repeatable outcomes.

The value is deterministic governance over:

- what was declared
- what ran
- what evidence was produced
- what remained open
- what closed
- what must be corrected or superseded

Use GTL/ABG when the process matters, not only the artifact.

## What You Can Build

GTL/ABG is a good fit for:

- workflow-native applications
- governed internal tools
- agentic build systems
- evidence and approval pipelines
- delivery methods with explicit closure rules
- recursive work systems where one callable can lawfully open more work
- products where replay, audit, and correction matter

Examples:

- outcome-driven development systems
- design-to-code delivery loops
- compliance and proving workflows
- operational runbooks with bounded human escalation
- internal agent platforms with audit and correction

GTL/ABG is a poor fit for:

- static brochure sites
- simple CRUD apps with no meaningful workflow law
- products where audit, replay, and closure do not matter

## What You Are Building

You are building:

- a declared outcome or workflow model
- a graph-function catalog
- semantic work contracts over those graph functions
- runtime policy surfaces
- evented runtime truth
- evidence and closure lanes

The load-bearing split is:

- GTL declares the graph, graph functions, jobs, roles, and hook surfaces
- ABG executes graph calls, emits runtime facts, opens continuations, and
  projects what holds

## Installed Surface Ownership

One installed workspace may contain mixed-provenance surfaces.

Treat them by owner:

- project-owned authority
  - imported or authored `specification/*`
  - project `README.md`
- kernel-owned installed surfaces
  - `.genesis/*`
  - installed docs under `.genesis/docs/`
  - the generic GTL bootloader section written into `CLAUDE.md` / `AGENTS.md`
- domain-installer-owned surfaces
  - runtime-contract overlays such as `.odd_sdlc/release/genesis.yml`
  - domain governance preambles written into `CLAUDE.md` / `AGENTS.md`
  - generated workspace read models and normalization artifacts under
    `.ai-workspace/`

Use the highest-authority surface for the question you are answering:

- project identity and business meaning: project-owned authority
- GTL/ABG substrate law: kernel-owned surfaces
- workspace operation under a domain package: domain-installer-owned surfaces

Do not collapse these into one ownership bucket.

## Core Builder Model

The user-facing builder vocabulary is:

- **Outcome**
  - a declared state with explicit meaning and closure expectations
- **Transition**
  - a lawful move between outcomes
- **Graph Function**
  - the named callable carrier for constructive work
- **Work Vector**
  - the product view over one graph function or lawful graph-function
    composition
- **Policy Surface**
  - declarative config over evaluation, escalation, selection, proof, or
    closure
- **Runtime Fact**
  - emitted ABG event truth
- **Continuation**
  - one open runtime obligation derived from event truth
- **Proof Lane**
  - the declared proving path for a capability or closure claim

The important rule is:

`GraphFunction` is the callable carrier.

`GraphVector` remains internal realized structure.

## How You Build

The build loop is:

1. declare outcomes and transitions
2. publish named graph functions
3. attach policy, evidence, and closure surfaces
4. publish semantic jobs over graph functions
5. run one graph call
6. inspect the emitted runtime facts
7. correct, supersede, or reprice
8. prove the capability through scenarios

### 1. Declare outcomes and transitions

Start from the declared states that matter.

Define:

- what counts as an outcome
- what transitions are lawful
- what evidence or closure each outcome needs

### 2. Publish named graph functions

Express constructive work as named graph functions.

Invest in:

- clear callable names
- explicit outer contracts
- lawful composition
- lawful recursion where needed

Do not introduce a second execution primitive.

### 3. Attach policy and proof surfaces

Attach:

- evaluation policy
- escalation policy
- proof expectations
- closure expectations

Do this declaratively.

Do not hide runtime law in local controller code.

### 4. Publish semantic jobs

Publish semantic work contracts over graph functions.

Jobs name the durable work.

They do not become runtime controller objects.

### 5. Run a graph call

ABG opens runtime execution from the public graph-function carrier.

The public runtime path is:

```text
Job -> GraphFunction -> GraphCall -> internal traversal -> proof -> closure
```

### 6. Inspect the runtime facts

After a run, the primary truth is the event stream.

Read what happened from:

- runtime events
- graph calls
- frames
- continuations
- proof and closure facts

Do not treat process return codes or chat summaries as the main truth.

### 7. Correct or supersede

If the run does not close lawfully:

- resolve an open continuation
- retry under policy
- supersede stale work
- reprice the declaration if the model is wrong

### 8. Prove

A capability is not real because the declaration exists.

It is real when:

- the significant paths are named
- the runtime facts are explainable
- the installed or runnable form proves the claim

## What You Get

You get more than application code.

You get:

- a declared graph-native application model
- a graph-function catalog
- semantic jobs and roles
- runtime fact truth
- replayable projections over runs, graph calls, frames, and continuations
- proof and closure facts
- correction and supersession paths
- written testcase authority and proof lanes

The output is both:

- the application behavior
- the governance and observability around that behavior

## What The UX Is

The right GTL/ABG UX is artifact-first.

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

The main objects on screen should be:

- outcomes
- graph functions
- runs
- graph calls
- continuations
- evidence
- proof status

The UX should show the lawful next move from runtime facts and keep the primary
operational surface in declared artifacts, runtime facts, and proof state.

## How To Run The Current Kernel

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

That installs:

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

## When Not To Use GTL/ABG

Do not use GTL/ABG because you want:

- a generic chatbot
- lightweight text generation with no governance
- a trivial app with no meaningful workflow law
- ad hoc automation with no need for audit or correction

Use GTL/ABG when you need:

- declared workflow structure
- graph-function-first execution
- evented runtime truth
- lawful correction
- replay
- proof of closure

## First Practical Path

If you are starting from zero, do this:

1. declare one small outcome graph
2. publish one named graph function
3. publish one semantic job over it
4. run one graph call
5. inspect the event log
6. add one proof lane

That is enough to tell whether the product should stay on GTL/ABG or whether a
simpler architecture would be better.
