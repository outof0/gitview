import { useCallback, useRef } from "react";
import type { WorkspaceDiffDocument } from "@gitview/shared/types/diff";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import type { GitWorkspaceLoaderApi } from "../../apps/gitWorkspace/gitWorkspaceControllerTypes";
import type { GitWorkspaceDeps } from "./gitWorkspaceDeps";
import { useRepoRequestScope } from "./useRepoRequestScope";
import { captureRepoToken, isRepoTokenCurrent } from "./repoScope";

export function useGitWorkspaceLoaders(deps: GitWorkspaceDeps): GitWorkspaceLoaderApi {
  const { clientRef, activeRepo } = deps.core;
  const { begin, isCurrent } = useRepoRequestScope();
  const {
    diffStagedView,
    setBranchesLoading,
    setBranchesOpen,
    setDiffDocument,
    setDiffLoading,
    setDiffError,
    setLogLoading,
    setLogError,
    selectFile,
  } = deps.store;

  // Every loader below clears its own loading flag in `finally`. The host also
  // clears it by pushing a snapshot (`applyBranchSnapshot`, `applyLogSnapshot`,
  // …), so this looks redundant — it is not. If the push is dropped, arrives
  // before the request settles, or its guard stops matching because the payload
  // shape changed, the `finally` is the only thing standing between the user and
  // a spinner that never stops.
  const loadBranches = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const token = begin(activeRepo.id, "branches");
    setBranchesLoading(true);
    try {
      await clientRef.current.listBranches(activeRepo.id);
    } catch (err) {
      if (!isCurrent(token)) {
        return;
      }
      useGitWorkspaceStore.getState().setError(
        err instanceof Error ? err.message : "Failed to load branches",
      );
    } finally {
      if (isCurrent(token)) {
        setBranchesLoading(false);
      }
    }
  }, [activeRepo, begin, isCurrent, setBranchesLoading]);

  const openBranches = useCallback(() => {
    setBranchesOpen(true);
    void loadBranches();
  }, [loadBranches, setBranchesOpen]);

  const diffRequestRef = useRef(0);
  const logDiffCacheRef = useRef(new Map<string, WorkspaceDiffDocument>());

  const loadDiff = useCallback(
    async (path: string, staged = diffStagedView) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      const isRequestRepoActive = () => isRepoTokenCurrent(requestToken);
      const generation = diffRequestRef.current + 1;
      diffRequestRef.current = generation;
      setDiffLoading(true);
      setDiffError(null);
      try {
        const document = await clientRef.current.openDiff(
          activeRepo.id,
          path,
          staged,
        );
        if (diffRequestRef.current !== generation) {
          return;
        }
        if (document) {
          setDiffDocument(document);
        }
      } catch (err) {
        if (diffRequestRef.current !== generation) {
          return;
        }
        if (!isRequestRepoActive()) {
          return;
        }
        setDiffError(err instanceof Error ? err.message : "Failed to load diff");
      } finally {
        if (
          diffRequestRef.current === generation &&
          isRequestRepoActive()
        ) {
          setDiffLoading(false);
        }
      }
    },
    [activeRepo, diffStagedView, setDiffDocument, setDiffError, setDiffLoading],
  );

  const loadLog = useCallback(async () => {
    if (!activeRepo) {
      return;
    }
    const token = begin(activeRepo.id, "log");
    const filters = useGitWorkspaceStore.getState().logFilters;
    setLogLoading(true);
    setLogError(null);
    try {
      await clientRef.current.queryLog(activeRepo.id, filters);
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
  }, [activeRepo, begin, isCurrent, setLogError, setLogLoading]);

  const loadLogFileDiff = useCallback(
    async (sha: string, path: string, status: string) => {
      if (!activeRepo) {
        return;
      }
      const requestToken = captureRepoToken(activeRepo.id);
      const isRequestRepoActive = () => isRepoTokenCurrent(requestToken);
      const generation = diffRequestRef.current + 1;
      diffRequestRef.current = generation;
      setDiffError(null);
      setDiffDocument(null);
      const cacheKey = `${activeRepo.id}\u0000${sha}\u0000${status}\u0000${path}`;
      const cached = logDiffCacheRef.current.get(cacheKey);
      if (cached) {
        logDiffCacheRef.current.delete(cacheKey);
        logDiffCacheRef.current.set(cacheKey, cached);
        setDiffDocument(cached);
        setDiffLoading(false);
        return;
      }
      setDiffLoading(true);
      try {
        const document = await clientRef.current.logFileDiff(
          activeRepo.id,
          sha,
          path,
          status,
        );
        if (diffRequestRef.current !== generation) {
          return;
        }
        if (document) {
          logDiffCacheRef.current.set(cacheKey, document);
          if (logDiffCacheRef.current.size > 64) {
            const oldest = logDiffCacheRef.current.keys().next().value;
            if (oldest !== undefined) {
              logDiffCacheRef.current.delete(oldest);
            }
          }
          setDiffDocument(document);
        }
      } catch (err) {
        if (diffRequestRef.current !== generation) {
          return;
        }
        if (!isRequestRepoActive()) {
          return;
        }
        setDiffError(err instanceof Error ? err.message : "Failed to load diff");
      } finally {
        if (
          diffRequestRef.current === generation &&
          isRequestRepoActive()
        ) {
          setDiffLoading(false);
        }
      }
    },
    [activeRepo, setDiffDocument, setDiffError, setDiffLoading],
  );

  const handleSelectFile = useCallback(
    (path: string) => {
      diffRequestRef.current += 1;
      selectFile(path);
      setDiffDocument(null);
    },
    [selectFile, setDiffDocument],
  );
  return { loadBranches, openBranches, loadDiff, loadLog, loadLogFileDiff, handleSelectFile };
}
