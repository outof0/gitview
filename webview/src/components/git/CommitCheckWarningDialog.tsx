import type { CommitCheckIssue } from "@gitview/shared/types/commitCheck";
import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";

type CommitCheckWarningDialogProps = {
  open: boolean;
  issues: CommitCheckIssue[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function CommitCheckWarningDialog({
  open,
  issues,
  onConfirm,
  onCancel,
}: CommitCheckWarningDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Commit check warnings"
      size="wide"
      onCancel={onCancel}
      testId="commit-check-warning-dialog"
      footer={
        <>
          <Button
            type="button"
            variant="secondary" size="compact"
            onClick={onCancel}
            data-testid="commit-check-warning-cancel"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary" size="compact"
            onClick={onConfirm}
            data-testid="commit-check-warning-confirm"
          >
            Commit anyway
          </Button>
        </>
      }
    >
      <ul className="m-0 max-h-40 overflow-y-auto space-y-1">
        {issues.map((issue, index) => (
          <li key={`${issue.kind}-${index}`}>{issue.message}</li>
        ))}
      </ul>
    </GitDialogShell>
  );
}
