import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { errorLogFields } from "../observability/logger";
import { getWebviewHtml } from "./getWebviewHtml";
import { createGitViewLauncherVisibilityHandler } from "./gitViewLauncher";
import {
  attachGitWorkspaceWebview,
  focusGitWorkspaceRoot,
  focusGitBottomPanel,
} from "./gitWorkspacePanel";

const WORKSPACE_VIEW_TYPE = "gitView.workspace";
const LAUNCHER_VIEW_TYPE = "gitView.launcher";
let gitWorkspaceViewVisible = false;

export function isGitWorkspaceViewVisible(): boolean {
  return gitWorkspaceViewVisible;
}

export function registerGitWorkspaceViewProvider(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WORKSPACE_VIEW_TYPE,
      new GitWorkspaceViewProvider(context, gitView),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.window.registerWebviewViewProvider(
      LAUNCHER_VIEW_TYPE,
      new GitViewLauncherProvider(context, gitView),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );
}

class GitViewLauncherProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly gitView: GitViewContext,
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionContext.extensionUri, "dist"),
        vscode.Uri.joinPath(
          this.extensionContext.extensionUri,
          "webview",
          "dist",
        ),
      ],
    };
    webviewView.title = "Commit";
    webview.html = await getWebviewHtml(
      webview,
      this.extensionContext.extensionUri,
      { app: "gitSidebar" },
    );
    attachGitWorkspaceWebview(
      webview,
      this.extensionContext,
      this.gitView,
      (listener) => webviewView.onDidDispose(listener),
      { ownsDialogs: false },
    );
    if (vscode.workspace.isTrusted) {
      void this.gitView.refreshCoordinator.refreshNow().catch((error: unknown) => {
        this.gitView.logger.warn("gitView.launcher.refresh.failed", {
          ...errorLogFields(error),
        });
      });
    }

    const onVisible = createGitViewLauncherVisibilityHandler({
      isVisible: () => webviewView.visible,
      isPanelVisible: isGitWorkspaceViewVisible,
      focusBottomPanel: (options) => focusGitBottomPanel(options),
      focusRoot: () => focusGitWorkspaceRoot(),
      showSidebar: (preserveFocus) => webviewView.show(preserveFocus),
    });
    webviewView.onDidChangeVisibility(() => {
      void onVisible();
    });
    if (webviewView.visible) {
      void onVisible();
    }
  }
}

class GitWorkspaceViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly gitView: GitViewContext,
  ) {}

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const webview = webviewView.webview;
    const updateVisibility = () => {
      gitWorkspaceViewVisible = webviewView.visible;
    };
    updateVisibility();
    const visibilityDisposable = webviewView.onDidChangeVisibility(
      updateVisibility,
    );
    const disposalDisposable = webviewView.onDidDispose(() => {
      gitWorkspaceViewVisible = false;
    });
    this.extensionContext.subscriptions.push(
      visibilityDisposable,
      disposalDisposable,
    );
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionContext.extensionUri, "dist"),
        vscode.Uri.joinPath(
          this.extensionContext.extensionUri,
          "webview",
          "dist",
        ),
      ],
    };
    webviewView.title = "Git";
    webview.html = await getWebviewHtml(
      webview,
      this.extensionContext.extensionUri,
      { app: "gitWorkspace" },
    );
    attachGitWorkspaceWebview(
      webview,
      this.extensionContext,
      this.gitView,
      (listener) => webviewView.onDidDispose(listener),
    );
    if (vscode.workspace.isTrusted) {
      void this.gitView.refreshCoordinator.refreshNow().catch((error: unknown) => {
        this.gitView.logger.warn("gitView.workspace.refresh.failed", {
          ...errorLogFields(error),
        });
      });
    }
  }
}
