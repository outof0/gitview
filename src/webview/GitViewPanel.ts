import * as vscode from "vscode";
import * as path from "path";
import type { GitViewContext } from "../application/gitViewContext";
import { readConfirmDestructiveActions } from "../config/readConfirmDestructiveActions";
import {
  readGitViewSettings,
  themeKindFromVscode,
} from "../config/readGitViewSettings";
import { runGitMenuAction } from "../commands/gitMenuActions";
import { getWebviewHtml } from "./getWebviewHtml";
import { createFileService } from "../services/fileService";
import { createMergeApi } from "../services/git/merge";
import { createRepoApi } from "../services/git/repo";
import { openGitHistoryPanel } from "./GitHistoryWebviewPanel";
import {
  createHostEvent,
  parseWebviewRequest,
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../shared/protocol";
import { createMessageRouter } from "../webviewHost/messageRouter";
import { createReviewAuthService } from "../services/review/reviewAuth";
import { resolveRepoIdForResource } from "./gitViewPanelRouter";
import { resolveLegacyWorkspaceRoot } from "./resolveLegacyWorkspaceRoot";

let panel: vscode.WebviewPanel | undefined = undefined;
let panelWorkspaceRoot: string | null = null;
let panelRepoId: string | null = null;
let extensionContext: vscode.ExtensionContext | undefined = undefined;

let pendingOpenRelativePath: string | null = null;
const openedMergePaths = new Set<string>();
const fileService = createFileService();

function workspaceFolders(): Array<{ uriPath: string; name: string }> {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
    uriPath: f.uri.fsPath,
    name: f.name,
  }));
}

function sendToWebview(msg: HostToWebview) {
  void panel?.webview.postMessage(msg);
}

function resolveWorkspaceRoot(resource?: vscode.Uri): string | null {
  if (resource?.scheme === "file") {
    const folder = vscode.workspace.getWorkspaceFolder(resource);
    if (folder) {
      return folder.uri.fsPath;
    }
  }

  const editor = vscode.window.activeTextEditor;
  if (editor?.document.uri.scheme === "file") {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) {
      return folder.uri.fsPath;
    }
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

async function resolvePanelWorkspaceRoot(
  gitView: GitViewContext,
  resource?: vscode.Uri,
): Promise<string | null> {
  const fallback = resolveWorkspaceRoot(resource);
  if (resource?.scheme !== "file") {
    return fallback;
  }
  const repoApi = createRepoApi(gitView.gitService.execGit);
  const repoRoot = await repoApi.findRepoRoot(path.dirname(resource.fsPath));
  return repoRoot ?? fallback;
}

function getPanelWorkspaceRoot(): string | null {
  return panelWorkspaceRoot ?? resolveWorkspaceRoot();
}

async function resolveResourceRelativePath(
  gitView: GitViewContext,
  resource: vscode.Uri | undefined,
  workspaceRoot: string | null,
): Promise<string | null> {
  if (!resource || resource.scheme !== "file" || !workspaceRoot) {
    return null;
  }
  const repoApi = createRepoApi(gitView.gitService.execGit);
  const merge = createMergeApi(gitView.gitService.execGit);
  const repoRoot =
    (await repoApi.findRepoRoot(path.dirname(resource.fsPath))) ??
    (await repoApi.findRepoRoot(workspaceRoot));
  if (!repoRoot) {
    return null;
  }
  const rel = path.relative(repoRoot, resource.fsPath).replace(/\\/g, "/");
  if (!rel || rel === ".." || rel.startsWith("../")) {
    return null;
  }
  const relativePath = path.posix.normalize(rel);
  try {
    const unmerged = await merge.listUnmergedFiles(repoRoot);
    if (
      unmerged.some(
        (file) => file.relativePath.replace(/\\/g, "/") === relativePath,
      )
    ) {
      return relativePath;
    }
  } catch {
    // Fall through to stage probing.
  }

  try {
    const [ours, theirs] = await Promise.all([
      merge.readStage(repoRoot, relativePath, 2),
      merge.readStage(repoRoot, relativePath, 3),
    ]);
    return ours !== null || theirs !== null ? relativePath : null;
  } catch {
    return null;
  }
}

function createRouter(context: vscode.ExtensionContext, gitView: GitViewContext) {
  const reviewAuth = createReviewAuthService(context.secrets);
  return createMessageRouter({
    logger: gitView.logger,
    execGit: gitView.gitService.execGit,
    repositoryService: gitView.repositoryService,
    protectionService: gitView.protectionService,
    refreshCoordinator: gitView.refreshCoordinator,
    changelistStorage: gitView.changelistStorage,
    branchFavoriteStorage: gitView.branchFavoriteStorage,
    shelfStorage: gitView.shelfStorage,
    commitCheckService: gitView.commitCheckService,
    reviewProviderRegistry: gitView.reviewProviderRegistry,
    protocolExtensionRegistry: gitView.protocolExtensionRegistry,
    blameCache: gitView.blameCache,
    trusted: vscode.workspace.isTrusted,
    getTrusted: () => vscode.workspace.isTrusted,
    workspaceFolders: workspaceFolders(),
    getWorkspaceFolders: workspaceFolders,
    postMessage: sendToWebview,
    getCrlfWarningsEnabled: () =>
      vscode.workspace.getConfiguration("gitView").get("crlfWarnings", true),
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
      if (!extensionContext) {
        return;
      }
      const workspaceRoot = await resolveLegacyWorkspaceRoot(
        gitView,
        repoId,
      );
      if (!workspaceRoot) {
        throw new Error(
          "GitView could not find a workspace folder for this action.",
        );
      }
      await openGitHistoryPanel(
        extensionContext,
        gitView,
        historyPath,
        isFolder,
        workspaceRoot,
      );
    },
    onGitMenuAction: async (payload) => {
      if (!extensionContext) {
        return;
      }
      const workspaceRoot =
        getPanelWorkspaceRoot() ??
        (await resolveLegacyWorkspaceRoot(gitView, payload.repoId));
      if (
        payload.action === "annotateBlame" &&
        payload.relativePath &&
        panel
      ) {
        sendToWebview(
          createHostEvent("blame.annotateRequest", {
            relativePath: payload.relativePath,
            side: "ours" as const,
          }),
        );
        return;
      }
      const postDiffPreview =
        panel &&
        payload.relativePath &&
        (payload.action === "showDiff" ||
          payload.action === "compareWithRevision" ||
          payload.action === "compareWithBranch")
          ? async (preview: {
              relativePath: string;
              title: string;
              diff: import("../types/blame").FileDiffView;
            }) => {
              sendToWebview(
                createHostEvent("diff.preview", {
                  relativePath: preview.relativePath,
                  title: preview.title,
                  diff: preview.diff,
                }),
              );
            }
          : undefined;
      await runGitMenuAction(
        extensionContext,
        payload,
        workspaceRoot ?? undefined,
        postDiffPreview,
        gitView,
      );
    },
    mergePanel: {
      fileService,
      openedMergePaths,
      getSettings: readGitViewSettings,
      confirmMarkResolved: async (message) => {
        const choice = await vscode.window.showWarningMessage(
          message,
          { modal: true },
          "Apply",
        );
        return choice === "Apply";
      },
      confirmDiscard: async (message) => {
        const choice = await vscode.window.showWarningMessage(
          message,
          { modal: true },
          "Discard",
        );
        return choice === "Discard";
      },
      close: () => {
        panel?.dispose();
      },

    },
  });
}

async function pushMergeBootstrap(
  router: ReturnType<typeof createMessageRouter>,
  repoId: string,
): Promise<void> {
  sendToWebview(
    createHostEvent("merge.init", {
      repoId,
      themeKind: themeKindFromVscode(),
      extensionVersion:
        extensionContext?.extension.packageJSON.version ?? "0.0.0",
      settings: readGitViewSettings(),
    }),
  );

  const request = {
    protocolVersion: PROTOCOL_VERSION,
    requestId: "bootstrap-conflicts",
    type: "conflict.refresh",
    payload: { repoId },
  };
  await router.handleRawMessage(request);
}

async function openPendingConflictFile(
  router: ReturnType<typeof createMessageRouter>,
): Promise<void> {
  const relativePath = pendingOpenRelativePath;
  const repoId = panelRepoId;
  if (!relativePath || !repoId) {
    return;
  }
  pendingOpenRelativePath = null;
  await router.handleRawMessage({
    protocolVersion: PROTOCOL_VERSION,
    requestId: "pending-open-file",
    type: "merge.openFile",
    payload: { repoId, path: relativePath },
  });
}

function encodeBootstrap(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export type CreateOrRevealOptions = {
  /**
   * Open merge resolver for the resource path when it is unmerged.
   * Default false — Resolve conflict shows the Conflicts dialog first.
   */
  openConflictFile?: boolean;
};

export async function createOrReveal(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  resource?: vscode.Uri,
  options?: CreateOrRevealOptions,
) {
  extensionContext = context;
  const openConflictFile = options?.openConflictFile === true;

  const router = createRouter(context, gitView);
  const requestedWorkspaceRoot = await resolvePanelWorkspaceRoot(
    gitView,
    resource,
  );
  // Only auto-open a file when explicitly requested (resolveCurrentFile).
  // Git → Resolve conflict must land on the Conflicts dialog list.
  pendingOpenRelativePath = openConflictFile
    ? await resolveResourceRelativePath(
        gitView,
        resource,
        requestedWorkspaceRoot,
      )
    : null;

  let resolvedRepoId: string | null = null;
  if (requestedWorkspaceRoot) {
    resolvedRepoId = await resolveRepoIdForResource(
      gitView,
      requestedWorkspaceRoot,
      pendingOpenRelativePath ??
        (resource?.scheme === "file"
          ? path.relative(requestedWorkspaceRoot, resource.fsPath).replace(/\\/g, "/") || "."
          : "."),
    );
  }

  if (panel) {
    if (
      requestedWorkspaceRoot &&
      requestedWorkspaceRoot !== panelWorkspaceRoot
    ) {
      const stalePanel = panel;
      panel = undefined;
      panelWorkspaceRoot = null;
      panelRepoId = null;
      stalePanel.dispose();
    } else {
      panel.reveal(vscode.ViewColumn.Active);
      if (openConflictFile) {
        await openPendingConflictFile(router);
      } else if (panelRepoId) {
        await pushMergeBootstrap(router, panelRepoId);
        sendToWebview(createHostEvent("merge.showConflictList", {}));
      }
      return;
    }
  }

  panelWorkspaceRoot = requestedWorkspaceRoot;
  panelRepoId = resolvedRepoId;

  panel = vscode.window.createWebviewPanel(
    "gitView",
    "GitView",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist"),
        vscode.Uri.joinPath(context.extensionUri, "webview", "dist"),
      ],
      retainContextWhenHidden: true,
    },
  );

  let html = await getWebviewHtml(panel.webview, context.extensionUri);
  if (resolvedRepoId) {
    const bootstrap = encodeBootstrap({ repoId: resolvedRepoId });
    html = html.replace(
      `window.__GITVIEW_APP__="merge"`,
      `window.__GITVIEW_APP__="merge";window.__GITVIEW_BOOTSTRAP__=${bootstrap}`,
    );
  }
  panel.webview.html = html;

  const panelDisposables: vscode.Disposable[] = [];

  panel.webview.onDidReceiveMessage(
    (raw: unknown) => {
      void (async () => {
        const request = parseWebviewRequest(raw);
        if (
          request?.type === "webview.ready" &&
          request.payload.surface === "merge" &&
          panelRepoId
        ) {
          await router.handleRawMessage(raw);
          await pushMergeBootstrap(router, panelRepoId);
          await openPendingConflictFile(router);
          return;
        }
        await router.handleRawMessage(raw);
      })();
    },
    undefined,
    panelDisposables,
  );

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("gitView") && panel) {
      sendToWebview(
        createHostEvent("merge.settings", readGitViewSettings()),
      );
    }
  });
  panelDisposables.push(configListener);

  panel.onDidDispose(
    () => {
      panel = undefined;
      panelWorkspaceRoot = null;
      panelRepoId = null;
      openedMergePaths.clear();
      for (const disposable of panelDisposables) {
        disposable.dispose();
      }
    },
    null,
    context.subscriptions,
  );
}

export function getPanel(): vscode.WebviewPanel | undefined {
  return panel;
}
