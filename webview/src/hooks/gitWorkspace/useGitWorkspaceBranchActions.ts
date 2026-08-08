import { useCallback } from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import type { GitWorkspaceBranchApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";

export function useGitWorkspaceBranchActions(deps: GitWorkspaceDeps): GitWorkspaceBranchApi {
  const { clientRef, activeRepo, runMutation } = deps.core;
  const {
    logFilters,
    branchCompareSnapshot,
    setLogFilters,
    setBranchesOpen,
    setWorkspaceTab,
    setLogLoading,
    setLogError,
    setDiffLoading,
    setBranchCompareSelectedFile,
  } = deps.store;

  const handleShowBranchInLog = useCallback(
    (branch: BranchEntry) => {
      const branchRef = branch.remote ? branch.fullName : branch.name;
      setLogFilters({ ...logFilters, range: "all", branch: branchRef });
      setBranchesOpen(false);
      setWorkspaceTab("log");
      void (async () => {
        setLogLoading(true);
        try {
          if (activeRepo) {
            await clientRef.current.queryLog(activeRepo.id, {
              ...logFilters,
              range: "all",
              branch: branchRef,
            });
          }
        } catch (err) {
          setLogError(err instanceof Error ? err.message : "Failed to load log");
        }
      })();
    },
    [
      activeRepo,
      logFilters,
      setBranchesOpen,
      setLogError,
      setLogFilters,
      setLogLoading,
      setWorkspaceTab,
    ],
  );

  const branchRefForCompare = useCallback((branch: BranchEntry) => {
    return branch.remote ? branch.fullName : branch.name;
  }, []);

  const handleCompareWithCurrent = useCallback(
    (branch: BranchEntry) => {
      if (!activeRepo) {
        return;
      }
      const ref = branchRefForCompare(branch);
      setBranchesOpen(false);
      setWorkspaceTab("changes");
      setDiffLoading(true);
      void runMutation(async () => {
        await clientRef.current.compareBranchWithCurrent(activeRepo.id, ref);
      });
    },
    [
      activeRepo,
      branchRefForCompare,
      runMutation,
      setBranchesOpen,
      setDiffLoading,
      setWorkspaceTab,
    ],
  );

  const handleCompareWithWorkingTree = useCallback(
    (branch: BranchEntry) => {
      if (!activeRepo) {
        return;
      }
      const ref = branchRefForCompare(branch);
      setBranchesOpen(false);
      setWorkspaceTab("changes");
      setDiffLoading(true);
      void runMutation(async () => {
        await clientRef.current.compareBranchWithWorkingTree(activeRepo.id, ref);
      });
    },
    [
      activeRepo,
      branchRefForCompare,
      runMutation,
      setBranchesOpen,
      setDiffLoading,
      setWorkspaceTab,
    ],
  );

  const handleBranchCompareFile = useCallback(
    (path: string) => {
      if (!activeRepo || !branchCompareSnapshot) {
        return;
      }
      setBranchCompareSelectedFile(path);
      setDiffLoading(true);
      void runMutation(async () => {
        await clientRef.current.compareBranchFile(
          activeRepo.id,
          branchCompareSnapshot.selectedRef,
          path,
          branchCompareSnapshot.mode === "current" ? "current" : "workingTree",
        );
      });
    },
    [
      activeRepo,
      branchCompareSnapshot,
      runMutation,
      setBranchCompareSelectedFile,
      setDiffLoading,
    ],
  );
  return { handleShowBranchInLog, handleCompareWithCurrent, handleCompareWithWorkingTree, handleBranchCompareFile };
}
