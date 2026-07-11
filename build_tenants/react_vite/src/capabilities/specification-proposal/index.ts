import type { CapabilityModule } from "../../contracts/developer-control";
import { specificationProposalContribution } from "./contribution";
import type { SpecificationProposalMessage } from "./messages";
import {
  INITIAL_SPECIFICATION_PROPOSAL_STATE,
  type SpecificationProposalCommand,
  type SpecificationProposalState,
  type SpecificationProposalSubscription,
} from "./state";
import { updateSpecificationProposal } from "./update";
import { SpecificationProposalView } from "./view";

export const specificationProposalModule: CapabilityModule<
  SpecificationProposalState,
  SpecificationProposalMessage,
  SpecificationProposalCommand,
  SpecificationProposalSubscription
> = {
  id: "specification-proposal",
  initialState: INITIAL_SPECIFICATION_PROPOSAL_STATE,
  update: updateSpecificationProposal,
  subscriptions: () => [],
  contribution: specificationProposalContribution,
  View: SpecificationProposalView,
};

export * from "./contribution";
export * from "./messages";
export * from "./selectors";
export * from "./state";
export * from "./update";
export * from "./view";
