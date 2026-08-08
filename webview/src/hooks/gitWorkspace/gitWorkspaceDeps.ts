import type { useGitWorkspaceStoreSlice } from "./useGitWorkspaceStoreSlice";
import type { useGitWorkspaceCore } from "./useGitWorkspaceCore";

export type GitWorkspaceDeps = {
  store: ReturnType<typeof useGitWorkspaceStoreSlice>;
  core: ReturnType<typeof useGitWorkspaceCore>;
};
