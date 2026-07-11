import type { CapabilityViewProps } from "../../contracts/developer-control";
import { CapabilityAvailability } from "../../components/primitives/CapabilityAvailability";
import type { RunObservationMessage } from "./messages";
import type { RunObservationState } from "./state";

export function RunObservationView({
  contribution,
  dispatch,
}: CapabilityViewProps<RunObservationState, RunObservationMessage>) {
  return (
    <section className="run-observation-contribution" aria-labelledby="run-observation-heading">
      <div>
        <span className="developer-capability__kicker">Supporting capability</span>
        <h2 id="run-observation-heading">Run Observation</h2>
      </div>
      <CapabilityAvailability contribution={contribution} showDetail={false} />
      <div className="run-observation-contribution__commands">
        <button
          type="button"
          className="secondary"
          onClick={() => dispatch({
            type: "run-observation/surface-requested",
            surface: "ai-workspace",
          })}
        >
          Open AI Workspace
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => dispatch({
            type: "run-observation/surface-requested",
            surface: "run-inspector",
          })}
        >
          Open Run Inspector
        </button>
      </div>
    </section>
  );
}
