import type { WorkspaceProfile } from "./types";
import type { ProjectRecord, ProjectRegistryResponse } from "../contracts/project";

export type TrainId = string;

export type WorkspaceReference = {
  name: string;
  path: string;
};

export type WorkspaceScanResult = {
  name: string;
  path: string;
  updatedAt: string | null;
  markers: string[];
  profile: WorkspaceProfile | null;
};

export type FsEntry = {
  name: string;
  absolutePath: string;
  kind?: "directory" | "file";
  hasWorkspace: boolean;
  markers: string[];
  profile: WorkspaceProfile | null;
};

export type FsBrowseResult = {
  path: string;
  parent: string | null;
  entries: FsEntry[];
  truncated: boolean;
};

export type GBoardRecordSource = "comments" | "specification" | "requirements" | "design";
export type GBoardRecordFormat = "markdown" | "yaml" | "text";

export type GBoardRecord = {
  id: string;
  roomId: string | null;
  senderId: string | null;
  senderLabel: string | null;
  timestamp: string | null;
  title: string;
  content: string;
  path: string | null;
  source: GBoardRecordSource;
  sourceLabel: string;
  format: GBoardRecordFormat;
  selectedTrainId: TrainId | null;
  stationId: string | null;
  edgeId: string | null;
};

export type GBoardTopic = {
  id: string;
  roomId: string;
  label: string;
  originKind: "ad_hoc" | "record" | "selection";
  assetKind: "oddboard_record" | "gboard_record" | "station" | "edge" | "workspace" | null;
  assetId: string | null;
  assetLabel: string | null;
  assetPath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  selectedTrainId: TrainId | null;
  stationId: string | null;
  edgeId: string | null;
  attachedRecordIds: string[];
  attachedSessionIds: string[];
  roomRecipientSessionIds: string[];
};

export type RoomParticipant = {
  id: string;
  provider: string;
  participantLabel: string;
  sessionId: string;
  sessionLabel: string;
  sessionStatus?: "live" | "closed" | "error" | null;
  roomId: string;
  topicId: string | null;
  topicLabel: string | null;
  transport: "mcp";
  status: "connected" | "disconnected" | "stale";
  createdAt: string | null;
  joinedAt: string | null;
  updatedAt: string | null;
  leftAt: string | null;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  lastPostedAt: string | null;
};

export type GTermSessionSummary = {
  id: string;
  workspaceRoot: string;
  label: string;
  archived?: boolean;
  status: "live" | "closed" | "error";
  conversationHistoryId: string;
  shell: string | null;
  pid: number | null;
  backend: string | null;
  createdAt: string | null;
  lastOutputAt: string | null;
  attachedTrainId: TrainId | null;
  attachedStationId: string | null;
  attachedEdgeId: string | null;
  historyBytes: number;
  liveClientCount: number;
  participants?: RoomParticipant[];
};

export type GTermPoolState = {
  workspaceRoot: string;
  activeSessionId: string | null;
  sessions: GTermSessionSummary[];
};

export type GChatMessage = {
  id: string;
  roomId: string;
  conversationHistoryId?: string | null;
  senderId: string;
  senderLabel: string;
  timestamp: string | null;
  title: string;
  content: string;
  path: string | null;
  source: "comment" | "live" | "session" | "irc" | "agent";
  messageKind: "chat" | "report" | "system" | "promotion";
  relatedSessionId: string | null;
  recipientSessionIds: string[] | null;
  selectedTrainId: TrainId | null;
  stationId: string | null;
  edgeId: string | null;
};

export type GChatTopic = {
  id: string;
  roomId: string;
  conversationHistoryId?: string | null;
  label: string;
  originKind: GBoardTopic["originKind"];
  assetKind: GBoardTopic["assetKind"];
  assetId: string | null;
  assetLabel: string | null;
  assetPath: string | null;
  selectedTrainId: TrainId | null;
  stationId: string | null;
  edgeId: string | null;
  updatedAt: string | null;
  roomRecipientSessionIds: string[];
  attachedRecords: GBoardRecord[];
  attachedSessions: GTermSessionSummary[];
  participants: RoomParticipant[];
};

export type AgentConsoleState = {
  workspaceRoot: string;
  oddboard: {
    topics: GBoardTopic[];
    records: GBoardRecord[];
  };
  oddchat: {
    topics: GChatTopic[];
    messages: GChatMessage[];
  };
  oddterm: GTermPoolState;
};

async function expectJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function browsePath(path?: string): Promise<FsBrowseResult> {
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  params.set("refresh", String(Date.now()));
  const query = `?${params.toString()}`;
  return expectJson<FsBrowseResult>(await fetch(`/api/fs/browse${query}`, { cache: "no-store" }));
}

export async function scanForOddWorkspaces(root: string): Promise<WorkspaceScanResult[]> {
  const query = new URLSearchParams({
    root,
    kind: "odd",
  });
  return expectJson<WorkspaceScanResult[]>(await fetch(`/api/workspace-scan?${query.toString()}`));
}

export async function loadProjectRegistry(): Promise<ProjectRegistryResponse> {
  return expectJson<ProjectRegistryResponse>(await fetch("/api/projects/registry"));
}

export const PROJECT_REGISTRY_CHANGED_EVENT = "odd-manager:project-registry-changed";

type ProjectRegistryChangedAction = "registered" | "unregistered" | "active";

function emitProjectRegistryChanged(
  action: ProjectRegistryChangedAction,
  detail: { project?: ProjectRecord; projects?: ProjectRecord[] } = {},
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECT_REGISTRY_CHANGED_EVENT, {
    detail: { action, ...detail },
  }));
}

export async function registerProject(
  root: string,
  options: { setActive?: boolean; label?: string | null } = {},
): Promise<{ ok: boolean; project: ProjectRecord; projects: ProjectRecord[]; diagnostic: ProjectRegistryResponse["diagnostic"] }> {
  const result = await expectJson<{ ok: boolean; project: ProjectRecord; projects: ProjectRecord[]; diagnostic: ProjectRegistryResponse["diagnostic"] }>(
    await fetch("/api/projects/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, setActive: Boolean(options.setActive), label: options.label ?? undefined }),
    }),
  );
  emitProjectRegistryChanged("registered", { project: result.project, projects: result.projects });
  return result;
}

export async function unregisterProject(
  id: string,
): Promise<{ ok: boolean; removed: ProjectRecord; projects: ProjectRecord[]; diagnostic: ProjectRegistryResponse["diagnostic"] }> {
  const result = await expectJson<{ ok: boolean; removed: ProjectRecord; projects: ProjectRecord[]; diagnostic: ProjectRegistryResponse["diagnostic"] }>(
    await fetch("/api/projects/unregister", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  );
  emitProjectRegistryChanged("unregistered", { projects: result.projects });
  return result;
}

export async function setActiveProject(
  idOrRoot: string,
  options: { registerIfMissing?: boolean } = {},
): Promise<{ ok: boolean; project: ProjectRecord; projects: ProjectRecord[]; diagnostic: ProjectRegistryResponse["diagnostic"] }> {
  const result = await expectJson<{ ok: boolean; project: ProjectRecord; projects: ProjectRecord[]; diagnostic: ProjectRegistryResponse["diagnostic"] }>(
    await fetch("/api/projects/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(idOrRoot.startsWith("/") ? { root: idOrRoot } : { id: idOrRoot }),
        ...(options.registerIfMissing === undefined ? {} : { registerIfMissing: options.registerIfMissing }),
      }),
    }),
  );
  emitProjectRegistryChanged("active", { project: result.project, projects: result.projects });
  return result;
}

export async function loadAgentConsoleState(workspaceRoot: string): Promise<AgentConsoleState> {
  const query = new URLSearchParams({ workspaceRoot });
  return expectJson<AgentConsoleState>(await fetch(`/api/odd-console?${query.toString()}`));
}

export function subscribeAgentConsoleEvents(
  workspaceRoot: string,
  handlers: {
    onUpdate: () => void;
    onError?: (error: Event | string) => void;
  },
) {
  const query = new URLSearchParams({ workspaceRoot });
  const source = new EventSource(`/api/odd-console/stream?${query.toString()}`);

  const updateHandler = () => {
    handlers.onUpdate();
  };

  source.addEventListener("odd-console-updated", updateHandler);
  source.addEventListener("connected", () => {
    // Connection confirmation only.
  });
  source.onerror = (event) => {
    handlers.onError?.(event);
  };

  return () => {
    source.removeEventListener("odd-console-updated", updateHandler);
    source.close();
  };
}

export async function postGChatMessage(
  workspaceRoot: string,
  options: {
    roomId: string;
    body: string;
    selectedTrainId?: TrainId | null;
    stationId?: string | null;
    edgeId?: string | null;
  },
): Promise<{ ok: boolean; id: string; roomId: string; title: string; targetSessionId?: string | null; privateChannel?: boolean }> {
  return expectJson(
    await fetch("/api/odd-console/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        roomId: options.roomId,
        body: options.body,
        selectedTrainId: options.selectedTrainId ?? null,
        stationId: options.stationId ?? null,
        edgeId: options.edgeId ?? null,
      }),
    }),
  );
}

export async function createGBoardTopic(
  workspaceRoot: string,
  options: {
    title?: string | null;
    sourceRecordId?: string | null;
    selectedTrainId?: TrainId | null;
    stationId?: string | null;
    edgeId?: string | null;
  } = {},
): Promise<{ ok: boolean; topic: GBoardTopic }> {
  return expectJson(
    await fetch("/api/oddchat/topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        title: options.title ?? null,
        sourceRecordId: options.sourceRecordId ?? null,
        selectedTrainId: options.selectedTrainId ?? null,
        stationId: options.stationId ?? null,
        edgeId: options.edgeId ?? null,
      }),
    }),
  );
}

export async function attachGChatTopicRecord(
  workspaceRoot: string,
  options: {
    topicId: string;
    recordId: string;
  },
): Promise<{ ok: boolean; topic: GBoardTopic }> {
  return expectJson(
    await fetch("/api/oddchat/topic/attach-record", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        topicId: options.topicId,
        recordId: options.recordId,
      }),
    }),
  );
}

export async function attachGChatTopicSession(
  workspaceRoot: string,
  options: {
    topicId: string;
    sessionId: string;
  },
): Promise<{ ok: boolean; topic: GBoardTopic }> {
  return expectJson(
    await fetch("/api/oddchat/topic/attach-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        topicId: options.topicId,
        sessionId: options.sessionId,
      }),
    }),
  );
}

export async function createGTermSession(
  workspaceRoot: string,
  options: {
    selectedTrainId?: TrainId | null;
    stationId?: string | null;
    edgeId?: string | null;
    label?: string | null;
  } = {},
): Promise<{ ok: boolean; session: GTermSessionSummary }> {
  return expectJson(
    await fetch("/api/oddterm/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        selectedTrainId: options.selectedTrainId ?? null,
        stationId: options.stationId ?? null,
        edgeId: options.edgeId ?? null,
        label: options.label ?? null,
      }),
    }),
  );
}

export async function promoteGTermSession(
  workspaceRoot: string,
  options: {
    sessionId: string;
    lineCount?: number;
    selectedTrainId?: TrainId | null;
    stationId?: string | null;
    edgeId?: string | null;
  },
): Promise<{ ok: boolean; path: string; title: string }> {
  return expectJson(
    await fetch("/api/oddterm/promote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        sessionId: options.sessionId,
        lineCount: options.lineCount ?? 120,
        selectedTrainId: options.selectedTrainId ?? null,
        stationId: options.stationId ?? null,
        edgeId: options.edgeId ?? null,
      }),
    }),
  );
}

export async function renameGTermSession(
  workspaceRoot: string,
  sessionId: string,
  label: string,
): Promise<{ ok: boolean; session: GTermSessionSummary }> {
  return expectJson(
    await fetch("/api/oddterm/session/rename", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        sessionId,
        label,
      }),
    }),
  );
}

export async function closeGTermSession(
  workspaceRoot: string,
  sessionId: string,
): Promise<{ ok: boolean; session: GTermSessionSummary }> {
  return expectJson(
    await fetch("/api/oddterm/session/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        sessionId,
      }),
    }),
  );
}

export async function closeAllGTermSessions(
  workspaceRoot: string,
): Promise<{ ok: boolean; workspaceRoot: string; closedSessions: GTermSessionSummary[] }> {
  return expectJson(
    await fetch("/api/oddterm/session/close-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
      }),
    }),
  );
}

export async function selectGTermSession(
  workspaceRoot: string,
  sessionId: string,
): Promise<{ ok: boolean; activeSessionId: string | null }> {
  return expectJson(
    await fetch("/api/oddterm/session/select", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        sessionId,
      }),
    }),
  );
}

export async function launchTopicAgent(
  workspaceRoot: string,
  options: {
    topicId: string;
    sessionId: string;
    provider: "codex" | "claude";
  },
): Promise<{
  ok: boolean;
  provider: string;
  sessionId: string;
  sessionLabel: string;
  topicId: string;
  topicLabel: string;
  roomId: string;
  command: string;
}> {
  return expectJson(
    await fetch("/api/oddchat/topic/bootstrap-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        topicId: options.topicId,
        sessionId: options.sessionId,
        provider: options.provider,
      }),
    }),
  );
}

export async function addTopicParticipant(
  workspaceRoot: string,
  options: {
    topicId: string;
    role: "worker" | "reviewer";
    provider: "codex" | "claude" | "gemini";
    label?: string | null;
  },
): Promise<{
  ok: boolean;
  role: string;
  provider: string;
  topicId: string;
  topicLabel: string;
  roomId: string;
  session: GTermSessionSummary;
  bootstrap: {
    ok: boolean;
    provider: string;
    sessionId: string;
    sessionLabel: string;
    topicId: string;
    topicLabel: string;
    roomId: string;
  };
}> {
  return expectJson(
    await fetch("/api/oddchat/topic/add-participant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        topicId: options.topicId,
        role: options.role,
        provider: options.provider,
        label: options.label ?? null,
      }),
    }),
  );
}

export async function setTopicRoomRecipients(
  workspaceRoot: string,
  options: {
    topicId: string;
    sessionIds: string[];
  },
): Promise<{ ok: boolean; topic: GBoardTopic }> {
  return expectJson(
    await fetch("/api/oddchat/topic/room-recipients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        topicId: options.topicId,
        sessionIds: options.sessionIds,
      }),
    }),
  );
}

export async function launchShellAgent(
  workspaceRoot: string,
  options: {
    sessionId: string;
    provider: "codex" | "claude";
  },
): Promise<{
  ok: boolean;
  provider: string;
  sessionId: string;
  sessionLabel: string;
}> {
  return expectJson(
    await fetch("/api/oddterm/session/launch-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        sessionId: options.sessionId,
        provider: options.provider,
      }),
    }),
  );
}

export async function joinShellAgentTopic(
  workspaceRoot: string,
  options: {
    sessionId: string;
    topicId: string;
    provider: "codex" | "claude";
  },
): Promise<{
  ok: boolean;
  provider: string;
  sessionId: string;
  sessionLabel: string;
  topicId: string;
  topicLabel: string;
  roomId: string;
  mode?: "prompt-injection" | "managed-worker";
}> {
  return expectJson(
    await fetch("/api/oddterm/session/join-topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        sessionId: options.sessionId,
        topicId: options.topicId,
        provider: options.provider,
      }),
    }),
  );
}
