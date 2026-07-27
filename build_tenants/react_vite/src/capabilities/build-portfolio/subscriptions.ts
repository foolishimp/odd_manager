import type { ProjectRevision } from "@odd-manager/developer-control-contracts";
import type {
  BuildPortfolioState,
  BuildPortfolioSubscription,
} from "./state";

export function buildPortfolioSubscriptions(
  state: BuildPortfolioState,
  projectRoot: string,
  basisRevision: ProjectRevision | null,
): BuildPortfolioSubscription[] {
  const active = state.portfolio?.rows.some((row) => (
    row.buildActivity.runningCount > 0 || row.buildActivity.queuedCount > 0
  ));
  return active
    ? [{ type: "portfolio.poll", projectRoot, basisRevision, intervalMs: 800 }]
    : [];
}
