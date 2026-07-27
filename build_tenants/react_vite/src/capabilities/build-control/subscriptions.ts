import type { ProjectRevision } from "@odd-manager/developer-control-contracts";
import type {
  BuildControlState,
  BuildControlSubscription,
} from "./state";

const ACTIVE_BUILD_SUBSCRIPTION_STATES = new Set([
  "queued",
  "starting",
  "running",
  "waiting_human",
  "stale",
  "disconnected",
]);

export function buildControlSubscriptions(
  state: BuildControlState,
  projectRoot: string,
  basisRevision: ProjectRevision | null,
): BuildControlSubscription[] {
  const active = state.snapshot?.executions.some((execution) => (
    ACTIVE_BUILD_SUBSCRIPTION_STATES.has(execution.state)
  ));
  return active
    ? [{ type: "build.poll", projectRoot, basisRevision, intervalMs: 600 }]
    : [];
}
