import type { SupportingSurfaceCommand } from "../../contracts/developer-control";

export type RunObservationState = {
  selectedSurface: "ai-workspace" | "run-inspector";
};

export const INITIAL_RUN_OBSERVATION_STATE: RunObservationState = {
  selectedSurface: "run-inspector",
};

export type RunObservationCommand = SupportingSurfaceCommand;
export type RunObservationSubscription = never;
