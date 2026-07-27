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

function sameStructuredValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== typeof right
    || left === null
    || right === null
    || typeof left !== "object"
  ) return false;
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

function validBuildTimestamp(value: string | null) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function pendingCommand(state: BuildControlState, commandId: string, correlationId: string) {
  return state.pendingCommands.find((command) => (
    command.commandId === commandId && command.correlationId === correlationId
  )) ?? null;
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

function beginLoad(
  state: BuildControlState,
  queueContinuation = true,
): CapabilityUpdate<BuildControlState, BuildControlCommand> {
  if (state.pendingCommands.some((command) => command.type === "build.load")) {
    return queueContinuation
      ? { state: { ...state, refreshQueued: true }, commands: [] }
      : { state, commands: [] };
  }
  const result = enqueue(state, { type: "build.load" });
  return {
    ...result,
    state: {
      ...result.state,
      status: state.snapshot ? state.status : "loading" as const,
      refreshQueued: false,
    },
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

function sameProjectIdentity(
  left: BuildExecution["project"],
  right: BuildExecution["project"],
) {
  return (
    left.id === right.id
    && left.root === right.root
    && left.label === right.label
    && left.publishedProductRef === right.publishedProductRef
  );
}

function sameExecutionIdentity(left: BuildExecution, right: BuildExecution) {
  return (
    left.executionId === right.executionId
    && left.requestId === right.requestId
    && left.correlationId === right.correlationId
    && sameProjectIdentity(left.project, right.project)
    && sameBasis(left.revision, right.revision)
    && left.worksiteRef === right.worksiteRef
    && left.attempt === right.attempt
  );
}

function executionSemanticsMatch(execution: BuildExecution) {
  const terminalLike = ["waiting_human", "converged", "failed", "cancelled"].includes(
    execution.state,
  );
  const nonTerminal = ["queued", "starting", "running", "stale", "disconnected"].includes(
    execution.state,
  );
  const terminalResult = execution.processOutcome?.terminalResult ?? null;
  return (
    validBuildTimestamp(execution.startedAt)
    && validBuildTimestamp(execution.updatedAt)
    && validBuildTimestamp(execution.completedAt)
    && validBuildTimestamp(execution.heartbeatAt)
    && validBuildTimestamp(execution.resumedAt)
    && validBuildTimestamp(execution.cancelRequestedAt)
    && validBuildTimestamp(execution.processOutcome?.observedAt ?? null)
    &&
    (execution.state === "queued") === (execution.queuePosition !== null)
    && terminalLike === (execution.completedAt !== null)
    && (!nonTerminal || execution.processOutcome === null)
    && (!terminalLike || execution.processOutcome !== null)
    && (
      execution.state !== "running"
      || Boolean(execution.processRef && execution.heartbeatAt)
    )
    && (
      (execution.cancelRequestedAt === null) === (execution.cancelledBy === null)
    )
    && (
      execution.state !== "cancelled"
      || Boolean(
        execution.cancelRequestedAt
        && execution.cancelledBy
        && execution.processOutcome?.kind === "cancelled"
        && terminalResult === null,
      )
    )
    && (
      execution.processOutcome?.kind !== "cancelled"
      || execution.state === "cancelled"
    )
    && (
      execution.state !== "waiting_human"
      || terminalResult?.kind === "waiting_human"
    )
    && (
      execution.state !== "converged"
      || terminalResult?.kind === "converged"
    )
    && (
      execution.state !== "failed"
      || terminalResult === null
      || terminalResult.kind === "failed"
    )
  );
}

function executionTransitionAllowed(
  previous: BuildExecution["state"],
  next: BuildExecution["state"],
) {
  if (previous === next) return true;
  const transitions: Record<BuildExecution["state"], BuildExecution["state"][]> = {
    queued: ["starting", "running", "failed", "cancelled"],
    starting: ["running", "failed", "cancelled", "stale", "disconnected"],
    running: ["waiting_human", "converged", "failed", "cancelled", "stale", "disconnected"],
    waiting_human: ["cancelled"],
    stale: ["disconnected", "running", "cancelled"],
    disconnected: ["running", "cancelled"],
    converged: [],
    failed: [],
    cancelled: [],
  };
  return transitions[previous].includes(next);
}

function timestampDoesNotRegress(previous: string | null, next: string | null) {
  if (previous === null) return true;
  if (next === null) return false;
  const previousTime = Date.parse(previous);
  const nextTime = Date.parse(next);
  return (
    Number.isFinite(previousTime)
    && Number.isFinite(nextTime)
    && nextTime >= previousTime
  );
}

function timestampExtends(previous: string | null, next: string | null) {
  return previous === null || previous === next;
}

function executionDoesNotRegress(
  previous: BuildExecution,
  next: BuildExecution,
) {
  return (
    sameExecutionIdentity(previous, next)
    && executionTransitionAllowed(previous.state, next.state)
    && timestampDoesNotRegress(previous.updatedAt, next.updatedAt)
    && (
      previous.updatedAt !== next.updatedAt
      || sameStructuredValue(previous, next)
    )
    && timestampExtends(previous.startedAt, next.startedAt)
    && timestampExtends(previous.completedAt, next.completedAt)
    && timestampDoesNotRegress(previous.heartbeatAt, next.heartbeatAt)
    && timestampExtends(previous.cancelRequestedAt, next.cancelRequestedAt)
    && timestampExtends(previous.resumedAt, next.resumedAt)
    && (
      previous.cancelledBy === null
      || previous.cancelledBy === next.cancelledBy
    )
    && (
      previous.resumedBy === null
      || previous.resumedBy === next.resumedBy
    )
    && (
      previous.assuranceSummaryRef === null
      || previous.assuranceSummaryRef === next.assuranceSummaryRef
    )
    && (
      previous.processRef === next.processRef
      || (
        ["stale", "disconnected"].includes(previous.state)
        && next.state === "running"
      )
      || (
        previous.processRef === null
        && ["queued", "starting"].includes(previous.state)
        && next.state === "running"
        && next.processRef !== null
      )
    )
    && (
      previous.processOutcome === null
      || sameStructuredValue(previous.processOutcome, next.processOutcome)
    )
    && (
      !["waiting_human", "converged", "failed", "cancelled"].includes(previous.state)
      || sameStructuredValue(previous.runRefs, next.runRefs)
    )
    && previous.sourceRefs.every((entry) => next.sourceRefs.includes(entry))
  );
}

function snapshotMatchesProject(
  snapshot: BuildControlSnapshot,
  project: NonNullable<BuildControlState["project"]>,
) {
  if (
    snapshot.projectRoot !== project.root
    || snapshot.descriptorAdmission.projectRoot !== project.root
    || !validBuildTimestamp(snapshot.observedAt)
    || new Set(snapshot.requests.map((entry) => entry.requestId)).size !== snapshot.requests.length
    || new Set(snapshot.requests.map((entry) => entry.correlationId)).size !== snapshot.requests.length
    || new Set(snapshot.executions.map((entry) => entry.executionId)).size !== snapshot.executions.length
    || new Set(snapshot.executions.map((entry) => entry.requestId)).size !== snapshot.executions.length
    || snapshot.requests.some((entry) => !validBuildTimestamp(entry.requestedAt))
    || snapshot.requests.some((entry) => !sameProjectIdentity(entry.project, project))
    || snapshot.executions.some((entry) => !sameProjectIdentity(entry.project, project))
    || snapshot.executions.some((entry) => !executionSemanticsMatch(entry))
    || snapshot.scheduler.runningCount < snapshot.executions.filter(
      (entry) => ["starting", "running"].includes(entry.state),
    ).length
    || snapshot.scheduler.queuedCount < snapshot.executions.filter(
      (entry) => entry.state === "queued",
    ).length
    || snapshot.scheduler.runningCount > snapshot.scheduler.maxConcurrent
    || snapshot.scheduler.queuedCount > snapshot.scheduler.maxQueued
    || snapshot.scheduler.availableSlots !== Math.max(
      0,
      snapshot.scheduler.maxConcurrent - snapshot.scheduler.runningCount,
    )
  ) {
    return false;
  }
  return snapshot.executions.every((execution) => {
    const request = snapshot.requests.find((entry) => entry.requestId === execution.requestId);
    return Boolean(
      request
      && request.correlationId === execution.correlationId
      && sameProjectIdentity(request.project, execution.project)
      && sameBasis(request.revision, execution.revision),
    );
  });
}

function snapshotPreservesKnownHistory(
  previous: BuildControlSnapshot | null,
  next: BuildControlSnapshot,
) {
  if (!previous) return true;
  return (
    timestampDoesNotRegress(previous.observedAt, next.observedAt)
    && previous.requests.every((known) => {
      const candidate = next.requests.find((entry) => entry.requestId === known.requestId);
      return Boolean(candidate && sameStructuredValue(candidate, known));
    })
    && previous.executions.every((known) => {
      const candidate = next.executions.find(
        (entry) => entry.executionId === known.executionId,
      );
      return Boolean(candidate && executionDoesNotRegress(known, candidate));
    })
  );
}

function targetExecution(
  state: BuildControlState,
  command: BuildControlCommand,
) {
  if (
    command.type === "build.load"
    || command.type === "build.submit"
  ) return null;
  return state.snapshot?.executions.find(
    (entry) => entry.executionId === command.executionId,
  ) ?? null;
}

function executionResultMatches(
  state: BuildControlState,
  command: BuildControlCommand,
  execution: BuildExecution,
) {
  const project = state.project;
  const target = targetExecution(state, command);
  return Boolean(
    project
    && target
    && command.projectRoot === project.root
    && sameBasis(command.basisRevision, state.basisRevision)
    && sameProjectIdentity(execution.project, project)
    && sameExecutionIdentity(execution, target)
    && executionSemanticsMatch(execution)
    && executionDoesNotRegress(target, execution),
  );
}

function failureExecutionMayReplace(
  command: BuildControlCommand,
  execution: BuildExecution,
  target: BuildExecution,
) {
  const cancellationFieldsMatch = command.type === "build.cancel"
    ? (
        execution.cancelRequestedAt !== null
        && execution.cancelledBy === command.actorRef
      )
    : (
        execution.cancelRequestedAt === target.cancelRequestedAt
        && execution.cancelledBy === target.cancelledBy
      );
  return (
    execution.state === target.state
    && execution.processRef === target.processRef
    && execution.queuePosition === target.queuePosition
    && execution.startedAt === target.startedAt
    && execution.completedAt === target.completedAt
    && execution.resumedAt === target.resumedAt
    && execution.resumedBy === target.resumedBy
    && execution.assuranceSummaryRef === target.assuranceSummaryRef
    && sameStructuredValue(execution.runRefs, target.runRefs)
    && sameStructuredValue(execution.processOutcome, target.processOutcome)
    && cancellationFieldsMatch
  );
}

function submitResultMatches(
  state: BuildControlState,
  command: Extract<BuildControlCommand, { type: "build.submit" }>,
  result: Extract<BuildControlMessage, { type: "build/submitted" }>["result"],
) {
  const project = state.project;
  const { request, execution, snapshot } = result;
  const descriptor = snapshot.descriptorAdmission.descriptor;
  const storedRequest = snapshot.requests.find((entry) => entry.requestId === request.requestId);
  const storedExecution = snapshot.executions.find(
    (entry) => entry.executionId === execution.executionId,
  );
  const requestIsFresh = Boolean(
    state.snapshot
    && !state.snapshot.requests.some((entry) => (
      entry.requestId === request.requestId
      || entry.correlationId === request.correlationId
    )),
  );
  const executionIsFresh = Boolean(
    state.snapshot
    && !state.snapshot.executions.some((entry) => (
      entry.executionId === execution.executionId
      || entry.requestId === execution.requestId
      || entry.correlationId === execution.correlationId
    )),
  );
  return Boolean(
    project
    && sameProjectIdentity(command.project, project)
    && command.projectRoot === project.root
    && sameBasis(command.basisRevision, state.basisRevision)
    && sameProjectIdentity(request.project, project)
    && sameBasis(request.revision, command.basisRevision)
    // command.inputs is pre-admission; exact admitted input coherence is
    // established by the returned request's equality with its snapshot row.
    && request.requestedBy === command.requestedBy
    && requestIsFresh
    && executionIsFresh
    && execution.requestId === request.requestId
    && execution.correlationId === request.correlationId
    && sameProjectIdentity(execution.project, request.project)
    && sameBasis(execution.revision, request.revision)
    && snapshotMatchesProject(snapshot, project)
    && snapshotPreservesKnownHistory(state.snapshot, snapshot)
    && sameBasis(snapshot.revision, command.basisRevision)
    && descriptor
    && sameStructuredValue(request.descriptorBinding, descriptor)
    && request.adapterBinding.adapterRef === descriptor.executionAdapterRef
    && request.descriptorRef === descriptor.descriptorRef
    && request.carrierRef === descriptor.carrierRef
    && request.startupConfigRef === descriptor.startupConfigRef
    && request.publicStartTarget === descriptor.publicStartTarget
    && storedRequest
    && sameStructuredValue(storedRequest, request)
    && storedExecution
    && sameStructuredValue(storedExecution, execution)
  );
}

function failureExecutionMatches(
  state: BuildControlState,
  command: BuildControlCommand,
  execution: BuildExecution | null,
) {
  const project = state.project;
  if (
    !project
    || command.projectRoot !== project.root
    || !sameBasis(command.basisRevision, state.basisRevision)
  ) {
    return false;
  }
  if (!execution) return true;
  if (
    command.type === "build.load"
    || command.type === "build.submit"
  ) {
    return false;
  }
  const target = targetExecution(state, command);
  return Boolean(
    target
    && executionResultMatches(state, command, execution)
    && failureExecutionMayReplace(command, execution, target),
  );
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
    refreshQueued: false,
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
    const projectChanged = (
      !state.project
      || !sameProjectIdentity(state.project, message.project)
    );
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
      refreshQueued: false,
      error: message.revision ? null : "Build Control requires an admitted Project Revision.",
    };
    return message.revision ? beginLoad(next) : { state: next, commands: [] };
  }
  if (message.type === "build/input-edited") {
    return { state: { ...state, inputDraft: message.value, error: null }, commands: [] };
  }
  if (message.type === "build/refresh-requested") return beginLoad(state);
  if (message.type === "build/poll-ticked") return beginLoad(state, false);
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

  const command = pendingCommand(state, message.commandId, message.correlationId);
  if (!command) return { state, commands: [] };
  if (
    command.projectRoot !== state.project?.root
    || !sameBasis(command.basisRevision, state.basisRevision)
    || message.type !== "build/command-failed" && message.projectRoot !== state.project.root
  ) {
    return { state, commands: [] };
  }
  if (message.type === "build/snapshot-loaded") {
    if (
      command.type !== "build.load"
      || !state.project
    ) {
      return { state, commands: [] };
    }
    if (state.refreshQueued) {
      return beginLoad({
        ...state,
        pendingCommands: withoutCommand(state, message.commandId),
        refreshQueued: false,
      });
    }
    if (
      !snapshotMatchesProject(message.snapshot, state.project)
      || !snapshotPreservesKnownHistory(state.snapshot, message.snapshot)
    ) return { state, commands: [] };
    return admitSnapshot(state, message.commandId, message.snapshot);
  }
  if (message.type === "build/submitted") {
    if (
      command.type !== "build.submit"
      || !submitResultMatches(state, command, message.result)
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
    if (
      command.type !== "build.attach"
      || !executionResultMatches(state, command, message.attached.execution)
      || message.attached.output.executionId !== message.attached.execution.executionId
      || !validBuildTimestamp(message.attached.output.observedAt)
    ) {
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
    if (
      command.type !== "build.cancel"
      || !executionResultMatches(state, command, message.execution)
      || message.execution.state !== "cancelled"
      || message.execution.cancelledBy !== command.actorRef
    ) {
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
  if (message.type === "build/cancellation-acknowledged") {
    if (
      command.type !== "build.cancel"
      || !executionResultMatches(state, command, message.execution)
      || message.execution.state === "cancelled"
      || message.execution.cancelRequestedAt === null
      || message.execution.cancelledBy !== command.actorRef
    ) {
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
    if (
      command.type !== "build.resume"
      || !executionResultMatches(state, command, message.execution)
      || message.execution.state !== "running"
      || message.execution.resumedAt === null
      || message.execution.resumedBy !== command.actorRef
    ) {
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
  if (!failureExecutionMatches(state, command, execution)) {
    return { state, commands: [] };
  }
  if (command.type === "build.load" && state.refreshQueued) {
    return beginLoad({
      ...state,
      pendingCommands: withoutCommand(state, message.commandId),
      refreshQueued: false,
    });
  }
  return {
    state: {
      ...state,
      status: "error",
      snapshot: execution && state.snapshot ? replaceExecution(state.snapshot, execution) : state.snapshot,
      pendingCommands: withoutCommand(state, message.commandId),
      refreshQueued: command.type === "build.load" ? false : state.refreshQueued,
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
