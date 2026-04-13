import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, WheelEvent as ReactWheelEvent } from "react";
import { buildGraphLayout, combineTone } from "../../lib/graph";
import type { CommandName, GraphNodeView, GraphView, NavigatorMode } from "../../lib/types";

type GraphWorkspaceProps = {
  graphs: GraphView[];
  selectedGraphId: string;
  onSelectGraph: (graphId: string) => void;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodeView) => void;
  mode: NavigatorMode;
  onChangeMode: (mode: NavigatorMode) => void;
  runningCommand: CommandName | null;
  onRefresh: () => void;
  onIterate: () => void;
  onStartAuto: () => void;
  detailPane?: ReactNode;
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.7;
const ZOOM_STEP = 0.15;
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 80;
const RAIL_ROWS = 2;

type Viewport = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ZoomAnchor = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
};

type GraphOverview = {
  eyebrow: string;
  title: string;
  summary: string;
  cards: Array<{
    eyebrow: string;
    value: string;
    description: string;
    tone: GraphNodeView["status"];
  }>;
  focusTitle: string;
  focusEmptyTitle: string;
  focusEmptySummary: string;
  focusRows: Array<{
    nodeId: string;
    label: string;
    summary: string;
    tone: GraphNodeView["status"];
  }>;
};

function clamp(value: number, lower: number, upper: number) {
  return Math.min(Math.max(value, lower), upper);
}

function isMacPlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

function connectorTone(left: GraphNodeView["status"], right: GraphNodeView["status"]) {
  return combineTone(left, right);
}

function describeGraph(graph: GraphView): GraphOverview {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const byRefKind = (kind: GraphNodeView["ref_kind"]) =>
    graph.nodes.filter((node) => node.ref_kind === kind);

  if (graph.id === "graph.requirement_traceability") {
    const requirementNodes = byRefKind("requirement");
    const surfaceNodes = byRefKind("surface");
    const moduleNodes = surfaceNodes.filter((node) => node.subtitle === "module");
    const designNodes = surfaceNodes.filter(
      (node) =>
        node.description === "Design Surface" || node.description === "Requirement Surface",
    );
    const implementationNodes = surfaceNodes.filter(
      (node) =>
        node.description === "Code Surface" ||
        node.description === "Test Surface" ||
        node.description === "Acceptance Surface",
    );
    const focusRows = requirementNodes.slice(0, 8).map((node) => {
      const targets = graph.segments
        .filter((segment) => segment.from === node.id)
        .map((segment) => nodesById.get(segment.to)?.label ?? segment.to);
      return {
        nodeId: node.id,
        label: `${node.label} · ${node.description}`,
        summary: targets.length
          ? `Traces into ${targets.join(", ")}`
          : "No downstream design or implementation surfaces are linked yet.",
        tone: node.status,
      };
    });
    return {
      eyebrow: "Dependency Map",
      title: "Requirements linked to design sources, modules, and implementation surfaces.",
      summary:
        "This map is the requirement dependency lane: backlog items first, then the design material they derive from, the modules expected to carry them, and the code or test surfaces that realize them.",
      cards: [
        {
          eyebrow: "Requirements",
          value: String(requirementNodes.length),
          description: "Backlog items projected as first-class supervisory objects.",
          tone: requirementNodes.length ? combineTone(...requirementNodes.map((node) => node.status)) : "attention",
        },
        {
          eyebrow: "Design Surfaces",
          value: String(designNodes.length),
          description: "Intent, product, requirement, and other governing design documents linked from the backlog.",
          tone: designNodes.length ? "converged" : "attention",
        },
        {
          eyebrow: "Modules",
          value: String(moduleNodes.length),
          description: "Implementation areas or packages carrying requirement realization.",
          tone: moduleNodes.length ? "active" : "attention",
        },
        {
          eyebrow: "Implementation Surfaces",
          value: String(implementationNodes.length),
          description: "Code, acceptance, and test surfaces linked beneath the requirement dependency chain.",
          tone: implementationNodes.length ? "active" : "attention",
        },
      ],
      focusTitle: "Priority Requirements",
      focusEmptyTitle: "No backlog traceability is projected yet.",
      focusEmptySummary: "The current workspace did not expose a requirement dependency lane.",
      focusRows,
    };
  }

  if (graph.id === "graph.builder_governance") {
    const ambiguityNodes = byRefKind("ambiguity");
    const edgeContractNodes = byRefKind("edge_contract");
    const programNodes = byRefKind("program");
    const workActNodes = byRefKind("work_act_type");
    const blockingAmbiguities = ambiguityNodes.filter((node) => node.status === "blocked");
    const focusRows = ambiguityNodes.slice(0, 6).map((node) => {
      const targets = graph.segments
        .filter((segment) => segment.from === node.id)
        .map((segment) => nodesById.get(segment.to)?.label ?? segment.to);
      return {
        nodeId: node.id,
        label: node.label,
        summary: targets.length
          ? `${node.description} Next: ${targets.join(", ")}`
          : `${node.description} No resolving edge projected.`,
        tone: node.status,
      };
    });
    return {
      eyebrow: "Delivery Map",
      title: "Workflow handoffs, blockers, and capability gates over the active delivery lane.",
      summary:
        "This map is project-model supervisory truth: artifact families, workflow handoffs, programs, work patterns, and blockers linked to the artifacts they affect and the steps expected to clear them.",
      cards: [
        {
          eyebrow: "Blockers",
          value: String(ambiguityNodes.length),
          description: "Published blocker-register entries projected into the lane.",
          tone: ambiguityNodes.length ? combineTone(...ambiguityNodes.map((node) => node.status)) : "attention",
        },
        {
          eyebrow: "Blocked",
          value: String(blockingAmbiguities.length),
          description: "Entries currently hard-blocking or fail-closing progress.",
          tone: blockingAmbiguities.length ? "blocked" : "converged",
        },
        {
          eyebrow: "Workflow Handoffs",
          value: String(edgeContractNodes.length),
          description: "Configured handoff rules currently visible from odd_method.",
          tone: edgeContractNodes.length ? "active" : "attention",
        },
        {
          eyebrow: "Programs / Work Patterns",
          value: `${programNodes.length} / ${workActNodes.length}`,
          description: "Delivery programs and declared work patterns in the active project model.",
          tone: programNodes.length || workActNodes.length ? "active" : "attention",
        },
      ],
      focusTitle: "Blockers",
      focusEmptyTitle: "No blocker paths projected.",
      focusEmptySummary: "The current delivery map does not carry blocker-to-step links.",
      focusRows,
    };
  }

  const assetNodes = graph.nodes.filter((node) => node.kind === "asset_node");
  const functionNodes = graph.nodes.filter((node) => node.kind === "function");
  const blockedNodes = graph.nodes.filter((node) => node.status === "blocked");
  const activeNodes = graph.nodes.filter((node) => node.status === "active" || node.status === "gated");
  const focusRows = [...blockedNodes, ...activeNodes.filter((node) => node.status !== "blocked")]
    .slice(0, 6)
    .map((node) => ({
      nodeId: node.id,
      label: node.label,
      summary: node.description,
      tone: node.status,
    }));

  return {
    eyebrow: "Process Flow",
    title: "Project artifacts and workflow steps over the current workspace.",
    summary:
      "This is the fundamental process-flow view: artifacts, explicit bindings, and workflow steps over the current workspace.",
    cards: [
      {
        eyebrow: "Artifacts",
        value: String(assetNodes.length),
        description: "Typed artifact nodes currently projected into the workspace map.",
        tone: assetNodes.length ? "converged" : "attention",
      },
      {
        eyebrow: "Workflow Steps",
        value: String(functionNodes.length),
        description: "Descriptive workflow steps visible from the current read model.",
        tone: functionNodes.length ? "active" : "attention",
      },
      {
        eyebrow: "Blocked",
        value: String(blockedNodes.length),
        description: "Nodes currently blocked by missing artifacts, hard stops, or fail-closed posture.",
        tone: blockedNodes.length ? "blocked" : "converged",
      },
      {
        eyebrow: "Links",
        value: String(graph.segments.length),
        description: "Projected links connecting artifact nodes and workflow steps.",
        tone: graph.segments.length ? "pending" : "attention",
      },
    ],
    focusTitle: "Current Focus",
    focusEmptyTitle: "No high-signal nodes selected yet.",
    focusEmptySummary: "Blocked or active project nodes will surface here as the delivery lane changes.",
    focusRows,
  };
}

export function GraphWorkspace({
  graphs,
  selectedGraphId,
  onSelectGraph,
  selectedNodeId,
  onSelectNode,
  mode,
  onChangeMode,
  runningCommand,
  onRefresh,
  onIterate,
  onStartAuto,
  detailPane,
}: GraphWorkspaceProps) {
  const graph = graphs.find((item) => item.id === selectedGraphId) ?? graphs[0] ?? null;
  const overview = useMemo(() => (graph ? describeGraph(graph) : null), [graph]);
  const selectedNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  );
  const [detailExpanded, setDetailExpanded] = useState(true);

  useEffect(() => {
    if (selectedNodeId) {
      setDetailExpanded(true);
    }
  }, [selectedNodeId]);

  const showOverlayExpander = mode === "expanded" && !!detailPane;
  const showBelowDetailPane = !!detailPane && !showOverlayExpander;

  return (
    <section className={`panel panel--navigator panel--navigator-${mode}`}>
      <div className="navigator-widget__heading">
        <div className="navigator-widget__toolbar">
          <div className="train-selector navigator-widget__trains">
            {graphs.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`train-chip ${item.id === graph?.id ? "is-selected" : ""}`}
                onClick={() => onSelectGraph(item.id)}
              >
                <span>{item.label}</span>
                <small>{item.derivation}</small>
              </button>
            ))}
          </div>

          <div className="navigator-widget__current-label">
            {graph?.label ?? "Graph"}
          </div>

          <div className="navigator-widget__mode-toggle">
            <button
              type="button"
              className="navigator-mode-toggle"
              onClick={() => onChangeMode(mode === "compressed" ? "expanded" : "compressed")}
            >
              <span aria-hidden="true">{mode === "compressed" ? "⌄" : "⌃"}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="world-controls">
        <div className="world-controls__actions">
              <button className="ghost" type="button" onClick={onRefresh} disabled={!!runningCommand}>
                Refresh Project
              </button>
              <button type="button" onClick={onIterate} disabled={!!runningCommand}>
                {runningCommand === "iterate" ? "Advancing..." : "Advance One Step"}
              </button>
          <button type="button" onClick={onStartAuto} disabled={!!runningCommand}>
            {runningCommand === "start" ? "Starting..." : "Run Until Blocked"}
          </button>
        </div>
      </div>

      {graph ? (
        <div className="graph-workspace__surface">
          <div className="graph-workspace__map-pane">
            {mode === "expanded" ? (
              <>
                <GraphMap
                  graph={graph}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                />
                {showOverlayExpander && detailExpanded ? (
                  <aside className="graph-workspace__overlay-expander">
                    <GraphNodeExpander
                      graph={graph}
                      selectedNode={selectedNode}
                      expanded={detailExpanded}
                      onToggleExpanded={() => setDetailExpanded((current) => !current)}
                    >
                      {detailPane}
                    </GraphNodeExpander>
                  </aside>
                ) : null}

                {showOverlayExpander && !detailExpanded ? (
                  <button
                    type="button"
                    className="graph-workspace__reopen ghost"
                    onClick={() => setDetailExpanded(true)}
                  >
                    <span className="panel__eyebrow">{selectedNode ? "Selected Node" : "Graph Detail"}</span>
                    <strong>{selectedNode?.label ?? graph.label}</strong>
                    <span aria-hidden="true">⌄</span>
                  </button>
                ) : null}
              </>
            ) : (
              <GraphRail
                graph={graph}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
              />
            )}
          </div>
        </div>
      ) : (
        <p className="muted">Graph workspace will appear once the manager world is loaded.</p>
      )}

      {graph && overview ? (
        <div className="graph-summary">
          <div className="panel__heading">
            <div>
              <span className="panel__eyebrow">{overview.eyebrow}</span>
              <h2>{overview.title}</h2>
            </div>
            <p>{overview.summary}</p>
          </div>
          <div className="odd-card-grid">
            {overview.cards.map((card) => (
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
        </div>
      ) : null}

      {graph && overview ? (
        <div className={`graph-detail-grid ${showBelowDetailPane ? "graph-detail-grid--split" : ""}`}>
          <div className="graph-detail-section">
            <div className="panel__heading panel__heading--subsection">
              <div>
                <span className="panel__eyebrow">{overview.focusTitle}</span>
                <h3>{overview.focusTitle}</h3>
              </div>
              <p>High-signal nodes from the active supervisory lane.</p>
            </div>
            <div className="list-stack">
              {overview.focusRows.length ? (
                overview.focusRows.map((row) => {
                  const node = graph.nodes.find((item) => item.id === row.nodeId);
                  return (
                    <button
                      key={row.nodeId}
                      type="button"
                      className="list-row"
                      onClick={() => {
                        if (node) {
                          onSelectNode(node);
                        }
                      }}
                    >
                      <div className="list-row__meta">
                        <span className="panel__eyebrow">{overview.eyebrow}</span>
                        <span className={`status-chip ${row.tone}`}>{row.tone}</span>
                      </div>
                      <strong className="list-row__title">{row.label}</strong>
                      <p className="list-row__summary">{row.summary}</p>
                    </button>
                  );
                })
              ) : (
                <div className="empty-state">
                  <strong>{overview.focusEmptyTitle}</strong>
                  <p>{overview.focusEmptySummary}</p>
                </div>
              )}
            </div>
          </div>

          {showBelowDetailPane ? (
            <div className="graph-detail-pane">
              <GraphNodeExpander
                graph={graph}
                selectedNode={selectedNode}
                expanded={detailExpanded}
                onToggleExpanded={() => setDetailExpanded((current) => !current)}
              >
                {detailPane}
              </GraphNodeExpander>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function GraphNodeExpander({
  graph,
  selectedNode,
  expanded,
  onToggleExpanded,
  children,
}: {
  graph: GraphView;
  selectedNode: GraphNodeView | null;
  expanded: boolean;
  onToggleExpanded: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`graph-node-expander ${expanded ? "is-expanded" : "is-collapsed"} ${selectedNode ? `graph-node-expander--${selectedNode.kind}` : ""}`}
    >
      <div className="graph-node-expander__header">
        <div className="graph-node-expander__title">
          <div className="list-row__meta">
            <span className="panel__eyebrow">
              {selectedNode ? "Selected Node" : "Graph Detail"}
            </span>
            <span className={`status-chip ${selectedNode?.status ?? graph.status}`}>
              {selectedNode?.status ?? graph.status}
            </span>
          </div>
          <strong>{selectedNode?.label ?? graph.label}</strong>
          <p>
            {selectedNode
              ? `${selectedNode.description} ${selectedNode.subtitle ? `Type: ${selectedNode.subtitle}.` : ""}`.trim()
              : graph.derivation}
          </p>
        </div>
        <button
          type="button"
          className="ghost graph-node-expander__toggle"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          title={expanded ? "Collapse detail" : "Expand detail"}
        >
          <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
        </button>
      </div>

      {expanded ? <div className="graph-node-expander__body">{children}</div> : null}
    </div>
  );
}

function GraphRail({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  graph: GraphView;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodeView) => void;
}) {
  const layout = buildGraphLayout(graph);
  const orderedNodes = [...layout.nodes].sort((left, right) => left.x - right.x || left.y - right.y);
  const columns = Array.from(
    { length: Math.ceil(orderedNodes.length / RAIL_ROWS) },
    (_, index) => orderedNodes.slice(index * RAIL_ROWS, index * RAIL_ROWS + RAIL_ROWS),
  );

  return (
    <div className="operate-nav">
      <div className="operate-nav__track operate-nav__track--double-row">
        {columns.map((column, index) => {
          const nextColumn = columns[index + 1] ?? null;
          const primaryTone =
            nextColumn && column[0]
              ? connectorTone(column[0].status, nextColumn[0]?.status ?? nextColumn[1]?.status ?? column[0].status)
              : null;
          const secondarySource = column[1] ?? column[0] ?? null;
          const secondaryTarget = nextColumn?.[1] ?? nextColumn?.[0] ?? null;
          const secondaryTone =
            secondarySource && secondaryTarget
              ? connectorTone(secondarySource.status, secondaryTarget.status)
              : primaryTone;
          return (
            <div key={column.map((node) => node.id).join(":")} className="operate-nav__column-wrap">
              <div className={`operate-nav__column ${column.length === 1 ? "is-single" : ""}`}>
                {column.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={`operate-nav__stop ${node.status} ${node.id === selectedNodeId ? "is-selected" : ""}`}
                    onClick={() => onSelectNode(node)}
                  >
                    <span className={`operate-nav__signal ${node.status}`} />
                    <span className="operate-nav__label">{node.label}</span>
                  </button>
                ))}
              </div>
              {nextColumn ? (
                <div className="operate-nav__column-connectors" aria-hidden="true">
                  <span className={`operate-nav__connector operate-nav__connector--lane ${primaryTone ?? ""}`} />
                  <span className={`operate-nav__connector operate-nav__connector--lane ${secondaryTone ?? ""}`} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GraphMap({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  graph: GraphView;
  selectedNodeId: string | null;
  onSelectNode: (node: GraphNodeView) => void;
}) {
  const layout = buildGraphLayout(graph);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pendingAnchorRef = useRef<ZoomAnchor | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState<Viewport>({
    left: 0,
    top: 0,
    width: layout.width,
    height: layout.height,
  });

  const positions = new Map(layout.nodes.map((node) => [node.id, node]));
  const minimapScaleX = MINIMAP_WIDTH / layout.width;
  const minimapScaleY = MINIMAP_HEIGHT / layout.height;

  const emphasis = useMemo(() => {
    if (!selectedNodeId) {
      return {
        related: new Set<string>(),
      };
    }
    const related = new Set<string>([selectedNodeId]);
    for (const segment of layout.segments) {
      if (segment.from === selectedNodeId || segment.to === selectedNodeId) {
        related.add(segment.from);
        related.add(segment.to);
      }
    }
    return { related };
  }, [layout.segments, selectedNodeId]);

  const updateViewport = useCallback(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    setViewport({
      left: element.scrollLeft / zoom,
      top: element.scrollTop / zoom,
      width: element.clientWidth / zoom,
      height: element.clientHeight / zoom,
    });
  }, [zoom]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const handleScroll = () => updateViewport();
    const resizeObserver = new ResizeObserver(() => updateViewport());
    resizeObserver.observe(element);
    element.addEventListener("scroll", handleScroll);
    updateViewport();
    return () => {
      resizeObserver.disconnect();
      element.removeEventListener("scroll", handleScroll);
    };
  }, [updateViewport]);

  useEffect(() => {
    const element = viewportRef.current;
    const pendingAnchor = pendingAnchorRef.current;
    if (!element || !pendingAnchor) {
      return;
    }
    element.scrollLeft = pendingAnchor.x * zoom - pendingAnchor.offsetX;
    element.scrollTop = pendingAnchor.y * zoom - pendingAnchor.offsetY;
    pendingAnchorRef.current = null;
    updateViewport();
  }, [updateViewport, zoom]);

  function applyZoom(nextZoom: number, offsetX: number, offsetY: number) {
    const element = viewportRef.current;
    if (!element || nextZoom === zoom) {
      return;
    }
    pendingAnchorRef.current = {
      x: (element.scrollLeft + offsetX) / zoom,
      y: (element.scrollTop + offsetY) / zoom,
      offsetX,
      offsetY,
    };
    setZoom(nextZoom);
  }

  function changeZoom(direction: "in" | "out" | "reset") {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const nextZoom =
      direction === "reset"
        ? 1
        : clamp(zoom + (direction === "in" ? ZOOM_STEP : -ZOOM_STEP), MIN_ZOOM, MAX_ZOOM);
    applyZoom(nextZoom, element.clientWidth / 2, element.clientHeight / 2);
  }

  function recenterFromMinimap(clientX: number, clientY: number, bounds: DOMRect) {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const targetX = clamp(((clientX - bounds.left) / bounds.width) * layout.width, 0, layout.width);
    const targetY = clamp(((clientY - bounds.top) / bounds.height) * layout.height, 0, layout.height);
    element.scrollLeft = targetX * zoom - element.clientWidth / 2;
    element.scrollTop = targetY * zoom - element.clientHeight / 2;
    updateViewport();
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    const macPlatform = isMacPlatform();
    if (macPlatform && !event.ctrlKey) {
      return;
    }
    if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
      return;
    }
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left;
    const offsetY = event.clientY - bounds.top;
    const nextZoom = clamp(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), MIN_ZOOM, MAX_ZOOM);
    applyZoom(nextZoom, offsetX, offsetY);
  }

  const hasSelection = selectedNodeId !== null;

  return (
    <div className="network-map-shell">
      <div className="network-map-frame">
        <div className="network-map__controls network-map__controls--overlay">
          <button type="button" className="secondary" onClick={() => changeZoom("out")} disabled={zoom <= MIN_ZOOM}>
            -
          </button>
          <span className="network-map__zoom">{Math.round(zoom * 100)}%</span>
          <button type="button" className="secondary" onClick={() => changeZoom("in")} disabled={zoom >= MAX_ZOOM}>
            +
          </button>
          <button type="button" className="ghost" onClick={() => changeZoom("reset")} disabled={zoom === 1}>
            Reset
          </button>
        </div>

        <div ref={viewportRef} className="network-map" onWheel={handleWheel}>
          <div
            className="network-map__canvas"
            style={{ width: `${layout.width * zoom}px`, height: `${layout.height * zoom}px` }}
          >
            <svg
              className="network-map__lines"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {layout.segments.map((segment) => {
                const from = positions.get(segment.from);
                const to = positions.get(segment.to);
                if (!from || !to) {
                  return null;
                }
                const isSelected =
                  hasSelection &&
                  (segment.from === selectedNodeId || segment.to === selectedNodeId);
                const isRelated =
                  hasSelection &&
                  (emphasis.related.has(segment.from) || emphasis.related.has(segment.to));
                return (
                  <line
                    key={segment.id}
                    className={`network-map__segment ${segment.status} ${isSelected ? "is-selected" : isRelated ? "is-related" : "is-muted"}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                  />
                );
              })}
            </svg>

            {layout.nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const isRelated = !hasSelection || emphasis.related.has(node.id);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`network-map__node ${node.status} ${isSelected ? "is-selected" : ""} ${isRelated ? "is-related" : "is-muted"} network-map__node--${node.kind}`}
                  style={{ left: `${node.x * zoom}px`, top: `${node.y * zoom}px` }}
                  onClick={() => onSelectNode(node)}
                >
                  <span className={`network-map__pulse ${node.status}`} />
                  <span className="network-map__node-label">{node.label}</span>
                  <span className="network-map__node-subtitle">{node.subtitle}</span>
                  <span className={`status-chip ${node.status}`}>{node.status}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="network-map__overview">
          <button
            type="button"
            className="network-map__overview-card"
            onClick={(event) =>
              recenterFromMinimap(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
            }
          >
            <svg className="network-map__overview-svg" viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`} aria-hidden="true">
              {layout.segments.map((segment) => {
                const from = positions.get(segment.from);
                const to = positions.get(segment.to);
                if (!from || !to) {
                  return null;
                }
                return (
                  <line
                    key={`overview-${segment.id}`}
                    className={`network-map__overview-segment ${segment.status}`}
                    x1={from.x * minimapScaleX}
                    y1={from.y * minimapScaleY}
                    x2={to.x * minimapScaleX}
                    y2={to.y * minimapScaleY}
                  />
                );
              })}

              {layout.nodes.map((node) => (
                <circle
                  key={`overview-${node.id}`}
                  className={`network-map__overview-node ${node.status} ${node.id === selectedNodeId ? "is-selected" : ""}`}
                  cx={node.x * minimapScaleX}
                  cy={node.y * minimapScaleY}
                  r={node.id === selectedNodeId ? 5 : 4}
                />
              ))}

              <rect
                className="network-map__overview-viewport"
                x={clamp(viewport.left * minimapScaleX, 0, MINIMAP_WIDTH)}
                y={clamp(viewport.top * minimapScaleY, 0, MINIMAP_HEIGHT)}
                width={Math.min(viewport.width * minimapScaleX, MINIMAP_WIDTH)}
                height={Math.min(viewport.height * minimapScaleY, MINIMAP_HEIGHT)}
                rx={8}
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
