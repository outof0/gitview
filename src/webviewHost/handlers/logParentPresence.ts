import type { GitExecFn } from "../../services/git/types";
import type { LogCommitEntry, LogQueryFilters } from "../../shared/types/log";

/**
 * How a log command was scoped. `git log --parents` rewrites `%P` to the
 * simplified history for path filters, so those parents are already the
 * filtered set. `--follow` file history and the filter combinations that git
 * does not rewrite (author/date/grep/no-merges/first-parent) need explicit
 * presence flags instead.
 */
export type LogParentScope = "path" | "file" | "repo";

export type ParentPresenceOptions = {
  scope: LogParentScope;
  filters?: LogQueryFilters;
  /**
   * Complete SHA set of the filtered history, used when git keeps raw parents.
   * Returning null means the scan failed; parents are then treated as absent
   * so no lane is reserved for a commit that may never arrive.
   */
  loadFilteredShas?: () => Promise<ReadonlySet<string> | null>;
};

const MERGE_QUERY_BATCH = 256;

/** Limiting filters whose removed parents git does not rewrite back into `%P`. */
function hasFilteredParentHistory(filters?: LogQueryFilters): boolean {
  return Boolean(
    filters?.author?.trim() ||
      filters?.since?.trim() ||
      filters?.until?.trim() ||
      filters?.grep?.trim() ||
      filters?.range === "incoming" ||
      filters?.range === "outgoing",
  );
}

/**
 * Parents that are merges never appear in a `--no-merges` traversal. Asking
 * git to classify only the page's parent SHAs keeps this bounded per page.
 * Returns null when the check fails; callers then treat parents as absent
 * rather than reserving a lane that can never resolve.
 */
async function findMergeParents(
  execGit: GitExecFn,
  repoRoot: string,
  commits: readonly LogCommitEntry[],
): Promise<Set<string> | null> {
  const parents = new Set<string>();
  for (const commit of commits) {
    for (const parent of commit.parentShas ?? []) {
      parents.add(parent);
    }
  }
  if (parents.size === 0) {
    return new Set();
  }

  const mergeParents = new Set<string>();
  const allParents = [...parents];
  try {
    for (let start = 0; start < allParents.length; start += MERGE_QUERY_BATCH) {
      const { stdout } = await execGit(repoRoot, [
        "rev-list",
        "--no-walk",
        "--merges",
        ...allParents.slice(start, start + MERGE_QUERY_BATCH),
      ]);
      for (const line of stdout.split(/\s+/)) {
        if (line) {
          mergeParents.add(line);
        }
      }
    }
    return mergeParents;
  } catch {
    return null;
  }
}

export async function annotateParentPresence(
  execGit: GitExecFn,
  repoRoot: string,
  commits: LogCommitEntry[],
  options: ParentPresenceOptions,
): Promise<LogCommitEntry[]> {
  const { scope, filters, loadFilteredShas } = options;
  if (scope === "path") {
    return commits;
  }

  const firstParent = scope === "repo" && Boolean(filters?.firstParent);
  const noMerges = scope === "repo" && Boolean(filters?.noMerges);
  const unknownHistory = scope === "file" || hasFilteredParentHistory(filters);
  if (!firstParent && !noMerges && !unknownHistory) {
    return commits;
  }

  // Author/date/grep and --follow keep raw parents, so only the full filtered
  // SHA set can tell "not loaded yet" apart from "filtered out".
  const filteredShas =
    unknownHistory && loadFilteredShas ? await loadFilteredShas() : null;
  const mergeParents =
    !unknownHistory && noMerges
      ? await findMergeParents(execGit, repoRoot, commits)
      : null;

  return commits.map((commit) => {
    const parents = commit.parentShas ?? [];
    if (parents.length === 0) {
      return commit;
    }
    const parentPresent = parents.map((parent, index) => {
      if (unknownHistory) {
        return filteredShas?.has(parent) ?? false;
      }
      if (firstParent && index > 0) {
        return false;
      }
      if (noMerges && (!mergeParents || mergeParents.has(parent))) {
        return false;
      }
      return true;
    });
    return { ...commit, parentPresent };
  });
}
