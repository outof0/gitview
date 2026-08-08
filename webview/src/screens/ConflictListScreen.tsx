import { useGitViewStore } from "../stores/gitViewStore";
import { useMergeClientContext } from "../hooks/merge/mergeClientContext";
import { ToolEmptyState } from "../components/ui/ToolEmptyState";

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
    <div className="flex flex-col h-full font-[family-name:var(--nx-font-ui)] text-foreground text-[length:var(--nx-font-size-ui)]">
      <div className="flex items-center justify-between px-[var(--nx-pad-x)] h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] border-b border-border bg-[var(--vscode-editorWidget-background,var(--background))]">
        <h1 className="text-[length:var(--nx-font-size-ui)] font-semibold m-0">
          Conflicts
        </h1>
        <button
          type="button"
          onClick={handleRefresh}
          className="h-[var(--nx-row-h)] px-2 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode bg-primary hover:bg-primary-hover text-primary-foreground border border-[var(--vscode-button-border,transparent)] font-semibold cursor-pointer outline-none"
        >
          Refresh
        </button>
      </div>

      <div className="px-[var(--nx-pad-x)] py-1 text-[length:var(--nx-font-size-ui-sm)] text-vscode-description">
        {branchInfo && (
          <p className="m-0">
            Branch: <strong className="text-foreground">{branchInfo.currentBranch}</strong>
            {branchInfo.mergeHead && " (merge in progress)"}
          </p>
        )}
        {loading && <p className="m-0">Loading conflicts…</p>}
        {error && (
          <p className="m-0 text-[var(--vscode-editorError-foreground,#cf5c56)]">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-background">
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
                className="flex items-center justify-between px-[var(--nx-pad-x)] h-[var(--nx-row-h)] min-h-[var(--nx-row-h)] hover:bg-list-hover cursor-pointer"
                onClick={() => handleOpenFile(file.relativePath)}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[length:var(--nx-font-size-ui)] text-foreground truncate">
                    {file.relativePath}
                  </span>
                  <span className="text-[length:var(--nx-font-size-section)] px-1 py-0 rounded bg-[var(--vscode-badge-background,rgba(127,127,127,0.2))] text-[var(--vscode-badge-foreground,var(--foreground))] shrink-0">
                    {file.stageCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenFile(file.relativePath);
                  }}
                  className="h-[var(--nx-row-h)] px-2 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode bg-primary hover:bg-primary-hover text-primary-foreground border border-[var(--vscode-button-border,transparent)] font-semibold cursor-pointer outline-none shrink-0"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-[var(--nx-pad-x)] h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] border-t border-border text-[length:var(--nx-font-size-ui-sm)] text-vscode-description bg-background">
        <span>
          {conflictFiles.length} file{conflictFiles.length !== 1 ? "s" : ""} need
          resolution
        </span>
        <button
          type="button"
          onClick={backToList}
          className="h-[var(--nx-row-h)] px-2 text-[length:var(--nx-font-size-ui-sm)] rounded-vscode bg-secondary hover:bg-secondary-hover text-secondary-foreground border border-[var(--vscode-button-border,var(--border))] cursor-pointer font-medium outline-none"
        >
          Close
        </button>
      </div>
    </div>
  );
}
