import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  closeAllGTermSessions,
  createGTermSession,
  isOddTermScreenAvailable,
  readGTermSessionTail,
  sendGTermSessionInput,
} from '../../src/server/oddterm-pool-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_oddterm_screen');
const oddtermModuleUrl = pathToFileURL(resolve(here, '../../src/server/oddterm-pool-service.mjs')).href;

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
}

function teardown() {
  try { closeAllGTermSessions(fixtureRoot); } catch { /* best effort */ }
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

async function waitFor(predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  return null;
}

const screenSkip = isOddTermScreenAvailable() ? false : 'GNU screen executable not available in this environment';

async function freshOddTermModule() {
  return import(`${oddtermModuleUrl}?restart=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test('OddTerm uses the Node GNU screen backend and streams appended output', { skip: screenSkip }, async () => {
  setup();
  try {
    const session = createGTermSession(fixtureRoot, { label: 'node-screen-proof' });
    assert.equal(session.backend, 'node-screen-pty');

    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    sendGTermSessionInput(fixtureRoot, session.id, "printf 'oddterm-node-screen-proof\\n'\r");

    const observed = await waitFor(() => {
      const tail = readGTermSessionTail(fixtureRoot, session.id, 40);
      return tail.text.includes('oddterm-node-screen-proof') ? tail : null;
    });

    assert.ok(observed, 'expected screenlog tail to append command output');
  } finally {
    teardown();
  }
});

test('OddTerm rehydrates and reconnects live screen sessions from backend state', { skip: screenSkip }, async () => {
  setup();
  let restarted = null;
  try {
    const session = createGTermSession(fixtureRoot, { label: 'node-screen-reconnect-proof' });
    assert.equal(session.backend, 'node-screen-pty');

    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
    sendGTermSessionInput(fixtureRoot, session.id, "printf 'oddterm-before-reconnect\\n'\r");
    const before = await waitFor(() => {
      const tail = readGTermSessionTail(fixtureRoot, session.id, 40);
      return tail.text.includes('oddterm-before-reconnect') ? tail : null;
    });
    assert.ok(before, 'expected output before simulated backend restart');

    restarted = await freshOddTermModule();
    const restoredState = restarted.loadGTermPoolState(fixtureRoot);
    const restored = restoredState.sessions.find((candidate) => candidate.id === session.id);
    assert.ok(restored, 'expected persisted oddterm session to be discoverable after backend restart');
    assert.equal(restored.status, 'live');
    assert.equal(restored.backend, 'node-screen-pty');
    assert.equal(typeof restored.pid, 'number');

    restarted.sendGTermSessionInput(fixtureRoot, session.id, "printf 'oddterm-after-reconnect\\n'\r");
    const after = await waitFor(() => {
      const tail = restarted.readGTermSessionTail(fixtureRoot, session.id, 80);
      return tail.text.includes('oddterm-after-reconnect') ? tail : null;
    });
    assert.ok(after, 'expected rehydrated session to accept input and append output');
  } finally {
    try { restarted?.closeAllGTermSessions(fixtureRoot); } catch { /* best effort */ }
    teardown();
  }
});
