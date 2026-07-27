import { loadProjectRegistry, setActiveProject } from "../../lib/collaboration";
import type { AppShellMessage } from "./messages";
import {
  DEFAULT_WORKSPACE,
  THEME_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  type AppShellCommand,
} from "./state";
import { activatedProjectMatches, projectUrl } from "./url";

function errorMessage(caught: unknown) {
  return caught instanceof Error ? caught.message : String(caught);
}

export async function interpretAppShellCommand(command: AppShellCommand): Promise<AppShellMessage | null> {
  try {
    if (command.type === "shell.load-preferences") {
      const workspaceRoot = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)?.trim() || DEFAULT_WORKSPACE;
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      return {
        type: "shell.preferences-loaded",
        commandId: command.commandId,
        workspaceRoot,
        theme: storedTheme === "dark" || storedTheme === "dark-grey" ? storedTheme : "light",
      };
    }
    if (command.type === "shell.load-registry") {
      return {
        type: "shell.registry-loaded",
        commandId: command.commandId,
        registry: await loadProjectRegistry(),
      };
    }
    if (command.type === "shell.activate-project") {
      const result = await setActiveProject(command.projectId, { registerIfMissing: false });
      if (!activatedProjectMatches(command, result.project)) {
        throw new Error(
          `Activated Project does not match requested target: expected ${command.projectId} at ${command.projectRoot}, received ${result.project.id} at ${result.project.root}.`,
        );
      }
      return {
        type: "shell.project-activated",
        commandId: command.commandId,
        projectId: result.project.id,
        projectRoot: result.project.root,
      };
    }
    if (command.type === "shell.apply-theme") {
      document.documentElement.dataset.theme = command.theme;
      document.documentElement.style.colorScheme = command.theme === "light" ? "light" : "dark";
      return {
        type: "shell.command-succeeded",
        commandId: command.commandId,
        commandType: command.type,
      };
    }
    if (command.type === "shell.persist-theme") {
      window.localStorage.setItem(THEME_STORAGE_KEY, command.theme);
      return {
        type: "shell.command-succeeded",
        commandId: command.commandId,
        commandType: command.type,
      };
    }
    if (command.type === "shell.persist-workspace") {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, command.workspaceRoot);
      return {
        type: "shell.command-succeeded",
        commandId: command.commandId,
        commandType: command.type,
      };
    }
    if (command.type === "shell.replace-project-url") {
      const nextUrl = projectUrl(window.location.href, command.workspaceRoot);
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextUrl !== currentUrl) {
        window.history.replaceState(window.history.state, "", nextUrl);
      }
      return {
        type: "shell.command-succeeded",
        commandId: command.commandId,
        commandType: command.type,
      };
    }
    return null;
  } catch (caught) {
    const error = errorMessage(caught);
    return command.type === "shell.activate-project"
      ? {
          type: "shell.project-activation-failed",
          commandId: command.commandId,
          error,
        }
      : {
          type: "shell.command-failed",
          commandId: command.commandId,
          commandType: command.type,
          error,
        };
  }
}
