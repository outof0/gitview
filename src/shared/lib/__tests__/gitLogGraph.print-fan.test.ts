import { describe, expect, it } from "vitest";
import type { LogCommitEntry } from "../../types/log";
import {
  GIT_LOG_GRAPH_LONG_EDGE_ROWS,
  buildGraphCanvasPrimitives,
  buildPermanentGraph,
  buildVisibleGraphLayout,
  dagSnapshotFromCommits,
  hitTestGraphPrimitives,
  printEdgesMatchDag,
} from "../gitLogGraph";

function commit(sha: string, parentShas: string[] = []): LogCommitEntry {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject: sha,
    author: "Author",
    authorEmail: "author@example.com",
    authorTime: 0,
    parentShas,
    isMerge: parentShas.length > 1,
    changedFiles: [],
  };
}

function sharedParentFixture(childCount: number) {
  const children = Array.from({ length: childCount }, (_, index) =>
    commit(`child-${index}`, ["parent"]),
  );
  const fillers = Array.from({ length: GIT_LOG_GRAPH_LONG_EDGE_ROWS }, (_, index) =>
    commit(`filler-${index}`),
  );
  const unrelated = commit("unrelated", ["unrelated-base"]);
  const commits = [
    ...children,
    ...fillers.slice(0, -1),
    unrelated,
    commit("parent"),
    commit("unrelated-base"),
  ];
  const graph = buildPermanentGraph(dagSnapshotFromCommits(commits));
  const layout = buildVisibleGraphLayout(graph, {
    visibleCommits: commits.map((entry, row) => ({
      sha: entry.sha,
      row,
      parentShas: entry.parentShas,
    })),
    rowCount: commits.length,
  });
  const primitives = buildGraphCanvasPrimitives(layout, 0, commits.length);
  const parentMap = new Map(
    commits.map((entry) => [entry.sha, entry.parentShas ?? []]),
  );
  const unrelatedDot = primitives.dots.find((dot) => dot.sha === "unrelated");
  const parentDot = primitives.dots.find((dot) => dot.sha === "parent");
  const upArrows = primitives.arrows.filter(
    (arrow) => arrow.direction === "up" && arrow.toSha === "parent",
  );
  return {
    commits,
    graph,
    layout,
    primitives,
    parentMap,
    unrelatedDot,
    parentDot,
    upArrows,
    childCount,
  };
}

describe("shared-base long-edge print", () => {
  it.each([2, 5, 20])(
    "keeps topology and one parent terminal for %s long edges",
    (childCount) => {
      const fixture = sharedParentFixture(childCount);
      expect(printEdgesMatchDag(fixture.layout, fixture.parentMap)).toBe(true);
      expect(
        fixture.layout.edges.filter((edge) => edge.parentSha === "parent"),
      ).toHaveLength(childCount);
      expect(fixture.upArrows).toHaveLength(1);
      expect([...fixture.upArrows[0]!.edgeIds].sort((a, b) => a - b)).toEqual(
        fixture.layout.edges
          .filter((edge) => edge.parentSha === "parent")
          .map((edge) => edge.id)
          .sort((a, b) => a - b),
      );
      expect(fixture.upArrows[0]!.fromShas).toHaveLength(childCount);
    },
  );

  it("keeps an unrelated node X stable as shared-base fan size grows", () => {
    const two = sharedParentFixture(2);
    const five = sharedParentFixture(5);
    const twenty = sharedParentFixture(20);
    expect(two.unrelatedDot?.x).toBe(five.unrelatedDot?.x);
    expect(five.unrelatedDot?.x).toBe(twenty.unrelatedDot?.x);
    expect(two.parentDot?.x).toBe(twenty.parentDot?.x);
  });

  it("is deterministic and resolves every underlying edge from the terminal", () => {
    const first = sharedParentFixture(5);
    const second = sharedParentFixture(5);
    expect(first.primitives.arrows).toEqual(second.primitives.arrows);
    expect(first.primitives.lines).toEqual(second.primitives.lines);
    const terminal = first.upArrows[0]!;
    const hit = hitTestGraphPrimitives(
      first.primitives,
      terminal.x,
      terminal.y,
    );
    expect(hit?.edgeIds).toEqual(terminal.edgeIds);
    expect(hit?.fromShas).toHaveLength(5);
    expect(hit?.toShas).toEqual(["parent"]);
  });

  it("does not bundle short edges that share a parent", () => {
    const commits = [
      commit("a", ["base"]),
      commit("b", ["base"]),
      commit("base"),
    ];
    const graph = buildPermanentGraph(dagSnapshotFromCommits(commits));
    const layout = buildVisibleGraphLayout(graph, {
      visibleCommits: commits.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: 3,
    });
    const { arrows, lines } = buildGraphCanvasPrimitives(layout, 0, 3);
    expect(arrows).toHaveLength(0);
    expect(new Set(lines.map((line) => `${line.fromSha}->${line.toSha}`))).toEqual(
      new Set(["a->base", "b->base"]),
    );
    expect(printEdgesMatchDag(
      layout,
      new Map(commits.map((entry) => [entry.sha, entry.parentShas ?? []])),
    )).toBe(true);
  });
});
