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
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

function sessionsRegistry(projectRoot) {
  return resolve(projectRoot, '.ai-workspace/runtime/sessions');
}

function sessionDirectory(projectRoot, id) {
  return join(sessionsRegistry(projectRoot), id);
}

export function screenTranscriptPath(projectRoot, id) {
  return join(sessionDirectory(projectRoot, id), 'screenlog.0');
}

function ensureRegistry(projectRoot) {
  const dir = sessionsRegistry(projectRoot);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function recordPath(projectRoot, id) {
  return join(sessionsRegistry(projectRoot), `${id}.json`);
}

function newSessionId() {
  return `sess-${randomBytes(4).toString('hex')}`;
}

function actionResult(ok, payload) {
  return { ok, ...payload };
}

function persistRecord(projectRoot, record) {
  ensureRegistry(projectRoot);
  writeFileSync(recordPath(projectRoot, record.id), JSON.stringify(record, null, 2));
}

function loadRecord(projectRoot, id) {
  const path = recordPath(projectRoot, id);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
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
  const id = newSessionId();
  const sessionCwd = cwd || projectRoot;
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
  ensureRegistry(projectRoot);
  const sessionDir = sessionDirectory(projectRoot, id);
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(screenTranscriptPath(projectRoot, id), '');
  writeFileSync(join(sessionDir, 'screenrc'), 'deflog on\nlogfile flush 0\n');

  // screen writes screenlog.0 in its own cwd. Start screen from a
  // per-session directory, then exec the requested command from sessionCwd.
  const screenArgs = [
    '-c',
    'screenrc',
    '-dmS',
    id,
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
    agent_type: agentType,
    cwd: sessionCwd,
    status: 'running',
    started_at: new Date().toISOString(),
    transcript_ref: screenTranscriptPath(projectRoot, id).replace(`${projectRoot}/`, ''),
    context_at_spawn: contextAtSpawn ?? null,
    backplane: 'screen',
    command: cmd,
    args: cmdArgs,
  };
  persistRecord(projectRoot, record);
  return actionResult(true, record);
}

export function killScreenSession(projectRoot, id) {
  if (!isScreenAvailable()) {
    return actionResult(false, { error: 'screen backplane unavailable: screen executable not found' });
  }
  const out = spawnSync('screen', ['-S', id, '-X', 'quit'], { encoding: 'utf-8' });
  // screen exits 0 on quit, 1 if session doesn't exist
  const record = loadRecord(projectRoot, id);
  if (record) {
    record.status = 'stopped';
    record.exited_at = new Date().toISOString();
    persistRecord(projectRoot, record);
  }
  return actionResult(true, { id, screen_exit: out.status });
}

// Send a string to a screen session as if typed at the terminal. screen
// uses 'stuff' for this; '\r' becomes Enter.
export function sendToScreenSession(id, data) {
  if (!isScreenAvailable()) {
    return actionResult(false, { error: 'screen backplane unavailable: screen executable not found' });
  }
  const out = spawnSync('screen', ['-S', id, '-p', '0', '-X', 'stuff', String(data ?? '').replace(/\n/g, '\r')], { encoding: 'utf-8' });
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
  const registry = sessionsRegistry(projectRoot);
  if (!existsSync(registry)) return { revived: [], marked_stopped: [] };
  const liveIds = new Set(listScreenSessions().map((s) => s.id));
  const revived = [];
  const markedStopped = [];
  for (const filename of readdirSync(registry)) {
    if (!filename.endsWith('.json')) continue;
    const path = join(registry, filename);
    let record;
    try { record = JSON.parse(readFileSync(path, 'utf-8')); } catch { continue; }
    if (record.backplane !== 'screen') continue;
    if (liveIds.has(record.id)) {
      // Confirm running (no-op if already running)
      if (record.status !== 'running') {
        record.status = 'running';
        record.rehydrated_at = new Date().toISOString();
        persistRecord(projectRoot, record);
      }
      revived.push(record.id);
    } else if (record.status === 'running') {
      record.status = 'stopped';
      record.exited_at = record.exited_at ?? new Date().toISOString();
      record.exit_reason = 'screen session not found on rehydrate';
      persistRecord(projectRoot, record);
      markedStopped.push(record.id);
    }
  }
  return { revived, marked_stopped: markedStopped };
}
