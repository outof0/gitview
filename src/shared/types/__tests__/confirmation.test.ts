import { describe, expect, it } from "vitest";
import {
  createDropCommitConfirmationEvidence,
  createDropSelectedConfirmationEvidence,
  createForceCheckoutConfirmationEvidence,
  createHardResetConfirmationEvidence,
  createMultiRootForceCheckoutConfirmationEvidence,
  createRemoveDirtyWorktreeConfirmationEvidence,
  createRollbackConfirmationEvidence,
  isConfirmationEvidence,
  isConfirmationSubmission,
  matchesRepositoryFingerprint,
  matchesRollbackConfirmationPaths,
  matchesSelectedChangesConfirmationSelection,
} from "../confirmation";

const repository = {
  id: "repo-1",
  headSha: "abc123",
  currentBranch: "main",
  dirty: true,
  conflictCount: 0,
  changeDigest: null,
  operation: { type: "none" as const },
};

describe("confirmation evidence", () => {
  it("captures the destructive target and repository state", () => {
    const evidence = createHardResetConfirmationEvidence(repository, "def456");

    expect(evidence).toEqual({
      version: 1,
      action: "hard_reset",
      repoId: "repo-1",
      targetSha: "def456",
      resetMode: "hard",
      expectedTypedValue: "main",
      repository: {
        headSha: "abc123",
        currentBranch: "main",
        dirty: true,
        conflictCount: 0,
        changeDigest: null,
        operation: "none",
      },
    });
    expect(isConfirmationEvidence(evidence)).toBe(true);
    expect(
      isConfirmationSubmission({ evidence, typedValue: "main" }),
    ).toBe(true);
  });

  it("captures commit and selected-change drop targets", () => {
    const commit = createDropCommitConfirmationEvidence(repository, "def456789");
    const selected = createDropSelectedConfirmationEvidence(
      repository,
      "abc123456",
      "src/app.ts",
      { hunkIndexes: [0, 2] },
    );

    expect(commit).toMatchObject({
      action: "drop_commit",
      targetSha: "def456789",
      expectedTypedValue: "def4567",
    });
    expect(selected).toMatchObject({
      action: "drop_selected",
      targetSha: "abc123456",
      path: "src/app.ts",
      selection: { hunkIndexes: [0, 2], lines: [] },
      expectedTypedValue: "abc1234",
    });
    expect(isConfirmationEvidence(commit)).toBe(true);
    expect(isConfirmationEvidence(selected)).toBe(true);
    expect(
      matchesSelectedChangesConfirmationSelection(
        { hunkIndexes: [0, 2] },
        selected.selection,
      ),
    ).toBe(true);
    expect(
      matchesSelectedChangesConfirmationSelection(
        { hunkIndexes: [0, 1] },
        selected.selection,
      ),
    ).toBe(false);
  });

  it("captures rollback paths and unversioned deletion intent", () => {
    const evidence = createRollbackConfirmationEvidence(
      repository,
      ["tracked.ts", "untracked.txt"],
      ["untracked.txt"],
    );

    expect(evidence).toMatchObject({
      action: "rollback",
      paths: ["tracked.ts", "untracked.txt"],
      unversionedPaths: ["untracked.txt"],
      expectedTypedValue: "DELETE",
    });
    expect(isConfirmationEvidence(evidence)).toBe(true);
    expect(
      matchesRollbackConfirmationPaths(
        ["tracked.ts", "untracked.txt"],
        ["untracked.txt"],
        evidence,
      ),
    ).toBe(true);
    expect(
      matchesRollbackConfirmationPaths(
        ["tracked.ts", "untracked.txt"],
        [],
        evidence,
      ),
    ).toBe(false);
  });

  it("captures single and multi-root force checkout targets", () => {
    const single = createForceCheckoutConfirmationEvidence(
      repository,
      "feature",
      "def456",
    );
    const multi = createMultiRootForceCheckoutConfirmationEvidence(
      repository,
      "feature",
      [
        { repository: { ...repository, id: "repo-2" }, targetSha: "222" },
        { repository, targetSha: "111" },
      ],
    );

    expect(single).toMatchObject({
      action: "force_checkout",
      targetRef: "feature",
      targetSha: "def456",
      expectedTypedValue: "feature",
    });
    expect(multi).toMatchObject({
      action: "force_checkout_multi",
      targetRef: "feature",
      targets: [
        { repoId: "repo-1", targetSha: "111" },
        { repoId: "repo-2", targetSha: "222" },
      ],
      expectedTypedValue: "feature",
    });
    expect(isConfirmationEvidence(single)).toBe(true);
    expect(isConfirmationEvidence(multi)).toBe(true);
  });

  it("captures the exact dirty worktree removal target", () => {
    const target = {
      path: "/repo-worktree",
      headSha: "def456",
      branch: "feature",
      dirty: true,
    };
    const evidence = createRemoveDirtyWorktreeConfirmationEvidence(
      repository,
      target,
    );

    expect(evidence).toMatchObject({
      action: "remove_dirty_worktree",
      target,
      expectedTypedValue: "/repo-worktree",
    });
    expect(isConfirmationEvidence(evidence)).toBe(true);
    expect(
      isConfirmationEvidence({
        ...evidence,
        target: { ...target, extra: true },
      }),
    ).toBe(false);
  });

  it("detects repository state changes after preflight", () => {
    const evidence = createHardResetConfirmationEvidence(repository, "def456");

    expect(matchesRepositoryFingerprint(repository, evidence.repository)).toBe(
      true,
    );
    expect(
      matchesRepositoryFingerprint(
        { ...repository, headSha: "new-head" },
        evidence.repository,
      ),
    ).toBe(false);
    expect(
      matchesRepositoryFingerprint(
        { ...repository, dirty: false },
        evidence.repository,
      ),
    ).toBe(false);
  });

  it("rejects malformed or extended evidence", () => {
    const evidence = createHardResetConfirmationEvidence(repository, "def456");
    const rollback = createRollbackConfirmationEvidence(
      repository,
      ["untracked.txt"],
      ["untracked.txt"],
    );

    expect(isConfirmationEvidence({ ...evidence, targetSha: "" })).toBe(false);
    expect(
      isConfirmationEvidence({
        ...rollback,
        unversionedPaths: ["other.txt"],
      }),
    ).toBe(false);
    expect(isConfirmationEvidence({ ...rollback, extra: true })).toBe(false);
    expect(isConfirmationEvidence({ ...evidence, extra: true })).toBe(false);
    expect(
      isConfirmationSubmission({
        evidence: { ...evidence, action: "force_push" },
        typedValue: "main",
      }),
    ).toBe(false);
    expect(
      isConfirmationSubmission({ evidence, typedValue: "main", extra: true }),
    ).toBe(false);
  });
});
