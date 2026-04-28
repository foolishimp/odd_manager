import { useEffect, useMemo, useState } from "react";
import { MarkdownDocument } from "../components/MarkdownDocument";
import { BuilderPanel } from "../features/builder/BuilderPanel";
import { GraphWorkspace } from "../features/graphs/GraphWorkspace";
import { HomePanel } from "../features/home/HomePanel";
import { InspectorPanel } from "../features/inspector/InspectorPanel";
import { OddBoardWidget } from "../features/oddboard/OddBoardWidget";
import { useOddConsoleState } from "../features/oddboard/useOddConsoleState";
import { OddTermWorkspaceWidget } from "../features/oddterm/OddTermWorkspaceWidget";
import { ProcessKanbanWorkspace, ProcessWorkspace } from "../features/process/ProcessWorkspace";
import { RequirementsWorkspace } from "../features/requirements/RequirementsWorkspace";
import { SidecarPanel } from "../features/sidecar/SidecarPanel";
import { RuntimePanel } from "../features/runtime/RuntimePanel";
import { WorldModelPanel } from "../features/world-model/WorldModelPanel";
import { loadSurface } from "../lib/api";
import type {
  AssetView,
  CommandName,
  GraphNodeView,
  ManagerWorld,
  NavigatorMode,
  PageId,
  Selection,
  SurfaceData,
  Tone,
} from "../lib/types";

type WorkspaceRouteProps = {
  workspaceRoot: string;
  world: ManagerWorld | null;
  loadingWorld: boolean;
  selectedPage: PageId;
  selectedGraphId: string;
  onSelectGraph: (graphId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodeView) => void;
  navigatorMode: NavigatorMode;
  onChangeNavigatorMode: (mode: NavigatorMode) => void;
  selection: Selection | null;
  onSelectSelection: (selection: Selection) => void;
  runningCommand: CommandName | null;
  onRefresh: () => void;
  onIterate: () => void;
  onStartAuto: () => void;
};

type OperatorContextRow = {
  label: string;
  summary: string;
  tone: Tone;
  selection: Selection | null;
};

type SelectionOperatorContext = {
  eyebrow: string;
  title: string;
  summary: string;
  tone: Tone;
  nextAction: string;
  cards: Array<{
    eyebrow: string;
    value: string;
    description: string;
    tone: Tone;
  }>;
  governs: OperatorContextRow[];
  blocked: OperatorContextRow[];
};

type DocumentSurfaceCard = {
  path: string;
  eyebrow: string;
  title: string;
  summary: string;
  tone: Tone;
};

const PROVENANCE_SURFACES: DocumentSurfaceCard[] = [
  {
    path: ".ai-workspace/context/project_bootstrap.md",
    eyebrow: "Bootstrap",
    title: "Project Bootstrap",
    summary: "Deterministic workspace orientation built from imported authority and normalization.",
    tone: "converged",
  },
  {
    path: ".ai-workspace/runtime/odd_sdlc-workspace-normalization.json",
    eyebrow: "Normalization",
    title: "Workspace Normalization Report",
    summary: "Deterministic normalization actions, selected tenant root, and active runtime contract.",
    tone: "attention",
  },
  {
    path: "specification/requirements/00-imported-sources.md",
    eyebrow: "Imported Authority",
    title: "Imported Requirement Sources",
    summary: "The imported authority root odd_sdlc uses before mutable product-owned surfaces.",
    tone: "active",
  },
  {
    path: "specification/INTENT.md",
    eyebrow: "Intent",
    title: "Intent Surface",
    summary: "The constitutional purpose boundary for the selected governed project.",
    tone: "converged",
  },
  {
    path: "specification/PRODUCT.md",
    eyebrow: "Product",
    title: "Product Definition",
    summary: "The project-owned product definition that odd_sdlc is governing in this workspace.",
    tone: "pending",
  },
  {
    path: "specification/GOALS.md",
    eyebrow: "Goals",
    title: "Current Goals",
    summary: "The active bounded wave of work carried by the selected workspace.",
    tone: "active",
  },
  {
    path: ".ai-workspace/runtime/odd_sdlc-requirement-closure.json",
    eyebrow: "Closure",
    title: "Requirement Closure Register",
    summary: "Live requirement carry-forward and current code/test closure posture.",
    tone: "attention",
  },
];

const EVIDENCE_ASSET_SURFACE_CONFIG: Array<
  Omit<DocumentSurfaceCard, "path"> & {
    assetTypes: string[];
    preferredSuffixes?: string[];
    fallbackPath?: string;
  }
> = [
  {
    assetTypes: ["requirement_surface"],
    preferredSuffixes: ["specification/requirements/10-generated-bootstrap.md"],
    fallbackPath: "specification/requirements/10-generated-bootstrap.md",
    eyebrow: "Requirements",
    title: "Generated Bootstrap Requirements",
    summary: "The generated live requirement inventory for the selected odd_sdlc workspace.",
    tone: "active",
  },
  {
    assetTypes: ["ambiguity_register_surface"],
    fallbackPath: ".ai-workspace/runtime/odd_sdlc-ambiguity-register.json",
    eyebrow: "Ambiguity",
    title: "Ambiguity Register",
    summary: "Major ambiguity, capability gaps, and governing resolution boundaries.",
    tone: "blocked",
  },
  {
    assetTypes: ["requirement_closure_register_surface"],
    fallbackPath: ".ai-workspace/runtime/odd_sdlc-requirement-closure.json",
    eyebrow: "Closure",
    title: "Requirement Closure Register",
    summary: "Requirement-level implementation, testcase authority, and execution-evidence carry state.",
    tone: "attention",
  },
  {
    assetTypes: ["testcase_authority_surface"],
    preferredSuffixes: ["specification/scenarios/30-generated-testcase-authority.md"],
    fallbackPath: "specification/scenarios/30-generated-testcase-authority.md",
    eyebrow: "Qualification",
    title: "Testcase Authority",
    summary: "The admitted testcase authority that joins UAT, scenarios, and realized spec tests.",
    tone: "converged",
  },
  {
    assetTypes: ["test_run_archive_surface"],
    preferredSuffixes: ["/test_env/50-generated-run-archive.md"],
    eyebrow: "Execution",
    title: "Test Run Archive",
    summary: "Archived realized test execution evidence for the selected workspace.",
    tone: "converged",
  },
  {
    assetTypes: ["release_surface"],
    preferredSuffixes: ["/release/60-generated-release-surface.md"],
    eyebrow: "Release",
    title: "Release Surface",
    summary: "The current release readiness verdict and fulfillment ledger for the selected workspace.",
    tone: "converged",
  },
];

function deriveEvidenceSurfaces(world: ManagerWorld | null): DocumentSurfaceCard[] {
  if (!world) {
    return EVIDENCE_ASSET_SURFACE_CONFIG.flatMap(({ fallbackPath, ...surface }) =>
      fallbackPath ? [{ ...surface, path: fallbackPath }] : [],
    );
  }

  return dedupeSurfaceCards(
    EVIDENCE_ASSET_SURFACE_CONFIG.flatMap(
      ({ assetTypes, preferredSuffixes, fallbackPath, ...surface }) => {
        const path =
          selectWorkspaceAssetPath(world.domain.assets, assetTypes, preferredSuffixes) ?? fallbackPath;
        return path ? [{ ...surface, path }] : [];
      },
    ),
  );
}

function deriveProvenanceSurfaces(): DocumentSurfaceCard[] {
  return PROVENANCE_SURFACES;
}

function selectWorkspaceAssetPath(
  assets: AssetView[],
  assetTypes: string[],
  preferredSuffixes: string[] = [],
): string | null {
  const candidates = assets
    .filter((asset) => assetTypes.includes(asset.declared_type))
    .map(relativePathFromAsset)
    .filter((path): path is string => Boolean(path));

  for (const suffix of preferredSuffixes) {
    const match = candidates.find((path) => path.endsWith(suffix));
    if (match) {
      return match;
    }
  }

  return candidates[0] ?? null;
}

function relativePathFromAsset(asset: AssetView): string | null {
  const uri = asset.uri.trim();
  if (uri.startsWith("file://")) {
    return uri.slice("file://".length).replace(/^\/+/, "");
  }
  if (uri.startsWith("workspace://")) {
    return uri.slice("workspace://".length).replace(/^\/+/, "");
  }
  return null;
}

function dedupeSurfaceCards(items: DocumentSurfaceCard[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.path || seen.has(item.path)) {
      return false;
    }
    seen.add(item.path);
    return true;
  });
}

export function WorkspaceRoute({
  workspaceRoot,
  world,
  loadingWorld,
  selectedPage,
  selectedGraphId,
  onSelectGraph,
  selectedNodeId,
  onSelectNode,
  navigatorMode,
  onChangeNavigatorMode,
  selection,
  onSelectSelection,
  runningCommand,
  onRefresh,
  onIterate,
  onStartAuto,
}: WorkspaceRouteProps) {
  const evidenceSurfaces = useMemo(() => deriveEvidenceSurfaces(world), [world]);
  const provenanceSurfaces = useMemo(() => deriveProvenanceSurfaces(), []);
  const [evidencePath, setEvidencePath] = useState<string>(evidenceSurfaces[0]?.path ?? "");
  const [provenancePath, setProvenancePath] = useState<string>(provenanceSurfaces[0]?.path ?? "");

  useEffect(() => {
    if (selectedPage === "evidence") {
      setEvidencePath((current) =>
        evidenceSurfaces.some((surface) => surface.path === current)
          ? current
          : evidenceSurfaces[0]?.path ?? "",
      );
    }
    if (selectedPage === "provenance") {
      setProvenancePath((current) =>
        provenanceSurfaces.some((surface) => surface.path === current)
          ? current
          : provenanceSurfaces[0]?.path ?? "",
      );
    }
  }, [selectedPage, evidenceSurfaces, provenanceSurfaces]);

  if (loadingWorld && !world) {
    return (
      <main className="route-wrap">
        <section className="panel panel--context">
          <div className="empty-state">
            <strong>Loading manager world.</strong>
            <p>Projecting ABG runtime truth and the selected workspace domain overlays.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!world) {
    return (
      <main className="route-wrap">
        <section className="panel panel--governance">
          <div className="empty-state">
            <strong>No world is available.</strong>
            <p>Open a managed workspace to refresh the manager projection.</p>
          </div>
        </section>
      </main>
    );
  }

  const graphs = world.graph_set.graphs;
  const selectedGraph = graphs.find((graph) => graph.id === selectedGraphId) ?? graphs[0] ?? null;
  const selectedScope = selectedPage;
  const selectedGraphScope = selectedGraph?.label ?? null;
  const selectedObjectScope = selection?.id ?? selectedNodeId ?? null;
  const operatorContext = resolveSelectionOperatorContext(world, selection);
  const showAmbientWorkspaceWidgets = selectedPage !== "sidecar";

  return (
    <main className="route-wrap">
      {showAmbientWorkspaceWidgets ? (
        <AmbientWorkspaceWidgets
          workspaceRoot={workspaceRoot}
          selectedTrainId={selectedScope}
          selectedStationId={selectedGraphScope}
          selectedEdgeId={selectedObjectScope}
        />
      ) : null}

      {selectedPage === "requirements" ? (
        <div className="workspace-stack">
          <RequirementsWorkspace
            world={world}
            selection={selection}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}

      {selectedPage === "process" ? (
        <div className="workspace-stack">
          <ProcessWorkspace
            world={world}
            selection={selection}
            selectedNodeId={selectedNodeId}
            navigatorMode={navigatorMode}
            onChangeNavigatorMode={onChangeNavigatorMode}
            onSelectNode={onSelectNode}
            onSelectSelection={onSelectSelection}
            runningCommand={runningCommand}
            onRefresh={onRefresh}
            onIterate={onIterate}
            onStartAuto={onStartAuto}
          />
        </div>
      ) : null}

      {selectedPage === "kanban" ? (
        <div className="workspace-stack">
          <ProcessKanbanWorkspace
            world={world}
            selection={selection}
            selectedNodeId={selectedNodeId}
            navigatorMode={navigatorMode}
            onChangeNavigatorMode={onChangeNavigatorMode}
            onSelectNode={onSelectNode}
            onSelectSelection={onSelectSelection}
            runningCommand={runningCommand}
            onRefresh={onRefresh}
            onIterate={onIterate}
            onStartAuto={onStartAuto}
          />
        </div>
      ) : null}

      {selectedPage === "world_model" ? (
        <div className="workspace-stack">
          {operatorContext ? (
            <SelectionOperatorPanel
              context={operatorContext}
              onSelectSelection={onSelectSelection}
            />
          ) : null}
          <div className="workspace-view">
            <WorldModelPanel world={world} onSelectSelection={onSelectSelection} />
            <InspectorPanel
              world={world}
              selection={selection}
              selectedGraphId={selectedGraphId}
              onSelectSelection={onSelectSelection}
            />
          </div>
        </div>
      ) : null}

      {selectedPage === "home" ? (
        <div className="workspace-stack">
          {operatorContext ? (
            <SelectionOperatorPanel
              context={operatorContext}
              onSelectSelection={onSelectSelection}
            />
          ) : null}
          <div className="workspace-view">
            <HomePanel world={world} onSelectSelection={onSelectSelection} />
            <InspectorPanel
              world={world}
              selection={selection}
              selectedGraphId={selectedGraphId}
              onSelectSelection={onSelectSelection}
            />
          </div>
        </div>
      ) : null}

      {selectedPage === "graphs" ? (
        <div className="workspace-stack">
          <div className="workspace-view workspace-view--graph-page">
            <GraphWorkspace
              graphs={graphs}
              selectedGraphId={selectedGraphId}
              onSelectGraph={onSelectGraph}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              mode={navigatorMode}
              onChangeMode={onChangeNavigatorMode}
              runningCommand={runningCommand}
              onRefresh={onRefresh}
              onIterate={onIterate}
              onStartAuto={onStartAuto}
              detailPane={
                <div className="graph-detail-stack">
                  {operatorContext ? (
                    <SelectionOperatorPanel
                      context={operatorContext}
                      onSelectSelection={onSelectSelection}
                    />
                  ) : null}
                  <InspectorPanel
                    world={world}
                    selection={selection ?? { kind: "graph", id: selectedGraphId }}
                    selectedGraphId={selectedGraphId}
                    onSelectSelection={onSelectSelection}
                  />
                </div>
              }
            />
          </div>
        </div>
      ) : null}

      {selectedPage === "runtime" ? (
        <div className="workspace-stack">
          {operatorContext ? (
            <SelectionOperatorPanel
              context={operatorContext}
              onSelectSelection={onSelectSelection}
            />
          ) : null}
          <div className="workspace-view">
            <RuntimePanel
              workspaceRoot={workspaceRoot}
              world={world}
              onSelectSelection={onSelectSelection}
            />
            <InspectorPanel
              world={world}
              selection={selection}
              selectedGraphId={selectedGraphId}
              onSelectSelection={onSelectSelection}
            />
          </div>
        </div>
      ) : null}

      {selectedPage === "continuations" ? (
        <div className="workspace-stack">
          {operatorContext ? (
            <SelectionOperatorPanel
              context={operatorContext}
              onSelectSelection={onSelectSelection}
            />
          ) : null}
          <div className="workspace-view">
            <div className="odd-grid odd-grid--two">
              <RuntimeCollectionPanel
                eyebrow="Continuations"
                title="Open ABG continuation aggregates"
                emptyTitle="No open continuations."
                emptySummary="The current runtime projection has no outstanding continuation aggregate."
                items={world.runtime.continuations
                  .filter((continuation) => continuation.status === "open")
                  .map((continuation) => ({
                    id: continuation.instance_id,
                    label: continuation.continuation_kind ?? continuation.instance_id,
                    summary: `${continuation.status} · caused by ${continuation.caused_by_event_id ?? "unknown event"}`,
                    tone: continuation.status === "open" ? "gated" : "converged",
                    selection: { kind: "continuation", id: continuation.instance_id } as const,
                  }))}
                onSelectSelection={onSelectSelection}
              />
              <RuntimeCollectionPanel
                eyebrow="Frames"
                title="Visible recursive frame attempts"
                emptyTitle="No recursive frames."
                emptySummary="Run a published workorder to populate the recursive frame surface."
                items={world.runtime.frames.map((frame) => ({
                  id: frame.instance_id,
                  label: frame.parent_edge ?? frame.instance_id,
                  summary: `${frame.status} · depth ${frame.stack_depth ?? 0}`,
                  tone: frame.suspended ? "gated" : frame.status === "closed" ? "converged" : "active",
                  selection: { kind: "frame", id: frame.instance_id } as const,
                }))}
                onSelectSelection={onSelectSelection}
              />
            </div>
            <InspectorPanel
              world={world}
              selection={selection}
              selectedGraphId={selectedGraphId}
              onSelectSelection={onSelectSelection}
            />
          </div>
        </div>
      ) : null}

      {selectedPage === "builder" ? (
        <div className="workspace-stack">
          {operatorContext ? (
            <SelectionOperatorPanel
              context={operatorContext}
              onSelectSelection={onSelectSelection}
            />
          ) : null}
          <div className="workspace-view">
            <BuilderPanel world={world} onSelectSelection={onSelectSelection} />
            <InspectorPanel
              world={world}
              selection={selection}
              selectedGraphId={selectedGraphId}
              onSelectSelection={onSelectSelection}
            />
          </div>
        </div>
      ) : null}

      {selectedPage === "evidence" ? (
        <div className="workspace-view">
          <DocumentSurfacePanel
            workspaceRoot={workspaceRoot}
            eyebrow="Evidence Browser"
            heading="Qualification and release evidence"
            summary="Inspect the selected workspace's generated requirement, ambiguity, qualification, execution, and release surfaces."
            surfaces={evidenceSurfaces}
            selectedPath={evidencePath || evidenceSurfaces[0]?.path || ""}
            onSelectPath={setEvidencePath}
          />
          <InspectorPanel
            world={world}
            selection={selection}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}

      {selectedPage === "sidecar" ? (
        <div className="workspace-view workspace-view--sidecar">
          <SidecarPanel projectRoot={workspaceRoot} />
        </div>
      ) : null}
      {selectedPage === "provenance" ? (
        <div className="workspace-view">
          <div className="odd-grid odd-grid--two">
            <DocumentSurfacePanel
              workspaceRoot={workspaceRoot}
              eyebrow="Published Surfaces"
              heading="Workspace bootstrap and constitutional surfaces"
              summary="Read the selected workspace from imported authority through mutable product-owned surfaces and closure state."
              surfaces={provenanceSurfaces}
              selectedPath={provenancePath || provenanceSurfaces[0]?.path || ""}
              onSelectPath={setProvenancePath}
            />
            <RuntimeCollectionPanel
              eyebrow="Recent Events"
              title="Latest replay-visible runtime facts"
              emptyTitle="No runtime events yet."
              emptySummary="The current workspace has not produced ABG-native event history yet."
              items={[...world.runtime.recent_events].reverse().map((event) => ({
                id: event.event_id ?? `${event.event_time ?? "event"}-${event.aggregate_id ?? "unknown"}`,
                label: event.event_type ?? "event",
                summary: `${event.aggregate_type ?? "aggregate"} · ${event.event_time ?? "no event time"}`,
                tone: "attention" as const,
                selection: event.event_id ? ({ kind: "event", id: event.event_id } as const) : null,
              }))}
              onSelectSelection={onSelectSelection}
            />
          </div>
          <InspectorPanel
            world={world}
            selection={selection}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}
    </main>
  );
}

function AmbientWorkspaceWidgets({
  workspaceRoot,
  selectedTrainId,
  selectedStationId,
  selectedEdgeId,
}: {
  workspaceRoot: string;
  selectedTrainId: string;
  selectedStationId: string | null;
  selectedEdgeId: string | null;
}) {
  const {
    consoleState,
    loading: collaborationLoading,
    error: collaborationError,
    refreshConsole,
  } = useOddConsoleState(workspaceRoot);

  return (
    <>
      <OddBoardWidget
        workspaceRoot={workspaceRoot}
        selectedTrainId={selectedTrainId}
        selectedStationId={selectedStationId}
        selectedEdgeId={selectedEdgeId}
        consoleState={consoleState}
        loading={collaborationLoading}
        error={collaborationError}
        onRefreshConsole={refreshConsole}
      />

      <OddTermWorkspaceWidget
        workspaceRoot={workspaceRoot}
        selectedTrainId={selectedTrainId}
        selectedStationId={selectedStationId}
        selectedEdgeId={selectedEdgeId}
        consoleState={consoleState}
        loading={collaborationLoading}
        error={collaborationError}
        onRefreshConsole={refreshConsole}
      />
    </>
  );
}

function SelectionOperatorPanel({
  context,
  onSelectSelection,
}: {
  context: SelectionOperatorContext;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <section className="panel panel--governance">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">{context.eyebrow}</span>
          <h2>{context.title}</h2>
        </div>
        <p>{context.summary}</p>
      </div>

      <div className="odd-card-grid odd-card-grid--two">
        {context.cards.map((card) => (
          <div key={card.eyebrow} className="odd-card">
            <div className="list-row__meta">
              <span className="panel__eyebrow">{card.eyebrow}</span>
              <span className={`status-chip ${card.tone}`}>{card.tone}</span>
            </div>
            <strong>{card.value}</strong>
            <p>{card.description}</p>
          </div>
        ))}
      </div>

      <div className="odd-grid odd-grid--two">
        <OperatorContextList
          title="Governed Surface"
          emptyTitle="No governed surfaces derived."
          emptySummary="The current selection does not declare additional governed surfaces here."
          rows={context.governs}
          onSelectSelection={onSelectSelection}
        />
        <OperatorContextList
          title="Blocked Or Waiting"
          emptyTitle="No blocked or waiting surfaces."
          emptySummary="The current selection does not currently project blocked or waiting dependents."
          rows={context.blocked}
          onSelectSelection={onSelectSelection}
        />
      </div>

      <div className="odd-card">
        <span className="panel__eyebrow">Next Lawful Action</span>
        <strong>{context.nextAction}</strong>
      </div>
    </section>
  );
}

function OperatorContextList({
  title,
  emptyTitle,
  emptySummary,
  rows,
  onSelectSelection,
}: {
  title: string;
  emptyTitle: string;
  emptySummary: string;
  rows: OperatorContextRow[];
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <section className="panel panel--context">
      <div className="panel__heading panel__heading--subsection">
        <div>
          <span className="panel__eyebrow">{title}</span>
        </div>
      </div>
      <div className="list-stack">
        {rows.length ? (
          rows.map((row) =>
            row.selection ? (
              <button
                key={`${row.label}:${row.summary}`}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection(row.selection as Selection)}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{title}</span>
                  <span className={`status-chip ${row.tone}`}>{row.tone}</span>
                </div>
                <strong className="list-row__title">{row.label}</strong>
                <p className="list-row__summary">{row.summary}</p>
              </button>
            ) : (
              <div key={`${row.label}:${row.summary}`} className="list-row">
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{title}</span>
                  <span className={`status-chip ${row.tone}`}>{row.tone}</span>
                </div>
                <strong className="list-row__title">{row.label}</strong>
                <p className="list-row__summary">{row.summary}</p>
              </div>
            ),
          )
        ) : (
          <div className="empty-state">
            <strong>{emptyTitle}</strong>
            <p>{emptySummary}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function resolveSelectionOperatorContext(
  world: ManagerWorld,
  selection: Selection | null,
): SelectionOperatorContext | null {
  if (!selection) {
    return null;
  }

  if (selection.kind === "surface") {
    const pathParts = selection.id.split("/");
    const title = pathParts[pathParts.length - 1] || selection.id;
    return {
      eyebrow: "Selected Surface",
      title,
      summary: selection.id,
      tone: "converged",
      nextAction: "Inspect the published surface, then move back to the linked requirement, module, or process-flow object as needed.",
      cards: [
        {
          eyebrow: "Path",
          value: selection.id,
          description: "Workspace-relative path for the selected surface.",
          tone: "converged",
        },
        {
          eyebrow: "Category",
          value: selection.id.startsWith("specification/") ? "Design / Requirements" : "Implementation",
          description: "Heuristic classification for the selected surface.",
          tone: selection.id.startsWith("specification/") ? "pending" : "active",
        },
      ],
      governs: [],
      blocked: [],
    };
  }

  if (selection.kind === "requirement") {
    const requirement = world.domain.requirements.find(
      (item) => item.requirement_id === selection.id,
    );
    if (!requirement) {
      return null;
    }
    const backingAsset = world.domain.assets.find(
      (asset) => (asset.metadata.relative_path ?? "") === requirement.source_path,
    );
    const evidenceCount =
      requirement.code_refs.length +
      requirement.test_refs.length +
      requirement.test_claim_refs.length +
      requirement.testcase_authority_refs.length;
    return {
      eyebrow: "Selected Requirement",
      title: requirement.requirement_id,
      summary: requirement.title,
      tone: requirement.delivery_status,
      nextAction:
        requirement.delivery_status === "converged"
          ? "Keep implementation and acceptance evidence current as the delivery surface changes."
          : requirement.delivery_status === "active"
            ? "Close the remaining evidence gap before treating this backlog item as ready."
            : "Drive this backlog item into implementation, acceptance, and release traceability.",
      cards: [
        {
          eyebrow: "Priority",
          value: requirement.priority ?? "Unspecified",
          description: "Published backlog priority.",
          tone: requirement.priority ? "attention" : "pending",
        },
        {
          eyebrow: "Status",
          value: requirement.status ?? "Unspecified",
          description: "Current requirement posture from published status or closure projection.",
          tone: requirement.delivery_status,
        },
        {
          eyebrow: "Acceptance Criteria",
          value: String(requirement.acceptance_criteria.length),
          description: "Declared acceptance bullets on the backlog item.",
          tone: requirement.acceptance_criteria.length ? "pending" : "attention",
        },
        {
          eyebrow: "Evidence Links",
          value: String(evidenceCount),
          description: "Code and test references attached through the live projection.",
          tone: evidenceCount ? "active" : "attention",
        },
      ],
      governs: [
        ...(backingAsset
          ? [
              {
                label: backingAsset.asset_id,
                summary: requirement.source_path,
                tone: "converged" as Tone,
                selection: { kind: "asset", id: backingAsset.asset_id } as Selection,
              },
            ]
          : []),
        ...requirement.traces_to.map((trace) => ({
          label: trace,
          summary: "Upstream trace target",
          tone: "pending" as Tone,
          selection: null,
        })),
        ...requirement.derives_from.map((item) => ({
          label: item,
          summary: "Governing source surface",
          tone: "attention" as Tone,
          selection: null,
        })),
      ],
      blocked:
        requirement.delivery_status === "converged"
          ? []
          : [
              {
                label: requirement.status ?? "unspecified",
                summary:
                  evidenceCount > 0
                    ? "The backlog item has partial evidence and still needs closure."
                    : "The backlog item is published but not yet backed by enough delivery evidence.",
                tone: requirement.delivery_status,
                selection,
              },
            ],
    };
  }

  if (selection.kind === "asset_family") {
    const family = world.domain.asset_families.find((item) => item.name === selection.id);
    if (!family) {
      return null;
    }
    const relatedAssets = resolveAssetsForFamily(world, family.name);
    const relatedAssetIds = new Set(relatedAssets.map((asset) => asset.asset_id));
    const relatedCollections = world.domain.collections.filter((collection) =>
      collection.assets.some((asset) => relatedAssetIds.has(asset.asset_id)),
    );
    const sourceContracts = world.domain.edge_contracts.filter((contract) =>
      contract.source_asset_families.includes(family.name),
    );
    const targetContracts = world.domain.edge_contracts.filter(
      (contract) => contract.target_asset_family === family.name,
    );
    const relatedWorkActs = world.domain.work_act_types.filter((workAct) =>
      workAct.typical_asset_families.includes(family.name),
    );
    const linkedAmbiguities = resolveAmbiguitiesForAssets(world, relatedAssetIds);
    return {
      eyebrow: "Selected Asset Family",
      title: family.name,
      summary: family.description,
      tone: linkedAmbiguities.length
        ? governanceTone(linkedAmbiguities[0])
        : catalogToneForSelection(family.realization_status),
      nextAction:
        linkedAmbiguities[0]?.next_lawful_action ??
        `Confirm ${family.name} remains the lawful carrier for ${family.lifecycle_role} across current contracts and work acts.`,
      cards: [
        {
          eyebrow: "Lifecycle Role",
          value: family.lifecycle_role,
          description: "Published lifecycle position for this asset family.",
          tone: "attention",
        },
        {
          eyebrow: "Representative Types",
          value: String(family.representative_asset_types.length),
          description: "Builder-declared asset types carried by this family.",
          tone: "pending",
        },
        {
          eyebrow: "Related Assets",
          value: String(relatedAssets.length),
          description: "Current projected assets typed into this family.",
          tone: relatedAssets.length ? "converged" : "attention",
        },
        {
          eyebrow: "Blocking Ambiguities",
          value: String(linkedAmbiguities.length),
          description: "Published ambiguities currently attached to assets in this family.",
          tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "converged",
        },
      ],
      governs: [
        ...relatedCollections.map((collection) => ({
          label: collection.name,
          summary: `${collection.assets.length} published asset(s) in collection`,
          tone: "converged" as Tone,
          selection: { kind: "collection", id: collection.name } as Selection,
        })),
        ...sourceContracts.map((contract) => ({
          label: contract.name,
          summary: "source-side edge contract",
          tone: catalogToneForSelection(contract.realization_status),
          selection: { kind: "edge_contract", id: contract.name } as Selection,
        })),
        ...targetContracts.map((contract) => ({
          label: contract.name,
          summary: "target-side edge contract",
          tone: catalogToneForSelection(contract.realization_status),
          selection: { kind: "edge_contract", id: contract.name } as Selection,
        })),
        ...relatedWorkActs.map((workAct) => ({
          label: workAct.name,
          summary: "work act over this family",
          tone: catalogToneForSelection(workAct.realization_status),
          selection: { kind: "work_act_type", id: workAct.name } as Selection,
        })),
      ],
      blocked: linkedAmbiguities.map((entry) => ({
        label: entry.ambiguity_id,
        summary: entry.operator_headline,
        tone: governanceTone(entry),
        selection: { kind: "ambiguity", id: entry.ambiguity_id } as Selection,
      })),
    };
  }

  if (selection.kind === "collection") {
    const collection = world.domain.collections.find((item) => item.name === selection.id);
    if (!collection) {
      return null;
    }
    const collectionAssetIds = new Set(collection.assets.map((asset) => asset.asset_id));
    const inferredFamilies = world.domain.asset_families.filter((family) =>
      collection.assets.some((asset) => family.representative_asset_types.includes(asset.declared_type)),
    );
    const familyNames = new Set(inferredFamilies.map((family) => family.name));
    const relatedContracts = world.domain.edge_contracts.filter(
      (contract) =>
        contract.source_asset_families.some((family) => familyNames.has(family)) ||
        familyNames.has(contract.target_asset_family),
    );
    const linkedAmbiguities = resolveAmbiguitiesForAssets(world, collectionAssetIds);
    return {
      eyebrow: "Selected Collection",
      title: collection.name,
      summary: "Published query-library asset collection projected from the selected domain contract.",
      tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "converged",
      nextAction:
        linkedAmbiguities[0]?.next_lawful_action ??
        `Use ${collection.name} as the governed collection boundary and confirm downstream family coverage remains explicit.`,
      cards: [
        {
          eyebrow: "Assets",
          value: String(collection.assets.length),
          description: "Published assets currently carried by this collection.",
          tone: collection.assets.length ? "converged" : "attention",
        },
        {
          eyebrow: "Inferred Families",
          value: String(inferredFamilies.length),
          description: "Asset families implied by the collection's published asset types.",
          tone: inferredFamilies.length ? "pending" : "attention",
        },
        {
          eyebrow: "Related Contracts",
          value: String(relatedContracts.length),
          description: "Edge contracts whose family surface overlaps this collection.",
          tone: relatedContracts.length ? "active" : "attention",
        },
        {
          eyebrow: "Blocking Ambiguities",
          value: String(linkedAmbiguities.length),
          description: "Published ambiguities touching assets inside this collection.",
          tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "converged",
        },
      ],
      governs: [
        ...inferredFamilies.map((family) => ({
          label: family.name,
          summary: family.lifecycle_role,
          tone: catalogToneForSelection(family.realization_status),
          selection: { kind: "asset_family", id: family.name } as Selection,
        })),
        ...collection.assets.slice(0, 8).map((asset) => ({
          label: asset.asset_id,
          summary: asset.declared_type,
          tone: asset.metadata.exists === "false" ? ("blocked" as Tone) : ("converged" as Tone),
          selection: { kind: "asset", id: asset.asset_id } as Selection,
        })),
        ...(collection.assets.length > 8
          ? [
              {
                label: `${collection.assets.length - 8} more asset(s)`,
                summary: "Inspect the collection for full membership.",
                tone: "attention" as Tone,
                selection: null,
              },
            ]
          : []),
      ],
      blocked: linkedAmbiguities.map((entry) => ({
        label: entry.ambiguity_id,
        summary: entry.operator_headline,
        tone: governanceTone(entry),
        selection: { kind: "ambiguity", id: entry.ambiguity_id } as Selection,
      })),
    };
  }

  if (selection.kind === "ambiguity") {
    const ambiguity = world.domain.ambiguity_register.ambiguities.find(
      (item) => item.ambiguity_id === selection.id,
    );
    if (!ambiguity) {
      return null;
    }
    const governs: OperatorContextRow[] = [];
    if (ambiguity.expected_resolving_edge) {
      governs.push({
        label: "Governed Edge",
        summary: ambiguity.expected_resolving_edge,
        tone: governanceTone(ambiguity),
        selection: resolveFunctionLikeSelection(world, ambiguity.expected_resolving_edge),
      });
    }
    if (ambiguity.capability_surface) {
      governs.push({
        label: "Capability Surface",
        summary:
          ambiguity.tenant_name != null
            ? `${ambiguity.capability_surface} on tenant ${ambiguity.tenant_name}`
            : ambiguity.capability_surface,
        tone: "attention",
        selection: null,
      });
    }
    for (const assetId of ambiguity.affected_assets) {
      const asset = world.domain.assets.find((item) => item.asset_id === assetId);
      governs.push({
        label: assetId,
        summary: asset ? asset.declared_type : "affected asset",
        tone: asset?.metadata.exists === "false" ? "blocked" : "pending",
        selection: asset ? { kind: "asset", id: assetId } : null,
      });
    }
    return {
      eyebrow: "Selected Ambiguity",
      title: ambiguity.ambiguity_id,
      summary: ambiguity.operator_headline,
      tone: governanceTone(ambiguity),
      nextAction: ambiguity.next_lawful_action,
      cards: [
        {
          eyebrow: "Posture",
          value: ambiguity.governance_posture,
          description: "Current governance classification for this ambiguity.",
          tone: governanceTone(ambiguity),
        },
        {
          eyebrow: "Capability",
          value: ambiguity.capability_surface ?? "none",
          description: "Capability or contract surface implicated by this ambiguity.",
          tone: ambiguity.capability_surface ? "attention" : "converged",
        },
        {
          eyebrow: "Affected Assets",
          value: String(ambiguity.affected_assets.length),
          description: "Published assets directly implicated by the ambiguity.",
          tone: ambiguity.affected_assets.length ? "pending" : "attention",
        },
        {
          eyebrow: "Resolving Edge",
          value: ambiguity.expected_resolving_edge ?? "none",
          description: "Edge expected to reopen once the governing issue is resolved.",
          tone: ambiguity.expected_resolving_edge ? "active" : "attention",
        },
      ],
      governs,
      blocked: [
        {
          label: ambiguity.governance_posture,
          summary: ambiguity.operator_headline,
          tone: governanceTone(ambiguity),
          selection,
        },
      ],
    };
  }

  if (selection.kind === "edge_contract") {
    const contract = world.domain.edge_contracts.find((item) => item.name === selection.id);
    if (!contract) {
      return null;
    }
    const linkedAmbiguities = world.domain.ambiguity_register.ambiguities.filter((entry) =>
      contract.representative_functions.includes(entry.expected_resolving_edge ?? ""),
    );
    const governs: OperatorContextRow[] = [
      ...contract.source_asset_families.map((family) => ({
        label: family,
        summary: "source asset family",
        tone: "pending" as Tone,
        selection: { kind: "asset_family", id: family } as Selection,
      })),
      {
        label: contract.target_asset_family,
        summary: "target asset family",
        tone: "active",
        selection: { kind: "asset_family", id: contract.target_asset_family },
      },
      ...contract.representative_functions.map((fn) => ({
        label: fn,
        summary: "representative function",
        tone: "active" as Tone,
        selection: resolveFunctionLikeSelection(world, fn),
      })),
    ];
    const blocked = linkedAmbiguities.map((entry) => ({
      label: entry.ambiguity_id,
      summary: entry.operator_headline,
      tone: governanceTone(entry),
      selection: { kind: "ambiguity", id: entry.ambiguity_id } as Selection,
    }));
    return {
      eyebrow: "Selected Edge Contract",
      title: contract.name,
      summary: contract.description,
      tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "active",
      nextAction:
        linkedAmbiguities[0]?.next_lawful_action ??
        `Confirm the governed path from ${contract.source_asset_families.join(", ")} to ${contract.target_asset_family} remains admissible.`,
      cards: [
        {
          eyebrow: "Source Families",
          value: String(contract.source_asset_families.length),
          description: "Published source families feeding this contract.",
          tone: "pending",
        },
        {
          eyebrow: "Representative Functions",
          value: String(contract.representative_functions.length),
          description: "Functions or workorders through which the contract is realized.",
          tone: "active",
        },
        {
          eyebrow: "Blocked Ambiguities",
          value: String(linkedAmbiguities.length),
          description: "Published ambiguities currently attached to this contract path.",
          tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "converged",
        },
        {
          eyebrow: "Target Family",
          value: contract.target_asset_family,
          description: "The intended family produced by this contract.",
          tone: "active",
        },
      ],
      governs,
      blocked,
    };
  }

  if (selection.kind === "program") {
    const program = world.domain.programs.find((item) => item.name === selection.id);
    if (!program) {
      return null;
    }
    const linkedAmbiguities = world.domain.ambiguity_register.ambiguities.filter((entry) =>
      program.steps.includes(entry.expected_resolving_edge ?? ""),
    );
    return {
      eyebrow: "Selected Program",
      title: program.name,
      summary: program.intent,
      tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "active",
      nextAction:
        linkedAmbiguities[0]?.next_lawful_action ??
        "Advance the next admissible program step and verify the lane stays governed end to end.",
      cards: [
        {
          eyebrow: "Steps",
          value: String(program.steps.length),
          description: "Published steps in the current executive program.",
          tone: "active",
        },
        {
          eyebrow: "Outputs",
          value: String(program.outputs.length),
          description: "Published outputs expected from the program.",
          tone: program.outputs.length ? "converged" : "attention",
        },
        {
          eyebrow: "Blocked Ambiguities",
          value: String(linkedAmbiguities.length),
          description: "Published ambiguities attached to program steps.",
          tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "converged",
        },
        {
          eyebrow: "Program Kind",
          value: program.kind,
          description: "Published program classification from the selected domain contract.",
          tone: "attention",
        },
      ],
      governs: [
        ...program.steps.map((step) => ({
          label: step,
          summary: "program step",
          tone: "active" as Tone,
          selection: resolveFunctionLikeSelection(world, step),
        })),
        ...program.outputs.map((output) => ({
          label: output,
          summary: "program output",
          tone: "converged" as Tone,
          selection: null,
        })),
      ],
      blocked: linkedAmbiguities.map((entry) => ({
        label: entry.ambiguity_id,
        summary: entry.operator_headline,
        tone: governanceTone(entry),
        selection: { kind: "ambiguity", id: entry.ambiguity_id },
      })),
    };
  }

  if (selection.kind === "work_act_type") {
    const workAct = world.domain.work_act_types.find((item) => item.name === selection.id);
    if (!workAct) {
      return null;
    }
    const relatedFamilies = workAct.typical_asset_families
      .map((familyName) => world.domain.asset_families.find((family) => family.name === familyName) ?? null)
      .filter((family): family is NonNullable<typeof family> => family != null);
    const relatedFamilyNames = new Set(relatedFamilies.map((family) => family.name));
    const relatedContracts = world.domain.edge_contracts.filter(
      (contract) =>
        contract.source_asset_families.some((family) => relatedFamilyNames.has(family)) ||
        relatedFamilyNames.has(contract.target_asset_family),
    );
    const relatedAssetIds = new Set(
      relatedFamilies.flatMap((family) =>
        resolveAssetsForFamily(world, family.name).map((asset) => asset.asset_id),
      ),
    );
    const linkedAmbiguities = [
      ...resolveAmbiguitiesForAssets(world, relatedAssetIds),
      ...world.domain.ambiguity_register.ambiguities.filter((entry) =>
        relatedContracts.some((contract) =>
          contract.representative_functions.includes(entry.expected_resolving_edge ?? ""),
        ),
      ),
    ].filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.ambiguity_id === entry.ambiguity_id) === index,
    );
    return {
      eyebrow: "Selected Work Act Type",
      title: workAct.name,
      summary: workAct.description,
      tone: linkedAmbiguities.length
        ? governanceTone(linkedAmbiguities[0])
        : catalogToneForSelection(workAct.realization_status),
      nextAction:
        linkedAmbiguities[0]?.next_lawful_action ??
        `Confirm ${workAct.name} remains governed across its typical families and evidence obligations.`,
      cards: [
        {
          eyebrow: "Typical Families",
          value: String(relatedFamilies.length),
          description: "Asset families this work act is declared to operate over.",
          tone: relatedFamilies.length ? "pending" : "attention",
        },
        {
          eyebrow: "Mutates Workspace",
          value: workAct.mutates_workspace ? "yes" : "no",
          description: "Whether this act is expected to mutate workspace state.",
          tone: workAct.mutates_workspace ? "attention" : "converged",
        },
        {
          eyebrow: "Governed Evidence",
          value: workAct.produces_governed_evidence ? "yes" : "no",
          description: "Whether this act is expected to produce governed evidence.",
          tone: workAct.produces_governed_evidence ? "active" : "attention",
        },
        {
          eyebrow: "Blocking Ambiguities",
          value: String(linkedAmbiguities.length),
          description: "Published ambiguities attached to the families or contracts this act touches.",
          tone: linkedAmbiguities.length ? governanceTone(linkedAmbiguities[0]) : "converged",
        },
      ],
      governs: [
        ...relatedFamilies.map((family) => ({
          label: family.name,
          summary: family.lifecycle_role,
          tone: catalogToneForSelection(family.realization_status),
          selection: { kind: "asset_family", id: family.name } as Selection,
        })),
        ...relatedContracts.map((contract) => ({
          label: contract.name,
          summary: contract.target_asset_family,
          tone: catalogToneForSelection(contract.realization_status),
          selection: { kind: "edge_contract", id: contract.name } as Selection,
        })),
      ],
      blocked: linkedAmbiguities.map((entry) => ({
        label: entry.ambiguity_id,
        summary: entry.operator_headline,
        tone: governanceTone(entry),
        selection: { kind: "ambiguity", id: entry.ambiguity_id } as Selection,
      })),
    };
  }

  return null;
}

function resolveAssetsForFamily(world: ManagerWorld, familyName: string) {
  const family = world.domain.asset_families.find((item) => item.name === familyName);
  if (!family) {
    return [];
  }
  const representativeTypes = new Set(family.representative_asset_types);
  return world.domain.assets.filter((asset) => representativeTypes.has(asset.declared_type));
}

function resolveAmbiguitiesForAssets(
  world: ManagerWorld,
  assetIds: Iterable<string>,
) {
  const assetIdSet = new Set(assetIds);
  return world.domain.ambiguity_register.ambiguities.filter((entry) =>
    entry.affected_assets.some((assetId) => assetIdSet.has(assetId)),
  );
}

function resolveFunctionLikeSelection(world: ManagerWorld, id: string): Selection | null {
  const fn = world.domain.functions.find((item) => item.id === id);
  if (fn) {
    return { kind: "function", id: fn.id };
  }
  const workorder = world.domain.workorders.find(
    (item) => item.id === id || item.graph_function_name === id,
  );
  if (workorder) {
    return { kind: "workorder", id: workorder.id };
  }
  const graphFunction = world.domain.graph_functions.find(
    (item) => item.id === id || item.name === id,
  );
  if (graphFunction) {
    return { kind: "graph_function", id: graphFunction.id };
  }
  return null;
}

function governanceTone(entry: {
  blocking?: boolean;
  hard_stop?: boolean;
  governance_posture?: string | null;
  policy_action?: string | null;
}): Tone {
  if (entry.blocking || entry.hard_stop || entry.policy_action === "hard_block") {
    return "blocked";
  }
  if (entry.governance_posture?.includes("Human")) {
    return "gated";
  }
  if (entry.governance_posture?.includes("Capability")) {
    return "attention";
  }
  return "active";
}

function catalogToneForSelection(realizationStatus: string | null | undefined): Tone {
  if (realizationStatus === "published") {
    return "converged";
  }
  if (realizationStatus === "prototype") {
    return "active";
  }
  if (realizationStatus === "planned") {
    return "pending";
  }
  return "attention";
}

function DocumentSurfacePanel({
  workspaceRoot,
  eyebrow,
  heading,
  summary,
  surfaces,
  selectedPath,
  onSelectPath,
}: {
  workspaceRoot: string;
  eyebrow: string;
  heading: string;
  summary: string;
  surfaces: ReadonlyArray<{
    path: string;
    eyebrow: string;
    title: string;
    summary: string;
    tone: "converged" | "pending" | "active" | "gated" | "blocked" | "attention";
  }>;
  selectedPath: string;
  onSelectPath: (path: string) => void;
}) {
  const [surface, setSurface] = useState<SurfaceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadSurface(workspaceRoot, selectedPath)
      .then((result) => {
        if (!cancelled) {
          setSurface(result);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
          setSurface(null);
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
  }, [workspaceRoot, selectedPath]);

  return (
    <section className="panel panel--context surface-browser__panel">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">{eyebrow}</span>
          <h2>{heading}</h2>
        </div>
        <p>{summary}</p>
      </div>

      <div className="surface-browser">
        <div className="surface-browser__selector">
          {surfaces.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`surface-card surface-card--context${selectedPath === item.path ? " is-active" : ""}`}
              onClick={() => onSelectPath(item.path)}
            >
              <div className="surface-card__meta">
                <span className="panel__eyebrow">{item.eyebrow}</span>
                <span className={`status-chip ${item.tone}`}>{item.tone}</span>
              </div>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state">
            <strong>Loading surface.</strong>
            <p>{selectedPath}</p>
          </div>
        ) : null}
        {error ? (
          <div className="empty-state">
            <strong>Surface load failed.</strong>
            <p>{error}</p>
          </div>
        ) : null}
        {!loading && !error && surface ? <SurfaceBody surface={surface} /> : null}
      </div>
    </section>
  );
}

function SurfaceBody({ surface }: { surface: SurfaceData }) {
  if (surface.kind === "file") {
    return <MarkdownDocument content={surface.content} />;
  }

  if (surface.kind === "directory") {
    return (
      <div className="list-stack">
        {surface.entries.map((entry) => (
          <div key={entry.relative_path} className="list-row">
            <div className="list-row__meta">
              <span className="panel__eyebrow">{entry.kind}</span>
              <span className="status-chip attention">{entry.kind}</span>
            </div>
            <strong className="list-row__title">{entry.name}</strong>
            <p className="list-row__summary">{entry.relative_path}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="empty-state">
      <strong>Surface not found.</strong>
      <p>{surface.relative_path}</p>
    </div>
  );
}

function RuntimeCollectionPanel({
  eyebrow,
  title,
  emptyTitle,
  emptySummary,
  items,
  onSelectSelection,
}: {
  eyebrow: string;
  title: string;
  emptyTitle: string;
  emptySummary: string;
  items: Array<{
    id: string;
    label: string;
    summary: string;
    tone: "converged" | "pending" | "active" | "gated" | "blocked" | "attention";
    selection: Selection | null;
  }>;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <section className="panel panel--governance">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="list-stack">
        {items.length ? (
          items.map((item) =>
            item.selection ? (
              <button
                key={item.id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection(item.selection as Selection)}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{eyebrow}</span>
                  <span className={`status-chip ${item.tone}`}>{item.tone}</span>
                </div>
                <strong className="list-row__title">{item.label}</strong>
                <p className="list-row__summary">{item.summary}</p>
              </button>
            ) : (
              <div key={item.id} className="list-row">
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{eyebrow}</span>
                  <span className={`status-chip ${item.tone}`}>{item.tone}</span>
                </div>
                <strong className="list-row__title">{item.label}</strong>
                <p className="list-row__summary">{item.summary}</p>
              </div>
            ),
          )
        ) : (
          <div className="empty-state">
            <strong>{emptyTitle}</strong>
            <p>{emptySummary}</p>
          </div>
        )}
      </div>
    </section>
  );
}
