import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";

type DeleteBranchDialogProps = {
  open: boolean;
  branchName: string;
  forceRequired?: boolean;
  onConfirm: (force: boolean) => void;
  onCancel: () => void;
};

export function DeleteBranchDialog({
  open,
  branchName,
  forceRequired = false,
  onConfirm,
  onCancel,
}: DeleteBranchDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Delete branch?"
      testId="delete-branch-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="delete-branch-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger" size="compact"
            onClick={() => onConfirm(forceRequired)}
            data-testid="delete-branch-confirm"
          >
            {forceRequired ? "Force delete" : "Delete"}
          </Button>
        </>
      }
    >
      <p className="m-0">
        {forceRequired ? (
          <>
            Branch <span className="font-mono text-foreground">{branchName}</span>{" "}
            is not fully merged. Force delete will remove it permanently.
          </>
        ) : (
          <>
            Delete branch{" "}
            <span className="font-mono text-foreground">{branchName}</span>? This
            cannot be undone.
          </>
        )}
      </p>
    </GitDialogShell>
  );
}
