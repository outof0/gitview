import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitExecFn } from "../../services/git/types";
import type { RefreshPayload } from "../../services/watchers/refreshCoordinator";
import type { Repository } from "../../shared/types/repository";
import type { ShelfStorage } from "../../storage/shelfStorage";

const vscodeMocks = vi.hoisted(() => ({
  executeCommand: vi.fn(async () => undefined),
}));

vi.mock("vscode", () => ({
  commands: {
    executeCommand: vscodeMocks.executeCommand,
  },
}));

import { createGitSubmenuContextService } from "../gitSubmenuContext";

const repository: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "repo",
  currentBranch: "main",
  headSha: "abc",
  upstream: "origin/main",
  isDetached: false,
  isBare: false,
  isWorktree: false,
  operation: { type: "none" },
  ahead: 0,
  behind: 0,
  conflictCount: 0,
  changeDigest: null,
  dirty: true,
  trusted: true,
  protectedBranch: false,
  lastRefreshAt: 0,
};

const payload: RefreshPayload = {
  repoSnapshot: {
    repositories: [repository],
    activeRepoId: repository.id,
    multiRootDiverged: false,
  },
  statusByRepoId: new Map([
    [
      repository.id,
      {
        repoId: repository.id,
        files: [],
        changelists: [],
        mode: "staging",
        showIgnored: false,
        showUnversioned: true,
        refreshedAt: 0,
      },
    ],
  ]),
  traceId: "refresh-1",
};

const shelfStorage: ShelfStorage = {
  list: vi.fn(async () => []),
  getEntry: vi.fn(async () => null),
  getPatch: vi.fn(async () => null),
  add: vi.fn(),
  remove: vi.fn(async () => false),
};

describe("git submenu context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses refresh status without launching a second git status", async () => {
    const execGit = vi.fn(async (_repoRoot: string, args: string[]) => ({
      stdout: args[0] === "remote" ? "origin\n" : "",
      stderr: "",
    })) as GitExecFn;
    let refreshListener: ((next: RefreshPayload) => void) | undefined;
    const unsubscribe = vi.fn();
    const service = createGitSubmenuContextService({
      execGit,
      shelfStorage,
      subscribeRefresh: (listener) => {
        refreshListener = listener;
        return unsubscribe;
      },
    });

    refreshListener?.(payload);
    await vi.waitFor(() => {
      expect(vscodeMocks.executeCommand).toHaveBeenCalled();
    });

    expect(
      vi.mocked(execGit).mock.calls.some(([, args]) => args[0] === "status"),
    ).toBe(false);
    expect(vi.mocked(execGit).mock.calls.map(([, args]) => args[0])).toEqual([
      "stash",
      "remote",
    ]);

    service.dispose();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
