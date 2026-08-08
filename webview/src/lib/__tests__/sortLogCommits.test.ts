import { describe, expect, it } from "vitest";
import { sortLogCommitsTopologically } from "../sortLogCommits";
import type { LogCommitEntry } from "@gitview/shared/types/log";

function commit(
  sha: string,
  parentShas: string[] = [],
): LogCommitEntry {
  return {
    sha,
    shortSha: sha.slice(0, 7),
    subject: sha,
    author: "Author",
    authorEmail: "author@example.com",
    authorTime: 0,
    parentShas,
    changedFiles: [],
  };
}

describe("sortLogCommitsTopologically", () => {
  it("orders commits newest-first while respecting parent links", () => {
    const commits = [commit("c", ["b"]), commit("b", ["a"]), commit("a", [])];
    const sorted = sortLogCommitsTopologically(commits);
    expect(sorted.map((entry) => entry.sha)).toEqual(["c", "b", "a"]);
  });

  it("places child commits before their parents in the log list", () => {
    const commits = [commit("x", []), commit("y", ["x"])];
    const sorted = sortLogCommitsTopologically(commits);
    expect(sorted.map((entry) => entry.sha)).toEqual(["y", "x"]);
  });
});