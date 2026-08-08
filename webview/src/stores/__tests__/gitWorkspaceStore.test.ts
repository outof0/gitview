import { beforeEach, describe, expect, it } from "vitest";
import type { RepositorySnapshot } from "@gitview/shared/types/repository";
import type {
  GitFileStatus,
  GitFileStatusKind,
  StatusSnapshot,
} from "@gitview/shared/types/status";
import { useGitWorkspaceStore } from "../gitWorkspaceStore";
import type {
  GitWorkspaceActions,
  GitWorkspaceState,
} from "../gitWorkspaceStoreTypes";

function file(
  path: string,
  kind: GitFileStatusKind = "modified",
  overrides: Partial<GitFileStatus> = {},
): GitFileStatus {
  return {
    repoId: "r1",
    path,
    kind,
    indexStatus: " ",
    workingTreeStatus: "M",
    staged: false,
    conflicted: kind === "conflicted",
    binary: false,
    ...overrides,
  };
}

function status(
  files: GitFileStatus[],
  overrides: Partial<StatusSnapshot> = {},
): StatusSnapshot {
  return {
    repoId: "r1",
    files,
    changelists: [],
    mode: "staging",
    showIgnored: false,
    showUnversioned: true,
    refreshedAt: 0,
    ...overrides,
  };
}

const repoSnapshot: RepositorySnapshot = {
  activeRepoId: "r2",
  multiRootDiverged: false,
  repositories: [
    { id: "r1", name: "one" },
    { id: "r2", name: "two" },
  ] as RepositorySnapshot["repositories"],
};

const initial = useGitWorkspaceStore.getState();

describe("gitWorkspaceStore slice", () => {
  beforeEach(() => {
    useGitWorkspaceStore.setState(initial, true);
  });

  it("seeds the commit scope from changed and unversioned files, skipping conflicts", () => {
    useGitWorkspaceStore
      .getState()
      .applyStatusSnapshot(
        status([file("a.ts"), file("new.ts", "unversioned"), file("c.ts", "conflicted")]),
      );

    expect([...useGitWorkspaceStore.getState().commitScope].sort()).toEqual([
      "a.ts",
      "new.ts",
    ]);
  });

  it("keeps an existing commit scope but drops paths that vanished from status", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyStatusSnapshot(status([file("a.ts"), file("b.ts")]));
    store.setCommitScope(["b.ts"]);
    store.applyStatusSnapshot(status([file("a.ts")]));

    expect([...useGitWorkspaceStore.getState().commitScope]).toEqual([]);
  });

  it("restricts visible files to the active changelist", () => {
    useGitWorkspaceStore.getState().applyStatusSnapshot(
      status([file("a.ts"), file("b.ts")], {
        mode: "changelist",
        changelists: [
          {
            id: "cl1",
            repoId: "r1",
            name: "Active",
            active: true,
            filePaths: ["a.ts"],
            createdAt: 0,
            updatedAt: 0,
          },
        ],
      }),
    );

    const state = useGitWorkspaceStore.getState();
    expect(state.visibleFiles().map((f) => f.path)).toEqual(["a.ts"]);
    expect([...(state.activeChangelistPaths() ?? [])]).toEqual(["a.ts"]);
    expect([...state.commitScope]).toEqual(["a.ts"]);
  });

  it("returns null changelist paths in staging mode", () => {
    useGitWorkspaceStore.getState().applyStatusSnapshot(status([file("a.ts")]));
    expect(useGitWorkspaceStore.getState().activeChangelistPaths()).toBeNull();
  });

  it("toggles a path in and out of the commit scope", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyStatusSnapshot(status([file("a.ts")]));
    store.toggleCommitScope("a.ts");
    expect([...useGitWorkspaceStore.getState().commitScope]).toEqual([]);
    store.toggleCommitScope("a.ts");
    expect([...useGitWorkspaceStore.getState().commitScope]).toEqual(["a.ts"]);
  });

  it("reports committable files as the intersection of scope and visible files", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyStatusSnapshot(status([file("a.ts"), file("b.ts")]));
    store.setCommitScope(["b.ts"]);

    expect(
      useGitWorkspaceStore
        .getState()
        .committableFiles()
        .map((f) => f.path),
    ).toEqual(["b.ts"]);
  });

  it("flags the selected file as conflicted", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyStatusSnapshot(status([file("a.ts"), file("c.ts", "conflicted")]));

    store.selectFile("a.ts");
    expect(useGitWorkspaceStore.getState().selectedFileConflicted()).toBe(false);
    store.selectFile("c.ts");
    expect(useGitWorkspaceStore.getState().selectedFileConflicted()).toBe(true);
    store.selectFile(null);
    expect(useGitWorkspaceStore.getState().selectedFileConflicted()).toBe(false);
  });

  it("resolves the active repository from the snapshot", () => {
    expect(useGitWorkspaceStore.getState().activeRepository()).toBeNull();
    useGitWorkspaceStore.getState().applyRepoSnapshot(repoSnapshot);

    const state = useGitWorkspaceStore.getState();
    expect(state.activeRepository()?.id).toBe("r2");
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("opens and closes dialogs by id", () => {
    const store = useGitWorkspaceStore.getState();
    store.openDialog("stash", {});
    store.openDialog("unstash", { index: 2 });
    expect(useGitWorkspaceStore.getState().dialogs).toEqual({
      stash: {},
      unstash: { index: 2 },
    });

    store.closeDialog("stash");
    expect(useGitWorkspaceStore.getState().dialogs).toEqual({
      unstash: { index: 2 },
    });
  });

  it("replaces the log selection on a plain click and accumulates with multi", () => {
    const store = useGitWorkspaceStore.getState();
    store.toggleLogCommitSelection("aaa");
    expect(useGitWorkspaceStore.getState().logSelectedShas).toEqual(["aaa"]);

    store.toggleLogCommitSelection("bbb", true);
    expect(useGitWorkspaceStore.getState().logSelectedShas).toEqual([
      "aaa",
      "bbb",
    ]);
    expect(useGitWorkspaceStore.getState().logSelectedSha).toBe("bbb");

    store.toggleLogCommitSelection("bbb", true);
    let state = useGitWorkspaceStore.getState();
    expect(state.logSelectedShas).toEqual(["aaa"]);
    expect(state.logSelectedSha).toBe("aaa");

    store.toggleLogCommitSelection("ccc");
    expect(useGitWorkspaceStore.getState().logSelectedShas).toEqual(["ccc"]);

    store.clearLogCommitSelection();
    state = useGitWorkspaceStore.getState();
    expect(state.logSelectedShas).toEqual([]);
    expect(state.logSelectedSha).toBeNull();
  });

  it("opens the branch compare view with the first file preselected and clears it", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyBranchCompareSnapshot({
      files: [{ path: "a.ts" }, { path: "b.ts" }],
    } as never);

    let state = useGitWorkspaceStore.getState();
    expect(state.branchCompareOpen).toBe(true);
    expect(state.branchCompareSelectedFile).toBe("a.ts");

    store.clearBranchCompare();
    state = useGitWorkspaceStore.getState();
    expect(state.branchCompareOpen).toBe(false);
    expect(state.branchCompareSnapshot).toBeNull();
    expect(state.branchCompareSelectedFile).toBeNull();
    expect(state.diffDocument).toBeNull();
  });

  // Nearly every remaining action is a one-line setter, so the realistic bug is
  // a copy-pasted action writing a neighbouring field. Assert the mapping.
  const setters: Array<
    [keyof GitWorkspaceActions, unknown[], Partial<GitWorkspaceState>]
  > = [
    ["setLoading", [true], { loading: true }],
    ["setError", ["boom"], { error: "boom" }],
    ["applyBranchSnapshot", [{ branches: [] }], { branchesLoading: false }],
    ["setBranchCompareOpen", [true], { branchCompareOpen: true }],
    ["setBranchCompareSelectedFile", ["a.ts"], { branchCompareSelectedFile: "a.ts" }],
    ["setBranchesOpen", [true], { branchesOpen: true }],
    ["setBranchesLoading", [true], { branchesLoading: true }],
    ["setCommitMessage", ["msg"], { commitMessage: "msg" }],
    ["setAmend", [true], { amend: true }],
    ["setSignoff", [true], { signoff: true }],
    ["setGpgSign", [true], { gpgSign: true }],
    ["setAuthor", ["a@b.c"], { author: "a@b.c" }],
    ["setRunChecks", [false], { runChecks: false }],
    ["setPullStrategy", ["rebase"], { pullStrategy: "rebase" }],
    ["setSynchronousBranchControl", [false], { synchronousBranchControl: false }],
    ["setWorkspaceTab", ["log"], { workspaceTab: "log" }],
    ["setTemporarySubTab", ["shelf"], { temporarySubTab: "shelf" }],
    ["setTagsOpen", [true], { tagsOpen: true }],
    ["setTagsLoading", [true], { tagsLoading: true }],
    ["applyTagSnapshot", [{ tags: [] }], { tagsLoading: false }],
    ["setWorktreesOpen", [true], { worktreesOpen: true }],
    ["setWorktreesLoading", [true], { worktreesLoading: true }],
    ["applyWorktreeSnapshot", [{ worktrees: [] }], { worktreesLoading: false }],
    ["setPatchPreview", ["diff"], { patchPreview: "diff" }],
    ["setBlameLoading", [true], { blameLoading: true }],
    ["setBlameError", ["boom"], { blameError: "boom", blameLoading: false }],
    ["clearWorkspaceNotification", [], { workspaceNotification: null }],
    ["setLogLoading", [true], { logLoading: true }],
    ["setLogError", ["boom"], { logError: "boom", logLoading: false }],
    ["selectLogFile", ["a.ts"], { logSelectedFilePath: "a.ts" }],
    ["setLogFilters", [{ range: "head", limit: 10 }], {
      logFilters: { range: "head", limit: 10 },
    }],
    ["setIssueTrackerBaseUrl", ["https://x"], { issueTrackerBaseUrl: "https://x" }],
    ["setDiffStagedView", [true], { diffStagedView: true }],
    ["setDiffViewMode", ["unified"], { diffViewMode: "unified" }],
    ["setWhitespacePolicy", ["ignoreWhitespaces"], {
      whitespacePolicy: "ignoreWhitespaces",
    }],
    ["setCommitAfterChecksConfirmed", [true], { commitAfterChecksConfirmed: true }],
    ["setReviewLoading", [true], { reviewLoading: true }],
    ["setReviewError", ["boom"], { reviewError: "boom", reviewLoading: false }],
    ["setReviewFilters", [{ state: "merged", sort: "created" }], {
      reviewFilters: { state: "merged", sort: "created" },
    }],
    ["setSelectedReviewId", ["7"], { selectedReviewId: "7" }],
  ] as never;

  it.each(setters)("%s writes only its own state", (action, args, expected) => {
    (
      useGitWorkspaceStore.getState()[action] as (...a: unknown[]) => void
    )(...args);
    expect(useGitWorkspaceStore.getState()).toMatchObject(expected);
  });

  it("stores the snapshots the host pushes", () => {
    const store = useGitWorkspaceStore.getState();
    store.setBlameLoading(true);
    store.applyBlameSnapshot({ lines: [] } as never);
    store.setLogLoading(true);
    store.applyLogSnapshot({ commits: [] } as never);
    store.applyStashSnapshot({ entries: [] } as never);
    store.applyShelfSnapshot({ entries: [] } as never);
    store.setReviewLoading(true);
    store.applyReviewSnapshot({ reviews: [] } as never);
    store.applyReviewDetails({ id: "7" } as never);
    store.setWorkspaceNotification({ kind: "info", message: "hi" } as never);
    store.selectLogCommit("aaa");

    const state = useGitWorkspaceStore.getState();
    expect(state.blameLoading).toBe(false);
    expect(state.blameError).toBeNull();
    expect(state.logLoading).toBe(false);
    expect(state.logError).toBeNull();
    expect(state.stashSnapshot).toEqual({ entries: [] });
    expect(state.shelfSnapshot).toEqual({ entries: [] });
    expect(state.reviewLoading).toBe(false);
    expect(state.reviewDetails).toEqual({ id: "7" });
    expect(state.workspaceNotification).toEqual({ kind: "info", message: "hi" });
    expect(state.logSelectedShas).toEqual(["aaa"]);
  });

  it("clears diff loading and error when a document arrives", () => {
    const store = useGitWorkspaceStore.getState();
    store.setDiffLoading(true);
    store.setDiffError("boom");
    expect(useGitWorkspaceStore.getState().diffLoading).toBe(false);

    store.setDiffLoading(true);
    store.setDiffDocument({ files: [] } as never);
    const state = useGitWorkspaceStore.getState();
    expect(state.diffLoading).toBe(false);
    expect(state.diffError).toBeNull();
  });
});
