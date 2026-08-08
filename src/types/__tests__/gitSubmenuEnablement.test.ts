import { describe, expect, it } from "vitest";
import {
  buildGitSubmenuEnablementContext,
  buildGitSubmenuNativeContext,
  evaluateGitSubmenuAction,
} from "../gitSubmenuEnablement";
import type { GitFileStatus } from "../../shared/types/status";

const baseRepo = {
  upstream: "origin/main",
  ahead: 0,
  behind: 0,
  dirty: false,
  trusted: true,
  operation: { type: "none" as const },
  conflictCount: 0,
};

function file(partial: Partial<GitFileStatus> & Pick<GitFileStatus, "path">): GitFileStatus {
  return {
    repoId: "r1",
    kind: "modified",
    indexStatus: " ",
    workingTreeStatus: "M",
    staged: false,
    conflicted: false,
    binary: false,
    ...partial,
  };
}

describe("gitSubmenuEnablement", () => {
  it("keeps unstash enabled with an empty stash list so the dialog can open", () => {
    const result = evaluateGitSubmenuAction("unstash", {
      repository: baseRepo,
      stashCount: 0,
    });
    expect(result.enabled).toBe(true);
  });

  it("enables unstash when stashes exist", () => {
    const result = evaluateGitSubmenuAction("unstash", {
      repository: baseRepo,
      stashCount: 2,
    });
    expect(result.enabled).toBe(true);
  });

  it("enables fetch when a remote is configured even if ahead/behind reads up to date", () => {
    const result = evaluateGitSubmenuAction("fetch", {
      repository: baseRepo,
      hasRemote: true,
    });
    expect(result.enabled).toBe(true);
  });

  it("enables fetch when behind remote", () => {
    const result = evaluateGitSubmenuAction("fetch", {
      repository: { ...baseRepo, behind: 2 },
      hasRemote: true,
    });
    expect(result.enabled).toBe(true);
  });

  it("disables fetch when no remote is configured", () => {
    const result = evaluateGitSubmenuAction("fetch", {
      repository: { ...baseRepo, upstream: null },
      hasRemote: false,
    });
    expect(result.enabled).toBe(false);
  });

  it("disables stash when the worktree is clean", () => {
    const result = evaluateGitSubmenuAction("stash", {
      repository: baseRepo,
      files: [],
    });
    expect(result.enabled).toBe(false);
  });

  it("enables stash when local changes exist", () => {
    const result = evaluateGitSubmenuAction("stash", {
      repository: { ...baseRepo, dirty: true },
    });
    expect(result.enabled).toBe(true);
  });

  it("disables stash during an in-progress merge", () => {
    const result = evaluateGitSubmenuAction("stash", {
      repository: {
        ...baseRepo,
        dirty: true,
        operation: { type: "merge", canContinue: false, canAbort: true },
        conflictCount: 3,
      },
      mergeChangesCount: 3,
    });
    expect(result.enabled).toBe(false);
    expect(result.reason?.toLowerCase()).toMatch(/merge|conflict/);
  });

  it("disables shelve when unresolved conflicts exist", () => {
    const result = evaluateGitSubmenuAction("shelve", {
      repository: {
        ...baseRepo,
        dirty: true,
        operation: { type: "none" },
        conflictCount: 2,
      },
      mergeChangesCount: 2,
    });
    expect(result.enabled).toBe(false);
  });

  it("disables unstash during rebase even when stashes exist", () => {
    const result = evaluateGitSubmenuAction("unstash", {
      repository: {
        ...baseRepo,
        operation: {
          type: "rebase",
          canContinue: true,
          canSkip: false,
          canAbort: true,
        },
      },
      stashCount: 1,
    });
    expect(result.enabled).toBe(false);
  });

  it("disables commit while merge conflicts are unresolved", () => {
    const result = evaluateGitSubmenuAction("commit", {
      repository: {
        ...baseRepo,
        operation: { type: "merge", canContinue: false, canAbort: true },
        conflictCount: 1,
      },
      hasStagedChanges: true,
      mergeChangesCount: 1,
    });
    expect(result.enabled).toBe(false);
    expect(result.reason?.toLowerCase()).toContain("conflict");
  });

  it("exposes native context flags for stash/shelve enablement", () => {
    const flags = buildGitSubmenuNativeContext({
      repository: {
        ...baseRepo,
        dirty: true,
        operation: { type: "merge", canContinue: false, canAbort: true },
        conflictCount: 1,
      },
      mergeChangesCount: 1,
      stashCount: 0,
      shelfCount: 0,
    });
    expect(flags.canStash).toBe(false);
    expect(flags.canShelve).toBe(false);
    expect(flags.canUnstash).toBe(false);
    expect(flags.canUnshelve).toBe(false);
    expect(flags.canIntegrate).toBe(false);
  });


  it("disables unstage when the scoped file is not staged", () => {
    const ctx = buildGitSubmenuEnablementContext({
      repository: { ...baseRepo },
      files: [file({ path: "src/a.ts", staged: false, indexStatus: " " })],
      relativePath: "src/a.ts",
    });
    const result = evaluateGitSubmenuAction("unstage", ctx);
    expect(result.enabled).toBe(false);
  });

  it("enables unstage when the scoped file is staged", () => {
    const ctx = buildGitSubmenuEnablementContext({
      repository: { ...baseRepo },
      files: [file({ path: "src/a.ts", staged: true, indexStatus: "M" })],
      relativePath: "src/a.ts",
    });
    const result = evaluateGitSubmenuAction("unstage", ctx);
    expect(result.enabled).toBe(true);
  });

  it("enables pull when upstream tracking exists even if behind reads zero", () => {
    const result = evaluateGitSubmenuAction("pull", {
      repository: baseRepo,
    });
    expect(result.enabled).toBe(true);
  });

  it("disables pull when there is no upstream branch", () => {
    const result = evaluateGitSubmenuAction("pull", {
      repository: { ...baseRepo, upstream: null },
    });
    expect(result.enabled).toBe(false);
  });

  it("disables push when there is nothing ahead", () => {
    const result = evaluateGitSubmenuAction("push", {
      repository: baseRepo,
    });
    expect(result.enabled).toBe(false);
  });

  it("enables push when commits are ahead of upstream", () => {
    const result = evaluateGitSubmenuAction("push", {
      repository: { ...baseRepo, ahead: 1 },
    });
    expect(result.enabled).toBe(true);
  });
});