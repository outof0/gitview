import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { WorkspaceTemporaryWorkPanel } from "../../components/git/WorkspaceTemporaryWorkPanel";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

export function GitWorkspaceTemporaryTab({ ctx }: { ctx: GitWorkspaceController }) {
  if (ctx.workspaceTab !== "temporary") {
    return null;
  }
  const {
    clientRef,
    syncing,
    selectedFilePath,
    commitScope,
    temporarySubTab,
    stashSnapshot,
    shelfSnapshot,
    patchPreview,
    setTemporarySubTab,
    openDialog,
    setPatchPreview,
    activeRepo,
    runMutation,
    loadStashes,
    loadShelves,
  } = ctx;

  return (
    <WorkspaceTemporaryWorkPanel
          subTab={temporarySubTab}
          onSubTabChange={setTemporarySubTab}
          stashSnapshot={stashSnapshot}
          shelfSnapshot={shelfSnapshot}
          patchPreview={patchPreview}
          busy={syncing}
          selectedPaths={
            selectedFilePath
              ? [selectedFilePath]
              : [...commitScope]
          }
          onRefreshStash={() => void loadStashes()}
          onRefreshShelf={() => void loadShelves()}
          onOpenStashDialog={() => openDialog("stash", {})}
          onOpenUnstashDialog={(index) =>
            openDialog("unstash", { index: index ?? null })
          }
          onApplyStash={(index, opts) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.applyStash(activeRepo.id, index, opts),
            )
          }
          onPopStash={(index, opts) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.popStash(activeRepo.id, index, opts),
            )
          }
          onDropStash={(index) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.dropStash(activeRepo.id, index),
            )
          }
          onShelveSelected={(paths) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.shelveFiles(activeRepo.id, paths),
            )
          }
          onUnshelve={(shelfId) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.unshelve(activeRepo.id, shelfId),
            )
          }
          onDeleteShelf={(shelfId) =>
            activeRepo &&
            void runMutation(() =>
              clientRef.current.deleteShelf(activeRepo.id, shelfId),
            )
          }
          onCreatePatch={() =>
            activeRepo &&
            void runMutation(async () => {
              const result = await clientRef.current.createPatch(
                activeRepo.id,
                selectedFilePath ? [selectedFilePath] : undefined,
              );
              setPatchPreview(result.patch ?? null);
            })
          }
          onApplyPatchClipboard={(opts) =>
            activeRepo &&
            void (async () => {
              try {
                const patch = await navigator.clipboard.readText();
                await runMutation(() =>
                  clientRef.current.applyPatch(activeRepo.id, patch, {
                    confirmed: true,
                    strip: opts?.strip,
                    directory: opts?.directory,
                  }),
                );
              } catch (err) {
                useGitWorkspaceStore.getState().setError(
                  err instanceof Error ? err.message : "Failed to read clipboard",
                );
              }
            })()
          }
          onImportShelfPatch={() =>
            activeRepo &&
            void (async () => {
              try {
                const patch = patchPreview ?? (await navigator.clipboard.readText());
                await runMutation(() =>
                  clientRef.current.importShelfPatch(activeRepo.id, patch),
                );
              } catch (err) {
                useGitWorkspaceStore.getState().setError(
                  err instanceof Error ? err.message : "Failed to import patch",
                );
              }
            })()
          }
        />
  );
}
