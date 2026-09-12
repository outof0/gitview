// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Repository,
  RepositorySnapshot,
} from "@gitview/shared/types/repository";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { useGitWorkspaceCore } from "../gitWorkspace/useGitWorkspaceCore";
import { useGitWorkspaceStoreSlice } from "../gitWorkspace/useGitWorkspaceStoreSlice";

const refreshRepos = vi.fn(
  (_repoId?: string): Promise<unknown> => new Promise(() => {}),
);

vi.mock("../../protocol/client", () => ({
  createProtocolClient: () => ({
    refreshRepos,
  }),
}));

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

describe("repository-scoped refresh state", () => {
  beforeEach(() => {
    refreshRepos.mockReset();
    useGitWorkspaceStore.setState(initial, true);
    useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoA));
  });

  it("does not surface a stale refresh failure on the new repository", async () => {
    const gate = deferred<unknown>();
    refreshRepos.mockReturnValueOnce(gate.promise);
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceCore(store);
    });

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);

    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    // B never started a refresh: its spinner must be off.
    expect(result.current.refreshing).toBe(false);

    await act(async () => {
      gate.reject(new Error("refresh exploded"));
      await pending;
    });

    expect(useGitWorkspaceStore.getState().error).toBeNull();
    expect(result.current.refreshing).toBe(false);
  });

  it("tracks concurrent refreshes per repository independently", async () => {
    const gateA = deferred<unknown>();
    const gateB = deferred<unknown>();
    refreshRepos
      .mockReturnValueOnce(gateA.promise)
      .mockReturnValueOnce(gateB.promise);
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceCore(store);
    });

    let pendingA: Promise<void> | undefined;
    act(() => {
      pendingA = result.current.refresh();
    });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    let pendingB: Promise<void> | undefined;
    act(() => {
      pendingB = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);

    // A settles first: B must stay busy.
    await act(async () => {
      gateA.resolve(undefined);
      await pendingA;
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      gateB.resolve(undefined);
      await pendingB;
    });
    expect(result.current.refreshing).toBe(false);
  });

  it("keeps the spinner on while a second refresh for the SAME repository is pending", async () => {
    // A boolean per repository cannot express this: both refreshes set the
    // key and the first completion removes it while the second is still
    // running, so the spinner stops early on a refresh that has not finished.
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    refreshRepos
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceCore(store);
    });

    let pendingFirst: Promise<void> | undefined;
    act(() => {
      pendingFirst = result.current.refresh();
    });
    let pendingSecond: Promise<void> | undefined;
    act(() => {
      pendingSecond = result.current.refresh();
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      first.resolve(undefined);
      await pendingFirst;
    });
    expect(result.current.refreshing).toBe(true);

    await act(async () => {
      second.resolve(undefined);
      await pendingSecond;
    });
    expect(result.current.refreshing).toBe(false);
  });
});
