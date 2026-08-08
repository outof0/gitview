import { useCallback } from "react";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { GitWorkspaceLoaderApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";

export function useGitWorkspaceLoaders(deps: GitWorkspaceDeps): GitWorkspaceLoaderApi {
  const { clientRef, activeRepo } = deps.core;
  const {
    diffStagedView,
    setBranchesLoading,
    setBranchesOpen,
    setDiffDocument,
    setDiffLoading,
    setDiffError,
    selectedFilePath,
    setBlameLoading,
    setBlameError,
    logFilters,
    setLogLoading,
    setLogError,
    selectFile,
  } = deps.store;

  const loadBranches = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    setBranchesLoading(true);
    try {
      await clientRef.current.listBranches(activeRepo.id);
    } catch (err) {
      setBranchesLoading(false);
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load branches",
      );
    }
  }, [activeRepo, setBranchesLoading]);

  const openBranches = useCallback(() => {
    setBranchesOpen(true);
    void loadBranches();
  }, [loadBranches, setBranchesOpen]);

  const loadDiff = useCallback(
    async (path: string, staged = diffStagedView) => {
      if (!activeRepo) {
        return;
      }
      setDiffLoading(true);
      setDiffError(null);
      try {
        const document = await clientRef.current.openDiff(
          activeRepo.id,
          path,
          staged,
        );
        if (document) {
          setDiffDocument(document);
        }
      } catch (err) {
        setDiffError(err instanceof Error ? err.message : "Failed to load diff");
      }
    },
    [activeRepo, diffStagedView, setDiffDocument, setDiffError, setDiffLoading],
  );

  const loadBlame = useCallback(async () => {
    if (!activeRepo || !selectedFilePath) {
      return;
    }
    setBlameLoading(true);
    setBlameError(null);
    try {
      await clientRef.current.queryBlame(activeRepo.id, selectedFilePath);
    } catch (err) {
      setBlameError(err instanceof Error ? err.message : "Failed to load blame");
    }
  }, [activeRepo, selectedFilePath, setBlameError, setBlameLoading]);

  const loadLog = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    setLogLoading(true);
    setLogError(null);
    try {
      await clientRef.current.queryLog(activeRepo.id, logFilters);
    } catch (err) {
      setLogError(err instanceof Error ? err.message : "Failed to load log");
    }
  }, [activeRepo, logFilters, setLogError, setLogLoading]);

  const loadLogFileDiff = useCallback(
    async (sha: string, path: string, status: string) => {
      if (!activeRepo) {
        return;
      }
      setDiffLoading(true);
      setDiffError(null);
      try {
        const document = await clientRef.current.logFileDiff(
          activeRepo.id,
          sha,
          path,
          status,
        );
        if (document) {
          setDiffDocument(document);
        }
      } catch (err) {
        setDiffError(err instanceof Error ? err.message : "Failed to load diff");
      }
    },
    [activeRepo, setDiffDocument, setDiffError, setDiffLoading],
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      selectFile(path);
      void loadDiff(path);
    },
    [loadDiff, selectFile],
  );
  return { loadBranches, openBranches, loadDiff, loadBlame, loadLog, loadLogFileDiff, handleSelectFile };
}
