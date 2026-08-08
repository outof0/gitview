import type { GitMenuActionPayload } from "@gitview/types";
import type { DiffLineSelection } from "@gitview/shared/types/diff";
import type { LogQueryFilters, ResetMode } from "@gitview/shared/types/log";
import type { ProtocolRequestFn } from "./clientCore";

export function createProtocolClientLogMethods(request: ProtocolRequestFn) {
  return {
    queryLog: (repoId: string, opts?: LogQueryFilters) =>
      request("log.query", { repoId, ...opts }),
    logFileDiff: (
      repoId: string,
      sha: string,
      path: string,
      status?: string,
    ) =>
      request("log.fileDiff", { repoId, sha, path, status }),
    stageHunk: (repoId: string, path: string, hunkIndex: number) =>
      request(
        "diff.stageHunk",
        { repoId, path, hunkIndex },
      ),
    unstageHunk: (repoId: string, path: string, hunkIndex: number) =>
      request(
        "diff.unstageHunk",
        { repoId, path, hunkIndex },
      ),
    cherryPick: (repoId: string, sha: string) =>
      request("log.cherryPick", { repoId, sha }),
    cherryPickMultiple: (repoId: string, shas: string[]) =>
      request(
        "log.cherryPickMultiple",
        { repoId, shas },
      ),
    cherryPickSelected: (
      repoId: string,
      sha: string,
      path: string,
      opts?: {
        hunkIndexes?: number[];
        lines?: DiffLineSelection[];
        checkOnly?: boolean;
      },
    ) =>
      request(
        "log.cherryPickSelected",
        { repoId, sha, path, ...opts },
      ),
    revert: (repoId: string, sha: string) =>
      request("log.revert", { repoId, sha }),
    revertMultiple: (repoId: string, shas: string[]) =>
      request("log.revertMultiple", { repoId, shas }),
    revertSelected: (
      repoId: string,
      sha: string,
      path: string,
      opts?: {
        hunkIndexes?: number[];
        lines?: DiffLineSelection[];
        checkOnly?: boolean;
      },
    ) =>
      request(
        "log.revertSelected",
        { repoId, sha, path, ...opts },
      ),
    dropSelectedChanges: (
      repoId: string,
      sha: string,
      path: string,
      opts?: {
        hunkIndexes?: number[];
        lines?: DiffLineSelection[];
        confirmed?: boolean;
      },
    ) =>
      request(
        "log.dropSelectedChanges",
        { repoId, sha, path, ...opts },
      ),
    resetToCommit: (
      repoId: string,
      sha: string,
      mode: ResetMode,
      confirmed?: boolean,
    ) =>
      request(
        "log.reset",
        { repoId, sha, mode, confirmed },
      ),
    undoLastCommit: (repoId: string, confirmed?: boolean) =>
      request(
        "log.undoLastCommit",
        { repoId, confirmed },
      ),
    createBranchFromCommit: (repoId: string, name: string, sha: string) =>
      request(
        "log.createBranchFromCommit",
        { repoId, name, sha },
      ),
    dropCommit: (repoId: string, sha: string, confirmed?: boolean) =>
      request(
        "log.dropCommit",
        { repoId, sha, confirmed },
      ),
    editCommitMessage: (
      repoId: string,
      sha: string,
      message: string,
      confirmed?: boolean,
    ) =>
      request(
        "log.editMessage",
        { repoId, sha, message, confirmed },
      ),
    rewriteCommit: (
      repoId: string,
      sha: string,
      action: "squash" | "fixup" | "drop",
      confirmed?: boolean,
    ) =>
      request(
        "log.rewrite",
        { repoId, sha, action, confirmed },
      ),
    extractChanges: (repoId: string, sha: string, paths?: string[]) =>
      request(
        "log.extractChanges",
        { repoId, sha, paths },
      ),
    continueRebase: (repoId: string) =>
      request("rebase.continue", { repoId }),
    skipRebase: (repoId: string) =>
      request("rebase.skip", { repoId }),
    abortRebase: (repoId: string) =>
      request("rebase.abort", { repoId }),
    queryBlame: (repoId: string, path: string, ref?: string) =>
      request("blame.query", { repoId, path, ref }),
    writeFile: (repoId: string, path: string, content: string) =>
      request("file.write", { repoId, path, content }),
    commitDetail: (repoId: string, sha: string) =>
      request("log.commitDetail", { repoId, sha }),
    fileAtRevision: (repoId: string, sha: string, path: string) =>
      request(
        "log.fileAtRevision",
        { repoId, sha, path },
      ),
    gitMenuAction: (repoId: string, payload: GitMenuActionPayload) =>
      request(
        "git.menuAction",
        { repoId, ...payload },
      ),
    openHistoryPanel: (repoId: string, path: string, isFolder: boolean) =>
      request(
        "history.openPanel",
        { repoId, path, isFolder },
      ),
    acceptConflictLocal: (repoId: string, paths: string[]) =>
      request("conflict.acceptLocal", { repoId, paths }),
    acceptConflictIncoming: (repoId: string, paths: string[]) =>
      request(
        "conflict.acceptIncoming",
        { repoId, paths },
      ),
    openMerge: (repoId: string, path: string) =>
      request("conflict.openMerge", { repoId, path }),
    applyNonConflicting: (repoId: string) =>
      request(
        "conflict.applyNonConflicting",
        { repoId },
      ),
    stageLines: (repoId: string, path: string, lines: DiffLineSelection[]) =>
      request("diff.stageLines", { repoId, path, lines }),
    unstageLines: (repoId: string, path: string, lines: DiffLineSelection[]) =>
      request("diff.unstageLines", { repoId, path, lines }),
  };
}