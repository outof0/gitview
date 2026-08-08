import { describe, expect, it, vi } from "vitest";
import { resolveLegacyWorkspaceRoot } from "../resolveLegacyWorkspaceRoot";
import type { GitViewContext } from "../../activation";

vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/workspace-a" } }],
    isTrusted: true,
  },
}));

function makeGitView(
  repos: Array<{
    id: string;
    rootPath: string;
    workspaceFolderPath: string | null;
  }>,
): GitViewContext {
  const repositoryService = {
    discoverRepositories: vi.fn(async () => repos),
    resolveRepositoryForResource: vi.fn(
      (
        discovered: typeof repos,
        _resourcePath?: string,
        explicitRepoId?: string,
      ) => {
        if (explicitRepoId) {
          return discovered.find((r) => r.id === explicitRepoId) ?? null;
        }
        return discovered[0] ?? null;
      },
    ),
  };
  return { repositoryService } as unknown as GitViewContext;
}

describe("resolveLegacyWorkspaceRoot", () => {
  it("returns the matched repo root when repoId resolves", async () => {
    const gitView = makeGitView([
      {
        id: "repo-a",
        rootPath: "/workspace-a/repo-a",
        workspaceFolderPath: "/workspace-a",
      },
      {
        id: "repo-b",
        rootPath: "/workspace-b/repo-b",
        workspaceFolderPath: "/workspace-b",
      },
    ]);

    await expect(
      resolveLegacyWorkspaceRoot(gitView, "repo-b"),
    ).resolves.toBe("/workspace-b");
  });

  it("does not fall back to workspace #1 when explicit repoId is stale", async () => {
    const gitView = makeGitView([
      {
        id: "repo-a",
        rootPath: "/workspace-a/repo-a",
        workspaceFolderPath: "/workspace-a",
      },
    ]);

    await expect(
      resolveLegacyWorkspaceRoot(gitView, "stale-repo-id"),
    ).resolves.toBeUndefined();
  });

  it("falls back to the first workspace folder when repoId is omitted", async () => {
    const gitView = makeGitView([]);

    await expect(resolveLegacyWorkspaceRoot(gitView)).resolves.toBe(
      "/workspace-a",
    );
  });
});