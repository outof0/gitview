import { describe, expect, it } from "vitest";
import type { LogCommitEntry } from "@gitview/shared/types/log";
import { collapseLinearCommits } from "../collapseLinearCommits";

function commit(
  sha: string,
  parents: string[] = [],
  subject = sha,
): LogCommitEntry {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    author: "Author",
    authorEmail: "a@example.com",
    authorTime: 1_700_000_000,
    subject,
    parentShas: parents,
    isMerge: parents.length > 1,
    changedFiles: [],
  };
}

describe("collapseLinearCommits", () => {
  it("returns plain commits when disabled", () => {
    const commits = [commit("c3", ["c2"]), commit("c2", ["c1"]), commit("c1", [])];
    const result = collapseLinearCommits(commits, false);
    expect(result).toHaveLength(3);
    expect(result.every((entry) => entry.kind === "commit")).toBe(true);
  });

  it("collapses a run of linear middle commits", () => {
    const commits = [
      commit("c5", ["c4"]),
      commit("c4", ["c3"]),
      commit("c3", ["c2"]),
      commit("c2", ["c1"]),
      commit("c1", []),
    ];
    const result = collapseLinearCommits(commits, true);
    expect(result.some((entry) => entry.kind === "collapsed")).toBe(true);
    const collapsed = result.find((entry) => entry.kind === "collapsed");
    expect(collapsed && collapsed.kind === "collapsed" ? collapsed.count : 0).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("keeps merge commits visible", () => {
    const commits = [
      commit("m1", ["c2", "c3"], "merge"),
      commit("c2", ["c1"]),
      commit("c1", []),
    ];
    const result = collapseLinearCommits(commits, true);
    expect(result[0]?.kind).toBe("commit");
    if (result[0]?.kind === "commit") {
      expect(result[0].commit.isMerge).toBe(true);
    }
  });
});