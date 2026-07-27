import { useCallback, useEffect, useReducer } from "react";
import { AppShell } from "../layout/AppShell";
import { projectDisplayNameFromRoot } from "../lib/projectDisplay";
import { WorkspaceRoute } from "../routes/WorkspaceRoute";
import { interpretAppShellCommand } from "./shell/effect-runtime";
import type { AppShellMessage } from "./shell/messages";
import { createAppShellState, type AppShellState } from "./shell/state";
import { updateAppShell } from "./shell/update";

function appShellReducer(state: AppShellState, message: AppShellMessage): AppShellState {
  const result = updateAppShell(state, message);
  return result.commands.length === 0
    ? result.state
    : { ...result.state, pendingCommands: [...result.state.pendingCommands, ...result.commands] };
}

export function App() {
  const [state, dispatch] = useReducer(appShellReducer, undefined, createAppShellState);
  const handleProjectRootChange = useCallback((workspaceRoot: string) => {
    dispatch({ type: "shell.workspace-requested", workspaceRoot });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    dispatch({
      type: "shell.browser-ready",
      search: window.location.search,
    });
  }, []);

  useEffect(() => {
    if (state.pendingCommands.length === 0) return;
    const commands = state.pendingCommands;
    dispatch({ type: "shell.commands-drained", commandIds: commands.map((command) => command.commandId) });
    for (const command of commands) {
      void interpretAppShellCommand(command).then((message) => {
        if (message) dispatch(message);
      });
    }
  }, [state.pendingCommands]);

  const shellTitle = projectDisplayNameFromRoot(state.workspaceRoot);
  const shellSubtitle = state.workspaceRoot || "No active project";

  return (
    <AppShell
      theme={state.theme}
      onToggleTheme={() => dispatch({ type: "shell.theme-toggle-requested" })}
      shellTitle={shellTitle}
      shellSubtitle={shellSubtitle}
      error={state.error}
    >
      {state.workspaceReady ? (
        <WorkspaceRoute
          workspaceRoot={state.workspaceRoot}
          initialSurface={state.initialSurface}
          initialRunFocus={state.initialRunFocus}
          onProjectRootChange={handleProjectRootChange}
        />
      ) : (
        <main className="route-wrap" aria-busy="true" aria-label="Resolving Project context" />
      )}
    </AppShell>
  );
}
