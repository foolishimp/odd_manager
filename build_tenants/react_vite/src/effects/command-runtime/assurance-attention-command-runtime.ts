import { assuranceSnapshotSchema } from "@odd-manager/developer-control-contracts";
import type { AssuranceAttentionMessage } from "../../capabilities/assurance-attention/messages";
import type { AssuranceAttentionCommand } from "../../capabilities/assurance-attention/state";

export async function interpretAssuranceAttentionCommand(
  command: Extract<AssuranceAttentionCommand, { type: "assurance.load" }>,
): Promise<AssuranceAttentionMessage> {
  try {
    const execution = command.executionId
      ? `&executionId=${encodeURIComponent(command.executionId)}`
      : "";
    const response = await fetch(
      `/api/developer-control/assurance?workspaceRoot=${encodeURIComponent(command.projectRoot)}${execution}`,
      { cache: "no-store" },
    );
    const payload: unknown = await response.json();
    if (!response.ok) {
      const detail = typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Assurance command failed with ${response.status}.`;
      throw new Error(detail);
    }
    return {
      type: "assurance/load-succeeded",
      commandId: command.commandId,
      projectRoot: command.projectRoot,
      snapshot: assuranceSnapshotSchema.parse(payload),
    };
  } catch (caught) {
    return {
      type: "assurance/load-failed",
      commandId: command.commandId,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}
