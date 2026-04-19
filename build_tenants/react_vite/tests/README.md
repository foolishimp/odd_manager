# Test Surface

Tenant-local Playwright smoke coverage for `odd_manager` lives here.

Primary commands:

```sh
npm run test:runtime
npm run test:e2e
npm run test:e2e:headed
```

Review artifacts are written to:

- `tests/artifacts/test-results/`
- `tests/artifacts/playwright-report/`

The suite intentionally captures screenshots for human review of:

- the home shell
- the graph workspace
- the project selector browse-plus-scan flow
- the collapsed oddboard and oddterm widgets
