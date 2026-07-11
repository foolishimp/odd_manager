import type { CapabilityId } from "@odd-manager/developer-control-contracts";

export type WorkbenchPhase = "review" | "tune" | "build" | "assure";

export const PHASE_CAPABILITY: Record<WorkbenchPhase, CapabilityId> = {
  review: "build-portfolio",
  tune: "specification-proposal",
  build: "build-control",
  assure: "assurance-attention",
};

export type ProjectWorkbenchState = {
  activePhase: WorkbenchPhase;
  activeCapabilityId: CapabilityId;
};

export const INITIAL_PROJECT_WORKBENCH_STATE: ProjectWorkbenchState = {
  activePhase: "review",
  activeCapabilityId: "build-portfolio",
};

export type ProjectWorkbenchCommand = never;
export type ProjectWorkbenchSubscription = never;
