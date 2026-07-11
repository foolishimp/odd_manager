import {
  specificationProposalHistorySchema,
  specificationProposalSchema,
} from "@odd-manager/developer-control-contracts";
import type {
  SpecificationProposalCommand,
  SpecificationProposalMessage,
} from "../../capabilities/specification-proposal";

type ProviderProposalCommand = Exclude<
  SpecificationProposalCommand,
  { type: "proposal.refresh-context" }
>;

function projectRoot(command: ProviderProposalCommand) {
  return command.type === "proposal.generate" ? command.project.root : command.projectRoot;
}

function failureType(command: ProviderProposalCommand) {
  if (command.type === "proposal.history") return "proposal/history-failed" as const;
  if (command.type === "proposal.generate") return "proposal/generate-failed" as const;
  if (command.type === "proposal.validate") return "proposal/validation-failed" as const;
  if (command.type === "proposal.accept") return "proposal/accept-failed" as const;
  return "proposal/reject-failed" as const;
}

async function responsePayload(response: Response) {
  const payload: unknown = await response.json();
  if (response.ok) return payload;
  const error = typeof payload === "object" && payload !== null && "error" in payload
    ? String(payload.error)
    : `Specification proposal command failed with ${response.status}.`;
  const candidate = typeof payload === "object" && payload !== null && "proposal" in payload
    ? specificationProposalSchema.safeParse(payload.proposal)
    : null;
  const caught = new Error(error) as Error & { proposal?: unknown };
  if (candidate?.success) caught.proposal = candidate.data;
  throw caught;
}

export async function interpretSpecificationProposalCommand(
  command: ProviderProposalCommand,
): Promise<SpecificationProposalMessage> {
  try {
    const root = projectRoot(command);
    if (command.type === "proposal.history") {
      const response = await fetch(
        `/api/developer-control/proposals?workspaceRoot=${encodeURIComponent(root)}`,
        { cache: "no-store" },
      );
      return {
        type: "proposal/history-loaded",
        commandId: command.commandId,
        projectRoot: root,
        history: specificationProposalHistorySchema.parse(await responsePayload(response)),
      };
    }

    const endpoint = command.type.slice("proposal.".length);
    const body = command.type === "proposal.generate"
      ? {
          project: command.project,
          basisRevision: command.basisRevision,
          prompt: command.prompt,
          contextAttachmentRefs: command.contextAttachmentRefs,
          predecessorProposalId: command.predecessorProposalId,
        }
      : command.type === "proposal.validate"
        ? { projectRoot: root, proposalId: command.proposalId }
        : {
            projectRoot: root,
            proposalId: command.proposalId,
            actorRef: command.actorRef,
          };
    const response = await fetch(`/api/developer-control/proposals/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await responsePayload(response);
    const proposal = specificationProposalSchema.parse(
      typeof payload === "object" && payload !== null && "proposal" in payload
        ? payload.proposal
        : null,
    );
    const messageType = command.type === "proposal.generate"
      ? "proposal/generated"
      : command.type === "proposal.validate"
        ? "proposal/validated"
        : command.type === "proposal.accept"
          ? "proposal/accepted"
          : "proposal/rejected";
    return {
      type: messageType,
      commandId: command.commandId,
      projectRoot: root,
      proposal,
    } as SpecificationProposalMessage;
  } catch (caught) {
    const candidate = caught && typeof caught === "object" && "proposal" in caught
      ? specificationProposalSchema.safeParse(caught.proposal)
      : null;
    return {
      type: failureType(command),
      commandId: command.commandId,
      error: caught instanceof Error ? caught.message : String(caught),
      proposal: candidate?.success ? candidate.data : null,
    } as SpecificationProposalMessage;
  }
}
