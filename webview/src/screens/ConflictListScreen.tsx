import { Button } from "../components/ui/Button";
import { useGitViewStore } from "../stores/gitViewStore";
import { useMergeClientContext } from "../hooks/merge/mergeClientContext";
import { ToolEmptyState } from "../components/ui/ToolEmptyState";
import { ScrollArea } from "../components/ui/ScrollArea";

export function ConflictListScreen() {
  const { conflictFiles, branchInfo, loading, error, backToList } =
    useGitViewStore();
  const client = useMergeClientContext();

  const handleRefresh = () => {
    if (client.repoId) {
      void client.refreshConflicts(client.repoId);
    }
  };

  const handleOpenFile = (path: string) => {
    useGitViewStore.getState().setLoading(true);
    if (client.repoId) {
      void client.openMergeFile(client.repoId, path);
    }
  };

  return (
    <div className="flex flex-col h-full font-ui text-foreground text-ui">
      <div className="flex items-center justify-between px-pad-x h-toolbar min-h-toolbar border-b border-border bg-vscode-widget-bg">
        <h1 className="text-ui font-semibold m-0">
          Conflicts
        </h1>
        <Button variant="primary" size="content"
          type="button"
          onClick={handleRefresh}
          className="h-row px-2 text-ui-sm rounded-vscode bg-primary hover:bg-primary-hover text-primary-foreground border border-button-border font-semibold cursor-pointer outline-none"
        >
          Refresh
        </Button>
      </div>

      <div className="px-pad-x py-1 text-ui-sm text-vscode-description">
        {branchInfo && (
          <p className="m-0">
            Branch: <strong className="text-foreground">{branchInfo.currentBranch}</strong>
            {branchInfo.mergeHead && " (merge in progress)"}
          </p>
        )}
        {loading && <p className="m-0">Loading conflicts…</p>}
        {error && (
          <p className="m-0 text-editor-error-fg">
            {error}
          </p>
        )}
      </div>

      <ScrollArea axis="vertical" className="flex-1 bg-background">
        {conflictFiles.length === 0 && !loading && !error ? (
          <ToolEmptyState
            title="No unresolved Git conflicts."
            hint="When a merge or rebase stops on conflicts, files appear here."
            testId="conflict-list-empty"
          />
        ) : (
          <div className="divide-y divide-border">
            {conflictFiles.map((file) => (
              <div
                key={file.relativePath}
                className="flex items-center justify-between px-pad-x h-row min-h-row hover:bg-list-hover cursor-pointer"
                onClick={() => handleOpenFile(file.relativePath)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-ui text-foreground truncate">
                    {file.relativePath}
                  </span>
                  <span className="text-section px-1 py-0 rounded-vscode bg-badge-bg text-badge-fg shrink-0">
                    {file.stageCode}
                  </span>
                </div>
                <Button variant="ghost" size="content"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenFile(file.relativePath);
                  }}
                  className="h-row px-2 text-ui-sm rounded-vscode bg-primary hover:bg-primary-hover text-primary-foreground border border-button-border font-semibold cursor-pointer outline-none shrink-0"
                >
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between px-pad-x h-toolbar min-h-toolbar border-t border-border text-ui-sm text-vscode-description bg-background">
        <span>
          {conflictFiles.length} file{conflictFiles.length !== 1 ? "s" : ""} need
          resolution
        </span>
        <Button variant="secondary" size="content"
          type="button"
          onClick={backToList}
          className="h-row px-2 text-ui-sm rounded-vscode bg-secondary hover:bg-secondary-hover text-secondary-foreground border border-button-border cursor-pointer font-medium outline-none"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
