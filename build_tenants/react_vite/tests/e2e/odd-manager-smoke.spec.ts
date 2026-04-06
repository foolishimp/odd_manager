import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

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

async function waitForWorldProjection(page: Page) {
  await expect(page.getByRole("heading", { name: "Odd Manager" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh World" })).toBeVisible();
}

test("captures home and graphs surfaces", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForWorldProjection(page);
  await expect(page.locator(".network-map-shell")).toBeVisible();

  await captureReviewShot(page, testInfo, "graphs-workspace");

  await page.getByRole("button", { name: "Home" }).click();
  await expect(page.getByText("Immediate Posture")).toBeVisible();

  await captureReviewShot(page, testInfo, "home-overview");
});

test("captures browse-root scan from the project selector", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForWorldProjection(page);

  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("tab", { name: "Browse" }).click();
  const crumbs = dialog.locator(".folder-browser__crumbs");
  await crumbs.getByRole("button", { name: "apps" }).click();

  await dialog.getByRole("button", { name: "Scan This Folder For ODD Workspaces" }).click();
  await expect(
    dialog.getByRole("button", {
      name: /Odd Method[\s\S]*\/Users\/jim\/src\/apps\/odd_method$/,
    }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    dialog.getByRole("button", {
      name: /Odd Manager[\s\S]*\/Users\/jim\/src\/apps\/odd_manager$/,
    }),
  ).toBeVisible();

  await captureReviewShot(dialog, testInfo, "project-selector-scan");
});

test("captures collapsed oddboard and oddterm widgets", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForWorldProjection(page);

  await page.getByRole("button", { name: "Collapse oddboard" }).click();
  await page.getByRole("button", { name: "Collapse terminal workspace" }).click();

  await expect(page.getByRole("button", { name: "Expand oddboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand terminal workspace" })).toBeVisible();

  await captureReviewShot(page, testInfo, "collapsed-collaboration-widgets");
});
