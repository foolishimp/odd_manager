// Session pty backplane via GNU `screen` — closes T-021 (server-restart
// survival). Sessions spawned through this module live in the screen
// daemon, NOT in this Node server's process tree, so they outlive
// odd_manager server restart.
//
// Backplane choice rationale:
//   - tmux is preferred upstream but is not installed by default on macOS
//   - screen ships with macOS (and most BSD/Linux), making it the
//     zero-install survivable backplane
//   - dtach would also work but is even less standard
//
// Design recorded inline; the formal ADR amendment is a circle-back
// (lives at build_tenants/react_vite/design/adr/0002-session-survival-backplane.md
// when authored).
//
// Survival contract:
//   1. spawnScreenSession kicks off `screen -dmS <id> <command>` —
//      detached daemon process, parent PID is screen, not this Node.
//   2. listScreenSessions parses `screen -ls` output for session names.
//   3. killScreenSession runs `screen -S <id> -X quit`.
//   4. rehydrateFromScreen reconciles persisted SessionRecord JSONs in
//      .ai-workspace/runtime/sessions/ with `screen -ls` truth: alive
//      records get status='running', records whose screen session is
//      gone get marked stopped.
//
// Output streaming for attached xterm.js is a follow-up — screen logs
// to its own hardcopy/log file rather than a pipe, which needs a
// different attach pattern than the direct-spawn version. For T-021
// closure the load-bearing property is *survival* of the underlying
// pty across server restart; live attach via screen is documented as
// circle-back.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { admitProjectWorkingDirectory } from './project-context-admission-service.mjs';
import {
  admitProjectRuntimeDirectory,
  admitProjectRuntimeFile,
  projectRuntimeLexicalPath,
  readProjectRuntimeFile,
  statProjectRuntimeFile,
  writeProjectRuntimeFile,
} from './project-runtime-carrier-service.mjs';

const SESSION_RUNTIME_SEGMENTS = ['.ai-workspace', 'runtime', 'sessions'];
const SESSION_ID = /^sess-[a-f0-9]{8}$/;

function trailingIncompleteUtf8ByteLength(bytes) {
  const scanStart = Math.max(0, bytes.length - 3);
  for (let index = bytes.length - 1; index >= scanStart; index -= 1) {
    const byte = bytes[index];
    if (byte <= 0x7f) return 0;
    if (byte >= 0x80 && byte <= 0xbf) continue;

    let expectedLength = 0;
    if (byte >= 0xc2 && byte <= 0xdf) expectedLength = 2;
    else if (byte >= 0xe0 && byte <= 0xef) expectedLength = 3;
    else if (byte >= 0xf0 && byte <= 0xf4) expectedLength = 4;
    else return 0;

    const availableLength = bytes.length - index;
    if (availableLength >= expectedLength) return 0;
    for (let continuation = index + 1; continuation < bytes.length; continuation += 1) {
      if (bytes[continuation] < 0x80 || bytes[continuation] > 0xbf) return 0;
    }

    if (availableLength >= 2) {
      const second = bytes[index + 1];
      if (
        (byte === 0xe0 && second < 0xa0)
        || (byte === 0xed && second > 0x9f)
        || (byte === 0xf0 && second < 0x90)
        || (byte === 0xf4 && second > 0x8f)
      ) {
        return 0;
      }
    }
    return availableLength;
  }
  return 0;
}

// Decode only the complete UTF-8 prefix visible in one transcript snapshot.
// Raw byte offsets never pass a valid partial trailing sequence, so the next
// snapshot re-reads that sequence and completes it without replacement,
// duplication, or process-local decoder state.
export function decodeScreenTranscriptFrame(content, offset = 0, observedSize = undefined, options = {}) {
  if (!Buffer.isBuffer(content) && !(content instanceof Uint8Array)) {
    throw new TypeError('screen transcript content must be bytes');
  }
  const bytes = Buffer.isBuffer(content)
    ? content
    : Buffer.from(content.buffer, content.byteOffset, content.byteLength);
  const end = observedSize ?? bytes.length;
  if (
    !Number.isSafeInteger(offset)
    || !Number.isSafeInteger(end)
    || offset < 0
    || end < offset
    || end > bytes.length
  ) {
    throw new RangeError('screen transcript byte range is invalid');
  }
  const available = bytes.subarray(offset, end);
  const pendingBytes = options.final === true
    ? 0
    : trailingIncompleteUtf8ByteLength(available);
  const bytesConsumed = available.length - pendingBytes;
  const nextOffset = offset + bytesConsumed;
  return {
    data: available.subarray(0, bytesConsumed).toString('utf8'),
    offset,
    nextOffset,
    observedSize: end,
    bytesConsumed,
    pendingBytes,
  };
}

function admittedSessionId(value) {
  const id = String(value ?? '');
  if (!SESSION_ID.test(id)) {
    throw new Error('session identity is not canonical');
  }
  return id;
}

function sessionSegments(id) {
  return [...SESSION_RUNTIME_SEGMENTS, admittedSessionId(id)];
}

function canonicalScreenSessionId(projectRoot, id) {
  const projectKey = createHash('sha256')
    .update(resolve(projectRoot))
    .digest('hex')
    .slice(0, 12);
  return `oddm_${projectKey}_${admittedSessionId(id).replace(/-/g, '')}`;
}

function sessionsRegistry(projectRoot, create = false) {
  return admitProjectRuntimeDirectory(projectRoot, SESSION_RUNTIME_SEGMENTS, { create });
}

function sessionDirectory(projectRoot, id, create = false) {
  return admitProjectRuntimeDirectory(projectRoot, sessionSegments(id), { create });
}

export function screenTranscriptPath(projectRoot, id) {
  return admitProjectRuntimeFile(projectRoot, sessionSegments(id), 'screenlog.0');
}

function ensureRegistry(projectRoot) {
  return sessionsRegistry(projectRoot, true);
}

function recordPath(projectRoot, id) {
  return admitProjectRuntimeFile(
    projectRoot,
    SESSION_RUNTIME_SEGMENTS,
    `${admittedSessionId(id)}.json`,
  );
}

function newSessionId() {
  return `sess-${randomBytes(4).toString('hex')}`;
}

function actionResult(ok, payload) {
  return { ok, ...payload };
}

function canonicalTranscriptRef(projectRoot, id) {
  return relative(resolve(projectRoot), screenTranscriptPath(projectRoot, id))
    .split('\\')
    .join('/');
}

function admittedRecord(projectRoot, idValue, record, options = {}) {
  const id = admittedSessionId(idValue);
  const project = resolve(projectRoot);
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('session record must be an object');
  }
  if (
    record.id !== id
    || record.project_root !== project
    || record.screen_session_id !== canonicalScreenSessionId(project, id)
    || record.backplane !== 'screen'
  ) {
    throw new Error('session record identity does not match its admitted Project carrier');
  }
  const cwd = admitProjectWorkingDirectory(project, record.cwd);
  sessionDirectory(project, id);
  const transcriptPath = admitProjectRuntimeFile(
    project,
    sessionSegments(id),
    'screenlog.0',
    { mustExist: options.requireTranscript === true },
  );
  const transcriptRef = relative(project, transcriptPath).split('\\').join('/');
  if (record.transcript_ref !== transcriptRef) {
    throw new Error('session transcript carrier is not canonical');
  }
  return {
    ...record,
    id,
    project_root: project,
    screen_session_id: canonicalScreenSessionId(project, id),
    cwd,
    transcript_ref: transcriptRef,
  };
}

function persistRecord(projectRoot, record) {
  ensureRegistry(projectRoot);
  const admitted = admittedRecord(projectRoot, record.id, record, {
    requireTranscript: true,
  });
  writeProjectRuntimeFile(
    projectRoot,
    SESSION_RUNTIME_SEGMENTS,
    `${admitted.id}.json`,
    JSON.stringify(admitted, null, 2),
    { encoding: 'utf8' },
  );
}

function loadRecord(projectRoot, id) {
  const admittedId = admittedSessionId(id);
  const lexicalRegistry = projectRuntimeLexicalPath(projectRoot, SESSION_RUNTIME_SEGMENTS);
  if (!existsSync(lexicalRegistry)) return null;
  sessionsRegistry(projectRoot);
  const path = recordPath(projectRoot, admittedId);
  if (!existsSync(path)) return null;
  const record = JSON.parse(readProjectRuntimeFile(
    projectRoot,
    SESSION_RUNTIME_SEGMENTS,
    `${admittedId}.json`,
    { encoding: 'utf8' },
  ));
  return admittedRecord(projectRoot, admittedId, record, { requireTranscript: true });
}

export function loadScreenSessionRecord(projectRoot, id) {
  return loadRecord(projectRoot, id);
}

export function readScreenSessionTranscriptBytes(projectRoot, id) {
  const record = loadRecord(projectRoot, id);
  if (!record) return Buffer.alloc(0);
  return readProjectRuntimeFile(
    projectRoot,
    sessionSegments(record.id),
    'screenlog.0',
  );
}

export function readScreenSessionTranscript(projectRoot, id) {
  return readScreenSessionTranscriptBytes(projectRoot, id).toString('utf8');
}

export function statScreenSessionTranscript(projectRoot, id) {
  const record = loadRecord(projectRoot, id);
  if (!record) return null;
  return statProjectRuntimeFile(projectRoot, sessionSegments(record.id), 'screenlog.0');
}

export function listAdmittedLiveScreenSessionIds(projectRoot) {
  const lexicalRegistry = projectRuntimeLexicalPath(projectRoot, SESSION_RUNTIME_SEGMENTS);
  if (!existsSync(lexicalRegistry)) return [];
  const registry = sessionsRegistry(projectRoot);
  const liveScreenIds = new Set(listScreenSessions().map((entry) => entry.id));
  const admitted = [];
  for (const filename of readdirSync(registry)) {
    const match = filename.match(/^(sess-[a-f0-9]{8})\.json$/);
    if (!match) continue;
    try {
      const record = loadRecord(projectRoot, match[1]);
      if (record && liveScreenIds.has(record.screen_session_id)) {
        admitted.push(record.id);
      }
    } catch {
      // Invalid persisted records confer no live-session authority.
    }
  }
  return admitted;
}

// Parse `screen -ls` output. Format example:
//   There are screens on:
//           12345.sess-abc1     (Detached)
//           67890.sess-def2     (Attached)
//   2 Sockets in /var/folders/...
// We extract the session name (after the '.').
export function listScreenSessions() {
  const out = spawnSync('screen', ['-ls'], { encoding: 'utf-8' });
  // `screen -ls` exits 1 when no sessions exist; treat that as empty.
  const text = (out.stdout || '') + (out.stderr || '');
  const ids = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s+\d+\.([^\s]+)\s+\((Attached|Detached)\)/);
    if (m) ids.push({ id: m[1], state: m[2].toLowerCase() });
  }
  return ids;
}

let screenAvailableCache = null;

export function isScreenAvailable() {
  if (screenAvailableCache !== null) {
    return screenAvailableCache;
  }
  const out = spawnSync('screen', ['-ls'], { encoding: 'utf-8' });
  if (out.error?.code === 'ENOENT') {
    screenAvailableCache = false;
    return screenAvailableCache;
  }
  const probeId = `oddm-probe-${process.pid}-${randomBytes(2).toString('hex')}`;
  spawnSync('screen', ['-dmS', probeId, '/bin/sh', '-c', 'sleep 2'], { encoding: 'utf-8' });
  spawnSync('/bin/sh', ['-c', 'sleep 0.2'], { encoding: 'utf-8' });
  const live = listScreenSessions().some((entry) => entry.id === probeId);
  if (live) {
    spawnSync('screen', ['-S', probeId, '-X', 'quit'], { encoding: 'utf-8' });
  }
  screenAvailableCache = live;
  return screenAvailableCache;
}

export function spawnScreenSession(projectRoot, { agentType = 'shell', cwd, command, args, contextAtSpawn, env: extraEnv } = {}) {
  if (!isScreenAvailable()) {
    return actionResult(false, { error: 'screen backplane unavailable: screen executable not found' });
  }
  const project = resolve(projectRoot);
  const id = newSessionId();
  const screenSessionId = canonicalScreenSessionId(project, id);
  const sessionCwd = admitProjectWorkingDirectory(project, cwd);
  const cmd = command || (process.env.SHELL || '/bin/bash');
  const cmdArgs = args || (cmd === (process.env.SHELL || '/bin/bash') ? ['-l'] : []);
  const env = {
    ...process.env,
    ...extraEnv,
    ODDM_SESSION_ID: id,
    ODDM_PROJECT: contextAtSpawn?.project ?? '',
    ODDM_WORKSPACE: contextAtSpawn?.workspace ?? '',
    ODDM_ODD_TYPE: contextAtSpawn?.odd_type ?? '',
    TERM: 'xterm-256color',
  };
  ensureRegistry(project);
  const sessionDir = sessionDirectory(project, id, true);
  writeProjectRuntimeFile(project, sessionSegments(id), 'screenlog.0', '', { encoding: 'utf8' });
  writeProjectRuntimeFile(
    project,
    sessionSegments(id),
    'screenrc',
    'deflog on\nlogfile flush 0\n',
    { encoding: 'utf8' },
  );

  // screen writes screenlog.0 in its own cwd. Start screen from a
  // per-session directory, then exec the requested command from sessionCwd.
  const screenArgs = [
    '-c',
    'screenrc',
    '-dmS',
    screenSessionId,
    '/bin/sh',
    '-lc',
    'cd "$1" || exit 1; shift; exec "$@"',
    'odd-manager-screen',
    sessionCwd,
    cmd,
    ...cmdArgs,
  ];
  const out = spawnSync('screen', screenArgs, { cwd: sessionDir, env, encoding: 'utf-8' });
  if (out.status !== 0) {
    return actionResult(false, { error: `screen spawn failed: ${out.stderr || out.stdout || `exit ${out.status}`}` });
  }
  const record = {
    id,
    project_root: project,
    screen_session_id: screenSessionId,
    agent_type: agentType,
    cwd: sessionCwd,
    status: 'running',
    started_at: new Date().toISOString(),
    transcript_ref: canonicalTranscriptRef(project, id),
    context_at_spawn: contextAtSpawn ?? null,
    backplane: 'screen',
    command: cmd,
    args: cmdArgs,
  };
  persistRecord(project, record);
  return actionResult(true, record);
}

export function killScreenSession(projectRoot, id) {
  const record = loadRecord(projectRoot, id);
  if (!record) {
    return actionResult(false, { error: `screen session not found: ${id}` });
  }
  if (!isScreenAvailable()) {
    return actionResult(false, { error: 'screen backplane unavailable: screen executable not found' });
  }
  const out = spawnSync('screen', ['-S', record.screen_session_id, '-X', 'quit'], { encoding: 'utf-8' });
  // screen exits 0 on quit, 1 if session doesn't exist
  record.status = 'stopped';
  record.exited_at = new Date().toISOString();
  persistRecord(projectRoot, record);
  return actionResult(true, { id, screen_exit: out.status });
}

// Send a string to a screen session as if typed at the terminal. screen
// uses 'stuff' for this; '\r' becomes Enter.
export function sendToScreenSession(projectRoot, id, data) {
  const record = loadRecord(projectRoot, id);
  if (!record) {
    return actionResult(false, { error: `screen session not found: ${id}` });
  }
  if (!isScreenAvailable()) {
    return actionResult(false, { error: 'screen backplane unavailable: screen executable not found' });
  }
  const out = spawnSync('screen', ['-S', record.screen_session_id, '-p', '0', '-X', 'stuff', String(data ?? '').replace(/\n/g, '\r')], { encoding: 'utf-8' });
  return out.status === 0
    ? actionResult(true, { id, bytes: Buffer.byteLength(data) })
    : actionResult(false, { error: out.stderr || `screen exit ${out.status}` });
}

// Reconcile persisted SessionRecords with live screen sessions. Records
// for screen sessions still alive get status='running'; records whose
// session is gone get status='stopped' if they were running.
//
// Returns a summary { revived, marked_stopped }.
export function rehydrateFromScreen(projectRoot) {
  const lexicalRegistry = projectRuntimeLexicalPath(projectRoot, SESSION_RUNTIME_SEGMENTS);
  if (!existsSync(lexicalRegistry)) {
    return { revived: [], marked_stopped: [], rejected: [] };
  }
  const registry = sessionsRegistry(projectRoot);
  const liveIds = new Set(listScreenSessions().map((s) => s.id));
  const revived = [];
  const markedStopped = [];
  const rejected = [];
  for (const filename of readdirSync(registry)) {
    const match = filename.match(/^(sess-[a-f0-9]{8})\.json$/);
    if (!match) continue;
    const id = match[1];
    let record;
    try {
      record = loadRecord(projectRoot, id);
    } catch {
      rejected.push(id);
      continue;
    }
    if (!record) continue;
    if (liveIds.has(record.screen_session_id)) {
      // Confirm running (no-op if already running)
      if (record.status !== 'running') {
        record.status = 'running';
        record.rehydrated_at = new Date().toISOString();
        persistRecord(projectRoot, record);
      }
      revived.push(id);
    } else if (record.status === 'running') {
      record.status = 'stopped';
      record.exited_at = record.exited_at ?? new Date().toISOString();
      record.exit_reason = 'screen session not found on rehydrate';
      persistRecord(projectRoot, record);
      markedStopped.push(id);
    }
  }
  return { revived, marked_stopped: markedStopped, rejected };
}
