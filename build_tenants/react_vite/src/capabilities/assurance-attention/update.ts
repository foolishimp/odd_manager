import type { ProjectRevision } from "@odd-manager/developer-control-contracts";
import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { AssuranceAttentionMessage } from "./messages";
import type {
  AssuranceAttentionCommand,
  AssuranceAttentionState,
} from "./state";

const INSPECT_REACTION = "reaction://odd_manager/open-run-inspector";

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

function pendingCommand(state: AssuranceAttentionState, commandId: string) {
  return state.pendingCommands.find((entry) => entry.commandId === commandId) ?? null;
}

function withoutCommand(state: AssuranceAttentionState, commandId: string) {
  return state.pendingCommands.filter((entry) => entry.commandId !== commandId);
}

function enqueueLoad(state: AssuranceAttentionState) {
  if (!state.project || !state.basisRevision) return { state, commands: [] };
  if (state.pendingCommands.some((entry) => entry.type === "assurance.load")) {
    return { state, commands: [] };
  }
  const commandSequence = state.commandSequence + 1;
  const command: AssuranceAttentionCommand = {
    type: "assurance.load",
    commandId: `assurance-load-${commandSequence}`,
    correlationId: `assurance:${state.project.root}:${state.executionId ?? "latest"}:${commandSequence}`,
    projectRoot: state.project.root,
    basisRevision: state.basisRevision,
    project: state.project,
    executionId: state.executionId,
  };
  return {
    state: {
      ...state,
      status: state.snapshot ? state.status : "loading" as const,
      commandSequence,
      pendingCommands: [...state.pendingCommands, command],
      error: null,
    },
    commands: [command],
  };
}

function enqueueInspector(
  state: AssuranceAttentionState,
  sourceRef: string,
): CapabilityUpdate<AssuranceAttentionState, AssuranceAttentionCommand> {
  if (!state.project || !state.basisRevision) return { state, commands: [] };
  const commandSequence = state.commandSequence + 1;
  const command: AssuranceAttentionCommand = {
    type: "assurance.open-run-inspector",
    commandId: `assurance-inspect-${commandSequence}`,
    correlationId: `assurance:${state.project.root}:inspect:${commandSequence}`,
    projectRoot: state.project.root,
    basisRevision: state.basisRevision,
    executionId: state.snapshot?.execution?.executionId ?? state.executionId,
    runRef: state.snapshot?.execution?.runRefs[0] ?? null,
    revision: state.snapshot?.revision?.revision ?? state.basisRevision.revision,
    sourceRef,
  };
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

function defaultSelection(snapshot: AssuranceAttentionState["snapshot"]) {
  return snapshot?.gateAssessments[0]?.gateRef
    ?? snapshot?.assetDeliveries[0]?.requirementRef
    ?? null;
}

export function updateAssuranceAttention(
  state: AssuranceAttentionState,
  message: AssuranceAttentionMessage,
): CapabilityUpdate<AssuranceAttentionState, AssuranceAttentionCommand> {
  if (message.type === "assurance/context-changed") {
    const projectChanged = state.project?.root !== message.project.root;
    const basisChanged = !sameBasis(state.basisRevision, message.revision);
    const executionChanged = state.executionId !== message.executionId;
    const next: AssuranceAttentionState = {
      ...state,
      project: message.project,
      basisRevision: message.revision,
      executionId: message.executionId,
      status: message.revision ? "idle" : "error",
      snapshot: projectChanged ? null : state.snapshot,
      selectedAssessmentRef: projectChanged ? null : state.selectedAssessmentRef,
      selectedAttentionId: projectChanged ? null : state.selectedAttentionId,
      pendingCommands: projectChanged || basisChanged || executionChanged ? [] : state.pendingCommands,
      error: message.revision ? null : "Assurance requires an admitted Project Revision.",
    };
    if (!message.revision) return { state: next, commands: [] };
    if (!projectChanged && !basisChanged && !executionChanged && state.snapshot) {
      return { state: { ...next, status: state.status }, commands: [] };
    }
    return enqueueLoad(next);
  }
  if (message.type === "assurance/refresh-requested") return enqueueLoad(state);
  if (message.type === "assurance/filter-selected") {
    return { state: { ...state, filter: message.filter }, commands: [] };
  }
  if (message.type === "assurance/assessment-selected") {
    const exists = state.snapshot?.gateAssessments.some((entry) => entry.gateRef === message.assessmentRef)
      || state.snapshot?.assetDeliveries.some((entry) => entry.requirementRef === message.assessmentRef);
    return exists
      ? { state: { ...state, selectedAssessmentRef: message.assessmentRef }, commands: [] }
      : { state, commands: [] };
  }
  if (message.type === "attention/item-selected") {
    const exists = state.snapshot?.attentionItems.some((entry) => entry.attentionId === message.attentionId);
    return exists
      ? { state: { ...state, selectedAttentionId: message.attentionId }, commands: [] }
      : { state, commands: [] };
  }
  if (message.type === "attention/reaction-requested") {
    const item = state.snapshot?.attentionItems.find((entry) => entry.attentionId === message.attentionId) ?? null;
    if (!item?.reactionRefs.includes(message.reactionRef)) return { state, commands: [] };
    if (message.reactionRef !== INSPECT_REACTION) {
      return {
        state: { ...state, error: `Reaction carrier is not installed: ${message.reactionRef}.` },
        commands: [],
      };
    }
    return enqueueInspector(state, item.sourceRef);
  }
  if (message.type === "assurance/run-inspector-requested") {
    return enqueueInspector(state, state.snapshot?.evidenceBundleRef ?? "run://selected");
  }

  const command = pendingCommand(state, message.commandId);
  if (!command) return { state, commands: [] };
  if (message.type === "assurance/supporting-command-consumed") {
    return {
      state: { ...state, pendingCommands: withoutCommand(state, message.commandId) },
      commands: [],
    };
  }
  if (message.type === "assurance/load-succeeded") {
    if (
      command.type !== "assurance.load"
      || command.projectRoot !== state.project?.root
      || message.projectRoot !== state.project.root
      || message.snapshot.projectRoot !== state.project.root
    ) return { state, commands: [] };
    const current = sameBasis(state.basisRevision, message.snapshot.revision);
    const executionId = message.snapshot.execution?.executionId ?? null;
    if (command.executionId && command.executionId !== executionId) return { state, commands: [] };
    return {
      state: {
        ...state,
        status: current ? "ready" : "stale",
        executionId,
        snapshot: message.snapshot,
        selectedAssessmentRef: state.selectedAssessmentRef
          && (
            message.snapshot.gateAssessments.some((entry) => entry.gateRef === state.selectedAssessmentRef)
            || message.snapshot.assetDeliveries.some((entry) => entry.requirementRef === state.selectedAssessmentRef)
          )
          ? state.selectedAssessmentRef
          : defaultSelection(message.snapshot),
        selectedAttentionId: state.selectedAttentionId
          && message.snapshot.attentionItems.some((entry) => entry.attentionId === state.selectedAttentionId)
          ? state.selectedAttentionId
          : message.snapshot.attentionItems[0]?.attentionId ?? null,
        pendingCommands: withoutCommand(state, message.commandId),
        error: current ? null : "Assurance response is stale against current Project Context.",
      },
      commands: [],
    };
  }
  return {
    state: {
      ...state,
      status: "error",
      pendingCommands: withoutCommand(state, message.commandId),
      error: message.error,
    },
    commands: [],
  };
}

export function replayAssuranceAttentionMessages(
  state: AssuranceAttentionState,
  messages: AssuranceAttentionMessage[],
) {
  const commands: AssuranceAttentionCommand[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateAssuranceAttention(current, message);
    current = result.state;
    commands.push(...result.commands);
  }
  return { state: current, commands };
}
