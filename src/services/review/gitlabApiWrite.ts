import type { ReviewItem } from "../../shared/types/review";
import type { GitlabRepoCoordinates } from "./gitlabRemote";
import { mapGitlabItem } from "./gitlabApiMappers";
import type { GitlabMergeRequest } from "./gitlabApiTypes";
import type { GitlabRequestFn } from "./gitlabApiRead";

export function createGitlabWriteApi(
  request: GitlabRequestFn,
  projectPath: (coords: GitlabRepoCoordinates) => string,
) {
  return {
    async createMergeRequest(
      coords: GitlabRepoCoordinates,
      opts: {
        title: string;
        sourceBranch: string;
        targetBranch: string;
        body?: string;
      },
    ): Promise<ReviewItem> {
      const mr = await request<GitlabMergeRequest>(
        `/projects/${projectPath(coords)}/merge_requests`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: opts.title,
            source_branch: opts.sourceBranch,
            target_branch: opts.targetBranch,
            description: opts.body ?? "",
          }),
        },
      );
      return mapGitlabItem(mr);
    },

    async createMergeRequestLineComment(
      coords: GitlabRepoCoordinates,
      iid: number,
      opts: {
        path: string;
        line: number;
        body: string;
        baseSha: string;
        startSha: string;
        headSha: string;
      },
    ): Promise<{ commentId: string }> {
      const discussion = await request<{ notes: Array<{ id: number }> }>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}/discussions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: opts.body,
            position: {
              position_type: "text",
              base_sha: opts.baseSha,
              start_sha: opts.startSha,
              head_sha: opts.headSha,
              new_path: opts.path,
              new_line: opts.line,
            },
          }),
        },
      );
      const noteId = discussion.notes[0]?.id;
      if (!noteId) {
        throw new Error("GitLab did not return a discussion note id.");
      }
      return { commentId: String(noteId) };
    },

    async submitReview(
      coords: GitlabRepoCoordinates,
      iid: number,
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
      body?: string,
    ): Promise<void> {
      const encoded = projectPath(coords);
      if (event === "APPROVE") {
        await request(`/projects/${encoded}/merge_requests/${iid}/approve`, {
          method: "POST",
        });
        return;
      }
      if (event === "REQUEST_CHANGES") {
        await request(`/projects/${encoded}/merge_requests/${iid}/unapprove`, {
          method: "POST",
        });
      }
      const noteBody =
        event === "REQUEST_CHANGES"
          ? body?.trim()
            ? `Requested changes: ${body.trim()}`
            : "Requested changes."
          : (body ?? "");
      await request(`/projects/${encoded}/merge_requests/${iid}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
    },

    async mergeMergeRequest(
      coords: GitlabRepoCoordinates,
      iid: number,
      method: "merge" | "squash" | "rebase" = "merge",
    ): Promise<void> {
      if (method === "rebase") {
        await request(
          `/projects/${projectPath(coords)}/merge_requests/${iid}/rebase`,
          { method: "PUT" },
        );
      }
      await request(
        `/projects/${projectPath(coords)}/merge_requests/${iid}/merge`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            squash: method === "squash",
            merge_when_pipeline_succeeds: false,
          }),
        },
      );
    },

    async closeMergeRequest(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<void> {
      await request(`/projects/${projectPath(coords)}/merge_requests/${iid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_event: "close" }),
      });
    },

    async reopenMergeRequest(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<void> {
      await request(`/projects/${projectPath(coords)}/merge_requests/${iid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state_event: "reopen" }),
      });
    },

    async deleteSourceBranch(
      coords: GitlabRepoCoordinates,
      branchName: string,
    ): Promise<void> {
      const encodedBranch = branchName
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      await request(
        `/projects/${projectPath(coords)}/repository/branches/${encodedBranch}`,
        { method: "DELETE" },
      );
    },

    async getMergeability(
      coords: GitlabRepoCoordinates,
      iid: number,
    ): Promise<{ mergeable: boolean; blockedReason?: string }> {
      const mr = await request<GitlabMergeRequest>(
        `/projects/${projectPath(coords)}/merge_requests/${iid}`,
      );
      if (mr.state === "merged" || mr.merged_at) {
        return {
          mergeable: false,
          blockedReason: "Merge request is already merged.",
        };
      }
      if (mr.state !== "opened") {
        return {
          mergeable: false,
          blockedReason: "Merge request is not open.",
        };
      }
      const status = mr.detailed_merge_status ?? mr.merge_status;
      if (mr.has_conflicts || status === "cannot_be_merged") {
        return {
          mergeable: false,
          blockedReason: "Merge blocked: conflicts must be resolved.",
        };
      }
      if (status && status !== "can_be_merged" && status !== "not_open") {
        return {
          mergeable: false,
          blockedReason: `Merge blocked: ${status}.`,
        };
      }
      return { mergeable: true };
    },
  };
}
