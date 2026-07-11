import type { CapabilityContribution } from "@odd-manager/developer-control-contracts";

export function selectAssuranceAttentionContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "assurance-attention") ?? null;
}
