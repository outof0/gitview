import { describe, expect, it } from "vitest";
import {
  createDropCommitConfirmationEvidence,
  createDropSelectedConfirmationEvidence,
  createForceCheckoutConfirmationEvidence,
  createHardResetConfirmationEvidence,
  createMultiRootForceCheckoutConfirmationEvidence,
  createRemoveDirtyWorktreeConfirmationEvidence,
  createRollbackConfirmationEvidence,
} from "../../shared/types/confirmation";
import {
  requireDropCommitConfirmation,
  requireDropSelectedConfirmation,
  requireForceCheckoutConfirmation,
  requireHardResetConfirmation,
  requireMultiRootForceCheckoutConfirmation,
  requireDirtyWorktreeRemovalConfirmation,
  requireRollbackConfirmation,
  validateMutationPreconditions,
} from "../mutationPreconditions";

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
  changeDigest: null,
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

  it("returns host-generated evidence for a hard reset", () => {
    const result = requireHardResetConfirmation(repo, "target");

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "CONFIRMATION_REQUIRED",
        details: {
          confirmation: {
            action: "hard_reset",
            repoId: repo.id,
            targetSha: "target",
            expectedTypedValue: "main",
          },
        },
      },
    });
  });

  it("rejects stale or incorrectly typed hard reset evidence", () => {
    const evidence = createHardResetConfirmationEvidence(repo, "target");

    expect(
      requireHardResetConfirmation(
        { ...repo, headSha: "new-head" },
        "target",
        { evidence, typedValue: "main" },
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
    expect(
      requireHardResetConfirmation(repo, "target", {
        evidence,
        typedValue: "wrong",
      }),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });
  });

  it("accepts exact current hard reset evidence", () => {
    const evidence = createHardResetConfirmationEvidence(repo, "target");

    expect(
      requireHardResetConfirmation(repo, "target", {
        evidence,
        typedValue: evidence.expectedTypedValue,
      }),
    ).toEqual({ ok: true });
  });

  it("revalidates commit drop evidence", () => {
    const evidence = createDropCommitConfirmationEvidence(repo, "def456789");

    expect(
      requireDropCommitConfirmation(repo, "def456789", {
        evidence,
        typedValue: evidence.expectedTypedValue,
      }),
    ).toEqual({ ok: true });
    expect(
      requireDropCommitConfirmation(
        { ...repo, headSha: "new-head" },
        "def456789",
        { evidence, typedValue: evidence.expectedTypedValue },
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
  });

  it("revalidates force checkout target and repository state", () => {
    const evidence = createForceCheckoutConfirmationEvidence(
      repo,
      "feature",
      "def456",
    );

    expect(
      requireForceCheckoutConfirmation(repo, "feature", "def456", {
        evidence,
        typedValue: "feature",
      }),
    ).toEqual({ ok: true });
    expect(
      requireForceCheckoutConfirmation(repo, "feature", "moved", {
        evidence,
        typedValue: "feature",
      }),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
  });

  it("revalidates every multi-root force checkout target", () => {
    const otherRepo = {
      ...repo,
      id: "repo-2",
      name: "other",
      headSha: "xyz",
      currentBranch: "develop",
    };
    const targets = [
      { repository: repo, targetSha: "feature-1" },
      { repository: otherRepo, targetSha: "feature-2" },
    ];
    const evidence = createMultiRootForceCheckoutConfirmationEvidence(
      repo,
      "feature",
      targets,
    );

    expect(
      requireMultiRootForceCheckoutConfirmation(repo, "feature", targets, {
        evidence,
        typedValue: "feature",
      }),
    ).toEqual({ ok: true });
    expect(
      requireMultiRootForceCheckoutConfirmation(
        repo,
        "feature",
        [targets[0]!, { repository: otherRepo, targetSha: "moved" }],
        { evidence, typedValue: "feature" },
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
  });

  it("revalidates dirty worktree target state", () => {
    const target = {
      path: "/repo-worktree",
      headSha: "def456",
      branch: "feature",
      dirty: true,
    };
    const evidence = createRemoveDirtyWorktreeConfirmationEvidence(repo, target);

    expect(
      requireDirtyWorktreeRemovalConfirmation(repo, target, {
        evidence,
        typedValue: target.path,
      }),
    ).toEqual({ ok: true });
    expect(
      requireDirtyWorktreeRemovalConfirmation(
        repo,
        { ...target, headSha: "moved" },
        { evidence, typedValue: target.path },
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
    expect(
      requireDirtyWorktreeRemovalConfirmation(repo, target, {
        evidence,
        typedValue: "wrong",
      }),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });
  });

  it("revalidates rollback paths and unversioned classification", () => {
    const paths = ["tracked.ts", "untracked.txt"];
    const unversionedPaths = ["untracked.txt"];
    const evidence = createRollbackConfirmationEvidence(
      repo,
      paths,
      unversionedPaths,
    );

    expect(
      requireRollbackConfirmation(repo, paths, unversionedPaths, {
        evidence,
        typedValue: evidence.expectedTypedValue,
      }),
    ).toEqual({ ok: true });
    expect(
      requireRollbackConfirmation(repo, paths, [], {
        evidence,
        typedValue: evidence.expectedTypedValue,
      }),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
    expect(
      requireRollbackConfirmation(repo, paths, unversionedPaths, {
        evidence,
        typedValue: "ROLLBACK",
      }),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });
  });

  it("revalidates the selected path and exact selection", () => {
    const selection = { hunkIndexes: [0, 2] };
    const evidence = createDropSelectedConfirmationEvidence(
      repo,
      "abc123456",
      "src/app.ts",
      selection,
    );

    expect(
      requireDropSelectedConfirmation(
        repo,
        "abc123456",
        "src/app.ts",
        selection,
        { evidence, typedValue: evidence.expectedTypedValue },
      ),
    ).toEqual({ ok: true });
    expect(
      requireDropSelectedConfirmation(
        repo,
        "abc123456",
        "src/app.ts",
        { hunkIndexes: [1] },
        { evidence, typedValue: evidence.expectedTypedValue },
      ),
    ).toMatchObject({ ok: false, error: { code: "CONFIRMATION_STALE" } });
  });
});
