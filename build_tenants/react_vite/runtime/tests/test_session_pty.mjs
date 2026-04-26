// T-020 — smoke test for session-pty-service. Spawns a real /bin/echo
// child, captures transcript, asserts record persistence + exit.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import {
  spawnSession,
  killSession,
  readTranscript,
  listLiveSessionIds,
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
    const r = spawnSession(fixtureRoot, { command: '/bin/echo', args: ['demo line'] });
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
