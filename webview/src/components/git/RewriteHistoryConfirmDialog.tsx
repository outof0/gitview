type RewriteHistoryConfirmDialogProps = {
  open: boolean;
  sha: string;
  action: "squash" | "fixup" | "drop";
  onConfirm: () => void;
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
  onConfirm,
  onCancel,
}: RewriteHistoryConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="rewrite-history-dialog"
    >
      <div className="w-[min(420px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">{ACTION_LABELS[action]}</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-4">
          This rewrites history for commit{" "}
          <span className="font-mono">{sha.slice(0, 7)}</span>. This action cannot be
          undone on pushed branches without force-push.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            data-testid="rewrite-history-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:opacity-90"
            onClick={onConfirm}
            data-testid="rewrite-history-confirm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}