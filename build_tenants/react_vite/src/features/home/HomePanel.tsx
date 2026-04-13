import type { ManagerWorld, Selection } from "../../lib/types";
import { buildSituationModel } from "../../lib/situation";
import { labelDeliveryStatus, presentAmbiguity } from "../../lib/presentation";

type HomePanelProps = {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function HomePanel({ world, onSelectSelection }: HomePanelProps) {
  const situation = buildSituationModel(world);
  const requirementsSurface = situation.planningSurfaces.find((surface) => surface.id === "requirements");
  const goalsSurface = situation.planningSurfaces.find((surface) => surface.id === "goals");
  const epicsSurface = situation.planningSurfaces.find((surface) => surface.id === "epics");
  const acceptanceSurface = situation.planningSurfaces.find((surface) => surface.id === "acceptance");
  const releaseSurface = situation.planningSurfaces.find((surface) => surface.id === "release");
  const priorityRequirements = situation.priorityRequirements;
  const topWorkorders = [...world.domain.workorders]
    .sort((left, right) => (right.gap?.delta ?? 0) - (left.gap?.delta ?? 0))
    .slice(0, 4);
  const openContinuations = world.runtime.continuations.filter(
    (continuation) => continuation.status === "open",
  );
  const recentEvents = [...world.runtime.recent_events].reverse().slice(0, 5);
  const blockingAmbiguities = world.domain.ambiguity_register.ambiguities
    .filter((entry) => entry.blocking)
    .slice(0, 4);

  return (
    <div className="odd-grid odd-grid--three">
      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Backlog Driver</span>
            <h2>Requirements drive the delivery model.</h2>
          </div>
          <p>
            The project model should read as backlog to epics to work items to acceptance to release,
            with blockers and operational history layered underneath that spine.
          </p>
        </div>
        <div className="odd-card-grid">
          <div className="odd-card">
            <span className="panel__eyebrow">Backlog</span>
            <strong>{world.domain.requirements.length}</strong>
            <p>First-class backlog items currently projected from the workspace requirement surface.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Goals</span>
            <strong>{goalsSurface?.count ?? 0}</strong>
            <p>{goalsSurface?.label ?? "Goals"} currently projected.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Epics</span>
            <strong>{epicsSurface?.count ?? 0}</strong>
            <p>{epicsSurface?.label ?? "Epics / Feature Breakdown"} currently projected.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Acceptance</span>
            <strong>{acceptanceSurface?.count ?? 0}</strong>
            <p>{acceptanceSurface?.label ?? "Acceptance Tests"} currently projected.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Release</span>
            <strong>{releaseSurface?.count ?? 0}</strong>
            <p>{releaseSurface?.label ?? "Release Readiness"} currently projected.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Current Delivery Posture</span>
            <strong>{world.domain.query_contract.version}</strong>
            <p>{situation.headline}</p>
          </div>
        </div>
        {situation.requirementStatusSummary.length ? (
          <div className="inline-pills">
            {situation.requirementStatusSummary.slice(0, 6).map((item) => (
              <span key={item.id} className={`status-chip ${item.tone}`}>
                {item.label} {item.count}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Planning Spine</span>
            <h2>Backlog and delivery artifacts should be readable in order.</h2>
          </div>
          <p>Use these as the primary agile read of the project before dropping into blockers or runtime detail.</p>
        </div>
        <div className="list-stack">
          {situation.planningSurfaces.map((surface) => (
            <div key={surface.id} className="list-row">
              <div className="list-row__meta">
                <span className="panel__eyebrow">{surface.label}</span>
                <span className={`status-chip ${surface.count ? "converged" : "attention"}`}>
                  {surface.count ? `${surface.count} projected` : "not projected"}
                </span>
              </div>
              <strong className="list-row__title">{surface.label}</strong>
              <p className="list-row__summary">
                {surface.id === "requirements"
                  ? world.domain.requirements.length
                    ? `${world.domain.requirements.length} backlog item(s) parsed, backed by ${surface.count} projected planning artifact(s).`
                    : "No backlog items were parsed from the requirement surface."
                  : surface.count
                    ? `${surface.assetIds.slice(0, 3).join(", ")}${surface.assetIds.length > 3 ? " …" : ""}`
                    : "No matching artifact is currently visible in the project model."}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Priority Requirements</span>
            <h2>Backlog items with the strongest claim on delivery attention.</h2>
          </div>
          <p>Requirements are the primary driver. Coverage posture stays explicit instead of being inferred from workflow drift alone.</p>
        </div>
        <div className="list-stack">
          {priorityRequirements.length ? (
            priorityRequirements.map((requirement) => (
              <button
                key={requirement.id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "requirement", id: requirement.id })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{requirement.priority ?? "Requirement"}</span>
                  <span className={`status-chip ${requirement.tone}`}>
                    {labelDeliveryStatus(requirement.status ?? requirement.tone)}
                  </span>
                </div>
                <strong className="list-row__title">
                  {requirement.id} · {requirement.title}
                </strong>
                <p className="list-row__summary">
                  {requirement.summary} Code {requirement.codeRefCount} · Test {requirement.testRefCount} · Acceptance{" "}
                  {requirement.acceptanceCount}
                </p>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <strong>No backlog items are projected.</strong>
              <p>The current workspace did not yield any first-class requirements.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel panel--governance">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Operational Follow-Up</span>
            <h2>Open threads in the operational history that still need supervision.</h2>
          </div>
          <p>These records stay ABG-native and are intentionally separate from the planning model.</p>
        </div>
        <div className="list-stack">
          {openContinuations.length ? (
            openContinuations.map((continuation) => (
              <button
                key={continuation.instance_id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "continuation", id: continuation.instance_id })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{continuation.continuation_kind ?? "Open Thread"}</span>
                  <span className="status-chip gated">{labelDeliveryStatus(continuation.status)}</span>
                </div>
                <strong className="list-row__title">{continuation.instance_id}</strong>
                <p className="list-row__summary">
                  Caused by {continuation.caused_by_event_id ?? "unknown event"}.
                </p>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <strong>No open threads.</strong>
              <p>The current workspace has no unresolved operational follow-up.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Derived Work Items</span>
            <h2>Workflow items remain downstream of the backlog model.</h2>
          </div>
          <p>These are still useful for operator supervision, but they should be read as delivery machinery under the requirement spine.</p>
        </div>
        <div className="list-stack">
          {topWorkorders.map((workorder) => (
            <button
              key={workorder.id}
              type="button"
              className="list-row"
              onClick={() => onSelectSelection({ kind: "workorder", id: workorder.id })}
            >
              <div className="list-row__meta">
                <span className="panel__eyebrow">Work Item</span>
                <span className={`status-chip ${workorder.status}`}>
                  {labelDeliveryStatus(workorder.status)}
                </span>
              </div>
              <strong className="list-row__title">{workorder.label}</strong>
              <p className="list-row__summary">{workorder.intent}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Model Boundary</span>
            <h2>Project planning and operational history stay separate.</h2>
          </div>
          <p>The manager composes them into one supervisory product surface without merging their truth classes.</p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">Operational History</span>
            <strong>{world.boundary.runtime_aggregate_provider}</strong>
            <p>Runs, workflow calls, open threads, frames, and recent event history.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Project Model</span>
            <strong>{world.boundary.domain_source}</strong>
            <p>Artifacts, families, workflow handoffs, programs, blockers, and progress overlays.</p>
          </div>
        </div>
      </section>

      <section className="panel panel--governance">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Blockers</span>
            <h2>Capability gaps and open delivery decisions are visible on the overview surface.</h2>
          </div>
          <p>These signals come from the project model, not from operational-history threads.</p>
        </div>
        {situation.capabilityGaps.length ? (
          <div className="inline-pills">
            {situation.capabilityGaps.slice(0, 4).map((gap) => (
              <span key={gap.canonicalName} className="status-chip attention">
                {gap.label} {gap.count}
              </span>
            ))}
          </div>
        ) : null}
        <div className="list-stack">
          {blockingAmbiguities.length ? (
            blockingAmbiguities.map((entry) => (
              <button
                key={entry.ambiguity_id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "ambiguity", id: entry.ambiguity_id })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{presentAmbiguity(entry).classificationLabel}</span>
                  <span className="status-chip blocked">{presentAmbiguity(entry).statusLabel}</span>
                </div>
                <strong className="list-row__title">{entry.ambiguity_id}</strong>
                <p className="list-row__summary">{presentAmbiguity(entry).summary}</p>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <strong>No active blockers.</strong>
              <p>The current project model does not report a hard-stop blocker posture.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Recent Activity</span>
            <h2>Latest replay-visible operational facts.</h2>
          </div>
          <p>Use history for the full event-derived narrative.</p>
        </div>
        <div className="list-stack">
          {recentEvents.map((event) => (
            <button
              key={event.event_id ?? `${event.event_time}-${event.event_type}`}
              type="button"
              className="list-row"
              onClick={() => {
                if (event.event_id) {
                  onSelectSelection({ kind: "event", id: event.event_id });
                }
              }}
            >
              <div className="list-row__meta">
                <span className="panel__eyebrow">{event.aggregate_type ?? "event"}</span>
                <span className="status-chip attention">{event.event_type ?? "activity"}</span>
              </div>
              <strong className="list-row__title">{event.event_id ?? "event"}</strong>
              <p className="list-row__summary">{event.event_time ?? "No event time recorded."}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
