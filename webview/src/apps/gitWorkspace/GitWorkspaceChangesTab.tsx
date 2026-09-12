import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { buildGitMenuActionPayload, type GitMenuAction } from "@gitview/types";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import { ChangelistBar } from "../../components/git/ChangelistBar";
import { CommitComposer } from "../../components/git/CommitComposer";
import { CommitOptionsDialog } from "../../components/git/CommitOptionsDialog";
import { CommitPanel } from "../../components/git/CommitPanel";
import { GitCommitToolbar } from "./GitCommitToolbar";
import { ConflictActionsBar } from "../../components/git/ConflictActionsBar";
import { ConflictMergeView } from "../../components/git/ConflictMergeView";
import { WorkspaceBranchComparePanel } from "../../components/git/WorkspaceBranchComparePanel";
import { WorkspaceChangesPanel } from "../../components/git/WorkspaceChangesPanel";
import { WorkspaceDiffPanel } from "../../components/git/WorkspaceDiffPanel";
import { ResizableSplit } from "../../components/ui/ResizableSplit";
import { isModDShortcut } from "../../lib/isModDShortcut";
import { reportDiffOpenError } from "../../lib/userError";
import { toFileDiffView } from "../../components/git/workspaceDiffPanel/workspaceDiffPanelUtils";

export function GitWorkspaceChangesTab({
  ctx,
  layout = "workspace",
}: {
  ctx: GitWorkspaceController;
  layout?: "workspace" | "sidebar";
}) {
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
    runHooks,
    diffStagedView,
    stashSnapshot,
    shelfSnapshot,
    clearBranchCompare,
    toggleCommitScope,
    setCommitScope,
    setDiffStagedView,
    setDiffDocument,
    setCommitMessage,
    setAmend,
    setSignoff,
    setGpgSign,
    setAuthor,
    setRunChecks,
    setRunHooks,
    setWorkspaceNotification,
    requestHistoryOpen,
    pendingRollback,
    clearPendingRollback,
    openDialog,
    selectedFileConflicted,
    visibleFiles,
    committableFiles,
    activeRepo,
    runMutation,
    refresh,
    loadDiff,
    commit,
    handleSelectFile: selectFileFromContext,
    handleBranchCompareFile,
    handleApplyNonConflicting,
  } = ctx;
  const [commitOptionsOpen, setCommitOptionsOpen] = useState(false);
  const selectedFilePathRef = useRef(selectedFilePath);
  selectedFilePathRef.current = selectedFilePath;

  const handleSelectFile = useCallback(
    (path: string) => {
      // Keep the shortcut responsive in the same event turn as a row click;
      // React state may not have committed the selection yet.
      selectedFilePathRef.current = path;
      selectFileFromContext(path);
    },
    [selectFileFromContext],
  );
  const [sectionCollapseRequest, setSectionCollapseRequest] = useState({
    collapsed: false,
    token: 0,
  });
  const requestSectionCollapse = useCallback((collapsed: boolean) => {
    setSectionCollapseRequest((current) => ({
      collapsed,
      token: current.token + 1,
    }));
  }, []);

  // `visibleFiles()`/`committableFiles()` are store getters, so calling them in
  // JSX hands WorkspaceChangesPanel a brand-new array every render and defeats
  // the `memo` on FileRow/Section inside it. Both read only statusSnapshot and
  // commitScope, so those are the complete dependency sets.
  const files = useMemo(() => visibleFiles(), [visibleFiles, statusSnapshot]);
  const rollbackFiles = useMemo(
    () => files.filter((file) => file.kind !== "ignored"),
    [files],
  );
  const rollbackPaths = useMemo(
    () => rollbackFiles.map((file) => file.path),
    [rollbackFiles],
  );
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
  // A branch may have a configured remote without tracking an upstream yet.
  // Use the repository's remote snapshot for Fetch instead of treating
  // upstream/ahead/behind as a proxy for remote availability.
  const hasRemote =
    activeRepo?.remoteState?.kind === "available" ||
    (activeRepo?.remoteState == null &&
      (activeRepo?.upstream != null ||
        activeRepo?.ahead != null ||
        activeRepo?.behind != null));

  const requestRollback = useCallback(
    (paths: string[]): boolean => {
      if (rollbackPaths.length === 0) {
        return false;
      }
      const available = new Set(rollbackPaths);
      const selectedPaths = [
        ...new Set(paths.filter((path) => path.length > 0)),
      ].filter((path) => available.has(path));
      if (selectedPaths.length === 0) {
        return false;
      }

      if (layout === "sidebar" && activeRepo) {
        const primaryPath = selectedPaths[0];
        if (!primaryPath) {
          return false;
        }
        const openRollbackPanel = clientRef.current.openRollbackPanel;
        if (typeof openRollbackPanel !== "function") {
          setWorkspaceNotification({
            level: "error",
            message: "Could not open the rollback confirmation.",
          });
          return true;
        }
        void openRollbackPanel(
          activeRepo.id,
          primaryPath,
          selectedPaths,
        ).catch((error: unknown) => {
          setWorkspaceNotification({
            level: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not open the rollback confirmation.",
          });
        });
        return true;
      }

      openDialog("rollbackChanges", {
        paths: rollbackPaths,
        selectedPaths,
      });
      return true;
    },
    [
      activeRepo,
      clientRef,
      layout,
      openDialog,
      rollbackPaths,
      setWorkspaceNotification,
    ],
  );

  const toolbarRollbackPaths = useMemo(() => {
    const available = new Set(rollbackPaths);
    const scoped = [...commitScope].filter((path) => available.has(path));
    if (scoped.length > 0) {
      return scoped;
    }
    return selectedFilePath ? [selectedFilePath] : [];
  }, [commitScope, rollbackPaths, selectedFilePath]);

  // Native Explorer/editor commands arrive through the workspace panel after
  // the host has focused it. Convert that request into the same dialog used by
  // the toolbar and context menu, keeping the confirmation beside the changes
  // it will affect.
  useEffect(() => {
    if (!pendingRollback || !activeRepo) {
      return;
    }
    if (pendingRollback.repoId !== activeRepo.id) {
      return;
    }
    const selectedPaths =
      pendingRollback.selectedPaths && pendingRollback.selectedPaths.length > 0
        ? pendingRollback.selectedPaths
        : [pendingRollback.path];
    if (requestRollback(selectedPaths)) {
      clearPendingRollback();
    }
  }, [activeRepo, clearPendingRollback, pendingRollback, requestRollback]);

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
      requestRollback(paths);
    },
    [requestRollback],
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
      if (action === "stash" || action === "unstash") {
        if (!activeRepo) {
          return;
        }
        void clientRef.current
          .openContentDialog(activeRepo.id, action, null)
          .catch((error: unknown) => {
            setWorkspaceNotification({
              level: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Could not open the Git dialog.",
            });
          });
        return;
      }
      if (action === "rollback") {
        requestRollback([path]);
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
    [
      activeRepo,
      clientRef,
      openDialog,
      requestRollback,
      setWorkspaceNotification,
    ],
  );

  const handleShowGitHistory = useCallback(
    (path: string) => {
      if (!activeRepo) {
        return;
      }
      if (layout === "sidebar") {
        // The activity-bar Commit view is intentionally compact. Open history
        // in the full Git panel so file diffs and folder file lists have room
        // to render instead of replacing the sidebar with a cramped log.
        void clientRef.current.openHistoryPanel(activeRepo.id, path, false);
        return;
      }
      requestHistoryOpen({
        repoId: activeRepo.id,
        path,
        isFolder: false,
      });
    },
    [activeRepo, clientRef, layout, requestHistoryOpen],
  );

  const handleOpenInEditor = useCallback(
    (path: string) => {
      if (!activeRepo) {
        return;
      }
      void clientRef.current
        .openDiff(activeRepo.id, path, diffStagedView)
        .then((document) => {
          setDiffDocument(null);
          if (!document || document.binary) {
            return;
          }
          const title = path.split("/").pop() ?? path;
          return clientRef.current.openDiffInEditor({
            title,
            relativePath: path,
            diff: toFileDiffView(document),
            repoId: document.repoId,
          });
        })
        .catch(reportDiffOpenError);
    },
    [activeRepo, clientRef, diffStagedView, setDiffDocument],
  );

  const canCommit =
    commitMessage.trim().length > 0 && committable.length > 0 && !syncing;

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

  useEffect(() => {
    if (layout !== "sidebar" && ctx.workspaceTab !== "changes") {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModDShortcut(event)) {
        return;
      }
      if (ctx.workspaceTab !== "changes") {
        return;
      }
      const path = selectedFilePathRef.current;
      if (!path) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleOpenInEditor(path);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [ctx.workspaceTab, handleOpenInEditor, layout]);

  if (ctx.workspaceTab !== "changes") {
    return null;
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col w-full overflow-hidden">
      {layout === "sidebar" ? null : (
        <ChangelistBar
          changelists={changelists}
          busy={syncing}
          onActivate={handleActivateChangelist}
          onCreate={handleCreateChangelist}
        />
      )}

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
      ) : layout === "sidebar" ? (
        <div
          className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
          data-testid="workspace-changes-layout"
          data-layout="sidebar"
        >
          <GitCommitToolbar
            busy={syncing}
            hasSelection={toolbarRollbackPaths.length > 0}
            hasDiffSelection={
              selectedFilePath !== null && rollbackPaths.includes(selectedFilePath)
            }
            onRefresh={() => void refresh()}
            onRollback={() => void requestRollback(toolbarRollbackPaths)}
            onShowDiff={() =>
              selectedFilePath && handleOpenInEditor(selectedFilePath)
            }
            onExpandAll={() => requestSectionCollapse(false)}
            onCollapseAll={() => requestSectionCollapse(true)}
          />
          <ResizableSplit
            direction="vertical"
            initialPercent={42}
            minFirstPercent={22}
            minSecondPercent={28}
            storageKey="gitview.commit-sidebar.split"
            className="min-h-0 w-full flex-1 bg-vscode-sidebar-bg"
            first={
              <WorkspaceChangesPanel
                files={files}
                changelists={changelists}
                selectedPath={selectedFilePath}
                commitScope={commitScope}
                hideHeader
                activeRepo={activeRepo}
                stashCount={stashSnapshot?.stashes.length ?? 0}
                shelfCount={shelfSnapshot?.shelves.length ?? 0}
                hasRemote={hasRemote}
                compareLabel={null}
                busy={syncing}
                onSelectFile={handleSelectFile}
                onToggleCommitScope={toggleCommitScope}
                onSetCommitScope={setCommitScope}
                onStage={handleStage}
                onUnstage={handleUnstage}
                onRollback={handleRollbackFiles}
                onMoveToChangelist={handleMoveToChangelist}
                onGitMenuAction={handleGitMenuAction}
                onShowGitHistory={handleShowGitHistory}
                onOpenInEditor={handleOpenInEditor}
                collapseRequest={sectionCollapseRequest}
              />
            }
            second={
              <CommitComposer
                message={commitMessage}
                amend={amend}
                busy={syncing}
                canCommit={canCommit}
                protectedBranch={activeRepo?.protectedBranch}
                onMessageChange={setCommitMessage}
                onAmendChange={setAmend}
                onCommit={handleCommit}
                onCommitAndPush={handleCommitAndPush}
                onOptions={() => setCommitOptionsOpen(true)}
              />
            }
          />
        </div>
      ) : (
        <div
          className="flex min-h-0 min-w-0 w-full flex-1 overflow-hidden"
          data-testid="workspace-changes-layout"
          data-layout="workspace"
        >
          <div className="flex w-changes-files max-w-[30%] min-w-changes-files-min shrink-0 flex-col border-r border-nx-border bg-vscode-sidebar-bg min-h-0 max-form-narrow:w-full max-form-narrow:max-w-none">
            <WorkspaceChangesPanel
              files={files}
              changelists={changelists}
              selectedPath={selectedFilePath}
              commitScope={commitScope}
              activeRepo={activeRepo}
              stashCount={stashSnapshot?.stashes.length ?? 0}
              shelfCount={shelfSnapshot?.shelves.length ?? 0}
              hasRemote={hasRemote}
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-vscode-editor-bg max-form-narrow:hidden">
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

          <div className="flex w-changes-commit max-w-[30%] min-w-changes-commit-min shrink-0 flex-col border-l border-nx-border bg-panel-bg min-h-0">
            <CommitPanel
              files={committable}
              commitScope={commitScope}
              message={commitMessage}
              amend={amend}
              signoff={signoff}
              gpgSign={gpgSign}
              author={author}
              runChecks={runChecks}
              runHooks={runHooks}
              busy={syncing}
              protectedBranch={activeRepo?.protectedBranch}
              onMessageChange={setCommitMessage}
              onAmendChange={setAmend}
              onSignoffChange={setSignoff}
              onGpgSignChange={setGpgSign}
              onAuthorChange={setAuthor}
              onRunChecksChange={setRunChecks}
              onRunHooksChange={setRunHooks}
              onCommit={handleCommit}
              onCommitAndPush={handleCommitAndPush}
              onRunChecks={handleRunChecks}
            />
          </div>
        </div>
      )}
      {layout === "sidebar" ? (
        <CommitOptionsDialog
          open={commitOptionsOpen}
          author={author}
          signoff={signoff}
          gpgSign={gpgSign}
          runHooks={runHooks}
          runChecks={runChecks}
          busy={syncing}
          onAuthorChange={setAuthor}
          onSignoffChange={setSignoff}
          onGpgSignChange={setGpgSign}
          onRunHooksChange={setRunHooks}
          onRunChecksChange={setRunChecks}
          onRunChecksNow={handleRunChecks}
          onClose={() => setCommitOptionsOpen(false)}
        />
      ) : null}
    </div>
  );
}
