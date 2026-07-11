import {
  buildAttachResponseSchema,
  buildControlSnapshotSchema,
  buildExecutionSchema,
  buildSubmitResponseSchema,
} from "@odd-manager/developer-control-contracts";
import type { BuildControlMessage } from "../../capabilities/build-control/messages";
import type { BuildControlCommand } from "../../capabilities/build-control/state";

async function responsePayload(response: Response) {
  const payload: unknown = await response.json();
  if (response.ok) return payload;
  const error = typeof payload === "object" && payload !== null && "error" in payload
    ? String(payload.error)
    : `Build Control command failed with ${response.status}.`;
  const caught = new Error(error) as Error & { execution?: unknown };
  if (typeof payload === "object" && payload !== null && "execution" in payload) {
    const candidate = buildExecutionSchema.safeParse(payload.execution);
    if (candidate.success) caught.execution = candidate.data;
  }
  throw caught;
}

export async function interpretBuildControlCommand(
  command: BuildControlCommand,
): Promise<BuildControlMessage> {
  try {
    if (command.type === "build.load") {
      const response = await fetch(
        `/api/developer-control/builds?workspaceRoot=${encodeURIComponent(command.projectRoot)}`,
        { cache: "no-store" },
      );
      return {
        type: "build/snapshot-loaded",
        commandId: command.commandId,
        projectRoot: command.projectRoot,
        snapshot: buildControlSnapshotSchema.parse(await responsePayload(response)),
      };
    }

    const action = command.type.slice("build.".length);
    const body = command.type === "build.submit"
      ? {
          project: command.project,
          revision: command.basisRevision,
          inputs: command.inputs,
          requestedBy: command.requestedBy,
        }
      : {
          projectRoot: command.projectRoot,
          executionId: command.executionId,
          actorRef: command.actorRef,
        };
    const response = await fetch(`/api/developer-control/builds/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await responsePayload(response);
    if (command.type === "build.submit") {
      return {
        type: "build/submitted",
        commandId: command.commandId,
        projectRoot: command.projectRoot,
        result: buildSubmitResponseSchema.parse(payload),
      };
    }
    if (command.type === "build.attach") {
      return {
        type: "build/attached",
        commandId: command.commandId,
        projectRoot: command.projectRoot,
        attached: buildAttachResponseSchema.parse(payload),
      };
    }
    if (command.type === "build.resume") {
      return {
        type: "build/resumed",
        commandId: command.commandId,
        projectRoot: command.projectRoot,
        execution: buildExecutionSchema.parse(
          typeof payload === "object" && payload !== null && "execution" in payload
            ? payload.execution
            : null,
        ),
      };
    }
    return {
      type: "build/cancelled",
      commandId: command.commandId,
      projectRoot: command.projectRoot,
      execution: buildExecutionSchema.parse(
        typeof payload === "object" && payload !== null && "execution" in payload
          ? payload.execution
          : null,
      ),
    };
  } catch (caught) {
    const candidate = caught && typeof caught === "object" && "execution" in caught
      ? buildExecutionSchema.safeParse(caught.execution)
      : null;
    return {
      type: "build/command-failed",
      commandId: command.commandId,
      error: caught instanceof Error ? caught.message : String(caught),
      execution: candidate?.success ? candidate.data : null,
    };
  }
}
