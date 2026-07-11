import {
  capabilitySubscriptionEventSchema,
  capabilitySubscriptionSchema,
} from "@odd-manager/developer-control-contracts";

export function admitDeveloperControlSubscription(input: unknown) {
  return capabilitySubscriptionSchema.parse(input);
}

export function admitDeveloperControlSubscriptionEvent(input: unknown) {
  return capabilitySubscriptionEventSchema.parse(input);
}
