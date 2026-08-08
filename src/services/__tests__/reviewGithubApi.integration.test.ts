import { describe, expect, it, vi } from "vitest";
import type { Repository } from "../../shared/types/repository";
import {
  checkoutGithubReviewBranch,
  closeGithubReview,
  deleteGithubMergedSourceBranch,
  listGithubReviews,
  openGithubReview,
  reopenGithubReview,
} from "../review/githubProvider";
import type { GithubFetch } from "../review/githubApi";

const repo: Repository = {
  id: "repo-1",
  rootPath: "/repo",
  workspaceFolderPath: "/repo",
  gitDirPath: "/repo/.git",
  name: "app",
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

function mockFetch(): GithubFetch {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/pulls?state=")) {
      return new Response(
        JSON.stringify([
          {
            id: 1,
            number: 7,
            title: "Feature",
            state: "open",
            user: { login: "dev" },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            head: { ref: "feature" },
            base: { ref: "main" },
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes("/issues?state=")) {
      return new Response(
        JSON.stringify([
          {
            number: 7,
            labels: [{ name: "enhancement" }],
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes("/pulls/7/files")) {
      return new Response(
        JSON.stringify([
          {
            sha: "abc",
            filename: "src/a.ts",
            status: "modified",
            additions: 2,
            deletions: 1,
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes("/pulls/7/commits")) {
      return new Response(
        JSON.stringify([
          {
            sha: "deadbeef",
            commit: {
              message: "Implement feature",
              author: { name: "dev", date: "2026-01-01T00:00:00Z" },
            },
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes("/issues/7/comments")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/7/reviews")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/7/comments")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/7") && init?.method === "PATCH") {
      return new Response("{}", { status: 200 });
    }
    if (url.includes("/git/refs/heads/feature") && init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    if (url.includes("/pulls/7")) {
      return new Response(
        JSON.stringify({
          id: 1,
          number: 7,
          title: "Feature",
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
    if (url.includes("/pulls/8/files")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/8/commits")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/issues/8/comments")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/8/reviews")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/8/comments")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes("/pulls/8")) {
      return new Response(
        JSON.stringify({
          id: 2,
          number: 8,
          title: "Merged",
          state: "closed",
          merged_at: "2026-01-03T00:00:00Z",
          user: { login: "dev" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-03T00:00:00Z",
          head: { ref: "feature", repo: { full_name: "acme/app" } },
          base: { ref: "main", repo: { full_name: "acme/app" } },
        }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as GithubFetch;
}

describe("review GitHub API integration", () => {
  it("lists and opens pull requests with mocked GitHub API", async () => {
    const execGit = vi.fn(async (_root: string, args: string[]) => {
      if (args.join(" ") === "remote get-url origin") {
        return { stdout: "https://github.com/acme/app.git\n", stderr: "" };
      }
      throw new Error(`unexpected git call: ${args.join(" ")}`);
    });

    const ctx = {
      execGit,
      getAccessToken: async () => "token",
      fetchFn: mockFetch(),
    };

    const listed = await listGithubReviews(ctx, repo, { state: "open" });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.number).toBe(7);

    const details = await openGithubReview(ctx, repo, "7");
    expect(details?.files).toHaveLength(1);
    expect(details?.commits).toHaveLength(1);
    expect(details?.canMerge).toBe(true);
    expect(details?.canClose).toBe(true);
    expect(details?.canCheckoutBranch).toBe(true);
    expect(details?.suggestions).toEqual([]);
  });

  it("closes, reopens, deletes source branch, and checks out review branch", async () => {
    const execGit = vi.fn(async (_root: string, args: string[]) => {
      const key = args.join(" ");
      if (key === "remote get-url origin") {
        return { stdout: "https://github.com/acme/app.git\n", stderr: "" };
      }
      if (key === "fetch origin refs/pull/7/head:review/pr-7") {
        return { stdout: "", stderr: "" };
      }
      if (key === "switch review/pr-7") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`unexpected git call: ${key}`);
    });

    const ctx = {
      execGit,
      getAccessToken: async () => "token",
      fetchFn: mockFetch(),
    };

    await closeGithubReview(ctx, repo, "7");
    await reopenGithubReview(ctx, repo, "7");

    const merged = await openGithubReview(ctx, repo, "8");
    expect(merged?.canDeleteSourceBranch).toBe(true);
    expect(merged?.canCheckoutBranch).toBe(false);

    const deleted = await deleteGithubMergedSourceBranch(ctx, repo, "8");
    expect(deleted.branch).toBe("feature");

    const checkedOut = await checkoutGithubReviewBranch(ctx, repo, "7");
    expect(checkedOut.branch).toBe("review/pr-7");
  });
});