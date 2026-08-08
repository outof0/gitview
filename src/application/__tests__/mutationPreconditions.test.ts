import { describe, expect, it } from "vitest";
import { validateMutationPreconditions } from "../mutationPreconditions";

const repo = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: "abc",
  upstream: null,
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" as const },
  ahead: null,
  behind: null,
  conflictCount: 0,
  dirty: false,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

describe("mutation preconditions", () => {
  it("blocks untrusted workspaces", () => {
    const result = validateMutationPreconditions({
      trusted: false,
      repository: repo,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("WORKSPACE_UNTRUSTED");
    }
  });

  it("blocks missing repository", () => {
    const result = validateMutationPreconditions({
      trusted: true,
      repository: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("REPOSITORY_NOT_FOUND");
    }
  });

  it("blocks protected branch destructive actions", () => {
    const result = validateMutationPreconditions({
      trusted: true,
      repository: repo,
      protectedCheck: {
        allowed: false,
        action: "hard_reset",
        reason: "protected",
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROTECTED_BRANCH");
    }
  });

  it("allows valid mutation context", () => {
    const result = validateMutationPreconditions({
      trusted: true,
      repository: repo,
    });
    expect(result.ok).toBe(true);
  });
});
