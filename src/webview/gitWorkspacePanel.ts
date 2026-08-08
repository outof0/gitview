import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { readConfirmDestructiveActions } from "../config/readConfirmDestructiveActions";
import {
  PROTOCOL_VERSION,
  type GitPanelSurface,
  type HostToWebview,
} from "../shared/protocol";
import { readGitViewSettings } from "../config/readGitViewSettings";
import { createMessageRouter } from "../webviewHost/messageRouter";
import { createFileService } from "../services/fileService";
import { createReviewAuthService } from "../services/review/reviewAuth";
import { getWebviewHtml } from "./getWebviewHtml";
import { createSafeWebviewPoster } from "./safeWebviewPoster";

type PanelState = {
  panel: vscode.WebviewPanel;
  postMessage: (message: HostToWebview) => void;
  ready: boolean;
  /** Dialog requested before the webview finished booting. */
  pendingDialog: { dialog: GitPanelSurface; relativePath?: string } | null;
};

let panelState: PanelState | null = null;

function deliverDialog(
  state: PanelState,
  request: { dialog: GitPanelSurface; relativePath?: string },
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
    // The Changes tab previews conflicted files with the real three-way
    // resolver, which needs the same merge handlers as the standalone panel.
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

/**
 * Native Git submenu entry point: surface the panel, then have it open the same
 * dialog the panel's own context menu would.
 */
export async function openGitWorkspaceDialog(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  request: { dialog: GitPanelSurface; relativePath?: string },
): Promise<void> {
  await openGitWorkspacePanel(context, gitView);
  if (panelState) {
    deliverDialog(panelState, request);
  }
}

export async function openGitWorkspacePanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
): Promise<void> {
  if (panelState) {
    panelState.panel.reveal(vscode.ViewColumn.One, true);
    await gitView.refreshCoordinator.refreshNow();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "gitViewWorkspace",
    "GitView",
    { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist"),
        vscode.Uri.joinPath(context.extensionUri, "webview", "dist"),
      ],
    },
  );
  const webview = panel.webview;
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
  const currentState: PanelState = {
    panel,
    postMessage,
    ready: false,
    pendingDialog: null,
  };
  panelState = currentState;

  panel.onDidDispose(() => {
    disposed = true;
    poster.dispose();
    disposeRefreshSubscription();
    if (panelState === currentState) {
      panelState = null;
    }
  });

  const router = createRouter(context, gitView, postMessage);

  refreshSubscription = gitView.refreshCoordinator.subscribe((payload) => {
    if (!disposed && panelState === currentState) {
      pushRefreshPayload(payload, postMessage);
    }
  });
  if (refreshSubscriptionDisposed) {
    refreshSubscription();
  }

  webview.onDidReceiveMessage(async (raw: unknown) => {
    await router.handleRawMessage(raw);
    if ((raw as { type?: string } | null)?.type === "webview.ready") {
      currentState.ready = true;
      const pending = currentState.pendingDialog;
      currentState.pendingDialog = null;
      if (pending) {
        deliverDialog(currentState, pending);
      }
    }
  });

  let html: string;
  try {
    html = await getWebviewHtml(webview, context.extensionUri, {
      app: "gitWorkspace",
    });
  } catch (error) {
    if (!disposed) {
      panel.dispose();
    }
    throw error;
  }
  if (disposed) {
    return;
  }
  webview.html = html;

  if (vscode.workspace.isTrusted) {
    try {
      await gitView.refreshCoordinator.refreshNow();
    } catch (error) {
      if (!disposed) {
        throw error;
      }
    }
  }
}
