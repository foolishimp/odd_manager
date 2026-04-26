import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { extname, join, relative, resolve } from "node:path";
import { emitAgentConsoleEvent } from "./odd-console-events.mjs";
import {
  appendLiveRoomMessage,
  firstMeaningfulLine,
  sessionParticipantId,
  slugify,
  topicRoomId,
} from "./oddchat-room-service.mjs";
import { loadGTermPoolState, readGTermSessionTail } from "./oddterm-pool-service.mjs";

function timestampStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

function commentsRoot(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/comments");
}

function gboardTopicsRoot(projectRoot) {
  return resolve(projectRoot, ".ai-workspace/runtime/oddboard/topics");
}

function gboardTopicPath(projectRoot, topicId) {
  return join(gboardTopicsRoot(projectRoot), `${topicId}.json`);
}

function commentParticipantLabel(participantId) {
  return participantId === "operator"
    ? "Operator"
    : participantId.charAt(0).toUpperCase() + participantId.slice(1);
}

function normalizeTopic(topic) {
  const attachedSessionIds = Array.isArray(topic?.attachedSessionIds)
    ? Array.from(new Set(topic.attachedSessionIds.map((value) => String(value))))
    : [];
  return {
    ...topic,
    attachedRecordIds: Array.isArray(topic?.attachedRecordIds)
      ? topic.attachedRecordIds.map((value) => String(value))
      : [],
    attachedSessionIds,
    roomRecipientSessionIds: Array.isArray(topic?.roomRecipientSessionIds)
      ? Array.from(
          new Set(
            topic.roomRecipientSessionIds
              .map((value) => String(value))
              .filter((value) => attachedSessionIds.includes(value)),
          ),
        )
      : attachedSessionIds,
  };
}

function cleanedFileTitle(fileName) {
  return (
    fileName
      .replace(/^[0-9T_]+/, "")
      .replace(/\.(md|ya?ml|txt)$/i, "")
      .replace(/[-_]+/g, " ")
      .trim()
  );
}

function markdownHeading(content) {
  const heading = String(content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^#{1,6}\s+/.test(line));
  return heading ? heading.replace(/^#{1,6}\s+/, "").trim() : null;
}

function recordTitle(fileName, content) {
  return (
    markdownHeading(content) ||
    cleanedFileTitle(fileName) ||
    firstMeaningfulLine(content).replace(/^#{1,6}\s+/, "").trim()
  );
}

function recordFormat(absolutePath) {
  const extension = extname(absolutePath).toLowerCase();
  if (extension === ".yml" || extension === ".yaml") {
    return "yaml";
  }
  if (extension === ".md") {
    return "markdown";
  }
  return "text";
}

function walkFiles(
  root,
  {
    extensions = [".md"],
    ignoredDirectoryNames = [],
  } = {},
) {
  if (!existsSync(root)) {
    return [];
  }

  const ignored = new Set(ignoredDirectoryNames);
  const allowedExtensions = new Set(extensions.map((value) => value.toLowerCase()));
  const files = [];
  const stack = [root];

  while (stack.length) {
    const currentRoot = stack.pop();
    if (!currentRoot) {
      continue;
    }

    const entries = readdirSync(currentRoot, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const absolutePath = join(currentRoot, entry.name);
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          stack.push(absolutePath);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (allowedExtensions.has(extname(entry.name).toLowerCase())) {
        files.push(absolutePath);
      }
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function pushDocumentRecords(projectRoot, records, absolutePaths, { source, sourceLabel }) {
  for (const absolutePath of absolutePaths) {
    const content = readFileSync(absolutePath, "utf8");
    const relativePath = relative(projectRoot, absolutePath);
    records.push({
      id: `${source}:${relativePath}`,
      roomId: null,
      senderId: null,
      senderLabel: sourceLabel,
      timestamp: statSync(absolutePath).mtime.toISOString(),
      title: recordTitle(absolutePath.split("/").at(-1) ?? absolutePath, content),
      content,
      path: relativePath,
      source,
      sourceLabel,
      format: recordFormat(absolutePath),
      selectedTrainId: null,
      stationId: null,
      edgeId: null,
    });
  }
}

function loadCommentRecords(projectRoot) {
  const root = commentsRoot(projectRoot);
  if (!existsSync(root)) {
    return [];
  }

  const participants = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const records = [];

  for (const participantId of participants) {
    const participantRoot = join(root, participantId);
    const files = readdirSync(participantRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const file of files) {
      const absolutePath = join(participantRoot, file.name);
      const content = readFileSync(absolutePath, "utf8");
      records.push({
        id: `${participantId}:${file.name}`,
        roomId: participantId,
        senderId: participantId,
        senderLabel: commentParticipantLabel(participantId),
        timestamp: statSync(absolutePath).mtime.toISOString(),
        title: recordTitle(file.name, content),
        content,
        path: relative(projectRoot, absolutePath),
        source: "comments",
        sourceLabel: "Comments",
        format: "markdown",
        selectedTrainId: null,
        stationId: null,
        edgeId: null,
      });
    }
  }

  return records;
}

function designRoots(projectRoot) {
  const root = resolve(projectRoot, "build_tenants");
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => join(root, entry.name, "design"))
    .filter((absolutePath) => existsSync(absolutePath));
}

function sourcePriority(source) {
  if (source === "comments") {
    return 0;
  }
  if (source === "requirements") {
    return 1;
  }
  if (source === "specification") {
    return 2;
  }
  return 3;
}

export function loadGBoardRecords(projectRoot) {
  const records = [...loadCommentRecords(projectRoot)];

  pushDocumentRecords(
    projectRoot,
    records,
    walkFiles(resolve(projectRoot, "specification"), {
      extensions: [".md"],
      ignoredDirectoryNames: ["requirements"],
    }),
    { source: "specification", sourceLabel: "Specification" },
  );

  pushDocumentRecords(
    projectRoot,
    records,
    walkFiles(resolve(projectRoot, "specification/requirements"), {
      extensions: [".md"],
    }),
    { source: "requirements", sourceLabel: "Requirements" },
  );

  for (const root of designRoots(projectRoot)) {
    pushDocumentRecords(
      projectRoot,
      records,
      walkFiles(root, {
        extensions: [".md", ".yml", ".yaml"],
      }),
      { source: "design", sourceLabel: "Design" },
    );
  }

  records.sort((left, right) => {
    const timestampDiff = String(right.timestamp ?? "").localeCompare(String(left.timestamp ?? ""));
    if (timestampDiff !== 0) {
      return timestampDiff;
    }

    const sourceDiff = sourcePriority(left.source) - sourcePriority(right.source);
    if (sourceDiff !== 0) {
      return sourceDiff;
    }

    return left.title.localeCompare(right.title);
  });

  return records;
}

export function loadGBoardTopics(projectRoot) {
  const root = gboardTopicsRoot(projectRoot);
  if (!existsSync(root)) {
    return [];
  }

  const files = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));

  const topics = [];
  for (const file of files) {
    try {
      const absolutePath = join(root, file.name);
      const parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
      topics.push(normalizeTopic(parsed));
    } catch {
      // Ignore malformed topic entries.
    }
  }

  topics.sort((left, right) => String(right.updatedAt ?? right.createdAt).localeCompare(String(left.updatedAt ?? left.createdAt)));
  return topics;
}

export function loadGBoardTopicByRoomId(projectRoot, roomId) {
  if (!roomId) {
    return null;
  }
  return loadGBoardTopics(projectRoot).find((topic) => topic.roomId === roomId) ?? null;
}

function writeTopic(projectRoot, topic) {
  mkdirSync(gboardTopicsRoot(projectRoot), { recursive: true });
  writeFileSync(
    gboardTopicPath(projectRoot, topic.id),
    `${JSON.stringify(normalizeTopic(topic), null, 2)}\n`,
    "utf8",
  );
}

function topicById(projectRoot, topicId) {
  return loadGBoardTopics(projectRoot).find((topic) => topic.id === topicId) ?? null;
}

export function loadGBoardTopicById(projectRoot, topicId) {
  if (!topicId) {
    return null;
  }
  return topicById(projectRoot, topicId);
}

function recordExcerpt(content) {
  return String(content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n");
}

function topicContextFromSelection({ title, selectedTrainId = null, stationId = null, edgeId = null } = {}) {
  if (edgeId) {
    return {
      label: title ?? `Topic over ${edgeId}`,
      originKind: "selection",
      assetKind: "edge",
      assetId: edgeId,
      assetLabel: edgeId,
      assetPath: null,
      selectedTrainId,
      stationId,
      edgeId,
    };
  }

  if (stationId) {
    return {
      label: title ?? `Topic over ${stationId}`,
      originKind: "selection",
      assetKind: "station",
      assetId: stationId,
      assetLabel: stationId,
      assetPath: null,
      selectedTrainId,
      stationId,
      edgeId,
    };
  }

  return {
    label: title ?? "Ad Hoc Workspace Topic",
    originKind: "ad_hoc",
    assetKind: "workspace",
    assetId: null,
    assetLabel: null,
    assetPath: null,
    selectedTrainId,
    stationId,
    edgeId,
  };
}

function topicContextFromRecord(projectRoot, sourceRecord) {
  return {
    label: sourceRecord.title,
    originKind: "record",
    assetKind: "oddboard_record",
    assetId: sourceRecord.id,
    assetLabel: sourceRecord.title,
    assetPath: sourceRecord.path,
    selectedTrainId: sourceRecord.selectedTrainId ?? null,
    stationId: sourceRecord.stationId ?? null,
    edgeId: sourceRecord.edgeId ?? null,
  };
}

function matchingTopic(topics, context) {
  return (
    topics.find((topic) => {
      if (context.assetKind === "oddboard_record") {
        return (
          (topic.assetKind === context.assetKind || topic.assetKind === "gboard_record") &&
          topic.assetId === context.assetId
        );
      }
      if (context.assetKind === "edge" || context.assetKind === "station") {
        return topic.assetKind === context.assetKind && topic.assetId === context.assetId;
      }
      return false;
    }) ?? null
  );
}

export function createGBoardTopic(
  projectRoot,
  {
    title = null,
    sourceRecordId = null,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const records = loadGBoardRecords(projectRoot);
  const sourceRecord = sourceRecordId ? records.find((record) => record.id === sourceRecordId) ?? null : null;
  const context = sourceRecord
    ? topicContextFromRecord(projectRoot, sourceRecord)
    : topicContextFromSelection({ title, selectedTrainId, stationId, edgeId });

  const now = new Date().toISOString();

  const id = `topic_${timestampStamp()}_${randomUUID().slice(0, 8)}`;
  const topic = {
    id,
    roomId: topicRoomId(id),
    label: context.label,
    originKind: context.originKind,
    assetKind: context.assetKind,
    assetId: context.assetId,
    assetLabel: context.assetLabel,
    assetPath: context.assetPath,
    createdAt: now,
    updatedAt: now,
    selectedTrainId: context.selectedTrainId ?? selectedTrainId,
    stationId: context.stationId ?? stationId,
    edgeId: context.edgeId ?? edgeId,
    attachedRecordIds: sourceRecord ? [sourceRecord.id] : [],
    attachedSessionIds: [],
    roomRecipientSessionIds: [],
  };

  writeTopic(projectRoot, topic);

  const body = sourceRecord
    ? [
        `Opened a live topic over durable record: ${sourceRecord.title}`,
        sourceRecord.path ? `Record: ${sourceRecord.path}` : null,
        "",
        recordExcerpt(sourceRecord.content),
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `Opened a live topic over ${topic.assetLabel ?? "workspace context"}.`,
        selectedTrainId ? `View: ${selectedTrainId}` : null,
        stationId ? `Station: ${stationId}` : null,
        edgeId ? `Edge: ${edgeId}` : null,
      ]
        .filter(Boolean)
        .join("\n");

  appendLiveRoomMessage(projectRoot, {
    roomId: topic.roomId,
    senderId: "system",
    senderLabel: "OddBoard",
    title: `Opened topic: ${topic.label}`,
    body,
    kind: "system",
    source: "live",
    selectedTrainId: topic.selectedTrainId,
    stationId: topic.stationId,
    edgeId: topic.edgeId,
  });

  emitAgentConsoleEvent(projectRoot, {
    kind: "topic-created",
    topicId: topic.id,
    roomId: topic.roomId,
  });

  return topic;
}

export const createOrResumeGBoardTopic = createGBoardTopic;

export function attachRecordToGBoardTopic(
  projectRoot,
  {
    topicId,
    recordId,
  } = {},
) {
  if (!topicId) {
    throw new Error("topic id is required");
  }
  if (!recordId) {
    throw new Error("record id is required");
  }

  const topic = topicById(projectRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const record = loadGBoardRecords(projectRoot).find((entry) => entry.id === recordId) ?? null;
  if (!record) {
    throw new Error("record not found");
  }

  if (topic.attachedRecordIds.includes(recordId)) {
    return topic;
  }

  const updated = {
    ...topic,
    updatedAt: new Date().toISOString(),
    attachedRecordIds: [...topic.attachedRecordIds, recordId],
  };
  writeTopic(projectRoot, updated);
  appendLiveRoomMessage(projectRoot, {
    roomId: updated.roomId,
    senderId: "system",
    senderLabel: "OddChat",
    title: `Attached asset: ${record.title}`,
    body: record.path ? `Added asset ${record.path} to the topic.` : `Added asset ${record.title} to the topic.`,
    kind: "system",
    source: "live",
    selectedTrainId: updated.selectedTrainId,
    stationId: updated.stationId,
    edgeId: updated.edgeId,
  });
  emitAgentConsoleEvent(projectRoot, {
    kind: "topic-asset-attached",
    topicId: updated.id,
    recordId,
  });
  return updated;
}

export function attachSessionToGBoardTopic(
  projectRoot,
  {
    topicId,
    sessionId,
    announcementTitle = null,
    announcementBody = null,
    announcementSenderId = null,
    announcementSenderLabel = null,
  } = {},
) {
  if (!topicId) {
    throw new Error("topic id is required");
  }
  if (!sessionId) {
    throw new Error("terminal session id is required");
  }

  const topic = topicById(projectRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const session = loadGTermPoolState(projectRoot).sessions.find((entry) => entry.id === sessionId) ?? null;
  if (!session) {
    throw new Error("terminal session not found");
  }

  if (topic.attachedSessionIds.includes(sessionId)) {
    return topic;
  }

  const updated = {
    ...topic,
    updatedAt: new Date().toISOString(),
    attachedSessionIds: [...topic.attachedSessionIds, sessionId],
    roomRecipientSessionIds: Array.from(
      new Set([...(topic.roomRecipientSessionIds ?? []), sessionId]),
    ),
  };
  writeTopic(projectRoot, updated);
  const title = announcementTitle ?? `${session.label} joined the topic`;
  const body =
    announcementBody ?? `Attached oddterm ${session.label} to this topic.`;
  appendLiveRoomMessage(projectRoot, {
    roomId: updated.roomId,
    senderId: announcementSenderId ?? sessionParticipantId(session.id),
    senderLabel: announcementSenderLabel ?? session.label,
    title,
    body,
    kind: "system",
    source: "session",
    relatedSessionId: session.id,
    selectedTrainId: updated.selectedTrainId,
    stationId: updated.stationId,
    edgeId: updated.edgeId,
  });
  emitAgentConsoleEvent(projectRoot, {
    kind: "topic-session-attached",
    topicId: updated.id,
    sessionId,
  });
  return updated;
}

export function setGBoardTopicRoomRecipients(
  projectRoot,
  {
    topicId,
    sessionIds = [],
  } = {},
) {
  if (!topicId) {
    throw new Error("topic id is required");
  }

  const topic = topicById(projectRoot, topicId);
  if (!topic) {
    throw new Error("topic not found");
  }

  const normalizedSessionIds = Array.from(
    new Set(
      (Array.isArray(sessionIds) ? sessionIds : [])
        .map((value) => String(value ?? "").trim())
        .filter((value) => topic.attachedSessionIds.includes(value)),
    ),
  );

  const currentRoomRecipients = topic.roomRecipientSessionIds ?? [];
  const unchanged =
    currentRoomRecipients.length === normalizedSessionIds.length &&
    currentRoomRecipients.every((value, index) => value === normalizedSessionIds[index]);
  if (unchanged) {
    return topic;
  }

  const updated = {
    ...topic,
    updatedAt: new Date().toISOString(),
    roomRecipientSessionIds: normalizedSessionIds,
  };
  writeTopic(projectRoot, updated);

  const sessionById = new Map(
    loadGTermPoolState(projectRoot).sessions.map((session) => [session.id, session]),
  );
  const enabledLabels = normalizedSessionIds.map(
    (sessionId) => sessionById.get(sessionId)?.label ?? sessionId,
  );
  const mutedLabels = topic.attachedSessionIds
    .filter((sessionId) => !normalizedSessionIds.includes(sessionId))
    .map((sessionId) => sessionById.get(sessionId)?.label ?? sessionId);

  const body =
    topic.attachedSessionIds.length === 0
      ? "No linked participants are attached to this topic yet."
      : normalizedSessionIds.length === 0
        ? "Room delivery is muted for every linked participant. Re-enable recipients or use an @mention to target a specific participant."
        : normalizedSessionIds.length === topic.attachedSessionIds.length
          ? "Everyone attached to this topic now receives room messages by default."
          : [
              enabledLabels.length ? `Enabled: ${enabledLabels.join(", ")}` : null,
              mutedLabels.length ? `Muted: ${mutedLabels.join(", ")}` : null,
              "Use @worker1 or @reviewer1 to override room delivery for a single message.",
            ]
              .filter(Boolean)
              .join("\n");

  appendLiveRoomMessage(projectRoot, {
    roomId: updated.roomId,
    senderId: "system",
    senderLabel: "OddChat",
    title: "Updated room delivery",
    body,
    kind: "system",
    source: "live",
    selectedTrainId: updated.selectedTrainId,
    stationId: updated.stationId,
    edgeId: updated.edgeId,
  });

  emitAgentConsoleEvent(projectRoot, {
    kind: "topic-room-recipients-updated",
    topicId: updated.id,
  });

  return updated;
}

export function createGBoardComment(
  projectRoot,
  {
    roomId = "workspace",
    body,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  const trimmed = String(body ?? "").trim();
  if (!trimmed) {
    throw new Error("comment body is required");
  }

  const authorId = "operator";
  const authorRoot = join(commentsRoot(projectRoot), authorId);
  mkdirSync(authorRoot, { recursive: true });

  const title = firstMeaningfulLine(trimmed);
  const stamp = timestampStamp();
  const fileName = `${stamp}_CHAT_${slugify(title)}.md`;
  const absolutePath = join(authorRoot, fileName);

  const headerLines = [
    `# ${title}`,
    "",
    `- room: ${roomId}`,
    selectedTrainId ? `- view: ${selectedTrainId}` : null,
    stationId ? `- station: ${stationId}` : null,
    edgeId ? `- edge: ${edgeId}` : null,
    "",
    trimmed,
    "",
  ].filter(Boolean);

  writeFileSync(absolutePath, `${headerLines.join("\n")}\n`, "utf8");

  emitAgentConsoleEvent(projectRoot, {
    kind: "comment-created",
    roomId,
    path: relative(projectRoot, absolutePath),
  });

  return {
    ok: true,
    path: relative(projectRoot, absolutePath),
    title,
  };
}

export function createGTermPromotionComment(
  projectRoot,
  {
    sessionId,
    lineCount = 120,
    selectedTrainId = null,
    stationId = null,
    edgeId = null,
  } = {},
) {
  if (!sessionId) {
    throw new Error("terminal session id is required");
  }

  const promoted = readGTermSessionTail(projectRoot, sessionId, lineCount);
  const body = String(promoted.text ?? "").trim();
  if (!body) {
    throw new Error("terminal session has no retained output to promote");
  }

  const sessionLabel = promoted.session?.label ?? sessionId;
  const title = `OddTerm ${sessionLabel} tail`;
  const authorId = "operator";
  const authorRoot = join(commentsRoot(projectRoot), authorId);
  mkdirSync(authorRoot, { recursive: true });

  const stamp = timestampStamp();
  const fileName = `${stamp}_ODDTERM_${slugify(sessionLabel)}.md`;
  const absolutePath = join(authorRoot, fileName);

  const headerLines = [
    `# ${title}`,
    "",
    `- source: oddterm`,
    `- terminal-session: ${sessionId}`,
    promoted.session?.shell ? `- shell: ${promoted.session.shell}` : null,
    selectedTrainId ? `- view: ${selectedTrainId}` : null,
    stationId ? `- station: ${stationId}` : null,
    edgeId ? `- edge: ${edgeId}` : null,
    `- retained-chunks: ${promoted.chunks.length}`,
    "",
    "```text",
    body,
    "```",
    "",
  ].filter(Boolean);

  writeFileSync(absolutePath, `${headerLines.join("\n")}\n`, "utf8");

  emitAgentConsoleEvent(projectRoot, {
    kind: "comment-created",
    roomId: "workspace",
    path: relative(projectRoot, absolutePath),
  });

  appendLiveRoomMessage(projectRoot, {
    roomId: "workspace",
    senderId: sessionParticipantId(sessionId),
    senderLabel: sessionLabel,
    title: `${sessionLabel} promoted terminal output`,
    body: `Promoted the latest retained terminal tail into durable comments: ${relative(projectRoot, absolutePath)}`,
    kind: "promotion",
    source: "session",
    relatedSessionId: sessionId,
    selectedTrainId,
    stationId,
    edgeId,
  });

  return {
    ok: true,
    path: relative(projectRoot, absolutePath),
    title,
  };
}

export function loadGBoardState(projectRoot) {
  return {
    projectRoot,
    topics: loadGBoardTopics(projectRoot),
    records: loadGBoardRecords(projectRoot),
  };
}
