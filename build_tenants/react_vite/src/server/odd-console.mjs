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

export function loadAgentConsoleState(projectRoot) {
  const gterm = loadGTermPoolState(projectRoot);
  const liveMessages = loadLiveRoomMessages(projectRoot);
  const gboardRecords = loadGBoardRecords(projectRoot);
  const gboardTopics = loadGBoardTopics(projectRoot);
  const participants = listOddChatParticipants(projectRoot, {
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
    projectRoot,
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

  const message = appendLiveRoomMessage(projectRoot, {
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
  projectRoot,
  options = {},
) {
  return persistGBoardComment(projectRoot, options);
}

export function createGChatTopic(
  projectRoot,
  options = {},
) {
  const topic = persistGBoardTopic(projectRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function attachGChatTopicRecord(
  projectRoot,
  options = {},
) {
  const topic = attachRecordToGBoardTopic(projectRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function attachGChatTopicSession(
  projectRoot,
  options = {},
) {
  const topic = attachSessionToGBoardTopic(projectRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function setGChatTopicRoomRecipients(
  projectRoot,
  options = {},
) {
  const topic = setGBoardTopicRoomRecipients(projectRoot, options);
  return {
    ok: true,
    topic,
  };
}

export function createTerminalPromotionComment(
  projectRoot,
  options = {},
) {
  return createGTermPromotionComment(projectRoot, options);
}
