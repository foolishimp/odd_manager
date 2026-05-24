import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  closeAllGTermSessions,
  createGTermSession,
  isOddTermScreenAvailable,
  readGTermSessionTail,
  sendGTermSessionInput,
} from '../../src/server/oddterm-pool-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_oddterm_screen');

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
