import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ResetMode } from "@gitview/shared/types/log";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import { orderShasOldestFirst } from "@gitview/shared/lib/commitBatchOrder";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { WorkspaceLogPanel } from "../../components/git/WorkspaceLogPanel";
import type { WorkspaceLogPanelProps } from "../../components/git/workspaceLogPanel/workspaceLogPanelTypes";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { reportDiffOpenError } from "../../lib/userError";
import { isModDShortcut } from "../../lib/isModDShortcut";
import { workspaceDiffToFileDiffView } from "../historyBlameAdapters";

export function GitWorkspaceLogTab({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    clientRef,
    syncing,
    diffDocument,
    diffLoading,
    diffError,

    workspaceTab,
    logSnapshot,
    logLoading,
    logError,
    logSelectedSha,
    logSelectedShas,
    logSelectedFilePath,
    logFilters,
    activeHistoryScope,
    issueTrackerBaseUrl,
    setLogFilters,
    openDialog,
    selectLogCommit,
    applyLogCommitDetail,
    toggleLogCommitSelection,
    selectLogFile,
    activeRepo,
    runMutation,
    loadLog,
    loadLogFileDiff,
    handleRewriteHistory,
    handleDropSelected,
    handleReset,
    handleCopyHash,
    branchSnapshot,
    loadBranches,
  } = ctx;
  const requestedMergeDetails = useRef(new Set<string>());
  const autoSelectedHistoryKey = useRef<string | null>(null);

  const selectHistoryFile = useCallback(
    (sha: string): void => {
      const scope = activeHistoryScope;
      if (!scope || scope.isFolder || !scope.path) {
        return;
      }
      const targetPath = scope.path;
      const commit = useGitWorkspaceStore
        .getState()
        .logSnapshot?.commits.find((entry) => entry.sha === sha);
      if (!commit) {
        return;
      }
      const file = commit.changedFiles.find(
        (entry) => entry.path === targetPath,
      ) ?? commit.changedFiles[0];
      if (!file) {
        return;
      }
      selectLogFile(file.path);
      if (scope.showDiff !== false) {
        void loadLogFileDiff(sha, file.path, file.status);
      }
    },
    [activeHistoryScope, loadLogFileDiff, selectLogFile],
  );

  useEffect(() => {
    if (activeRepo) {
      void loadBranches();
    }
  }, [activeRepo, loadBranches]);

  const branches = useMemo(
    () =>
      (branchSnapshot?.branches ?? []).map((branch) =>
        branch.remote ? branch.fullName : branch.name,
      ),
    [branchSnapshot],
  );
  const authors = useMemo(() => {
    const names = new Set<string>();
    for (const commit of logSnapshot?.commits ?? []) {
      if (commit.author) {
        names.add(commit.author);
      }
    }
    return [...names];
  }, [logSnapshot]);
  const pathOptions = useMemo(() => {
    const paths = new Set<string>();
    for (const commit of logSnapshot?.commits ?? []) {
      for (const file of commit.changedFiles) {
        paths.add(file.path);
      }
    }
    return [...paths];
  }, [logSnapshot]);

  // `ctx` is a fresh object on every render, so anything derived from it inline
  // gets a new identity too — and WorkspaceLogPanel guards its commit rows with
  // `memo`. One unstable callback re-renders the whole log. Every handler below
  // is therefore memoized against only the values it actually closes over.
  const handleSelectCommit = useCallback(
    (sha: string, multi?: boolean) => {
      if (multi) {
        toggleLogCommitSelection(sha, true);
        return;
      }
      selectLogCommit(sha);
      selectHistoryFile(sha);
      if (!activeRepo) {
        return;
      }
      const commit = useGitWorkspaceStore
        .getState()
        .logSnapshot?.commits.find((entry) => entry.sha === sha);
      if (!commit?.isMerge || commit.changedFiles.length > 0) {
        return;
      }
      const requestKey = `${activeRepo.id}:${sha}`;
      if (requestedMergeDetails.current.has(requestKey)) {
        return;
      }
      requestedMergeDetails.current.add(requestKey);
      void clientRef.current
        .commitDetail(activeRepo.id, sha)
        .then((result) => {
          if (!result.commit) {
            requestedMergeDetails.current.delete(requestKey);
            return;
          }
          applyLogCommitDetail(activeRepo.id, result.commit);
        })
        .catch((err: unknown) => {
          requestedMergeDetails.current.delete(requestKey);
          useGitWorkspaceStore
            .getState()
            .setLogError(
              err instanceof Error ? err.message : "Failed to load merge files",
            );
        });
    },
    [
      activeRepo,
      applyLogCommitDetail,
      clientRef,
      selectLogCommit,
      toggleLogCommitSelection,
      selectHistoryFile,
    ],
  );

  useEffect(() => {
    if (!activeHistoryScope || !logSnapshot?.commits[0]) {
      autoSelectedHistoryKey.current = null;
      return;
    }
    const currentSelected = useGitWorkspaceStore.getState().logSelectedSha;
    if (currentSelected) {
      return;
    }
    const firstSha = logSnapshot.commits[0].sha;
    const key = `${activeHistoryScope.repoId}:${activeHistoryScope.path}:${firstSha}`;
    if (autoSelectedHistoryKey.current === key) {
      return;
    }
    autoSelectedHistoryKey.current = key;
    selectLogCommit(firstSha);
    if (!activeHistoryScope.isFolder) {
      selectHistoryFile(firstSha);
    }
  }, [
    activeHistoryScope,
    logSnapshot,
    selectHistoryFile,
    selectLogCommit,
  ]);

  useEffect(() => {
    if (!logSelectedSha || !activeHistoryScope || activeHistoryScope.isFolder || !logSnapshot) {
      return;
    }
    selectHistoryFile(logSelectedSha);
  }, [logSelectedSha, activeHistoryScope, logSnapshot, selectHistoryFile]);

  const handleSelectFile = useCallback(
    (path: string, status: string) => {
      selectLogFile(path);
      // The root log has no inline diff surface anymore. Only file history
      // renders a diff in the right column; folder history opens a standalone
      // diff tab when a file is selected.
    if (
      !activeHistoryScope ||
      activeHistoryScope.isFolder ||
      activeHistoryScope.showDiff === false
    ) {
      return;
    }
      const sha = useGitWorkspaceStore.getState().logSelectedSha;
      if (sha) {
        void loadLogFileDiff(sha, path, status);
      }
    },
    [activeHistoryScope, loadLogFileDiff, selectLogFile],
  );

  const handleBranchMenuOpen = useCallback(() => {
    void loadBranches();
  }, [loadBranches]);

  const handleOpenFileDiff = useCallback(
    (path: string, status: string) => {
      selectLogFile(path);
      const sha = useGitWorkspaceStore.getState().logSelectedSha;
      if (!sha) {
        return;
      }
      void loadLogFileDiff(sha, path, status).then(() => {
        const document = useGitWorkspaceStore.getState().diffDocument;
        if (!document) {
          return;
        }
        const name = path.split("/").pop() ?? path;
        void clientRef.current
          .openDiffInEditor({
            title: name,
            relativePath: path,
            diff: workspaceDiffToFileDiffView(document),
            repoId: document.repoId,
          })
          .catch(reportDiffOpenError);
      });
    },
    [clientRef, loadLogFileDiff, selectLogFile],
  );

  useEffect(() => {
    if (workspaceTab !== "log") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModDShortcut(event)) {
        return;
      }
      const path = useGitWorkspaceStore.getState().logSelectedFilePath;
      const sha = useGitWorkspaceStore.getState().logSelectedSha;
      if (!path || !sha) {
        return;
      }
      event.preventDefault();
      const status =
        useGitWorkspaceStore
          .getState()
          .logSnapshot?.commits.find((commit) => commit.sha === sha)
          ?.changedFiles.find((file) => file.path === path)?.status ?? "M";
      handleOpenFileDiff(path, status);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [handleOpenFileDiff, workspaceTab]);

  const handleRefresh = useCallback(() => {
    void loadLog();
  }, [loadLog]);

  const handleCherryPick = useCallback(
    (sha: string) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() => clientRef.current.cherryPick(activeRepo.id, sha));
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleCherryPickMultiple = useCallback(
    (shas: string[]) => {
      if (!activeRepo) {
        return;
      }
      // Click order is not history order: normalize against the displayed
      // newest-first log so a stack is always picked oldest-first.
      const ordered = orderShasOldestFirst(
        shas,
        (logSnapshot?.commits ?? []).map((commit) => commit.sha),
      );
      void runMutation(async () => {
        await clientRef.current.cherryPickMultiple(activeRepo.id, ordered);
        await loadLog();
      });
    },
    [activeRepo, clientRef, loadLog, logSnapshot, runMutation],
  );

  const handleRevert = useCallback(
    (sha: string) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() => clientRef.current.revert(activeRepo.id, sha));
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleRevertMultiple = useCallback(
    (shas: string[]) => {
      if (!activeRepo) {
        return;
      }
      // Same oldest-first normalization: the host reverses the batch into a
      // single newest-first sequencer, so click order must not leak through.
      const ordered = orderShasOldestFirst(
        shas,
        (logSnapshot?.commits ?? []).map((commit) => commit.sha),
      );
      void runMutation(async () => {
        await clientRef.current.revertMultiple(activeRepo.id, ordered);
        await loadLog();
      });
    },
    [activeRepo, clientRef, loadLog, logSnapshot, runMutation],
  );

  const handleCopyHashClick = useCallback(
    (sha: string) => {
      void handleCopyHash(sha);
    },
    [handleCopyHash],
  );

  const handleCreateBranchFromCommit = useCallback(
    (sha: string) => {
      openDialog("createBranchFromCommit", { sha });
    },
    [openDialog],
  );

  const handleResetToCommit = useCallback(
    (sha: string, mode: ResetMode) => {
      void handleReset(sha, mode);
    },
    [handleReset],
  );

  const handleUndoLastCommit = useCallback(() => {
    if (!activeRepo) {
      return;
    }
    void runMutation(async () => {
      try {
        await clientRef.current.undoLastCommit(activeRepo.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.toLowerCase().includes("requires confirmation") &&
          window.confirm(
            "Undo the last commit? This rewrites local history (mixed reset to HEAD~1).",
          )
        ) {
          await clientRef.current.undoLastCommit(activeRepo.id, true);
        } else if (!message.toLowerCase().includes("requires confirmation")) {
          throw err;
        } else {
          return;
        }
      }
      await loadLog();
    });
  }, [activeRepo, clientRef, loadLog, runMutation]);

  const handleEditMessage = useCallback(
    (sha: string, subject: string) => {
      openDialog("editMessage", { sha, subject });
    },
    [openDialog],
  );

  const handleDropCommit = useCallback(
    (sha: string) => {
      void handleRewriteHistory(sha, "drop");
    },
    [handleRewriteHistory],
  );

  const handleRewriteCommit = useCallback(
    (sha: string, action: "squash" | "fixup" | "drop") => {
      void handleRewriteHistory(sha, action);
    },
    [handleRewriteHistory],
  );

  const handleExtractChanges = useCallback(
    (sha: string) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.extractChanges(activeRepo.id, sha);
        await loadLog();
      });
    },
    [activeRepo, clientRef, loadLog, runMutation],
  );

  const handleDropHunk = useCallback(
    (hunkIndex: number) => {
      if (!logSelectedSha || !logSelectedFilePath) {
        return;
      }
      void handleDropSelected(logSelectedSha, logSelectedFilePath, {
        hunkIndexes: [hunkIndex],
      });
    },
    [handleDropSelected, logSelectedFilePath, logSelectedSha],
  );

  const handleCherryPickLines = useCallback(
    (lines: DiffLineSelection[]) => {
      if (!activeRepo || !logSelectedSha || !logSelectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.cherryPickSelected(
          activeRepo.id,
          logSelectedSha,
          logSelectedFilePath,
          { lines },
        );
      });
    },
    [activeRepo, clientRef, logSelectedFilePath, logSelectedSha, runMutation],
  );

  const handleRevertLines = useCallback(
    (lines: DiffLineSelection[]) => {
      if (!activeRepo || !logSelectedSha || !logSelectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.revertSelected(
          activeRepo.id,
          logSelectedSha,
          logSelectedFilePath,
          { lines },
        );
      });
    },
    [activeRepo, clientRef, logSelectedFilePath, logSelectedSha, runMutation],
  );

  const handleDropLines = useCallback(
    (lines: DiffLineSelection[]) => {
      if (!logSelectedSha || !logSelectedFilePath) {
        return;
      }
      void handleDropSelected(logSelectedSha, logSelectedFilePath, { lines });
    },
    [handleDropSelected, logSelectedFilePath, logSelectedSha],
  );

  const logProps = useMemo<WorkspaceLogPanelProps>(
    () => ({
      snapshot: logSnapshot,
      loading: logLoading,
      error: logError,
      selectedSha: logSelectedSha,
      selectedShas: logSelectedShas,
      selectedFilePath: logSelectedFilePath,
      diffDocument,
      diffLoading,
      diffError,
      historyScope: activeHistoryScope,
      onSelectCommit: handleSelectCommit,
      issueTrackerBaseUrl,
      currentBranchHeadSha: activeRepo?.headSha ?? null,
      onSelectFile: handleSelectFile,
      filters: logFilters,
      onFiltersChange: setLogFilters,
      branches,
      authors,
      pathOptions,
      onBranchMenuOpen: handleBranchMenuOpen,
      onOpenFileDiff: handleOpenFileDiff,
      onRefresh: handleRefresh,
      busy: syncing,
      protectedBranch: activeRepo?.protectedBranch,
      hasUpstream: Boolean(activeRepo?.upstream),
      onCherryPick: handleCherryPick,
      onCherryPickMultiple: handleCherryPickMultiple,
      onRevert: handleRevert,
      onRevertMultiple: handleRevertMultiple,
      onCopyHash: handleCopyHashClick,
      onCreateBranchFromCommit: handleCreateBranchFromCommit,
      onResetToCommit: handleResetToCommit,
      onUndoLastCommit: handleUndoLastCommit,
      onEditMessage: handleEditMessage,
      onDropCommit: handleDropCommit,
      onRewriteCommit: handleRewriteCommit,
      onExtractChanges: handleExtractChanges,
      canDropSelected: Boolean(
        logSelectedSha &&
          activeRepo?.headSha &&
          logSelectedSha === activeRepo.headSha,
      ),
      protectedBranchForDrop: activeRepo?.protectedBranch,
      onDropHunk: handleDropHunk,
      onCherryPickLines: handleCherryPickLines,
      onRevertLines: handleRevertLines,
      onDropLines: handleDropLines,
    }),
    [
      logSnapshot,
      logLoading,
      logError,
      logSelectedSha,
      logSelectedShas,
      logSelectedFilePath,
      diffDocument,
      diffLoading,
      diffError,
      activeHistoryScope,
      handleSelectCommit,
      issueTrackerBaseUrl,
      activeRepo?.headSha,
      handleSelectFile,
      logFilters,
      setLogFilters,
      branches,
      authors,
      pathOptions,
      handleBranchMenuOpen,
      handleOpenFileDiff,
      handleRefresh,
      syncing,
      activeRepo?.protectedBranch,
      activeRepo?.upstream,
      handleCherryPick,
      handleCherryPickMultiple,
      handleRevert,
      handleRevertMultiple,
      handleCopyHashClick,
      handleCreateBranchFromCommit,
      handleResetToCommit,
      handleUndoLastCommit,
      handleEditMessage,
      handleDropCommit,
      handleRewriteCommit,
      handleExtractChanges,
      handleDropHunk,
      handleCherryPickLines,
      handleRevertLines,
      handleDropLines,
    ],
  );

  if (workspaceTab !== "log") {
    return null;
  }

  return <WorkspaceLogPanel {...logProps} />;
}
