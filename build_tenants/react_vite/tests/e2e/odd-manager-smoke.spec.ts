import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OBSERVED_WORKSPACE =
  "/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test35";
const PROCESS_WORKSPACE =
  "/Users/jim/src/apps/ai_sdlc_examples/local_projects/data_mapper/data_mapper.test56.ts";
const MANAGER_WORKSPACE = "/Users/jim/src/apps/odd_manager";
const ABIOGENESIS_WORKSPACE = "/Users/jim/src/apps/abiogenesis";

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
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("banner").getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
}

async function openWorkspace(page: Page, workspaceRoot: string) {
  const registryActivated = await page.evaluate(async (root) => {
    const response = await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, setActive: true }),
    });
    return response.ok;
  }, workspaceRoot);
  expect(registryActivated).toBe(true);
  await page.reload();
  await waitForChrome(page);
  await expect(page.getByRole("banner")).toContainText(workspaceRoot);
}

async function openManagerWorkspace(page: Page) {
  await openWorkspace(page, MANAGER_WORKSPACE);
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
}

async function openObservedWorkspace(page: Page) {
  await openWorkspace(page, OBSERVED_WORKSPACE);
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
}

test("sidecar is the only route-level manager surface", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openWorkspace(page, OBSERVED_WORKSPACE);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible();
  await expect(page.locator("nav.manager-nav")).toHaveCount(0);
  await expect(page.locator(".shell__control-card--status")).toHaveCount(0);
  await captureReviewShot(page, testInfo, "sidecar-only-entry");
});

test("managed project add refreshes sidecar project selection without page reload", async ({ page }, testInfo) => {
  const managedProjectRoot = testInfo.outputPath("managed-project-fixture");
  mkdirSync(managedProjectRoot, { recursive: true });

  try {
    await page.goto("/");
    await waitForChrome(page);

    await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
    await page.evaluate(async (root) => {
      await fetch("/api/projects/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root, setActive: false }),
      });
      window.dispatchEvent(new CustomEvent("odd-manager:project-registry-changed"));
    }, managedProjectRoot);

    const sidecarSurfaces = page.getByRole("navigation", { name: "Sidecar selection surfaces" });
    await sidecarSurfaces.getByRole("button", { name: "Projects" }).click();
    const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
    await expect(flyout).toContainText("managed-project-fixture");
  } finally {
    await page.evaluate(async (root) => {
      await fetch("/api/projects/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root }),
      }).catch(() => undefined);
    }, managedProjectRoot).catch(() => undefined);
  }
});

test("project favourite browse tree can add nested folders to Project Favourites", async ({ page }, testInfo) => {
  const managedProjectRoot = testInfo.outputPath("managed-favourite-root");
  const nestedProjectRoot = `${managedProjectRoot}/nested-favourite`;
  mkdirSync(nestedProjectRoot, { recursive: true });

  try {
    await page.goto("/");
    await waitForChrome(page);
    const registered = await page.evaluate(async (root) => {
      const response = await fetch("/api/projects/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root, setActive: false }),
      });
      window.dispatchEvent(new CustomEvent("odd-manager:project-registry-changed"));
      return response.ok;
    }, managedProjectRoot);
    expect(registered).toBe(true);

    await page.reload();
    await waitForChrome(page);
    await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Projects" }).click();
    const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
    await expect(flyout.getByRole("heading", { name: "Project Browser" }).first()).toBeVisible();

    const rootEntry = flyout.locator(".sidecar-project-browser__entry").filter({ hasText: "managed-favourite-root" }).first();
    await expect(rootEntry).toBeVisible();
    await rootEntry.getByRole("button", { name: "Browse" }).click();

    const addNestedFavourite = flyout.getByRole("button", { name: "Add nested-favourite to Project Favourites" });
    await expect(addNestedFavourite).toBeVisible({ timeout: 20_000 });
    await addNestedFavourite.click();

    const nestedEntry = flyout.locator(".sidecar-project-browser__entry").filter({ hasText: "nested-favourite" }).first();
    await expect(nestedEntry).toBeVisible({ timeout: 20_000 });
    await expect(addNestedFavourite).toBeDisabled();
  } finally {
    await page.evaluate(async ({ root, nested }) => {
      for (const target of [nested, root]) {
        await fetch("/api/projects/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root: target }),
        }).catch(() => undefined);
      }
      window.dispatchEvent(new CustomEvent("odd-manager:project-registry-changed"));
    }, { root: managedProjectRoot, nested: nestedProjectRoot }).catch(() => undefined);
  }
});

test("project browser refresh updates visible open trees", async ({ page }, testInfo) => {
  const managedProjectRoot = testInfo.outputPath("managed-refresh-root");
  const branchRoot = `${managedProjectRoot}/open-branch`;
  mkdirSync(`${branchRoot}/initial-child`, { recursive: true });

  try {
    await page.goto("/");
    await waitForChrome(page);
    const registered = await page.evaluate(async (root) => {
      const response = await fetch("/api/projects/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root, setActive: false }),
      });
      window.dispatchEvent(new CustomEvent("odd-manager:project-registry-changed"));
      return response.ok;
    }, managedProjectRoot);
    expect(registered).toBe(true);

    await page.reload();
    await waitForChrome(page);
    await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Projects" }).click();
    const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
    await expect(flyout.getByRole("heading", { name: "Project Browser" }).first()).toBeVisible();

    const rootEntry = flyout.locator(".sidecar-project-browser__entry").filter({ hasText: "managed-refresh-root" }).first();
    await expect(rootEntry).toBeVisible();
    await rootEntry.getByRole("button", { name: "Browse" }).click();

    const tree = rootEntry.locator(".sidecar-project-browser__tree");
    const branchToggle = tree.getByRole("button", { name: /open-branch/ }).first();
    await expect(branchToggle).toBeVisible({ timeout: 20_000 });
    await branchToggle.click();
    await expect(tree.getByText("initial-child", { exact: true })).toBeVisible({ timeout: 20_000 });

    await branchToggle.click();
    mkdirSync(`${branchRoot}/expand-refresh-child`, { recursive: true });
    await branchToggle.click();
    await expect(tree.getByText("expand-refresh-child", { exact: true })).toBeVisible({ timeout: 20_000 });

    mkdirSync(`${managedProjectRoot}/root-refresh-new`, { recursive: true });
    mkdirSync(`${branchRoot}/branch-refresh-new`, { recursive: true });
    await flyout.getByRole("button", { name: "Refresh Project Browser visible folders" }).click();
    await expect(tree.getByText("root-refresh-new", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(tree.getByText("branch-refresh-new", { exact: true })).toBeVisible({ timeout: 20_000 });
  } finally {
    await page.evaluate(async (root) => {
      await fetch("/api/projects/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root }),
      }).catch(() => undefined);
      window.dispatchEvent(new CustomEvent("odd-manager:project-registry-changed"));
    }, managedProjectRoot).catch(() => undefined);
  }
});

test("shell mode control stays attached to the right edge in dark grey mode", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oman-theme", "dark-grey");
  });
  await page.goto("/");
  await waitForChrome(page);

  const modeButton = page.getByRole("banner").getByRole("button", { name: "Switch to dark blue mode" });
  await expect(modeButton).toBeVisible();
  await expect(page.locator(".shell__control-card--status")).toHaveCount(0);
  await expect(page.locator("nav.manager-nav")).toHaveCount(0);

  const headerMetrics = await page.evaluate(() => {
    const header = document.querySelector(".shell__header")?.getBoundingClientRect();
    const button = document.querySelector(".shell__icon-button")?.getBoundingClientRect();
    const label = document.querySelector(".shell__control-label")?.getBoundingClientRect();
    const title = document.querySelector(".shell__title h1")?.getBoundingClientRect();
    if (!header || !button || !label || !title) throw new Error("shell header was not measurable");
    return {
      height: Math.round(header.height),
      rightGap: Math.round(header.right - button.right),
      titleButtonGap: Math.round(button.left - title.right),
      titleCenterDelta: Math.round(Math.abs((label.top + label.height / 2) - (title.top + title.height / 2))),
    };
  });
  expect(headerMetrics.height).toBeLessThanOrEqual(32);
  expect(headerMetrics.rightGap).toBeLessThanOrEqual(8);
  expect(headerMetrics.titleButtonGap).toBeGreaterThanOrEqual(4);
  expect(headerMetrics.titleCenterDelta).toBeLessThanOrEqual(5);
});

test("project switching from sidecar keeps sidecar open and scopes pinned folders", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);
  await page.evaluate(async ({ managerRoot, observedRoot }) => {
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${managerRoot}`, JSON.stringify([
      `${managerRoot}/.playwright-mcp`,
    ]));
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${observedRoot}`, JSON.stringify([
      `${observedRoot}/docs`,
    ]));
    await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: managerRoot, setActive: true }),
    });
    await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: observedRoot, setActive: false }),
    });
  }, { managerRoot: MANAGER_WORKSPACE, observedRoot: OBSERVED_WORKSPACE });
  await page.reload();
  await waitForChrome(page);

  const activityRail = page.locator("nav.sidecar-activity-rail");
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.playwright-mcp" })).toBeVisible();

  await activityRail.getByRole("button", { name: "Projects" }).click();
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  const observedProject = flyout.locator(".sidecar-row").filter({ hasText: OBSERVED_WORKSPACE.split("/").at(-1) ?? "data_mapper.test35" }).first();
  await expect(observedProject).toBeVisible();
  await observedProject.click();

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(OBSERVED_WORKSPACE);
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.playwright-mcp" })).toHaveCount(0);
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./docs" })).toBeVisible();
});

test("project selection from sidecar Projects surface promotes active context", async ({ page }) => {
  const observedName = OBSERVED_WORKSPACE.split("/").at(-1) ?? "data_mapper.test35";
  await page.goto("/");
  await waitForChrome(page);
  await page.evaluate(async ({ managerRoot, observedRoot }) => {
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${managerRoot}`, JSON.stringify([
      `${managerRoot}/.playwright-mcp`,
    ]));
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${observedRoot}`, JSON.stringify([
      `${observedRoot}/docs`,
    ]));
    await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: managerRoot, setActive: true }),
    });
    await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: observedRoot, setActive: false }),
    });
  }, { managerRoot: MANAGER_WORKSPACE, observedRoot: OBSERVED_WORKSPACE });
  await page.reload();
  await waitForChrome(page);

  await expect(page.getByRole("banner")).toContainText(MANAGER_WORKSPACE);

  const activityRail = page.locator("nav.sidecar-activity-rail");
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.playwright-mcp" })).toBeVisible();
  await activityRail.getByRole("button", { name: "Projects" }).click();
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  const observedProject = flyout.locator(".sidecar-row").filter({ hasText: observedName }).first();
  await expect(observedProject).toBeVisible();
  await observedProject.click();

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(OBSERVED_WORKSPACE);
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.playwright-mcp" })).toHaveCount(0);
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./docs" })).toBeVisible();
});

test("floating side windows close on outside click", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);

  await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Projects" }).click();
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  await expect(flyout).toBeVisible();
  await page.getByRole("region", { name: "Sidecar canvas" }).click();
  await expect(flyout).toHaveCount(0);
});

test("sidecar sections minimize and restore independently", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

  const activityRail = page.locator("nav.sidecar-activity-rail");
  const minimizeInfo = activityRail.getByRole("button", { name: "Close selection flyout" });
  const minimizeShell = page.getByRole("button", { name: "Minimize shell workspace" });
  const resetLayout = page.getByRole("button", { name: "Reset sidecar layout" });
  await expect(minimizeInfo).toBeVisible();
  await expect(minimizeShell).toBeVisible();
  await expect(resetLayout).toBeVisible();
  await expect(page.locator(".sidecar-section-controls")).toHaveCount(0);

  const chromeMetrics = await page.locator(".sidecar-workbench").evaluate((node) => {
    const activityRail = node.querySelector(".sidecar-activity-rail");
    const canvas = node.querySelector(".sidecar-canvas");
    const contextRail = node.querySelector(".sidecar-context-rail");
    if (!activityRail || !canvas || !contextRail) throw new Error("sidecar workbench chrome missing");
    return {
      activityTop: activityRail.getBoundingClientRect().top,
      canvasTop: canvas.getBoundingClientRect().top,
      contextTop: contextRail.getBoundingClientRect().top,
    };
  });
  expect(Math.abs(chromeMetrics.canvasTop - chromeMetrics.activityTop)).toBeLessThanOrEqual(4);
  expect(Math.abs(chromeMetrics.contextTop - chromeMetrics.activityTop)).toBeLessThanOrEqual(4);

  await minimizeInfo.click();
  await expect(activityRail.getByRole("button", { name: "Open selection flyout" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Minimize shell workspace" })).toBeVisible();

  await minimizeShell.click();
  await expect(activityRail.getByRole("button", { name: "Open selection flyout" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore shell workspace" })).toBeVisible();

  await activityRail.getByRole("button", { name: "Open selection flyout" }).click();
  await expect(activityRail.getByRole("button", { name: "Close selection flyout" })).toBeVisible();
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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

  const activityRail = page.locator("nav.sidecar-activity-rail");
  await expect(activityRail.getByRole("button", { name: "Sessions" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sidecar terminal dock" }).locator(".sidecar-shell-session-select")).toBeVisible();

  await captureReviewShot(page, testInfo, "sidecar-no-sessions-explorer-provider");
});

test("sidecar selector uses the same filesystem browser for tickets and comments", async ({ page }, testInfo) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
  await page.goto("/");
  await waitForChrome(page);
  await openManagerWorkspace(page);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });

  await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Tickets" }).click();
  await expect(flyout.getByRole("heading", { name: "Tickets" }).first()).toBeVisible();
  await expect(flyout.getByRole("button", { name: /\.\/\.ai-workspace\/tickets/i }).first()).toBeVisible();
  let ticketGroupToggle: Locator | null = null;
  let ticketGroup: Locator | null = null;
  for (const laneName of ["active", "backlog", "completed"]) {
    const candidateToggle = flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: new RegExp(laneName, "i") }).first();
    await expect(candidateToggle).toBeVisible();
    const candidateGroup = candidateToggle.locator("xpath=ancestor::section[contains(@class, 'sidecar-tree-group')][1]");
    if ((await candidateToggle.getAttribute("aria-expanded")) !== "true") {
      await candidateToggle.click();
    }
    try {
      await expect(candidateGroup.locator(".sidecar-row--surface-file").first()).toBeVisible({ timeout: 2_000 });
      ticketGroupToggle = candidateToggle;
      ticketGroup = candidateGroup;
      break;
    } catch {
      // Empty lanes are valid after ticket closure waves; keep looking for a populated lane.
    }
  }
  if (ticketGroupToggle === null || ticketGroup === null) {
    throw new Error("Ticket selector did not expose a lane with filesystem-backed ticket files");
  }
  await expect(ticketGroupToggle).toHaveAttribute("aria-expanded", "true");
  await ticketGroupToggle.click();
  await expect(ticketGroupToggle).toHaveAttribute("aria-expanded", "false");
  await ticketGroupToggle.click();
  await expect(ticketGroupToggle).toHaveAttribute("aria-expanded", "true");

  const ticketControls = flyout.getByLabel("Browse sort controls");
  await expect(ticketControls.getByRole("button", { name: "Name", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(ticketControls.getByRole("button", { name: "Time", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(ticketControls.getByRole("button", { name: "Reverse", exact: true })).toHaveAttribute("aria-pressed", "true");
  await ticketControls.getByRole("button", { name: "Name", exact: true }).click();
  await expect(ticketControls.getByRole("button", { name: "Name", exact: true })).toHaveAttribute("aria-pressed", "true");
  await ticketControls.getByRole("button", { name: "Reverse", exact: true }).click();
  const ticketFile = ticketGroup.locator(".sidecar-row--surface-file").first();
  await expect(ticketFile).toBeVisible({ timeout: 20_000 });
  const ticketRelativePath = (await ticketFile.locator(".sidecar-row__meta").innerText()).trim();
  await ticketFile.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(`${MANAGER_WORKSPACE}/${ticketRelativePath}`);
  await expect(canvas.locator(".sidecar-viewer-tab.is-selected .sidecar-viewer-tab__kind")).toHaveText("surface");

  await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Comments" }).click();
  await expect(flyout.getByRole("heading", { name: "Comments" }).first()).toBeVisible();
  await expect(flyout.getByRole("button", { name: /\.\/\.ai-workspace\/comments/i }).first()).toBeVisible();
  const commentsRoot = flyout.locator(".sidecar-tree-group").filter({ hasText: /\.ai-workspace\/comments/i }).first();
  await expect(commentsRoot).toBeVisible();
  await expect(flyout.getByRole("button", { name: "Time", exact: true })).toBeVisible();
  const commentAuthorToggle = flyout.locator(".sidecar-tree-group__toggle").nth(1);
  await expect(commentAuthorToggle).toBeVisible();
  await commentAuthorToggle.click();
  await expect(flyout.locator(".sidecar-row--surface-file").first()).toBeVisible({ timeout: 20_000 });

  await captureReviewShot(page, testInfo, "sidecar-default-folder-selector-sort-controls");
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar browse navigator pins project folders", async ({ page }, testInfo) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
  await page.goto("/");
  await waitForChrome(page);
  await page.evaluate(({ root, abiogenesisRoot }) => {
    window.localStorage.setItem("oman-sidecar-path-history", JSON.stringify([{
      absolutePath: `${abiogenesisRoot}/AGENTS.md`,
      projectRoot: abiogenesisRoot,
      relativePath: "AGENTS.md",
      source: "browse",
      timestamp: "2026-05-12T00:00:00.000Z",
    }]));
    window.localStorage.setItem(`oman-sidecar-pinned-folders:${root}`, JSON.stringify([
      `${root}/.ai-workspace/tickets`,
      `${root}/.ai-workspace/comments`,
      `${root}/specification`,
      `${root}/build_tenants`,
    ]));
  }, { root: MANAGER_WORKSPACE, abiogenesisRoot: ABIOGENESIS_WORKSPACE });
  await openManagerWorkspace(page);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  const expectCompactFlyoutHeader = async (name: string | RegExp) => {
    const header = flyout.locator(".sidecar-pane__header").first();
    await expect(header).toBeVisible();
    await expect(header.getByRole("heading", { name })).toBeVisible();
    await expect(header.locator(".sidecar-pane__title-count")).toHaveText(/\(\d+\)/);
    await expect(header.getByRole("button", { name: /Pin selection flyout|Unpin selection flyout/ })).toBeVisible();
    await expect(header.getByRole("button", { name: "Close selection flyout" })).toBeVisible();
    const metrics = await header.evaluate((node) => ({
      display: window.getComputedStyle(node).display,
      height: node.getBoundingClientRect().height,
      legacyHeaderCount: document.querySelectorAll(".sidecar-flyout__header").length,
    }));
    expect(metrics.display).toBe("flex");
    expect(metrics.height).toBeLessThanOrEqual(44);
    expect(metrics.legacyHeaderCount).toBe(0);
  };
  const specificationRailButton = activityRail.getByRole("button", { name: "Pinned folder ./specification" });
  await expect(specificationRailButton).toBeVisible();
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.ai-workspace/tickets" })).toHaveCount(0);
  await expect(activityRail.getByRole("button", { name: "Pinned folder ./.ai-workspace/comments" })).toHaveCount(0);
  await expect(activityRail.getByRole("separator", { name: "Favorites" })).toBeVisible();
  await expect(activityRail.getByRole("separator", { name: "System navigation" })).toBeVisible();
  await expect(activityRail.locator(".sidecar-rail-bottom").getByRole("separator", { name: "System navigation" })).toBeVisible();
  const railLabels = await activityRail.locator(".sidecar-rail-button").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-label"))
  ));
  const bottomRailLabels = await activityRail.locator(".sidecar-rail-bottom .sidecar-rail-button").evaluateAll((buttons) => (
    buttons.map((button) => button.getAttribute("aria-label"))
  ));
  expect(railLabels.filter((label) => label === "Tickets")).toHaveLength(1);
  expect(railLabels.filter((label) => label === "Comments")).toHaveLength(1);
  expect(railLabels.slice(-2)).toEqual(["Browse", "Recent Paths"]);
  expect(bottomRailLabels).toEqual(["Browse", "Recent Paths"]);
  expect(await activityRail.locator(".sidecar-rail-divider").count()).toBeGreaterThanOrEqual(2);
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
  await expectCompactFlyoutHeader("./specification");
  const pinnedFolderSortControls = flyout.getByLabel("Browse sort controls");
  await expect(pinnedFolderSortControls.getByRole("button", { name: "Name", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(pinnedFolderSortControls.getByRole("button", { name: "Time", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(pinnedFolderSortControls.getByRole("button", { name: "Reverse", exact: true })).toHaveAttribute("aria-pressed", "true");
  const goalsFile = flyout.getByRole("button", { name: /GOALS\.md/i }).first();
  await expect(goalsFile).toBeVisible({ timeout: 20_000 });
  await goalsFile.click();
  await expect(canvas.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
  const expectedGoalsPath = `${MANAGER_WORKSPACE}/specification/GOALS.md`;
  await expect(canvas.locator(".sidecar-action-result")).toContainText("copied specification/GOALS.md");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedGoalsPath);

  await activityRail.getByRole("button", { name: "Recent Paths" }).click();
  await expect(flyout.getByRole("heading", { name: "Recent Paths" }).first()).toBeVisible();
  await expectCompactFlyoutHeader("Recent Paths");
  const recentGoals = flyout.getByRole("button", { name: "Copy path specification/GOALS.md" });
  await expect(recentGoals).toBeVisible();
  await page.evaluate(() => navigator.clipboard.writeText("reset"));
  await recentGoals.click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedGoalsPath);
  const recentGoalsOpen = flyout.getByRole("button", { name: "Open path specification/GOALS.md" });
  await expect(recentGoalsOpen).toBeVisible();
  await expect(recentGoalsOpen).toBeEnabled();
  await page.getByRole("button", { name: "Open Process Navigator", exact: true }).click();
  await expect(canvas.locator(".sidecar-viewer-tab.is-selected strong")).toHaveText("Process Navigator");
  await activityRail.getByRole("button", { name: "Recent Paths" }).click();
  await expect(flyout.getByRole("heading", { name: "Recent Paths" }).first()).toBeVisible();
  await flyout.getByRole("button", { name: "Open path specification/GOALS.md" }).click();
  await expect(canvas.locator(".sidecar-viewer-tab.is-selected .sidecar-viewer-tab__kind")).toHaveText("surface");
  await expect(canvas.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await expectCompactFlyoutHeader("Browse");
  await expect(flyout.getByText("Recover")).toHaveCount(0);
  await expect(flyout.locator(".sidecar-tree-group").filter({ hasText: ".ai-workspace" }).first()).toBeVisible({ timeout: 20_000 });
  const specificationBrowserEntry = flyout.locator(".sidecar-tree-group").filter({ hasText: /specification/i }).first();
  const buildTenantToggle = flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: "build_tenants" }).first();
  await expect(specificationBrowserEntry).toBeVisible({ timeout: 20_000 });
  await expect(buildTenantToggle).toBeVisible();
  const browseDensity = await flyout.locator(".sidecar-tree-group__heading").first().evaluate((heading) => {
    const control = document.querySelector(".sidecar-navigator-toolbar .sidecar-tree-control");
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
  expect(browseDensity.controlFontSize).toBeLessThanOrEqual(11);
  expect(browseDensity.rowHeight).toBeLessThanOrEqual(56);
  expect(browseDensity.rowTitleFontSize).toBeLessThanOrEqual(14);

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
  await activityRail.getByRole("button", { name: "Recent Paths" }).click();
  await expect(flyout.getByRole("heading", { name: "Recent Paths" }).first()).toBeVisible();
  const abiogenesisAgentsOpen = flyout.getByRole("button", { name: "Open path AGENTS.md" });
  await expect(abiogenesisAgentsOpen).toBeVisible();
  await expect(abiogenesisAgentsOpen).toBeEnabled();
  await abiogenesisAgentsOpen.click();
  await expect(page.getByRole("banner")).toContainText(ABIOGENESIS_WORKSPACE, { timeout: 30_000 });
  await expect(canvas.locator(".sidecar-viewer-tab.is-selected .sidecar-viewer-tab__kind")).toHaveText("surface");
  await expect(canvas.getByRole("tab", { name: "surface AGENTS.md", selected: true })).toBeVisible();
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar browse pins folders inside abiogenesis project", async ({ page }) => {
  await page.goto("/");
  await waitForChrome(page);
  await openWorkspace(page, ABIOGENESIS_WORKSPACE);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await flyout.getByRole("textbox", { name: "Folder path to pin" }).fill("./docs");
  await flyout.getByRole("button", { name: "Pin", exact: true }).click();

  await expect(activityRail.getByRole("button", { name: "Pinned folder ./docs" })).toBeVisible();
  await expect(flyout.getByRole("heading", { name: "./docs" }).first()).toBeVisible();
  await expect(page.getByRole("banner")).toContainText(ABIOGENESIS_WORKSPACE);
  await expect(page.evaluate(() => window.localStorage.getItem(
    "oman-sidecar-pinned-folders:/Users/jim/src/apps/abiogenesis",
  ))).resolves.toContain("/Users/jim/src/apps/abiogenesis/docs");

  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar pinned selector remains open while browsing and selecting files", async ({ page }, testInfo) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:5173" });
  await page.goto("/");
  await waitForChrome(page);
  await openManagerWorkspace(page);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await flyout.getByRole("button", { name: "Pin selection flyout" }).click();
  await expect(flyout.getByRole("button", { name: "Unpin selection flyout" })).toBeVisible();

  const firstFile = flyout.locator(".sidecar-row--surface-file").first();
  await expect(firstFile).toBeVisible({ timeout: 20_000 });
  await firstFile.click();
  await expect(flyout).toBeVisible();
  await expect(canvas.locator(".sidecar-viewer-tab")).toHaveCount(1);

  await activityRail.getByRole("button", { name: "Tickets" }).click();
  await expect(flyout.getByRole("heading", { name: "Tickets" }).first()).toBeVisible();
  await expect(flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: "completed" }).first()).toBeVisible();
  await expect(flyout).toBeVisible();

  await activityRail.getByRole("button", { name: "Comments" }).click();
  await expect(flyout.getByRole("heading", { name: "Comments" }).first()).toBeVisible();
  const commentAuthorToggle = flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: /claude|codex|operator/i }).first();
  await expect(commentAuthorToggle).toBeVisible();
  await commentAuthorToggle.click();
  const commentFile = flyout.locator(".sidecar-row--surface-file").first();
  await expect(commentFile).toBeVisible({ timeout: 20_000 });
  await commentFile.click();
  await expect(flyout).toBeVisible();
  await expect(canvas.locator(".sidecar-viewer-tab")).toHaveCount(2);
  await expect(flyout.getByRole("button", { name: "Time", exact: true })).toBeVisible();

  const pinnedCanvasBox = await canvas.boundingBox();
  if (!pinnedCanvasBox) throw new Error("Sidecar canvas was not measurable while selector was pinned");
  await page.mouse.click(pinnedCanvasBox.x + pinnedCanvasBox.width - 40, pinnedCanvasBox.y + 40);
  await expect(flyout).toBeVisible();

  await flyout.getByRole("button", { name: "Unpin selection flyout" }).click();
  const unpinnedCanvasBox = await canvas.boundingBox();
  if (!unpinnedCanvasBox) throw new Error("Sidecar canvas was not measurable after unpinning selector");
  await page.mouse.click(unpinnedCanvasBox.x + unpinnedCanvasBox.width - 40, unpinnedCanvasBox.y + 40);
  await expect(flyout).toHaveCount(0);

  await captureReviewShot(page, testInfo, "sidecar-pinned-selector-window");
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar document viewer renders Mermaid, highlighted source, HTML, and PDF surfaces", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await waitForChrome(page);
  await openManagerWorkspace(page);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  await expect(canvas).toBeVisible({ timeout: 30_000 });

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await flyout.getByRole("textbox", { name: "Folder path to pin" }).fill("./build_tenants/react_vite/design/widgets");
  await flyout.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(flyout.getByRole("heading", { name: "./build_tenants/react_vite/design/widgets" }).first()).toBeVisible();
  await flyout.getByRole("button", { name: /sidecar-session-workspace\.md/i }).click();

  const documentToolbar = canvas.locator(".document-viewer__toolbar").first();
  await expect(canvas.locator(".markdown-viewer__mermaid svg").first()).toBeVisible({ timeout: 30_000 });
  await expect(documentToolbar.locator(".document-viewer__path")).toHaveText("build_tenants/react_vite/design/widgets/sidecar-session-workspace.md");
  const compactControlWidth = await documentToolbar.getByRole("button", { name: "Zoom out document" }).boundingBox().then((box) => box?.width ?? null);
  expect(compactControlWidth).not.toBeNull();
  expect(compactControlWidth ?? 0).toBeGreaterThan(29);
  expect(compactControlWidth ?? 0).toBeLessThan(32);
  await expect(canvas.locator(".markdown-viewer__mermaid-error")).toHaveCount(0);
  const documentContent = canvas.locator(".document-viewer__content").first();
  await expect(documentContent).toHaveCSS("transform", /matrix\(1,\s*0,\s*0,\s*1,/);
  await page.evaluate(() => {
    const viewport = document.querySelector(".document-viewer__viewport") as HTMLElement | null;
    if (!viewport) throw new Error("document viewer viewport missing");
    const observation = viewport.closest(".sidecar-viewer-body") as HTMLElement | null;
    const scrollHost = observation ?? viewport;
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) * 0.35);
    scrollHost.scrollTop = Math.max(0, (scrollHost.scrollHeight - scrollHost.clientHeight) * 0.35);
  });
  await canvas.getByRole("button", { name: "Zoom in document" }).click();
  await expect(documentContent).toHaveCSS("transform", /matrix\(1\.15,\s*0,\s*0,\s*1\.15,/);
  await expect(canvas.locator(".markdown-viewer__mermaid svg").first()).toBeVisible();
  await expect(canvas.locator(".markdown-viewer__mermaid-error")).toHaveCount(0);
  const zoomInLayoutMetrics = await page.evaluate(() => {
    const viewport = document.querySelector(".document-viewer__viewport") as HTMLElement | null;
    const content = document.querySelector(".document-viewer__content") as HTMLElement | null;
    if (!viewport) throw new Error("document viewer viewport missing");
    if (!content) throw new Error("document viewer content missing");
    const contentRect = content.getBoundingClientRect();
    const layoutWidth = Number.parseFloat(window.getComputedStyle(content).getPropertyValue("--document-viewer-layout-width"));
    return {
      viewportWidth: viewport.clientWidth,
      contentLayoutWidth: content.offsetWidth,
      contentRenderedWidth: contentRect.width,
      layoutWidth,
      overflowX: Math.max(0, viewport.scrollWidth - viewport.clientWidth),
    };
  });
  expect(zoomInLayoutMetrics.layoutWidth).toBeCloseTo(zoomInLayoutMetrics.viewportWidth / 1.15, 0);
  expect(zoomInLayoutMetrics.contentLayoutWidth).toBeCloseTo(zoomInLayoutMetrics.viewportWidth / 1.15, 0);
  expect(zoomInLayoutMetrics.contentRenderedWidth).toBeLessThanOrEqual(zoomInLayoutMetrics.viewportWidth + 2);
  expect(zoomInLayoutMetrics.overflowX).toBeLessThanOrEqual(2);
  await canvas.getByRole("button", { name: "Fit document to width" }).click();
  await expect(canvas.getByRole("button", { name: "Fit document to width" })).toHaveAttribute("aria-pressed", "true");
  await canvas.getByRole("button", { name: "Reset document zoom" }).click();
  await expect(documentContent).toHaveCSS("transform", /matrix\(1,\s*0,\s*0,\s*1,/);
  const mermaidSvg = canvas.locator(".markdown-viewer__mermaid svg").first();
  await mermaidSvg.scrollIntoViewIfNeeded();
  await canvas.getByRole("button", { name: "Zoom out document" }).click();
  await canvas.getByRole("button", { name: "Zoom out document" }).click();
  await expect(documentContent).toHaveCSS("transform", /matrix\(0\.7,\s*0,\s*0,\s*0\.7,/);
  const zoomOutMermaidMetrics = await page.evaluate(() => {
    const svg = document.querySelector(".markdown-viewer__mermaid svg") as SVGElement | null;
    const viewport = document.querySelector(".document-viewer__viewport") as HTMLElement | null;
    const content = document.querySelector(".document-viewer__content") as HTMLElement | null;
    if (!svg || !viewport || !content) throw new Error("Mermaid zoom-out target missing");
    const observation = viewport.closest(".sidecar-viewer-body") as HTMLElement | null;
    const svgRect = svg.getBoundingClientRect();
    const observationRect = (observation ?? viewport).getBoundingClientRect();
    return {
      visibleWidth: Math.max(0, Math.min(svgRect.right, observationRect.right) - Math.max(svgRect.left, observationRect.left)),
      visibleHeight: Math.max(0, Math.min(svgRect.bottom, observationRect.bottom) - Math.max(svgRect.top, observationRect.top)),
      contentMarginBottom: Number.parseFloat(window.getComputedStyle(content).marginBottom),
      contentHeight: content.getBoundingClientRect().height,
      layoutHeight: content.offsetHeight,
    };
  });
  expect(zoomOutMermaidMetrics.visibleWidth).toBeGreaterThan(80);
  expect(zoomOutMermaidMetrics.visibleHeight).toBeGreaterThan(80);
  expect(zoomOutMermaidMetrics.contentMarginBottom).toBeLessThan(0);
  expect(zoomOutMermaidMetrics.contentHeight).toBeLessThan(zoomOutMermaidMetrics.layoutHeight);
  await canvas.getByRole("button", { name: "Reset document zoom" }).click();
  await expect(documentContent).toHaveCSS("transform", /matrix\(1,\s*0,\s*0,\s*1,/);
  await page.evaluate(() => {
    const viewport = document.querySelector(".document-viewer__viewport") as HTMLElement | null;
    if (!viewport) throw new Error("document viewer viewport missing");
    const rect = viewport.getBoundingClientRect();
    viewport.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -80,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  });
  await expect(documentContent).toHaveCSS("transform", /matrix\(1\.16,\s*0,\s*0,\s*1\.16,/);
  await canvas.getByRole("button", { name: "Reset document zoom" }).click();
  await expect(documentContent).toHaveCSS("transform", /matrix\(1,\s*0,\s*0,\s*1,/);

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await flyout.getByRole("textbox", { name: "Folder path to pin" }).fill("./build_tenants/react_vite/src/components");
  await flyout.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(flyout.getByRole("heading", { name: "./build_tenants/react_vite/src/components" }).first()).toBeVisible();
  await flyout.getByRole("button", { name: /DocumentViewer\.tsx/i }).click();
  await expect(canvas.locator(".document-viewer__highlight .shiki").first()).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => {
    const host = document.querySelector(".document-viewer__highlight")?.closest(".sidecar-viewer-body") as HTMLElement | null;
    if (!host) return false;
    host.scrollTop = 0;
    return true;
  })).toBe(true);
  await canvas.locator(".document-viewer__highlight").first().hover();
  const toolbarTopBeforeScroll = await documentToolbar.boundingBox().then((box) => box?.y ?? null);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => {
    const host = document.querySelector(".document-viewer__highlight")?.closest(".sidecar-viewer-body") as HTMLElement | null;
    return host?.scrollTop ?? 0;
  })).toBeGreaterThan(0);
  const toolbarTopAfterScroll = await documentToolbar.boundingBox().then((box) => box?.y ?? null);
  expect(toolbarTopBeforeScroll).not.toBeNull();
  expect(toolbarTopAfterScroll).not.toBeNull();
  expect(Math.abs((toolbarTopAfterScroll ?? 0) - (toolbarTopBeforeScroll ?? 0))).toBeLessThan(2);

  await activityRail.getByRole("button", { name: "Browse" }).click();
  await expect(flyout.getByRole("heading", { name: "Browse" }).first()).toBeVisible();
  await flyout.getByRole("textbox", { name: "Folder path to pin" }).fill("./build_tenants/react_vite/tests/fixtures/document-viewer");
  await flyout.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(flyout.getByRole("heading", { name: "./build_tenants/react_vite/tests/fixtures/document-viewer" }).first()).toBeVisible();
  await flyout.getByRole("button", { name: /fixture\.html/i }).click();
  await expect(canvas.locator(".document-viewer__html-frame").first()).toBeVisible({ timeout: 30_000 });
  await expect(canvas.frameLocator('iframe[title="HTML document fixture.html"]').getByRole("heading", { name: "Odd Manager HTML Fixture" })).toBeVisible();
  await page.evaluate(() => {
    const frame = document.querySelector(".document-viewer__html-frame") as HTMLIFrameElement | null;
    if (!frame?.contentWindow) throw new Error("HTML frame missing");
    frame.contentWindow.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -80,
      clientX: 80,
      clientY: 80,
    }));
  });
  await expect(canvas.locator(".document-viewer__html-frame").first().locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' document-viewer__content ')][1]")).toHaveCSS("transform", /matrix\(1\.16,\s*0,\s*0,\s*1\.16,/);

  await flyout.getByRole("button", { name: /fixture\.pdf/i }).click();
  const pdfFrame = canvas.locator(".document-viewer__pdf-frame").first();
  await expect(pdfFrame).toBeVisible({ timeout: 30_000 });
  const pdfSrc = await pdfFrame.getAttribute("src");
  expect(pdfSrc).toContain("/api/surface/raw?");
  expect(decodeURIComponent(pdfSrc ?? "")).toContain("build_tenants/react_vite/tests/fixtures/document-viewer/fixture.pdf");

  await captureReviewShot(canvas, testInfo, "sidecar-document-viewer-mermaid-code-html-pdf");
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

  const activityRail = page.locator("nav.sidecar-activity-rail");
  const flyout = page.getByRole("complementary", { name: "Sidecar selection flyout" });
  const buildTenantFavorite = activityRail.getByRole("button", { name: "Pinned folder ./build_tenants" });
  await expect(buildTenantFavorite).toBeVisible();
  await expect(activityRail.locator(".sidecar-rail-button").filter({ hasText: "BT" })).toHaveCount(1);
  await expect(buildTenantFavorite).toHaveAttribute("aria-pressed", "false");

  await buildTenantFavorite.click();
  await expect(buildTenantFavorite).toHaveAttribute("aria-pressed", "true");
  await expect(flyout.getByRole("heading", { name: "./build_tenants" }).first()).toBeVisible();
  await expect(flyout.locator(".sidecar-tree-group__toggle").filter({ hasText: "./build_tenants" }).first()).toHaveAttribute("aria-expanded", "true");

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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
  await expect(page.locator("nav.manager-nav")).toHaveCount(0);
  await expect(page.locator(".shell__control-card--status")).toHaveCount(0);

  await expect(async () => {
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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

test("sidecar process navigator N0 opens as a TypeScript-only object viewer tab", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openWorkspace(page, PROCESS_WORKSPACE);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const processCommand = page.getByRole("button", { name: "Open Process Navigator", exact: true });
  await expect(processCommand).toBeVisible();
  await processCommand.click();

  await expect(canvas.locator(".sidecar-viewer-tab.is-selected .sidecar-viewer-tab__kind")).toHaveText("process");
  const processPanel = canvas.locator(".sidecar-process-simple");
  await expect(processPanel).toBeVisible();
  await expect(processPanel).toContainText("ts-v1");
  await expect(processPanel.getByRole("tablist", { name: "Process navigator sections" }).getByRole("tab").first()).toBeVisible();
  await expect(processPanel.getByRole("tab", { name: /Runtime State/ })).toBeVisible();
  await expect(processPanel.getByRole("tab", { name: /Function Catalog/ })).toBeVisible();
  await expect(processPanel.getByRole("tab", { name: /Asset Nodes/ })).toBeVisible();
  await expect(processPanel.getByRole("region", { name: "Runtime State" })).toContainText("odd_sdlc runtime projection");
  await expect(processPanel).not.toContainText("Observed SDLC Surfaces");
  await expect(processPanel).not.toContainText("Recent Failures");
  await expect(processPanel).not.toContainText("Recent Activity");
  await expect(processPanel).not.toContainText("Tests / Qualification");
  const selectedRunDetail = processPanel.getByRole("region", { name: "Selected run detail" });
  await expect(selectedRunDetail).toBeVisible();
  await expect(selectedRunDetail.locator(".sidecar-live-view__run-header")).toContainText(/Started\s+\S/);
  await expect(processPanel.getByRole("region", { name: "active run and diagnostics row" })).toBeVisible();
  const selectedRunBeforeActiveRun = await processPanel.evaluate((root) => {
    const selected = root.querySelector('[aria-label="Selected run detail"]');
    const active = root.querySelector('[aria-label="active run and diagnostics row"]');
    return Boolean(selected && active && (selected.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(selectedRunBeforeActiveRun).toBe(true);

  await processPanel.getByRole("tab", { name: /Function Catalog/ }).click();
  await expect(processPanel).toContainText("derive_code_surface");
  await processPanel.getByRole("tab", { name: /Asset Nodes/ }).click();
  await expect(processPanel).toContainText("code_surface");

  await captureReviewShot(canvas, testInfo, "sidecar-process-navigator-ts-object-viewer");
  await openWorkspace(page, OBSERVED_WORKSPACE);
});

test("sidecar info browser splitter stays compact in canvas header", async ({ page }, testInfo) => {
  await page.goto("/");
  await waitForChrome(page);
  await openObservedWorkspace(page);

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Projects" }).click();
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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

  const canvas = page.getByRole("region", { name: "Sidecar canvas" });
  await canvas.locator(".sidecar-viewer-layout-toggle").getByRole("button", { name: "Add vertical viewer pane" }).click();
  const secondaryViewer = canvas.getByRole("region", { name: "Viewer group secondary" });
  await expect(secondaryViewer).toBeVisible();
  await secondaryViewer.click();
  await expect(secondaryViewer).toHaveAttribute("aria-selected", "true");

  await page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Projects" }).click();
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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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

  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });

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
