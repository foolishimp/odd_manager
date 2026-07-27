import type { CapabilityModule } from "../../contracts/developer-control";
import { buildControlContribution } from "./contribution";
import type { BuildControlMessage } from "./messages";
import {
  createBuildControlState,
  INITIAL_BUILD_CONTROL_STATE,
  type BuildControlCommand,
  type BuildControlState,
  type BuildControlSubscription,
} from "./state";
import { buildControlSubscriptions } from "./subscriptions";
import { updateBuildControl } from "./update";
import { BuildControlView } from "./view";

export const buildControlModule: CapabilityModule<
  BuildControlState,
  BuildControlMessage,
  BuildControlCommand,
  BuildControlSubscription
> = {
  id: "build-control",
  initialState: INITIAL_BUILD_CONTROL_STATE,
  update: updateBuildControl,
  subscriptions: (state, context) => buildControlSubscriptions(
    state,
    context.project.root,
    context.revision,
  ),
  contribution: buildControlContribution,
  View: BuildControlView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./subscriptions";
export * from "./update";
export * from "./view";
export { createBuildControlState };
