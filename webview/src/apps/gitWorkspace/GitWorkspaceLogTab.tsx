import { useCallback, useEffect, useMemo } from "react";
import type { ResetMode } from "@gitview/shared/types/log";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import { orderShasOldestFirst } from "@gitview/shared/lib/commitBatchOrder";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { WorkspaceBlamePanel } from "../../components/git/WorkspaceBlamePanel";
import { WorkspaceLogPanel } from "../../components/git/WorkspaceLogPanel";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { reportDiffOpenError } from "../../lib/userError";
import { workspaceDiffToFileDiffView } from "../historyBlameAdapters";

export function GitWorkspaceLogTab({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    clientRef,
    syncing,
    diffDocument,
    diffLoading,
    diffError,

    selectedFilePath,
    workspaceTab,
    logSnapshot,
    logLoading,
    logError,
    logSelectedSha,
    logSelectedShas,
    logSelectedFilePath,
    logFilters,
    issueTrackerBaseUrl,
    blameSnapshot,
    blameLoading,
    blameError,
    setLogFilters,
    openDialog,
    selectLogCommit,
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
    },
    [selectLogCommit, toggleLogCommitSelection],
  );

  const handleSelectFile = useCallback(
    (path: string, status: string) => {
      selectLogFile(path);
      const sha = useGitWorkspaceStore.getState().logSelectedSha;
      if (sha) {
        void loadLogFileDiff(sha, path, status);
      }
    },
    [loadLogFileDiff, selectLogFile],
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

  const handleCherryPickHunk = useCallback(
    (hunkIndex: number) => {
      if (!activeRepo || !logSelectedSha || !logSelectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.cherryPickSelected(
          activeRepo.id,
          logSelectedSha,
          logSelectedFilePath,
          { hunkIndexes: [hunkIndex] },
        );
      });
    },
    [activeRepo, clientRef, logSelectedFilePath, logSelectedSha, runMutation],
  );

  const handleRevertHunk = useCallback(
    (hunkIndex: number) => {
      if (!activeRepo || !logSelectedSha || !logSelectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.revertSelected(
          activeRepo.id,
          logSelectedSha,
          logSelectedFilePath,
          { hunkIndexes: [hunkIndex] },
        );
      });
    },
    [activeRepo, clientRef, logSelectedFilePath, logSelectedSha, runMutation],
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

  if (workspaceTab !== "log" && workspaceTab !== "blame") {
    return null;
  }

  return workspaceTab === "log" ? (
    <WorkspaceLogPanel
      snapshot={logSnapshot}
      loading={logLoading}
      error={logError}
      selectedSha={logSelectedSha}
      selectedShas={logSelectedShas}
      selectedFilePath={logSelectedFilePath}
      diffDocument={diffDocument}
      diffLoading={diffLoading}
      diffError={diffError}
      onSelectCommit={handleSelectCommit}
      issueTrackerBaseUrl={issueTrackerBaseUrl}
      currentBranchHeadSha={activeRepo?.headSha ?? null}
      onSelectFile={handleSelectFile}
      filters={logFilters}
      onFiltersChange={setLogFilters}
      branches={branches}
      authors={authors}
      pathOptions={pathOptions}
      onBranchMenuOpen={handleBranchMenuOpen}
      onOpenFileDiff={handleOpenFileDiff}
      onRefresh={handleRefresh}
      busy={syncing}
      protectedBranch={activeRepo?.protectedBranch}
      hasUpstream={Boolean(activeRepo?.upstream)}
      onCherryPick={handleCherryPick}
      onCherryPickMultiple={handleCherryPickMultiple}
      onRevert={handleRevert}
      onRevertMultiple={handleRevertMultiple}
      onCopyHash={handleCopyHashClick}
      onCreateBranchFromCommit={handleCreateBranchFromCommit}
      onResetToCommit={handleResetToCommit}
      onUndoLastCommit={handleUndoLastCommit}
      onEditMessage={handleEditMessage}
      onDropCommit={handleDropCommit}
      onRewriteCommit={handleRewriteCommit}
      onExtractChanges={handleExtractChanges}
      canDropSelected={Boolean(
        logSelectedSha &&
          activeRepo?.headSha &&
          logSelectedSha === activeRepo.headSha,
      )}
      protectedBranchForDrop={activeRepo?.protectedBranch}
      onCherryPickHunk={handleCherryPickHunk}
      onRevertHunk={handleRevertHunk}
      onDropHunk={handleDropHunk}
      onCherryPickLines={handleCherryPickLines}
      onRevertLines={handleRevertLines}
      onDropLines={handleDropLines}
    />
  ) : (
    <WorkspaceBlamePanel
      snapshot={blameSnapshot}
      filePath={selectedFilePath}
      loading={blameLoading}
      error={blameError}
    />
  );
}
