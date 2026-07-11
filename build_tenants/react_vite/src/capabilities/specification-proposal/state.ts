import type {
  ProjectRef,
  ProjectRevision,
  SpecificationProposal,
} from "@odd-manager/developer-control-contracts";

export type SpecificationProposalCommand =
  | {
      type: "proposal.history";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      basisRevision: ProjectRevision;
    }
  | {
      type: "proposal.generate";
      commandId: string;
      correlationId: string;
      project: ProjectRef;
      basisRevision: ProjectRevision;
      prompt: string;
      contextAttachmentRefs: string[];
      predecessorProposalId: string | null;
    }
  | {
      type: "proposal.validate";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      basisRevision: ProjectRevision;
      proposalId: string;
    }
  | {
      type: "proposal.accept" | "proposal.reject";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      basisRevision: ProjectRevision;
      proposalId: string;
      actorRef: string;
    }
  | {
      type: "proposal.refresh-context";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      basisRevision: ProjectRevision;
      reason: "accepted" | "stale";
    };

export type SpecificationProposalState = {
  status: "idle" | "loading" | "generating" | "validating" | "accepting" | "rejecting" | "error";
  project: ProjectRef | null;
  basisRevision: ProjectRevision | null;
  promptDraft: string;
  refinementDraft: string;
  contextAttachmentDraft: string;
  contextAttachmentRefs: string[];
  currentProposal: SpecificationProposal | null;
  history: SpecificationProposal[];
  retentionLimit: number;
  historyTruncated: boolean;
  selectedProposalId: string | null;
  pendingCommands: SpecificationProposalCommand[];
  commandSequence: number;
  error: string | null;
};

export function createSpecificationProposalState(): SpecificationProposalState {
  return {
    status: "idle",
    project: null,
    basisRevision: null,
    promptDraft: "",
    refinementDraft: "",
    contextAttachmentDraft: "",
    contextAttachmentRefs: [],
    currentProposal: null,
    history: [],
    retentionLimit: 50,
    historyTruncated: false,
    selectedProposalId: null,
    pendingCommands: [],
    commandSequence: 0,
    error: null,
  };
}

export const INITIAL_SPECIFICATION_PROPOSAL_STATE = createSpecificationProposalState();
export type SpecificationProposalSubscription = never;
