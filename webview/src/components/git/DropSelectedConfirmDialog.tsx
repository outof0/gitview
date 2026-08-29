import type {
  ConfirmationSubmission,
  DropSelectedConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { TypedDestructiveConfirmDialog } from "./TypedDestructiveConfirmDialog";

type DropSelectedConfirmDialogProps = {
  open: boolean;
  sha: string;
  path: string;
  confirmation?: DropSelectedConfirmationEvidence;
  busy?: boolean;
  onConfirm: (confirmation?: ConfirmationSubmission) => void;
  onCancel: () => void;
};

export function DropSelectedConfirmDialog({
  open,
  sha,
  path,
  confirmation,
  busy,
  onConfirm,
  onCancel,
}: DropSelectedConfirmDialogProps) {
  const confirmationKey = confirmation
    ? [
        confirmation.repoId,
        confirmation.targetSha,
        confirmation.path,
        JSON.stringify(confirmation.selection),
        confirmation.repository.headSha,
        confirmation.repository.currentBranch,
        confirmation.repository.dirty,
        confirmation.repository.conflictCount,
        confirmation.repository.operation,
      ].join(":")
    : sha;

  return (
    <TypedDestructiveConfirmDialog
      open={open}
      title="Drop selected changes"
      description={
        <>
          Remove the selected changes from HEAD commit{" "}
          <span className="font-mono text-foreground">{sha.slice(0, 7)}</span> in{" "}
          <span className="font-mono text-foreground">{path}</span>. Other changes
          in the commit are preserved via amend.
        </>
      }
      expectedTypedValue={confirmation?.expectedTypedValue}
      confirmationKey={confirmationKey}
      confirmLabel="Drop changes"
      testId="drop-selected-dialog"
      cancelTestId="drop-selected-cancel"
      confirmTestId="drop-selected-confirm"
      inputTestId="drop-selected-typed-value"
      busy={busy}
      warning="This rewrites HEAD and cannot be undone on pushed branches without force-push."
      onCancel={onCancel}
      onConfirm={(typedValue) =>
        onConfirm(
          confirmation ? { evidence: confirmation, typedValue } : undefined,
        )
      }
    />
  );
}
