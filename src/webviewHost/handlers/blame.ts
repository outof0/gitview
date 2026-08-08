import * as path from "node:path";
import * as vscode from "vscode";
import { createBlameApi } from "../../services/git/blame";
import { createMergeApi } from "../../services/git/merge";
import { createFileService } from "../../services/fileService";
import { createError } from "../../shared/errors/codes";
import {
  createHostError,
  createHostResponse,
  PROTOCOL_VERSION,
  type HostToWebview,
} from "../../shared/protocol";
import type { BlameSnapshot } from "../../shared/types/blame";
import type { RepositoryService } from "../../services/repositoryService";
import { validateRepoRelativePaths } from "../validatePaths";
import type { BlameCacheEntry, GitExecFn } from "../../services/git/types";

export type BlameHandlerDeps = {
  execGit: GitExecFn;
  repositoryService: RepositoryService;
  blameCache: Map<string, BlameCacheEntry>;
  trusted: boolean;
  workspaceFolders: Array<{ uriPath: string; name: string }>;
  postMessage: (message: HostToWebview) => void;
};

function blameCacheKey(repoRoot: string, relativePath: string): string {
  return `${repoRoot}\0${relativePath}`;
}

export function createBlameHandlers(deps: BlameHandlerDeps) {
  const merge = createMergeApi(deps.execGit);
  const blame = createBlameApi(
    deps.execGit,
    deps.blameCache,
    merge.isBinaryFile,
  );
  const files = createFileService();

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
    async query(
      requestId: string,
      repoId: string,
      filePath: unknown,
      ref?: string,
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
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      const relPath = validated.paths[0]!;
      const blameRef = ref?.trim() || "HEAD";

      const result = await blame.blameFile(repo.rootPath, blameRef, relPath);
      if (!result.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("GIT_COMMAND_FAILED", result.message),
          ),
        );
        return;
      }

      const snapshot: BlameSnapshot = {
        repoId: repo.id,
        filePath: relPath,
        ref: blameRef,
        lines: result.lines,
        truncated: result.truncated,
        refreshedAt: Date.now(),
      };

      deps.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        type: "blame.snapshot",
        payload: snapshot,
      });
      deps.postMessage(createHostResponse(requestId, "blame.query", snapshot));
    },

    /** Persist annotate editor edits to the worktree file (JetBrains-style). */
    async writeFile(
      requestId: string,
      repoId: string,
      filePath: unknown,
      content: string,
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
      if (!validated.ok) {
        deps.postMessage(
          createHostError(
            requestId,
            createError("INVALID_PATH", validated.message),
          ),
        );
        return;
      }
      const relPath = validated.paths[0]!;
      const absolutePath = path.join(repo.rootPath, relPath);

      try {
        let eol: "lf" | "crlf" = "lf";
        let hasFinalNewline = true;
        try {
          const existing = await files.readFile(absolutePath);
          eol = existing.eol;
          hasFinalNewline = existing.hasFinalNewline;
        } catch {
          /* new / unreadable file — defaults */
        }
        await files.writeFile(absolutePath, content, { eol, hasFinalNewline });
        deps.blameCache.delete(blameCacheKey(repo.rootPath, relPath));

        // Keep any open VS Code buffer in sync without focusing a new tab.
        const uri = vscode.Uri.file(absolutePath);
        for (const doc of vscode.workspace.textDocuments) {
          if (doc.uri.fsPath !== absolutePath || doc.isClosed) {
            continue;
          }
          if (doc.getText() === content) {
            continue;
          }
          const edit = new vscode.WorkspaceEdit();
          const full = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length),
          );
          edit.replace(uri, full, content);
          await vscode.workspace.applyEdit(edit);
        }

        deps.postMessage(
          createHostResponse(requestId, "file.write", {
            path: relPath,
            saved: true,
          }),
        );
      } catch (err) {
        deps.postMessage(
          createHostError(
            requestId,
            createError(
              "GIT_COMMAND_FAILED",
              err instanceof Error ? err.message : String(err),
            ),
          ),
        );
      }
    },
  };
}
