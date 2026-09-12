import type { PermanentGraph } from "./types";

/**
 * IntelliJ GraphLayoutImpl.getOneOfHeadNodeIndex: a node's color fragment is
 * the last important head whose layoutIndex is <= the node's layoutIndex.
 * Derived from the frozen layoutIndex array; does not reassign indices.
 */
export function importantHeadStarts(graph: PermanentGraph): number[] {
  const nodeCount = graph.shas.length;
  const childCount = new Int32Array(nodeCount);
  for (let node = 0; node < nodeCount; node += 1) {
    for (const parent of graph.parents[node]!) {
      if (parent >= 0) {
        childCount[parent] = (childCount[parent] ?? 0) + 1;
      }
    }
  }
  const graphHeads: number[] = [];
  for (let node = 0; node < nodeCount; node += 1) {
    if (childCount[node] === 0) {
      graphHeads.push(node);
    }
  }
  const ordered: number[] = [];
  const seen = new Set<number>();
  const add = (sha: string | null | undefined) => {
    if (!sha) {
      return;
    }
    const index = graph.indexBySha.get(sha);
    if (index === undefined || seen.has(index)) {
      return;
    }
    seen.add(index);
    ordered.push(index);
  };
  add(graph.headSha);
  for (const tip of graph.refTips) {
    add(tip);
  }
  for (const head of graphHeads) {
    if (!seen.has(head)) {
      seen.add(head);
      ordered.push(head);
    }
  }
  const starts: number[] = [];
  let lastStart = 0;
  for (const head of ordered) {
    const layoutIndex = graph.layoutIndex[head] ?? 0;
    if (layoutIndex > lastStart) {
      starts.push(layoutIndex);
      lastStart = layoutIndex;
    }
  }
  return starts;
}

export function colorLaneForLayoutIndex(
  headStarts: readonly number[],
  layoutIndex: number,
): number {
  if (headStarts.length === 0 || layoutIndex <= 0) {
    return 0;
  }
  let low = 0;
  let high = headStarts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((headStarts[mid] ?? 0) <= layoutIndex) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return Math.max(0, low - 1);
}
