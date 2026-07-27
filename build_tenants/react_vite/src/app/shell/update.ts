import type { ThemeMode } from "../../lib/types";
import type { AppShellMessage, ProjectRegistry, RegisteredProject } from "./messages";
import type {
  AppShellCommand,
  AppShellCommandInput,
  AppShellRunFocus,
  AppShellState,
  AppShellSurface,
} from "./state";

export type AppShellUpdate = {
  state: AppShellState;
  commands: AppShellCommand[];
};

type ParsedDeepLink =
  | { state: "absent" }
  | { state: "invalid"; error: string }
  | { state: "ready"; projectRoot: string };

function normalizeProjectRoot(value: string) {
  const trimmed = value.trim();
  return trimmed === "/" ? trimmed : trimmed.replace(/\/+$/, "");
}

function parseDeepLink(search: string): ParsedDeepLink {
  const values = new URLSearchParams(search).getAll("project");
  if (values.length === 0) return { state: "absent" };
  if (values.length > 1) return { state: "invalid", error: "Project deep link must contain one project path." };
  const projectRoot = normalizeProjectRoot(values[0] ?? "");
  if (!projectRoot) return { state: "invalid", error: "Project deep link path is empty." };
  if (!projectRoot.startsWith("/") || projectRoot.includes("\0") || projectRoot.length > 4096) {
    return { state: "invalid", error: "Project deep link must be an absolute local path." };
  }
  return { state: "ready", projectRoot };
}

function landingSurface(search: string): AppShellSurface {
  const requested = new URLSearchParams(search).get("view");
  return requested === "ai-workspace" || requested === "run-inspector" || requested === "ticket-board"
    ? requested
    : "project-workbench";
}

function boundedParameter(parameters: URLSearchParams, name: string, maxLength = 4096) {
  const values = parameters.getAll(name);
  if (values.length !== 1) return null;
  const value = values[0]?.trim() ?? "";
  return value && value.length <= maxLength && !value.includes("\0") ? value : null;
}

function runFocus(search: string, projectRoot: string): AppShellRunFocus | null {
  const parameters = new URLSearchParams(search);
  const executionId = boundedParameter(parameters, "execution", 512);
  const revision = boundedParameter(parameters, "revision", 512);
  const sourceRef = boundedParameter(parameters, "source");
  if (!executionId || !revision || !sourceRef) return null;
  return {
    projectRoot: normalizeProjectRoot(projectRoot),
    executionId,
    runRef: boundedParameter(parameters, "runRef"),
    revision,
    sourceRef,
  };
}

function nextTheme(current: ThemeMode): ThemeMode {
  if (current === "light") return "dark-grey";
  if (current === "dark-grey") return "dark";
  return "light";
}

function appendCommands(state: AppShellState, commands: AppShellCommandInput[]): AppShellUpdate {
  const commandSequence = state.commandSequence + commands.length;
  const materialized = commands.map((command, index) => ({
    ...command,
    commandId: `app-shell-${state.commandSequence + index + 1}`,
  })) as AppShellCommand[];
  return {
    state: {
      ...state,
      commandSequence,
      inFlightCommands: [...state.inFlightCommands, ...materialized],
    },
    commands: materialized,
  };
}

function commandForResult<CommandType extends AppShellCommand["type"]>(
  state: AppShellState,
  commandId: string,
  commandType: CommandType,
): Extract<AppShellCommand, { type: CommandType }> | null {
  return (
    state.inFlightCommands.find(
      (command) => command.commandId === commandId && command.type === commandType,
    ) as Extract<AppShellCommand, { type: CommandType }> | undefined
  ) ?? null;
}

function retireCommand(state: AppShellState, commandId: string) {
  return {
    ...state,
    inFlightCommands: state.inFlightCommands.filter(
      (command) => command.commandId !== commandId,
    ),
  };
}

function retireActivation(state: AppShellState) {
  if (!state.activationCommandId) return state;
  return retireCommand(state, state.activationCommandId);
}

function projectUrlCommand(workspaceRoot: string): AppShellCommandInput[] {
  return workspaceRoot
    ? [{
        type: "shell.replace-project-url",
        workspaceRoot: normalizeProjectRoot(workspaceRoot),
      }]
    : [];
}

function readyState(state: AppShellState, workspaceRoot: string, error: string | null, surface = state.initialSurface, focus = state.initialRunFocus): AppShellUpdate {
  const rootChanged = state.workspaceRoot !== workspaceRoot;
  const next = {
    ...retireActivation(state),
    workspaceRoot,
    workspaceReady: true,
    initialSurface: surface,
    initialRunFocus: focus,
    error,
    preferencesCommandId: null,
    registryCommandId: null,
    activationWorkspaceRoot: null,
    activationCommandId: null,
  };
  const commands: AppShellCommandInput[] = rootChanged
    ? [{ type: "shell.persist-workspace", workspaceRoot }]
    : [];
  return appendCommands(next, [...commands, ...projectUrlCommand(workspaceRoot)]);
}

function registryFallback(registry: ProjectRegistry, workspaceRoot: string) {
  const active = registry.projects.find((project) => project.is_active);
  return registry.diagnostic.active_project_root
    || active?.root
    || registry.diagnostic.manager_workspace_root
    || workspaceRoot;
}

function matchingProject(projectRoot: string, projects: RegisteredProject[]) {
  const normalized = normalizeProjectRoot(projectRoot);
  return projects.find((project) => normalizeProjectRoot(project.root) === normalized) ?? null;
}

export function updateAppShell(state: AppShellState, message: AppShellMessage): AppShellUpdate {
  if (message.type === "shell.commands-drained") {
    const drained = new Set(message.commandIds);
    return { state: { ...state, pendingCommands: state.pendingCommands.filter((command) => !drained.has(command.commandId)) }, commands: [] };
  }
  if (message.type === "shell.browser-ready") {
    const previousBootstrapIds = new Set([
      state.preferencesCommandId,
      state.registryCommandId,
    ].filter((commandId): commandId is string => Boolean(commandId)));
    const requested = appendCommands({
      ...state,
      currentSearch: message.search,
      preferencesCommandId: null,
      registryCommandId: null,
      inFlightCommands: state.inFlightCommands.filter(
        (command) => !previousBootstrapIds.has(command.commandId),
      ),
    }, [
      { type: "shell.load-preferences" },
    ]);
    return {
      ...requested,
      state: {
        ...requested.state,
        preferencesCommandId: requested.commands[0]?.commandId ?? null,
      },
    };
  }
  if (message.type === "shell.preferences-loaded") {
    const command = commandForResult(
      state,
      message.commandId,
      "shell.load-preferences",
    );
    if (
      !command
      || !state.preferencesCommandId
      || message.commandId !== state.preferencesCommandId
    ) return { state, commands: [] };
    const next = {
      ...retireCommand(state, message.commandId),
      workspaceRoot: message.workspaceRoot,
      theme: message.theme,
      preferencesCommandId: null,
      registryCommandId: null,
    };
    const requested = appendCommands(next, [
      { type: "shell.apply-theme", theme: message.theme },
      { type: "shell.persist-theme", theme: message.theme },
      { type: "shell.persist-workspace", workspaceRoot: message.workspaceRoot },
      { type: "shell.load-registry" },
    ]);
    return {
      ...requested,
      state: {
        ...requested.state,
        registryCommandId: requested.commands.find(
          (command) => command.type === "shell.load-registry",
        )?.commandId ?? null,
      },
    };
  }
  if (message.type === "shell.theme-toggle-requested") {
    const theme = nextTheme(state.theme);
    return appendCommands({ ...state, theme }, [
      { type: "shell.apply-theme", theme },
      { type: "shell.persist-theme", theme },
    ]);
  }
  if (message.type === "shell.workspace-requested") {
    const workspaceRoot = message.workspaceRoot.trim();
    if (!workspaceRoot) return { state, commands: [] };
    return readyState({ ...state, error: null }, workspaceRoot, null);
  }
  if (message.type === "shell.registry-loaded") {
    const command = commandForResult(
      state,
      message.commandId,
      "shell.load-registry",
    );
    if (
      !command
      || !state.registryCommandId
      || message.commandId !== state.registryCommandId
    ) return { state, commands: [] };
    const fallbackWorkspaceRoot = registryFallback(message.registry, state.workspaceRoot);
    const next = {
      ...retireCommand(state, message.commandId),
      fallbackWorkspaceRoot,
      registryCommandId: null,
    };
    const deepLink = parseDeepLink(state.currentSearch);
    if (deepLink.state === "ready") {
      const project = matchingProject(deepLink.projectRoot, message.registry.projects);
      if (project) {
        const surface = landingSurface(state.currentSearch);
        const focus = runFocus(state.currentSearch, project.root);
        if (project.is_active) return readyState(next, project.root, null, surface, focus);
        const activation = appendCommands({
          ...next,
          activationWorkspaceRoot: project.root,
          initialSurface: surface,
          initialRunFocus: focus,
        }, [
          {
            type: "shell.activate-project",
            projectId: project.id,
            projectRoot: normalizeProjectRoot(project.root),
          },
        ]);
        return {
          ...activation,
          state: { ...activation.state, activationCommandId: activation.commands[0]?.commandId ?? null },
        };
      }
      return readyState(next, fallbackWorkspaceRoot, `Project deep link is not registered: ${deepLink.projectRoot}`);
    }
    return readyState(next, fallbackWorkspaceRoot, deepLink.state === "invalid" ? deepLink.error : null);
  }
  if (message.type === "shell.project-activated") {
    const command = commandForResult(
      state,
      message.commandId,
      "shell.activate-project",
    );
    if (
      !command
      || !state.activationCommandId
      || message.commandId !== state.activationCommandId
      || message.projectId !== command.projectId
      || normalizeProjectRoot(message.projectRoot) !== command.projectRoot
    ) return { state, commands: [] };
    return readyState(
      retireCommand(state, message.commandId),
      command.projectRoot,
      null,
    );
  }
  if (message.type === "shell.project-activation-failed") {
    const command = commandForResult(
      state,
      message.commandId,
      "shell.activate-project",
    );
    if (
      !command
      || !state.activationCommandId
      || message.commandId !== state.activationCommandId
    ) return { state, commands: [] };
    return readyState(
      retireCommand(state, message.commandId),
      state.fallbackWorkspaceRoot,
      message.error,
    );
  }
  if (message.type === "shell.command-succeeded") {
    const command = commandForResult(
      state,
      message.commandId,
      message.commandType,
    );
    if (
      !command
      || (
        command.type !== "shell.apply-theme"
        && command.type !== "shell.persist-theme"
        && command.type !== "shell.persist-workspace"
        && command.type !== "shell.replace-project-url"
      )
    ) return { state, commands: [] };
    return {
      state: retireCommand(state, message.commandId),
      commands: [],
    };
  }
  if (message.type === "shell.command-failed") {
    const command = commandForResult(
      state,
      message.commandId,
      message.commandType,
    );
    if (
      !command
      || command.type === "shell.activate-project"
    ) return { state, commands: [] };
    const retired = retireCommand(state, message.commandId);
    return {
      state: {
        ...retired,
        preferencesCommandId: message.commandId === state.preferencesCommandId
          ? null
          : state.preferencesCommandId,
        registryCommandId: message.commandId === state.registryCommandId
          ? null
          : state.registryCommandId,
        error: message.error,
      },
      commands: [],
    };
  }
  return { state, commands: [] };
}

export function replayAppShellMessages(state: AppShellState, messages: AppShellMessage[]) {
  return messages.reduce((current, message) => updateAppShell(current.state, message), {
    state,
    commands: [] as AppShellCommand[],
  });
}
