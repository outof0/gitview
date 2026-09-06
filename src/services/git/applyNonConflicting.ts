import { reflowResultRanges, serializeResult } from "../../core/serialize";
import { buildChangeBlocks } from "../../core/threeWay";
import { createFileService, encodeFileContent, writeBufferAtomically } from "../fileService";
import { resolveRepoRelativeRealPath } from "../../util/repoPath";
import { createMergeApi } from "./merge";
import type { GitExecFn } from "./types";

export type ApplyNonConflictingResult = {
  applied: string[];
  skipped: string[];
};

export function createApplyNonConflictingApi(execGit: GitExecFn) {
  const merge = createMergeApi(execGit);
  const files = createFileService();

  async function applyNonConflicting(
    repoRoot: string,
  ): Promise<ApplyNonConflictingResult> {
    const unmerged = await merge.listUnmergedFiles(repoRoot);
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const entry of unmerged) {
      const relativePath = entry.relativePath;
      // Unmerged paths come from Git output; resolve symlinks before any
      // worktree write so a linked entry cannot redirect content outside.
      const resolved = await resolveRepoRelativeRealPath(repoRoot, relativePath);
      if (!resolved.ok) {
        skipped.push(relativePath);
        continue;
      }
      if (await merge.isBinaryFile(repoRoot, relativePath)) {
        skipped.push(relativePath);
        continue;
      }

      const [base, ours, theirs] = await Promise.all([
        merge.readStage(repoRoot, relativePath, 1),
        merge.readStage(repoRoot, relativePath, 2),
        merge.readStage(repoRoot, relativePath, 3),
      ]);
      const blocks = buildChangeBlocks(base ?? "", ours ?? "", theirs ?? "");
      if (blocks.some((block) => block.kind === "conflict")) {
        skipped.push(relativePath);
        continue;
      }

      const absolutePath = resolved.absolutePath;
      const fileInfo = await files.readFile(absolutePath);
      const reflowed = reflowResultRanges(blocks);
      const content = serializeResult(
        reflowed,
        fileInfo.eol,
        fileInfo.hasFinalNewline,
      );
      await writeBufferAtomically(
        repoRoot,
        absolutePath,
        encodeFileContent(content, {
          eol: fileInfo.eol,
          hasFinalNewline: fileInfo.hasFinalNewline,
        }),
      );
      await merge.addFile(repoRoot, relativePath);
      applied.push(relativePath);
    }

    return { applied, skipped };
  }

  return { applyNonConflicting };
}