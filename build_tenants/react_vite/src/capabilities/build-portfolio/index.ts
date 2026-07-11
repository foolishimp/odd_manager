import type { CapabilityModule } from "../../contracts/developer-control";
import { buildPortfolioContribution } from "./contribution";
import {
  INITIAL_BUILD_PORTFOLIO_STATE,
  type BuildPortfolioCommand,
  type BuildPortfolioState,
  type BuildPortfolioSubscription,
} from "./state";
import type { BuildPortfolioMessage } from "./messages";
import { updateBuildPortfolio } from "./update";
import { BuildPortfolioView } from "./view";

export const buildPortfolioModule: CapabilityModule<
  BuildPortfolioState,
  BuildPortfolioMessage,
  BuildPortfolioCommand,
  BuildPortfolioSubscription
> = {
  id: "build-portfolio",
  initialState: INITIAL_BUILD_PORTFOLIO_STATE,
  update: updateBuildPortfolio,
  subscriptions: (state, context) => {
    const active = state.portfolio?.rows.some((row) => (
      row.buildActivity.runningCount > 0 || row.buildActivity.queuedCount > 0
    ));
    return active ? [{ type: "portfolio.poll", projectRoot: context.project.root, intervalMs: 800 }] : [];
  },
  contribution: buildPortfolioContribution,
  View: BuildPortfolioView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./update";
export * from "./view";
