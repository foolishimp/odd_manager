import type {
  CapabilityId,
  CapabilitySubscription,
  CapabilitySubscriptionEvent,
  DeveloperControlBootstrap,
} from "@odd-manager/developer-control-contracts";
import type { DeveloperControlSurface } from "./module";
import type { RunInspectorFocus } from "../../lib/projectDeepLink";

export type ResolveContextCommand = {
  type: "host.resolve-context";
  commandId: string;
  correlationId: string;
  projectRoot: string;
};

export type NavigateCommand = {
  type: "host.project-navigation";
  commandId: string;
  correlationId: string;
  projectRoot: string;
  surface: DeveloperControlSurface;
  runFocus: RunInspectorFocus | null;
};

export type DeveloperControlHostCommand = ResolveContextCommand | NavigateCommand;

export type CapabilityEventDelivery = {
  capabilityId: CapabilityId;
  subscriptionId: string;
  event: CapabilitySubscriptionEvent;
};

export type DeveloperControlHostMessage =
  | { type: "host/context-requested"; command: ResolveContextCommand }
  | {
      type: "host/context-admitted";
      commandId: string;
      correlationId: string;
      bootstrap: DeveloperControlBootstrap;
    }
  | {
      type: "host/context-failed";
      commandId: string;
      correlationId: string;
      error: string;
    }
  | { type: "host/capability-registered"; capabilityId: string }
  | { type: "host/subscription-declared"; subscription: CapabilitySubscription }
  | { type: "host/subscription-cleared"; subscriptionId: string }
  | { type: "host/subscription-event"; event: CapabilitySubscriptionEvent }
  | {
      type: "host/navigation-requested";
      command: NavigateCommand;
    }
  | {
      type: "host/navigation-admitted";
      commandId: string;
      correlationId: string;
      surface: DeveloperControlSurface;
    }
  | {
      type: "host/navigation-failed";
      commandId: string;
      correlationId: string;
      error: string;
    };
