import type { CapabilityModule } from "../../contracts/developer-control";
import { assuranceAttentionContribution } from "./contribution";
import type { AssuranceAttentionMessage } from "./messages";
import {
  createAssuranceAttentionState,
  INITIAL_ASSURANCE_ATTENTION_STATE,
  type AssuranceAttentionCommand,
  type AssuranceAttentionState,
  type AssuranceAttentionSubscription,
} from "./state";
import { updateAssuranceAttention } from "./update";
import { AssuranceAttentionView } from "./view";

export const assuranceAttentionModule: CapabilityModule<
  AssuranceAttentionState,
  AssuranceAttentionMessage,
  AssuranceAttentionCommand,
  AssuranceAttentionSubscription
> = {
  id: "assurance-attention",
  initialState: INITIAL_ASSURANCE_ATTENTION_STATE,
  update: updateAssuranceAttention,
  subscriptions: () => [],
  contribution: assuranceAttentionContribution,
  View: AssuranceAttentionView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./update";
export * from "./view";
export { createAssuranceAttentionState };
