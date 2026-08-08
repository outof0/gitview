import { useState } from "react";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import type {
  StashDetail,
  StashEntry,
  StashFileEntry,
} from "@gitview/shared/types/stash";
import {
  GitDialogShell,
  gitDialogBtnDanger,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../../ui/GitDialogShell";
import { StashDetailView } from "./StashDetailView";
import { StashList } from "./StashList";

type UnstashChangesDialogProps = {
  open: boolean;
  stashes: StashEntry[];
  currentBranch?: string | null;
  busy?: boolean;
  detail: StashDetail | null;
  detailLoading?: boolean;
  detailError?: string | null;
  fileDiff: WorkspaceDiffDocument | null;
  fileDiffLoading?: boolean;
  fileDiffError?: string | null;
  selectedIndex: number | null;
  onSelectStash: (index: number) => void;
  selectedFile: StashFileEntry | null;
  onSelectFile: (file: StashFileEntry) => void;
  onApply: (index: number, opts: { reinstateIndex?: boolean }) => void;
  onPop: (index: number, opts: { reinstateIndex?: boolean }) => void;
  onDrop: (index: number) => void;
  onBranch: (index: number, branch: string) => void;
  onClear: () => void;
  onCancel: () => void;
};

export function UnstashChangesDialog({
  open,
  stashes,
  currentBranch,
  busy = false,
  detail,
  detailLoading = false,
  detailError = null,
  fileDiff,
  fileDiffLoading = false,
  fileDiffError = null,
  selectedIndex,
  onSelectStash,
  selectedFile,
  onSelectFile,
  onApply,
  onPop,
  onDrop,
  onBranch,
  onClear,
  onCancel,
}: UnstashChangesDialogProps) {
  const [popStash, setPopStash] = useState(false);
  const [reinstateIndex, setReinstateIndex] = useState(false);
  const [newBranch, setNewBranch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  if (!open) {
    return null;
  }

  const hasSelection = selectedIndex !== null;
  const branch = newBranch.trim();

  const confirm = () => {
    if (selectedIndex === null) {
      return;
    }
    // `git stash branch` already applies and drops the stash, so it replaces
    // the pop/apply pair rather than running alongside it.
    if (branch) {
      onBranch(selectedIndex, branch);
      return;
    }
    const opts = { reinstateIndex: reinstateIndex || undefined };
    if (popStash) {
      onPop(selectedIndex, opts);
    } else {
      onApply(selectedIndex, opts);
    }
  };

  return (
    <GitDialogShell
      open={open}
      size="xl"
      title="Unstash Changes"
      testId="unstash-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnDanger}
            disabled={busy || !hasSelection}
            onClick={() => selectedIndex !== null && onDrop(selectedIndex)}
            data-testid="unstash-drop"
          >
            Drop
          </button>
          <button
            type="button"
            className={gitDialogBtnDanger}
            disabled={busy || stashes.length === 0}
            onClick={() => (confirmClear ? onClear() : setConfirmClear(true))}
            data-testid="unstash-clear"
          >
            {confirmClear ? `Delete all ${stashes.length}?` : "Clear"}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="unstash-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            disabled={busy || !hasSelection}
            onClick={confirm}
            data-testid="unstash-confirm"
          >
            {branch ? "Create Branch" : popStash ? "Pop Stash" : "Apply Stash"}
          </button>
        </>
      }
    >
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            <span className="text-vscode-description">Apply into branch</span>
            <select
              className="h-[var(--nx-row-h)] px-1 rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground disabled:opacity-60"
              value={currentBranch ?? ""}
              disabled
              title="Git applies a stash to the current branch. Check out another branch first to apply it there."
              data-testid="unstash-branch"
            >
              <option value={currentBranch ?? ""}>
                {currentBranch ?? "current branch"}
              </option>
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={popStash}
              disabled={Boolean(branch)}
              onChange={(e) => setPopStash(e.target.checked)}
              data-testid="unstash-pop"
            />
            Pop stash (remove after applying)
          </label>

          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={reinstateIndex}
              disabled={Boolean(branch)}
              onChange={(e) => setReinstateIndex(e.target.checked)}
              data-testid="unstash-reinstate-index"
            />
            Reinstate index
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-vscode-description">As new branch</span>
            <input
              type="text"
              className="h-[var(--nx-row-h)] px-1 rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground"
              value={newBranch}
              placeholder="leave empty to apply in place"
              onChange={(e) => setNewBranch(e.target.value)}
              data-testid="unstash-new-branch"
            />
          </label>
        </div>

        <div className="shrink-0 max-h-[132px] overflow-y-auto border border-border rounded-vscode">
          <StashList
            stashes={stashes}
            selectedIndex={selectedIndex}
            onSelect={onSelectStash}
            busy={busy}
            selectedFileCount={detail?.files.length ?? null}
            onApply={(index) =>
              onApply(index, { reinstateIndex: reinstateIndex || undefined })
            }
            onPop={(index) =>
              onPop(index, { reinstateIndex: reinstateIndex || undefined })
            }
            onDrop={onDrop}
            emptyLabel="No stashes to restore."
          />
        </div>

        {hasSelection ? (
          <StashDetailView
            detail={detail}
            loading={detailLoading}
            error={detailError}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            fileDiff={fileDiff}
            fileDiffLoading={fileDiffLoading}
            fileDiffError={fileDiffError}
          />
        ) : (
          <div
            className="flex-1 min-h-0 flex items-center justify-center border border-border rounded-vscode text-vscode-description"
            data-testid="unstash-no-selection"
          >
            Select a stash to see what it contains.
          </div>
        )}
      </div>
    </GitDialogShell>
  );
}
