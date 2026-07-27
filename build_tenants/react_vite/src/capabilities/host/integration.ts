import type { AssuranceAttentionMessage } from "../assurance-attention";
import type { BuildControlMessage } from "../build-control";
import type { BuildPortfolioAttentionFocus } from "../build-portfolio";
import type { ProjectWorkbenchMessage } from "../project-workbench";
import type { SpecificationProposalMessage } from "../specification-proposal";

type IntegrationCommandBase = {
  commandId: string;
};

export type DeveloperControlIntegrationCommand =
  | (IntegrationCommandBase & {
      type: "integration.activate-project";
      projectRoot: string;
    })
  | (IntegrationCommandBase & {
      type: "integration.dispatch-workbench";
      message: ProjectWorkbenchMessage;
    })
  | (IntegrationCommandBase & {
      type: "integration.dispatch-proposal";
      message: SpecificationProposalMessage;
    })
  | (IntegrationCommandBase & {
      type: "integration.dispatch-build";
      message: BuildControlMessage;
    })
  | (IntegrationCommandBase & {
      type: "integration.dispatch-assurance";
      message: AssuranceAttentionMessage;
    });

type UnidentifiedIntegrationCommand =
  DeveloperControlIntegrationCommand extends infer Command
    ? Command extends DeveloperControlIntegrationCommand
      ? Omit<Command, "commandId">
      : never
    : never;

export type DeveloperControlIntegrationState = {
  attentionFocus: BuildPortfolioAttentionFocus | null;
  attentionPrepared: boolean;
  pendingCommands: DeveloperControlIntegrationCommand[];
  commandSequence: number;
};

export type DeveloperControlIntegrationMessage =
  | {
      type: "integration/attention-observed";
      focus: BuildPortfolioAttentionFocus;
      activeProjectRoot: string;
    }
  | {
      type: "integration/reconcile";
      activeProjectRoot: string;
      contextProjectRoot: string | null;
      buildExecutionIds: string[];
      buildProjectionReady: boolean;
      assuranceAttentionIds: string[];
      assuranceProjectionReady: boolean;
    }
  | {
      type: "integration/command-consumed";
      commandId: string;
    };

export type DeveloperControlIntegrationUpdate = {
  state: DeveloperControlIntegrationState;
  commands: DeveloperControlIntegrationCommand[];
};

export function createDeveloperControlIntegrationState(): DeveloperControlIntegrationState {
  return {
    attentionFocus: null,
    attentionPrepared: false,
    pendingCommands: [],
    commandSequence: 0,
  };
}

function issueCommands(
  state: DeveloperControlIntegrationState,
  commands: UnidentifiedIntegrationCommand[],
) {
  let sequence = state.commandSequence;
  const issued = commands.map((command) => {
    sequence += 1;
    return {
      ...command,
      commandId: `developer-control-integration-${sequence}`,
    } as DeveloperControlIntegrationCommand;
  });
  return { issued, sequence };
}

function withCommands(
  state: DeveloperControlIntegrationState,
  commands: UnidentifiedIntegrationCommand[],
  patch: Partial<DeveloperControlIntegrationState> = {},
): DeveloperControlIntegrationUpdate {
  const { issued, sequence } = issueCommands(state, commands);
  return {
    state: {
      ...state,
      ...patch,
      commandSequence: sequence,
      pendingCommands: [...state.pendingCommands, ...issued],
    },
    commands: issued,
  };
}

function executionIdFromFocus(focus: BuildPortfolioAttentionFocus) {
  if (focus.sourceKind !== "build-execution") return null;
  return focus.sourceRef.startsWith("build-execution://")
    ? focus.sourceRef.slice("build-execution://".length)
    : null;
}

export function updateDeveloperControlIntegration(
  state: DeveloperControlIntegrationState,
  message: DeveloperControlIntegrationMessage,
): DeveloperControlIntegrationUpdate {
  if (message.type === "integration/command-consumed") {
    return {
      state: {
        ...state,
        pendingCommands: state.pendingCommands.filter(
          (command) => command.commandId !== message.commandId,
        ),
      },
      commands: [],
    };
  }

  if (message.type === "integration/attention-observed") {
    const patch = {
      attentionFocus: message.focus,
      attentionPrepared: false,
    };
    if (message.focus.projectRoot === message.activeProjectRoot) {
      return {
        state: {
          ...state,
          ...patch,
        },
        commands: [],
      };
    }
    return withCommands(
      state,
      [{
        type: "integration.activate-project",
        projectRoot: message.focus.projectRoot,
      }],
      patch,
    );
  }

  const focus = state.attentionFocus;
  if (
    !focus
    || message.activeProjectRoot !== focus.projectRoot
    || message.contextProjectRoot !== focus.projectRoot
  ) {
    return { state, commands: [] };
  }

  const commands: UnidentifiedIntegrationCommand[] = [];
  if (!state.attentionPrepared) {
    if (focus.targetCapabilityId === "specification-proposal") {
      commands.push(
        {
          type: "integration.dispatch-workbench",
          message: { type: "workbench/phase-selected", phase: "tune" },
        },
        {
          type: "integration.dispatch-proposal",
          message: {
            type: "proposal/context-attached",
            sourceRef: focus.sourceRef,
          },
        },
      );
      return withCommands(state, commands, {
        attentionFocus: null,
        attentionPrepared: false,
      });
    }

    if (focus.targetCapabilityId === "build-control") {
      commands.push({
        type: "integration.dispatch-workbench",
        message: { type: "workbench/phase-selected", phase: "build" },
      });
    } else {
      commands.push(
        {
          type: "integration.dispatch-workbench",
          message: { type: "workbench/phase-selected", phase: "assure" },
        },
        {
          type: "integration.dispatch-assurance",
          message: { type: "assurance/filter-selected", filter: "attention" },
        },
      );
    }
  }

  if (focus.targetCapabilityId === "build-control") {
    const executionId = executionIdFromFocus(focus);
    if (!executionId) {
      return withCommands(state, commands, {
        attentionFocus: null,
        attentionPrepared: false,
      });
    }
    if (message.buildExecutionIds.includes(executionId)) {
      commands.push({
        type: "integration.dispatch-build",
        message: { type: "build/execution-selected", executionId },
      });
      return withCommands(state, commands, {
        attentionFocus: null,
        attentionPrepared: false,
      });
    }
    if (message.buildProjectionReady) {
      return withCommands(state, commands, {
        attentionFocus: null,
        attentionPrepared: false,
      });
    }
    return withCommands(state, commands, {
      attentionPrepared: true,
    });
  }

  if (message.assuranceAttentionIds.includes(focus.attentionId)) {
    commands.push({
      type: "integration.dispatch-assurance",
      message: {
        type: "attention/item-selected",
        attentionId: focus.attentionId,
      },
    });
    return withCommands(state, commands, {
      attentionFocus: null,
      attentionPrepared: false,
    });
  }
  if (message.assuranceProjectionReady) {
    return withCommands(state, commands, {
      attentionFocus: null,
      attentionPrepared: false,
    });
  }
  return withCommands(state, commands, {
    attentionPrepared: true,
  });
}

export function replayDeveloperControlIntegration(
  state: DeveloperControlIntegrationState,
  messages: DeveloperControlIntegrationMessage[],
) {
  const commands: DeveloperControlIntegrationCommand[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateDeveloperControlIntegration(current, message);
    current = result.state;
    commands.push(...result.commands);
  }
  return { state: current, commands };
}
