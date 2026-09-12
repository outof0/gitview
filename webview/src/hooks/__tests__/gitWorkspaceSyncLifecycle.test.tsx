// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";
import type { SyncOperationEvent } from "@gitview/shared/types/sync";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { ProtocolRequestTimeoutError } from "../../protocol/clientCore";
import { useGitWorkspaceCore } from "../gitWorkspace/useGitWorkspaceCore";
import { useGitWorkspaceStoreSlice } from "../gitWorkspace/useGitWorkspaceStoreSlice";
import { useGitWorkspaceSyncActions } from "../gitWorkspace/useGitWorkspaceSyncActions";

const repository: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
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

const repositorySnapshot: RepositorySnapshot = {
  repositories: [repository],
  activeRepoId: repository.id,
  multiRootDiverged: false,
};

const runningFetch: SyncOperationEvent = {
  operationId: "sync-1",
  requestId: "fetch-1",
  operation: "fetch",
  repoIds: [repository.id],
  sequence: 2,
  timestamp: 1,
  state: "running",
  phase: "fetching",
  cancellable: true,
};

const initial = useGitWorkspaceStore.getState();

function renderCore() {
  return renderHook(() => {
    const store = useGitWorkspaceStoreSlice();
    return useGitWorkspaceCore(store);
  });
}

describe("Git Workspace sync lifecycle", () => {
  beforeEach(() => {
    useGitWorkspaceStore.setState(initial, true);
    useGitWorkspaceStore.getState().applyRepoSnapshot(repositorySnapshot);
  });

  it("keeps structured sync busy until a late terminal event", () => {
    useGitWorkspaceStore.getState().applySyncOperation(runningFetch);
    useGitWorkspaceStore
      .getState()
      .markSyncOperationOutcomeUnknown(runningFetch.operationId);
    const { result } = renderCore();

    expect(result.current.syncing).toBe(true);
    expect(result.current.syncOperation).toMatchObject({
      outcomeUnknown: true,
      event: { state: "running" },
    });

    act(() => {
      useGitWorkspaceStore.getState().applySyncOperation({
        ...runningFetch,
        sequence: 3,
        timestamp: 2,
        state: "completed",
        outcome: { kind: "success" },
      });
    });

    expect(result.current.syncing).toBe(false);
    expect(result.current.syncOperation).toMatchObject({
      outcomeUnknown: false,
      event: { state: "completed" },
    });
  });

  it("turns a fetch request timeout into unknown outcome without unlocking host work", async () => {
    const setSyncing = vi.fn();
    const fetch = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningFetch);
      throw new ProtocolRequestTimeoutError("sync.fetch", 30_000);
    });
    const { result } = renderHook(() =>
      useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { fetch } },
          activeRepo: repository,
          setSyncing,
        },
        store: {
          repoSnapshot: repositorySnapshot,
          synchronousBranchControl: true,
          pullStrategy: "merge",
          dialogs: {},
          reviewSnapshot: null,
          reviewFilters: { state: "open", sort: "updated" },
          setWorkspaceNotification: vi.fn(),
          setBranchesOpen: vi.fn(),
          openDialog: vi.fn(),
          closeDialog: vi.fn(),
          setReviewLoading: vi.fn(),
          setReviewError: vi.fn(),
        },
      } as never),
    );

    await act(async () => {
      await result.current.handleFetch();
    });

    expect(fetch).toHaveBeenCalledWith(repository.id);
    expect(setSyncing.mock.calls).toEqual([[true, "repo-1"], [false, "repo-1"]]);
    expect(useGitWorkspaceStore.getState().error).toBeNull();
    expect(
      useGitWorkspaceStore
        .getState()
        .syncOperationForRepository(repository.id, "fetch"),
    ).toMatchObject({
      outcomeUnknown: true,
      event: { operationId: runningFetch.operationId, state: "running" },
    });

    const core = renderCore();
    expect(core.result.current.syncing).toBe(true);
  });

  it("sends cancellation for the authoritative operation id", async () => {
    const cancelSync = vi.fn(async () => ({
      operationId: runningFetch.operationId,
      accepted: true as const,
    }));
    const { result } = renderHook(() =>
      useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { cancelSync } },
          activeRepo: repository,
          setSyncing: vi.fn(),
        },
        store: {
          repoSnapshot: repositorySnapshot,
          synchronousBranchControl: true,
          pullStrategy: "merge",
          dialogs: {},
          reviewSnapshot: null,
          reviewFilters: { state: "open", sort: "updated" },
          setWorkspaceNotification: vi.fn(),
          setBranchesOpen: vi.fn(),
          openDialog: vi.fn(),
          closeDialog: vi.fn(),
          setReviewLoading: vi.fn(),
          setReviewError: vi.fn(),
        },
      } as never),
    );

    await act(async () => {
      await result.current.handleCancelSync(runningFetch.operationId);
    });

    expect(cancelSync).toHaveBeenCalledWith(runningFetch.operationId);
  });

  it("turns a pull timeout into an unknown host-authoritative outcome", async () => {
    const runningPull: SyncOperationEvent = {
      ...runningFetch,
      operationId: "sync-pull",
      requestId: "pull-1",
      operation: "pull",
      phase: "pulling",
    };
    const pull = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningPull);
      throw new ProtocolRequestTimeoutError("sync.pull", 30_000);
    });
    const setSyncing = vi.fn();
    const { result } = renderHook(() =>
      useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { pull } },
          activeRepo: repository,
          setSyncing,
        },
        store: {
          repoSnapshot: repositorySnapshot,
          synchronousBranchControl: true,
          pullStrategy: "merge",
          dialogs: {},
          reviewSnapshot: null,
          reviewFilters: { state: "open", sort: "updated" },
          setWorkspaceNotification: vi.fn(),
          setBranchesOpen: vi.fn(),
          openDialog: vi.fn(),
          closeDialog: vi.fn(),
          setReviewLoading: vi.fn(),
          setReviewError: vi.fn(),
        },
      } as never),
    );

    await act(async () => {
      await result.current.handlePull("rebase");
    });

    expect(pull).toHaveBeenCalledWith(repository.id, "rebase");
    expect(setSyncing.mock.calls).toEqual([[true, "repo-1"], [false, "repo-1"]]);
    expect(useGitWorkspaceStore.getState().error).toBeNull();
    expect(
      useGitWorkspaceStore
        .getState()
        .syncOperationForRepository(repository.id, "pull"),
    ).toMatchObject({
      outcomeUnknown: true,
      event: { operationId: runningPull.operationId, state: "running" },
    });
  });

  it("uses a terminal push failure instead of a generic request error", async () => {
    const runningPush: SyncOperationEvent = {
      ...runningFetch,
      operationId: "sync-push",
      requestId: "push-1",
      operation: "push",
      phase: "pushing",
    };
    const push = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningPush);
      useGitWorkspaceStore.getState().applySyncOperation({
        ...runningPush,
        sequence: 3,
        state: "failed",
        outcome: {
          kind: "offline",
          message: "The remote is unavailable.",
        },
      });
      throw new Error("Request failed");
    });
    const { result } = renderHook(() =>
      useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { push } },
          activeRepo: repository,
          setSyncing: vi.fn(),
        },
        store: {
          repoSnapshot: repositorySnapshot,
          synchronousBranchControl: true,
          pullStrategy: "merge",
          dialogs: {},
          reviewSnapshot: null,
          reviewFilters: { state: "open", sort: "updated" },
          setWorkspaceNotification: vi.fn(),
          setBranchesOpen: vi.fn(),
          openDialog: vi.fn(),
          closeDialog: vi.fn(),
          setReviewLoading: vi.fn(),
          setReviewError: vi.fn(),
        },
      } as never),
    );

    await act(async () => {
      await result.current.handlePush();
    });

    expect(useGitWorkspaceStore.getState().error).toBeNull();
    expect(
      useGitWorkspaceStore
        .getState()
        .syncOperationForRepository(repository.id, "push"),
    ).toMatchObject({
      event: {
        state: "failed",
        outcome: { kind: "offline", message: "The remote is unavailable." },
      },
    });
  });

  it("opens a partial update-all report after late completion", async () => {
    const runningUpdate: SyncOperationEvent = {
      ...runningFetch,
      operationId: "sync-update",
      requestId: "update-1",
      operation: "update_all_roots",
      repoIds: [repository.id, "repo-2"],
      phase: "pulling",
      progress: {
        completed: 1,
        total: 2,
        roots: [
          {
            repoId: repository.id,
            name: repository.name,
            state: "succeeded",
            outcome: { kind: "success" },
          },
          {
            repoId: "repo-2",
            name: "repo-two",
            state: "running",
            phase: "pulling",
          },
        ],
      },
    };
    const updateAllRoots = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningUpdate);
      throw new ProtocolRequestTimeoutError("sync.updateAllRoots", 30_000);
    });
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { updateAllRoots } },
          activeRepo: repository,
          setSyncing: vi.fn(),
        },
        store,
      } as never);
    });

    await act(async () => {
      await result.current.handleUpdateAllRoots();
    });

    expect(useGitWorkspaceStore.getState().dialogs.updateAllRootsReport).toBeUndefined();

    await act(async () => {
      useGitWorkspaceStore.getState().applySyncOperation({
        ...runningUpdate,
        sequence: 3,
        state: "completed",
        outcome: { kind: "success" },
        progress: {
          completed: 2,
          total: 2,
          roots: [
            {
              repoId: repository.id,
              name: repository.name,
              state: "succeeded",
              outcome: { kind: "success" },
            },
            {
              repoId: "repo-2",
              name: "repo-two",
              state: "failed",
              outcome: {
                kind: "offline",
                message: "The remote is unavailable.",
              },
            },
          ],
        },
      });
    });

    expect(
      useGitWorkspaceStore.getState().dialogs.updateAllRootsReport,
    ).toEqual({
      results: [
        { repoId: repository.id, name: repository.name, ok: true },
        {
          repoId: "repo-2",
          name: "repo-two",
          ok: false,
          error: "The remote is unavailable.",
        },
      ],
    });
  });

  it("retries one failed root and updates the existing report", async () => {
    useGitWorkspaceStore.getState().openDialog("updateAllRootsReport", {
      results: [
        { repoId: repository.id, name: repository.name, ok: true },
        {
          repoId: "repo-2",
          name: "repo-two",
          ok: false,
          error: "The remote is unavailable.",
        },
      ],
    });
    const runningPull: SyncOperationEvent = {
      ...runningFetch,
      operationId: "sync-retry-root",
      requestId: "retry-root-1",
      operation: "pull",
      repoIds: ["repo-2"],
      phase: "pulling",
    };
    const pull = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningPull);
      useGitWorkspaceStore.getState().applySyncOperation({
        ...runningPull,
        sequence: 3,
        state: "completed",
        outcome: { kind: "success" },
      });
      return { ok: true };
    });
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { pull } },
          activeRepo: repository,
          setSyncing: vi.fn(),
        },
        store,
      } as never);
    });

    await act(async () => {
      await result.current.handleRetrySyncRoot("repo-2");
    });

    expect(pull).toHaveBeenCalledWith("repo-2", "merge");
    expect(
      useGitWorkspaceStore.getState().dialogs.updateAllRootsReport,
    ).toEqual({
      results: [
        { repoId: repository.id, name: repository.name, ok: true },
        {
          repoId: "repo-2",
          name: "repo-two",
          ok: true,
          error: undefined,
        },
      ],
    });
  });

  it("keeps upstream confirmation open after a terminal push failure", async () => {
    useGitWorkspaceStore.getState().openDialog("pushUpstream", {
      branch: "main",
      remote: "origin",
    });
    const runningPush: SyncOperationEvent = {
      ...runningFetch,
      operationId: "sync-upstream",
      requestId: "push-upstream-1",
      operation: "push",
      phase: "pushing",
    };
    const push = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningPush);
      useGitWorkspaceStore.getState().applySyncOperation({
        ...runningPush,
        sequence: 3,
        state: "failed",
        outcome: { kind: "rejected", message: "Push rejected." },
      });
      throw new Error("Request failed");
    });
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { push } },
          activeRepo: repository,
          setSyncing: vi.fn(),
        },
        store,
      } as never);
    });

    await act(async () => {
      await result.current.confirmPushUpstream();
    });

    expect(push).toHaveBeenCalledWith(repository.id, {
      setUpstream: true,
      remote: "origin",
    });
    expect(useGitWorkspaceStore.getState().dialogs.pushUpstream).toEqual({
      branch: "main",
      remote: "origin",
    });
  });

  it("closes upstream confirmation after a late successful push", async () => {
    useGitWorkspaceStore.getState().openDialog("pushUpstream", {
      branch: "main",
      remote: "origin",
    });
    const runningPush: SyncOperationEvent = {
      ...runningFetch,
      operationId: "sync-upstream-late",
      requestId: "push-upstream-2",
      operation: "push",
      phase: "pushing",
    };
    const push = vi.fn(async () => {
      useGitWorkspaceStore.getState().applySyncOperation(runningPush);
      throw new ProtocolRequestTimeoutError("sync.push", 30_000);
    });
    const { result } = renderHook(() => {
      const store = useGitWorkspaceStoreSlice();
      return useGitWorkspaceSyncActions({
        core: {
          clientRef: { current: { push } },
          activeRepo: repository,
          setSyncing: vi.fn(),
        },
        store,
      } as never);
    });

    await act(async () => {
      await result.current.confirmPushUpstream();
    });
    expect(useGitWorkspaceStore.getState().dialogs.pushUpstream).toBeDefined();

    await act(async () => {
      useGitWorkspaceStore.getState().applySyncOperation({
        ...runningPush,
        sequence: 3,
        state: "completed",
        outcome: { kind: "success" },
      });
    });

    expect(useGitWorkspaceStore.getState().dialogs.pushUpstream).toBeUndefined();
  });
});
