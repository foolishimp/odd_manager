import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const tenantRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(tenantRoot, "../..");
const T040_PROOF_RELATIVE_PATH = "build_tenants/react_vite/qualification/t040-visual-runtime-observation-proof.json";

// `test:e2e` is intentionally not the installed-candidate criterion: it also
// carries presentation and sibling-workspace checks with source-checkout paths.
// This source-blind bundle is the smallest declared operator path that proves
// the installed candidate's significant public behavior without treating those
// source-bound checks as installed-product evidence.
const OPERATOR_SIGNIFICANT_PATH_FILES = [
  "tests/e2e/odd-manager-developer-control.spec.ts",
  "tests/e2e/odd-manager-run-inspector.spec.ts",
  "tests/e2e/odd-manager-abg5-compatibility.spec.ts",
  "tests/e2e/odd-manager-smoke.spec.ts",
  "tests/e2e/odd-manager-collaboration.spec.ts",
  "tests/e2e/odd-manager-accessibility.spec.ts",
];

const OPERATOR_SIGNIFICANT_PATH_TITLES = [
  "Build remains visibly unavailable without a lawful carrier",
  "two Project builds run concurrently while Portfolio, focus, output, and outcomes remain isolated",
  "integrated Review Tune Build Assure journey preserves one revised Project basis across concurrent work",
  "run observation opens as a supporting surface and workbench focus survives return",
  "unregistered local Project deep link fails closed without changing the registry",
  "Run Inspector requires an exact current ABG 5 candidate and does not surface the legacy Data Mapper as selectable",
  "installed Run Inspector consumes the exact ABIogenesis 5.0 root envelope through paging and lazy detail",
  "installed Run Inspector observes the latest stopped Data Mapper without proof or invented process liveness",
  "T-040 Run Inspector renders the retained ABG 5 rust-cli occurrence projection without inventing topology or terminal control",
  "T-040 ready declaration projection remains switchable with occurrence history and filters only admitted product-overlay rows",
  "T-040 same-Run refresh failure keeps the retained projection visibly stale and retry replaces the failed request",
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
];
const OPERATOR_SIGNIFICANT_PATH_GREP = OPERATOR_SIGNIFICANT_PATH_TITLES
  .map((title) => title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
  .join("|");

function assertSignificantPathTitlesResolveExactlyOnce(installedTenantRoot) {
  const sources = OPERATOR_SIGNIFICANT_PATH_FILES.map((path) => ({
    path,
    source: readFileSync(join(installedTenantRoot, path), "utf8"),
  }));
  for (const title of OPERATOR_SIGNIFICANT_PATH_TITLES) {
    const matches = sources.flatMap(({ path, source }) => {
      let count = 0;
      let offset = 0;
      while ((offset = source.indexOf(title, offset)) >= 0) {
        count += 1;
        offset += title.length;
      }
      return Array.from({ length: count }, () => path);
    });
    assert.equal(
      matches.length,
      1,
      `installed significant-path title must resolve exactly once: ${title}; matches=${matches.join(",")}`,
    );
  }
}

function run(command, args, cwd, environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  execFileSync(command, args, {
    cwd,
    env: { ...childEnvironment, ...environment },
    stdio: "inherit",
  });
}

function runCaptured(command, args, cwd, environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_TEST_CONTEXT;
  return spawnSync(command, args, {
    cwd,
    env: { ...childEnvironment, ...environment },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function operatorSpecs(suites) {
  return suites.flatMap((suite) => [
    ...(Array.isArray(suite.specs) ? suite.specs : []),
    ...operatorSpecs(Array.isArray(suite.suites) ? suite.suites : []),
  ]);
}

function assertExactOperatorReport(reportText) {
  const report = JSON.parse(reportText);
  assert.deepEqual(report.errors, [], "installed operator report must have no run-level errors");
  assert.equal(report.stats?.expected, OPERATOR_SIGNIFICANT_PATH_TITLES.length, "every selected operator title must pass");
  assert.equal(report.stats?.unexpected, 0, "installed operator bundle must have no unexpected failures");
  assert.equal(report.stats?.flaky, 0, "installed operator bundle must have no flaky results");
  assert.equal(report.stats?.skipped, 0, "installed operator bundle must have no skipped results");

  const specs = operatorSpecs(Array.isArray(report.suites) ? report.suites : []);
  assert.equal(specs.length, OPERATOR_SIGNIFICANT_PATH_TITLES.length, "installed operator report must contain exactly the selected specs");
  assert.deepEqual(
    specs.map((spec) => spec.title).sort((left, right) => left.localeCompare(right, "en")),
    [...OPERATOR_SIGNIFICANT_PATH_TITLES].sort((left, right) => left.localeCompare(right, "en")),
    "installed operator report titles must equal the declared bundle",
  );
  for (const spec of specs) {
    assert.equal(spec.ok, true, `installed operator spec must be successful: ${spec.title}`);
    assert.equal(spec.tests.length, 1, `installed operator spec must execute in exactly one Project: ${spec.title}`);
    const testResult = spec.tests[0];
    assert.equal(testResult.expectedStatus, "passed", `installed operator test cannot declare a non-pass expectation: ${spec.title}`);
    assert.equal(testResult.status, "expected", `installed operator test must pass without skip, failure, or retry: ${spec.title}`);
    assert.equal(testResult.annotations.some((entry) => entry.type === "skip"), false, `installed operator test cannot be skipped: ${spec.title}`);
    assert.equal(testResult.results.length, 1, `installed operator test must pass on its first execution: ${spec.title}`);
    assert.equal(testResult.results[0].status, "passed", `installed operator result must pass: ${spec.title}`);
  }
}

async function allocateLoopbackPorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await new Promise((accept, reject) => {
        server.once("error", reject);
        server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, accept);
      });
      servers.push(server);
    }
    return servers.map((server) => {
      const address = server.address();
      assert.ok(address && typeof address === "object", "ephemeral loopback listener must publish a port");
      return address.port;
    });
  } finally {
    await Promise.all(servers.map((server) => new Promise((accept, reject) => {
      server.close((error) => error ? reject(error) : accept());
    })));
  }
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
  async () => {
    const proofRoot = mkdtempSync(join(tmpdir(), "odd-manager-installed-development-"));
    const installedRepositoryRoot = join(proofRoot, "repository");
    const installedTenantRoot = join(
      installedRepositoryRoot,
      "build_tenants",
      "react_vite",
    );
    const keepProof = process.env.OMAN_KEEP_INSTALLED_PROOF === "1";
    const [apiPort, clientPort] = await allocateLoopbackPorts(2);
    let qualificationPassed = false;

    try {
      const paths = candidatePaths();
      const manifest = copyCandidate(installedRepositoryRoot, paths);
      const digest = manifestDigest(manifest);
      const proofSubjectManifest = manifest.filter((entry) => entry.path !== T040_PROOF_RELATIVE_PATH);
      const proofSubjectDigest = manifestDigest(proofSubjectManifest);
      writeFileSync(
        join(proofRoot, "candidate-manifest.json"),
        `${JSON.stringify({
          digest,
          proofSubjectDigest,
          proofSubjectMemberCount: proofSubjectManifest.length,
          members: manifest,
        }, null, 2)}\n`,
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
      const t040Proof = JSON.parse(readFileSync(
        join(installedRepositoryRoot, T040_PROOF_RELATIVE_PATH),
        "utf8",
      ));
      assert.equal(
        t040Proof.qualification?.installedDevelopment?.candidateManifestExcludingProofSha256,
        `sha256:${proofSubjectDigest}`,
        "T-040 proof must bind the exact installed candidate manifest without self-referential proof bytes",
      );
      assert.equal(
        t040Proof.qualification?.installedDevelopment?.candidateMemberCountExcludingProof,
        proofSubjectManifest.length,
        "T-040 proof must bind the exact installed candidate member count",
      );
      assertSignificantPathTitlesResolveExactlyOnce(installedTenantRoot);

      run("npm", ["ci", "--no-audit", "--no-fund"], installedTenantRoot);
      run("npm", ["run", "test:traceability"], installedTenantRoot);
      run("npm", ["run", "test:runtime:node"], installedTenantRoot);
      run("npm", ["run", "build"], installedTenantRoot);
      const operatorExecution = runCaptured(
        "npx",
        [
          "playwright",
          "test",
          ...OPERATOR_SIGNIFICANT_PATH_FILES,
          "--grep",
          OPERATOR_SIGNIFICANT_PATH_GREP,
          "--reporter=json",
        ],
        installedTenantRoot,
        {
          ODD_MANAGER_E2E_PROJECT_ROOT: installedRepositoryRoot,
          OMAN_E2E_REUSE_SERVER: "0",
          OMAN_E2E_API_PORT: String(apiPort),
          OMAN_E2E_CLIENT_PORT: String(clientPort),
          OMAN_E2E_STATE_ROOT: join(proofRoot, "e2e-manager-state"),
        },
      );
      const operatorReportPath = join(proofRoot, "operator-report.json");
      writeFileSync(operatorReportPath, operatorExecution.stdout ?? "", "utf8");
      if (operatorExecution.error) throw operatorExecution.error;
      assert.equal(operatorExecution.signal, null, "installed operator bundle must not terminate by signal");
      assertExactOperatorReport(operatorExecution.stdout ?? "");
      assert.equal(operatorExecution.status, 0, "installed operator bundle process must exit successfully");
      qualificationPassed = true;

      process.stdout.write(
        `Installed-development candidate PASS: ${manifest.length} members, sha256 ${digest}; proof subject ${proofSubjectManifest.length} members, sha256 ${proofSubjectDigest}; ${OPERATOR_SIGNIFICANT_PATH_TITLES.length} operator titles passed without skip or retry\n`,
      );
    } finally {
      if (keepProof || !qualificationPassed) {
        process.stdout.write(`Installed-development proof retained at ${proofRoot}\n`);
      } else {
        rmSync(proofRoot, { recursive: true, force: true });
      }
    }
  },
);
