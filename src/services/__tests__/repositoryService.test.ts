import { describe, expect, it, vi } from "vitest";
import * as path from "node:path";
import { createRepositoryService } from "../repositoryService";
import type { GitExecFn } from "../git/types";

function makeExecGit(
  responses: Record<string, { stdout: string; stderr: string }>,
  rejectKeys: string[] = [],
): GitExecFn {
  return (_repoRoot, args) => {
    const key = args.join(" ");
    if (rejectKeys.includes(key)) {
      return Promise.reject(new Error(`git failed: ${key}`));
    }
    const resp = responses[key];
    if (!resp) {
      throw new Error(`Unexpected git call: ${key}`);
    }
    return Promise.resolve(resp);
  };
}

describe("RepositoryService", () => {
  it("creates the same repository id for equivalent root paths", () => {
    const svc = createRepositoryService({ execGit: makeExecGit({}) });

    expect(svc.stableRepoId(path.join("repo", "."))).toBe(
      svc.stableRepoId(path.resolve("repo")),
    );
  });

  it("discovers repository and builds snapshot", async () => {
    const execGit = makeExecGit(
      {
        "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
        "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
        "rev-parse HEAD": { stdout: "abc123\n", stderr: "" },
        remote: { stdout: "origin\n", stderr: "" },
        "status --porcelain=v1 -z -b": {
          stdout: "## main...origin/main [ahead 1]\0 M src/a.ts\0",
          stderr: "",
        },
      },
      [
        "rev-parse --verify MERGE_HEAD",
        "rev-parse --verify REBASE_HEAD",
        "rev-parse --verify CHERRY_PICK_HEAD",
        "rev-parse --verify REVERT_HEAD",
      ],
    );

    const svc = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
      isProtectedBranch: (branch) => branch === "main",
    });

    const repos = await svc.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    expect(repos).toHaveLength(1);
    expect(repos[0]?.currentBranch).toBe("main");
    expect(repos[0]?.protectedBranch).toBe(true);
    expect(repos[0]?.ahead).toBe(1);
    expect(repos[0]?.dirty).toBe(true);
    expect(repos[0]?.headState).toEqual({
      kind: "attached",
      branch: "main",
      sha: "abc123",
    });
    expect(repos[0]?.remoteState).toEqual({
      kind: "available",
      remotes: ["origin"],
      upstream: "origin/main",
    });

    const snapshot = svc.buildSnapshot(repos, repos[0]?.id ?? null);
    expect(snapshot.repositories).toHaveLength(1);
    expect(snapshot.multiRootDiverged).toBe(false);
    expect(snapshot.shellState?.kind).toBe("repository");
  });

  it("builds explicit unborn and no-remote repository truth", async () => {
    const execGit = makeExecGit(
      {
        "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
        "status --porcelain=v1 -z -b": {
          stdout: "## No commits yet on main\0",
          stderr: "",
        },
        remote: { stdout: "", stderr: "" },
      },
      ["rev-parse HEAD"],
    );
    const svc = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });

    const repos = await svc.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    expect(repos[0]?.currentBranch).toBe("main");
    expect(repos[0]?.headState).toEqual({ kind: "unborn", branch: "main" });
    expect(repos[0]?.remoteState).toEqual({ kind: "none" });
  });

  it("normalizes an invalid active repository id", () => {
    const svc = createRepositoryService({ execGit: makeExecGit({}) });
    const repository = {
      id: "repo",
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
      changeDigest: null,
      dirty: false,
      trusted: true,
      protectedBranch: false,
      lastRefreshAt: 0,
    };

    const snapshot = svc.buildSnapshot([repository], "missing");
    expect(snapshot.activeRepoId).toBe("repo");
    expect(snapshot.shellState?.kind).toBe("repository");
    expect(svc.buildSnapshot([], "missing").shellState).toEqual({
      kind: "no_repository",
    });
  });

  it("resolves nested repository as deepest match", () => {
    const svc = createRepositoryService({
      execGit: makeExecGit({}),
    });
    const parent = {
      id: "parent",
      rootPath: "/workspace",
      workspaceFolderPath: "/workspace",
      gitDirPath: "/workspace/.git",
      name: "workspace",
      currentBranch: "main",
      headSha: "aaa",
      upstream: null,
      isDetached: false,
      isBare: false,
      isWorktree: false,
      operation: { type: "none" as const },
      ahead: null,
      behind: null,
      conflictCount: 0,
      changeDigest: null,
      dirty: false,
      trusted: true,
      protectedBranch: true,
      lastRefreshAt: 0,
    };
    const nested = {
      ...parent,
      id: "nested",
      rootPath: "/workspace/pkg",
      name: "pkg",
    };

    const resolved = svc.resolveRepositoryForResource(
      [parent, nested],
      "/workspace/pkg/src/file.ts",
    );
    expect(resolved?.id).toBe("nested");
  });

  it("flags multi-root branch divergence", () => {
    const svc = createRepositoryService({ execGit: makeExecGit({}) });
    const repos = [
      {
        id: "a",
        rootPath: "/a",
        workspaceFolderPath: "/a",
        gitDirPath: "/a/.git",
        name: "a",
        currentBranch: "main",
        headSha: null,
        upstream: null,
        isDetached: false,
        isBare: false,
        isWorktree: false,
        operation: { type: "none" as const },
        ahead: null,
        behind: null,
        conflictCount: 0,
        changeDigest: null,
        dirty: false,
        trusted: true,
        protectedBranch: false,
        lastRefreshAt: 0,
      },
      {
        id: "b",
        rootPath: "/b",
        workspaceFolderPath: "/b",
        gitDirPath: "/b/.git",
        name: "b",
        currentBranch: "develop",
        headSha: null,
        upstream: null,
        isDetached: false,
        isBare: false,
        isWorktree: false,
        operation: { type: "none" as const },
        ahead: null,
        behind: null,
        conflictCount: 0,
        changeDigest: null,
        dirty: false,
        trusted: true,
        protectedBranch: false,
        lastRefreshAt: 0,
      },
    ];

    const snapshot = svc.buildSnapshot(repos, "a");
    expect(snapshot.multiRootDiverged).toBe(true);
  });

  it("caches repository topology and immutable git-dir metadata", async () => {
    const execGit = vi.fn<GitExecFn>(async (_root, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return { stdout: ".git\n", stderr: "" };
      }
      if (key === "rev-parse HEAD") {
        return { stdout: "abc\n", stderr: "" };
      }
      if (key === "status --porcelain=v1 -z -b") {
        return { stdout: "## main\0", stderr: "" };
      }
      throw new Error(`Unexpected git call: ${key}`);
    });
    const discoverGitRoots = vi.fn(async () => ["/repo"]);
    const svc = createRepositoryService({ execGit, discoverGitRoots });
    const input = {
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    };

    await svc.discoverRepositories(input);
    await svc.discoverRepositories(input);

    expect(discoverGitRoots).toHaveBeenCalledTimes(1);
    expect(
      execGit.mock.calls.filter(([, args]) => args.join(" ") === "rev-parse --git-dir"),
    ).toHaveLength(1);
    expect(
      execGit.mock.calls.filter(
        ([, args]) => args.join(" ") === "status --porcelain=v1 -z -b",
      ),
    ).toHaveLength(2);
  });

  it("does not confuse sibling paths with a repository prefix", () => {
    const svc = createRepositoryService({ execGit: makeExecGit({}) });
    const repo = {
      id: "repo",
      rootPath: "/workspace/repo",
      workspaceFolderPath: "/workspace/repo",
      gitDirPath: "/workspace/repo/.git",
      name: "repo",
      currentBranch: "main",
      headSha: null,
      upstream: null,
      isDetached: false,
      isBare: false,
      isWorktree: false,
      operation: { type: "none" as const },
      ahead: null,
      behind: null,
      conflictCount: 0,
      changeDigest: null,
      dirty: false,
      trusted: true,
      protectedBranch: false,
      lastRefreshAt: 0,
    };

    expect(
      svc.resolveRepositoryForResource(
        [repo],
        "/workspace/repository/file.ts",
      ),
    ).toBeNull();
  });
});
