import { describe, expect, it } from "vitest";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import {
  assignCommitLanes,
  buildGitLogGraphEdges,
  buildGitLogGraphLayout,
  buildParentEdgePath,
  gitLogGraphWidth,
  laneCenterX,
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

describe("assignCommitLanes", () => {
  it("keeps a linear history on one lane", () => {
    const commits = [commit("c", ["b"]), commit("b", ["a"]), commit("a", [])];
    const lanes = assignCommitLanes(commits);
    expect(lanes.get("c")).toBe(0);
    expect(lanes.get("b")).toBe(0);
    expect(lanes.get("a")).toBe(0);
  });

  it("places a merged branch on a side lane", () => {
    const commits = [
      commit("merge", ["main", "feature"]),
      commit("feature", ["main"]),
      commit("main", []),
    ];
    const lanes = assignCommitLanes(commits);
    expect(lanes.get("merge")).toBe(0);
    expect(lanes.get("feature")).toBe(1);
    expect(lanes.get("main")).toBe(0);
  });

  it("does not reserve lanes for parents outside a filtered history", () => {
    const commits = Array.from({ length: 100 }, (_, index) =>
      commit(`visible-${index}`, [`filtered-parent-${index}`]),
    );

    const lanes = assignCommitLanes(commits);

    expect(new Set(lanes.values())).toEqual(new Set([0]));
    expect(gitLogGraphWidth(lanes)).toBe(34);
  });

  it("still reserves a lane when the parent appears later in the list", () => {
    const commits = [
      commit("merge", ["filtered-main", "feature"]),
      commit("independent", []),
      commit("feature", []),
    ];

    const lanes = assignCommitLanes(commits);

    expect(lanes.get("merge")).toBe(0);
    expect(lanes.get("independent")).toBe(1);
    expect(lanes.get("feature")).toBe(0);
  });

  it("opens merge side lanes to the right of an active lane", () => {
    const commits = [
      commit("main-tip", ["main"]),
      commit("merge", ["main", "feature"]),
      commit("feature", ["base"]),
      commit("main", ["base"]),
      commit("base", []),
    ];

    const lanes = assignCommitLanes(commits);

    expect(lanes.get("main-tip")).toBe(0);
    expect(lanes.get("merge")).toBe(1);
    expect(lanes.get("feature")).toBe(2);
    expect(lanes.get("main")).toBe(0);
  });
});

describe("buildParentEdgePath", () => {
  it("draws a pure vertical for the same lane", () => {
    const d = buildParentEdgePath(17, 12, 17, 60);
    expect(d.startsWith("M 17 ")).toBe(true);
    expect(d).toMatch(/L 17 /);
    expect(d.includes("L 31 ")).toBe(false);
  });

  it("draws a diagonal when lanes differ", () => {
    const x0 = laneCenterX(0);
    const x1 = laneCenterX(1);
    const d = buildParentEdgePath(x0, 12, x1, 36);
    expect(d).toContain(`M ${x0} `);
    expect(d).toContain(`L ${x1} `);
    // Not the old orthogonal mid-bar: L x0 y  L x1 y  L x1 y2
    expect(d).not.toMatch(
      new RegExp(`L ${x0} [\\d.]+ L ${x1} [\\d.]+ L ${x1}`),
    );
  });
});

describe("buildGitLogGraphLayout row mapping", () => {
  it("keeps graph geometry aligned when a collapsed placeholder occupies a row", () => {
    const commits = [commit("tip", ["base"]), commit("base", [])];
    const rowBySha = new Map([
      ["tip", 1],
      ["base", 3],
    ]);
    const layout = buildGitLogGraphLayout(commits, {
      rowBySha,
      rowCount: 4,
    });

    expect(layout.height).toBe(4 * 24);
    expect(layout.rowBySha.get("base")).toBe(3);
    expect(layout.edges[0]?.d).toMatch(/^M 17 40.5 .*79.5/);
  });
});

describe("buildGitLogGraphEdges — topological correctness (not fake)", () => {
  it("only emits edges that match real parentShas", () => {
    const commits = [
      commit("merge", ["main", "feature"]),
      commit("feature", ["main"]),
      commit("main", []),
    ];
    const laneBySha = assignCommitLanes(commits);
    const edges = buildGitLogGraphEdges(commits, laneBySha);

    // Every edge must be a real (child → parent) from git parentShas.
    for (const edge of edges) {
      const child = commits.find((c) => c.sha === edge.childSha);
      expect(child).toBeTruthy();
      expect(child!.parentShas ?? []).toContain(edge.parentSha);
    }

    const pairs = new Set(edges.map((e) => `${e.childSha}->${e.parentSha}`));
    expect(pairs.has("merge->main")).toBe(true);
    expect(pairs.has("merge->feature")).toBe(true);
    expect(pairs.has("feature->main")).toBe(true);
    // Never invent consecutive-list fakes like feature→merge
    expect(pairs.has("feature->merge")).toBe(false);
    expect(pairs.has("main->feature")).toBe(false);
  });

  it("does not invent edges when a parent is missing from the list", () => {
    // File-scoped / truncated history: child points at a parent not loaded.
    const commits = [
      commit("child", ["missing-parent-not-in-list"]),
      commit("unrelated", []),
    ];
    const laneBySha = assignCommitLanes(commits);
    const edges = buildGitLogGraphEdges(commits, laneBySha);
    // Honest gap — no fake link to the next row (unrelated).
    expect(edges).toHaveLength(0);
  });

  it("does not connect consecutive rows that are not parent-linked", () => {
    // Two independent roots listed back-to-back
    const commits = [commit("tip-a", []), commit("tip-b", [])];
    const edges = buildGitLogGraphEdges(commits, assignCommitLanes(commits));
    expect(edges).toHaveLength(0);
  });

  it("draws a straight rail for linear history with real parents", () => {
    const commits = [commit("c", ["b"]), commit("b", ["a"]), commit("a", [])];
    const laneBySha = assignCommitLanes(commits);
    const edges = buildGitLogGraphEdges(commits, laneBySha);
    expect(edges.map((e) => `${e.childSha}->${e.parentSha}`).sort()).toEqual([
      "b->a",
      "c->b",
    ]);
    const x0 = laneCenterX(0);
    for (const edge of edges) {
      expect(edge.d.startsWith(`M ${x0} `)).toBe(true);
    }
  });

  it("merge side-branch edge is diagonal and real", () => {
    const commits = [
      commit("merge", ["main", "feature"]),
      commit("feature", ["main"]),
      commit("main", []),
    ];
    const laneBySha = assignCommitLanes(commits);
    const edges = buildGitLogGraphEdges(commits, laneBySha);
    const x0 = laneCenterX(0);
    const x1 = laneCenterX(1);
    const mergeToFeature = edges.find(
      (e) => e.childSha === "merge" && e.parentSha === "feature",
    );
    expect(mergeToFeature).toBeTruthy();
    expect(mergeToFeature!.d).toContain(`M ${x0} `);
    expect(mergeToFeature!.d).toContain(`L ${x1} `);
  });
});
