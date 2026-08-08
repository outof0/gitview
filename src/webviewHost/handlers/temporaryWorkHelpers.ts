import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createPatchApi } from "../../services/git/patch";
import { createShelfApi } from "../../services/git/shelf";
import { createStashApi } from "../../services/git/stash";
import {
  createHostError,
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../../shared/protocol";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { ShelfStorage } from "../../storage/shelfStorage";
import type { GitExecFn } from "../../services/git/types";

export { gitCommandError } from "../../util/safeLog";

export type TemporaryWorkHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  shelfStorage: ShelfStorage;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

export function createTemporaryWorkContext(deps: TemporaryWorkHandlerDeps) {
  const stash = createStashApi(deps.execGit);
  const shelf = createShelfApi(deps.execGit, deps.shelfStorage);
  const patch = createPatchApi(deps.execGit);

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

  function emitStashSnapshot(repoId: string, stashes: Awaited<ReturnType<typeof stash.listStashes>>) {
    const snapshot = {
      repoId,
      stashes,
      refreshedAt: Date.now(),
    };
    deps.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "stash.snapshot",
      payload: snapshot,
    });
    return snapshot;
  }

  function emitShelfSnapshot(repoId: string, shelves: Awaited<ReturnType<typeof shelf.listShelves>>) {
    const snapshot = {
      repoId,
      shelves,
      refreshedAt: Date.now(),
    };
    deps.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      type: "shelf.snapshot",
      payload: snapshot,
    });
    return snapshot;
  }

  return { deps, stash, shelf, patch, resolveRepo, validateRepo, emitStashSnapshot, emitShelfSnapshot };
}

export type TemporaryWorkContext = ReturnType<typeof createTemporaryWorkContext>;
