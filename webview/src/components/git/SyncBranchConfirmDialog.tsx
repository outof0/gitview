import type { SyncBranchTarget } from "@gitview/shared/types/branch";

type SyncBranchConfirmDialogProps = {
  open: boolean;
  refName: string;
  targets: SyncBranchTarget[];
  onConfirm: () => void;
  onCancel: () => void;
};

export function SyncBranchConfirmDialog({
  open,
  refName,
  targets,
  onConfirm,
  onCancel,
}: SyncBranchConfirmDialogProps) {
  if (!open) {
    return null;
  }

  const applicable = targets.filter((target) => target.available);
  const unavailable = targets.filter((target) => !target.available);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="sync-branch-dialog"
    >
      <div className="w-[min(480px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">
          Checkout branch across repositories?
        </h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-3">
          Synchronous branch control will checkout{" "}
          <span className="font-mono">{refName}</span> in matching workspace
          repositories.
        </p>
        <ul className="max-h-[220px] overflow-auto text-[12px] space-y-2 mb-3">
          {applicable.map((target) => (
            <li
              key={target.repoId}
              className="rounded-vscode border border-border px-2 py-1.5"
              data-testid={`sync-branch-target-${target.repoId}`}
            >
              <div className="font-medium">{target.name}</div>
              <div className="text-[var(--vscode-descriptionForeground)]">
                {target.currentBranch
                  ? `Current: ${target.currentBranch}`
                  : "Detached or unknown branch"}
              </div>
            </li>
          ))}
          {unavailable.map((target) => (
            <li
              key={target.repoId}
              className="rounded-vscode border border-border px-2 py-1.5 opacity-70"
              data-testid={`sync-branch-skipped-${target.repoId}`}
            >
              <div className="font-medium">{target.name}</div>
              <div className="text-[var(--vscode-descriptionForeground)]">
                {target.unavailableReason ?? "Branch unavailable"}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onCancel}
            data-testid="sync-branch-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:opacity-90 disabled:opacity-50"
            onClick={onConfirm}
            disabled={applicable.length === 0}
            data-testid="sync-branch-confirm"
          >
            Checkout {applicable.length} repositor
            {applicable.length === 1 ? "y" : "ies"}
          </button>
        </div>
      </div>
    </div>
  );
}