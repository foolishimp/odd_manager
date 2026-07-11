import type { CapabilityModule } from "../../contracts/developer-control";
import { projectWorkbenchContribution } from "./contribution";
import type { ProjectWorkbenchMessage } from "./messages";
import {
  INITIAL_PROJECT_WORKBENCH_STATE,
  type ProjectWorkbenchCommand,
  type ProjectWorkbenchState,
  type ProjectWorkbenchSubscription,
} from "./state";
import { updateProjectWorkbench } from "./update";
import { ProjectWorkbenchView } from "./view";

export const projectWorkbenchModule: CapabilityModule<
  ProjectWorkbenchState,
  ProjectWorkbenchMessage,
  ProjectWorkbenchCommand,
  ProjectWorkbenchSubscription
> = {
  id: "project-workbench",
  initialState: INITIAL_PROJECT_WORKBENCH_STATE,
  update: updateProjectWorkbench,
  subscriptions: () => [],
  contribution: projectWorkbenchContribution,
  View: ProjectWorkbenchView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./update";
export * from "./view";
