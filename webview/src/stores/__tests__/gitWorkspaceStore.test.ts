import { beforeEach, describe, expect, it } from "vitest";
import type { RepositorySnapshot } from "@gitview/shared/types/repository";
import type { SyncOperationEvent } from "@gitview/shared/types/sync";
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

function syncEvent(
  overrides: Partial<SyncOperationEvent> = {},
): SyncOperationEvent {
  return {
    operationId: "sync-1",
    requestId: "fetch-1",
    operation: "fetch",
    repoIds: ["r1"],
    sequence: 1,
    timestamp: 1,
    state: "accepted",
    phase: "preparing",
    cancellable: true,
    ...overrides,
  } as SyncOperationEvent;
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

  it("preserves mutation errors during background repository refresh", () => {
    const store = useGitWorkspaceStore.getState();
    store.setError("Repository state changed");

    store.applyRepoSnapshot(repoSnapshot);

    expect(useGitWorkspaceStore.getState().error).toBe(
      "Repository state changed",
    );
  });

  it("rejects status for a repository that is not active", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyRepoSnapshot(repoSnapshot);
    store.applyStatusSnapshot(status([file("stale.ts")], { repoId: "r1" }));

    expect(useGitWorkspaceStore.getState().statusSnapshot).toBeNull();
  });

  it("rejects branch, log, and diff snapshots for a repository that is not active", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyRepoSnapshot(repoSnapshot);
    store.applyBranchSnapshot({ repoId: "r1", branches: [], refreshedAt: 0 });
    store.applyLogSnapshot({
      repoId: "r1",
      branch: "main",
      commits: [],
      refreshedAt: 0,
    });
    store.setDiffDocument({
      repoId: "r1",
      filePath: "a.ts",
      layout: "split",
      status: "M",
      left: null,
      right: null,
      binary: false,
      staged: false,
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.branchSnapshot).toBeNull();
    expect(state.logSnapshot).toBeNull();
    expect(state.diffDocument).toBeNull();
  });

  it("resets mutation-form state when the active repository changes", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyRepoSnapshot({ ...repoSnapshot, activeRepoId: "r1" });
    store.setCommitMessage("repo A message");
    store.setAmend(true);
    store.setSignoff(true);
    store.setGpgSign(true);
    store.setAuthor("A U Thor <a@example.com>");
    store.setRunChecks(false);
    store.selectLogCommit("abc123");

    store.applyRepoSnapshot(repoSnapshot);

    const state = useGitWorkspaceStore.getState();
    expect(state.commitMessage).toBe("");
    expect(state.amend).toBe(false);
    expect(state.signoff).toBe(false);
    expect(state.gpgSign).toBe(false);
    expect(state.author).toBe("");
    expect(state.runChecks).toBe(true);
    expect(state.logSelectedSha).toBeNull();
    expect(state.logSelectedShas).toEqual([]);
  });

  it("applies only newer lifecycle events for each sync operation", () => {
    const store = useGitWorkspaceStore.getState();
    store.applySyncOperation(syncEvent());
    store.applySyncOperation(
      syncEvent({ state: "running", phase: "fetching", sequence: 2 }),
    );
    store.markSyncOperationOutcomeUnknown("sync-1");
    store.applySyncOperation(
      syncEvent({ state: "running", phase: "refreshing", sequence: 2 }),
    );
    store.applySyncOperation(syncEvent({ sequence: 1 }));

    let operation = useGitWorkspaceStore
      .getState()
      .syncOperationForRepository("r1", "fetch");
    expect(operation).toMatchObject({
      outcomeUnknown: true,
      event: { state: "running", phase: "fetching", sequence: 2 },
    });

    store.applySyncOperation(
      syncEvent({
        state: "completed",
        sequence: 3,
        outcome: { kind: "success" },
      }),
    );
    operation = useGitWorkspaceStore
      .getState()
      .syncOperationForRepository("r1", "fetch");
    expect(operation).toMatchObject({
      outcomeUnknown: false,
      event: { state: "completed", sequence: 3 },
    });
  });

  it("keeps cancellation requested and rejected operations active until confirmation", () => {
    const store = useGitWorkspaceStore.getState();
    store.applySyncOperation(
      syncEvent({ state: "running", phase: "fetching", sequence: 2 }),
    );
    store.applySyncOperation(
      syncEvent({
        state: "cancel_requested",
        phase: "fetching",
        sequence: 3,
      }),
    );
    expect(
      store.syncOperationForRepository("r1", "fetch")?.event.state,
    ).toBe("cancel_requested");

    store.applySyncOperation(
      syncEvent({
        state: "cancel_rejected",
        phase: "refreshing",
        reason: "not_cancellable",
        message: "Refresh cannot be cancelled.",
        cancellable: false,
        sequence: 4,
      }),
    );
    expect(
      store.syncOperationForRepository("r1", "fetch")?.event.state,
    ).toBe("cancel_rejected");

    store.applySyncOperation(
      syncEvent({
        state: "cancel_confirmed",
        outcome: { kind: "cancelled", message: "Cancelled." },
        sequence: 5,
      }),
    );
    expect(
      store.syncOperationForRepository("r1", "fetch")?.event.state,
    ).toBe("cancel_confirmed");
  });

  it("does not let a late terminal event replace a newer active operation", () => {
    const store = useGitWorkspaceStore.getState();
    store.applySyncOperation(
      syncEvent({ state: "running", phase: "fetching", sequence: 2 }),
    );
    store.applySyncOperation(
      syncEvent({
        operationId: "sync-2",
        requestId: "fetch-2",
        sequence: 1,
        timestamp: 2,
      }),
    );
    store.applySyncOperation(
      syncEvent({
        state: "failed",
        sequence: 3,
        outcome: { kind: "offline", message: "Offline." },
      }),
    );

    expect(
      store.syncOperationForRepository("r1", "fetch")?.event.operationId,
    ).toBe("sync-2");
  });

  it("preserves a typed draft across initial hydration", () => {
    const store = useGitWorkspaceStore.getState();
    expect(store.repoSnapshot).toBeNull();
    store.setCommitMessage("typed while booting");
    store.setAmend(true);

    store.applyRepoSnapshot(repoSnapshot);

    const state = useGitWorkspaceStore.getState();
    expect(state.commitMessage).toBe("typed while booting");
    expect(state.amend).toBe(true);
  });

  it("resets the draft when replacing an established repository", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyRepoSnapshot({ ...repoSnapshot, activeRepoId: "r1" });
    store.setCommitMessage("repo A message");
    store.setAmend(true);

    store.applyRepoSnapshot(repoSnapshot);

    const state = useGitWorkspaceStore.getState();
    expect(state.commitMessage).toBe("");
    expect(state.amend).toBe(false);
  });

  it("clears repository-dependent state when the active repository changes", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyRepoSnapshot({ ...repoSnapshot, activeRepoId: "r1" });
    store.applyStatusSnapshot(status([file("a.ts")]));
    store.selectFile("a.ts");

    store.applyRepoSnapshot(repoSnapshot);

    const state = useGitWorkspaceStore.getState();
    expect(state.statusSnapshot).toBeNull();
    expect(state.selectedFilePath).toBeNull();
    expect([...state.commitScope]).toEqual([]);
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

  it("focuses the repository-root log and clears scoped view state", () => {
    const store = useGitWorkspaceStore.getState();
    store.setLogFilters({
      range: "incoming",
      limit: 10,
      branch: "feature/old",
      path: "packages/old",
      isFolder: true,
    });
    store.requestHistoryOpen({
      repoId: "r1",
      path: "packages/old",
      isFolder: true,
    });
    store.selectLogCommit("abc123");
    store.selectLogFile("packages/old/file.ts");
    store.openDialog("stash", {});
    store.setBranchesOpen(true);

    const requestBefore = useGitWorkspaceStore.getState().logRootRequest;
    store.focusLogRoot();

    const state = useGitWorkspaceStore.getState();
    expect(state.logRootRequest).toBe(requestBefore + 1);
    expect(state.workspaceTab).toBe("log");
    expect(state.logFilters).toEqual({ range: "all", limit: 200 });
    expect(state.historyOpenRequest).toBeNull();
    expect(state.activeHistoryScope).toBeNull();
    expect(state.logSelectedSha).toBeNull();
    expect(state.logSelectedShas).toEqual([]);
    expect(state.logSelectedFilePath).toBeNull();
    expect(state.logSnapshot).toBeNull();
    expect(state.diffDocument).toBeNull();
    expect(state.dialogs).toEqual({});
    expect(state.branchesOpen).toBe(false);
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
    expect(state.logLoading).toBe(false);
    expect(state.logError).toBeNull();
    expect(state.stashSnapshot).toEqual({ entries: [] });
    expect(state.shelfSnapshot).toEqual({ entries: [] });
    expect(state.reviewLoading).toBe(false);
    expect(state.reviewDetails).toEqual({ id: "7" });
    expect(state.workspaceNotification).toEqual({ kind: "info", message: "hi" });
    expect(state.logSelectedShas).toEqual(["aaa"]);
  });

  it("fills an existing merge node from lazy commit detail", () => {
    const store = useGitWorkspaceStore.getState();
    store.applyRepoSnapshot({ ...repoSnapshot, activeRepoId: "r1" });
    store.applyLogSnapshot({
      repoId: "r1",
      branch: "main",
      refreshedAt: 1,
      commits: [
        {
          sha: "merge-sha",
          shortSha: "merge",
          author: "Jane",
          authorEmail: "jane@example.com",
          authorTime: 1,
          subject: "Merge feature",
          isMerge: true,
          refs: ["main"],
          changedFiles: [],
        },
      ],
    });

    store.applyLogCommitDetail("r1", {
      sha: "merge-sha",
      shortSha: "merge",
      author: "Jane",
      authorEmail: "jane@example.com",
      authorTime: 1,
      subject: "Merge feature",
      isMerge: true,
      changedFiles: [{ path: "src/feature.ts", status: "A" }],
    });

    expect(useGitWorkspaceStore.getState().logSnapshot?.commits[0]).toMatchObject({
      refs: ["main"],
      changedFiles: [{ path: "src/feature.ts", status: "A" }],
    });
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
