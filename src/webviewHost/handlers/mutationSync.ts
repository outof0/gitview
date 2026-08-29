import { hasUpstream, resolveDefaultRemote } from "../../services/git/upstream";
import type { RootUpdateResult } from "../../services/git/sync";
import { classifySyncFailure } from "../../services/syncOperationCoordinator";
import {
  createError,
  isGitViewStructuredError,
} from "../../shared/errors/codes";
import { createHostError, createHostResponse } from "../../shared/protocol";
import type {
  SyncFailureOutcome,
  SyncOutcome,
  SyncPhase,
  SyncProgress,
  SyncRootStatus,
} from "../../shared/types/sync";
import { isWorkspaceTrusted } from "../messageRouterTrust";
import {
  gitCommandError,
  type MutationHandlerContext,
} from "./mutationHelpers";

function syncOutcomeError(outcome: Exclude<SyncOutcome, { kind: "success" }>) {
  const code = {
    auth_required: "AUTH_REQUIRED",
    offline: "NETWORK_OFFLINE",
    certificate: "CERTIFICATE_ERROR",
    rejected: "PUSH_REJECTED",
    conflicts: "UNRESOLVED_CONFLICTS",
    no_remote: "GIT_COMMAND_FAILED",
    no_upstream: "GIT_COMMAND_FAILED",
    cancelled: "GIT_COMMAND_FAILED",
    // The mutation already landed; only the follow-up refresh failed.
    refresh_failed: "GIT_COMMAND_FAILED",
    failed: "GIT_COMMAND_FAILED",
  }[outcome.kind] as Parameters<typeof createError>[0];
  return createError(code, outcome.message, { details: { outcome } });
}

function syncCommandError(error: unknown) {
  return isGitViewStructuredError(error)
    ? error
    : createError("GIT_COMMAND_FAILED", gitCommandError(error));
}

function updateRootProgress(
  progress: SyncProgress,
  status: SyncRootStatus,
): SyncProgress {
  const roots = progress.roots.map((root) =>
    root.repoId === status.repoId ? status : root,
  );
  return {
    completed: roots.filter(
      (root) => root.state !== "pending" && root.state !== "running",
    ).length,
    total: progress.total,
    roots,
  };
}

function abortIfRequested(signal: AbortSignal): void {
  if (!signal.aborted) {
    return;
  }
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  throw error;
}

type SyncReporter = (
  phase: SyncPhase,
  progress?: SyncProgress,
  cancellable?: boolean,
) => void;

async function executeWithReconciliation<T>(
  report: SyncReporter,
  refresh: () => Promise<void>,
  execute: () => Promise<T>,
  progress?: () => SyncProgress,
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    report("reconciling", progress?.(), false);
    try {
      await refresh();
    } catch {
      throw error;
    }
    throw error;
  }
}

export function createSyncMutationHandlers(ctx: MutationHandlerContext) {
  const {
    deps,
    sync,
    discoverRepos,
    validateRepoMutation,
    refreshAfterMutation,
    preconditionError,
  } = ctx;

  return {
    async fetchRepo(requestId: string, repoId: string) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const remote = await resolveDefaultRemote(deps.execGit, repo.rootPath);
      if (!remote) {
        deps.postMessage(
          createHostError(
            requestId,
            syncOutcomeError({
              kind: "no_remote",
              message: "No Git remote is configured.",
            }),
          ),
        );
        return;
      }
      try {
        const terminal = await deps.syncOperationCoordinator.run({
          requestId,
          operation: "fetch",
          repositories: [{ repoId: repo.id, name: repo.name }],
          phase: "fetching",
          execute: async ({ signal, report }) =>
            executeWithReconciliation(
              report,
              async () => refreshAfterMutation(repo.id),
              async () => sync.fetch(repo.rootPath, remote, { signal }),
            ),
          refresh: async () => refreshAfterMutation(repo.id),
        });
        if (terminal.state === "completed") {
          deps.postMessage(
            createHostResponse(requestId, "sync.fetch", { ok: true }),
          );
          return;
        }
        deps.postMessage(
          createHostError(requestId, syncOutcomeError(terminal.outcome)),
        );
      } catch (error) {
        deps.postMessage(createHostError(requestId, syncCommandError(error)));
      }
    },

    async cancelSync(requestId: string, operationId: string) {
      deps.postMessage(
        createHostResponse(
          requestId,
          "sync.cancel",
          deps.syncOperationCoordinator.cancel(operationId),
        ),
      );
    },

    async pullRepo(
      requestId: string,
      repoId: string,
      strategy?: "merge" | "rebase" | "ff_only",
    ) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const remote = await resolveDefaultRemote(deps.execGit, repo.rootPath);
      if (!remote) {
        deps.postMessage(
          createHostError(
            requestId,
            syncOutcomeError({
              kind: "no_remote",
              message: "No Git remote is configured.",
            }),
          ),
        );
        return;
      }
      if (!(await hasUpstream(deps.execGit, repo.rootPath))) {
        deps.postMessage(
          createHostError(
            requestId,
            syncOutcomeError({
              kind: "no_upstream",
              message: "The current branch has no upstream branch.",
              branch: repo.currentBranch,
              remote,
            }),
          ),
        );
        return;
      }
      try {
        const terminal = await deps.syncOperationCoordinator.run({
          requestId,
          operation: "pull",
          repositories: [{ repoId: repo.id, name: repo.name }],
          phase: "pulling",
          execute: async ({ signal, report }) =>
            executeWithReconciliation(
              report,
              async () => refreshAfterMutation(repo.id),
              async () =>
                sync.pull(repo.rootPath, strategy ?? "merge", remote, {
                  signal,
                }),
            ),
          refresh: async () => refreshAfterMutation(repo.id),
        });
        if (terminal.state === "completed") {
          deps.postMessage(
            createHostResponse(requestId, "sync.pull", { ok: true }),
          );
          return;
        }
        deps.postMessage(
          createHostError(requestId, syncOutcomeError(terminal.outcome)),
        );
      } catch (error) {
        deps.postMessage(createHostError(requestId, syncCommandError(error)));
      }
    },

    async pushRepo(
      requestId: string,
      repoId: string,
      opts?: { setUpstream?: boolean; remote?: string },
    ) {
      const repo = await validateRepoMutation(requestId, repoId);
      if (!repo) {
        return;
      }
      const remote =
        opts?.remote ??
        (await resolveDefaultRemote(deps.execGit, repo.rootPath));
      if (!remote) {
        deps.postMessage(
          createHostError(
            requestId,
            syncOutcomeError({
              kind: "no_remote",
              message: "No Git remote is configured.",
            }),
          ),
        );
        return;
      }
      const needsUpstream = !(await hasUpstream(deps.execGit, repo.rootPath));
      if (needsUpstream && !repo.currentBranch) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "GIT_COMMAND_FAILED",
              "Create or check out a branch before setting an upstream.",
            ),
          ),
        );
        return;
      }
      if (needsUpstream && !opts?.setUpstream) {
        deps.postMessage(
          createHostResponse(requestId, "sync.push", {
            ok: false,
            upstreamRequired: true,
            branch: repo.currentBranch ?? "HEAD",
            remote,
          }),
        );
        return;
      }
      try {
        const terminal = await deps.syncOperationCoordinator.run({
          requestId,
          operation: "push",
          repositories: [{ repoId: repo.id, name: repo.name }],
          phase: "pushing",
          execute: async ({ signal, report }) =>
            executeWithReconciliation(
              report,
              async () => refreshAfterMutation(repo.id),
              async () => {
                const result = await sync.push(
                  repo.rootPath,
                  {
                    setUpstream: opts?.setUpstream ?? needsUpstream,
                    remote,
                    branch: repo.currentBranch ?? undefined,
                  },
                  { signal },
                );
                if (result.rejected) {
                  throw createError(
                    "PUSH_REJECTED",
                    result.stderr || "Push was rejected by the remote.",
                  );
                }
              },
            ),
          refresh: async () => refreshAfterMutation(repo.id),
        });
        if (terminal.state === "completed") {
          deps.postMessage(
            createHostResponse(requestId, "sync.push", { ok: true }),
          );
          return;
        }
        if (terminal.outcome.kind === "rejected") {
          deps.postMessage(
            createHostResponse(requestId, "sync.push", {
              ok: false,
              rejected: true,
              message: terminal.outcome.message,
            }),
          );
          return;
        }
        deps.postMessage(
          createHostError(requestId, syncOutcomeError(terminal.outcome)),
        );
      } catch (error) {
        deps.postMessage(createHostError(requestId, syncCommandError(error)));
      }
    },

    async updateAllRoots(
      requestId: string,
      strategy?: "merge" | "rebase" | "ff_only",
    ) {
      if (!isWorkspaceTrusted(deps)) {
        preconditionError(requestId, {
          code: "WORKSPACE_UNTRUSTED",
          message: "Git mutations are disabled in untrusted workspaces.",
        });
        return;
      }
      try {
        const repos = await discoverRepos();
        const results: RootUpdateResult[] = [];
        let progress: SyncProgress = {
          completed: 0,
          total: repos.length,
          roots: repos.map((repo) => ({
            repoId: repo.id,
            name: repo.name,
            state: "pending",
          })),
        };
        const terminal = await deps.syncOperationCoordinator.run({
          requestId,
          operation: "update_all_roots",
          repositories: repos.map((repo) => ({
            repoId: repo.id,
            name: repo.name,
          })),
          phase: "fetching",
          execute: async ({ signal, report }) =>
            executeWithReconciliation(
              report,
              async () => refreshAfterMutation(),
              async () => {
                for (const repo of repos) {
                  abortIfRequested(signal);
                  progress = updateRootProgress(progress, {
                    repoId: repo.id,
                    name: repo.name,
                    state: "running",
                    phase: "fetching",
                  });
                  report("fetching", progress, true);

                  const remote = await resolveDefaultRemote(
                    deps.execGit,
                    repo.rootPath,
                  );
                  if (!remote) {
                    const outcome: SyncFailureOutcome = {
                      kind: "no_remote",
                      message: "No Git remote is configured.",
                    };
                    results.push({
                      repoId: repo.id,
                      name: repo.name,
                      ok: false,
                      error: outcome.message,
                    });
                    progress = updateRootProgress(progress, {
                      repoId: repo.id,
                      name: repo.name,
                      state: "skipped",
                      outcome,
                    });
                    report("fetching", progress, true);
                    continue;
                  }
                  if (!(await hasUpstream(deps.execGit, repo.rootPath))) {
                    const outcome: SyncFailureOutcome = {
                      kind: "no_upstream",
                      message: "The current branch has no upstream branch.",
                      branch: repo.currentBranch,
                      remote,
                    };
                    results.push({
                      repoId: repo.id,
                      name: repo.name,
                      ok: false,
                      error: outcome.message,
                    });
                    progress = updateRootProgress(progress, {
                      repoId: repo.id,
                      name: repo.name,
                      state: "skipped",
                      outcome,
                    });
                    report("fetching", progress, true);
                    continue;
                  }

                  try {
                    await sync.fetch(repo.rootPath, remote, { signal });
                    abortIfRequested(signal);
                    progress = updateRootProgress(progress, {
                      repoId: repo.id,
                      name: repo.name,
                      state: "running",
                      phase: "pulling",
                    });
                    report("pulling", progress, true);
                    await sync.pull(
                      repo.rootPath,
                      strategy ?? "merge",
                      remote,
                      {
                        signal,
                      },
                    );
                    results.push({
                      repoId: repo.id,
                      name: repo.name,
                      ok: true,
                    });
                    progress = updateRootProgress(progress, {
                      repoId: repo.id,
                      name: repo.name,
                      state: "succeeded",
                      outcome: { kind: "success" },
                    });
                    report("pulling", progress, true);
                  } catch (error) {
                    if (signal.aborted) {
                      throw error;
                    }
                    const outcome = classifySyncFailure(error);
                    results.push({
                      repoId: repo.id,
                      name: repo.name,
                      ok: false,
                      error: outcome.message,
                    });
                    progress = updateRootProgress(progress, {
                      repoId: repo.id,
                      name: repo.name,
                      state: "failed",
                      outcome,
                    });
                    report("pulling", progress, true);
                  }
                }
              },
              () => progress,
            ),
          refresh: async () => refreshAfterMutation(),
        });
        if (terminal.state === "completed") {
          deps.postMessage(
            createHostResponse(requestId, "sync.updateAllRoots", { results }),
          );
          return;
        }
        deps.postMessage(
          createHostError(requestId, syncOutcomeError(terminal.outcome)),
        );
      } catch (error) {
        deps.postMessage(createHostError(requestId, syncCommandError(error)));
      }
    },
  };
}
