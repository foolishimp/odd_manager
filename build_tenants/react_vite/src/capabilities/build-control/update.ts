import type {
  BuildControlSnapshot,
  BuildExecution,
  ProjectRevision,
} from "@odd-manager/developer-control-contracts";
import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { BuildControlMessage } from "./messages";
import type {
  BuildControlCommand,
  BuildControlState,
} from "./state";

function sameBasis(left: ProjectRevision | null, right: ProjectRevision | null) {
  return Boolean(
    left
    && right
    && left.kind === right.kind
    && left.revision === right.revision
    && left.dirty === right.dirty
    && left.sourceDigest === right.sourceDigest
    && left.specificationDigest === right.specificationDigest,
  );
}

function pendingCommand(state: BuildControlState, commandId: string) {
  return state.pendingCommands.find((command) => command.commandId === commandId) ?? null;
}

function withoutCommand(state: BuildControlState, commandId: string) {
  return state.pendingCommands.filter((command) => command.commandId !== commandId);
}

type CommandInput =
  | { type: "build.load" }
  | { type: "build.submit"; inputs: unknown; requestedBy: string }
  | { type: "build.attach" | "build.cancel" | "build.resume"; executionId: string; actorRef: string };

function enqueue(
  state: BuildControlState,
  input: CommandInput,
): CapabilityUpdate<BuildControlState, BuildControlCommand> {
  if (!state.project || !state.basisRevision) return { state, commands: [] };
  if (state.pendingCommands.some((command) => (
    command.type === input.type
    && (input.type === "build.load"
      || ("executionId" in input && "executionId" in command && command.executionId === input.executionId))
  ))) return { state, commands: [] };
  const commandSequence = state.commandSequence + 1;
  const identity = {
    commandId: `build-${input.type.slice("build.".length)}-${commandSequence}`,
    correlationId: `build:${state.project.root}:${commandSequence}`,
    projectRoot: state.project.root,
    basisRevision: state.basisRevision,
  };
  const command = input.type === "build.submit"
    ? { ...input, ...identity, project: state.project }
    : { ...input, ...identity } as BuildControlCommand;
  return {
    state: {
      ...state,
      commandSequence,
      pendingCommands: [...state.pendingCommands, command],
      error: null,
    },
    commands: [command],
  };
}

function beginLoad(state: BuildControlState) {
  const result = enqueue(state, { type: "build.load" });
  return {
    ...result,
    state: { ...result.state, status: state.snapshot ? state.status : "loading" as const },
  };
}

function replaceExecution(snapshot: BuildControlSnapshot, execution: BuildExecution) {
  return {
    ...snapshot,
    executions: [
      execution,
      ...snapshot.executions.filter((entry) => entry.executionId !== execution.executionId),
    ],
  };
}

function chooseExecution(snapshot: BuildControlSnapshot, selectedExecutionId: string | null) {
  if (selectedExecutionId && snapshot.executions.some((entry) => entry.executionId === selectedExecutionId)) {
    return selectedExecutionId;
  }
  return [...snapshot.executions]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.executionId ?? null;
}

function admitSnapshot(
  state: BuildControlState,
  commandId: string,
  snapshot: BuildControlSnapshot,
): CapabilityUpdate<BuildControlState, BuildControlCommand> {
  const currentBasis = sameBasis(state.basisRevision, snapshot.revision);
  const selectedExecutionId = chooseExecution(snapshot, state.selectedExecutionId);
  let next: BuildControlState = {
    ...state,
    status: currentBasis ? "ready" : "stale",
    snapshot,
    selectedExecutionId,
    attached: state.attached?.execution.executionId === selectedExecutionId ? state.attached : null,
    pendingCommands: withoutCommand(state, commandId),
    error: currentBasis ? null : "Project Revision changed; refresh Context before submitting another build.",
  };
  if (!selectedExecutionId) return { state: next, commands: [] };
  const attach = enqueue(next, {
    type: "build.attach",
    executionId: selectedExecutionId,
    actorRef: "actor://operator/current",
  });
  next = attach.state;
  return { state: next, commands: attach.commands };
}

export function updateBuildControl(
  state: BuildControlState,
  message: BuildControlMessage,
): CapabilityUpdate<BuildControlState, BuildControlCommand> {
  if (message.type === "build/context-changed") {
    const projectChanged = state.project?.root !== message.project.root;
    const basisChanged = !sameBasis(state.basisRevision, message.revision);
    const next: BuildControlState = {
      ...state,
      project: message.project,
      basisRevision: message.revision,
      status: message.revision ? "idle" : "error",
      snapshot: projectChanged ? null : state.snapshot,
      selectedExecutionId: projectChanged ? null : state.selectedExecutionId,
      attached: projectChanged || basisChanged ? null : state.attached,
      pendingCommands: [],
      error: message.revision ? null : "Build Control requires an admitted Project Revision.",
    };
    return message.revision ? beginLoad(next) : { state: next, commands: [] };
  }
  if (message.type === "build/input-edited") {
    return { state: { ...state, inputDraft: message.value, error: null }, commands: [] };
  }
  if (message.type === "build/refresh-requested") return beginLoad(state);
  if (message.type === "build/submit-requested") {
    if (state.status === "stale" || state.snapshot?.descriptorAdmission.status !== "ready") {
      return { state, commands: [] };
    }
    let inputs: unknown;
    try {
      inputs = JSON.parse(state.inputDraft);
    } catch {
      return { state: { ...state, status: "error", error: "Build inputs must be valid JSON." }, commands: [] };
    }
    const result = enqueue(state, { type: "build.submit", inputs, requestedBy: message.actorRef });
    return { ...result, state: { ...result.state, status: "submitting" } };
  }
  if (message.type === "build/execution-selected") {
    if (!state.snapshot?.executions.some((entry) => entry.executionId === message.executionId)) {
      return { state, commands: [] };
    }
    const next = { ...state, selectedExecutionId: message.executionId, attached: null };
    return enqueue(next, {
      type: "build.attach",
      executionId: message.executionId,
      actorRef: "actor://operator/current",
    });
  }
  if (message.type === "build/attach-requested") {
    if (!state.selectedExecutionId) return { state, commands: [] };
    return enqueue(state, {
      type: "build.attach",
      executionId: state.selectedExecutionId,
      actorRef: message.actorRef,
    });
  }
  if (message.type === "build/cancel-requested") {
    if (!state.selectedExecutionId) return { state, commands: [] };
    const result = enqueue(state, {
      type: "build.cancel",
      executionId: state.selectedExecutionId,
      actorRef: message.actorRef,
    });
    return { ...result, state: { ...result.state, status: "cancelling" } };
  }
  if (message.type === "build/resume-requested") {
    if (!state.selectedExecutionId) return { state, commands: [] };
    const execution = state.snapshot?.executions.find(
      (entry) => entry.executionId === state.selectedExecutionId,
    ) ?? null;
    if (!execution || !["stale", "disconnected"].includes(execution.state)) {
      return { state, commands: [] };
    }
    const result = enqueue(state, {
      type: "build.resume",
      executionId: state.selectedExecutionId,
      actorRef: message.actorRef,
    });
    return { ...result, state: { ...result.state, status: "resuming" } };
  }

  const command = pendingCommand(state, message.commandId);
  if (!command) return { state, commands: [] };
  if (command.projectRoot !== state.project?.root || message.type !== "build/command-failed" && message.projectRoot !== state.project.root) {
    return { state, commands: [] };
  }
  if (message.type === "build/snapshot-loaded") {
    if (command.type !== "build.load" || message.snapshot.projectRoot !== state.project.root) {
      return { state, commands: [] };
    }
    return admitSnapshot(state, message.commandId, message.snapshot);
  }
  if (message.type === "build/submitted") {
    if (
      command.type !== "build.submit"
      || message.result.request.project.root !== state.project.root
      || !sameBasis(command.basisRevision, message.result.request.revision)
    ) return { state, commands: [] };
    const next: BuildControlState = {
      ...state,
      status: "ready",
      snapshot: message.result.snapshot,
      selectedExecutionId: message.result.execution.executionId,
      attached: null,
      pendingCommands: withoutCommand(state, message.commandId),
      error: null,
    };
    return enqueue(next, {
      type: "build.attach",
      executionId: message.result.execution.executionId,
      actorRef: "actor://operator/current",
    });
  }
  if (message.type === "build/attached") {
    if (command.type !== "build.attach" || command.executionId !== message.attached.execution.executionId) {
      return { state, commands: [] };
    }
    return {
      state: {
        ...state,
        status: state.status === "stale" ? "stale" : "ready",
        snapshot: state.snapshot ? replaceExecution(state.snapshot, message.attached.execution) : state.snapshot,
        attached: state.selectedExecutionId === message.attached.execution.executionId
          ? message.attached
          : state.attached,
        pendingCommands: withoutCommand(state, message.commandId),
        error: state.status === "stale" ? state.error : null,
      },
      commands: [],
    };
  }
  if (message.type === "build/cancelled") {
    if (command.type !== "build.cancel" || command.executionId !== message.execution.executionId) {
      return { state, commands: [] };
    }
    const next: BuildControlState = {
      ...state,
      status: "ready",
      snapshot: state.snapshot ? replaceExecution(state.snapshot, message.execution) : state.snapshot,
      pendingCommands: withoutCommand(state, message.commandId),
      error: null,
    };
    return beginLoad(next);
  }
  if (message.type === "build/resumed") {
    if (command.type !== "build.resume" || command.executionId !== message.execution.executionId) {
      return { state, commands: [] };
    }
    const next: BuildControlState = {
      ...state,
      status: "ready",
      snapshot: state.snapshot ? replaceExecution(state.snapshot, message.execution) : state.snapshot,
      selectedExecutionId: message.execution.executionId,
      pendingCommands: withoutCommand(state, message.commandId),
      error: null,
    };
    return enqueue(next, {
      type: "build.attach",
      executionId: message.execution.executionId,
      actorRef: "actor://operator/current",
    });
  }

  const execution = message.execution;
  return {
    state: {
      ...state,
      status: "error",
      snapshot: execution && state.snapshot ? replaceExecution(state.snapshot, execution) : state.snapshot,
      pendingCommands: withoutCommand(state, message.commandId),
      error: message.error,
    },
    commands: [],
  };
}

export function replayBuildControlMessages(
  state: BuildControlState,
  messages: BuildControlMessage[],
) {
  const commands: BuildControlCommand[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateBuildControl(current, message);
    current = result.state;
    commands.push(...result.commands);
  }
  return { state: current, commands };
}
