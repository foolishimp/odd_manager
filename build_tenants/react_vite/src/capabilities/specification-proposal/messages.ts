import type {
  ProjectRef,
  ProjectRevision,
  SpecificationProposal,
  SpecificationProposalHistory,
} from "@odd-manager/developer-control-contracts";

type ProposalCommandFailure = {
  commandId: string;
  error: string;
  proposal?: SpecificationProposal | null;
};

export type SpecificationProposalMessage =
  | { type: "proposal/context-changed"; project: ProjectRef; revision: ProjectRevision | null }
  | { type: "proposal/context-attachment-edited"; value: string }
  | { type: "proposal/context-attached"; sourceRef?: string }
  | { type: "proposal/context-removed"; sourceRef: string }
  | { type: "proposal/prompt-edited"; value: string }
  | { type: "proposal/refinement-edited"; value: string }
  | { type: "proposal/generate-requested" }
  | { type: "proposal/regenerate-requested" }
  | { type: "proposal/refine-requested" }
  | { type: "proposal/validate-requested" }
  | { type: "proposal/accept-requested"; actorRef: string }
  | { type: "proposal/reject-requested"; actorRef: string }
  | { type: "proposal/history-requested" }
  | { type: "proposal/selected"; proposalId: string }
  | { type: "proposal/supporting-command-consumed"; commandId: string }
  | {
      type: "proposal/history-loaded";
      commandId: string;
      projectRoot: string;
      history: SpecificationProposalHistory;
    }
  | {
      type: "proposal/generated";
      commandId: string;
      projectRoot: string;
      proposal: SpecificationProposal;
    }
  | {
      type: "proposal/validated";
      commandId: string;
      projectRoot: string;
      proposal: SpecificationProposal;
    }
  | {
      type: "proposal/accepted";
      commandId: string;
      projectRoot: string;
      proposal: SpecificationProposal;
    }
  | {
      type: "proposal/rejected";
      commandId: string;
      projectRoot: string;
      proposal: SpecificationProposal;
    }
  | ({ type: "proposal/history-failed" } & ProposalCommandFailure)
  | ({ type: "proposal/generate-failed" } & ProposalCommandFailure)
  | ({ type: "proposal/validation-failed" } & ProposalCommandFailure)
  | ({ type: "proposal/accept-failed" } & ProposalCommandFailure)
  | ({ type: "proposal/reject-failed" } & ProposalCommandFailure);
