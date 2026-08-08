import { describe, expect, it, vi } from "vitest";
import type { Repository } from "../../shared/types/repository";
import {
  checkoutGitlabReviewBranch,
  closeGitlabReview,
  deleteGitlabMergedSourceBranch,
  listGitlabReviews,
  openGitlabReview,
  reopenGitlabReview,
} from "../review/gitlabProvider";
import type { ReviewFetch } from "../review/reviewFetch";
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

function mockFetch(): ReviewFetch {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes(`/merge_requests?state=opened`)) {
      return new Response(
        JSON.stringify([
          {
            id: 10,
            iid: 7,
            title: "Feature",
            state: "opened",
            author: { username: "dev" },
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
            source_branch: "feature",
            target_branch: "main",
            source_project_id: 1,
            target_project_id: 1,
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes(`/merge_requests/7/changes`)) {
      return new Response(
        JSON.stringify({
          changes: [
            {
              old_path: "src/a.ts",
              new_path: "src/a.ts",
              diff: "@@ -1 +1 @@\n-old\n+new\n",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes(`/merge_requests/7/commits`)) {
      return new Response(
        JSON.stringify([
          {
            id: "deadbeef",
            short_id: "deadbee",
            title: "Implement feature",
            message: "Implement feature",
            author_name: "dev",
            created_at: "2026-01-01T00:00:00Z",
          },
        ]),
        { status: 200 },
      );
    }
    if (url.includes(`/merge_requests/7/notes`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes(`/merge_requests/7/discussions`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes(`/merge_requests/7`) && init?.method === "PUT") {
      return new Response("{}", { status: 200 });
    }
    if (
      url.includes(`/repository/branches/feature`) &&
      init?.method === "DELETE"
    ) {
      return new Response(null, { status: 204 });
    }
    if (url.includes(`/merge_requests/7`)) {
      return new Response(
        JSON.stringify({
          id: 10,
          iid: 7,
          title: "Feature",
          state: "opened",
          merge_status: "can_be_merged",
          author: { username: "dev" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-02T00:00:00Z",
          source_branch: "feature",
          target_branch: "main",
          source_project_id: 1,
          target_project_id: 1,
        }),
        { status: 200 },
      );
    }
    if (url.includes(`/merge_requests/8/changes`)) {
      return new Response(JSON.stringify({ changes: [] }), { status: 200 });
    }
    if (url.includes(`/merge_requests/8/commits`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes(`/merge_requests/8/notes`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes(`/merge_requests/8/discussions`)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (url.includes(`/merge_requests/8`)) {
      return new Response(
        JSON.stringify({
          id: 11,
          iid: 8,
          title: "Merged",
          state: "merged",
          merged_at: "2026-01-03T00:00:00Z",
          author: { username: "dev" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-03T00:00:00Z",
          source_branch: "feature",
          target_branch: "main",
          source_project_id: 1,
          target_project_id: 1,
        }),
        { status: 200 },
      );
    }
    return new Response(`not found: ${url}`, { status: 404 });
  }) as ReviewFetch;
}

const execGit = vi.fn(async () => ({ stdout: "", stderr: "", code: 0 }));

describe("gitlab provider integration", () => {
  const ctx = {
    execGit,
    getAccessToken: async () => "token",
    fetchFn: mockFetch(),
  };

  it("lists merge requests from GitLab API", async () => {
    execGit.mockResolvedValue({
      stdout: "https://gitlab.com/acme/app.git\n",
      stderr: "",
      code: 0,
    });
    const result = await listGitlabReviews(ctx, repo, { state: "open" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.number).toBe(7);
    expect(result.authRequired).toBe(false);
  });

  it("opens merge request details with capabilities", async () => {
    execGit.mockResolvedValueOnce({
      stdout: "https://gitlab.com/acme/app.git\n",
      stderr: "",
      code: 0,
    });
    const details = await openGitlabReview(ctx, repo, "7");
    expect(details?.providerId).toBe("gitlab");
    expect(details?.canClose).toBe(true);
    expect(details?.canCheckoutBranch).toBe(true);
    expect(details?.files[0]?.path).toBe("src/a.ts");
  });

  it("closes and reopens merge requests", async () => {
    execGit.mockResolvedValue({
      stdout: "https://gitlab.com/acme/app.git\n",
      stderr: "",
      code: 0,
    });
    await closeGitlabReview(ctx, repo, "7");
    await reopenGitlabReview(ctx, repo, "7");
    expect(ctx.fetchFn).toHaveBeenCalled();
  });

  it("deletes merged source branch when allowed", async () => {
    execGit.mockResolvedValue({
      stdout: "https://gitlab.com/acme/app.git\n",
      stderr: "",
      code: 0,
    });
    const result = await deleteGitlabMergedSourceBranch(ctx, repo, "8");
    expect(result.branch).toBe("feature");
  });

  it("checks out merge request branch via git fetch", async () => {
    execGit.mockResolvedValue({
      stdout: "https://gitlab.com/acme/app.git\n",
      stderr: "",
      code: 0,
    });
    const result = await checkoutGitlabReviewBranch(ctx, repo, "7");
    expect(result.branch).toBe("review/mr-7");
    expect(execGit).toHaveBeenCalledWith(
      repo.rootPath,
      ["fetch", "origin", "refs/merge-requests/7/head:review/mr-7"],
    );
  });
});