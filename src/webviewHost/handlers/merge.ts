import * as path from "path";
import { hasLeftoverMarkers } from "../../core/markers";
import { buildMergeDocument } from "../../core";
import { DiffTooLargeError } from "../../core/lcs";
import { MalformedConflictError } from "../../core/markersEngine";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostEvent,
  createHostResponse,
  type HostToWebview,
} from "../../shared/protocol";
import type { ConflictSnapshot } from "../../shared/types/merge";
import { createMergeApi } from "../../services/git/merge";
import { deriveSpecialKind } from "../../services/git/porcelain";
import { createRepoApi } from "../../services/git/repo";
import { createLogApi } from "../../services/git/log";
import { canonicalRepoRelativePath } from "../../services/blameRefs";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import type { MergePanelDeps } from "../messageRouterTypes";
import {
  APPLY_CONFIRM_MESSAGE,
  discardConfirmMessage,
  findUnmergedFileEntry,
  inferStageCodeFromStages,
  requireMergeTargetFilePath,
} from "../mergeShared";
import type { GitExecFn } from "../../services/git/types";
import { gitCommandError } from "../../util/safeLog";

export type MergeHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
  mergePanel: MergePanelDeps;
};


export function createMergeHandlers(deps: MergeHandlerDeps) {
  const merge = createMergeApi(deps.execGit);
  const repoApi = createRepoApi(deps.execGit);
  const logApi = createLogApi(deps.execGit);
  const { mergePanel } = deps;

  async function resolveRepo(repoId: string) {
    const repos = await deps.repositoryService.discoverRepositories({
      workspaceFolders: deps.workspaceFolders,
      explicitRepoId: repoId,
      trusted: deps.trusted,
    });
    return deps.repositoryService.resolveRepositoryForResource(
      repos,
      undefined,
      repoId,
    );
  }

  async function buildConflictSnapshot(repoRoot: string): Promise<ConflictSnapshot> {
    const branchInfo = await repoApi.getBranchInfo(repoRoot);
    const files = await merge.listUnmergedFiles(repoRoot);
    return {
      repoRoot,
      files: files.map((f) => ({
        relativePath: f.relativePath,
        stageCode: f.stageCode,
        specialKind: f.specialKind,
      })),
      branchInfo: {
        currentBranch: branchInfo.currentBranch,
        mergeHead: branchInfo.mergeHead,
      },
    };
  }

  async function pushConflictSnapshot(repoId: string) {
    const repo = await resolveRepo(repoId);
    if (!repo) {
      return;
    }
    const snapshot = await buildConflictSnapshot(repo.rootPath);
    deps.postMessage(createHostEvent("conflict.snapshot", snapshot));
  }

  async function confirmBeforeApply(): Promise<boolean> {
    const settings = mergePanel.getSettings();
    if (settings.confirmBeforeMarkResolved === false) {
      return true;
    }
    if (mergePanel.confirmMarkResolved) {
      return mergePanel.confirmMarkResolved(APPLY_CONFIRM_MESSAGE);
    }
    return true;
  }

  return {
    async refreshConflicts(requestId: string, repoId: string) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }
      try {
        await pushConflictSnapshot(repoId);
        deps.postMessage(
          createHostResponse(requestId, "conflict.refresh", { refreshed: true }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async openFile(requestId: string, repoId: string, filePath: unknown) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      if (typeof filePath !== "string") {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", "Path must be a string."),
          ),
        );
        return;
      }

      const resolved = path.posix.normalize(filePath.replace(/\\/g, "/"));
      const unmerged = await merge.listUnmergedFiles(repo.rootPath);
      const fileEntry = findUnmergedFileEntry(unmerged, resolved);
      let base: string | null = null;
      let ours: string | null = null;
      let theirs: string | null = null;
      let stagesLoaded = false;
      const readStages = async (): Promise<void> => {
        if (stagesLoaded) {
          return;
        }
        [base, ours, theirs] = await Promise.all([
          merge.readStage(repo.rootPath, resolved, 1),
          merge.readStage(repo.rootPath, resolved, 2),
          merge.readStage(repo.rootPath, resolved, 3),
        ]);
        stagesLoaded = true;
      };

      if (!fileEntry) {
        await readStages();
        if (ours === null && theirs === null) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("NOT_UNMERGED", "That file is not in the current unmerged conflict list."),
            ),
          );
          return;
        }
      }

      const stageCode =
        fileEntry?.stageCode ?? inferStageCodeFromStages(base, ours, theirs);
      if (["AU", "UA", "DD"].includes(stageCode)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "RENAME_CONFLICT",
              "Rename conflicts must be resolved in Git before using the merge tool.",
            ),
          ),
        );
        return;
      }

      if (await merge.isBinaryFile(repo.rootPath, resolved)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "BINARY_CONFLICT",
              "Binary files cannot be merged in the text resolver. Resolve this file with Git directly.",
            ),
          ),
        );
        return;
      }

      await readStages();
      const absolutePath = path.join(repo.rootPath, resolved);
      let worktree = "";
      try {
        const fileInfo = await mergePanel.fileService.readFile(absolutePath);
        worktree = fileInfo.content;
      } catch {
        worktree = ours ?? theirs ?? base ?? "";
      }

      const special = fileEntry?.specialKind ?? deriveSpecialKind(stageCode);
      const settings = mergePanel.getSettings();
      const mergeEngine = settings.mergeEngine ?? "threeWay";
      const branchInfo = await repoApi.getBranchInfo(repo.rootPath);

      try {
        const doc = buildMergeDocument({
          repoRoot: repo.rootPath,
          relativePath: resolved,
          absolutePath,
          base,
          ours,
          theirs,
          worktree,
          special,
          mergeEngine,
          now: Date.now(),
          oursLabel: branchInfo.currentBranch || undefined,
          theirsLabel: branchInfo.mergeHead || undefined,
        });
        mergePanel.openedMergePaths.add(`${repo.rootPath}\0${resolved}`);
        deps.postMessage(createHostEvent("merge.document", doc));
        deps.postMessage(
          createHostResponse(requestId, "merge.openFile", { path: resolved }),
        );
      } catch (err) {
        if (err instanceof DiffTooLargeError) {
          deps.postMessage(
            createHostError(requestId, createError("DIFF_TOO_LARGE", err.message)),
          );
          return;
        }
        if (err instanceof MalformedConflictError) {
          deps.postMessage(
            createHostError(
              requestId,
              createError(
                "MALFORMED_CONFLICT",
                "GitView found malformed conflict markers. Please fix the file manually or restore it from Git.",
              ),
            ),
          );
          return;
        }
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", gitCommandError(err)),
          ),
        );
      }
    },

    async saveFile(
      requestId: string,
      repoId: string,
      filePath: string,
      content: string,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      const target = await requireMergeTargetFilePath(
        repo.rootPath,
        filePath,
        (root) => merge.listUnmergedFiles(root),
        mergePanel.openedMergePaths,
      );
      if (!target.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              target.code === "INVALID_PATH" ? "INVALID_PATH" : "NOT_UNMERGED",
              target.message,
            ),
          ),
        );
        return;
      }

      try {
        const fileInfo = await mergePanel.fileService.readFile(target.absolutePath);
        await mergePanel.fileService.writeFile(target.absolutePath, content, {
          eol: fileInfo.eol,
          hasFinalNewline: fileInfo.hasFinalNewline,
        });
        deps.postMessage(
          createHostResponse(requestId, "merge.saved", {
            path: target.relativePath,
            hint: "Saved. Use Apply to finish resolving this file.",
          }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "SAVE_FAILED",
              `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
            ),
          ),
        );
      }
    },

    async markResolved(
      requestId: string,
      repoId: string,
      filePath: string,
      content: string,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      if (!(await confirmBeforeApply())) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("CONFIRMATION_REQUIRED", "Apply was cancelled."),
          ),
        );
        return;
      }

      const target = await requireMergeTargetFilePath(
        repo.rootPath,
        filePath,
        (root) => merge.listUnmergedFiles(root),
        mergePanel.openedMergePaths,
      );
      if (!target.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              target.code === "INVALID_PATH" ? "INVALID_PATH" : "NOT_UNMERGED",
              target.message,
            ),
          ),
        );
        return;
      }

      if (hasLeftoverMarkers(content)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "MARKERS_REMAIN",
              "GitView found conflict markers still in the result. Resolve every conflict before marking the file as resolved.",
            ),
          ),
        );
        return;
      }

      try {
        const fileInfo = await mergePanel.fileService.readFile(target.absolutePath);
        await mergePanel.fileService.writeFile(target.absolutePath, content, {
          eol: fileInfo.eol,
          hasFinalNewline: fileInfo.hasFinalNewline,
        });
        const settings = mergePanel.getSettings();
        const autoStage = settings.autoStageOnResolved !== false;
        if (autoStage) {
          await merge.addFile(repo.rootPath, target.relativePath);
          mergePanel.openedMergePaths.delete(
            `${repo.rootPath}\0${target.relativePath}`,
          );
          await deps.refreshCoordinator.refreshNow(repo.id);
          await pushConflictSnapshot(repoId);
          deps.postMessage(
            createHostResponse(requestId, "merge.resolved", {
              path: target.relativePath,
            }),
          );
        } else {
          deps.postMessage(
            createHostResponse(requestId, "merge.saved", {
              path: target.relativePath,
              hint: "Saved. Stage the file in Git to mark it resolved.",
            }),
          );
        }
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "SAVE_FAILED",
              `Failed to save: ${err instanceof Error ? err.message : String(err)}`,
            ),
          ),
        );
      }
    },

    async confirmDiscard(
      requestId: string,
      action: import("../../shared/types/merge").DiscardConfirmAction,
    ) {
      const ok =
        (await mergePanel.confirmDiscard?.(discardConfirmMessage(action))) ??
        true;
      if (!ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("CONFIRMATION_REQUIRED", "Discard was cancelled."),
          ),
        );
        return;
      }
      deps.postMessage(
        createHostResponse(requestId, "merge.confirmDiscard", action),
      );
    },

    closePanel(requestId: string) {
      mergePanel.close?.();
      deps.postMessage(
        createHostResponse(requestId, "merge.close", { closed: true }),
      );
    },

    async changesFromSide(
      requestId: string,
      repoId: string,
      payload: {
        side: "ours" | "theirs";
        relativePath?: string;
        filterByFile?: boolean;
        limit?: number;
      },
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        deps.postMessage(
          createHostResponse(requestId, "log.changesFromSide", {
            side: payload.side,
            relativePath: payload.relativePath,
            error: {
              code: "NO_REPO",
              message: "GitView could not find a Git repository in this workspace.",
            },
          }),
        );
        return;
      }

      const canonicalFilterPath =
        payload.filterByFile && payload.relativePath
          ? canonicalRepoRelativePath(payload.relativePath)
          : payload.relativePath;
      if (payload.filterByFile && payload.relativePath && !canonicalFilterPath) {
        deps.postMessage(
          createHostResponse(requestId, "log.changesFromSide", {
            side: payload.side,
            relativePath: payload.relativePath,
            error: {
              code: "INVALID_PATH",
              message: "Path must be a relative path inside the repository.",
            },
          }),
        );
        return;
      }

      const result = await logApi.logChangesFromSide(repo.rootPath, payload.side, {
        filterPath:
          payload.filterByFile && canonicalFilterPath
            ? canonicalFilterPath
            : undefined,
        limit: payload.limit,
      });

      if (result.ok) {
        deps.postMessage(
          createHostResponse(requestId, "log.changesFromSide", {
            side: payload.side,
            relativePath: canonicalFilterPath ?? payload.relativePath,
            mergeBase: result.mergeBase,
            revisionRange: result.revisionRange,
            branchRef: result.branchRef,
            commits: result.commits,
            allChangedPaths: result.allChangedPaths,
          }),
        );
      } else {
        deps.postMessage(
          createHostResponse(requestId, "log.changesFromSide", {
            side: payload.side,
            relativePath: payload.relativePath,
            error: { code: result.code, message: result.message },
          }),
        );
      }
    },

    pushConflictSnapshot,
    buildConflictSnapshot,
  };
}
