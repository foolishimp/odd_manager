import type {
  CapabilityId,
  CapabilitySubscription,
  DeveloperControlBootstrap,
} from "@odd-manager/developer-control-contracts";
import type {
  DeveloperControlHostCommand,
  DeveloperControlHostMessage,
  DeveloperControlSurface,
  CapabilityEventDelivery,
} from "../../contracts/developer-control";

export const DEVELOPER_CONTROL_CAPABILITY_IDS: CapabilityId[] = [
  "build-portfolio",
  "project-workbench",
  "specification-proposal",
  "build-control",
  "assurance-attention",
  "run-observation",
];

type HostCommandResult = {
  commandId: string;
  correlationId: string;
  status: "succeeded" | "failed" | "rejected";
  detail: string;
};

export type DeveloperControlHostState = {
  contextStatus: "idle" | "loading" | "ready" | "error";
  requestedProjectRoot: string | null;
  bootstrap: DeveloperControlBootstrap | null;
  registeredCapabilities: CapabilityId[];
  registrationErrors: string[];
  subscriptions: CapabilitySubscription[];
  pendingCommands: DeveloperControlHostCommand[];
  commandResults: HostCommandResult[];
  activeSurface: DeveloperControlSurface;
  requestedSurface: DeveloperControlSurface | null;
  error: string | null;
};

export type HostUpdate = {
  state: DeveloperControlHostState;
  commands: DeveloperControlHostCommand[];
  deliveries?: CapabilityEventDelivery[];
};

export function createDeveloperControlHostState(
  initialSurface: DeveloperControlSurface = "project-workbench",
): DeveloperControlHostState {
  return {
    contextStatus: "idle",
    requestedProjectRoot: null,
    bootstrap: null,
    registeredCapabilities: [...DEVELOPER_CONTROL_CAPABILITY_IDS],
    registrationErrors: [],
    subscriptions: [],
    pendingCommands: [],
    commandResults: [],
    activeSurface: initialSurface,
    requestedSurface: null,
    error: null,
  };
}

function commandForResult(
  state: DeveloperControlHostState,
  commandId: string,
  correlationId: string,
) {
  return state.pendingCommands.find(
    (command) => command.commandId === commandId && command.correlationId === correlationId,
  ) ?? null;
}

function completeCommand(
  state: DeveloperControlHostState,
  commandId: string,
  correlationId: string,
  status: HostCommandResult["status"],
  detail: string,
) {
  return {
    pendingCommands: state.pendingCommands.filter(
      (command) => command.commandId !== commandId || command.correlationId !== correlationId,
    ),
    commandResults: [
      ...state.commandResults,
      { commandId, correlationId, status, detail },
    ].slice(-40),
  };
}

function bootstrapCapabilityIds(bootstrap: DeveloperControlBootstrap) {
  return bootstrap.capabilities.map((capability) => capability.id);
}

function hasExactCapabilitySet(
  registeredCapabilities: CapabilityId[],
  bootstrap: DeveloperControlBootstrap,
) {
  const admitted = bootstrapCapabilityIds(bootstrap);
  return admitted.length === DEVELOPER_CONTROL_CAPABILITY_IDS.length
    && new Set(admitted).size === admitted.length
    && DEVELOPER_CONTROL_CAPABILITY_IDS.every(
      (capabilityId) => registeredCapabilities.includes(capabilityId) && admitted.includes(capabilityId),
    );
}

export function updateDeveloperControlHost(
  state: DeveloperControlHostState,
  message: DeveloperControlHostMessage,
): HostUpdate {
  if (message.type === "host/capability-registered") {
    if (!DEVELOPER_CONTROL_CAPABILITY_IDS.includes(message.capabilityId as CapabilityId)) {
      return {
        state: {
          ...state,
          registrationErrors: [...state.registrationErrors, `Unknown capability: ${message.capabilityId}`],
        },
        commands: [],
      };
    }
    if (state.registeredCapabilities.includes(message.capabilityId as CapabilityId)) {
      return {
        state: {
          ...state,
          registrationErrors: [...state.registrationErrors, `Duplicate capability: ${message.capabilityId}`],
        },
        commands: [],
      };
    }
    return {
      state: {
        ...state,
        registeredCapabilities: [
          ...state.registeredCapabilities,
          message.capabilityId as CapabilityId,
        ],
      },
      commands: [],
    };
  }

  if (message.type === "host/subscription-declared") {
    const subscription = message.subscription;
    if (!state.registeredCapabilities.includes(subscription.capabilityId)) {
      return {
        state: {
          ...state,
          registrationErrors: [
            ...state.registrationErrors,
            `Subscription capability is not registered: ${subscription.capabilityId}`,
          ],
        },
        commands: [],
      };
    }
    if (state.subscriptions.some((entry) => entry.subscriptionId === subscription.subscriptionId)) {
      return {
        state: {
          ...state,
          registrationErrors: [
            ...state.registrationErrors,
            `Duplicate subscription: ${subscription.subscriptionId}`,
          ],
        },
        commands: [],
      };
    }
    return {
      state: {
        ...state,
        subscriptions: [...state.subscriptions, subscription],
      },
      commands: [],
    };
  }

  if (message.type === "host/subscription-cleared") {
    return {
      state: {
        ...state,
        subscriptions: state.subscriptions.filter(
          (subscription) => subscription.subscriptionId !== message.subscriptionId,
        ),
      },
      commands: [],
    };
  }

  if (message.type === "host/subscription-event") {
    const subscription = state.subscriptions.find(
      (entry) => entry.subscriptionId === message.event.subscriptionId,
    );
    if (
      !subscription
      || subscription.capabilityId !== message.event.capabilityId
      || subscription.projectRoot !== message.event.projectRoot
      || subscription.basisRevision !== message.event.basisRevision
      || state.bootstrap?.context.project.root !== message.event.projectRoot
      || (state.bootstrap.context.revision?.revision ?? null) !== message.event.basisRevision
    ) {
      return {
        state: {
          ...state,
          registrationErrors: [
            ...state.registrationErrors,
            `Rejected subscription event: ${message.event.eventId}`,
          ],
        },
        commands: [],
        deliveries: [],
      };
    }
    return {
      state,
      commands: [],
      deliveries: [{
        capabilityId: subscription.capabilityId,
        subscriptionId: subscription.subscriptionId,
        event: message.event,
      }],
    };
  }

  if (message.type === "host/context-requested") {
    const command = message.command;
    return {
      state: {
        ...state,
        contextStatus: "loading",
        requestedProjectRoot: command.projectRoot,
        pendingCommands: [...state.pendingCommands, command],
        error: null,
      },
      commands: [command],
    };
  }

  if (message.type === "host/context-admitted") {
    const command = commandForResult(state, message.commandId, message.correlationId);
    if (!command || command.type !== "host.resolve-context") {
      return {
        state: {
          ...state,
          commandResults: [
            ...state.commandResults,
            {
              commandId: message.commandId,
              correlationId: message.correlationId,
              status: "rejected" as const,
              detail: "Context result has no matching pending command.",
            },
          ].slice(-40),
        },
        commands: [],
      };
    }
    const completion = completeCommand(
      state,
      message.commandId,
      message.correlationId,
      "succeeded",
      "Context carrier returned a validated bootstrap.",
    );
    if (
      state.requestedProjectRoot !== command.projectRoot
      || message.bootstrap.context.project.root !== command.projectRoot
    ) {
      return {
        state: {
          ...state,
          ...completion,
          commandResults: [
            ...completion.commandResults.slice(0, -1),
            {
              commandId: message.commandId,
              correlationId: message.correlationId,
              status: "rejected",
              detail: "Context result basis does not match the latest Project request.",
            },
          ],
        },
        commands: [],
      };
    }
    if (!hasExactCapabilitySet(state.registeredCapabilities, message.bootstrap)) {
      return {
        state: {
          ...state,
          ...completion,
          contextStatus: "error",
          error: "Context bootstrap does not match the registered capability set.",
        },
        commands: [],
      };
    }
    return {
      state: {
        ...state,
        ...completion,
        contextStatus: "ready",
        bootstrap: message.bootstrap,
        error: null,
      },
      commands: [],
    };
  }

  if (message.type === "host/context-failed") {
    const command = commandForResult(state, message.commandId, message.correlationId);
    if (!command || command.type !== "host.resolve-context") {
      return { state, commands: [] };
    }
    const completion = completeCommand(
      state,
      message.commandId,
      message.correlationId,
      "failed",
      message.error,
    );
    if (state.requestedProjectRoot !== command.projectRoot) {
      return { state: { ...state, ...completion }, commands: [] };
    }
    return {
      state: {
        ...state,
        ...completion,
        contextStatus: "error",
        error: message.error,
      },
      commands: [],
    };
  }

  if (message.type === "host/navigation-requested") {
    return {
      state: {
        ...state,
        requestedSurface: message.command.surface,
        pendingCommands: [...state.pendingCommands, message.command],
        error: null,
      },
      commands: [message.command],
    };
  }

  if (message.type === "host/navigation-admitted") {
    const command = commandForResult(state, message.commandId, message.correlationId);
    if (!command || command.type !== "host.project-navigation" || command.surface !== message.surface) {
      return { state, commands: [] };
    }
    const completion = completeCommand(
      state,
      message.commandId,
      message.correlationId,
      "succeeded",
      `Focused ${message.surface}.`,
    );
    return {
      state: {
        ...state,
        ...completion,
        activeSurface: message.surface,
        requestedSurface: null,
      },
      commands: [],
    };
  }

  const command = commandForResult(state, message.commandId, message.correlationId);
  if (!command || command.type !== "host.project-navigation") {
    return { state, commands: [] };
  }
  const completion = completeCommand(
    state,
    message.commandId,
    message.correlationId,
    "failed",
    message.error,
  );
  return {
    state: {
      ...state,
      ...completion,
      requestedSurface: null,
      error: message.error,
    },
    commands: [],
  };
}

export function replayDeveloperControlHostMessages(
  state: DeveloperControlHostState,
  messages: DeveloperControlHostMessage[],
) {
  const commands: DeveloperControlHostCommand[] = [];
  const deliveries: CapabilityEventDelivery[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateDeveloperControlHost(current, message);
    current = result.state;
    commands.push(...result.commands);
    deliveries.push(...(result.deliveries ?? []));
  }
  return { state: current, commands, deliveries };
}
