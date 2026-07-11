import type { CapabilityContribution } from "@odd-manager/developer-control-contracts";

export function selectBuildControlContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "build-control") ?? null;
}
