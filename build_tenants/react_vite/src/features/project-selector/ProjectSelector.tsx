import { useEffect, useState } from "react";
import { FolderBrowser } from "./FolderBrowser";
import { scanForOddWorkspaces } from "../../lib/collaboration";
import type { WorkspaceReference, WorkspaceScanResult } from "../../lib/collaboration";

type ProjectSelectorProps = {
  currentWorkspaceRoot: string;
  workspaceDraft: string;
  onWorkspaceDraftChange: (value: string) => void;
  onApplyWorkspace: (nextWorkspaceRoot?: string) => void;
  onClose: () => void;
  disabled?: boolean;
};

type SelectorTab = "recent" | "browse" | "manual";

const RECENT_WORKSPACES_KEY = "oman-recent-workspaces";
const MAX_RECENT_WORKSPACES = 8;

function workspaceNameFromPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function loadRecentWorkspaces(): WorkspaceReference[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_WORKSPACES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as WorkspaceReference[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentWorkspaces(entries: WorkspaceReference[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_WORKSPACES)));
}

export function ProjectSelector({
  currentWorkspaceRoot,
  workspaceDraft,
  onWorkspaceDraftChange,
  onApplyWorkspace,
  onClose,
  disabled = false,
}: ProjectSelectorProps) {
  const [tab, setTab] = useState<SelectorTab>("recent");
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceReference[]>([]);
  const [browseRoot, setBrowseRoot] = useState(() => workspaceDraft || currentWorkspaceRoot);
  const [scanResults, setScanResults] = useState<WorkspaceScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    const recent = loadRecentWorkspaces();
    const currentWorkspace = {
      name: workspaceNameFromPath(currentWorkspaceRoot),
      path: currentWorkspaceRoot,
    };
    const merged = [currentWorkspace, ...recent.filter((entry) => entry.path !== currentWorkspaceRoot)];
    saveRecentWorkspaces(merged);
    setRecentWorkspaces(merged);
  }, [currentWorkspaceRoot]);

  useEffect(() => {
    setBrowseRoot(currentWorkspaceRoot);
    setScanResults([]);
    setScanError(null);
  }, [currentWorkspaceRoot]);

  function rememberWorkspace(path: string) {
    const next = [
      { name: workspaceNameFromPath(path), path },
      ...recentWorkspaces.filter((entry) => entry.path !== path),
    ];
    saveRecentWorkspaces(next);
    setRecentWorkspaces(next);
  }

  function openWorkspace(path: string) {
    onWorkspaceDraftChange(path);
    rememberWorkspace(path);
    onApplyWorkspace(path);
    onClose();
  }

  async function handleScan() {
    const root = browseRoot.trim();
    if (!root) {
      setScanError("Browse to a folder before scanning.");
      setScanResults([]);
      return;
    }

    setScanning(true);
    setScanError(null);
    try {
      const discovered = await scanForOddWorkspaces(root);
      setScanResults(discovered);
    } catch (caught) {
      setScanError(caught instanceof Error ? caught.message : String(caught));
      setScanResults([]);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="project-selector">
      <div className="shell__workspace-picker-heading">
        <div>
          <span className="shell__control-label">Project Selector</span>
          <strong>Open another managed workspace</strong>
        </div>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close project selector">
          Close
        </button>
      </div>

      <div className="project-selector__tabs" role="tablist" aria-label="Workspace selector views">
        {(["recent", "browse", "manual"] as SelectorTab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`project-selector__tab${tab === value ? " is-active" : ""}`}
            onClick={() => setTab(value)}
            disabled={disabled}
          >
            {value === "recent" ? "Recent" : value === "browse" ? "Browse" : "Manual"}
          </button>
        ))}
      </div>

      {tab === "recent" ? (
        <div className="project-selector__panel">
          <div className="project-selector__list">
            {recentWorkspaces.length === 0 ? (
              <div className="project-selector__empty">No recent workspaces yet. Browse to discover one.</div>
            ) : (
              recentWorkspaces.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className={`project-selector__workspace${entry.path === currentWorkspaceRoot ? " is-current" : ""}`}
                  onClick={() => openWorkspace(entry.path)}
                  disabled={disabled}
                >
                  <span className="project-selector__workspace-name">{entry.name}</span>
                  <span className="project-selector__workspace-path">{entry.path}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      {tab === "browse" ? (
        <div className="project-selector__panel">
          <FolderBrowser
            path={browseRoot}
            onSelectWorkspace={openWorkspace}
            disabled={disabled}
            onPathChange={(absolutePath) => {
              setBrowseRoot(absolutePath);
              setScanResults([]);
              setScanError(null);
            }}
          />
          <div className="shell__workspace-picker-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => setBrowseRoot(workspaceDraft || currentWorkspaceRoot)}
              disabled={disabled}
            >
              Reset Browse Root
            </button>
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={disabled || !browseRoot.trim()}
            >
              Scan This Folder For ODD Workspaces
            </button>
          </div>
          <div className="project-selector__list">
            {scanning ? <div className="project-selector__empty">Scanning {browseRoot}…</div> : null}
            {scanError ? <div className="project-selector__empty">{scanError}</div> : null}
            {!scanning && !scanError && scanResults.length === 0 ? (
              <div className="project-selector__empty">
                Browse to the folder you want, then scan it for ODD workspaces.
              </div>
            ) : null}
            {scanResults.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className={`project-selector__workspace${entry.path === currentWorkspaceRoot ? " is-current" : ""}`}
                onClick={() => openWorkspace(entry.path)}
                disabled={disabled || scanning}
              >
                <span className="project-selector__workspace-name">{entry.name}</span>
                <span className="project-selector__workspace-path">{entry.markers.join(" · ")}</span>
                <span className="project-selector__workspace-path">{entry.path}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "manual" ? (
        <div className="project-selector__panel project-selector__panel--manual">
          <input
            value={workspaceDraft}
            onChange={(event) => onWorkspaceDraftChange(event.target.value)}
            aria-label="Managed workspace root"
            disabled={disabled}
          />
          <div className="shell__workspace-picker-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => onWorkspaceDraftChange(currentWorkspaceRoot)}
              disabled={disabled}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => openWorkspace(workspaceDraft)}
              disabled={disabled || !workspaceDraft.trim()}
            >
              Open Workspace
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
