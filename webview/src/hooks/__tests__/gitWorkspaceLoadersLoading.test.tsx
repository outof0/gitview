// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Repository, RepositorySnapshot } from "@gitview/shared/types/repository";
import { useGitWorkspaceStore } from "../../stores/gitWorkspaceStore";
import { useGitWorkspaceStoreSlice } from "../gitWorkspace/useGitWorkspaceStoreSlice";
import { useGitWorkspaceCore } from "../gitWorkspace/useGitWorkspaceCore";
import { useGitWorkspaceLoaders } from "../gitWorkspace/useGitWorkspaceLoaders";

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

/**
 * A client whose every call settles on demand. Nothing is pushed back into the
 * store, so these cases prove the loader's own `finally` releases the flag —
 * not the `apply*Snapshot` reducer the host would normally drive.
 */
type Deferred = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const deferred = new Map<string, Deferred>();

const client = {
  listBranches: vi.fn(() => {
    let d: Deferred;
    const p = new Promise((res, rej) => {
      d = { resolve: res, reject: rej };
    });
    deferred.set("listBranches", d!);
    return p;
  }),
  listTags: vi.fn(() => Promise.resolve(null)),
  openDiff: vi.fn(() => Promise.resolve(null)),
  queryBlame: vi.fn(() => Promise.resolve(null)),
  queryLog: vi.fn(() => Promise.resolve(null)),
  logFileDiff: vi.fn(() => Promise.resolve(null)),
};

vi.mock("../../protocol/client", () => ({
  createProtocolClient: () => client,
}));

beforeEach(() => {
  deferred.clear();
  client.listBranches.mockClear();
  useGitWorkspaceStore.setState({
    ...useGitWorkspaceStore.getState(),
    repoSnapshot: repositorySnapshot,
    branchesLoading: false,
    tagsLoading: false,
    diffLoading: false,
    blameLoading: false,
    logLoading: false,
  });
  (
    globalThis as unknown as { acquireVsCodeApi: () => unknown }
  ).acquireVsCodeApi = () => ({
    postMessage: () => {},
    getState: () => null,
    setState: () => {},
  });
});

function renderLoaders() {
  return renderHook(() => {
    const store = useGitWorkspaceStoreSlice();
    const core = useGitWorkspaceCore(store);
    return useGitWorkspaceLoaders({ store, core });
  });
}

describe("workspace loaders release their loading flag", () => {
  /**
   * Regression: `loadBranches` used to clear `branchesLoading` only in `catch`
   * and rely on the host pushing `branch.snapshot` for the success path. When
   * the push is dropped, arrives out of order, or its guard stops matching the
   * payload, the popup sat at "Loading branches…" forever.
   */
  it("clears branchesLoading when the request resolves, with no snapshot push", async () => {
    const { result } = renderLoaders();
    await act(async () => {
      void result.current.loadBranches();
    });
    expect(useGitWorkspaceStore.getState().branchesLoading).toBe(true);
    await act(async () => {
      deferred.get("listBranches")!.resolve({ branches: [] });
      await Promise.resolve();
    });
    expect(useGitWorkspaceStore.getState().branchesLoading).toBe(false);
  });

  it("clears branchesLoading when the request rejects", async () => {
    const { result } = renderLoaders();
    await act(async () => {
      void result.current.loadBranches();
    });
    expect(useGitWorkspaceStore.getState().branchesLoading).toBe(true);
    await act(async () => {
      deferred.get("listBranches")!.reject(new Error("boom"));
      await Promise.resolve();
    });
    expect(useGitWorkspaceStore.getState().branchesLoading).toBe(false);
  });

  it("clears logLoading after queryLog rejects", async () => {
    const { result } = renderLoaders();
    await act(async () => {
      await result.current.loadLog();
    });
    expect(useGitWorkspaceStore.getState().logLoading).toBe(false);
  });

  it("clears blameLoading after queryBlame settles", async () => {
    const { result } = renderLoaders();
    await act(async () => {
      await result.current.loadBlame();
    });
    expect(useGitWorkspaceStore.getState().blameLoading).toBe(false);
  });

  it("clears diffLoading after openDiff settles", async () => {
    const { result } = renderLoaders();
    await act(async () => {
      await result.current.loadDiff("src/app.ts");
    });
    expect(useGitWorkspaceStore.getState().diffLoading).toBe(false);
  });

  it("does not touch the loading flag when there is no active repo", async () => {
    useGitWorkspaceStore.setState({ repoSnapshot: null, branchesLoading: false });
    const { result } = renderLoaders();
    await act(async () => {
      await result.current.loadBranches();
    });
    expect(client.listBranches).not.toHaveBeenCalled();
    expect(useGitWorkspaceStore.getState().branchesLoading).toBe(false);
  });
});
