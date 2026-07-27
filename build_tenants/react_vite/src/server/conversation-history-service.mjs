import { randomUUID } from "node:crypto";
import {
  lstatSync,
  readdirSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  admitProjectRuntimeDirectory,
  admitProjectRuntimeFile,
  appendProjectRuntimeFile,
  projectRuntimeLexicalPath,
  readProjectRuntimeFile,
  writeProjectRuntimeFile,
} from "./project-runtime-carrier-service.mjs";

const MAX_HISTORY_BYTES = 1024 * 1024;
const HISTORY_TAIL_LINES = 400;
const HISTORY_ROOT_SEGMENTS = [".ai-workspace", "runtime", "conversation_history"];
const historyCache = new Map();

function slugifySegment(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "item";
}

function cacheKey(workspaceRoot, historyId) {
  return `${resolve(workspaceRoot)}::${historyId}`;
}

export function conversationHistoryRoot(workspaceRoot) {
  return projectRuntimeLexicalPath(workspaceRoot, HISTORY_ROOT_SEGMENTS);
}

function conversationHistoryDirectory(workspaceRoot, historyId) {
  return projectRuntimeLexicalPath(workspaceRoot, [
    ...HISTORY_ROOT_SEGMENTS,
    historyId,
  ]);
}

function conversationHistoryEntriesPath(workspaceRoot, historyId) {
  return projectRuntimeLexicalPath(workspaceRoot, [
    ...HISTORY_ROOT_SEGMENTS,
    historyId,
    "entries.ndjson",
  ]);
}

function historyDirectorySegments(historyId) {
  return [...HISTORY_ROOT_SEGMENTS, historyId];
}

function lexicalPathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function admitHistoryDirectory(workspaceRoot, historyId, options = {}) {
  const rootExists = lexicalPathExists(conversationHistoryRoot(workspaceRoot));
  const historyExists = rootExists
    && lexicalPathExists(conversationHistoryDirectory(workspaceRoot, historyId));
  if (options.create !== true && (!rootExists || !historyExists)) {
    return null;
  }
  return admitProjectRuntimeDirectory(
    workspaceRoot,
    historyDirectorySegments(historyId),
    { create: options.create === true },
  );
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

function readHistoryText(workspaceRoot, historyId, fileName) {
  if (!admitHistoryDirectory(workspaceRoot, historyId)) {
    return null;
  }
  const filePath = projectRuntimeLexicalPath(workspaceRoot, [
    ...historyDirectorySegments(historyId),
    fileName,
  ]);
  if (!lexicalPathExists(filePath)) {
    return null;
  }
  return readProjectRuntimeFile(
    workspaceRoot,
    historyDirectorySegments(historyId),
    fileName,
    { encoding: "utf8" },
  );
}

function admitHistoryMeta(value, workspaceRoot, historyId) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || value.conversationHistoryId !== historyId
    || value.workspaceRoot !== resolvedWorkspaceRoot
  ) {
    throw new Error(
      "conversation history metadata does not match the exact Project and history identity",
    );
  }
  return value;
}

function readJsonFile(workspaceRoot, historyId) {
  const raw = readHistoryText(workspaceRoot, historyId, "meta.json");
  if (raw === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("conversation history metadata is invalid");
  }
  return admitHistoryMeta(parsed, workspaceRoot, historyId);
}

function isPermissionError(error) {
  return error?.code === "EACCES" || error?.code === "EPERM";
}

function writeTextFileIfPossible(workspaceRoot, historyId, fileName, content) {
  try {
    writeProjectRuntimeFile(
      workspaceRoot,
      historyDirectorySegments(historyId),
      fileName,
      content,
      { encoding: "utf8" },
    );
    return true;
  } catch (caught) {
    if (isPermissionError(caught)) {
      return false;
    }
    throw caught;
  }
}

function loadCacheRecord(workspaceRoot, historyId) {
  const key = cacheKey(workspaceRoot, historyId);
  const existing = historyCache.get(key);
  const directory = admitHistoryDirectory(workspaceRoot, historyId);
  if (!directory) {
    historyCache.delete(key);
    return {
      historyBytes: 0,
      tailLines: [],
    };
  }
  const entriesPath = conversationHistoryEntriesPath(workspaceRoot, historyId);
  const hasEntries = lexicalPathExists(entriesPath);
  if (existing) {
    if (hasEntries) {
      admitProjectRuntimeFile(
        workspaceRoot,
        historyDirectorySegments(historyId),
        "entries.ndjson",
        { mustExist: true },
      );
    } else {
      existing.historyBytes = 0;
      existing.tailLines = [];
    }
    decodeEntries(existing.tailLines, historyId);
    return existing;
  }

  const record = {
    historyBytes: 0,
    tailLines: [],
  };

  if (hasEntries) {
    let raw = "";
    try {
      raw = readProjectRuntimeFile(
        workspaceRoot,
        historyDirectorySegments(historyId),
        "entries.ndjson",
        { encoding: "utf8" },
      );
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      raw = "";
    }
    const trimmed = trimBufferTail(raw, MAX_HISTORY_BYTES);
    if (trimmed !== raw) {
      writeTextFileIfPossible(
        workspaceRoot,
        historyId,
        "entries.ndjson",
        trimmed,
      );
    }
    record.historyBytes = Buffer.byteLength(trimmed, "utf8");
    record.tailLines = trimmed.split("\n").filter(Boolean).slice(-HISTORY_TAIL_LINES);
  }

  decodeEntries(record.tailLines, historyId);
  historyCache.set(key, record);
  return record;
}

function persistMeta(workspaceRoot, historyId, meta) {
  admitHistoryDirectory(workspaceRoot, historyId, { create: true });
  return writeTextFileIfPossible(
    workspaceRoot,
    historyId,
    "meta.json",
    `${JSON.stringify(meta, null, 2)}\n`,
  );
}

function pruneHistoryWithinBudget(workspaceRoot, historyId, cacheRecord) {
  const entriesPath = conversationHistoryEntriesPath(workspaceRoot, historyId);
  admitHistoryDirectory(workspaceRoot, historyId, { create: true });
  if (!lexicalPathExists(entriesPath)) {
    cacheRecord.historyBytes = 0;
    cacheRecord.tailLines = [];
    return;
  }

  let raw = "";
  try {
    raw = readProjectRuntimeFile(
      workspaceRoot,
      historyDirectorySegments(historyId),
      "entries.ndjson",
      { encoding: "utf8" },
    );
  } catch (error) {
    if (!isPermissionError(error)) throw error;
    raw = "";
  }
  const trimmed = trimBufferTail(raw, MAX_HISTORY_BYTES);
  if (trimmed !== raw) {
    writeTextFileIfPossible(
      workspaceRoot,
      historyId,
      "entries.ndjson",
      trimmed,
    );
  }
  cacheRecord.historyBytes = Buffer.byteLength(trimmed, "utf8");
  cacheRecord.tailLines = trimmed.split("\n").filter(Boolean).slice(-HISTORY_TAIL_LINES);
}

function decodeEntries(lines, historyId) {
  return lines
    .map((line) => {
      try {
        const entry = JSON.parse(line);
        if (entry?.conversationHistoryId !== historyId) {
          throw new Error(
            "conversation history entry does not match the exact history identity",
          );
        }
        return entry;
      } catch {
        throw new Error("conversation history entry is invalid");
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
  workspaceRoot,
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

  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const current = readJsonFile(resolvedWorkspaceRoot, historyId);
  if (
    !current
    && lexicalPathExists(
      conversationHistoryEntriesPath(resolvedWorkspaceRoot, historyId),
    )
  ) {
    throw new Error(
      "conversation history entries cannot be admitted without exact metadata",
    );
  }
  if (
    current
    && ownerKind
    && ownerKind !== "unknown"
    && (
      current.ownerKind !== ownerKind
      || current.ownerRef !== (ownerRef ?? historyId)
    )
  ) {
    throw new Error(
      "conversation history owner does not match the admitted history identity",
    );
  }
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
        workspaceRoot: resolvedWorkspaceRoot,
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

export function updateConversationMetadata(workspaceRoot, historyId, metadata = {}) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const existing =
    readJsonFile(resolvedWorkspaceRoot, historyId) ??
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
  workspaceRoot,
  historyId,
  {
    entryKind = "note",
    actorRef = null,
    payload = {},
    createdAt = nowIso(),
  } = {},
) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
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

  const cacheRecord = loadCacheRecord(resolvedWorkspaceRoot, historyId);
  const line = `${JSON.stringify(entry)}\n`;
  appendProjectRuntimeFile(
    resolvedWorkspaceRoot,
    historyDirectorySegments(historyId),
    "entries.ndjson",
    line,
    { encoding: "utf8" },
  );
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

export function loadConversationHistory(workspaceRoot, historyId, options = {}) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const meta = readJsonFile(resolvedWorkspaceRoot, historyId);
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
    entries: decodeEntries(lines, historyId),
  };
}

export function listConversationHistories(workspaceRoot, options = {}) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const root = conversationHistoryRoot(resolvedWorkspaceRoot);
  if (!lexicalPathExists(root)) {
    return [];
  }
  admitProjectRuntimeDirectory(resolvedWorkspaceRoot, HISTORY_ROOT_SEGMENTS);

  const ownerKind = options.ownerKind ?? null;
  const histories = [];
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const meta = readJsonFile(resolvedWorkspaceRoot, entry.name);
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

export function loadConversationHistoryStats(workspaceRoot, historyId) {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const meta = readJsonFile(resolvedWorkspaceRoot, historyId);
  if (!meta) {
    return {
      historyBytes: 0,
      retainedLineCount: 0,
    };
  }
  const cacheRecord = loadCacheRecord(resolvedWorkspaceRoot, historyId);
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

export function extractConversationRange(workspaceRoot, historyId, options = {}) {
  const { meta, entries } = loadConversationHistory(workspaceRoot, historyId, {
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
