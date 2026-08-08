import type { BlameResult, BlameSide } from "../../types/blame";
import { parseBlamePorcelain, truncateBlameLines } from "../blameParser";
import { isValidRepoRelativePath, resolveBlameRef } from "../blameRefs";
import {
  BLAME_CACHE_MAX_ENTRIES,
  BLAME_CACHE_TTL_MS,
  type BlameCacheEntry,
  type GitExecFn,
} from "./types";
import { isBinaryBlameError, isFileNotAtRefError } from "./exec";

/**
 * The ref belongs in the key: annotate blames HEAD and the working tree for the
 * same file, and a ref-less key made those two evict each other on every save.
 */
function blameCacheKey(
  repoRoot: string,
  relativePath: string,
  ref: string,
): string {
  return `${repoRoot}\0${relativePath}\0${ref}`;
}

export function createBlameApi(
  execGit: GitExecFn,
  blameCache: Map<string, BlameCacheEntry>,
  isBinaryFile: (repoRoot: string, filePath: string) => Promise<boolean>,
) {
  function getCachedBlame(
    repoRoot: string,
    relativePath: string,
    ref: string,
  ): BlameCacheEntry | null {
    const key = blameCacheKey(repoRoot, relativePath, ref);
    const entry = blameCache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.fetchedAt > BLAME_CACHE_TTL_MS) {
      blameCache.delete(key);
      return null;
    }
    // Re-insert so Map iteration order tracks recency for the eviction below.
    blameCache.delete(key);
    blameCache.set(key, entry);
    return entry;
  }

  function setCachedBlame(
    repoRoot: string,
    relativePath: string,
    ref: string,
    lines: BlameCacheEntry["lines"],
    truncated: boolean,
  ): void {
    const key = blameCacheKey(repoRoot, relativePath, ref);
    blameCache.delete(key);
    blameCache.set(key, { ref, lines, truncated, fetchedAt: Date.now() });
    while (blameCache.size > BLAME_CACHE_MAX_ENTRIES) {
      const oldest = blameCache.keys().next();
      if (oldest.done) {
        break;
      }
      blameCache.delete(oldest.value);
    }
  }

  function clearBlameCache(): void {
    blameCache.clear();
  }

  async function blameWorkingTree(
    repoRoot: string,
    relativePath: string,
  ): Promise<BlameResult> {
    return runBlame(repoRoot, null, relativePath);
  }

  /** HEAD first, then working tree — matches compact blame on real repos. */
  async function blameFileForAnnotate(
    repoRoot: string,
    relativePath: string,
  ): Promise<BlameResult> {
    const atHead = await blameFile(repoRoot, "HEAD", relativePath);
    if (atHead.ok) {
      return atHead;
    }
    if (atHead.code === "FILE_NOT_AT_REF") {
      const worktree = await blameWorkingTree(repoRoot, relativePath);
      if (worktree.ok) {
        return worktree;
      }
    }
    return atHead;
  }

  async function blameFile(
    repoRoot: string,
    ref: string,
    relativePath: string,
  ): Promise<BlameResult> {
    return runBlame(repoRoot, ref, relativePath);
  }

  async function runBlame(
    repoRoot: string,
    ref: string | null,
    relativePath: string,
  ): Promise<BlameResult> {
    if (!isValidRepoRelativePath(relativePath)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: "Path must be a relative path inside the repository.",
      };
    }

    const cacheRef = ref ?? "WORKTREE";
    const cached = getCachedBlame(repoRoot, relativePath, cacheRef);
    if (cached) {
      return {
        ok: true,
        lines: cached.lines,
        truncated: cached.truncated || undefined,
      };
    }

    if (await isBinaryFile(repoRoot, relativePath)) {
      return {
        ok: false,
        code: "BINARY_FILE",
        message: "Git blame is not available for binary files.",
      };
    }

    try {
      const args = ["blame", "--line-porcelain", "-M", "-C"];
      if (ref) {
        args.push(ref);
      }
      args.push("--", relativePath);
      const { stdout } = await execGit(repoRoot, args, {
        maxBuffer: 20 * 1024 * 1024,
      });
      const parsed = parseBlamePorcelain(stdout);
      const { lines, truncated } = truncateBlameLines(parsed);
      setCachedBlame(repoRoot, relativePath, cacheRef, lines, truncated);
      return { ok: true, lines, truncated: truncated || undefined };
    } catch (err) {
      if (isBinaryBlameError(err)) {
        return {
          ok: false,
          code: "BINARY_FILE",
          message: "Git blame is not available for binary files.",
        };
      }
      if (isFileNotAtRefError(err)) {
        return {
          ok: false,
          code: "FILE_NOT_AT_REF",
          message: `File is not present at ${ref}.`,
        };
      }
      return {
        ok: false,
        code: "GIT_ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function blameFileForSide(
    repoRoot: string,
    relativePath: string,
    side: BlameSide,
  ): Promise<BlameResult> {
    const refResult = await resolveBlameRef(execGit, repoRoot, side);
    if ("error" in refResult) {
      return {
        ok: false,
        code: refResult.error,
        message:
          side === "theirs"
            ? "MERGE_HEAD is not available. Blame for the incoming side requires an active merge."
            : "HEAD is not available.",
      };
    }
    return blameFile(repoRoot, refResult.ref, relativePath);
  }

  return {
    blameFile,
    blameWorkingTree,
    blameFileForAnnotate,
    blameFileForSide,
    clearBlameCache,
  };
}