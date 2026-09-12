import type {
  ConfirmationSubmission,
  RemoveDirtyWorktreeConfirmationEvidence,
} from "@gitview/shared/types/confirmation";
import { TypedDestructiveConfirmDialog } from "./TypedDestructiveConfirmDialog";

type WorktreeRemoveDialogProps = {
  open: boolean;
  confirmation: RemoveDirtyWorktreeConfirmationEvidence;
  busy?: boolean;
  onConfirm: (confirmation: ConfirmationSubmission) => void;
  onCancel: () => void;
};

export function WorktreeRemoveDialog({
  open,
  confirmation,
  busy = false,
  onConfirm,
  onCancel,
}: WorktreeRemoveDialogProps) {
  const target = confirmation.target;
  return (
    <TypedDestructiveConfirmDialog
      open={open}
      title="Remove worktree?"
      description={
        target.dirty ? (
          <>
            Worktree <span className="font-mono break-all">{target.path}</span> has
            local changes. Force remove will permanently discard them.
          </>
        ) : (
          <>
            Worktree <span className="font-mono break-all">{target.path}</span> no
            longer reports local changes. Confirm its current state before removal.
          </>
        )
      }
      expectedTypedValue={confirmation.expectedTypedValue}
      confirmationKey={JSON.stringify(confirmation)}
      confirmLabel={target.dirty ? "Force remove" : "Remove"}
      testId="worktree-remove-dialog"
      cancelTestId="worktree-remove-cancel"
      confirmTestId="worktree-remove-confirm"
      inputTestId="worktree-remove-typed-value"
      busy={busy}
      warning={
        target.branch ? (
          <>
            Branch <span className="font-mono">{target.branch}</span> at{" "}
            <span className="font-mono">{target.headSha?.slice(0, 7)}</span> is
            checked out in this worktree.
          </>
        ) : (
          <>
            Detached HEAD at{" "}
            <span className="font-mono">{target.headSha?.slice(0, 7)}</span>.
          </>
        )
      }
      onCancel={onCancel}
      onConfirm={(typedValue) =>
        onConfirm({ evidence: confirmation, typedValue })
      }
    />
  );
}
