# Handover

This document is append-oriented. Add new dated entries below this note and keep prior entries unless they are factually wrong.

## 2026-04-06

### Project State

- `odd_manager` is a forward-looking ODD-aware manager for all ODD projects.
- `odd_method` is the observed domain line. `odd_manager` must not carry `genesis_` or `gsdlc` vocabulary or debt.
- Canonical published domain model is in [specification/domain/DOMAIN_MODEL.md](/Users/jim/src/apps/odd_manager/specification/domain/DOMAIN_MODEL.md).
- Requirements are published under [specification/requirements](/Users/jim/src/apps/odd_manager/specification/requirements/README.md).
- Shared UI law is in [build_tenants/common/design/ODD_MANAGER_DASHBOARD.md](/Users/jim/src/apps/odd_manager/build_tenants/common/design/ODD_MANAGER_DASHBOARD.md).

### Domain Boundaries

- A workspace can expose multiple graphs.
- Assets in graphs are typed.
- Published callable functions are surfaced in the manager as `WorkOrder` objects.
- ABG owns runtime truth and runtime aggregates.
- `odd_method` supplies read-only domain/query overlays.
- The manager composes ABG runtime facts with ODD query overlays into one supervisory surface.
- Builder detail is allowed to remain placeholder-grade where `odd_method` has not frozen richer graph descriptors yet.

### UI / Tenant State

- Active UI tenant: [build_tenants/react_vite](/Users/jim/src/apps/odd_manager/build_tenants/react_vite)
- Styling intentionally preserves the `genesis_manager` visual language, including the graph workspace look and feel.
- Implemented surfaces:
  - shell and navigation
  - graphs workspace
  - inspector
  - provenance/evidence/document surfaces
  - project selector dialog
  - browse-based ODD workspace scan
  - collapsible `OddBoard`
  - collapsible `OddTerm`
- Project selector behavior:
  - `Browse` is literal filesystem navigation
  - scan is initiated from browse via `Scan This Folder For ODD Workspaces`
  - dedicated `Scan` tab was removed

### ODD Workspace Discovery

- Generic ODD scan is implemented in the API and selector.
- Scanner behavior:
  - start from a root
  - detect workspace roots by `.genesis`
  - classify ODD workspaces by name, tenant names, and product-doc signals
  - keep descending through nested workspace carriers such as `build_tenants`, `test_runs`, `local_projects`, and `workspaces`
- Current useful observation targets include nested `odd_method` sandboxes under:
  - `/Users/jim/src/apps/odd_method/build_tenants/odd_sdlc/python/test_runs/canonical_sandbox_repeatability`

### Run Commands

From [build_tenants/react_vite](/Users/jim/src/apps/odd_manager/build_tenants/react_vite):

```sh
npm run dev:server
npm run dev:client
```

Expected local addresses:

- client: `http://127.0.0.1:5173`
- api: `http://127.0.0.1:4173`

### Playwright

Two separate Playwright surfaces are now set up.

#### 1. Playwright MCP

- Added globally to Codex config in [config.toml](/Users/jim/.codex/config.toml)
- Config entry:
  - `[mcp_servers.playwright]`
  - `command = "npx"`
  - `args = ["@playwright/mcp@latest"]`
- Important: a fresh Codex session is required before the new MCP browser tools become available in-session.

#### 2. Repo-Local Playwright Tests

- Tenant-local Playwright harness is implemented in:
  - [playwright.config.ts](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/playwright.config.ts)
  - [tests/e2e/odd-manager-smoke.spec.ts](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/e2e/odd-manager-smoke.spec.ts)
  - [tests/README.md](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/README.md)
- Scripts in [package.json](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/package.json):
  - `npm run test:e2e`
  - `npm run test:e2e:headed`
  - `npm run test:e2e:report`
- Chromium browser binary for Playwright was installed successfully.

### Latest Test Result

- `npm run test:e2e` passed on `2026-04-06`
- Coverage in the smoke suite currently includes:
  - graphs workspace screenshot
  - home overview screenshot
  - project selector browse-plus-scan screenshot
  - collapsed oddboard/oddterm screenshot

Review artifacts:

- [graphs-workspace.png](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/artifacts/test-results/odd-manager-smoke-captures-home-and-graphs-surfaces/graphs-workspace.png)
- [home-overview.png](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/artifacts/test-results/odd-manager-smoke-captures-home-and-graphs-surfaces/home-overview.png)
- [project-selector-scan.png](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/artifacts/test-results/odd-manager-smoke-captures-a03c7-n-from-the-project-selector/project-selector-scan.png)
- [collapsed-collaboration-widgets.png](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/artifacts/test-results/odd-manager-smoke-captures-a1106-ddboard-and-oddterm-widgets/collapsed-collaboration-widgets.png)
- HTML report: [index.html](/Users/jim/src/apps/odd_manager/build_tenants/react_vite/tests/artifacts/playwright-report/index.html)

### Immediate Next Step After Session Restart

- Use Playwright MCP for an interactive review of the `Graphs` tab.
- Focus areas:
  - graph layout quality
  - spacing and clipping
  - selected-node state
  - compressed vs expanded modes
  - minimap and zoom behavior
  - dark theme rendering
  - rendering against `odd_method` sandbox workspaces

### Notes

- `odd_manager` itself is not currently a git repository root.
- This handover was created because browser-review work will benefit from restart-safe project state outside chat memory.
