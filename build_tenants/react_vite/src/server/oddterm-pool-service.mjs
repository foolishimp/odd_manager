import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { WebSocket, WebSocketServer } from "ws";
import {
  appendConversationEntry,
  conversationEntryText,
  ensureConversationHistory,
  extractConversationRange,
  loadConversationHistory,
  loadConversationHistoryStats,
  sessionConversationHistoryId,
  stripTerminalControlText,
  updateConversationMetadata,
} from "./conversation-history-service.mjs";
import {
  appendLiveRoomMessage,
  firstMeaningfulLine,
  sessionParticipantId,
} from "./oddchat-room-service.mjs";

const workspaceStores = new Map();
const SCREEN_POLL_INTERVAL_MS = 100;
const SCREEN_LIVENESS_INTERVAL_MS = 1000;

function isPidAlive(pid) {
  const parsed = Number(pid);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return false;
  }
  try {
    process.kill(parsed, 0);
    return true;
  } catch {
    return false;
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function runtimeRoot(workspaceRoot) {
  return resolve(workspaceRoot, ".ai-workspace/runtime/oddterm");
}

function sessionRoot(workspaceRoot, sessionId) {
  return join(runtimeRoot(workspaceRoot), sessionId);
}

function sessionMetaPath(workspaceRoot, sessionId) {
  return join(sessionRoot(workspaceRoot, sessionId), "meta.json");
}

function sessionTranscriptPath(workspaceRoot, sessionId) {
  return join(sessionRoot(workspaceRoot, sessionId), "screenlog.0");
}

function screenSessionName(sessionId) {
  return `oddterm_${String(sessionId).replace(/[^A-Za-z0-9_.-]/g, "_").replace(/-/g, "")}`;
}

function parseScreenSessions(text) {
  const sessions = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const match = line.match(/^\s+(\d+)\.([^\s]+)\s+\((Attached|Detached)\)/);
    if (match) {
      sessions.push({
        pid: Number(match[1]),
        id: match[2],
        state: match[3].toLowerCase(),
      });
    }
  }
  return sessions;
}

function listScreenSessions() {
  const result = spawnSync("screen", ["-ls"], { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    return [];
  }
  return parseScreenSessions(`${result.stdout || ""}${result.stderr || ""}`);
}

let screenAvailableCache = null;

export function isOddTermScreenAvailable() {
  if (screenAvailableCache !== null) {
    return screenAvailableCache;
  }
  const probe = spawnSync("screen", ["-ls"], { encoding: "utf8" });
  if (probe.error?.code === "ENOENT") {
    screenAvailableCache = false;
    return screenAvailableCache;
  }
  const probeId = `oddterm_probe_${process.pid}_${Math.random().toString(16).slice(2, 8)}`;
  spawnSync("screen", ["-dmS", probeId, "/bin/sh", "-c", "sleep 2"], { encoding: "utf8" });
  spawnSync("/bin/sh", ["-c", "sleep 0.2"], { encoding: "utf8" });
  const live = listScreenSessions().some((entry) => entry.id === probeId);
  if (live) {
    spawnSync("screen", ["-S", probeId, "-X", "quit"], { encoding: "utf8" });
  }
  screenAvailableCache = live;
  return screenAvailableCache;
}

function screenSessionEntry(session) {
  if (!session.screenSessionId) {
    return null;
  }
  return listScreenSessions().find((entry) => entry.id === session.screenSessionId) ?? null;
}

function isScreenSessionLive(session) {
  return Boolean(screenSessionEntry(session));
}

function resolveShell() {
  if (existsSync("/bin/zsh")) {
    return {
      command: "/bin/zsh",
      args: ["-f", "-i"],
      label: "/bin/zsh -f -i",
    };
  }
  return {
    command: "/bin/bash",
    args: ["--noprofile", "--norc", "-i"],
    label: "/bin/bash --noprofile --norc -i",
  };
}

function screenEnv(session) {
  return {
    ...process.env,
    ODDTERM_SESSION_ID: session.id,
    TERM: "xterm-256color",
    COLORTERM: process.env.COLORTERM || "truecolor",
    CLICOLOR: "1",
    CLICOLOR_FORCE: process.env.CLICOLOR_FORCE || "1",
    FORCE_COLOR: process.env.FORCE_COLOR || "1",
    HISTFILE: process.env.HISTFILE || "/tmp/oddterm_zsh_history",
    PYENV_DISABLE_REHASH: "1",
  };
}

function normalizeScreenInput(data) {
  return String(data ?? "").replace(/\n/g, "\r");
}

function sendToScreen(session, data) {
  if (!session.screenSessionId) {
    return {
      ok: false,
      error: "terminal screen session is unavailable",
    };
  }
  const result = spawnSync("screen", ["-S", session.screenSessionId, "-p", "0", "-X", "stuff", normalizeScreenInput(data)], {
    encoding: "utf8",
  });
  if (result.status === 0) {
    return {
      ok: true,
      bytes: Buffer.byteLength(String(data ?? "")),
    };
  }
  return {
    ok: false,
    error: result.stderr || result.stdout || `screen exit ${result.status}`,
  };
}

function quitScreen(session) {
  if (!session.screenSessionId) {
    return;
  }
  spawnSync("screen", ["-S", session.screenSessionId, "-X", "quit"], { encoding: "utf8" });
}

function serializeSession(session) {
  return {
    id: session.id,
    workspaceRoot: session.workspaceRoot,
    label: session.label,
    archived: Boolean(session.archived),
    status: session.status,
    shell: session.shell,
    pid: session.pid,
    backend: session.backend,
    screenSessionId: session.screenSessionId,
    transcriptPath: session.transcriptPath,
    createdAt: session.createdAt,
    lastOutputAt: session.lastOutputAt,
    attachedTrainId: session.attachedTrainId,
    attachedStationId: session.attachedStationId,
    attachedEdgeId: session.attachedEdgeId,
    conversationHistoryId: session.conversationHistoryId,
    historyBytes: session.historyBytes,
    liveClientCount: session.clients.size,
  };
}

function persistSessionMeta(session) {
  writeFileSync(
    session.metaPath,
    JSON.stringify(
      {
        ...serializeSession(session),
        exitCode: session.exitCode,
        signal: session.signal,
        screenLogOffset: session.screenLogOffset,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function restoreSessionsFromDisk(store) {
  const root = runtimeRoot(store.workspaceRoot);
  if (!existsSync(root)) {
    return;
  }

  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const sessionId of directories) {
    const metaPath = sessionMetaPath(store.workspaceRoot, sessionId);
    if (!existsSync(metaPath)) {
      continue;
    }

    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      continue;
    }

    const screenSessionId = meta.screenSessionId || screenSessionName(sessionId);
    const transcriptPath = meta.transcriptPath || sessionTranscriptPath(store.workspaceRoot, sessionId);
    const screenBacked = meta.backend === "node-screen-pty" || Boolean(meta.screenSessionId);
    const live = screenBacked && isOddTermScreenAvailable() && listScreenSessions().some((entry) => entry.id === screenSessionId);
    const session = {
      id: sessionId,
      workspaceRoot: store.workspaceRoot,
      label: meta.label || sessionId,
      archived: Boolean(meta.archived),
      status: live ? "live" : meta.status === "error" ? "error" : "closed",
      shell: meta.shell ?? null,
      pid: live ? (listScreenSessions().find((entry) => entry.id === screenSessionId)?.pid ?? null) : null,
      backend: meta.backend ?? null,
      screenSessionId,
      transcriptPath,
      screenLogOffset: Number.isFinite(meta.screenLogOffset)
        ? meta.screenLogOffset
        : existsSync(transcriptPath)
          ? statSync(transcriptPath).size
          : 0,
      pollTimer: null,
      lastLivenessCheckAt: 0,
      attachedTrainId: meta.attachedTrainId ?? null,
      attachedStationId: meta.attachedStationId ?? null,
      attachedEdgeId: meta.attachedEdgeId ?? null,
      conversationHistoryId: meta.conversationHistoryId ?? sessionConversationHistoryId(sessionId),
      createdAt: meta.createdAt ?? null,
      lastOutputAt: meta.lastOutputAt ?? null,
      exitCode: meta.exitCode ?? null,
      signal: meta.signal ?? null,
      clients: new Set(),
      metaPath,
      historyBytes: 0,
      pendingRoomMirror: null,
    };
    if (session.archived) {
      continue;
    }
    ensureConversationHistory(store.workspaceRoot, {
      historyId: session.conversationHistoryId,
      ownerKind: "oddterm_session",
      ownerRef: session.id,
      metadata: {
        sessionId: session.id,
        label: session.label,
      },
    });
    session.historyBytes = loadConversationHistoryStats(store.workspaceRoot, session.conversationHistoryId).historyBytes;
    store.sessions.set(sessionId, session);
    if (session.status === "live") {
      startScreenMonitor(session);
    }
    if (!store.activeSessionId) {
      store.activeSessionId = sessionId;
    }
  }
}

function ensureWorkspaceStore(workspaceRoot) {
  const root = resolve(workspaceRoot);
  let store = workspaceStores.get(root);
  if (!store) {
    mkdirSync(runtimeRoot(root), { recursive: true });
    store = {
      workspaceRoot: root,
      activeSessionId: null,
      sessions: new Map(),
    };
    restoreSessionsFromDisk(store);
    workspaceStores.set(root, store);
  }
  return store;
}

function resolveSessionByLabel(store, label) {
  const normalized = String(label ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  for (const session of store.sessions.values()) {
    if (String(session.label).trim().toLowerCase() === normalized) {
      return session;
    }
  }
  return null;
}

function setActiveSession(store, sessionId) {
  if (!sessionId || !store.sessions.has(sessionId)) {
    store.activeSessionId = Array.from(store.sessions.keys())[0] ?? null;
    return;
  }
  store.activeSessionId = sessionId;
}

function reconcileSessionLiveness(store) {
  for (const session of store.sessions.values()) {
    if (session.status !== "live") {
      continue;
    }
    if (session.backend === "node-screen-pty" && isScreenSessionLive(session)) {
      const entry = screenSessionEntry(session);
      session.pid = entry?.pid ?? session.pid;
      continue;
    }
    if (session.backend !== "node-screen-pty" && Number.isInteger(session.pid) && Number(session.pid) > 0 && isPidAlive(session.pid)) {
      continue;
    }
    markScreenSessionClosed(session, session.exitCode ?? 0, session.signal ?? null);
  }
}

function broadcast(session, payload) {
  for (const socket of session.clients) {
    sendJson(socket, payload);
  }
}

function ingestScreenTranscript(session) {
  if (!session.transcriptPath || !existsSync(session.transcriptPath)) {
    return;
  }
  let currentSize;
  try {
    currentSize = statSync(session.transcriptPath).size;
  } catch {
    return;
  }
  if (currentSize < session.screenLogOffset) {
    session.screenLogOffset = 0;
  }
  if (currentSize <= session.screenLogOffset) {
    return;
  }
  try {
    const content = readFileSync(session.transcriptPath);
    const chunk = content.subarray(session.screenLogOffset, currentSize).toString("utf8");
    session.screenLogOffset = currentSize;
    if (!chunk) {
      return;
    }
    const payload = { type: "data", data: chunk };
    recordTerminalPayload(session, payload);
    persistSessionMeta(session);
    broadcast(session, payload);
  } catch {
    // Best-effort stream read; the next poll can recover from the last offset.
  }
}

function markScreenSessionClosed(session, exitCode = 0, signal = null) {
  if (session.status !== "live") {
    return;
  }
  ingestScreenTranscript(session);
  session.status = "closed";
  session.exitCode = exitCode;
  session.signal = signal;
  if (session.pollTimer) {
    clearInterval(session.pollTimer);
    session.pollTimer = null;
  }
  const payload = { type: "exit", exitCode, signal };
  recordTerminalPayload(session, payload);
  persistSessionMeta(session);
  broadcast(session, payload);
}

function startScreenMonitor(session) {
  if (session.pollTimer) {
    clearInterval(session.pollTimer);
  }
  session.pollTimer = setInterval(() => {
    if (session.status !== "live") {
      clearInterval(session.pollTimer);
      session.pollTimer = null;
      return;
    }
    ingestScreenTranscript(session);
    const now = Date.now();
    if (now - session.lastLivenessCheckAt < SCREEN_LIVENESS_INTERVAL_MS) {
      return;
    }
    session.lastLivenessCheckAt = now;
    if (!isScreenSessionLive(session)) {
      markScreenSessionClosed(session, 0, null);
    }
  }, SCREEN_POLL_INTERVAL_MS);
  if (typeof session.pollTimer.unref === "function") {
    session.pollTimer.unref();
  }
}

function startScreenBackend(session) {
  if (!isOddTermScreenAvailable()) {
    const payload = {
      type: "error",
      message: "GNU screen is required for oddterm Node PTY sessions and is not available",
    };
    session.status = "error";
    session.backend = "node-screen-pty-unavailable";
    recordTerminalPayload(session, payload);
    persistSessionMeta(session);
    broadcast(session, payload);
    return;
  }

  const shell = resolveShell();
  session.shell = shell.label;
  session.backend = "node-screen-pty";
  session.screenSessionId = session.screenSessionId || screenSessionName(session.id);
  session.transcriptPath = session.transcriptPath || sessionTranscriptPath(session.workspaceRoot, session.id);
  mkdirSync(sessionRoot(session.workspaceRoot, session.id), { recursive: true });
  writeFileSync(session.transcriptPath, "", "utf8");
  writeFileSync(join(sessionRoot(session.workspaceRoot, session.id), "screenrc"), "deflog on\nlogfile flush 0\n", "utf8");
  session.screenLogOffset = 0;

  const screenArgs = [
    "-c",
    "screenrc",
    "-dmS",
    session.screenSessionId,
    "/bin/sh",
    "-lc",
    'cd "$1" || exit 1; shift; exec "$@"',
    "oddterm-screen",
    session.workspaceRoot,
    shell.command,
    ...shell.args,
  ];
  const result = spawnSync("screen", screenArgs, {
    cwd: sessionRoot(session.workspaceRoot, session.id),
    env: screenEnv(session),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const payload = {
      type: "error",
      message: `screen spawn failed: ${result.stderr || result.stdout || `exit ${result.status}`}`,
    };
    session.status = "error";
    recordTerminalPayload(session, payload);
    persistSessionMeta(session);
    broadcast(session, payload);
    return;
  }

  const entry = screenSessionEntry(session);
  session.pid = entry?.pid ?? null;
  const ready = {
    type: "ready",
    workspaceRoot: session.workspaceRoot,
    shell: session.shell,
    pid: session.pid ?? 0,
    backend: session.backend,
  };
  updateConversationMetadata(session.workspaceRoot, session.conversationHistoryId, {
    label: session.label,
    shell: session.shell,
    pid: session.pid,
    backend: session.backend,
    state: session.status,
    selectedTrainId: session.attachedTrainId,
    stationId: session.attachedStationId,
    edgeId: session.attachedEdgeId,
  });
  persistSessionMeta(session);
  broadcast(session, ready);
  startScreenMonitor(session);
}

function writeGTermBackend(session, payload) {
  if (session.backend !== "node-screen-pty") {
    return {
      ok: false,
      error: "oddterm backend is unavailable",
    };
  }
  if (payload?.type === "input" && typeof payload.data === "string") {
    return sendToScreen(session, payload.data);
  }
  if (payload?.type === "resize") {
    return { ok: true, ignored: true };
  }
  if (payload?.type === "close") {
    quitScreen(session);
    markScreenSessionClosed(session, 0, null);
    return { ok: true };
  }
  return { ok: true, ignored: true };
}

function normalizeMirrorLine(line) {
  return String(line ?? "")
    .replace(/\t/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function isMirrorNoiseLine(line) {
  const compact = normalizeMirrorLine(line)
    .replace(/[ ]+/g, " ")
    .toLowerCase();
  if (!compact) {
    return true;
  }

  if (compact.length < 3) {
    return true;
  }

  return [
    /^[-_=~\s]+$/,
    /^--\s*insert\s*--$/,
    /^insert$/,
    /^checking for updates$/,
    /^working\(\d+s.*$/,
    /^crystallizing$/,
    /^frosting$/,
    /^whisking$/,
    /^cerebrating$/,
    /^discombobulating$/,
    /^coalescing$/,
    /^cooking…$/,
    /^cooking\.\.\.$/,
    /^churning$/,
    /^\(\d+s\)$/,
    /^\d+\s+tokens?.*$/,
    /^thinking with high effort$/,
    /^\(thinking with high effort\)$/,
    /^gpt-[\w.-]+ .*left .*~\//,
    /^claude code v[\d.]+/,
    /^openai codex \(v[\d.]+\)/,
    /^model: /,
    /^directory: /,
    /^tip: /,
    /^use \/skills /,
    /^0;\s*genesis_manager$/,
    /^mythagoforest.*[%>$]?$/,
  ].some((pattern) => pattern.test(compact));
}

function isMirrorFragmentLine(line) {
  const compact = normalizeMirrorLine(line);
  if (!compact) {
    return true;
  }

  if (compact.length <= 4) {
    return true;
  }

  if (!compact.includes(" ") && compact.length <= 12) {
    return true;
  }

  if (/^[a-z](\s+[a-z])+$/i.test(compact)) {
    return true;
  }

  return false;
}

function extractMirrorReport(buffer, sentText) {
  const normalizedSent = normalizeMirrorLine(stripTerminalControlText(sentText));
  const lines = stripTerminalControlText(buffer)
    .replace(/\r/g, "\n")
    .split("\n")
    .map(normalizeMirrorLine)
    .filter(Boolean);

  const selected = [];
  for (const line of lines) {
    const normalizedLine = normalizeMirrorLine(line);
    if (!normalizedLine) {
      continue;
    }
    if (normalizedSent && normalizedLine.includes(normalizedSent)) {
      continue;
    }
    if (isMirrorNoiseLine(normalizedLine)) {
      continue;
    }
    if (isMirrorFragmentLine(normalizedLine)) {
      continue;
    }
    if (selected.at(-1) === normalizedLine) {
      continue;
    }
    selected.push(normalizedLine);
  }

  return selected.slice(-16).join("\n").trim();
}

function normalizeMirroredContent(buffer, sentText) {
  return extractMirrorReport(buffer, sentText);
}

function isMirrorNoise(text) {
  const compact = String(text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!compact) {
    return true;
  }
  return [
    "crystallizing",
    "cooking…",
    "cooking...",
    "(thinking with high effort)",
  ].includes(compact);
}

function flushPendingRoomMirror(session, force = false) {
  const mirror = session.pendingRoomMirror;
  if (!mirror) {
    return;
  }

  if (mirror.timer) {
    clearTimeout(mirror.timer);
  }

  const now = Date.now();
  const idleMs = now - mirror.lastActivityAt;
  const expired = now > mirror.expiresAt;

  if (!force && !expired && idleMs <= 2500) {
    mirror.timer = null;
    schedulePendingRoomMirror(session, 1000);
    return;
  }

  const content = normalizeMirroredContent(mirror.buffer, mirror.sentText);
  session.pendingRoomMirror = null;

  if (content && !isMirrorNoise(content)) {
    appendLiveRoomMessageIfPossible(session.workspaceRoot, {
      roomId: mirror.roomId,
      senderId: sessionParticipantId(session.id),
      senderLabel: session.label,
      title: firstMeaningfulLine(content),
      body: content,
      kind: "report",
      source: "session",
      relatedSessionId: session.id,
      selectedTrainId: mirror.selectedTrainId ?? session.attachedTrainId,
      stationId: mirror.stationId ?? session.attachedStationId,
      edgeId: mirror.edgeId ?? session.attachedEdgeId,
    });
  }
}

function appendLiveRoomMessageIfPossible(workspaceRoot, payload) {
  try {
    return appendLiveRoomMessage(workspaceRoot, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`oddterm room mirror skipped: ${message}`);
    return null;
  }
}

function schedulePendingRoomMirror(session, delayMs = 1200) {
  if (!session.pendingRoomMirror) {
    return;
  }
  if (session.pendingRoomMirror.timer) {
    clearTimeout(session.pendingRoomMirror.timer);
  }
  session.pendingRoomMirror.timer = setTimeout(() => {
    try {
      flushPendingRoomMirror(session);
    } catch {
      session.pendingRoomMirror = null;
    }
  }, delayMs);
}

function recordTerminalPayload(session, payload) {
  const capturedAt = new Date().toISOString();
  session.lastOutputAt = capturedAt;

  if (payload.type === "data") {
    appendConversationEntry(session.workspaceRoot, session.conversationHistoryId, {
      entryKind: "output",
      actorRef: {
        id: sessionParticipantId(session.id),
        label: session.label,
      },
      createdAt: capturedAt,
      payload: {
        text: payload.data,
        stream: "stdout",
        outputKind: "output",
      },
    });

    if (session.pendingRoomMirror) {
      session.pendingRoomMirror.buffer += String(payload.data ?? "");
      session.pendingRoomMirror.lastActivityAt = Date.now();
      schedulePendingRoomMirror(session);
    }
  }

  if (payload.type === "error") {
    appendConversationEntry(session.workspaceRoot, session.conversationHistoryId, {
      entryKind: "system",
      actorRef: {
        id: sessionParticipantId(session.id),
        label: session.label,
      },
      createdAt: capturedAt,
      payload: {
        text: `[oddterm error] ${payload.message}\n`,
        stream: "stderr",
        outputKind: "service_event",
      },
    });

    if (session.pendingRoomMirror) {
      session.pendingRoomMirror.buffer += `\n${String(payload.message ?? "")}\n`;
      session.pendingRoomMirror.lastActivityAt = Date.now();
      flushPendingRoomMirror(session, true);
    }
  }

  if (payload.type === "exit") {
    appendConversationEntry(session.workspaceRoot, session.conversationHistoryId, {
      entryKind: "system",
      actorRef: {
        id: sessionParticipantId(session.id),
        label: session.label,
      },
      createdAt: capturedAt,
      payload: {
        text: `[session exited: ${payload.exitCode}]\n`,
        stream: "control",
        outputKind: "service_event",
      },
    });

    if (session.pendingRoomMirror) {
      flushPendingRoomMirror(session, true);
    }
  }

  session.historyBytes = loadConversationHistoryStats(session.workspaceRoot, session.conversationHistoryId).historyBytes;
  updateConversationMetadata(session.workspaceRoot, session.conversationHistoryId, {
    label: session.label,
    state: session.status,
    shell: session.shell,
    pid: session.pid,
    backend: session.backend,
    lastOutputAt: session.lastOutputAt,
    selectedTrainId: session.attachedTrainId,
    stationId: session.attachedStationId,
    edgeId: session.attachedEdgeId,
  });
}

function createSession(workspaceRoot, options = {}) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const sessionId = randomUUID();
  const sessionDirectory = sessionRoot(store.workspaceRoot, sessionId);
  mkdirSync(sessionDirectory, { recursive: true });

  const session = {
    id: sessionId,
    workspaceRoot: store.workspaceRoot,
    label: options.label?.trim() || `shell-${store.sessions.size + 1}`,
    archived: false,
    status: "live",
    shell: null,
    pid: null,
    backend: null,
    attachedTrainId: options.selectedTrainId ?? null,
    attachedStationId: options.stationId ?? null,
    attachedEdgeId: options.edgeId ?? null,
    conversationHistoryId: sessionConversationHistoryId(sessionId),
    createdAt: new Date().toISOString(),
    lastOutputAt: null,
    exitCode: null,
    signal: null,
    clients: new Set(),
    metaPath: sessionMetaPath(store.workspaceRoot, sessionId),
    historyBytes: 0,
    screenSessionId: screenSessionName(sessionId),
    transcriptPath: sessionTranscriptPath(store.workspaceRoot, sessionId),
    screenLogOffset: 0,
    pollTimer: null,
    lastLivenessCheckAt: 0,
    pendingRoomMirror: null,
  };

  ensureConversationHistory(store.workspaceRoot, {
    historyId: session.conversationHistoryId,
    ownerKind: "oddterm_session",
    ownerRef: session.id,
    metadata: {
      sessionId: session.id,
      label: session.label,
      selectedTrainId: session.attachedTrainId,
      stationId: session.attachedStationId,
      edgeId: session.attachedEdgeId,
    },
  });

  store.sessions.set(sessionId, session);
  setActiveSession(store, sessionId);
  persistSessionMeta(session);
  startScreenBackend(session);
  appendLiveRoomMessageIfPossible(store.workspaceRoot, {
    roomId: "workspace",
    senderId: sessionParticipantId(session.id),
    senderLabel: session.label,
    title: `${session.label} session created`,
    body: `Created a live shell session for ${session.label}.`,
    kind: "system",
    source: "session",
    relatedSessionId: session.id,
    selectedTrainId: session.attachedTrainId,
    stationId: session.attachedStationId,
    edgeId: session.attachedEdgeId,
  });
  return session;
}

function resolveSession(workspaceRoot, sessionId) {
  const store = ensureWorkspaceStore(workspaceRoot);
  if (!sessionId) {
    return null;
  }
  return store.sessions.get(sessionId) ?? null;
}

function replayHistory(session, socket) {
  const { entries } = loadConversationHistory(session.workspaceRoot, session.conversationHistoryId);
  for (const entry of entries) {
    const text = conversationEntryText(entry);
    if (text) {
      sendJson(socket, { type: "data", data: text });
    }
  }
}

function attachSocketToSession(session, socket) {
  session.clients.add(socket);

  if (session.shell || session.pid || session.backend) {
    sendJson(socket, {
      type: "ready",
      workspaceRoot: session.workspaceRoot,
      shell: session.shell ?? "shell",
      pid: session.pid ?? 0,
      backend: session.backend ?? "backend-service",
    });
  }

  replayHistory(session, socket);

  if (session.status === "closed") {
    sendJson(socket, {
      type: "exit",
      exitCode: session.exitCode ?? 0,
      signal: session.signal ?? null,
    });
  }

  if (session.status === "error") {
    sendJson(socket, {
      type: "error",
      message: "terminal session is in error state",
    });
  }

  socket.on("message", (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (session.status !== "live") {
      sendJson(socket, {
        type: "error",
        message: "terminal session is not live",
      });
      return;
    }

    const result = writeGTermBackend(session, payload);
    if (!result.ok) {
      sendJson(socket, {
        type: "error",
        message: result.error || "oddterm backend stdin is unavailable",
      });
    }
  });

  function detach() {
    session.clients.delete(socket);
  }

  socket.on("close", detach);
  socket.on("error", detach);
}

export function createGTermSession(workspaceRoot, options = {}) {
  return serializeSession(createSession(workspaceRoot, options));
}

export function ensureGTermSession(workspaceRoot, options = {}) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const existing = resolveSessionByLabel(store, options.label);
  if (existing) {
    return serializeSession(existing);
  }
  return serializeSession(createSession(workspaceRoot, options));
}

export function renameGTermSession(workspaceRoot, sessionId, label) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const nextLabel = String(label ?? "").trim();
  if (!nextLabel) {
    throw new Error("terminal session label is required");
  }
  const previousLabel = session.label;
  session.label = nextLabel;
  updateConversationMetadata(store.workspaceRoot, session.conversationHistoryId, {
    label: session.label,
  });
  persistSessionMeta(session);
  appendLiveRoomMessageIfPossible(store.workspaceRoot, {
    roomId: "workspace",
    senderId: sessionParticipantId(session.id),
    senderLabel: nextLabel,
    title: `${nextLabel} renamed`,
    body: `Renamed terminal session from ${previousLabel} to ${nextLabel}.`,
    kind: "system",
    source: "session",
    relatedSessionId: session.id,
    selectedTrainId: session.attachedTrainId,
    stationId: session.attachedStationId,
    edgeId: session.attachedEdgeId,
  });
  return serializeSession(session);
}

export function closeGTermSession(workspaceRoot, sessionId) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  if (session.status === "live") {
    writeGTermBackend(session, { type: "close" });
  }

  session.status = "closed";
  session.archived = true;
  session.exitCode ??= 0;
  if (session.pollTimer) {
    clearInterval(session.pollTimer);
    session.pollTimer = null;
  }
  updateConversationMetadata(store.workspaceRoot, session.conversationHistoryId, {
    label: session.label,
    state: "archived",
    archived: true,
    exitCode: session.exitCode,
  });
  persistSessionMeta(session);
  for (const socket of session.clients) {
    try {
      socket.close();
    } catch {
      // Best effort.
    }
  }
  store.sessions.delete(sessionId);
  setActiveSession(store, Array.from(store.sessions.keys())[0] ?? null);
  appendLiveRoomMessageIfPossible(store.workspaceRoot, {
    roomId: "workspace",
    senderId: sessionParticipantId(session.id),
    senderLabel: session.label,
    title: `${session.label} session closed`,
    body: `Closed terminal session ${session.label}.`,
    kind: "system",
    source: "session",
    relatedSessionId: session.id,
    selectedTrainId: session.attachedTrainId,
    stationId: session.attachedStationId,
    edgeId: session.attachedEdgeId,
  });
  return serializeSession(session);
}

export function closeAllGTermSessions(workspaceRoot) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const liveSessionIds = Array.from(store.sessions.values())
    .filter((session) => session.status === "live")
    .map((session) => session.id);

  const closedSessions = [];
  for (const sessionId of liveSessionIds) {
    closedSessions.push(closeGTermSession(workspaceRoot, sessionId));
  }

  return {
    workspaceRoot: store.workspaceRoot,
    closedSessions,
  };
}

export function selectGTermSession(workspaceRoot, sessionId) {
  const store = ensureWorkspaceStore(workspaceRoot);
  if (!store.sessions.has(sessionId)) {
    throw new Error("terminal session not found");
  }
  setActiveSession(store, sessionId);
  return loadGTermPoolState(workspaceRoot);
}

export function loadGTermPoolState(workspaceRoot) {
  const store = ensureWorkspaceStore(workspaceRoot);
  reconcileSessionLiveness(store);
  return {
    workspaceRoot: store.workspaceRoot,
    activeSessionId: store.activeSessionId,
    sessions: Array.from(store.sessions.values())
      .map((session) => {
        session.historyBytes = loadConversationHistoryStats(store.workspaceRoot, session.conversationHistoryId).historyBytes;
        return serializeSession(session);
      })
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))),
  };
}

export function readGTermSessionTail(workspaceRoot, sessionId, lineCount = 120) {
  const historyId = sessionConversationHistoryId(sessionId);
  const extracted = extractConversationRange(resolve(workspaceRoot), historyId, {
    entryCount: Math.max(1, lineCount),
    sanitizeTerminalText: true,
  });

  return {
    session: loadGTermPoolState(workspaceRoot).sessions.find((entry) => entry.id === sessionId) ?? null,
    chunks: extracted.entries,
    text: extracted.text,
  };
}

export function appendGTermSessionEntry(workspaceRoot, sessionId, text, options = {}) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const payloadText = String(text ?? "");
  if (!payloadText) {
    return serializeSession(session);
  }

  appendConversationEntry(session.workspaceRoot, session.conversationHistoryId, {
    entryKind: options.chunkKind === "service_event" ? "system" : "output",
    actorRef: {
      id: sessionParticipantId(session.id),
      label: session.label,
    },
    payload: {
      text: payloadText,
      stream: options.stream ?? "stdout",
      outputKind: options.chunkKind ?? "output",
    },
  });
  session.lastOutputAt = new Date().toISOString();
  session.historyBytes = loadConversationHistoryStats(session.workspaceRoot, session.conversationHistoryId).historyBytes;
  updateConversationMetadata(session.workspaceRoot, session.conversationHistoryId, {
    label: session.label,
    state: session.status,
    shell: session.shell,
    pid: session.pid,
    backend: session.backend,
    lastOutputAt: session.lastOutputAt,
  });
  persistSessionMeta(session);
  broadcast(session, { type: "data", data: payloadText });
  return serializeSession(session);
}

export function sendGTermSessionInput(workspaceRoot, sessionId, data) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  if (session.status !== "live") {
    throw new Error("terminal session is not live");
  }

  const payloadText = String(data ?? "");
  if (!payloadText) {
    return serializeSession(session);
  }

  const bodyText = payloadText.replace(/[\r\n]+$/, "");
  const submitText = payloadText.slice(bodyText.length);

  if (bodyText) {
    const result = writeGTermBackend(session, { type: "input", data: bodyText });
    if (!result.ok) {
      throw new Error(result.error || "oddterm backend stdin is unavailable");
    }
  }

  if (submitText) {
    setTimeout(() => {
      if (session.status !== "live") {
        return;
      }
      writeGTermBackend(session, { type: "input", data: submitText });
    }, 40);
  }

  return serializeSession(session);
}

export function sendGTermSessionRoomInput(
  workspaceRoot,
  sessionId,
  {
    data,
    roomId,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const store = ensureWorkspaceStore(workspaceRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  if (session.status !== "live") {
    throw new Error("terminal session is not live");
  }

  const payloadText = String(data ?? "");
  if (!payloadText) {
    return serializeSession(session);
  }

  const bodyText = payloadText.replace(/[\r\n]+$/, "");
  const submitText = payloadText.slice(bodyText.length);

  if (session.pendingRoomMirror) {
    flushPendingRoomMirror(session);
  }

  session.pendingRoomMirror = {
    roomId,
    sentText: bodyText,
    buffer: "",
    timer: null,
    lastActivityAt: Date.now(),
    expiresAt: Date.now() + 45000,
    selectedTrainId,
    stationId,
    edgeId,
  };

  if (bodyText) {
    const result = writeGTermBackend(session, { type: "input", data: bodyText });
    if (!result.ok) {
      throw new Error(result.error || "oddterm backend stdin is unavailable");
    }
  }

  if (submitText) {
    setTimeout(() => {
      if (session.status !== "live") {
        return;
      }
      writeGTermBackend(session, { type: "input", data: submitText });
    }, 40);
  }

  return serializeSession(session);
}

export function attachGTermServer(server, { defaultWorkspaceRoot }) {
  const socketServer = new WebSocketServer({ noServer: true });

  socketServer.on("connection", (socket, request, url) => {
    const workspaceRoot = resolve(url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot);
    const sessionId = url.searchParams.get("sessionId");
    const session =
      resolveSession(workspaceRoot, sessionId) ??
      createSession(workspaceRoot, {
        selectedTrainId: url.searchParams.get("selectedTrainId") || null,
        stationId: url.searchParams.get("stationId") || null,
        edgeId: url.searchParams.get("edgeId") || null,
      });

    attachSocketToSession(session, socket);
  });

  server.on("upgrade", (request, socket, head) => {
    if (!request.url) {
      socket.destroy();
      return;
    }

    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname !== "/api/oddterm") {
      socket.destroy();
      return;
    }

    socketServer.handleUpgrade(request, socket, head, (websocket) => {
      socketServer.emit("connection", websocket, request, url);
    });
  });

  return socketServer;
}
