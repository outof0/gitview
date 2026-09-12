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

const createBranchPanels = new Map<string, vscode.WebviewPanel>();

export type OpenGitCreateBranchOptions = {
  repoId: string;
  workspaceRoot: string;
  /** Ref the new branch starts from; empty means the current HEAD. */
  startPoint?: string;
};

/**
 * Opens the Create Branch dialog as a centered modal in the editor area instead
 * of the bottom GitView panel. Both the native Git submenu and the panel's own
 * New Branch action route here.
 */
export async function openGitCreateBranchPanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  options: OpenGitCreateBranchOptions,
): Promise<void> {
  const { repoId, workspaceRoot, startPoint } = options;
  const key = `createBranch:${repoId}`;
  const existing = createBranchPanels.get(key);
  if (existing) {
    existing.reveal(vscode.ViewColumn.Active, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "gitViewGitCreateBranch",
    "Create Branch",
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
    "gitCreateBranch",
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
    createBranchPanels.delete(key);
  });

  webview.onDidReceiveMessage((raw: unknown) => {
    const request = parseWebviewRequest(raw);
    if (request?.type === "webview.ready") {
      postMessage(
        createHostResponse(request.requestId, "webview.ready", {
          surface: "gitCreateBranch",
          settings: readGitWorkspaceSettings(),
        }),
      );
      return;
    }
    if (
      raw &&
      typeof raw === "object" &&
      (raw as { type?: string }).type === "git.createBranch.close"
    ) {
      panel.dispose();
      return;
    }
    void router.handleRawMessage(raw);
  });

  const bootstrap = JSON.stringify({
    repoId,
    startPoint: startPoint ?? "",
  }).replace(/</g, "\\u003c");
  webview.html = await getWebviewHtml(webview, context.extensionUri, {
    app: "gitCreateBranch",
  });
  webview.html = webview.html.replace(
    `window.__GITVIEW_APP__="gitCreateBranch"`,
    `window.__GITVIEW_APP__="gitCreateBranch";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
  );

  createBranchPanels.set(key, panel);
}
