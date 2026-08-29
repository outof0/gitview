import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { getWebviewHtml } from "./getWebviewHtml";
import {
  attachGitWorkspaceWebview,
  focusGitBottomPanel,
} from "./gitWorkspacePanel";

const WORKSPACE_VIEW_TYPE = "gitView.workspace";
const LAUNCHER_VIEW_TYPE = "gitView.launcher";

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
      new GitViewLauncherProvider(),
    ),
  );
}

class GitViewLauncherProvider implements vscode.WebviewViewProvider {
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:12px;font-family:var(--vscode-font-family,sans-serif);font-size:12px;color:var(--vscode-foreground)">
  Opening Git…
</body>
</html>`;
    const openPanel = () => {
      void focusGitBottomPanel();
    };
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        openPanel();
      }
    });
    if (webviewView.visible) {
      openPanel();
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
      try {
        await this.gitView.refreshCoordinator.refreshNow();
      } catch {
        // Snapshot errors surface through the webview after ready.
      }
    }
  }
}
