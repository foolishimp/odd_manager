import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { loadProjectRegistry } from "../lib/collaboration";
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
      .then((registry) => {
        if (cancelled) return;
        const activeProject = registry.projects.find((project) => project.is_active);
        const registryDefault = activeProject?.root || registry.diagnostic.manager_workspace_root || workspaceRoot;
        if (registryDefault && registryDefault !== workspaceRoot) {
          setWorkspaceRoot(registryDefault);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
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
      <WorkspaceRoute
        workspaceRoot={workspaceRoot}
        onProjectRootChange={handleApplyWorkspace}
      />
    </AppShell>
  );
}
