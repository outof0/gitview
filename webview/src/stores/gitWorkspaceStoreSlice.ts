import type { BlameSnapshot } from "@gitview/shared/types/blame";
import type {
  BranchCompareSnapshot,
  BranchListSnapshot,
} from "@gitview/shared/types/branch";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { LogQueryFilters, LogSnapshot } from "@gitview/shared/types/log";
import type { RepositorySnapshot } from "@gitview/shared/types/repository";
import type { ShelfListSnapshot } from "@gitview/shared/types/shelf";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import type { GitFileStatus, StatusSnapshot } from "@gitview/shared/types/status";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";
import type {
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewListSnapshot,
} from "@gitview/shared/types/review";
import type { StoreApi } from "zustand";
import { groupWorkspaceFiles } from "../lib/groupWorkspaceFiles";
import type {
  GitWorkspaceDialogId,
  GitWorkspaceDialogPayloads,
} from "./gitWorkspaceDialogs";
import type { GitWorkspaceActions, GitWorkspaceState } from "./gitWorkspaceStoreTypes";

type SetState = StoreApi<GitWorkspaceState & GitWorkspaceActions>["setState"];
type GetState = StoreApi<GitWorkspaceState & GitWorkspaceActions>["getState"];

function defaultCommitScope(files: GitFileStatus[]): Set<string> {
  const groups = groupWorkspaceFiles(files);
  return new Set(
    [...groups.changes, ...groups.unversioned].map((file) => file.path),
  );
}

export function createGitWorkspaceStoreSlice(set: SetState, get: GetState) {
  return {
    setLoading: (loading: boolean) => set({ loading }),
    openDialog: <K extends GitWorkspaceDialogId>(
      id: K,
      payload: GitWorkspaceDialogPayloads[K],
    ) =>
      set({
        dialogs: { ...get().dialogs, [id]: payload },
        nativeFocusSurface: null,
      }),
    // A native menu entry is a fresh top-level intent, so it replaces every open
    // dialog and list popup instead of stacking on top of them. In-app flows keep
    // using `openDialog`, which still layers (commit → commit-check warnings).
    openExclusiveDialog: <K extends GitWorkspaceDialogId>(
      id: K,
      payload: GitWorkspaceDialogPayloads[K],
    ) => set({ dialogs: { [id]: payload }, branchesOpen: false }),
    closeAllDialogs: () => set({ dialogs: {} }),
    closeDialog: (id: GitWorkspaceDialogId) => {
      const { [id]: _closed, ...rest } = get().dialogs;
      set({
        dialogs: rest,
        nativeFocusSurface:
          get().nativeFocusSurface === id ? null : get().nativeFocusSurface,
      });
    },
    setNativeFocusSurface: (surface: GitWorkspaceState["nativeFocusSurface"]) =>
      set({ nativeFocusSurface: surface }),
    setError: (error: string | null) => set({ error }),
    applyRepoSnapshot: (snapshot: RepositorySnapshot) =>
      set({
        repoSnapshot: snapshot,
        loading: false,
        error: null,
      }),
    applyStatusSnapshot: (snapshot: StatusSnapshot) => {
      const prevScope = get().commitScope;
      const activeList =
        snapshot.mode === "changelist"
          ? snapshot.changelists.find((list) => list.active)
          : undefined;
      const visible =
        activeList
          ? snapshot.files.filter((file) => activeList.filePaths.includes(file.path))
          : snapshot.files;
      const nextDefault = defaultCommitScope(visible);
      const commitScope =
        prevScope.size === 0 ? nextDefault : (
          new Set([...prevScope].filter((p) => nextDefault.has(p)))
        );
      set({
        statusSnapshot: snapshot,
        commitScope,
      });
    },
    applyBranchSnapshot: (snapshot: BranchListSnapshot) =>
      set({ branchSnapshot: snapshot, branchesLoading: false }),
    applyBranchCompareSnapshot: (snapshot: BranchCompareSnapshot | null) =>
      set({
        branchCompareSnapshot: snapshot,
        branchCompareOpen: snapshot !== null,
        branchCompareSelectedFile: snapshot?.files[0]?.path ?? null,
      }),
    setBranchCompareOpen: (open: boolean) => set({ branchCompareOpen: open }),
    setBranchCompareSelectedFile: (path: string | null) =>
      set({ branchCompareSelectedFile: path }),
    clearBranchCompare: () =>
      set({
        branchCompareSnapshot: null,
        branchCompareOpen: false,
        branchCompareSelectedFile: null,
        diffDocument: null,
        diffError: null,
      }),
    setBranchesOpen: (open: boolean) =>
      set({
        branchesOpen: open,
        nativeFocusSurface:
          !open && get().nativeFocusSurface === "branches"
            ? null
            : get().nativeFocusSurface,
      }),
    setBranchesLoading: (loading: boolean) => set({ branchesLoading: loading }),
    setDiffDocument: (document: WorkspaceDiffDocument | null) =>
      set({ diffDocument: document, diffLoading: false, diffError: null }),
    setDiffLoading: (loading: boolean) => set({ diffLoading: loading }),
    setDiffError: (error: string | null) =>
      set({ diffError: error, diffLoading: false }),
    selectFile: (path: string | null) => set({ selectedFilePath: path }),
    toggleCommitScope: (path: string) => {
      const scope = new Set(get().commitScope);
      if (scope.has(path)) {
        scope.delete(path);
      } else {
        scope.add(path);
      }
      set({ commitScope: scope });
    },
    setCommitScope: (paths: Iterable<string>) => set({ commitScope: new Set(paths) }),
    setCommitMessage: (message: string) => set({ commitMessage: message }),
    setAmend: (amend: boolean) => set({ amend }),
    setSignoff: (signoff: boolean) => set({ signoff }),
    setGpgSign: (gpgSign: boolean) => set({ gpgSign }),
    setAuthor: (author: string) => set({ author }),
    setRunChecks: (runChecks: boolean) => set({ runChecks }),
    setPullStrategy: (pullStrategy: GitWorkspaceState["pullStrategy"]) =>
      set({ pullStrategy }),
    setSynchronousBranchControl: (enabled: boolean) =>
      set({ synchronousBranchControl: enabled }),
    setWorkspaceTab: (tab: GitWorkspaceState["workspaceTab"]) =>
      set({ workspaceTab: tab }),
    setTemporarySubTab: (tab: GitWorkspaceState["temporarySubTab"]) =>
      set({ temporarySubTab: tab }),
    applyStashSnapshot: (snapshot: StashListSnapshot) =>
      set({ stashSnapshot: snapshot }),
    applyShelfSnapshot: (snapshot: ShelfListSnapshot) =>
      set({ shelfSnapshot: snapshot }),
    setTagsOpen: (open: boolean) => set({ tagsOpen: open }),
    setTagsLoading: (loading: boolean) => set({ tagsLoading: loading }),
    applyTagSnapshot: (snapshot: TagListSnapshot) =>
      set({ tagSnapshot: snapshot, tagsLoading: false }),
    setWorktreesOpen: (open: boolean) => set({ worktreesOpen: open }),
    setWorktreesLoading: (loading: boolean) => set({ worktreesLoading: loading }),
    applyWorktreeSnapshot: (snapshot: WorktreeListSnapshot) =>
      set({ worktreeSnapshot: snapshot, worktreesLoading: false }),
    setPatchPreview: (patch: string | null) => set({ patchPreview: patch }),
    applyBlameSnapshot: (snapshot: BlameSnapshot) =>
      set({ blameSnapshot: snapshot, blameLoading: false, blameError: null }),
    setBlameLoading: (loading: boolean) => set({ blameLoading: loading }),
    setBlameError: (error: string | null) =>
      set({ blameError: error, blameLoading: false }),
    setWorkspaceNotification: (
      notification: GitWorkspaceState["workspaceNotification"],
    ) => set({ workspaceNotification: notification }),
    clearWorkspaceNotification: () => set({ workspaceNotification: null }),
    applyLogSnapshot: (snapshot: LogSnapshot) =>
      set({ logSnapshot: snapshot, logLoading: false, logError: null }),
    setLogLoading: (loading: boolean) => set({ logLoading: loading }),
    setLogError: (error: string | null) =>
      set({ logError: error, logLoading: false }),
    selectLogCommit: (sha: string | null) =>
      set({
        logSelectedSha: sha,
        logSelectedShas: sha ? [sha] : [],
        logSelectedFilePath: null,
      }),
    toggleLogCommitSelection: (sha: string, multi = false) => {
      const state = get();
      if (!multi) {
        set({
          logSelectedSha: sha,
          logSelectedShas: [sha],
          logSelectedFilePath: null,
        });
        return;
      }
      const next = new Set(state.logSelectedShas);
      if (next.has(sha)) {
        next.delete(sha);
      } else {
        next.add(sha);
      }
      const shas = [...next];
      set({
        logSelectedShas: shas,
        logSelectedSha: shas[shas.length - 1] ?? null,
        logSelectedFilePath: null,
      });
    },
    clearLogCommitSelection: () =>
      set({ logSelectedSha: null, logSelectedShas: [], logSelectedFilePath: null }),
    selectLogFile: (path: string | null) => set({ logSelectedFilePath: path }),
    setLogFilters: (filters: LogQueryFilters) =>
      set({ logFilters: filters }),
    setIssueTrackerBaseUrl: (url: string | null) => set({ issueTrackerBaseUrl: url }),
    setDiffStagedView: (staged: boolean) => set({ diffStagedView: staged }),
    setDiffViewMode: (mode: GitWorkspaceState["diffViewMode"]) =>
      set({ diffViewMode: mode }),
    setWhitespacePolicy: (policy: GitWorkspaceState["whitespacePolicy"]) =>
      set({ whitespacePolicy: policy }),
    setCommitAfterChecksConfirmed: (confirmed: boolean) =>
      set({ commitAfterChecksConfirmed: confirmed }),
    applyReviewSnapshot: (snapshot: ReviewListSnapshot) =>
      set({ reviewSnapshot: snapshot, reviewLoading: false, reviewError: null }),
    applyReviewDetails: (details: ReviewDetailsSnapshot | null) =>
      set({ reviewDetails: details }),
    setReviewLoading: (loading: boolean) => set({ reviewLoading: loading }),
    setReviewError: (error: string | null) =>
      set({ reviewError: error, reviewLoading: false }),
    setReviewFilters: (filters: ReviewFilters) =>
      set({ reviewFilters: filters }),
    setSelectedReviewId: (reviewId: string | null) =>
      set({ selectedReviewId: reviewId }),
    activeRepository: () => {
      const { repoSnapshot } = get();
      if (!repoSnapshot?.activeRepoId) {
        return null;
      }
      return (
        repoSnapshot.repositories.find(
          (repo) => repo.id === repoSnapshot.activeRepoId,
        ) ?? null
      );
    },
    activeChangelistPaths: () => {
      const { statusSnapshot } = get();
      if (!statusSnapshot || statusSnapshot.mode !== "changelist") {
        return null;
      }
      const active = statusSnapshot.changelists.find((list) => list.active);
      return active ? new Set(active.filePaths) : null;
    },
    visibleFiles: () => {
      const { statusSnapshot } = get();
      if (!statusSnapshot) {
        return [];
      }
      const paths = get().activeChangelistPaths();
      if (!paths) {
        return statusSnapshot.files;
      }
      return statusSnapshot.files.filter((file) => paths.has(file.path));
    },
    selectedFileConflicted: () => {
      const { selectedFilePath, statusSnapshot } = get();
      if (!selectedFilePath || !statusSnapshot) {
        return false;
      }
      const file = statusSnapshot.files.find((f) => f.path === selectedFilePath);
      return Boolean(file?.conflicted || file?.kind === "conflicted");
    },
    committableFiles: () => {
      const { commitScope } = get();
      const groups = groupWorkspaceFiles(get().visibleFiles());
      return [...groups.changes, ...groups.unversioned].filter((file) =>
        commitScope.has(file.path),
      );
    },
  } satisfies GitWorkspaceActions;
}