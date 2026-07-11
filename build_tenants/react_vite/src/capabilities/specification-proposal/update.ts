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

function pendingCommand(state: SpecificationProposalState, commandId: string) {
  return state.pendingCommands.find((command) => command.commandId === commandId) ?? null;
}

function withoutCommand(state: SpecificationProposalState, commandId: string) {
  return state.pendingCommands.filter((command) => command.commandId !== commandId);
}

function commandProjectRoot(command: SpecificationProposalCommand) {
  return command.type === "proposal.generate" ? command.project.root : command.projectRoot;
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
  const command = pendingCommand(state, message.commandId);
  const resultBasisMatches = expectedType === "proposal.reject"
    ? sameBasis(command?.basisRevision ?? null, state.basisRevision)
    : sameBasis(command?.basisRevision ?? null, message.proposal.basisRevision);
  if (
    command?.type !== expectedType
    || commandProjectRoot(command) !== state.project?.root
    || message.projectRoot !== state.project.root
    || !resultBasisMatches
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
    const projectChanged = state.project?.root !== message.project.root;
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
    if (!prompt || !state.currentProposal || !state.project || !state.basisRevision) {
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
    const command = pendingCommand(state, message.commandId);
    return command?.type === "proposal.refresh-context"
      ? { state: { ...state, pendingCommands: withoutCommand(state, message.commandId) }, commands: [] }
      : { state, commands: [] };
  }

  if (message.type === "proposal/history-loaded") {
    const command = pendingCommand(state, message.commandId);
    if (
      command?.type !== "proposal.history"
      || commandProjectRoot(command) !== state.project?.root
      || message.projectRoot !== state.project.root
      || message.history.projectRoot !== state.project.root
    ) return { state, commands: [] };
    const selected = message.history.proposals.find(
      (entry) => entry.proposalId === state.selectedProposalId,
    ) ?? message.history.proposals[0] ?? null;
    return {
      state: {
        ...state,
        status: "idle",
        history: message.history.proposals,
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

  const command = pendingCommand(state, message.commandId);
  if (!command) return { state, commands: [] };
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
    return enqueue(failedState, { type: "proposal.refresh-context", reason: "stale" });
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
