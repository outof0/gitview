import * as path from "node:path";
import { createGitService } from "../../out/services/gitService";
import { buildMergeDocument } from "../../out/core/mergeDocument";
import type { BlameLine, GitCommitEntry } from "../../src/types/blame";
import type { MergeDocument } from "../../src/core/types";

const repoRoot = path.resolve(process.cwd(), "test-conflict-repo");

const git = createGitService();

export async function loadRealMergeDocument(): Promise<MergeDocument> {
  const base = await git.readStage(repoRoot, "file.txt", 1);
  const ours = await git.readStage(repoRoot, "file.txt", 2);
  const theirs = await git.readStage(repoRoot, "file.txt", 3);
  const branchInfo = await git.getBranchInfo(repoRoot);

  const doc = buildMergeDocument({
    repoRoot,
    relativePath: "file.txt",
    absolutePath: path.join(repoRoot, "file.txt"),
    base,
    ours,
    theirs,
    worktree: ours ?? "",
  });
  return {
    ...doc,
    oursLabel: branchInfo.currentBranch || doc.oursLabel,
    theirsLabel: branchInfo.mergeHead || doc.theirsLabel,
  };
}

export async function loadRealBlame(
  side: "ours" | "theirs",
): Promise<{ lines: BlameLine[]; authorSample: string; shaSample: string }> {
  const result = await git.blameFileForSide(repoRoot, "file.txt", side);
  if (!result.ok || result.lines.length === 0) {
    throw new Error(`Real blame failed for ${side}: ${JSON.stringify(result)}`);
  }
  const line = result.lines.find((l) => l.lineNumber === 2) ?? result.lines[0];
  return {
    lines: result.lines,
    authorSample: line.author,
    shaSample: line.shortSha,
  };
}

export async function loadRealFileLog(): Promise<{
  commits: GitCommitEntry[];
  subjectSample: string;
}> {
  const result = await git.logFile(repoRoot, "file.txt", { limit: 10 });
  if (!result.ok || result.commits.length === 0) {
    throw new Error(`Real log failed: ${JSON.stringify(result)}`);
  }
  return {
    commits: result.commits,
    subjectSample: result.commits[0].subject,
  };
}

export async function loadRealChangesFromSide(): Promise<{
  commits: GitCommitEntry[];
  revisionRange: string;
}> {
  const result = await git.logChangesFromSide(repoRoot, "ours", {
    filterPath: "file.txt",
    limit: 10,
  });
  if (!result.ok) {
    throw new Error(`Real changes-from-side failed: ${JSON.stringify(result)}`);
  }
  return {
    commits: result.commits,
    revisionRange: result.revisionRange,
  };
}

export const conflictsListPayload = {
  protocolVersion: 1,
  type: "conflict.snapshot" as const,
  payload: {
    repoRoot,
    files: [{ relativePath: "file.txt", stageCode: "UU" }],
    branchInfo: {
      currentBranch: "main",
      mergeHead: "feature/conflict",
    },
  },
};
