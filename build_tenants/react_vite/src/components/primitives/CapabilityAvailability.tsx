import type {
  CapabilityAvailability as Availability,
  CapabilityContribution,
} from "@odd-manager/developer-control-contracts";

function availabilityDetail(availability: Availability) {
  if (availability.kind === "ready") {
    return availability.contractRefs.length === 1
      ? availability.contractRefs[0]
      : `${availability.contractRefs.length} admitted contracts`;
  }
  if (availability.kind === "unavailable") return availability.reason;
  if (availability.kind === "unsupported") return availability.reason;
  if (availability.kind === "stale") return availability.reason;
  if (availability.kind === "error") return availability.error;
  return "Resolving capability contracts.";
}

export function CapabilityAvailabilityState({
  contribution,
  readyLabel = "ready",
}: {
  contribution: CapabilityContribution;
  readyLabel?: "ready" | "available";
}) {
  const stateLabel = contribution.availability.kind === "ready"
    ? readyLabel
    : contribution.availability.kind.replace("_", " ");
  return (
    <span
      className="capability-availability__state"
      title={availabilityDetail(contribution.availability)}
    >
      {stateLabel}
    </span>
  );
}

export function CapabilityAvailability({
  contribution,
  showDetail = true,
}: {
  contribution: CapabilityContribution;
  showDetail?: boolean;
}) {
  return (
    <div
      className={`capability-availability capability-availability--${contribution.availability.kind}`}
      data-capability-id={contribution.id}
      data-availability={contribution.availability.kind}
    >
      <CapabilityAvailabilityState contribution={contribution} />
      {showDetail ? (
        <span className="capability-availability__detail">
          {availabilityDetail(contribution.availability)}
        </span>
      ) : null}
    </div>
  );
}
