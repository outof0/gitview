import {
  GitDialogShell,
  gitDialogBtnDanger,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";

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
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="delete-branch-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnDanger}
            onClick={() => onConfirm(forceRequired)}
            data-testid="delete-branch-confirm"
          >
            {forceRequired ? "Force delete" : "Delete"}
          </button>
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
