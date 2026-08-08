import type { BlameErrorCode, BlameSide } from "../types/blame";

export type ExecGit = (
  repoRoot: string,
  args: string[],
  opts?: { maxBuffer?: number },
) => Promise<{ stdout: string; stderr: string }>;

export function isValidRepoRelativePath(relativePath: string): boolean {
  if (!relativePath || relativePath.trim() === "") {
    return false;
  }
  if (relativePath.startsWith("/") || relativePath.startsWith("\\")) {
    return false;
  }
  const segments = relativePath.split(/[/\\]/);
  return !segments.some((seg) => seg === "..");
}

/** Canonical repo-relative path with forward slashes, or null when invalid. */
export function canonicalRepoRelativePath(relativePath: string): string | null {
  if (!isValidRepoRelativePath(relativePath)) {
    return null;
  }
  return relativePath.replace(/\\/g, "/");
}

/**
 * Stricter than isValidRepoRelativePath — rejects repo root (`.`), directory
 * paths (`src/`), and empty/current-directory segments. Use for file mutations.
 */
export function isValidRepoRelativeFilePath(relativePath: string): boolean {
  const canonical = canonicalRepoRelativePath(relativePath);
  if (!canonical) {
    return false;
  }
  if (canonical === "." || canonical === "./") {
    return false;
  }
  if (canonical.endsWith("/")) {
    return false;
  }
  const segments = canonical.split("/");
  return segments.every((seg) => seg !== "" && seg !== ".");
}

export async function resolveBlameRef(
  execGit: ExecGit,
  repoRoot: string,
  side: BlameSide,
): Promise<{ ref: string } | { error: BlameErrorCode }> {
  if (side === "ours") {
    try {
      await execGit(repoRoot, ["rev-parse", "--verify", "HEAD"]);
      return { ref: "HEAD" };
    } catch {
      return { error: "REF_NOT_FOUND" };
    }
  }

  try {
    await execGit(repoRoot, ["rev-parse", "--verify", "MERGE_HEAD"]);
    return { ref: "MERGE_HEAD" };
  } catch {
    return { error: "REF_NOT_FOUND" };
  }
}

export function isValidCommitSha(sha: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(sha);
}
