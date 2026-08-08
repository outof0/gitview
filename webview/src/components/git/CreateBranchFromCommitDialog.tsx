import { useState } from "react";
import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";

type CreateBranchFromCommitDialogProps = {
  open: boolean;
  sha: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export function CreateBranchFromCommitDialog({
  open,
  sha,
  onConfirm,
  onCancel,
}: CreateBranchFromCommitDialogProps) {
  const [name, setName] = useState("");

  return (
    <GitDialogShell
      open={open}
      title="Create branch from commit"
      testId="create-branch-from-commit-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="create-branch-from-commit-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
            data-testid="create-branch-from-commit-confirm"
          >
            Create
          </button>
        </>
      }
    >
      <p className="m-0 mb-1.5">
        New branch at{" "}
        <span className="font-mono text-foreground">{sha.slice(0, 7)}</span>
      </p>
      <input
        type="text"
        className="w-full h-[var(--nx-row-h)] px-1.5 text-[length:var(--nx-font-size-ui)] rounded-vscode border border-border bg-[var(--vscode-input-background)] text-foreground"
        placeholder="Branch name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="create-branch-from-commit-input"
      />
    </GitDialogShell>
  );
}
