import type { ProjectRevision, SpecificationProposal } from "@odd-manager/developer-control-contracts";
import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { SpecificationProposalMessage } from "./messages";
import type {
  SpecificationProposalCommand,
  SpecificationProposalState,
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

function sameProjectIdentity(
  left: SpecificationProposal["project"],
  right: SpecificationProposal["project"],
) {
  return (
    left.id === right.id
    && left.root === right.root
    && left.label === right.label
    && left.publishedProductRef === right.publishedProductRef
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

function proposalTarget(
  state: SpecificationProposalState,
  proposalId: string,
) {
  if (state.currentProposal?.proposalId === proposalId) return state.currentProposal;
  return state.history.find((entry) => entry.proposalId === proposalId) ?? null;
}

function proposalImmutableIdentityMatches(
  candidate: SpecificationProposal,
  target: SpecificationProposal,
) {
  return (
    candidate.schemaVersion === target.schemaVersion
    && candidate.proposalId === target.proposalId
    && sameProjectIdentity(candidate.project, target.project)
    && sameBasis(candidate.basisRevision, target.basisRevision)
    && candidate.participantRef === target.participantRef
    && candidate.createdAt === target.createdAt
    && candidate.prompt === target.prompt
    && candidate.summary === target.summary
    && sameStructuredValue(candidate.contextAttachments, target.contextAttachments)
    && candidate.patch === target.patch
    && sameStructuredValue(candidate.affectedSurfaceRefs, target.affectedSurfaceRefs)
    && candidate.predecessorProposalId === target.predecessorProposalId
  );
}

function passingValidation(proposal: SpecificationProposal) {
  return (
    proposal.validation.length > 0
    && proposal.validation.every((entry) => entry.status === "passed")
  );
}

function proposalRecordSemanticsMatch(proposal: SpecificationProposal) {
  if (proposal.status === "draft" && proposal.validation.length > 0) return false;
  if (proposal.status === "valid" && !passingValidation(proposal)) return false;
  if (
    ["invalid", "stale"].includes(proposal.status)
    && (
      proposal.validation.length === 0
      || proposal.validation.every((entry) => entry.status === "passed")
    )
  ) return false;
  if (proposal.status === "accepted") {
    return Boolean(
      proposal.decision?.kind === "accepted"
      && proposal.resultingRevision
      && passingValidation(proposal)
      && sameBasis(proposal.decision.basisRevision, proposal.basisRevision)
      && !sameBasis(proposal.resultingRevision, proposal.basisRevision)
      && sameStructuredValue(
        proposal.decision.changedSurfaceRefs,
        proposal.affectedSurfaceRefs,
      )
    );
  }
  if (proposal.status === "rejected") {
    return (
      proposal.decision?.kind === "rejected"
      && proposal.resultingRevision === null
      && sameBasis(proposal.decision.basisRevision, proposal.basisRevision)
      && proposal.decision.changedSurfaceRefs.length === 0
    );
  }
  return proposal.decision === null && proposal.resultingRevision === null;
}

function proposalHistoryLineageMatches(
  proposals: SpecificationProposal[],
  truncated: boolean,
) {
  const byId = new Map(proposals.map((proposal) => [proposal.proposalId, proposal]));
  for (const proposal of proposals) {
    const predecessorId = proposal.predecessorProposalId;
    if (!predecessorId) continue;
    if (predecessorId === proposal.proposalId) return false;
    if (!byId.has(predecessorId) && !truncated) return false;
  }
  for (const proposal of proposals) {
    const visited = new Set<string>();
    let cursor: SpecificationProposal | undefined = proposal;
    while (cursor?.predecessorProposalId) {
      if (visited.has(cursor.proposalId)) return false;
      visited.add(cursor.proposalId);
      cursor = byId.get(cursor.predecessorProposalId);
    }
  }
  return true;
}

function historyProposalMayAdvance(
  current: SpecificationProposal,
  candidate: SpecificationProposal,
) {
  if (!proposalImmutableIdentityMatches(candidate, current)) return false;
  if (terminalStatus(current.status)) {
    return sameStructuredValue(candidate, current);
  }
  if (candidate.status === "draft" && current.status !== "draft") return false;
  return true;
}

function mergeProposalHistory(
  current: SpecificationProposal[],
  incoming: SpecificationProposal[],
  retentionLimit: number,
  truncated: boolean,
) {
  if (!truncated) return incoming;
  const incomingIds = new Set(incoming.map((proposal) => proposal.proposalId));
  return [
    ...incoming,
    ...current.filter((proposal) => !incomingIds.has(proposal.proposalId)),
  ].slice(0, Math.max(retentionLimit, 1));
}

function proposalSuccessSemanticsMatch(
  state: SpecificationProposalState,
  command: SpecificationProposalCommand,
  proposal: SpecificationProposal,
  target: SpecificationProposal | null,
) {
  if (command.type === "proposal.generate") {
    return (
      proposal.status === "draft"
      && proposal.validation.length === 0
      && proposal.resultingRevision === null
      && proposal.decision === null
      && proposal.proposalId !== command.predecessorProposalId
      && !state.history.some((entry) => entry.proposalId === proposal.proposalId)
    );
  }
  if (!target || command.type === "proposal.history" || command.type === "proposal.refresh-context") {
    return false;
  }
  if (command.type === "proposal.validate") {
    const validationDispositionMatches = proposal.status === "valid"
      ? passingValidation(proposal)
      : (
          ["invalid", "stale"].includes(proposal.status)
          && proposal.validation.length > 0
          && proposal.validation.some((entry) => entry.status !== "passed")
    );
    return (
      !terminalStatus(target.status)
      &&
      validationDispositionMatches
      && proposal.resultingRevision === null
      && proposal.decision === null
    );
  }
  if (command.type === "proposal.accept") {
    return Boolean(
      target.status === "valid"
      && proposal.status === "accepted"
      && passingValidation(proposal)
      && proposal.resultingRevision
      && !sameBasis(proposal.resultingRevision, target.basisRevision)
      && proposal.decision?.kind === "accepted"
      && proposal.decision.actorRef === command.actorRef
      && sameBasis(proposal.decision.basisRevision, target.basisRevision)
      && sameStructuredValue(
        proposal.decision.changedSurfaceRefs,
        proposal.affectedSurfaceRefs,
      )
    );
  }
  return (
    !terminalStatus(target.status)
    &&
    proposal.status === "rejected"
    && proposal.resultingRevision === null
    && proposal.decision?.kind === "rejected"
    && proposal.decision.actorRef === command.actorRef
    && sameBasis(proposal.decision.basisRevision, target.basisRevision)
    && proposal.decision.changedSurfaceRefs.length === 0
  );
}

function failureProposalMayReplace(
  command: SpecificationProposalCommand,
  proposal: SpecificationProposal,
  target: SpecificationProposal,
) {
  if (
    proposal.resultingRevision !== target.resultingRevision
    || !sameStructuredValue(proposal.decision, target.decision)
  ) {
    return false;
  }
  if (command.type === "proposal.accept") {
    return (
      ["valid", "invalid", "stale"].includes(proposal.status)
      && (proposal.status !== "valid" || passingValidation(proposal))
    );
  }
  return proposal.status === target.status;
}

function generatedProposalMatches(
  proposal: SpecificationProposal,
  command: Extract<SpecificationProposalCommand, { type: "proposal.generate" }>,
) {
  return (
    sameProjectIdentity(proposal.project, command.project)
    && sameBasis(proposal.basisRevision, command.basisRevision)
    && proposal.prompt === command.prompt
    && proposal.predecessorProposalId === command.predecessorProposalId
    && sameStructuredValue(
      proposal.contextAttachments.map((entry) => entry.sourceRef),
      command.contextAttachmentRefs,
    )
  );
}

function pendingCommand(
  state: SpecificationProposalState,
  commandId: string,
  correlationId: string,
) {
  return state.pendingCommands.find((command) => (
    command.commandId === commandId && command.correlationId === correlationId
  )) ?? null;
}

function withoutCommand(state: SpecificationProposalState, commandId: string) {
  return state.pendingCommands.filter((command) => command.commandId !== commandId);
}

function commandProjectRoot(command: SpecificationProposalCommand) {
  return command.type === "proposal.generate" ? command.project.root : command.projectRoot;
}

type ProposalFailureMessage = Extract<
  SpecificationProposalMessage,
  {
    type:
      | "proposal/history-failed"
      | "proposal/generate-failed"
      | "proposal/validation-failed"
      | "proposal/accept-failed"
      | "proposal/reject-failed";
  }
>;

function proposalFailureType(command: SpecificationProposalCommand): ProposalFailureMessage["type"] | null {
  if (command.type === "proposal.history") return "proposal/history-failed";
  if (command.type === "proposal.generate") return "proposal/generate-failed";
  if (command.type === "proposal.validate") return "proposal/validation-failed";
  if (command.type === "proposal.accept") return "proposal/accept-failed";
  if (command.type === "proposal.reject") return "proposal/reject-failed";
  return null;
}

function proposalFailureMatches(
  state: SpecificationProposalState,
  command: SpecificationProposalCommand,
  message: ProposalFailureMessage,
) {
  const project = state.project;
  if (
    !project
    || proposalFailureType(command) !== message.type
    || commandProjectRoot(command) !== project.root
    || !sameBasis(command.basisRevision, state.basisRevision)
  ) {
    return false;
  }
  const proposal = message.proposal ?? null;
  if (!proposal) return true;
  if (
    command.type === "proposal.history"
    || command.type === "proposal.generate"
    || command.type === "proposal.refresh-context"
  ) {
    return false;
  }
  const target = proposalTarget(state, command.proposalId);
  return (
    Boolean(target)
    && sameProjectIdentity(proposal.project, project)
    && proposalImmutableIdentityMatches(proposal, target as SpecificationProposal)
    && failureProposalMayReplace(
      command,
      proposal,
      target as SpecificationProposal,
    )
  );
}

function replaceHistoryProposal(
  history: SpecificationProposal[],
  proposal: SpecificationProposal,
) {
  return [proposal, ...history.filter((entry) => entry.proposalId !== proposal.proposalId)];
}

type CommandInput =
  | { type: "proposal.history" }
  | {
      type: "proposal.generate";
      prompt: string;
      contextAttachmentRefs: string[];
      predecessorProposalId: string | null;
    }
  | { type: "proposal.validate"; proposalId: string }
  | { type: "proposal.accept" | "proposal.reject"; proposalId: string; actorRef: string }
  | { type: "proposal.refresh-context"; reason: "accepted" | "stale" };

function enqueue(
  state: SpecificationProposalState,
  input: CommandInput,
): CapabilityUpdate<SpecificationProposalState, SpecificationProposalCommand> {
  if (!state.project || !state.basisRevision) return { state, commands: [] };
  const commandSequence = state.commandSequence + 1;
  const identity = {
    commandId: `proposal-${input.type.slice("proposal.".length)}-${commandSequence}`,
    correlationId: `proposal:${state.project.root}:${commandSequence}`,
  };
  const command = input.type === "proposal.generate"
    ? {
        ...input,
        ...identity,
        project: state.project,
        basisRevision: state.basisRevision,
      }
    : {
        ...input,
        ...identity,
        projectRoot: state.project.root,
        basisRevision: state.basisRevision,
      } as SpecificationProposalCommand;
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

function beginCommand(
  state: SpecificationProposalState,
  input: CommandInput,
  status: SpecificationProposalState["status"],
) {
  if (state.pendingCommands.length > 0) {
    return { state, commands: [] };
  }
  const result = enqueue(state, input);
  return {
    ...result,
    state: { ...result.state, status },
  };
}

function admitProposalResult(
  state: SpecificationProposalState,
  message: Extract<SpecificationProposalMessage, {
    type: "proposal/generated" | "proposal/validated" | "proposal/accepted" | "proposal/rejected";
  }>,
  expectedType: SpecificationProposalCommand["type"],
) {
  const command = pendingCommand(state, message.commandId, message.correlationId);
  const project = state.project;
  const target = command && "proposalId" in command
    ? proposalTarget(state, command.proposalId)
    : null;
  const proposalMatchesCommand = command?.type === "proposal.generate"
    ? (
        generatedProposalMatches(message.proposal, command)
        && proposalSuccessSemanticsMatch(state, command, message.proposal, null)
      )
    : Boolean(
        target
        && command
        && "proposalId" in command
        && message.proposal.proposalId === command.proposalId
        && proposalImmutableIdentityMatches(message.proposal, target)
        && proposalSuccessSemanticsMatch(state, command, message.proposal, target)
      );
  if (
    command?.type !== expectedType
    || !project
    || commandProjectRoot(command) !== project.root
    || message.projectRoot !== project.root
    || !sameBasis(command.basisRevision, state.basisRevision)
    || !sameProjectIdentity(message.proposal.project, project)
    || !proposalMatchesCommand
  ) return { state, commands: [] };
  const nextState: SpecificationProposalState = {
    ...state,
    status: "idle" as const,
    currentProposal: message.proposal,
    selectedProposalId: message.proposal.proposalId,
    history: replaceHistoryProposal(state.history, message.proposal),
    pendingCommands: withoutCommand(state, message.commandId),
    promptDraft: message.type === "proposal/generated" ? "" : state.promptDraft,
    refinementDraft: message.type === "proposal/generated" ? "" : state.refinementDraft,
    error: null,
  };
  if (message.type === "proposal/accepted") {
    return enqueue(nextState, { type: "proposal.refresh-context", reason: "accepted" });
  }
  return { state: nextState, commands: [] };
}

export function updateSpecificationProposal(
  state: SpecificationProposalState,
  message: SpecificationProposalMessage,
): CapabilityUpdate<SpecificationProposalState, SpecificationProposalCommand> {
  if (message.type === "proposal/context-changed") {
    const projectChanged = (
      !state.project
      || !sameProjectIdentity(state.project, message.project)
    );
    const basisChanged = !sameBasis(state.basisRevision, message.revision);
    const next: SpecificationProposalState = {
      ...state,
      project: message.project,
      basisRevision: message.revision,
      status: message.revision ? "idle" : "error",
      currentProposal: projectChanged ? null : state.currentProposal,
      history: projectChanged ? [] : state.history,
      selectedProposalId: projectChanged ? null : state.selectedProposalId,
      promptDraft: projectChanged ? "" : state.promptDraft,
      refinementDraft: projectChanged ? "" : state.refinementDraft,
      contextAttachmentDraft: projectChanged ? "" : state.contextAttachmentDraft,
      contextAttachmentRefs: projectChanged ? [] : state.contextAttachmentRefs,
      pendingCommands: [],
      error: message.revision ? null : "Specification proposals require an admitted Project Revision.",
    };
    if (!message.revision || (!projectChanged && !basisChanged && state.history.length > 0)) {
      return { state: next, commands: [] };
    }
    return beginCommand(next, { type: "proposal.history" }, "loading");
  }

  if (message.type === "proposal/context-attachment-edited") {
    return { state: { ...state, contextAttachmentDraft: message.value }, commands: [] };
  }
  if (message.type === "proposal/context-attached") {
    const fromDraft = message.sourceRef === undefined;
    const sourceRef = (message.sourceRef ?? state.contextAttachmentDraft).trim();
    if (!sourceRef || state.contextAttachmentRefs.includes(sourceRef) || state.contextAttachmentRefs.length >= 12) {
      return { state, commands: [] };
    }
    return {
      state: {
        ...state,
        contextAttachmentDraft: fromDraft ? "" : state.contextAttachmentDraft,
        contextAttachmentRefs: [...state.contextAttachmentRefs, sourceRef],
      },
      commands: [],
    };
  }
  if (message.type === "proposal/context-removed") {
    return {
      state: {
        ...state,
        contextAttachmentRefs: state.contextAttachmentRefs.filter((entry) => entry !== message.sourceRef),
      },
      commands: [],
    };
  }
  if (message.type === "proposal/prompt-edited") {
    return { state: { ...state, promptDraft: message.value }, commands: [] };
  }
  if (message.type === "proposal/refinement-edited") {
    return { state: { ...state, refinementDraft: message.value }, commands: [] };
  }
  if (message.type === "proposal/generate-requested") {
    const prompt = state.promptDraft.trim();
    if (!prompt || !state.project || !state.basisRevision) return { state, commands: [] };
    return beginCommand(state, {
      type: "proposal.generate",
      prompt,
      contextAttachmentRefs: state.contextAttachmentRefs,
      predecessorProposalId: null,
    }, "generating");
  }
  if (message.type === "proposal/regenerate-requested") {
    const proposal = state.currentProposal;
    if (
      !proposal
      || !state.project
      || !state.basisRevision
      || sameBasis(proposal.basisRevision, state.basisRevision)
      || terminalStatus(proposal.status)
    ) return { state, commands: [] };
    return beginCommand(state, {
      type: "proposal.generate",
      prompt: proposal.prompt,
      contextAttachmentRefs: [...new Set([
        ...proposal.contextAttachments.map((entry) => entry.sourceRef),
        ...state.contextAttachmentRefs,
      ])].slice(0, 12),
      predecessorProposalId: proposal.proposalId,
    }, "generating");
  }
  if (message.type === "proposal/refine-requested") {
    const prompt = state.refinementDraft.trim();
    if (
      !prompt
      || !state.currentProposal
      || terminalStatus(state.currentProposal.status)
      || !state.project
      || !state.basisRevision
    ) {
      return { state, commands: [] };
    }
    return beginCommand(state, {
      type: "proposal.generate",
      prompt,
      contextAttachmentRefs: state.contextAttachmentRefs,
      predecessorProposalId: state.currentProposal.proposalId,
    }, "generating");
  }
  if (message.type === "proposal/validate-requested") {
    if (!state.currentProposal || terminalStatus(state.currentProposal.status)) return { state, commands: [] };
    return beginCommand(state, {
      type: "proposal.validate",
      proposalId: state.currentProposal.proposalId,
    }, "validating");
  }
  if (message.type === "proposal/accept-requested") {
    if (
      !state.currentProposal
      || state.currentProposal.status !== "valid"
      || !sameBasis(state.currentProposal.basisRevision, state.basisRevision)
    ) return { state, commands: [] };
    return beginCommand(state, {
      type: "proposal.accept",
      proposalId: state.currentProposal.proposalId,
      actorRef: message.actorRef,
    }, "accepting");
  }
  if (message.type === "proposal/reject-requested") {
    if (!state.currentProposal || terminalStatus(state.currentProposal.status)) return { state, commands: [] };
    return beginCommand(state, {
      type: "proposal.reject",
      proposalId: state.currentProposal.proposalId,
      actorRef: message.actorRef,
    }, "rejecting");
  }
  if (message.type === "proposal/history-requested") {
    return beginCommand(state, { type: "proposal.history" }, "loading");
  }
  if (message.type === "proposal/selected") {
    const proposal = state.history.find((entry) => entry.proposalId === message.proposalId) ?? null;
    if (!proposal) return { state, commands: [] };
    return {
      state: { ...state, selectedProposalId: proposal.proposalId, currentProposal: proposal },
      commands: [],
    };
  }
  if (message.type === "proposal/supporting-command-consumed") {
    const command = pendingCommand(state, message.commandId, message.correlationId);
    return command?.type === "proposal.refresh-context"
      ? { state: { ...state, pendingCommands: withoutCommand(state, message.commandId) }, commands: [] }
      : { state, commands: [] };
  }

  if (message.type === "proposal/history-loaded") {
    const command = pendingCommand(state, message.commandId, message.correlationId);
    const project = state.project;
    const proposalIds = new Set(message.history.proposals.map((entry) => entry.proposalId));
    if (
      command?.type !== "proposal.history"
      || !project
      || commandProjectRoot(command) !== project.root
      || message.projectRoot !== project.root
      || message.history.projectRoot !== project.root
      || !sameBasis(command.basisRevision, state.basisRevision)
      || proposalIds.size !== message.history.proposals.length
      || message.history.proposals.length > message.history.retentionLimit
      || !proposalHistoryLineageMatches(
        message.history.proposals,
        message.history.truncated,
      )
      || message.history.proposals.some(
        (proposal) => (
          !sameProjectIdentity(proposal.project, project)
          || !proposalRecordSemanticsMatch(proposal)
        ),
      )
      || message.history.proposals.some((proposal) => {
        const existing = state.history.find(
          (entry) => entry.proposalId === proposal.proposalId,
        );
        return existing ? !historyProposalMayAdvance(existing, proposal) : false;
      })
      || (
        !message.history.truncated
        && state.history.some((proposal) => !proposalIds.has(proposal.proposalId))
      )
    ) return { state, commands: [] };
    const mergedHistory = mergeProposalHistory(
      state.history,
      message.history.proposals,
      message.history.retentionLimit,
      message.history.truncated,
    );
    const selected = mergedHistory.find(
      (entry) => entry.proposalId === state.selectedProposalId,
    ) ?? mergedHistory[0] ?? null;
    return {
      state: {
        ...state,
        status: "idle",
        history: mergedHistory,
        retentionLimit: message.history.retentionLimit,
        historyTruncated: message.history.truncated,
        selectedProposalId: selected?.proposalId ?? null,
        currentProposal: selected,
        pendingCommands: withoutCommand(state, message.commandId),
        error: null,
      },
      commands: [],
    };
  }

  if (message.type === "proposal/generated") {
    return admitProposalResult(state, message, "proposal.generate");
  }
  if (message.type === "proposal/validated") {
    return admitProposalResult(state, message, "proposal.validate");
  }
  if (message.type === "proposal/accepted") {
    return admitProposalResult(state, message, "proposal.accept");
  }
  if (message.type === "proposal/rejected") {
    return admitProposalResult(state, message, "proposal.reject");
  }

  const command = pendingCommand(state, message.commandId, message.correlationId);
  if (!command || !proposalFailureMatches(state, command, message)) {
    return { state, commands: [] };
  }
  const proposal = message.proposal ?? null;
  const failedState: SpecificationProposalState = {
    ...state,
    status: "error",
    currentProposal: proposal ?? state.currentProposal,
    history: proposal ? replaceHistoryProposal(state.history, proposal) : state.history,
    pendingCommands: withoutCommand(state, message.commandId),
    error: message.error,
  };
  if (proposal?.status === "stale") {
    const refresh = enqueue(failedState, { type: "proposal.refresh-context", reason: "stale" });
    return {
      ...refresh,
      state: { ...refresh.state, error: message.error },
    };
  }
  return { state: failedState, commands: [] };
}

function terminalStatus(status: SpecificationProposal["status"]) {
  return status === "accepted" || status === "rejected" || status === "superseded";
}

export function replaySpecificationProposalMessages(
  state: SpecificationProposalState,
  messages: SpecificationProposalMessage[],
) {
  const commands: SpecificationProposalCommand[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateSpecificationProposal(current, message);
    current = result.state;
    commands.push(...result.commands);
  }
  return { state: current, commands };
}
