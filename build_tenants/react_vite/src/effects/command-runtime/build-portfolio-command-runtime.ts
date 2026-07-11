import { buildPortfolioSchema } from "@odd-manager/developer-control-contracts";
import type { BuildPortfolioMessage } from "../../capabilities/build-portfolio";
import type { BuildPortfolioCommand } from "../../capabilities/build-portfolio";
import {
  browsePath,
  registerProject,
  setActiveProject,
  unregisterProject,
} from "../../lib/collaboration";

async function loadPortfolio(
  command: Extract<BuildPortfolioCommand, { type: "portfolio.load" }>,
): Promise<BuildPortfolioMessage> {
  const response = await fetch("/api/developer-control/portfolio", { cache: "no-store" });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null && "error" in payload
      ? String(payload.error)
      : `Portfolio carrier failed with ${response.status}.`;
    throw new Error(detail);
  }
  return {
    type: "portfolio/load-succeeded",
    commandId: command.commandId,
    contextProjectRoot: command.contextProjectRoot,
    portfolio: buildPortfolioSchema.parse(payload),
  };
}

export async function interpretBuildPortfolioCommand(
  command: BuildPortfolioCommand,
): Promise<BuildPortfolioMessage> {
  try {
    if (command.type === "portfolio.load") return await loadPortfolio(command);
    if (command.type === "portfolio.browse") {
      const result = await browsePath(command.path);
      return {
        type: "portfolio/browser-loaded",
        commandId: command.commandId,
        path: result.path,
        parent: result.parent,
        entries: result.entries,
      };
    }
    if (command.type === "portfolio.register") {
      await registerProject(command.path, { setActive: false });
      return { type: "portfolio/project-registered", commandId: command.commandId };
    }
    if (command.type === "portfolio.unregister") {
      await unregisterProject(command.projectId);
      return { type: "portfolio/project-unregistered", commandId: command.commandId };
    }
    if (command.type === "portfolio.open-attention") {
      const result = await setActiveProject(command.projectId, { registerIfMissing: false });
      if (result.project.root !== command.projectRoot) {
        throw new Error("Attention Project identity changed during navigation.");
      }
      return {
        type: "portfolio/attention-opened",
        commandId: command.commandId,
        projectRoot: command.projectRoot,
        attentionId: command.attentionId,
        sourceKind: command.sourceKind,
        sourceRef: command.sourceRef,
        targetCapabilityId: command.targetCapabilityId,
      };
    }
    const result = await setActiveProject(command.projectId, { registerIfMissing: false });
    return {
      type: "portfolio/project-activated",
      commandId: command.commandId,
      projectRoot: result.project.root,
    };
  } catch (caught) {
    return {
      type: "portfolio/command-failed",
      commandId: command.commandId,
      error: caught instanceof Error ? caught.message : String(caught),
    };
  }
}
