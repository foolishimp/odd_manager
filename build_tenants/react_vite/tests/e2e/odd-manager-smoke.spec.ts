import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const OBSERVED_WORKSPACE =
  "/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35";

async function captureReviewShot(
  target: Page | Locator,
  testInfo: TestInfo,
  name: string,
  options?: { fullPage?: boolean },
) {
  const path = testInfo.outputPath(`${name}.png`);
  if ("goto" in target) {
    await target.screenshot({
      path,
      fullPage: options?.fullPage ?? true,
    });
  } else {
    await target.screenshot({ path });
  }
  await testInfo.attach(name, {
    path,
    contentType: "image/png",
  });
}

async function waitForChrome(page: Page) {
  await expect(page.getByRole("heading", { name: "Odd Manager" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open workspace selector" })).toBeVisible();
}

async function openWorkspace(page: Page, workspaceRoot: string) {
  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Manual" }).click();
  await dialog.getByRole("textbox").first().fill(workspaceRoot);
  await dialog.getByRole("button", { name: "Open Workspace" }).click();
  await expect(
    page.locator("nav.manager-nav").getByRole("button", { name: "Requirements View", exact: true }),
  ).toBeVisible();
}

test("captures requirements and evidence surfaces for an observed odd_sdlc workspace", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openWorkspace(page, OBSERVED_WORKSPACE);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Requirements View", exact: true }).click();
  await expect(page.getByText("REQ-LDM-001")).toBeVisible({ timeout: 30_000 });
  await captureReviewShot(page, testInfo, "requirements-inspector");

  await page.locator("nav.manager-nav").getByRole("button", { name: "Policy & Evidence", exact: true }).click();
  const evidenceSelector = page.locator(".surface-browser__selector");
  await expect(evidenceSelector).toContainText("Generated Bootstrap Requirements", { timeout: 30_000 });
  await expect(evidenceSelector).toContainText("Release Surface");

  await captureReviewShot(page, testInfo, "evidence-inspector");
});

test("captures browse-root scan from the project selector", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);

  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("tab", { name: "Browse" }).click();
  const crumbs = dialog.locator(".folder-browser__crumbs");
  await crumbs.getByRole("button", { name: "apps" }).click();

  await expect(
    dialog.getByRole("button", {
      name: /abiogenesis managed/i,
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    dialog.getByRole("button", {
      name: /odd_manager managed/i,
    }),
  ).toBeVisible();

  await captureReviewShot(dialog, testInfo, "project-selector-browse");
});

test("captures collapsed oddboard and oddterm widgets", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);

  await expect(page.getByRole("button", { name: "Expand oddboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand terminal workspace" })).toBeVisible();

  await captureReviewShot(page, testInfo, "collapsed-collaboration-widgets");
});
