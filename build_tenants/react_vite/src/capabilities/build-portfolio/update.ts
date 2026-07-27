import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { BuildPortfolioMessage } from "./messages";
import type { BuildPortfolio } from "@odd-manager/developer-control-contracts";
import {
  createBuildPortfolioState,
  type BuildPortfolioCommand,
  type BuildPortfolioCommandInput,
  type BuildPortfolioState,
} from "./state";
import { buildPortfolioAttentionTarget } from "./selectors";

function pendingCommand(state: BuildPortfolioState, commandId: string, correlationId: string) {
  return state.pendingCommands.find((command) => (
    command.commandId === commandId && command.correlationId === correlationId
  )) ?? null;
}

function withoutCommand(state: BuildPortfolioState, commandId: string) {
  return state.pendingCommands.filter((command) => command.commandId !== commandId);
}

function portfolioSemanticsMatch(portfolio: BuildPortfolio) {
  const rows = portfolio.rows;
  const attentionIds = rows.flatMap((row) => (
    row.attention.map((attention) => attention.attentionId)
  ));
  if (
    new Set(rows.map((row) => row.project.id)).size !== rows.length
    || new Set(rows.map((row) => row.project.root)).size !== rows.length
    || rows.filter((row) => row.active).length > 1
    || new Set(attentionIds).size !== attentionIds.length
  ) return false;
  return rows.every((row) => {
    const activity = row.buildActivity;
    const total = (
      activity.queuedCount
      + activity.runningCount
      + activity.waitingHumanCount
      + activity.terminalCount
    );
    if (
      (activity.latestExecutionId === null) !== (activity.latestState === null)
      || (activity.latestExecutionId === null && total !== 0)
    ) return false;
    if (activity.latestState === "queued") return activity.queuedCount > 0;
    if (["starting", "running"].includes(activity.latestState ?? "")) {
      return activity.runningCount > 0;
    }
    if (activity.latestState === "waiting_human") {
      return activity.waitingHumanCount > 0;
    }
    if (["converged", "failed", "cancelled"].includes(activity.latestState ?? "")) {
      return activity.terminalCount > 0;
    }
    return true;
  });
}

function sameCommand(left: BuildPortfolioCommand, right: BuildPortfolioCommand) {
  if (
    left.type !== right.type
    || left.commandId !== right.commandId
    || left.correlationId !== right.correlationId
    || left.contextProjectRoot !== right.contextProjectRoot
  ) return false;
  if (left.type === "portfolio.load") return right.type === "portfolio.load";
  if (left.type === "portfolio.browse") {
    return right.type === "portfolio.browse" && left.path === right.path;
  }
  if (left.type === "portfolio.register") {
    return right.type === "portfolio.register" && left.path === right.path;
  }
  if (left.type === "portfolio.unregister") {
    return right.type === "portfolio.unregister"
      && left.projectId === right.projectId
      && left.projectRoot === right.projectRoot;
  }
  if (left.type === "portfolio.activate") {
    return right.type === "portfolio.activate"
      && left.projectId === right.projectId
      && left.projectRoot === right.projectRoot;
  }
  return right.type === "portfolio.open-attention"
    && left.projectId === right.projectId
    && left.projectRoot === right.projectRoot
    && left.attentionId === right.attentionId
    && left.sourceKind === right.sourceKind
    && left.sourceRef === right.sourceRef
    && left.targetCapabilityId === right.targetCapabilityId;
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
  queueContinuation = true,
): CapabilityUpdate<BuildPortfolioState, BuildPortfolioCommand> {
  if (state.pendingCommands.some((command) => command.type === "portfolio.load")) {
    return queueContinuation
      ? { state: { ...state, refreshQueued: true }, commands: [] }
      : { state, commands: [] };
  }
  const result = enqueue(state, { type: "portfolio.load" });
  const nextState: BuildPortfolioState = {
    ...result.state,
    status: "loading",
    refreshQueued: false,
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
  if (message.type === "portfolio/context-cleared") {
    const cleared = createBuildPortfolioState();
    return {
      state: {
        ...cleared,
        scope: state.scope,
        sort: state.sort,
        commandSequence: state.commandSequence,
        browser: {
          ...cleared.browser,
          open: state.browser.open,
        },
      },
      commands: [],
    };
  }

  if (message.type === "portfolio/context-changed") {
    const next: BuildPortfolioState = {
      ...state,
      contextProjectRoot: message.projectRoot,
      activatedProjectRoot: null,
      openedAttention: null,
      refreshQueued: state.contextProjectRoot === message.projectRoot
        ? state.refreshQueued
        : false,
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
  if (message.type === "portfolio/poll-ticked") return enqueueLoad(state, false);

  if (message.type === "portfolio/load-succeeded") {
    const command = pendingCommand(state, message.commandId, message.correlationId);
    if (
      command?.type !== "portfolio.load"
      || command.contextProjectRoot !== state.contextProjectRoot
      || message.contextProjectRoot !== state.contextProjectRoot
    ) return { state, commands: [] };
    if (state.refreshQueued) {
      return enqueueLoad({
        ...state,
        refreshQueued: false,
        pendingCommands: withoutCommand(state, message.commandId),
      });
    }
    if (!portfolioSemanticsMatch(message.portfolio)) return { state, commands: [] };
    const selectedStillExists = state.selectedProjectId
      && message.portfolio.rows.some((row) => row.project.id === state.selectedProjectId);
    const admitted: BuildPortfolioState = {
      ...state,
      status: "ready",
      portfolio: message.portfolio,
      refreshQueued: false,
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
    const row = state.portfolio?.rows.find(
      (entry) => entry.project.id === message.projectId,
    ) ?? null;
    return row
      ? enqueue(state, {
        type: "portfolio.activate",
        projectId: row.project.id,
        projectRoot: row.project.root,
      })
      : { state, commands: [] };
  }
  if (message.type === "portfolio/project-activated") {
    const command = pendingCommand(state, message.commandId, message.correlationId);
    const row = state.portfolio?.rows.find(
      (entry) => entry.project.id === message.projectId,
    ) ?? null;
    if (
      command?.type !== "portfolio.activate"
      || command.contextProjectRoot !== state.contextProjectRoot
      || command.projectId !== message.projectId
      || command.projectRoot !== message.projectRoot
      || !row
      || row.project.id !== command.projectId
      || row.project.root !== command.projectRoot
    ) return { state, commands: [] };
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
    const command = pendingCommand(state, message.commandId, message.correlationId);
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
    const row = state.portfolio?.rows.find(
      (entry) => entry.project.id === message.projectId,
    ) ?? null;
    return row
      ? enqueue(state, {
        type: "portfolio.unregister",
        projectId: row.project.id,
        projectRoot: row.project.root,
      })
      : { state, commands: [] };
  }
  if (message.type === "portfolio/project-unregistered") {
    const command = pendingCommand(state, message.commandId, message.correlationId);
    const row = state.portfolio?.rows.find(
      (entry) => entry.project.id === message.projectId,
    ) ?? null;
    if (
      command?.type !== "portfolio.unregister"
      || command.contextProjectRoot !== state.contextProjectRoot
      || command.projectId !== message.projectId
      || command.projectRoot !== message.projectRoot
      || !row
      || row.project.id !== command.projectId
      || row.project.root !== command.projectRoot
    ) return { state, commands: [] };
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
    const command = pendingCommand(state, message.commandId, message.correlationId);
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
    const command = pendingCommand(state, message.commandId, message.correlationId);
    if (
      command?.type !== "portfolio.register"
      || command.contextProjectRoot !== state.contextProjectRoot
      || command.path !== message.path
      || message.projectRoot !== command.path
      || message.projectId.length === 0
    ) return { state, commands: [] };
    return enqueueLoad({
      ...state,
      pendingCommands: withoutCommand(state, message.commandId),
    });
  }

  const command = pendingCommand(state, message.commandId, message.correlationId);
  if (!command || !sameCommand(command, message.failedCommand)) {
    return { state, commands: [] };
  }
  if (command.type === "portfolio.load" && state.refreshQueued) {
    return enqueueLoad({
      ...state,
      refreshQueued: false,
      pendingCommands: withoutCommand(state, message.commandId),
    });
  }
  return {
    state: {
      ...state,
      status: command.type === "portfolio.load" ? "error" : state.status,
      pendingCommands: withoutCommand(state, message.commandId),
      refreshQueued: false,
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
