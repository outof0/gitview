import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { GitExecFn } from "./types";

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m;

export function splitPatchHunks(unifiedDiff: string): string[] {
  if (!unifiedDiff.trim()) {
    return [];
  }
  const lines = unifiedDiff.split("\n");
  const headerEnd = lines.findIndex((line) => HUNK_HEADER.test(line));
  if (headerEnd < 0) {
    return [];
  }
  const fileHeader = lines.slice(0, headerEnd).join("\n");
  const hunks: string[] = [];
  let current: string[] = [];
  for (let i = headerEnd; i < lines.length; i++) {
    const line = lines[i]!;
    if (HUNK_HEADER.test(line) && current.length > 0) {
      hunks.push([fileHeader, ...current].join("\n"));
      current = [line];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    hunks.push([fileHeader, ...current].join("\n"));
  }
  return hunks;
}

export function extractHunkPatch(unifiedDiff: string, hunkIndex: number): string | null {
  const hunks = splitPatchHunks(unifiedDiff);
  return hunks[hunkIndex] ?? null;
}

export function combineHunkPatches(
  unifiedDiff: string,
  hunkIndexes: number[],
): string | null {
  const hunks = splitPatchHunks(unifiedDiff);
  if (hunks.length === 0 || hunkIndexes.length === 0) {
    return null;
  }
  const selected = hunkIndexes
    .filter((index) => Number.isInteger(index) && index >= 0 && index < hunks.length)
    .map((index) => hunks[index]!)
    .filter(Boolean);
  if (selected.length === 0) {
    return null;
  }
  const headerEnd = selected[0]!.split("\n").findIndex((line) => HUNK_HEADER.test(line));
  const fileHeader =
    headerEnd > 0 ? selected[0]!.split("\n").slice(0, headerEnd).join("\n") : "";
  const bodies = selected.map((hunk) => {
    const lines = hunk.split("\n");
    const start = lines.findIndex((line) => HUNK_HEADER.test(line));
    return start >= 0 ? lines.slice(start).join("\n") : hunk;
  });
  return `${fileHeader}\n${bodies.join("\n")}`.trim();
}

async function writeTempPatch(content: string): Promise<string> {
  const file = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "gitview-patch-")),
    "hunk.patch",
  );
  const normalized = content.endsWith("\n") ? content : `${content}\n`;
  await fs.writeFile(file, normalized, "utf8");
  return file;
}

export function createHunkPatchApi(execGit: GitExecFn) {
  async function readWorkingTreeDiff(
    repoRoot: string,
    relativePath: string,
    staged: boolean,
  ): Promise<string> {
    const args = staged
      ? ["diff", "--cached", "HEAD", "--", relativePath]
      : ["diff", "HEAD", "--", relativePath];
    const { stdout } = await execGit(repoRoot, args);
    return stdout;
  }

  async function applyCachedPatch(
    repoRoot: string,
    patch: string,
    reverse = false,
  ): Promise<void> {
    const patchFile = await writeTempPatch(patch);
    try {
      const args = ["apply", "--cached"];
      if (reverse) {
        args.push("--reverse");
      }
      args.push(patchFile);
      await execGit(repoRoot, args);
    } finally {
      await fs.rm(path.dirname(patchFile), { recursive: true, force: true });
    }
  }

  async function stageHunk(
    repoRoot: string,
    relativePath: string,
    hunkIndex: number,
  ): Promise<void> {
    const diff = await readWorkingTreeDiff(repoRoot, relativePath, false);
    const hunk = extractHunkPatch(diff, hunkIndex);
    if (!hunk) {
      throw new Error("Hunk is no longer available. Refresh the diff and try again.");
    }
    await applyCachedPatch(repoRoot, hunk, false);
  }

  async function unstageHunk(
    repoRoot: string,
    relativePath: string,
    hunkIndex: number,
  ): Promise<void> {
    const diff = await readWorkingTreeDiff(repoRoot, relativePath, true);
    const hunk = extractHunkPatch(diff, hunkIndex);
    if (!hunk) {
      throw new Error("Staged hunk is no longer available. Refresh the diff and try again.");
    }
    await applyCachedPatch(repoRoot, hunk, true);
  }

  return {
    readWorkingTreeDiff,
    splitPatchHunks,
    extractHunkPatch,
    stageHunk,
    unstageHunk,
  };
}