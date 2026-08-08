type RootUpdateResult = {
  repoId: string;
  name: string;
  ok: boolean;
  error?: string;
};

type UpdateAllRootsDialogProps = {
  open: boolean;
  results: RootUpdateResult[];
  onClose: () => void;
};

export function UpdateAllRootsDialog({
  open,
  results,
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
                <div className="text-[var(--vscode-errorForeground)]">
                  {result.error ?? "Update failed"}
                </div>
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