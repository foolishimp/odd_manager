import type {
  CapabilityContribution,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";
import { selectSpecificationProposalContribution } from "./selectors";
import type { SpecificationProposalState } from "./state";

export function specificationProposalContribution(
  _state: SpecificationProposalState,
  _context: ManagerContext,
  contributions: CapabilityContribution[],
) {
  return selectSpecificationProposalContribution(contributions);
}
