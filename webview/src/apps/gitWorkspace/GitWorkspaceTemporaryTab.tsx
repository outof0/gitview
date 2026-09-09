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
    setPatchPreview,
    activeRepo,
    runMutation,
    loadStashes,
    loadShelves,
  } = ctx;

  const openContentDialog = (
    dialog: "stash" | "unstash",
    index?: number,
  ): void => {
    if (!activeRepo) {
      return;
    }
    void clientRef.current
      .openContentDialog(activeRepo.id, dialog, index ?? null)
      .catch((error: unknown) => {
        useGitWorkspaceStore.getState().setError(
          error instanceof Error ? error.message : "Could not open the Git dialog",
        );
      });
  };

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
          onOpenStashDialog={() => openContentDialog("stash")}
          onOpenUnstashDialog={(index) =>
            openContentDialog("unstash", index)
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
