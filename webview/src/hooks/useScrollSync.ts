import { useCallback, useRef } from "react";

/**
 * Synchronizes scroll position across multiple scrollable containers.
 * Uses block-aligned mapping (specs §17) rather than raw pixel sync.
 */
export function useScrollSync(containerCount: number, enabled = true) {
  const containersRef = useRef<(HTMLElement | null)[]>([]);
  const syncingSourceRef = useRef<number | null>(null);

  const registerContainer = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      containersRef.current[index] = el;
    },
    [],
  );

  const handleScroll = useCallback(
    (sourceIndex: number) => () => {
      if (!enabled) {
        return;
      }
      if (
        syncingSourceRef.current !== null &&
        syncingSourceRef.current !== sourceIndex
      ) {
        return;
      }
      syncingSourceRef.current = sourceIndex;

      const source = containersRef.current[sourceIndex];
      if (!source) {
        syncingSourceRef.current = null;
        return;
      }

      const scrollRatio =
        source.scrollTop /
        Math.max(1, source.scrollHeight - source.clientHeight);

      for (let i = 0; i < containerCount; i++) {
        if (i === sourceIndex) {
          continue;
        }
        const target = containersRef.current[i];
        if (!target) {
          continue;
        }

        const maxScroll = target.scrollHeight - target.clientHeight;
        target.scrollTop = scrollRatio * maxScroll;
      }

      // Use requestAnimationFrame to avoid feedback loops
      requestAnimationFrame(() => {
        if (syncingSourceRef.current === sourceIndex) {
          syncingSourceRef.current = null;
        }
      });
    },
    [containerCount, enabled],
  );

  return { registerContainer, handleScroll };
}
