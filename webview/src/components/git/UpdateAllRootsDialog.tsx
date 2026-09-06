import {
  GitDialogShell,
} from "../ui/GitDialogShell";
import { Button } from "../ui/Button";
import { ScrollArea } from "../ui/ScrollArea";

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
  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  return (
    <GitDialogShell
      open={open}
      title="Update all roots"
      size="wide"
      onCancel={onClose}
      testId="update-all-roots-dialog"
      footer={
        <Button
          type="button"
          variant="secondary" size="compact"
          onClick={onClose}
          data-testid="update-all-roots-close"
        >
          Close
        </Button>
      }
    >
      <p className="mt-0 mb-3">
        {succeeded} succeeded, {failed} failed
      </p>
      <ScrollArea axis="vertical" className="max-h-update-targets-max">
        <ul className="text-ui text-foreground space-y-2 mb-0">
          {results.map((result) => (
            <li
              key={result.repoId}
              className="rounded-vscode border border-border px-2 py-1.5"
              data-testid={`update-root-result-${result.repoId}`}
            >
              <div className="font-medium">{result.name}</div>
              {result.ok ? (
                <div className="text-testing-passed">Updated successfully</div>
              ) : (
                <>
                  <div className="text-danger-fg">
                    {result.error ?? "Update failed"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    {result.repoId === activeRepoId && onShowChanges ? (
                      <Button
                        type="button"
                        variant="secondary" size="compact"
                        onClick={onShowChanges}
                        data-testid={`update-root-show-changes-${result.repoId}`}
                      >
                        Show Changes
                      </Button>
                    ) : null}
                    {onRetryRoot ? (
                      <Button
                        type="button"
                        variant="primary" size="compact"
                        onClick={() => onRetryRoot(result.repoId)}
                        disabled={retryingRepoIds.includes(result.repoId)}
                        data-testid={`update-root-retry-${result.repoId}`}
                      >
                        {retryingRepoIds.includes(result.repoId)
                          ? "Retrying…"
                          : "Retry Root"}
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </GitDialogShell>
  );
}
