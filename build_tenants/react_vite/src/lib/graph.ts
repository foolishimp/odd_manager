import type { GraphNodeView, GraphSegmentView, GraphView, Tone } from "./types";

const LAYER_GAP = 230;
const ROW_GAP = 128;
const PADDING_X = 160;
const PADDING_Y = 120;

export type PositionedGraphNode = GraphNodeView & {
  x: number;
  y: number;
};

export type GraphLayout = {
  width: number;
  height: number;
  nodes: PositionedGraphNode[];
  segments: GraphSegmentView[];
};

function kindRank(node: GraphNodeView): number {
  const order: Record<GraphNodeView["kind"], number> = {
    asset_node: 0,
    catalog: 1,
    governance: 2,
    function: 3,
  };
  return order[node.kind] ?? 4;
}

export function combineTone(...tones: Array<Tone | undefined>): Tone {
  const order: Tone[] = ["blocked", "gated", "active", "pending", "attention", "converged"];
  for (const tone of order) {
    if (tones.includes(tone)) {
      return tone;
    }
  }
  return "pending";
}

export function buildGraphLayout(graph: GraphView): GraphLayout {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const incomingCounts = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();

  for (const segment of graph.segments) {
    incomingCounts.set(segment.to, (incomingCounts.get(segment.to) ?? 0) + 1);
    const next = outgoing.get(segment.from) ?? [];
    next.push(segment.to);
    outgoing.set(segment.from, next);
  }

  const frontier = graph.nodes
    .filter((node) => (incomingCounts.get(node.id) ?? 0) === 0)
    .sort((left, right) => {
      const kindDiff = kindRank(left) - kindRank(right);
      return kindDiff !== 0 ? kindDiff : left.label.localeCompare(right.label);
    })
    .map((node) => node.id);

  const layerById = new Map<string, number>();
  for (const node of graph.nodes) {
    layerById.set(node.id, 0);
  }

  const queue = [...frontier];
  const seen = new Set<string>();
  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    seen.add(current);
    const currentLayer = layerById.get(current) ?? 0;
    for (const nextId of outgoing.get(current) ?? []) {
      const nextLayer = Math.max(layerById.get(nextId) ?? 0, currentLayer + 1);
      layerById.set(nextId, nextLayer);
      incomingCounts.set(nextId, Math.max((incomingCounts.get(nextId) ?? 1) - 1, 0));
      if ((incomingCounts.get(nextId) ?? 0) === 0) {
        queue.push(nextId);
      }
    }
  }

  const layers = new Map<number, GraphNodeView[]>();
  for (const node of graph.nodes) {
    const layer = layerById.get(node.id) ?? 0;
    const bucket = layers.get(layer) ?? [];
    bucket.push(node);
    layers.set(layer, bucket);
  }

  const layerCount = Math.max(layers.size, 1);
  const maxBucketSize = Math.max(
    1,
    ...[...layers.values()].map((bucket) => bucket.length),
  );
  const rowGap = resolveRowGap(layerCount, maxBucketSize);

  let maxY = PADDING_Y;
  let maxX = PADDING_X;
  const positioned: PositionedGraphNode[] = [];
  for (const [layer, bucket] of [...layers.entries()].sort((left, right) => left[0] - right[0])) {
    bucket.sort((left, right) => {
      const kindDiff = kindRank(left) - kindRank(right);
      return kindDiff !== 0 ? kindDiff : left.label.localeCompare(right.label);
    });
    bucket.forEach((node, index) => {
      const x = PADDING_X + layer * LAYER_GAP;
      const y = PADDING_Y + index * rowGap;
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      positioned.push({
        ...node,
        x,
        y,
      });
    });
  }

  return {
    width: maxX + PADDING_X,
    height: maxY + PADDING_Y,
    nodes: positioned.sort((left, right) => left.x - right.x || left.y - right.y),
    segments: graph.segments.filter(
      (segment) => nodesById.has(segment.from) && nodesById.has(segment.to),
    ),
  };
}

function resolveRowGap(layerCount: number, maxBucketSize: number) {
  if (layerCount <= 2) {
    return maxBucketSize <= 10 ? 164 : 152;
  }
  if (layerCount === 3) {
    return maxBucketSize <= 10 ? 148 : 138;
  }
  return ROW_GAP;
}
