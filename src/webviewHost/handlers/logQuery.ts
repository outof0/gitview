import { isValidCommitSha } from "../../services/blameRefs";
import { createRepoApi } from "../../services/git/repo";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  PROTOCOL_VERSION,
} from "../../shared/protocol";
import type { CommitDetailResult, FileAtRevisionResult } from "../../shared/types/history";
import type { LogDagSnapshot, LogQueryFilters } from "../../shared/types/log";
import type { GitChangedFileStatus } from "../../types/blame";
import { validateBranchFilter } from "../../shared/lib/branchFilter";
import { validateRepoRelativePaths } from "../validatePaths";
import {
  annotateParentPresence,
  type LogParentScope,
} from "./logParentPresence";
import {
  commitDiffToWorkspaceDocument,
  toLogSnapshot,
  type LogHandlerApis,
} from "./logHelpers";

export function createLogQueryHandlers(apis: LogHandlerApis) {
  const {
    deps,
    log,
    diff,
    resolveRepo,
    rememberCommitParents,
    knownParentForCommit,
  } = apis;
  const repoApi = createRepoApi(deps.execGit);

  // Filtered-history scans are O(history); paging reuses the same filter, so a
  // small TTL cache avoids paying it for every page. Time-based filters make
  // the set time-sensitive, hence the TTL.
  const filteredShaCache = new Map<
    string,
    { at: number; shas: ReadonlySet<string> }
  >();
  const FILTERED_SHA_TTL_MS = 30_000;
  const FILTERED_SHA_CACHE_LIMIT = 4;

  async function loadFilteredShas(
    key: string,
    load: () => Promise<string[] | null>,
  ): Promise<ReadonlySet<string> | null> {
    const now = Date.now();
    const cached = filteredShaCache.get(key);
    if (cached && now - cached.at < FILTERED_SHA_TTL_MS) {
      return cached.shas;
    }
    const shas = await load();
    if (!shas) {
      return null;
    }
    const set: ReadonlySet<string> = new Set(shas);
    filteredShaCache.delete(key);
    filteredShaCache.set(key, { at: now, shas: set });
    while (filteredShaCache.size > FILTERED_SHA_CACHE_LIMIT) {
      const oldest = filteredShaCache.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      filteredShaCache.delete(oldest);
    }
    return set;
  }
  return {
    async dag(requestId: string, repoId: string) {
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
      const result = await log.logDag(repo.rootPath);
      if (!result.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", result.message),
          ),
        );
        return;
      }
      const snapshot: LogDagSnapshot = {
        repoId: repo.id,
        ...result.snapshot,
      };
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "log.dag",
        payload: snapshot,
        requestId,
      });
      deps.postMessage(createHostResponse(requestId, "log.dag", snapshot));
    },

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
      const pagination = { limit, skip: opts?.skip, branch };
      let result;
      let parentScope: LogParentScope = "repo";
      let parentFilters: LogQueryFilters | undefined = opts;
      let historyPath: string | undefined;
      if (opts?.scope === "repo" || (!opts?.path && opts?.scope !== undefined)) {
        result = await log.logRepo(repo.rootPath, {
          ...opts,
          limit,
          branch,
        });
      } else if (opts?.isFolder) {
        result = await log.logFolder(repo.rootPath, opts.path || ".", {
          ...pagination,
        });
        parentScope = "path";
        parentFilters = undefined;
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
          ...pagination,
        });
        historyPath = validated.paths[0]!;
        parentScope = "file";
        parentFilters = undefined;
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

      const presenceScope = parentScope;
      const presenceKey =
        presenceScope === "file" && historyPath
          ? `${repo.id}|file|${branch ?? ""}|${historyPath}`
          : `${repo.id}|repo|${branch ?? ""}|${JSON.stringify({
              author: opts?.author,
              since: opts?.since,
              until: opts?.until,
              grep: opts?.grep,
              range: opts?.range,
              noMerges: opts?.noMerges,
              firstParent: opts?.firstParent,
              path: opts?.path,
            })}`;
      const loadPresenceShas =
        presenceScope === "file" && historyPath
          ? () =>
              log.listFileShas(repo.rootPath, historyPath!, {
                branch,
              })
          : () =>
              log.listRepoShas(repo.rootPath, {
                ...opts,
                limit: undefined,
                skip: undefined,
                branch,
              });
      const commits = await annotateParentPresence(
        deps.execGit,
        repo.rootPath,
        result.commits,
        {
          scope: presenceScope,
          filters: parentFilters,
          loadFilteredShas: () =>
            loadFilteredShas(presenceKey, loadPresenceShas),
        },
      );
      const snapshot = toLogSnapshot(
        repo.id,
        branch ?? repo.currentBranch ?? null,
        commits,
        opts,
        result.commits.length >= limit,
      );
      rememberCommitParents(repo.id, snapshot.commits);
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "log.snapshot",
        payload: snapshot,
        requestId,
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
        knownParentForCommit(repo.id, sha),
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
      if (result.ok) {
        rememberCommitParents(repo.id, [result.commit]);
      }
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
