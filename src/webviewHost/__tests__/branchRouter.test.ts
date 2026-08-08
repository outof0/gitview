import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";

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

describe("messageRouter branch handlers", () => {
  it("returns branch.snapshot on branch.list", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname:short)|%(HEAD) refs/heads/ refs/remotes/":
        {
          stdout:
            "main|refs/heads/main||abc|*\nfeature|refs/heads/feature||def|\n",
          stderr: "",
        },
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
    const router = createMessageRouter({
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

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "br-1",
      type: "branch.list",
      payload: { repoId: repos[0]!.id },
    });

    const event = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.snapshot",
    ) as { payload?: { branches?: Array<{ name: string; current: boolean }> } };

    expect(event?.payload?.branches?.some((b) => b.name === "main" && b.current)).toBe(
      true,
    );
  });

  it("checks out a branch and refreshes", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "status --porcelain": { stdout: "", stderr: "" },
      "switch feature": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## feature\0", stderr: "" },
    });

    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
    });
    const refreshListener = vi.fn();
    const refreshCoordinator = createRefreshCoordinator({
      execGit,
      repositoryService,
      getWorkspaceFolders: () => [{ uriPath: "/repo", name: "repo" }],
      getTrusted: () => true,
    });
    refreshCoordinator.subscribe(refreshListener);

    const sent: unknown[] = [];
    const router = createMessageRouter({
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

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "co-1",
      type: "branch.checkout",
      payload: { repoId: repos[0]!.id, ref: "feature" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.checkout",
    ) as { ok?: boolean; payload?: { ref?: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ref).toBe("feature");
    expect(refreshListener).toHaveBeenCalled();
  });

  it("checks out a remote branch as tracking local branch", async () => {
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "status --porcelain": { stdout: "", stderr: "" },
      "switch --track -c feature origin/feature": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## feature\0", stderr: "" },
      "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname:short)|%(HEAD) refs/heads/ refs/remotes/":
        {
          stdout:
            "main|refs/heads/main||abc|\nfeature|refs/heads/feature|origin/feature|def|*\n",
          stderr: "",
        },
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
    const router = createMessageRouter({
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

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "co-remote-1",
      type: "branch.checkout",
      payload: {
        repoId: repos[0]!.id,
        ref: "origin/feature",
      },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.checkout",
    ) as { ok?: boolean; payload?: { ref?: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ref).toBe("origin/feature");
  });
});