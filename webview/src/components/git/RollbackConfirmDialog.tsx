type RollbackConfirmDialogProps = {
  open: boolean;
  paths: string[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function RollbackConfirmDialog({
  open,
  paths,
  onConfirm,
  onCancel,
}: RollbackConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="rollback-confirm-dialog"
    >
      <div className="w-[min(400px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Delete unversioned files?</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-3">
          Rolling back unversioned files permanently deletes them from disk. This
          cannot be undone.
        </p>
        <ul className="mb-4 max-h-32 overflow-y-auto text-[11px] font-mono">
          {paths.map((path) => (
            <li key={path} className="truncate">
              {path}
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            data-testid="rollback-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:opacity-90"
            onClick={onConfirm}
            data-testid="rollback-confirm"
          >
            Delete files
          </button>
        </div>
      </div>
    </div>
  );
}