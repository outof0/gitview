import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import {
  operationCanContinue,
  operationCanSkip,
} from "@gitview/shared/types/operation";
import { GitWidget } from "../../components/git/GitWidget";
import { OperationRecoveryBar } from "../../components/git/OperationRecoveryBar";
import { ProtectedBranchBanner } from "../../components/git/ProtectedBranchBanner";

export function GitWorkspaceShell({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    clientRef,
    refreshing,
    syncing,
    repoSnapshot,
    loading,
    error,
    pullStrategy,
    workspaceTab,
    workspaceNotification,
    setPullStrategy,
    setWorkspaceTab,
    setTagsOpen,
    setWorktreesOpen,
    clearWorkspaceNotification,
    activeRepo,
    runMutation,
    refresh,
    openBranches,
    handlePush,
    handleUpdateAllRoots,
    loadTags,
    loadWorktrees,
  } = ctx;

  return (
    <>
      {activeRepo?.protectedBranch && (
        <ProtectedBranchBanner branchName={activeRepo.currentBranch} />
      )}

      {activeRepo && activeRepo.operation.type !== "none" && (
        <OperationRecoveryBar
          operation={activeRepo.operation}
          busy={syncing}
          onContinue={
            operationCanContinue(activeRepo.operation)
              ? () =>
                  activeRepo &&
                  void runMutation(() =>
                    clientRef.current.continueOperation(activeRepo.id),
                  )
              : undefined
          }
          onSkip={
            operationCanSkip(activeRepo.operation)
              ? () =>
                  activeRepo &&
                  void runMutation(() =>
                    clientRef.current.skipOperation(activeRepo.id),
                  )
              : undefined
          }
          onAbort={
            activeRepo.operation.canAbort
              ? () =>
                  activeRepo &&
                  void runMutation(() =>
                    clientRef.current.abortOperation(activeRepo.id),
                  )
              : undefined
          }
        />
      )}

      <GitWidget
        snapshot={repoSnapshot}
        activeRepo={activeRepo}
        onOpenBranches={openBranches}
        onOpenTags={() => {
          setTagsOpen(true);
          void loadTags();
        }}
        onOpenWorktrees={() => {
          setWorktreesOpen(true);
          void loadWorktrees();
        }}
        onRefresh={() => void refresh()}
        onFetch={() =>
          activeRepo &&
          void runMutation(() => clientRef.current.fetch(activeRepo.id))
        }
        pullStrategy={pullStrategy}
        onPullStrategyChange={setPullStrategy}
        onPull={(strategy) =>
          activeRepo &&
          void runMutation(() => clientRef.current.pull(activeRepo.id, strategy))
        }
        onPush={() => void handlePush()}
        onUpdateAllRoots={() => void handleUpdateAllRoots()}
        refreshing={refreshing}
        syncing={syncing}
      />

      {loading && (
        <div className="px-[var(--nx-pad-x)] py-1 text-[length:var(--nx-font-size-ui-sm)] text-vscode-description">
          Loading repository…
        </div>
      )}

      {error && (
        <div
          className="px-[var(--nx-pad-x)] py-1 text-[length:var(--nx-font-size-ui-sm)] text-[var(--vscode-errorForeground)]"
          data-testid="workspace-error"
        >
          {error}
        </div>
      )}

      {workspaceNotification && (
        <div
          className={`px-[var(--nx-pad-x)] py-1 text-[length:var(--nx-font-size-ui-sm)] flex items-center justify-between gap-2 ${
            workspaceNotification.level === "error"
              ? "text-[var(--vscode-errorForeground)]"
              : workspaceNotification.level === "warning"
                ? "text-[var(--vscode-editorWarning-foreground,#e0ad53)] bg-[var(--vscode-editorWarning-background,rgba(224,175,83,0.1))]"
                : "text-vscode-description"
          }`}
          data-testid="workspace-notification"
        >
          <span>{workspaceNotification.message}</span>
          <button
            type="button"
            className="text-[length:var(--nx-font-size-ui-sm)] underline hover:no-underline shrink-0"
            onClick={() => clearWorkspaceNotification()}
            data-testid="workspace-notification-dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        className="shrink-0 flex h-[var(--nx-toolbar-h)] min-h-[var(--nx-toolbar-h)] border-b border-border font-[family-name:var(--nx-font-ui)]"
        data-testid="workspace-tab-bar"
      >
        {(["changes", "log", "blame", "temporary", "review"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-2.5 h-full text-[length:var(--nx-font-size-ui)] border-b-2 ${
              workspaceTab === tab
                ? "border-[var(--vscode-focusBorder)] font-semibold text-foreground"
                : "border-transparent text-vscode-description hover:bg-list-hover"
            }`}
            onClick={() => setWorkspaceTab(tab)}
            data-testid={`workspace-tab-${tab}`}
          >
            {tab === "changes"
              ? "Changes"
              : tab === "log"
                ? "Log"
                : tab === "blame"
                  ? "Blame"
                  : tab === "temporary"
                    ? "Temporary Work"
                    : "Review"}
          </button>
        ))}
      </div>
    </>
  );
}
