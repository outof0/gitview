import * as path from "node:path";
import * as vscode from "vscode";
import type { GitViewContext } from "../application/gitViewContext";
import { runGitMenuAction } from "../commands/gitMenuActions";
import { readConfirmDestructiveActions } from "../config/readConfirmDestructiveActions";
import { createRepoApi } from "../services/git/repo";
import {
  createHostEvent,
  type HostToWebview,
} from "../shared/protocol";
import type { HistoryInitPayload } from "../shared/types/history";
import { createReviewAuthService } from "../services/review/reviewAuth";
import { createMessageRouter } from "../webviewHost/messageRouter";
import { resolveLegacyWorkspaceRoot } from "./resolveLegacyWorkspaceRoot";

function workspaceFolders(): Array<{ uriPath: string; name: string }> {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
    uriPath: f.uri.fsPath,
    name: f.name,
  }));
}

export async function resolveRepoIdForResource(
  gitView: GitViewContext,
  workspaceRoot: string,
  relativePath: string,
): Promise<string | null> {
  const folders = workspaceFolders();
  const repos = await gitView.repositoryService.discoverRepositories({
    workspaceFolders: folders.length > 0 ? folders : [{ uriPath: workspaceRoot, name: "repo" }],
    trusted: vscode.workspace.isTrusted,
  });
  const resourcePath =
    !relativePath || relativePath === "."
      ? workspaceRoot
      : path.join(workspaceRoot, relativePath);
  const repo = gitView.repositoryService.resolveRepositoryForResource(
    repos,
    resourcePath,
  );
  return repo?.id ?? null;
}

export async function buildHistoryInitPayload(
  gitView: GitViewContext,
  repoId: string,
  target: { path: string; isFolder: boolean },
): Promise<HistoryInitPayload | null> {
  const repos = await gitView.repositoryService.discoverRepositories({
    workspaceFolders: workspaceFolders(),
    explicitRepoId: repoId,
    trusted: vscode.workspace.isTrusted,
  });
  const repo = gitView.repositoryService.resolveRepositoryForResource(
    repos,
    undefined,
    repoId,
  );
  if (!repo) {
    return null;
  }
  const repoApi = createRepoApi(gitView.gitService.execGit);
  const branches = await repoApi.listBranches(repo.rootPath);
  return {
    path: target.path,
    isFolder: target.isFolder,
    repoId: repo.id,
    branches,
    currentBranch: repo.currentBranch ?? branches[0] ?? "HEAD",
  };
}

export type GitViewPanelRouterOptions = {
  /**
   * When set (e.g. Git Compare webview), Compare/Show Diff actions update this
   * surface instead of always opening a brand-new diff tab.
   */
  postDiffPreview?: (preview: {
    relativePath: string;
    title: string;
    diff: import("../types/blame").FileDiffView;
  }) => void | Promise<void>;
};

export function createGitViewPanelRouter(
  context: vscode.ExtensionContext,
  gitView: GitViewContext,
  postMessage: (message: HostToWebview) => void,
  workspaceRoot?: string,
  options?: GitViewPanelRouterOptions,
) {
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
    postMessage,
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
    onGitMenuAction: async (payload) => {
      const root =
        workspaceRoot ??
        (await resolveLegacyWorkspaceRoot(gitView, payload.repoId));
      await runGitMenuAction(
        context,
        payload,
        root,
        options?.postDiffPreview,
        gitView,
      );
    },
  });
}

export function postHistoryInit(
  postMessage: (message: HostToWebview) => void,
  payload: HistoryInitPayload,
): void {
  postMessage(createHostEvent("history.init", payload));
}
