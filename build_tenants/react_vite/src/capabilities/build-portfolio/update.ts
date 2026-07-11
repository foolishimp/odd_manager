import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { BuildPortfolioMessage } from "./messages";
import type {
  BuildPortfolioCommand,
  BuildPortfolioCommandInput,
  BuildPortfolioState,
} from "./state";
import { buildPortfolioAttentionTarget } from "./selectors";

function pendingCommand(state: BuildPortfolioState, commandId: string) {
  return state.pendingCommands.find((command) => command.commandId === commandId) ?? null;
}

function withoutCommand(state: BuildPortfolioState, commandId: string) {
  return state.pendingCommands.filter((command) => command.commandId !== commandId);
}

function enqueue(
  state: BuildPortfolioState,
  command: BuildPortfolioCommandInput,
): CapabilityUpdate<BuildPortfolioState, BuildPortfolioCommand> {
  if (!state.contextProjectRoot) return { state, commands: [] };
  const commandSequence = state.commandSequence + 1;
  const admitted = {
    ...command,
    commandId: `portfolio-${command.type.slice("portfolio.".length)}-${commandSequence}`,
    correlationId: `portfolio:${state.contextProjectRoot}:${commandSequence}`,
    contextProjectRoot: state.contextProjectRoot,
  } as BuildPortfolioCommand;
  return {
    state: {
      ...state,
      commandSequence,
      pendingCommands: [...state.pendingCommands, admitted],
      actionError: null,
    },
    commands: [admitted],
  };
}

function enqueueLoad(
  state: BuildPortfolioState,
): CapabilityUpdate<BuildPortfolioState, BuildPortfolioCommand> {
  if (state.pendingCommands.some((command) => command.type === "portfolio.load")) {
    return { state, commands: [] };
  }
  const result = enqueue(state, { type: "portfolio.load" });
  const nextState: BuildPortfolioState = {
    ...result.state,
    status: "loading",
    error: null,
  };
  return {
    ...result,
    state: nextState,
  };
}

export function updateBuildPortfolio(
  state: BuildPortfolioState,
  message: BuildPortfolioMessage,
): CapabilityUpdate<BuildPortfolioState, BuildPortfolioCommand> {
  if (message.type === "portfolio/context-changed") {
    const next: BuildPortfolioState = {
      ...state,
      contextProjectRoot: message.projectRoot,
      activatedProjectRoot: null,
      openedAttention: null,
      error: null,
    };
    if (
      state.contextProjectRoot === message.projectRoot
      && state.portfolio
      && state.status === "ready"
    ) return { state: next, commands: [] };
    return enqueueLoad({
      ...next,
      pendingCommands: state.pendingCommands.filter(
        (command) => command.contextProjectRoot === message.projectRoot,
      ),
    });
  }

  if (message.type === "portfolio/refresh-requested") return enqueueLoad(state);

  if (message.type === "portfolio/load-succeeded") {
    const command = pendingCommand(state, message.commandId);
    if (
      command?.type !== "portfolio.load"
      || command.contextProjectRoot !== state.contextProjectRoot
      || message.contextProjectRoot !== state.contextProjectRoot
    ) return { state, commands: [] };
    const selectedStillExists = state.selectedProjectId
      && message.portfolio.rows.some((row) => row.project.id === state.selectedProjectId);
    const admitted: BuildPortfolioState = {
      ...state,
      status: "ready",
      portfolio: message.portfolio,
      selectedProjectId: selectedStillExists
        ? state.selectedProjectId
        : message.portfolio.rows.find((row) => row.active)?.project.id
          ?? message.portfolio.rows[0]?.project.id
          ?? null,
      pendingCommands: withoutCommand(state, message.commandId),
      error: null,
    };
    if (
      admitted.browser.open
      && !admitted.browser.currentPath
      && !admitted.browser.requestedPath
    ) {
      return updateBuildPortfolio(admitted, {
        type: "portfolio/browser-navigate-requested",
        path: message.portfolio.browseRoot,
      });
    }
    return { state: admitted, commands: [] };
  }

  if (message.type === "portfolio/scope-selected") {
    return { state: { ...state, scope: message.scope }, commands: [] };
  }
  if (message.type === "portfolio/sort-selected") {
    return { state: { ...state, sort: message.sort }, commands: [] };
  }
  if (message.type === "portfolio/project-selected") {
    if (!state.portfolio?.rows.some((row) => row.project.id === message.projectId)) {
      return { state, commands: [] };
    }
    return { state: { ...state, selectedProjectId: message.projectId }, commands: [] };
  }
  if (message.type === "portfolio/project-activate-requested") {
    return enqueue(state, { type: "portfolio.activate", projectId: message.projectId });
  }
  if (message.type === "portfolio/project-activated") {
    const command = pendingCommand(state, message.commandId);
    if (command?.type !== "portfolio.activate") return { state, commands: [] };
    return {
      state: {
        ...state,
        pendingCommands: withoutCommand(state, message.commandId),
        activatedProjectRoot: message.projectRoot,
      },
      commands: [],
    };
  }
  if (message.type === "portfolio/project-activation-consumed") {
    return { state: { ...state, activatedProjectRoot: null }, commands: [] };
  }
  if (message.type === "portfolio/attention-open-requested") {
    const row = state.portfolio?.rows.find((entry) => entry.project.id === message.projectId) ?? null;
    const attention = row?.attention.find((entry) => entry.attentionId === message.attentionId) ?? null;
    if (!row || !attention) return { state, commands: [] };
    return enqueue(state, {
      type: "portfolio.open-attention",
      projectId: row.project.id,
      projectRoot: row.project.root,
      attentionId: attention.attentionId,
      sourceKind: attention.sourceKind,
      sourceRef: attention.sourceRef,
      targetCapabilityId: buildPortfolioAttentionTarget(attention.sourceKind).capabilityId,
    });
  }
  if (message.type === "portfolio/attention-opened") {
    const command = pendingCommand(state, message.commandId);
    if (
      command?.type !== "portfolio.open-attention"
      || command.projectRoot !== message.projectRoot
      || command.attentionId !== message.attentionId
      || command.sourceKind !== message.sourceKind
      || command.sourceRef !== message.sourceRef
      || command.targetCapabilityId !== message.targetCapabilityId
    ) return { state, commands: [] };
    return {
      state: {
        ...state,
        pendingCommands: withoutCommand(state, message.commandId),
        openedAttention: {
          projectRoot: message.projectRoot,
          attentionId: message.attentionId,
          sourceKind: message.sourceKind,
          sourceRef: message.sourceRef,
          targetCapabilityId: message.targetCapabilityId,
        },
      },
      commands: [],
    };
  }
  if (message.type === "portfolio/attention-focus-consumed") {
    return { state: { ...state, openedAttention: null }, commands: [] };
  }
  if (message.type === "portfolio/project-unregister-requested") {
    return enqueue(state, { type: "portfolio.unregister", projectId: message.projectId });
  }
  if (message.type === "portfolio/project-unregistered") {
    const command = pendingCommand(state, message.commandId);
    if (command?.type !== "portfolio.unregister") return { state, commands: [] };
    return enqueueLoad({
      ...state,
      pendingCommands: withoutCommand(state, message.commandId),
    });
  }
  if (message.type === "portfolio/browser-toggled") {
    const open = message.open ?? !state.browser.open;
    const next: BuildPortfolioState = { ...state, browser: { ...state.browser, open } };
    if (!open || state.browser.currentPath || !state.portfolio?.browseRoot) {
      return { state: next, commands: [] };
    }
    return updateBuildPortfolio(next, {
      type: "portfolio/browser-navigate-requested",
      path: state.portfolio.browseRoot,
    });
  }
  if (message.type === "portfolio/browser-navigate-requested") {
    const result = enqueue(state, { type: "portfolio.browse", path: message.path });
    return {
      ...result,
      state: {
        ...result.state,
        browser: {
          ...state.browser,
          open: true,
          status: "loading",
          requestedPath: message.path,
          error: null,
        },
      },
    };
  }
  if (message.type === "portfolio/browser-loaded") {
    const command = pendingCommand(state, message.commandId);
    if (
      command?.type !== "portfolio.browse"
      || command.path !== message.path
      || state.browser.requestedPath !== message.path
    ) return { state, commands: [] };
    return {
      state: {
        ...state,
        pendingCommands: withoutCommand(state, message.commandId),
        browser: {
          ...state.browser,
          status: "ready",
          currentPath: message.path,
          requestedPath: null,
          parent: message.parent,
          entries: message.entries,
          error: null,
        },
      },
      commands: [],
    };
  }
  if (message.type === "portfolio/project-register-requested") {
    return enqueue(state, { type: "portfolio.register", path: message.path });
  }
  if (message.type === "portfolio/project-registered") {
    const command = pendingCommand(state, message.commandId);
    if (command?.type !== "portfolio.register") return { state, commands: [] };
    return enqueueLoad({
      ...state,
      pendingCommands: withoutCommand(state, message.commandId),
    });
  }

  const command = pendingCommand(state, message.commandId);
  if (!command) return { state, commands: [] };
  return {
    state: {
      ...state,
      status: command.type === "portfolio.load" ? "error" : state.status,
      pendingCommands: withoutCommand(state, message.commandId),
      browser: command.type === "portfolio.browse"
        ? { ...state.browser, status: "error", requestedPath: null, error: message.error }
        : state.browser,
      error: command.type === "portfolio.load" ? message.error : state.error,
      actionError: command.type === "portfolio.load" || command.type === "portfolio.browse"
        ? state.actionError
        : message.error,
    },
    commands: [],
  };
}

export function replayBuildPortfolioMessages(
  state: BuildPortfolioState,
  messages: BuildPortfolioMessage[],
) {
  const commands: BuildPortfolioCommand[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateBuildPortfolio(current, message);
    current = result.state;
    commands.push(...result.commands);
  }
  return { state: current, commands };
}
