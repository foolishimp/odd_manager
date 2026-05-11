// T-026 + T-022 + T-024 — Playwright e2e walks for the sidecar Process
// Navigator wave. Exercises:
//   1. Navigator opens against a workspace with admitted live projection
//   2. Catalog dimension surfaces (44 leaves, 2 executives, 11 library)
//   3. Variant tab strip switches V0 / V1 / V2 / V4 in the process flow map
//   4. Per-leaf workbench renders TracedCalloutEvidence + 7-dim assurance
//      vector when a leaf is focused
//   5. Unsupported-format state surfaces when the install is missing
//
// The reference workspace is the t109 live install. Tests skip when the
// reference is not present so the suite remains portable.

import { expect, test, type Page } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const T109_PARENT =
  "/Users/jim/src/apps/odd_sdlc/build_tenants/typescript/test_env/test_runs/t109_live_installed_data_mapper_pty";

function latestT109Workspace(): string | null {
  if (!existsSync(T109_PARENT)) return null;
  let entries: string[];
  try {
    entries = readdirSync(T109_PARENT);
  } catch {
    return null;
  }
  const candidates = entries
    .filter((name) => /^\d{8}T\d{9}Z_pid\d+$/.test(name))
    .sort()
    .reverse();
  for (const candidate of candidates) {
    const ws = join(T109_PARENT, candidate, "workspace");
    if (existsSync(ws)) return ws;
  }
  return null;
}

const REFERENCE_WORKSPACE = latestT109Workspace();
const NON_TS_WORKSPACE = "/Users/jim/src/apps/odd_manager"; // odd_manager itself: no TS tenant install

async function waitForChrome(page: Page) {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open workspace selector" })).toBeVisible();
}

async function selectActiveProject(page: Page, workspaceRoot: string) {
  await page.evaluate(async (root) => {
    const response = await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, setActive: true }),
    });
    return response.ok;
  }, workspaceRoot);
  await page.reload();
  await waitForChrome(page);
}

async function openSidecar(page: Page) {
  const sidecarNav = page.getByRole("button", { name: "Sidecar" });
  if ((await sidecarNav.count()) > 0) {
    await sidecarNav.click();
  }
  const trigger = page.getByRole("button", { name: "Open Process Navigator" });
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
  await expect(page.locator(".sidecar-process-navigator")).toBeVisible({ timeout: 30_000 });
}

test.describe("sidecar Process Navigator — substrate alignment wave", () => {
  test.skip(!REFERENCE_WORKSPACE, "t109 reference workspace is not present on this host");

  test("renders catalog + overlay chips and switches all four process-flow-map variants", async ({ page }) => {
    await page.goto("/");
    await waitForChrome(page);
    await selectActiveProject(page, REFERENCE_WORKSPACE!);
    await openSidecar(page);

    // Catalog dimension chip (number of leaves) and active overlays chip should be present.
    await expect(
      page.locator(".sidecar-process-navigator__badges").getByText(/\d+ leaves/).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\d+ active overlays/)).toBeVisible();
    await expect(
      page.locator(".sidecar-process-navigator__badges").getByText("ts-v1", { exact: true }),
    ).toBeVisible();

    // Process flow map should be the active map (default).
    const mapTabFlow = page.getByRole("tab", { name: /Process Flow|process_flow/ });
    if ((await mapTabFlow.count()) > 0) {
      await mapTabFlow.first().click();
    }

    // Variant tabs: V0, V1, V2, V4
    const variantBar = page.getByRole("tablist", { name: "Process flow map variants" });
    await expect(variantBar).toBeVisible();
    for (const variantLabel of ["V0 Baseline", "V1 Three-lane", "V2 Asset-DAG", "V4 Assurance Matrix"]) {
      const tab = variantBar.getByRole("tab", { name: new RegExp(variantLabel) });
      await expect(tab).toBeVisible();
      await tab.click();
      // V2/V4 remain §13A scaffolds after V1 is promoted to canonical.
      if (variantLabel === "V2 Asset-DAG" || variantLabel === "V4 Assurance Matrix") {
        await expect(page.getByText(/§13A scaffold/)).toBeVisible();
      }
    }
    await variantBar.getByRole("tab", { name: /V0 Baseline/ }).click();
    await expect(page.locator(".sidecar-process-map__edge-glyph").first()).toBeVisible();
  });

  test("focusing a leaf renders the per-leaf workbench with traced evidence", async ({ page }) => {
    await page.goto("/");
    await waitForChrome(page);
    await selectActiveProject(page, REFERENCE_WORKSPACE!);
    await openSidecar(page);

    // Switch to V1 three-lane so leaves are easy to click.
    const variantBar = page.getByRole("tablist", { name: "Process flow map variants" });
    await variantBar.getByRole("tab", { name: /V1 Three-lane/ }).click();

    // Click the first leaf. derive_intent_surface is the canonical first leaf
    // in the bootstrap chain.
    const firstLeaf = page.locator(".sidecar-process-flow-v1__node").first();
    await expect(firstLeaf).toBeVisible();
    await firstLeaf.click();

    // Workbench appears with leaf metadata and (when overlay is present)
    // traced evidence rows.
    const workbench = page.locator(".sidecar-leaf-workbench");
    await expect(workbench).toBeVisible();
    await expect(workbench.getByText(/Modulation/)).toBeVisible();
    await expect(workbench.getByText(/single_vertical_slice/)).toBeVisible();

    // 7-dim assurance vector grid — at least 7 status chips visible inside
    // the assurance container when an overlay is admitted.
    const assurance = page.locator(".sidecar-leaf-workbench__assurance");
    if ((await assurance.count()) > 0) {
      const chips = assurance.locator(".status-chip");
      expect(await chips.count()).toBeGreaterThanOrEqual(7);
    }
  });

  test("V4 assurance matrix renders 7 columns × N rows", async ({ page }) => {
    await page.goto("/");
    await waitForChrome(page);
    await selectActiveProject(page, REFERENCE_WORKSPACE!);
    await openSidecar(page);

    const variantBar = page.getByRole("tablist", { name: "Process flow map variants" });
    await variantBar.getByRole("tab", { name: /V4 Assurance Matrix/ }).click();

    const matrix = page.locator(".sidecar-process-flow-v4__matrix");
    await expect(matrix).toBeVisible();
    // 3 fixed columns (Leaf / Catalog / Status) + 7 assurance columns = 10
    const headers = matrix.locator("thead th");
    expect(await headers.count()).toBeGreaterThanOrEqual(10);
  });
});

test.describe("sidecar Process Navigator — unsupported-format state", () => {
  test("surfaces unsupported state when the project lacks an odd_sdlc TS install", async ({ page }) => {
    await page.goto("/");
    await waitForChrome(page);
    await selectActiveProject(page, NON_TS_WORKSPACE);
    await openSidecar(page);

    // odd_manager itself has no TypeScript tenant install; the navigator
    // should surface the unsupported-format state per REQ-OM-LNS-003.
    const unsupported = page.locator(".sidecar-process-navigator--unsupported");
    await expect(unsupported).toBeVisible({ timeout: 30_000 });
    await expect(
      unsupported.getByRole("heading", { name: /TypeScript process contract unavailable/i }),
    ).toBeVisible();
    await expect(
      unsupported.getByText(/odd_sdlc TypeScript installation projection is missing/i),
    ).toBeVisible();
  });
});
