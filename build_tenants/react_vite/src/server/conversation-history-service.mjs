import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const MAX_HISTORY_BYTES = 1024 * 1024;
const HISTORY_TAIL_LINES = 400;
const historyCache = new Map();

function slugifySegment(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

function cacheKey(projectRoot, historyId) {
  return `${resolve(projectRoot)}::${historyId}`;
}

export function conversationHistoryRoot(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/runtime/conversation_history");
}

function conversationHistoryDirectory(projectRoot, historyId) {
  return join(conversationHistoryRoot(projectRoot), historyId);
}

function conversationHistoryMetaPath(projectRoot, historyId) {
  return join(conversationHistoryDirectory(projectRoot, historyId), "meta.json");
}

function conversationHistoryEntriesPath(projectRoot, historyId) {
  return join(conversationHistoryDirectory(projectRoot, historyId), "entries.ndjson");
}

function trimBufferTail(text, maxBytes) {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.length <= maxBytes) {
    return text;
  }
  const trimmed = buffer.subarray(buffer.length - maxBytes).toString("utf8");
  const newlineIndex = trimmed.indexOf("\n");
  return newlineIndex >= 0 ? trimmed.slice(newlineIndex + 1) : trimmed;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function loadCacheRecord(projectRoot, historyId) {
  const key = cacheKey(projectRoot, historyId);
  const existing = historyCache.get(key);
  if (existing) {
    return existing;
  }

  const entriesPath = conversationHistoryEntriesPath(projectRoot, historyId);
  const record = {
    historyBytes: 0,
    tailLines: [],
  };

  if (existsSync(entriesPath)) {
    const trimmed = trimBufferTail(readFileSync(entriesPath, "utf8"), MAX_HISTORY_BYTES);
    writeFileSync(entriesPath, trimmed, "utf8");
    record.historyBytes = Buffer.byteLength(trimmed, "utf8");
    record.tailLines = trimmed.split("\n").filter(Boolean).slice(-HISTORY_TAIL_LINES);
  }

  historyCache.set(key, record);
  return record;
}

function persistMeta(projectRoot, historyId, meta) {
  mkdirSync(conversationHistoryDirectory(projectRoot, historyId), { recursive: true });
  writeFileSync(conversationHistoryMetaPath(projectRoot, historyId), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

function pruneHistoryWithinBudget(projectRoot, historyId, cacheRecord) {
  const entriesPath = conversationHistoryEntriesPath(projectRoot, historyId);
  if (!existsSync(entriesPath)) {
    cacheRecord.historyBytes = 0;
    cacheRecord.tailLines = [];
    return;
  }

  const trimmed = trimBufferTail(readFileSync(entriesPath, "utf8"), MAX_HISTORY_BYTES);
  writeFileSync(entriesPath, trimmed, "utf8");
  cacheRecord.historyBytes = Buffer.byteLength(trimmed, "utf8");
  cacheRecord.tailLines = trimmed.split("\n").filter(Boolean).slice(-HISTORY_TAIL_LINES);
}

function decodeEntries(lines) {
  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

export function roomConversationHistoryId(roomId) {
  return `oddchat_${slugifySegment(roomId)}`;
}

export function sessionConversationHistoryId(sessionId) {
  return `oddterm_${sessionId}`;
}

export function ensureConversationHistory(
  projectRoot,
  {
    historyId,
    ownerKind,
    ownerRef,
    metadata = {},
  },
) {
  if (!historyId) {
    throw new Error("conversation history id is required");
  }

  const resolvedWorkspaceRoot = resolve(projectRoot);
  const metaPath = conversationHistoryMetaPath(resolvedWorkspaceRoot, historyId);
  const current = existsSync(metaPath) ? readJsonFile(metaPath) : null;
  const timestamp = nowIso();
  const next = current
    ? {
        ...current,
        ownerKind: current.ownerKind ?? ownerKind ?? "unknown",
        ownerRef: current.ownerRef ?? ownerRef ?? historyId,
        metadata: {
          ...(current.metadata ?? {}),
          ...metadata,
        },
        updatedAt: timestamp,
      }
    : {
        conversationHistoryId: historyId,
        projectRoot: resolvedWorkspaceRoot,
        ownerKind: ownerKind ?? "unknown",
        ownerRef: ownerRef ?? historyId,
        metadata: {
          ...metadata,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

  persistMeta(resolvedWorkspaceRoot, historyId, next);
  loadCacheRecord(resolvedWorkspaceRoot, historyId);
  return next;
}

export function updateConversationMetadata(projectRoot, historyId, metadata = {}) {
  const resolvedWorkspaceRoot = resolve(projectRoot);
  const existing =
    readJsonFile(conversationHistoryMetaPath(resolvedWorkspaceRoot, historyId)) ??
    ensureConversationHistory(resolvedWorkspaceRoot, {
      historyId,
      ownerKind: "unknown",
      ownerRef: historyId,
      metadata: {},
    });

  const next = {
    ...existing,
    metadata: {
      ...(existing.metadata ?? {}),
      ...metadata,
    },
    updatedAt: nowIso(),
  };

  persistMeta(resolvedWorkspaceRoot, historyId, next);
  return next;
}

export function appendConversationEntry(
  projectRoot,
  historyId,
  {
    entryKind = "note",
    actorRef = null,
    payload = {},
    createdAt = nowIso(),
  } = {},
) {
  const resolvedWorkspaceRoot = resolve(projectRoot);
  ensureConversationHistory(resolvedWorkspaceRoot, {
    historyId,
    ownerKind: "unknown",
    ownerRef: historyId,
    metadata: {},
  });

  const entry = {
    entryId: randomUUID(),
    conversationHistoryId: historyId,
    entryKind,
    actorRef,
    createdAt,
    payload,
  };

  const entriesPath = conversationHistoryEntriesPath(resolvedWorkspaceRoot, historyId);
  const cacheRecord = loadCacheRecord(resolvedWorkspaceRoot, historyId);
  const line = `${JSON.stringify(entry)}\n`;
  appendFileSync(entriesPath, line, "utf8");
  cacheRecord.historyBytes += Buffer.byteLength(line, "utf8");
  cacheRecord.tailLines.push(line.trimEnd());
  if (cacheRecord.tailLines.length > HISTORY_TAIL_LINES) {
    cacheRecord.tailLines.splice(0, cacheRecord.tailLines.length - HISTORY_TAIL_LINES);
  }
  if (cacheRecord.historyBytes > MAX_HISTORY_BYTES * 1.2) {
    pruneHistoryWithinBudget(resolvedWorkspaceRoot, historyId, cacheRecord);
  }

  updateConversationMetadata(resolvedWorkspaceRoot, historyId, {});
  return entry;
}

export function loadConversationHistory(projectRoot, historyId, options = {}) {
  const resolvedWorkspaceRoot = resolve(projectRoot);
  const meta = readJsonFile(conversationHistoryMetaPath(resolvedWorkspaceRoot, historyId));
  if (!meta) {
    return {
      meta: null,
      entries: [],
    };
  }

  const cacheRecord = loadCacheRecord(resolvedWorkspaceRoot, historyId);
  const limit = Number.isFinite(options.limit) ? Math.max(1, Number(options.limit)) : null;
  const lines = limit ? cacheRecord.tailLines.slice(-limit) : cacheRecord.tailLines;

  return {
    meta,
    entries: decodeEntries(lines),
  };
}

export function listConversationHistories(projectRoot, options = {}) {
  const resolvedWorkspaceRoot = resolve(projectRoot);
  const root = conversationHistoryRoot(resolvedWorkspaceRoot);
  if (!existsSync(root)) {
    return [];
  }

  const ownerKind = options.ownerKind ?? null;
  const histories = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const meta = readJsonFile(conversationHistoryMetaPath(resolvedWorkspaceRoot, entry.name));
    if (!meta) {
      continue;
    }
    if (ownerKind && meta.ownerKind !== ownerKind) {
      continue;
    }
    histories.push(meta);
  }

  histories.sort((left, right) => String(left.updatedAt ?? left.createdAt).localeCompare(String(right.updatedAt ?? right.createdAt)));
  return histories;
}

export function loadConversationHistoryStats(projectRoot, historyId) {
  const cacheRecord = loadCacheRecord(projectRoot, historyId);
  return {
    historyBytes: cacheRecord.historyBytes,
    retainedLineCount: cacheRecord.tailLines.length,
  };
}

export function stripTerminalControlText(text) {
  return String(text ?? "")
    .replace(/\u001b\[(\d+)C/g, (_, count) => " ".repeat(Number.parseInt(count, 10) || 0))
    .replace(/\u001b\][^\u001b\u0007]*(?:\u0007|\u001b\\)/g, "")
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b[@-_]/g, "")
    .replace(/\u0007/g, "")
    .replace(/\r/g, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}

export function conversationEntryText(entry, options = {}) {
  const payload = entry?.payload ?? {};
  const sanitizeTerminalText = Boolean(options.sanitizeTerminalText);
  const normalize = (value) =>
    sanitizeTerminalText ? stripTerminalControlText(value) : value;
  if (typeof payload.text === "string") {
    return normalize(payload.text);
  }
  if (typeof payload.content === "string") {
    return normalize(payload.content);
  }
  if (typeof payload.body === "string") {
    return normalize(payload.body);
  }
  if (typeof payload.message === "string") {
    return normalize(payload.message);
  }
  return "";
}

export function extractConversationRange(projectRoot, historyId, options = {}) {
  const { meta, entries } = loadConversationHistory(projectRoot, historyId, {
    limit: options.entryCount ?? options.limit ?? 120,
  });
  const sanitizeTerminalText = Boolean(options.sanitizeTerminalText);
  return {
    meta,
    entries,
    text: entries
      .map((entry) => conversationEntryText(entry, { sanitizeTerminalText }))
      .filter(Boolean)
      .join(""),
  };
}
