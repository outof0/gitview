type PushUpstreamDialogProps = {
  open: boolean;
  branchName: string;
  remote: string;
  busy?: boolean;
  cancelling?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onCancelPush?: () => void;
};

export function PushUpstreamDialog({
  open,
  branchName,
  remote,
  busy = false,
  cancelling = false,
  onConfirm,
  onCancel,
  onCancelPush,
}: PushUpstreamDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="push-upstream-dialog"
    >
      <div className="w-[min(420px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Set upstream and push?</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-4">
          Branch <span className="font-mono">{branchName}</span> has no upstream
          tracking branch. Push to{" "}
          <span className="font-mono">
            {remote}/{branchName}
          </span>{" "}
          and set it as upstream?
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover disabled:opacity-50"
            onClick={busy ? onCancelPush : onCancel}
            disabled={busy && (!onCancelPush || cancelling)}
            data-testid="push-upstream-cancel"
          >
            {cancelling ? "Cancelling…" : busy ? "Cancel push" : "Cancel"}
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:opacity-90 disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
            data-testid="push-upstream-confirm"
          >
            {busy ? "Pushing…" : "Push and set upstream"}
          </button>
        </div>
      </div>
    </div>
  );
}