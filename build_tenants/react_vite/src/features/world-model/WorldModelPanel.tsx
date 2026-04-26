import { describeCanonicalTerm } from "../../lib/presentation";
import type { ManagerWorld, Selection } from "../../lib/types";

type WorldModelPanelProps = {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function WorldModelPanel({ world, onSelectSelection }: WorldModelPanelProps) {
  const highlightedFacets = world.domain.semantic_facets.slice(0, 6);
  const highlightedFamilies = world.domain.asset_families.slice(0, 6);
  const highlightedEdgeContracts = world.domain.edge_contracts.slice(0, 6);
  const firstGraph = world.graph_set.graphs[0] ?? null;

  return (
    <div className="odd-grid odd-grid--three">
      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">odd_world_model</span>
            <h2>Dedicated world-model supervision now has its own page.</h2>
          </div>
          <p>
            This is a placeholder domain page for `odd_world_model`. The shared OddBoard and local
            shell utility sections remain available above, and this page will become the focused
            world-model read surface as dedicated projections are added.
          </p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <MetricCard
            eyebrow="Workspace"
            value={world.workspace_root}
            description="The currently managed workspace that this future world-model lane will read."
          />
          <MetricCard
            eyebrow="Current Domain Contract"
            value={`${world.domain.domain_contract.source_name} ${world.domain.domain_contract.source_version}`}
            description="The active observed contract remains the source of truth until odd_world_model surfaces are published."
          />
        </div>
      </section>

      <section className="panel panel--governance">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Contract Boundary</span>
            <h2>Current read-model boundary stays explicit.</h2>
          </div>
          <p>
            This page does not invent a parallel ontology. It exposes the live contract and the
            nearest currently projected structures while the dedicated `odd_world_model` slice is
            being built out.
          </p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <MetricCard
            eyebrow="Query Contract"
            value={`${world.domain.query_contract.name} ${world.domain.query_contract.version}`}
            description={`${world.domain.query_contract.top_level_keys.length} top-level key(s) are currently published.`}
          />
          <MetricCard
            eyebrow="Compatibility"
            value={describeCanonicalTerm(world.domain.domain_contract.compatibility)}
            description={world.boundary.graph_derivation}
          />
          <MetricCard
            eyebrow="Semantic Facets"
            value={String(world.domain.semantic_facets.length)}
            description="Observed semantic facets already available for future world-model framing."
          />
          <MetricCard
            eyebrow="Projected Families"
            value={String(world.domain.asset_families.length)}
            description="Artifact families currently visible in the read model."
          />
        </div>
        {world.domain.query_contract.top_level_keys.length ? (
          <div className="inline-pills">
            {world.domain.query_contract.top_level_keys.map((key) => (
              <span key={key} className="status-chip attention">
                {describeCanonicalTerm(key)}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel panel--dispatch">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Current Anchors</span>
            <h2>Closest existing structures that a world-model page can already lean on.</h2>
          </div>
          <p>
            Until explicit `odd_world_model` assets exist, these are the most relevant currently
            projected handles into the model.
          </p>
        </div>
        <div className="list-stack">
          {firstGraph ? (
            <button
              type="button"
              className="list-row"
              onClick={() => onSelectSelection({ kind: "graph", id: firstGraph.id })}
            >
              <div className="list-row__meta">
                <span className="panel__eyebrow">Project Map</span>
                <span className="status-chip active">{firstGraph.nodes.length} nodes</span>
              </div>
              <strong className="list-row__title">{firstGraph.label}</strong>
              <p className="list-row__summary">
                The graph remains the current structural anchor for model inspection.
              </p>
            </button>
          ) : null}
          <div className="list-row">
            <div className="list-row__meta">
              <span className="panel__eyebrow">Bindings</span>
              <span className="status-chip converged">{world.domain.bindings.length}</span>
            </div>
            <strong className="list-row__title">Workflow bindings currently projected</strong>
            <p className="list-row__summary">
              Node-to-asset bindings are already available and are natural candidates for future
              world-model navigation.
            </p>
          </div>
          <div className="list-row">
            <div className="list-row__meta">
              <span className="panel__eyebrow">Collections</span>
              <span className="status-chip converged">{world.domain.collections.length}</span>
            </div>
            <strong className="list-row__title">Artifact collections currently projected</strong>
            <p className="list-row__summary">
              Collections provide the nearest grouped read over the workspace until richer
              odd_world_model surfaces exist.
            </p>
          </div>
        </div>
        {highlightedFamilies.length || highlightedEdgeContracts.length ? (
          <div className="inline-pills">
            {highlightedFamilies.map((family) => (
              <button
                key={family.name}
                type="button"
                className="status-chip pending"
                onClick={() => onSelectSelection({ kind: "asset_family", id: family.name })}
              >
                {family.name}
              </button>
            ))}
            {highlightedEdgeContracts.map((contract) => (
              <button
                key={contract.name}
                type="button"
                className="status-chip active"
                onClick={() => onSelectSelection({ kind: "edge_contract", id: contract.name })}
              >
                {contract.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Placeholder Scope</span>
            <h2>What this page is reserving space for next.</h2>
          </div>
          <p>
            The first slice should land only when the underlying workspace publishes explicit
            `odd_world_model` surfaces or projections to inspect here.
          </p>
        </div>
        <div className="list-stack">
          <div className="list-row">
            <div className="list-row__meta">
              <span className="panel__eyebrow">Planned Lane</span>
              <span className="status-chip pending">placeholder</span>
            </div>
            <strong className="list-row__title">Topology and identity surfaces</strong>
            <p className="list-row__summary">
              Reserve this page for explicit world-model topology, identity objects, and lawful
              boundaries once the workspace publishes them.
            </p>
          </div>
          <div className="list-row">
            <div className="list-row__meta">
              <span className="panel__eyebrow">Planned Lane</span>
              <span className="status-chip pending">placeholder</span>
            </div>
            <strong className="list-row__title">Transformation and provenance overlays</strong>
            <p className="list-row__summary">
              This is the future home for transformation lineage, provenance through model
              transitions, and other world-model-specific reads.
            </p>
          </div>
          <div className="list-row">
            <div className="list-row__meta">
              <span className="panel__eyebrow">Semantic Facets</span>
              <span className="status-chip attention">{highlightedFacets.length}</span>
            </div>
            <strong className="list-row__title">Observed semantic facets already available</strong>
            <p className="list-row__summary">
              {highlightedFacets.length
                ? highlightedFacets.map((facet) => facet.name).join(", ")
                : "No semantic facets are projected yet."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  eyebrow,
  value,
  description,
}: {
  eyebrow: string;
  value: string;
  description: string;
}) {
  return (
    <div className="odd-card">
      <span className="panel__eyebrow">{eyebrow}</span>
      <strong>{value}</strong>
      <p>{description}</p>
    </div>
  );
}
