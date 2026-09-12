import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { readConfirmDestructiveActions } from "../config/readConfirmDestructiveActions";
import {
  PROTOCOL_VERSION,
  createHostEvent,
  type GitPanelSurface,
  type HostToWebview,
} from "../shared/protocol";
import { readGitViewSettings } from "../config/readGitViewSettings";
import { createMessageRouter } from "../webviewHost/messageRouter";
import { createFileService } from "../services/fileService";
import { createReviewAuthService } from "../services/review/reviewAuth";
import { createSafeWebviewPoster } from "./safeWebviewPoster";
import { openGitViewPanel } from "./gitViewPresentation";
import { runGitMenuAction } from "../commands/gitMenuActionDispatcher";
import { resolveLegacyWorkspaceRoot } from "./resolveLegacyWorkspaceRoot";
import { getWebviewHtml } from "./getWebviewHtml";

type GitWorkspaceSurfaceRole = "bottom" | "content";

type SurfaceState = {
  postMessage: (message: HostToWebview) => void;
  ready: boolean;
  pendingDialog: {
    dialog: GitPanelSurface;
    relativePath?: string;
    index?: number | null;
    repoId?: string;
  } | null;
  pendingHistory: {
    repoId: string;
    path: string;
    isFolder: boolean;
    showDiff?: boolean;
  } | null;
  pendingSelectCommit: { repoId: string; sha: string } | null;
  pendingRollback: {
    repoId: string;
    path: string;
    selectedPaths?: string[];
  } | null;
  pendingRootFocus: boolean;
};

let surfaceState: SurfaceState | null = null;
let contentSurfaceState: SurfaceState | null = null;
let contentPanel: vscode.WebviewPanel | null = null;
let contentPanelRepoId: string | null = null;
let contentPanelOpening: Promise<void> | null = null;
const attachWaiters: Record<
  GitWorkspaceSurfaceRole,
  Array<(state: SurfaceState) => void>
> = {
  bottom: [],
  content: [],
};

function getSurfaceState(role: GitWorkspaceSurfaceRole): SurfaceState | null {
  return role === "content" ? contentSurfaceState : surfaceState;
}

function setSurfaceState(
  role: GitWorkspaceSurfaceRole,
  state: SurfaceState | null,
): void {
  if (role === "content") {
    contentSurfaceState = state;
  } else {
    surfaceState = state;
  }
}

function notifyAttached(
  role: GitWorkspaceSurfaceRole,
  state: SurfaceState,
): void {
  const waiters = attachWaiters[role];
  while (waiters.length > 0) {
    waiters.shift()?.(state);
  }
}

function waitForSurface(
  role: GitWorkspaceSurfaceRole,
  timeoutMs: number,
): Promise<SurfaceState | null> {
  const state = getSurfaceState(role);
  if (state) {
    return Promise.resolve(state);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const waiters = attachWaiters[role];
      const index = waiters.indexOf(onAttach);
      if (index >= 0) {
        waiters.splice(index, 1);
      }
      resolve(getSurfaceState(role));
    }, timeoutMs);
    const onAttach = (state: SurfaceState): void => {
      clearTimeout(timer);
      resolve(state);
    };
    attachWaiters[role].push(onAttach);
  });
}

function deliverDialog(
  state: SurfaceState,
  request: {
    dialog: GitPanelSurface;
    relativePath?: string;
    index?: number | null;
    repoId?: string;
  },
): void {
  if (!state.ready) {
    state.pendingDialog = request;
    return;
  }
  state.postMessage({
    protocolVersion: PROTOCOL_VERSION,
    type: "git.openDialog",
    payload: request,
  });
}

function deliverHistory(
  state: SurfaceState,
  request: {
    repoId: string;
    path: string;
    isFolder: boolean;
    showDiff?: boolean;
  },
): void {
  if (!state.ready) {
    state.pendingHistory = request;
    return;
  }
  state.postMessage(createHostEvent("git.openHistory", request));
}

function deliverRollback(
  state: SurfaceState,
  request: { repoId: string; path: string; selectedPaths?: string[] },
): void {
  if (!state.ready) {
    state.pendingRollback = request;
    return;
  }
  state.postMessage(createHostEvent("git.requestRollback", request));
}

function deliverRootFocus(state: SurfaceState): void {
  if (!state.ready) {
    state.pendingRootFocus = true;
    return;
  }
  state.postMessage(createHostEvent("git.focusRoot", {}));
}

function workspaceFolders(): Array<{ uriPath: string; name: string }> {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
    uriPath: f.uri.fsPath,
    name: f.name,
  }));
}

function createRouter(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  postMessage: (message: HostToWebview) => void,
) {
  const reviewAuth = createReviewAuthService(context.secrets);
  return createMessageRouter({
    openDiffInEditor: async (preview, workspaceRoot) => {
      await openGitViewPanel(
        context,
        {
          relativePath: preview.relativePath,
          title: preview.title,
          diff: preview.diff,
        },
        workspaceRoot,
        {
          logger: gitView.logger,
          getGitView: () => gitView,
          reusePanel: true,
          openInActiveColumn: true,
        },
      );
    },
    onGitMenuAction: async (payload) => {
      const workspaceRoot =
        (await resolveLegacyWorkspaceRoot(gitView, payload.repoId)) ??
        workspaceFolders()[0]?.uriPath;
      await runGitMenuAction(
        context,
        payload,
        workspaceRoot,
        undefined,
        gitView,
      );
    },
    onOpenGitHistory: async (repoId, historyPath, isFolder) => {
      await openGitWorkspaceHistory(context, gitView, {
        repoId,
        path: historyPath,
        isFolder,
      });
    },
    onOpenGitRollback: async (repoId, rollbackPath, selectedPaths) => {
      await openGitWorkspaceRollback(context, gitView, {
        repoId,
        path: rollbackPath,
        ...(selectedPaths ? { selectedPaths } : {}),
      });
    },
    onOpenGitContentDialog: async (repoId, dialog, index) => {
      await openGitWorkspaceContentDialog(context, gitView, {
        repoId,
        dialog,
        ...(index !== undefined ? { index } : {}),
      });
    },
    mergePanel: {
      fileService: createFileService(),
      openedMergePaths: new Set<string>(),
      getSettings: readGitViewSettings,
      confirmMarkResolved: async (message) =>
        (await vscode.window.showWarningMessage(
          message,
          { modal: true },
          "Apply",
        )) === "Apply",
      confirmDiscard: async (message) =>
        (await vscode.window.showWarningMessage(
          message,
          { modal: true },
          "Discard",
        )) === "Discard",
    },
    logger: gitView.logger,
    execGit: gitView.gitService.execGit,
    repositoryService: gitView.repositoryService,
    protectionService: gitView.protectionService,
    refreshCoordinator: gitView.refreshCoordinator,
    syncOperationCoordinator: gitView.syncOperationCoordinator,
    repositoryMutationSerializer: gitView.repositoryMutationSerializer,
    changelistStorage: gitView.changelistStorage,
    shelfStorage: gitView.shelfStorage,
    branchFavoriteStorage: gitView.branchFavoriteStorage,
    commitCheckService: gitView.commitCheckService,
    reviewProviderRegistry: gitView.reviewProviderRegistry,
    protocolExtensionRegistry: gitView.protocolExtensionRegistry,
    blameCache: gitView.blameCache,
    trusted: vscode.workspace.isTrusted,
    getTrusted: () => vscode.workspace.isTrusted,
    workspaceFolders: workspaceFolders(),
    getWorkspaceFolders: workspaceFolders,
    postMessage,
    executeWorkspaceCommand: async (action) => {
      const command = {
        openFolder: "workbench.action.files.openFolder",
        clone: "git.clone",
        manageTrust: "workbench.trust.manage",
        addRemote: "git.addRemote",
        collapsePanel: "workbench.action.closePanel",
        toggleSidebar: "workbench.action.toggleSidebarVisibility",
      }[action];
      await vscode.commands.executeCommand(command);
    },
    getCrlfWarningsEnabled: () =>
      vscode.workspace.getConfiguration("gitView").get("crlfWarnings", true),
    getConfirmDestructiveActions: readConfirmDestructiveActions,
    getReviewAccessToken: (providerId) => reviewAuth.getAccessToken(providerId),
    getGithubApiBaseUrl: () =>
      vscode.workspace
        .getConfiguration("gitView")
        .get<string>("githubApiBaseUrl", "https://api.github.com") ?? "",
    getGitlabApiBaseUrl: () =>
      vscode.workspace
        .getConfiguration("gitView")
        .get<string>("gitlabApiBaseUrl", "https://gitlab.com/api/v4") ?? "",
  });
}

function pushRefreshPayload(
  payload: Awaited<
    ReturnType<GitViewContext["refreshCoordinator"]["refreshNow"]>
  >,
  postMessage: (message: HostToWebview) => void,
): void {
  if (payload.settings) {
    postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "git.settings",
      payload: payload.settings,
    });
  }
  postMessage({
    protocolVersion: PROTOCOL_VERSION,
    type: "repo.snapshot",
    payload: payload.repoSnapshot,
  });

  const activeRepoId = payload.repoSnapshot.activeRepoId;
  if (activeRepoId) {
    const status = payload.statusByRepoId.get(activeRepoId);
    if (status) {
      postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "status.snapshot",
        payload: status,
      });
    }
  }
}

export type AttachGitWorkspaceOptions = {
  /**
   * The bottom Git panel owns native-menu dialogs. The activity-bar Commit
   * sidebar is a second webview of the same app and must not steal that role.
  */
  ownsDialogs?: boolean;
  /** The editor-area rollback surface has its own queued dialog state. */
  surface?: GitWorkspaceSurfaceRole;
  /** Optional panel-specific close hook for transient editor-area surfaces. */
  onClose?: () => void;
};

export function attachGitWorkspaceWebview(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  onDispose: (listener: () => void) => void,
  options?: AttachGitWorkspaceOptions,
): void {
  const poster = createSafeWebviewPoster<HostToWebview>(
    webview,
    gitView.logger,
    "gitWorkspacePanel",
  );
  const postMessage = poster.postMessage;
  let disposed = false;
  let refreshSubscription: (() => void) | undefined;
  let refreshSubscriptionDisposed = false;
  const disposeRefreshSubscription = (): void => {
    if (refreshSubscriptionDisposed) {
      return;
    }
    refreshSubscriptionDisposed = true;
    refreshSubscription?.();
  };
  let syncSubscription: (() => void) | undefined;
  let syncSubscriptionDisposed = false;
  const disposeSyncSubscription = (): void => {
    if (syncSubscriptionDisposed) {
      return;
    }
    syncSubscriptionDisposed = true;
    syncSubscription?.();
  };
  const ownsDialogs = options?.ownsDialogs !== false;
  const surfaceRole = options?.surface ?? "bottom";
  const previousState = getSurfaceState(surfaceRole);
  const currentState: SurfaceState = {
    postMessage,
    ready: false,
    pendingDialog: ownsDialogs
      ? (previousState?.pendingDialog ?? null)
      : null,
    pendingHistory: ownsDialogs
      ? (previousState?.pendingHistory ?? null)
      : null,
    pendingSelectCommit: ownsDialogs
      ? (previousState?.pendingSelectCommit ?? null)
      : null,
    pendingRollback: ownsDialogs
      ? (previousState?.pendingRollback ?? null)
      : null,
    pendingRootFocus: ownsDialogs
      ? (previousState?.pendingRootFocus ?? false)
      : false,
  };
  if (ownsDialogs) {
    setSurfaceState(surfaceRole, currentState);
    notifyAttached(surfaceRole, currentState);
  }

  onDispose(() => {
    disposed = true;
    poster.dispose();
    disposeRefreshSubscription();
    disposeSyncSubscription();
    if (ownsDialogs && getSurfaceState(surfaceRole) === currentState) {
      setSurfaceState(surfaceRole, null);
    }
  });

  const router = createRouter(context, gitView, postMessage);

  refreshSubscription = gitView.refreshCoordinator.subscribe((payload) => {
    if (!disposed) {
      pushRefreshPayload(payload, postMessage);
    }
  });
  if (refreshSubscriptionDisposed) {
    refreshSubscription();
  }

  webview.onDidReceiveMessage(async (raw: unknown) => {
    if (
      surfaceRole === "content" &&
      ((raw as { type?: unknown } | null)?.type === "git.rollback.close" ||
        (raw as { type?: unknown } | null)?.type === "git.content.close")
    ) {
      options?.onClose?.();
      return;
    }
    await router.handleRawMessage(raw);
    if ((raw as { type?: string } | null)?.type === "webview.ready") {
      currentState.ready = true;
      if (!syncSubscription) {
        syncSubscription = gitView.syncOperationCoordinator.subscribe((event) =>
          postMessage(createHostEvent("sync.operation", event)),
        );
        if (syncSubscriptionDisposed) {
          syncSubscription();
        }
      }
      if (ownsDialogs) {
        const pending = currentState.pendingDialog;
        currentState.pendingDialog = null;
        if (pending) {
          deliverDialog(currentState, pending);
        }
        const pendingHistory = currentState.pendingHistory;
        currentState.pendingHistory = null;
        if (pendingHistory) {
          deliverHistory(currentState, pendingHistory);
        }
        const pendingCommit = currentState.pendingSelectCommit;
        currentState.pendingSelectCommit = null;
        if (pendingCommit) {
          currentState.postMessage(
            createHostEvent("git.selectCommit", pendingCommit),
          );
        }
        const pendingRollback = currentState.pendingRollback;
        currentState.pendingRollback = null;
        if (pendingRollback) {
          deliverRollback(currentState, pendingRollback);
        }
        if (currentState.pendingRootFocus) {
          currentState.pendingRootFocus = false;
          deliverRootFocus(currentState);
        }
      }
    }
  });
}

/**
 * Native Git submenu entry point: surface the panel, then have it open the same
 * dialog the panel's own context menu would.
 */
export async function openGitWorkspaceDialog(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  request: {
    dialog: GitPanelSurface;
    relativePath?: string;
    index?: number | null;
  },
): Promise<void> {
  await openGitWorkspacePanel(context, gitView);
  const state = getSurfaceState("bottom");
  if (!state) {
    throw new Error("GitView Git panel is unavailable.");
  }
  deliverDialog(state, request);
}

export async function openGitWorkspaceHistory(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  request: {
    repoId: string;
    path: string;
    isFolder: boolean;
    showDiff?: boolean;
  },
): Promise<void> {
  await openGitWorkspacePanel(context, gitView);
  const state = getSurfaceState("bottom");
  if (!state) {
    throw new Error("GitView Git panel is unavailable.");
  }
  deliverHistory(state, request);
}

export async function selectGitWorkspaceCommit(
  _context: vscode.ExtensionContext,
  _gitView: GitViewContext,
  request: { repoId: string; sha: string },
): Promise<void> {
  const state = getSurfaceState("bottom");
  if (!state) {
    return;
  }
  if (!state.ready) {
    state.pendingSelectCommit = request;
    return;
  }
  state.postMessage(createHostEvent("git.selectCommit", request));
}

export async function openGitWorkspaceRollback(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  request: { repoId: string; path: string; selectedPaths?: string[] },
): Promise<void> {
  await openGitWorkspaceContentPanel(context, gitView, "Rollback Changes");
  const state = getSurfaceState("content");
  if (!state) {
    throw new Error("GitView rollback panel is unavailable.");
  }
  deliverRollback(state, request);
}

export async function openGitWorkspaceContentDialog(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  request: {
    dialog: "stash" | "unstash";
    index?: number | null;
    repoId?: string;
  },
): Promise<void> {
  await openGitWorkspaceContentPanel(
    context,
    gitView,
    request.dialog === "stash" ? "Stash Changes" : "Unstash Changes",
    request.repoId,
  );
  const state = getSurfaceState("content");
  if (!state) {
    throw new Error("GitView stash panel is unavailable.");
  }
  deliverDialog(state, request);
}

export async function focusGitWorkspaceRoot(): Promise<void> {
  const state = await waitForSurface("bottom", 8_000);
  if (state) {
    deliverRootFocus(state);
  }
}

async function openGitWorkspaceContentPanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  title = "GitView",
  repoId?: string,
): Promise<void> {
  const requestedRepoId = repoId ?? null;
  if (contentPanelOpening) {
    await contentPanelOpening;
  }
  if (contentPanel && contentPanelRepoId === requestedRepoId) {
    contentPanel.title = title;
    contentPanel.reveal(vscode.ViewColumn.Active, false);
    await waitForSurface("content", 8_000);
    return;
  }

  if (contentPanel) {
    const stalePanel = contentPanel;
    contentPanel = null;
    contentPanelRepoId = null;
    setSurfaceState("content", null);
    stalePanel.dispose();
  }

  const opening = (async (): Promise<void> => {
    const panel = vscode.window.createWebviewPanel(
      "gitViewGitRollback",
      title,
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist"),
          vscode.Uri.joinPath(context.extensionUri, "webview", "dist"),
        ],
      },
    );
    contentPanel = panel;
    contentPanelRepoId = requestedRepoId;
    panel.onDidDispose(() => {
      if (contentPanel === panel) {
        contentPanel = null;
        contentPanelRepoId = null;
        setSurfaceState("content", null);
      }
    });

    try {
      let html = await getWebviewHtml(panel.webview, context.extensionUri, {
        app: "gitWorkspace",
      });
      const bootstrap = JSON.stringify({
        surface: "content",
        repoId: repoId ?? undefined,
      }).replace(/</g, "\\u003c");
      html = html.replace(
        `window.__GITVIEW_APP__="gitWorkspace"`,
        `window.__GITVIEW_APP__="gitWorkspace";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
      );

      attachGitWorkspaceWebview(
        panel.webview,
        context,
        gitView,
        (listener) => panel.onDidDispose(listener),
        { surface: "content", onClose: () => panel.dispose() },
      );
      panel.webview.html = html;
      await waitForSurface("content", 8_000);
    } catch (error) {
      if (contentPanel === panel) {
        contentPanel = null;
        contentPanelRepoId = null;
        setSurfaceState("content", null);
      }
      panel.dispose();
      throw error;
    }
  })();
  contentPanelOpening = opening;
  try {
    await opening;
  } finally {
    if (contentPanelOpening === opening) {
      contentPanelOpening = null;
    }
  }
}

export async function focusGitBottomPanel(options?: {
  keepSidebar?: boolean;
}): Promise<void> {
  if (!options?.keepSidebar) {
    void vscode.commands.executeCommand("workbench.action.closeSidebar");
  }
  try {
    await vscode.commands.executeCommand(
      "workbench.view.extension.gitViewPanel",
    );
  } catch {
    // The generated command is missing until the contribution is registered.
  }
  try {
    await vscode.commands.executeCommand("gitView.workspace.focus");
  } catch {
    // The webview view may not have been resolved yet.
  }
}

export async function openGitWorkspacePanel(
  _context: vscode.ExtensionContext,
  gitView: GitViewContext,
): Promise<void> {
  await focusGitBottomPanel();
  await waitForSurface("bottom", 8_000);
  if (vscode.workspace.isTrusted) {
    await gitView.refreshCoordinator.refreshNow();
  }
}
