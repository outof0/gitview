import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export function ToolbarSeparator() {
  return <span className="w-px h-5 bg-vscode-panel-border mx-1.5" />;
}

type ToolbarIconButtonProps = {
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  "data-testid"?: string;
  className?: string;
  children: ReactNode;
};

export function ToolbarIconButton({
  onClick,
  title,
  disabled,
  className = "",
  children,
  ...rest
}: ToolbarIconButtonProps) {
  return (
    <Button
      variant="toolbar"
      size="icon"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={rest["aria-label"]}
      aria-pressed={rest["aria-pressed"]}
      data-testid={rest["data-testid"]}
      className={className}
    >
      {children}
    </Button>
  );
}

export type ToolbarDropdownItem = {
  value: string;
  label: string;
  active: boolean;
  onSelect: () => void;
};

type ToolbarDropdownProps = {
  label: ReactNode;
  title: string;
  items: ToolbarDropdownItem[];
  align?: "left" | "right";
  testId?: string;
};

type ToolbarOverflowProps = {
  label?: ReactNode;
  title?: string;
  testId?: string;
  children: ReactNode;
};

export function ToolbarOverflow({
  label = "More",
  title = "More options",
  testId,
  children,
}: ToolbarOverflowProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeIfOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="ui-toolbar-overflow relative" ref={ref}>
      <Button
        variant="secondary"
        size="compact"
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <div
          role="dialog"
          aria-label={title}
          data-testid={testId ? `${testId}-popover` : undefined}
          className="absolute right-0 top-full z-50 mt-0.5 flex w-64 max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-vscode border border-menu-border bg-menu-bg p-2 text-menu-fg shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

// Click-to-open menu matching the mockup's simple dropdowns. Closes on outside
// click or Escape.
export function ToolbarDropdown({
  label,
  title,
  items,
  align = "left",
  testId,
}: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <Button
        variant="toolbar"
        size="compact"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        className="text-foreground"
      >
        {label}{" "}
        <span className="text-ui-sm text-vscode-description">
          ▾
        </span>
      </Button>
      {open && (
        <div
          role="menu"
          data-testid={testId ? `${testId}-menu` : undefined}
          className={`nx-context-menu absolute top-full mt-0.5 z-50 min-w-log-menu py-1 border border-menu-border bg-menu-bg shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
          style={{ borderRadius: "var(--nx-menu-radius)" }}
        >
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitemradio"
              aria-checked={item.active}
              data-testid={testId ? `${testId}-${item.value}` : undefined}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className="nx-menu-item w-full flex items-center justify-between gap-2 min-h-menu-item px-menu-pad-x py-menu-pad-y text-ui text-left text-menu-fg hover:bg-menu-selection hover:text-menu-selectionForeground border-0 bg-transparent cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="truncate">{item.label}</span>
              {item.active && (
                <span
                  className="shrink-0 text-ui-sm"
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.5l5 5H3l5-5z" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 11.5l-5-5h10l-5 5z" />
    </svg>
  );
}
