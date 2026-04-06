import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WheelEvent as ReactWheelEvent } from "react";
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
};

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.7;
const ZOOM_STEP = 0.15;
const MINIMAP_WIDTH = 180;
const MINIMAP_HEIGHT = 80;

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
}: GraphWorkspaceProps) {
  const graph = graphs.find((item) => item.id === selectedGraphId) ?? graphs[0] ?? null;

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
            Refresh World
          </button>
          <button type="button" onClick={onIterate} disabled={!!runningCommand}>
            {runningCommand === "iterate" ? "Iterating..." : "Iterate Once"}
          </button>
          <button type="button" onClick={onStartAuto} disabled={!!runningCommand}>
            {runningCommand === "start" ? "Starting..." : "Run Until Blocked"}
          </button>
        </div>
      </div>

      {graph ? (
        mode === "expanded" ? (
          <GraphMap
            graph={graph}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        ) : (
          <GraphRail
            graph={graph}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
          />
        )
      ) : (
        <p className="muted">Graph workspace will appear once the manager world is loaded.</p>
      )}
    </section>
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

  return (
    <div className="operate-nav">
      <div className="operate-nav__track">
        {orderedNodes.map((node, index) => {
          const nextNode = orderedNodes[index + 1] ?? null;
          const connectorClass = nextNode ? connectorTone(node.status, nextNode.status) : null;
          return (
            <div key={node.id} className="operate-nav__stop-wrap">
              <button
                type="button"
                className={`operate-nav__stop ${node.status} ${node.id === selectedNodeId ? "is-selected" : ""}`}
                onClick={() => onSelectNode(node)}
              >
                <span className={`operate-nav__signal ${node.status}`} />
                <span className="operate-nav__label">{node.label}</span>
              </button>
              {nextNode ? (
                <span className={`operate-nav__connector ${connectorClass}`} aria-hidden="true" />
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
                const isRelated =
                  !hasSelection ||
                  emphasis.related.has(segment.from) ||
                  emphasis.related.has(segment.to);
                return (
                  <line
                    key={segment.id}
                    className={`network-map__segment ${segment.status} ${isRelated ? "is-related" : "is-muted"}`}
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
                  className={`network-map__node ${node.status} ${isSelected ? "is-selected" : ""} ${isRelated ? "is-related" : "is-muted"} ${node.kind === "workorder" ? "network-map__node--workorder" : ""}`}
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
