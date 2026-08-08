import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { WorkspaceBlamePanel } from "../../components/git/WorkspaceBlamePanel";
import { WorkspaceLogPanel } from "../../components/git/WorkspaceLogPanel";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

export function GitWorkspaceLogTab({ ctx }: { ctx: GitWorkspaceController }) {
  if (ctx.workspaceTab !== "log" && ctx.workspaceTab !== "blame") {
    return null;
  }
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
  } = ctx;

  return (
    workspaceTab === "log" ? (
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
          onSelectCommit={(sha, multi) =>
            multi ? toggleLogCommitSelection(sha, true) : selectLogCommit(sha)
          }
          issueTrackerBaseUrl={issueTrackerBaseUrl}
          currentBranchHeadSha={activeRepo?.headSha ?? null}
          onSelectFile={(path, status) => {
            selectLogFile(path);
            const sha = useGitWorkspaceStore.getState().logSelectedSha;
            if (sha) {
              void loadLogFileDiff(sha, path, status);
            }
          }}
          filters={logFilters}
          onFiltersChange={setLogFilters}
          onRefresh={() => void loadLog()}
          busy={syncing}
          protectedBranch={activeRepo?.protectedBranch}
          hasUpstream={Boolean(activeRepo?.upstream)}
          onCherryPick={(sha) =>
            activeRepo &&
            void runMutation(() => clientRef.current.cherryPick(activeRepo.id, sha))
          }
          onCherryPickMultiple={(shas) =>
            activeRepo &&
            void runMutation(async () => {
              await clientRef.current.cherryPickMultiple(activeRepo.id, shas);
              await loadLog();
            })
          }
          onRevert={(sha) =>
            activeRepo &&
            void runMutation(() => clientRef.current.revert(activeRepo.id, sha))
          }
          onRevertMultiple={(shas) =>
            activeRepo &&
            void runMutation(async () => {
              await clientRef.current.revertMultiple(activeRepo.id, shas);
              await loadLog();
            })
          }
          onCopyHash={(sha) => void handleCopyHash(sha)}
          onCreateBranchFromCommit={(sha) =>
            openDialog("createBranchFromCommit", { sha })
          }
          onResetToCommit={(sha, mode) => void handleReset(sha, mode)}
          onUndoLastCommit={() =>
            activeRepo &&
            void runMutation(async () => {
              try {
                await clientRef.current.undoLastCommit(activeRepo.id);
              } catch (err) {
                const message =
                  err instanceof Error ? err.message : String(err);
                if (
                  message.toLowerCase().includes("requires confirmation") &&
                  window.confirm(
                    "Undo the last commit? This rewrites local history (mixed reset to HEAD~1).",
                  )
                ) {
                  await clientRef.current.undoLastCommit(activeRepo.id, true);
                } else if (
                  !message.toLowerCase().includes("requires confirmation")
                ) {
                  throw err;
                } else {
                  return;
                }
              }
              await loadLog();
            })
          }
          onEditMessage={(sha, subject) =>
            openDialog("editMessage", { sha, subject })
          }
          onDropCommit={(sha) => void handleRewriteHistory(sha, "drop")}
          onRewriteCommit={(sha, action) =>
            void handleRewriteHistory(sha, action)
          }
          onExtractChanges={(sha) =>
            activeRepo &&
            void runMutation(async () => {
              await clientRef.current.extractChanges(activeRepo.id, sha);
              await loadLog();
            })
          }
          canDropSelected={Boolean(
            logSelectedSha &&
              activeRepo?.headSha &&
              logSelectedSha === activeRepo.headSha,
          )}
          protectedBranchForDrop={activeRepo?.protectedBranch}
          onCherryPickHunk={(hunkIndex) =>
            activeRepo &&
            logSelectedSha &&
            logSelectedFilePath &&
            void runMutation(async () => {
              await clientRef.current.cherryPickSelected(
                activeRepo.id,
                logSelectedSha,
                logSelectedFilePath,
                { hunkIndexes: [hunkIndex] },
              );
            })
          }
          onRevertHunk={(hunkIndex) =>
            activeRepo &&
            logSelectedSha &&
            logSelectedFilePath &&
            void runMutation(async () => {
              await clientRef.current.revertSelected(
                activeRepo.id,
                logSelectedSha,
                logSelectedFilePath,
                { hunkIndexes: [hunkIndex] },
              );
            })
          }
          onDropHunk={(hunkIndex) =>
            logSelectedSha &&
            logSelectedFilePath &&
            void handleDropSelected(logSelectedSha, logSelectedFilePath, {
              hunkIndexes: [hunkIndex],
            })
          }
          onCherryPickLines={(lines) =>
            activeRepo &&
            logSelectedSha &&
            logSelectedFilePath &&
            void runMutation(async () => {
              await clientRef.current.cherryPickSelected(
                activeRepo.id,
                logSelectedSha,
                logSelectedFilePath,
                { lines },
              );
            })
          }
          onRevertLines={(lines) =>
            activeRepo &&
            logSelectedSha &&
            logSelectedFilePath &&
            void runMutation(async () => {
              await clientRef.current.revertSelected(
                activeRepo.id,
                logSelectedSha,
                logSelectedFilePath,
                { lines },
              );
            })
          }
          onDropLines={(lines) =>
            logSelectedSha &&
            logSelectedFilePath &&
            void handleDropSelected(logSelectedSha, logSelectedFilePath, { lines })
          }
        />
  ) : (
    <WorkspaceBlamePanel
      snapshot={blameSnapshot}
      filePath={selectedFilePath}
      loading={blameLoading}
      error={blameError}
    />
  )
  );
}
