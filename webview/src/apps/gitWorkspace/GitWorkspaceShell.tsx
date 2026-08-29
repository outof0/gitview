import type { GitWorkspaceController } from "./gitWorkspaceControllerTypes";
import { GitBottomPanelHeader } from "./GitBottomPanelHeader";

type ShellStateBannerProps = {
  testId: string;
  title: string;
  description: string;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  blocking?: boolean;
  warning?: boolean;
};

function ShellStateBanner({
  testId,
  title,
  description,
  primary,
  secondary,
  blocking = false,
  warning = false,
}: ShellStateBannerProps) {
  return (
    <section
      className={`font-[family-name:var(--nx-font-ui)] ${
        blocking
          ? "flex-1 min-h-0 flex items-center justify-center p-4"
          : warning
            ? "shrink-0 border-b border-border bg-[var(--vscode-inputValidation-warningBackground)] px-[var(--nx-pad-x)] py-1.5"
            : "shrink-0 border-b border-border bg-[var(--vscode-inputValidation-infoBackground)] px-[var(--nx-pad-x)] py-1.5"
      }`}
      data-testid={testId}
      aria-live={blocking ? "polite" : undefined}
    >
      <div
        className={
          blocking
            ? "w-[min(440px,100%)] border border-border p-3"
            : "flex items-center gap-3 max-[360px]:items-stretch max-[360px]:flex-col"
        }
      >
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-[length:var(--nx-font-size-ui)] font-semibold text-foreground">
            {title}
          </h2>
          <p className="m-0 mt-0.5 text-[length:var(--nx-font-size-ui-sm)] text-vscode-description">
            {description}
          </p>
        </div>
        {primary || secondary ? (
          <div
            className={`flex shrink-0 gap-1.5 max-[360px]:w-full max-[360px]:flex-col ${
              blocking ? "mt-3 justify-end" : ""
            }`}
          >
            {secondary ? (
              <button
                type="button"
                className="btn-vscode-secondary h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui-sm)] max-[360px]:w-full"
                onClick={secondary.onClick}
              >
                {secondary.label}
              </button>
            ) : null}
            {primary ? (
              <button
                type="button"
                className="btn-vscode h-[var(--nx-row-h)] px-2.5 text-[length:var(--nx-font-size-ui-sm)] max-[360px]:w-full"
                onClick={primary.onClick}
              >
                {primary.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function GitWorkspaceShell({ ctx }: { ctx: GitWorkspaceController }) {
  const {
    clientRef,
    repoSnapshot,
    loading,
    error,
    workspaceTab,
    workspaceNotification,
    setWorkspaceTab,
    clearWorkspaceNotification,
    activeRepo,
    runMutation,
    refresh,
  } = ctx;

  if (loading && !repoSnapshot) {
    return (
      <ShellStateBanner
        testId="repository-state-loading"
        title="Loading repository"
        description="Reading workspace roots and Git status…"
        blocking
      />
    );
  }

  if (!activeRepo) {
    return (
      <ShellStateBanner
        testId={error ? "repository-state-error" : "repository-state-none"}
        title={error ? "Repository unavailable" : "No repository found"}
        description={
          error ??
          "Open a folder containing a Git repository or clone one to start working."
        }
        secondary={{
          label: "Open Folder",
          onClick: () => void runMutation(() => clientRef.current.openFolder()),
        }}
        primary={
          error
            ? { label: "Retry", onClick: () => void refresh() }
            : {
                label: "Clone Repository",
                onClick: () =>
                  void runMutation(() => clientRef.current.cloneRepository()),
              }
        }
        blocking
      />
    );
  }

  if (!activeRepo.trusted) {
    return (
      <ShellStateBanner
        testId="repository-state-untrusted"
        title="Restricted Mode"
        description="Trust this workspace before GitView runs Git mutations."
        secondary={{ label: "Refresh", onClick: () => void refresh() }}
        primary={{
          label: "Manage Trust",
          onClick: () =>
            void runMutation(() => clientRef.current.manageWorkspaceTrust()),
        }}
        blocking
        warning
      />
    );
  }

  return (
    <>
      <GitBottomPanelHeader ctx={ctx} />

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

      <div className="hidden h-[var(--nx-toolbar-h)] shrink-0 items-center border-b border-border px-2 max-[360px]:flex">
        <label className="sr-only" htmlFor="workspace-section-select">
          Workspace section
        </label>
        <select
          id="workspace-section-select"
          className="h-[var(--nx-row-h)] w-full rounded-vscode border border-border bg-[var(--vscode-input-background)] px-1.5 text-[length:var(--nx-font-size-ui)] text-foreground"
          value={workspaceTab}
          onChange={(event) =>
            setWorkspaceTab(event.target.value as typeof workspaceTab)
          }
          data-testid="workspace-section-select"
        >
          <option value="changes">Changes</option>
          <option value="log">Log</option>
          <option value="blame">Blame</option>
          <option value="temporary">Temporary Work</option>
          <option value="review">Review</option>
        </select>
      </div>
    </>
  );
}
