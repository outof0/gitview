import * as fs from "node:fs/promises";
import * as path from "path";
import { isValidRepoRelativePath } from "../services/blameRefs";

export type RepoPathError = {
  ok: false;
  code: "INVALID_PATH";
  message: string;
};

export type RepoPathSuccess = {
  ok: true;
  relativePath: string;
  absolutePath: string;
};

export type RepoPathResult = RepoPathSuccess | RepoPathError;

const INVALID_PATH_MESSAGE =
  "Path must be a non-empty relative path inside the repository.";

const defaultJoin = (root: string, rel: string): string => path.join(root, rel);

export function resolveRepoRelativePath(
  repoRoot: string,
  relativePath: string,
  joinPath: (root: string, rel: string) => string = defaultJoin,
): RepoPathResult {
  if (!isValidRepoRelativePath(relativePath)) {
    return {
      ok: false,
      code: "INVALID_PATH",
      message: INVALID_PATH_MESSAGE,
    };
  }

  const canonicalRelativePath = path.posix.normalize(
    relativePath.replace(/\\/g, "/"),
  );
  const absolutePath = path.resolve(
    joinPath(repoRoot, canonicalRelativePath),
  );
  const normalizedRoot = path.resolve(repoRoot);
  const rootWithSep =
    normalizedRoot.endsWith(path.sep) ?
      normalizedRoot
    : normalizedRoot + path.sep;

  if (
    absolutePath !== normalizedRoot &&
    !absolutePath.startsWith(rootWithSep)
  ) {
    return {
      ok: false,
      code: "INVALID_PATH",
      message: INVALID_PATH_MESSAGE,
    };
  }

  return {
    ok: true,
    relativePath: canonicalRelativePath,
    absolutePath,
  };
}

export type RepoRealPathSuccess = RepoPathSuccess & {
  /** Where the path actually points once symlinks are resolved. */
  realPath: string;
};

export type RepoRealPathResult = RepoRealPathSuccess | RepoPathError;

/**
 * Resolve the nearest existing ancestor and re-attach the missing tail.
 *
 * `realpath` needs the path to exist, but writes legitimately target files that
 * do not exist yet. Walking up keeps those working while still resolving every
 * directory that *does* exist — including a directory that turns out to be a
 * symlink pointing out of the repository.
 */
async function realpathAllowingMissingTail(
  target: string,
  floor: string,
): Promise<string> {
  const missing: string[] = [];
  let current = target;

  for (;;) {
    try {
      const resolved = await fs.realpath(current);
      return missing.length > 0
        ? path.join(resolved, ...missing.reverse())
        : resolved;
    } catch {
      const parent = path.dirname(current);
      if (parent === current || current.length <= floor.length) {
        throw new Error(`Cannot resolve ${target}`);
      }
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

/**
 * Containment check that survives symlinks.
 *
 * `resolveRepoRelativePath` is purely lexical: `vendor/link -> /etc/passwd`
 * normalises to a path that still starts with the repository root, so every
 * containment test passes while the write lands outside the repository. Any
 * path that will be used for a write must go through this instead.
 */
export async function resolveRepoRelativeRealPath(
  repoRoot: string,
  relativePath: string,
): Promise<RepoRealPathResult> {
  const lexical = resolveRepoRelativePath(repoRoot, relativePath);
  if (!lexical.ok) {
    return lexical;
  }

  try {
    const normalizedRoot = path.resolve(repoRoot);
    const realRoot = await fs.realpath(normalizedRoot);
    const realPath = await realpathAllowingMissingTail(
      lexical.absolutePath,
      normalizedRoot,
    );

    if (realPath !== realRoot && !realPath.startsWith(realRoot + path.sep)) {
      return {
        ok: false,
        code: "INVALID_PATH",
        message: INVALID_PATH_MESSAGE,
      };
    }

    return {
      ok: true,
      relativePath: lexical.relativePath,
      absolutePath: lexical.absolutePath,
      realPath,
    };
  } catch {
    // Unresolvable path — refuse rather than fall back to the lexical answer.
    return {
      ok: false,
      code: "INVALID_PATH",
      message: INVALID_PATH_MESSAGE,
    };
  }
}
