import {
  GitDialogShell,
  gitDialogBtnPrimary,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";

type DropSelectedConfirmDialogProps = {
  open: boolean;
  sha: string;
  path: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DropSelectedConfirmDialog({
  open,
  sha,
  path,
  onConfirm,
  onCancel,
}: DropSelectedConfirmDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Drop selected changes"
      testId="drop-selected-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="drop-selected-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnPrimary}
            onClick={onConfirm}
            data-testid="drop-selected-confirm"
          >
            Confirm
          </button>
        </>
      }
    >
      <p className="m-0">
        Remove the selected changes from HEAD commit{" "}
        <span className="font-mono text-foreground">{sha.slice(0, 7)}</span> in{" "}
        <span className="font-mono text-foreground">{path}</span>. Other changes in
        the commit are preserved via amend.
      </p>
    </GitDialogShell>
  );
}
