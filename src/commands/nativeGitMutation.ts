import type { RepositoryMutationSerializer } from "../services/repositoryMutationSerializer";
import type { SyncOperationCoordinator } from "../services/syncOperationCoordinator";

export type NativeGitMutationRunner = <T>(
  repoRoot: string,
  operation: () => Promise<T>,
) => Promise<T>;

export function createNativeGitMutationRunner(deps: {
  repositoryMutationSerializer: Pick<RepositoryMutationSerializer, "run">;
  syncOperationCoordinator: Pick<SyncOperationCoordinator, "hasActive">;
  stableRepoId: (repoRoot: string) => string;
}): NativeGitMutationRunner {
  return async <T>(repoRoot: string, operation: () => Promise<T>): Promise<T> => {
    const repoId = deps.stableRepoId(repoRoot);
    return deps.repositoryMutationSerializer.run(repoId, async () => {
      if (deps.syncOperationCoordinator.hasActive(repoId)) {
        throw new Error(
          "A synchronization operation is running for this repository. " +
            "Wait for it to finish or cancel it, then try again.",
        );
      }
      return operation();
    });
  };
}
