import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { WebSocket } from 'ws';

import {
  attachGTermServer,
  closeAllGTermSessions,
  closeGTermSession,
  createGTermSession,
  isOddTermScreenAvailable,
  loadGTermPoolState,
  readGTermSessionTail,
  sendGTermSessionInput,
} from '../../src/server/oddterm-pool-service.mjs';
import {
  appendConversationEntry,
  ensureConversationHistory,
} from '../../src/server/conversation-history-service.mjs';
import {
  killSession,
  listLiveSessionIds,
  mountSessionWebSocket,
  readTranscript,
  spawnSession,
  writeToSession,
} from '../../src/server/session-pty-service.mjs';
import {
  isScreenAvailable,
  rehydrateFromScreen,
} from '../../src/server/session-pty-screen.mjs';

function fixture(label) {
  return mkdtempSync(join(tmpdir(), `odd-manager-${label}-`));
}

function legacyScreenId(projectRoot, sessionId) {
  const projectKey = createHash('sha256')
    .update(resolve(projectRoot))
    .digest('hex')
    .slice(0, 12);
  return `oddm_${projectKey}_${sessionId.replace(/-/g, '')}`;
}

function oddTermScreenId(projectRoot, sessionId) {
  const projectKey = createHash('sha256')
    .update(resolve(projectRoot))
    .digest('hex')
    .slice(0, 12);
  return `oddterm_${projectKey}_${sessionId.replace(/-/g, '')}`;
}

function canonicalLegacyRecord(projectRoot, sessionId) {
  return {
    id: sessionId,
    project_root: resolve(projectRoot),
    screen_session_id: legacyScreenId(projectRoot, sessionId),
    agent_type: 'shell',
    cwd: resolve(projectRoot),
    status: 'running',
    started_at: '2026-07-27T00:00:00.000Z',
    transcript_ref: `.ai-workspace/runtime/sessions/${sessionId}/screenlog.0`,
    context_at_spawn: null,
    backplane: 'screen',
    command: '/bin/sh',
    args: [],
  };
}

function waitForWsMessage(socket) {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for websocket response')), 2500);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      resolvePromise(JSON.parse(raw.toString('utf8')));
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

test('terminal runtime roots, records, transcripts, and traversal ids fail closed before carrier use', () => {
  const oddtermProject = fixture('oddterm-runtime-symlink');
  const sessionProject = fixture('session-runtime-symlink');
  const transcriptProject = fixture('session-transcript-symlink');
  const outside = fixture('terminal-outside');
  try {
    mkdirSync(join(oddtermProject, '.ai-workspace', 'runtime'), { recursive: true });
    symlinkSync(outside, join(oddtermProject, '.ai-workspace', 'runtime', 'oddterm'));
    assert.throws(
      () => loadGTermPoolState(oddtermProject),
      /non-symlink directory/,
    );

    mkdirSync(join(sessionProject, '.ai-workspace', 'runtime'), { recursive: true });
    symlinkSync(outside, join(sessionProject, '.ai-workspace', 'runtime', 'sessions'));
    assert.throws(
      () => rehydrateFromScreen(sessionProject),
      /non-symlink directory/,
    );
    assert.equal(readTranscript(sessionProject, 'sess-deadbeef'), '');
    assert.equal(writeToSession(sessionProject, 'sess-deadbeef', 'do-not-send').ok, false);
    assert.equal(killSession(sessionProject, 'sess-deadbeef').ok, false);

    const sessionId = 'sess-deadbeef';
    const registry = join(transcriptProject, '.ai-workspace', 'runtime', 'sessions');
    const sessionDir = join(registry, sessionId);
    mkdirSync(sessionDir, { recursive: true });
    const externalTranscript = join(outside, 'external-transcript.txt');
    writeFileSync(externalTranscript, 'outside-secret\n', 'utf8');
    symlinkSync(externalTranscript, join(sessionDir, 'screenlog.0'));
    writeFileSync(
      join(registry, `${sessionId}.json`),
      JSON.stringify(canonicalLegacyRecord(transcriptProject, sessionId), null, 2),
      'utf8',
    );
    const rejected = rehydrateFromScreen(transcriptProject);
    assert.deepEqual(rejected.rejected, [sessionId]);
    assert.equal(readTranscript(transcriptProject, sessionId), '');
    assert.equal(writeToSession(transcriptProject, sessionId, 'do-not-send').ok, false);
    assert.equal(killSession(transcriptProject, sessionId).ok, false);
    assert.equal(readFileSync(externalTranscript, 'utf8'), 'outside-secret\n');

    for (const unsafeId of [
      '../sess-deadbeef',
      'sess-deadbeef/../../outside',
      'sess-deadbeef%2F..%2Foutside',
    ]) {
      assert.equal(readTranscript(transcriptProject, unsafeId), '');
      assert.equal(writeToSession(transcriptProject, unsafeId, 'do-not-send').ok, false);
      assert.equal(killSession(transcriptProject, unsafeId).ok, false);
    }
  } finally {
    rmSync(oddtermProject, { recursive: true, force: true });
    rmSync(sessionProject, { recursive: true, force: true });
    rmSync(transcriptProject, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('copied cross-Project conversation history cannot become OddTerm replay authority', () => {
  const sourceProject = fixture('oddterm-history-source');
  const victimProject = fixture('oddterm-history-victim');
  const sessionId = '12345678-1234-4123-8123-123456789abc';
  const historyId = `oddterm_${sessionId}`;
  try {
    ensureConversationHistory(sourceProject, {
      historyId,
      ownerKind: 'oddterm_session',
      ownerRef: sessionId,
    });
    appendConversationEntry(sourceProject, historyId, {
      entryKind: 'output',
      payload: { text: 'SOURCE-ONLY\n' },
    });

    const sourceHistory = join(
      sourceProject,
      '.ai-workspace',
      'runtime',
      'conversation_history',
      historyId,
    );
    const victimHistory = join(
      victimProject,
      '.ai-workspace',
      'runtime',
      'conversation_history',
      historyId,
    );
    mkdirSync(join(victimProject, '.ai-workspace', 'runtime', 'conversation_history'), {
      recursive: true,
    });
    cpSync(sourceHistory, victimHistory, { recursive: true });

    const victimSessionRoot = join(
      victimProject,
      '.ai-workspace',
      'runtime',
      'oddterm',
      sessionId,
    );
    mkdirSync(victimSessionRoot, { recursive: true });
    writeFileSync(
      join(victimSessionRoot, 'meta.json'),
      `${JSON.stringify({
        id: sessionId,
        workspaceRoot: victimProject,
        cwd: victimProject,
        label: 'copied-history',
        archived: false,
        status: 'closed',
        shell: null,
        pid: null,
        backend: null,
        screenSessionId: oddTermScreenId(victimProject, sessionId),
        transcriptPath: join(victimSessionRoot, 'screenlog.0'),
        createdAt: '2026-07-27T00:00:00.000Z',
        lastOutputAt: null,
        attachedTrainId: null,
        attachedStationId: null,
        attachedEdgeId: null,
        conversationHistoryId: historyId,
        historyBytes: 0,
        terminalSize: null,
        lastResizeAt: null,
        exitCode: null,
        signal: null,
        screenLogOffset: 0,
      }, null, 2)}\n`,
      'utf8',
    );

    const state = loadGTermPoolState(victimProject);
    assert.equal(state.sessions.some((entry) => entry.id === sessionId), false);
    assert.throws(
      () => readGTermSessionTail(victimProject, sessionId),
      /terminal session not found/,
    );

    const victimHistoryMetaPath = join(victimHistory, 'meta.json');
    const victimHistoryMeta = JSON.parse(readFileSync(victimHistoryMetaPath, 'utf8'));
    writeFileSync(
      victimHistoryMetaPath,
      `${JSON.stringify({
        ...victimHistoryMeta,
        workspaceRoot: victimProject,
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      join(victimHistory, 'entries.ndjson'),
      `${JSON.stringify({
        entryId: 'foreign-entry',
        conversationHistoryId: 'oddterm_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        entryKind: 'output',
        actorRef: null,
        createdAt: '2026-07-27T00:00:01.000Z',
        payload: { text: 'FOREIGN-ENTRY\n' },
      })}\n`,
      'utf8',
    );
    const foreignEntryState = loadGTermPoolState(victimProject);
    assert.equal(
      foreignEntryState.sessions.some((entry) => entry.id === sessionId),
      false,
    );

    assert.equal(
      readFileSync(join(sourceHistory, 'entries.ndjson'), 'utf8').includes('SOURCE-ONLY'),
      true,
    );
  } finally {
    rmSync(sourceProject, { recursive: true, force: true });
    rmSync(victimProject, { recursive: true, force: true });
  }
});

test('encoded slash session identities cannot cross the WebSocket registry boundary', async () => {
  const projectRoot = fixture('session-encoded-identity');
  const outside = fixture('session-encoded-outside');
  const marker = join(outside, 'marker.txt');
  const server = createServer();
  const wss = mountSessionWebSocket(server, {
    defaultProjectRoot: projectRoot,
    admitProjectRoot: () => resolve(projectRoot),
  });
  let socket = null;
  try {
    writeFileSync(marker, 'unchanged\n', 'utf8');
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    socket = new WebSocket(
      `ws://127.0.0.1:${address.port}/ws/sessions/sess-deadbeef%2F..%2Foutside?projectRoot=${encodeURIComponent(projectRoot)}`,
    );
    const response = await waitForWsMessage(socket);
    assert.equal(response.type, 'error');
    assert.match(response.error, /session not live/);
    assert.equal(readFileSync(marker, 'utf8'), 'unchanged\n');
  } finally {
    socket?.terminate();
    await new Promise((resolvePromise) => wss.close(resolvePromise));
    if (server.listening) {
      await new Promise((resolvePromise) => server.close(resolvePromise));
    }
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

const screenSkip = (
  isScreenAvailable() && isOddTermScreenAvailable()
    ? false
    : 'GNU screen executable not available in this environment'
);

test('copied cross-Project terminal metadata cannot rehydrate, attach, read, input, or kill', { skip: screenSkip }, async () => {
  const sourceProject = fixture('terminal-authority-source');
  const victimProject = fixture('terminal-authority-victim');
  let oddtermSession = null;
  let legacySession = null;
  let server = null;
  let oddtermWss = null;
  let legacyWss = null;
  let oddtermSocket = null;
  let legacySocket = null;
  try {
    oddtermSession = createGTermSession(sourceProject, { label: 'source-oddterm' });
    legacySession = spawnSession(sourceProject, {
      command: '/bin/sh',
      args: ['-c', 'sleep 60'],
    });
    assert.equal(legacySession.ok, true, legacySession.error);

    const sourceOddtermDir = join(
      sourceProject,
      '.ai-workspace',
      'runtime',
      'oddterm',
      oddtermSession.id,
    );
    const victimOddtermDir = join(
      victimProject,
      '.ai-workspace',
      'runtime',
      'oddterm',
      oddtermSession.id,
    );
    mkdirSync(join(victimProject, '.ai-workspace', 'runtime', 'oddterm'), { recursive: true });
    cpSync(sourceOddtermDir, victimOddtermDir, { recursive: true });

    const sourceSessionRegistry = join(sourceProject, '.ai-workspace', 'runtime', 'sessions');
    const victimSessionRegistry = join(victimProject, '.ai-workspace', 'runtime', 'sessions');
    mkdirSync(victimSessionRegistry, { recursive: true });
    cpSync(
      join(sourceSessionRegistry, legacySession.id),
      join(victimSessionRegistry, legacySession.id),
      { recursive: true },
    );
    cpSync(
      join(sourceSessionRegistry, `${legacySession.id}.json`),
      join(victimSessionRegistry, `${legacySession.id}.json`),
    );

    assert.equal(
      loadGTermPoolState(victimProject).sessions.some((entry) => entry.id === oddtermSession.id),
      false,
    );
    assert.throws(
      () => sendGTermSessionInput(victimProject, oddtermSession.id, 'do-not-send'),
      /terminal session not found/,
    );
    assert.throws(
      () => closeGTermSession(victimProject, oddtermSession.id),
      /terminal session not found/,
    );

    const legacyRecovery = rehydrateFromScreen(victimProject);
    assert.deepEqual(legacyRecovery.rejected, [legacySession.id]);
    assert.equal(readTranscript(victimProject, legacySession.id), '');
    assert.equal(writeToSession(victimProject, legacySession.id, 'do-not-send').ok, false);
    assert.equal(killSession(victimProject, legacySession.id).ok, false);
    assert.equal(listLiveSessionIds(victimProject).includes(legacySession.id), false);

    server = createServer();
    oddtermWss = attachGTermServer(server, {
      defaultWorkspaceRoot: victimProject,
      admitProjectRoot: () => resolve(victimProject),
    });
    legacyWss = mountSessionWebSocket(server, {
      defaultProjectRoot: victimProject,
      admitProjectRoot: () => resolve(victimProject),
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address === 'object');

    oddtermSocket = new WebSocket(
      `ws://127.0.0.1:${address.port}/api/oddterm?workspaceRoot=${encodeURIComponent(victimProject)}&sessionId=${encodeURIComponent(oddtermSession.id)}`,
    );
    const oddtermError = await waitForWsMessage(oddtermSocket);
    assert.equal(oddtermError.type, 'error');
    assert.match(oddtermError.message, /terminal session not found/);

    legacySocket = new WebSocket(
      `ws://127.0.0.1:${address.port}/ws/sessions/${encodeURIComponent(legacySession.id)}?projectRoot=${encodeURIComponent(victimProject)}`,
    );
    const legacyError = await waitForWsMessage(legacySocket);
    assert.equal(legacyError.type, 'error');
    assert.match(legacyError.error, /session not live/);

    assert.equal(
      loadGTermPoolState(sourceProject).sessions.find(
        (entry) => entry.id === oddtermSession.id,
      )?.status,
      'live',
    );
    assert.equal(listLiveSessionIds(sourceProject).includes(legacySession.id), true);
  } finally {
    oddtermSocket?.terminate();
    legacySocket?.terminate();
    oddtermWss?.close();
    legacyWss?.close();
    if (server?.listening) {
      await new Promise((resolvePromise) => server.close(resolvePromise));
    }
    try { closeAllGTermSessions(sourceProject); } catch { /* best effort */ }
    if (legacySession?.id) {
      try { killSession(sourceProject, legacySession.id); } catch { /* best effort */ }
    }
    rmSync(sourceProject, { recursive: true, force: true });
    rmSync(victimProject, { recursive: true, force: true });
  }
});
