import {
  loadGBoardTopicById,
  loadGBoardTopicByRoomId,
} from "./oddboard-service.mjs";
import {
  parseTopicSessionRoomId,
  slugify,
  topicSessionRoomId,
} from "./oddchat-room-service.mjs";
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

function attachedTopicSessions(workspaceRoot, topic) {
  if (!topic) {
    return [];
  }

  const pool = loadGTermPoolState(workspaceRoot);
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

function resolveTopicContext(workspaceRoot, roomId) {
  const directRoom = parseTopicSessionRoomId(roomId);
  if (directRoom) {
    const topic = loadGBoardTopicById(workspaceRoot, directRoom.topicId);
    if (!topic) {
      return {
        topic: null,
        targetSession: null,
      };
    }

    const attachedSessions = attachedTopicSessions(workspaceRoot, topic);
    return {
      topic,
      targetSession:
        attachedSessions.find((session) => session.id === directRoom.sessionId) ?? null,
    };
  }

  return {
    topic: loadGBoardTopicByRoomId(workspaceRoot, roomId),
    targetSession: null,
  };
}

function submittedRoomInput(body) {
  const trimmed = String(body ?? "").trim();
  return trimmed ? `${trimmed}\r` : "";
}

export function resolvePostedRoom(
  workspaceRoot,
  {
    roomId = "workspace",
    body,
  } = {},
) {
  const resolved = resolveTopicContext(workspaceRoot, roomId);
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
      privateChannel: true,
      body: stripDirectMention(trimmedBody, resolved.targetSession),
    };
  }

  const attachedSessions = attachedTopicSessions(workspaceRoot, resolved.topic);
  const mentionedSessions = mentionedWorkerHandles(trimmedBody)
    .map((handle) => findAttachedSessionByHandle(attachedSessions, handle))
    .filter(Boolean);
  const uniqueMentionedSessions = Array.from(
    new Map(mentionedSessions.map((session) => [session.id, session])).values(),
  );

  if (uniqueMentionedSessions.length === 1) {
    const targetSession = uniqueMentionedSessions[0];
    return {
      roomId: topicSessionRoomId(resolved.topic.id, targetSession.id),
      targetSessionId: targetSession.id,
      privateChannel: true,
      body: stripDirectMention(trimmedBody, targetSession),
    };
  }

  return {
    roomId: resolved.topic.roomId,
    targetSessionId: null,
    privateChannel: false,
    body: trimmedBody,
  };
}

export async function dispatchAgentReplies(
  workspaceRoot,
  {
    roomId = "workspace",
    body,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const resolved = resolvePostedRoom(workspaceRoot, {
    roomId,
    body,
  });
  const topicContext = resolveTopicContext(workspaceRoot, resolved.roomId);
  const topic = topicContext.topic;
  if (!topic) {
    return [];
  }

  const attachedSessions = attachedTopicSessions(workspaceRoot, topic);
  const targetSessions = resolved.privateChannel
    ? attachedSessions.filter((session) => session.id === resolved.targetSessionId)
    : attachedSessions;

  const input = submittedRoomInput(resolved.body);
  if (!input) {
    return [];
  }

  return targetSessions.map((session) => {
    try {
      sendGTermSessionRoomInput(workspaceRoot, session.id, {
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
      };
    } catch (error) {
      return {
        sessionId: session.id,
        roomId: resolved.roomId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
