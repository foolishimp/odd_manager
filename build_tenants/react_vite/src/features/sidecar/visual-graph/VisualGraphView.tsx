import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import type { VisualGraphProjection } from "@odd-manager/developer-control-contracts";
import { layoutDeclarationGraph, layoutOccurrenceGraph } from "./layout";
import type {
  SidecarVisualGraphState,
  VisualGraphMode,
  VisualGraphOverlay,
  VisualGraphPlane,
  VisualGraphSelectedNode,
} from "./state";

type OccurrenceNode = VisualGraphProjection["occurrenceGraph"]["nodes"][number];
type DeclarationNode = VisualGraphProjection["declarationTopology"]["nodes"][number];
type WorkspaceObservation = VisualGraphProjection["workspaceObservations"]["observations"][number];
type ActorSession = VisualGraphProjection["actorSessions"]["sessions"][number];

export type VisualGraphViewProps = {
  state: SidecarVisualGraphState;
  onSelectNode: (selection: VisualGraphSelectedNode | null) => void;
  onPlaneChange: (plane: VisualGraphPlane) => void;
  onModeChange: (mode: VisualGraphMode) => void;
  onZoomChange: (zoom: number) => void;
  onOverlayVisibilityChange: (overlay: VisualGraphOverlay, visible: boolean) => void;
  onOpenDetail: (selection: VisualGraphSelectedNode) => void;
  onCloseDetail: () => void;
  onDetailFocusRestored: (requestId: number) => void;
  onRetry: () => void;
};

function phrase(value: string) {
  return value.replace(/[_-]/gu, " ");
}

function shortRef(value: string) {
  return value.length > 52 ? `${value.slice(0, 24)}…${value.slice(-20)}` : value;
}

function occurrenceCue(node: OccurrenceNode, projection: VisualGraphProjection) {
  const active = projection.occurrenceGraph.activeNodeIds.includes(node.id);
  const lastObserved = projection.occurrenceGraph.lastObservedNodeId === node.id;
  if (active && lastObserved) return { key: "active-last-observed", label: "▶ ACTIVE · ◆ LAST OBSERVED" };
  if (active) return { key: "active", label: "▶ ACTIVE" };
  if (lastObserved) return { key: "last-observed", label: "◆ LAST OBSERVED" };
  return { key: node.state, label: phrase(node.state).toUpperCase() };
}

function selectedOccurrenceNode(
  projection: VisualGraphProjection,
  selection: VisualGraphSelectedNode | null,
) {
  if (selection?.plane !== "occurrence") return null;
  return projection.occurrenceGraph.nodes.find((node) => (
    node.id === selection.id && node.aggregateType === selection.aggregateType
  )) ?? null;
}

function selectedDeclarationNode(
  projection: VisualGraphProjection,
  selection: VisualGraphSelectedNode | null,
) {
  if (selection?.plane !== "declaration") return null;
  return projection.declarationTopology.nodes.find((node) => (
    node.id === selection.id && node.kind === selection.kind
  )) ?? null;
}

function visibleDeclarationGraph(
  projection: VisualGraphProjection,
  productOverlaysVisible: boolean,
) {
  if (productOverlaysVisible) {
    return {
      nodes: projection.declarationTopology.nodes,
      edges: projection.declarationTopology.edges,
    };
  }
  const nodes = projection.declarationTopology.nodes.filter((node) => node.kind !== "overlay");
  const retained = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: projection.declarationTopology.edges.filter((edge) => (
      edge.kind !== "overlay_application"
      && retained.has(edge.sourceNodeId)
      && retained.has(edge.targetNodeId)
    )),
  };
}

function moveNodeFocus<Node extends { id: string }>(
  event: KeyboardEvent<HTMLButtonElement>,
  nodes: Node[],
  current: Node,
  onSelect: (node: Node) => void,
) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const index = nodes.findIndex((node) => node.id === current.id);
  const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? nodes.length - 1
      : Math.min(nodes.length - 1, Math.max(0, index + delta));
  const next = nodes[nextIndex];
  if (!next) return;
  onSelect(next);
  event.currentTarget.closest<HTMLElement>("[data-visual-node-list]")
    ?.querySelector<HTMLButtonElement>(`[data-node-index="${nextIndex}"]`)
    ?.focus();
}

function handleNodeKeyDown<Node extends { id: string }>(
  event: KeyboardEvent<HTMLButtonElement>,
  nodes: Node[],
  current: Node,
  selectionFor: (node: Node) => VisualGraphSelectedNode,
  detailOpen: boolean,
  onSelect: (selection: VisualGraphSelectedNode) => void,
  onOpenDetail: (selection: VisualGraphSelectedNode) => void,
  onCloseDetail: () => void,
) {
  if (event.key === "Enter") {
    event.preventDefault();
    onOpenDetail(selectionFor(current));
    return;
  }
  if (event.key === "Escape" && detailOpen) {
    event.preventDefault();
    onCloseDetail();
    return;
  }
  moveNodeFocus(event, nodes, current, (next) => onSelect(selectionFor(next)));
}

function focusButtonForSelection(root: HTMLElement, selection: VisualGraphSelectedNode) {
  return [...root.querySelectorAll<HTMLButtonElement>("[data-visual-graph-node]")].find((button) => (
    button.dataset.visualNodePlane === selection.plane
    && button.dataset.visualNodeId === selection.id
    && (selection.plane === "occurrence"
      ? button.dataset.visualNodeKind === selection.aggregateType
      : button.dataset.visualNodeKind === selection.kind)
  )) ?? null;
}

function relationRole(
  edge: { sourceNodeId: string; targetNodeId: string },
  nodeId: string,
) {
  if (edge.sourceNodeId === nodeId && edge.targetNodeId === nodeId) return "incoming and outgoing";
  return edge.sourceNodeId === nodeId ? "outgoing" : "incoming";
}

function relationPeer(
  edge: { sourceNodeId: string; targetNodeId: string },
  nodeId: string,
) {
  if (edge.sourceNodeId === nodeId && edge.targetNodeId === nodeId) return "↻ self";
  return edge.sourceNodeId === nodeId ? `→ ${edge.targetNodeId}` : `← ${edge.sourceNodeId}`;
}

function relationDirection(
  edge: { sourceNodeId: string; targetNodeId: string },
  nodeId: string,
) {
  return `${relationRole(edge, nodeId)} ${relationPeer(edge, nodeId)}`;
}

function PlaneLegend({ projection }: { projection: VisualGraphProjection }) {
  const overlayCount = projection.declarationTopology.references.filter((entry) => entry.kind === "overlay").length;
  return (
    <ul className="visual-graph__legend" aria-label="Graph truth-plane and status legend">
      <li data-plane="declaration"><span aria-hidden="true">□</span><strong>Declaration</strong><em>{phrase(projection.declarationTopology.state)}</em></li>
      <li data-plane="occurrence"><span aria-hidden="true">●</span><strong>Occurrence</strong><em>{phrase(projection.occurrenceGraph.state)}</em></li>
      <li data-plane="workspace"><span aria-hidden="true">◇</span><strong>Workspace</strong><em>{phrase(projection.workspaceObservations.currentness)}</em></li>
      <li data-plane="actor"><span aria-hidden="true">▣</span><strong>Actor session</strong><em>{phrase(projection.actorSessions.interactionDisposition)}</em></li>
      <li data-plane="overlay"><span aria-hidden="true">▧</span><strong>Product overlays</strong><em>{overlayCount > 0 ? `${overlayCount} reference${overlayCount === 1 ? "" : "s"}` : "missing"}</em></li>
    </ul>
  );
}

function RunContractTraceability({ projection }: { projection: VisualGraphProjection }) {
  const run = projection.run;
  if (!run) return null;
  const rows = [
    ["Run digest", run.runDigest ?? "not published"],
    ["Published event-contract digest", run.eventContract.publishedDigest ?? "not published"],
    ["Built-in registry digest", run.eventContract.builtInRegistryDigest ?? "unavailable"],
    ["Contract posture", phrase(run.eventContract.posture)],
    ["Binding posture", run.eventContract.bindingPosture ? phrase(run.eventContract.bindingPosture) : "unavailable"],
    ["Evidence authority", run.evidence.authority ? phrase(run.evidence.authority) : "unavailable"],
    ["Evidence disposition", run.evidence.disposition ? phrase(run.evidence.disposition) : "unavailable"],
    ["Validation disposition", run.evidence.validationDisposition ? phrase(run.evidence.validationDisposition) : "unavailable"],
  ] as const;
  return (
    <section className="visual-graph__traceability" aria-label="Selected run event-contract traceability">
      <dl>
        {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><code title={value}>{value}</code></dd></div>)}
      </dl>
    </section>
  );
}

function DeclarationStatus({ projection }: { projection: VisualGraphProjection }) {
  const overlays = projection.declarationTopology.references.filter((entry) => entry.kind === "overlay");
  return (
    <section className="visual-graph__plane-status" aria-labelledby="visual-graph-declaration-heading">
      <div>
        <span>Declaration topology</span>
        <strong id="visual-graph-declaration-heading">{phrase(projection.declarationTopology.state)}</strong>
      </div>
      <p>
        {projection.declarationTopology.reason === "published_bodies_admitted"
          ? "Published declaration bodies are admitted as a separate plane."
          : projection.declarationTopology.reason === "references_without_bodies"
            ? "Declaration references exist, but their node and edge bodies are not retained. No topology is inferred."
            : "No admitted declaration carrier is available. The occurrence graph below is not declaration topology."}
      </p>
      <div className="visual-graph__reference-list">
        {projection.declarationTopology.references.slice(0, 12).map((reference) => (
          <code key={`${reference.kind}:${reference.ref}`} title={reference.ref}>{reference.kind}: {shortRef(reference.ref)}</code>
        ))}
        {projection.declarationTopology.references.length > 12 && <span>+{projection.declarationTopology.references.length - 12} more bounded references</span>}
      </div>
      <p className="visual-graph__overlay-posture">
        {overlays.length === 0
          ? "Product overlays: unavailable — no overlay reference or body is admitted."
          : `Product overlays: ${overlays.length} published reference${overlays.length === 1 ? "" : "s"}; applicability is not inferred.`}
      </p>
    </section>
  );
}

function WorkspaceStatus({ projection }: { projection: VisualGraphProjection }) {
  return (
    <section className="visual-graph__plane-status" aria-labelledby="visual-graph-workspace-heading">
      <div>
        <span>Mutable workspace observations</span>
        <strong id="visual-graph-workspace-heading">{phrase(projection.workspaceObservations.currentness)}</strong>
      </div>
      <p>These are bounded observations at the retained frontier, not immutable workspace snapshots.</p>
      <div className="visual-graph__observation-strip">
        {projection.workspaceObservations.observations.slice(0, 8).map((observation) => (
          <span key={`${observation.ordinal}:${observation.sourceEvent?.eventId ?? "none"}`}>
            Observation {observation.ordinal} · {phrase(observation.current.posture)} · {phrase(observation.current.state)}
          </span>
        ))}
        {projection.workspaceObservations.observations.length > 8 && (
          <span>+{projection.workspaceObservations.observations.length - 8} more bounded observations; switch to Table for every retained row.</span>
        )}
        {projection.workspaceObservations.observations.length === 0 && <span>No workspace observation is retained.</span>}
      </div>
    </section>
  );
}

function ActorSessionStatus({ projection }: { projection: VisualGraphProjection }) {
  return (
    <section className="visual-graph__plane-status visual-graph__actor-sessions" aria-labelledby="visual-graph-actor-heading">
      <div>
        <span>Actor session capability</span>
        <strong id="visual-graph-actor-heading">{phrase(projection.actorSessions.interactionDisposition)}</strong>
      </div>
      <p>Observation does not grant terminal control. No attach, watch, input, or manager shell action is available without a separately implemented admitted effect.</p>
      <div className="visual-graph__session-list">
        {projection.actorSessions.sessions.map((session) => (
          <article key={session.id}>
            <div><strong>{phrase(session.lifecycleState)}</strong><span>{phrase(session.terminalDisposition)}</span></div>
            <code title={session.id}>{shortRef(session.id)}</code>
            <span>{session.archiveRefs.length > 0 ? `${session.archiveRefs.length} archive candidate reference${session.archiveRefs.length === 1 ? "" : "s"}` : "No archive reference"}</span>
          </article>
        ))}
        {projection.actorSessions.sessions.length === 0 && <span>No actor session relation is retained.</span>}
      </div>
      <button type="button" className="secondary" disabled aria-describedby="visual-graph-terminal-explanation">Live interaction unavailable</button>
      <small id="visual-graph-terminal-explanation">The current client has no admitted actor-session attach/read/input effect.</small>
    </section>
  );
}

function OccurrenceNodeDetail({
  projection,
  node,
  open,
  onClose,
}: {
  projection: VisualGraphProjection;
  node: OccurrenceNode | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!node || !open) {
    return <aside className="visual-graph__detail" aria-label="Occurrence node detail"><p>Select an occurrence node, then press Enter to inspect its bounded identity and source-event coordinates.</p></aside>;
  }
  const incoming = projection.occurrenceGraph.edges.filter((edge) => edge.targetNodeId === node.id);
  const outgoing = projection.occurrenceGraph.edges.filter((edge) => edge.sourceNodeId === node.id);
  const relations = projection.occurrenceGraph.edges.filter((edge) => (
    edge.sourceNodeId === node.id || edge.targetNodeId === node.id
  ));
  const cue = occurrenceCue(node, projection);
  return (
    <aside
      className="visual-graph__detail"
      aria-labelledby="visual-graph-detail-heading"
      data-visual-graph-detail="open"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <button type="button" className="secondary visual-graph__detail-close" onClick={onClose}>Close detail</button>
      <div className="visual-graph__detail-heading">
        <span>{phrase(node.aggregateType)}</span>
        <strong id="visual-graph-detail-heading">{node.label}</strong>
        <em data-cue={cue.key}>{cue.label}</em>
      </div>
      <dl>
        <div><dt>Aggregate</dt><dd><code>{node.aggregateId}</code></dd></div>
        <div><dt>Occurrence</dt><dd><code>{node.id}</code></dd></div>
        <div><dt>First observed</dt><dd>#{node.firstObserved.ordinal} · {phrase(node.firstObserved.kind)}<code>{node.firstObserved.eventId}</code></dd></div>
        <div><dt>Last observed</dt><dd>#{node.lastObserved.ordinal} · {phrase(node.lastObserved.kind)}<code>{node.lastObserved.eventId}</code></dd></div>
        <div><dt>Exact relations</dt><dd>{incoming.length} incoming · {outgoing.length} outgoing</dd></div>
      </dl>
      <ul className="visual-graph__relations" aria-label="Exact selected-node relations">
        {relations.map((edge) => (
          <li key={edge.id}>
            <span>{phrase(edge.kind)}</span>
            <code>{relationDirection(edge, node.id)}</code>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function SpatialGraph({
  projection,
  state,
  onSelectNode,
  onOpenDetail,
  onCloseDetail,
}: {
  projection: VisualGraphProjection;
  state: SidecarVisualGraphState;
  onSelectNode: VisualGraphViewProps["onSelectNode"];
  onOpenDetail: VisualGraphViewProps["onOpenDetail"];
  onCloseDetail: VisualGraphViewProps["onCloseDetail"];
}) {
  const layout = useMemo(() => layoutOccurrenceGraph(
    projection.occurrenceGraph.nodes,
    projection.occurrenceGraph.edges,
    state.zoom,
  ), [projection.occurrenceGraph.edges, projection.occurrenceGraph.nodes, state.zoom]);
  const orderedNodes = useMemo(() => [...projection.occurrenceGraph.nodes].sort((left, right) => (
    left.firstObserved.ordinal - right.firstObserved.ordinal || left.id.localeCompare(right.id)
  )), [projection.occurrenceGraph.nodes]);
  const selected = selectedOccurrenceNode(projection, state.selectedNode);
  if (layout.nodes.length === 0) {
    return <div className="visual-graph__empty">No occurrence nodes were retained. Declaration and runtime absence remain distinct.</div>;
  }

  return (
    <div className="visual-graph__workspace">
      <div className="visual-graph__viewport" tabIndex={0} aria-label="Scrollable occurrence graph canvas">
        <div className="visual-graph__canvas" style={{ width: layout.width, height: layout.height }}>
          <svg className="visual-graph__edges" width={layout.width} height={layout.height} aria-hidden="true">
            <defs><marker id="visual-graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
            {layout.edges.map(({ edge, source, target }) => {
              const startX = source.x + source.width;
              const startY = source.y + source.height / 2;
              const endX = target.x;
              const endY = target.y + target.height / 2;
              const control = Math.max(34, Math.abs(endX - startX) * 0.42);
              return <path key={edge.id} data-edge-kind={edge.kind} d={`M ${startX} ${startY} C ${startX + control} ${startY}, ${endX - control} ${endY}, ${endX} ${endY}`} markerEnd="url(#visual-graph-arrow)" />;
            })}
          </svg>
          <div className="visual-graph__nodes" data-visual-node-list>
            {layout.nodes.map(({ node, x, y, width, height }) => {
              const cue = occurrenceCue(node, projection);
              const index = orderedNodes.findIndex((entry) => entry.id === node.id);
              const isSelected = selected?.id === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  data-node-index={index}
                  data-node-state={node.state}
                  data-node-cue={cue.key}
                  data-visual-graph-node
                  data-visual-node-plane="occurrence"
                  data-visual-node-id={node.id}
                  data-visual-node-kind={node.aggregateType}
                  aria-pressed={isSelected}
                  aria-expanded={isSelected && state.detail.open}
                  aria-controls={isSelected && state.detail.open ? "visual-graph-detail-heading" : undefined}
                  tabIndex={isSelected || (!selected && index === 0) ? 0 : -1}
                  aria-label={`${node.label}, ${phrase(node.aggregateType)}, ${cue.label}, ${phrase(node.state)}`}
                  className={`visual-graph__node${isSelected ? " is-selected" : ""}`}
                  style={{ left: x, top: y, width, height }}
                  onClick={() => onOpenDetail({ plane: "occurrence", id: node.id, aggregateType: node.aggregateType })}
                  onKeyDown={(event) => handleNodeKeyDown(
                    event,
                    orderedNodes,
                    node,
                    (entry) => ({ plane: "occurrence", id: entry.id, aggregateType: entry.aggregateType }),
                    state.detail.open,
                    onSelectNode,
                    onOpenDetail,
                    onCloseDetail,
                  )}
                >
                  <span>{phrase(node.aggregateType)}</span>
                  <strong>{node.label}</strong>
                  <em>{cue.label}</em>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <svg className="visual-graph__minimap" role="img" aria-label="Occurrence graph minimap" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet">
        {layout.edges.map(({ edge, source, target }) => <line key={edge.id} x1={source.x + source.width / 2} y1={source.y + source.height / 2} x2={target.x + target.width / 2} y2={target.y + target.height / 2} />)}
        {layout.nodes.map(({ node, x, y, width, height }) => <rect key={node.id} x={x} y={y} width={width} height={height} data-node-cue={occurrenceCue(node, projection).key} />)}
      </svg>
      <OccurrenceNodeDetail projection={projection} node={selected} open={state.detail.open} onClose={onCloseDetail} />
    </div>
  );
}

function DeclarationNodeDetail({
  node,
  edges,
  open,
  onClose,
}: {
  node: DeclarationNode | null;
  edges: VisualGraphProjection["declarationTopology"]["edges"];
  open: boolean;
  onClose: () => void;
}) {
  if (!node || !open) {
    return <aside className="visual-graph__detail" aria-label="Declaration node detail"><p>Select a declaration node, then press Enter to inspect its published identity and exact declaration relations.</p></aside>;
  }
  const incoming = edges.filter((edge) => edge.targetNodeId === node.id);
  const outgoing = edges.filter((edge) => edge.sourceNodeId === node.id);
  const relations = edges.filter((edge) => edge.sourceNodeId === node.id || edge.targetNodeId === node.id);
  return (
    <aside
      className="visual-graph__detail"
      aria-labelledby="visual-graph-declaration-detail-heading"
      data-visual-graph-detail="open"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
    >
      <button type="button" className="secondary visual-graph__detail-close" onClick={onClose}>Close detail</button>
      <div className="visual-graph__detail-heading">
        <span>{phrase(node.kind)}</span>
        <strong id="visual-graph-declaration-detail-heading">{node.label}</strong>
      </div>
      <dl>
        <div><dt>Declaration node</dt><dd><code>{node.id}</code></dd></div>
        <div><dt>Declaration reference</dt><dd><code>{node.declarationRef}</code></dd></div>
        <div><dt>Exact relations</dt><dd>{incoming.length} incoming · {outgoing.length} outgoing</dd></div>
      </dl>
      <ul className="visual-graph__relations" aria-label="Exact selected declaration-node relations">
        {relations.map((edge) => (
          <li key={edge.id}>
            <span>{phrase(edge.kind)}</span>
            <code>{relationDirection(edge, node.id)}</code>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function DeclarationSpatialGraph({
  projection,
  state,
  onSelectNode,
  onOpenDetail,
  onCloseDetail,
}: {
  projection: VisualGraphProjection;
  state: SidecarVisualGraphState;
  onSelectNode: VisualGraphViewProps["onSelectNode"];
  onOpenDetail: VisualGraphViewProps["onOpenDetail"];
  onCloseDetail: VisualGraphViewProps["onCloseDetail"];
}) {
  const graph = useMemo(() => visibleDeclarationGraph(
    projection,
    state.overlayVisibility["product-overlays"],
  ), [projection, state.overlayVisibility]);
  const layout = useMemo(() => layoutDeclarationGraph(
    graph.nodes,
    graph.edges,
    state.zoom,
  ), [graph.edges, graph.nodes, state.zoom]);
  const orderedNodes = useMemo(() => [...graph.nodes].sort((left, right) => (
    left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label) || left.id.localeCompare(right.id)
  )), [graph.nodes]);
  const selectedCandidate = selectedDeclarationNode(projection, state.selectedNode);
  const selected = selectedCandidate && graph.nodes.some((node) => node.id === selectedCandidate.id)
    ? selectedCandidate
    : null;

  return (
    <div className="visual-graph__workspace" data-primary-plane="declaration">
      <div className="visual-graph__viewport" tabIndex={0} aria-label="Scrollable declaration topology canvas">
        <div className="visual-graph__canvas" style={{ width: layout.width, height: layout.height }}>
          <svg className="visual-graph__edges" width={layout.width} height={layout.height} aria-hidden="true">
            <defs><marker id="visual-declaration-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
            {layout.edges.map(({ edge, source, target }) => {
              const startX = source.x + source.width;
              const startY = source.y + source.height / 2;
              const endX = target.x;
              const endY = target.y + target.height / 2;
              const control = Math.max(34, Math.abs(endX - startX) * 0.42);
              return <path key={edge.id} data-edge-kind={edge.kind} d={`M ${startX} ${startY} C ${startX + control} ${startY}, ${endX - control} ${endY}, ${endX} ${endY}`} markerEnd="url(#visual-declaration-arrow)" />;
            })}
          </svg>
          <div className="visual-graph__nodes" data-visual-node-list>
            {layout.nodes.map(({ node, x, y, width, height }) => {
              const index = orderedNodes.findIndex((entry) => entry.id === node.id);
              const isSelected = selected?.id === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  data-node-index={index}
                  data-node-plane="declaration"
                  data-node-kind={node.kind}
                  data-visual-graph-node
                  data-visual-node-plane="declaration"
                  data-visual-node-id={node.id}
                  data-visual-node-kind={node.kind}
                  aria-pressed={isSelected}
                  aria-expanded={isSelected && state.detail.open}
                  aria-controls={isSelected && state.detail.open ? "visual-graph-declaration-detail-heading" : undefined}
                  tabIndex={isSelected || (!selected && index === 0) ? 0 : -1}
                  aria-label={`${node.label}, ${phrase(node.kind)}, declared topology`}
                  className={`visual-graph__node${isSelected ? " is-selected" : ""}`}
                  style={{ left: x, top: y, width, height }}
                  onClick={() => onOpenDetail({ plane: "declaration", id: node.id, kind: node.kind })}
                  onKeyDown={(event) => handleNodeKeyDown(
                    event,
                    orderedNodes,
                    node,
                    (entry) => ({ plane: "declaration", id: entry.id, kind: entry.kind }),
                    state.detail.open,
                    onSelectNode,
                    onOpenDetail,
                    onCloseDetail,
                  )}
                >
                  <span>{phrase(node.kind)}</span>
                  <strong>{node.label}</strong>
                  <em>DECLARED</em>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <svg className="visual-graph__minimap" role="img" aria-label="Declaration topology minimap" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet">
        {layout.edges.map(({ edge, source, target }) => <line key={edge.id} x1={source.x + source.width / 2} y1={source.y + source.height / 2} x2={target.x + target.width / 2} y2={target.y + target.height / 2} />)}
        {layout.nodes.map(({ node, x, y, width, height }) => <rect key={node.id} x={x} y={y} width={width} height={height} data-node-plane="declaration" />)}
      </svg>
      <DeclarationNodeDetail node={selected} edges={graph.edges} open={state.detail.open} onClose={onCloseDetail} />
    </div>
  );
}

function AccessibleOccurrenceGraphTable({
  projection,
  state,
  selected,
  onSelectNode,
  onOpenDetail,
  onCloseDetail,
}: {
  projection: VisualGraphProjection;
  state: SidecarVisualGraphState;
  selected: VisualGraphSelectedNode | null;
  onSelectNode: VisualGraphViewProps["onSelectNode"];
  onOpenDetail: VisualGraphViewProps["onOpenDetail"];
  onCloseDetail: VisualGraphViewProps["onCloseDetail"];
}) {
  const nodes = projection.occurrenceGraph.nodes;
  const selectedOccurrence = selected?.plane === "occurrence" ? selected : null;
  return (
    <div
      className="visual-graph__table-scroll"
      role="region"
      aria-label="Scrollable occurrence graph table"
      tabIndex={0}
      data-visual-node-list
    >
      <table className="visual-graph__table">
        <caption>Accessible occurrence graph table. Every relation is supplied by the server projection.</caption>
        <thead><tr><th>Occurrence</th><th>Type</th><th>State</th><th>Position cue</th><th>Exact incoming and outgoing relations</th></tr></thead>
        <tbody>
          {nodes.map((node, index) => {
            const cue = occurrenceCue(node, projection);
            const relations = projection.occurrenceGraph.edges.filter((edge) => (
              edge.sourceNodeId === node.id || edge.targetNodeId === node.id
            ));
            const isSelected = selectedOccurrence?.id === node.id
              && selectedOccurrence.aggregateType === node.aggregateType;
            return (
              <tr key={node.id} className={isSelected ? "is-selected" : ""}>
                <td><button
                  type="button"
                  data-node-index={index}
                  data-visual-graph-node
                  data-visual-node-plane="occurrence"
                  data-visual-node-id={node.id}
                  data-visual-node-kind={node.aggregateType}
                  tabIndex={isSelected || (!selectedOccurrence && index === 0) ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-expanded={isSelected && state.detail.open}
                  aria-controls={isSelected && state.detail.open ? "visual-graph-detail-heading" : undefined}
                  onClick={() => onOpenDetail({ plane: "occurrence", id: node.id, aggregateType: node.aggregateType })}
                  onKeyDown={(event) => handleNodeKeyDown(
                    event,
                    nodes,
                    node,
                    (entry) => ({ plane: "occurrence", id: entry.id, aggregateType: entry.aggregateType }),
                    state.detail.open,
                    onSelectNode,
                    onOpenDetail,
                    onCloseDetail,
                  )}
                >{node.label}</button><code>{node.aggregateId}</code></td>
                <td>{phrase(node.aggregateType)}</td><td>{phrase(node.state)}</td><td>{cue.label}</td>
                <td>{relations.length === 0 ? "none published" : relations.map((edge) => (
                  <code key={edge.id}>
                    {relationRole(edge, node.id)} {phrase(edge.kind)} {relationPeer(edge, node.id)}
                  </code>
                ))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AccessibleDeclarationGraphTable({
  projection,
  state,
  selected,
  onSelectNode,
  onOpenDetail,
  onCloseDetail,
  productOverlaysVisible,
}: {
  projection: VisualGraphProjection;
  state: SidecarVisualGraphState;
  selected: VisualGraphSelectedNode | null;
  onSelectNode: VisualGraphViewProps["onSelectNode"];
  onOpenDetail: VisualGraphViewProps["onOpenDetail"];
  onCloseDetail: VisualGraphViewProps["onCloseDetail"];
  productOverlaysVisible: boolean;
}) {
  const graph = visibleDeclarationGraph(projection, productOverlaysVisible);
  const selectedDeclaration = selected?.plane === "declaration" ? selected : null;
  return (
    <div
      className="visual-graph__table-scroll"
      role="region"
      aria-label="Scrollable declaration topology table"
      tabIndex={0}
      data-visual-node-list
    >
      <table className="visual-graph__table">
        <caption>Accessible declaration topology table. Every relation is supplied by the server projection.</caption>
        <thead><tr><th>Declaration</th><th>Kind</th><th>Published reference</th><th>Exact incoming and outgoing relations</th></tr></thead>
        <tbody>
          {graph.nodes.map((node, index) => {
            const relations = graph.edges.filter((edge) => (
              edge.sourceNodeId === node.id || edge.targetNodeId === node.id
            ));
            const isSelected = selectedDeclaration?.id === node.id
              && selectedDeclaration.kind === node.kind;
            return (
              <tr key={node.id} className={isSelected ? "is-selected" : ""}>
                <td><button
                  type="button"
                  data-node-index={index}
                  data-visual-graph-node
                  data-visual-node-plane="declaration"
                  data-visual-node-id={node.id}
                  data-visual-node-kind={node.kind}
                  tabIndex={isSelected || (!selectedDeclaration && index === 0) ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-expanded={isSelected && state.detail.open}
                  aria-controls={isSelected && state.detail.open ? "visual-graph-declaration-detail-heading" : undefined}
                  onClick={() => onOpenDetail({ plane: "declaration", id: node.id, kind: node.kind })}
                  onKeyDown={(event) => handleNodeKeyDown(
                    event,
                    graph.nodes,
                    node,
                    (entry) => ({ plane: "declaration", id: entry.id, kind: entry.kind }),
                    state.detail.open,
                    onSelectNode,
                    onOpenDetail,
                    onCloseDetail,
                  )}
                >{node.label}</button><code>{node.id}</code></td>
                <td>{phrase(node.kind)}</td><td><code>{node.declarationRef}</code></td>
                <td>{relations.length === 0 ? "none published" : relations.map((edge) => (
                  <code key={edge.id}>
                    {relationRole(edge, node.id)} {phrase(edge.kind)} {relationPeer(edge, node.id)}
                  </code>
                ))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ExactFactValue = string | number | boolean | null;

function ExactFacts({ facts }: { facts: Array<readonly [string, ExactFactValue]> }) {
  return (
    <dl className="visual-graph__table-facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd><code>{value === null ? "not published" : String(value)}</code></dd>
        </div>
      ))}
    </dl>
  );
}

function workspaceSnapshotFacts(snapshot: WorkspaceObservation["predecessor"]) {
  return [
    ["Observation reference", snapshot.observationRef],
    ["Observation digest", snapshot.observationDigest],
    ["Subject reference", snapshot.subjectRef],
    ["Subject digest", snapshot.subjectDigest],
    ["Binding reference", snapshot.bindingRef],
    ["State", snapshot.state],
    ["Byte length", snapshot.byteLength],
    ["File digest", snapshot.fileDigest],
  ] as Array<readonly [string, ExactFactValue]>;
}

function WorkspaceObservationTable({ projection }: { projection: VisualGraphProjection }) {
  const observations = projection.workspaceObservations.observations;
  return (
    <div className="visual-graph__table-scroll" role="region" aria-label="Scrollable workspace observation table" tabIndex={0}>
      <table className="visual-graph__table visual-graph__table--supporting">
        <caption>
          Bounded mutable-workspace observation phases. Overall currentness: {phrase(projection.workspaceObservations.currentness)}
          {projection.limits.workspaceObservationsTruncated ? "; retained rows are truncated" : ""}.
        </caption>
        <thead><tr><th>Observation</th><th>Predecessor phase (O0)</th><th>Authorized receipt</th><th>Successor phase (O1)</th><th>Mutable currentness</th></tr></thead>
        <tbody>
          {observations.map((observation) => (
            <tr key={`${observation.ordinal}:${observation.sourceEvent?.eventId ?? "none"}`}>
              <td><ExactFacts facts={[
                ["Ordinal", observation.ordinal],
                ["Source event", observation.sourceEvent?.eventId ?? null],
                ["Source event ordinal", observation.sourceEvent?.ordinal ?? null],
                ["Source event kind", observation.sourceEvent?.kind ?? null],
              ]} /></td>
              <td><ExactFacts facts={workspaceSnapshotFacts(observation.predecessor)} /></td>
              <td><ExactFacts facts={[
                ["Receipt reference", observation.receipt.receiptRef],
                ["Receipt digest", observation.receipt.receiptDigest],
                ["Authorization reference", observation.receipt.authorizationRef],
                ["Authorization digest", observation.receipt.authorizationDigest],
                ["Before observation reference", observation.receipt.beforeObservationRef],
                ["Before observation digest", observation.receipt.beforeObservationDigest],
                ["After observation reference", observation.receipt.afterObservationRef],
                ["After observation digest", observation.receipt.afterObservationDigest],
                ["Written digest", observation.receipt.writtenDigest],
                ["Committed", observation.receipt.committed],
              ]} /></td>
              <td><ExactFacts facts={workspaceSnapshotFacts(observation.successor)} /></td>
              <td><ExactFacts facts={[
                ["State", observation.current.state],
                ["Posture", observation.current.posture],
                ["Byte length", observation.current.byteLength],
                ["Digest", observation.current.digest],
              ]} /></td>
            </tr>
          ))}
          {observations.length === 0 && <tr><td colSpan={5}>No workspace observation row is retained.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function publishedRefFacts(label: string, refs: string[]) {
  return refs.length === 0
    ? [[label, null] as const]
    : refs.map((ref, index) => [`${label} ${index + 1}`, ref] as const);
}

function actorSessionFacts(session: ActorSession) {
  return [
    ["Session", session.id],
    ["Actor invocation", session.actorInvocationId],
    ["Process aggregate", session.processAggregateId],
    ["Actor reference", session.actorRef],
  ] as Array<readonly [string, ExactFactValue]>;
}

function ActorSessionTable({ projection }: { projection: VisualGraphProjection }) {
  const sessions = projection.actorSessions.sessions;
  return (
    <div className="visual-graph__table-scroll" role="region" aria-label="Scrollable actor session table" tabIndex={0}>
      <table className="visual-graph__table visual-graph__table--supporting">
        <caption>
          Bounded actor-session relations. Interaction disposition: {phrase(projection.actorSessions.interactionDisposition)}
          {projection.limits.actorSessionsTruncated ? "; retained rows are truncated" : ""}.
        </caption>
        <thead><tr><th>Session identity</th><th>Lifecycle and terminal disposition</th><th>Published capabilities</th><th>Observed event range</th></tr></thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td><ExactFacts facts={actorSessionFacts(session)} /></td>
              <td><ExactFacts facts={[
                ["Lifecycle state", session.lifecycleState],
                ["Terminal disposition", session.terminalDisposition],
                ["Attach admitted", session.canAttach],
              ]} /></td>
              <td><ExactFacts facts={[
                ...publishedRefFacts("Capability reference", session.capabilityRefs),
                ...publishedRefFacts("Operation reference", session.operationRefs),
                ...publishedRefFacts("Archive reference", session.archiveRefs),
              ]} /></td>
              <td><ExactFacts facts={[
                ["First event", session.firstObserved.eventId],
                ["First ordinal", session.firstObserved.ordinal],
                ["First kind", session.firstObserved.kind],
                ["Last event", session.lastObserved.eventId],
                ["Last ordinal", session.lastObserved.ordinal],
                ["Last kind", session.lastObserved.kind],
              ]} /></td>
            </tr>
          ))}
          {sessions.length === 0 && <tr><td colSpan={4}>No actor-session relation is retained.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function VisualGraphView({
  state,
  onSelectNode,
  onPlaneChange,
  onModeChange,
  onZoomChange,
  onOverlayVisibilityChange,
  onOpenDetail,
  onCloseDetail,
  onDetailFocusRestored,
  onRetry,
}: VisualGraphViewProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!state.detail.open) return;
    rootRef.current?.querySelector<HTMLElement>("[data-visual-graph-detail=\"open\"]")?.focus();
  }, [state.detail.open, state.selectedNode?.id]);

  useEffect(() => {
    if (!state.detail.focusRestorePending || !state.detail.returnFocus) return;
    const target = rootRef.current
      ? focusButtonForSelection(rootRef.current, state.detail.returnFocus)
      : null;
    if (!target) return;
    target.focus();
    if (document.activeElement === target) {
      onDetailFocusRestored(state.detail.focusRestoreRequestId);
    }
  }, [
    onDetailFocusRestored,
    state.detail.focusRestorePending,
    state.detail.focusRestoreRequestId,
    state.detail.returnFocus,
  ]);

  if (state.status === "idle") return <div className="visual-graph__empty">Select an exact admitted run to load its visual projection.</div>;
  if (state.status === "loading" && !state.projection) {
    return <div className="visual-graph__empty" role="status" aria-live="polite" aria-busy="true">Loading the exact visual graph projection…</div>;
  }
  if (!state.projection) {
    return <div className="visual-graph__empty" role="status" aria-live="polite"><p>{state.error ?? "Visual graph projection is unavailable."}</p><button type="button" className="secondary" onClick={onRetry}>Retry visual projection</button></div>;
  }

  const projection = state.projection;
  const declarationAvailable = projection.declarationTopology.state === "ready"
    && projection.declarationTopology.nodes.length > 0;
  const activePlane: VisualGraphPlane = declarationAvailable && state.plane === "declaration"
    ? "declaration"
    : "occurrence";
  const declarationPrimary = activePlane === "declaration";
  const occurrenceSelection = selectedOccurrenceNode(projection, state.selectedNode);
  const visibleDeclaration = visibleDeclarationGraph(projection, state.overlayVisibility["product-overlays"]);
  const declarationSelectionCandidate = selectedDeclarationNode(projection, state.selectedNode);
  const declarationSelection = declarationSelectionCandidate
    && visibleDeclaration.nodes.some((node) => node.id === declarationSelectionCandidate.id)
    ? declarationSelectionCandidate
    : null;
  return (
    <section ref={rootRef} className="visual-graph" aria-labelledby="visual-graph-heading" aria-busy={state.status === "loading"}>
      {state.status === "loading" && state.refreshSource === "run_observation" && (
        <div className="visual-graph__refresh-status" data-refresh-source="run-observation" role="status" aria-live="polite" aria-atomic="true">
          <span>Refreshing the upstream run observation. The retained projection remains interactive and stale until a new exact event generation is admitted.</span>
          <code>retained {projection.run?.eventGeneration ?? "unknown"} · requested generation not yet admitted</code>
        </div>
      )}
      {state.status === "loading" && state.refreshSource !== "run_observation" && (
        <div className="visual-graph__refresh-status" data-refresh-source="projection" role="status" aria-live="polite" aria-atomic="true">
          <span>Refreshing the requested visual projection. The retained projection remains visible and is stale until that exact basis is admitted.</span>
          <code>retained {projection.run?.eventGeneration ?? "unknown"} · requested {state.basis?.generation ?? "unknown"}</code>
        </div>
      )}
      {state.status === "error" && state.refreshSource === "run_observation" && (
        <div className="visual-graph__refresh-status visual-graph__refresh-status--error" data-refresh-source="run-observation" role="status" aria-live="polite" aria-atomic="true">
          <span>Run observation refresh failed. The retained projection remains interactive as stale evidence; no requested event generation was admitted.</span>
          <code>retained {projection.run?.eventGeneration ?? "unknown"} · requested generation not admitted</code>
          <code>{state.error ?? "Run observation refresh failed."}</code>
          <button type="button" className="secondary" onClick={onRetry}>Retry run observation</button>
        </div>
      )}
      {state.status === "error" && state.refreshSource !== "run_observation" && (
        <div className="visual-graph__refresh-status visual-graph__refresh-status--error" data-refresh-source="projection" role="status" aria-live="polite" aria-atomic="true">
          <span>Refresh failed. The retained projection remains visible as stale evidence and is not current for the requested basis.</span>
          <code>retained {projection.run?.eventGeneration ?? "unknown"} · requested {state.basis?.generation ?? "unknown"}</code>
          <code>{state.error ?? "Visual graph projection refresh failed."}</code>
          <button type="button" className="secondary" onClick={onRetry}>Retry visual projection</button>
        </div>
      )}
      <header className="visual-graph__header">
        <div>
          <span>{declarationPrimary ? "Published declaration projection" : "Immutable runtime occurrence projection"}</span>
          <h3 id="visual-graph-heading">{declarationPrimary ? "Declared topology" : "Occurrence history"}</h3>
          <code>{projection.run?.runId}</code>
        </div>
        <div className="visual-graph__toolbar" aria-label="Visual graph controls">
          <div className="visual-graph__mode" role="group" aria-label="Graph truth plane">
            <button type="button" disabled={!declarationAvailable} aria-pressed={activePlane === "declaration"} onClick={() => onPlaneChange("declaration")}>Declaration</button>
            <button type="button" aria-pressed={activePlane === "occurrence"} onClick={() => onPlaneChange("occurrence")}>Occurrence history</button>
          </div>
          <div className="visual-graph__mode" role="group" aria-label="Graph representation">
            <button type="button" aria-pressed={state.mode === "spatial"} onClick={() => onModeChange("spatial")}>Spatial</button>
            <button type="button" aria-pressed={state.mode === "table"} onClick={() => onModeChange("table")}>Table</button>
          </div>
          <div className="visual-graph__zoom" role="group" aria-label="Graph zoom">
            <button type="button" aria-label="Zoom out" onClick={() => onZoomChange(state.zoom - 0.15)}>−</button>
            <output aria-label="Current graph zoom">{Math.round(state.zoom * 100)}%</output>
            <button type="button" aria-label="Zoom in" onClick={() => onZoomChange(state.zoom + 0.15)}>+</button>
            <button type="button" onClick={() => onZoomChange(1)}>Reset</button>
          </div>
        </div>
      </header>
      <RunContractTraceability projection={projection} />
      <PlaneLegend projection={projection} />
      {declarationAvailable && (
        <div className="visual-graph__warning" role="status">Declaration and occurrence remain separate truth planes: no declaration-to-occurrence join is admitted, so product overlays cannot decorate runtime occurrence nodes.</div>
      )}
      <div className="visual-graph__toggles" aria-label="Graph supporting-plane visibility">
        {([
          ["declaration", "Declaration status"],
          ["product-overlays", "Product overlay layer"],
          ["workspace", "Workspace observations"],
          ["actor-sessions", "Actor sessions"],
        ] as const).map(([overlay, label]) => (
          <label key={overlay}><input type="checkbox" checked={state.overlayVisibility[overlay]} onChange={(event) => onOverlayVisibilityChange(overlay, event.target.checked)} />{label}</label>
        ))}
      </div>
      {state.overlayVisibility.declaration && <DeclarationStatus projection={projection} />}
      {projection.limits.nodesTruncated || projection.limits.edgesTruncated ? <div className="visual-graph__warning" role="status">The bounded projection is truncated; omitted nodes or edges are not inferred.</div> : null}
      {declarationPrimary
        ? state.mode === "spatial"
          ? <DeclarationSpatialGraph projection={projection} state={state} onSelectNode={onSelectNode} onOpenDetail={onOpenDetail} onCloseDetail={onCloseDetail} />
          : <><AccessibleDeclarationGraphTable projection={projection} state={state} selected={state.selectedNode} onSelectNode={onSelectNode} onOpenDetail={onOpenDetail} onCloseDetail={onCloseDetail} productOverlaysVisible={state.overlayVisibility["product-overlays"]} /><DeclarationNodeDetail node={declarationSelection} edges={visibleDeclaration.edges} open={state.detail.open} onClose={onCloseDetail} /></>
        : state.mode === "spatial"
          ? <SpatialGraph projection={projection} state={state} onSelectNode={onSelectNode} onOpenDetail={onOpenDetail} onCloseDetail={onCloseDetail} />
          : <><AccessibleOccurrenceGraphTable projection={projection} state={state} selected={state.selectedNode} onSelectNode={onSelectNode} onOpenDetail={onOpenDetail} onCloseDetail={onCloseDetail} /><OccurrenceNodeDetail projection={projection} node={occurrenceSelection} open={state.detail.open} onClose={onCloseDetail} /></>}
      {state.mode === "table" && state.overlayVisibility.workspace && <WorkspaceObservationTable projection={projection} />}
      {state.mode === "table" && state.overlayVisibility["actor-sessions"] && <ActorSessionTable projection={projection} />}
      {state.overlayVisibility.workspace && <WorkspaceStatus projection={projection} />}
      {state.overlayVisibility["actor-sessions"] && <ActorSessionStatus projection={projection} />}
      {projection.diagnostics.length > 0 && (
        <details className="visual-graph__diagnostics"><summary>{projection.diagnostics.length} bounded projection diagnostic{projection.diagnostics.length === 1 ? "" : "s"}</summary><ul>{projection.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}:${index}`} data-severity={diagnostic.severity}><code>{diagnostic.code}</code><span>{diagnostic.message}</span></li>)}</ul></details>
      )}
    </section>
  );
}
