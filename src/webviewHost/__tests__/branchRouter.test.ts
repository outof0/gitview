import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "../messageRouter";
import { createRepositoryService } from "../../services/repositoryService";
import { createProtectionService } from "../../services/protectionService";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { GitExecFn } from "../../services/git/types";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import type { ForceCheckoutConfirmationEvidence } from "../../shared/types/confirmation";

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
      "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname)|%(HEAD) refs/heads/ refs/remotes/":
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
      "show-ref --verify --quiet refs/remotes/origin/feature": {
        stdout: "",
        stderr: "",
      },
      "switch --track -c feature origin/feature": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": { stdout: "## feature\0", stderr: "" },
      "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname)|%(HEAD) refs/heads/ refs/remotes/":
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

  it("checks out a local branch with a slash in its name as itself", async () => {
    // Regression: every ref containing "/" was treated as a remote branch, so
    // the ordinary local branch `feature/login` was checked out as a brand new
    // branch named `login` tracking `feature/login`.
    const execGit = makeExecGit({
      "rev-parse --show-toplevel": { stdout: "/repo\n", stderr: "" },
      "rev-parse --git-dir": { stdout: ".git\n", stderr: "" },
      "rev-parse HEAD": { stdout: "abc\n", stderr: "" },
      "status --porcelain": { stdout: "", stderr: "" },
      // Present => git confirms this is a local branch.
      "show-ref --verify --quiet refs/heads/feature/login": {
        stdout: "",
        stderr: "",
      },
      "switch feature/login": { stdout: "", stderr: "" },
      "status --porcelain=v1 -z -b": {
        stdout: "## feature/login\0",
        stderr: "",
      },
      "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname)|%(HEAD) refs/heads/ refs/remotes/":
        {
          stdout:
            "main|refs/heads/main||abc|\nfeature/login|refs/heads/feature/login||def|*\n",
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
      requestId: "co-slash-1",
      type: "branch.checkout",
      payload: { repoId: repos[0]!.id, ref: "feature/login" },
    });

    const response = sent.find(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        (m as { type?: string }).type === "branch.checkout",
    ) as { ok?: boolean; payload?: { ref?: string } };

    expect(response?.ok).toBe(true);
    expect(response?.payload?.ref).toBe("feature/login");
  });

  it("rejects stale force checkout evidence before switching branches", async () => {
    let targetSha = "def";
    const execGit = vi.fn<GitExecFn>((_repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --show-toplevel") {
        return Promise.resolve({ stdout: "/repo\n", stderr: "" });
      }
      if (key === "rev-parse --git-dir") {
        return Promise.resolve({ stdout: ".git\n", stderr: "" });
      }
      if (key === "rev-parse HEAD") {
        return Promise.resolve({ stdout: "abc\n", stderr: "" });
      }
      if (
        key ===
        "for-each-ref --format=%(refname:short)|%(refname)|%(upstream:short)|%(objectname)|%(HEAD) refs/heads/ refs/remotes/"
      ) {
        return Promise.resolve({
          stdout: `main|refs/heads/main||abc|*\nfeature|refs/heads/feature||${targetSha}|\n`,
          stderr: "",
        });
      }
      if (key === "switch -f feature") {
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      if (key === "status --porcelain=v1 -z -b") {
        return Promise.resolve({ stdout: "## feature\0", stderr: "" });
      }
      throw new Error(`Unexpected git call: ${key}`);
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
      postMessage: (message) => sent.push(message),
    });
    const [repo] = await repositoryService.discoverRepositories({
      workspaceFolders: [{ uriPath: "/repo", name: "repo" }],
      trusted: true,
    });
    expect(repo).toBeTruthy();

    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "force-preflight",
      type: "branch.checkout",
      payload: { repoId: repo!.id, ref: "feature", force: true },
    });
    const preflight = sent.find(
      (message) =>
        (message as { requestId?: string }).requestId === "force-preflight",
    ) as {
      error?: { details?: { confirmation?: ForceCheckoutConfirmationEvidence } };
    };
    const evidence = preflight.error?.details?.confirmation;
    expect(evidence).toMatchObject({
      action: "force_checkout",
      targetRef: "feature",
      targetSha: "def",
    });

    targetSha = "fed";
    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "force-stale",
      type: "branch.checkout",
      payload: {
        repoId: repo!.id,
        ref: "feature",
        force: true,
        confirmation: { evidence: evidence!, typedValue: "feature" },
      },
    });
    const stale = sent.find(
      (message) => (message as { requestId?: string }).requestId === "force-stale",
    ) as {
      error?: {
        code?: string;
        details?: { confirmation?: ForceCheckoutConfirmationEvidence };
      };
    };
    expect(stale.error?.code).toBe("CONFIRMATION_STALE");
    expect(stale.error?.details?.confirmation?.targetSha).toBe("fed");
    expect(execGit).not.toHaveBeenCalledWith(repo!.rootPath, [
      "switch",
      "-f",
      "feature",
    ]);

    const replacement = stale.error?.details?.confirmation;
    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "force-submit",
      type: "branch.checkout",
      payload: {
        repoId: repo!.id,
        ref: "feature",
        force: true,
        confirmation: { evidence: replacement!, typedValue: "feature" },
      },
    });
    const completed = sent.find(
      (message) => (message as { requestId?: string }).requestId === "force-submit",
    ) as { ok?: boolean };
    expect(completed.ok).toBe(true);
    expect(execGit).toHaveBeenCalledWith(repo!.rootPath, [
      "switch",
      "-f",
      "feature",
    ]);
  });
});
