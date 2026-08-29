import type {
  ConfirmationSubmission,
  ForceCheckoutConfirmationEvidence,
  MultiRootForceCheckoutConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { TypedDestructiveConfirmDialog } from "./TypedDestructiveConfirmDialog";

type ForceCheckoutDialogProps = {
  open: boolean;
  confirmation:
    | ForceCheckoutConfirmationEvidence
    | MultiRootForceCheckoutConfirmationEvidence;
  repositoryNames: string[];
  busy?: boolean;
  onConfirm: (confirmation: ConfirmationSubmission) => void;
  onCancel: () => void;
};

export function ForceCheckoutDialog({
  open,
  confirmation,
  repositoryNames,
  busy,
  onConfirm,
  onCancel,
}: ForceCheckoutDialogProps) {
  const multiRoot = confirmation.action === "force_checkout_multi";

  return (
    <TypedDestructiveConfirmDialog
      open={open}
      title={multiRoot ? "Force checkout across repositories?" : "Force checkout?"}
      description={
        <>
          Force checkout to{" "}
          <span className="font-mono text-foreground">
            {confirmation.targetRef}
          </span>{" "}
          will discard local changes that conflict with the target branch.
        </>
      }
      expectedTypedValue={confirmation.expectedTypedValue}
      confirmationKey={JSON.stringify(confirmation)}
      confirmLabel="Force checkout"
      testId="force-checkout-dialog"
      cancelTestId="force-checkout-cancel"
      confirmTestId="force-checkout-confirm"
      inputTestId="force-checkout-typed-value"
      busy={busy}
      warning="Uncommitted work may be permanently lost."
      onCancel={onCancel}
      onConfirm={(typedValue) => onConfirm({ evidence: confirmation, typedValue })}
    >
      {multiRoot ? (
        <ul className="mb-3 max-h-32 overflow-y-auto text-[11px]">
          {repositoryNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
    </TypedDestructiveConfirmDialog>
  );
}
