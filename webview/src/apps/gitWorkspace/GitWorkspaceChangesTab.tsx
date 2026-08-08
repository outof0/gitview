import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { buildGitMenuActionPayload } from "@gitview/types";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import { ChangelistBar } from "../../components/git/ChangelistBar";
import { ConflictActionsBar } from "../../components/git/ConflictActionsBar";
import { ConflictMergeView } from "../../components/git/ConflictMergeView";
import { WorkspaceBranchComparePanel } from "../../components/git/WorkspaceBranchComparePanel";
import { WorkspaceChangesPanel } from "../../components/git/WorkspaceChangesPanel";
import { WorkspaceDiffPanel } from "../../components/git/WorkspaceDiffPanel";

export function GitWorkspaceChangesTab({ ctx }: { ctx: GitWorkspaceController }) {
  if (ctx.workspaceTab !== "changes") {
    return null;
  }
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
    diffStagedView,
    stashSnapshot,
    shelfSnapshot,
    clearBranchCompare,
    toggleCommitScope,
    setDiffStagedView,
    openDialog,
    selectedFileConflicted,
    visibleFiles,
    activeRepo,
    runMutation,
    refresh,
    loadDiff,
    handleSelectFile,
    handleBranchCompareFile,
    handleApplyNonConflicting,
    handleRollback,
  } = ctx;

  return (
    <>
        <ChangelistBar
          changelists={statusSnapshot?.changelists ?? []}
          busy={syncing}
          onActivate={(listId) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.activateChangelist(activeRepo.id, listId),
            )
          }
          onCreate={(name) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.createChangelist(activeRepo.id, name),
            )
          }
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
          onApplyFile={(path) => {
            if (!activeRepo || !branchCompareSnapshot) {
              return;
            }
            void runMutation(async () => {
              await clientRef.current.applyBranchCompareFile(
                activeRepo.id,
                branchCompareSnapshot.selectedRef,
                path,
                branchCompareSnapshot.mode === "current"
                  ? "current"
                  : "workingTree",
              );
              await refresh();
            });
          }}
          onClose={clearBranchCompare}
        />
      ) : (
        <div className="flex-1 min-h-0 flex">
          <div className="w-[min(42%,320px)] min-w-[220px] flex flex-col border-r border-border">
            <WorkspaceChangesPanel
              files={visibleFiles()}
              changelists={statusSnapshot?.changelists ?? []}
              selectedPath={selectedFilePath}
              commitScope={commitScope}
              activeRepo={activeRepo}
              stashCount={stashSnapshot?.stashes.length ?? 0}
              shelfCount={shelfSnapshot?.shelves.length ?? 0}
              hasRemote={activeRepo?.upstream != null || activeRepo?.ahead != null || activeRepo?.behind != null}
              busy={syncing}
              onSelectFile={handleSelectFile}
              onToggleCommitScope={toggleCommitScope}
              onStage={(paths) =>
                activeRepo &&
                void runMutation(() =>
                  clientRef.current.stageFiles(activeRepo.id, paths),
                )
              }
              onUnstage={(paths) =>
                activeRepo &&
                void runMutation(() =>
                  clientRef.current.unstageFiles(activeRepo.id, paths),
                )
              }
              onRollback={(paths, confirmed) => void handleRollback(paths, confirmed)}
              onMoveToChangelist={(listId, paths) =>
                activeRepo &&
                void runMutation(() =>
                  clientRef.current.moveToChangelist(activeRepo.id, listId, paths),
                )
              }
              onGitMenuAction={(action, path) => {
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
              }}
              onShowGitHistory={(path) =>
                activeRepo &&
                void clientRef.current.openHistoryPanel(
                  activeRepo.id,
                  path,
                  false,
                )
              }
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            {selectedFilePath && selectedFileConflicted() && (
              <ConflictActionsBar
                filePath={selectedFilePath}
                busy={syncing}
                onAcceptLocal={() =>
                  activeRepo &&
                  void runMutation(() =>
                    clientRef.current.acceptConflictLocal(activeRepo.id, [
                      selectedFilePath,
                    ]),
                  )
                }
                onAcceptIncoming={() =>
                  activeRepo &&
                  void runMutation(() =>
                    clientRef.current.acceptConflictIncoming(activeRepo.id, [
                      selectedFilePath,
                    ]),
                  )
                }
                onOpenMerge={() =>
                  activeRepo &&
                  void runMutation(() =>
                    clientRef.current.openMerge(activeRepo.id, selectedFilePath),
                  )
                }
                onApplyNonConflicting={() => void handleApplyNonConflicting()}
              />
            )}
            {selectedFilePath && selectedFileConflicted() && activeRepo ? (
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
              onToggleStagedView={() => {
                const next = !diffStagedView;
                setDiffStagedView(next);
                if (selectedFilePath) {
                  void loadDiff(selectedFilePath, next);
                }
              }}
              onStageHunk={(hunkIndex) =>
                activeRepo &&
                selectedFilePath &&
                void runMutation(async () => {
                  await clientRef.current.stageHunk(
                    activeRepo.id,
                    selectedFilePath,
                    hunkIndex,
                  );
                  await loadDiff(selectedFilePath, diffStagedView);
                })
              }
            onUnstageHunk={(hunkIndex) =>
              activeRepo &&
              selectedFilePath &&
              void runMutation(async () => {
                await clientRef.current.unstageHunk(
                  activeRepo.id,
                  selectedFilePath,
                  hunkIndex,
                );
                await loadDiff(selectedFilePath, diffStagedView);
              })
            }
            onShelveHunk={(hunkIndex) =>
              activeRepo &&
              selectedFilePath &&
              void runMutation(async () => {
                await clientRef.current.shelveHunk(
                  activeRepo.id,
                  selectedFilePath,
                  hunkIndex,
                  { staged: diffStagedView },
                );
                await loadDiff(selectedFilePath, diffStagedView);
              })
            }
            onStageLines={(lines: DiffLineSelection[]) =>
              activeRepo &&
              selectedFilePath &&
              void runMutation(async () => {
                await clientRef.current.stageLines(
                  activeRepo.id,
                  selectedFilePath,
                  lines,
                );
                await loadDiff(selectedFilePath, diffStagedView);
              })
            }
            onUnstageLines={(lines: DiffLineSelection[]) =>
              activeRepo &&
              selectedFilePath &&
              void runMutation(async () => {
                await clientRef.current.unstageLines(
                  activeRepo.id,
                  selectedFilePath,
                  lines,
                );
                await loadDiff(selectedFilePath, diffStagedView);
              })
            }
          />
            )}
          </div>
        </div>
      )}
    </>
  );
}
