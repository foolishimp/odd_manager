import {
  loadGBoardTopicById,
  loadGBoardTopicByRoomId,
} from "./oddboard-service.mjs";
import {
  parseTopicSessionRoomId,
  slugify,
  topicSessionRoomId,
} from "./oddchat-room-service.mjs";
import { listOddChatParticipants } from "./oddchat-participant-service.mjs";
import {
  loadGTermPoolState,
  sendGTermSessionRoomInput,
} from "./oddterm-pool-service.mjs";

const MENTION_PATTERN = /(^|\s)@([a-z0-9_-]+)/gi;

function escapeRegExp(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionedWorkerHandles(body) {
  const handles = [];
  const seen = new Set();

  String(body ?? "").replace(MENTION_PATTERN, (_, prefix, handle) => {
    const normalized = String(handle ?? "").trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      handles.push(normalized);
    }
    return `${prefix}@${handle}`;
  });

  return handles;
}

function sessionAliases(session) {
  const aliases = new Set();
  const normalizedLabel = String(session?.label ?? "").trim().toLowerCase();
  if (normalizedLabel) {
    aliases.add(normalizedLabel);
    aliases.add(slugify(normalizedLabel));
  }
  return Array.from(aliases).filter(Boolean);
}

function attachedTopicSessions(projectRoot, topic) {
  if (!topic) {
    return [];
  }

  const pool = loadGTermPoolState(projectRoot);
  const sessionsById = new Map(pool.sessions.map((session) => [session.id, session]));
  return topic.attachedSessionIds
    .map((sessionId) => sessionsById.get(sessionId))
    .filter(Boolean);
}

function findAttachedSessionByHandle(sessions, handle) {
  const normalizedHandle = String(handle ?? "").trim().toLowerCase();
  if (!normalizedHandle) {
    return null;
  }

  return (
    sessions.find((session) => sessionAliases(session).includes(normalizedHandle)) ?? null
  );
}

function stripDirectMention(body, session) {
  let next = String(body ?? "");

  for (const alias of sessionAliases(session)) {
    const pattern = new RegExp(`(^|\\s)@${escapeRegExp(alias)}(?=\\s|$)`, "ig");
    next = next.replace(pattern, "$1");
  }

  const compact = next.replace(/\s+/g, " ").trim();
  return compact || String(body ?? "").trim();
}

function resolveTopicContext(projectRoot, roomId) {
  const directRoom = parseTopicSessionRoomId(roomId);
  if (directRoom) {
    const topic = loadGBoardTopicById(projectRoot, directRoom.topicId);
    if (!topic) {
      return {
        topic: null,
        targetSession: null,
      };
    }

    const attachedSessions = attachedTopicSessions(projectRoot, topic);
    return {
      topic,
      targetSession:
        attachedSessions.find((session) => session.id === directRoom.sessionId) ?? null,
    };
  }

  return {
    topic: loadGBoardTopicByRoomId(projectRoot, roomId),
    targetSession: null,
  };
}

function submittedRoomInput(body) {
  const trimmed = String(body ?? "").trim();
  return trimmed ? `${trimmed}\r` : "";
}

function hasRoomParticipant(projectRoot, sessionId, roomId) {
  return (
    listOddChatParticipants(projectRoot, {
      sessionId,
      roomId,
      connectedOnly: true,
    }).length > 0
  );
}

export function resolvePostedRoom(
  projectRoot,
  {
    roomId = "workspace",
    body,
  } = {},
) {
  const resolved = resolveTopicContext(projectRoot, roomId);
  const trimmedBody = String(body ?? "").trim();

  if (!resolved.topic) {
    return {
      roomId,
      targetSessionId: null,
      privateChannel: false,
      body: trimmedBody,
    };
  }

  if (resolved.targetSession) {
    return {
      roomId,
      targetSessionId: resolved.targetSession.id,
      targetSessionIds: [resolved.targetSession.id],
      privateChannel: true,
      body: stripDirectMention(trimmedBody, resolved.targetSession),
      recipientSessionIds: null,
    };
  }

  const attachedSessions = attachedTopicSessions(projectRoot, resolved.topic);
  const mentionedSessions = mentionedWorkerHandles(trimmedBody)
    .map((handle) => findAttachedSessionByHandle(attachedSessions, handle))
    .filter(Boolean);
  const uniqueMentionedSessions = Array.from(
    new Map(mentionedSessions.map((session) => [session.id, session])).values(),
  );

  if (uniqueMentionedSessions.length > 0) {
    const targetSessionIds = uniqueMentionedSessions.map((session) => session.id);
    return {
      roomId: resolved.topic.roomId,
      targetSessionId: targetSessionIds[0] ?? null,
      targetSessionIds,
      privateChannel: false,
      body: trimmedBody,
      recipientSessionIds: targetSessionIds,
    };
  }

  const roomRecipientSessionIds = attachedSessions
    .map((session) => session.id)
    .filter((sessionId) => resolved.topic.roomRecipientSessionIds.includes(sessionId));

  return {
    roomId: resolved.topic.roomId,
    targetSessionId: null,
    targetSessionIds: roomRecipientSessionIds,
    privateChannel: false,
    body: trimmedBody,
    recipientSessionIds:
      roomRecipientSessionIds.length === attachedSessions.length ? null : roomRecipientSessionIds,
  };
}

export async function dispatchAgentReplies(
  projectRoot,
  {
    roomId = "workspace",
    body,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const resolved = resolvePostedRoom(projectRoot, {
    roomId,
    body,
  });
  const topicContext = resolveTopicContext(projectRoot, resolved.roomId);
  const topic = topicContext.topic;
  if (!topic) {
    return [];
  }

  const attachedSessions = attachedTopicSessions(projectRoot, topic);
  const targetSessions = resolved.privateChannel
    ? attachedSessions.filter((session) => session.id === resolved.targetSessionId)
    : attachedSessions.filter((session) => resolved.targetSessionIds.includes(session.id));
  const legacyTargetSessions = targetSessions.filter(
    (session) => !hasRoomParticipant(projectRoot, session.id, resolved.roomId),
  );

  const input = submittedRoomInput(resolved.body);
  if (!input) {
    return [];
  }

  const deliveries = targetSessions
    .filter((session) => hasRoomParticipant(projectRoot, session.id, resolved.roomId))
    .map((session) => ({
      sessionId: session.id,
      roomId: resolved.roomId,
      ok: true,
      mode: "participant-mailbox",
    }));

  return [
    ...deliveries,
    ...legacyTargetSessions.map((session) => {
    try {
      sendGTermSessionRoomInput(projectRoot, session.id, {
        data: input,
        roomId: resolved.roomId,
        selectedTrainId: selectedTrainId ?? topic.selectedTrainId ?? null,
        stationId: stationId ?? topic.stationId ?? null,
        edgeId: edgeId ?? topic.edgeId ?? null,
      });
      return {
        sessionId: session.id,
        roomId: resolved.roomId,
        ok: true,
        mode: "stdin-bootstrap",
      };
    } catch (error) {
      return {
        sessionId: session.id,
        roomId: resolved.roomId,
        ok: false,
        mode: "stdin-bootstrap",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    }),
  ];
}
