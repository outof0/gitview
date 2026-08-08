import { useState } from "react";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../../ui/GitDialogShell";

type StashChangesDialogProps = {
  open: boolean;
  currentBranch?: string | null;
  /** Paths currently selected in the Changes panel, if any. */
  selectedPaths?: string[];
  busy?: boolean;
  onConfirm: (opts: {
    message?: string;
    includeUntracked?: boolean;
    keepIndex?: boolean;
    paths?: string[];
  }) => void;
  onCancel: () => void;
};

export function StashChangesDialog({
  open,
  currentBranch,
  selectedPaths = [],
  busy = false,
  onConfirm,
  onCancel,
}: StashChangesDialogProps) {
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);

  if (!open) {
    return null;
  }

  const hasSelection = selectedPaths.length > 0;
  const placeholder = currentBranch ? `WIP on ${currentBranch}` : "WIP";

  const confirm = () => {
    onConfirm({
      message: message.trim() || undefined,
      includeUntracked: includeUntracked || undefined,
      keepIndex: keepIndex || undefined,
      paths: onlySelected && hasSelection ? selectedPaths : undefined,
    });
  };

  return (
    <GitDialogShell
      open={open}
      title="Stash Changes"
      testId="stash-changes-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="stash-changes-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            disabled={busy}
            onClick={confirm}
            data-testid="stash-changes-confirm"
          >
            Create Stash
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span>Message</span>
          <input
            type="text"
            className="w-full h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground"
            placeholder={placeholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirm();
              }
            }}
            data-testid="stash-changes-message"
          />
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={keepIndex}
            onChange={(e) => setKeepIndex(e.target.checked)}
            data-testid="stash-changes-keep-index"
          />
          <span>
            Keep index
            <span className="block opacity-70">
              Staged changes stay staged. They are still removed from the
              working tree.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={includeUntracked}
            onChange={(e) => setIncludeUntracked(e.target.checked)}
            data-testid="stash-changes-include-untracked"
          />
          <span>
            Include untracked files
            <span className="block opacity-70">
              Also stashes files Git is not yet tracking.
            </span>
          </span>
        </label>

        {hasSelection ? (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={onlySelected}
              onChange={(e) => setOnlySelected(e.target.checked)}
              data-testid="stash-changes-only-selected"
            />
            <span>
              Only selected files ({selectedPaths.length})
            </span>
          </label>
        ) : null}
      </div>
    </GitDialogShell>
  );
}
