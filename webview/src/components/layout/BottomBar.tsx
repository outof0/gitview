import { useGitViewStore } from "../../stores/gitViewStore";

type BottomBarProps = {
  onCancel: () => void;
  onApply: () => void;
  applyDisabled: boolean;
};

export function BottomBar({
  onCancel,
  onApply,
  applyDisabled,
}: BottomBarProps) {
  const statusMessage = useGitViewStore((s) => s.statusMessage);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-background font-sans">
      <div className="flex items-center gap-2 min-w-0">
        {statusMessage && (
          <span
            className="text-[11.5px] text-[var(--vscode-descriptionForeground)] truncate mr-2"
            data-testid="merge-status-message"
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          data-testid="merge-cancel"
          aria-label="Cancel"
          className="px-3 py-1.5 text-xs rounded-vscode bg-secondary hover:bg-secondary-hover text-secondary-foreground border border-[var(--vscode-button-border,var(--border))] cursor-pointer font-medium outline-none"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          disabled={applyDisabled}
          data-testid="merge-apply"
          aria-label="Apply"
          className="px-3 py-1.5 text-xs rounded-vscode bg-primary hover:bg-primary-hover text-primary-foreground border border-[var(--vscode-button-border,transparent)] cursor-pointer font-semibold disabled:opacity-40 disabled:cursor-not-allowed outline-none"
        >
          Apply
        </button>
      </div>
    </div>
  );
}