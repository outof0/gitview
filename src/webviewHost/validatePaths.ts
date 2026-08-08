import { resolveRepoRelativePath } from "../util/repoPath";

export type ValidatedPaths =
  | { ok: true; paths: string[] }
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