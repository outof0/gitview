import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  type HostToWebview,
} from "../../shared/protocol";
import type { ChangelistStorage } from "../../storage/changelistStorage";
import { validateRepoRelativePaths } from "../validatePaths";
import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";

export type ChangelistHandlerDeps = {
  changelistStorage: ChangelistStorage;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createChangelistHandlers(deps: ChangelistHandlerDeps) {
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

  return {
    async create(requestId: string, repoId: string, name: string) {
      const repo = await resolveRepo(repoId);
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      const lists = await deps.changelistStorage.createList(repoId, name.trim());
      await deps.refreshCoordinator.refreshNow(repoId);
      deps.postMessage(
        createHostResponse(requestId, "changelist.create", { changelists: lists }),
      );
    },

    async activate(requestId: string, repoId: string, listId: string) {
      const repo = await resolveRepo(repoId);
      const check = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!check.ok) {
        deps.postMessage(createHostError(requestId, check.error));
        return;
      }
      const lists = await deps.changelistStorage.setActive(repoId, listId);
      await deps.refreshCoordinator.refreshNow(repoId);
      deps.postMessage(
        createHostResponse(requestId, "changelist.activate", {
          changelists: lists,
        }),
      );
    },

    async moveFiles(
      requestId: string,
      repoId: string,
      listId: string,
      paths: unknown,
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
      const lists = await deps.changelistStorage.moveFiles(
        repoId,
        listId,
        validated.paths,
      );
      await deps.refreshCoordinator.refreshNow(repoId);
      deps.postMessage(
        createHostResponse(requestId, "changelist.moveFiles", {
          changelists: lists,
        }),
      );
    },
  };
}
