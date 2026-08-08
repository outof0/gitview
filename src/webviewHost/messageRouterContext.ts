import { createStatusApi } from "../services/git/status";
import type { BlameCacheEntry } from "../services/git/types";
import { createBlameHandlers } from "./handlers/blame";
import { createBranchHandlers } from "./handlers/branches";
import { createChangelistHandlers } from "./handlers/changelists";
import { createConflictHandlers } from "./handlers/conflicts";
import { createMergeHandlers } from "./handlers/merge";
import { createDiffHandlers } from "./handlers/diff";
import { createDiffHunkHandlers } from "./handlers/diffHunk";
import { createLogHandlers } from "./handlers/log";
import { createMutationHandlers } from "./handlers/mutations";
import { createRebaseHandlers } from "./handlers/rebase";
import { createTagHandlers } from "./handlers/tags";
import { createTemporaryWorkHandlers } from "./handlers/temporaryWork";
import { createWorktreeHandlers } from "./handlers/worktrees";
import { createReviewHandlers } from "./handlers/review";
import { createOperationRecoveryHandlers } from "./handlers/operationRecovery";
import type { MessageRouterDeps } from "./messageRouterTypes";
import { withLiveTrustedField } from "./messageRouterTrust";

export type MessageRouterContext = {
  deps: MessageRouterDeps;
  statusApi: ReturnType<typeof createStatusApi>;
  mutations: ReturnType<typeof createMutationHandlers>;
  branches: ReturnType<typeof createBranchHandlers>;
  changelists: ReturnType<typeof createChangelistHandlers> | null;
  diff: ReturnType<typeof createDiffHandlers>;
  diffHunk: ReturnType<typeof createDiffHunkHandlers>;
  logHandlers: ReturnType<typeof createLogHandlers>;
  rebaseHandlers: ReturnType<typeof createRebaseHandlers>;
  blameHandlers: ReturnType<typeof createBlameHandlers>;
  conflictHandlers: ReturnType<typeof createConflictHandlers>;
  mergeHandlers: ReturnType<typeof createMergeHandlers> | null;
  temporaryWork: ReturnType<typeof createTemporaryWorkHandlers> | null;
  tagHandlers: ReturnType<typeof createTagHandlers>;
  worktreeHandlers: ReturnType<typeof createWorktreeHandlers>;
  reviewHandlers: ReturnType<typeof createReviewHandlers>;
  operationRecovery: ReturnType<typeof createOperationRecoveryHandlers>;
};

export function createMessageRouterContext(
  deps: MessageRouterDeps,
  blameCache: Map<string, BlameCacheEntry> =
    deps.blameCache ?? new Map<string, BlameCacheEntry>(),
): MessageRouterContext {
  const live = withLiveTrustedField(deps, deps);
  const statusApi = createStatusApi(live.execGit);
  const mutations = createMutationHandlers(live);
  const branches = createBranchHandlers(
    withLiveTrustedField(
      {
        ...live,
        branchFavoriteStorage: live.branchFavoriteStorage,
      },
      deps,
    ),
  );
  const changelists = live.changelistStorage
    ? createChangelistHandlers(
        withLiveTrustedField(
          {
            changelistStorage: live.changelistStorage,
            repositoryService: live.repositoryService,
            refreshCoordinator: live.refreshCoordinator,
            workspaceFolders: live.workspaceFolders,
            postMessage: live.postMessage,
          },
          deps,
        ),
      )
    : null;
  const diff = createDiffHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        changelistStorage: live.changelistStorage,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
        getCrlfWarningsEnabled: live.getCrlfWarningsEnabled,
      },
      deps,
    ),
  );
  const diffHunk = createDiffHunkHandlers(live);
  const logHandlers = createLogHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        protectionService: live.protectionService,
        refreshCoordinator: live.refreshCoordinator,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
        getConfirmDestructiveActions: live.getConfirmDestructiveActions,
      },
      deps,
    ),
  );
  const rebaseHandlers = createRebaseHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        refreshCoordinator: live.refreshCoordinator,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
      },
      deps,
    ),
  );
  const blameHandlers = createBlameHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        blameCache,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
      },
      deps,
    ),
  );
  const mergeHandlers = live.mergePanel
    ? createMergeHandlers(
        withLiveTrustedField(
          { ...live, mergePanel: live.mergePanel },
          deps,
        ),
      )
    : null;
  const conflictHandlers = createConflictHandlers(
    withLiveTrustedField(
      {
        ...live,
        onConflictsChanged: mergeHandlers
          ? (repoId: string) => mergeHandlers.pushConflictSnapshot(repoId)
          : undefined,
      },
      deps,
    ),
  );
  const temporaryWork = live.shelfStorage
    ? createTemporaryWorkHandlers(
        withLiveTrustedField(
          {
            execGit: live.execGit,
            repositoryService: live.repositoryService,
            refreshCoordinator: live.refreshCoordinator,
            shelfStorage: live.shelfStorage,
            workspaceFolders: live.workspaceFolders,
            postMessage: live.postMessage,
          },
          deps,
        ),
      )
    : null;
  const tagHandlers = createTagHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        protectionService: live.protectionService,
        refreshCoordinator: live.refreshCoordinator,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
      },
      deps,
    ),
  );
  const worktreeHandlers = createWorktreeHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        protectionService: live.protectionService,
        refreshCoordinator: live.refreshCoordinator,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
      },
      deps,
    ),
  );
  const reviewHandlers = createReviewHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        refreshCoordinator: live.refreshCoordinator,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
        getReviewAccessToken: live.getReviewAccessToken,
        getGithubApiBaseUrl: live.getGithubApiBaseUrl,
        getGitlabApiBaseUrl: live.getGitlabApiBaseUrl,
        reviewFetchFn: live.reviewFetchFn,
        reviewProviderRegistry: live.reviewProviderRegistry,
      },
      deps,
    ),
  );
  const operationRecovery = createOperationRecoveryHandlers(
    withLiveTrustedField(
      {
        execGit: live.execGit,
        repositoryService: live.repositoryService,
        refreshCoordinator: live.refreshCoordinator,
        workspaceFolders: live.workspaceFolders,
        postMessage: live.postMessage,
      },
      deps,
    ),
  );

  return {
    deps: live,
    statusApi,
    mutations,
    branches,
    changelists,
    diff,
    diffHunk,
    logHandlers,
    rebaseHandlers,
    blameHandlers,
    conflictHandlers,
    mergeHandlers,
    temporaryWork,
    tagHandlers,
    worktreeHandlers,
    reviewHandlers,
    operationRecovery,
  };
}
