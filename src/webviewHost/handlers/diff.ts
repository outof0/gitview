import { validateMutationPreconditions } from "../../application/mutationPreconditions";
import { createCrlfCheckApi } from "../../services/git/crlfCheck";
import { createMergeApi } from "../../services/git/merge";
import { createNumstatApi, isValidRefSpec } from "../../services/git/numstat";
import { createStatusApi } from "../../services/git/status";
import { createWorkspaceDiffApi } from "../../services/git/workspaceDiff";
import { buildRepoStatusSnapshot } from "../../services/statusSnapshot";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../../shared/protocol";
import type { RepositoryService } from "../../services/repositoryService";
import type { ChangelistStorage } from "../../storage/changelistStorage";
import { validateRepoRelativePaths } from "../validatePaths";
import type { GitExecFn } from "../../services/git/types";

import type { StandaloneDiffPreview } from "../../shared/types/diff";

export type DiffHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  changelistStorage?: ChangelistStorage;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
  getCrlfWarningsEnabled?: () => boolean;
  openDiffInEditor?: (
    preview: StandaloneDiffPreview,
    workspaceRoot?: string,
  ) => Promise<void>;
};

export function createDiffHandlers(deps: DiffHandlerDeps) {
  const statusApi = createStatusApi(deps.execGit);
  const merge = createMergeApi(deps.execGit);
  const workspaceDiff = createWorkspaceDiffApi(deps.execGit, merge.isBinaryFile);
  const crlfCheck = createCrlfCheckApi(deps.execGit);
  const numstat = createNumstatApi(deps.execGit);

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

  return {
    async open(
      requestId: string,
      repoId: string,
      filePath: unknown,
      staged?: boolean,
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

      const snapshot = await buildRepoStatusSnapshot(
        statusApi,
        repo.rootPath,
        repo.id,
        { changelistStorage: deps.changelistStorage },
      );
      const file = snapshot.files.find((f) => f.path === path);
      if (!file || file.kind === "ignored") {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", "File is not part of the working tree."),
          ),
        );
        return;
      }

      const document = await workspaceDiff.buildWorkingTreeDiff(
        repo.rootPath,
        repo.id,
        file,
        { staged },
      );

      if (deps.getCrlfWarningsEnabled?.() && !document.binary) {
        const crlf = await crlfCheck.checkFile(repo.rootPath, path);
        if (crlf.warn && crlf.message) {
          deps.postMessage({
            protocolVersion: PROTOCOL_VERSION,
            type: "notification",
            payload: { level: "warning", message: crlf.message },
          });
        }
      }

      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "diff.result",
        payload: document,
      });
      deps.postMessage(
        createHostResponse(requestId, "diff.open", document),
      );
    },

    async numstat(
      requestId: string,
      repoId: string,
      filePaths: unknown,
      ref?: unknown,
    ) {
      const repo = await resolveRepo(repoId);
      if (!repo) {
        return;
      }
      const trust = validateMutationPreconditions({
        trusted: deps.trusted,
        repository: repo,
      });
      if (!trust.ok) {
        deps.postMessage(createHostError(requestId, trust.error));
        return;
      }
      const refSpec = typeof ref === "string" ? ref.trim() : "";
      if (refSpec && !isValidRefSpec(refSpec)) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REF", `Invalid refSpec: ${refSpec}`),
          ),
        );
        return;
      }
      let validatedPaths: string[] = [];
      if (!refSpec || (Array.isArray(filePaths) && filePaths.length > 0)) {
        const validated = validateRepoRelativePaths(repo.rootPath, filePaths);
        if (!validated.ok) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("INVALID_PATH", validated.message),
            ),
          );
          return;
        }
        validatedPaths = validated.paths;
      }

      try {
        const totals = refSpec
          ? await numstat.totalsForRefSpec(repo.rootPath, refSpec)
          : await numstat.totalsForPaths(repo.rootPath, validatedPaths);
        deps.postMessage(
          createHostResponse(requestId, "diff.numstat", totals),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", String(err)),
          ),
        );
      }
    },

    async openInEditor(
      requestId: string,
      preview: StandaloneDiffPreview,
      workspaceRoot?: string,
    ) {
      if (!deps.openDiffInEditor) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("NOT_IMPLEMENTED", "Open in editor is not available in this surface."),
          ),
        );
        return;
      }
      try {
        await deps.openDiffInEditor(preview, workspaceRoot);
        deps.postMessage(
          createHostResponse(requestId, "diff.openInEditor", { ok: true as const }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", err instanceof Error ? err.message : String(err)),
          ),
        );
      }
    },
  };
}
