export type RepositoryMutationSerializer = {
  /**
   * Run `operation` after every other operation queued under the same key.
   *
   * Operations under different keys run concurrently, so two repositories never
   * block each other — only work aimed at the same repository is ordered.
   */
  run<T>(key: string, operation: () => Promise<T>): Promise<T>;
};

/**
 * Serialize repository work so a mutation cannot interleave with another
 * mutation, or with the refresh that follows one.
 *
 * Webview listeners dispatch requests fire-and-forget, so two requests that
 * arrive together run at the same time. A pull could therefore overlap a
 * checkout issued from another panel: each would independently read state,
 * decide it was safe, mutate, and refresh — and the two refresh payloads would
 * then describe a repository neither request produced. Ordering every request
 * for the same repository removes that whole class of race without making any
 * single request slower.
 */
export function createRepositoryMutationSerializer(): RepositoryMutationSerializer {
  const queues = new Map<string, Promise<void>>();

  return {
    run<T>(key: string, operation: () => Promise<T>): Promise<T> {
      const previous = queues.get(key) ?? Promise.resolve();
      // `then(operation, operation)` — queue regardless of how the previous
      // entry settled, otherwise one failure would wedge the repository.
      const next: Promise<T> = previous.then(operation, operation);
      const tracked = next.then(
        () => undefined,
        () => undefined,
      );
      queues.set(key, tracked);
      void tracked.then(() => {
        if (queues.get(key) === tracked) {
          queues.delete(key);
        }
      });
      return next;
    },
  };
}
