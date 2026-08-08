import type { CommitCreatePayload } from "@gitview/shared/protocol";
import type { CommitCheckKind } from "@gitview/shared/types/commitCheck";
import type { ProtocolRequestFn } from "./clientCore";

export function createProtocolClientRepoMethods(request: ProtocolRequestFn) {
  return {
    ready: (surface: string) =>
      request("webview.ready", { surface }),
    refreshRepos: (repoId?: string) =>
      request("repo.refresh", { repoId }),
    listStatus: (repoId: string, includeIgnored?: boolean) =>
      request("status.list", { repoId, includeIgnored }),
    stageFiles: (repoId: string, paths: string[]) =>
      request("changes.stage", { repoId, paths }),
    unstageFiles: (repoId: string, paths: string[]) =>
      request("changes.unstage", { repoId, paths }),
    rollbackFiles: (repoId: string, paths: string[], confirmed?: boolean) =>
      request(
        "changes.rollback",
        { repoId, paths, confirmed },
      ),
    createCommit: (payload: CommitCreatePayload) =>
      request("commit.create", payload),
    runCommitChecks: (
      repoId: string,
      paths?: string[],
      kinds?: CommitCheckKind[],
    ) =>
      request("commit.checks", { repoId, paths, kinds }),
    fetch: (repoId: string) => request("sync.fetch", { repoId }),
    pull: (repoId: string, strategy?: "merge" | "rebase" | "ff_only") =>
      request("sync.pull", { repoId, strategy }),
    push: (
      repoId: string,
      opts?: { setUpstream?: boolean; remote?: string },
    ) =>
      request(
        "sync.push",
        { repoId, setUpstream: opts?.setUpstream, remote: opts?.remote },
      ),
    updateAllRoots: (strategy?: "merge" | "rebase" | "ff_only") =>
      request("sync.updateAllRoots", { strategy }),
    openDiff: (repoId: string, path: string, staged?: boolean) =>
      request("diff.open", { repoId, path, staged }),
    /** Open Annotate from a Git Compare / diff line (focusLine is 1-based). */
    annotateFromDiff: (relativePath: string, focusLine?: number) =>
      request(
        "diff.annotate",
        { relativePath, focusLine },
      ),
    createChangelist: (repoId: string, name: string) =>
      request("changelist.create", { repoId, name }),
    activateChangelist: (repoId: string, listId: string) =>
      request("changelist.activate", { repoId, listId }),
    moveToChangelist: (repoId: string, listId: string, paths: string[]) =>
      request(
        "changelist.moveFiles",
        { repoId, listId, paths },
      ),
    createPatch: (repoId: string, paths?: string[]) =>
      request("patch.create", { repoId, paths }),
    applyPatch: (
      repoId: string,
      patch: string,
      opts?: {
        checkOnly?: boolean;
        confirmed?: boolean;
        strip?: number;
        directory?: string;
      },
    ) =>
      request("patch.apply", { repoId, patch, ...opts }),
  };
}