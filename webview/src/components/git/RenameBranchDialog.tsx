import {
  useEffect,
  useState,
} from "react";
import { GitDialogShell } from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";

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
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="rename-branch-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            disabled={!newName.trim() || newName.trim() === oldName}
            onClick={() => onConfirm(newName.trim())}
            data-testid="rename-branch-confirm"
          >
            Rename
          </Button>
        </>
      }
    >
      <p className="m-0 mb-1.5">
        Rename <span className="font-mono text-foreground">{oldName}</span> to:
      </p>
      <TextField
        size="compact"
        containerClassName="w-full"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        data-testid="rename-branch-input"
      />
    </GitDialogShell>
  );
}
