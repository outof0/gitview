/**
 * Port of IntelliJ GraphElementComparatorByLayoutIndex.
 * Node indices are permanent-graph ids; layoutIndex is the frozen 1-based index.
 */
export type PrintGraphNode = {
  kind: "node";
  nodeIndex: number;
};

export type PrintGraphEdge = {
  kind: "edge";
  /** Child (newer) node index. */
  up: number;
  /** Parent node index, or -1 when not loaded. */
  down: number;
};

export type PrintGraphBundle = {
  kind: "bundle";
  /** Shared visible parent. Sorts as that node's layoutIndex. */
  nodeIndex: number;
};

export type PrintGraphElement = PrintGraphNode | PrintGraphEdge | PrintGraphBundle;

export function compareGraphElements(
  left: PrintGraphElement,
  right: PrintGraphElement,
  layoutIndexOf: (nodeIndex: number) => number,
): number {
  if (left.kind === "edge" && right.kind === "edge") {
    return compareEdges(left, right, layoutIndexOf);
  }
  if (left.kind === "edge" && right.kind !== "edge") {
    return compareEdgeToNode(left, right.nodeIndex, layoutIndexOf);
  }
  if (right.kind === "edge" && left.kind !== "edge") {
    return -compareEdgeToNode(right, left.nodeIndex, layoutIndexOf);
  }
  const leftNode = left as PrintGraphNode | PrintGraphBundle;
  const rightNode = right as PrintGraphNode | PrintGraphBundle;
  const layoutDelta =
    layoutIndexOf(leftNode.nodeIndex) - layoutIndexOf(rightNode.nodeIndex);
  if (layoutDelta !== 0) {
    return layoutDelta;
  }
  return leftNode.nodeIndex - rightNode.nodeIndex;
}

function compareEdges(
  edge1: PrintGraphEdge,
  edge2: PrintGraphEdge,
  layoutIndexOf: (nodeIndex: number) => number,
): number {
  const normal1 = asNormalEdge(edge1);
  const normal2 = asNormalEdge(edge2);
  if (normal1 === null) {
    return -compareEdgeToNode(edge2, notNullNodeIndex(edge1), layoutIndexOf);
  }
  if (normal2 === null) {
    return compareEdgeToNode(edge1, notNullNodeIndex(edge2), layoutIndexOf);
  }
  if (normal1.up === normal2.up) {
    if (normal1.down < normal2.down) {
      return -compareEdgeToNode(edge2, normal1.down, layoutIndexOf);
    }
    return compareEdgeToNode(edge1, normal2.down, layoutIndexOf);
  }
  if (normal1.up < normal2.up) {
    return compareEdgeToNode(edge1, normal2.up, layoutIndexOf);
  }
  return -compareEdgeToNode(edge2, normal1.up, layoutIndexOf);
}

function compareEdgeToNode(
  edge: PrintGraphEdge,
  nodeIndex: number,
  layoutIndexOf: (nodeIndex: number) => number,
): number {
  const normal = asNormalEdge(edge);
  if (normal === null) {
    return layoutIndexOf(notNullNodeIndex(edge)) - layoutIndexOf(nodeIndex);
  }
  const upLi = layoutIndexOf(normal.up);
  const downLi = layoutIndexOf(normal.down);
  const nodeLi = layoutIndexOf(nodeIndex);
  const edgeLi = Math.max(upLi, downLi);
  if (edgeLi !== nodeLi) {
    return edgeLi - nodeLi;
  }
  return normal.up - nodeIndex;
}

function asNormalEdge(
  edge: PrintGraphEdge,
): { up: number; down: number } | null {
  if (edge.down < 0) {
    return null;
  }
  return { up: edge.up, down: edge.down };
}

function notNullNodeIndex(edge: PrintGraphEdge): number {
  return edge.down < 0 ? edge.up : edge.down;
}
