import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/ws" }, name: "ws" }],
    isTrusted: true,
  },
}));

vi.mock("../../commands/gitMenuActions", () => ({
  runGitMenuAction: vi.fn(),
}));

vi.mock("../../config/readConfirmDestructiveActions", () => ({
  readConfirmDestructiveActions: () => true,
}));

vi.mock("../../webviewHost/messageRouter", () => ({
  createMessageRouter: vi.fn(),
}));

vi.mock("../resolveLegacyWorkspaceRoot", () => ({
  resolveLegacyWorkspaceRoot: vi.fn(),
}));

import { resolveRepoIdForResource } from "../gitViewPanelRouter";
import type { GitViewContext } from "../../application/gitViewContext";

describe("resolveRepoIdForResource", () => {
  const discoverRepositories = vi.fn();
  const resolveRepositoryForResource = vi.fn();
  const getCachedRepositories = vi.fn();

  const gitView = {
    repositoryService: {
      getCachedRepositories,
      resolveRepositoryForResource,
      discoverRepositories,
    },
  } as unknown as GitViewContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the cached repository without rediscovering", async () => {
    const cached = [{ id: "repo-cached", rootPath: "/ws" }];
    getCachedRepositories.mockReturnValue(cached);
    resolveRepositoryForResource.mockReturnValue(cached[0]);

    await expect(
      resolveRepoIdForResource(gitView, "/ws", "src/app.ts"),
    ).resolves.toBe("repo-cached");

    expect(discoverRepositories).not.toHaveBeenCalled();
    expect(resolveRepositoryForResource).toHaveBeenCalledWith(
      cached,
      expect.stringContaining("src/app.ts"),
    );
  });

  it("falls back to discovery when the cache has no match", async () => {
    getCachedRepositories.mockReturnValue([]);
    resolveRepositoryForResource
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ id: "repo-discovered", rootPath: "/ws" });
    discoverRepositories.mockResolvedValue([
      { id: "repo-discovered", rootPath: "/ws" },
    ]);

    await expect(
      resolveRepoIdForResource(gitView, "/ws", "src/app.ts"),
    ).resolves.toBe("repo-discovered");

    expect(discoverRepositories).toHaveBeenCalledWith(
      expect.objectContaining({
        resourcePath: expect.stringContaining("src/app.ts"),
        trusted: true,
      }),
    );
  });
});
