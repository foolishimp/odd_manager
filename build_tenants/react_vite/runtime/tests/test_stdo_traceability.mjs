import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  auditStdoTraceability,
  DEFAULT_REPOSITORY_ROOT,
  formatTraceabilityReport,
} from "../stdo-traceability.mjs";

function writeFixtureFile(root, path, contents) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function replaceFixtureText(root, path, before, after) {
  const target = join(root, path);
  const contents = readFileSync(target, "utf8");
  assert.ok(contents.includes(before), `${path} does not contain fixture text: ${before}`);
  writeFileSync(target, contents.replace(before, after));
}

function createTraceabilityFixture(t) {
  const root = mkdtempSync(join(tmpdir(), "odd-manager-stdo-traceability-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  writeFixtureFile(
    root,
    "specification/GOALS.md",
    `# Goals

**Derived From**: Product-owner intake

## Current Goal

Demonstrate one bounded Product outcome.
`,
  );
  writeFixtureFile(
    root,
    "specification/INTENT.md",
    `# Intent

**Derived From**: \`specification/GOALS.md\`

## Purpose

Make the bounded demonstration outcome observable.
`,
  );
  writeFixtureFile(
    root,
    "specification/PRODUCT.md",
    `# Product

**Derived From**: \`specification/GOALS.md\`, \`specification/INTENT.md\`

## Product Outcome Identities

- \`PO-OM-DEMO-001\` — The demonstration outcome is observable.

## Boundary
`,
  );
  writeFixtureFile(
    root,
    "specification/requirements/01-demo.md",
    `# Demonstration requirements

**Family**: \`REQ-OM-DEMO-*\`
**Status**: Active
**Category**: Capability
**Derives From**: \`specification/INTENT.md\`, \`specification/PRODUCT.md\`
**Product Outcomes**: \`PO-OM-DEMO-001\`
**Downstream Disposition**: Realized
**Testcase Authority**: \`build_tenants/react_vite/runtime/tests/test_demo.mjs\`

### REQ-OM-DEMO-001 - Demonstrate the outcome

The manager shall demonstrate the Product outcome.
`,
  );
  writeFixtureFile(
    root,
    "build_tenants/common/design/DEMO.md",
    `# Demonstration design

**Status**: Active
**Implements**: \`PO-OM-DEMO-001\`; \`REQ-OM-DEMO-*\`
**Code Entrypoints**: \`build_tenants/react_vite/src/capabilities/demo/index.ts\`
**Executable Proof**: \`build_tenants/react_vite/runtime/tests/test_demo.mjs\` :: \`demo proof\`
**STDO-UX Bindings**: State = DemoState; Msg = DemoMsg; Update = updateDemo; Cmd = DemoCmd; Sub = DemoSub; Ingress = demoIngress; View = DemoView; Membrane = demoMembrane; Replay = \`build_tenants/react_vite/runtime/tests/test_demo.mjs\` :: \`demo proof\`; Accessibility = \`build_tenants/react_vite/runtime/tests/test_demo.mjs\` :: \`demo proof\`
`,
  );
  writeFixtureFile(
    root,
    "specification/scenarios/01-demo.md",
    `# Demonstration scenario

## SCN-OM-DEMO-001 - Demonstrate the outcome

The operator observes the demonstration.

## Executable Proof Bindings

| Scenario | Requirement | Requirement-specific authority case | Proof posture | Proof selector or gap |
| --- | --- | --- | --- | --- |
| SCN-OM-DEMO-001 | \`REQ-OM-DEMO-001\` | Observe the demonstration outcome through the composed fixture | Scenario proof | \`build_tenants/react_vite/runtime/tests/test_demo.mjs :: demo proof\` |
`,
  );
  writeFixtureFile(
    root,
    "build_tenants/react_vite/src/capabilities/demo/index.ts",
    "export const demo = true;\n",
  );
  writeFixtureFile(
    root,
    "build_tenants/react_vite/runtime/tests/test_demo.mjs",
    `import test from "node:test";

test("demo proof", () => {});
`,
  );

  return root;
}

function errorCodes(report) {
  return new Set(report.errors.map((error) => error.code));
}

function auditFixture(root) {
  return auditStdoTraceability(root);
}

test("live repository has deterministic Goals-to-proof STDO traceability", () => {
  const first = auditStdoTraceability(DEFAULT_REPOSITORY_ROOT);
  assert.equal(first.ok, true, formatTraceabilityReport(first));

  const second = auditStdoTraceability(DEFAULT_REPOSITORY_ROOT);
  assert.deepEqual(second, first);
  assert.deepEqual(first.summary, {
    constitutionalDocuments: 3,
    productOutcomes: 7,
    requirementFamilies: 16,
    requirements: 148,
    activeDesigns: 16,
    scenarios: 18,
    sourceCarriers: 39,
    proofCarriers: 77,
    scenarioProofGaps: 55,
    edges: 859,
  });
});

test("accepts a complete constitutional traceability graph derived only from co-located metadata", (t) => {
  const root = createTraceabilityFixture(t);
  const report = auditFixture(root);
  assert.equal(report.ok, true, formatTraceabilityReport(report));
  assert.deepEqual(
    report.graph.constitutionalDocuments.map((document) => document.path),
    [
      "specification/GOALS.md",
      "specification/INTENT.md",
      "specification/PRODUCT.md",
    ],
  );
});

test("rejects absent Goals or Intent instead of treating Product as the constitutional root", async (t) => {
  await t.test("missing Goals", (missingGoalsTest) => {
    const root = createTraceabilityFixture(missingGoalsTest);
    rmSync(join(root, "specification/GOALS.md"));

    const codes = errorCodes(auditFixture(root));
    assert.ok(codes.has("MISSING_GOALS"));
    assert.ok(codes.has("MISSING_DERIVATION_TARGET"));
    assert.ok(codes.has("MISSING_CONSTITUTIONAL_DERIVATION"));
  });

  await t.test("missing Intent", (missingIntentTest) => {
    const root = createTraceabilityFixture(missingIntentTest);
    rmSync(join(root, "specification/INTENT.md"));

    const codes = errorCodes(auditFixture(root));
    assert.ok(codes.has("MISSING_INTENT"));
    assert.ok(codes.has("MISSING_DERIVATION_TARGET"));
    assert.ok(codes.has("MISSING_CONSTITUTIONAL_DERIVATION"));
  });
});

test("rejects a missing direct constitutional link even when every file is present", async (t) => {
  await t.test("Intent does not derive from Goals", (intentTest) => {
    const root = createTraceabilityFixture(intentTest);
    replaceFixtureText(
      root,
      "specification/INTENT.md",
      "**Derived From**: `specification/GOALS.md`",
      "**Derived From**: Product-owner intake",
    );

    assert.ok(
      errorCodes(auditFixture(root)).has("MISSING_CONSTITUTIONAL_DERIVATION"),
    );
  });

  await t.test("requirement family does not derive from Product", (requirementTest) => {
    const root = createTraceabilityFixture(requirementTest);
    replaceFixtureText(
      root,
      "specification/requirements/01-demo.md",
      "`specification/INTENT.md`, `specification/PRODUCT.md`",
      "`specification/INTENT.md`",
    );

    assert.ok(
      errorCodes(auditFixture(root)).has("MISSING_CONSTITUTIONAL_DERIVATION"),
    );
  });
});

test("rejects reversed and circular constitutional derivation", (t) => {
  const root = createTraceabilityFixture(t);
  replaceFixtureText(
    root,
    "specification/GOALS.md",
    "**Derived From**: Product-owner intake",
    "**Derived From**: `specification/PRODUCT.md`",
  );

  const codes = errorCodes(auditFixture(root));
  assert.ok(codes.has("REVERSED_CONSTITUTIONAL_DERIVATION"));
  assert.ok(codes.has("CIRCULAR_CONSTITUTIONAL_DERIVATION"));
});

test("rejects nonexistent, duplicate, and contradictory derivation declarations", async (t) => {
  await t.test("nonexistent target", (missingTargetTest) => {
    const root = createTraceabilityFixture(missingTargetTest);
    replaceFixtureText(
      root,
      "specification/INTENT.md",
      "`specification/GOALS.md`",
      "`specification/GOALS.md`, `specification/MISSING.md`",
    );

    assert.ok(errorCodes(auditFixture(root)).has("MISSING_DERIVATION_TARGET"));
  });

  await t.test("duplicate link", (duplicateLinkTest) => {
    const root = createTraceabilityFixture(duplicateLinkTest);
    replaceFixtureText(
      root,
      "specification/INTENT.md",
      "`specification/GOALS.md`",
      "`specification/GOALS.md`, `specification/GOALS.md`",
    );

    assert.ok(errorCodes(auditFixture(root)).has("DUPLICATE_DERIVATION_LINK"));
  });

  await t.test("contradictory metadata", (contradictionTest) => {
    const root = createTraceabilityFixture(contradictionTest);
    replaceFixtureText(
      root,
      "specification/INTENT.md",
      "**Derived From**: `specification/GOALS.md`",
      `**Derived From**: \`specification/GOALS.md\`
**Derives From**: \`specification/PRODUCT.md\``,
    );

    assert.ok(
      errorCodes(auditFixture(root)).has("CONTRADICTORY_DERIVATION_METADATA"),
    );
  });
});

test("rejects unknown Product identities and an active family without a design owner", (t) => {
  const root = createTraceabilityFixture(t);
  replaceFixtureText(
    root,
    "specification/requirements/01-demo.md",
    "PO-OM-DEMO-001",
    "PO-OM-UNKNOWN-001",
  );
  replaceFixtureText(
    root,
    "build_tenants/common/design/DEMO.md",
    "**Status**: Active",
    "**Status**: Superseded",
  );

  const codes = errorCodes(auditFixture(root));
  assert.ok(codes.has("UNKNOWN_PRODUCT_OUTCOME"));
  assert.ok(codes.has("ACTIVE_FAMILY_WITHOUT_DESIGN_OWNER"));
});

test("rejects deferment metadata on a realized family", (t) => {
  const root = createTraceabilityFixture(t);
  replaceFixtureText(
    root,
    "specification/requirements/01-demo.md",
    "**Downstream Disposition**: Realized",
    `**Downstream Disposition**: Realized
**Deferment Basis**: No deferment was admitted.`,
  );

  assert.ok(
    errorCodes(auditFixture(root)).has("INVALID_MIXED_DEFERMENT_METADATA"),
  );
});

test("rejects incomplete mixed-family coverage and deferment authority", (t) => {
  const root = createTraceabilityFixture(t);
  replaceFixtureText(
    root,
    "specification/requirements/01-demo.md",
    "**Downstream Disposition**: Realized",
    "**Downstream Disposition**: Mixed: REQ-OM-DEMO-002 is realized",
  );

  const codes = errorCodes(auditFixture(root));
  assert.ok(codes.has("INCOMPLETE_DEFERMENT_METADATA"));
  assert.ok(codes.has("INVALID_MIXED_DISPOSITION_COVERAGE"));
});

test("rejects missing proof paths and exact test titles", async (t) => {
  await t.test("missing path", (pathTest) => {
    const root = createTraceabilityFixture(pathTest);
    replaceFixtureText(
      root,
      "build_tenants/common/design/DEMO.md",
      "runtime/tests/test_demo.mjs` :: `demo proof",
      "runtime/tests/missing_demo.mjs` :: `demo proof",
    );
    assert.ok(errorCodes(auditFixture(root)).has("MISSING_PROOF_PATH"));
  });

  await t.test("missing title", (titleTest) => {
    const root = createTraceabilityFixture(titleTest);
    replaceFixtureText(
      root,
      "specification/scenarios/01-demo.md",
      "test_demo.mjs :: demo proof",
      "test_demo.mjs :: absent proof",
    );
    assert.ok(errorCodes(auditFixture(root)).has("MISSING_TEST_TITLE"));
  });
});

test("rejects incomplete UX bindings and active designs without proof carriers", async (t) => {
  await t.test("missing accessibility binding", (uxTest) => {
    const root = createTraceabilityFixture(uxTest);
    replaceFixtureText(
      root,
      "build_tenants/common/design/DEMO.md",
      "; Accessibility = `build_tenants/react_vite/runtime/tests/test_demo.mjs` :: `demo proof`",
      "",
    );
    assert.ok(errorCodes(auditFixture(root)).has("MISSING_UX_BINDING"));
  });

  await t.test("missing design proof", (proofTest) => {
    const root = createTraceabilityFixture(proofTest);
    replaceFixtureText(
      root,
      "build_tenants/common/design/DEMO.md",
      "**Executable Proof**: `build_tenants/react_vite/runtime/tests/test_demo.mjs` :: `demo proof`",
      "**Executable Proof**:",
    );
    assert.ok(errorCodes(auditFixture(root)).has("MISSING_EXECUTABLE_PROOF"));
  });
});

test("rejects orphan active capability source carriers", (t) => {
  const root = createTraceabilityFixture(t);
  writeFixtureFile(
    root,
    "build_tenants/react_vite/src/capabilities/orphan/index.ts",
    "export const orphan = true;\n",
  );

  assert.ok(errorCodes(auditFixture(root)).has("ORPHAN_CAPABILITY_SOURCE"));
});

test("rejects batched requirement claims and missing requirement-specific rationale", async (t) => {
  await t.test("batched requirements", (batchTest) => {
    const root = createTraceabilityFixture(batchTest);
    replaceFixtureText(
      root,
      "specification/requirements/01-demo.md",
      "The manager shall demonstrate the Product outcome.",
      `The manager shall demonstrate the Product outcome.

### REQ-OM-DEMO-002 - Demonstrate another outcome

The manager shall demonstrate another bounded observable.`,
    );
    replaceFixtureText(
      root,
      "specification/scenarios/01-demo.md",
      "`REQ-OM-DEMO-001` | Observe",
      "`REQ-OM-DEMO-001`, `REQ-OM-DEMO-002` | Observe",
    );
    assert.ok(errorCodes(auditFixture(root)).has("BATCHED_SCENARIO_REQUIREMENTS"));
  });

  await t.test("missing authority case", (rationaleTest) => {
    const root = createTraceabilityFixture(rationaleTest);
    replaceFixtureText(
      root,
      "specification/scenarios/01-demo.md",
      "Observe the demonstration outcome through the composed fixture",
      "none",
    );
    assert.ok(errorCodes(auditFixture(root)).has("MISSING_REQUIREMENT_AUTHORITY_CASE"));
  });
});

test("accepts an honest executable gap but rejects a selector attached to it", async (t) => {
  await t.test("honest gap", (gapTest) => {
    const root = createTraceabilityFixture(gapTest);
    replaceFixtureText(
      root,
      "specification/scenarios/01-demo.md",
      "Scenario proof | `build_tenants/react_vite/runtime/tests/test_demo.mjs :: demo proof`",
      "Executable proof gap | none — no composed-product demonstration proof is installed",
    );
    const report = auditFixture(root);
    assert.equal(report.ok, true, formatTraceabilityReport(report));
    assert.equal(report.summary.scenarioProofGaps, 1);
  });

  await t.test("gap with selector", (gapTest) => {
    const root = createTraceabilityFixture(gapTest);
    replaceFixtureText(
      root,
      "specification/scenarios/01-demo.md",
      "Scenario proof",
      "Executable proof gap",
    );
    assert.ok(errorCodes(auditFixture(root)).has("PROOF_GAP_WITH_SELECTOR"));
  });
});
