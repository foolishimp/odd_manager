import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import {
  admitProjectWorkingDirectory,
  admitRegisteredProject,
  admitRegisteredProjectRoot,
  ProjectContextAdmissionError,
  ProjectWorkingDirectoryAdmissionError,
} from '../../src/server/project-context-admission-service.mjs';
import { attachGTermServer } from '../../src/server/oddterm-pool-service.mjs';
import { mountSessionWebSocket } from '../../src/server/session-pty-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const tenantRoot = resolve(here, '../..');
const serverIndexPath = resolve(tenantRoot, 'src/server/index.mjs');

function projectRecord(root) {
  return {
    id: 'registered-project-exact-id',
    name: 'Registered Project',
    root,
    odd_type: 'fixture_product',
  };
}

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  return address.port;
}

async function closeServer(server) {
  if (!server.listening) return;
  server.close();
  await once(server, 'close');
}

function upgradeResponse(port, path) {
  return new Promise((resolvePromise, reject) => {
    const request = httpRequest({
      host: '127.0.0.1',
      port,
      path,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
      },
    });
    request.on('upgrade', (_response, socket) => {
      socket.destroy();
      reject(new Error(`unexpected WebSocket admission for ${path}`));
    });
    request.on('response', (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolvePromise({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

async function reservePort() {
  const server = createServer();
  const port = await listen(server);
  await closeServer(server);
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

test('Project Context admission returns the exact registry record and rejects aliases or descendants', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'odd-manager-context-unit-'));
  const registeredRoot = join(fixtureRoot, 'registered');
  const aliasRoot = join(fixtureRoot, 'registered-alias');
  mkdirSync(registeredRoot);
  symlinkSync(registeredRoot, aliasRoot, 'dir');
  const registered = projectRecord(registeredRoot);
  try {
    assert.deepEqual(
      admitRegisteredProject(registeredRoot, [registered], registeredRoot),
      registered,
    );
    assert.equal(
      admitRegisteredProjectRoot(null, [registered], registeredRoot),
      registeredRoot,
    );
    for (const rejectedRoot of [aliasRoot, join(registeredRoot, 'child')]) {
      assert.throws(
        () => admitRegisteredProjectRoot(rejectedRoot, [registered], registeredRoot),
        (error) => (
          error instanceof ProjectContextAdmissionError
          && error.statusCode === 403
          && error.projectRoot === resolve(rejectedRoot)
        ),
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('Project session working directories reject lexical and symlink escapes', () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'odd-manager-cwd-unit-'));
  const projectRoot = join(fixtureRoot, 'project');
  const nestedRoot = join(projectRoot, 'test_runs', 'run', 'instance');
  const outsideRoot = join(fixtureRoot, 'outside');
  mkdirSync(nestedRoot, { recursive: true });
  mkdirSync(outsideRoot);
  symlinkSync(outsideRoot, join(projectRoot, 'outside-link'), 'dir');
  symlinkSync(nestedRoot, join(projectRoot, 'inside-link'), 'dir');
  try {
    assert.equal(
      admitProjectWorkingDirectory(projectRoot, nestedRoot),
      nestedRoot,
    );
    for (const rejectedCwd of [
      outsideRoot,
      join(projectRoot, 'outside-link'),
      join(projectRoot, 'inside-link'),
    ]) {
      assert.throws(
        () => admitProjectWorkingDirectory(projectRoot, rejectedCwd),
        (error) => (
          error instanceof ProjectWorkingDirectoryAdmissionError
          && error.statusCode === 403
        ),
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('OddTerm and session WebSocket upgrades reject an unregistered Project before attachment', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'odd-manager-context-ws-'));
  const registeredRoot = join(fixtureRoot, 'registered');
  const unregisteredRoot = join(fixtureRoot, 'unregistered');
  mkdirSync(registeredRoot);
  mkdirSync(unregisteredRoot);
  const projects = [projectRecord(registeredRoot)];
  const admitProjectRoot = (requestedRoot) => (
    admitRegisteredProjectRoot(requestedRoot, projects, registeredRoot)
  );
  const server = createServer();
  const oddTermServer = attachGTermServer(server, {
    defaultWorkspaceRoot: registeredRoot,
    admitProjectRoot,
  });
  const sessionServer = mountSessionWebSocket(server, {
    defaultProjectRoot: registeredRoot,
    admitProjectRoot,
  });
  try {
    const port = await listen(server);
    const encodedRoot = encodeURIComponent(unregisteredRoot);
    const oddTerm = await upgradeResponse(
      port,
      `/api/oddterm?workspaceRoot=${encodedRoot}`,
    );
    assert.equal(oddTerm.status, 403);
    assert.match(oddTerm.body, /Project root is not registered/);

    const session = await upgradeResponse(
      port,
      `/ws/sessions/unregistered-session?projectRoot=${encodedRoot}`,
    );
    assert.equal(session.status, 403);
    assert.match(session.body, /Project root is not registered/);
    assert.equal(existsSync(join(unregisteredRoot, '.ai-workspace')), false);
  } finally {
    oddTermServer.close();
    sessionServer.close();
    await closeServer(server);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('HTTP Project routes reject unregistered roots without mutation and preserve registered identity', async () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'odd-manager-context-http-'));
  const managerStateRoot = join(fixtureRoot, 'manager-state');
  const registeredRoot = join(fixtureRoot, 'registered');
  const unregisteredRoot = join(fixtureRoot, 'unregistered');
  const outsideRoot = join(fixtureRoot, 'outside');
  mkdirSync(managerStateRoot);
  mkdirSync(registeredRoot);
  mkdirSync(unregisteredRoot);
  mkdirSync(outsideRoot);
  mkdirSync(join(registeredRoot, 'nested'));
  writeFileSync(join(registeredRoot, 'surface.txt'), 'registered surface\n', 'utf8');
  writeFileSync(join(registeredRoot, 'nested', 'internal.txt'), 'internal target\n', 'utf8');
  writeFileSync(join(unregisteredRoot, 'surface.txt'), 'unregistered surface\n', 'utf8');
  writeFileSync(join(outsideRoot, 'secret.txt'), 'outside secret\n', 'utf8');
  symlinkSync(join(registeredRoot, 'nested', 'internal.txt'), join(registeredRoot, 'internal-link.txt'));
  symlinkSync(join(outsideRoot, 'secret.txt'), join(registeredRoot, 'external-file.txt'));
  symlinkSync(outsideRoot, join(registeredRoot, 'external-directory'), 'dir');

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

  const requestProject = (path, options) => fetch(
    `${baseUrl}${path}${path.includes('?') ? '&' : '?'}workspaceRoot=${encodeURIComponent(unregisteredRoot)}`,
    options,
  );
  try {
    await waitForHealth(baseUrl, child, () => output);
    const registryBefore = await fetch(`${baseUrl}/api/projects/registry`);
    assert.equal(registryBefore.status, 200);

    const context = await requestProject('/api/context');
    assert.equal(context.status, 403);
    const jsonSurface = await requestProject('/api/surface?relativePath=surface.txt');
    assert.equal(jsonSurface.status, 403);
    const rawSurface = await requestProject('/api/surface/raw?relativePath=surface.txt');
    assert.equal(rawSurface.status, 403);
    const sessionSpawn = await requestProject('/api/sessions/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(sessionSpawn.status, 403);
    assert.deepEqual(readdirSync(unregisteredRoot), ['surface.txt']);

    const registrationResponse = await fetch(`${baseUrl}/api/projects/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        root: registeredRoot,
        label: 'Registry Identity',
        setActive: true,
      }),
    });
    assert.equal(registrationResponse.status, 200);
    const registration = await registrationResponse.json();
    symlinkSync(unregisteredRoot, join(registeredRoot, 'cwd-leak'), 'dir');

    const escapedSession = await fetch(
      `${baseUrl}/api/sidecar/sessions/spawn?workspaceRoot=${encodeURIComponent(registeredRoot)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: join(registeredRoot, 'cwd-leak') }),
      },
    );
    assert.equal(escapedSession.status, 403);
    assert.equal(
      existsSync(join(registeredRoot, '.ai-workspace', 'runtime', 'oddterm')),
      false,
    );

    const admittedContextResponse = await fetch(
      `${baseUrl}/api/context?workspaceRoot=${encodeURIComponent(registeredRoot)}`,
    );
    assert.equal(admittedContextResponse.status, 200);
    const admittedContext = await admittedContextResponse.json();
    assert.deepEqual(admittedContext.project, {
      id: registration.project.id,
      root: registration.project.root,
      odd_type: registration.project.odd_type,
    });

    const admittedJsonSurface = await fetch(
      `${baseUrl}/api/surface?workspaceRoot=${encodeURIComponent(registeredRoot)}&relativePath=surface.txt`,
    );
    assert.equal(admittedJsonSurface.status, 200);
    assert.equal((await admittedJsonSurface.json()).content, 'registered surface\n');
    const admittedRawSurface = await fetch(
      `${baseUrl}/api/surface/raw?workspaceRoot=${encodeURIComponent(registeredRoot)}&relativePath=surface.txt`,
    );
    assert.equal(admittedRawSurface.status, 200);
    assert.equal(await admittedRawSurface.text(), 'registered surface\n');

    const internalRawSurface = await fetch(
      `${baseUrl}/api/surface/raw?workspaceRoot=${encodeURIComponent(registeredRoot)}&relativePath=internal-link.txt`,
    );
    assert.equal(internalRawSurface.status, 200);
    assert.equal(await internalRawSurface.text(), 'internal target\n');

    for (const relativePath of ['external-file.txt', 'external-directory/secret.txt']) {
      const externalJsonSurface = await fetch(
        `${baseUrl}/api/surface?workspaceRoot=${encodeURIComponent(registeredRoot)}&relativePath=${encodeURIComponent(relativePath)}`,
      );
      assert.equal(externalJsonSurface.status, 200);
      assert.deepEqual(await externalJsonSurface.json(), {
        kind: 'unreadable',
        relative_path: relativePath,
        path: join(registeredRoot, relativePath),
        reason: 'outside_workspace',
        error: 'surface path resolves outside the active Project root',
      });
      const externalRawSurface = await fetch(
        `${baseUrl}/api/surface/raw?workspaceRoot=${encodeURIComponent(registeredRoot)}&relativePath=${encodeURIComponent(relativePath)}`,
      );
      assert.equal(externalRawSurface.status, 403);
      assert.match(await externalRawSurface.text(), /outside the active Project root/);
    }
  } finally {
    await stopChild(child);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
