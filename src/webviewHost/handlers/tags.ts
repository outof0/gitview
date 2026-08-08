import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createTagApi } from "../../services/git/tag";
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
import { gitCommandError } from "../../util/safeLog";


export type TagHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  protectionService: ProtectionService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createTagHandlers(deps: TagHandlerDeps) {
  const tags = createTagApi(deps.execGit);

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

  async function emitTagSnapshot(repo: { id: string; rootPath: string }) {
    const entries = await tags.listTagEntries(repo.rootPath, repo.id);
    const snapshot = {
      repoId: repo.id,
      tags: entries,
      refreshedAt: Date.now(),
    };
    deps.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "tag.snapshot",
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
      const snapshot = await emitTagSnapshot(repo);
      deps.postMessage(createHostResponse(requestId, "tag.list", snapshot));
    },

    async createAnnotated(
      requestId: string,
      repoId: string,
      name: string,
      message?: string,
      sha?: string,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      if (!name.trim()) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Tag name is required."),
          ),
        );
        return;
      }
      try {
        await tags.createAnnotated(
          repo.rootPath,
          name.trim(),
          message,
          sha,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        const snapshot = await emitTagSnapshot(repo);
        deps.postMessage(
          createHostResponse(requestId, "tag.createAnnotated", {
            name: name.trim(),
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

    async checkout(requestId: string, repoId: string, name: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await tags.checkout(repo.rootPath, name.trim());
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "tag.checkout", { name: name.trim() }),
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

    async push(
      requestId: string,
      repoId: string,
      name: string,
      remote?: string,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await tags.push(repo.rootPath, name.trim(), remote ?? "origin");
        deps.postMessage(
          createHostResponse(requestId, "tag.push", { name: name.trim() }),
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

    async delete(requestId: string, repoId: string, name: string) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      try {
        await tags.deleteTag(repo.rootPath, name.trim());
        const snapshot = await emitTagSnapshot(repo);
        deps.postMessage(
          createHostResponse(requestId, "tag.delete", {
            name: name.trim(),
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
  };
}
