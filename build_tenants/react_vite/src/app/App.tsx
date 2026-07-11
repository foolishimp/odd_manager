import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { loadProjectRegistry, setActiveProject } from "../lib/collaboration";
import {
  parseProjectDeepLink,
  projectDeepLinkUrl,
  projectLandingSurface,
  registeredProjectForDeepLink,
} from "../lib/projectDeepLink";
import type { ProjectLandingSurface } from "../lib/projectDeepLink";
import { projectDisplayNameFromRoot } from "../lib/projectDisplay";
import type { ThemeMode } from "../lib/types";
import { WorkspaceRoute } from "../routes/WorkspaceRoute";

const DEFAULT_WORKSPACE = "";
const WORKSPACE_STORAGE_KEY = "oman-workspace-root";
const THEME_STORAGE_KEY = "oman-theme";

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "dark-grey" ? stored : "light";
}

function nextTheme(current: ThemeMode): ThemeMode {
  if (current === "light") {
    return "dark-grey";
  }
  if (current === "dark-grey") {
    return "dark";
  }
  return "light";
}

function initialWorkspace() {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE;
  }
  const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)?.trim();
  return stored || DEFAULT_WORKSPACE;
}

export function App() {
  const [workspaceRoot, setWorkspaceRoot] = useState(initialWorkspace);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [initialSurface, setInitialSurface] = useState<ProjectLandingSurface | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  function handleApplyWorkspace(nextWorkspaceRoot?: string) {
    const targetWorkspace = (nextWorkspaceRoot ?? "").trim();
    if (!targetWorkspace || targetWorkspace === workspaceRoot) {
      return;
    }
    setWorkspaceRoot(targetWorkspace);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    void loadProjectRegistry()
      .then(async (registry) => {
        if (cancelled) return;
        const activeProject = registry.projects.find((project) => project.is_active);
        const registryDefault = registry.diagnostic.active_project_root
          || activeProject?.root
          || registry.diagnostic.manager_workspace_root
          || workspaceRoot;

        const deepLink = parseProjectDeepLink(window.location.search);
        if (deepLink.state === "ready") {
          const linkedProject = registeredProjectForDeepLink(deepLink.projectRoot, registry.projects);
          if (linkedProject) {
            try {
              if (!linkedProject.is_active) {
                await setActiveProject(linkedProject.id, { registerIfMissing: false });
              }
              if (!cancelled) {
                setWorkspaceRoot(linkedProject.root);
                setInitialSurface(projectLandingSurface(window.location.search));
                setError(null);
              }
              return;
            } catch (caught) {
              if (!cancelled) {
                setError(caught instanceof Error ? caught.message : String(caught));
              }
            }
          } else {
            setError(`Project deep link is not registered: ${deepLink.projectRoot}`);
          }
        } else if (deepLink.state === "invalid") {
          setError(deepLink.error);
        }

        if (!cancelled && registryDefault && registryDefault !== workspaceRoot) {
          setWorkspaceRoot(registryDefault);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) setWorkspaceReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceRoot);
  }, [workspaceRoot]);

  useEffect(() => {
    if (!workspaceReady || !workspaceRoot) return;
    const nextUrl = projectDeepLinkUrl(window.location.href, workspaceRoot);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(window.history.state, "", nextUrl);
  }, [workspaceReady, workspaceRoot]);

  const shellTitle = projectDisplayNameFromRoot(workspaceRoot);
  const shellSubtitle = workspaceRoot || "No active project";

  return (
    <AppShell
      theme={theme}
      onToggleTheme={() => setTheme((current) => nextTheme(current))}
      shellTitle={shellTitle}
      shellSubtitle={shellSubtitle}
      error={error}
    >
      {workspaceReady ? (
        <WorkspaceRoute
          workspaceRoot={workspaceRoot}
          initialSurface={initialSurface}
          onProjectRootChange={handleApplyWorkspace}
        />
      ) : (
        <main className="route-wrap" aria-busy="true" aria-label="Resolving Project context" />
      )}
    </AppShell>
  );
}
