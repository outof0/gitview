import { useEffect, useState } from "react";

type EditCommitMessageDialogProps = {
  open: boolean;
  sha: string;
  initialMessage?: string;
  onConfirm: (message: string) => void;
  onCancel: () => void;
};

export function EditCommitMessageDialog({
  open,
  sha,
  initialMessage = "",
  onConfirm,
  onCancel,
}: EditCommitMessageDialogProps) {
  const [message, setMessage] = useState(initialMessage);

  useEffect(() => {
    if (open) {
      setMessage(initialMessage);
    }
  }, [open, initialMessage]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="edit-commit-message-dialog"
    >
      <div className="w-[min(480px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Edit commit message</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-3">
          Commit <span className="font-mono">{sha.slice(0, 7)}</span>
        </p>
        <textarea
          className="w-full min-h-[96px] mb-4 px-2 py-1.5 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)] resize-y"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          data-testid="edit-commit-message-input"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            data-testid="edit-commit-message-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:opacity-90 disabled:opacity-40"
            disabled={!message.trim()}
            onClick={() => onConfirm(message.trim())}
            data-testid="edit-commit-message-confirm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}