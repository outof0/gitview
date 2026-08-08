import type { ResetMode } from "@gitview/shared/types/log";

type ResetConfirmDialogProps = {
  open: boolean;
  sha: string;
  mode: ResetMode;
  onModeChange: (mode: ResetMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const MODE_LABELS: Record<ResetMode, string> = {
  soft: "Soft — keep staged and unstaged changes",
  mixed: "Mixed — keep unstaged changes, unstage commits",
  hard: "Hard — discard all local changes",
  keep: "Keep — keep local changes, unstage commits",
};

export function ResetConfirmDialog({
  open,
  sha,
  mode,
  onModeChange,
  onConfirm,
  onCancel,
}: ResetConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const destructive = mode === "hard" || mode === "mixed" || mode === "keep";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="reset-confirm-dialog"
    >
      <div className="w-[min(440px,92vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Reset current branch?</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-3">
          Reset current branch to commit{" "}
          <span className="font-mono">{sha.slice(0, 7)}</span>. This rewrites
          branch history.
        </p>
        <label className="block text-[11px] mb-1 text-[var(--vscode-descriptionForeground)]">
          Reset mode
        </label>
        <select
          className="w-full h-8 px-2 mb-3 text-[12px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
          value={mode}
          onChange={(e) => onModeChange(e.target.value as ResetMode)}
          data-testid="reset-mode-select"
        >
          {(Object.keys(MODE_LABELS) as ResetMode[]).map((key) => (
            <option key={key} value={key}>
              {MODE_LABELS[key]}
            </option>
          ))}
        </select>
        {destructive && (
          <p className="text-[11px] text-[var(--vscode-inputValidation-warningForeground,#e0ad53)] mb-3">
            This action may discard uncommitted work or staged changes.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            data-testid="reset-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-inputValidation-errorBackground)] text-[var(--vscode-inputValidation-errorForeground)] hover:opacity-90"
            onClick={onConfirm}
            data-testid="reset-confirm"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}