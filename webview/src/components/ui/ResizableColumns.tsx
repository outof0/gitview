import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ResizableColumnsProps = {
  panes: ReactNode[];
  /** Default width percents per pane (must sum to ~100). */
  defaultPercents: number[];
  minPercent?: number;
  storageKey?: string;
  className?: string;
};

function normalizePercents(values: number[], count: number): number[] {
  if (values.length === count) {
    const sum = values.reduce((a, b) => a + b, 0);
    if (sum > 0) {
      return values.map((v) => (v / sum) * 100);
    }
  }
  const even = 100 / count;
  return Array.from({ length: count }, () => even);
}

/**
 * Always sized to `count`, never to `fallback.length`: a `defaultPercents` that
 * disagrees with `panes` would otherwise leave a pane without a slot, and the
 * drag handler would then persist `NaN` widths.
 */
function readStoredPercents(
  key: string | undefined,
  fallback: number[],
  count: number,
): number[] {
  if (!key) {
    return normalizePercents(fallback, count);
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return normalizePercents(fallback, count);
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return normalizePercents(fallback, count);
    }
    const nums = parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    if (nums.length !== count) {
      return normalizePercents(fallback, count);
    }
    return normalizePercents(nums, count);
  } catch {
    return normalizePercents(fallback, count);
  }
}

export function ResizableColumns({
  panes,
  defaultPercents,
  minPercent = 12,
  storageKey,
  className = "",
}: ResizableColumnsProps) {
  const count = panes.length;
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingHandle = useRef<number | null>(null);
  const [percents, setPercents] = useState(() =>
    readStoredPercents(storageKey, defaultPercents, count),
  );

  const persist = useCallback(
    (values: number[]) => {
      if (!storageKey) {
        return;
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(values));
      } catch {
        /* ignore quota */
      }
    },
    [storageKey],
  );

  useEffect(() => {
    setPercents(readStoredPercents(storageKey, defaultPercents, count));
  }, [storageKey, count]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const handle = draggingHandle.current;
      const container = containerRef.current;
      if (handle == null || !container) {
        return;
      }

      const width = container.getBoundingClientRect().width;
      if (width <= 0) {
        return;
      }

      const deltaPercent = (e.movementX / width) * 100;
      setPercents((prev) => {
        const next = [...prev];
        // `!`: a handle only exists between two adjacent panes, so both slots exist.
        const left = next[handle]! + deltaPercent;
        const right = next[handle + 1]! - deltaPercent;
        if (left < minPercent || right < minPercent) {
          return prev;
        }
        next[handle] = left;
        next[handle + 1] = right;
        persist(next);
        return next;
      });
    };

    const onUp = () => {
      draggingHandle.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [minPercent, persist]);

  const startDrag = (handleIndex: number) => {
    draggingHandle.current = handleIndex;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 overflow-hidden ${className}`}
      data-testid="resizable-columns"
    >
      {panes.map((pane, i) => (
        <Fragment key={i}>
          <div
            className="flex flex-col min-h-0 min-w-0 overflow-hidden shrink-0 h-full"
            style={{ width: `${percents[i] ?? 100 / count}%` }}
            data-testid={`resizable-column-${i}`}
          >
            {pane}
          </div>
          {i < panes.length - 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              tabIndex={0}
              className="shrink-0 z-10 w-[4px] cursor-col-resize bg-[var(--vscode-panel-border,var(--vscode-editorGroup-border,#444))] hover:bg-[var(--vscode-focusBorder,#007fd4)] transition-colors"
              onMouseDown={() => startDrag(i)}
              data-testid={`resizable-column-handle-${i}`}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
