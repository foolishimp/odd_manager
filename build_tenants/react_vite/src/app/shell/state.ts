import type { ThemeMode } from "../../lib/types";

export const DEFAULT_WORKSPACE = "";
export const WORKSPACE_STORAGE_KEY = "oman-workspace-root";
export const THEME_STORAGE_KEY = "oman-theme";

export type AppShellSurface = "project-workbench" | "ai-workspace" | "run-inspector" | "ticket-board";

export type AppShellRunFocus = {
  projectRoot: string;
  executionId: string;
  runRef: string | null;
  revision: string;
  sourceRef: string;
};

export type AppShellCommand =
  | { commandId: string; type: "shell.load-preferences" }
  | { commandId: string; type: "shell.load-registry" }
  | {
      commandId: string;
      type: "shell.activate-project";
      projectId: string;
      projectRoot: string;
    }
  | { commandId: string; type: "shell.apply-theme"; theme: ThemeMode }
  | { commandId: string; type: "shell.persist-theme"; theme: ThemeMode }
  | { commandId: string; type: "shell.persist-workspace"; workspaceRoot: string }
  | {
      commandId: string;
      type: "shell.replace-project-url";
      workspaceRoot: string;
    };

export type AppShellCommandType = AppShellCommand["type"];
export type AppShellSideEffectCommandType = Extract<
  AppShellCommand,
  {
    type:
      | "shell.apply-theme"
      | "shell.persist-theme"
      | "shell.persist-workspace"
      | "shell.replace-project-url";
  }
>["type"];

type WithoutCommandId<Command> = Command extends unknown ? Omit<Command, "commandId"> : never;

export type AppShellCommandInput = WithoutCommandId<AppShellCommand>;

export type AppShellState = {
  workspaceRoot: string;
  workspaceReady: boolean;
  initialSurface: AppShellSurface | null;
  initialRunFocus: AppShellRunFocus | null;
  error: string | null;
  theme: ThemeMode;
  currentSearch: string;
  fallbackWorkspaceRoot: string;
  preferencesCommandId: string | null;
  registryCommandId: string | null;
  activationWorkspaceRoot: string | null;
  activationCommandId: string | null;
  pendingCommands: AppShellCommand[];
  inFlightCommands: AppShellCommand[];
  commandSequence: number;
};

export function createAppShellState(): AppShellState {
  return {
    workspaceRoot: DEFAULT_WORKSPACE,
    workspaceReady: false,
    initialSurface: null,
    initialRunFocus: null,
    error: null,
    theme: "light",
    currentSearch: "",
    fallbackWorkspaceRoot: DEFAULT_WORKSPACE,
    preferencesCommandId: null,
    registryCommandId: null,
    activationWorkspaceRoot: null,
    activationCommandId: null,
    pendingCommands: [],
    inFlightCommands: [],
    commandSequence: 0,
  };
}
