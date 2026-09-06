import { useCallback, useMemo } from "react";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { buildGitMenuActionPayload, type GitMenuAction } from "@gitview/types";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import { ChangelistBar } from "../../components/git/ChangelistBar";
import { CommitPanel } from "../../components/git/CommitPanel";
import { ConflictActionsBar } from "../../components/git/ConflictActionsBar";
import { ConflictMergeView } from "../../components/git/ConflictMergeView";
import { WorkspaceBranchComparePanel } from "../../components/git/WorkspaceBranchComparePanel";
import { WorkspaceChangesPanel } from "../../components/git/WorkspaceChangesPanel";
import { WorkspaceDiffPanel } from "../../components/git/WorkspaceDiffPanel";

export function GitWorkspaceChangesTab({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    clientRef,
    syncing,
    statusSnapshot,
    branchCompareSnapshot,
    branchCompareOpen,
    branchCompareSelectedFile,
    diffDocument,
    diffLoading,
    diffError,

    selectedFilePath,
    commitScope,
    commitMessage,
    amend,
    signoff,
    gpgSign,
    author,
    runChecks,
    diffStagedView,
    stashSnapshot,
    shelfSnapshot,
    clearBranchCompare,
    toggleCommitScope,
    setDiffStagedView,
    setCommitMessage,
    setAmend,
    setSignoff,
    setGpgSign,
    setAuthor,
    setRunChecks,
    setWorkspaceNotification,
    openDialog,
    selectedFileConflicted,
    visibleFiles,
    committableFiles,
    activeRepo,
    runMutation,
    refresh,
    loadDiff,
    commit,
    handleSelectFile,
    handleBranchCompareFile,
    handleApplyNonConflicting,
    handleRollback,
  } = ctx;

  // `visibleFiles()`/`committableFiles()` are store getters, so calling them in
  // JSX hands WorkspaceChangesPanel a brand-new array every render and defeats
  // the `memo` on FileRow/Section inside it. Both read only statusSnapshot and
  // commitScope, so those are the complete dependency sets.
  const files = useMemo(() => visibleFiles(), [visibleFiles, statusSnapshot]);
  const committable = useMemo(
    () => committableFiles(),
    [committableFiles, commitScope, statusSnapshot],
  );
  const changelists = useMemo(
    () => statusSnapshot?.changelists ?? [],
    [statusSnapshot],
  );
  // Same treatment as `files`, and it also removes a duplicate call: the two
  // branches below used to invoke the getter separately. It reads only
  // `selectedFilePath` and `statusSnapshot`, so those are the complete dep set.
  const selectedFileIsConflicted = useMemo(
    () => selectedFileConflicted(),
    [selectedFileConflicted, selectedFilePath, statusSnapshot],
  );

  // Every handler below is memoized for the same reason as in GitWorkspaceLogTab:
  // `ctx` is a fresh object each render, so anything derived inline from it gets
  // a new identity too, and this tab re-renders on every commit-message keystroke.
  const handleActivateChangelist = useCallback(
    (listId: string) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() =>
        clientRef.current.activateChangelist(activeRepo.id, listId),
      );
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleCreateChangelist = useCallback(
    (name: string) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() =>
        clientRef.current.createChangelist(activeRepo.id, name),
      );
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleApplyBranchCompareFile = useCallback(
    (path: string) => {
      if (!activeRepo || !branchCompareSnapshot) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.applyBranchCompareFile(
          activeRepo.id,
          branchCompareSnapshot.selectedRef,
          path,
          branchCompareSnapshot.mode === "current" ? "current" : "workingTree",
        );
        await refresh();
      });
    },
    [activeRepo, branchCompareSnapshot, clientRef, refresh, runMutation],
  );

  const handleStage = useCallback(
    (paths: string[]) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() => clientRef.current.stageFiles(activeRepo.id, paths));
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleUnstage = useCallback(
    (paths: string[]) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() =>
        clientRef.current.unstageFiles(activeRepo.id, paths),
      );
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleRollbackFiles = useCallback(
    (paths: string[]) => {
      void handleRollback(paths);
    },
    [handleRollback],
  );

  const handleMoveToChangelist = useCallback(
    (listId: string, paths: string[]) => {
      if (!activeRepo) {
        return;
      }
      void runMutation(() =>
        clientRef.current.moveToChangelist(activeRepo.id, listId, paths),
      );
    },
    [activeRepo, clientRef, runMutation],
  );

  const handleGitMenuAction = useCallback(
    (action: GitMenuAction, path: string) => {
      if (action === "stash") {
        openDialog("stash", {});
        return;
      }
      if (action === "unstash") {
        openDialog("unstash", { index: null });
        return;
      }
      if (activeRepo) {
        void clientRef.current.gitMenuAction(
          activeRepo.id,
          buildGitMenuActionPayload(action, {
            relativePath: path,
            isFolder: false,
          }),
        );
      }
    },
    [activeRepo, clientRef, openDialog],
  );

  const handleShowGitHistory = useCallback(
    (path: string) => {
      if (!activeRepo) {
        return;
      }
      void clientRef.current.openHistoryPanel(activeRepo.id, path, false);
    },
    [activeRepo, clientRef],
  );

  const handleOpenInEditor = useCallback(
    (path: string) => {
      if (!activeRepo) {
        return;
      }
      void clientRef.current.gitMenuAction(
        activeRepo.id,
        buildGitMenuActionPayload("showDiff", {
          relativePath: path,
          isFolder: false,
        }),
      );
    },
    [activeRepo, clientRef],
  );

  // These three run only inside a `{selectedFilePath && ...}` branch, where the
  // original inline arrows got narrowing for free. Hoisted into a callback they
  // lose it, so the null check has to be explicit — the dep list is unchanged.
  const handleAcceptLocal = useCallback(() => {
    if (!activeRepo || !selectedFilePath) {
      return;
    }
    void runMutation(() =>
      clientRef.current.acceptConflictLocal(activeRepo.id, [selectedFilePath]),
    );
  }, [activeRepo, clientRef, runMutation, selectedFilePath]);

  const handleAcceptIncoming = useCallback(() => {
    if (!activeRepo || !selectedFilePath) {
      return;
    }
    void runMutation(() =>
      clientRef.current.acceptConflictIncoming(activeRepo.id, [selectedFilePath]),
    );
  }, [activeRepo, clientRef, runMutation, selectedFilePath]);

  const handleOpenMerge = useCallback(() => {
    if (!activeRepo || !selectedFilePath) {
      return;
    }
    void runMutation(() =>
      clientRef.current.openMerge(activeRepo.id, selectedFilePath),
    );
  }, [activeRepo, clientRef, runMutation, selectedFilePath]);

  const handleApplyNonConflictingClick = useCallback(() => {
    void handleApplyNonConflicting();
  }, [handleApplyNonConflicting]);

  const handleToggleStagedView = useCallback(() => {
    const next = !diffStagedView;
    setDiffStagedView(next);
    if (selectedFilePath) {
      void loadDiff(selectedFilePath, next);
    }
  }, [diffStagedView, loadDiff, selectedFilePath, setDiffStagedView]);

  const handleStageHunk = useCallback(
    (hunkIndex: number) => {
      if (!activeRepo || !selectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.stageHunk(
          activeRepo.id,
          selectedFilePath,
          hunkIndex,
        );
        await loadDiff(selectedFilePath, diffStagedView);
      });
    },
    [activeRepo, clientRef, diffStagedView, loadDiff, runMutation, selectedFilePath],
  );

  const handleUnstageHunk = useCallback(
    (hunkIndex: number) => {
      if (!activeRepo || !selectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.unstageHunk(
          activeRepo.id,
          selectedFilePath,
          hunkIndex,
        );
        await loadDiff(selectedFilePath, diffStagedView);
      });
    },
    [activeRepo, clientRef, diffStagedView, loadDiff, runMutation, selectedFilePath],
  );

  const handleShelveHunk = useCallback(
    (hunkIndex: number) => {
      if (!activeRepo || !selectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.shelveHunk(
          activeRepo.id,
          selectedFilePath,
          hunkIndex,
          { staged: diffStagedView },
        );
        await loadDiff(selectedFilePath, diffStagedView);
      });
    },
    [activeRepo, clientRef, diffStagedView, loadDiff, runMutation, selectedFilePath],
  );

  const handleStageLines = useCallback(
    (lines: DiffLineSelection[]) => {
      if (!activeRepo || !selectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.stageLines(
          activeRepo.id,
          selectedFilePath,
          lines,
        );
        await loadDiff(selectedFilePath, diffStagedView);
      });
    },
    [activeRepo, clientRef, diffStagedView, loadDiff, runMutation, selectedFilePath],
  );

  const handleUnstageLines = useCallback(
    (lines: DiffLineSelection[]) => {
      if (!activeRepo || !selectedFilePath) {
        return;
      }
      void runMutation(async () => {
        await clientRef.current.unstageLines(
          activeRepo.id,
          selectedFilePath,
          lines,
        );
        await loadDiff(selectedFilePath, diffStagedView);
      });
    },
    [activeRepo, clientRef, diffStagedView, loadDiff, runMutation, selectedFilePath],
  );

  const handleCommit = useCallback(() => {
    void commit(false);
  }, [commit]);

  const handleCommitAndPush = useCallback(() => {
    void commit(true);
  }, [commit]);

  const handleRunChecks = useCallback(() => {
    if (!activeRepo) {
      return;
    }
    void runMutation(async () => {
      const result = await clientRef.current.runCommitChecks(
        activeRepo.id,
        [...commitScope],
      );
      const issues = result.issues ?? [];
      if (issues.length > 0) {
        setWorkspaceNotification({
          level: result.ok ? "warning" : "error",
          message: `Commit checks: ${issues.length} issue(s)`,
        });
      } else {
        setWorkspaceNotification({
          level: "info",
          message: "Commit checks passed",
        });
      }
    });
  }, [activeRepo, clientRef, commitScope, runMutation, setWorkspaceNotification]);

  if (ctx.workspaceTab !== "changes") {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col w-full overflow-hidden">
        <ChangelistBar
          changelists={changelists}
          busy={syncing}
          onActivate={handleActivateChangelist}
          onCreate={handleCreateChangelist}
        />

      {branchCompareOpen && branchCompareSnapshot ? (
        <WorkspaceBranchComparePanel
          snapshot={branchCompareSnapshot}
          selectedFilePath={branchCompareSelectedFile}
          diffDocument={diffDocument}
          diffLoading={diffLoading}
          diffError={diffError}
          busy={syncing}
          onSelectFile={handleBranchCompareFile}
          onApplyFile={handleApplyBranchCompareFile}
          onClose={clearBranchCompare}
        />
      ) : (
        <div className="flex flex-1 min-h-0 min-w-0 w-full overflow-hidden">
          <div className="w-changes-files max-w-[30%] min-w-changes-files-min shrink-0 flex flex-col border-r border-nx-border bg-vscode-sidebar-bg min-h-0 max-form-narrow:w-full max-form-narrow:max-w-none">
            <WorkspaceChangesPanel
              files={files}
              changelists={changelists}
              selectedPath={selectedFilePath}
              commitScope={commitScope}
              activeRepo={activeRepo}
              stashCount={stashSnapshot?.stashes.length ?? 0}
              shelfCount={shelfSnapshot?.shelves.length ?? 0}
              hasRemote={activeRepo?.upstream != null || activeRepo?.ahead != null || activeRepo?.behind != null}
              compareLabel={activeRepo?.upstream ?? null}
              busy={syncing}
              onSelectFile={handleSelectFile}
              onToggleCommitScope={toggleCommitScope}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onRollback={handleRollbackFiles}
              onMoveToChangelist={handleMoveToChangelist}
              onGitMenuAction={handleGitMenuAction}
              onShowGitHistory={handleShowGitHistory}
              onOpenInEditor={handleOpenInEditor}
            />
          </div>

          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-vscode-editor-bg max-form-narrow:hidden">
            {selectedFilePath && selectedFileIsConflicted && (
              <ConflictActionsBar
                filePath={selectedFilePath}
                busy={syncing}
                onAcceptLocal={handleAcceptLocal}
                onAcceptIncoming={handleAcceptIncoming}
                onOpenMerge={handleOpenMerge}
                onApplyNonConflicting={handleApplyNonConflictingClick}
              />
            )}
            {selectedFilePath && selectedFileIsConflicted && activeRepo ? (
              <ConflictMergeView
                client={clientRef.current}
                repoId={activeRepo.id}
                filePath={selectedFilePath}
              />
            ) : (
            <WorkspaceDiffPanel
              document={diffDocument}
              filePath={selectedFilePath}
              loading={diffLoading}
              error={diffError}
              showHunkActions
              stagedView={diffStagedView}
              busy={syncing}
              onToggleStagedView={handleToggleStagedView}
              onStageHunk={handleStageHunk}
              onUnstageHunk={handleUnstageHunk}
              onShelveHunk={handleShelveHunk}
              onStageLines={handleStageLines}
              onUnstageLines={handleUnstageLines}
            />
            )}
          </div>

          <div className="w-changes-commit max-w-[30%] min-w-changes-commit-min shrink-0 flex flex-col border-l border-nx-border bg-panel-bg min-h-0">
            <CommitPanel
              files={committable}
              commitScope={commitScope}
              message={commitMessage}
              amend={amend}
              signoff={signoff}
              gpgSign={gpgSign}
              author={author}
              runChecks={runChecks}
              busy={syncing}
              protectedBranch={activeRepo?.protectedBranch}
              onMessageChange={setCommitMessage}
              onAmendChange={setAmend}
              onSignoffChange={setSignoff}
              onGpgSignChange={setGpgSign}
              onAuthorChange={setAuthor}
              onRunChecksChange={setRunChecks}
              onCommit={handleCommit}
              onCommitAndPush={handleCommitAndPush}
              onRunChecks={handleRunChecks}
            />
          </div>
        </div>
      )}
    </div>
  );
}
