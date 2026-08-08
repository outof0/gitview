import * as path from "path";
import * as vscode from "vscode";
import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createApplyNonConflictingApi } from "../../services/git/applyNonConflicting";
import { createMergeApi } from "../../services/git/merge";
import { createStagingApi } from "../../services/git/staging";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  type HostToWebview,
} from "../../shared/protocol";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import { validateRepoRelativePaths } from "../validatePaths";
import type { GitExecFn } from "../../services/git/types";
import { gitCommandError } from "../../util/safeLog";

export type ConflictHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
  onConflictsChanged?: (repoId: string) => Promise<void>;
};

export function createConflictHandlers(deps: ConflictHandlerDeps) {
  const merge = createMergeApi(deps.execGit);
  const staging = createStagingApi(deps.execGit);
  const applyNonConflicting = createApplyNonConflictingApi(deps.execGit);

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

  async function acceptSide(
    requestId: string,
    repoId: string,
    paths: unknown,
    side: "ours" | "theirs",
  ) {
    const repo = await resolveRepo(repoId);
    const check = validateMutationPreconditions({
      trusted: deps.trusted,
      repository: repo,
    });
    if (!check.ok) {
      deps.postMessage(createHostError(requestId, check.error));
      return;
    }
    if (!repo) {
      return;
    }

    const validated = validateRepoRelativePaths(repo.rootPath, paths);
    if (!validated.ok) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("INVALID_PATH", validated.message),
        ),
      );
      return;
    }

    try {
      for (const filePath of validated.paths) {
        if (side === "ours") {
          await merge.checkoutOurs(repo.rootPath, filePath);
        } else {
          await merge.checkoutTheirs(repo.rootPath, filePath);
        }
        await staging.stageFiles(repo.rootPath, [filePath]);
      }
      await deps.refreshCoordinator.refreshNow(repo.id);
      await deps.onConflictsChanged?.(repo.id);
      if (side === "ours") {
        const payload = { paths: validated.paths, side: "ours" as const };
        deps.postMessage(
          createHostResponse(requestId, "conflict.acceptLocal", payload),
        );
      } else {
        const payload = { paths: validated.paths, side: "theirs" as const };
        deps.postMessage(
          createHostResponse(requestId, "conflict.acceptIncoming", payload),
        );
      }
    } catch (err) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("GIT_COMMAND_FAILED", gitCommandError(err)),
        ),
      );
    }
  }

  return {
    acceptLocal(requestId: string, repoId: string, paths: unknown) {
      return acceptSide(requestId, repoId, paths, "ours");
    },
    acceptIncoming(requestId: string, repoId: string, paths: unknown) {
      return acceptSide(requestId, repoId, paths, "theirs");
    },

    async applyNonConflictingFiles(requestId: string, repoId: string) {
      const repo = await resolveRepo(repoId);
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      if (!repo) {
        return;
      }

      try {
        const result = await applyNonConflicting.applyNonConflicting(
          repo.rootPath,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        await deps.onConflictsChanged?.(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "conflict.applyNonConflicting", result),
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

    async openMerge(requestId: string, repoId: string, filePath: unknown) {
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

      const validated = validateRepoRelativePaths(repo.rootPath, [filePath]);
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      const relativePath = validated.paths[0]!;
      const uri = vscode.Uri.file(path.join(repo.rootPath, relativePath));

      try {
        await vscode.commands.executeCommand("gitView.open", uri);
        deps.postMessage(
          createHostResponse(requestId, "conflict.openMerge", {
            path: relativePath,
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
