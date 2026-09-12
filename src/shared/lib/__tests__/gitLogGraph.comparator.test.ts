import { describe, expect, it } from "vitest";
import { compareGraphElements } from "../gitLogGraph/comparator";

const layout = (values: Record<number, number>) => (nodeIndex: number) =>
  values[nodeIndex] ?? 0;

describe("compareGraphElements (GraphElementComparatorByLayoutIndex)", () => {
  it("places an edge to the right of a node when max(up, down) layout is larger", () => {
    const node = { kind: "node" as const, nodeIndex: 10 };
    const edge = { kind: "edge" as const, up: 1, down: 20 };
    const order = layout({ 10: 1, 1: 4, 20: 1 });
    expect(compareGraphElements(node, edge, order)).toBeLessThan(0);
    expect(compareGraphElements(edge, node, order)).toBeGreaterThan(0);
  });

  it("uses the child node index as a tie-break when layout indices match", () => {
    const node = { kind: "node" as const, nodeIndex: 5 };
    const earlier = { kind: "edge" as const, up: 2, down: 5 };
    const later = { kind: "edge" as const, up: 8, down: 5 };
    const order = layout({ 5: 3, 2: 3, 8: 3 });
    expect(compareGraphElements(earlier, node, order)).toBe(2 - 5);
    expect(compareGraphElements(later, node, order)).toBe(8 - 5);
  });

  it("orders two edges through the later up-node when ups differ", () => {
    const left = { kind: "edge" as const, up: 1, down: 9 };
    const right = { kind: "edge" as const, up: 4, down: 9 };
    const order = layout({ 1: 2, 4: 6, 9: 1 });
    expect(compareGraphElements(left, right, order)).toBeLessThan(0);
  });

  it("sorts a parent-side bundle with the parent layout index", () => {
    const filler = { kind: "node" as const, nodeIndex: 50 };
    const bundle = { kind: "bundle" as const, nodeIndex: 9 };
    const order = layout({ 50: 8, 9: 1 });
    expect(compareGraphElements(bundle, filler, order)).toBeLessThan(0);
  });
});
