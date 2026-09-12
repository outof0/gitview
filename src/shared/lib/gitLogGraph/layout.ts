/**
 * IntelliJ GraphLayoutBuilder: DFS from important heads toward parents.
 * First unvisited parent continues the current layout index. A finished path
 * increments the index. Indices are never reused for a different path.
 */
export function assignLayoutIndices(input: {
  parents: readonly (readonly number[])[];
  headSha: string | null;
  refTips: readonly string[];
  indexBySha: ReadonlyMap<string, number>;
}): Int32Array {
  const nodeCount = input.parents.length;
  const layoutIndex = new Int32Array(nodeCount);
  if (nodeCount === 0) {
    return layoutIndex;
  }

  const childCount = new Int32Array(nodeCount);
  for (let node = 0; node < nodeCount; node += 1) {
    for (const parent of input.parents[node]!) {
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

  const orderedHeads: number[] = [];
  const seenHeads = new Set<number>();
  const addHead = (sha: string | null | undefined) => {
    if (!sha) {
      return;
    }
    const index = input.indexBySha.get(sha);
    if (index === undefined || seenHeads.has(index)) {
      return;
    }
    seenHeads.add(index);
    orderedHeads.push(index);
  };
  addHead(input.headSha);
  for (const tip of input.refTips) {
    addHead(tip);
  }
  for (const head of graphHeads) {
    if (!seenHeads.has(head)) {
      seenHeads.add(head);
      orderedHeads.push(head);
    }
  }

  let currentLayoutIndex = 1;
  const stack: Array<{ node: number; nextParent: number }> = [];
  for (const head of orderedHeads) {
    if (layoutIndex[head] !== 0) {
      continue;
    }
    stack.push({ node: head, nextParent: 0 });
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const firstVisit = layoutIndex[frame.node] === 0;
      if (firstVisit) {
        layoutIndex[frame.node] = currentLayoutIndex;
      }
      const parents = input.parents[frame.node]!;
      let next: number | undefined;
      while (frame.nextParent < parents.length) {
        const parent = parents[frame.nextParent]!;
        frame.nextParent += 1;
        if (parent >= 0 && layoutIndex[parent] === 0) {
          next = parent;
          break;
        }
      }
      if (next === undefined) {
        if (firstVisit) {
          currentLayoutIndex += 1;
        }
        stack.pop();
      } else {
        stack.push({ node: next, nextParent: 0 });
      }
    }
  }
  return layoutIndex;
}
