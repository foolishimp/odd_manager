import { useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import {
  closeGTermSession,
  createGTermSession,
  joinShellAgentTopic,
  launchShellAgent,
  promoteGTermSession,
  renameGTermSession,
  selectGTermSession,
} from "../../lib/collaboration";
import type { GChatTopic, GTermPoolState, TrainId } from "../../lib/collaboration";

type GTermPanelProps = {
  projectRoot: string;
  selectedTrainId: TrainId;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
  gterm: GTermPoolState | null;
  topics: GChatTopic[];
  onRefreshConsole: () => Promise<void>;
};

type TerminalStatus = "connecting" | "connected" | "closed" | "error";
type LayoutMode = "single" | "split-vertical" | "split-horizontal";
type JoinProvider = "codex" | "claude";
type TerminalFontPreset = "small" | "medium" | "large";

type TerminalEvent =
  | {
      type: "ready";
      projectRoot: string;
      shell: string;
      pid: number;
      backend?: string;
    }
  | {
      type: "data";
      data: string;
    }
  | {
      type: "exit";
      exitCode: number;
      signal: number | null;
    }
  | {
      type: "error";
      message: string;
    };

const ODDTERM_TOPIC_SELECTIONS_STORAGE_KEY = "oman-oddterm-topic-selections";
const ODDTERM_PROVIDER_SELECTIONS_STORAGE_KEY = "oman-oddterm-provider-selections";
const ODDTERM_AGENT_PANEL_COLLAPSED_STORAGE_KEY = "oman-oddterm-agent-panel-collapsed";
const ODDTERM_FONT_PRESET_STORAGE_KEY = "oman-oddterm-font-preset";

const TERMINAL_FONT_SIZES: Record<TerminalFontPreset, number> = {
  small: 12,
  medium: 13,
  large: 15,
};

function readStoredMap(storageKey: string) {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const payload = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

function inferJoinProvider(session: GTermPoolState["sessions"][number]): JoinProvider | null {
  const provider = session.participants?.find(
    (participant) => participant.provider === "codex" || participant.provider === "claude",
  )?.provider;
  return provider === "codex" || provider === "claude" ? provider : null;
}

function socketUrl(projectRoot: string, sessionId: string) {
  const url = new URL("/api/oddterm", window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("projectRoot", projectRoot);
  url.searchParams.set("sessionId", sessionId);
  return url.toString();
}

function terminalTheme() {
  return {
    background: "#0b1220",
    foreground: "#e6eef8",
    cursor: "#59c3c3",
    black: "#0b1220",
    brightBlack: "#496079",
    red: "#f97316",
    brightRed: "#fb923c",
    green: "#2a6f3e",
    brightGreen: "#3b8d54",
    yellow: "#d97706",
    brightYellow: "#f59e0b",
    blue: "#7aa6d8",
    brightBlue: "#8cc1ff",
    magenta: "#9b8cff",
    brightMagenta: "#b8abff",
    cyan: "#59c3c3",
    brightCyan: "#7be3e3",
    white: "#dce7f3",
    brightWhite: "#f8fbff",
  };
}

export function OddTermPanel({
  projectRoot,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
  gterm,
  topics,
  onRefreshConsole,
}: GTermPanelProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") {
      return "single";
    }
    const stored = window.localStorage.getItem("oman-oddterm-layout");
    return stored === "split-vertical" || stored === "split-horizontal" ? stored : "single";
  });
  const [fontPreset, setFontPreset] = useState<TerminalFontPreset>(() => {
    if (typeof window === "undefined") {
      return "medium";
    }
    const stored = window.localStorage.getItem(ODDTERM_FONT_PRESET_STORAGE_KEY);
    return stored === "small" || stored === "large" || stored === "medium" ? stored : "medium";
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [primarySessionId, setPrimarySessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem("oman-oddterm-primary");
  });
  const [secondarySessionId, setSecondarySessionId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem("oman-oddterm-secondary");
  });
  const [creatingSession, setCreatingSession] = useState(false);
  const [selectedTopicBySessionId, setSelectedTopicBySessionId] = useState<Record<string, string>>(() =>
    readStoredMap(ODDTERM_TOPIC_SELECTIONS_STORAGE_KEY) as Record<string, string>,
  );
  const [selectedProviderBySessionId, setSelectedProviderBySessionId] = useState<
    Record<string, JoinProvider>
  >(() => readStoredMap(ODDTERM_PROVIDER_SELECTIONS_STORAGE_KEY) as Record<string, JoinProvider>);
  const [collapsedAgentPanelBySessionId, setCollapsedAgentPanelBySessionId] = useState<
    Record<string, boolean>
  >(() => readStoredMap(ODDTERM_AGENT_PANEL_COLLAPSED_STORAGE_KEY) as Record<string, boolean>);
  const [launchingAgentKey, setLaunchingAgentKey] = useState<string | null>(null);
  const [joiningTopicKey, setJoiningTopicKey] = useState<string | null>(null);
  const [agentActionError, setAgentActionError] = useState<string | null>(null);

  const sessions = gterm?.sessions ?? [];

  useEffect(() => {
    const availableIds = new Set(sessions.map((session) => session.id));
    setPrimarySessionId((current) => {
      if (current && availableIds.has(current)) {
        return current;
      }
      return gterm?.activeSessionId ?? sessions[0]?.id ?? null;
    });
    setActiveSessionId((current) => {
      if (current && availableIds.has(current)) {
        return current;
      }
      return primarySessionId && availableIds.has(primarySessionId)
        ? primarySessionId
        : gterm?.activeSessionId ?? sessions[0]?.id ?? null;
    });
  }, [sessions, gterm?.activeSessionId, primarySessionId]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );
  const primarySession = useMemo(
    () => sessions.find((session) => session.id === primarySessionId) ?? null,
    [sessions, primarySessionId],
  );
  const secondaryOptions = useMemo(
    () => sessions.filter((session) => session.id !== primarySessionId),
    [sessions, primarySessionId],
  );
  const secondarySession = useMemo(
    () => secondaryOptions.find((session) => session.id === secondarySessionId) ?? secondaryOptions[0] ?? null,
    [secondaryOptions, secondarySessionId],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("oman-oddterm-layout", layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(ODDTERM_FONT_PRESET_STORAGE_KEY, fontPreset);
  }, [fontPreset]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (primarySession?.id) {
      window.localStorage.setItem("oman-oddterm-primary", primarySession.id);
      return;
    }
    window.localStorage.removeItem("oman-oddterm-primary");
  }, [primarySession?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (secondarySession?.id) {
      window.localStorage.setItem("oman-oddterm-secondary", secondarySession.id);
      return;
    }
    window.localStorage.removeItem("oman-oddterm-secondary");
  }, [secondarySession?.id]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      ODDTERM_TOPIC_SELECTIONS_STORAGE_KEY,
      JSON.stringify(selectedTopicBySessionId),
    );
  }, [selectedTopicBySessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      ODDTERM_PROVIDER_SELECTIONS_STORAGE_KEY,
      JSON.stringify(selectedProviderBySessionId),
    );
  }, [selectedProviderBySessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      ODDTERM_AGENT_PANEL_COLLAPSED_STORAGE_KEY,
      JSON.stringify(collapsedAgentPanelBySessionId),
    );
  }, [collapsedAgentPanelBySessionId]);

  useEffect(() => {
    if (!secondaryOptions.length) {
      setSecondarySessionId(null);
      return;
    }
    setSecondarySessionId((current) => {
      if (current && secondaryOptions.some((session) => session.id === current)) {
        return current;
      }
      return secondaryOptions[0]?.id ?? null;
    });
  }, [secondaryOptions]);

  useEffect(() => {
    const availableSessionIds = new Set(sessions.map((session) => session.id));
    const availableTopicIds = new Set(topics.map((topic) => topic.id));

    setSelectedTopicBySessionId((current) => {
      const nextEntries = Object.entries(current).filter(
        ([sessionId, topicId]) => availableSessionIds.has(sessionId) && availableTopicIds.has(topicId),
      );
      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });

    setSelectedProviderBySessionId((current) => {
      const nextEntries = Object.entries(current).filter(([sessionId]) => availableSessionIds.has(sessionId));
      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });

    setCollapsedAgentPanelBySessionId((current) => {
      const nextEntries = Object.entries(current).filter(([sessionId]) => availableSessionIds.has(sessionId));
      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
  }, [sessions, topics]);

  async function handleCreateSession() {
    if (creatingSession) {
      return;
    }
    setCreatingSession(true);
    try {
      const created = await createGTermSession(projectRoot, {
        selectedTrainId,
        stationId: selectedStationId,
        edgeId: selectedEdgeId,
      });
      await selectGTermSession(projectRoot, created.session.id);
      await onRefreshConsole();
      if (layoutMode === "single" || !primarySessionId) {
        setPrimarySessionId(created.session.id);
      } else if (!secondarySessionId || secondarySessionId === primarySessionId) {
        setSecondarySessionId(created.session.id);
      }
      setActiveSessionId(created.session.id);
    } finally {
      setCreatingSession(false);
    }
  }

  function handleSelectTopic(sessionId: string, topicId: string | null) {
    setSelectedTopicBySessionId((current) => {
      if (!topicId) {
        const { [sessionId]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [sessionId]: topicId,
      };
    });
  }

  async function handleLaunchAgent(sessionId: string, provider: JoinProvider) {
    const launchKey = `${provider}:${sessionId}`;
    setLaunchingAgentKey(launchKey);
    setAgentActionError(null);
    setSelectedProviderBySessionId((current) => ({
      ...current,
      [sessionId]: provider,
    }));
    try {
      await launchShellAgent(projectRoot, {
        sessionId,
        provider,
      });
      await onRefreshConsole();
    } catch (caught) {
      setAgentActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLaunchingAgentKey(null);
    }
  }

  function handleToggleAgentPanel(sessionId: string) {
    setCollapsedAgentPanelBySessionId((current) => ({
      ...current,
      [sessionId]: !(current[sessionId] ?? true),
    }));
  }

  async function handleJoinTopic(sessionId: string, topicId: string, provider: JoinProvider) {
    const joinKey = `${provider}:${sessionId}:${topicId}`;
    setJoiningTopicKey(joinKey);
    setAgentActionError(null);
    try {
      await joinShellAgentTopic(projectRoot, {
        sessionId,
        topicId,
        provider,
      });
      await onRefreshConsole();
    } catch (caught) {
      setAgentActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setJoiningTopicKey(null);
    }
  }

  const visibleSessions =
    layoutMode === "single"
      ? primarySession
        ? [primarySession]
        : []
      : [primarySession, secondarySession].filter(Boolean);

  return (
    <div className="agent-console__surface agent-console__surface--terminal">
      <div className="agent-console__terminal-workspace-bar">
        <div className="agent-console__terminal-session-list" role="tablist" aria-label="Local shell sessions">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              role="tab"
              aria-selected={session.id === primarySessionId}
              className={`agent-console__terminal-session-chip${session.id === primarySessionId ? " is-active" : ""}`}
                onClick={() => {
                  setPrimarySessionId(session.id);
                  setActiveSessionId(session.id);
                  void selectGTermSession(projectRoot, session.id);
                }}
            >
              <strong>{session.label}</strong>
              <span>{session.status}</span>
            </button>
          ))}
          <button type="button" className="ghost agent-console__new-shell" onClick={() => void handleCreateSession()}>
            {creatingSession ? "Creating..." : "+ New Local Shell"}
          </button>
        </div>
        <div className="agent-console__terminal-workspace-controls">
          <div className="agent-console__layout-toggle" role="tablist" aria-label="Local shell layout">
            <button
              type="button"
              className={`agent-console__layout-button${layoutMode === "single" ? " is-active" : ""}`}
              onClick={() => setLayoutMode("single")}
            >
              Single
            </button>
            <button
              type="button"
              className={`agent-console__layout-button${layoutMode === "split-vertical" ? " is-active" : ""}`}
              onClick={() => setLayoutMode("split-vertical")}
            >
              Split V
            </button>
            <button
              type="button"
              className={`agent-console__layout-button${layoutMode === "split-horizontal" ? " is-active" : ""}`}
              onClick={() => setLayoutMode("split-horizontal")}
            >
              Split H
            </button>
          </div>

          {layoutMode !== "single" && secondaryOptions.length ? (
            <label className="agent-console__secondary-picker">
              <span>Second Local Shell</span>
              <select
                value={secondarySession?.id ?? ""}
                onChange={(event) => setSecondarySessionId(event.target.value || null)}
              >
                {secondaryOptions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="agent-console__secondary-picker">
            <span>Font</span>
            <select
              value={fontPreset}
              onChange={(event) => {
                const nextPreset = event.target.value;
                if (nextPreset === "small" || nextPreset === "medium" || nextPreset === "large") {
                  setFontPreset(nextPreset);
                }
              }}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>

          {activeSession ? (
            <div className="agent-console__terminal-session-meta">
              {activeSession.attachedTrainId ? <span className="summary-pill summary-pill--view">{activeSession.attachedTrainId}</span> : null}
              {activeSession.attachedStationId ? <span className="summary-pill">{activeSession.attachedStationId}</span> : null}
              {activeSession.attachedEdgeId ? <span className="summary-pill">{activeSession.attachedEdgeId}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {agentActionError ? <p className="agent-console__error">{agentActionError}</p> : null}

      <div className={`agent-console__terminal-layout agent-console__terminal-layout--${layoutMode}`}>
        {visibleSessions.length ? (
          visibleSessions.map((session, index) => (
            <TerminalSessionPane
              key={session.id}
              projectRoot={projectRoot}
              session={session}
              selectedTrainId={selectedTrainId}
              selectedStationId={selectedStationId}
              selectedEdgeId={selectedEdgeId}
              autoFocus={session.id === activeSessionId}
              layoutMode={layoutMode}
              primarySessionId={primarySessionId}
              secondarySessionId={secondarySessionId}
              onSetPrimarySessionId={setPrimarySessionId}
              onSetSecondarySessionId={setSecondarySessionId}
              onSetActiveSessionId={setActiveSessionId}
              onActivate={() => setActiveSessionId(session.id)}
              topics={topics}
              selectedTopicId={selectedTopicBySessionId[session.id] ?? null}
              selectedProvider={
                selectedProviderBySessionId[session.id] ?? inferJoinProvider(session) ?? "codex"
              }
              providerReady={Boolean(selectedProviderBySessionId[session.id] ?? inferJoinProvider(session))}
              agentPanelCollapsed={collapsedAgentPanelBySessionId[session.id] ?? true}
              launchingAgentKey={launchingAgentKey}
              joiningTopicKey={joiningTopicKey}
              onSelectTopic={handleSelectTopic}
              onLaunchAgent={handleLaunchAgent}
              onJoinTopic={handleJoinTopic}
              onToggleAgentPanel={handleToggleAgentPanel}
              onRefreshConsole={onRefreshConsole}
              fontPreset={fontPreset}
            />
          ))
        ) : (
          <div className="agent-console__terminal-shell">
            <div className="agent-console__terminal-empty">
              <p className="muted">No local shell is open yet.</p>
              <button type="button" onClick={() => void handleCreateSession()} disabled={creatingSession}>
                {creatingSession ? "Creating..." : "Create First Local Shell"}
              </button>
            </div>
          </div>
        )}

        {layoutMode !== "single" && !secondarySession ? (
          <div className="agent-console__terminal-shell agent-console__terminal-shell--placeholder">
            <div className="agent-console__terminal-empty">
              <p className="muted">Create or select another local shell to fill the split view.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TerminalSessionPaneProps = {
  projectRoot: string;
  session: GTermPoolState["sessions"][number];
  selectedTrainId: TrainId;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
  autoFocus: boolean;
  layoutMode: LayoutMode;
  primarySessionId: string | null;
  secondarySessionId: string | null;
  onSetPrimarySessionId: (sessionId: string | null) => void;
  onSetSecondarySessionId: (sessionId: string | null) => void;
  onSetActiveSessionId: (sessionId: string | null) => void;
  onActivate: () => void;
  topics: GChatTopic[];
  selectedTopicId: string | null;
  selectedProvider: JoinProvider;
  providerReady: boolean;
  agentPanelCollapsed: boolean;
  launchingAgentKey: string | null;
  joiningTopicKey: string | null;
  onSelectTopic: (sessionId: string, topicId: string | null) => void;
  onLaunchAgent: (sessionId: string, provider: JoinProvider) => Promise<void>;
  onJoinTopic: (sessionId: string, topicId: string, provider: JoinProvider) => Promise<void>;
  onToggleAgentPanel: (sessionId: string) => void;
  onRefreshConsole: () => Promise<void>;
  fontPreset: TerminalFontPreset;
};

function TerminalSessionPane({
  projectRoot,
  session,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
  autoFocus,
  layoutMode,
  primarySessionId,
  secondarySessionId,
  onSetPrimarySessionId,
  onSetSecondarySessionId,
  onSetActiveSessionId,
  onActivate,
  topics,
  selectedTopicId,
  selectedProvider,
  providerReady,
  agentPanelCollapsed,
  launchingAgentKey,
  joiningTopicKey,
  onSelectTopic,
  onLaunchAgent,
  onJoinTopic,
  onToggleAgentPanel,
  onRefreshConsole,
  fontPreset,
}: TerminalSessionPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<TerminalStatus>(session.status === "closed" ? "closed" : "connecting");
  const [status, setStatus] = useState<TerminalStatus>(session.status === "closed" ? "closed" : "connecting");
  const [sessionMeta, setSessionMeta] = useState<{ shell: string; pid: number; backend?: string | null } | null>(
    session.shell && session.pid
      ? {
          shell: session.shell,
          pid: session.pid,
          backend: session.backend,
        }
      : null,
  );
  const [instanceKey, setInstanceKey] = useState(0);
  const [promoting, setPromoting] = useState(false);
  const [promotionState, setPromotionState] = useState<"idle" | "saved" | "error">("idle");
  const [renaming, setRenaming] = useState(false);
  const [closing, setClosing] = useState(false);
  const activeTopic = topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? null;
  const sessionParticipants = session.participants ?? [];
  const joinedParticipantsForTopic = activeTopic
    ? sessionParticipants.filter((participant) => participant.topicId === activeTopic.id)
    : [];
  const selectedProviderJoined = joinedParticipantsForTopic.some(
    (participant) => participant.provider === selectedProvider && participant.status === "connected",
  );

  function focusTerminal() {
    terminalRef.current?.focus();
  }

  function updateStatus(nextStatus: TerminalStatus, terminal?: Terminal | null) {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    const instance = terminal ?? terminalRef.current;
    if (instance) {
      instance.options.disableStdin = nextStatus !== "connected";
    }
  }

  function sendInput(data: string) {
    if (statusRef.current !== "connected") {
      return;
    }
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify({ type: "input", data }));
  }

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "\"JetBrains Mono\", \"IBM Plex Mono\", monospace",
      fontSize: TERMINAL_FONT_SIZES[fontPreset],
      lineHeight: 1.25,
      scrollback: 4000,
      theme: terminalTheme(),
    });
    const fitAddon = new FitAddon();
    const terminalHost = hostRef.current;
    terminal.loadAddon(fitAddon);
    terminal.open(terminalHost);
    fitAddon.fit();
    terminal.options.disableStdin = session.status === "closed";
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    updateStatus(session.status === "closed" ? "closed" : "connecting", terminal);

    const socket = new WebSocket(socketUrl(projectRoot, session.id));
    socketRef.current = socket;

    function send(payload: Record<string, unknown>) {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify(payload));
    }

    function sendResize() {
      send({
        type: "resize",
        cols: terminal.cols,
        rows: terminal.rows,
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize();
    });
    resizeObserver.observe(terminalHost);

    const inputDisposable = terminal.onData((data) => {
      sendInput(data);
    });

    socket.addEventListener("open", () => {
      updateStatus("connected", terminal);
      sendResize();
      if (autoFocus) {
        window.requestAnimationFrame(() => {
          focusTerminal();
        });
      }
    });

    socket.addEventListener("message", (event) => {
      let payload: TerminalEvent;
      try {
        payload = JSON.parse(String(event.data)) as TerminalEvent;
      } catch {
        return;
      }

      if (payload.type === "ready") {
        setSessionMeta({
          shell: payload.shell,
          pid: payload.pid,
          backend: "backend" in payload && typeof payload.backend === "string" ? payload.backend : null,
        });
        return;
      }

      if (payload.type === "data") {
        terminal.write(payload.data);
        return;
      }

      if (payload.type === "exit") {
        updateStatus("closed", terminal);
        terminal.writeln("");
        terminal.writeln(`[session exited: ${payload.exitCode}]`);
        socket.close();
        void onRefreshConsole();
        return;
      }

      if (payload.type === "error") {
        updateStatus("error", terminal);
        terminal.writeln("");
        terminal.writeln(`[oddterm error] ${payload.message}`);
      }
    });

    socket.addEventListener("close", () => {
      updateStatus(statusRef.current === "error" ? "error" : "closed", terminal);
    });

    socket.addEventListener("error", () => {
      updateStatus("error", terminal);
    });

    return () => {
      resizeObserver.disconnect();
      inputDisposable.dispose();
      socket.close();
      socketRef.current = null;
      fitAddonRef.current = null;
      fitAddon.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [projectRoot, session.id, instanceKey, autoFocus]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    const nextFontSize = TERMINAL_FONT_SIZES[fontPreset];
    if (terminal.options.fontSize === nextFontSize) {
      return;
    }
    terminal.options.fontSize = nextFontSize;
    window.requestAnimationFrame(() => {
      fitAddonRef.current?.fit();
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(
        JSON.stringify({
          type: "resize",
          cols: terminal.cols,
          rows: terminal.rows,
        }),
      );
    });
  }, [fontPreset]);

  return (
    <div className="agent-console__terminal-shell" onClick={onActivate}>
      <div className="agent-console__terminal-bar">
        <span className="agent-console__terminal-dot" />
        <span className="agent-console__terminal-dot" />
        <span className="agent-console__terminal-dot" />
        <strong>{session.label}</strong>
        <span className={`status-chip ${status === "connected" ? "active" : status === "error" ? "blocked" : "pending"}`}>
          {status}
        </span>
        {sessionMeta ? (
          <span className="agent-console__terminal-meta">
            pid {sessionMeta.pid} · {sessionMeta.shell}
            {sessionMeta.backend ? ` · ${sessionMeta.backend}` : ""}
          </span>
        ) : null}
        {session.participants?.length ? (
          <span className="agent-console__terminal-meta">
            {session.participants.map((participant) => participant.participantLabel).join(", ")}
          </span>
        ) : null}
        <button
          type="button"
          className="ghost agent-console__terminal-action"
          onClick={(event) => {
            event.stopPropagation();
            if (status === "closed") {
              void (async () => {
                const created = await createGTermSession(projectRoot, {
                  selectedTrainId: session.attachedTrainId ?? selectedTrainId,
                  stationId: session.attachedStationId ?? selectedStationId,
                  edgeId: session.attachedEdgeId ?? selectedEdgeId,
                  label: session.label,
                });
                await selectGTermSession(projectRoot, created.session.id);
                await onRefreshConsole();
                if (layoutMode === "single" || primarySessionId === session.id) {
                  onSetPrimarySessionId(created.session.id);
                } else if (secondarySessionId === session.id) {
                  onSetSecondarySessionId(created.session.id);
                }
                onSetActiveSessionId(created.session.id);
              })();
              return;
            }
            setInstanceKey((current) => current + 1);
          }}
        >
          {status === "closed" ? "New Live Shell" : "Reconnect"}
        </button>
        <button
          type="button"
          className="ghost agent-console__terminal-action"
          disabled={renaming}
          onClick={async (event) => {
            event.stopPropagation();
            const nextLabel = window.prompt("Rename local shell", session.label);
            if (!nextLabel || nextLabel.trim() === session.label) {
              return;
            }
            setRenaming(true);
            try {
              await renameGTermSession(projectRoot, session.id, nextLabel.trim());
              await onRefreshConsole();
            } finally {
              setRenaming(false);
            }
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="ghost agent-console__terminal-action"
          disabled={promoting}
          onClick={async (event) => {
            event.stopPropagation();
            setPromoting(true);
            setPromotionState("idle");
            try {
              await promoteGTermSession(projectRoot, {
                sessionId: session.id,
                selectedTrainId,
                stationId: selectedStationId,
                edgeId: selectedEdgeId,
              });
              setPromotionState("saved");
              await onRefreshConsole();
            } catch {
              setPromotionState("error");
            } finally {
              setPromoting(false);
            }
          }}
        >
          {promoting ? "Promoting..." : promotionState === "saved" ? "Promoted" : promotionState === "error" ? "Retry Promote" : "Promote Tail"}
        </button>
        <button
          type="button"
          className="ghost agent-console__terminal-action"
          onClick={(event) => {
            event.stopPropagation();
            onToggleAgentPanel(session.id);
          }}
        >
          {agentPanelCollapsed ? "Show Agents" : "Hide Agents"}
        </button>
        <button
          type="button"
          className="ghost agent-console__terminal-action"
          disabled={closing}
          onClick={async (event) => {
            event.stopPropagation();
            const ok = window.confirm(`Close ${session.label}?`);
            if (!ok) {
              return;
            }
            setClosing(true);
            try {
              await closeGTermSession(projectRoot, session.id);
              await onRefreshConsole();
            } finally {
              setClosing(false);
            }
          }}
        >
          {closing ? "Closing..." : "Close"}
        </button>
      </div>

      {!agentPanelCollapsed ? (
        <div className="agent-console__terminal-context">
          <div className="agent-console__terminal-context-header">
            <p className="muted agent-console__terminal-context-copy">
              Launch an agent in this shell, then join a topic when ready.
            </p>
            <div className="agent-console__terminal-context-status">
              {providerReady ? (
                <span className="summary-pill">
                  As {selectedProvider === "claude" ? "Claude" : "Codex"}
                </span>
              ) : (
                <span className="muted">Launch Codex or Claude first.</span>
              )}
              {joinedParticipantsForTopic.length ? (
                <div className="agent-console__resource-chip-list">
                  {joinedParticipantsForTopic.map((participant) => (
                    <span key={participant.id} className="summary-pill">
                      {participant.participantLabel} · {participant.status}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="agent-console__terminal-context-row agent-console__terminal-context-row--compact">
            <label className="agent-console__terminal-picker agent-console__terminal-picker--topic">
              <span className="panel__eyebrow">Topic</span>
              <select
                className="agent-console__select"
                value={activeTopic?.id ?? ""}
                onChange={(event) => onSelectTopic(session.id, event.target.value || null)}
                onClick={(event) => event.stopPropagation()}
                disabled={!topics.length}
              >
                <option value="">{topics.length ? "Select topic…" : "No topics yet"}</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="agent-console__resource-actions agent-console__resource-actions--terminal">
              <button
                type="button"
                className="ghost agent-console__terminal-action"
                disabled={session.status !== "live" || launchingAgentKey !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  void onLaunchAgent(session.id, "codex");
                }}
              >
                {launchingAgentKey === `codex:${session.id}` ? "Launching Codex..." : "Launch Codex"}
              </button>
              <button
                type="button"
                className="ghost agent-console__terminal-action"
                disabled={session.status !== "live" || launchingAgentKey !== null}
                onClick={(event) => {
                  event.stopPropagation();
                  void onLaunchAgent(session.id, "claude");
                }}
              >
                {launchingAgentKey === `claude:${session.id}` ? "Launching Claude..." : "Launch Claude"}
              </button>
              <button
                type="button"
                className="agent-console__terminal-action"
                disabled={
                  session.status !== "live" ||
                  !providerReady ||
                  !activeTopic ||
                  joiningTopicKey !== null ||
                  selectedProviderJoined
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (!activeTopic) {
                    return;
                  }
                  void onJoinTopic(session.id, activeTopic.id, selectedProvider);
                }}
              >
                {selectedProviderJoined
                  ? `Joined ${selectedProvider === "claude" ? "Claude" : "Codex"}`
                  : activeTopic && joiningTopicKey === `${selectedProvider}:${session.id}:${activeTopic.id}`
                    ? `Joining ${selectedProvider === "claude" ? "Claude" : "Codex"}...`
                    : "Join Topic"}
              </button>
            </div>
          </div>

          {!joinedParticipantsForTopic.length ? (
            <p className="muted agent-console__terminal-context-note">
              No shell participants are connected to this topic yet.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        ref={hostRef}
        className="agent-console__terminal-host"
        aria-label={`Workspace local shell ${session.label}`}
        tabIndex={0}
        onClick={focusTerminal}
        onMouseDown={() => {
          window.requestAnimationFrame(() => {
            focusTerminal();
          });
        }}
      />
    </div>
  );
}
