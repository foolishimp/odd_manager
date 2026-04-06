import type { ReactNode } from "react";
import type {
  AssetView,
  BindingView,
  ContinuationView,
  FrameView,
  GraphCallView,
  GraphView,
  ManagerWorld,
  RecentEventView,
  RuntimeRunView,
  Selection,
  WorkOrderView,
} from "../../lib/types";

type InspectorPanelProps = {
  world: ManagerWorld;
  selection: Selection | null;
  selectedGraphId: string;
  onSelectSelection: (selection: Selection) => void;
};

export function InspectorPanel({
  world,
  selection,
  selectedGraphId,
  onSelectSelection,
}: InspectorPanelProps) {
  if (!selection) {
    return (
      <aside className="panel panel--context inspector-panel">
        <div className="empty-state">
          <strong>No object selected.</strong>
          <p>Select a graph node, workorder, runtime aggregate, or document-backed asset.</p>
        </div>
      </aside>
    );
  }

  switch (selection.kind) {
    case "asset":
      return (
        <AssetInspector
          asset={world.domain.assets.find((item) => item.asset_id === selection.id) ?? null}
          bindings={world.domain.bindings}
          workorders={world.domain.workorders}
          onSelectSelection={onSelectSelection}
        />
      );
    case "binding":
      return (
        <BindingInspector
          binding={world.domain.bindings.find((item) => item.node === selection.id) ?? null}
          assets={world.domain.assets}
          workorders={world.domain.workorders}
          onSelectSelection={onSelectSelection}
        />
      );
    case "workorder":
      return (
        <WorkOrderInspector
          workorder={world.domain.workorders.find((item) => item.id === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
        />
      );
    case "run":
      return (
        <RuntimeAggregateInspector
          eyebrow="Run"
          title={selection.id}
          description="ABG-native execution attempt aggregate."
          payload={world.runtime.runs.find((item) => item.instance_id === selection.id) ?? null}
        />
      );
    case "graph_call":
      return (
        <RuntimeAggregateInspector
          eyebrow="Graph Call"
          title={selection.id}
          description="ABG-native callable boundary aggregate."
          payload={world.runtime.graph_calls.find((item) => item.instance_id === selection.id) ?? null}
        />
      );
    case "continuation":
      return (
        <RuntimeAggregateInspector
          eyebrow="Continuation"
          title={selection.id}
          description="ABG-native continuation aggregate requiring supervision."
          payload={world.runtime.continuations.find((item) => item.instance_id === selection.id) ?? null}
        />
      );
    case "frame":
      return (
        <RuntimeAggregateInspector
          eyebrow="Frame"
          title={selection.id}
          description="ABG-native recursive invocation frame."
          payload={world.runtime.frames.find((item) => item.instance_id === selection.id) ?? null}
        />
      );
    case "event":
      return (
        <EventInspector
          event={world.runtime.recent_events.find((item) => item.event_id === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
        />
      );
    case "graph":
      return (
        <GraphInspector
          graph={world.graph_set.graphs.find((item) => item.id === selection.id) ?? null}
          selectedGraphId={selectedGraphId}
          onSelectSelection={onSelectSelection}
        />
      );
    default:
      return (
        <aside className="panel panel--context inspector-panel">
          <div className="empty-state">
            <strong>Unsupported selection.</strong>
            <p>The current selection cannot be rendered in the inspector.</p>
          </div>
        </aside>
      );
  }
}

function AssetInspector({
  asset,
  bindings,
  workorders,
  onSelectSelection,
}: {
  asset: AssetView | null;
  bindings: BindingView[];
  workorders: WorkOrderView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!asset) {
    return <MissingInspector noun="asset" />;
  }

  const relatedBindings = bindings.filter((binding) => binding.asset_ids.includes(asset.asset_id));
  const relatedNodeNames = new Set(relatedBindings.map((binding) => binding.node));
  const relatedWorkorders = workorders.filter(
    (workorder) =>
      workorder.inputs.some((item) => relatedNodeNames.has(item)) ||
      workorder.outputs.some((item) => relatedNodeNames.has(item)),
  );

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow="Asset"
        title={asset.asset_id}
        subtitle={`${asset.declared_type} · ${asset.kind}`}
        tone={asset.metadata.exists === "false" ? "blocked" : "converged"}
      />

      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["URI", asset.uri],
            ["Relative Path", asset.metadata.relative_path ?? "not published"],
            ["Projection Source", asset.projection_source ?? "unspecified"],
            ["Updates", String(asset.update_count ?? 0)],
            ["Mutable", asset.provenance?.mutable ? "true" : "false"],
          ]}
        />

        <InspectorSection title="Bindings">
          <div className="inline-pills">
            {relatedBindings.length ? (
              relatedBindings.map((binding) => (
                <button
                  key={binding.node}
                  type="button"
                  className="status-chip pending"
                  onClick={() => onSelectSelection({ kind: "binding", id: binding.node })}
                >
                  {binding.node}
                </button>
              ))
            ) : (
              <span className="status-chip attention">unbound</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Checkpoint">
          <DetailRows
            rows={[
              ["Exists", String(asset.checkpoint?.exists ?? false)],
              ["Path Kind", asset.checkpoint?.path_kind ?? "unknown"],
              ["Bytes", asset.checkpoint?.bytes != null ? String(asset.checkpoint.bytes) : "unknown"],
              ["Digest", asset.checkpoint?.content_digest ?? "not published"],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Provenance">
          <DetailRows
            rows={[
              ["Model", asset.provenance?.model ?? "unknown"],
              ["Source", asset.provenance?.source ?? "unknown"],
              ["History Basis", asset.provenance?.history_basis ?? "unknown"],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Related WorkOrders">
          <div className="inline-pills">
            {relatedWorkorders.length ? (
              relatedWorkorders.map((workorder) => (
                <button
                  key={workorder.id}
                  type="button"
                  className={`status-chip ${workorder.status}`}
                  onClick={() => onSelectSelection({ kind: "workorder", id: workorder.id })}
                >
                  {workorder.label}
                </button>
              ))
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function BindingInspector({
  binding,
  assets,
  workorders,
  onSelectSelection,
}: {
  binding: BindingView | null;
  assets: AssetView[];
  workorders: WorkOrderView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!binding) {
    return <MissingInspector noun="binding" />;
  }

  const relatedWorkorders = workorders.filter(
    (workorder) => workorder.inputs.includes(binding.node) || workorder.outputs.includes(binding.node),
  );

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow="Binding"
        title={binding.node}
        subtitle={`${binding.asset_ids.length} bound asset(s)`}
        tone={relatedWorkorders.length ? relatedWorkorders[0]?.status ?? "pending" : "pending"}
      />

      <div className="inspector-stack">
        <InspectorSection title="Bound Assets">
          <div className="inline-pills">
            {binding.asset_ids.length ? (
              binding.asset_ids.map((assetId) => (
                <button
                  key={assetId}
                  type="button"
                  className="status-chip converged"
                  onClick={() => onSelectSelection({ kind: "asset", id: assetId })}
                >
                  {assets.find((asset) => asset.asset_id === assetId)?.metadata.relative_path ?? assetId}
                </button>
              ))
            ) : (
              <span className="status-chip blocked">no assets</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Connected WorkOrders">
          <div className="inline-pills">
            {relatedWorkorders.length ? (
              relatedWorkorders.map((workorder) => (
                <button
                  key={workorder.id}
                  type="button"
                  className={`status-chip ${workorder.status}`}
                  onClick={() => onSelectSelection({ kind: "workorder", id: workorder.id })}
                >
                  {workorder.label}
                </button>
              ))
            ) : (
              <span className="status-chip attention">no published workorders</span>
            )}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function WorkOrderInspector({
  workorder,
  onSelectSelection,
}: {
  workorder: WorkOrderView | null;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!workorder) {
    return <MissingInspector noun="workorder" />;
  }

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow="WorkOrder"
        title={workorder.label}
        subtitle={workorder.graph_function_id}
        tone={workorder.status}
      />

      <div className="inspector-stack">
        <p>{workorder.intent}</p>

        <InspectorSection title="Inputs">
          <div className="inline-pills">
            {workorder.inputs.map((input) => (
              <button
                key={input}
                type="button"
                className="status-chip pending"
                onClick={() => onSelectSelection({ kind: "binding", id: input })}
              >
                {input}
              </button>
            ))}
          </div>
        </InspectorSection>

        <InspectorSection title="Outputs">
          <div className="inline-pills">
            {workorder.outputs.map((output) => (
              <button
                key={output}
                type="button"
                className="status-chip converged"
                onClick={() => onSelectSelection({ kind: "binding", id: output })}
              >
                {output}
              </button>
            ))}
          </div>
        </InspectorSection>

        <InspectorSection title="Gap Overlay">
          {workorder.gap ? (
            <DetailRows
              rows={[
                ["Edge", workorder.gap.edge],
                ["Delta", workorder.gap.delta.toFixed(2)],
                ["Summary", workorder.gap.delta_summary],
                ["Failing", workorder.gap.failing.join(", ") || "none"],
                ["Passing", workorder.gap.passing.join(", ") || "none"],
              ]}
            />
          ) : (
            <div className="empty-state">
              <strong>No active gap overlay.</strong>
              <p>The current workorder is converged from the query-library perspective.</p>
            </div>
          )}
        </InspectorSection>

        <InspectorSection title="Runtime Links">
          <div className="inline-pills">
            {workorder.run_ids.map((runId) => (
              <button
                key={runId}
                type="button"
                className="status-chip active"
                onClick={() => onSelectSelection({ kind: "run", id: runId })}
              >
                run:{runId}
              </button>
            ))}
            {workorder.call_ids.map((callId) => (
              <button
                key={callId}
                type="button"
                className="status-chip active"
                onClick={() => onSelectSelection({ kind: "graph_call", id: callId })}
              >
                call:{callId}
              </button>
            ))}
            {workorder.open_continuation_ids.map((continuationId) => (
              <button
                key={continuationId}
                type="button"
                className="status-chip gated"
                onClick={() => onSelectSelection({ kind: "continuation", id: continuationId })}
              >
                continuation:{continuationId}
              </button>
            ))}
            {!workorder.run_ids.length &&
            !workorder.call_ids.length &&
            !workorder.open_continuation_ids.length ? (
              <span className="status-chip attention">no runtime aggregates</span>
            ) : null}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function RuntimeAggregateInspector({
  eyebrow,
  title,
  description,
  payload,
}: {
  eyebrow: string;
  title: string;
  description: string;
  payload:
    | RuntimeRunView
    | GraphCallView
    | ContinuationView
    | FrameView
    | Record<string, unknown>
    | null;
}) {
  if (!payload) {
    return <MissingInspector noun={eyebrow.toLowerCase()} />;
  }

  const tone = runtimeTone("status" in payload ? payload.status : null);

  return (
    <aside className="panel panel--governance inspector-panel">
      <InspectorHero eyebrow={eyebrow} title={title} subtitle={description} tone={tone} />
      <div className="inspector-stack">
        <pre>{JSON.stringify(payload, null, 2)}</pre>
      </div>
    </aside>
  );
}

function EventInspector({
  event,
  onSelectSelection,
}: {
  event: RecentEventView | null;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!event) {
    return <MissingInspector noun="event" />;
  }

  return (
    <aside className="panel panel--governance inspector-panel">
      <InspectorHero
        eyebrow="Event"
        title={event.event_id ?? "event"}
        subtitle={event.event_type ?? "recent runtime fact"}
        tone="attention"
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Event Time", event.event_time ?? "unknown"],
            ["Aggregate Type", event.aggregate_type ?? "unknown"],
            ["Aggregate Id", event.aggregate_id ?? "unknown"],
            ["Run Id", event.run_id ?? "none"],
            ["Call Id", event.call_id ?? "none"],
            ["Continuation Id", event.continuation_id ?? "none"],
            ["Frame Id", event.frame_id ?? "none"],
          ]}
        />
        <div className="inline-pills">
          {event.run_id ? (
            <button
              type="button"
              className="status-chip active"
              onClick={() => onSelectSelection({ kind: "run", id: event.run_id as string })}
            >
              open run
            </button>
          ) : null}
          {event.call_id ? (
            <button
              type="button"
              className="status-chip active"
              onClick={() => onSelectSelection({ kind: "graph_call", id: event.call_id as string })}
            >
              open call
            </button>
          ) : null}
          {event.continuation_id ? (
            <button
              type="button"
              className="status-chip gated"
              onClick={() =>
                onSelectSelection({ kind: "continuation", id: event.continuation_id as string })
              }
            >
              open continuation
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function GraphInspector({
  graph,
  selectedGraphId,
  onSelectSelection,
}: {
  graph: GraphView | null;
  selectedGraphId: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!graph) {
    return <MissingInspector noun="graph" />;
  }

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow="Graph"
        title={graph.label}
        subtitle={selectedGraphId === graph.id ? "currently selected" : graph.derivation}
        tone={graph.status}
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Derivation", graph.derivation],
            ["Nodes", String(graph.nodes.length)],
            ["Segments", String(graph.segments.length)],
            [
              "WorkOrders",
              String(graph.nodes.filter((node) => node.kind === "workorder").length),
            ],
          ]}
        />
        <InspectorSection title="Top Nodes">
          <div className="inline-pills">
            {graph.nodes.slice(0, 8).map((node) => (
              <button
                key={node.id}
                type="button"
                className={`status-chip ${node.status}`}
                onClick={() => onSelectSelection(selectionFromNode(node.ref_kind, node.ref_id))}
              >
                {node.label}
              </button>
            ))}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function InspectorHero({
  eyebrow,
  title,
  subtitle,
  tone,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone: "converged" | "pending" | "active" | "gated" | "blocked" | "attention";
}) {
  return (
    <div className="object-hero">
      <div>
        <span className="panel__eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <span className={`status-chip ${tone}`}>{tone}</span>
      <p>{subtitle}</p>
    </div>
  );
}

function InspectorSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <span className="panel__eyebrow">{title}</span>
      {children}
    </section>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="detail-rows">
      {rows.map(([label, value]) => (
        <div key={label} className="detail-rows__item">
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function MissingInspector({ noun }: { noun: string }) {
  return (
    <aside className="panel panel--context inspector-panel">
      <div className="empty-state">
        <strong>{capitalize(noun)} is not available.</strong>
        <p>The current projection does not include a published {noun} with that identity.</p>
      </div>
    </aside>
  );
}

function selectionFromNode(
  kind: "asset" | "workorder" | "binding",
  id: string,
): Selection {
  if (kind === "asset") {
    return { kind: "asset", id };
  }
  if (kind === "binding") {
    return { kind: "binding", id };
  }
  return { kind: "workorder", id };
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function runtimeTone(status: unknown) {
  const value = typeof status === "string" ? status : "";
  if (["failed", "timed_out", "rejected"].includes(value)) {
    return "blocked" as const;
  }
  if (["open", "needs_review", "gated"].includes(value)) {
    return "gated" as const;
  }
  if (["queued", "pending", "started", "dispatched"].includes(value)) {
    return "active" as const;
  }
  if (["closed", "completed"].includes(value)) {
    return "converged" as const;
  }
  return "attention" as const;
}
