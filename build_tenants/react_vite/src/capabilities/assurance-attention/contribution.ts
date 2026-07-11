import type {
  CapabilityContribution,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";
import { selectAssuranceAttentionContribution } from "./selectors";
import type { AssuranceAttentionState } from "./state";

export function assuranceAttentionContribution(
  _state: AssuranceAttentionState,
  _context: ManagerContext,
  contributions: CapabilityContribution[],
) {
  return selectAssuranceAttentionContribution(contributions);
}
