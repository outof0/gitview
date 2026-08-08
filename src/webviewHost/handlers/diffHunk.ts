import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createHunkPatchApi } from "../../services/git/hunkPatch";
import { createLinePatchApi } from "../../services/git/linePatch";
import type { DiffLineSelection } from "../../shared/types/diff";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  type HostToWebview,
} from "../../shared/protocol";
import type { RepositoryService } from "../../services/repositoryService";
import type { RefreshCoordinator } from "../../services/watchers/refreshCoordinator";
import { validateRepoRelativePaths } from "../validatePaths";
import type { GitExecFn } from "../../services/git/types";
import { gitCommandError } from "../../util/safeLog";

export type DiffHunkHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  refreshCoordinator: RefreshCoordinator;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};


function isLineSelection(value: unknown): value is DiffLineSelection {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as { side?: unknown; line?: unknown };
  return (
    (entry.side === "old" || entry.side === "new") &&
    Number.isInteger(entry.line) &&
    (entry.line as number) > 0
  );
}

export function createDiffHunkHandlers(deps: DiffHunkHandlerDeps) {
  const hunkPatch = createHunkPatchApi(deps.execGit);
  const linePatch = createLinePatchApi(deps.execGit);

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

  async function mutateHunk(
    requestId: string,
    repoId: string,
    filePath: unknown,
    hunkIndex: number,
    action: "stage" | "unstage",
  ) {
    const repo = await resolveRepo(repoId);
    const check = validateMutationPreconditions({
      trusted: deps.trusted,
      repository: repo,
    });
    if (!check.ok) {
      deps.postMessage(createHostError(requestId, check.error));
      return;
    }
    if (!repo) {
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
    if (!Number.isInteger(hunkIndex) || hunkIndex < 0) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("INVALID_REQUEST", "Invalid hunk index."),
        ),
      );
      return;
    }

    try {
      if (action === "stage") {
        await hunkPatch.stageHunk(repo.rootPath, path, hunkIndex);
      } else {
        await hunkPatch.unstageHunk(repo.rootPath, path, hunkIndex);
      }
      await deps.refreshCoordinator.refreshNow(repo.id);
      deps.postMessage(
        createHostResponse(requestId, `diff.${action}Hunk`, {
          path,
          hunkIndex,
        }),
      );
    } catch (err) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("GIT_COMMAND_FAILED", gitCommandError(err)),
        ),
      );
    }
  }

  async function mutateLines(
    requestId: string,
    repoId: string,
    filePath: unknown,
    lines: unknown,
    action: "stage" | "unstage",
  ) {
    const repo = await resolveRepo(repoId);
    const check = validateMutationPreconditions({
      trusted: deps.trusted,
      repository: repo,
    });
    if (!check.ok) {
      deps.postMessage(createHostError(requestId, check.error));
      return;
    }
    if (!repo) {
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

    if (!Array.isArray(lines) || lines.length === 0) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("INVALID_REQUEST", "Select at least one changed line."),
        ),
      );
      return;
    }
    if (!lines.every(isLineSelection)) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("INVALID_REQUEST", "Invalid line selection payload."),
        ),
      );
      return;
    }

    try {
      if (action === "stage") {
        await linePatch.stageLines(repo.rootPath, path, lines);
      } else {
        await linePatch.unstageLines(repo.rootPath, path, lines);
      }
      await deps.refreshCoordinator.refreshNow(repo.id);
      deps.postMessage(
        createHostResponse(requestId, `diff.${action}Lines`, {
          path,
          lines,
        }),
      );
    } catch (err) {
      deps.postMessage(
        createHostError(
          requestId,
          createError("GIT_COMMAND_FAILED", gitCommandError(err)),
        ),
      );
    }
  }

  return {
    stageHunk(
      requestId: string,
      repoId: string,
      path: unknown,
      hunkIndex: number,
    ) {
      return mutateHunk(requestId, repoId, path, hunkIndex, "stage");
    },
    unstageHunk(
      requestId: string,
      repoId: string,
      path: unknown,
      hunkIndex: number,
    ) {
      return mutateHunk(requestId, repoId, path, hunkIndex, "unstage");
    },
    stageLines(
      requestId: string,
      repoId: string,
      path: unknown,
      lines: unknown,
    ) {
      return mutateLines(requestId, repoId, path, lines, "stage");
    },
    unstageLines(
      requestId: string,
      repoId: string,
      path: unknown,
      lines: unknown,
    ) {
      return mutateLines(requestId, repoId, path, lines, "unstage");
    },
  };
}
