// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Repository,
  RepositorySnapshot,
} from "@gitview/shared/types/repository";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { useGitWorkspaceCore } from "../gitWorkspace/useGitWorkspaceCore";
import { useGitWorkspaceCommitLogActions } from "../gitWorkspace/useGitWorkspaceCommitLogActions";
import { useGitWorkspaceSyncActions } from "../gitWorkspace/useGitWorkspaceSyncActions";
import { useGitWorkspaceHostSubscription } from "../gitWorkspace/useGitWorkspaceHostSubscription";
import { createProtocolClientTransport } from "../../protocol/clientCore";
import { PROTOCOL_VERSION } from "@gitview/shared/protocol";
import { useGitWorkspaceLoaders } from "../gitWorkspace/useGitWorkspaceLoaders";
import { useGitWorkspaceStoreSlice } from "../gitWorkspace/useGitWorkspaceStoreSlice";
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

function renderLoaders(
  activeRepo: Repository,
  client: Record<string, (...args: never[]) => Promise<unknown>>,
) {
  return renderHook(
    ({ repo }: { repo: Repository }) => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceLoaders({
        core: { clientRef: { current: client }, activeRepo: repo },
        store,
      } as unknown as GitWorkspaceDeps);
    },
    { initialProps: { repo: activeRepo } },
  );
}

function renderCore() {
  return renderHook(() => {
    const store = useGitWorkspaceStoreSlice();
    return useGitWorkspaceCore(store);
  });
}

describe("repository-scoped async completions", () => {
  beforeEach(() => {
    useGitWorkspaceStore.setState(initial, true);
    useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoA));
  });

  it("drops loader errors and loading flags after a repository switch", async () => {
    const gate = deferred<unknown>();
    const client = { queryLog: vi.fn(() => gate.promise) };
    const hook = renderLoaders(repoA, client);

    let pending: Promise<void> | undefined;
    act(() => {
      pending = hook.result.current.loadLog();
    });
    // The request left the hook: the client is working on repo A's log.
    expect(client.queryLog).toHaveBeenCalledWith("rA", expect.anything());

    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    hook.rerender({ repo: repoB });

    await act(async () => {
      gate.reject(new Error("log exploded"));
      await pending;
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.logError).toBeNull();
    expect(state.logLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("suppresses a stale completion after switching away and back (ABA)", async () => {
    const gate = deferred<unknown>();
    const client = { queryLog: vi.fn(() => gate.promise) };
    const hook = renderLoaders(repoA, client);

    let pending: Promise<void> | undefined;
    act(() => {
      pending = hook.result.current.loadLog();
    });
    // A→B→A: the repository id matches again, but the selection era does not.
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    hook.rerender({ repo: repoB });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoA));
    });
    hook.rerender({ repo: repoA });

    await act(async () => {
      gate.reject(new Error("stale first-era failure"));
      await pending;
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.logError).toBeNull();
    expect(state.logLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("suppresses a stale out-of-order loader failure", async () => {
    const slow = deferred<unknown>();
    const client = {
      queryLog: vi
        .fn()
        .mockReturnValueOnce(slow.promise)
        .mockResolvedValueOnce(undefined),
    };
    const hook = renderLoaders(repoA, client);

    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    act(() => {
      first = hook.result.current.loadLog();
    });
    act(() => {
      second = hook.result.current.loadLog();
    });
    await act(async () => {
      await second;
      slow.reject(new Error("stale failure"));
      await first;
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.logError).toBeNull();
    expect(state.logLoading).toBe(false);
  });

  it("reuses immutable historical file diffs within the workspace", async () => {
    const document = {
      repoId: repoA.id,
      filePath: "src/app.ts",
      layout: "split" as const,
      status: "M" as const,
      staged: false,
      binary: false,
      left: { label: "parent", text: "old\n" },
      right: { label: "commit", text: "new\n" },
    };
    const client = { logFileDiff: vi.fn().mockResolvedValue(document) };
    const hook = renderLoaders(repoA, client);

    await act(async () => {
      await hook.result.current.loadLogFileDiff("abc1234", "src/app.ts", "M");
      await hook.result.current.loadLogFileDiff("abc1234", "src/app.ts", "M");
    });

    expect(client.logFileDiff).toHaveBeenCalledTimes(1);
    expect(useGitWorkspaceStore.getState().diffDocument).toEqual(document);
  });

  it("does not erase the new repository draft when the old commit lands", async () => {
    const gate = deferred<{ [key: string]: unknown }>();
    const client = {
      createCommit: vi.fn(() => gate.promise),
    };
    const store = useGitWorkspaceStore.getState();
    const { result } = renderHook(() =>
      useGitWorkspaceCommitLogActions(
        {
          core: {
            clientRef: { current: client },
            activeRepo: repoA,
            setSyncing: vi.fn(),
          },
          store: {
            ...store,
            commitScope: new Set<string>(),
            commitMessage: "A message",
          },
        } as never,
        { loadLog: vi.fn(), loadLogFileDiff: vi.fn(), loadBranches: vi.fn() } as never,
      ),
    );

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.commit(true);
    });
    // Switch to B and type a fresh draft while A's commit is in flight.
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
      useGitWorkspaceStore.getState().setCommitMessage("B draft");
    });

    await act(async () => {
      gate.resolve({ sha: "deadbee", pushed: false, pushRejected: true });
      await pending;
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.commitMessage).toBe("B draft");
    expect(state.workspaceNotification).toBeNull();
  });

  it("does not report the old commit failure on the new repository", async () => {
    const gate = deferred<never>();
    const client = {
      createCommit: vi.fn(() => gate.promise),
    };
    const store = useGitWorkspaceStore.getState();
    const { result } = renderHook(() =>
      useGitWorkspaceCommitLogActions(
        {
          core: {
            clientRef: { current: client },
            activeRepo: repoA,
            setSyncing: vi.fn(),
          },
          store: {
            ...store,
            commitScope: new Set<string>(),
            commitMessage: "A message",
          },
        } as never,
        { loadLog: vi.fn(), loadLogFileDiff: vi.fn(), loadBranches: vi.fn() } as never,
      ),
    );

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.commit(false);
    });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });

    await act(async () => {
      gate.reject(new Error("commit exploded"));
      await pending;
    });

    expect(useGitWorkspaceStore.getState().error).toBeNull();
  });

  it("drops a review failure after a repository switch", async () => {
    const gate = deferred<unknown>();
    const client = { listReviews: vi.fn(() => gate.promise) };
    const store = useGitWorkspaceStore.getState();
    const { result } = renderHook(() =>
      useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: client },
          activeRepo: repoA,
          runMutation: vi.fn(),
          setSyncing: vi.fn(),
        },
        store: {
          ...store,
          repoSnapshot: snapshot(repoA),
          synchronousBranchControl: false,
          pullStrategy: "merge",
          dialogs: {},
          reviewSnapshot: null,
          reviewFilters: { state: "open", sort: "updated" },
          syncOperations: [],
        },
      } as never),
    );

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.loadReviews();
    });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });

    await act(async () => {
      gate.reject(new Error("reviews exploded"));
      await pending;
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.reviewError).toBeNull();
    expect(state.reviewLoading).toBe(false);
  });

  it("drops a superseded log snapshot but applies fresh and spontaneous ones", () => {
    const posted: Array<{ requestId?: string }> = [];
    const transport = createProtocolClientTransport((msg) => {
      posted.push(msg as { requestId?: string });
    });
    const first = transport.request("log.query", { repoId: "rA" }, 10_000);
    void first.catch(() => {});
    const second = transport.request("log.query", { repoId: "rA" }, 10_000);
    void second.catch(() => {});
    const [firstId, secondId] = posted.map((msg) => msg.requestId);

    renderHook(() =>
      useGitWorkspaceHostSubscription({
        core: {
          clientRef: { current: { ...transport, ready: () => new Promise(() => {}) } },
          refresh: vi.fn(),
        },
        store: useGitWorkspaceStore.getState(),
        openBranches: vi.fn(),
      } as never),
    );

    const snapshot = (subject: string) => ({
      protocolVersion: PROTOCOL_VERSION,
      type: "log.snapshot",
      payload: { repoId: "rA", branch: "main", commits: [{ subject }], refreshedAt: 0 },
    });
    const dispatch = (data: unknown) => {
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data }));
      });
    };

    // Late event from the superseded first request: dropped.
    dispatch({ ...snapshot("stale"), requestId: firstId });
    expect(useGitWorkspaceStore.getState().logSnapshot).toBeNull();

    const subjectOf = (): string | undefined => {
      const commits = useGitWorkspaceStore.getState().logSnapshot?.commits;
      if (!Array.isArray(commits) || commits.length === 0) {
        return undefined;
      }
      const first = commits[0] as { subject?: unknown };
      return typeof first.subject === "string" ? first.subject : undefined;
    };

    // Event from the latest request: applied.
    dispatch({ ...snapshot("fresh"), requestId: secondId });
    expect(subjectOf()).toBe("fresh");

    // Spontaneous push without an id (refresh/watchers): always applied.
    dispatch(snapshot("spontaneous"));
    expect(subjectOf()).toBe("spontaneous");
  });

  it("returns the workspace to the unfiltered root after a host focus request", () => {
    const client = {
      ready: () => new Promise<never>(() => {}),
      handleHostMessage: vi.fn(),
    };
    const store = useGitWorkspaceStore.getState();
    store.setLogFilters({
      range: "incoming",
      limit: 10,
      branch: "feature/old",
      path: "packages/old",
      isFolder: true,
      compactRows: true,
    });
    store.requestHistoryOpen({
      repoId: repoA.id,
      path: "packages/old",
      isFolder: true,
    });

    renderHook(() =>
      useGitWorkspaceHostSubscription({
        core: {
          clientRef: { current: client },
          refresh: vi.fn(),
        },
        store,
        openBranches: vi.fn(),
      } as never),
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            protocolVersion: PROTOCOL_VERSION,
            type: "git.focusRoot",
            payload: {},
          },
        }),
      );
    });

    const state = useGitWorkspaceStore.getState();
    expect(state.logFilters).toEqual({ range: "all", limit: 200 });
    expect(state.activeHistoryScope).toBeNull();
    expect(state.logSelectedFilePath).toBeNull();
    expect(state.logSnapshot).toBeNull();
  });

  it("switches repositories before selecting a native commit", async () => {
    const refreshRepos = vi.fn(async (repoId: string) => {
      expect(repoId).toBe(repoB.id);
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
      return undefined;
    });
    const client = {
      ready: () => new Promise<never>(() => {}),
      refreshRepos,
      handleHostMessage: vi.fn(),
    };
    renderHook(() =>
      useGitWorkspaceHostSubscription({
        core: {
          clientRef: { current: client },
          refresh: vi.fn(),
        },
        store: useGitWorkspaceStore.getState(),
        openBranches: vi.fn(),
      } as never),
    );

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            protocolVersion: PROTOCOL_VERSION,
            type: "git.selectCommit",
            payload: { repoId: repoB.id, sha: "deadbeef" },
          },
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshRepos).toHaveBeenCalledWith(repoB.id);
    expect(useGitWorkspaceStore.getState().repoSnapshot?.activeRepoId).toBe(
      repoB.id,
    );
    expect(useGitWorkspaceStore.getState().logSelectedSha).toBe("deadbeef");
  });

  it("does not report a mutation failure for a detached repository", async () => {
    const gate = deferred<unknown>();
    const { result } = renderCore();

    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.runMutation(() => gate.promise);
    });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });

    await act(async () => {
      gate.reject(new Error("mutation exploded"));
      await pending;
    });

    expect(useGitWorkspaceStore.getState().error).toBeNull();
    expect(result.current.syncing).toBe(false);
  });

  it("keeps the second repository busy when the first mutation settles", async () => {
    const gateA = deferred<unknown>();
    const gateB = deferred<unknown>();
    const { result } = renderCore();

    let pendingA: Promise<void> | undefined;
    act(() => {
      pendingA = result.current.runMutation(() => gateA.promise);
    });
    act(() => {
      useGitWorkspaceStore.getState().applyRepoSnapshot(snapshot(repoB));
    });
    let pendingB: Promise<void> | undefined;
    act(() => {
      pendingB = result.current.runMutation(() => gateB.promise);
    });

    await act(async () => {
      gateA.resolve(undefined);
      await pendingA;
    });
    // Repo A's mutation settled, but repo B still has work in flight.
    expect(result.current.syncing).toBe(true);

    await act(async () => {
      gateB.resolve(undefined);
      await pendingB;
    });
    expect(result.current.syncing).toBe(false);
  });
});
