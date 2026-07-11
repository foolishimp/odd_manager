import type { CapabilityContribution } from "@odd-manager/developer-control-contracts";

export type BuildPortfolioAttentionTarget = {
  capabilityId: "specification-proposal" | "build-control" | "assurance-attention";
  actionLabel: "Open Tune" | "Open Build" | "Open Assure";
};

export function buildPortfolioAttentionTarget(sourceKind: string): BuildPortfolioAttentionTarget {
  if (sourceKind === "revision" || sourceKind === "specification") {
    return { capabilityId: "specification-proposal", actionLabel: "Open Tune" };
  }
  if (sourceKind === "build-carrier" || sourceKind === "build-execution") {
    return { capabilityId: "build-control", actionLabel: "Open Build" };
  }
  return { capabilityId: "assurance-attention", actionLabel: "Open Assure" };
}

export function selectBuildPortfolioContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "build-portfolio") ?? null;
}
