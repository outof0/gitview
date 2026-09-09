/** Normalize a repo-relative path for stale-guard comparisons. */
function normalizeRepoRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "") || ".";
}

export function repoPathsEqual(a: string, b: string): boolean {
  return normalizeRepoRelativePath(a) === normalizeRepoRelativePath(b);
}
