import type { ManagerWorld, Selection } from "../../lib/types";

type HomePanelProps = {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function HomePanel({ world, onSelectSelection }: HomePanelProps) {
  const topWorkorders = [...world.domain.workorders]
    .sort((left, right) => (right.gap?.delta ?? 0) - (left.gap?.delta ?? 0))
    .slice(0, 4);
  const openContinuations = world.runtime.continuations.filter(
    (continuation) => continuation.status === "open",
  );
  const recentEvents = [...world.runtime.recent_events].reverse().slice(0, 5);

  return (
    <div className="odd-grid odd-grid--three">
      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Immediate Posture</span>
            <h2>{world.overview.headline}</h2>
          </div>
          <p>{world.overview.summary}</p>
        </div>
        <div className="odd-card-grid">
          <div className="odd-card">
            <span className="panel__eyebrow">Graph Set</span>
            <strong>{world.graph_set.label}</strong>
            <p>{world.graph_set.graphs.length} graph(s) currently projected.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Delta</span>
            <strong>{world.overview.total_delta.toFixed(2)}</strong>
            <p>{world.overview.total_gaps} active gap overlay(s).</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Runtime</span>
            <strong>{world.runtime.event_count}</strong>
            <p>{world.overview.active_runs} active run(s) visible from ABG.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Continuations</span>
            <strong>{world.overview.open_continuations}</strong>
            <p>Open governance obligations still visible after replay.</p>
          </div>
        </div>
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Priority Workorders</span>
            <h2>Published callable boundaries with the highest current delta.</h2>
          </div>
          <p>These are ODD query overlays, not runtime aggregates.</p>
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
                <span className="panel__eyebrow">WorkOrder</span>
                <span className={`status-chip ${workorder.status}`}>{workorder.status}</span>
              </div>
              <strong className="list-row__title">{workorder.label}</strong>
              <p className="list-row__summary">{workorder.intent}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel--governance">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Open Obligations</span>
            <h2>Continuations and event truth that still need supervision.</h2>
          </div>
          <p>These surfaces remain ABG-native.</p>
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
                  <span className="panel__eyebrow">{continuation.continuation_kind ?? "Continuation"}</span>
                  <span className="status-chip gated">{continuation.status}</span>
                </div>
                <strong className="list-row__title">{continuation.instance_id}</strong>
                <p className="list-row__summary">
                  Caused by {continuation.caused_by_event_id ?? "unknown event"}.
                </p>
              </button>
            ))
          ) : (
            <div className="empty-state">
              <strong>No open continuations.</strong>
              <p>The current workspace has no unresolved ABG continuation aggregate.</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Boundary</span>
            <h2>ABG runtime truth and ODD query overlays stay separate.</h2>
          </div>
          <p>The manager composes them into one supervisory surface.</p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">ABG Native</span>
            <strong>{world.boundary.runtime_aggregate_provider}</strong>
            <p>Runs, graph calls, continuations, frames, and recent event truth.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">ODD Query</span>
            <strong>{world.boundary.domain_source}</strong>
            <p>Assets, types, bindings, functions, gap semantics, and convergence overlays.</p>
          </div>
        </div>
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Recent Events</span>
            <h2>Latest replay-visible runtime facts.</h2>
          </div>
          <p>Use provenance for the full event-derived narrative.</p>
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
                <span className="status-chip attention">{event.event_type ?? "event"}</span>
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
