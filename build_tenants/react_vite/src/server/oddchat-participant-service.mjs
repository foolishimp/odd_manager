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

function participantsDirectory(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/runtime/oddchat_participants");
}

function participantsPath(projectRoot) {
  return join(participantsDirectory(projectRoot), "participants.json");
}

function oddChatWorkersDirectory(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/runtime/oddchat_workers");
}

function oddChatWorkersStatePath(projectRoot) {
  return join(oddChatWorkersDirectory(projectRoot), "workers.json");
}

function oddChatBootstrapDirectory(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/runtime/oddchat_bootstrap");
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

function nextTopicParticipantLabel(projectRoot, role) {
  const normalizedRole = normalizeParticipantRole(role);
  const labels = loadGTermPoolState(projectRoot).sessions
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

function ensureStore(projectRoot) {
  mkdirSync(participantsDirectory(projectRoot), { recursive: true });
}

function loadState(projectRoot) {
  ensureStore(projectRoot);
  const payload = readJsonFile(participantsPath(projectRoot), {
    participants: [],
  });
  const participants = Array.isArray(payload?.participants)
    ? payload.participants.filter((entry) => entry && typeof entry === "object")
    : [];
  return { participants };
}

function loadWorkerState(projectRoot) {
  mkdirSync(oddChatWorkersDirectory(projectRoot), { recursive: true });
  const payload = readJsonFile(oddChatWorkersStatePath(projectRoot), {
    workers: [],
  });
  const workers = Array.isArray(payload?.workers)
    ? payload.workers.filter((entry) => entry && typeof entry === "object")
    : [];
  return { workers };
}

function writeWorkerState(projectRoot, state) {
  mkdirSync(oddChatWorkersDirectory(projectRoot), { recursive: true });
  writeFileSync(
    oddChatWorkersStatePath(projectRoot),
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

function writeState(projectRoot, state) {
  ensureStore(projectRoot);
  writeFileSync(
    participantsPath(projectRoot),
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

function sessionById(projectRoot, sessionId) {
  return (
    loadGTermPoolState(projectRoot).sessions.find((session) => session.id === sessionId) ?? null
  );
}

function resolveRoomContext(projectRoot, { roomId = null, topicId = null } = {}) {
  const resolvedTopicId = trimmedText(topicId);
  if (resolvedTopicId) {
    const topic = loadGBoardTopicById(projectRoot, resolvedTopicId);
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

  const topic = loadGBoardTopicByRoomId(projectRoot, resolvedRoomId);
  return {
    roomId: resolvedRoomId,
    topicId: topic?.id ?? null,
    topicLabel: topic?.label ?? null,
    selectedTrainId: topic?.selectedTrainId ?? null,
    stationId: topic?.stationId ?? null,
    edgeId: topic?.edgeId ?? null,
  };
}

function participantSnapshot(projectRoot, participant) {
  const session = sessionById(projectRoot, participant.sessionId);
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

function listParticipants(projectRoot, options = {}) {
  const state = loadState(projectRoot);
  return state.participants
    .map((participant) => participantSnapshot(projectRoot, participant))
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

function resolveParticipant(projectRoot, options = {}) {
  const state = loadState(projectRoot);
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

function readMessagesSince(projectRoot, roomId, cursor, options = {}) {
  const limit = clampNumber(options.limit, DEFAULT_READ_LIMIT, 1, MAX_READ_LIMIT);
  const excludeSenderId = trimmedText(options.excludeSenderId);
  const sessionId = trimmedText(options.sessionId);
  const messages = loadRoomMessages(projectRoot, roomId);
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

function writeParticipantCursor(projectRoot, state, participantId, nextCursor) {
  const timestamp = nowIso();
  updateParticipant(state, participantId, (participant) => ({
    ...participant,
    lastReadMessageId: nextCursor ?? participant.lastReadMessageId ?? null,
    lastReadAt: nextCursor ? timestamp : participant.lastReadAt ?? null,
    updatedAt: timestamp,
  }));
  writeState(projectRoot, state);
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

function pruneWorkerState(projectRoot, state = loadWorkerState(projectRoot)) {
  const nextWorkers = state.workers.filter((entry) => isPidAlive(entry.pid));
  if (nextWorkers.length !== state.workers.length) {
    state.workers = nextWorkers;
    writeWorkerState(projectRoot, state);
  }
  return state;
}

function codexWorkerLogPath(projectRoot, sessionId) {
  return join(
    oddChatWorkersDirectory(projectRoot),
    `codex-${String(sessionId ?? "").trim() || "session"}.log`,
  );
}

function codexWorkerScriptPath(projectRoot) {
  const scriptPath = resolve(MANAGER_RUNTIME_ROOT, "odd_manager_codex_room_worker.mjs");
  if (!existsSync(scriptPath)) {
    throw new Error("odd_manager codex room worker was not found");
  }
  return scriptPath;
}

function stopManagedCodexWorker(projectRoot, sessionId) {
  const resolvedSessionId = trimmedText(sessionId);
  if (!resolvedSessionId) {
    return;
  }
  const state = pruneWorkerState(projectRoot);
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
    writeWorkerState(projectRoot, state);
  }
}

async function waitForManagedParticipantJoin(projectRoot, options = {}) {
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
    const participant = listParticipants(projectRoot, {
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

async function launchManagedCodexTopicJoin(projectRoot, join) {
  stopManagedCodexWorker(projectRoot, join.sessionId);
  const scriptPath = codexWorkerScriptPath(projectRoot);
  const logPath = codexWorkerLogPath(projectRoot, join.sessionId);
  const outputFd = openSync(logPath, "a");

  appendGTermSessionEntry(
    projectRoot,
    join.sessionId,
    `[oddchat] Starting managed Codex worker for ${join.topicLabel}. The room agent runs detached on the server; this shell remains available as a backing session.\n`,
    {
      stream: "control",
      chunkKind: "service_event",
    },
  );

  try {
    const child = spawn("node", [scriptPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        OMAN_WORKSPACE_ROOT: projectRoot,
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

    const state = pruneWorkerState(projectRoot);
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
    writeWorkerState(projectRoot, state);

    await waitForManagedParticipantJoin(projectRoot, {
      sessionId: join.sessionId,
      topicId: join.topicId,
      provider: "codex",
      pid: child.pid,
    });

    emitAgentConsoleEvent(projectRoot, {
      kind: "room-participant-managed-worker",
      roomId: join.roomId,
      sessionId: join.sessionId,
      provider: join.provider,
      topicId: join.topicId,
    });

    appendGTermSessionEntry(
      projectRoot,
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
    stopManagedCodexWorker(projectRoot, join.sessionId);
    appendGTermSessionEntry(
      projectRoot,
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

export function joinRoomParticipant(projectRoot, options = {}) {
  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const session = sessionById(projectRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const provider = normalizeProvider(options.provider);
  const room = resolveRoomContext(projectRoot, options);
  const participantId = participantIdFor(sessionId, provider);
  const participantLabel =
    trimmedText(options.participantLabel) ?? participantLabelFor(provider, session.label);
  const state = loadState(projectRoot);
  const timestamp = nowIso();
  const historyLimit = clampNumber(options.historyLimit, DEFAULT_HISTORY_LIMIT, 0, MAX_READ_LIMIT);
  const history = historyLimit > 0 ? loadRoomMessages(projectRoot, room.roomId, historyLimit) : [];
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

  writeState(projectRoot, state);
  emitAgentConsoleEvent(projectRoot, {
    kind: "room-participant-joined",
    roomId: room.roomId,
    participantId,
    sessionId,
  });

  return {
    ok: true,
    participant: participantSnapshot(projectRoot, nextParticipant),
    room,
    messages: visibleHistory,
    nextCursor: lastReadMessageId,
  };
}

export function leaveRoomParticipant(projectRoot, options = {}) {
  const { state, participant } = resolveParticipant(projectRoot, options);
  const timestamp = nowIso();
  const updated = updateParticipant(state, participant.id, (current) => ({
    ...current,
    status: "disconnected",
    updatedAt: timestamp,
    leftAt: timestamp,
  }));
  writeState(projectRoot, state);
  emitAgentConsoleEvent(projectRoot, {
    kind: "room-participant-left",
    roomId: updated.roomId,
    participantId: updated.id,
    sessionId: updated.sessionId,
  });
  return {
    ok: true,
    participant: participantSnapshot(projectRoot, updated),
  };
}

export function getRoomParticipantStatus(projectRoot, options = {}) {
  const { participant } = resolveParticipant(projectRoot, options);
  const snapshot = participantSnapshot(projectRoot, participant);
  const unread = readMessagesSince(projectRoot, snapshot.roomId, snapshot.lastReadMessageId, {
    limit: MAX_READ_LIMIT,
    excludeSenderId: snapshot.id,
    sessionId: snapshot.sessionId,
  });
  return {
    ok: true,
    participant: snapshot,
    unreadCount: unread.messages.length,
    nextCursor: unread.nextCursor,
    participants: listParticipants(projectRoot, {
      roomId: snapshot.roomId,
      connectedOnly: true,
    }),
  };
}

export function readRoomParticipant(projectRoot, options = {}) {
  const { state, participant } = resolveParticipant(projectRoot, options);
  if (participant.status !== "connected") {
    throw new Error("room participant is not connected");
  }

  const cursor = trimmedText(options.cursor) ?? participant.lastReadMessageId ?? null;
  const result = readMessagesSince(projectRoot, participant.roomId, cursor, {
    limit: options.limit,
    excludeSenderId: options.excludeSelf === false ? null : participant.id,
    sessionId: participant.sessionId,
  });

  if (!trimmedText(options.cursor) && result.nextCursor && result.nextCursor !== participant.lastReadMessageId) {
    writeParticipantCursor(projectRoot, state, participant.id, result.nextCursor);
  }

  return {
    ok: true,
    participant: participantSnapshot(projectRoot, state.participants.find((entry) => entry.id === participant.id) ?? participant),
    roomId: participant.roomId,
    cursor,
    cursorFound: result.cursorFound,
    nextCursor: result.nextCursor,
    messages: result.messages,
  };
}

export async function waitRoomParticipant(projectRoot, options = {}) {
  const timeoutMs = clampNumber(
    options.timeoutMs,
    DEFAULT_WAIT_TIMEOUT_MS,
    1000,
    MAX_WAIT_TIMEOUT_MS,
  );

  const readCurrent = () => readRoomParticipant(projectRoot, options);
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

    const unsubscribe = subscribeAgentConsoleEvents(projectRoot, (event) => {
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

export function postRoomParticipantMessage(projectRoot, options = {}) {
  const { state, participant } = resolveParticipant(projectRoot, options);
  if (participant.status !== "connected") {
    throw new Error("room participant is not connected");
  }

  const body = trimmedText(options.body ?? options.text);
  if (!body) {
    throw new Error("message body is required");
  }

  const message = appendLiveRoomMessage(projectRoot, {
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
  writeState(projectRoot, state);

  return {
    ok: true,
    participant: participantSnapshot(projectRoot, updated),
    message,
  };
}

function shQuote(value) {
  const text = String(value ?? "");
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function writeCodexBootstrapScript(
  projectRoot,
  {
    scriptPath,
    env,
    prompt = null,
    includeIrcApprovals = false,
    scriptLabel = "session",
  } = {},
) {
  mkdirSync(oddChatBootstrapDirectory(projectRoot), { recursive: true });
  const filePath = join(
    oddChatBootstrapDirectory(projectRoot),
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
    `cd ${shQuote(projectRoot)}`,
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
  projectRoot,
  {
    scriptPath,
    env,
    prompt = null,
    scriptLabel = "session",
  } = {},
) {
  mkdirSync(oddChatBootstrapDirectory(projectRoot), { recursive: true });
  const slug =
    String(scriptLabel ?? "session")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-") || "session";
  const configPath = join(oddChatBootstrapDirectory(projectRoot), `claude-room-${slug}.config.json`);
  const filePath = join(oddChatBootstrapDirectory(projectRoot), `claude-room-${slug}.sh`);
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
    projectRoot,
    "--mcp-config",
    configPath,
    ...(trimmedText(prompt) ? ["--", prompt] : []),
  ];
  const lines = [
    "#!/bin/zsh",
    "set -euo pipefail",
    `cd ${shQuote(projectRoot)}`,
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

function roomMcpScriptPath(projectRoot) {
  const scriptPath = resolve(MANAGER_RUNTIME_ROOT, "odd_manager_irc_mcp.mjs");
  if (!existsSync(scriptPath)) {
    throw new Error("odd_manager room MCP adapter was not found");
  }
  return scriptPath;
}

function roomMcpEnv(projectRoot, session, provider, options = {}) {
  const env = {
    OMAN_WORKSPACE_ROOT: projectRoot,
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
  projectRoot,
  env,
  prompt = null,
  { includeIrcApprovals = false, scriptLabel = "session" } = {},
) {
  const bootstrapScriptPath = writeCodexBootstrapScript(projectRoot, {
    scriptPath,
    env,
    prompt,
    includeIrcApprovals,
    scriptLabel,
  });
  return `/bin/zsh ${shQuote(bootstrapScriptPath)}`;
}

function claudeBootstrapCommand(scriptPath, projectRoot, env, prompt = null) {
  const bootstrapScriptPath = writeClaudeBootstrapScript(projectRoot, {
    scriptPath,
    env,
    prompt,
    scriptLabel: env.OMAN_TOPIC_ID ? `${env.OMAN_TOPIC_ID}-${env.OMAN_SESSION_LABEL ?? env.OMAN_SESSION_ID}` : env.OMAN_SESSION_LABEL ?? env.OMAN_SESSION_ID,
  });
  return `/bin/zsh ${shQuote(bootstrapScriptPath)}`;
}

function buildShellAgentLaunch(projectRoot, options = {}) {
  const provider = normalizeProvider(options.provider);
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("provider must be codex or claude");
  }

  const sessionId = trimmedText(options.sessionId);
  if (!sessionId) {
    throw new Error("session id is required");
  }

  const session = sessionById(projectRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const scriptPath = roomMcpScriptPath(projectRoot);
  const env = roomMcpEnv(projectRoot, session, provider);

  const command =
    provider === "codex"
      ? codexBootstrapCommand(scriptPath, projectRoot, env, null, {
          scriptLabel: session.label ?? session.id,
        })
      : claudeBootstrapCommand(scriptPath, projectRoot, env);

  return {
    ok: true,
    provider,
    sessionId: session.id,
    sessionLabel: session.label,
    command,
  };
}

export function launchShellAgent(projectRoot, options = {}) {
  const launch = buildShellAgentLaunch(projectRoot, options);
  sendGTermSessionInput(projectRoot, launch.sessionId, `${launch.command}\n`);
  emitAgentConsoleEvent(projectRoot, {
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

function buildShellTopicJoin(projectRoot, options = {}) {
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

  const session = sessionById(projectRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const topic = loadGBoardTopicById(projectRoot, topicId);
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

export async function joinShellAgentTopic(projectRoot, options = {}) {
  const join = buildShellTopicJoin(projectRoot, options);
  if (join.provider === "codex") {
    return launchManagedCodexTopicJoin(projectRoot, join);
  }
  sendGTermSessionInput(projectRoot, join.sessionId, `${join.prompt}${topicJoinSubmitSuffix(join.provider)}`);
  emitAgentConsoleEvent(projectRoot, {
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

function buildRoomParticipantBootstrap(projectRoot, options = {}) {
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

  const session = sessionById(projectRoot, sessionId);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const topic = loadGBoardTopicById(projectRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const scriptPath = roomMcpScriptPath(projectRoot);
  const env = roomMcpEnv(projectRoot, session, provider, { topicId: topic.id });
  const prompt = bootstrapPrompt(topic.label);
  const command =
    provider === "codex"
      ? codexBootstrapCommand(scriptPath, projectRoot, env, prompt, {
          scriptLabel: `${topic.id}-${session.label ?? session.id}`,
        })
      : claudeBootstrapCommand(scriptPath, projectRoot, env, prompt);

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

export async function launchRoomParticipantBootstrap(projectRoot, options = {}) {
  const bootstrap = buildRoomParticipantBootstrap(projectRoot, options);
  sendGTermSessionInput(projectRoot, bootstrap.sessionId, `${bootstrap.command}\n`);
  emitAgentConsoleEvent(projectRoot, {
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

export async function addTopicParticipant(projectRoot, options = {}) {
  const provider = normalizeProvider(options.provider);
  if (!["codex", "claude"].includes(provider)) {
    throw new Error("provider must be codex or claude");
  }

  const role = normalizeParticipantRole(options.role);
  const topicId = trimmedText(options.topicId);
  if (!topicId) {
    throw new Error("topic id is required");
  }

  const topic = loadGBoardTopicById(projectRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const label = trimmedText(options.label) ?? nextTopicParticipantLabel(projectRoot, role);
  const session = createGTermSession(projectRoot, {
    selectedTrainId: topic.selectedTrainId ?? null,
    stationId: topic.stationId ?? null,
    edgeId: topic.edgeId ?? null,
    label,
  });
  const announcement = addedParticipantAnnouncement(role, session.label, provider);
  attachSessionToGBoardTopic(projectRoot, {
    topicId: topic.id,
    sessionId: session.id,
    announcementTitle: announcement.title,
    announcementBody: announcement.body,
    announcementSenderId: "system",
    announcementSenderLabel: "OddChat",
  });

  const bootstrap = await launchRoomParticipantBootstrap(projectRoot, {
    sessionId: session.id,
    topicId: topic.id,
    provider,
  });

  emitAgentConsoleEvent(projectRoot, {
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

export function listOddChatParticipants(projectRoot, options = {}) {
  return listParticipants(projectRoot, options);
}
