import type {
  CapabilityContribution,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";
import { selectBuildControlContribution } from "./selectors";
import type { BuildControlState } from "./state";

export function buildControlContribution(
  _state: BuildControlState,
  _context: ManagerContext,
  contributions: CapabilityContribution[],
) {
  return selectBuildControlContribution(contributions);
}
