import * as vscode from "vscode";
import { createCommitCheckService } from "./services/commitCheckService";
import {
  createConfigurableGitRunner,
  createGitService,
} from "./services/gitService";
import { createRepositoryService } from "./services/repositoryService";
import { createProtectionService } from "./services/protectionService";
import { createRefreshCoordinator } from "./services/watchers/refreshCoordinator";
import { createBranchFavoriteStorage } from "./storage/branchFavoriteStorage";
import { createChangelistStorage } from "./storage/changelistStorage";
import { createShelfStorage } from "./storage/shelfStorage";
import { createGitSubmenuContextService } from "./commands/gitSubmenuContext";
import type { GitCommandRuntime } from "./commands/gitMenuActionsHelpers";
import type { GitViewContext } from "./application/gitViewContext";
import { registerGitWorkspaceViewProvider } from "./webview/GitWorkspaceViewProvider";
import { createGitMenuPresentation } from "./webview/gitMenuPresentationAdapter";
import { subscribeToGitRepositoryChanges } from "./util/vscodeGit";
import { createReviewAuthService } from "./services/review/reviewAuth";
import { createReviewProviderRegistry } from "./services/review/providerRegistry";
import { createProtocolExtensionRegistry } from "./webviewHost/protocolExtensionRegistry";
import type { BlameCacheEntry } from "./services/git/types";
import { readGitWorkspaceSettings } from "./config/readGitWorkspaceSettings";
import { createOutputChannelLogger } from "./observability/vscodeLogger";
import {
  errorLogFields,
  isLogLevelSetting,
  withMinimumLevel,
  type LogLevelSetting,
} from "./observability/logger";

function readLogLevel(): LogLevelSetting {
  const value = vscode.workspace
    .getConfiguration("gitView")
    .get<string>("logLevel", "info");
  return isLogLevelSetting(value) ? value : "info";
}

function readGitExecutablePath(): string | null {
  const configured = vscode.workspace
    .getConfiguration("gitView")
    .get<string | null>("gitExecutablePath");
  if (typeof configured !== "string") {
    return null;
  }
  const trimmed = configured.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type { GitViewContext } from "./application/gitViewContext";

const DEFAULT_PROTECTED_PATTERNS = [
  "main",
  "master",
  "release/*",
  "hotfix/*",
  "production",
];

function readProtectedBranchPatterns(): string[] {
  const config = vscode.workspace.getConfiguration("gitView");
  const patterns = config.get<string[]>("protectedBranchPatterns");
  return Array.isArray(patterns) && patterns.length > 0
    ? patterns
    : DEFAULT_PROTECTED_PATTERNS;
}

function readUpdateStrategy(): "merge" | "rebase" | "ff_only" {
  const value = vscode.workspace
    .getConfiguration("gitView")
    .get<string>("updateStrategy", "merge");
  return value === "rebase" || value === "ff_only" ? value : "merge";
}

function readGpgSigningDefault(): boolean {
  return vscode.workspace
    .getConfiguration("gitView")
    .get<boolean>("gpgSigningDefault", false);
}

function workspaceFolders(): Array<{ uriPath: string; name: string }> {
  return (vscode.workspace.workspaceFolders ?? []).map((f) => ({
    uriPath: f.uri.fsPath,
    name: f.name,
  }));
}

export function activateGitView(
  context: vscode.ExtensionContext,
): GitViewContext {
  const outputChannel = vscode.window.createOutputChannel("GitView");
  const logger = withMinimumLevel(
    createOutputChannelLogger(outputChannel),
    readLogLevel,
  );
  logger.info("extension.activation.started");

  const gitRunner = createConfigurableGitRunner(readGitExecutablePath(), logger);
  const blameCache = new Map<string, BlameCacheEntry>();
  const git = createGitService({ execGit: gitRunner.execGit, blameCache });
  const protectionService = createProtectionService(readProtectedBranchPatterns());
  const repositoryService = createRepositoryService({
    execGit: git.execGit,
    logger,
    isProtectedBranch: (branch) => protectionService.isProtectedBranch(branch),
  });
  const changelistStorage = createChangelistStorage(context);
  const branchFavoriteStorage = createBranchFavoriteStorage(context);
  const shelfStorage = createShelfStorage();
  const commitCheckService = createCommitCheckService();
  const reviewAuth = createReviewAuthService(context.secrets);
  const reviewProviderRegistry = createReviewProviderRegistry({
    execGit: git.execGit,
    logger,
    getAccessToken: (providerId) => reviewAuth.getAccessToken(providerId),
    getGithubApiBaseUrl: () =>
      vscode.workspace
        .getConfiguration("gitView")
        .get<string>("githubApiBaseUrl", "https://api.github.com") ?? "",
    getGitlabApiBaseUrl: () =>
      vscode.workspace
        .getConfiguration("gitView")
        .get<string>("gitlabApiBaseUrl", "https://gitlab.com/api/v4") ?? "",
  });
  const protocolExtensionRegistry = createProtocolExtensionRegistry({ logger });

  const refreshCoordinator = createRefreshCoordinator({
    execGit: git.execGit,
    logger,
    repositoryService,
    changelistStorage,
    getWorkspaceFolders: workspaceFolders,
    getTrusted: () => vscode.workspace.isTrusted,
    getSettings: readGitWorkspaceSettings,
  });
  const commandRuntime: GitCommandRuntime = {
    gitService: git,
    shelfStorage,
    refresh: () => refreshCoordinator.refreshNow(),
    getUpdateStrategy: readUpdateStrategy,
    getGpgSigningDefault: readGpgSigningDefault,
  };

  const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
    let refreshRequired = false;
    if (e.affectsConfiguration("gitView.protectedBranchPatterns")) {
      // Mutate in place so routers holding gitView.protectionService stay current.
      protectionService.updatePatterns(readProtectedBranchPatterns());
      refreshRequired = true;
    }
    if (e.affectsConfiguration("gitView.gitExecutablePath")) {
      gitRunner.setExecutable(readGitExecutablePath());
      repositoryService.invalidateTopology();
      refreshRequired = true;
    }
    if (e.affectsConfiguration("gitView")) {
      refreshRequired = true;
    }
    if (refreshRequired) {
      refreshCoordinator.scheduleRefresh();
    }
  });

  const trustListener = vscode.workspace.onDidGrantWorkspaceTrust(() => {
    void refreshCoordinator.refreshNow().catch((error) => {
      logger.error("refresh.trust-change.failed", errorLogFields(error));
    });
  });

  const scheduleRefresh = () => {
    if (vscode.workspace.isTrusted) {
      refreshCoordinator.scheduleRefresh();
    }
  };
  const saveListener = vscode.workspace.onDidSaveTextDocument(scheduleRefresh);
  const createListener = vscode.workspace.onDidCreateFiles(scheduleRefresh);
  const deleteListener = vscode.workspace.onDidDeleteFiles(scheduleRefresh);
  const renameListener = vscode.workspace.onDidRenameFiles(scheduleRefresh);
  let gitChangeSubscription: vscode.Disposable | undefined;
  let disposed = false;
  const scheduleTopologyRefresh = () => {
    repositoryService.invalidateTopology();
    scheduleRefresh();
  };
  void subscribeToGitRepositoryChanges(
    scheduleRefresh,
    scheduleTopologyRefresh,
  )
    .then((subscription) => {
      if (disposed) {
        subscription.dispose();
        return;
      }
      gitChangeSubscription = subscription;
    })
    .catch((error) => {
      logger.warn("git.scm-subscription.failed", errorLogFields(error));
    });

  // Blame is keyed by ref, so only a moved HEAD can make a cached entry wrong.
  const headShaByRepoId = new Map<string, string | null>();
  const unsubscribeBlameInvalidation = refreshCoordinator.subscribe(
    ({ repoSnapshot }) => {
      const moved = repoSnapshot.repositories.some(
        (repo) =>
          headShaByRepoId.has(repo.id) &&
          headShaByRepoId.get(repo.id) !== repo.headSha,
      );
      headShaByRepoId.clear();
      for (const repo of repoSnapshot.repositories) {
        headShaByRepoId.set(repo.id, repo.headSha);
      }
      if (moved) {
        git.clearBlameCache();
      }
    },
  );

  const folderListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    repositoryService.invalidateTopology();
    void refreshCoordinator.refreshNow().catch((error) => {
      logger.error("refresh.workspace-folders.failed", errorLogFields(error));
    });
  });

  let gitView!: GitViewContext;
  const gitMenuPresentation = createGitMenuPresentation(context, () => gitView);
  gitView = {
    logger,
    gitService: git,
    repositoryService,
    protectionService,
    refreshCoordinator,
    changelistStorage,
    branchFavoriteStorage,
    shelfStorage,
    commitCheckService,
    commandRuntime,
    gitMenuPresentation,
    reviewProviderRegistry,
    protocolExtensionRegistry,
    blameCache,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      configListener.dispose();
      trustListener.dispose();
      saveListener.dispose();
      createListener.dispose();
      deleteListener.dispose();
      renameListener.dispose();
      gitChangeSubscription?.dispose();
      folderListener.dispose();
      unsubscribeBlameInvalidation();
      refreshCoordinator.dispose();
      logger.info("extension.activation.disposed");
      outputChannel.dispose();
    },
  };

  const gitSubmenuContext = createGitSubmenuContextService({
    execGit: git.execGit,
    shelfStorage,
    subscribeRefresh: refreshCoordinator.subscribe,
  });
  context.subscriptions.push({ dispose: () => gitSubmenuContext.dispose() });

  registerGitWorkspaceViewProvider(context, gitView);

  // Folders arriving later are covered by folderListener, so no startup poll.
  if (vscode.workspace.isTrusted) {
    void refreshCoordinator.refreshNow().catch((error) => {
      logger.error("extension.bootstrap.failed", errorLogFields(error));
    });
  }

  logger.info("extension.activation.completed");
  context.subscriptions.push({ dispose: () => gitView.dispose() });

  return gitView;
}
