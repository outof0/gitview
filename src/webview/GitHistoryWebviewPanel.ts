import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import {
  parseWebviewRequest,
  type HostToWebview,
} from "../shared/protocol";
import { getWebviewHtml } from "./getWebviewHtml";
import {
  buildHistoryInitPayload,
  createGitViewPanelRouter,
  postHistoryInit,
  resolveRepoIdForResource,
} from "./gitViewPanelRouter";
import { createSafeWebviewPoster } from "./safeWebviewPoster";

const panels = new Map<string, vscode.WebviewPanel>();

function panelKey(
  path: string,
  isFolder: boolean,
  workspaceRoot?: string,
): string {
  const root = workspaceRoot ?? "";
  return `${root}:${isFolder ? "dir" : "file"}:${path}`;
}

function panelTitle(path: string, isFolder: boolean): string {
  if (isFolder) {
    return `History — ${path}/`;
  }
  const fileName = path.split("/").pop() ?? path;
  return `History — ${fileName}`;
}

function encodeBootstrap(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type OpenGitHistoryPanelOptions = {
  viewColumn?: vscode.ViewColumn;
  /** Soften title when opened from Annotate (log next to the real editor). */
  annotateMode?: boolean;
  preserveFocus?: boolean;
};

export async function openGitHistoryPanel(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  historyPath: string,
  isFolder: boolean,
  workspaceRoot?: string,
  options?: OpenGitHistoryPanelOptions,
): Promise<void> {
  const key = panelKey(historyPath, isFolder, workspaceRoot);
  const targetColumn = options?.viewColumn ?? vscode.ViewColumn.Active;
  const preserveFocus = options?.preserveFocus ?? false;
  const existing = panels.get(key);
  if (existing) {
    existing.reveal(targetColumn, preserveFocus);
    return;
  }

  const resolvedWorkspaceRoot =
    workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  if (!resolvedWorkspaceRoot) {
    void vscode.window.showErrorMessage(
      "Show Git History requires an open workspace folder.",
    );
    return;
  }

  const repoId = await resolveRepoIdForResource(
    gitView,
    resolvedWorkspaceRoot,
    historyPath,
  );
  if (!repoId) {
    void vscode.window.showErrorMessage(
      "GitView could not find a Git repository for this resource.",
    );
    return;
  }

  const title = options?.annotateMode
    ? `Log — ${historyPath.split("/").pop() ?? historyPath}`
    : panelTitle(historyPath, isFolder);

  const panel = vscode.window.createWebviewPanel(
    "gitViewGitHistory",
    title,
    { viewColumn: targetColumn, preserveFocus },
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
    "gitHistory",
  );
  const postMessage = poster.postMessage;
  panel.onDidDispose(() => {
    poster.dispose();
    panels.delete(key);
  });

  const target = { path: historyPath, isFolder };
  const router = createGitViewPanelRouter(
    context,
    gitView,
    postMessage,
    resolvedWorkspaceRoot,
  );

  webview.onDidReceiveMessage(async (raw: unknown) => {
    const request = parseWebviewRequest(raw);
    if (request?.type === "webview.ready" && request.payload.surface === "gitHistory") {
      await router.handleRawMessage(raw);
      const init = await buildHistoryInitPayload(gitView, repoId, target);
      if (init) {
        postHistoryInit(postMessage, init);
      }
      return;
    }
    await router.handleRawMessage(raw);
  });

  const bootstrap = encodeBootstrap({ path: historyPath, isFolder, repoId });
  webview.html = await getWebviewHtml(
    webview,
    context.extensionUri,
    { app: "gitHistory" },
  );
  webview.html = webview.html.replace(
    `window.__GITVIEW_APP__="gitHistory"`,
    `window.__GITVIEW_APP__="gitHistory";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
  );

  panels.set(key, panel);
}
