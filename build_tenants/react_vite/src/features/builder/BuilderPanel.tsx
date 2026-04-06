import type { AssetTypeProfile, ManagerWorld, Selection } from "../../lib/types";

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
            <span className="panel__eyebrow">Function Catalog</span>
            <h2>Named functions published over the current asset graph.</h2>
          </div>
          <p>These surfaces come from the odd_method query library.</p>
        </div>
        <div className="list-stack">
          {world.domain.workorders.map((workorder) => (
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
