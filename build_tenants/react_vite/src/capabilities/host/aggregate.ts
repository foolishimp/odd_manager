import type { RunInspectorFocus } from "../../lib/projectDeepLink";
import {
  commandEnvelopeSchema,
  commandResultSchema,
  type CommandEnvelope,
  type CommandResult,
  type ProjectRevision,
} from "@odd-manager/developer-control-contracts";
import type {
  DeveloperControlHostCommand,
  DeveloperControlHostMessage,
  DeveloperControlSurface,
} from "../../contracts/developer-control";
import type { AssuranceAttentionMessage } from "../assurance-attention/messages";
import {
  createAssuranceAttentionState,
  type AssuranceAttentionCommand,
  type AssuranceAttentionState,
} from "../assurance-attention/state";
import { updateAssuranceAttention } from "../assurance-attention/update";
import type { BuildControlMessage } from "../build-control/messages";
import {
  createBuildControlState,
  type BuildControlCommand,
  type BuildControlState,
  type BuildControlSubscription,
} from "../build-control/state";
import { buildControlSubscriptions } from "../build-control/subscriptions";
import { updateBuildControl } from "../build-control/update";
import type { BuildPortfolioMessage } from "../build-portfolio/messages";
import {
  createBuildPortfolioState,
  type BuildPortfolioCommand,
  type BuildPortfolioState,
  type BuildPortfolioSubscription,
} from "../build-portfolio/state";
import { buildPortfolioSubscriptions } from "../build-portfolio/subscriptions";
import { updateBuildPortfolio } from "../build-portfolio/update";
import type { ProjectWorkbenchMessage } from "../project-workbench/messages";
import {
  INITIAL_PROJECT_WORKBENCH_STATE,
  type ProjectWorkbenchState,
} from "../project-workbench/state";
import { updateProjectWorkbench } from "../project-workbench/update";
import type { RunObservationMessage } from "../run-observation/messages";
import {
  INITIAL_RUN_OBSERVATION_STATE,
  type RunObservationState,
} from "../run-observation/state";
import { updateRunObservation } from "../run-observation/update";
import type { SpecificationProposalMessage } from "../specification-proposal/messages";
import {
  createSpecificationProposalState,
  type SpecificationProposalCommand,
  type SpecificationProposalState,
} from "../specification-proposal/state";
import { updateSpecificationProposal } from "../specification-proposal/update";
import {
  createDeveloperControlHostState,
  type DeveloperControlHostState,
  updateDeveloperControlHost,
} from "./state";
import {
  createDeveloperControlIntegrationState,
  type DeveloperControlIntegrationCommand,
  type DeveloperControlIntegrationState,
  updateDeveloperControlIntegration,
} from "./integration";

type AggregateCommandIdentity = {
  aggregateCommandId: string;
  status: "queued" | "running";
  /**
   * The admitted cross-capability command carrier.  Host bootstrap and local
   * project activation deliberately have no envelope: neither has an
   * admitted ManagerContext yet.
   */
  envelope?: CommandEnvelope;
};

type InterpretedProposalCommand = Exclude<
  SpecificationProposalCommand,
  { type: "proposal.refresh-context" }
>;

export type DeveloperControlAggregateCommand =
  | (AggregateCommandIdentity & {
      type: "aggregate.interpret-host";
      command: DeveloperControlHostCommand;
    })
  | (AggregateCommandIdentity & {
      type: "aggregate.interpret-portfolio";
      command: BuildPortfolioCommand;
    })
  | (AggregateCommandIdentity & {
      type: "aggregate.interpret-proposal";
      command: InterpretedProposalCommand;
    })
  | (AggregateCommandIdentity & {
      type: "aggregate.interpret-build";
      command: BuildControlCommand;
    })
  | (AggregateCommandIdentity & {
      type: "aggregate.interpret-assurance";
      command: AssuranceAttentionCommand;
    })
  | (AggregateCommandIdentity & {
      type: "aggregate.activate-project";
      projectRoot: string;
    });

type UnidentifiedAggregateCommand =
  DeveloperControlAggregateCommand extends infer Command
    ? Command extends DeveloperControlAggregateCommand
      ? Omit<Command, keyof AggregateCommandIdentity>
      : never
    : never;

type EnvelopeResult = {
  envelope: CommandEnvelope;
  commandResult: CommandResult;
};

export type DeveloperControlAggregateCommandResult =
  | ({ type: "host"; message: DeveloperControlHostMessage } & Partial<EnvelopeResult>)
  | ({ type: "portfolio"; message: BuildPortfolioMessage } & Partial<EnvelopeResult>)
  | ({ type: "proposal"; message: SpecificationProposalMessage } & Partial<EnvelopeResult>)
  | ({ type: "build"; message: BuildControlMessage } & Partial<EnvelopeResult>)
  | ({ type: "assurance"; message: AssuranceAttentionMessage } & Partial<EnvelopeResult>)
  | { type: "project-activated"; projectRoot: string };

export type DeveloperControlAggregateSubscription =
  | {
      type: "aggregate.project-registry";
      subscriptionId: "aggregate.project-registry";
    }
  | ({
      subscriptionId: string;
    } & BuildControlSubscription)
  | ({
      subscriptionId: string;
    } & BuildPortfolioSubscription);

export type DeveloperControlAggregateSubscriptionFailure = {
  subscriptionId: string;
  subscriptionType: DeveloperControlAggregateSubscription["type"];
  projectRoot: string | null;
  basisRevision: ProjectRevision | null;
  error: string;
};

export type DeveloperControlAggregateState = {
  projectRoot: string;
  runFocus: RunInspectorFocus | null;
  hostCommandSequence: number;
  aggregateCommandSequence: number;
  host: DeveloperControlHostState;
  workbench: ProjectWorkbenchState;
  portfolio: BuildPortfolioState;
  proposal: SpecificationProposalState;
  build: BuildControlState;
  assurance: AssuranceAttentionState;
  runObservation: RunObservationState;
  integration: DeveloperControlIntegrationState;
  pendingCommands: DeveloperControlAggregateCommand[];
  membraneErrors: string[];
  subscriptionFailures: DeveloperControlAggregateSubscriptionFailure[];
};

export type DeveloperControlAggregateMessage =
  | { type: "aggregate/project-observed"; projectRoot: string }
  | { type: "aggregate/project-activation-requested"; projectRoot: string }
  | {
      type: "aggregate/surface-requested";
      surface: DeveloperControlSurface;
      runFocus?: RunInspectorFocus | null;
    }
  | { type: "aggregate/context-retry-requested" }
  | { type: "aggregate/registry-changed" }
  | {
      type: "aggregate/subscription-ticked";
      subscription: Exclude<
        DeveloperControlAggregateSubscription,
        { type: "aggregate.project-registry" }
      >;
    }
  | {
      type: "aggregate/subscription-failed";
      subscription: DeveloperControlAggregateSubscription;
      error: string;
    }
  | { type: "aggregate/host-message"; message: DeveloperControlHostMessage }
  | { type: "aggregate/workbench-message"; message: ProjectWorkbenchMessage }
  | { type: "aggregate/portfolio-message"; message: BuildPortfolioMessage }
  | { type: "aggregate/proposal-message"; message: SpecificationProposalMessage }
  | { type: "aggregate/build-message"; message: BuildControlMessage }
  | { type: "aggregate/assurance-message"; message: AssuranceAttentionMessage }
  | { type: "aggregate/run-observation-message"; message: RunObservationMessage }
  | { type: "aggregate/command-started"; aggregateCommandId: string }
  | {
      type: "aggregate/command-resolved";
      aggregateCommandId: string;
      result: DeveloperControlAggregateCommandResult;
    }
  | {
      type: "aggregate/command-failed";
      aggregateCommandId: string;
      error: string;
    };

export type DeveloperControlAggregateUpdate = {
  state: DeveloperControlAggregateState;
  commands: DeveloperControlAggregateCommand[];
};

function commandIdentity(command: UnidentifiedAggregateCommand) {
  if ("command" in command) {
    return `${command.type}:${command.command.correlationId}:${command.command.commandId}`;
  }
  return null;
}

function capabilityIdForAggregateCommand(
  command: UnidentifiedAggregateCommand,
) {
  if (command.type === "aggregate.interpret-portfolio") return "build-portfolio";
  if (command.type === "aggregate.interpret-proposal") return "specification-proposal";
  if (command.type === "aggregate.interpret-build") return "build-control";
  if (command.type === "aggregate.interpret-assurance") return "assurance-attention";
  return null;
}

function commandRequestedBy(command: UnidentifiedAggregateCommand) {
  if (!("command" in command)) return "odd-manager://aggregate";
  const candidate = command.command as Record<string, unknown>;
  return typeof candidate.requestedBy === "string"
    ? candidate.requestedBy
    : typeof candidate.actorRef === "string"
      ? candidate.actorRef
      : "odd-manager://aggregate";
}

function admittedEnvelope(
  state: DeveloperControlAggregateState,
  command: UnidentifiedAggregateCommand,
): CommandEnvelope | null {
  const capabilityId = capabilityIdForAggregateCommand(command);
  const context = state.host.bootstrap?.context;
  if (!capabilityId || !context || !("command" in command)) return null;
  return commandEnvelopeSchema.parse({
    schemaVersion: "1",
    commandId: command.command.commandId,
    correlationId: command.command.correlationId,
    capabilityId,
    kind: command.command.type,
    context,
    requestedBy: commandRequestedBy(command),
    // This is deliberately replay-derived rather than a wall-clock value: the
    // envelope is admitted by the pure reducer before its effect is run.
    requestedAt: `aggregate:${command.command.commandId}`,
    payload: command.command,
  });
}

function enqueueAggregateCommand(
  state: DeveloperControlAggregateState,
  command: UnidentifiedAggregateCommand,
): DeveloperControlAggregateState {
  const stableIdentity = commandIdentity(command);
  if (
    stableIdentity
    && state.pendingCommands.some((entry) => entry.aggregateCommandId === stableIdentity)
  ) return state;

  const aggregateCommandSequence = state.aggregateCommandSequence + 1;
  const aggregateCommandId = stableIdentity
    ?? `${command.type}:${aggregateCommandSequence}`;
  let envelope: CommandEnvelope | null = null;
  try {
    envelope = admittedEnvelope(state, command);
  } catch (caught) {
    return {
      ...state,
      aggregateCommandSequence,
      membraneErrors: [
        ...state.membraneErrors,
        `Aggregate command envelope rejected: ${caught instanceof Error ? caught.message : String(caught)}`,
      ].slice(-40),
    };
  }
  return {
    ...state,
    aggregateCommandSequence,
    pendingCommands: [
      ...state.pendingCommands,
      {
        ...command,
        aggregateCommandId,
        status: "queued",
        ...(envelope ? { envelope } : {}),
      } as DeveloperControlAggregateCommand,
    ],
  };
}

function queueHostCommands(
  state: DeveloperControlAggregateState,
  commands: DeveloperControlHostCommand[],
) {
  return commands.reduce(
    (current, command) => enqueueAggregateCommand(current, {
      type: "aggregate.interpret-host",
      command,
    }),
    state,
  );
}

function queuePortfolioCommands(
  state: DeveloperControlAggregateState,
  commands: BuildPortfolioCommand[],
) {
  return commands.reduce(
    (current, command) => enqueueAggregateCommand(current, {
      type: "aggregate.interpret-portfolio",
      command,
    }),
    state,
  );
}

function queueBuildCommands(
  state: DeveloperControlAggregateState,
  commands: BuildControlCommand[],
) {
  return commands.reduce(
    (current, command) => enqueueAggregateCommand(current, {
      type: "aggregate.interpret-build",
      command,
    }),
    state,
  );
}

function selectedBuildExecution(state: BuildControlState) {
  return state.snapshot?.executions.find(
    (execution) => execution.executionId === state.selectedExecutionId,
  ) ?? null;
}

function buildProjectionSignature(state: BuildControlState) {
  return (state.snapshot?.executions ?? [])
    .map((execution) => `${execution.executionId}:${execution.state}:${execution.updatedAt}`)
    .join("|");
}

function applyAssuranceMessage(
  state: DeveloperControlAggregateState,
  message: AssuranceAttentionMessage,
): DeveloperControlAggregateState {
  const resolvedInspectorFocus = message.type === "assurance/inspector-focus-resolved"
    ? message
    : null;
  const resolvedInspectorCommand = resolvedInspectorFocus
    ? state.assurance.pendingCommands.find((command) => (
        command.type === "assurance.open-run-inspector"
        && command.commandId === resolvedInspectorFocus.commandId
        && command.correlationId === resolvedInspectorFocus.correlationId
        && command.projectRoot === resolvedInspectorFocus.projectRoot
        && command.executionId === resolvedInspectorFocus.executionId
        && command.basisRevision.revision === resolvedInspectorFocus.revision
        && command.focusBasis.sourceRef === resolvedInspectorFocus.sourceRef
      )) ?? null
    : null;
  const update = updateAssuranceAttention(state.assurance, message);
  let next: DeveloperControlAggregateState = {
    ...state,
    assurance: update.state,
  };
  if (
    resolvedInspectorFocus
    && resolvedInspectorCommand
    && !update.state.pendingCommands.some((command) => (
      command.commandId === resolvedInspectorCommand.commandId
      && command.correlationId === resolvedInspectorCommand.correlationId
    ))
  ) {
    next = requestSurface(next, "run-inspector", {
      projectRoot: resolvedInspectorFocus.projectRoot,
      executionId: resolvedInspectorFocus.executionId,
      runRef: resolvedInspectorFocus.runRef,
      revision: resolvedInspectorFocus.revision,
      sourceRef: resolvedInspectorFocus.sourceRef,
    });
  }
  for (const command of update.commands) {
    next = enqueueAggregateCommand(next, {
      type: "aggregate.interpret-assurance",
      command,
    });
  }
  return next;
}

function synchronizeAssuranceContext(
  state: DeveloperControlAggregateState,
): DeveloperControlAggregateState {
  const context = state.host.bootstrap?.context;
  if (!context || context.project.root !== state.projectRoot) return state;
  return applyAssuranceMessage(state, {
    type: "assurance/context-changed",
    project: context.project,
    revision: context.revision,
    executionId: selectedBuildExecution(state.build)?.executionId ?? null,
  });
}

function applyPortfolioMessage(
  state: DeveloperControlAggregateState,
  message: BuildPortfolioMessage,
): DeveloperControlAggregateState {
  const update = updateBuildPortfolio(state.portfolio, message);
  let next = queuePortfolioCommands({
    ...state,
    portfolio: update.state,
  }, update.commands);

  if (next.portfolio.activatedProjectRoot) {
    const projectRoot = next.portfolio.activatedProjectRoot;
    const consumed = updateBuildPortfolio(next.portfolio, {
      type: "portfolio/project-activation-consumed",
    });
    next = { ...next, portfolio: consumed.state };
    if (projectRoot !== next.projectRoot) {
      next = enqueueAggregateCommand(next, {
        type: "aggregate.activate-project",
        projectRoot,
      });
    }
  }

  if (next.portfolio.openedAttention) {
    const focus = next.portfolio.openedAttention;
    const consumed = updateBuildPortfolio(next.portfolio, {
      type: "portfolio/attention-focus-consumed",
    });
    next = { ...next, portfolio: consumed.state };
    next = applyIntegrationMessage(next, {
      type: "integration/attention-observed",
      focus,
      activeProjectRoot: next.projectRoot,
    });
  }
  return next;
}

function applyProposalMessage(
  state: DeveloperControlAggregateState,
  message: SpecificationProposalMessage,
): DeveloperControlAggregateState {
  const update = updateSpecificationProposal(state.proposal, message);
  let next: DeveloperControlAggregateState = {
    ...state,
    proposal: update.state,
  };
  for (const command of update.commands) {
    if (command.type === "proposal.refresh-context") {
      const consumed = updateSpecificationProposal(next.proposal, {
        type: "proposal/supporting-command-consumed",
        commandId: command.commandId,
        correlationId: command.correlationId,
      });
      next = requestContext({ ...next, proposal: consumed.state }, command.projectRoot);
      continue;
    }
    next = enqueueAggregateCommand(next, {
      type: "aggregate.interpret-proposal",
      command,
    });
  }
  return next;
}

function applyBuildMessage(
  state: DeveloperControlAggregateState,
  message: BuildControlMessage,
): DeveloperControlAggregateState {
  const beforeSignature = buildProjectionSignature(state.build);
  const beforeSelection = selectedBuildExecution(state.build);
  const update = updateBuildControl(state.build, message);
  let next = queueBuildCommands({
    ...state,
    build: update.state,
  }, update.commands);
  const afterSignature = buildProjectionSignature(next.build);
  const afterSelection = selectedBuildExecution(next.build);

  if (afterSignature !== beforeSignature && next.build.snapshot) {
    next = applyPortfolioMessage(next, { type: "portfolio/refresh-requested" });
  }

  if (beforeSelection?.executionId !== afterSelection?.executionId) {
    next = synchronizeAssuranceContext(next);
  } else if (
    afterSelection
    && beforeSelection?.updatedAt !== afterSelection.updatedAt
    && next.assurance.executionId === afterSelection.executionId
  ) {
    next = applyAssuranceMessage(next, { type: "assurance/refresh-requested" });
  }
  return next;
}

function applyHostMessage(
  state: DeveloperControlAggregateState,
  message: DeveloperControlHostMessage,
): DeveloperControlAggregateState {
  const previousBootstrap = state.host.bootstrap;
  const admittedNavigation = message.type === "host/navigation-admitted"
    ? state.host.pendingCommands.find(
        (command): command is Extract<
          DeveloperControlHostCommand,
          { type: "host.project-navigation" }
        > => (
          command.type === "host.project-navigation"
          && command.commandId === message.commandId
          && command.correlationId === message.correlationId
          && command.surface === message.surface
          && command.projectRoot === state.projectRoot
        ),
      ) ?? null
    : null;
  const update = updateDeveloperControlHost(state.host, message);
  let next = queueHostCommands({
    ...state,
    host: update.state,
  }, update.commands);

  if (admittedNavigation && update.state !== state.host) {
    next = {
      ...next,
      runFocus: admittedNavigation.runFocus,
    };
  }

  const context = next.host.bootstrap?.context;
  if (
    message.type === "host/context-admitted"
    && next.host.bootstrap !== previousBootstrap
    && context?.project.root === next.projectRoot
  ) {
    next = {
      ...next,
      pendingCommands: next.pendingCommands.filter(
        (command) => (
          !command.envelope
          || sameStructuredValue(command.envelope.context, context)
        ),
      ),
    };
    next = applyPortfolioMessage(next, {
      type: "portfolio/context-changed",
      projectRoot: context.project.root,
    });
    next = applyProposalMessage(next, {
      type: "proposal/context-changed",
      project: context.project,
      revision: context.revision,
    });
    next = applyBuildMessage(next, {
      type: "build/context-changed",
      project: context.project,
      revision: context.revision,
    });
    next = synchronizeAssuranceContext(next);
  }
  return next;
}

function requestContext(
  state: DeveloperControlAggregateState,
  projectRoot: string,
): DeveloperControlAggregateState {
  const hostCommandSequence = state.hostCommandSequence + 1;
  const command: DeveloperControlHostCommand = {
    type: "host.resolve-context",
    commandId: `developer-control-context-${hostCommandSequence}`,
    correlationId: `project:${projectRoot}:context:${hostCommandSequence}`,
    projectRoot,
  };
  return applyHostMessage(
    { ...state, hostCommandSequence },
    { type: "host/context-requested", command },
  );
}

function requestSurface(
  state: DeveloperControlAggregateState,
  surface: DeveloperControlSurface,
  runFocus: RunInspectorFocus | null = null,
): DeveloperControlAggregateState {
  const hostCommandSequence = state.hostCommandSequence + 1;
  const command: DeveloperControlHostCommand = {
    type: "host.project-navigation",
    commandId: `developer-control-navigate-${hostCommandSequence}`,
    correlationId: `project:${state.projectRoot}:navigate:${hostCommandSequence}`,
    projectRoot: state.projectRoot,
    surface,
    runFocus,
  };
  return applyHostMessage(
    {
      ...state,
      hostCommandSequence,
    },
    { type: "host/navigation-requested", command },
  );
}

function applyRunObservationMessage(
  state: DeveloperControlAggregateState,
  message: RunObservationMessage,
) {
  const update = updateRunObservation(state.runObservation, message);
  let next: DeveloperControlAggregateState = {
    ...state,
    runObservation: update.state,
  };
  for (const command of update.commands) {
    next = requestSurface(next, command.surface);
  }
  return next;
}

function aggregateOwnerCommandPending(
  state: DeveloperControlAggregateState,
  command: DeveloperControlAggregateCommand,
) {
  if (command.type === "aggregate.activate-project") return false;
  const pendingCommands = command.type === "aggregate.interpret-host"
    ? state.host.pendingCommands
    : command.type === "aggregate.interpret-portfolio"
      ? state.portfolio.pendingCommands
      : command.type === "aggregate.interpret-proposal"
        ? state.proposal.pendingCommands
        : command.type === "aggregate.interpret-build"
          ? state.build.pendingCommands
          : state.assurance.pendingCommands;
  return pendingCommands.some((pending) => (
    pending.commandId === command.command.commandId
    && pending.correlationId === command.command.correlationId
  ));
}

function failAggregateOwnerCommand(
  state: DeveloperControlAggregateState,
  command: DeveloperControlAggregateCommand,
  error: string,
) {
  if (command.type === "aggregate.activate-project") return state;
  const identity = {
    commandId: command.command.commandId,
    correlationId: command.command.correlationId,
    error,
  };
  if (command.type === "aggregate.interpret-host") {
    return applyHostMessage(
      state,
      command.command.type === "host.resolve-context"
        ? { type: "host/context-failed", ...identity }
        : { type: "host/navigation-failed", ...identity },
    );
  }
  if (command.type === "aggregate.interpret-portfolio") {
    return applyPortfolioMessage(state, {
      type: "portfolio/command-failed",
      ...identity,
      failedCommand: command.command,
    });
  }
  if (command.type === "aggregate.interpret-proposal") {
    const type = command.command.type === "proposal.history"
      ? "proposal/history-failed"
      : command.command.type === "proposal.generate"
        ? "proposal/generate-failed"
        : command.command.type === "proposal.validate"
          ? "proposal/validation-failed"
          : command.command.type === "proposal.accept"
            ? "proposal/accept-failed"
            : "proposal/reject-failed";
    return applyProposalMessage(state, { type, ...identity });
  }
  if (command.type === "aggregate.interpret-build") {
    return applyBuildMessage(state, {
      type: "build/command-failed",
      ...identity,
      execution: null,
    });
  }
  return applyAssuranceMessage(
    state,
    command.command.type === "assurance.load"
      ? { type: "assurance/load-failed", ...identity }
      : { type: "assurance/inspector-focus-failed", ...identity },
  );
}

function withMembraneError(
  state: DeveloperControlAggregateState,
  error: string,
) {
  return {
    ...state,
    membraneErrors: [...state.membraneErrors, error].slice(-40),
  };
}

function consumeIntegrationCommand(
  state: DeveloperControlAggregateState,
  command: DeveloperControlIntegrationCommand,
) {
  const consumed = updateDeveloperControlIntegration(state.integration, {
    type: "integration/command-consumed",
    commandId: command.commandId,
  });
  return { ...state, integration: consumed.state };
}

function applyIntegrationCommands(
  state: DeveloperControlAggregateState,
  commands: DeveloperControlIntegrationCommand[],
) {
  let next = state;
  for (const command of commands) {
    next = consumeIntegrationCommand(next, command);
    if (command.type === "integration.activate-project") {
      if (command.projectRoot !== next.projectRoot) {
        next = enqueueAggregateCommand(next, {
          type: "aggregate.activate-project",
          projectRoot: command.projectRoot,
        });
      }
    } else if (command.type === "integration.dispatch-workbench") {
      next = {
        ...next,
        workbench: updateProjectWorkbench(next.workbench, command.message).state,
      };
    } else if (command.type === "integration.dispatch-proposal") {
      next = applyProposalMessage(next, command.message);
    } else if (command.type === "integration.dispatch-build") {
      next = applyBuildMessage(next, command.message);
    } else {
      next = applyAssuranceMessage(next, command.message);
    }
  }
  return next;
}

function applyIntegrationMessage(
  state: DeveloperControlAggregateState,
  message: Parameters<typeof updateDeveloperControlIntegration>[1],
) {
  const update = updateDeveloperControlIntegration(state.integration, message);
  return applyIntegrationCommands({
    ...state,
    integration: update.state,
  }, update.commands);
}

function reconcileIntegration(state: DeveloperControlAggregateState) {
  return applyIntegrationMessage(state, {
    type: "integration/reconcile",
    activeProjectRoot: state.projectRoot,
    contextProjectRoot: state.host.bootstrap?.context.project.root ?? null,
    buildExecutionIds: (state.build.snapshot?.executions ?? []).map(
      (execution) => execution.executionId,
    ),
    buildProjectionReady: Boolean(state.build.snapshot) && state.build.status !== "loading",
    assuranceAttentionIds: (state.assurance.snapshot?.attentionItems ?? []).map(
      (attention) => attention.attentionId,
    ),
    assuranceProjectionReady: Boolean(state.assurance.snapshot)
      && state.assurance.status !== "loading",
  });
}

function capabilityMessageFailure(message: unknown) {
  if (
    typeof message !== "object"
    || message === null
    || !("type" in message)
    || typeof message.type !== "string"
    || !message.type.endsWith("failed")
    || !("error" in message)
    || typeof message.error !== "string"
    || message.error.length === 0
  ) return null;
  return {
    failureKind: message.type,
    error: message.error,
  };
}

function sameStructuredValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== typeof right
    || left === null
    || right === null
    || typeof left !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((entry, index) => sameStructuredValue(entry, right[index]))
    );
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index]
      && sameStructuredValue(leftRecord[key], rightRecord[key])
    ))
  );
}

function isCorrelatedCapabilityDelivery(
  message:
    | BuildPortfolioMessage
    | SpecificationProposalMessage
    | BuildControlMessage
    | AssuranceAttentionMessage,
) {
  return "commandId" in message && "correlationId" in message;
}

function isCorrelatedHostResultDelivery(message: DeveloperControlHostMessage) {
  return (
    (message.type === "host/context-admitted"
      || message.type === "host/context-failed"
      || message.type === "host/navigation-admitted"
      || message.type === "host/navigation-failed")
    && "commandId" in message
    && "correlationId" in message
  );
}

function rejectExternalHostResultDelivery(
  state: DeveloperControlAggregateState,
  message: DeveloperControlHostMessage,
) {
  return {
    ...state,
    membraneErrors: [
      ...state.membraneErrors,
      `Direct Host result rejected at aggregate ingress: ${message.type}.`,
    ].slice(-40),
  };
}

function rejectExternalCapabilityDelivery(
  state: DeveloperControlAggregateState,
  message:
    | BuildPortfolioMessage
    | SpecificationProposalMessage
    | BuildControlMessage
    | AssuranceAttentionMessage,
) {
  return {
    ...state,
    membraneErrors: [
      ...state.membraneErrors,
      `Direct capability result rejected at aggregate ingress: ${message.type}.`,
    ].slice(-40),
  };
}

function subscriptionRevisionIdentity(
  basisRevision: ProjectRevision | null,
) {
  if (!basisRevision) return "unobserved";
  return encodeURIComponent(JSON.stringify({
    kind: basisRevision.kind,
    revision: basisRevision.revision,
    dirty: basisRevision.dirty,
    sourceDigest: basisRevision.sourceDigest,
    specificationDigest: basisRevision.specificationDigest,
    observedAt: basisRevision.observedAt,
  }));
}

function commandResultMatches(
  state: DeveloperControlAggregateState,
  command: DeveloperControlAggregateCommand,
  result: DeveloperControlAggregateCommandResult,
) {
  if (
    typeof result !== "object"
    || result === null
    || !("type" in result)
    || typeof result.type !== "string"
  ) return false;
  if (command.type === "aggregate.activate-project") {
    return (
      result.type === "project-activated"
      && result.projectRoot === command.projectRoot
    );
  }
  if (result.type === "project-activated") return false;
  const capabilityMatches = (
    (command.type === "aggregate.interpret-host" && result.type === "host")
    || (command.type === "aggregate.interpret-portfolio" && result.type === "portfolio")
    || (command.type === "aggregate.interpret-proposal" && result.type === "proposal")
    || (command.type === "aggregate.interpret-build" && result.type === "build")
    || (command.type === "aggregate.interpret-assurance" && result.type === "assurance")
  );
  if (!capabilityMatches) return false;
  const message = "message" in result ? result.message : null;
  if (
    typeof message !== "object"
    || message === null
    || !("commandId" in message)
    || !("correlationId" in message)
  ) return false;
  const identityMatches = (
    message.commandId === command.command.commandId
    && message.correlationId === command.command.correlationId
  );
  if (!identityMatches) return false;
  if (!command.envelope) return !("envelope" in result) && !("commandResult" in result);
  if (!("envelope" in result) || !("commandResult" in result)) return false;
  try {
    const envelope = commandEnvelopeSchema.parse(result.envelope);
    const commandResult = commandResultSchema.parse(result.commandResult);
    const currentContext = state.host.bootstrap?.context ?? null;
    const failure = capabilityMessageFailure(message);
    const resultMatchesMessage = failure
      ? (
          commandResult.status === "failed"
          && commandResult.failureKind === failure.failureKind
          && commandResult.error === failure.error
          && sameStructuredValue(commandResult.value, message)
      )
      : (
          commandResult.status === "succeeded"
          && sameStructuredValue(commandResult.value, message)
        );
    return (
      currentContext !== null
      && sameStructuredValue(envelope.context, currentContext)
      && sameStructuredValue(envelope, command.envelope)
      && resultMatchesMessage
      && commandResult.commandId === envelope.commandId
      && commandResult.correlationId === envelope.correlationId
    );
  } catch {
    return false;
  }
}

function resolveAggregateCommand(
  state: DeveloperControlAggregateState,
  aggregateCommandId: string,
  result: DeveloperControlAggregateCommandResult,
) {
  const command = state.pendingCommands.find(
    (entry) => entry.aggregateCommandId === aggregateCommandId,
  );
  if (!command || command.status !== "running") return state;
  if (!commandResultMatches(state, command, result)) {
    const error = `Aggregate command result mismatch: ${aggregateCommandId}.`;
    const withoutCommand = {
      ...state,
      pendingCommands: state.pendingCommands.filter(
        (entry) => entry.aggregateCommandId !== aggregateCommandId,
      ),
    };
    return withMembraneError(
      failAggregateOwnerCommand(withoutCommand, command, error),
      error,
    );
  }
  const withoutCommand = {
    ...state,
    pendingCommands: state.pendingCommands.filter(
      (entry) => entry.aggregateCommandId !== aggregateCommandId,
    ),
  };
  const applied = result.type === "host"
    ? applyHostMessage(withoutCommand, result.message)
    : result.type === "portfolio"
      ? applyPortfolioMessage(withoutCommand, result.message)
      : result.type === "proposal"
        ? applyProposalMessage(withoutCommand, result.message)
        : result.type === "build"
          ? applyBuildMessage(withoutCommand, result.message)
          : result.type === "assurance"
            ? applyAssuranceMessage(withoutCommand, result.message)
            : withoutCommand;
  if (!aggregateOwnerCommandPending(applied, command)) return applied;
  const error = `Aggregate semantic result rejected: ${aggregateCommandId}.`;
  return withMembraneError(
    failAggregateOwnerCommand(applied, command, error),
    error,
  );
}

function reduceDeveloperControlAggregate(
  state: DeveloperControlAggregateState,
  message: DeveloperControlAggregateMessage,
): DeveloperControlAggregateState {
  if (message.type === "aggregate/project-observed") {
    if (!message.projectRoot || message.projectRoot === state.projectRoot) return state;
    const activeSurface = state.host.activeSurface;
    const retainedAttentionFocus = state.integration.attentionFocus?.projectRoot
      === message.projectRoot
      ? state.integration.attentionFocus
      : null;
    let next: DeveloperControlAggregateState = {
      ...state,
      projectRoot: message.projectRoot,
      runFocus: null,
      host: createDeveloperControlHostState(activeSurface),
      proposal: createSpecificationProposalState(),
      build: createBuildControlState(),
      assurance: createAssuranceAttentionState(),
      runObservation: INITIAL_RUN_OBSERVATION_STATE,
      integration: {
        ...createDeveloperControlIntegrationState(),
        attentionFocus: retainedAttentionFocus,
        commandSequence: state.integration.commandSequence,
      },
      pendingCommands: [],
      subscriptionFailures: [],
    };
    next = applyPortfolioMessage(next, { type: "portfolio/context-cleared" });
    next = requestContext(next, message.projectRoot);
    return next;
  }
  if (message.type === "aggregate/project-activation-requested") {
    return message.projectRoot === state.projectRoot
      ? state
      : enqueueAggregateCommand(state, {
          type: "aggregate.activate-project",
          projectRoot: message.projectRoot,
        });
  }
  if (message.type === "aggregate/surface-requested") {
    return requestSurface(state, message.surface, message.runFocus ?? null);
  }
  if (message.type === "aggregate/context-retry-requested") {
    return requestContext(state, state.projectRoot);
  }
  if (message.type === "aggregate/registry-changed") {
    return applyPortfolioMessage(state, { type: "portfolio/refresh-requested" });
  }
  if (message.type === "aggregate/subscription-ticked") {
    const admitted = selectDeveloperControlAggregateSubscriptions(state).find(
      (subscription) => sameStructuredValue(subscription, message.subscription),
    );
    if (!admitted || admitted.type === "aggregate.project-registry") return state;
    return admitted.type === "build.poll"
      ? applyBuildMessage(state, { type: "build/poll-ticked" })
      : applyPortfolioMessage(state, { type: "portfolio/poll-ticked" });
  }
  if (message.type === "aggregate/subscription-failed") {
    const subscription = selectDeveloperControlAggregateSubscriptions(state).find(
      (candidate) => sameStructuredValue(candidate, message.subscription),
    );
    if (!subscription) return state;
    const failure: DeveloperControlAggregateSubscriptionFailure = {
      subscriptionId: subscription.subscriptionId,
      subscriptionType: subscription.type,
      projectRoot: subscription.type === "aggregate.project-registry"
        ? null
        : subscription.projectRoot,
      basisRevision: subscription.type === "aggregate.project-registry"
        ? null
        : subscription.basisRevision,
      error: message.error,
    };
    return {
      ...state,
      subscriptionFailures: [
        ...state.subscriptionFailures.filter(
          (entry) => entry.subscriptionId !== subscription.subscriptionId,
        ),
        failure,
      ].slice(-40),
      membraneErrors: [
        ...state.membraneErrors,
        `Subscription ${subscription.subscriptionId} failed: ${message.error}`,
      ].slice(-40),
    };
  }
  if (message.type === "aggregate/host-message") {
    if (isCorrelatedHostResultDelivery(message.message)) {
      return rejectExternalHostResultDelivery(state, message.message);
    }
    return applyHostMessage(state, message.message);
  }
  if (message.type === "aggregate/workbench-message") {
    return {
      ...state,
      workbench: updateProjectWorkbench(state.workbench, message.message).state,
    };
  }
  if (message.type === "aggregate/portfolio-message") {
    if (isCorrelatedCapabilityDelivery(message.message)) {
      return rejectExternalCapabilityDelivery(state, message.message);
    }
    return applyPortfolioMessage(state, message.message);
  }
  if (message.type === "aggregate/proposal-message") {
    if (isCorrelatedCapabilityDelivery(message.message)) {
      return rejectExternalCapabilityDelivery(state, message.message);
    }
    return applyProposalMessage(state, message.message);
  }
  if (message.type === "aggregate/build-message") {
    if (isCorrelatedCapabilityDelivery(message.message)) {
      return rejectExternalCapabilityDelivery(state, message.message);
    }
    return applyBuildMessage(state, message.message);
  }
  if (message.type === "aggregate/assurance-message") {
    if (isCorrelatedCapabilityDelivery(message.message)) {
      return rejectExternalCapabilityDelivery(state, message.message);
    }
    return applyAssuranceMessage(state, message.message);
  }
  if (message.type === "aggregate/run-observation-message") {
    return applyRunObservationMessage(state, message.message);
  }
  if (message.type === "aggregate/command-started") {
    const command = state.pendingCommands.find(
      (pending) => pending.aggregateCommandId === message.aggregateCommandId,
    );
    if (!command || command.status !== "queued") return state;
    return {
      ...state,
      pendingCommands: state.pendingCommands.map((command) => (
        command.aggregateCommandId === message.aggregateCommandId
          ? { ...command, status: "running" }
          : command
      )),
    };
  }
  if (message.type === "aggregate/command-resolved") {
    return resolveAggregateCommand(
      state,
      message.aggregateCommandId,
      message.result,
    );
  }
  const failedCommand = state.pendingCommands.find(
    (command) => command.aggregateCommandId === message.aggregateCommandId,
  );
  if (!failedCommand || failedCommand.status !== "running") return state;
  const withoutCommand = {
    ...state,
    pendingCommands: state.pendingCommands.filter(
      (command) => command.aggregateCommandId !== message.aggregateCommandId,
    ),
  };
  return withMembraneError(
    failAggregateOwnerCommand(withoutCommand, failedCommand, message.error),
    `${message.aggregateCommandId}: ${message.error}`,
  );
}

export function createDeveloperControlAggregateState(
  projectRoot: string,
  initialSurface: DeveloperControlSurface = "project-workbench",
  initialRunFocus: RunInspectorFocus | null = null,
): DeveloperControlAggregateState {
  const base: DeveloperControlAggregateState = {
    projectRoot: "",
    runFocus: null,
    hostCommandSequence: 0,
    aggregateCommandSequence: 0,
    host: createDeveloperControlHostState(initialSurface),
    workbench: INITIAL_PROJECT_WORKBENCH_STATE,
    portfolio: createBuildPortfolioState(),
    proposal: createSpecificationProposalState(),
    build: createBuildControlState(),
    assurance: createAssuranceAttentionState(),
    runObservation: INITIAL_RUN_OBSERVATION_STATE,
    integration: createDeveloperControlIntegrationState(),
    pendingCommands: [],
    membraneErrors: [],
    subscriptionFailures: [],
  };
  const initialized = reduceDeveloperControlAggregate(base, {
    type: "aggregate/project-observed",
    projectRoot,
  });
  return {
    ...initialized,
    runFocus: initialRunFocus?.projectRoot === projectRoot ? initialRunFocus : null,
  };
}

export function selectDeveloperControlAggregateSubscriptions(
  state: DeveloperControlAggregateState,
): DeveloperControlAggregateSubscription[] {
  const subscriptions: DeveloperControlAggregateSubscription[] = [{
    type: "aggregate.project-registry",
    subscriptionId: "aggregate.project-registry",
  }];
  const context = state.host.bootstrap?.context;
  if (!context || context.project.root !== state.projectRoot) return subscriptions;
  subscriptions.push(
    ...buildControlSubscriptions(
      state.build,
      context.project.root,
      context.revision,
    ).map(
      (subscription) => ({
        ...subscription,
        subscriptionId: [
          `aggregate.${subscription.type}`,
          encodeURIComponent(subscription.projectRoot),
          subscriptionRevisionIdentity(subscription.basisRevision),
        ].join(":"),
      }),
    ),
    ...buildPortfolioSubscriptions(
      state.portfolio,
      context.project.root,
      context.revision,
    ).map(
      (subscription) => ({
        ...subscription,
        subscriptionId: [
          `aggregate.${subscription.type}`,
          encodeURIComponent(subscription.projectRoot),
          subscriptionRevisionIdentity(subscription.basisRevision),
        ].join(":"),
      }),
    ),
  );
  return subscriptions;
}

export function selectDeveloperControlPresentedSurface(
  state: DeveloperControlAggregateState,
): DeveloperControlSurface {
  return state.host.activeSurface;
}

export function updateDeveloperControlAggregate(
  state: DeveloperControlAggregateState,
  message: DeveloperControlAggregateMessage,
): DeveloperControlAggregateUpdate {
  const existingCommandIds = new Set(
    state.pendingCommands.map((command) => command.aggregateCommandId),
  );
  const reduced = reduceDeveloperControlAggregate(state, message);
  const next = reconcileIntegration(reduced);
  return {
    state: next,
    commands: next.pendingCommands.filter(
      (command) => !existingCommandIds.has(command.aggregateCommandId),
    ),
  };
}

export function replayDeveloperControlAggregate(
  state: DeveloperControlAggregateState,
  messages: DeveloperControlAggregateMessage[],
) {
  const commands: DeveloperControlAggregateCommand[] = [];
  let current = state;
  for (const message of messages) {
    const update = updateDeveloperControlAggregate(current, message);
    current = update.state;
    commands.push(...update.commands);
  }
  return { state: current, commands };
}
