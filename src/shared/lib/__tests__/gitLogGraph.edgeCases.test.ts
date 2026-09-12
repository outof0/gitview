import { describe, expect, it } from "vitest";
import type { LogCommitEntry } from "../../types/log";
import {
  buildGraphCanvasPrimitives,
  buildPermanentGraph,
  buildVisibleGraphLayout,
  colorLaneForLayoutIndex,
  dagSnapshotFromCommits,
  displayLane,
  gitLogGraphWidth,
  gitLogLaneColor,
  hitTestGraphPrimitives,
  importantHeadStarts,
  isGitAncestor,
  loadedCommitsFromLog,
  measureGraphLayout,
  parseLogDagLines,
  printEdgesMatchDag,
  uniqueRefTips,
} from "../gitLogGraph";
import { compareGraphElements } from "../gitLogGraph/comparator";
import { assignLayoutIndices } from "../gitLogGraph/layout";

const layout = (values: Record<number, number>) => (nodeIndex: number) =>
  values[nodeIndex] ?? 0;

function commit(
  sha: string,
  parentShas?: string[],
): LogCommitEntry {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject: sha,
    author: "Author",
    authorEmail: "author@example.com",
    authorTime: 1,
    parentShas,
    changedFiles: [],
  };
}

describe("git log graph edge cases", () => {
  it("handles missing endpoints, equal lanes, and both edge orders", () => {
    const order = layout({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 8: 4 });
    const missing = { kind: "edge" as const, up: 1, down: -1 };
    const first = { kind: "edge" as const, up: 2, down: 3 };
    const second = { kind: "edge" as const, up: 2, down: 4 };
    const later = { kind: "edge" as const, up: 8, down: 4 };
    const node = { kind: "node" as const, nodeIndex: 1 };

    expect(compareGraphElements(missing, first, order)).not.toBe(0);
    expect(compareGraphElements(first, missing, order)).not.toBe(0);
    expect(compareGraphElements(missing, node, order)).toBe(0);
    expect(compareGraphElements(first, second, order)).toBeGreaterThan(0);
    expect(compareGraphElements(second, first, order)).toBeLessThan(0);
    expect(compareGraphElements(first, later, order)).toBeLessThan(0);
    expect(compareGraphElements(later, first, order)).toBeGreaterThan(0);
    expect(
      compareGraphElements(
        { kind: "node", nodeIndex: 1 },
        { kind: "bundle", nodeIndex: 2 },
        order,
      ),
    ).toBeLessThan(0);
  });

  it("normalizes malformed DAG records and ref tips", () => {
    expect(
      parseLogDagLines(
        [
          "malformed",
          ["", "parent", "1"].join("\0"),
          ["sha", "parent", "not-a-number"].join("\0"),
          ["", "p", "1"].join("\0"),
        ].join("\n"),
      ),
    ).toEqual([
      { sha: "sha", parentShas: ["parent"], timestamp: 0 },
    ]);
    expect(uniqueRefTips(null, ["", "aaa", "aaa"])).toEqual(["aaa"]);
    expect(
      dagSnapshotFromCommits([], { repoId: "repo", headSha: null, refTips: [] }),
    ).toMatchObject({ repoId: "repo", headSha: null, refTips: [], nodes: [] });
    expect(displayLane(-1)).toBe(0);
  });

  it("covers fallback geometry and binary-search boundaries", () => {
    expect(gitLogLaneColor(-1)).toBe("var(--gitview-graph-purple)");
    expect(gitLogGraphWidth(-1)).toBe(34);
    expect(colorLaneForLayoutIndex([], 0)).toBe(0);
    expect(colorLaneForLayoutIndex([2, 4], 1)).toBe(0);
    expect(colorLaneForLayoutIndex([2, 4], 3)).toBe(0);
    expect(colorLaneForLayoutIndex([2, 4], 4)).toBe(1);
  });

  it("reports missing ancestry and optional metrics paths", () => {
    const commits = [commit("child", ["parent"]), commit("parent")];
    const graph = buildPermanentGraph(dagSnapshotFromCommits(commits));
    const graphLayout = buildVisibleGraphLayout(graph, {
      visibleCommits: commits.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: commits.length,
    });
    expect(measureGraphLayout(graphLayout)).toMatchObject({
      laneChangeCount: 0,
    });
    const parentMap = new Map<string, readonly string[]>([
      ["child", ["parent", "parent"]],
      ["parent", []],
    ]);
    expect(isGitAncestor("child", "missing", parentMap)).toBe(false);
    expect(isGitAncestor("child", "parent", parentMap)).toBe(true);
    expect(
      printEdgesMatchDag(graphLayout, new Map([["child", []]])),
    ).toBe(false);
    expect(
      isGitAncestor(
        "orphan",
        "unseen",
        new Map<string, readonly string[]>([["orphan", ["missing"]]]),
      ),
    ).toBe(false);
  });

  it("keeps disconnected and unknown heads deterministic", () => {
    expect(
      assignLayoutIndices({
        parents: [],
        headSha: null,
        refTips: [],
        indexBySha: new Map(),
      }),
    ).toEqual(new Int32Array());

    const graph = buildPermanentGraph(
      dagSnapshotFromCommits(
        [commit("child", ["missing"]), commit("orphan")],
        { headSha: null, refTips: ["child", "child", "unknown"] },
      ),
    );
    const starts = importantHeadStarts(graph);
    expect(starts.length).toBeGreaterThan(0);
    expect(starts).toEqual([...starts].sort((left, right) => left - right));

    const noHead = importantHeadStarts({
      ...graph,
      headSha: null,
      refTips: ["unknown"],
      layoutIndex: new Int32Array(),
    });
    expect(noHead).toEqual([]);

    const reused = assignLayoutIndices({
      parents: [[1], []],
      headSha: "tip",
      refTips: ["base"],
      indexBySha: new Map([
        ["tip", 0],
        ["base", 1],
      ]),
    });
    expect(reused).toEqual(new Int32Array([1, 1]));
  });

  it("measures branch bends and ignores empty hit-test input", () => {
    const commits = [
      commit("merge", ["main", "feature"]),
      commit("feature", ["main"]),
      commit("main"),
    ];
    const graph = buildPermanentGraph(dagSnapshotFromCommits(commits));
    const graphLayout = buildVisibleGraphLayout(graph, {
      visibleCommits: commits.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: commits.length,
    });
    expect(measureGraphLayout(graphLayout, graph).bendCount).toBeGreaterThan(0);
    expect(
      hitTestGraphPrimitives({ lines: [], arrows: [] }, 0, 0),
    ).toBeNull();
  });

  it("skips hidden parents without an available continuation", () => {
    const all = [commit("child", ["hidden"]), commit("hidden")];
    const graph = buildPermanentGraph(dagSnapshotFromCommits(all));
    const graphLayout = buildVisibleGraphLayout(graph, {
      visibleCommits: [{ sha: "child", row: 0, parentShas: ["hidden"] }],
      rowCount: 1,
      hiddenShas: new Set(["hidden"]),
      loadedBySha: new Map([
        ["child", { sha: "child", row: 0, parentShas: ["hidden"] }],
        ["hidden", { sha: "hidden", row: 1, parentShas: [] }],
      ]),
    });
    expect(graphLayout.edges).toHaveLength(0);
    expect(loadedCommitsFromLog(all).get("child")?.row).toBe(-1);
    expect(buildGraphCanvasPrimitives(graphLayout, 1, 0)).toEqual({
      lines: [],
      arrows: [],
      dots: [],
    });
  });
});
