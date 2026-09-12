import { SelectField } from "../ui/SelectField";
import { Button } from "../ui/Button";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  FolderGit2,
  FolderTree,
  GitBranch,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";
import {
  isSyncOperationActive,
  type SyncOperationEvent,
  type SyncOperationKind,
  type SyncPhase,
  type SyncRootStatus,
} from "@gitview/shared/types/sync";
import { operationLabel } from "../../lib/operationLabel";

type PullStrategy = "merge" | "rebase" | "ff_only";

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
  syncOperation?: SyncOperationEvent | null;
  syncOutcomeUnknown?: boolean;
  onCancelSync?: () => void;
  onRetrySync?: () => void;
  onShowSyncChanges?: () => void;
  onDismissSync?: () => void;
  canFetch?: boolean;
  canPull?: boolean;
  canPush?: boolean;
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
  if (repo.behind != null && repo.behind > 0) {
    parts.push(`↓${repo.behind}`);
  }
  if (repo.ahead != null && repo.ahead > 0) {
    parts.push(`↑${repo.ahead}`);
  }
  return parts.length > 0 ? parts.join("  ") : "Up to date";
}

const SYNC_OPERATION_LABELS: Record<SyncOperationKind, string> = {
  fetch: "Fetch",
  pull: "Pull",
  push: "Push",
  update_all_roots: "Update all roots",
};

const SYNC_PHASE_LABELS: Record<SyncPhase, string> = {
  preparing: "Preparing",
  fetching: "Fetching remote updates",
  pulling: "Integrating remote changes",
  pushing: "Publishing commits",
  refreshing: "Refreshing repository state",
  reconciling: "Reconciling final state",
};

function syncOperationMessage(
  event: SyncOperationEvent,
  outcomeUnknown: boolean,
): string {
  if (outcomeUnknown && isSyncOperationActive(event)) {
    return "Waiting for the extension host to confirm the final outcome.";
  }
  switch (event.state) {
    case "accepted":
    case "running":
      return SYNC_PHASE_LABELS[event.phase];
    case "cancel_requested":
      return "Waiting for Git to stop safely";
    case "cancel_rejected":
      return event.message;
    case "failed":
      return event.outcome.message;
    case "cancel_confirmed":
      return event.outcome.message;
    case "completed":
      return "Completed";
  }
}

function syncRootStatusLabel(root: SyncRootStatus): string {
  switch (root.state) {
    case "pending":
      return "Pending";
    case "running":
      return SYNC_PHASE_LABELS[root.phase];
    case "succeeded":
      return "Updated";
    case "failed":
      return `Failed: ${root.outcome.message}`;
    case "cancelled":
      return root.outcome.message;
    case "skipped":
      return `Skipped: ${root.outcome.message}`;
  }
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
    <Button variant="ghost" size="content"
      type="button"
      className="h-7 w-7 shrink-0 flex items-center justify-center rounded-vscode border border-border hover:bg-list-hover disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      {children}
    </Button>
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
  syncOperation = null,
  syncOutcomeUnknown = false,
  onCancelSync,
  onRetrySync,
  onShowSyncChanges,
  onDismissSync,
  canFetch = true,
  canPull = true,
  canPush = true,
}: GitWidgetProps) {
  const operation = activeRepo ? operationLabel(activeRepo.operation) : null;
  const sync = syncLabel(activeRepo);
  const disabled = !activeRepo || syncing;
  const multiRoot = (snapshot?.repositories.length ?? 0) > 1;
  const activeSyncOperation =
    syncOperation !== null && isSyncOperationActive(syncOperation);
  const failedSyncOperation = syncOperation?.state === "failed";
  const canCancelSync =
    syncOperation?.state === "accepted" ||
    syncOperation?.state === "running" ||
    syncOperation?.state === "cancel_rejected"
      ? syncOperation.cancellable
      : false;
  const progress =
    syncOperation && "progress" in syncOperation
      ? syncOperation.progress
      : undefined;

  return (
    <header
      className="shrink-0 w-full bg-panel-bg"
      data-testid="gitview-git-widget"
    >
      {snapshot?.multiRootDiverged && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-ui-sm bg-warning-bg text-warning-fg"
          data-testid="multi-root-warning"
        >
          <AlertTriangle size={14} aria-hidden />
          <span>Workspace roots are on different branches</span>
        </div>
      )}

      {syncOperation && (activeSyncOperation || failedSyncOperation) ? (
        <div
          className={`flex min-h-8 items-center gap-2 border-b border-border px-3 py-1.5 text-ui-sm max-toolbar-narrow:items-stretch max-toolbar-narrow:flex-col ${
            failedSyncOperation
              ? "bg-danger-bg text-danger-fg"
              : "bg-info-bg text-info-fg"
          }`}
          data-testid="sync-operation-status"
          aria-live="polite"
        >
          {activeSyncOperation ? (
            <LoaderCircle
              size={14}
              className="shrink-0 animate-spin max-toolbar-narrow:hidden"
              aria-hidden
            />
          ) : (
            <AlertTriangle
              size={14}
              className="shrink-0 max-toolbar-narrow:hidden"
              aria-hidden
            />
          )}
          <div className="min-w-0 flex-1">
            <span className="font-semibold">
              {SYNC_OPERATION_LABELS[syncOperation.operation]}
            </span>
            <span className="ml-1.5">
              {syncOperationMessage(syncOperation, syncOutcomeUnknown)}
            </span>
            {progress && progress.total > 1 ? (
              <>
                <span className="ml-1.5" data-testid="sync-operation-progress">
                  {progress.completed}/{progress.total} roots
                </span>
                <details
                  className="mt-1 text-vscode-description"
                  data-testid="sync-root-progress"
                >
                  <summary className="w-fit cursor-pointer select-none">
                    Root details
                  </summary>
                  <ul className="mt-1 grid gap-0.5">
                    {progress.roots.map((root) => (
                      <li
                        key={root.repoId}
                        className="flex min-w-0 gap-1.5"
                        data-testid={`sync-root-status-${root.repoId}`}
                      >
                        <span className="shrink-0 font-medium text-foreground">
                          {root.name}
                        </span>
                        <span className="min-w-0 truncate" title={syncRootStatusLabel(root)}>
                          {syncRootStatusLabel(root)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 max-toolbar-narrow:justify-end">
            {activeSyncOperation ? (
              syncOperation.state === "cancel_requested" ? (
                <Button variant="secondary" size="content"
                  type="button"
                  className="btn-vscode-secondary h-row px-2 text-ui-sm"
                  disabled
                  data-testid="sync-operation-cancel"
                >
                  Cancelling…
                </Button>
              ) : canCancelSync && onCancelSync ? (
                <Button variant="secondary" size="content"
                  type="button"
                  className="btn-vscode-secondary h-row px-2 text-ui-sm"
                  onClick={onCancelSync}
                  data-testid="sync-operation-cancel"
                >
                  Cancel
                </Button>
              ) : (
                <span className="text-vscode-description">Finishing…</span>
              )
            ) : (
              <>
                {onDismissSync ? (
                  <Button variant="secondary" size="content"
                    type="button"
                    className="btn-vscode-secondary h-row px-2 text-ui-sm"
                    onClick={onDismissSync}
                    data-testid="sync-operation-dismiss"
                  >
                    Dismiss
                  </Button>
                ) : null}
                {onShowSyncChanges ? (
                  <Button variant="primary" size="content"
                    type="button"
                    className="btn-vscode h-row px-2 text-ui-sm"
                    onClick={onShowSyncChanges}
                    data-testid="sync-operation-show-changes"
                  >
                    Show Changes
                  </Button>
                ) : null}
                {onRetrySync ? (
                  <Button variant="primary" size="content"
                    type="button"
                    className="btn-vscode h-row px-2 text-ui-sm"
                    onClick={onRetrySync}
                    data-testid="sync-operation-retry"
                  >
                    Retry
                  </Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 px-pad-panel h-git-widget-header min-h-git-widget-header w-full bg-panel-bg border-b border-nx-border overflow-hidden">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderGit2
            size={16}
            className="shrink-0 text-nx-orange"
            aria-hidden
          />
          {activeRepo ? (
            <span
              className="shrink-0 max-w-[28%] truncate text-title font-semibold text-fg font-ui"
              data-testid="repo-name"
              title={activeRepo.name}
            >
              {activeRepo.name}
            </span>
          ) : null}
          <Button variant="ghost" size="content"
            type="button"
            className="h-6 shrink-0 max-w-[36%] px-widget-control-x flex items-center gap-widget-gap rounded-vscode border border-nx-border bg-vscode-widget-bg text-ui-sm text-fg hover:bg-vscode-widget-bg disabled:opacity-40 font-ui"
            onClick={onOpenBranches}
            disabled={!activeRepo || !onOpenBranches}
            data-testid="branch-name"
            title={branchDisplayName(activeRepo)}
          >
            <GitBranch size={12} className="shrink-0 text-vscode-description" aria-hidden />
            <span className="truncate">{branchDisplayName(activeRepo)}</span>
          </Button>
          {sync && (
            <span
              className="shrink-0 text-ui-sm text-nx-blue font-ui"
              data-testid="sync-counts"
            >
              {sync}
            </span>
          )}

          {activeRepo?.protectedBranch && (
            <span
              className="shrink-0 h-5 px-badge-x inline-flex items-center gap-1 rounded-vscode border border-nx-border bg-vscode-widget-bg text-micro text-vscode-description max-panel-narrow:hidden font-ui"
              data-testid="protected-branch-badge"
              title="Protected branch"
            >
              <ShieldCheck
                size={11}
                className="text-nx-green"
                aria-hidden
              />
              protected
            </span>
          )}

          {operation && (
            <span
              className="shrink-0 text-section uppercase tracking-wide px-2 py-0.5 rounded-vscode bg-info-bg text-info-fg max-panel-narrow:hidden"
              data-testid="operation-badge"
            >
              {operation}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
          <Button variant="ghost" size="content"
            type="button"
            className="h-control shrink-0 px-2 flex items-center gap-widget-gap text-ui-sm rounded-vscode border border-nx-border text-vscode-description hover:bg-vscode-widget-bg disabled:opacity-40 font-ui"
            onClick={onFetch}
            disabled={disabled || !canFetch}
            aria-label="Fetch"
            data-testid="fetch-button"
          >
            <RefreshCw size={12} aria-hidden />
            <span className="max-form-narrow:hidden">Fetch</span>
          </Button>
          {onPullStrategyChange && (
            <SelectField
              className="h-control shrink-0 px-1 text-section rounded-vscode border border-nx-border bg-input text-vscode-description max-form-narrow:hidden font-ui"
              value={pullStrategy}
              onChange={(e) =>
                onPullStrategyChange(e.target.value as PullStrategy)
              }
              disabled={disabled || !canPull}
              aria-label="Pull strategy"
              data-testid="pull-strategy-select"
            >
              <option value="merge">Merge</option>
              <option value="rebase">Rebase</option>
              <option value="ff_only">FF only</option>
            </SelectField>
          )}
          <Button variant="ghost" size="content"
            type="button"
            className="h-control shrink-0 px-2 flex items-center gap-widget-gap text-ui-sm rounded-vscode border border-nx-border text-vscode-description hover:bg-vscode-widget-bg disabled:opacity-40 font-ui"
            onClick={() => onPull(pullStrategy)}
            disabled={disabled || !canPull}
            aria-label={`Pull (${pullStrategy})`}
            data-testid="pull-button"
          >
            <ArrowDownToLine size={12} aria-hidden />
            <span className="max-form-narrow:hidden">Pull</span>
          </Button>
          <Button variant="primary" size="content"
            type="button"
            className="h-control shrink-0 px-2 flex items-center gap-widget-gap text-ui-sm font-semibold rounded-vscode bg-primary text-primary-foreground border border-button-border hover:bg-primary-hover disabled:opacity-40 font-ui"
            onClick={onPush}
            disabled={disabled || !canPush}
            aria-label="Push"
            data-testid="push-button"
          >
            <ArrowUpFromLine size={12} aria-hidden />
            <span className="max-form-narrow:hidden">Push</span>
          </Button>
          {multiRoot && onUpdateAllRoots && (
            <Button variant="ghost" size="content"
              type="button"
              className="h-control shrink-0 px-2 text-section rounded-vscode border border-nx-border hover:bg-list-hover disabled:opacity-40 max-panel-narrow:hidden font-ui"
              onClick={onUpdateAllRoots}
              disabled={disabled}
              aria-label="Update all roots"
              data-testid="update-all-roots-button"
            >
              Update all
            </Button>
          )}
          <IconButton
            label="Refresh Git status"
            onClick={onRefresh}
            disabled={refreshing || syncing}
            testId="refresh-button"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden />
          </IconButton>
        </div>
      </div>
    </header>
  );
}
