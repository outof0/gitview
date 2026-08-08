import { useEffect, useRef, useState } from "react";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type { StashDetail, StashFileEntry } from "@gitview/shared/types/stash";
import { StashChangesDialog } from "../../components/git/stash/StashChangesDialog";
import { UnstashChangesDialog } from "../../components/git/stash/UnstashChangesDialog";
import type { GitWorkspaceDialogPayloads } from "../../stores/gitWorkspaceDialogs";
import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";

/**
 * The native Git submenu can open these outside the Temporary tab, which is the
 * only place that otherwise fetches the stash list.
 */
function useStashList(ctx: GitWorkspaceController) {
  const { stashSnapshot, loadStashes } = ctx;
  useEffect(() => {
    if (!stashSnapshot) {
      void loadStashes();
    }
  }, [stashSnapshot, loadStashes]);
  return stashSnapshot?.stashes ?? [];
}

function useStashMutation(ctx: GitWorkspaceController, close: () => void) {
  return (run: (repoId: string) => Promise<unknown>) => {
    const repo = ctx.activeRepo;
    if (!repo) {
      return;
    }
    void ctx.runMutation(async () => {
      await run(repo.id);
      close();
    });
  };
}

export function StashDialog({ ctx }: { ctx: GitWorkspaceController }) {
  useStashList(ctx);
  const close = () => ctx.closeDialog("stash");
  const mutate = useStashMutation(ctx, close);

  return (
    <StashChangesDialog
      open
      currentBranch={ctx.activeRepo?.currentBranch ?? null}
      selectedPaths={
        ctx.selectedFilePath ? [ctx.selectedFilePath] : [...ctx.commitScope]
      }
      busy={ctx.syncing}
      onConfirm={(opts) =>
        mutate((repoId) => ctx.clientRef.current.pushStash(repoId, opts))
      }
      onCancel={close}
    />
  );
}

export function UnstashDialog({
  payload,
  ctx,
}: {
  payload: GitWorkspaceDialogPayloads["unstash"];
  ctx: GitWorkspaceController;
}) {
  const { clientRef, activeRepo } = ctx;
  const stashes = useStashList(ctx);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [detail, setDetail] = useState<StashDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<StashFileEntry | null>(null);
  const [fileDiff, setFileDiff] = useState<WorkspaceDiffDocument | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState(false);
  const [fileDiffError, setFileDiffError] = useState<string | null>(null);

  const loadFileDiff = async (index: number, file: StashFileEntry) => {
    if (!activeRepo) {
      return;
    }
    setSelectedFile(file);
    setFileDiff(null);
    setFileDiffError(null);
    setFileDiffLoading(true);
    try {
      setFileDiff(
        await clientRef.current.getStashFileDiff(
          activeRepo.id,
          index,
          file.path,
          file.origin,
        ),
      );
    } catch (err) {
      setFileDiffError(err instanceof Error ? err.message : String(err));
    } finally {
      setFileDiffLoading(false);
    }
  };

  const selectStash = async (index: number) => {
    if (!activeRepo) {
      return;
    }
    setSelectedIndex(index);
    setDetail(null);
    setDetailError(null);
    setSelectedFile(null);
    setFileDiff(null);
    setFileDiffError(null);
    setDetailLoading(true);
    try {
      const next = await clientRef.current.getStashDetail(activeRepo.id, index);
      setDetail(next);
      const first = next?.files[0];
      if (first) {
        await loadFileDiff(index, first);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const selectStashRef = useRef(selectStash);
  selectStashRef.current = selectStash;

  const requestedIndex = payload.index ?? stashes[0]?.index ?? null;
  useEffect(() => {
    if (requestedIndex !== null) {
      void selectStashRef.current(requestedIndex);
    }
  }, [requestedIndex]);

  const close = () => ctx.closeDialog("unstash");
  const mutate = useStashMutation(ctx, close);

  return (
    <UnstashChangesDialog
      open
      stashes={stashes}
      currentBranch={activeRepo?.currentBranch ?? null}
      busy={ctx.syncing}
      detail={detail}
      detailLoading={detailLoading}
      detailError={detailError}
      fileDiff={fileDiff}
      fileDiffLoading={fileDiffLoading}
      fileDiffError={fileDiffError}
      selectedIndex={selectedIndex}
      onSelectStash={(index) => void selectStash(index)}
      selectedFile={selectedFile}
      onSelectFile={(file) => {
        if (selectedIndex !== null) {
          void loadFileDiff(selectedIndex, file);
        }
      }}
      onApply={(index, opts) =>
        mutate((repoId) => clientRef.current.applyStash(repoId, index, opts))
      }
      onPop={(index, opts) =>
        mutate((repoId) => clientRef.current.popStash(repoId, index, opts))
      }
      onDrop={(index) =>
        mutate((repoId) => clientRef.current.dropStash(repoId, index))
      }
      onBranch={(index, branch) =>
        mutate((repoId) => clientRef.current.branchStash(repoId, index, branch))
      }
      onClear={() => mutate((repoId) => clientRef.current.clearStashes(repoId))}
      onCancel={close}
    />
  );
}
