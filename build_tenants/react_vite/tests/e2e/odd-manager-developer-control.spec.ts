import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const ODD_GLC_ROOT = "/Users/jim/src/apps/odd_glc";
const MANAGER_ROOT = "/Users/jim/src/apps/odd_manager";
const PORTFOLIO_FIXTURE_ROOT = join(process.cwd(), "tests", "artifacts", "fixtures");

function buildDescriptor(productId: string) {
  return {
    schemaVersion: "1",
    descriptorRef: `build-carrier-descriptor://${productId}/software-build`,
    productRef: `product://${productId}`,
    productVersion: "0.0.1-fixture",
    carrierKind: "graph_function",
    carrierRef: `graph-function://${productId}/software-build`,
    startupConfigRef: `startup-config://${productId}/software-build`,
    publicStartTarget: `start-target://${productId}/software-build`,
    inputSchemaRef: "schema://odd_manager/fixture-build-input/v1",
    worksiteProvisionerRef: "worksite-provisioner://odd_manager/project-snapshot/v1",
    executionAdapterRef: "execution-adapter://odd_manager/fixture/v1",
    supportedCommands: ["submit", "attach", "cancel"],
    requirementCatalogRefs: [`requirements://${productId}/software-build`],
    expectedAssetCatalogRefs: [`assets://${productId}/software-build`],
    proofRefs: [`proof://${productId}/carrier-fixture`],
  };
}

function assuranceCatalog(productId: string) {
  const reactions = ["reaction://odd_manager/open-run-inspector"];
  return {
    schemaVersion: "1",
    catalogRef: `assurance-catalog://${productId}/software-build`,
    productRef: `product://${productId}`,
    requirementCatalogRef: `requirements://${productId}/software-build`,
    assetCatalogRef: `assets://${productId}/software-build`,
    gates: [
      {
        gateRef: "gate://fixture/tests",
        label: "Deterministic test gate",
        requirementRef: "requirement://fixture/tests",
        regime: "F_D",
        evidenceKey: "tests",
        reactionRefs: reactions,
        sourceRefs: [`requirements://${productId}/tests`],
      },
      {
        gateRef: "gate://fixture/depth",
        label: "Deterministic depth gate",
        requirementRef: "requirement://fixture/depth",
        regime: "F_D",
        evidenceKey: "depth",
        reactionRefs: reactions,
        sourceRefs: [`requirements://${productId}/depth`],
      },
      {
        gateRef: "gate://fixture/human-review",
        label: "Human review gate",
        requirementRef: "requirement://fixture/human-review",
        regime: "F_H",
        evidenceKey: "human-review",
        reactionRefs: reactions,
        sourceRefs: [`requirements://${productId}/human-review`],
      },
    ],
    assets: [{
      requirementRef: "requirement://fixture/software-package",
      label: "Software package",
      evidenceKey: "software-package",
      reactionRefs: reactions,
      sourceRefs: [`assets://${productId}/software-package`],
    }],
    sourceRefs: [".odd/assurance-catalog.json"],
  };
}

function createBuildProjectFixture(productId: string) {
  mkdirSync(PORTFOLIO_FIXTURE_ROOT, { recursive: true });
  const projectRoot = mkdtempSync(join(PORTFOLIO_FIXTURE_ROOT, `${productId}-project-`));
  mkdirSync(join(projectRoot, ".ai-workspace"), { recursive: true });
  mkdirSync(join(projectRoot, ".odd"), { recursive: true });
  mkdirSync(join(projectRoot, "specification"), { recursive: true });
  writeFileSync(join(projectRoot, "specification", "PRODUCT.md"), `# ${productId} Product\n`, "utf8");
  writeFileSync(join(projectRoot, "source.txt"), `${productId} immutable fixture source\n`, "utf8");
  writeFileSync(
    join(projectRoot, ".odd", "build-carrier.json"),
    `${JSON.stringify(buildDescriptor(productId), null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(projectRoot, ".odd", "assurance-catalog.json"),
    `${JSON.stringify(assuranceCatalog(productId), null, 2)}\n`,
    "utf8",
  );
  execFileSync("git", ["init", "--quiet", projectRoot]);
  execFileSync("git", ["-C", projectRoot, "add", "."]);
  execFileSync("git", [
    "-C", projectRoot,
    "-c", "user.name=Odd Manager E2E",
    "-c", "user.email=odd-manager@example.invalid",
    "commit", "--quiet", "-m", "fixture",
  ]);
  return projectRoot;
}

async function registerProject(page: Page, projectRoot: string) {
  const responseOk = await page.evaluate(async (root) => {
    const response = await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, setActive: false }),
    });
    return response.ok;
  }, projectRoot);
  expect(responseOk).toBe(true);
}

async function activateProject(page: Page, projectRoot: string) {
  const responseOk = await page.evaluate(async (root) => {
    const response = await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, setActive: true }),
    });
    return response.ok;
  }, projectRoot);
  expect(responseOk).toBe(true);
}

test("project-only deep link opens the modular developer Project Workbench", async ({ page }, testInfo) => {
  await page.goto("/");
  await activateProject(page, ODD_GLC_ROOT);
  await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);

  const host = page.getByRole("region", { name: "Developer control host" });
  const workbench = page.getByRole("region", { name: "Project Workbench" });
  await expect(host).toBeVisible();
  await expect(workbench).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Context admitted");
  await expect(workbench).toContainText(ODD_GLC_ROOT);
  await expect(workbench.getByRole("tab", { name: "Review" })).toHaveAttribute("aria-selected", "true");
  await expect(workbench.getByRole("heading", { name: "Build Portfolio" })).toBeVisible();
  await expect.poll(async () => workbench.locator(".build-portfolio__table tbody tr").count()).toBeGreaterThan(1);
  await expect(workbench.locator(".project-workbench__identity .capability-availability")).toHaveCount(0);
  await expect(workbench.locator(".project-workbench__ledger")).toHaveCount(0);
  await expect(workbench.getByRole("tab", { name: /Review/ }).locator(".capability-availability__state")).toHaveText("available");
  await expect(workbench.getByRole("tab", { name: /Tune/ }).locator(".capability-availability__state")).toHaveText("available");
  await expect(workbench.getByRole("tab", { name: /Build/ }).locator(".capability-availability__state")).toHaveText("unavailable");
  await expect(workbench.getByRole("tab", { name: /Build/ }).locator(".capability-availability__state"))
    .toHaveAttribute("title", /does not publish \.odd\/build-carrier\.json/);
  await expect(workbench.getByRole("tab", { name: /Assure/ }).locator(".capability-availability__state")).toHaveText("unavailable");
  expect(new URL(page.url()).searchParams.get("view")).toBeNull();
  await page.screenshot({ path: testInfo.outputPath("developer-control-workbench.png"), fullPage: true });

  await page.getByRole("navigation", { name: "Developer control surfaces" })
    .getByRole("tab", { name: "AI Workspace" })
    .click();
  await expect(page.locator("nav.sidecar-activity-rail").getByRole("button", { name: "Projects" })).toHaveCount(0);
});

test("portfolio attention names and opens its admitted Tune, Build, or Assure target", async ({ page }, testInfo) => {
  await page.goto("/");
  await activateProject(page, ODD_GLC_ROOT);
  await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);

  const workbench = page.getByRole("region", { name: "Project Workbench" });
  const selectedProject = workbench.getByRole("region", { name: "Selected portfolio Project" });
  await expect(selectedProject).toBeVisible();

  const tuneAction = selectedProject
    .locator('button[data-target-capability="specification-proposal"]')
    .filter({ hasText: "dirty worktree" });
  const tuneSourceRef = await tuneAction.getAttribute("title");
  expect(tuneSourceRef).toBeTruthy();
  await expect(tuneAction.locator("small")).toHaveText("Open Tune");
  await tuneAction.click();
  await expect(workbench.getByRole("tab", { name: /^Tune/ })).toHaveAttribute("aria-selected", "true");
  await expect(workbench.getByRole("heading", { name: "Specification Proposal" })).toBeVisible();
  await expect(workbench.getByRole("list", { name: "Attached proposal context" }))
    .toContainText(tuneSourceRef as string);

  await workbench.getByRole("tab", { name: /^Review/ }).click();
  const buildAction = selectedProject
    .locator('button[data-target-capability="build-control"]')
    .filter({ hasText: "does not publish" });
  await expect(buildAction.locator("small")).toHaveText("Open Build");
  await buildAction.click();
  await expect(workbench.getByRole("tab", { name: /^Build/ })).toHaveAttribute("aria-selected", "true");
  await expect(workbench.getByRole("heading", { name: "Build Control" })).toBeVisible();

  await workbench.getByRole("tab", { name: /^Review/ }).click();
  const assureAction = selectedProject
    .locator('button[data-target-capability="assurance-attention"]')
    .filter({ hasText: "Assurance requires" });
  await expect(assureAction.locator("small")).toHaveText("Open Assure");
  await assureAction.click();
  await expect(workbench.getByRole("tab", { name: /^Assure/ })).toHaveAttribute("aria-selected", "true");
  await expect(workbench.getByRole("heading", { name: "Assurance & Attention" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("portfolio-attention-target.png"), fullPage: true });
});

test("Build Portfolio refreshes, registers, inspects, and removes a discovered Project", async ({ page }) => {
  mkdirSync(PORTFOLIO_FIXTURE_ROOT, { recursive: true });
  const projectRoot = mkdtempSync(join(PORTFOLIO_FIXTURE_ROOT, "portfolio-project-"));
  const projectName = basename(projectRoot);
  mkdirSync(join(projectRoot, ".ai-workspace"), { recursive: true });

  try {
    await page.goto("/");
    await activateProject(page, ODD_GLC_ROOT);
    await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);

    const workbench = page.getByRole("region", { name: "Project Workbench" });
    const portfolio = workbench.locator(".build-portfolio");
    await expect(portfolio.getByRole("heading", { name: "Build Portfolio" })).toBeVisible();
    await portfolio.getByRole("button", { name: "Add Project", exact: true }).click();

    const browser = portfolio.getByRole("region", { name: "Add Project browser" });
    await expect(browser).toBeVisible();
    const browserRefresh = browser.getByRole("button", { name: "Refresh", exact: true });
    await expect(browserRefresh).toBeEnabled();
    await browserRefresh.click();
    const directoryRow = browser.locator(".build-portfolio__directory-row").filter({ hasText: projectName });
    await expect(directoryRow).toContainText("Project");
    await directoryRow.getByRole("button", { name: "Register" }).click();

    const portfolioRow = portfolio.locator(".build-portfolio__table tbody tr").filter({ hasText: projectName });
    await expect(portfolioRow).toBeVisible({ timeout: 30_000 });
    await portfolioRow.locator(".build-portfolio__project-select").click();
    await expect(portfolio.getByRole("region", { name: "Selected portfolio Project" })).toContainText(projectRoot);
    await portfolioRow.getByRole("button", { name: "Remove" }).click();
    await expect(portfolioRow).toHaveCount(0);
  } finally {
    await page.evaluate(async (root) => {
      await fetch("/api/projects/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root }),
      }).catch(() => undefined);
    }, projectRoot).catch(() => undefined);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("Build Portfolio activation changes Context without a Sidecar Project Browser", async ({ page }) => {
  await page.goto("/");
  await activateProject(page, MANAGER_ROOT);
  await activateProject(page, ODD_GLC_ROOT);
  await activateProject(page, MANAGER_ROOT);
  await page.goto(`/?project=${encodeURIComponent(MANAGER_ROOT)}`);

  const workbench = page.getByRole("region", { name: "Project Workbench" });
  const targetRow = workbench.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://odd_glc" });
  await expect(targetRow).toBeVisible({ timeout: 30_000 });
  await targetRow.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("banner")).toContainText(ODD_GLC_ROOT);
  await expect(page.getByRole("region", { name: "Project Workbench" })).toContainText(ODD_GLC_ROOT);
  expect(new URL(page.url()).searchParams.get("project")).toBe(ODD_GLC_ROOT);

  await page.getByRole("navigation", { name: "Developer control surfaces" })
    .getByRole("tab", { name: "AI Workspace" })
    .click();
  const activityRail = page.locator("nav.sidecar-activity-rail");
  await expect(activityRail.getByRole("button", { name: "Projects" })).toHaveCount(0);
  await expect(activityRail.getByRole("button", { name: "Browse" })).toBeVisible();
});

test("Specification Proposal generates, refines, validates, accepts, rejects, and preserves lineage", async ({ page }, testInfo) => {
  mkdirSync(PORTFOLIO_FIXTURE_ROOT, { recursive: true });
  const projectRoot = mkdtempSync(join(PORTFOLIO_FIXTURE_ROOT, "proposal-project-"));
  mkdirSync(join(projectRoot, ".ai-workspace"), { recursive: true });
  mkdirSync(join(projectRoot, "specification"), { recursive: true });
  writeFileSync(
    join(projectRoot, "specification", "PRODUCT.md"),
    "# Proposal Fixture\n\n## Product Identity\n\nA governed fixture.\n",
    "utf8",
  );
  writeFileSync(
    join(projectRoot, "specification", "INTENT.md"),
    "# Intent\n\nKeep proposal truth isolated.\n",
    "utf8",
  );
  execFileSync("git", ["init", "--quiet", projectRoot]);
  execFileSync("git", ["-C", projectRoot, "add", "specification"]);
  execFileSync("git", [
    "-C", projectRoot,
    "-c", "user.name=Odd Manager E2E",
    "-c", "user.email=odd-manager@example.invalid",
    "commit", "--quiet", "-m", "fixture",
  ]);

  try {
    await page.goto("/");
    await activateProject(page, projectRoot);
    await page.goto(`/?project=${encodeURIComponent(projectRoot)}`);

    const workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Tune" }).click();
    const proposal = workbench.locator(".specification-proposal");
    await expect(proposal.getByRole("heading", { name: "Specification Proposal" })).toBeVisible();
    await expect(proposal).toContainText("participant://fixture/specification-proposal");

    await proposal.getByLabel("Context reference").fill("specification/INTENT.md");
    await proposal.getByRole("button", { name: "Attach" }).click();
    await proposal.getByLabel("Proposal request").fill("Make the product boundary explicit.");
    const before = readFileSync(join(projectRoot, "specification", "PRODUCT.md"), "utf8");
    await proposal.getByRole("button", { name: "Generate Proposal" }).click();
    await expect(proposal.getByRole("heading", { name: /Proposed Change for/ })).toBeVisible();
    await expect(proposal.getByRole("region", { name: /Diff for specification\/PRODUCT.md/ })).toBeVisible();
    expect(readFileSync(join(projectRoot, "specification", "PRODUCT.md"), "utf8")).toBe(before);

    await proposal.getByLabel("Refinement request").fill("State the constraint as constitutional product truth.");
    await proposal.getByRole("button", { name: "Refine Proposal" }).click();
    await expect(proposal.getByRole("heading", { name: /Refined Proposal for/ })).toBeVisible();
    await expect(proposal.locator(".specification-proposal__facts")).not.toContainText("PredecessorNone");

    await proposal.getByRole("button", { name: "Validate" }).click();
    const validation = proposal.locator(".specification-proposal__validation");
    await expect(validation.getByText("Passed", { exact: true })).toHaveCount(4);
    await expect(proposal.getByRole("button", { name: "Accept" })).toBeEnabled();

    writeFileSync(
      join(projectRoot, "specification", "INTENT.md"),
      "# Intent\n\nKeep proposal truth isolated.\n\nThe authority basis changed before acceptance.\n",
      "utf8",
    );
    await proposal.getByRole("button", { name: "Accept" }).click();
    await expect(proposal.getByRole("button", { name: "Regenerate on Current Revision" })).toBeVisible({ timeout: 15_000 });
    await expect(proposal.getByRole("button", { name: "Accept" })).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("specification-proposal-stale.png"), fullPage: true });
    await proposal.getByRole("button", { name: "Regenerate on Current Revision" }).click();
    await expect(proposal.getByRole("heading", { name: /Refined Proposal for/ })).toBeVisible();
    await expect(proposal.locator(".specification-proposal__facts")).not.toContainText("PredecessorNone");
    await proposal.getByRole("button", { name: "Validate" }).click();
    await expect(validation.getByText("Passed", { exact: true })).toHaveCount(4);
    await page.screenshot({ path: testInfo.outputPath("specification-proposal-valid.png"), fullPage: true });

    const staleHistory = proposal.locator(".specification-proposal__history li").filter({ hasText: "Stale" });
    await expect(staleHistory).toHaveCount(1);
    await staleHistory.getByRole("button").click();
    await proposal.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(proposal.locator(".specification-proposal__summary")).toContainText("Rejected");
    const validReplacement = proposal.locator(".specification-proposal__history li").filter({ hasText: "Valid" });
    await expect(validReplacement).toHaveCount(1);
    await validReplacement.getByRole("button").click();
    await proposal.getByRole("button", { name: "Accept" }).click();
    await expect(proposal.locator(".specification-proposal__summary")).toContainText("Accepted");
    await expect(proposal.locator(".specification-proposal__result")).toContainText("Resulting revision");
    const accepted = readFileSync(join(projectRoot, "specification", "PRODUCT.md"), "utf8");
    expect(accepted).toContain("State the constraint as constitutional product truth.");

    await proposal.getByLabel("Proposal request").fill("Create a candidate that will be rejected.");
    await proposal.getByRole("button", { name: "Generate Proposal" }).click();
    await expect(proposal.getByRole("heading", { name: /Proposed Change for/ })).toBeVisible();
    await proposal.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(proposal.locator(".specification-proposal__summary")).toContainText("Rejected");
    expect(readFileSync(join(projectRoot, "specification", "PRODUCT.md"), "utf8")).toBe(accepted);
    await expect(proposal.locator(".specification-proposal__history li")).toHaveCount(4);

    await page.setViewportSize({ width: 390, height: 844 });
    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      proposalWidth: document.querySelector(".specification-proposal")?.scrollWidth ?? 0,
      proposalClientWidth: document.querySelector(".specification-proposal")?.clientWidth ?? 0,
    }));
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.proposalWidth).toBeLessThanOrEqual(metrics.proposalClientWidth);
    await page.screenshot({ path: testInfo.outputPath("specification-proposal-mobile.png"), fullPage: true });
  } finally {
    await page.evaluate(async (root) => {
      await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "/Users/jim/src/apps/odd_glc", registerIfMissing: true }),
      }).catch(() => undefined);
      await fetch("/api/projects/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root }),
      }).catch(() => undefined);
    }, projectRoot).catch(() => undefined);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("Build remains visibly unavailable without a lawful carrier", async ({ page }) => {
  await page.goto("/");
  await activateProject(page, ODD_GLC_ROOT);
  await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);

  const workbench = page.getByRole("region", { name: "Project Workbench" });
  await expect(workbench).toBeVisible();

  const selectedProject = workbench.getByRole("region", { name: "Selected portfolio Project" });
  const carrierAttention = selectedProject.locator("button").filter({
    hasText: "Project does not publish .odd/build-carrier.json.",
  });
  await expect(carrierAttention).toBeVisible();
  await carrierAttention.click();
  await expect(workbench.getByRole("tab", { name: "Build" })).toHaveAttribute("aria-selected", "true");
  const build = workbench.locator(".developer-capability").filter({ hasText: "Build Control" });
  await expect(build).toContainText("Project does not publish .odd/build-carrier.json.");
  await expect(build).toContainText("Shell fallback");
  await expect(build).toContainText("Prohibited");
  await expect(build.getByRole("button", { name: "Submit Build" })).toHaveCount(0);
  await expect(build.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("Build Control submits, supervises, attaches, converges, and cancels real fixture processes", async ({ page }, testInfo) => {
  const productId = "build_fixture";
  const projectRoot = createBuildProjectFixture(productId);

  try {
    await page.goto("/");
    await activateProject(page, projectRoot);
    await page.goto(`/?project=${encodeURIComponent(projectRoot)}`);
    const workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    const build = workbench.locator(".build-control");
    await expect(build.getByRole("heading", { name: "Build Control" })).toBeVisible();
    await expect(build.locator('[data-availability="ready"]')).toBeVisible();
    await expect(build.getByRole("region", { name: "Build carrier admission" })).toContainText(
      `graph-function://${productId}/software-build`,
    );

    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 700,
      outcome: "converged",
      label: "browser-converged",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    const detail = build.locator(".build-control__detail");
    await expect(detail.getByRole("heading", { name: "converged" })).toBeVisible({ timeout: 15_000 });
    await expect(detail).toContainText("typed_result");
    await expect(detail).toContainText("run://fixture/browser-converged");
    await expect(detail).toContainText("Not established");
    await expect(build.getByRole("region", { name: "Build output" })).toContainText("fixture build converged");
    await page.screenshot({ path: testInfo.outputPath("build-control-converged.png"), fullPage: true });

    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 5_000,
      outcome: "converged",
      label: "browser-cancelled",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(detail.getByRole("heading", { name: "running" })).toBeVisible({ timeout: 10_000 });
    await build.getByRole("button", { name: "Cancel" }).click();
    await expect(detail.getByRole("heading", { name: "cancelled" })).toBeVisible({ timeout: 10_000 });
    await expect(detail).toContainText("cancelled");

    await page.setViewportSize({ width: 390, height: 844 });
    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      buildWidth: document.querySelector(".build-control")?.scrollWidth ?? 0,
      buildClientWidth: document.querySelector(".build-control")?.clientWidth ?? 0,
    }));
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.buildWidth).toBeLessThanOrEqual(metrics.buildClientWidth);
    await detail.scrollIntoViewIfNeeded();
    await expect(detail.getByRole("heading", { name: "cancelled" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("build-control-mobile.png"), fullPage: true });
  } finally {
    await page.evaluate(async (root) => {
      await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "/Users/jim/src/apps/odd_glc", registerIfMissing: true }),
      }).catch(() => undefined);
      await fetch("/api/projects/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root }),
      }).catch(() => undefined);
    }, projectRoot).catch(() => undefined);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated", async ({ page }, testInfo) => {
  const alphaRoot = createBuildProjectFixture("concurrent_alpha");
  const betaRoot = createBuildProjectFixture("concurrent_beta");
  try {
    await page.goto("/");
    await activateProject(page, alphaRoot);
    await registerProject(page, betaRoot);
    await page.goto(`/?project=${encodeURIComponent(alphaRoot)}`);

    let workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    let build = workbench.locator(".build-control");
    await expect(build.locator('[data-availability="ready"]')).toBeVisible();
    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 12_000,
      outcome: "converged",
      label: "concurrent-alpha",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.locator(".build-control__detail").getByRole("heading", { name: "running" })).toBeVisible();

    await workbench.getByRole("tab", { name: "Review" }).click();
    let portfolio = workbench.locator(".build-portfolio");
    await portfolio.getByRole("button", { name: "Refresh", exact: true }).click();
    const betaRow = portfolio.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://concurrent_beta" });
    await expect(betaRow).toBeVisible();
    await betaRow.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("region", { name: "Project Workbench" })).toContainText(betaRoot);

    workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    build = workbench.locator(".build-control");
    await expect(build.locator('[data-availability="ready"]')).toBeVisible();
    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 15_000,
      outcome: "failed",
      label: "concurrent-beta",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.locator(".build-control__detail").getByRole("heading", { name: "running" })).toBeVisible();
    const runningMetric = build.getByRole("region", { name: "Build scheduler" }).locator("div").filter({ hasText: "Running" }).first();
    await expect(runningMetric.locator("strong")).toHaveText("2");
    await page.screenshot({ path: testInfo.outputPath("concurrent-build-control.png"), fullPage: true });

    await workbench.getByRole("tab", { name: "Review" }).click();
    portfolio = workbench.locator(".build-portfolio");
    await portfolio.getByRole("button", { name: "Refresh", exact: true }).click();
    const alphaRow = portfolio.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://concurrent_alpha" });
    await expect(alphaRow).toContainText("running");
    await alphaRow.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("region", { name: "Project Workbench" })).toContainText(alphaRoot);

    workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    build = workbench.locator(".build-control");
    const alphaDetail = build.locator(".build-control__detail");
    await expect(alphaDetail.getByRole("heading", { name: "converged" })).toBeVisible({ timeout: 15_000 });
    await expect(alphaDetail).toContainText("run://fixture/concurrent-alpha");
    await expect(build.getByRole("region", { name: "Build output" })).not.toContainText("concurrent-beta");

    await workbench.getByRole("tab", { name: "Review" }).click();
    portfolio = workbench.locator(".build-portfolio");
    const betaTerminalRow = portfolio.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://concurrent_beta" });
    await betaTerminalRow.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("region", { name: "Project Workbench" })).toContainText(betaRoot);
    workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    build = workbench.locator(".build-control");
    const betaDetail = build.locator(".build-control__detail");
    await expect(betaDetail.getByRole("heading", { name: "failed" })).toBeVisible({ timeout: 15_000 });
    await expect(betaDetail).toContainText("run://fixture/concurrent-beta");
    await expect(build.getByRole("region", { name: "Build output" })).not.toContainText("concurrent-alpha");
  } finally {
    await page.evaluate(async (roots) => {
      await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "/Users/jim/src/apps/odd_glc", registerIfMissing: true }),
      }).catch(() => undefined);
      for (const root of roots) {
        await fetch("/api/projects/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root }),
        }).catch(() => undefined);
      }
    }, [alphaRoot, betaRoot]).catch(() => undefined);
    rmSync(alphaRoot, { recursive: true, force: true });
    rmSync(betaRoot, { recursive: true, force: true });
  }
});

test("Assurance derives missing, verified, and stale posture from catalog and evidence rather than process exit", async ({ page }, testInfo) => {
  const projectRoot = createBuildProjectFixture("assurance_browser");
  try {
    await page.goto("/");
    await activateProject(page, projectRoot);
    await page.goto(`/?project=${encodeURIComponent(projectRoot)}`);
    const workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    const build = workbench.locator(".build-control");
    const buildDetail = build.locator(".build-control__detail");

    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 500,
      outcome: "converged",
      label: "assurance-missing",
      assuranceProfile: "none",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.getByRole("region", { name: "Build output" })).toContainText(
      "[assurance-missing] fixture build converged",
      { timeout: 10_000 },
    );
    await expect(buildDetail.getByRole("heading", { name: "converged" })).toBeVisible();
    await workbench.getByRole("tab", { name: "Assure" }).click();
    let assurance = workbench.locator(".assurance-attention");
    let summary = assurance.getByRole("region", { name: "Assurance summary" });
    await expect(summary.locator("div").filter({ hasText: "Posture" }).locator("strong")).toHaveText("partial");
    await expect(summary.locator("div").filter({ hasText: "Gates satisfied" }).locator("strong")).toHaveText("0/3");
    await expect(summary.locator("div").filter({ hasText: "Assets delivered" }).locator("strong")).toHaveText("0/1");
    await expect(assurance.getByRole("region", { name: "Required gate assurance" }).locator('[data-status="missing"]')).toHaveCount(3);
    await assurance.getByRole("button", { name: /Attention 4/ }).click();
    await expect(assurance.getByRole("region", { name: "Attention Items" }).locator("li")).toHaveCount(4);
    await page.screenshot({ path: testInfo.outputPath("assurance-missing-evidence.png"), fullPage: true });

    await workbench.getByRole("tab", { name: "Build" }).click();
    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 500,
      outcome: "converged",
      label: "assurance-complete",
      assuranceProfile: "complete",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.getByRole("region", { name: "Build output" })).toContainText(
      "[assurance-complete] fixture build converged",
      { timeout: 10_000 },
    );
    await expect(buildDetail.getByRole("heading", { name: "converged" })).toBeVisible();
    await workbench.getByRole("tab", { name: "Assure" }).click();
    assurance = workbench.locator(".assurance-attention");
    summary = assurance.getByRole("region", { name: "Assurance summary" });
    await expect(summary.locator("div").filter({ hasText: "Posture" }).locator("strong")).toHaveText("verified");
    await expect(summary.locator("div").filter({ hasText: "Gates satisfied" }).locator("strong")).toHaveText("3/3");
    await expect(summary.locator("div").filter({ hasText: "Assets delivered" }).locator("strong")).toHaveText("1/1");
    await assurance.getByRole("button", { name: "Matrix" }).click();
    await assurance.getByRole("region", { name: "Required gate assurance" })
      .getByRole("button", { name: /Deterministic depth gate/ })
      .click();
    const detail = assurance.getByRole("region", { name: "Selected assurance assessment" });
    await expect(detail).toContainText("Evidence identity and digest match");
    await expect(detail).toContainText("producer://odd_manager/fixture-build-adapter");
    await page.screenshot({ path: testInfo.outputPath("assurance-verified.png"), fullPage: true });

    await workbench.getByRole("tab", { name: "Build" }).click();
    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 500,
      outcome: "converged",
      label: "assurance-mismatch",
      assuranceProfile: "proof_mismatch",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.getByRole("region", { name: "Build output" })).toContainText(
      "[assurance-mismatch] fixture build converged",
      { timeout: 10_000 },
    );
    await expect(buildDetail.getByRole("heading", { name: "converged" })).toBeVisible();
    await workbench.getByRole("tab", { name: "Assure" }).click();
    assurance = workbench.locator(".assurance-attention");
    summary = assurance.getByRole("region", { name: "Assurance summary" });
    await expect(summary.locator("div").filter({ hasText: "Posture" }).locator("strong")).toHaveText("stale");
    await expect(summary.locator("div").filter({ hasText: "Blocking attention" }).locator("strong")).toHaveText("1");
    await assurance.getByRole("button", { name: /Attention 1/ }).click();
    const attention = assurance.getByRole("region", { name: "Selected Attention Item" });
    await expect(attention).toContainText("digest does not match");
    await attention.getByRole("button", { name: "Open Run Inspector" }).click();
    await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 20_000 });
    const forensicUrl = new URL(page.url());
    expect(forensicUrl.searchParams.get("view")).toBe("run-inspector");
    expect(forensicUrl.searchParams.get("execution")).toBeTruthy();
    expect(forensicUrl.searchParams.get("runRef")).toBe("run://fixture/assurance-mismatch");
    expect(forensicUrl.searchParams.get("revision")).toBeTruthy();
    expect(forensicUrl.searchParams.get("source")).toBe("requirements://assurance_browser/depth");
    const forensicContext = page.getByRole("region", { name: "Build forensic context" });
    await expect(forensicContext).toContainText(forensicUrl.searchParams.get("execution") as string);
    await expect(forensicContext).toContainText("run://fixture/assurance-mismatch");
    await expect(forensicContext).toContainText("requirements://assurance_browser/depth");
    await page.screenshot({ path: testInfo.outputPath("assurance-forensic-focus.png"), fullPage: true });
    await page.getByRole("navigation", { name: "Developer control surfaces" })
      .getByRole("tab", { name: "Workbench" })
      .click();
    expect(new URL(page.url()).searchParams.get("execution")).toBeNull();
    expect(new URL(page.url()).searchParams.get("runRef")).toBeNull();
    await expect(workbench.getByRole("tab", { name: "Assure" })).toHaveAttribute("aria-selected", "true");
    assurance = workbench.locator(".assurance-attention");
    await expect(assurance.getByRole("region", { name: "Attention Items" }).locator("li")).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    const metrics = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.body.scrollWidth,
      assuranceWidth: document.querySelector(".assurance-attention")?.scrollWidth ?? 0,
      assuranceClientWidth: document.querySelector(".assurance-attention")?.clientWidth ?? 0,
    }));
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.assuranceWidth).toBeLessThanOrEqual(metrics.assuranceClientWidth);
    await attention.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("assurance-attention-mobile.png"), fullPage: true });
  } finally {
    await page.evaluate(async (root) => {
      await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "/Users/jim/src/apps/odd_glc", registerIfMissing: true }),
      }).catch(() => undefined);
      await fetch("/api/projects/unregister", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root }),
      }).catch(() => undefined);
    }, projectRoot).catch(() => undefined);
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("integrated Review Tune Build Assure journey preserves one revised Project basis across concurrent work", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const primaryRoot = createBuildProjectFixture("integrated_primary");
  const secondaryRoot = createBuildProjectFixture("integrated_secondary");
  try {
    await page.goto("/");
    await activateProject(page, primaryRoot);
    await registerProject(page, secondaryRoot);
    await page.goto(`/?project=${encodeURIComponent(primaryRoot)}`);
    let workbench = page.getByRole("region", { name: "Project Workbench" });

    const portfolio = workbench.locator(".build-portfolio");
    await expect(portfolio.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://integrated_primary" })).toBeVisible();
    await expect(portfolio.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://integrated_secondary" })).toBeVisible();

    await workbench.getByRole("tab", { name: "Tune" }).click();
    const proposal = workbench.locator(".specification-proposal");
    await proposal.getByLabel("Proposal request").fill("Bind the integrated build to explicit product truth.");
    await proposal.getByRole("button", { name: "Generate Proposal" }).click();
    await expect(proposal.getByRole("heading", { name: /Proposed Change for/ })).toBeVisible();
    await proposal.getByRole("button", { name: "Validate" }).click();
    await expect(proposal.locator(".specification-proposal__validation").getByText("Passed", { exact: true })).toHaveCount(4);
    await proposal.getByRole("button", { name: "Accept" }).click();
    await expect(proposal.locator(".specification-proposal__summary")).toContainText("Accepted");
    const acceptedProduct = readFileSync(join(primaryRoot, "specification", "PRODUCT.md"), "utf8");
    expect(acceptedProduct).toContain("Bind the integrated build to explicit product truth.");

    await workbench.getByRole("tab", { name: "Build" }).click();
    let build = workbench.locator(".build-control");
    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 30_000,
      outcome: "converged",
      label: "integrated-primary",
      assuranceProfile: "complete",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.locator(".build-control__detail").getByRole("heading", { name: "running" })).toBeVisible();

    await workbench.getByRole("tab", { name: "Review" }).click();
    await workbench.locator(".build-portfolio").getByRole("button", { name: "Refresh", exact: true }).click();
    const runningPrimaryRow = workbench.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://integrated_primary" });
    await expect(runningPrimaryRow).toContainText("running");
    const secondaryRow = workbench.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://integrated_secondary" });
    await secondaryRow.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("region", { name: "Project Workbench" })).toContainText(secondaryRoot);
    workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    build = workbench.locator(".build-control");
    await build.getByLabel("Build inputs").fill(JSON.stringify({
      durationMs: 30_000,
      outcome: "converged",
      label: "integrated-secondary",
      assuranceProfile: "none",
    }, null, 2));
    await build.getByRole("button", { name: "Submit Build" }).click();
    await expect(build.locator(".build-control__detail").getByRole("heading", { name: "running" })).toBeVisible();
    await expect(
      build.getByRole("region", { name: "Build scheduler" }).locator("div").filter({ hasText: "Running" }).first().locator("strong"),
    ).toHaveText("2");
    await build.getByRole("button", { name: "Cancel" }).click();
    await expect(build.locator(".build-control__detail").getByRole("heading", { name: "cancelled" })).toBeVisible();

    await workbench.getByRole("tab", { name: "Review" }).click();
    await workbench.locator(".build-portfolio").getByRole("button", { name: "Refresh", exact: true }).click();
    const primaryRow = workbench.locator(".build-portfolio__table tbody tr").filter({ hasText: "product://integrated_primary" });
    await primaryRow.getByRole("button", { name: "Open" }).click();
    await expect(page.getByRole("region", { name: "Project Workbench" })).toContainText(primaryRoot);
    workbench = page.getByRole("region", { name: "Project Workbench" });
    await workbench.getByRole("tab", { name: "Build" }).click();
    build = workbench.locator(".build-control");
    await expect(build.getByRole("region", { name: "Build output" })).toContainText(
      "[integrated-primary] fixture build converged",
      { timeout: 35_000 },
    );

    await workbench.getByRole("tab", { name: "Assure" }).click();
    const assurance = workbench.locator(".assurance-attention");
    const summary = assurance.getByRole("region", { name: "Assurance summary" });
    await expect(summary.locator("div").filter({ hasText: "Posture" }).locator("strong")).toHaveText("verified");
    await expect(summary.locator("div").filter({ hasText: "Gates satisfied" }).locator("strong")).toHaveText("3/3");
    await expect(summary.locator("div").filter({ hasText: "Assets delivered" }).locator("strong")).toHaveText("1/1");
    await page.screenshot({ path: testInfo.outputPath("integrated-review-tune-build-assure.png"), fullPage: true });

    await assurance.locator(".assurance-attention__footer-actions").getByRole("button", { name: "Open Run Inspector" }).click();
    await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("navigation", { name: "Developer control surfaces" })
      .getByRole("tab", { name: "Workbench" })
      .click();
    await expect(workbench.getByRole("tab", { name: "Assure" })).toHaveAttribute("aria-selected", "true");
    await expect(workbench.locator(".assurance-attention").getByRole("region", { name: "Assurance summary" })).toContainText("verified");
  } finally {
    await page.evaluate(async (roots) => {
      await fetch("/api/projects/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: "/Users/jim/src/apps/odd_glc", registerIfMissing: true }),
      }).catch(() => undefined);
      for (const root of roots) {
        await fetch("/api/projects/unregister", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ root }),
        }).catch(() => undefined);
      }
    }, [primaryRoot, secondaryRoot]).catch(() => undefined);
    rmSync(primaryRoot, { recursive: true, force: true });
    rmSync(secondaryRoot, { recursive: true, force: true });
  }
});

test("run observation opens as a supporting surface and workbench focus survives return", async ({ page }) => {
  await page.goto("/");
  await activateProject(page, ODD_GLC_ROOT);
  await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);

  const workbench = page.getByRole("region", { name: "Project Workbench" });
  await expect(workbench).toBeVisible();
  await workbench.getByRole("tab", { name: "Build" }).click();
  await workbench.getByRole("button", { name: "Open Run Inspector" }).click();
  await expect(page.getByRole("region", { name: "Sidecar canvas" })).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).searchParams.get("view")).toBe("run-inspector");

  await page.getByRole("navigation", { name: "Developer control surfaces" })
    .getByRole("tab", { name: "Workbench" })
    .click();
  await expect(workbench).toBeVisible();
  await expect(workbench.getByRole("tab", { name: "Build" })).toHaveAttribute("aria-selected", "true");
  await expect(workbench.getByRole("heading", { name: "Build Control" })).toBeVisible();
  expect(new URL(page.url()).searchParams.get("view")).toBeNull();
});

test("Project Workbench stays viewport-contained on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await activateProject(page, ODD_GLC_ROOT);
  await page.goto(`/?project=${encodeURIComponent(ODD_GLC_ROOT)}`);
  await expect(page.getByRole("region", { name: "Project Workbench" })).toBeVisible();

  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyWidth: document.body.scrollWidth,
    hostWidth: document.querySelector(".developer-control-host")?.scrollWidth ?? 0,
    hostClientWidth: document.querySelector(".developer-control-host")?.clientWidth ?? 0,
    phaseStatusCount: document.querySelectorAll(".project-workbench__phases .capability-availability__state").length,
    phaseStatusesContained: Array.from(document.querySelectorAll(".project-workbench__phases .capability-availability__state"))
      .every((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }),
  }));
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.hostWidth).toBeLessThanOrEqual(metrics.hostClientWidth);
  expect(metrics.phaseStatusCount).toBe(4);
  expect(metrics.phaseStatusesContained).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("developer-control-workbench-mobile.png") });
});
