import {
  compareGraphElements,
  type PrintGraphElement,
} from "./comparator";
import {
  GIT_LOG_GRAPH_ATTACH_ROWS,
  GIT_LOG_GRAPH_LANE_PAD,
  GIT_LOG_GRAPH_LANE_WIDTH,
  GIT_LOG_GRAPH_LONG_EDGE_ROWS,
  GIT_LOG_GRAPH_ROW_HEIGHT,
} from "./geometry";
import type {
  GitLogGraphArrow,
  GitLogGraphDot,
  GitLogGraphEdge,
  GitLogGraphLayout,
  GitLogGraphLine,
  GitLogGraphTransition,
  GraphHit,
} from "./types";

type RowItem =
  | { kind: "node"; transition: GitLogGraphTransition; element: PrintGraphElement }
  | { kind: "edge"; edge: GitLogGraphEdge; element: PrintGraphElement }
  | {
      kind: "bundle";
      parentSha: string;
      edges: GitLogGraphEdge[];
      element: PrintGraphElement;
    };

function upperBound(rows: readonly number[], value: number): number {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (rows[mid]! <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function lowerBound(rows: readonly number[], value: number): number {
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (rows[mid]! < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function isEdgeVisible(up: number, down: number, row: number): boolean {
  return (
    down - up < GIT_LOG_GRAPH_LONG_EDGE_ROWS ||
    row - up <= GIT_LOG_GRAPH_ATTACH_ROWS ||
    down - row <= GIT_LOG_GRAPH_ATTACH_ROWS
  );
}

function isLongEdge(up: number, down: number): boolean {
  return down - up >= GIT_LOG_GRAPH_LONG_EDGE_ROWS;
}

function edgePrintElement(edge: GitLogGraphEdge): PrintGraphElement {
  return {
    kind: "edge",
    up: edge.upIndex < 0 ? edge.childRow : edge.upIndex,
    down: edge.downIndex,
  };
}

function collectRowItems(
  row: number,
  transition: GitLogGraphTransition | undefined,
  transitionDisplayRow: number | undefined,
  candidates: Iterable<GitLogGraphEdge>,
  displayRowOf: (commitRow: number) => number,
): RowItem[] {
  const items: RowItem[] = [];
  const parentBundles = new Map<string, GitLogGraphEdge[]>();
  if (transition && transitionDisplayRow === row) {
    items.push({
      kind: "node",
      transition,
      element: { kind: "node", nodeIndex: transition.nodeIndex },
    });
  }
  for (const edge of candidates) {
    const up = displayRowOf(edge.childRow);
    if (edge.downRow === undefined) {
      continue;
    }
    const down = displayRowOf(edge.downRow);
    if (!(down > up && up < row && row < down && isEdgeVisible(up, down, row))) {
      continue;
    }
    if (isLongEdge(up, down) && row === down - 1) {
      const group = parentBundles.get(edge.parentSha) ?? [];
      group.push(edge);
      parentBundles.set(edge.parentSha, group);
      continue;
    }
    items.push({ kind: "edge", edge, element: edgePrintElement(edge) });
  }
  const bundleParents = [...parentBundles.keys()].sort();
  for (const parentSha of bundleParents) {
    const edges = parentBundles.get(parentSha)!;
    edges.sort((left, right) => left.id - right.id);
    if (edges.length === 1) {
      items.push({
        kind: "edge",
        edge: edges[0]!,
        element: edgePrintElement(edges[0]!),
      });
      continue;
    }
    const parentIndex = edges[0]!.downIndex;
    items.push({
      kind: "bundle",
      parentSha,
      edges,
      element: { kind: "bundle", nodeIndex: parentIndex },
    });
  }
  return items;
}

/**
 * Compact unused columns per row using IntelliJ's element comparator.
 * Long edges that share a visible parent collapse to one terminal at the
 * parent attachment; topology/edge ids stay intact.
 */
export function buildGraphCanvasPrimitives(
  layout: GitLogGraphLayout,
  startRow: number,
  endRow: number,
): {
  lines: GitLogGraphLine[];
  arrows: GitLogGraphArrow[];
  dots: GitLogGraphDot[];
} {
  const { transitions, visibleRows, edgesByChildRow, edgesByDownRow } = layout;
  const displayRowCount = Math.max(
    1,
    Math.round(layout.height / GIT_LOG_GRAPH_ROW_HEIGHT),
  );
  const first = Math.max(0, startRow);
  const last = Math.min(displayRowCount, endRow);
  if (transitions.length === 0 || last <= first) {
    return { lines: [], arrows: [], dots: [] };
  }

  const displayRowOf = (commitRow: number): number =>
    visibleRows[commitRow] ?? commitRow;

  const scanFromCommit = lowerBound(
    visibleRows,
    first - GIT_LOG_GRAPH_LONG_EDGE_ROWS - 1,
  );
  const scanToCommit = upperBound(visibleRows, last);
  const candidates = new Map<number, GitLogGraphEdge>();
  for (let index = scanFromCommit; index < scanToCommit; index += 1) {
    const transition = transitions[index];
    if (!transition) {
      continue;
    }
    const created = edgesByChildRow.get(transition.row);
    if (created) {
      for (const edge of created) {
        candidates.set(edge.id, edge);
      }
    }
    const ended = edgesByDownRow.get(transition.row);
    if (ended) {
      for (const edge of ended) {
        candidates.set(edge.id, edge);
      }
    }
  }

  const layoutIndexByNode = new Map<number, number>();
  for (const transition of transitions) {
    if (transition.nodeIndex >= 0) {
      layoutIndexByNode.set(transition.nodeIndex, transition.layoutIndex);
    }
  }
  for (const edge of candidates.values()) {
    if (edge.upIndex >= 0) {
      layoutIndexByNode.set(edge.upIndex, edge.upLayoutIndex);
    }
    if (edge.downIndex >= 0) {
      layoutIndexByNode.set(edge.downIndex, edge.downLayoutIndex);
    }
  }
  const layoutIndexOf = (nodeIndex: number) =>
    layoutIndexByNode.get(nodeIndex) ?? 0;

  const activeIndexForRow = (row: number): number | undefined => {
    const index = upperBound(visibleRows, row) - 1;
    return index >= 0 ? index : undefined;
  };

  const itemsByRow = new Map<number, RowItem[]>();
  const nodePosByRow = new Map<number, number>();
  const edgePosByRow = new Map<number, Map<number, number>>();
  const bundlePosByRow = new Map<number, Map<string, number>>();

  for (let row = Math.max(0, first - 1); row <= last; row += 1) {
    const index = activeIndexForRow(row);
    const transition = index === undefined ? undefined : transitions[index];
    const items = collectRowItems(
      row,
      transition,
      index === undefined ? undefined : visibleRows[index],
      candidates.values(),
      displayRowOf,
    );
    items.sort((left, right) =>
      compareGraphElements(left.element, right.element, layoutIndexOf),
    );
    itemsByRow.set(row, items);
    const edgePos = new Map<number, number>();
    const bundlePos = new Map<string, number>();
    let nodePos = -1;
    items.forEach((item, position) => {
      if (item.kind === "node") {
        nodePos = position;
      } else if (item.kind === "edge") {
        edgePos.set(item.edge.id, position);
      } else {
        bundlePos.set(item.parentSha, position);
        for (const edge of item.edges) {
          edgePos.set(edge.id, position);
        }
      }
    });
    nodePosByRow.set(row, nodePos);
    edgePosByRow.set(row, edgePos);
    bundlePosByRow.set(row, bundlePos);
  }

  const laneX = (position: number) =>
    GIT_LOG_GRAPH_LANE_PAD +
    position * GIT_LOG_GRAPH_LANE_WIDTH +
    GIT_LOG_GRAPH_LANE_WIDTH / 2;
  const centerY = (row: number) =>
    row * GIT_LOG_GRAPH_ROW_HEIGHT + GIT_LOG_GRAPH_ROW_HEIGHT / 2;

  const edgePositionAt = (edge: GitLogGraphEdge, row: number): number | null => {
    const up = displayRowOf(edge.childRow);
    const down =
      edge.downRow === undefined ? undefined : displayRowOf(edge.downRow);
    if (row === up || (down !== undefined && row === down)) {
      const nodePos = nodePosByRow.get(row) ?? -1;
      return nodePos >= 0 ? laneX(nodePos) : null;
    }
    const position = edgePosByRow.get(row)?.get(edge.id);
    return position === undefined ? null : laneX(position);
  };

  const lines: GitLogGraphLine[] = [];
  const arrows: GitLogGraphArrow[] = [];
  const dots: GitLogGraphDot[] = [];
  const seenLines = new Set<string>();
  const seenArrows = new Set<string>();
  const pushLine = (line: GitLogGraphLine): void => {
    const key = `${line.x1}:${line.y1}:${line.x2}:${line.y2}:${line.lane}:${line.edgeIds.join(",")}`;
    if (seenLines.has(key)) {
      return;
    }
    seenLines.add(key);
    lines.push(line);
  };
  const pushArrow = (arrow: GitLogGraphArrow): void => {
    const key = `${arrow.x}:${arrow.y}:${arrow.direction}:${arrow.lane}:${arrow.edgeIds.join(",")}`;
    if (seenArrows.has(key)) {
      return;
    }
    seenArrows.add(key);
    arrows.push(arrow);
  };

  for (let row = Math.max(0, first); row < last; row += 1) {
    const index = activeIndexForRow(row);
    if (index === undefined) {
      continue;
    }
    const transition = transitions[index]!;
    if (visibleRows[index] !== row) {
      continue;
    }
    const nodePos = nodePosByRow.get(row) ?? -1;
    if (nodePos >= 0) {
      dots.push({
        x: laneX(nodePos),
        y: centerY(row),
        lane: transition.colorLane,
        isMerge: transition.parents.length > 1,
        sha: transition.sha,
      });
    }
  }

  const bundledParentAt = (row: number, parentSha: string): boolean =>
    (bundlePosByRow.get(row)?.get(parentSha) ?? -1) >= 0;

  for (const edge of candidates.values()) {
    const up = displayRowOf(edge.childRow);
    const colorLane = layout.colorLaneBySha.get(edge.childSha)
      ?? layout.colorLaneBySha.get(edge.parentSha)
      ?? 0;
    if (edge.downRow === undefined) {
      const nodePos = nodePosByRow.get(up) ?? -1;
      if (nodePos < 0) {
        continue;
      }
      pushArrow({
        x: laneX(nodePos),
        y: centerY(up),
        direction: "down",
        lane: colorLane,
        fromSha: edge.childSha,
        toSha: edge.parentSha,
        fromShas: [edge.childSha],
        edgeIds: [edge.id],
      });
      continue;
    }
    const down = displayRowOf(edge.downRow);
    const firstSegment = Math.max(first, up);
    const lastSegment = Math.min(last - 1, down - 1);
    const skipParentTrunk =
      isLongEdge(up, down) && bundledParentAt(down - 1, edge.parentSha);
    for (let row = firstSegment; row <= lastSegment; row += 1) {
      if (skipParentTrunk && row === down - 1) {
        continue;
      }
      const x1 = edgePositionAt(edge, row);
      const x2 = edgePositionAt(edge, row + 1);
      if (x1 === null || x2 === null) {
        continue;
      }
      pushLine({
        x1,
        y1: centerY(row),
        x2,
        y2: centerY(row + 1),
        lane: colorLane,
        fromSha: edge.childSha,
        toSha: edge.parentSha,
        fromShas: [edge.childSha],
        edgeIds: [edge.id],
      });
    }
    if (isLongEdge(up, down)) {
      if (up + 1 >= first && up + 1 <= last) {
        const x = edgePositionAt(edge, up + 1);
        if (x !== null) {
          pushArrow({
            x,
            y: centerY(up + 1),
            direction: "down",
            lane: colorLane,
            fromSha: edge.childSha,
            toSha: edge.parentSha,
            fromShas: [edge.childSha],
            edgeIds: [edge.id],
          });
        }
      }
      if (
        down - 1 >= first &&
        down - 1 <= last &&
        !bundledParentAt(down - 1, edge.parentSha)
      ) {
        const x = edgePositionAt(edge, down - 1);
        if (x !== null) {
          pushArrow({
            x,
            y: centerY(down - 1),
            direction: "up",
            lane: colorLane,
            fromSha: edge.childSha,
            toSha: edge.parentSha,
            fromShas: [edge.childSha],
            edgeIds: [edge.id],
          });
        }
      }
    }
  }

  for (let row = Math.max(0, first); row <= last; row += 1) {
    const items = itemsByRow.get(row);
    if (!items) {
      continue;
    }
    for (const item of items) {
      if (item.kind !== "bundle") {
        continue;
      }
      const parentPos = bundlePosByRow.get(row)?.get(item.parentSha);
      if (parentPos === undefined) {
        continue;
      }
      const parentRow = displayRowOf(item.edges[0]!.downRow!);
      const nodePos = nodePosByRow.get(parentRow) ?? -1;
      const colorLane = layout.colorLaneBySha.get(item.parentSha)
        ?? layout.colorLaneBySha.get(item.edges[0]!.childSha)
        ?? 0;
      const edgeIds = item.edges.map((edge) => edge.id);
      const fromShas = item.edges.map((edge) => edge.childSha);
      if (nodePos >= 0 && row + 1 === parentRow) {
        pushLine({
          x1: laneX(parentPos),
          y1: centerY(row),
          x2: laneX(nodePos),
          y2: centerY(parentRow),
          lane: colorLane,
          fromSha: fromShas[0]!,
          toSha: item.parentSha,
          fromShas,
          edgeIds,
        });
      }
      if (row >= first && row <= last) {
        pushArrow({
          x: laneX(parentPos),
          y: centerY(row),
          direction: "up",
          lane: colorLane,
          fromSha: fromShas[0]!,
          toSha: item.parentSha,
          fromShas,
          edgeIds,
        });
      }
    }
  }

  return { lines, arrows, dots };
}

export function hitTestGraphPrimitives(
  primitives: {
    lines: readonly GitLogGraphLine[];
    arrows: readonly GitLogGraphArrow[];
  },
  x: number,
  y: number,
  threshold = 6,
): GraphHit | null {
  let best: GraphHit | null = null;
  let bestDistance = threshold;
  for (const arrow of primitives.arrows) {
    const distance = Math.hypot(arrow.x - x, arrow.y - y);
    if (
      distance < bestDistance ||
      (distance === bestDistance && arrow.edgeIds.length > (best?.edgeIds.length ?? 0))
    ) {
      bestDistance = distance;
      best = {
        edgeIds: arrow.edgeIds,
        fromShas: arrow.fromShas,
        toShas: [arrow.toSha],
      };
    }
  }
  for (const line of primitives.lines) {
    const distance = pointToSegment(x, y, line.x1, line.y1, line.x2, line.y2);
    if (
      distance < bestDistance ||
      (distance === bestDistance && line.edgeIds.length > (best?.edgeIds.length ?? 0))
    ) {
      bestDistance = distance;
      best = {
        edgeIds: line.edgeIds,
        fromShas: line.fromShas,
        toShas: [line.toSha],
      };
    }
  }
  return best;
}

function pointToSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  if (length === 0) {
    return Math.hypot(x - x1, y - y1);
  }
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / length));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}
