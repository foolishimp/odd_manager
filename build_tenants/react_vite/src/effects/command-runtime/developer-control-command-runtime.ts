import { developerControlBootstrapSchema } from "@odd-manager/developer-control-contracts";
import type {
  DeveloperControlHostCommand,
  DeveloperControlHostMessage,
} from "../../contracts/developer-control";
import {
  RUN_FOCUS_EXECUTION_PARAM,
  RUN_FOCUS_REVISION_PARAM,
  RUN_FOCUS_RUN_REF_PARAM,
  RUN_FOCUS_SOURCE_PARAM,
} from "../../lib/projectDeepLink";

async function resolveContext(
  command: Extract<DeveloperControlHostCommand, { type: "host.resolve-context" }>,
): Promise<DeveloperControlHostMessage> {
  try {
    const response = await fetch(
      `/api/developer-control/bootstrap?workspaceRoot=${encodeURIComponent(command.projectRoot)}`,
    );
    const payload: unknown = await response.json();
    if (!response.ok) {
      const detail = typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Context carrier failed with ${response.status}.`;
      throw new Error(detail);
    }
    const bootstrap = developerControlBootstrapSchema.parse(payload);
    return {
      type: "host/context-admitted",
      commandId: command.commandId,
      correlationId: command.correlationId,
      bootstrap,
    };
  } catch (caught) {
    return {
      type: "host/context-failed",
      commandId: command.commandId,
      correlationId: command.correlationId,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

function navigate(
  command: Extract<DeveloperControlHostCommand, { type: "host.project-navigation" }>,
): DeveloperControlHostMessage {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("project", command.projectRoot);
    if (command.surface === "project-workbench") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", command.surface);
    }
    for (const parameter of [
      RUN_FOCUS_EXECUTION_PARAM,
      RUN_FOCUS_RUN_REF_PARAM,
      RUN_FOCUS_REVISION_PARAM,
      RUN_FOCUS_SOURCE_PARAM,
    ]) url.searchParams.delete(parameter);
    if (command.surface === "run-inspector" && command.runFocus) {
      url.searchParams.set(RUN_FOCUS_EXECUTION_PARAM, command.runFocus.executionId);
      if (command.runFocus.runRef) url.searchParams.set(RUN_FOCUS_RUN_REF_PARAM, command.runFocus.runRef);
      url.searchParams.set(RUN_FOCUS_REVISION_PARAM, command.runFocus.revision);
      url.searchParams.set(RUN_FOCUS_SOURCE_PARAM, command.runFocus.sourceRef);
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
    return {
      type: "host/navigation-admitted",
      commandId: command.commandId,
      correlationId: command.correlationId,
      surface: command.surface,
    };
  } catch (caught) {
    return {
      type: "host/navigation-failed",
      commandId: command.commandId,
      correlationId: command.correlationId,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}

export function interpretDeveloperControlCommand(
  command: DeveloperControlHostCommand,
): Promise<DeveloperControlHostMessage> {
  if (command.type === "host.resolve-context") {
    return resolveContext(command);
  }
  return Promise.resolve(navigate(command));
}
