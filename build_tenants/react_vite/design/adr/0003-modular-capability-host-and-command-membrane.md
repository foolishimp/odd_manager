# ADR 0003 - Modular Capability Host And Command Membrane

**Status**: Accepted
**Date**: 2026-07-11
**Tenant**: `react_vite`
**Ticket**: T-032, sprint W15
**Governance**: STDO-UX (`SPEC_METHOD`, `DESIGN_MODULE_METHOD`, `ODD_METHOD`, `UX_METHOD`)
**Supersedes**: ADR 0001's unrealized Redux Toolkit state-container and RTK Query command-interpreter choices
**Retains From ADR 0001**: React functional views, typed contracts, runtime validation, one effect membrane, and replay proof
**Derives From**: `build_tenants/common/design/DEVELOPER_CONTROL_CAPABILITY_ARCHITECTURE.md`

## Context

ADR 0001 selected Redux Toolkit, RTK Query, Zod, and a command middleware as
the intended STDO-UX realization. The React tenant never installed Redux
Toolkit, RTK Query, or Zod. The live Sidecar instead established a plain
TypeScript reducer that emits typed pending commands, with React effects acting
as command and subscription adapters.

T-032 now requires independently evolvable capabilities and a clean integrated
host. Introducing Redux while decomposing more than 8,000 lines of existing
Sidecar state/view code would combine a state-library migration with the
capability-boundary migration. The library change does not itself improve the
constitutional process model.

The stack decision is therefore repriced to match the proven local functional
core while strengthening the parts that are currently weak: module ownership,
one command runtime, schema-derived ingress validation, and integration replay.

## Decision

The React tenant will use:

| Concern | Decision |
| --- | --- |
| Capability State | Plain immutable TypeScript records, one owned State type per capability |
| Capability Msg | Discriminated TypeScript unions owned by the capability |
| Update | Pure `(State, Msg) -> { state, commands }` function per capability |
| Host composition | One host reducer routing envelopes to registered capability reducers |
| View | React functional components receiving state and dispatch through capability bindings |
| Cmd | Discriminated command unions wrapped in a shared command envelope |
| Cmd interpreter | One tenant-local command runtime outside React views and reducers |
| Sub | Declarative subscription values registered through the same runtime boundary |
| Runtime schema | Zod schemas in one internal contracts package, with TypeScript types inferred from schemas |
| FE/BE sharing | Internal built ESM contracts package consumed by browser and Node server adapters |
| Navigation | Host-owned typed navigation messages and URL projection |
| Proof | Module Msg replay, host integration replay, contract validation, dependency checks, and Playwright |

Redux Toolkit and RTK Query are not introduced in this wave. A later re-entry
may adopt them only if measured state or effect complexity exceeds the local
composition kernel and the migration preserves every capability contract.

## STDO-UX Mapping

| Elm concept | Tenant mechanism |
| --- | --- |
| `State` | capability-owned immutable TypeScript record plus host aggregate |
| `Msg` | capability Msg union inside a host-routed envelope |
| `Update` | capability pure reducer returning next state and Cmd values |
| `View` | React function of admitted capability state and typed dispatch |
| `Cmd` | schema-validated command envelope interpreted by command runtime |
| `Sub` | declarative subscription registered by command runtime |
| Effect membrane | command/subscription runtime plus minimal React mount adapter |
| Runtime validation | shared Zod schema at HTTP, event, storage, URL, and process-result seams |
| Replay | pure reducer replay at capability and host levels |

## Host State Shape

```ts
type DeveloperControlState = {
  context: HostContextState;
  navigation: HostNavigationState;
  commands: HostCommandState;
  capabilities: {
    buildPortfolio: BuildPortfolioState;
    projectWorkbench: ProjectWorkbenchState;
    specificationProposal: SpecificationProposalState;
    buildControl: BuildControlState;
    assuranceAttention: AssuranceAttentionState;
    runObservation: RunObservationState;
  };
};
```

The host routes a capability message only to its owner. Cross-capability
changes enter as validated product events or explicit host messages and are
then delivered to each subscribed capability.

## Command Runtime

The command runtime:

1. validates the command envelope;
2. checks Project and revision basis;
3. resolves the named adapter from an allowlisted registry;
4. performs one declared effect;
5. validates the result;
6. emits exactly one success or failure message with command and correlation
   identity;
7. rejects late or mismatched results before capability admission.

The runtime may perform HTTP, filesystem, process, websocket, storage,
clipboard, and terminal integration. It does not decide capability workflow,
build graph traversal, assurance, or next action.

## Shared Contracts Package

Wave 1 creates an internal package under the React tenant:

```text
packages/developer-control-contracts/
  package.json
  tsconfig.json
  src/
  dist/
```

Schemas are authored once in TypeScript with Zod. TypeScript types are inferred
from those schemas. The package builds to ESM and declarations. Browser code
and Node server adapters consume the same built package. Tests fail if the
package is stale or if a boundary payload bypasses schema parsing.

Generated `dist` output is a build artifact. Source schemas remain design and
implementation authority.

## Capability Module Shape

```text
capabilities/<capability>/
  index.ts
  state.ts
  messages.ts
  update.ts
  commands.ts
  subscriptions.ts
  selectors.ts
  contribution.ts
  view/
  tests/
```

Only `index.ts` is public. The host imports the contribution through that
entry. A dependency test rejects imports into another capability's internal
path.

## Sidecar Migration

Sidecar is a source for existing behavior, not the new host boundary.

Wave 1:

- creates the host and capability modules beside Sidecar;
- moves Project Context and initial landing into the host;
- adapts AI Workspace and Run Inspector through Run Observation;
- adapts existing generic shell/file/ticket tools as supporting workbench
  contributions;
- leaves proposal acceptance and Build commands unavailable;
- prevents new developer-control state or commands from entering
  `SidecarPanel.tsx`.

Later MVP tickets move capability behavior behind its owner. There is no
big-bang rewrite of unrelated shell, ticket, comment, file, or document-viewer
behavior.

W17 ownership refinement:

- the Sidecar Project Browser is retired rather than duplicated;
- Build Portfolio owns Project discovery, registration, removal, portfolio
  focus, and explicit activation through its typed command family;
- Sidecar Browse remains constrained to admitted Project Context;
- Recent Paths may request an explicit switch to a registered historical
  Project, but it is not a registry or portfolio surface.

## Consequences

### Positive

- preserves the already-proven pure reducer and typed command pattern;
- avoids a simultaneous Redux migration and capability decomposition;
- gives each major capability an executable ownership boundary;
- gives browser and server one runtime schema source;
- supports parallel capability iteration after Wave 1;
- makes unavailable constructive carriers explicit.

### Negative

- the project owns a small reducer-composition and command-runtime kernel;
- Zod and a contracts build step are new tenant dependencies;
- existing Sidecar effects and local state require incremental migration and
  cannot be declared compliant merely because the new host exists;
- dependency tests must police internal imports because TypeScript alone does
  not enforce package privacy inside one source tree.

## Rejected Alternatives

### Introduce Redux Toolkit during Wave 1

Rejected because the dependency is not installed, the live behavior already
uses a pure reducer/Cmd queue, and state-library migration would obscure the
capability-boundary proof.

### Keep one Sidecar reducer and add capability views

Rejected because visual extraction without state, message, command, and
service ownership does not permit independent iteration.

### Separate micro-frontends or independent stores

Rejected because they duplicate Context, navigation, correlation, and world
truth and make integration a transport problem.

### Let capability effects call server services directly

Rejected because it creates multiple effect membranes and prevents command
replay and correlation.

## Compliance Gates

- [x] React stack retained
- [x] STDO-UX State/Msg/Update/Cmd/Sub mapping declared
- [x] one effect membrane declared
- [x] shared runtime schema source declared
- [x] module ownership and public entry rule declared
- [x] Sidecar migration boundary declared
- [x] structural wave distinguished from functional MVP
- [x] W16 executable module replay
- [x] W16 integration replay
- [x] W16 dependency proof
- [x] W16 existing observation regression proof
