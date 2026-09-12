import { useCallback } from "react";
import type { BranchEntry } from "@gitview/shared/types/branch";
import type { GitWorkspaceBranchApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";
import { useRepoRequestScope } from "./useRepoRequestScope";

export function useGitWorkspaceBranchActions(deps: GitWorkspaceDeps): GitWorkspaceBranchApi {
  const { clientRef, activeRepo, runMutation } = deps.core;
  const { begin, isCurrent } = useRepoRequestScope();
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
        if (!activeRepo) {
          return;
        }
        // Captured before the await: `catch`/`finally` run later, after the
        // user may have switched repositories. An unguarded write there
        // paints repo A's failure (or completion) onto repo B's log tab.
        const token = begin(activeRepo.id, "log");
        setLogLoading(true);
        try {
          await clientRef.current.queryLog(activeRepo.id, {
            ...logFilters,
            range: "all",
            branch: branchRef,
          });
        } catch (err) {
          if (!isCurrent(token)) {
            return;
          }
          setLogError(err instanceof Error ? err.message : "Failed to load log");
        } finally {
          if (isCurrent(token)) {
            setLogLoading(false);
          }
        }
      })();
    },
    [
      activeRepo,
      begin,
      isCurrent,
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
      // Captured before the await so a completion for a repository that is
      // no longer selected cannot release the spinner the new repository
      // just raised.
      const token = begin(activeRepo.id, "diff");
      setDiffLoading(true);
      // `applyBranchCompareSnapshot` deliberately does not clear `diffLoading`
      // (the compare snapshot and the diff document are separate surfaces), so
      // this is the only place the flag is released on the compare path.
      void runMutation(async () => {
        await clientRef.current.compareBranchWithCurrent(activeRepo.id, ref);
      }).finally(() => {
        if (isCurrent(token)) {
          setDiffLoading(false);
        }
      });
    },
    [
      activeRepo,
      begin,
      branchRefForCompare,
      isCurrent,
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
      const token = begin(activeRepo.id, "diff");
      setDiffLoading(true);
      void runMutation(async () => {
        await clientRef.current.compareBranchWithWorkingTree(activeRepo.id, ref);
      }).finally(() => {
        if (isCurrent(token)) {
          setDiffLoading(false);
        }
      });
    },
    [
      activeRepo,
      begin,
      branchRefForCompare,
      isCurrent,
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
      const token = begin(activeRepo.id, "diff");
      setDiffLoading(true);
      void runMutation(async () => {
        await clientRef.current.compareBranchFile(
          activeRepo.id,
          branchCompareSnapshot.selectedRef,
          path,
          branchCompareSnapshot.mode === "current" ? "current" : "workingTree",
        );
      }).finally(() => {
        if (isCurrent(token)) {
          setDiffLoading(false);
        }
      });
    },
    [
      activeRepo,
      begin,
      branchCompareSnapshot,
      isCurrent,
      runMutation,
      setBranchCompareSelectedFile,
      setDiffLoading,
    ],
  );
  return { handleShowBranchInLog, handleCompareWithCurrent, handleCompareWithWorkingTree, handleBranchCompareFile };
}
