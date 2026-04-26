import { useEffect, useMemo, useState } from "react";
import { OddTermPanel } from "./OddTermPanel";
import type { AgentConsoleState, TrainId } from "../../lib/collaboration";

const TERMINAL_WORKSPACE_COLLAPSED_STORAGE_KEY = "oman-oddterm-workspace-collapsed";
const TERMINAL_WORKSPACE_PINNED_STORAGE_KEY = "oman-oddterm-workspace-pinned";

type OddTermWorkspaceWidgetProps = {
  workspaceRoot: string;
  selectedTrainId: TrainId;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
  consoleState: AgentConsoleState | null;
  loading: boolean;
  error: string | null;
  onRefreshConsole: (options?: { background?: boolean }) => Promise<void>;
};

export function OddTermWorkspaceWidget({
  workspaceRoot,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
  consoleState,
  loading,
  error,
  onRefreshConsole,
}: OddTermWorkspaceWidgetProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = window.localStorage.getItem(TERMINAL_WORKSPACE_COLLAPSED_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [pinned, setPinned] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(TERMINAL_WORKSPACE_PINNED_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TERMINAL_WORKSPACE_COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(TERMINAL_WORKSPACE_PINNED_STORAGE_KEY, String(pinned));
  }, [pinned]);

  const sessionCount = consoleState?.oddterm.sessions.length ?? 0;
  const liveCount = useMemo(
    () => consoleState?.oddterm.sessions.filter((session) => session.status === "live").length ?? 0,
    [consoleState],
  );

  const collapsedSummary =
    sessionCount === 0
      ? "No local operator shells are active for this workspace yet."
      : `${sessionCount} local shell${sessionCount === 1 ? "" : "s"}${liveCount ? ` · ${liveCount} live` : ""}.`;

  if (collapsed) {
    return (
      <section
        className={`panel panel--terminal-workspace is-collapsed${pinned ? " is-pinned" : ""}`}
        id="terminal-workspace-widget"
      >
        <div className="terminal-workspace__collapsed-strip">
          <div className="terminal-workspace__collapsed-copy">
            <span className="panel__eyebrow">Local Shell Workspace</span>
            <strong>{collapsedSummary}</strong>
          </div>

          <div className="terminal-workspace__collapsed-meta">
            <span className="summary-pill summary-pill--view">{selectedTrainId}</span>
            <span className="summary-pill">{sessionCount} shell(s)</span>
            {selectedStationId ? <span className="summary-pill">{selectedStationId}</span> : null}
            {selectedEdgeId ? <span className="summary-pill">{selectedEdgeId}</span> : null}
          </div>

          <div className="terminal-workspace__actions">
            <button
              type="button"
              className={`navigator-mode-toggle${pinned ? " is-active" : ""}`}
              onClick={() => setPinned((current) => !current)}
              aria-pressed={pinned}
              aria-label={pinned ? "Unpin terminal workspace" : "Pin terminal workspace"}
              title={pinned ? "Unpin terminal workspace" : "Pin terminal workspace"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="terminal-workspace__icon">
                <path
                  d="M8 4h8l-2.5 5.5v3.5l2 2v1H8.5v-1l2-2V9.5L8 4Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 16v4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="navigator-mode-toggle"
              onClick={() => setCollapsed(false)}
              aria-expanded={false}
              aria-label="Expand terminal workspace"
              title="Expand terminal workspace"
            >
              ⌄
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`panel panel--terminal-workspace${pinned ? " is-pinned" : ""}`}
      id="terminal-workspace-widget"
    >
      <div className="panel__heading terminal-workspace__heading terminal-workspace__heading--compact">
        <div className="terminal-workspace__topline">
          <span className="panel__eyebrow">Local Shell Workspace</span>
          <div className="terminal-workspace__meta">
            <span className="summary-pill">{sessionCount} local shell(s)</span>
            <span className="summary-pill">{liveCount} live</span>
          </div>
          <div className="terminal-workspace__context-strip">
            <span className="summary-pill summary-pill--view">{selectedTrainId}</span>
            {selectedStationId ? <span className="summary-pill">{selectedStationId}</span> : null}
            {selectedEdgeId ? <span className="summary-pill">{selectedEdgeId}</span> : null}
          </div>
        </div>
        <div className="terminal-workspace__actions">
          <button
            type="button"
            className={`navigator-mode-toggle${pinned ? " is-active" : ""}`}
            onClick={() => setPinned((current) => !current)}
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin terminal workspace" : "Pin terminal workspace"}
            title={pinned ? "Unpin terminal workspace" : "Pin terminal workspace"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="terminal-workspace__icon">
              <path
                d="M8 4h8l-2.5 5.5v3.5l2 2v1H8.5v-1l2-2V9.5L8 4Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 16v4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="navigator-mode-toggle"
            onClick={() => setCollapsed(true)}
            aria-expanded={true}
            aria-label="Collapse terminal workspace"
            title="Collapse terminal workspace"
          >
            ⌃
          </button>
        </div>
      </div>

      {error ? <p className="terminal-workspace__error">{error}</p> : null}

      {!consoleState && loading ? (
        <div className="terminal-workspace__loading">
          <p className="muted">Loading local shell workspace…</p>
        </div>
      ) : (
        <OddTermPanel
          workspaceRoot={workspaceRoot}
          selectedTrainId={selectedTrainId}
          selectedStationId={selectedStationId}
          selectedEdgeId={selectedEdgeId}
          gterm={consoleState?.oddterm ?? null}
          topics={consoleState?.oddchat.topics ?? []}
          onRefreshConsole={onRefreshConsole}
        />
      )}
    </section>
  );
}
