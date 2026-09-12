import {
  resolveRepoRelativePath,
  resolveRepoRelativeRealPath,
} from "../util/repoPath";

export type ValidatedPaths =
  | { ok: true; paths: string[] }
  | { ok: false; message: string };

export type ValidatedRealPaths =
  | { ok: true; paths: string[]; realPaths: string[] }
  | { ok: false; message: string };

export function validateRepoRelativePaths(
  repoRoot: string,
  paths: unknown,
): ValidatedPaths {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { ok: false, message: "At least one file path is required." };
  }

  const validated: string[] = [];
  for (const raw of paths) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return { ok: false, message: "Invalid file path in request." };
    }
    const result = resolveRepoRelativePath(repoRoot, raw.replace(/\\/g, "/"));
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    validated.push(result.relativePath);
  }

  return { ok: true, paths: [...new Set(validated)] };
}

/**
 * Same as `validateRepoRelativePaths`, but resolves symlinks before trusting the
 * answer. Required for anything that writes: a lexical check lets
 * `vendor/link -> /outside` through, and the write then lands outside the
 * repository. Prefer the synchronous version for read-only requests.
 */
export async function validateRepoRelativeRealPaths(
  repoRoot: string,
  paths: unknown,
): Promise<ValidatedRealPaths> {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { ok: false, message: "At least one file path is required." };
  }

  const validated: string[] = [];
  const realPaths: string[] = [];
  for (const raw of paths) {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return { ok: false, message: "Invalid file path in request." };
    }
    const result = await resolveRepoRelativeRealPath(
      repoRoot,
      raw.replace(/\\/g, "/"),
    );
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    validated.push(result.relativePath);
    realPaths.push(result.realPath);
  }

  return { ok: true, paths: [...new Set(validated)], realPaths };
}