import { useState, type PropsWithChildren } from "react";
import type { CommandName, Overview, PageId, ThemeMode } from "../lib/types";
import { ProjectSelector } from "../features/project-selector/ProjectSelector";

type AppShellProps = PropsWithChildren<{
  theme: ThemeMode;
  onToggleTheme: () => void;
  workspaceRoot: string;
  workspaceDraft: string;
  onWorkspaceDraftChange: (value: string) => void;
  onApplyWorkspace: (nextWorkspaceRoot?: string) => void;
  selectedPage: PageId;
  onSelectPage: (page: PageId) => void;
  overview: Overview | null;
  loadingWorld: boolean;
  runningCommand: CommandName | null;
  error: string | null;
}>;

const PAGES: Array<{ id: PageId; label: string }> = [
  { id: "home", label: "Home" },
  { id: "graphs", label: "Graphs" },
  { id: "runtime", label: "Runtime" },
  { id: "continuations", label: "Continuations" },
  { id: "evidence", label: "Evidence & Policy" },
  { id: "builder", label: "Builder" },
  { id: "provenance", label: "Provenance" },
];

export function AppShell({
  theme,
  onToggleTheme,
  workspaceRoot,
  workspaceDraft,
  onWorkspaceDraftChange,
  onApplyWorkspace,
  selectedPage,
  onSelectPage,
  overview,
  loadingWorld,
  runningCommand,
  error,
  children,
}: AppShellProps) {
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const statusLabel = overview ? overview.status : loadingWorld ? "pending" : "attention";
  const statusValue = overview ? overview.total_delta.toFixed(2) : loadingWorld ? "Loading" : "Ready";
  const statusDetail = overview?.headline ?? "Awaiting workspace projection";

  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__title">
          <div>
            <h1>Odd Manager</h1>
            <p>
              Operator-facing supervision over graph sets, typed assets, workorders,
              and ABG runtime truth, composed with odd_method domain overlays.
            </p>
          </div>
        </div>

        <div className="shell__control-strip">
          <button
            type="button"
            className="shell__control-card shell__control-card--button"
            onClick={() => setWorkspacePickerOpen((current) => !current)}
            aria-expanded={workspacePickerOpen}
            aria-label="Open workspace selector"
            title="Open workspace selector"
          >
            <span className="shell__control-label">Managed Workspace</span>
            <strong>{workspaceRoot}</strong>
            <small>Click to change workspace</small>
          </button>

          <div className="shell__control-card shell__control-card--status">
            <span className="shell__control-label">Workspace Status</span>
            <strong className={statusLabel === "blocked" ? "is-warning" : ""}>{statusValue}</strong>
            <small>{statusDetail}</small>
          </div>

          <div className="shell__control-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => onApplyWorkspace()}
              disabled={loadingWorld || !!runningCommand || workspaceDraft.trim() === ""}
            >
              Apply
            </button>
            <button
              type="button"
              className="secondary shell__icon-button"
              onClick={onToggleTheme}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="shell__icon-svg">
                <path
                  d="M9 18h6m-5 3h4m-6.5-6.2A6.5 6.5 0 1 1 18.5 10c0 2.1-1 3.5-2.1 4.8-.8.9-1.4 1.7-1.6 2.7h-5.6c-.2-1-.8-1.8-1.6-2.7C6.5 13.5 5.5 12.1 5.5 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <nav className="manager-nav" aria-label="Manager surfaces">
          {PAGES.map((page) => (
            <button
              key={page.id}
              type="button"
              className={`manager-nav__item ${selectedPage === page.id ? "is-selected" : ""}`}
              onClick={() => onSelectPage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>

        {workspacePickerOpen ? (
          <div className="shell__workspace-picker" role="dialog" aria-label="Workspace selector">
            <ProjectSelector
              currentWorkspaceRoot={workspaceRoot}
              workspaceDraft={workspaceDraft}
              onWorkspaceDraftChange={onWorkspaceDraftChange}
              onApplyWorkspace={(nextWorkspaceRoot) => {
                onApplyWorkspace(nextWorkspaceRoot);
                setWorkspacePickerOpen(false);
              }}
              onClose={() => setWorkspacePickerOpen(false)}
              disabled={loadingWorld || !!runningCommand}
            />
          </div>
        ) : null}

        {error ? <div className="shell__error">{error}</div> : null}
      </header>

      {children}
    </div>
  );
}
