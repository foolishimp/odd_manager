// Session pty service — spawn/attach/kill backplane for the SessionAssetSurface
// write half. Closes T-020.
//
// Uses a survivable GNU screen backplane. There is no pipe fallback.
//
// Per-session record is persisted to .ai-workspace/runtime/sessions/<id>.json
// so the read-side SessionAssetSurface picks the new session up via its
// registry scan. screen writes screenlog.0 in the per-session directory;
// xterm.js attach replays the transcript on connect and polls appended output.
//
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import {
  isScreenAvailable,
  killScreenSession,
  listScreenSessions,
  rehydrateFromScreen,
  sendToScreenSession,
  spawnScreenSession,
} from './session-pty-screen.mjs';

const DEFAULT_SHELL = process.env.SHELL || '/bin/bash';

function sessionsRegistry(projectRoot) {
  return resolve(projectRoot, '.ai-workspace/runtime/sessions');
}

function sessionRecordPath(projectRoot, id) {
  return join(sessionsRegistry(projectRoot), `${id}.json`);
}

function transcriptPath(projectRoot, id) {
  return join(sessionsRegistry(projectRoot), `${id}.transcript`);
}

function loadSessionRecord(projectRoot, id) {
  const path = sessionRecordPath(projectRoot, id);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function actionResult(ok, payload) {
  return { ok, ...payload };
}

export function sessionBackplaneDiagnostic() {
  const screenAvailable = isScreenAvailable();
  return {
    preferred: 'screen',
    screen_available: screenAvailable,
    default_backplane: 'screen',
    notes: screenAvailable
      ? ['screen backplane available; sessions can survive odd_manager API restart']
      : ['screen backplane unavailable; session spawn fails closed'],
  };
}

export function rehydrateSessions(projectRoot) {
  if (!isScreenAvailable()) {
    return { revived: [], marked_stopped: [], skipped: 'screen backplane unavailable' };
  }
  return rehydrateFromScreen(projectRoot);
}

export function spawnSession(projectRoot, { agentType = 'shell', cwd, command, args, contextAtSpawn, env: extraEnv } = {}) {
  if (!isScreenAvailable()) {
    return actionResult(false, { error: 'screen backplane unavailable: screen executable not found' });
  }
  return spawnScreenSession(projectRoot, {
    agentType,
    cwd,
    command: command || DEFAULT_SHELL,
    args,
    contextAtSpawn,
    env: extraEnv,
  });
}

export function killSession(projectRoot, id) {
  const record = loadSessionRecord(projectRoot, id);
  if (record?.backplane === 'screen') {
    return killScreenSession(projectRoot, id);
  }
  return actionResult(false, { error: `screen session not found: ${id}` });
}

export function writeToSession(projectRoot, id, data) {
  const record = loadSessionRecord(projectRoot, id);
  if (record?.backplane === 'screen') {
    return sendToScreenSession(id, data);
  }
  return actionResult(false, { error: `session not live: ${id}` });
}

export function listLiveSessionIds(projectRoot = null) {
  const screenIds = isScreenAvailable()
    ? listScreenSessions()
      .map((entry) => entry.id)
      .filter((id) => !projectRoot || loadSessionRecord(projectRoot, id)?.backplane === 'screen')
    : [];
  return Array.from(new Set(screenIds));
}

// Replay transcript for a freshly-attached client.
export function readTranscript(projectRoot, id) {
  const record = loadSessionRecord(projectRoot, id);
  const tPath = record?.transcript_ref ? resolve(projectRoot, record.transcript_ref) : transcriptPath(projectRoot, id);
  if (!existsSync(tPath)) return '';
  try { return readFileSync(tPath, 'utf-8'); } catch { return ''; }
}

function transcriptAbsolutePath(projectRoot, id) {
  const record = loadSessionRecord(projectRoot, id);
  return record?.transcript_ref ? resolve(projectRoot, record.transcript_ref) : transcriptPath(projectRoot, id);
}

// Attach a WebSocket to a live session. Replays transcript first then
// streams new output. Inbound messages are typed as { type: 'input',
// data: string } | { type: 'resize', cols, rows } | { type: 'kill' }.
function attachScreenWebSocket(projectRoot, id, ws) {
  const record = loadSessionRecord(projectRoot, id);
  const liveScreenIds = new Set(isScreenAvailable() ? listScreenSessions().map((entry) => entry.id) : []);
  if (!record || record.backplane !== 'screen' || !liveScreenIds.has(id)) {
    try { ws.send(JSON.stringify({ type: 'error', error: `session not live: ${id}` })); ws.close(); } catch { /* ignored */ }
    return;
  }

  const tPath = transcriptAbsolutePath(projectRoot, id);
  let offset = 0;
  try {
    const replay = readTranscript(projectRoot, id);
    offset = Buffer.byteLength(replay);
    ws.send(JSON.stringify({ type: 'replay', data: replay }));
  } catch { /* ignored */ }

  const poll = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;
    let currentSize;
    try {
      currentSize = statSync(tPath).size;
    } catch {
      return;
    }
    if (currentSize <= offset) return;
    try {
      const content = readFileSync(tPath);
      const chunk = content.slice(offset, currentSize).toString('utf-8');
      offset = currentSize;
      if (chunk) ws.send(JSON.stringify({ type: 'output', data: chunk }));
    } catch { /* ignored */ }
  }, 100);
  if (typeof poll.unref === 'function') poll.unref();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString('utf-8')); } catch { return; }
    if (msg.type === 'input' && typeof msg.data === 'string') {
      sendToScreenSession(id, msg.data);
    } else if (msg.type === 'kill') {
      killScreenSession(projectRoot, id);
    }
    // Screen resize is intentionally not claimed as native pty resize.
  });
  ws.on('close', () => clearInterval(poll));
}

export function attachWebSocket(projectRoot, id, ws) {
  const record = loadSessionRecord(projectRoot, id);
  if (record?.backplane === 'screen') {
    attachScreenWebSocket(projectRoot, id, ws);
    return;
  }
  try { ws.send(JSON.stringify({ type: 'error', error: `session not live: ${id}` })); ws.close(); } catch { /* ignored */ }
}

// Mount a WebSocketServer on an existing http.Server. Path: /ws/sessions/:id.
// Project root is resolved per-connection via the ?projectRoot= query string.
export function mountSessionWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/ws\/sessions\/([^/]+)$/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    const projectRoot = url.searchParams.get('projectRoot') || process.cwd();
    wss.handleUpgrade(request, socket, head, (ws) => {
      attachWebSocket(projectRoot, id, ws);
    });
  });
  return wss;
}
