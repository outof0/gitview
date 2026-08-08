import type { BlameSide } from "../../types/blame";
import type { CommitCheckKind } from "../types/commitCheck";
import type { DiscardConfirmAction } from "../types/merge";
import type { ReviewFilters } from "../types/review";
import type { StashFileOrigin } from "../types/stash";
import type { WebviewRequest } from "./base";

export type WebviewToHostExtended =
  | WebviewRequest<"rebase.continue", { repoId: string }>
  | WebviewRequest<"rebase.skip", { repoId: string }>
  | WebviewRequest<"rebase.abort", { repoId: string }>
  | WebviewRequest<
      "commit.checks",
      { repoId: string; paths?: string[]; kinds?: CommitCheckKind[] }
    >
  | WebviewRequest<
      "blame.query",
      { repoId: string; path: string; ref?: string }
    >
  | WebviewRequest<
      "file.write",
      { repoId: string; path: string; content: string }
    >
  | WebviewRequest<
      "conflict.acceptLocal",
      { repoId: string; paths: string[] }
    >
  | WebviewRequest<
      "conflict.acceptIncoming",
      { repoId: string; paths: string[] }
    >
  | WebviewRequest<"conflict.openMerge", { repoId: string; path: string }>
  | WebviewRequest<"conflict.applyNonConflicting", { repoId: string }>
  | WebviewRequest<"conflict.refresh", { repoId: string }>
  | WebviewRequest<"merge.openFile", { repoId: string; path: string }>
  | WebviewRequest<
      "merge.save",
      { repoId: string; path: string; content: string }
    >
  | WebviewRequest<
      "merge.markResolved",
      { repoId: string; path: string; content: string }
    >
  | WebviewRequest<
      "merge.confirmDiscard",
      { repoId: string; action: DiscardConfirmAction }
    >
  | WebviewRequest<"merge.close", Record<string, never>>
  | WebviewRequest<
      "history.openPanel",
      { repoId: string; path: string; isFolder: boolean }
    >
  | WebviewRequest<
      "log.changesFromSide",
      {
        repoId: string;
        side: BlameSide;
        relativePath?: string;
        filterByFile?: boolean;
        limit?: number;
      }
    >
  | WebviewRequest<"stash.list", { repoId: string }>
  | WebviewRequest<
      "stash.push",
      {
        repoId: string;
        message?: string;
        paths?: string[];
        includeUntracked?: boolean;
        keepIndex?: boolean;
      }
    >
  | WebviewRequest<"stash.detail", { repoId: string; index: number }>
  | WebviewRequest<
      "stash.fileDiff",
      {
        repoId: string;
        index: number;
        path: string;
        origin?: StashFileOrigin;
      }
    >
  | WebviewRequest<
      "stash.apply",
      { repoId: string; index: number; reinstateIndex?: boolean }
    >
  | WebviewRequest<
      "stash.pop",
      { repoId: string; index: number; reinstateIndex?: boolean }
    >
  | WebviewRequest<
      "stash.drop",
      { repoId: string; index: number }
    >
  | WebviewRequest<
      "stash.branch",
      { repoId: string; index: number; branch: string }
    >
  | WebviewRequest<"stash.clear", { repoId: string }>
  | WebviewRequest<"shelf.list", { repoId: string }>
  | WebviewRequest<
      "shelf.files",
      { repoId: string; paths: string[]; name?: string; changelistId?: string }
    >
  | WebviewRequest<
      "shelf.hunk",
      {
        repoId: string;
        path: string;
        hunkIndex: number;
        staged?: boolean;
        name?: string;
        changelistId?: string;
      }
    >
  | WebviewRequest<
      "shelf.unshelve",
      { repoId: string; shelfId: string; deleteAfter?: boolean }
    >
  | WebviewRequest<
      "shelf.delete",
      { repoId: string; shelfId: string }
    >
  | WebviewRequest<
      "patch.create",
      { repoId: string; paths?: string[] }
    >
  | WebviewRequest<
      "patch.apply",
      {
        repoId: string;
        patch: string;
        checkOnly?: boolean;
        confirmed?: boolean;
        strip?: number;
        directory?: string;
      }
    >
  | WebviewRequest<
      "shelf.importPatch",
      { repoId: string; patch: string; name?: string }
    >
  | WebviewRequest<"tag.list", { repoId: string }>
  | WebviewRequest<
      "tag.createAnnotated",
      { repoId: string; name: string; message?: string; sha?: string }
    >
  | WebviewRequest<
      "tag.checkout",
      { repoId: string; name: string }
    >
  | WebviewRequest<
      "tag.push",
      { repoId: string; name: string; remote?: string }
    >
  | WebviewRequest<
      "tag.delete",
      { repoId: string; name: string }
    >
  | WebviewRequest<"worktree.list", { repoId: string }>
  | WebviewRequest<
      "worktree.add",
      {
        repoId: string;
        path: string;
        branch?: string;
        newBranch?: string;
      }
    >
  | WebviewRequest<
      "worktree.remove",
      { repoId: string; path: string; force?: boolean; confirmed?: boolean }
    >
  | WebviewRequest<
      "worktree.open",
      { repoId: string; path: string }
    >
  | WebviewRequest<
      "review.list",
      {
        repoId: string;
        providerId?: string;
        filters?: ReviewFilters;
      }
    >
  | WebviewRequest<
      "review.open",
      { repoId: string; providerId: string; reviewId: string }
    >
  | WebviewRequest<
      "review.submit",
      {
        repoId: string;
        providerId: string;
        reviewId: string;
        event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
        body?: string;
      }
    >
  | WebviewRequest<
      "review.merge",
      {
        repoId: string;
        providerId: string;
        reviewId: string;
        method?: "merge" | "squash" | "rebase";
      }
    >
  | WebviewRequest<
      "review.applySuggestion",
      {
        repoId: string;
        providerId: string;
        reviewId: string;
        suggestionId: string;
      }
    >
  | WebviewRequest<
      "review.close",
      { repoId: string; providerId: string; reviewId: string }
    >
  | WebviewRequest<
      "review.reopen",
      { repoId: string; providerId: string; reviewId: string }
    >
  | WebviewRequest<
      "review.deleteSourceBranch",
      { repoId: string; providerId: string; reviewId: string }
    >
  | WebviewRequest<
      "review.checkoutBranch",
      { repoId: string; providerId: string; reviewId: string }
    >
  | WebviewRequest<
      "review.create",
      {
        repoId: string;
        providerId: string;
        title: string;
        sourceBranch: string;
        targetBranch: string;
        body?: string;
        draft?: boolean;
      }
    >
  | WebviewRequest<
      "review.createLineComment",
      {
        repoId: string;
        providerId: string;
        reviewId: string;
        path: string;
        line: number;
        body: string;
        side?: "LEFT" | "RIGHT";
      }
    >;
