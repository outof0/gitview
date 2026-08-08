import { describe, expect, it } from "vitest";
import { groupWorkspaceFiles } from "../groupWorkspaceFiles";
import type { GitFileStatus } from "@gitview/shared/types/status";

function file(
  path: string,
  kind: GitFileStatus["kind"],
  overrides?: Partial<GitFileStatus>,
): GitFileStatus {
  return {
    repoId: "repo-1",
    path,
    kind,
    indexStatus: " ",
    workingTreeStatus: " ",
    staged: false,
    conflicted: kind === "conflicted",
    binary: false,
    ...overrides,
  };
}

describe("groupWorkspaceFiles", () => {
  it("separates tracked changes, unversioned files, and conflicts", () => {
    const groups = groupWorkspaceFiles([
      file("src/a.ts", "modified"),
      file("new.ts", "unversioned"),
      file("conflict.ts", "conflicted", { conflicted: true }),
      file("node_modules/x", "ignored"),
    ]);

    expect(groups.changes.map((f) => f.path)).toEqual(["src/a.ts"]);
    expect(groups.unversioned.map((f) => f.path)).toEqual(["new.ts"]);
    expect(groups.conflicts.map((f) => f.path)).toEqual(["conflict.ts"]);
  });
});