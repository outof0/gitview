import type { CommitCheckIssue } from "@gitview/shared/types/commitCheck";

type CommitCheckWarningDialogProps = {
  open: boolean;
  issues: CommitCheckIssue[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function CommitCheckWarningDialog({
  open,
  issues,
  onConfirm,
  onCancel,
}: CommitCheckWarningDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="commit-check-warning-dialog"
    >
      <div className="w-[min(480px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Commit check warnings</h3>
        <ul className="mb-4 max-h-40 overflow-y-auto text-[12px] text-[var(--vscode-descriptionForeground)] space-y-1">
          {issues.map((issue, index) => (
            <li key={`${issue.kind}-${index}`}>{issue.message}</li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            data-testid="commit-check-warning-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:opacity-90"
            onClick={onConfirm}
            data-testid="commit-check-warning-confirm"
          >
            Commit anyway
          </button>
        </div>
      </div>
    </div>
  );
}