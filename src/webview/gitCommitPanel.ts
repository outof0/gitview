import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import {
  createHostResponse,
  parseWebviewRequest,
  type HostToWebview,
} from "../shared/protocol";
import { getWebviewHtml } from "./getWebviewHtml";
import { readGitWorkspaceSettings } from "../config/readGitWorkspaceSettings";
import { createSafeWebviewPoster } from "./safeWebviewPoster";
import { createGitViewPanelRouter } from "./gitViewPanelRouter";

const commitPanels = new Map<string, vscode.WebviewPanel>();

export type OpenGitCommitPanelOptions = {
  repoId: string;
  workspaceRoot: string;
};

/**
 * Opens the Commit dialog as its own editor-area panel instead of inside the
 * bottom Git panel.
 *
 * Two reasons, both measured: the bottom panel is ~258px tall, so the dialog's
 * `80vh` resolves to ~206px and its file/diff split collapses to 2px — files
 * cannot be picked before committing. And opening by `repoId` here means the
 * dialog commits to the repository the user opened the menu on, which the panel
 * dialog could not guarantee because it only received a dialog id.
 */
export async function openGitCommitPanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  options: OpenGitCommitPanelOptions,
): Promise<void> {
  const { repoId, workspaceRoot } = options;
  const key = `commit:${repoId}`;
  const existing = commitPanels.get(key);
  if (existing) {
    existing.reveal(vscode.ViewColumn.Active, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "gitViewGitCommit",
    "Commit",
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
  const webview = panel.webview;
  const poster = createSafeWebviewPoster<HostToWebview>(
    webview,
    gitView.logger,
    "gitCommit",
  );
  const postMessage = poster.postMessage;

  const router = createGitViewPanelRouter(
    context,
    gitView,
    postMessage,
    workspaceRoot,
  );

  panel.onDidDispose(() => {
    poster.dispose();
    commitPanels.delete(key);
  });

  webview.onDidReceiveMessage((raw: unknown) => {
    const request = parseWebviewRequest(raw);
    if (request?.type === "webview.ready") {
      postMessage(
        createHostResponse(request.requestId, "webview.ready", {
          surface: "gitCommit",
          settings: readGitWorkspaceSettings(),
        }),
      );
      return;
    }
    if (
      raw &&
      typeof raw === "object" &&
      (raw as { type?: string }).type === "git.commit.close"
    ) {
      panel.dispose();
      return;
    }
    void router.handleRawMessage(raw);
  });

  const bootstrap = JSON.stringify({ repoId }).replace(/</g, "\\u003c");
  webview.html = await getWebviewHtml(webview, context.extensionUri, {
    app: "gitCommit",
  });
  webview.html = webview.html.replace(
    `window.__GITVIEW_APP__="gitCommit"`,
    `window.__GITVIEW_APP__="gitCommit";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
  );

  commitPanels.set(key, panel);
}
