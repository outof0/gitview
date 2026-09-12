// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BranchEntry } from "@gitview/shared/types/branch";
import type {
  Repository,
  RepositorySnapshot,
} from "@gitview/shared/types/repository";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { useGitWorkspaceBranchActions } from "../gitWorkspace/useGitWorkspaceBranchActions";
import type { GitWorkspaceDeps } from "../gitWorkspace/gitWorkspaceDeps";

function repository(id: string, name: string): Repository {
  return {
    id,
    rootPath: `/${id}`,
    workspaceFolderPath: `/${id}`,
    gitDirPath: `/${id}/.git`,
    name,
    currentBranch: "main",
    headSha: "abc123",
    upstream: "origin/main",
    isDetached: false,
    isBare: false,
    isWorktree: false,
    operation: { type: "none" },
    ahead: 0,
    behind: 0,
    conflictCount: 0,
    changeDigest: null,
    dirty: false,
    trusted: true,
    protectedBranch: false,
    lastRefreshAt: 0,
  };
}

const repoA = repository("rA", "a");
const repoB = repository("rB", "b");

function snapshot(active: Repository): RepositorySnapshot {
  return {
    repositories: [repoA, repoB],
    activeRepoId: active.id,
    multiRootDiverged: true,
  };
}

function branch(name: string): BranchEntry {
  return {
    repoId: repoA.id,
    name,
    fullName: name,
    remote: false,
    current: false,
    upstream: null,
    headSha: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const initial = useGitWorkspaceStore.getState();

function renderBranchActions(
  repo: Repository,
  client: Record<string, (...args: never[]) => Promise<unknown>>,
) {
  return renderHook(
    ({ repo: activeRepo }: { repo: Repository }) => {
      const store = useGitWorkspaceStore.getState();
      return useGitWorkspaceBranchActions({
        core: {
          clientRef: { current: client },
          activeRepo,
          // Mirrors the real `runMutation`: it reports errors itself, so a
          // raw rejection here would only become an unhandled rejection.
          runMutation: async (fn: () => Promise<unknown>) => {
            try {
              await fn();
            } catch {
              /* reported by the real runMutation */
            }
          },
        },
        store: {
          logFilters: store.logFilters,
          branchCompareSnapshot: store.branchCompareSnapshot,
          setLogFilters: store.setLogFilters,
          setBranchesOpen: store.setBranchesOpen,
          setWorkspaceTab: store.setWorkspaceTab,
          setLogLoading: store.setLogLoading,
          setLogError: store.setLogError,
          setDiffLoading: store.setDiffLoading,
          setBranchCompareSelectedFile: store.setBranchCompareSelectedFile,
        },
      } as unknown as GitWorkspaceDeps);
    },
    { initialProps: { repo } },
  );
}

describe("repository-scoped branch actions", () => {
  beforeEach(() => {
    useGitWorkspaceStore.setState(initial, true);
    useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoA));
  });

  it("does not write repo A's log failure onto repo B", async () => {
    const gate = deferred<unknown>();
    const client = {
      queryLog: vi.fn(() => gate.promise),
      queryLogDag: vi.fn(() => Promise.resolve({
        repoId: "rA",
        headSha: null,
        refTips: [],
        nodes: [],
        generatedAt: 0,
      })),
    };
    const hook = renderBranchActions(repoA, client);

    act(() => {
      hook.result.current.handleShowBranchInLog(branch("feature-a"));
    });
    // Guards the test itself: the request must really be repo A's.
    expect(client.queryLog).toHaveBeenCalledWith("rA", expect.anything());
    expect(useGitWorkspaceStore.getState().logLoading).toBe(true);

    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    hook.rerender({ repo: repoB });

    await act(async () => {
      gate.reject(new Error("log exploded"));
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.logError).toBeNull();
    expect(state.logLoading).toBe(false);
  });

  it("does not release repo B's diff spinner when repo A's compare settles", async () => {
    const gateA = deferred<unknown>();
    const gateB = deferred<unknown>();
    const client = {
      compareBranchWithCurrent: vi
        .fn()
        .mockReturnValueOnce(gateA.promise)
        .mockReturnValueOnce(gateB.promise),
    };
    const hook = renderBranchActions(repoA, client);

    act(() => {
      hook.result.current.handleCompareWithCurrent(branch("feature-a"));
    });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    hook.rerender({ repo: repoB });
    act(() => {
      hook.result.current.handleCompareWithCurrent(branch("feature-b"));
    });
    // Guards the test itself: two compares, one per repository, both in flight.
    expect(client.compareBranchWithCurrent).toHaveBeenCalledTimes(2);
    expect(client.compareBranchWithCurrent).toHaveBeenNthCalledWith(
      1,
      "rA",
      "feature-a",
    );
    expect(client.compareBranchWithCurrent).toHaveBeenNthCalledWith(
      2,
      "rB",
      "feature-b",
    );
    expect(useGitWorkspaceStore.getState().diffLoading).toBe(true);

    // Repo A's compare finishes late: repo B's spinner must survive it.
    await act(async () => {
      gateA.resolve(undefined);
    });
    expect(useGitWorkspaceStore.getState().diffLoading).toBe(true);

    await act(async () => {
      gateB.resolve(undefined);
    });
    expect(useGitWorkspaceStore.getState().diffLoading).toBe(false);
  });
});
