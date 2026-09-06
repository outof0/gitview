import { useEffect, useMemo, useRef } from "react";
import { useGitWorkspaceController } from "../hooks/gitWorkspace/useGitWorkspaceController";
import { useGitWorkspaceStore } from "../stores/gitWorkspaceStore";
import { MergeClientValueProvider } from "../hooks/merge/mergeClientContext";
import { ToastContainer } from "../components/ui/ToastContainer";
import { useTheme } from "../hooks/useTheme";
import { ensureWebviewThemeStyle, webviewThemeClass } from "../lib/webviewTheme";
import { GitWorkspaceShell } from "./gitWorkspace/GitWorkspaceShell";
import { GitWorkspaceChangesTab } from "./gitWorkspace/GitWorkspaceChangesTab";
import { GitWorkspaceTemporaryTab } from "./gitWorkspace/GitWorkspaceTemporaryTab";
import { GitWorkspaceReviewTab } from "./gitWorkspace/GitWorkspaceReviewTab";
import { GitWorkspaceLogTab } from "./gitWorkspace/GitWorkspaceLogTab";
import { GitWorkspaceDialogs } from "./gitWorkspace/GitWorkspaceDialogs";

export type GitWorkspaceAppProps = {
  /**
   * A single-purpose surface: the Git tool window mounted in a panel that has
   * the full window height, with one thing already open.
   *
   * This exists because the bottom Git panel is ~258px tall, and at that height
   * a dialog or popup that fills `80vh` measures the panel rather than the VS
   * Code window. Same component either way; only the host surface differs.
   *
   * - `commit` raises the Commit dialog, whose file/diff split collapses to
   *   nothing at bottom-panel height.
   * - `branches` raises the Branches popup, which the native Git submenu opens
   *   in the editor area so it is not cramped into the panel.
   */
  surface?: "workspace" | "commit" | "branches";
};

export function GitWorkspaceApp({ surface = "workspace" }: GitWorkspaceAppProps = {}) {
  const ctx = useGitWorkspaceController();
  const theme = useTheme();
  useEffect(() => {
    ensureWebviewThemeStyle();
  }, []);

  // `ctx` is a fresh object every render, so it cannot be a dependency here.
  const loadBranchesRef = useRef<(() => Promise<void>) | null>(null);
  loadBranchesRef.current = ctx.loadBranches;

  const surfaceApplied = useRef(false);
  useEffect(() => {
    if (surface === "workspace" || surfaceApplied.current) {
      return;
    }
    surfaceApplied.current = true;
    const store = useGitWorkspaceStore.getState();
    store.setWorkspaceTab("changes");
    if (surface === "commit") {
      store.openDialog("commit", {});
      return;
    }
    store.setBranchesOpen(true);
    void loadBranchesRef.current?.();
  }, [surface]);

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
      className={`flex min-h-0 min-w-0 flex-1 flex-col w-full overflow-hidden bg-[var(--nx-chrome-bg,var(--nx-chrome-bg))] text-[var(--nx-chrome-fg,var(--foreground))] font-sans ${webviewThemeClass(theme)}`}
      data-testid="git-workspace-app"
    >
      <GitWorkspaceShell ctx={ctx} />
      {ctx.activeRepo?.trusted ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col w-full overflow-hidden">
          <GitWorkspaceChangesTab ctx={ctx} />
          <GitWorkspaceTemporaryTab ctx={ctx} />
          <GitWorkspaceReviewTab ctx={ctx} />
          <GitWorkspaceLogTab ctx={ctx} />
        </div>
      ) : null}
      {ctx.nativeFocusSurface ? (
        // Opaque, not a scrim: a dialog raised from the native Git submenu should
        // read as a modal over the editor, not as a Git tool window that replaced it.
        <div
          className="fixed inset-0 z-50 bg-vscode-editor-bg"
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
