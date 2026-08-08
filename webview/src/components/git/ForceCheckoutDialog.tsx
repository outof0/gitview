import {
  GitDialogShell,
  gitDialogBtnDanger,
  gitDialogBtnSecondary,
} from "../ui/GitDialogShell";

type ForceCheckoutDialogProps = {
  open: boolean;
  refName: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ForceCheckoutDialog({
  open,
  refName,
  onConfirm,
  onCancel,
}: ForceCheckoutDialogProps) {
  return (
    <GitDialogShell
      open={open}
      title="Force checkout?"
      testId="force-checkout-dialog"
      footer={
        <>
          <button
            type="button"
            className={gitDialogBtnSecondary}
            onClick={onCancel}
            data-testid="force-checkout-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className={gitDialogBtnDanger}
            onClick={onConfirm}
            data-testid="force-checkout-confirm"
          >
            Force checkout
          </button>
        </>
      }
    >
      <p className="m-0">
        Force checkout to <span className="font-mono text-foreground">{refName}</span>{" "}
        will discard local changes that conflict with the target branch. This may
        cause uncommitted work to be lost.
      </p>
    </GitDialogShell>
  );
}
