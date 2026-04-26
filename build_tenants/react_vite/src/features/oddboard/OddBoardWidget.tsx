import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  attachGChatTopicRecord,
  addTopicParticipant,
  createGBoardTopic,
  postGChatMessage,
  setTopicRoomRecipients,
} from "../../lib/collaboration";
import type {
  AgentConsoleState,
  GBoardRecord,
  GBoardRecordSource,
  GChatMessage,
  GChatTopic,
  TrainId,
} from "../../lib/collaboration";
import { MarkdownDocument } from "../../components/MarkdownDocument";
import { renderContentByFormat } from "../../lib/textPresentation";

type ConsoleSurface = "oddboard" | "oddchat";
type GBoardBrowserMode = "recent" | "browse";
type GBoardSourceFilter = "all" | GBoardRecordSource;
type GBoardMetadataFilter = "all" | "other" | string;
type RoomAction = "topic" | "attach-record" | "add-participant" | "room-recipients" | null;
type ExplorerSectionId = "topics" | "workers" | "assets";
type ParticipantRole = "worker" | "reviewer";
type ParticipantProvider = "codex" | "claude" | "gemini";

const AGENT_CONSOLE_COLLAPSED_STORAGE_KEY = "oman-oddboard-collapsed";
const ODDCHAT_LIVE_SCROLL_STORAGE_KEY = "oman-oddchat-live-scroll";
const GBOARD_RECENT_LIMIT = 28;

const GBOARD_SOURCE_OPTIONS: Array<{ id: GBoardSourceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "comments", label: "Comments" },
  { id: "specification", label: "Specification" },
  { id: "requirements", label: "Requirements" },
  { id: "design", label: "Design" },
];

const PARTICIPANT_ROLE_OPTIONS: Array<{ id: ParticipantRole; label: string }> = [
  { id: "worker", label: "Worker" },
  { id: "reviewer", label: "Reviewer" },
];

const PARTICIPANT_PROVIDER_OPTIONS: Array<{
  id: ParticipantProvider;
  label: string;
  enabled: boolean;
}> = [
  { id: "codex", label: "Codex", enabled: true },
  { id: "claude", label: "Claude", enabled: true },
  { id: "gemini", label: "Gemini", enabled: false },
];

type OddBoardWidgetProps = {
  workspaceRoot: string;
  selectedTrainId: TrainId;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
  consoleState: AgentConsoleState | null;
  loading: boolean;
  error: string | null;
  onRefreshConsole: (options?: { background?: boolean }) => Promise<void>;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "No timestamp";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function participantKey(record: GBoardRecord) {
  return record.senderId?.trim().toLowerCase() || "other";
}

function participantLabel(participantId: string) {
  if (participantId === "other") {
    return "Other";
  }
  return participantId.charAt(0).toUpperCase() + participantId.slice(1);
}

function searchHaystack(record: GBoardRecord) {
  return [
    record.title,
    record.path,
    record.source,
    record.sourceLabel,
    record.senderId,
    record.senderLabel,
    record.content,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function roomMessages(state: AgentConsoleState | null, roomId: string) {
  return (state?.oddchat.messages ?? []).filter((message) => message.roomId === roomId);
}

function renderableRecordContent(record: GBoardRecord) {
  return renderContentByFormat(record.content, record.format);
}

function compactTopicLabel(topic: GChatTopic) {
  return topic.assetLabel || topic.label;
}

function topicAssetKindLabel(assetKind: GChatTopic["assetKind"]) {
  if (assetKind === "oddboard_record" || assetKind === "gboard_record") {
    return "document";
  }
  return assetKind;
}

function sessionRoleFromLabel(label: string | null | undefined): ParticipantRole | null {
  const normalized = String(label ?? "").trim().toLowerCase();
  if (normalized.startsWith("worker")) {
    return "worker";
  }
  if (normalized.startsWith("reviewer")) {
    return "reviewer";
  }
  return null;
}

function nextSelectionId<T extends { id: string }>(items: T[], currentId: string | null) {
  return items.some((item) => item.id === currentId) ? currentId : items[0]?.id ?? null;
}

export function OddBoardWidget({
  workspaceRoot,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
  consoleState,
  loading,
  error,
  onRefreshConsole,
}: OddBoardWidgetProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = window.localStorage.getItem(AGENT_CONSOLE_COLLAPSED_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [surface, setSurface] = useState<ConsoleSurface>("oddchat");
  const [gboardMode, setGboardMode] = useState<GBoardBrowserMode>("recent");
  const [gboardSource, setGboardSource] = useState<GBoardSourceFilter>("all");
  const [gboardMetadataFilter, setGboardMetadataFilter] = useState<GBoardMetadataFilter>("all");
  const [gboardSearch, setGboardSearch] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [selectedAssetToAttachId, setSelectedAssetToAttachId] = useState<string | null>(null);
  const [liveRoomScroll, setLiveRoomScroll] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = window.localStorage.getItem(ODDCHAT_LIVE_SCROLL_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<ExplorerSectionId, boolean>>({
    topics: false,
    workers: false,
    assets: false,
  });
  const [participantRole, setParticipantRole] = useState<ParticipantRole>("worker");
  const [participantProvider, setParticipantProvider] = useState<ParticipantProvider>("codex");
  const [sending, setSending] = useState(false);
  const [roomAction, setRoomAction] = useState<RoomAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const roomMessagesRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const allRecords = consoleState?.oddboard.records ?? [];
  const allTopics = consoleState?.oddchat.topics ?? [];
  const selectedRoleLabel =
    PARTICIPANT_ROLE_OPTIONS.find((option) => option.id === participantRole)?.label ?? participantRole;
  const selectedProviderLabel =
    PARTICIPANT_PROVIDER_OPTIONS.find((option) => option.id === participantProvider)?.label ?? participantProvider;

  const sourceScopedRecords = useMemo(() => {
    if (gboardMode === "recent") {
      return allRecords.slice(0, GBOARD_RECENT_LIMIT);
    }
    if (gboardSource === "all") {
      return allRecords;
    }
    return allRecords.filter((record) => record.source === gboardSource);
  }, [allRecords, gboardMode, gboardSource]);

  const gboardMetadataOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of sourceScopedRecords) {
      const key = participantKey(record);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const preferred = ["claude", "codex", "operator"];
    const options: Array<{ id: GBoardMetadataFilter; label: string; count: number }> = [
      { id: "all", label: "All Metadata", count: sourceScopedRecords.length },
    ];

    for (const key of preferred) {
      const count = counts.get(key);
      if (count) {
        options.push({ id: key, label: participantLabel(key), count });
        counts.delete(key);
      }
    }

    const remaining = [...counts.entries()]
      .filter(([key]) => key !== "other")
      .sort((left, right) => left[0].localeCompare(right[0]));

    for (const [key, count] of remaining) {
      options.push({ id: key, label: participantLabel(key), count });
    }

    const otherCount = counts.get("other") ?? 0;
    if (otherCount) {
      options.push({ id: "other", label: "Other", count: otherCount });
    }

    return options;
  }, [sourceScopedRecords]);

  const visibleRecords = useMemo(() => {
    const normalizedSearch = gboardSearch.trim().toLowerCase();
    return sourceScopedRecords.filter((record) => {
      if (gboardMetadataFilter !== "all" && participantKey(record) !== gboardMetadataFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return searchHaystack(record).includes(normalizedSearch);
    });
  }, [gboardMetadataFilter, gboardSearch, sourceScopedRecords]);

  const activeRecord = visibleRecords.find((record) => record.id === selectedRecordId) ?? visibleRecords[0] ?? null;
  const activeTopic = allTopics.find((topic) => topic.id === selectedTopicId) ?? allTopics[0] ?? null;
  const activeRoomId = activeTopic?.roomId ?? null;
  const activeMessages = useMemo(
    () => (activeRoomId ? roomMessages(consoleState, activeRoomId) : []),
    [consoleState, activeRoomId],
  );
  const lastActiveMessageId = activeMessages[activeMessages.length - 1]?.id ?? null;
  const availableAssets = useMemo(() => {
    if (!activeTopic) {
      return [];
    }
    const attachedIds = new Set(activeTopic.attachedRecords.map((record) => record.id));
    return allRecords.filter((record) => !attachedIds.has(record.id));
  }, [activeTopic, allRecords]);
  const recordTopic =
    (activeRecord
      ? (consoleState?.oddboard.topics ?? []).find(
          (topic) =>
            (topic.assetKind === "oddboard_record" || topic.assetKind === "gboard_record") &&
            topic.assetId === activeRecord.id,
        )
      : null) ?? null;
  const activeRecordAlreadyAttached = activeTopic
    ? activeTopic.attachedRecords.some((record) => record.id === activeRecord?.id)
    : false;
  const activeTopicSessionSummaries = useMemo(() => {
    if (!activeTopic) {
      return [];
    }
    return activeTopic.attachedSessions.map((session) => {
      const participants = activeTopic.participants.filter((participant) => participant.sessionId === session.id);
      const connectedParticipants = participants.filter((participant) => participant.status === "connected");
      const role = sessionRoleFromLabel(session.label);
      const receivesRoom = activeTopic.roomRecipientSessionIds.includes(session.id);
      const providerSummary = connectedParticipants.length
        ? connectedParticipants.map((participant) => participant.provider).join(" / ")
        : "No agent joined yet";
      return {
        session,
        role,
        participants,
        connectedParticipants,
        receivesRoom,
        providerSummary,
      };
    });
  }, [activeTopic]);
  const enabledRoomRecipientCount = activeTopicSessionSummaries.filter(
    (summary) => summary.receivesRoom,
  ).length;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(AGENT_CONSOLE_COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(ODDCHAT_LIVE_SCROLL_STORAGE_KEY, String(liveRoomScroll));
  }, [liveRoomScroll]);

  useEffect(() => {
    setSelectedRecordId((current) => nextSelectionId(visibleRecords, current));
  }, [visibleRecords]);

  useEffect(() => {
    if (gboardMetadataFilter === "all") {
      return;
    }
    const optionStillVisible = gboardMetadataOptions.some((option) => option.id === gboardMetadataFilter);
    if (!optionStillVisible) {
      setGboardMetadataFilter("all");
    }
  }, [gboardMetadataFilter, gboardMetadataOptions]);

  useEffect(() => {
    setSelectedTopicId((current) => nextSelectionId(allTopics, current));
  }, [allTopics]);

  useEffect(() => {
    setSelectedAssetToAttachId((current) => {
      const currentRecordStillAvailable = availableAssets.some((record) => record.id === current);
      if (currentRecordStillAvailable) {
        return current;
      }
      if (activeRecord && availableAssets.some((record) => record.id === activeRecord.id)) {
        return activeRecord.id;
      }
      return availableAssets[0]?.id ?? null;
    });
  }, [activeRecord, availableAssets]);

  useEffect(() => {
    if (!liveRoomScroll) {
      return;
    }
    const node = roomMessagesRef.current;
    if (!node) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeRoomId, lastActiveMessageId, liveRoomScroll]);

  async function handleSend() {
    if (!activeRoomId) {
      setActionError("Create or select a topic before posting to oddchat.");
      return;
    }

    const body = draft.trim();
    if (!body) {
      return;
    }

    setSending(true);
    setActionError(null);
    try {
      await postGChatMessage(workspaceRoot, {
        roomId: activeRoomId,
        body,
        selectedTrainId: activeTopic?.selectedTrainId ?? selectedTrainId,
        stationId: activeTopic?.stationId ?? selectedStationId,
        edgeId: activeTopic?.edgeId ?? selectedEdgeId,
      });
      setDraft("");
      await onRefreshConsole({ background: true });
      setSurface("oddchat");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSending(false);
    }
  }

  async function handleCreateTopic() {
    setRoomAction("topic");
    setActionError(null);
    try {
      const created = await createGBoardTopic(workspaceRoot, {
        title: newTopicTitle.trim() || null,
        selectedTrainId,
        stationId: selectedStationId,
        edgeId: selectedEdgeId,
      });
      setNewTopicTitle("");
      setSelectedTopicId(created.topic.id);
      await onRefreshConsole({ background: true });
      setSurface("oddchat");
      window.requestAnimationFrame(() => {
        composerRef.current?.focus();
      });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRoomAction(null);
    }
  }

  async function handleAttachRecord(recordId: string | null) {
    if (!activeTopic || !recordId) {
      return;
    }
    setRoomAction("attach-record");
    setActionError(null);
    try {
      await attachGChatTopicRecord(workspaceRoot, {
        topicId: activeTopic.id,
        recordId,
      });
      await onRefreshConsole({ background: true });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRoomAction(null);
    }
  }

  async function handleAddParticipant() {
    if (!activeTopic) {
      setActionError("Create or select a topic before adding a participant.");
      return;
    }
    if (participantProvider === "gemini") {
      setActionError("Gemini is not wired into the managed room runtime yet.");
      return;
    }
    setRoomAction("add-participant");
    setActionError(null);
    try {
      await addTopicParticipant(workspaceRoot, {
        topicId: activeTopic.id,
        role: participantRole,
        provider: participantProvider,
      });
      await onRefreshConsole({ background: true });
      setSurface("oddchat");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRoomAction(null);
    }
  }

  async function handleToggleRoomRecipient(sessionId: string) {
    if (!activeTopic) {
      return;
    }
    const nextSessionIds = activeTopic.roomRecipientSessionIds.includes(sessionId)
      ? activeTopic.roomRecipientSessionIds.filter((value) => value !== sessionId)
      : [...activeTopic.roomRecipientSessionIds, sessionId];
    setRoomAction("room-recipients");
    setActionError(null);
    try {
      await setTopicRoomRecipients(workspaceRoot, {
        topicId: activeTopic.id,
        sessionIds: nextSessionIds,
      });
      await onRefreshConsole({ background: true });
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRoomAction(null);
    }
  }

  function toggleSection(sectionId: ExplorerSectionId) {
    setCollapsedSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  }

  const collapsedSummary =
    surface === "oddboard"
      ? "Durable board records are attached to this workspace."
      : activeTopic
        ? `Topic room "${activeTopic.label}" is ready for live coordination.`
        : "Create a topic to start a live room and attach assets. Agent launch now lives in the local shell workspace.";

  if (collapsed) {
    return (
      <section className="panel panel--agent-console is-collapsed" id="agent-console-widget">
        <div className="agent-console__collapsed-strip">
          <div className="agent-console__collapsed-copy">
            <span className="panel__eyebrow">OddBoard</span>
            <strong>{collapsedSummary}</strong>
          </div>

          <div className="agent-console__collapsed-meta">
            <span className="summary-pill summary-pill--view">{surface}</span>
            {activeTopic ? <span className="summary-pill">{activeTopic.label}</span> : null}
            <span className="summary-pill">{allTopics.length} topic(s)</span>
            {activeTopic ? <span className="summary-pill">{activeTopic.participants.length} topic participant(s)</span> : null}
            {selectedStationId ? <span className="summary-pill">{selectedStationId}</span> : null}
            {selectedEdgeId ? <span className="summary-pill">{selectedEdgeId}</span> : null}
          </div>

          <button
            type="button"
            className="navigator-mode-toggle"
            onClick={() => setCollapsed(false)}
            aria-expanded={false}
            aria-label="Expand oddboard"
            title="Expand oddboard"
          >
            ⌄
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel panel--agent-console" id="agent-console-widget">
      <div className="panel__heading agent-console__heading agent-console__heading--compact">
        <div className="agent-console__topline">
          <span className="panel__eyebrow">OddBoard</span>
          <div className="agent-console__surface-tabs" role="tablist" aria-label="Oddboard surfaces">
            {[
              { id: "oddboard" as const, label: "OddBoard" },
              { id: "oddchat" as const, label: "OddChat" },
            ].map((surfaceOption) => (
              <button
                key={surfaceOption.id}
                type="button"
                role="tab"
                aria-selected={surface === surfaceOption.id}
                className={`agent-console__surface-tab${surface === surfaceOption.id ? " is-active" : ""}`}
                onClick={() => setSurface(surfaceOption.id)}
              >
                {surfaceOption.label}
              </button>
            ))}
          </div>
          <div className="agent-console__context-strip">
            <span className="summary-pill summary-pill--view">{selectedTrainId}</span>
            {selectedStationId ? <span className="summary-pill">{selectedStationId}</span> : null}
            {selectedEdgeId ? <span className="summary-pill">{selectedEdgeId}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className="navigator-mode-toggle"
          onClick={() => setCollapsed(true)}
          aria-expanded={true}
          aria-label="Collapse oddboard"
          title="Collapse oddboard"
        >
          ⌃
        </button>
      </div>

      {error || actionError ? <p className="agent-console__error">{actionError ?? error}</p> : null}

      {surface === "oddboard" ? (
        <div className="agent-console__surface agent-console__surface--gboard">
          <div className="agent-console__gboard-sidebar">
            <div className="project-selector agent-console__gboard-selector">
              <div className="project-selector__tabs" role="tablist" aria-label="OddBoard views">
                {(["recent", "browse"] as GBoardBrowserMode[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={gboardMode === value}
                    className={`project-selector__tab${gboardMode === value ? " is-active" : ""}`}
                    onClick={() => setGboardMode(value)}
                  >
                    {value === "recent" ? "Recent" : "Browse"}
                  </button>
                ))}
              </div>

              {gboardMode === "browse" ? (
                <div className="project-selector__tabs" role="tablist" aria-label="OddBoard sources">
                  {GBOARD_SOURCE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="tab"
                      aria-selected={gboardSource === option.id}
                      className={`project-selector__tab${gboardSource === option.id ? " is-active" : ""}`}
                      onClick={() => setGboardSource(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <input
                className="agent-console__input"
                value={gboardSearch}
                onChange={(event) => setGboardSearch(event.target.value)}
                placeholder="Search title, path, author, or content…"
                aria-label="Search oddboard records"
              />

              <div className="project-selector__tabs" role="tablist" aria-label="OddBoard metadata filters">
                {gboardMetadataOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={gboardMetadataFilter === option.id}
                    className={`project-selector__tab${gboardMetadataFilter === option.id ? " is-active" : ""}`}
                    onClick={() => setGboardMetadataFilter(option.id)}
                  >
                    {option.label} {option.count}
                  </button>
                ))}
              </div>
            </div>

            <div className="agent-console__comment-list">
              {visibleRecords.length === 0 ? (
                <div className="project-selector__empty">No documents match the current filters.</div>
              ) : (
                visibleRecords.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    className={`agent-console__comment-item${record.id === activeRecord?.id ? " is-active" : ""}`}
                    onClick={() => setSelectedRecordId(record.id)}
                  >
                    <strong>{record.title}</strong>
                    <div className="agent-console__comment-item-meta">
                      <span>{record.sourceLabel}</span>
                      {record.source === "comments" && record.senderLabel ? <span>{record.senderLabel}</span> : null}
                    </div>
                    {record.path ? <small title={record.path}>{record.path}</small> : null}
                    <small>{formatTimestamp(record.timestamp)}</small>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="agent-console__comment-viewer">
            {activeRecord ? (
              <>
                <div className="agent-console__comment-header">
                  <div>
                    <span className="panel__eyebrow">Document</span>
                    <h3>{activeRecord.title}</h3>
                    <p className="muted">{activeRecord.path}</p>
                  </div>
                  <div className="agent-console__comment-header-meta">
                    <span className="summary-pill">{activeRecord.sourceLabel}</span>
                    {activeRecord.source === "comments" && activeRecord.senderLabel ? (
                      <span className="summary-pill">{activeRecord.senderLabel}</span>
                    ) : null}
                    {recordTopic ? <span className="summary-pill">{recordTopic.label}</span> : null}
                    <span className="muted">{formatTimestamp(activeRecord.timestamp)}</span>
                  </div>
                </div>
                <div className="agent-console__comment-scroll">
                  <MarkdownDocument content={renderableRecordContent(activeRecord)} />
                </div>
              </>
            ) : (
              <p className="muted">No durable oddboard documents have been loaded for this workspace yet.</p>
            )}
          </div>
        </div>
      ) : null}

      {surface === "oddchat" ? (
        <div className="agent-console__surface agent-console__surface--gchat">
          <aside className="agent-console__gchat-sidebar">
            <ExplorerSection
              title="Topics"
              tone="topics"
              collapsed={collapsedSections.topics}
              onToggle={() => toggleSection("topics")}
            >
              <div className="agent-console__gchat-new-topic">
                <input
                  id="agent-console-topic-title"
                  className="agent-console__input"
                  value={newTopicTitle}
                  onChange={(event) => setNewTopicTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleCreateTopic();
                    }
                  }}
                  placeholder="New topic of conversation…"
                />
                <div className="agent-console__resource-actions">
                  <button
                    type="button"
                    onClick={() => void handleCreateTopic()}
                    disabled={roomAction === "topic"}
                  >
                    {roomAction === "topic" ? "Creating..." : "New Topic"}
                  </button>
                </div>
              </div>

              <div className="agent-console__gchat-topic-list">
                {allTopics.length === 0 ? (
                  <div className="project-selector__empty">
                    No topics yet. Create one to start a room and attach assets.
                  </div>
                ) : (
                  allTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      className={`agent-console__topic-chip${topic.id === activeTopic?.id ? " is-active" : ""}`}
                      onClick={() => {
                        setSelectedTopicId(topic.id);
                      }}
                      >
                      <strong>{topic.label}</strong>
                      <span>{topic.attachedRecords.length} asset(s)</span>
                      <span>{topic.participants.length} topic participant(s)</span>
                      <span>{formatTimestamp(topic.updatedAt)}</span>
                    </button>
                  ))
                )}
              </div>
            </ExplorerSection>

            <ExplorerSection
              title="Participants"
              tone="workers"
              collapsed={collapsedSections.workers}
              onToggle={() => toggleSection("workers")}
              count={activeTopic?.attachedSessions.length ?? 0}
            >
              {activeTopic ? (
                <>
                  <div className="agent-console__gchat-new-topic">
                    <div className="project-selector__tabs" role="tablist" aria-label="Participant roles">
                      {PARTICIPANT_ROLE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="tab"
                          aria-selected={participantRole === option.id}
                          className={`project-selector__tab${participantRole === option.id ? " is-active" : ""}`}
                          onClick={() => setParticipantRole(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="project-selector__tabs" role="tablist" aria-label="Participant providers">
                      {PARTICIPANT_PROVIDER_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          role="tab"
                          aria-selected={participantProvider === option.id}
                          className={`project-selector__tab${participantProvider === option.id ? " is-active" : ""}`}
                          onClick={() => setParticipantProvider(option.id)}
                          disabled={!option.enabled}
                          title={option.enabled ? `Add ${option.label}` : `${option.label} is not wired yet`}
                        >
                          {option.label}
                          {!option.enabled ? " (soon)" : ""}
                        </button>
                      ))}
                    </div>
                    <div className="agent-console__resource-actions">
                      <button
                        type="button"
                        onClick={() => void handleAddParticipant()}
                        disabled={roomAction === "add-participant"}
                      >
                        {roomAction === "add-participant"
                          ? "Adding..."
                          : `Add ${selectedRoleLabel} via ${selectedProviderLabel}`}
                      </button>
                      <span className="muted">
                        Creates a linked terminal session below and joins it to this room automatically.
                      </span>
                    </div>
                  </div>
                  {activeTopicSessionSummaries.length ? (
                    <div className="agent-console__participant-list">
                      {activeTopicSessionSummaries.map(
                        ({ session, role, connectedParticipants, providerSummary, receivesRoom }) => (
                          <div key={session.id} className="agent-console__participant-card">
                            <div className="agent-console__participant-copy">
                              <strong>{session.label}</strong>
                              <div className="agent-console__participant-badges">
                                <span className="summary-pill">{role ?? "participant"}</span>
                                <span className={`summary-pill${connectedParticipants.length ? " summary-pill--ok" : " summary-pill--pending"}`}>
                                  {connectedParticipants.length ? "joined" : "shell only"}
                                </span>
                                <span className="summary-pill">{providerSummary}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={`agent-console__participant-toggle${receivesRoom ? " is-active" : ""}`}
                              onClick={() => void handleToggleRoomRecipient(session.id)}
                              disabled={roomAction === "room-recipients"}
                            >
                              {roomAction === "room-recipients" ? "Updating..." : receivesRoom ? "Receives Room" : "Muted"}
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="muted">
                      No linked participants yet. Add a worker or reviewer here and the backing terminal session below will be created automatically.
                    </p>
                  )}
                  <p className="muted">
                    Room delivery follows the enabled participants above. Use `@worker1` or `@reviewer1` in a message to override delivery for that one message while keeping everything in the shared room timeline.
                  </p>
                </>
              ) : (
                <p className="muted">Create or select a topic to manage its room participants.</p>
              )}
            </ExplorerSection>

            <ExplorerSection
              title="Assets"
              tone="assets"
              collapsed={collapsedSections.assets}
              onToggle={() => toggleSection("assets")}
              count={activeTopic?.attachedRecords.length ?? 0}
            >
              <div className="agent-console__resource-chip-list">
                {activeTopic?.attachedRecords.length ? (
                  activeTopic.attachedRecords.map((record) => (
                    <button
                      key={record.id}
                      type="button"
                      className="agent-console__topic-chip"
                      onClick={() => {
                        setSelectedRecordId(record.id);
                        setSurface("oddboard");
                      }}
                    >
                      <strong>{record.title}</strong>
                      <span>{record.sourceLabel}</span>
                    </button>
                  ))
                ) : (
                  <p className="muted">No assets attached to this topic yet.</p>
                )}
              </div>

              <div className="agent-console__resource-actions agent-console__resource-actions--stacked">
                <select
                  className="agent-console__select"
                  value={selectedAssetToAttachId ?? ""}
                  onChange={(event) => setSelectedAssetToAttachId(event.target.value || null)}
                >
                  <option value="">Select asset…</option>
                  {availableAssets.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.sourceLabel} · {record.title}
                    </option>
                  ))}
                </select>
                <div className="agent-console__resource-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void handleAttachRecord(activeRecord?.id ?? null)}
                    disabled={!activeRecord || activeRecordAlreadyAttached || roomAction === "attach-record"}
                  >
                    Attach Current Document
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAttachRecord(selectedAssetToAttachId)}
                    disabled={!selectedAssetToAttachId || roomAction === "attach-record"}
                  >
                    {roomAction === "attach-record" ? "Attaching..." : "Attach Asset"}
                  </button>
                </div>
              </div>
            </ExplorerSection>
          </aside>

          <div className="agent-console__gchat-main">
            {activeTopic ? (
              <>
                <div className="agent-console__topic-summary">
                  <div>
                    <span className="panel__eyebrow">Room Timeline</span>
                    <strong>{activeTopic.label}</strong>
                  </div>
                  <div className="agent-console__topic-summary-meta">
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setLiveRoomScroll((current) => !current)}
                    >
                      {liveRoomScroll ? "Live Scroll On" : "Live Scroll Off"}
                    </button>
                    <span className="summary-pill">{activeTopic.originKind}</span>
                    {activeTopic.assetLabel ? <span className="summary-pill">{activeTopic.assetLabel}</span> : null}
                    <span className="summary-pill">{activeTopic.participants.length} topic participant(s)</span>
                    <span className="summary-pill">{enabledRoomRecipientCount} receiving room</span>
                    <span className="summary-pill">{activeTopic.attachedSessions.length} linked session(s)</span>
                    {activeTopic.assetKind ? <span className="summary-pill">{topicAssetKindLabel(activeTopic.assetKind)}</span> : null}
                  </div>
                </div>

                <div ref={roomMessagesRef} className="agent-console__messages">
                  {loading ? <p className="muted">Loading topic conversation…</p> : null}
                  {!loading && !activeMessages.length ? (
                    <p className="muted">
                      {activeTopic.attachedSessions.length
                        ? "No room activity has been recorded for this topic yet. Add a worker, give it the document or ticket context, and keep reviews in the same room."
                        : "No room activity has been recorded for this topic yet. Add a worker or reviewer here to create the first linked session."}
                    </p>
                  ) : null}
                  {!loading && activeMessages.length
                    ? activeMessages.map((message) => (
                        <MessageCard
                          key={message.id}
                          message={message}
                          recipientLabels={(message.recipientSessionIds ?? []).map(
                            (sessionId) =>
                              activeTopic.attachedSessions.find((session) => session.id === sessionId)?.label ??
                              sessionId,
                          )}
                        />
                      ))
                    : null}
                </div>

                <div className="agent-console__composer">
                  <label className="panel__eyebrow" htmlFor="agent-console-draft">
                    Post To {compactTopicLabel(activeTopic)}
                  </label>
                  <textarea
                    id="agent-console-draft"
                    className="agent-console__textarea"
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Message the room. Use @worker1 or @reviewer1 to direct one message without leaving the shared timeline."
                  />
                  <div className="agent-console__composer-actions">
                    <button
                      className="ghost"
                      type="button"
                      onClick={() => void onRefreshConsole()}
                      disabled={loading || sending}
                    >
                      Refresh
                    </button>
                    <button type="button" onClick={() => void handleSend()} disabled={sending || !draft.trim()}>
                      {sending ? "Sending..." : "Send To Room"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="project-selector__empty">
                Create a topic to start a live room, then add workers and reviewers from this widget.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MessageCard({
  message,
  recipientLabels = [],
}: {
  message: GChatMessage;
  recipientLabels?: string[];
}) {
  const title = String(message.title ?? "").trim();
  const content = String(message.content ?? "").trim();
  const showTitle = title.length > 0 && title !== content;

  return (
    <article className="agent-console__message">
      <div className="agent-console__message-meta">
        <strong>{message.senderLabel}</strong>
        <div className="agent-console__message-badges">
          <span className="summary-pill">{message.source}</span>
          {recipientLabels.length ? (
            <span className="summary-pill summary-pill--gate">
              To {recipientLabels.join(", ")}
            </span>
          ) : null}
          {message.relatedSessionId ? <span className="summary-pill">{message.relatedSessionId.slice(0, 8)}</span> : null}
          <span>{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
      {showTitle ? <h3>{title}</h3> : null}
      <pre className="agent-console__message-content">{content}</pre>
      {message.path ? <small>{message.path}</small> : null}
    </article>
  );
}

function ExplorerSection({
  title,
  tone,
  collapsed,
  onToggle,
  count,
  children,
}: {
  title: string;
  tone: "topics" | "workers" | "assets";
  collapsed: boolean;
  onToggle: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className={`agent-console__explorer-section agent-console__explorer-section--${tone}${collapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="agent-console__explorer-header"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className="panel__eyebrow">{title}</span>
        <div className="agent-console__explorer-header-meta">
          {typeof count === "number" ? <span className="summary-pill">{count}</span> : null}
          <span className="agent-console__explorer-chevron">{collapsed ? "▸" : "▾"}</span>
        </div>
      </button>
      {!collapsed ? <div className="agent-console__explorer-body">{children}</div> : null}
    </section>
  );
}
