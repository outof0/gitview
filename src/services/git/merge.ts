import * as fs from "fs/promises";
import * as path from "path";
import { nonInteractiveContinueEnv } from "./exec";
import type { GitExecFn } from "./types";
import {
  deriveSpecialKind,
  isUnmergedCode,
  parsePorcelainStatus,
} from "./porcelain";

export function createMergeApi(execGit: GitExecFn) {
  async function listUnmergedFiles(repoRoot: string): Promise<
    Array<{
      relativePath: string;
      stageCode: string;
      specialKind: ReturnType<typeof deriveSpecialKind>;
    }>
  > {
    const { stdout } = await execGit(repoRoot, [
      "status",
      "--porcelain=v1",
      "-z",
    ]);
    const records = parsePorcelainStatus(stdout);
    return records
      .filter((r) => isUnmergedCode(r.xy))
      .map((r) => ({
        relativePath: r.path,
        stageCode: r.xy,
        specialKind: deriveSpecialKind(r.xy),
      }));
  }

  async function readStage(
    repoRoot: string,
    filePath: string,
    stage: 1 | 2 | 3,
  ): Promise<string | null> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "show",
        `:${stage}:${filePath}`,
      ]);
      return stdout;
    } catch {
      return null;
    }
  }

  async function readWorktreeFile(
    repoRoot: string,
    filePath: string,
  ): Promise<string> {
    const absolutePath = path.join(repoRoot, filePath);
    const buffer = await fs.readFile(absolutePath);
    return buffer.toString("utf8");
  }

  async function addFile(repoRoot: string, filePath: string): Promise<void> {
    await execGit(repoRoot, ["add", "--", filePath]);
  }

  async function checkoutOurs(
    repoRoot: string,
    filePath: string,
  ): Promise<void> {
    await execGit(repoRoot, ["checkout", "--ours", "--", filePath]);
  }

  async function checkoutTheirs(
    repoRoot: string,
    filePath: string,
  ): Promise<void> {
    await execGit(repoRoot, ["checkout", "--theirs", "--", filePath]);
  }

  async function abortMerge(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["merge", "--abort"]);
  }

  async function continueMerge(repoRoot: string): Promise<void> {
    await execGit(repoRoot, ["merge", "--continue"], {
      env: nonInteractiveContinueEnv,
    });
  }

  function isNumstatBinary(stdout: string): boolean {
    const lines = stdout.trim().split("\n").filter(Boolean);
    for (const line of lines) {
      const parts = line.split("\t");
      if (parts[0] === "-" && parts[1] === "-") {
        return true;
      }
    }
    return false;
  }

  function needsStageBinaryCheck(worktreeNumstat: string): boolean {
    const lines = worktreeNumstat.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      return true;
    }
    return lines.every((line) => {
      const [added, removed] = line.split("\t");
      return added === "0" && removed === "0";
    });
  }

  async function isBinaryDiff(
    repoRoot: string,
    left: string,
    right: string,
  ): Promise<boolean> {
    const { stdout: numstat } = await execGit(repoRoot, [
      "diff",
      "--numstat",
      left,
      right,
    ]);
    if (isNumstatBinary(numstat)) {
      return true;
    }
    const { stdout: summary } = await execGit(repoRoot, [
      "diff",
      "--summary",
      left,
      right,
    ]);
    return /binary files? differ/i.test(summary);
  }

  async function isBinaryFile(
    repoRoot: string,
    filePath: string,
  ): Promise<boolean> {
    try {
      const { stdout } = await execGit(repoRoot, [
        "diff",
        "--numstat",
        "--",
        filePath,
      ]);
      if (isNumstatBinary(stdout)) {
        return true;
      }

      if (!needsStageBinaryCheck(stdout)) {
        return false;
      }

      // Unmerged entries often report 0/0 in worktree diff; compare index stages.
      const stagePairs: Array<[string, string]> = [
        [`:1:${filePath}`, `:2:${filePath}`],
        [`:2:${filePath}`, `:3:${filePath}`],
        [`:1:${filePath}`, `:3:${filePath}`],
      ];
      for (const [left, right] of stagePairs) {
        if (await isBinaryDiff(repoRoot, left, right)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  return {
    listUnmergedFiles,
    readStage,
    readWorktreeFile,
    addFile,
    checkoutOurs,
    checkoutTheirs,
    abortMerge,
    continueMerge,
    isBinaryFile,
  };
}