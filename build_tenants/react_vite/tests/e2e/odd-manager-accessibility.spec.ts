import { expect, test, type Page } from "@playwright/test";

const projectRoot = process.env.ODD_MANAGER_E2E_PROJECT_ROOT ?? process.cwd();
const ODD_GLC_ROOT = "/Users/jim/src/apps/odd_glc";

async function activateProject(page: Page, root: string) {
  const response = await page.request.post("/api/projects/register", {
    data: { root, setActive: true },
  });
  expect(response.ok()).toBe(true);
}

function relativeLuminance([red, green, blue]: number[]) {
  const channels = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: number[], background: number[]) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

async function measuredContrast(page: Page, selector: string, backgroundSelector: string) {
  return page.evaluate(({ selector: foregroundSelector, backgroundSelector: background }) => {
    const toRgb = (value: string) => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) throw new Error(`Expected resolved RGB color, received ${value}`);
      return match.slice(1, 4).map(Number);
    };
    const foreground = document.querySelector<HTMLElement>(foregroundSelector);
    const backgroundElement = document.querySelector<HTMLElement>(background);
    if (!foreground || !backgroundElement) throw new Error(`Missing contrast target ${foregroundSelector} / ${background}`);
    return {
      foreground: toRgb(getComputedStyle(foreground).color),
      background: toRgb(getComputedStyle(backgroundElement).backgroundColor),
    };
  }, { selector, backgroundSelector });
}

test("developer control and workbench tabs provide keyboard parity and named panels", async ({ page }) => {
  const registration = await page.request.post("/api/projects/register", {
    data: { root: projectRoot, setActive: true },
  });
  expect(registration.ok()).toBe(true);
  await page.goto(`/?project=${encodeURIComponent(projectRoot)}`);

  const surfaceTabs = page.getByRole("tablist", { name: "Developer control surfaces" });
  const workbenchTab = surfaceTabs.getByRole("tab", { name: "Workbench" });
  await expect(workbenchTab).toHaveAttribute("aria-selected", "true");
  await expect(workbenchTab).toHaveAttribute("tabindex", "0");
  await workbenchTab.focus();
  await page.keyboard.press("ArrowRight");

  const aiWorkspaceTab = surfaceTabs.getByRole("tab", { name: "AI Workspace" });
  await expect(aiWorkspaceTab).toBeFocused();
  await expect(aiWorkspaceTab).toHaveAttribute("aria-selected", "true");
  const aiWorkspacePanel = page.getByRole("tabpanel", { name: "AI Workspace" });
  await expect(aiWorkspacePanel).toBeVisible();

  await page.keyboard.press("Home");
  await expect(workbenchTab).toBeFocused();
  await expect(workbenchTab).toHaveAttribute("aria-selected", "true");

  const phaseTabs = page.getByRole("tablist", { name: "Review, Tune, Build, Assure" });
  const reviewTab = phaseTabs.getByRole("tab", { name: /Review/ });
  await expect(reviewTab).toHaveAttribute("aria-selected", "true");
  await reviewTab.focus();
  await page.keyboard.press("ArrowRight");

  const tuneTab = phaseTabs.getByRole("tab", { name: /Tune/ });
  await expect(tuneTab).toBeFocused();
  await expect(tuneTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /Tune/ })).toBeVisible();

  await page.keyboard.press("End");
  const assureTab = phaseTabs.getByRole("tab", { name: /Assure/ });
  await expect(assureTab).toBeFocused();
  await expect(assureTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: /Assure/ })).toBeVisible();
});

test("developer-control status, custom tabs, and representative text/control tokens meet keyboard and AA expectations", async ({ page }) => {
  await activateProject(page, projectRoot);
  await page.goto(`/?project=${encodeURIComponent(projectRoot)}`);

  const host = page.getByRole("region", { name: "Developer control host" });
  await expect(host).toBeVisible();
  const status = host.getByRole("status");
  await expect(status).toHaveText("Context admitted");
  await expect(status).toHaveAttribute("aria-live", "polite");

  const surfaces = page.getByRole("tablist", { name: "Developer control surfaces" });
  const workbench = surfaces.getByRole("tab", { name: "Workbench" });
  const aiWorkspace = surfaces.getByRole("tab", { name: "AI Workspace" });
  await workbench.focus();
  await page.keyboard.press("ArrowRight");
  await expect(aiWorkspace).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "AI Workspace" })).toBeVisible();
  await page.keyboard.press("Home");
  await expect(workbench).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Workbench" })).toBeVisible();

  const text = await measuredContrast(page, ".project-workbench__identity h1", ".project-workbench");
  const activeControl = await measuredContrast(page, ".project-workbench__phases button.is-active", ".project-workbench__phases button.is-active");
  expect(contrastRatio(text.foreground, text.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(activeControl.foreground, activeControl.background)).toBeGreaterThanOrEqual(4.5);
});

test("forensic Run Inspector and terminal controls retain named navigation and fit at 390px", async ({ page }) => {
  await activateProject(page, ODD_GLC_ROOT);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}&view=run-inspector&execution=accessibility-run&revision=accessibility-revision&source=proof%3A%2F%2Faccessibility`);

  const runSelect = page.getByRole("combobox", { name: "Select observed run" });
  await expect(runSelect).toBeVisible({ timeout: 30_000 });
  const currentRust = runSelect.locator("option").filter({ hasText: "SCN-GLC-HELLO-WORLD-RUST-CLI" }).first();
  await expect(currentRust).toHaveCount(1);
  const runValue = await currentRust.getAttribute("value");
  if (!runValue) throw new Error("current Rust Hello World run option has no value");
  await runSelect.selectOption(runValue);

  const forensic = page.getByRole("region", { name: "Build forensic context" });
  await expect(forensic).toBeVisible({ timeout: 30_000 });
  const runSections = page.getByRole("navigation", { name: "Run observation sections" });
  await runSections.getByRole("button", { name: "Graph", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Functions", exact: true })).toBeFocused();

  const terminalDock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await expect(terminalDock).toBeVisible();
  const terminalToggle = terminalDock.getByRole("button", { name: "Terminal" });
  await expect(terminalToggle).toHaveAttribute("aria-controls", "sidecar-terminal-workspace");
  await terminalToggle.click();
  await expect(terminalDock.getByRole("combobox", { name: "Select Sidecar shell session" })).toBeVisible();
  await expect(terminalDock.getByRole("button", { name: "Refresh" })).toBeVisible();

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    hostWidth: document.querySelector(".developer-control-host")?.scrollWidth ?? 0,
    hostClientWidth: document.querySelector(".developer-control-host")?.clientWidth ?? 0,
    forensicWidth: document.querySelector(".sidecar-run__forensic-focus")?.scrollWidth ?? 0,
    forensicClientWidth: document.querySelector(".sidecar-run__forensic-focus")?.clientWidth ?? 0,
  }));
  expect(layout.bodyWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.hostWidth).toBeLessThanOrEqual(layout.hostClientWidth);
  expect(layout.forensicWidth).toBeLessThanOrEqual(layout.forensicClientWidth);
});
