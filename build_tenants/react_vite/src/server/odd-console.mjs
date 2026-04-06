import {
  attachRecordToGBoardTopic,
  attachSessionToGBoardTopic,
  createOrResumeGBoardTopic,
  loadGBoardRecords,
  loadGBoardTopics,
  createGBoardComment as persistGBoardComment,
  createGTermPromotionComment,
} from "./oddboard-service.mjs";
import { roomConversationHistoryId } from "./conversation-history-service.mjs";
import { loadGTermPoolState } from "./oddterm-pool-service.mjs";
import { resolvePostedRoom } from "./odd-plugin-host.mjs";
import {
  appendLiveRoomMessage,
  loadLiveRoomMessages,
} from "./oddchat-room-service.mjs";

export function loadAgentConsoleState(workspaceRoot) {
  const gterm = loadGTermPoolState(workspaceRoot);
  const liveMessages = loadLiveRoomMessages(workspaceRoot);
  const gboardRecords = loadGBoardRecords(workspaceRoot);
  const gboardTopics = loadGBoardTopics(workspaceRoot);
  const recordById = new Map(gboardRecords.map((record) => [record.id, record]));
  const sessionById = new Map(gterm.sessions.map((session) => [session.id, session]));
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
    attachedRecords: topic.attachedRecordIds
      .map((recordId) => recordById.get(recordId))
      .filter(Boolean),
    attachedSessions: topic.attachedSessionIds
      .map((sessionId) => sessionById.get(sessionId))
      .filter(Boolean),
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
    oddterm: gterm,
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
  const topic = createOrResumeGBoardTopic(workspaceRoot, options);
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

export function createTerminalPromotionComment(
  workspaceRoot,
  options = {},
) {
  return createGTermPromotionComment(workspaceRoot, options);
}
