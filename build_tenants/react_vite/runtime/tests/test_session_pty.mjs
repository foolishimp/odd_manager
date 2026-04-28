// T-020 — smoke test for session-pty-service. Spawns a real /bin/echo
// child, captures transcript, asserts record persistence + exit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { WebSocket } from 'ws';

import {
  spawnSession,
  killSession,
  readTranscript,
  listLiveSessionIds,
  mountSessionWebSocket,
} from '../../src/server/session-pty-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_session_pty');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
}

function teardown() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('spawnSession creates a child and persists a record + transcript', async () => {
  setup();
  try {
    const result = spawnSession(fixtureRoot, {
      backplane: 'pipe',
      agentType: 'shell',
      command: '/bin/echo',
      args: ['hello-from-T-020'],
      contextAtSpawn: { project: 'test', workspace: 'react_vite', odd_type: 'odd_sdlc' },
    });
    assert.equal(result.ok, true, `spawn failed: ${result.error}`);
    assert.ok(result.id.startsWith('sess-'));
    assert.equal(result.status, 'running');
    assert.equal(result.context_at_spawn.project, 'test');
    assert.ok(listLiveSessionIds().includes(result.id));

    // Wait for the echo to produce output and exit.
    await new Promise((r) => setTimeout(r, 300));

    const transcript = readTranscript(fixtureRoot, result.id);
    assert.match(transcript, /hello-from-T-020/);

    const recordPath = join(fixtureRoot, '.ai-workspace/runtime/sessions', `${result.id}.json`);
    const record = JSON.parse(readFileSync(recordPath, 'utf-8'));
    assert.equal(record.id, result.id);
    assert.ok(['stopped', 'running'].includes(record.status));
  } finally {
    teardown();
  }
});

test('killSession terminates a long-running child', async () => {
  setup();
  try {
    const result = spawnSession(fixtureRoot, {
      backplane: 'pipe',
      command: '/bin/sh',
      args: ['-c', 'while true; do sleep 1; done'],
    });
    assert.equal(result.ok, true);
    const killed = killSession(fixtureRoot, result.id);
    assert.equal(killed.ok, true);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(listLiveSessionIds().includes(result.id), false, 'session removed from live map');
  } finally {
    teardown();
  }
});

test('demo: spawn echo + replay transcript', async () => {
  setup();
  try {
    const r = spawnSession(fixtureRoot, { backplane: 'pipe', command: '/bin/echo', args: ['demo line'] });
    await new Promise((res) => setTimeout(res, 200));
    /* eslint-disable no-console */
    console.log('\n=== T-020 spawn demo ===');
    console.log(`spawned: ${r.id}`);
    console.log(`transcript: ${JSON.stringify(readTranscript(fixtureRoot, r.id))}`);
    /* eslint-enable no-console */
  } finally {
    teardown();
  }
});

function waitForServerListen(server) {
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise(server.address().port));
  });
}

function waitForWsOpen(ws) {
  return new Promise((resolvePromise, reject) => {
    ws.once('open', resolvePromise);
    ws.once('error', reject);
  });
}

function waitForMessage(ws, predicate) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      ws.off('message', onMessage);
      reject(new Error('timed out waiting for websocket message'));
    }, 2500);
    function onMessage(raw) {
      const text = raw.toString('utf-8');
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      if (!predicate(parsed)) {
        return;
      }
      clearTimeout(timeout);
      ws.off('message', onMessage);
      resolvePromise(parsed);
    }
    ws.on('message', onMessage);
  });
}

test('mounted WebSocket supports spawn, attach, input, replay, reattach, and kill', async () => {
  setup();
  const server = createServer();
  const wss = mountSessionWebSocket(server);
  let sessionId;
  try {
    const port = await waitForServerListen(server);
    const result = spawnSession(fixtureRoot, {
      backplane: 'pipe',
      command: '/bin/sh',
      args: ['-c', 'while IFS= read -r line; do printf "echo:%s\\n" "$line"; done'],
    });
    assert.equal(result.ok, true, result.error);
    sessionId = result.id;

    const wsUrl = `ws://127.0.0.1:${port}/ws/sessions/${encodeURIComponent(sessionId)}?projectRoot=${encodeURIComponent(fixtureRoot)}`;
    const ws = new WebSocket(wsUrl);
    const replayPromise = waitForMessage(ws, (msg) => msg.type === 'replay');
    await waitForWsOpen(ws);
    await replayPromise;
    ws.send(JSON.stringify({ type: 'input', data: 'hello\n' }));
    const output = await waitForMessage(ws, (msg) => msg.type === 'output' && String(msg.data).includes('echo:hello'));
    assert.match(output.data, /echo:hello/);
    ws.close();

    const ws2 = new WebSocket(wsUrl);
    const reattachReplayPromise = waitForMessage(ws2, (msg) => msg.type === 'replay' && String(msg.data).includes('echo:hello'));
    await waitForWsOpen(ws2);
    const replay = await reattachReplayPromise;
    assert.match(replay.data, /echo:hello/);
    ws2.close();

    const killed = killSession(fixtureRoot, sessionId);
    assert.equal(killed.ok, true, killed.error);
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(listLiveSessionIds(fixtureRoot).includes(sessionId), false);
  } finally {
    if (sessionId) killSession(fixtureRoot, sessionId);
    await new Promise((resolvePromise) => wss.close(resolvePromise));
    await new Promise((resolvePromise) => server.close(resolvePromise));
    teardown();
  }
});
