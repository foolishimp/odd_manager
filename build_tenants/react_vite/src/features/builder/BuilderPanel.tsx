import type {
  AssetTypeProfile,
  FunctionView,
  GraphFunctionView,
  ManagerWorld,
  Selection,
  WorkOrderView,
} from "../../lib/types";

type BuilderPanelProps = {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function BuilderPanel({ world, onSelectSelection }: BuilderPanelProps) {
  const highlightedTypes = world.domain.asset_types.slice(0, 4);

  return (
    <div className="odd-grid odd-grid--three">
      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Graph Function Registry</span>
            <h2>Published GTL carriers available over the current asset graph.</h2>
          </div>
          <p>Inspect public carriers, cumulative environment contracts, and realized vectors.</p>
        </div>
        <div className="list-stack">
          {world.domain.graph_functions.map((graphFunction) => (
            <GraphFunctionListRow
              key={graphFunction.id}
              graphFunction={graphFunction}
              onSelectSelection={onSelectSelection}
            />
          ))}
        </div>
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">WorkOrder Lenses</span>
            <h2>Manager-facing execution views derived from published jobs.</h2>
          </div>
          <p>Jobs bind to graph functions; workorders expose operator-facing progress and runtime links.</p>
        </div>
        <div className="list-stack">
          {world.domain.workorders.map((workorder) => (
            <WorkOrderListRow
              key={workorder.id}
              workorder={workorder}
              onSelectSelection={onSelectSelection}
            />
          ))}
        </div>
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Function Catalog</span>
            <h2>Descriptive leaf topology over the asset graph.</h2>
          </div>
          <p>These functions explain internal graph structure but are not the published execution authority.</p>
        </div>
        <div className="list-stack">
          {world.domain.functions.map((fn) => (
            <FunctionListRow key={fn.id} fn={fn} onSelectSelection={onSelectSelection} />
          ))}
        </div>
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Asset Types</span>
            <h2>Semantic carriers currently visible to the manager.</h2>
          </div>
          <p>Richer upstream detail can still harden without blocking the manager build.</p>
        </div>
        <div className="odd-card-grid">
          {highlightedTypes.map((assetType) => (
            <AssetTypeCard key={assetType.name} assetType={assetType} />
          ))}
        </div>
      </section>

      <section className="panel panel--governance">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Boundary</span>
            <h2>Query-library overlays stay read-only and replay-safe.</h2>
          </div>
          <p>{world.boundary.graph_derivation}</p>
        </div>
        <div className="list-stack">
          {world.domain.semantic_facets.map((facet) => (
            <div key={facet.name} className="odd-card">
              <span className="panel__eyebrow">{facet.name}</span>
              <strong>{facet.description}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FunctionListRow({
  fn,
  onSelectSelection,
}: {
  fn: FunctionView;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <button
      type="button"
      className="list-row"
      onClick={() => onSelectSelection({ kind: "function", id: fn.id })}
    >
      <div className="list-row__meta">
        <span className="panel__eyebrow">Function</span>
        <span className={`status-chip ${fn.status}`}>{fn.status}</span>
      </div>
      <strong className="list-row__title">{fn.label}</strong>
      <p className="list-row__summary">{fn.intent}</p>
      <div className="inline-pills">
        <span className="status-chip pending">inputs {fn.inputs.length}</span>
        <span className="status-chip converged">outputs {fn.outputs.length}</span>
        <span className="status-chip attention">{fn.backing_graph_function}</span>
      </div>
    </button>
  );
}

function GraphFunctionListRow({
  graphFunction,
  onSelectSelection,
}: {
  graphFunction: GraphFunctionView;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <button
      type="button"
      className="list-row"
      onClick={() => onSelectSelection({ kind: "graph_function", id: graphFunction.id })}
    >
      <div className="list-row__meta">
        <span className="panel__eyebrow">GraphFunction</span>
        <span className={`status-chip ${graphFunction.status}`}>{graphFunction.status}</span>
      </div>
      <strong className="list-row__title">{graphFunction.label}</strong>
      <p className="list-row__summary">{graphFunction.intent}</p>
      <div className="inline-pills">
        <span className="status-chip pending">
          requires {graphFunction.environment.requires.length}
        </span>
        <span className="status-chip converged">
          provides {graphFunction.environment.provides.length}
        </span>
        <span className="status-chip active">
          carries {graphFunction.environment.carries.length}
        </span>
        <span className="status-chip attention">
          vectors {graphFunction.vectors.length}
        </span>
      </div>
    </button>
  );
}

function WorkOrderListRow({
  workorder,
  onSelectSelection,
}: {
  workorder: WorkOrderView;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <button
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
      <div className="inline-pills">
        <span className="status-chip active">{workorder.graph_function_name}</span>
        <span className="status-chip attention">{workorder.id}</span>
      </div>
    </button>
  );
}

function AssetTypeCard({ assetType }: { assetType: AssetTypeProfile }) {
  return (
    <div className="odd-card">
      <span className="panel__eyebrow">{assetType.name}</span>
      <strong>{assetType.description}</strong>
      <p>{assetType.fp_descriptive_framing}</p>
      <div className="inline-pills">
        {assetType.semantic_facets.map((facet) => (
          <span key={facet} className="status-chip pending">
            {facet}
          </span>
        ))}
      </div>
    </div>
  );
}
