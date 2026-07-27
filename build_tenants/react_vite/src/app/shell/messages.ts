import type { ThemeMode } from "../../lib/types";
import type {
  AppShellCommandType,
  AppShellSideEffectCommandType,
} from "./state";

export type RegisteredProject = {
  id: string;
  root: string;
  is_active: boolean;
};

export type ProjectRegistry = {
  projects: RegisteredProject[];
  diagnostic: {
    active_project_root?: string | null;
    manager_workspace_root?: string | null;
  };
};

export type AppShellMessage =
  | { type: "shell.browser-ready"; search: string }
  | {
      type: "shell.preferences-loaded";
      commandId: string;
      workspaceRoot: string;
      theme: ThemeMode;
    }
  | { type: "shell.registry-loaded"; commandId: string; registry: ProjectRegistry }
  | {
      type: "shell.project-activated";
      commandId: string;
      projectId: string;
      projectRoot: string;
    }
  | {
      type: "shell.project-activation-failed";
      commandId: string;
      error: string;
    }
  | {
      type: "shell.command-succeeded";
      commandId: string;
      commandType: AppShellSideEffectCommandType;
    }
  | {
      type: "shell.command-failed";
      commandId: string;
      commandType: AppShellCommandType;
      error: string;
    }
  | { type: "shell.workspace-requested"; workspaceRoot: string }
  | { type: "shell.theme-toggle-requested" }
  | { type: "shell.commands-drained"; commandIds: string[] };
