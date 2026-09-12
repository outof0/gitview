import { describe, expect, it } from "vitest";
import type { LogCommitEntry } from "../../types/log";
import {
  GIT_LOG_GRAPH_LONG_EDGE_ROWS,
  buildGraphCanvasPrimitives,
  buildPermanentGraph,
  buildVisibleGraphLayout,
  dagSnapshotFromCommits,
  gitLogGraphWidth,
  laneCenterX,
  measureGraphLayout,
  printEdgesMatchDag,
} from "../gitLogGraph";

function commit(
  sha: string,
  parentShas: string[] = [],
  parentPresent?: boolean[],
): LogCommitEntry {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject: sha,
    author: "Author",
    authorEmail: "author@example.com",
    authorTime: 0,
    parentShas,
    parentPresent,
    isMerge: parentShas.length > 1,
    changedFiles: [],
  };
}

function graphOf(commits: LogCommitEntry[], headSha?: string) {
  return buildPermanentGraph(
    dagSnapshotFromCommits(commits, { headSha: headSha ?? commits[0]?.sha }),
  );
}

function visibleOf(commits: LogCommitEntry[]) {
  const graph = graphOf(commits);
  const layout = buildVisibleGraphLayout(graph, {
    visibleCommits: commits.map((entry, row) => ({
      sha: entry.sha,
      row,
      parentShas: entry.parentShas,
      parentPresent: entry.parentPresent,
    })),
    rowCount: commits.length,
  });
  return { graph, layout };
}

function parentMap(commits: LogCommitEntry[]) {
  return new Map(commits.map((entry) => [entry.sha, entry.parentShas ?? []]));
}

describe("permanent layout indices", () => {
  it("keeps a linear history on one layout index", () => {
    const { graph, layout } = visibleOf([
      commit("c", ["b"]),
      commit("b", ["a"]),
      commit("a", []),
    ]);
    expect(layout.laneBySha.get("c")).toBe(0);
    expect(layout.laneBySha.get("b")).toBe(0);
    expect(layout.laneBySha.get("a")).toBe(0);
    expect(measureGraphLayout(layout, graph).laneChangeCount).toBe(0);
  });

  it("keeps first-parent on the merge lane and the side branch on a new index", () => {
    const { layout } = visibleOf([
      commit("merge", ["main", "feature"]),
      commit("feature", ["main"]),
      commit("main", []),
    ]);
    expect(layout.laneBySha.get("merge")).toBe(0);
    expect(layout.laneBySha.get("main")).toBe(0);
    expect(layout.laneBySha.get("feature")).toBe(1);
  });

  it("does not reuse a finished lane for an unrelated head", () => {
    const { layout } = visibleOf([
      commit("child-0", ["parent"]),
      commit("child-1", ["parent"]),
      commit("parent", []),
    ]);
    expect(layout.laneBySha.get("child-0")).not.toBe(
      layout.laneBySha.get("child-1"),
    );
  });

  it("gives the important head the first-parent spine", () => {
    const commits = [
      commit("side", ["main"]),
      commit("main-tip", ["main"]),
      commit("main", []),
    ];
    const graph = graphOf(commits, "main-tip");
    const layout = buildVisibleGraphLayout(graph, {
      visibleCommits: commits.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: commits.length,
    });
    expect(layout.laneBySha.get("main-tip")).toBe(layout.laneBySha.get("main"));
    expect(layout.laneBySha.get("side")).not.toBe(layout.laneBySha.get("main"));
  });

  it("keeps layout indices when only a prefix of the DAG is visible", () => {
    const all = [
      commit("merge", ["main", "feature"]),
      commit("feature", ["feature-base"]),
      commit("main", ["base"]),
      commit("feature-base", ["base"]),
      commit("base", []),
    ];
    const graph = graphOf(all);
    const prefix = buildVisibleGraphLayout(graph, {
      visibleCommits: all.slice(0, 2).map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: 2,
    });
    const full = buildVisibleGraphLayout(graph, {
      visibleCommits: all.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: all.length,
    });
    expect(prefix.laneBySha.get("merge")).toBe(full.laneBySha.get("merge"));
    expect(prefix.laneBySha.get("feature")).toBe(full.laneBySha.get("feature"));
  });
});

describe("visible print topology", () => {
  it("only draws Git parent relationships", () => {
    const commits = [
      commit("A", ["B", "C"]),
      commit("B", ["D"]),
      commit("C", ["D"]),
      commit("D"),
    ];
    const { layout } = visibleOf(commits);
    expect(printEdgesMatchDag(layout, parentMap(commits))).toBe(true);
    const links = new Set(
      layout.edges.map((edge) => `${edge.childSha}->${edge.parentSha}`),
    );
    expect(links).toEqual(new Set(["A->B", "A->C", "B->D", "C->D"]));
  });

  it("hides filtered parents without changing layout indices", () => {
    const commits = [
      commit("merge", ["main", "feature"], [true, false]),
      commit("feature", ["main"]),
      commit("main", []),
    ];
    const graph = graphOf(commits);
    const layout = buildVisibleGraphLayout(graph, {
      visibleCommits: commits.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
        parentPresent: entry.parentPresent,
      })),
      rowCount: commits.length,
    });
    expect(layout.laneBySha.get("feature")).toBe(1);
    expect(
      layout.edges.some(
        (edge) => edge.childSha === "merge" && edge.parentSha === "feature",
      ),
    ).toBe(false);
  });

  it("walks through collapsed linear commits instead of dropping the edge", () => {
    const commits = [
      commit("tip", ["hidden"]),
      commit("hidden", ["base"]),
      commit("base", []),
    ];
    const graph = graphOf(commits);
    const layout = buildVisibleGraphLayout(graph, {
      visibleCommits: [
        { sha: "tip", row: 0, parentShas: ["hidden"] },
        { sha: "base", row: 2, parentShas: [] },
      ],
      rowCount: 3,
      hiddenShas: new Set(["hidden"]),
      loadedBySha: new Map([
        ["tip", { sha: "tip", row: 0, parentShas: ["hidden"] }],
        ["hidden", { sha: "hidden", row: 1, parentShas: ["base"] }],
        ["base", { sha: "base", row: 2, parentShas: [] }],
      ]),
    });
    expect(
      layout.edges.some(
        (edge) => edge.childSha === "tip" && edge.parentSha === "base",
      ),
    ).toBe(true);
  });
});

describe("long-edge print", () => {
  function longEdgeGraph() {
    const commits = [
      commit("child", ["parent"]),
      ...Array.from({ length: 35 }, (_, index) => commit(`filler-${index}`)),
      commit("parent"),
    ];
    return { ...visibleOf(commits), commits };
  }

  it("hides the middle of a long rail and marks both attachments", () => {
    const { layout, commits } = longEdgeGraph();
    const { lines, arrows } = buildGraphCanvasPrimitives(
      layout,
      0,
      commits.length,
    );
    expect(arrows.map((arrow) => arrow.direction)).toEqual(["down", "up"]);
    expect(lines).toHaveLength(2);
  });

  it("draws a terminal arrow for a parent that is not in the list", () => {
    const commits = [commit("child", ["missing"])];
    const { layout } = visibleOf(commits);
    const { lines, arrows } = buildGraphCanvasPrimitives(layout, 0, 1);
    expect(lines).toHaveLength(0);
    expect(arrows).toMatchObject([
      {
        x: laneCenterX(0),
        y: 12,
        direction: "down",
        fromSha: "child",
        toSha: "missing",
      },
    ]);
  });

  it("does not grow width with many same-parent long edges beyond distinct layout indices", () => {
    const children = Array.from({ length: 12 }, (_, index) =>
      commit(`child-${index}`, ["parent"]),
    );
    const fillers = Array.from(
      { length: GIT_LOG_GRAPH_LONG_EDGE_ROWS },
      (_, index) => commit(`filler-${index}`),
    );
    const commits = [...children, ...fillers, commit("parent")];
    const { graph, layout } = visibleOf(commits);
    expect(layout.width).toBe(gitLogGraphWidth(layout.maxLane));
    expect(layout.maxLane).toBeGreaterThan(1);
    const prefix = buildVisibleGraphLayout(graph, {
      visibleCommits: children.map((entry, row) => ({
        sha: entry.sha,
        row,
        parentShas: entry.parentShas,
      })),
      rowCount: children.length,
    });
    expect(prefix.laneBySha.get("child-0")).toBe(layout.laneBySha.get("child-0"));
  });
});
