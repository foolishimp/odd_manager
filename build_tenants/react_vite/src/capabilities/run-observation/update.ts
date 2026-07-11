import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { RunObservationMessage } from "./messages";
import type { RunObservationCommand, RunObservationState } from "./state";

export function updateRunObservation(
  state: RunObservationState,
  message: RunObservationMessage,
): CapabilityUpdate<RunObservationState, RunObservationCommand> {
  return {
    state: { ...state, selectedSurface: message.surface },
    commands: [{ type: "supporting-surface.open", surface: message.surface }],
  };
}
