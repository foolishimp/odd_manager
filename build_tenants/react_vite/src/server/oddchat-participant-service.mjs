import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { emitAgentConsoleEvent, subscribeAgentConsoleEvents } from "./odd-console-events.mjs";
import { appendLiveRoomMessage, loadRoomMessages } from "./oddchat-room-service.mjs";
import {
  attachSessionToGBoardTopic,
  loadGBoardTopicById,
  loadGBoardTopicByRoomId,
} from "./oddboard-service.mjs";
import {
  appendGTermSessionEntry,
  createGTermSession,
  loadGTermPoolState,
  sendGTermSessionInput,
} from "./oddterm-pool-service.mjs";

const DEFAULT_HISTORY_LIMIT = 12;
const DEFAULT_READ_LIMIT = 40;
const MAX_READ_LIMIT = 120;
const DEFAULT_WAIT_TIMEOUT_MS = 30000;
const MAX_WAIT_TIMEOUT_MS = 60000;
const CODEX_WORKER_STARTUP_TIMEOUT_MS = 12000;
const CODEX_WORKER_POLL_INTERVAL_MS = 150;
const MANAGER_RUNTIME_ROOT = fileURLToPath(new URL("../../runtime/", import.meta.url));

function participantsDirectory(workspaceRoot) {
  return resolve(workspaceRoot, ".ai-workspace/runtime/oddchat_participants");
}

function participantsPath(workspaceRoot) {
  return join(participantsDirectory(workspaceRoot), "participants.json");
}

function oddChatWorkersDirectory(workspaceRoot) {
  return resolve(workspaceRoot, ".ai-workspace/runtime/oddchat_workers");
}

function oddChatWorkersStatePath(workspaceRoot) {
  return join(oddChatWorkersDirectory(workspaceRoot), "workers.json");
}

function oddChatBootstrapDirectory(workspaceRoot) {
  return resolve(workspaceRoot, ".ai-workspace/runtime/oddchat_bootstrap");
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function trimmedText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function capitalize(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "Agent";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeProvider(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "agent";
  }
  return normalized.replace(/[^a-z0-9_-]+/g, "-");
}

function participantIdFor(sessionId, provider) {
  return `participant:${normalizeProvider(provider)}:${String(sessionId ?? "").trim()}`;
}

function participantLabelFor(provider, sessionLabel) {
  const providerLabel = capitalize(provider);
  const shellLabel = trimmedText(sessionLabel);
  return shellLabel ? `${providerLabel} · ${shellLabel}` : providerLabel;
}

function normalizeParticipantRole(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "worker";
  }
  if (!["worker", "reviewer"].includes(normalized)) {
    throw new Error("participant role must be worker or reviewer");
  }
  return normalized;
}

function nextTopicParticipantLabel(workspaceRoot, role) {
  const normalizedRole = normalizeParticipantRole(role);
  const labels = loadGTermPoolState(workspaceRoot).sessions
    .map((session) => String(session.label ?? "").trim().toLowerCase())
    .filter(Boolean);
  const pattern = new RegExp(`^${normalizedRole}(\\d+)$`);
  let highest = 0;
  for (const label of labels) {
    const match = pattern.exec(label);
    if (!match) {
      continue;
    }
    highest = Math.max(highest, Number(match[1]) || 0);
  }
  return `${normalizedRole}${highest + 1}`;
}

function addedParticipantAnnouncement(role, sessionLabel, provider) {
  const roleLabel = normalizeParticipantRole(role);
  const providerLabel = capitalize(provider);
  return {
    title: `Added ${sessionLabel}`,
    body: `Added ${sessionLabel} as a ${roleLabel} using ${providerLabel}. A linked terminal session is available below.`,
  };
}

function ensureStore(workspaceRoot) {
  mkdirSync(participantsDirectory(workspaceRoot), { recursive: true });
}

function loadState(workspaceRoot) {
  ensureStore(workspaceRoot);
  const payload = readJsonFile(participantsPath(workspaceRoot), {
    participants: [],
  });
  const participants = Array.isArray(payload?.participants)
    ? payload.participants.filter((entry) => entry && typeof entry === "object")
    : [];
  return { participants };
}

function loadWorkerState(workspaceRoot) {
  mkdirSync(oddChatWorkersDirectory(workspaceRoot), { recursive: true });
  const payload = readJsonFile(oddChatWorkersStatePath(workspaceRoot), {
    workers: [],
  });
  const workers = Array.isArray(payload?.workers)
    ? payload.workers.filter((entry) => entry && typeof entry === "object")
    : [];
  return { workers };
}

function writeWorkerState(workspaceRoot, state) {
  mkdirSync(oddChatWorkersDirectory(workspaceRoot), { recursive: true });
  writeFileSync(
    oddChatWorkersStatePath(workspaceRoot),
    `${JSON.stringify(
      {
        workers: state.workers,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function writeState(workspaceRoot, state) {
  ensureStore(workspaceRoot);
  writeFileSync(
    participantsPath(workspaceRoot),
    `${JSON.stringify(
      {
        participants: state.participants,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function sessionById(workspaceRoot, sessionId) {
  return (
    loadGTermPoolState(workspaceRoot).sessions.find((session) => session.id === sessionId) ?? null
  );
}

function resolveRoomContext(workspaceRoot, { roomId = null, topicId = null } = {}) {
  const resolvedTopicId = trimmedText(topicId);
  if (resolvedTopicId) {
    const topic = loadGBoardTopicById(workspaceRoot, resolvedTopicId);
    if (!topic) {
      throw new Error("topic not found");
    }
    return {
      roomId: topic.roomId,
      topicId: topic.id,
      topicLabel: topic.label,
      selectedTrainId: topic.selectedTrainId ?? null,
      stationId: topic.stationId ?? null,
      edgeId: topic.edgeId ?? null,
    };
  }

  const resolvedRoomId = trimmedText(roomId);
  if (!resolvedRoomId) {
    throw new Error("room id or topic id is required");
  }

  const topic = loadGBoardTopicByRoomId(workspaceRoot, resolvedRoomId);
  return {
    roomId: resolvedRoomId,
    topicId: topic?.id ?? null,
    topicLabel: topic?.label ?? null,
    selectedTrainId: topic?.selectedTrainId ?? null,
    stationId: topic?.stationId ?? null,
    edgeId: topic?.edgeId ?? null,
  };
}

function participantSnapshot(workspaceRoot, participant) {
  const session = sessionById(workspaceRoot, participant.sessionId);
  const derivedStatus =
    participant.status === "connected" && (!session || session.status !== "live")
      ? "stale"
      : participant.status;
  return {
    ...participant,
    status: derivedStatus,
    sessionLabel: session?.label ?? participant.sessionLabel,
    sessionStatus: session?.status ?? null,
  };
}

function listParticipants(workspaceRoot, options = {}) {
  const state = loadState(workspaceRoot);
  return state.participants
    .map((participant) => participantSnapshot(workspaceRoot, participant))
    .filter((participant) => {
      if (options.sessionId && participant.sessionId !== options.sessionId) {
        return false;
      }
      if (options.roomId && participant.roomId !== options.roomId) {
        return false;
      }
      if (options.topicId && participant.topicId !== options.topicId) {
        return false;
      }
      if (options.connectedOnly && participant.status !== "connected") {
        return false;
      }
      return true;
    });
}

function messageVisibleToSession(message, sessionId) {
  const normalizedSessionId = trimmedText(sessionId);
  if (!normalizedSessionId) {
    return true;
  }
  const recipientSessionIds = Array.isArray(message?.recipientSessionIds)
    ? message.recipientSessionIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : [];
  if (recipientSessionIds.length === 0) {
    return true;
  }
  return recipientSessionIds.includes(normalizedSessionId);
}

function resolveParticipant(workspaceRoot, options = {}) {
  const state = loadState(workspaceRoot);
  const participantId = trimmedText(options.participantId);
  if (participantId) {
    const participant = state.participants.find((entry) => entry.id === participantId) ?? null;
    if (!participant) {
      throw new Error("room participant not found");
    }
    return { state, participant };
  }

  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id or participant id is required");
  }

  const provider = normalizeProvider(options.provider);
  const participant = state.participants.find(
    (entry) => entry.id === participantIdFor(sessionId, provider),
  );
  if (!participant) {
    throw new Error("room participant not found");
  }
  return { state, participant };
}

function readMessagesSince(workspaceRoot, roomId, cursor, options = {}) {
  const limit = clampNumber(options.limit, DEFAULT_READ_LIMIT, 1, MAX_READ_LIMIT);
  const excludeSenderId = trimmedText(options.excludeSenderId);
  const sessionId = trimmedText(options.sessionId);
  const messages = loadRoomMessages(workspaceRoot, roomId);
  const cursorId = trimmedText(cursor);
  const cursorIndex = cursorId ? messages.findIndex((message) => message.id === cursorId) : -1;
  let scannedMessages =
    cursorId && cursorIndex >= 0 ? messages.slice(cursorIndex + 1) : messages.slice(-limit);
  let cursorFound = cursorId ? cursorIndex >= 0 : true;

  if (scannedMessages.length > limit) {
    scannedMessages = scannedMessages.slice(-limit);
  }

  let windowMessages = scannedMessages;

  if (excludeSenderId) {
    windowMessages = windowMessages.filter((message) => message.senderId !== excludeSenderId);
  }

  if (sessionId) {
    windowMessages = windowMessages.filter((message) => messageVisibleToSession(message, sessionId));
  }

  return {
    messages: windowMessages,
    cursorFound,
    nextCursor: scannedMessages.at(-1)?.id ?? cursorId ?? null,
  };
}

function updateParticipant(state, participantId, updater) {
  const index = state.participants.findIndex((entry) => entry.id === participantId);
  if (index < 0) {
    throw new Error("room participant not found");
  }
  const current = state.participants[index];
  const next = updater(current);
  state.participants[index] = next;
  return next;
}

function writeParticipantCursor(workspaceRoot, state, participantId, nextCursor) {
  const timestamp = nowIso();
  updateParticipant(state, participantId, (participant) => ({
    ...participant,
    lastReadMessageId: nextCursor ?? participant.lastReadMessageId ?? null,
    lastReadAt: nextCursor ? timestamp : participant.lastReadAt ?? null,
    updatedAt: timestamp,
  }));
  writeState(workspaceRoot, state);
}

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

function pruneWorkerState(workspaceRoot, state = loadWorkerState(workspaceRoot)) {
  const nextWorkers = state.workers.filter((entry) => isPidAlive(entry.pid));
  if (nextWorkers.length !== state.workers.length) {
    state.workers = nextWorkers;
    writeWorkerState(workspaceRoot, state);
  }
  return state;
}

function codexWorkerLogPath(workspaceRoot, sessionId) {
  return join(
    oddChatWorkersDirectory(workspaceRoot),
    `codex-${String(sessionId ?? "").trim() || "session"}.log`,
  );
}

function codexWorkerScriptPath(workspaceRoot) {
  const scriptPath = resolve(MANAGER_RUNTIME_ROOT, "odd_manager_codex_room_worker.mjs");
  if (!existsSync(scriptPath)) {
    throw new Error("odd_manager codex room worker was not found");
  }
  return scriptPath;
}

function stopManagedCodexWorker(workspaceRoot, sessionId) {
  const resolvedSessionId = trimmedText(sessionId);
  if (!resolvedSessionId) {
    return;
  }
  const state = pruneWorkerState(workspaceRoot);
  let changed = false;
  state.workers = state.workers.filter((entry) => {
    if (entry.provider !== "codex" || entry.sessionId !== resolvedSessionId) {
      return true;
    }
    changed = true;
    if (isPidAlive(entry.pid)) {
      try {
        process.kill(entry.pid, "SIGTERM");
      } catch {
        // Ignore shutdown failures; stale state will be pruned on the next read.
      }
    }
    return false;
  });
  if (changed) {
    writeWorkerState(workspaceRoot, state);
  }
}

async function waitForManagedParticipantJoin(workspaceRoot, options = {}) {
  const sessionId = trimmedText(options.sessionId);
  const topicId = trimmedText(options.topicId);
  const provider = normalizeProvider(options.provider);
  const pid = Number(options.pid);
  const timeoutMs = clampNumber(
    options.timeoutMs,
    CODEX_WORKER_STARTUP_TIMEOUT_MS,
    1000,
    60000,
  );
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const participant = listParticipants(workspaceRoot, {
      sessionId,
      topicId,
      connectedOnly: true,
    }).find((entry) => entry.provider === provider);
    if (participant) {
      return participant;
    }
    if (Number.isInteger(pid) && pid > 0 && !isPidAlive(pid)) {
      throw new Error("managed codex room worker exited before joining the topic");
    }
    await new Promise((resolve) => setTimeout(resolve, CODEX_WORKER_POLL_INTERVAL_MS));
  }

  throw new Error("timed out waiting for the managed codex room worker to join the topic");
}

async function launchManagedCodexTopicJoin(workspaceRoot, join) {
  stopManagedCodexWorker(workspaceRoot, join.sessionId);
  const scriptPath = codexWorkerScriptPath(workspaceRoot);
  const logPath = codexWorkerLogPath(workspaceRoot, join.sessionId);
  const outputFd = openSync(logPath, "a");

  appendGTermSessionEntry(
    workspaceRoot,
    join.sessionId,
    `[oddchat] Starting managed Codex worker for ${join.topicLabel}. The room agent runs detached on the server; this shell remains available as a backing session.\n`,
    {
      stream: "control",
      chunkKind: "service_event",
    },
  );

  try {
    const child = spawn("node", [scriptPath], {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        OMAN_WORKSPACE_ROOT: workspaceRoot,
        OMAN_SESSION_ID: join.sessionId,
        OMAN_SESSION_LABEL: join.sessionLabel,
        OMAN_TOPIC_ID: join.topicId,
        OMAN_TOPIC_LABEL: join.topicLabel,
        OMAN_AGENT_PROVIDER: "codex",
      },
      detached: true,
      stdio: ["ignore", outputFd, outputFd],
    });

    if (!child.pid) {
      throw new Error("managed codex room worker failed to start");
    }

    child.unref();

    const state = pruneWorkerState(workspaceRoot);
    state.workers.push({
      provider: "codex",
      sessionId: join.sessionId,
      sessionLabel: join.sessionLabel,
      topicId: join.topicId,
      topicLabel: join.topicLabel,
      pid: child.pid,
      startedAt: nowIso(),
      logPath,
    });
    writeWorkerState(workspaceRoot, state);

    await waitForManagedParticipantJoin(workspaceRoot, {
      sessionId: join.sessionId,
      topicId: join.topicId,
      provider: "codex",
      pid: child.pid,
    });

    emitAgentConsoleEvent(workspaceRoot, {
      kind: "room-participant-managed-worker",
      roomId: join.roomId,
      sessionId: join.sessionId,
      provider: join.provider,
      topicId: join.topicId,
    });

    appendGTermSessionEntry(
      workspaceRoot,
      join.sessionId,
      `[oddchat] Managed Codex worker connected to ${join.topicLabel}. Replies will appear in the OddChat room; the shell prompt here is idle by design.\n`,
      {
        stream: "control",
        chunkKind: "service_event",
      },
    );

    return {
      ...join,
      mode: "managed-worker",
      prompt: null,
      workerPid: child.pid,
      workerLogPath: logPath,
    };
  } catch (error) {
    stopManagedCodexWorker(workspaceRoot, join.sessionId);
    appendGTermSessionEntry(
      workspaceRoot,
      join.sessionId,
      `[oddchat] Managed Codex worker failed to join ${join.topicLabel}: ${error instanceof Error ? error.message : String(error)}\n`,
      {
        stream: "stderr",
        chunkKind: "service_event",
      },
    );
    throw error;
  } finally {
    closeSync(outputFd);
  }
}

export function joinRoomParticipant(workspaceRoot, options = {}) {
  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const session = sessionById(workspaceRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const provider = normalizeProvider(options.provider);
  const room = resolveRoomContext(workspaceRoot, options);
  const participantId = participantIdFor(sessionId, provider);
  const participantLabel =
    trimmedText(options.participantLabel) ?? participantLabelFor(provider, session.label);
  const state = loadState(workspaceRoot);
  const timestamp = nowIso();
  const historyLimit = clampNumber(options.historyLimit, DEFAULT_HISTORY_LIMIT, 0, MAX_READ_LIMIT);
  const history = historyLimit > 0 ? loadRoomMessages(workspaceRoot, room.roomId, historyLimit) : [];
  const visibleHistory = history.filter((message) => messageVisibleToSession(message, session.id));
  const lastReadMessageId = history.at(-1)?.id ?? null;
  const existingIndex = state.participants.findIndex((entry) => entry.id === participantId);

  const nextParticipant = {
    id: participantId,
    provider,
    participantLabel,
    sessionId,
    sessionLabel: session.label,
    roomId: room.roomId,
    topicId: room.topicId,
    topicLabel: room.topicLabel,
    transport: "mcp",
    status: "connected",
    createdAt:
      existingIndex >= 0
        ? state.participants[existingIndex].createdAt ?? timestamp
        : timestamp,
    joinedAt: timestamp,
    updatedAt: timestamp,
    leftAt: null,
    lastReadMessageId,
    lastReadAt: lastReadMessageId ? timestamp : null,
    lastPostedAt:
      existingIndex >= 0 ? state.participants[existingIndex].lastPostedAt ?? null : null,
  };

  if (existingIndex >= 0) {
    state.participants[existingIndex] = nextParticipant;
  } else {
    state.participants.push(nextParticipant);
  }

  writeState(workspaceRoot, state);
  emitAgentConsoleEvent(workspaceRoot, {
    kind: "room-participant-joined",
    roomId: room.roomId,
    participantId,
    sessionId,
  });

  return {
    ok: true,
    participant: participantSnapshot(workspaceRoot, nextParticipant),
    room,
    messages: visibleHistory,
    nextCursor: lastReadMessageId,
  };
}

export function leaveRoomParticipant(workspaceRoot, options = {}) {
  const { state, participant } = resolveParticipant(workspaceRoot, options);
  const timestamp = nowIso();
  const updated = updateParticipant(state, participant.id, (current) => ({
    ...current,
    status: "disconnected",
    updatedAt: timestamp,
    leftAt: timestamp,
  }));
  writeState(workspaceRoot, state);
  emitAgentConsoleEvent(workspaceRoot, {
    kind: "room-participant-left",
    roomId: updated.roomId,
    participantId: updated.id,
    sessionId: updated.sessionId,
  });
  return {
    ok: true,
    participant: participantSnapshot(workspaceRoot, updated),
  };
}

export function getRoomParticipantStatus(workspaceRoot, options = {}) {
  const { participant } = resolveParticipant(workspaceRoot, options);
  const snapshot = participantSnapshot(workspaceRoot, participant);
  const unread = readMessagesSince(workspaceRoot, snapshot.roomId, snapshot.lastReadMessageId, {
    limit: MAX_READ_LIMIT,
    excludeSenderId: snapshot.id,
    sessionId: snapshot.sessionId,
  });
  return {
    ok: true,
    participant: snapshot,
    unreadCount: unread.messages.length,
    nextCursor: unread.nextCursor,
    participants: listParticipants(workspaceRoot, {
      roomId: snapshot.roomId,
      connectedOnly: true,
    }),
  };
}

export function readRoomParticipant(workspaceRoot, options = {}) {
  const { state, participant } = resolveParticipant(workspaceRoot, options);
  if (participant.status !== "connected") {
    throw new Error("room participant is not connected");
  }

  const cursor = trimmedText(options.cursor) ?? participant.lastReadMessageId ?? null;
  const result = readMessagesSince(workspaceRoot, participant.roomId, cursor, {
    limit: options.limit,
    excludeSenderId: options.excludeSelf === false ? null : participant.id,
    sessionId: participant.sessionId,
  });

  if (!trimmedText(options.cursor) && result.nextCursor && result.nextCursor !== participant.lastReadMessageId) {
    writeParticipantCursor(workspaceRoot, state, participant.id, result.nextCursor);
  }

  return {
    ok: true,
    participant: participantSnapshot(workspaceRoot, state.participants.find((entry) => entry.id === participant.id) ?? participant),
    roomId: participant.roomId,
    cursor,
    cursorFound: result.cursorFound,
    nextCursor: result.nextCursor,
    messages: result.messages,
  };
}

export async function waitRoomParticipant(workspaceRoot, options = {}) {
  const timeoutMs = clampNumber(
    options.timeoutMs,
    DEFAULT_WAIT_TIMEOUT_MS,
    1000,
    MAX_WAIT_TIMEOUT_MS,
  );

  const readCurrent = () => readRoomParticipant(workspaceRoot, options);
  const immediate = readCurrent();
  if (immediate.messages.length > 0) {
    return immediate;
  }

  return new Promise((resolve) => {
    let finished = false;

    const finish = (payload) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(payload);
    };

    const timer = setTimeout(() => {
      finish(readCurrent());
    }, timeoutMs);

    const unsubscribe = subscribeAgentConsoleEvents(workspaceRoot, (event) => {
      if (event?.roomId && immediate.roomId && event.roomId !== immediate.roomId) {
        return;
      }
      const next = readCurrent();
      if (next.messages.length > 0) {
        finish(next);
      }
    });
  });
}

export function postRoomParticipantMessage(workspaceRoot, options = {}) {
  const { state, participant } = resolveParticipant(workspaceRoot, options);
  if (participant.status !== "connected") {
    throw new Error("room participant is not connected");
  }

  const body = trimmedText(options.body ?? options.text);
  if (!body) {
    throw new Error("message body is required");
  }

  const message = appendLiveRoomMessage(workspaceRoot, {
    roomId: participant.roomId,
    senderId: participant.id,
    senderLabel: participant.participantLabel,
    title: null,
    body,
    kind: "chat",
    source: "agent",
    relatedSessionId: participant.sessionId,
  });

  const timestamp = nowIso();
  const updated = updateParticipant(state, participant.id, (current) => ({
    ...current,
    lastPostedAt: timestamp,
    updatedAt: timestamp,
  }));
  writeState(workspaceRoot, state);

  return {
    ok: true,
    participant: participantSnapshot(workspaceRoot, updated),
    message,
  };
}

function shQuote(value) {
  const text = String(value ?? "");
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function writeCodexBootstrapScript(
  workspaceRoot,
  {
    scriptPath,
    env,
    prompt = null,
    includeIrcApprovals = false,
    scriptLabel = "session",
  } = {},
) {
  mkdirSync(oddChatBootstrapDirectory(workspaceRoot), { recursive: true });
  const filePath = join(
    oddChatBootstrapDirectory(workspaceRoot),
    `codex-room-${String(scriptLabel ?? "session")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-") || "session"}.sh`,
  );
  const configArgs = [
    'mcp_servers.odd_manager_room.command="node"',
    `mcp_servers.odd_manager_room.args=${JSON.stringify([scriptPath])}`,
    "mcp_servers.odd_manager_room.startup_timeout_sec=120",
    ...codexRoomToolApprovalArgs({ includeIrc: includeIrcApprovals }),
    ...Object.entries(env).map(
      ([key, value]) =>
        `mcp_servers.odd_manager_room.env.${key}=${JSON.stringify(String(value))}`,
    ),
  ];
  const lines = [
    "#!/bin/zsh",
    "set -euo pipefail",
    `cd ${shQuote(workspaceRoot)}`,
    "exec codex \\",
    ...configArgs.map((entry, index) => {
      const isLastConfigArg = index === configArgs.length - 1;
      const hasPrompt = Boolean(trimmedText(prompt));
      const needsContinuation = !isLastConfigArg || hasPrompt;
      return `  -c ${shQuote(entry)}${needsContinuation ? " \\" : ""}`;
    }),
    ...(trimmedText(prompt) ? [`  ${shQuote(prompt)}`] : []),
    "",
  ];
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

function writeClaudeBootstrapScript(
  workspaceRoot,
  {
    scriptPath,
    env,
    prompt = null,
    scriptLabel = "session",
  } = {},
) {
  mkdirSync(oddChatBootstrapDirectory(workspaceRoot), { recursive: true });
  const slug =
    String(scriptLabel ?? "session")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-") || "session";
  const configPath = join(oddChatBootstrapDirectory(workspaceRoot), `claude-room-${slug}.config.json`);
  const filePath = join(oddChatBootstrapDirectory(workspaceRoot), `claude-room-${slug}.sh`);
  const config = JSON.stringify(
    {
      mcpServers: {
        odd_manager_room: {
          type: "stdio",
          command: "node",
          args: [scriptPath],
          env,
        },
      },
    },
    null,
    2,
  );
  const args = [
    "--dangerously-skip-permissions",
    "--strict-mcp-config",
    "--no-chrome",
    "--add-dir",
    workspaceRoot,
    "--mcp-config",
    configPath,
    ...(trimmedText(prompt) ? ["--", prompt] : []),
  ];
  const lines = [
    "#!/bin/zsh",
    "set -euo pipefail",
    `cd ${shQuote(workspaceRoot)}`,
    "exec claude \\",
    ...args.map((arg, index) => `  ${shQuote(arg)}${index === args.length - 1 ? "" : " \\"}`),
    "",
  ];
  writeFileSync(configPath, `${config}\n`, "utf8");
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

function bootstrapPrompt(topicLabel) {
  const scopedTopic = trimmedText(topicLabel) ?? "the configured topic";
  return [
    `You are already connected to OddChat for ${scopedTopic} through the preconfigured odd_manager_room MCP server.`,
    "Send a brief hello with room_send, then keep receiving room traffic with room_wait and reply in-room with room_send.",
    "Use room_read only if you need backlog or context recovery.",
    "Treat OddChat as the canonical mailbox and do not rely on terminal stdin for room delivery.",
  ].join(" ");
}

function topicJoinPrompt(topic, session, provider) {
  const participantLabel = participantLabelFor(provider, session.label);
  return [
    `Join OddChat topic ${topic.label} through odd_manager_room.`,
    `Call room_join with topicId "${topic.id}", provider "${provider}", and participantLabel "${participantLabel}".`,
    "Then send a brief hello with room_send, keep receiving room traffic with room_wait, and reply in-room with room_send.",
    "Treat OddChat as the canonical mailbox and do not rely on terminal stdin for room delivery.",
  ].join(" ");
}

function topicJoinSubmitSuffix(provider) {
  return "\r";
}

function roomMcpScriptPath(workspaceRoot) {
  const scriptPath = resolve(MANAGER_RUNTIME_ROOT, "odd_manager_irc_mcp.mjs");
  if (!existsSync(scriptPath)) {
    throw new Error("odd_manager room MCP adapter was not found");
  }
  return scriptPath;
}

function roomMcpEnv(workspaceRoot, session, provider, options = {}) {
  const env = {
    OMAN_WORKSPACE_ROOT: workspaceRoot,
    OMAN_SESSION_ID: session.id,
    OMAN_SESSION_LABEL: session.label,
    OMAN_AGENT_PROVIDER: provider,
  };
  const topicId = trimmedText(options.topicId);
  if (topicId) {
    env.OMAN_TOPIC_ID = topicId;
  }
  return env;
}

function codexRoomToolApprovalArgs({ includeIrc = false } = {}) {
  const toolNames = [
    "room_join",
    "room_status",
    "room_read",
    "room_wait",
    "room_send",
    "room_leave",
  ];
  if (includeIrc) {
    toolNames.push(
      "irc_connect",
      "irc_status",
      "irc_join",
      "irc_part",
      "irc_send_channel",
      "irc_send_dm",
      "irc_read_room",
      "irc_who",
      "irc_disconnect",
    );
  }
  return toolNames.map(
    (toolName) =>
      `mcp_servers.odd_manager_room.tools.${toolName}.approval_mode="approve"`,
  );
}

function codexBootstrapCommand(
  scriptPath,
  workspaceRoot,
  env,
  prompt = null,
  { includeIrcApprovals = false, scriptLabel = "session" } = {},
) {
  const bootstrapScriptPath = writeCodexBootstrapScript(workspaceRoot, {
    scriptPath,
    env,
    prompt,
    includeIrcApprovals,
    scriptLabel,
  });
  return `/bin/zsh ${shQuote(bootstrapScriptPath)}`;
}

function claudeBootstrapCommand(scriptPath, workspaceRoot, env, prompt = null) {
  const bootstrapScriptPath = writeClaudeBootstrapScript(workspaceRoot, {
    scriptPath,
    env,
    prompt,
    scriptLabel: env.OMAN_TOPIC_ID ? `${env.OMAN_TOPIC_ID}-${env.OMAN_SESSION_LABEL ?? env.OMAN_SESSION_ID}` : env.OMAN_SESSION_LABEL ?? env.OMAN_SESSION_ID,
  });
  return `/bin/zsh ${shQuote(bootstrapScriptPath)}`;
}

function buildShellAgentLaunch(workspaceRoot, options = {}) {
  const provider = normalizeProvider(options.provider);
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("provider must be codex or claude");
  }

  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const session = sessionById(workspaceRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const scriptPath = roomMcpScriptPath(workspaceRoot);
  const env = roomMcpEnv(workspaceRoot, session, provider);

  const command =
    provider === "codex"
      ? codexBootstrapCommand(scriptPath, workspaceRoot, env, null, {
          scriptLabel: session.label ?? session.id,
        })
      : claudeBootstrapCommand(scriptPath, workspaceRoot, env);

  return {
    ok: true,
    provider,
    sessionId: session.id,
    sessionLabel: session.label,
    command,
  };
}

export function launchShellAgent(workspaceRoot, options = {}) {
  const launch = buildShellAgentLaunch(workspaceRoot, options);
  sendGTermSessionInput(workspaceRoot, launch.sessionId, `${launch.command}\n`);
  emitAgentConsoleEvent(workspaceRoot, {
    kind: "room-participant-provider-launch",
    sessionId: launch.sessionId,
    provider: launch.provider,
  });
  return {
    ok: true,
    provider: launch.provider,
    sessionId: launch.sessionId,
    sessionLabel: launch.sessionLabel,
  };
}

function buildShellTopicJoin(workspaceRoot, options = {}) {
  const provider = normalizeProvider(options.provider);
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("provider must be codex or claude");
  }

  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id is required");
  }
  const topicId = trimmedText(options.topicId);
  if (!topicId) {
    throw new Error("topic id is required");
  }

  const session = sessionById(workspaceRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const topic = loadGBoardTopicById(workspaceRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  return {
    ok: true,
    provider,
    sessionId: session.id,
    sessionLabel: session.label,
    topicId: topic.id,
    topicLabel: topic.label,
    roomId: topic.roomId,
    prompt: topicJoinPrompt(topic, session, provider),
  };
}

export async function joinShellAgentTopic(workspaceRoot, options = {}) {
  const join = buildShellTopicJoin(workspaceRoot, options);
  if (join.provider === "codex") {
    return launchManagedCodexTopicJoin(workspaceRoot, join);
  }
  sendGTermSessionInput(workspaceRoot, join.sessionId, `${join.prompt}${topicJoinSubmitSuffix(join.provider)}`);
  emitAgentConsoleEvent(workspaceRoot, {
    kind: "room-participant-topic-join",
    roomId: join.roomId,
    sessionId: join.sessionId,
    provider: join.provider,
    topicId: join.topicId,
  });
  return {
    ok: true,
    provider: join.provider,
    sessionId: join.sessionId,
    sessionLabel: join.sessionLabel,
    topicId: join.topicId,
    topicLabel: join.topicLabel,
    roomId: join.roomId,
    mode: "prompt-injection",
  };
}

function buildRoomParticipantBootstrap(workspaceRoot, options = {}) {
  const provider = normalizeProvider(options.provider);
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("provider must be codex or claude");
  }

  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id is required");
  }
  const topicId = trimmedText(options.topicId);
  if (!topicId) {
    throw new Error("topic id is required");
  }

  const session = sessionById(workspaceRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const topic = loadGBoardTopicById(workspaceRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const scriptPath = roomMcpScriptPath(workspaceRoot);
  const env = roomMcpEnv(workspaceRoot, session, provider, { topicId: topic.id });
  const prompt = bootstrapPrompt(topic.label);
  const command =
    provider === "codex"
      ? codexBootstrapCommand(scriptPath, workspaceRoot, env, prompt, {
          scriptLabel: `${topic.id}-${session.label ?? session.id}`,
        })
      : claudeBootstrapCommand(scriptPath, workspaceRoot, env, prompt);

  return {
    ok: true,
    provider,
    sessionId: session.id,
    sessionLabel: session.label,
    topicId: topic.id,
    topicLabel: topic.label,
    roomId: topic.roomId,
    command,
  };
}

export async function launchRoomParticipantBootstrap(workspaceRoot, options = {}) {
  const bootstrap = buildRoomParticipantBootstrap(workspaceRoot, options);
  sendGTermSessionInput(workspaceRoot, bootstrap.sessionId, `${bootstrap.command}\n`);
  emitAgentConsoleEvent(workspaceRoot, {
    kind: "room-participant-bootstrap",
    roomId: bootstrap.roomId,
    sessionId: bootstrap.sessionId,
    provider: bootstrap.provider,
    topicId: bootstrap.topicId,
  });
  return {
    ok: true,
    provider: bootstrap.provider,
    sessionId: bootstrap.sessionId,
    sessionLabel: bootstrap.sessionLabel,
    topicId: bootstrap.topicId,
    topicLabel: bootstrap.topicLabel,
    roomId: bootstrap.roomId,
    mode: "shell-bootstrap",
  };
}

export async function addTopicParticipant(workspaceRoot, options = {}) {
  const provider = normalizeProvider(options.provider);
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("provider must be codex or claude");
  }

  const role = normalizeParticipantRole(options.role);
  const topicId = trimmedText(options.topicId);
  if (!topicId) {
    throw new Error("topic id is required");
  }

  const topic = loadGBoardTopicById(workspaceRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const label = trimmedText(options.label) ?? nextTopicParticipantLabel(workspaceRoot, role);
  const session = createGTermSession(workspaceRoot, {
    selectedTrainId: topic.selectedTrainId ?? null,
    stationId: topic.stationId ?? null,
    edgeId: topic.edgeId ?? null,
    label,
  });
  const announcement = addedParticipantAnnouncement(role, session.label, provider);
  attachSessionToGBoardTopic(workspaceRoot, {
    topicId: topic.id,
    sessionId: session.id,
    announcementTitle: announcement.title,
    announcementBody: announcement.body,
    announcementSenderId: "system",
    announcementSenderLabel: "OddChat",
  });

  const bootstrap = await launchRoomParticipantBootstrap(workspaceRoot, {
    sessionId: session.id,
    topicId: topic.id,
    provider,
  });

  emitAgentConsoleEvent(workspaceRoot, {
    kind: "topic-participant-added",
    topicId: topic.id,
    roomId: topic.roomId,
    sessionId: session.id,
    provider,
    role,
  });

  return {
    ok: true,
    role,
    provider,
    topicId: topic.id,
    topicLabel: topic.label,
    roomId: topic.roomId,
    session,
    bootstrap,
  };
}

export function listOddChatParticipants(workspaceRoot, options = {}) {
  return listParticipants(workspaceRoot, options);
}
