import type { ReviewComment, ReviewFile, ReviewItem, ReviewSuggestion, ReviewTimelineEntry } from "../../shared/types/review";
import type { GitlabRepoCoordinates } from "./gitlabRemote";
import {
  buildGitlabDiscussions,
  buildGitlabTimeline,
  countDiffStats,
  mapFileStatus,
  mapGitlabItem,
  mergeRequestCapabilities,
} from "./gitlabApiMappers";
import type {
  GitlabCommit,
  GitlabDiscussion,
  GitlabMergeRequest,
  GitlabMergeRequestChanges,
  GitlabNote,
} from "./gitlabApiTypes";

export type GitlabRequestFn = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createGitlabReadApi(
  request: GitlabRequestFn,
  projectPath: (coords: GitlabRepoCoordinates) => string,
) {
  return {
    async listMergeRequests(
      coords: GitlabRepoCoordinates,
      state: "open" | "closed" | "all" = "open",
    ): Promise<ReviewItem[]> {
      const stateParam =
        state === "open"
          ? "opened"
          : state === "closed"
            ? "closed"
            : "all";
      const mergeRequests = await request<GitlabMergeRequest[]>(
        `/projects/${projectPath(coords)}/merge_requests?state=${stateParam}&per_page=100`,
      );
      let items = mergeRequests.map(mapGitlabItem);
      if (state === "closed") {
        const merged = await request<GitlabMergeRequest[]>(
          `/projects/${projectPath(coords)}/merge_requests?state=merged&per_page=100`,
        );
        items = [...items, ...merged.map(mapGitlabItem)];
      }
      return items;
    },

    async getMergeRequestRaw(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<GitlabMergeRequest> {
      return request<GitlabMergeRequest>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}`,
      );
    },

    getMergeRequestCapabilities(mr: GitlabMergeRequest) {
      return mergeRequestCapabilities(mr);
    },

    async getMergeRequestFiles(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<ReviewFile[]> {
      const changes = await request<GitlabMergeRequestChanges>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}/changes`,
      );
      return changes.changes.map((change, index) => {
        const path = change.new_path || change.old_path;
        const stats = countDiffStats(change.diff);
        return {
          id: `${path}-${index}`,
          path,
          status: mapFileStatus(change),
          additions: stats.additions,
          deletions: stats.deletions,
        };
      });
    },

    async getMergeRequestCommits(coords: GitlabRepoCoordinates, iid: number) {
      const commits = await request<GitlabCommit[]>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}/commits?per_page=100`,
      );
      return commits.map((entry) => ({
        sha: entry.id,
        message: entry.title || entry.message.split("\n")[0] || entry.message,
        author: entry.author_name ?? "unknown",
        createdAt: entry.created_at,
      }));
    },

    async getMergeRequestTimeline(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<{ timeline: ReviewTimelineEntry[]; comments: ReviewComment[] }> {
      const notes = await request<GitlabNote[]>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}/notes?per_page=100&sort=asc`,
      );

      return buildGitlabTimeline(notes);
    },

    async getMergeRequestDiscussions(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<{ comments: ReviewComment[]; suggestions: ReviewSuggestion[] }> {
      const discussions = await request<GitlabDiscussion[]>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}/discussions?per_page=100`,
      );

      return buildGitlabDiscussions(discussions);
    },
  };
}
