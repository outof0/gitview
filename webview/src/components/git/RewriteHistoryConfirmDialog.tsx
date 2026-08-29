import type {
  ConfirmationSubmission,
  DropCommitConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { TypedDestructiveConfirmDialog } from "./TypedDestructiveConfirmDialog";

type RewriteHistoryConfirmDialogProps = {
  open: boolean;
  sha: string;
  action: "squash" | "fixup" | "drop";
  confirmation?: DropCommitConfirmationEvidence;
  busy?: boolean;
  onConfirm: (confirmation?: ConfirmationSubmission) => void;
  onCancel: () => void;
};

const ACTION_LABELS: Record<RewriteHistoryConfirmDialogProps["action"], string> = {
  squash: "Squash into previous commit",
  fixup: "Fixup into previous commit",
  drop: "Drop commit",
};

export function RewriteHistoryConfirmDialog({
  open,
  sha,
  action,
  confirmation,
  busy,
  onConfirm,
  onCancel,
}: RewriteHistoryConfirmDialogProps) {
  const confirmationKey = confirmation
    ? [
        confirmation.repoId,
        confirmation.targetSha,
        confirmation.repository.headSha,
        confirmation.repository.currentBranch,
        confirmation.repository.dirty,
        confirmation.repository.conflictCount,
        confirmation.repository.operation,
      ].join(":")
    : action;

  return (
    <TypedDestructiveConfirmDialog
      open={open}
      title={ACTION_LABELS[action]}
      description={
        <>
          This rewrites history for commit{" "}
          <span className="font-mono">{sha.slice(0, 7)}</span>.
        </>
      }
      expectedTypedValue={confirmation?.expectedTypedValue}
      confirmationKey={confirmationKey}
      confirmLabel={action === "drop" ? "Drop commit" : "Confirm"}
      testId="rewrite-history-dialog"
      cancelTestId="rewrite-history-cancel"
      confirmTestId="rewrite-history-confirm"
      inputTestId="rewrite-history-typed-value"
      busy={busy}
      warning="This action cannot be undone on pushed branches without force-push."
      onCancel={onCancel}
      onConfirm={(typedValue) =>
        onConfirm(
          confirmation ? { evidence: confirmation, typedValue } : undefined,
        )
      }
    />
  );
}
