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

type SurfaceState = {
  postMessage: (message: HostToWebview) => void;
  ready: boolean;
  pendingDialog: { dialog: GitPanelSurface; relativePath?: string } | null;
};

let surfaceState: SurfaceState | null = null;
const attachWaiters: Array<(state: SurfaceState) => void> = [];

function notifyAttached(state: SurfaceState): void {
  while (attachWaiters.length > 0) {
    attachWaiters.shift()?.(state);
  }
}

function waitForSurface(timeoutMs: number): Promise<SurfaceState | null> {
  if (surfaceState) {
    return Promise.resolve(surfaceState);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const index = attachWaiters.indexOf(onAttach);
      if (index >= 0) {
        attachWaiters.splice(index, 1);
      }
      resolve(surfaceState);
    }, timeoutMs);
    const onAttach = (state: SurfaceState): void => {
      clearTimeout(timer);
      resolve(state);
    };
    attachWaiters.push(onAttach);
  });
}

function deliverDialog(
  state: SurfaceState,
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
      const { openGitHistoryPanel } = await import("./GitHistoryWebviewPanel");
      const workspaceRoot = await resolveLegacyWorkspaceRoot(gitView, repoId);
      if (!workspaceRoot) {
        throw new Error(
          "GitView could not find a workspace folder for this action.",
        );
      }
      await openGitHistoryPanel(
        context,
        gitView,
        historyPath,
        isFolder,
        workspaceRoot,
      );
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

export function attachGitWorkspaceWebview(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  onDispose: (listener: () => void) => void,
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
  const currentState: SurfaceState = {
    postMessage,
    ready: false,
    pendingDialog: surfaceState?.pendingDialog ?? null,
  };
  surfaceState = currentState;
  notifyAttached(currentState);

  onDispose(() => {
    disposed = true;
    poster.dispose();
    disposeRefreshSubscription();
    disposeSyncSubscription();
    if (surfaceState === currentState) {
      surfaceState = null;
    }
  });

  const router = createRouter(context, gitView, postMessage);

  refreshSubscription = gitView.refreshCoordinator.subscribe((payload) => {
    if (!disposed && surfaceState === currentState) {
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
      if (!syncSubscription) {
        syncSubscription = gitView.syncOperationCoordinator.subscribe((event) =>
          postMessage(createHostEvent("sync.operation", event)),
        );
        if (syncSubscriptionDisposed) {
          syncSubscription();
        }
      }
      const pending = currentState.pendingDialog;
      currentState.pendingDialog = null;
      if (pending) {
        deliverDialog(currentState, pending);
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
  request: { dialog: GitPanelSurface; relativePath?: string },
): Promise<void> {
  await openGitWorkspacePanel(context, gitView);
  if (surfaceState) {
    deliverDialog(surfaceState, request);
  }
}

export async function focusGitBottomPanel(): Promise<void> {
  void vscode.commands.executeCommand("workbench.action.closeSidebar");
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
  const state = await waitForSurface(8_000);
  if (!state) {
    return;
  }
  if (vscode.workspace.isTrusted) {
    await gitView.refreshCoordinator.refreshNow();
  }
}
