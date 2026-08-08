import type { ReviewItem } from "../../shared/types/review";
import type { GithubRepoCoordinates } from "./githubRemote";
import { mapGithubItem } from "./githubApiMappers";
import type { GithubPullRequest } from "./githubApiTypes";
import type { GithubRequestFn } from "./githubApiRead";

export function createGithubWriteApi(request: GithubRequestFn) {
  return {
    async createPullRequest(
      coords: GithubRepoCoordinates,
      opts: {
        title: string;
        sourceBranch: string;
        targetBranch: string;
        body?: string;
        draft?: boolean;
      },
    ): Promise<ReviewItem> {
      const pr = await request<GithubPullRequest>(
        `/repos/${coords.owner}/${coords.repo}/pulls`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: opts.title,
            head: opts.sourceBranch,
            base: opts.targetBranch,
            body: opts.body ?? "",
            draft: opts.draft ?? false,
          }),
        },
      );
      return mapGithubItem(pr);
    },

    async createPullReviewComment(
      coords: GithubRepoCoordinates,
      number: number,
      opts: {
        path: string;
        line: number;
        body: string;
        commitId: string;
        side?: "LEFT" | "RIGHT";
      },
    ): Promise<{ commentId: string }> {
      const comment = await request<{ id: number }>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: opts.body,
            commit_id: opts.commitId,
            path: opts.path,
            line: opts.line,
            side: opts.side ?? "RIGHT",
          }),
        },
      );
      return { commentId: String(comment.id) };
    },

    async submitReview(
      coords: GithubRepoCoordinates,
      number: number,
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
      body?: string,
    ): Promise<void> {
      await request(`/repos/${coords.owner}/${coords.repo}/pulls/${number}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, body: body ?? "" }),
      });
    },

    async mergePullRequest(
      coords: GithubRepoCoordinates,
      number: number,
      method: "merge" | "squash" | "rebase" = "merge",
      opts?: { deleteSourceBranch?: boolean },
    ): Promise<void> {
      await request(`/repos/${coords.owner}/${coords.repo}/pulls/${number}/merge`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merge_method: method,
          delete_branch: opts?.deleteSourceBranch ?? false,
        }),
      });
    },

    async closePullRequest(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<void> {
      await request(`/repos/${coords.owner}/${coords.repo}/pulls/${number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "closed" }),
      });
    },

    async reopenPullRequest(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<void> {
      await request(`/repos/${coords.owner}/${coords.repo}/pulls/${number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "open" }),
      });
    },

    async deletePullRequestHeadBranch(
      coords: GithubRepoCoordinates,
      branchName: string,
    ): Promise<void> {
      const encoded = branchName
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      await request(
        `/repos/${coords.owner}/${coords.repo}/git/refs/heads/${encoded}`,
        { method: "DELETE" },
      );
    },

    async getMergeability(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<{ mergeable: boolean; blockedReason?: string }> {
      const pr = await request<GithubPullRequest>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}`,
      );
      if (pr.merged_at || pr.merged) {
        return { mergeable: false, blockedReason: "Pull request is already merged." };
      }
      if (pr.state !== "open") {
        return { mergeable: false, blockedReason: "Pull request is not open." };
      }
      if (pr.mergeable_state && pr.mergeable_state !== "clean") {
        return {
          mergeable: false,
          blockedReason: `Merge blocked: ${pr.mergeable_state}.`,
        };
      }
      return { mergeable: true };
    },
  };
}
