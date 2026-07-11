import type { CapabilityModule } from "../../contracts/developer-control";
import { runObservationContribution } from "./contribution";
import type { RunObservationMessage } from "./messages";
import {
  INITIAL_RUN_OBSERVATION_STATE,
  type RunObservationCommand,
  type RunObservationState,
  type RunObservationSubscription,
} from "./state";
import { updateRunObservation } from "./update";
import { RunObservationView } from "./view";

export const runObservationModule: CapabilityModule<
  RunObservationState,
  RunObservationMessage,
  RunObservationCommand,
  RunObservationSubscription
> = {
  id: "run-observation",
  initialState: INITIAL_RUN_OBSERVATION_STATE,
  update: updateRunObservation,
  subscriptions: () => [],
  contribution: runObservationContribution,
  View: RunObservationView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./update";
export * from "./view";
