import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  PROTOCOL_VERSION,
} from "../../shared/protocol";
import type { BranchCompareMode, BranchCompareSnapshot } from "../../shared/types/branch";
import type { WorkspaceDiffDocument } from "../../shared/types/diff";
import { validateRepoRelativePaths } from "../validatePaths";
import { gitCommandError, type BranchHandlerContext } from "./branchHelpers";

export function createBranchCompareHandlers(ctx: BranchHandlerContext) {
  const { deps, branchCompare, resolveRepo, validateRepo } = ctx;
  return {
    async buildCompareSnapshot(
      repo: { id: string; rootPath: string; currentBranch: string | null },
      selectedRef: string,
      mode: BranchCompareMode,
    ): Promise<BranchCompareSnapshot> {
      const files = await branchCompare.listFiles(repo.rootPath, selectedRef, mode);
      const current = await branchCompare.currentBranchRef(repo.rootPath);
      return {
        repoId: repo.id,
        mode,
        selectedRef,
        selectedLabel: selectedRef,
        baseLabel: mode === "current" ? current : "Working Tree",
        files,
        refreshedAt: Date.now(),
      };
    },

    emitCompareSnapshot(snapshot: BranchCompareSnapshot) {
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "branch.compare.snapshot",
        payload: snapshot,
      });
    },

    emitCompareDiff(document: WorkspaceDiffDocument) {
      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "diff.result",
        payload: document,
      });
    },

    async compareCurrent(
      requestId: string,
      repoId: string,
      ref: string,
      filePath?: string,
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
      const selectedRef = ref.trim();
      if (!selectedRef) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
          ),
        );
        return;
      }

      try {
        const snapshot = await this.buildCompareSnapshot(
          repo,
          selectedRef,
          "current",
        );
        this.emitCompareSnapshot(snapshot);

        const targetPath = filePath?.trim() || snapshot.files[0]?.path;
        let document: WorkspaceDiffDocument | undefined;
        if (targetPath) {
          const file = snapshot.files.find((entry) => entry.path === targetPath);
          const built = await branchCompare.buildFileDocument(
            repo.rootPath,
            repo.id,
            targetPath,
            selectedRef,
            "current",
            file?.status,
          );
          if (built) {
            document = built;
            this.emitCompareDiff(built);
          }
        }

        deps.postMessage(
          createHostResponse(requestId, "branch.compareCurrent", {
            snapshot,
            document,
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
    },

    async compareWorkingTree(
      requestId: string,
      repoId: string,
      ref: string,
      filePath?: string,
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
      const selectedRef = ref.trim();
      if (!selectedRef) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
          ),
        );
        return;
      }

      try {
        const snapshot = await this.buildCompareSnapshot(
          repo,
          selectedRef,
          "workingTree",
        );
        this.emitCompareSnapshot(snapshot);

        const targetPath = filePath?.trim() || snapshot.files[0]?.path;
        let document: WorkspaceDiffDocument | undefined;
        if (targetPath) {
          const file = snapshot.files.find((entry) => entry.path === targetPath);
          const built = await branchCompare.buildFileDocument(
            repo.rootPath,
            repo.id,
            targetPath,
            selectedRef,
            "workingTree",
            file?.status,
          );
          if (built) {
            document = built;
            this.emitCompareDiff(built);
          }
        }

        deps.postMessage(
          createHostResponse(requestId, "branch.compareWorkingTree", {
            snapshot,
            document,
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
    },

    async compareApplyFile(
      requestId: string,
      repoId: string,
      ref: string,
      filePath: unknown,
      mode: BranchCompareMode,
    ) {
      const repo = await validateRepo(requestId, repoId);
      if (!repo) {
        return;
      }
      const selectedRef = ref.trim();
      if (!selectedRef) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
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

      try {
        await branchCompare.applyFileFromBranch(
          repo.rootPath,
          selectedRef,
          path,
          mode,
        );
        await deps.refreshCoordinator.refreshNow(repo.id);
        deps.postMessage(
          createHostResponse(requestId, "branch.compareApplyFile", {
            path,
            ref: selectedRef,
            mode,
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
    },

    async compareFile(
      requestId: string,
      repoId: string,
      ref: string,
      filePath: unknown,
      mode: BranchCompareMode,
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
      const selectedRef = ref.trim();
      if (!selectedRef) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_REQUEST", "Branch ref is required."),
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

      try {
        const snapshot = await this.buildCompareSnapshot(repo, selectedRef, mode);
        const file = snapshot.files.find((entry) => entry.path === path);
        const document = await branchCompare.buildFileDocument(
          repo.rootPath,
          repo.id,
          path,
          selectedRef,
          mode,
          file?.status,
        );
        if (!document) {
          deps.postMessage(
            createHostError(
              requestId,
              createError("INVALID_PATH", "Could not build branch compare diff."),
            ),
          );
          return;
        }
        this.emitCompareDiff(document);
        deps.postMessage(
          createHostResponse(requestId, "branch.compareFile", document),
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
  };
}
