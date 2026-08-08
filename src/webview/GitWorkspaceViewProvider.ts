import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { runGitMenuAction } from "../commands/gitMenuActions";
import { readConfirmDestructiveActions } from "../config/readConfirmDestructiveActions";
import { openGitViewPanel } from "./gitViewPresentation";
import { PROTOCOL_VERSION, type HostToWebview } from "../shared/protocol";
import { createMessageRouter } from "../webviewHost/messageRouter";
import { createReviewAuthService } from "../services/review/reviewAuth";
import { errorLogFields } from "../observability/logger";
import { openGitHistoryPanel } from "./GitHistoryWebviewPanel";
import { getWebviewHtml } from "./getWebviewHtml";
import { resolveLegacyWorkspaceRoot } from "./resolveLegacyWorkspaceRoot";
import { createSafeWebviewPoster } from "./safeWebviewPoster";

const VIEW_TYPE = "gitView.workspace";

function workspaceFolders(): Array<{ uriPath: string; name: string }> {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
    uriPath: f.uri.fsPath,
    name: f.name,
  }));
}

export function registerGitWorkspaceViewProvider(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
): void {
  const provider = new GitWorkspaceViewProvider(
    context.extensionUri,
    context,
    gitView,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

class GitWorkspaceViewProvider implements vscode.WebviewViewProvider {
  private unsubscribeRefresh: (() => void) | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly gitView: GitViewContext,
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "dist"),
        vscode.Uri.joinPath(this.extensionUri, "webview", "dist"),
      ],
    };

    let disposed = false;
    const poster = createSafeWebviewPoster<HostToWebview>(
      webview,
      this.gitView.logger,
      "gitWorkspaceView",
    );
    const postMessage = poster.postMessage;

    // VS Code may resolve a replacement view before disposing the previous
    // instance. Exactly one refresh subscription belongs to this provider.
    this.unsubscribeRefresh?.();
    this.unsubscribeRefresh = undefined;

    let refreshSubscription: (() => void) | undefined;
    let refreshSubscriptionDisposed = false;
    const disposeRefreshSubscription = (): void => {
      if (refreshSubscriptionDisposed) {
        return;
      }
      refreshSubscriptionDisposed = true;
      refreshSubscription?.();
    };

    webviewView.onDidDispose(() => {
      disposed = true;
      poster.dispose();
      disposeRefreshSubscription();
      if (this.unsubscribeRefresh === disposeRefreshSubscription) {
        this.unsubscribeRefresh = undefined;
      }
    });

    const reviewAuth = createReviewAuthService(this.extensionContext.secrets);
    const router = createMessageRouter({
      logger: this.gitView.logger,
      execGit: this.gitView.gitService.execGit,
      repositoryService: this.gitView.repositoryService,
      protectionService: this.gitView.protectionService,
      refreshCoordinator: this.gitView.refreshCoordinator,
      changelistStorage: this.gitView.changelistStorage,
      branchFavoriteStorage: this.gitView.branchFavoriteStorage,
      shelfStorage: this.gitView.shelfStorage,
      commitCheckService: this.gitView.commitCheckService,
      reviewProviderRegistry: this.gitView.reviewProviderRegistry,
      protocolExtensionRegistry: this.gitView.protocolExtensionRegistry,
      blameCache: this.gitView.blameCache,
      trusted: vscode.workspace.isTrusted,
      getTrusted: () => vscode.workspace.isTrusted,
      workspaceFolders: workspaceFolders(),
      getWorkspaceFolders: workspaceFolders,
      postMessage,
      getCrlfWarningsEnabled: () =>
        vscode.workspace
          .getConfiguration("gitView")
          .get("crlfWarnings", true),
      getConfirmDestructiveActions: readConfirmDestructiveActions,
      getReviewAccessToken: (providerId) =>
        reviewAuth.getAccessToken(providerId),
      getGithubApiBaseUrl: () =>
        vscode.workspace
          .getConfiguration("gitView")
          .get<string>("githubApiBaseUrl", "https://api.github.com") ?? "",
      getGitlabApiBaseUrl: () =>
        vscode.workspace
          .getConfiguration("gitView")
          .get<string>("gitlabApiBaseUrl", "https://gitlab.com/api/v4") ?? "",
      onOpenGitHistory: async (repoId, historyPath, isFolder) => {
        const workspaceRoot = await resolveLegacyWorkspaceRoot(
          this.gitView,
          repoId,
        );
        if (!workspaceRoot) {
          throw new Error(
            "GitView could not find a workspace folder for this action.",
          );
        }
        await openGitHistoryPanel(
          this.extensionContext,
          this.gitView,
          historyPath,
          isFolder,
          workspaceRoot,
        );
      },
      onGitMenuAction: async (payload) => {
        const workspaceRoot = await resolveLegacyWorkspaceRoot(
          this.gitView,
          payload.repoId,
        );
        if (!workspaceRoot) {
          throw new Error(
            "GitView could not find a workspace folder for this action.",
          );
        }
        const postDiffPreview = async (preview: {
          relativePath: string;
          title: string;
          diff: import("../types/blame").FileDiffView;
        }) => {
          await openGitViewPanel(
            this.extensionContext,
            preview,
            workspaceRoot,
            {
              logger: this.gitView.logger,
              getGitView: () => this.gitView,
            },
          );
        };
        await runGitMenuAction(
          this.extensionContext,
          payload,
          workspaceRoot,
          postDiffPreview,
          this.gitView,
        );
      },
    });

    webview.onDidReceiveMessage(async (raw: unknown) => {
      await router.handleRawMessage(raw);
    });

    void getWebviewHtml(webview, this.extensionUri, {
      app: "gitWorkspace",
    })
      .then((html) => {
        if (!disposed) {
          webview.html = html;
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          this.gitView.logger.error("webview.html.failed", {
            surface: "gitWorkspaceView",
            ...errorLogFields(error),
          });
        }
      });

    refreshSubscription = this.gitView.refreshCoordinator.subscribe(
      (payload) => {
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
      },
    );
    if (refreshSubscriptionDisposed) {
      refreshSubscription();
    } else {
      this.unsubscribeRefresh = disposeRefreshSubscription;
    }

    if (vscode.workspace.isTrusted) {
      void this.gitView.refreshCoordinator
        .refreshNow()
        .catch((error: unknown) => {
          if (!disposed) {
            this.gitView.logger.error("refresh.webview.failed", {
              surface: "gitWorkspaceView",
              ...errorLogFields(error),
            });
          }
        });
    }
  }
}
