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
import { WebSocketServer } from 'ws';
import {
  decodeScreenTranscriptFrame,
  isScreenAvailable,
  killScreenSession,
  listAdmittedLiveScreenSessionIds,
  listScreenSessions,
  loadScreenSessionRecord,
  readScreenSessionTranscript,
  readScreenSessionTranscriptBytes,
  rehydrateFromScreen,
  sendToScreenSession,
  spawnScreenSession,
  statScreenSessionTranscript,
} from './session-pty-screen.mjs';
import { admitProjectWorkingDirectory } from './project-context-admission-service.mjs';

const DEFAULT_SHELL = process.env.SHELL || '/bin/bash';

function loadSessionRecord(projectRoot, id) {
  try {
    return loadScreenSessionRecord(projectRoot, id);
  } catch {
    return null;
  }
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
  let admittedCwd;
  try {
    admittedCwd = admitProjectWorkingDirectory(projectRoot, cwd);
  } catch (error) {
    return actionResult(false, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return spawnScreenSession(projectRoot, {
    agentType,
    cwd: admittedCwd,
    command: command || DEFAULT_SHELL,
    args,
    contextAtSpawn,
    env: extraEnv,
  });
}

export function killSession(projectRoot, id) {
  const record = loadSessionRecord(projectRoot, id);
  if (record?.backplane === 'screen') {
    try {
      return killScreenSession(projectRoot, record.id);
    } catch (error) {
      return actionResult(false, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return actionResult(false, { error: `screen session not found: ${id}` });
}

export function writeToSession(projectRoot, id, data) {
  const record = loadSessionRecord(projectRoot, id);
  if (record?.backplane === 'screen') {
    try {
      return sendToScreenSession(projectRoot, record.id, data);
    } catch (error) {
      return actionResult(false, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return actionResult(false, { error: `session not live: ${id}` });
}

export function listLiveSessionIds(projectRoot = null) {
  if (!projectRoot || !isScreenAvailable()) return [];
  try {
    return listAdmittedLiveScreenSessionIds(projectRoot);
  } catch {
    return [];
  }
}

// Replay transcript for a freshly-attached client.
export function readTranscript(projectRoot, id) {
  try {
    return readScreenSessionTranscript(projectRoot, id);
  } catch {
    return '';
  }
}

// Attach a WebSocket to a live session. Replays transcript first then
// streams new output. Inbound messages are typed as { type: 'input',
// data: string } | { type: 'resize', cols, rows } | { type: 'kill' }.
function attachScreenWebSocket(projectRoot, id, ws) {
  const record = loadSessionRecord(projectRoot, id);
  const liveScreenIds = new Set(isScreenAvailable() ? listScreenSessions().map((entry) => entry.id) : []);
  if (!record || record.backplane !== 'screen' || !liveScreenIds.has(record.screen_session_id)) {
    try { ws.send(JSON.stringify({ type: 'error', error: `session not live: ${id}` })); ws.close(); } catch { /* ignored */ }
    return;
  }

  let offset = 0;
  try {
    const content = readScreenSessionTranscriptBytes(projectRoot, id);
    const replay = decodeScreenTranscriptFrame(content);
    offset = replay.nextOffset;
    ws.send(JSON.stringify({ type: 'replay', data: replay.data }));
  } catch { /* ignored */ }

  const poll = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;
    let currentSize;
    try {
      currentSize = statScreenSessionTranscript(projectRoot, id)?.size ?? 0;
    } catch {
      try {
        ws.send(JSON.stringify({ type: 'error', error: 'session transcript carrier is not admitted' }));
        ws.close();
      } catch {
        // ignored
      }
      return;
    }
    if (currentSize < offset) offset = 0;
    if (currentSize <= offset) return;
    try {
      const content = readScreenSessionTranscriptBytes(projectRoot, id);
      const output = decodeScreenTranscriptFrame(content, offset, currentSize);
      offset = output.nextOffset;
      if (output.data) ws.send(JSON.stringify({ type: 'output', data: output.data }));
    } catch { /* ignored */ }
  }, 100);
  if (typeof poll.unref === 'function') poll.unref();

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString('utf-8')); } catch { return; }
    try {
      if (msg.type === 'input' && typeof msg.data === 'string') {
        const result = sendToScreenSession(projectRoot, id, msg.data);
        if (!result.ok) throw new Error(result.error);
      } else if (msg.type === 'kill') {
        const result = killScreenSession(projectRoot, id);
        if (!result.ok) throw new Error(result.error);
      }
    } catch (error) {
      try {
        ws.send(JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        }));
        ws.close();
      } catch {
        // ignored
      }
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

function rejectSessionUpgrade(socket, error) {
  const statusCode = error?.statusCode === 403 ? 403 : 400;
  const statusText = statusCode === 403 ? 'Forbidden' : 'Bad Request';
  const body = JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  });
  socket.end([
    `HTTP/1.1 ${statusCode} ${statusText}`,
    'Connection: close',
    'Content-Type: application/json; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    '',
    body,
  ].join('\r\n'));
}

// Mount a WebSocketServer on an existing http.Server. Path: /ws/sessions/:id.
// Project root is admitted per connection through the exact Project registry.
export function mountSessionWebSocket(httpServer, options = {}) {
  if (typeof options.admitProjectRoot !== 'function') {
    throw new Error('Session WebSocket requires Project Context admission.');
  }
  const defaultProjectRoot = options.defaultProjectRoot ?? process.cwd();
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/ws\/sessions\/([^/]+)$/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    let projectRoot;
    try {
      projectRoot = options.admitProjectRoot(
        url.searchParams.get('projectRoot') || defaultProjectRoot,
      );
    } catch (error) {
      rejectSessionUpgrade(socket, error);
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      attachWebSocket(projectRoot, id, ws);
    });
  });
  return wss;
}
