import { useShallow } from "zustand/react/shallow";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type {
  GitWorkspaceActions,
  GitWorkspaceState,
} from "../../stores/gitWorkspaceStoreTypes";

/**
 * Shallow-compares the whole store, so a `set` that leaves every value
 * unchanged does not re-render — the same guarantee a per-field selector gives,
 * without a hand-maintained mirror of every field that silently drops new ones.
 */
export function useGitWorkspaceStoreSlice(): GitWorkspaceState & GitWorkspaceActions {
  return useGitWorkspaceStore(useShallow((state) => state));
}
