import { useMemo } from "react";
import { useGitWorkspaceController } from "../hooks/gitWorkspace/useGitWorkspaceController";
import { MergeClientValueProvider } from "../hooks/merge/mergeClientContext";
import { ToastContainer } from "../components/ui/ToastContainer";
import { GitWorkspaceShell } from "./gitWorkspace/GitWorkspaceShell";
import { GitWorkspaceChangesTab } from "./gitWorkspace/GitWorkspaceChangesTab";
import { GitWorkspaceTemporaryTab } from "./gitWorkspace/GitWorkspaceTemporaryTab";
import { GitWorkspaceReviewTab } from "./gitWorkspace/GitWorkspaceReviewTab";
import { GitWorkspaceLogTab } from "./gitWorkspace/GitWorkspaceLogTab";
import { GitWorkspaceCommitPanel } from "./gitWorkspace/GitWorkspaceCommitPanel";
import { GitWorkspaceDialogs } from "./gitWorkspace/GitWorkspaceDialogs";

export function GitWorkspaceApp() {
  const ctx = useGitWorkspaceController();
  const repoId = ctx.activeRepo?.id ?? "";
  // The embedded conflict resolver reads its client from context; reuse this
  // panel's client so both share one request channel.
  const mergeClient = useMemo(
    () => ({ ...ctx.clientRef.current, repoId, clientRef: ctx.clientRef }),
    [ctx.clientRef, repoId],
  );

  return (
    <MergeClientValueProvider value={mergeClient}>
    <div
      className="h-screen flex flex-col bg-[var(--vscode-sideBar-background,var(--background))] text-foreground font-sans"
      data-testid="git-workspace-app"
    >
      <GitWorkspaceShell ctx={ctx} />
      <GitWorkspaceChangesTab ctx={ctx} />
      <GitWorkspaceTemporaryTab ctx={ctx} />
      <GitWorkspaceReviewTab ctx={ctx} />
      <GitWorkspaceLogTab ctx={ctx} />
      <GitWorkspaceCommitPanel ctx={ctx} />
      {ctx.nativeFocusSurface ? (
        // Opaque, not a scrim: a dialog raised from the native Git submenu should
        // read as a modal over the editor, not as a Git tool window that replaced it.
        <div
          className="fixed inset-0 z-50 bg-[var(--vscode-editor-background,var(--background))]"
          data-testid="git-native-dialog-backdrop"
          aria-hidden
        />
      ) : null}
      <GitWorkspaceDialogs ctx={ctx} />
      <ToastContainer />
    </div>
    </MergeClientValueProvider>
  );
}
