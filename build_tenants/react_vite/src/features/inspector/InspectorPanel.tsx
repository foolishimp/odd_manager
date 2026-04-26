import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { MarkdownDocument } from "../../components/MarkdownDocument";
import { loadSurface } from "../../lib/api";
import { presentStructuredText } from "../../lib/textPresentation";
import type {
  AmbiguityEntryView,
  AssetView,
  AssetFamilyView,
  BindingView,
  CollectionView,
  ContinuationView,
  EdgeContractView,
  FrameView,
  FunctionView,
  GraphFunctionView,
  GraphCallView,
  GraphView,
  ManagerWorld,
  ProgramView,
  RequirementView,
  RecentEventView,
  RuntimeRunView,
  Selection,
  SurfaceData,
  WorkActTypeView,
  WorkOrderView,
} from "../../lib/types";
import {
  describeCanonicalTerm,
  labelDeliveryStatus,
  labelSelectionKind,
  labelTone,
  presentAmbiguity,
} from "../../lib/presentation";

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
            <p>Select a map node, work item, runtime record, or document-backed artifact.</p>
          </div>
        </aside>
      );
  }

  switch (selection.kind) {
    case "requirement":
      return (
        <RequirementInspector
          requirement={
            world.domain.requirements.find((item) => item.requirement_id === selection.id) ?? null
          }
          assets={world.domain.assets}
          onSelectSelection={onSelectSelection}
        />
      );
    case "surface":
      return (
        <SurfaceInspector
          projectRoot={world.project_root}
          relativePath={selection.id}
          onSelectSelection={onSelectSelection}
        />
      );
    case "asset":
      return (
        <AssetInspector
          asset={world.domain.assets.find((item) => item.asset_id === selection.id) ?? null}
          bindings={world.domain.bindings}
          functions={world.domain.functions}
          workorders={world.domain.workorders}
          onSelectSelection={onSelectSelection}
        />
      );
    case "asset_family":
      return (
        <AssetFamilyInspector
          assetFamily={world.domain.asset_families.find((item) => item.name === selection.id) ?? null}
        />
      );
    case "binding":
      return (
        <BindingInspector
          binding={world.domain.bindings.find((item) => item.node === selection.id) ?? null}
          assets={world.domain.assets}
          functions={world.domain.functions}
          workorders={world.domain.workorders}
          onSelectSelection={onSelectSelection}
        />
      );
    case "collection":
      return (
        <CollectionInspector
          collection={world.domain.collections.find((item) => item.name === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
        />
      );
    case "ambiguity":
      return (
        <AmbiguityInspector
          ambiguity={
            world.domain.ambiguity_register.ambiguities.find(
              (item) => item.ambiguity_id === selection.id,
            ) ?? null
          }
          world={world}
          onSelectSelection={onSelectSelection}
        />
      );
    case "edge_contract":
      return (
        <EdgeContractInspector
          edgeContract={world.domain.edge_contracts.find((item) => item.name === selection.id) ?? null}
          world={world}
          onSelectSelection={onSelectSelection}
        />
      );
    case "function":
      return (
        <FunctionInspector
          fn={world.domain.functions.find((item) => item.id === selection.id) ?? null}
          graphFunctions={world.domain.graph_functions}
          onSelectSelection={onSelectSelection}
        />
      );
    case "program":
      return (
        <ProgramInspector
          program={world.domain.programs.find((item) => item.name === selection.id) ?? null}
          world={world}
          onSelectSelection={onSelectSelection}
        />
      );
    case "workorder":
      return (
        <WorkOrderInspector
          workorder={world.domain.workorders.find((item) => item.id === selection.id) ?? null}
          graphFunctions={world.domain.graph_functions}
          onSelectSelection={onSelectSelection}
        />
      );
    case "work_act_type":
      return (
        <WorkActTypeInspector
          workActType={world.domain.work_act_types.find((item) => item.name === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
        />
      );
    case "graph_function":
      return (
        <GraphFunctionInspector
          graphFunction={world.domain.graph_functions.find((item) => item.id === selection.id) ?? null}
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
          onSelectSelection={onSelectSelection}
        />
      );
    case "graph_call":
      return (
        <RuntimeAggregateInspector
          eyebrow="Graph Call"
          title={selection.id}
          description="ABG-native callable boundary aggregate."
          payload={world.runtime.graph_calls.find((item) => item.instance_id === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
        />
      );
    case "continuation":
      return (
        <RuntimeAggregateInspector
          eyebrow="Continuation"
          title={selection.id}
          description="ABG-native continuation aggregate requiring supervision."
          payload={world.runtime.continuations.find((item) => item.instance_id === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
        />
      );
    case "frame":
      return (
        <RuntimeAggregateInspector
          eyebrow="Frame"
          title={selection.id}
          description="ABG-native recursive invocation frame."
          payload={world.runtime.frames.find((item) => item.instance_id === selection.id) ?? null}
          onSelectSelection={onSelectSelection}
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
          graphFunctions={world.domain.graph_functions}
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

function RequirementInspector({
  requirement,
  assets,
  onSelectSelection,
}: {
  requirement: RequirementView | null;
  assets: AssetView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!requirement) {
    return <MissingInspector noun={labelSelectionKind("requirement").toLowerCase()} />;
  }

  const backingAsset = assets.find(
    (asset) => (asset.metadata.relative_path ?? "") === requirement.source_path,
  );

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("requirement")}
        title={requirement.requirement_id}
        subtitle={`${requirement.title} · ${labelDeliveryStatus(requirement.status ?? requirement.delivery_status)}`}
        tone={requirement.delivery_status}
      />

      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Title", requirement.title],
            ["Family", requirement.family_title || requirement.family || "Unspecified"],
            ["Priority", requirement.priority ?? "Unspecified"],
            ["Type", requirement.type ?? "Unspecified"],
            ["Source Path", requirement.source_path],
          ]}
        />

        <InspectorSection title="Requirement Summary">
          <p>{requirement.summary}</p>
        </InspectorSection>

        <InspectorSection title="Traceability">
          <DetailRows
            rows={[
              ["Current Status", labelDeliveryStatus(requirement.status ?? requirement.delivery_status)],
              ["Traces To", requirement.traces_to.length ? requirement.traces_to.join(", ") : "None declared"],
              ["Code References", String(requirement.code_refs.length)],
              ["Test References", String(requirement.test_refs.length)],
              ["Acceptance References", String(requirement.testcase_authority_refs.length)],
            ]}
          />
        </InspectorSection>

        {backingAsset ? (
          <InspectorSection title="Published Artifact">
            <div className="inline-pills">
              <button
                type="button"
                className="status-chip converged"
                onClick={() => onSelectSelection({ kind: "asset", id: backingAsset.asset_id })}
              >
                {backingAsset.asset_id}
              </button>
            </div>
          </InspectorSection>
        ) : null}

        <InspectorSection title="Acceptance Criteria">
          {requirement.acceptance_criteria.length ? (
            <div className="list-stack">
              {requirement.acceptance_criteria.map((criterion, index) => (
                <div key={`${requirement.requirement_id}:${index}`} className="list-row">
                  <strong className="list-row__title">Acceptance {index + 1}</strong>
                  <p className="list-row__summary">{criterion}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No acceptance criteria published.</strong>
              <p>This backlog item does not yet expose explicit acceptance criteria.</p>
            </div>
          )}
        </InspectorSection>

        <InspectorSection title="Evidence Links">
          <ReferencePills
            title="Code"
            items={requirement.code_refs}
            tone="active"
            onSelectSelection={onSelectSelection}
          />
          <ReferencePills
            title="Tests"
            items={[...requirement.test_refs, ...requirement.test_claim_refs, ...requirement.testcase_authority_refs]}
            tone="pending"
            onSelectSelection={onSelectSelection}
          />
          <ReferencePills
            title="Authority"
            items={[
              requirement.source_path,
              ...requirement.derives_from,
              ...requirement.authority_refs,
              ...requirement.current_requirement_refs,
            ]}
            tone="attention"
            onSelectSelection={onSelectSelection}
          />
        </InspectorSection>
      </div>
    </aside>
  );
}

function SurfaceInspector({
  projectRoot,
  relativePath,
  onSelectSelection,
}: {
  projectRoot: string;
  relativePath: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  const [surface, setSurface] = useState<SurfaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadSurface(projectRoot, relativePath)
      .then((result) => {
        if (!cancelled) {
          setSurface(result);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [relativePath, projectRoot]);

  const title = relativePath.split("/").pop() || relativePath;

  if (loading) {
    return (
      <aside className="panel panel--context inspector-panel">
        <div className="empty-state">
          <strong>Loading surface.</strong>
          <p>{relativePath}</p>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="panel panel--context inspector-panel">
        <div className="empty-state">
          <strong>Surface could not be loaded.</strong>
          <p>{error}</p>
        </div>
      </aside>
    );
  }

  if (!surface || surface.kind === "missing") {
    return <MissingInspector noun={labelSelectionKind("surface").toLowerCase()} />;
  }

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("surface")}
        title={title}
        subtitle={relativePath}
        tone="converged"
      />

      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Path", surface.path],
            ["Kind", surface.kind],
          ]}
        />

        {surface.kind === "directory" ? (
          <InspectorSection title="Entries">
            <div className="list-stack">
              {surface.entries.map((entry) => (
                <button
                  key={entry.relative_path}
                  type="button"
                  className="list-row"
                  onClick={() => onSelectSelection({ kind: "surface", id: entry.relative_path })}
                >
                  <div className="list-row__meta">
                    <span className="panel__eyebrow">{entry.kind}</span>
                    <span className={`status-chip ${entry.kind === "directory" ? "active" : "converged"}`}>
                      {entry.kind}
                    </span>
                  </div>
                  <strong className="list-row__title">{entry.name}</strong>
                  <p className="list-row__summary">{entry.relative_path}</p>
                </button>
              ))}
            </div>
          </InspectorSection>
        ) : null}

        {surface.kind === "file" ? (
          <InspectorSection title="Content">
            {surface.relative_path.endsWith(".md") ? (
              <MarkdownDocument content={surface.content} />
            ) : (
              <pre className="markdown-viewer__code-block">{surface.content}</pre>
            )}
          </InspectorSection>
        ) : null}
      </div>
    </aside>
  );
}

function AssetInspector({
  asset,
  bindings,
  functions,
  workorders,
  onSelectSelection,
}: {
  asset: AssetView | null;
  bindings: BindingView[];
  functions: FunctionView[];
  workorders: WorkOrderView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!asset) {
    return <MissingInspector noun={labelSelectionKind("asset").toLowerCase()} />;
  }

  const relatedBindings = bindings.filter((binding) => binding.asset_ids.includes(asset.asset_id));
  const relatedNodeNames = new Set(relatedBindings.map((binding) => binding.node));
  const relatedFunctions = functions.filter(
    (fn) => fn.inputs.some((item) => relatedNodeNames.has(item)) || fn.outputs.some((item) => relatedNodeNames.has(item)),
  );
  const relatedWorkorders = workorders.filter(
    (workorder) =>
      workorder.inputs.some((item) => relatedNodeNames.has(item)) ||
      workorder.outputs.some((item) => relatedNodeNames.has(item)),
  );

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("asset")}
        title={asset.asset_id}
        subtitle={`${describeCanonicalTerm(asset.declared_type)} · ${asset.kind}`}
        tone={asset.metadata.exists === "false" ? "blocked" : "converged"}
      />

      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Artifact URI", asset.uri],
            ["Workspace Path", asset.metadata.relative_path ?? "not published"],
            ["Projection Source", asset.projection_source ?? "unspecified"],
            ["Updates", String(asset.update_count ?? 0)],
            ["Mutable", asset.provenance?.mutable ? "true" : "false"],
          ]}
        />

        <InspectorSection title="Workflow Bindings">
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

        <InspectorSection title="File Snapshot">
          <DetailRows
            rows={[
              ["Exists", String(asset.checkpoint?.exists ?? false)],
              ["Path Kind", asset.checkpoint?.path_kind ?? "unknown"],
              ["Bytes", asset.checkpoint?.bytes != null ? String(asset.checkpoint.bytes) : "unknown"],
              ["Digest", asset.checkpoint?.content_digest ?? "not published"],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Source Trace">
          <DetailRows
            rows={[
              ["Model", asset.provenance?.model ?? "unknown"],
              ["Source", asset.provenance?.source ?? "unknown"],
              ["History Basis", asset.provenance?.history_basis ?? "unknown"],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Related Workflow Steps">
          <div className="inline-pills">
            {relatedFunctions.length ? (
              relatedFunctions.map((fn) => (
                <button
                  key={fn.id}
                  type="button"
                  className={`status-chip ${fn.status}`}
                  onClick={() => onSelectSelection({ kind: "function", id: fn.id })}
                >
                  {fn.label}
                </button>
              ))
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Related Work Items">
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

function AssetFamilyInspector({
  assetFamily,
}: {
  assetFamily: AssetFamilyView | null;
}) {
  if (!assetFamily) {
    return <MissingInspector noun={labelSelectionKind("asset_family").toLowerCase()} />;
  }

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("asset_family")}
        title={assetFamily.name}
        subtitle={assetFamily.description}
        tone={catalogTone(assetFamily.realization_status)}
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Family Role", assetFamily.lifecycle_role],
            ["Realization", assetFamily.realization_status],
            ["Representative Types", String(assetFamily.representative_asset_types.length)],
          ]}
        />
        <InspectorSection title="Representative Artifact Types">
          <div className="inline-pills">
            {assetFamily.representative_asset_types.length ? (
              assetFamily.representative_asset_types.map((assetType) => (
                <span key={assetType} className="status-chip pending">
                  {assetType}
                </span>
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

function CollectionInspector({
  collection,
  onSelectSelection,
}: {
  collection: CollectionView | null;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!collection) {
    return <MissingInspector noun={labelSelectionKind("collection").toLowerCase()} />;
  }

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("collection")}
        title={collection.name}
        subtitle="Published project-model artifact collection."
        tone="attention"
      />
      <div className="inspector-stack">
        <DetailRows rows={[["Artifacts", String(collection.assets.length)]]} />
        <InspectorSection title="Artifacts">
          <div className="inline-pills">
            {collection.assets.length ? (
              collection.assets.map((asset) => (
                <button
                  key={asset.asset_id}
                  type="button"
                  className="status-chip converged"
                  onClick={() => onSelectSelection({ kind: "asset", id: asset.asset_id })}
                >
                  {asset.asset_id}
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

function AmbiguityInspector({
  ambiguity,
  world,
  onSelectSelection,
}: {
  ambiguity: AmbiguityEntryView | null;
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!ambiguity) {
    return <MissingInspector noun={labelSelectionKind("ambiguity").toLowerCase()} />;
  }

  const presented = presentAmbiguity(ambiguity);

  return (
    <aside className="panel panel--governance inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("ambiguity")}
        title={ambiguity.ambiguity_id}
        subtitle={presented.summary}
        tone={domainTone(ambiguity)}
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Type", presented.classificationLabel],
            ["Posture", ambiguity.governance_posture],
            ["Policy Action", ambiguity.policy_action ?? "unknown"],
            ["Status", presented.statusLabel],
            ["Blocking", String(Boolean(ambiguity.blocking))],
            ["Hard Stop", String(Boolean(ambiguity.hard_stop))],
            ["Required Capability", presented.capabilityLabel ?? "none published"],
            ["Risk Appetite", ambiguity.risk_appetite ?? "unknown"],
          ]}
        />

        <InspectorSection title="Recommended Next Step">
          <div className="odd-card">
            <span className="panel__eyebrow">Guidance</span>
            <strong>{ambiguity.next_lawful_action}</strong>
            <p>{presented.summary}</p>
          </div>
        </InspectorSection>

        <InspectorSection title="How To Clear It">
          <DetailRows
            rows={[
              ["Current Resolution", ambiguity.current_resolution || "none published"],
              ["Decision Basis", ambiguity.decision_basis || "none published"],
              [
                "Expected Next Workflow Step",
                describeCanonicalTerm(ambiguity.expected_resolving_edge, "none published"),
              ],
            ]}
          />
          {ambiguity.expected_resolving_edge ? (
            <div className="inline-pills">
              <button
                type="button"
                className="status-chip active"
                  onClick={() =>
                    onSelectSelection(resolveEdgeSelectionForInspector(world, ambiguity.expected_resolving_edge))
                  }
                >
                  open next workflow step
                </button>
              </div>
            ) : null}
        </InspectorSection>

        <InspectorSection title="Competing Readings">
          <div className="list-stack">
            {ambiguity.competing_interpretations.length ? (
              ambiguity.competing_interpretations.map((item) => (
                <div key={item} className="odd-card">
                  <strong>{item}</strong>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>No competing interpretations published.</strong>
                <p>The current ambiguity payload does not carry alternative readings.</p>
              </div>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Affected Artifacts">
          <div className="inline-pills">
            {ambiguity.affected_assets.length ? (
              ambiguity.affected_assets.map((assetId) => {
                const known = world.domain.assets.some((asset) => asset.asset_id === assetId);
                return known ? (
                  <button
                    key={assetId}
                    type="button"
                    className="status-chip pending"
                    onClick={() => onSelectSelection({ kind: "asset", id: assetId })}
                  >
                    {assetId}
                  </button>
                ) : (
                  <span key={assetId} className="status-chip attention">
                    {assetId}
                  </span>
                );
              })
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Evidence and Rules">
          <DetailRows
            rows={[
              ["Decision Owner", ambiguity.decision_owner || "unknown"],
              ["Evidence Refs", ambiguity.evidence_refs.join(", ") || "none"],
              ["Invariant Refs", ambiguity.invariant_refs.join(", ") || "none"],
              ["Decision Events", ambiguity.decision_event_refs.join(", ") || "none"],
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Raw State">
          <DetailRows rows={objectRows(ambiguity.observed_state)} />
        </InspectorSection>
      </div>
    </aside>
  );
}

function EdgeContractInspector({
  edgeContract,
  world,
  onSelectSelection,
}: {
  edgeContract: EdgeContractView | null;
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!edgeContract) {
    return <MissingInspector noun={labelSelectionKind("edge_contract").toLowerCase()} />;
  }

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("edge_contract")}
        title={edgeContract.name}
        subtitle={edgeContract.description}
        tone={catalogTone(edgeContract.realization_status)}
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Target Artifact Family", edgeContract.target_asset_family],
            ["Delivery Role", edgeContract.configured_fp_role],
            ["Output Report", edgeContract.work_report_contract],
            ["Realization", edgeContract.realization_status],
          ]}
        />
        <InspectorSection title="Source Artifact Families">
          <div className="inline-pills">
            {edgeContract.source_asset_families.map((family) => (
              <button
                key={family}
                type="button"
                className="status-chip pending"
                onClick={() => onSelectSelection({ kind: "asset_family", id: family })}
              >
                {family}
              </button>
            ))}
          </div>
        </InspectorSection>
        <InspectorSection title="Deterministic Checks">
          <DetailRows
            rows={[
              ["Preflight", edgeContract.preflight_fd_layers.join(", ") || "none"],
              ["Postflight", edgeContract.postflight_fd_layers.join(", ") || "none"],
            ]}
          />
        </InspectorSection>
        <InspectorSection title="Representative Workflow Steps">
          <div className="inline-pills">
            {edgeContract.representative_functions.length ? (
              edgeContract.representative_functions.map((item) => {
                const selection = resolveFunctionSelection(world, item);
                return selection ? (
                  <button
                    key={item}
                    type="button"
                    className="status-chip active"
                    onClick={() => onSelectSelection(selection)}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={item} className="status-chip attention">
                    {item}
                  </span>
                );
              })
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function ProgramInspector({
  program,
  world,
  onSelectSelection,
}: {
  program: ProgramView | null;
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!program) {
    return <MissingInspector noun="program" />;
  }

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow="Program"
        title={program.name}
        subtitle={program.intent}
        tone="active"
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Kind", program.kind],
            ["Steps", String(program.steps.length)],
            ["Outputs", program.outputs.join(", ") || "none"],
          ]}
        />
        <InspectorSection title="Steps">
          <div className="inline-pills">
            {program.steps.map((step) => {
              const selection = resolveFunctionSelection(world, step);
              return selection ? (
                <button
                  key={step}
                  type="button"
                  className="status-chip active"
                  onClick={() => onSelectSelection(selection)}
                >
                  {step}
                </button>
              ) : (
                <span key={step} className="status-chip attention">
                  {step}
                </span>
              );
            })}
          </div>
        </InspectorSection>
        <InspectorSection title="Outputs">
          <div className="inline-pills">
            {program.outputs.length ? (
              program.outputs.map((output) => (
                <span key={output} className="status-chip converged">
                  {output}
                </span>
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

function WorkActTypeInspector({
  workActType,
  onSelectSelection,
}: {
  workActType: WorkActTypeView | null;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!workActType) {
    return <MissingInspector noun="work act type" />;
  }

  return (
    <aside className="panel panel--context inspector-panel">
      <InspectorHero
        eyebrow="Work Act Type"
        title={workActType.name}
        subtitle={workActType.description}
        tone={catalogTone(workActType.realization_status)}
      />
      <div className="inspector-stack">
        <DetailRows
          rows={[
            ["Mutates Workspace", String(workActType.mutates_workspace)],
            [
              "Produces Governed Evidence",
              String(workActType.produces_governed_evidence),
            ],
            ["Realization", workActType.realization_status],
          ]}
        />
        <InspectorSection title="Typical Asset Families">
          <div className="inline-pills">
            {workActType.typical_asset_families.length ? (
              workActType.typical_asset_families.map((family) => (
                <button
                  key={family}
                  type="button"
                  className="status-chip pending"
                  onClick={() => onSelectSelection({ kind: "asset_family", id: family })}
                >
                  {family}
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
  functions,
  workorders,
  onSelectSelection,
}: {
  binding: BindingView | null;
  assets: AssetView[];
  functions: FunctionView[];
  workorders: WorkOrderView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!binding) {
    return <MissingInspector noun="binding" />;
  }

  const relatedFunctions = functions.filter(
    (fn) => fn.inputs.includes(binding.node) || fn.outputs.includes(binding.node),
  );
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

        <InspectorSection title="Connected Functions">
          <div className="inline-pills">
            {relatedFunctions.length ? (
              relatedFunctions.map((fn) => (
                <button
                  key={fn.id}
                  type="button"
                  className={`status-chip ${fn.status}`}
                  onClick={() => onSelectSelection({ kind: "function", id: fn.id })}
                >
                  {fn.label}
                </button>
              ))
            ) : (
              <span className="status-chip attention">no descriptive functions</span>
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

function FunctionInspector({
  fn,
  graphFunctions,
  onSelectSelection,
}: {
  fn: FunctionView | null;
  graphFunctions: GraphFunctionView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!fn) {
    return <MissingInspector noun="function" />;
  }

  const publishedGraphFunction =
    graphFunctions.find((item) => item.id === fn.published_graph_function_id) ?? null;

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow="Function"
        title={fn.label}
        subtitle={fn.backing_graph_function}
        tone={fn.status}
      />

      <div className="inspector-stack">
        <p>{fn.intent}</p>

        <InspectorSection title="Backing GraphFunction">
          {publishedGraphFunction ? (
            <div className="inline-pills">
              <button
                type="button"
                className="status-chip active"
                onClick={() => onSelectSelection({ kind: "graph_function", id: publishedGraphFunction.id })}
              >
                {publishedGraphFunction.label}
              </button>
              <span className="status-chip attention">{publishedGraphFunction.id}</span>
            </div>
          ) : (
            <DetailRows rows={[["Carrier Name", fn.backing_graph_function]]} />
          )}
        </InspectorSection>

        <InspectorSection title="Inputs">
          <div className="inline-pills">
            {fn.inputs.map((input) => (
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
            {fn.outputs.map((output) => (
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
          {fn.gap ? (
            <DetailRows
              rows={[
                ["Edge", fn.gap.edge],
                ["Delta", fn.gap.delta.toFixed(2)],
                ["Summary", fn.gap.delta_summary],
                ["Failing", fn.gap.failing.join(", ") || "none"],
                ["Passing", fn.gap.passing.join(", ") || "none"],
              ]}
            />
          ) : (
            <div className="empty-state">
              <strong>No active gap overlay.</strong>
              <p>The current function is converged from the query-library perspective.</p>
            </div>
          )}
        </InspectorSection>

        <InspectorSection title="Runtime Links">
          <div className="inline-pills">
            {fn.run_ids.map((runId) => (
              <button
                key={runId}
                type="button"
                className="status-chip active"
                onClick={() => onSelectSelection({ kind: "run", id: runId })}
              >
                run:{runId}
              </button>
            ))}
            {fn.call_ids.map((callId) => (
              <button
                key={callId}
                type="button"
                className="status-chip pending"
                onClick={() => onSelectSelection({ kind: "graph_call", id: callId })}
              >
                call:{callId}
              </button>
            ))}
            {fn.open_continuation_ids.map((continuationId) => (
              <button
                key={continuationId}
                type="button"
                className="status-chip gated"
                onClick={() => onSelectSelection({ kind: "continuation", id: continuationId })}
              >
                continuation:{continuationId}
              </button>
            ))}
            {!fn.run_ids.length && !fn.call_ids.length && !fn.open_continuation_ids.length ? (
              <span className="status-chip attention">no runtime aggregates</span>
            ) : null}
          </div>
        </InspectorSection>
      </div>
    </aside>
  );
}

function WorkOrderInspector({
  workorder,
  graphFunctions,
  onSelectSelection,
}: {
  workorder: WorkOrderView | null;
  graphFunctions: GraphFunctionView[];
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!workorder) {
    return <MissingInspector noun="workorder" />;
  }

  const graphFunction =
    graphFunctions.find((item) => item.id === workorder.graph_function_id) ?? null;

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow="WorkOrder"
        title={workorder.label}
        subtitle={workorder.graph_function_name}
        tone={workorder.status}
      />

      <div className="inspector-stack">
        <p>{workorder.intent}</p>

        <InspectorSection title="Public Carrier">
          {graphFunction ? (
            <div className="inline-pills">
              <button
                type="button"
                className="status-chip active"
                onClick={() => onSelectSelection({ kind: "graph_function", id: graphFunction.id })}
              >
                {graphFunction.label}
              </button>
              <span className="status-chip attention">{graphFunction.id}</span>
            </div>
          ) : (
            <DetailRows rows={[["Graph Function Id", workorder.graph_function_id]]} />
          )}
        </InspectorSection>

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

function GraphFunctionInspector({
  graphFunction,
  onSelectSelection,
}: {
  graphFunction: GraphFunctionView | null;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!graphFunction) {
    return <MissingInspector noun="graph function" />;
  }

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow="GraphFunction"
        title={graphFunction.label}
        subtitle={graphFunction.function_kind ?? graphFunction.name}
        tone={graphFunction.status}
      />

      <div className="inspector-stack">
        <p>{graphFunction.intent}</p>

        <DetailRows
          rows={[
            ["Graph Function Id", graphFunction.id],
            ["Jobs", graphFunction.job_names.join(", ") || "none"],
            ["Carrier Name", graphFunction.name],
            ["WorkOrders", graphFunction.workorder_ids.join(", ") || "none"],
          ]}
        />

        <InspectorSection title="Environment Requires">
          <div className="inline-pills">
            {graphFunction.environment.requires.length ? (
              graphFunction.environment.requires.map((item) => (
                <span key={item} className="status-chip pending">
                  {item}
                </span>
              ))
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Environment Provides">
          <div className="inline-pills">
            {graphFunction.environment.provides.length ? (
              graphFunction.environment.provides.map((item) => (
                <span key={item} className="status-chip converged">
                  {item}
                </span>
              ))
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Environment Carries">
          <div className="inline-pills">
            {graphFunction.environment.carries.length ? (
              graphFunction.environment.carries.map((item) => (
                <span key={item} className="status-chip active">
                  {item}
                </span>
              ))
            ) : (
              <span className="status-chip attention">none</span>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Realized Vectors">
          <div className="list-stack">
            {graphFunction.vectors.length ? (
              graphFunction.vectors.map((vector) => (
                <div key={vector.name} className="odd-card">
                  <span className="panel__eyebrow">{vector.name}</span>
                  <strong>{`${vector.source.join(" + ")} -> ${vector.target}`}</strong>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <strong>No vectors published.</strong>
                <p>The current carrier has no realized vectors in the current registry payload.</p>
              </div>
            )}
          </div>
        </InspectorSection>

        <InspectorSection title="Manager WorkOrders">
          <div className="inline-pills">
            {graphFunction.workorder_ids.length ? (
              graphFunction.workorder_ids.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="status-chip active"
                  onClick={() => onSelectSelection({ kind: "workorder", id: item })}
                >
                  {item}
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

function RuntimeAggregateInspector({
  eyebrow,
  title,
  description,
  payload,
  onSelectSelection,
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
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!payload) {
    return <MissingInspector noun={eyebrow.toLowerCase()} />;
  }

  const tone = runtimeTone("status" in payload ? payload.status : null);
  const rows = runtimeRows(payload);
  const links = runtimeSelections(payload);
  const childSteps =
    "child_steps" in payload && Array.isArray(payload.child_steps) ? payload.child_steps : null;

  return (
    <aside className="panel panel--governance inspector-panel">
      <InspectorHero eyebrow={eyebrow} title={title} subtitle={description} tone={tone} />
      <div className="inspector-stack">
        <DetailRows rows={rows} />
        {links.length ? (
          <InspectorSection title="Runtime Links">
            <div className="inline-pills">
              {links.map((link) => (
                <button
                  key={`${link.selection.kind}:${link.selection.id}`}
                  type="button"
                  className={`status-chip ${link.tone}`}
                  onClick={() => onSelectSelection(link.selection)}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </InspectorSection>
        ) : null}
        {childSteps ? (
          <InspectorSection title="Child Steps">
            <div className="list-stack">
              {childSteps.length ? (
                childSteps.map((step) => (
                  <div key={`${step.child_key}:${step.edge}`} className="odd-card">
                    <span className="panel__eyebrow">{step.status}</span>
                    <strong>{step.edge}</strong>
                    <p>{step.target}</p>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <strong>No child steps.</strong>
                  <p>The current frame does not carry published child frontier steps.</p>
                </div>
              )}
            </div>
          </InspectorSection>
        ) : null}
      </div>
    </aside>
  );
}

function domainTone(payload: Record<string, unknown>): "blocked" | "gated" | "active" | "attention" {
  if (payload.blocking === true || payload.hard_stop === true) {
    return "blocked";
  }
  if (payload.policy_action === "escalate_fh") {
    return "gated";
  }
  if (payload.decision_status === "pending_capability") {
    return "attention";
  }
  const realizationStatus = payload.realization_status;
  if (typeof realizationStatus === "string" && realizationStatus.includes("active")) {
    return "active";
  }
  return "attention";
}

function catalogTone(realizationStatus: string): "active" | "attention" {
  return realizationStatus.includes("active") ? "active" : "attention";
}

function runtimeRows(
  payload: RuntimeRunView | GraphCallView | ContinuationView | FrameView | Record<string, unknown>,
): Array<[string, string]> {
  const baseRows = objectRows(payload);
  const preferred = [
    "status",
    "edge",
    "graph_function_id",
    "continuation_kind",
    "parent_edge",
    "job_id",
    "run_id",
    "call_id",
    "frame_attempt_id",
    "materialization_id",
    "worker_id",
    "selected_worker_id",
    "selected_backend",
    "role_id",
    "failure_class",
    "attempt_number",
    "event_count",
    "stack_depth",
    "checkpoint_id",
  ];
  const preferredRows: Array<[string, string]> = [];
  for (const key of preferred) {
    if (!(key in payload)) {
      continue;
    }
    const value = (payload as Record<string, unknown>)[key];
    if (value == null || value === "") {
      continue;
    }
    preferredRows.push([humanizeKey(key), valueToString(value)]);
  }
  return preferredRows.length ? preferredRows : baseRows;
}

function runtimeSelections(
  payload: RuntimeRunView | GraphCallView | ContinuationView | FrameView | Record<string, unknown>,
) {
  const links: Array<{
    label: string;
    tone: "active" | "pending" | "gated";
    selection: Selection;
  }> = [];
  const runId = stringField(payload, "run_id");
  if (runId) {
    links.push({ label: `run:${runId}`, tone: "active", selection: { kind: "run", id: runId } });
  }
  const callId = stringField(payload, "call_id");
  if (callId) {
    links.push({
      label: `call:${callId}`,
      tone: "pending",
      selection: { kind: "graph_call", id: callId },
    });
  }
  const continuationId = stringField(payload, "continuation_id");
  if (continuationId) {
    links.push({
      label: `continuation:${continuationId}`,
      tone: "gated",
      selection: { kind: "continuation", id: continuationId },
    });
  }
  const frameId = stringField(payload, "frame_attempt_id");
  if (frameId) {
    links.push({
      label: `frame:${frameId}`,
      tone: "pending",
      selection: { kind: "frame", id: frameId },
    });
  }
  return links;
}

function objectRows(payload: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!payload) {
    return [["State", "none"]];
  }
  const rows = Object.entries(payload)
    .slice(0, 8)
    .map(([key, value]) => [key, valueToString(value)] as [string, string]);
  return rows.length ? rows : [["State", "none"]];
}

function valueToString(value: unknown): string {
  if (value == null) {
    return "none";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.some((item) => typeof item === "object" && item !== null)) {
      return JSON.stringify(value, null, 2);
    }
    return value.map((item) => valueToString(item)).join(", ") || "none";
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value ? value : null;
}

function humanizeKey(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveFunctionSelection(world: ManagerWorld, id: string): Selection | null {
  const fn = world.domain.functions.find((item) => item.id === id);
  if (fn) {
    return { kind: "function", id: fn.id };
  }
  const graphFunction = world.domain.graph_functions.find(
    (item) => item.id === id || item.name === id,
  );
  if (graphFunction) {
    return { kind: "graph_function", id: graphFunction.id };
  }
  const workorder = world.domain.workorders.find(
    (item) => item.id === id || item.graph_function_name === id,
  );
  if (workorder) {
    return { kind: "workorder", id: workorder.id };
  }
  return null;
}

function resolveEdgeSelectionForInspector(world: ManagerWorld, edge: string): Selection {
  return (
    resolveFunctionSelection(world, edge) ?? {
      kind: "graph",
      id: world.graph_set.graphs[0]?.id ?? "graph.bootstrap",
    }
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
  graphFunctions,
  selectedGraphId,
  onSelectSelection,
}: {
  graph: GraphView | null;
  graphFunctions: GraphFunctionView[];
  selectedGraphId: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!graph) {
    return <MissingInspector noun={labelSelectionKind("graph").toLowerCase()} />;
  }

  return (
    <aside className="panel panel--dispatch inspector-panel">
      <InspectorHero
        eyebrow={labelSelectionKind("graph")}
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
              "Functions",
              String(graph.nodes.filter((node) => node.kind === "function").length),
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

        <InspectorSection title="Published Workflow Programs">
          <div className="inline-pills">
            {graphFunctions.length ? (
              graphFunctions.map((graphFunction) => (
                <button
                  key={graphFunction.id}
                  type="button"
                  className={`status-chip ${graphFunction.status}`}
                  onClick={() => onSelectSelection({ kind: "graph_function", id: graphFunction.id })}
                >
                  {graphFunction.label}
                </button>
              ))
            ) : (
              <span className="status-chip attention">no registry entries</span>
            )}
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
      <span className={`status-chip ${tone}`}>{labelTone(tone)}</span>
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
      {rows.map(([label, value]) => {
        const presentation = presentStructuredText(value);
        return (
          <div key={label} className="detail-rows__item">
            <span>{label}</span>
            {presentation.kind === "plain" ? (
              <strong>{presentation.text}</strong>
            ) : (
              <div className="detail-rows__formatted">
                <MarkdownDocument content={presentation.content} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReferencePills({
  title,
  items,
  tone,
  onSelectSelection,
}: {
  title: string;
  items: string[];
  tone: "converged" | "pending" | "active" | "gated" | "blocked" | "attention";
  onSelectSelection?: (selection: Selection) => void;
}) {
  const uniqueItems = [...new Set(items.filter((item) => item.trim().length > 0))];
  return (
    <div>
      <span className="panel__eyebrow">{title}</span>
      <div className="inline-pills">
        {uniqueItems.length ? (
          uniqueItems.slice(0, 10).map((item) =>
            onSelectSelection ? (
              <button
                key={`${title}:${item}`}
                type="button"
                className={`status-chip ${tone}`}
                onClick={() => onSelectSelection({ kind: "surface", id: item })}
              >
                {item}
              </button>
            ) : (
              <span key={`${title}:${item}`} className={`status-chip ${tone}`}>
                {item}
              </span>
            ),
          )
        ) : (
          <span className="status-chip attention">none</span>
        )}
      </div>
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
  kind:
    | "requirement"
    | "surface"
    | "asset"
    | "asset_family"
    | "binding"
    | "collection"
    | "ambiguity"
    | "edge_contract"
    | "function"
    | "program"
    | "work_act_type"
    | "workorder",
  id: string,
): Selection {
  return { kind, id };
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
