import { describe, expect, it } from "vitest";
import { formatGitCommandError } from "../gitCommandError";

describe("formatGitCommandError", () => {
  it("maps unmerged index errors to a clear conflict message", () => {
    const message = formatGitCommandError(
      new Error("error: could not write index\nREADME.md: needs merge"),
      "Stash",
    );
    expect(message).toContain("merge conflicts are unresolved");
    expect(message).toContain("Stash");
  });

  it("maps in-progress merge markers", () => {
    const message = formatGitCommandError(
      new Error("fatal: You are in the middle of a merge -- cannot stash"),
      "Stash",
    );
    expect(message).toContain("Git operation is in progress");
  });

  it("maps empty stash list", () => {
    const message = formatGitCommandError(
      new Error("No stash entries found."),
      "Unstash",
    );
    expect(message).toContain("no stash entries");
  });

  it("falls back to a trimmed git summary", () => {
    const message = formatGitCommandError(
      new Error("error: pathspec 'foo' did not match any file(s) known to git"),
      "Add",
    );
    expect(message).toContain("Add failed:");
    expect(message).toContain("pathspec");
  });
});
