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

const branchesPanels = new Map<string, vscode.WebviewPanel>();

export type OpenGitBranchesPanelOptions = {
  repoId: string;
  workspaceRoot: string;
  /** Branch to reveal once the list loads; empty means no initial selection. */
  initialRef?: string;
};

/**
 * Opens the Branches popup as its own editor-area panel instead of raising it
 * inside the bottom Git panel.
 *
 * The bottom panel is ~258px tall, which leaves the branch list cramped — the
 * native Git submenu should get the same full-height surface that New Branch
 * already uses. Opening by `repoId` also means the list shows the repository the
 * user opened the menu on, which the panel dialog could not guarantee because it
 * only received a dialog id.
 */
export async function openGitBranchesPanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  options: OpenGitBranchesPanelOptions,
): Promise<void> {
  const { repoId, workspaceRoot, initialRef } = options;
  const key = `branches:${repoId}`;
  const existing = branchesPanels.get(key);
  if (existing) {
    existing.reveal(vscode.ViewColumn.Active, true);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "gitViewGitBranches",
    "Branches",
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
    "gitBranches",
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
    branchesPanels.delete(key);
  });

  webview.onDidReceiveMessage((raw: unknown) => {
    const request = parseWebviewRequest(raw);
    if (request?.type === "webview.ready") {
      postMessage(
        createHostResponse(request.requestId, "webview.ready", {
          surface: "gitBranches",
          settings: readGitWorkspaceSettings(),
        }),
      );
      return;
    }
    if (
      raw &&
      typeof raw === "object" &&
      (raw as { type?: string }).type === "git.branches.close"
    ) {
      panel.dispose();
      return;
    }
    void router.handleRawMessage(raw);
  });

  const bootstrap = JSON.stringify({ repoId, initialRef: initialRef ?? "" })
    .replace(/</g, "\\u003c");
  webview.html = await getWebviewHtml(webview, context.extensionUri, {
    app: "gitBranches",
  });
  webview.html = webview.html.replace(
    `window.__GITVIEW_APP__="gitBranches"`,
    `window.__GITVIEW_APP__="gitBranches";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
  );

  branchesPanels.set(key, panel);
}
