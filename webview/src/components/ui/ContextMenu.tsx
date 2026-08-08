import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
} | null;

type ContextMenuProps = {
  menu: ContextMenuState;
  onClose: () => void;
  testId?: string;
  ariaLabel?: string;
  children: ReactNode;
  minWidth?: number;
};

const MENU_VIEWPORT_MARGIN = 8;

export function ContextMenu({
  menu,
  onClose,
  testId,
  ariaLabel = "Context menu",
  children,
  minWidth = 240,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<{
    left: number;
    top: number;
  } | null>(null);

  // A long menu opened near the bottom edge would otherwise run past the
  // viewport, leaving its last rows unreachable.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!menu?.visible || !el) {
      setPlacement(null);
      return;
    }
    const { width, height } = el.getBoundingClientRect();
    setPlacement({
      left: Math.max(
        MENU_VIEWPORT_MARGIN,
        Math.min(menu.x, window.innerWidth - width - MENU_VIEWPORT_MARGIN),
      ),
      top: Math.max(
        MENU_VIEWPORT_MARGIN,
        Math.min(menu.y, window.innerHeight - height - MENU_VIEWPORT_MARGIN),
      ),
    });
  }, [menu?.visible, menu?.x, menu?.y]);

  useEffect(() => {
    if (!menu?.visible) {
      return;
    }
    const dismiss = () => onClose();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu?.visible, onClose]);

  if (!menu?.visible) {
    return null;
  }

  return (
    <div
      ref={ref}
      data-testid={testId}
      role="menu"
      aria-label={ariaLabel}
      className="nx-context-menu fixed z-[1000] py-1 bg-menu-bg border border-menu-border shadow-2xl font-[family-name:var(--nx-font-ui)] max-h-[min(72vh,560px)] overflow-y-auto overflow-x-hidden"
      style={{
        left: `${placement?.left ?? menu.x}px`,
        top: `${placement?.top ?? menu.y}px`,
        minWidth: `${minWidth}px`,
        maxWidth: "min(360px, calc(100vw - 16px))",
        borderRadius: "var(--nx-menu-radius)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function openContextMenu(
  e: React.MouseEvent,
  setMenu: (state: ContextMenuState) => void,
): void {
  e.preventDefault();
  e.stopPropagation();
  setMenu({ visible: true, x: e.clientX, y: e.clientY });
}
