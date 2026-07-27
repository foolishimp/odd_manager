import type { CapabilityModule } from "../../contracts/developer-control";
import { buildPortfolioContribution } from "./contribution";
import {
  INITIAL_BUILD_PORTFOLIO_STATE,
  type BuildPortfolioCommand,
  type BuildPortfolioState,
  type BuildPortfolioSubscription,
} from "./state";
import type { BuildPortfolioMessage } from "./messages";
import { buildPortfolioSubscriptions } from "./subscriptions";
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
  subscriptions: (state, context) => buildPortfolioSubscriptions(
    state,
    context.project.root,
    context.revision,
  ),
  contribution: buildPortfolioContribution,
  View: BuildPortfolioView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./subscriptions";
export * from "./update";
export * from "./view";
