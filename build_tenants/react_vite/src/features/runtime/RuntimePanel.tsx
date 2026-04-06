import type { ManagerWorld, Selection } from "../../lib/types";

type RuntimePanelProps = {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function RuntimePanel({ world, onSelectSelection }: RuntimePanelProps) {
  return (
    <div className="odd-grid odd-grid--three">
      <RuntimeList
        eyebrow="Runs"
        title="ABG execution attempts"
        items={world.runtime.runs.map((run) => ({
          id: run.instance_id,
          label: run.edge ?? run.instance_id,
          summary: `${run.status} · worker ${run.selected_worker_id ?? run.worker_id ?? "unknown"}`,
          tone: run.status === "failed" ? "blocked" : run.status === "completed" ? "converged" : "active",
          selection: { kind: "run", id: run.instance_id } as const,
        }))}
        onSelectSelection={onSelectSelection}
      />

      <RuntimeList
        eyebrow="Graph Calls"
        title="Callable runtime boundaries"
        items={world.runtime.graph_calls.map((call) => ({
          id: call.instance_id,
          label: call.graph_function_id ?? call.instance_id,
          summary: `${call.status} · run ${call.run_id ?? "unknown"}`,
          tone: call.status === "failed" ? "blocked" : call.status === "closed" ? "converged" : "active",
          selection: { kind: "graph_call", id: call.instance_id } as const,
        }))}
        onSelectSelection={onSelectSelection}
      />

      <RuntimeList
        eyebrow="Frames"
        title="Recursive invocation frames"
        items={world.runtime.frames.map((frame) => ({
          id: frame.instance_id,
          label: frame.parent_edge ?? frame.instance_id,
          summary: `${frame.status} · depth ${frame.stack_depth ?? 0}`,
          tone: frame.status === "closed" ? "converged" : frame.status === "open" ? "active" : "pending",
          selection: { kind: "frame", id: frame.instance_id } as const,
        }))}
        onSelectSelection={onSelectSelection}
      />
    </div>
  );
}

function RuntimeList({
  eyebrow,
  title,
  items,
  onSelectSelection,
}: {
  eyebrow: string;
  title: string;
  items: Array<{
    id: string;
    label: string;
    summary: string;
    tone: "converged" | "pending" | "active" | "gated" | "blocked" | "attention";
    selection: Selection;
  }>;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <section className="panel panel--context">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="list-stack">
        {items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="list-row"
              onClick={() => onSelectSelection(item.selection)}
            >
              <div className="list-row__meta">
                <span className="panel__eyebrow">{eyebrow}</span>
                <span className={`status-chip ${item.tone}`}>{item.tone}</span>
              </div>
              <strong className="list-row__title">{item.label}</strong>
              <p className="list-row__summary">{item.summary}</p>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <strong>No {eyebrow.toLowerCase()} yet.</strong>
            <p>Run a published workorder to populate this ABG-native surface.</p>
          </div>
        )}
      </div>
    </section>
  );
}
