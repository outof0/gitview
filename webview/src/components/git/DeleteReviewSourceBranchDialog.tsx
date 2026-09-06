import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";

type DeleteReviewSourceBranchDialogProps = {
  open: boolean;
  branchName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteReviewSourceBranchDialog({
  open,
  branchName,
  onConfirm,
  onCancel,
}: DeleteReviewSourceBranchDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Delete merged source branch?"
      size="medium"
      onCancel={onCancel}
      testId="delete-review-source-branch-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            aria-label="Cancel delete source branch"
            data-testid="delete-review-source-branch-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger" size="compact"
            onClick={onConfirm}
            aria-label="Confirm delete source branch"
            data-testid="delete-review-source-branch-confirm"
          >
            Delete branch
          </Button>
        </>
      }
    >
      <p className="m-0">
        Delete remote branch <span className="font-mono">{branchName}</span> on
        the provider? This cannot be undone.
      </p>
    </GitDialogShell>
  );
}
