import type {
  CapabilityContribution,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";
import { selectRunObservationContribution } from "./selectors";
import type { RunObservationState } from "./state";

export function runObservationContribution(
  _state: RunObservationState,
  _context: ManagerContext,
  contributions: CapabilityContribution[],
) {
  return selectRunObservationContribution(contributions);
}
