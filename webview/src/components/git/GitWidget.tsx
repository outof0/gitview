import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CloudDownload,
  FolderTree,
  GitBranch,
  RefreshCw,
  ShieldAlert,
  Tag,
} from "lucide-react";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";
import { operationLabel } from "../../lib/operationLabel";

export type PullStrategy = "merge" | "rebase" | "ff_only";

type GitWidgetProps = {
  snapshot: RepositorySnapshot | null;
  activeRepo: Repository | null;
  onOpenBranches?: () => void;
  onOpenTags?: () => void;
  onOpenWorktrees?: () => void;
  onRefresh: () => void;
  onFetch: () => void;
  onPull: (strategy: PullStrategy) => void;
  onPush: () => void;
  onUpdateAllRoots?: () => void;
  pullStrategy?: PullStrategy;
  onPullStrategyChange?: (strategy: PullStrategy) => void;
  refreshing?: boolean;
  syncing?: boolean;
};

function branchDisplayName(repo: Repository | null): string {
  if (!repo) {
    return "No repository";
  }
  if (repo.isDetached) {
    return repo.headSha ? `Detached @ ${repo.headSha.slice(0, 7)}` : "Detached HEAD";
  }
  return repo.currentBranch ?? "No branch";
}

function syncLabel(repo: Repository | null): string | null {
  if (!repo?.upstream) {
    return null;
  }
  const parts: string[] = [];
  if (repo.ahead != null && repo.ahead > 0) {
    parts.push(`↑${repo.ahead}`);
  }
  if (repo.behind != null && repo.behind > 0) {
    parts.push(`↓${repo.behind}`);
  }
  return parts.length > 0 ? parts.join(" ") : "Up to date";
}

function IconButton({
  label,
  onClick,
  disabled,
  testId,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="h-7 w-7 flex items-center justify-center rounded-vscode border border-border hover:bg-list-hover disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export function GitWidget({
  snapshot,
  activeRepo,
  onOpenBranches,
  onOpenTags,
  onOpenWorktrees,
  onRefresh,
  onFetch,
  onPull,
  onPush,
  onUpdateAllRoots,
  pullStrategy = "merge",
  onPullStrategyChange,
  refreshing = false,
  syncing = false,
}: GitWidgetProps) {
  const operation = activeRepo ? operationLabel(activeRepo.operation) : null;
  const sync = syncLabel(activeRepo);
  const disabled = !activeRepo || syncing;
  const multiRoot = (snapshot?.repositories.length ?? 0) > 1;

  return (
    <header
      className="shrink-0 border-b border-border bg-[var(--vscode-sideBar-background,var(--background))]"
      data-testid="gitview-git-widget"
    >
      {snapshot?.multiRootDiverged && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[11px] bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningForeground)]"
          data-testid="multi-root-warning"
        >
          <AlertTriangle size={14} aria-hidden />
          <span>Workspace roots are on different branches</span>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 min-h-[40px]">
        <GitBranch
          size={16}
          className="shrink-0 text-[var(--vscode-symbolIcon-classForeground,var(--foreground))]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="text-left w-full text-[13px] font-semibold truncate hover:underline disabled:no-underline"
            onClick={onOpenBranches}
            disabled={!activeRepo || !onOpenBranches}
            data-testid="branch-name"
          >
            {branchDisplayName(activeRepo)}
          </button>
          {activeRepo && (
            <div className="text-[11px] text-[var(--vscode-descriptionForeground)] truncate">
              {activeRepo.name}
              {sync && (
                <span className="ml-2" data-testid="sync-counts">
                  {sync}
                </span>
              )}
            </div>
          )}
        </div>

        {activeRepo?.protectedBranch && (
          <span
            className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-vscode bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningForeground)] flex items-center gap-1"
            data-testid="protected-branch-badge"
            title="Protected branch"
          >
            <ShieldAlert size={12} aria-hidden />
            Protected
          </span>
        )}

        {operation && (
          <span
            className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-vscode bg-[var(--vscode-inputValidation-infoBackground)] text-[var(--vscode-inputValidation-infoForeground)]"
            data-testid="operation-badge"
          >
            {operation}
          </span>
        )}

        <div className="flex items-center gap-1">
          {onOpenTags && (
            <IconButton
              label="Tags"
              onClick={onOpenTags}
              disabled={!activeRepo}
              testId="tags-button"
            >
              <Tag size={14} aria-hidden />
            </IconButton>
          )}
          {onOpenWorktrees && (
            <IconButton
              label="Worktrees"
              onClick={onOpenWorktrees}
              disabled={!activeRepo}
              testId="worktrees-button"
            >
              <FolderTree size={14} aria-hidden />
            </IconButton>
          )}
          <IconButton
            label="Fetch"
            onClick={onFetch}
            disabled={disabled}
            testId="fetch-button"
          >
            <CloudDownload size={14} aria-hidden />
          </IconButton>
          {onPullStrategyChange && (
            <select
              className="h-7 px-1 text-[10px] rounded-vscode border border-border bg-[var(--vscode-input-background)]"
              value={pullStrategy}
              onChange={(e) =>
                onPullStrategyChange(e.target.value as PullStrategy)
              }
              disabled={disabled}
              aria-label="Pull strategy"
              data-testid="pull-strategy-select"
            >
              <option value="merge">Merge</option>
              <option value="rebase">Rebase</option>
              <option value="ff_only">FF only</option>
            </select>
          )}
          <IconButton
            label={`Pull (${pullStrategy})`}
            onClick={() => onPull(pullStrategy)}
            disabled={disabled}
            testId="pull-button"
          >
            <ArrowDown size={14} aria-hidden />
          </IconButton>
          <IconButton
            label="Push"
            onClick={onPush}
            disabled={disabled}
            testId="push-button"
          >
            <ArrowUp size={14} aria-hidden />
          </IconButton>
          {multiRoot && onUpdateAllRoots && (
            <button
              type="button"
              className="h-7 px-2 text-[10px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-50"
              onClick={onUpdateAllRoots}
              disabled={disabled}
              aria-label="Update all roots"
              data-testid="update-all-roots-button"
            >
              Update all
            </button>
          )}
          <button
            type="button"
            className="h-7 px-2 flex items-center gap-1 text-[11px] rounded-vscode border border-border hover:bg-list-hover disabled:opacity-50"
            onClick={onRefresh}
            disabled={refreshing || syncing}
            aria-label="Refresh Git status"
            data-testid="refresh-button"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
    </header>
  );
}