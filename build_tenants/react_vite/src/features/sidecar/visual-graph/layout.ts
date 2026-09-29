import type { VisualGraphProjection } from "@odd-manager/developer-control-contracts";

type OccurrenceNode = VisualGraphProjection["occurrenceGraph"]["nodes"][number];
type OccurrenceEdge = VisualGraphProjection["occurrenceGraph"]["edges"][number];
type DeclarationNode = VisualGraphProjection["declarationTopology"]["nodes"][number];
type DeclarationEdge = VisualGraphProjection["declarationTopology"]["edges"][number];

type ExactNode = { id: string };
type ExactEdge = { sourceNodeId: string; targetNodeId: string };

export type PositionedNode<Node extends ExactNode> = {
  node: Node;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PositionedEdge<Node extends ExactNode, Edge extends ExactEdge> = {
  edge: Edge;
  source: PositionedNode<Node>;
  target: PositionedNode<Node>;
};

export type ExactGraphLayout<Node extends ExactNode, Edge extends ExactEdge> = {
  width: number;
  height: number;
  nodes: PositionedNode<Node>[];
  edges: PositionedEdge<Node, Edge>[];
};

export type OccurrenceGraphLayout = ExactGraphLayout<OccurrenceNode, OccurrenceEdge>;
export type DeclarationGraphLayout = ExactGraphLayout<DeclarationNode, DeclarationEdge>;

const BASE_NODE_WIDTH = 210;
const BASE_NODE_HEIGHT = 88;
const BASE_COLUMN_GAP = 96;
const BASE_ROW_GAP = 42;
const BASE_PADDING = 54;

function occurrenceOrder(left: OccurrenceNode, right: OccurrenceNode) {
  return left.firstObserved.ordinal - right.firstObserved.ordinal || left.id.localeCompare(right.id);
}

function declarationOrder(left: DeclarationNode, right: DeclarationNode) {
  return left.kind.localeCompare(right.kind)
    || left.label.localeCompare(right.label)
    || left.id.localeCompare(right.id);
}

/**
 * Derives presentation coordinates from only the exact retained edges. It does
 * not synthesize a relation for disconnected or cyclic nodes. Exact cycles are
 * condensed for ranking, then their members are spread compactly so recursion
 * remains spatial while every published edge remains exact.
 */
function layoutExactGraph<Node extends ExactNode, Edge extends ExactEdge>(
  nodes: Node[],
  edges: Edge[],
  zoom: number,
  order: (left: Node, right: Node) => number,
  ranks: (edge: Edge) => boolean,
): ExactGraphLayout<Node, Edge> {
  if (nodes.length === 0) {
    return { width: 0, height: 0, nodes: [], edges: [] };
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const orderedNodes = [...nodes].sort(order);
  // Ranking is a presentation concern over an explicit structural subset.
  // Every supplied edge remains in positionedEdges below and is rendered.
  const rankingEdges = edges.filter((candidate) => (
    candidate.sourceNodeId !== candidate.targetNodeId && ranks(candidate)
    && byId.has(candidate.sourceNodeId) && byId.has(candidate.targetNodeId)
  ));
  const adjacency = new Map(orderedNodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of rankingEdges) {
    adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
  }

  // Tarjan SCC condensation keeps declared recursion exact while producing an
  // acyclic presentation graph. Component membership is derived solely from
  // the admitted ranking edges; it is not serialized or treated as a relation.
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const nodeIdOrder = (leftId: string, rightId: string) => order(byId.get(leftId)!, byId.get(rightId)!);
  const visit = (nodeId: string) => {
    indexes.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const targetId of [...(adjacency.get(nodeId) ?? [])].sort(nodeIdOrder)) {
      if (!indexes.has(targetId)) {
        visit(targetId);
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, lowLinks.get(targetId)!));
      } else if (onStack.has(targetId)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId)!, indexes.get(targetId)!));
      }
    }

    if (lowLinks.get(nodeId) !== indexes.get(nodeId)) return;
    const component: string[] = [];
    let memberId: string | undefined;
    do {
      memberId = stack.pop();
      if (memberId === undefined) break;
      onStack.delete(memberId);
      component.push(memberId);
    } while (memberId !== nodeId);
    components.push(component.sort(nodeIdOrder));
  };
  for (const node of orderedNodes) {
    if (!indexes.has(node.id)) visit(node.id);
  }
  components.sort((left, right) => nodeIdOrder(left[0], right[0]));

  const componentByNodeId = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    component.forEach((nodeId) => componentByNodeId.set(nodeId, componentIndex));
  });
  const componentOutgoing = new Map(components.map((_, index) => [index, new Set<number>()]));
  const componentIndegree = new Map(components.map((_, index) => [index, 0]));
  for (const edge of rankingEdges) {
    const sourceComponent = componentByNodeId.get(edge.sourceNodeId);
    const targetComponent = componentByNodeId.get(edge.targetNodeId);
    if (sourceComponent === undefined || targetComponent === undefined || sourceComponent === targetComponent) continue;
    const outgoing = componentOutgoing.get(sourceComponent)!;
    if (outgoing.has(targetComponent)) continue;
    outgoing.add(targetComponent);
    componentIndegree.set(targetComponent, (componentIndegree.get(targetComponent) ?? 0) + 1);
  }

  const componentOrder = (left: number, right: number) => nodeIdOrder(components[left][0], components[right][0]);
  const componentSpan = new Map(components.map((component, index) => [
    index,
    Math.max(1, Math.ceil(Math.sqrt(component.length))),
  ]));
  const componentDepth = new Map(components.map((_, index) => [index, 0]));
  const queue = [...componentIndegree.entries()]
    .filter(([, indegree]) => indegree === 0)
    .map(([index]) => index)
    .sort(componentOrder);
  const visitedComponents = new Set<number>();
  while (queue.length > 0) {
    const componentIndex = queue.shift();
    if (componentIndex === undefined || visitedComponents.has(componentIndex)) continue;
    visitedComponents.add(componentIndex);
    for (const targetIndex of [...(componentOutgoing.get(componentIndex) ?? [])].sort(componentOrder)) {
      componentDepth.set(targetIndex, Math.max(
        componentDepth.get(targetIndex) ?? 0,
        (componentDepth.get(componentIndex) ?? 0) + (componentSpan.get(componentIndex) ?? 1),
      ));
      componentIndegree.set(targetIndex, (componentIndegree.get(targetIndex) ?? 1) - 1);
      if (componentIndegree.get(targetIndex) === 0) {
        queue.push(targetIndex);
        queue.sort(componentOrder);
      }
    }
  }

  const depth = new Map<string, number>();
  components.forEach((component, componentIndex) => {
    const baseDepth = componentDepth.get(componentIndex) ?? 0;
    const span = componentSpan.get(componentIndex) ?? 1;
    component.forEach((nodeId, memberIndex) => {
      depth.set(nodeId, baseDepth + (memberIndex % span));
    });
  });
  // Condensation is a DAG, so every component must be visited. Retain a
  // deterministic safe placement if that invariant is ever broken internally.
  let fallbackDepth = Math.max(0, ...depth.values()) + 1;
  for (const [componentIndex, component] of components.entries()) {
    if (visitedComponents.has(componentIndex)) continue;
    const span = componentSpan.get(componentIndex) ?? 1;
    component.forEach((nodeId, memberIndex) => depth.set(nodeId, fallbackDepth + (memberIndex % span)));
    fallbackDepth += span;
  }

  const columns = new Map<number, Node[]>();
  for (const node of [...nodes].sort(order)) {
    const column = depth.get(node.id) ?? 0;
    columns.set(column, [...(columns.get(column) ?? []), node]);
  }

  const nodeWidth = BASE_NODE_WIDTH * zoom;
  const nodeHeight = BASE_NODE_HEIGHT * zoom;
  const columnGap = BASE_COLUMN_GAP * zoom;
  const rowGap = BASE_ROW_GAP * zoom;
  const padding = BASE_PADDING * zoom;
  const positioned: PositionedNode<Node>[] = [];
  for (const [column, entries] of [...columns].sort(([left], [right]) => left - right)) {
    entries.forEach((node, row) => {
      positioned.push({
        node,
        x: padding + column * (nodeWidth + columnGap),
        y: padding + row * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
      });
    });
  }

  const positionedById = new Map(positioned.map((entry) => [entry.node.id, entry]));
  const positionedEdges = edges.flatMap((edge) => {
    const source = positionedById.get(edge.sourceNodeId);
    const target = positionedById.get(edge.targetNodeId);
    return source && target ? [{ edge, source, target }] : [];
  });
  const maxColumn = Math.max(...[...columns.keys()]);
  const maxRows = Math.max(...[...columns.values()].map((entries) => entries.length));

  return {
    width: padding * 2 + (maxColumn + 1) * nodeWidth + maxColumn * columnGap,
    height: padding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap,
    nodes: positioned,
    edges: positionedEdges,
  };
}

export function layoutOccurrenceGraph(
  nodes: OccurrenceNode[],
  edges: OccurrenceEdge[],
  zoom: number,
): OccurrenceGraphLayout {
  return layoutExactGraph(
    nodes,
    edges,
    zoom,
    occurrenceOrder,
    (edge) => edge.kind === "aggregate_parent",
  );
}

export function layoutDeclarationGraph(
  nodes: DeclarationNode[],
  edges: DeclarationEdge[],
  zoom: number,
): DeclarationGraphLayout {
  return layoutExactGraph(nodes, edges, zoom, declarationOrder, () => true);
}
