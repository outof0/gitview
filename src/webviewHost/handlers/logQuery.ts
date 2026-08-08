import { isValidCommitSha } from "../../services/blameRefs";
import { createRepoApi } from "../../services/git/repo";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  PROTOCOL_VERSION,
} from "../../shared/protocol";
import type { CommitDetailResult, FileAtRevisionResult } from "../../shared/types/history";
import type { LogQueryFilters } from "../../shared/types/log";
import type { GitChangedFileStatus } from "../../types/blame";
import { validateBranchFilter } from "../../webview/branchFilter";
import { validateRepoRelativePaths } from "../validatePaths";
import {
  commitDiffToWorkspaceDocument,
  toLogSnapshot,
  type LogHandlerApis,
} from "./logHelpers";

export function createLogQueryHandlers(apis: LogHandlerApis) {
  const { deps, log, diff, resolveRepo } = apis;
  const repoApi = createRepoApi(deps.execGit);
  return {
    async query(
      requestId: string,
      repoId: string,
      opts?: LogQueryFilters,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      const branchCheck = await validateBranchFilter(
        opts?.branch,
        (root) => repoApi.listBranches(root),
        repo.rootPath,
      );
      if (!branchCheck.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", branchCheck.message),
          ),
        );
        return;
      }

      const limit = opts?.limit ?? 200;
      const branch = branchCheck.branch;
      let result;
      if (opts?.scope === "repo" || (!opts?.path && opts?.scope !== undefined)) {
        result = await log.logRepo(repo.rootPath, {
          ...opts,
          limit,
          branch,
        });
      } else if (opts?.isFolder) {
        result = await log.logFolder(repo.rootPath, opts.path || ".", {
          limit,
          branch,
        });
      } else if (opts?.path) {
        const validated = validateRepoRelativePaths(repo.rootPath, [opts.path]);
        if (!validated.ok) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("INVALID_PATH", validated.message),
            ),
          );
          return;
        }
        result = await log.logFile(repo.rootPath, validated.paths[0]!, {
          limit,
          branch,
        });
      } else {
        result = await log.logRepo(repo.rootPath, { ...opts, limit, branch });
      }

      if (!result.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", result.message),
          ),
        );
        return;
      }

      const snapshot = toLogSnapshot(
        repo.id,
        branch ?? repo.currentBranch ?? null,
        result.commits,
        opts,
      );
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "log.snapshot",
        payload: snapshot,
      });
      deps.postMessage(createHostResponse(requestId, "log.query", snapshot));
    },

    async fileDiff(
      requestId: string,
      repoId: string,
      sha: string,
      filePath: unknown,
      status?: string,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      if (!isValidCommitSha(sha)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "INVALID_REQUEST",
              "Commit SHA must be 7–40 hexadecimal characters.",
            ),
          ),
        );
        return;
      }

      const validated = validateRepoRelativePaths(repo.rootPath, [filePath]);
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      const path = validated.paths[0]!;

      const result = await diff.fileDiffAtCommit(
        repo.rootPath,
        sha,
        path,
        status as GitChangedFileStatus | undefined,
      );
      if (!result.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", result.message),
          ),
        );
        return;
      }

      const document = commitDiffToWorkspaceDocument(repo.id, path, result.diff);
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "diff.result",
        payload: document,
      });
      deps.postMessage(createHostResponse(requestId, "log.fileDiff", document));
    },

    async commitDetail(
      requestId: string,
      repoId: string,
      sha: string,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      if (!isValidCommitSha(sha)) {
        const payload: CommitDetailResult = {
          error: {
            code: "INVALID_SHA",
            message: "Commit SHA must be 7–40 hexadecimal characters.",
          },
        };
        deps.postMessage(
          createHostResponse(requestId, "log.commitDetail", payload),
        );
        return;
      }

      const result = await log.showCommit(repo.rootPath, sha);
      const payload: CommitDetailResult = result.ok
        ? { commit: result.commit }
        : {
            error: { code: result.code, message: result.message },
          };
      deps.postMessage(createHostResponse(requestId, "log.commitDetail", payload));
    },

    async fileAtRevision(
      requestId: string,
      repoId: string,
      sha: string,
      filePath: unknown,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo?.trusted) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("REPOSITORY_NOT_FOUND", "Repository not found."),
          ),
        );
        return;
      }

      const validated = validateRepoRelativePaths(repo.rootPath, [filePath]);
      if (!isValidCommitSha(sha) || !validated.ok) {
        const payload: FileAtRevisionResult = {
          sha,
          path: String(filePath ?? ""),
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid SHA or path.",
          },
        };
        deps.postMessage(
          createHostResponse(requestId, "log.fileAtRevision", payload),
        );
        return;
      }
      const path = validated.paths[0]!;

      const result = await diff.readFileAtRevision(repo.rootPath, sha, path);
      const payload: FileAtRevisionResult = result.ok
        ? {
            sha,
            path: String(filePath),
            text: result.text,
            binary: result.binary,
          }
        : {
            sha,
            path: String(filePath),
            deleted: result.code === "NOT_FOUND",
            error: { code: result.code, message: result.message },
          };
      deps.postMessage(createHostResponse(requestId, "log.fileAtRevision", payload));
    },
  };
}