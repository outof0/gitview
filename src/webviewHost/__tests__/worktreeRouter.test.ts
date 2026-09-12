import { describe, expect, it, vi } from "vitest";
import { createProtectionService } from "../../services/protectionService";
import { createRepositoryService } from "../../services/repositoryService";
import type { GitExecFn } from "../../services/git/types";
import { createRefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import { PROTOCOL_VERSION } from "../../shared/protocol";
import type { RemoveDirtyWorktreeConfirmationEvidence } from "../../shared/types/confirmation";
import { createMessageRouter } from "../messageRouter";

describe("messageRouter worktree handlers", () => {
  it("rejects stale dirty-worktree evidence before force removal", async () => {
    let targetSha = "def";
    let removed = false;
    const execGit = vi.fn<GitExecFn>((repoRoot, args) => {
      const key = args.join(" ");
      if (key === "rev-parse --git-dir") {
        return Promise.resolve({ stdout: ".git\n", stderr: "" });
      }
      if (key === "rev-parse HEAD") {
        return Promise.resolve({ stdout: "abc\n", stderr: "" });
      }
      if (key === "status --porcelain=v1 -z -b" && repoRoot === "/repo") {
        return Promise.resolve({ stdout: "## main\0", stderr: "" });
      }
      if (key === "remote") {
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      if (key === "worktree list --porcelain") {
        const secondary = removed
          ? ""
          : `\nworktree /repo-worktree\nHEAD ${targetSha}\nbranch refs/heads/feature\n`;
        return Promise.resolve({
          stdout: `worktree /repo\nHEAD abc\nbranch refs/heads/main\n${secondary}\n`,
          stderr: "",
        });
      }
      if (
        key === "status --porcelain=v1 -z" &&
        repoRoot === "/repo-worktree"
      ) {
        return Promise.resolve({ stdout: "?? dirty.txt\0", stderr: "" });
      }
      if (key === "worktree remove --force /repo-worktree") {
        removed = true;
        return Promise.resolve({ stdout: "", stderr: "" });
      }
      throw new Error(`Unexpected git call in ${repoRoot}: ${key}`);
    });
    const repositoryService = createRepositoryService({
      execGit,
      discoverGitRoots: async () => ["/repo"],
      detectOperation: async () => ({ type: "none" }),
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
      requestId: "worktree-preflight",
      type: "worktree.remove",
      payload: { repoId: repo!.id, path: "/repo-worktree" },
    });
    const preflight = sent.find(
      (message) =>
        (message as { requestId?: string }).requestId === "worktree-preflight",
    ) as {
      error?: {
        details?: { confirmation?: RemoveDirtyWorktreeConfirmationEvidence };
      };
    };
    const evidence = preflight.error?.details?.confirmation;
    expect(evidence).toMatchObject({
      action: "remove_dirty_worktree",
      target: {
        path: "/repo-worktree",
        headSha: "def",
        branch: "feature",
        dirty: true,
      },
    });

    targetSha = "fed";
    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "worktree-stale",
      type: "worktree.remove",
      payload: {
        repoId: repo!.id,
        path: "/repo-worktree",
        force: true,
        confirmed: true,
        confirmation: {
          evidence: evidence!,
          typedValue: "/repo-worktree",
        },
      },
    });
    const stale = sent.find(
      (message) =>
        (message as { requestId?: string }).requestId === "worktree-stale",
    ) as {
      error?: {
        code?: string;
        details?: { confirmation?: RemoveDirtyWorktreeConfirmationEvidence };
      };
    };
    expect(stale.error?.code).toBe("CONFIRMATION_STALE");
    expect(stale.error?.details?.confirmation?.target.headSha).toBe("fed");
    expect(execGit).not.toHaveBeenCalledWith(repo!.rootPath, [
      "worktree",
      "remove",
      "--force",
      "/repo-worktree",
    ]);

    const replacement = stale.error?.details?.confirmation;
    await router.handleRawMessage({
      protocolVersion: PROTOCOL_VERSION,
      requestId: "worktree-submit",
      type: "worktree.remove",
      payload: {
        repoId: repo!.id,
        path: "/repo-worktree",
        confirmation: {
          evidence: replacement!,
          typedValue: "/repo-worktree",
        },
      },
    });
    const completed = sent.find(
      (message) =>
        (message as { requestId?: string }).requestId === "worktree-submit" &&
        (message as { type?: string }).type === "worktree.remove",
    ) as { ok?: boolean };
    expect(completed.ok).toBe(true);
    expect(execGit).toHaveBeenCalledWith(repo!.rootPath, [
      "worktree",
      "remove",
      "--force",
      "/repo-worktree",
    ]);
  });
});
