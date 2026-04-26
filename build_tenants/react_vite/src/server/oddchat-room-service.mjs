import { randomUUID } from "node:crypto";
import { emitAgentConsoleEvent } from "./odd-console-events.mjs";
import {
  appendConversationEntry,
  ensureConversationHistory,
  listConversationHistories,
  loadConversationHistory,
  roomConversationHistoryId,
} from "./conversation-history-service.mjs";

function timestampStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "item";
}

export function firstMeaningfulLine(text) {
  return String(text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) ?? "Untitled";
}

export function sessionParticipantId(sessionId) {
  return `session:${sessionId}`;
}

export function topicRoomId(topicId) {
  return `topic:${topicId}`;
}

export function topicSessionRoomId(topicId, sessionId) {
  return `topic:${topicId}:session:${sessionId}`;
}

export function parseTopicSessionRoomId(roomId) {
  const match = /^topic:([^:]+):session:([^:]+)$/.exec(String(roomId ?? ""));
  if (!match) {
    return null;
  }
  return {
    topicId: match[1],
    sessionId: match[2],
  };
}

function messageEntryKind(kind) {
  if (kind === "system") {
    return "system";
  }
  if (kind === "promotion") {
    return "share";
  }
  return "message";
}

function projectRoomMessage(entry) {
  const payload = entry?.payload ?? {};
  const recipientSessionIds = Array.isArray(payload.recipientSessionIds)
    ? payload.recipientSessionIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    : null;
  return {
    id: entry.entryId ?? `${timestampStamp()}_${randomUUID().slice(0, 8)}`,
    roomId: payload.roomId ?? "workspace",
    senderId: payload.senderId ?? entry.actorRef?.id ?? "operator",
    senderLabel: payload.senderLabel ?? entry.actorRef?.label ?? "Operator",
    timestamp: entry.createdAt ?? null,
    title: payload.title ?? firstMeaningfulLine(payload.content ?? ""),
    content: String(payload.content ?? ""),
    path: payload.path ?? null,
    source: payload.source ?? "live",
    messageKind: payload.messageKind ?? "chat",
    relatedSessionId: payload.relatedSessionId ?? null,
    recipientSessionIds,
    selectedTrainId: payload.selectedTrainId ?? null,
    stationId: payload.stationId ?? null,
    edgeId: payload.edgeId ?? null,
    conversationHistoryId: entry.conversationHistoryId ?? roomConversationHistoryId(payload.roomId ?? "workspace"),
  };
}

function ensureRoomHistory(workspaceRoot, roomId) {
  const historyId = roomConversationHistoryId(roomId);
  ensureConversationHistory(workspaceRoot, {
    historyId,
    ownerKind: "oddchat_room",
    ownerRef: roomId,
    metadata: {
      roomId,
    },
  });
  return historyId;
}

export function appendLiveRoomMessage(
  workspaceRoot,
  {
    roomId = "workspace",
    senderId = "operator",
    senderLabel = "Operator",
    title = null,
    body,
    kind = "chat",
    source = "live",
    relatedSessionId = null,
    recipientSessionIds = null,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const trimmed = String(body ?? "").trim();
  if (!trimmed) {
    throw new Error("live room message body is required");
  }

  const normalizedRecipientSessionIds = Array.isArray(recipientSessionIds)
    ? Array.from(
        new Set(
          recipientSessionIds
            .map((value) => String(value ?? "").trim())
            .filter(Boolean),
        ),
      )
    : null;

  const historyId = ensureRoomHistory(workspaceRoot, roomId);
  const entry = appendConversationEntry(workspaceRoot, historyId, {
    entryKind: messageEntryKind(kind),
    actorRef: {
      id: senderId,
      label: senderLabel,
      source,
      relatedSessionId,
    },
    payload: {
      roomId,
      senderId,
      senderLabel,
      title: title ?? firstMeaningfulLine(trimmed),
      content: trimmed,
      path: null,
      source,
      messageKind: kind,
      relatedSessionId,
      recipientSessionIds:
        normalizedRecipientSessionIds && normalizedRecipientSessionIds.length
          ? normalizedRecipientSessionIds
          : null,
      selectedTrainId,
      stationId,
      edgeId,
    },
  });

  const message = projectRoomMessage(entry);

  emitAgentConsoleEvent(workspaceRoot, {
    kind: "room-message",
    roomId,
    messageId: message.id,
  });

  return message;
}

export function loadRoomMessages(workspaceRoot, roomId, limit = null) {
  const historyId = roomConversationHistoryId(roomId);
  const { entries } = loadConversationHistory(workspaceRoot, historyId, {
    limit: limit ?? undefined,
  });
  return entries.map(projectRoomMessage);
}

export function loadLiveRoomMessages(workspaceRoot) {
  const histories = listConversationHistories(workspaceRoot, {
    ownerKind: "oddchat_room",
  });

  const messages = [];
  for (const history of histories) {
    const { entries } = loadConversationHistory(workspaceRoot, history.conversationHistoryId);
    for (const entry of entries) {
      messages.push(projectRoomMessage(entry));
    }
  }

  messages.sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
  return messages;
}
