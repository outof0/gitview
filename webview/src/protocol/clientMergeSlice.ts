import type { DiscardConfirmAction } from "@gitview/shared/types/merge";
import type { BlameSide } from "@gitview/types";
import type { ProtocolRequestFn } from "./clientCore";

export function createProtocolClientMergeMethods(request: ProtocolRequestFn) {
  return {
    ready: (surface: string) =>
      request("webview.ready", { surface }),

    refreshConflicts: (repoId: string) =>
      request("conflict.refresh", { repoId }),

    openMergeFile: (repoId: string, path: string) =>
      request("merge.openFile", { repoId, path }),

    saveMerge: (repoId: string, path: string, content: string) =>
      request("merge.save", { repoId, path, content }),

    markResolved: (repoId: string, path: string, content: string) =>
      request(
        "merge.markResolved",
        { repoId, path, content },
      ),

    confirmDiscard: (repoId: string, action: DiscardConfirmAction) =>
      request(
        "merge.confirmDiscard",
        { repoId, action },
      ),

    closePanel: () =>
      request("merge.close", {}),

    openHistoryPanel: (repoId: string, path: string, isFolder: boolean) =>
      request(
        "history.openPanel",
        { repoId, path, isFolder },
      ),

    changesFromSide: (
      repoId: string,
      payload: {
        side: BlameSide;
        relativePath?: string;
        filterByFile?: boolean;
        limit?: number;
      },
    ) =>
      request(
        "log.changesFromSide",
        { repoId, ...payload },
      ),

    acceptConflictLocal: (repoId: string, paths: string[]) =>
      request("conflict.acceptLocal", { repoId, paths }),

    acceptConflictIncoming: (repoId: string, paths: string[]) =>
      request(
        "conflict.acceptIncoming",
        { repoId, paths },
      ),

    applyNonConflicting: (repoId: string) =>
      request(
        "conflict.applyNonConflicting",
        { repoId },
      ),

    menuAction: (
      repoId: string,
      payload: Omit<import("@gitview/types").GitMenuActionPayload, "repoId">,
    ) =>
      request("git.menuAction", { repoId, ...payload }),

    queryBlame: (repoId: string, path: string, ref?: string) =>
      request("blame.query", { repoId, path, ref }),

    writeFile: (repoId: string, path: string, content: string) =>
      request("file.write", { repoId, path, content }),
  };
}