import type {
  ReviewComment,
  ReviewItem,
  ReviewItemState,
  ReviewSuggestion,
  ReviewTimelineEntry,
} from "../../shared/types/review";
import { parseSuggestionFromBody } from "./suggestionParse";
import type {
  GitlabDiscussion,
  GitlabMergeRequest,
  GitlabMergeRequestChange,
  GitlabNote,
} from "./gitlabApiTypes";

export function mapGitlabState(mr: GitlabMergeRequest): ReviewItemState {
  if (mr.state === "merged" || mr.merged_at) {
    return "merged";
  }
  if (mr.draft || mr.work_in_progress) {
    return "draft";
  }
  if (mr.state === "opened") {
    return "open";
  }
  return "closed";
}

export function mapGitlabItem(mr: GitlabMergeRequest): ReviewItem {
  return {
    id: String(mr.iid),
    number: mr.iid,
    title: mr.title,
    state: mapGitlabState(mr),
    author: mr.author?.username ?? "unknown",
    createdAt: mr.created_at,
    updatedAt: mr.updated_at,
    sourceBranch: mr.source_branch ?? "",
    targetBranch: mr.target_branch ?? "",
    url: mr.web_url,
    draft: mr.draft ?? mr.work_in_progress,
    labels: mr.labels ?? [],
    assignees: (mr.assignees ?? [])
      .map((assignee) => assignee.username?.trim())
      .filter((username): username is string => Boolean(username)),
    milestone: mr.milestone?.title?.trim() || undefined,
  };
}

export function mergeRequestCapabilities(mr: GitlabMergeRequest) {
  const merged = mr.state === "merged" || Boolean(mr.merged_at);
  const open = mr.state === "opened";
  const sameProject =
    mr.source_project_id !== undefined &&
    mr.target_project_id !== undefined &&
    mr.source_project_id === mr.target_project_id;
  const sourceBranch = mr.source_branch ?? "";

  return {
    canClose: open && !merged,
    canReopen: mr.state === "closed" && !merged,
    canDeleteSourceBranch: merged && sameProject && Boolean(sourceBranch),
    deleteSourceBranchBlockedReason:
      merged && !sameProject
        ? "Source branch is on a fork and cannot be deleted from this project."
        : undefined,
    canCheckoutBranch: !merged,
    checkoutBranchBlockedReason: merged
      ? "Merge request is already merged."
      : undefined,
  };
}

export function mapFileStatus(change: GitlabMergeRequestChange): string {
  if (change.new_file) {
    return "added";
  }
  if (change.deleted_file) {
    return "deleted";
  }
  if (change.renamed_file) {
    return "renamed";
  }
  return "modified";
}

export function countDiffStats(diff: string | undefined): {
  additions: number;
  deletions: number;
} {
  if (!diff) {
    return { additions: 0, deletions: 0 };
  }
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

export function buildGitlabTimeline(notes: GitlabNote[]): {
  timeline: ReviewTimelineEntry[];
  comments: ReviewComment[];
} {
  const userNotes = notes.filter((note) => !note.system);
  const timeline: ReviewTimelineEntry[] = userNotes.map((note) => ({
    id: `note-${note.id}`,
    kind: "comment" as const,
    author: note.author?.username ?? "unknown",
    body: note.body ?? "",
    createdAt: note.created_at,
  }));

  const comments: ReviewComment[] = userNotes.map((note) => ({
    id: String(note.id),
    author: note.author?.username ?? "unknown",
    body: note.body ?? "",
    createdAt: note.created_at,
  }));

  return { timeline, comments };
}

export function buildGitlabDiscussions(discussions: GitlabDiscussion[]): {
  comments: ReviewComment[];
  suggestions: ReviewSuggestion[];
} {
  const comments: ReviewComment[] = [];
  const suggestions: ReviewSuggestion[] = [];

  for (const discussion of discussions) {
    for (const note of discussion.notes) {
      if (note.system) {
        continue;
      }
      const body = note.body ?? "";
      const path = note.position?.new_path;
      const line = note.position?.new_line ?? note.position?.old_line ?? null;
      const suggestionText = parseSuggestionFromBody(body);
      comments.push({
        id: String(note.id),
        author: note.author?.username ?? "unknown",
        body,
        path: path ?? undefined,
        line: line ?? undefined,
        createdAt: note.created_at,
        hasSuggestion: suggestionText !== null,
      });
      if (suggestionText && path && line) {
        suggestions.push({
          id: `suggestion-${note.id}`,
          commentId: String(note.id),
          author: note.author?.username ?? "unknown",
          path,
          line,
          body,
          suggestionText,
          createdAt: note.created_at,
        });
      }
    }
  }

  return { comments, suggestions };
}
