import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const OBSERVED_WORKSPACE =
  "/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35";
const MANAGER_WORKSPACE = "/Users/jim/src/apps/odd_manager";

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
  await expect(page.getByRole("banner").getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
}

async function openWorkspace(page: Page, workspaceRoot: string) {
  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Manual" }).click();
  await dialog.getByRole("textbox").first().fill(workspaceRoot);
  await dialog.getByRole("button", { name: "Add Project" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Projects" }).click();
  const projectRow = dialog.locator(".project-selector__workspace").filter({ hasText: workspaceRoot }).first();
  await expect(projectRow).toBeVisible();
  const openButton = projectRow.getByRole("button", { name: "Open" });
  const currentButton = projectRow.getByRole("button", { name: "Current" });
  if ((await openButton.count()) > 0 && await openButton.isEnabled()) {
    await openButton.click();
  } else if ((await currentButton.count()) > 0) {
    await dialog.getByRole("button", { name: "Close" }).click();
  } else {
    await dialog.getByRole("button", { name: "Close" }).click();
  }
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }),
  ).toBeVisible();
}

async function openManagerWorkspace(page: Page) {
  await openWorkspace(page, MANAGER_WORKSPACE);
  await expect(page.getByText("Backlog Driver")).toBeVisible({ timeout: 30_000 });
}

async function openObservedWorkspace(page: Page) {
  await openWorkspace(page, OBSERVED_WORKSPACE);
  await expect(page.getByText("Backlog Navigator")).toBeVisible({ timeout: 30_000 });
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
      name: /odd_manager Odd Manager/i,
    }),
  ).toBeVisible();

  await captureReviewShot(dialog, testInfo, "project-selector-browse");
});

test("project add stays in dialog and preserves the current manager page", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);
  await expect(page.locator(".shell__control-card--status strong")).not.toHaveText("Loading", { timeout: 30_000 });

  const sidecarNav = page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true });
  await expect(sidecarNav).toBeVisible({ timeout: 30_000 });
  await sidecarNav.click();
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible();

  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "Manual" }).click();
  await dialog.getByRole("textbox").first().fill(OBSERVED_WORKSPACE);
  await dialog.getByRole("button", { name: "Add Project" }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Added data_mapper.test35.");
  await expect(sidecarNav).toHaveClass(/is-selected/);
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible();
});

test("floating side windows close on outside click", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);
  await expect(page.locator(".shell__control-card--status strong")).not.toHaveText("Loading", { timeout: 30_000 });

  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();
  await page.locator(".manager-nav").click();
  await expect(dialog).toHaveCount(0);

  const sidecarButton = page.getByRole("button", { name: "Sidecar", exact: true });
  await expect(sidecarButton).toBeVisible({ timeout: 30_000 });
  await sidecarButton.click();
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  await expect(flyout).toBeVisible();
  await page.getByRole("region", { name: "Sidecar canvas" }).click();
  await expect(flyout).toHaveCount(0);
});

test("active project row shows current state without wait cursor", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);
  const activeSet = await page.evaluate(async (root) => {
    const response = await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, setActive: true }),
    });
    return response.ok;
  }, OBSERVED_WORKSPACE);
  expect(activeSet).toBe(true);

  await page.getByRole("button", { name: "Open workspace selector" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace selector" });
  await expect(dialog).toBeVisible();
  const projectRow = dialog.locator(".project-selector__workspace").filter({ hasText: OBSERVED_WORKSPACE }).first();
  await expect(projectRow).toBeVisible();
  const currentButton = projectRow.getByRole("button", { name: "Current" });
  const removeButton = projectRow.getByRole("button", { name: "Remove" });
  await expect(currentButton).toBeDisabled();
  await expect(removeButton).toBeDisabled();
  await expect(currentButton).toHaveAttribute("title", "This Project is already active.");
  await expect(removeButton).toHaveAttribute("title", "Open another Project before removing this one.");
  await expect
    .poll(() => currentButton.evaluate((node) => window.getComputedStyle(node).cursor))
    .toBe("not-allowed");
});

test("captures collapsed oddboard and oddterm widgets", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);

  await expect(page.getByRole("button", { name: "Expand oddboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand terminal workspace" })).toBeVisible();

  await captureReviewShot(page, testInfo, "collapsed-collaboration-widgets");
});

test("sidecar sections minimize and restore independently", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const minimizeInfo = page.getByRole("button", { name: "Minimize info browser" });
  const minimizeShell = page.getByRole("button", { name: "Minimize shell workspace" });
  await expect(minimizeInfo).toBeVisible();
  await expect(minimizeShell).toBeVisible();

  await minimizeInfo.click();
  await expect(page.getByRole("button", { name: "Restore info browser" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimize shell workspace" })).toBeVisible();

  await minimizeShell.click();
  await expect(page.getByRole("button", { name: "Restore info browser" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore shell workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Restore info browser" }).click();
  await expect(page.getByRole("button", { name: "Minimize info browser" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore shell workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Restore shell workspace" }).click();
  await expect(page.getByRole("button", { name: "Minimize shell workspace" })).toBeVisible();

  await captureReviewShot(page, testInfo, "sidecar-independent-section-controls");
});

test("sidecar workbench resize controls support keyboard and pointer operation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const explorerResize = page.getByRole("separator", { name: "Resize selection flyout" });
  const terminalResize = page.getByRole("separator", { name: "Resize terminal dock" });

  await expect(explorerResize).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Sidecar context rail" })).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize context rail" })).toHaveCount(0);
  await expect(terminalResize).toBeVisible();

  const explorerStart = Number(await explorerResize.getAttribute("aria-valuenow"));
  await explorerResize.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => Number(await explorerResize.getAttribute("aria-valuenow")))
    .toBe(explorerStart + 24);

  const terminalStart = Number(await terminalResize.getAttribute("aria-valuenow"));
  const box = await terminalResize.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("terminal resize handle was not measurable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await terminalResize.getAttribute("aria-valuenow")))
    .toBeGreaterThan(terminalStart);

  await captureReviewShot(page, testInfo, "sidecar-workbench-resize-controls");
});

test("sidecar layout profile persists resize across reload and resets to defaults", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const explorerResize = page.getByRole("separator", { name: "Resize selection flyout" });
  await expect(explorerResize).toBeVisible();
  const start = Number(await explorerResize.getAttribute("aria-valuenow"));
  await explorerResize.focus();
  await page.keyboard.press("ArrowRight");
  const resized = start + 24;
  await expect
    .poll(async () => Number(await explorerResize.getAttribute("aria-valuenow")))
    .toBe(resized);
  await expect
    .poll(async () => page.evaluate((value) => {
      return Object.keys(window.localStorage).some((key) => (
        key.startsWith("oman-sidecar-layout:")
        && window.localStorage.getItem(key)?.includes(`"explorerWidthPx":${value}`)
      ));
    }, resized))
    .toBe(true);

  await page.reload();
  await waitForChrome(page);
  await openObservedWorkspace(page);
  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const persistedExplorerResize = page.getByRole("separator", { name: "Resize selection flyout" });
  await expect
    .poll(async () => Number(await persistedExplorerResize.getAttribute("aria-valuenow")))
    .toBe(resized);

  await page.getByRole("button", { name: "Reset sidecar layout" }).click();
  await expect
    .poll(async () => Number(await persistedExplorerResize.getAttribute("aria-valuenow")))
    .toBe(384);

  await captureReviewShot(page, testInfo, "sidecar-layout-profile-persistence-reset");
});

test("sidecar explorer provider registry omits sessions provider", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const activityRail = page.locator("nav.sidecar-activity-rail");
  await expect(activityRail.getByRole("button", { name: "Sessions" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sidecar terminal dock" }).locator(".sidecar-shell-session-select")).toBeVisible();

  await captureReviewShot(page, testInfo, "sidecar-no-sessions-explorer-provider");
});

test("sidecar selector groups tickets and comments with sort controls", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openManagerWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });

  const activeGroup = flyout.locator(".sidecar-tree-group").filter({ hasText: /active/i }).first();
  const activeGroupToggle = activeGroup.getByRole("button", { name: /active/i }).first();
  await expect(activeGroupToggle).toBeVisible();
  await activeGroupToggle.click();
  await expect(activeGroupToggle).toHaveAttribute("aria-expanded", "false");
  await activeGroupToggle.click();
  await expect(activeGroupToggle).toHaveAttribute("aria-expanded", "true");

  const activeControls = activeGroup.locator(".sidecar-tree-group__controls");
  await activeControls.getByRole("button", { name: "A" }).click();
  await expect(activeControls.getByRole("button", { name: "A" })).toHaveAttribute("aria-pressed", "true");
  await activeControls.getByRole("button", { name: "R" }).click();

  await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Comments" }).click();
  const commentGroup = flyout.locator(".sidecar-tree-group").first();
  await expect(commentGroup).toBeVisible();
  await expect(commentGroup.locator(".sidecar-tree-group__controls").getByRole("button", { name: "T" })).toBeVisible();
  await expect(flyout.locator(".sidecar-row").first()).toBeVisible();

  await captureReviewShot(page, testInfo, "sidecar-hierarchical-selector-sort-controls");
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar browse navigator pins project folders", async ({ page }, testInfo) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
  await page.goto("/");
  await waitForChrome(page);
  await page.evaluate((root) => {
    window.localStorage.removeItem("oman-sidecar-path-history");
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${root}`, JSON.stringify([
      `${root}/.ai-workspace/tickets`,
      `${root}/.ai-workspace/comments`,
      `${root}/specification`,
      `${root}/build_tenants`,
    ]));
  }, MANAGER_WORKSPACE);
  await openManagerWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();
  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  const specificationRailButton = activityRail.getByRole("button", { name: "Pinned folder ./specification" });
  await expect(specificationRailButton).toBeVisible();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.ai-workspace/tickets" })).toHaveCount(0);
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.ai-workspace/comments" })).toHaveCount(0);
  await expect(activityRail.locator(".sidecar-rail-divider")).toBeVisible();
  const railLabels = await activityRail.locator(".sidecar-rail-button").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-label"))
  ));
  expect(railLabels.filter((label) => label === "Tickets")).toHaveLength(1);
  expect(railLabels.filter((label) => label === "Comments")).toHaveLength(1);
  expect(railLabels.at(-1)).toBe("Browse");
  const railMetrics = await activityRail.locator(".sidecar-rail-button").first().evaluate((button) => {
    const box = button.getBoundingClientRect();
    const icon = button.querySelector(".sidecar-rail-button__icon");
    const count = button.querySelector(".sidecar-rail-button__count");
    if (!icon || !count) throw new Error("rail button typography missing");
    return {
      buttonHeight: box.height,
      iconFontSize: Number.parseFloat(window.getComputedStyle(icon).fontSize),
      countFontSize: Number.parseFloat(window.getComputedStyle(count).fontSize),
    };
  });
  expect(railMetrics.buttonHeight).toBeLessThanOrEqual(44);
  expect(railMetrics.iconFontSize).toBeLessThanOrEqual(13);
  expect(railMetrics.countFontSize).toBeLessThanOrEqual(10);
  await specificationRailButton.click();
  await expect(flyout.getByRole("heading", { name: "./specification" }).first()).toBeVisible();
  const goalsFile = flyout.getByRole("button", { name: /file\s+GOALS\.md/i }).first();
  await expect(goalsFile).toBeVisible({ timeout: 20_000 });
  await goalsFile.click();
  await expect(canvas.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
  const expectedGoalsPath = `${MANAGER_WORKSPACE}/specification/GOALS.md`;
  await expect(canvas.locator(".sidecar-action-result")).toContainText("copied specification/GOALS.md");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedGoalsPath);

  await activityRail.getByRole("button", { name: "Recent Paths" }).click();
  await expect(flyout.getByRole("heading", { name: "Recent Paths" }).first()).toBeVisible();
  const recentGoals = flyout.getByRole("button", { name: "Copy path specification/GOALS.md" });
  await expect(recentGoals).toBeVisible();
  await page.evaluate(() => navigator.clipboard.writeText("reset"));
  await recentGoals.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedGoalsPath);
  await expect(flyout.getByRole("button", { name: "Open path specification/GOALS.md" })).toBeVisible();

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await expect(flyout.getByText("Recover")).toHaveCount(0);
  const specificationBrowserEntry = flyout.locator(".sidecar-tree-group").filter({ hasText: /specification/i }).first();
  const buildTenantToggle = flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: "build_tenants" }).first();
  await expect(specificationBrowserEntry).toBeVisible({ timeout: 20_000 });
  await expect(buildTenantToggle).toBeVisible();
  const browseDensity = await flyout.locator(".sidecar-tree-group__heading").first().evaluate((heading) => {
    const control = document.querySelector(".sidecar-tree-control");
    const row = document.querySelector(".sidecar-row--surface-file");
    const rowTitle = row?.querySelector(".sidecar-row__title");
    if (!control || !row || !rowTitle) throw new Error("browse density controls missing");
    return {
      headingHeight: heading.getBoundingClientRect().height,
      controlHeight: control.getBoundingClientRect().height,
      controlFontSize: Number.parseFloat(window.getComputedStyle(control).fontSize),
      rowHeight: row.getBoundingClientRect().height,
      rowTitleFontSize: Number.parseFloat(window.getComputedStyle(rowTitle).fontSize),
    };
  });
  expect(browseDensity.headingHeight).toBeLessThanOrEqual(30);
  expect(browseDensity.controlHeight).toBeLessThanOrEqual(22);
  expect(browseDensity.controlFontSize).toBeLessThanOrEqual(10);
  expect(browseDensity.rowHeight).toBeLessThanOrEqual(52);
  expect(browseDensity.rowTitleFontSize).toBeLessThanOrEqual(13);

  await activityRail.getByRole("button", { name: "Unpin ./specification" }).click();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./specification" })).toHaveCount(0);
  await expect(specificationBrowserEntry).toBeVisible();
  await specificationBrowserEntry.getByRole("button", { name: "Pin specification" }).click();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./specification" })).toBeVisible();
  await expect(flyout.getByRole("heading", { name: "./specification" }).first()).toBeVisible();
  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();

  await flyout.getByRole("textbox", { name: "Folder path to pin" }).fill("./specification/requirements");
  await flyout.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./specification/requirements" })).toBeVisible();
  await expect(flyout.getByRole("heading", { name: "./specification/requirements" }).first()).toBeVisible();
  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await activityRail.getByRole("button", { name: "Unpin ./specification/requirements" }).click();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./specification/requirements" })).toHaveCount(0);

  await buildTenantToggle.click();
  const reactViteToggle = flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: "react_vite" }).first();
  await expect(reactViteToggle).toBeVisible({ timeout: 20_000 });
  await flyout.getByRole("button", { name: "Pin react_vite" }).click();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./build_tenants/react_vite" })).toBeVisible();
  await expect(activityRail.locator(".sidecar-rail-button").filter({ hasText: "RV" })).toHaveCount(1);
  await expect(flyout.getByRole("heading", { name: "./build_tenants/react_vite" }).first()).toBeVisible();
  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();

  await captureReviewShot(page, testInfo, "sidecar-browse-pinned-folder-navigator");
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar build tenant favorite opens and highlights as single pinned folder", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);
  await page.evaluate((root) => {
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${root}`, JSON.stringify([
      `${root}/build_tenants`,
    ]));
  }, MANAGER_WORKSPACE);
  await openManagerWorkspace(page);

  const sidecarButton = page.getByRole("button", { name: "Sidecar", exact: true });
  await expect(sidecarButton).toBeVisible({ timeout: 30_000 });
  await sidecarButton.click();
  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  const buildTenantFavorite = activityRail.getByRole("button", { name: "Pinned folder ./build_tenants" });
  await expect(buildTenantFavorite).toBeVisible();
  await expect(activityRail.locator(".sidecar-rail-button").filter({ hasText: "BT" })).toHaveCount(1);
  await expect(buildTenantFavorite).toHaveAttribute("aria-pressed", "false");

  await buildTenantFavorite.click();
  await expect(buildTenantFavorite).toHaveAttribute("aria-pressed", "true");
  await expect(flyout.getByRole("heading", { name: "./build_tenants" }).first()).toBeVisible();
  await expect(flyout.getByRole("button", { name: /\.\/build_tenants/i }).first()).toHaveAttribute("aria-expanded", "true");

  await flyout.getByRole("button", { name: "Close selection flyout" }).click();
  await expect(buildTenantFavorite).toHaveAttribute("aria-pressed", "true");
  await buildTenantFavorite.click();
  await expect(flyout.getByRole("heading", { name: "./build_tenants" }).first()).toBeVisible();
  await activityRail.getByRole("button", { name: "Unpin ./build_tenants" }).click();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./build_tenants" })).toHaveCount(0);
  await expect(flyout.getByRole("heading", { name: "./build_tenants" }).first()).toBeVisible();
  await expect(flyout.getByRole("button", { name: "Pin ./build_tenants" })).toBeVisible();
  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await expect(flyout.locator(".sidecar-tree-group").filter({ hasText: /build_tenants/i }).first()).toBeVisible();
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar viewer panes open tabs and split groups", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const activityRail = page.locator("nav.sidecar-activity-rail");
  await activityRail.getByRole("button", { name: "Projects" }).click();
  const projectRows = page.locator(".sidecar-flyout .sidecar-row");
  await expect(projectRows.first()).toBeVisible();
  await projectRows.first().click();

  const canvas = page.locator(".sidecar-canvas");
  await expect(canvas.getByRole("tablist", { name: "Viewer tabs main" })).toBeVisible();
  await expect(canvas.locator(".sidecar-viewer-tab")).toHaveCount(1);

  await activityRail.getByRole("button", { name: "Projects" }).click();
  await expect(projectRows.nth(1)).toBeVisible();
  await projectRows.nth(1).click();
  await expect(canvas.locator(".sidecar-viewer-tab")).toHaveCount(2);

  await canvas.locator(".sidecar-viewer-layout-toggle").getByRole("button", { name: "Add vertical viewer pane" }).click();
  await expect(canvas.locator(".sidecar-viewer-group")).toHaveCount(2);
  await expect(canvas.getByRole("tablist", { name: "Viewer tabs secondary" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Sidecar selection flyout" })).toHaveCount(0);

  await canvas.getByRole("button", { name: /Close viewer tab/ }).first().click();
  await expect(canvas.locator(".sidecar-viewer-tab")).toHaveCount(2);

  await captureReviewShot(page, testInfo, "sidecar-viewer-tabbed-split-groups");
});

test("sidecar terminal panes open tabs and split groups", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await expect(terminalDock).toBeVisible();

  const sessionSelect = terminalDock.locator(".sidecar-shell-session-select");
  await expect(sessionSelect).toBeVisible();
  await expect(terminalDock.getByRole("tablist", { name: "Terminal tabs main" })).toBeVisible();
  await expect(terminalDock.locator(".sidecar-terminal-tab")).toHaveCount(1);

  const sessionValues = await sessionSelect.locator("option").evaluateAll((options) => (
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
  ));
  expect(sessionValues.length).toBeGreaterThan(1);
  await sessionSelect.selectOption(sessionValues[1]);
  await expect(terminalDock.locator(".sidecar-terminal-tab")).toHaveCount(2);

  await terminalDock.locator(".sidecar-terminal-layout-toggle").getByRole("button", { name: "Add vertical terminal pane" }).click();
  await expect(terminalDock.locator(".sidecar-terminal-group")).toHaveCount(2);
  await terminalDock.getByRole("region", { name: "Terminal group secondary" }).click();
  await expect(terminalDock.getByRole("tablist", { name: "Terminal tabs secondary" })).toBeVisible();
  await expect(terminalDock.locator(".sidecar-terminal-tab")).toHaveCount(1);
  await terminalDock.getByRole("region", { name: "Terminal group main" }).click();
  await expect(terminalDock.getByRole("tablist", { name: "Terminal tabs main" })).toBeVisible();
  await expect(terminalDock.locator(".sidecar-terminal-tab")).toHaveCount(2);

  await terminalDock.getByRole("button", { name: /Close terminal tab/ }).last().click();
  await expect(terminalDock.locator(".sidecar-terminal-tab")).toHaveCount(1);

  await captureReviewShot(page, testInfo, "sidecar-terminal-tabbed-split-groups");
});

test("sidecar panes add vertical splits and resize adjacent widths", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await canvas.locator(".sidecar-viewer-layout-toggle").getByRole("button", { name: "Add vertical viewer pane" }).click();
  await canvas.locator(".sidecar-viewer-layout-toggle").getByRole("button", { name: "Add vertical viewer pane" }).click();
  await expect(canvas.getByRole("region", { name: "Viewer group third" })).toBeVisible();

  const mainViewer = canvas.getByRole("region", { name: "Viewer group main" });
  const secondaryViewer = canvas.getByRole("region", { name: "Viewer group secondary" });
  const viewerHandle = page.getByRole("separator", { name: "Resize viewer split 1" });
  const viewerBefore = {
    main: await mainViewer.boundingBox(),
    secondary: await secondaryViewer.boundingBox(),
    handle: await viewerHandle.boundingBox(),
  };
  if (!viewerBefore.main || !viewerBefore.secondary || !viewerBefore.handle) throw new Error("viewer split was not measurable");
  await page.mouse.move(viewerBefore.handle.x + viewerBefore.handle.width / 2, viewerBefore.handle.y + viewerBefore.handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewerBefore.handle.x + viewerBefore.handle.width / 2 + 90, viewerBefore.handle.y + viewerBefore.handle.height / 2, { steps: 6 });
  await page.mouse.up();
  const viewerAfterMain = await mainViewer.boundingBox();
  const viewerAfterSecondary = await secondaryViewer.boundingBox();
  if (!viewerAfterMain || !viewerAfterSecondary) throw new Error("viewer split resize result was not measurable");
  expect(viewerAfterMain.width).toBeGreaterThan(viewerBefore.main.width + 35);
  expect(viewerAfterSecondary.width).toBeLessThan(viewerBefore.secondary.width - 35);
  const viewerHandleAfter = await viewerHandle.boundingBox();
  if (!viewerHandleAfter) throw new Error("viewer split handle after resize was not measurable");
  await page.mouse.move(viewerHandleAfter.x + viewerHandleAfter.width / 2, viewerHandleAfter.y + viewerHandleAfter.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewerHandleAfter.x + viewerHandleAfter.width / 2 - 90, viewerHandleAfter.y + viewerHandleAfter.height / 2, { steps: 6 });
  await page.mouse.up();
  const viewerRestoredMain = await mainViewer.boundingBox();
  const viewerRestoredSecondary = await secondaryViewer.boundingBox();
  if (!viewerRestoredMain || !viewerRestoredSecondary) throw new Error("viewer split restore result was not measurable");
  expect(Math.abs(viewerRestoredMain.width - viewerBefore.main.width)).toBeLessThan(30);
  expect(Math.abs(viewerRestoredSecondary.width - viewerBefore.secondary.width)).toBeLessThan(30);

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await terminalDock.locator(".sidecar-terminal-layout-toggle").getByRole("button", { name: "Add vertical terminal pane" }).click();
  await terminalDock.locator(".sidecar-terminal-layout-toggle").getByRole("button", { name: "Add vertical terminal pane" }).click();
  await expect(terminalDock.getByRole("region", { name: "Terminal group third" })).toBeVisible();
  const terminalMain = terminalDock.getByRole("region", { name: "Terminal group main" });
  const terminalSecondary = terminalDock.getByRole("region", { name: "Terminal group secondary" });
  const terminalHandle = terminalDock.getByRole("separator", { name: "Resize terminal split 1" });
  const terminalBefore = {
    main: await terminalMain.boundingBox(),
    secondary: await terminalSecondary.boundingBox(),
    handle: await terminalHandle.boundingBox(),
  };
  if (!terminalBefore.main || !terminalBefore.secondary || !terminalBefore.handle) throw new Error("terminal split was not measurable");
  await page.mouse.move(terminalBefore.handle.x + terminalBefore.handle.width / 2, terminalBefore.handle.y + terminalBefore.handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(terminalBefore.handle.x + terminalBefore.handle.width / 2 + 90, terminalBefore.handle.y + terminalBefore.handle.height / 2, { steps: 6 });
  await page.mouse.up();
  const terminalAfterMain = await terminalMain.boundingBox();
  const terminalAfterSecondary = await terminalSecondary.boundingBox();
  if (!terminalAfterMain || !terminalAfterSecondary) throw new Error("terminal split resize result was not measurable");
  expect(terminalAfterMain.width).toBeGreaterThan(terminalBefore.main.width + 35);
  expect(terminalAfterSecondary.width).toBeLessThan(terminalBefore.secondary.width - 35);
  const terminalHandleAfter = await terminalHandle.boundingBox();
  if (!terminalHandleAfter) throw new Error("terminal split handle after resize was not measurable");
  await page.mouse.move(terminalHandleAfter.x + terminalHandleAfter.width / 2, terminalHandleAfter.y + terminalHandleAfter.height / 2);
  await page.mouse.down();
  await page.mouse.move(terminalHandleAfter.x + terminalHandleAfter.width / 2 - 90, terminalHandleAfter.y + terminalHandleAfter.height / 2, { steps: 6 });
  await page.mouse.up();
  const terminalRestoredMain = await terminalMain.boundingBox();
  const terminalRestoredSecondary = await terminalSecondary.boundingBox();
  if (!terminalRestoredMain || !terminalRestoredSecondary) throw new Error("terminal split restore result was not measurable");
  expect(Math.abs(terminalRestoredMain.width - terminalBefore.main.width)).toBeLessThan(30);
  expect(Math.abs(terminalRestoredSecondary.width - terminalBefore.secondary.width)).toBeLessThan(30);

  await captureReviewShot(page, testInfo, "sidecar-multi-pane-split-resize");
});

test("sidecar design language keeps workspace low-border in light, dark grey, and dark blue themes", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => window.localStorage.setItem("oman-theme", "light"));
  await page.goto("/");
  await waitForChrome(page);
  await expect(page.locator("nav.manager-nav")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".shell__control-card--status strong")).not.toHaveText("Loading", { timeout: 30_000 });

  const themeSidecarButton = page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true });
  await expect(themeSidecarButton).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await themeSidecarButton.click();
    await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Sidecar terminal dock" })).toBeVisible();

  const lightMetrics = await page.evaluate(() => {
    const styleOf = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`${selector} missing`);
      return window.getComputedStyle(element);
    };
    return {
      canvasBorder: styleOf(".sidecar-canvas").borderTopWidth,
      canvasBackground: styleOf(".sidecar-canvas").backgroundColor,
      dockBorder: styleOf(".sidecar-bottom-dock").borderTopWidth,
      railBorder: styleOf(".sidecar-activity-rail").borderTopWidth,
      railBackground: styleOf(".sidecar-activity-rail").backgroundColor,
    };
  });
  expect(lightMetrics.canvasBorder).toBe("0px");
  expect(lightMetrics.dockBorder).toBe("0px");
  expect(lightMetrics.canvasBackground).toBe("rgba(0, 0, 0, 0)");
  expect(lightMetrics.railBorder).not.toBe("0px");
  expect(lightMetrics.railBackground).not.toBe("rgba(0, 0, 0, 0)");

  await captureReviewShot(page, testInfo, "sidecar-design-language-light");

  await page.getByRole("button", { name: "Switch to dark grey mode" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark-grey");

  const darkGreyMetrics = await page.evaluate(() => {
    const styleOf = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`${selector} missing`);
      return window.getComputedStyle(element);
    };
    return {
      themeBackground: window.getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      canvasBorder: styleOf(".sidecar-canvas").borderTopWidth,
      canvasBackground: styleOf(".sidecar-canvas").backgroundColor,
      dockBorder: styleOf(".sidecar-bottom-dock").borderTopWidth,
      layoutToggleBackground: styleOf(".agent-console__layout-toggle").backgroundColor,
      railBorder: styleOf(".sidecar-activity-rail").borderTopWidth,
      railBackground: styleOf(".sidecar-activity-rail").backgroundColor,
    };
  });
  expect(darkGreyMetrics.themeBackground).toBe("#1e1e1e");
  expect(darkGreyMetrics.canvasBorder).toBe("0px");
  expect(darkGreyMetrics.dockBorder).toBe("0px");
  expect(darkGreyMetrics.canvasBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkGreyMetrics.layoutToggleBackground).not.toContain("255");
  expect(darkGreyMetrics.railBorder).not.toBe("0px");
  expect(darkGreyMetrics.railBackground).not.toBe("rgba(0, 0, 0, 0)");

  await captureReviewShot(page, testInfo, "sidecar-design-language-dark-grey");

  await page.getByRole("button", { name: "Switch to dark blue mode" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");

  const darkBlueMetrics = await page.evaluate(() => {
    const styleOf = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`${selector} missing`);
      return window.getComputedStyle(element);
    };
    return {
      themeBackground: window.getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
      canvasBorder: styleOf(".sidecar-canvas").borderTopWidth,
      canvasBackground: styleOf(".sidecar-canvas").backgroundColor,
      dockBorder: styleOf(".sidecar-bottom-dock").borderTopWidth,
      railBorder: styleOf(".sidecar-activity-rail").borderTopWidth,
      railBackground: styleOf(".sidecar-activity-rail").backgroundColor,
    };
  });
  expect(darkBlueMetrics.themeBackground).toBe("#0b1320");
  expect(darkBlueMetrics.canvasBorder).toBe("0px");
  expect(darkBlueMetrics.dockBorder).toBe("0px");
  expect(darkBlueMetrics.canvasBackground).toBe("rgba(0, 0, 0, 0)");
  expect(darkBlueMetrics.railBorder).not.toBe("0px");
  expect(darkBlueMetrics.railBackground).not.toBe("rgba(0, 0, 0, 0)");

  await captureReviewShot(page, testInfo, "sidecar-design-language-dark-blue");
});

test("sidecar right context rail is narrow and sweeps out detail", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const contextRail = page.getByRole("complementary", { name: "Sidecar context rail" });
  await expect(contextRail).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize context rail" })).toHaveCount(0);

  const projectItem = contextRail.getByLabel(/Project:/);
  await expect(projectItem).toBeVisible();
  await expect(projectItem.locator(".sidecar-context-rail__symbol")).toHaveText("P");

  const railMetrics = await contextRail.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const longInlineText = Array.from(node.querySelectorAll(".sidecar-context-rail__item > span, .sidecar-context-rail__item > strong"))
      .map((element) => element.textContent ?? "")
      .join(" ");
    return { width: box.width, longInlineText };
  });
  expect(railMetrics.width).toBeLessThanOrEqual(70);
  expect(railMetrics.longInlineText).not.toContain("/Users/");

  await projectItem.hover();
  const detail = projectItem.locator(".sidecar-context-rail__detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Project");

  await captureReviewShot(page, testInfo, "sidecar-right-rail-sweep-out");
});

test("sidecar info browser splitter stays compact in canvas header", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await expect(canvas.locator(".sidecar-canvas__header .sidecar-viewer-layout-toggle")).toBeVisible();
  await expect(canvas.locator(".sidecar-viewer-toolbar")).toHaveCount(0);
  await expect(canvas.locator(".sidecar-viewer-tabs").first()).toBeVisible();

  const metrics = await canvas.evaluate((node) => {
    const header = node.querySelector(".sidecar-canvas__header");
    const toggle = node.querySelector(".sidecar-canvas__header .sidecar-viewer-layout-toggle");
    const tabs = node.querySelector(".sidecar-viewer-tabs");
    if (!header || !toggle || !tabs) throw new Error("info-browser density elements missing");
    const headerBox = header.getBoundingClientRect();
    const toggleBox = toggle.getBoundingClientRect();
    const tabsBox = tabs.getBoundingClientRect();
    return {
      toggleHeight: toggleBox.height,
      headerHeight: headerBox.height,
      chromeBeforeTabs: tabsBox.top - headerBox.bottom,
    };
  });
  expect(metrics.toggleHeight).toBeLessThanOrEqual(32);
  expect(metrics.headerHeight).toBeLessThanOrEqual(36);
  expect(metrics.chromeBeforeTabs).toBeLessThanOrEqual(24);

  await captureReviewShot(page, testInfo, "sidecar-info-browser-compact-splitter");
});

test("sidecar horizontal viewer split keeps top and bottom panes balanced", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await page.getByRole("button", { name: "Projects" }).click();
  const firstProject = page.locator(".sidecar-flyout .sidecar-row").first();
  await expect(firstProject).toBeVisible();
  await firstProject.click();
  await expect(canvas.locator(".sidecar-viewer-tab").first()).toBeVisible();
  await page
    .getByRole("complementary", { name: "Sidecar selection flyout" })
    .getByRole("button", { name: "Close selection flyout" })
    .click();

  await canvas.locator(".sidecar-viewer-layout-toggle").getByRole("button", { name: "Split H" }).click();
  await expect(canvas.getByRole("region", { name: "Viewer group secondary" })).toBeVisible();

  const metrics = await canvas.evaluate((node) => {
    const workspace = node.querySelector(".sidecar-viewer-workspace");
    const groups = Array.from(node.querySelectorAll(".sidecar-viewer-group"));
    const bodies = Array.from(node.querySelectorAll(".sidecar-viewer-body"));
    const handle = node.querySelector(".sidecar-pane-split-handle--horizontal");
    if (!workspace || groups.length < 2 || bodies.length < 2 || !handle) throw new Error("viewer horizontal split elements missing");
    const workspaceBox = workspace.getBoundingClientRect();
    const mainBox = groups[0].getBoundingClientRect();
    const secondaryBox = groups[1].getBoundingClientRect();
    const mainBodyBox = bodies[0].getBoundingClientRect();
    const secondaryBodyBox = bodies[1].getBoundingClientRect();
    const handleBox = handle.getBoundingClientRect();
    return {
      workspaceHeight: workspaceBox.height,
      mainHeight: mainBox.height,
      secondaryHeight: secondaryBox.height,
      mainBodyHeight: mainBodyBox.height,
      secondaryBodyHeight: secondaryBodyBox.height,
      handleHeight: handleBox.height,
    };
  });
  expect(metrics.workspaceHeight).toBeGreaterThanOrEqual(320);
  expect(metrics.mainHeight).toBeGreaterThanOrEqual(metrics.workspaceHeight * 0.36);
  expect(metrics.secondaryHeight).toBeGreaterThanOrEqual(metrics.workspaceHeight * 0.36);
  expect(Math.abs(metrics.mainHeight - metrics.secondaryHeight)).toBeLessThanOrEqual(8);
  expect(metrics.mainBodyHeight).toBeGreaterThanOrEqual(metrics.mainHeight - 48);
  expect(metrics.secondaryBodyHeight).toBeGreaterThanOrEqual(metrics.secondaryHeight - 48);
  expect(metrics.handleHeight).toBeGreaterThan(0);
  expect(metrics.handleHeight).toBeLessThanOrEqual(8);

  await captureReviewShot(page, testInfo, "sidecar-horizontal-viewer-balanced");
});

test("sidecar split panes can be explicitly targeted when empty", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await canvas.locator(".sidecar-viewer-layout-toggle").getByRole("button", { name: "Add vertical viewer pane" }).click();
  const secondaryViewer = canvas.getByRole("region", { name: "Viewer group secondary" });
  await expect(secondaryViewer).toBeVisible();
  await secondaryViewer.click();
  await expect(secondaryViewer).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Projects" }).click();
  const firstProject = page.locator(".sidecar-flyout .sidecar-row").first();
  await expect(firstProject).toBeVisible();
  await firstProject.click();
  await expect(secondaryViewer.locator(".sidecar-viewer-tab")).toHaveCount(1);

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await terminalDock.locator(".sidecar-terminal-layout-toggle").getByRole("button", { name: "Add vertical terminal pane" }).click();
  const secondaryTerminal = terminalDock.getByRole("region", { name: "Terminal group secondary" });
  await expect(secondaryTerminal).toBeVisible();
  await secondaryTerminal.click();
  await expect(terminalDock.getByRole("tablist", { name: "Terminal tabs secondary" })).toBeVisible();
  if (await terminalDock.locator(".sidecar-terminal-tab").count()) {
    await terminalDock.getByRole("button", { name: /Close terminal tab/ }).last().click();
  }
  await secondaryTerminal.click();
  await expect(secondaryTerminal).toHaveAttribute("aria-selected", "true");

  const sessionSelect = terminalDock.locator(".sidecar-shell-session-select");
  const optionValues = await sessionSelect.locator("option").evaluateAll((options) => (
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
  ));
  if (optionValues.length > 0) {
    await sessionSelect.selectOption(optionValues[0]);
    await expect(terminalDock.getByRole("tablist", { name: "Terminal tabs secondary" })).toBeVisible();
    await expect(terminalDock.locator(".sidecar-terminal-tab")).toHaveCount(1);
  }

  await captureReviewShot(page, testInfo, "sidecar-empty-split-pane-targeting");
});

test("sidecar terminal dock drag collapses and restores", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  const resizeHandle = page.getByRole("separator", { name: "Resize terminal dock" });
  await expect(terminalDock.locator(".sidecar-terminal-toolbar")).toBeVisible();
  await expect(resizeHandle).toBeVisible();

  const collapseBox = await resizeHandle.boundingBox();
  expect(collapseBox).not.toBeNull();
  if (!collapseBox) throw new Error("terminal resize handle was not measurable");
  await page.mouse.move(collapseBox.x + collapseBox.width / 2, collapseBox.y + collapseBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(collapseBox.x + collapseBox.width / 2, collapseBox.y + collapseBox.height / 2 + 520, { steps: 6 });
  await page.mouse.up();

  await expect(terminalDock.getByRole("button", { name: "Terminal" })).toBeVisible();
  await expect(terminalDock.locator(".sidecar-terminal-toolbar")).toHaveCount(0);

  const restoreHandle = page.getByRole("separator", { name: "Resize terminal dock" });
  const restoreBox = await restoreHandle.boundingBox();
  expect(restoreBox).not.toBeNull();
  if (!restoreBox) throw new Error("collapsed terminal resize handle was not measurable");
  await page.mouse.move(restoreBox.x + restoreBox.width / 2, restoreBox.y + restoreBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(restoreBox.x + restoreBox.width / 2, restoreBox.y + restoreBox.height / 2 - 300, { steps: 6 });
  await page.mouse.up();

  await expect(terminalDock.locator(".sidecar-terminal-toolbar")).toBeVisible();

  await captureReviewShot(page, testInfo, "sidecar-terminal-drag-collapse-restore");
});

test("sidecar horizontal terminal split uses maximum assigned height", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await expect(terminalDock.locator(".sidecar-terminal-toolbar")).toBeVisible();
  const sessionSelect = terminalDock.locator(".sidecar-shell-session-select");
  const readLiveOption = async () => {
    const sessionOptions = await sessionSelect.locator("option").evaluateAll((options) => (
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        label: (option as HTMLOptionElement).textContent ?? "",
      })).filter((option) => option.value)
    ));
    return sessionOptions.find((option) => !/(closed|stopped)/i.test(option.label)) ?? null;
  };
  let liveOption = await readLiveOption();
  if (!liveOption) {
    await terminalDock.getByRole("button", { name: "+ Spawn" }).click();
    await expect.poll(async () => Boolean(await readLiveOption())).toBe(true);
    liveOption = await readLiveOption();
  }
  expect(liveOption).toBeTruthy();
  await sessionSelect.selectOption(liveOption?.value ?? "");
  await terminalDock.locator(".sidecar-terminal-layout-toggle").getByRole("button", { name: "Split H" }).click();
  await expect(terminalDock.getByRole("region", { name: "Terminal group secondary" })).toBeVisible();
  await expect(terminalDock.locator(".sidecar-terminal .agent-console__terminal-host").first()).toBeVisible();

  const metrics = await terminalDock.evaluate((dock) => {
    const shellLayout = dock.querySelector(".sidecar-shell-layout");
    const workspace = dock.querySelector(".sidecar-terminal-workspace");
    const groups = dock.querySelector(".sidecar-terminal-groups");
    const group = dock.querySelector(".sidecar-terminal-group");
    const allGroups = Array.from(dock.querySelectorAll(".sidecar-terminal-group"));
    const body = dock.querySelector(".sidecar-terminal-group__body");
    const terminal = dock.querySelector(".sidecar-terminal");
    const host = dock.querySelector(".sidecar-terminal .agent-console__terminal-host");
    if (!shellLayout || !workspace || !groups || !group || allGroups.length < 2 || !body || !terminal || !host) throw new Error("horizontal split height elements missing");
    const dockBox = dock.getBoundingClientRect();
    const shellLayoutBox = shellLayout.getBoundingClientRect();
    const workspaceBox = workspace.getBoundingClientRect();
    const groupsBox = groups.getBoundingClientRect();
    const groupBox = group.getBoundingClientRect();
    const secondaryGroupBox = allGroups[1].getBoundingClientRect();
    const bodyBox = body.getBoundingClientRect();
    const terminalBox = terminal.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    return {
      dockHeight: dockBox.height,
      shellLayoutHeight: shellLayoutBox.height,
      unusedDockAfterShellLayout: dockBox.bottom - shellLayoutBox.bottom,
      workspaceHeight: workspaceBox.height,
      groupsHeight: groupsBox.height,
      unusedWorkspaceAfterGroups: workspaceBox.bottom - groupsBox.bottom,
      mainGroupHeight: groupBox.height,
      secondaryGroupHeight: secondaryGroupBox.height,
      groupHeight: groupBox.height,
      bodyHeight: bodyBox.height,
      terminalHeight: terminalBox.height,
      hostHeight: hostBox.height,
    };
  });
  expect(metrics.dockHeight).toBeGreaterThanOrEqual(520);
  expect(metrics.shellLayoutHeight).toBeGreaterThanOrEqual(metrics.dockHeight - 16);
  expect(metrics.unusedDockAfterShellLayout).toBeLessThanOrEqual(8);
  expect(metrics.workspaceHeight).toBeGreaterThanOrEqual(320);
  expect(metrics.groupsHeight).toBeGreaterThanOrEqual(metrics.workspaceHeight - 2);
  expect(metrics.unusedWorkspaceAfterGroups).toBeLessThanOrEqual(2);
  expect(metrics.mainGroupHeight).toBeGreaterThanOrEqual(metrics.workspaceHeight * 0.36);
  expect(metrics.secondaryGroupHeight).toBeGreaterThanOrEqual(metrics.workspaceHeight * 0.36);
  expect(metrics.groupHeight).toBeGreaterThanOrEqual(220);
  expect(metrics.bodyHeight).toBeGreaterThanOrEqual(185);
  expect(metrics.terminalHeight).toBeLessThanOrEqual(metrics.bodyHeight + 2);
  expect(metrics.terminalHeight).toBeGreaterThanOrEqual(metrics.bodyHeight - 2);
  expect(metrics.hostHeight).toBeLessThanOrEqual(metrics.bodyHeight + 2);
  expect(metrics.hostHeight).toBeGreaterThanOrEqual(metrics.bodyHeight - 42);

  await captureReviewShot(page, testInfo, "sidecar-horizontal-terminal-max-height");
});

test("sidecar terminal chrome stays compact before the terminal host", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await page.locator("nav.manager-nav").getByRole("button", { name: "Sidecar", exact: true }).click();

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await expect(terminalDock.locator(".sidecar-terminal-toolbar")).toBeVisible();
  await expect(terminalDock.locator(".sidecar-shell-manager")).toHaveCount(0);
  const sessionSelect = terminalDock.locator(".sidecar-shell-session-select");
  const readLiveOption = async () => {
    const sessionOptions = await sessionSelect.locator("option").evaluateAll((options) => (
    options.map((option) => ({
      value: (option as HTMLOptionElement).value,
      label: (option as HTMLOptionElement).textContent ?? "",
    })).filter((option) => option.value)
    ));
    return sessionOptions.find((option) => !/(closed|stopped)/i.test(option.label)) ?? null;
  };
  let liveOption = await readLiveOption();
  if (!liveOption) {
    await terminalDock.getByRole("button", { name: "+ Spawn" }).click();
    await expect.poll(async () => Boolean(await readLiveOption())).toBe(true);
    liveOption = await readLiveOption();
  }
  expect(liveOption).toBeTruthy();
  await sessionSelect.selectOption(liveOption?.value ?? "");
  await terminalDock.locator(".sidecar-terminal-layout-toggle").getByRole("button", { name: "Add vertical terminal pane" }).click();
  await expect(terminalDock.locator(".sidecar-terminal .agent-console__terminal-host").first()).toBeVisible();
  await expect(terminalDock.locator(".agent-console__terminal-bar")).toHaveCount(0);

  const metrics = await terminalDock.evaluate((dock) => {
    const toolbar = dock.querySelector(".sidecar-terminal-toolbar");
    const workspace = dock.querySelector(".sidecar-terminal-workspace");
    const tabs = toolbar?.querySelector(".sidecar-terminal-toolbar__tabs");
    const host = dock.querySelector(".sidecar-terminal .agent-console__terminal-host");
    if (!toolbar || !workspace || !tabs || !host) throw new Error("terminal density elements missing");
    const dockBox = dock.getBoundingClientRect();
    const toolbarBox = toolbar.getBoundingClientRect();
    const workspaceBox = workspace.getBoundingClientRect();
    const tabsBox = tabs.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    return {
      toolbarHeight: toolbarBox.height,
      toolbarTopOffset: toolbarBox.top - dockBox.top,
      workspaceGapAfterToolbar: workspaceBox.top - toolbarBox.bottom,
      tabsInsideToolbar: tabsBox.top >= toolbarBox.top && tabsBox.bottom <= toolbarBox.bottom + 1,
      chromeBeforeHost: hostBox.top - dockBox.top,
      workspaceHeight: workspaceBox.height,
      hostHeight: hostBox.height,
    };
  });
  expect(metrics.toolbarHeight).toBeLessThanOrEqual(42);
  expect(metrics.toolbarTopOffset).toBeLessThanOrEqual(32);
  expect(metrics.workspaceGapAfterToolbar).toBeLessThanOrEqual(12);
  expect(metrics.tabsInsideToolbar).toBe(true);
  expect(metrics.chromeBeforeHost).toBeLessThanOrEqual(82);
  expect(metrics.workspaceHeight).toBeGreaterThanOrEqual(320);
  expect(metrics.hostHeight).toBeGreaterThanOrEqual(320);

  await captureReviewShot(page, testInfo, "sidecar-terminal-compact-chrome");
});
