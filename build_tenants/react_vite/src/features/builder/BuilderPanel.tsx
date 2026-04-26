import type {
  AssetTypeProfile,
  FunctionView,
  GraphFunctionView,
  ManagerWorld,
  Selection,
  WorkOrderView,
} from "../../lib/types";
import {
  describeCanonicalTerm,
  labelDeliveryStatus,
  presentAmbiguity,
} from "../../lib/presentation";

type BuilderPanelProps = {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function BuilderPanel({ world, onSelectSelection }: BuilderPanelProps) {
  const highlightedTypes = world.domain.asset_types.slice(0, 4);
  const highlightedFamilies = world.domain.asset_families.slice(0, 4);
  const highlightedEdgeContracts = world.domain.edge_contracts.slice(0, 4);
  const highlightedPrograms = world.domain.programs.slice(0, 4);
  const highlightedWorkActs = world.domain.work_act_types.slice(0, 4);
  const highlightedAmbiguities = world.domain.ambiguity_register.ambiguities.slice(0, 4);
  const ambiguitySummary = world.domain.ambiguity_register.summary;

  return (
    <div className="odd-grid odd-grid--three">
      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Workflow Registry</span>
            <h2>Published workflow programs available over the current project map.</h2>
          </div>
          <p>Inspect public workflow programs, required context, and declared transitions.</p>
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
            <span className="panel__eyebrow">Work Items</span>
            <h2>Delivery-facing execution views derived from published jobs.</h2>
          </div>
          <p>Jobs bind to workflow programs; work items expose progress and runtime links.</p>
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
            <span className="panel__eyebrow">Internal Function Catalog</span>
            <h2>Internal functions that explain how the project model is wired.</h2>
          </div>
          <p>These functions explain internal model structure but are not the published execution authority.</p>
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
            <span className="panel__eyebrow">Artifact Types</span>
            <h2>Project artifact types currently visible to the manager.</h2>
          </div>
          <p>Published artifact types remain explicit, even while upstream method details continue to evolve.</p>
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
            <span className="panel__eyebrow">Project Model Contract</span>
            <h2>The read model is versioned and visible as an explicit contract.</h2>
          </div>
          <p>{world.boundary.graph_derivation}</p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">{world.domain.query_contract.name}</span>
            <strong>{world.domain.query_contract.version}</strong>
            <p>{world.domain.query_contract.top_level_keys.length} top-level key(s) published.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Domain Facets</span>
            <strong>{world.domain.semantic_facets.length}</strong>
            <p>Domain semantics remain read-only and query-owned here.</p>
          </div>
        </div>
        <div className="inline-pills">
          {world.domain.query_contract.top_level_keys.map((key) => (
            <span key={key} className="status-chip attention">
              {describeCanonicalTerm(key)}
            </span>
          ))}
        </div>
      </section>

      <section className="panel panel--governance">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Blocker Posture</span>
            <h2>Open decisions and missing capabilities are supervisory truth.</h2>
          </div>
          <p>These are not generic gaps. They describe active blocker policy over the workspace.</p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">Register</span>
            <strong>{world.domain.ambiguity_register.register_kind}</strong>
            <p>{ambiguitySummary.total ?? world.domain.ambiguity_register.ambiguities.length} blocker item(s).</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Active Blockers</span>
            <strong>{ambiguitySummary.blocking ?? 0}</strong>
            <p>Hard-stop or blocking entries currently visible.</p>
          </div>
        </div>
        <div className="list-stack">
          {highlightedAmbiguities.map((entry) => (
            <button
              key={entry.ambiguity_id}
              type="button"
              className="list-row"
              onClick={() => onSelectSelection({ kind: "ambiguity", id: entry.ambiguity_id })}
            >
              <div className="list-row__meta">
                <span className="panel__eyebrow">{presentAmbiguity(entry).classificationLabel}</span>
                <span className={`status-chip ${entry.blocking ? "blocked" : "gated"}`}>
                  {presentAmbiguity(entry).statusLabel}
                </span>
              </div>
              <strong className="list-row__title">{entry.ambiguity_id}</strong>
              <p className="list-row__summary">{presentAmbiguity(entry).summary}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel--context">
        <div className="panel__heading">
          <div>
            <span className="panel__eyebrow">Model Catalog</span>
            <h2>The active workspace model is visible to the manager as a governed catalog.</h2>
          </div>
          <p>These objects define the current delivery lane more explicitly than the earlier first slice.</p>
        </div>
        <div className="odd-card-grid odd-card-grid--two">
          <CatalogCountCard
            eyebrow="Artifact Families"
            value={world.domain.asset_families.length}
            description="Lifecycle-oriented artifact families over project asset types."
          />
          <CatalogCountCard
            eyebrow="Workflow Handoffs"
            value={world.domain.edge_contracts.length}
            description="Configured handoff rules across delivery stages."
          />
          <CatalogCountCard
            eyebrow="Programs"
            value={world.domain.programs.length}
            description="Delivery programs visible from the active project model."
          />
          <CatalogCountCard
            eyebrow="Work Patterns"
            value={world.domain.work_act_types.length}
            description="Declared classes of governed delivery work."
          />
        </div>
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
          {highlightedPrograms.map((program) => (
            <button
              key={program.name}
              type="button"
              className="status-chip attention"
              onClick={() => onSelectSelection({ kind: "program", id: program.name })}
            >
              {program.name}
            </button>
          ))}
          {highlightedWorkActs.map((workAct) => (
            <button
              key={workAct.name}
              type="button"
              className="status-chip converged"
              onClick={() => onSelectSelection({ kind: "work_act_type", id: workAct.name })}
            >
              {workAct.name}
            </button>
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
        <span className="panel__eyebrow">Internal Function</span>
        <span className={`status-chip ${fn.status}`}>{labelDeliveryStatus(fn.status)}</span>
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
        <span className="panel__eyebrow">Workflow Program</span>
        <span className={`status-chip ${graphFunction.status}`}>
          {labelDeliveryStatus(graphFunction.status)}
        </span>
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
        <span className="panel__eyebrow">Work Item</span>
        <span className={`status-chip ${workorder.status}`}>
          {labelDeliveryStatus(workorder.status)}
        </span>
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

function CatalogCountCard({
  eyebrow,
  value,
  description,
}: {
  eyebrow: string;
  value: number;
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
