import * as fs from "fs/promises";
import * as path from "path";
import type { WorkspaceDiffDocument } from "../../shared/types/diff";
import type { GitFileStatus } from "../../shared/types/status";
import type { GitExecFn } from "./types";

async function readWorktreeFile(
  repoRoot: string,
  relativePath: string,
): Promise<string | null> {
  try {
    return await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}

async function readHeadFile(
  execGit: GitExecFn,
  repoRoot: string,
  relativePath: string,
): Promise<string | null> {
  try {
    const { stdout } = await execGit(repoRoot, ["show", `HEAD:${relativePath}`]);
    return stdout;
  } catch {
    return null;
  }
}

function statusCode(file: GitFileStatus): WorkspaceDiffDocument["status"] {
  if (file.kind === "added" || file.kind === "unversioned") {
    return "A";
  }
  if (file.kind === "deleted") {
    return "D";
  }
  if (file.kind === "renamed") {
    return "R";
  }
  if (file.conflicted) {
    return "U";
  }
  return "M";
}

export function createWorkspaceDiffApi(
  execGit: GitExecFn,
  isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
  async function buildWorkingTreeDiff(
    repoRoot: string,
    repoId: string,
    file: GitFileStatus,
    opts?: { staged?: boolean },
  ): Promise<WorkspaceDiffDocument> {
    const relativePath = file.path;
    const binary = await isBinaryFile(repoRoot, relativePath);
    const code = statusCode(file);
    const staged = opts?.staged ?? file.staged;

    if (binary) {
      return {
        repoId,
        filePath: relativePath,
        layout: "single",
        status: code,
        left: { label: "HEAD", text: "[Binary file]" },
        right: { label: staged ? "Index" : "Working Tree", text: "[Binary file]" },
        binary: true,
        staged,
      };
    }

    const headText = (await readHeadFile(execGit, repoRoot, relativePath)) ?? "";
    const worktreeText = (await readWorktreeFile(repoRoot, relativePath)) ?? "";

    let leftLabel = "HEAD";
    let rightLabel = "Working Tree";
    let leftText = headText;
    let rightText = worktreeText;

    if (staged) {
      try {
        const { stdout } = await execGit(repoRoot, [
          "show",
          `:${relativePath}`,
        ]);
        rightText = stdout;
        rightLabel = "Index";
      } catch {
        rightText = worktreeText;
      }
    }

    if (code === "A") {
      leftText = "";
      leftLabel = "Empty";
    }
    if (code === "D") {
      rightText = "";
      rightLabel = "Deleted";
    }

    return {
      repoId,
      filePath: relativePath,
      layout: code === "A" || code === "D" ? "single" : "split",
      status: code,
      left: { label: leftLabel, text: leftText },
      right: { label: rightLabel, text: rightText },
      binary: false,
      staged,
    };
  }

  return { buildWorkingTreeDiff };
}