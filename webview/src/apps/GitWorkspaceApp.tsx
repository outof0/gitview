import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useVsCodeApi } from "../hooks/useVsCodeApi";

export type GitWorkspaceSurface =
  | "workspace"
  | "commit"
  | "branches"
  | "sidebar"
  | "content";

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
   * - `sidebar` is the activity-bar Commit tool window (changes + commit form).
   * - `content` is the editor-area Git workspace used for large dialogs such as
   *   Rollback Changes and Unstash Changes.
   */
  surface?: GitWorkspaceSurface;
};

function readWorkspaceSurface(): GitWorkspaceSurface {
  const boot = window.__GITVIEW_BOOTSTRAP__;
  if (!boot || typeof boot !== "object" || !("surface" in boot)) {
    return "workspace";
  }
  const value = (boot as { surface?: unknown }).surface;
  if (
    value === "sidebar" ||
    value === "commit" ||
    value === "branches" ||
    value === "content"
  ) {
    return value;
  }
  return "workspace";
}

export function GitSidebarApp() {
  return <GitWorkspaceApp surface="sidebar" />;
}

export function GitWorkspaceApp({
  surface: surfaceProp,
}: GitWorkspaceAppProps = {}) {
  const surface = surfaceProp ?? readWorkspaceSurface();
  const contentOnly = surface === "content";
  const ctx = useGitWorkspaceController();
  const { postMessage } = useVsCodeApi();
  const theme = useTheme();
  const [sidebarHiding, setSidebarHiding] = useState(false);
  const sidebarHideTimer = useRef<number | null>(null);
  useEffect(() => {
    ensureWebviewThemeStyle();
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarHideTimer.current !== null) {
        window.clearTimeout(sidebarHideTimer.current);
      }
    };
  }, []);

  const hideSidebar = useCallback(() => {
    if (surface !== "sidebar" || sidebarHideTimer.current !== null) {
      return;
    }
    setSidebarHiding(true);
    sidebarHideTimer.current = window.setTimeout(() => {
      sidebarHideTimer.current = null;
      void ctx.clientRef.current.toggleSidebar();
      setSidebarHiding(false);
    }, 160);
  }, [ctx.clientRef, surface]);

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
    if (surface === "sidebar") {
      return;
    }
    if (surface === "content") {
      return;
    }
    store.setBranchesOpen(true);
    void loadBranchesRef.current?.();
  }, [surface]);

  const contentDialogOpen =
    surface === "content" && Object.keys(ctx.dialogs).length > 0;
  const contentDialogWasOpened = useRef(false);
  useEffect(() => {
    if (surface !== "content") {
      return;
    }
    if (contentDialogOpen) {
      contentDialogWasOpened.current = true;
      return;
    }
    // A destructive dialog can close before its mutation settles. Keep the
    // content panel alive while that request is busy so a follow-up
    // confirmation can replace it, then release the transient editor tab.
    if (contentDialogWasOpened.current && !ctx.syncing) {
      postMessage({ type: "git.content.close" });
      contentDialogWasOpened.current = false;
    }
  }, [contentDialogOpen, ctx.syncing, postMessage, surface]);

  const repoId = ctx.activeRepo?.id ?? "";
  // The embedded conflict resolver reads its client from context; reuse this
  // panel's client so both share one request channel.
  const mergeClient = useMemo(
    () => ({ ...ctx.clientRef.current, repoId, clientRef: ctx.clientRef }),
    [ctx.clientRef, repoId],
  );
  const sidebarAnimationClass =
    surface === "sidebar"
      ? `transition-[opacity,transform] duration-150 ease-out ${
          sidebarHiding
            ? "opacity-0 -translate-x-2"
            : "opacity-100 translate-x-0"
        }`
      : "";

  return (
    <MergeClientValueProvider value={mergeClient}>
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col w-full overflow-hidden bg-[var(--nx-chrome-bg,var(--nx-chrome-bg))] text-[var(--nx-chrome-fg,var(--foreground))] font-sans ${webviewThemeClass(theme)} ${sidebarAnimationClass}`}
      data-testid="git-workspace-app"
      data-surface={surface}
    >
      {!contentOnly ? (
        <GitWorkspaceShell
          ctx={ctx}
          surface={surface}
          onHideSidebar={surface === "sidebar" ? hideSidebar : undefined}
        />
      ) : null}
      {contentOnly ? (
        // The content surface intentionally has no workspace chrome behind the
        // modal. Keep the changes tab mounted invisibly because it owns the
        // pending `git.requestRollback` bridge and the shared workspace
        // controller used by stash dialogs.
        <div className="hidden" aria-hidden="true">
          <GitWorkspaceChangesTab ctx={ctx} />
        </div>
      ) : ctx.activeRepo?.trusted ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col w-full overflow-hidden">
          <GitWorkspaceChangesTab
            ctx={ctx}
            layout={surface === "sidebar" ? "sidebar" : "workspace"}
          />
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
