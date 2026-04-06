import { useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import {
  closeGTermSession,
  createGTermSession,
  promoteGTermSession,
  renameGTermSession,
  selectGTermSession,
} from "../../lib/collaboration";
import type { GTermPoolState, TrainId } from "../../lib/collaboration";

type GTermPanelProps = {
  workspaceRoot: string;
  selectedTrainId: TrainId;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
  gterm: GTermPoolState | null;
  onRefreshConsole: () => Promise<void>;
};

type TerminalStatus = "connecting" | "connected" | "closed" | "error";
type LayoutMode = "single" | "split-vertical" | "split-horizontal";

type TerminalEvent =
  | {
      type: "ready";
      workspaceRoot: string;
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

function socketUrl(workspaceRoot: string, sessionId: string) {
  const url = new URL("/api/oddterm", window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("workspaceRoot", workspaceRoot);
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
  workspaceRoot,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
  gterm,
  onRefreshConsole,
}: GTermPanelProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    if (typeof window === "undefined") {
      return "single";
    }
    const stored = window.localStorage.getItem("oman-oddterm-layout");
    return stored === "split-vertical" || stored === "split-horizontal" ? stored : "single";
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

  async function handleCreateSession() {
    if (creatingSession) {
      return;
    }
    setCreatingSession(true);
    try {
      const created = await createGTermSession(workspaceRoot, {
        selectedTrainId,
        stationId: selectedStationId,
        edgeId: selectedEdgeId,
      });
      if (!primarySessionId) {
        setPrimarySessionId(created.session.id);
      }
      setActiveSessionId(created.session.id);
      await onRefreshConsole();
    } finally {
      setCreatingSession(false);
    }
  }

  useEffect(() => {
    if (!gterm || creatingSession) {
      return;
    }
    if (gterm.sessions.length === 0) {
      void handleCreateSession();
    }
  }, [gterm, creatingSession, workspaceRoot]);

  const visibleSessions =
    layoutMode === "single"
      ? primarySession
        ? [primarySession]
        : []
      : [primarySession, secondarySession].filter(Boolean);

  return (
    <div className="agent-console__surface agent-console__surface--terminal">
      <div className="agent-console__terminal-workspace-bar">
        <div className="agent-console__terminal-session-list" role="tablist" aria-label="OddTerm sessions">
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
                  void selectGTermSession(workspaceRoot, session.id);
                }}
            >
              <strong>{session.label}</strong>
              <span>{session.status}</span>
            </button>
          ))}
          <button type="button" className="ghost agent-console__new-shell" onClick={() => void handleCreateSession()}>
            {creatingSession ? "Creating..." : "+ New OddTerm"}
          </button>
        </div>
        <div className="agent-console__terminal-workspace-controls">
          <div className="agent-console__layout-toggle" role="tablist" aria-label="OddTerm layout">
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
              <span>Second OddTerm</span>
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

          {activeSession ? (
            <div className="agent-console__terminal-session-meta">
              {activeSession.attachedTrainId ? <span className="summary-pill summary-pill--view">{activeSession.attachedTrainId}</span> : null}
              {activeSession.attachedStationId ? <span className="summary-pill">{activeSession.attachedStationId}</span> : null}
              {activeSession.attachedEdgeId ? <span className="summary-pill">{activeSession.attachedEdgeId}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className={`agent-console__terminal-layout agent-console__terminal-layout--${layoutMode}`}>
        {visibleSessions.length ? (
          visibleSessions.map((session, index) => (
            <TerminalSessionPane
              key={session.id}
              workspaceRoot={workspaceRoot}
              session={session}
              selectedTrainId={selectedTrainId}
              selectedStationId={selectedStationId}
              selectedEdgeId={selectedEdgeId}
              autoFocus={session.id === activeSessionId}
              onActivate={() => setActiveSessionId(session.id)}
              onRefreshConsole={onRefreshConsole}
            />
          ))
        ) : (
          <div className="agent-console__terminal-shell">
            <div className="agent-console__terminal-empty">
              <p className="muted">No oddterm is attached yet.</p>
              <button type="button" onClick={() => void handleCreateSession()} disabled={creatingSession}>
                {creatingSession ? "Creating..." : "Create First OddTerm"}
              </button>
            </div>
          </div>
        )}

        {layoutMode !== "single" && !secondarySession ? (
          <div className="agent-console__terminal-shell agent-console__terminal-shell--placeholder">
            <div className="agent-console__terminal-empty">
              <p className="muted">Create or select another oddterm to fill the split view.</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TerminalSessionPaneProps = {
  workspaceRoot: string;
  session: GTermPoolState["sessions"][number];
  selectedTrainId: TrainId;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
  autoFocus: boolean;
  onActivate: () => void;
  onRefreshConsole: () => Promise<void>;
};

function TerminalSessionPane({
  workspaceRoot,
  session,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
  autoFocus,
  onActivate,
  onRefreshConsole,
}: TerminalSessionPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
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
      fontSize: 13,
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
    updateStatus(session.status === "closed" ? "closed" : "connecting", terminal);

    const socket = new WebSocket(socketUrl(workspaceRoot, session.id));
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

    const keyDisposable = terminal.onKey(({ key, domEvent }) => {
      if (domEvent.metaKey) {
        return;
      }
      sendInput(key);
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
      keyDisposable.dispose();
      socket.close();
      socketRef.current = null;
      fitAddon.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [workspaceRoot, session.id, instanceKey, autoFocus]);

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
        <button
          type="button"
          className="ghost"
          onClick={(event) => {
            event.stopPropagation();
            if (status === "closed") {
              void (async () => {
                const created = await createGTermSession(workspaceRoot, {
                  selectedTrainId: session.attachedTrainId ?? selectedTrainId,
                  stationId: session.attachedStationId ?? selectedStationId,
                  edgeId: session.attachedEdgeId ?? selectedEdgeId,
                  label: session.label,
                });
                await selectGTermSession(workspaceRoot, created.session.id);
                await onRefreshConsole();
              })();
              return;
            }
            setInstanceKey((current) => current + 1);
          }}
        >
          {status === "closed" ? "New Live OddTerm" : "Reconnect"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={renaming}
          onClick={async (event) => {
            event.stopPropagation();
            const nextLabel = window.prompt("Rename oddterm", session.label);
            if (!nextLabel || nextLabel.trim() === session.label) {
              return;
            }
            setRenaming(true);
            try {
              await renameGTermSession(workspaceRoot, session.id, nextLabel.trim());
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
          className="ghost"
          disabled={promoting}
          onClick={async (event) => {
            event.stopPropagation();
            setPromoting(true);
            setPromotionState("idle");
            try {
              await promoteGTermSession(workspaceRoot, {
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
          className="ghost"
          disabled={closing}
          onClick={async (event) => {
            event.stopPropagation();
            const ok = window.confirm(`Close ${session.label}?`);
            if (!ok) {
              return;
            }
            setClosing(true);
            try {
              await closeGTermSession(workspaceRoot, session.id);
              await onRefreshConsole();
            } finally {
              setClosing(false);
            }
          }}
        >
          {closing ? "Closing..." : "Close"}
        </button>
      </div>

      <div
        ref={hostRef}
        className="agent-console__terminal-host"
        aria-label={`Workspace oddterm ${session.label}`}
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
