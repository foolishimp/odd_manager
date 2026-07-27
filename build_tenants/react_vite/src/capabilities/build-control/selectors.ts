import type {
  BuildExecution,
  BuildRequest,
  CapabilityContribution,
} from "@odd-manager/developer-control-contracts";

const ACTIVE_STATES = new Set<BuildExecution["state"]>([
  "queued",
  "starting",
  "running",
  "waiting_human",
  "stale",
  "disconnected",
]);

export function selectBuildControlContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "build-control") ?? null;
}

export function buildExecutionCommandAvailability(
  execution: BuildExecution | null,
  request: BuildRequest | null,
) {
  const commands = request?.descriptorBinding.supportedCommands ?? [];
  return {
    canCancel: Boolean(
      execution
      && ACTIVE_STATES.has(execution.state)
      && commands.includes("cancel"),
    ),
    canResume: Boolean(
      execution
      && ["stale", "disconnected"].includes(execution.state)
      && commands.includes("resume"),
    ),
  };
}
