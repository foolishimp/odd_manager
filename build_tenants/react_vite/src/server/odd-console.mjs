import {
  attachRecordToGBoardTopic,
  attachSessionToGBoardTopic,
  createGBoardTopic as persistGBoardTopic,
  loadGBoardRecords,
  loadGBoardTopics,
  createGBoardComment as persistGBoardComment,
  createGTermPromotionComment,
  setGBoardTopicRoomRecipients,
} from "./oddboard-service.mjs";
import { roomConversationHistoryId } from "./conversation-history-service.mjs";
import { loadGTermPoolState } from "./oddterm-pool-service.mjs";
import { resolvePostedRoom } from "./odd-plugin-host.mjs";
import { listOddChatParticipants } from "./oddchat-participant-service.mjs";
import {
  appendLiveRoomMessage,
  loadLiveRoomMessages,
} from "./oddchat-room-service.mjs";

export function loadAgentConsoleState(workspaceRoot) {
  const gterm = loadGTermPoolState(workspaceRoot);
  const liveMessages = loadLiveRoomMessages(workspaceRoot);
  const gboardRecords = loadGBoardRecords(workspaceRoot);
  const gboardTopics = loadGBoardTopics(workspaceRoot);
  const participants = listOddChatParticipants(workspaceRoot, {
    connectedOnly: true,
  });
  const recordById = new Map(gboardRecords.map((record) => [record.id, record]));
  const participantsBySessionId = new Map();
  for (const participant of participants) {
    const current = participantsBySessionId.get(participant.sessionId) ?? [];
    current.push(participant);
    participantsBySessionId.set(participant.sessionId, current);
  }
  const sessionById = new Map(
    gterm.sessions.map((session) => [
      session.id,
      {
        ...session,
        participants: participantsBySessionId.get(session.id) ?? [],
      },
    ]),
  );
  const gchatTopics = gboardTopics.map((topic) => ({
    id: topic.id,
    roomId: topic.roomId,
    label: topic.label,
    originKind: topic.originKind,
    assetKind: topic.assetKind,
    assetId: topic.assetId,
    assetLabel: topic.assetLabel,
    assetPath: topic.assetPath,
    selectedTrainId: topic.selectedTrainId,
    stationId: topic.stationId,
    edgeId: topic.edgeId,
    updatedAt: topic.updatedAt,
    roomRecipientSessionIds: topic.roomRecipientSessionIds,
    attachedRecords: topic.attachedRecordIds
      .map((recordId) => recordById.get(recordId))
      .filter(Boolean),
    attachedSessions: topic.attachedSessionIds
      .map((sessionId) => sessionById.get(sessionId))
      .filter(Boolean),
    participants: participants.filter(
      (participant) =>
        participant.topicId === topic.id ||
        participant.roomId === topic.roomId ||
        participant.roomId.startsWith(`topic:${topic.id}:session:`),
    ),
    conversationHistoryId: roomConversationHistoryId(topic.roomId),
  }));

  const gchatMessages = [...liveMessages].sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));

  return {
    workspaceRoot,
    oddboard: {
      topics: gboardTopics,
      records: gboardRecords,
    },
    oddchat: {
      topics: gchatTopics,
      messages: gchatMessages,
    },
    oddterm: {
      ...gterm,
      sessions: gterm.sessions.map((session) => sessionById.get(session.id) ?? session),
    },
  };
}

export function createGChatMessage(
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

  const message = appendLiveRoomMessage(workspaceRoot, {
    roomId: resolved.roomId,
    senderId: "operator",
    senderLabel: "Operator",
    body: resolved.body ?? body,
    kind: "chat",
    source: "live",
    recipientSessionIds: resolved.recipientSessionIds,
    selectedTrainId,
    stationId,
    edgeId,
  });

  return {
    ok: true,
    id: message.id,
    roomId: message.roomId,
    title: message.title,
    targetSessionId: resolved.targetSessionId,
    privateChannel: resolved.privateChannel,
  };
}

export function createGBoardComment(
  workspaceRoot,
  options = {},
) {
  return persistGBoardComment(workspaceRoot, options);
}

export function createGChatTopic(
  workspaceRoot,
  options = {},
) {
  const topic = persistGBoardTopic(workspaceRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function attachGChatTopicRecord(
  workspaceRoot,
  options = {},
) {
  const topic = attachRecordToGBoardTopic(workspaceRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function attachGChatTopicSession(
  workspaceRoot,
  options = {},
) {
  const topic = attachSessionToGBoardTopic(workspaceRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function setGChatTopicRoomRecipients(
  workspaceRoot,
  options = {},
) {
  const topic = setGBoardTopicRoomRecipients(workspaceRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function createTerminalPromotionComment(
  workspaceRoot,
  options = {},
) {
  return createGTermPromotionComment(workspaceRoot, options);
}
