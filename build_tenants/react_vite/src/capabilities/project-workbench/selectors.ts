import type { CapabilityContribution } from "@odd-manager/developer-control-contracts";

export function selectProjectWorkbenchContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "project-workbench") ?? null;
}
