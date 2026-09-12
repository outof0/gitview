import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useEffect } from "react";
import { useGitPanelStore } from "../../stores/gitPanelStore";
import { useMergeClientContext } from "../../hooks/merge/mergeClientContext";
import { GitPanelChrome } from "./GitPanelChrome";
import { GitCommitList } from "./GitCommitList";
import { GitCommitDetail } from "./GitCommitDetail";
import { findCommit } from "./gitPanelFormat";
import { ScrollArea } from "../ui/ScrollArea";

export function ChangesFromBranchPanel() {
  const panel = useGitPanelStore((s) => s.changesFromSide);
  const close = useGitPanelStore((s) => s.closeChangesFromSide);
  const select = useGitPanelStore((s) => s.selectChangesCommit);
  const setFilter = useGitPanelStore((s) => s.setChangesFromSideFilter);
  const client = useMergeClientContext();

  useEffect(() => {
    if (!panel.open || !panel.loading || !client.repoId) {
      return;
    }
    void client.changesFromSide(client.repoId, {
      side: panel.side,
      relativePath: panel.relativePath,
      filterByFile: panel.filterByFile,
    });
  }, [
    panel.open,
    panel.loading,
    panel.side,
    panel.relativePath,
    panel.filterByFile,
    client,
  ]);

  if (!panel.open) {
    return null;
  }

  const selected = findCommit(panel.commits, panel.selectedSha);
  const title = `Changes from ${panel.branchLabel}`;
  const subtitle = panel.revisionRange
    ? `${panel.revisionRange}${panel.filterByFile ? ` · ${panel.relativePath}` : ""}`
    : panel.relativePath;

  return (
    <GitPanelChrome
      title={title}
      subtitle={subtitle}
      onClose={close}
      testId="changes-from-branch-panel"
      footer={
        <>
          <label className="inline-flex items-center gap-2 min-w-0 text-xs leading-code text-foreground cursor-pointer select-none">
            <Input
              type="checkbox"
              className="w-3.5 h-3.5 m-0 accent-ring"
              checked={panel.filterByFile}
              onChange={(e) => setFilter(e.target.checked)}
            />
            Filter by conflicted file
          </label>
          <Button variant="primary" size="content"
            type="button"
            className="btn-vscode min-w-changes-close"
            onClick={close}
          >
            Close
          </Button>
        </>
      }
    >
      {panel.error && (
        <div className="p-3 text-ui-sm text-danger-fg border-b border-border shrink-0">
          {panel.error}
        </div>
      )}
      <div
        className="grid flex-1 min-h-0 grid-cols-[minmax(220px,280px)_minmax(0,1fr)] max-surface-stacked:grid-cols-1 max-surface-stacked:grid-rows-[minmax(120px,30%)_minmax(0,1fr)]"
        data-testid="changes-from-body"
      >
        <ScrollArea
          axis="vertical"
          className="border-r border-border bg-vscode-sidebar-bg max-surface-stacked:border-r-0 max-surface-stacked:border-b max-surface-stacked:border-border"
        >
          <GitCommitList
            commits={panel.commits}
            selectedSha={panel.selectedSha}
            onSelect={select}
            loading={panel.loading}
            compactRows
            emptyLabel={
              panel.filterByFile
                ? "No commits on this branch touched this file."
                : "No commits on this branch since merge-base."
            }
          />
        </ScrollArea>
        <div className="min-w-0 min-h-0 overflow-hidden bg-vscode-editor-bg">
          <GitCommitDetail
            commit={selected}
            highlightPath={panel.relativePath}
            previewText={panel.previewText}
            filePath={panel.relativePath}
          />
        </div>
      </div>
    </GitPanelChrome>
  );
}
