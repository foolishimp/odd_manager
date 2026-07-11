import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { ProjectWorkbenchMessage } from "./messages";
import {
  PHASE_CAPABILITY,
  type ProjectWorkbenchCommand,
  type ProjectWorkbenchState,
} from "./state";

export function updateProjectWorkbench(
  state: ProjectWorkbenchState,
  message: ProjectWorkbenchMessage,
): CapabilityUpdate<ProjectWorkbenchState, ProjectWorkbenchCommand> {
  return {
    state: {
      ...state,
      activePhase: message.phase,
      activeCapabilityId: PHASE_CAPABILITY[message.phase],
    },
    commands: [],
  };
}
