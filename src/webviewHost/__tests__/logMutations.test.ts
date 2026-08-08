import { describe, expect, it, vi } from "vitest";
import { createLogHandlers } from "../handlers/log";
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

describe("log handlers mutations", () => {
  it("requires confirmation for destructive reset", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
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
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.reset("reset-1", repos[0]!.id, "deadbeef", "hard");

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("requires confirmation before undoing the last commit", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
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
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.undoLastCommit("undo-1", repos[0]!.id);

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("undoes the last commit with mixed reset when confirmed", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "reset --mixed HEAD~1": { stdout: "", stderr: "" },
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

    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.undoLastCommit("undo-1", repos[0]!.id, true);

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.undoLastCommit",
    ) as { ok?: boolean; payload?: { ok: boolean } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ok).toBe(true);
    expect(refreshNow).toHaveBeenCalled();
  });

  it("requires confirmation before dropping a commit", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
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
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.dropCommit("drop-1", repos[0]!.id, "deadbeef");

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("requires confirmation before editing a commit message", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
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
    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.editMessage(
      "edit-1",
      repos[0]!.id,
      "deadbeef",
      "new subject",
    );

    const error = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { ok?: boolean }).ok === false,
    ) as { error?: { code?: string } };

    expect(error?.error?.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("extracts changes from a commit", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "cherry-pick -n deadbeef": { stdout: "", stderr: "" },
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

    const handlers = createLogHandlers({
      execGit,
      repositoryService,
      protectionService: createProtectionService([]),
      refreshCoordinator,
      trusted: true,
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      postMessage: (msg) => sent.push(msg),
    });

    const repos = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });

    await handlers.extractChangesFromCommit(
      "extract-1",
      repos[0]!.id,
      "deadbeef",
    );

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "log.extractChanges",
    ) as { ok?: boolean; payload?: { sha: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.sha).toBe("deadbeef");
    expect(refreshNow).toHaveBeenCalled();
  });
});