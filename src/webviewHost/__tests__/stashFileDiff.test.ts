import { describe, expect, it, vi } from "vitest";
import { createStashHandlers } from "../handlers/temporaryWorkStash";
import { createTemporaryWorkContext } from "../handlers/temporaryWorkHelpers";
import { createRepositoryService } from "../../services/repositoryService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import type { HostToWebview } from "../../shared/protocol";

function setup() {
  const calls: string[][] = [];
  const execGit: GitExecFn = (_repoRoot, args) => {
    calls.push(args);
    const key = args.join(" ");
    if (key === "rev-parse --show-toplevel") {
      return Promise.resolve({ stdout: "/repo\n", stderr: "" });
    }
    if (key === "rev-parse --git-dir") {
      return Promise.resolve({ stdout: ".git\n", stderr: "" });
    }
    return Promise.resolve({ stdout: "", stderr: "" });
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

  const sent: HostToWebview[] = [];
  const ctx = createTemporaryWorkContext({
    execGit,
    repositoryService,
    refreshCoordinator,
    shelfStorage: {
      list: () => [],
      save: vi.fn(),
      remove: vi.fn(),
    } as never,
    trusted: true,
    workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
    postMessage: (message) => sent.push(message),
  });

  return {
    handlers: createStashHandlers(ctx),
    sent,
    calls,
    repoId: repositoryService.stableRepoId("/repo"),
  };
}

describe("stash file diff path validation", () => {
  it("rejects a path that escapes the repository root", async () => {
    const { handlers, sent, calls, repoId } = setup();
    calls.length = 0;

    await handlers.getStashFileDiff("req-1", repoId, 0, "../../etc/passwd");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      requestId: "req-1",
      ok: false,
      error: { code: "INVALID_PATH" },
    });
    // The traversal must be rejected before any git command runs.
    expect(calls.some((args) => args.includes("show"))).toBe(false);
  });

  it("rejects an absolute path outside the repository", async () => {
    const { handlers, sent, repoId } = setup();

    await handlers.getStashFileDiff("req-2", repoId, 0, "/etc/passwd");

    expect(sent[0]).toMatchObject({
      requestId: "req-2",
      ok: false,
      error: { code: "INVALID_PATH" },
    });
  });

  it("allows a normal repo-relative path", async () => {
    const { handlers, sent, repoId } = setup();

    await handlers.getStashFileDiff("req-3", repoId, 0, "src/app.ts");

    expect(sent[0]).toMatchObject({ requestId: "req-3", ok: true });
  });
});
