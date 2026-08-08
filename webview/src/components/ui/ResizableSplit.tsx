import { useCallback, useEffect, useRef, useState } from "react";

type ResizableSplitProps = {
  direction: "horizontal" | "vertical";
  /** Initial size of the first pane in percent (0–100). */
  initialPercent?: number;
  minFirstPercent?: number;
  minSecondPercent?: number;
  /** Persist ratio in localStorage under this key. */
  storageKey?: string;
  first: React.ReactNode;
  second: React.ReactNode;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readStoredPercent(key: string | undefined, fallback: number): number {
  if (!key) {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) {
      return fallback;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function ResizableSplit({
  direction,
  initialPercent = 34,
  minFirstPercent = 18,
  minSecondPercent = 22,
  storageKey,
  first,
  second,
  className = "",
}: ResizableSplitProps) {
  const [percent, setPercent] = useState(() =>
    readStoredPercent(storageKey, initialPercent),
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const persist = useCallback(
    (value: number) => {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(value));
        } catch {
          /* ignore quota errors */
        }
      }
    },
    [storageKey],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const maxFirst = 100 - minSecondPercent;
      const minFirst = minFirstPercent;
      let next: number;
      if (direction === "horizontal") {
        next = ((e.clientX - rect.left) / rect.width) * 100;
      } else {
        next = ((e.clientY - rect.top) / rect.height) * 100;
      }
      next = clamp(next, minFirst, maxFirst);
      setPercent(next);
      persist(next);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [direction, minFirstPercent, minSecondPercent, persist]);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor =
      direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  const isHorizontal = direction === "horizontal";

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 overflow-hidden ${
        isHorizontal ? "flex-row" : "flex-col"
      } ${className}`}
      data-testid={`resizable-split-${direction}`}
    >
      <div
        className="h-full w-full min-h-0 min-w-0 overflow-hidden shrink-0 flex flex-col"
        style={
          isHorizontal ? { width: `${percent}%` } : { height: `${percent}%` }
        }
      >
        {first}
      </div>
      <div
        role="separator"
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        aria-valuenow={Math.round(percent)}
        tabIndex={0}
        className={`shrink-0 z-10 bg-[var(--vscode-panel-border,var(--vscode-editorGroup-border,#444))] hover:bg-[var(--vscode-focusBorder,#007fd4)] transition-colors ${
          isHorizontal
            ? "w-px cursor-col-resize hover:w-[3px]"
            : "h-px cursor-row-resize hover:h-[3px] w-full"
        }`}
        onMouseDown={startDrag}
        data-testid={`resizable-split-handle-${direction}`}
      />
      <div className="flex-1 h-full w-full min-h-0 min-w-0 overflow-hidden flex flex-col">
        {second}
      </div>
    </div>
  );
}
