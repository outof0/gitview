import { type WebviewToHost } from "../shared/protocol";
import { buildRepoStatusSnapshot } from "../services/statusSnapshot";
import type { MessageRouterContext } from "./messageRouterContext";
import { isWorkspaceTrusted } from "./messageRouterTrust";

export async function dispatchChanges(
  request: WebviewToHost,
  ctx: MessageRouterContext,
): Promise<boolean> {
  const { deps, mutations, statusApi } = ctx;
  switch (request.type) {
      case "changes.stage":
        await mutations.stage(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
        );
        return true;

      case "changes.unstage":
        await mutations.unstage(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
        );
        return true;

      case "changes.rollback": {
        const repos = await deps.repositoryService.discoverRepositories({
          workspaceFolders: deps.workspaceFolders,
          explicitRepoId: request.payload.repoId,
          trusted: isWorkspaceTrusted(deps),
        });
        const repo = deps.repositoryService.resolveRepositoryForResource(
          repos,
          undefined,
          request.payload.repoId,
        );
        const statusFiles = repo
          ? (
              await buildRepoStatusSnapshot(statusApi, repo.rootPath, repo.id)
            ).files
          : [];
        await mutations.rollback(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
          Boolean(request.payload.confirmed),
          statusFiles,
        );
        return true;
      }

      case "commit.create":
        await mutations.createCommit(request.requestId, request.payload);
        return true;

      case "commit.checks":
        await mutations.runCommitChecks(
          request.requestId,
          request.payload.repoId,
          request.payload.paths,
          request.payload.kinds,
        );
        return true;

      case "sync.fetch":
        await mutations.fetchRepo(request.requestId, request.payload.repoId);
        return true;

      case "sync.pull":
        await mutations.pullRepo(
          request.requestId,
          request.payload.repoId,
          request.payload.strategy,
        );
        return true;

      case "sync.push":
        await mutations.pushRepo(
          request.requestId,
          request.payload.repoId,
          {
            setUpstream: request.payload.setUpstream,
            remote: request.payload.remote,
          },
        );
        return true;

      case "sync.updateAllRoots":
        await mutations.updateAllRoots(
          request.requestId,
          request.payload.strategy,
        );
        return true;
    default:
      return false;
  }
}
