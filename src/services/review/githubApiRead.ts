import type {
  ReviewComment,
  ReviewDetailsSnapshot,
  ReviewFile,
  ReviewItem,
  ReviewSuggestion,
  ReviewTimelineEntry,
} from "../../shared/types/review";
import type { GithubRepoCoordinates } from "./githubRemote";
import {
  buildGithubReviewComments,
  buildGithubTimeline,
  mapGithubItem,
  pullRequestCapabilities,
} from "./githubApiMappers";
import type {
  GithubIssue,
  GithubIssueComment,
  GithubPullCommit,
  GithubPullFile,
  GithubPullRequest,
  GithubPullReviewComment,
  GithubReview,
} from "./githubApiTypes";

export type GithubRequestFn = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createGithubReadApi(request: GithubRequestFn) {
  return {
    async listPullRequests(
      coords: GithubRepoCoordinates,
      state: "open" | "closed" | "all" = "open",
    ): Promise<ReviewItem[]> {
      const issueState = state === "all" ? "all" : state;
      const [pulls, issues] = await Promise.all([
        request<GithubPullRequest[]>(
          `/repos/${coords.owner}/${coords.repo}/pulls?state=${state}&per_page=100`,
        ),
        request<GithubIssue[]>(
          `/repos/${coords.owner}/${coords.repo}/issues?state=${issueState}&per_page=100`,
        ),
      ]);
      const issueMetaByNumber = new Map<
        number,
        { labels: string[]; assignees: string[]; milestone?: string }
      >(
        issues.map((issue) => [
          issue.number,
          {
            labels: (issue.labels ?? [])
              .map((label) => label.name?.trim())
              .filter((name): name is string => Boolean(name)),
            assignees: (issue.assignees ?? [])
              .map((assignee) => assignee.login?.trim())
              .filter((login): login is string => Boolean(login)),
            milestone: issue.milestone?.title?.trim() || undefined,
          },
        ]),
      );
      return pulls.map((pull) =>
        mapGithubItem(pull, issueMetaByNumber.get(pull.number) ?? {}),
      );
    },

    async getPullRequest(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<ReviewDetailsSnapshot["review"]> {
      const pr = await request<GithubPullRequest>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}`,
      );
      return mapGithubItem(pr);
    },

    async getPullRequestRaw(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<GithubPullRequest> {
      return request<GithubPullRequest>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}`,
      );
    },

    getPullRequestCapabilities(pr: GithubPullRequest) {
      return pullRequestCapabilities(pr);
    },

    async getPullRequestFiles(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<ReviewFile[]> {
      const files = await request<GithubPullFile[]>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}/files?per_page=100`,
      );
      return files.map((file) => ({
        id: file.sha,
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      }));
    },

    async getPullRequestCommits(
      coords: GithubRepoCoordinates,
      number: number,
    ) {
      const commits = await request<GithubPullCommit[]>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}/commits?per_page=100`,
      );
      return commits.map((entry) => ({
        sha: entry.sha,
        message: entry.commit.message.split("\n")[0] ?? entry.commit.message,
        author: entry.commit.author?.name ?? "unknown",
        createdAt: entry.commit.author?.date ?? new Date(0).toISOString(),
      }));
    },

    async getPullRequestTimeline(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<{ timeline: ReviewTimelineEntry[]; comments: ReviewComment[] }> {
      const [issueComments, reviews] = await Promise.all([
        request<GithubIssueComment[]>(
          `/repos/${coords.owner}/${coords.repo}/issues/${number}/comments?per_page=100`,
        ),
        request<GithubReview[]>(
          `/repos/${coords.owner}/${coords.repo}/pulls/${number}/reviews?per_page=100`,
        ),
      ]);

      return buildGithubTimeline(issueComments, reviews);
    },

    async getPullRequestReviewComments(
      coords: GithubRepoCoordinates,
      number: number,
    ): Promise<{ comments: ReviewComment[]; suggestions: ReviewSuggestion[] }> {
      const reviewComments = await request<GithubPullReviewComment[]>(
        `/repos/${coords.owner}/${coords.repo}/pulls/${number}/comments?per_page=100`,
      );

      return buildGithubReviewComments(reviewComments);
    },
  };
}
