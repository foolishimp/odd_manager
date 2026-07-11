import type { ReactNode } from "react";
import type { CapabilityContribution } from "@odd-manager/developer-control-contracts";
import type { CapabilityViewProps } from "../../contracts/developer-control";
import { CapabilityAvailabilityState } from "../../components/primitives/CapabilityAvailability";
import type { ProjectWorkbenchMessage } from "./messages";
import {
  PHASE_CAPABILITY,
  type ProjectWorkbenchState,
  type WorkbenchPhase,
} from "./state";

const PHASES: Array<{ id: WorkbenchPhase; label: string }> = [
  { id: "review", label: "Review" },
  { id: "tune", label: "Tune" },
  { id: "build", label: "Build" },
  { id: "assure", label: "Assure" },
];

type ProjectWorkbenchViewProps = CapabilityViewProps<ProjectWorkbenchState, ProjectWorkbenchMessage> & {
  activeCapability?: ReactNode;
  phaseContributions?: CapabilityContribution[];
  supportingCapability?: ReactNode;
};

export function ProjectWorkbenchView({
  state,
  context,
  dispatch,
  activeCapability,
  phaseContributions = [],
  supportingCapability,
}: ProjectWorkbenchViewProps) {
  return (
    <section className="project-workbench" aria-label="Project Workbench">
      <header className="project-workbench__identity">
        <div className="project-workbench__identity-main">
          <span className="developer-capability__kicker">Selected Project</span>
          <h1>{context.project.label}</h1>
          <code>{context.project.root}</code>
        </div>
        <dl className="project-workbench__revision">
          <div><dt>Revision</dt><dd>{context.revision?.revision ?? "Not observed"}</dd></div>
          <div><dt>Workspace</dt><dd>{context.workspaceRef ?? "Unpublished"}</dd></div>
        </dl>
      </header>

      <nav className="project-workbench__phases" aria-label="Developer goal phases">
        <div role="tablist" aria-label="Review, Tune, Build, Assure">
          {PHASES.map((phase) => {
            const phaseContribution = phaseContributions.find(
              (entry) => entry.id === PHASE_CAPABILITY[phase.id],
            );
            return (
              <button
                key={phase.id}
                type="button"
                role="tab"
                aria-selected={state.activePhase === phase.id}
                className={state.activePhase === phase.id ? "is-active" : ""}
                onClick={() => dispatch({ type: "workbench/phase-selected", phase: phase.id })}
              >
                <span className="project-workbench__phase-label">{phase.label}</span>
                {phaseContribution ? (
                  <CapabilityAvailabilityState
                    contribution={phaseContribution}
                    readyLabel="available"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="project-workbench__body">
        <div className="project-workbench__active">{activeCapability}</div>
      </div>

      {supportingCapability ? (
        <div className="project-workbench__supporting">{supportingCapability}</div>
      ) : null}
    </section>
  );
}
