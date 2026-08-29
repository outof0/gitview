import type { GitExecFn } from "./types";

export type NumstatTotals = {
  additions: number;
  deletions: number;
};

/** Sums `git diff --numstat` output; binary rows report "-" and contribute 0. */
export function parseNumstatTotals(stdout: string): NumstatTotals {
  let additions = 0;
  let deletions = 0;
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const match = trimmed.match(/^(\d+|-)\t(\d+|-)\t/);
    if (!match) {
      continue;
    }
    additions += match[1] === "-" ? 0 : Number(match[1]);
    deletions += match[2] === "-" ? 0 : Number(match[2]);
  }
  return { additions, deletions };
}

export function isValidRefSpec(refSpec: string): boolean {
  const trimmed = refSpec.trim();
  if (!trimmed) {
    return false;
  }
  if (trimmed.startsWith("-")) {
    return false;
  }
  for (let i = 0; i < trimmed.length; i += 1) {
    const code = trimmed.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return false;
    }
  }
  if (/[;|&$`"\\*?[\]{}()<>!~#]/.test(trimmed)) {
    return false;
  }
  return true;
}

export function createNumstatApi(execGit: GitExecFn) {
  async function totalsForRefSpec(
    repoRoot: string,
    refSpec: string,
  ): Promise<NumstatTotals> {
    if (!isValidRefSpec(refSpec)) {
      throw new Error(`Invalid refSpec: ${refSpec}`);
    }
    const { stdout } = await execGit(repoRoot, ["diff", "--numstat", refSpec, "--"]);
    return parseNumstatTotals(stdout);
  }

  async function totalsForPaths(
    repoRoot: string,
    paths: readonly string[],
  ): Promise<NumstatTotals> {
    if (paths.length === 0) {
      return { additions: 0, deletions: 0 };
    }
    const { stdout } = await execGit(repoRoot, [
      "diff",
      "HEAD",
      "--numstat",
      "--",
      ...paths,
    ]);
    return parseNumstatTotals(stdout);
  }

  return { totalsForRefSpec, totalsForPaths };
}
