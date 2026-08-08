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
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      role="presentation"
      data-testid="delete-review-source-branch-dialog"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-review-source-branch-title"
        className="w-[min(420px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg"
      >
        <h3
          id="delete-review-source-branch-title"
          className="text-[13px] font-semibold mb-2"
        >
          Delete merged source branch?
        </h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-4">
          Delete remote branch{" "}
          <span className="font-mono">{branchName}</span> on the provider? This
          cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            aria-label="Cancel delete source branch"
            data-testid="delete-review-source-branch-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] hover:opacity-90"
            onClick={onConfirm}
            aria-label="Confirm delete source branch"
            data-testid="delete-review-source-branch-confirm"
          >
            Delete branch
          </button>
        </div>
      </div>
    </div>
  );
}