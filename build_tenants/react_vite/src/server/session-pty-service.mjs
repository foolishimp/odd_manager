// Session pty service — spawn/attach/kill backplane for the SessionAssetSurface
// write half. Closes T-020.
//
// Uses a survivable GNU screen backplane when available and a pipe-backed
// child_process fallback when explicitly requested or when screen is absent.
//
// Per-session record is persisted to .ai-workspace/runtime/sessions/<id>.json
// so the read-side SessionAssetSurface picks the new session up via its
// registry scan. Transcript is appended to .ai-workspace/runtime/sessions/<id>.transcript
// and survives the underlying process; xterm.js attach replays the
// transcript on connect.
//
// The pipe fallback is not a pty and does not survive Node server restart.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, unlinkSync, statSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
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
const DEFAULT_BACKPLANE = process.env.OMAN_SESSION_BACKPLANE || 'auto';

function sessionsRegistry(projectRoot) {
  return resolve(projectRoot, '.ai-workspace/runtime/sessions');
}

function sessionRecordPath(projectRoot, id) {
  return join(sessionsRegistry(projectRoot), `${id}.json`);
}

function transcriptPath(projectRoot, id) {
  return join(sessionsRegistry(projectRoot), `${id}.transcript`);
}

function ensureRegistry(projectRoot) {
  const dir = sessionsRegistry(projectRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function newSessionId() {
  return `sess-${randomBytes(4).toString('hex')}`;
}

// In-memory live-process map for transient pipe sessions. Rebuilt empty on
// server restart; survivable screen sessions are rehydrated from screen truth.
const liveProcesses = new Map();

function persistSessionRecord(projectRoot, record) {
  ensureRegistry(projectRoot);
  writeFileSync(sessionRecordPath(projectRoot, record.id), JSON.stringify(record, null, 2));
}

function loadSessionRecord(projectRoot, id) {
  const path = sessionRecordPath(projectRoot, id);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

function actionResult(ok, payload) {
  return { ok, ...payload };
}

function liveKey(projectRoot, id) {
  return `${resolve(projectRoot)}::${id}`;
}

function resolveBackplanePreference(requested) {
  const value = String(requested || DEFAULT_BACKPLANE || 'auto').trim().toLowerCase();
  if (['screen', 'survivable'].includes(value)) return 'screen';
  if (['pipe', 'process', 'child_process', 'transient'].includes(value)) return 'pipe';
  return 'auto';
}

export function sessionBackplaneDiagnostic() {
  const screenAvailable = isScreenAvailable();
  return {
    preferred: DEFAULT_BACKPLANE,
    screen_available: screenAvailable,
    default_backplane: screenAvailable ? 'screen' : 'pipe',
    notes: screenAvailable
      ? ['screen backplane available; sessions can survive odd_manager API restart']
      : ['screen backplane unavailable; pipe fallback sessions do not survive odd_manager API restart'],
  };
}

export function rehydrateSessions(projectRoot) {
  if (!isScreenAvailable()) {
    return { revived: [], marked_stopped: [], skipped: 'screen backplane unavailable' };
  }
  return rehydrateFromScreen(projectRoot);
}

export function spawnSession(projectRoot, { agentType = 'shell', cwd, command, args, contextAtSpawn, env: extraEnv, backplane } = {}) {
  const preference = resolveBackplanePreference(backplane);
  if (preference === 'screen' || (preference === 'auto' && isScreenAvailable())) {
    const screenResult = spawnScreenSession(projectRoot, { agentType, cwd, command, args, contextAtSpawn, env: extraEnv });
    if (screenResult.ok || preference === 'screen') {
      return screenResult;
    }
  }

  ensureRegistry(projectRoot);
  const id = newSessionId();
  const sessionCwd = cwd || projectRoot;
  const cmd = command || DEFAULT_SHELL;
  const cmdArgs = args || (cmd === DEFAULT_SHELL ? ['-l'] : []);
  const env = {
    ...process.env,
    ...extraEnv,
    ODDM_SESSION_ID: id,
    ODDM_PROJECT: contextAtSpawn?.project ?? '',
    ODDM_WORKSPACE: contextAtSpawn?.workspace ?? '',
    ODDM_ODD_TYPE: contextAtSpawn?.odd_type ?? '',
    TERM: 'xterm-256color',
  };

  let child;
  try {
    child = spawn(cmd, cmdArgs, {
      cwd: sessionCwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    return actionResult(false, { error: `spawn failed: ${err.message}` });
  }

  const tPath = transcriptPath(projectRoot, id);
  writeFileSync(tPath, '');

  const record = {
    id,
    agent_type: agentType,
    cwd: sessionCwd,
    status: 'running',
    started_at: new Date().toISOString(),
    transcript_ref: tPath.replace(`${projectRoot}/`, ''),
    context_at_spawn: contextAtSpawn ?? null,
    pid: child.pid,
    command: cmd,
    args: cmdArgs,
    backplane: 'pipe',
  };
  persistSessionRecord(projectRoot, record);

  // Append output to transcript and broadcast to attached WebSockets.
  const sockets = new Set();
  function appendOutput(buf) {
    try { appendFileSync(tPath, buf); } catch { /* best-effort */ }
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify({ type: 'output', data: buf.toString('utf-8') })); } catch { /* ignored */ }
      }
    }
  }
  child.stdout.on('data', appendOutput);
  child.stderr.on('data', appendOutput);

  child.on('exit', (code, signal) => {
    record.status = 'stopped';
    record.exit_code = code;
    record.exit_signal = signal;
    record.exited_at = new Date().toISOString();
    persistSessionRecord(projectRoot, record);
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify({ type: 'exit', code, signal })); ws.close(); } catch { /* ignored */ }
      }
    }
    liveProcesses.delete(liveKey(projectRoot, id));
  });

  liveProcesses.set(liveKey(projectRoot, id), { projectRoot, record, child, sockets });
  return actionResult(true, record);
}

export function killSession(projectRoot, id) {
  const live = liveProcesses.get(liveKey(projectRoot, id));
  if (!live) {
    const record = loadSessionRecord(projectRoot, id);
    if (record?.backplane === 'screen') {
      return killScreenSession(projectRoot, id);
    }
    if (record && record.status === 'running') {
      record.status = 'stopped';
      record.exited_at = new Date().toISOString();
      persistSessionRecord(projectRoot, record);
      return actionResult(true, { id, marked_stopped: true, note: 'process not tracked locally; record marked' });
    }
    return actionResult(false, { error: `session not live: ${id}` });
  }
  try {
    live.child.kill('SIGTERM');
  } catch (err) {
    return actionResult(false, { error: `kill failed: ${err.message}` });
  }
  return actionResult(true, { id, signaled: 'SIGTERM' });
}

export function writeToSession(projectRoot, id, data) {
  const live = liveProcesses.get(liveKey(projectRoot, id));
  if (!live) {
    const record = loadSessionRecord(projectRoot, id);
    if (record?.backplane === 'screen') {
      return sendToScreenSession(id, data);
    }
    return actionResult(false, { error: `session not live: ${id}` });
  }
  try {
    live.child.stdin.write(data);
  } catch (err) {
    return actionResult(false, { error: `write failed: ${err.message}` });
  }
  return actionResult(true, { id, bytes: Buffer.byteLength(data) });
}

export function listLiveSessionIds(projectRoot = null) {
  const pipeIds = Array.from(liveProcesses.values())
    .filter((entry) => !projectRoot || resolve(entry.projectRoot) === resolve(projectRoot))
    .map((entry) => entry.record.id);
  const screenIds = isScreenAvailable()
    ? listScreenSessions()
      .map((entry) => entry.id)
      .filter((id) => !projectRoot || loadSessionRecord(projectRoot, id)?.backplane === 'screen')
    : [];
  return Array.from(new Set([...pipeIds, ...screenIds]));
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
  const live = liveProcesses.get(liveKey(projectRoot, id));
  if (!live) {
    const record = loadSessionRecord(projectRoot, id);
    if (record?.backplane === 'screen') {
      attachScreenWebSocket(projectRoot, id, ws);
      return;
    }
    try { ws.send(JSON.stringify({ type: 'error', error: `session not live: ${id}` })); ws.close(); } catch { /* ignored */ }
    return;
  }
  // Replay transcript
  try { ws.send(JSON.stringify({ type: 'replay', data: readTranscript(projectRoot, id) })); } catch { /* ignored */ }
  live.sockets.add(ws);
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString('utf-8')); } catch { return; }
    if (msg.type === 'input' && typeof msg.data === 'string') {
      try { live.child.stdin.write(msg.data); } catch { /* ignored */ }
    } else if (msg.type === 'kill') {
      try { live.child.kill('SIGTERM'); } catch { /* ignored */ }
    }
    // 'resize' is a no-op without node-pty; documented as best-effort.
  });
  ws.on('close', () => { live.sockets.delete(ws); });
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
