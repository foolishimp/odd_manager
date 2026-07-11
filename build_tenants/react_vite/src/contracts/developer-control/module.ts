import type { ComponentType } from "react";
import type {
  CapabilityContribution,
  CapabilityId,
  ManagerContext,
} from "@odd-manager/developer-control-contracts";

export type DeveloperControlSurface =
  | "project-workbench"
  | "ai-workspace"
  | "run-inspector"
  | "ticket-board";

export type SupportingSurfaceCommand = {
  type: "supporting-surface.open";
  surface: Exclude<DeveloperControlSurface, "project-workbench">;
};

export type CapabilityUpdate<State, Command> = {
  state: State;
  commands: Command[];
};

export type CapabilityViewProps<State, Message> = {
  state: State;
  context: ManagerContext;
  contribution: CapabilityContribution;
  dispatch: (message: Message) => void;
};

export type CapabilityModule<State, Message, Command, Subscription> = {
  id: CapabilityId;
  initialState: State;
  update: (state: State, message: Message) => CapabilityUpdate<State, Command>;
  subscriptions: (state: State, context: ManagerContext) => Subscription[];
  contribution: (
    state: State,
    context: ManagerContext,
    contributions: CapabilityContribution[],
  ) => CapabilityContribution | null;
  View: ComponentType<CapabilityViewProps<State, Message>>;
};
