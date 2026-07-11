import type {
  CapabilityContribution,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";
import { selectBuildPortfolioContribution } from "./selectors";
import type { BuildPortfolioState } from "./state";

export function buildPortfolioContribution(
  _state: BuildPortfolioState,
  _context: ManagerContext,
  contributions: CapabilityContribution[],
) {
  return selectBuildPortfolioContribution(contributions);
}
