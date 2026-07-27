import { assuranceSnapshotSchema } from "@odd-manager/developer-control-contracts";
import type {
  AssuranceAttentionCommand,
  AssuranceAttentionMessage,
} from "../../capabilities/assurance-attention";

function sameRevision(
  left: AssuranceAttentionCommand["basisRevision"],
  right: AssuranceAttentionCommand["basisRevision"] | null,
) {
  return Boolean(
    right
    && left.kind === right.kind
    && left.revision === right.revision
    && left.dirty === right.dirty
    && left.sourceDigest === right.sourceDigest
    && left.specificationDigest === right.specificationDigest,
  );
}

export async function interpretAssuranceAttentionCommand(
  command: AssuranceAttentionCommand,
): Promise<AssuranceAttentionMessage> {
  try {
    const executionQuery = command.executionId
      ? `&executionId=${encodeURIComponent(command.executionId)}`
      : "";
    const response = await fetch(
      `/api/developer-control/assurance?workspaceRoot=${encodeURIComponent(command.projectRoot)}${executionQuery}`,
      { cache: "no-store" },
    );
    const payload: unknown = await response.json();
    if (!response.ok) {
      const detail = typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Assurance command failed with ${response.status}.`;
      throw new Error(detail);
    }
    const snapshot = assuranceSnapshotSchema.parse(payload);
    if (command.type === "assurance.load") {
      if (snapshot.projectRoot !== command.projectRoot) {
        return {
          type: "assurance/command-failed",
          commandId: command.commandId,
          correlationId: command.correlationId,
          failureKind: "identity_mismatch",
          error: "Assurance response Project identity does not match the pending load command.",
        };
      }
      if (!sameRevision(command.basisRevision, snapshot.revision)) {
        return {
          type: "assurance/command-failed",
          commandId: command.commandId,
          correlationId: command.correlationId,
          failureKind: "stale_basis",
          error: "Assurance response ProjectRevision is newer than or different from the pending load basis.",
        };
      }
      return {
        type: "assurance/load-succeeded",
        commandId: command.commandId,
        correlationId: command.correlationId,
        projectRoot: command.projectRoot,
        snapshot,
      };
    }
    const execution = snapshot.execution;
    const snapshotRevision = snapshot.revision;
    if (
      snapshot.projectRoot !== command.projectRoot
      || !snapshotRevision
      || !sameRevision(command.basisRevision, snapshotRevision)
      || !execution
      || execution.executionId !== command.executionId
    ) {
      throw new Error("Run Inspector focus response does not match the admitted Project, Revision, and Build Execution.");
    }
    const focusBasis = command.focusBasis;
    if (focusBasis.kind === "attention-reaction") {
      const attention = snapshot.attentionItems.find((item) => (
        item.attentionId === focusBasis.attentionId
        && item.executionId === command.executionId
        && item.sourceRef === focusBasis.sourceRef
        && item.reactionRefs.includes(focusBasis.reactionRef)
        && focusBasis.reactionRef === "reaction://odd_manager/open-run-inspector"
      ));
      if (!attention) {
        throw new Error("Run Inspector focus response no longer carries the selected assurance reaction.");
      }
    } else if (snapshot.evidenceBundleRef !== focusBasis.sourceRef) {
      throw new Error("Run Inspector focus response no longer carries the selected execution evidence.");
    }
    const runRef = execution.runRefs[0] ?? null;
    if (!runRef) {
      throw new Error(`Build Execution ${execution.executionId} has no admitted run reference.`);
    }
    return {
      type: "assurance/inspector-focus-resolved",
      commandId: command.commandId,
      correlationId: command.correlationId,
      projectRoot: command.projectRoot,
      executionId: execution.executionId,
      runRef,
      revision: snapshotRevision.revision,
      sourceRef: focusBasis.sourceRef,
    };
  } catch (caught) {
    return {
      type: command.type === "assurance.load"
        ? "assurance/load-failed"
        : "assurance/inspector-focus-failed",
      commandId: command.commandId,
      correlationId: command.correlationId,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}
