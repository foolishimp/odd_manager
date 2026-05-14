import { expect, test, type Locator, type Page } from "@playwright/test";

const MANAGER_WORKSPACE = "/Users/jim/src/apps/odd_manager";

async function waitForWorldProjection(page: Page) {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open workspace selector" })).toBeVisible();
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
  await waitForWorldProjection(page);
}

async function ensureExpanded(page: Page, expandButtonName: string, collapseButtonName: string) {
  const collapseButton = page.getByRole("button", { name: collapseButtonName });
  if (await collapseButton.count()) {
    return;
  }
  const expandButton = page.getByRole("button", { name: expandButtonName });
  await expect(expandButton).toBeVisible();
  await expandButton.click();
  await expect(collapseButton).toBeVisible();
}

async function oddtermSurface(page: Page) {
  await ensureExpanded(page, "Expand terminal workspace", "Collapse terminal workspace");
  const widget = page.locator("#terminal-workspace-widget");
  await expect(widget).toBeVisible();
  await expect(widget.getByRole("button", { name: "+ New Local Shell", exact: true })).toBeVisible();
  return widget;
}

async function oddchatSurface(page: Page) {
  await ensureExpanded(page, "Expand oddboard", "Collapse oddboard");
  const widget = page.locator("#agent-console-widget");
  await expect(widget).toBeVisible();
  await expect(widget.getByRole("tab", { name: "OddChat" })).toBeVisible();
  await page.getByRole("tab", { name: "OddChat" }).click();
  return widget;
}

function terminalPaneWithStatus(widget: Locator, status: string) {
  return widget
    .locator(".agent-console__terminal-shell")
    .filter({ hasText: status });
}

test("creates a live local shell and round-trips terminal input", async ({ page }) => {
  await page.goto("/");
  await waitForWorldProjection(page);
  await openWorkspace(page, MANAGER_WORKSPACE);

  const oddterm = await oddtermSurface(page);
  const createButton = oddterm.getByRole("button", { name: "+ New Local Shell", exact: true });
  await createButton.click();

  const connectedPane = terminalPaneWithStatus(oddterm, "connected").last();
  await expect(connectedPane).toBeVisible();

  const terminalHost = connectedPane.locator(".agent-console__terminal-host");
  const terminalInput = connectedPane.getByRole("textbox", { name: "Terminal input" });
  const marker = `oddterm-e2e-${Date.now()}`;
  await terminalHost.click();
  await expect(terminalInput).toBeFocused();
  await terminalInput.pressSequentially(`echo ${marker}`);
  await terminalInput.press("Enter");

  await expect(connectedPane.locator(".xterm-rows")).toContainText(marker);
  const sessionLabel = await connectedPane.locator(".agent-console__terminal-bar strong").innerText();

  page.once("dialog", (dialog) => dialog.accept());
  await connectedPane.getByRole("button", { name: "Close" }).click();
  await expect(oddterm.getByRole("tab", { name: new RegExp(sessionLabel) })).toHaveCount(0);
});

test("creates a topic and posts an operator room message", async ({ page }) => {
  await page.goto("/");
  await waitForWorldProjection(page);
  await openWorkspace(page, MANAGER_WORKSPACE);

  const oddchat = await oddchatSurface(page);
  const topicTitle = `oddchat-regression-${Date.now()}`;

  await oddchat.locator("#agent-console-topic-title").fill(topicTitle);
  await oddchat.getByRole("button", { name: "New Topic" }).click();

  const topicChip = oddchat.locator(".agent-console__topic-chip").filter({ hasText: topicTitle }).first();
  await expect(topicChip).toBeVisible();
  await topicChip.click();

  const message = `operator-room-message-${Date.now()}`;
  await oddchat.locator("#agent-console-draft").fill(message);
  await oddchat.getByRole("button", { name: "Send To Room" }).click();

  const messageCard = oddchat.locator(".agent-console__message").filter({ hasText: message }).first();
  await expect(messageCard).toBeVisible();
  await expect(messageCard).toContainText("Operator");
});
