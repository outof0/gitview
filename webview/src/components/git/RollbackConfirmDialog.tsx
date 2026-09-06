import type {
  ConfirmationSubmission,
  RollbackConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { TypedDestructiveConfirmDialog } from "./TypedDestructiveConfirmDialog";

type RollbackConfirmDialogProps = {
  open: boolean;
  confirmation: RollbackConfirmationEvidence;
  busy?: boolean;
  onConfirm: (confirmation: ConfirmationSubmission) => void;
  onCancel: () => void;
};

export function RollbackConfirmDialog({
  open,
  confirmation,
  busy,
  onConfirm,
  onCancel,
}: RollbackConfirmDialogProps) {
  const deletesFiles = confirmation.unversionedPaths.length > 0;
  const confirmationKey = [
    confirmation.repoId,
    JSON.stringify(confirmation.paths),
    JSON.stringify(confirmation.unversionedPaths),
    confirmation.repository.headSha,
    confirmation.repository.currentBranch,
    confirmation.repository.dirty,
    confirmation.repository.conflictCount,
    confirmation.repository.operation,
  ].join(":");

  return (
    <TypedDestructiveConfirmDialog
      open={open}
      title="Rollback local changes?"
      description={
        deletesFiles
          ? "This discards tracked changes and permanently deletes the listed unversioned files from disk."
          : "This discards the selected tracked changes from the working tree."
      }
      expectedTypedValue={confirmation.expectedTypedValue}
      confirmationKey={confirmationKey}
      confirmLabel={deletesFiles ? "Delete and rollback" : "Rollback changes"}
      testId="rollback-confirm-dialog"
      cancelTestId="rollback-cancel"
      confirmTestId="rollback-confirm"
      inputTestId="rollback-typed-value"
      busy={busy}
      warning="This action cannot be undone."
      onCancel={onCancel}
      onConfirm={(typedValue) => onConfirm({ evidence: confirmation, typedValue })}
    >
      <ul className="mb-3 max-h-32 overflow-y-auto text-ui-sm font-mono">
        {confirmation.paths.map((path) => (
          <li key={path} className="truncate">
            {path}
          </li>
        ))}
      </ul>
    </TypedDestructiveConfirmDialog>
  );
}