import * as path from "node:path";

type RepoRootLookup = {
  findRepoRoot: (startPath: string) => Promise<string | null>;
};

/**
 * Resolve the Git toplevel for a workspace path + optional repo-relative target.
 * Tries the concrete file/folder first so parent workspaces and monorepos work.
 */
export async function findRepoRootForTarget(
  git: RepoRootLookup,
  workspaceRoot: string,
  relativeTarget?: string,
): Promise<string | null> {
  const trimmed = relativeTarget?.trim().replace(/\\/g, "/");
  if (trimmed && trimmed !== "." && trimmed !== "") {
    const fromTarget = await git.findRepoRoot(
      path.join(workspaceRoot, trimmed),
    );
    if (fromTarget) {
      return fromTarget;
    }
  }
  return git.findRepoRoot(workspaceRoot);
}

/** Resolve Git toplevel starting at an absolute file or folder path. */
export async function findRepoRootForPath(
  git: RepoRootLookup,
  absolutePath: string,
): Promise<string | null> {
  return git.findRepoRoot(absolutePath);
}

/**
 * Convert a workspace-relative path to a path relative to the Git toplevel.
 * Needed when the workspace folder is a parent of the repository (monorepos).
 */
export function workspaceRelativeToRepoRelative(
  workspaceRoot: string,
  repoRoot: string,
  workspaceRelativePath: string,
): string {
  const normalized = workspaceRelativePath.trim().replace(/\\/g, "/");
  if (!normalized || normalized === ".") {
    return ".";
  }
  const absolute = path.join(workspaceRoot, normalized);
  const rel = path.relative(repoRoot, absolute).replace(/\\/g, "/");
  if (!rel || rel.startsWith("../") || rel === "..") {
    return normalized;
  }
  return rel;
}