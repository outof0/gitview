import { describe, expect, it, vi } from "vitest";
import { createBranchHandlers } from "../handlers/branches";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
): GitExecFn {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
}

const branchListResponse = {
  "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname:short)|%(HEAD) refs/heads/ refs/remotes/":
    {
      stdout:
        "main|refs/heads/main||abc|*\nfeature|refs/heads/feature||def|\n",
      stderr: "",
    },
};

describe("branch handlers mutations", () => {
  it("renames a branch", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "branch -m feature renamed": { stdout: "", stderr: "" },
      ...branchListResponse,
    });

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const refreshNow = vi.spyOn(refreshCoordinator, "refreshNow").mockResolvedValue({
      repoSnapshot: { repositories: [], activeRepoId: null, multiRootDiverged: false },
      statusByRepoId: new Map(),
      traceId: "test",
    });

    const handlers = createBranchHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      branchFavoriteStorage: {
        load: () => new Set(),
        save: async () => {},
        toggle: async () => true,
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.rename("rename-1", repos[0]!.id, "feature", "renamed");

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.rename",
    ) as { ok?: boolean; payload?: { name: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.name).toBe("renamed");
    expect(refreshNow).toHaveBeenCalled();
  });

  it("toggles branch favorite metadata", async () => {
    const favorites = new Set<string>();
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      ...branchListResponse,
    });

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const handlers = createBranchHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      branchFavoriteStorage: {
        load: () => new Set(favorites),
        save: async (_repoId, next) => {
          favorites.clear();
          for (const name of next) {
            favorites.add(name);
          }
        },
        toggle: async (_repoId, name) => {
          if (favorites.has(name)) {
            favorites.delete(name);
            return false;
          }
          favorites.add(name);
          return true;
        },
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.favorite("fav-1", repos[0]!.id, "feature");

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.favorite",
    ) as { payload?: { branches?: Array<{ name: string; favorite?: boolean }> } };

    expect(favorites.has("feature")).toBe(true);
    expect(
      response?.payload?.branches?.find((b) => b.name === "feature")?.favorite,
    ).toBe(true);
  });

  it("deletes a branch and reports unmerged when force is required", async () => {
    const execGit: GitExecFn = async (_repoRoot, args) => {
      const key = args.join(" ");
      if (key === "branch -d stale") {
        throw new Error("error: The branch 'stale' is not fully merged.");
      }
      const responses: Record<string, { stdout: string; stderr: string }> = {
        "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
        "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
        "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
        "branch -D stale": { stdout: "", stderr: "" },
        ...branchListResponse,
      };
      const resp = responses[key];
      if (!resp) {
        throw new Error(`Unexpected git call: ${key}`);
      }
      return resp;
    };

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const handlers = createBranchHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      branchFavoriteStorage: {
        load: () => new Set(),
        save: async () => {},
        toggle: async () => true,
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.delete("del-1", repos[0]!.id, "stale", false);
    const unmerged = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { error?: { code?: string } }).error?.code === "BRANCH_NOT_FULLY_MERGED",
    );
    expect(unmerged).toBeDefined();

    await handlers.delete("del-2", repos[0]!.id, "stale", true);
    const deleted = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.delete",
    ) as { ok?: boolean };
    expect(deleted?.ok).toBe(true);
  });

  it("pushes a branch with upstream", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "push -u origin feature": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## feature\0", stderr: "" },
    });

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const handlers = createBranchHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      branchFavoriteStorage: {
        load: () => new Set(),
        save: async () => {},
        toggle: async () => true,
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.push("push-1", repos[0]!.id, "feature", {
      remote: "origin",
      setUpstream: true,
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.push",
    ) as { ok?: boolean };
    expect(response?.ok).toBe(true);
  });

  it("merges a branch with squash option", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "merge --squash feature": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
    });

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const handlers = createBranchHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      branchFavoriteStorage: {
        load: () => new Set(),
        save: async () => {},
        toggle: async () => true,
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.merge("merge-1", repos[0]!.id, "feature", { squash: true });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.merge",
    ) as { ok?: boolean; payload?: { ref: string } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.ref).toBe("feature");
  });

  it("rebases onto a branch", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "rebase -i main": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## main\0", stderr: "" },
    });

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });

    const sent: unknown[] = [];
    const handlers = createBranchHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      branchFavoriteStorage: {
        load: () => new Set(),
        save: async () => {},
        toggle: async () => true,
      },
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.rebaseOnto("rebase-1", repos[0]!.id, "main", {
      interactive: true,
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.rebaseOnto",
    ) as { ok?: boolean; payload?: { onto: string } };
    expect(response?.ok).toBe(true);
    expect(response?.payload?.onto).toBe("main");
  });
});