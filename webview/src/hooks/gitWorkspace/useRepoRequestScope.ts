import { useCallback, useRef } from "react";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";

/**
 * Repository-scoped request tokens for async completions.
 *
 * Loaders capture the requesting repository up front, but `catch`/`finally`
 * run later — after the user may have switched repositories. Writing the
 * global error or clearing a loading flag then leaks repo A's outcome into
 * repo B's UI. Every completion path below must go through `isCurrent`:
 * a token is current only while its repository is still active AND no newer
 * request from the same loader superseded it (out-of-order protection).
 */
export type RepoRequestToken = {
  repoId: string;
  loader: string;
  seq: number;
  epoch: number;
};

export function useRepoRequestScope() {
  const seqByLoader = useRef(new Map<string, number>());

  const begin = useCallback((repoId: string, loader: string): RepoRequestToken => {
    const next = (seqByLoader.current.get(loader) ?? 0) + 1;
    seqByLoader.current.set(loader, next);
    return {
      repoId,
      loader,
      seq: next,
      epoch: useGitWorkspaceStore.getState().repoEpoch,
    };
  }, []);

  const isCurrent = useCallback((token: RepoRequestToken): boolean => {
    const state = useGitWorkspaceStore.getState();
    if (state.repoSnapshot?.activeRepoId !== token.repoId) {
      return false;
    }
    // The epoch rejects ABA completions: after A→B→A the id matches again
    // but the era does not.
    if (state.repoEpoch !== token.epoch) {
      return false;
    }
    return seqByLoader.current.get(token.loader) === token.seq;
  }, []);

  return { begin, isCurrent };
}
