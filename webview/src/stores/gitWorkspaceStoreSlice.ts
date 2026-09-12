import type {
  BranchCompareSnapshot,
  BranchListSnapshot,
} from "@gitview/shared/types/branch";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type {
  LogCommitEntry,
  LogDagSnapshot,
  LogQueryFilters,
  LogSnapshot,
} from "@gitview/shared/types/log";
import { logQueryFiltersEqual } from "@gitview/shared/types/log";
import type { RepositorySnapshot } from "@gitview/shared/types/repository";
import type { ShelfListSnapshot } from "@gitview/shared/types/shelf";
import type { StashListSnapshot } from "@gitview/shared/types/stash";
import type { GitFileStatus, StatusSnapshot } from "@gitview/shared/types/status";
import type { TagListSnapshot } from "@gitview/shared/types/tag";
import type { WorktreeListSnapshot } from "@gitview/shared/types/worktree";
import {
  isSyncOperationActive,
  type SyncOperationEvent,
  type SyncOperationKind,
} from "@gitview/shared/types/sync";
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
import { createRootLogFilters } from "./gitWorkspaceLogDefaults";
import type { GitWorkspaceActions, GitWorkspaceState } from "./gitWorkspaceStoreTypes";

type SetState = StoreApi<GitWorkspaceState & GitWorkspaceActions>["setState"];
type GetState = StoreApi<GitWorkspaceState & GitWorkspaceActions>["getState"];

function defaultCommitScope(files: GitFileStatus[]): Set<string> {
  const groups = groupWorkspaceFiles(files);
  return new Set(
    [...groups.changes, ...groups.unversioned].map((file) => file.path),
  );
}

const MAX_RECENT_SYNC_OPERATIONS = 20;

function trimSyncOperations(
  operations: GitWorkspaceState["syncOperations"],
): GitWorkspaceState["syncOperations"] {
  const terminalCount = operations.filter(
    ({ event }) => !isSyncOperationActive(event),
  ).length;
  let toRemove = terminalCount - MAX_RECENT_SYNC_OPERATIONS;
  if (toRemove <= 0) {
    return operations;
  }
  return operations.filter(({ event }) => {
    if (toRemove > 0 && !isSyncOperationActive(event)) {
      toRemove -= 1;
      return false;
    }
    return true;
  });
}

export function createGitWorkspaceStoreSlice(set: SetState, get: GetState) {
  // Late host events carry the repoId they were requested for. Only the
  // status snapshot was filtered, so a delayed response for repo A could
  // overwrite repo B's UI — and a later action would then pair B's repoId
  // with A's ref/path/SHA. Every per-repository snapshot below is rejected
  // when it does not target the active repository.
  function isStaleSnapshot(repoId: string): boolean {
    const activeRepoId = get().repoSnapshot?.activeRepoId;
    return Boolean(activeRepoId) && repoId !== activeRepoId;
  }

  function rootLogViewState() {
    return {
      workspaceTab: "log" as const,
      historyOpenRequest: null,
      activeHistoryScope: null,
      logFilters: createRootLogFilters(),
      logSelectedSha: null,
      logSelectedShas: [],
      logSelectedFilePath: null,
      logError: null,
      logSnapshot: null,
      logDag: null,
      logLoading: false,
      logLoadingMore: false,
      diffDocument: null,
      diffLoading: false,
      diffError: null,
    };
  }

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
    setPendingRollback: (request: GitWorkspaceState["pendingRollback"]) =>
      set({ pendingRollback: request }),
    clearPendingRollback: () => set({ pendingRollback: null }),
    setError: (error: string | null) => set({ error }),
    applyRepoSnapshot: (snapshot: RepositorySnapshot) => {
      const previousActiveRepoId = get().repoSnapshot?.activeRepoId;
      const activeRepoChanged = previousActiveRepoId !== snapshot.activeRepoId;
      // User-draft fields (commit message, options, selections) are only
      // reset when replacing an already-established repository. The very
      // first hydration (null -> repo A) must not wipe a draft the user
      // typed while the panel was still booting.
      const hadActiveRepo = previousActiveRepoId != null;
      set({
        repoSnapshot: snapshot,
        loading: false,
        ...(activeRepoChanged
          ? {
              repoEpoch: get().repoEpoch + 1,
              statusSnapshot: null,
              selectedFilePath: null,
              diffDocument: null,
              diffError: null,
              commitScope: new Set<string>(),
              // Mutation-form state belongs to the previous repository: a
              // message/amend/signing/author typed for repo A must never be
              // committed into repo B after a switch.
              ...(hadActiveRepo
                ? {
                    commitMessage: "",
                    amend: false,
                    signoff: false,
                    gpgSign: false,
                    author: "",
                    runChecks: true,
                    runHooks: true,
                    commitAfterChecksConfirmed: false,
                  }
                : {}),
              // Transient loading/error flags belong to the previous
              // repository's in-flight requests. The scoped loaders skip
              // stale completions, so without this reset a repo switch
              // during a request would leave the new repository's spinner
              // stuck on forever.
              branchesLoading: false,
              logLoading: false,
              logLoadingMore: false,
              logError: null,
              diffLoading: false,
              tagsLoading: false,
              worktreesLoading: false,
              reviewLoading: false,
              reviewError: null,
              branchSnapshot: null,
              branchCompareSnapshot: null,
              branchCompareOpen: false,
              branchCompareSelectedFile: null,
              logSnapshot: null,
              logDag: null,
              logSelectedSha: null,
              logSelectedShas: [],
              logSelectedFilePath: null,
              stashSnapshot: null,
              shelfSnapshot: null,
              tagSnapshot: null,
              worktreeSnapshot: null,
              reviewSnapshot: null,
              reviewDetails: null,
              selectedReviewId: null,
            }
          : {}),
      });
    },
    applyStatusSnapshot: (snapshot: StatusSnapshot) => {
      const repoSnapshot = get().repoSnapshot;
      if (repoSnapshot && snapshot.repoId !== repoSnapshot.activeRepoId) {
        return;
      }
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
    applySyncOperation: (event: SyncOperationEvent) => {
      const operations = get().syncOperations;
      const index = operations.findIndex(
        (operation) => operation.event.operationId === event.operationId,
      );
      if (index >= 0) {
        const current = operations[index];
        if (!current || event.sequence <= current.event.sequence) {
          return;
        }
        const next = [...operations];
        next[index] = { event, outcomeUnknown: false };
        set({ syncOperations: trimSyncOperations(next) });
        return;
      }
      set({
        syncOperations: trimSyncOperations([
          ...operations,
          { event, outcomeUnknown: false },
        ]),
      });
    },
    markSyncOperationOutcomeUnknown: (operationId: string) => {
      const operations = get().syncOperations;
      const index = operations.findIndex(
        (operation) => operation.event.operationId === operationId,
      );
      const current = operations[index];
      if (!current || !isSyncOperationActive(current.event)) {
        return;
      }
      const next = [...operations];
      next[index] = { ...current, outcomeUnknown: true };
      set({ syncOperations: next });
    },
    dismissSyncOperation: (operationId: string) =>
      set({
        syncOperations: get().syncOperations.filter(
          (operation) => operation.event.operationId !== operationId,
        ),
      }),
    syncOperationForRepository: (
      repoId: string,
      operation?: SyncOperationKind,
    ) => {
      const matches = get().syncOperations.filter(
        ({ event }) =>
          event.repoIds.includes(repoId) &&
          (operation === undefined || event.operation === operation),
      );
      for (let index = matches.length - 1; index >= 0; index -= 1) {
        const match = matches[index];
        if (match && isSyncOperationActive(match.event)) {
          return match;
        }
      }
      return matches.at(-1) ?? null;
    },
    applyBranchSnapshot: (snapshot: BranchListSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ branchSnapshot: snapshot, branchesLoading: false });
    },
    applyBranchCompareSnapshot: (snapshot: BranchCompareSnapshot | null) => {
      if (snapshot && isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({
        branchCompareSnapshot: snapshot,
        branchCompareOpen: snapshot !== null,
        branchCompareSelectedFile: snapshot?.files[0]?.path ?? null,
      });
    },
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
    setDiffDocument: (document: WorkspaceDiffDocument | null) => {
      if (document && isStaleSnapshot(document.repoId)) {
        return;
      }
      set({ diffDocument: document, diffLoading: false, diffError: null });
    },
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
    setRunHooks: (runHooks: boolean) => set({ runHooks }),
    setPullStrategy: (pullStrategy: GitWorkspaceState["pullStrategy"]) =>
      set({ pullStrategy }),
    setSynchronousBranchControl: (enabled: boolean) =>
      set({ synchronousBranchControl: enabled }),
    setWorkspaceTab: (tab: GitWorkspaceState["workspaceTab"]) =>
      set({ workspaceTab: tab }),
    setTemporarySubTab: (tab: GitWorkspaceState["temporarySubTab"]) =>
      set({ temporarySubTab: tab }),
    applyStashSnapshot: (snapshot: StashListSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ stashSnapshot: snapshot });
    },
    applyShelfSnapshot: (snapshot: ShelfListSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ shelfSnapshot: snapshot });
    },
    setTagsOpen: (open: boolean) => set({ tagsOpen: open }),
    setTagsLoading: (loading: boolean) => set({ tagsLoading: loading }),
    applyTagSnapshot: (snapshot: TagListSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ tagSnapshot: snapshot, tagsLoading: false });
    },
    setWorktreesOpen: (open: boolean) => set({ worktreesOpen: open }),
    setWorktreesLoading: (loading: boolean) => set({ worktreesLoading: loading }),
    applyWorktreeSnapshot: (snapshot: WorktreeListSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ worktreeSnapshot: snapshot, worktreesLoading: false });
    },
    setPatchPreview: (patch: string | null) => set({ patchPreview: patch }),
    setWorkspaceNotification: (
      notification: GitWorkspaceState["workspaceNotification"],
    ) => set({ workspaceNotification: notification }),
    clearWorkspaceNotification: () => set({ workspaceNotification: null }),
    applyLogDag: (snapshot: LogDagSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ logDag: snapshot });
    },
    applyLogSnapshot: (snapshot: LogSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      const pageSkip = snapshot.filters?.skip ?? 0;
      if (pageSkip > 0) {
        const state = get();
        const current = state.logSnapshot;
        if (
          !current ||
          current.repoId !== snapshot.repoId ||
          !logQueryFiltersEqual(snapshot.filters, state.logFilters)
        ) {
          set({ logLoadingMore: false });
          return;
        }
        const seen = new Set(current.commits.map((commit) => commit.sha));
        const commits = [
          ...current.commits,
          ...snapshot.commits.filter((commit) => {
            if (seen.has(commit.sha)) {
              return false;
            }
            seen.add(commit.sha);
            return true;
          }),
        ];
        const pageSize = state.logFilters.limit ?? 200;
        set({
          logSnapshot: {
            ...current,
            branch: snapshot.branch,
            commits,
            refreshedAt: snapshot.refreshedAt,
            filters: state.logFilters,
            hasMore:
              snapshot.hasMore ?? snapshot.commits.length >= pageSize,
          },
          logLoading: false,
          logLoadingMore: false,
          logError: null,
        });
        return;
      }
      set({
        logSnapshot: snapshot,
        logLoading: false,
        logLoadingMore: false,
        logError: null,
      });
    },
    applyLogCommitDetail: (repoId: string, commit: LogCommitEntry) => {
      const snapshot = get().logSnapshot;
      if (!snapshot || snapshot.repoId !== repoId || isStaleSnapshot(repoId)) {
        return;
      }
      const index = snapshot.commits.findIndex((entry) => entry.sha === commit.sha);
      if (index < 0) {
        return;
      }
      const current = snapshot.commits[index]!;
      const commits = [...snapshot.commits];
      commits[index] = {
        ...current,
        ...commit,
        refs: commit.refs ?? current.refs,
        parentShas: commit.parentShas ?? current.parentShas,
      };
      set({ logSnapshot: { ...snapshot, commits } });
    },
    setLogLoading: (loading: boolean) => set({ logLoading: loading }),
    setLogLoadingMore: (loading: boolean) => set({ logLoadingMore: loading }),
    setLogError: (error: string | null) =>
      set(error === null
        ? { logError: null }
        : { logError: error, logLoading: false, logLoadingMore: false }),
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
    setLogFilters: (filters: LogQueryFilters) => {
      // The same filters arrive as fresh objects from several effects; keeping
      // the old reference avoids a query round-trip (and a list blink).
      if (logQueryFiltersEqual(get().logFilters, filters)) {
        return;
      }
      set({ logFilters: filters });
    },
    resetLogView: () => set(rootLogViewState()),
    focusLogRoot: () =>
      set((state) => ({
        ...rootLogViewState(),
        logRootRequest: state.logRootRequest + 1,
        dialogs: {},
        branchesOpen: false,
        nativeFocusSurface: null,
      })),
    requestHistoryOpen: (scope) =>
      set({
        historyOpenRequest: { ...scope },
        activeHistoryScope: { ...scope },
        workspaceTab: "log",
      }),
    setActiveHistoryScope: (activeHistoryScope) =>
      set({ activeHistoryScope }),
    setIssueTrackerBaseUrl: (url: string | null) => set({ issueTrackerBaseUrl: url }),
    setDiffStagedView: (staged: boolean) => set({ diffStagedView: staged }),
    setDiffViewMode: (mode: GitWorkspaceState["diffViewMode"]) =>
      set({ diffViewMode: mode }),
    setWhitespacePolicy: (policy: GitWorkspaceState["whitespacePolicy"]) =>
      set({ whitespacePolicy: policy }),
    setCommitAfterChecksConfirmed: (confirmed: boolean) =>
      set({ commitAfterChecksConfirmed: confirmed }),
    applyReviewSnapshot: (snapshot: ReviewListSnapshot) => {
      if (isStaleSnapshot(snapshot.repoId)) {
        return;
      }
      set({ reviewSnapshot: snapshot, reviewLoading: false, reviewError: null });
    },
    applyReviewDetails: (details: ReviewDetailsSnapshot | null) => {
      if (details && isStaleSnapshot(details.repoId)) {
        return;
      }
      set({ reviewDetails: details });
    },
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
