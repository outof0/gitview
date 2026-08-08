import { useEffect, useState } from "react";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";

type RenameBranchDialogProps = {
  open: boolean;
  oldName: string;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
};

export function RenameBranchDialog({
  open,
  oldName,
  onConfirm,
  onCancel,
}: RenameBranchDialogProps) {
  const [newName, setNewName] = useState(oldName);

  useEffect(() => {
    if (open) {
      setNewName(oldName);
    }
  }, [open, oldName]);

  return (
    <GitDialogShell
      open={open}
      title="Rename branch"
      testId="rename-branch-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="rename-branch-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            disabled={!newName.trim() || newName.trim() === oldName}
            onClick={() => onConfirm(newName.trim())}
            data-testid="rename-branch-confirm"
          >
            Rename
          </button>
        </>
      }
    >
      <p className="m-0 mb-1.5">
        Rename <span className="font-mono text-foreground">{oldName}</span> to:
      </p>
      <input
        type="text"
        className="w-full h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        data-testid="rename-branch-input"
      />
    </GitDialogShell>
  );
}
