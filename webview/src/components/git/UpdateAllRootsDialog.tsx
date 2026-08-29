type RootUpdateResult = {
  repoId: string;
  name: string;
  ok: boolean;
  error?: string;
};

type UpdateAllRootsDialogProps = {
  open: boolean;
  results: RootUpdateResult[];
  activeRepoId?: string | null;
  retryingRepoIds?: string[];
  onRetryRoot?: (repoId: string) => void;
  onShowChanges?: () => void;
  onClose: () => void;
};

export function UpdateAllRootsDialog({
  open,
  results,
  activeRepoId = null,
  retryingRepoIds = [],
  onRetryRoot,
  onShowChanges,
  onClose,
}: UpdateAllRootsDialogProps) {
  if (!open) {
    return null;
  }

  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      data-testid="update-all-roots-dialog"
    >
      <div className="w-[min(480px,90vw)] rounded-vscode border border-border bg-[var(--vscode-editor-background)] p-4 shadow-lg">
        <h3 className="text-[13px] font-semibold mb-2">Update all roots</h3>
        <p className="text-[12px] text-[var(--vscode-descriptionForeground)] mb-3">
          {succeeded} succeeded, {failed} failed
        </p>
        <ul className="max-h-[240px] overflow-auto text-[12px] space-y-2 mb-4">
          {results.map((result) => (
            <li
              key={result.repoId}
              className="rounded-vscode border border-border px-2 py-1.5"
              data-testid={`update-root-result-${result.repoId}`}
            >
              <div className="font-medium">{result.name}</div>
              {result.ok ? (
                <div className="text-[var(--vscode-testing-iconPassed,var(--foreground))]">
                  Updated successfully
                </div>
              ) : (
                <>
                  <div className="text-[var(--vscode-errorForeground)]">
                    {result.error ?? "Update failed"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    {result.repoId === activeRepoId && onShowChanges ? (
                      <button
                        type="button"
                        className="btn-vscode-secondary h-[var(--nx-row-h)] px-2 text-[11px]"
                        onClick={onShowChanges}
                        data-testid={`update-root-show-changes-${result.repoId}`}
                      >
                        Show Changes
                      </button>
                    ) : null}
                    {onRetryRoot ? (
                      <button
                        type="button"
                        className="btn-vscode h-[var(--nx-row-h)] px-2 text-[11px]"
                        onClick={() => onRetryRoot(result.repoId)}
                        disabled={retryingRepoIds.includes(result.repoId)}
                        data-testid={`update-root-retry-${result.repoId}`}
                      >
                        {retryingRepoIds.includes(result.repoId)
                          ? "Retrying…"
                          : "Retry Root"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <button
            type="button"
            className="h-7 px-3 text-[12px] rounded-vscode hover:bg-list-hover"
            onClick={onClose}
            data-testid="update-all-roots-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}