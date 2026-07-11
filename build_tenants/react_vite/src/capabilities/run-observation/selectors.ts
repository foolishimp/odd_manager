import type { CapabilityContribution } from "@odd-manager/developer-control-contracts";

export function selectRunObservationContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "run-observation") ?? null;
}
