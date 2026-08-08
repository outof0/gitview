import type { ProtocolRequestFn } from "./clientCore";
import type { StashFileOrigin } from "@gitview/shared/types/stash";

export function createProtocolClientAuxMethods(request: ProtocolRequestFn) {
  return {
    listStashes: (repoId: string) =>
      request("stash.list", { repoId }),
    pushStash: (
      repoId: string,
      opts?: {
        message?: string;
        paths?: string[];
        includeUntracked?: boolean;
        keepIndex?: boolean;
      },
    ) => request("stash.push", { repoId, ...opts }),
    getStashDetail: (repoId: string, index: number) =>
      request("stash.detail", { repoId, index }),
    getStashFileDiff: (
      repoId: string,
      index: number,
      path: string,
      origin?: StashFileOrigin,
    ) => request("stash.fileDiff", { repoId, index, path, origin }),
    applyStash: (
      repoId: string,
      index: number,
      opts?: { reinstateIndex?: boolean },
    ) => request("stash.apply", { repoId, index, ...opts }),
    popStash: (
      repoId: string,
      index: number,
      opts?: { reinstateIndex?: boolean },
    ) => request("stash.pop", { repoId, index, ...opts }),
    dropStash: (repoId: string, index: number) =>
      request("stash.drop", { repoId, index }),
    branchStash: (repoId: string, index: number, branch: string) =>
      request("stash.branch", { repoId, index, branch }),
    clearStashes: (repoId: string) =>
      request("stash.clear", { repoId }),
    listShelves: (repoId: string) =>
      request("shelf.list", { repoId }),
    shelveFiles: (
      repoId: string,
      paths: string[],
      opts?: { name?: string; changelistId?: string },
    ) =>
      request("shelf.files", { repoId, paths, ...opts }),
    shelveHunk: (
      repoId: string,
      path: string,
      hunkIndex: number,
      opts?: { staged?: boolean; name?: string; changelistId?: string },
    ) =>
      request(
        "shelf.hunk",
        { repoId, path, hunkIndex, ...opts },
      ),
    unshelve: (repoId: string, shelfId: string, deleteAfter?: boolean) =>
      request("shelf.unshelve", { repoId, shelfId, deleteAfter }),
    deleteShelf: (repoId: string, shelfId: string) =>
      request("shelf.delete", { repoId, shelfId }),
    importShelfPatch: (repoId: string, patch: string, name?: string) =>
      request("shelf.importPatch", { repoId, patch, name }),
    listTags: (repoId: string) =>
      request("tag.list", { repoId }),
    createAnnotatedTag: (
      repoId: string,
      name: string,
      message?: string,
      sha?: string,
    ) =>
      request(
        "tag.createAnnotated",
        { repoId, name, message, sha },
      ),
    checkoutTag: (repoId: string, name: string) =>
      request("tag.checkout", { repoId, name }),
    pushTag: (repoId: string, name: string, remote?: string) =>
      request("tag.push", { repoId, name, remote }),
    deleteTag: (repoId: string, name: string) =>
      request("tag.delete", { repoId, name }),
    listWorktrees: (repoId: string) =>
      request("worktree.list", { repoId }),
    addWorktree: (
      repoId: string,
      path: string,
      opts?: { branch?: string; newBranch?: string },
    ) =>
      request("worktree.add", { repoId, path, ...opts }),
    removeWorktree: (
      repoId: string,
      path: string,
      force?: boolean,
      confirmed?: boolean,
    ) =>
      request(
        "worktree.remove",
        { repoId, path, force, confirmed },
      ),
    openWorktree: (repoId: string, path: string) =>
      request("worktree.open", { repoId, path }),
  };
}