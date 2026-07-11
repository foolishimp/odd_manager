import type {
  CapabilityContribution,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";
import { selectProjectWorkbenchContribution } from "./selectors";
import type { ProjectWorkbenchState } from "./state";

export function projectWorkbenchContribution(
  _state: ProjectWorkbenchState,
  _context: ManagerContext,
  contributions: CapabilityContribution[],
) {
  return selectProjectWorkbenchContribution(contributions);
}
