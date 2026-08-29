import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 220;
const MENU_MARGIN = 8;
const MENU_MAX_HEIGHT = 280;

const popoverCls =
  "fixed z-[200] min-w-[200px] overflow-x-hidden overflow-y-auto p-1.5 flex flex-col gap-1 rounded-sm border border-[var(--vscode-menu-border,var(--border))] bg-[var(--vscode-menu-background,var(--vscode-editorWidget-background,var(--background)))] text-[var(--vscode-menu-foreground,var(--vscode-editor-foreground))] shadow-lg pointer-events-auto";

function place(
  anchor: HTMLElement,
  align: "left" | "right",
  height: number,
  width: number,
  maxHeightCap: number,
): { top: number; left: number; maxHeight: number; width: number } {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuWidth = Math.min(width, vw - MENU_MARGIN * 2);
  const left =
    align === "right"
      ? Math.max(MENU_MARGIN, Math.min(rect.right - menuWidth, vw - menuWidth - MENU_MARGIN))
      : Math.max(MENU_MARGIN, Math.min(rect.left, vw - menuWidth - MENU_MARGIN));
  const spaceBelow = vh - rect.bottom - MENU_MARGIN;
  const spaceAbove = rect.top - MENU_MARGIN;
  const desired = height > 0 ? height : Math.min(maxHeightCap, 240);
  const placeAbove = spaceBelow < Math.min(desired, maxHeightCap) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(
    120,
    Math.min(maxHeightCap, placeAbove ? spaceAbove : spaceBelow, vh - MENU_MARGIN * 2),
  );
  const top = placeAbove
    ? Math.max(MENU_MARGIN, rect.top - Math.min(height || maxHeight, maxHeight) - 4)
    : rect.bottom + 4;
  return { top, left, maxHeight, width: menuWidth };
}

export function LogMenuPortal({
  open,
  anchor,
  onClose,
  children,
  label,
  align = "left",
  maxHeight = MENU_MAX_HEIGHT,
  width = MENU_WIDTH,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  label: string;
  align?: "left" | "right";
  maxHeight?: number;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    const update = () => {
      setPos(
        place(
          anchor,
          align,
          panelRef.current?.offsetHeight ?? 0,
          width,
          maxHeight,
        ),
      );
    };
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [open, anchor, align, maxHeight, width]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchor?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, anchor, onClose]);

  if (!open || !pos || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className={popoverCls}
      style={{
        top: pos.top,
        left: pos.left,
        maxHeight: pos.maxHeight,
        width: pos.width,
        maxWidth: pos.width,
      }}
      role="dialog"
      aria-label={label}
      data-testid="log-menu-portal"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}
