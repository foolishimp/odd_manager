// T-021 — server-restart survival via screen backplane.
//
// Survival proof: spawn a detached screen session, simulate "server
// restart" by re-running rehydrateFromScreen against a fresh state,
// confirm the screen session is still alive and its persisted record
// status reflects 'running'.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import {
  decodeScreenTranscriptFrame,
  spawnScreenSession,
  killScreenSession,
  listScreenSessions,
  rehydrateFromScreen,
  isScreenAvailable,
} from '../../src/server/session-pty-screen.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_session_screen');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
}

function teardown(...ids) {
  for (const id of ids) {
    try { killScreenSession(fixtureRoot, id); } catch { /* ignored */ }
  }
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

const screenSkip = isScreenAvailable() ? false : 'screen executable not available in this environment';

test('Screen transcript framing preserves invalid bytes and split UTF-8 with exact byte offsets', () => {
  const writes = [
    Buffer.from([0x41, 0xff, 0xe2, 0x82]),
    Buffer.from([0xac, 0x42, 0xf0]),
    Buffer.from([0x9f, 0x98]),
    Buffer.from([0x80, 0x43]),
    Buffer.from([0xe2]),
  ];
  const expectedOffsets = [2, 6, 6, 11, 11];
  let transcript = Buffer.alloc(0);
  let offset = 0;
  let emitted = '';
  const observedOffsets = [];

  writes.forEach((write, index) => {
    transcript = Buffer.concat([transcript, write]);
    const frame = decodeScreenTranscriptFrame(transcript, offset, transcript.length);
    assert.equal(frame.offset, offset);
    assert.equal(frame.nextOffset, expectedOffsets[index]);
    assert.equal(frame.bytesConsumed, frame.nextOffset - offset);
    assert.equal(frame.observedSize, transcript.length);
    assert.equal(frame.pendingBytes, transcript.length - frame.nextOffset);
    offset = frame.nextOffset;
    observedOffsets.push(offset);
    emitted += frame.data;
  });

  assert.equal(emitted, 'A\ufffd€B😀C');
  assert.deepEqual(observedOffsets, expectedOffsets);
  assert.ok(observedOffsets.every((value, index) => index === 0 || value >= observedOffsets[index - 1]));

  const finalFrame = decodeScreenTranscriptFrame(
    transcript,
    offset,
    transcript.length,
    { final: true },
  );
  assert.equal(finalFrame.data, '\ufffd');
  assert.equal(finalFrame.nextOffset, transcript.length);
  assert.equal(finalFrame.bytesConsumed, 1);
  assert.equal(finalFrame.pendingBytes, 0);
  emitted += finalFrame.data;
  assert.equal(emitted, transcript.toString('utf8'));
});

test('spawnScreenSession launches detached screen session', { skip: screenSkip }, async () => {
  setup();
  let id;
  try {
    const result = spawnScreenSession(fixtureRoot, {
      command: '/bin/sh',
      args: ['-c', 'sleep 60'],
      contextAtSpawn: { project: 'test', workspace: 'react_vite', odd_type: 'unknown' },
    });
    assert.equal(result.ok, true, `spawn failed: ${result.error}`);
    id = result.id;
    // Give screen a moment to actually create the socket
    await new Promise((r) => setTimeout(r, 200));
    const record = JSON.parse(readFileSync(join(fixtureRoot, '.ai-workspace/runtime/sessions', `${id}.json`), 'utf-8'));
    const live = listScreenSessions().map((s) => s.id);
    assert.ok(
      live.includes(record.screen_session_id),
      `screen -ls did not show ${record.screen_session_id}; saw: ${JSON.stringify(live)}`,
    );
    assert.equal(record.status, 'running');
    assert.equal(record.backplane, 'screen');
    assert.match(record.transcript_ref, new RegExp(`${id}/screenlog\\.0$`));
  } finally {
    teardown(id);
  }
});

test('rehydrateFromScreen reconciles persisted records with live screen sessions', { skip: screenSkip }, async () => {
  setup();
  let id;
  try {
    const r1 = spawnScreenSession(fixtureRoot, { command: '/bin/sh', args: ['-c', 'sleep 60'] });
    assert.equal(r1.ok, true);
    id = r1.id;
    await new Promise((r) => setTimeout(r, 200));

    // Simulate "server restart" — call rehydrate fresh.
    const summary = rehydrateFromScreen(fixtureRoot);
    assert.ok(summary.revived.includes(id), `expected ${id} in revived; got ${JSON.stringify(summary)}`);

    const record = JSON.parse(readFileSync(join(fixtureRoot, '.ai-workspace/runtime/sessions', `${id}.json`), 'utf-8'));
    assert.equal(record.status, 'running', 'rehydrated record stays running');
  } finally {
    teardown(id);
  }
});

test('rehydrateFromScreen marks dead records stopped', { skip: screenSkip }, async () => {
  setup();
  let id;
  try {
    const r1 = spawnScreenSession(fixtureRoot, { command: '/bin/sh', args: ['-c', 'sleep 60'] });
    id = r1.id;
    await new Promise((r) => setTimeout(r, 200));
    // Kill the screen session out from under the record (no record update yet)
    killScreenSession(fixtureRoot, id);
    await new Promise((r) => setTimeout(r, 200));

    // Reset the record to 'running' to simulate "session was alive at server crash"
    const recPath = join(fixtureRoot, '.ai-workspace/runtime/sessions', `${id}.json`);
    const rec = JSON.parse(readFileSync(recPath, 'utf-8'));
    rec.status = 'running';
    rec.exited_at = undefined;
    delete rec.exit_reason;
    require_node_fs_sync_writeFileSync(recPath, JSON.stringify(rec, null, 2));

    const summary = rehydrateFromScreen(fixtureRoot);
    assert.ok(summary.marked_stopped.includes(id), `expected ${id} marked stopped; got ${JSON.stringify(summary)}`);
    const after = JSON.parse(readFileSync(recPath, 'utf-8'));
    assert.equal(after.status, 'stopped');
    assert.match(after.exit_reason, /screen session not found/);
  } finally {
    teardown(id);
  }
});

// Helper. Inline writeFileSync via dynamic import so the test stays
// vanilla-import-friendly.
import { writeFileSync as require_node_fs_sync_writeFileSync } from 'node:fs';

test('demo: spawn → rehydrate → kill', { skip: screenSkip }, async () => {
  setup();
  let id;
  try {
    const r = spawnScreenSession(fixtureRoot, { command: '/bin/sh', args: ['-c', 'sleep 60'] });
    id = r.id;
    await new Promise((res) => setTimeout(res, 200));
    /* eslint-disable no-console */
    console.log('\n=== T-021 screen-backplane demo ===');
    console.log(`spawned: ${id}`);
    const summary = rehydrateFromScreen(fixtureRoot);
    console.log(`rehydrate after simulated restart: ${JSON.stringify(summary)}`);
    /* eslint-enable no-console */
  } finally {
    teardown(id);
  }
});
