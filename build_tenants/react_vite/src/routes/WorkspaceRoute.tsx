import { useEffect, useState } from "react";
import { MarkdownDocument } from "../components/MarkdownDocument";
import { BuilderPanel } from "../features/builder/BuilderPanel";
import { GraphWorkspace } from "../features/graphs/GraphWorkspace";
import { HomePanel } from "../features/home/HomePanel";
import { InspectorPanel } from "../features/inspector/InspectorPanel";
import { OddBoardWidget } from "../features/oddboard/OddBoardWidget";
import { useOddConsoleState } from "../features/oddboard/useOddConsoleState";
import { OddTermWorkspaceWidget } from "../features/oddterm/OddTermWorkspaceWidget";
import { RuntimePanel } from "../features/runtime/RuntimePanel";
import { loadSurface } from "../lib/api";
import type {
  CommandName,
  GraphNodeView,
  ManagerWorld,
  NavigatorMode,
  PageId,
  Selection,
  SurfaceData,
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

const EVIDENCE_SURFACES = [
  {
    path: "specification/domain/DOMAIN_MODEL.md",
    eyebrow: "Domain",
    title: "Published Domain Model",
    summary: "The manager's canonical projection vocabulary for graphs, assets, and workorders.",
    tone: "converged",
  },
  {
    path: "build_tenants/common/design/ODD_MANAGER_DASHBOARD.md",
    eyebrow: "Design",
    title: "Dashboard Design Law",
    summary: "Shared visual and interaction law the UI carrier must preserve.",
    tone: "active",
  },
  {
    path: "specification/requirements/01-control-plane-boundary.md",
    eyebrow: "Boundary",
    title: "Control-Plane Boundary",
    summary: "ABG runtime truth stays distinct from odd_method query overlays.",
    tone: "pending",
  },
  {
    path: "specification/requirements/03-read-model-and-projection.md",
    eyebrow: "Projection",
    title: "Read Model and Projection",
    summary: "The rules for manager-owned composition over runtime and query sources.",
    tone: "gated",
  },
] as const;

const PROVENANCE_SURFACES = [
  {
    path: "README.md",
    eyebrow: "Project",
    title: "Project Overview",
    summary: "Repo posture and canonical starting points.",
    tone: "converged",
  },
  {
    path: "specification/PRODUCT.md",
    eyebrow: "Product",
    title: "Product Definition",
    summary: "Forward-looking product definition for the manager line.",
    tone: "pending",
  },
  {
    path: "specification/GOALS.md",
    eyebrow: "Goals",
    title: "Current Goals",
    summary: "The active bounded wave of work for the project.",
    tone: "active",
  },
  {
    path: "specification/requirements/09-verification-and-traceability.md",
    eyebrow: "Traceability",
    title: "Verification and Traceability",
    summary: "Evidence expectations and published proof boundaries.",
    tone: "attention",
  },
] as const;

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
  const {
    consoleState,
    loading: collaborationLoading,
    error: collaborationError,
    refreshConsole,
  } = useOddConsoleState(workspaceRoot);
  const [evidencePath, setEvidencePath] = useState<string>(EVIDENCE_SURFACES[0].path);
  const [provenancePath, setProvenancePath] = useState<string>(PROVENANCE_SURFACES[0].path);

  useEffect(() => {
    if (selectedPage === "evidence") {
      setEvidencePath((current) =>
        EVIDENCE_SURFACES.some((surface) => surface.path === current)
          ? current
          : EVIDENCE_SURFACES[0].path,
      );
    }
    if (selectedPage === "provenance") {
      setProvenancePath((current) =>
        PROVENANCE_SURFACES.some((surface) => surface.path === current)
          ? current
          : PROVENANCE_SURFACES[0].path,
      );
    }
  }, [selectedPage]);

  if (loadingWorld && !world) {
    return (
      <main className="route-wrap">
        <section className="panel panel--context">
          <div className="empty-state">
            <strong>Loading manager world.</strong>
            <p>Projecting ABG runtime truth and odd_method domain overlays.</p>
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
            <p>Apply a workspace and refresh the manager projection.</p>
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

  return (
    <main className="route-wrap">
      <OddBoardWidget
        workspaceRoot={workspaceRoot}
        selectedTrainId={selectedScope}
        selectedStationId={selectedGraphScope}
        selectedEdgeId={selectedObjectScope}
        consoleState={consoleState}
        loading={collaborationLoading}
        error={collaborationError}
        onRefreshConsole={refreshConsole}
      />

      <OddTermWorkspaceWidget
        workspaceRoot={workspaceRoot}
        selectedTrainId={selectedScope}
        selectedStationId={selectedGraphScope}
        selectedEdgeId={selectedObjectScope}
        consoleState={consoleState}
        loading={collaborationLoading}
        error={collaborationError}
        onRefreshConsole={refreshConsole}
      />

      {selectedPage === "home" ? (
        <div className="workspace-view">
          <HomePanel world={world} onSelectSelection={onSelectSelection} />
          <InspectorPanel
            world={world}
            selection={selection}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}

      {selectedPage === "graphs" ? (
        <div className="workspace-view">
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
          />
          <InspectorPanel
            world={world}
            selection={selection ?? { kind: "graph", id: selectedGraphId }}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}

      {selectedPage === "runtime" ? (
        <div className="workspace-view">
          <RuntimePanel world={world} onSelectSelection={onSelectSelection} />
          <InspectorPanel
            world={world}
            selection={selection}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}

      {selectedPage === "continuations" ? (
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
      ) : null}

      {selectedPage === "builder" ? (
        <div className="workspace-view">
          <BuilderPanel world={world} onSelectSelection={onSelectSelection} />
          <InspectorPanel
            world={world}
            selection={selection}
            selectedGraphId={selectedGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      ) : null}

      {selectedPage === "evidence" ? (
        <div className="workspace-view">
          <DocumentSurfacePanel
            workspaceRoot={workspaceRoot}
            eyebrow="Evidence Browser"
            heading="Design law and requirement surfaces"
            summary="The manager publishes its own domain and control-plane law inside the repo."
            surfaces={EVIDENCE_SURFACES}
            selectedPath={evidencePath}
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

      {selectedPage === "provenance" ? (
        <div className="workspace-view">
          <div className="odd-grid odd-grid--two">
            <DocumentSurfacePanel
              workspaceRoot={workspaceRoot}
              eyebrow="Published Surfaces"
              heading="Project documents and traceability law"
              summary="Use repo-native surfaces for the forward-looking product and traceability record."
              surfaces={PROVENANCE_SURFACES}
              selectedPath={provenancePath}
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
