import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import type {
  CommandName,
  Overview,
  PageId,
  ThemeMode,
  WorkspaceProfile,
} from "../lib/types";
import { ProjectSelector } from "../features/project-selector/ProjectSelector";
import {
  ACTIVE_VOCABULARY_PACK,
  domainPagesForWorkspaceProfile,
  labelPage,
  labelTone,
  labelWorkspaceIdentity,
} from "../lib/presentation";

type AppShellProps = PropsWithChildren<{
  theme: ThemeMode;
  onToggleTheme: () => void;
  workspaceRoot: string;
  workspaceDraft: string;
  onWorkspaceDraftChange: (value: string) => void;
  onApplyWorkspace: (nextWorkspaceRoot?: string) => void;
  shellTitle: string;
  shellSubtitle: string;
  workspaceProfile: WorkspaceProfile | null;
  pages: PageId[];
  selectedPage: PageId;
  onSelectPage: (page: PageId) => void;
  overview: Overview | null;
  loadingWorld: boolean;
  runningCommand: CommandName | null;
  error: string | null;
}>;

export function AppShell({
  theme,
  onToggleTheme,
  workspaceRoot,
  workspaceDraft,
  onWorkspaceDraftChange,
  onApplyWorkspace,
  shellTitle,
  shellSubtitle,
  workspaceProfile,
  pages,
  selectedPage,
  onSelectPage,
  overview,
  loadingWorld,
  runningCommand,
  error,
  children,
}: AppShellProps) {
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const workspacePickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspacePickerRef = useRef<HTMLDivElement | null>(null);
  const statusLabel = overview ? overview.status : loadingWorld ? "pending" : "attention";
  const statusValue = overview ? overview.total_delta.toFixed(2) : loadingWorld ? "Loading" : "Ready";
  const statusDetail = overview?.headline ?? "Awaiting workspace projection";
  const domainPages = domainPagesForWorkspaceProfile(workspaceProfile);
  const corePages = pages.filter((page) => !domainPages.includes(page));
  const activeDomainLabel = labelWorkspaceIdentity(workspaceProfile?.active_domain_pack ?? workspaceProfile?.primary_identity);
  const governanceLabels = workspaceProfile?.governance_identities
    .map((identity) => labelWorkspaceIdentity(identity))
    .filter((value, index, values) => values.indexOf(value) === index);
  const isSidecarPage = selectedPage === "sidecar";
  const themeToggleLabel = theme === "light"
    ? "Switch to dark grey mode"
    : theme === "dark-grey"
      ? "Switch to dark blue mode"
      : "Switch to light mode";

  useEffect(() => {
    if (!workspacePickerOpen) return undefined;
    function closeOnOutsidePointer(event: globalThis.PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (workspacePickerRef.current?.contains(target)) return;
      if (workspacePickerButtonRef.current?.contains(target)) return;
      setWorkspacePickerOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [workspacePickerOpen]);

  return (
    <div className={`shell${isSidecarPage ? " shell--sidecar" : ""}`}>
      <header className="shell__header">
        <div className="shell__title">
          <div>
            <span className="shell__control-label">{activeDomainLabel}</span>
            <h1>{shellTitle}</h1>
            <p>{shellSubtitle}</p>
            {workspaceProfile ? (
              <div className="inline-pills shell__identity-pills">
                <span className="status-chip converged">
                  Primary {labelWorkspaceIdentity(workspaceProfile.primary_identity)}
                </span>
                {governanceLabels?.map((label) => (
                  <span key={label} className="status-chip attention">
                    Governance {label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="shell__control-strip">
          {isSidecarPage ? null : (
            <button
              ref={workspacePickerButtonRef}
              type="button"
              className="shell__control-card shell__control-card--button"
              onClick={() => setWorkspacePickerOpen((current) => !current)}
              aria-expanded={workspacePickerOpen}
              aria-label="Open workspace selector"
              title="Open workspace selector"
            >
              <span className="shell__control-label">Project Root</span>
              <strong>{workspaceRoot}</strong>
              <small>Click to change project</small>
            </button>
          )}

          <div className="shell__control-card shell__control-card--status">
            <span className="shell__control-label">Workspace Status</span>
            <strong className={statusLabel === "blocked" ? "is-warning" : ""}>{statusValue}</strong>
            <small>
              {labelTone(statusLabel)}: {statusDetail}
            </small>
          </div>

          <div className="shell__control-actions">
            <button
              type="button"
              className="secondary shell__icon-button"
              onClick={onToggleTheme}
              title={themeToggleLabel}
              aria-label={themeToggleLabel}
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
          {domainPages.length ? (
            <span className="manager-nav__divider">
              {activeDomainLabel}
            </span>
          ) : null}
          {domainPages.map((page) => (
            <button
              key={page}
              type="button"
              className={`manager-nav__item ${selectedPage === page ? "is-selected" : ""}`}
              onClick={() => onSelectPage(page)}
            >
              {labelPage(page)}
            </button>
          ))}
          {corePages.length ? <span className="manager-nav__divider">Core Pages</span> : null}
          {corePages.map((page) => (
            <button
              key={page}
              type="button"
              className={`manager-nav__item ${selectedPage === page ? "is-selected" : ""}`}
              onClick={() => onSelectPage(page)}
            >
              {labelPage(page)}
            </button>
          ))}
        </nav>

        {workspacePickerOpen && !isSidecarPage ? (
          <div ref={workspacePickerRef} className="shell__workspace-picker" role="dialog" aria-label="Workspace selector">
            <ProjectSelector
              currentWorkspaceRoot={workspaceRoot}
              workspaceDraft={workspaceDraft}
              onWorkspaceDraftChange={onWorkspaceDraftChange}
              onApplyWorkspace={(nextWorkspaceRoot) => {
                onApplyWorkspace(nextWorkspaceRoot);
                setWorkspacePickerOpen(false);
              }}
              onClose={() => setWorkspacePickerOpen(false)}
              disabled={!!runningCommand}
            />
          </div>
        ) : null}

        {error ? <div className="shell__error">{error}</div> : null}
      </header>

      {children}
    </div>
  );
}
