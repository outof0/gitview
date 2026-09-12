import { describe, expect, it } from "vitest";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import {
  buildGitLogGraphLayout,
  buildGraphCanvasPrimitives,
  gitLogGraphWidth,
  laneCenterX,
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

describe("buildGitLogGraphLayout", () => {
  it("keeps a linear history on one lane", () => {
    const layout = buildGitLogGraphLayout([
      commit("c", ["b"]),
      commit("b", ["a"]),
      commit("a", []),
    ]);
    expect(layout.laneBySha.get("c")).toBe(0);
    expect(layout.laneBySha.get("b")).toBe(0);
    expect(layout.laneBySha.get("a")).toBe(0);
    expect(layout.width).toBe(gitLogGraphWidth(0));
  });

  it("places a merged side branch on a new layout index", () => {
    const layout = buildGitLogGraphLayout([
      commit("merge", ["main", "feature"]),
      commit("feature", ["main"]),
      commit("main", []),
    ]);
    expect(layout.laneBySha.get("merge")).toBe(0);
    expect(layout.laneBySha.get("feature")).toBe(1);
    expect(layout.laneBySha.get("main")).toBe(0);
  });

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
    expect(layout.transitions[0]?.lane).toBe(0);
  });
});

describe("buildGraphCanvasPrimitives with collapsed rows", () => {
  it("includes the last commits when row gaps come from collapse", () => {
    const layout = buildGitLogGraphLayout(
      [commit("aaa"), commit("eee"), commit("fff")],
      {
        rowBySha: new Map([
          ["aaa", 0],
          ["eee", 2],
          ["fff", 3],
        ]),
        rowCount: 4,
      },
    );
    const { dots } = buildGraphCanvasPrimitives(layout, 0, 4);
    expect(dots.map((dot) => dot.sha)).toEqual(["aaa", "eee", "fff"]);
    expect(dots.at(-1)?.y).toBe(3 * 24 + 12);
  });
});

describe("canvas primitives", () => {
  it("draws both children of a shared parent", () => {
    const layout = buildGitLogGraphLayout([
      commit("A", ["B", "C"]),
      commit("B", ["D"]),
      commit("C", ["D"]),
      commit("D"),
    ]);
    const { lines, arrows } = buildGraphCanvasPrimitives(layout, 0, 4);
    const links = new Set(lines.map((line) => `${line.fromSha}->${line.toSha}`));
    expect(links).toEqual(new Set(["A->B", "A->C", "B->D", "C->D"]));
    expect(arrows).toHaveLength(0);
  });

  it("draws straight compacted segments for a short chain", () => {
    const layout = buildGitLogGraphLayout([
      commit("c", ["b"]),
      commit("b", ["a"]),
      commit("a"),
    ]);
    const { lines, dots } = buildGraphCanvasPrimitives(layout, 0, 3);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.x1).toBe(laneCenterX(0));
      expect(line.x2).toBe(laneCenterX(0));
    }
    expect(dots.map((dot) => [dot.sha, dot.x])).toEqual([
      ["c", laneCenterX(0)],
      ["b", laneCenterX(0)],
      ["a", laneCenterX(0)],
    ]);
  });
});
