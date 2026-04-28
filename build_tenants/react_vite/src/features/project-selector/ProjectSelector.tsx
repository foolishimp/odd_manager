import { labelWorkspaceIdentity } from "../../lib/presentation";
import { useCallback, useEffect, useState } from "react";
import { FolderBrowser } from "./FolderBrowser";
import {
  loadProjectRegistry,
  registerProject,
  scanForOddWorkspaces,
  setActiveProject,
  unregisterProject,
} from "../../lib/collaboration";
import type { WorkspaceScanResult } from "../../lib/collaboration";
import type { ProjectRecord, ProjectSurfaceDiagnostic } from "../../contracts/project";

type ProjectSelectorProps = {
  currentWorkspaceRoot: string;
  workspaceDraft: string;
  onWorkspaceDraftChange: (value: string) => void;
  onApplyWorkspace: (nextWorkspaceRoot?: string) => void;
  onClose: () => void;
  disabled?: boolean;
};

type SelectorTab = "projects" | "browse" | "manual";
type BrowseMode = "folders" | "scan";

function workspaceNameFromPath(path: string) {
  const parts = path.split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}

function projectLabel(project: ProjectRecord) {
  return project.name || project.id || workspaceNameFromPath(project.root);
}

function candidateProfileLabel(entry: WorkspaceScanResult) {
  const identity = entry.profile?.primary_identity;
  return identity && identity !== "unknown" ? labelWorkspaceIdentity(identity) : entry.markers.join(" · ");
}

export function ProjectSelector({
  currentWorkspaceRoot,
  workspaceDraft,
  onWorkspaceDraftChange,
  onApplyWorkspace,
  onClose,
  disabled = false,
}: ProjectSelectorProps) {
  const [tab, setTab] = useState<SelectorTab>("projects");
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [diagnostic, setDiagnostic] = useState<ProjectSurfaceDiagnostic | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [browseRoot, setBrowseRoot] = useState(() => workspaceDraft || currentWorkspaceRoot);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("folders");
  const [scanResults, setScanResults] = useState<WorkspaceScanResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    setActionError(null);
    try {
      const registry = await loadProjectRegistry();
      setProjects(registry.projects);
      setDiagnostic(registry.diagnostic);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
      setProjects([]);
      setDiagnostic(null);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    setBrowseRoot(currentWorkspaceRoot);
    setBrowseMode("folders");
    setScanResults([]);
    setScanError(null);
  }, [currentWorkspaceRoot]);

  async function activateProject(project: ProjectRecord) {
    setActionError(null);
    setActionStatus(null);
    try {
      const result = await setActiveProject(project.id);
      setProjects(result.projects);
      setDiagnostic(result.diagnostic);
      onWorkspaceDraftChange(result.project.root);
      onApplyWorkspace(result.project.root);
      onClose();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function addProject(path: string) {
    const root = path.trim();
    if (!root) {
      setActionError("Project root is required.");
      return;
    }
    setActionError(null);
    setActionStatus(null);
    try {
      const result = await registerProject(root, { setActive: false });
      setProjects(result.projects);
      setDiagnostic(result.diagnostic);
      setActionStatus(`Added ${projectLabel(result.project)}.`);
      onWorkspaceDraftChange(result.project.root);
      setTab("projects");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function removeProject(project: ProjectRecord) {
    setActionError(null);
    setActionStatus(null);
    try {
      const result = await unregisterProject(project.id);
      setProjects(result.projects);
      setDiagnostic(result.diagnostic);
      setActionStatus(`Removed ${projectLabel(project)}.`);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    }
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
      setBrowseMode("scan");
    } catch (caught) {
      setScanError(caught instanceof Error ? caught.message : String(caught));
      setScanResults([]);
      setBrowseMode("scan");
    } finally {
      setScanning(false);
    }
  }

  const hasScanState = scanning || !!scanError || scanResults.length > 0;
  const currentRegistered = projects.some((project) => project.root === currentWorkspaceRoot);

  return (
    <div className="project-selector">
      <div className="shell__workspace-picker-heading">
        <div>
          <span className="shell__control-label">Workspace Tool</span>
          <strong>Manage Projects in this workspace</strong>
        </div>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close project selector">
          Close
        </button>
      </div>

      <div className="project-selector__tabs" role="tablist" aria-label="Workspace selector views">
        {(["projects", "browse", "manual"] as SelectorTab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`project-selector__tab${tab === value ? " is-active" : ""}`}
            onClick={() => setTab(value)}
            disabled={disabled}
          >
            {value === "projects" ? "Projects" : value === "browse" ? "Browse" : "Manual"}
          </button>
        ))}
      </div>

      {actionError ? <div className="project-selector__empty">{actionError}</div> : null}
      {actionStatus ? <div className="project-selector__empty">{actionStatus}</div> : null}

      {tab === "projects" ? (
        <div className="project-selector__panel">
          <div className="project-selector__browse-summary">
            <strong>Projects are maintained in the manager workspace.</strong>
            <p>
              Browse, scan, or manual entry discovers a path. Add registers it here; Open makes it the active managed Project.
            </p>
            {diagnostic?.registry_root ? <p>{diagnostic.registry_root}</p> : null}
          </div>
          {!currentRegistered ? (
            <div className="shell__workspace-picker-actions">
              <button
                type="button"
                onClick={() => void addProject(currentWorkspaceRoot)}
                disabled={disabled || loadingProjects}
              >
                Add Current Project
              </button>
            </div>
          ) : null}
          <div className="project-selector__list">
            {loadingProjects ? <div className="project-selector__empty">Loading Projects…</div> : null}
            {!loadingProjects && projects.length === 0 ? (
              <div className="project-selector__empty">No Projects have been added to this workspace yet.</div>
            ) : null}
            {projects.map((project) => {
              const isCurrent = project.root === currentWorkspaceRoot || project.is_active;
              const openLabel = isCurrent ? "Current" : "Open";
              const currentTitle = isCurrent ? "This Project is already active." : "Open this Project.";
              const removeTitle = isCurrent
                ? "Open another Project before removing this one."
                : "Remove this Project from the workspace registry.";
              return (
                <div
                  key={project.id}
                  className={`project-selector__workspace project-selector__workspace-card${isCurrent ? " is-current" : ""}`}
                >
                  <div className="project-selector__workspace-copy">
                    <span className="project-selector__workspace-name">{projectLabel(project)}</span>
                    <span className="project-selector__workspace-path">{project.root}</span>
                    <span className="project-selector__workspace-path">
                      {project.odd_type !== "unknown" ? project.odd_type : "unknown"} · {project.build_tenants.length} tenant{project.build_tenants.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="project-selector__workspace-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => void activateProject(project)}
                      title={currentTitle}
                      disabled={disabled || isCurrent}
                    >
                      {openLabel}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => void removeProject(project)}
                      title={removeTitle}
                      disabled={disabled || isCurrent}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "browse" ? (
        <div className="project-selector__panel">
          <div className="project-selector__browse-mode" role="tablist" aria-label="Browse view mode">
            <button
              type="button"
              role="tab"
              aria-selected={browseMode === "folders"}
              className={`project-selector__tab${browseMode === "folders" ? " is-active" : ""}`}
              onClick={() => setBrowseMode("folders")}
              disabled={disabled}
            >
              Folder Contents
            </button>
            {hasScanState ? (
              <button
                type="button"
                role="tab"
                aria-selected={browseMode === "scan"}
                className={`project-selector__tab${browseMode === "scan" ? " is-active" : ""}`}
                onClick={() => setBrowseMode("scan")}
                disabled={disabled}
              >
                {scanning ? "Scan Results" : `Scan Results${scanResults.length ? ` (${scanResults.length})` : ""}`}
              </button>
            ) : null}
          </div>

          {browseMode === "folders" ? (
            <>
              <div className="project-selector__browse-summary">
                <strong>Browse to a Project root and add it to the maintained list.</strong>
                <p>The folder list shows only the current directory. Recursive scan results appear in a separate view.</p>
              </div>
              <FolderBrowser
                path={browseRoot}
                onSelectWorkspace={(absolutePath) => void addProject(absolutePath)}
                disabled={disabled}
                selectLabel="Add"
                onPathChange={(absolutePath) => {
                  setBrowseRoot(absolutePath);
                  setBrowseMode("folders");
                  setScanResults([]);
                  setScanError(null);
                }}
              />
            </>
          ) : (
            <div className="project-selector__scan-results">
              <div className="project-selector__browse-summary">
                <strong>Project candidates found under {browseRoot}</strong>
                <p>
                  These are recursive scan results under the current browse root. Add registers a candidate in the maintained Project list.
                </p>
              </div>
              <div className="project-selector__list">
                {scanning ? <div className="project-selector__empty">Scanning {browseRoot}…</div> : null}
                {scanError ? <div className="project-selector__empty">{scanError}</div> : null}
                {!scanning && !scanError && scanResults.length === 0 ? (
                  <div className="project-selector__empty">
                    No Project candidates were found under this folder.
                  </div>
                ) : null}
                {scanResults.map((entry) => (
                  <div key={entry.path} className="project-selector__workspace project-selector__workspace-card">
                    <div className="project-selector__workspace-copy">
                      <span className="project-selector__workspace-name">{entry.name}</span>
                      <span className="project-selector__workspace-path">{candidateProfileLabel(entry)}</span>
                      <span className="project-selector__workspace-path">{entry.path}</span>
                    </div>
                    <div className="project-selector__workspace-actions">
                      <button
                        type="button"
                        onClick={() => void addProject(entry.path)}
                        disabled={disabled || scanning}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="shell__workspace-picker-actions">
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setBrowseRoot(workspaceDraft || currentWorkspaceRoot);
                setBrowseMode("folders");
                setScanResults([]);
                setScanError(null);
              }}
              disabled={disabled}
            >
              Reset Browse Root
            </button>
            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={disabled || !browseRoot.trim()}
            >
              Scan Under This Folder
            </button>
          </div>
        </div>
      ) : null}

      {tab === "manual" ? (
        <div className="project-selector__panel project-selector__panel--manual">
          <input
            value={workspaceDraft}
            onChange={(event) => onWorkspaceDraftChange(event.target.value)}
            aria-label="Managed project root"
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
              onClick={() => void addProject(workspaceDraft)}
              disabled={disabled || !workspaceDraft.trim()}
            >
              Add Project
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
