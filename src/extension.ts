import * as vscode from "vscode";
import { activateGitView } from "./activation";
import { openGitWorkspace } from "./commands/openGitWorkspace";
import { openGitView } from "./commands/openGitView";
import {
  gitAdd,
  gitAnnotateBlame,
  gitCheckoutBranch,
  gitCommit,
  gitCommitAndPush,
  gitCompareWithBranch,
  gitCompareWithRevision,
  gitCreateBranch,
  gitFetch,
  gitMerge,
  gitPull,
  gitPush,
  gitRebase,
  gitRollback,
  gitShelve,
  gitShowDiff,
  gitShowHistory,
  gitStash,
  gitSync,
  gitUnstage,
  gitUnshelve,
  gitUnstash,
} from "./commands/gitMenuActions";
import { registerGitMenuCommand } from "./commands/registerGitMenuCommands";
import {
  createReviewAuthService,
  promptAndStoreReviewToken,
} from "./services/review/reviewAuth";
import type { GitViewExtensionApi } from "./publicApi";

export type {
  Disposable,
  ExtensionRequestType,
  GitViewExtensionApi,
  ProtocolExtensionContext,
  ProtocolExtensionHandler,
  RefreshPayload,
  Repository,
  RepositorySnapshot,
  ReviewCreateOptions,
  ReviewDetailsSnapshot,
  ReviewFilters,
  ReviewItem,
  ReviewLineCommentOptions,
  ReviewListResult,
  ReviewProvider,
  ReviewProviderInfo,
  WebviewRequest,
} from "./publicApi";

export function activate(
  context: vscode.ExtensionContext,
): GitViewExtensionApi {
  const gitView = activateGitView(context);

  const register = (
    id: string,
    handler: Parameters<typeof vscode.commands.registerCommand>[1],
  ) => vscode.commands.registerCommand(id, handler);

  const registerGit = (
    id: string,
    handler: (
      resource: vscode.Uri | undefined,
      workspaceRoot: string | undefined,
      ...args: unknown[]
    ) => void | Promise<void>,
  ) => registerGitMenuCommand(register, id, handler);

  const reviewAuth = createReviewAuthService(context.secrets);

  context.subscriptions.push(
    register("gitView.openGit", () => openGitWorkspace(context, gitView)),
    registerGit("gitView.open", (resource) => {
      // A file-scoped Explorer/editor action opens that conflict directly.
      // Command Palette invocations have no resource and open the list first.
      const uri =
        resource ?? vscode.window.activeTextEditor?.document.uri;
      return openGitView(context, gitView, uri, {
        openConflictFile: resource?.scheme === "file",
      });
    }),
    register("gitView.refresh", () =>
      vscode.commands.executeCommand("gitView.open"),
    ),
    register("gitView.refreshGitStatus", () =>
      gitView.refreshCoordinator.refreshNow(),
    ),
    register("gitView.resolveCurrentFile", (resource?: vscode.Uri) => {
      const uri =
        resource ?? vscode.window.activeTextEditor?.document.uri;
      if (uri) {
        // Explicit: open this conflicted file in the merge resolver.
        return openGitView(context, gitView, uri, {
          openConflictFile: true,
        });
      }
      return undefined;
    }),
    register("gitView.setGithubReviewToken", () =>
      promptAndStoreReviewToken(context.secrets, "github"),
    ),
    register("gitView.setGitlabReviewToken", () =>
      promptAndStoreReviewToken(context.secrets, "gitlab"),
    ),
    register("gitView.clearGithubReviewToken", async () => {
      await reviewAuth.clearAccessToken("github");
      void vscode.window.showInformationMessage(
        "GitHub review token cleared from Secret Storage.",
      );
    }),
    register("gitView.clearGitlabReviewToken", async () => {
      await reviewAuth.clearAccessToken("gitlab");
      void vscode.window.showInformationMessage(
        "GitLab review token cleared from Secret Storage.",
      );
    }),
    registerGit("gitView.showGitHistory", (resource) =>
      gitShowHistory(context, gitView, resource),
    ),
    registerGit("gitView.gitCompareWithRevision", (resource, workspaceRoot) =>
      gitCompareWithRevision(
        context,
        resource,
        workspaceRoot,
        undefined,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitCompareWithBranch", (resource, workspaceRoot) =>
      gitCompareWithBranch(
        context,
        resource,
        workspaceRoot,
        undefined,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitShowDiff", (resource, workspaceRoot) =>
      gitShowDiff(
        context,
        resource,
        workspaceRoot,
        undefined,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitAnnotateBlame", (resource, workspaceRoot, ...args) =>
      gitAnnotateBlame(context, gitView, resource, workspaceRoot, ...args),
    ),
    registerGit("gitView.gitRollback", (resource, workspaceRoot) =>
      gitRollback(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitAdd", (resource, workspaceRoot) =>
      gitAdd(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitUnstage", (resource, workspaceRoot) =>
      gitUnstage(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitCommit", (resource, workspaceRoot) =>
      gitCommit(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitCommitAndPush", (resource, workspaceRoot) =>
      gitCommitAndPush(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitFetch", (resource, workspaceRoot) =>
      gitFetch(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitPull", (resource, workspaceRoot) =>
      gitPull(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitPush", (resource, workspaceRoot) =>
      gitPush(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitSync", (resource, workspaceRoot) =>
      gitSync(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitStash", (resource, workspaceRoot) =>
      gitStash(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitUnstash", (resource, workspaceRoot) =>
      gitUnstash(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitShelve", (resource, workspaceRoot) =>
      gitShelve(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitUnshelve", (resource, workspaceRoot) =>
      gitUnshelve(resource, workspaceRoot, gitView.commandRuntime),
    ),
    registerGit("gitView.gitMerge", (resource, workspaceRoot) =>
      gitMerge(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitRebase", (resource, workspaceRoot) =>
      gitRebase(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitCheckoutBranch", (resource, workspaceRoot) =>
      gitCheckoutBranch(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
    registerGit("gitView.gitCreateBranch", (resource, workspaceRoot) =>
      gitCreateBranch(
        resource,
        workspaceRoot,
        gitView.commandRuntime,
        gitView.gitMenuPresentation,
      ),
    ),
  );

  return {
    apiVersion: 1,
    registerReviewProvider: (provider) =>
      gitView.reviewProviderRegistry.registerProvider(provider),
    registerProtocolExtension: (handler) =>
      gitView.protocolExtensionRegistry.register(handler),
    onDidRefresh: (listener) => ({
      dispose: gitView.refreshCoordinator.subscribe(listener),
    }),
  };
}

export function deactivate() {
  // no-op
}
