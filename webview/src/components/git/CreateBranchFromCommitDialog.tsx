import {
  useState,
} from "react";
import { GitDialogShell } from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";

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
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="create-branch-from-commit-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
            data-testid="create-branch-from-commit-confirm"
          >
            Create
          </Button>
        </>
      }
    >
      <p className="m-0 mb-1.5">
        New branch at{" "}
        <span className="font-mono text-foreground">{sha.slice(0, 7)}</span>
      </p>
      <TextField
        size="compact"
        containerClassName="w-full"
        placeholder="Branch name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="create-branch-from-commit-input"
      />
    </GitDialogShell>
  );
}
