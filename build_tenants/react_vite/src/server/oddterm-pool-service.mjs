import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const serverDir = dirname(fileURLToPath(import.meta.url));
const oddtermServicePath = resolve(serverDir, "../../runtime/oddterm_service.py");
const workspaceStores = new Map();

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

function runtimeRoot(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/runtime/oddterm");
}

function sessionRoot(projectRoot, sessionId) {
  return join(runtimeRoot(projectRoot), sessionId);
}

function sessionMetaPath(projectRoot, sessionId) {
  return join(sessionRoot(projectRoot, sessionId), "meta.json");
}

function serializeSession(session) {
  return {
    id: session.id,
    projectRoot: session.projectRoot,
    label: session.label,
    archived: Boolean(session.archived),
    status: session.status,
    shell: session.shell,
    pid: session.pid,
    backend: session.backend,
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
      },
      null,
      2,
    ),
    "utf8",
  );
}

function restoreSessionsFromDisk(store) {
  const root = runtimeRoot(store.projectRoot);
  if (!existsSync(root)) {
    return;
  }

  const directories = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const sessionId of directories) {
    const metaPath = sessionMetaPath(store.projectRoot, sessionId);
    if (!existsSync(metaPath)) {
      continue;
    }

    let meta;
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      continue;
    }

    const session = {
      id: sessionId,
      projectRoot: store.projectRoot,
      label: meta.label || sessionId,
      archived: Boolean(meta.archived),
      status: meta.status === "error" ? "error" : "closed",
      shell: meta.shell ?? null,
      pid: null,
      backend: meta.backend ?? null,
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
      processRef: null,
      stdout: null,
      pendingRoomMirror: null,
    };
    if (session.archived) {
      continue;
    }
    ensureConversationHistory(store.projectRoot, {
      historyId: session.conversationHistoryId,
      ownerKind: "oddterm_session",
      ownerRef: session.id,
      metadata: {
        sessionId: session.id,
        label: session.label,
      },
    });
    session.historyBytes = loadConversationHistoryStats(store.projectRoot, session.conversationHistoryId).historyBytes;
    store.sessions.set(sessionId, session);
    if (!store.activeSessionId) {
      store.activeSessionId = sessionId;
    }
  }
}

function ensureWorkspaceStore(projectRoot) {
  const root = resolve(projectRoot);
  let store = workspaceStores.get(root);
  if (!store) {
    mkdirSync(runtimeRoot(root), { recursive: true });
    store = {
      projectRoot: root,
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
    if (!Number.isInteger(session.pid) || Number(session.pid) <= 0) {
      continue;
    }
    if (isPidAlive(session.pid)) {
      continue;
    }
    session.status = "closed";
    session.exitCode ??= 0;
    session.signal ??= null;
    updateConversationMetadata(session.projectRoot, session.conversationHistoryId, {
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
    persistSessionMeta(session);
  }
}

function createPosixService(projectRoot) {
  return spawn("python3", [oddtermServicePath, "--workspace-root", projectRoot], {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });
}

function createWindowsFallback(projectRoot) {
  return spawn("powershell.exe", [], {
    cwd: projectRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
    },
  });
}

function broadcast(session, payload) {
  for (const socket of session.clients) {
    sendJson(socket, payload);
  }
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
    appendLiveRoomMessage(session.projectRoot, {
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
    appendConversationEntry(session.projectRoot, session.conversationHistoryId, {
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
    appendConversationEntry(session.projectRoot, session.conversationHistoryId, {
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
    appendConversationEntry(session.projectRoot, session.conversationHistoryId, {
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

  session.historyBytes = loadConversationHistoryStats(session.projectRoot, session.conversationHistoryId).historyBytes;
  updateConversationMetadata(session.projectRoot, session.conversationHistoryId, {
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

function createSession(projectRoot, options = {}) {
  const store = ensureWorkspaceStore(projectRoot);
  const sessionId = randomUUID();
  const sessionDirectory = sessionRoot(store.projectRoot, sessionId);
  mkdirSync(sessionDirectory, { recursive: true });

  const session = {
    id: sessionId,
    projectRoot: store.projectRoot,
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
    metaPath: sessionMetaPath(store.projectRoot, sessionId),
    historyBytes: 0,
    processRef: process.platform === "win32" ? createWindowsFallback(store.projectRoot) : createPosixService(store.projectRoot),
    stdout: null,
    pendingRoomMirror: null,
  };

  ensureConversationHistory(store.projectRoot, {
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

  const stdout = createInterface({ input: session.processRef.stdout });
  session.stdout = stdout;

  stdout.on("line", (line) => {
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      payload = { type: "data", data: `${line}\n` };
    }

    if (payload.type === "ready") {
      session.shell = typeof payload.shell === "string" ? payload.shell : null;
      session.pid = typeof payload.pid === "number" ? payload.pid : null;
      session.backend = typeof payload.backend === "string" ? payload.backend : null;
      updateConversationMetadata(session.projectRoot, session.conversationHistoryId, {
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
      broadcast(session, payload);
      return;
    }

    if (payload.type === "data") {
      recordTerminalPayload(session, payload);
      persistSessionMeta(session);
      broadcast(session, payload);
      return;
    }

    if (payload.type === "exit") {
      session.status = "closed";
      session.exitCode = payload.exitCode;
      session.signal = payload.signal;
      recordTerminalPayload(session, payload);
      persistSessionMeta(session);
      broadcast(session, payload);
      return;
    }

    if (payload.type === "error") {
      session.status = "error";
      recordTerminalPayload(session, payload);
      persistSessionMeta(session);
      broadcast(session, payload);
    }
  });

  session.processRef.stderr?.on("data", (data) => {
    const text = data.toString();
    if (!text.trim()) {
      return;
    }
    const payload = { type: "error", message: text.trim() };
    session.status = "error";
    recordTerminalPayload(session, payload);
    persistSessionMeta(session);
    broadcast(session, payload);
  });

  session.processRef.on("close", (exitCode, signal) => {
    session.status = "closed";
    session.exitCode = exitCode;
    session.signal = signal;
    persistSessionMeta(session);
  });

  session.processRef.on("error", (error) => {
    const payload = {
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    };
    session.status = "error";
    recordTerminalPayload(session, payload);
    persistSessionMeta(session);
    broadcast(session, payload);
  });

  store.sessions.set(sessionId, session);
  setActiveSession(store, sessionId);
  persistSessionMeta(session);
  appendLiveRoomMessage(store.projectRoot, {
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

function resolveSession(projectRoot, sessionId) {
  const store = ensureWorkspaceStore(projectRoot);
  if (!sessionId) {
    return null;
  }
  return store.sessions.get(sessionId) ?? null;
}

function replayHistory(session, socket) {
  const { entries } = loadConversationHistory(session.projectRoot, session.conversationHistoryId);
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
      projectRoot: session.projectRoot,
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

    try {
      session.processRef.stdin?.write(`${JSON.stringify(payload)}\n`);
    } catch {
      sendJson(socket, {
        type: "error",
        message: "oddterm backend stdin is unavailable",
      });
    }
  });

  function detach() {
    session.clients.delete(socket);
  }

  socket.on("close", detach);
  socket.on("error", detach);
}

export function createGTermSession(projectRoot, options = {}) {
  return serializeSession(createSession(projectRoot, options));
}

export function ensureGTermSession(projectRoot, options = {}) {
  const store = ensureWorkspaceStore(projectRoot);
  const existing = resolveSessionByLabel(store, options.label);
  if (existing) {
    return serializeSession(existing);
  }
  return serializeSession(createSession(projectRoot, options));
}

export function renameGTermSession(projectRoot, sessionId, label) {
  const store = ensureWorkspaceStore(projectRoot);
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
  updateConversationMetadata(store.projectRoot, session.conversationHistoryId, {
    label: session.label,
  });
  persistSessionMeta(session);
  appendLiveRoomMessage(store.projectRoot, {
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

export function closeGTermSession(projectRoot, sessionId) {
  const store = ensureWorkspaceStore(projectRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  if (session.status === "live" && session.processRef && !session.processRef.killed) {
    try {
      session.processRef.stdin?.write(`${JSON.stringify({ type: "close" })}\n`);
    } catch {
      // Ignore backend close failures and fall through to kill.
    }
    try {
      session.processRef.kill();
    } catch {
      // Best-effort close.
    }
  }

  session.status = "closed";
  session.archived = true;
  session.exitCode ??= 0;
  updateConversationMetadata(store.projectRoot, session.conversationHistoryId, {
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
  appendLiveRoomMessage(store.projectRoot, {
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

export function closeAllGTermSessions(projectRoot) {
  const store = ensureWorkspaceStore(projectRoot);
  const liveSessionIds = Array.from(store.sessions.values())
    .filter((session) => session.status === "live")
    .map((session) => session.id);

  const closedSessions = [];
  for (const sessionId of liveSessionIds) {
    closedSessions.push(closeGTermSession(projectRoot, sessionId));
  }

  return {
    projectRoot: store.projectRoot,
    closedSessions,
  };
}

export function selectGTermSession(projectRoot, sessionId) {
  const store = ensureWorkspaceStore(projectRoot);
  if (!store.sessions.has(sessionId)) {
    throw new Error("terminal session not found");
  }
  setActiveSession(store, sessionId);
  return loadGTermPoolState(projectRoot);
}

export function loadGTermPoolState(projectRoot) {
  const store = ensureWorkspaceStore(projectRoot);
  reconcileSessionLiveness(store);
  return {
    projectRoot: store.projectRoot,
    activeSessionId: store.activeSessionId,
    sessions: Array.from(store.sessions.values())
      .map((session) => {
        session.historyBytes = loadConversationHistoryStats(store.projectRoot, session.conversationHistoryId).historyBytes;
        return serializeSession(session);
      })
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))),
  };
}

export function readGTermSessionTail(projectRoot, sessionId, lineCount = 120) {
  const historyId = sessionConversationHistoryId(sessionId);
  const extracted = extractConversationRange(resolve(projectRoot), historyId, {
    entryCount: Math.max(1, lineCount),
    sanitizeTerminalText: true,
  });

  return {
    session: loadGTermPoolState(projectRoot).sessions.find((entry) => entry.id === sessionId) ?? null,
    chunks: extracted.entries,
    text: extracted.text,
  };
}

export function appendGTermSessionEntry(projectRoot, sessionId, text, options = {}) {
  const store = ensureWorkspaceStore(projectRoot);
  const session = store.sessions.get(sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const payloadText = String(text ?? "");
  if (!payloadText) {
    return serializeSession(session);
  }

  appendConversationEntry(session.projectRoot, session.conversationHistoryId, {
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
  session.historyBytes = loadConversationHistoryStats(session.projectRoot, session.conversationHistoryId).historyBytes;
  updateConversationMetadata(session.projectRoot, session.conversationHistoryId, {
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

export function sendGTermSessionInput(projectRoot, sessionId, data) {
  const store = ensureWorkspaceStore(projectRoot);
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
    session.processRef.stdin?.write(`${JSON.stringify({ type: "input", data: bodyText })}\n`);
  }

  if (submitText) {
    setTimeout(() => {
      if (session.status !== "live") {
        return;
      }
      try {
        session.processRef.stdin?.write(`${JSON.stringify({ type: "input", data: submitText })}\n`);
      } catch {
        // Best effort submit.
      }
    }, 40);
  }

  return serializeSession(session);
}

export function sendGTermSessionRoomInput(
  projectRoot,
  sessionId,
  {
    data,
    roomId,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const store = ensureWorkspaceStore(projectRoot);
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
    session.processRef.stdin?.write(`${JSON.stringify({ type: "input", data: bodyText })}\n`);
  }

  if (submitText) {
    setTimeout(() => {
      if (session.status !== "live") {
        return;
      }
      try {
        session.processRef.stdin?.write(`${JSON.stringify({ type: "input", data: submitText })}\n`);
      } catch {
        // Best effort submit.
      }
    }, 40);
  }

  return serializeSession(session);
}

export function attachGTermServer(server, { defaultWorkspaceRoot }) {
  const socketServer = new WebSocketServer({ noServer: true });

  socketServer.on("connection", (socket, request, url) => {
    const projectRoot = resolve(url.searchParams.get("projectRoot") || defaultWorkspaceRoot);
    const sessionId = url.searchParams.get("sessionId");
    const session =
      resolveSession(projectRoot, sessionId) ??
      createSession(projectRoot, {
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
