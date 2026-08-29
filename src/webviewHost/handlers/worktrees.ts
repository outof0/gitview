import * as path from "path";
import * as vscode from "vscode";
import {
  requireDirtyWorktreeRemovalConfirmation,
  validateMutationPreconditions,
} from "../../application/mutationPreconditions";
import { createWorktreeApi } from "../../services/git/worktree";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../../shared/protocol";
import type { ProtectionService } from "../../services/protectionService";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import type { ConfirmationSubmission } from "../../shared/types/confirmation";
import { gitCommandError } from "../../util/safeLog";

export type WorktreeHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createWorktreeHandlers(deps: WorktreeHandlerDeps) {
  const worktrees = createWorktreeApi(deps.execGit);

  async function resolveRepo(repoId: string) {
    const repos = await deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId: repoId,
      trusted: deps.trusted,
    });
    return deps.repositoryService.resolveRepositoryForResource(
      repos,
      undefined,
      repoId,
    );
  }

  async function validateRepo(requestId: string, repoId: string) {
    const repo = await resolveRepo(repoId);
    const check = validateMutationPreconditions({
      trusted: deps.trusted,
      repository: repo,
    });
    if (!check.ok) {
      deps.postMessage(createHostError(requestId, check.error));
      return null;
    }
    return check.repository;
  }

  async function emitWorktreeSnapshot(repo: { id: string; rootPath: string }) {
    const entries = await worktrees.listWorktrees(repo.rootPath, repo.rootPath);
    const snapshot = {
      repoId: repo.id,
      worktrees: entries,
      refreshedAt: Date.now(),
    };
    deps.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "worktree.snapshot",
      payload: snapshot,
    });
    return snapshot;
  }

  return {
    async list(requestId: string, repoId: string) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }
      const snapshot = await emitWorktreeSnapshot(repo);
      deps.postMessage(
        createHostResponse(requestId, "worktree.list", snapshot),
      );
    },

    async add(
      requestId: string,
      repoId: string,
      worktreePath: string,
      opts?: { branch?: string; newBranch?: string },
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      if (!worktreePath.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Worktree path is required."),
          ),
        );
        return;
      }
      try {
        await worktrees.addWorktree(repo.rootPath, worktreePath.trim(), opts);
        const snapshot = await emitWorktreeSnapshot(repo);
        deps.postMessage(
          createHostResponse(requestId, "worktree.add", {
            path: worktreePath.trim(),
            snapshot,
          }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async remove(
      requestId: string,
      repoId: string,
      worktreePath: string,
      confirmation?: ConfirmationSubmission,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const requestedPath = worktreePath;
      if (!requestedPath.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Worktree path is required."),
          ),
        );
        return;
      }

      try {
        const target = await worktrees.resolveWorktreeRemovalTarget(
          repo.rootPath,
          requestedPath,
          repo.rootPath,
        );
        if (!target) {
          deps.postMessage(
            createHostError(
              requestId,
              createError(
                "INVALID_PATH",
                "Path is not a worktree of this repository.",
              ),
            ),
          );
          return;
        }
        if (target.isMain) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("INVALID_REQUEST", "The main worktree cannot be removed."),
            ),
          );
          return;
        }

        if (target.dirty) {
          const protectedCheck = deps.protectionService.checkDestructiveAction(
            target.branch,
            "worktree_delete_dirty",
          );
          if (!protectedCheck.allowed) {
            deps.postMessage(
              createHostError(
                requestId,
                createError("PROTECTED_BRANCH", protectedCheck.reason),
              ),
            );
            return;
          }
        }

        if (target.dirty || confirmation) {
          const confirmationCheck = requireDirtyWorktreeRemovalConfirmation(
            repo,
            {
              path: target.path,
              headSha: target.headSha,
              branch: target.branch,
              dirty: target.dirty,
            },
            confirmation,
          );
          if (!confirmationCheck.ok) {
            deps.postMessage(createHostError(requestId, confirmationCheck.error));
            return;
          }
        }

        await worktrees.removeWorktree(repo.rootPath, target.path, target.dirty);
        const snapshot = await emitWorktreeSnapshot(repo);
        deps.postMessage(
          createHostResponse(requestId, "worktree.remove", {
            path: target.path,
            snapshot,
          }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async open(requestId: string, repoId: string, worktreePath: string) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }
      const requested = worktreePath.trim();
      // Opening a folder is the one action here that escapes the repository, so
      // the target must be a worktree git itself reports — never a raw path.
      const known = await worktrees.listWorktrees(repo.rootPath, repo.rootPath);
      const target = path.resolve(requested);
      if (!known.some((entry) => path.resolve(entry.path) === target)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_PATH",
              "Path is not a worktree of this repository.",
            ),
          ),
        );
        return;
      }
      try {
        const uri = vscode.Uri.file(requested);
        await vscode.commands.executeCommand("vscode.openFolder", uri, {
          forceNewWindow: true,
        });
        deps.postMessage(
          createHostResponse(requestId, "worktree.open", {
            path: worktreePath.trim(),
          }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "GIT_COMMAND_FAILED",
              err instanceof Error ? err.message : String(err),
            ),
          ),
        );
      }
    },
  };
}
