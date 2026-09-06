import { Button } from "../ui/Button";
import { useEffect, useState } from "react";
import type { ProtocolClient } from "../../protocol/client";
import { useGitViewStore } from "../../stores/gitViewStore";
import { isMergeDocument } from "../../hooks/merge/mergeHostMessageGuards";
import { MergeResolverPanes } from "../merge/MergeResolverPanes";

type ConflictMergeViewProps = {
  client: ProtocolClient;
  repoId: string;
  filePath: string;
};

/**
 * Conflicted files have no meaningful HEAD↔worktree diff — the worktree side is
 * just Git's marker soup — so the Changes tab previews them with the same
 * three-way resolver the standalone Merge Studio uses.
 */
export function ConflictMergeView({
  client,
  repoId,
  filePath,
}: ConflictMergeViewProps) {
  const activeDocument = useGitViewStore((s) => s.activeDocument);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const onMessage = (event: MessageEvent) => {
      if (!cancelled && isMergeDocument(event.data)) {
        useGitViewStore.getState().setActiveDocument(event.data.payload);
      }
    };
    window.addEventListener("message", onMessage);

    setError(null);
    useGitViewStore.getState().setActiveDocument(null);
    void client.openMergeFile(repoId, filePath).catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      useGitViewStore.getState().setActiveDocument(null);
    };
  }, [client, repoId, filePath]);

  if (error) {
    return (
      <div
        className="flex-1 min-h-0 p-3 text-ui text-danger-fg"
        data-testid="conflict-merge-error"
      >
        {error}
      </div>
    );
  }

  return (
    <div
      className="flex-1 min-h-0 flex flex-col"
      data-testid="conflict-merge-view"
    >
      <MergeResolverPanes
        activeDocument={
          activeDocument?.relativePath === filePath ? activeDocument : null
        }
        loadingLabel={`Loading conflict — ${filePath}`}
        footer={(surface) => (
          <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-t border-border text-ui-sm text-vscode-description">
            <span data-testid="conflict-merge-remaining">
              {surface.remaining > 0
                ? `${surface.remaining} of ${surface.totalChanges} conflicts left`
                : `All ${surface.totalChanges} changes resolved`}
            </span>
            <div className="flex-1" />
            {surface.unresolvedSimpleConflicts > 0 && (
              <Button variant="secondary" size="content"
                type="button"
                className="btn-vscode-secondary h-6 px-2 text-ui-sm inline-flex items-center gap-1"
                onClick={() =>
                  useGitViewStore.getState().resolveSimpleConflicts()
                }
                title="Magic Merge — Resolve simple conflicts"
                aria-label="Magic Merge: Resolve simple conflicts"
                data-testid="conflict-merge-magic"
              >
                <span aria-hidden="true">✦</span>
                Magic Merge
              </Button>
            )}
            <Button variant="primary" size="content"
              type="button"
              className="h-6 px-3 text-ui-sm rounded-vscode bg-primary text-primary-foreground disabled:opacity-40"
              disabled={surface.remaining > 0}
              onClick={surface.onApply}
              data-testid="conflict-merge-apply"
            >
              Apply
            </Button>
          </div>
        )}
      />
    </div>
  );
}
