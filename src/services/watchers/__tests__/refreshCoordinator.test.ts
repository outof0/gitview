import { describe, expect, it, vi } from "vitest";
import { createRefreshCoordinator } from "../refreshCoordinator";
import type { GitExecFn } from "../../git/types";
import { createRepositoryService } from "../../repositoryService";
import { DEFAULT_GIT_WORKSPACE_SETTINGS } from "../../../shared/types/gitWorkspaceSettings";

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
): GitExecFn {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    const resp = responses[key];
    if (!resp) {
      return Promise.reject(new Error(`Unexpected: ${key}`));
    }
    return Promise.resolve(resp);
  };
}

describe("refreshCoordinator", () => {
  it("debounces refresh requests", async () => {
    vi.useFakeTimers();
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
    });

    const repositoryService = {
      discoverRepositories: vi.fn(async () => [
        {
          id: "r1",
          rootPath: "/repo",
          workspaceFolderPath: "/repo",
          gitDirPath: "/repo/.git",
          name: "repo",
          currentBranch: "main",
          headSha: "abc",
          upstream: null,
          isDetached: false,
          isBare: false,
          isWorktree: false,
          operation: { type: "none" as const },
          ahead: null,
          behind: null,
          conflictCount: 0,
          dirty: false,
          trusted: true,
          protectedBranch: false,
          lastRefreshAt: 0,
        },
      ]),
      buildSnapshot: vi.fn((repos, active) => ({
        repositories: repos,
        activeRepoId: active,
        multiRootDiverged: false,
      })),
    };

    const coordinator = createRefreshCoordinator({
      execGit,
      repositoryService: repositoryService as never,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
      debounceMs: 100,
    });

    const listener = vi.fn();
    coordinator.subscribe(listener);

    coordinator.scheduleRefresh();
    coordinator.scheduleRefresh();
    coordinator.scheduleRefresh();

    await vi.advanceTimersByTimeAsync(99);
    expect(listener).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].repoSnapshot.repositories).toHaveLength(1);

    coordinator.dispose();
    vi.useRealTimers();
  });

  it("coalesces overlapping refreshes into one trailing pass", async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let calls = 0;
    let concurrent = 0;
    let maxConcurrent = 0;
    const repositoryService = {
      discoverRepositories: vi.fn(async () => {
        calls++;
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        if (calls === 1) {
          await firstGate;
        }
        concurrent--;
        return [];
      }),
      buildSnapshot: vi.fn(() => ({
        repositories: [],
        activeRepoId: null,
        multiRootDiverged: false,
      })),
    };
    const coordinator = createRefreshCoordinator({
      execGit: async () => ({ stdout: "", stderr: "" }),
      repositoryService: repositoryService as never,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const listener = vi.fn();
    coordinator.subscribe(listener);

    const first = coordinator.refreshNow();
    const second = coordinator.refreshNow();
    const third = coordinator.refreshNow();
    releaseFirst();
    await Promise.all([first, second, third]);

    expect(calls).toBe(2);
    expect(maxConcurrent).toBe(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("publishes one normalized settings snapshot with each refresh", async () => {
    const repositoryService = {
      discoverRepositories: vi.fn(async () => []),
      buildSnapshot: vi.fn(() => ({
        repositories: [],
        activeRepoId: null,
        multiRootDiverged: false,
      })),
    };
    const settings = {
      ...DEFAULT_GIT_WORKSPACE_SETTINGS,
      mode: "changelist" as const,
      graphSort: "topological" as const,
    };
    const coordinator = createRefreshCoordinator({
      execGit: async () => ({ stdout: "", stderr: "" }),
      repositoryService: repositoryService as never,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
      getSettings: () => settings,
    });

    const payload = await coordinator.refreshNow();

    expect(payload.settings).toEqual(settings);
  });

  it("isolates listener failures", async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const repositoryService = {
      discoverRepositories: vi.fn(async () => []),
      buildSnapshot: vi.fn(() => ({
        repositories: [],
        activeRepoId: null,
        multiRootDiverged: false,
      })),
    };
    const coordinator = createRefreshCoordinator({
      logger,
      execGit: async () => ({ stdout: "", stderr: "" }),
      repositoryService: repositoryService as never,
      getWorkspaceFolders: () => [],
      getTrusted: () => true,
    });
    const healthyListener = vi.fn();
    coordinator.subscribe(() => {
      throw new Error("panel closed");
    });
    coordinator.subscribe(healthyListener);

    await coordinator.refreshNow();

    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      "refresh.listener.failed",
      expect.objectContaining({ errorMessage: "panel closed" }),
    );
  });

  it("reuses repository status instead of spawning a duplicate status command", async () => {
    const execGit = vi.fn<GitExecFn>(async (_root, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: "abc\n", stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0 M file.ts\0", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const coordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    await coordinator.refreshNow();

    expect(
      execGit.mock.calls.filter(
        ([, args]) => args.join(" ") === "status --porcelain=v1 -z -b",
      ),
    ).toHaveLength(1);
  });
});
