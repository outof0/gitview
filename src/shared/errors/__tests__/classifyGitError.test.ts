import { describe, expect, it } from "vitest";
import {
  classifyGitError,
  isGitErrorCode,
  summarizeGitError,
} from "../classifyGitError";

function gitError(message: string, stderr?: string): Error {
  const error = new Error(message) as Error & { stderr?: string };
  if (stderr !== undefined) {
    error.stderr = stderr;
  }
  return error;
}

describe("classifyGitError", () => {
  it("classifies a rejected push", () => {
    expect(
      classifyGitError(
        gitError("failed to push some refs", "! [rejected] main -> main (fetch first)"),
      ).code,
    ).toBe("PUSH_REJECTED");
  });

  it("classifies unresolved conflicts before a generic failure", () => {
    expect(
      classifyGitError(gitError("error: you have unmerged paths")).code,
    ).toBe("UNRESOLVED_CONFLICTS");
  });

  it("classifies an in-progress operation", () => {
    expect(
      classifyGitError(
        gitError("fatal: You are in the middle of a rebase"),
      ).code,
    ).toBe("OPERATION_IN_PROGRESS");
  });

  it("classifies a missing git executable ahead of other rules", () => {
    const error = gitError("spawn git ENOENT");
    expect(classifyGitError(error).code).toBe("GIT_EXECUTABLE_NOT_FOUND");
    expect(classifyGitError(error).needsUserAction).toBe(true);
  });

  it("classifies a timeout", () => {
    expect(classifyGitError(gitError("Command failed: ETIMEDOUT")).code).toBe(
      "GIT_COMMAND_TIMEOUT",
    );
  });

  it("classifies auth failures", () => {
    expect(
      classifyGitError(gitError("fatal: Authentication failed for 'origin'")).code,
    ).toBe("AUTH_REQUIRED");
  });

  it("classifies a not-fully-merged branch delete", () => {
    expect(
      classifyGitError(
        gitError("error: the branch 'feat' is not fully merged"),
      ).code,
    ).toBe("BRANCH_NOT_FULLY_MERGED");
  });

  it("classifies a dirty worktree removal", () => {
    expect(
      classifyGitError(
        gitError("fatal: '../wt' contains modified or untracked files"),
      ).code,
    ).toBe("WORKTREE_DIRTY");
  });

  it("classifies a path missing at a ref", () => {
    expect(
      classifyGitError(gitError("fatal: path 'a.txt' does not exist in 'HEAD'"))
        .code,
    ).toBe("PATH_NOT_AT_REF");
  });

  it("falls back to GIT_COMMAND_FAILED for unrecognized output", () => {
    expect(classifyGitError(gitError("something entirely unexpected")).code).toBe(
      "GIT_COMMAND_FAILED",
    );
  });

  it("reads stderr in addition to the error message", () => {
    expect(
      classifyGitError(gitError("Command failed", "No stash entries found")).code,
    ).toBe("NO_STASH_ENTRIES");
  });

  it("handles non-Error values", () => {
    expect(classifyGitError("No local changes to save").code).toBe(
      "NO_LOCAL_CHANGES",
    );
  });

  it("isGitErrorCode narrows to a single code", () => {
    const error = gitError("! [rejected] non-fast-forward");
    expect(isGitErrorCode(error, "PUSH_REJECTED")).toBe(true);
    expect(isGitErrorCode(error, "AUTH_REQUIRED")).toBe(false);
  });
});

describe("summarizeGitError", () => {
  it("strips git severity prefixes and prefers the last meaningful line", () => {
    expect(
      summarizeGitError(gitError("Command failed\nerror: pathspec 'x' did not match")),
    ).toBe("pathspec 'x' did not match");
  });

  it("falls back to a stable string when there is no message", () => {
    expect(summarizeGitError(gitError(""))).toBe("Unknown error");
  });
});
