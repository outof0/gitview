type WorktreeRemoveDialogProps = {
  open: boolean;
  path: string;
  forceRequired?: boolean;
  onConfirm: (force: boolean) => void;
  onCancel: () => void;
};

export function WorktreeRemoveDialog({
  open,
  path,
  forceRequired = false,
  onConfirm,
  onCancel,
}: WorktreeRemoveDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="worktree-remove-dialog"
    >
      <div className="w-[min(420px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Remove worktree?</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-4">
          {forceRequired ? (
            <>
              Worktree <span className="font-mono">{path}</span> has local changes.
              Force remove will discard uncommitted work.
            </>
          ) : (
            <>
              Remove worktree at <span className="font-mono">{path}</span>?
            </>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] hover:opacity-90"
            onClick={() => onConfirm(forceRequired)}
            data-testid="worktree-remove-confirm"
          >
            {forceRequired ? "Force remove" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}