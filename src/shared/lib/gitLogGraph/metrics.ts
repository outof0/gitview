import { GIT_LOG_GRAPH_ROW_HEIGHT } from "./geometry";
import { buildGraphCanvasPrimitives } from "./print";
import type { GitLogGraphLayout, GraphLayoutMetrics, PermanentGraph } from "./types";

export function measureGraphLayout(
  layout: GitLogGraphLayout,
  graph?: PermanentGraph,
): GraphLayoutMetrics {
  const rowCount = Math.max(
    1,
    Math.round(layout.height / GIT_LOG_GRAPH_ROW_HEIGHT),
  );
  const { lines } = buildGraphCanvasPrimitives(layout, 0, rowCount);
  let crossingCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const a = lines[i]!;
    for (let j = i + 1; j < lines.length; j += 1) {
      const b = lines[j]!;
      if (segmentsCross(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2)) {
        crossingCount += 1;
      }
    }
  }

  let bendCount = 0;
  let totalHorizontalTravel = 0;
  for (const line of lines) {
    const dx = Math.abs(line.x2 - line.x1);
    totalHorizontalTravel += dx;
    if (dx > 0) {
      bendCount += 1;
    }
  }

  let laneChangeCount = 0;
  if (graph) {
    for (const transition of layout.transitions) {
      const nodeIndex = graph.indexBySha.get(transition.sha);
      if (nodeIndex === undefined) {
        continue;
      }
      const firstParent = graph.parents[nodeIndex]?.[0];
      if (firstParent === undefined || firstParent < 0) {
        continue;
      }
      const parentSha = graph.shas[firstParent]!;
      const parentLane = layout.laneBySha.get(parentSha);
      if (parentLane !== undefined && parentLane !== transition.lane) {
        laneChangeCount += 1;
      }
    }
  }

  return {
    crossingCount,
    bendCount,
    laneChangeCount,
    maxLaneCount: layout.maxLane + 1,
    totalHorizontalTravel,
  };
}

function segmentsCross(
  ax1: number,
  ay1: number,
  ax2: number,
  ay2: number,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
): boolean {
  const d1 = direction(bx1, by1, bx2, by2, ax1, ay1);
  const d2 = direction(bx1, by1, bx2, by2, ax2, ay2);
  const d3 = direction(ax1, ay1, ax2, ay2, bx1, by1);
  const d4 = direction(ax1, ay1, ax2, ay2, bx2, by2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function direction(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): number {
  return (x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1);
}

export function isGitAncestor(
  childSha: string,
  ancestorSha: string,
  parentShasBySha: ReadonlyMap<string, readonly string[]>,
): boolean {
  const queue = [...(parentShasBySha.get(childSha) ?? [])];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const sha = queue.shift()!;
    if (seen.has(sha)) {
      continue;
    }
    seen.add(sha);
    if (sha === ancestorSha) {
      return true;
    }
    const parents = parentShasBySha.get(sha);
    if (parents) {
      for (const parent of parents) {
        queue.push(parent);
      }
    }
  }
  return false;
}

export function printEdgesMatchDag(
  layout: GitLogGraphLayout,
  parentShasBySha: ReadonlyMap<string, readonly string[]>,
): boolean {
  for (const edge of layout.edges) {
    if (!isGitAncestor(edge.childSha, edge.parentSha, parentShasBySha)) {
      return false;
    }
  }
  return true;
}
