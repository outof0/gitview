import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "gitView.blame.annotateGutterWidth.v3";
const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 140;
const MAX_WIDTH = 340;

function readStoredWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) {
      return DEFAULT_WIDTH;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function useBlameGutterWidth() {
  const [width, setWidth] = useState(readStoredWidth);
  const dragging = useRef(false);

  const persist = useCallback((value: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) {
        return;
      }
      const host = document.querySelector<HTMLElement>(
        "[data-testid='blame-editor']",
      );
      if (!host) {
        return;
      }
      const rect = host.getBoundingClientRect();
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, e.clientX - rect.left),
      );
      setWidth(next);
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
  }, [persist]);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return { gutterWidth: width, startGutterDrag: startDrag };
}
