import type { GitMenuActionPayload } from "../../types/gitMenu";
import type { DiffLineSelection } from "../types/diff";
import type { LogQueryFilters } from "../types/log";
import type { CommitCreatePayload, WebviewRequest } from "./base";

/** Webview → host intents (core, v1). */
export type WebviewToHostCore =
  | WebviewRequest<"webview.ready", { surface: string }>
  | WebviewRequest<"repo.refresh", { repoId?: string }>
  | WebviewRequest<"status.list", { repoId: string; includeIgnored?: boolean }>
  | WebviewRequest<"changes.stage", { repoId: string; paths: string[] }>
  | WebviewRequest<"changes.unstage", { repoId: string; paths: string[] }>
  | WebviewRequest<
      "changes.rollback",
      { repoId: string; paths: string[]; confirmed?: boolean }
    >
  | WebviewRequest<"commit.create", CommitCreatePayload>
  | WebviewRequest<"sync.fetch", { repoId: string }>
  | WebviewRequest<
      "sync.pull",
      { repoId: string; strategy?: "merge" | "rebase" | "ff_only" }
    >
  | WebviewRequest<
      "sync.push",
      { repoId: string; setUpstream?: boolean; remote?: string }
    >
  | WebviewRequest<
      "sync.updateAllRoots",
      { strategy?: "merge" | "rebase" | "ff_only" }
    >
  | WebviewRequest<"branch.list", { repoId: string }>
  | WebviewRequest<
      "branch.checkout",
      { repoId: string; ref: string; smart?: boolean; force?: boolean }
    >
  | WebviewRequest<
      "branch.syncOperation",
      {
        repoId: string;
        ref: string;
        smart?: boolean;
        force?: boolean;
        confirmed?: boolean;
      }
    >
  | WebviewRequest<
      "branch.create",
      {
        repoId: string;
        name: string;
        startPoint?: string;
        checkout?: boolean;
        force?: boolean;
      }
    >
  | WebviewRequest<
      "branch.rename",
      { repoId: string; oldName: string; newName: string }
    >
  | WebviewRequest<
      "branch.delete",
      { repoId: string; name: string; force?: boolean }
    >
  | WebviewRequest<
      "branch.push",
      { repoId: string; name: string; remote?: string; setUpstream?: boolean }
    >
  | WebviewRequest<"branch.favorite", { repoId: string; name: string }>
  | WebviewRequest<
      "branch.compareCurrent",
      { repoId: string; ref: string; path?: string }
    >
  | WebviewRequest<
      "branch.compareWorkingTree",
      { repoId: string; ref: string; path?: string }
    >
  | WebviewRequest<
      "branch.compareFile",
      {
        repoId: string;
        ref: string;
        path: string;
        mode: "current" | "workingTree";
      }
    >
  | WebviewRequest<
      "branch.compareApplyFile",
      {
        repoId: string;
        ref: string;
        path: string;
        mode: "current" | "workingTree";
      }
    >
  | WebviewRequest<
      "branch.merge",
      {
        repoId: string;
        ref: string;
        noFf?: boolean;
        squash?: boolean;
        message?: string;
        noCommit?: boolean;
        log?: boolean;
      }
    >
  | WebviewRequest<
      "branch.rebaseOnto",
      {
        repoId: string;
        onto: string;
        interactive?: boolean;
        from?: string;
        rebaseMerges?: boolean;
      }
    >
  | WebviewRequest<"operation.continue", { repoId: string }>
  | WebviewRequest<"operation.skip", { repoId: string }>
  | WebviewRequest<"operation.abort", { repoId: string }>
  | WebviewRequest<
      "diff.open",
      { repoId: string; path: string; staged?: boolean }
    >
  /** Open Annotate for a compare/diff line (standalone Git Diff webview). */
  | WebviewRequest<
      "diff.annotate",
      { relativePath: string; focusLine?: number }
    >
  | WebviewRequest<"changelist.create", { repoId: string; name: string }>
  | WebviewRequest<"changelist.activate", { repoId: string; listId: string }>
  | WebviewRequest<
      "changelist.moveFiles",
      { repoId: string; listId: string; paths: string[] }
    >
  | WebviewRequest<
      "log.query",
      { repoId: string } & LogQueryFilters
    >
  | WebviewRequest<
      "log.fileDiff",
      { repoId: string; sha: string; path: string; status?: string }
    >
  | WebviewRequest<
      "log.commitDetail",
      { repoId: string; sha: string }
    >
  | WebviewRequest<
      "log.fileAtRevision",
      { repoId: string; sha: string; path: string }
    >
  | WebviewRequest<
      "git.menuAction",
      { repoId: string } & GitMenuActionPayload
    >
  | WebviewRequest<
      "diff.stageHunk",
      { repoId: string; path: string; hunkIndex: number }
    >
  | WebviewRequest<
      "diff.unstageHunk",
      { repoId: string; path: string; hunkIndex: number }
    >
  | WebviewRequest<
      "diff.stageLines",
      { repoId: string; path: string; lines: DiffLineSelection[] }
    >
  | WebviewRequest<
      "diff.unstageLines",
      { repoId: string; path: string; lines: DiffLineSelection[] }
    >
  | WebviewRequest<"log.cherryPick", { repoId: string; sha: string }>
  | WebviewRequest<
      "log.cherryPickMultiple",
      { repoId: string; shas: string[] }
    >
  | WebviewRequest<
      "log.cherryPickSelected",
      {
        repoId: string;
        sha: string;
        path: string;
        hunkIndexes?: number[];
        lines?: DiffLineSelection[];
        checkOnly?: boolean;
      }
    >
  | WebviewRequest<"log.revert", { repoId: string; sha: string }>
  | WebviewRequest<
      "log.revertMultiple",
      { repoId: string; shas: string[] }
    >
  | WebviewRequest<
      "log.revertSelected",
      {
        repoId: string;
        sha: string;
        path: string;
        hunkIndexes?: number[];
        lines?: DiffLineSelection[];
        checkOnly?: boolean;
      }
    >
  | WebviewRequest<
      "log.dropSelectedChanges",
      {
        repoId: string;
        sha: string;
        path: string;
        hunkIndexes?: number[];
        lines?: DiffLineSelection[];
        confirmed?: boolean;
      }
    >
  | WebviewRequest<
      "log.reset",
      {
        repoId: string;
        sha: string;
        mode: "soft" | "mixed" | "hard" | "keep";
        confirmed?: boolean;
      }
    >
  | WebviewRequest<
      "log.undoLastCommit",
      { repoId: string; confirmed?: boolean }
    >
  | WebviewRequest<
      "log.createBranchFromCommit",
      { repoId: string; name: string; sha: string }
    >
  | WebviewRequest<
      "log.dropCommit",
      { repoId: string; sha: string; confirmed?: boolean }
    >
  | WebviewRequest<
      "log.editMessage",
      { repoId: string; sha: string; message: string; confirmed?: boolean }
    >
  | WebviewRequest<
      "log.rewrite",
      {
        repoId: string;
        sha: string;
        action: "squash" | "fixup" | "drop";
        confirmed?: boolean;
      }
    >
  | WebviewRequest<
      "log.extractChanges",
      { repoId: string; sha: string; paths?: string[] }
    >;
