import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(here, '../..');
const serverIndexPath = resolve(tenantRoot, 'src/server/index.mjs');

async function reservePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  server.close();
  await once(server, 'close');
  return port;
}

async function waitForHealth(baseUrl, child, output) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`odd_manager server exited before health admission:\n${output()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server startup is still in progress.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error(`odd_manager server did not become healthy:\n${output()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  const exited = once(child, 'exit');
  const timeout = new Promise((resolvePromise) => {
    const timer = setTimeout(() => resolvePromise(false), 2_000);
    timer.unref?.();
  });
  if (await Promise.race([exited.then(() => true), timeout])) return;
  child.kill('SIGKILL');
  await once(child, 'exit');
}

async function postJson(baseUrl, path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('proposal API rejects every action and refinement against accepted, rejected, and superseded authority', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'odd-manager-proposal-api-'));
  const managerStateRoot = join(fixtureRoot, 'manager-state');
  const projectRoot = join(fixtureRoot, 'project');
  mkdirSync(managerStateRoot);
  mkdirSync(join(projectRoot, 'specification'), { recursive: true });
  writeFileSync(
    join(projectRoot, 'specification', 'PRODUCT.md'),
    '# API Fixture Product\n\n## Product Identity\n\nA governed API fixture.\n',
    'utf8',
  );
  writeFileSync(
    join(projectRoot, 'specification', 'INTENT.md'),
    '# Intent\n\nKeep exhausted proposal authority terminal.\n',
    'utf8',
  );
  execFileSync('git', ['init', '--quiet', projectRoot]);
  execFileSync('git', ['-C', projectRoot, 'add', 'specification']);
  execFileSync('git', [
    '-C', projectRoot,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
  const sourceBefore = readFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), 'utf8');
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const child = spawn(process.execPath, [serverIndexPath], {
    cwd: tenantRoot,
    env: {
      ...process.env,
      OMAN_API_PORT: String(port),
      OMAN_MANAGER_STATE_ROOT: managerStateRoot,
      OMAN_PROPOSAL_FIXTURE_MODE: '1',
      PROJECT_REGISTRY_ROOT: fixtureRoot,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });

  try {
    await waitForHealth(baseUrl, child, () => output);
    const registrationResponse = await postJson(baseUrl, '/api/projects/register', {
      root: projectRoot,
      label: 'Proposal API Fixture',
      setActive: true,
    });
    assert.equal(registrationResponse.status, 200);

    async function loadBootstrap() {
      const response = await fetch(
        `${baseUrl}/api/developer-control/bootstrap?workspaceRoot=${encodeURIComponent(projectRoot)}`,
      );
      assert.equal(response.status, 200);
      const bootstrap = await response.json();
      assert.ok(bootstrap.context.revision);
      return bootstrap;
    }

    async function generate(prompt, predecessorProposalId = null) {
      const bootstrap = await loadBootstrap();
      const response = await postJson(baseUrl, '/api/developer-control/proposals/generate', {
        project: bootstrap.context.project,
        basisRevision: bootstrap.context.revision,
        prompt,
        contextAttachmentRefs: [],
        predecessorProposalId,
      });
      assert.equal(response.status, 200);
      return (await response.json()).proposal;
    }

    async function decide(action, proposalId) {
      const response = await postJson(
        baseUrl,
        `/api/developer-control/proposals/${action}`,
        {
          projectRoot,
          proposalId,
          ...(action === 'validate' ? {} : { actorRef: 'actor://operator/api-test' }),
        },
      );
      return response;
    }

    async function assertExhausted(proposal, status) {
      const sourceAfterDecision = readFileSync(
        join(projectRoot, 'specification', 'PRODUCT.md'),
        'utf8',
      );
      for (const action of ['validate', 'accept', 'reject']) {
        const response = await decide(action, proposal.proposalId);
        assert.equal(response.status, 409);
        const failure = await response.json();
        assert.match(failure.error, new RegExp(status));
        assert.equal(failure.proposal.status, status);
      }

      const bootstrap = await loadBootstrap();
      const refinementResponse = await postJson(
        baseUrl,
        '/api/developer-control/proposals/generate',
        {
          project: bootstrap.context.project,
          basisRevision: bootstrap.context.revision,
          prompt: `Unlawful refinement of ${status} API evidence.`,
          contextAttachmentRefs: [],
          predecessorProposalId: proposal.proposalId,
        },
      );
      assert.equal(refinementResponse.status, 409);
      const refinementFailure = await refinementResponse.json();
      assert.match(refinementFailure.error, new RegExp(`cannot refine a ${status} proposal`));
      assert.equal(refinementFailure.proposal.status, status);

      const historyResponse = await fetch(
        `${baseUrl}/api/developer-control/proposals?workspaceRoot=${encodeURIComponent(projectRoot)}`,
      );
      assert.equal(historyResponse.status, 200);
      const history = await historyResponse.json();
      assert.equal(
        history.proposals.find((entry) => entry.proposalId === proposal.proposalId).status,
        status,
      );
      assert.equal(
        readFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), 'utf8'),
        sourceAfterDecision,
      );
    }

    const superseded = await generate('First API candidate.');
    await generate('Selected API successor.', superseded.proposalId);
    await assertExhausted(superseded, 'superseded');

    const rejected = await generate('Rejected API candidate.');
    const rejectedResponse = await decide('reject', rejected.proposalId);
    assert.equal(rejectedResponse.status, 200);
    assert.equal((await rejectedResponse.json()).proposal.status, 'rejected');
    await assertExhausted(rejected, 'rejected');
    assert.equal(readFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), 'utf8'), sourceBefore);

    const accepted = await generate('Accepted API candidate.');
    const acceptedResponse = await decide('accept', accepted.proposalId);
    assert.equal(acceptedResponse.status, 200);
    assert.equal((await acceptedResponse.json()).proposal.status, 'accepted');
    await assertExhausted(accepted, 'accepted');
    assert.match(
      readFileSync(join(projectRoot, 'specification', 'PRODUCT.md'), 'utf8'),
      /Accepted API candidate/,
    );
  } finally {
    await stopChild(child);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
