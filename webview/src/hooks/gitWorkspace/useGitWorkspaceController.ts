import { useGitWorkspaceStoreSlice } from "./useGitWorkspaceStoreSlice";
import { useGitWorkspaceCore } from "./useGitWorkspaceCore";
import { useGitWorkspaceLoaders } from "./useGitWorkspaceLoaders";
import { useGitWorkspaceCommitLogActions } from "./useGitWorkspaceCommitLogActions";
import { useGitWorkspaceBranchActions } from "./useGitWorkspaceBranchActions";
import { useGitWorkspaceSyncActions } from "./useGitWorkspaceSyncActions";
import { useGitWorkspaceAuxActions } from "./useGitWorkspaceAuxActions";
import { useGitWorkspaceHostSubscription } from "./useGitWorkspaceHostSubscription";
import { useGitWorkspaceTabEffects } from "./useGitWorkspaceTabEffects";

export function useGitWorkspaceController() {
  const store = useGitWorkspaceStoreSlice();
  const core = useGitWorkspaceCore(store);
  const deps = { store, core };
  const loaders = useGitWorkspaceLoaders(deps);
  const commitLog = useGitWorkspaceCommitLogActions(deps, loaders);
  const branch = useGitWorkspaceBranchActions(deps);
  const sync = useGitWorkspaceSyncActions(deps);
  const aux = useGitWorkspaceAuxActions(deps);

  useGitWorkspaceHostSubscription({
    ...deps,
    refresh: core.refresh,
    openBranches: loaders.openBranches,
  });
  useGitWorkspaceTabEffects(deps, loaders, sync, aux);

  return {
    ...store,
    ...core,
    ...loaders,
    ...commitLog,
    ...branch,
    ...sync,
    ...aux,
  };
}