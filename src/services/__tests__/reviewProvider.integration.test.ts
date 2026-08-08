import { describe, expect, it, afterEach, vi } from "vitest";
import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { createReviewProviderRegistry } from "../review/providerRegistry";
import { detectHostedRemote } from "../review/remoteDetect";
import type { Repository } from "../../shared/types/repository";
import {
  createTempGitRepo,
  execGit,
  type TempGitRepo,
} from "../../test/helpers/tempGitRepo";

const exec = promisify(execFile);

const gitEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "echo",
};

function asRepo(root: string): Repository {
  return {
    id: "repo-1",
    rootPath: root,
    workspaceFolderPath: root,
    gitDirPath: `${root}/.git`,
    name: "repo",
    currentBranch: "main",
    headSha: null,
    upstream: null,
    isDetached: false,
    isBare: false,
    isWorktree: false,
    operation: { type: "none" },
    ahead: null,
    behind: null,
    conflictCount: 0,
    dirty: false,
    trusted: true,
    protectedBranch: false,
    lastRefreshAt: Date.now(),
  };
}

describe("review provider integration", () => {
  let repo: TempGitRepo | null = null;

  afterEach(async () => {
    if (repo) {
      await fs.rm(path.dirname(repo.root), { recursive: true, force: true });
      repo = null;
    }
  });

  it("detects GitHub remote URLs", () => {
    expect(detectHostedRemote("https://github.com/acme/app.git")).toBe("github");
    expect(detectHostedRemote("git@github.com:acme/app.git")).toBe("github");
    expect(detectHostedRemote("https://gitlab.com/acme/app.git")).toBe("gitlab");
    expect(detectHostedRemote("https://example.com/app.git")).toBeNull();
  });

  it("lists GitHub provider as available when origin is GitHub", async () => {
    repo = await createTempGitRepo();
    await exec("git", ["remote", "add", "origin", "https://github.com/acme/app.git"], {
      cwd: repo.root,
      env: gitEnv,
    });

    const registry = createReviewProviderRegistry({ execGit });
    const providers = await registry.listProviders(asRepo(repo.root));
    expect(providers).toHaveLength(2);
    const github = providers.find((provider) => provider.id === "github");
    const gitlab = providers.find((provider) => provider.id === "gitlab");
    expect(github?.available).toBe(true);
    expect(github?.authRequired).toBe(true);
    expect(gitlab?.available).toBe(false);
  }, 15_000);

  it("lists GitLab provider as available when origin is GitLab", async () => {
    repo = await createTempGitRepo();
    await exec("git", ["remote", "add", "origin", "https://gitlab.com/acme/app.git"], {
      cwd: repo.root,
      env: gitEnv,
    });

    const registry = createReviewProviderRegistry({ execGit });
    const providers = await registry.listProviders(asRepo(repo.root));
    const gitlab = providers.find((provider) => provider.id === "gitlab");
    const github = providers.find((provider) => provider.id === "github");
    expect(gitlab?.available).toBe(true);
    expect(gitlab?.authRequired).toBe(true);
    expect(github?.available).toBe(false);
  }, 15_000);

  it("returns auth-required state for GitHub list without token", async () => {
    repo = await createTempGitRepo();
    await exec("git", ["remote", "add", "origin", "https://github.com/acme/app.git"], {
      cwd: repo.root,
      env: gitEnv,
    });

    const registry = createReviewProviderRegistry({ execGit });
    const result = await registry.listReviews(asRepo(repo.root), "github", {
      state: "open",
    });
    expect(result.items).toEqual([]);
    expect(result.authRequired).toBe(true);
  }, 15_000);

  it("routes close and reopen through the GitHub provider registry", async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/pulls/5") && init?.method === "PATCH") {
        return new Response("{}", { status: 200 });
      }
      if (url.includes("/pulls/5/files")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/pulls/5/commits")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/issues/5/comments")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/pulls/5/reviews")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/pulls/5/comments")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      if (url.includes("/pulls/5")) {
        return new Response(
          JSON.stringify({
            id: 1,
            number: 5,
            title: "PR",
            state: "open",
            mergeable_state: "clean",
            user: { login: "dev" },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            head: { ref: "feature", repo: { full_name: "acme/app" } },
            base: { ref: "main", repo: { full_name: "acme/app" } },
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    repo = await createTempGitRepo();
    await exec("git", ["remote", "add", "origin", "https://github.com/acme/app.git"], {
      cwd: repo.root,
      env: gitEnv,
    });

    const registry = createReviewProviderRegistry({
      execGit,
      getAccessToken: async () => "token",
      fetchFn: fetchFn as never,
    });

    await registry.closeReview(asRepo(repo.root), "github", "5");
    await registry.reopenReview(asRepo(repo.root), "github", "5");
    const details = await registry.openReview(asRepo(repo.root), "github", "5");
    expect(details?.canClose).toBe(true);
    expect(fetchFn).toHaveBeenCalled();
  }, 15_000);

  it("registers and disposes third-party providers without changing the registry", async () => {
    const registry = createReviewProviderRegistry(
      { execGit },
      [],
    );
    const provider = {
      id: "forge.example",
      displayName: "Example Forge",
      describe: vi.fn(async () => ({
        id: "forge.example",
        displayName: "Example Forge",
        available: true,
        authRequired: false,
      })),
      listReviews: vi.fn(async () => ({
        items: [],
        authRequired: false,
      })),
      openReview: vi.fn(async () => null),
    };

    const registration = registry.registerProvider(provider);
    expect(registry.hasProvider("forge.example")).toBe(true);
    expect(await registry.listProviders(asRepo("/repo"))).toEqual([
      expect.objectContaining({ id: "forge.example", available: true }),
    ]);
    await registry.listReviews(asRepo("/repo"), "forge.example", {});
    expect(provider.listReviews).toHaveBeenCalled();

    registration.dispose();
    expect(registry.hasProvider("forge.example")).toBe(false);
  });

  it("isolates a failing provider while listing provider availability", async () => {
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const registry = createReviewProviderRegistry({ execGit, logger }, []);
    registry.registerProvider({
      id: "forge.broken",
      displayName: "Broken Forge",
      describe: async () => {
        throw new Error("service unavailable");
      },
      listReviews: async () => ({ items: [], authRequired: false }),
      openReview: async () => null,
    });

    expect(await registry.listProviders(asRepo("/repo"))).toEqual([
      expect.objectContaining({
        id: "forge.broken",
        available: false,
        unavailableReason: "service unavailable",
      }),
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      "review.provider.describe.failed",
      expect.objectContaining({
        providerId: "forge.broken",
        errorMessage: "service unavailable",
      }),
    );
  });
});
