import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const tenantRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(tenantRoot, "../..");

// `test:e2e` is intentionally not the installed-candidate criterion: it also
// carries presentation and sibling-workspace checks with source-checkout paths.
// This source-blind bundle is the smallest declared operator path that proves
// the installed candidate's significant public behavior without treating those
// source-bound checks as installed-product evidence.
const OPERATOR_SIGNIFICANT_PATH_FILES = [
  "tests/e2e/odd-manager-developer-control.spec.ts",
  "tests/e2e/odd-manager-run-inspector.spec.ts",
  "tests/e2e/odd-manager-smoke.spec.ts",
  "tests/e2e/odd-manager-collaboration.spec.ts",
  "tests/e2e/odd-manager-accessibility.spec.ts",
];

const OPERATOR_SIGNIFICANT_PATH_GREP = [
  "Build remains visibly unavailable without a lawful carrier",
  "two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated",
  "integrated Review Tune Build Assure journey preserves one revised Project basis across concurrent work",
  "run observation opens as a supporting surface and workbench focus survives return",
  "unregistered local Project deep link fails closed without changing the registry",
  "generic Run Inspector recovers ABG operational capability from the odd_glc Project",
  "Run Inspector remains viewport-contained on a narrow screen",
  "AI Workspace indexes large Project evidence without false overlays or stretched groups",
  "sidecar layout profile persists resize across reload and resets to defaults",
  "sidecar selector uses the same filesystem browser for tickets and comments",
  "sidecar terminal panes open tabs and split groups",
  "sidecar terminal dock drag collapses and restores",
  "creates a live local shell and round-trips terminal input",
  "creates a topic and posts an operator room message through the live collaboration API",
  "developer control and workbench tabs provide keyboard parity and named panels",
  "developer-control status, custom tabs, and representative text/control tokens meet keyboard and AA expectations",
  "forensic Run Inspector and terminal controls retain named navigation and fit at 390px",
].join("|");

function run(command, args, cwd, environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  execFileSync(command, args, {
    cwd,
    env: { ...childEnvironment, ...environment },
    stdio: "inherit",
  });
}

function candidatePaths() {
  const output = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
    ],
    {
      cwd: repositoryRoot,
      encoding: "buffer",
    },
  );
  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
}

function copyCandidate(destinationRoot, paths) {
  const manifest = [];
  for (const path of paths) {
    const source = resolve(repositoryRoot, path);
    if (!existsSync(source)) continue;
    const destination = resolve(destinationRoot, path);
    mkdirSync(dirname(destination), { recursive: true });
    const stat = lstatSync(source);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(source);
      symlinkSync(target, destination);
      manifest.push({ path, kind: "symlink", target });
      continue;
    }
    assert.equal(stat.isFile(), true, `candidate member is not a file: ${path}`);
    copyFileSync(source, destination);
    chmodSync(destination, stat.mode & 0o777);
    const bytes = readFileSync(source);
    manifest.push({
      path,
      kind: "file",
      executableMode: stat.mode & 0o111,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
    });
  }
  return manifest;
}

function manifestDigest(manifest) {
  const hash = createHash("sha256");
  for (const entry of manifest) {
    hash.update(JSON.stringify(entry));
    hash.update("\n");
  }
  return hash.digest("hex");
}

test(
  "isolated development candidate proves the declared operator significant-path bundle",
  { timeout: 720_000 },
  () => {
    const proofRoot = mkdtempSync(join(tmpdir(), "odd-manager-installed-development-"));
    const installedRepositoryRoot = join(proofRoot, "repository");
    const installedTenantRoot = join(
      installedRepositoryRoot,
      "build_tenants",
      "react_vite",
    );
    const keepProof = process.env.OMAN_KEEP_INSTALLED_PROOF === "1";

    try {
      const paths = candidatePaths();
      const manifest = copyCandidate(installedRepositoryRoot, paths);
      const digest = manifestDigest(manifest);
      writeFileSync(
        join(proofRoot, "candidate-manifest.json"),
        `${JSON.stringify({ digest, members: manifest }, null, 2)}\n`,
      );

      assert.equal(
        existsSync(join(installedTenantRoot, "package-lock.json")),
        true,
        "installed-development candidate must carry the exact dependency lock",
      );
      assert.equal(
        existsSync(join(installedRepositoryRoot, ".git")),
        false,
        "installed-development proof must not execute from the source checkout",
      );

      run("npm", ["ci", "--no-audit", "--no-fund"], installedTenantRoot);
      run("npm", ["run", "test:traceability"], installedTenantRoot);
      run("npm", ["run", "test:runtime:node"], installedTenantRoot);
      run("npm", ["run", "build"], installedTenantRoot);
      run(
        "npx",
        [
          "playwright",
          "test",
          ...OPERATOR_SIGNIFICANT_PATH_FILES,
          "--grep",
          OPERATOR_SIGNIFICANT_PATH_GREP,
        ],
        installedTenantRoot,
        {
          ODD_MANAGER_E2E_PROJECT_ROOT: installedRepositoryRoot,
        },
      );

      process.stdout.write(
        `Installed-development candidate PASS: ${manifest.length} members, sha256 ${digest}\n`,
      );
    } finally {
      if (keepProof) {
        process.stdout.write(`Installed-development proof retained at ${proofRoot}\n`);
      } else {
        rmSync(proofRoot, { recursive: true, force: true });
      }
    }
  },
);
