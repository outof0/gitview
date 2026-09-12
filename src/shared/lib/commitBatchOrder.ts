/**
 * Batch order for multi-commit cherry-pick / revert.
 *
 * The log selection is a `Set` in click order, but Git operations need
 * history order: cherry-picking a stack must apply the oldest commit first,
 * and the revert batch runs through the same oldest-first list (the service
 * reverses it into a single newest-first sequencer). Passing click order
 * through would apply dependent commits backwards whenever the user clicked
 * the newest row first.
 *
 * Order is normalized against the displayed newest-first history. Commits
 * outside the current view (filtered log) keep their relative click order
 * after the ordered ones — their age is unknown, and inventing one would be
 * worse than preserving intent.
 */
export function orderShasOldestFirst(
  shas: string[],
  newestFirstLog: string[],
): string[] {
  const index = new Map<string, number>();
  for (let position = 0; position < newestFirstLog.length; position++) {
    const sha = newestFirstLog[position];
    if (sha !== undefined && !index.has(sha)) {
      index.set(sha, position);
    }
  }
  const known: Array<{ sha: string; position: number; order: number }> = [];
  const unknown: Array<{ sha: string; order: number }> = [];
  const seen = new Set<string>();
  shas.forEach((sha, order) => {
    if (seen.has(sha)) {
      return;
    }
    seen.add(sha);
    const position = index.get(sha);
    if (position === undefined) {
      unknown.push({ sha, order });
    } else {
      known.push({ sha, position, order });
    }
  });
  // Newest-first log: a larger position is an older commit.
  known.sort((left, right) => right.position - left.position || left.order - right.order);
  unknown.sort((left, right) => left.order - right.order);
  return [...known.map((entry) => entry.sha), ...unknown.map((entry) => entry.sha)];
}
