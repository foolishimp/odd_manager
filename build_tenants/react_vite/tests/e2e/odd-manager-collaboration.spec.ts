import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

let collaborationWorkspace = "";

test.beforeAll(() => {
  const fixtureParent = join(process.cwd(), "tests", "artifacts", "fixtures");
  mkdirSync(fixtureParent, { recursive: true });
  collaborationWorkspace = mkdtempSync(join(fixtureParent, "odd-manager-collaboration-e2e-"));
  mkdirSync(join(collaborationWorkspace, "specification"), { recursive: true });
  mkdirSync(join(collaborationWorkspace, ".ai-workspace"), { recursive: true });
  writeFileSync(join(collaborationWorkspace, "specification", "PRODUCT.md"), "# collaboration_fixture Product\n", "utf8");
});

test.afterAll(() => {
  rmSync(collaborationWorkspace, { recursive: true, force: true });
});

async function waitForWorldProjection(page: Page) {
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("region", { name: "Developer control host" })).toBeVisible();
  if (!(await page.getByRole("region", { name: "Sidecar canvas" }).isVisible().catch(() => false))) {
    await page.getByRole("navigation", { name: "Developer control surfaces" })
      .getByRole("tab", { name: "AI Workspace" })
      .click();
  }
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible();
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
  await page.goto(`/?project=${encodeURIComponent(workspaceRoot)}`);
  await waitForWorldProjection(page);
}

async function oddtermSurface(page: Page) {
  const dock = page.getByRole("region", { name: "Sidecar terminal dock" });
  await expect(dock).toBeVisible();
  if (!(await dock.locator(".sidecar-terminal-toolbar").count())) {
    await dock.getByRole("button", { name: "Terminal", exact: true }).click();
  }
  await expect(dock.getByRole("button", { name: "+ Spawn", exact: true })).toBeVisible();
  return dock;
}

test("creates a live local shell and round-trips terminal input", async ({ page }) => {
  await page.goto("/");
  await waitForWorldProjection(page);
  await openWorkspace(page, collaborationWorkspace);
  await expect(page.locator(".sidecar-navigator-error")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Sidecar selection flyout" })).toContainText("Folder is not present in this Project.");

  const oddterm = await oddtermSurface(page);
  const createButton = oddterm.getByRole("button", { name: "+ Spawn", exact: true });
  await createButton.click();

  await expect(oddterm.locator(".sidecar-terminal-toolbar__context")).toContainText("connected");
  const connectedPane = oddterm.locator(".sidecar-session-window.is-active");
  await expect(connectedPane).toBeVisible();

  const terminalHost = connectedPane.locator(".agent-console__terminal-host");
  const terminalInput = connectedPane.getByRole("textbox", { name: "Terminal input" });
  const marker = `oddterm-e2e-${Date.now()}`;
  const sessionId = await oddterm.locator(".sidecar-shell-session-select").inputValue();
  await page.evaluate(({ workspaceRoot, id }) => {
    const probe = new WebSocket(`${location.origin.replace(/^http/, "ws")}/api/oddterm?workspaceRoot=${encodeURIComponent(workspaceRoot)}&sessionId=${encodeURIComponent(id)}`);
    (window as Window & { __oddtermProbe?: WebSocket; __oddtermOutput?: string }).__oddtermProbe = probe;
    (window as Window & { __oddtermOutput?: string }).__oddtermOutput = "";
    probe.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type === "data") {
          const target = window as Window & { __oddtermOutput?: string };
          target.__oddtermOutput = `${target.__oddtermOutput ?? ""}${payload.data}`;
        }
      } catch {
        // The production client also ignores non-JSON terminal frames.
      }
    });
  }, { workspaceRoot: collaborationWorkspace, id: sessionId });
  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __oddtermProbe?: WebSocket }).__oddtermProbe?.readyState
  ))).toBe(1);
  await terminalHost.click();
  await expect(terminalInput).toBeFocused();
  await terminalInput.pressSequentially(`echo ${marker}`);
  await terminalInput.press("Enter");

  await expect.poll(() => page.evaluate(() => (
    (window as Window & { __oddtermOutput?: string }).__oddtermOutput ?? ""
  ))).toContain(marker);
  await page.evaluate(() => (window as Window & { __oddtermProbe?: WebSocket }).__oddtermProbe?.close());
  await oddterm.locator(".sidecar-terminal-toolbar__context").getByRole("button", { name: "Close", exact: true }).click();
  await expect(oddterm.locator(".sidecar-terminal-toolbar__context")).toContainText("no shell");
});

test("creates a topic and posts an operator room message through the live collaboration API", async ({ page }) => {
  await page.goto("/");
  await waitForWorldProjection(page);
  await openWorkspace(page, collaborationWorkspace);
  const topicTitle = `oddchat-regression-${Date.now()}`;
  const message = `operator-room-message-${Date.now()}`;
  const result = await page.evaluate(async ({ workspaceRoot, title, body }) => {
    const topicResponse = await fetch("/api/oddchat/topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceRoot, title }),
    });
    const topicPayload = await topicResponse.json();
    const messageResponse = await fetch("/api/odd-console/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceRoot, roomId: topicPayload.topic.roomId, body }),
    });
    const messagePayload = await messageResponse.json();
    const stateResponse = await fetch(`/api/odd-console?workspaceRoot=${encodeURIComponent(workspaceRoot)}`);
    const state = await stateResponse.json();
    return { topicStatus: topicResponse.status, messageStatus: messageResponse.status, topicPayload, messagePayload, state };
  }, { workspaceRoot: collaborationWorkspace, title: topicTitle, body: message });

  expect(result.topicStatus).toBe(200);
  expect(result.messageStatus).toBe(200);
  expect(result.topicPayload.ok).toBe(true);
  expect(result.messagePayload.ok).toBe(true);
  expect(result.state.oddchat.topics.some((topic: { label: string }) => topic.label === topicTitle)).toBe(true);
  expect(result.state.oddchat.messages.some((entry: { content: string; senderLabel: string }) => entry.content === message && entry.senderLabel === "Operator")).toBe(true);
});
